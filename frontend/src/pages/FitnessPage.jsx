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
  Result,
  InputNumber,
  Radio,
  Tabs,
  List,
  Avatar,
  Empty,
  Badge,
  Select,
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
  PlusOutlined,
  MinusOutlined,
  PlayCircleOutlined,
  LineChartOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  RiseOutlined,
  FallOutlined,
  FireOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  fitnessEngine,
  TRAINING_TYPES,
  FATIGUE_LEVELS,
} from '../utils/fitnessEngine';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';
import './FitnessPage.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const STEPS = [
  { key: 'select', title: '选择训练类型' },
  { key: 'plan', title: '设定计划' },
  { key: 'execute', title: '执行训练' },
  { key: 'feedback', title: '偏差反馈' },
];

// 行为采集数据类型
const COLLECTED_DATA_TYPES = [
  { key: 'completion', icon: '✅', title: '计划完成率', desc: '实际完成组数与计划的比例，反映纪律性' },
  { key: 'intensity', icon: '🔥', title: '强度偏差', desc: '目标强度与实际执行的差异' },
  { key: 'modifications', icon: '🔄', title: '计划修改次数', desc: '临时调整重量/次数，反映灵活性vs固执' },
  { key: 'duration', icon: '⏱️', title: '训练时长', desc: '实际训练时长与计划的对比' },
  { key: 'fatigue', icon: '😓', title: '疲劳度反馈', desc: '自我报告的疲劳程度，反映自我感知' },
  { key: 'consistency', icon: '📊', title: '组间一致性', desc: '各组完成情况的方差，反映稳定性' },
  { key: 'earlyEnd', icon: '⏹️', title: '提前结束率', desc: '是否提前终止训练，反映意志力' },
  { key: 'restInterval', icon: '😴', title: '休息间隔', desc: '组间休息时间，反映节奏控制' },
];

// ============= 健身训练核心组件 =============
const FitnessTrainer = ({ onSessionEnd }) => {
  const [stage, setStage] = useState('select');
  const [trainingType, setTrainingType] = useState(null);
  const [plan, setPlan] = useState(null);
  const [targetIntensity, setTargetIntensity] = useState(70);
  const [planModifications, setPlanModifications] = useState(0);
  const [execution, setExecution] = useState({
    completedSets: 0,
    currentExerciseIdx: 0,
    currentSetIdx: 0,
    actualReps: [],
    actualWeights: [],
    fatigue: 'low',
    startTime: null,
  });
  const [deviation, setDeviation] = useState(null);
  const [deviationTag, setDeviationTag] = useState(null);
  const [moodData, setMoodData] = useState(null);
  const [setResults, setSetResults] = useState([]);
  const [tempReps, setTempReps] = useState(10);
  const [tempWeight, setTempWeight] = useState(0);

  const totalSets = plan?.exercises?.reduce((s, e) => s + e.sets, 0) || 0;

  const handleSelectType = (key) => {
    setTrainingType(key);
    const newPlan = fitnessEngine.generatePlan(key);
    setPlan(newPlan);
    setTargetIntensity(newPlan.targetIntensity);
    setStage('plan');
    logger.session('健身-选择训练类型', TRAINING_TYPES[key].label);
  };

  const handleStartExecute = () => {
    setExecution({
      completedSets: 0,
      currentExerciseIdx: 0,
      currentSetIdx: 0,
      actualReps: [],
      actualWeights: plan.exercises.flatMap(e => Array(e.sets).fill(e.weight)),
      fatigue: 'low',
      startTime: Date.now(),
    });
    setSetResults([]);
    setStage('execute');
    logger.session('健身-开始训练', { 类型: trainingType, 总组数: totalSets });
  };

  const getFlatIndex = () => {
    let idx = 0;
    for (let i = 0; i < execution.currentExerciseIdx; i++) {
      idx += plan.exercises[i].sets;
    }
    idx += execution.currentSetIdx;
    return idx;
  };

  const handleCompleteSet = (reps, weight) => {
    const newReps = [...execution.actualReps, reps];
    const newWeights = [...execution.actualWeights];
    const flatIdx = getFlatIndex();
    newWeights[flatIdx] = weight;

    const exercise = plan.exercises[execution.currentExerciseIdx];
    if (weight !== exercise.weight) setPlanModifications(c => c + 1);
    if (reps !== exercise.repsPerSet?.[execution.currentSetIdx]) setPlanModifications(c => c + 1);

    const newCompleted = execution.completedSets + 1;
    setSetResults(prev => {
      const next = [...prev];
      next[flatIdx] = { actualReps: reps, actualWeight: weight };
      return next;
    });
    setExecution({ ...execution, actualReps: newReps, actualWeights: newWeights, completedSets: newCompleted });

    logger.session('健身-完成一组', {
      动作: exercise.name,
      第几种: `${execution.currentSetIdx + 1}/${exercise.sets}`,
      计划次数: exercise.repsPerSet?.[execution.currentSetIdx] || '计时',
      实际次数: reps,
      计划重量: (exercise.weight || 0) + 'kg',
      实际重量: weight + 'kg',
      进度: `${newCompleted}/${totalSets}`,
    });

    if (execution.currentSetIdx < exercise.sets - 1) {
      setExecution(s => ({ ...s, currentSetIdx: s.currentSetIdx + 1 }));
    } else if (execution.currentExerciseIdx < plan.exercises.length - 1) {
      setExecution(s => ({ ...s, currentExerciseIdx: s.currentExerciseIdx + 1, currentSetIdx: 0 }));
    } else {
      finishSession();
    }
  };

  const handleSkipSet = () => {
    setPlanModifications(c => c + 1);
    const exercise = plan.exercises[execution.currentExerciseIdx];
    logger.session('健身-跳过一组', {
      动作: exercise.name,
      第几种: `${execution.currentSetIdx + 1}/${exercise.sets}`,
    });
    handleCompleteSet(0, plan.exercises[execution.currentExerciseIdx].weight);
  };

  const finishSession = (early = false) => {
    const completionTime = execution.startTime ? Math.round((Date.now() - execution.startTime) / 60000) : 0;
    const execData = {
      completedSets: execution.completedSets,
      totalSets,
      actualReps: execution.actualReps,
      actualWeight: execution.actualWeights,
      completionTime,
    };
    const dev = fitnessEngine.calculateDeviation(plan, execData, planModifications);
    setDeviation(dev);
    const tag = fitnessEngine.generateDeviationTag(dev.completionRate, plan.targetIntensity);
    setDeviationTag(tag);
    const mood = fitnessEngine.generateFitnessMood({
      plan, execution: execData, deviation: dev, trainingType, fatigue: execution.fatigue,
    });
    setMoodData(mood);
    const positionSim = fitnessEngine.generatePositionSimulation(plan, setResults);
    const session = fitnessEngine.createFitnessSession({
      trainingType, plan, execution: execData, deviation: dev, mood,
      fatigue: execution.fatigue, positionSimulation: positionSim,
    });
    storage.update('fitnessSessions', prev => [...(prev || []), session]);
    storage.update('psychologyProfile', prev => ({ ...prev, fitnessMood: mood, lastFitnessTime: Date.now() }));
    storage.update('fitnessGames', prev => [...(prev || []), session]);
    logger.session('健身-训练结束', { 完成率: dev.completionRate + '%', 偏离类型: dev.deviationType, 标签: tag.label });
    setStage(early ? 'feedback' : 'finished');
    onSessionEnd && onSessionEnd(session);
  };

  const handleEarlyEnd = () => {
    logger.session('健身-提前结束训练', {
      已完成: `${execution.completedSets}/${totalSets} 组`,
      进度: ((execution.completedSets / totalSets) * 100).toFixed(0) + '%',
    });
    finishSession(true);
  };
  const handleNewSession = () => {
    setStage('select');
    setTrainingType(null);
    setPlan(null);
    setDeviation(null);
    setDeviationTag(null);
    setMoodData(null);
    setPlanModifications(0);
  };

  const currentExercise = plan?.exercises?.[execution.currentExerciseIdx];
  const progress = totalSets > 0 ? (execution.completedSets / totalSets) * 100 : 0;

  useEffect(() => {
    if (currentExercise) {
      setTempReps(currentExercise.repsPerSet?.[execution.currentSetIdx] || 10);
      setTempWeight(currentExercise.weight || 0);
    }
  }, [execution.currentExerciseIdx, execution.currentSetIdx, plan]);

  const positionSim = useMemo(
    () => plan ? fitnessEngine.generatePositionSimulation(plan, setResults) : null,
    [plan, setResults]
  );

  // ============= 渲染 =============
  if (stage === 'select') {
    return (
      <div className="fitness-trainer-inner">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={5} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>选择训练类型</Title>
          <Row gutter={[16, 16]}>
            {Object.values(TRAINING_TYPES).map(t => (
              <Col xs={12} md={6} key={t.key}>
                <Card
                  hoverable
                  onClick={() => handleSelectType(t.key)}
                  style={{ borderColor: t.color + '66', borderWidth: 2, height: '100%', textAlign: 'center', background: 'rgba(30,19,64,0.4)', borderRadius: 16 }}
                  bodyStyle={{ padding: 24 }}
                >
                  <div style={{ fontSize: 48, marginBottom: 8 }}>{t.icon}</div>
                  <Title level={5} style={{ color: t.color, margin: '0 0 4px' }}>{t.label}</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>{t.desc}</Text>
                </Card>
              </Col>
            ))}
          </Row>
        </Space>
      </div>
    );
  }

  if (stage === 'plan' && plan) {
    const typeInfo = TRAINING_TYPES[trainingType];
    return (
      <div className="fitness-trainer-inner">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card size="small" style={{ background: 'rgba(30,19,64,0.4)', borderRadius: 12 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button onClick={() => setStage('select')}>← 返回</Button>
                <Tag color={typeInfo.color}>{typeInfo.icon} {typeInfo.label}训练</Tag>
              </Space>
              <Text type="secondary">Step 2/4 · 设定计划</Text>
            </Space>
          </Card>
          <Card title="动作计划" style={{ borderRadius: 16 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {plan.exercises.map((ex, exIdx) => (
                <Card key={exIdx} size="small" type="inner">
                  <Row gutter={[16, 8]} align="middle">
                    <Col span={6}><Text strong>{ex.name}</Text></Col>
                    <Col span={6}><Text type="secondary">组数：{ex.sets}</Text></Col>
                    <Col span={6}><Text type="secondary">每组次数：{ex.repsPerSet?.join('/') || '计时'}</Text></Col>
                    <Col span={6}><Text type="secondary">{ex.weight > 0 ? `${ex.weight}kg` : ex.duration ? `${ex.duration}分钟` : '自重'}</Text></Col>
                  </Row>
                </Card>
              ))}
            </Space>
          </Card>
          <Card title="目标设置" style={{ borderRadius: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text type="secondary">目标强度：{targetIntensity}%</Text>
                <Slider min={20} max={100} value={targetIntensity} onChange={v => {
                  setTargetIntensity(v);
                  setPlanModifications(c => c + 1);
                  logger.session('健身-修改目标强度', { 原强度: targetIntensity + '%', 新强度: v + '%' });
                }} marks={{ 40: '低', 70: '中', 90: '高' }} />
              </Col>
              <Col span={12}>
                <Text type="secondary">休息间隔：{plan.restInterval}秒</Text>
                <Slider min={30} max={180} step={15} value={plan.restInterval} onChange={v => {
                  setPlan({ ...plan, restInterval: v });
                  logger.session('健身-修改休息间隔', { 原间隔: plan.restInterval + '秒', 新间隔: v + '秒' });
                }} />
              </Col>
            </Row>
          </Card>
          <div style={{ textAlign: 'center' }}>
            <Button type="primary" size="large" onClick={handleStartExecute}>🏁 开始训练</Button>
          </div>
        </Space>
      </div>
    );
  }

  if (stage === 'execute' && plan && currentExercise) {
    return (
      <div className="fitness-trainer-inner">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card size="small" style={{ background: 'rgba(30,19,64,0.4)', borderRadius: 12 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Tag color={TRAINING_TYPES[trainingType].color}>{TRAINING_TYPES[trainingType].icon} {TRAINING_TYPES[trainingType].label}</Tag>
                <Text>第 {execution.completedSets + 1} / {totalSets} 组</Text>
              </Space>
              <Button danger size="small" onClick={handleEarlyEnd}>结束训练</Button>
            </Space>
            <Progress percent={Math.round(progress)} status={progress >= 100 ? 'success' : 'active'} style={{ marginTop: 12 }} />
          </Card>

          <Card style={{ borderRadius: 16 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Text type="secondary">当前动作</Text>
              <Title level={3} style={{ margin: '4px 0' }}>{currentExercise.name}</Title>
              <Tag color="blue">第 {execution.currentSetIdx + 1} / {currentExercise.sets} 组</Tag>
            </div>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={12}><Card size="small"><Statistic title="计划次数" value={currentExercise.repsPerSet?.[execution.currentSetIdx] || '计时'} suffix={currentExercise.duration ? '分钟' : '次'} /></Card></Col>
              <Col span={12}><Card size="small"><Statistic title="计划重量" value={currentExercise.weight || 0} suffix={currentExercise.weight > 0 ? 'kg' : '自重'} /></Card></Col>
            </Row>
            <Divider>记录实际完成</Divider>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Text type="secondary">实际完成次数</Text>
                <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                  <Button onClick={() => setTempReps(r => Math.max(0, r - 1))}><MinusOutlined /></Button>
                  <InputNumber min={0} max={50} value={tempReps} onChange={setTempReps} style={{ width: '100%', textAlign: 'center' }} />
                  <Button onClick={() => setTempReps(r => r + 1)}><PlusOutlined /></Button>
                </Space.Compact>
              </Col>
              <Col span={12}>
                <Text type="secondary">实际重量 (kg)</Text>
                <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                  <Button onClick={() => setTempWeight(w => Math.max(0, w - 2.5))}><MinusOutlined /></Button>
                  <InputNumber min={0} step={2.5} value={tempWeight} onChange={setTempWeight} style={{ width: '100%', textAlign: 'center' }} />
                  <Button onClick={() => setTempWeight(w => w + 2.5)}><PlusOutlined /></Button>
                </Space.Compact>
              </Col>
            </Row>
            <Row gutter={[16, 8]} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Text type="secondary">当前疲劳度</Text>
                <div style={{ marginTop: 4 }}>
                  <Radio.Group value={execution.fatigue} onChange={e => {
                    const oldFatigue = FATIGUE_LEVELS.find(f => f.key === execution.fatigue)?.label || execution.fatigue;
                    const newFatigue = FATIGUE_LEVELS.find(f => f.key === e.target.value)?.label || e.target.value;
                    setExecution({ ...execution, fatigue: e.target.value });
                    logger.session('健身-疲劳度变化', { 原状态: oldFatigue, 新状态: newFatigue });
                  }}>
                    {FATIGUE_LEVELS.map(f => (
                      <Radio.Button key={f.key} value={f.key}><span style={{ color: f.color }}>{f.label}</span></Radio.Button>
                    ))}
                  </Radio.Group>
                </div>
              </Col>
            </Row>
            <Space style={{ justifyContent: 'center', width: '100%' }}>
              <Button type="primary" size="large" onClick={() => handleCompleteSet(tempReps, tempWeight)} disabled={tempReps === 0}>✓ 完成本组</Button>
              <Button size="large" onClick={handleSkipSet}>跳过本组</Button>
            </Space>
          </Card>

          {positionSim && (
            <Card size="small" title={<Space><TrophyOutlined style={{ color: '#D4AF37' }} /><span>模拟仓位 · 同步显示</span><Tag color="#D4AF37" style={{ marginLeft: 8 }}>初始仓位：{positionSim.initialPosition.toFixed(0)} kg·次</Tag></Space>} style={{ borderRadius: 16 }}>
              <Row gutter={[16, 12]} style={{ marginBottom: 16 }}>
                <Col span={8}><Statistic title="当前仓位" value={positionSim.currentPosition.toFixed(0)} suffix="kg·次" valueStyle={{ color: positionSim.positionChangePercent >= 0 ? '#52c41a' : '#eb2f96', fontSize: 20 }} prefix={positionSim.positionChangePercent >= 0 ? '↑' : '↓'} /></Col>
                <Col span={8}><Statistic title="仓位变化" value={positionSim.positionChangePercent} suffix="%" valueStyle={{ color: positionSim.positionChangePercent >= 0 ? '#52c41a' : '#eb2f96', fontSize: 20 }} prefix={positionSim.positionChangePercent >= 0 ? '+' : ''} /></Col>
                <Col span={8}><Text type="secondary">行业映射</Text><div style={{ marginTop: 4 }}><Tag color="blue">{positionSim.mappedIndustry}</Tag></div></Col>
              </Row>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>仓位管理行为标签：</Text>
                <div style={{ marginTop: 4 }}>
                  {positionSim.behaviorTags.map((tag, i) => (
                    <Tag key={i} color={tag.includes('加仓') ? 'red' : tag.includes('减仓') ? 'orange' : tag.includes('保守') ? 'green' : tag.includes('活跃') ? 'purple' : 'default'}>{tag}</Tag>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Card size="small" title={<span><BulbOutlined style={{ color: '#D4AF37' }} /> 计划偏离检测</span>} style={{ borderRadius: 16 }}>
            <Row gutter={[16, 8]}>
              <Col span={8}><Statistic title="当前完成率" value={progress.toFixed(0)} suffix="%" valueStyle={{ color: progress >= 70 ? '#52c41a' : '#faad14', fontSize: 20 }} /></Col>
              <Col span={8}><Statistic title="计划修改次数" value={planModifications} valueStyle={{ color: planModifications > 2 ? '#faad14' : undefined, fontSize: 20 }} /></Col>
            </Row>
          </Card>
        </Space>
      </div>
    );
  }

  if ((stage === 'feedback' || stage === 'finished') && deviation && moodData) {
    const typeInfo = TRAINING_TYPES[trainingType];
    const isEarly = stage === 'feedback';
    return (
      <div className="fitness-trainer-inner">
        <Result icon={<TrophyOutlined style={{ color: isEarly ? '#faad14' : '#D4AF37' }} />} title={isEarly ? '训练已结束' : '训练完成！'} subTitle={moodData.summary} extra={[<Button type="primary" key="again" icon={<ReloadOutlined />} onClick={handleNewSession}>再来一次</Button>]} />
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col span={8}><Card><Statistic title="完成率" value={deviation.completionRate} suffix="%" valueStyle={{ color: deviation.completionRate >= 90 ? '#52c41a' : deviation.completionRate >= 70 ? '#faad14' : '#eb2f96', fontSize: 24 }} /></Card></Col>
          <Col span={8}><Card><Statistic title="完成组数" value={`${execution.completedSets}/${totalSets}`} valueStyle={{ fontSize: 24 }} /></Card></Col>
          <Col span={8}><Card><Statistic title="修改次数" value={deviation.planModifications} valueStyle={{ fontSize: 24 }} /></Card></Col>
        </Row>
        <Card title="偏差分析" style={{ marginTop: 16, borderRadius: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text type="secondary">偏离类型</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={deviation.deviationType === 'none' ? 'green' : deviation.deviationType === 'early_end' ? 'red' : deviation.deviationType === 'reduced_intensity' ? 'orange' : deviation.deviationType === 'extended' ? 'blue' : 'default'}>
                  {({ none: '完全按计划执行', early_end: '提前结束', reduced_intensity: '降低强度', extended: '延长/加量', increased_intensity: '增加强度' })[deviation.deviationType] || deviation.deviationType}
                </Tag>
              </div>
            </Col>
            <Col span={12}>
              <Text type="secondary">偏差标签</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color="gold">{deviationTag?.label}</Tag>
                <Tag color="purple">{deviationTag?.personality}</Tag>
                <Tag color="blue">{deviationTag?.industry}</Tag>
              </div>
            </Col>
          </Row>
        </Card>
        <Card title="心情盘" style={{ marginTop: 16, borderRadius: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={8}><Statistic title="情绪值" value={moodData.mood} suffix="%" prefix={<BulbOutlined />} /></Col>
            <Col span={8}><Statistic title="行业映射" value={moodData.industry} /></Col>
            <Col span={8}><Statistic title="趋势" value={({ improving: '进步中', stable: '稳定', worsening: '需关注' })[moodData.trend] || moodData.trend} valueStyle={{ color: moodData.trend === 'improving' ? '#52c41a' : moodData.trend === 'worsening' ? '#eb2f96' : undefined }} /></Col>
          </Row>
        </Card>
      </div>
    );
  }

  return null;
};

// ============= FitnessPage 主组件 =============
const FitnessPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('lobby');

  const mockStats = useMemo(() => ({
    totalSessions: 12,
    avgCompletion: 0.85,
    avgIntensity: 72,
    avgDuration: 45,
    consistency: 0.78,
    totalExercises: 48,
    bestStreak: 5,
    currentStreak: 3,
    isWinStreak: true,
  }), []);

  const historySessions = useMemo(() => storage.get('fitnessSessions') || [], []);

  const renderLobby = () => (
    <div className="fitness-lobby">
      <Card className="fitness-hero-card">
        <div className="fitness-hero-content">
          <div className="fitness-hero-text">
            <Text className="fitness-hero-greeting">💪 健身计划</Text>
            <Title level={2} className="fitness-hero-title">
              在<span className="gradient-text">纪律执行</span>中塑造你的人格韧性
            </Title>
            <Paragraph className="fitness-hero-desc">
              每一次坚持都是纪律性的样本，每一次计划偏离都是灵活性的体现。系统追踪完成率、强度偏差、修改次数，构建你的「自律画像。
            </Paragraph>
            <Space size="middle">
              <Button type="primary" size="large" icon={<PlayCircleOutlined />} className="quick-start-btn" onClick={() => setActiveTab('trainer')}>开始训练</Button>
              <Select defaultValue="strength" style={{ width: 140 }} size="large">
                {Object.values(TRAINING_TYPES).map(t => (
                <Option key={t.key} value={t.key}>{t.icon} {t.label}</Option>
              ))}
            </Select>
            </Space>
          </div>
          <div className="fitness-hero-stats">
            <div className="fitness-hero-stat">
              <span className="stat-emoji">🏋️</span>
              <span className="stat-value">{mockStats.totalSessions}</span>
              <span className="stat-label">训练场次</span>
            </div>
            <div className="fitness-hero-stat">
              <span className="stat-emoji">✅</span>
              <span className="stat-value">{(mockStats.avgCompletion * 100).toFixed(0)}%</span>
              <span className="stat-label">平均完成率</span>
            </div>
            <div className="fitness-hero-stat">
              <span className="stat-emoji">🔥</span>
              <span className="stat-value">{mockStats.avgIntensity}%</span>
              <span className="stat-label">平均强度</span>
            </div>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]} className="fitness-stats-row">
        <Col xs={12} md={6}><Card className="fitness-stat-card"><Statistic title={<span><ClockCircleOutlined /> 平均时长</span>} value={mockStats.avgDuration} suffix="分钟" valueStyle={{ color: '#8b5cf6' }} /></Card></Col>
        <Col xs={12} md={6}><Card className="fitness-stat-card"><Statistic title={<span><SafetyOutlined /> 一致性</span>} value={mockStats.consistency * 100} precision={0} suffix="%" valueStyle={{ color: '#ec4899' }} /></Card></Col>
        <Col xs={12} md={6}><Card className="fitness-stat-card"><Statistic title={<span><TrophyOutlined /> 最佳连续</span>} value={mockStats.bestStreak} suffix="天" valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col xs={12} md={6}><Card className="fitness-stat-card"><Statistic title={<span><RiseOutlined /> 累计动作</span>} value={mockStats.totalExercises} valueStyle={{ color: '#06b6d4' }} /></Card></Col>
      </Row>

      <Card title={<span><DatabaseOutlined /> 你的哪些数据会被记录？</span>} className="fitness-data-info-card" extra={<Tooltip title="所有数据仅用于本地人格建模，不会上传"><InfoCircleOutlined style={{ color: '#8b5cf6' }} /></Tooltip>}>
        <Row gutter={[16, 16]}>
          {COLLECTED_DATA_TYPES.map(item => (
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

  const renderStats = () => (
    <div className="fitness-stats-page">
      <Card className="fitness-profit-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div className="stats-section">
              <Text type="secondary">训练总览</Text>
              <Title level={2} style={{ margin: 0 }}>{mockStats.totalSessions} 场</Title>
              <Tag color={mockStats.isWinStreak ? 'green' : 'red'}>
                {mockStats.isWinStreak ? <RiseOutlined /> : <FallOutlined />}
                {' '}连续 {mockStats.currentStreak} 天
              </Tag>
            </div>
          </Col>
          <Col xs={12} md={4}><Statistic title="平均完成率" value={mockStats.avgCompletion * 100} suffix="%" valueStyle={{ color: '#22c55e' }} /></Col>
          <Col xs={12} md={4}><Statistic title="平均强度" value={mockStats.avgIntensity} suffix="%" valueStyle={{ color: '#8b5cf6' }} /></Col>
          <Col xs={12} md={4}><Statistic title="平均时长" value={mockStats.avgDuration} suffix="分钟" valueStyle={{ color: '#ec4899' }} /></Col>
          <Col xs={12} md={4}><Statistic title="一致性" value={mockStats.consistency * 100} suffix="%" valueStyle={{ color: '#f97316' }} /></Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={<span><LineChartOutlined /> 核心指标</span>} className="fitness-stats-card">
            <List
              dataSource={[
                { label: '计划完成率', value: mockStats.avgCompletion, target: '80%-100%' },
                { label: '强度达标率', value: mockStats.avgIntensity / 100, target: '65%-80%' },
                { label: '时间一致性', value: mockStats.consistency, target: '>70%' },
                { label: '训练频率', value: 0.75, target: '3-5次/周' },
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
          <Card title={<span><FireOutlined /> 行为标签</span>} className="fitness-stats-card">
            <div className="behavior-tags">
              <Tag color="green" icon={<CheckCircleOutlined />} className="behavior-tag">✅ 高自律型</Tag>
              <Tag color="orange" icon={<FireOutlined />} className="behavior-tag">🔥 强度稳定</Tag>
              <Tag color="blue" icon={<ClockCircleOutlined />} className="behavior-tag">⏱️ 时间管理良好</Tag>
              <Tag color="purple" icon={<SafetyOutlined />} className="behavior-tag">🛡️ 计划执行力强</Tag>
              <Tag color="cyan" icon={<RiseOutlined />} className="behavior-tag">📈 进步趋势</Tag>
            </div>
            <Divider />
            <div className="mbti-mapping">
              <Text type="secondary">基于当前行为模式的 MBTI 推断：</Text>
              <div className="mbti-mapping-row">
                <Tag color="purple" className="mbti-tag">ESTJ</Tag>
                <Text type="secondary">置信度 65%</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>提示：更多训练数据将提升人格画像准确度</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title={<span><ClockCircleOutlined /> 历史训练记录</span>} className="fitness-stats-card">
        {historySessions.length === 0 ? (
          <Empty description="暂无训练记录，开始训练后会保存每一次的数据" />
        ) : (
          <List
            dataSource={[...historySessions].reverse()}
            renderItem={(session, idx) => (
              <List.Item>
                <Space>
                  <Avatar style={{ backgroundColor: '#7c3aed' }}>{idx + 1}</Avatar>
                  <Text>{TRAINING_TYPES[session.trainingType]?.label || '训练'} - {session.mood?.summary || '完成'}</Text>
                  <Tag color="green">完成率 {session.deviation?.completionRate || 0}%</Tag>
                  <Tag color="blue">{session.execution?.completionTime || 0}分钟</Tag>
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
    <div className="fitness-behavior-page">
      <Card className="behavior-overview-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">🏋️</span>
              <div>
                <Text type="secondary">已采集训练样本</Text>
                <Title level={3} style={{ margin: 0 }}>{mockStats.totalSessions}</Title>
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
                <Title level={3} style={{ margin: 0 }}>65%</Title>
                <Progress percent={65} size="small" strokeColor="#8b5cf6" showInfo={false} />
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
                  <Progress percent={Math.floor(Math.random() * 40 + 50)} size="small" showInfo={false} />
                  <Text type="secondary" style={{ fontSize: 12 }}>样本充足度</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title={<span><InfoCircleOutlined /> 数据如何被使用？</span>} className="behavior-dataflow-card">
        <div className="dataflow-steps">
          <div className="dataflow-step"><div className="dataflow-step-icon">💪</div><div className="dataflow-step-content"><Text strong>Step 1: 训练中采集</Text><Paragraph type="secondary">每一组动作完成、强度选择、计划修改都被记录</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">📊</div><div className="dataflow-step-content"><Text strong>Step 2: 自律性分析</Text><Paragraph type="secondary">计算完成率、一致性、强度偏差、计划修改频率</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">🧠</div><div className="dataflow-step-content"><Text strong>Step 3: 人格画像映射</Text><Paragraph type="secondary">完成率→J/P维度，强度偏差→T/F维度，一致性→稳定性</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">✨</div><div className="dataflow-step-content"><Text strong>Step 4: 个性化反馈</Text><Paragraph type="secondary">生成训练建议、自律性培养方案、健康人格反馈</Paragraph></div></div>
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
    <div className="fitness-page">
      <div className="fitness-page-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>返回首页</Button>
        <Title level={4} style={{ margin: 0 }}>
          <span className="gradient-text">💪 健身计划</span>
          <Text type="secondary" style={{ marginLeft: 12, fontWeight: 'normal' }}>
            自律性与执行风格的行为采集入口
          </Text>
        </Title>
        <Space><Badge status="success" text="采样中" /></Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className="fitness-tabs"
        items={[
          { key: 'lobby', label: <span><PlayCircleOutlined /> 入口大厅</span> },
          { key: 'trainer', label: <span><TrophyOutlined /> 健身训练</span> },
          { key: 'stats', label: <span><LineChartOutlined /> 数据统计</span> },
          { key: 'behavior', label: <span><DatabaseOutlined /> 行为采集</span> },
        ]}
      />

      {activeTab === 'lobby' && renderLobby()}
      {activeTab === 'trainer' && <FitnessTrainer />}
      {activeTab === 'stats' && renderStats()}
      {activeTab === 'behavior' && renderBehavior()}
    </div>
  );
};

export default FitnessPage;
