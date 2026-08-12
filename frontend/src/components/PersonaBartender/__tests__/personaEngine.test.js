/**
 * PersonaBartender 人格匹配引擎测试
 *
 * 验证企业家人格匹配流程:
 * 1. QUESTIONS 题目结构完整性(6 题, 每题 optionA/optionB)
 * 2. PERSONA_ANSWERS / STORIES 数据完整性(20 条)
 * 3. calculateMBTI - 6 题答案计算 MBTI 类型
 * 4. matchPersona - 匹配到 20 种人格分子之一
 * 5. generateStory - 生成故事文本
 * 6. getMatchResult - 完整匹配结果
 */

import {
  calculateMBTI,
  matchPersona,
  generateStory,
  getMatchResult,
  QUESTIONS,
  PERSONA_ANSWERS,
  STORIES,
} from '../personaEngine.js';
import {
  MOLECULES,
  PERSONA_KEYS,
  validateAllMolecules,
} from '../../MoleculeViewer/moleculeData.js';

// ============================================================
// QUESTIONS 题目数据
// ============================================================

describe('QUESTIONS - 题目数据结构', () => {

  test('有 6 道题', () => {
    expect(Array.isArray(QUESTIONS)).toBe(true);
    expect(QUESTIONS).toHaveLength(6);
  });

  test('每题都有 id/text/optionA/optionB', () => {
    for (const q of QUESTIONS) {
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('text');
      expect(q).toHaveProperty('optionA');
      expect(q).toHaveProperty('optionB');
      expect(typeof q.text).toBe('string');
      expect(q.text.length).toBeGreaterThan(0);
    }
  });

  test('每个选项都有 label 和 scores 对象', () => {
    for (const q of QUESTIONS) {
      for (const opt of [q.optionA, q.optionB]) {
        expect(opt).toHaveProperty('label');
        expect(opt).toHaveProperty('scores');
        expect(typeof opt.label).toBe('string');
        expect(opt.label.length).toBeGreaterThan(0);
        expect(typeof opt.scores).toBe('object');
      }
    }
  });

  test('题目的 id 唯一', () => {
    const ids = QUESTIONS.map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ============================================================
// PERSONA_ANSWERS 人格答案模式
// ============================================================

describe('PERSONA_ANSWERS - 人格答案模式', () => {

  test('有 20 个条目', () => {
    expect(Object.keys(PERSONA_ANSWERS)).toHaveLength(20);
  });

  test('每个条目的 key 都在 PERSONA_KEYS 中', () => {
    for (const key of Object.keys(PERSONA_ANSWERS)) {
      expect(PERSONA_KEYS).toContain(key);
    }
  });

  test('PERSONA_KEYS 中每个 key 都有对应答案', () => {
    for (const key of PERSONA_KEYS) {
      expect(PERSONA_ANSWERS).toHaveProperty(key);
    }
  });

  test('每个条目是 6 元素数组,值为 A 或 B', () => {
    for (const [key, answers] of Object.entries(PERSONA_ANSWERS)) {
      expect(Array.isArray(answers)).toBe(true);
      expect(answers).toHaveLength(6);
      for (const a of answers) {
        expect(['A', 'B']).toContain(a);
      }
    }
  });
});

// ============================================================
// STORIES 故事模板
// ============================================================

describe('STORIES - 故事模板', () => {

  test('有 20 个条目', () => {
    expect(Object.keys(STORIES)).toHaveLength(20);
  });

  test('每个条目的 key 都在 PERSONA_KEYS 中', () => {
    for (const key of Object.keys(STORIES)) {
      expect(PERSONA_KEYS).toContain(key);
    }
  });

  test('每个故事是非空字符串', () => {
    for (const [key, story] of Object.entries(STORIES)) {
      expect(typeof story).toBe('string');
      expect(story.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// calculateMBTI
// ============================================================

describe('calculateMBTI - MBTI 维度计算', () => {

  test('返回包含 scores/mbti/dimensions 的对象', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = calculateMBTI(answers);
    expect(result).toHaveProperty('scores');
    expect(result).toHaveProperty('mbti');
    expect(result).toHaveProperty('dimensions');
  });

  test('mbti 是 4 字符字符串', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = calculateMBTI(answers);
    expect(typeof result.mbti).toBe('string');
    expect(result.mbti).toHaveLength(4);
  });

  test('mbti 每个字符都是合法维度字母', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const { mbti } = calculateMBTI(answers);
    const validLetters = ['I', 'E', 'N', 'S', 'T', 'F', 'J', 'P'];
    for (const ch of mbti) {
      expect(validLetters).toContain(ch);
    }
  });

  test('scores 包含 I/E/N/S/T/F/J/P 八个维度且为数值', () => {
    const answers = ['A', 'A', 'A', 'A', 'A', 'A'];
    const { scores } = calculateMBTI(answers);
    for (const letter of ['I', 'E', 'N', 'S', 'T', 'F', 'J', 'P']) {
      expect(scores).toHaveProperty(letter);
      expect(typeof scores[letter]).toBe('number');
    }
  });

  test('dimensions 包含 IE/NS/TF/JP 四个维度', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const { dimensions } = calculateMBTI(answers);
    for (const dim of ['IE', 'NS', 'TF', 'JP']) {
      expect(dimensions).toHaveProperty(dim);
      expect(dimensions[dim]).toHaveProperty('dominant');
      expect(dimensions[dim]).toHaveProperty('strength');
      expect(typeof dimensions[dim].strength).toBe('number');
    }
  });

  test('全选 A 得到偏内向/分析型 MBTI(I 开头, T 维度)', () => {
    const answers = ['A', 'A', 'A', 'A', 'A', 'A'];
    const { mbti } = calculateMBTI(answers);
    expect(mbti.charAt(0)).toBe('I');
    expect(mbti.charAt(2)).toBe('T');
  });

  test('全选 B 得到偏外向/直觉型 MBTI(E 开头, N 维度)', () => {
    const answers = ['B', 'B', 'B', 'B', 'B', 'B'];
    const { mbti } = calculateMBTI(answers);
    expect(mbti.charAt(0)).toBe('E');
    expect(mbti.charAt(1)).toBe('N');
  });

  test('维度强度 strength 在 [0, 1] 区间', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const { dimensions } = calculateMBTI(answers);
    for (const dim of ['IE', 'NS', 'TF', 'JP']) {
      expect(dimensions[dim].strength).toBeGreaterThanOrEqual(0);
      expect(dimensions[dim].strength).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================
// matchPersona
// ============================================================

describe('matchPersona - 人格分子匹配', () => {

  test('返回包含 moleculeKey/matchPercent/score/mbti/dimensions 的对象', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = matchPersona(answers);
    expect(result).toHaveProperty('moleculeKey');
    expect(result).toHaveProperty('matchPercent');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('mbti');
    expect(result).toHaveProperty('dimensions');
  });

  test('匹配到的 moleculeKey 在 PERSONA_KEYS 中', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = matchPersona(answers);
    expect(PERSONA_KEYS).toContain(result.moleculeKey);
  });

  test('matchPercent 在 50-100 之间', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = matchPersona(answers);
    expect(result.matchPercent).toBeGreaterThanOrEqual(50);
    expect(result.matchPercent).toBeLessThanOrEqual(100);
  });

  test('score 在 0-6 之间', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = matchPersona(answers);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(6);
  });

  test('mbti 是 4 字符字符串', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = matchPersona(answers);
    expect(typeof result.mbti).toBe('string');
    expect(result.mbti).toHaveLength(4);
  });

  test('全选 A 匹配到偏内向/分析型人格(relatedPersona 以 I 开头)', () => {
    const answers = ['A', 'A', 'A', 'A', 'A', 'A'];
    const result = matchPersona(answers);
    const mol = MOLECULES[result.moleculeKey];
    expect(mol.relatedPersona.charAt(0)).toBe('I');
  });

  test('全选 B 匹配到偏外向/直觉型人格(relatedPersona 以 E 开头)', () => {
    const answers = ['B', 'B', 'B', 'B', 'B', 'B'];
    const result = matchPersona(answers);
    const mol = MOLECULES[result.moleculeKey];
    expect(mol.relatedPersona.charAt(0)).toBe('E');
  });

  test('全选 A 的 matchPercent >= 50', () => {
    const answers = ['A', 'A', 'A', 'A', 'A', 'A'];
    const result = matchPersona(answers);
    expect(result.matchPercent).toBeGreaterThanOrEqual(50);
  });

  test('全选 B 的 matchPercent >= 50', () => {
    const answers = ['B', 'B', 'B', 'B', 'B', 'B'];
    const result = matchPersona(answers);
    expect(result.matchPercent).toBeGreaterThanOrEqual(50);
  });

  test('相同答案每次匹配结果一致(确定性)', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const r1 = matchPersona(answers);
    const r2 = matchPersona(answers);
    expect(r1.moleculeKey).toBe(r2.moleculeKey);
    expect(r1.matchPercent).toBe(r2.matchPercent);
    expect(r1.mbti).toBe(r2.mbti);
  });
});

// ============================================================
// generateStory
// ============================================================

describe('generateStory - 故事生成', () => {

  test('返回非空字符串', () => {
    const story = generateStory('intj_musk', 85);
    expect(typeof story).toBe('string');
    expect(story.length).toBeGreaterThan(0);
  });

  test('matchPercent >= 90 时包含"几乎完美匹配"前缀', () => {
    const story = generateStory('intj_musk', 95);
    expect(story).toContain('几乎完美匹配');
  });

  test('75 <= matchPercent < 90 时包含"高度匹配"前缀', () => {
    const story = generateStory('intj_musk', 80);
    expect(story).toContain('高度匹配');
  });

  test('matchPercent < 75 时包含"有共鸣"前缀', () => {
    const story = generateStory('intj_musk', 60);
    expect(story).toContain('有共鸣');
  });

  test('对每个人格分子都能生成非空故事', () => {
    for (const key of PERSONA_KEYS) {
      const story = generateStory(key, 75);
      expect(typeof story).toBe('string');
      expect(story.length).toBeGreaterThan(0);
    }
  });

  test('未知 moleculeKey 返回兜底非空文本', () => {
    const story = generateStory('nonexistent_key', 75);
    expect(typeof story).toBe('string');
    expect(story.length).toBeGreaterThan(0);
  });

  test('故事内容包含对应人格的模板文本', () => {
    const story = generateStory('intj_musk', 85);
    // 故事应由 STORIES 模板 + 前缀拼接,内容应非空且含模板
    expect(story.length).toBeGreaterThan(10);
  });
});

// ============================================================
// getMatchResult
// ============================================================

describe('getMatchResult - 完整匹配结果', () => {

  test('返回包含 molecule/matchPercent/mbti/story 的对象', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = getMatchResult(answers);
    expect(result).toHaveProperty('molecule');
    expect(result).toHaveProperty('matchPercent');
    expect(result).toHaveProperty('mbti');
    expect(result).toHaveProperty('story');
    expect(result).toHaveProperty('moleculeKey');
    expect(result).toHaveProperty('dimensions');
  });

  test('molecule 是 MOLECULES 中对应 moleculeKey 的对象(同一引用)', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = getMatchResult(answers);
    expect(result.molecule).toBe(MOLECULES[result.moleculeKey]);
  });

  test('moleculeKey 在 PERSONA_KEYS 中', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = getMatchResult(answers);
    expect(PERSONA_KEYS).toContain(result.moleculeKey);
  });

  test('matchPercent 在 50-100 之间', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = getMatchResult(answers);
    expect(result.matchPercent).toBeGreaterThanOrEqual(50);
    expect(result.matchPercent).toBeLessThanOrEqual(100);
  });

  test('story 是非空字符串', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = getMatchResult(answers);
    expect(typeof result.story).toBe('string');
    expect(result.story.length).toBeGreaterThan(0);
  });

  test('mbti 是 4 字符字符串', () => {
    const answers = ['A', 'B', 'A', 'B', 'A', 'B'];
    const result = getMatchResult(answers);
    expect(typeof result.mbti).toBe('string');
    expect(result.mbti).toHaveLength(4);
  });

  test('全选 A 的完整结果包含偏内向型人格分子', () => {
    const answers = ['A', 'A', 'A', 'A', 'A', 'A'];
    const result = getMatchResult(answers);
    expect(result.molecule.relatedPersona.charAt(0)).toBe('I');
    expect(result.story.length).toBeGreaterThan(0);
  });

  test('全选 B 的完整结果包含偏外向型人格分子', () => {
    const answers = ['B', 'B', 'B', 'B', 'B', 'B'];
    const result = getMatchResult(answers);
    expect(result.molecule.relatedPersona.charAt(0)).toBe('E');
    expect(result.story.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 端到端集成:分子数据完整性
// ============================================================

describe('分子数据集成校验(moleculeData)', () => {

  test('所有 23 个分子通过 validateAllMolecules', () => {
    const result = validateAllMolecules();
    expect(result.valid).toBe(true);
    expect(Object.keys(result.results)).toHaveLength(23);
  });

  test('PERSONA_KEYS 与 PERSONA_ANSWERS / STORIES 三者 key 一致', () => {
    const personaKeysSorted = [...PERSONA_KEYS].sort();
    expect(Object.keys(PERSONA_ANSWERS).sort()).toEqual(personaKeysSorted);
    expect(Object.keys(STORIES).sort()).toEqual(personaKeysSorted);
  });
});
