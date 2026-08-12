/**
 * 无人机调度金融决策引擎 Dispatcher Financial Engine
 *
 * 定位：
 *   Y.Mine 软芯片在低空物流与应急调度场景的金融工程决策内核。
 *   将「状态感知 → 三周期锚定 → 三因子CAPM → 1/e概率映射 → 认知画圈 → 线性调度接口」完整实例化。
 *
 * 数据流：
 *   输入(场景状态) → 三周期锚定(长/中/短) → 协方差矩阵 + β → Score
 *   → P_success = 1 - e^(-Score) → 1/e 阈值 → 认知画圈(safe/observe/forbidden)
 *   → 线性接口 S → 决策信号(execute/abort/defer) → 输出
 *
 * 依赖：
 *   - logger（统一日志）
 *   - investorEngine.extractUserData（人格 → 情绪校准，体现 Y.Mine 母系统联动）
 *
 * 说明：
 *   本模块为纯函数金融引擎，不依赖 React/UI，可独立单元测试。
 *   输出层（策略库/指令）仍由 dispatchEngine.js 负责，本模块只产出决策信号。
 */

import { logger } from './logger';
import { investorEngine } from './investorEngine';

// ==================== 常量 ====================

/** 衰减系数 λ 参考值（按环境动态程度） */
export const DECAY_LAMBDAS = {
  STABLE: 0.001, // 稳定环境（室内仓库）：极慢衰减，历史长期有效
  GENERAL: 0.01, // 一般环境（城市物流）：中等衰减
  DYNAMIC: 0.05, // 高动态环境（灾区应急）：快速衰减，只认最近几周
};

/** 环境类型键 */
export const ENV_TYPES = {
  STABLE: 'stable',
  GENERAL: 'general',
  DYNAMIC: 'dynamic',
};

/** β 稳定性约束 */
export const BETA_CONSTRAINTS = {
  MIN_VARIANCE: 0.001, // 方差下限，防止 β 爆炸
  MAX_BETA: 2.0,
  MIN_BETA: -2.0,
};

/** 自然常数基准阈值（1/e ≈ 36.8%） */
export const ONE_E = 1 / Math.E;

/** 认知画圈决策区域 */
export const COGNITIVE_ZONES = {
  SAFE: 'safe',
  OBSERVE: 'observe',
  FORBIDDEN: 'forbidden',
};

export const COGNITIVE_ZONE_LABELS = {
  [COGNITIVE_ZONES.SAFE]: { label: '安全区', description: '自动执行', color: '#10b981', emoji: '🟢' },
  [COGNITIVE_ZONES.OBSERVE]: { label: '观察区', description: '人工复核', color: '#f59e0b', emoji: '🟡' },
  [COGNITIVE_ZONES.FORBIDDEN]: { label: '禁区', description: '自动放弃', color: '#ef4444', emoji: '🔴' },
};

/** 决策建议 */
export const RECOMMENDATIONS = {
  EXECUTE: 'execute',
  ABORT: 'abort',
  DEFER: 'defer',
};

/** 线性调度接口输出映射 */
export const SIGNAL_CATEGORIES = {
  IMMEDIATE: { label: '立即执行', min: 0.7, max: 1.01, emoji: '🚀' },
  QUEUE: { label: '加入执行队列', min: 0.4, max: 0.7, emoji: '📋' },
  HOLD: { label: '暂存等待优化', min: 0.2, max: 0.4, emoji: '⏳' },
  ABORT: { label: '放弃执行', min: -Infinity, max: 0.2, emoji: '⛔' },
};

// ==================== 基础数学工具 ====================

export function safeNum(v, def = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : def;
}

export function clamp(v, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v));
}

function mean(values) {
  const arr = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(values) {
  const arr = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (arr.length - 1);
}

function covariance(a, b) {
  const pa = a.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const pb = b.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const n = Math.min(pa.length, pb.length);
  if (n < 2) return 0;
  const sa = pa.slice(0, n);
  const sb = pb.slice(0, n);
  const ma = mean(sa);
  const mb = mean(sb);
  return sa.reduce((acc, v, i) => acc + (v - ma) * (sb[i] - mb), 0) / (n - 1);
}

/** 指数衰减权重数组 w(t) = e^(-λ × Δt)，Δt 为距今的时间差（简化用索引倒序） */
function computeDecayWeights(values, lambda) {
  const n = values.length;
  return values.map((_, i) => {
    const dt = (n - 1 - i) / 10; // 归一化时间差：最旧为最大，最新为 0
    return Math.exp(-lambda * dt);
  });
}

function weightedMean(values, weights) {
  const totalW = weights.reduce((a, b) => a + b, 0);
  if (totalW <= 0) return mean(values);
  return values.reduce((acc, v, i) => acc + v * weights[i], 0) / totalW;
}

// ==================== 三周期锚定 ====================

/**
 * 计算三周期锚定
 * @param {Array} history 历史每日成功率序列 [{ t, rate(0-1), ... }]
 * @param {Object} kline 当日K线 { open, high, low, current, volume }
 * @param {string} envType 环境类型（决定 λ）
 * @returns {ThreePeriodAnchor}
 */
export function computeThreePeriodAnchors(history = [], kline = null, envType = ENV_TYPES.GENERAL) {
  const lambda = DECAY_LAMBDAS[envType] || DECAY_LAMBDAS.GENERAL;
  const rates = history
    .map((h) => safeNum(h && h.rate, null))
    .filter((v) => v !== null);

  // 长期锚定 R_f：指数衰减加权全部历史
  let longMean = mean(rates);
  let longVar = variance(rates);
  if (rates.length > 0) {
    longMean = weightedMean(rates, computeDecayWeights(rates, lambda));
  }

  // 中期锚定 R_m：最近 10 天滑动窗口均值
  const windowRates = rates.slice(-10);
  const medMean = mean(windowRates);
  const medVar = variance(windowRates);

  // 短期锚定 R_l：当日 K 线（收盘值 = 当前最新状态）
  const current = safeNum(kline && kline.current, rates.length ? rates[rates.length - 1] : null);
  const shortMean = current !== null ? current : medMean;
  const shortVar = kline ? Math.max(0.0001, variance([kline.open, kline.high, kline.low, kline.current])) : medVar;

  logger.info('[调度金融引擎][三周期锚定]', {
    envType,
    lambda,
    sampleCount: rates.length,
    longTerm: { mean: +longMean.toFixed(4), variance: +longVar.toFixed(4) },
    mediumTerm: { mean: +medMean.toFixed(4), variance: +medVar.toFixed(4), windowSize: windowRates.length },
    shortTerm: { mean: +shortMean.toFixed(4), variance: +shortVar.toFixed(4), kline: kline || null },
  });

  return {
    envType,
    lambda,
    sampleCount: rates.length,
    longTerm: { mean: longMean, variance: longVar },
    mediumTerm: { mean: medMean, variance: medVar, windowSize: windowRates.length },
    shortTerm: { mean: shortMean, variance: shortVar, kline: kline || null },
  };
}

// ==================== 协方差矩阵 + β ====================

/**
 * 计算三因子协方差矩阵与 β 系数
 * 三组合收益序列：由历史三条序列（长期/中期/短期）构成。
 * @param {Object} anchors 三周期锚定结果
 * @param {Object} sequences { long: [], medium: [], short: [] } 三条等长收益序列
 * @returns {CovarianceMatrix}
 */
export function computeCovarianceMatrix(anchors, sequences = null) {
  const { MIN_VARIANCE, MAX_BETA, MIN_BETA } = BETA_CONSTRAINTS;

  let longSeq = (sequences && sequences.long) || [];
  let medSeq = (sequences && sequences.medium) || [];
  let shortSeq = (sequences && sequences.short) || [];

  // 无序列时，用锚定的单点构造长度为 1 的最小序列
  if (!longSeq.length) longSeq = [anchors.longTerm.mean];
  if (!medSeq.length) medSeq = [anchors.mediumTerm.mean];
  if (!shortSeq.length) shortSeq = [anchors.shortTerm.mean];

  const varF = Math.max(MIN_VARIANCE, variance(longSeq.length > 1 ? longSeq : longSeq.concat(longSeq, longSeq)));
  const varM = Math.max(MIN_VARIANCE, variance(medSeq.length > 1 ? medSeq : medSeq.concat(medSeq, medSeq)));
  const varL = Math.max(MIN_VARIANCE, variance(shortSeq.length > 1 ? shortSeq : shortSeq.concat(shortSeq, shortSeq)));

  const covFM = covariance(longSeq, medSeq);
  const covFL = covariance(longSeq, shortSeq);
  const covML = covariance(medSeq, shortSeq);

  // β 系数，带稳定性约束
  const betaMedium = varF >= MIN_VARIANCE ? clamp(covFM / varF, MIN_BETA, MAX_BETA) : 1;
  const betaShort = varF >= MIN_VARIANCE ? clamp(covFL / varF, MIN_BETA, MAX_BETA) : 1;

  const matrix = [
    [varF, covFM, covFL],
    [covFM, varM, covML],
    [covFL, covML, varL],
  ];

  logger.info('[调度金融引擎][协方差矩阵]', {
    '3x3': matrix.map((r) => r.map((v) => +v.toFixed(4))),
    beta: { medium: +betaMedium.toFixed(4), short: +betaShort.toFixed(4) },
  });

  return {
    matrix,
    beta: { medium: betaMedium, short: betaShort },
    interpretation: {
      covFL: covFL < 0 ? '短期策略对冲长期风险（理想状态）' : covFL > 0 ? '短期与长期同向（中性）' : '零相关',
      covML: covML < 0 ? '策略在恶劣环境下更有效（α）' : '中性或同向',
    },
  };
}

// ==================== 综合评分 ====================

/**
 * 三因子定价：Score = R_f + βm×(R_m - R_f) + βl×(R_l - R_f)
 */
export function computeScore(anchors, covariance) {
  const { longTerm, mediumTerm, shortTerm } = anchors;
  const { beta } = covariance;

  const rf = longTerm.mean;
  const rm = mediumTerm.mean;
  const rl = shortTerm.mean;

  const score = rf + beta.medium * (rm - rf) + beta.short * (rl - rf);

  logger.info('[调度金融引擎][综合评分]', {
    R_f: +rf.toFixed(4),
    R_m: +rm.toFixed(4),
    R_l: +rl.toFixed(4),
    βm: +beta.medium.toFixed(4),
    βl: +beta.short.toFixed(4),
    score: +score.toFixed(4),
  });

  return score;
}

// ==================== 概率映射 ====================

export function computeProbability(score) {
  const p = 1 - Math.exp(-score);
  return clamp(p, 0, 1);
}

// ==================== 认知画圈 ====================

/**
 * 三维认知画圈决策边界
 * @param {number} score 综合评分
 * @param {number} risk 风险 σ（0-1）
 * @param {number} confidence 置信度（0-1）
 */
export function getDecisionZone(score, risk, confidence) {
  const p = computeProbability(score);

  // 硬约束：1/e 基准
  if (p < ONE_E) {
    logger.session('[调度金融引擎][认知画圈] 禁区（P低于1/e）', { score, p: +p.toFixed(4), risk, confidence });
    return COGNITIVE_ZONES.FORBIDDEN;
  }
  if (score < 0) {
    logger.session('[调度金融引擎][认知画圈] 禁区（Score<0）', { score });
    return COGNITIVE_ZONES.FORBIDDEN;
  }

  // 认知画圈：多维综合判断（方案 6.3）
  if (p > 0.6 && risk < 0.3 && confidence > 0.7) {
    logger.session('[调度金融引擎][认知画圈] 安全区', { score, p: +p.toFixed(4), risk, confidence });
    return COGNITIVE_ZONES.SAFE;
  }
  if (p > 0.4 && risk < 0.6 && confidence > 0.5) {
    logger.session('[调度金融引擎][认知画圈] 观察区', { score, p: +p.toFixed(4), risk, confidence });
    return COGNITIVE_ZONES.OBSERVE;
  }

  logger.session('[调度金融引擎][认知画圈] 禁区（多维不达标）', { score, p: +p.toFixed(4), risk, confidence });
  return COGNITIVE_ZONES.FORBIDDEN;
}

// ==================== 线性调度接口 ====================

/**
 * 调度信号 S = w₁×Score + w₂×P_success + w₃×紧急度 + w₄×资源可用率 + b
 */
export function computeDispatchSignal(
  { score, probability, urgency, resourceRate },
  weights = { score: 0.25, probability: 0.25, urgency: 0.25, resource: 0.25 },
  bias = 0
) {
  const wScore = safeNum(weights.score, 0.25);
  const wProb = safeNum(weights.probability, 0.25);
  const wUrg = safeNum(weights.urgency, 0.25);
  const wRes = safeNum(weights.resource, 0.25);

  const s =
    wScore * score +
    wProb * probability +
    wUrg * clamp(urgency, 0, 1) +
    wRes * clamp(resourceRate, 0, 1) +
    safeNum(bias, 0);

  let category = SIGNAL_CATEGORIES.ABORT;
  for (const key of Object.keys(SIGNAL_CATEGORIES)) {
    const cat = SIGNAL_CATEGORIES[key];
    if (s >= cat.min && s < cat.max) {
      category = cat;
      break;
    }
  }

  logger.info('[调度金融引擎][线性接口]', {
    s: +s.toFixed(4),
    weights: { wScore, wProb, wUrg, wRes },
    bias,
    category,
  });

  return { signal: s, category, raw: { score, probability, urgency, resourceRate } };
}

// ==================== 情绪校准（Y.Mine 人格联动） ====================

/**
 * 从 Y.Mine 人格数据构建情绪校准
 * riskAppetiteShift(-1~1) / confidenceMultiplier(0.8-1.2)
 */
export function buildEmotionalCalibration() {
  try {
    const userData = investorEngine.extractUserData();
    const riskTolerance = safeNum(userData.riskTolerance, 50) / 100;
    const kellyDeviation = clamp(safeNum(userData.kellyDeviation, 0), -1, 1);
    const executionDiscipline = safeNum(userData.executionDiscipline, 70) / 100;

    // 风险偏好偏移：凯利偏差为主，风险容忍度为辅
    const riskAppetiteShift = clamp(kellyDeviation * 0.7 + (riskTolerance - 0.5) * 0.6, -1, 1);
    // 置信乘数：执行纪律越高，对决策越自信
    const confidenceMultiplier = clamp(0.8 + executionDiscipline * 0.4, 0.8, 1.2);

    logger.session('[调度金融引擎][情绪校准]', {
      riskTolerance,
      kellyDeviation,
      executionDiscipline,
      riskAppetiteShift: +riskAppetiteShift.toFixed(3),
      confidenceMultiplier: +confidenceMultiplier.toFixed(3),
    });

    return { riskAppetiteShift, confidenceMultiplier, source: 'YmMine::investorEngine' };
  } catch (e) {
    logger.error('[调度金融引擎][情绪校准] 失败，使用默认值', e);
    return { riskAppetiteShift: 0, confidenceMultiplier: 1, source: 'default' };
  }
}

// ==================== 主入口 ====================

/**
 * 核心决策接口：生成完整调度决策信号（YMineChipOutput）
 *
 * @param {Object} input  YMineChipInput
 *   - scenarioState: { successRateHistorical, environmentalRisk, resourceAvailability, urgency, battery, windSpeed, distance }
 *   - history: [{ t, rate(0-1) }] 历史成功率序列（用于三周期锚定）
 *   - kline: { open, high, low, current, volume } 当日K线（可选）
 *   - envType: 'stable' | 'general' | 'dynamic'
 *   - weights, bias: 线性接口参数（可选）
 * @returns {YMineChipOutput}
 */
export function generateDispatchDecision(input = {}) {
  const scenario = input.scenarioState || {};
  const history = Array.isArray(input.history) ? input.history : [];
  const kline = input.kline || null;
  const envType = input.envType || ENV_TYPES.GENERAL;

  logger.session('══════════════════════════════════════');
  logger.session('[调度金融引擎] 开始决策', { scenario, sampleCount: history.length, envType });

  // Step 1: 三周期锚定
  const anchors = computeThreePeriodAnchors(history, kline, envType);

  // Step 2: 协方差矩阵 + β
  const sequences = {
    long: history.map((h) => safeNum(h && h.rate, anchors.longTerm.mean)),
    medium: history.slice(-10).map((h) => safeNum(h && h.rate, anchors.mediumTerm.mean)),
    short: history.map((h) => safeNum(h && h.rate, anchors.shortTerm.mean)),
  };
  const covariance = computeCovarianceMatrix(anchors, sequences);

  // Step 3: 综合评分
  const score = computeScore(anchors, covariance);

  // Step 4: 概率映射
  const probability = computeProbability(score);

  // Step 5: 情绪校准（Y.Mine 人格联动）
  const calibration = buildEmotionalCalibration();

  // Step 6: 风险 σ 与置信度
  const baseRisk = clamp(safeNum(scenario.environmentalRisk, 0.5), 0, 1);
  // 风险偏好偏移：越激进，感知风险越低（但不超过 0 下界）
  const risk = clamp(baseRisk - calibration.riskAppetiteShift * 0.15, 0, 1);

  // 置信度：样本量 + 方差异质性 + 情绪置信乘数
  const sampleFactor = clamp(0.5 + history.length * 0.03, 0.5, 0.9);
  const stabilityFactor = clamp(1 - anchors.longTerm.variance * 2, 0.5, 1);
  const confidence = clamp((sampleFactor + stabilityFactor) / 2 * calibration.confidenceMultiplier, 0.3, 0.98);

  // Step 7: 认知画圈
  const cognitiveZone = getDecisionZone(score, risk, confidence);

  // Step 8: 线性调度接口
  const urgency = clamp(safeNum(scenario.urgency, 0.5), 0, 1);
  const resourceRate = clamp(safeNum(scenario.resourceAvailability, 0.5), 0, 1);
  const signal = computeDispatchSignal(
    { score, probability, urgency, resourceRate },
    input.weights,
    input.bias
  );

  // Step 9: 决策建议
  let recommendation = RECOMMENDATIONS.EXECUTE;
  if (cognitiveZone === COGNITIVE_ZONES.FORBIDDEN || score < 0) {
    recommendation = RECOMMENDATIONS.ABORT;
  } else if (signal.category === SIGNAL_CATEGORIES.QUEUE || signal.category === SIGNAL_CATEGORIES.HOLD) {
    recommendation = RECOMMENDATIONS.DEFER;
  }

  // Step 10: 推理解释 — 定位主导因子
  const contributions = {
    '长期基准 R_f': anchors.longTerm.mean,
    '中期风险溢价 βm×(R_m-R_f)': covariance.beta.medium * (anchors.mediumTerm.mean - anchors.longTerm.mean),
    '短期超额 βl×(R_l-R_f)': covariance.beta.short * (anchors.shortTerm.mean - anchors.longTerm.mean),
  };
  const primaryFactor = Object.entries(contributions).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0][0];
  const confidenceLevel = confidence >= 0.7 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';

  const explanation = `三周期锚定（长期${+anchors.longTerm.mean.toFixed(3)} / 中期${+anchors.mediumTerm.mean.toFixed(3)} / 短期${+anchors.shortTerm.mean.toFixed(3)}），` +
    `主导因子「${primaryFactor}」，综合评分 ${score.toFixed(3)}，成功概率 ${(probability * 100).toFixed(1)}%，` +
    `认知画圈判定为「${COGNITIVE_ZONE_LABELS[cognitiveZone].label}」。`;

  const output = {
    decisionSignal: {
      score,
      probability,
      recommendation,
      cognitiveZone,
    },
    anchoring: anchors,
    covariance: { matrix: covariance.matrix, beta: covariance.beta, interpretation: covariance.interpretation },
    emotionalCalibration: calibration,
    risk,
    confidence,
    signal: signal.signal,
    signalCategory: signal.category,
    reasoning: {
      primaryFactor,
      confidenceLevel,
      explanation,
      contributions,
    },
    cognitiveZoneLabel: COGNITIVE_ZONE_LABELS[cognitiveZone],
    generatedAt: Date.now(),
  };

  logger.session(`[调度金融引擎] 决策完成`,
    `Score=${score.toFixed(3)} P=${(probability * 100).toFixed(1)}% Zone=${COGNITIVE_ZONE_LABELS[cognitiveZone].emoji}${COGNITIVE_ZONE_LABELS[cognitiveZone].label} Recommendation=${recommendation} S=${signal.signal.toFixed(3)}`);
  logger.session('══════════════════════════════════════');

  return output;
}

// ==================== 导出 ====================

export const dispatcherEngine = {
  DECAY_LAMBDAS,
  ENV_TYPES,
  BETA_CONSTRAINTS,
  ONE_E,
  COGNITIVE_ZONES,
  COGNITIVE_ZONE_LABELS,
  RECOMMENDATIONS,
  SIGNAL_CATEGORIES,
  safeNum,
  clamp,
  computeThreePeriodAnchors,
  computeCovarianceMatrix,
  computeScore,
  computeProbability,
  getDecisionZone,
  computeDispatchSignal,
  buildEmotionalCalibration,
  generateDispatchDecision,
};

export default dispatcherEngine;