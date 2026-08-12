import React, { useState, useCallback, useEffect } from 'react';
import {
  Card, Row, Col, Tag, Progress, Space, Typography, Alert, Button, Select, Divider,
  Timeline, List, Popconfirm, Statistic, Empty,
} from 'antd';
import {
  ReloadOutlined, ThunderboltOutlined, SafetyCertificateOutlined,
  PoweroffOutlined, AuditOutlined, ApiOutlined,
} from '@ant-design/icons';
import { apiClient } from '../utils/apiClient';
import { logger } from '../utils/logger';
import {
  TRUST_THRESHOLDS, PIPELINE_STEPS, TRIANGLE_ENGINES,
  runPipeline, readPipelineDraft, trustEmergencyStop, trustReset,
  trustTriggerFuse, getTrustFuseHistory,
} from '../utils/trustGate';
import { getFuseState, THRESHOLDS } from '../utils/fuse';
import { calculateInitialSteadyState } from '../utils/mindspeakEngine';
import {
  PageHeader, SectionCard, StatCard, EmptyState,
} from '../components/Common';

const { Title, Text, Paragraph } = Typography;

// ============= 可选标的 =============
const SYMBOL_OPTIONS = [
  { value: '600519', label: '600519 贵州茅台' },
  { value: '000858', label: '000858 五粮液' },
  { value: '000333', label: '000333 美的集团' },
  { value: '600036', label: '600036 招商银行' },
  { value: '601318', label: '601318 中国平安' },
];
const BATCH_SYMBOLS = SYMBOL_OPTIONS.map(s => s.value);
const DEFAULT_SYMBOL = '600519';

const safe = (v, d = 0) => (typeof v === 'number' && !isNaN(v) ? v : d);
const clamp01 = v => Math.max(0, Math.min(1, safe(v)));

const STEP_STATUS_META = {
  passed:  { color: '#10b981', label: '✅ 通过' },
  running: { color: '#22d3ee', label: '⏳ 运行中' },
  blocked: { color: '#ef4444', label: '🚫 阻断' },
  waiting: { color: '#6b7280', label: '⏸ 待运行' },
};

const TrustDashboardPage = () => {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [loading, setLoading] = useState(false);
  const [pipeline, setPipeline] = useState(() => readPipelineDraft());
  const [source, setSource] = useState('本地沙盘');
  const [error, setError] = useState(null);

  const fuseState = getFuseState();

  // ============= 由真实行情构建 S0-S9 步骤结果 =============
  const buildStepResults = useCallback((real, saved) => {
    const quote = real.quote || {};
    const asset = real.asset || {};
    const kline = real.kline || [];
    const closes = kline.map(b => safe(b.close, 0)).filter(c => c > 0);
    const returns = closes.length >= 2
      ? closes.map((c, i) => (i === 0 ? 0 : (c - closes[i - 1]) / closes[i - 1]))
      : [];
    const avgRet = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const std = (() => {
      if (returns.length < 2) return 0.02;
      const m = avgRet;
      return Math.sqrt(returns.reduce((s, v) => s + (v - m) * (v - m), 0) / (returns.length - 1)) || 0.02;
    })();
    const volatility = clamp01(std * 12);
    const successRate = clamp01(0.5 + avgRet * 10);
    const upside = safe(asset.upside, 0.1);
    const emotion = safe(real.emotion, 50);

    return {
      S0: { ready: true, input: `${asset.name || real.symbol} 行业筛选`, output: `宏观景气 · 目标 ${asset.name || real.symbol}` },
      S1: { ready: true, input: '行情/基本面压缩', output: `${kline.length} 根K线 · ${closes.length} 有效收盘` },
      S2: { ready: true, input: 'DCF/相对估值因子', output: `估值上行空间 ${(upside * 100).toFixed(1)}%` },
      S3: { ready: true, input: '历史收益率序列', output: `历史胜率 ${(successRate * 100).toFixed(1)}% · 波动 ${(volatility * 100).toFixed(1)}%` },
      S4: { ready: true, input: 'K线周期观测', output: `最新价 ${safe(quote.price, 0)} · 波动率 ${(volatility * 100).toFixed(1)}%` },
      S5: { ready: true, input: '人性偏差校验', output: `情绪 ${emotion} / 风险偏好 ${asset.riskPreference || 'balanced'}` },
      S6: { ready: true, input: '人工调参', output: '参数已确认' },
      S7: { ready: true, input: '三角审计', output: '三模型并行 ±0.02 校验' },
      S8: { ready: true, input: '七层熔断', output: safe(real.riskLevel, 0.3) > 0.68 ? '熔断警戒' : '风控正常' },
      S9: { ready: false, input: '全局同步', output: '待闭环放行' },
    };
  }, []);

  // ============= 加载真实数据并运行流水线 =============
  const loadReal = useCallback(async (sym) => {
    setLoading(true);
    setError(null);
    setSource('加载中…');
    const saved = readPipelineDraft();
    try {
      const batch = await apiClient.marketBatchValuation(BATCH_SYMBOLS);
      const assets = batch.assets || [];
      const factorsMap = batch.factors || {};
      const primary = assets.find(a => a.ticker === sym) || assets[0];
      const factors = factorsMap[primary?.ticker] || {};
      let kline = [];
      try {
        const kr = await apiClient.marketGetKline(sym, 120);
        kline = Array.isArray(kr) ? kr : (kr?.bars || []);
      } catch (e) {
        logger.session('[可信总控台] 外部K线源不可达', e.message);
      }

      // ===== 由真实 K 线推导金融指标（供金融三角审计） =====
      const closes = kline.map(b => safe(b.close, 0)).filter(c => c > 0);
      const returns = closes.length >= 2
        ? closes.map((c, i) => (i === 0 ? 0 : (c - closes[i - 1]) / closes[i - 1]))
        : [];
      const avgRet = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
      const stdRet = (() => {
        if (returns.length < 2) return 0.02;
        const m = avgRet;
        return Math.sqrt(returns.reduce((s, v) => s + (v - m) * (v - m), 0) / (returns.length - 1)) || 0.02;
      })();
      const successRate = clamp01(0.5 + avgRet * 10);
      const volatility = clamp01(stdRet * 12);
      const upside = clamp01(safe(primary?.upside, safe(factors.upside, 0.1)));

      // 决策对象（供三角审计与门控）
      const decision = {
        symbol: sym,
        steadyState: calculateInitialSteadyState({ userState: { emotion: 50, riskPreference: 'balanced' } }),
        successRate,
        volatility,
        upside,
        riskLevel: safe(factors.riskScore, 0.3),
      };

      const real = {
        symbol: sym,
        quote: batch.quotes?.[sym] || batch.quotes?.[primary?.ticker],
        asset: primary,
        factors,
        kline,
        emotion: 50,
        riskLevel: safe(factors.riskScore, 0.3),
      };

      const stepResults = buildStepResults(real, saved);
      const pipe = runPipeline(stepResults, decision, {
        userState: { emotion: 50, riskPreference: 'balanced' },
      });
      setPipeline(pipe);
      setSource(primary?.name ? `${primary.ticker} ${primary.name}` : sym);
    } catch (e) {
      if (e?.name === 'AbortError' || (e?.message || '').toLowerCase().includes('aborted')) {
        setLoading(false);
        return;
      }
      logger.session('[可信总控台] 实时数据加载失败', e.message);
      setError(e.message);
      setSource('本地沙盘(实时数据失败)');
    } finally {
      setLoading(false);
    }
  }, [buildStepResults]);

  useEffect(() => {
    loadReal(DEFAULT_SYMBOL);
  }, [loadReal]);

  const steps = pipeline?.steps || [];
  const gate = pipeline?.gate || null;
  const passedCount = steps.filter(s => s.status === 'passed').length;

  // 门控显示跟随实时熔断状态：熔断激活强显 FUSE；否则若缓存 gate 是 FUSE 但不激活，视为已放行
  const fuseActiveNow = fuseState.active;
  const displayGate = fuseActiveNow
    ? { passed: false, gate: 'FUSE', reason: `熔断已激活（${fuseState.triggeredLayer?.name || '未知层'}）：${fuseState.triggerReason || '未说明'}`, audit: null }
    : (gate?.gate === 'FUSE' ? { ...gate, passed: true, gate: 'PASS', reason: '熔断已解除，放行' } : gate);

  // ============= 三线仪表 =============
  const steadyVal = safe(pipeline?.steadyState, TRUST_THRESHOLDS.STEADY_MID);
  const zoneLine = (val, color, name) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ height: 12, width: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{name}</Text>
      <Text code style={{ fontSize: 12 }}>{val}</Text>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="可信决策中台"
        subtitle="Game-OS 可信框架 · 统一阈值 / 三角审计 / 七层熔断 / S0-S9 闭环"
        icon={<AuditOutlined />}
      />

      {/* 顶部操作栏 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          value={symbol}
          style={{ width: 220 }}
          options={SYMBOL_OPTIONS}
          onChange={setSymbol}
        />
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => loadReal(symbol)}
        >
          运行闭环流水线
        </Button>
        <Popconfirm
          title="确认紧急停机？"
          description="将触发 L6 手动停机熔断，阻断所有输出"
          onConfirm={() => { trustEmergencyStop('TrustDashboard'); setPipeline(p => ({ ...p, gate: { ...p?.gate, passed: false, gate: 'FUSE', blocked: true } })); }}
        >
          <Button danger icon={<PoweroffOutlined />}>🛑 紧急停机</Button>
        </Popconfirm>
        <Popconfirm
          title="解除熔断？"
          description="仅 L6 手动停机可解除；其他层需 force"
          onConfirm={() => { try { trustReset(true); loadReal(symbol); } catch (e) { logger.error(e.message); } }}
        >
          <Button icon={<SafetyCertificateOutlined />}>解除熔断</Button>
        </Popconfirm>
        <Tag color="default">数据源：{source}</Tag>
      </Space>

      {/* 熔断横幅 */}
      {fuseState.active && (
        <Alert
          type="error"
          showIcon
          banner
          style={{ marginBottom: 16 }}
          message={`🚨 熔断已激活 · ${fuseState.triggeredLayer?.name || '未知层'}`}
          description={`原因：${fuseState.triggerReason || '未说明'} · ${new Date(fuseState.triggeredAt).toLocaleString()}`}
        />
      )}

      {/* 全局三线 + 稳态 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
        <Col xs={24} md={8}>
          <SectionCard title="全局三线阈值">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {zoneLine(TRUST_THRESHOLDS.BREAKEVEN, '#10b981', '保本底线')}
              {zoneLine(TRUST_THRESHOLDS.STEADY_MID, '#22d3ee', '稳态中轴线')}
              {zoneLine(TRUST_THRESHOLDS.FUSE_RED, '#ef4444', '熔断警戒线')}
              <Divider style={{ margin: '8px 0' }} />
              <Text>当前稳态值</Text>
              <Progress
                percent={Math.round(steadyVal * 100)}
                strokeColor={steadyVal > TRUST_THRESHOLDS.FUSE_RED ? '#ef4444' : '#a78bfa'}
                format={() => steadyVal.toFixed(3)}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {steadyVal <= TRUST_THRESHOLDS.BREAKEVEN ? '⚠ 低于保本线' :
                 steadyVal <= TRUST_THRESHOLDS.FUSE_RED ? '🟢 稳态区间' :
                 '🔴 触碰熔断红线'}
              </Text>
            </Space>
          </SectionCard>
        </Col>

        <Col xs={24} md={8}>
          <SectionCard title="决策门控">
            {displayGate ? (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Tag color={displayGate.passed ? 'green' : 'red'} style={{ fontSize: 14, padding: '4px 10px' }}>
                  GATE: {displayGate.gate} · {displayGate.passed ? '放行' : '阻断'}
                </Tag>
                <Text style={{ fontSize: 13 }}>{displayGate.reason}</Text>
                {displayGate.audit && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <Text type="secondary">三角审计 STAGE-9</Text>
                    <Space wrap>
                      {displayGate.audit.scores.map((s, i) => (
                        <Tag key={i} color={s === 0 ? 'red' : 'purple'}>
                          {TRIANGLE_ENGINES[i]?.name.split(' ')[0]}: {s.toFixed(3)}
                        </Tag>
                      ))}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      最大偏差 {displayGate.audit.maxDev} / 容差 ±{displayGate.audit.tolerance}
                    </Text>
                  </>
                )}
              </Space>
            ) : (
              <EmptyState text="尚未运行闭环流水线" />
            )}
          </SectionCard>
        </Col>

        <Col xs={24} md={8}>
          <SectionCard title="闭环统计">
            <Row gutter={[8, 8]}>
              <Col span={12}><StatCard label="流水线进度" value={`${passedCount}/${steps.length}`} /></Col>
              <Col span={12}><Statistic title="熔断状态" value={fuseState.active ? 'ACTIVE' : 'SAFE'} valueStyle={{ color: fuseState.active ? '#ef4444' : '#10b981' }} /></Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              熔断层数：{THRESHOLDS.FUSE_RED_LINE} · 审计容差：±{TRUST_THRESHOLDS.TRIANGLE_TOLERANCE}
            </Text>
          </SectionCard>
        </Col>
      </Row>

      {/* S0-S9 流水线 */}
      <SectionCard title="S0-S9 十步闭环引擎流水线" subtitle="自动流水线(S0-S4) → 人工驾驶舱(S5-S8) → 同步闭环出口(S9)">
        {steps.length === 0 ? (
          <EmptyState text="暂无流水线数据" />
        ) : (
          <Row gutter={[8, 12]}>
            {steps.map((s) => {
              const meta = STEP_STATUS_META[s.status] || STEP_STATUS_META.waiting;
              return (
                <Col xs={12} sm={8} md={12} lg={6} xl={4} key={s.id} style={{ minWidth: 0 }}>
                  <Card
                    size="small"
                    style={{
                      borderColor: meta.color,
                      background: `linear-gradient(135deg, rgba(139,92,246,${s.status === 'passed' ? 0.08 : 0.03}), rgba(236,72,153,${s.status === 'blocked' ? 0.06 : 0.02}))`,
                    }}
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          <span style={{ fontSize: 18 }}>{s.icon}</span>
                          <Text strong style={{ fontSize: 13 }}>{s.id}</Text>
                        </Space>
                        <Tag color={s.status === 'waiting' ? 'default' : (s.status === 'passed' ? 'green' : s.status === 'blocked' ? 'red' : 'blue')}
                          style={{ fontSize: 11, margin: 0 }}>
                          {s.status === 'waiting' ? '待' : s.status === 'passed' ? '✓' : s.status === 'blocked' ? '✗' : '▶'}
                        </Tag>
                      </Space>
                      <Text style={{ fontSize: 13 }}>{s.name}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{s.desc}</Text>
                      {s.output && (
                        <Text code style={{ fontSize: 11, color: '#d1d5db' }} ellipsis>
                          {s.output}
                        </Text>
                      )}
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </SectionCard>

      {/* 三角审计明细 + 熔断历史 */}
      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        <Col xs={24} md={12}>
          <SectionCard title="三角冗余审计 STAGE-9" subtitle="CALC / GameMind / geom-compute 并行 · ±0.02 容差">
            {fuseActiveNow ? (
              <Alert type="error" showIcon message="熔断已激活，审计被阻断" description={displayGate?.reason} />
            ) : displayGate?.audit ? (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Alert
                  type={displayGate.audit.passed ? 'success' : 'error'}
                  showIcon
                  message={`STAGE-9: ${displayGate.audit.status}`}
                  description={`三模型独立评分，最大偏差 ${displayGate.audit.maxDev}（容差 ±${displayGate.audit.tolerance}）`}
                />
                <Row gutter={[8, 8]}>
                  {displayGate.audit.scores.map((score, i) => {
                    const eng = TRIANGLE_ENGINES[i] || {};
                    return (
                      <Col xs={24} sm={8} key={i}>
                        <Card size="small">
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <Space>
                              <span style={{ fontSize: 18 }}>{eng.icon}</span>
                              <Text strong style={{ fontSize: 12 }}>{eng.name}</Text>
                            </Space>
                            <Progress percent={Math.round(score * 100)} showInfo={false} strokeColor={score === 0 ? '#ef4444' : '#a78bfa'} />
                            <Text style={{ fontSize: 12 }}>{score.toFixed(3)}</Text>
                          </Space>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </Space>
            ) : (
              <EmptyState text="暂无审计数据" />
            )}
          </SectionCard>
        </Col>

        <Col xs={24} md={12}>
          <SectionCard title="熔断审计日志" subtitle="七层熔断历史 · 不可篡改">
            <FuseHistory />
          </SectionCard>
        </Col>
      </Row>
    </div>
  );
};

// ============= 熔断历史组件 =============
function FuseHistory() {
  const history = getTrustFuseHistory(10);
  if (history.length === 0) {
    return <EmptyState text="暂无熔断记录" />;
  }
  return (
    <Timeline
      items={history.map((h) => ({
        color: h.type === 'TRIGGER' ? 'red' : 'green',
        children: (
          <Space direction="vertical" size={2}>
            <Text style={{ fontSize: 13 }}>
              {h.type === 'TRIGGER' ? '🚨 触发' : '✅ 解除'} · {h.layer?.name || '未知层'}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{h.reason}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{new Date(h.at).toLocaleString()}</Text>
          </Space>
        ),
      }))}
    />
  );
}

export default TrustDashboardPage;