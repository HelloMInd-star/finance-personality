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
  Divider
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
  ExperimentOutlined
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
import { logger } from '../utils/logger';

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

  // 统计指标
  const stats = useMemo(() => {
    return calculateKLineStats(klineData);
  }, [klineData]);

  // 播放控制
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

  // 重新生成
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

  const industryInfo = INDUSTRY_OPTIONS.find(i => i.key === industry) || INDUSTRY_OPTIONS[0];

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

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 标题区 */}
        <Card>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space align="center">
              <div style={{ fontSize: 48 }}>🧠</div>
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  心理盘面 · K线音乐
                </Title>
                <Paragraph style={{ margin: '8px 0 0' }} type="secondary">
                  让数据变成可以听的叙事 —— K线走势 → 音乐表达
                </Paragraph>
              </div>
            </Space>
            <Space>
              <Tag color={klineSource.includes('德州') ? '#52c41a' : '#faad14'}>
                <DatabaseOutlined /> {klineSource}
              </Tag>
            </Space>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          {/* 左侧：参数控制 */}
          <Col xs={24} lg={8}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* 数据源选择 */}
              <Card title="数据源" size="small">
                <Radio.Group
                  value={dataSource}
                  onChange={e => setDataSource(e.target.value)}
                  size="small"
                >
                  <Radio.Button value="auto">自动</Radio.Button>
                  <Radio.Button value="real">真实牌局</Radio.Button>
                  <Radio.Button value="mock">模拟数据</Radio.Button>
                </Radio.Group>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    历史牌局：{pokerGames.length} 局
                  </Text>
                </div>
              </Card>

              {/* 行业选择 */}
              <Card title="行业映射（音色）" size="small">
                <Select
                  value={industry}
                  onChange={setIndustry}
                  style={{ width: '100%' }}
                  size="large"
                >
                  {INDUSTRY_OPTIONS.map(opt => (
                    <Option key={opt.key} value={opt.key}>
                      <span style={{ color: opt.color }}>{opt.label}</span>
                    </Option>
                  ))}
                </Select>
                <Tag color={industryInfo.color} style={{ marginTop: 8 }}>
                  当前音色：{industryInfo.label.replace(/^[^\s]+\s/, '')}
                </Tag>
              </Card>

              {/* 情绪值 */}
              <Card title="心情盘（调性）" size="small">
                <Slider
                  value={mood}
                  onChange={setMood}
                  marks={MOOD_MARKS}
                  step={null}
                />
                <Row gutter={8}>
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
              <Card size="small">
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  {musicInfo && (
                    <Row gutter={8}>
                      <Col span={8}>
                        <Text type="secondary" style={{ fontSize: 12 }}>BPM</Text>
                        <div style={{ fontWeight: 600 }}>{Math.round(musicInfo.bpm)}</div>
                      </Col>
                      <Col span={8}>
                        <Text type="secondary" style={{ fontSize: 12 }}>调性</Text>
                        <div style={{ fontWeight: 600 }}>{musicInfo.modeLabel}</div>
                      </Col>
                      <Col span={8}>
                        <Text type="secondary" style={{ fontSize: 12 }}>音符</Text>
                        <div style={{ fontWeight: 600 }}>
                          {currentNote ? `${progress}/${totalNotes}` : totalNotes}
                        </div>
                      </Col>
                    </Row>
                  )}

                  <Progress
                    percent={totalNotes ? (progress / totalNotes) * 100 : 0}
                    showInfo={false}
                    strokeColor={{
                      '0%': '#1890ff',
                      '100%': '#D4AF37',
                    }}
                  />

                  <Space style={{ width: '100%', justifyContent: 'center' }}>
                    <Tooltip title={isPlaying ? '停止' : '播放K线音乐'}>
                      <Button
                        type="primary"
                        shape="circle"
                        size="large"
                        icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        onClick={handlePlay}
                        style={{ width: 64, height: 64, fontSize: 32 }}
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

                  <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
                    <SoundOutlined /> {isPlaying ? '正在播放...' : '点击播放，感受K线的声音'}
                  </Text>
                </Space>
              </Card>

              {/* 映射说明 */}
              <Card size="small" type="inner">
                <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.8 }}>
                  <div><ExperimentOutlined style={{ color: '#D4AF37' }} /> <b>K线 → 音乐映射</b></div>
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
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* 统计卡片 */}
              <Row gutter={16}>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="累计收益"
                      value={stats.returnRate}
                      suffix="%"
                      valueStyle={{ color: stats.returnRate >= 0 ? '#52c41a' : '#eb2f96', fontSize: 20 }}
                      prefix={stats.returnRate >= 0 ? <RiseOutlined /> : <FallOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="最大回撤"
                      value={stats.maxDD}
                      suffix="%"
                      valueStyle={{ color: '#faad14', fontSize: 20 }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="波动率"
                      value={stats.volatility}
                      suffix="%"
                      valueStyle={{ fontSize: 20 }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
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
                title={
                  <Space>
                    <BulbOutlined style={{ color: '#faad14' }} />
                    <span>K线价格走势</span>
                    {isPlaying && (
                      <Tag color="#1890ff" icon={<SoundOutlined />}>
                        正在播放 {progress}/{totalNotes}
                      </Tag>
                    )}
                  </Space>
                }
                size="small"
                extra={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {currentNote ? `当前位置: 第${currentNote.index}根K线` : '点击播放查看同步高亮'}
                  </Text>
                }
              >
                <div style={{ height: 320 }}>
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
              <Card title="成交量" size="small">
                <div style={{ height: 80 }}>
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
          title={
            <Space>
              <span style={{ fontSize: 22 }}>🧑‍💼</span>
              <span>你今夜最接近的投资人</span>
            </Space>
          }
          extra={
            <Space>
              <Tag color="#D4AF37">
                相似度 {investorMatch.top.similarity}%
              </Tag>
            </Space>
          }
        >
          <Row gutter={[24, 16]}>
            <Col xs={24} md={10}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 16,
                background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(212,175,55,0.02))',
                borderRadius: 12,
                border: '1px solid rgba(212,175,55,0.2)'
              }}>
                <div style={{
                  fontSize: 56,
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {investorMatch.top.investor.emoji}
                </div>
                <div>
                  <Title level={4} style={{ margin: 0, color: '#D4AF37' }}>
                    {investorMatch.top.investor.name}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {investorMatch.top.investor.mbti} · {investorMatch.top.investor.mbtiLabel}
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {investorMatch.top.investor.decisionStyle}
                    </Text>
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: 16,
                padding: 16,
                background: 'rgba(0,0,0,0.2)',
                borderRadius: 8,
                borderLeft: '3px solid #D4AF37'
              }}>
                <Text type="secondary" style={{ fontSize: 12 }}>💬 名言</Text>
                <Paragraph style={{ margin: '4px 0 0', color: '#fff', fontStyle: 'italic' }}>
                  "{investorMatch.top.investor.famousQuote}"
                </Paragraph>
              </div>

              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {investorMatch.top.investor.matchDescription}
                </Text>
              </div>
            </Col>

            <Col xs={24} md={14}>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ color: '#52c41a' }}>📌 你们的共同点：</Text>
                <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 8 }}>
                  {investorMatch.commonPoints.length > 0 ? (
                    investorMatch.commonPoints.map((p, i) => (
                      <Text key={i} style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{p}</Text>
                    ))
                  ) : (
                    <Text type="secondary" style={{ fontSize: 13 }}>多玩几局，系统会识别更多共同点</Text>
                  )}
                </Space>
              </div>

              {investorMatch.diffPoints.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ color: '#faad14' }}>🔍 你们的差异：</Text>
                  <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 8 }}>
                    {investorMatch.diffPoints.map((p, i) => (
                      <Text key={i} style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{p}</Text>
                    ))}
                  </Space>
                </div>
              )}

              {/* 五维对比条 */}
              <Divider style={{ margin: '8px 0' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>五维对比（你 vs {investorMatch.top.investor.name}）</Text>
              <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
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
                    <div key={dim.key}>
                      <Row gutter={8} align="middle">
                        <Col span={6}>
                          <Text type="secondary" style={{ fontSize: 12 }}>{dim.label}</Text>
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
              <Row gutter={8} style={{ marginTop: 4 }}>
                <Col span={6}></Col>
                <Col span={9}>
                  <Text type="secondary" style={{ fontSize: 11 }}>你</Text>
                </Col>
                <Col span={9}>
                  <Text type="secondary" style={{ fontSize: 11, color: '#D4AF37' }}>
                    {investorMatch.top.investor.name}
                  </Text>
                </Col>
              </Row>

              {/* 更多推荐 */}
              <Divider style={{ margin: '16px 0 8px' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>其他相似投资人：</Text>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {investorMatch.matches.slice(1, 4).map((m, i) => (
                  <Tag key={i} color="default" style={{ padding: '4px 10px', fontSize: 12 }}>
                    {m.investor.emoji} {m.investor.name} · {m.similarity}%
                  </Tag>
                ))}
              </div>
            </Col>
          </Row>
        </Card>
      </Space>
    </div>
  );
};

export default PsychologyPage;
