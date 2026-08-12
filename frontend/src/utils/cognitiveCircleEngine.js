/**
 * 认知画圈引擎 · Cognitive Circle Engine
 *
 * 核心思想：
 * 每个人的认知不是一组静态标签，而是一张由「节点（概念/习惯/模式）」
 * 和「边（关联/冲突/转化）」组成的动态网络。
 *
 * 本引擎从以下来源抽丝剥茧，绘制你的「认知拓扑图」：
 *  1. 行为数据（德州扑克 / 台球 / 健身 / 博弈台 / 娱乐 / 调酒 / 陪练对话）
 *  2. 音乐画像向量（曲风 / 情绪 / BPM → 映射到决策维度）
 *  3. 人格底色（MBTI / 塔罗 / 星盘 → 作为锚点节点）
 *
 * 输出：
 *  - nodes：认知节点（含圈层：核心圈 / 支撑圈 / 边缘圈）
 *  - edges：节点之间的关系（强化 / 牵制 / 互补 / 冲突）
 *  - layers：三圈可视化数据（核心盘 / 能力环 / 探索带）
 *  - insights：从拓扑结构推导的认知洞察
 */

import { storage } from './storage';
import { logger } from './logger';
import { mergeMusicVector } from './musicProfileEngine';

const CIRCLE_CACHE_PREFIX = '__circle_cache__';
const readCache = () => {
  try {
    const raw = localStorage.getItem(CIRCLE_CACHE_PREFIX + 'data');
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.timestamp !== 'number') return null;
    return obj;
  } catch (_) {
    return null;
  }
};
const writeCache = (data) => {
  try { localStorage.setItem(CIRCLE_CACHE_PREFIX + 'data', JSON.stringify(data)); } catch (_) {}
};

// ========== 认知节点类型定义 ==========
export const NODE_TYPES = {
  ANCHOR: 'anchor',       // 人格锚点（MBTI/塔罗/星盘）
  DECISION: 'decision',   // 决策模式
  EXECUTION: 'execution', // 执行模式
  SOCIAL: 'social',       // 社交模式
  EMOTION: 'emotion',     // 情绪模式
  MUSIC: 'music',         // 音乐气质
  HABIT: 'habit',         // 行为习惯
};

export const RELATION_TYPES = {
  REINFORCE: 'reinforce', // 强化（同向推波）
  BALANCE: 'balance',     // 牵制（相互制衡）
  COMPLEMENT: 'complement', // 互补（补足盲区）
  CONFLICT: 'conflict',   // 冲突（内耗源）
};

export const CIRCLE_LAYERS = {
  CORE: 'core',       // 核心圈：稳定且长期驱动你
  SUPPORT: 'support', // 支撑圈：常用可调用
  EDGE: 'edge',       // 边缘圈：偶尔出现或待发展
};

// ========== 1. 数据采集 ==========

const collectAllSources = () => {
  const all = storage.getAll() || {};

  // 行为数据
  const pokerGames = all.pokerGames || [];
  const billiardsGames = all.billiardsGames || [];
  const billiardsSessions = all.billiardsSessions || [];
  const fitnessSessions = all.fitnessSessions || [];
  let gameTableHistory = [];
  try { gameTableHistory = JSON.parse(localStorage.getItem('gametable_history') || '[]'); } catch (_) {}
  let entertainmentHistory = [];
  try { entertainmentHistory = JSON.parse(localStorage.getItem('entertainment_history') || '[]'); } catch (_) {}
  const bartenderSessions = all.bartenderSessions || [];
  const coachConversations = all.coachConversations || [];

  // 人格锚点
  const userProfile = all.userProfile || {};
  const mbti = userProfile.mbti || all.mbti || '';
  let tarotToday = null;
  try { tarotToday = JSON.parse(localStorage.getItem('tarot_daily_card') || 'null'); } catch (_) {}
  let zodiac = null;
  try { zodiac = JSON.parse(localStorage.getItem('user_zodiac') || 'null'); } catch (_) {}

  // 音乐画像
  let musicProfile = null;
  try {
    const raw = localStorage.getItem('netease_profile');
    if (raw) musicProfile = JSON.parse(raw);
  } catch (_) {}

  const sources = [];
  if (pokerGames.length) sources.push(`德州扑克(${pokerGames.length})`);
  if (billiardsGames.length || billiardsSessions.length) sources.push(`台球(${billiardsGames.length + billiardsSessions.length})`);
  if (fitnessSessions.length) sources.push(`健身(${fitnessSessions.length})`);
  if (gameTableHistory.length) sources.push(`博弈台(${gameTableHistory.length})`);
  if (entertainmentHistory.length) sources.push(`娱乐(${entertainmentHistory.length})`);
  if (bartenderSessions.length) sources.push(`调酒(${bartenderSessions.length})`);
  if (coachConversations.length) sources.push(`陪练对话(${coachConversations.length})`);
  if (mbti) sources.push('MBTI');
  if (tarotToday) sources.push('塔罗');
  if (zodiac) sources.push('星盘');
  if (musicProfile) sources.push('音乐画像');

  return {
    behavior: {
      pokerGames, billiardsGames, billiardsSessions, fitnessSessions,
      gameTableHistory, entertainmentHistory, bartenderSessions, coachConversations,
    },
    anchors: { mbti, tarotToday, zodiac },
    musicProfile,
    sources,
  };
};

// ========== 2. 计算基础维度向量 ==========

const computeBaseDimensions = ({ behavior }) => {
  const { pokerGames, billiardsGames, billiardsSessions, fitnessSessions,
    gameTableHistory, entertainmentHistory, bartenderSessions, coachConversations } = behavior;

  // 风险承受度 0~1
  let risk = 0.5;
  if (pokerGames.length) {
    const recent = pokerGames.slice(-8);
    const ra = recent.reduce((s, g) => s + (g.raiseCount || 0), 0);
    const fo = recent.reduce((s, g) => s + (g.foldCount || 0), 0);
    const total = recent.reduce((s, g) => s + (g.totalActions || 1), 0);
    const aggression = ra / Math.max(total, 1);
    const tightness = fo / Math.max(total, 1);
    risk = 0.35 + aggression * 0.5 - tightness * 0.2;
  }
  if (gameTableHistory.length) {
    const recent = gameTableHistory.slice(-5);
    const switches = recent.reduce((s, g) => s + (g.strategySwitches || 0), 0) / Math.max(recent.length, 1);
    risk = risk * 0.7 + Math.min(1, 0.3 + switches * 0.18) * 0.3;
  }

  // 决策速度 0~1（慢→快）
  let speed = 0.5;
  if (pokerGames.length) {
    const recent = pokerGames.slice(-5);
    const avgThink = recent.reduce((s, g) => s + (g.avgThinkTime || 8), 0) / Math.max(recent.length, 1);
    speed = Math.min(1, Math.max(0, 1 - (avgThink - 3) / 15));
  }
  if (billiardsGames.length) {
    const recent = billiardsGames.slice(-5);
    const avgAim = recent.reduce((s, g) => s + (g.avgAimTime || 3), 0) / Math.max(recent.length, 1);
    speed = speed * 0.6 + Math.min(1, Math.max(0, 1 - (avgAim - 1) / 10)) * 0.4;
  }

  // 执行韧性 0~1
  let grit = 0.5;
  if (fitnessSessions.length) {
    const recent = fitnessSessions.slice(-10);
    const cr = recent.filter(s => s.completed).length / Math.max(recent.length, 1);
    grit = 0.3 + cr * 0.6;
  }
  if (billiardsSessions.length) {
    const recent = billiardsSessions.slice(-5);
    const quits = recent.filter(r => r.quitEarly).length;
    grit = grit * 0.7 + (quits === 0 ? 0.85 : 0.45) * 0.3;
  }

  // 社交开放度 0~1
  let social = 0.5;
  if (gameTableHistory.length) {
    const recent = gameTableHistory.slice(-6);
    const collab = recent.filter(g => g.mode === 'collab' || g.allianceCount > 0).length;
    social = 0.3 + collab / Math.max(recent.length, 1) * 0.6;
  }
  if (entertainmentHistory.length) {
    const recent = entertainmentHistory.slice(-8);
    const socialChoice = recent.filter(e => (e.tags || []).includes('social')).length;
    social = social * 0.5 + (0.35 + socialChoice / Math.max(recent.length, 1) * 0.6) * 0.5;
  }
  if (coachConversations.length) {
    const turns = Math.min(coachConversations.length, 12);
    social = Math.min(1, social + turns * 0.015);
  }

  // 情绪稳定性 0~1
  let emotionStability = 0.55;
  if (pokerGames.length) {
    const recent = pokerGames.slice(-6);
    const tiltCount = recent.filter(g => g.tilt || g.emotionScore < 0.3).length;
    emotionStability = 0.8 - tiltCount * 0.18;
  }
  if (bartenderSessions.length) {
    const recent = bartenderSessions.slice(-4);
    const moodUp = recent.filter(s => (s.moodDelta || 0) > 0).length;
    emotionStability = emotionStability * 0.75 + (0.4 + moodUp / Math.max(recent.length, 1) * 0.5) * 0.25;
  }

  // 开放探索度 0~1
  let openness = 0.5;
  if (entertainmentHistory.length) {
    const tags = new Set();
    entertainmentHistory.slice(-12).forEach(e => (e.tags || []).forEach(t => tags.add(t)));
    openness = Math.min(1, 0.25 + tags.size * 0.08);
  }
  if (bartenderSessions.length) {
    const recipes = new Set(bartenderSessions.slice(-10).map(s => s.recipeId || s.cocktailName));
    openness = openness * 0.6 + Math.min(1, 0.3 + recipes.size * 0.1) * 0.4;
  }

  return {
    risk: clamp(risk),
    speed: clamp(speed),
    grit: clamp(grit),
    social: clamp(social),
    emotionStability: clamp(emotionStability),
    openness: clamp(openness),
  };
};

// ========== 2.5 塔罗 × 脉轮权重注入 ==========
// 将塔罗牌义和脉轮测试结果映射到维度权重

const TAROT_DIM_MAP = {
  '愚者': { risk: 0.08, openness: 0.1, speed: 0.06 },
  '魔术师': { risk: 0.06, speed: 0.09, openness: 0.06 },
  '女祭司': { emotionStability: 0.08, grit: 0.06, social: -0.08 },
  '皇后': { social: 0.09, openness: 0.06, emotionStability: 0.03 },
  '皇帝': { risk: 0.06, grit: 0.09, speed: 0.03 },
  '战车': { grit: 0.12, speed: 0.06, risk: 0.03 },
  '力量': { emotionStability: 0.12, grit: 0.06 },
  '隐士': { social: -0.09, openness: 0.06, emotionStability: 0.06 },
  '命运之轮': { risk: 0.06, openness: 0.09 },
  '正义': { emotionStability: 0.09, grit: 0.06 },
  '倒吊人': { speed: -0.09, grit: 0.06, emotionStability: 0.06 },
  '死神': { grit: 0.09, risk: -0.06 },
  '节制': { emotionStability: 0.12, risk: -0.03 },
  '恶魔': { risk: 0.12, speed: 0.06 },
  '塔': { risk: 0.09, social: -0.06 },
  '星星': { openness: 0.12, emotionStability: 0.09 },
  '月亮': { emotionStability: -0.09, openness: 0.06 },
  '太阳': { social: 0.12, emotionStability: 0.12 },
  '审判': { grit: 0.09, emotionStability: 0.06 },
  '世界': { openness: 0.12, social: 0.09 },
};

const CHAKRA_DIM_MAP = {
  // 脉轮 → 行为维度映射
  root: { risk: 0.05, grit: 0.04 },           // 海底轮 → 风险/韧性
  sacral: { social: 0.06, openness: 0.04 },    // 脐轮 → 社交/开放
  solar: { speed: 0.05, risk: 0.04 },          // 太阳轮 → 速度/风险
  heart: { emotionStability: 0.07, social: 0.04 }, // 心轮 → 情绪/社交
  throat: { openness: 0.07, social: 0.05 },    // 喉轮 → 开放/社交
  third_eye: { emotionStability: 0.06, openness: 0.05 }, // 眉心轮 → 情绪/开放
  crown: { grit: 0.06, openness: 0.06 },       // 顶轮 → 韧性/开放
};

const applyModifiers = (baseDims, anchors) => {
  const result = { ...baseDims };

  // 塔罗权重注入（15% 影响）
  if (anchors?.tarotToday?.card?.name) {
    const tarotName = anchors.tarotToday.card.name;
    const modifiers = TAROT_DIM_MAP[tarotName];
    if (modifiers) {
      Object.entries(modifiers).forEach(([dim, delta]) => {
        if (result[dim] !== undefined) {
          result[dim] = clamp(result[dim] + delta);
        }
      });
    }
  }

  // 脉轮权重注入（10% 影响）
  let chakraData = null;
  try { chakraData = storage.getUserState()?.chakraResult || null; } catch (_) {}
  if (chakraData?.dominantChakra && CHAKRA_DIM_MAP[chakraData.dominantChakra]) {
    const modifiers = CHAKRA_DIM_MAP[chakraData.dominantChakra];
    Object.entries(modifiers).forEach(([dim, delta]) => {
      if (result[dim] !== undefined) {
        result[dim] = clamp(result[dim] + delta);
      }
    });
  }

  return result;
};

const clamp = (v) => Math.max(0, Math.min(1, v));

// ========== 3. 生成认知节点 ==========

const buildAnchorNodes = ({ anchors }) => {
  const nodes = [];
  const { mbti, tarotToday, zodiac } = anchors;

  if (mbti) {
    const traits = getMbtiTraits(mbti);
    nodes.push({
      id: `anchor_mbti_${mbti}`,
      type: NODE_TYPES.ANCHOR,
      label: `MBTI · ${mbti}`,
      summary: traits.summary,
      weight: 0.92,
      layer: CIRCLE_LAYERS.CORE,
      angle: -90,
      tags: traits.tags,
      color: '#D4AF37',
      emoji: '🧭',
    });
  }

  if (tarotToday && tarotToday.card) {
    nodes.push({
      id: `anchor_tarot_${tarotToday.card.id || 'today'}`,
      type: NODE_TYPES.ANCHOR,
      label: `今日塔罗 · ${tarotToday.card.name || '未知'}`,
      summary: tarotToday.card.meaning || '今日人格底色指引',
      weight: 0.78,
      layer: CIRCLE_LAYERS.CORE,
      angle: -30,
      tags: ['今日指引', '人格底色'],
      color: '#a855f7',
      emoji: '🃏',
    });
  }

  if (zodiac && (zodiac.sun || zodiac.moon || zodiac.rising)) {
    const sun = zodiac.sun || '';
    nodes.push({
      id: `anchor_zodiac_${sun || 's'}`,
      type: NODE_TYPES.ANCHOR,
      label: `星盘 · 太阳${sun ? '：' + sun : ''}`,
      summary: '由日月上升共同勾勒你的人际印象底色',
      weight: 0.7,
      layer: CIRCLE_LAYERS.CORE,
      angle: 30,
      tags: ['太阳星座', '核心身份'],
      color: '#f59e0b',
      emoji: '✨',
    });
  }

  return nodes;
};

const getMbtiTraits = (mbti) => {
  const map = {
    INTJ: { summary: '战略型架构师，习惯从长期视角推演路径', tags: ['战略', '独立', '理性'] },
    INTP: { summary: '逻辑型探索者，享受拆解复杂系统的过程', tags: ['逻辑', '探索', '思辨'] },
    ENTJ: { summary: '指挥型统领，果断推进目标并调配资源', tags: ['统领', '果断', '目标'] },
    ENTP: { summary: '辩论型发明家，擅长跨界联想和逆向', tags: ['联想', '逆向', '创意'] },
    INFJ: { summary: '提倡者，用直觉和温度锚定长远意义', tags: ['直觉', '温度', '意义'] },
    INFP: { summary: '调停者，内心有一套自洽的价值光谱', tags: ['价值', '共情', '理想'] },
    ENFJ: { summary: '主人公，擅长用愿景点燃一群人', tags: ['愿景', '感染力', '利他'] },
    ENFP: { summary: '竞选者，热情驱动下不断探索新可能', tags: ['热情', '可能', '发散'] },
    ISTJ: { summary: '物流师，相信流程、细节与可靠交付', tags: ['流程', '细节', '可靠'] },
    ISFJ: { summary: '守卫者，默默照顾身边每个人的感受', tags: ['守护', '责任', '细腻'] },
    ESTJ: { summary: '总经理，用秩序和规则把事情落地', tags: ['秩序', '落地', '责任'] },
    ESFJ: { summary: '执政官，用关怀和仪式感维系群体温度', tags: ['关怀', '仪式', '群体'] },
    ISTP: { summary: '鉴赏家，动手解决问题的实战派', tags: ['实战', '冷静', '灵活'] },
    ISFP: { summary: '探险家，追随当下审美与体验', tags: ['审美', '体验', '自由'] },
    ESTP: { summary: '企业家，高临场感的行动派', tags: ['临场', '行动', '刺激'] },
    ESFP: { summary: '表演者，把快乐和能量传递给周围', tags: ['快乐', '表达', '感染'] },
  };
  return map[mbti.toUpperCase?.()] || { summary: '独特的个人底色，无法被简单归类', tags: ['独特', '自洽'] };
};

const buildDimensionNodes = (dim) => {
  const nodes = [];

  // 决策模式节点
  const aggressionLevel = dim.risk > 0.66 ? '激进' : dim.risk > 0.38 ? '稳健' : '保守';
  const speedLevel = dim.speed > 0.66 ? '果决' : dim.speed > 0.38 ? '均衡' : '审慎';
  nodes.push({
    id: 'dim_decision',
    type: NODE_TYPES.DECISION,
    label: `决策 · ${aggressionLevel}${speedLevel}`,
    summary: `风险承受度：${pct(dim.risk)} · 决策速度：${pct(dim.speed)}`,
    weight: 0.55 + dim.risk * 0.25,
    layer: dim.risk + dim.speed > 1.15 ? CIRCLE_LAYERS.CORE : CIRCLE_LAYERS.SUPPORT,
    angle: 120,
    tags: [aggressionLevel, speedLevel],
    color: '#22d3ee',
    emoji: '🎯',
    metrics: { risk: dim.risk, speed: dim.speed },
  });

  // 执行模式节点
  const gritLevel = dim.grit > 0.7 ? '强韧性' : dim.grit > 0.45 ? '有弹性' : '需节奏';
  nodes.push({
    id: 'dim_execution',
    type: NODE_TYPES.EXECUTION,
    label: `执行 · ${gritLevel}`,
    summary: `计划完成率映射韧性：${pct(dim.grit)}`,
    weight: 0.5 + dim.grit * 0.35,
    layer: dim.grit > 0.6 ? CIRCLE_LAYERS.CORE : CIRCLE_LAYERS.SUPPORT,
    angle: 170,
    tags: [gritLevel],
    color: '#10b981',
    emoji: '⚙️',
    metrics: { grit: dim.grit },
  });

  // 社交模式节点
  const socialLevel = dim.social > 0.66 ? '开放联结' : dim.social > 0.38 ? '选择性社交' : '独处优先';
  nodes.push({
    id: 'dim_social',
    type: NODE_TYPES.SOCIAL,
    label: `社交 · ${socialLevel}`,
    summary: `社交开放度：${pct(dim.social)}`,
    weight: 0.45 + dim.social * 0.35,
    layer: dim.social > 0.6 ? CIRCLE_LAYERS.SUPPORT : CIRCLE_LAYERS.EDGE,
    angle: 225,
    tags: [socialLevel],
    color: '#f472b6',
    emoji: '🤝',
    metrics: { social: dim.social },
  });

  // 情绪模式节点
  const emoLevel = dim.emotionStability > 0.7 ? '稳定' : dim.emotionStability > 0.45 ? '可调节' : '敏感';
  nodes.push({
    id: 'dim_emotion',
    type: NODE_TYPES.EMOTION,
    label: `情绪 · ${emoLevel}`,
    summary: `情绪稳定性：${pct(dim.emotionStability)}`,
    weight: 0.5 + (1 - Math.abs(dim.emotionStability - 0.6)) * 0.3,
    layer: dim.emotionStability > 0.55 ? CIRCLE_LAYERS.SUPPORT : CIRCLE_LAYERS.EDGE,
    angle: 280,
    tags: [emoLevel],
    color: '#fb7185',
    emoji: '💫',
    metrics: { emotionStability: dim.emotionStability },
  });

  // 开放探索节点
  const openLevel = dim.openness > 0.66 ? '好奇探索' : dim.openness > 0.38 ? '尝鲜有度' : '专注深挖';
  nodes.push({
    id: 'dim_openness',
    type: NODE_TYPES.HABIT,
    label: `探索 · ${openLevel}`,
    summary: `开放探索度：${pct(dim.openness)}`,
    weight: 0.4 + dim.openness * 0.4,
    layer: dim.openness > 0.6 ? CIRCLE_LAYERS.SUPPORT : CIRCLE_LAYERS.EDGE,
    angle: 330,
    tags: [openLevel],
    color: '#818cf8',
    emoji: '🌱',
    metrics: { openness: dim.openness },
  });

  return nodes;
};

const buildMusicNodes = (musicProfile) => {
  if (!musicProfile || !musicProfile.traits) return [];
  const t = musicProfile.traits || {};
  const nodes = [];

  const mood = t.dominantMood || '平衡';
  const moodScore = (t.moodIndex !== undefined ? t.moodIndex : 0.5);
  nodes.push({
    id: 'music_mood',
    type: NODE_TYPES.MUSIC,
    label: `音乐情绪 · ${mood}`,
    summary: `从歌单情绪分布推断：${pct(moodScore)}`,
    weight: 0.5 + moodScore * 0.2,
    layer: moodScore > 0.6 ? CIRCLE_LAYERS.SUPPORT : CIRCLE_LAYERS.EDGE,
    angle: 60,
    tags: ['音乐气质', mood],
    color: '#c084fc',
    emoji: '🎵',
    metrics: { moodScore },
  });

  const genres = t.topGenres || [];
  if (genres.length) {
    nodes.push({
      id: 'music_genre',
      type: NODE_TYPES.MUSIC,
      label: `曲风偏好 · ${genres[0]}`,
      summary: genres.slice(0, 3).join(' / '),
      weight: 0.52,
      layer: CIRCLE_LAYERS.EDGE,
      angle: 0,
      tags: genres.slice(0, 3),
      color: '#e879f9',
      emoji: '🎧',
      metrics: {},
    });
  }

  const bpm = t.avgBpm || 100;
  const bpmTag = bpm > 130 ? '高频心跳' : bpm > 100 ? '中速节奏' : '慢速呼吸';
  nodes.push({
    id: 'music_bpm',
    type: NODE_TYPES.MUSIC,
    label: `BPM节奏 · ${bpmTag}`,
    summary: `平均 BPM：${Math.round(bpm)}`,
    weight: 0.48,
    layer: CIRCLE_LAYERS.EDGE,
    angle: -60,
    tags: [bpmTag],
    color: '#38bdf8',
    emoji: '🥁',
    metrics: { bpm },
  });

  return nodes;
};

// ========== 4. 构建节点之间的关系（边） ==========

const buildEdges = (nodes, dim, musicProfile) => {
  const edges = [];
  const idMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const add = (fromId, toId, type, strength = 0.5) => {
    if (idMap[fromId] && idMap[toId]) {
      edges.push({ from: fromId, to: toId, type, strength: clamp(strength) });
    }
  };

  // 锚点 → 决策/执行/社交
  const mbtiNode = nodes.find(n => n.type === NODE_TYPES.ANCHOR && n.label.includes('MBTI'));
  if (mbtiNode) {
    add(mbtiNode.id, 'dim_decision', RELATION_TYPES.REINFORCE, 0.85);
    add(mbtiNode.id, 'dim_execution', RELATION_TYPES.BALANCE, 0.6);
    add(mbtiNode.id, 'dim_social', RELATION_TYPES.REINFORCE, 0.75);
    add(mbtiNode.id, 'dim_emotion', RELATION_TYPES.COMPLEMENT, 0.5);
  }
  const tarotNode = nodes.find(n => n.type === NODE_TYPES.ANCHOR && n.label.includes('塔罗'));
  if (tarotNode) {
    add(tarotNode.id, 'dim_emotion', RELATION_TYPES.REINFORCE, 0.7);
    add(tarotNode.id, 'dim_openness', RELATION_TYPES.COMPLEMENT, 0.55);
  }
  const zodiacNode = nodes.find(n => n.type === NODE_TYPES.ANCHOR && n.label.includes('星盘'));
  if (zodiacNode) {
    add(zodiacNode.id, 'dim_social', RELATION_TYPES.REINFORCE, 0.6);
    add(zodiacNode.id, 'dim_emotion', RELATION_TYPES.BALANCE, 0.5);
  }

  // 决策 ↔ 执行
  add('dim_decision', 'dim_execution', RELATION_TYPES.COMPLEMENT, 0.7);

  // 决策 ↔ 情绪（若情绪不稳且风险高 → 冲突）
  if (dim.risk > 0.6 && dim.emotionStability < 0.45) {
    add('dim_decision', 'dim_emotion', RELATION_TYPES.CONFLICT, 0.75);
  } else {
    add('dim_decision', 'dim_emotion', RELATION_TYPES.BALANCE, 0.45);
  }

  // 执行 ↔ 社交
  add('dim_execution', 'dim_social', RELATION_TYPES.REINFORCE, 0.45);

  // 执行 ↔ 探索
  if (dim.grit > 0.7 && dim.openness < 0.4) {
    add('dim_execution', 'dim_openness', RELATION_TYPES.CONFLICT, 0.6);
  } else {
    add('dim_execution', 'dim_openness', RELATION_TYPES.COMPLEMENT, 0.5);
  }

  // 音乐 ↔ 维度
  if (idMap['music_mood']) {
    // 音乐情绪 → 情绪稳定性
    const moodScore = idMap['music_mood'].metrics?.moodScore || 0.5;
    const align = 1 - Math.abs(moodScore - dim.emotionStability);
    add('music_mood', 'dim_emotion', align > 0.7 ? RELATION_TYPES.REINFORCE : RELATION_TYPES.COMPLEMENT, 0.5 + align * 0.25);
    // 音乐情绪 → 决策风险
    add('music_mood', 'dim_decision', RELATION_TYPES.REINFORCE, 0.45 + moodScore * 0.25);
  }
  if (idMap['music_bpm']) {
    const bpm = idMap['music_bpm'].metrics?.bpm || 100;
    const bpmNorm = Math.min(1, Math.max(0, (bpm - 70) / 80));
    // BPM → 决策速度
    add('music_bpm', 'dim_decision', RELATION_TYPES.REINFORCE, 0.45 + Math.abs(bpmNorm - dim.speed) < 0.2 ? 0.75 : 0.45);
  }
  if (idMap['music_genre']) {
    add('music_genre', 'dim_openness', RELATION_TYPES.REINFORCE, 0.6);
  }

  return edges;
};

// ========== 5. 生成三层可视化数据（核心盘 / 能力环 / 探索带） ==========

const buildLayers = (nodes, edges) => {
  const byLayer = { core: [], support: [], edge: [] };
  nodes.forEach(n => { byLayer[n.layer]?.push(n); });

  // 每圈按 angle 排序
  Object.keys(byLayer).forEach(k => {
    byLayer[k].sort((a, b) => (a.angle + 360) % 360 - (b.angle + 360) % 360);
  });

  // 内耗（冲突边数）与合力（强化边数）
  const reinforce = edges.filter(e => e.type === RELATION_TYPES.REINFORCE).length;
  const conflict = edges.filter(e => e.type === RELATION_TYPES.CONFLICT).length;
  const total = Math.max(edges.length, 1);

  return {
    core: { name: '核心盘', nodes: byLayer.core, radius: 90 },
    support: { name: '支撑圈', nodes: byLayer.support, radius: 180 },
    edge: { name: '探索带', nodes: byLayer.edge, radius: 270 },
    harmony: {
      synergy: pctVal(reinforce / total),
      friction: pctVal(conflict / total),
    },
  };
};

// ========== 6. 生成洞察 ==========

const buildInsights = (nodes, edges, dim, layers, musicProfile) => {
  const insights = [];

  // 核心盘构成
  const coreLabels = layers.core.nodes.map(n => n.label).join('、') || '（数据不足，正在沉淀）';
  insights.push({
    level: 'primary',
    title: '你的核心认知盘',
    text: `当前驱动你最稳定的节点是：${coreLabels}。这些节点往往在压力下也不会轻易偏移。`,
  });

  // 合力 vs 内耗
  const { synergy, friction } = layers.harmony;
  if (friction > 30) {
    insights.push({
      level: 'warn',
      title: '认知存在内耗点',
      text: `冲突/牵制关系占比约 ${friction}%，可能体现在"想做 vs 敢做"或"节奏 vs 稳定"之间的反复。识别冲突边并主动校准，可以显著降低决策成本。`,
    });
  } else if (synergy > 55) {
    insights.push({
      level: 'good',
      title: '认知网络协同度高',
      text: `强化 + 互补关系占比约 ${synergy + (edges.filter(e => e.type === RELATION_TYPES.COMPLEMENT).length / Math.max(edges.length,1) * 100 | 0)}%，你的决策和执行链路顺畅，适合把当前模式迁移到新领域。`,
    });
  }

  // 决策 × 韧性
  if (dim.risk > 0.6 && dim.grit > 0.7) {
    insights.push({
      level: 'good',
      title: '进攻型执行组合',
      text: '你既能承担合理风险，又具备把事情收尾的韧性 —— 这是"把雪球滚起来"的典型组合。提醒：在关键节点主动留缓冲区，避免单次过度投入。',
    });
  }
  if (dim.risk < 0.35 && dim.grit < 0.45) {
    insights.push({
      level: 'warn',
      title: '等待与节奏',
      text: '当前风险偏好和韧性都处于偏低区间，适合先用"最小可验证闭环"的方式把一件小事做完整，用正反馈逐步拉高基线。',
    });
  }

  // 音乐 × 行为对齐
  if (musicProfile) {
    insights.push({
      level: musicProfile.source === 'netease' ? 'primary' : 'info',
      title: '音乐画像已纳入认知画圈',
      text: `歌单情绪、曲风与 BPM 已映射到决策速度 / 情绪稳定 / 开放探索三条边。后续你可以继续在音乐板块增加数据，画圈会自动校准。`,
    });
  } else {
    insights.push({
      level: 'info',
      title: '尚未接入音乐画像',
      text: '去「音乐」板块扫码登录网易云，你的情绪与节奏偏好会自动并入认知画圈，让拓扑更完整。',
    });
  }

  // 最薄弱的边缘节点
  const weakest = [...nodes].sort((a, b) => a.weight - b.weight).slice(0, 2);
  if (weakest.length) {
    insights.push({
      level: 'info',
      title: '可以主动浇灌的盲区',
      text: `当前权重较低的节点：${weakest.map(n => n.label).join('、')}。它们不是缺点，而是下一轮自我迭代最容易产生「正反馈复利」的切入点。`,
    });
  }

  return insights;
};

// ========== 工具函数 ==========
const pct = (v) => `${Math.round(clamp(v) * 100)}%`;
const pctVal = (v) => Math.round(clamp(v) * 100);

// ========== 主入口：生成完整认知画圈 ==========

export function buildCognitiveCircle(options = {}) {
  try {
    const { forceRefresh = false, injectMusicVector = null } = options;

    if (!forceRefresh) {
      const cached = readCache();
      if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
        return cached.data;
      }
    }

    const sourcesBundle = collectAllSources();
    let baseDim = computeBaseDimensions(sourcesBundle);

    // P1-3/4: 塔罗 × 脉轮权重注入
    baseDim = applyModifiers(baseDim, sourcesBundle.anchors);

    // 若注入音乐向量（来自 musicProfileEngine.mergeMusicVector）则融合
    const finalDim = injectMusicVector && sourcesBundle.musicProfile
      ? mergeMusicVectorForDim(baseDim, injectMusicVector)
      : baseDim;

    const anchorNodes = buildAnchorNodes(sourcesBundle);
    const dimNodes = buildDimensionNodes(finalDim);
    const musicNodes = buildMusicNodes(sourcesBundle.musicProfile);
    const nodes = [...anchorNodes, ...dimNodes, ...musicNodes];

    const edges = buildEdges(nodes, finalDim, sourcesBundle.musicProfile);
    const layers = buildLayers(nodes, edges);
    const insights = buildInsights(nodes, edges, finalDim, layers, sourcesBundle.musicProfile);

    const result = {
      timestamp: Date.now(),
      sources: sourcesBundle.sources,
      dimensions: finalDim,
      nodes,
      edges,
      layers,
      insights,
      stats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        anchorCount: anchorNodes.length,
        musicCount: musicNodes.length,
      },
    };

    writeCache({ timestamp: Date.now(), data: result });
    logger.info('[CognitiveCircle] 认知画圈构建完成', result.stats);
    return result;
  } catch (e) {
    logger.error('[CognitiveCircle] 构建失败', e);
    return fallbackCircle();
  }
}

const mergeMusicVectorForDim = (baseDim, musicVector) => {
  // 复用 musicProfileEngine 的融合权重逻辑
  const mapped = {};
  if (musicVector.riskPreference !== undefined) mapped.risk = musicVector.riskPreference;
  if (musicVector.decisionSpeed !== undefined) mapped.speed = musicVector.decisionSpeed;
  if (musicVector.emotionalStability !== undefined) mapped.emotionStability = musicVector.emotionalStability;
  if (musicVector.openness !== undefined) mapped.openness = musicVector.openness;
  if (musicVector.socialPreference !== undefined) mapped.social = musicVector.socialPreference;
  if (musicVector.persistence !== undefined) mapped.grit = musicVector.persistence;
  return mergeMusicVector(baseDim, mapped, 0.3);
};

const fallbackCircle = () => ({
  timestamp: Date.now(),
  sources: ['本地默认数据'],
  dimensions: { risk: 0.5, speed: 0.5, grit: 0.5, social: 0.5, emotionStability: 0.5, openness: 0.5 },
  nodes: [
    { id: 'demo_core', type: NODE_TYPES.ANCHOR, label: '认知核心 · 数据累积中', summary: '完成更多行为记录后，画圈会自动成形', weight: 0.9, layer: CIRCLE_LAYERS.CORE, angle: 0, tags: ['初始'], color: '#D4AF37', emoji: '🪐' },
    { id: 'demo_s1', type: NODE_TYPES.DECISION, label: '决策模式', summary: '等待数据', weight: 0.6, layer: CIRCLE_LAYERS.SUPPORT, angle: 120, tags: [], color: '#22d3ee', emoji: '🎯' },
    { id: 'demo_s2', type: NODE_TYPES.EXECUTION, label: '执行模式', summary: '等待数据', weight: 0.6, layer: CIRCLE_LAYERS.SUPPORT, angle: 240, tags: [], color: '#10b981', emoji: '⚙️' },
  ],
  edges: [
    { from: 'demo_core', to: 'demo_s1', type: RELATION_TYPES.REINFORCE, strength: 0.6 },
    { from: 'demo_core', to: 'demo_s2', type: RELATION_TYPES.REINFORCE, strength: 0.6 },
  ],
  layers: {
    core: { name: '核心盘', nodes: [{ id: 'demo_core' }], radius: 90 },
    support: { name: '支撑圈', nodes: [{ id: 'demo_s1' }, { id: 'demo_s2' }], radius: 180 },
    edge: { name: '探索带', nodes: [], radius: 270 },
    harmony: { synergy: 50, friction: 0 },
  },
  insights: [
    { level: 'info', title: '认知画圈初始化', text: '去玩一局德州、记一次健身或登录网易云，你的认知节点会逐渐长出来。' },
  ],
  stats: { nodeCount: 3, edgeCount: 2, anchorCount: 1, musicCount: 0 },
});

export const cognitiveCircleEngine = {
  build: buildCognitiveCircle,
  NODE_TYPES,
  RELATION_TYPES,
  CIRCLE_LAYERS,
};

export default cognitiveCircleEngine;
