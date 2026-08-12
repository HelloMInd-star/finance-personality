/**
 * Y.Mine 风险压力测试引擎 v1.0.0
 *
 * 巴塞尔 III 兼容的风险度量与压力测试能力：
 *  - 历史模拟法 VaR (Historical VaR)
 *  - 蒙特卡洛 VaR (Monte Carlo VaR)
 *  - CVaR / Expected Shortfall (条件风险价值)
 *  - 情景分析 (Scenario Analysis: 基准/不利/严重)
 *  - 敏感性分析 (Sensitivity Analysis: 单因子扰动)
 *  - 反向压力测试 (Reverse Stress Test: 损失→触发因子)
 *  - 信用风险 (Credit Risk: PD/LGD/EAD)
 *  - 流动性风险 (Liquidity Risk: LCR/NSFR)
 *
 * 与 quantEngine.js 的关系：
 *   - quantEngine.computeVaR() 为参数法 VaR（方差-协方差法）
 *   - 本文件提供历史模拟法、蒙特卡洛法、CVaR 三种补充
 *   - 四种 VaR 方法可互验，容差 ±5%
 */

import { logger } from './logger';
import { auditLogStore } from './storageBus';

// ============================================================
// 内部工具函数
// ============================================================
function safeNum(v, def = 0) {
  return typeof v === 'number' && !isNaN(v) ? v : def;
}
function safeArr(v, def = []) {
  return Array.isArray(v) ? v : def;
}
function safeObj(v, def = {}) {
  return v && typeof v === 'object' ? v : def;
}
function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, safeNum(v, 0)));
}

// 标准正态分布分位数
function zScore(confidence) {
  const conf = safeNum(confidence, 0.95);
  if (conf >= 0.999) return 3.090;
  if (conf >= 0.995) return 2.576;
  if (conf >= 0.99) return 2.326;
  if (conf >= 0.975) return 1.960;
  if (conf >= 0.95) return 1.645;
  if (conf >= 0.90) return 1.282;
  return 1.0;
}

// Box-Muller 高斯随机数
function gaussianRandom(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// 分位数计算（线性插值）
function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = (sortedArr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
}

// ============================================================
// 一、历史模拟法 VaR
// ============================================================

/**
 * 历史模拟法 VaR (Historical VaR)
 *
 * 原理：直接使用历史收益率的经验分布，不做分布假设
 * 公式：VaR_α = -percentile(returns, 1-α)
 *
 * 优点：不依赖正态分布假设，能捕捉肥尾
 * 缺点：依赖历史样本代表性，无法预测史无前例的事件
 *
 * @param {number[]} returns - 历史收益率序列（如日收益率）
 * @param {number} [confidence=0.95] - 置信度（0.90/0.95/0.99）
 * @param {number} [portfolioValue=10000] - 组合价值（用于计算绝对金额 VaR）
 * @returns {object} { varReturn, varAmount, percentile, sampleSize, tailLosses }
 */
export function computeHistoricalVaR(returns, confidence = 0.95, portfolioValue = 10000) {
  logger.session('[Risk:HistVaR] ▶ 入口', {
    原始输入_returns长度: Array.isArray(returns) ? returns.length : 0,
    置信度: confidence,
    组合价值: portfolioValue,
  });

  const rets = safeArr(returns, []).filter((r) => typeof r === 'number' && !isNaN(r));
  if (rets.length < 10) {
    logger.session('[Risk:HistVaR] ⚠ 样本不足', { 样本量: rets.length, 最低要求: 10, 返回: null });
    return null;
  }

  const conf = clamp(confidence, 0.5, 0.999);
  const pv = safeNum(portfolioValue, 10000);

  // 升序排列
  const sorted = [...rets].sort((a, b) => a - b);
  // VaR = -percentile(1-α)
  const p = 1 - conf;
  const varReturn = -percentile(sorted, p);
  const varAmount = varReturn * pv;

  // 尾部损失（用于 CVaR 计算）
  const tailLosses = sorted.filter((r) => r <= -varReturn).map((r) => -r);

  logger.session('[Risk:HistVaR] 参数归一化', {
    有效样本量: rets.length,
    置信度: `${(conf * 100).toFixed(1)}%`,
    分位数_p: `${(p * 100).toFixed(2)}%`,
    组合价值: +pv.toFixed(2),
  });
  logger.session('[Risk:HistVaR] ✓ 完成', {
    VaR_收益率: +varReturn.toFixed(6),
    VaR_百分比: `${(varReturn * 100).toFixed(3)}%`,
    VaR_金额: +varAmount.toFixed(2),
    尾部样本数: tailLosses.length,
    历史最差收益: +sorted[0].toFixed(6),
    历史最好收益: +sorted[sorted.length - 1].toFixed(6),
    含义: `基于${rets.length}个历史样本，在${(conf * 100).toFixed(0)}%置信度下，单日最大损失不超过 ${(varReturn * 100).toFixed(2)}%（${varAmount.toFixed(0)}元）`,
  });

  auditLogStore.append('risk', 'historical_var', { confidence: conf, varReturn, sampleSize: rets.length });

  return {
    varReturn,
    varAmount,
    percentile: p,
    sampleSize: rets.length,
    tailLosses,
    method: '历史模拟法',
  };
}

// ============================================================
// 二、蒙特卡洛 VaR
// ============================================================

/**
 * 蒙特卡洛 VaR (Monte Carlo VaR)
 *
 * 原理：基于 GBM（几何布朗运动）模拟大量价格路径，取终值分布的分位数
 * 公式：
 *   S_{t+1} = S_t × exp((μ - σ²/2)Δt + σ√Δt × Z)
 *   VaR_α = S_0 - percentile(S_T, 1-α)
 *
 * @param {object} params
 * @param {number} params.currentPrice - 当前价格 S_0
 * @param {number} params.mu - 年化漂移率（期望收益）
 * @param {number} params.sigma - 年化波动率
 * @param {number} [params.horizon=1] - 持有期（天）
 * @param {number} [params.confidence=0.95] - 置信度
 * @param {number} [params.paths=10000] - 模拟路径数
 * @param {number} [params.shares=100] - 持有股数
 * @returns {object} { varReturn, varAmount, varPrice, terminalPrices, pathCount }
 */
export function computeMonteCarloVaR(params = {}) {
  logger.session('[Risk:MCVaR] ▶ 入口', {
    原始输入: params,
  });

  const S0 = safeNum(params.currentPrice, 100);
  const mu = safeNum(params.mu, 0.08);
  const sigma = clamp(safeNum(params.sigma, 0.3), 0.01, 5);
  const horizon = safeNum(params.horizon, 1);
  const conf = clamp(safeNum(params.confidence, 0.95), 0.5, 0.999);
  const numPaths = Math.max(1000, Math.min(100000, safeNum(params.paths, 10000)));
  const shares = safeNum(params.shares, 100);

  const dt = horizon / 252; // 年化
  const drift = (mu - 0.5 * sigma * sigma) * dt;
  const diffusion = sigma * Math.sqrt(dt);

  logger.session('[Risk:MCVaR] 参数归一化', {
    当前价格_S0: S0,
    年化漂移_μ: `${(mu * 100).toFixed(2)}%`,
    年化波动_σ: `${(sigma * 100).toFixed(2)}%`,
    持有期: `${horizon}天`,
    置信度: `${(conf * 100).toFixed(1)}%`,
    模拟路径数: numPaths,
    持有股数: shares,
    时间步长_dt: +dt.toFixed(6),
    漂移项: +drift.toFixed(6),
    扩散项: +diffusion.toFixed(6),
  });

  // 模拟终端价格
  const terminalPrices = new Array(numPaths);
  const portfolioValues = new Array(numPaths);
  for (let i = 0; i < numPaths; i++) {
    const z = gaussianRandom(0, 1);
    const ST = S0 * Math.exp(drift + diffusion * z);
    terminalPrices[i] = ST;
    portfolioValues[i] = ST * shares;
  }

  // 计算收益率并排序
  const returns = terminalPrices.map((p) => (p - S0) / S0);
  const sortedReturns = [...returns].sort((a, b) => a - b);

  const p = 1 - conf;
  const varReturn = -percentile(sortedReturns, p);
  const varPrice = S0 * (1 - varReturn);
  const initialValue = S0 * shares;
  const varAmount = varReturn * initialValue;

  logger.session('[Risk:MCVaR] ✓ 完成', {
    模拟路径数: numPaths,
    VaR_收益率: +varReturn.toFixed(6),
    VaR_百分比: `${(varReturn * 100).toFixed(3)}%`,
    VaR_金额: +varAmount.toFixed(2),
    VaR_价格: +varPrice.toFixed(4),
    终端价格均值: +(terminalPrices.reduce((a, b) => a + b, 0) / numPaths).toFixed(4),
    终端价格中位数: +percentile([...terminalPrices].sort((a, b) => a - b), 0.5).toFixed(4),
    含义: `基于${numPaths}条蒙特卡洛路径，在${(conf * 100).toFixed(0)}%置信度下，${horizon}日最大损失不超过 ${(varReturn * 100).toFixed(2)}%（${varAmount.toFixed(0)}元）`,
  });

  auditLogStore.append('risk', 'monte_carlo_var', { confidence: conf, varReturn, paths: numPaths });

  return {
    varReturn,
    varAmount,
    varPrice,
    terminalPrices,
    pathCount: numPaths,
    method: '蒙特卡洛法',
  };
}

// ============================================================
// 三、CVaR / Expected Shortfall
// ============================================================

/**
 * CVaR (Conditional Value at Risk) / Expected Shortfall
 *
 * 公式：CVaR_α = E[Loss | Loss > VaR_α]
 *   即：在损失超过 VaR 的尾部条件下的期望损失
 *
 * 巴塞尔 III FRTB 主推指标，比 VaR 更能刻画尾部风险
 *
 * @param {number[]} returns - 收益率序列
 * @param {number} [confidence=0.95] - 置信度
 * @returns {object} { cvarReturn, varReturn, tailSize, tailMean, tailMax }
 */
export function computeCVaR(returns, confidence = 0.95) {
  logger.session('[Risk:CVaR] ▶ 入口', {
    原始输入_returns长度: Array.isArray(returns) ? returns.length : 0,
    置信度: confidence,
  });

  const rets = safeArr(returns, []).filter((r) => typeof r === 'number' && !isNaN(r));
  if (rets.length < 10) {
    logger.session('[Risk:CVaR] ⚠ 样本不足', { 样本量: rets.length, 返回: null });
    return null;
  }

  const conf = clamp(confidence, 0.5, 0.999);
  const sorted = [...rets].sort((a, b) => a - b);
  const p = 1 - conf;

  // VaR
  const varReturn = -percentile(sorted, p);

  // 尾部损失（超过 VaR 的部分）
  const tailLosses = sorted.filter((r) => r <= -varReturn).map((r) => -r);
  const tailMean = tailLosses.length > 0 ? tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length : varReturn;
  const tailMax = tailLosses.length > 0 ? Math.max(...tailLosses) : varReturn;

  // CVaR = 尾部损失均值
  const cvarReturn = tailMean;

  logger.session('[Risk:CVaR] ✓ 完成', {
    置信度: `${(conf * 100).toFixed(1)}%`,
    VaR: +varReturn.toFixed(6),
    CVaR: +cvarReturn.toFixed(6),
    CVaR_百分比: `${(cvarReturn * 100).toFixed(3)}%`,
    尾部样本数: tailLosses.length,
    尾部均值: +tailMean.toFixed(6),
    尾部最大损失: +tailMax.toFixed(6),
    CVaR_VaR比值: +(cvarReturn / varReturn).toFixed(4),
    含义: `当损失超过VaR(${(varReturn * 100).toFixed(2)}%)时，平均损失为 ${(cvarReturn * 100).toFixed(2)}%`,
    解读: cvarReturn / varReturn > 1.3 ? '尾部肥厚，VaR低估风险' : '尾部接近正态，VaR充分',
  });

  auditLogStore.append('risk', 'cvar', { confidence: conf, varReturn, cvarReturn });

  return {
    cvarReturn,
    varReturn,
    tailSize: tailLosses.length,
    tailMean,
    tailMax,
    method: '条件风险价值 (ES)',
  };
}

// ============================================================
// 四、情景分析
// ============================================================

/**
 * 情景分析 - 三档监管情景
 *
 * 巴塞尔 III 要求：基准 / 不利 / 严重 三档情景
 *
 * @param {object} params
 * @param {object} params.baseCase - 基准情景 { return, volatility, portfolioValue }
 * @param {object} params.adverse - 不利情景 { return, volatility, portfolioValue }
 * @param {object} params.severe - 严重情景 { return, volatility, portfolioValue }
 * @param {number} [params.confidence=0.95] - 置信度
 * @returns {object} 三档情景的估值与损失对比
 */
export function scenarioAnalysis(params = {}) {
  logger.session('[Risk:Scenario] ▶ 入口', { 原始输入: params });

  const base = safeObj(params.baseCase, {});
  const adverse = safeObj(params.adverseCase || params.adverse, {});
  const severe = safeObj(params.severeCase || params.severe, {});
  const conf = clamp(safeNum(params.confidence, 0.95), 0.5, 0.999);

  const z = zScore(conf);

  function calcScenario(scenario, name) {
    const mu = safeNum(scenario.return, 0);
    const sigma = clamp(safeNum(scenario.volatility, 0.2), 0.01, 5);
    const pv = safeNum(scenario.portfolioValue, 10000);
    const expectedReturn = mu * pv;
    const varAmount = (z * sigma - mu) * pv;
    const expectedLoss = -expectedReturn;
    return {
      情景: name,
      假设收益_μ: `${(mu * 100).toFixed(2)}%`,
      假设波动_σ: `${(sigma * 100).toFixed(2)}%`,
      组合价值: +pv.toFixed(2),
      期望收益_金额: +expectedReturn.toFixed(2),
      期望损失_金额: +expectedLoss.toFixed(2),
      VaR_金额: +varAmount.toFixed(2),
      VaR_收益率: `${((z * sigma - mu) * 100).toFixed(3)}%`,
    };
  }

  const baseResult = calcScenario(base, '基准');
  const adverseResult = calcScenario(adverse, '不利');
  const severeResult = calcScenario(severe, '严重');

  // 情景间损失增量
  const adverseIncrement = adverseResult.期望损失_金额 - baseResult.期望损失_金额;
  const severeIncrement = severeResult.期望损失_金额 - baseResult.期望损失_金额;

  const result = {
    scenarios: [baseResult, adverseResult, severeResult],
    adverseIncrement,
    severeIncrement,
    confidence: conf,
    zScore: z,
  };

  logger.session('[Risk:Scenario] ✓ 完成', {
    三档情景: result.scenarios,
    不利情景损失增量: +adverseIncrement.toFixed(2),
    严重情景损失增量: +severeIncrement.toFixed(2),
    解读: severeResult.VaR_金额 > baseResult.VaR_金额 * 2
      ? '严重情景VaR显著放大，需补充资本'
      : '情景间VaR差异可控',
  });

  auditLogStore.append('risk', 'scenario_analysis', { confidence: conf, scenarios: result.scenarios });

  return result;
}

// ============================================================
// 五、敏感性分析
// ============================================================

/**
 * 敏感性分析 - 单因子扰动
 *
 * 测量组合价值对各风险因子的敏感度
 *
 * @param {object} params
 * @param {number} params.baseValue - 基准组合价值
 * @param {object[]} params.factors - 风险因子 [{ name, shock, impact }] 或 [{ name, shock, sensitivity }]
 * @returns {object} { results, maxImpact, maxFactor, duration, dv01 }
 */
export function sensitivityAnalysis(params = {}) {
  logger.session('[Risk:Sensitivity] ▶ 入口', { 原始输入: params });

  const baseValue = safeNum(params.baseValue, 10000);
  const factors = safeArr(params.factors, []);

  if (factors.length === 0) {
    logger.session('[Risk:Sensitivity] ⚠ 无风险因子', { 返回: null });
    return null;
  }

  const results = factors.map((f) => {
    const shock = safeNum(f.shock, 0); // 扰动量（如 +1% 利率）
    const sensitivity = safeNum(f.sensitivity, 0); // 敏感度系数
    const directImpact = safeNum(f.impact, 0); // 直接影响金额（优先）
    const impact = directImpact !== 0 ? directImpact : sensitivity * shock * baseValue;
    const impactPct = baseValue > 0 ? impact / baseValue : 0;
    return {
      因子: f.name || '未命名',
      扰动量: shock,
      扰动量_显示: `${(shock * 100).toFixed(2)}%`,
      影响金额: +impact.toFixed(2),
      影响比例: `${(impactPct * 100).toFixed(3)}%`,
      敏感度: +sensitivity.toFixed(6),
      新组合价值: +(baseValue + impact).toFixed(2),
    };
  });

  // 找出影响最大的因子
  const maxImpactItem = results.reduce((max, r) => (Math.abs(r.影响金额) > Math.abs(max.影响金额) ? r : max), results[0]);

  const result = {
    baseValue,
    results,
    maxImpact: maxImpactItem.影响金额,
    maxFactor: maxImpactItem.因子,
  };

  logger.session('[Risk:Sensitivity] ✓ 完成', {
    基准价值: +baseValue.toFixed(2),
    因子数: results.length,
    各因子影响: results,
    最大影响因子: maxImpactItem.因子,
    最大影响金额: +maxImpactItem.影响金额.toFixed(2),
  });

  auditLogStore.append('risk', 'sensitivity_analysis', { baseValue, factorCount: results.length });

  return result;
}

// ============================================================
// 六、反向压力测试
// ============================================================

/**
 * 反向压力测试 - 从损失反推触发情景
 *
 * 巴塞尔 III 要求：识别哪些情景会导致组合遭受预定损失
 *
 * 方法：给定目标损失，反推各风险因子需要变动的幅度
 *
 * @param {object} params
 * @param {number} params.targetLoss - 目标损失金额
 * @param {number} params.portfolioValue - 组合价值
 * @param {object[]} params.factors - 风险因子 [{ name, sensitivity, maxShock }]
 * @returns {object} { triggers, survivalLoss, verdict }
 */
export function reverseStressTest(params = {}) {
  logger.session('[Risk:ReverseStress] ▶ 入口', { 原始输入: params });

  const targetLoss = safeNum(params.targetLoss, 0);
  const pv = safeNum(params.portfolioValue, 10000);
  const factors = safeArr(params.factors, []);

  if (factors.length === 0 || targetLoss <= 0) {
    logger.session('[Risk:ReverseStress] ⚠ 参数不足', { 目标损失: targetLoss, 因子数: factors.length, 返回: null });
    return null;
  }

  // 对每个因子，计算单独触发目标损失需要的变动幅度
  const triggers = factors.map((f) => {
    const sensitivity = safeNum(f.sensitivity, 0);
    const maxShock = safeNum(f.maxShock, 1);
    const requiredShock = sensitivity !== 0 ? targetLoss / (sensitivity * pv) : Infinity;
    const feasible = Math.abs(requiredShock) <= Math.abs(maxShock);
    const contribution = feasible ? targetLoss : sensitivity * maxShock * pv;
    return {
      因子: f.name || '未命名',
      敏感度: +sensitivity.toFixed(6),
      所需扰动: +requiredShock.toFixed(6),
      所需扰动_显示: `${(requiredShock * 100).toFixed(2)}%`,
      最大可承受扰动: +maxShock.toFixed(4),
      最大可承受扰动_显示: `${(maxShock * 100).toFixed(2)}%`,
      是否可行: feasible ? '✓ 可触发' : '✗ 单因子不足以触发',
      单独最大损失: +contribution.toFixed(2),
    };
  });

  // 多因子联合场景：假设各因子同向最大冲击
  const survivalLoss = factors.reduce((sum, f) => {
    const s = safeNum(f.sensitivity, 0);
    const m = safeNum(f.maxShock, 0);
    return sum + s * m * pv;
  }, 0);

  const verdict = survivalLoss >= targetLoss
    ? `✓ 多因子联合冲击可触发目标损失 ${targetLoss.toFixed(0)}（联合最大损失 ${survivalLoss.toFixed(0)}）`
    : `✗ 即使所有因子最大冲击，也无法达到目标损失 ${targetLoss.toFixed(0)}（联合最大损失仅 ${survivalLoss.toFixed(0)}）`;

  const result = {
    targetLoss,
    portfolioValue: pv,
    triggers,
    survivalLoss,
    verdict,
  };

  logger.session('[Risk:ReverseStress] ✓ 完成', {
    目标损失: +targetLoss.toFixed(2),
    各因子触发条件: triggers,
    多因子联合最大损失: +survivalLoss.toFixed(2),
    判定: verdict,
  });

  auditLogStore.append('risk', 'reverse_stress_test', { targetLoss, survivalLoss });

  return result;
}

// ============================================================
// 七、信用风险
// ============================================================

/**
 * 信用风险 - 期望损失与监管资本
 *
 * 公式：
 *   EL = PD × LGD × EAD  （期望损失）
 *   UL = EAD × √(PD×σLGD² + LGD²×σPD²)  （非预期损失）
 *   σPD = √(PD×(1-PD))
 *
 * 巴塞尔 III IRB 法：
 *   资本要求 K = LGD × [N((1-R)^-0.5 × G(PD) + (R/(1-R))^0.5 × G(0.999)) - PD]
 *   其中 R = 0.12×(1-e^-50PD)/(1-e^-50) + 0.24×[1-(1-e^-50PD)/(1-e^-50)]
 *
 * @param {object} params
 * @param {number} params.PD - 违约概率 (0-1)
 * @param {number} params.LGD - 违约损失率 (0-1)
 * @param {number} params.EAD - 违约风险暴露
 * @param {number} [params.maturity=1] - 期限（年）
 * @returns {object} { expectedLoss, unexpectedLoss, capitalRequirement, breakdown }
 */
export function creditRisk(params = {}) {
  logger.session('[Risk:Credit] ▶ 入口', { 原始输入: params });

  const PD = clamp(safeNum(params.PD, 0.02), 0.0001, 1);
  const LGD = clamp(safeNum(params.LGD, 0.45), 0, 1);
  const EAD = safeNum(params.EAD, 1000000);
  const M = safeNum(params.maturity, 1);

  // 期望损失
  const EL = PD * LGD * EAD;

  // 非预期损失
  const sigmaPD = Math.sqrt(PD * (1 - PD));
  const sigmaLGD = Math.sqrt(LGD * (1 - LGD)); // 简化假设
  const UL = EAD * Math.sqrt(PD * sigmaLGD * sigmaLGD + LGD * LGD * sigmaPD * sigmaPD);

  // 巴塞尔 III IRB 资产相关性 R
  const R = 0.12 * (1 - Math.exp(-50 * PD)) / (1 - Math.exp(-50))
          + 0.24 * (1 - (1 - Math.exp(-50 * PD)) / (1 - Math.exp(-50)));

  // 期限调整
  const b = (0.11852 - 0.05478 * Math.log(PD)) ** 2;
  const maturityAdjustment = (1 + (M - 2.5) * b) / (1 - 1.5 * b);

  // 监管资本要求（简化版，完整 IRB 需 N() 和 G() 反函数）
  // 这里用近似：K ≈ LGD × (Φ(z) - PD)，z = (G(PD) + √R × G(0.999)) / √(1-R)
  // 简化为 UL × 监管因子
  const regulatoryFactor = 2.5 * maturityAdjustment; // 简化
  const capitalRequirement = UL * regulatoryFactor;

  const breakdown = {
    PD违约概率: `${(PD * 100).toFixed(2)}%`,
    LGD违约损失率: `${(LGD * 100).toFixed(1)}%`,
    EAD风险暴露: +EAD.toFixed(2),
    期限_M: `${M}年`,
    EL期望损失: +EL.toFixed(2),
    UL非预期损失: +UL.toFixed(2),
    σPD: +sigmaPD.toFixed(6),
    资产相关性_R: +R.toFixed(4),
    期限调整_b: +b.toFixed(4),
    期限调整因子: +maturityAdjustment.toFixed(4),
    监管资本要求: +capitalRequirement.toFixed(2),
    资本充足率: EAD > 0 ? `${(capitalRequirement / EAD * 100).toFixed(2)}%` : '-',
  };

  logger.session('[Risk:Credit] ✓ 完成', {
    ...breakdown,
    EL_UL比值: +(EL / UL).toFixed(4),
    解读: capitalRequirement / EAD > 0.08
      ? '资本要求 > 8%，需补充资本'
      : '资本要求达标',
  });

  auditLogStore.append('risk', 'credit_risk', { PD, LGD, EAD, EL, UL, capitalRequirement });

  return {
    expectedLoss: EL,
    unexpectedLoss: UL,
    capitalRequirement,
    assetCorrelation: R,
    breakdown,
  };
}

// ============================================================
// 八、流动性风险
// ============================================================

/**
 * 流动性风险 - LCR / NSFR
 *
 * 巴塞尔 III 流动性监管标准：
 *   LCR (流动性覆盖率) = 优质流动性资产 / 净现金流出 ≥ 100%
 *   NSFR (净稳定资金比率) = 可用稳定资金 / 所需稳定资金 ≥ 100%
 *
 * @param {object} params
 * @param {number} params.hqla - 优质流动性资产 (HQLA)
 * @param {number} params.netCashOutflow - 30日净现金流出
 * @param {number} params.availableStableFunding - 可用稳定资金 (ASF)
 * @param {number} params.requiredStableFunding - 所需稳定资金 (RSF)
 * @returns {object} { LCR, NSFR, lcrStatus, nsfrStatus, breakdown }
 */
export function liquidityRisk(params = {}) {
  logger.session('[Risk:Liquidity] ▶ 入口', { 原始输入: params });

  const hqla = safeNum(params.hqla, 0);
  const netOutflow = safeNum(params.netCashOutflow, 1); // 避免除零
  const asf = safeNum(params.availableStableFunding, 0);
  const rsf = safeNum(params.requiredStableFunding, 1);

  const LCR = hqla / netOutflow;
  const NSFR = asf / rsf;

  const lcrStatus = LCR >= 1.0 ? '✓ 达标' : LCR >= 0.9 ? '⚠ 临界' : '✗ 不达标';
  const nsfrStatus = NSFR >= 1.0 ? '✓ 达标' : NSFR >= 0.9 ? '⚠ 临界' : '✗ 不达标';

  const breakdown = {
    HQLA优质流动性资产: +hqla.toFixed(2),
    净现金流出_30日: +netOutflow.toFixed(2),
    LCR流动性覆盖率: `${(LCR * 100).toFixed(2)}%`,
    LCR状态: lcrStatus,
    ASF可用稳定资金: +asf.toFixed(2),
    RSF所需稳定资金: +rsf.toFixed(2),
    NSFR净稳定资金比率: `${(NSFR * 100).toFixed(2)}%`,
    NSFR状态: nsfrStatus,
  };

  logger.session('[Risk:Liquidity] ✓ 完成', {
    ...breakdown,
    LCR缺口: LCR < 1 ? +((1 - LCR) * netOutflow).toFixed(2) : 0,
    NSFR缺口: NSFR < 1 ? +((1 - NSFR) * rsf).toFixed(2) : 0,
    监管要求: 'LCR ≥ 100% 且 NSFR ≥ 100%（巴塞尔III）',
  });

  auditLogStore.append('risk', 'liquidity_risk', { LCR, NSFR, hqla, netOutflow, asf, rsf });

  return {
    LCR,
    NSFR,
    lcrStatus,
    nsfrStatus,
    breakdown,
  };
}

// ============================================================
// 模块导出
// ============================================================
export default {
  computeHistoricalVaR,
  computeMonteCarloVaR,
  computeCVaR,
  scenarioAnalysis,
  sensitivityAnalysis,
  reverseStressTest,
  creditRisk,
  liquidityRisk,
};
