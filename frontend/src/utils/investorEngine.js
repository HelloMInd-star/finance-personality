/**
 * 投资人档案对照引擎
 *
 * 功能：
 * - 名人档案库（10位投资人 + 10位创业家，统一人物源：benchmarkProfiles）
 * - 用户行为数据 → 投资人/创业家匹配引擎
 * - 加权欧几里得距离匹配算法
 * - 共同点/差异点生成
 * - 相似度趋势追踪
 * - 针对性提升建议生成
 */

import { logger } from './logger';
import { storage } from './storage';
import { getMatchProfiles } from './profileMatchExtras';

// ============================================================
// 引擎配置（所有可调参数集中管理）
// ============================================================
export const ENGINE_CONFIG = {
  // 用户数据归一化的基准值和权重
  normalization: {
    riskBase: 20,
    riskAllInWeight: 50,
    riskKellyWeight: 60,
    timeBase: 30,
    timeMaxDecisionTime: 15,
    timeWeight: 50,
    reflectionMultiplier: 2,
    aimTimeMultiplier: 8,
    defaultKelly: 0.5,
    defaultDecisionTime: 5,
    defaultReflection: 20,
    defaultAimTime: 5,
    defaultCompletion: 70,
  },
  // 匹配算法的维度权重（越大越重要）
  dimensionWeights: {
    riskTolerance: 1.2,       // 风险偏好：投资人风格的核心
    timePreference: 1.0,      // 时间偏好：区分长期 vs 短线
    executionDiscipline: 0.9, // 执行纪律：重要但可以培养
    reflectionDeviation: 0.8, // 路径预判：认知能力
    aimPrecision: 0.7,        // 决策观察：习惯问题
  },
  // 相似度计算相关
  matching: {
    preferenceBoost: 20,      // 偏好投资人的相似度加成
    maxPreferenceBoost: 99,   // 偏好加成后的上限
  },
  // 共同点/差异点判定阈值
  thresholds: {
    commonPoint: 15,          // 差异小于这个值算共同点
    differencePoint: 25,      // 差异大于这个值算差异点
    highValue: 60,            // 高于这个值算"激进/积极"
  },
  // 相似度等级划分
  similarityTiers: [
    { min: 85, label: '高度契合', color: '#34d399' },
    { min: 70, label: '较为相似', color: '#60a5fa' },
    { min: 55, label: '部分相似', color: '#fbbf24' },
    { min: 0, label: '风格迥异', color: '#f87171' },
  ],
};

// ============================================================
// 维度配置（统一管理，避免重复定义）
// ============================================================
export const DIMENSION_CONFIG = [
  {
    key: 'riskTolerance',
    label: '风险偏好',
    commonThreshold: ENGINE_CONFIG.thresholds.commonPoint,
    diffThreshold: ENGINE_CONFIG.thresholds.differencePoint,
    pos: '你们在不确定性面前，都倾向于控制风险',
    neg: '你们都愿意为了更高收益承担一定风险',
    higherLabel: '更激进',
    lowerLabel: '更保守',
  },
  {
    key: 'timePreference',
    label: '时间偏好',
    commonThreshold: ENGINE_CONFIG.thresholds.commonPoint,
    diffThreshold: ENGINE_CONFIG.thresholds.differencePoint,
    pos: '你们都更看重长期价值，愿意耐心等待',
    neg: '你们都偏向快速行动，追求短期结果',
    higherLabel: '更看重长期',
    lowerLabel: '更偏向短期',
  },
  {
    key: 'executionDiscipline',
    label: '执行纪律',
    commonThreshold: 10,
    diffThreshold: ENGINE_CONFIG.thresholds.differencePoint,
    pos: '你们的执行纪律都很稳定，极少中途中断',
    neg: '你们都倾向于灵活调整，不拘泥于原计划',
    higherLabel: '更有纪律',
    lowerLabel: '更灵活',
  },
  {
    key: 'reflectionDeviation',
    label: '路径预判能力',
    commonThreshold: ENGINE_CONFIG.thresholds.commonPoint,
    diffThreshold: ENGINE_CONFIG.thresholds.differencePoint,
    pos: '你们都擅长预判事物的走向，偏差很小',
    neg: '你们都偏向直觉决策，不纠结于精确预测',
    higherLabel: '预判更准',
    lowerLabel: '更依赖直觉',
  },
  {
    key: 'aimPrecision',
    label: '决策前观察',
    commonThreshold: ENGINE_CONFIG.thresholds.commonPoint,
    diffThreshold: ENGINE_CONFIG.thresholds.differencePoint,
    pos: '你们都喜欢长时间观察后再出手',
    neg: '你们决策速度都很快，不拖延',
    higherLabel: '观察更久',
    lowerLabel: '决策更快',
  },
];

// ============================================================
// 提升建议配置
// ============================================================
const IMPROVEMENT_ADVICE = {
  riskTolerance: {
    increase: [
      '可以尝试在小仓位下体验更高风险的决策，观察自己的情绪反应',
      '设置一个"风险预算"：每月用不超过总资产 5% 的资金做高风险尝试',
      '练习在不确定性中做决策：从信息不完整的小事开始训练',
    ],
    decrease: [
      '每次决策前问自己：最坏情况是什么？我能接受吗？',
      '建立强制止损规则：亏损达到 10% 时必须退出，不抱侥幸心理',
      '把大决策拆成小步骤，逐步验证，避免一次性押注过多',
    ],
  },
  timePreference: {
    increase: [
      '尝试持有一项投资超过 1 年，体验时间带来的复利效应',
      '每周回顾一次长期目标，而不是每天看短期波动',
      '练习延迟满足：把想买的东西放进购物车，3 天后再决定',
    ],
    decrease: [
      '设定明确的短期目标和截止日期，用倒计时增加紧迫感',
      '把大目标拆成周目标，每周都要有可交付的结果',
      '练习快速决策：给自己 10 分钟时限，到时间必须选择',
    ],
  },
  executionDiscipline: {
    increase: [
      '建立固定的"启动仪式"：每天同一时间、同一地点开始工作',
      '用打卡链记录连续执行天数，不要轻易打破链条',
      '计划只做 70% 满，留出 30% 弹性空间，更容易坚持',
    ],
    decrease: [
      '每周安排一个"灵活日"，这一天不做任何计划，完全随性',
      '练习在执行中途调整方案，不要被计划绑架',
      '尝试"足够好"原则：80 分就交付，不追求 100 分完美',
    ],
  },
  reflectionDeviation: {
    increase: [
      '每次决策后写复盘：我预判了什么？实际发生了什么？偏差在哪？',
      '训练二阶思维：不仅想"会发生什么"，还要想"然后呢？"',
      '读历史：研究类似情况下别人是怎么决策的，结果如何',
    ],
    decrease: [
      '练习"完成比完美重要"：先行动，在行动中调整方向',
      '设定决策时限：信息收集到 60% 就必须做出选择',
      '相信直觉：有时候你的潜意识已经处理了大量信息',
    ],
  },
  aimPrecision: {
    increase: [
      '每次决策前强制等待 30 秒，深呼吸，问自己三个问题',
      '建立决策检查清单：行动前逐项核对，避免遗漏关键因素',
      '练习观察能力：在人群中待 10 分钟，记录你注意到的 5 个细节',
    ],
    decrease: [
      '用倒计时强迫自己做决定：10 秒内必须选择',
      '练习"先开枪后瞄准"：先做，再根据反馈调整',
      '设定"每日快速决策数"目标：今天至少快速做 5 个决定',
    ],
  },
};

// ============================================================
// 投资人/创业家档案库（统一人物源：benchmarkProfiles）
// ============================================================

// 投资人匹配结果展示用增强字段（名言 + 匹配描述），人物主体数据来自 benchmarkProfiles
// 注：蒂尔(temples)与 benchmarkProfiles 的邓普顿(templeton) 冲突，已统一为邓普顿
const DISPLAY_EXTRA = {
  buffett:  { famousQuote: '我最喜欢的持有期是永远。',     matchDescription: '你像巴菲特一样，相信时间的价值，愿意长期持有正确的选择。' },
  munger:   { famousQuote: '反过来想，总是反过来想。',     matchDescription: '你和芒格一样，习惯从多个角度思考问题，不随波逐流。' },
  sorros:   { famousQuote: '对错不重要，正确时赚了多少才重要。', matchDescription: '你像索罗斯一样，敢于在关键时刻下重注，追求快速回报。' },
  dalio:    { famousQuote: '痛苦 + 反思 = 进步。',         matchDescription: '你和达利欧一样，相信系统和原则的力量，追求稳定的长期表现。' },
  lynch:    { famousQuote: '投资你所知道的。',             matchDescription: '你像林奇一样，保持好奇心，愿意从生活中发现机会并灵活调整。' },
  son:      { famousQuote: '要么做第一，要么做唯一。',     matchDescription: '你和孙正义一样，拥有宏大的愿景，愿意为了远大目标承担高风险。' },
  graham:   { famousQuote: '市场短期是投票机，长期是称重机。', matchDescription: '你像格雷厄姆一样，极度重视安全边际，宁愿错过也不冒进。' },
  paulson:  { famousQuote: '当机会来临时，下重注。',       matchDescription: '你和保尔森一样，平时耐心等待，机会出现时果断出手。' },
  icahn:    { famousQuote: '买低卖高，华尔街的真理。',     matchDescription: '你像伊坎一样，行动迅速，敢于打破现状，追求短期高效回报。' },
  templeton:{ famousQuote: '在极度悲观点买入。',           matchDescription: '你和邓普顿一样，拥有全球视野，敢于在至暗时刻逆向布局。' },
};

// 创业家匹配结果展示用增强字段
const ENTREPRENEUR_DISPLAY_EXTRA = {
  jobs:  { famousQuote: 'Stay hungry, stay foolish. 求知若饥，虚心若愚。', matchDescription: '你像乔布斯一样，追求极致品味，用最简的表达直击本质。' },
  musk:  { famousQuote: '如果一件事足够重要，即使胜算不大，你也应该去做。', matchDescription: '你像马斯克一样，用第一性原理打破常规，敢于为愿景押上一切。' },
  bezos: { famousQuote: '善良比聪明更难。',               matchDescription: '你像贝佐斯一样，信奉长期主义，愿意为七年后依然正确的事情坚持。' },
  ma:    { famousQuote: '今天很残酷，明天更残酷，后天很美好。', matchDescription: '你像马云一样，使命驱动，敢于在寒冬里坚持到黎明。' },
  ponyo: { famousQuote: '做产品要像小白一样思考，像专家一样行动。', matchDescription: '你像马化腾一样，深谙产品与连接，用克制换来生态的繁荣。' },
  zhang: { famousQuote: '延迟满足感的本质是克服人性的弱点。', matchDescription: '你像张一鸣一样，用算法和理性做决策，相信延迟满足的力量。' },
  lei:   { famousQuote: '站在风口上，猪都能飞起来。',     matchDescription: '你像雷军一样，顺势而为，用极致的性价比撬动市场。' },
  huang: { famousQuote: '五环内的人理解不了拼多多。',     matchDescription: '你像黄峥一样，洞察被忽视的普惠需求，用游戏化重构交易。' },
  wang:  { famousQuote: '对未来越有信心，对现在越有耐心。', matchDescription: '你像王兴一样，深度思考，把长期主义刻进每一次扩张。' },
  li:    { famousQuote: '认知的成长比业务的成长更重要。', matchDescription: '你像李想一样，产品经理思维，用执行力解决用户真实的痛点。' },
};

/**
 * 构建带完整匹配字段的人物列表
 * 合并顺序：benchmarkProfiles 基础人物 → MATCH_EXTRA(5维) → DISPLAY_EXTRA(展示文案)
 */
function buildProfiles(type) {
  const displayExtra = type === 'entrepreneur' ? ENTREPRENEUR_DISPLAY_EXTRA : DISPLAY_EXTRA;
  return getMatchProfiles(type).map(p => {
    const extra = displayExtra[p.id] || {};
    return { ...p, ...extra };
  });
}

/** 10 位投资人（含 5 维匹配 + 展示字段），兼容旧引用 */
export const INVESTOR_PROFILES = buildProfiles('investor');

/** 10 位创业家（含 5 维匹配 + 展示字段） */
export const ENTREPRENEUR_PROFILES = buildProfiles('entrepreneur');

// ============================================================
// 用户数据归一化
// ============================================================

/**
 * 从 localStorage 中提取用户行为数据，生成归一化向量
 */
export function extractUserData() {
  const cfg = ENGINE_CONFIG.normalization;

  try {
    const parsed = storage.get() || {};

    // 德州数据
    const pokerGames = parsed.pokerGames || [];
    const avgKelly = pokerGames.length > 0
      ? pokerGames.reduce((a, g) => a + (g.kellyRatio || cfg.defaultKelly), 0) / pokerGames.length
      : cfg.defaultKelly;
    const avgDecisionTime = pokerGames.length > 0
      ? pokerGames.reduce((a, g) => a + (g.avgDecisionTime || cfg.defaultDecisionTime), 0) / pokerGames.length
      : cfg.defaultDecisionTime;
    const allInFreq = pokerGames.length > 0
      ? pokerGames.filter(g => g.actions?.some(a => a.action === 'all-in')).length / pokerGames.length
      : 0;

    // 台球数据
    const billiardsSessions = parsed.billiardsSessions || [];
    const avgReflection = billiardsSessions.length > 0
      ? billiardsSessions.reduce((a, s) => a + (s.mood?.avgDeviation || cfg.defaultReflection), 0) / billiardsSessions.length
      : cfg.defaultReflection;
    const avgAimTime = billiardsSessions.length > 0
      ? billiardsSessions.reduce((a, s) => {
        const shots = s.shots || [];
        if (shots.length === 0) return a;
        return a + shots.reduce((b, sh) => b + (sh.aimDuration || cfg.defaultAimTime), 0) / shots.length;
      }, 0) / billiardsSessions.length
      : cfg.defaultAimTime;

    // 健身数据
    const fitnessSessions = parsed.fitnessSessions || [];
    const avgCompletion = fitnessSessions.length > 0
      ? fitnessSessions.reduce((a, s) => a + (s.deviation?.completionRate || cfg.defaultCompletion), 0) / fitnessSessions.length
      : cfg.defaultCompletion;

    // 故事选择
    const bartenderSessions = parsed.bartenderSessions || [];
    const cigarCount = bartenderSessions.filter(s => s.storySeed?.includes('夜路') || s.storySeed?.includes('沉默')).length;
    const fireworkCount = bartenderSessions.filter(s => s.storySeed?.includes('冒险') || s.storySeed?.includes('回头')).length;
    const storyPref = cigarCount > fireworkCount ? 'cigar' : fireworkCount > cigarCount ? 'firework' : 'both';

    return {
      // 原始数据
      pokerGames,
      billiardsSessions,
      fitnessSessions,
      bartenderSessions,
      // 归一化特征
      riskTolerance: Math.round(cfg.riskBase + allInFreq * cfg.riskAllInWeight + (avgKelly - cfg.defaultKelly) * cfg.riskKellyWeight),
      timePreference: Math.round(cfg.timeBase + (1 - Math.min(1, avgDecisionTime / cfg.timeMaxDecisionTime)) * cfg.timeWeight),
      executionDiscipline: Math.round(avgCompletion),
      reflectionDeviation: Math.round(100 - avgReflection * cfg.reflectionMultiplier),
      aimPrecision: Math.round(100 - Math.min(100, avgAimTime * cfg.aimTimeMultiplier)),
      kellyDeviation: (avgKelly - cfg.defaultKelly) * 2,
      storyPreference: storyPref
    };
  } catch (e) {
    logger.error('提取用户行为数据失败', e);
    return {
      riskTolerance: 50,
      timePreference: 50,
      executionDiscipline: cfg.defaultCompletion,
      reflectionDeviation: 50,
      aimPrecision: 50,
      kellyDeviation: 0,
      storyPreference: 'both'
    };
  }
}

// ============================================================
// 匹配引擎（加权版本）
// ============================================================

/**
 * 计算加权欧几里得距离
 * 每个维度有不同的权重，重要的维度影响更大
 */
function weightedEuclideanDistance(v1, v2) {
  let sum = 0;
  let weightSum = 0;
  const keys = Object.keys(v1);

  for (const key of keys) {
    if (typeof v1[key] === 'number' && typeof v2[key] === 'number') {
      const weight = ENGINE_CONFIG.dimensionWeights[key] || 1;
      sum += ((v1[key] - v2[key]) * weight) ** 2;
      weightSum += weight ** 2;
    }
  }

  // 标准化：除以权重和的平方根，使得距离在合理范围内
  return weightSum > 0 ? Math.sqrt(sum / weightSum) : Math.sqrt(sum);
}

/**
 * 将投资人档案转换为归一化向量
 */
function investorToVector(investor) {
  return {
    riskTolerance: investor.riskTolerance,
    timePreference: investor.timePreference,
    executionDiscipline: investor.executionDiscipline,
    reflectionDeviation: investor.reflectionDeviation,
    aimPrecision: investor.aimPrecision
  };
}

/**
 * 根据相似度获取等级标签
 */
export function getSimilarityTier(similarity) {
  for (const tier of ENGINE_CONFIG.similarityTiers) {
    if (similarity >= tier.min) {
      return tier;
    }
  }
  return ENGINE_CONFIG.similarityTiers[ENGINE_CONFIG.similarityTiers.length - 1];
}

/**
 * 匹配用户与投资人
 *
 * 改进：
 * 1. 使用加权欧几里得距离，重要维度影响更大
 * 2. 返回相似度等级（高度契合/较为相似/...）
 * 3. 包含各维度的详细差异分析
 */
export function matchInvestor(userData, preferredInvestorId = null) {
  const userVector = {
    riskTolerance: userData.riskTolerance || 50,
    timePreference: userData.timePreference || 50,
    executionDiscipline: userData.executionDiscipline || 70,
    reflectionDeviation: userData.reflectionDeviation || 50,
    aimPrecision: userData.aimPrecision || 50
  };

  let results = INVESTOR_PROFILES.map(investor => {
    const invVector = investorToVector(investor);
    const distance = weightedEuclideanDistance(userVector, invVector);

    // 计算各维度差异（用于详细展示）
    const dimensionDiffs = {};
    for (const dim of DIMENSION_CONFIG) {
      dimensionDiffs[dim.key] = {
        user: userVector[dim.key],
        investor: invVector[dim.key],
        diff: userVector[dim.key] - invVector[dim.key],
        absDiff: Math.abs(userVector[dim.key] - invVector[dim.key]),
      };
    }

    // 最大可能距离（用于归一化相似度到 0-100）
    const maxDist = 100; // 加权后最大距离约为 100
    const similarity = Math.max(0, 100 - (distance / maxDist) * 100);

    // 如果有偏好的投资人，提升其相似度
    let finalSimilarity = similarity;
    if (preferredInvestorId && investor.id === preferredInvestorId) {
      finalSimilarity = Math.min(
        ENGINE_CONFIG.matching.maxPreferenceBoost,
        similarity + ENGINE_CONFIG.matching.preferenceBoost
      );
    }

    const tier = getSimilarityTier(finalSimilarity);

    return {
      investor,
      similarity: +finalSimilarity.toFixed(1),
      distance: +distance.toFixed(2),
      tier,
      dimensionDiffs,
    };
  });

  // 按相似度降序排列
  results = results.sort((a, b) => b.similarity - a.similarity);

  logger.session('投资人匹配完成', {
    Top1: results[0].investor.name,
    相似度: results[0].similarity + '%',
    Top2: results[1].investor.name,
    Top3: results[2].investor.name
  });

  return results;
}

// ============================================================
// 共同点/差异点生成（使用统一的 DIMENSION_CONFIG）
// ============================================================

/**
 * 生成用户与投资人的共同点摘要
 */
export function generateCommonPoints(userData, investor) {
  const points = [];
  const highValue = ENGINE_CONFIG.thresholds.highValue;

  for (const dim of DIMENSION_CONFIG) {
    const userVal = userData[dim.key] || 50;
    const invVal = investor[dim.key] || 50;
    const diff = Math.abs(userVal - invVal);

    if (diff < dim.commonThreshold) {
      if (userVal > highValue) points.push(`✓ ${dim.neg}`);
      else points.push(`✓ ${dim.pos}`);
    }
  }

  return points.slice(0, 4);
}

/**
 * 生成用户与投资人的差异点
 */
export function generateDifferencePoints(userData, investor) {
  const points = [];

  for (const dim of DIMENSION_CONFIG) {
    const userVal = userData[dim.key] || 50;
    const invVal = investor[dim.key] || 50;
    const diff = userVal - invVal;

    if (Math.abs(diff) > dim.diffThreshold) {
      const direction = diff > 0 ? dim.higherLabel : dim.lowerLabel;
      points.push(`• 你的${dim.label}比他${direction}（${userVal} vs ${invVal}）`);
    }
  }

  return points.slice(0, 2);
}

// ============================================================
// 新增：生成提升建议
// ============================================================

/**
 * 根据用户与目标投资人的差异，生成针对性的提升建议
 *
 * @param {object} userData - 用户归一化数据
 * @param {object} investor - 目标投资人档案
 * @param {number} maxAdvice - 最多返回几条建议
 * @returns {Array} 建议列表，按重要性排序
 */
export function generateImprovementAdvice(userData, investor, maxAdvice = 3) {
  const adviceList = [];

  for (const dim of DIMENSION_CONFIG) {
    const userVal = userData[dim.key] || 50;
    const invVal = investor[dim.key] || 50;
    const diff = userVal - invVal;

    // 只有差异足够大才需要建议
    if (Math.abs(diff) <= dim.diffThreshold) continue;

    const advicePool = IMPROVEMENT_ADVICE[dim.key];
    if (!advicePool) continue;

    // diff > 0 表示用户比投资人"更高"，需要降低；反之需要提升
    const direction = diff > 0 ? 'decrease' : 'increase';
    const suggestions = advicePool[direction];

    if (suggestions && suggestions.length > 0) {
      // 随机选一条建议（或者按顺序）
      const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
      adviceList.push({
        dimension: dim.key,
        dimensionLabel: dim.label,
        userValue: userVal,
        targetValue: invVal,
        gap: Math.abs(diff),
        direction: diff > 0 ? '降低' : '提升',
        advice: suggestion,
      });
    }
  }

  // 按差异大小排序，差异越大越优先
  adviceList.sort((a, b) => b.gap - a.gap);

  return adviceList.slice(0, maxAdvice);
}

// ============================================================
// 新增：相似度趋势追踪
// ============================================================

const TREND_STORAGE_KEY = 'investor_match_trend';

/**
 * 记录一次匹配结果，用于追踪趋势
 *
 * @param {object} matchResult - matchInvestor 返回的 Top1 结果
 * @param {string} targetInvestorId - 目标投资人 ID（可选，默认 Top1）
 */
export function recordMatchTrend(matchResult, targetInvestorId) {
  try {
    const history = storage.get(TREND_STORAGE_KEY) || [];
    const targetId = targetInvestorId || matchResult?.investor?.id;
    const similarity = matchResult?.similarity || 0;

    history.push({
      timestamp: Date.now(),
      targetInvestorId: targetId,
      similarity: similarity,
    });

    // 只保留最近 30 条记录
    const trimmed = history.slice(-30);
    storage.set(TREND_STORAGE_KEY, trimmed);

    return trimmed;
  } catch (e) {
    logger.error('记录匹配趋势失败', e);
    return [];
  }
}

/**
 * 获取相似度趋势数据
 *
 * @param {string} targetInvestorId - 只看某个目标投资人的趋势（可选）
 * @returns {object} 包含历史记录、趋势方向、变化量
 */
export function getSimilarityTrend(targetInvestorId) {
  try {
    const history = storage.get(TREND_STORAGE_KEY) || [];

    // 如果指定了目标投资人，过滤
    const filtered = targetInvestorId
      ? history.filter(h => h.targetInvestorId === targetInvestorId)
      : history;

    if (filtered.length < 2) {
      return {
        history: filtered,
        trend: 'insufficient',
        change: 0,
        count: filtered.length,
      };
    }

    const first = filtered[0].similarity;
    const last = filtered[filtered.length - 1].similarity;
    const change = last - first;

    let trend = 'stable';
    if (change > 3) trend = 'up';
    else if (change < -3) trend = 'down';

    return {
      history: filtered,
      trend,
      change: +change.toFixed(1),
      count: filtered.length,
    };
  } catch (e) {
    logger.error('获取相似度趋势失败', e);
    return {
      history: [],
      trend: 'error',
      change: 0,
      count: 0,
    };
  }
}

// ============================================================
// 导出引擎对象
// ============================================================
export const investorEngine = {
  // 配置
  ENGINE_CONFIG,
  DIMENSION_CONFIG,
  // 数据
  INVESTOR_PROFILES,
  // 核心功能
  extractUserData,
  matchInvestor,
  generateCommonPoints,
  generateDifferencePoints,
  // 新增功能
  getSimilarityTier,
  generateImprovementAdvice,
  recordMatchTrend,
  getSimilarityTrend,
};
