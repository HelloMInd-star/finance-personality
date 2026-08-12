/**
 * 扑克计算工具
 * 包含：胜率估算、凯利公式、牌力评估
 */

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

// ============================================
// 牌力评估（和后端 HandEvaluator 逻辑一致）
// ============================================

export function evaluateHand(cards) {
  if (!cards || cards.length < 5) {
    return { strength: 0.0, hand_name: 'Unknown', rank: 0, high_card: 0 };
  }

  const sorted = [...cards].sort((a, b) => getRankValue(b) - getRankValue(a));
  const ranks = sorted.map(c => getRankValue(c));
  const suits = sorted.map(c => c.suit);

  // 同花
  const suitCount = {};
  suits.forEach(s => { suitCount[s] = (suitCount[s] || 0) + 1; });
  const is_flush = Object.values(suitCount).some(c => c >= 5);

  // 顺子
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let is_straight = false;
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {
      is_straight = true;
      break;
    }
  }
  // A-2-3-4-5
  if ([14, 2, 3, 4, 5].every(r => uniqueRanks.includes(r))) {
    is_straight = true;
  }

  // 对子统计
  const rankCounts = {};
  ranks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });
  const pairs = Object.entries(rankCounts).filter(([, c]) => c === 2).map(([r]) => Number(r));
  const trips = Object.entries(rankCounts).filter(([, c]) => c === 3).map(([r]) => Number(r));
  const quads = Object.entries(rankCounts).filter(([, c]) => c === 4).map(([r]) => Number(r));

  let strength = 0.0;
  let hand_name = 'High Card';
  let hand_rank = 0;

  if (is_flush && is_straight) {
    strength = 1.0; hand_name = 'Straight Flush'; hand_rank = 9;
  } else if (quads.length > 0) {
    strength = 0.95; hand_name = 'Four of a Kind'; hand_rank = 8;
  } else if (trips.length > 0 && pairs.length > 0) {
    strength = 0.9; hand_name = 'Full House'; hand_rank = 7;
  } else if (is_flush) {
    strength = 0.85; hand_name = 'Flush'; hand_rank = 6;
  } else if (is_straight) {
    strength = 0.8; hand_name = 'Straight'; hand_rank = 5;
  } else if (trips.length > 0) {
    strength = 0.7; hand_name = 'Three of a Kind'; hand_rank = 4;
  } else if (pairs.length >= 2) {
    strength = 0.6; hand_name = 'Two Pair'; hand_rank = 3;
  } else if (pairs.length === 1) {
    strength = 0.4 + (pairs[0] - 2) / 12 * 0.2; hand_name = 'One Pair'; hand_rank = 2;
  } else {
    const high_card = Math.max(...ranks);
    strength = 0.1 + (high_card - 2) / 12 * 0.3;
    hand_name = 'High Card'; hand_rank = 1;
  }

  return { strength, hand_name, rank: hand_rank, high_card: Math.max(...ranks) };
}

// ============================================
// 胜率估算（蒙特卡洛模拟）
// ============================================

export function estimateWinRate(holeCards, boardCards, numOpponents = 1, simulations = 500) {
  if (!holeCards || holeCards.length < 2) return 0.1;

  const knownCards = new Set();
  holeCards.forEach(c => knownCards.add(`${c.rank}${c.suit}`));
  (boardCards || []).forEach(c => knownCards.add(`${c.rank}${c.suit}`));

  // 生成剩余牌堆
  const remainingDeck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const key = `${rank}${suit}`;
      if (!knownCards.has(key)) {
        remainingDeck.push({ rank, suit, color: (suit === '♥' || suit === '♦') ? 'red' : 'black' });
      }
    }
  }

  let wins = 0;

  for (let sim = 0; sim < simulations; sim++) {
    // 洗牌
    const shuffled = [...remainingDeck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let deckIdx = 0;

    // 补全公共牌（到5张）
    const fullBoard = [...(boardCards || [])];
    while (fullBoard.length < 5) {
      fullBoard.push(shuffled[deckIdx++]);
    }

    // 发对手手牌
    const opponentHands = [];
    for (let opp = 0; opp < numOpponents; opp++) {
      opponentHands.push([shuffled[deckIdx++], shuffled[deckIdx++]]);
    }

    // 评估我的牌
    const myAllCards = [...holeCards, ...fullBoard];
    const myEval = evaluateHand(myAllCards);

    // 评估对手牌，找最强的
    let bestOppEval = { strength: 0, rank: 0, high_card: 0 };
    for (const oppHand of opponentHands) {
      const oppAllCards = [...oppHand, ...fullBoard];
      const oppEval = evaluateHand(oppAllCards);
      if (oppEval.rank > bestOppEval.rank ||
          (oppEval.rank === bestOppEval.rank && oppEval.high_card > bestOppEval.high_card)) {
        bestOppEval = oppEval;
      }
    }

    // 比较
    if (myEval.rank > bestOppEval.rank ||
        (myEval.rank === bestOppEval.rank && myEval.high_card >= bestOppEval.high_card)) {
      wins++;
    }
  }

  return wins / simulations;
}

// ============================================
// 凯利公式
// K = (W * R - L) / R
// W = 胜率, L = 1 - W, R = 赔率(底池/跟注额)
// ============================================

export function calculateKelly(winRate, pot, callAmount) {
  if (callAmount <= 0) return 0;
  if (winRate <= 0) return 0;
  if (winRate >= 1) return 1;

  const loseRate = 1 - winRate;
  const odds = pot / callAmount; // 赔率
  const kelly = (winRate * odds - loseRate) / odds;

  return Math.max(0, Math.min(1, kelly));
}

// ============================================
// 综合计算：从游戏状态计算所有指标
// ============================================

export function calculateGameMetrics(gameState, currentPlayerId) {
  if (!gameState || !gameState.players) {
    return {
      winRate: 0,
      kellyIndex: 0,
      potOdds: 0,
      callAmount: 0,
      handStrength: 0,
      handName: 'Unknown',
      expectedValue: 0,
      tension: 0
    };
  }

  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  if (!currentPlayer || !currentPlayer.hole_cards || currentPlayer.hole_cards.length < 2) {
    return {
      winRate: 0,
      kellyIndex: 0,
      potOdds: 0,
      callAmount: 0,
      handStrength: 0,
      handName: 'Unknown',
      expectedValue: 0,
      tension: 0
    };
  }

  const holeCards = currentPlayer.hole_cards;
  const boardCards = gameState.board || [];
  const pot = gameState.pot || 0;
  const numOpponents = gameState.players.filter(p => p.id !== currentPlayerId && !p.folded).length || 1;

  // 当前需要跟注的金额
  const maxBet = Math.max(...gameState.players.filter(p => !p.folded).map(p => p.bet || 0));
  const callAmount = Math.max(0, maxBet - (currentPlayer.bet || 0));

  // 胜率（根据阶段决定模拟次数）
  const stage = gameState.stage;
  let sims = 300;
  if (stage === 'river') sims = 100;
  else if (stage === 'turn') sims = 200;
  else if (stage === 'flop') sims = 300;
  else sims = 500; // preflop

  const winRate = estimateWinRate(holeCards, boardCards, numOpponents, sims);

  // 凯利指数
  const kellyIndex = calculateKelly(winRate, pot, callAmount);

  // 底池赔率
  const potOdds = callAmount > 0 ? pot / callAmount : 0;

  // 当前牌力（如果公共牌>=3张）
  let handStrength = 0;
  let handName = 'Unknown';
  if (boardCards.length >= 3) {
    const allCards = [...holeCards, ...boardCards];
    const evalResult = evaluateHand(allCards);
    handStrength = evalResult.strength;
    handName = evalResult.hand_name;
  } else if (boardCards.length === 0) {
    // Preflop：基于手牌估算
    handStrength = estimatePreflopStrength(holeCards);
    handName = handStrength > 0.6 ? 'Premium Hand' : (handStrength > 0.35 ? 'Playable Hand' : 'Weak Hand');
  } else {
    handName = 'Drawing...';
    handStrength = 0.3;
  }

  // 期望值（简化）
  const expectedValue = winRate * pot - (1 - winRate) * callAmount;

  // 博弈张力：底池大小+阶段+玩家数
  const stageFactor = { preflop: 0.2, flop: 0.4, turn: 0.6, river: 0.8, showdown: 1.0 };
  const tension = Math.min(1, (pot / 2000) * 0.5 + (stageFactor[stage] || 0) * 0.3 + (numOpponents / 5) * 0.2);

  return {
    winRate,
    kellyIndex,
    potOdds,
    callAmount,
    handStrength,
    handName,
    expectedValue,
    tension
  };
}

// ============================================
// Preflop 手牌强度估算
// ============================================

function estimatePreflopStrength(holeCards) {
  if (!holeCards || holeCards.length < 2) return 0.1;

  const r1 = getRankValue(holeCards[0]);
  const r2 = getRankValue(holeCards[1]);
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const isPair = r1 === r2;
  const isSuited = holeCards[0].suit === holeCards[1].suit;
  const gap = high - low;

  let strength = 0.1;

  if (isPair) {
    // 对子
    if (high >= 14) strength = 0.95;      // AA
    else if (high >= 13) strength = 0.9;   // KK
    else if (high >= 12) strength = 0.85;  // QQ
    else if (high >= 11) strength = 0.8;   // JJ
    else if (high >= 10) strength = 0.75;  // TT
    else if (high >= 9) strength = 0.65;   // 99
    else if (high >= 7) strength = 0.55;   // 77-88
    else if (high >= 5) strength = 0.45;   // 55-66
    else strength = 0.35;                    // 22-44
  } else {
    // 高牌
    const highCardBonus = (high - 2) / 12 * 0.3;
    const suitedBonus = isSuited ? 0.08 : 0;
    const connectorBonus = (gap <= 1 && high >= 10) ? 0.05 : 0;

    strength = 0.2 + highCardBonus + suitedBonus + connectorBonus;

    // 顶级组合
    if (high >= 14 && low >= 13) strength = 0.85;  // AK
    else if (high >= 14 && low >= 12) strength = 0.8; // AQ
    else if (high >= 14 && low >= 11) strength = 0.75; // AJ
    else if (high >= 13 && low >= 12) strength = 0.7;  // KQ
  }

  return Math.max(0, Math.min(1, strength));
}

function getRankValue(card) {
  if (card.rank_value) return card.rank_value;
  return RANK_VALUES[card.rank] || 0;
}
