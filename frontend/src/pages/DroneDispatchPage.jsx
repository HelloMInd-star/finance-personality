import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Slider,
  InputNumber,
  Row,
  Col,
  Space,
  Typography,
  Tag,
  Divider,
  Progress,
  Statistic,
  Segmented,
  Alert,
  Radio,
  message,
} from 'antd';
import {
  SafetyCertificateOutlined,
  ThunderboltTwoTone,
  EnvironmentOutlined,
  RocketOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import {
  generateDispatchPlan,
  getStrategiesByMode,
  getDefaultState,
  DISPATCH_MODES,
  DISPATCH_MODE_LABELS,
} from '../utils/dispatchEngine';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';
import {
  generateDispatchDecision,
  dispatcherEngine,
} from '../utils/dispatcherEngine';

const { Title, Text, Paragraph } = Typography;

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981',
};

const PRIORITY_LABELS = {
  high: '🔴 高优先级',
  medium: '🟡 中优先级',
  low: '🟢 低优先级',
};

const DroneDispatchPage = () => {
  const [mode, setMode] = useState(DISPATCH_MODES.SINGLE);
  const [state, setState] = useState(getDefaultState(DISPATCH_MODES.SINGLE));
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState(getStrategiesByMode(DISPATCH_MODES.SINGLE));

  // ===== 金融决策引擎（P1） =====
  const [history, setHistory] = useState(() => {
    const h = storage.get('droneDispatchHistory');
    return Array.isArray(h) ? h : [];
  });

  // 从场景状态构造金融引擎输入
  const buildFinInput = (mode, state, history) => {
    const s = state || {};
    let scenario = {};
    let envType = dispatcherEngine.ENV_TYPES.GENERAL;

    if (mode === DISPATCH_MODES.SINGLE) {
      const windRisk = Math.min(0.4, (s.windSpeed || 0) * 0.025);
      const obstacleRisk = (s.obstacleDistance || 300) < 50 ? 0.3 : (s.obstacleDistance || 300) < 120 ? 0.15 : 0;
      const batteryRisk = (s.battery || 85) < 20 ? 0.25 : (s.battery || 85) < 40 ? 0.1 : 0;
      const risk = dispatcherEngine.clamp(0.15 + windRisk + obstacleRisk + batteryRisk, 0, 1);
      scenario = {
        successRateHistorical: dispatcherEngine.clamp(1 - risk, 0, 1),
        environmentalRisk: risk,
        resourceAvailability: dispatcherEngine.clamp((s.battery || 85) / 100, 0, 1),
        urgency: dispatcherEngine.clamp(0.3 + (1 - (s.battery || 85) / 100) * 0.5, 0, 1),
        battery: s.battery,
        windSpeed: s.windSpeed,
        distance: s.obstacleDistance,
      };
      envType = (s.windSpeed || 0) >= 10 || (s.obstacleDistance || 300) < 80
        ? dispatcherEngine.ENV_TYPES.DYNAMIC
        : dispatcherEngine.ENV_TYPES.GENERAL;
    } else if (mode === DISPATCH_MODES.LOGISTICS) {
      const trafficRisk = s.trafficStatus === 'congested' ? 0.6 : s.trafficStatus === 'moderate' ? 0.35 : 0.15;
      const lowInv = (s.inventory || []).filter(i => i.level < 20).length;
      const risk = dispatcherEngine.clamp(0.15 + trafficRisk + lowInv * 0.1, 0, 1);
      scenario = {
        successRateHistorical: dispatcherEngine.clamp(1 - risk, 0, 1),
        environmentalRisk: risk,
        resourceAvailability: dispatcherEngine.clamp((s.availableVehicles || 4) / 20, 0, 1),
        urgency: dispatcherEngine.clamp((s.orderCount || 12) / 100, 0, 1),
      };
      envType = dispatcherEngine.ENV_TYPES.GENERAL;
    } else {
      const fire = (s.fireLevel || 0) / 10;
      const water = (s.waterLevel || 0) / 10;
      const comm = s.communicationStatus === 'interrupted' ? 0.3 : 0;
      const risk = dispatcherEngine.clamp((fire + water + comm) / 2, 0, 1);
      scenario = {
        successRateHistorical: dispatcherEngine.clamp(1 - risk + 0.2, 0, 1),
        environmentalRisk: dispatcherEngine.clamp(risk, 0, 1),
        resourceAvailability: s.communicationStatus === 'normal' ? 0.7 : 0.3,
        urgency: dispatcherEngine.clamp(((s.trappedPeople || 0) / 200 + (s.supplyShortage || 0) / 1000) / 2, 0, 1),
      };
      envType = dispatcherEngine.ENV_TYPES.DYNAMIC;
    }

    return { scenarioState: scenario, history, envType };
  };

  // 金融决策（实时，随状态/历史变化）
  const finDecision = useMemo(() => {
    const input = buildFinInput(mode, state, history);
    return generateDispatchDecision(input);
  }, [mode, state, history]);

  // 模式切换
  const handleModeChange = (newMode) => {
    logger.session('[无人机调度] 切换模式', newMode);
    setMode(newMode);
    setState(getDefaultState(newMode));
    setStrategies(getStrategiesByMode(newMode));
    setPlan(null);
  };

  // 更新状态字段
  const updateField = (key, value) => {
    setState(prev => ({ ...prev, [key]: value }));
  };

  // 生成调度方案
  const handleGenerate = async () => {
    logger.session('[无人机调度] 生成方案', { mode, state });
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const result = generateDispatchPlan(mode, state);

      if (!result) {
        message.warning('无法生成调度方案');
        return;
      }

      setPlan(result);

      // 追加本次决策到历史（供三周期锚定累积）
      // 冷启动：首次无历史时决策概率为 0，改用场景成功率 1-风险 作为首个样本，避免锚定永远为 0
      const empiricalRate = finDecision.decisionSignal.probability > 0
        ? finDecision.decisionSignal.probability
        : 1 - finDecision.risk;
      const successEntry = { t: Date.now(), rate: Math.round(empiricalRate * 100) / 100 };
      const nextHistory = [...history, successEntry].slice(-50);
      setHistory(nextHistory);
      storage.set('droneDispatchHistory', nextHistory);

      storage.set('droneDispatchData', {
        mode,
        state,
        plan: result,
        updatedAt: Date.now(),
      });

      message.success(`【${DISPATCH_MODE_LABELS[mode].label}】${result.strategyName} 方案已生成`);
    } catch (err) {
      logger.error('[无人机调度] 生成失败', err);
      message.error('生成调度方案时出错');
    } finally {
      setLoading(false);
    }
  };

  // 恢复默认
  const handleReset = () => {
    setState(getDefaultState(mode));
    setPlan(null);
    message.info('已恢复默认参数');
  };

  // 优先级标签
  const renderPriorityTag = (priority) => (
    <Tag color={PRIORITY_COLORS[priority]} style={{ fontSize: 13, padding: '2px 10px' }}>
      {PRIORITY_LABELS[priority]}
    </Tag>
  );

  // 渲染通用飞行状态输入
  const renderFlightInputs = () => (
    <Row gutter={[24, 20]}>
      <Col xs={24} md={12}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          📏 飞行高度：<Text type="secondary">{state.altitude} m</Text>
        </Text>
        <Slider min={0} max={300} value={state.altitude} onChange={v => updateField('altitude', v)}
          marks={{ 0: '0', 100: '100', 200: '200', 300: '300' }} />
      </Col>
      <Col xs={24} md={12}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          💨 飞行速度：<Text type="secondary">{state.speed} m/s</Text>
        </Text>
        <Slider min={0} max={25} value={state.speed} onChange={v => updateField('speed', v)}
          marks={{ 0: '0', 5: '5', 10: '10', 15: '15', 20: '20', 25: '25' }} />
      </Col>
      <Col xs={24} md={12}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          🔋 剩余电量：<Text type="secondary">{state.battery}%</Text>
        </Text>
        <Slider min={0} max={100} value={state.battery} onChange={v => updateField('battery', v)}
          marks={{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }} />
        {state.battery < 20 && (
          <Alert type="error" showIcon message="低电量警告" description="电量不足 20%，可能触发应急降落" style={{ marginTop: 4, fontSize: 12 }} />
        )}
      </Col>
      <Col xs={24} md={12}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          🌬️ 当前风速：<Text type="secondary">{state.windSpeed} m/s</Text>
        </Text>
        <Slider min={0} max={20} value={state.windSpeed} onChange={v => updateField('windSpeed', v)}
          marks={{ 0: '0', 5: '5', 10: '10', 15: '15', 20: '20' }} />
        {state.windSpeed >= 10 && (
          <Alert type="warning" showIcon message="强风警告" description="风速过高，可能触发应急策略" style={{ marginTop: 4, fontSize: 12 }} />
        )}
      </Col>
      <Col xs={24}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          🚧 最近障碍物距离：<Text type="secondary">{state.obstacleDistance} m</Text>
        </Text>
        <Slider min={0} max={500} value={state.obstacleDistance} onChange={v => updateField('obstacleDistance', v)}
          marks={{ 0: '0', 50: '50', 100: '100', 200: '200', 300: '300', 500: '500+' }} />
        {state.obstacleDistance < 50 && (
          <Alert type="error" showIcon message="障碍物过近" description="距离障碍物不足 50m，系统将自动触发避障" style={{ marginTop: 4, fontSize: 12 }} />
        )}
      </Col>
    </Row>
  );

  // 渲染物流供应链输入
  const renderLogisticsInputs = () => (
    <Row gutter={[24, 20]} style={{ marginTop: 4 }}>
      <Col xs={24} md={8}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          📦 待处理订单：<Text type="secondary">{state.orderCount} 单</Text>
        </Text>
        <Slider min={0} max={100} value={state.orderCount} onChange={v => updateField('orderCount', v)}
          marks={{ 0: '0', 20: '20', 50: '50', 80: '80', 100: '100+' }} />
      </Col>
      <Col xs={24} md={8}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          🚛 可用车辆：<Text type="secondary">{state.availableVehicles} 辆</Text>
        </Text>
        <Slider min={0} max={20} value={state.availableVehicles} onChange={v => updateField('availableVehicles', v)}
          marks={{ 0: '0', 5: '5', 10: '10', 15: '15', 20: '20' }} />
      </Col>
      <Col xs={24} md={8}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>🚦 路况状态</Text>
        <Radio.Group value={state.trafficStatus} onChange={e => updateField('trafficStatus', e.target.value)}>
          <Radio value="smooth">顺畅</Radio>
          <Radio value="moderate">一般</Radio>
          <Radio value="congested">拥堵</Radio>
        </Radio.Group>
      </Col>
      <Col xs={24}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>🏪 各仓库库存水位</Text>
        <Row gutter={[16, 8]}>
          {state.inventory?.map((inv, idx) => (
            <Col xs={24} sm={12} md={8} key={idx}>
              <div style={{ padding: 12, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }}>
                <Text style={{ color: '#fff' }}>{inv.location}</Text>
                <Progress percent={inv.level}
                  status={inv.level < 20 ? 'exception' : inv.level < 50 ? 'active' : 'success'}
                  style={{ marginTop: 4 }} />
              </div>
            </Col>
          ))}
        </Row>
      </Col>
    </Row>
  );

  // 渲染应急灾害输入
  const renderEmergencyInputs = () => (
    <Row gutter={[24, 20]} style={{ marginTop: 4 }}>
      <Col xs={24} md={8}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>🌋 灾害类型</Text>
        <Radio.Group value={state.disasterType} onChange={e => updateField('disasterType', e.target.value)}>
          <Radio value="fire">🔥 火灾</Radio>
          <Radio value="flood">🌊 洪水</Radio>
          <Radio value="earthquake">🌍 地震</Radio>
          <Radio value="other">⚠️ 其他</Radio>
        </Radio.Group>
      </Col>
      <Col xs={24} md={8}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          🔥 火势等级：<Text type="secondary">{state.fireLevel || 0}/10</Text>
        </Text>
        <Slider min={0} max={10} value={state.fireLevel || 0} onChange={v => updateField('fireLevel', v)} />
      </Col>
      <Col xs={24} md={8}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          🌊 水位等级：<Text type="secondary">{state.waterLevel || 0}/10</Text>
        </Text>
        <Slider min={0} max={10} value={state.waterLevel || 0} onChange={v => updateField('waterLevel', v)} />
      </Col>
      <Col xs={24} md={8}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          👥 被困人员：<Text type="secondary">{state.trappedPeople || 0} 人</Text>
        </Text>
        <Slider min={0} max={200} value={state.trappedPeople || 0} onChange={v => updateField('trappedPeople', v)}
          marks={{ 0: '0', 50: '50', 100: '100', 200: '200' }} />
      </Col>
      <Col xs={24} md={8}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          🎁 物资缺口：<Text type="secondary">{state.supplyShortage || 0} 份</Text>
        </Text>
        <Slider min={0} max={1000} value={state.supplyShortage || 0} onChange={v => updateField('supplyShortage', v)}
          marks={{ 0: '0', 200: '200', 500: '500', 1000: '1000' }} />
      </Col>
      <Col xs={24} md={8}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>📡 通信状态</Text>
        <Radio.Group value={state.communicationStatus} onChange={e => updateField('communicationStatus', e.target.value)}>
          <Radio value="normal">正常</Radio>
          <Radio value="interrupted">中断</Radio>
        </Radio.Group>
      </Col>
      <Col xs={24}>
        <Text style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
          🏠 需安置群众：<Text type="secondary">{state.displacedPeople || 0} 人</Text>
        </Text>
        <Slider min={0} max={1000} value={state.displacedPeople || 0} onChange={v => updateField('displacedPeople', v)}
          marks={{ 0: '0', 200: '200', 500: '500', 1000: '1000' }} />
      </Col>
    </Row>
  );

  // 渲染金融决策面板（P1）
  const renderFinPanel = () => {
    const d = finDecision;
    const zone = d.cognitiveZoneLabel;
    const recMap = {
      execute: { label: '立即执行', color: '#10b981' },
      defer: { label: '延迟执行', color: '#f59e0b' },
      abort: { label: '放弃执行', color: '#ef4444' },
    };
    const rec = recMap[d.decisionSignal.recommendation] || recMap.defer;
    const seed = d.anchoring;
    const cov = d.covariance;

    return (
      <Card
        title={<span style={{ color: '#fff' }}>🧠 金融决策引擎（Y.Mine 芯片）</span>}
        style={{ marginBottom: 24, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
        extra={<Tag color={zone.color} style={{ fontSize: 13 }}>{zone.emoji} {zone.label}</Tag>}
      >
        {/* 决策信号 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>综合评分 Score</span>}
              value={d.decisionSignal.score.toFixed(3)}
              valueStyle={{ color: '#a78bfa', fontSize: 24 }} />
          </Col>
          <Col xs={12} sm={6}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>成功概率 P = 1-e^(-Score)</Text>
              <Progress
                percent={Math.round(d.decisionSignal.probability * 100)}
                strokeColor={d.decisionSignal.probability >= 0.366 ? '#a78bfa' : '#ef4444'}
                status={d.decisionSignal.probability >= 0.6 ? 'success' : d.decisionSignal.probability >= 0.4 ? 'active' : 'exception'} />
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>{(d.decisionSignal.probability * 100).toFixed(1)}%</Text>
              <Text type="secondary" style={{ fontSize: 11 }}> 1/e 基准：36.8%</Text>
            </div>
          </Col>
          <Col xs={8} sm={3}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>置信度</span>}
              value={(d.confidence * 100).toFixed(0)} suffix="%"
              valueStyle={{ color: '#10b981', fontSize: 22 }} />
          </Col>
          <Col xs={8} sm={3}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>感知风险 σ</span>}
              value={(d.risk * 100).toFixed(0)} suffix="%"
              valueStyle={{ color: '#f59e0b', fontSize: 22 }} />
          </Col>
          <Col xs={8} sm={6}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>调度信号 S</span>}
              value={d.signal.toFixed(3)}
              valueStyle={{ color: d.signalCategory.emoji === '⛔' ? '#ef4444' : '#a78bfa', fontSize: 24 }}
              suffix={<span style={{ fontSize: 18 }}>{d.signalCategory.emoji} {d.signalCategory.label}</span>} />
          </Col>
        </Row>

        {/* 认知画圈 + 三周期锚定 */}
        <Divider orientation="left" plain
          style={{ borderColor: 'rgba(139,92,246,0.2)', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          {zone.emoji} 认知画圈：{zone.label}（{zone.description}）· 推荐：{rec.label}
        </Divider>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {[
            { key: 'longTerm', label: '长期锚定 R_f', sub: '指数衰减 e^-λΔt' },
            { key: 'mediumTerm', label: '中期锚定 R_m', sub: `最近 ${seed.mediumTerm.windowSize} 天窗口` },
            { key: 'shortTerm', label: '短期锚定 R_l', sub: '当日K线' },
          ].map(item => (
            <Col xs={8} key={item.key}>
              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{item.label} · {item.sub}</Text>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: 600 }}>{(seed[item.key].mean * 100).toFixed(1)}%</Text>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>σ² = {(seed[item.key].variance * 100).toFixed(2)}%</Text>
              </div>
            </Col>
          ))}
        </Row>

        {/* β + 协方差矩阵 */}
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>β 系数（稳定性钳制 ±2）</Text>
            <Space size="large">
              <Tag color="purple" style={{ fontSize: 13 }}>βm(中期) = {cov.beta.medium.toFixed(3)}</Tag>
              <Tag color="geekblue" style={{ fontSize: 13 }}>βl(短期) = {cov.beta.short.toFixed(3)}</Tag>
            </Space>
            <Paragraph style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>
              短期 vs 长期：{cov.interpretation.covFL}；策略环境：{cov.interpretation.covML}
            </Paragraph>
          </Col>
          <Col xs={24} md={12}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>3×3 协方差矩阵</Text>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ color: 'rgba(255,255,255,0.5)', padding: 4, border: '1px solid rgba(139,92,246,0.2)' }}></th>
                  {['R_f', 'R_m', 'R_l'].map(h => (
                    <th key={h} style={{ color: 'rgba(255,255,255,0.5)', padding: 4, border: '1px solid rgba(139,92,246,0.2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cov.matrix.map((row, ri) => (
                  <tr key={ri}>
                    <td style={{ color: 'rgba(255,255,255,0.5)', padding: 4, border: '1px solid rgba(139,92,246,0.2)' }}>{['R_f', 'R_m', 'R_l'][ri]}</td>
                    {row.map((v, ci) => (
                      <td key={ci} style={{ color: '#fff', padding: 4, border: '1px solid rgba(139,92,246,0.2)', textAlign: 'center' }}>
                        {v.toFixed(4)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Col>
        </Row>

        {/* 情绪校准 + 推理 */}
        <Divider style={{ borderColor: 'rgba(139,92,246,0.2)', margin: '16px 0' }} />
        <Row gutter={[16, 12]}>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>🧬 情绪校准（Y.Mine 人格联动）</Text>
            <Space wrap>
              <Tag color="cyan">风险偏移 {d.emotionalCalibration.riskAppetiteShift >= 0 ? '+' : ''}{d.emotionalCalibration.riskAppetiteShift.toFixed(2)}</Tag>
              <Tag color="green">置信乘数 ×{d.emotionalCalibration.confidenceMultiplier.toFixed(2)}</Tag>
            </Space>
          </Col>
          <Col xs={24} md={16}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              🔍 推理：主导因子「{d.reasoning.primaryFactor}」（{d.reasoning.confidenceLevel === 'high' ? '高' : d.reasoning.confidenceLevel === 'medium' ? '中' : '低'}置信）
            </Text>
            <Paragraph style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, margin: 0 }}>{d.reasoning.explanation}</Paragraph>
          </Col>
        </Row>
      </Card>
    );
  };

  // 渲染方案输出
  const renderPlanOutput = () => {
    if (!plan) return null;

    const action = plan.action;
    const modeLabel = DISPATCH_MODE_LABELS[plan.mode];

    return (
      <Card
        title={<span style={{ color: '#fff' }}>{plan.strategyEmoji} {modeLabel.label}调度方案</span>}
        style={{ marginBottom: 24, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Row gutter={[24, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>匹配策略</span>}
              value={plan.strategyName}
              prefix={<span style={{ fontSize: 20 }}>{plan.strategyEmoji}</span>}
              valueStyle={{ color: '#a78bfa', fontSize: 18 }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>置信度</span>}
              value={plan.confidence} suffix="%"
              valueStyle={{ color: plan.confidence >= 80 ? '#10b981' : '#f59e0b', fontSize: 28 }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>优先级</Text>
              {renderPriorityTag(action.priority)}
            </div>
          </Col>
        </Row>

        <div style={{ padding: 16, borderRadius: 8, background: 'rgba(139,92,246,0.1)', borderLeft: '3px solid #a78bfa', marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>推理过程：</Text>
          <Paragraph style={{ color: '#fff', fontSize: 14, margin: '4px 0 0' }}>{plan.reasoning}</Paragraph>
        </div>

        <div style={{ padding: 20, borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', marginBottom: 16 }}>
          <Space align="center" style={{ marginBottom: 12 }}>
            <RocketOutlined style={{ fontSize: 24, color: '#10b981' }} />
            <Text style={{ color: '#10b981', fontSize: 18, fontWeight: 600 }}>执行指令</Text>
          </Space>
          <Paragraph style={{ color: '#fff', fontSize: 18, fontWeight: 500, margin: 0 }}>{action.instruction}</Paragraph>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: 'center', padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <SafetyCertificateOutlined style={{ fontSize: 20, color: '#10b981' }} />
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>{plan.scores.safetyScore}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>安全得分</Text>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: 'center', padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <ThunderboltTwoTone style={{ fontSize: 20 }} />
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>{plan.scores.enduranceScore}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>续航得分</Text>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: 'center', padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <EnvironmentOutlined style={{ fontSize: 20, color: '#f59e0b' }} />
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>{plan.scores.efficiencyScore}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>效率得分</Text>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ textAlign: 'center', padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <FieldTimeOutlined style={{ fontSize: 20, color: '#a78bfa' }} />
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>
                {action.estimatedTime >= 60 ? `${(action.estimatedTime / 60).toFixed(1)}h` : `${action.estimatedTime}min`}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>预计完成</Text>
            </div>
          </Col>
        </Row>

        {action.remark && (
          <Alert type="info" showIcon message="说明" description={action.remark} style={{ fontSize: 13 }} />
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px 0', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ color: '#fff', margin: 0 }}>
          <RocketOutlined style={{ marginRight: 12 }} />
          无人机调度系统
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8, fontSize: 15 }}>
          状态采集 → 策略库匹配 → 调度方案输出（三层输出模式）
        </Paragraph>
      </div>

      {/* AirMind OS 升级横幅 */}
      <div style={{ maxWidth: 860, margin: '0 auto 20px', padding: '12px 18px', borderRadius: 12, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(167,139,250,0.4)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <span style={{ color: '#e8edff', fontSize: 13 }}>
          🛩️ 本模块已升级为独立系统 <strong style={{ color: '#c4b5fd' }}>AirMind OS</strong>：博弈定价 · 空域精算 · 应急六策略 · 算力浓度监控
        </span>
        <a href="https://hellomind-star.github.io/airmind-os/" target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          前往完整版 ↗
        </a>
      </div>

      {/* 模式切换 */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Segmented
          size="large"
          value={mode}
          onChange={handleModeChange}
          options={Object.entries(DISPATCH_MODE_LABELS).map(([key, val]) => ({
            label: `${val.emoji} ${val.label}`,
            value: key,
          }))}
          style={{ background: 'rgba(124,58,237,0.15)', padding: 4 }}
        />
        <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
          {DISPATCH_MODE_LABELS[mode].description}
        </div>
      </div>

      {/* 策略库展示 */}
      <Card
        title={<span style={{ color: '#fff' }}>📚 策略库（{DISPATCH_MODE_LABELS[mode].label}）</span>}
        style={{ marginBottom: 24, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Row gutter={[16, 16]}>
          {strategies.map(s => (
            <Col xs={24} sm={12} lg={8} key={s.id}>
              <div style={{ padding: 14, borderRadius: 8, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.15)', height: '100%' }}>
                <Space align="center" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 26 }}>{s.emoji}</span>
                  <div>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{s.name}</Text>
                    <Tag color="purple" style={{ marginLeft: 8 }}>{s.type}</Tag>
                  </div>
                </Space>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{s.description}</Text>
                <Text style={{ color: '#a78bfa', fontSize: 12 }}>核心：{s.coreLogic}</Text>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 状态输入 */}
      <Card
        title={<span style={{ color: '#fff' }}>🎛️ 状态输入</span>}
        style={{ marginBottom: 24, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        {renderFlightInputs()}

        {mode === DISPATCH_MODES.LOGISTICS && (
          <>
            <Divider style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
              <Tag color="orange">物流扩展参数</Tag>
            </Divider>
            {renderLogisticsInputs()}
          </>
        )}

        {mode === DISPATCH_MODES.EMERGENCY && (
          <>
            <Divider style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
              <Tag color="red">应急扩展参数</Tag>
            </Divider>
            {renderEmergencyInputs()}
          </>
        )}

        <Divider style={{ borderColor: 'rgba(139,92,246,0.2)', margin: '20px 0' }} />

        <Space>
          <Button type="primary" size="large" onClick={handleGenerate} loading={loading} icon={<RocketOutlined />}>
            {loading ? '分析中...' : '🚀 生成调度方案'}
          </Button>
          <Button size="large" onClick={handleReset}>恢复默认</Button>
        </Space>
      </Card>

      {/* 金融决策面板（实时） */}
      {renderFinPanel()}

      {/* 方案输出 */}
      {renderPlanOutput()}
    </div>
  );
};

export default DroneDispatchPage;
