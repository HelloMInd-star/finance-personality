import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Slider,
  Select,
  Tag,
  Row,
  Col,
  Progress,
  Tooltip,
  Statistic,
  Radio,
  Divider,
  Tabs
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SoundOutlined,
  HeartOutlined,
  RiseOutlined,
  FallOutlined,
  BulbOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
  RadarChartOutlined
} from '@ant-design/icons';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';
import {
  musicEngine,
  generateKLineFromPokerHistory,
  calculateKLineStats
} from '../utils/musicEngine';
import {
  investorEngine,
  INVESTOR_PROFILES
} from '../utils/investorEngine';
import { storage } from '../utils/storage';
import { apiClient } from '../utils/apiClient';
import { logger } from '../utils/logger';
import { cognitiveCircleEngine } from '../utils/cognitiveCircleEngine';
import './PsychologyPage.css';
import './PsychologyPage.circle.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const INDUSTRY_OPTIONS = [
  { key: 'tech', label: '🌐 科技', color: '#1890ff' },
  { key: 'consumer', label: '🛒 消费', color: '#52c41a' },
  { key: 'energy', label: '⚡ 能源', color: '#faad14' },
  { key: 'finance', label: '💹 金融', color: '#eb2f96' }
];

const MOOD_MARKS = {
  0: '😰 焦虑',
  25: '😟 谨慎',
  50: '😐 中性',
  75: '😊 乐观',
  100: '🤩 狂热'
};

const PsychologyPage = () => {
  // 参数状态
  const [industry, setIndustry] = useState('tech');
  const [mood, setMood] = useState(60);
  const [dataSource, setDataSource] = useState('auto'); // auto / real / mock
  const [refreshKey, setRefreshKey] = useState(0);

  // 音乐状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalNotes, setTotalNotes] = useState(0);
  const [currentNote, setCurrentNote] = useState(null);
  const [musicInfo, setMusicInfo] = useState(null);

  // 从 storage 读取德州历史
  const pokerGames = useMemo(() => {
    return storage.get('pokerGames') || [];
  }, [refreshKey]);

  // K线数据
  const klineResult = useMemo(() => {
    if (dataSource === 'mock') {
      // 强制模拟
      const { generateMockKLine } = require('../utils/musicEngine');
      return { ...generateMockKLine(30, { industry }), source: '模拟数据' };
    }
    if (dataSource === 'real') {
      // 强制真实（没有就模拟）
      return generateKLineFromPokerHistory(pokerGames);
    }
    // auto：有真实数据用真实，否则模拟
    return generateKLineFromPokerHistory(pokerGames);
  }, [pokerGames, industry, dataSource, refreshKey]);

  const klineData = klineResult.data;
  const klineSource = klineResult.source;

  // 统计指标（只在主组件里算一次传递给子面板）
  const stats = useMemo(() => {
    return calculateKLineStats(klineData);
  }, [klineData]);

  const industryInfo = INDUSTRY_OPTIONS.find(i => i.key === industry) || INDUSTRY_OPTIONS[0];

  // 播放控制（从子面板收回到主组件，避免闭包问题）
  const handlePlay = () => {
    if (isPlaying) {
      musicEngine.stop();
      setIsPlaying(false);
      return;
    }
    logger.session('播放K线音乐', { 行业: industry, 情绪: mood, 数据源: klineSource });
    musicEngine.onProgress = (current, total, note) => {
      setProgress(current);
      setTotalNotes(total);
      setCurrentNote(note);
    };
    musicEngine.onComplete = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentNote(null);
    };
    const info = musicEngine.play(klineData, {
      mood: mood / 100,
      industry: INDUSTRY_OPTIONS.find(i => i.key === industry)?.label.replace(/^[^\s]+\s/, '')
    });
    setMusicInfo(info);
    setIsPlaying(true);
    setProgress(0);
  };

  const handleRegenerate = () => {
    musicEngine.stop();
    setIsPlaying(false);
    setProgress(0);
    setCurrentNote(null);
    setRefreshKey(k => k + 1);
    logger.session('重新生成K线', `数据源:${dataSource}`);
  };

  // 清理
  useEffect(() => {
    return () => {
      musicEngine.stop();
    };
  }, []);

  // 投资人匹配
  const investorMatch = useMemo(() => {
    const userData = investorEngine.extractUserData();
    const matches = investorEngine.matchInvestor(userData);
    const top = matches[0];
    const commonPoints = investorEngine.generateCommonPoints(userData, top.investor);
    const diffPoints = investorEngine.generateDifferencePoints(userData, top.investor);
    return { matches, top, userData, commonPoints, diffPoints };
  }, [refreshKey]);

  const [showRadar, setShowRadar] = useState(false);
  const [circleKey, setCircleKey] = useState(0);
  const [activeNodeId, setActiveNodeId] = useState(null);

  // 认知画圈
  const circle = useMemo(() => {
    try {
      return cognitiveCircleEngine.build({ forceRefresh: circleKey > 0 });
    } catch (e) {
      logger.error('认知画圈构建失败', e);
      return null;
    }
  }, [refreshKey, circleKey]);

  return (
    <div className="psychology-page">
      <Space direction="vertical" size="large" className="psychology-content" style={{ width: '100%' }}>
        <Tabs
          defaultActiveKey="music"
          className="circle-tabs"
          size="large"
          items={[
            {
              key: 'music',
              label: (
                <span><SoundOutlined /> K线音乐 · 投资人匹配</span>
              ),
              children: <KlineAndInvestorPanel {...{
                industry, setIndustry, mood, setMood, dataSource, setDataSource,
                refreshKey, setRefreshKey, pokerGames, klineResult, stats,
                isPlaying, setIsPlaying, progress, setProgress, totalNotes,
                setTotalNotes, currentNote, setCurrentNote, musicInfo, setMusicInfo,
                industryInfo, investorMatch, handlePlay, handleRegenerate
              }} />
            },
            {
              key: 'circle',
              label: (
                <span><RadarChartOutlined /> 认知画圈引擎 · Cognitive Circle</span>
              ),
              children: circle ? (
                <CognitiveCirclePanel
                  circle={circle}
                  activeNodeId={activeNodeId}
                  setActiveNodeId={setActiveNodeId}
                  onRefresh={() => { setCircleKey(k => k + 1); setRefreshKey(k => k + 1); }}
                />
              ) : (
                <Card><Paragraph type="secondary">认知画圈引擎加载中...</Paragraph></Card>
              )
            }
          ]}
        />
      </Space>
    </div>
  );
};

// ============ K线音乐 + 投资人匹配（原内容） ============
const KlineAndInvestorPanel = (props) => {
  const {
    industry, setIndustry, mood, setMood, dataSource, setDataSource,
    setRefreshKey, pokerGames, klineResult, stats,
    isPlaying, setIsPlaying, progress, setProgress, totalNotes,
    setTotalNotes, currentNote, setCurrentNote, musicInfo, setMusicInfo,
    industryInfo, investorMatch, handlePlay, handleRegenerate
  } = props;
  const klineData = klineResult.data;
  const klineSource = klineResult.source;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 标题区 */}
        <Card className="psychology-header-card">
          <Space className="psychology-header-space">
            <Space className="psychology-title-space">
              <div className="psychology-title-icon">🧠</div>
              <div>
                <Title level={3} className="psychology-title-heading">
                  心理盘面 · K线音乐
                </Title>
                <Paragraph className="psychology-title-desc" type="secondary">
                  让数据变成可以听的叙事 —— K线走势 → 音乐表达
                </Paragraph>
              </div>
            </Space>
            <Space>
              <Tag color={klineSource.includes('德州') ? '#52c41a' : '#faad14'} className="psychology-source-tag">
                <DatabaseOutlined /> {klineSource}
              </Tag>
            </Space>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          {/* 左侧：参数控制 */}
          <Col xs={24} lg={8}>
            <Space direction="vertical" size="middle" className="psychology-param-col">
              {/* 数据源选择 */}
              <Card title="数据源" size="small" className="psychology-param-card">
                <Radio.Group
                  value={dataSource}
                  onChange={e => setDataSource(e.target.value)}
                  size="small"
                >
                  <Radio.Button value="auto">自动</Radio.Button>
                  <Radio.Button value="real">真实牌局</Radio.Button>
                  <Radio.Button value="mock">模拟数据</Radio.Button>
                </Radio.Group>
                <div className="psychology-param-history">
                  <Text type="secondary" className="psychology-param-history-text">
                    历史牌局：{pokerGames.length} 局
                  </Text>
                </div>
              </Card>

              {/* 行业选择 */}
              <Card title="行业映射（音色）" size="small" className="psychology-param-card">
                <Select
                  value={industry}
                  onChange={setIndustry}
                  className="psychology-industry-select"
                  size="large"
                >
                  {INDUSTRY_OPTIONS.map(opt => (
                    <Option key={opt.key} value={opt.key}>
                      <span style={{ color: opt.color }}>{opt.label}</span>
                    </Option>
                  ))}
                </Select>
                <Tag color={industryInfo.color} className="psychology-industry-tag">
                  当前音色：{industryInfo.label.replace(/^[^\s]+\s/, '')}
                </Tag>
              </Card>

              {/* 情绪值 */}
              <Card title="心情盘（调性）" size="small" className="psychology-param-card">
                <Slider
                  value={mood}
                  onChange={setMood}
                  marks={MOOD_MARKS}
                  step={null}
                />
                <Row gutter={8} className="psychology-mood-stats">
                  <Col span={12}>
                    <Statistic
                      title="调性"
                      value={mood >= 50 ? '大调' : '小调'}
                      valueStyle={{ color: mood >= 50 ? '#52c41a' : '#eb2f96', fontSize: 18 }}
                      prefix={mood >= 50 ? <HeartOutlined /> : <FallOutlined />}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="情绪值"
                      value={mood}
                      suffix="%"
                      valueStyle={{ fontSize: 18 }}
                    />
                  </Col>
                </Row>
              </Card>

              {/* 播放控制 */}
              <Card size="small" className="psychology-play-card">
                <Space direction="vertical" size="middle" className="psychology-param-col">
                  {musicInfo && (
                    <Row gutter={8} className="psychology-play-info">
                      <Col span={8} className="psychology-play-info-item">
                        <Text type="secondary" className="psychology-play-info-label">BPM</Text>
                        <div className="psychology-play-info-value">{Math.round(musicInfo.bpm)}</div>
                      </Col>
                      <Col span={8} className="psychology-play-info-item">
                        <Text type="secondary" className="psychology-play-info-label">调性</Text>
                        <div className="psychology-play-info-value">{musicInfo.modeLabel}</div>
                      </Col>
                      <Col span={8} className="psychology-play-info-item">
                        <Text type="secondary" className="psychology-play-info-label">音符</Text>
                        <div className="psychology-play-info-value">
                          {currentNote ? `${progress}/${totalNotes}` : totalNotes}
                        </div>
                      </Col>
                    </Row>
                  )}

                  <Progress
                    percent={totalNotes ? (progress / totalNotes) * 100 : 0}
                    showInfo={false}
                    className="psychology-play-progress"
                    strokeColor={{
                      '0%': '#1890ff',
                      '100%': '#D4AF37',
                    }}
                  />

                  <Space className="psychology-play-btns">
                    <Tooltip title={isPlaying ? '停止' : '播放K线音乐'}>
                      <Button
                        type="primary"
                        shape="circle"
                        size="large"
                        icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        onClick={handlePlay}
                        className="psychology-play-main-btn"
                      />
                    </Tooltip>
                    <Tooltip title="重新生成K线">
                      <Button
                        shape="circle"
                        size="large"
                        icon={<ReloadOutlined />}
                        onClick={handleRegenerate}
                      />
                    </Tooltip>
                  </Space>

                  <Text type="secondary" className="psychology-play-hint">
                    <SoundOutlined /> {isPlaying ? '正在播放...' : '点击播放，感受K线的声音'}
                  </Text>
                </Space>
              </Card>

              {/* 映射说明 */}
              <Card size="small" type="inner" className="psychology-map-card">
                <Text type="secondary" className="psychology-map-text">
                  <div><ExperimentOutlined className="psychology-map-title" /> <b>K线 → 音乐映射</b></div>
                  <div>• 价格位置 → 音高（音阶）</div>
                  <div>• 波动幅度 → 节奏 BPM</div>
                  <div>• 行业选择 → 音色（4种波形）</div>
                  <div>• 情绪值 → 调性（大调/小调）</div>
                  <div>• 成交量 → 音量</div>
                </Text>
              </Card>
            </Space>
          </Col>

          {/* 右侧：K线图 + 统计 */}
          <Col xs={24} lg={16}>
            <Space direction="vertical" size="middle" className="psychology-chart-col">
              {/* 统计卡片 */}
              <Row gutter={16}>
                <Col span={6}>
                  <Card size="small" className="psychology-stats-card">
                    <Statistic
                      title="累计收益"
                      value={stats.returnRate}
                      suffix="%"
                      valueStyle={stats.returnRate >= 0 ? { color: '#52c41a', fontSize: 20 } : { color: '#eb2f96', fontSize: 20 }}
                      prefix={stats.returnRate >= 0 ? <RiseOutlined /> : <FallOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" className="psychology-stats-card">
                    <Statistic
                      title="最大回撤"
                      value={stats.maxDD}
                      suffix="%"
                      valueStyle={{ color: '#faad14', fontSize: 20 }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" className="psychology-stats-card">
                    <Statistic
                      title="波动率"
                      value={stats.volatility}
                      suffix="%"
                      valueStyle={{ fontSize: 20 }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" className="psychology-stats-card">
                    <Statistic
                      title="数据点"
                      value={klineData.length}
                      valueStyle={{ fontSize: 20 }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* K线价格图 */}
              <Card
                className="psychology-kline-card"
                title={
                  <Space>
                    <BulbOutlined className="psychology-kline-icon" />
                    <span>K线价格走势</span>
                    {isPlaying && (
                      <Tag color="#1890ff" icon={<SoundOutlined />} className="psychology-kline-tag">
                        正在播放 {progress}/{totalNotes}
                      </Tag>
                    )}
                  </Space>
                }
                size="small"
                extra={
                  <Text type="secondary" className="psychology-kline-extra">
                    {currentNote ? `当前位置: 第${currentNote.index}根K线` : '点击播放查看同步高亮'}
                  </Text>
                }
              >
                <div className="psychology-kline-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={klineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 11 }}
                        axisLine={{ stroke: '#ddd' }}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 11 }}
                        axisLine={{ stroke: '#ddd' }}
                        tickFormatter={v => v.toFixed(0)}
                      />
                      <RTooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #eee' }}
                        labelFormatter={label => `第 ${label} 根K线`}
                        formatter={(value, name) => {
                          const names = {
                            close: '收盘价',
                            open: '开盘价',
                            high: '最高价',
                            low: '最低价',
                            volume: '成交量'
                          };
                          return [Number(value).toFixed(2), names[name] || name];
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke="#1890ff"
                        strokeWidth={2}
                        fill="url(#colorPrice)"
                        dot={false}
                        activeDot={{ r: 6, fill: '#1890ff', stroke: '#fff', strokeWidth: 2 }}
                      />
                      {currentNote && (
                        <ReferenceLine
                          x={currentNote.index}
                          stroke="#faad14"
                          strokeWidth={3}
                          strokeDasharray="5 5"
                          label={{
                            value: '♪',
                            position: 'top',
                            fill: '#faad14',
                            fontSize: 16
                          }}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* 成交量图 */}
              <Card title="成交量" size="small" className="psychology-volume-card">
                <div className="psychology-volume-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={klineData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <XAxis dataKey="time" tick={false} axisLine={false} />
                      <YAxis tick={false} axisLine={false} />
                      <Bar
                        dataKey="volume"
                        fill={stats.returnRate >= 0 ? '#52c41a' : '#eb2f96'}
                        opacity={0.7}
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Space>
          </Col>
        </Row>

        {/* 投资人匹配卡片 */}
        <Card
          className="psychology-investor-card"
          title={
            <Space>
              <span className="psychology-investor-title-icon">🧑‍💼</span>
              <span>你今夜最接近的投资人</span>
            </Space>
          }
          extra={
            <Space>
              <Tag color="#D4AF37" className="psychology-investor-similarity">
                相似度 {investorMatch.top.similarity}%
              </Tag>
            </Space>
          }
        >
          <Row gutter={[24, 16]}>
            <Col xs={24} md={10}>
              <div className="psychology-investor-profile">
                <div className="psychology-investor-avatar">
                  {investorMatch.top.investor.emoji}
                </div>
                <div>
                  <Title level={4} className="psychology-investor-name">
                    {investorMatch.top.investor.name}
                  </Title>
                  <Text type="secondary" className="psychology-investor-mbti">
                    {investorMatch.top.investor.mbti} · {investorMatch.top.investor.mbtiLabel}
                  </Text>
                  <div className="psychology-investor-style">
                    <Text type="secondary" className="psychology-investor-style-text">
                      {investorMatch.top.investor.decisionStyle}
                    </Text>
                  </div>
                </div>
              </div>

              <div className="psychology-investor-quote">
                <Text type="secondary" className="psychology-investor-quote-label">💬 名言</Text>
                <Paragraph className="psychology-investor-quote-text">
                  "{investorMatch.top.investor.famousQuote}"
                </Paragraph>
              </div>

              <div className="psychology-investor-desc">
                <Text type="secondary" className="psychology-investor-desc-text">
                  {investorMatch.top.investor.matchDescription}
                </Text>
              </div>
            </Col>

            <Col xs={24} md={14}>
              <div className="psychology-investor-common">
                <Text strong className="psychology-investor-common-title">📌 你们的共同点：</Text>
                <Space direction="vertical" size={4} className="psychology-investor-common-list">
                  {investorMatch.commonPoints.length > 0 ? (
                    investorMatch.commonPoints.map((p, i) => (
                      <Text key={i} className="psychology-investor-common-item">{p}</Text>
                    ))
                  ) : (
                    <Text type="secondary" className="psychology-investor-empty-hint">多玩几局，系统会识别更多共同点</Text>
                  )}
                </Space>
              </div>

              {investorMatch.diffPoints.length > 0 && (
                <div className="psychology-investor-diff">
                  <Text strong className="psychology-investor-diff-title">🔍 你们的差异：</Text>
                  <Space direction="vertical" size={4} className="psychology-investor-diff-list">
                    {investorMatch.diffPoints.map((p, i) => (
                      <Text key={i} className="psychology-investor-diff-item">{p}</Text>
                    ))}
                  </Space>
                </div>
              )}

              {/* 五维对比条 */}
              <Divider className="psychology-compare-divider" />
              <Text type="secondary" className="psychology-compare-label">五维对比（你 vs {investorMatch.top.investor.name}）</Text>
              <Space direction="vertical" size={8} className="psychology-compare-list">
                {[
                  { key: 'riskTolerance', label: '风险容忍度' },
                  { key: 'timePreference', label: '时间偏好' },
                  { key: 'executionDiscipline', label: '执行纪律' },
                  { key: 'reflectionDeviation', label: '路径预判' },
                  { key: 'aimPrecision', label: '决策精度' }
                ].map(dim => {
                  const userVal = investorMatch.userData[dim.key] || 50;
                  const invVal = investorMatch.top.investor[dim.key] || 50;
                  return (
                    <div key={dim.key} className="psychology-compare-item">
                      <Row gutter={8} align="middle">
                        <Col span={6}>
                          <Text type="secondary" className="psychology-compare-dim">{dim.label}</Text>
                        </Col>
                        <Col span={9}>
                          <Progress
                            percent={userVal}
                            showInfo={false}
                            size="small"
                            strokeColor="#1890ff"
                          />
                        </Col>
                        <Col span={9}>
                          <Progress
                            percent={invVal}
                            showInfo={false}
                            size="small"
                            strokeColor="#D4AF37"
                          />
                        </Col>
                      </Row>
                    </div>
                  );
                })}
              </Space>
              <Row gutter={8} className="psychology-compare-legend">
                <Col span={6}></Col>
                <Col span={9}>
                  <Text type="secondary" className="psychology-compare-legend-user">你</Text>
                </Col>
                <Col span={9}>
                  <Text type="secondary" className="psychology-compare-legend-investor">
                    {investorMatch.top.investor.name}
                  </Text>
                </Col>
              </Row>

              {/* 更多推荐 */}
              <Divider className="psychology-more-divider" />
              <Text type="secondary" className="psychology-more-label">其他相似投资人：</Text>
              <div className="psychology-more-list">
                {investorMatch.matches.slice(1, 4).map((m, i) => (
                  <Tag key={i} color="default" className="psychology-more-tag">
                    {m.investor.emoji} {m.investor.name} · {m.similarity}%
                  </Tag>
                ))}
              </div>
            </Col>
          </Row>
        </Card>
      </Space>
  );
};

// ============ 认知画圈面板 ============
const CognitiveCirclePanel = ({ circle, activeNodeId, setActiveNodeId, onRefresh }) => {
  const { nodes, edges, layers, insights, stats, sources, dimensions } = circle;
  // ✦ AI 人格简报(DeepSeek 点亮工程 · 登录态真调)
  const [aiBrief, setAiBrief] = useState(null);
  const [aiBriefLoading, setAiBriefLoading] = useState(false);
  const hasToken = !!localStorage.getItem('auth_token');
  const handleAiBrief = async () => {
    if (aiBriefLoading) return;
    setAiBriefLoading(true);
    setAiBrief(null);
    try {
      const DIM_LABELS = { risk: '风险承受', speed: '决策速度', grit: '执行韧性', social: '社交开放', emotionStability: '情绪稳定', openness: '开放探索' };
      const entries = Object.entries(dimensions || {}).filter(([, v]) => typeof v === 'number');
      const sorted = [...entries].sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, 2).map(([k, v]) => `${DIM_LABELS[k] || k} ${Math.round(v * 100)}%`).join('、');
      const dimsSummary = sorted.map(([k, v]) => `${DIM_LABELS[k] || k} ${Math.round(v * 100)}%`).join('，').slice(0, 160);
      const topLabel = sorted.length ? (DIM_LABELS[sorted[0][0]] || sorted[0][0]) : '均衡';
      const res = await apiClient.llmGenerate('psych_brief', {
        persona_type: `${topLabel}主导型`,
        strengths: top || '各维度均衡',
        today_focus: String(insights?.[0]?.text || '保持觉察').slice(0, 100),
        dims_summary: dimsSummary || '暂无数据',
      });
      if (res?.text) setAiBrief(res.text);
    } catch (e) {
      logger.error('[AI简报] 失败', e);
    } finally {
      setAiBriefLoading(false);
    }
  };
  const width = 640;
  const height = 640;
  const cx = width / 2;
  const cy = height / 2;

  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));

  const polar = (angleDeg, radius) => {
    const a = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  };

  const getNodePos = (n) => {
    const layer = n.layer || 'support';
    const r = layer === 'core' ? 95 : layer === 'support' ? 190 : 275;
    return polar(n.angle || 0, r);
  };

  const edgeClassMap = {
    reinforce: 'reinforce',
    balance: 'balance',
    complement: 'complement',
    conflict: 'conflict',
  };

  const activeNode = activeNodeId ? nodeById[activeNodeId] : null;

  return (
    <div className="cognitive-circle-panel">
      {/* 顶部指标 */}
      <div className="circle-top-stats">
        <span className="circle-stat-chip">
          <RadarChartOutlined /> 数据源：<strong>{sources.join(' · ') || '本地默认'}</strong>
        </span>
        <span className="circle-stat-chip">
          <ThunderboltOutlined /> 节点：<strong>{stats.nodeCount}</strong> · 关系：<strong>{stats.edgeCount}</strong>
        </span>
        <span className="circle-stat-chip">
          锚点 <strong>{stats.anchorCount}</strong> · 音乐气质 <strong>{stats.musicCount}</strong>
        </span>
        <Button
          type="primary"
          size="small"
          className="circle-refresh-btn"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
        >
          刷新画圈
        </Button>
      </div>

      <div className="circle-main-grid">
        {/* 左：可视化画布 */}
        <Card
          className="cognitive-canvas-card"
          title={<span className="cognitive-canvas-title"><RadarChartOutlined /> 认知拓扑 · 三层画圈</span>}
          size="small"
          bodyStyle={{ padding: '12px 16px 8px' }}
        >
          <div className="cognitive-canvas">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
              {/* 三环 */}
              <circle cx={cx} cy={cy} r={95} className="circle-ring core" />
              <circle cx={cx} cy={cy} r={190} className="circle-ring support" />
              <circle cx={cx} cy={cy} r={275} className="circle-ring edge" />
              <text x={cx} y={cy - 95 - 8} className="circle-label">核 心 盘</text>
              <text x={cx} y={cy - 190 - 8} className="circle-label">支 撑 圈</text>
              <text x={cx} y={cy - 275 - 8} className="circle-label">探 索 带</text>

              {/* 中心自我 */}
              <g>
                <circle cx={cx} cy={cy} r={38} fill="url(#centerGrad)" opacity={0.9} />
                <defs>
                  <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
                    <stop offset="60%" stopColor="#a855f7" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.2" />
                  </radialGradient>
                </defs>
                <text x={cx} y={cy - 2} className="circle-node-emoji" style={{ fontSize: 22 }}>🪐</text>
                <text x={cx} y={cy + 18} style={{ fontSize: 11, fill: '#fff', textAnchor: 'middle', fontWeight: 700, letterSpacing: 1 }}>SELF</text>
              </g>

              {/* 边 */}
              {edges.map((e, i) => {
                const a = nodeById[e.from];
                const b = nodeById[e.to];
                if (!a || !b) return null;
                const pa = getNodePos(a);
                const pb = getNodePos(b);
                const mx = (pa.x + pb.x) / 2;
                const my = (pa.y + pb.y) / 2;
                const dx = pb.x - pa.x;
                const dy = pb.y - pa.y;
                const nx = -dy;
                const ny = dx;
                const len = Math.sqrt(nx * nx + ny * ny) || 1;
                const bulge = 36 * (e.strength || 0.5);
                const cx2 = mx + (nx / len) * bulge;
                const cy2 = my + (ny / len) * bulge;
                const d = `M ${pa.x} ${pa.y} Q ${cx2} ${cy2} ${pb.x} ${pb.y}`;
                const dim = activeNodeId && e.from !== activeNodeId && e.to !== activeNodeId ? 0.18 : 1;
                return (
                  <path
                    key={`e-${i}`}
                    d={d}
                    className={`circle-edge ${edgeClassMap[e.type] || 'balance'}`}
                    strokeWidth={1 + (e.strength || 0.5) * 2}
                    opacity={0.75 * dim}
                  />
                );
              })}

              {/* 节点 */}
              {nodes.map((n) => {
                const pos = getNodePos(n);
                const color = n.color || '#a855f7';
                const isActive = activeNodeId === n.id;
                const r = 13 + (n.weight || 0.5) * 10;
                return (
                  <g
                    key={n.id}
                    className="circle-node-group"
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => setActiveNodeId?.(isActive ? null : n.id)}
                    style={{ color }}
                  >
                    <circle
                      className="circle-node-core"
                      r={r + (isActive ? 4 : 0)}
                      fill="rgba(10,10,15,0.92)"
                      stroke={color}
                      strokeWidth={isActive ? 3 : 1.8}
                    />
                    <text className="circle-node-emoji" y={-4}>{n.emoji || '🔮'}</text>
                    <text
                      className="circle-node-label"
                      y={r + 14}
                      style={{ fontSize: n.layer === 'core' ? 12 : 11 }}
                    >
                      {(n.label || '').length > 10 ? (n.label || '').slice(0, 9) + '…' : (n.label || '')}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* 图例 */}
          <div className="circle-legend">
            <span className="circle-legend-item"><span className="circle-legend-swatch reinforce" />强化 · 同向推波</span>
            <span className="circle-legend-item"><span className="circle-legend-swatch balance" />牵制 · 相互制衡</span>
            <span className="circle-legend-item"><span className="circle-legend-swatch complement" />互补 · 补足盲区</span>
            <span className="circle-legend-item"><span className="circle-legend-swatch conflict" />冲突 · 内耗源</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>点击节点查看详情</span>
          </div>
        </Card>

        {/* 右：信息列 */}
        <div className="circle-side-col">
          <Row gutter={[12, 12]}>
            <Col xs={12}>
              <Card size="small" className="circle-harmony-card">
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <h3>🧲 认知协同度</h3>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Statistic
                        title="合力占比"
                        value={layers.harmony.synergy}
                        suffix="%"
                        valueStyle={{ color: '#10b981', fontSize: 20 }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="内耗占比"
                        value={layers.harmony.friction}
                        suffix="%"
                        valueStyle={{ color: layers.harmony.friction > 25 ? '#fb7185' : '#f59e0b', fontSize: 20 }}
                      />
                    </Col>
                  </Row>
                </Space>
              </Card>
            </Col>
            <Col xs={12}>
              <Card size="small" className="circle-meta-card">
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Text type="secondary" style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                    <DatabaseOutlined /> 三层分布
                  </Text>
                  <div className="layer-breakdown">
                    <div className="layer-breakdown-item core">
                      <span className="layer-breakdown-name">核心盘</span>
                      <span className="layer-breakdown-count">{layers.core.nodes.length} 节点 · 稳定驱动</span>
                    </div>
                    <div className="layer-breakdown-item support">
                      <span className="layer-breakdown-name">支撑圈</span>
                      <span className="layer-breakdown-count">{layers.support.nodes.length} 节点 · 常用可调用</span>
                    </div>
                    <div className="layer-breakdown-item edge">
                      <span className="layer-breakdown-name">探索带</span>
                      <span className="layer-breakdown-count">{layers.edge.nodes.length} 节点 · 待浇灌</span>
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>

          {/* 选中节点详情 */}
          {activeNode && (
            <Card
              size="small"
              title={<span style={{ color: '#e9d5ff', fontSize: 13 }}>🎯 {activeNode.label}</span>}
              style={{
                background: `linear-gradient(135deg, ${activeNode.color}22, rgba(10,10,15,0.6))`,
                border: `1px solid ${activeNode.color}66`
              }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Paragraph style={{ color: '#fff', margin: 0, fontSize: 13, lineHeight: 1.7 }}>
                  {activeNode.summary || '—'}
                </Paragraph>
                <Row gutter={8}>
                  <Col span={8}>
                    <Statistic
                      title="权重"
                      value={Math.round((activeNode.weight || 0) * 100)}
                      suffix="%"
                      valueStyle={{ fontSize: 16, color: activeNode.color }}
                    />
                  </Col>
                  <Col span={8}>
                    <Text type="secondary" style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                      所在圈层
                    </Text>
                    <div>
                      <Tag color={activeNode.layer === 'core' ? 'gold' : activeNode.layer === 'support' ? 'purple' : 'cyan'}>
                        {activeNode.layer === 'core' ? '核心盘' : activeNode.layer === 'support' ? '支撑圈' : '探索带'}
                      </Tag>
                    </div>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary" style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                      关联关系
                    </Text>
                    <div style={{ fontSize: 16, color: '#faf5ff', fontWeight: 700 }}>
                      {edges.filter(e => e.from === activeNode.id || e.to === activeNode.id).length}
                    </div>
                  </Col>
                </Row>
                {activeNode.tags?.length > 0 && (
                  <Space wrap>
                    {activeNode.tags.map((t, i) => (
                      <Tag key={i} color="#a855f7" style={{ background: 'rgba(168,85,247,0.15)' }}>#{t}</Tag>
                    ))}
                  </Space>
                )}
              </Space>
            </Card>
          )}

          {/* 节点列表 */}
          <Card
            size="small"
            title={<span style={{ color: '#c4b5fd', fontSize: 13 }}>🧩 认知节点清单</span>}
            className="circle-nodes-card"
            bodyStyle={{ padding: 12 }}
          >
            <div className="circle-nodes-list">
              {[...nodes].sort((a, b) => (b.weight || 0) - (a.weight || 0)).map((n) => (
                <div
                  key={n.id}
                  className="circle-node-card"
                  onClick={() => setActiveNodeId?.(activeNodeId === n.id ? null : n.id)}
                  style={{
                    borderColor: activeNodeId === n.id ? n.color : undefined,
                    background: activeNodeId === n.id ? `${n.color}18` : undefined
                  }}
                >
                  <div
                    className="circle-node-avatar"
                    style={{ background: `${n.color}33`, color: n.color, border: `1px solid ${n.color}88` }}
                  >
                    {n.emoji || '🔮'}
                  </div>
                  <div className="circle-node-info">
                    <div className="circle-node-title">
                      <span>{n.label}</span>
                      <span className={`circle-node-layer-tag ${n.layer}`}>
                        {n.layer === 'core' ? '核心盘' : n.layer === 'support' ? '支撑圈' : '探索带'}
                      </span>
                    </div>
                    <div className="circle-node-summary">{n.summary || '—'}</div>
                    {n.tags?.length > 0 && (
                      <div className="circle-node-tags">
                        {n.tags.slice(0, 3).map((t, i) => (
                          <span key={i} className="circle-node-tag">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* 洞察卡片 */}
      <Card
        className="circle-insights-card"
        title={<span style={{ color: '#e9d5ff', fontSize: 14 }}><ThunderboltOutlined /> 认知洞察 · Insights</span>}
        bodyStyle={{ padding: '8px 16px 16px' }}
      >
        <div className="circle-insights-grid">
          {insights.map((ins, i) => {
            const iconMap = { primary: '🪐', good: '✅', warn: '⚠️', info: '💡' };
            return (
              <div key={i} className={`circle-insight-item ${ins.level || 'info'}`}>
                <div className="circle-insight-title">
                  <span>{iconMap[ins.level] || '💡'}</span>
                  <span>{ins.title}</span>
                </div>
                <div className="circle-insight-text">{ins.text}</div>
              </div>
            );
          })}
        </div>

        {/* ✦ AI 人格简报(登录解锁) */}
        <div style={{ marginTop: 14 }}>
          {hasToken ? (
            <div>
              <Button
                size="small"
                loading={aiBriefLoading}
                onClick={handleAiBrief}
                style={{ background: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.35)', color: '#D4AF37' }}
              >
                {aiBrief ? '重新生成简报' : '✦ 生成 AI 人格简报'}
              </Button>
              {aiBrief && (
                <div style={{ marginTop: 12, padding: '14px 18px', background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: '#D4AF37', letterSpacing: 1, marginBottom: 6 }}>✦ AI 人格洞察分析师 · 本期简报</div>
                  <div style={{ fontSize: 13, lineHeight: 1.9, color: 'rgba(255,255,255,0.88)', whiteSpace: 'pre-wrap' }}>{aiBrief}</div>
                </div>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'rgba(212,175,55,0.6)' }}>✦ 登录后可生成 AI 人格简报</span>
          )}
        </div>

        {/* 维度雷达辅助条（六维展示） */}
        <Divider style={{ borderColor: 'rgba(168,85,247,0.2)', margin: '20px 0 12px' }} />
        <Text type="secondary" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          📏 六维基线（融合音乐画像向量权重 30%）
        </Text>
        <Row gutter={[12, 10]} style={{ marginTop: 8 }}>
          {[
            { k: 'risk', label: '风险承受度', color: '#22d3ee' },
            { k: 'speed', label: '决策速度', color: '#f472b6' },
            { k: 'grit', label: '执行韧性', color: '#10b981' },
            { k: 'social', label: '社交开放度', color: '#a855f7' },
            { k: 'emotionStability', label: '情绪稳定性', color: '#f59e0b' },
            { k: 'openness', label: '开放探索度', color: '#38bdf8' },
          ].map((d) => (
            <Col xs={24} sm={12} md={8} key={d.k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{d.label}</Text>
                <Text style={{ fontSize: 12, color: d.color, fontWeight: 700 }}>
                  {Math.round((dimensions[d.k] || 0) * 100)}%
                </Text>
              </div>
              <Progress
                percent={Math.round((dimensions[d.k] || 0) * 100)}
                showInfo={false}
                size="small"
                strokeColor={d.color}
                trailColor="rgba(255,255,255,0.08)"
              />
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

export default PsychologyPage;
