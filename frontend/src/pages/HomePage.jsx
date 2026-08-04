import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Space, Typography, Tag, Tooltip, Modal, Select, message } from 'antd';
import {
  TrophyOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  FireOutlined,
  WarningOutlined,
  BookOutlined,
  UserOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useAppStore } from '../store/appStore';
import { useGameStore } from '../store/gameStore';
import { logger } from '../utils/logger';

const { Title, Text, Paragraph } = Typography;

const HomePage = () => {
  const navigate = useNavigate();
  const { data, setCurrentSession } = useAppStore();
  const { gameState, createGame, isLoading } = useGameStore();

  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [quickPokerOpen, setQuickPokerOpen] = useState(false);
  const [pokerDifficulty, setPokerDifficulty] = useState('medium');

  const userState = data.userState;
  const session = data.currentSession;

  const handleSelectStory = (mode) => {
    logger.session('选择故事模式', mode === 'cigar' ? '雪茄故事（慢）' : '烟火故事（快）');
    setCurrentSession({ storyMode: mode, startTime: Date.now() });
    setStoryModalOpen(false);
    message.success(mode === 'cigar' ? '已选择「雪茄故事」慢模式' : '已选择「烟火故事」快模式');
  };

  const handleStartPoker = async (name) => {
    logger.session('开始德州扑克', `难度:${pokerDifficulty}`);
    try {
      await createGame(name || '隐士', pokerDifficulty);
      setQuickPokerOpen(false);
      logger.route('跳转到德州扑克页面');
      navigate('/poker');
      message.success('牌局已创建！');
    } catch (e) {
      logger.error('创建牌局失败', e.message);
      message.error('创建失败');
    }
  };

  const handleResumePoker = () => {
    logger.session('继续未完成牌局');
    navigate('/poker');
  };

  const moduleGroups = [
    {
      title: '入口层',
      icon: '🚪',
      items: [
        {
          key: 'bartender',
          icon: <TrophyOutlined />,
          title: '调酒',
          desc: session.storyMode ? `当前：${session.storyMode === 'cigar' ? '雪茄故事' : '烟火故事'}` : '选择故事基调',
          action: () => navigate('/bartender'),
          status: session.storyMode ? 'active' : 'idle',
        },
        {
          key: 'story',
          icon: <BookOutlined />,
          title: '故事选择',
          desc: session.storyMode ? `已选：${session.storyMode === 'cigar' ? '雪茄' : '烟火'}` : '尚未选择',
          action: () => setStoryModalOpen(true),
          status: session.storyMode ? 'done' : 'todo',
        },
      ],
    },
    {
      title: '行为层',
      icon: '🎯',
      items: [
        {
          key: 'poker',
          icon: <PlayCircleOutlined />,
          title: '德州扑克',
          desc: gameState ? '牌局进行中' : '开始一局德州',
          action: gameState ? handleResumePoker : () => setQuickPokerOpen(true),
          status: gameState ? 'active' : 'idle',
          badge: gameState ? '进行中' : null,
        },
      ],
    },
    {
      title: '反馈层',
      icon: '📊',
      items: [
        {
          key: 'psychology',
          icon: <InfoCircleOutlined />,
          title: '心理盘面',
          desc: '查看你的行为画像',
          action: () => navigate('/psychology'),
          status: 'idle',
        },
      ],
    },
  ];

  const statusConfig = {
    idle: { color: 'default', text: '待开始' },
    active: { color: 'processing', text: '进行中' },
    done: { color: 'success', text: '已完成' },
    todo: { color: 'warning', text: '待选择' },
  };

  return (
    <div className="home-page fade-in">
      {/* 状态锚点 */}
      <Card className="status-anchor-card">
        <div className="anchor-content">
          <div className="anchor-left">
            <TrophyOutlined className="anchor-icon" />
            <div>
              <Text className="anchor-main">
                你已连续保持清醒 <span className="highlight">{userState.soberDays || 0}</span> 天
              </Text>
              <Text className="anchor-sub">
                · 当前 MBTI：<Tag color="purple">{userState.currentMbti}</Tag>
                置信度 {userState.mbtiConfidence}%
              </Text>
            </div>
          </div>
          <div className="anchor-right">
            <Tag color="success" className="status-tag">
              ✨ 今夜状态：适宜决策
            </Tag>
          </div>
        </div>
      </Card>

      {/* 任务提醒 */}
      {gameState && (
        <Card className="task-reminder-card">
          <div className="reminder-content">
            <WarningOutlined className="reminder-icon" />
            <div className="reminder-text">
              <Text strong>你还有一局德州未完成</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                当前阶段：{gameState.stage || 'preflop'} · 底池：{gameState.pot || 0}
              </Text>
            </div>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleResumePoker}>
              继续牌局
            </Button>
          </div>
        </Card>
      )}

      {/* 故事选择入口 */}
      <Card className="story-entry-card" onClick={() => setStoryModalOpen(true)}>
        <div className="story-entry-content">
          <div className="story-entry-text">
            <Title level={3} style={{ margin: 0, color: '#fff' }}>
              {session.storyMode ? `当前基调：${session.storyMode === 'cigar' ? '🥃 雪茄故事（慢）' : '🎆 烟火故事（快）'}` : '🎭 选择你的故事基调'}
            </Title>
            <Text type="secondary" style={{ marginTop: 4 }}>
              {session.storyMode
                ? '点击切换，或直接进入调酒'
                : '选择一种模式，作为本次会话的叙事基调'}
            </Text>
          </div>
          <Button type="primary" size="large">
            {session.storyMode ? '切换故事' : '选择故事'}
          </Button>
        </div>
      </Card>

      {/* 模块入口卡片 */}
      {moduleGroups.map(group => (
        <div key={group.title} className="module-group">
          <div className="module-group-header">
            <span className="group-icon">{group.icon}</span>
            <Title level={4} style={{ margin: 0, color: '#a78bfa' }}>{group.title}</Title>
          </div>
          <div className="module-cards-grid">
            {group.items.map(item => (
              <Card
                key={item.key}
                className="module-card"
                hoverable
                onClick={item.action}
              >
                <div className="module-card-icon">{item.icon}</div>
                <div className="module-card-info">
                  <div className="module-card-title">
                    <Text strong style={{ color: '#fff', fontSize: 16 }}>{item.title}</Text>
                    {item.badge && <Tag color="processing" style={{ marginLeft: 8 }}>{item.badge}</Tag>}
                  </div>
                  <Text type="secondary" style={{ fontSize: 13 }}>{item.desc}</Text>
                </div>
                <Tag color={statusConfig[item.status].color} className="module-status-tag">
                  {statusConfig[item.status].text}
                </Tag>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* 故事选择弹窗 */}
      <Modal
        title="🎭 选择你的故事基调"
        open={storyModalOpen}
        onCancel={() => setStoryModalOpen(false)}
        footer={null}
        className="auth-modal"
      >
        <div className="story-select-grid">
          <Card
            className={`story-option-card ${session.storyMode === 'cigar' ? 'selected' : ''}`}
            onClick={() => handleSelectStory('cigar')}
            hoverable
          >
            <div className="story-option-icon">🥃</div>
            <Title level={4} style={{ color: '#d4a574', marginBottom: 4 }}>雪茄故事</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              慢模式 · 深度沉浸 · 6步完整流程
            </Text>
            <Space wrap>
              <Tag color="gold">深度对话</Tag>
              <Tag color="orange">慢节奏</Tag>
              <Tag color="brown">情感探索</Tag>
            </Space>
          </Card>

          <Card
            className={`story-option-card ${session.storyMode === 'firework' ? 'selected' : ''}`}
            onClick={() => handleSelectStory('firework')}
            hoverable
          >
            <div className="story-option-icon">🎆</div>
            <Title level={4} style={{ color: '#f472b6', marginBottom: 4 }}>烟火故事</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              快模式 · 高效体验 · 精简3步流程
            </Text>
            <Space wrap>
              <Tag color="magenta">快速决策</Tag>
              <Tag color="red">高能量</Tag>
              <Tag color="pink">行动导向</Tag>
            </Space>
          </Card>
        </div>
      </Modal>

      {/* 快速开始德州 */}
      <Modal
        title="🃏 开始一局德州"
        open={quickPokerOpen}
        onCancel={() => setQuickPokerOpen(false)}
        footer={null}
        className="auth-modal"
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', display: 'block', marginBottom: 8 }}>
              AI 难度
            </Text>
            <Select
              value={pokerDifficulty}
              onChange={setPokerDifficulty}
              style={{ width: '100%' }}
              size="large"
            >
              <Select.Option value="easy">😊 简单 - 初学练习</Select.Option>
              <Select.Option value="medium">🤔 中等 - 一般玩家</Select.Option>
              <Select.Option value="hard">🔥 困难 - 高手挑战</Select.Option>
            </Select>
          </div>
          <Button
            type="primary"
            size="large"
            block
            loading={isLoading}
            onClick={() => handleStartPoker('隐士')}
          >
            开始牌局
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default HomePage;
