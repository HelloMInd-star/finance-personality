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
  ExperimentOutlined
} from '@ant-design/icons';
import CocktailCard from '../components/CocktailCard/CocktailCard';
import {
  molecularEngine,
  BARTENDERS,
  EMOTION_OPTIONS,
  BASE_SPIRITS,
  QUESTIONS,
  STORY_SEEDS,
  ZODIAC_SIGNS
} from '../utils/molecularEngine';
import { logger } from '../utils/logger';

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
    logger.session('配方生成完成', result.name);
  };

  // 重新开始
  const handleRestart = () => {
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
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card>
            <Space align="center">
              <div style={{ fontSize: 48 }}>🍸</div>
              <div>
                <Title level={3} style={{ margin: 0 }}>分子调酒 · 选择你的调酒师</Title>
                <Paragraph style={{ margin: '8px 0 0' }} type="secondary">
                  每位调酒师有独特的风格，会影响最终的配方呈现
                </Paragraph>
              </div>
            </Space>
          </Card>

          <Row gutter={[16, 16]}>
            {Object.values(BARTENDERS).map(b => (
              <Col xs={24} md={8} key={b.key}>
                <Card
                  hoverable
                  onClick={() => handleSelectBartender(b.key)}
                  style={{
                    borderColor: b.color,
                    borderWidth: 2,
                    height: '100%'
                  }}
                  bodyStyle={{ textAlign: 'center', padding: 32 }}
                >
                  <Avatar
                    size={80}
                    style={{ backgroundColor: b.color, fontSize: 36, marginBottom: 16 }}
                  >
                    {b.icon}
                  </Avatar>
                  <Title level={4} style={{ margin: '0 0 4px' }}>{b.name}</Title>
                  <Tag color={b.color} style={{ marginBottom: 12 }}>{b.title}</Tag>
                  <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
                    {b.style}
                  </Paragraph>
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      擅长：{b.specialty}
                    </Text>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Space>
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
                      <Col xs={12} key={s.key}>
                        <Radio.Button
                          value={s.key}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: 8,
                            borderColor: storySeed === s.key ? '#D4AF37' : '#d9d9d9'
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
