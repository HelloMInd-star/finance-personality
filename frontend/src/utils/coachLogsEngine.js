/**
 * 陪练记录引擎
 * 管理陪练会话、消息、统计
 * 
 * 数据源优先级：
 *   1. 后端 API (/api/coach/*)
 *   2. localStorage 降级（后端不可用时）
 */
import { storage } from './storage';
import { logger } from './logger';
import { coachApi } from './coachApi';
import { getCurrentUserId } from './userContext';

const STORAGE_KEY = 'coachSessions';

// 后端可用性状态（首次调用失败后自动降级）
let backendAvailable = true;

// ============================================================
// 工具函数
// ============================================================

const genId = (prefix = 'sess') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const formatDate = (timestamp) => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * 执行 API 调用，失败时自动降级到 localStorage
 */
const tryApi = async (apiFn, fallbackFn, operationName) => {
  if (backendAvailable) {
    try {
      const result = await apiFn();
      return result;
    } catch (e) {
      if (e.isNetworkError || e.message?.includes('Failed to fetch')) {
        logger.session(`[降级] ${operationName} API不可用，切换到 localStorage`);
        backendAvailable = false;
      } else {
        logger.error(`[${operationName}] API错误`, e.message);
      }
    }
  }
  return fallbackFn();
};

// ============================================================
// 模拟数据生成（降级时使用）
// ============================================================

const GAME_TYPES = [
  { key: 'poker', label: '德州扑克', icon: '🃏' },
  { key: 'game_table', label: '模拟博弈台', icon: '♟️' },
  { key: 'billiards', label: '台球', icon: '🎱' },
];

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const MOODS = ['calm', 'anxious', 'excited', 'tired', 'focused'];

const COACH_SUMMARIES = [
  '今天整体偏激进，翻牌前加注频率偏高。建议在按钮位以后的位置可以更紧凑一些。',
  '表现不错，翻牌后的弃牌时机把握得很好。继续保持这种纪律性。',
  '今日筹码波动较大，有几手可以弃掉的牌选择了跟注。建议反思这几手的决策过程。',
  '位置感很好，总是能在有利位置入局。接下来可以练习三底池的处理。',
  '今天明显比上次更有耐心，入局频率下降了 15%，胜率反而提升了。这就是纪律的力量。',
  '有几手大底池处理得不够冷静，被对手反加注后容易上头。建议下次遇到类似情况先深呼吸。',
];

const HAND_REVIEWS = [
  '这手牌你在按钮位加注 3BB 是合理的，面对小盲的 3Bet，选择跟注也没问题。翻牌后中了顶对，下注半池是标准打法。',
  '这手牌 AJo 在 UTG 加注是可以的，但面对 3Bet 选择 4Bet 就有些激进了。对手的范围通常比你强，这里弃牌更合适。',
  '这手牌 KK 打得很漂亮！翻牌前慢打、翻牌后持续下注、转牌加大注，完美的价值获取。',
  '这手牌 72o 在大盲位面对加注选择了弃牌，非常好的纪律性。不要被赔率诱惑，位置差的时候要果断。',
];

const COACH_TIPS = [
  '💡 记住：位置 > 牌力。好位置的弱牌往往比差位置的强牌更有价值。',
  '💡 每次上桌前给自己定一个目标：今天我要练什么？比如"练翻牌后弃牌"。',
  '💡 连续输 3 手牌就站起来休息 5 分钟，不要试图"马上赢回来"。',
  '💡 你的筹码 = 你的士兵。不要在没有优势的战场上投入士兵。',
];

const generateMockMessages = (sessionId, gameType, hands) => {
  const messages = [];
  let handIndex = 0;

  messages.push({
    id: genId('msg'),
    session_id: sessionId,
    role: 'system',
    message_type: 'system',
    content: '陪练已就位，祝你好运！',
    created_at: Date.now() - (hands * 180000) - 60000,
  });

  const reviewCount = Math.min(hands, 4 + Math.floor(Math.random() * 4));
  for (let i = 0; i < reviewCount; i++) {
    handIndex = Math.floor(Math.random() * hands);
    messages.push({
      id: genId('msg'),
      session_id: sessionId,
      role: 'coach',
      message_type: 'hand_review',
      content: randomChoice(HAND_REVIEWS),
      hand_id: `hand_${sessionId}_${handIndex}`,
      metadata: {
        hand: randomChoice(['AKs', 'QQ', 'JJ', 'ATo', 'KQs', '99']),
        position: randomChoice(['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB']),
        pot: Math.floor(Math.random() * 500) + 50,
      },
      created_at: Date.now() - (hands - handIndex) * 180000,
    });

    if (Math.random() > 0.5) {
      messages.push({
        id: genId('msg'),
        session_id: sessionId,
        role: 'coach',
        message_type: 'tip',
        content: randomChoice(COACH_TIPS),
        created_at: Date.now() - (hands - handIndex) * 180000 + 30000,
      });
    }
  }

  if (Math.random() > 0.4) {
    messages.push({
      id: genId('msg'),
      session_id: sessionId,
      role: 'user',
      message_type: 'chat',
      content: randomChoice([
        '这手牌我应该弃牌吗？',
        '面对持续下注我该怎么应对？',
        '我的位置感怎么样？',
        '今天我最大的问题是什么？',
      ]),
      created_at: Date.now() - 300000,
    });
    messages.push({
      id: genId('msg'),
      session_id: sessionId,
      role: 'coach',
      message_type: 'chat',
      content: randomChoice([
        '让我看看这几手牌的数据... 你最大的问题是翻牌后面对加注的应对，70% 的情况下选择了跟注而不是弃牌或再加注。',
        '位置感整体不错，BTN 位入局率 35% 是合理的。但 UTG 位 22% 偏高了，建议降到 15% 以下。',
        '面对持续下注，你要先问自己：我的牌有改进潜力吗？我有位置吗？对手是激进型还是保守型？',
      ]),
      created_at: Date.now() - 280000,
    });
  }

  return messages.sort((a, b) => a.created_at - b.created_at);
};

const generateMockSessions = (count = 12) => {
  const sessions = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const gameType = randomChoice(GAME_TYPES);
    const difficulty = randomChoice(DIFFICULTIES);
    const hands = 20 + Math.floor(Math.random() * 60);
    const handsWon = Math.floor(hands * (0.35 + Math.random() * 0.25));
    const chipsChange = Math.floor((Math.random() - 0.45) * 800);
    const duration = hands * (3 + Math.random() * 2) * 60 * 1000;
    const startTime = now - (i * 24 + Math.random() * 20) * 3600 * 1000;
    const sessionId = genId();

    sessions.push({
      id: sessionId,
      user_id: getCurrentUserId(),
      game_type: gameType.key,
      game_type_label: gameType.label,
      game_type_icon: gameType.icon,
      ai_difficulty: difficulty,
      start_time: startTime,
      end_time: startTime + duration,
      total_hands: hands,
      hands_won: handsWon,
      win_rate: hands > 0 ? Math.round((handsWon / hands) * 100) : 0,
      chips_change: chipsChange,
      coach_summary: randomChoice(COACH_SUMMARIES),
      mood_before: randomChoice(MOODS),
      mood_after: randomChoice(MOODS),
      tags: ['位置感', '翻牌前范围', '底池管理', '心态管理', '弃牌纪律'].slice(0, 2 + Math.floor(Math.random() * 3)),
      messages: generateMockMessages(sessionId, gameType.key, hands),
      created_at: startTime,
    });
  }

  return sessions.sort((a, b) => b.start_time - a.start_time);
};

// ============================================================
// localStorage 降级实现
// ============================================================

const localInit = () => {
  const existing = storage.get(STORAGE_KEY);
  if (!existing || (Array.isArray(existing) && existing.length === 0)) {
    logger.storage('[降级] localStorage 为空，生成 12 条模拟数据');
    const mockData = generateMockSessions(12);
    storage.set(STORAGE_KEY, mockData);
  }
  return storage.get(STORAGE_KEY) || [];
};

const localGetSessions = (filters = {}) => {
  const all = localInit();
  let result = [...all];

  if (filters.gameType && filters.gameType !== 'all') {
    result = result.filter(s => s.game_type === filters.gameType);
  }
  if (filters.difficulty && filters.difficulty !== 'all') {
    result = result.filter(s => s.ai_difficulty === filters.difficulty);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(s =>
      (s.coach_summary && s.coach_summary.toLowerCase().includes(q)) ||
      (s.tags && s.tags.some(t => t.toLowerCase().includes(q)))
    );
  }
  if (filters.startTime) {
    result = result.filter(s => s.start_time >= filters.startTime);
  }
  if (filters.endTime) {
    result = result.filter(s => s.start_time <= filters.endTime);
  }
  if (filters.minWinRate !== undefined && filters.minWinRate !== null) {
    result = result.filter(s => (s.win_rate || 0) >= filters.minWinRate);
  }
  if (filters.maxWinRate !== undefined && filters.maxWinRate !== null) {
    result = result.filter(s => (s.win_rate || 0) <= filters.maxWinRate);
  }
  if (filters.minChips !== undefined && filters.minChips !== null) {
    result = result.filter(s => (s.chips_change || 0) >= filters.minChips);
  }
  if (filters.maxChips !== undefined && filters.maxChips !== null) {
    result = result.filter(s => (s.chips_change || 0) <= filters.maxChips);
  }
  if (filters.minHands !== undefined && filters.minHands !== null) {
    result = result.filter(s => (s.total_hands || 0) >= filters.minHands);
  }
  if (filters.maxHands !== undefined && filters.maxHands !== null) {
    result = result.filter(s => (s.total_hands || 0) <= filters.maxHands);
  }
  if (filters.moodBefore && filters.moodBefore.length > 0) {
    result = result.filter(s => filters.moodBefore.includes(s.mood_before));
  }
  if (filters.moodAfter && filters.moodAfter.length > 0) {
    result = result.filter(s => filters.moodAfter.includes(s.mood_after));
  }
  if (filters.tags && filters.tags.length > 0) {
    result = result.filter(s =>
      s.tags && s.tags.some(t => filters.tags.includes(t))
    );
  }

  // 排序
  const sortBy = filters.sortBy || 'start_time';
  const sortOrder = filters.sortOrder || 'desc';
  const reverse = sortOrder === 'desc';
  result.sort((a, b) => {
    const va = a[sortBy] || 0;
    const vb = b[sortBy] || 0;
    return reverse ? vb - va : va - vb;
  });

  return result;
};

const localGetSession = (sessionId) => {
  const all = localInit();
  return all.find(s => s.id === sessionId) || null;
};

const localGetStats = (filters = {}) => {
  const sessions = localGetSessions(filters);
  if (sessions.length === 0) {
    return {
      total_sessions: 0, total_hands: 0, avg_win_rate: 0,
      total_chips: 0, avg_session_duration: 0,
      by_game_type: {}, mood_distribution: {},
    };
  }

  const totalHands = sessions.reduce((s, x) => s + (x.total_hands || 0), 0);
  const totalWins = sessions.reduce((s, x) => s + (x.hands_won || 0), 0);
  const totalChips = sessions.reduce((s, x) => s + (x.chips_change || 0), 0);

  const byGameType = {};
  const moodDist = {};
  sessions.forEach(s => {
    byGameType[s.game_type_label] = (byGameType[s.game_type_label] || 0) + 1;
    moodDist[s.mood_after] = (moodDist[s.mood_after] || 0) + 1;
  });

  return {
    total_sessions: sessions.length,
    total_hands: totalHands,
    avg_win_rate: totalHands > 0 ? Math.round((totalWins / totalHands) * 100) : 0,
    total_chips: totalChips,
    avg_session_duration: Math.round(
      sessions.reduce((s, x) => s + ((x.end_time || 0) - (x.start_time || 0)), 0) / sessions.length / 60000
    ),
    by_game_type: byGameType,
    mood_distribution: moodDist,
  };
};

const localDeleteSession = (sessionId) => {
  const all = localInit();
  const filtered = all.filter(s => s.id !== sessionId);
  storage.set(STORAGE_KEY, filtered);
  return filtered;
};

const localResetMock = () => {
  const mockData = generateMockSessions(12);
  storage.set(STORAGE_KEY, mockData);
  return storage.get(STORAGE_KEY);
};

// ============================================================
// 公共 API（异步，支持 API + localStorage 降级）
// ============================================================

export const coachLogsEngine = {
  /** 当前是否使用后端 API */
  get isBackendAvailable() {
    return backendAvailable;
  },

  /** 手动切换后端可用性（用于测试） */
  _setBackendAvailable(val) {
    backendAvailable = val;
  },

  // ----------------------------------------------------------
  // 初始化
  // ----------------------------------------------------------
  async init() {
    const done = logger.flow('陪练记录引擎', 'init() 初始化');
    try {
      const sessions = await tryApi(
        () => coachApi.fetchSessions({}),
        () => localInit(),
        'init'
      );
      done(`${backendAvailable ? 'API' : '本地'}模式, ${sessions.length} 条`);
      return sessions;
    } catch (e) {
      logger.error('陪练记录 init() 异常', e.message);
      done('异常: ' + e.message);
      return [];
    }
  },

  // ----------------------------------------------------------
  // 获取会话列表
  // ----------------------------------------------------------
  async getSessions(filters = {}) {
    const done = logger.flow('陪练记录引擎', `getSessions()`, filters);
    try {
      const sessions = await tryApi(
        () => coachApi.fetchSessions(filters),
        () => localGetSessions(filters),
        'getSessions'
      );
      done(`返回 ${sessions.length} 条`);
      return sessions;
    } catch (e) {
      logger.error('陪练记录 getSessions() 异常', e.message);
      done('异常: ' + e.message);
      return [];
    }
  },

  // ----------------------------------------------------------
  // 获取单个会话详情
  // ----------------------------------------------------------
  async getSession(sessionId) {
    logger.session(`getSession() ${sessionId}`);
    try {
      const session = await tryApi(
        () => coachApi.fetchSession(sessionId),
        () => localGetSession(sessionId),
        'getSession'
      );
      if (session) {
        logger.session(`找到会话`, {
          id: sessionId,
          messages: session.messages?.length || 0,
        });
      }
      return session;
    } catch (e) {
      logger.error('陪练记录 getSession() 异常', e.message);
      return null;
    }
  },

  // ----------------------------------------------------------
  // 获取统计数据
  // ----------------------------------------------------------
  async getStats(filters = {}) {
    const done = logger.flow('陪练记录引擎', `getStats()`, filters);
    try {
      const stats = await tryApi(
        () => coachApi.fetchStats(filters),
        () => localGetStats(filters),
        'getStats'
      );
      done(`会话:${stats.total_sessions} 手数:${stats.total_hands}`);
      return stats;
    } catch (e) {
      logger.error('陪练记录 getStats() 异常', e.message);
      done('异常: ' + e.message);
      return {
        total_sessions: 0, total_hands: 0, avg_win_rate: 0,
        total_chips: 0, avg_session_duration: 0,
        by_game_type: {}, mood_distribution: {},
      };
    }
  },

  // ----------------------------------------------------------
  // 删除会话
  // ----------------------------------------------------------
  async deleteSession(sessionId) {
    const done = logger.flow('陪练记录引擎', `deleteSession(${sessionId})`);
    try {
      if (backendAvailable) {
        try {
          await coachApi.deleteSession(sessionId);
          const remaining = await coachApi.fetchSessions({});
          done(`API 删除成功, 剩余 ${remaining.length} 条`);
          return remaining;
        } catch (e) {
          if (e.isNetworkError) {
            backendAvailable = false;
            logger.session('[降级] 删除失败，切换本地模式');
          } else {
            throw e;
          }
        }
      }
      const remaining = localDeleteSession(sessionId);
      done(`本地删除成功, 剩余 ${remaining.length} 条`);
      return remaining;
    } catch (e) {
      logger.error('陪练记录 deleteSession() 异常', e.message);
      done('异常: ' + e.message);
      return [];
    }
  },

  // ----------------------------------------------------------
  // 重置为模拟数据
  // ----------------------------------------------------------
  async resetMock() {
    const done = logger.flow('陪练记录引擎', `resetMock()`);
    try {
      if (backendAvailable) {
        try {
          // 后端模式：清除现有数据并批量插入模拟数据
          const mockSessions = generateMockSessions(12);
          for (const s of mockSessions) {
            await coachApi.createSession(s);
          }
          const data = await coachApi.fetchSessions({});
          done(`API 重置为 ${data.length} 条模拟数据`);
          return data;
        } catch (e) {
          if (e.isNetworkError) {
            backendAvailable = false;
            logger.session('[降级] 重置失败，切换本地模式');
          } else {
            throw e;
          }
        }
      }
      const data = localResetMock();
      done(`本地重置为 ${data.length} 条模拟数据`);
      return data;
    } catch (e) {
      logger.error('陪练记录 resetMock() 异常', e.message);
      done('异常: ' + e.message);
      return [];
    }
  },

  // 工具
  formatDate,
  genId,
};

export default coachLogsEngine;
