/**
 * 三分区数据总线测试 · storageBus
 *
 * 核心验证：
 * 1. Pipeline 只读：set/update 抛异常
 * 2. commitPipeline 仅允许官方令牌写入
 * 3. Draft 可读写、删除
 * 4. AuditLog 仅追加、禁止清空/删除/替换
 * 5. HMAC 签名防篡改
 * 6. busHealthCheck 健康检查
 */

import './testSetup.js';
import {
  pipelineStore,
  commitPipeline,
  draftStore,
  auditLogStore,
  busHealthCheck,
} from '../storageBus.js';

// ============================================================
// Pipeline Store - 只读测试
// ============================================================
describe('pipelineStore - 只读命名空间', () => {

  test('commitPipeline 写入后可通过 get 读到', () => {
    commitPipeline('test_key', 42, 'S0-S9-OFFICIAL');
    const result = pipelineStore.get('test_key');
    expect(result).toBeDefined();
    expect(result.value).toBe(42);
    expect(result._producer).toBe('S0-S9-OFFICIAL');
    expect(result._producedAt).toBeDefined();
  });

  test('set() 应抛异常', () => {
    expect(() => pipelineStore.set('x', 1)).toThrow(/只读/);
  });

  test('update() 应抛异常', () => {
    expect(() => pipelineStore.update('x', () => 1)).toThrow(/只读/);
  });

  test('未写入的 key 返回 undefined', () => {
    expect(pipelineStore.get('nonexistent_key_xyz')).toBeUndefined();
  });

  test('非法 producerToken 应抛异常', () => {
    expect(() => commitPipeline('k', 1, 'FAKE_TOKEN')).toThrow(/producerToken/);
  });

  test('默认 producerToken 应等于 S0-S9-OFFICIAL', () => {
    commitPipeline('default_token_test', 99);
    const result = pipelineStore.get('default_token_test');
    expect(result._producer).toBe('S0-S9-OFFICIAL');
    expect(result.value).toBe(99);
  });
});

// ============================================================
// Draft Store - 可读写测试
// ============================================================
describe('draftStore - 可读写草稿区', () => {

  test('set + get 基本读写', () => {
    draftStore.set('user_draft', { name: 'test', score: 80 });
    const result = draftStore.get('user_draft');
    expect(result.name).toBe('test');
    expect(result.score).toBe(80);
  });

  test('get 未设置的 key 返回 defaultValue', () => {
    expect(draftStore.get('missing_key', 'fallback')).toBe('fallback');
  });

  test('get 未设置的 key 无 defaultValue 返回 undefined', () => {
    expect(draftStore.get('another_missing')).toBeUndefined();
  });

  test('update 基于旧值更新', () => {
    draftStore.set('counter', 10);
    draftStore.update('counter', (old) => (old || 0) + 5);
    expect(draftStore.get('counter')).toBe(15);
  });

  test('remove 删除 key', () => {
    draftStore.set('to_delete', { x: 1 });
    draftStore.remove('to_delete');
    expect(draftStore.get('to_delete')).toBeUndefined();
  });

  test('覆盖写入已有 key', () => {
    draftStore.set('overwrite', 'v1');
    draftStore.set('overwrite', 'v2');
    expect(draftStore.get('overwrite')).toBe('v2');
  });
});

// ============================================================
// AuditLog Store - 仅追加不可篡改测试
// ============================================================
describe('auditLogStore - 仅追加不可篡改', () => {

  test('append 返回带 id 和签名的条目', () => {
    const entry = auditLogStore.append('test', 'ACTION_X', { detail: 1 });
    expect(entry.id).toMatch(/^audit_/);
    expect(entry.timestamp).toBeDefined();
    expect(entry.iso).toBeDefined();
    expect(entry.category).toBe('test');
    expect(entry.action).toBe('ACTION_X');
    expect(entry._sig).toBeDefined();
    expect(entry._sig.length).toBe(8); // FNV-1a 8位十六进制
  });

  test('query 返回所有条目且 integrity=OK', () => {
    auditLogStore.append('cat1', 'ACT1');
    auditLogStore.append('cat2', 'ACT2');
    const result = auditLogStore.query();
    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.integrity).toBe('OK');
  });

  test('query 按 category 过滤', () => {
    auditLogStore.append('finance', 'BUY');
    auditLogStore.append('poker', 'FOLD');
    const financeOnly = auditLogStore.query({ category: 'finance' });
    expect(financeOnly.total).toBe(1);
    expect(financeOnly.entries[0].category).toBe('finance');
  });

  test('query 按 action 过滤', () => {
    auditLogStore.append('test', 'SPECIAL_ACTION');
    auditLogStore.append('test', 'OTHER_ACTION');
    const filtered = auditLogStore.query({ action: 'SPECIAL_ACTION' });
    expect(filtered.total).toBe(1);
  });

  test('tail 返回最近 N 条', () => {
    for (let i = 0; i < 10; i++) {
      auditLogStore.append('bulk', `ACT_${i}`);
    }
    const tail5 = auditLogStore.tail(5);
    expect(tail5.total).toBe(5);
  });

  test('clear() 应抛异常（安全红线）', () => {
    expect(() => auditLogStore.clear()).toThrow(/安全红线/);
  });

  test('remove() 应抛异常（安全红线）', () => {
    expect(() => auditLogStore.remove()).toThrow(/安全红线/);
  });

  test('replace() 应抛异常（安全红线）', () => {
    expect(() => auditLogStore.replace()).toThrow(/安全红线/);
  });

  test('多条 append 后条目数量正确递增', () => {
    const before = auditLogStore.query().total;
    auditLogStore.append('test', 'A');
    auditLogStore.append('test', 'B');
    auditLogStore.append('test', 'C');
    const after = auditLogStore.query().total;
    expect(after - before).toBe(3);
  });

  test('签名验证：篡改条目后 integrity=FAILED', () => {
    auditLogStore.append('tamper_test', 'ORIG', { value: 100 });
    // 直接操作 localStorage 篡改数据
    const raw = localStorage.getItem('ymine_sandbox_v1');
    const parsed = JSON.parse(raw);
    const logs = parsed['audit_log_main'];
    if (logs && logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      lastLog.details = { value: 999 }; // 篡改内容
      localStorage.setItem('ymine_sandbox_v1', JSON.stringify(parsed));
    }
    const result = auditLogStore.query({ action: 'ORIG' });
    expect(result.integrity).toBe('FAILED');
    // 被篡改的条目应标记 _tampered
    const tampered = result.entries.find(e => e.action === 'ORIG');
    if (tampered) {
      expect(tampered._tampered).toBe(true);
    }
  });

  test('query 支持时间范围过滤', () => {
    const now = Date.now();
    auditLogStore.append('time_test', 'BEFORE', { ts: now - 2000 });
    auditLogStore.append('time_test', 'AFTER', { ts: now + 1000 });
    const filtered = auditLogStore.query({
      fromTs: now - 1000,
      toTs: now + 5000,
    });
    const afterEntries = filtered.entries.filter(e => e.action === 'AFTER');
    expect(afterEntries.length).toBe(1);
  });
});

// ============================================================
// busHealthCheck - 总线健康检查
// ============================================================
describe('busHealthCheck - 总线健康检查', () => {

  test('返回 HEALTHY 状态', () => {
    const health = busHealthCheck();
    expect(health.status).toBe('HEALTHY');
    expect(health.pipeline).toContain('READY');
    expect(health.draft).toContain('READY');
    expect(health.auditLog).toBeDefined();
    expect(health.ts).toBeDefined();
  });

  test('auditLog.integrity 在正常情况下为 OK', () => {
    auditLogStore.append('health_test', 'PING');
    const health = busHealthCheck();
    expect(health.auditLog.integrity).toBe('OK');
  });
});
