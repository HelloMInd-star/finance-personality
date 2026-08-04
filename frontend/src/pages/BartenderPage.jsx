import React, { useState, useMemo } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Radio,
  Input,
  Steps,
  Tag,
  Row,
  Col,
  Avatar,
  Tooltip,
  Divider,
  Select
} from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  UserOutlined,
  BulbOutlined,
  HomeOutlined,
  ExperimentOutlined,
  SaveOutlined,
  CheckOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SoundOutlined
} from '@ant-design/icons';
import CocktailCard from '../components/CocktailCard/CocktailCard';
import {
  molecularEngine,
  generateCocktailKLine,
  BARTENDERS,
  EMOTION_OPTIONS,
  BASE_SPIRITS,
  QUESTIONS,
  STORY_SEEDS,
  ZODIAC_SIGNS
} from '../utils/molecularEngine';
import { musicEngine } from '../utils/musicEngine';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';
import {
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Option } = Select;

// 6步流程定义
const STEPS = [
  { title: '情绪底色', icon: '🎭' },
  { title: '选择基酒', icon: '🥃' },
  { title: '关键提问', icon: '❓' },
  { title: '过渡手记', icon: '📝' },
  { title: '猜星座', icon: '✨' },
  { title: '特调笔记', icon: '🧪' }
];

const BartenderPage = () => {
  // 阶段：select-bartender / flow / result
  const [stage, setStage] = useState('select-bartender');
  const [currentStep, setCurrentStep] = useState(0);
  const [bartender, setBartender] = useState(null);

  // 流程数据
  const [emotion, setEmotion] = useState(null);
  const [baseSpirit, setBaseSpirit] = useState(null);
  const [questionAnswer, setQuestionAnswer] = useState(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [zodiacGuess, setZodiacGuess] = useState(null);
  const [userZodiac, setUserZodiac] = useState(null);
  const [specialNote, setSpecialNote] = useState('');
  const [storySeed, setStorySeed] = useState(null);

  // 最终配方
  const [cocktail, setCocktail] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  // 音乐播放状态
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [musicProgress, setMusicProgress] = useState(0);

  // 配方转风味 K 线
  const cocktailKLine = useMemo(() => {
    if (!cocktail) return { data: [], source: '' };
    return generateCocktailKLine(cocktail);
  }, [cocktail]);

  // 进入调酒师选择
  const handleSelectBartender = (key) => {
    const b = BARTENDERS[key];
    logger.session('选择调酒师', b.name);
    setBartender(b);
    setStage('flow');
    setCurrentStep(0);
  };

  // 下一步
  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      logger.session(`调酒流程 - 进入第${currentStep + 2}步`, STEPS[currentStep + 1].title);
      setCurrentStep(currentStep + 1);
    } else {
      // 完成流程，生成配方
      handleGenerateCocktail();
    }
  };

  // 上一步
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      // 返回调酒师选择
      setStage('select-bartender');
      setBartender(null);
    }
  };

  // 生成配方
  const handleGenerateCocktail = () => {
    logger.flow('生成调酒配方', '开始', { 调酒师: bartender?.name });

    const zodiacCorrect = zodiacGuess === userZodiac;

    const input = {
      emotion: EMOTION_OPTIONS.find(e => e.key === emotion)?.label,
      baseSpirit: BASE_SPIRITS.find(b => b.key === baseSpirit)?.label,
      questionAnswer,
      transitionNote,
      zodiacGuess,
      zodiacCorrect,
      bartenderStyle: bartender?.key,
      storySeed: STORY_SEEDS.find(s => s.key === storySeed)?.label,
      storyText: specialNote,
      personality: bartender?.personality,
      industry: '科技'
    };

    const result = molecularEngine.generate(input);
    setCocktail(result);
    setStage('result');
    setIsSaved(false);
    logger.session('配方生成完成', result.name);
  };

  // 存档到故事集
  const handleSaveToStories = () => {
    if (!cocktail || isSaved) return;

    const session = {
      bartender: bartender?.key,
      bartenderName: bartender?.name,
      emotion: EMOTION_OPTIONS.find(e => e.key === emotion)?.label,
      baseSpirit: BASE_SPIRITS.find(b => b.key === baseSpirit)?.label,
      storySeed: STORY_SEEDS.find(s => s.key === storySeed)?.label,
      specialNote,
      zodiacCorrect: zodiacGuess === userZodiac,
      cocktail,
      createdAt: Date.now()
    };

    storage.addBartenderSession(session);
    setIsSaved(true);
    logger.session('配方已存档到故事集', cocktail.name);
  };

  // 播放配方音乐
  const handlePlayMusic = () => {
    if (isMusicPlaying) {
      musicEngine.stop();
      setIsMusicPlaying(false);
      return;
    }

    if (!cocktailKLine.data || cocktailKLine.data.length === 0) return;

    musicEngine.onProgress = (current) => {
      setMusicProgress(current);
    };
    musicEngine.onComplete = () => {
      setIsMusicPlaying(false);
      setMusicProgress(0);
    };

    musicEngine.play(cocktailKLine.data, {
      mood: cocktailKLine.moodHint || 0.5,
      industry: cocktailKLine.industryHint || '科技'
    });

    setIsMusicPlaying(true);
    setMusicProgress(0);
    logger.session('播放配方音乐', cocktail.name);
  };

  // 重新开始
  const handleRestart = () => {
    musicEngine.stop();
    setIsMusicPlaying(false);
    setMusicProgress(0);
    setStage('select-bartender');
    setBartender(null);
    setCurrentStep(0);
    setEmotion(null);
    setBaseSpirit(null);
    setQuestionAnswer(null);
    setTransitionNote('');
    setZodiacGuess(null);
    setUserZodiac(null);
    setSpecialNote('');
    setStorySeed(null);
    setCocktail(null);
  };

  // 是否可以进入下一步
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: return !!emotion;
      case 1: return !!baseSpirit;
      case 2: return !!questionAnswer;
      case 3: return transitionNote.length >= 5;
      case 4: return !!zodiacGuess && !!userZodiac;
      case 5: return true;
      default: return false;
    }
  }, [currentStep, emotion, baseSpirit, questionAnswer, transitionNote, zodiacGuess, userZodiac]);

  // ========== 渲染阶段 ==========

  // 阶段1：选择调酒师
  if (stage === 'select-bartender') {
    return (
      <div style={{
        background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 50%, #0a0a12 100%)',
        minHeight: '100vh',
        padding: '48px 24px',
        margin: -24
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Hero 标题区 */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{
                fontSize: 56,
                marginBottom: 16,
                filter: 'drop-shadow(0 4px 20px rgba(212, 175, 55, 0.3))'
              }}>
                🍸
              </div>
              <Title
                level={2}
                style={{
                  color: '#fff',
                  margin: 0,
                  fontWeight: 300,
                  letterSpacing: 2
                }}
              >
                分子调酒实验室
              </Title>
              <div style={{
                width: 60,
                height: 2,
                background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
                margin: '16px auto'
              }} />
              <p style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 15,
                maxWidth: 520,
                margin: '0 auto',
                lineHeight: 1.8
              }}>
                选择一位调酒师，开始你的分子调酒体验。
                <br />
                六步流程，采集情绪、故事与人格，生成专属于你的那一杯。
              </p>
            </div>

            {/* 调酒师卡片 */}
            <Row gutter={[24, 24]} style={{ marginTop: 16 }}>
              {Object.values(BARTENDERS).map((b, index) => (
                <Col xs={24} md={8} key={b.key}>
                  <div
                    onClick={() => handleSelectBartender(b.key)}
                    style={{
                      position: 'relative',
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${b.color}33`,
                      borderRadius: 16,
                      padding: '32px 24px 24px',
                      height: '100%',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.borderColor = b.color;
                      e.currentTarget.style.background = `rgba(255,255,255,0.06)`;
                      e.currentTarget.style.boxShadow = `0 12px 40px ${b.color}22`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = `${b.color}33`;
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* 编号 */}
                    <div style={{
                      position: 'absolute',
                      top: 16,
                      right: 20,
                      fontSize: 48,
                      fontWeight: 700,
                      color: b.color,
                      opacity: 0.15,
                      lineHeight: 1,
                      fontFamily: 'Georgia, serif'
                    }}>
                      0{index + 1}
                    </div>

                    {/* 头像 */}
                    <div style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${b.color}33, ${b.color}11)`,
                      border: `2px solid ${b.color}66`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 32,
                      marginBottom: 16
                    }}>
                      {b.icon}
                    </div>

                    {/* 名字 + 头衔 */}
                    <Title level={4} style={{ color: '#fff', margin: '0 0 4px', fontWeight: 500 }}>
                      {b.name}
                    </Title>
                    <div style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 10,
                      background: `${b.color}22`,
                      color: b.color,
                      fontSize: 12,
                      marginBottom: 12
                    }}>
                      {b.title}
                    </div>

                    {/* MBTI */}
                    <div style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: 12,
                      letterSpacing: 1
                    }}>
                      MBTI · {b.mbti}
                    </div>

                    {/* 风格描述 */}
                    <p style={{
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: 13,
                      lineHeight: 1.7,
                      margin: '0 0 16px',
                      minHeight: 44
                    }}>
                      {b.style}
                    </p>

                    {/* 擅长标签 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                      {b.specialty.split('、').map((tag, i) => (
                        <span key={i} style={{
                          padding: '3px 10px',
                          borderRadius: 6,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.5)'
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* CTA 按钮 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 16,
                      borderTop: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <span style={{
                        fontSize: 12,
                        color: b.color
                      }}>
                        6 步流程 · 约 3 分钟
                      </span>
                      <span style={{
                        color: b.color,
                        fontSize: 14,
                        fontWeight: 500
                      }}>
                        开始 →
                      </span>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>

            {/* 底部提示 */}
            <div style={{
              textAlign: 'center',
              marginTop: 40,
              padding: '20px',
              background: 'rgba(212, 175, 55, 0.05)',
              border: '1px solid rgba(212, 175, 55, 0.15)',
              borderRadius: 12,
              maxWidth: 600,
              margin: '40px auto 0'
            }}>
              <div style={{ color: '#D4AF37', fontSize: 13, marginBottom: 6 }}>
                💡 小提示
              </div>
              <p style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 12,
                margin: 0,
                lineHeight: 1.8
              }}>
                调酒师的风格会影响酒名生成、质地判断和呈现方式。
                <br />
                你可以多次体验，感受不同调酒师带来的差异。
              </p>
            </div>
          </Space>
        </div>
      </div>
    );
  }

  // 阶段3：展示配方
  if (stage === 'result' && cocktail) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card>
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={handleRestart}>
                  再来一杯
                </Button>
              </Space>
              <Space>
                <Text type="secondary">调酒师：</Text>
                <Tag color={bartender?.color}>{bartender?.icon} {bartender?.name}</Tag>
              </Space>
            </Space>
          </Card>

          <CocktailCard data={cocktail} bartender={bartender} />

          {/* 存档按钮 */}
          <div style={{ textAlign: 'center' }}>
            <Button
              type={isSaved ? 'default' : 'primary'}
              icon={isSaved ? <CheckOutlined /> : <SaveOutlined />}
              onClick={handleSaveToStories}
              disabled={isSaved}
              size="large"
            >
              {isSaved ? '已存档到故事集' : '存档到故事集'}
            </Button>
          </div>

          {/* 音乐播放区域 */}
          <Card
            size="small"
            title={
              <Space>
                <SoundOutlined style={{ color: '#D4AF37' }} />
                <span>听觉叙事</span>
                {isMusicPlaying && (
                  <Tag color="#1890ff">播放中 {musicProgress}/{cocktailKLine.data.length}</Tag>
                )}
              </Space>
            }
            extra={
              <Tooltip title={isMusicPlaying ? '停止' : '播放这杯酒的声音'}>
                <Button
                  type="primary"
                  shape="circle"
                  icon={isMusicPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                  onClick={handlePlayMusic}
                  size="large"
                />
              </Tooltip>
            }
          >
            <div style={{ height: 80 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cocktailKLine.data.slice(0, 30)}>
                  <defs>
                    <linearGradient id="cocktailColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke="#D4AF37"
                    strokeWidth={2}
                    fill="url(#cocktailColor)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <Row gutter={8} style={{ marginTop: 4 }}>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>数据源</Text>
                <div style={{ fontSize: 12 }}>{cocktailKLine.source}</div>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>情绪倾向</Text>
                <div style={{ fontSize: 12, color: (cocktailKLine.moodHint || 0.5) >= 0.5 ? '#52c41a' : '#eb2f96' }}>
                  {(cocktailKLine.moodHint || 0.5) >= 0.5 ? '大调（上行）' : '小调（下行）'}
                </div>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>音色映射</Text>
                <div style={{ fontSize: 12 }}>{cocktailKLine.industryHint || '科技'}</div>
              </Col>
            </Row>
          </Card>

          {/* 采集的数据回顾 */}
          <Card size="small" title="本次采集的数据">
            <Row gutter={[16, 8]}>
              <Col span={12}>
                <Text type="secondary">情绪底色：</Text>
                <Text>{EMOTION_OPTIONS.find(e => e.key === emotion)?.label}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">基酒：</Text>
                <Text>{BASE_SPIRITS.find(b => b.key === baseSpirit)?.label}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">故事种子：</Text>
                <Text>{STORY_SEEDS.find(s => s.key === storySeed)?.label}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">星座猜测：</Text>
                <Text>
                  {zodiacGuess}
                  {zodiacGuess === userZodiac ? ' ✅ 猜中了' : ` (你是${userZodiac})`}
                </Text>
              </Col>
            </Row>
          </Card>
        </Space>
      </div>
    );
  }

  // 阶段2：6步流程
  const stepQuestions = QUESTIONS[baseSpirit] || [];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 顶部信息 */}
        <Card size="small">
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Avatar size={36} style={{ backgroundColor: bartender?.color }}>
                {bartender?.icon}
              </Avatar>
              <div>
                <div style={{ fontWeight: 600 }}>{bartender?.name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>{bartender?.title}</Text>
              </div>
            </Space>
            <Button size="small" icon={<HomeOutlined />} onClick={handleRestart}>
              重新选择
            </Button>
          </Space>
        </Card>

        {/* 步骤条 */}
        <Card size="small">
          <Steps current={currentStep} size="small">
            {STEPS.map(s => (
              <Step key={s.title} title={<span style={{ fontSize: 12 }}>{s.icon} {s.title}</span>} />
            ))}
          </Steps>
        </Card>

        {/* 当前步骤内容 */}
        <Card>
          {/* Step 0: 情绪底色 */}
          {currentStep === 0 && (
            <StepContent
              icon="🎭"
              title="此刻，你的情绪底色是？"
              desc="选择最贴近你现在状态的描述"
            >
              <Radio.Group
                value={emotion}
                onChange={e => setEmotion(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {EMOTION_OPTIONS.map(opt => (
                    <Radio.Button
                      key={opt.key}
                      value={opt.key}
                      style={{
                        width: '100%',
                        height: 'auto',
                        padding: '16px 20px',
                        textAlign: 'left',
                        lineHeight: 1.5,
                        borderRadius: 8,
                        marginBottom: 8,
                        borderColor: emotion === opt.key ? '#1890ff' : '#d9d9d9'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{opt.desc}</div>
                    </Radio.Button>
                  ))}
                </Space>
              </Radio.Group>
            </StepContent>
          )}

          {/* Step 1: 基酒 */}
          {currentStep === 1 && (
            <StepContent
              icon="🥃"
              title="选择今晚的基酒"
              desc="基酒会奠定整杯酒的风味基础"
            >
              <Row gutter={[12, 12]}>
                {BASE_SPIRITS.map(s => (
                  <Col xs={12} key={s.key}>
                    <Card
                      hoverable
                      onClick={() => setBaseSpirit(s.key)}
                      style={{
                        borderColor: baseSpirit === s.key ? '#1890ff' : '#d9d9d9',
                        borderWidth: baseSpirit === s.key ? 2 : 1,
                        cursor: 'pointer'
                      }}
                      bodyStyle={{ textAlign: 'center', padding: 20 }}
                    >
                      <div style={{ fontSize: 40, marginBottom: 8 }}>{s.icon}</div>
                      <div style={{ fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{s.flavor}</div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </StepContent>
          )}

          {/* Step 2: 关键提问 */}
          {currentStep === 2 && (
            <StepContent
              icon="❓"
              title={`${bartender?.name}问你...`}
              desc="关于这杯酒，你有什么偏好？"
            >
              <Radio.Group
                value={questionAnswer}
                onChange={e => setQuestionAnswer(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {stepQuestions.map(q => (
                    <Radio.Button
                      key={q.key}
                      value={q.label}
                      style={{
                        width: '100%',
                        height: 'auto',
                        padding: '16px 20px',
                        textAlign: 'left',
                        borderRadius: 8,
                        marginBottom: 8
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{q.label}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{q.desc}</div>
                    </Radio.Button>
                  ))}
                </Space>
              </Radio.Group>
            </StepContent>
          )}

          {/* Step 3: 过渡手记 */}
          {currentStep === 3 && (
            <StepContent
              icon="📝"
              title="写几句过渡手记"
              desc="关于此刻的心境，随便写点什么（5字以上）"
            >
              <Input.TextArea
                value={transitionNote}
                onChange={e => setTransitionNote(e.target.value)}
                placeholder="比如：今天加班到很晚，想放松一下..."
                rows={4}
                maxLength={200}
                showCount
              />
            </StepContent>
          )}

          {/* Step 4: 猜星座 */}
          {currentStep === 4 && (
            <StepContent
              icon="✨"
              title={`${bartender?.name}在猜你的星座`}
              desc="先告诉调酒师你的星座，再猜猜TA猜不猜得中"
            >
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 600 }}>你的真实星座是？</div>
                  <Select
                    value={userZodiac}
                    onChange={setUserZodiac}
                    style={{ width: '100%' }}
                    placeholder="选择你的星座"
                    size="large"
                  >
                    {ZODIAC_SIGNS.map(z => <Option key={z} value={z}>{z}</Option>)}
                  </Select>
                </div>
                <Divider style={{ margin: 0 }} />
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 600 }}>{bartender?.name}猜你是...</div>
                  <Select
                    value={zodiacGuess}
                    onChange={setZodiacGuess}
                    style={{ width: '100%' }}
                    placeholder="帮调酒师选一个猜测"
                    size="large"
                  >
                    {ZODIAC_SIGNS.map(z => <Option key={z} value={z}>{z}</Option>)}
                  </Select>
                </div>
              </Space>
            </StepContent>
          )}

          {/* Step 5: 特调笔记 + 故事种子 */}
          {currentStep === 5 && (
            <StepContent
              icon="🧪"
              title="最后，选一个故事种子"
              desc="这会影响酒的名字和呈现方式"
            >
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Radio.Group
                  value={storySeed}
                  onChange={e => setStorySeed(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Row gutter={[8, 8]}>
                    {STORY_SEEDS.map(s => (
                      <Col xs={24} sm={12} key={s.key}>
                        <Radio.Button
                          value={s.key}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: 8,
                            borderColor: storySeed === s.key ? '#D4AF37' : '#d9d9d9',
                            height: 'auto',
                            whiteSpace: 'normal',
                            lineHeight: 1.4,
                            textAlign: 'left'
                          }}
                        >
                          {s.label}
                        </Radio.Button>
                      </Col>
                    ))}
                  </Row>
                </Radio.Group>

                <div>
                  <div style={{ marginBottom: 8, fontWeight: 600 }}>
                    <BulbOutlined style={{ color: '#D4AF37' }} /> 特调笔记（选填）
                  </div>
                  <Input.TextArea
                    value={specialNote}
                    onChange={e => setSpecialNote(e.target.value)}
                    placeholder="有什么特别想说的？调酒师会把它融入配方..."
                    rows={3}
                    maxLength={100}
                    showCount
                  />
                </div>
              </Space>
            </StepContent>
          )}
        </Card>

        {/* 底部按钮 */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={handlePrev}>
            {currentStep === 0 ? '返回选择' : '上一步'}
          </Button>
          <Tooltip title={!canProceed ? '请完成当前步骤' : ''}>
            <Button
              type="primary"
              disabled={!canProceed}
              onClick={handleNext}
              icon={currentStep === STEPS.length - 1 ? <ExperimentOutlined /> : <ArrowRightOutlined />}
            >
              {currentStep === STEPS.length - 1 ? '生成特调配方' : '下一步'}
            </Button>
          </Tooltip>
        </Space>
      </Space>
    </div>
  );
};

// 步骤内容容器
const StepContent = ({ icon, title, desc, children }) => (
  <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>{icon}</div>
      <Title level={4} style={{ margin: 0 }}>{title}</Title>
      <Paragraph type="secondary" style={{ marginTop: 8 }}>{desc}</Paragraph>
    </div>
    {children}
  </Space>
);

export default BartenderPage;
