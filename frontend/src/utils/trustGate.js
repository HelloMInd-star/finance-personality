/**
 * TrustGate · 可信门控层
 *
 * 对应 ymine Game-OS 的可信决策中台设计：
 * 1) 统一阈值三线（0.48 保本 / 0.50 稳态 / 0.68 熔断）
 * 2) S0-S9 十步闭环流水线状态机
 * 3) 任一决策放行前必须过：三角审计 → 七层熔断 → 门控
 *
 * 设计原则：可信能力（熔断/审计）已存在于 fuse.js / mindspeakEngine.js，
 * 本层只做"编排收口"，不重复实现算法。
 */

import { logger } from './logger';
import {
  isFuseActive,
  getFuseState,
  THRESHOLDS,
  emergencyStop,
  resetFuse,
  triggerFuse,
  getFuseHistory,
} from './fuse';
import {
  calculateInitialSteadyState,
} from './mindspeakEngine';
import { pipelineStore, commitPipeline, draftStore, auditLogStore } from './storageBus';

const safe = (v, d = 0) => (typeof v === 'number' && !isNaN(v) ? v : d);
const clamp01 = v => Math.max(0, Math.min(1, safe(v)));

// ============ 统一阈值三线（与 fuse.THRESHOLDS 同源） ============
export const TRUST_THRESHOLDS = {
  BREAKEVEN: THRESHOLDS.BREAKEVEN_LINE, // 0.48 保本底线
  STEADY_MID: THRESHOLDS.STEADY_MID,    // 0.50 稳态中轴线
  FUSE_RED: THRESHOLDS.FUSE_RED_LINE,   // 0.68 熔断警戒线
  TRIANGLE_TOLERANCE: 0.02,             // 三角审计容差
};

// ============ S0-S9 十步闭环步骤定义 ============
export const PIPELINE_STEPS = [
  { id: 'S0', name: '宏观海选',   icon: '🌊', phase: 'auto',   desc: '外部环境/行业筛选' },
  { id: 'S1', name: '信息清洗ETL', icon: '🧹', phase: 'auto',   desc: '数据清洗与加工' },
  { id: 'S2', name: '核心定价估值', icon: '⚖️', phase: 'auto',   desc: 'DCF/相对估值' },
  { id: 'S3', name: '沙盘决策推演', icon: '🔮', phase: 'auto',   desc: '蒙特卡洛情景推演' },
  { id: 'S4', name: '动态周期观测', icon: '📈', phase: 'auto',   desc: 'K线/周期观测' },
  { id: 'S5', name: '人性偏差校验', icon: '🧠', phase: 'manual', desc: '损失厌恶/羊群校验' },
  { id: 'S6', name: '人工调参确认', icon: '🔧', phase: 'manual', desc: '人工可调参数' },
  { id: 'S7', name: '审计复核',     icon: '🔍', phase: 'manual', desc: '三角冗余审计' },
  { id: 'S8', name: '熔断风控对冲', icon: '🛡️', phase: 'manual', desc: '七层熔断门控' },
  { id: 'S9', name: '全局同步闭环', icon: '🔄', phase: 'sync',   desc: '提交pipeline+审计' },
];

// ============ 三角审计三模型 ============
export const TRIANGLE_ENGINES = [
  { id: 'CALC', name: 'CALC 金融精算', icon: '💰' },
  { id: 'GAME', name: 'GameMind 博弈', icon: '♠️' },
  { id: 'GEOM', name: 'geom-compute',  icon: '📐' },
];

// ============ 流水线状态持久化 ============
const PIPELINE_DRAFT_KEY = 'trust_pipeline_draft';
const PIPELINE_ARCHIVE_KEY = 'trust_pipeline_archive';

export function readPipelineDraft() {
  return draftStore.get(PIPELINE_DRAFT_KEY, null);
}

export function savePipelineDraft(pipeline) {
  draftStore.set(PIPELINE_DRAFT_KEY, pipeline);
  return pipeline;
}

/**
 * 金融场景三角冗余审计（STAGE-9）
 *
 * 三模型共享同一决策环境核心（稳态/胜率/波动/估值上行），仅从不同角度加权，
 * 使正常决策时三模型收敛到 ±0.02 容差内放行；输入异常（越界/零分）时阻断。
 *
 * @param {Object} d - 决策环境 { steadyState, successRate, volatility, upside, riskLevel }
 * @returns {Object} { passed, status, maxDev, tolerance, scores, labels, details }
 */
export function financeTriangleAudit(d = {}) {
  const steadyState = clamp01(d.steadyState);
  const successRate = clamp01(d.successRate);
  const volatility = clamp01(d.volatility);
  const upside = clamp01(d.upside);
  const riskLevel = clamp01(d.riskLevel);

  // 风险折扣：波动/风险越高，各模型评分越低（同向）
  const riskDiscount = 1 - volatility * 0.5 - riskLevel * 0.3;

  // CALC 金融精算：凯利式，稳态 + 风险折扣
  const calc = clamp01(0.5 + (steadyState - 0.5) * 0.8 + riskDiscount * 0.3);
  // GameMind 博弈：胜率主导 + 稳态
  const game = clamp01(0.5 + (successRate - 0.5) * 0.8 + (steadyState - 0.5) * 0.3);
  // geom-compute 几何：稳态贴近中轴 + 估值上行
  const geom = clamp01(0.5 + (1 - Math.abs(steadyState - 0.5)) * 0.4 + upside * 0.3);

  const scores = [calc, game, geom];
  const labels = ['CALC通过', 'GameMind通过', 'geom通过'];
  const details = [
    { steadyState, riskDiscount },
    { successRate, steadyState },
    { steadyMid: Math.abs(steadyState - 0.5), upside },
  ];

  const devs = [
    Math.abs(scores[0] - scores[1]),
    Math.abs(scores[1] - scores[2]),
    Math.abs(scores[0] - scores[2]),
  ];
  const maxDev = Math.max(...devs);
  const anyZero = scores.some(s => s === 0);
  const passed = maxDev <= TRUST_THRESHOLDS.TRIANGLE_TOLERANCE && !anyZero;

  return {
    passed,
    status: passed ? 'PASSED' : 'BLOCKED',
    maxDev: Number(maxDev.toFixed(4)),
    tolerance: TRUST_THRESHOLDS.TRIANGLE_TOLERANCE,
    scores: scores.map(s => Number(s.toFixed(4))),
    labels,
    details,
    step: 'STAGE-9',
    at: Date.now(),
  };
}

/**
 * 对一次决策结果执行可信门控
 * @param {Object} decision - 上游决策（含 steadyState / successRate / volatility / upside / riskLevel）
 * @param {Object} yMineData - 行为数据
 * @returns {Object} { passed, gate, blocked, reason, audit, fuseState }
 */
export function gateDecision(decision = {}, yMineData = {}) {
  const steadyState = decision.steadyState ?? calculateInitialSteadyState(yMineData);

  // ---- ① 七层熔断检查（最高优先级）----
  const fuseState = getFuseState();
  if (isFuseActive()) {
    return {
      passed: false,
      gate: 'FUSE',
      blocked: true,
      reason: `熔断已激活（${fuseState.triggeredLayer?.name || '未知层'}）：${fuseState.triggerReason || '未说明'}`,
      audit: null,
      fuseState,
    };
  }

  // ---- ② 金融三角冗余审计（STAGE-9）----
  const audit = financeTriangleAudit({
    steadyState,
    successRate: decision.successRate,
    volatility: decision.volatility,
    upside: decision.upside,
    riskLevel: decision.riskLevel,
  });

  if (!audit.passed) {
    return {
      passed: false,
      gate: 'AUDIT',
      blocked: true,
      reason: `三角审计未通过（maxDev=${audit.maxDev} > ±${TRUST_THRESHOLDS.TRIANGLE_TOLERANCE}）`,
      audit,
      fuseState,
    };
  }

  return {
    passed: true,
    gate: 'PASS',
    blocked: false,
    reason: '熔断通过 + 金融三角审计通过，放行',
    audit,
    fuseState,
  };
}

/**
 * 运行 S0-S9 流水线：将各步骤结果聚合为状态机，串联一次门控
 * @param {Object} stepResults - { S0: {...}, S1: {...}, ... } 各步执行结果
 * @param {Object} decision - 决策对象（供门控）
 * @param {Object} yMineData - 行为数据
 * @returns {Object} pipeline 状态机
 */
export function runPipeline(stepResults = {}, decision = {}, yMineData = {}) {
  const gate = gateDecision(decision, yMineData);

  const steps = PIPELINE_STEPS.map((def) => {
    const res = stepResults[def.id] || {};
    let status = 'waiting';
    if (gate.blocked) {
      // 熔断/审计阻断 → S8 之前已完成步骤标记 passed，S9 标记 blocked
      status = def.id === 'S9' ? 'blocked' : (res.ready ? 'passed' : 'waiting');
    } else {
      status = res.ready ? 'passed' : (res.running ? 'running' : 'waiting');
    }
    return {
      ...def,
      status,
      input: res.input || null,
      output: res.output || null,
      at: res.at || null,
    };
  });

  const pipeline = {
    at: Date.now(),
    steps,
    gate,
    steadyState: decision.steadyState ?? gate.fuseState?.steadyState ?? TRUST_THRESHOLDS.STEADY_MID,
    phase: gate.blocked ? 'blocked' : 'complete',
    symbol: decision.symbol || '—',
  };

  savePipelineDraft(pipeline);

  // S9 闭环出口：写审计 + 归档（仅放行时）
  auditLogStore.append('trust', gate.passed ? 'PIPELINE_PASS' : 'PIPELINE_BLOCKED', {
    gate: gate.gate,
    reason: gate.reason,
    maxDev: gate.audit?.maxDev,
    symbol: pipeline.symbol,
  });

  if (gate.passed) {
    try {
      const archive = draftStore.get(PIPELINE_ARCHIVE_KEY, []);
      archive.push(pipeline);
      draftStore.set(PIPELINE_ARCHIVE_KEY, archive.slice(-50)); // 保留最近 50 次闭环
      commitPipeline('trust', { pipeline, at: pipeline.at });
    } catch (e) {
      logger.error('[TrustGate] S9 归档失败', e);
    }
  }

  return pipeline;
}

// ============ 紧急停机 / 复位（转调 fuse） ============
export function trustEmergencyStop(operator = 'TrustDashboard') {
  return emergencyStop(operator);
}

export function trustReset(force = false) {
  return resetFuse(force);
}

export function trustTriggerFuse(layerId, reason, ctx) {
  return triggerFuse(layerId, reason, ctx);
}

export function getTrustFuseHistory(limit = 50) {
  return getFuseHistory(limit);
}

export default {
  TRUST_THRESHOLDS,
  PIPELINE_STEPS,
  TRIANGLE_ENGINES,
  gateDecision,
  financeTriangleAudit,
  runPipeline,
  readPipelineDraft,
  savePipelineDraft,
  trustEmergencyStop,
  trustReset,
  trustTriggerFuse,
  getTrustFuseHistory,
};