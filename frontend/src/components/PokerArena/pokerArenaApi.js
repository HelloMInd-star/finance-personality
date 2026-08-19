// ============================================================
// 扑克竞技场 · API 封装 + 通用决策采集 schema
// 牌局真跑在 poker-egg Railway 引擎（HTTP 轮询驱动，免 WebSocket）
// ============================================================

export const API_BASE = 'https://poker-egg-fullstack-production.up.railway.app';

// 16 型对手速查（与 poker-egg personalities.py 同源）
export const OPPONENTS = {
  INFJ: { archetype: '诗意弈者', style: '直觉先行 · 高频诈唬 · 情绪敏感' },
  INFP: { archetype: '诗意弈者', style: '直觉先行 · 高频诈唬 · 情绪敏感' },
  ENFJ: { archetype: '诗意弈者', style: '主动社交 · 情绪激励 · 易受影响' },
  ENFP: { archetype: '诗意弈者', style: '进攻性强 · 全下频率高 · 最易tilt' },
  INTJ: { archetype: '算度大师', style: '深思熟虑 · 低诈唬 · 抗噪最强' },
  INTP: { archetype: '算度大师', style: '长考分析 · 收局犹豫 · 抗噪极强' },
  ENTJ: { archetype: '算度大师', style: '高逻辑高进攻 · 果断收局' },
  ENTP: { archetype: '算度大师', style: '高直觉高逻辑 · 最会诈唬' },
  ISTJ: { archetype: '阵地守将', style: '稳扎稳打 · 极少诈唬 · 耐心等牌' },
  ISFJ: { archetype: '阵地守将', style: '情绪敏感 · 极少加注 · 锅控极强' },
  ESTJ: { archetype: '阵地守将', style: '高进攻高逻辑 · 果断管理' },
  ESFJ: { archetype: '阵地守将', style: '情绪导向 · 跟注为主 · 锅控极强' },
  ISTP: { archetype: '战术猎手', style: '战术敏锐 · 高频诈唬 · 随势而变' },
  ISFP: { archetype: '战术猎手', style: '感觉先行 · 高频诈唬 · 锅控最弱' },
  ESTP: { archetype: '战术猎手', style: '最高进攻 · 高诈唬 · 最不控池' },
  ESFP: { archetype: '战术猎手', style: '最高诈唬 · 情绪驱动 · 最易tilt' },
};

export const OPPONENT_GROUPS = [
  { group: 'NT 紫人 · 算度大师', types: ['INTJ', 'INTP', 'ENTJ', 'ENTP'] },
  { group: 'NF 绿人 · 诗意弈者', types: ['INFJ', 'INFP', 'ENFJ', 'ENFP'] },
  { group: 'SJ 蓝人 · 阵地守将', types: ['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'] },
  { group: 'SP 黄人 · 战术猎手', types: ['ISTP', 'ISFP', 'ESTP', 'ESFP'] },
];

async function req(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`引擎错误 ${res.status}: ${text.slice(0, 120)}`);
  }
  const json = await res.json();
  if (!json.success) throw new Error(json.detail || '引擎返回失败');
  return json.data;
}

export const arenaApi = {
  createGame: (playerName, personality) =>
    req('/api/game/create', {
      method: 'POST',
      body: JSON.stringify({ player_name: playerName, ai_difficulty: 'medium', ai_personality: personality, auto_next_hand: false }),
    }),
  startGame: (gid) => req(`/api/game/${gid}/start`, { method: 'POST' }),
  getState: (gid) => req(`/api/game/${gid}`),
  postAction: (gid, pid, actionType, amount = 0) =>
    req(`/api/game/${gid}/action`, {
      method: 'POST',
      body: JSON.stringify({ player_id: pid, action_type: actionType, amount }),
    }),
  getAnalysis: (gid, pid) => req(`/api/game/${gid}/analysis?player_id=${pid}`),
};

// ============================================================
// 本地牌力估算（0-1 启发式，策略编译时可用真胜率回校）
// ============================================================
const RANK_VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };

export function estimateHandStrength(holeCards, board) {
  if (!holeCards || holeCards.length < 2) return 0.5;
  const [c1, c2] = holeCards;
  const r1 = c1.rank_value || RANK_VAL[c1.rank] || 7;
  const r2 = c2.rank_value || RANK_VAL[c2.rank] || 7;
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  const suited = c1.suit === c2.suit;
  const pair = r1 === r2;

  if (!board || board.length === 0) {
    // 翻前启发：对子底分高，高牌/同花/连张加分
    let s = 0.15 + (hi / 14) * 0.3 + (lo / 14) * 0.15;
    if (pair) s = 0.5 + (r1 / 14) * 0.4;
    else {
      if (suited) s += 0.06;
      if (hi - lo === 1) s += 0.05; // 连张
      if (hi === 14) s += 0.08; // A
    }
    return Math.min(0.95, Math.max(0.05, s));
  }

  // 翻后：统计击中
  const all = [...holeCards, ...board];
  const ranks = all.map((c) => c.rank_value || RANK_VAL[c.rank] || 7);
  const suits = all.map((c) => c.suit);
  const boardRanks = board.map((c) => c.rank_value || RANK_VAL[c.rank] || 7);

  const count = {};
  ranks.forEach((r) => { count[r] = (count[r] || 0) + 1; });
  const groups = Object.values(count).sort((a, b) => b - a);

  const suitCount = {};
  suits.forEach((s) => { suitCount[s] = (suitCount[s] || 0) + 1; });
  const maxSuit = Math.max(...Object.values(suitCount));

  // 顺子检测（含 A 低顺）
  const uniq = [...new Set(ranks)].sort((a, b) => a - b);
  let straight = false;
  for (let i = 0; i + 4 < uniq.length + 1; i++) {
    if (uniq[i + 4] && uniq[i + 4] - uniq[i] === 4) { straight = true; break; }
  }
  if (!straight && uniq.includes(14) && [2, 3, 4, 5].every((r) => uniq.includes(r))) straight = true;

  const holePairBoard = boardRanks.includes(r1) || boardRanks.includes(r2);

  let s;
  if (groups[0] === 4) s = 0.97;
  else if (groups[0] === 3 && groups[1] >= 2) s = 0.93;
  else if (maxSuit >= 5) s = 0.88;
  else if (straight) s = 0.85;
  else if (groups[0] === 3) s = 0.78;
  else if (groups[0] === 2 && groups[1] === 2) s = 0.68;
  else if (groups[0] === 2) s = holePairBoard ? 0.45 + (hi / 14) * 0.15 : 0.55;
  else {
    s = 0.2 + (hi / 14) * 0.15;
    if (maxSuit === 4) s += 0.12; // 听花
  }
  return Math.min(0.97, Math.max(0.05, s));
}

// ============================================================
// 通用决策采集 schema（5.1 埋点 · 5.2 策略编译的原材料）
// 字段按「通用决策上下文」设计：可映射到扑克外的小游戏
// ============================================================
export function buildDecisionLog({
  gameId, handSeq, stage, holeCards, board, pot, toCall, myChips,
  position, streak, decisionMs, action, raisePct, opponent,
}) {
  return {
    v: 1,
    gameId,
    handSeq,
    ts: Date.now(),
    stage,                                   // preflop|flop|turn|river
    situation: estimateHandStrength(holeCards, board), // 局势评估 0-1
    riskReward: pot > 0 ? Math.min(1, toCall / pot) : 0, // 风险回报比
    position,                                // late|early
    streak,                                  // +连赢 / -连输
    decisionMs,                              // 决策时长（自信度探针）
    action,                                  // fold|check|call|raise|allin
    raisePct: raisePct ?? null,              // 加注相对底池比例
    ctx: {
      pot,
      toCall,
      myChips,
      boardCount: board?.length || 0,
      opponent,
    },
  };
}

const DECISION_KEY = 'poker_decisions';

export function appendDecision(log) {
  try {
    const raw = localStorage.getItem(DECISION_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(log);
    if (arr.length > 500) arr.splice(0, arr.length - 500);
    localStorage.setItem(DECISION_KEY, JSON.stringify(arr));
  } catch (e) { /* 存储满则静默 */ }
}

export function getDecisions() {
  try {
    return JSON.parse(localStorage.getItem(DECISION_KEY) || '[]');
  } catch (e) {
    return [];
  }
}
