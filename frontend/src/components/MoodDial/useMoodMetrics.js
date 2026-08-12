/**
 * 德州沙盘 · 心情盘 — 决策扰动系统
 * 
 * 核心逻辑：
 * 1. 行为观测（actionHistory） →  2. 心情状态
 *    →  3. 凯利修正系数  →  4. 偏差标签
 * 
 * 对凯利公式的影响：
 * 标准凯利:  f = (b * p - q) / b
 * 心情修正:  f = (adjustedB * adjustedP - adjustedQ) / adjustedB
 *           adjustedP = p * pMultiplier
 *           adjustedB = b * bMultiplier
 */

import { useMemo, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';

// ============================================
// MBTI 预设偏差模式
// ============================================
export const MBTI_BIAS_PROFILES = {
  INTJ: {
    label: '架构型',
    description: '偏好系统化下注，容易忽略短期波动',
    baseCorrection: { pMultiplier: 0.95, bMultiplier: 1.0, fCap: 0.9 },
    biasTags: ['过度系统化倾向', '短期波动忽视']
  },
  ENTJ: {
    label: '指挥型',
    description: '下注果断，但容易过度自信',
    baseCorrection: { pMultiplier: 1.1, bMultiplier: 0.95, fCap: 0.85 },
    biasTags: ['过度自信倾向', '连胜惩罚']
  },
  INTP: {
    label: '分析型',
    description: '过度分析，决策慢',
    baseCorrection: { pMultiplier: 0.9, bMultiplier: 1.05, fCap: 0.95 },
    biasTags: ['高分析延迟', '决策拖延']
  },
  INFJ: {
    label: '洞察型',
    description: '依赖直觉判断对手',
    baseCorrection: { pMultiplier: 1.0, bMultiplier: 1.0, fCap: 0.9 },
    biasTags: ['直觉偏差倾向', '对手误判风险']
  },
  DEFAULT: {
    label: '平衡型',
    description: '默认决策模式',
    baseCorrection: { pMultiplier: 1.0, bMultiplier: 1.0, fCap: 1.0 },
    biasTags: []
  }
};

// ============================================
// 辅助函数
// ============================================
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const normalize = (val, min = 0, max = 1) => Math.round(clamp((val - min) / (max - min), 0, 1) * 100);

// ============================================
// 1. 行为观测层
// ============================================
function analyzeBehavior(actionHistory, gameState, currentPlayerId, decisionTimes) {
  const myActions = actionHistory.filter(a => a.playerId === currentPlayerId);
  const totalActions = myActions.length;
  const currentPlayer = gameState?.players?.find(p => p.id === currentPlayerId);
  const myChips = currentPlayer?.chips || 1000;
  const maxBet = gameState?.players ? Math.max(...gameState.players.map(p => p.bet || 0)) : 0;

  // —— 平均决策时间 ——
  const avgDecisionTime = decisionTimes.length > 0
    ? decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length
    : 3.0;

  // —— 下注模式分析 ——
  let betPattern = 'stable';
  if (totalActions >= 3) {
    const raiseActions = myActions.filter(a => a.action === 'raise' || a.action === 'allin');
    const foldActions = myActions.filter(a => a.action === 'fold');
    const callActions = myActions.filter(a => a.action === 'call');

    const betAmounts = myActions.map(a => a.amount || 0).filter(a => a > 0);
    let amountVariance = 0;
    if (betAmounts.length >= 2) {
      const mean = betAmounts.reduce((a, b) => a + b, 0) / betAmounts.length;
      amountVariance = betAmounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / betAmounts.length;
    }

    if (amountVariance > 5000) betPattern = 'erratic';
    else if (raiseActions.length / totalActions > 0.4) betPattern = 'aggressive';
    else if (foldActions.length / totalActions > 0.5) betPattern = 'conservative';
    else betPattern = 'stable';
  }

  // —— 信息查看次数（用 Dashboard 打开次数模拟，这里用默认值，可由外部传入）——
  const infoViewCount = 0; // 预留接口

  // —— 连续赢/输（基于最近行动推断，完整追踪需要后端支持）——
  let consecutiveWins = 0;
  let consecutiveLosses = 0;

  // —— 当前下注比例 ——
  const currentStackRatio = clamp(maxBet / Math.max(1, myChips), 0, 1);

  return {
    avgDecisionTime,
    betPattern,
    infoViewCount,
    consecutiveWins,
    consecutiveLosses,
    currentStackRatio
  };
}

// ============================================
// 2. 心情状态层
// ============================================
function computeMoodState(behavior, rawMetrics, mbtiProfile) {
  const base = MBTI_BIAS_PROFILES[mbtiProfile] || MBTI_BIAS_PROFILES.DEFAULT;

  // —— 唤醒度 Arousal: 下注速度 + 激进度 ——
  let arousal = 50;
  if (behavior.avgDecisionTime < 1.5) arousal += 25;       // 下注极快 → 高唤醒
  else if (behavior.avgDecisionTime > 5) arousal -= 20;     // 下注很慢 → 低唤醒
  if (behavior.betPattern === 'aggressive') arousal += 20;
  if (behavior.betPattern === 'erratic') arousal += 15;
  if (behavior.betPattern === 'conservative') arousal -= 15;
  if (rawMetrics.tension > 0.7) arousal += 15;

  // —— 自信度 Confidence: 胜率 + 牌力 + 连续赢 ——
  let confidence = 50;
  confidence += (rawMetrics.winRate - 0.5) * 60;
  confidence += (rawMetrics.handStrength - 0.5) * 30;
  confidence += behavior.consecutiveWins * 5;
  confidence -= behavior.consecutiveLosses * 5;

  // —— 风险容忍度 Risk Tolerance: 下注模式 + 筹码比 ——
  let riskTolerance = 50;
  if (behavior.betPattern === 'aggressive') riskTolerance += 25;
  if (behavior.betPattern === 'conservative') riskTolerance -= 25;
  if (behavior.betPattern === 'erratic') riskTolerance += 10;
  riskTolerance += (rawMetrics.kellyIndex - 0.5) * 40;

  // —— 决策稳定性 Decision Stability: 下注模式方差 ——
  let decisionStability = 70;
  if (behavior.betPattern === 'erratic') decisionStability -= 35;
  if (behavior.betPattern === 'stable') decisionStability += 15;
  if (behavior.avgDecisionTime > 5) decisionStability -= 10;  // 过度犹豫

  return {
    arousal: clamp(arousal, 0, 100),
    confidence: clamp(confidence, 0, 100),
    riskTolerance: clamp(riskTolerance, 0, 100),
    decisionStability: clamp(decisionStability, 0, 100)
  };
}

// ============================================
// 3. 凯利修正系数层
// ============================================
function computeKellyCorrection(mood, behavior, mbtiProfile) {
  const base = MBTI_BIAS_PROFILES[mbtiProfile] || MBTI_BIAS_PROFILES.DEFAULT;
  let { pMultiplier, bMultiplier, fCap } = base.baseCorrection;

  // —— 胜率修正 pMultiplier ——
  // 高自信 → 高估胜率 → 降低 p（防止过度自信）
  if (mood.confidence > 75) pMultiplier *= 0.85;
  // 低自信 → 低估胜率 → 提高 p
  else if (mood.confidence < 30) pMultiplier *= 1.15;
  // 连续赢 → 过度自信惩罚
  if (behavior.consecutiveWins >= 2) pMultiplier *= 0.9;

  // —— 赔率修正 bMultiplier ——
  // 高唤醒 → 冲动 → 低估风险 → 降低 b
  if (mood.arousal > 70) bMultiplier *= 0.9;
  // 高风险容忍 → 高估收益 → 降低 b
  else if (mood.riskTolerance > 70) bMultiplier *= 0.92;
  // 连续输 → 损失厌恶 → 高估风险 → 提高 b
  if (behavior.consecutiveLosses >= 2) bMultiplier *= 1.1;
  // 低唤醒（过度分析）→ 提高 b
  if (mood.arousal < 30) bMultiplier *= 1.05;

  // —— 下注上限 fCap ——
  // 决策不稳定 → 降低上限
  if (mood.decisionStability < 40) fCap = Math.min(fCap, 0.6);
  else if (mood.decisionStability < 60) fCap = Math.min(fCap, 0.8);
  // 不稳定下注模式 → 降低上限
  if (behavior.betPattern === 'erratic') fCap = Math.min(fCap, 0.5);

  return {
    pMultiplier: clamp(pMultiplier, 0.7, 1.3),
    bMultiplier: clamp(bMultiplier, 0.7, 1.2),
    fCap: clamp(fCap, 0.3, 1.0)
  };
}

// ============================================
// 4. 偏差标签层
// ============================================
function computeBiasTags(mood, behavior, mbtiProfile) {
  const tags = [];
  const base = MBTI_BIAS_PROFILES[mbtiProfile] || MBTI_BIAS_PROFILES.DEFAULT;
  tags.push(...base.biasTags);

  if (mood.confidence > 80) tags.push('过度自信');
  if (mood.confidence < 25) tags.push('信心不足');
  if (mood.arousal > 75) tags.push('高冲动状态');
  if (mood.arousal < 25) tags.push('过度分析状态');
  if (mood.decisionStability < 40) tags.push('决策不稳定');
  if (mood.riskTolerance > 80) tags.push('高风险偏好');
  if (mood.riskTolerance < 25) tags.push('低风险偏好');
  if (behavior.betPattern === 'erratic') tags.push('下注波动异常');
  if (behavior.avgDecisionTime > 6) tags.push('决策延迟过高');
  if (behavior.consecutiveWins >= 3) tags.push('连胜过度自信');
  if (behavior.consecutiveLosses >= 3) tags.push('连败损失厌恶');

  return [...new Set(tags)].slice(0, 5);
}

// ============================================
// 心情修正后的凯利计算
// ============================================
export function computeKellyWithMood(rawWinRate, rawPot, rawCall, correction) {
  if (rawCall <= 0) return 0;
  if (rawWinRate <= 0) return 0;

  const { pMultiplier, bMultiplier, fCap } = correction;

  const adjustedP = clamp(rawWinRate * pMultiplier, 0.01, 0.99);
  const adjustedQ = 1 - adjustedP;
  const rawOdds = rawPot / rawCall;
  const adjustedB = rawOdds * bMultiplier;

  const f = (adjustedB * adjustedP - adjustedQ) / adjustedB;

  return clamp(f, 0, fCap);
}

// ============================================
// 主 Hook
// ============================================
export function useMoodMetrics(gameState, currentPlayerId, rawMetrics, options = {}) {
  const { mbtiProfile = 'DEFAULT' } = options;
  const actionHistory = useGameStore(s => s.actionHistory);
  const decisionTimesRef = useRef([]);

  return useMemo(() => {
    if (!gameState || !currentPlayerId) {
      return {
        behavior: null,
        mood: { arousal: 50, confidence: 50, riskTolerance: 50, decisionStability: 50 },
        kellyCorrection: { pMultiplier: 1.0, bMultiplier: 1.0, fCap: 1.0 },
        biasTags: [],
        mbtiProfile,
        mbtiLabel: MBTI_BIAS_PROFILES[mbtiProfile]?.label || '平衡型'
      };
    }

    // 1. 行为观测
    const behavior = analyzeBehavior(
      actionHistory,
      gameState,
      currentPlayerId,
      decisionTimesRef.current
    );

    // 2. 心情状态
    const mood = computeMoodState(behavior, rawMetrics || {}, mbtiProfile);

    // 3. 凯利修正
    const kellyCorrection = computeKellyCorrection(mood, behavior, mbtiProfile);

    // 4. 偏差标签
    const biasTags = computeBiasTags(mood, behavior, mbtiProfile);

    return {
      behavior,
      mood,
      kellyCorrection,
      biasTags,
      mbtiProfile,
      mbtiLabel: MBTI_BIAS_PROFILES[mbtiProfile]?.label || '平衡型'
    };
  }, [gameState, currentPlayerId, rawMetrics, actionHistory, mbtiProfile]);
}

export default useMoodMetrics;
