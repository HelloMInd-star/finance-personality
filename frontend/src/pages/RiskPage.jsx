/**
 * 风险压力测试实验室 · Risk Stress Test Lab
 *
 * 基于 riskStressTest.js 的可视化页面
 * 五大模块：VaR分布对比 / 情景分析 / 敏感性热力图 / 反向压力测试 / 信用&流动性
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, Tabs, Row, Col, Space, InputNumber, Button, Slider, Divider, Tag, Table, Tooltip, Input } from 'antd';
import {
  SafetyCertificateOutlined, ThunderboltOutlined, ExperimentOutlined,
  AlertOutlined, BankOutlined, CalculatorOutlined, PlayCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined, FireOutlined, DotChartOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import { PageHeader, StatCard } from '../components/Common';
import {
  computeHistoricalVaR, computeMonteCarloVaR, computeCVaR,
  scenarioAnalysis, sensitivityAnalysis, reverseStressTest,
  creditRisk, liquidityRisk,
} from '../utils/riskStressTest';
import { computeVaR } from '../utils/quantEngine';
import { logger } from '../utils/logger';
import './RiskPage.css';

// ============================================================
// 默认数据
// ============================================================
const DEFAULT_RETURNS = Array.from({ length: 250 }, () => {
  // 模拟日收益率：均值 0.0003，波动 0.015
  const u = Math.random(), v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return 0.0003 + 0.015 * z;
});

const DEFAULT_MC = {
  currentPrice: 100,
  mu: 0.08,
  sigma: 0.3,
  horizon: 1,
  confidence: 0.95,
  paths: 5000,
  shares: 100,
};

const DEFAULT_SCENARIO = {
  confidence: 0.95,
  baseCase: { return: 0.08, volatility: 0.15, portfolioValue: 100000 },
  adverse: { return: -0.05, volatility: 0.25, portfolioValue: 100000 },
  severe: { return: -0.15, volatility: 0.40, portfolioValue: 100000 },
};

const DEFAULT_SENS = {
  baseValue: 100000,
  factors: [
    { name: '利率', shock: 0.01, sensitivity: -2.5, maxShock: 0.03 },
    { name: '汇率', shock: 0.05, sensitivity: 1.2, maxShock: 0.15 },
    { name: '股价', shock: -0.10, sensitivity: 0.8, maxShock: 0.30 },
    { name: '信用利差', shock: 0.02, sensitivity: -1.5, maxShock: 0.05 },
    { name: '波动率', shock: 0.05, sensitivity: -0.6, maxShock: 0.20 },
  ],
};

const DEFAULT_REVERSE = {
  targetLoss: 30000,
  portfolioValue: 100000,
  factors: [
    { name: '利率', sensitivity: -2.5, maxShock: 0.05 },
    { name: '汇率', sensitivity: 1.2, maxShock: 0.20 },
    { name: '股价', sensitivity: 0.8, maxShock: 0.40 },
    { name: '信用利差', sensitivity: -1.5, maxShock: 0.08 },
  ],
};

const DEFAULT_CREDIT = {
  PD: 0.02,
  LGD: 0.45,
  EAD: 1000000,
  maturity: 1,
};

const DEFAULT_LIQUIDITY = {
  hqla: 500000,
  netCashOutflow: 400000,
  availableStableFunding: 800000,
  requiredStableFunding: 750000,
};

// ============================================================
// 工具
// ============================================================
const fmt = (v, d = 2) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(d) : '-');
const fmtPct = (v, d = 2) => (typeof v === 'number' && !isNaN(v) ? `${(v * 100).toFixed(d)}%` : '-');

let themeRegistered = false;
function ensureTheme() {
  if (themeRegistered || !echarts.registerTheme) return;
  echarts.registerTheme('ymine-dark', {
    backgroundColor: 'transparent',
    textStyle: { color: 'rgba(255,255,255,0.85)' },
    legend: { textStyle: { color: 'rgba(255,255,255,0.7)' } },
    categoryAxis: {
      axisLine: { lineStyle: { color: 'rgba(168,85,247,0.3)' } },
      axisLabel: { color: 'rgba(255,255,255,0.6)' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: 'rgba(168,85,247,0.3)' } },
      axisLabel: { color: 'rgba(255,255,255,0.6)' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    tooltip: {
      backgroundColor: 'rgba(30,19,64,0.95)',
      borderColor: 'rgba(168,85,247,0.4)',
      textStyle: { color: '#fff' },
    },
  });
  themeRegistered = true;
}

function useChart(optionBuilder, deps) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ensureTheme();
    if (!chartRef.current) chartRef.current = echarts.init(ref.current, 'ymine-dark');
    const opt = optionBuilder();
    if (opt) chartRef.current.setOption(opt, true);
    const handleResize = () => chartRef.current && chartRef.current.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

function ParamRow({ label, value, onChange, min, max, step, suffix, tooltip }) {
  return (
    <div className="risk-param-row">
      <span className="risk-param-label">{tooltip ? <Tooltip title={tooltip}>{label}</Tooltip> : label}</span>
      <InputNumber size="small" value={value} min={min} max={max} step={step} onChange={onChange}
        style={{ width: 120 }}
        formatter={suffix ? (v) => (v !== null && v !== undefined ? `${v}${suffix}` : '') : undefined}
        parser={suffix ? (v) => v.replace(suffix, '') : undefined}
      />
    </div>
  );
}

// ============================================================
// Tab 1: VaR 分布对比
// ============================================================
function VaRTab() {
  const [returns, setReturns] = useState(DEFAULT_RETURNS);
  const [mcParams, setMcParams] = useState(DEFAULT_MC);
  const [confidence, setConfidence] = useState(0.95);
  const updateMc = (k) => (v) => setMcParams((p) => ({ ...p, [k]: v }));

  const paramVaR = useMemo(() => {
    const mu = returns.reduce((a, b) => a + b, 0) / returns.length * 252;
    const sigma = Math.sqrt(returns.reduce((a, b) => a + (b - mu / 252) ** 2, 0) / returns.length) * Math.sqrt(252);
    return { mu, sigma, var: computeVaR(mu, sigma, confidence) };
  }, [returns, confidence]);

  const histVaR = useMemo(() => computeHistoricalVaR(returns, confidence, mcParams.currentPrice * mcParams.shares), [returns, confidence, mcParams]);
  const mcVaR = useMemo(() => computeMonteCarloVaR({ ...mcParams, confidence }), [mcParams, confidence]);
  const cvar = useMemo(() => computeCVaR(returns, confidence), [returns, confidence]);

  const chartRef = useChart(() => {
    if (!mcVaR) return null;
    // 构造终端价格分布直方图
    const prices = mcVaR.terminalPrices;
    const min = Math.min(...prices), max = Math.max(...prices);
    const bins = 40;
    const binSize = (max - min) / bins;
    const histogram = new Array(bins).fill(0);
    prices.forEach((p) => {
      const idx = Math.min(bins - 1, Math.floor((p - min) / binSize));
      histogram[idx]++;
    });
    const xData = histogram.map((_, i) => (min + i * binSize).toFixed(1));

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['价格分布', 'VaR阈值'], top: 10 },
      grid: { left: '8%', right: '5%', bottom: '10%', top: '20%' },
      xAxis: { type: 'category', data: xData, name: '终端价格' },
      yAxis: [
        { type: 'value', name: '频次' },
      ],
      series: [
        {
          name: '价格分布',
          type: 'bar',
          data: histogram,
          itemStyle: { color: 'rgba(168,85,247,0.6)' },
        },
        {
          name: 'VaR阈值',
          type: 'line',
          data: xData.map((x) => {
            const v = parseFloat(x);
            return v <= mcVaR.varPrice ? mcVaR.varPrice : null;
          }),
          markLine: {
            data: [{ xAxis: mcVaR.varPrice.toFixed(1) }],
            lineStyle: { color: '#ef4444', type: 'dashed' },
            label: { formatter: `VaR: ${mcVaR.varPrice.toFixed(2)}`, color: '#ef4444' },
          },
          itemStyle: { color: '#ef4444' },
        },
      ],
    };
  }, [mcVaR]);

  return (
    <Row gutter={20} className="risk-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card risk-param-card" title={<Space><CalculatorOutlined /> 参数面板</Space>} size="small">
          <ParamRow label="置信度" value={confidence} onChange={setConfidence} min={0.9} max={0.999} step={0.01} tooltip="巴塞尔III要求99%" />
          <Divider style={{ margin: '8px 0' }} />
          <ParamRow label="当前价格 S₀" value={mcParams.currentPrice} onChange={updateMc('currentPrice')} min={1} step={5} />
          <ParamRow label="年化漂移 μ" value={mcParams.mu} onChange={updateMc('mu')} min={-0.5} max={0.5} step={0.01} suffix="" />
          <ParamRow label="年化波动 σ" value={mcParams.sigma} onChange={updateMc('sigma')} min={0.01} max={3} step={0.05} suffix="" />
          <ParamRow label="持有期(天)" value={mcParams.horizon} onChange={updateMc('horizon')} min={1} max={30} step={1} />
          <ParamRow label="模拟路径数" value={mcParams.paths} onChange={updateMc('paths')} min={1000} max={20000} step={1000} />
          <ParamRow label="持有股数" value={mcParams.shares} onChange={updateMc('shares')} min={1} step={10} />
          <Divider style={{ margin: '8px 0' }} />
          <div className="risk-formula-hint">
            <div>参数法: VaR = μ - Z·σ</div>
            <div>历史法: VaR = -percentile(1-α)</div>
            <div>蒙特卡洛: 模拟路径取分位</div>
            <div>CVaR = E[Loss | {'Loss > VaR'}]</div>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={12}>
            <Col span={6}><StatCard icon="📊" value={fmtPct(-paramVaR.var, 2)} label="参数法 VaR" color="purple" /></Col>
            <Col span={6}><StatCard icon="📈" value={fmtPct(-histVaR?.varReturn, 2)} label="历史法 VaR" color="blue" /></Col>
            <Col span={6}><StatCard icon="🎲" value={fmtPct(-mcVaR?.varReturn, 2)} label="蒙特卡洛 VaR" color="gold" /></Col>
            <Col span={6}><StatCard icon="⚠️" value={fmtPct(-cvar?.cvarReturn, 2)} label="CVaR (ES)" color="pink" /></Col>
          </Row>
          <Card className="glass-card" title="蒙特卡洛终端价格分布 + VaR 阈值" size="small">
            <div ref={chartRef} style={{ width: '100%', height: 340 }} />
          </Card>
          <Card className="glass-card" size="small">
            <Table
              dataSource={[
                { key: '1', method: '参数法', var: fmtPct(-paramVaR.var, 3), desc: 'μ - Z·σ，假设正态分布' },
                { key: '2', method: '历史模拟法', var: fmtPct(-histVaR?.varReturn, 3), desc: `基于${histVaR?.sampleSize}个历史样本` },
                { key: '3', method: '蒙特卡洛法', var: fmtPct(-mcVaR?.varReturn, 3), desc: `${mcVaR?.pathCount}条GBM路径` },
                { key: '4', method: 'CVaR (ES)', var: fmtPct(-cvar?.cvarReturn, 3), desc: `尾部${cvar?.tailSize}个样本均值` },
              ]}
              pagination={false}
              size="small"
              columns={[
                { title: '方法', dataIndex: 'method', key: 'method', width: 120 },
                { title: 'VaR', dataIndex: 'var', key: 'var', render: (v) => <span style={{ color: '#fbbf24', fontWeight: 600 }}>{v}</span> },
                { title: '说明', dataIndex: 'desc', key: 'desc' },
              ]}
            />
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

// ============================================================
// Tab 2: 情景分析
// ============================================================
function ScenarioTab() {
  const [params, setParams] = useState(DEFAULT_SCENARIO);
  const update = (scenario, k) => (v) => setParams((p) => ({ ...p, [scenario]: { ...p[scenario], [k]: v } }));

  const result = useMemo(() => scenarioAnalysis(params), [params]);

  const chartRef = useChart(() => {
    if (!result) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['期望损失', 'VaR'], top: 10 },
      grid: { left: '8%', right: '5%', bottom: '10%', top: '20%' },
      xAxis: { type: 'category', data: result.scenarios.map((s) => s.情景) },
      yAxis: { type: 'value', name: '金额' },
      series: [
        { name: '期望损失', type: 'bar', data: result.scenarios.map((s) => s.期望损失_金额), itemStyle: { color: '#a855f7' } },
        { name: 'VaR', type: 'bar', data: result.scenarios.map((s) => s.VaR_金额), itemStyle: { color: '#ef4444' } },
      ],
    };
  }, [result]);

  return (
    <Row gutter={20} className="risk-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card risk-param-card" title={<Space><CalculatorOutlined /> 三档情景参数</Space>} size="small">
          <ParamRow label="置信度" value={params.confidence} onChange={(v) => setParams((p) => ({ ...p, confidence: v }))} min={0.9} max={0.999} step={0.01} />
          <Divider style={{ margin: '8px 0' }} />
          <div className="scenario-group">
            <Tag color="green">基准</Tag>
            <ParamRow label="收益率" value={params.baseCase.return} onChange={update('baseCase', 'return')} min={-0.5} max={0.5} step={0.01} />
            <ParamRow label="波动率" value={params.baseCase.volatility} onChange={update('baseCase', 'volatility')} min={0.01} max={1} step={0.05} />
            <ParamRow label="组合价值" value={params.baseCase.portfolioValue} onChange={update('baseCase', 'portfolioValue')} min={1000} step={10000} />
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div className="scenario-group">
            <Tag color="orange">不利</Tag>
            <ParamRow label="收益率" value={params.adverse.return} onChange={update('adverse', 'return')} min={-0.5} max={0.5} step={0.01} />
            <ParamRow label="波动率" value={params.adverse.volatility} onChange={update('adverse', 'volatility')} min={0.01} max={1} step={0.05} />
            <ParamRow label="组合价值" value={params.adverse.portfolioValue} onChange={update('adverse', 'portfolioValue')} min={1000} step={10000} />
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div className="scenario-group">
            <Tag color="red">严重</Tag>
            <ParamRow label="收益率" value={params.severe.return} onChange={update('severe', 'return')} min={-0.5} max={0.5} step={0.01} />
            <ParamRow label="波动率" value={params.severe.volatility} onChange={update('severe', 'volatility')} min={0.01} max={1} step={0.05} />
            <ParamRow label="组合价值" value={params.severe.portfolioValue} onChange={update('severe', 'portfolioValue')} min={1000} step={10000} />
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={12}>
            <Col span={8}><StatCard icon="🟢" value={fmt(params.baseCase.portfolioValue, 0)} label="基准组合价值" color="green" /></Col>
            <Col span={8}><StatCard icon="🟠" value={fmt(result?.adverseIncrement, 0)} label="不利情景损失增量" color="gold" /></Col>
            <Col span={8}><StatCard icon="🔴" value={fmt(result?.severeIncrement, 0)} label="严重情景损失增量" color="pink" /></Col>
          </Row>
          <Card className="glass-card" title="三档情景损失对比" size="small">
            <div ref={chartRef} style={{ width: '100%', height: 300 }} />
          </Card>
          <Card className="glass-card" size="small">
            <Table
              dataSource={result?.scenarios || []}
              pagination={false}
              size="small"
              rowKey="情景"
              columns={[
                { title: '情景', dataIndex: '情景', key: '情景', width: 80, render: (v) => {
                  const map = { 基准: 'green', 不利: 'orange', 严重: 'red' };
                  return <Tag color={map[v]}>{v}</Tag>;
                } },
                { title: '收益率', dataIndex: '假设收益_μ', key: '假设收益_μ' },
                { title: '波动率', dataIndex: '假设波动_σ', key: '假设波动_σ' },
                { title: '期望损失', dataIndex: '期望损失_金额', key: '期望损失_金额', render: (v) => <span style={{ color: '#ef4444' }}>{v}</span> },
                { title: 'VaR', dataIndex: 'VaR_金额', key: 'VaR_金额', render: (v) => <span style={{ color: '#fbbf24', fontWeight: 600 }}>{v}</span> },
              ]}
            />
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

// ============================================================
// Tab 3: 敏感性分析
// ============================================================
function SensitivityTab() {
  const [params, setParams] = useState(DEFAULT_SENS);
  const updateBase = (v) => setParams((p) => ({ ...p, baseValue: v }));
  const updateFactor = (idx, k) => (v) => setParams((p) => ({
    ...p,
    factors: p.factors.map((f, i) => (i === idx ? { ...f, [k]: v } : f)),
  }));

  const result = useMemo(() => sensitivityAnalysis(params), [params]);

  const chartRef = useChart(() => {
    if (!result) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { top: 10 },
      grid: { left: '8%', right: '5%', bottom: '10%', top: '20%' },
      xAxis: { type: 'category', data: result.results.map((r) => r.因子) },
      yAxis: { type: 'value', name: '影响金额' },
      series: [{
        type: 'bar',
        data: result.results.map((r) => ({
          value: r.影响金额,
          itemStyle: { color: r.影响金额 >= 0 ? '#10b981' : '#ef4444' },
        })),
        label: { show: true, position: 'top', formatter: (p) => fmt(p.value, 0), color: '#fff' },
      }],
    };
  }, [result]);

  return (
    <Row gutter={20} className="risk-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card risk-param-card" title={<Space><CalculatorOutlined /> 因子参数</Space>} size="small">
          <ParamRow label="基准组合价值" value={params.baseValue} onChange={updateBase} min={1000} step={10000} />
          <Divider style={{ margin: '8px 0' }} />
          {params.factors.map((f, idx) => (
            <div key={idx} className="factor-group">
              <div className="factor-name">{f.name}</div>
              <ParamRow label="扰动量" value={f.shock} onChange={updateFactor(idx, 'shock')} min={-0.5} max={0.5} step={0.01} />
              <ParamRow label="敏感度" value={f.sensitivity} onChange={updateFactor(idx, 'sensitivity')} min={-5} max={5} step={0.1} />
            </div>
          ))}
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={12}>
            <Col span={8}><StatCard icon="💰" value={fmt(params.baseValue, 0)} label="基准价值" color="purple" /></Col>
            <Col span={8}><StatCard icon="⚡" value={result?.maxFactor || '-'} label="最大影响因子" color="gold" /></Col>
            <Col span={8}><StatCard icon="📉" value={fmt(result?.maxImpact, 0)} label="最大影响金额" color="pink" /></Col>
          </Row>
          <Card className="glass-card" title="各因子影响金额" size="small">
            <div ref={chartRef} style={{ width: '100%', height: 300 }} />
          </Card>
          <Card className="glass-card" size="small">
            <Table
              dataSource={result?.results || []}
              pagination={false}
              size="small"
              rowKey="因子"
              columns={[
                { title: '因子', dataIndex: '因子', key: '因子', width: 100 },
                { title: '扰动量', dataIndex: '扰动量_显示', key: '扰动量_显示' },
                { title: '影响金额', dataIndex: '影响金额', key: '影响金额', render: (v) => <span style={{ color: v >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{v}</span> },
                { title: '影响比例', dataIndex: '影响比例', key: '影响比例' },
                { title: '新价值', dataIndex: '新组合价值', key: '新组合价值' },
              ]}
            />
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

// ============================================================
// Tab 4: 反向压力测试
// ============================================================
function ReverseTab() {
  const [params, setParams] = useState(DEFAULT_REVERSE);
  const update = (k) => (v) => setParams((p) => ({ ...p, [k]: v }));

  const result = useMemo(() => reverseStressTest(params), [params]);

  const chartRef = useChart(() => {
    if (!result) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['所需扰动', '最大可承受扰动'], top: 10 },
      grid: { left: '8%', right: '5%', bottom: '10%', top: '20%' },
      xAxis: { type: 'category', data: result.triggers.map((t) => t.因子) },
      yAxis: { type: 'value', name: '扰动幅度' },
      series: [
        { name: '所需扰动', type: 'bar', data: result.triggers.map((t) => t.所需扰动), itemStyle: { color: '#ef4444' } },
        { name: '最大可承受扰动', type: 'bar', data: result.triggers.map((t) => t.最大可承受扰动), itemStyle: { color: '#3b82f6' } },
      ],
    };
  }, [result]);

  return (
    <Row gutter={20} className="risk-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card risk-param-card" title={<Space><CalculatorOutlined /> 参数面板</Space>} size="small">
          <ParamRow label="目标损失" value={params.targetLoss} onChange={update('targetLoss')} min={1000} step={5000} />
          <ParamRow label="组合价值" value={params.portfolioValue} onChange={update('portfolioValue')} min={1000} step={10000} />
          <Divider style={{ margin: '8px 0' }} />
          <div className="risk-formula-hint">
            <div>反向压力测试：从损失反推触发情景</div>
            <div>所需扰动 = 目标损失 / (敏感度 × 组合价值)</div>
            <div>若 |所需扰动| ≤ 最大可承受扰动 → 可触发</div>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={12}>
            <Col span={8}><StatCard icon="🎯" value={fmt(params.targetLoss, 0)} label="目标损失" color="pink" /></Col>
            <Col span={8}><StatCard icon="💀" value={fmt(result?.survivalLoss, 0)} label="联合最大损失" color="gold" /></Col>
            <Col span={8}><StatCard icon="🛡️" value={result?.survivalLoss >= params.targetLoss ? '可触发' : '不可触发'} label="判定结果" color={result?.survivalLoss >= params.targetLoss ? 'pink' : 'green'} /></Col>
          </Row>
          <Card className="glass-card" title="各因子所需扰动 vs 最大可承受扰动" size="small">
            <div ref={chartRef} style={{ width: '100%', height: 300 }} />
          </Card>
          {result && (
            <Card className="glass-card" size="small">
              <div className={`reverse-verdict ${result.survivalLoss >= params.targetLoss ? 'triggered' : 'safe'}`}>
                <AlertOutlined style={{ marginRight: 8 }} />
                {result.verdict}
              </div>
            </Card>
          )}
          <Card className="glass-card" size="small">
            <Table
              dataSource={result?.triggers || []}
              pagination={false}
              size="small"
              rowKey="因子"
              columns={[
                { title: '因子', dataIndex: '因子', key: '因子', width: 100 },
                { title: '所需扰动', dataIndex: '所需扰动_显示', key: '所需扰动_显示' },
                { title: '最大可承受', dataIndex: '最大可承受扰动_显示', key: '最大可承受扰动_显示' },
                { title: '可行性', dataIndex: '是否可行', key: '是否可行', render: (v) => <Tag color={v.includes('✓') ? 'green' : 'red'}>{v}</Tag> },
                { title: '单独最大损失', dataIndex: '单独最大损失', key: '单独最大损失', render: (v) => <span style={{ color: '#fbbf24' }}>{v}</span> },
              ]}
            />
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

// ============================================================
// Tab 5: 信用 & 流动性
// ============================================================
function CreditLiquidityTab() {
  const [creditParams, setCreditParams] = useState(DEFAULT_CREDIT);
  const [liqParams, setLiqParams] = useState(DEFAULT_LIQUIDITY);
  const updateCredit = (k) => (v) => setCreditParams((p) => ({ ...p, [k]: v }));
  const updateLiq = (k) => (v) => setLiqParams((p) => ({ ...p, [k]: v }));

  const creditResult = useMemo(() => creditRisk(creditParams), [creditParams]);
  const liqResult = useMemo(() => liquidityRisk(liqParams), [liqParams]);

  return (
    <Row gutter={20} className="risk-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card risk-param-card" title={<Space><CalculatorOutlined /> 信用风险参数</Space>} size="small">
          <ParamRow label="PD 违约概率" value={creditParams.PD} onChange={updateCredit('PD')} min={0.001} max={1} step={0.01} suffix="" tooltip="Probability of Default" />
          <ParamRow label="LGD 违约损失率" value={creditParams.LGD} onChange={updateCredit('LGD')} min={0} max={1} step={0.05} suffix="" tooltip="Loss Given Default" />
          <ParamRow label="EAD 风险暴露" value={creditParams.EAD} onChange={updateCredit('EAD')} min={10000} step={100000} tooltip="Exposure at Default" />
          <ParamRow label="期限(年)" value={creditParams.maturity} onChange={updateCredit('maturity')} min={0.5} max={5} step={0.5} />
          <Divider style={{ margin: '8px 0' }} />
          <div className="risk-formula-hint">
            <div>EL = PD × LGD × EAD</div>
            <div>UL = EAD × √(PD×σ²LGD + LGD²×σ²PD)</div>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* 信用风险结果 */}
          <Row gutter={12}>
            <Col span={6}><StatCard icon="📉" value={fmt(creditResult?.expectedLoss, 0)} label="EL 期望损失" color="pink" /></Col>
            <Col span={6}><StatCard icon="⚠️" value={fmt(creditResult?.unexpectedLoss, 0)} label="UL 非预期损失" color="gold" /></Col>
            <Col span={6}><StatCard icon="🏛️" value={fmt(creditResult?.capitalRequirement, 0)} label="监管资本要求" color="purple" /></Col>
            <Col span={6}><StatCard icon="📊" value={creditResult?.breakdown?.资本充足率 || '-'} label="资本充足率" color="blue" /></Col>
          </Row>

          {/* 流动性参数 + 结果 */}
          <Card className="glass-card" title={<Space><BankOutlined /> 流动性风险参数</Space>} size="small">
            <Row gutter={16}>
              <Col span={6}>
                <ParamRow label="HQLA" value={liqParams.hqla} onChange={updateLiq('hqla')} min={0} step={50000} />
              </Col>
              <Col span={6}>
                <ParamRow label="净现金流出" value={liqParams.netCashOutflow} onChange={updateLiq('netCashOutflow')} min={1} step={50000} />
              </Col>
              <Col span={6}>
                <ParamRow label="可用稳定资金" value={liqParams.availableStableFunding} onChange={updateLiq('availableStableFunding')} min={0} step={50000} />
              </Col>
              <Col span={6}>
                <ParamRow label="所需稳定资金" value={liqParams.requiredStableFunding} onChange={updateLiq('requiredStableFunding')} min={1} step={50000} />
              </Col>
            </Row>
          </Card>

          <Row gutter={12}>
            <Col span={12}>
              <Card className="glass-card" size="small">
                <div className={`liq-status ${liqResult?.LCR >= 1 ? 'pass' : 'fail'}`}>
                  <div className="liq-label">LCR 流动性覆盖率</div>
                  <div className="liq-value">{fmtPct(liqResult?.LCR)}</div>
                  <div className="liq-status-text">{liqResult?.lcrStatus}</div>
                  <div className="liq-req">监管要求 ≥ 100%</div>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card className="glass-card" size="small">
                <div className={`liq-status ${liqResult?.NSFR >= 1 ? 'pass' : 'fail'}`}>
                  <div className="liq-label">NSFR 净稳定资金比率</div>
                  <div className="liq-value">{fmtPct(liqResult?.NSFR)}</div>
                  <div className="liq-status-text">{liqResult?.nsfrStatus}</div>
                  <div className="liq-req">监管要求 ≥ 100%</div>
                </div>
              </Card>
            </Col>
          </Row>
        </Space>
      </Col>
    </Row>
  );
}

// ============================================================
// 主页面
// ============================================================
const RiskPage = () => {
  const [tabKey, setTabKey] = useState('var');

  useEffect(() => {
    logger.session('[RiskPage] 页面加载', { tab: tabKey });
  }, [tabKey]);

  return (
    <div className="risk-page">
      <PageHeader
        icon={<SafetyCertificateOutlined />}
        title="风险压力测试实验室"
        desc="Risk Stress Test Lab · 巴塞尔III兼容 · VaR/CVaR/情景/敏感性/反向压力/信用/流动性"
        extra={<Tag color="red">机构级 v1.0</Tag>}
      />

      <Card className="glass-card risk-tabs-card" styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={tabKey}
          onChange={setTabKey}
          tabBarStyle={{ padding: '0 20px', borderBottom: '1px solid rgba(168,85,247,0.15)', margin: 0 }}
          items={[
            { key: 'var', label: <Space><DotChartOutlined /> VaR 分布对比</Space>, children: <VaRTab /> },
            { key: 'scenario', label: <Space><ThunderboltOutlined /> 情景分析</Space>, children: <ScenarioTab /> },
            { key: 'sensitivity', label: <Space><ExperimentOutlined /> 敏感性分析</Space>, children: <SensitivityTab /> },
            { key: 'reverse', label: <Space><FireOutlined /> 反向压力测试</Space>, children: <ReverseTab /> },
            { key: 'credit', label: <Space><BankOutlined /> 信用&流动性</Space>, children: <CreditLiquidityTab /> },
          ]}
        />
      </Card>
    </div>
  );
};

export default RiskPage;
