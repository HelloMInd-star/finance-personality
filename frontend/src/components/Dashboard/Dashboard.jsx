import React, { useMemo } from 'react';
import { Card, Progress, Tag, Tooltip } from 'antd';
import { 
  RiseOutlined, 
  FallOutlined, 
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { calculateGameMetrics } from '../../utils/pokerUtils';
import useMoodMetrics, { computeKellyWithMood } from '../MoodDial/useMoodMetrics';
import './Dashboard.css';

const Dashboard = ({ gameState }) => {
  const { playerId } = useGameStore();

  const rawMetrics = useMemo(() => {
    return calculateGameMetrics(gameState, playerId);
  }, [gameState, playerId]);

  const moodData = useMoodMetrics(gameState, playerId, rawMetrics);
  const { mood, kellyCorrection, biasTags, behavior, mbtiLabel } = moodData;

  // 心情修正后的凯利指数
  const adjustedKelly = useMemo(() => {
    if (!rawMetrics || rawMetrics.callAmount <= 0) return rawMetrics?.kellyIndex || 0;
    return computeKellyWithMood(
      rawMetrics.winRate,
      rawMetrics.potOdds * rawMetrics.callAmount, // 底池 = 赔率 * 跟注
      rawMetrics.callAmount,
      kellyCorrection
    );
  }, [rawMetrics, kellyCorrection]);

  if (!gameState) {
    return (
      <Card className="dashboard-container">
        <div className="dashboard-empty">
          <span>📊</span>
          <p>等待游戏数据...</p>
        </div>
      </Card>
    );
  }

  const {
    winRate,
    kellyIndex,
    potOdds,
    callAmount,
    handStrength,
    handName,
    expectedValue,
    tension
  } = rawMetrics;

  const getKellyStatus = (value) => {
    if (value > 0.3) return { color: '#22c55e', text: '高', icon: <RiseOutlined />, tag: 'success' };
    if (value > 0.15) return { color: '#fbbf24', text: '中', icon: <WarningOutlined />, tag: 'warning' };
    return { color: '#fca5a5', text: '低', icon: <FallOutlined />, tag: 'error' };
  };

  const kellyStatus = getKellyStatus(kellyIndex);
  const adjustedKellyStatus = getKellyStatus(adjustedKelly);

  // DCF折价
  const dcf = (1 - adjustedKelly - winRate) * 0.5;

  // 心情等级
  const getMoodLevel = (val) => {
    if (val >= 75) return 'high';
    if (val >= 40) return 'mid';
    return 'low';
  };

  const kellyDiff = adjustedKelly - kellyIndex;
  const kellyDiffPercent = Math.abs(kellyDiff) * 100;

  return (
    <div className="dashboard-container">
      {/* 凯利仪表盘 + 心情修正 */}
      <Card className="dashboard-card" title="📐 凯利仪表盘">
        <div className="kelly-display">
          {/* 原始凯利 */}
          <div className="kelly-section">
            <div className="kelly-label-row">
              <span className="kelly-label small">标准凯利</span>
            </div>
            <div className="kelly-value">
              <span className="kelly-number">{(kellyIndex * 100).toFixed(1)}%</span>
              <Tag color={kellyStatus.tag} className="kelly-tag">
                {kellyStatus.icon} {kellyStatus.text}
              </Tag>
            </div>
          </div>

          {/* 分隔 */}
          {kellyDiffPercent > 0.5 && (
            <div className={`kelly-diff ${kellyDiff > 0 ? 'up' : 'down'}`}>
              <Tooltip title={kellyDiff > 0 ? '心情修正提高了建议仓位' : '心情修正降低了建议仓位'}>
                {kellyDiff > 0 ? '↑' : '↓'} {kellyDiffPercent.toFixed(1)}%
              </Tooltip>
            </div>
          )}

          {/* 心情修正后凯利 */}
          <div className="kelly-section adjusted">
            <div className="kelly-label-row">
              <span className="kelly-label small">心情修正后</span>
              <Tag color="purple" className="mbti-tag">{mbtiLabel}</Tag>
            </div>
            <div className="kelly-value">
              <span className="kelly-number adjusted">{(adjustedKelly * 100).toFixed(1)}%</span>
              <Tag color={adjustedKellyStatus.tag} className="kelly-tag">
                {adjustedKellyStatus.icon} {adjustedKellyStatus.text}
              </Tag>
            </div>
            <div className="kelly-correction-info">
              <span>p×{kellyCorrection.pMultiplier.toFixed(2)}</span>
              <span>b×{kellyCorrection.bMultiplier.toFixed(2)}</span>
              <span>上限{kellyCorrection.fCap.toFixed(0) * 100}%</span>
            </div>
          </div>
        </div>

        <Progress 
          percent={adjustedKelly * 100} 
          strokeColor={{
            '0%': '#22c55e',
            '50%': '#fbbf24',
            '100%': '#ef4444'
          }}
          showInfo={false}
          size="small"
        />
        <div className="kelly-label">最优仓位（心情修正）</div>

        <div className="metrics-grid">
          <div className="metric-item">
            <span className="metric-label">📈 胜率</span>
            <span className="metric-value win">{(winRate * 100).toFixed(0)}%</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">⚡ 博弈张力</span>
            <span className="metric-value tension">{(tension * 100).toFixed(0)}%</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">💰 底池赔率</span>
            <span className="metric-value">
              {potOdds > 0 ? potOdds.toFixed(1) + ' : 1' : '-'}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">🎯 需跟注</span>
            <span className="metric-value">{callAmount}</span>
          </div>
        </div>
      </Card>

      {/* 心情盘面板 */}
      <Card className="dashboard-card mood-panel" title="🎭 心情盘 · 决策状态">
        <div className="mood-grid">
          <div className={`mood-item mood-${getMoodLevel(mood?.arousal)}`}>
            <span className="mood-emoji">⚡</span>
            <span className="mood-label">唤醒度</span>
            <Progress 
              type="dashboard" 
              percent={mood?.arousal || 50} 
              size={60}
              strokeColor={mood?.arousal > 70 ? '#ef4444' : mood?.arousal > 40 ? '#fbbf24' : '#22c55e'}
              showInfo={false}
            />
            <span className="mood-value">{mood?.arousal || 50}</span>
          </div>
          <div className={`mood-item mood-${getMoodLevel(mood?.confidence)}`}>
            <span className="mood-emoji">💪</span>
            <span className="mood-label">自信度</span>
            <Progress 
              type="dashboard" 
              percent={mood?.confidence || 50} 
              size={60}
              strokeColor={mood?.confidence > 70 ? '#22c55e' : mood?.confidence > 40 ? '#fbbf24' : '#ef4444'}
              showInfo={false}
            />
            <span className="mood-value">{mood?.confidence || 50}</span>
          </div>
          <div className={`mood-item mood-${getMoodLevel(mood?.riskTolerance)}`}>
            <span className="mood-emoji">🎲</span>
            <span className="mood-label">风险容忍</span>
            <Progress 
              type="dashboard" 
              percent={mood?.riskTolerance || 50} 
              size={60}
              strokeColor={mood?.riskTolerance > 70 ? '#f97316' : mood?.riskTolerance > 40 ? '#8b5cf6' : '#06b6d4'}
              showInfo={false}
            />
            <span className="mood-value">{mood?.riskTolerance || 50}</span>
          </div>
          <div className={`mood-item mood-${getMoodLevel(mood?.decisionStability)}`}>
            <span className="mood-emoji">🧭</span>
            <span className="mood-label">决策稳定</span>
            <Progress 
              type="dashboard" 
              percent={mood?.decisionStability || 70} 
              size={60}
              strokeColor={mood?.decisionStability > 70 ? '#22c55e' : mood?.decisionStability > 40 ? '#fbbf24' : '#ef4444'}
              showInfo={false}
            />
            <span className="mood-value">{mood?.decisionStability || 70}</span>
          </div>
        </div>

        {/* 偏差标签 */}
        {biasTags?.length > 0 && (
          <div className="bias-tags">
            <span className="bias-label"><InfoCircleOutlined /> 当前偏差提醒：</span>
            <div className="bias-list">
              {biasTags.map((tag, i) => (
                <Tooltip key={i} title={`基于你的行为模式检测到的偏差：${tag}`}>
                  <Tag color="red" className="bias-tag">⚠️ {tag}</Tag>
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        {/* 下注模式 */}
        {behavior && (
          <div className="behavior-info">
            <span className="behavior-label">下注模式：</span>
            <Tag color={
              behavior.betPattern === 'aggressive' ? 'orange' :
              behavior.betPattern === 'conservative' ? 'blue' :
              behavior.betPattern === 'erratic' ? 'red' : 'green'
            }>
              {behavior.betPattern === 'stable' ? '✅ 稳定' :
               behavior.betPattern === 'aggressive' ? '🔥 激进' :
               behavior.betPattern === 'conservative' ? '🛡️ 保守' : '⚠️ 波动'}
            </Tag>
          </div>
        )}
      </Card>

      {/* 表理映射 */}
      <Card className="dashboard-card bridge-panel" title="🔮 表理映射 · 里">
        <div className="bridge-grid">
          <div className="bridge-item">
            <span className="bridge-label">🧠 凯利映射（修正）</span>
            <span className="bridge-value">{(adjustedKelly * 100).toFixed(1)}%</span>
          </div>
          <div className="bridge-item">
            <span className="bridge-label">📊 博弈势能</span>
            <span className="bridge-value">{(tension * 100).toFixed(0)}%</span>
          </div>
          <div className="bridge-item">
            <span className="bridge-label">🎴 牌力</span>
            <span className="bridge-value">{handName}</span>
          </div>
          <div className="bridge-item">
            <span className="bridge-label">📉 折价预警</span>
            <span className={`bridge-value ${dcf < -0.05 ? 'bad' : 'good'}`}>
              {(dcf * 100).toFixed(1)}%
            </span>
          </div>
          <div className="bridge-item">
            <span className="bridge-label">💹 期望值</span>
            <span className={`bridge-value ${expectedValue >= 0 ? 'good' : 'bad'}`}>
              {expectedValue >= 0 ? '+' : ''}{expectedValue.toFixed(1)}
            </span>
          </div>
          <div className="bridge-item">
            <span className="bridge-label">🎯 安全边际</span>
            <span className={`bridge-value ${adjustedKelly > 0.2 ? 'good' : 'bad'}`}>
              {Math.max(0, (adjustedKelly - 0.1) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </Card>

      {/* 牌局信息 */}
      <Card className="dashboard-card" title="📋 牌局信息">
        <div className="info-list">
          <div className="info-item">
            <span className="info-label">底池</span>
            <span className="info-value">🪙 {gameState.pot}</span>
          </div>
          <div className="info-item">
            <span className="info-label">阶段</span>
            <span className="info-value">
              <Tag color="purple">{gameState.stage?.toUpperCase()}</Tag>
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">牌型</span>
            <span className="info-value">
              <Tag color="blue">{handName}</Tag>
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">玩家数</span>
            <span className="info-value">{gameState.players?.length || 0}</span>
          </div>
          <div className="info-item">
            <span className="info-label">AI对手</span>
            <span className="info-value">
              {gameState.players?.filter(p => p.is_ai).length || 0} 个
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">大盲</span>
            <span className="info-value">{gameState.big_blind || 20}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
