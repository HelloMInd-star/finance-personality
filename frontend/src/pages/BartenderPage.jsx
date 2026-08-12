import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Select,
  Progress,
  Badge,
  Empty,
  Alert,
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
  SoundOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  RocketOutlined,
  FireOutlined,
  StarOutlined,
  ReloadOutlined,
  CrownOutlined,
  RightCircleOutlined,
  CommentOutlined,
  TeamOutlined,
  HeartOutlined,
  ThunderboltOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import CocktailCard from '../components/CocktailCard/CocktailCard';
import FeedbackRating from '../components/FeedbackRating/FeedbackRating';
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
import { challengeEngine } from '../utils/challengeEngine';
import { sandboxEngine } from '../utils/sandboxEngine';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';
import {
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import './BartenderPage.css';

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

  // ========== 第二层：挑战赛状态 ==========
  const [challengeTheme, setChallengeTheme] = useState(null);
  const [challengeSubmission, setChallengeSubmission] = useState({
    flavors: [],
    base: null,
    mixers: [],
    garnish: null,
    storyTone: null,
    storyText: '',
  });
  const [challengeResult, setChallengeResult] = useState(null);
  const [challengeTimeLeft, setChallengeTimeLeft] = useState(180);
  const [challengeTimerActive, setChallengeTimerActive] = useState(false);
  const challengeTimerRef = useRef(null);

  // ========== 第三层：沙盘状态 ==========
  const [sandboxScenario, setSandboxScenario] = useState(null);
  const [sandboxCharacters, setSandboxCharacters] = useState([]);
  const [sandboxCurrentRound, setSandboxCurrentRound] = useState(1);
  const [sandboxChoices, setSandboxChoices] = useState([]);
  const [sandboxResult, setSandboxResult] = useState(null);

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
    if (challengeTimerRef.current) {
      clearInterval(challengeTimerRef.current);
    }
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
    // 重置挑战赛
    setChallengeTheme(null);
    setChallengeSubmission({ flavors: [], base: null, mixers: [], garnish: null, storyTone: null, storyText: '' });
    setChallengeResult(null);
    setChallengeTimeLeft(180);
    setChallengeTimerActive(false);
    // 重置沙盘
    setSandboxScenario(null);
    setSandboxCharacters([]);
    setSandboxCurrentRound(1);
    setSandboxChoices([]);
    setSandboxResult(null);
  };

  // ========== 第二层：挑战赛处理函数 ==========

  // 进入挑战赛
  const handleEnterChallenge = () => {
    logger.session('[调酒] 进入第二层：挑战赛');
    const theme = challengeEngine.getRandomTheme();
    setChallengeTheme(theme);
    setChallengeTimeLeft(theme.timeLimit || 180);
    setChallengeSubmission({ flavors: [], base: null, mixers: [], garnish: null, storyTone: null, storyText: '' });
    setChallengeResult(null);
    setStage('challenge');
    setChallengeTimerActive(true);
  };

  // 挑战赛定时器
  useEffect(() => {
    if (challengeTimerActive && challengeTimeLeft > 0) {
      challengeTimerRef.current = setInterval(() => {
        setChallengeTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(challengeTimerRef.current);
            setChallengeTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (challengeTimerRef.current) {
        clearInterval(challengeTimerRef.current);
      }
    };
  }, [challengeTimerActive]);

  // 切换风味选择
  const handleToggleFlavor = (flavorKey) => {
    setChallengeSubmission(prev => {
      const flavors = prev.flavors.includes(flavorKey)
        ? prev.flavors.filter(f => f !== flavorKey)
        : [...prev.flavors, flavorKey];
      return { ...prev, flavors };
    });
  };

  // 切换配料选择
  const handleToggleMixer = (mixerKey) => {
    setChallengeSubmission(prev => {
      const mixers = prev.mixers.includes(mixerKey)
        ? prev.mixers.filter(m => m !== mixerKey)
        : [...prev.mixers, mixerKey];
      return { ...prev, mixers };
    });
  };

  // 提交挑战赛
  const handleSubmitChallenge = () => {
    logger.session('[挑战赛] 提交配方', challengeSubmission);
    if (challengeTimerRef.current) {
      clearInterval(challengeTimerRef.current);
    }
    setChallengeTimerActive(false);

    const level1Data = { emotion, baseSpirit };
    const result = challengeEngine.judgeSubmission(challengeSubmission, challengeTheme, level1Data);
    setChallengeResult(result);
  };

  // ========== 第三层：沙盘处理函数 ==========

  // 进入沙盘
  const handleEnterSandbox = () => {
    logger.session('[调酒] 进入第三层：酒局沙盘');
    const scenario = sandboxEngine.getRandomScenario();
    const characters = sandboxEngine.getRandomCharacters(4);
    setSandboxScenario(scenario);
    setSandboxCharacters(characters);
    setSandboxCurrentRound(1);
    setSandboxChoices([]);
    setSandboxResult(null);
    setStage('sandbox');
  };

  // 沙盘选择
  const handleSandboxChoice = (optionKey) => {
    const choice = { round: sandboxCurrentRound, optionKey };
    const newChoices = [...sandboxChoices, choice];
    setSandboxChoices(newChoices);

    if (sandboxCurrentRound >= 5) {
      // 完成所有轮次，计算结果
      logger.session('[沙盘] 完成所有轮次，计算人格图谱');
      const level1Data = { emotion };
      const level2Data = challengeResult || {};
      const result = sandboxEngine.calculatePersonality(newChoices, level1Data, level2Data);
      setSandboxResult(result);
      setStage('sandbox-result');
    } else {
      setSandboxCurrentRound(sandboxCurrentRound + 1);
    }
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
      <div className="bartender-page">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Hero 标题区 */}
            <div className="bartender-select-hero">
              <div className="bartender-select-icon">🍸</div>
              <Title level={2} className="bartender-select-title">
                分子调酒实验室
              </Title>
              <div className="bartender-select-divider" />
              <p className="bartender-select-desc">
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
                    className="bartender-card"
                    onClick={() => handleSelectBartender(b.key)}
                    style={{ borderColor: `${b.color}33` }}
                  >
                    <div className="bartender-card-number" style={{ color: b.color }}>
                      0{index + 1}
                    </div>
                    <div
                      className="bartender-card-avatar"
                      style={{
                        background: `linear-gradient(135deg, ${b.color}33, ${b.color}11)`,
                        borderColor: `${b.color}66`,
                      }}
                    >
                      {b.icon}
                    </div>
                    <Title level={4} className="bartender-card-name">
                      {b.name}
                    </Title>
                    <div
                      className="bartender-card-title-tag"
                      style={{ background: `${b.color}22`, color: b.color }}
                    >
                      {b.title}
                    </div>
                    <div className="bartender-card-mbti">
                      MBTI · {b.mbti}
                    </div>
                    <p className="bartender-card-style">
                      {b.style}
                    </p>
                    <div className="bartender-card-tags">
                      {b.specialty.split('、').map((tag, i) => (
                        <span key={i} className="bartender-card-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="bartender-card-footer">
                      <span className="bartender-card-hint" style={{ color: b.color }}>
                        6 步流程 · 约 3 分钟
                      </span>
                      <span className="bartender-card-cta" style={{ color: b.color }}>
                        开始 →
                      </span>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>

            {/* 底部提示 */}
            <Card className="bartender-tip-card">
              <div className="bartender-tip-title">💡 小提示</div>
              <p className="bartender-tip-text">
                调酒师的风格会影响酒名生成、质地判断和呈现方式。
                <br />
                你可以多次体验，感受不同调酒师带来的差异。
              </p>
            </Card>
          </Space>
        </div>
      </div>
    );
  }

  // 阶段3：展示配方
  if (stage === 'result' && cocktail) {
    return (
      <div className="bartender-result-container">
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

          {/* 回味评分：喝后评分 → 向量校准 → 推荐优化 */}
          <FeedbackRating
            recipeId={`cocktail-${cocktail?.name || 'unknown'}`}
            scene="bartender-result"
          />

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

          {/* 进入第二层入口 */}
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(139,92,246,0.15) 100%)',
              border: '1px solid rgba(236,72,153,0.4)',
              borderRadius: 16,
            }}
          >
            <Space size="large" align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <div>
                <Title level={4} style={{ color: '#fff', margin: 0 }}>
                  🎯 人格调酒挑战赛
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  你已进入状态。现在，挑战开始。限时3分钟，调一杯属于你的主题酒。
                </Text>
              </div>
              <Button
                type="primary"
                size="large"
                icon={<FireOutlined />}
                onClick={handleEnterChallenge}
                style={{
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  border: 'none',
                }}
              >
                接受挑战
              </Button>
            </Space>
          </Card>

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
    <div className="bartender-flow-container">
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

  // ========== 第二层：挑战赛 ==========
  if (stage === 'challenge') {
    const flavorOptions = challengeEngine.getFlavorOptions();
    const baseOptions = challengeEngine.getBaseOptions();
    const mixerOptions = challengeEngine.getMixerOptions();
    const garnishOptions = challengeEngine.getGarnishOptions();
    const storyTones = challengeEngine.getStoryTones();
    const timePercent = (challengeTimeLeft / (challengeTheme?.timeLimit || 180)) * 100;
    const canSubmit = challengeSubmission.base && challengeSubmission.flavors.length > 0;

    if (challengeResult) {
      // 评分结果展示
      return (
        <div className="challenge-container">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <Button icon={<ArrowLeftOutlined />} onClick={() => setStage('result')}>
                    返回配方
                  </Button>
                </Space>
                <Tag color={challengeResult.rank.color} style={{ fontSize: 16, padding: '4px 16px' }}>
                  <CrownOutlined /> {challengeResult.rank.label} · {challengeResult.rank.title}
                </Tag>
              </Space>
            </Card>

            {/* 综合得分 */}
            <Card
              style={{
                background: 'linear-gradient(135deg, rgba(236,72,153,0.1) 0%, rgba(139,92,246,0.1) 100%)',
                border: '1px solid rgba(236,72,153,0.3)',
              }}
            >
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>人格匹配度</Text>
                    <Progress
                      type="dashboard"
                      percent={challengeResult.personalityScore}
                      strokeColor="#ec4899"
                      size={100}
                    />
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>创意指数</Text>
                    <Progress
                      type="dashboard"
                      percent={challengeResult.creativityScore}
                      strokeColor="#8b5cf6"
                      size={100}
                    />
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>呈现感</Text>
                    <Progress
                      type="dashboard"
                      percent={challengeResult.presentationScore}
                      strokeColor="#f59e0b"
                      size={100}
                    />
                  </div>
                </Col>
              </Row>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: challengeResult.rank.color }}>
                  {challengeResult.totalScore}
                </div>
                <Text type="secondary">综合得分</Text>
              </div>
            </Card>

            {/* 评委评语 */}
            <Card title={<Space><TrophyOutlined style={{ color: '#D4AF37' }} /><span>评委点评</span></Space>}>
              <Space direction="vertical" size="medium" style={{ width: '100%' }}>
                {challengeResult.judges.map(judge => (
                  <div
                    key={judge.key}
                    style={{
                      padding: 16,
                      background: `linear-gradient(90deg, ${judge.color}15 0%, transparent 100%)`,
                      borderRadius: 12,
                      borderLeft: `4px solid ${judge.color}`,
                    }}
                  >
                    <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Avatar size={48} style={{ backgroundColor: judge.color }}>
                          {judge.icon}
                        </Avatar>
                        <div>
                          <div style={{ fontWeight: 600 }}>{judge.name}</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>{judge.personality}</Text>
                        </div>
                      </Space>
                      <Tag color={judge.color} style={{ fontSize: 18, padding: '4px 12px' }}>
                        {judge.score}
                      </Tag>
                    </Space>
                    <Paragraph style={{ marginTop: 12, marginBottom: 0, color: '#cbd5e0', fontSize: 14 }}>
                      "{judge.comment}"
                    </Paragraph>
                  </div>
                ))}
              </Space>
            </Card>

            {/* 进入第三层入口 */}
            <Card
              style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(59,130,246,0.15) 100%)',
                border: '1px solid rgba(34,197,94,0.4)',
                borderRadius: 16,
              }}
            >
              <Space size="large" align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                <div>
                  <Title level={4} style={{ color: '#fff', margin: 0 }}>
                    🍸 MBTI 酒局模拟沙盘
                  </Title>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    你的调酒数据已经准备好了。现在，走进一个虚拟酒局，看看你的行为如何被翻译成人格图谱。
                  </Text>
                </div>
                <Button
                  type="primary"
                  size="large"
                  icon={<TeamOutlined />}
                  onClick={handleEnterSandbox}
                  style={{
                    background: 'linear-gradient(135deg, #22c55e, #3b82f6)',
                    border: 'none',
                  }}
                >
                  进入酒局
                </Button>
              </Space>
            </Card>

            <div style={{ textAlign: 'center' }}>
              <Button
                size="large"
                icon={<ReloadOutlined />}
                onClick={handleEnterChallenge}
              >
                再挑战一次
              </Button>
            </div>
          </Space>
        </div>
      );
    }

    // 挑战赛进行中
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 顶部：主题 + 倒计时 */}
          <Card>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => setStage('result')}>
                  返回
                </Button>
                <Tag color="magenta" style={{ fontSize: 14 }}>
                  <FireOutlined /> 挑战中
                </Tag>
              </Space>
              <Space>
                <ClockCircleOutlined style={{ color: challengeTimeLeft <= 30 ? '#ef4444' : '#D4AF37', fontSize: 18 }} />
                <Text style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: challengeTimeLeft <= 30 ? '#ef4444' : '#fff',
                  fontFamily: 'monospace',
                }}>
                  {Math.floor(challengeTimeLeft / 60)}:{(challengeTimeLeft % 60).toString().padStart(2, '0')}
                </Text>
              </Space>
            </Space>
            <Progress
              percent={timePercent}
              showInfo={false}
              strokeColor={challengeTimeLeft <= 30 ? '#ef4444' : '#ec4899'}
              style={{ marginTop: 12 }}
            />
          </Card>

          {/* 挑战主题 */}
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(236,72,153,0.1) 0%, rgba(139,92,246,0.1) 100%)',
              border: '1px solid rgba(236,72,153,0.3)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>今夜主题</Text>
              <Title level={3} style={{ marginTop: 8, marginBottom: 8, color: '#fff' }}>
                "{challengeTheme?.title}"
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {challengeTheme?.desc}
              </Paragraph>
              <div style={{ marginTop: 8 }}>
                {challengeTheme?.keywords?.map((k, i) => (
                  <Tag key={i} color="purple" style={{ margin: 2 }}>{k}</Tag>
                ))}
              </div>
            </div>
          </Card>

          {/* 风味选择 */}
          <Card title={<Space><StarOutlined style={{ color: '#f59e0b' }} /><span>选择风味（可多选）</span></Space>}>
            <Row gutter={[8, 8]}>
              {flavorOptions.map(opt => {
                const selected = challengeSubmission.flavors.includes(opt.key);
                return (
                  <Col xs={12} sm={8} md={6} key={opt.key}>
                    <Card
                      hoverable
                      onClick={() => handleToggleFlavor(opt.key)}
                      style={{
                        cursor: 'pointer',
                        textAlign: 'center',
                        borderColor: selected ? '#f59e0b' : '#d9d9d9',
                        background: selected ? 'rgba(245,158,11,0.1)' : 'transparent',
                        borderWidth: selected ? 2 : 1,
                      }}
                      bodyStyle={{ padding: 12 }}
                    >
                      <div style={{ fontSize: 24 }}>{opt.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: selected ? 600 : 400 }}>{opt.label}</div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Card>

          {/* 基酒选择 */}
          <Card title={<Space><TrophyOutlined style={{ color: '#D4AF37' }} /><span>选择基酒</span></Space>}>
            <Row gutter={[8, 8]}>
              {baseOptions.map(opt => (
                <Col xs={12} sm={8} md={6} key={opt.key}>
                  <Card
                    hoverable
                    onClick={() => setChallengeSubmission(prev => ({ ...prev, base: opt.key }))}
                    style={{
                      cursor: 'pointer',
                      textAlign: 'center',
                      borderColor: challengeSubmission.base === opt.key ? '#D4AF37' : '#d9d9d9',
                      background: challengeSubmission.base === opt.key ? 'rgba(212,175,55,0.1)' : 'transparent',
                      borderWidth: challengeSubmission.base === opt.key ? 2 : 1,
                    }}
                    bodyStyle={{ padding: 12 }}
                  >
                    <div style={{ fontSize: 28 }}>{opt.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: challengeSubmission.base === opt.key ? 600 : 400 }}>{opt.label}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          {/* 配料选择 */}
          <Card title={<Space><ExperimentOutlined /><span>配料（可多选）</span></Space>}>
            <Row gutter={[8, 8]}>
              {mixerOptions.map(opt => {
                const selected = challengeSubmission.mixers.includes(opt.key);
                return (
                  <Col xs={12} sm={8} md={6} key={opt.key}>
                    <Card
                      hoverable
                      onClick={() => handleToggleMixer(opt.key)}
                      style={{
                        cursor: 'pointer',
                        textAlign: 'center',
                        borderColor: selected ? '#3b82f6' : '#d9d9d9',
                        background: selected ? 'rgba(59,130,246,0.1)' : 'transparent',
                        borderWidth: selected ? 2 : 1,
                      }}
                      bodyStyle={{ padding: 12 }}
                    >
                      <div style={{ fontSize: 24 }}>{opt.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: selected ? 600 : 400 }}>{opt.label}</div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Card>

          {/* 装饰选择 */}
          <Card title={<Space><CrownOutlined /><span>装饰</span></Space>}>
            <Row gutter={[8, 8]}>
              {garnishOptions.map(opt => (
                <Col xs={12} sm={8} md={6} key={opt.key}>
                  <Card
                    hoverable
                    onClick={() => setChallengeSubmission(prev => ({ ...prev, garnish: opt.key }))}
                    style={{
                      cursor: 'pointer',
                      textAlign: 'center',
                      borderColor: challengeSubmission.garnish === opt.key ? '#22c55e' : '#d9d9d9',
                      background: challengeSubmission.garnish === opt.key ? 'rgba(34,197,94,0.1)' : 'transparent',
                      borderWidth: challengeSubmission.garnish === opt.key ? 2 : 1,
                    }}
                    bodyStyle={{ padding: 12 }}
                  >
                    <div style={{ fontSize: 24 }}>{opt.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: challengeSubmission.garnish === opt.key ? 600 : 400 }}>{opt.label}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          {/* 故事基调 */}
          <Card title={<Space><CommentOutlined /><span>故事基调</span></Space>}>
            <Row gutter={[8, 8]}>
              {storyTones.map(opt => (
                <Col xs={24} sm={12} key={opt.key}>
                  <Card
                    hoverable
                    onClick={() => setChallengeSubmission(prev => ({ ...prev, storyTone: opt.key }))}
                    style={{
                      cursor: 'pointer',
                      borderColor: challengeSubmission.storyTone === opt.key ? '#8b5cf6' : '#d9d9d9',
                      background: challengeSubmission.storyTone === opt.key ? 'rgba(139,92,246,0.1)' : 'transparent',
                      borderWidth: challengeSubmission.storyTone === opt.key ? 2 : 1,
                    }}
                  >
                    <div style={{ fontWeight: challengeSubmission.storyTone === opt.key ? 600 : 400 }}>{opt.label}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{opt.desc}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          {/* 故事描述 */}
          <Card title={<Space><BulbOutlined style={{ color: '#D4AF37' }} /><span>这杯酒的故事（选填）</span></Space>}>
            <Input.TextArea
              value={challengeSubmission.storyText}
              onChange={e => setChallengeSubmission(prev => ({ ...prev, storyText: e.target.value }))}
              placeholder="用几句话描述这杯酒的故事，它想表达什么..."
              rows={3}
              maxLength={200}
              showCount
            />
          </Card>

          {/* 提交按钮 */}
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              onClick={handleSubmitChallenge}
              disabled={!canSubmit && challengeTimeLeft > 0}
              style={{
                background: canSubmit ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : undefined,
                border: 'none',
                minWidth: 200,
              }}
            >
              {challengeTimeLeft <= 0 ? '时间到，提交评分' : '提交，接受评委点评'}
            </Button>
          </div>
        </Space>
      </div>
    );
  }

  // ========== 第三层：酒局沙盘 ==========
  if (stage === 'sandbox') {
    const roundConfig = sandboxEngine.getRoundConfig(sandboxCurrentRound);
    const round = roundConfig.round;
    const options = roundConfig.options;

    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 顶部场景信息 */}
          <Card>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => setStage('challenge')}>
                  返回
                </Button>
                <Tag color="green">
                  <TeamOutlined /> 酒局模拟
                </Tag>
              </Space>
              <Tag>{sandboxScenario?.title}</Tag>
            </Space>
          </Card>

          {/* 场景描述 */}
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(59,130,246,0.1) 100%)',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{sandboxScenario?.background}</Text>
              <Title level={4} style={{ marginTop: 8, marginBottom: 4, color: '#fff' }}>
                {sandboxScenario?.title}
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {sandboxScenario?.desc}
              </Paragraph>
            </div>
          </Card>

          {/* 酒局人物 */}
          <Card title={<Space><TeamOutlined /><span>酒局中的人</span></Space>}>
            <Row gutter={[12, 12]}>
              {sandboxCharacters.map(char => (
                <Col xs={12} sm={6} key={char.mbti}>
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 16,
                      background: `linear-gradient(135deg, ${char.color}15 0%, transparent 100%)`,
                      borderRadius: 12,
                      border: `1px solid ${char.color}40`,
                    }}
                  >
                    <Avatar size={48} style={{ backgroundColor: char.color, marginBottom: 8 }}>
                      {char.name[0]}
                    </Avatar>
                    <div style={{ fontWeight: 600 }}>{char.name}</div>
                    <Tag color={char.color} style={{ marginTop: 4 }}>{char.mbti}</Tag>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{char.role}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>

          {/* 进度条 */}
          <Steps current={sandboxCurrentRound - 1} size="small">
            {[1, 2, 3, 4, 5].map(n => {
              const r = sandboxEngine.getRoundConfig(n).round;
              return <Step key={n} title={<span style={{ fontSize: 12 }}>{r?.title}</span>} />;
            })}
          </Steps>

          {/* 当前轮次 */}
          <Card
            style={{
              background: 'rgba(59,130,246,0.05)',
              border: '1px solid rgba(59,130,246,0.3)',
            }}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Tag color="blue">{round?.title} · 第 {sandboxCurrentRound}/5 轮</Tag>
                <Title level={4} style={{ marginTop: 8, marginBottom: 4, color: '#fff' }}>
                  {round?.desc}
                </Title>
                <Text type="secondary">
                  影响维度：{round?.dimensionLabel}（{round?.dimension}）
                </Text>
              </div>

              <Space direction="vertical" style={{ width: '100%' }}>
                {options.map(opt => (
                  <Card
                    key={opt.key}
                    hoverable
                    onClick={() => handleSandboxChoice(opt.key)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: 12,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.background = 'rgba(59,130,246,0.1)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '';
                      e.currentTarget.style.background = '';
                    }}
                  >
                    <Space size="large" style={{ width: '100%' }}>
                      <RightCircleOutlined style={{ color: '#3b82f6', fontSize: 20 }} />
                      <Text style={{ fontSize: 14 }}>{opt.text}</Text>
                    </Space>
                  </Card>
                ))}
              </Space>
            </Space>
          </Card>
        </Space>
      </div>
    );
  }

  // ========== 沙盘结果 ==========
  if (stage === 'sandbox-result' && sandboxResult) {
    const bartenderComment = sandboxEngine.getBartenderComment(bartender?.key, sandboxResult);

    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => setStage('sandbox')}>
                  返回酒局
                </Button>
              </Space>
              <Tag color="#22c55e">
                <TrophyOutlined /> 酒局人格图谱
              </Tag>
            </Space>
          </Card>

          {/* 场景回顾 */}
          <Card
            size="small"
            title={<Space><ShareAltOutlined /><span>酒局行为回顾</span></Space>}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>场景：</Text>
                <Text>{sandboxScenario?.title}</Text>
              </div>
              {sandboxResult.choiceDescriptions.map((c, i) => (
                <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{c.title}：</Text>
                  <Text style={{ fontSize: 13 }}>{c.text}</Text>
                </div>
              ))}
            </Space>
          </Card>

          {/* 人格维度 */}
          <Card title={<Space><ThunderboltOutlined /><span>人格维度分析</span></Space>}>
            <Row gutter={[16, 16]}>
              {Object.entries(sandboxResult.dimensions).map(([key, dim]) => {
                const labels = key.split('/');
                return (
                  <Col xs={24} sm={12} key={key}>
                    <div style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 12 }}>{labels[0]}</Text>
                      <Text type="secondary" style={{ fontSize: 12, float: 'right' }}>{labels[1]}</Text>
                    </div>
                    <div style={{
                      height: 24,
                      background: '#1f2937',
                      borderRadius: 12,
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${dim.percentA}%`,
                        background: dim.dominant === 'A' ? '#3b82f6' : '#888',
                        transition: 'width 0.5s',
                      }} />
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        height: '100%',
                        width: 2,
                        background: '#4b5563',
                        transform: 'translateX(-50%)',
                      }} />
                    </div>
                    <div style={{ marginTop: 4, textAlign: 'center' }}>
                      <Tag color={dim.dominant === 'A' ? '#3b82f6' : '#888'}>
                        {dim.dominant === 'A' ? labels[0] : labels[1]} {dim.dominant === 'A' ? dim.percentA : dim.percentB}%
                      </Tag>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>

          {/* MBTI 类型 */}
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(59,130,246,0.15) 100%)',
              border: '1px solid rgba(34,197,94,0.4)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>你的酒局人格类型</Text>
              <div style={{
                fontSize: 64,
                fontWeight: 800,
                background: 'linear-gradient(135deg, #22c55e, #3b82f6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: 8,
                marginTop: 8,
                marginBottom: 8,
              }}>
                {sandboxResult.mbtiType}
              </div>
              <Text type="secondary">基于你在酒局中的5个选择计算得出</Text>
            </div>
          </Card>

          {/* MBTI 概率分布 */}
          <Card title={<Space><StarOutlined style={{ color: '#D4AF37' }} /><span>MBTI 概率分布</span></Space>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {sandboxResult.probabilities.slice(0, 6).map((p, i) => (
                <div key={p.type}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <Tag color={i === 0 ? '#22c55e' : undefined}>{p.type}</Tag>
                      {i === 0 && <Tag color="green">最高匹配</Tag>}
                    </Space>
                    <Text style={{ fontWeight: 600 }}>{p.probability}%</Text>
                  </Space>
                  <Progress
                    percent={p.probability}
                    showInfo={false}
                    strokeColor={i === 0 ? '#22c55e' : '#4b5563'}
                    size="small"
                  />
                </div>
              ))}
            </Space>
          </Card>

          {/* 调酒师评语 */}
          <Card
            style={{
              background: `linear-gradient(135deg, ${bartender?.color}15 0%, transparent 100%)`,
              border: `1px solid ${bartender?.color}40`,
            }}
          >
            <Space size="large">
              <Avatar size={64} style={{ backgroundColor: bartender?.color }}>
                {bartender?.icon}
              </Avatar>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>{bartender?.name} · 调酒师评语</Text>
                <Paragraph style={{ marginTop: 8, marginBottom: 0, fontSize: 15, color: '#fff' }}>
                  "{bartenderComment}"
                </Paragraph>
              </div>
            </Space>
          </Card>

          {/* 回味评分：喝后评分 → 向量校准 → 推荐优化 */}
          <FeedbackRating
            recipeId={`sandbox-${sandboxResult?.mbtiType || 'unknown'}`}
            scene="bartender-sandbox"
          />

          {/* 结束按钮 */}
          <div style={{ textAlign: 'center' }}>
            <Space>
              <Button
                size="large"
                icon={<ReloadOutlined />}
                onClick={handleEnterSandbox}
              >
                再玩一次酒局
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<HomeOutlined />}
                onClick={handleRestart}
              >
                完成本次体验
              </Button>
            </Space>
          </div>
        </Space>
      </div>
    );
  }
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
