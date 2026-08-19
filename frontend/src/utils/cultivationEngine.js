/**
 * 培养方案引擎
 *
 * 包含：
 * 1. 阶段判定与进度追踪
 * 2. 六维能力分数计算（对数递减，更符合真实能力曲线）
 * 3. 薄弱项识别与优先级排序
 * 4. 智能今日任务生成（与薄弱项联动）
 * 5. 分层提升建议（按分数区间给出不同建议）
 */

import { logger } from './logger';

// ============================================================
// 阶段配置
// ============================================================
export const PHASE_CONFIG = [
  {
    key: 'foundation',
    label: '基础期',
    duration: '2周',
    desc: '建立行为数据基线，培养基本纪律',
    unlocks: ['解锁基本训练任务', '解锁能力维度追踪'],
  },
  {
    key: 'enhance',
    label: '强化期',
    duration: '4周',
    desc: '针对薄弱项集中训练，形成习惯',
    unlocks: ['解锁薄弱项专项训练', '解锁挑战赛模式', '解锁调酒沙盘'],
  },
  {
    key: 'master',
    label: '精通期',
    duration: '持续',
    desc: '稳定优势，拓展边界，融会贯通',
    unlocks: ['解锁大师级任务', '解锁自定义训练计划', '解锁成就系统'],
  },
];

export const PHASE_THRESHOLDS = {
  foundation_max: 10,
  enhance_max: 30,
};

// ============================================================
// 六维能力配置
// ============================================================
export const DIMENSION_KEYS = {
  DISCIPLINE: 'discipline',
  RISK_CONTROL: 'riskControl',
  DECISION_SPEED: 'decisionSpeed',
  EMOTIONAL_STABILITY: 'emotionalStability',
  CREATIVITY: 'creativity',
  ENDURANCE: 'endurance',
};

export const DIMENSION_CONFIG = {
  [DIMENSION_KEYS.DISCIPLINE]: { label: '纪律性', color: '#a78bfa' },
  [DIMENSION_KEYS.RISK_CONTROL]: { label: '风险控制', color: '#34d399' },
  [DIMENSION_KEYS.DECISION_SPEED]: { label: '决策速度', color: '#fbbf24' },
  [DIMENSION_KEYS.EMOTIONAL_STABILITY]: { label: '情绪稳定', color: '#f472b6' },
  [DIMENSION_KEYS.CREATIVITY]: { label: '创造力', color: '#60a5fa' },
  [DIMENSION_KEYS.ENDURANCE]: { label: '耐力', color: '#f97316' },
};

export const WEAK_DIMENSION_THRESHOLD = 65;

// ============================================================
// 分数计算配置（可调整的参数集中管理）
// ============================================================
export const SCORE_CONFIG = {
  baseScore: 50,
  maxScore: 95,
  // 对数缩放因子：控制分数增长的"天花板"效应
  // 值越大，早期增长越快，但天花板也越低
  logScaleFactor: 8,
  // 各维度的权重配置
  weights: {
    discipline: {
      fitnessCompletion: 0.4,
      pokerSessionCount: 0.5,
    },
    riskControl: {
      pokerRiskAvg: 0.3,
    },
    decisionSpeed: {
      billiardsSessionCount: 0.6,
    },
    emotionalStability: {
      pokerTiltAvg: 0.4,
      bartenderSessionCount: 0.3,
    },
    creativity: {
      bartenderSessionCount: 0.8,
    },
    endurance: {
      fitnessDurationAvg: 0.3,
      fitnessSessionCount: 0.4,
    },
  },
};

// ============================================================
// 任务配置
// ============================================================
const TASK_TEMPLATES = {
  poker: {
    id: 'poker',
    title: '德州扑克训练 30分钟',
    desc: '专注风险控制与情绪管理',
    icon: '🎴',
    basePriority: 'high',
    relatedDimensions: [DIMENSION_KEYS.RISK_CONTROL, DIMENSION_KEYS.EMOTIONAL_STABILITY],
  },
  fitness: {
    id: 'fitness',
    title: '健身训练 45分钟',
    desc: '选择力量或有氧，磨炼纪律性',
    icon: '💪',
    basePriority: 'high',
    relatedDimensions: [DIMENSION_KEYS.DISCIPLINE, DIMENSION_KEYS.ENDURANCE],
  },
  billiards: {
    id: 'billiards',
    title: '台球训练 20分钟',
    desc: '练习瞄准与决策速度',
    icon: '🎱',
    basePriority: 'medium',
    relatedDimensions: [DIMENSION_KEYS.DECISION_SPEED],
  },
  bartender: {
    id: 'bartender',
    title: '调酒自我觉察 15分钟',
    desc: '回顾今日情绪，做一杯心情特调',
    icon: '🍸',
    basePriority: 'low',
    relatedDimensions: [DIMENSION_KEYS.CREATIVITY, DIMENSION_KEYS.EMOTIONAL_STABILITY],
  },
  meditation: {
    id: 'meditation',
    title: 'K线音乐冥想 10分钟',
    desc: '用音乐校准情绪基线',
    icon: '🎵',
    basePriority: 'low',
    relatedDimensions: [DIMENSION_KEYS.EMOTIONAL_STABILITY],
  },
};

// ============================================================
// 工具函数
// ============================================================

/**
 * 计算数组中某个数值字段的平均值
 */
const calcAvg = (arr, key, defaultValue = 50) => {
  if (!arr || arr.length === 0) return defaultValue;
  const valid = arr.filter(item => typeof item[key] === 'number');
  if (valid.length === 0) return defaultValue;
  return Math.round(valid.reduce((sum, item) => sum + item[key], 0) / valid.length);
};

/**
 * 对数缩放：将线性输入转换为有天花板效应的输出
 * 模拟真实能力曲线：初期进步快，后期逐渐趋于稳定
 *
 * @param {number} count - 线性计数值（如训练次数）
 * @param {number} scaleFactor - 缩放因子（默认 8）
 * @param {number} maxOutput - 最大输出值（默认 45）
 * @returns {number} 缩放后的加分值
 */
const logScale = (count, scaleFactor = SCORE_CONFIG.logScaleFactor, maxOutput = 45) => {
  if (count <= 0) return 0;
  // log(1) = 0, log(count + 1) 保证正数
  // scaleFactor 控制曲线陡峭度
  const raw = Math.log(count + 1) * scaleFactor;
  return Math.min(raw, maxOutput);
};

/**
 * 将分数提升到优先级：分数越低，优先级越高
 */
const scoreToPriority = (score) => {
  if (score < 50) return 'high';
  if (score < 65) return 'medium';
  return 'low';
};

// ============================================================
// 阶段判定函数
// ============================================================

/**
 * 根据累计训练次数判定当前所处阶段
 *
 * @param {number} totalSessions - 累计训练次数
 * @returns {object} 阶段配置对象
 */
export const determinePhase = (totalSessions) => {
  const sessions = typeof totalSessions === 'number' ? totalSessions : 0;

  if (sessions < PHASE_THRESHOLDS.foundation_max) {
    return PHASE_CONFIG[0];
  }
  if (sessions < PHASE_THRESHOLDS.enhance_max) {
    return PHASE_CONFIG[1];
  }
  return PHASE_CONFIG[2];
};

/**
 * 计算阶段进度：当前阶段完成度百分比 + 距离下一阶段还需多少次
 *
 * @param {number} totalSessions - 累计训练次数
 * @returns {object} 进度信息
 */
export const calculatePhaseProgress = (totalSessions) => {
  const sessions = typeof totalSessions === 'number' ? totalSessions : 0;

  if (sessions < PHASE_THRESHOLDS.foundation_max) {
    // 基础期
    return {
      currentPhase: PHASE_CONFIG[0],
      nextPhase: PHASE_CONFIG[1],
      currentProgress: (sessions / PHASE_THRESHOLDS.foundation_max) * 100,
      sessionsNeeded: PHASE_THRESHOLDS.foundation_max - sessions,
      isFinalPhase: false,
    };
  }
  if (sessions < PHASE_THRESHOLDS.enhance_max) {
    // 强化期
    const range = PHASE_THRESHOLDS.enhance_max - PHASE_THRESHOLDS.foundation_max;
    const current = sessions - PHASE_THRESHOLDS.foundation_max;
    return {
      currentPhase: PHASE_CONFIG[1],
      nextPhase: PHASE_CONFIG[2],
      currentProgress: (current / range) * 100,
      sessionsNeeded: PHASE_THRESHOLDS.enhance_max - sessions,
      isFinalPhase: false,
    };
  }
  // 精通期（最终阶段）
  return {
    currentPhase: PHASE_CONFIG[2],
    nextPhase: null,
    currentProgress: 100,
    sessionsNeeded: 0,
    isFinalPhase: true,
  };
};

// ============================================================
// 统计会话总数
// ============================================================

/**
 * 计算所有训练类型的累计会话数
 * @param {object} data - appStore 的 data 对象
 * @returns {number} 总会话数
 */
export const calculateTotalSessions = (data) => {
  if (!data) return 0;
  const {
    pokerGames = [],
    billiardsGames = [],
    fitnessSessions = [],
    bartenderSessions = [],
  } = data;
  return (
    pokerGames.length +
    billiardsGames.length +
    fitnessSessions.length +
    bartenderSessions.length
  );
};

// ============================================================
// 六维能力分数计算（对数递减版本）
// ============================================================

/**
 * 根据行为数据计算六维能力分数
 *
 * 改进点：
 * 1. 使用对数缩放替代线性增长，符合真实能力曲线
 * 2. 各维度的基础分不同（决策速度和创造力基础分更高）
 * 3. 权重配置化，便于后续调整
 *
 * @param {object} data - appStore 的 data 对象
 * @returns {object} 六维分数对象
 */
export const calculateDimensionScores = (data) => {
  if (!data) {
    return {
      discipline: SCORE_CONFIG.baseScore,
      riskControl: SCORE_CONFIG.baseScore,
      decisionSpeed: SCORE_CONFIG.baseScore + 5,
      emotionalStability: SCORE_CONFIG.baseScore,
      creativity: SCORE_CONFIG.baseScore + 5,
      endurance: SCORE_CONFIG.baseScore,
    };
  }

  const pokerGames = data.pokerGames || [];
  const billiardsGames = data.billiardsGames || [];
  const fitnessSessions = data.fitnessSessions || [];
  const bartenderSessions = data.bartenderSessions || [];

  const w = SCORE_CONFIG.weights;

  // 预计算各种指标
  const fitnessCompletionAvg = calcAvg(fitnessSessions, 'completion');
  const pokerRiskAvg = calcAvg(pokerGames, 'riskScore');
  const pokerTiltAvg = calcAvg(pokerGames, 'tiltScore');
  const fitnessDurationAvg = calcAvg(fitnessSessions, 'duration');

  // 使用对数缩放计算次数带来的加分
  const pokerCountBonus = logScale(pokerGames.length);
  const billiardsCountBonus = logScale(billiardsGames.length);
  const fitnessCountBonus = logScale(fitnessSessions.length);
  const bartenderCountBonus = logScale(bartenderSessions.length);

  return {
    // 纪律性：健身完成率（基础）+ 训练次数（坚持）
    discipline: Math.min(
      SCORE_CONFIG.maxScore,
      SCORE_CONFIG.baseScore
        + fitnessCompletionAvg * w.discipline.fitnessCompletion
        + pokerCountBonus * w.discipline.pokerSessionCount
    ),

    // 风险控制：德州扑克风险分数均值
    riskControl: Math.min(
      SCORE_CONFIG.maxScore,
      SCORE_CONFIG.baseScore + pokerRiskAvg * w.riskControl.pokerRiskAvg
    ),

    // 决策速度：台球次数（经验）
    decisionSpeed: Math.min(
      SCORE_CONFIG.maxScore,
      SCORE_CONFIG.baseScore + 5 + billiardsCountBonus * w.decisionSpeed.billiardsSessionCount
    ),

    // 情绪稳定：德州 tilt 分数 + 调酒自我觉察
    emotionalStability: Math.min(
      SCORE_CONFIG.maxScore,
      SCORE_CONFIG.baseScore
        + pokerTiltAvg * w.emotionalStability.pokerTiltAvg
        + bartenderCountBonus * w.emotionalStability.bartenderSessionCount
    ),

    // 创造力：调酒体验次数
    creativity: Math.min(
      SCORE_CONFIG.maxScore,
      SCORE_CONFIG.baseScore + 5 + bartenderCountBonus * w.creativity.bartenderSessionCount
    ),

    // 耐力：健身时长 + 健身次数
    endurance: Math.min(
      SCORE_CONFIG.maxScore,
      SCORE_CONFIG.baseScore
        + fitnessDurationAvg * w.endurance.fitnessDurationAvg
        + fitnessCountBonus * w.endurance.fitnessSessionCount
    ),
  };
};

// ============================================================
// 薄弱项识别
// ============================================================

/**
 * 识别低于阈值的薄弱维度
 *
 * @param {object} scores - 六维分数对象
 * @param {number} threshold - 薄弱阈值（默认65）
 * @returns {Array} 薄弱维度数组，按分数从低到高排序
 */
export const identifyWeakDimensions = (scores, threshold = WEAK_DIMENSION_THRESHOLD) => {
  if (!scores) return [];

  return Object.entries(scores)
    .filter(([, score]) => typeof score === 'number' && score < threshold)
    .map(([key, score]) => ({
      key,
      score,
      priority: scoreToPriority(score),
      ...DIMENSION_CONFIG[key],
    }))
    .sort((a, b) => a.score - b.score);
};

// ============================================================
// 获取提升建议（分层版本）
// ============================================================

/**
 * 根据维度 key 和当前分数获取对应的提升建议
 *
 * 改进点：
 * 1. 根据分数区间给出不同建议（入门 / 进阶 / 精通）
 * 2. 建议更有针对性，符合当前能力水平
 *
 * @param {string} dimensionKey - 维度 key
 * @param {number} currentScore - 当前分数（用于分层建议）
 * @returns {string} 提升建议文本
 */
export const getImprovementSuggestion = (dimensionKey, currentScore = 50) => {
  // 根据分数确定建议层级
  let tier = 'beginner';
  if (currentScore >= 50 && currentScore < 70) tier = 'intermediate';
  if (currentScore >= 70) tier = 'advanced';

  const suggestionsByTier = {
    [DIMENSION_KEYS.DISCIPLINE]: {
      beginner: '先建立固定的训练时间表，每天同一时段开始训练，闹钟响了就行动',
      intermediate: '尝试增加训练计划的执行率，设定"不打折"原则：计划了就一定要做',
      advanced: '挑战连续训练纪录，用打卡链的力量保持惯性，帮助他人建立纪律',
    },
    [DIMENSION_KEYS.RISK_CONTROL]: {
      beginner: '德州扑克中只玩优质牌（前10%起手牌），其他牌全部弃掉',
      intermediate: '练习底池赔率计算，只在赔率有利时跟注，减少激进加注',
      advanced: '平衡你的下注范围，在价值下注和诈唬之间找到合适的比例',
    },
    [DIMENSION_KEYS.DECISION_SPEED]: {
      beginner: '台球训练时设定 10 秒思考时限，到时间必须出杆，不追求完美',
      intermediate: '练习"看一眼就瞄准"，减少反复校准的时间，相信肌肉记忆',
      advanced: '尝试快节奏模式，在压力下保持决策质量，训练直觉反应',
    },
    [DIMENSION_KEYS.EMOTIONAL_STABILITY]: {
      beginner: '连续输牌时强制休息 5 分钟，站起来走一走，做深呼吸',
      intermediate: '记录 tilt 触发点日志，了解自己在什么情况下容易失控，提前预防',
      advanced: '练习"观察情绪但不被带走"，输一把大的之后微笑，然后专注下一把',
    },
    [DIMENSION_KEYS.CREATIVITY]: {
      beginner: '尝试 3 种不同的基酒，每种都调一杯最经典的配方，体验差异',
      intermediate: '挑战"用冰箱里现有的材料调酒"，打破配方依赖，即兴创作',
      advanced: '尝试跨界融合：把中国茶、香料等元素融入调酒，形成个人风格',
    },
    [DIMENSION_KEYS.ENDURANCE]: {
      beginner: '每次健身多坚持 1 组，最后 1 组时告诉自己"再多做 3 个"',
      intermediate: '尝试延长单次训练时长 15 分钟，或增加训练频率到每周 4 次',
      advanced: '挑战一次高强度间歇训练（HIIT），在极限状态下训练意志品质',
    },
  };

  const dimensionSuggestions = suggestionsByTier[dimensionKey];
  if (!dimensionSuggestions) {
    return '继续保持训练频率，逐步提升';
  }
  return dimensionSuggestions[tier] || dimensionSuggestions.intermediate;
};

// ============================================================
// 今日任务生成（智能版本：与薄弱项联动）
// ============================================================

/**
 * 根据当日训练记录和薄弱项分析生成今日任务
 *
 * 改进点：
 * 1. 与薄弱项联动：优先推荐能提升最低维度的训练
 * 2. 优先级动态调整：如果某项能力是薄弱项，相关任务升级为高优先
 * 3. 任务顺序按相关维度的分数从低到高排列
 *
 * @param {object} data - appStore 的 data 对象
 * @param {object} scores - 六维分数（可选，不传则自动计算）
 * @returns {Array} 任务列表
 */
export const generateTodayTasks = (data, scores) => {
  const today = new Date().toDateString();

  const hasSessionToday = (sessions) => {
    if (!sessions || sessions.length === 0) return false;
    return sessions.some(s => new Date(s.createdAt || s.timestamp).toDateString() === today);
  };

  const playedPokerToday = hasSessionToday(data?.pokerGames);
  const playedBilliardsToday = hasSessionToday(data?.billiardsGames);
  const exercisedToday = hasSessionToday(data?.fitnessSessions);

  // 如果没传分数，就计算一下
  const currentScores = scores || calculateDimensionScores(data);

  // 获取每个维度的"紧急度"（分数越低越紧急）
  const getDimensionUrgency = (dimKey) => {
    const score = currentScores[dimKey] || 50;
    return 100 - score; // 分数越低，紧急度越高
  };

  // 构建任务：根据相关维度的紧急度调整优先级
  const buildTask = (template, shouldInclude) => {
    if (!shouldInclude) return null;

    // 计算该任务的综合紧急度（相关维度的紧急度均值）
    const avgUrgency = template.relatedDimensions.reduce(
      (sum, dim) => sum + getDimensionUrgency(dim),
      0
    ) / template.relatedDimensions.length;

    // 根据紧急度确定最终优先级
    let priority = template.basePriority;
    if (avgUrgency > 45) priority = 'high'; // 相关维度低于 55 分
    else if (avgUrgency > 30) priority = 'medium'; // 相关维度低于 70 分

    return {
      ...template,
      priority,
      urgency: avgUrgency,
    };
  };

  const tasks = [
    buildTask(TASK_TEMPLATES.poker, !playedPokerToday),
    buildTask(TASK_TEMPLATES.fitness, !exercisedToday),
    buildTask(TASK_TEMPLATES.billiards, !playedBilliardsToday),
    // 日常任务每天都有
    buildTask(TASK_TEMPLATES.bartender, true),
    buildTask(TASK_TEMPLATES.meditation, true),
  ].filter(Boolean);

  // 按紧急度从高到低排序
  tasks.sort((a, b) => b.urgency - a.urgency);

  logger.session('生成今日任务', `${tasks.length}项`);
  return tasks;
};
