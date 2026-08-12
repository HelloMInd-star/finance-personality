import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Slider,
  Tag,
  Row,
  Col,
  Progress,
  Tooltip,
  Statistic,
  Divider,
  Tabs,
  List,
  Avatar,
  Empty,
  Badge,
  Select,
  Radio,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  HomeOutlined,
  TrophyOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  PauseOutlined,
  LineChartOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  RiseOutlined,
  FallOutlined,
  FireOutlined,
  SafetyOutlined,
  SoundOutlined,
  RightOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  musicEngine,
  generateMockKLine,
  generateKLineFromPokerHistory,
  calculateKLineStats,
} from '../utils/musicEngine';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';
import NetEaseConnect from '../components/Music/NetEaseConnect';
import './MusicPage.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// 音乐风格
const MUSIC_STYLES = [
  { key: 'calm', label: '宁静冥想', bpmRange: [60, 80], color: '#8b5cf6' },
  { key: 'focus', label: '专注高效', bpmRange: [80, 100], color: '#06b6d4' },
  { key: 'energetic', label: '活力满满', bpmRange: [100, 130], color: '#f97316' },
  { key: 'intense', label: '紧张刺激', bpmRange: [130, 170], color: '#ef4444' },
];

// 行业音色
const INDUSTRY_OPTIONS = [
  { key: 'tech', label: '科技', icon: '💻' },
  { key: 'consumer', label: '消费', icon: '🛒' },
  { key: 'energy', label: '能源', icon: '⚡' },
  { key: 'finance', label: '金融', icon: '💰' },
];

// 行为采集数据类型
const COLLECTED_DATA_TYPES = [
  { key: 'playDuration', icon: '⏱️', title: '聆听时长', desc: '单次音乐播放的持续时间，反映注意力集中度' },
  { key: 'skipRate', icon: '⏭️', title: '跳过率', desc: '是否在音乐结束前切换，反映耐心与决策风格' },
  { key: 'stylePref', icon: '🎵', title: '风格偏好', desc: '选择的音乐风格与BPM区间，反映情绪状态' },
  { key: 'volume', icon: '🔊', title: '音量调节', desc: '音量大小与调节频率，反映对刺激的敏感度' },
  { key: 'repeatCount', icon: '🔁', title: '重复次数', desc: '同一段音乐的重复聆听次数，反映执着性' },
  { key: 'timbreChoice', icon: '🎹', title: '音色选择', desc: '行业音色偏好（科技/消费/能源/金融），映射人格维度' },
  { key: 'moodMatch', icon: '🎭', title: '情绪匹配', desc: '选择的音乐调性与当前情绪的一致性' },
  { key: 'pauseFreq', icon: '⏸️', title: '暂停频率', desc: '播放过程中的暂停次数，反映思维跳跃性' },
];

// ============= 音乐生成核心组件 =============
const MusicGenerator = ({ onSessionEnd }) => {
  const [stage, setStage] = useState('select');
  const [dataSource, setDataSource] = useState('mock');
  const [selectedStyle, setSelectedStyle] = useState('focus');
  const [selectedIndustry, setSelectedIndustry] = useState('tech');
  const [mood, setMood] = useState(0.6);
  const [klineData, setKlineData] = useState(null);
  const [musicConfig, setMusicConfig] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [session, setSession] = useState(null);
  const playStartTime = useRef(null);

  const handleSelectSource = (source) => {
    setDataSource(source);
    let data;
    if (source === 'poker') {
      const pokerGames = storage.get('pokerGames') || [];
      data = generateKLineFromPokerHistory(pokerGames);
    } else if (source === 'billiards') {
      const sessions = storage.get('billiardsSessions') || [];
      const kline = sessions.slice(-30).map((s, i) => ({
        time: i,
        open: 100 + i * 2,
        high: 105 + i * 2,
        low: 95 + i * 2,
        close: 100 + i * 2 + (Math.random() - 0.5) * 10,
        volume: Math.floor(100 + Math.random() * 500),
      }));
      data = { data: kline, source: `台球历史 ${sessions.length} 场` };
    } else {
      data = generateMockKLine(40);
    }
    setKlineData(data);
    setStage('configure');
    logger.session('音乐-选择数据源', data.source);
  };

  const handleGenerate = () => {
    if (!klineData) return;
    const style = MUSIC_STYLES.find(s => s.key === selectedStyle);
    const bpm = style.bpmRange[0] + Math.random() * (style.bpmRange[1] - style.bpmRange[0]);
    const config = musicEngine.analyzeKLine(klineData.data, {
      mood,
      industry: selectedIndustry,
    });
    const finalConfig = { ...config, bpm };
    setMusicConfig(finalConfig);
    setStage('preview');
    logger.session('音乐-生成音乐配置', { BPM: Math.round(bpm), 风格: style.label, 行业: selectedIndustry });
  };

  const handlePlay = () => {
    if (!klineData || !musicConfig) return;
    if (isPlaying) {
      musicEngine.stop();
      setIsPlaying(false);
    } else {
      const result = musicEngine.play(klineData.data, { mood, industry: selectedIndustry });
      musicEngine.onProgress = (current, total) => {
        setProgress({ current, total });
      };
      musicEngine.onComplete = () => {
        setIsPlaying(false);
        finishSession();
      };
      playStartTime.current = Date.now();
      setIsPlaying(true);
      setProgress({ current: 0, total: result.totalNotes });
      logger.session('音乐-开始播放', { 总音符: result.totalNotes, BPM: Math.round(result.bpm) });
    }
  };

  const handleSkip = () => {
    if (isPlaying) {
      musicEngine.stop();
      setIsPlaying(false);
    }
    const style = MUSIC_STYLES.find(s => s.key === selectedStyle);
    const bpm = style.bpmRange[0] + Math.random() * (style.bpmRange[1] - style.bpmRange[0]);
    const config = musicEngine.analyzeKLine(klineData.data, {
      mood,
      industry: selectedIndustry,
    });
    setMusicConfig({ ...config, bpm });
    logger.session('音乐-切换下一首');
  };

  const finishSession = () => {
    const playDuration = playStartTime.current ? Math.round((Date.now() - playStartTime.current) / 1000) : 0;
    const stats = klineData ? calculateKLineStats(klineData.data) : {};
    const newSession = {
      id: `music_${Date.now()}`,
      dataSource,
      style: selectedStyle,
      industry: selectedIndustry,
      mood,
      playDuration,
      notesPlayed: progress.current,
      totalNotes: progress.total,
      skipped: false,
      klineStats: stats,
      musicConfig,
      createdAt: Date.now(),
    };
    setSession(newSession);
    storage.update('musicSessions', prev => [...(prev || []), newSession]);
    storage.update('psychologyProfile', prev => ({ ...prev, lastMusicTime: Date.now() }));
    logger.session('音乐-会话结束', { 时长: playDuration + '秒', 风格: selectedStyle });
    setStage('result');
    onSessionEnd && onSessionEnd(newSession);
  };

  const handleEarlyEnd = () => {
    if (isPlaying) {
      musicEngine.stop();
      setIsPlaying(false);
    }
    finishSession();
  };

  const handleNewSession = () => {
    setStage('select');
    setDataSource('mock');
    setSelectedStyle('focus');
    setSelectedIndustry('tech');
    setMood(0.6);
    setKlineData(null);
    setMusicConfig(null);
    setProgress({ current: 0, total: 0 });
    setSession(null);
  };

  // ============= 渲染 =============
  if (stage === 'select') {
    return (
      <div className="music-trainer-inner">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={5} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>选择数据来源</Title>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={8}>
              <Card
                hoverable
                onClick={() => handleSelectSource('mock')}
                style={{ borderColor: '#8b5cf666', borderWidth: 2, height: '100%', textAlign: 'center', background: 'rgba(30,19,64,0.4)', borderRadius: 16 }}
                bodyStyle={{ padding: 24 }}
              >
                <div style={{ fontSize: 48, marginBottom: 8 }}>🎲</div>
                <Title level={5} style={{ color: '#8b5cf6', margin: '0 0 4px' }}>随机生成</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>使用模拟K线数据生成音乐</Text>
              </Card>
            </Col>
            <Col xs={12} md={8}>
              <Card
                hoverable
                onClick={() => handleSelectSource('poker')}
                style={{ borderColor: '#ec489966', borderWidth: 2, height: '100%', textAlign: 'center', background: 'rgba(30,19,64,0.4)', borderRadius: 16 }}
                bodyStyle={{ padding: 24 }}
              >
                <div style={{ fontSize: 48, marginBottom: 8 }}>♠️</div>
                <Title level={5} style={{ color: '#ec4899', margin: '0 0 4px' }}>德州历史</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>用你的扑克筹码变化谱曲</Text>
              </Card>
            </Col>
            <Col xs={12} md={8}>
              <Card
                hoverable
                onClick={() => handleSelectSource('billiards')}
                style={{ borderColor: '#06b6d466', borderWidth: 2, height: '100%', textAlign: 'center', background: 'rgba(30,19,64,0.4)', borderRadius: 16 }}
                bodyStyle={{ padding: 24 }}
              >
                <div style={{ fontSize: 48, marginBottom: 8 }}>🎱</div>
                <Title level={5} style={{ color: '#06b6d4', margin: '0 0 4px' }}>台球历史</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>用你的击球数据生成旋律</Text>
              </Card>
            </Col>
          </Row>
        </Space>
      </div>
    );
  }

  if (stage === 'configure' && klineData) {
    const stats = calculateKLineStats(klineData.data);
    return (
      <div className="music-trainer-inner">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card size="small" style={{ background: 'rgba(30,19,64,0.4)', borderRadius: 12 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button onClick={() => setStage('select')}>← 返回</Button>
                <Tag color="purple">数据源：{klineData.source || '模拟数据'}</Tag>
              </Space>
              <Text type="secondary">Step 2/3 · 配置参数</Text>
            </Space>
          </Card>

          <Card title="K线数据概览" style={{ borderRadius: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={6}><Statistic title="数据点" value={klineData.data.length} /></Col>
              <Col span={6}><Statistic title="收益率" value={stats.returnRate} suffix="%" valueStyle={{ color: stats.returnRate >= 0 ? '#22c55e' : '#ef4444' }} /></Col>
              <Col span={6}><Statistic title="波动率" value={stats.volatility} suffix="%" /></Col>
              <Col span={6}><Statistic title="最大回撤" value={stats.maxDD} suffix="%" valueStyle={{ color: '#ef4444' }} /></Col>
            </Row>
          </Card>

          <Card title="音乐参数配置" style={{ borderRadius: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text type="secondary">音乐风格</Text>
                <div style={{ marginTop: 8 }}>
                  <Radio.Group value={selectedStyle} onChange={e => setSelectedStyle(e.target.value)}>
                    {MUSIC_STYLES.map(s => (
                      <Radio.Button key={s.key} value={s.key}><span style={{ color: s.color }}>{s.label}</span></Radio.Button>
                    ))}
                  </Radio.Group>
                </div>
              </Col>
              <Col span={12}>
                <Text type="secondary">行业音色</Text>
                <div style={{ marginTop: 8 }}>
                  <Radio.Group value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)}>
                    {INDUSTRY_OPTIONS.map(i => (
                      <Radio.Button key={i.key} value={i.key}>{i.icon} {i.label}</Radio.Button>
                    ))}
                  </Radio.Group>
                </div>
              </Col>
              <Col span={24}>
                <Text type="secondary">情绪值：{Math.round(mood * 100)}% {mood >= 0.5 ? '（乐观→大调）' : '（谨慎→小调）'}</Text>
                <Slider min={0} max={100} value={mood * 100} onChange={v => setMood(v / 100)} marks={{ 0: '😢 低调', 50: '😐 中性', 100: '😄 高调' }} />
              </Col>
            </Row>
          </Card>

          <div style={{ textAlign: 'center' }}>
            <Button type="primary" size="large" onClick={handleGenerate}>🎵 生成音乐</Button>
          </div>
        </Space>
      </div>
    );
  }

  if (stage === 'preview' && musicConfig) {
    const progressPct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
    const style = MUSIC_STYLES.find(s => s.key === selectedStyle);
    return (
      <div className="music-trainer-inner">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card size="small" style={{ background: 'rgba(30,19,64,0.4)', borderRadius: 12 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button onClick={() => { if (isPlaying) { musicEngine.stop(); setIsPlaying(false); } setStage('configure'); }}>← 返回</Button>
                <Tag color={style?.color}>{style?.label}</Tag>
              </Space>
              <Button danger size="small" onClick={handleEarlyEnd}>结束</Button>
            </Space>
          </Card>

          <Card style={{ borderRadius: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 120, marginBottom: 16, animation: isPlaying ? 'pulse 1.5s ease-in-out infinite' : 'none' }}>🎵</div>
            <Title level={3} style={{ margin: '0 0 8px' }}>K线音乐已就绪</Title>
            <Tag color="purple">BPM: {Math.round(musicConfig.bpm)}</Tag>
            <Tag color="blue">调性: {musicConfig.modeLabel}</Tag>
            <Tag color="green">音符: {musicConfig.notes?.length || 0} 个</Tag>

            <Divider />

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={8}><Card size="small"><Statistic title="收益率" value={klineData ? calculateKLineStats(klineData.data).returnRate : 0} suffix="%" /></Card></Col>
              <Col span={8}><Card size="small"><Statistic title="波动率" value={klineData ? calculateKLineStats(klineData.data).volatility : 0} suffix="%" /></Card></Col>
              <Col span={8}><Card size="small"><Statistic title="音色" value={musicConfig.timbre?.label || '默认'} /></Card></Col>
            </Row>

            {isPlaying && (
              <div style={{ marginBottom: 24 }}>
                <Progress percent={Math.round(progressPct)} status="active" />
                <Text type="secondary">{progress.current} / {progress.total} 个音符</Text>
              </div>
            )}

            <Space style={{ justifyContent: 'center' }}>
              <Button type="primary" size="large" icon={isPlaying ? <PauseOutlined /> : <PlayCircleOutlined />} onClick={handlePlay} style={{ minWidth: 140 }}>
                {isPlaying ? '暂停' : '播放'}
              </Button>
              <Button size="large" icon={<RightOutlined />} onClick={handleSkip}>下一首</Button>
            </Space>
          </Card>
        </Space>
      </div>
    );
  }

  if (stage === 'result' && session) {
    const style = MUSIC_STYLES.find(s => s.key === session.style);
    return (
      <div className="music-trainer-inner">
        <Card style={{ borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>🎵</div>
          <Title level={3} style={{ margin: 0 }}>聆听完成！</Title>
          <Text type="secondary">时长 {session.playDuration} 秒 · {progress.current} 个音符</Text>
        </Card>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={8}><Card><Statistic title="聆听时长" value={session.playDuration} suffix="秒" valueStyle={{ color: '#8b5cf6', fontSize: 24 }} /></Card></Col>
          <Col span={8}><Card><Statistic title="音乐风格" value={style?.label || session.style} valueStyle={{ color: '#ec4899', fontSize: 24 }} /></Card></Col>
          <Col span={8}><Card><Statistic title="音符播放" value={`${session.notesPlayed}/${session.totalNotes}`} valueStyle={{ fontSize: 24 }} /></Card></Col>
        </Row>

        <Card title="K线特征" style={{ marginTop: 16, borderRadius: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={6}><Statistic title="收益率" value={session.klineStats?.returnRate || 0} suffix="%" valueStyle={{ color: (session.klineStats?.returnRate || 0) >= 0 ? '#22c55e' : '#ef4444' }} /></Col>
            <Col span={6}><Statistic title="波动率" value={session.klineStats?.volatility || 0} suffix="%" /></Col>
            <Col span={6}><Statistic title="最大回撤" value={session.klineStats?.maxDD || 0} suffix="%" valueStyle={{ color: '#ef4444' }} /></Col>
            <Col span={6}><Statistic title="情绪值" value={Math.round((session.mood || 0) * 100)} suffix="%" /></Col>
          </Row>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="primary" icon={<ReloadOutlined />} onClick={handleNewSession}>再来一次</Button>
        </div>
      </div>
    );
  }

  return null;
};

// ============= MusicPage 主组件 =============
const MusicPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('lobby');

  const mockStats = useMemo(() => ({
    totalSessions: 8,
    totalPlayTime: 1840,
    avgDuration: 230,
    dominantStyle: 'focus',
    dominantIndustry: 'tech',
    avgMood: 0.62,
    skipRate: 0.35,
    totalNotes: 2450,
  }), []);

  const historySessions = useMemo(() => storage.get('musicSessions') || [], []);

  const renderLobby = () => (
    <div className="music-lobby">
      <Card className="music-hero-card">
        <div className="music-hero-content">
          <div className="music-hero-text">
            <Text className="music-hero-greeting">🎵 K线音乐</Text>
            <Title level={2} className="music-hero-title">
              让<span className="music-gradient-text">行为数据</span>流淌成听觉叙事
            </Title>
            <Paragraph className="music-hero-desc">
              把你的每一次筹码波动、每一组击球变化，翻译成独特的音乐体验。系统追踪聆听时长、跳过率、风格偏好，构建你的「听觉人格画像」。
            </Paragraph>
            <Space size="middle">
              <Button type="primary" size="large" icon={<PlayCircleOutlined />} className="music-quick-start-btn" onClick={() => setActiveTab('trainer')}>开始聆听</Button>
              <Select defaultValue="focus" style={{ width: 140 }} size="large">
                {MUSIC_STYLES.map(s => (
                  <Option key={s.key} value={s.key}>{s.label}</Option>
                ))}
              </Select>
            </Space>
          </div>
          <div className="music-hero-stats">
            <div className="music-hero-stat">
              <span className="stat-emoji">🎵</span>
              <span className="stat-value">{mockStats.totalSessions}</span>
              <span className="stat-label">聆听场次</span>
            </div>
            <div className="music-hero-stat">
              <span className="stat-emoji">⏱️</span>
              <span className="stat-value">{Math.round(mockStats.totalPlayTime / 60)}</span>
              <span className="stat-label">总时长(分)</span>
            </div>
            <div className="music-hero-stat">
              <span className="stat-emoji">🎹</span>
              <span className="stat-value">{mockStats.totalNotes}</span>
              <span className="stat-label">音符总数</span>
            </div>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]} className="music-stats-row">
        <Col xs={12} md={6}><Card className="music-stat-card"><Statistic title={<span><ClockCircleOutlined /> 平均时长</span>} value={Math.round(mockStats.avgDuration / 60)} suffix="分钟" valueStyle={{ color: '#8b5cf6' }} /></Card></Col>
        <Col xs={12} md={6}><Card className="music-stat-card"><Statistic title={<span><RightOutlined /> 跳过率</span>} value={mockStats.skipRate * 100} precision={0} suffix="%" valueStyle={{ color: '#ec4899' }} /></Card></Col>
        <Col xs={12} md={6}><Card className="music-stat-card"><Statistic title={<span><SoundOutlined /> 主导风格</span>} value={MUSIC_STYLES.find(s => s.key === mockStats.dominantStyle)?.label || '专注'} valueStyle={{ color: '#06b6d4' }} /></Card></Col>
        <Col xs={12} md={6}><Card className="music-stat-card"><Statistic title={<span><SoundOutlined /> 情绪值</span>} value={Math.round(mockStats.avgMood * 100)} suffix="%" valueStyle={{ color: '#f97316' }} /></Card></Col>
      </Row>

      <Card title={<span><DatabaseOutlined /> 你的哪些数据会被记录？</span>} className="music-data-info-card" extra={<Tooltip title="所有数据仅用于本地人格建模，不会上传"><InfoCircleOutlined style={{ color: '#8b5cf6' }} /></Tooltip>}>
        <Row gutter={[16, 16]}>
          {COLLECTED_DATA_TYPES.map(item => (
            <Col xs={24} sm={12} md={8} lg={6} key={item.key}>
              <div className="music-data-type-card">
                <span className="music-data-type-icon">{item.icon}</span>
                <div className="music-data-type-content">
                  <Text strong className="music-data-type-title">{item.title}</Text>
                  <Text type="secondary" className="music-data-type-desc">{item.desc}</Text>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );

  const renderStats = () => (
    <div className="music-stats-page">
      <Card className="music-profit-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div className="music-stats-section">
              <Text type="secondary">音乐总览</Text>
              <Title level={2} style={{ margin: 0 }}>{mockStats.totalSessions} 场</Title>
              <Tag color="purple">总时长 {Math.round(mockStats.totalPlayTime / 60)} 分钟</Tag>
            </div>
          </Col>
          <Col xs={12} md={4}><Statistic title="平均时长" value={Math.round(mockStats.avgDuration / 60)} suffix="分" valueStyle={{ color: '#8b5cf6' }} /></Col>
          <Col xs={12} md={4}><Statistic title="跳过率" value={mockStats.skipRate * 100} suffix="%" valueStyle={{ color: '#ec4899' }} /></Col>
          <Col xs={12} md={4}><Statistic title="主导风格" value={MUSIC_STYLES.find(s => s.key === mockStats.dominantStyle)?.label} valueStyle={{ color: '#06b6d4' }} /></Col>
          <Col xs={12} md={4}><Statistic title="平均情绪" value={Math.round(mockStats.avgMood * 100)} suffix="%" valueStyle={{ color: '#f97316' }} /></Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={<span><LineChartOutlined /> 核心指标</span>} className="music-stats-card">
            <List
              dataSource={[
                { label: '聆听完成率', value: 1 - mockStats.skipRate, target: '>60%' },
                { label: '风格集中度', value: 0.72, target: '50%-80%' },
                { label: '情绪稳定性', value: 0.68, target: '>60%' },
                { label: '音色探索度', value: 0.55, target: '40%-70%' },
              ]}
              renderItem={item => (
                <List.Item>
                  <div className="stat-row">
                    <Text>{item.label}</Text>
                    <div className="stat-row-right">
                      <Progress percent={Math.max(0, Math.min(100, item.value * 100))} size="small" showInfo={false} style={{ width: 120 }} />
                      <Text strong>{(item.value * 100).toFixed(0)}%</Text>
                      <Tag color="blue">{item.target}</Tag>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={<span><FireOutlined /> 行为标签</span>} className="music-stats-card">
            <div className="behavior-tags">
              <Tag color="green" icon={<CheckCircleOutlined />} className="behavior-tag">🎵 高专注型</Tag>
              <Tag color="orange" icon={<FireOutlined />} className="behavior-tag">🎹 音色偏好稳定</Tag>
              <Tag color="blue" icon={<ClockCircleOutlined />} className="behavior-tag">⏱️ 聆听耐心良好</Tag>
              <Tag color="purple" icon={<SafetyOutlined />} className="behavior-tag">🎭 情绪匹配度高</Tag>
              <Tag color="cyan" icon={<RiseOutlined />} className="behavior-tag">📈 大调偏好</Tag>
            </div>
            <Divider />
            <div className="mbti-mapping">
              <Text type="secondary">基于当前行为模式的 MBTI 推断：</Text>
              <div className="mbti-mapping-row">
                <Tag color="purple" className="mbti-tag">INFP</Tag>
                <Text type="secondary">置信度 58%</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>提示：更多聆听数据将提升人格画像准确度</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title={<span><ClockCircleOutlined /> 历史聆听记录</span>} className="music-stats-card">
        {historySessions.length === 0 ? (
          <Empty description="暂无聆听记录，开始聆听后会保存每一次的数据" />
        ) : (
          <List
            dataSource={[...historySessions].reverse()}
            renderItem={(session, idx) => (
              <List.Item>
                <Space>
                  <Avatar style={{ backgroundColor: '#8b5cf6' }}>{idx + 1}</Avatar>
                  <Text>{MUSIC_STYLES.find(s => s.key === session.style)?.label || '音乐'} - {session.playDuration}秒</Text>
                  <Tag color="green">情绪 {Math.round((session.mood || 0) * 100)}%</Tag>
                  <Tag color="blue">{session.totalNotes || 0} 音符</Tag>
                  <Text type="secondary">{new Date(session.createdAt || Date.now()).toLocaleString()}</Text>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );

  const renderBehavior = () => (
    <div className="music-behavior-page">
      <Card className="behavior-overview-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">🎵</span>
              <div>
                <Text type="secondary">已采集聆听样本</Text>
                <Title level={3} style={{ margin: 0 }}>{mockStats.totalSessions}</Title>
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">📊</span>
              <div>
                <Text type="secondary">数据维度覆盖</Text>
                <Title level={3} style={{ margin: 0 }}>5 / 8</Title>
                <Progress percent={62} size="small" showInfo={false} />
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">🧠</span>
              <div>
                <Text type="secondary">人格画像准确度</Text>
                <Title level={3} style={{ margin: 0 }}>58%</Title>
                <Progress percent={58} size="small" strokeColor="#8b5cf6" showInfo={false} />
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      <Card title={<span><DatabaseOutlined /> 采集数据类型详解</span>} className="behavior-detail-card">
        <Row gutter={[16, 16]}>
          {COLLECTED_DATA_TYPES.map(item => (
            <Col xs={24} sm={12} key={item.key}>
              <Card className="data-detail-card" size="small">
                <Space>
                  <span style={{ fontSize: 28 }}>{item.icon}</span>
                  <div>
                    <Text strong>{item.title}</Text>
                    <Paragraph style={{ margin: 0, fontSize: 12 }} type="secondary">{item.desc}</Paragraph>
                  </div>
                </Space>
                <div style={{ marginTop: 12 }}>
                  <Progress percent={Math.floor(Math.random() * 40 + 40)} size="small" showInfo={false} />
                  <Text type="secondary" style={{ fontSize: 12 }}>样本充足度</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title={<span><InfoCircleOutlined /> 数据如何被使用？</span>} className="behavior-dataflow-card">
        <div className="dataflow-steps">
          <div className="dataflow-step"><div className="dataflow-step-icon">🎵</div><div className="dataflow-step-content"><Text strong>Step 1: 聆听中采集</Text><Paragraph type="secondary">每一次播放、暂停、跳过、风格切换都被记录</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">📊</div><div className="dataflow-step-content"><Text strong>Step 2: 听觉人格分析</Text><Paragraph type="secondary">计算聆听耐心、风格偏好、情绪匹配度、音色探索度</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">🧠</div><div className="dataflow-step-content"><Text strong>Step 3: 人格画像映射</Text><Paragraph type="secondary">跳过率→J/P维度，风格偏好→S/N维度，情绪匹配→F/T维度</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">✨</div><div className="dataflow-step-content"><Text strong>Step 4: 个性化反馈</Text><Paragraph type="secondary">生成音乐推荐、听觉培养方案、健康人格反馈</Paragraph></div></div>
        </div>
      </Card>

      <Card className="behavior-privacy-card">
        <Space>
          <SafetyOutlined style={{ fontSize: 24, color: '#22c55e' }} />
          <div>
            <Text strong>🔒 你的数据完全由你掌控</Text>
            <Paragraph type="secondary" style={{ margin: 0 }}>所有行为数据仅存储在本地，可随时清除。不会上传到任何第三方服务器。</Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  );

  return (
    <div className="music-page">
      <div className="music-page-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>返回首页</Button>
        <Title level={4} style={{ margin: 0 }}>
          <span className="music-gradient-text">🎵 K线音乐</span>
          <Text type="secondary" style={{ marginLeft: 12, fontWeight: 'normal' }}>
            听觉人格的行为采集入口
          </Text>
        </Title>
        <Space><Badge status="success" text="采样中" /></Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className="music-tabs"
        items={[
          { key: 'lobby', label: <span><PlayCircleOutlined /> 入口大厅</span> },
          { key: 'netease', label: <span><CloudOutlined /> 网易云接入</span> },
          { key: 'trainer', label: <span><SoundOutlined /> 音乐生成</span> },
          { key: 'stats', label: <span><LineChartOutlined /> 数据统计</span> },
          { key: 'behavior', label: <span><DatabaseOutlined /> 行为采集</span> },
        ]}
      />

      {activeTab === 'lobby' && renderLobby()}
      {activeTab === 'netease' && <NetEaseConnect />}
      {activeTab === 'trainer' && <MusicGenerator />}
      {activeTab === 'stats' && renderStats()}
      {activeTab === 'behavior' && renderBehavior()}
    </div>
  );
};

export default MusicPage;
