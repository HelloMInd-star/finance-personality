/**
 * feedbackEngine 反馈回路引擎测试
 *
 * 覆盖五类用例：
 *  1. 空反馈
 *  2. 高分（rating >= 4）
 *  3. 低分（rating <= 2）
 *  4. clamp 边界（向量值域 [0,1] + 单次总幅度 ≤ 0.05）
 *  5. 累积校准（多条反馈叠加 + 中和）
 *
 * 额外覆盖：纯函数性（不修改入参）、输入鲁棒性、常量约束
 */

import {
  calibrateVector,
  STEP,
  MAX_DELTA,
} from '../feedbackEngine.js';
import { DIM_COUNT, VECTOR_DIMENSIONS } from '../vectorMapper.js';

// ============================================================
// 测试基线
// ============================================================

const BASE = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
const ts = () => Date.now();
const mk = (recipeId, rating, extra = {}) => ({ recipeId, rating, ts: ts(), ...extra });

// ============================================================
// 常量与维度
// ============================================================

describe('常量与维度基线', () => {

  test('STEP = 0.02，MAX_DELTA = 0.05', () => {
    expect(STEP).toBe(0.02);
    expect(MAX_DELTA).toBe(0.05);
  });

  test('MAX_DELTA 是 STEP 的整数倍（保证 clamp 边界可被命中）', () => {
    expect(MAX_DELTA / STEP).toBe(2.5);
  });

  test('向量维度 = 11（与 vectorMapper 一致）', () => {
    expect(DIM_COUNT).toBe(11);
    expect(VECTOR_DIMENSIONS).toHaveLength(11);
  });
});

// ============================================================
// 1. 空反馈
// ============================================================

describe('空反馈 - 返回基础向量副本', () => {

  test('feedback 为空数组时结果与 base 逐维相等', () => {
    const result = calibrateVector(BASE, []);
    expect(result).toEqual(BASE);
  });

  test('feedback 为 undefined 时退化为空反馈', () => {
    const result = calibrateVector(BASE, undefined);
    expect(result).toEqual(BASE);
  });

  test('feedback 为 null 时退化为空反馈', () => {
    const result = calibrateVector(BASE, null);
    expect(result).toEqual(BASE);
  });

  test('返回的是新数组（不与 base 共享引用）', () => {
    const result = calibrateVector(BASE, []);
    expect(result).not.toBe(BASE);
    expect(Array.isArray(result)).toBe(true);
  });

  test('base 为 undefined 时使用 0.5 中性默认向量', () => {
    const result = calibrateVector(undefined, []);
    expect(result).toHaveLength(DIM_COUNT);
    for (const v of result) expect(v).toBe(0.5);
  });
});

// ============================================================
// 2. 高分（rating >= 4）
// ============================================================

describe('高分反馈 - 朝推荐方向微调 +0.02', () => {

  test('rating = 5：每维度 +0.02', () => {
    const result = calibrateVector(BASE, [mk('r1', 5)]);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(0.52, 10);
    }
  });

  test('rating = 4：每维度 +0.02（边界包含）', () => {
    const result = calibrateVector(BASE, [mk('r1', 4)]);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(0.52, 10);
    }
  });

  test('不均匀 base 也能正确加 0.02', () => {
    const base = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99];
    const result = calibrateVector(base, [mk('r1', 5)]);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(Math.min(1, base[i] + STEP), 10);
    }
  });
});

// ============================================================
// 3. 低分（rating <= 2）
// ============================================================

describe('低分反馈 - 反向微调 -0.02', () => {

  test('rating = 1：每维度 -0.02', () => {
    const result = calibrateVector(BASE, [mk('r1', 1)]);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(0.48, 10);
    }
  });

  test('rating = 2：每维度 -0.02（边界包含）', () => {
    const result = calibrateVector(BASE, [mk('r1', 2)]);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(0.48, 10);
    }
  });

  test('rating = 3：中性，不影响向量', () => {
    const result = calibrateVector(BASE, [mk('r1', 3)]);
    expect(result).toEqual(BASE);
  });
});

// ============================================================
// 4. clamp 边界
// ============================================================

describe('clamp 边界 - 向量值域 [0,1] + 单次总幅度 ≤ 0.05', () => {

  test('base 全 1.0 + 高分：结果不溢出 1.0', () => {
    const base = new Array(DIM_COUNT).fill(1);
    const result = calibrateVector(base, [mk('r1', 5)]);
    for (const v of result) expect(v).toBe(1);
  });

  test('base 全 0.0 + 低分：结果不低于 0.0', () => {
    const base = new Array(DIM_COUNT).fill(0);
    const result = calibrateVector(base, [mk('r1', 1)]);
    for (const v of result) expect(v).toBe(0);
  });

  test('base = 0.99 + 高分：clamp 到 1.0', () => {
    const base = new Array(DIM_COUNT).fill(0.99);
    const result = calibrateVector(base, [mk('r1', 5)]);
    for (const v of result) expect(v).toBe(1);
  });

  test('base = 0.01 + 低分：clamp 到 0.0', () => {
    const base = new Array(DIM_COUNT).fill(0.01);
    const result = calibrateVector(base, [mk('r1', 1)]);
    for (const v of result) expect(v).toBe(0);
  });

  test('3 条高分（理论 +0.06）：单次总幅度 clamp 到 +0.05', () => {
    const result = calibrateVector(BASE, [
      mk('r1', 5), mk('r2', 5), mk('r3', 5),
    ]);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(0.5 + MAX_DELTA, 10);
    }
  });

  test('3 条低分（理论 -0.06）：单次总幅度 clamp 到 -0.05', () => {
    const result = calibrateVector(BASE, [
      mk('r1', 1), mk('r2', 1), mk('r3', 1),
    ]);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(0.5 - MAX_DELTA, 10);
    }
  });

  test('单次调用任意维度变化绝对值 ≤ MAX_DELTA', () => {
    const base = new Array(DIM_COUNT).fill(0.5);
    const result = calibrateVector(base, [
      mk('r1', 5), mk('r2', 5), mk('r3', 5), mk('r4', 5),
      mk('r5', 5), mk('r6', 5), mk('r7', 5), mk('r8', 5),
    ]);
    for (let i = 0; i < DIM_COUNT; i++) {
      const delta = Math.abs(result[i] - base[i]);
      expect(delta).toBeLessThanOrEqual(MAX_DELTA + 1e-9);
    }
  });
});

// ============================================================
// 5. 累积校准
// ============================================================

describe('累积校准 - 多条反馈叠加 + 中和', () => {

  test('5 条高分（理论 +0.10）：clamp 到 +0.05', () => {
    const result = calibrateVector(BASE, [
      mk('r1', 5), mk('r2', 5), mk('r3', 5), mk('r4', 5), mk('r5', 5),
    ]);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(0.5 + MAX_DELTA, 10);
    }
  });

  test('10 条高分：仍 clamp 在 +0.05', () => {
    const fbs = Array.from({ length: 10 }, (_, i) => mk(`r${i}`, 5));
    const result = calibrateVector(BASE, fbs);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(0.5 + MAX_DELTA, 10);
    }
  });

  test('高分 + 低分抵消：结果 = base', () => {
    const result = calibrateVector(BASE, [mk('r1', 5), mk('r2', 1)]);
    expect(result).toEqual(BASE);
  });

  test('2 高 + 2 低：抵消后 = base', () => {
    const result = calibrateVector(BASE, [
      mk('r1', 5), mk('r2', 4), mk('r3', 1), mk('r4', 2),
    ]);
    expect(result).toEqual(BASE);
  });

  test('2 高 + 1 低：净方向 +1 → +0.02', () => {
    const result = calibrateVector(BASE, [
      mk('r1', 5), mk('r2', 5), mk('r3', 1),
    ]);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(0.52, 10);
    }
  });

  test('中性评分不影响累积方向', () => {
    const r1 = calibrateVector(BASE, [mk('r1', 5)]);
    const r2 = calibrateVector(BASE, [mk('r1', 5), mk('r2', 3), mk('r3', 3)]);
    expect(r1).toEqual(r2);
  });
});

// ============================================================
// 纯函数性
// ============================================================

describe('纯函数性 - 不修改入参', () => {

  test('不修改 base 数组', () => {
    const baseSnapshot = BASE.slice();
    calibrateVector(BASE, [mk('r1', 5), mk('r2', 1)]);
    expect(BASE).toEqual(baseSnapshot);
  });

  test('不修改 feedback 数组', () => {
    const fb = [mk('r1', 5), mk('r2', 1)];
    const fbSnapshot = fb.map((f) => ({ ...f }));
    calibrateVector(BASE, fb);
    expect(fb).toEqual(fbSnapshot);
  });

  test('相同输入两次调用结果一致（确定性）', () => {
    const fb = [mk('r1', 5), mk('r2', 4), mk('r3', 1)];
    const r1 = calibrateVector(BASE, fb);
    const r2 = calibrateVector(BASE, fb);
    expect(r1).toEqual(r2);
  });
});

// ============================================================
// 输入鲁棒性
// ============================================================

describe('输入鲁棒性 - 容错处理', () => {

  test('feedback 含 null / undefined 元素：跳过', () => {
    const result = calibrateVector(BASE, [null, undefined, mk('r1', 5)]);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(0.52, 10);
    }
  });

  test('feedback 元素 rating 缺失：按 0 处理（中性）', () => {
    const result = calibrateVector(BASE, [{ recipeId: 'r1', ts: ts() }]);
    expect(result).toEqual(BASE);
  });

  test('feedback 元素 rating 非数字：按 0 处理（中性）', () => {
    const result = calibrateVector(BASE, [{ recipeId: 'r1', rating: '5', ts: ts() }]);
    expect(result).toEqual(BASE);
  });

  test('base 长度不足 11：补齐到 11 维', () => {
    const result = calibrateVector([0.5, 0.5, 0.5], []);
    expect(result).toHaveLength(DIM_COUNT);
  });

  test('FeedbackSignal 携带 dimensions 字段不报错（保留字段）', () => {
    const result = calibrateVector(BASE, [
      mk('r1', 5, { dimensions: { flavor: 4, scent: 3, mood: 5 } }),
    ]);
    for (let i = 0; i < DIM_COUNT; i++) {
      expect(result[i]).toBeCloseTo(0.52, 10);
    }
  });
});
