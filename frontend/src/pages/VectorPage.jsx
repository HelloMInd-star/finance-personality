/**
 * 向量分析实验室 · Vector Analytics Lab
 *
 * 基于 vectorMapper.js 的 11 维向量统一引擎
 * 四大模块：
 *  1. 向量雷达  - 用户/资产 11 维雷达图对比
 *  2. 相似度矩阵 - 用户 vs 多资产匹配度排名
 *  3. PCA 降维   - 11 维 → 2D 散点图，可视化资产聚类
 *  4. 向量档案   - 原型分类 + 最强/最弱维度
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Card, Tabs, Row, Col, Space, Button, Select, Tag, Divider, Table,
  Tooltip, Progress, Empty, Descriptions, Alert,
} from 'antd';
import {
  RadarChartOutlined, HeatMapOutlined, DotChartOutlined,
  ProfileOutlined, ReloadOutlined, UserOutlined, AimOutlined,
  BulbOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import { PageHeader, StatCard } from '../components/Common';
import {
  VECTOR_DIMENSIONS, DIM_COUNT, GENERAL_DIMS, FINANCE_DIMS,
  buildUserVector, buildAssetVector, buildPresetAssetVectors,
  cosineSimilarity, normalizedDistance, weightedSimilarity,
  pcaReduce, vectorToLabel, matchUserAsset,
} from '../utils/vectorMapper';
import { logger } from '../utils/logger';
import './VectorPage.css';

// ============================================================
// 主题注册
// ============================================================
let themeRegistered = false;
function ensureTheme() {
  if (themeRegistered || !echarts.registerTheme) return;
  echarts.registerTheme('ymine-dark', {
    backgroundColor: 'transparent',
    textStyle: { color: 'rgba(255,255,255,0.85)' },
    legend: { textStyle: { color: 'rgba(255,255,255,0.7)' } },
    radar: {
      axisName: { color: 'rgba(255,255,255,0.75)' },
      splitLine: { lineStyle: { color: 'rgba(168,85,247,0.18)' } },
      splitArea: { areaStyle: { color: ['rgba(168,85,247,0.02)', 'rgba(168,85,247,0.05)'] } },
      axisLine: { lineStyle: { color: 'rgba(168,85,247,0.25)' } },
    },
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

const fmt3 = (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(3) : '-');
const fmtPct = (v, d = 1) => (typeof v === 'number' && !isNaN(v) ? `${(v * 100).toFixed(d)}%` : '-');

// ============================================================
// 主页面
// ============================================================
const VectorPage = () => {
  const [tabKey, setTabKey] = useState('radar');
  const [userVec, setUserVec] = useState(null);
  const [assetVectors, setAssetVectors] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState('AAPL');

  // 初始化
  const refresh = () => {
    const u = buildUserVector();
    const a = buildPresetAssetVectors();
    setUserVec(u);
    setAssetVectors(a);
    logger.session('[VectorPage] 刷新向量', {
      用户原型: vectorToLabel(u.vector).archetype,
      资产数: a.length,
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!userVec || assetVectors.length === 0) {
    return (
      <div className="vector-page">
        <PageHeader
        title="向量分析实验室"
        desc="11 维向量统一引擎"
        icon={<RadarChartOutlined />}
      />
        <Card className="glass-card"><Empty description="正在构建向量..." /></Card>
      </div>
    );
  }

  const userLabel = vectorToLabel(userVec.vector);
  const selectedAsset = assetVectors.find(a => a.ticker === selectedTicker) || assetVectors[0];

  return (
    <div className="vector-page">
      <PageHeader
        title="向量分析实验室"
        desc="11 维向量统一引擎 · 通用6 + 金融5"
        icon={<RadarChartOutlined />}
        extra={
          <Button icon={<ReloadOutlined />} onClick={refresh} size="small">
            刷新向量
          </Button>
        }
      />

      {/* 顶部摘要 */}
      <Row gutter={16} className="vector-summary">
        <Col xs={12} md={6}>
          <StatCard icon="🧬" value={userLabel.archetype} label="用户原型" color="purple" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard icon="⚡" value={userLabel.top} label="最强维度" color="gold" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard icon="🛡️" value={userLabel.weak} label="待提升维度" color="pink" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard icon="📊" value={`${DIM_COUNT}维`} label="向量空间" color="blue" />
        </Col>
      </Row>

      <Card className="glass-card vector-tabs-card">
        <Tabs
          activeKey={tabKey}
          onChange={setTabKey}
          items={[
            { key: 'radar', label: <span><RadarChartOutlined /> 向量雷达</span>, children: <RadarTab userVec={userVec} assetVectors={assetVectors} selectedTicker={selectedTicker} setSelectedTicker={setSelectedTicker} selectedAsset={selectedAsset} /> },
            { key: 'similarity', label: <span><HeatMapOutlined /> 相似度矩阵</span>, children: <SimilarityTab userVec={userVec} assetVectors={assetVectors} setSelectedTicker={setSelectedTicker} setTabKey={setTabKey} /> },
            { key: 'pca', label: <span><DotChartOutlined /> PCA 降维</span>, children: <PcaTab userVec={userVec} assetVectors={assetVectors} /> },
            { key: 'profile', label: <span><ProfileOutlined /> 向量档案</span>, children: <ProfileTab userVec={userVec} assetVectors={assetVectors} /> },
          ]}
        />
      </Card>
    </div>
  );
};

// ============================================================
// Tab 1: 向量雷达
// ============================================================
function RadarTab({ userVec, assetVectors, selectedTicker, setSelectedTicker, selectedAsset }) {
  const chartRef = useChart(() => {
    const indicators = VECTOR_DIMENSIONS.map(d => ({ name: d.label, max: 1, color: d.color }));
    return {
      tooltip: { trigger: 'item' },
      legend: { data: ['用户', selectedAsset.name], top: 8 },
      radar: { indicator: indicators, radius: '68%', center: ['50%', '55%'] },
      series: [{
        type: 'radar',
        data: [
          {
            value: userVec.vector,
            name: '用户',
            areaStyle: { color: 'rgba(168,85,247,0.25)' },
            lineStyle: { color: '#a855f7', width: 2 },
            itemStyle: { color: '#a855f7' },
          },
          {
            value: selectedAsset.vector,
            name: selectedAsset.name,
            areaStyle: { color: 'rgba(251,191,36,0.18)' },
            lineStyle: { color: '#fbbf24', width: 2 },
            itemStyle: { color: '#fbbf24' },
          },
        ],
      }],
    };
  }, [userVec, selectedAsset]);

  const match = useMemo(() => matchUserAsset(userVec.vector, selectedAsset.vector), [userVec, selectedAsset]);

  return (
    <Row gutter={20} className="vector-tab-body">
      <Col xs={24} lg={8}>
        <Card className="glass-card vector-param-card" size="small" title={<span><AimOutlined /> 资产选择</span>}>
          <Select
            value={selectedTicker}
            onChange={setSelectedTicker}
            style={{ width: '100%' }}
            options={assetVectors.map(a => ({ value: a.ticker, label: `${a.ticker} · ${a.name}` }))}
          />
          <Divider style={{ margin: '12px 0' }} />
          <div className="vector-match-summary">
            <div className="match-row">
              <span className="match-label">综合匹配度</span>
              <span className="match-value" style={{ color: match.overall > 0.7 ? '#34d399' : match.overall > 0.5 ? '#fbbf24' : '#ef4444' }}>
                {fmtPct(match.overall, 1)}
              </span>
            </div>
            <div className="match-row">
              <span className="match-label">余弦相似度</span>
              <span className="match-value">{fmt3(match.cosine)}</span>
            </div>
            <div className="match-row">
              <span className="match-label">归一距离</span>
              <span className="match-value">{fmt3(match.normalizedDistance)}</span>
            </div>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div className="vector-dim-legend">
            <div className="legend-group">
              <span className="legend-title">通用向量</span>
              <div className="legend-tags">
                {GENERAL_DIMS.map(d => <Tag key={d.key} color={d.color}>{d.label}</Tag>)}
              </div>
            </div>
            <div className="legend-group">
              <span className="legend-title">金融向量</span>
              <div className="legend-tags">
                {FINANCE_DIMS.map(d => <Tag key={d.key} color={d.color}>{d.label}</Tag>)}
              </div>
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Card className="glass-card" size="small" title={`${selectedAsset.name} vs 用户 11 维向量雷达`}>
          <div ref={chartRef} style={{ width: '100%', height: 420 }} />
        </Card>
        <Card className="glass-card" size="small" style={{ marginTop: 12 }}>
          <Table
            dataSource={match.contributions}
            rowKey="dim"
            pagination={false}
            size="small"
            columns={[
              { title: '维度', dataIndex: 'label', key: 'label', width: 110, render: (t, r) => <Tag color={r.color}>{t}</Tag> },
              { title: '用户', dataIndex: 'user', key: 'user', width: 80, render: fmt3 },
              { title: '资产', dataIndex: 'asset', key: 'asset', width: 80, render: fmt3 },
              { title: '差异', dataIndex: 'diff', key: 'diff', width: 80, render: (v) => <span style={{ color: v > 0.3 ? '#ef4444' : 'inherit' }}>{fmt3(v)}</span> },
              { title: '贡献度', dataIndex: 'contribution', key: 'contribution', render: (v) => <Progress percent={Math.round(v * 100)} size="small" strokeColor={{ from: '#a855f7', to: '#fbbf24' }} /> },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}

// ============================================================
// Tab 2: 相似度矩阵
// ============================================================
function SimilarityTab({ userVec, assetVectors, setSelectedTicker, setTabKey }) {
  const [weight, setWeight] = useState('balanced');
  const weightMap = { general: [1, 0], balanced: [0.5, 0.5], finance: [0, 1] };

  const matches = useMemo(() => {
    const [gw, fw] = weightMap[weight];
    return assetVectors.map(a => {
      const cosine = cosineSimilarity(userVec.vector, a.vector);
      const wSim = weightedSimilarity(userVec.vector, a.vector, gw, fw);
      const nDist = normalizedDistance(userVec.vector, a.vector);
      return {
        key: a.ticker,
        ticker: a.ticker,
        name: a.name,
        cosine: +cosine.toFixed(4),
        weighted: +wSim.toFixed(4),
        distance: +nDist.toFixed(4),
        overall: +(0.5 * Math.max(0, wSim) + 0.5 * nDist).toFixed(4),
        label: vectorToLabel(a.vector).archetype,
        raw: a,
      };
    }).sort((a, b) => b.overall - a.overall);
  }, [userVec, assetVectors, weight]);

  const chartRef = useChart(() => {
    const tickers = matches.map(m => m.ticker);
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['综合匹配度', '余弦相似度', '加权相似度'], top: 8 },
      grid: { left: '8%', right: '5%', top: '20%', bottom: '12%' },
      xAxis: { type: 'category', data: tickers },
      yAxis: { type: 'value', min: 0, max: 1 },
      series: [
        { name: '综合匹配度', type: 'bar', data: matches.map(m => m.overall), itemStyle: { color: '#a855f7', borderRadius: [4, 4, 0, 0] } },
        { name: '余弦相似度', type: 'bar', data: matches.map(m => m.cosine), itemStyle: { color: '#fbbf24', borderRadius: [4, 4, 0, 0] } },
        { name: '加权相似度', type: 'bar', data: matches.map(m => m.weighted), itemStyle: { color: '#ec4899', borderRadius: [4, 4, 0, 0] } },
      ],
    };
  }, [matches]);

  return (
    <div className="vector-tab-body">
      <Card className="glass-card" size="small" style={{ marginBottom: 12 }}>
        <Space>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>权重策略：</span>
          <Select
            value={weight}
            onChange={setWeight}
            style={{ width: 180 }}
            options={[
              { value: 'general', label: '通用维度优先（行为/人格）' },
              { value: 'balanced', label: '均衡权重（默认）' },
              { value: 'finance', label: '金融维度优先（估值/风控）' },
            ]}
          />
        </Space>
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card className="glass-card" size="small" title="用户 × 资产 匹配度对比">
            <div ref={chartRef} style={{ width: '100%', height: 360 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="glass-card" size="small" title="匹配度排名表">
            <Table
              dataSource={matches}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ y: 320 }}
              onRow={(r) => ({
                onClick: () => { setSelectedTicker(r.ticker); setTabKey('radar'); },
                style: { cursor: 'pointer' },
              })}
              columns={[
                { title: '#', width: 40, render: (_, __, i) => i + 1 },
                { title: '标的', dataIndex: 'ticker', key: 'ticker', width: 80, render: (t, r) => <Tooltip title="点击查看雷达图"><Tag color="purple">{t}</Tag></Tooltip> },
                { title: '原型', dataIndex: 'label', key: 'label', width: 110, render: (t) => <Tag>{t}</Tag> },
                { title: '综合', dataIndex: 'overall', key: 'overall', width: 70, render: (v) => <span style={{ color: '#34d399', fontWeight: 600 }}>{fmtPct(v, 0)}</span> },
                { title: '余弦', dataIndex: 'cosine', key: 'cosine', width: 70, render: fmt3 },
                { title: '距离', dataIndex: 'distance', key: 'distance', width: 70, render: fmt3 },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card className="glass-card" size="small" style={{ marginTop: 12 }}>
        <Alert
          type="info"
          showIcon
          message="权重策略说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.75)' }}>
              <li><b>通用维度优先</b>：聚焦行为/人格匹配（扑克激进度、决策速度、情绪稳定等），适合人格画像匹配</li>
              <li><b>均衡权重</b>：通用与金融各占 50%，综合评估匹配度（推荐）</li>
              <li><b>金融维度优先</b>：聚焦估值/风控/仓位/择时/alpha，适合投资决策匹配</li>
            </ul>
          }
        />
      </Card>
    </div>
  );
}

// ============================================================
// Tab 3: PCA 降维
// ============================================================
function PcaTab({ userVec, assetVectors }) {
  const [target, setTarget] = useState(2);

  const pcaResult = useMemo(() => {
    const allVectors = [userVec.vector, ...assetVectors.map(a => a.vector)];
    return pcaReduce(allVectors, target);
  }, [userVec, assetVectors, target]);

  const chartRef = useChart(() => {
    if (!pcaResult.projected || pcaResult.projected.length === 0) return null;
    const userPoint = pcaResult.projected[0];
    const assetPoints = pcaResult.projected.slice(1);
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p) => `${p.data[2] || '样本'}<br/>PC1: ${p.data[0].toFixed(3)}<br/>PC2: ${p.data[1].toFixed(3)}`,
      },
      legend: { data: ['用户', '资产'], top: 8 },
      grid: { left: '8%', right: '5%', top: '15%', bottom: '12%' },
      xAxis: { type: 'value', name: 'PC1', nameTextStyle: { color: 'rgba(255,255,255,0.6)' } },
      yAxis: { type: 'value', name: 'PC2', nameTextStyle: { color: 'rgba(255,255,255,0.6)' } },
      series: [
        {
          name: '用户',
          type: 'scatter',
          data: [[userPoint[0], userPoint[1], '用户']],
          symbolSize: 22,
          itemStyle: { color: '#a855f7', shadowBlur: 18, shadowColor: 'rgba(168,85,247,0.6)' },
          label: { show: true, formatter: '用户', position: 'right', color: '#a855f7' },
        },
        {
          name: '资产',
          type: 'scatter',
          data: assetPoints.map((p, i) => [p[0], p[1], assetVectors[i]?.ticker]),
          symbolSize: 14,
          itemStyle: { color: '#fbbf24', shadowBlur: 10, shadowColor: 'rgba(251,191,36,0.5)' },
          label: { show: true, formatter: (p) => p.data[2], position: 'right', color: 'rgba(255,255,255,0.8)', fontSize: 10 },
        },
      ],
    };
  }, [pcaResult, assetVectors]);

  const explained = pcaResult.explainedRatio || [];
  const cumulative = explained.slice(0, target).reduce((s, v) => s + v, 0);

  return (
    <div className="vector-tab-body">
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><StatCard icon="📐" value={fmtPct(explained[0] || 0, 1)} label="PC1 解释方差" color="purple" /></Col>
        <Col xs={12} md={6}><StatCard icon="📏" value={fmtPct(explained[1] || 0, 1)} label="PC2 解释方差" color="gold" /></Col>
        <Col xs={12} md={6}><StatCard icon="🎯" value={fmtPct(cumulative, 1)} label="累计解释" color="pink" /></Col>
        <Col xs={12} md={6}><StatCard icon="🔢" value={`${pcaResult.projected.length}`} label="投影样本" color="blue" /></Col>
      </Row>

      <Card className="glass-card" size="small" title="PCA 2D 散点图（11 维 → 2 维降维）">
        <div ref={chartRef} style={{ width: '100%', height: 420 }} />
      </Card>

      <Card className="glass-card" size="small" style={{ marginTop: 12 }}>
        <Alert
          type="info"
          showIcon
          message="PCA 降维说明"
          description={
            <div style={{ color: 'rgba(255,255,255,0.75)' }}>
              <p style={{ margin: '0 0 8px' }}>
                通过协方差矩阵的 Jacobi 特征分解，将 11 维向量投影到 2D 平面，保留最大方差方向。
                距离越近的资产，向量画像越相似；用户点周围聚集的资产，是最匹配的候选。
              </p>
              <p style={{ margin: 0 }}>
                当前累计解释方差：<b style={{ color: '#fbbf24' }}>{fmtPct(cumulative, 1)}</b>
                {cumulative < 0.6 && '（偏低，建议结合原始雷达图分析）'}
                {cumulative >= 0.6 && cumulative < 0.8 && '（良好，主要信息已捕获）'}
                {cumulative >= 0.8 && '（优秀，高度还原原始信息）'}
              </p>
            </div>
          }
        />
      </Card>
    </div>
  );
}

// ============================================================
// Tab 4: 向量档案
// ============================================================
function ProfileTab({ userVec, assetVectors }) {
  const userLabel = vectorToLabel(userVec.vector);

  const archetypeCards = useMemo(() => {
    const archetypes = new Map();
    assetVectors.forEach(a => {
      const label = vectorToLabel(a.vector);
      if (!archetypes.has(label.archetype)) {
        archetypes.set(label.archetype, []);
      }
      archetypes.get(label.archetype).push(a);
    });
    return Array.from(archetypes.entries()).map(([archetype, list]) => ({ archetype, list }));
  }, [assetVectors]);

  return (
    <div className="vector-tab-body">
      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card className="glass-card" size="small" title={<span><UserOutlined /> 用户向量档案</span>}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="原型分类">
                <Tag color="purple" style={{ fontSize: 14, padding: '2px 12px' }}>{userLabel.archetype}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="最强维度">
                <Tag color={VECTOR_DIMENSIONS.find(d => d.label === userLabel.top)?.color}>{userLabel.top}</Tag>
                <span style={{ color: 'rgba(255,255,255,0.6)', marginLeft: 8, fontSize: 12 }}>{userLabel.topDesc}</span>
              </Descriptions.Item>
              <Descriptions.Item label="待提升维度">
                <Tag color={VECTOR_DIMENSIONS.find(d => d.label === userLabel.weak)?.color}>{userLabel.weak}</Tag>
                <span style={{ color: 'rgba(255,255,255,0.6)', marginLeft: 8, fontSize: 12 }}>{userLabel.weakDesc}</span>
              </Descriptions.Item>
            </Descriptions>
            <Divider style={{ margin: '12px 0' }} />
            <div className="vector-dim-detail">
              {VECTOR_DIMENSIONS.map(d => (
                <div key={d.key} className="dim-row">
                  <span className="dim-label" style={{ borderLeft: `3px solid ${d.color}` }}>{d.label}</span>
                  <Progress
                    percent={Math.round((userVec.raw[d.key] || 0) * 100)}
                    size="small"
                    strokeColor={d.color}
                    style={{ flex: 1 }}
                  />
                  <span className="dim-value">{fmt3(userVec.raw[d.key])}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card className="glass-card" size="small" title={<span><BulbOutlined /> 数据源 & 维度说明</span>}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>数据来源：</span>
              {userVec.sources.map((s, i) => <Tag key={i} color="blue" style={{ marginBottom: 4 }}>{s}</Tag>)}
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div className="vector-dim-explain">
              {VECTOR_DIMENSIONS.map(d => (
                <div key={d.key} className="explain-row">
                  <div className="explain-header">
                    <span className="explain-dot" style={{ background: d.color }} />
                    <span className="explain-label">{d.label}</span>
                    <Tag color={d.group === 'general' ? 'purple' : 'gold'}>{d.group === 'general' ? '通用' : '金融'}</Tag>
                  </div>
                  <div className="explain-desc">{d.desc}</div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="glass-card" size="small" style={{ marginTop: 12 }} title={<span><ThunderboltOutlined /> 资产原型聚类</span>}>
        <Row gutter={12}>
          {archetypeCards.map(({ archetype, list }) => (
            <Col xs={12} md={8} lg={6} key={archetype} style={{ marginBottom: 8 }}>
              <Card size="small" className="archetype-mini-card">
                <div className="archetype-title">{archetype}</div>
                <div className="archetype-assets">
                  {list.map(a => <Tag key={a.ticker} color="purple">{a.ticker}</Tag>)}
                </div>
                <div className="archetype-count">{list.length} 个资产</div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}

export default VectorPage;
