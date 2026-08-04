/**
 * 投资人档案对照引擎
 *
 * 功能：
 * - 名人档案库（10位知名投资人）
 * - 用户行为数据 → 投资人匹配引擎
 * - 欧几里得距离匹配算法
 * - 共同点/差异点生成
 */

import { logger } from './logger';
import { storage } from './storage';

// ============= 10位投资人档案库 =============

export const INVESTOR_PROFILES = [
  {
    id: 'buffett',
    name: '沃伦·巴菲特',
    emoji: '🧓',
    mbti: 'INTJ',
    mbtiLabel: '系统架构师',
    riskTolerance: 15,
    timePreference: 95,
    decisionStyle: '深度研究，集中持仓',
    famousQuote: '我最喜欢的持有期是永远。',
    kellyDeviation: -0.3,
    aimPrecision: 90,
    executionDiscipline: 95,
    reflectionDeviation: 85,
    storyPreference: 'cigar',
    matchDescription: '你像巴菲特一样，相信时间的价值，愿意长期持有正确的选择。'
  },
  {
    id: 'munger',
    name: '查理·芒格',
    emoji: '🧙',
    mbti: 'INTP',
    mbtiLabel: '逻辑学家',
    riskTolerance: 20,
    timePreference: 90,
    decisionStyle: '逆向思考，跨学科框架',
    famousQuote: '反过来想，总是反过来想。',
    kellyDeviation: -0.2,
    aimPrecision: 85,
    executionDiscipline: 88,
    reflectionDeviation: 80,
    storyPreference: 'both',
    matchDescription: '你和芒格一样，习惯从多个角度思考问题，不随波逐流。'
  },
  {
    id: 'sorros',
    name: '乔治·索罗斯',
    emoji: '🦅',
    mbti: 'ENTP',
    mbtiLabel: '辩论家',
    riskTolerance: 75,
    timePreference: 40,
    decisionStyle: '反身性理论，速战速决',
    famousQuote: '对错不重要，正确时赚了多少才重要。',
    kellyDeviation: 0.5,
    aimPrecision: 55,
    executionDiscipline: 60,
    reflectionDeviation: 40,
    storyPreference: 'firework',
    matchDescription: '你像索罗斯一样，敢于在关键时刻下重注，追求快速回报。'
  },
  {
    id: 'dalio',
    name: '瑞·达利欧',
    emoji: '🎯',
    mbti: 'INTJ',
    mbtiLabel: '系统架构师',
    riskTolerance: 35,
    timePreference: 85,
    decisionStyle: '原则驱动，系统性配置',
    famousQuote: '痛苦 + 反思 = 进步。',
    kellyDeviation: 0,
    aimPrecision: 80,
    executionDiscipline: 90,
    reflectionDeviation: 75,
    storyPreference: 'both',
    matchDescription: '你和达利欧一样，相信系统和原则的力量，追求稳定的长期表现。'
  },
  {
    id: 'lynch',
    name: '彼得·林奇',
    emoji: '🔍',
    mbti: 'ENFP',
    mbtiLabel: '竞选者',
    riskTolerance: 55,
    timePreference: 50,
    decisionStyle: '自下而上，灵活调整',
    famousQuote: '投资你所知道的。',
    kellyDeviation: 0.2,
    aimPrecision: 65,
    executionDiscipline: 70,
    reflectionDeviation: 55,
    storyPreference: 'firework',
    matchDescription: '你像林奇一样，保持好奇心，愿意从生活中发现机会并灵活调整。'
  },
  {
    id: 'son',
    name: '孙正义',
    emoji: '🚀',
    mbti: 'ENTJ',
    mbtiLabel: '指挥官',
    riskTolerance: 85,
    timePreference: 30,
    decisionStyle: '激进押注，愿景驱动',
    famousQuote: '要么做第一，要么做唯一。',
    kellyDeviation: 0.7,
    aimPrecision: 40,
    executionDiscipline: 55,
    reflectionDeviation: 30,
    storyPreference: 'firework',
    matchDescription: '你和孙正义一样，拥有宏大的愿景，愿意为了远大目标承担高风险。'
  },
  {
    id: 'graham',
    name: '本杰明·格雷厄姆',
    emoji: '📚',
    mbti: 'ISTJ',
    mbtiLabel: '物流师',
    riskTolerance: 10,
    timePreference: 80,
    decisionStyle: '安全边际，价值评估',
    famousQuote: '市场短期是投票机，长期是称重机。',
    kellyDeviation: -0.4,
    aimPrecision: 92,
    executionDiscipline: 92,
    reflectionDeviation: 88,
    storyPreference: 'cigar',
    matchDescription: '你像格雷厄姆一样，极度重视安全边际，宁愿错过也不冒进。'
  },
  {
    id: 'paulson',
    name: '约翰·保尔森',
    emoji: '🎰',
    mbti: 'ESTJ',
    mbtiLabel: '总经理',
    riskTolerance: 60,
    timePreference: 45,
    decisionStyle: '机会驱动，集中押注',
    famousQuote: '当机会来临时，下重注。',
    kellyDeviation: 0.4,
    aimPrecision: 70,
    executionDiscipline: 75,
    reflectionDeviation: 50,
    storyPreference: 'both',
    matchDescription: '你和保尔森一样，平时耐心等待，机会出现时果断出手。'
  },
  {
    id: 'icahn',
    name: '卡尔·伊坎',
    emoji: '🦈',
    mbti: 'ENTJ',
    mbtiLabel: '指挥官',
    riskTolerance: 80,
    timePreference: 25,
    decisionStyle: '激进主义，快速调仓',
    famousQuote: '买低卖高，华尔街的真理。',
    kellyDeviation: 0.6,
    aimPrecision: 45,
    executionDiscipline: 65,
    reflectionDeviation: 35,
    storyPreference: 'firework',
    matchDescription: '你像伊坎一样，行动迅速，敢于打破现状，追求短期高效回报。'
  },
  {
    id: 'temples',
    name: '彼得·蒂尔',
    emoji: '🧠',
    mbti: 'INTJ',
    mbtiLabel: '系统架构师',
    riskTolerance: 65,
    timePreference: 75,
    decisionStyle: '第一性原理，非共识正确',
    famousQuote: '你相信什么，别人却不相信？',
    kellyDeviation: 0.3,
    aimPrecision: 75,
    executionDiscipline: 80,
    reflectionDeviation: 65,
    storyPreference: 'both',
    matchDescription: '你和蒂尔一样，习惯于深入思考事物的本质，追求非共识的正确。'
  }
];

// ============= 用户数据归一化 =============

/**
 * 从 localStorage 中提取用户行为数据，生成归一化向量
 */
export function extractUserData() {
  try {
    const parsed = storage.get() || {};

    // 德州数据
    const pokerGames = parsed.pokerGames || [];
    const avgKelly = pokerGames.length > 0
      ? pokerGames.reduce((a, g) => a + (g.kellyRatio || 0.5), 0) / pokerGames.length
      : 0.5;
    const avgDecisionTime = pokerGames.length > 0
      ? pokerGames.reduce((a, g) => a + (g.avgDecisionTime || 5), 0) / pokerGames.length
      : 5;
    const allInFreq = pokerGames.length > 0
      ? pokerGames.filter(g => g.actions?.some(a => a.action === 'all-in')).length / pokerGames.length
      : 0;

    // 台球数据
    const billiardsSessions = parsed.billiardsSessions || [];
    const avgReflection = billiardsSessions.length > 0
      ? billiardsSessions.reduce((a, s) => a + (s.mood?.avgDeviation || 20), 0) / billiardsSessions.length
      : 20;
    const avgAimTime = billiardsSessions.length > 0
      ? billiardsSessions.reduce((a, s) => {
        const shots = s.shots || [];
        if (shots.length === 0) return a;
        return a + shots.reduce((b, sh) => b + (sh.aimDuration || 5), 0) / shots.length;
      }, 0) / billiardsSessions.length
      : 5;

    // 健身数据
    const fitnessSessions = parsed.fitnessSessions || [];
    const avgCompletion = fitnessSessions.length > 0
      ? fitnessSessions.reduce((a, s) => a + (s.deviation?.completionRate || 70), 0) / fitnessSessions.length
      : 70;

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
      riskTolerance: Math.round(20 + allInFreq * 50 + (avgKelly - 0.5) * 60),
      timePreference: Math.round(30 + (1 - Math.min(1, avgDecisionTime / 15)) * 50),
      executionDiscipline: Math.round(avgCompletion),
      reflectionDeviation: Math.round(100 - avgReflection * 2), // 折射偏差越小越好，所以反转
      aimPrecision: Math.round(100 - Math.min(100, avgAimTime * 8)), // 瞄准时间越长，精度越高
      kellyDeviation: (avgKelly - 0.5) * 2, // -1 到 1
      storyPreference: storyPref
    };
  } catch (e) {
    logger.error('提取用户行为数据失败', e);
    return {
      riskTolerance: 50,
      timePreference: 50,
      executionDiscipline: 70,
      reflectionDeviation: 50,
      aimPrecision: 50,
      kellyDeviation: 0,
      storyPreference: 'both'
    };
  }
}

// ============= 匹配引擎 =============

/**
 * 计算欧几里得距离
 */
function euclideanDistance(v1, v2) {
  let sum = 0;
  const keys = Object.keys(v1);
  for (const key of keys) {
    if (typeof v1[key] === 'number' && typeof v2[key] === 'number') {
      sum += (v1[key] - v2[key]) ** 2;
    }
  }
  return Math.sqrt(sum);
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
 * 匹配用户与投资人
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
    const distance = euclideanDistance(userVector, invVector);
    const maxDist = 100 * Math.sqrt(5); // 最大可能距离
    const similarity = Math.max(0, 100 - (distance / maxDist) * 100);

    // 如果有偏好的投资人，提升其相似度
    let finalSimilarity = similarity;
    if (preferredInvestorId && investor.id === preferredInvestorId) {
      finalSimilarity = Math.min(99, similarity + 20);
    }

    return {
      investor,
      similarity: +finalSimilarity.toFixed(1),
      distance: +distance.toFixed(2)
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

// ============= 共同点/差异点生成 =============

/**
 * 生成用户与投资人的共同点摘要
 */
export function generateCommonPoints(userData, investor) {
  const points = [];
  const dims = [
    { key: 'riskTolerance', label: '风险偏好', threshold: 15, pos: '你们在不确定性面前，都倾向于控制风险', neg: '你们都愿意为了更高收益承担一定风险' },
    { key: 'timePreference', label: '时间偏好', threshold: 15, pos: '你们都更看重长期价值，愿意耐心等待', neg: '你们都偏向快速行动，追求短期结果' },
    { key: 'executionDiscipline', label: '执行纪律', threshold: 10, pos: '你们的执行纪律都很稳定，极少中途中断', neg: '你们都倾向于灵活调整，不拘泥于原计划' },
    { key: 'reflectionDeviation', label: '路径预判能力', threshold: 15, pos: '你们都擅长预判事物的走向，偏差很小', neg: '你们都偏向直觉决策，不纠结于精确预测' },
    { key: 'aimPrecision', label: '决策前观察', threshold: 15, pos: '你们都喜欢长时间观察后再出手', neg: '你们决策速度都很快，不拖延' }
  ];

  for (const dim of dims) {
    const userVal = userData[dim.key] || 50;
    const invVal = investor[dim.key] || 50;
    const diff = Math.abs(userVal - invVal);

    if (diff < dim.threshold) {
      if (userVal > 60) points.push(`✓ ${dim.neg}`);
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
  const dims = [
    { key: 'riskTolerance', label: '风险偏好' },
    { key: 'timePreference', label: '时间偏好' },
    { key: 'executionDiscipline', label: '执行纪律' },
    { key: 'reflectionDeviation', label: '路径预判' },
    { key: 'aimPrecision', label: '决策速度' }
  ];

  for (const dim of dims) {
    const userVal = userData[dim.key] || 50;
    const invVal = investor[dim.key] || 50;
    const diff = userVal - invVal;

    if (Math.abs(diff) > 25) {
      if (diff > 0) {
        points.push(`• 你的${dim.label}比他更激进（${userVal} vs ${invVal}）`);
      } else {
        points.push(`• 你的${dim.label}比他更保守（${userVal} vs ${invVal}）`);
      }
    }
  }

  return points.slice(0, 2);
}

export const investorEngine = {
  INVESTOR_PROFILES,
  extractUserData,
  matchInvestor,
  generateCommonPoints,
  generateDifferencePoints
};
