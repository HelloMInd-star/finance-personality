/**
 * Y.Mine 11 维向量统一引擎 v1.0.0
 *
 * 设计目标：
 *  - 将分散在各模块的行为/人格/金融维度统一为单一向量空间
 *  - 提供余弦相似度、欧氏距离、PCA 降维等通用算法
 *  - 支持 用户↔资产 / 用户↔大师 / 资产↔资产 匹配
 *
 * 11 维向量 = 通用向量(6) + 金融专用向量(5)
 *
 *  通用向量 (行为/人格, 0-1):
 *   0. riskTolerance      风险偏好     (基因组 Chr-1 / 扑克激进度)
 *   1. decisionSpeed      决策速度     (台球瞄准时长 / 培养方案)
 *   2. emotionalStability 情绪稳定     (培养方案 / 稳态回归度)
 *   3. discipline         纪律性       (健身完成率 / 培养方案)
 *   4. creativity         创造力       (调酒分子式 / 培养方案)
 *   5. socialTendency     社交倾向     (人格镜子 / 博弈台)
 *
 *  金融专用向量 (0-1):
 *   6. valuation          估值能力     (DCF 内在价/现价 比率归一)
 *   7. riskControl        风控能力     (Z-Score + MDD 归一)
 *   8. positionSizing     仓位管理     (Kelly 分数归一)
 *   9. marketTiming       择时能力     (ConeC + 周期 regime)
 *  10. alphaGeneration    超额收益     (绩效归因 alpha)
 */
import { logger } from './logger';
import { storage } from './storage';
import { auditLogStore } from './storageBus';

// ============================================================
// 维度定义
// ============================================================
export const VECTOR_DIMENSIONS = Object.freeze([
  { index: 0, key: 'riskTolerance', label: '风险偏好', group: 'general', color: '#ef4444', desc: '面对不确定性的主动程度' },
  { index: 1, key: 'decisionSpeed', label: '决策速度', group: 'general', color: '#fbbf24', desc: '从观察到行动的反应时长' },
  { index: 2, key: 'emotionalStability', label: '情绪稳定', group: 'general', color: '#34d399', desc: '稳态回归 0.5 的收敛能力' },
  { index: 3, key: 'discipline', label: '纪律性', group: 'general', color: '#60a5fa', desc: '计划完成率与执行坚持度' },
  { index: 4, key: 'creativity', label: '创造力', group: 'general', color: '#a855f7', desc: '分子式组合与跨域连接能力' },
  { index: 5, key: 'socialTendency', label: '社交倾向', group: 'general', color: '#f472b6', desc: '主动结盟 vs 独处倾向' },
  { index: 6, key: 'valuation', label: '估值能力', group: 'finance', color: '#22d3ee', desc: 'DCF 内在价值捕获能力' },
  { index: 7, key: 'riskControl', label: '风控能力', group: 'finance', color: '#f97316', desc: 'Z-Score / MDD 综合健康度' },
  { index: 8, key: 'positionSizing', label: '仓位管理', group: 'finance', color: '#84cc16', desc: '凯利分数审慎度' },
  { index: 9, key: 'marketTiming', label: '择时能力', group: 'finance', color: '#fb7185', desc: 'ConeC + 周期匹配度' },
  { index: 10, key: 'alphaGeneration', label: '超额收益', group: 'finance', color: '#e879f9', desc: '相对基准的超额 alpha' },
]);

export const DIM_COUNT = VECTOR_DIMENSIONS.length; // 11
export const GENERAL_DIMS = VECTOR_DIMENSIONS.filter(d => d.group === 'general');
export const FINANCE_DIMS = VECTOR_DIMENSIONS.filter(d => d.group === 'finance');

// ============================================================
// 工具函数
// ============================================================
const safeNum = (v, def = 0) => (typeof v === 'number' && !isNaN(v) ? v : def);
const clamp01 = (v) => Math.max(0, Math.min(1, safeNum(v, 0)));

/**
 * 线性映射：把 [lo, hi] 区间归一化到 [0, 1]
 */
const normalize = (v, lo, hi) => {
  const x = safeNum(v, (lo + hi) / 2);
  if (hi <= lo) return 0.5;
  return clamp01((x - lo) / (hi - lo));
};

// ============================================================
// 用户向量构建（从 Y.Mine 行为数据）
// ============================================================

/**
 * 从 localStorage 行为数据构建 11 维用户向量
 * @param {Object} [yMineData] - 可选注入数据，默认从 storage 读取
 * @returns {Object} { vector, raw, sources, generatedAt }
 */
export function buildUserVector(yMineData) {
  logger.session('[Vector:User] ▶ 入口');
  const all = yMineData || storage.getAll() || {};
  const userState = all.userState || {};
  const pokerGames = safeArr(all.pokerGames, []);
  const billiardsGames = safeArr(all.billiardsGames, []);
  const billiardsSessions = safeArr(all.billiardsSessions, []);
  const fitnessSessions = safeArr(all.fitnessSessions, []);
  const bartenderSessions = all.bartenderSessions || [];
  const gameTableHistory = readLS('gametable_history', []);
  const entertainmentHistory = readLS('entertainment_history', []);

  // ====== 反馈回路统一入口：读取持久化的 baseVector ======
  // 调酒流程派生的"人格基线"，与行为数据融合
  const baseVector = Array.isArray(all.baseVector) ? all.baseVector : null;
  const hasBehaviorData =
    pokerGames.length > 0 ||
    billiardsGames.length > 0 ||
    fitnessSessions.length > 0 ||
    bartenderSessions.length > 0 ||
    gameTableHistory.length > 0 ||
    entertainmentHistory.length > 0;

  // ---- 通用向量 ----
  // 0. riskTolerance：扑克激进度 (raiseCount / totalActions)，无数据用 userState.emotion
  let pokerAggression = 0.5;
  if (pokerGames.length > 0) {
    const recent = pokerGames.slice(-10);
    const raises = recent.reduce((s, g) => s + safeNum(g.raiseCount, 0), 0);
    const total = recent.reduce((s, g) => s + Math.max(1, safeNum(g.totalActions, 1)), 0);
    pokerAggression = raises / total;
  }
  const riskTolerance = clamp01(
    0.5 * safeNum(pokerAggression, 0.5) +
    0.3 * normalize(safeNum(userState.emotion, 50), 0, 100) +
    0.2 * (userState.riskPreference === 'aggressive' ? 0.8 : userState.riskPreference === 'conservative' ? 0.2 : 0.5)
  );

  // 1. decisionSpeed：台球瞄准时长 (越短越快)，>5s→0.2, <2s→0.9
  let avgAimTime = 3;
  if (billiardsGames.length > 0) {
    const recent = billiardsGames.slice(-5);
    avgAimTime = recent.reduce((s, g) => s + safeNum(g.avgAimTime, 3), 0) / recent.length;
  }
  const decisionSpeed = clamp01(1 - normalize(avgAimTime, 1, 6));

  // 2. emotionalStability：稳态回归度（用 fitness 完成率 + 扑克 fold 率代理）
  let fitnessRate = 0.6;
  if (fitnessSessions.length > 0) {
    const recent = fitnessSessions.slice(-10);
    fitnessRate = recent.filter(s => s.completed).length / Math.max(1, recent.length);
  }
  let pokerFoldRate = 0.4;
  if (pokerGames.length > 0) {
    const recent = pokerGames.slice(-10);
    const folds = recent.reduce((s, g) => s + safeNum(g.foldCount, 0), 0);
    const total = recent.reduce((s, g) => s + Math.max(1, safeNum(g.totalActions, 1)), 0);
    pokerFoldRate = folds / total;
  }
  const emotionalStability = clamp01(0.5 * fitnessRate + 0.3 * pokerFoldRate + 0.2 * 0.5);

  // 3. discipline：健身完成率 + 台球坚持度
  let billiardsPersistence = 0.5;
  if (billiardsSessions.length > 0) {
    const recent = billiardsSessions.slice(-5);
    const quitEarly = recent.filter(r => r.quitEarly).length;
    billiardsPersistence = 1 - quitEarly / Math.max(1, recent.length);
  }
  const discipline = clamp01(0.6 * fitnessRate + 0.4 * billiardsPersistence);

  // 4. creativity：调酒分子式多样性 + 娱乐方式切换
  let bartenderVariety = 0.5;
  if (bartenderSessions.length > 0) {
    const recent = bartenderSessions.slice(-5);
    const uniqueDrinks = new Set(recent.map(s => s.drinkName).filter(Boolean)).size;
    bartenderVariety = normalize(uniqueDrinks, 1, 6);
  }
  let entSwitchRate = 0.5;
  if (entertainmentHistory.length > 0) {
    const recent = entertainmentHistory.slice(-10);
    const modes = new Set(recent.map(r => r.mode).filter(Boolean));
    entSwitchRate = normalize(modes.size, 1, 6);
  }
  const creativity = clamp01(0.6 * bartenderVariety + 0.4 * entSwitchRate);

  // 5. socialTendency：博弈台主动结盟 vs 独处娱乐占比
  let soloRatio = 0.5;
  if (entertainmentHistory.length > 0) {
    const recent = entertainmentHistory.slice(-10);
    const solo = recent.filter(r => ['music', 'story', 'doodle', 'starmap', 'writing', 'silence'].includes(r.mode)).length;
    soloRatio = solo / Math.max(1, recent.length);
  }
  let gameTableAggression = 0.5;
  if (gameTableHistory.length > 0) {
    const recent = gameTableHistory.slice(-5);
    const switches = recent.reduce((s, g) => s + safeNum(g.strategySwitches, 0), 0) / recent.length;
    gameTableAggression = normalize(switches, 0, 3);
  }
  const socialTendency = clamp01(0.5 * (1 - soloRatio) + 0.5 * gameTableAggression);

  // ---- 金融专用向量 ----
  // 默认从 userState 读取最近一次量化引擎结果，若无则用中性 0.5
  const quantSnapshot = userState.lastQuantResult || {};
  const summary = quantSnapshot.summary || {};
  const pipeline = quantSnapshot.pipeline || {};
  const risk = pipeline.riskVector || {};
  const attribution = pipeline.attribution || {};

  // 6. valuation：upside 落在 [-50%, +80%] → 归一到 [0,1]
  const valuation = clamp01(normalize(safeNum(summary.upside, 0), -0.5, 0.8));

  // 7. riskControl：Z-Score (1.8~3 → 0~1) + MDD (0~30% → 1~0)
  const zScore = safeNum(risk.zScore, 2.5);
  const mdd = safeNum(risk.maxDrawdown, 0.15);
  const zNorm = clamp01(normalize(zScore, 1.8, 3.0));
  const mddNorm = 1 - clamp01(normalize(mdd, 0, 0.3));
  const riskControl = clamp01(0.6 * zNorm + 0.4 * mddNorm);

  // 8. positionSizing：Kelly 分数 (0~0.5 → 0~1，超过 0.5 视为激进)
  const kelly = safeNum(risk.kellyFraction, 0.2);
  const positionSizing = clamp01(normalize(kelly, 0, 0.5));

  // 9. marketTiming：ConeC (0.2~0.9 → 0~1)
  const coneC = safeNum(risk.coneC, 0.5);
  const marketTiming = clamp01(normalize(coneC, 0.2, 0.9));

  // 10. alphaGeneration：绩效归因 alpha (-0.2~0.3 → 0~1)
  const alpha = safeNum(attribution.alpha, 0);
  const alphaGeneration = clamp01(normalize(alpha, -0.2, 0.3));

  const vector = [
    riskTolerance, decisionSpeed, emotionalStability, discipline, creativity, socialTendency,
    valuation, riskControl, positionSizing, marketTiming, alphaGeneration,
  ];

  const sources = [];
  if (pokerGames.length) sources.push(`扑克×${pokerGames.length}`);
  if (billiardsGames.length) sources.push(`台球×${billiardsGames.length}`);
  if (fitnessSessions.length) sources.push(`健身×${fitnessSessions.length}`);
  if (bartenderSessions.length) sources.push(`调酒×${bartenderSessions.length}`);
  if (gameTableHistory.length) sources.push(`博弈台×${gameTableHistory.length}`);
  if (entertainmentHistory.length) sources.push(`娱乐×${entertainmentHistory.length}`);
  if (quantSnapshot.summary) sources.push('量化引擎快照');

  // ====== 反馈回路统一入口：baseVector 融合 ======
  // 如果有持久化的 baseVector（调酒派生），与行为数据派生的向量融合
  let finalVector = vector;
  let fusedWithBase = false;

  if (baseVector) {
    if (!hasBehaviorData) {
      // 无行为数据：直接用 baseVector（调酒派生向量优于中性默认值）
      finalVector = baseVector.slice(0, DIM_COUNT);
      sources.length = 0;
      sources.push('调酒派生向量（无行为数据）');
      fusedWithBase = true;
    } else {
      // 有行为数据：行为向量 × 0.7 + baseVector × 0.3（行为数据为主，调酒为辅）
      finalVector = vector.map((v, i) => {
        const bv = baseVector[i] ?? 0.5;
        return clamp01(0.7 * v + 0.3 * bv);
      });
      sources.push('调酒派生向量（融合 0.3 权重）');
      fusedWithBase = true;
    }
  }

  const result = {
    vector: finalVector,
    raw: {
      riskTolerance: finalVector[0],
      decisionSpeed: finalVector[1],
      emotionalStability: finalVector[2],
      discipline: finalVector[3],
      creativity: finalVector[4],
      socialTendency: finalVector[5],
      valuation: finalVector[6],
      riskControl: finalVector[7],
      positionSizing: finalVector[8],
      marketTiming: finalVector[9],
      alphaGeneration: finalVector[10],
    },
    sources: sources.length ? sources : ['无行为数据，使用中性默认值'],
    fusedWithBase,
    generatedAt: Date.now(),
  };

  logger.session('[Vector:User] ✓ 完成', {
    向量: finalVector.map(v => +v.toFixed(3)),
    数据源: result.sources,
    baseVector融合: fusedWithBase,
  });

  auditLogStore.append('vector', 'build_user_vector', { dim: DIM_COUNT, sources: result.sources, fused: fusedWithBase });
  return result;
}

// ============================================================
// 资产向量构建（从资产 + 因子数据）
// ============================================================

/**
 * 从资产对象构建 11 维资产向量
 * @param {Object} asset - { ticker, pe, pb, roe, debtToEquity, revenueGrowthYoY, fcfYield, grade, basePrice, marketCap }
 * @param {Object} [factors] - 可选因子 { coneC, kelly, zScore, mdd, intrinsicPrice, currentPrice, alpha }
 * @param {string} [regime] - 宏观周期
 * @returns {Object} { vector, raw, ticker }
 */
export function buildAssetVector(asset, factors = {}, regime = 'NEUTRAL') {
  logger.session('[Vector:Asset] ▶ 入口', { ticker: asset?.ticker });
  const a = safeObj(asset, {});
  const f = safeObj(factors, {});

  // 通用向量：用资产基本面映射"如果投资者持有该资产，他需要的画像"
  const riskTolerance = clamp01(
    0.4 * normalize(safeNum(a.revenueGrowthYoY, 0.05), -0.1, 0.5) +
    0.3 * normalize(safeNum(a.pe, 25), 5, 70) +
    0.3 * (a.grade === 'S' ? 0.9 : a.grade === 'A' ? 0.7 : a.grade === 'B' ? 0.5 : 0.3)
  );
  const decisionSpeed = clamp01(normalize(safeNum(a.beta, 1), 0.3, 1.8));
  const emotionalStability = clamp01(1 - normalize(safeNum(a.debtToEquity, 0.5), 0, 2));
  const discipline = clamp01(normalize(safeNum(a.roe, 0.2), 0, 0.5));
  const creativity = clamp01(normalize(safeNum(a.fcfYield, 0.03), 0, 0.1));
  const socialTendency = clamp01(normalize(safeNum(a.marketCap, 500), 50, 3000));

  // 金融向量
  const intrinsicPrice = safeNum(f.intrinsicPrice, safeNum(a.basePrice, 100));
  const currentPrice = safeNum(f.currentPrice, safeNum(a.basePrice, 100));
  const valuation = clamp01(currentPrice > 0 ? normalize(intrinsicPrice / currentPrice, 0.5, 1.8) : 0.5);

  const zScore = safeNum(f.zScore, 2.5);
  const mdd = safeNum(f.mdd, 0.15);
  const riskControl = clamp01(0.6 * normalize(zScore, 1.8, 3.0) + 0.4 * (1 - normalize(mdd, 0, 0.3)));

  const kelly = safeNum(f.kelly, 0.2);
  const positionSizing = clamp01(normalize(kelly, 0, 0.5));

  const coneC = safeNum(f.coneC, 0.5);
  const marketTiming = clamp01(normalize(coneC, 0.2, 0.9));

  const alpha = safeNum(f.alpha, 0);
  const alphaGeneration = clamp01(normalize(alpha, -0.2, 0.3));

  const vector = [
    riskTolerance, decisionSpeed, emotionalStability, discipline, creativity, socialTendency,
    valuation, riskControl, positionSizing, marketTiming, alphaGeneration,
  ];

  const result = {
    vector,
    raw: {
      riskTolerance, decisionSpeed, emotionalStability, discipline, creativity, socialTendency,
      valuation, riskControl, positionSizing, marketTiming, alphaGeneration,
    },
    ticker: a.ticker || 'UNKNOWN',
    name: a.name || a.ticker || '未知资产',
  };

  logger.session('[Vector:Asset] ✓ 完成', {
    ticker: result.ticker,
    向量: vector.map(v => +v.toFixed(3)),
  });
  return result;
}

// ============================================================
// 向量运算
// ============================================================

/**
 * 余弦相似度 cos(θ) = A·B / (|A||B|)
 * 值域 [-1, 1]，越接近 1 越相似
 */
export function cosineSimilarity(v1, v2) {
  const a = safeArr(v1, []);
  const b = safeArr(v2, []);
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < n; i++) {
    const x = safeNum(a[i], 0);
    const y = safeNum(b[i], 0);
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }
  if (magA === 0 || magB === 0) return 0;
  const sim = dot / (Math.sqrt(magA) * Math.sqrt(magB));
  logger.session('[Vector:Cosine]', { 维度: n, 相似度: +sim.toFixed(6) });
  return sim;
}

/**
 * 欧氏距离 d = sqrt(Σ(ai - bi)²)
 */
export function euclideanDistance(v1, v2) {
  const a = safeArr(v1, []);
  const b = safeArr(v2, []);
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = safeNum(a[i], 0) - safeNum(b[i], 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * 归一化欧氏距离到 [0, 1] 相似度（11 维每维 [0,1]，最大距离 = √11）
 */
export function normalizedDistance(v1, v2) {
  const d = euclideanDistance(v1, v2);
  const maxD = Math.sqrt(DIM_COUNT);
  return clamp01(1 - d / maxD);
}

/**
 * 加权相似度（通用维度权重 vs 金融维度权重）
 */
export function weightedSimilarity(v1, v2, generalWeight = 0.5, financeWeight = 0.5) {
  const g1 = safeArr(v1, []).slice(0, 6);
  const g2 = safeArr(v2, []).slice(0, 6);
  const f1 = safeArr(v1, []).slice(6, 11);
  const f2 = safeArr(v2, []).slice(6, 11);
  const gSim = cosineSimilarity(g1, g2);
  const fSim = cosineSimilarity(f1, f2);
  const w = clamp01(generalWeight) + clamp01(financeWeight);
  if (w === 0) return 0;
  return (gSim * generalWeight + fSim * financeWeight) / w;
}

// ============================================================
// PCA 降维（协方差特征分解，适合小维度）
// ============================================================

/**
 * 对一组向量做 PCA 降维到 k 维
 * 算法：均值中心化 → 协方差矩阵 → Jacobi 特征值分解 → 取前 k 大特征向量
 *
 * @param {number[][]} vectors - 样本向量数组
 * @param {number} k - 目标维度（默认 2）
 * @returns {Object} { projected: number[][], eigenvalues: number[], eigenvectors: number[][], mean: number[], explainedRatio: number[] }
 */
export function pcaReduce(vectors, k = 2) {
  const X = safeArr(vectors, []).filter(v => Array.isArray(v) && v.length === DIM_COUNT);
  const n = X.length;
  logger.session('[Vector:PCA] ▶ 入口', { 样本数: n, 目标维度: k });

  if (n < 2) {
    logger.session('[Vector:PCA] ⚠ 样本不足', { 样本数: n, 最低要求: 2 });
    return { projected: [], eigenvalues: [], eigenvectors: [], mean: [], explainedRatio: [] };
  }

  // 1. 均值中心化
  const mean = new Array(DIM_COUNT).fill(0);
  for (const v of X) for (let i = 0; i < DIM_COUNT; i++) mean[i] += v[i];
  for (let i = 0; i < DIM_COUNT; i++) mean[i] /= n;
  const centered = X.map(v => v.map((x, i) => x - mean[i]));

  // 2. 协方差矩阵 (DIM × DIM)
  const cov = Array.from({ length: DIM_COUNT }, () => new Array(DIM_COUNT).fill(0));
  for (const v of centered) {
    for (let i = 0; i < DIM_COUNT; i++) {
      for (let j = 0; j < DIM_COUNT; j++) {
        cov[i][j] += v[i] * v[j];
      }
    }
  }
  for (let i = 0; i < DIM_COUNT; i++) {
    for (let j = 0; j < DIM_COUNT; j++) {
      cov[i][j] /= (n - 1);
    }
  }

  // 3. Jacobi 特征值分解
  const { eigenvalues, eigenvectors } = jacobiEigen(cov);

  // 4. 按特征值降序排列
  const order = eigenvalues.map((val, idx) => ({ val, idx }))
    .sort((a, b) => b.val - a.val);
  const sortedEigenvalues = order.map(o => o.val);
  const sortedEigenvectors = order.map(o => eigenvectors[o.idx]);

  // 5. 取前 k 维投影
  const kk = Math.min(k, DIM_COUNT);
  const topVectors = sortedEigenvectors.slice(0, kk);
  const projected = centered.map(v => topVectors.map(ev => {
    let s = 0;
    for (let i = 0; i < DIM_COUNT; i++) s += ev[i] * v[i];
    return s;
  }));

  // 解释方差比
  const totalVar = sortedEigenvalues.reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const explainedRatio = sortedEigenvalues.map(v => Math.max(0, v) / totalVar);

  logger.session('[Vector:PCA] ✓ 完成', {
    特征值: sortedEigenvalues.slice(0, kk).map(v => +v.toFixed(6)),
    解释方差比: explainedRatio.slice(0, kk).map(v => `${(v * 100).toFixed(1)}%`),
    累计解释: `${(explainedRatio.slice(0, kk).reduce((s, v) => s + v, 0) * 100).toFixed(1)}%`,
    投影样本数: projected.length,
  });

  return {
    projected,
    eigenvalues: sortedEigenvalues,
    eigenvectors: sortedEigenvectors,
    mean,
    explainedRatio,
  };
}

/**
 * Jacobi 法求对称矩阵特征值/特征向量
 * 适用于小矩阵（DIM ≤ 20）
 */
function jacobiEigen(A, maxIter = 100, tol = 1e-10) {
  const n = A.length;
  const M = A.map(row => row.slice());
  const V = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  for (let iter = 0; iter < maxIter; iter++) {
    // 找最大非对角元素
    let p = 0, q = 1, maxOff = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(M[i][j]) > maxOff) {
          maxOff = Math.abs(M[i][j]);
          p = i; q = j;
        }
      }
    }
    if (maxOff < tol) break;

    const app = M[p][p], aqq = M[q][q], apq = M[p][q];
    const theta = (aqq - app) === 0 ? Math.PI / 4 : 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(theta), s = Math.sin(theta);

    // 旋转
    for (let i = 0; i < n; i++) {
      const mip = M[i][p], miq = M[i][q];
      M[i][p] = c * mip + s * miq;
      M[i][q] = -s * mip + c * miq;
    }
    for (let j = 0; j < n; j++) {
      const mpj = M[p][j], mqj = M[q][j];
      M[p][j] = c * mpj + s * mqj;
      M[q][j] = -s * mpj + c * mqj;
    }
    for (let i = 0; i < n; i++) {
      const vip = V[i][p], viq = V[i][q];
      V[i][p] = c * vip + s * viq;
      V[i][q] = -s * vip + c * viq;
    }
  }

  const eigenvalues = M.map((row, i) => row[i]);
  // eigenvectors[j] 是第 j 个特征向量（列）
  const eigenvectors = Array.from({ length: n }, (_, j) =>
    Array.from({ length: n }, (_, i) => V[i][j])
  );

  return { eigenvalues, eigenvectors };
}

// ============================================================
// 向量档案 & 标签生成
// ============================================================

/**
 * 向量转可读标签（找最强/最弱维度）
 */
export function vectorToLabel(vector) {
  const v = safeArr(vector, []);
  if (v.length !== DIM_COUNT) return { top: '未知', weak: '未知', archetype: '中性' };

  let topIdx = 0, weakIdx = 0;
  for (let i = 1; i < DIM_COUNT; i++) {
    if (v[i] > v[topIdx]) topIdx = i;
    if (v[i] < v[weakIdx]) weakIdx = i;
  }
  const top = VECTOR_DIMENSIONS[topIdx];
  const weak = VECTOR_DIMENSIONS[weakIdx];

  // 原型分类：根据通用向量分布
  const g = v.slice(0, 6);
  const risk = g[0], speed = g[1], stable = g[2], disc = g[3], creat = g[4], social = g[5];
  let archetype = '均衡型';
  if (risk > 0.7 && speed > 0.6) archetype = '激进猎手型';
  else if (risk < 0.3 && stable > 0.6) archetype = '稳健守城型';
  else if (disc > 0.7 && creat > 0.6) archetype = '工匠创造型';
  else if (social > 0.7 && creat > 0.5) archetype = '社交连接型';
  else if (stable > 0.7 && risk < 0.4) archetype = '理性分析型';

  return {
    top: top.label,
    topDesc: top.desc,
    weak: weak.label,
    weakDesc: weak.desc,
    archetype,
  };
}

/**
 * 综合匹配度（用户向量 vs 资产向量）
 * 返回相似度 + 各维度贡献度
 */
export function matchUserAsset(userVector, assetVector) {
  const u = safeArr(userVector, []);
  const a = safeArr(assetVector, []);
  const cosine = cosineSimilarity(u, a);
  const normDist = normalizedDistance(u, a);
  const overall = 0.5 * Math.max(0, cosine) + 0.5 * normDist;

  const contributions = VECTOR_DIMENSIONS.map((dim, i) => ({
    dim: dim.key,
    label: dim.label,
    color: dim.color,
    user: +safeNum(u[i], 0).toFixed(3),
    asset: +safeNum(a[i], 0).toFixed(3),
    diff: +Math.abs(safeNum(u[i], 0) - safeNum(a[i], 0)).toFixed(3),
    contribution: +(1 - Math.abs(safeNum(u[i], 0) - safeNum(a[i], 0))).toFixed(3),
  }));

  return {
    overall: +overall.toFixed(4),
    cosine: +cosine.toFixed(4),
    normalizedDistance: +normDist.toFixed(4),
    contributions,
  };
}

// ============================================================
// 工具：从 localStorage 读取数组
// ============================================================
function readLS(key, def) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : def;
    }
  } catch (e) { /* ignore */ }
  return def;
}

function safeArr(v, def) {
  return Array.isArray(v) ? v : def;
}

function safeObj(v, def) {
  return v && typeof v === 'object' ? v : def;
}

// ============================================================
// 预设资产向量池（基于 PRESET_ASSETS）
// ============================================================
export function buildPresetAssetVectors() {
  // 延迟导入避免循环依赖
  const presets = [
    { ticker: 'AAPL', name: '苹果', pe: 28, pb: 45, roe: 1.5, debtToEquity: 1.8, revenueGrowthYoY: 0.08, fcfYield: 0.035, grade: 'A', basePrice: 185, marketCap: 2800, beta: 1.2 },
    { ticker: 'MSFT', name: '微软', pe: 35, pb: 12, roe: 0.4, debtToEquity: 0.4, revenueGrowthYoY: 0.15, fcfYield: 0.03, grade: 'S', basePrice: 410, marketCap: 3100, beta: 0.9 },
    { ticker: 'NVDA', name: '英伟达', pe: 70, pb: 50, roe: 1.2, debtToEquity: 0.3, revenueGrowthYoY: 2.6, fcfYield: 0.02, grade: 'S', basePrice: 875, marketCap: 2500, beta: 1.8 },
    { ticker: 'GOOGL', name: '谷歌', pe: 25, pb: 6, roe: 0.3, debtToEquity: 0.2, revenueGrowthYoY: 0.13, fcfYield: 0.04, grade: 'A', basePrice: 170, marketCap: 2000, beta: 1.1 },
    { ticker: 'AMZN', name: '亚马逊', pe: 60, pb: 8, roe: 0.2, debtToEquity: 0.5, revenueGrowthYoY: 0.12, fcfYield: 0.02, grade: 'A', basePrice: 185, marketCap: 1900, beta: 1.3 },
    { ticker: 'XOM', name: '埃克森美孚', pe: 10, pb: 2, roe: 0.2, debtToEquity: 0.3, revenueGrowthYoY: -0.05, fcfYield: 0.08, grade: 'B', basePrice: 110, marketCap: 450, beta: 0.9 },
    { ticker: 'JNJ', name: '强生', pe: 15, pb: 5, roe: 0.25, debtToEquity: 0.4, revenueGrowthYoY: 0.06, fcfYield: 0.05, grade: 'B', basePrice: 155, marketCap: 380, beta: 0.6 },
    { ticker: 'JPM', name: '摩根大通', pe: 11, pb: 1.8, roe: 0.15, debtToEquity: 0, revenueGrowthYoY: 0.2, fcfYield: 0, grade: 'B', basePrice: 195, marketCap: 500, beta: 1.1 },
    { ticker: 'TSLA', name: '特斯拉', pe: 50, pb: 12, roe: 0.25, debtToEquity: 0.2, revenueGrowthYoY: 0.1, fcfYield: 0.01, grade: 'A', basePrice: 245, marketCap: 600, beta: 2.0 },
    { ticker: 'BRK.B', name: '伯克希尔', pe: 9, pb: 1.5, roe: 0.15, debtToEquity: 0.3, revenueGrowthYoY: 0.05, fcfYield: 0.04, grade: 'S', basePrice: 410, marketCap: 900, beta: 0.9 },
  ];
  return presets.map(a => buildAssetVector(a));
}

// ============================================================
// 导出
// ============================================================
export default {
  VECTOR_DIMENSIONS,
  DIM_COUNT,
  GENERAL_DIMS,
  FINANCE_DIMS,
  buildUserVector,
  buildAssetVector,
  buildPresetAssetVectors,
  cosineSimilarity,
  euclideanDistance,
  normalizedDistance,
  weightedSimilarity,
  pcaReduce,
  vectorToLabel,
  matchUserAsset,
};
