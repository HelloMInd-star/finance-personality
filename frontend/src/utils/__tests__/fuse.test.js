/**
 * 七层熔断体系测试 · fuse
 *
 * 核心验证：
 * 1. 初始状态：未激活
 * 2. 各层触发逻辑（L1-L7）
 * 3. canBypass 永远为 false
 * 4. resetFuse 安全规则（L6 可直接解除，其他需 force）
 * 5. checkValuationBreach 区间检查
 * 6. bumpEngineFail 连续失败计数
 * 7. checkBlackSwan σ 判定
 * 8. emergencyStop 手动停机
 */

import './testSetup.js';
import {
  FUSE_LAYERS,
  THRESHOLDS,
  triggerFuse,
  resetFuse,
  getFuseState,
  isFuseActive,
  checkValuationBreach,
  bumpEngineFail,
  checkMaxDrawdown,
  checkEmotionTilt,
  checkBlackSwan,
  emergencyStop,
  triggerCustomFuse,
  getFuseHistory,
} from '../fuse.js';

// ============================================================
// 初始状态与常量
// ============================================================
describe('初始状态与常量', () => {

  test('初始状态 active=false', () => {
    expect(isFuseActive()).toBe(false);
    const state = getFuseState();
    expect(state.active).toBe(false);
    expect(state.triggeredLayer).toBeNull();
  });

  test('canBypass 永远为 false', () => {
    const state = getFuseState();
    expect(state.canBypass).toBe(false);
  });

  test('FUSE_LAYERS 应有 7 层', () => {
    expect(FUSE_LAYERS.length).toBe(7);
    expect(FUSE_LAYERS[0].id).toBe('BLACK_SWAN');
    expect(FUSE_LAYERS[6].id).toBe('CUSTOM_RULE');
  });

  test('THRESHOLDS 关键值', () => {
    expect(THRESHOLDS.FUSE_RED_LINE).toBe(0.68);
    expect(THRESHOLDS.STEADY_MID).toBe(0.50);
    expect(THRESHOLDS.MAX_DRAWDOWN).toBe(0.20);
    expect(THRESHOLDS.CONSECUTIVE_FAILS).toBe(3);
    expect(THRESHOLDS.SIGMA_BLACK_SWAN).toBe(3);
  });
});

// ============================================================
// triggerFuse / isFuseActive
// ============================================================
describe('triggerFuse - 熔断触发', () => {

  beforeEach(() => {
    // 每个测试前重置熔断
    const state = getFuseState();
    if (state.active) {
      try { resetFuse(true); } catch (_) {}
    }
  });

  test('触发 L3 后 isFuseActive 返回 true', () => {
    triggerFuse('VALUATION_BREACH', '测试触发');
    expect(isFuseActive()).toBe(true);
  });

  test('触发后 triggeredLayer 包含正确的层级信息', () => {
    triggerFuse('SYSTEM_CRASH', '测试崩溃');
    const state = getFuseState();
    expect(state.triggeredLayer.id).toBe('SYSTEM_CRASH');
    expect(state.triggeredLayer.level).toBe(2);
  });

  test('重复触发不覆盖（保持首次触发层）', () => {
    triggerFuse('VALUATION_BREACH', '第一次');
    triggerFuse('BLACK_SWAN', '第二次');
    const state = getFuseState();
    expect(state.triggeredLayer.id).toBe('VALUATION_BREACH');
  });

  test('未知 layerId 抛异常', () => {
    expect(() => triggerFuse('UNKNOWN_LAYER', 'test')).toThrow(/未知熔断层级/);
  });

  test('触发后 canBypass 仍为 false', () => {
    triggerFuse('MANUAL_STOP', '手动');
    expect(getFuseState().canBypass).toBe(false);
  });

  test('触发后记录到历史', () => {
    triggerFuse('MANUAL_STOP', '历史测试');
    const history = getFuseHistory(5);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].type).toBe('TRIGGER');
  });
});

// ============================================================
// resetFuse - 熔断重置
// ============================================================
describe('resetFuse - 熔断重置', () => {

  beforeEach(() => {
    const state = getFuseState();
    if (state.active) {
      try { resetFuse(true); } catch (_) {}
    }
  });

  test('L6 手动停机可直接 reset', () => {
    triggerFuse('MANUAL_STOP', '手动停机');
    expect(isFuseActive()).toBe(true);
    resetFuse(); // 不需要 force
    expect(isFuseActive()).toBe(false);
  });

  test('非 L6 熔断禁止直接 reset（抛异常）', () => {
    triggerFuse('VALUATION_BREACH', '估值越界');
    expect(() => resetFuse(false)).toThrow(/安全红线/);
    // 仍然激活
    expect(isFuseActive()).toBe(true);
  });

  test('非 L6 熔断可通过 force=true 强制解除', () => {
    triggerFuse('SYSTEM_CRASH', '系统崩溃');
    resetFuse(true);
    expect(isFuseActive()).toBe(false);
  });

  test('无激活熔断时 reset 不报错', () => {
    expect(isFuseActive()).toBe(false);
    const state = resetFuse();
    expect(state.active).toBe(false);
  });

  test('reset 后历史记录包含 RESET 条目', () => {
    triggerFuse('MANUAL_STOP', '待重置');
    resetFuse();
    const history = getFuseHistory(5);
    const resetEntry = history.find(h => h.type === 'RESET');
    expect(resetEntry).toBeDefined();
  });
});

// ============================================================
// L3 估值越界 checkValuationBreach
// ============================================================
describe('checkValuationBreach - L3 估值越界检查', () => {

  beforeEach(() => {
    const state = getFuseState();
    if (state.active) {
      try { resetFuse(true); } catch (_) {}
    }
  });

  test('正常值不触发', () => {
    expect(checkValuationBreach(0.5, 'test')).toBe(false);
    expect(isFuseActive()).toBe(false);
  });

  test('超过上界触发', () => {
    expect(checkValuationBreach(1.5, 'overflow', 0, 1)).toBe(true);
    expect(isFuseActive()).toBe(true);
  });

  test('低于下界触发', () => {
    checkValuationBreach(-0.5, 'underflow', 0, 1);
    expect(isFuseActive()).toBe(true);
  });

  test('超过熔断红线 0.68 触发', () => {
    // 需要先重置
    try { resetFuse(true); } catch (_) {}
    expect(checkValuationBreach(0.75, 'redline', 0, 1, 0.68)).toBe(true);
    expect(isFuseActive()).toBe(true);
  });

  test('NaN 值触发', () => {
    try { resetFuse(true); } catch (_) {}
    expect(checkValuationBreach(NaN, 'nan_test')).toBe(true);
  });

  test('非数字类型触发', () => {
    try { resetFuse(true); } catch (_) {}
    expect(checkValuationBreach('abc', 'string_test')).toBe(true);
  });
});

// ============================================================
// L2 连续失败 bumpEngineFail
// ============================================================
describe('bumpEngineFail - L2 连续失败计数', () => {

  beforeEach(() => {
    const state = getFuseState();
    if (state.active) {
      try { resetFuse(true); } catch (_) {}
    }
  });

  test('单次失败不触发熔断', () => {
    bumpEngineFail('test_engine', true);
    expect(isFuseActive()).toBe(false);
  });

  test('连续失败 3 次触发 L2 熔断', () => {
    bumpEngineFail('crash_engine', true);
    bumpEngineFail('crash_engine', true);
    bumpEngineFail('crash_engine', true);
    expect(isFuseActive()).toBe(true);
    expect(getFuseState().triggeredLayer.id).toBe('SYSTEM_CRASH');
  });

  test('成功一次清零计数', () => {
    bumpEngineFail('recovery_engine', true);
    bumpEngineFail('recovery_engine', true);
    bumpEngineFail('recovery_engine', false); // 成功 → 清零
    bumpEngineFail('recovery_engine', true);
    expect(isFuseActive()).toBe(false); // 只失败了1次
  });

  test('不同引擎独立计数', () => {
    bumpEngineFail('engine_A', true);
    bumpEngineFail('engine_A', true);
    bumpEngineFail('engine_B', true); // 不同引擎
    expect(isFuseActive()).toBe(false); // engine_A 只有2次
  });
});

// ============================================================
// L4 最大回撤 checkMaxDrawdown
// ============================================================
describe('checkMaxDrawdown - L4 最大回撤', () => {

  beforeEach(() => {
    const state = getFuseState();
    if (state.active) {
      try { resetFuse(true); } catch (_) {}
    }
  });

  test('正常表现不触发', () => {
    checkMaxDrawdown(0.9);
    expect(isFuseActive()).toBe(false);
  });

  test('从峰值回撤超过 20% 触发', () => {
    checkMaxDrawdown(1.0); // 设峰值
    checkMaxDrawdown(0.75); // 25% 回撤
    expect(isFuseActive()).toBe(true);
    expect(getFuseState().triggeredLayer.id).toBe('MAX_DRAWDOWN');
  });

  test('回撤未超过阈值不触发', () => {
    checkMaxDrawdown(1.0); // 确立峰值
    checkMaxDrawdown(0.85); // 15% 回撤 < 20%
    expect(isFuseActive()).toBe(false);
  });
});

// ============================================================
// L5 情绪倾斜 checkEmotionTilt
// ============================================================
describe('checkEmotionTilt - L5 情绪倾斜', () => {

  beforeEach(() => {
    const state = getFuseState();
    if (state.active) {
      try { resetFuse(true); } catch (_) {}
    }
  });

  test('正常情绪不触发', () => {
    checkEmotionTilt(50, 50, 20);
    expect(isFuseActive()).toBe(false);
  });

  test('轻微偏离不触发', () => {
    checkEmotionTilt(65, 50, 20); // 偏离15 < 20
    expect(isFuseActive()).toBe(false);
  });

  test('大幅偏离但在容忍时间内不触发', () => {
    checkEmotionTilt(90, 50, 20); // 偏离40 > 20
    // 但只调用一次，时间不够
    expect(isFuseActive()).toBe(false);
  });
});

// ============================================================
// L1 黑天鹅 checkBlackSwan
// ============================================================
describe('checkBlackSwan - L1 黑天鹅判定', () => {

  beforeEach(() => {
    const state = getFuseState();
    if (state.active) {
      try { resetFuse(true); } catch (_) {}
    }
  });

  test('样本不足不触发', () => {
    expect(checkBlackSwan([0.5, 0.5], 0.9)).toBe(false);
  });

  test('正常波动不触发', () => {
    const samples = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5];
    // 0.52 在均值附近，不触发
    expect(checkBlackSwan(samples, 0.52)).toBe(false);
  });

  test('极端值触发（σ > 3）', () => {
    const samples = [0.5, 0.51, 0.49, 0.50, 0.51, 0.49, 0.50, 0.50];
    // 当前值极端偏离
    expect(checkBlackSwan(samples, 5.0)).toBe(true);
    expect(isFuseActive()).toBe(true);
  });

  test('σ=0 时不触发（避免除零）', () => {
    const samples = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    expect(checkBlackSwan(samples, 0.5)).toBe(false);
  });
});

// ============================================================
// L6 手动停机 emergencyStop
// ============================================================
describe('emergencyStop - L6 手动停机', () => {

  beforeEach(() => {
    const state = getFuseState();
    if (state.active) {
      try { resetFuse(true); } catch (_) {}
    }
  });

  test('调用后立即激活熔断', () => {
    emergencyStop('test_user');
    expect(isFuseActive()).toBe(true);
    expect(getFuseState().triggeredLayer.id).toBe('MANUAL_STOP');
  });

  test('记录操作者信息', () => {
    emergencyStop('admin');
    const state = getFuseState();
    expect(state.triggerContext.operator).toBe('admin');
  });

  test('L6 可直接 reset 解除', () => {
    emergencyStop('user');
    resetFuse();
    expect(isFuseActive()).toBe(false);
  });
});

// ============================================================
// L7 自定义规则 triggerCustomFuse
// ============================================================
describe('triggerCustomFuse - L7 业务自定义', () => {

  beforeEach(() => {
    const state = getFuseState();
    if (state.active) {
      try { resetFuse(true); } catch (_) {}
    }
  });

  test('自定义规则触发', () => {
    triggerCustomFuse('weekly_limit', '周交易次数超限');
    expect(isFuseActive()).toBe(true);
    expect(getFuseState().triggeredLayer.id).toBe('CUSTOM_RULE');
  });

  test('自定义规则上下文包含 ruleName', () => {
    triggerCustomFuse('my_rule', 'test');
    expect(getFuseState().triggerContext.ruleName).toBe('my_rule');
  });
});
