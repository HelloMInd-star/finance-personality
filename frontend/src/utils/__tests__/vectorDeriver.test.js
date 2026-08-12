/**
 * vectorDeriver 单元测试
 * 覆盖 deriveVectorFromContext / diffVectors
 */

import { deriveVectorFromContext, diffVectors } from '../vectorDeriver.js';

describe('vectorDeriver', () => {
  // ============================================================
  // deriveVectorFromContext
  // ============================================================
  describe('deriveVectorFromContext', () => {
    test('应返回 11 维向量', () => {
      const vec = deriveVectorFromContext({
        emotion: 'calm',
        baseSpirit: 'whisky',
        questionAnswer: '纯饮不加冰',
        transitionNote: '今晚想放松一下',
        storySeed: 'night_walk',
        bartender: { key: 'Cole' },
      });
      expect(vec).toHaveLength(11);
    });

    test('所有值应在 [0, 1] 范围内', () => {
      const vec = deriveVectorFromContext({
        emotion: 'passion',
        baseSpirit: 'gin',
        questionAnswer: '调一杯古典',
        transitionNote: 'x'.repeat(200),
        storySeed: 'adventure',
        zodiacCorrect: true,
        specialNote: 'x'.repeat(100),
        bartender: { key: 'Finn' },
      });
      vec.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    });

    test('无 context 应返回中性 0.5 向量', () => {
      const vec = deriveVectorFromContext(null);
      expect(vec).toHaveLength(11);
      vec.forEach((v) => expect(v).toBe(0.5));
    });

    test('空 context 应返回中性 0.5 向量', () => {
      const vec = deriveVectorFromContext({});
      expect(vec).toHaveLength(11);
      vec.forEach((v) => expect(v).toBe(0.5));
    });

    test('calm 情绪应提高 emotionalStability（维度 2）', () => {
      const vec = deriveVectorFromContext({
        emotion: 'calm',
        transitionNote: '今晚想放松一下',
      });
      expect(vec[2]).toBeGreaterThan(0.5);
    });

    test('excited 情绪应提高 riskTolerance（维度 0）', () => {
      const vec = deriveVectorFromContext({
        emotion: 'excited',
        transitionNote: '今晚想放松一下',
      });
      expect(vec[0]).toBeGreaterThan(0.5);
    });

    test('whisky 基酒应提高 discipline（维度 3）', () => {
      const vec = deriveVectorFromContext({
        emotion: 'calm',
        baseSpirit: 'whisky',
        transitionNote: '今晚想放松一下',
      });
      expect(vec[3]).toBeGreaterThan(0.5);
    });

    test('coffee 基酒应提高 decisionSpeed（维度 1）', () => {
      const vec = deriveVectorFromContext({
        emotion: 'calm',
        baseSpirit: 'coffee',
        transitionNote: '今晚想放松一下',
      });
      expect(vec[1]).toBeGreaterThan(0.5);
    });

    test('zodiacCorrect 应提高 creativity（维度 4）', () => {
      const ctx = {
        emotion: 'calm',
        transitionNote: '今晚想放松一下',
        zodiacCorrect: false,
      };
      const vecNoCorrect = deriveVectorFromContext(ctx);
      const vecCorrect = deriveVectorFromContext({ ...ctx, zodiacCorrect: true });
      expect(vecCorrect[4]).toBeGreaterThan(vecNoCorrect[4]);
    });

    test('长手记应比短手记有更高 emotionalStability', () => {
      const shortNote = deriveVectorFromContext({
        emotion: 'calm',
        transitionNote: '短笔记',
      });
      const longNote = deriveVectorFromContext({
        emotion: 'calm',
        transitionNote: 'x'.repeat(200),
      });
      expect(longNote[2]).toBeGreaterThan(shortNote[2]);
    });

    test('金融维度 6-10 应保持中性 0.5', () => {
      const vec = deriveVectorFromContext({
        emotion: 'passion',
        baseSpirit: 'gin',
        transitionNote: 'x'.repeat(150),
        zodiacCorrect: true,
      });
      for (let i = 6; i < 11; i++) {
        expect(vec[i]).toBe(0.5);
      }
    });

    test('storySeed reunion 应提高 socialTendency（维度 5）', () => {
      const vec = deriveVectorFromContext({
        emotion: 'calm',
        transitionNote: '今晚想放松一下',
        storySeed: 'reunion',
      });
      expect(vec[5]).toBeGreaterThan(0.5);
    });

    test('bartender Finn (ENFP) 应提高 creativity', () => {
      const vec = deriveVectorFromContext({
        emotion: 'calm',
        transitionNote: '今晚想放松一下',
        bartender: { key: 'Finn' },
      });
      expect(vec[4]).toBeGreaterThan(0.5);
    });

    test('specialNote 长度应影响 creativity', () => {
      const noNote = deriveVectorFromContext({
        emotion: 'calm',
        transitionNote: '今晚想放松一下',
        specialNote: '',
      });
      const longNote = deriveVectorFromContext({
        emotion: 'calm',
        transitionNote: '今晚想放松一下',
        specialNote: 'x'.repeat(60),
      });
      expect(longNote[4]).toBeGreaterThan(noNote[4]);
    });

    test('未知 emotion key 不应导致崩溃', () => {
      const vec = deriveVectorFromContext({
        emotion: 'unknown_emotion',
        transitionNote: '今晚想放松一下',
      });
      expect(vec).toHaveLength(11);
    });

    test('未知 baseSpirit key 不应导致崩溃', () => {
      const vec = deriveVectorFromContext({
        emotion: 'calm',
        baseSpirit: 'unknown_spirit',
        transitionNote: '今晚想放松一下',
      });
      expect(vec).toHaveLength(11);
    });
  });

  // ============================================================
  // diffVectors
  // ============================================================
  describe('diffVectors', () => {
    test('应返回 11 个维度的差异', () => {
      const a = new Array(11).fill(0.5);
      const b = new Array(11).fill(0.6);
      const diff = diffVectors(a, b);
      expect(diff).toHaveLength(11);
    });

    test('正差异应为正数', () => {
      const a = new Array(11).fill(0.5);
      const b = new Array(11).fill(0.7);
      const diff = diffVectors(a, b);
      diff.forEach((d) => {
        expect(d.delta).toBeGreaterThan(0);
      });
    });

    test('负差异应为负数', () => {
      const a = new Array(11).fill(0.7);
      const b = new Array(11).fill(0.5);
      const diff = diffVectors(a, b);
      diff.forEach((d) => {
        expect(d.delta).toBeLessThan(0);
      });
    });

    test('相同向量差异应为 0', () => {
      const a = new Array(11).fill(0.5);
      const diff = diffVectors(a, a);
      diff.forEach((d) => {
        expect(d.delta).toBe(0);
      });
    });

    test('before 缺失维度应按 0.5 兜底', () => {
      const diff = diffVectors([0.5], [0.7, 0.8, 0.9]);
      expect(diff).toHaveLength(11);
      expect(diff[0].delta).toBeCloseTo(0.2, 4);
    });

    test('after 缺失维度应按 0.5 兜底', () => {
      const diff = diffVectors([0.7, 0.8, 0.9], [0.5]);
      expect(diff).toHaveLength(11);
      expect(diff[0].delta).toBeCloseTo(-0.2, 4);
    });

    test('null 输入应返回全 0 差异', () => {
      const diff = diffVectors(null, null);
      expect(diff).toHaveLength(11);
      diff.forEach((d) => expect(d.delta).toBe(0));
    });

    test('delta 应保留 4 位小数', () => {
      const a = [0.123456, ...new Array(10).fill(0.5)];
      const b = [0.654321, ...new Array(10).fill(0.5)];
      const diff = diffVectors(a, b);
      // 0.654321 - 0.123456 = 0.530865 → toFixed(4) = 0.5309
      expect(diff[0].delta).toBe(0.5309);
    });
  });
});
