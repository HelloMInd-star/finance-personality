import React, { useState, useEffect } from 'react';
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
  Radio
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
  MinusOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  fitnessEngine,
  TRAINING_TYPES,
  FATIGUE_LEVELS
} from '../utils/fitnessEngine';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';

const { Title, Text, Paragraph } = Typography;

const STEPS = [
  { key: 'select', title: '选择训练类型' },
  { key: 'plan', title: '设定计划' },
  { key: 'execute', title: '执行训练' },
  { key: 'feedback', title: '偏差反馈' },
];

const FitnessPage = () => {
  const navigate = useNavigate();

  // 流程状态
  const [stage, setStage] = useState('select'); // select/plan/execute/feedback/finished
  const [trainingType, setTrainingType] = useState(null);

  // 计划
  const [plan, setPlan] = useState(null);
  const [targetIntensity, setTargetIntensity] = useState(70);
  const [planModifications, setPlanModifications] = useState(0);

  // 执行
  const [execution, setExecution] = useState({
    completedSets: 0,
    currentExerciseIdx: 0,
    currentSetIdx: 0,
    actualReps: [],
    actualWeights: [],
    fatigue: 'low',
    startTime: null
  });

  // 偏差
  const [deviation, setDeviation] = useState(null);
  const [deviationTag, setDeviationTag] = useState(null);
  const [moodData, setMoodData] = useState(null);

  // 选择训练类型
  const handleSelectType = (key) => {
    setTrainingType(key);
    const newPlan = fitnessEngine.generatePlan(key);
    setPlan(newPlan);
    setTargetIntensity(newPlan.targetIntensity);
    setStage('plan');
    logger.session('健身-选择训练类型', TRAINING_TYPES[key].label);
  };

  // 开始执行
  const handleStartExecute = () => {
    setExecution({
      completedSets: 0,
      currentExerciseIdx: 0,
      currentSetIdx: 0,
      actualReps: [],
      actualWeights: plan.exercises.flatMap(e => Array(e.sets).fill(e.weight)),
      fatigue: 'low',
      startTime: Date.now()
    });
    setStage('execute');
    logger.session('健身-开始训练', { 类型: trainingType, 总组数: totalSets });
  };

  // 总组数
  const totalSets = plan?.exercises?.reduce((s, e) => s + e.sets, 0) || 0;

  // 完成一组
  const handleCompleteSet = (reps, weight) => {
    const newReps = [...execution.actualReps, reps];
    const newWeights = [...execution.actualWeights];
    const flatIdx = getFlatIndex();
    newWeights[flatIdx] = weight;

    // 检查是否修改了计划（重量变化）
    const exercise = plan.exercises[execution.currentExerciseIdx];
    if (weight !== exercise.weight) {
      setPlanModifications(c => c + 1);
    }
    if (reps !== exercise.repsPerSet?.[execution.currentSetIdx]) {
      setPlanModifications(c => c + 1);
    }

    const newCompleted = execution.completedSets + 1;
    setExecution({
      ...execution,
      actualReps: newReps,
      actualWeights: newWeights,
      completedSets: newCompleted
    });

    // 进入下一组或下一动作
    if (execution.currentSetIdx < exercise.sets - 1) {
      setExecution(s => ({ ...s, currentSetIdx: s.currentSetIdx + 1 }));
    } else if (execution.currentExerciseIdx < plan.exercises.length - 1) {
      setExecution(s => ({
        ...s,
        currentExerciseIdx: s.currentExerciseIdx + 1,
        currentSetIdx: 0
      }));
    } else {
      // 全部完成
      finishSession();
    }
  };

  // 跳过一组
  const handleSkipSet = () => {
    setPlanModifications(c => c + 1);
    handleCompleteSet(0, plan.exercises[execution.currentExerciseIdx].weight);
  };

  // 获取在扁平数组中的索引
  const getFlatIndex = () => {
    let idx = 0;
    for (let i = 0; i < execution.currentExerciseIdx; i++) {
      idx += plan.exercises[i].sets;
    }
    idx += execution.currentSetIdx;
    return idx;
  };

  // 结束训练
  const finishSession = (early = false) => {
    const completionTime = execution.startTime
      ? Math.round((Date.now() - execution.startTime) / 60000)
      : 0;

    const execData = {
      completedSets: execution.completedSets,
      totalSets,
      actualReps: execution.actualReps,
      actualWeight: execution.actualWeights,
      completionTime
    };

    const dev = fitnessEngine.calculateDeviation(plan, execData, planModifications);
    setDeviation(dev);

    const tag = fitnessEngine.generateDeviationTag(dev.completionRate, plan.targetIntensity);
    setDeviationTag(tag);

    const mood = fitnessEngine.generateFitnessMood({
      plan,
      execution: execData,
      deviation: dev,
      trainingType,
      fatigue: execution.fatigue
    });
    setMoodData(mood);

    // 存储数据
    const session = fitnessEngine.createFitnessSession({
      trainingType,
      plan,
      execution: execData,
      deviation: dev,
      mood,
      fatigue: execution.fatigue
    });
    storage.update('fitnessSessions', (prev) => [...(prev || []), session]);
    storage.update('psychologyProfile', (prev) => ({
      ...prev,
      fitnessMood: mood,
      lastFitnessTime: Date.now()
    }));
    storage.update('fitnessGames', (prev) => [...(prev || []), session]);

    logger.session('健身-训练结束', {
      完成率: dev.completionRate + '%',
      偏离类型: dev.deviationType,
      标签: tag.label
    });

    setStage(early ? 'feedback' : 'finished');
  };

  const handleEarlyEnd = () => {
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

  // ============== 渲染 ==============

  // 选择训练类型
  if (stage === 'select') {
    return (
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card size="small">
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
              <div>
                <Title level={4} style={{ margin: 0 }}>💪 健身计划 · 行为采集</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  目标执行 · 纪律性 · 计划偏离检测
                </Text>
              </div>
            </Space>
          </Card>

          <Title level={5} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
            选择训练类型
          </Title>

          <Row gutter={[16, 16]}>
            {Object.values(TRAINING_TYPES).map(t => (
              <Col xs={12} md={6} key={t.key}>
                <Card
                  hoverable
                  onClick={() => handleSelectType(t.key)}
                  style={{
                    borderColor: t.color + '66',
                    borderWidth: 2,
                    height: '100%',
                    textAlign: 'center'
                  }}
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

  // 设定计划
  if (stage === 'plan' && plan) {
    const typeInfo = TRAINING_TYPES[trainingType];
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card size="small">
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button onClick={() => setStage('select')}>← 返回</Button>
                <Tag color={typeInfo.color}>{typeInfo.icon} {typeInfo.label}训练</Tag>
              </Space>
              <Text type="secondary">Step 2/4 · 设定计划</Text>
            </Space>
          </Card>

          <Card title="动作计划">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {plan.exercises.map((ex, exIdx) => (
                <Card key={exIdx} size="small" type="inner">
                  <Row gutter={[16, 8]} align="middle">
                    <Col span={6}>
                      <Text strong>{ex.name}</Text>
                    </Col>
                    <Col span={6}>
                      <Text type="secondary">组数：{ex.sets}</Text>
                    </Col>
                    <Col span={6}>
                      <Text type="secondary">
                        每组次数：{ex.repsPerSet?.join('/') || '计时'}
                      </Text>
                    </Col>
                    <Col span={6}>
                      <Text type="secondary">
                        {ex.weight > 0 ? `${ex.weight}kg` : ex.duration ? `${ex.duration}分钟` : '自重'}
                      </Text>
                    </Col>
                  </Row>
                </Card>
              ))}
            </Space>
          </Card>

          <Card title="目标设置">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text type="secondary">目标强度：{targetIntensity}%</Text>
                <Slider
                  min={20}
                  max={100}
                  value={targetIntensity}
                  onChange={(v) => { setTargetIntensity(v); setPlanModifications(c => c + 1); }}
                  marks={{ 40: '低', 70: '中', 90: '高' }}
                />
              </Col>
              <Col span={12}>
                <Text type="secondary">休息间隔：{plan.restInterval}秒</Text>
                <Slider
                  min={30}
                  max={180}
                  step={15}
                  value={plan.restInterval}
                  onChange={(v) => setPlan({ ...plan, restInterval: v })}
                />
              </Col>
            </Row>
          </Card>

          <div style={{ textAlign: 'center' }}>
            <Button type="primary" size="large" onClick={handleStartExecute}>
              🏁 开始训练
            </Button>
          </div>
        </Space>
      </div>
    );
  }

  // 执行训练
  if (stage === 'execute' && plan) {
    const currentExercise = plan.exercises[execution.currentExerciseIdx];
    const flatIdx = getFlatIndex();
    const progress = totalSets > 0 ? (execution.completedSets / totalSets) * 100 : 0;
    const predictedCompletion = Math.round(
      (execution.completedSets + (totalSets - execution.completedSets) * 0.8) / totalSets * 100
    );

    const [tempReps, setTempReps] = useState(currentExercise.repsPerSet?.[execution.currentSetIdx] || 10);
    const [tempWeight, setTempWeight] = useState(currentExercise.weight || 0);

    useEffect(() => {
      setTempReps(currentExercise.repsPerSet?.[execution.currentSetIdx] || 10);
      setTempWeight(currentExercise.weight || 0);
    }, [execution.currentExerciseIdx, execution.currentSetIdx, plan]);

    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card size="small">
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Tag color={TRAINING_TYPES[trainingType].color}>
                  {TRAINING_TYPES[trainingType].icon} {TRAINING_TYPES[trainingType].label}
                </Tag>
                <Text>
                  第 {execution.completedSets + 1} / {totalSets} 组
                </Text>
              </Space>
              <Button danger size="small" onClick={handleEarlyEnd}>
                结束训练
              </Button>
            </Space>
            <Progress
              percent={Math.round(progress)}
              status={progress >= 100 ? 'success' : 'active'}
              style={{ marginTop: 12 }}
            />
          </Card>

          {/* 当前动作 */}
          <Card>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Text type="secondary">当前动作</Text>
              <Title level={3} style={{ margin: '4px 0' }}>{currentExercise.name}</Title>
              <Tag color="blue">
                第 {execution.currentSetIdx + 1} / {currentExercise.sets} 组
              </Tag>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="计划次数"
                    value={currentExercise.repsPerSet?.[execution.currentSetIdx] || '计时'}
                    suffix={currentExercise.duration ? '分钟' : '次'}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Statistic
                    title="计划重量"
                    value={currentExercise.weight || 0}
                    suffix={currentExercise.weight > 0 ? 'kg' : '自重'}
                  />
                </Card>
              </Col>
            </Row>

            <Divider>记录实际完成</Divider>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Text type="secondary">实际完成次数</Text>
                <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                  <Button onClick={() => setTempReps(r => Math.max(0, r - 1))}>
                    <MinusOutlined />
                  </Button>
                  <InputNumber
                    min={0}
                    max={50}
                    value={tempReps}
                    onChange={setTempReps}
                    style={{ width: '100%', textAlign: 'center' }}
                  />
                  <Button onClick={() => setTempReps(r => r + 1)}>
                    <PlusOutlined />
                  </Button>
                </Space.Compact>
              </Col>
              <Col span={12}>
                <Text type="secondary">实际重量 (kg)</Text>
                <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                  <Button onClick={() => setTempWeight(w => Math.max(0, w - 2.5))}>
                    <MinusOutlined />
                  </Button>
                  <InputNumber
                    min={0}
                    step={2.5}
                    value={tempWeight}
                    onChange={setTempWeight}
                    style={{ width: '100%', textAlign: 'center' }}
                  />
                  <Button onClick={() => setTempWeight(w => w + 2.5)}>
                    <PlusOutlined />
                  </Button>
                </Space.Compact>
              </Col>
            </Row>

            <Row gutter={[16, 8]} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Text type="secondary">当前疲劳度</Text>
                <div style={{ marginTop: 4 }}>
                  <Radio.Group
                    value={execution.fatigue}
                    onChange={(e) => setExecution({ ...execution, fatigue: e.target.value })}
                  >
                    {FATIGUE_LEVELS.map(f => (
                      <Radio.Button key={f.key} value={f.key}>
                        <span style={{ color: f.color }}>{f.label}</span>
                      </Radio.Button>
                    ))}
                  </Radio.Group>
                </div>
              </Col>
            </Row>

            <Space style={{ justifyContent: 'center', width: '100%' }}>
              <Button
                type="primary"
                size="large"
                onClick={() => handleCompleteSet(tempReps, tempWeight)}
                disabled={tempReps === 0}
              >
                ✓ 完成本组
              </Button>
              <Button size="large" onClick={handleSkipSet}>
                跳过本组
              </Button>
            </Space>
          </Card>

          {/* 进度检测 */}
          <Card size="small" title={<span><BulbOutlined style={{ color: '#D4AF37' }} /> 计划偏离检测</span>}>
            <Row gutter={[16, 8]}>
              <Col span={8}>
                <Statistic
                  title="当前完成率"
                  value={progress.toFixed(0)}
                  suffix="%"
                  valueStyle={{ color: progress >= 70 ? '#52c41a' : '#faad14', fontSize: 20 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="预测完成率"
                  value={predictedCompletion}
                  suffix="%"
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="计划修改次数"
                  value={planModifications}
                  valueStyle={{ color: planModifications > 2 ? '#faad14' : undefined, fontSize: 20 }}
                />
              </Col>
            </Row>
          </Card>
        </Space>
      </div>
    );
  }

  // 反馈 / 结束
  if ((stage === 'feedback' || stage === 'finished') && deviation && moodData) {
    const typeInfo = TRAINING_TYPES[trainingType];
    const isEarly = stage === 'feedback';

    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <Result
          icon={<TrophyOutlined style={{ color: isEarly ? '#faad14' : '#D4AF37' }} />}
          title={isEarly ? '训练已结束' : '训练完成！'}
          subTitle={moodData.summary}
          extra={[
            <Button type="primary" key="again" icon={<ReloadOutlined />} onClick={handleNewSession}>
              再来一次
            </Button>,
            <Button key="home" icon={<HomeOutlined />} onClick={() => navigate('/')}>
              返回首页
            </Button>
          ]}
        />

        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="完成率"
                value={deviation.completionRate}
                suffix="%"
                valueStyle={{
                  color: deviation.completionRate >= 90 ? '#52c41a' :
                         deviation.completionRate >= 70 ? '#faad14' : '#eb2f96',
                  fontSize: 24
                }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="完成组数"
                value={`${execution.completedSets}/${totalSets}`}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="修改次数"
                value={deviation.planModifications}
                valueStyle={{ fontSize: 24 }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="偏差分析" style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text type="secondary">偏离类型</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={
                  deviation.deviationType === 'none' ? 'green' :
                  deviation.deviationType === 'early_end' ? 'red' :
                  deviation.deviationType === 'reduced_intensity' ? 'orange' :
                  deviation.deviationType === 'extended' ? 'blue' : 'default'
                }>
                  {deviation.deviationType === 'none' ? <CheckCircleOutlined /> :
                   deviation.deviationType === 'early_end' ? '⏹ ' :
                   deviation.deviationType === 'reduced_intensity' ? <WarningOutlined /> :
                   deviation.deviationType === 'extended' ? '⬆ ' : ''}
                  {({
                    none: '完全按计划执行',
                    early_end: '提前结束',
                    reduced_intensity: '降低强度',
                    extended: '延长/加量',
                    increased_intensity: '增加强度'
                  })[deviation.deviationType] || deviation.deviationType}
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

        <Card title="心情盘" style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="情绪值"
                value={moodData.mood}
                suffix="%"
                prefix={<BulbOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="行业映射"
                value={moodData.industry}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="趋势"
                value={({
                  improving: '进步中',
                  stable: '稳定',
                  worsening: '需关注'
                })[moodData.trend] || moodData.trend}
                valueStyle={{
                  color: moodData.trend === 'improving' ? '#52c41a' :
                         moodData.trend === 'worsening' ? '#eb2f96' : undefined
                }}
              />
            </Col>
          </Row>
        </Card>
      </div>
    );
  }

  return null;
};

export default FitnessPage;
