// 模拟博弈台引擎 - 多人策略对抗
import { logger } from './logger';
import { storage } from './storage';

// ============= 常量定义 =============

// AI策略类型
export const AI_STRATEGIES = {
  aggressive: {
    id: 'aggressive',
    name: '激进型',
    emoji: '🔥',
    description: '高频加注，All-in倾向强',
    raiseFreq: 0.6,
    allInFreq: 0.35,
    foldFreq: 0.15,
    callFreq: 0.25,
    riskTolerance: 0.85,
  },
  balanced: {
    id: 'balanced',
    name: '均衡型',
    emoji: '⚖️',
    description: '跟注为主，适时加注',
    raiseFreq: 0.25,
    allInFreq: 0.08,
    foldFreq: 0.25,
    callFreq: 0.55,
    riskTolerance: 0.5,
  },
  conservative: {
    id: 'conservative',
    name: '保守型',
    emoji: '🛡️',
    description: '只玩好牌，频繁弃牌',
    raiseFreq: 0.12,
    allInFreq: 0.03,
    foldFreq: 0.55,
    callFreq: 0.3,
    riskTolerance: 0.2,
  },
  random: {
    id: 'random',
    name: '随机型',
    emoji: '🎲',
    description: '行为不可预测',
    raiseFreq: 0.3,
    allInFreq: 0.15,
    foldFreq: 0.3,
    callFreq: 0.4,
    riskTolerance: 0.5,
  },
};

export const STRATEGY_LIST = Object.values(AI_STRATEGIES);

// 动作类型
export const ACTIONS = {
  FOLD: 'fold',
  CALL: 'call',
  RAISE: 'raise',
  ALL_IN: 'all_in',
  CHECK: 'check',
};

export const ACTION_LABELS = {
  fold: '弃牌',
  call: '跟注',
  raise: '加注',
  all_in: 'All-in',
  check: '过牌',
};

// 游戏阶段
export const GAME_PHASES = {
  WAITING: 'waiting',
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
  ENDED: 'ended',
};

export const PHASE_LABELS = {
  waiting: '等待开始',
  preflop: '翻牌前',
  flop: '翻牌',
  turn: '转牌',
  river: '河牌',
  showdown: '摊牌',
  ended: '对局结束',
};

// 牌面强度（简化评估）
const HAND_STRENGTH = {
  high_card: 1,
  pair: 2,
  two_pair: 3,
  three_of_a_kind: 4,
  straight: 5,
  flush: 6,
  full_house: 7,
  four_of_a_kind: 8,
  straight_flush: 9,
  royal_flush: 10,
};

// ============= 工具函数 =============

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 生成一副牌
const createDeck = () => {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
    }
  }
  return deck;
};

// 洗牌
const shuffleDeck = (deck) => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// 评估手牌强度（简化版）
const evaluateHandStrength = (hand, community = []) => {
  const allCards = [...hand, ...community];
  if (allCards.length < 2) return { strength: 0, type: 'none', confidence: 0 };

  const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  const ranks = allCards.map(c => rankValues[c.rank]).sort((a, b) => b - a);
  const suits = allCards.map(c => c.suit);

  // 检查对子
  const rankCounts = {};
  ranks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const pairCount = counts.filter(c => c >= 2).length;

  let type = 'high_card';
  let strength = ranks[0] / 14;

  if (counts[0] === 4) {
    type = 'four_of_a_kind';
    strength = 0.95;
  } else if (counts[0] === 3 && pairCount >= 2) {
    type = 'full_house';
    strength = 0.9;
  } else if (counts[0] === 3) {
    type = 'three_of_a_kind';
    strength = 0.7;
  } else if (pairCount >= 2) {
    type = 'two_pair';
    strength = 0.55;
  } else if (pairCount === 1) {
    type = 'pair';
    const pairRank = Object.keys(rankCounts).find(r => rankCounts[r] >= 2);
    strength = 0.3 + (rankValues[pairRank] / 14) * 0.3;
  }

  // 同花可能性
  const suitCounts = {};
  suits.forEach(s => { suitCounts[s] = (suitCounts[s] || 0) + 1; });
  if (Math.max(...Object.values(suitCounts)) >= 5) {
    type = 'flush';
    strength = 0.8;
  }

  return {
    strength: Math.min(1, strength),
    type,
    confidence: allCards.length >= 5 ? 0.9 : 0.5 + (allCards.length * 0.1),
  };
};

// ============= 玩家管理 =============

const createPlayer = (id, name, strategy = null, isHuman = false) => {
  const strategyConfig = strategy ? AI_STRATEGIES[strategy] : null;
  return {
    id,
    name,
    isHuman,
    strategy: strategy || 'human',
    strategyConfig,
    chips: isHuman ? 200 : randomInt(150, 250),
    hand: [],
    currentBet: 0,
    totalBet: 0,
    folded: false,
    allIn: false,
    actionHistory: [],
    observedStats: {
      raiseCount: 0,
      foldCount: 0,
      callCount: 0,
      allInCount: 0,
      totalHands: 0,
    },
  };
};

// ============= AI决策 =============

const makeAIDecision = (player, gameState) => {
  const { strategyConfig } = player;
  if (!strategyConfig || player.folded || player.allIn) return null;

  const { currentBet, pot, communityCards, toCall } = gameState;
  const handEval = evaluateHandStrength(player.hand, communityCards);
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

  // 基于牌力和策略计算各动作概率
  let foldProb = strategyConfig.foldFreq;
  let callProb = strategyConfig.callFreq;
  let raiseProb = strategyConfig.raiseFreq;
  let allInProb = strategyConfig.allInFreq;

  // 牌力调整
  if (handEval.strength > 0.7) {
    foldProb *= 0.3;
    raiseProb *= 1.8;
    allInProb *= 2;
  } else if (handEval.strength > 0.4) {
    foldProb *= 0.7;
    callProb *= 1.3;
  } else {
    foldProb *= 1.5;
    raiseProb *= 0.5;
  }

  // 底池赔率调整
  if (potOdds > 0.5 && handEval.strength > 0.3) {
    callProb *= 1.5;
    foldProb *= 0.5;
  }

  // 归一化
  const total = foldProb + callProb + raiseProb + allInProb;
  foldProb /= total;
  callProb /= total;
  raiseProb /= total;
  allInProb /= total;

  // 随机选择动作
  const rand = Math.random();
  let cumulative = 0;

  cumulative += foldProb;
  if (rand < cumulative) return { action: ACTIONS.FOLD, amount: 0 };

  cumulative += callProb;
  if (rand < cumulative) {
    const callAmount = Math.min(toCall, player.chips);
    if (callAmount >= player.chips) {
      return { action: ACTIONS.ALL_IN, amount: player.chips };
    }
    return { action: ACTIONS.CALL, amount: callAmount };
  }

  cumulative += raiseProb;
  if (rand < cumulative) {
    const raiseAmount = Math.min(
      Math.max(toCall * 2, randomInt(20, 50)),
      player.chips
    );
    if (raiseAmount >= player.chips) {
      return { action: ACTIONS.ALL_IN, amount: player.chips };
    }
    return { action: ACTIONS.RAISE, amount: raiseAmount };
  }

  // All-in
  return { action: ACTIONS.ALL_IN, amount: player.chips };
};

// ============= 对手建模 =============

export const analyzeOpponent = (player) => {
  const { observedStats, strategy } = player;
  const totalActions = observedStats.raiseCount + observedStats.foldCount + observedStats.callCount + observedStats.allInCount;

  if (totalActions === 0) {
    return {
      strategy: 'unknown',
      strategyName: '未知',
      confidence: 0,
      traits: { aggression: 0.5, tightness: 0.5, predictability: 0.5 },
    };
  }

  const aggression = (observedStats.raiseCount + observedStats.allInCount) / totalActions;
  const tightness = observedStats.foldCount / totalActions;
  const predictability = Math.max(
    observedStats.raiseCount / totalActions,
    observedStats.foldCount / totalActions,
    observedStats.callCount / totalActions
  );

  let detectedStrategy = 'balanced';
  let strategyName = '均衡型';

  if (aggression > 0.5) {
    detectedStrategy = 'aggressive';
    strategyName = '激进型';
  } else if (tightness > 0.5) {
    detectedStrategy = 'conservative';
    strategyName = '保守型';
  } else if (predictability < 0.35) {
    detectedStrategy = 'random';
    strategyName = '随机型';
  }

  const confidence = Math.min(1, 0.3 + (totalActions * 0.05));

  return {
    strategy: detectedStrategy,
    strategyName,
    confidence,
    traits: {
      aggression: Math.round(aggression * 100),
      tightness: Math.round(tightness * 100),
      predictability: Math.round(predictability * 100),
    },
    rawStats: observedStats,
  };
};

// ============= 游戏引擎 =============

const STORAGE_KEY = 'gametable_history';
const PROFILE_KEY = 'gametable_profile';

export const gameTableEngine = {
  // 创建新游戏
  createGame: (playerCount = 4, humanPosition = 0) => {
    const strategies = ['aggressive', 'balanced', 'conservative', 'random'];
    const players = [];
    const playerNames = ['你', '玩家2', '玩家3', '玩家4'];

    for (let i = 0; i < playerCount; i++) {
      const isHuman = i === humanPosition;
      const strategy = isHuman ? null : strategies[(i + humanPosition) % strategies.length];
      players.push(createPlayer(i, playerNames[i], strategy, isHuman));
    }

    return {
      id: Date.now(),
      players,
      communityCards: [],
      pot: 0,
      currentBet: 0,
      phase: GAME_PHASES.WAITING,
      currentPlayerIndex: 0,
      dealerIndex: 0,
      round: 1,
      actionLog: [],
      startTime: Date.now(),
      humanDecisions: [],
      strategySwitches: 0,
    };
  },

  // 开始新一局
  startNewRound: (game) => {
    const deck = shuffleDeck(createDeck());

    // 重置玩家状态
    const players = game.players.map((p, idx) => {
      const hand = [deck.pop(), deck.pop()];
      return {
        ...p,
        hand,
        currentBet: 0,
        totalBet: 0,
        folded: false,
        allIn: false,
      };
    });

    // 小盲和大盲
    const sbIdx = (game.dealerIndex + 1) % players.length;
    const bbIdx = (game.dealerIndex + 2) % players.length;
    players[sbIdx].currentBet = 5;
    players[sbIdx].chips -= 5;
    players[bbIdx].currentBet = 10;
    players[bbIdx].chips -= 10;

    return {
      ...game,
      players,
      communityCards: [],
      pot: 15,
      currentBet: 10,
      phase: GAME_PHASES.PREFLOP,
      currentPlayerIndex: (bbIdx + 1) % players.length,
      actionLog: [
        { playerId: sbIdx, action: 'small_blind', amount: 5 },
        { playerId: bbIdx, action: 'big_blind', amount: 10 },
      ],
    };
  },

  // 执行玩家动作
  executeAction: (game, playerId, action, amount = 0) => {
    const players = [...game.players];
    const player = players[playerId];
    let newGame = { ...game, players, actionLog: [...game.actionLog] };

    if (player.folded || player.allIn) return newGame;

    const toCall = game.currentBet - player.currentBet;

    switch (action) {
      case ACTIONS.FOLD:
        player.folded = true;
        player.observedStats.foldCount++;
        newGame.actionLog.push({ playerId, action: ACTIONS.FOLD, amount: 0 });
        break;

      case ACTIONS.CALL: {
        const callAmount = Math.min(toCall, player.chips);
        player.chips -= callAmount;
        player.currentBet += callAmount;
        player.totalBet += callAmount;
        newGame.pot += callAmount;
        if (player.chips <= 0) player.allIn = true;
        player.observedStats.callCount++;
        newGame.actionLog.push({ playerId, action: ACTIONS.CALL, amount: callAmount });
        break;
      }

      case ACTIONS.RAISE: {
        const totalBet = Math.max(amount, game.currentBet + 10);
        const payAmount = totalBet - player.currentBet;
        const actualPay = Math.min(payAmount, player.chips);
        player.chips -= actualPay;
        player.currentBet += actualPay;
        player.totalBet += actualPay;
        newGame.pot += actualPay;
        newGame.currentBet = player.currentBet;
        if (player.chips <= 0) player.allIn = true;
        player.observedStats.raiseCount++;
        newGame.actionLog.push({ playerId, action: ACTIONS.RAISE, amount: actualPay });
        break;
      }

      case ACTIONS.ALL_IN: {
        const allInAmount = player.chips;
        player.chips = 0;
        player.currentBet += allInAmount;
        player.totalBet += allInAmount;
        newGame.pot += allInAmount;
        newGame.currentBet = Math.max(newGame.currentBet, player.currentBet);
        player.allIn = true;
        player.observedStats.allInCount++;
        newGame.actionLog.push({ playerId, action: ACTIONS.ALL_IN, amount: allInAmount });
        break;
      }

      case ACTIONS.CHECK:
        newGame.actionLog.push({ playerId, action: ACTIONS.CHECK, amount: 0 });
        break;

      default:
        break;
    }

    player.actionHistory.push({ action, amount, phase: game.phase });
    player.observedStats.totalHands++;

    return newGame;
  },

  // 推进到下一个玩家
  advanceToNextPlayer: (game) => {
    const playerCount = game.players.length;
    let nextIndex = (game.currentPlayerIndex + 1) % playerCount;
    let checks = 0;

    while (checks < playerCount) {
      const player = game.players[nextIndex];
      if (!player.folded && !player.allIn && player.chips > 0) {
        return { ...game, currentPlayerIndex: nextIndex };
      }
      nextIndex = (nextIndex + 1) % playerCount;
      checks++;
    }

    return { ...game, currentPlayerIndex: nextIndex };
  },

  // 检查是否该阶段结束
  isPhaseComplete: (game) => {
    const activePlayers = game.players.filter(p => !p.folded);
    if (activePlayers.length <= 1) return true;

    const canAct = activePlayers.filter(p => !p.allIn && p.chips > 0);
    if (canAct.length === 0) return true;

    const matched = activePlayers.every(p =>
      p.allIn || p.currentBet >= game.currentBet
    );

    return matched;
  },

  // 进入下一阶段
  advancePhase: (game) => {
    const deck = shuffleDeck(createDeck());
    let communityCards = [...game.communityCards];
    let newPhase = game.phase;

    // 跳过已发的牌
    const usedCards = new Set();
    game.players.forEach(p => p.hand.forEach(c => usedCards.add(`${c.rank}${c.suit}`)));
    communityCards.forEach(c => usedCards.add(`${c.rank}${c.suit}`));

    const availableDeck = deck.filter(c => !usedCards.has(`${c.rank}${c.suit}`));

    switch (game.phase) {
      case GAME_PHASES.PREFLOP:
        communityCards = [availableDeck.pop(), availableDeck.pop(), availableDeck.pop()];
        newPhase = GAME_PHASES.FLOP;
        break;
      case GAME_PHASES.FLOP:
        communityCards.push(availableDeck.pop());
        newPhase = GAME_PHASES.TURN;
        break;
      case GAME_PHASES.TURN:
        communityCards.push(availableDeck.pop());
        newPhase = GAME_PHASES.RIVER;
        break;
      case GAME_PHASES.RIVER:
        newPhase = GAME_PHASES.SHOWDOWN;
        break;
      default:
        newPhase = GAME_PHASES.ENDED;
    }

    // 重置当前下注
    return {
      ...game,
      communityCards,
      phase: newPhase,
      currentBet: 0,
      currentPlayerIndex: (game.dealerIndex + 1) % game.players.length,
      players: game.players.map(p => ({ ...p, currentBet: 0 })),
    };
  },

  // 摊牌结算
  showdown: (game) => {
    const activePlayers = game.players.filter(p => !p.folded);
    let winner = null;
    let bestStrength = -1;

    activePlayers.forEach(p => {
      const evalResult = evaluateHandStrength(p.hand, game.communityCards);
      if (evalResult.strength > bestStrength) {
        bestStrength = evalResult.strength;
        winner = p;
      }
    });

    if (winner) {
      winner.chips += game.pot;
    }

    return {
      ...game,
      phase: GAME_PHASES.ENDED,
      winner: winner ? winner.id : null,
    };
  },

  // 记录人类玩家决策
  recordHumanDecision: (game, decision) => {
    const decisionRecord = {
      ...decision,
      timestamp: Date.now(),
      phase: game.phase,
      pot: game.pot,
      stackSize: game.players.find(p => p.isHuman)?.chips,
    };
    return {
      ...game,
      humanDecisions: [...game.humanDecisions, decisionRecord],
    };
  },

  // 保存对局记录
  saveGameRecord: (game, result) => {
    try {
      const history = storage.get(STORAGE_KEY, []);
      const record = {
        id: game.id,
        timestamp: Date.now(),
        playerCount: game.players.length,
        duration: Date.now() - game.startTime,
        totalDecisions: game.humanDecisions.length,
        strategySwitches: game.strategySwitches,
        result,
        decisions: game.humanDecisions,
      };
      history.unshift(record);
      storage.set(STORAGE_KEY, history.slice(0, 100));
      return record;
    } catch (e) {
      logger.error('保存博弈记录失败', e);
      return null;
    }
  },

  // 获取历史记录
  getGameHistory: () => storage.get(STORAGE_KEY, []),

  // 分析博弈行为
  analyzeGameBehavior: () => {
    const history = storage.get(STORAGE_KEY, []) || [];
    if (!Array.isArray(history) || history.length === 0) {
      return {
        totalGames: 0,
        avgDecisions: 0,
        winRate: 0,
        avgDuration: 0,
        strategyAdaptability: 0,
        opponentModelingAccuracy: 0,
        riskAdjustmentScore: 0,
      };
    }

    const totalGames = history.length;
    const avgDecisions = history.reduce((s, g) => s + (g.totalDecisions || 0), 0) / totalGames;
    const wins = history.filter(g => g.result === 'win').length;
    const winRate = wins / totalGames;
    const avgDuration = history.reduce((s, g) => s + (g.duration || 0), 0) / totalGames;
    const avgStrategySwitches = history.reduce((s, g) => s + (g.strategySwitches || 0), 0) / totalGames;

    // 策略适应性：根据对手调整策略的频率
    const strategyAdaptability = Math.min(100, 30 + avgStrategySwitches * 15);

    // 综合评分
    const profile = {
      totalGames,
      avgDecisions: Math.round(avgDecisions),
      winRate: Math.round(winRate * 100),
      avgDuration: Math.round(avgDuration / 1000),
      strategyAdaptability: Math.round(strategyAdaptability),
      opponentModelingAccuracy: Math.round(50 + winRate * 40),
      riskAdjustmentScore: Math.round(55 + avgStrategySwitches * 10),
    };

    // 保存到人格画像
    storage.set(PROFILE_KEY, profile);
    return profile;
  },

  formatDuration: (ms) => {
    if (!ms || ms < 0) return '0秒';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${remainingSeconds}秒`;
  },
};

export default gameTableEngine;
