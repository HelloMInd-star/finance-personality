/**
 * 塔罗人格引擎 · 六维 PersonaVector
 *
 * 六维人格向量 [TOL, SPD, INF, ENT, LEAD, VIS]
 *   TOL 容错（风险偏好）  SPD 速度（决策速度）
 *   INF 信息（信息依赖）  ENT 热情（热情强度）
 *   LEAD 主导（主导倾向）VIS 直觉（直觉权重）
 *
 * 从 Y.Mine 人格调酒系统迁移 · TS → JS（仅塔罗部分）
 * 保留六维不映射到 11 维 · 塔罗与调酒推荐解耦
 */

import { getTarotCardById } from './tarotCards.js';

// ═════════════════════════════════════════════════════════
// 六维定义
// ═════════════════════════════════════════════════════════

export const DIMS = ['TOL', 'SPD', 'INF', 'ENT', 'LEAD', 'VIS'];

export const DIM_LABEL = {
  TOL: '容错',
  SPD: '速度',
  INF: '信息',
  ENT: '热情',
  LEAD: '主导',
  VIS: '直觉',
};

export const DIM_DESC = {
  TOL: '风险偏好 · 容忍不确定性',
  SPD: '决策速度 · 果断或审慎',
  INF: '信息依赖 · 谋定而后动',
  ENT: '热情强度 · 内敛或炽烈',
  LEAD: '主导倾向 · 引领或追随',
  VIS: '直觉权重 · 理性或灵感',
};

// ═════════════════════════════════════════════════════════
// 归一化
// ═════════════════════════════════════════════════════════

/** 空向量 · 融合前的初始态 */
export function zeroVector() {
  return { TOL: 0, SPD: 0, INF: 0, ENT: 0, LEAD: 0, VIS: 0 };
}

/**
 * 按最大绝对值归一化到 [-1, 1]
 * 全零向量原样返回（避免除零）
 */
export function normalizeVector(vec) {
  const maxAbs = Math.max(...DIMS.map((d) => Math.abs(vec[d])));
  if (maxAbs === 0) return { ...vec };
  const out = {};
  for (const d of DIMS) {
    out[d] = Math.round((vec[d] / maxAbs) * 1000) / 1000;
  }
  return out;
}

// ═════════════════════════════════════════════════════════
// 塔罗 → 人格向量
// ═════════════════════════════════════════════════════════

/** 三牌阵位置权重：过去 0.2 / 现在 0.5 / 未来 0.3 */
export const TAROT_POSITION_WEIGHT = {
  past: 0.2,
  present: 0.5,
  future: 0.3,
};

/**
 * 塔罗 → 六维人格向量
 * 三张牌加权：过去 0.2 / 现在 0.5 / 未来 0.3
 * 逆位 → 权重反转
 *
 * @param {{cards: Array<{cardId: number, position: 'past'|'present'|'future', isReversed: boolean}>}} result
 * @returns {{TOL:number,SPD:number,INF:number,ENT:number,LEAD:number,VIS:number}}
 */
export function tarotToVector(result) {
  const vec = zeroVector();
  for (const drawn of result.cards) {
    const card = getTarotCardById(drawn.cardId);
    if (!card) continue;
    let weights = card.personaWeights;
    if (drawn.isReversed) {
      // 逆位 → 权重反转
      weights = Object.fromEntries(
        Object.entries(weights).map(([k, v]) => [k, -v]),
      );
    }
    const pw = TAROT_POSITION_WEIGHT[drawn.position];
    for (const [dim, w] of Object.entries(weights)) {
      vec[dim] += (w ?? 0) * pw;
    }
  }
  return vec;
}

// ═════════════════════════════════════════════════════════
// 标签派生
// ═════════════════════════════════════════════════════════

/**
 * 由向量派生人格标签
 * 取绝对值最大的维度作为主调，正负号作为倾向
 * 全零向量返回中性「均衡者」
 */
export function derivePersonaTag(vec) {
  let maxDim = 'TOL';
  let maxAbs = 0;
  for (const d of DIMS) {
    const a = Math.abs(vec[d]);
    if (a > maxAbs) {
      maxAbs = a;
      maxDim = d;
    }
  }

  if (maxAbs === 0) return '均衡者';

  const LABEL = {
    // [负倾向, 正倾向]
    TOL: ['审慎者', '冒险者'],
    SPD: ['沉思者', '决断者'],
    INF: ['直觉者', '谋略者'],
    ENT: ['沉静者', '炽烈者'],
    LEAD: ['追随者', '引领者'],
    VIS: ['实证者', '灵感者'],
  };

  const [neg, pos] = LABEL[maxDim];
  return vec[maxDim] >= 0 ? pos : neg;
}

// ═════════════════════════════════════════════════════════
// 导出
// ═════════════════════════════════════════════════════════

export default {
  DIMS,
  DIM_LABEL,
  DIM_DESC,
  zeroVector,
  normalizeVector,
  tarotToVector,
  derivePersonaTag,
  TAROT_POSITION_WEIGHT,
};
