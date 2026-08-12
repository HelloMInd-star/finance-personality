/**
 * 公司理财实验室 · Capital Structure Lab
 *
 * 基于 corporateFinance.js 引擎的可视化页面
 * 六大模块：APV / FTE / MM定理 / 资本结构优化 / 并购估值 / 三方法互验
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, Tabs, Row, Col, Space, InputNumber, Input, Button, Slider, Divider, Tag, Table, Tooltip, Empty } from 'antd';
import {
  DollarOutlined, ApartmentOutlined, AccountBookOutlined, MergeCellsOutlined,
  AuditOutlined, CalculatorOutlined, ThunderboltOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import { PageHeader, StatCard } from '../components/Common';
import {
  computeAPV, computeFTE, computeMMProposition,
  optimalCapitalStructure, dividendPolicy, mergerValuation,
  crossValidateValuation,
} from '../utils/corporateFinance';
import { logger } from '../utils/logger';
import { fmt, fmtPct, fmtCompact } from '../utils/formatters';
import './FinancePage.css';

// ============================================================
// 默认参数
// ============================================================
const DEFAULT_APV = {
  unleveredFCFs: [50, 55, 60, 65, 70, 72, 74, 76, 78, 80],
  costOfCapital: 0.12,
  debtAmount: 200,
  costOfDebt: 0.05,
  taxRate: 0.25,
  distressProbability: 0.1,
  distressCostRate: 0.25,
  issueCosts: 0,
};

const DEFAULT_FTE = {
  unleveredFCFs: [50, 55, 60, 65, 70, 72, 74, 76, 78, 80],
  costOfEquity: 0.14,
  debtAmount: 200,
  costOfDebt: 0.05,
  taxRate: 0.25,
};

const DEFAULT_MM = {
  unleveredValue: 500,
  debtValue: 200,
  equityValue: 350,
  costOfCapital: 0.1,
  costOfDebt: 0.05,
  taxRate: 0.25,
};

const DEFAULT_OPT = {
  unleveredValue: 500,
  taxRate: 0.25,
  costOfDebt: 0.05,
  distressCostRate: 0.25,
  baseDistressProbability: 0.05,
  distressSensitivity: 2.0,
  maxLeverage: 0.8,
};

const DEFAULT_MA = {
  acquirerValue: 1000,
  targetValue: 300,
  revenueSynergy: 50,
  costSynergy: 80,
  taxSynergy: 20,
  acquisitionPrice: 360,
  integrationCost: 30,
};

const DEFAULT_CROSS = {
  unleveredFCFs: [50, 55, 60, 65, 70, 72, 74, 76, 78, 80],
  costOfCapital: 0.12,
  costOfEquity: 0.14,
  wacc: 0.095,
  debtAmount: 200,
  costOfDebt: 0.05,
  taxRate: 0.25,
};

// ============================================================
// 工具函数（已迁移到 utils/formatters.js，保留兼容包装）
// ============================================================
const safeArr = (v, def = []) => (Array.isArray(v) ? v : def);

// ============================================================
// ECharts 暗色主题注册（懒加载）
// ============================================================
let themeRegistered = false;
function ensureTheme() {
  if (themeRegistered || !echarts.registerTheme) return;
  echarts.registerTheme('ymine-dark', {
    backgroundColor: 'transparent',
    textStyle: { color: 'rgba(255,255,255,0.85)' },
    title: { textStyle: { color: '#fff' } },
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

// ============================================================
// 通用图表 Hook
// ============================================================
function useChart(optionBuilder, deps) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ensureTheme();
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, 'ymine-dark');
    }
    const opt = optionBuilder();
    if (opt) chartRef.current.setOption(opt, true);
    const handleResize = () => chartRef.current && chartRef.current.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

// ============================================================
// 参数输入组件
// ============================================================
function ParamRow({ label, value, onChange, min, max, step, suffix, tooltip }) {
  return (
    <div className="finance-param-row">
      <span className="finance-param-label">
        {tooltip ? <Tooltip title={tooltip}>{label}</Tooltip> : label}
      </span>
      <InputNumber
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        style={{ width: 110 }}
        formatter={suffix ? (v) => (v !== null && v !== undefined ? `${v}${suffix}` : '') : undefined}
        parser={suffix ? (v) => v.replace(suffix, '') : undefined}
      />
    </div>
  );
}

function FCFInput({ value, onChange }) {
  return (
    <div className="finance-param-row">
      <span className="finance-param-label">FCF 序列 (10年)</span>
      <Input.TextArea
        size="small"
        value={Array.isArray(value) ? value.join(', ') : ''}
        onChange={(e) => {
          const arr = e.target.value
            .split(/[,，\s]+/)
            .map((s) => parseFloat(s))
            .filter((n) => !isNaN(n));
          onChange(arr);
        }}
        rows={2}
        style={{ width: '100%' }}
        placeholder="50, 55, 60, ..."
      />
    </div>
  );
}

// ============================================================
// Tab 1: APV 调整净现值法
// ============================================================
function APVTab() {
  const [params, setParams] = useState(DEFAULT_APV);
  const update = (k) => (v) => setParams((p) => ({ ...p, [k]: v }));
  const result = useMemo(() => {
    try {
      return computeAPV(params);
    } catch (e) {
      logger.error('[FinancePage:APV] 计算失败', e);
      return null;
    }
  }, [params]);

  const chartRef = useChart(() => {
    if (!result) return null;
    return {
      tooltip: { trigger: 'item' },
      legend: { data: ['价值构成'], top: 10 },
      grid: { left: '8%', right: '5%', bottom: '10%', top: '20%' },
      xAxis: { type: 'category', data: ['无杠杆价值 V_U', '税盾现值', '困境成本', '发行成本', '杠杆价值 V_L'] },
      yAxis: { type: 'value', name: '价值' },
      series: [{
        type: 'bar',
        data: [
          { value: result.unleveredValue, itemStyle: { color: '#a855f7' } },
          { value: result.taxShieldPV, itemStyle: { color: '#10b981' } },
          { value: -result.distressCostPV, itemStyle: { color: '#ef4444' } },
          { value: -result.issueCostPV, itemStyle: { color: '#f59e0b' } },
          { value: result.leveredValue, itemStyle: { color: '#fbbf24' } },
        ],
        label: { show: true, position: 'top', formatter: (p) => fmt(p.value, 1), color: '#fff' },
        barWidth: '40%',
      }],
    };
  }, [result]);

  return (
    <Row gutter={20} className="finance-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card finance-param-card" title={<Space><CalculatorOutlined /> 参数面板</Space>} size="small">
          <FCFInput value={params.unleveredFCFs} onChange={update('unleveredFCFs')} />
          <ParamRow label="无杠杆权益成本 K₀" value={params.costOfCapital} onChange={update('costOfCapital')} min={0.01} max={0.5} step={0.01} suffix="%" tooltip="资产必要收益率，不含杠杆效应" />
          <ParamRow label="债务金额 D" value={params.debtAmount} onChange={update('debtAmount')} min={0} step={10} />
          <ParamRow label="债务成本 K_d" value={params.costOfDebt} onChange={update('costOfDebt')} min={0.001} max={0.3} step={0.005} suffix="%" />
          <ParamRow label="税率 T" value={params.taxRate} onChange={update('taxRate')} min={0} max={0.5} step={0.01} suffix="%" />
          <Divider style={{ margin: '8px 0' }} />
          <ParamRow label="困境概率 π" value={params.distressProbability} onChange={update('distressProbability')} min={0} max={1} step={0.05} suffix="" tooltip="企业陷入财务困境的概率" />
          <ParamRow label="困境损失率" value={params.distressCostRate} onChange={update('distressCostRate')} min={0} max={1} step={0.05} tooltip="困境发生时企业价值的损失比例" />
          <ParamRow label="发行成本" value={params.issueCosts} onChange={update('issueCosts')} min={0} step={5} />
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={12}>
            <Col span={6}><StatCard icon="📊" value={fmt(result?.unleveredValue, 1)} label="V_U 无杠杆价值" color="purple" /></Col>
            <Col span={6}><StatCard icon="🛡️" value={fmt(result?.taxShieldPV, 1)} label="税盾现值" color="green" /></Col>
            <Col span={6}><StatCard icon="⚠️" value={fmt(result?.distressCostPV, 1)} label="困境成本" color="pink" /></Col>
            <Col span={6}><StatCard icon="💰" value={fmt(result?.leveredValue, 1)} label="V_L 杠杆价值" color="gold" /></Col>
          </Row>
          <Card className="glass-card" title="APV 价值分解" size="small">
            <div ref={chartRef} style={{ width: '100%', height: 340 }} />
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

// ============================================================
// Tab 2: FTE 权益现金流法
// ============================================================
function FTETab() {
  const [params, setParams] = useState(DEFAULT_FTE);
  const update = (k) => (v) => setParams((p) => ({ ...p, [k]: v }));
  const result = useMemo(() => {
    try {
      return computeFTE(params);
    } catch (e) {
      logger.error('[FinancePage:FTE] 计算失败', e);
      return null;
    }
  }, [params]);

  const chartRef = useChart(() => {
    if (!result || !result.leveredFCFs) return null;
    const years = result.leveredFCFs.map((r) => r.年);
    const fcfSeries = result.leveredFCFs.map((r) => r.无杠杆FCF);
    const lcfSeries = result.leveredFCFs.map((r) => r.杠杆权益现金流_LCF);
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['无杠杆 FCF', '杠杆权益现金流 LCF'], top: 10 },
      grid: { left: '8%', right: '5%', bottom: '10%', top: '20%' },
      xAxis: { type: 'category', data: years },
      yAxis: { type: 'value', name: '现金流' },
      series: [
        { name: '无杠杆 FCF', type: 'bar', data: fcfSeries, itemStyle: { color: '#a855f7' } },
        { name: '杠杆权益现金流 LCF', type: 'bar', data: lcfSeries, itemStyle: { color: '#fbbf24' } },
      ],
    };
  }, [result]);

  return (
    <Row gutter={20} className="finance-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card finance-param-card" title={<Space><CalculatorOutlined /> 参数面板</Space>} size="small">
          <FCFInput value={params.unleveredFCFs} onChange={update('unleveredFCFs')} />
          <ParamRow label="权益成本 K_E" value={params.costOfEquity} onChange={update('costOfEquity')} min={0.01} max={0.5} step={0.01} suffix="%" tooltip="杠杆下的权益成本（CAPM 或 MM 命题II）" />
          <ParamRow label="债务金额 D" value={params.debtAmount} onChange={update('debtAmount')} min={0} step={10} />
          <ParamRow label="债务成本 K_d" value={params.costOfDebt} onChange={update('costOfDebt')} min={0.001} max={0.3} step={0.005} suffix="%" />
          <ParamRow label="税率 T" value={params.taxRate} onChange={update('taxRate')} min={0} max={0.5} step={0.01} suffix="%" />
          <Divider style={{ margin: '8px 0' }} />
          <div className="finance-formula-hint">
            <div>LCF = FCF − D×K_d×(1−T)</div>
            <div>V_E = Σ LCF / (1+K_E)ᵗ</div>
            <div>V_L = V_E + D</div>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={12}>
            <Col span={8}><StatCard icon="💎" value={fmt(result?.equityValue, 1)} label="V_E 权益价值" color="purple" /></Col>
            <Col span={8}><StatCard icon="🏦" value={fmt(params.debtAmount, 1)} label="D 债务价值" color="blue" /></Col>
            <Col span={8}><StatCard icon="💰" value={fmt(result?.leveredValue, 1)} label="V_L 杠杆价值" color="gold" /></Col>
          </Row>
          <Card className="glass-card" title="FCF vs LCF 现金流对比" size="small">
            <div ref={chartRef} style={{ width: '100%', height: 340 }} />
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

// ============================================================
// Tab 3: MM 定理
// ============================================================
function MMTab() {
  const [params, setParams] = useState(DEFAULT_MM);
  const update = (k) => (v) => setParams((p) => ({ ...p, [k]: v }));
  const result = useMemo(() => {
    try {
      return computeMMProposition(params);
    } catch (e) {
      logger.error('[FinancePage:MM] 计算失败', e);
      return null;
    }
  }, [params]);

  const chartRef = useChart(() => {
    if (!result) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['企业价值 V_L'], top: 10 },
      grid: { left: '8%', right: '5%', bottom: '10%', top: '20%' },
      xAxis: { type: 'category', data: ['无杠杆 V_U', '命题I(无税)', '命题I(有税)'] },
      yAxis: { type: 'value', name: '价值' },
      series: [{
        type: 'bar',
        data: [
          { value: params.unleveredValue, itemStyle: { color: '#a855f7' } },
          { value: result.propositionI.noTax.V_L, itemStyle: { color: '#3b82f6' } },
          { value: result.propositionI.withTax.V_L, itemStyle: { color: '#fbbf24' } },
        ],
        label: { show: true, position: 'top', formatter: (p) => fmt(p.value, 1), color: '#fff' },
        barWidth: '40%',
      }],
    };
  }, [result, params.unleveredValue]);

  return (
    <Row gutter={20} className="finance-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card finance-param-card" title={<Space><CalculatorOutlined /> 参数面板</Space>} size="small">
          <ParamRow label="无杠杆价值 V_U" value={params.unleveredValue} onChange={update('unleveredValue')} min={0} step={10} />
          <ParamRow label="债务价值 D" value={params.debtValue} onChange={update('debtValue')} min={0} step={10} />
          <ParamRow label="权益价值 E" value={params.equityValue} onChange={update('equityValue')} min={0} step={10} />
          <ParamRow label="无杠杆成本 K₀" value={params.costOfCapital} onChange={update('costOfCapital')} min={0.01} max={0.5} step={0.01} suffix="%" />
          <ParamRow label="债务成本 K_d" value={params.costOfDebt} onChange={update('costOfDebt')} min={0.001} max={0.3} step={0.005} suffix="%" />
          <ParamRow label="税率 T" value={params.taxRate} onChange={update('taxRate')} min={0} max={0.5} step={0.01} suffix="%" />
          <Divider style={{ margin: '8px 0' }} />
          <div className="finance-formula-hint">
            <div>命题I(无税): V_L = V_U</div>
            <div>命题I(有税): V_L = V_U + T×D</div>
            <div>命题II: K_E = K₀ + (K₀−K_d)×(D/E)×(1−T)</div>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={12}>
            <Col span={6}><StatCard icon="📐" value={fmt(result?.propositionI?.withTax?.V_L, 1)} label="V_L (有税)" color="gold" /></Col>
            <Col span={6}><StatCard icon="🛡️" value={fmt(result?.taxShieldPV, 1)} label="税盾 T×D" color="green" /></Col>
            <Col span={6}><StatCard icon="📈" value={fmtPct(result?.propositionII?.withTax?.K_E)} label="K_E (有税)" color="purple" /></Col>
            <Col span={6}><StatCard icon="⚖️" value={fmtPct(result?.waccVerification?.withTax)} label="WACC 验证" color="blue" /></Col>
          </Row>
          <Card className="glass-card" title="MM 命题I 企业价值对比" size="small">
            <div ref={chartRef} style={{ width: '100%', height: 280 }} />
          </Card>
          <Card className="glass-card" title="命题II 推导" size="small">
            <Row gutter={16}>
              <Col span={12}>
                <div className="mm-prop-box">
                  <div className="mm-prop-title">无税世界</div>
                  <div className="mm-prop-formula">K_E = {fmtPct(result?.propositionII?.noTax?.K_E, 4)}</div>
                  <div className="mm-prop-desc">斜率 = (K₀ − K_d)，WACC 不随杠杆变化</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="mm-prop-box">
                  <div className="mm-prop-title">有税世界</div>
                  <div className="mm-prop-formula">K_E = {fmtPct(result?.propositionII?.withTax?.K_E, 4)}</div>
                  <div className="mm-prop-desc">斜率 × (1−T)，税率降低权益成本敏感度</div>
                </div>
              </Col>
            </Row>
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

// ============================================================
// Tab 4: 资本结构优化
// ============================================================
function OptCapTab() {
  const [params, setParams] = useState(DEFAULT_OPT);
  const update = (k) => (v) => setParams((p) => ({ ...p, [k]: v }));
  const result = useMemo(() => {
    try {
      return optimalCapitalStructure(params);
    } catch (e) {
      logger.error('[FinancePage:OptCap] 计算失败', e);
      return null;
    }
  }, [params]);

  const chartRef = useChart(() => {
    if (!result || !result.curve) return null;
    const curve = result.curve;
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['企业价值 V_L', '税盾', '困境成本'], top: 10 },
      grid: { left: '8%', right: '5%', bottom: '10%', top: '20%' },
      xAxis: { type: 'category', data: curve.map((c) => fmtPct(c.杠杆率_D_VU, 0)), name: '杠杆率 D/V_U' },
      yAxis: [
        { type: 'value', name: '价值', position: 'left' },
      ],
      series: [
        { name: '企业价值 V_L', type: 'line', data: curve.map((c) => c.V_L), smooth: true, itemStyle: { color: '#fbbf24' }, areaStyle: { color: 'rgba(251,191,36,0.1)' } },
        { name: '税盾', type: 'line', data: curve.map((c) => c.税盾), smooth: true, itemStyle: { color: '#10b981' } },
        { name: '困境成本', type: 'line', data: curve.map((c) => c.困境成本), smooth: true, itemStyle: { color: '#ef4444' } },
        {
          name: '最优点',
          type: 'scatter',
          data: [[fmtPct(result.optimalLeverage, 0), result.optimalValue]],
          itemStyle: { color: '#a855f7', borderColor: '#fff', borderWidth: 2 },
          symbolSize: 16,
          markLine: {
            data: [{ xAxis: fmtPct(result.optimalLeverage, 0) }],
            lineStyle: { color: '#a855f7', type: 'dashed' },
            label: { formatter: '最优杠杆', color: '#a855f7' },
          },
        },
      ],
    };
  }, [result]);

  return (
    <Row gutter={20} className="finance-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card finance-param-card" title={<Space><CalculatorOutlined /> 参数面板</Space>} size="small">
          <ParamRow label="无杠杆价值 V_U" value={params.unleveredValue} onChange={update('unleveredValue')} min={0} step={10} />
          <ParamRow label="税率 T" value={params.taxRate} onChange={update('taxRate')} min={0} max={0.5} step={0.01} suffix="%" />
          <ParamRow label="债务成本 K_d" value={params.costOfDebt} onChange={update('costOfDebt')} min={0.001} max={0.3} step={0.005} suffix="%" />
          <Divider style={{ margin: '8px 0' }} />
          <ParamRow label="困境损失率" value={params.distressCostRate} onChange={update('distressCostRate')} min={0} max={1} step={0.05} />
          <ParamRow label="基础困境概率" value={params.baseDistressProbability} onChange={update('baseDistressProbability')} min={0} max={1} step={0.01} />
          <ParamRow label="困境敏感度 α" value={params.distressSensitivity} onChange={update('distressSensitivity')} min={0} max={5} step={0.1} tooltip="困境概率对杠杆的敏感度，越大则困境来得越快" />
          <ParamRow label="最大杠杆率" value={params.maxLeverage} onChange={update('maxLeverage')} min={0.1} max={1} step={0.05} suffix="" />
          <Divider style={{ margin: '8px 0' }} />
          <div className="finance-formula-hint">
            <div>V_L(D) = V_U + T×D − PV(困境)</div>
            <div>最优 D*: dV_L/dD = 0</div>
            <div>π(D) = π₀ × (1 + α×L²)</div>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={12}>
            <Col span={6}><StatCard icon="🎯" value={fmtPct(result?.optimalLeverage, 1)} label="最优杠杆率" color="purple" /></Col>
            <Col span={6}><StatCard icon="💰" value={fmt(result?.optimalValue, 1)} label="最优企业价值" color="gold" /></Col>
            <Col span={6}><StatCard icon="📈" value={fmt(result?.breakdown?.价值增量, 1)} label="价值增量" color="green" /></Col>
            <Col span={6}><StatCard icon="🏦" value={fmt(result?.optimalD, 1)} label="最优债务 D*" color="blue" /></Col>
          </Row>
          <Card className="glass-card" title="权衡理论曲线 · 税盾 vs 困境成本" size="small">
            <div ref={chartRef} style={{ width: '100%', height: 360 }} />
          </Card>
        </Space>
      </Col>
    </Row>
  );
}

// ============================================================
// Tab 5: 并购估值
// ============================================================
function MATab() {
  const [params, setParams] = useState(DEFAULT_MA);
  const update = (k) => (v) => setParams((p) => ({ ...p, [k]: v }));
  const result = useMemo(() => {
    try {
      return mergerValuation(params);
    } catch (e) {
      logger.error('[FinancePage:M&A] 计算失败', e);
      return null;
    }
  }, [params]);

  const chartRef = useChart(() => {
    if (!result) return null;
    return {
      tooltip: { trigger: 'item' },
      legend: { top: 10 },
      grid: { left: '8%', right: '5%', bottom: '10%', top: '20%' },
      xAxis: { type: 'category', data: ['V_A 收购方', 'V_T 目标方', '协同效应', '整合成本', 'V_combined 合并价值'] },
      yAxis: { type: 'value', name: '价值' },
      series: [{
        type: 'bar',
        data: [
          { value: params.acquirerValue, itemStyle: { color: '#a855f7' } },
          { value: params.targetValue, itemStyle: { color: '#3b82f6' } },
          { value: result.totalSynergy, itemStyle: { color: '#10b981' } },
          { value: -params.integrationCost, itemStyle: { color: '#ef4444' } },
          { value: result.combinedValue, itemStyle: { color: '#fbbf24' } },
        ],
        label: { show: true, position: 'top', formatter: (p) => fmt(p.value, 1), color: '#fff' },
        barWidth: '40%',
      }],
    };
  }, [result, params]);

  return (
    <Row gutter={20} className="finance-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card finance-param-card" title={<Space><CalculatorOutlined /> 参数面板</Space>} size="small">
          <ParamRow label="收购方价值 V_A" value={params.acquirerValue} onChange={update('acquirerValue')} min={0} step={10} />
          <ParamRow label="目标方价值 V_T" value={params.targetValue} onChange={update('targetValue')} min={0} step={10} />
          <Divider style={{ margin: '8px 0' }} />
          <ParamRow label="收入协同" value={params.revenueSynergy} onChange={update('revenueSynergy')} min={0} step={5} tooltip="交叉销售/渠道拓展带来的收入增量现值" />
          <ParamRow label="成本协同" value={params.costSynergy} onChange={update('costSynergy')} min={0} step={5} tooltip="规模经济/重复部门裁撤带来的成本节约现值" />
          <ParamRow label="税务协同" value={params.taxSynergy} onChange={update('taxSynergy')} min={0} step={5} tooltip="净经营损失结转/税收优惠现值" />
          <Divider style={{ margin: '8px 0' }} />
          <ParamRow label="收购价" value={params.acquisitionPrice} onChange={update('acquisitionPrice')} min={0} step={10} />
          <ParamRow label="整合成本" value={params.integrationCost} onChange={update('integrationCost')} min={0} step={5} />
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={12}>
            <Col span={6}><StatCard icon="🔗" value={fmt(result?.totalSynergy, 1)} label="协同效应合计" color="green" /></Col>
            <Col span={6}><StatCard icon="💎" value={fmt(result?.combinedValue, 1)} label="合并后价值" color="gold" /></Col>
            <Col span={6}><StatCard icon="🏷️" value={fmtPct(result?.premiumRate, 1)} label="溢价率" color="pink" /></Col>
            <Col span={6}>
              <StatCard
                icon={result?.dealNPV >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                value={fmt(result?.dealNPV, 1)}
                label="并购 NPV"
                color={result?.dealNPV >= 0 ? 'green' : 'pink'}
              />
            </Col>
          </Row>
          <Card className="glass-card" title="并购价值构成" size="small">
            <div ref={chartRef} style={{ width: '100%', height: 340 }} />
          </Card>
          {result && (
            <Card className="glass-card" size="small">
              <div className={`ma-verdict ${result.dealNPV >= 0 ? 'positive' : 'negative'}`}>
                {result.dealNPV >= 0
                  ? `✓ 并购创造价值 ${fmt(result.dealNPV, 2)}（协同 > 溢价 + 整合成本）`
                  : `✗ 并购减损价值 ${fmt(Math.abs(result.dealNPV), 2)}（溢价/整合 > 协同）`}
              </div>
            </Card>
          )}
        </Space>
      </Col>
    </Row>
  );
}

// ============================================================
// Tab 6: 三方法互验
// ============================================================
function CrossValTab() {
  const [params, setParams] = useState(DEFAULT_CROSS);
  const update = (k) => (v) => setParams((p) => ({ ...p, [k]: v }));
  const result = useMemo(() => {
    try {
      return crossValidateValuation(params);
    } catch (e) {
      logger.error('[FinancePage:CrossVal] 计算失败', e);
      return null;
    }
  }, [params]);

  const chartRef = useChart(() => {
    if (!result) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { top: 10 },
      grid: { left: '8%', right: '5%', bottom: '10%', top: '20%' },
      xAxis: { type: 'category', data: ['WACC 法', 'APV 法', 'FTE 法'] },
      yAxis: { type: 'value', name: 'V_L 杠杆价值', min: (v) => v.min * 0.95, max: (v) => v.max * 1.05 },
      series: [{
        type: 'bar',
        data: [
          { value: result.waccValue, itemStyle: { color: result.consistency ? '#10b981' : '#ef4444' } },
          { value: result.apvValue, itemStyle: { color: result.consistency ? '#10b981' : '#ef4444' } },
          { value: result.fteValue, itemStyle: { color: result.consistency ? '#10b981' : '#ef4444' } },
        ],
        label: { show: true, position: 'top', formatter: (p) => fmt(p.value, 2), color: '#fff' },
        barWidth: '40%',
        markLine: {
          data: [{ type: 'average', name: '平均值' }],
          lineStyle: { color: '#fbbf24', type: 'dashed' },
          label: { formatter: '均值: {c}', color: '#fbbf24' },
        },
      }],
    };
  }, [result]);

  const tableData = result ? [
    { key: '1', method: 'WACC 法', value: result.waccValue, deviation: result.各方法偏差.WACC法, formula: 'V_L = Σ FCF / (1+WACC)ᵗ' },
    { key: '2', method: 'APV 法', value: result.apvValue, deviation: result.各方法偏差.APV法, formula: 'V_L = V_U + 税盾 − 困境成本' },
    { key: '3', method: 'FTE 法', value: result.fteValue, deviation: result.各方法偏差.FTE法, formula: 'V_L = V_E + D' },
  ] : [];
  return (
    <Row gutter={20} className="finance-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card finance-param-card" title={<Space><CalculatorOutlined /> 参数面板</Space>} size="small">
          <FCFInput value={params.unleveredFCFs} onChange={update('unleveredFCFs')} />
          <ParamRow label="无杠杆成本 K₀" value={params.costOfCapital} onChange={update('costOfCapital')} min={0.01} max={0.5} step={0.01} suffix="%" />
          <ParamRow label="权益成本 K_E" value={params.costOfEquity} onChange={update('costOfEquity')} min={0.01} max={0.5} step={0.01} suffix="%" />
          <ParamRow label="WACC" value={params.wacc} onChange={update('wacc')} min={0.01} max={0.5} step={0.005} suffix="%" />
          <ParamRow label="债务金额 D" value={params.debtAmount} onChange={update('debtAmount')} min={0} step={10} />
          <ParamRow label="债务成本 K_d" value={params.costOfDebt} onChange={update('costOfDebt')} min={0.001} max={0.3} step={0.005} suffix="%" />
          <ParamRow label="税率 T" value={params.taxRate} onChange={update('taxRate')} min={0} max={0.5} step={0.01} suffix="%" />
          <Divider style={{ margin: '8px 0' }} />
          <div className="finance-formula-hint">
            <div>三方法在相同假设下应给出相同 V_L</div>
            <div>容差: ±2%（与三角审计一致）</div>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card className="glass-card" title="三方法估值对比" size="small">
            <div ref={chartRef} style={{ width: '100%', height: 300 }} />
          </Card>
          <Card className="glass-card" size="small">
            <Table
              dataSource={tableData}
              pagination={false}
              size="small"
              columns={[
                { title: '方法', dataIndex: 'method', key: 'method', width: 100 },
                { title: 'V_L 估值', dataIndex: 'value', key: 'value', render: (v) => <span style={{ color: '#fbbf24', fontWeight: 600 }}>{fmt(v, 2)}</span> },
                { title: '偏差', dataIndex: 'deviation', key: 'deviation', render: (v) => {
                  const abs = Math.abs(parseFloat(v) || 0);
                  const level = abs <= 2 ? 'green' : abs <= 5 ? 'orange' : 'red';
                  return <Tag color={level}>{typeof v === 'number' ? `${v.toFixed(2)}%` : v}</Tag>;
                }},
                { title: '公式', dataIndex: 'formula', key: 'formula', render: (v) => <code className="finance-code">{v}</code> },
              ]}
            />
          </Card>
          {result && (
            <Card className="glass-card" size="small">
              <div className={`cross-verdict ${result.consistency ? 'consistent' : 'inconsistent'}`}>
                <AuditOutlined style={{ marginRight: 8 }} />
                {result.verdict}
                <span style={{ marginLeft: 16, opacity: 0.7 }}>最大偏差: {typeof result.最大偏差 === 'number' ? result.最大偏差.toFixed(2) + '%' : result.最大偏差}</span>
              </div>
            </Card>
          )}
        </Space>
      </Col>
    </Row>
  );
}

// ============================================================
// 主页面
// ============================================================
const FinancePage = () => {
  const [tabKey, setTabKey] = useState('apv');

  useEffect(() => {
    logger.session('[FinancePage] 页面加载', { tab: tabKey });
  }, [tabKey]);

  return (
    <div className="finance-page">
      <PageHeader
        icon={<DollarOutlined />}
        title="公司理财实验室"
        desc="Capital Structure Lab · APV / FTE / MM 定理 / 资本结构优化 / 并购估值 / 三方法互验"
        extra={<Tag color="purple">投行级 v1.0</Tag>}
      />

      <Card
        className="glass-card finance-tabs-card"
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          activeKey={tabKey}
          onChange={setTabKey}
          tabBarStyle={{
            padding: '0 20px',
            borderBottom: '1px solid rgba(168,85,247,0.15)',
            margin: 0,
          }}
          items={[
            {
              key: 'apv',
              label: <Space><AccountBookOutlined /> APV 调整净现值</Space>,
              children: <APVTab />,
            },
            {
              key: 'fte',
              label: <Space><DollarOutlined /> FTE 权益现金流</Space>,
              children: <FTETab />,
            },
            {
              key: 'mm',
              label: <Space><ApartmentOutlined /> MM 定理</Space>,
              children: <MMTab />,
            },
            {
              key: 'optcap',
              label: <Space><ThunderboltOutlined /> 资本结构优化</Space>,
              children: <OptCapTab />,
            },
            {
              key: 'ma',
              label: <Space><MergeCellsOutlined /> 并购估值</Space>,
              children: <MATab />,
            },
            {
              key: 'cross',
              label: <Space><AuditOutlined /> 三方法互验</Space>,
              children: <CrossValTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default FinancePage;
