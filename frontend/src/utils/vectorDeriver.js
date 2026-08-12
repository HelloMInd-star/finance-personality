/**
 * Vector Deriver · 从调酒 context 派生 11 维人格向量
 *
 * 设计哲学（Y.Mine）：
 *  - 调酒流程是人格的"快照采集"
 *  - 每个选择都反映当下的人格倾向
 *  - 派生向量作为"基础向量"持久化，供反馈回路校准
 *
 * 维度布局（与 vectorMapper 对齐）：
 *  通用维度 0-5：
 *    0 riskTolerance     风险偏好
 *    1 decisionSpeed     决策速度
 *    2 emotionalStability 情绪稳定性
 *    3 discipline         纪律性
 *    4 creativity         创造力
 *    5 socialTendency     社交倾向
 *  金融维度 6-10（调酒流程不涉及，保持中性 0.5）：
 *    6 valuation / 7 riskControl / 8 positionSizing / 9 marketTiming / 10 alphaGeneration
 */

import { logger } from './logger';

// ============================================================
// 映射表
// ============================================================

/** 情绪 → 6 维偏移 */
const EMOTION_SHIFTS = {
  calm:     { 0: -0.02, 1: -0.05, 2: +0.15, 5: -0.05 },
  passion:  { 0: +0.10, 4: +0.05, 5: +0.15 },
  deep:     { 1: -0.10, 4: +0.15, 5: -0.10 },
  tired:    { 0: -0.05, 2: -0.10, 3: -0.10 },
  excited:  { 0: +0.15, 1: +0.10, 4: +0.05 },
  nostalgic:{ 2: -0.05, 4: +0.10, 5: -0.05 },
};

/** 基酒 → 6 维偏移 */
const SPIRIT_SHIFTS = {
  whisky: { 0: +0.10, 3: +0.10 },
  gin:    { 4: +0.10, 5: +0.05 },
  wine:   { 2: +0.10, 5: +0.10 },
  coffee: { 1: +0.10, 3: +0.15 },
};

/** 关键提问 label → 6 维偏移 */
const QUESTION_SHIFTS = {
  '纯饮不加冰':     { 0: +0.05, 1: +0.05 },
  '加一块冰慢慢化': { 2: +0.05 },
  '调一杯古典':     { 4: +0.05, 5: +0.05 },
  'Dry Martini':    { 3: +0.05 },
  'Negroni':        { 0: +0.05, 4: +0.05 },
  'Gin & Tonic':    { 5: +0.05 },
  '纯饮':           { 0: +0.05, 1: +0.05 },
  '微醒':           { 2: +0.05 },
  '慢品':           { 3: +0.05 },
};

/** 故事种子 → 6 维偏移 */
const STORY_SEED_SHIFTS = {
  night_walk: { 2: +0.05, 5: -0.05 },
  reunion:    { 2: +0.05, 5: +0.15 },
  adventure:  { 0: +0.10, 4: +0.05 },
  silence:    { 2: +0.10, 5: -0.10 },
  first_date: { 2: -0.05, 5: +0.10 },
  move_on:    { 2: +0.05, 3: +0.05 },
};

/** 调酒师 MBTI → 6 维偏移 */
const BARTENDER_SHIFTS = {
  Cole: { 0: +0.05, 1: +0.05 },      // ISTP
  Finn: { 4: +0.10, 5: +0.05 },      // ENFP
  Sol:  { 2: +0.05, 3: +0.05 },      // INTJ
};

// ============================================================
// 工具
// ============================================================

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 根据文本长度给指定维度加成 */
function textLengthShift(len, thresholds) {
  // thresholds: [{ minLen, delta: { dimIdx: delta } }]
  for (const t of thresholds) {
    if (len >= t.minLen) return t.delta;
  }
  return {};
}

// ============================================================
// 核心 API
// ============================================================

/**
 * 从调酒 context 派生 11 维向量
 * @param {Object} context - CocktailBuilder onComplete 传入的上下文
 * @returns {number[]} 11 维向量（值域 [0,1]）
 */
export function deriveVectorFromContext(context) {
  logger.session('[VectorDeriver] ▶ 开始派生');

  // 起始中性向量
  const vec = new Array(11).fill(0.5);

  if (!context || typeof context !== 'object') {
    logger.session('[VectorDeriver] 无 context，返回中性向量');
    return vec;
  }

  const {
    emotion,
    baseSpirit,
    questionAnswer,
    transitionNote = '',
    zodiacCorrect,
    storySeed,
    specialNote = '',
    bartender,
  } = context;

  const shifts = {}; // { dimIdx: delta }

  // 收集所有偏移
  const collect = (map, key) => {
    if (map && map[key]) {
      for (const [dim, delta] of Object.entries(map[key])) {
        shifts[dim] = (shifts[dim] || 0) + delta;
      }
    }
  };

  collect(EMOTION_SHIFTS, emotion);
  collect(SPIRIT_SHIFTS, baseSpirit);
  collect(QUESTION_SHIFTS, questionAnswer);
  collect(STORY_SEED_SHIFTS, storySeed);

  // 调酒师偏移（按 key）
  if (bartender?.key) {
    collect(BARTENDER_SHIFTS, bartender.key);
  }

  // 星座猜中 → 直觉 / 创造力
  if (zodiacCorrect) {
    shifts[4] = (shifts[4] || 0) + 0.10;
  }

  // 过渡手记长度 → 情绪稳定性 + 创造力
  const tLen = transitionNote.length;
  if (tLen >= 150) {
    shifts[2] = (shifts[2] || 0) + 0.15;
    shifts[4] = (shifts[4] || 0) + 0.15;
  } else if (tLen >= 50) {
    shifts[2] = (shifts[2] || 0) + 0.10;
    shifts[4] = (shifts[4] || 0) + 0.10;
  } else if (tLen >= 5) {
    shifts[2] = (shifts[2] || 0) + 0.05;
    shifts[4] = (shifts[4] || 0) + 0.05;
  }

  // 特调笔记长度 → 创造力
  const sLen = specialNote.length;
  if (sLen >= 50) {
    shifts[4] = (shifts[4] || 0) + 0.10;
  } else if (sLen > 0) {
    shifts[4] = (shifts[4] || 0) + 0.05;
  }

  // 应用偏移
  for (const [dim, delta] of Object.entries(shifts)) {
    const i = Number(dim);
    if (i >= 0 && i < 11) {
      vec[i] = clamp01(vec[i] + delta);
    }
  }

  // 金融维度 6-10 保持 0.5（调酒流程不涉及）

  logger.session('[VectorDeriver] ✓ 完成', {
    向量: vec.map((v) => +v.toFixed(3)),
    偏移数: Object.keys(shifts).length,
    数据源: [
      emotion && `emotion:${emotion}`,
      baseSpirit && `baseSpirit:${baseSpirit}`,
      questionAnswer && `question:${questionAnswer}`,
      storySeed && `storySeed:${storySeed}`,
      bartender?.key && `bartender:${bartender.key}`,
      zodiacCorrect && 'zodiacCorrect',
      tLen >= 5 && `note:${tLen}字`,
    ].filter(Boolean),
  });

  return vec;
}

/**
 * 计算两个向量的差异（每个维度的 delta）
 * 用于 UI 展示"校准前后变化"
 * @param {number[]} before
 * @param {number[]} after
 * @returns {{ dim: number, delta: number }[]}
 */
export function diffVectors(before, after) {
  const dim = Math.max(before?.length || 0, after?.length || 0, 11);
  const result = [];
  for (let i = 0; i < dim; i++) {
    const b = before?.[i] ?? 0.5;
    const a = after?.[i] ?? 0.5;
    result.push({ dim: i, delta: +(a - b).toFixed(4) });
  }
  return result;
}

export default {
  deriveVectorFromContext,
  diffVectors,
};
