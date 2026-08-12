import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Statistic,
  Divider,
  Modal,
  Input,
  Progress,
  Tooltip,
  List,
  Slider,
} from 'antd';
import {
  ArrowLeftOutlined,
  HomeOutlined,
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  DeleteOutlined,
  SaveOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
  HeartOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateRightOutlined,
} from '@ant-design/icons';
import {
  entertainmentEngine,
  ENTERTAINMENT_MODES,
  SENSORY_TYPE_LABELS,
  startEntertainmentSession,
  endEntertainmentSession,
  analyzeEntertainmentBehavior,
} from '../utils/entertainmentEngine';
import { EntertainmentViews } from '../components/Entertainment/EntertainmentViews';
import { logger } from '../utils/logger';
import './EntertainmentPage.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ============= 主页面 =============
const EntertainmentPage = () => {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState(null);
  const [session, setSession] = useState(null);
  const [showStats, setShowStats] = useState(false);

  const analysis = useMemo(() => analyzeEntertainmentBehavior(), [activeMode]);

  const handleStartMode = (modeId) => {
    const newSession = startEntertainmentSession(modeId);
    setSession(newSession);
    setActiveMode(modeId);
  };

  const handleExit = (exitMethod = 'manual') => {
    if (session) {
      endEntertainmentSession(session, exitMethod);
      setSession(null);
      setActiveMode(null);
    }
  };

  const handleSwitchMode = (modeId) => {
    if (session) {
      const updatedSession = {
        ...session,
        switchCount: (session.switchCount || 0) + 1,
      };
      endEntertainmentSession(updatedSession, 'switch');
    }
    const newSession = startEntertainmentSession(modeId);
    setSession(newSession);
    setActiveMode(modeId);
  };

  if (activeMode) {
    return (
      <ActiveModeView
        mode={activeMode}
        session={session}
        onExit={handleExit}
        onSwitch={handleSwitchMode}
        onUpdateSession={setSession}
      />
    );
  }

  return (
    <div className="entertainment-page fade-in">
      <Card className="entertainment-header-card">
        <Space className="entertainment-header-content">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>返回首页</Button>
            <Button icon={<HomeOutlined />} onClick={() => navigate('/dashboard')}>总控台</Button>
            <Divider type="vertical" />
            <Title level={4} className="entertainment-title">✨ 娱乐方式</Title>
          </Space>
          <Space>
            <Tag color="purple">Y.Mine 总控台 › 娱乐方式</Tag>
            <Button size="small" onClick={() => setShowStats(true)}>查看统计</Button>
          </Space>
        </Space>
      </Card>

      <Card className="entertainment-hero-card">
        <Title level={3} className="entertainment-hero-title">
          今夜，你想如何度过这段无目的的时间？
        </Title>
        <Text type="secondary" className="entertainment-hero-desc">
          没有目标，没有输赢，没有完成度。跟随你的直觉选择，系统只观察，不评判。
        </Text>
      </Card>

      <Row gutter={[16, 16]}>
        {ENTERTAINMENT_MODES.map((mode) => (
          <Col xs={24} sm={12} lg={8} key={mode.id}>
            <Card
              hoverable
              onClick={() => handleStartMode(mode.id)}
              className="entertainment-mode-card"
              style={{ background: mode.gradient }}
            >
              <Space direction="vertical" size={12} className="entertainment-mode-content">
                <div className="entertainment-mode-icon">
                  {mode.emoji}
                </div>
                <div>
                  <Text strong className="entertainment-mode-name">{mode.name}</Text>
                  <div>
                    <Tag color="default" className="entertainment-mode-shorttag">{mode.shortDesc}</Tag>
                  </div>
                </div>
                <Text type="secondary" className="entertainment-mode-desc">{mode.fullDesc}</Text>
                <Space className="entertainment-mode-tags">
                  <Tag color="purple" className="entertainment-mode-sensory-tag">
                    {SENSORY_TYPE_LABELS[mode.sensoryType]?.label || mode.sensoryType}
                  </Tag>
                </Space>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <div className="entertainment-footer-tip">
        <Text type="secondary">
          选择后，系统会记录你的停留时间、切换频率、退出方式 · 不评判，只观察
        </Text>
      </div>

      <Modal
        title="📊 娱乐行为统计"
        open={showStats}
        onCancel={() => setShowStats(false)}
        footer={[<Button key="close" onClick={() => setShowStats(false)}>关闭</Button>]}
      >
        <StatsPanel analysis={analysis} />
      </Modal>
    </div>
  );
};

// ============= 活跃模式视图 =============
const ActiveModeView = ({ mode, session, onExit, onSwitch, onUpdateSession }) => {
  const modeConfig = ENTERTAINMENT_MODES.find((m) => m.id === mode);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (session) {
        setElapsed(Math.floor((Date.now() - session.startTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [session]);

  const recordInteraction = (interaction) => {
    if (session) {
      onUpdateSession({
        ...session,
        contentInteractions: [...(session.contentInteractions || []), interaction],
      });
    }
  };

  return (
    <div className="active-entertainment fade-in">
      <div className="active-entertainment-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => onExit('manual')}>退出</Button>
          <Tag color="purple" className="active-mode-tag">
            {modeConfig?.emoji} {modeConfig?.name}
          </Tag>
        </Space>
        <Space>
          <Tag color="default">已用时: {entertainmentEngine.formatDuration(elapsed)}</Tag>
          <Button size="small" onClick={() => setShowSwitcher(true)}>切换方式</Button>
        </Space>
      </div>

      <EntertainmentViews
        mode={mode}
        onInteraction={recordInteraction}
        session={session}
        onExit={onExit}
      />

      <Modal
        title="选择另一种娱乐方式"
        open={showSwitcher}
        onCancel={() => setShowSwitcher(false)}
        footer={null}
      >
        <Row gutter={[8, 8]}>
          {ENTERTAINMENT_MODES.filter((m) => m.id !== mode).map((m) => (
            <Col xs={12} key={m.id}>
              <Card
                size="small"
                hoverable
                onClick={() => {
                  setShowSwitcher(false);
                  onSwitch(m.id);
                }}
                className="entertainment-mode-card"
                style={{ background: m.gradient }}
              >
                <Space>
                  <span style={{ fontSize: 24 }}>{m.emoji}</span>
                  <div>
                    <Text strong className="entertainment-mode-name">{m.name}</Text>
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>{m.shortDesc}</Text>
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Modal>
    </div>
  );
};

// ============= 统计面板 =============
const StatsPanel = ({ analysis }) => {
  if (analysis.totalSessions === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <Text type="secondary">暂无娱乐记录，开始一段无目的的时光吧～</Text>
      </div>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        <Col xs={12}>
          <Statistic title="总会话数" value={analysis.totalSessions} valueStyle={{ color: '#a78bfa' }} />
        </Col>
        <Col xs={12}>
          <Statistic
            title="平均时长"
            value={entertainmentEngine.formatDuration(analysis.avgDuration)}
            valueStyle={{ color: '#10b981' }}
          />
        </Col>
      </Row>

      <Card size="small" title="注意力稳定性">
        <Progress
          percent={analysis.attentionStability}
          strokeColor="#a78bfa"
          format={(p) => `${p}分`}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          基于平均停留时间和切换频率计算
        </Text>
      </Card>

      {analysis.dominantSensoryType && (
        <Card size="small" title="主导感官偏好">
          <Tag color="purple" style={{ fontSize: 14 }}>
            {SENSORY_TYPE_LABELS[analysis.dominantSensoryType]?.label || analysis.dominantSensoryType}
          </Tag>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {SENSORY_TYPE_LABELS[analysis.dominantSensoryType]?.desc}
            </Text>
          </div>
        </Card>
      )}

      <Card size="small" title="方式偏好">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {Object.entries(analysis.preferenceStats).map(([modeId, count]) => {
            const mode = ENTERTAINMENT_MODES.find((m) => m.id === modeId);
            const pct = Math.round((count / analysis.totalSessions) * 100);
            return (
              <div key={modeId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{mode?.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ color: '#fff', fontSize: 13 }}>{mode?.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{pct}%</Text>
                  </div>
                  <Progress percent={pct} size="small" showInfo={false} strokeColor={mode?.color} />
                </div>
              </div>
            );
          })}
        </Space>
      </Card>
    </Space>
  );
};

export default EntertainmentPage;
