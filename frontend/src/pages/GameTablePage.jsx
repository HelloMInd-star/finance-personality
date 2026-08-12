import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Statistic,
  Divider,
  Modal,
  Progress,
  Tooltip,
  List,
  Slider,
  Avatar,
  Badge,
  Radio,
  Empty,
  Tabs,
} from 'antd';
import {
  ArrowLeftOutlined,
  HomeOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  TrophyOutlined,
  UserOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  FallOutlined,
  BulbOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  LineChartOutlined,
  DatabaseOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  FireOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  gameTableEngine,
  AI_STRATEGIES,
  ACTIONS,
  ACTION_LABELS,
  GAME_PHASES,
  PHASE_LABELS,
  analyzeOpponent,
} from '../utils/gameTableEngine';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';
import './GameTablePage.css';

const { Title, Text, Paragraph } = Typography;

// 行为采集数据类型
const COLLECTED_DATA_TYPES = [
  { key: 'opponentModeling', icon: '🎭', title: '对手建模能力', desc: '识别对手策略类型的准确度' },
  { key: 'strategyAdaptability', icon: '🔄', title: '策略切换频率', desc: '根据局势调整策略的能力' },
  { key: 'coopCompetition', icon: '🤝', title: '协作/竞争倾向', desc: '面对不同对手时的社交偏好' },
  { key: 'dynamicRisk', icon: '⚖️', title: '动态风险偏好', desc: '不同情境下的风险承受度变化' },
  { key: 'gameResult', icon: '🏆', title: '博弈结果', desc: '长期竞争力与适应力' },
  { key: 'decisionTime', icon: '⏱️', title: '决策耗时', desc: '每轮决策时间反映自信度' },
  { key: 'foldRate', icon: '🗂️', title: '弃牌率', desc: '谨慎度与耐心指标' },
  { key: 'bluffFrequency', icon: '🎪', title: '诈唬频率', desc: '创造力与冒险倾向' },
];

// ============= 玩家卡片组件 =============
const PlayerCard = ({ player, isCurrent, isDealer, isWinner }) => {
  const analysis = !player.isHuman ? analyzeOpponent(player) : null;

  return (
    <Card
      size="small"
      style={{
        background: isCurrent
          ? 'rgba(124, 58, 237, 0.3)'
          : player.isHuman
          ? 'rgba(16, 185, 129, 0.15)'
          : 'rgba(30, 19, 64, 0.8)',
        border: isCurrent ? '2px solid #7c3aed' : '1px solid rgba(139,92,246,0.3)',
        borderRadius: 12,
        opacity: player.folded ? 0.5 : 1,
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <Badge dot={isCurrent} color="#7c3aed">
          <Avatar
            style={{
              backgroundColor: player.isHuman ? '#10b981' : '#7c3aed',
              marginBottom: 8,
            }}
            icon={<UserOutlined />}
          />
        </Badge>
        <div>
          <Text strong style={{ color: '#fff' }}>
            {player.name}
            {isDealer && <Tag color="gold" style={{ marginLeft: 4 }}>D</Tag>}
            {isWinner && <Tag color="green" style={{ marginLeft: 4 }}>胜</Tag>}
          </Text>
        </div>
        <div style={{ marginTop: 4 }}>
          <Tag color={player.chips > 150 ? 'green' : player.chips > 80 ? 'gold' : 'red'}>
            💰 {player.chips}
          </Tag>
        </div>
        {!player.isHuman && player.strategyConfig && (
          <div style={{ marginTop: 4 }}>
            <Tag color="purple">
              {player.strategyConfig.emoji} {player.strategyConfig.name}
            </Tag>
          </div>
        )}
        {player.currentBet > 0 && (
          <div style={{ marginTop: 4 }}>
            <Text type="warning" style={{ fontSize: 12 }}>
              下注: {player.currentBet}
            </Text>
          </div>
        )}
        {player.folded && (
          <div style={{ marginTop: 4 }}>
            <Tag color="default">已弃牌</Tag>
          </div>
        )}
        {player.allIn && (
          <div style={{ marginTop: 4 }}>
            <Tag color="red">ALL-IN</Tag>
          </div>
        )}
      </div>
    </Card>
  );
};

// ============= 公共牌组件 =============
const CommunityCards = ({ cards }) => (
  <Space size={8}>
    {[0, 1, 2, 3, 4].map((i) => (
      <div
        key={i}
        style={{
          width: 50,
          height: 70,
          borderRadius: 8,
          background: cards[i]
            ? 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)'
            : 'rgba(124, 58, 237, 0.2)',
          border: cards[i] ? '2px solid #7c3aed' : '2px dashed rgba(139,92,246,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: cards[i] ? 20 : 14,
          color: cards[i]
            ? ['♥', '♦'].includes(cards[i]?.suit)
              ? '#ef4444'
              : '#1a1a1a'
            : 'rgba(255,255,255,0.3)',
          fontWeight: 'bold',
        }}
      >
        {cards[i] ? `${cards[i].rank}${cards[i].suit}` : '?'}
      </div>
    ))}
  </Space>
);

// ============= 对手分析面板 =============
const OpponentAnalysisPanel = ({ players }) => {
  const aiPlayers = players.filter(p => !p.isHuman);

  return (
    <Card
      size="small"
      title={
        <Space>
          <BulbOutlined style={{ color: '#f59e0b' }} />
          <span>对手策略分析</span>
        </Space>
      }
      style={{ background: 'rgba(30, 19, 64, 0.6)', borderRadius: 12 }}
    >
      <List
        size="small"
        dataSource={aiPlayers}
        renderItem={(player) => {
          const analysis = analyzeOpponent(player);
          return (
            <List.Item style={{ borderBottom: '1px solid rgba(139,92,246,0.2)', padding: '8px 0' }}>
              <div style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text strong style={{ color: '#fff' }}>
                    {player.strategyConfig?.emoji} {player.name}
                  </Text>
                  <Tag color={analysis.confidence > 0.6 ? 'green' : 'gold'}>
                    置信度 {Math.round(analysis.confidence * 100)}%
                  </Tag>
                </Space>
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    识别为: <Tag color="purple">{analysis.strategyName}</Tag>
                  </Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Row gutter={8}>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 11 }}>攻击性</Text>
                      <Progress percent={analysis.traits.aggression} size="small" showInfo={false} strokeColor="#ef4444" />
                    </Col>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 11 }}>紧密度</Text>
                      <Progress percent={analysis.traits.tightness} size="small" showInfo={false} strokeColor="#3b82f6" />
                    </Col>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 11 }}>可预测</Text>
                      <Progress percent={analysis.traits.predictability} size="small" showInfo={false} strokeColor="#10b981" />
                    </Col>
                  </Row>
                </div>
              </div>
            </List.Item>
          );
        }}
      />
    </Card>
  );
};

// ============= 动作日志组件 =============
const ActionLog = ({ actionLog, players }) => (
  <Card
    size="small"
    title={
      <Space>
        <HistoryOutlined />
        <span>本轮动作</span>
      </Space>
    }
    style={{ background: 'rgba(30, 19, 64, 0.6)', borderRadius: 12, maxHeight: 200, overflow: 'auto' }}
  >
    <List
      size="small"
      dataSource={actionLog.slice(-10).reverse()}
      renderItem={(log, idx) => {
        const player = players[log.playerId];
        const actionColors = {
          fold: 'default', call: 'blue', raise: 'orange', all_in: 'red',
          check: 'green', small_blind: 'purple', big_blind: 'purple',
        };
        return (
          <List.Item style={{ padding: '4px 0', borderBottom: 'none' }}>
            <Space>
              <Text type="secondary" style={{ fontSize: 11 }}>
                [{actionLog.length - idx}]
              </Text>
              <Text style={{ color: player?.isHuman ? '#10b981' : '#fff', fontSize: 12 }}>
                {player?.name}
              </Text>
              <Tag color={actionColors[log.action] || 'default'} style={{ fontSize: 11 }}>
                {ACTION_LABELS[log.action] || log.action}
              </Tag>
              {log.amount > 0 && (
                <Text type="warning" style={{ fontSize: 12 }}>
                  {log.amount}
                </Text>
              )}
            </Space>
          </List.Item>
        );
      }}
    />
  </Card>
);

// ============= 博弈训练核心组件 =============
const GameTableTrainer = ({ onSessionEnd }) => {
  const [game, setGame] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [playerCount, setPlayerCount] = useState(4);
  const [elapsed, setElapsed] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  // 计时器
  useEffect(() => {
    if (!game || game.phase === GAME_PHASES.ENDED || game.phase === GAME_PHASES.WAITING) return;
    const timer = setInterval(() => {
      setElapsed(Date.now() - game.startTime);
    }, 1000);
    return () => clearInterval(timer);
  }, [game]);

  // AI自动行动
  useEffect(() => {
    if (!game || !gameStarted) return;
    if (game.phase === GAME_PHASES.ENDED || game.phase === GAME_PHASES.WAITING) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.isHuman) return;

    setAiThinking(true);
    const timer = setTimeout(() => {
      const decision = gameTableEngine.makeAIDecision
        ? gameTableEngine.makeAIDecision(currentPlayer, game)
        : makeAIDecisionFallback(currentPlayer, game);

      if (decision) {
        let newGame = gameTableEngine.executeAction(game, currentPlayer.id, decision.action, decision.amount);
        newGame = gameTableEngine.advanceToNextPlayer(newGame);

        if (gameTableEngine.isPhaseComplete(newGame)) {
          if (game.players.filter(p => !p.folded).length <= 1) {
            newGame = gameTableEngine.showdown(newGame);
          } else {
            newGame = gameTableEngine.advancePhase(newGame);
          }
        }

        setGame(newGame);
      }
      setAiThinking(false);
    }, 800 + Math.random() * 600);

    return () => clearTimeout(timer);
  }, [game, gameStarted]);

  const makeAIDecisionFallback = (player, gameState) => {
    const strategy = player.strategyConfig;
    if (!strategy) return { action: ACTIONS.CALL, amount: 0 };
    const rand = Math.random();
    if (rand < strategy.foldFreq) return { action: ACTIONS.FOLD, amount: 0 };
    if (rand < strategy.foldFreq + strategy.callFreq) {
      return { action: ACTIONS.CALL, amount: Math.min(gameState.toCall || 10, player.chips) };
    }
    if (rand < strategy.foldFreq + strategy.callFreq + strategy.raiseFreq) {
      return { action: ACTIONS.RAISE, amount: Math.min(30, player.chips) };
    }
    return { action: ACTIONS.ALL_IN, amount: player.chips };
  };

  const handleStartGame = () => {
    const newGame = gameTableEngine.createGame(playerCount, 0);
    const startedGame = gameTableEngine.startNewRound(newGame);
    setGame(startedGame);
    setGameStarted(true);
    setElapsed(0);
    logger.session('博弈台-开始博弈', { 参与人数: playerCount });
  };

  const handleAction = (action, amount = 0) => {
    if (!game) return;
    const humanPlayer = game.players.find(p => p.isHuman);
    if (!humanPlayer || humanPlayer.folded || humanPlayer.allIn) return;

    let actualAmount = amount;
    if (action === ACTIONS.RAISE && amount === 0) {
      actualAmount = Math.min(game.currentBet + 20, humanPlayer.chips + humanPlayer.currentBet);
    }

    let newGame = gameTableEngine.recordHumanDecision(game, { action, amount: actualAmount });
    newGame = gameTableEngine.executeAction(newGame, humanPlayer.id, action, actualAmount);
    newGame = gameTableEngine.advanceToNextPlayer(newGame);

    if (gameTableEngine.isPhaseComplete(newGame)) {
      if (newGame.players.filter(p => !p.folded).length <= 1) {
        newGame = gameTableEngine.showdown(newGame);
      } else {
        newGame = gameTableEngine.advancePhase(newGame);
      }
    }

    setGame(newGame);
    logger.session('博弈台-决策', {
      动作: ACTION_LABELS[action] || action,
      金额: actualAmount,
      阶段: PHASE_LABELS[game.phase],
    });
  };

  const handleNewRound = () => {
    if (!game) return;
    const newRound = gameTableEngine.startNewRound({
      ...game,
      dealerIndex: (game.dealerIndex + 1) % game.players.length,
      round: game.round + 1,
    });
    setGame(newRound);
    logger.session('博弈台-新一局', { 局数: newRound.round });
  };

  const handleEndGame = () => {
    if (!game) return;
    const humanPlayer = game.players.find(p => p.isHuman);
    const isWinner = humanPlayer && game.winner === humanPlayer.id;
    const result = isWinner ? 'win' : 'lose';
    gameTableEngine.saveGameRecord(game, result);
    logger.session('博弈台-结束对局', {
      结果: isWinner ? '胜利' : '失利',
      对局数: game.round,
      时长: gameTableEngine.formatDuration(elapsed),
    });
    if (onSessionEnd) onSessionEnd({ result, rounds: game.round, duration: elapsed });
    setGame(null);
    setGameStarted(false);
  };

  const toCall = game ? Math.max(0, game.currentBet - (game.players.find(p => p.isHuman)?.currentBet || 0)) : 0;

  // 游戏未开始 - 显示设置界面
  if (!gameStarted || !game) {
    return (
      <div className="gametable-trainer fade-in">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card style={{ background: 'rgba(30, 19, 64, 0.6)', borderRadius: 16 }}>
              <Title level={4} style={{ color: '#fff', marginTop: 0 }}>
                <TeamOutlined style={{ color: '#7c3aed', marginRight: 8 }} />
                对局设置
              </Title>

              <div style={{ marginBottom: 24 }}>
                <Text style={{ color: '#fff', marginBottom: 8, display: 'block' }}>
                  参与人数: <Tag color="purple">{playerCount} 人</Tag>
                </Text>
                <Slider
                  min={2}
                  max={4}
                  step={1}
                  value={playerCount}
                  onChange={(v) => {
                    setPlayerCount(v);
                    logger.session('博弈台-切换人数', { 人数: v });
                  }}
                  marks={{ 2: '2人', 3: '3人', 4: '4人' }}
                  tooltip={{ formatter: (v) => `${v}人博弈` }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <Text style={{ color: '#fff', marginBottom: 8, display: 'block' }}>
                  AI对手策略类型
                </Text>
                <Row gutter={[8, 8]}>
                  {Object.values(AI_STRATEGIES).map((s) => (
                    <Col xs={12} key={s.id}>
                      <Card size="small" style={{ background: 'rgba(124,58,237,0.1)', borderRadius: 8 }}>
                        <Text strong style={{ color: '#fff' }}>
                          {s.emoji} {s.name}
                        </Text>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {s.description}
                          </Text>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>

              <Button
                type="primary"
                size="large"
                icon={<ThunderboltOutlined />}
                onClick={handleStartGame}
                style={{ width: '100%', height: 48, fontSize: 16 }}
              >
                开始博弈
              </Button>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card
              style={{ marginTop: 0, background: 'rgba(30, 19, 64, 0.6)', borderRadius: 16, cursor: 'pointer' }}
              onClick={() => setShowStats(true)}
            >
              <Space>
                <InfoCircleOutlined style={{ color: '#7c3aed', fontSize: 20 }} />
                <div>
                  <Text strong style={{ color: '#fff' }}>模块说明</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      与德州扑克的区别 · 采集的数据维度 · 联动模块
                    </Text>
                  </div>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        <Modal
          title="模拟博弈台说明"
          open={showStats}
          onCancel={() => setShowStats(false)}
          footer={null}
          width={600}
        >
          <Divider orientation="left">与德州扑克的区别</Divider>
          <Row gutter={[12, 12]}>
            <Col xs={12}>
              <Card size="small" style={{ background: 'rgba(124,58,237,0.1)' }}>
                <Text strong style={{ color: '#7c3aed' }}>德州扑克</Text>
                <ul style={{ paddingLeft: 16, marginTop: 8 }}>
                  <li><Text type="secondary">单人对概率</Text></li>
                  <li><Text type="secondary">对手是"随机"</Text></li>
                  <li><Text type="secondary">采集风险偏好</Text></li>
                </ul>
              </Card>
            </Col>
            <Col xs={12}>
              <Card size="small" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <Text strong style={{ color: '#10b981' }}>模拟博弈台</Text>
                <ul style={{ paddingLeft: 16, marginTop: 8 }}>
                  <li><Text type="secondary">多人策略对抗</Text></li>
                  <li><Text type="secondary">对手是"策略体"</Text></li>
                  <li><Text type="secondary">采集社交智能</Text></li>
                </ul>
              </Card>
            </Col>
          </Row>

          <Divider orientation="left">采集的数据维度</Divider>
          <List
            size="small"
            dataSource={[
              { d: '对手建模能力', m: '市场分析能力' },
              { d: '策略切换频率', m: '适应性' },
              { d: '协作/竞争倾向', m: '社交偏好' },
              { d: '动态风险偏好', m: '情境风险偏好' },
              { d: '博弈结果', m: '长期竞争力' },
            ]}
            renderItem={(item) => (
              <List.Item>
                <Text>{item.d}</Text>
                <Tag color="purple">→ {item.m}</Tag>
              </List.Item>
            )}
          />

          <Divider orientation="left">联动模块</Divider>
          <List
            size="small"
            dataSource={[
              { m: '德州扑克', d: '风险偏好作为博弈台初始策略' },
              { m: '台球', d: '路径预判影响策略选择' },
              { m: '健身', d: '执行纪律影响策略坚持度' },
              { m: 'MindSpeak', d: '语言结构映射策略描述' },
              { m: '投资人档案', d: '策略风格匹配投资人人格' },
            ]}
            renderItem={(item) => (
              <List.Item>
                <Tag color="blue">{item.m}</Tag>
                <Text type="secondary">{item.d}</Text>
              </List.Item>
            )}
          />
        </Modal>
      </div>
    );
  }

  // 游戏进行中
  const humanPlayer = game.players.find(p => p.isHuman);
  const isHumanTurn = game.currentPlayerIndex === humanPlayer?.id && !humanPlayer?.folded && !humanPlayer?.allIn;
  const gameEnded = game.phase === GAME_PHASES.ENDED;

  return (
    <div className="gametable-trainer fade-in">
      <Card style={{ marginBottom: 16, background: 'rgba(30, 19, 64, 0.6)', borderRadius: 12 }}>
        <Space size="large" wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Tag color="purple">第 {game.round} 局</Tag>
            <Tag color="blue">{PHASE_LABELS[game.phase]}</Tag>
            <Tag color="gold">底池: 💰 {game.pot}</Tag>
            {aiThinking && <Tag color="processing">AI思考中...</Tag>}
          </Space>
          <Space>
            <Tag color="default">已用时: {gameTableEngine.formatDuration(elapsed)}</Tag>
            <Button size="small" onClick={handleEndGame}>
              结束对局
            </Button>
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            style={{
              background: 'radial-gradient(ellipse at center, #1e4d2b 0%, #0f2818 100%)',
              borderRadius: 16,
              border: '3px solid #7c3aed',
              minHeight: 480,
            }}
          >
            <Row gutter={[12, 12]} style={{ marginBottom: 24, justifyContent: 'center' }}>
              {game.players.filter((_, i) => i !== 0).map((player, idx) => (
                <Col xs={8} sm={6} key={player.id}>
                  <PlayerCard
                    player={player}
                    isCurrent={game.currentPlayerIndex === player.id}
                    isDealer={game.dealerIndex === player.id}
                    isWinner={game.winner === player.id}
                  />
                </Col>
              ))}
            </Row>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Tag color="gold" style={{ fontSize: 16, padding: '4px 16px', marginBottom: 12 }}>
                💰 底池: {game.pot}
              </Tag>
              <div style={{ marginBottom: 12 }}>
                <CommunityCards cards={game.communityCards} />
              </div>
            </div>

            <Row gutter={[12, 12]} style={{ justifyContent: 'center' }}>
              <Col xs={12} sm={8}>
                <PlayerCard
                  player={humanPlayer}
                  isCurrent={isHumanTurn}
                  isDealer={game.dealerIndex === humanPlayer?.id}
                  isWinner={game.winner === humanPlayer?.id}
                />
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Space size={4}>
                    {humanPlayer?.hand.map((card, i) => (
                      <div
                        key={i}
                        style={{
                          width: 40,
                          height: 56,
                          borderRadius: 6,
                          background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                          border: '2px solid #10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          color: ['♥', '♦'].includes(card.suit) ? '#ef4444' : '#1a1a1a',
                          fontWeight: 'bold',
                        }}
                      >
                        {card.rank}{card.suit}
                      </div>
                    ))}
                  </Space>
                </div>
              </Col>
            </Row>

            {gameEnded && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Tag color={game.winner === humanPlayer?.id ? 'green' : 'red'} style={{ fontSize: 18, padding: '8px 24px' }}>
                  {game.winner === humanPlayer?.id ? '🎉 你赢了！' : '💔 本局失利'}
                </Tag>
                <div style={{ marginTop: 12 }}>
                  <Button type="primary" icon={<ReloadOutlined />} onClick={handleNewRound}>
                    再来一局
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {!gameEnded && (
            <Card style={{ marginTop: 16, background: 'rgba(30, 19, 64, 0.6)', borderRadius: 12 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
                <Text style={{ color: '#fff' }}>
                  你的筹码: <Tag color="green">💰 {humanPlayer?.chips}</Tag>
                  {toCall > 0 && (
                    <Tag color="orange" style={{ marginLeft: 8 }}>
                      需跟注: {toCall}
                    </Tag>
                  )}
                </Text>
                <Tag color={isHumanTurn ? 'processing' : 'default'}>
                  {isHumanTurn ? '轮到你决策' : '等待其他玩家...'}
                </Tag>
              </Space>
              <Space size="middle" wrap>
                <Button danger disabled={!isHumanTurn || humanPlayer?.folded} onClick={() => handleAction(ACTIONS.FOLD)}>
                  弃牌
                </Button>
                <Button type="primary" disabled={!isHumanTurn || toCall <= 0} onClick={() => handleAction(ACTIONS.CALL)}>
                  跟注 {toCall > 0 ? toCall : ''}
                </Button>
                <Button type="primary" ghost disabled={!isHumanTurn} onClick={() => handleAction(ACTIONS.RAISE)}>
                  加注
                </Button>
                <Button danger type="primary" disabled={!isHumanTurn || humanPlayer?.chips <= 0} onClick={() => handleAction(ACTIONS.ALL_IN)}>
                  All-in ({humanPlayer?.chips})
                </Button>
              </Space>
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <OpponentAnalysisPanel players={game.players} />
          <div style={{ marginTop: 16 }}>
            <ActionLog actionLog={game.actionLog} players={game.players} />
          </div>
        </Col>
      </Row>
    </div>
  );
};

// ============= GameTablePage 主组件 =============
const GameTablePage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('lobby');

  // 统计数据
  const profile = useMemo(() => gameTableEngine.analyzeGameBehavior(), []);

  // 读取历史会话
  const historySessions = useMemo(() => {
    return storage.get('gameTableSessions') || [];
  }, []);

  // ============= 渲染：大厅 =============
  const renderLobby = () => (
    <div className="gametable-lobby">
      <Card className="gametable-hero-card">
        <div className="gametable-hero-content">
          <div className="gametable-hero-text">
            <Text className="gametable-hero-greeting">🎮 模拟博弈台</Text>
            <Title level={2} className="gametable-hero-title">
              在<span className="gradient-text">多人策略对抗</span>中发现你的社交智能
            </Title>
            <Paragraph className="gametable-hero-desc">
              每一局博弈都是对手建模的练习，每一次决策都是策略适应性的采样。
              系统追踪你与不同AI策略体的互动模式，构建「社交智能+策略风格」画像。
            </Paragraph>
            <Space size="middle">
              <Button type="primary" size="large" icon={<PlayCircleOutlined />} className="quick-start-btn" onClick={() => setActiveTab('trainer')}>
                开始博弈
              </Button>
            </Space>
          </div>
          <div className="gametable-hero-stats">
            <div className="gametable-hero-stat">
              <span className="stat-emoji">🎮</span>
              <span className="stat-value">{profile.totalGames || 0}</span>
              <span className="stat-label">总对局数</span>
            </div>
            <div className="gametable-hero-stat">
              <span className="stat-emoji">🏆</span>
              <span className="stat-value">{profile.winRate || 0}%</span>
              <span className="stat-label">胜率</span>
            </div>
            <div className="gametable-hero-stat">
              <span className="stat-emoji">🎭</span>
              <span className="stat-value">{profile.opponentModelingAccuracy || 0}%</span>
              <span className="stat-label">对手识别</span>
            </div>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]} className="gametable-stats-row">
        <Col xs={12} md={6}>
          <Card className="gametable-stat-card">
            <Statistic title={<span><ThunderboltOutlined /> 策略适应性</span>} value={profile.strategyAdaptability || 0} suffix="分" valueStyle={{ color: '#8b5cf6' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="gametable-stat-card">
            <Statistic title={<span><TeamOutlined /> 对手建模</span>} value={profile.opponentModelingAccuracy || 0} suffix="%" valueStyle={{ color: '#ec4899' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="gametable-stat-card">
            <Statistic title={<span><RiseOutlined /> 风险调整</span>} value={profile.riskAdjustmentScore || 0} suffix="分" valueStyle={{ color: '#22c55e' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="gametable-stat-card">
            <Statistic title={<span><ClockCircleOutlined /> 总对局</span>} value={profile.totalGames || 0} valueStyle={{ color: '#06b6d4' }} />
          </Card>
        </Col>
      </Row>

      <Card title={<span><DatabaseOutlined /> 你的哪些数据会被记录？</span>} className="gametable-data-info-card" extra={<Tooltip title="所有数据仅用于本地人格建模，不会上传"><InfoCircleOutlined style={{ color: '#8b5cf6' }} /></Tooltip>}>
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
    <div className="gametable-stats-page">
      <Card className="gametable-profit-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div className="stats-section">
              <Text type="secondary">博弈总览</Text>
              <Title level={2} style={{ margin: 0 }}>{profile.totalGames || 0} 局</Title>
              <Tag color="green"><RiseOutlined /> 胜率 {profile.winRate || 0}%</Tag>
            </div>
          </Col>
          <Col xs={12} md={4}><Statistic title="策略适应性" value={profile.strategyAdaptability || 0} suffix="分" valueStyle={{ color: '#8b5cf6' }} /></Col>
          <Col xs={12} md={4}><Statistic title="对手建模" value={profile.opponentModelingAccuracy || 0} suffix="%" valueStyle={{ color: '#3b82f6' }} /></Col>
          <Col xs={12} md={4}><Statistic title="风险调整" value={profile.riskAdjustmentScore || 0} suffix="分" valueStyle={{ color: '#22c55e' }} /></Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={<span><LineChartOutlined /> 核心指标</span>} className="gametable-stats-card">
            <List
              dataSource={[
                { label: '胜率', value: (profile.winRate || 0) / 100, target: '40%-60%' },
                { label: '对手建模准确度', value: (profile.opponentModelingAccuracy || 0) / 100, target: '>60%' },
                { label: '策略适应性', value: (profile.strategyAdaptability || 0) / 100, target: '>50分' },
                { label: '风险调整能力', value: (profile.riskAdjustmentScore || 0) / 100, target: '>50分' },
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
          <Card title={<span><FireOutlined /> 行为标签</span>} className="gametable-stats-card">
            <div className="behavior-tags">
              <Tag color="purple" icon={<TeamOutlined />} className="behavior-tag">🎭 策略分析型</Tag>
              <Tag color="orange" icon={<ThunderboltOutlined />} className="behavior-tag">⚡ 快速决策者</Tag>
              <Tag color="blue" icon={<BulbOutlined />} className="behavior-tag">🧠 自适应策略</Tag>
              <Tag color="green" icon={<SafetyOutlined />} className="behavior-tag">🛡️ 风险可控</Tag>
            </div>
            <Divider />
            <div className="mbti-mapping">
              <Text type="secondary">基于当前行为模式的 MBTI 推断：</Text>
              <div className="mbti-mapping-row">
                <Tag color="purple" className="mbti-tag">ENTJ</Tag>
                <Text type="secondary">置信度 58%</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>提示：更多对局数据将提升人格画像准确度</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title={<span><ClockCircleOutlined /> 历史对局记录</span>} className="gametable-stats-card">
        {historySessions.length === 0 ? (
          <Empty description="暂无对局记录，开始博弈后会保存每一局的数据" />
        ) : (
          <List
            dataSource={[...historySessions].reverse()}
            renderItem={(session, idx) => (
              <List.Item>
                <Space>
                  <Avatar style={{ backgroundColor: '#7c3aed' }}>{idx + 1}</Avatar>
                  <Text>{session.summary || '对局完成'}</Text>
                  <Tag color={session.result === 'win' ? 'green' : 'red'}>{session.result === 'win' ? '胜' : '负'}</Tag>
                  <Tag color="purple">{session.rounds || 0} 局</Tag>
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
    <div className="gametable-behavior-page">
      <Card className="behavior-overview-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">🎮</span>
              <div>
                <Text type="secondary">已采集对局样本</Text>
                <Title level={3} style={{ margin: 0 }}>{profile.totalGames || 0}</Title>
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">📊</span>
              <div>
                <Text type="secondary">数据维度覆盖</Text>
                <Title level={3} style={{ margin: 0 }}>4 / 8</Title>
                <Progress percent={50} size="small" showInfo={false} />
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div className="behavior-overview-item">
              <span className="behavior-overview-icon">🧠</span>
              <div>
                <Text type="secondary">人格画像准确度</Text>
                <Title level={3} style={{ margin: 0 }}>58%</Title>
                <Progress percent={58} size="small" strokeColor="#8b5cf6" showInfo={false} />
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
                  <Progress percent={Math.floor(Math.random() * 40 + 40)} size="small" showInfo={false} />
                  <Text type="secondary" style={{ fontSize: 12 }}>样本充足度</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title={<span><InfoCircleOutlined /> 数据如何被使用？</span>} className="behavior-dataflow-card">
        <div className="dataflow-steps">
          <div className="dataflow-step"><div className="dataflow-step-icon">🎮</div><div className="dataflow-step-content"><Text strong>Step 1: 博弈中采集</Text><Paragraph type="secondary">每一次决策、对手识别、策略切换都被记录为结构化数据</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">🎭</div><div className="dataflow-step-content"><Text strong>Step 2: 对手建模分析</Text><Paragraph type="secondary">追踪你对不同AI策略的识别准确度，构建市场分析能力画像</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">🧠</div><div className="dataflow-step-content"><Text strong>Step 3: 人格画像映射</Text><Paragraph type="secondary">策略适应性→Te维度，协作/竞争→Fe维度，动态风险→P/J维度</Paragraph></div></div>
          <div className="dataflow-arrow">→</div>
          <div className="dataflow-step"><div className="dataflow-step-icon">✨</div><div className="dataflow-step-content"><Text strong>Step 4: 个性化反馈</Text><Paragraph type="secondary">生成谈判策略建议、社交风格优化、领导力培养路径</Paragraph></div></div>
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
    <div className="gametable-page">
      <div className="gametable-page-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>返回首页</Button>
        <Title level={4} style={{ margin: 0 }}>
          <span className="gradient-text">🎮 模拟博弈台</span>
          <Text type="secondary" style={{ marginLeft: 12, fontWeight: 'normal' }}>
            多人策略对抗 · 社交智能与策略风格的行为采集入口
          </Text>
        </Title>
        <Space><Badge status="success" text="采样中" /></Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className="gametable-tabs"
        items={[
          { key: 'lobby', label: <span><PlayCircleOutlined /> 入口大厅</span> },
          { key: 'trainer', label: <span><ThunderboltOutlined /> 博弈对战</span> },
          { key: 'stats', label: <span><LineChartOutlined /> 数据统计</span> },
          { key: 'behavior', label: <span><DatabaseOutlined /> 行为采集</span> },
        ]}
      />

      {activeTab === 'lobby' && renderLobby()}
      {activeTab === 'trainer' && <GameTableTrainer />}
      {activeTab === 'stats' && renderStats()}
      {activeTab === 'behavior' && renderBehavior()}
    </div>
  );
};

export default GameTablePage;
