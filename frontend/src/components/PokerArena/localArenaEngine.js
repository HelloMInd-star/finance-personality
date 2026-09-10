/**
 * 午夜竞技场 · 本地决策引擎
 * ============================================
 * 1v1 德州扑克（真人 vs MBTI 人格 AI）
 * - 零后端依赖：发牌 / 盲注 / 下注轮 / 摊牌结算全部在浏览器本地完成
 * - 接口与远端 arenaApi 同形：createGame / startGame / getState / postAction / getAnalysis
 * - 16 型 MBTI 对手 → 差异化博弈策略（牌力 + 底池赔率 + 人格参数 + tilt 情绪）
 * - 每手决策可被 buildDecisionLog 采集，作为「策略编译」原材料
 * - 单例内存状态：gameId → LocalGame，页面内切换对手互不干扰
 */

// ═══════════════ 卡牌工具 ═══════════════

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const RANK_VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLOR = { '♠': 'black', '♥': 'red', '♦': 'red', '♣': 'black' };

function makeCard(rank, suit) {
  return { rank, suit, color: SUIT_COLOR[suit], rank_value: RANK_VAL[rank] };
}

function createDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANK_ORDER) deck.push(makeCard(r, s));
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════ 手牌评估 ═══════════════

// 5 张牌型评估 → { cat, name, tie }
// cat: 8 同花顺 / 7 四条 / 6 葫芦 / 5 同花 / 4 顺子 / 3 三条 / 2 两对 / 1 一对 / 0 高牌
// tie: 用于逐位比较的降序数组
const CAT_NAME = {
  8: 'Straight Flush', 7: 'Four of a Kind', 6: 'Full House', 5: 'Flush', 4: 'Straight',
  3: 'Three of a Kind', 2: 'Two Pair', 1: 'One Pair', 0: 'High Card',
};

function eval5(cards) {
  const ranks = cards.map((c) => RANK_VAL[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const countMap = {};
  ranks.forEach((r) => { countMap[r] = (countMap[r] || 0) + 1; });
  const groups = Object.entries(countMap)
    .map(([r, c]) => ({ r: Number(r), c }))
    .sort((a, b) => b.c - a.c || b.r - a.r);

  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = 0;
  if (uniq.length === 5 && uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
  else if (uniq.length === 5 && uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2) {
    straightHigh = 5; // A-5-4-3-2 低顺
  }

  if (isFlush && straightHigh) {
    return { cat: 8, name: CAT_NAME[8], tie: [straightHigh] };
  }
  if (groups[0].c === 4) {
    const kicker = groups[1].r;
    return { cat: 7, name: CAT_NAME[7], tie: [groups[0].r, kicker] };
  }
  if (groups[0].c === 3 && groups[1].c === 2) {
    return { cat: 6, name: CAT_NAME[6], tie: [groups[0].r, groups[1].r] };
  }
  if (isFlush) {
    return { cat: 5, name: CAT_NAME[5], tie: ranks };
  }
  if (straightHigh) {
    return { cat: 4, name: CAT_NAME[4], tie: [straightHigh] };
  }
  if (groups[0].c === 3) {
    const kickers = groups.slice(1).map((g) => g.r);
    return { cat: 3, name: CAT_NAME[3], tie: [groups[0].r, ...kickers] };
  }
  if (groups[0].c === 2 && groups[1].c === 2) {
    const hi = Math.max(groups[0].r, groups[1].r);
    const lo = Math.min(groups[0].r, groups[1].r);
    const kicker = groups[2].r;
    return { cat: 2, name: CAT_NAME[2], tie: [hi, lo, kicker] };
  }
  if (groups[0].c === 2) {
    const kickers = groups.slice(1).map((g) => g.r);
    return { cat: 1, name: CAT_NAME[1], tie: [groups[0].r, ...kickers] };
  }
  return { cat: 0, name: CAT_NAME[0], tie: ranks };
}

// 任意张数选最强 5 张牌型（5 张直接用；6 张 C(6,5)；7 张 C(7,5)）
function bestHand(cards7) {
  const n = cards7.length;
  if (n < 5) {
    // 翻前/翻牌未满 5 张：用已有公共牌 + 底牌评估（只做展示用）
    return eval5(cards7);
  }
  if (n === 5) return eval5(cards7);
  let best = null;
  if (n === 6) {
    for (let skip = 0; skip < 6; skip++) {
      const five = cards7.filter((_, k) => k !== skip);
      const r = eval5(five);
      if (!best || compareHand(r, best) > 0) best = r;
    }
    return best;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const five = [];
      for (let k = 0; k < n; k++) if (k !== i && k !== j) five.push(cards7[k]);
      const r = eval5(five);
      if (!best || compareHand(r, best) > 0) best = r;
    }
  }
  return best;
}

// 比较两手：>0 表示 a 胜，<0 表示 b 胜，0 平
function compareHand(a, b) {
  if (a.cat !== b.cat) return a.cat - b.cat;
  for (let i = 0; i < Math.max(a.tie.length, b.tie.length); i++) {
    const av = a.tie[i] || 0;
    const bv = b.tie[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// 牌力启发式 0-1（供 AI 决策 + Kelly 面板近似胜率）
function estimateStrength(hole, board = []) {
  if (!hole || hole.length < 2) return 0.5;
  const all = [...hole, ...board];
  if (board.length >= 3) {
    const h = bestHand(all);
    const base = { 0: 0.3, 1: 0.52, 2: 0.68, 3: 0.8, 4: 0.87, 5: 0.9, 6: 0.94, 7: 0.97, 8: 0.99 }[h.cat];
    // 同 cat 内按 tie 首位微调
    const t = h.tie[0] || 7;
    const adj = ((t - 7) / 14) * 0.06;
    return Math.min(0.995, Math.max(0.05, base + adj));
  }
  // 翻前：对子/高张/同花/连张启发
  const [c1, c2] = hole;
  const r1 = c1.rank_value || RANK_VAL[c1.rank] || 7;
  const r2 = c2.rank_value || RANK_VAL[c2.rank] || 7;
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  let s = 0.15 + (hi / 14) * 0.3 + (lo / 14) * 0.15;
  if (r1 === r2) s = 0.55 + (r1 / 14) * 0.35;
  else {
    if (c1.suit === c2.suit) s += 0.06;
    if (hi - lo === 1) s += 0.05;
    if (hi === 14) s += 0.08;
  }
  return Math.min(0.95, Math.max(0.05, s));
}

// ═══════════════ MBTI 16 型对手策略 ═══════════════
// 参数语义（0-1 概率权重）：
//   raiseFreq  主动加注/下注倾向   callFreq  跟注倾向   foldFreq  弃牌倾向
//   bluffFreq  诈唬倾向（弱牌加注）  allinBias 全下加成   tilt      连败后激进放大
//   thinkMs    思考节奏（毫秒基准）

const GRP = {
  NT: { raiseFreq: 0.22, callFreq: 0.45, foldFreq: 0.28, bluffFreq: 0.08, allinBias: 0.06, tilt: 0.03, thinkMs: 1000 },
  NF: { raiseFreq: 0.32, callFreq: 0.4, foldFreq: 0.22, bluffFreq: 0.16, allinBias: 0.12, tilt: 0.12, thinkMs: 1200 },
  SJ: { raiseFreq: 0.14, callFreq: 0.4, foldFreq: 0.42, bluffFreq: 0.04, allinBias: 0.03, tilt: 0.05, thinkMs: 900 },
  SP: { raiseFreq: 0.34, callFreq: 0.38, foldFreq: 0.22, bluffFreq: 0.2, allinBias: 0.15, tilt: 0.15, thinkMs: 800 },
};

// 每型微调（delta 叠加到组模板）
const TYPE_DELTA = {
  INTJ: { bluffFreq: -0.03, tilt: -0.02, callFreq: +0.04 },
  INTP: { raiseFreq: -0.03, tilt: -0.02 },
  ENTJ: { raiseFreq: +0.05, callFreq: -0.05 },
  ENTP: { bluffFreq: +0.06, allinBias: +0.04 },
  INFJ: { bluffFreq: -0.04, callFreq: +0.05 },
  INFP: { tilt: +0.04, bluffFreq: +0.02 },
  ENFJ: { callFreq: +0.05, raiseFreq: -0.03 },
  ENFP: { allinBias: +0.08, bluffFreq: +0.05, tilt: +0.04 },
  ISTJ: { bluffFreq: -0.02, foldFreq: +0.04, tilt: -0.02 },
  ISFJ: { callFreq: +0.06, foldFreq: +0.02, raiseFreq: -0.04 },
  ESTJ: { raiseFreq: +0.03, foldFreq: +0.03 },
  ESFJ: { callFreq: +0.08, bluffFreq: -0.02 },
  ISTP: { bluffFreq: +0.04, raiseFreq: +0.02 },
  ISFP: { bluffFreq: +0.05, foldFreq: +0.04 },
  ESTP: { raiseFreq: +0.05, bluffFreq: +0.04, allinBias: +0.05, tilt: +0.02 },
  ESFP: { bluffFreq: +0.08, allinBias: +0.05, tilt: +0.06, callFreq: -0.04 },
};

// 与 pokerArenaApi.OPPONENTS 文案同源
export const OPPONENTS = {
  INTJ: { archetype: '算度大师', style: '深思熟虑 · 低诈唬 · 抗噪最强' },
  INTP: { archetype: '算度大师', style: '长考分析 · 收局犹豫 · 抗噪极强' },
  ENTJ: { archetype: '算度大师', style: '高逻辑高进攻 · 果断收局' },
  ENTP: { archetype: '算度大师', style: '高直觉高逻辑 · 最会诈唬' },
  INFJ: { archetype: '诗意弈者', style: '直觉先行 · 高频诈唬 · 情绪敏感' },
  INFP: { archetype: '诗意弈者', style: '直觉先行 · 高频诈唬 · 情绪敏感' },
  ENFJ: { archetype: '诗意弈者', style: '主动社交 · 情绪激励 · 易受影响' },
  ENFP: { archetype: '诗意弈者', style: '进攻性强 · 全下频率高 · 最易tilt' },
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

function buildProfile(type) {
  const group = ['INTJ', 'INTP', 'ENTJ', 'ENTP'].includes(type) ? GRP.NT
    : ['INFJ', 'INFP', 'ENFJ', 'ENFP'].includes(type) ? GRP.NF
    : ['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'].includes(type) ? GRP.SJ : GRP.SP;
  const delta = TYPE_DELTA[type] || {};
  const p = {};
  for (const k of Object.keys(group)) p[k] = group[k];
  for (const k of Object.keys(delta)) p[k] = Math.min(0.95, Math.max(0.01, p[k] + delta[k]));
  return p;
}

// ═══════════════ 1v1 牌局状态机 ═══════════════

const SMALL_BLIND = 20;
const BIG_BLIND = 40;
const START_CHIPS = 1000;

const games = new Map(); // gameId → game
const aiTimers = new Map(); // gameId → timerId
let idSeq = 0;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function gameFromId(gameId) {
  const g = games.get(gameId);
  if (!g) throw new Error(`牌局不存在: ${gameId}`);
  return g;
}

// ── 创建 / 开局 ──

function createGame(playerName, personality) {
  idSeq += 1;
  const gameId = `local-${Date.now()}-${idSeq}`;
  const playerId = `p-${idSeq}`;
  const aiId = `ai-${idSeq}`;
  const game = {
    id: gameId,
    playerName: playerName || '酒馆客',
    aiPersonality: personality || 'INTJ',
    players: [
      { id: playerId, name: playerName || '酒馆客', is_ai: false, chips: START_CHIPS, bet: 0, folded: false, all_in: false, hole_cards: [], ai_personality: null, is_dealer: true, is_sb: true, tilt: 0 },
      { id: aiId, name: `${personality || 'INTJ'} · ${OPPONENTS[personality]?.archetype || '对手'}`, is_ai: true, chips: START_CHIPS, bet: 0, folded: false, all_in: false, hole_cards: [], ai_personality: personality || 'INTJ', is_dealer: false, is_sb: false, tilt: 0 },
    ],
    dealer: 0,          // 第一手真人庄
    current_player: -1,
    current_bet: 0,
    min_raise: BIG_BLIND * 2,
    pot: 0,
    board: [],
    stage: 'preflop',
    hand_over: false,
    hand_result: null,
    hand_seq: 0,
    big_blind: BIG_BLIND,
    small_blind: SMALL_BLIND,
  };
  games.set(gameId, game);
  startHand(game);
  return { game_id: gameId, player_id: playerId, ai_player_id: aiId };
}

function startHand(game) {
  game.dealer = 1 - game.dealer; // 每手轮换庄家
  const deck = shuffle(createDeck());
  for (const p of game.players) {
    p.bet = 0;
    p.folded = false;
    p.all_in = false;
    p.hole_cards = [deck.pop(), deck.pop()];
  }
  game.board = [];
  game.pot = 0;
  game.current_bet = 0;
  game.min_raise = BIG_BLIND * 2;
  game.stage = 'preflop';
  game.hand_over = false;
  game.hand_result = null;
  game.hand_seq += 1;

  // 盲注：dealer = SB（翻前先行动），另一家 BB
  const sbIdx = game.dealer;
  const bbIdx = 1 - game.dealer;
  const sb = game.players[sbIdx];
  const bb = game.players[bbIdx];
  game.players[sbIdx].is_dealer = true;
  game.players[sbIdx].is_sb = true;
  game.players[bbIdx].is_dealer = false;
  game.players[bbIdx].is_sb = false;
  const sbPay = Math.min(SMALL_BLIND, sb.chips);
  const bbPay = Math.min(BIG_BLIND, bb.chips);
  sb.bet = sbPay; sb.chips -= sbPay;
  bb.bet = bbPay; bb.chips -= bbPay;
  game.pot = sbPay + bbPay;
  game.current_bet = bbPay;
  if (bbPay > 0 && bbPay > sbPay) game.current_bet = bbPay;
  game.min_raise = game.current_bet + BIG_BLIND;
  if (sb.chips === 0) sb.all_in = true;
  if (bb.chips === 0) bb.all_in = true;

  game.current_player = sbIdx; // 翻前 SB 先行动
  // 若先行动者已全下（短码），直接推进
  if (game.players[game.current_player].all_in) {
    advanceOrNext(game);
  } else if (game.players[game.current_player].is_ai) {
    scheduleAI(game);
  }
}

function startGame(gameId) {
  const g = gameFromId(gameId);
  clearTimer(gameId);
  startHand(g);
  return getState(gameId);
}

// ── 行动处理 ──

function collectBets(game) {
  // pot 语义 = 累计下注总额（bet 已实时并入 pot），这里只清空当前街 bet 指针
  for (const p of game.players) p.bet = 0;
  game.current_bet = 0;
}

function applyAction(game, playerIdx, type, amount) {
  const p = game.players[playerIdx];
  const toCall = game.current_bet - p.bet;
  if (p.folded || p.all_in) return;

  switch (type) {
    case 'fold': {
      p.folded = true;
      const winnerIdx = 1 - playerIdx;
      const w = game.players[winnerIdx];
      const pot = game.pot;
      endHand(game, {
        winners: [{ id: w.id, player_id: w.id }],
        win_type: 'fold',
        pot,
        hand_name: null,
      });
      return;
    }
    case 'check': {
      if (toCall > 0) return; // 非法 check，忽略
      advanceOrNext(game);
      return;
    }
    case 'call': {
      const pay = Math.min(toCall, p.chips);
      p.bet += pay;
      p.chips -= pay;
      game.pot += pay;
      if (p.chips === 0) p.all_in = true;
      // 两家 bet 相等 或 都 all-in → 街结束
      const bothCovered = game.players[0].bet === game.players[1].bet;
      const anyAllIn = game.players.some((x) => x.all_in);
      if (bothCovered || (anyAllIn && p.all_in)) {
        advanceOrNext(game);
      } else {
        nextTurn(game);
      }
      return;
    }
    case 'raise': {
      let target = Math.max(Math.round(amount || 0), game.min_raise);
      target = Math.min(target, p.chips + p.bet); // 不能超过所有筹码
      const pay = target - p.bet;
      if (pay <= 0) {
        // 筹码不足加注 → 当 call / all-in 处理
        const callPay = Math.min(toCall, p.chips);
        p.bet += callPay;
        p.chips -= callPay;
        game.pot += callPay;
        if (p.chips === 0) p.all_in = true;
        const bothCovered = game.players[0].bet === game.players[1].bet;
        if (bothCovered || p.all_in) advanceOrNext(game);
        else nextTurn(game);
        return;
      }
      p.bet = target;
      p.chips -= pay;
      game.pot += pay;
      if (p.chips === 0) p.all_in = true;
      game.current_bet = p.bet;
      game.min_raise = p.bet + BIG_BLIND;
      nextTurn(game);
      return;
    }
    case 'allin': {
      const pay = p.chips;
      p.bet += pay;
      p.chips = 0;
      game.pot += pay;
      p.all_in = true;
      game.current_bet = Math.max(game.current_bet, p.bet);
      game.min_raise = Math.max(game.min_raise, p.bet + BIG_BLIND);
      advanceOrNext(game);
      return;
    }
    default:
      return;
  }
}

function nextTurn(game) {
  const other = 1 - game.current_player;
  const op = game.players[other];
  if (op.folded || op.all_in) {
    // 对方无法行动 → 街应已结束（理论上不会到这里）
    advanceOrNext(game);
    return;
  }
  game.current_player = other;
  if (op.is_ai) scheduleAI(game);
}

// 判断当前街是否结束；未结束则轮到下一位
function advanceOrNext(game) {
  const alive = game.players.filter((p) => !p.folded);
  if (alive.length < 2) {
    const w = alive[0];
    const pot = game.pot;
    endHand(game, {
      winners: [{ id: w.id, player_id: w.id }],
      win_type: 'fold',
      pot,
      hand_name: null,
    });
    return;
  }
  if (game.players.some((p) => p.all_in)) {
    // 有人全下：发完剩余公共牌直接摊牌
    dealRemainingAndShowdown(game);
    return;
  }
  // 两家 bet 相等 且 有人下注 → 推进下一条街
  if (game.players[0].bet === game.players[1].bet && game.current_bet > 0) {
    advanceStreet(game);
    return;
  }
  // 不相等 → 轮到另一家补齐
  const other = 1 - game.current_player;
  if (game.players[other].folded || game.players[other].all_in) {
    advanceStreet(game);
    return;
  }
  game.current_player = other;
  if (game.players[other].is_ai) scheduleAI(game);
}

function advanceStreet(game) {
  // 清空当前街 bet 指针（pot 已实时累计）
  collectBets(game);
  game.min_raise = BIG_BLIND * 2;

  if (game.stage === 'preflop') {
    game.stage = 'flop';
    for (let i = 0; i < 3; i++) game.board.push(popBoardCard(game));
  } else if (game.stage === 'flop') {
    game.stage = 'turn';
    game.board.push(popBoardCard(game));
  } else if (game.stage === 'turn') {
    game.stage = 'river';
    game.board.push(popBoardCard(game));
  } else if (game.stage === 'river') {
    showdown(game);
    return;
  }

  // 翻后：非 dealer（BB）先行动
  game.current_player = 1 - game.dealer;
  const first = game.players[game.current_player];
  if (first.folded || first.all_in) {
    // 先手不能行动 → 看另一家
    const other = game.players[1 - game.current_player];
    if (other.folded || other.all_in) {
      // 理论上不该发生；若发生直接摊牌
      showdown(game);
      return;
    }
    game.current_player = 1 - game.current_player;
    if (game.players[game.current_player].is_ai) scheduleAI(game);
    return;
  }
  if (first.is_ai) scheduleAI(game);
}

function popBoardCard(game) {
  // 从剩余牌堆取一张（用当前未用的牌堆：简化 - 重新洗一副，取一张不重复的）
  // 由于每次发牌独立洗牌可能重复，这里维护每手牌堆
  if (!game._deck || game._deck.length === 0) {
    game._deck = shuffle(createDeck());
    const used = new Set();
    for (const p of game.players) for (const c of p.hole_cards) used.add(`${c.rank}${c.suit}`);
    game._deck = game._deck.filter((c) => !used.has(`${c.rank}${c.suit}`));
  }
  return game._deck.pop();
}

function dealRemainingAndShowdown(game) {
  // 收 bet 进底池
  collectBets(game);
  // 补齐公共牌
  const need = { preflop: 3, flop: 2, turn: 1, river: 0 }[game.stage] || 0;
  for (let i = 0; i < need; i++) game.board.push(popBoardCard(game));
  if (game.stage === 'preflop') game.stage = 'flop';
  else if (game.stage === 'flop') game.stage = 'turn';
  else if (game.stage === 'turn') game.stage = 'river';
  showdown(game);
}

function showdown(game) {
  game.stage = 'showdown';
  const h0 = bestHand([...game.players[0].hole_cards, ...game.board]);
  const h1 = bestHand([...game.players[1].hole_cards, ...game.board]);
  const cmp = compareHand(h0, h1);
  let winners;
  if (cmp === 0) {
    winners = game.players.map((p) => ({ id: p.id, player_id: p.id }));
  } else {
    const wIdx = cmp > 0 ? 0 : 1;
    winners = [{ id: game.players[wIdx].id, player_id: game.players[wIdx].id }];
  }
  const pot = game.pot;
  endHand(game, {
    winners,
    win_type: 'showdown',
    pot,
    hand_name: cmp === 0 ? null : (cmp > 0 ? h0.name : h1.name),
  });
}

function endHand(game, result) {
  // 赢家收池（平局均分）
  const share = Math.floor(result.pot / result.winners.length);
  for (const w of result.winners) {
    const wp = game.players.find((p) => p.id === w.player_id);
    if (wp) wp.chips += share;
  }
  // tilt 更新
  const winIds = new Set(result.winners.map((w) => w.player_id));
  for (const p of game.players) {
    if (winIds.has(p.id)) p.tilt = 0;
    else p.tilt += 1;
  }
  game.pot = 0;
  game.hand_over = true;
  game.hand_result = {
    winners: result.winners,
    win_type: result.win_type,
    pot: result.pot,
    hand_name: result.hand_name,
  };
  game.current_player = -1;
  clearTimer(game.id);
}

// ── AI 决策 ──

function aiDecide(game, aiIdx) {
  const p = game.players[aiIdx];
  const profile = buildProfile(p.ai_personality);
  const toCall = game.current_bet - p.bet;
  const strength = estimateStrength(p.hole_cards, game.board);
  const potOdds = toCall > 0 ? Math.min(1, toCall / (game.pot + toCall)) : 0;

  // tilt 修正：连败后更激进（加注/诈唬/全下放大）
  const tiltBoost = Math.min(0.3, p.tilt * profile.tilt);
  const effRaise = clamp(profile.raiseFreq + tiltBoost, 0.02, 0.9);
  const effBluff = clamp(profile.bluffFreq + tiltBoost * 0.8, 0.01, 0.6);
  const effCall = clamp(profile.callFreq - tiltBoost * 0.2, 0.02, 0.9);
  const effFold = clamp(profile.foldFreq - tiltBoost * 0.3, 0.02, 0.9);

  const raiseTarget = (mult) => {
    const target = Math.max(game.min_raise, Math.round(game.current_bet + BIG_BLIND * mult));
    return Math.min(target, p.chips + p.bet);
  };
  const maybeAllIn = () => {
    // 短码或高全下倾向 → 直接 all-in
    const effChips = p.chips;
    if (effChips <= BIG_BLIND * 2) return true;
    return Math.random() < profile.allinBias + tiltBoost * 0.3;
  };

  if (toCall === 0) {
    // 可过牌或下注
    const betProb = strength > 0.65 ? effRaise * 1.5 : strength > 0.45 ? effRaise * 0.8 : effBluff * 0.5;
    if (Math.random() < clamp(betProb, 0.03, 0.92)) {
      if (maybeAllIn()) return { type: 'allin' };
      return { type: 'raise', amount: raiseTarget(2) };
    }
    return { type: 'check' };
  }

  if (strength >= 0.75) {
    // 强牌：加注为主
    const r = Math.random();
    if (r < effRaise * 1.4) {
      if (maybeAllIn()) return { type: 'allin' };
      return { type: 'raise', amount: raiseTarget(2 + Math.random() * 2) };
    }
    return { type: 'call' };
  }
  if (strength >= 0.55) {
    // 中等偏强：看赔率
    const r = Math.random();
    if (r < effRaise * 0.8) {
      if (maybeAllIn()) return { type: 'allin' };
      return { type: 'raise', amount: raiseTarget(1.5) };
    }
    if (r < effRaise * 0.8 + effCall * 1.1) return { type: 'call' };
    if (potOdds > 0.2) return { type: 'call' };
    return { type: 'fold' };
  }
  if (strength >= 0.38) {
    // 边缘牌：偶尔跟注 / 诈唬
    const r = Math.random();
    if (r < effCall * 0.45) return { type: 'call' };
    if (r < effCall * 0.45 + effBluff * 0.7) {
      if (maybeAllIn()) return { type: 'allin' };
      return { type: 'raise', amount: raiseTarget(2) };
    }
    return { type: 'fold' };
  }
  // 弱牌
  const r = Math.random();
  if (r < effBluff * 0.6) {
    if (maybeAllIn()) return { type: 'allin' };
    return { type: 'raise', amount: raiseTarget(2) };
  }
  if (potOdds > 0.25 && Math.random() < effCall * 0.25) return { type: 'call' };
  return { type: 'fold' };
}

function scheduleAI(game) {
  clearTimer(game.id);
  const profile = buildProfile(game.players[1].ai_personality);
  const delay = Math.round(profile.thinkMs * (0.6 + Math.random() * 0.8));
  const timer = setTimeout(() => {
    aiTimers.delete(game.id);
    if (game.hand_over || game.current_player !== 1) return;
    const decision = aiDecide(game, 1);
    applyAction(game, 1, decision.type, decision.amount);
    // AI 行动后若仍轮到 AI（异常情况）继续调度；否则停在真人回合
    if (!game.hand_over && game.current_player === 1 && !game.players[1].folded && !game.players[1].all_in) {
      scheduleAI(game);
    }
  }, delay);
  aiTimers.set(game.id, timer);
}

function clearTimer(gameId) {
  const t = aiTimers.get(gameId);
  if (t) {
    clearTimeout(t);
    aiTimers.delete(gameId);
  }
}

// ── 对外接口 ──

function getState(gameId) {
  const g = gameFromId(gameId);
  return deepCopy(g);
}

function postAction(gameId, playerId, actionType, amount = 0) {
  const g = gameFromId(gameId);
  clearTimer(g.id);
  const idx = g.players.findIndex((p) => p.id === playerId);
  if (idx === -1 || idx === 1) throw new Error('非法玩家');
  if (g.hand_over) return getState(gameId);
  if (g.current_player !== idx) {
    // 非玩家回合：忽略（避免竞态）
    return getState(gameId);
  }
  applyAction(g, idx, actionType, amount);
  return getState(gameId);
}

function getAnalysis(gameId, playerId) {
  const g = gameFromId(gameId);
  const me = g.players.find((p) => p.id === playerId);
  if (!me) return null;
  const all = [...me.hole_cards, ...g.board];
  const hand = bestHand(all);
  const winRate = estimateStrength(me.hole_cards, g.board);
  const toCall = Math.max(0, g.current_bet - me.bet);
  const potOdds = toCall > 0 ? toCall / (g.pot + toCall) : 0;
  const kellyFrac = winRate > potOdds ? (winRate - potOdds) / (1 - potOdds) : 0;
  return {
    hand_name: hand ? hand.name : null,
    win_rate: Math.round(winRate * 1000) / 1000,
    pot_odds: Math.round(potOdds * 1000) / 1000,
    kelly_fraction: Math.round(clamp(kellyFrac, 0, 1) * 1000) / 1000,
    kelly_bet: Math.round(clamp(kellyFrac, 0, 1) * me.chips),
  };
}

// ═══════════════ 导出 ═══════════════

export const localArenaApi = {
  createGame,
  startGame,
  getState,
  postAction,
  getAnalysis,
};

export const localEngineUtils = {
  bestHand,
  eval5,
  compareHand,
  estimateStrength,
  buildProfile,
};
