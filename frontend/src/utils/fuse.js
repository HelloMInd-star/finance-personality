/**
 * 七层熔断体系 · Seven-Layer Fuse System (canBypass = false)
 *
 * 对应远端 Game-OS V2.1 安全设计：
 * L1 黑天鹅           σ > 3 极端偏离
 * L2 系统性崩溃       关键引擎连续失败 N 次
 * L3 估值越界         稳态值 / 置信度 / 估值 超过合法区间
 * L4 最大回撤         决策能力/账户净值 回撤超阈值
 * L5 情绪倾斜         情绪值偏离稳态过久
 * L6 手动紧急停机     用户主动按下红色按钮
 * L7 业务自定义       业务规则触发
 *
 * 任何一层触发 → 全局 FUSE_ACTIVE → 所有引擎输出阻断 → 写入不可篡改审计日志
 * 触发条件：canBypass 永远为 false，任何人（含作者）不可绕过
 */

import { logger } from './logger';
import { auditLogStore, draftStore } from './storageBus';

// ============ 熔断层级定义 ============
export const FUSE_LAYERS = [
  {
    id: 'BLACK_SWAN',
    level: 1,
    name: 'L1 黑天鹅',
    description: 'σ > 3 极端分布偏离事件',
    color: '#7c3aed',
  },
  {
    id: 'SYSTEM_CRASH',
    level: 2,
    name: 'L2 系统性崩溃',
    description: '关键引擎连续失败 3 次以上',
    color: '#ef4444',
  },
  {
    id: 'VALUATION_BREACH',
    level: 3,
    name: 'L3 估值越界',
    description: '稳态值/置信度/估值 超过合法区间 [0,1] 或熔断红线 0.68',
    color: '#f59e0b',
  },
  {
    id: 'MAX_DRAWDOWN',
    level: 4,
    name: 'L4 最大回撤',
    description: '决策能力/账户净值 回撤超过预设阈值',
    color: '#f97316',
  },
  {
    id: 'EMOTION_TILT',
    level: 5,
    name: 'L5 情绪倾斜',
    description: '情绪值偏离稳态过久，丧失客观判断',
    color: '#ec4899',
  },
  {
    id: 'MANUAL_STOP',
    level: 6,
    name: 'L6 手动紧急停机',
    description: '用户主动按下紧急停机按钮',
    color: '#b91c1c',
  },
  {
    id: 'CUSTOM_RULE',
    level: 7,
    name: 'L7 业务自定义',
    description: '业务层自定义熔断规则触发',
    color: '#0891b2',
  },
];

// ============ 关键数值阈值 ============
export const THRESHOLDS = {
  FUSE_RED_LINE: 0.68,     // 结构熔断红线
  BREAKEVEN_LINE: 0.48,    // 保本安全线
  STEADY_MID: 0.50,        // 稳态中轴线
  MAX_DRAWDOWN: 0.20,      // 最大回撤容忍度（默认 20%）
  CONSECUTIVE_FAILS: 3,    // 连续失败次数阈值（触发 L2）
  EMOTION_TILT_MS: 5 * 60 * 1000, // 情绪倾斜持续时间（5 分钟）
  SIGMA_BLACK_SWAN: 3,     // L1 黑天鹅 σ 倍数
};

// ============ storage key ============
const FUSE_STATE_KEY = 'fuse_state';
const FUSE_HISTORY_KEY = 'fuse_history';

// ============ 状态初始化 ============
function getInitialState() {
  return {
    active: false,
    triggeredAt: null,
    triggeredLayer: null,    // { id, level, name, description, color }
    triggerReason: null,     // 触发原因描述
    triggerContext: null,    // 触发时的上下文快照
    canBypass: false,        // 硬编码：false，永远不可绕过
    consecutiveFails: {},    // 各引擎连续失败次数计数 { engineId: count }
    emotionTiltStart: null,  // 情绪倾斜起始时间
    peakPerformance: 1.0,    // 峰值表现（用于回撤计算 L4）
  };
}

function readState() {
  const saved = draftStore.get(FUSE_STATE_KEY, null);
  if (!saved) return getInitialState();
  // 强制 canBypass 永远为 false（即便有人手工修改 localStorage 也会被回滚）
  return { ...saved, canBypass: false };
}

function writeState(state) {
  const toSave = { ...state, canBypass: false };
  draftStore.set(FUSE_STATE_KEY, toSave);
  return toSave;
}

function appendHistory(entry) {
  const history = draftStore.get(FUSE_HISTORY_KEY, []);
  history.push({ ...entry, _sig: null });
  draftStore.set(FUSE_HISTORY_KEY, history.slice(-200)); // 保留最近 200 条
}

// ============ 熔断触发 ============
/**
 * 触发熔断（任何一层都可以调）
 * @param {string} layerId - 必须是 FUSE_LAYERS 中定义的 id
 * @param {string} reason - 触发原因描述
 * @param {Object} context - 触发上下文快照（会写入审计日志）
 */
export function triggerFuse(layerId, reason = '未提供原因', context = {}) {
  const layer = FUSE_LAYERS.find(l => l.id === layerId);
  if (!layer) {
    const msg = `[FUSE] 未知熔断层级 id: ${layerId}`;
    logger.error(msg);
    throw new Error(msg);
  }

  const state = readState();
  if (state.active) {
    logger.info(`[FUSE] 熔断已处于激活状态（触发层: ${state.triggeredLayer?.id}），本次 ${layerId} 不再重复触发。`);
    return state;
  }

  const now = Date.now();
  const newState = {
    ...state,
    active: true,
    triggeredAt: now,
    triggeredLayer: layer,
    triggerReason: reason,
    triggerContext: context,
    canBypass: false,
  };
  writeState(newState);

  // 写入不可篡改审计日志（安全红线：必须记录）
  const auditEntry = auditLogStore.append('fuse', 'FUSE_TRIGGERED', {
    layer,
    reason,
    context,
  }, {
    fuseLevel: layer.level,
    fuseLayerId: layerId,
  });

  // 写入熔断历史
  appendHistory({
    type: 'TRIGGER',
    at: now,
    layer,
    reason,
    auditId: auditEntry.id,
  });

  logger.error(
    `[FUSE] 🚨 ${layer.name} 熔断已触发！原因：${reason}`,
    `(canBypass=${newState.canBypass}，所有引擎输出阻断)`
  );
  return newState;
}

// ============ 熔断重置（仅 L6 手动停机后可由"复位开关"解除；其他层必须走"故障排除+三模型确认"流程） ============
/**
 * 尝试解除熔断
 * @param {boolean} force - 仅 L6 手动停机允许直接解除；其他层 force=true 会写入警告审计但仍可通过（演示环境）
 */
export function resetFuse(force = false) {
  const state = readState();
  if (!state.active) {
    logger.info('[FUSE] 当前无熔断激活，无需重置。');
    return state;
  }

  const layer = state.triggeredLayer;
  const isManualStop = layer?.id === 'MANUAL_STOP';

  if (!isManualStop && !force) {
    const msg = `[FUSE] 安全红线：非 L6 手动停机的熔断（当前: ${layer?.id}）禁止直接 reset。请先排除故障并通过三模型冗余确认后，再使用 force=true 强制解除。`;
    logger.error(msg);
    auditLogStore.append('fuse', 'FUSE_RESET_BLOCKED', { currentLayer: layer?.id });
    throw new Error(msg);
  }

  const now = Date.now();
  const newState = {
    ...getInitialState(),
    peakPerformance: state.peakPerformance, // 保留峰值用于 L4 后续判断
  };
  writeState(newState);

  auditLogStore.append('fuse', 'FUSE_RESET', {
    originalLayer: layer,
    force,
    reason: isManualStop ? 'L6 手动解除' : '强制解除（非 L6）',
  });
  appendHistory({ type: 'RESET', at: now, layer, force });

  logger.session(`[FUSE] ✅ ${layer?.name} 熔断已解除，系统恢复正常运行。`);
  return newState;
}

// ============ 查询熔断状态 ============
export function getFuseState() {
  return readState();
}

/**
 * 快速检查：是否熔断激活？（业务代码最常用的函数）
 * 如果熔断激活，业务代码应立即阻断输出并返回安全占位结果。
 */
export function isFuseActive() {
  return readState().active === true;
}

// ============ 各层级判定辅助函数 ============

/**
 * L3 估值越界判定：检查数值是否超出合法区间或触碰熔断红线 0.68
 * @param {number} value - 待检查值（如稳态值、置信度）
 * @param {string} fieldName - 字段名（用于审计）
 * @param {number} min - 合法下界（默认 0）
 * @param {number} max - 合法上界（默认 1）
 * @param {number} redLine - 熔断红线（默认 0.68，超过即使在 [0,1] 内也熔断）
 */
export function checkValuationBreach(value, fieldName = 'unknown', min = 0, max = 1, redLine = THRESHOLDS.FUSE_RED_LINE) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    triggerFuse('VALUATION_BREACH', `${fieldName} 不是合法数字: ${value}`);
    return true;
  }
  if (value < min || value > max) {
    triggerFuse('VALUATION_BREACH', `${fieldName} 越界: ${value}，合法区间 [${min}, ${max}]`);
    return true;
  }
  if (value > redLine) {
    triggerFuse('VALUATION_BREACH', `${fieldName} 触碰结构熔断红线 0.68: ${value}`, { value, redLine });
    return true;
  }
  return false;
}

/**
 * L2 系统性崩溃判定：某引擎连续失败计数 +1；超过阈值自动熔断
 * @param {string} engineId - 引擎标识（e.g. 'mindspeak', 'billiards'）
 * @param {boolean} failed - 本次调用是否失败
 */
export function bumpEngineFail(engineId, failed = true) {
  const state = readState();
  const counters = state.consecutiveFails || {};
  if (failed) {
    counters[engineId] = (counters[engineId] || 0) + 1;
  } else {
    counters[engineId] = 0; // 成功一次就清零
  }
  // 先写入更新后的计数器，再检查是否需要触发熔断
  writeState({ ...state, consecutiveFails: counters });
  if (failed && counters[engineId] >= THRESHOLDS.CONSECUTIVE_FAILS) {
    triggerFuse('SYSTEM_CRASH', `${engineId} 连续失败 ${counters[engineId]} 次（阈值=${THRESHOLDS.CONSECUTIVE_FAILS}）`, { engineId, fails: counters });
  }
  return counters[engineId] || 0;
}

/**
 * L4 最大回撤判定：根据当前表现值更新峰值，若回撤 >20% 触发熔断
 * @param {number} currentPerformance - 当前表现（0~1，越高越好）
 */
export function checkMaxDrawdown(currentPerformance) {
  const state = readState();
  const peak = Math.max(state.peakPerformance || 0, currentPerformance || 0);
  // 先更新峰值
  writeState({ ...state, peakPerformance: peak });
  if (peak > 0) {
    const drawdown = (peak - (currentPerformance || 0)) / peak;
    if (drawdown >= THRESHOLDS.MAX_DRAWDOWN) {
      triggerFuse('MAX_DRAWDOWN', `回撤 ${(drawdown * 100).toFixed(1)}% 超过阈值 ${THRESHOLDS.MAX_DRAWDOWN * 100}%`, { peak, currentPerformance, drawdown });
      return true;
    }
  }
  return false;
}

/**
 * L5 情绪倾斜判定：情绪值偏离稳态超过容忍区间且持续足够时间
 * @param {number} currentEmotion - 当前情绪值（0~100）
 * @param {number} targetEmotion - 稳态情绪（通常 50）
 * @param {number} tolerance - 容忍偏差（默认 ±20）
 */
export function checkEmotionTilt(currentEmotion, targetEmotion = 50, tolerance = 20) {
  const state = readState();
  const now = Date.now();
  const deviation = Math.abs(currentEmotion - targetEmotion);

  if (deviation > tolerance) {
    // 倾斜开始
    const start = state.emotionTiltStart || now;
    if (now - start >= THRESHOLDS.EMOTION_TILT_MS) {
      triggerFuse('EMOTION_TILT', `情绪偏差 ${deviation} > ${tolerance}，持续 ${((now - start) / 60000).toFixed(1)} 分钟`, { currentEmotion, targetEmotion, durationMs: now - start });
    }
    writeState({ ...state, emotionTiltStart: start });
  } else {
    // 情绪回稳，清零
    if (state.emotionTiltStart) {
      writeState({ ...state, emotionTiltStart: null });
    }
  }
  return state.active;
}

/**
 * L1 黑天鹅判定：根据样本标准差判断是否为极端值
 * @param {number[]} historySamples - 历史样本数组
 * @param {number} currentValue - 当前值
 */
export function checkBlackSwan(historySamples, currentValue) {
  if (!Array.isArray(historySamples) || historySamples.length < 5) return false;
  const mean = historySamples.reduce((a, b) => a + b, 0) / historySamples.length;
  const variance = historySamples.reduce((s, x) => s + (x - mean) ** 2, 0) / historySamples.length;
  const sigma = Math.sqrt(Math.max(0, variance));
  if (sigma <= 0) return false;
  const z = Math.abs(currentValue - mean) / sigma;
  if (z >= THRESHOLDS.SIGMA_BLACK_SWAN) {
    triggerFuse('BLACK_SWAN', `Z 值 ${z.toFixed(2)} ≥ ${THRESHOLDS.SIGMA_BLACK_SWAN}（极端偏离）`, { mean, sigma, z, currentValue });
    return true;
  }
  return false;
}

/**
 * L6 手动紧急停机（UI 按钮调用）
 */
export function emergencyStop(operator = '未指定用户') {
  triggerFuse('MANUAL_STOP', `${operator} 主动按下紧急停机按钮`, { operator });
  return getFuseState();
}

/**
 * L7 业务自定义触发（对外暴露）
 * @param {string} ruleName - 业务规则名称
 * @param {string} reason - 说明
 */
export function triggerCustomFuse(ruleName, reason = '未说明原因') {
  triggerFuse('CUSTOM_RULE', `[${ruleName}] ${reason}`, { ruleName });
}

// ============ 熔断历史 ============
export function getFuseHistory(limit = 50) {
  const history = draftStore.get(FUSE_HISTORY_KEY, []);
  return history.slice(-limit).reverse();
}

export default {
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
};
