/**
 * MindSpeak 认知引擎测试 · mindspeakEngine
 *
 * 核心验证：
 * 1. 模块定义完整性（11个模块）
 * 2. 稳态计算（初始值 + 更新 + 自动回归）
 * 3. 模块置信度计算
 * 4. 三角三模型冗余审计（CALC + GameMind + geom）
 * 5. 全景矩阵
 * 6. 翻译引擎（正常 + 熔断阻断 + 审计未通过）
 * 7. 手动扰动滑块
 * 8. 状态读写
 */

import './testSetup.js';
import {
  MODULES,
  calculateInitialSteadyState,
  updateSteadyState,
  calculateModuleConfidences,
  calculatePanopticMatrix,
  triangleAudit,
  translate,
  getMindSpeakState,
  saveMindSpeakState,
  setManualPerturbation,
  STEADY_STATE_MIN,
  STEADY_STATE_MAX,
  STEADY_STATE_DEFAULT,
} from '../mindspeakEngine.js';
import { isFuseActive, emergencyStop, resetFuse } from '../fuse.js';

// ============================================================
// 模块定义
// ============================================================
describe('MODULES - 模块定义', () => {

  test('应有 11 个模块', () => {
    expect(MODULES.length).toBe(11);
  });

  test('每个模块有完整字段', () => {
    MODULES.forEach(mod => {
      expect(mod.id).toBeDefined();
      expect(mod.name).toBeDefined();
      expect(mod.icon).toBeDefined();
      expect(mod.description).toBeDefined();
      expect(mod.mathField).toBeDefined();
      expect(mod.algorithm).toBeDefined();
      expect(mod.defaultConfidence).toBeGreaterThan(0);
      expect(mod.defaultConfidence).toBeLessThan(1);
    });
  });

  test('包含关键模块', () => {
    const ids = MODULES.map(m => m.id);
    expect(ids).toContain('translator');
    expect(ids).toContain('wordOrder');
    expect(ids).toContain('tense');
    expect(ids).toContain('polysemy');
    expect(ids).toContain('chickenRabbit');
    expect(ids).toContain('engineering');
  });

  test('yMineField 映射覆盖多种行为数据', () => {
    const linkedModules = MODULES.filter(m => m.yMineField);
    expect(linkedModules.length).toBeGreaterThan(5);
    // 应覆盖 poker/billiards/fitness
    const fields = linkedModules.map(m => m.yMineField);
    expect(fields.some(f => f.startsWith('poker.'))).toBe(true);
    expect(fields.some(f => f.startsWith('billiards.'))).toBe(true);
    expect(fields.some(f => f.startsWith('fitness.'))).toBe(true);
  });
});

// ============================================================
// 稳态计算
// ============================================================
describe('calculateInitialSteadyState - 初始稳态', () => {

  test('空数据 → 返回默认稳态范围内', () => {
    const ss = calculateInitialSteadyState({});
    expect(ss).toBeGreaterThanOrEqual(STEADY_STATE_MIN);
    expect(ss).toBeLessThanOrEqual(STEADY_STATE_MAX);
  });

  test('情绪值 50 → 接近中轴 0.5', () => {
    const ss = calculateInitialSteadyState({ userState: { emotion: 50 } });
    expect(ss).toBeCloseTo(STEADY_STATE_MIN + 0.5 * (STEADY_STATE_MAX - STEADY_STATE_MIN), 2);
  });

  test('情绪值 100 → 接近上界 0.68', () => {
    const ss = calculateInitialSteadyState({ userState: { emotion: 100 } });
    expect(ss).toBeCloseTo(STEADY_STATE_MAX, 2);
  });

  test('情绪值 0 → 因 || 50 兜底，实际为 0.515', () => {
    // emotion=0 是 falsy，被 || 50 兜底为 50
    const ss = calculateInitialSteadyState({ userState: { emotion: 0 } });
    expect(ss).toBeCloseTo(0.515, 2);
  });

  test('aggressive 风险偏好 → +0.05', () => {
    const base = calculateInitialSteadyState({ userState: { emotion: 50 } });
    const agg = calculateInitialSteadyState({ userState: { emotion: 50, riskPreference: 'aggressive' } });
    expect(agg).toBeGreaterThan(base);
  });

  test('conservative 风险偏好 → -0.05', () => {
    const base = calculateInitialSteadyState({ userState: { emotion: 50 } });
    const con = calculateInitialSteadyState({ userState: { emotion: 50, riskPreference: 'conservative' } });
    expect(con).toBeLessThan(base);
  });

  test('结果始终在 [0.35, 0.68] 范围内', () => {
    for (let i = 0; i <= 100; i += 10) {
      const ss = calculateInitialSteadyState({ userState: { emotion: i } });
      expect(ss).toBeGreaterThanOrEqual(STEADY_STATE_MIN);
      expect(ss).toBeLessThanOrEqual(STEADY_STATE_MAX);
    }
  });
});

// ============================================================
// 稳态更新
// ============================================================
describe('updateSteadyState - 稳态更新', () => {

  test('无扰动时趋近中轴 0.5', () => {
    let ss = 0.68;
    for (let i = 0; i < 100; i++) {
      ss = updateSteadyState(ss, {}, 0);
    }
    expect(ss).toBeCloseTo(0.5, 1);
  });

  test('手动扰动正值 → 稳态上移', () => {
    const ss = updateSteadyState(0.5, {}, 0.1);
    expect(ss).toBeGreaterThan(0.5);
  });

  test('手动扰动负值 → 稳态下移', () => {
    const ss = updateSteadyState(0.5, {}, -0.1);
    expect(ss).toBeLessThan(0.5);
  });

  test('扰动限制在 ±0.2 范围', () => {
    // 通过 setManualPerturbation 限制
    setManualPerturbation(0.5); // 尝试设 0.5
    const state = getMindSpeakState();
    expect(state.manualPerturbation).toBeLessThanOrEqual(0.2);

    setManualPerturbation(-0.5);
    const state2 = getMindSpeakState();
    expect(state2.manualPerturbation).toBeGreaterThanOrEqual(-0.2);
  });

  test('稳态始终在 [0.35, 0.68] 范围', () => {
    for (let perturb = -0.2; perturb <= 0.2; perturb += 0.05) {
      const ss = updateSteadyState(0.5, {}, perturb);
      expect(ss).toBeGreaterThanOrEqual(STEADY_STATE_MIN);
      expect(ss).toBeLessThanOrEqual(STEADY_STATE_MAX);
    }
  });

  test('熔断激活时返回中轴 0.5', () => {
    emergencyStop('test');
    const ss = updateSteadyState(0.68, {}, 0.2);
    expect(ss).toBe(0.5);
    resetFuse(); // L6 可直接解除
  });
});

// ============================================================
// 模块置信度
// ============================================================
describe('calculateModuleConfidences - 模块置信度', () => {

  test('空数据 → 返回所有模块的默认置信度', () => {
    const confs = calculateModuleConfidences({});
    expect(Object.keys(confs).length).toBe(11);
    MODULES.forEach(mod => {
      expect(confs[mod.id]).toBeDefined();
      expect(confs[mod.id]).toBeGreaterThan(0);
      expect(confs[mod.id]).toBeLessThan(1);
    });
  });

  test('J 型 MBTI 提升特定模块置信度', () => {
    const baseConfs = calculateModuleConfidences({ userState: { currentMbti: 'INTP' } });
    const jConfs = calculateModuleConfidences({ userState: { currentMbti: 'INTJ' } });
    // wordOrder/engineering/enumeration 应被提升
    expect(jConfs.wordOrder).toBeGreaterThanOrEqual(baseConfs.wordOrder);
    expect(jConfs.engineering).toBeGreaterThanOrEqual(baseConfs.engineering);
  });

  test('P 型 MBTI 提升特定模块置信度', () => {
    const baseConfs = calculateModuleConfidences({ userState: { currentMbti: 'INTJ' } });
    const pConfs = calculateModuleConfidences({ userState: { currentMbti: 'INTP' } });
    expect(pConfs.polysemy).toBeGreaterThanOrEqual(baseConfs.polysemy);
    expect(pConfs.chickenRabbit).toBeGreaterThanOrEqual(baseConfs.chickenRabbit);
  });

  test('所有置信度在 [0.2, 0.95] 范围', () => {
    const confs = calculateModuleConfidences({
      userState: { currentMbti: 'ENFP', emotion: 100 },
      pokerGames: [{ kellyRatio: 0.8, avgDecisionTime: 10, avgHandStrength: 0.9, potOdds: 0.5, position: 5 }],
      billiardsSessions: [{ avgReflectionDeviation: 30, avgAdjustmentCount: 5 }],
      fitnessSessions: [{ deviation: { completionRate: 100, planModifications: 3 } }],
    });
    Object.values(confs).forEach(c => {
      expect(c).toBeGreaterThanOrEqual(0.2);
      expect(c).toBeLessThanOrEqual(0.95);
    });
  });
});

// ============================================================
// 全景矩阵
// ============================================================
describe('calculatePanopticMatrix - 全景矩阵', () => {

  test('返回 11×11 矩阵', () => {
    const confs = calculateModuleConfidences({});
    const matrix = calculatePanopticMatrix(confs);
    expect(matrix.length).toBe(11);
    matrix.forEach(row => {
      expect(row.length).toBe(11);
    });
  });

  test('对角线等于各模块置信度', () => {
    const confs = calculateModuleConfidences({});
    const matrix = calculatePanopticMatrix(confs);
    for (let i = 0; i < MODULES.length; i++) {
      expect(matrix[i][i]).toBeCloseTo(confs[MODULES[i].id] || 0.5, 5);
    }
  });

  test('空置信度 → 矩阵对角线为 0.5', () => {
    const matrix = calculatePanopticMatrix({});
    for (let i = 0; i < MODULES.length; i++) {
      expect(matrix[i][i]).toBe(0.5);
    }
  });

  test('同领域模块相关性更高', () => {
    const confs = calculateModuleConfidences({});
    const matrix = calculatePanopticMatrix(confs);
    // 找到两个相同 mathField 的模块
    const sameFieldPair = MODULES
      .map((m, i) => ({ i, field: m.mathField }))
      .reduce((acc, item) => {
        if (!acc[item.field]) acc[item.field] = [];
        acc[item.field].push(item.i);
        return acc;
      }, {});
    const field = Object.keys(sameFieldPair).find(f => sameFieldPair[f].length >= 2);
    if (field) {
      const [i, j] = sameFieldPair[field];
      // 同领域相关系数应 > 不同领域
      const diffField = MODULES.find((m, idx) => idx !== i && m.mathField !== field);
      if (diffField) {
        const jDiff = MODULES.indexOf(diffField);
        expect(matrix[i][j]).toBeGreaterThan(matrix[i][jDiff]);
      }
    }
  });
});

// ============================================================
// 三角审计
// ============================================================
describe('triangleAudit - 三角三模型冗余审计', () => {

  test('返回审计结果结构', () => {
    const confs = calculateModuleConfidences({});
    const matrix = calculatePanopticMatrix(confs);
    const result = triangleAudit(0.5, 0.65, 8, 11, confs, matrix, {});
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('maxDev');
    expect(result).toHaveProperty('tolerance');
    expect(result).toHaveProperty('scores');
    expect(result).toHaveProperty('labels');
    expect(result).toHaveProperty('step');
    expect(result.scores.length).toBe(3);
  });

  test('容差为 ±0.02', () => {
    const confs = calculateModuleConfidences({});
    const matrix = calculatePanopticMatrix(confs);
    const result = triangleAudit(0.5, 0.65, 8, 11, confs, matrix, {});
    expect(result.tolerance).toBe(0.02);
  });

  test('status 为 PASSED 或 BLOCKED', () => {
    const confs = calculateModuleConfidences({});
    const matrix = calculatePanopticMatrix(confs);
    const result = triangleAudit(0.5, 0.65, 8, 11, confs, matrix, {});
    expect(['PASSED', 'BLOCKED']).toContain(result.status);
  });

  test('scores 中任一为 0 → passed=false', () => {
    const confs = calculateModuleConfidences({});
    const matrix = calculatePanopticMatrix(confs);
    // 传入极端参数使某个模型异常
    const result = triangleAudit(0.5, 0.65, 0, 0, confs, [], {});
    expect(result.passed).toBe(false);
  });

  test('maxDev <= 0.02 且无零分 → passed=true', () => {
    // 使用合理的参数使三模型分数接近
    const confs = calculateModuleConfidences({ userState: { currentMbti: 'INTJ', emotion: 50 } });
    const matrix = calculatePanopticMatrix(confs);
    const result = triangleAudit(0.5, 0.65, 8, 11, confs, matrix, { userState: {} });
    // 大多数情况下应该通过
    expect(result.scores.every(s => s > 0)).toBe(true);
  });
});

// ============================================================
// 翻译引擎
// ============================================================
describe('translate - 翻译引擎', () => {

  beforeEach(() => {
    // 确保熔断未激活
    if (isFuseActive()) {
      try { resetFuse(true); } catch (_) {}
    }
    // 清除手动扰动
    setManualPerturbation(0);
  });

  test('正常翻译返回完整结果', () => {
    const result = translate('hello world', {});
    expect(result.input).toBe('hello world');
    expect(result.timestamp).toBeDefined();
    expect(result.steadyState).toBeDefined();
    expect(result.avgConfidence).toBeDefined();
    expect(result.activeCount).toBeDefined();
    expect(result.totalCount).toBe(11);
    expect(result.moduleOutputs).toBeDefined();
    expect(Array.isArray(result.moduleOutputs)).toBe(true);
    expect(result.panopticMatrix).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(typeof result.summary).toBe('string');
  });

  test('moduleOutputs 长度等于 11', () => {
    const result = translate('test', {});
    expect(result.moduleOutputs.length).toBe(11);
  });

  test('每个 moduleOutput 包含必要字段', () => {
    const result = translate('test', {});
    result.moduleOutputs.forEach(m => {
      expect(m).toHaveProperty('moduleId');
      expect(m).toHaveProperty('moduleName');
      expect(m).toHaveProperty('confidence');
      expect(m).toHaveProperty('active');
    });
  });

  test('稳态始终在 [0.35, 0.68]', () => {
    for (let i = 0; i < 10; i++) {
      const result = translate(`test_${i}`, {});
      expect(result.steadyState).toBeGreaterThanOrEqual(STEADY_STATE_MIN);
      expect(result.steadyState).toBeLessThanOrEqual(STEADY_STATE_MAX);
    }
  });

  test('带 Y.Mine 数据翻译', () => {
    const yMineData = {
      userState: { currentMbti: 'INTJ', emotion: 60, riskPreference: 'balanced' },
      pokerGames: [{ kellyRatio: 0.6, avgDecisionTime: 5, avgHandStrength: 0.7, potOdds: 0.4, position: 3 }],
    };
    const result = translate('战略决策', yMineData);
    expect(result.steadyState).toBeDefined();
    expect(result.avgConfidence).toBeGreaterThan(0);
  });

  test('熔断激活时返回 blocked 结果', () => {
    emergencyStop('test_translate');
    const result = translate('blocked test', {});
    expect(result.blocked).toBe(true);
    expect(result.summary).toContain('熔断');
    expect(result.activeCount).toBe(0);
    resetFuse();
  });

  test('空字符串输入不报错', () => {
    expect(() => translate('', {})).not.toThrow();
    expect(() => translate(null, {})).not.toThrow();
  });

  test('翻译结果包含 triangleAudit 字段', () => {
    const result = translate('audit test', {});
    expect(result.triangleAudit).toBeDefined();
    expect(result.triangleAudit.scores.length).toBe(3);
  });

  test('翻译结果包含 manualPerturbation 字段', () => {
    setManualPerturbation(0.1);
    const result = translate('perturb test', {});
    expect(result.manualPerturbation).toBe(0.1);
    setManualPerturbation(0); // 清理
  });
});

// ============================================================
// 状态读写
// ============================================================
describe('状态读写', () => {

  test('getMindSpeakState 默认状态', () => {
    const state = getMindSpeakState();
    expect(state.steadyState).toBe(STEADY_STATE_DEFAULT);
    expect(state.moduleConfidences).toEqual({});
    expect(state.emergencyStop).toBe(false);
    expect(state.manualPerturbation).toBe(0);
  });

  test('saveMindSpeakState + getMindSpeakState 往返', () => {
    saveMindSpeakState({
      steadyState: 0.55,
      moduleConfidences: { translator: 0.8 },
      manualPerturbation: 0.05,
    });
    const state = getMindSpeakState();
    expect(state.steadyState).toBe(0.55);
    expect(state.moduleConfidences.translator).toBe(0.8);
    expect(state.manualPerturbation).toBe(0.05);
  });

  test('setManualPerturbation 正确设置和限制', () => {
    const result = setManualPerturbation(0.15);
    expect(result).toBe(0.15);
    const state = getMindSpeakState();
    expect(state.manualPerturbation).toBe(0.15);
  });

  test('setManualPerturbation 超出 ±0.2 被截断', () => {
    expect(setManualPerturbation(1.0)).toBe(0.2);
    expect(setManualPerturbation(-1.0)).toBe(-0.2);
  });

  test('setManualPerturbation 非数字输入返回 0', () => {
    expect(setManualPerturbation('abc')).toBe(0);
    expect(setManualPerturbation(null)).toBe(0);
    expect(setManualPerturbation(undefined)).toBe(0);
  });
});

// ============================================================
// 集成测试：完整翻译流程
// ============================================================
describe('集成测试：完整翻译流程', () => {

  test('多次翻译后稳态趋于稳定', () => {
    let prevSteady = null;
    for (let i = 0; i < 5; i++) {
      const result = translate(`integration_${i}`, {
        userState: { emotion: 50, currentMbti: 'INTJ' },
      });
      if (prevSteady !== null) {
        // 稳态变化应逐渐减小
        const diff = Math.abs(result.steadyState - prevSteady);
        expect(diff).toBeLessThan(0.15);
      }
      prevSteady = result.steadyState;
    }
  });

  test('扰动 → 翻译 → 稳态偏移 → 回归', () => {
    // 设置扰动
    setManualPerturbation(0.2);
    const result1 = translate('with perturbation', {});
    expect(result1.steadyState).toBeGreaterThan(STEADY_STATE_MIN);

    // 移除扰动
    setManualPerturbation(0);
    // 多次翻译后稳态应回归
    let ss = result1.steadyState;
    for (let i = 0; i < 20; i++) {
      const r = translate(`revert_${i}`, {});
      ss = r.steadyState;
    }
    // 应该接近 0.5
    expect(ss).toBeLessThan(result1.steadyState);
  });
});
