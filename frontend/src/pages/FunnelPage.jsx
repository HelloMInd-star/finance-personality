/**
 * 信息漏斗商业精算实验室 · Information Funnel Business Actuarial Lab
 *
 * 基于 ymine 仓库营销实验室 (labs/marketing/index.html) 的三流分发元架构
 * 核心功能：
 *  - 漏斗状态条（激活/暂停/熔断）
 *  - 精算流程总览（采集→清洗→特征→精算→分发）
 *  - 圈层收敛模型（三层漏斗转化：曝光→兴趣→转化）
 *  - 实时指标面板
 *  - 精算日志
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Card, Row, Col, Space, InputNumber, Button, Slider, Divider, Tag,
  Progress, Table, Alert, Switch, Tooltip, Segmented,
} from 'antd';
import {
  FilterOutlined, ThunderboltOutlined, SafetyOutlined,
  RiseOutlined, FallOutlined, ExperimentOutlined,
  DatabaseOutlined, BulbOutlined, SyncOutlined, PlayCircleOutlined,
  PauseCircleOutlined, StopOutlined, AimOutlined, LineChartOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import { PageHeader, StatCard } from '../components/Common';
import { logger } from '../utils/logger';
import './FunnelPage.css';

// ============================================================
// ECharts 暗色主题注册
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
// 默认数据
// ============================================================
const DEFAULT_FUNNEL = {
  // 流量漏斗
  impression: 10000,   // 曝光量
  click: 3200,         // 点击量
  interest: 1280,      // 兴趣量
  conversion: 320,     // 转化量
  // 精算参数
  marketQuality: 0.65,  // 市场质量（0-1）
  contentStrength: 0.72, // 内容强度（0-1）
  channelEfficiency: 0.58, // 渠道效率（0-1）
  conversionRate: 0.028,  // 转化率
  // 分发参数
  algorithmWeight: 0.45,  // 算法分发权重
  socialWeight: 0.30,     // 社交分发权重
  organicWeight: 0.25,    // 自然分发权重
  // 圈层参数
  layer1Ratio: 0.40,  // 核心层占比
  layer2Ratio: 0.35,  // 紧密层占比
  layer3Ratio: 0.25,  // 外围层占比
};

const DEFAULT_FLOW_STEPS = [
  { id: 0, name: '数据采集', icon: '📡', status: 'done', desc: '多源数据融合' },
  { id: 1, name: '信息清洗', icon: '🧹', status: 'done', desc: 'ETL去重去噪' },
  { id: 2, name: '特征工程', icon: '⚗️', status: 'active', desc: '用户画像构建' },
  { id: 3, name: '商业精算', icon: '📐', status: 'pending', desc: '价值模型计算' },
  { id: 4, name: '策略分发', icon: '🎯', status: 'pending', desc: '三流分发执行' },
];

// ============================================================
// 信息漏斗商业精算主页面
// ============================================================
const FunnelPage = () => {
  const [params, setParams] = useState(DEFAULT_FUNNEL);
  const [funnelStatus, setFunnelStatus] = useState('active'); // active | paused | fused
  const [flowSteps, setFlowSteps] = useState(DEFAULT_FLOW_STEPS);
  const [logs, setLogs] = useState([]);
  const [autoCalc, setAutoCalc] = useState(false);
  const [result, setResult] = useState(null);

  const updateParam = (k) => (v) => {
    setParams((p) => ({ ...p, [k]: v }));
  };

  const addLog = (msg, level = 'info') => {
    const entry = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      msg,
      level,
    };
    setLogs((prev) => [entry, ...prev].slice(0, 50));
  };

  // 核心精算函数
  const runActuarial = () => {
    addLog('▶ 开始商业精算...', 'info');

    // 漏斗转化率
    const clickRate = params.click / params.impression;
    const interestRate = params.interest / params.click;
    const convRate = params.conversion / params.interest;

    // 综合质量指数
    const qualityIndex =
      params.marketQuality * 0.4 +
      params.contentStrength * 0.35 +
      params.channelEfficiency * 0.25;

    // 圈层收敛度
    const layerScore =
      params.layer1Ratio * 1.0 +
      params.layer2Ratio * 0.6 +
      params.layer3Ratio * 0.3;

    // 分发效率
    const distributionEff =
      params.algorithmWeight * 0.4 +
      params.socialWeight * 0.35 +
      params.organicWeight * 0.25;

    // 商业价值 = 综合质量 × 圈层收敛 × 分发效率 × 转化率
    const businessValue = qualityIndex * layerScore * distributionEff * params.conversionRate * 10000;

    const calc = {
      clickRate,
      interestRate,
      convRate,
      qualityIndex,
      layerScore,
      distributionEff,
      businessValue,
      // 各环节损失率
      clickLoss: 1 - clickRate,
      interestLoss: 1 - interestRate,
      convLoss: 1 - convRate,
      // 预估指标
      projectedConversion: Math.round(params.conversion * (1 + qualityIndex * 0.1)),
      projectedRevenue: Math.round(businessValue * 80), // 假设客单价 80
    };

    setResult(calc);

    // 更新流程状态
    setFlowSteps((steps) =>
      steps.map((s) => {
        if (s.id <= 2) return { ...s, status: 'done' };
        if (s.id === 3) return { ...s, status: 'done' };
        if (s.id === 4) return { ...s, status: 'active' };
        return s;
      })
    );

    addLog(`✓ 精算完成 | 点击转化: ${(clickRate * 100).toFixed(1)}% | 质量指数: ${qualityIndex.toFixed(3)} | 商业价值: ${businessValue.toFixed(0)}`, 'success');

    // 熔断检查
    if (calc.clickRate < 0.15) {
      setFunnelStatus('fused');
      addLog('⚠ 点击转化率过低，触发熔断预警！', 'error');
    } else if (calc.clickRate < 0.25) {
      addLog('⚡ 点击转化率偏低，建议优化投放素材', 'warn');
    }
  };

  const handleRun = () => {
    if (funnelStatus === 'fused') {
      setFunnelStatus('active');
      addLog('🔄 熔断已解除，重新启动精算', 'info');
    }
    runActuarial();
  };

  const handleStop = () => {
    setFunnelStatus('paused');
    setFlowSteps((steps) => steps.map((s) => (s.status === 'active' ? { ...s, status: 'pending' } : s)));
    addLog('⏸ 精算已暂停', 'warn');
  };

  // 自动计算
  useEffect(() => {
    if (!autoCalc) return;
    const timer = setInterval(() => {
      runActuarial();
    }, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCalc, params]);

  // ===== 漏斗图 =====
  const funnelChartRef = useChart(() => {
    const data = [
      { value: params.impression, name: '曝光' },
      { value: params.click, name: '点击' },
      { value: params.interest, name: '兴趣' },
      { value: params.conversion, name: '转化' },
    ];
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { data: ['漏斗转化'], top: 10 },
      grid: { left: '10%', right: '10%', bottom: '10%', top: '20%' },
      series: [{
        type: 'funnel',
        data,
        label: { show: true, position: 'inside', formatter: '{b}\n{c}', color: '#fff', fontSize: 12 },
        itemStyle: {
          borderColor: 'rgba(168,85,247,0.3)',
          borderWidth: 1,
        },
        emphasis: {
          label: { fontSize: 14, fontWeight: 'bold' },
        },
        color: ['#a855f7', '#8b5cf6', '#6366f1', '#3b82f6'],
      }],
    };
  }, [params.impression, params.click, params.interest, params.conversion]);

  // ===== 圈层收敛图 =====
  const layerChartRef = useChart(() => {
    const data = [
      { value: Math.round(params.conversion * params.layer1Ratio), name: '核心层' },
      { value: Math.round(params.conversion * params.layer2Ratio), name: '紧密层' },
      { value: Math.round(params.conversion * params.layer3Ratio), name: '外围层' },
    ];
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: 'rgba(255,255,255,0.6)' } },
      series: [{
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['50%', '45%'],
        data,
        label: { color: '#fff', fontSize: 12, formatter: '{b}: {d}%' },
        itemStyle: { borderColor: 'rgba(0,0,0,0.3)', borderWidth: 2 },
        color: ['#fbbf24', '#a855f7', '#3b82f6'],
      }],
    };
  }, [params.layer1Ratio, params.layer2Ratio, params.layer3Ratio, params.conversion]);

  // ===== 分发效率图 =====
  const distChartRef = useChart(() => {
    return {
      tooltip: { trigger: 'axis' },
      radar: {
        indicator: [
          { name: '算法分发', max: 1 },
          { name: '社交分发', max: 1 },
          { name: '自然分发', max: 1 },
          { name: '内容质量', max: 1 },
          { name: '市场匹配', max: 1 },
          { name: '渠道效率', max: 1 },
        ],
        axisName: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitArea: { areaStyle: { color: ['rgba(168,85,247,0.03)', 'rgba(168,85,247,0.08)'] } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: [
            params.algorithmWeight,
            params.socialWeight,
            params.organicWeight,
            params.contentStrength,
            params.marketQuality,
            params.channelEfficiency,
          ],
          name: '当前指标',
          areaStyle: { color: 'rgba(168,85,247,0.3)' },
          lineStyle: { color: '#a855f7' },
          itemStyle: { color: '#fbbf24' },
        }],
      }],
    };
  }, [params]);

  // 流程步骤表
  const stepColumns = [
    { title: '步骤', dataIndex: 'id', key: 'id', width: 60, render: (v) => `S${v}` },
    { title: '名称', dataIndex: 'name', key: 'name', width: 100 },
    { title: '图标', dataIndex: 'icon', key: 'icon', width: 60, render: (v) => <span style={{ fontSize: 16 }}>{v}</span> },
    { title: '描述', dataIndex: 'desc', key: 'desc' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v) => {
        const map = {
          done: { color: 'green', text: '已完成' },
          active: { color: 'processing', text: '进行中' },
          pending: { color: 'default', text: '待执行' },
        };
        const cfg = map[v] || map.pending;
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
  ];

  return (
    <div className="funnel-page">
      <PageHeader
        icon={<FilterOutlined />}
        title="信息漏斗商业精算"
        desc="Information Funnel Business Actuarial Lab · 三流分发元架构推演平台"
        extra={
          <Space>
            <Tag color={funnelStatus === 'active' ? 'green' : funnelStatus === 'paused' ? 'orange' : 'red'}>
              {funnelStatus === 'active' ? '● 运行中' : funnelStatus === 'paused' ? '⏸ 已暂停' : '⚠ 已熔断'}
            </Tag>
          </Space>
        }
      />

      {/* 漏斗状态条 */}
      <Card
        className={`glass-card funnel-status-bar ${funnelStatus !== 'pending' ? 'active' : ''}`}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <ThunderboltOutlined style={{ fontSize: 20, color: '#a855f7' }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                信息漏斗精算引擎
              </span>
            </Space>
          </Col>
          <Col>
            <Space>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>自动精算</span>
              <Switch
                checked={autoCalc}
                onChange={setAutoCalc}
                checkedChildren="开"
                unCheckedChildren="关"
              />
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleRun}
                disabled={funnelStatus === 'fused'}
                style={{ background: '#a855f7', borderColor: '#a855f7' }}
              >
                启动精算
              </Button>
              <Button icon={<PauseCircleOutlined />} onClick={handleStop}>
                暂停
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                onClick={() => {
                  setFunnelStatus('fused');
                  setFlowSteps((steps) => steps.map((s) => ({ ...s, status: 'pending' })));
                  addLog('🛑 手动触发熔断', 'error');
                }}
              >
                熔断
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        {/* 左栏：参数面板 */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* 流量漏斗参数 */}
            <Card
              className="glass-card"
              title={<Space><FilterOutlined /> 流量漏斗参数</Space>}
              size="small"
            >
              <div className="funnel-param-section">
                <div className="param-label">曝光量</div>
                <InputNumber value={params.impression} onChange={updateParam('impression')} min={100} step={1000} style={{ width: '100%' }} />
              </div>
              <div className="funnel-param-section">
                <div className="param-label">点击量</div>
                <InputNumber value={params.click} onChange={updateParam('click')} min={10} step={100} style={{ width: '100%' }} />
              </div>
              <div className="funnel-param-section">
                <div className="param-label">兴趣量</div>
                <InputNumber value={params.interest} onChange={updateParam('interest')} min={10} step={50} style={{ width: '100%' }} />
              </div>
              <div className="funnel-param-section">
                <div className="param-label">转化量</div>
                <InputNumber value={params.conversion} onChange={updateParam('conversion')} min={1} step={10} style={{ width: '100%' }} />
              </div>
            </Card>

            {/* 商业精算参数 */}
            <Card
              className="glass-card"
              title={<Space><AimOutlined /> 商业精算参数</Space>}
              size="small"
            >
              <div className="funnel-param-section">
                <div className="param-label-row">
                  <span>市场质量</span>
                  <span className="param-value">{(params.marketQuality * 100).toFixed(0)}%</span>
                </div>
                <Slider value={params.marketQuality} onChange={updateParam('marketQuality')} min={0} max={1} step={0.05} />
              </div>
              <div className="funnel-param-section">
                <div className="param-label-row">
                  <span>内容强度</span>
                  <span className="param-value">{(params.contentStrength * 100).toFixed(0)}%</span>
                </div>
                <Slider value={params.contentStrength} onChange={updateParam('contentStrength')} min={0} max={1} step={0.05} />
              </div>
              <div className="funnel-param-section">
                <div className="param-label-row">
                  <span>渠道效率</span>
                  <span className="param-value">{(params.channelEfficiency * 100).toFixed(0)}%</span>
                </div>
                <Slider value={params.channelEfficiency} onChange={updateParam('channelEfficiency')} min={0} max={1} step={0.05} />
              </div>
              <div className="funnel-param-section">
                <div className="param-label-row">
                  <span>转化率</span>
                  <span className="param-value">{(params.conversionRate * 100).toFixed(1)}%</span>
                </div>
                <Slider value={params.conversionRate} onChange={updateParam('conversionRate')} min={0} max={0.2} step={0.005} />
              </div>
            </Card>

            {/* 分发权重 */}
            <Card
              className="glass-card"
              title={<Space><DatabaseOutlined /> 三流分发权重</Space>}
              size="small"
            >
              <div className="funnel-param-section">
                <div className="param-label-row">
                  <span>算法分发</span>
                  <span className="param-value">{(params.algorithmWeight * 100).toFixed(0)}%</span>
                </div>
                <Slider value={params.algorithmWeight} onChange={updateParam('algorithmWeight')} min={0} max={1} step={0.05} />
              </div>
              <div className="funnel-param-section">
                <div className="param-label-row">
                  <span>社交分发</span>
                  <span className="param-value">{(params.socialWeight * 100).toFixed(0)}%</span>
                </div>
                <Slider value={params.socialWeight} onChange={updateParam('socialWeight')} min={0} max={1} step={0.05} />
              </div>
              <div className="funnel-param-section">
                <div className="param-label-row">
                  <span>自然分发</span>
                  <span className="param-value">{(params.organicWeight * 100).toFixed(0)}%</span>
                </div>
                <Slider value={params.organicWeight} onChange={updateParam('organicWeight')} min={0} max={1} step={0.05} />
              </div>
            </Card>
          </Space>
        </Col>

        {/* 右栏：结果展示 */}
        <Col xs={24} lg={16}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* 指标卡片 */}
            <Row gutter={12}>
              <Col span={6}>
                <StatCard
                  icon="📈"
                  value={result ? `${(result.clickRate * 100).toFixed(1)}%` : '-'}
                  label="点击率"
                  color="purple"
                />
              </Col>
              <Col span={6}>
                <StatCard
                  icon="🎯"
                  value={result ? `${(result.qualityIndex * 100).toFixed(1)}` : '-'}
                  label="质量指数"
                  color="gold"
                />
              </Col>
              <Col span={6}>
                <StatCard
                  icon="💎"
                  value={result ? `${result.businessValue.toFixed(0)}` : '-'}
                  label="商业价值"
                  color="blue"
                />
              </Col>
              <Col span={6}>
                <StatCard
                  icon="🎁"
                  value={result ? `${result.projectedRevenue.toFixed(0)}` : '-'}
                  label="预估营收"
                  color="green"
                />
              </Col>
            </Row>

            {/* 漏斗图 + 圈层收敛 */}
            <Row gutter={16}>
              <Col span={12}>
                <Card className="glass-card" title="信息漏斗转化" size="small">
                  <div ref={funnelChartRef} style={{ width: '100%', height: 280 }} />
                </Card>
              </Col>
              <Col span={12}>
                <Card className="glass-card" title="圈层收敛模型" size="small">
                  <div ref={layerChartRef} style={{ width: '100%', height: 280 }} />
                </Card>
              </Col>
            </Row>

            {/* 分发效率雷达图 */}
            <Card className="glass-card" title="分发效率多维评估" size="small">
              <div ref={distChartRef} style={{ width: '100%', height: 300 }} />
            </Card>

            {/* 精算流程 */}
            <Card className="glass-card" title={<Space><ExperimentOutlined /> 精算流程总览</Space>} size="small">
              <Table
                dataSource={flowSteps}
                columns={stepColumns}
                pagination={false}
                size="small"
                rowKey="id"
              />
            </Card>

            {/* 精算日志 */}
            <Card
              className="glass-card"
              title={
                <Space>
                  <SafetyOutlined />
                  精算日志
                  <Tag color="blue">{logs.length} 条</Tag>
                </Space>
              }
              size="small"
              extra={
                <Button size="small" onClick={() => setLogs([])}>
                  清空
                </Button>
              }
            >
              <div className="funnel-log-panel">
                {logs.length === 0 ? (
                  <div className="log-empty">暂无日志，点击"启动精算"开始</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className={`log-entry log-${log.level}`}>
                      <span className="log-time">{log.time}</span>
                      <span className="log-msg">{log.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default FunnelPage;
