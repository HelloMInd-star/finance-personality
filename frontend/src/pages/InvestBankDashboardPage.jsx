import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Tag, Divider, Progress, Space, Typography, Table, Alert, Button, Select, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import {
  FundOutlined,
  SafetyCertificateOutlined,
  RiseOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  StockOutlined,
} from '@ant-design/icons';
import { generateDispatchDecision, dispatcherEngine } from '../utils/dispatcherEngine';
import { computeAPV, optimalCapitalStructure, crossValidateValuation } from '../utils/corporateFinance';
import { computeHistoricalVaR, computeCVaR, scenarioAnalysis } from '../utils/riskStressTest';
import { investorEngine } from '../utils/investorEngine';
import { buildUserVector, buildAssetVector, matchUserAsset } from '../utils/vectorMapper';
import { apiClient } from '../utils/apiClient';
import { logger } from '../utils/logger';

const { Title, Text, Paragraph } = Typography;

// ============= 可选标的（真实 A 股） =============
const SYMBOL_OPTIONS = [
  { value: '600519', label: '600519 贵州茅台' },
  { value: '000858', label: '000858 五粮液' },
  { value: '000333', label: '000333 美的集团' },
  { value: '600036', label: '600036 招商银行' },
  { value: '601318', label: '601318 中国平安' },
];
const BATCH_SYMBOLS = SYMBOL_OPTIONS.map(s => s.value);

// ============= 基础工具 =============
const clamp01 = v => Math.max(0, Math.min(1, typeof v === 'number' && !isNaN(v) ? v : 0));
const safe = (v, d = 0) => (typeof v === 'number' && !isNaN(v) ? v : d);
const avg = arr => (arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const std = arr => {
  if (!arr || arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / (arr.length - 1));
};

// ============= 本地沙盘回退数据（实时加载失败时兜底，确定性避免跳动） =============
function buildSandboxHistory(n = 30) {
  let v = 0.5;
  return Array.from({ length: n }, (_, i) => {
    v = Math.min(0.95, Math.max(0.2, v + Math.sin(i / 3.1) * 0.055 + Math.cos(i * 0.7) * 0.02));
    return { t: Date.now() - (n - i) * 86400000, rate: Math.round(v * 1000) / 1000, close: 100 + v * 100 };
  });
}

// 实时报价重建：外部 K 线源不可达时，锚定 close_prev -> price 生成确定性序列
function buildRebuiltHistory(quote = {}) {
  const price = safe(quote.price, 100);
  const prev = safe(quote.close_prev, price);
  const n = 30;
  const drift = (price - prev) / (n - 1);
  const series = [];
  for (let i = 0; i < n; i++) {
    const close = i === n - 1 ? price : prev + drift * i;
    const rate = clamp01(0.5 + (close - price) / Math.max(1, price) * 2);
    series.push({ t: Date.now() - (n - i) * 86400000, rate, close });
  }
  return series;
}

// ============= 由真实行情构建看板模型 =============
function buildRealModel(real) {
  const quote = real.quote || {};
  const asset = real.asset || {};

  // ---- 历史 / 收益率 ----
  let history;
  let histSource;
  if (Array.isArray(real.kline) && real.kline.length >= 5) {
    history = real.kline.map(b => ({
      t: new Date(b.date).getTime(),
      rate: clamp01(0.5 + safe(b.change_pct, 0) / 100),
      close: safe(b.close, 0),
    }));
    histSource = '真实K线';
  } else {
    history = buildRebuiltHistory(quote);
    histSource = '实时报价重建(外部K线源受限)';
  }
  const closes = history.map(h => h.close).filter(c => typeof c === 'number' && c > 0);
  const returns = closes.length >= 2 ? closes.map((c, i) => (i === 0 ? 0 : (c - closes[i - 1]) / closes[i - 1])) : [];

  // ---- 决策中枢（dispatcherEngine）----
  const volatilityRisk = clamp01(std(returns) * 12);
  const scenarioState = {
    successRateHistorical: avg(history.map(h => h.rate)),
    environmentalRisk: Number.isFinite(volatilityRisk) ? volatilityRisk : 0.3,
    resourceAvailability: 0.75,
    urgency: 0.42,
  };
  const decision = generateDispatchDecision({
    scenarioState,
    history,
    envType: dispatcherEngine.ENV_TYPES.GENERAL,
  });

  // ---- 风险度量 ----
  const portfolioValue = 1000000;
  const var95 = computeHistoricalVaR(returns, 0.95, portfolioValue);
  const cvar95 = computeCVaR(returns, 0.95);
  const mu = avg(returns);
  const sigma = std(returns) || 0.02;
  const scenarios = scenarioAnalysis({
    baseCase: { return: mu, volatility: sigma, portfolioValue },
    adverseCase: { return: mu - 2 * sigma, volatility: sigma * 1.5, portfolioValue },
    severeCase: { return: mu - 4 * sigma, volatility: sigma * 2, portfolioValue },
    confidence: 0.95,
  });

  // ---- 估值分析（FCF 序列由真实资产基本面推导）----
  const baseFcf = (safe(asset.marketCap, 100) || 100) * (safe(asset.fcfYield, 0.03) || 0.03); // 单位:亿
  const g = clamp01(safe(asset.revenueGrowthYoY, 0.05) + 0.05);
  const fcf = Array.from({ length: 10 }, (_, i) => +baseFcf.toFixed(2) * Math.pow(1 + g, i));
  const apv = computeAPV({
    unleveredFCFs: fcf,
    costOfCapital: 0.1,
    debtAmount: 500,
    costOfDebt: 0.05,
    taxRate: 0.25,
    distressProbability: 0.1,
    distressCostRate: 0.25,
  });
  const unleveredValue = apv.unleveredValue;
  const optCap = optimalCapitalStructure({ unleveredValue, taxRate: 0.25, costOfDebt: 0.05, distressCostRate: 0.25 });
  const xval = crossValidateValuation({
    unleveredFCFs: fcf,
    costOfCapital: 0.1,
    costOfEquity: 0.12,
    wacc: 0.095,
    debtAmount: 500,
    costOfDebt: 0.05,
    taxRate: 0.25,
  });

  // ---- 画像匹配（真实批量估值资产）----
  const userData = investorEngine.extractUserData();
  const matches = investorEngine.matchInvestor(userData);
  const best = matches[0];
  const userVector = buildUserVector();
  const assetMatches = (Array.isArray(real.assets) ? real.assets : [])
    .map(a => {
      const f = real.factorsMap?.[a.ticker] || real.factors || {};
      const vec = buildAssetVector(a, f);
      return { ...vec, name: a.name || a.ticker, ticker: a.ticker, match: matchUserAsset(userVector.vector, vec.vector) };
    })
    .sort((a, b) => b.match.overall - a.match.overall);

  return {
    history,
    decision,
    var95,
    cvar95,
    scenarios,
    apv,
    optCap,
    xval,
    userData,
    best,
    matches,
    userVector,
    assetMatches,
    calibration: decision.emotionalCalibration,
    histSource,
    price: safe(quote.price, 0),
    name: asset.name || quote.name || real.symbol,
    symbol: real.symbol,
  };
}

// ============= 沙盘回退模型 =============
function buildSandboxModel() {
  const history = buildSandboxHistory();
  const scenarioState = {
    successRateHistorical: 0.72,
    environmentalRisk: 0.28,
    resourceAvailability: 0.75,
    urgency: 0.42,
  };
  const decision = generateDispatchDecision({ scenarioState, history, envType: dispatcherEngine.ENV_TYPES.GENERAL });
  const returns = history.map(h => h.rate);
  const portfolioValue = 1000000;
  const var95 = computeHistoricalVaR(returns, 0.95, portfolioValue);
  const cvar95 = computeCVaR(returns, 0.95);
  const scenarios = scenarioAnalysis({
    baseCase: { return: avg(returns), volatility: std(returns), portfolioValue },
    adverseCase: { return: avg(returns) - 2 * std(returns), volatility: std(returns) * 1.5, portfolioValue },
    severeCase: { return: avg(returns) - 4 * std(returns), volatility: std(returns) * 2, portfolioValue },
    confidence: 0.95,
  });
  const fcf = [100, 120, 140, 160, 180, 200, 220, 240, 260, 280];
  const apv = computeAPV({ unleveredFCFs: fcf, costOfCapital: 0.1, debtAmount: 500, costOfDebt: 0.05, taxRate: 0.25, distressProbability: 0.1, distressCostRate: 0.25 });
  const unleveredValue = apv.unleveredValue;
  const optCap = optimalCapitalStructure({ unleveredValue, taxRate: 0.25, costOfDebt: 0.05, distressCostRate: 0.25 });
  const xval = crossValidateValuation({ unleveredFCFs: fcf, costOfCapital: 0.1, costOfEquity: 0.12, wacc: 0.095, debtAmount: 500, costOfDebt: 0.05, taxRate: 0.25 });
  const userData = investorEngine.extractUserData();
  const matches = investorEngine.matchInvestor(userData);
  const best = matches[0];
  const userVector = buildUserVector();
  const assetMatches = (Array.isArray(SYMBOL_OPTIONS) ? SYMBOL_OPTIONS : [])
    .map(s => {
      const a = { ticker: s.value, name: s.label.split(' ')[1], marketCap: 100, pe: 20, pb: 3, roe: 0.15, debtToEquity: 0.3, revenueGrowthYoY: 0.08, fcfYield: 0.03, grade: 'A', basePrice: 100, beta: 1 };
      const vec = buildAssetVector(a);
      return { ...vec, name: a.name, ticker: a.ticker, match: matchUserAsset(userVector.vector, vec.vector) };
    })
    .sort((a, b) => b.match.overall - a.match.overall);

  return {
    history, decision, var95, cvar95, scenarios, apv, optCap, xval,
    userData, best, matches, userVector, assetMatches,
    calibration: decision.emotionalCalibration,
    histSource: '本地沙盘(等待实时数据)',
    price: 0, name: '—', symbol: '600519',
  };
}

const FN_DIMS = [
  { key: 'riskTolerance', label: '风险偏好', color: '#22d3ee' },
  { key: 'timePreference', label: '时间偏好', color: '#f472b6' },
  { key: 'executionDiscipline', label: '执行纪律', color: '#34d399' },
  { key: 'reflectionDeviation', label: '反思偏差', color: '#f59e0b' },
  { key: 'aimPrecision', label: '瞄准精度', color: '#a855f7' },
];

const ZONE_REC = {
  safe: { label: '安全区', desc: '自动执行', color: '#10b981', emoji: '🟢' },
  observe: { label: '观察区', desc: '人工复核', color: '#f59e0b', emoji: '🟡' },
  forbidden: { label: '禁区', desc: '自动放弃', color: '#ef4444', emoji: '🔴' },
};

const InvestBankDashboardPage = () => {
  const [model, setModel] = useState(() => buildSandboxModel());
  const [status, setStatus] = useState({ loading: false, source: '本地沙盘', error: null, symbol: '600519' });

  const loadRealData = useCallback(async (sym) => {
    setStatus(s => ({ ...s, loading: true, error: null, symbol: sym, source: '加载中…' }));
    try {
      const batch = await apiClient.marketBatchValuation(BATCH_SYMBOLS);
      const assets = batch.assets || [];
      const factorsMap = batch.factors || {};
      const primary = assets.find(a => a.ticker === sym) || assets[0];
      const factors = factorsMap[primary?.ticker] || {};
      let kline = null;
      try {
        // 接口返回 { symbol, bars }，需提取 bars 数组供 buildRealModel 使用
        const kr = await apiClient.marketGetKline(sym, 120);
        kline = Array.isArray(kr) ? kr : (kr?.bars || []);
      } catch (e) {
        logger.session('[投行看板] 外部K线源不可达，使用实时报价重建', e.message);
      }
      const m = buildRealModel({
        symbol: sym,
        quote: batch.quotes?.[sym] || batch.quotes?.[primary?.ticker],
        asset: primary,
        factors,
        assets,
        factorsMap,
        kline,
      });
      setModel(m);
      setStatus(s => ({ ...s, loading: false, source: m.histSource, symbol: sym }));
    } catch (e) {
      // StrictMode 双挂载会中止上一次请求，属正常取消，不当作错误上报
      if (e?.name === 'AbortError' || (e?.message || '').toLowerCase().includes('aborted')) {
        logger.session('[投行看板] 请求被取消（StrictMode 双挂载），忽略', e.message);
        setStatus(s => ({ ...s, loading: false }));
        return;
      }
      logger.session('[投行看板] 实时数据加载失败，保持沙盘', e.message);
      setStatus(s => ({ ...s, loading: false, error: e.message, source: '本地沙盘(实时数据失败)' }));
    }
  }, []);

  useEffect(() => {
    loadRealData('600519');
  }, [loadRealData]);

  const d = model.decision;
  const zone = d.decisionSignal.cognitiveZone;
  const zoneMeta = ZONE_REC[zone] || ZONE_REC.observe;
  const signalCat = d.signalCategory;
  const recMap = {
    execute: { label: '立即执行', color: '#10b981' },
    defer: { label: '延迟执行', color: '#f59e0b' },
    abort: { label: '放弃执行', color: '#ef4444' },
  };
  const rec = recMap[d.decisionSignal.recommendation] || recMap.defer;

  // ============= 图表 Option（依赖 model，随实时数据联动） =============
  const historyOpt = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15,10,30,0.92)',
      borderColor: 'rgba(139,92,246,0.4)',
      textStyle: { color: '#fff' },
    },
    grid: { left: 40, right: 16, top: 24, bottom: 28 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: model.history.map(h => new Date(h.t).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })),
      axisLine: { lineStyle: { color: 'rgba(139,92,246,0.3)' } },
      axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, formatter: v => `${Math.round(v * 100)}%` },
      splitLine: { lineStyle: { color: 'rgba(139,92,246,0.1)' } },
    },
    series: [
      {
        name: '历史成功率',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: model.history.map(h => h.rate),
        lineStyle: { color: '#a78bfa', width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(167,139,250,0.35)' },
              { offset: 1, color: 'rgba(167,139,250,0.02)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            { yAxis: 0.368, name: '1/e 基准', lineStyle: { color: '#f59e0b', type: 'dashed' } },
            { yAxis: d.anchoring.longTerm.mean, name: '长期锚定 R_f', lineStyle: { color: '#22d3ee', type: 'dashed' } },
          ],
          label: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
        },
      },
    ],
  }), [model, d]);

  const radarOpt = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: 'rgba(15,10,30,0.92)',
      borderColor: 'rgba(139,92,246,0.4)',
      textStyle: { color: '#fff' },
    },
    radar: {
      indicator: FN_DIMS.map(dim => ({ name: dim.label, max: 100 })),
      radius: '62%',
      center: ['50%', '52%'],
      splitLine: { lineStyle: { color: 'rgba(168,85,247,0.18)' } },
      splitArea: { areaStyle: { color: ['rgba(168,85,247,0.02)', 'rgba(168,85,247,0.05)'] } },
      axisLine: { lineStyle: { color: 'rgba(168,85,247,0.25)' } },
      axisName: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
    },
    legend: { bottom: 0, textStyle: { color: 'rgba(255,255,255,0.7)' }, itemWidth: 14, itemHeight: 8 },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 5,
        data: [
          {
            name: '你',
            value: FN_DIMS.map(dim => model.userData[dim.key] ?? 50),
            lineStyle: { color: '#a855f7', width: 2 },
            areaStyle: { color: 'rgba(168,85,247,0.25)' },
          },
          {
            name: model.best?.investor?.name || '最佳投资人',
            value: FN_DIMS.map(dim => model.best?.investor?.[dim.key] ?? 50),
            lineStyle: { color: '#22d3ee', width: 2 },
            areaStyle: { color: 'rgba(34,211,238,0.15)' },
          },
        ],
      },
    ],
  }), [model]);

  const topAssets = model.assetMatches.slice(0, 6);
  const assetBarOpt = useMemo(() => ({
    backgroundColor: 'transparent',
    grid: { left: 110, right: 40, top: 10, bottom: 20 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15,10,30,0.92)',
      borderColor: 'rgba(139,92,246,0.4)',
      textStyle: { color: '#fff' },
      formatter: (ps) => {
        const idx = ps[0].dataIndex;
        const a = topAssets[idx];
        return `<div style="font-weight:600">${a.name || a.ticker} · 综合 ${(a.match.overall * 100).toFixed(1)}%</div>
          <div style="font-size:11px;opacity:0.7">余弦 ${(a.match.cosine * 100).toFixed(1)}% · 距离 ${(a.match.normalizedDistance * 100).toFixed(1)}%</div>`;
      },
    },
    xAxis: {
      type: 'value', max: 1,
      axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, formatter: v => `${Math.round(v * 100)}%` },
      splitLine: { lineStyle: { color: 'rgba(139,92,246,0.1)' } },
    },
    yAxis: {
      type: 'category',
      data: topAssets.map(a => `${a.name || a.ticker}`),
      axisLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(139,92,246,0.3)' } },
    },
    series: [{
      type: 'bar',
      data: topAssets.map(a => ({
        value: a.match.overall,
        itemStyle: { color: '#a78bfa', borderRadius: [0, 4, 4, 0] },
      })),
      barWidth: 14,
    }],
  }), [topAssets]);

  // ============= 各分区 =============
  const renderOverview = () => (
    <Card
      title={<span style={{ color: '#fff' }}><FundOutlined /> 投行级金融数据看板 · 综合概览</span>}
      extra={
        <Space>
          <Tag color="purple">{model.symbol} {model.name}{model.price > 0 ? ` · ¥${model.price.toFixed(2)}` : ''}</Tag>
          <Tag color={status.source.includes('真实') ? 'green' : status.source.includes('重建') ? 'gold' : 'default'}>{status.source}</Tag>
        </Space>
      }
      style={{ marginBottom: 24, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} md={5}>
          <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>综合评分 Score</span>}
            value={d.decisionSignal.score.toFixed(3)}
            valueStyle={{ color: '#a78bfa', fontSize: 26 }} />
        </Col>
        <Col xs={12} md={5}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>成功概率 P = 1-e^(-Score)</Text>
            <Progress percent={Math.round(d.decisionSignal.probability * 100)}
              strokeColor={d.decisionSignal.probability >= 0.366 ? '#a78bfa' : '#ef4444'}
              status={d.decisionSignal.probability >= 0.6 ? 'success' : d.decisionSignal.probability >= 0.4 ? 'active' : 'exception'} />
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: 600 }}>
              {(d.decisionSignal.probability * 100).toFixed(1)}%
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}> 1/e 基准 36.8%</Text>
          </div>
        </Col>
        <Col xs={12} md={5}>
          <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>置信度</span>}
            value={(d.confidence * 100).toFixed(0)} suffix="%"
            valueStyle={{ color: '#10b981', fontSize: 26 }} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>感知风险 σ</span>}
            value={(d.risk * 100).toFixed(0)} suffix="%"
            valueStyle={{ color: '#f59e0b', fontSize: 26 }} />
        </Col>
        <Col xs={24} md={5}>
          <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>调度信号 S</span>}
            value={d.signal.toFixed(3)}
            valueStyle={{ color: signalCat.emoji === '⛔' ? '#ef4444' : '#a78bfa', fontSize: 26 }}
            suffix={<span style={{ fontSize: 16 }}>{signalCat.emoji} {signalCat.label}</span>} />
        </Col>
      </Row>
      <Divider style={{ borderColor: 'rgba(139,92,246,0.2)', margin: '16px 0 8px' }} />
      <Paragraph style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, margin: 0 }}>
        🔍 推理：主导因子「{d.reasoning.primaryFactor}」（{d.reasoning.confidenceLevel === 'high' ? '高' : d.reasoning.confidenceLevel === 'medium' ? '中' : '低'}置信）· {d.reasoning.explanation}
      </Paragraph>
    </Card>
  );

  const renderDecisionHub = () => {
    const seed = d.anchoring;
    return (
      <Card
        title={<span style={{ color: '#fff' }}><ThunderboltOutlined /> 决策中枢 · 三周期锚定 + 三因子 CAPM</span>}
        style={{ marginBottom: 24, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} lg={14}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>历史成功率序列（含 1/e 基准线与长期锚定线）· 源：{model.histSource}</Text>
            <ReactECharts option={historyOpt} style={{ height: 260 }} notMerge />
          </Col>
          <Col xs={24} lg={10}>
            <Row gutter={[12, 12]}>
              {[
                { key: 'longTerm', label: '长期锚定 R_f', sub: '指数衰减 e^-λΔt' },
                { key: 'mediumTerm', label: '中期锚定 R_m', sub: `最近 ${seed.mediumTerm.windowSize} 天窗口` },
                { key: 'shortTerm', label: '短期锚定 R_l', sub: '当日K线' },
              ].map(item => (
                <Col xs={8} key={item.key}>
                  <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{item.label}</Text>
                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: 600 }}>
                      {(seed[item.key].mean * 100).toFixed(1)}%
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>σ² = {(seed[item.key].variance * 100).toFixed(2)}%</Text>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{item.sub}</Text>
                  </div>
                </Col>
              ))}
            </Row>
            <Divider style={{ borderColor: 'rgba(139,92,246,0.2)', margin: '14px 0' }}>
              <Tag color="purple">认知画圈 → {rec.label}</Tag>
            </Divider>
            <Space wrap>
              <Tag color="cyan">βm(中期) = {d.covariance.beta.medium.toFixed(3)}</Tag>
              <Tag color="geekblue">βl(短期) = {d.covariance.beta.short.toFixed(3)}</Tag>
            </Space>
            <Paragraph style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              {d.covariance.interpretation.covFL} · {d.covariance.interpretation.covML}
            </Paragraph>
          </Col>
        </Row>
      </Card>
    );
  };

  const renderRisk = () => {
    const sc = model.scenarios;
    return (
      <Card
        title={<span style={{ color: '#fff' }}><SafetyCertificateOutlined /> 风险度量 · VaR / CVaR / 压力情景</span>}
        style={{ marginBottom: 24, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>95% 历史 VaR</span>}
              value={model.var95 ? model.var95.varAmount.toFixed(0) : '—'} prefix="¥"
              valueStyle={{ color: '#ef4444', fontSize: 22 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>{model.var95 ? `收益率 ${(model.var95.varReturn * 100).toFixed(2)}% · 样本 ${model.var95.sampleSize}` : '样本不足'}</Text>
          </Col>
          <Col xs={12} md={6}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>95% CVaR（尾部均值）</span>}
              value={model.cvar95 ? model.cvar95.cvarReturn.toFixed(3) : '—'} suffix="%"
              valueStyle={{ color: '#fb7185', fontSize: 22 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>{model.cvar95 ? `尾部 ${model.cvar95.tailSize} 个样本 · 最大损失 ${(model.cvar95.tailMax * 100).toFixed(1)}%` : '样本不足'}</Text>
          </Col>
          <Col xs={24} md={12}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>压力情景（基准 → 不利 → 严重）置信度 {(sc.confidence * 100).toFixed(0)}% · z={sc.zScore.toFixed(2)}</Text>
            <Row gutter={[8, 8]}>
              {sc.scenarios && sc.scenarios.map(s => (
                <Col xs={8} key={s.情景}>
                  <div style={{ padding: 10, borderRadius: 8, background: s.情景.includes('严重') ? 'rgba(239,68,68,0.12)' : s.情景.includes('不利') ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{s.情景} · VaR</Text>
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>
                      ¥{s.VaR_金额.toFixed(0)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{s.VaR_收益率} · 损失 ¥{s.期望损失_金额.toFixed(0)}</Text>
                  </div>
                </Col>
              ))}
            </Row>
          </Col>
        </Row>
        <Divider style={{ borderColor: 'rgba(139,92,246,0.2)', margin: '16px 0' }} />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>3×3 三因子协方差矩阵</Text>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ color: 'rgba(255,255,255,0.5)', padding: 4, border: '1px solid rgba(139,92,246,0.2)' }}></th>
              {['R_f', 'R_m', 'R_l'].map(h => (
                <th key={h} style={{ color: 'rgba(255,255,255,0.5)', padding: 4, border: '1px solid rgba(139,92,246,0.2)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.covariance.matrix.map((row, ri) => (
              <tr key={ri}>
                <td style={{ color: 'rgba(255,255,255,0.5)', padding: 4, border: '1px solid rgba(139,92,246,0.2)' }}>{['R_f', 'R_m', 'R_l'][ri]}</td>
                {row.map((v, ci) => (
                  <td key={ci} style={{ color: '#fff', padding: 4, border: '1px solid rgba(139,92,246,0.2)', textAlign: 'center' }}>{v.toFixed(4)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  };

  const renderValuation = () => {
    const cv = model.xval;
    return (
      <Card
        title={<span style={{ color: '#fff' }}><RiseOutlined /> 估值分析 · APV / 最优资本结构 / 三方法互验</span>}
        style={{ marginBottom: 24, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>APV 分解（调整现值法）· 源：{model.name} 基本面</Text>
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Row justify="space-between"><Text type="secondary">无杠杆价值</Text><Text style={{ color: '#22d3ee', fontWeight: 600 }}>¥{model.apv.unleveredValue.toFixed(0)}</Text></Row>
                <Row justify="space-between"><Text type="secondary">税盾现值</Text><Text style={{ color: '#10b981', fontWeight: 600 }}>+¥{model.apv.taxShieldPV.toFixed(0)}</Text></Row>
                <Row justify="space-between"><Text type="secondary">困境成本</Text><Text style={{ color: '#ef4444', fontWeight: 600 }}>-¥{model.apv.distressCostPV.toFixed(0)}</Text></Row>
                <Divider style={{ margin: '6px 0', borderColor: 'rgba(139,92,246,0.2)' }} />
                <Row justify="space-between"><Text style={{ color: '#fff' }}>杠杆价值</Text><Text style={{ color: '#a78bfa', fontWeight: 700, fontSize: 16 }}>¥{model.apv.leveredValue.toFixed(0)}</Text></Row>
              </Space>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>最优资本结构</Text>
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>最优杠杆率 D/V</span>}
                value={`${(model.optCap.optimalLeverage * 100).toFixed(1)}%`}
                valueStyle={{ color: '#a78bfa', fontSize: 24 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>企业价值 ¥{model.optCap.optimalValue.toFixed(0)} · 债务 ¥{model.optCap.optimalD.toFixed(0)}</Text>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>三方法互验一致性</Text>
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Row justify="space-between"><Text type="secondary">WACC 全折现</Text><Text style={{ color: '#fff' }}>¥{cv.waccValue.toFixed(0)}</Text></Row>
                <Row justify="space-between"><Text type="secondary">APV</Text><Text style={{ color: '#fff' }}>¥{cv.apvValue.toFixed(0)}</Text></Row>
                <Row justify="space-between"><Text type="secondary">FTE 股权折现</Text><Text style={{ color: '#fff' }}>¥{cv.fteValue.toFixed(0)}</Text></Row>
              </Space>
              <Tag color={cv.consistency ? 'green' : 'red'} style={{ marginTop: 8 }}>
                {cv.consistency ? '✓ 三方法一致' : '✗ 存在偏差'}
              </Tag>
              <Paragraph style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '6px 0 0' }}>{cv.verdict}</Paragraph>
            </div>
          </Col>
        </Row>
      </Card>
    );
  };

  const renderProfile = () => {
    const assetCols = [
      { title: '资产', dataIndex: 'name', key: 'name', render: v => <Text style={{ color: '#fff' }}>{v}</Text> },
      { title: '综合匹配', dataIndex: 'overall', key: 'overall', render: v => <Text style={{ color: '#a78bfa', fontWeight: 600 }}>{(v * 100).toFixed(1)}%</Text> },
      { title: '余弦', dataIndex: 'cosine', key: 'cosine', render: v => <Text type="secondary">{(v * 100).toFixed(1)}%</Text> },
    ];
    const assetRows = model.assetMatches.slice(0, 5).map(a => ({
      key: a.ticker || a.name,
      name: a.name || a.ticker,
      overall: a.match.overall,
      cosine: a.match.cosine,
    }));
    return (
      <Card
        title={<span style={{ color: '#fff' }}><TeamOutlined /> 画像匹配 · 投资人 / 资产向量（真实估值）</span>}
        style={{ marginBottom: 24, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} lg={10}>
            <Space align="center" style={{ marginBottom: 8 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
                最佳投资人：{model.best?.investor?.name || '—'}
              </Text>
              <Tag color={model.best?.similarity >= 70 ? 'green' : model.best?.similarity >= 50 ? 'gold' : 'red'} style={{ fontSize: 13 }}>
                {model.best?.similarity}% 匹配 · {model.best?.tier?.label}
              </Tag>
            </Space>
            <ReactECharts option={radarOpt} style={{ height: 260 }} notMerge />
          </Col>
          <Col xs={24} lg={14}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>资产向量匹配 Top 5（11 维向量 · 余弦 + 距离）</Text>
            <Table
              size="small"
              columns={assetCols}
              dataSource={assetRows}
              pagination={false}
              rowKey="key"
              style={{ marginBottom: 16 }}
              className="ib-asset-table"
            />
            <ReactECharts option={assetBarOpt} style={{ height: 200 }} notMerge />
          </Col>
        </Row>
      </Card>
    );
  };

  const renderCalibration = () => {
    const cal = model.calibration;
    return (
      <Card
        title={<span style={{ color: '#fff' }}><StockOutlined /> 情绪校准层 · Y.Mine 人格联动</span>}
        style={{ marginBottom: 24, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={12} md={4}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>风险偏好偏移</span>}
              value={cal.riskAppetiteShift > 0 ? `+${cal.riskAppetiteShift.toFixed(2)}` : cal.riskAppetiteShift.toFixed(2)}
              valueStyle={{ color: cal.riskAppetiteShift >= 0 ? '#10b981' : '#22d3ee', fontSize: 22 }} />
            <Text type="secondary" style={{ fontSize: 11 }}>{cal.riskAppetiteTier || '谨慎'}</Text>
          </Col>
          <Col xs={12} md={4}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>置信度乘数</span>}
              value={`×${cal.confidenceMultiplier.toFixed(2)}`}
              valueStyle={{ color: '#a78bfa', fontSize: 22 }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>风险偏好等级</span>}
              value={model.userData.riskTolerance} suffix="/100"
              valueStyle={{ color: model.userData.riskTolerance >= 60 ? '#10b981' : '#f59e0b', fontSize: 22 }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>执行纪律</span>}
              value={model.userData.executionDiscipline} suffix="/100"
              valueStyle={{ color: '#34d399', fontSize: 22 }} />
          </Col>
          <Col xs={12} md={4}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>凯利偏差</span>}
              value={model.userData.kellyDeviation.toFixed(2)}
              valueStyle={{ color: Math.abs(model.userData.kellyDeviation) > 1 ? '#ef4444' : '#10b981', fontSize: 22 }} />
          </Col>
        </Row>
        <Divider style={{ borderColor: 'rgba(139,92,246,0.2)', margin: '16px 0' }} />
        <Alert
          type="info"
          showIcon
          message="数据通路"
          description={`行情源：${status.source} · 当前标的 ${model.symbol} ${model.name}（现价 ¥${model.price.toFixed(2)}）· 历史样本 ${model.history.length} 条 · 行为源：德州 ${(model.userData.pokerGames || []).length} 局 / 台球 ${(model.userData.billiardsSessions || []).length} 场 / 健身 ${(model.userData.fitnessSessions || []).length} 次 / 调酒 ${(model.userData.bartenderSessions || []).length} 次 → 投资人匹配引擎聚合 → 决策中枢校准`}
          style={{ fontSize: 12 }}
        />
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px 0', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ color: '#fff', margin: 0 }}>
          <FundOutlined style={{ marginRight: 12 }} />
          投行级金融数据看板
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8, fontSize: 14 }}>
          决策中枢 · 风险度量 · 估值分析 · 画像匹配 · 情绪校准 —— 后端真实行情全链路驱动
        </Paragraph>
        <Space wrap style={{ marginTop: 8 }}>
          <Select
            value={status.symbol}
            style={{ width: 200 }}
            options={SYMBOL_OPTIONS}
            onChange={(v) => loadRealData(v)}
            disabled={status.loading}
          />
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={status.loading}
            onClick={() => loadRealData(status.symbol)}
          >
            刷新实时数据
          </Button>
          {status.loading && <Spin size="small" style={{ marginLeft: 4 }} />}
          {status.error && <Tag color="red">加载失败：{status.error}</Tag>}
        </Space>
      </div>
      {renderOverview()}
      {renderDecisionHub()}
      <Row gutter={[24, 0]}>
        <Col xs={24} lg={12}>{renderRisk()}</Col>
        <Col xs={24} lg={12}>{renderValuation()}</Col>
      </Row>
      {renderProfile()}
      {renderCalibration()}
    </div>
  );
};

export default InvestBankDashboardPage;