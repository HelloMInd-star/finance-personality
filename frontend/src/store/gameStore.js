import { create } from 'zustand';
import { logger } from '../utils/logger';
import { apiClient } from '../utils/apiClient';

export const useGameStore = create((set, get) => ({
  // 状态
  gameState: null,
  socket: null,
  currentGameId: null,
  playerId: null,
  isConnected: false,
  isLoading: false,
  error: null,
  history: [],
  stats: null,
  pingInterval: null,
  actionHistory: [],
  isAiThinking: false,
  handResult: null,

  // 连接游戏
  connectToGame: (gameId, playerId) => {
    const { socket, disconnectGame } = get();
    
    // 如果有旧连接，先断开
    if (socket) {
      disconnectGame();
    }

    // 确定WebSocket URL：优先使用环境变量，否则使用当前host（支持代理）
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}`;
    // 携带 player_id 查询参数,后端按 viewer_id 过滤底牌防作弊
    const wsUrl = `${wsHost}/ws/${gameId}?player_id=${playerId}`;

    console.log('连接WebSocket:', wsUrl);

    // 创建原生WebSocket连接
    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log('WebSocket 连接成功');
      set({ isConnected: true, currentGameId: gameId, playerId });
      
      // 发送心跳保持连接
      const interval = setInterval(() => {
        if (newSocket.readyState === WebSocket.OPEN) {
          newSocket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
      set({ pingInterval: interval });
    };

    newSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;
        
        switch (type) {
          case 'pong':
            break;
          case 'game_state':
            set({ gameState: data || message });
            break;
          case 'action_result':
            console.log('行动结果:', data);
            if (data?.player_id) {
              set((state) => ({
                actionHistory: [...state.actionHistory.slice(-30), {
                  playerId: data.player_id,
                  action: data.action,
                  amount: data.amount || 0,
                  timestamp: Date.now()
                }]
              }));
            }
            break;
          case 'ai_action':
            console.log('AI行动:', data);
            set({ isAiThinking: false });
            if (data?.player_id) {
              set((state) => ({
                actionHistory: [...state.actionHistory.slice(-30), {
                  playerId: data.player_id,
                  action: data.action,
                  amount: data.amount || 0,
                  isAi: true,
                  timestamp: Date.now()
                }]
              }));
            }
            break;
          case 'system_message':
            console.log('系统消息:', data);
            break;
          case 'player_joined':
            console.log('玩家加入:', data);
            break;
          case 'chat':
            console.log('聊天消息:', data);
            break;
          case 'hand_over':
            console.log('牌局结束:', data);
            set({ handResult: data, isAiThinking: false });
            break;
          case 'ai_thinking':
            set({ isAiThinking: true });
            break;
          case 'error':
            set({ error: data?.message || '连接错误' });
            console.error('WebSocket错误:', data);
            break;
          default:
            console.log('收到消息:', message);
        }
      } catch (e) {
        console.error('解析WebSocket消息失败:', e);
      }
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket错误:', error);
      set({ error: 'WebSocket连接错误' });
    };

    newSocket.onclose = () => {
      console.log('WebSocket 断开连接');
      const { pingInterval } = get();
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      set({ isConnected: false, pingInterval: null });
    };

    set({ socket: newSocket });
    return newSocket;
  },

  // 断开游戏
  disconnectGame: () => {
    logger.game('断开游戏连接');
    const { socket, pingInterval } = get();
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    if (socket) {
      socket.close();
    }
    set({ 
      socket: null, 
      isConnected: false, 
      currentGameId: null,
      gameState: null,
      playerId: null,
      pingInterval: null
    });
  },

  // 发送消息
  _sendMessage: (message) => {
    const { socket, isConnected } = get();
    if (!socket || !isConnected) {
      console.error('未连接到游戏');
      return;
    }
    if (socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket未就绪');
      return;
    }
    socket.send(JSON.stringify(message));
  },

  // 发送行动
  sendAction: (action, amount = 0) => {
    logger.game('玩家行动', `action:${action}`, amount > 0 ? `amount:${amount}` : '');
    const { playerId } = get();
    get()._sendMessage({
      type: 'action',
      data: {
        player_id: playerId,
        action: action,
        amount: amount
      }
    });
  },

  // 发送聊天消息
  sendChat: (message) => {
    get()._sendMessage({
      type: 'chat',
      data: {
        player_name: 'Player',
        message: message
      }
    });
  },

  // 创建游戏
  createGame: async (playerName, aiDifficulty = 'medium') => {
    const done = logger.flow('创建牌局', `开始 - 玩家:${playerName}`, `难度:${aiDifficulty}`);
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.post('/game/create', {
        player_name: playerName,
        ai_difficulty: aiDifficulty
      });
      const { game_id, player_id } = data;
      
      // 连接到游戏
      get().connectToGame(game_id, player_id);
      
      // 自动开始游戏
      await get().startGame(game_id);
      
      set({ isLoading: false });
      done('成功', `gameId:${game_id} playerId:${player_id}`);
      return { gameId: game_id, playerId: player_id };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      done('失败', error.message);
      throw error;
    }
  },

  // 加入游戏
  joinGame: async (gameId, playerName) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.post(`/game/${gameId}/join`, {
        player_name: playerName
      });
      const { player_id, game_state } = data;
      
      // 连接到游戏
      get().connectToGame(gameId, player_id);
      
      // 如果游戏还没开始或已结束，自动开始
      if (!game_state || game_state.hand_over || game_state.board?.length === 0) {
        await get().startGame(gameId);
      }
      
      set({ isLoading: false });
      return { playerId: player_id };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // 开始游戏
  startGame: async (gameId) => {
    logger.game('开始游戏', `gameId:${gameId}`);
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.post(`/game/${gameId}/start`);
      logger.game('游戏已开始', `阶段:${data?.stage || 'preflop'}`, `玩家数:${data?.players?.length || 0}`);
      set({ gameState: data, isLoading: false });
      return data;
    } catch (error) {
      logger.error('开始游戏失败', error.message);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // 再来一局
  startNewHand: async () => {
    const { currentGameId } = get();
    if (!currentGameId) {
      logger.game('开始新局失败: 无当前 gameId');
      return;
    }
    logger.game('开始新局', `gameId:${currentGameId}`);
    set({ handResult: null, actionHistory: [], isLoading: true });
    try {
      const data = await apiClient.post(`/game/${currentGameId}/start`);
      logger.game('新局已开始');
      set({ gameState: data, isLoading: false });
      return data;
    } catch (error) {
      logger.error('开始新局失败', error.message);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // 离开游戏
  leaveGame: () => {
    logger.game('离开游戏');
    get().disconnectGame();
  },

  // 清理牌局结果
  clearHandResult: () => set({ handResult: null }),

  // 获取统计数据
  fetchStats: async (playerId) => {
    try {
      const data = await apiClient.get(`/stats/${playerId}`);
      set({ stats: data });
      return data;
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  },

  // 重置错误
  clearError: () => set({ error: null }),
}));
