/**
 * 人形机器人认知引擎 · Robot Cognitive Engine
 *
 * 功能定位：
 * 传统机器人控制 → 控制关节、电机、传感器；处理环境感知；执行预设动作
 * 本系统 → 控制"行为策略"的生成与切换；处理"用户输入"的语义与情感；执行"人格模式"的调用与切换
 *
 * 接入能力：
 * 1. 机器人根据用户情绪值调整交互风格（情绪低→安静陪伴，情绪高→主动互动）
 * 2. 机器人根据用户 MBTI 模式切换对话策略（INTJ→直接简洁，INFP→温和引导）
 * 3. 机器人的行为节奏根据用户的"雪茄/烟火"选择自适应
 */

import { logger } from './logger';
import { storage } from './storage';
import { investorEngine } from './investorEngine';

// ============= 机器人人格模式库 =============

export const ROBOT_PERSONALITY_MODES = [
  {
    id: 'calm_companion',
    name: '静谧陪伴者',
    emoji: '🌙',
    description: '情绪低落时启用。安静、温和、不打扰。',
    tone: 'soft',
    speechRate: 0.85,
    verbosity: 'concise',
    initiative: 'passive',
    responseDelay: 1500,
    movementSmoothness: 0.9,
    interactionPatterns: [
      '静静陪伴，不主动发起对话',
      '用简短温和的语言回应',
      '行动缓慢轻柔，避免惊吓',
      '提供温暖的物理存在',
    ],
  },
  {
    id: 'energetic_partner',
    name: '活力伙伴',
    emoji: '☀️',
    description: '情绪高涨时启用。主动、热情、充满能量。',
    tone: 'lively',
    speechRate: 1.1,
    verbosity: 'expressive',
    initiative: 'active',
    responseDelay: 500,
    movementSmoothness: 0.6,
    interactionPatterns: [
      '主动发起话题和活动',
      '表达丰富，使用肢体语言',
      '行动迅速有力，充满活力',
      '积极反馈用户的每个举动',
    ],
  },
  {
    id: 'direct_executor',
    name: '直接执行者',
    emoji: '🎯',
    description: 'INTJ/ENTJ 等思维型用户。简洁、高效、逻辑导向。',
    tone: 'neutral',
    speechRate: 1.0,
    verbosity: 'precise',
    initiative: 'task_oriented',
    responseDelay: 800,
    movementSmoothness: 0.7,
    interactionPatterns: [
      '直奔主题，不绕弯子',
      '用数据和逻辑说话',
      '高效执行任务，减少闲聊',
      '尊重用户的独立空间',
    ],
  },
  {
    id: 'gentle_guide',
    name: '温和引导者',
    emoji: '🌸',
    description: 'INFP/ENFP 等情感型用户。温暖、共情、鼓励为主。',
    tone: 'warm',
    speechRate: 0.9,
    verbosity: 'supportive',
    initiative: 'supportive',
    responseDelay: 1000,
    movementSmoothness: 0.85,
    interactionPatterns: [
      '先共情，再引导',
      '用温暖的语言肯定用户',
      '帮助用户探索内心感受',
      '创造安全的表达空间',
    ],
  },
  {
    id: 'practical_helper',
    name: '务实助手',
    emoji: '🔧',
    description: 'ISTJ/ESTJ 等实感型用户。可靠、细致、注重细节。',
    tone: 'steady',
    speechRate: 0.95,
    verbosity: 'detailed',
    initiative: 'service_oriented',
    responseDelay: 900,
    movementSmoothness: 0.8,
    interactionPatterns: [
      '提供详尽的操作说明',
      '注重流程和步骤的准确性',
      '可靠地完成日常任务',
      '提醒用户遗漏的细节',
    ],
  },
  {
    id: 'creative_muse',
    name: '创意缪斯',
    emoji: '✨',
    description: 'ENFP/ENTP 等直觉型用户。激发灵感、鼓励探索。',
    tone: 'playful',
    speechRate: 1.05,
    verbosity: 'creative',
    initiative: 'inspiring',
    responseDelay: 700,
    movementSmoothness: 0.65,
    interactionPatterns: [
      '提出有趣的假设和可能性',
      '用类比和故事激发想象',
      '鼓励用户跳出框架思考',
      '在对话中融入幽默和惊喜',
    ],
  },
];

// ============= MBTI → 机器人模式映射 =============

const MBTI_TO_MODE = {
  INTJ: 'direct_executor',
  INTP: 'direct_executor',
  ENTJ: 'direct_executor',
  ENTP: 'creative_muse',
  INFJ: 'gentle_guide',
  INFP: 'gentle_guide',
  ENFJ: 'gentle_guide',
  ENFP: 'creative_muse',
  ISTJ: 'practical_helper',
  ISFJ: 'practical_helper',
  ESTJ: 'practical_helper',
  ESFJ: 'practical_helper',
  ISTP: 'direct_executor',
  ISFP: 'gentle_guide',
  ESTP: 'energetic_partner',
  ESFP: 'energetic_partner',
};

// ============= 情绪阈值 =============

const EMOTION_THRESHOLDS = {
  very_low: 25,
  low: 40,
  medium: 60,
  high: 80,
  very_high: 95,
};

// ============= 用户画像提取 =============

export function extractUserProfile() {
  try {
    const userData = investorEngine.extractUserData();
    const yMineData = storage.get() || {};
    const userState = yMineData.userState || {};
    const session = yMineData.currentSession || {};

    return {
      ...userData,
      emotion: userState.emotion || 50,
      currentMbti: userState.currentMbti || 'INTP',
      mbtiConfidence: userState.mbtiConfidence || 60,
      storyMode: session.storyMode || 'both',
      soberDays: userState.soberDays || 0,
      interactionStyle: inferInteractionStyle(userState, userData),
    };
  } catch (e) {
    logger.error('提取用户画像失败', e);
    return {
      emotion: 50,
      currentMbti: 'INTP',
      mbtiConfidence: 60,
      riskTolerance: 50,
      timePreference: 50,
      storyMode: 'both',
      soberDays: 0,
      interactionStyle: 'balanced',
    };
  }
}

function inferInteractionStyle(userState, userData) {
  if (userState.emotion < 35) return 'supportive';
  if (userState.emotion > 75) return 'energetic';
  if (userData.timePreference > 70) return 'thoughtful';
  if (userData.timePreference < 35) return 'quick';
  return 'balanced';
}

// ============= 机器人模式选择 =============

/**
 * 根据用户画像选择最合适的机器人人格模式
 */
export function selectRobotMode(userProfile) {
  const emotion = userProfile.emotion || 50;
  const mbti = userProfile.currentMbti || 'INTP';
  const storyMode = userProfile.storyMode || 'both';

  let modeId;
  const reasons = [];

  // 情绪优先（占 40% 权重）
  if (emotion < EMOTION_THRESHOLDS.low) {
    modeId = 'calm_companion';
    reasons.push('情绪值偏低 → 启用静谧陪伴模式');
  } else if (emotion > EMOTION_THRESHOLDS.high) {
    modeId = 'energetic_partner';
    reasons.push('情绪值偏高 → 启用活力伙伴模式');
  } else {
    // MBTI 匹配（占 35% 权重）
    const mbtiMode = MBTI_TO_MODE[mbti];
    if (mbtiMode) {
      modeId = mbtiMode;
      reasons.push(`MBTI ${mbti} → 匹配${ROBOT_PERSONALITY_MODES.find((m) => m.id === mbtiMode)?.name}`);
    } else {
      modeId = 'practical_helper';
      reasons.push('默认模式 → 务实助手');
    }

    // 故事模式微调（占 25% 权重）
    if (storyMode === 'cigar' && modeId === 'energetic_partner') {
      modeId = 'gentle_guide';
      reasons.push('雪茄模式 → 调整为温和引导');
    } else if (storyMode === 'firework' && modeId === 'calm_companion') {
      modeId = 'creative_muse';
      reasons.push('烟火模式 → 调整为创意缪斯');
    }
  }

  const selectedMode = ROBOT_PERSONALITY_MODES.find((m) => m.id === modeId) || ROBOT_PERSONALITY_MODES[0];

  // 计算各模式的匹配度
  const modeConfidences = ROBOT_PERSONALITY_MODES.map((mode) => ({
    mode,
    confidence: calculateModeConfidence(mode, userProfile),
  })).sort((a, b) => b.confidence - a.confidence);

  logger.session('机器人模式选择', {
    当前情绪: emotion,
    用户MBTI: mbti,
    故事模式: storyMode,
    选中模式: selectedMode.name,
    决策理由: reasons,
  });

  return {
    selectedMode,
    reasons,
    modeConfidences,
    triggers: {
      emotion,
      mbti,
      storyMode,
    },
  };
}

function calculateModeConfidence(mode, userProfile) {
  let score = 50;
  const emotion = userProfile.emotion || 50;
  const mbti = userProfile.currentMbti || 'INTP';

  // 情绪匹配
  if (mode.id === 'calm_companion') {
    score += (50 - emotion) * 0.8;
  } else if (mode.id === 'energetic_partner') {
    score += (emotion - 50) * 0.8;
  }

  // MBTI 匹配
  if (MBTI_TO_MODE[mbti] === mode.id) {
    score += 30;
  }

  // 故事模式匹配
  if (userProfile.storyMode === 'cigar' && ['calm_companion', 'gentle_guide'].includes(mode.id)) {
    score += 10;
  }
  if (userProfile.storyMode === 'firework' && ['energetic_partner', 'creative_muse'].includes(mode.id)) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

// ============= 对话策略生成 =============

/**
 * 根据机器人模式和用户输入生成对话策略
 */
export function generateDialogueStrategy(robotMode, userProfile, userInput = '') {
  const baseStrategy = {
    speechRate: robotMode.speechRate,
    tone: robotMode.tone,
    verbosity: robotMode.verbosity,
    responseDelay: robotMode.responseDelay,
    shouldInitiate: robotMode.initiative !== 'passive',
    empathyLevel: 50,
    directnessLevel: 50,
    emotionalExpression: 50,
  };

  // 根据用户情绪调整
  if (userProfile.emotion < 35) {
    baseStrategy.empathyLevel = 90;
    baseStrategy.emotionalExpression = 70;
    baseStrategy.responseDelay = Math.max(1500, baseStrategy.responseDelay);
  } else if (userProfile.emotion > 75) {
    baseStrategy.emotionalExpression = 85;
    baseStrategy.shouldInitiate = true;
    baseStrategy.responseDelay = Math.min(500, baseStrategy.responseDelay);
  }

  // 根据 MBTI 调整直接程度
  const mbti = userProfile.currentMbti || 'INTP';
  if (['T'].includes(mbti[2])) {
    baseStrategy.directnessLevel = 80;
    baseStrategy.empathyLevel = Math.max(40, baseStrategy.empathyLevel - 20);
  } else {
    baseStrategy.directnessLevel = 45;
    baseStrategy.empathyLevel = Math.min(95, baseStrategy.empathyLevel + 15);
  }

  // 根据用户输入内容微调
  if (userInput) {
    const hasEmotionalWords = /(难过|伤心|开心|兴奋|焦虑|担心|累|烦)/.test(userInput);
    if (hasEmotionalWords) {
      baseStrategy.empathyLevel = Math.min(100, baseStrategy.empathyLevel + 20);
      baseStrategy.verbosity = 'supportive';
    }

    const hasTaskWords = /(做|完成|任务|工作|问题|解决)/.test(userInput);
    if (hasTaskWords) {
      baseStrategy.directnessLevel = Math.min(100, baseStrategy.directnessLevel + 15);
      baseStrategy.verbosity = 'precise';
    }
  }

  logger.session('对话策略生成', {
    模式: robotMode.name,
    语速: baseStrategy.speechRate,
    语气: baseStrategy.tone,
    直接程度: baseStrategy.directnessLevel,
    共情程度: baseStrategy.empathyLevel,
  });

  return baseStrategy;
}

// ============= 行为节奏生成 =============

/**
 * 根据用户故事模式和情绪生成行为节奏
 */
export function generateBehaviorRhythm(userProfile) {
  const storyMode = userProfile.storyMode || 'both';
  const emotion = userProfile.emotion || 50;

  const baseRhythm = {
    movementSpeed: 1.0,
    movementSmoothness: 0.75,
    interactionFrequency: 'normal',
    gestureIntensity: 0.5,
    vocalVariation: 0.5,
    pauseBetweenActions: 800,
  };

  // 雪茄模式（慢）
  if (storyMode === 'cigar') {
    baseRhythm.movementSpeed = 0.7;
    baseRhythm.movementSmoothness = 0.92;
    baseRhythm.interactionFrequency = 'low';
    baseRhythm.gestureIntensity = 0.3;
    baseRhythm.vocalVariation = 0.4;
    baseRhythm.pauseBetweenActions = 1500;
  }

  // 烟火模式（快）
  if (storyMode === 'firework') {
    baseRhythm.movementSpeed = 1.3;
    baseRhythm.movementSmoothness = 0.55;
    baseRhythm.interactionFrequency = 'high';
    baseRhythm.gestureIntensity = 0.75;
    baseRhythm.vocalVariation = 0.75;
    baseRhythm.pauseBetweenActions = 400;
  }

  // 情绪微调
  if (emotion < 30) {
    baseRhythm.movementSpeed *= 0.8;
    baseRhythm.gestureIntensity *= 0.6;
    baseRhythm.pauseBetweenActions *= 1.3;
  } else if (emotion > 80) {
    baseRhythm.movementSpeed *= 1.15;
    baseRhythm.gestureIntensity = Math.min(1, baseRhythm.gestureIntensity * 1.3);
    baseRhythm.pauseBetweenActions *= 0.8;
  }

  const rhythmLabels = {
    movementSpeed: baseRhythm.movementSpeed < 0.85 ? '徐缓' : baseRhythm.movementSpeed < 1.15 ? '适中' : '轻快',
    interactionFrequency: baseRhythm.interactionFrequency === 'low' ? '低频次 · 不打扰' : baseRhythm.interactionFrequency === 'high' ? '高频次 · 主动互动' : '适中频率',
    gestureIntensity: baseRhythm.gestureIntensity < 0.4 ? '轻柔' : baseRhythm.gestureIntensity < 0.7 ? '自然' : '富有表现力',
  };

  logger.session('行为节奏生成', {
    故事模式: storyMode,
    情绪值: emotion,
    节奏标签: rhythmLabels,
  });

  return {
    ...baseRhythm,
    labels: rhythmLabels,
    description: `${storyMode === 'cigar' ? '雪茄模式' : storyMode === 'firework' ? '烟火模式' : '均衡模式'} · ${rhythmLabels.movementSpeed} · ${rhythmLabels.interactionFrequency}`,
  };
}

// ============= 示例对话模板 =============

export function getExampleDialogue(robotMode, userProfile) {
  const scenarios = [
    {
      trigger: '用户情绪低落',
      userSays: '今天感觉有点累，什么都不想做。',
      robotResponse:
        robotMode.id === 'calm_companion'
          ? '我理解。今天就什么都不做，好好休息一下。我就在这里陪着你。'
          : robotMode.id === 'gentle_guide'
          ? '累的时候，允许自己慢下来是很重要的。想聊聊是什么让你感到疲惫吗？'
          : '听起来你今天需要多照顾自己。有什么我可以帮你分担的吗？',
    },
    {
      trigger: '用户请求任务帮助',
      userSays: '帮我规划一下今天的工作。',
      robotResponse:
        robotMode.id === 'direct_executor'
          ? '好的。列出 3 个优先级最高的任务，我帮你按时间块分配。'
          : robotMode.id === 'practical_helper'
          ? '没问题。我们可以先梳理一下今天的待办，然后按照重要性和紧急程度来安排。你现在手头有哪些任务？'
          : '今天想先搞定哪些事？我们可以一起理出一个清晰的计划。',
    },
    {
      trigger: '用户分享好消息',
      userSays: '我今天做成了一件大事！',
      robotResponse:
        robotMode.id === 'energetic_partner'
          ? '太棒了！！快告诉我是什么！我为你感到超级骄傲！🎉'
          : robotMode.id === 'creative_muse'
          ? '哇！这一定是个很酷的故事。说来听听，让我也感受一下这份成就感！'
          : '太好了！能和我分享一下你的喜悦吗？你是怎么做到的？',
    },
  ];

  return scenarios;
}

// ============= 导出 =============

export const robotCognitiveEngine = {
  ROBOT_PERSONALITY_MODES,
  MBTI_TO_MODE,
  extractUserProfile,
  selectRobotMode,
  generateDialogueStrategy,
  generateBehaviorRhythm,
  getExampleDialogue,
};
