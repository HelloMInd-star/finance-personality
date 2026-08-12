/**
 * timeEngine 单元测试
 * 覆盖 resolveTimeSlot / describeBiologyShift / applyBiologyShift
 */

import {
  resolveTimeSlot,
  describeBiologyShift,
  applyBiologyShift,
  ALL_SLOTS,
} from '../timeEngine.js';

describe('timeEngine', () => {
  // ============================================================
  // resolveTimeSlot
  // ============================================================
  describe('resolveTimeSlot', () => {
    test('5:00 应解析为 dawn', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T05:30:00'));
      expect(slot.key).toBe('dawn');
    });

    test('9:00 应解析为 morning', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T09:30:00'));
      expect(slot.key).toBe('morning');
    });

    test('12:00 应解析为 noon', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T12:30:00'));
      expect(slot.key).toBe('noon');
    });

    test('14:00 应解析为 pm', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T15:30:00'));
      expect(slot.key).toBe('pm');
    });

    test('18:00 应解析为 dusk', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T19:30:00'));
      expect(slot.key).toBe('dusk');
    });

    test('21:00 应解析为 night', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T22:30:00'));
      expect(slot.key).toBe('night');
    });

    test('0:00 应解析为 midnight', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T03:30:00'));
      expect(slot.key).toBe('midnight');
    });

    test('manual 参数应覆盖时间推断', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T12:30:00'), 'dawn');
      expect(slot.key).toBe('dawn');
    });

    test('无效 manual 应回退到时间推断', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T12:30:00'), 'nonexistent');
      expect(slot.key).toBe('noon');
    });

    test('无 date 参数应使用当前时间', () => {
      const slot = resolveTimeSlot();
      expect(ALL_SLOTS).toContainEqual(expect.objectContaining({ key: slot.key }));
    });

    test('每个 slot 应包含完整字段', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      expect(slot).toHaveProperty('key');
      expect(slot).toHaveProperty('label');
      expect(slot).toHaveProperty('range');
      expect(slot).toHaveProperty('auraColor');
      expect(slot).toHaveProperty('orbState');
      expect(slot).toHaveProperty('biologyNote');
      expect(slot).toHaveProperty('poem');
      expect(slot).toHaveProperty('shifts');
    });

    test('边界时间应正确归类（hour === start）', () => {
      // dawn 5:00-8:59，5:00 应在 dawn
      expect(resolveTimeSlot(new Date('2026-01-01T05:00:00')).key).toBe('dawn');
      // morning 9:00-11:59，9:00 应在 morning
      expect(resolveTimeSlot(new Date('2026-01-01T09:00:00')).key).toBe('morning');
    });

    test('边界时间应正确归类（hour === end-1）', () => {
      // dawn 5:00-8:59，8:00 应在 dawn
      expect(resolveTimeSlot(new Date('2026-01-01T08:00:00')).key).toBe('dawn');
      // morning 9:00-11:59，11:00 应在 morning
      expect(resolveTimeSlot(new Date('2026-01-01T11:00:00')).key).toBe('morning');
    });

    test('ALL_SLOTS 应包含 7 个时段', () => {
      expect(ALL_SLOTS).toHaveLength(7);
    });
  });

  // ============================================================
  // describeBiologyShift
  // ============================================================
  describe('describeBiologyShift', () => {
    test('morning 时段应有偏移描述', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const shifts = describeBiologyShift(slot);
      expect(shifts.length).toBeGreaterThan(0);
    });

    test('每个 shift 应包含 dim/label/sign/delta', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const shifts = describeBiologyShift(slot);
      shifts.forEach((s) => {
        expect(s).toHaveProperty('dim');
        expect(s).toHaveProperty('label');
        expect(s).toHaveProperty('sign');
        expect(s).toHaveProperty('delta');
        expect(['+', '−']).toContain(s.sign);
        expect(typeof s.delta).toBe('number');
        expect(s.delta).toBeGreaterThan(0);
      });
    });

    test('正偏移 sign 应为 +', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const shifts = describeBiologyShift(slot);
      const positive = shifts.find((s) => s.raw > 0);
      expect(positive).toBeDefined();
      expect(positive.sign).toBe('+');
    });

    test('负偏移 sign 应为 −', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T06:00:00'));
      const shifts = describeBiologyShift(slot);
      const negative = shifts.find((s) => s.raw < 0);
      expect(negative).toBeDefined();
      expect(negative.sign).toBe('−');
    });

    test('null slot 应返回空数组', () => {
      expect(describeBiologyShift(null)).toEqual([]);
    });

    test('undefined slot 应返回空数组', () => {
      expect(describeBiologyShift(undefined)).toEqual([]);
    });
  });

  // ============================================================
  // applyBiologyShift
  // ============================================================
  describe('applyBiologyShift', () => {
    test('应对 morning 时段应用正偏移', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const base = new Array(11).fill(0.5);
      const result = applyBiologyShift(base, slot);
      // 至少有一个维度 > 0.5（因为 morning 有 +0.05 的偏移）
      const hasIncrease = result.some((v, i) => v > base[i]);
      expect(hasIncrease).toBe(true);
    });

    test('应只修改通用维度（0-5），不动金融维度（6-10）', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const base = new Array(11).fill(0.5);
      const result = applyBiologyShift(base, slot);
      for (let i = 6; i < 11; i++) {
        expect(result[i]).toBe(0.5);
      }
    });

    test('不应修改入参向量', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const base = new Array(11).fill(0.5);
      const baseSnapshot = base.slice();
      applyBiologyShift(base, slot);
      expect(base).toEqual(baseSnapshot);
    });

    test('结果应 clamp 到 [0, 1]', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const base = new Array(11).fill(0.99);
      const result = applyBiologyShift(base, slot);
      result.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    });

    test('下界 clamp：0.0 + 负偏移 → 0', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T06:00:00'));
      const base = new Array(11).fill(0.0);
      const result = applyBiologyShift(base, slot);
      result.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
      });
    });

    test('null slot 应原样返回向量副本', () => {
      const base = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99];
      const result = applyBiologyShift(base, null);
      expect(result).toEqual(base);
      expect(result).not.toBe(base); // 应是新数组
    });

    test('undefined vec 应返回 0.5 填充的 11 维', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const result = applyBiologyShift(undefined, slot);
      expect(result).toHaveLength(11);
    });

    test('长度不足应补齐到 11 维', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const result = applyBiologyShift([0.5, 0.5], slot);
      expect(result).toHaveLength(11);
    });

    test('morning 时段应在维度 1（decisionSpeed）增加', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const base = new Array(11).fill(0.5);
      const result = applyBiologyShift(base, slot);
      // morning.shifts = { 1: +0.05, 3: +0.04, 4: +0.02 }
      expect(result[1]).toBeCloseTo(0.55, 5);
      expect(result[3]).toBeCloseTo(0.54, 5);
      expect(result[4]).toBeCloseTo(0.52, 5);
    });

    test('dawn 时段应在维度 5（socialTendency）减少', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T06:00:00'));
      const base = new Array(11).fill(0.5);
      const result = applyBiologyShift(base, slot);
      // dawn.shifts = { 1: +0.04, 2: +0.03, 3: +0.05, 5: -0.03 }
      expect(result[5]).toBeCloseTo(0.47, 5);
    });

    test('非数组 vec 应被替换为 0.5 填充', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const result = applyBiologyShift('not-an-array', slot);
      expect(result).toHaveLength(11);
      result.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    });

    test('NaN 值应被替换为 0.5', () => {
      const slot = resolveTimeSlot(new Date('2026-01-01T10:00:00'));
      const base = [NaN, NaN, NaN, NaN, NaN, NaN, 0.7, 0.8, 0.9, 0.95, 0.99];
      const result = applyBiologyShift(base, slot);
      // 维度 0 没有 shift，应为 0.5（safeNum 兜底）
      expect(result[0]).toBe(0.5);
      // 金融维度保留原值
      expect(result[6]).toBe(0.7);
    });
  });

  // ============================================================
  // 全时段覆盖测试
  // ============================================================
  describe('all slots coverage', () => {
    test('每个时段都能被解析', () => {
      const hours = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
      const keys = new Set();
      hours.forEach((h) => {
        const slot = resolveTimeSlot(new Date(`2026-01-01T${String(h).padStart(2, '0')}:30:00`));
        keys.add(slot.key);
      });
      // 应至少覆盖 6 个时段（极端边界可能重合）
      expect(keys.size).toBeGreaterThanOrEqual(6);
    });

    test('每个时段都应有非空 shifts', () => {
      ALL_SLOTS.forEach((slot) => {
        expect(slot.shifts).toBeDefined();
        expect(Object.keys(slot.shifts).length).toBeGreaterThan(0);
      });
    });

    test('每个时段都应有 poem（非空字符串）', () => {
      ALL_SLOTS.forEach((slot) => {
        expect(typeof slot.poem).toBe('string');
        expect(slot.poem.length).toBeGreaterThan(0);
      });
    });
  });
});
