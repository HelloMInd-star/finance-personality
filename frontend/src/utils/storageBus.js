/**
 * 三分区数据总线 · Three-Partition Data Bus
 *
 * 对应远端 Game-OS V2.1 的命名空间规范：
 * - pipeline_* : 只读（官方流水线结果，任何业务代码禁止写入）
 * - draft_*    : 可写（用户草稿区、临时状态）
 * - audit_log_*: 仅追加不可篡改（永久审计日志，附 HMAC 防篡改签名）
 *
 * 与现有 storage.js 共享同一个 localStorage key，但通过前缀隔离命名空间。
 */

import { storage } from './storage.js';
import { logger } from './logger.js';

// ============ 命名空间前缀 ============
const PREFIX_PIPELINE = 'pipeline_';
const PREFIX_DRAFT = 'draft_';
const PREFIX_AUDIT = 'audit_log_';

// ============ HMAC 轻量签名（前端防篡改，生产环境请升级到 Web Crypto Subtle HMAC） ============
// 注意：这里的盐只是防止普通用户手工修改 localStorage，不能替代后端真正的签名验证
const HMAC_SALT = 'Y.Mine.GameOS.V2.Audit.Secret.v251';

function simpleHmac(payload) {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const data = HMAC_SALT + '::' + str + '::' + HMAC_SALT;
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  // 转换为 8 位十六进制
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return hex;
}

function verifyHmac(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const sig = entry._sig;
  if (!sig) return false;
  const clone = { ...entry };
  delete clone._sig;
  return simpleHmac(clone) === sig;
}

// ============ 1. Pipeline Store: 只读 ============
export const pipelineStore = {
  get(key) {
    const fullKey = PREFIX_PIPELINE + key;
    const value = storage.get(fullKey);
    logger.info(`[PipelineStore] GET ${key}`, value === undefined ? 'undefined' : 'OK');
    return value;
  },
  set() {
    const msg = '[PipelineStore] 写入被拒绝：pipeline 命名空间只读。请通过官方流水线生成数据后通过 commitPipeline() 写入。';
    logger.error(msg);
    throw new Error(msg);
  },
  update() {
    const msg = '[PipelineStore] 更新被拒绝：pipeline 命名空间只读。请通过官方流水线生成数据后通过 commitPipeline() 写入。';
    logger.error(msg);
    throw new Error(msg);
  },
};

/**
 * 仅允许官方流水线调用的写入入口（带签名）
 * @param {string} key - pipeline 子键
 * @param {any} value - 要写入的值
 * @param {string} producerToken - 流水线生产令牌（演示版固定值 'S0-S9-OFFICIAL'）
 */
export function commitPipeline(key, value, producerToken = 'S0-S9-OFFICIAL') {
  if (producerToken !== 'S0-S9-OFFICIAL') {
    const msg = '[PipelineStore] commitPipeline 失败：producerToken 无效。仅官方流水线可写入。';
    logger.error(msg);
    throw new Error(msg);
  }
  const fullKey = PREFIX_PIPELINE + key;
  const envelope = {
    value,
    _producedAt: Date.now(),
    _producer: producerToken,
  };
  storage.set(fullKey, envelope);
  logger.session(`[PipelineStore] COMMIT ${key}`, envelope);
  return envelope;
}

// ============ 2. Draft Store: 可读写（用户草稿区） ============
export const draftStore = {
  get(key, defaultValue = undefined) {
    const fullKey = PREFIX_DRAFT + key;
    const value = storage.get(fullKey);
    return value === undefined ? defaultValue : value;
  },
  set(key, value) {
    const fullKey = PREFIX_DRAFT + key;
    storage.set(fullKey, value);
    logger.session(`[DraftStore] SET ${key}`, typeof value === 'object' ? `Object(${Object.keys(value || {}).length})` : value);
    return value;
  },
  update(key, updater) {
    const current = this.get(key);
    const next = updater(current);
    this.set(key, next);
    return next;
  },
  remove(key) {
    const fullKey = PREFIX_DRAFT + key;
    const all = storage.getAll();
    delete all[fullKey];
    storage.saveAll(all);
    logger.session(`[DraftStore] REMOVE ${key}`);
  },
};

// ============ 3. Audit Log Store: 仅追加，不可篡改，禁止删除/清空 ============
const AUDIT_LOG_KEY = PREFIX_AUDIT + 'main';

function getAuditLogsRaw() {
  const all = storage.getAll();
  return all[AUDIT_LOG_KEY] || [];
}

function saveAuditLogsRaw(logs) {
  const all = storage.getAll();
  all[AUDIT_LOG_KEY] = logs;
  storage.saveAll(all);
}

export const auditLogStore = {
  /**
   * 追加一条审计日志（自动附加时间戳、ID、防篡改签名）
   */
  append(category, action, details = {}, extra = {}) {
    const entry = {
      id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      iso: new Date().toISOString(),
      category, // e.g. 'mindspeak' | 'fuse' | 'billiards' | 'finance'
      action,   // e.g. 'translate' | 'TRIANGLE_AUDIT_FAIL' | 'FUSE_TRIGGERED'
      details,  // 结构化详情对象
      ...extra,
    };
    // 计算签名
    entry._sig = simpleHmac(entry);

    const logs = getAuditLogsRaw();
    logs.push(entry);
    saveAuditLogsRaw(logs);
    logger.session(`[AuditLog] +${category}/${action}`, entry.id);
    return entry;
  },

  /**
   * 查询审计日志（按条件过滤）
   * @param {Object} filter - { category?, action?, fromTs?, toTs?, limit? }
   */
  query(filter = {}) {
    let logs = getAuditLogsRaw();
    // 完整性校验：每一条都验证签名，有任何一条不通过就在返回值里标注 integrity: 'FAILED'
    let integrityOk = true;
    for (const entry of logs) {
      if (!verifyHmac(entry)) {
        integrityOk = false;
        entry._tampered = true;
      }
    }

    if (filter.category) logs = logs.filter(l => l.category === filter.category);
    if (filter.action) logs = logs.filter(l => l.action === filter.action);
    if (typeof filter.fromTs === 'number') logs = logs.filter(l => l.timestamp >= filter.fromTs);
    if (typeof filter.toTs === 'number') logs = logs.filter(l => l.timestamp <= filter.toTs);
    if (typeof filter.limit === 'number') logs = logs.slice(-filter.limit);

    return {
      total: logs.length,
      integrity: integrityOk ? 'OK' : 'FAILED',
      entries: logs,
    };
  },

  /**
   * 读取最近 N 条（默认 50）
   */
  tail(n = 50) {
    return this.query({ limit: n });
  },

  // ============= 禁止以下操作（安全红线） =============
  clear() {
    const msg = '[AuditLog] 安全红线违规：审计日志禁止清空（canBypass = false）。';
    logger.error(msg);
    throw new Error(msg);
  },
  remove() {
    const msg = '[AuditLog] 安全红线违规：审计日志禁止逐条删除（canBypass = false）。';
    logger.error(msg);
    throw new Error(msg);
  },
  replace() {
    const msg = '[AuditLog] 安全红线违规：审计日志禁止整体替换（canBypass = false）。';
    logger.error(msg);
    throw new Error(msg);
  },
};

// ============ 总线健康检查 ============
export function busHealthCheck() {
  try {
    const audit = auditLogStore.tail(1);
    return {
      status: 'HEALTHY',
      pipeline: 'READY (locked for write)',
      draft: draftStore.get('__health_ping__') === undefined ? 'READY (no data yet)' : 'READY',
      auditLog: { entries: audit.total, integrity: audit.integrity },
      ts: Date.now(),
    };
  } catch (e) {
    return { status: 'UNHEALTHY', error: e.message, ts: Date.now() };
  }
}

export default {
  pipelineStore,
  commitPipeline,
  draftStore,
  auditLogStore,
  busHealthCheck,
};
