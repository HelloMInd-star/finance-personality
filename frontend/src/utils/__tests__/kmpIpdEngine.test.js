/**
 * KMP→IPD 记忆学习引擎测试 · kmpIpdEngine
 *
 * 核心验证：
 * 1. 感知（perception）：从翻译结果提取原始记忆
 * 2. 建模（modeling）：四维结构化 + 七维向量
 * 3. 四级净化漏斗（purify）：L1-L4 各类拒绝/放行
 * 4. 三级仓储（store / getKmpState）
 * 5. KMP 骨架检索（retrieve）
 * 6. 验证（verify）
 * 7. PID 进化（evolve）
 * 8. 六步闭环 study() 全链路
 */

import './testSetup.js';
import {
  perception,
  modeling,
  purify,
  store,
  retrieve,
  verify,
  evolve,
  study,
  getKmpState,
  VECTOR_DIMS,
} from '../kmpIpdEngine.js';
import { emergencyStop, resetFuse } from '../fuse.js';

// 构造一次典型的翻译结果
function makeTranslateResult(text = '买入 凯利 仓位 策略 风险', steadyState = 0.55) {
  return {
    input: text,
    steadyState,
    avgConfidence: 0.72,
    activeCount: 3,
    totalCount: 11,
    moduleOutputs: [
      { moduleId: 'tense', moduleName: '时态', confidence: 0.72, active: true },
      { moduleId: 'translator', moduleName: '翻译器', confidence: 0.75, active: true },
      { moduleId: 'culture', moduleName: '文化', confidence: 0.68, active: true },
      { moduleId: 'affix', moduleName: '词缀', confidence: 0.3, active: false },
    ],
    triangleAudit: { passed: true, status: 'PASSED', maxDev: 0.01 },
    blocked: false,
  };
}

describe('perception - 感知', () => {
  test('从翻译结果提取原始记忆', () => {
    const raw = perception(makeTranslateResult('凯利 配置 风险 策略'));
    expect(raw.text).toContain('凯利');
    expect(raw.source).toBe('mindspeak');
    expect(raw.signals.steadyState).toBe(0.55);
    expect(raw.entities.length).toBe(3);
    expect(raw.entities[0]).toBe('时态');
  });

  test('空输入也能安全处理', () => {
    const raw = perception({});
    expect(raw.text).toBe('');
    expect(raw.entities).toEqual([]);
    expect(raw.signals.steadyState).toBe(0); // clamp01(undefined=0)
  });
});

describe('modeling - 建模（四维 + 七维向量）', () => {
  test('生成四维结构化', () => {
    const raw = perception(makeTranslateResult());
    const model = modeling(raw);
    expect(model.subject).toBe('时态');
    expect(model.action).toBe('映射通过');
    expect(typeof model.magnitude).toBe('number');
    expect(typeof model.disturbance).toBe('number');
  });

  test('七维向量包含全部 7 个维度且在 [0,1]', () => {
    const raw = perception(makeTranslateResult());
    const model = modeling(raw);
    expect(VECTOR_DIMS.length).toBe(7);
    for (const dim of VECTOR_DIMS) {
      expect(model.featureVector[dim.id]).toBeDefined();
      expect(model.featureVector[dim.id]).toBeGreaterThanOrEqual(0);
      expect(model.featureVector[dim.id]).toBeLessThanOrEqual(1);
    }
  });
});

describe('purify - 四级净化漏斗', () => {
  test('有效记忆通过 L4 入长期公理库', () => {
    const raw = perception(makeTranslateResult('凯利 配置 风险 策略', 0.55));
    const model = modeling(raw);
    const result = purify(model);
    expect(result.ok).toBe(true);
    expect(result.denied).toBe(false);
    expect(result.stage).toBe('L4');
    expect(result.tier).toBe('hot');
    expect(result.label).toBe('风险');
  });

  test('触碰熔断红线（>0.68）降级缓冲待审', () => {
    const raw = perception(makeTranslateResult('凯利 配置 风险 策略', 0.75));
    const model = modeling(raw);
    const result = purify(model);
    expect(result.ok).toBe(false);
    expect(result.tier).toBe('warm');
  });

  test('无有效内容（L1 粗滤）被拒绝', () => {
    const raw = perception(makeTranslateResult('嗯 啊 哦'));
    const model = modeling(raw);
    const result = purify(model);
    expect(result.denied).toBe(true);
    expect(result.stage).toBe('L1');
  });
});

describe('store / getKmpState - 三级仓储', () => {
  test('入库后可在 getKmpState 读取', () => {
    const raw = perception(makeTranslateResult('凯利 配置 策略', 0.55));
    const model = modeling(raw);
    const entry = store(model, 'hot');
    expect(entry.id).toMatch(/^kmp_/);
    expect(entry.strength).toBe(0.6);
    const state = getKmpState();
    expect(state.tiers.hot.count).toBeGreaterThanOrEqual(1);
    expect(state.tiers.hot.entries[0].id).toBe(entry.id);
  });
});

describe('retrieve - KMP 骨架检索', () => {
  test('相似向量命中已存记忆', () => {
    // 先存一条
    const raw1 = perception(makeTranslateResult('凯利 配置 风险 策略', 0.55));
    const model1 = modeling(raw1);
    store(model1, 'hot');

    // 用极其相似的向量检索
    const raw2 = perception(makeTranslateResult('凯利 配置 风险 策略', 0.55));
    const model2 = modeling(raw2);
    const hits = retrieve(model2.featureVector);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].similarity).toBeGreaterThan(0.9);
  });
});

describe('verify - 验证', () => {
  test('一致候选通过验证', () => {
    const raw = perception(makeTranslateResult('凯利 配置 策略', 0.55));
    const model = modeling(raw);
    const entry = store(model, 'hot');
    const candidates = [{ id: entry.id, magnitude: 0.55 }];
    const res = verify(candidates, null, 0.55);
    expect(res.passed).toBe(true);
    expect(res.divergences).toBe(0);
  });

  test('分歧超容差标记分歧', () => {
    const candidates = [{ id: 'x', magnitude: 0.3 }];
    const res = verify(candidates, null, 0.8);
    expect(res.passed).toBe(false);
    expect(res.divergences).toBe(1);
  });
});

describe('evolve - PID 进化', () => {
  test('hit 反馈提升强度', () => {
    const raw = perception(makeTranslateResult('凯利 配置 策略', 0.55));
    const model = modeling(raw);
    const entry = store(model, 'hot');
    const before = entry.strength;
    const res = evolve(entry.id, 'hit');
    expect(res.ok).toBe(true);
    expect(res.strength).toBeGreaterThan(before);
    expect(res.hitCount).toBe(1);
  });

  test('strength 被 clamp 在 [0,1]', () => {
    const raw = perception(makeTranslateResult('凯利 配置 策略', 0.55));
    const model = modeling(raw);
    const entry = store(model, 'hot');
    // 多次 adopted 强化
    for (let i = 0; i < 10; i++) evolve(entry.id, 'adopted');
    const state = getKmpState();
    const found = state.tiers.hot.entries.find(m => m.id === entry.id);
    if (found) {
      expect(found.strength).toBeLessThanOrEqual(1);
      expect(found.strength).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('study - 六步闭环全链路', () => {
  test('有效翻译触发完整闭环并入库', () => {
    const result = makeTranslateResult('凯利 配置 风险 策略', 0.55);
    const res = study(result, {});
    expect(res.blocked).toBe(false);
    expect(res.steps.length).toBeGreaterThanOrEqual(6);
    expect(res.stored).toBeDefined();
    // 六步都应有结果
    const steps = res.steps.map(s => s.step);
    expect(steps).toContain('感知');
    expect(steps).toContain('建模');
    expect(steps).toContain('存储');
    expect(steps).toContain('检索');
    expect(steps).toContain('验证');
    expect(steps).toContain('进化');
  });

  test('熔断激活时阻断学习', () => {
    // 触发 L6 紧急停机激活熔断
    emergencyStop('test');
    const res = study(makeTranslateResult('凯利 配置 策略', 0.55), {});
    expect(res.blocked).toBe(true);
    expect(res.steps[0].status).toBe('blocked');
    // 复位熔断避免影响其它测试
    resetFuse(true);
  });
});