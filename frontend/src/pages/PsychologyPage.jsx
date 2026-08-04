import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Divider,
  Statistic
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SoundOutlined,
  HeartOutlined,
  RiseOutlined,
  FallOutlined,
  BulbOutlined
} from '@ant-design/icons';
import {
  LineChart,
  Line,
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
import { musicEngine, generateMockKLine } from '../utils/musicEngine';
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
  const [volatility, setVolatility] = useState(25);
  const [trend, setTrend] = useState(0);

  // 音乐状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalNotes, setTotalNotes] = useState(0);
  const [currentNote, setCurrentNote] = useState(null);
  const [musicInfo, setMusicInfo] = useState(null);

  // K线数据
  const klineResult = useMemo(() => {
    return generateMockKLine(30, {
      startPrice: 100,
      volatility: volatility / 1000,
      trend: (trend - 50) / 500,
      industry
    });
  }, [industry, volatility, trend]);

  const klineData = klineResult.data;

  // 计算统计指标
  const stats = useMemo(() => {
    if (!klineData.length) return { returnRate: 0, maxDD: 0, volatility: 0 };
    const start = klineData[0].close;
    const end = klineData[klineData.length - 1].close;
    const returnRate = ((end - start) / start) * 100;

    // 最大回撤
    let peak = klineData[0].close;
    let maxDD = 0;
    for (const d of klineData) {
      if (d.close > peak) peak = d.close;
      const dd = ((peak - d.close) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }

    return {
      returnRate: returnRate.toFixed(2),
      maxDD: maxDD.toFixed(2),
      volatility: (volatility / 10).toFixed(1)
    };
  }, [klineData, volatility]);

  // 播放控制
  const handlePlay = () => {
    if (isPlaying) {
      musicEngine.stop();
      setIsPlaying(false);
      return;
    }

    logger.session('播放K线音乐', { 行业: industry, 情绪: mood, 波动率: volatility });

    musicEngine.onProgress = (current, total, note) => {
      setProgress(current);
      setTotalNotes(total);
      setCurrentNote(note);
    };
    musicEngine.onComplete = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    const info = musicEngine.play(klineData, {
      mood: mood / 100,
      industry
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
    // 强制重新生成（用时间戳触发）
    setVolatility(v => v === 25 ? 26 : 25);
    setTimeout(() => setVolatility(25), 10);
    logger.session('重新生成K线数据');
  };

  // 清理
  useEffect(() => {
    return () => {
      musicEngine.stop();
    };
  }, []);

  const industryInfo = INDUSTRY_OPTIONS.find(i => i.key === industry) || INDUSTRY_OPTIONS[0];

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* 标题区 */}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space align="center">
            <div style={{ fontSize: 48 }}>🧠</div>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                心理盘面 · K线音乐
              </Title>
              <Paragraph style={{ margin: '8px 0 0' }} type="secondary">
                让数据变成可以听的叙事 —— 调整参数，感受市场情绪的声音表达
              </Paragraph>
            </div>
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          {/* 左侧：参数控制 */}
          <Col xs={24} lg={8}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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

              {/* 波动率 */}
              <Card title="波动率（节奏）" size="small">
                <Slider
                  value={volatility}
                  onChange={setVolatility}
                  min={5}
                  max={80}
                  marks={{ 5: '稳', 40: '中', 80: '狂' }}
                />
                <Text type="secondary">波动越大，音乐节奏越快</Text>
              </Card>

              {/* 趋势 */}
              <Card title="趋势方向" size="small">
                <Slider
                  value={trend}
                  onChange={setTrend}
                  marks={{ 0: '⬇ 下跌', 50: '→ 震荡', 100: '⬆ 上涨' }}
                />
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
                        <div style={{ fontWeight: 600 }}>{musicInfo.totalNotes}</div>
                      </Col>
                    </Row>
                  )}

                  <Progress
                    percent={totalNotes ? (progress / totalNotes) * 100 : 0}
                    showInfo={false}
                    strokeColor="#1890ff"
                  />

                  <Space style={{ width: '100%', justifyContent: 'center' }}>
                    <Tooltip title={isPlaying ? '停止' : '播放'}>
                      <Button
                        type="primary"
                        shape="circle"
                        size="large"
                        icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        onClick={handlePlay}
                        style={{ width: 56, height: 56, fontSize: 28 }}
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
                    <SoundOutlined /> 点击播放，感受K线的声音
                  </Text>
                </Space>
              </Card>
            </Space>
          </Col>

          {/* 右侧：K线图 + 统计 */}
          <Col xs={24} lg={16}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* 统计卡片 */}
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="累计收益"
                      value={stats.returnRate}
                      suffix="%"
                      valueStyle={{ color: parseFloat(stats.returnRate) >= 0 ? '#52c41a' : '#eb2f96' }}
                      prefix={parseFloat(stats.returnRate) >= 0 ? <RiseOutlined /> : <FallOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="最大回撤"
                      value={stats.maxDD}
                      suffix="%"
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="波动率"
                      value={stats.volatility}
                      suffix="%"
                    />
                  </Card>
                </Col>
              </Row>

              {/* K线价格图 */}
              <Card
                title={
                  <Space>
                    <BulbOutlined style={{ color: '#faad14' }} />
                    <span>K线价格走势（播放时高亮当前音符位置）</span>
                  </Space>
                }
                size="small"
              >
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={klineData}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                      <RTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div style={{ background: '#fff', padding: 8, border: '1px solid #eee', borderRadius: 4 }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>第 {d.time} 根K线</div>
                                <div>开: <b>{d.open}</b></div>
                                <div>高: <b style={{ color: '#52c41a' }}>{d.high}</b></div>
                                <div>低: <b style={{ color: '#eb2f96' }}>{d.low}</b></div>
                                <div>收: <b>{d.close}</b></div>
                                <div>量: <b>{d.volume}</b></div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke="#1890ff"
                        strokeWidth={2}
                        fill="url(#colorPrice)"
                        dot={false}
                        activeDot={{ r: 6, fill: '#1890ff' }}
                      />
                      {currentNote && (
                        <ReferenceLine
                          x={currentNote.index}
                          stroke="#faad14"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* 成交量图 */}
              <Card title="成交量" size="small">
                <div style={{ height: 100 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={klineData}>
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Bar dataKey="volume" fill="#52c41a" opacity={0.6} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* 说明 */}
              <Card size="small" type="inner">
                <Text type="secondary">
                  💡 <b>音乐映射逻辑：</b>
                  K线波动幅度 → 节奏BPM &nbsp;|&nbsp;
                  行业选择 → 音色（方波/正弦/三角/锯齿） &nbsp;|&nbsp;
                  情绪值 → 调性（大调/小调） &nbsp;|&nbsp;
                  价格位置 → 音高
                </Text>
              </Card>
            </Space>
          </Col>
        </Row>
      </Space>
    </div>
  );
};

export default PsychologyPage;
