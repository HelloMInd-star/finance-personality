import React, { useState, useMemo } from 'react';
import { Button, Space, Card, Tag, Tooltip, Modal, Slider } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ThunderboltOutlined, 
  FireOutlined, 
  SafetyOutlined,
  TrophyOutlined,
  LogoutOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  HistoryOutlined,
  ColumnWidthOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { useGameStore } from '../../store/gameStore';
import './PokerTable.css';

const PokerTable = ({ gameState, playerId, showDashboard = true, onToggleDashboard }) => {
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(20);
  const { 
    sendAction, 
    isConnected, 
    isAiThinking, 
    actionHistory,
    startNewHand,
    leaveGame,
    isLoading
  } = useGameStore();

  if (!gameState) {
    return (
      <Card className="poker-table-container">
        <div className="empty-state">
          <span className="empty-icon">♠️</span>
          <p>等待游戏开始...</p>
          <p className="empty-hint">请在大厅创建或加入游戏</p>
        </div>
      </Card>
    );
  }

  const { players, board, pot, stage, hand_over, current_player } = gameState;
  
  const currentPlayer = players?.find(p => p.id === playerId);
  const isMyTurn = currentPlayer && 
    !hand_over && 
    players[current_player]?.id === playerId &&
    !currentPlayer.folded &&
    !currentPlayer.all_in;

  const aiPlayers = players?.filter(p => p.is_ai) || [];
  const currentBet = Math.max(...(players?.map(p => p.bet || 0) || [0]));
  const myCurrentBet = currentPlayer?.bet || 0;
  const needCall = currentBet - myCurrentBet;

  const handleAction = (action, amount = 0) => {
    if (!isMyTurn) return;
    sendAction(action, amount);
  };

  // 计算加注预设
  const raisePresets = useMemo(() => {
    const halfPot = Math.floor(pot / 2) + needCall;
    const onePot = pot + needCall;
    const twoPot = pot * 2 + needCall;
    const allIn = currentPlayer?.chips || 0;
    return [
      { label: '½底池', value: Math.max(needCall + 10, halfPot) },
      { label: '1倍底池', value: Math.max(needCall + 20, onePot) },
      { label: '2倍底池', value: Math.max(needCall + 40, twoPot) },
      { label: 'ALL IN', value: allIn }
    ];
  }, [pot, needCall, currentPlayer]);

  // 玩家座位布局
  const getPlayerPosition = (index, total) => {
    if (total <= 2) {
      return index === 0 
        ? { bottom: '20px', left: '50%', transform: 'translateX(-50%)' }
        : { top: '20px', left: '50%', transform: 'translateX(-50%)' };
    }
    const angle = (index * 360 / total - 90) * Math.PI / 180;
    const radius = 180;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return {
      left: `calc(50% + ${x}px)`,
      top: `calc(50% + ${y}px)`,
      transform: 'translate(-50%, -50%)'
    };
  };

  const renderCard = (card, index, hidden = false) => {
    if (hidden) {
      return (
        <motion.div
          key={`hidden-${index}`}
          className="card card-back"
          initial={{ scale: 0, y: -30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ delay: index * 0.1, type: 'spring' }}
        >
          <span className="card-back-pattern">♠♥</span>
        </motion.div>
      );
    }
    if (!card) {
      return <div key={index} className="card-slot"><span>?</span></div>;
    }
    return (
      <motion.div
        key={index}
        className={`card ${card.color}`}
        initial={{ scale: 0, rotate: -180, y: -50 }}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        transition={{ delay: index * 0.1, type: 'spring', stiffness: 200 }}
      >
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit">{card.suit}</span>
        <span className="card-rank-bottom">{card.rank}</span>
      </motion.div>
    );
  };

  const renderPlayer = (player, index) => {
    const isCurrent = players[current_player]?.id === player.id;
    const isMe = player.id === playerId;
    const isAI = player.is_ai;
    const isActive = !player.folded && !player.all_in;
    const pos = getPlayerPosition(index, players?.length || 2);

    return (
      <motion.div
        key={player.id}
        className={`player-seat ${isCurrent ? 'active' : ''} ${isMe ? 'me' : ''} ${player.folded ? 'folded' : ''}`}
        style={{ position: 'absolute', ...pos }}
        animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: isCurrent ? Infinity : 0, duration: 1.5 }}
      >
        <div className="player-avatar">
          {isAI ? '🤖' : (isMe ? '🧑‍💻' : '👤')}
          {isCurrent && <div className="active-indicator">●</div>}
          {isAI && isAiThinking && isCurrent && (
            <div className="thinking-dots">
              <span>•</span><span>•</span><span>•</span>
            </div>
          )}
        </div>
        <div className="player-info">
          <div className="player-name">
            {player.name}
            {isAI && <Tag color="purple" size="small">AI</Tag>}
            {isMe && <Tag color="blue">你</Tag>}
          </div>
          <div className="player-chips">💰 {player.chips}</div>
          {player.bet > 0 && (
            <motion.div 
              className="player-bet" 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              下注: {player.bet}
            </motion.div>
          )}
          {player.folded && <Tag color="red">弃牌</Tag>}
          {player.all_in && (
            <Tag color="orange" className="allin-tag">
              <FireOutlined /> ALL IN
            </Tag>
          )}
        </div>
        {isActive && player.hole_cards?.length === 2 && (
          <div className="player-cards">
            {isMe ? (
              player.hole_cards.map((card, i) => (
                <div key={i} className={`card-small ${card.color}`}>
                  <span>{card.rank}{card.suit}</span>
                </div>
              ))
            ) : (
              [0, 1].map(i => (
                <div key={i} className="card-small card-back-small">
                  <span>♠♥</span>
                </div>
              ))
            )}
          </div>
        )}
      </motion.div>
    );
  };

  const getStageTag = () => {
    const stageMap = {
      preflop: { label: 'PREFLOP', color: 'blue' },
      flop: { label: 'FLOP', color: 'cyan' },
      turn: { label: 'TURN', color: 'purple' },
      river: { label: 'RIVER', color: 'orange' },
      showdown: { label: 'SHOWDOWN', color: 'red' }
    };
    return stageMap[stage] || stageMap.preflop;
  };

  const stageInfo = getStageTag();
  const history = useGameStore.getState().actionHistory;

  // 行动名称映射
  const actionNameMap = {
    fold: '弃牌', check: '过牌', call: '跟注', raise: '加注', allin: 'ALL IN'
  };

  return (
    <div className="poker-table-container">
      <div className="poker-table">
        {/* 顶部工具栏 */}
        <div className="table-toolbar">
          <Space size={8}>
            <Tooltip title="查看行动历史">
              <Button 
                icon={<HistoryOutlined />} 
                size="small" 
                onClick={() => setShowHistory(true)}
              >
                历史
              </Button>
            </Tooltip>
            <Tooltip title={showDashboard ? '专注模式（隐藏仪表盘）' : '完整模式（显示仪表盘）'}>
              <Button 
                icon={showDashboard ? <ColumnWidthOutlined /> : <AppstoreOutlined />} 
                size="small"
                onClick={onToggleDashboard}
              >
                {showDashboard ? '专注' : '完整'}
              </Button>
            </Tooltip>
          </Space>
          <Space>
            <Tooltip title="退出游戏">
              <Button 
                icon={<LogoutOutlined />} 
                size="small" 
                danger 
                onClick={leaveGame}
              >
                退出
              </Button>
            </Tooltip>
          </Space>
        </div>

        {/* 阶段标识 */}
        <div className="table-stage">
          <Tag color={stageInfo.color} className="stage-tag">
            {stageInfo.label}
          </Tag>
          {hand_over && <Tag color="gold">牌局结束</Tag>}
          {isAiThinking && !hand_over && <Tag color="processing">🤖 AI思考中</Tag>}
        </div>

        {/* 底池 */}
        <motion.div 
          className="table-pot"
          key={pot}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring' }}
        >
          <span className="pot-icon">🪙</span>
          <span className="pot-amount">{pot}</span>
          <span className="pot-label">底池</span>
        </motion.div>

        {/* 玩家座位 */}
        <div className="player-seats">
          {players?.map((player, index) => renderPlayer(player, index))}
        </div>

        {/* 公共牌区 */}
        <div className="board-cards">
          {board?.length > 0 ? (
            board.map((card, index) => renderCard(card, index))
          ) : (
            <div className="board-empty"><span>等待发牌...</span></div>
          )}
        </div>

        {/* 行动按钮区 */}
        <div className="action-buttons">
          {hand_over ? (
            <Space size="middle">
              <Button 
                type="primary" 
                size="large" 
                icon={<ReloadOutlined />}
                loading={isLoading}
                onClick={startNewHand}
              >
                再来一局
              </Button>
              <Button size="large" danger icon={<LogoutOutlined />} onClick={leaveGame}>
                退出牌桌
              </Button>
            </Space>
          ) : isMyTurn ? (
            <Space size="middle">
              <Tooltip title="放弃本手牌">
                <Button className="action-btn fold" onClick={() => handleAction('fold')}>
                  弃牌
                </Button>
              </Tooltip>
              <Tooltip title={needCall > 0 ? `跟注 ${needCall}` : '过牌'}>
                <Button className="action-btn call" onClick={() => handleAction('call')}>
                  {needCall > 0 ? `跟注 ${needCall}` : '过牌'}
                </Button>
              </Tooltip>
              <Tooltip title="加注到指定金额">
                <Button className="action-btn raise" onClick={() => {
                  setRaiseAmount(Math.max(needCall + 20, raisePresets[0].value));
                  setShowRaiseModal(true);
                }}>
                  加注
                </Button>
              </Tooltip>
              <Tooltip title="全押所有筹码">
                <Button className="action-btn allin" onClick={() => handleAction('allin')}>
                  <FireOutlined /> ALL IN
                </Button>
              </Tooltip>
            </Space>
          ) : (
            <div className="waiting-message">
              {isAiThinking ? (
                <span className="ai-thinking">
                  🤖 AI思考中<span className="thinking-dots-inline">...</span>
                </span>
              ) : (
                <span>等待对手行动...</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 加注弹窗 */}
      <Modal
        title={<span><ThunderboltOutlined /> 加注</span>}
        open={showRaiseModal}
        onCancel={() => setShowRaiseModal(false)}
        footer={null}
        className="raise-modal"
        width={420}
      >
        <div className="raise-content">
          <div className="raise-info">
            <span>当前需跟注: <b>{needCall}</b></span>
            <span>底池: <b>{pot}</b></span>
            <span>你的筹码: <b>{currentPlayer?.chips || 0}</b></span>
          </div>
          <div className="raise-presets">
            {raisePresets.map((p, i) => (
              <Button 
                key={i} 
                type={raiseAmount === p.value ? 'primary' : 'default'}
                onClick={() => setRaiseAmount(p.value)}
                className={`preset-btn preset-${i}`}
              >
                {p.label}
                <div className="preset-value">{p.value}</div>
              </Button>
            ))}
          </div>
          <div className="raise-slider">
            <Slider
              min={needCall + 10}
              max={currentPlayer?.chips || 1000}
              value={raiseAmount}
              onChange={(v) => setRaiseAmount(v)}
              step={10}
            />
            <div className="raise-value-display">
              加注到: <b>{raiseAmount}</b>
            </div>
          </div>
          <Button 
            type="primary" 
            block 
            size="large"
            onClick={() => {
              handleAction('raise', raiseAmount);
              setShowRaiseModal(false);
            }}
          >
            确认加注 {raiseAmount}
          </Button>
        </div>
      </Modal>

      {/* 行动历史弹窗 */}
      <Modal
        title={<span><HistoryOutlined /> 本局行动记录</span>}
        open={showHistory}
        onCancel={() => setShowHistory(false)}
        footer={null}
        width={380}
      >
        <div className="history-list">
          {history.length === 0 ? (
            <div className="history-empty">暂无行动记录</div>
          ) : (
            history.map((h, i) => {
              const p = players?.find(pl => pl.id === h.playerId);
              return (
                <div key={i} className="history-item">
                  <span className="history-player">{p?.name || h.playerId}</span>
                  <Tag color={h.action === 'fold' ? 'red' : h.action === 'raise' ? 'orange' : 'blue'}>
                    {actionNameMap[h.action] || h.action}
                  </Tag>
                  {h.amount > 0 && <span className="history-amount">{h.amount}</span>}
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
};

export default PokerTable;
