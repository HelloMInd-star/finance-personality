/**
 * Y.Mine 反馈回路引擎 v1.0.0
 *
 * 闭环：喝后评分 → 向量校准 → 推荐优化
 *
 * 设计：
 *  - 基于现有 11 维人格向量（vectorMapper.VECTOR_DIMENSIONS）
 *  - 评分 ≥4：向量朝推荐方向微调 +0.02
 *  - 评分 ≤2：向量朝推荐方向反向微调 -0.02
 *  - 评分 ===3：中性，不贡献方向
 *  - 单次 calibrateVector 调用每维度总幅度硬上限 0.05
 *  - 结果 clamp 到 [0,1]
 *  - 纯函数，无副作用
 */

import { DIM_COUNT } from './vectorMapper.js';

// ============================================================
// 常量
// ============================================================

/** 单条反馈对每维度的微调步长 */
export const STEP = 0.02;

/** 单次 calibrateVector 调用，每维度总幅度硬上限 */
export const MAX_DELTA = 0.05;

// ============================================================
// 类型定义（JSDoc）
// ============================================================

/**
 * 反馈信号
 * @typedef {Object} FeedbackSignal
 * @property {string} recipeId - 配方/产物 ID（用于回溯到具体一杯酒）
 * @property {number} rating - 整体评分 1-5（1 最差，5 最佳）
 * @property {{flavor?: number, scent?: number, mood?: number}} [dimensions]
 *   细分维度评分（可选，当前实现保留字段，未参与校准计算）
 * @property {number} ts - 时间戳（ms）
 */

// ============================================================
// 工具
// ============================================================

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampAbs = (v, max) => (v < -max ? -max : v > max ? max : v);
const safeNum = (v, def) => (typeof v === 'number' && !isNaN(v) ? v : def);

/**
 * 评分到方向的映射
 *   非数字 / 缺失 → 0（中性，容错）
 *   rating >= 4 → +1（强化推荐方向）
 *   rating <= 2 → -1（弱化推荐方向）
 *   其他 → 0（中性）
 */
function ratingToDir(rating) {
  if (typeof rating !== 'number' || isNaN(rating)) return 0;
  if (rating >= 4) return 1;
  if (rating <= 2) return -1;
  return 0;
}

// ============================================================
// 核心纯函数
// ============================================================

/**
 * 校准人格向量
 *
 * 每条反馈对全部 11 维贡献同一方向：rating>=4 → +1，rating<=2 → -1，其他 → 0。
 * 每维度累计方向 * STEP 得到原始 delta，再 clamp 到 [-MAX_DELTA, MAX_DELTA]。
 * 最终 result[i] = clamp01(base[i] + delta[i])。
 *
 * @param {number[]} base - 11 维基础向量（值域 [0,1]）
 * @param {FeedbackSignal[]} feedback - 反馈信号数组
 * @returns {number[]} 校准后的 11 维向量（新数组，不修改入参）
 */
export function calibrateVector(base, feedback) {
  const dim = DIM_COUNT;
  const b = Array.isArray(base) ? base.slice(0, dim) : new Array(dim).fill(0.5);
  // 长度不足补齐
  while (b.length < dim) b.push(0.5);
  const fb = Array.isArray(feedback) ? feedback : [];

  // 累计每维度方向
  const dirs = new Array(dim).fill(0);
  for (const f of fb) {
    if (!f || typeof f !== 'object') continue;
    const dir = ratingToDir(f.rating);
    if (dir === 0) continue;
    for (let i = 0; i < dim; i++) dirs[i] += dir;
  }

  // delta = clamp(dirs * STEP, ±MAX_DELTA), result = clamp01(base + delta)
  return b.map((v, i) => {
    const delta = clampAbs(dirs[i] * STEP, MAX_DELTA);
    return clamp01(safeNum(v, 0.5) + delta);
  });
}

// ============================================================
// 导出
// ============================================================

export default {
  STEP,
  MAX_DELTA,
  calibrateVector,
};
