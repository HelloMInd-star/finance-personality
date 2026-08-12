/**
 * Y.Mine 时段引擎 v1.0.0
 *
 * 同一人格在不同时段不同推荐 · 基于生物学昼夜节律
 *
 * 设计：
 *  - resolveTimeSlot(date, manual?) → 当前时段描述对象
 *  - describeBiologyShift(slot) → 6 个通用维度的偏移方向与幅度
 *  - applyBiologyShift(vec, slot) → 将偏移叠加到 11 维向量（仅通用维度）
 *
 * 时段划分（与人体昼夜节律对齐）：
 *  - dawn    05:00-08:59 · 皮质醇上升期 · 觉醒
 *  - morning 09:00-11:59 · 峰值注意力 · 决策力 ↑
 *  - noon    12:00-13:59 · 餐后低谷 · 反应慢
 *  - pm      14:00-17:59 · 二次高峰 · 创造 ↑
 *  - dusk    18:00-20:59 · 5-HT 上升 · 情绪 ↑
 *  - night   21:00-23:59 · melatonin 分泌 · 内省
 *  - midnight 00:00-04:59 · REM 高峰 · 直觉
 *
 * 仅对 vectorMapper 的通用维度（0-5）施加偏移；金融维度（6-10）不动
 */

import { GENERAL_DIMS, DIM_COUNT } from './vectorMapper.js';

// ============================================================
// 时段定义
// ============================================================

/** 7 个时段 · 配色与生物学注释 · auraColor 沿用项目深空紫金语系 */
const SLOTS = {
  dawn: {
    key: 'dawn',
    label: '黎明',
    range: [5, 9],
    auraColor: '#f59e0b', // 暖橙
    orbState: '晨光初临',
    biologyNote: '皮质醇上升 · 觉醒期',
    poem: '夜的余烬未冷，光已开始书写新的章节。',
    // 维度偏移：决策快 / 情绪稳 / 纪律 ↑，社交 ↓
    shifts: { 1: +0.04, 2: +0.03, 3: +0.05, 5: -0.03 },
  },
  morning: {
    key: 'morning',
    label: '上午',
    range: [9, 12],
    auraColor: '#fbbf24', // 金黄
    orbState: '日轮高悬',
    biologyNote: '峰值注意力 · 决策力高峰',
    poem: '此刻头脑最锋利，世界在此被切开与命名。',
    shifts: { 1: +0.05, 3: +0.04, 4: +0.02 },
  },
  noon: {
    key: 'noon',
    label: '午后',
    range: [12, 14],
    auraColor: '#a855f7', // 紫
    orbState: '光潮涨起',
    biologyNote: '餐后低谷 · 反应稍钝',
    poem: '光在杯沿暂停，思绪缓行如蜜。',
    shifts: { 1: -0.04, 2: -0.02, 4: +0.03 },
  },
  pm: {
    key: 'pm',
    label: '下午',
    range: [14, 18],
    auraColor: '#7c5fbf', // 深紫
    orbState: '斜阳漫卷',
    biologyNote: '二次高峰 · 创造力活跃',
    poem: '影子被拉长，想象也跟着长出新的褶皱。',
    shifts: { 0: +0.03, 4: +0.05, 5: +0.02 },
  },
  dusk: {
    key: 'dusk',
    label: '黄昏',
    range: [18, 21],
    auraColor: '#ec4899', // 玫红
    orbState: '霞光将落',
    biologyNote: '5-HT 上升 · 情绪共鸣强化',
    poem: '世界在此刻柔软，每一句话都更容易被听见。',
    shifts: { 2: +0.05, 5: +0.05, 0: +0.02 },
  },
  night: {
    key: 'night',
    label: '夜',
    range: [21, 24],
    auraColor: '#6366f1', // 靛蓝
    orbState: '夜幕深垂',
    biologyNote: 'melatonin 分泌 · 内省期',
    poem: '夜把所有人藏起来，好让真话浮上来。',
    shifts: { 2: +0.03, 4: +0.04, 5: -0.04 },
  },
  midnight: {
    key: 'midnight',
    label: '深夜',
    range: [0, 5],
    auraColor: '#3b82f6', // 深蓝
    orbState: '群星垂问',
    biologyNote: 'REM 高峰 · 直觉敏锐',
    poem: '此刻最深的真实只对未眠者开口。',
    shifts: { 0: +0.05, 4: +0.03, 3: -0.03 },
  },
};

/** 时段顺序（用于遍历） */
const SLOT_ORDER = ['midnight', 'dawn', 'morning', 'noon', 'pm', 'dusk', 'night'];

// ============================================================
// 工具
// ============================================================

const safeNum = (v, def) => (typeof v === 'number' && !isNaN(v) ? v : def);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ============================================================
// 核心 API
// ============================================================

/**
 * 解析当前时段
 * @param {Date} [date] - 时间对象，缺省 new Date()
 * @param {string} [manual] - 手动指定时段 key（覆盖时间推断）
 * @returns {typeof SLOTS.midnight} 时段描述对象
 */
export function resolveTimeSlot(date, manual) {
  const d = date instanceof Date ? date : new Date();
  const hour = d.getHours();

  if (manual && SLOTS[manual]) return SLOTS[manual];

  for (const key of SLOT_ORDER) {
    const [start, end] = SLOTS[key].range;
    if (hour >= start && hour < end) return SLOTS[key];
  }
  // 兜底
  return SLOTS.midnight;
}

/**
 * 描述当前时段的生物学偏移
 * @param {ReturnType<resolveTimeSlot>} slot - 时段对象
 * @returns {{dim: number, sign: '+'|'−', delta: number}[]} 偏移描述（用于 UI 展示）
 */
export function describeBiologyShift(slot) {
  if (!slot || !slot.shifts) return [];
  const signMap = { 1: '+', '−1': '−', '−': '−' };
  return Object.entries(slot.shifts).map(([dimIdx, delta]) => {
    const dim = Number(dimIdx);
    const meta = GENERAL_DIMS[dim];
    return {
      dim: meta ? meta.key : `dim${dim}`,
      label: meta ? meta.label : `维度${dim}`,
      sign: delta >= 0 ? '+' : '−',
      delta: Math.abs(delta),
      raw: delta,
    };
  });
}

/**
 * 将时段偏移叠加到 11 维向量
 * 仅修改通用维度（0-5）；金融维度（6-10）原样保留
 *
 * @param {number[]} vec - 11 维基础向量（值域 [0,1]）
 * @param {ReturnType<resolveTimeSlot>} slot - 时段对象
 * @returns {number[]} 偏移后的 11 维向量（新数组，不修改入参）
 */
export function applyBiologyShift(vec, slot) {
  const dim = DIM_COUNT;
  const v = Array.isArray(vec) ? vec.slice(0, dim) : new Array(dim).fill(0.5);
  while (v.length < dim) v.push(0.5);

  if (!slot || !slot.shifts) return v.map((x) => safeNum(x, 0.5));

  // 先用 safeNum 清洗 NaN / 非数，再叠加偏移
  const out = v.map((x) => safeNum(x, 0.5));
  for (const [dimIdx, delta] of Object.entries(slot.shifts)) {
    const i = Number(dimIdx);
    if (i >= 0 && i < dim) {
      out[i] = clamp01(out[i] + delta);
    }
  }
  return out;
}

/** 时段列表（用于手动选择入口） */
export const ALL_SLOTS = SLOT_ORDER.map((k) => SLOTS[k]);

export default {
  resolveTimeSlot,
  describeBiologyShift,
  applyBiologyShift,
  ALL_SLOTS,
};
