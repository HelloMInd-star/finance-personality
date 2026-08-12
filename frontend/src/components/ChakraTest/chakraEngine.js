/**
 * 脉轮测试引擎
 * 21 题答案 → 七脉轮分数 + 状态标签 + 平衡建议 + 数据存储
 */

import { CHAKRAS, CHAKRA_KEYS, QUESTIONS, STATUS_LEVELS } from './chakraData.js';
import { storage } from '../../utils/storage';
import { logger } from '../../utils/logger';

/**
 * 根据答案数组计算各脉轮总分
 * @param {number[]} answers - 长度 21 的分数数组(1-4),索引对应 QUESTIONS
 * @returns {Record<string, number>} 各脉轮总分(3-12)
 */
export function calculateScores(answers) {
  const scores = {};
  // 初始化所有脉轮为 0
  CHAKRA_KEYS.forEach((k) => (scores[k] = 0));

  // 答案可能为 null/undefined(未答),按 0 处理
  QUESTIONS.forEach((q, idx) => {
    const ans = answers?.[idx];
    if (typeof ans === 'number' && ans >= 1 && ans <= 4) {
      scores[q.chakra] += ans;
    }
  });

  return scores;
}

/**
 * 根据脉轮总分判断状态标签
 * 9-12 → 强壮 / 6-8 → 平均 / 3-5 → 虚弱
 */
export function getStatus(score) {
  if (score >= STATUS_LEVELS.strong.min) return STATUS_LEVELS.strong;
  if (score >= STATUS_LEVELS.average.min) return STATUS_LEVELS.average;
  return STATUS_LEVELS.weak;
}

/**
 * 生成各脉轮的状态描述文本
 */
export function getChakraHint(chakraKey, score) {
  const chakra = CHAKRAS.find((c) => c.key === chakraKey);
  if (!chakra) return '';
  const status = getStatus(score);
  if (status.key === 'strong') return chakra.balanceHint;
  if (status.key === 'average') return chakra.avgHint;
  return chakra.weakHint;
}

/**
 * 生成完整的脉轮测试结果
 * @param {number[]} answers
 * @returns {{
 *   scores: Record<string, number>,
 *   details: Array<{ chakra: Object, score: number, status: Object, hint: string }>,
 *   balanceSummary: string,
 *   dominantChakra: string,
 *   weakestChakra: string,
 *   timestamp: number,
 * }}
 */
export function generateResult(answers) {
  const scores = calculateScores(answers);

  const details = CHAKRAS.map((chakra) => {
    const score = scores[chakra.key];
    const status = getStatus(score);
    const hint = getChakraHint(chakra.key, score);
    return { chakra, score, status, hint };
  });

  // 找出最强和最弱脉轮
  const sorted = [...details].sort((a, b) => b.score - a.score);
  const dominant = sorted[0];
  const weakest = sorted[sorted.length - 1];

  // 整体平衡度评估
  const allScores = Object.values(scores);
  const maxDiff = Math.max(...allScores) - Math.min(...allScores);
  const balanceSummary = generateBalanceSummary(maxDiff, dominant, weakest);

  logger.session('[脉轮] 生成结果', {
    dominant: dominant.chakra.name,
    weakest: weakest.chakra.name,
    maxDiff,
  });

  return {
    scores,
    details,
    balanceSummary,
    dominantChakra: dominant.chakra.key,
    weakestChakra: weakest.chakra.key,
    timestamp: Date.now(),
  };
}

/**
 * 生成整体平衡建议
 */
function generateBalanceSummary(maxDiff, dominant, weakest) {
  if (maxDiff <= 2) {
    return `你的七脉轮整体平衡度较高（最大差值 ${maxDiff} 分），能量分布均匀。继续保持现有的生活节奏与内在觉察。`;
  }
  if (maxDiff <= 5) {
    return `你的七脉轮存在一定偏差（最大差值 ${maxDiff} 分）：${dominant.chakra.name}最强（${dominant.score}分），${weakest.chakra.name}最弱（${weakest.score}分）。建议针对性补强最弱脉轮。`;
  }
  return `你的七脉轮偏差较大（最大差值 ${maxDiff} 分）：${dominant.chakra.name}过强（${dominant.score}分），${weakest.chakra.name}明显阻塞（${weakest.score}分）。建议优先激活${weakest.chakra.name}，同时适度平衡${dominant.chakra.name}的能量。`;
}

/**
 * 将脉轮结果写入 localStorage(userState.chakraResult)
 * 同时追加到历史记录数组
 */
export function saveResult(result) {
  try {
    // 写入 userState.chakraResult(最新一次)
    storage.setUserState({ chakraResult: result });

    // 追加到历史记录(保留最近 20 次)
    const all = storage.getAll();
    const history = Array.isArray(all.chakraHistory) ? all.chakraHistory : [];
    history.push({
      scores: result.scores,
      dominantChakra: result.dominantChakra,
      weakestChakra: result.weakestChakra,
      timestamp: result.timestamp,
    });
    if (history.length > 20) history.shift();
    storage.set('chakraHistory', history);

    logger.session('[脉轮] 结果已写入 localStorage');
    return true;
  } catch (e) {
    logger.error('[脉轮] 保存失败', e);
    return false;
  }
}

/**
 * 获取脉轮修正因子(供其他模块联动使用)
 * 例如:心轮虚弱 → 推荐玫瑰风味
 */
export function getChakraModifier(chakraKey) {
  const all = storage.getAll();
  const result = all?.userState?.chakraResult;
  if (!result?.scores) return null;

  const score = result.scores[chakraKey];
  if (typeof score !== 'number') return null;

  const status = getStatus(score);
  return {
    chakra: chakraKey,
    score,
    status: status.key,
    label: status.label,
  };
}

// ========================================
// 联动:MBTI 企业家酒局
// ========================================

// 各脉轮虚弱时推荐的调酒风味关键词
const CHAKRA_FLAVOR_HINTS = {
  root: '木质 + 焦糖',        // 海底轮 → 扎根感
  sacral: '柑橘 + 热带水果',  // 脐轮 → 情绪流动
  solar: '辣椒 + 香料',       // 太阳轮 → 个人力量
  heart: '玫瑰 + 花香',       // 心轮 → 心轮敞开
  throat: '薄荷 + 清冽',      // 喉轮 → 表达释放
  thirdEye: '柚子 + 清酒',    // 眉心轮 → 直觉唤醒
  crown: '蜂蜜 + 温热',       // 顶轮 → 灵性连接
};

// 各脉轮强壮时在酒局中的表现洞察
const CHAKRA_PARTY_INSIGHTS = {
  root: '在酒局中展现稳固的存在感与生命力，给人可靠印象',
  sacral: '在酒局中情绪流动自如，富有感染力与创造力',
  solar: '在酒局中自信决策力突出，容易成为话题主导者',
  heart: '在酒局中善于建立深度连接，同理心令人放松',
  throat: '在酒局中表达清晰有力，是天然的说服者',
  thirdEye: '在酒局中洞察敏锐，常抛出独到见解',
  crown: '在酒局中展现宏大视野，谈话带有哲学深度',
};

/**
 * 生成脉轮状态对酒局的洞察信息
 * - 最弱脉轮 → 推荐修正风味
 * - 最强脉轮 → 酒局表现亮点
 * @returns {null | {
 *   hasResult: boolean,
 *   dominantChakra: string,
 *   weakestChakra: string,
 *   dominantName: string,
 *   weakestName: string,
 *   dominantInsight: string,
 *   flavorHint: string,
 *   flavorReason: string,
 * }}
 */
export function getPartyChakraInsight() {
  const all = storage.getAll();
  const result = all?.userState?.chakraResult;
  if (!result?.scores) return null;

  const dominantName = getChakraName(result.dominantChakra);
  const weakestName = getChakraName(result.weakestChakra);
  const weakestStatus = getStatus(result.scores[result.weakestChakra]);

  return {
    hasResult: true,
    dominantChakra: result.dominantChakra,
    weakestChakra: result.weakestChakra,
    dominantName,
    weakestName,
    dominantInsight: CHAKRA_PARTY_INSIGHTS[result.dominantChakra] || '',
    // 仅在最弱脉轮处于"虚弱/平均"状态时给出风味修正
    flavorHint: weakestStatus.key === 'strong'
      ? ''
      : (CHAKRA_FLAVOR_HINTS[result.weakestChakra] || ''),
    flavorReason: weakestStatus.key === 'strong'
      ? ''
      : `${weakestName}${weakestStatus.label}，建议在配方中加入「${CHAKRA_FLAVOR_HINTS[result.weakestChakra] || ''}」风味以激活该脉轮`,
  };
}

function getChakraName(chakraKey) {
  const c = CHAKRAS.find((x) => x.key === chakraKey);
  return c ? c.name : chakraKey;
}
