import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CloseCircleOutlined,
  PlayCircleOutlined,
  LineChartOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  AimOutlined,
  RiseOutlined,
  FallOutlined,
  FireOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  billiardsEngine,
  TABLE,
  POCKETS,
} from '../utils/billiardsEngine';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';
import './BilliardsPage.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Canvas 缩放比例
const CANVAS_SCALE = 1;
const CANVAS_W = TABLE.width + TABLE.cushion * 2;
const CANVAS_H = TABLE.height + TABLE.cushion * 2;

const POWER_LABELS = { 20: '轻', 50: '中', 80: '重' };

// 行为采集数据类型
const COLLECTED_DATA_TYPES = [
  { key: 'aimAngle', icon: '🎯', title: '瞄准角度', desc: '每一杆的瞄准方向选择' },
  { key: 'power', icon: '💪', title: '力度控制', desc: '击球力度的选择（轻/中/重）' },
  { key: 'adjustmentCount', icon: '🔄', title: '修正次数', desc: '每次瞄准的调整次数，反映决策风格' },
  { key: 'aimDuration', icon: '⏱️', title: '瞄准耗时', desc: '思考时间，反映自信度与谨慎度' },
  { key: 'reflectionDeviation', icon: '📐', title: '折射偏差', desc: '预期与实际折射角度差，反映空间预判能力' },
  { key: 'deviationLevel', icon: '🏷️', title: '偏差等级', desc: '精准/偏差/失控，反映稳定性' },
  { key: 'shotType', icon: '🎲', title: '击球类型', desc: '进攻型/防守型，反映风险偏好' },
  { key: 'pocketRate', icon: '✅', title: '进球率', desc: '实际进球占比，反映执行能力' },
];

// ============= 训练核心组件 =============
const BilliardsTrainer = ({ onSessionEnd }) => {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // 游戏状态
  const [gameState, setGameState] = useState('aiming');
  const [shotCount, setShotCount] = useState(0);
  const [pocketedCount, setPocketedCount] = useState(0);
  const [shots, setShots] = useState([]);
  const [difficulty, setDifficulty] = useState('easy');

  // 球局数据
  const [rack, setRack] = useState(() => billiardsEngine.generateRack('easy'));
  const [displayCue, setDisplayCue] = useState(null);
  const [displayTargets, setDisplayTargets] = useState([]);

  // 瞄准参数
  const [aimAngle, setAimAngle] = useState(0);
  const [power, setPower] = useState(50);
  const [adjustmentCount, setAdjustmentCount] = useState(0);
  const [aimStartTime, setAimStartTime] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // 瞄准预测
  const [prediction, setPrediction] = useState(null);

  // 模拟数据
  const [simResult, setSimResult] = useState(null);
  const [lastFeedback, setLastFeedback] = useState(null);
  const [showReflection, setShowReflection] = useState(false);

  // 初始化瞄准
  useEffect(() => {
    if (rack && rack.cueBall && rack.targetBalls.length > 0) {
      setDisplayCue({ x: rack.cueBall.x, y: rack.cueBall.y });
      setDisplayTargets(rack.targetBalls.map(t => ({ x: t.x, y: t.y, id: t.id, isPocketed: t.isPocketed })));
      const initialAngle = Math.atan2(
        rack.targetBalls[0].y - rack.cueBall.y,
        rack.targetBalls[0].x - rack.cueBall.x
      ) * 180 / Math.PI;
      setAimAngle(initialAngle);
      setAimStartTime(Date.now());
      setAdjustmentCount(0);
      logger.session('台球-开始瞄准', {
        难度: difficulty,
        剩余目标球: rack.targetBalls.filter(t => !t.isPocketed).length,
        初始角度: initialAngle.toFixed(1) + '°',
      });
    }
  }, [rack]);

  // 更新瞄准预测
  useEffect(() => {
    if (rack && rack.cueBall && rack.targetBalls.length > 0 && gameState === 'aiming') {
      const pred = billiardsEngine.calculateAimPrediction(
        rack.cueBall,
        rack.targetBalls[0],
        aimAngle,
        power
      );
      setPrediction(pred);
    }
  }, [rack, aimAngle, power, gameState]);

  // Canvas 绘制
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const C = TABLE.cushion;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 球台外框
    ctx.fillStyle = '#5D3A1A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 球台台面
    ctx.fillStyle = '#0B6623';
    ctx.fillRect(C, C, TABLE.width, TABLE.height);

    // 库边装饰线
    ctx.strokeStyle = '#3D2410';
    ctx.lineWidth = 2;
    ctx.strokeRect(C, C, TABLE.width, TABLE.height);

    // 袋口
    for (const pocket of POCKETS) {
      const px = C + pocket.x;
      const py = C + pocket.y;
      ctx.beginPath();
      ctx.arc(px, py, TABLE.pocketRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
      ctx.strokeStyle = '#3D2410';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 瞄准线（瞄准阶段）
    if (gameState === 'aiming' && prediction) {
      if (prediction.aimLine) {
        ctx.beginPath();
        ctx.moveTo(C + prediction.aimLine.start.x, C + prediction.aimLine.start.y);
        ctx.lineTo(C + prediction.aimLine.end.x, C + prediction.aimLine.end.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      if (prediction.contactPoint && prediction.expectedReflectionAngle !== null) {
        const refRad = (prediction.expectedReflectionAngle * Math.PI) / 180;
        const refEndX = prediction.contactPoint.x + Math.cos(refRad) * 150;
        const refEndY = prediction.contactPoint.y + Math.sin(refRad) * 150;

        ctx.beginPath();
        ctx.moveTo(C + prediction.contactPoint.x, C + prediction.contactPoint.y);
        ctx.lineTo(C + refEndX, C + refEndY);
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (prediction.expectedLanding) {
          ctx.beginPath();
          ctx.arc(C + prediction.expectedLanding.x, C + prediction.expectedLanding.y, 6, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(212,175,55,0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 折射对比（反馈阶段）
    if (showReflection && simResult && prediction) {
      if (prediction.contactPoint && prediction.expectedReflectionAngle !== null) {
        const refRad = (prediction.expectedReflectionAngle * Math.PI) / 180;
        const refEndX = prediction.contactPoint.x + Math.cos(refRad) * 200;
        const refEndY = prediction.contactPoint.y + Math.sin(refRad) * 200;
        ctx.beginPath();
        ctx.moveTo(C + prediction.contactPoint.x, C + prediction.contactPoint.y);
        ctx.lineTo(C + refEndX, C + refEndY);
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (simResult.actualReflectionAngle !== null) {
        const refRad = (simResult.actualReflectionAngle * Math.PI) / 180;
        const startX = prediction.contactPoint?.x || rack.cueBall.x;
        const startY = prediction.contactPoint?.y || rack.cueBall.y;
        const refEndX = startX + Math.cos(refRad) * 200;
        const refEndY = startY + Math.sin(refRad) * 200;
        ctx.beginPath();
        ctx.moveTo(C + startX, C + startY);
        ctx.lineTo(C + refEndX, C + refEndY);
        ctx.strokeStyle = '#52c41a';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }

    // 目标球
    for (const t of displayTargets) {
      if (t.isPocketed) continue;
      const tx = C + t.x;
      const ty = C + t.y;
      ctx.beginPath();
      ctx.arc(tx, ty, TABLE.ballRadius, 0, Math.PI * 2);
      const targetBall = rack.targetBalls.find(b => b.id === t.id);
      ctx.fillStyle = targetBall?.color || '#e74c3c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (targetBall?.number) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(targetBall.number, tx, ty);
      }
    }

    // 母球
    if (displayCue && !displayCue.isPocketed) {
      const cx = C + displayCue.x;
      const cy = C + displayCue.y;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, TABLE.ballRadius * 2);
      gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, TABLE.ballRadius * 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, TABLE.ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [displayCue, displayTargets, prediction, gameState, rack, showReflection, simResult]);

  useEffect(() => { draw(); }, [draw]);

  // 鼠标事件
  const handleCanvasMouseDown = (e) => {
    if (gameState !== 'aiming') return;
    setIsDragging(true);
    setAdjustmentCount(c => c + 1);
    updateAimFromMouse(e);
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDragging || gameState !== 'aiming') return;
    updateAimFromMouse(e);
  };

  const handleCanvasMouseUp = () => setIsDragging(false);

  const updateAimFromMouse = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !rack) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX - TABLE.cushion;
    const my = (e.clientY - rect.top) * scaleY - TABLE.cushion;
    const angle = Math.atan2(my - rack.cueBall.y, mx - rack.cueBall.x) * 180 / Math.PI;
    setAimAngle(angle);
  };

  // 击球
  const handleShoot = () => {
    if (gameState !== 'aiming' || !rack) return;

    const aimDuration = aimStartTime ? (Date.now() - aimStartTime) / 1000 : 0;
    const result = billiardsEngine.simulateShot(
      rack.cueBall,
      rack.targetBalls,
      aimAngle,
      power
    );

    const deviation = billiardsEngine.calculateDeviation(
      prediction?.expectedLanding,
      result.actualLanding,
      prediction?.expectedReflectionAngle,
      result.actualReflectionAngle
    );

    const shotType = power > 60 ? 'offensive' : (deviation.pathDeviation < 0.3 ? 'offensive' : 'defensive');

    const record = billiardsEngine.createShotRecord({
      aimAngle,
      aimPower: power,
      adjustmentCount,
      aimDuration,
      expectedLanding: prediction?.expectedLanding,
      actualLanding: result.actualLanding,
      deviation: deviation.pathDeviation,
      isPocketed: result.pocketedCount > 0,
      shotType,
      expectedReflectionAngle: prediction?.expectedReflectionAngle,
      actualReflectionAngle: result.actualReflectionAngle,
      reflectionDeviation: deviation.reflectionDeviation,
      deviationLevel: deviation.deviationLevel,
    });

    logger.session('台球-击球', {
      角度: aimAngle.toFixed(1),
      力度: power,
      进球: result.pocketedCount,
      折射偏差: deviation.reflectionDeviation.toFixed(1) + '°',
      等级: deviation.deviationLevel,
    });

    setSimResult(result);
    setLastFeedback({ ...record, deviationLevel: deviation.deviationLevel, pocketed: result.pocketedCount });
    setShots(s => [...s, record]);
    setGameState('simulating');
    setShowReflection(false);

    let frameIdx = 0;
    const playAnim = () => {
      if (frameIdx >= result.frames.length) {
        setGameState('feedback');
        setShowReflection(true);
        setShotCount(c => c + 1);
        setPocketedCount(c => c + result.pocketedCount);

        setTimeout(() => {
          setShowReflection(false);
          const newRack = {
            cueBall: { ...rack.cueBall, x: result.frames[result.frames.length - 1].cue.x, y: result.frames[result.frames.length - 1].cue.y, isPocketed: result.cuePocketed },
            targetBalls: rack.targetBalls.map((t, i) => ({
              ...t,
              x: result.frames[result.frames.length - 1].targets[i]?.x || t.x,
              y: result.frames[result.frames.length - 1].targets[i]?.y || t.y,
              isPocketed: result.frames[result.frames.length - 1].targets[i]?.isPocketed || t.isPocketed,
            })),
          };

          const remaining = newRack.targetBalls.filter(t => !t.isPocketed);
          if (remaining.length === 0 || shotCount >= 9) {
            setGameState('finished');
            const moodData = billiardsEngine.generateBilliardsMood([...shots, record]);
            storage.update('psychologyProfile', (prev) => ({
              ...prev,
              billiardsMood: moodData,
              lastBilliardsTime: Date.now(),
            }));
            storage.update('billiardsSessions', (prev) => [
              ...(prev || []),
              { id: Date.now(), shots: [...shots, record], mood: moodData, createdAt: Date.now() },
            ]);
            logger.session('台球-本局结束', moodData.summary);
            onSessionEnd && onSessionEnd(moodData);
          } else {
            setRack(newRack);
            setGameState('aiming');
          }
        }, 2500);
        return;
      }

      const frame = result.frames[frameIdx];
      setDisplayCue(frame.cue);
      setDisplayTargets(frame.targets);
      frameIdx++;
      animFrameRef.current = setTimeout(playAnim, 16);
    };
    playAnim();
  };

  const handleResetAim = () => {
    if (!rack) return;
    const angle = Math.atan2(
      rack.targetBalls[0].y - rack.cueBall.y,
      rack.targetBalls[0].x - rack.cueBall.x
    ) * 180 / Math.PI;
    setAimAngle(angle);
    setPower(50);
    setAdjustmentCount(0);
    setAimStartTime(Date.now());
    logger.session('台球-重置瞄准', {
      重置后角度: angle.toFixed(1) + '°',
      重置后力度: 50,
    });
  };

  const handleNewGame = () => {
    setShots([]);
    setShotCount(0);
    setPocketedCount(0);
    setLastFeedback(null);
    setSimResult(null);
    setShowReflection(false);
    setRack(billiardsEngine.generateRack(difficulty));
    setGameState('aiming');
    logger.session('台球-新开局', {
      难度: difficulty,
      目标球数: rack?.targetBalls?.length || 0,
    });
  };

  useEffect(() => () => { if (animFrameRef.current) clearTimeout(animFrameRef.current); }, []);

  const powerLevel = power < 35 ? '轻' : power < 65 ? '中' : '重';
  const isFinished = gameState === 'finished';

  if (isFinished) {
    const moodData = billiardsEngine.generateBilliardsMood(shots);
    const successRate = shotCount > 0 ? Math.round((pocketedCount / shotCount) * 100) : 0;

    return (
      <div className="billiards-finished">
        <Result
          icon={<TrophyOutlined style={{ color: '#D4AF37' }} />}
          title="本局结束"
          subTitle={moodData.summary}
          extra={[
            <Button type="primary" key="again" icon={<ReloadOutlined />} onClick={handleNewGame}>再来一局</Button>,
          ]}
        />
        <Row gutter={[16, 16]} className="finished-stats">
          <Col xs={12} md={8}><Card><Statistic title="总击球数" value={shotCount} /></Card></Col>
          <Col xs={12} md={8}><Card><Statistic title="进球数" value={pocketedCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} md={8}><Card><Statistic title="进球率" value={successRate} suffix="%" /></Card></Col>
          <Col xs={12} md={8}><Card><Statistic title="平均折射偏差" value={moodData.avgDeviation} suffix="°" valueStyle={{ color: moodData.avgDeviation < 10 ? '#52c41a' : '#faad14' }} /></Card></Col>
          <Col xs={12} md={8}><Card><Statistic title="情绪值" value={moodData.mood} suffix="%" prefix={<BulbOutlined />} /></Card></Col>
          <Col xs={12} md={8}><Card><Statistic title="进攻占比" value={Math.round(moodData.offensiveRatio * 100)} suffix="%" /></Card></Col>
        </Row>
      </div>
    );
  }

  return (
    <div className="billiards-trainer">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card size="small" className="trainer-header">
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <div>
                <Title level={4} style={{ margin: 0 }}>🎱 台球训练</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>路径推演 · 折射偏差 · 行为数据采集</Text>
              </div>
            </Space>
            <Space>
              <Select value={difficulty} onChange={(v) => {
                setDifficulty(v);
                setRack(billiardsEngine.generateRack(v));
                logger.session('台球-切换难度', { 新难度: v });
              }} style={{ width: 100 }} size="small">
                <Option value="easy">简单</Option>
                <Option value="medium">中等</Option>
                <Option value="hard">困难</Option>
              </Select>
              <Tag color="blue">第 {shotCount + 1} 杆</Tag>
              <Tag color="green">进球 {pocketedCount}</Tag>
              <Tag color="gold">{gameState === 'aiming' ? '瞄准中' : gameState === 'simulating' ? '击球中...' : '反馈'}</Tag>
            </Space>
          </Space>
        </Card>

        <Card bodyStyle={{ padding: 16 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: CANVAS_W, margin: '0 auto', cursor: gameState === 'aiming' ? 'crosshair' : 'default' }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{ width: '100%', height: 'auto', borderRadius: 8 }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
          </div>
        </Card>

        <Card size="small" title="击球控制" disabled={gameState !== 'aiming'}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary">角度：{aimAngle.toFixed(0)}°</Text>
                <Slider min={-180} max={180} value={aimAngle} onChange={(v) => { setAimAngle(v); setAdjustmentCount(c => c + 1); }} disabled={gameState !== 'aiming'} />
              </Col>
              <Col span={12}>
                <Text type="secondary">力度：{power} ({powerLevel})</Text>
                <Slider min={1} max={100} value={power} marks={POWER_LABELS} onChange={(v) => { setPower(v); setAdjustmentCount(c => c + 1); }} disabled={gameState !== 'aiming'} />
              </Col>
            </Row>

            {prediction && (
              <Row gutter={16}>
                <Col span={8}>
                  <Tag color={prediction.willHit ? 'green' : 'orange'}>{prediction.willHit ? '✓ 能命中目标球' : '⚠ 可能打不到'}</Tag>
                </Col>
                <Col span={8}>
                  {prediction.expectedReflectionAngle !== null && <Text type="secondary" style={{ fontSize: 12 }}>预期折射角：{prediction.expectedReflectionAngle.toFixed(0)}°</Text>}
                </Col>
                <Col span={8} style={{ textAlign: 'right' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>修正次数：{adjustmentCount}</Text>
                </Col>
              </Row>
            )}

            <Space style={{ justifyContent: 'center', width: '100%' }}>
              <Button type="primary" size="large" onClick={handleShoot} disabled={gameState !== 'aiming'} icon={<TrophyOutlined />}>🎯 击球</Button>
              <Button size="large" onClick={handleResetAim} disabled={gameState !== 'aiming'} icon={<ReloadOutlined />}>重置瞄准</Button>
              <Button size="large" onClick={handleNewGame} icon={<HomeOutlined />}>新开局</Button>
            </Space>
          </Space>
        </Card>

        {lastFeedback && (
          <Card size="small" title={<Space><BulbOutlined style={{ color: '#D4AF37' }} /><span>上次击球反馈</span></Space>}>
            <Row gutter={[16, 8]}>
              <Col span={6}>
                <Statistic title="结果" value={lastFeedback.pocketed > 0 ? '进球 ✓' : '未进'} valueStyle={{ color: lastFeedback.pocketed > 0 ? '#52c41a' : '#faad14', fontSize: 16 }} />
              </Col>
              <Col span={6}>
                <Statistic title="折射偏差" value={lastFeedback.reflectionDeviation} suffix="°" valueStyle={{ color: lastFeedback.deviationLevel === '精准' ? '#52c41a' : lastFeedback.deviationLevel === '偏差' ? '#faad14' : '#eb2f96', fontSize: 16 }} />
              </Col>
              <Col span={6}>
                <Statistic title="偏差等级" valueRender={() => (
                  <Tag color={lastFeedback.deviationLevel === '精准' ? 'green' : lastFeedback.deviationLevel === '偏差' ? 'orange' : 'red'}>
                    {lastFeedback.deviationLevel === '精准' ? <CheckCircleOutlined /> : lastFeedback.deviationLevel === '偏差' ? <WarningOutlined /> : <CloseCircleOutlined />}
                    {' '}{lastFeedback.deviationLevel}
                  </Tag>
                )} />
              </Col>
              <Col span={6}>
                <Statistic title="瞄准耗时" value={lastFeedback.aimDuration.toFixed(1)} suffix="s" valueStyle={{ fontSize: 16 }} />
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={8}><Text type="secondary" style={{ fontSize: 12 }}>预期折射角</Text><div style={{ color: '#D4AF37' }}>{lastFeedback.expectedReflectionAngle?.toFixed(0)}°</div></Col>
              <Col span={8}><Text type="secondary" style={{ fontSize: 12 }}>实际折射角</Text><div style={{ color: '#52c41a' }}>{lastFeedback.actualReflectionAngle?.toFixed(0)}°</div></Col>
              <Col span={8}><Text type="secondary" style={{ fontSize: 12 }}>路径偏差</Text><div>{(lastFeedback.deviation * 100).toFixed(0)}%</div></Col>
            </Row>
          </Card>
        )}
      </Space>
    </div>
  );
};

// ============= BilliardsPage 主组件 =============
const BilliardsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('lobby');

  // 模拟统计数据（实际应从 storage 读取）
  const mockStats = useMemo(() => ({
    totalShots: 87,
    pocketRate: 0.42,
    avgDeviation: 8.5,
    avgAimTime: 4.2,
    offensiveRatio: 0.58,
    totalSessions: 5,
    bestDeviation: 2.3,
    currentStreak: 2,
    isWinStreak: true,
  }), []);

  // 读取历史会话
  const historySessions = useMemo(() => {
    return storage.get('billiardsSessions') || [];
  }, []);

  // ============= 渲染：大厅 =============
  const renderLobby = () => (
    <div className="billiards-lobby">
      <Card className="billiards-hero-card">
        <div className="billiards-hero-content">
          <div className="billiards-hero-text">
            <Text className="billiards-hero-greeting">🎱 台球模拟</Text>
            <Title level={2} className="billiards-hero-title">
              在<span className="gradient-text">路径推演</span>中发现你的决策模式
            </Title>
            <Paragraph className="billiards-hero-desc">
              每一次瞄准都是空间预判的采样，每一杆力度都是风险偏好的表达。
              系统对比预期与实际折射，构建你的「空间感知+决策风格」画像。
            </Paragraph>
            <Space size="middle">
              <Button type="primary" size="large" icon={<PlayCircleOutlined />} className="quick-start-btn" onClick={() => setActiveTab('trainer')}>
                开始训练
              </Button>
              <Select defaultValue="easy" style={{ width: 120 }} size="large">
                <Option value="easy">😊 简单模式</Option>
                <Option value="medium">🤔 中等模式</Option>
                <Option value="hard">😈 困难模式</Option>
              </Select>
            </Space>
          </div>
          <div className="billiards-hero-stats">
            <div className="billiards-hero-stat">
              <span className="stat-emoji">🎯</span>
              <span className="stat-value">{mockStats.totalShots}</span>
              <span className="stat-label">总击球数</span>
            </div>
            <div className="billiards-hero-stat">
              <span className="stat-emoji">✅</span>
              <span className="stat-value">{(mockStats.pocketRate * 100).toFixed(0)}%</span>
              <span className="stat-label">进球率</span>
            </div>
            <div className="billiards-hero-stat">
              <span className="stat-emoji">📐</span>
              <span className="stat-value">{mockStats.avgDeviation}°</span>
              <span className="stat-label">平均偏差</span>
            </div>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]} className="billiards-stats-row">
        <Col xs={12} md={6}>
          <Card className="billiards-stat-card">
            <Statistic title={<span><AimOutlined /> 平均瞄准时间</span>} value={mockStats.avgAimTime} precision={1} suffix="秒" valueStyle={{ color: '#8b5cf6' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="billiards-stat-card">
            <Statistic title={<span><FireOutlined /> 进攻占比</span>} value={mockStats.offensiveRatio * 100} precision={0} suffix="%" valueStyle={{ color: '#ec4899' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="billiards-stat-card">
            <Statistic title={<span><RiseOutlined /> 最佳偏差</span>} value={mockStats.bestDeviation} precision={1} suffix="°" valueStyle={{ color: '#22c55e' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="billiards-stat-card">
            <Statistic title={<span><ClockCircleOutlined /> 训练场次</span>} value={mockStats.totalSessions} valueStyle={{ color: '#06b6d4' }} />
          </Card>
        </Col>
      </Row>

      <Card title={<span><DatabaseOutlined /> 你的哪些数据会被记录？</span>} className="billiards-data-info-card" extra={<Tooltip title="所有数据仅用于本地人格建模，不会上传"><InfoCircleOutlined style={{ color: '#8b5cf6' }} /></Tooltip>}>
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

  // ============= 渲染：数据统计 =============
  const renderStats = () => (
    <div className="billiards-stats-page">
      <Card className="billiards-profit-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div className="stats-section">
              <Text type="secondary">训练总览</Text>
              <Title level={2} style={{ margin: 0 }}>{mockStats.totalShots} 杆</Title>
              <Tag color={mockStats.isWinStreak ? 'green' : 'red'}>
                {mockStats.isWinStreak ? <RiseOutlined /> : <FallOutlined />}
                {' '}状态提升 {mockStats.currentStreak} 场
              </Tag>
            </div>
          </Col>
          <Col xs={12} md={4}><Statistic title="进球率" value={mockStats.pocketRate * 100} suffix="%" valueStyle={{ color: '#22c55e' }} /></Col>
          <Col xs={12} md={4}><Statistic title="平均偏差" value={mockStats.avgDeviation} suffix="°" valueStyle={{ color: '#8b5cf6' }} /></Col>
          <Col xs={12} md={4}><Statistic title="进攻占比" value={Math.round(mockStats.offensiveRatio * 100)} suffix="%" valueStyle={{ color: '#ec4899' }} /></Col>
          <Col xs={12} md={4}><Statistic title="最佳偏差" value={mockStats.bestDeviation} suffix="°" valueStyle={{ color: '#22c55e' }} /></Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={<span><LineChartOutlined /> 核心指标</span>} className="billiards-stats-card">
            <List
              dataSource={[
                { label: '进球率', value: mockStats.pocketRate, target: '40%-60%' },
                { label: '进攻占比', value: mockStats.offensiveRatio, target: '50%-70%' },
                { label: '平均偏差', value: 1 - mockStats.avgDeviation / 30, target: '<10°' },
                { label: '瞄准效率', value: 1 - mockStats.avgAimTime / 10, target: '3-5秒' },
              ]}
              renderItem={(item) => (
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
          <Card title={<span><FireOutlined /> 行为标签</span>} className="billiards-stats-card">
            <div className="behavior-tags">
              <Tag color="purple" icon={<AimOutlined />} className="behavior-tag">🎯 空间预判型</Tag>
              <Tag color="orange" icon={<FireOutlined />} className="behavior-tag">🔥 进攻型选手</Tag>
              <Tag color="blue" icon={<ClockCircleOutlined />} className="behavior-tag">⏱️ 思考型决策者</Tag>
              <Tag color="green" icon={<SafetyOutlined />} className="behavior-tag">🛡️ 稳定性尚可</Tag>
              <Tag color="cyan" icon={<CheckCircleOutlined />} className="behavior-tag">✅ 中高执行度</Tag>
            </div>
            <Divider />
            <div className="mbti-mapping">
              <Text type="secondary">基于当前行为模式的 MBTI 推断：</Text>
              <div className="mbti-mapping-row">
                <Tag color="purple" className="mbti-tag">ISTP</Tag>
                <Text type="secondary">置信度 62%</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>提示：更多训练数据将提升人格画像准确度</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title={<span><ClockCircleOutlined /> 历史训练记录</span>} className="billiards-stats-card">
        {historySessions.length === 0 ? (
          <Empty description="暂无训练记录，开始训练后会保存每一局的数据" />
        ) : (
          <List
            dataSource={[...historySessions].reverse()}
            renderItem={(session, idx) => (
              <List.Item>
                <Space>
                  <Avatar style={{ backgroundColor: '#7c3aed' }}>{idx + 1}</Avatar>
                  <Text>{session.mood?.summary || '训练完成'}</Text>
                  <Tag color="green">{session.mood?.totalShots || 0} 杆</Tag>
                  <Tag color="blue">进球 {session.mood?.pocketed || 0}</Tag>
                  <Tag color="purple">偏差 {session.mood?.avgDeviation || 0}°</Tag>
                  <Text type="secondary">{new Date(session.createdAt).toLocaleString()}</Text>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );

  // ============= 渲染：行为采集 =============
  const renderBehavior = () => (
    <div className="billiards-behavior-page">
      <Card className="behavior-overview-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">🎯</span>
              <div>
                <Text type="secondary">已采集击球样本</Text>
                <Title level={3} style={{ margin: 0 }}>{mockStats.totalShots}</Title>
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">📊</span>
              <div>
                <Text type="secondary">数据维度覆盖</Text>
                <Title level={3} style={{ margin: 0 }}>5 / 8</Title>
                <Progress percent={62} size="small" showInfo={false} />
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">🧠</span>
              <div>
                <Text type="secondary">人格画像准确度</Text>
                <Title level={3} style={{ margin: 0 }}>62%</Title>
                <Progress percent={62} size="small" strokeColor="#8b5cf6" showInfo={false} />
              </div>
            </div>
          </Col>
        </Row>
      </Card>

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
          <div className="dataflow-step"><div className="dataflow-step-icon">🎱</div><div className="dataflow-step-content"><Text strong>Step 1: 训练中采集</Text><Paragraph type="secondary">每一次瞄准、击球、力度选择都被记录为结构化数据</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">📐</div><div className="dataflow-step-content"><Text strong>Step 2: 偏差分析</Text><Paragraph type="secondary">对比预期与实际折射角，计算空间预判准确度和稳定性</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">🧠</div><div className="dataflow-step-content"><Text strong>Step 3: 人格画像映射</Text><Paragraph type="secondary">偏差模式→S维度（感觉/直觉），决策时长→J/P维度映射</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">✨</div><div className="dataflow-step-content"><Text strong>Step 4: 个性化反馈</Text><Paragraph type="secondary">生成专注力训练建议、空间感知提升方案、培养路径</Paragraph></div></div>
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
    <div className="billiards-page">
      <div className="billiards-page-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>返回首页</Button>
        <Title level={4} style={{ margin: 0 }}>
          <span className="gradient-text">🎱 台球模拟</span>
          <Text type="secondary" style={{ marginLeft: 12, fontWeight: 'normal' }}>
            空间感知与决策风格的行为采集入口
          </Text>
        </Title>
        <Space><Badge status="success" text="采样中" /></Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className="billiards-tabs"
        items={[
          { key: 'lobby', label: <span><PlayCircleOutlined /> 入口大厅</span> },
          { key: 'trainer', label: <span><TrophyOutlined /> 台球训练</span> },
          { key: 'stats', label: <span><LineChartOutlined /> 数据统计</span> },
          { key: 'behavior', label: <span><DatabaseOutlined /> 行为采集</span> },
        ]}
      />

      {activeTab === 'lobby' && renderLobby()}
      {activeTab === 'trainer' && <BilliardsTrainer />}
      {activeTab === 'stats' && renderStats()}
      {activeTab === 'behavior' && renderBehavior()}
    </div>
  );
};

export default BilliardsPage;
