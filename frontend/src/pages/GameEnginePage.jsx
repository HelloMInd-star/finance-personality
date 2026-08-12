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
  Select,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  HomeOutlined,
  UserOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  LineChartOutlined,
  SoundOutlined,
  CodeSandboxOutlined,
  ExperimentOutlined,
  SafetyCertificateOutlined,
  PicRightOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import {
  gameEngineLayer,
  extractPlayerProfile,
  generateNPCDialogue,
  calculateAdaptiveDifficulty,
  selectStoryBranch,
  generateDecisionKLine,
  generateMockDecisions,
  NPC_PERSONALITIES,
} from '../utils/gameEngineLayer';
import { musicEngine } from '../utils/musicEngine';
import { logger } from '../utils/logger';

const { Title, Text, Paragraph } = Typography;

const GameEnginePage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // overview | npc | difficulty | story | kline
  const [selectedNPC, setSelectedNPC] = useState('mentor');
  const [dialogueContext, setDialogueContext] = useState('greeting');
  const [baseDifficulty, setBaseDifficulty] = useState(1);

  // 玩家画像
  const playerProfile = useMemo(() => extractPlayerProfile(), []);

  // NPC 对话
  const npcDialogue = useMemo(
    () => generateNPCDialogue(selectedNPC, playerProfile, dialogueContext),
    [selectedNPC, playerProfile, dialogueContext]
  );

  // 自适应难度
  const adaptiveDifficulty = useMemo(
    () => calculateAdaptiveDifficulty(playerProfile, baseDifficulty),
    [playerProfile, baseDifficulty]
  );

  // 剧情分支
  const storyBranch = useMemo(() => selectStoryBranch(playerProfile), [playerProfile]);

  // 决策 K 线
  const [decisions] = useState(() => generateMockDecisions(playerProfile));
  const decisionKLine = useMemo(() => generateDecisionKLine(decisions, playerProfile), [decisions, playerProfile]);

  // 音乐播放
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const toggleMusic = () => {
    if (isMusicPlaying) {
      musicEngine.stop();
      setIsMusicPlaying(false);
    } else {
      const config = musicEngine.inferConfigFromData({
        volatility: playerProfile.riskTolerance / 100,
        trend: playerProfile.kellyDeviation,
        avgPrice: 50 + playerProfile.emotion * 0.3,
        volume: playerProfile.executionDiscipline,
      });
      musicEngine.play(config);
      setIsMusicPlaying(true);
    }
    logger.session('游戏引擎音乐切换', { 播放: !isMusicPlaying });
  };

  const contextOptions = [
    { value: 'greeting', label: '👋 问候' },
    { value: 'advice', label: '💡 建议' },
    { value: 'caution', label: '⚠️ 警告' },
    { value: 'praise', label: '👏 赞美' },
  ];

  const comparisonData = [
    {
      traditional: '渲染物理世界',
      yours: '渲染"玩家的决策世界"',
      icon: '🌍',
    },
    {
      traditional: '处理碰撞、光影、物理',
      yours: '处理风险偏好、路径推演、执行纪律',
      icon: '⚙️',
    },
    {
      traditional: '输出画面和音效',
      yours: '输出 K线、音乐、配方、画像',
      icon: '🎨',
    },
    {
      traditional: '玩家在"玩"',
      yours: '玩家在"暴露行为数据"',
      icon: '🎯',
    },
  ];

  return (
    <div className="game-engine-page fade-in" style={{ padding: 16 }}>
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
              🎮 游戏引擎 · 行为层
            </Title>
          </Space>
          <Space>
            <Tag color="purple">Y.Mine 总控台 › 游戏引擎层</Tag>
            <Badge status="processing" text="行为采集实时运行" />
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
                <span>核心理念：你的系统 = 游戏引擎的"行为层"</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[12, 12]}>
              {comparisonData.map((item, i) => (
                <Col xs={24} md={12} key={i}>
                  <Card
                    size="small"
                    style={{
                      background: 'rgba(139, 92, 246, 0.06)',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                    }}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <span style={{ fontSize: 24 }}>{item.icon}</span>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>传统游戏引擎</Text>
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

          {/* 接入能力展示 - 选项卡 */}
          <Card
            tabList={[
              { key: 'npc', tab: '🤖 NPC 自适应对话' },
              { key: 'difficulty', tab: '⚡ 自适应难度' },
              { key: 'story', tab: '📖 剧情分叉' },
              { key: 'kline', tab: '📈 决策K线' },
            ]}
            activeTabKey={activeTab}
            onTabChange={setActiveTab}
            style={{ marginBottom: 16 }}
          >
            {/* NPC 对话 */}
            {activeTab === 'npc' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <AlertBox
                  title="NPC 根据玩家人格画像动态调整对话和行为"
                  description="这不是写死的台词——每个 NPC 都会根据你的 MBTI、风险偏好、情绪值实时调整说话方式和内容。"
                  type="info"
                />

                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={8}>
                    <Text strong>选择 NPC：</Text>
                    <Select
                      value={selectedNPC}
                      onChange={setSelectedNPC}
                      style={{ width: '100%', marginTop: 8 }}
                    >
                      {NPC_PERSONALITIES.map((npc) => (
                        <Select.Option key={npc.id} value={npc.id}>
                          {npc.emoji} {npc.name}
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Text strong>对话场景：</Text>
                    <Select
                      value={dialogueContext}
                      onChange={setDialogueContext}
                      style={{ width: '100%', marginTop: 8 }}
                    >
                      {contextOptions.map((opt) => (
                        <Select.Option key={opt.value} value={opt.value}>
                          {opt.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Text strong>适配信号：</Text>
                    <div style={{ marginTop: 8 }}>
                      <Tag color="purple">MBTI: {npcDialogue.adaptationSignals.mbti}</Tag>
                      <Tag color="blue">情绪: {npcDialogue.adaptationSignals.emotion}</Tag>
                    </div>
                  </Col>
                </Row>

                <Card
                  style={{
                    background: 'rgba(30, 19, 64, 0.8)',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                  }}
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <Avatar
                          size={48}
                          style={{
                            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                            fontSize: 24,
                          }}
                        >
                          {npcDialogue.npc.emoji}
                        </Avatar>
                        <div>
                          <Text strong style={{ color: '#fff', fontSize: 16 }}>
                            {npcDialogue.npc.name}
                          </Text>
                          <div>
                            <Tag color="default" style={{ fontSize: 11 }}>
                              {npcDialogue.npc.baseMbti}
                            </Tag>
                            <Tag color="purple" style={{ fontSize: 11 }}>
                              基础风格: {npcDialogue.npc.dialogueStyle}
                            </Tag>
                          </div>
                        </div>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                        原始台词（无自适应）
                      </Text>
                      <Card
                        size="small"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px dashed rgba(255,255,255,0.1)',
                          marginBottom: 12,
                        }}
                      >
                        <Text style={{ color: 'rgba(255,255,255,0.5)' }}>
                          "{npcDialogue.originalLine}"
                        </Text>
                      </Card>
                    </Col>
                    <Col xs={24} md={12}>
                      <Badge.Ribbon text="自适应后" color="purple">
                        <Card
                          size="small"
                          style={{
                            background: 'rgba(139, 92, 246, 0.1)',
                            border: '1px solid rgba(139, 92, 246, 0.4)',
                            minHeight: 140,
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 15, lineHeight: 1.6 }}>
                            "{npcDialogue.adaptedLine}"
                          </Text>
                        </Card>
                      </Badge.Ribbon>
                      <div style={{ marginTop: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>触发的适配标签：</Text>
                        <div style={{ marginTop: 4 }}>
                          {npcDialogue.tags.length === 0 ? (
                            <Tag color="default">标准模式</Tag>
                          ) : (
                            npcDialogue.tags.map((tag, i) => (
                              <Tag key={i} color="purple">
                                {tag}
                              </Tag>
                            ))
                          )}
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Card>
              </Space>
            )}

            {/* 自适应难度 */}
            {activeTab === 'difficulty' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <AlertBox
                  title="游戏难度根据玩家凯利偏差实时自适应"
                  description="不是固定的简单/困难——难度会根据你的风险偏好、凯利偏差、情绪值动态计算。"
                  type="warning"
                />

                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: 'rgba(139, 92, 246, 0.08)' }}>
                      <Statistic
                        title="凯利偏差"
                        value={playerProfile.kellyDeviation.toFixed(2)}
                        valueStyle={{ color: playerProfile.kellyDeviation > 0 ? '#ef4444' : '#10b981' }}
                        prefix={playerProfile.kellyDeviation > 0 ? '+' : ''}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {playerProfile.kellyDeviation > 0.3
                          ? '激进型 · 倾向于下注更多'
                          : playerProfile.kellyDeviation < -0.3
                          ? '保守型 · 倾向于控制风险'
                          : '均衡型 · 风险与收益兼顾'}
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: 'rgba(236, 72, 153, 0.08)' }}>
                      <Statistic
                        title="风险容忍度"
                        value={playerProfile.riskTolerance}
                        valueStyle={{ color: '#ec4899' }}
                        suffix="%"
                      />
                      <Progress
                        percent={playerProfile.riskTolerance}
                        showInfo={false}
                        strokeColor="#ec4899"
                        style={{ marginTop: 4 }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: 'rgba(251, 191, 36, 0.08)' }}>
                      <Statistic
                        title="情绪值"
                        value={playerProfile.emotion}
                        valueStyle={{ color: '#fbbf24' }}
                      />
                      <Progress
                        percent={playerProfile.emotion}
                        showInfo={false}
                        strokeColor="#fbbf24"
                        style={{ marginTop: 4 }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card
                  title={
                    <Space>
                      <ThunderboltOutlined style={{ color: '#fbbf24' }} />
                      <span>难度计算结果</span>
                      <Tag color="gold" style={{ fontSize: 14, padding: '4px 12px' }}>
                        {adaptiveDifficulty.level}
                      </Tag>
                    </Space>
                  }
                  style={{ background: 'rgba(251, 191, 36, 0.05)' }}
                >
                  <Row gutter={[12, 12]}>
                    <Col xs={24} sm={12}>
                      <Space direction="vertical" size={8}>
                        <Statistic
                          title="最终倍率"
                          value={adaptiveDifficulty.finalMultiplier}
                          valueStyle={{ color: '#fbbf24', fontSize: 32 }}
                          suffix="x"
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {adaptiveDifficulty.description}
                        </Text>
                      </Space>
                    </Col>
                    <Col xs={24} sm={12}>
                      <List
                        size="small"
                        dataSource={[
                          { label: '凯利因子', value: `${adaptiveDifficulty.kellyMultiplier}x` },
                          { label: '风险因子', value: `${adaptiveDifficulty.riskMultiplier}x` },
                          { label: '情绪因子', value: `${adaptiveDifficulty.emotionMultiplier}x` },
                        ]}
                        renderItem={(item) => (
                          <List.Item style={{ border: 'none', padding: '4px 0' }}>
                            <Text type="secondary">{item.label}</Text>
                            <Tag color="purple">{item.value}</Tag>
                          </List.Item>
                        )}
                      />
                    </Col>
                  </Row>
                </Card>
              </Space>
            )}

            {/* 剧情分叉 */}
            {activeTab === 'story' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <AlertBox
                  title="游戏剧情走向根据玩家的决策模式分叉"
                  description="不是线性叙事——你的风险偏好和决策风格会影响剧情走向，让每一次游戏体验都是独特的。"
                  type="success"
                />

                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
                      <Statistic
                        title="决策风格"
                        value={
                          playerProfile.decisionStyle === 'deep_thinker'
                            ? '深度思考'
                            : playerProfile.decisionStyle === 'quick_actor'
                            ? '快速行动'
                            : '均衡决策'
                        }
                        valueStyle={{ color: '#10b981' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: 'rgba(59, 130, 246, 0.08)' }}>
                      <Statistic
                        title="风险画像"
                        value={
                          playerProfile.riskProfile === 'conservative'
                            ? '保守型'
                            : playerProfile.riskProfile === 'aggressive'
                            ? '激进型'
                            : '均衡型'
                        }
                        valueStyle={{ color: '#3b82f6' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: 'rgba(139, 92, 246, 0.08)' }}>
                      <Statistic
                        title="时间偏好"
                        value={playerProfile.timePreference}
                        valueStyle={{ color: '#a78bfa' }}
                        suffix="分"
                      />
                    </Card>
                  </Col>
                </Row>

                <Card
                  title={
                    <Space>
                      <PicRightOutlined style={{ color: '#10b981' }} />
                      <span>剧情分支推荐</span>
                    </Space>
                  }
                >
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Card
                      size="small"
                      style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                      }}
                    >
                      <Space>
                        <TrophyOutlined style={{ fontSize: 28, color: '#10b981' }} />
                        <div>
                          <Text strong style={{ color: '#10b981', fontSize: 16 }}>
                            推荐分支：{storyBranch.selectedBranch}
                          </Text>
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary">{storyBranch.reasoning}</Text>
                          </div>
                        </div>
                      </Space>
                    </Card>

                    <div>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                        各分支概率分布：
                      </Text>
                      <Row gutter={[8, 8]}>
                        {storyBranch.weightedBranches.map((wb, i) => (
                          <Col xs={12} sm={8} key={i}>
                            <Card
                              size="small"
                              style={{
                                background:
                                  wb.branch === storyBranch.selectedBranch
                                    ? 'rgba(139, 92, 246, 0.15)'
                                    : 'rgba(255,255,255,0.03)',
                                border:
                                  wb.branch === storyBranch.selectedBranch
                                    ? '1px solid rgba(139, 92, 246, 0.5)'
                                    : '1px solid rgba(255,255,255,0.1)',
                              }}
                            >
                              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#fff' }}>{wb.branch}</Text>
                                <Tag color="purple">{wb.probability}%</Tag>
                              </Space>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </div>
                  </Space>
                </Card>
              </Space>
            )}

            {/* 决策 K 线 */}
            {activeTab === 'kline' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <AlertBox
                  title="玩家的决策行为生成可视化的 K线/音乐反馈"
                  description="每一次决策都会被转化为一根 K 线，让玩家看到自己的行为模式如何在数据上呈现。"
                  type="processing"
                  action={
                    <Button icon={<SoundOutlined />} onClick={toggleMusic} type={isMusicPlaying ? 'primary' : 'default'}>
                      {isMusicPlaying ? '停止音乐' : '播放决策音乐'}
                    </Button>
                  }
                />

                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={6}>
                    <Card size="small" style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
                      <Statistic
                        title="总决策数"
                        value={decisionKLine.stats.totalDecisions}
                        valueStyle={{ color: '#10b981' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={6}>
                    <Card size="small" style={{ background: 'rgba(251, 191, 36, 0.08)' }}>
                      <Statistic
                        title="胜率"
                        value={decisionKLine.stats.winRate.toFixed(1)}
                        valueStyle={{ color: '#fbbf24' }}
                        suffix="%"
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={6}>
                    <Card size="small" style={{ background: 'rgba(236, 72, 153, 0.08)' }}>
                      <Statistic
                        title="平均风险"
                        value={(decisionKLine.stats.avgRisk * 100).toFixed(0)}
                        valueStyle={{ color: '#ec4899' }}
                        suffix="%"
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={6}>
                    <Card size="small" style={{ background: 'rgba(59, 130, 246, 0.08)' }}>
                      <Statistic
                        title="决策收益"
                        value={decisionKLine.stats.profit.toFixed(2)}
                        valueStyle={{ color: decisionKLine.stats.profit >= 0 ? '#10b981' : '#ef4444' }}
                        prefix={decisionKLine.stats.profit >= 0 ? '+' : ''}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card
                  title={
                    <Space>
                      <LineChartOutlined style={{ color: '#a78bfa' }} />
                      <span>决策 K 线图（20次决策模拟）</span>
                    </Space>
                  }
                >
                  <MiniKLineChart data={decisionKLine.klineData} />
                </Card>
              </Space>
            )}
          </Card>
        </Col>

        {/* 右侧状态面板 */}
        <Col xs={24} lg={8}>
          {/* 玩家画像 */}
          <Card
            title={
              <Space>
                <UserOutlined style={{ color: '#a78bfa' }} />
                <span>当前玩家画像</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>MBTI</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color="purple" style={{ fontSize: 14, padding: '4px 12px' }}>
                    {playerProfile.currentMbti}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    置信度 {playerProfile.mbtiConfidence}%
                  </Text>
                </div>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>风险画像</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag
                    color={
                      playerProfile.riskProfile === 'conservative'
                        ? 'blue'
                        : playerProfile.riskProfile === 'aggressive'
                        ? 'red'
                        : 'gold'
                    }
                    style={{ fontSize: 13 }}
                  >
                    {playerProfile.riskProfile === 'conservative'
                      ? '🛡️ 保守型'
                      : playerProfile.riskProfile === 'aggressive'
                      ? '⚔️ 激进型'
                      : '⚖️ 均衡型'}
                  </Tag>
                </div>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>决策风格</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color="purple" style={{ fontSize: 13 }}>
                    {playerProfile.decisionStyle === 'deep_thinker'
                      ? '🧠 深度思考者'
                      : playerProfile.decisionStyle === 'quick_actor'
                      ? '⚡ 快速行动派'
                      : '🎯 均衡决策者'}
                  </Tag>
                </div>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>故事偏好</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color="orange" style={{ fontSize: 13 }}>
                    {playerProfile.storyPreference === 'cigar'
                      ? '🥃 雪茄（慢）'
                      : playerProfile.storyPreference === 'firework'
                      ? '🎆 烟火（快）'
                      : '✨ 二者皆可'}
                  </Tag>
                </div>
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <List
                size="small"
                dataSource={[
                  { label: '执行纪律', value: playerProfile.executionDiscipline, color: '#10b981' },
                  { label: '路径预判', value: playerProfile.reflectionDeviation, color: '#3b82f6' },
                  { label: '决策观察', value: playerProfile.aimPrecision, color: '#fbbf24' },
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
                  title: 'NPC 系统',
                  desc: '对接 NPC 行为树，调用 generateNPCDialogue() 获取动态台词',
                },
                {
                  icon: <ExperimentOutlined />,
                  title: '难度系统',
                  desc: '在游戏循环中调用 calculateAdaptiveDifficulty() 实时调整',
                },
                {
                  icon: <SafetyCertificateOutlined />,
                  title: '剧情系统',
                  desc: '在分支点调用 selectStoryBranch() 确定走向',
                },
                {
                  icon: <LineChartOutlined />,
                  title: '反馈系统',
                  desc: '收集玩家决策，调用 generateDecisionKLine() 可视化',
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
                这不是"在游戏里加一个心理测试"——这是游戏本身变成了一个人格采集器。
                玩家的每一个选择、每一次犹豫、每一个风险偏好，都是在为自己的行为画像添砖加瓦。
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// 小组件：提示框
const AlertBox = ({ title, description, type = 'info', action }) => {
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div>
        <Text strong style={{ color: c.text, fontSize: 14 }}>
          {title}
        </Text>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {description}
          </Text>
        </div>
      </div>
      {action}
    </div>
  );
};

// 小组件：迷你 K 线图
const MiniKLineChart = ({ data }) => {
  if (!data || data.length === 0) return null;

  const maxPrice = Math.max(...data.map((d) => d.high));
  const minPrice = Math.min(...data.map((d) => d.low));
  const range = maxPrice - minPrice || 1;

  const width = 600;
  const height = 180;
  const candleWidth = (width / data.length) * 0.7;
  const gap = (width / data.length) * 0.3;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} style={{ minWidth: width }}>
        {/* 背景网格 */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <line
            key={i}
            x1={0}
            y1={height * ratio}
            x2={width}
            y2={height * ratio}
            stroke="rgba(139, 92, 246, 0.1)"
            strokeDasharray="2,4"
          />
        ))}

        {/* K 线 */}
        {data.map((d, i) => {
          const x = i * (candleWidth + gap) + gap / 2;
          const yHigh = height - ((d.high - minPrice) / range) * (height - 20) - 10;
          const yLow = height - ((d.low - minPrice) / range) * (height - 20) - 10;
          const yOpen = height - ((d.open - minPrice) / range) * (height - 20) - 10;
          const yClose = height - ((d.close - minPrice) / range) * (height - 20) - 10;
          const isUp = d.close >= d.open;
          const color = isUp ? '#10b981' : '#ef4444';
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));

          return (
            <g key={i}>
              {/* 影线 */}
              <line x1={x + candleWidth / 2} y1={yHigh} x2={x + candleWidth / 2} y2={yLow} stroke={color} strokeWidth={1} />
              {/* 实体 */}
              <rect
                x={x}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={color}
                opacity={0.8}
                rx={1}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default GameEnginePage;
