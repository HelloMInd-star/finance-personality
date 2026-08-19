/**
 * 人格护照 · 数据与逻辑层
 *
 * 双面模型：
 *  - 社交面具 = 自评 MBTI → 原型映射向量（你说的你）
 *  - 真实人格 = baseVector 11 维行为向量 → 桥接展示六维（你的行为说的你）
 *
 * 原型/映射/差异规则移植自 ymine-demos passport（人格实验室 IP），
 * 桥接层 bridgeBaseVector 为 finance 侧新增：把调酒/行为采集的
 * 11 维决策向量翻译成展示层六维。
 */

// ============================================================
// 展示六维（Y.Mine 人格实验室展示层模型）
// ============================================================
export const DIMS = [
  { key: 'TOL', name: '容忍度', en: 'Tolerance', icon: '🧘', color: '#A78BFA' },
  { key: 'SPD', name: '速度', en: 'Speed', icon: '⚡', color: '#22D3EE' },
  { key: 'INF', name: '影响力', en: 'Influence', icon: '🧠', color: '#FBBF24' },
  { key: 'ENT', name: '能量', en: 'Energy', icon: '🔥', color: '#F87171' },
  { key: 'LEAD', name: '主导性', en: 'Dominance', icon: '👑', color: '#34D399' },
  { key: 'VIS', name: '视觉性', en: 'Vision', icon: '👁️', color: '#F472B6' },
];

export const DIM_KEYS = DIMS.map((d) => d.key);

// ============================================================
// 11 种人格原型（六维值域 [0,1]）
// ============================================================
export const ARCHETYPES = [
  { id: 'dreamweaver', name: '织梦者', emoji: '🌙', color: '#9d6bbf', desc: '以直觉为线，编织夜的经纬。', tagline: '把未饮过的味道，织进今夜的星图。', vector: { TOL: 0.55, SPD: 0.45, INF: 0.70, ENT: 0.65, LEAD: 0.40, VIS: 0.85 } },
  { id: 'clockmaker', name: '守序者', emoji: '⚙️', color: '#f0c674', desc: '每一滴都落在它该落的分毫里。', tagline: '每一滴都落在它该落的分毫里。', vector: { TOL: 0.35, SPD: 0.30, INF: 0.80, ENT: 0.20, LEAD: 0.75, VIS: 0.30 } },
  { id: 'ember', name: '焰心者', emoji: '🔥', color: '#F87171', desc: '把热度分给世界的每一寸。', tagline: '你举杯，整张吧台都跟着亮起来。', vector: { TOL: 0.40, SPD: 0.75, INF: 0.35, ENT: 0.90, LEAD: 0.55, VIS: 0.60 } },
  { id: 'velvet', name: '月潮者', emoji: '🌊', color: '#22D3EE', desc: '随月盈缺，温柔却不可挡。', tagline: '把锋芒藏进丝绒，让夜柔软下来。', vector: { TOL: 0.70, SPD: 0.50, INF: 0.55, ENT: 0.60, LEAD: 0.35, VIS: 0.70 } },
  { id: 'mistwalker', name: '雾行者', emoji: '🌫️', color: '#8B8FB8', desc: '在朦胧中辨认方向的人。', tagline: '心事被风一吹，便起了涟漪。', vector: { TOL: 0.60, SPD: 0.40, INF: 0.50, ENT: 0.35, LEAD: 0.45, VIS: 0.55 } },
  { id: 'alchemist', name: '炼金者', emoji: '⚗️', color: '#A78BFA', desc: '把纷繁炼至两样材料。', tagline: '以耐心炼新奇，把灵感炼成经典。', vector: { TOL: 0.80, SPD: 0.55, INF: 0.85, ENT: 0.30, LEAD: 0.60, VIS: 0.45 } },
  { id: 'solitude', name: '独酌者', emoji: '🌑', color: '#4A4A6A', desc: '夜将尽，留一句给你独听。', tagline: '角落那杯，是只有自己懂的语言。', vector: { TOL: 0.50, SPD: 0.35, INF: 0.60, ENT: 0.25, LEAD: 0.30, VIS: 0.40 } },
  { id: 'navigator', name: '引航者', emoji: '🧭', color: '#c8a040', desc: '风浪里端得住一杯不洒，便是你的航向。', tagline: '风浪里端得住一杯不洒，便是你的航向。', vector: { TOL: 0.50, SPD: 0.70, INF: 0.55, ENT: 0.40, LEAD: 0.80, VIS: 0.45 } },
  { id: 'revel', name: '夜宴者', emoji: '🥂', color: '#b06fc8', desc: '热烈是底色，锋芒是装饰。', tagline: '热烈是底色，锋芒是装饰。', vector: { TOL: 0.40, SPD: 0.65, INF: 0.25, ENT: 0.85, LEAD: 0.55, VIS: 0.70 } },
  { id: 'twilight', name: '暮色者', emoji: '🌅', color: '#FBBF24', desc: '天光与夜色交接处的人。', tagline: '不偏不倚，恰是夜与昼交界的颜色。', vector: { TOL: 0.45, SPD: 0.60, INF: 0.45, ENT: 0.55, LEAD: 0.50, VIS: 0.65 } },
  { id: 'nightcaller', name: '夜唤者', emoji: '🦉', color: '#7C5FBF', desc: '在子夜唤醒沉睡的思想。', tagline: '在子夜，把沉睡的思想一一唤醒。', vector: { TOL: 0.65, SPD: 0.70, INF: 0.65, ENT: 0.75, LEAD: 0.70, VIS: 0.75 } },
];

// MBTI → 原型映射
export const MBTI_ARCHETYPE_MAP = {
  INTJ: 'alchemist', INTP: 'alchemist', ENTJ: 'nightcaller', ENTP: 'nightcaller',
  INFJ: 'dreamweaver', INFP: 'dreamweaver', ENFJ: 'ember', ENFP: 'ember',
  ISTJ: 'clockmaker', ISFJ: 'clockmaker', ESTJ: 'navigator', ESFJ: 'navigator',
  ISTP: 'velvet', ISFP: 'mistwalker', ESTP: 'revel', ESFP: 'revel',
};

export const ALL_MBTI = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

// ============================================================
// 差异解读规则表（移植自 mask.js）
// pos = 面具高于真实 / neg = 真实高于面具
// ============================================================
export const HOT_DELTA = 25; // |Δ| ≥ 25：显著差异，行高亮
export const SIG_DELTA = 15; // |Δ| ≥ 15：进入解读文案

export const MASK_RULES = {
  ENT: {
    pos: { label: '技能型社交者', text: '对外高能量输出，对内需要独处回血——社交是你的技能，不是你的本能。' },
    neg: { label: '蛰伏的能量体', text: '内在能量充沛，对外却选择收敛——你不是不合群，只是在等值得开口的场合。' },
  },
  LEAD: {
    pos: { label: '责任型领队', text: '在外扛事、拍板、兜底；回到自己，你更想被安排——主导是你的职责，不是你的欲望。' },
    neg: { label: '隐性掌舵者', text: '你习惯把方向盘让给别人，但心里的路线图从未消失——退让是策略，不是本性。' },
  },
  INF: {
    pos: { label: '舞台型表达者', text: '对外释放观点与存在感，对内更愿安静旁观——表达是你的工作模式，沉默才是待机画面。' },
    neg: { label: '深水观察者', text: '你内在的洞察满溢，却很少批发观点——不是无话可说，是不轻易开仓。' },
  },
  SPD: {
    pos: { label: '变速跑者', text: '人前把节奏调快，独处时只想慢下来——快是你的盔甲，慢是你的底盘。' },
    neg: { label: '内置涡轮', text: '你的内在转速极高，对外却刻意降速——慢是你的选择，不是你的速度上限。' },
  },
  TOL: {
    pos: { label: '训练有素的好脾气', text: '对外宽厚包容，对内其实门槛清晰——你的好脾气，有一部分是练出来的。' },
    neg: { label: '外冷内温', text: '你看起来锋利，内里比谁都宽容——冷脸是护甲，不是敌意。' },
  },
  VIS: {
    pos: { label: '造梦外包', text: '你擅长对外描绘画面与愿景，对内更在意眼前可触的东西——想象力是你的工具，不是你的住所。' },
    neg: { label: '私藏放映厅', text: '你脑内住着完整的画面，却很少公开放映——低调不是空白，是未公开。' },
  },
};

export const CONGRUENT_LABEL = '内外同频者';
export const CONGRUENT_TEXT =
  '六维之中没有任何一维出现显著偏移——你示人的样子，和你自己居住的样子，是同一个房间。';

// ============================================================
// 桥接层：finance 11 维决策向量 → 展示六维（[0,1]）
// [0]riskTolerance [1]decisionSpeed [2]emotionalStability
// [3]discipline [4]creativity [5]socialTendency（6-10 金融维不用）
// ============================================================
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

export function bridgeBaseVector(base) {
  if (!Array.isArray(base) || base.length < 6) return null;
  const g = (i) => clamp01(base[i] ?? 0.5);
  return {
    TOL: g(0),                   // 容忍度 ← 风险偏好（敢承受）
    SPD: g(1),                   // 速度 ← 决策速度
    INF: (g(4) + g(5)) / 2,      // 影响力 ← 创造力 × 社交倾向
    ENT: g(5),                   // 能量 ← 社交倾向
    LEAD: (g(0) + g(3)) / 2,     // 主导性 ← 敢拍板 × 有纪律
    VIS: g(4),                   // 视觉性 ← 创造力
  };
}

// 面具向量：自评 MBTI → 原型六维（[0,1]）
export function getMaskVector(mbti) {
  const archId = MBTI_ARCHETYPE_MAP[mbti];
  const archetype = ARCHETYPES.find((a) => a.id === archId);
  return archetype ? { ...archetype.vector } : null;
}

export function getMaskArchetype(mbti) {
  const archId = MBTI_ARCHETYPE_MAP[mbti];
  return ARCHETYPES.find((a) => a.id === archId) || null;
}

// ============================================================
// 匹配 / 差异 / 洞察（向量输入为 [0,1]，差异计算转为 0-100 刻度）
// ============================================================
export function findClosestArchetype(vec) {
  let best = null;
  let bestDist = Infinity;
  ARCHETYPES.forEach((a) => {
    const dist = DIM_KEYS.reduce((s, k) => s + ((vec[k] ?? 0.5) - a.vector[k]) ** 2, 0);
    if (dist < bestDist) { bestDist = dist; best = a; }
  });
  return best;
}

export function computeDiff(maskVec, trueVec) {
  const deltas = DIMS.map((d) => {
    const m = Math.round((maskVec[d.key] ?? 0.5) * 100);
    const t = Math.round((trueVec[d.key] ?? 0.5) * 100);
    return { key: d.key, mask: m, true: t, delta: m - t };
  });
  const sorted = [...deltas].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const sum = deltas.reduce((s, x) => s + Math.abs(x.delta), 0);
  return { deltas, sorted, absMean: Math.round((sum / DIMS.length) * 10) / 10 };
}

// 裂合等级：<8 内外同频 / 8-18 温和分野 / >18 清晰分野
export function levelOf(absMean) {
  if (absMean < 8) return '内外同频';
  if (absMean <= 18) return '温和分野';
  return '清晰分野';
}

export function levelSentence(absMean) {
  const m = Math.round(absMean);
  if (absMean < 8) {
    return `裂合指数 ${m}——面具与内核几乎重合，所见即所得，这是一种罕见的自洽。`;
  }
  if (absMean <= 18) {
    return `裂合指数 ${m}——存在温和分野：你在场景之间切换姿态，但从未离开自己太远。`;
  }
  return `裂合指数 ${m}——面具与内核分野清晰：社交是你后天习得的能力，不是你的出厂配置。`;
}

// 洞察：最多 2 条维度解读 + 1 条裂合总结
export function buildInsight(diff) {
  const sig = diff.sorted.filter((x) => Math.abs(x.delta) >= SIG_DELTA);
  const sentences = [];
  let persona = CONGRUENT_LABEL;
  if (sig.length > 0) {
    const r0 = MASK_RULES[sig[0].key][sig[0].delta > 0 ? 'pos' : 'neg'];
    persona = r0.label;
    sentences.push(r0.text);
    if (sig.length > 1) {
      const r1 = MASK_RULES[sig[1].key][sig[1].delta > 0 ? 'pos' : 'neg'];
      sentences.push(r1.text);
    }
  } else {
    sentences.push(CONGRUENT_TEXT);
  }
  sentences.push(levelSentence(diff.absMean));
  return { persona, sentences: sentences.slice(0, 3) };
}

// 证件编号：由 12 个向量值确定性生成（djb2），随画像变化
export function makeDocNo(maskVec, trueVec) {
  let h = 5381;
  DIM_KEYS.forEach((k) => {
    h = ((h * 33) ^ Math.round(clamp01(maskVec[k]) * 100)) >>> 0;
    h = ((h * 33) ^ Math.round(clamp01(trueVec[k]) * 100)) >>> 0;
  });
  let s = h.toString(36).toUpperCase();
  while (s.length < 8) s = '0' + s;
  s = s.slice(-8);
  return `YM-${s.slice(0, 4)}-${s.slice(4, 8)}`;
}
