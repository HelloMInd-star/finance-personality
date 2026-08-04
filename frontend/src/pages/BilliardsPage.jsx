import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Result
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  HomeOutlined,
  TrophyOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  billiardsEngine,
  TABLE,
  POCKETS
} from '../utils/billiardsEngine';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';

const { Title, Text, Paragraph } = Typography;

// Canvas 缩放比例
const CANVAS_SCALE = 1;
const CANVAS_W = TABLE.width + TABLE.cushion * 2;
const CANVAS_H = TABLE.height + TABLE.cushion * 2;

const POWER_LABELS = { 20: '轻', 50: '中', 80: '重' };

const BilliardsPage = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // 游戏状态
  const [gameState, setGameState] = useState('aiming'); // aiming / simulating / feedback / finished
  const [shotCount, setShotCount] = useState(0);
  const [pocketedCount, setPocketedCount] = useState(0);
  const [shots, setShots] = useState([]);

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
  const [simFrames, setSimFrames] = useState([]);
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

    // 清屏
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
      // 主瞄准线（白色实线）
      if (prediction.aimLine) {
        ctx.beginPath();
        ctx.moveTo(C + prediction.aimLine.start.x, C + prediction.aimLine.start.y);
        ctx.lineTo(C + prediction.aimLine.end.x, C + prediction.aimLine.end.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
      }

      // 预期走位路径（金色虚线）
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

        // 预期落点标记
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
      // 预期路径（金色虚线）
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

      // 实际路径（绿色实线）
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
      // 球身
      ctx.beginPath();
      ctx.arc(tx, ty, TABLE.ballRadius, 0, Math.PI * 2);
      const targetBall = rack.targetBalls.find(b => b.id === t.id);
      ctx.fillStyle = targetBall?.color || '#e74c3c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // 编号
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
      // 光晕
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, TABLE.ballRadius * 2);
      gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, TABLE.ballRadius * 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      // 球身
      ctx.beginPath();
      ctx.arc(cx, cy, TABLE.ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [displayCue, displayTargets, prediction, gameState, rack, showReflection, simResult]);

  // 重绘
  useEffect(() => {
    draw();
  }, [draw]);

  // 鼠标事件 - 瞄准
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

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

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
      deviationLevel: deviation.deviationLevel
    });

    logger.session('台球-击球', {
      角度: aimAngle.toFixed(1),
      力度: power,
      进球: result.pocketedCount,
      折射偏差: deviation.reflectionDeviation.toFixed(1) + '°',
      等级: deviation.deviationLevel
    });

    setSimFrames(result.frames);
    setSimResult(result);
    setLastFeedback({
      ...record,
      deviationLevel: deviation.deviationLevel,
      pocketed: result.pocketedCount
    });
    setShots(s => [...s, record]);
    setGameState('simulating');
    setShowReflection(false);

    // 播放动画
    let frameIdx = 0;
    const playAnim = () => {
      if (frameIdx >= result.frames.length) {
        // 动画结束，显示反馈
        setGameState('feedback');
        setShowReflection(true);
        setShotCount(c => c + 1);
        setPocketedCount(c => c + result.pocketedCount);

        // 2秒后隐藏折射对比，进入下一轮瞄准
        setTimeout(() => {
          setShowReflection(false);
          // 更新球局
          const newRack = {
            cueBall: { ...rack.cueBall, x: result.frames[result.frames.length - 1].cue.x, y: result.frames[result.frames.length - 1].cue.y, isPocketed: result.cuePocketed },
            targetBalls: rack.targetBalls.map((t, i) => ({
              ...t,
              x: result.frames[result.frames.length - 1].targets[i]?.x || t.x,
              y: result.frames[result.frames.length - 1].targets[i]?.y || t.y,
              isPocketed: result.frames[result.frames.length - 1].targets[i]?.isPocketed || t.isPocketed
            }))
          };

          // 检查是否全部进袋
          const remaining = newRack.targetBalls.filter(t => !t.isPocketed);
          if (remaining.length === 0 || shotCount >= 9) {
            setGameState('finished');
            // 生成心情盘
            const moodData = billiardsEngine.generateBilliardsMood([...shots, record]);
            storage.update('psychologyProfile', (prev) => ({
              ...prev,
              billiardsMood: moodData,
              lastBilliardsTime: Date.now()
            }));
            // 增加台球会话记录
            storage.update('billiardsSessions', (prev) => [
              ...(prev || []),
              {
                id: Date.now(),
                shots: [...shots, record],
                mood: moodData,
                createdAt: Date.now()
              }
            ]);
            logger.session('台球-本局结束', moodData.summary);
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

  // 重置瞄准
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
  };

  // 重新开局
  const handleNewGame = () => {
    setShots([]);
    setShotCount(0);
    setPocketedCount(0);
    setLastFeedback(null);
    setSimResult(null);
    setShowReflection(false);
    setRack(billiardsEngine.generateRack('easy'));
    setGameState('aiming');
  };

  // 清理
  useEffect(() => {
    return () => {
      if (animFrameRef.current) clearTimeout(animFrameRef.current);
    };
  }, []);

  const powerLevel = power < 35 ? '轻' : power < 65 ? '中' : '重';
  const isFinished = gameState === 'finished';

  // 结束画面
  if (isFinished) {
    const moodData = billiardsEngine.generateBilliardsMood(shots);
    const successRate = shotCount > 0 ? Math.round((pocketedCount / shotCount) * 100) : 0;

    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <Result
          icon={<TrophyOutlined style={{ color: '#D4AF37' }} />}
          title="本局结束"
          subTitle={moodData.summary}
          extra={[
            <Button type="primary" key="again" icon={<ReloadOutlined />} onClick={handleNewGame}>
              再来一局
            </Button>,
            <Button key="home" icon={<HomeOutlined />} onClick={() => navigate('/')}>
              返回首页
            </Button>
          ]}
        />
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic title="总击球数" value={shotCount} />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic title="进球数" value={pocketedCount} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic title="进球率" value={successRate} suffix="%" />
            </Card>
          </Col>
          <Col span={12}>
            <Card>
              <Statistic
                title="平均折射偏差"
                value={moodData.avgDeviation}
                suffix="°"
                valueStyle={{ color: moodData.avgDeviation < 10 ? '#52c41a' : '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card>
              <Statistic
                title="情绪值"
                value={moodData.mood}
                suffix="%"
                prefix={<BulbOutlined />}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 标题栏 */}
        <Card size="small">
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
              <div>
                <Title level={4} style={{ margin: 0 }}>🎱 台球模拟 · 行为采集</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  路径推演 · 折射偏差 · 行为数据采集
                </Text>
              </div>
            </Space>
            <Space>
              <Tag color="blue">第 {shotCount + 1} 杆</Tag>
              <Tag color="green">进球 {pocketedCount}</Tag>
              <Tag color="gold">
                {gameState === 'aiming' ? '瞄准中' : gameState === 'simulating' ? '击球中...' : '反馈'}
              </Tag>
            </Space>
          </Space>
        </Card>

        {/* 球台 */}
        <Card bodyStyle={{ padding: 16 }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: CANVAS_W,
              margin: '0 auto',
              cursor: gameState === 'aiming' ? 'crosshair' : 'default'
            }}
          >
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

        {/* 控制面板 */}
        <Card size="small" title="击球控制" disabled={gameState !== 'aiming'}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary">角度：{aimAngle.toFixed(0)}°</Text>
                <div style={{ marginTop: 4 }}>
                  <Slider
                    min={-180}
                    max={180}
                    value={aimAngle}
                    onChange={(v) => { setAimAngle(v); setAdjustmentCount(c => c + 1); }}
                    disabled={gameState !== 'aiming'}
                  />
                </div>
              </Col>
              <Col span={12}>
                <Text type="secondary">力度：{power} ({powerLevel})</Text>
                <div style={{ marginTop: 4 }}>
                  <Slider
                    min={1}
                    max={100}
                    value={power}
                    marks={POWER_LABELS}
                    onChange={(v) => { setPower(v); setAdjustmentCount(c => c + 1); }}
                    disabled={gameState !== 'aiming'}
                  />
                </div>
              </Col>
            </Row>

            {prediction && (
              <Row gutter={16}>
                <Col span={8}>
                  <Tag color={prediction.willHit ? 'green' : 'orange'}>
                    {prediction.willHit ? '✓ 能命中目标球' : '⚠ 可能打不到'}
                  </Tag>
                </Col>
                <Col span={8}>
                  {prediction.expectedReflectionAngle !== null && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      预期折射角：{prediction.expectedReflectionAngle.toFixed(0)}°
                    </Text>
                  )}
                </Col>
                <Col span={8} style={{ textAlign: 'right' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    修正次数：{adjustmentCount}
                  </Text>
                </Col>
              </Row>
            )}

            <Space style={{ justifyContent: 'center', width: '100%' }}>
              <Button
                type="primary"
                size="large"
                onClick={handleShoot}
                disabled={gameState !== 'aiming'}
                icon={<TrophyOutlined />}
              >
                🎯 击球
              </Button>
              <Button
                size="large"
                onClick={handleResetAim}
                disabled={gameState !== 'aiming'}
                icon={<ReloadOutlined />}
              >
                重置瞄准
              </Button>
            </Space>
          </Space>
        </Card>

        {/* 上次击球反馈 */}
        {lastFeedback && (
          <Card
            size="small"
            title={
              <Space>
                <BulbOutlined style={{ color: '#D4AF37' }} />
                <span>上次击球反馈</span>
              </Space>
            }
          >
            <Row gutter={[16, 8]}>
              <Col span={6}>
                <Statistic
                  title="结果"
                  value={lastFeedback.pocketed > 0 ? '进球 ✓' : '未进'}
                  valueStyle={{ color: lastFeedback.pocketed > 0 ? '#52c41a' : '#faad14', fontSize: 16 }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="折射偏差"
                  value={lastFeedback.reflectionDeviation}
                  suffix="°"
                  valueStyle={{
                    color: lastFeedback.deviationLevel === '精准' ? '#52c41a' :
                           lastFeedback.deviationLevel === '偏差' ? '#faad14' : '#eb2f96',
                    fontSize: 16
                  }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="偏差等级"
                  valueRender={() => (
                    <Tag color={
                      lastFeedback.deviationLevel === '精准' ? 'green' :
                      lastFeedback.deviationLevel === '偏差' ? 'orange' : 'red'
                    }>
                      {lastFeedback.deviationLevel === '精准' ? <CheckCircleOutlined /> :
                       lastFeedback.deviationLevel === '偏差' ? <WarningOutlined /> : <CloseCircleOutlined />}
                      {' '}{lastFeedback.deviationLevel}
                    </Tag>
                  )}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="瞄准耗时"
                  value={lastFeedback.aimDuration.toFixed(1)}
                  suffix="s"
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>预期折射角</Text>
                <div style={{ color: '#D4AF37' }}>{lastFeedback.expectedReflectionAngle?.toFixed(0)}°</div>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>实际折射角</Text>
                <div style={{ color: '#52c41a' }}>{lastFeedback.actualReflectionAngle?.toFixed(0)}°</div>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>路径偏差</Text>
                <div>{(lastFeedback.deviation * 100).toFixed(0)}%</div>
              </Col>
            </Row>
          </Card>
        )}

        {/* 说明 */}
        <Card size="small" type="inner">
          <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.8 }}>
            💡 <b>操作说明：</b>在球台上拖动鼠标调整瞄准方向，或使用滑块微调角度。
            白色实线是瞄准线，金色虚线是母球预期走位路径。击球后系统对比预期与实际折射角度，
            生成你的「路径预判能力」标签。
          </Text>
        </Card>
      </Space>
    </div>
  );
};

export default BilliardsPage;
