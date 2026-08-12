import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Progress,
  Statistic,
  Divider,
  Badge,
  List,
  Avatar,
  Slider,
  Tooltip,
  Select,
} from 'antd';
import {
  ArrowLeftOutlined,
  HomeOutlined,
  UserOutlined,
  HeartOutlined,
  MessageOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  CodeSandboxOutlined,
  ExperimentOutlined,
  SafetyCertificateOutlined,
  SoundOutlined,
  CoffeeOutlined,
  FireOutlined,
  ClockCircleOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import {
  robotCognitiveEngine,
  extractUserProfile,
  selectRobotMode,
  generateDialogueStrategy,
  generateBehaviorRhythm,
  getExampleDialogue,
  ROBOT_PERSONALITY_MODES,
} from '../utils/robotCognitiveEngine';
import { logger } from '../utils/logger';

const { Title, Text, Paragraph } = Typography;

const RobotPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // overview | mode | dialogue | rhythm
  const [userInput, setUserInput] = useState('');
  const [emotionOverride, setEmotionOverride] = useState(null);
  const [mbtiOverride, setMbtiOverride] = useState(null);
  const [storyModeOverride, setStoryModeOverride] = useState(null);

  // 用户画像
  const baseUserProfile = useMemo(() => extractUserProfile(), []);

  const userProfile = useMemo(() => ({
    ...baseUserProfile,
    ...(emotionOverride !== null ? { emotion: emotionOverride } : {}),
    ...(mbtiOverride !== null ? { currentMbti: mbtiOverride } : {}),
    ...(storyModeOverride !== null ? { storyMode: storyModeOverride } : {}),
  }), [baseUserProfile, emotionOverride, mbtiOverride, storyModeOverride]);

  // 机器人模式
  const robotModeResult = useMemo(() => selectRobotMode(userProfile), [userProfile]);
  const { selectedMode, reasons, modeConfidences, triggers } = robotModeResult;

  // 对话策略
  const dialogueStrategy = useMemo(
    () => generateDialogueStrategy(selectedMode, userProfile, userInput),
    [selectedMode, userProfile, userInput]
  );

  // 行为节奏
  const behaviorRhythm = useMemo(() => generateBehaviorRhythm(userProfile), [userProfile]);

  // 示例对话
  const exampleDialogues = useMemo(
    () => getExampleDialogue(selectedMode, userProfile),
    [selectedMode, userProfile]
  );

  const comparisonData = [
    {
      traditional: '控制关节、电机、传感器',
      yours: '控制"行为策略"的生成与切换',
      icon: '🦾',
    },
    {
      traditional: '处理环境感知',
      yours: '处理"用户输入"的语义与情感',
      icon: '👁️',
    },
    {
      traditional: '执行预设动作',
      yours: '执行"人格模式"的调用与切换',
      icon: '🎭',
    },
  ];

  const mbtiOptions = [
    'INTJ', 'INTP', 'ENTJ', 'ENTP',
    'INFJ', 'INFP', 'ENFJ', 'ENFP',
    'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
    'ISTP', 'ISFP', 'ESTP', 'ESFP',
  ];

  return (
    <div className="robot-page fade-in" style={{ padding: 16 }}>
      {/* 顶部导航 */}
      <Card style={{ marginBottom: 16, background: 'rgba(30, 19, 64, 0.6)' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
              返回首页
            </Button>
            <Button icon={<HomeOutlined />} onClick={() => navigate('/dashboard')}>
              总控台
            </Button>
            <Divider type="vertical" />
            <Title level={4} style={{ margin: 0 }}>
              🤖 人形机器人 · 认知引擎
            </Title>
          </Space>
          <Space>
            <Tag color="purple">Y.Mine 总控台 › 机器人认知层</Tag>
            <Badge status="processing" text="人格对齐运行中" />
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {/* 左侧主内容 */}
        <Col xs={24} lg={16}>
          {/* 核心概念对比 */}
          <Card
            title={
              <Space>
                <span style={{ fontSize: 20 }}>💡</span>
                <span>核心理念：你的系统 = 人形机器人的"认知引擎"</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[12, 12]}>
              {comparisonData.map((item, i) => (
                <Col xs={24} md={8} key={i}>
                  <Card
                    size="small"
                    style={{
                      background: 'rgba(139, 92, 246, 0.06)',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                      height: '100%',
                    }}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <span style={{ fontSize: 28 }}>{item.icon}</span>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>传统机器人控制</Text>
                        <div style={{ color: '#fff', fontSize: 13 }}>{item.traditional}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <Tag color="purple" style={{ fontSize: 11 }}>→ 升级为 →</Tag>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>你的系统</Text>
                        <div style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600 }}>{item.yours}</div>
                      </div>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          {/* 用户状态调节器 */}
          <Card
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#fbbf24' }} />
                <span>用户状态调节器（实时模拟不同用户状态）</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>情绪值</Text>
                  <Tag color={emotionOverride !== null ? 'processing' : 'default'} style={{ marginLeft: 8 }}>
                    {emotionOverride !== null ? `${emotionOverride}` : `当前: ${userProfile.emotion}`}
                  </Tag>
                </div>
                <Slider
                  min={0}
                  max={100}
                  value={emotionOverride !== null ? emotionOverride : userProfile.emotion}
                  onChange={(v) => {
                    setEmotionOverride(v);
                    logger.session('情绪值调整', v);
                  }}
                  marks={{
                    0: { label: '😢 低落' },
                    50: { label: '😐 平静' },
                    100: { label: '😄 高涨' },
                  }}
                  tooltip={{ formatter: (v) => `情绪值: ${v}` }}
                />
                <Button
                  size="small"
                  type={emotionOverride !== null ? 'primary' : 'default'}
                  onClick={() => setEmotionOverride(null)}
                  style={{ marginTop: 4 }}
                >
                  {emotionOverride !== null ? '重置为实际值' : '使用实际值'}
                </Button>
              </Col>

              <Col xs={24} md={8}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>MBTI 模式</Text>
                </div>
                <Select
                  style={{ width: '100%' }}
                  value={mbtiOverride || userProfile.currentMbti}
                  onChange={(v) => {
                    setMbtiOverride(v);
                    logger.session('MBTI切换', v);
                  }}
                  showSearch
                >
                  {mbtiOptions.map((m) => (
                    <Select.Option key={m} value={m}>
                      {m}
                    </Select.Option>
                  ))}
                </Select>
                <Button
                  size="small"
                  type={mbtiOverride !== null ? 'primary' : 'default'}
                  onClick={() => setMbtiOverride(null)}
                  style={{ marginTop: 8 }}
                >
                  {mbtiOverride !== null ? '重置为实际值' : '使用实际值'}
                </Button>
              </Col>

              <Col xs={24} md={8}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>故事模式</Text>
                </div>
                <Select
                  style={{ width: '100%' }}
                  value={storyModeOverride || userProfile.storyMode}
                  onChange={(v) => {
                    setStoryModeOverride(v);
                    logger.session('故事模式切换', v);
                  }}
                >
                  <Select.Option value="cigar">🥃 雪茄（慢节奏）</Select.Option>
                  <Select.Option value="firework">🎆 烟火（快节奏）</Select.Option>
                  <Select.Option value="both">✨ 均衡</Select.Option>
                </Select>
                <Button
                  size="small"
                  type={storyModeOverride !== null ? 'primary' : 'default'}
                  onClick={() => setStoryModeOverride(null)}
                  style={{ marginTop: 8 }}
                >
                  {storyModeOverride !== null ? '重置为实际值' : '使用实际值'}
                </Button>
              </Col>
            </Row>
          </Card>

          {/* 接入能力展示 - 选项卡 */}
          <Card
            tabList={[
              { key: 'mode', tab: '🎭 人格模式选择' },
              { key: 'dialogue', tab: '💬 对话策略' },
              { key: 'rhythm', tab: '🎵 行为节奏' },
            ]}
            activeTabKey={activeTab}
            onTabChange={setActiveTab}
            style={{ marginBottom: 16 }}
          >
            {/* 人格模式 */}
            {activeTab === 'mode' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <AlertBox
                  title="机器人根据用户状态自动选择最合适的人格模式"
                  description="不是固定的一种人格——机器人会根据你的情绪值、MBTI、故事模式，在 6 种人格模式之间动态切换。"
                  type="info"
                />

                {/* 当前选中模式 */}
                <Card
                  style={{
                    background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(236, 72, 153, 0.1))',
                    border: '2px solid rgba(139, 92, 246, 0.5)',
                  }}
                >
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 40,
                          margin: '0 auto',
                          boxShadow: '0 0 40px rgba(139, 92, 246, 0.4)',
                        }}
                      >
                        {selectedMode.emoji}
                      </div>
                    </Col>
                    <Col xs={24} sm={18}>
                      <Space direction="vertical" size={4}>
                        <Space>
                          <Title level={3} style={{ margin: 0, color: '#fff' }}>
                            {selectedMode.name}
                          </Title>
                          <Tag color="purple" style={{ fontSize: 13 }}>
                            当前激活
                          </Tag>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {selectedMode.description}
                        </Text>
                        <Space wrap style={{ marginTop: 4 }}>
                          <Tag color="blue">语速: {selectedMode.speechRate}x</Tag>
                          <Tag color="green">响应延迟: {selectedMode.responseDelay}ms</Tag>
                          <Tag color="orange">
                            主动性: {selectedMode.initiative === 'passive' ? '被动' : selectedMode.initiative === 'active' ? '主动' : '任务导向'}
                          </Tag>
                        </Space>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                {/* 触发理由 */}
                <Card size="small" title="📋 模式切换决策理由">
                  <List
                    size="small"
                    dataSource={reasons}
                    renderItem={(reason) => (
                      <List.Item style={{ border: 'none', padding: '6px 0' }}>
                        <Tag color="purple" style={{ marginRight: 8 }}>✓</Tag>
                        <Text style={{ color: '#fff' }}>{reason}</Text>
                      </List.Item>
                    )}
                  />
                </Card>

                {/* 全部模式匹配度 */}
                <Card size="small" title="📊 所有人格模式匹配度">
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {modeConfidences.map(({ mode, confidence }) => (
                      <div key={mode.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 22, width: 32 }}>{mode.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <Text style={{ color: '#fff', fontSize: 13 }}>{mode.name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {confidence.toFixed(1)}%
                            </Text>
                          </div>
                          <Progress
                            percent={confidence}
                            size="small"
                            showInfo={false}
                            strokeColor={mode.id === selectedMode.id ? '#a78bfa' : '#666'}
                          />
                        </div>
                      </div>
                    ))}
                  </Space>
                </Card>
              </Space>
            )}

            {/* 对话策略 */}
            {activeTab === 'dialogue' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <AlertBox
                  title="机器人根据用户 MBTI 和情绪调整对话策略"
                  description="不是统一的聊天语气——INTJ 用户会得到直接简洁的回复，INFP 用户会得到温和引导的对话，情绪低落时自动切换到共情模式。"
                  type="success"
                />

                {/* 触发信号 */}
                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: 'rgba(251, 191, 36, 0.08)' }}>
                      <Statistic
                        title="情绪值"
                        value={triggers.emotion}
                        valueStyle={{
                          color:
                            triggers.emotion < 35
                              ? '#ef4444'
                              : triggers.emotion > 75
                              ? '#10b981'
                              : '#fbbf24',
                        }}
                        prefix={<HeartOutlined />}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {triggers.emotion < 35
                          ? '→ 启用共情模式'
                          : triggers.emotion > 75
                          ? '→ 启用活力模式'
                          : '→ 标准模式'}
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: 'rgba(139, 92, 246, 0.08)' }}>
                      <Statistic
                        title="MBTI"
                        value={triggers.mbti}
                        valueStyle={{ color: '#a78bfa' }}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {triggers.mbti[2] === 'T' ? '思考型 → 直接简洁' : '情感型 → 温和引导'}
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: 'rgba(236, 72, 153, 0.08)' }}>
                      <Statistic
                        title="故事模式"
                        value={
                          triggers.storyMode === 'cigar'
                            ? '雪茄'
                            : triggers.storyMode === 'firework'
                            ? '烟火'
                            : '均衡'
                        }
                        valueStyle={{ color: '#ec4899' }}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {triggers.storyMode === 'cigar'
                          ? '→ 慢节奏对话'
                          : triggers.storyMode === 'firework'
                          ? '→ 快节奏对话'
                          : '→ 标准节奏'}
                      </Text>
                    </Card>
                  </Col>
                </Row>

                {/* 对话策略参数 */}
                <Card
                  title={
                    <Space>
                      <MessageOutlined style={{ color: '#10b981' }} />
                      <span>当前对话策略参数</span>
                    </Space>
                  }
                >
                  <Row gutter={[12, 12]}>
                    <Col xs={24} sm={12}>
                      <List
                        size="small"
                        dataSource={[
                          { label: '语速', value: `${dialogueStrategy.speechRate}x`, color: '#3b82f6' },
                          { label: '语气', value: dialogueStrategy.tone, color: '#8b5cf6' },
                          { label: '详细程度', value: dialogueStrategy.verbosity, color: '#ec4899' },
                          { label: '响应延迟', value: `${dialogueStrategy.responseDelay}ms`, color: '#fbbf24' },
                        ]}
                        renderItem={(item) => (
                          <List.Item style={{ border: 'none', padding: '6px 0' }}>
                            <Text type="secondary">{item.label}</Text>
                            <Tag color={item.color} style={{ marginLeft: 'auto' }}>
                              {item.value}
                            </Tag>
                          </List.Item>
                        )}
                      />
                    </Col>
                    <Col xs={24} sm={12}>
                      <List
                        size="small"
                        dataSource={[
                          {
                            label: '直接程度',
                            value: dialogueStrategy.directnessLevel,
                            color: dialogueStrategy.directnessLevel > 70 ? '#ef4444' : '#10b981',
                          },
                          {
                            label: '共情程度',
                            value: dialogueStrategy.empathyLevel,
                            color: dialogueStrategy.empathyLevel > 70 ? '#ec4899' : '#3b82f6',
                          },
                          {
                            label: '情感表达',
                            value: dialogueStrategy.emotionalExpression,
                            color: '#fbbf24',
                          },
                          {
                            label: '主动发起',
                            value: dialogueStrategy.shouldInitiate ? '是' : '否',
                            color: dialogueStrategy.shouldInitiate ? '#10b981' : '#666',
                          },
                        ]}
                        renderItem={(item) => (
                          <List.Item style={{ border: 'none', padding: '6px 0' }}>
                            <Text type="secondary">{item.label}</Text>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                              {typeof item.value === 'number' && (
                                <Progress
                                  percent={item.value}
                                  size="small"
                                  style={{ width: 60 }}
                                  strokeColor={item.color}
                                  showInfo={false}
                                />
                              )}
                              <Tag color={item.color}>{item.value}</Tag>
                            </div>
                          </List.Item>
                        )}
                      />
                    </Col>
                  </Row>
                </Card>

                {/* 示例对话 */}
                <Card
                  title={
                    <Space>
                      <BulbOutlined style={{ color: '#fbbf24' }} />
                      <span>对话示例（当前人格模式）</span>
                    </Space>
                  }
                >
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {exampleDialogues.map((scenario, i) => (
                      <Card
                        key={i}
                        size="small"
                        style={{
                          background: 'rgba(30, 19, 64, 0.6)',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                        }}
                      >
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          <Tag color="purple" style={{ alignSelf: 'flex-start' }}>
                            场景：{scenario.trigger}
                          </Tag>
                          <div style={{ padding: '8px 12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>用户说：</Text>
                            <div>
                              <Text style={{ color: '#fff' }}>"{scenario.userSays}"</Text>
                            </div>
                          </div>
                          <div
                            style={{
                              padding: '8px 12px',
                              background: 'rgba(16, 185, 129, 0.1)',
                              borderRadius: 8,
                              borderLeft: '3px solid #10b981',
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {selectedMode.emoji} {selectedMode.name} 回应：
                            </Text>
                            <div>
                              <Text style={{ color: '#fff' }}>"{scenario.robotResponse}"</Text>
                            </div>
                          </div>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                </Card>
              </Space>
            )}

            {/* 行为节奏 */}
            {activeTab === 'rhythm' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <AlertBox
                  title="机器人的行为节奏根据用户的'雪茄/烟火'选择自适应"
                  description="不是统一的行动速度——雪茄模式下机器人会放慢节奏、减少互动、给用户更多空间；烟火模式下会加快节奏、增加互动、更有表现力。"
                  type="warning"
                />

                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={12}>
                    <Card size="small" style={{ background: 'rgba(139, 92, 246, 0.08)' }}>
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Space>
                          <CoffeeOutlined style={{ fontSize: 24, color: '#d4a574' }} />
                          <Text strong style={{ color: '#d4a574' }}>雪茄模式</Text>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          慢节奏 · 低频次互动 · 轻柔动作 · 更长停顿
                        </Text>
                        <List
                          size="small"
                          dataSource={[
                            { label: '移动速度', value: '0.7x' },
                            { label: '动作流畅度', value: '92%' },
                            { label: '互动频率', value: '低' },
                            { label: '动作间停顿', value: '1500ms' },
                          ]}
                          renderItem={(item) => (
                            <List.Item style={{ border: 'none', padding: '2px 0' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {item.label}
                              </Text>
                              <Tag color="default" style={{ fontSize: 11 }}>
                                {item.value}
                              </Tag>
                            </List.Item>
                          )}
                        />
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Card size="small" style={{ background: 'rgba(236, 72, 153, 0.08)' }}>
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Space>
                          <FireOutlined style={{ fontSize: 24, color: '#f472b6' }} />
                          <Text strong style={{ color: '#f472b6' }}>烟火模式</Text>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          快节奏 · 高频次互动 · 富有表现力 · 更短停顿
                        </Text>
                        <List
                          size="small"
                          dataSource={[
                            { label: '移动速度', value: '1.3x' },
                            { label: '动作流畅度', value: '55%' },
                            { label: '互动频率', value: '高' },
                            { label: '动作间停顿', value: '400ms' },
                          ]}
                          renderItem={(item) => (
                            <List.Item style={{ border: 'none', padding: '2px 0' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {item.label}
                              </Text>
                              <Tag color="default" style={{ fontSize: 11 }}>
                                {item.value}
                              </Tag>
                            </List.Item>
                          )}
                        />
                      </Space>
                    </Card>
                  </Col>
                </Row>

                {/* 当前节奏 */}
                <Card
                  title={
                    <Space>
                      <ClockCircleOutlined style={{ color: '#a78bfa' }} />
                      <span>当前行为节奏</span>
                      <Tag color="purple" style={{ fontSize: 13 }}>
                        {behaviorRhythm.description}
                      </Tag>
                    </Space>
                  }
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={6}>
                      <Card size="small" style={{ textAlign: 'center' }}>
                        <Statistic
                          title="移动速度"
                          value={behaviorRhythm.movementSpeed.toFixed(2)}
                          suffix="x"
                          valueStyle={{ color: '#3b82f6' }}
                        />
                        <Tag color="blue" style={{ marginTop: 4 }}>
                          {behaviorRhythm.labels.movementSpeed}
                        </Tag>
                      </Card>
                    </Col>
                    <Col xs={24} sm={6}>
                      <Card size="small" style={{ textAlign: 'center' }}>
                        <Statistic
                          title="动作流畅度"
                          value={(behaviorRhythm.movementSmoothness * 100).toFixed(0)}
                          suffix="%"
                          valueStyle={{ color: '#10b981' }}
                        />
                        <Progress
                          percent={behaviorRhythm.movementSmoothness * 100}
                          size="small"
                          showInfo={false}
                          strokeColor="#10b981"
                          style={{ marginTop: 4 }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={6}>
                      <Card size="small" style={{ textAlign: 'center' }}>
                        <Statistic
                          title="互动频率"
                          value={behaviorRhythm.interactionFrequency}
                          valueStyle={{ color: '#ec4899' }}
                        />
                        <Tag color="magenta" style={{ marginTop: 4 }}>
                          {behaviorRhythm.labels.interactionFrequency}
                        </Tag>
                      </Card>
                    </Col>
                    <Col xs={24} sm={6}>
                      <Card size="small" style={{ textAlign: 'center' }}>
                        <Statistic
                          title="动作间停顿"
                          value={behaviorRhythm.pauseBetweenActions}
                          suffix="ms"
                          valueStyle={{ color: '#fbbf24' }}
                        />
                        <Tag color="gold" style={{ marginTop: 4 }}>
                          {behaviorRhythm.labels.gestureIntensity}
                        </Tag>
                      </Card>
                    </Col>
                  </Row>
                </Card>

                {/* 模式对比可视化 */}
                <Card
                  title={
                    <Space>
                      <SoundOutlined style={{ color: '#a78bfa' }} />
                      <span>三种模式节奏对比</span>
                    </Space>
                  }
                >
                  <RhythmComparisonChart currentRhythm={behaviorRhythm} />
                </Card>
              </Space>
            )}
          </Card>
        </Col>

        {/* 右侧状态面板 */}
        <Col xs={24} lg={8}>
          {/* 当前用户画像 */}
          <Card
            title={
              <Space>
                <UserOutlined style={{ color: '#a78bfa' }} />
                <span>当前用户画像</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar
                  size={56}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    fontSize: 24,
                  }}
                >
                  {userProfile.currentMbti[0]}
                </Avatar>
                <div>
                  <div>
                    <Tag color="purple" style={{ fontSize: 14, padding: '4px 12px' }}>
                      {userProfile.currentMbti}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      置信度 {userProfile.mbtiConfidence}%
                    </Text>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>清醒天数: </Text>
                    <Tag color="success">{userProfile.soberDays} 天</Tag>
                  </div>
                </div>
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>情绪状态</Text>
                <div style={{ marginTop: 4 }}>
                  <Progress
                    percent={userProfile.emotion}
                    strokeColor={
                      userProfile.emotion < 35
                        ? '#ef4444'
                        : userProfile.emotion > 75
                        ? '#10b981'
                        : '#fbbf24'
                    }
                    format={(p) =>
                      p < 35 ? '😢 低落' : p > 75 ? '😄 高涨' : '😐 平静'
                    }
                  />
                </div>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>故事偏好</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag
                    color={userProfile.storyMode === 'cigar' ? 'orange' : userProfile.storyMode === 'firework' ? 'magenta' : 'purple'}
                    style={{ fontSize: 13 }}
                  >
                    {userProfile.storyMode === 'cigar'
                      ? '🥃 雪茄（慢）'
                      : userProfile.storyMode === 'firework'
                      ? '🎆 烟火（快）'
                      : '✨ 均衡'}
                  </Tag>
                </div>
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <List
                size="small"
                dataSource={[
                  { label: '风险容忍度', value: userProfile.riskTolerance, color: '#ec4899' },
                  { label: '时间偏好', value: userProfile.timePreference, color: '#3b82f6' },
                  { label: '执行纪律', value: userProfile.executionDiscipline, color: '#10b981' },
                ]}
                renderItem={(item) => (
                  <List.Item style={{ border: 'none', padding: '4px 0' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.label}
                    </Text>
                    <Progress
                      percent={item.value}
                      size="small"
                      style={{ width: 100 }}
                      strokeColor={item.color}
                      format={(p) => `${p}`}
                    />
                  </List.Item>
                )}
              />
            </Space>
          </Card>

          {/* 人格模式列表 */}
          <Card
            title={
              <Space>
                <RobotOutlined style={{ color: '#10b981' }} />
                <span>6 种人格模式</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {ROBOT_PERSONALITY_MODES.map((mode) => (
                <div
                  key={mode.id}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background:
                      mode.id === selectedMode.id
                        ? 'rgba(139, 92, 246, 0.15)'
                        : 'rgba(255,255,255,0.02)',
                    border:
                      mode.id === selectedMode.id
                        ? '1px solid rgba(139, 92, 246, 0.5)'
                        : '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.3s',
                  }}
                >
                  <Space>
                    <span style={{ fontSize: 22 }}>{mode.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Space>
                        <Text strong style={{ color: '#fff', fontSize: 13 }}>
                          {mode.name}
                        </Text>
                        {mode.id === selectedMode.id && <Tag color="purple" style={{ fontSize: 10 }}>激活中</Tag>}
                      </Space>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                        {mode.description}
                      </Text>
                    </div>
                  </Space>
                </div>
              ))}
            </Space>
          </Card>

          {/* 接入方式 */}
          <Card
            title={
              <Space>
                <CodeSandboxOutlined style={{ color: '#10b981' }} />
                <span>如何接入</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <List
              size="small"
              dataSource={[
                {
                  icon: <RobotOutlined />,
                  title: '人格系统',
                  desc: '调用 selectRobotMode() 根据用户状态选择人格模式',
                },
                {
                  icon: <MessageOutlined />,
                  title: '对话系统',
                  desc: '每次对话前调用 generateDialogueStrategy() 获取策略参数',
                },
                {
                  icon: <ClockCircleOutlined />,
                  title: '运动系统',
                  desc: '调用 generateBehaviorRhythm() 控制动作节奏',
                },
                {
                  icon: <HeartOutlined />,
                  title: '情绪感知',
                  desc: '实时传入用户情绪值，触发人格模式自动切换',
                },
              ]}
              renderItem={(item) => (
                <List.Item style={{ border: 'none', padding: '8px 0' }}>
                  <List.Item.Meta
                    avatar={<span style={{ fontSize: 22 }}>{item.icon}</span>}
                    title={<Text style={{ color: '#fff' }}>{item.title}</Text>}
                    description={<Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>

          {/* 核心洞见 */}
          <Card
            type="inner"
            style={{
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(236, 72, 153, 0.08))',
              border: '1px solid rgba(139, 92, 246, 0.3)',
            }}
          >
            <Space direction="vertical" size={8}>
              <Text strong style={{ color: '#a78bfa' }}>
                💡 核心洞见
              </Text>
              <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
                这不是"给机器人加个聊天功能"——这是机器人的人格可以根据用户的人格自动对齐。
                机器人不再是执行预设指令的工具，而是能感知用户状态、动态调整自己行为方式的"陪伴者"。
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// 小组件：提示框
const AlertBox = ({ title, description, type = 'info' }) => {
  const colors = {
    info: { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' },
    warning: { bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.3)', text: '#fbbf24' },
    success: { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
    processing: { bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.3)', text: '#a78bfa' },
  };
  const c = colors[type];
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <Text strong style={{ color: c.text, fontSize: 14 }}>
        {title}
      </Text>
      <div style={{ marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {description}
        </Text>
      </div>
    </div>
  );
};

// 小组件：节奏对比图
const RhythmComparisonChart = ({ currentRhythm }) => {
  const dimensions = [
    { key: 'movementSpeed', label: '移动速度', current: currentRhythm.movementSpeed, cigar: 0.7, firework: 1.3 },
    { key: 'movementSmoothness', label: '动作流畅度', current: currentRhythm.movementSmoothness, cigar: 0.92, firework: 0.55 },
    { key: 'gestureIntensity', label: '姿态强度', current: currentRhythm.gestureIntensity, cigar: 0.3, firework: 0.75 },
    { key: 'vocalVariation', label: '语音变化', current: currentRhythm.vocalVariation, cigar: 0.4, firework: 0.75 },
  ];

  const maxVal = 1.5;

  return (
    <div>
      {dimensions.map((dim, i) => (
        <div key={dim.key} style={{ marginBottom: i < dimensions.length - 1 ? 16 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dim.label}
            </Text>
            <Text style={{ color: '#a78bfa', fontSize: 12 }}>
              当前: {dim.current.toFixed(2)}
            </Text>
          </div>
          <div style={{ position: 'relative', height: 24 }}>
            {/* 雪茄范围 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 6,
                width: `${(dim.cigar / maxVal) * 100}%`,
                height: 12,
                background: 'rgba(212, 165, 116, 0.3)',
                borderRadius: 6,
              }}
            />
            {/* 烟火范围 */}
            <div
              style={{
                position: 'absolute',
                left: `${(dim.cigar / maxVal) * 100}%`,
                top: 6,
                width: `${((dim.firework - dim.cigar) / maxVal) * 100}%`,
                height: 12,
                background: 'rgba(244, 114, 182, 0.3)',
                borderRadius: 6,
              }}
            />
            {/* 当前值指示器 */}
            <div
              style={{
                position: 'absolute',
                left: `calc(${(dim.current / maxVal) * 100}% - 8px)`,
                top: 2,
                width: 16,
                height: 20,
                background: '#a78bfa',
                borderRadius: 4,
                boxShadow: '0 0 12px rgba(139, 92, 246, 0.6)',
              }}
            />
            {/* 标签 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <Text style={{ color: '#d4a574', fontSize: 10 }}>雪茄</Text>
              <Text style={{ color: '#f472b6', fontSize: 10 }}>烟火</Text>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RobotPage;
