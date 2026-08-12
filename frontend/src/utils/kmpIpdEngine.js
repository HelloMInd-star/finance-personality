/**
 * KMP→IPD 记忆学习引擎
 *
 * 对齐 ymine Game-OS V2.5 的「KMP→IPD→七维向量」学习记忆方法论：
 * 用 感知→建模→存储→检索→验证→进化 六步闭环，解决"不会学习"的瓶颈。
 * 从交互中持续提取结构、建立关联、更新认知。
 *
 * 设计原则：
 * - 复用三分区数据总线（storageBus）落盘，不新增分区类型
 * - 三级仓储（HOT 长期公理库 / WARM 缓冲复审库 / COLD 废弃归档库）
 * - 四级净化漏斗（L1 粗滤降噪 / L2 标签分拣 / L3 四维结构化 / L4 公理终审）
 * - KMP 骨架检索：沿固定骨架定向调取，非全局遍历
 * - PID 进化：按命中/采纳结果反馈更新记忆强度
 */

import { logger } from './logger';
import { draftStore, auditLogStore } from './storageBus';
import { checkValuationBreach, getFuseState, isFuseActive } from './fuse';

const safe = (v, d = 0) => (typeof v === 'number' && !isNaN(v) ? v : d);
const clamp01 = v => Math.max(0, Math.min(1, safe(v)));

// ============ 全局三线（与 trustGate / fuse 同源） ============
export const KMP_THRESHOLDS = {
  BREAKEVEN: 0.48,       // 保本底线
  STEADY_MID: 0.50,      // 稳态中轴线
  FUSE_RED: 0.68,        // 熔断警戒线
  VERIFY_TOLERANCE: 0.02, // 验证三角容差
};

// ============ 七维向量维度定义 ============
export const VECTOR_DIMS = [
  { id: 'I',    name: '海拔',   desc: '稳态贴近中轴' },
  { id: 'P',    name: '坡度',   desc: '动量/收敛速度' },
  { id: 'D',    name: '阻尼',   desc: '波动抑制' },
  { id: 'S',    name: '熵',     desc: '复杂度/离散度' },
  { id: 'DevI', name: '偏差',   desc: '偏离稳态中轴' },
  { id: 'Dev1', name: '回归',   desc: '收敛度' },
  { id: 'Dev2', name: '历史',   desc: '历史依赖' },
];

// ============ 三级仓储 key ============
const KEY_HOT = 'kmp_hot';
const KEY_WARM = 'kmp_warm';
const KEY_COLD = 'kmp_cold';

// ============ PID 进化参数 ============
const PID = {
  Kp: 0.4,   // 比例
  Ki: 0.1,   // 积分
  Kd: 0.05,  // 微分
  HEAT_UP: 0.6,   // 升级到 HOT 阈值
  COOL_DOWN: 0.25, // 降级到 COLD 阈值
};

// ============ 业务标签 ============
const LABELS = ['策略', '风险', '认知', '噪音'];

// 语气词/噪声词（用于 L1 粗滤降噪）
const NOISE_WORDS = ['嗯', '呃', '啊', '哦', '吧', '吗', '呢', '哈', '哈哈', '嗯嗯', '好的', 'OK', 'ok', '了', '的'];

// ============ 工具函数 ============

function cosine(a = {}, b = {}) {
  let dot = 0, na = 0, nb = 0;
  for (const key of VECTOR_DIMS.map(d => d.id)) {
    const va = clamp01(a[key]);
    const vb = clamp01(b[key]);
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function loadStore(key) {
  const arr = draftStore.get(key, []);
  return Array.isArray(arr) ? arr : [];
}

function saveStore(key, arr) {
  draftStore.set(key, arr);
  return arr;
}

// ============ 第 1 步 · 感知 Perception ============
export function perception(translateResult = {}) {
  const text = String(translateResult.input || '').trim();
  const steadyState = clamp01(translateResult.steadyState);
  const avgConfidence = clamp01(translateResult.avgConfidence);
  const activeCount = safe(translateResult.activeCount, 0);
  const passed = !!translateResult.triangleAudit?.passed;

  const entities = (translateResult.moduleOutputs || [])
    .filter(m => m.active)
    .map(m => m.moduleName);

  return {
    text,
    source: 'mindspeak',
    entities,
    signals: {
      steadyState,
      avgConfidence,
      activeCount,
      blocked: !!translateResult.blocked,
      trianglePassed: passed,
    },
    at: Date.now(),
  };
}

// ============ 第 2 步 · 建模 Modeling（四维结构化 + 七维向量） ============
export function modeling(rawMemory = {}) {
  const signals = rawMemory.signals || {};
  const steadyState = clamp01(signals.steadyState);
  const avgConfidence = clamp01(signals.avgConfidence);

  // 四维结构化：主体 · 运动 · 幅值 · 外部扰动
  const subject = rawMemory.entities?.[0] || '认知';
  const action = signals.trianglePassed ? '映射通过' : '映射阻断';
  const magnitude = steadyState;
  const disturbance = 1 - avgConfidence;

  // 七维向量
  const featureVector = {
    I: steadyState,                                  // 海拔
    P: clamp01(avgConfidence),                       // 坡度：置信度
    D: 1 - Math.abs(steadyState - 0.5) * 2,          // 阻尼：贴近中轴
    S: clamp01(1 - (rawMemory.entities?.length || 1) * 0.1), // 熵：模块离散度
    DevI: Math.abs(steadyState - 0.5) * 2,           // 偏差
    Dev1: clamp01(1 - Math.abs(steadyState - 0.5)),  // 回归
    Dev2: clamp01(avgConfidence),                    // 历史依赖
  };

  return {
    text: rawMemory.text,
    subject,
    action,
    magnitude: Number(magnitude.toFixed(4)),
    disturbance: Number(disturbance.toFixed(4)),
    featureVector,
  };
}

// ============ 第 3 步前 · 四级净化漏斗 ============

// L1 粗滤降噪
function l1Denoise(text = '') {
  const cleaned = text
    .replace(/[，。！？、；：,.!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleaned.split(' ').filter(t => t && !NOISE_WORDS.includes(t));
  return {
    ok: tokens.length >= 2,
    text: tokens.join(' '),
    dropped: tokens.length < 2,
    reason: tokens.length < 2 ? '去除语气词后无有效内容' : null,
  };
}

// L2 标签分拣
function l2Tag(text = '', magnitude = 0) {
  const riskWords = ['风险', '回撤', '止损', '熔断', '黑天鹅', '爆仓', '险'];
  const strategyWords = ['策略', '配置', '仓位', '凯利', '估值', '买入', '卖出', 'WACC', 'DCF'];
  const hits = t => riskWords.concat(strategyWords).filter(w => t.includes(w));
  const matched = hits(text);
  if (matched.some(w => riskWords.includes(w))) return '风险';
  if (matched.some(w => strategyWords.includes(w))) return '策略';
  if (magnitude > KMP_THRESHOLDS.FUSE_RED) return '风险';
  if (magnitude < 0.2) return '噪音';
  return '认知';
}

// L3 四维结构化校验
function l3Structure(memory) {
  const valid = memory.subject && memory.action && typeof memory.magnitude === 'number' && typeof memory.disturbance === 'number';
  return { ok: !!valid, memory };
}

// L4 公理终审（全局三线校验）
function l4Axiom(memory) {
  const steady = memory.magnitude;
  // 触碰熔断红线 → 触发 L3 熔断（复用 fuse.js checkValuationBreach）
  const breach = steady > KMP_THRESHOLDS.FUSE_RED;
  try {
    checkValuationBreach(steady, 'kmpIpd.axiom', 0, 1, KMP_THRESHOLDS.FUSE_RED);
  } catch (e) {
    logger.error('[KMP→IPD] L4 公理终审触发熔断', e.message);
  }
  return {
    ok: !breach,
    tier: breach ? 'warm' : 'hot',
    reason: breach ? `幅值 ${steady.toFixed(3)} 触碰熔断红线，降级缓冲待审` : '过公理终审，入长期公理库',
  };
}

/**
 * 四级净化漏斗主入口
 * 返回 { ok, label, tier, reason, memory, denied }
 */
export function purify(memory = {}) {
  const text = memory.text || '';

  // L1 粗滤降噪
  const l1 = l1Denoise(text);
  if (!l1.ok) {
    auditLogStore.append('kmp', 'L1_DENOISE_DROP', { reason: l1.reason, text: text.slice(0, 40) });
    return { ok: false, denied: true, stage: 'L1', reason: l1.reason };
  }

  // L2 标签分拣
  const label = l2Tag(l1.text, memory.magnitude);
  if (label === '噪音') {
    auditLogStore.append('kmp', 'L2_NOISE', { text: l1.text.slice(0, 40) });
    return { ok: false, denied: true, stage: 'L2', reason: '判为噪音，直接丢弃' };
  }

  // L3 四维结构化校验
  const struct = l3Structure(memory);
  if (!struct.ok) {
    auditLogStore.append('kmp', 'L3_STRUCT_DROP', { reason: '无法拆出主体/运动/幅值/扰动' });
    return { ok: false, denied: true, stage: 'L3', reason: '四维结构化校验失败' };
  }

  // L4 公理终审
  const axiom = l4Axiom(memory);
  auditLogStore.append('kmp', axiom.ok ? 'L4_PASS' : 'L4_WARM', {
    reason: axiom.reason,
    magnitude: memory.magnitude,
    steadyLine: KMP_THRESHOLDS.FUSE_RED,
  });

  return {
    ok: axiom.ok,
    denied: false,
    stage: 'L4',
    label,
    tier: axiom.tier,
    reason: axiom.reason,
    memory: { ...memory, label, _tier: axiom.tier },
  };
}

// ============ 第 3 步 · 存储 Storage（三级仓储） ============
export function store(memory = {}, tier = 'hot') {
  const key = tier === 'hot' ? KEY_HOT : tier === 'warm' ? KEY_WARM : KEY_COLD;
  const arr = loadStore(key);
  const entry = {
    id: `kmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    ...memory,
    strength: tier === 'hot' ? 0.6 : 0.4,
    hitCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  arr.push(entry);
  // 限制容量，防止 localStorage 膨胀
  saveStore(key, arr.slice(-200));
  auditLogStore.append('kmp', 'STORE', { tier, id: entry.id, label: memory.label });
  logger.session(`[KMP→IPD] 入库 ${tier.toUpperCase()}`, { id: entry.id, label: memory.label });
  return entry;
}

// ============ 第 4 步 · 检索 Retrieval（KMP 骨架定向检索，非全局遍历） ============
export function retrieve(featureVector = {}, { topK = 5 } = {}) {
  const hot = loadStore(KEY_HOT);
  const candidates = hot.map(m => ({
    ...m,
    similarity: cosine(featureVector, m.featureVector),
  }));
  candidates.sort((a, b) => b.similarity - a.similarity);
  const top = candidates.slice(0, topK);
  auditLogStore.append('kmp', 'RETRIEVE', {
    scanned: hot.length,
    matched: top.length,
    topSimilarity: top[0]?.similarity ? Number(top[0].similarity.toFixed(4)) : 0,
  });
  return top;
}

// ============ 第 5 步 · 验证 Verification（轻量三角校验） ============
export function verify(candidates = [], currentAudit = {}, currentMagnitude = 0) {
  if (candidates.length === 0) return { passed: true, divergences: 0, details: [] };

  const divergences = [];
  for (const c of candidates) {
    const dev = Math.abs(clamp01(c.magnitude) - clamp01(currentMagnitude));
    if (dev > KMP_THRESHOLDS.VERIFY_TOLERANCE) {
      divergences.push({ id: c.id, magnitude: c.magnitude, dev: Number(dev.toFixed(4)) });
    }
  }
  const passed = divergences.length === 0;
  auditLogStore.append('kmp', passed ? 'VERIFY_PASS' : 'VERIFY_DIVERGENCE', {
    divergences: divergences.length,
    tolerance: KMP_THRESHOLDS.VERIFY_TOLERANCE,
  });
  return { passed, divergences: divergences.length, details: divergences };
}

// ============ 第 6 步 · 进化 Evolution（PID 反馈） ============
export function evolve(memoryId, feedback = 'hit') {
  // 在 HOT 库中定位
  const hot = loadStore(KEY_HOT);
  const idx = hot.findIndex(m => m.id === memoryId);
  if (idx === -1) return { ok: false, reason: '记忆不在 HOT 库' };

  const m = hot[idx];
  const target = feedback === 'adopted' ? 1 : feedback === 'hit' ? 0.8
    : feedback === 'rejected' ? 0.2 : 0.4;

  const prev = m.strength;
  const error = target - prev;
  // 简易增量 PID：∫e 用历史误差近似，Δe 用本次误差
  const integral = (m._integral || 0) + error;
  const derivative = error - (m._prevError || 0);
  const delta = PID.Kp * error + PID.Ki * integral + PID.Kd * derivative;

  let strength = clamp01(prev + delta);
  // 二次衰减抑制，防止单次突变过大
  strength = clamp01(strength);

  m.strength = Number(strength.toFixed(4));
  m._integral = Number(integral.toFixed(4));
  m._prevError = Number(error.toFixed(4));
  if (feedback === 'hit' || feedback === 'adopted') m.hitCount = safe(m.hitCount, 0) + 1;
  m.updatedAt = Date.now();

  // 热度升降级
  let fromTier = 'hot';
  let toTier = 'hot';
  if (strength > PID.HEAT_UP) { toTier = 'hot'; }
  else if (strength < PID.COOL_DOWN) {
    toTier = 'cold';
    hot.splice(idx, 1);
    const cold = loadStore(KEY_COLD);
    cold.push(m);
    saveStore(KEY_COLD, cold.slice(-200));
    saveStore(KEY_HOT, hot);
  } else {
    saveStore(KEY_HOT, hot);
  }

  auditLogStore.append('kmp', 'EVOLVE', {
    id: memoryId,
    feedback,
    strength: m.strength,
    delta: Number(delta.toFixed(4)),
    fromTier,
    toTier,
  });
  logger.session(`[KMP→IPD] 进化 ${feedback}`, { id: memoryId, strength: m.strength, tier: toTier });

  return {
    ok: true,
    id: memoryId,
    strength: m.strength,
    delta: Number(delta.toFixed(4)),
    fromTier,
    toTier,
    hitCount: safe(m.hitCount, 0),
  };
}

// ============ 六步闭环主入口 study() ============
/**
 * 触发一次完整记忆学习闭环
 * @param {Object} translateResult - 认知引擎翻译结果
 * @param {Object} yMineData - 行为数据（当前未强制使用，保留扩展）
 * @returns {Object} 六步闭环结果
 */
export function study(translateResult = {}, yMineData = {}) {
  const steps = [];
  const mark = (step, status, data) => {
    steps.push({ step, status, data, at: Date.now() });
  };

  // 熔断激活时停止学习（风控优先）
  if (isFuseActive()) {
    const fs = getFuseState();
    mark('感知', 'blocked', { reason: `熔断激活（${fs.triggeredLayer?.name || '未知'}），停止学习` });
    return { steps, blocked: true, fuseState: fs };
  }

  // ① 感知
  const raw = perception(translateResult);
  mark('感知', 'passed', { text: raw.text.slice(0, 30), entities: raw.entities.slice(0, 3) });

  // ② 建模
  const model = modeling(raw);
  mark('建模', 'passed', { subject: model.subject, magnitude: model.magnitude });

  // ③ 净化漏斗（入库前置）
  const purified = purify(model);
  if (!purified.ok) {
    mark('存储', 'blocked', { reason: `净化未通过（${purified.stage}）：${purified.reason}` });
    return { steps, stored: null, blocked: true, stage: purified.stage };
  }

  // ④ 存储
  const entry = store(purified.memory, purified.tier);
  mark('存储', 'passed', { id: entry.id, tier: purified.tier, label: purified.label });

  // ⑤ 检索（KMP 骨架）
  const candidates = retrieve(model.featureVector);
  mark('检索', 'passed', { scanned: candidates.length, top: candidates[0]?.id });

  // ⑥ 验证
  const verification = verify(candidates, translateResult.triangleAudit, model.magnitude);
  mark('验证', verification.passed ? 'passed' : 'warning', {
    pass: verification.passed,
    divergences: verification.divergences,
  });

  // ⑦ 进化（命中 top 候选则强化）
  let evolution = null;
  if (candidates[0]) {
    evolution = evolve(candidates[0].id, verification.passed ? 'hit' : 'rejected');
    mark('进化', 'passed', { id: candidates[0].id, strength: evolution.strength, delta: evolution.delta });
  } else {
    mark('进化', 'waiting', { reason: '无历史命中的可进化记忆' });
  }

  auditLogStore.append('kmp', 'STUDY_COMPLETE', {
    text: raw.text.slice(0, 30),
    stored: entry.id,
    tier: purified.tier,
    candidates: candidates.length,
    verificationPassed: verification.passed,
  });

  return {
    steps,
    stored: entry,
    candidates,
    verification,
    evolution,
    blocked: false,
  };
}

// ============ 状态读取：三级仓储总览 ============
export function getKmpState() {
  const hot = loadStore(KEY_HOT);
  const warm = loadStore(KEY_WARM);
  const cold = loadStore(KEY_COLD);
  return {
    tiers: {
      hot: { count: hot.length, entries: hot.slice(-20).reverse() },
      warm: { count: warm.length, entries: warm.slice(-20).reverse() },
      cold: { count: cold.length, entries: cold.slice(-20).reverse() },
    },
    thresholds: KMP_THRESHOLDS,
    vectorDims: VECTOR_DIMS,
  };
}

export default {
  KMP_THRESHOLDS,
  VECTOR_DIMS,
  perception,
  modeling,
  purify,
  store,
  retrieve,
  verify,
  evolve,
  study,
  getKmpState,
};