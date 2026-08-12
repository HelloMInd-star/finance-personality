/**
 * 游戏引擎行为层 · Game Engine Behavior Layer
 *
 * 功能定位：
 * 传统游戏引擎 → 渲染物理世界、处理碰撞光影、输出画面音效
 * 本系统 → 渲染"玩家的决策世界"、处理风险偏好/路径推演/执行纪律、输出K线/音乐/配方/画像
 *
 * 接入能力：
 * 1. NPC 根据玩家人格画像动态调整对话和行为
 * 2. 游戏难度根据玩家凯利偏差实时自适应
 * 3. 游戏剧情走向根据玩家决策模式分叉
 * 4. 玩家决策行为生成可视化K线/音乐反馈
 */

import { logger } from './logger';
import { storage } from './storage';
import { investorEngine } from './investorEngine';
import { musicEngine } from './musicEngine';

// ============= NPC 人格库 =============

export const NPC_PERSONALITIES = [
  {
    id: 'mentor',
    name: '智者导师',
    emoji: '🧙',
    baseMbti: 'INFJ',
    dialogueStyle: 'philosophical',
    adaptability: 0.8,
    baseLines: {
      greeting: '欢迎你，旅人。我观察你已久了。',
      advice: '每一个选择都是一面镜子，照见你内心的真相。',
      caution: '小心，这条路布满了你的偏见。',
      praise: '做得好。你比你以为的更了解自己。',
    },
  },
  {
    id: 'rival',
    name: '宿敌对手',
    emoji: '⚔️',
    baseMbti: 'ENTJ',
    dialogueStyle: 'challenging',
    adaptability: 0.6,
    baseLines: {
      greeting: '又是你。准备好失败了吗？',
      advice: '别犹豫了，你这样只会输得更惨。',
      caution: '我看穿了你的套路，这次不会再让你得逞。',
      praise: '哼，有点意思。但还不够。',
    },
  },
  {
    id: 'companion',
    name: '忠诚伙伴',
    emoji: '🤝',
    baseMbti: 'ISFJ',
    dialogueStyle: 'supportive',
    adaptability: 0.9,
    baseLines: {
      greeting: '你来了！我一直在等你。',
      advice: '无论你做什么决定，我都会支持你的。',
      caution: '这条路看起来很危险，我们要小心。',
      praise: '太棒了！我就知道你可以的！',
    },
  },
  {
    id: 'merchant',
    name: '神秘商人',
    emoji: '🪙',
    baseMbti: 'ESTP',
    dialogueStyle: 'persuasive',
    adaptability: 0.7,
    baseLines: {
      greeting: '嘿嘿，看看我给你准备了什么好东西。',
      advice: '这个东西配得上像你这样有眼光的人。',
      caution: '错过今天，就再也没有这个价格了。',
      praise: '识货！这笔交易你赚了。',
    },
  },
];

// ============= 剧情分叉规则 =============

export const STORY_BRANCH_RULES = {
  conservative: {
    branches: ['safe_path', 'alliance', 'preparation'],
    description: '保守型玩家 → 更多安全选项、结盟机会、准备时间',
  },
  balanced: {
    branches: ['choice_moment', 'neutral_path', 'exploration'],
    description: '均衡型玩家 → 经典叙事、道德抉择、探索空间',
  },
  aggressive: {
    branches: ['risk_path', 'confrontation', 'fast_track'],
    description: '激进型玩家 → 高风险高回报、正面对抗、快速推进',
  },
};

// ============= 难度映射 =============

function kellyToDifficultyLevel(kellyDeviation) {
  if (kellyDeviation < -0.3) return { level: 'easy', multiplier: 0.7, label: '简单模式' };
  if (kellyDeviation < -0.1) return { level: 'medium_easy', multiplier: 0.85, label: '中简模式' };
  if (kellyDeviation < 0.1) return { level: 'medium', multiplier: 1.0, label: '标准模式' };
  if (kellyDeviation < 0.3) return { level: 'medium_hard', multiplier: 1.2, label: '中难模式' };
  return { level: 'hard', multiplier: 1.5, label: '困难模式' };
}

// ============= 行为数据分析 =============

/**
 * 从 localStorage 提取玩家行为数据
 */
export function extractPlayerProfile() {
  try {
    const userData = investorEngine.extractUserData();
    const yMineData = storage.get() || {};
    const userState = yMineData.userState || {};

    const riskProfile =
      userData.riskTolerance < 35
        ? 'conservative'
        : userData.riskTolerance < 65
        ? 'balanced'
        : 'aggressive';

    const decisionStyle =
      userData.timePreference > 70
        ? 'deep_thinker'
        : userData.timePreference > 40
        ? 'balanced_decider'
        : 'quick_actor';

    return {
      ...userData,
      emotion: userState.emotion || 50,
      currentMbti: userState.currentMbti || 'INTP',
      mbtiConfidence: userState.mbtiConfidence || 60,
      riskProfile,
      decisionStyle,
      difficulty: kellyToDifficultyLevel(userData.kellyDeviation),
      storyBranches: STORY_BRANCH_RULES[riskProfile],
    };
  } catch (e) {
    logger.error('提取玩家画像失败', e);
    return {
      riskTolerance: 50,
      timePreference: 50,
      executionDiscipline: 70,
      reflectionDeviation: 50,
      aimPrecision: 50,
      kellyDeviation: 0,
      storyPreference: 'both',
      emotion: 50,
      currentMbti: 'INTP',
      mbtiConfidence: 60,
      riskProfile: 'balanced',
      decisionStyle: 'balanced_decider',
      difficulty: { level: 'medium', multiplier: 1.0, label: '标准模式' },
      storyBranches: STORY_BRANCH_RULES.balanced,
    };
  }
}

// ============= NPC 自适应对话生成 =============

/**
 * 根据玩家画像调整 NPC 对话
 */
export function generateNPCDialogue(npcId, playerProfile, context = 'greeting') {
  const npc = NPC_PERSONALITIES.find((n) => n.id === npcId) || NPC_PERSONALITIES[0];
  const baseLine = npc.baseLines[context] || npc.baseLines.greeting;

  let adaptedLine = baseLine;
  const tags = [];

  // 根据玩家 MBTI 调整
  const playerMbti = playerProfile.currentMbti || 'INTP';
  if (npc.dialogueStyle === 'philosophical') {
    if (playerMbti.startsWith('I')) {
      adaptedLine = adaptedLine.replace('旅人', '内省的探索者');
    } else {
      adaptedLine = adaptedLine.replace('旅人', '充满能量的行动派');
    }
  }

  // 根据风险偏好调整
  if (playerProfile.riskProfile === 'conservative' && context === 'caution') {
    adaptedLine = '我理解你的谨慎。但有时候，过于安全本身就是一种风险。';
    tags.push('风险感知触发');
  } else if (playerProfile.riskProfile === 'aggressive' && context === 'advice') {
    adaptedLine = '我欣赏你的魄力。但记住，真正的强者知道何时该退。';
    tags.push('激进倾向调节');
  }

  // 根据情绪值调整语气
  if (playerProfile.emotion < 30) {
    adaptedLine += ' 你看起来有点低落，需要谈谈吗？';
    tags.push('情绪低落·共情模式');
  } else if (playerProfile.emotion > 80) {
    adaptedLine += ' 你今天状态不错！让我们趁热打铁。';
    tags.push('情绪高涨·激励模式');
  }

  // 根据执行纪律调整
  if (playerProfile.executionDiscipline < 50 && context === 'advice') {
    adaptedLine += ' 如果你能坚持到底，结果会不一样。';
    tags.push('执行纪律提醒');
  }

  logger.session('NPC对话生成', {
    NPC: npc.name,
    上下文: context,
    玩家MBTI: playerMbti,
    风险画像: playerProfile.riskProfile,
    情绪值: playerProfile.emotion,
    标签: tags,
  });

  return {
    npc,
    originalLine: baseLine,
    adaptedLine,
    tags,
    adaptationSignals: {
      mbti: playerMbti,
      riskProfile: playerProfile.riskProfile,
      emotion: playerProfile.emotion,
      discipline: playerProfile.executionDiscipline,
    },
  };
}

// ============= 自适应难度系统 =============

/**
 * 根据玩家凯利偏差计算游戏难度
 */
export function calculateAdaptiveDifficulty(playerProfile, baseDifficulty = 1) {
  const kellyFactor = 1 + playerProfile.kellyDeviation * 0.5;
  const riskFactor = playerProfile.riskTolerance / 50;
  const emotionFactor = 1 + (playerProfile.emotion - 50) / 200;

  const finalMultiplier =
    baseDifficulty *
    playerProfile.difficulty.multiplier *
    kellyFactor *
    (0.7 + riskFactor * 0.3) *
    emotionFactor;

  const clampedMultiplier = Math.max(0.5, Math.min(2.5, finalMultiplier));

  const difficultyInfo = {
    base: baseDifficulty,
    kellyMultiplier: kellyFactor.toFixed(2),
    riskMultiplier: riskFactor.toFixed(2),
    emotionMultiplier: emotionFactor.toFixed(2),
    finalMultiplier: clampedMultiplier.toFixed(2),
    level:
      clampedMultiplier < 0.7
        ? '新手保护'
        : clampedMultiplier < 1
        ? '简单'
        : clampedMultiplier < 1.3
        ? '标准'
        : clampedMultiplier < 1.8
        ? '困难'
        : '地狱',
    description: '',
  };

  difficultyInfo.description = `基于凯利偏差 ${playerProfile.kellyDeviation.toFixed(2)}、风险容忍度 ${playerProfile.riskTolerance}、情绪值 ${playerProfile.emotion} 动态计算`;

  logger.session('自适应难度计算', {
    难度等级: difficultyInfo.level,
    最终倍率: difficultyInfo.finalMultiplier,
    计算因子: {
      凯利: difficultyInfo.kellyMultiplier,
      风险: difficultyInfo.riskMultiplier,
      情绪: difficultyInfo.emotionMultiplier,
    },
  });

  return difficultyInfo;
}

// ============= 剧情分叉引擎 =============

/**
 * 根据玩家决策模式选择剧情分支
 */
export function selectStoryBranch(playerProfile, availableBranches = []) {
  const defaultBranches = STORY_BRANCH_RULES[playerProfile.riskProfile].branches;
  const branches = availableBranches.length > 0 ? availableBranches : defaultBranches;

  // 根据决策风格加权
  const weights = branches.map((b) => {
    let weight = 1;
    if (playerProfile.decisionStyle === 'deep_thinker') {
      if (['preparation', 'safe_path', 'exploration'].includes(b)) weight = 1.5;
    }
    if (playerProfile.decisionStyle === 'quick_actor') {
      if (['fast_track', 'confrontation', 'risk_path'].includes(b)) weight = 1.5;
    }
    if (playerProfile.riskProfile === 'conservative') {
      if (['safe_path', 'alliance', 'preparation'].includes(b)) weight = 2;
    }
    if (playerProfile.riskProfile === 'aggressive') {
      if (['risk_path', 'confrontation', 'fast_track'].includes(b)) weight = 2;
    }
    return weight;
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedBranches = branches.map((b, i) => ({
    branch: b,
    probability: ((weights[i] / totalWeight) * 100).toFixed(1),
  }));

  // 选择权值最高的分支
  const maxIndex = weights.indexOf(Math.max(...weights));

  logger.session('剧情分支选择', {
    玩家决策风格: playerProfile.decisionStyle,
    风险画像: playerProfile.riskProfile,
    推荐分支: branches[maxIndex],
    概率分布: weightedBranches,
  });

  return {
    selectedBranch: branches[maxIndex],
    weightedBranches,
    reasoning: `基于${playerProfile.riskProfile === 'conservative' ? '保守' : playerProfile.riskProfile === 'aggressive' ? '激进' : '均衡'}风险偏好 + ${playerProfile.decisionStyle}决策风格`,
  };
}

// ============= 行为K线生成 =============

/**
 * 将决策行为转化为 K 线数据
 */
export function generateDecisionKLine(decisions, playerProfile) {
  const klineData = decisions.map((d, i) => {
    const riskScore = (d.risk || 0.5) * 100;
    const outcomeScore = d.outcome === 'win' ? 1 : d.outcome === 'lose' ? -1 : 0;
    const timeWeight = Math.min(1, d.decisionTime / 10);

    const open = 50 + (i > 0 ? outcomeScore * 5 : 0);
    const close = open + outcomeScore * riskScore * 0.1 + (timeWeight - 0.5) * 5;
    const high = Math.max(open, close) + riskScore * 0.05;
    const low = Math.min(open, close) - riskScore * 0.05;
    const volume = Math.round(riskScore * timeWeight * 10);

    return {
      time: d.timestamp || Date.now() + i * 60000,
      open: +open.toFixed(2),
      close: +close.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      volume,
      decision: d,
    };
  });

  const stats = {
    totalDecisions: decisions.length,
    winRate: (decisions.filter((d) => d.outcome === 'win').length / decisions.length) * 100,
    avgRisk: decisions.reduce((a, d) => a + (d.risk || 0.5), 0) / decisions.length,
    avgDecisionTime: decisions.reduce((a, d) => a + (d.decisionTime || 5), 0) / decisions.length,
    profit: klineData.length > 0 ? klineData[klineData.length - 1].close - klineData[0].open : 0,
  };

  logger.session('决策K线生成', {
    决策数量: stats.totalDecisions,
    胜率: stats.winRate.toFixed(1) + '%',
    平均风险: (stats.avgRisk * 100).toFixed(0),
    收益: stats.profit.toFixed(2),
  });

  return { klineData, stats };
}

// ============= 模拟决策数据（演示用） =============

export function generateMockDecisions(playerProfile) {
  const baseRisk = playerProfile.riskTolerance / 100;
  const baseSpeed = playerProfile.timePreference / 100;
  const decisions = [];

  for (let i = 0; i < 20; i++) {
    const riskJitter = (Math.random() - 0.5) * 0.3;
    const risk = Math.max(0.1, Math.min(0.9, baseRisk + riskJitter));
    const decisionTime = Math.max(1, Math.min(15, 10 - baseSpeed * 8 + (Math.random() - 0.5) * 3));
    const outcome = Math.random() < 0.4 + (1 - risk) * 0.3 ? 'win' : 'lose';

    decisions.push({
      id: `d_${i}`,
      risk,
      decisionTime,
      outcome,
      timestamp: Date.now() - (20 - i) * 60000,
      context: ['资源分配', '风险对冲', '快速出击', '耐心等待'][i % 4],
    });
  }

  return decisions;
}

// ============= 导出 =============

export const gameEngineLayer = {
  NPC_PERSONALITIES,
  STORY_BRANCH_RULES,
  extractPlayerProfile,
  generateNPCDialogue,
  calculateAdaptiveDifficulty,
  selectStoryBranch,
  generateDecisionKLine,
  generateMockDecisions,
};
