/**
 * 企业家人格匹配引擎
 * 答案 → MBTI 维度分数 → 人格分子匹配 → 故事生成
 */

import { QUESTIONS, PERSONA_ANSWERS, STORIES } from './personaData.js';
import { MOLECULES, PERSONA_KEYS, getMolecule } from '../MoleculeViewer/moleculeData.js';

// ========================================
// 计算MBTI维度分数
// ========================================

/**
 * 根据6题答案计算MBTI各维度分数
 * @param {string[]} answers - ['A','B','A','B','A','B']
 * @returns {{ scores: Object, mbti: string, dimensions: Object }}
 */
export function calculateMBTI(answers) {
  const scores = { I: 0, E: 0, N: 0, S: 0, T: 0, F: 0, J: 0, P: 0 };

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const choice = answers[i];
    const optionScores = choice === 'A' ? q.optionA.scores : q.optionB.scores;

    for (const [letter, points] of Object.entries(optionScores)) {
      scores[letter] = (scores[letter] || 0) + points;
    }
  }

  // 确定MBTI类型
  const mbti =
    (scores.I >= scores.E ? 'I' : 'E') +
    (scores.N >= scores.S ? 'N' : 'S') +
    (scores.T >= scores.F ? 'T' : 'F') +
    (scores.J >= scores.P ? 'J' : 'P');

  // 维度强度(0-1,0.5为中立)
  const dimensions = {
    IE: { dominant: scores.I >= scores.E ? 'I' : 'E', strength: scores.I + scores.E > 0 ? Math.max(scores.I, scores.E) / (scores.I + scores.E) : 0.5 },
    NS: { dominant: scores.N >= scores.S ? 'N' : 'S', strength: scores.N + scores.S > 0 ? Math.max(scores.N, scores.S) / (scores.N + scores.S) : 0.5 },
    TF: { dominant: scores.T >= scores.F ? 'T' : 'F', strength: scores.T + scores.F > 0 ? Math.max(scores.T, scores.F) / (scores.T + scores.F) : 0.5 },
    JP: { dominant: scores.J >= scores.P ? 'J' : 'P', strength: scores.J + scores.P > 0 ? Math.max(scores.J, scores.P) / (scores.J + scores.P) : 0.5 },
  };

  return { scores, mbti, dimensions };
}

// ========================================
// 人格分子匹配
// ========================================

/**
 * 匹配最接近的人格分子
 * @param {string[]} answers - ['A','B','A','B','A','B']
 * @returns {{ moleculeKey: string, matchPercent: number, score: number, mbti: string }}
 */
export function matchPersona(answers) {
  const { mbti, dimensions } = calculateMBTI(answers);

  // 计算每种人格的匹配分数
  const scored = PERSONA_KEYS.map((key) => {
    const idealAnswers = PERSONA_ANSWERS[key];
    let matchCount = 0;

    for (let i = 0; i < idealAnswers.length; i++) {
      if (answers[i] === idealAnswers[i]) {
        matchCount++;
      }
    }

    // MBTI 一致性加分:如果该分子的 relatedPersona 与用户 MBTI 一致,额外加分
    const mol = MOLECULES[key];
    let mbtiBonus = 0;
    if (mol.relatedPersona === mbti) {
      mbtiBonus = 2;
    }

    return {
      key,
      matchCount,
      totalScore: matchCount + mbtiBonus,
      mbtiMatch: mol.relatedPersona === mbti,
    };
  });

  // 按总分排序,取最高分
  scored.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    // 同分时,MBTI 匹配的优先
    if (a.mbtiMatch !== b.mbtiMatch) return a.mbtiMatch ? -1 : 1;
    // 仍同分时,按字母序保证确定性
    return a.key.localeCompare(b.key);
  });

  const best = scored[0];
  // 匹配度: 50% 基础分 + 匹配题数占比 × 50%
  const matchPercent = Math.round(50 + (best.matchCount / 6) * 50);

  return {
    moleculeKey: best.key,
    matchPercent,
    score: best.matchCount,
    mbti,
    dimensions,
  };
}

// ========================================
// 故事生成
// ========================================

/**
 * 为匹配的人格生成故事文本
 * @param {string} moleculeKey
 * @param {number} matchPercent
 * @returns {string}
 */
export function generateStory(moleculeKey, matchPercent) {
  const story = STORIES[moleculeKey] || '你的分子正在合成中…';
  const mol = getMolecule(moleculeKey);

  let prefix = '';
  if (matchPercent >= 90) {
    prefix = `几乎完美匹配。`;
  } else if (matchPercent >= 75) {
    prefix = `高度匹配。`;
  } else {
    prefix = `有共鸣。`;
  }

  return `${prefix}${story}`;
}

// ========================================
// 完整匹配结果
// ========================================

/**
 * 获取完整的匹配结果(分子数据 + 匹配度 + 故事 + MBTI)
 * @param {string[]} answers
 * @returns {{
 *   moleculeKey: string,
 *   molecule: Object,
 *   matchPercent: number,
 *   mbti: string,
 *   dimensions: Object,
 *   story: string,
 * }}
 */
export function getMatchResult(answers) {
  const match = matchPersona(answers);
  const molecule = getMolecule(match.moleculeKey);
  const story = generateStory(match.moleculeKey, match.matchPercent);

  return {
    moleculeKey: match.moleculeKey,
    molecule,
    matchPercent: match.matchPercent,
    mbti: match.mbti,
    dimensions: match.dimensions,
    story,
  };
}

// 导出供测试使用
export { QUESTIONS, PERSONA_ANSWERS, STORIES, PERSONA_KEYS };
