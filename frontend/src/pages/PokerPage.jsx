import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
  Typography,
  Row,
  Col,
  Statistic,
  Progress,
  Tooltip,
  Modal,
  Form,
  List,
  Avatar,
  Divider,
  Empty,
  Badge,
  message,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  UserOutlined,
  RobotOutlined,
  PlayCircleOutlined,
  TrophyOutlined,
  LineChartOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  FallOutlined,
  FireOutlined,
  SafetyOutlined,
  ExperimentOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  AimOutlined,
} from '@ant-design/icons';
import PokerTable from '../components/PokerTable/PokerTable';
import PokerArena from '../components/PokerArena/PokerArena';
import Dashboard from '../components/Dashboard/Dashboard';
import { useGameStore } from '../store/gameStore';
import { storage } from '../utils/storage';
import { logger } from '../utils/logger';
import { apiClient } from '../utils/apiClient';
import './PokerPage.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

// ============= 行为数据标签配置 =============
const BEHAVIOR_TAGS = {
  aggressive: { label: '激进', color: 'red', icon: <FireOutlined /> },
  conservative: { label: '保守', color: 'blue', icon: <SafetyOutlined /> },
  stable: { label: '稳定', color: 'green', icon: <CheckCircleOutlined /> },
  erratic: { label: '波动', color: 'orange', icon: <ThunderboltOutlined /> },
  bluffer: { label: '诈唬高手', color: 'purple', icon: <ExperimentOutlined /> },
  tight: { label: '紧派', color: 'cyan', icon: <SafetyOutlined /> },
  loose: { label: '松派', color: 'magenta', icon: <FireOutlined /> },
};

// ============= 采集数据类型说明 =============
const COLLECTED_DATA_TYPES = [
  { key: 'actions', icon: '🎯', title: '行动决策', desc: '每次弃牌/跟注/加注/All-in的选择与时机' },
  { key: 'timing', icon: '⏱️', title: '决策时长', desc: '每个决策花费的思考时间，反映自信度' },
  { key: 'betSize', icon: '💰', title: '下注规模', desc: '加注金额相对于底池的比例，反映风险偏好' },
  { key: 'foldRate', icon: '🚪', title: '弃牌率', desc: '不同阶段的弃牌频率，反映牌桌松紧' },
  { key: 'bluffPattern', icon: '🎭', title: '诈唬模式', desc: '在无牌力时的下注行为，识别诈唬风格' },
  { key: 'positionBias', icon: '📍', title: '位置偏好', desc: '不同位置（前/中/后）的策略差异' },
  { key: 'emotionalResponse', icon: '💢', title: '情绪反应', desc: '亏损后的行为变化（ tilt 检测）' },
  { key: 'consistency', icon: '📊', title: '决策一致性', desc: '相似局面下的决策方差，反映稳定性' },
];

// ============= PokerPage 主组件 =============
const PokerPage = () => {
  const navigate = useNavigate();
  const { gameState, playerId, createGame, isLoading, actionHistory } = useGameStore();
  const [activeTab, setActiveTab] = useState('arena');
  const [gameList, setGameList] = useState([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 模拟的历史统计数据（实际应从API获取）
  const mockStats = useMemo(() => ({
    totalHands: 127,
    winRate: 0.48,
    totalProfit: 2350,
    avgPot: 320,
    vpip: 0.32,  // Voluntarily Put Money In Pot
    pfr: 0.24,   // Pre-Flop Raise
    af: 2.1,     // Aggression Factor
    avgDecisionTime: 3.2, // 秒
    biggestWin: 1200,
    biggestLoss: 800,
    tiltEpisodes: 2,
    currentStreak: 3, // 连续赢/输
    isWinStreak: true,
  }), []);

  // 获取游戏列表
  const fetchGames = async () => {
    try {
      const data = await apiClient.get('/games');
      setGameList(data || []);
    } catch (error) {
      // 静默失败：后端未启动时使用空列表
      logger.info('获取游戏列表失败（后端可能未启动）');
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  // 快速开始游戏
  const handleQuickStart = async () => {
    try {
      const playerName = storage.get('userProfile')?.name || 'Player';
      await createGame(playerName, 'medium');
      setActiveTab('table');
      message.success('游戏已开始！祝你好运 🎴');
      logger.flow('德州扑克', '快速开始游戏', `玩家:${playerName}`);
    } catch (error) {
      message.error('创建游戏失败：' + error.message);
    }
  };

  // 创建游戏
  const handleCreateGame = async (values) => {
    try {
      await createGame(
        values.playerName || 'Player',
        values.aiDifficulty || 'medium'
      );
      setCreateModalVisible(false);
      form.resetFields();
      setActiveTab('table');
      message.success('游戏创建成功！');
    } catch (error) {
      message.error('创建游戏失败：' + error.message);
    }
  };

  // 游戏列表列定义
  const gameColumns = [
    { title: '房间ID', dataIndex: 'id', key: 'id', render: (id) => <Tag color="purple">{id}</Tag> },
    { title: '房间名称', dataIndex: 'name', key: 'name' },
    {
      title: 'AI难度', dataIndex: 'aiDifficulty', key: 'aiDifficulty',
      render: (d) => {
        const map = { easy: { color: 'green', label: '简单' }, medium: { color: 'orange', label: '中等' }, hard: { color: 'red', label: '困难' } };
        return <Tag color={map[d]?.color}>{map[d]?.label}</Tag>;
      }
    },
    { title: '玩家', dataIndex: 'players', key: 'players', render: (p, r) => <span>{p} / {r.maxPlayers}</span> },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s) => <Tag color={s === 'waiting' ? 'success' : 'processing'}>{s === 'waiting' ? '等待中' : '游戏中'}</Tag>
    },
  ];

  // ============= 渲染：大厅 Tab =============
  const renderLobby = () => (
    <div className="poker-lobby">
      {/* 英雄区域 */}
      <Card className="poker-hero-card">
        <div className="poker-hero-content">
          <div className="poker-hero-text">
            <Text className="poker-hero-greeting">🎴 德州扑克</Text>
            <Title level={2} className="poker-hero-title">
              在博弈中<span className="gradient-text">认识自己</span>
            </Title>
            <Paragraph className="poker-hero-desc">
              每一次下注都是一次决策样本，每一手牌都是人格的镜像。
              系统会采集你的行动模式，用于构建更精准的人格画像。
            </Paragraph>
            <Space size="middle">
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                className="quick-start-btn"
                loading={isLoading}
                onClick={handleQuickStart}
              >
                快速开始
              </Button>
              <Button
                size="large"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建房间
              </Button>
              <Button size="large" icon={<ReloadOutlined />} onClick={fetchGames}>
                刷新
              </Button>
            </Space>
          </div>
          <div className="poker-hero-stats">
            <div className="poker-hero-stat">
              <span className="stat-emoji">🏆</span>
              <span className="stat-value">{mockStats.totalHands}</span>
              <span className="stat-label">历史牌局</span>
            </div>
            <div className="poker-hero-stat">
              <span className="stat-emoji">📈</span>
              <span className="stat-value">{(mockStats.winRate * 100).toFixed(0)}%</span>
              <span className="stat-label">总胜率</span>
            </div>
            <div className="poker-hero-stat">
              <span className="stat-emoji">💰</span>
              <span className="stat-value profit">{mockStats.totalProfit > 0 ? '+' : ''}{mockStats.totalProfit}</span>
              <span className="stat-label">累计盈亏</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 快速统计 */}
      <Row gutter={[16, 16]} className="poker-stats-row">
        <Col xs={12} md={6}>
          <Card className="poker-stat-card">
            <Statistic
              title={<span><AimOutlined /> VPIP（主动入池率）</span>}
              value={mockStats.vpip * 100}
              precision={0}
              suffix="%"
              valueStyle={{ color: '#8b5cf6' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="poker-stat-card">
            <Statistic
              title={<span><ThunderboltOutlined /> PFR（翻前加注率）</span>}
              value={mockStats.pfr * 100}
              precision={0}
              suffix="%"
              valueStyle={{ color: '#ec4899' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="poker-stat-card">
            <Statistic
              title={<span><FireOutlined /> 攻击系数 (AF)</span>}
              value={mockStats.af}
              precision={1}
              valueStyle={{ color: '#f97316' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="poker-stat-card">
            <Statistic
              title={<span><ClockCircleOutlined /> 平均决策时间</span>}
              value={mockStats.avgDecisionTime}
              precision={1}
              suffix="秒"
              valueStyle={{ color: '#06b6d4' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 游戏列表 */}
      <Card title={<span><TeamOutlined /> 可用房间</span>} className="poker-list-card">
        {gameList.length === 0 ? (
          <Empty
            description={
              <span>
                暂无可用房间，点击
                <Button type="link" onClick={() => setCreateModalVisible(true)}>创建房间</Button>
                或使用
                <Button type="link" onClick={handleQuickStart}>快速开始</Button>
              </span>
            }
          />
        ) : (
          <Table
            columns={gameColumns}
            dataSource={gameList}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      {/* 行为采集说明 */}
      <Card
        title={<span><DatabaseOutlined /> 行为数据采集 · 你的哪些数据会被记录？</span>}
        className="poker-data-info-card"
        extra={<Tooltip title="所有数据仅用于本地人格建模，不会上传到任何第三方服务器"><InfoCircleOutlined style={{ color: '#8b5cf6' }} /></Tooltip>}
      >
        <Row gutter={[16, 16]}>
          {COLLECTED_DATA_TYPES.map((item) => (
            <Col xs={24} sm={12} md={8} lg={6} key={item.key}>
              <div className="data-type-card">
                <span className="data-type-icon">{item.icon}</span>
                <div className="data-type-content">
                  <Text strong className="data-type-title">{item.title}</Text>
                  <Text type="secondary" className="data-type-desc">{item.desc}</Text>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );

  // ============= 渲染：牌桌 Tab =============
  const renderTable = () => {
    if (!gameState) {
      return (
        <div className="poker-empty-table">
          <Card>
            <Empty
              description={
                <span>
                  还没开始游戏
                  <Divider type="vertical" />
                  <Button type="primary" onClick={() => setActiveTab('lobby')}>返回大厅</Button>
                  <Button type="link" onClick={handleQuickStart}>快速开始一局</Button>
                </span>
              }
            />
          </Card>
        </div>
      );
    }
    return (
      <div className="poker-table-layout">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <PokerTable gameState={gameState} playerId={playerId} />
          </Col>
          <Col xs={24} lg={8}>
            <Dashboard gameState={gameState} />
          </Col>
        </Row>
      </div>
    );
  };

  // ============= 渲染：统计 Tab =============
  const renderStats = () => (
    <div className="poker-stats-page">
      {/* 总体盈亏卡片 */}
      <Card className="poker-profit-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div className="profit-section">
              <Text type="secondary">累计盈亏</Text>
              <Title level={2} className={mockStats.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}>
                {mockStats.totalProfit >= 0 ? '+' : ''}${mockStats.totalProfit}
              </Title>
              <Tag color={mockStats.isWinStreak ? 'green' : 'red'}>
                {mockStats.isWinStreak ? <RiseOutlined /> : <FallOutlined />}
                {' '}当前{mockStats.isWinStreak ? '连胜' : '连败'} {mockStats.currentStreak} 局
              </Tag>
            </div>
          </Col>
          <Col xs={12} md={4}>
            <Statistic
              title="最大单局盈利"
              value={mockStats.biggestWin}
              prefix="+"
              valueStyle={{ color: '#22c55e' }}
            />
          </Col>
          <Col xs={12} md={4}>
            <Statistic
              title="最大单局亏损"
              value={mockStats.biggestLoss}
              prefix="-"
              valueStyle={{ color: '#ef4444' }}
            />
          </Col>
          <Col xs={12} md={4}>
            <Statistic
              title="平均底池"
              value={mockStats.avgPot}
              valueStyle={{ color: '#8b5cf6' }}
            />
          </Col>
          <Col xs={12} md={4}>
            <Statistic
              title="Tilt 次数"
              value={mockStats.tiltEpisodes}
              valueStyle={{ color: '#f97316' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 详细数据 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={<span><LineChartOutlined /> 核心指标</span>} className="poker-stats-card">
            <List
              dataSource={[
                { label: 'VPIP（主动入池率）', value: mockStats.vpip, target: '25%-35%' },
                { label: 'PFR（翻前加注率）', value: mockStats.pfr, target: '20%-30%' },
                { label: '攻击系数 AF', value: mockStats.af, target: '1.5-2.5' },
                { label: '总胜率', value: mockStats.winRate, target: '45%-55%' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <div className="stat-row">
                    <Text>{item.label}</Text>
                    <div className="stat-row-right">
                      <Progress
                        percent={item.value * 100}
                        size="small"
                        showInfo={false}
                        style={{ width: 120 }}
                      />
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
          <Card title={<span><ThunderboltOutlined /> 行为标签</span>} className="poker-stats-card">
            <div className="behavior-tags">
              <Tag color="orange" icon={<FireOutlined />} className="behavior-tag">🔥 激进型玩家</Tag>
              <Tag color="blue" icon={<SafetyOutlined />} className="behavior-tag">🛡️ 翻前偏紧</Tag>
              <Tag color="purple" icon={<ExperimentOutlined />} className="behavior-tag">🎭 偶尔诈唬</Tag>
              <Tag color="green" icon={<CheckCircleOutlined />} className="behavior-tag">✅ 决策稳定</Tag>
              <Tag color="cyan" icon={<ClockCircleOutlined />} className="behavior-tag">⏱️ 思考时间适中</Tag>
              <Tag color="magenta" icon={<TrophyOutlined />} className="behavior-tag">🏆 连胜记录</Tag>
            </div>
            <Divider />
            <div className="mbti-mapping">
              <Text type="secondary">基于当前行为模式的 MBTI 推断：</Text>
              <div className="mbti-mapping-row">
                <Tag color="purple" className="mbti-tag">INTJ</Tag>
                <Text type="secondary">置信度 68%</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                提示：更多的牌局数据将提升人格画像的准确度
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最近行动 */}
      <Card title={<span><ClockCircleOutlined /> 最近行动记录</span>} className="poker-stats-card">
        {actionHistory.length === 0 ? (
          <Empty description="暂无行动记录，开始游戏后会显示你的每一个决策" />
        ) : (
          <List
            dataSource={[...actionHistory].reverse().slice(0, 10)}
            renderItem={(item, idx) => {
              const actionMap = { fold: { label: '弃牌', color: 'red' }, check: { label: '过牌', color: 'default' }, call: { label: '跟注', color: 'blue' }, raise: { label: '加注', color: 'orange' }, allin: { label: 'ALL IN', color: 'red' } };
              const a = actionMap[item.action] || { label: item.action, color: 'default' };
              return (
                <List.Item>
                  <Space>
                    <Avatar style={{ backgroundColor: item.isAi ? '#7c3aed' : '#ec4899' }}>
                      {idx + 1}
                    </Avatar>
                    <Text>{item.isAi ? '🤖 AI' : '🧑 你'}</Text>
                    <Tag color={a.color}>{a.label}</Tag>
                    {item.amount > 0 && <Text>金额: <b>{item.amount}</b></Text>}
                    <Text type="secondary">{new Date(item.timestamp).toLocaleTimeString()}</Text>
                  </Space>
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    </div>
  );

  // ============= 渲染：行为采集 Tab =============
  const renderBehaviorCapture = () => (
    <div className="poker-behavior-page">
      {/* 采集状态总览 */}
      <Card className="behavior-overview-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">🎯</span>
              <div>
                <Text type="secondary">已采集决策样本</Text>
                <Title level={3} style={{ margin: 0 }}>{actionHistory.length + mockStats.totalHands * 6}</Title>
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">📊</span>
              <div>
                <Text type="secondary">数据维度覆盖</Text>
                <Title level={3} style={{ margin: 0 }}>6 / 8</Title>
                <Progress percent={75} size="small" showInfo={false} />
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">🧠</span>
              <div>
                <Text type="secondary">人格画像准确度</Text>
                <Title level={3} style={{ margin: 0 }}>68%</Title>
                <Progress percent={68} size="small" strokeColor="#8b5cf6" showInfo={false} />
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 采集数据类型详情 */}
      <Card title={<span><DatabaseOutlined /> 采集数据类型详解</span>} className="behavior-detail-card">
        <Row gutter={[16, 16]}>
          {COLLECTED_DATA_TYPES.map((item) => (
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
                  <Progress
                    percent={Math.floor(Math.random() * 40 + 50)}
                    size="small"
                    showInfo={false}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>样本充足度</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 数据流向说明 */}
      <Card title={<span><InfoCircleOutlined /> 数据如何被使用？</span>} className="behavior-dataflow-card">
        <div className="dataflow-steps">
          <div className="dataflow-step">
            <div className="dataflow-step-icon">🎮</div>
            <div className="dataflow-step-content">
              <Text strong>Step 1: 游戏中采集</Text>
              <Paragraph type="secondary">每一手牌、每一个决策都会被记录为结构化数据点</Paragraph>
            </div>
          </div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step">
            <div className="dataflow-step-icon">🧮</div>
            <div className="dataflow-step-content">
              <Text strong>Step 2: 行为模式分析</Text>
              <Paragraph type="secondary">计算 VPIP/PFR/AF 等核心指标，识别下注模式和风格标签</Paragraph>
            </div>
          </div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step">
            <div className="dataflow-step-icon">🧠</div>
            <div className="dataflow-step-content">
              <Text strong>Step 3: 人格画像映射</Text>
              <Paragraph type="secondary">行为模式 → MBTI维度映射 → 更新你的人格数字孪生</Paragraph>
            </div>
          </div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step">
            <div className="dataflow-step-icon">✨</div>
            <div className="dataflow-step-content">
              <Text strong>Step 4: 个性化反馈</Text>
              <Paragraph type="secondary">生成培养方案、时尚建议、内容推荐，塑造更好的你</Paragraph>
            </div>
          </div>
        </div>
      </Card>

      {/* 隐私声明 */}
      <Card className="behavior-privacy-card">
        <Space>
          <SafetyOutlined style={{ fontSize: 24, color: '#22c55e' }} />
          <div>
            <Text strong>🔒 你的数据完全由你掌控</Text>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              所有行为数据仅存储在本地，用于构建你的人格画像。我们不会将任何数据上传到第三方服务器，你可以随时在「工具」页面清除所有数据。
            </Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  );

  return (
    <div className="poker-page">
      {/* 页面标题栏 */}
      <div className="poker-page-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>返回首页</Button>
        <Title level={4} style={{ margin: 0 }}>
          <span className="gradient-text">🎴 德州扑克</span>
          <Text type="secondary" style={{ marginLeft: 12, fontWeight: 'normal' }}>
            行为数据采集的核心入口
          </Text>
        </Title>
        <Space>
          {gameState && (
            <Badge status="processing" text="游戏进行中" />
          )}
        </Space>
      </div>

      {/* Tab 切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className="poker-tabs"
        items={[
          { key: 'arena', label: <span><ThunderboltOutlined /> 午夜竞技场</span> },
          { key: 'lobby', label: <span><PlayCircleOutlined /> 游戏大厅</span> },
          { key: 'table', label: <span><TrophyOutlined /> 牌桌对战 {gameState && <Badge dot color="#22c55e" />}</span> },
          { key: 'stats', label: <span><LineChartOutlined /> 数据统计</span> },
          { key: 'behavior', label: <span><DatabaseOutlined /> 行为采集</span> },
        ]}
      />

      {/* Tab 内容 */}
      {activeTab === 'arena' && <PokerArena />}
      {activeTab === 'lobby' && renderLobby()}
      {activeTab === 'table' && renderTable()}
      {activeTab === 'stats' && renderStats()}
      {activeTab === 'behavior' && renderBehaviorCapture()}

      {/* 创建房间弹窗 */}
      <Modal
        title={<span><PlusOutlined /> 创建新房间</span>}
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        className="poker-modal"
      >
        <Form
          form={form}
          onFinish={handleCreateGame}
          layout="vertical"
          initialValues={{ playerName: 'Player', aiDifficulty: 'medium' }}
        >
          <Form.Item name="playerName" label="玩家名称" rules={[{ required: true, message: '请输入玩家名称' }]}>
            <Input prefix={<UserOutlined />} placeholder="输入你的名字" />
          </Form.Item>
          <Form.Item name="aiDifficulty" label="AI难度" rules={[{ required: true }]}>
            <Select>
              <Option value="easy">😊 简单 - 适合新手练习</Option>
              <Option value="medium">🤔 中等 - 有一定挑战</Option>
              <Option value="hard">😈 困难 - 高阶策略对抗</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={isLoading} block>
              创建并进入游戏
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PokerPage;
