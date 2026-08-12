// 人格镜子引擎 —— 将行为数据翻译为自然语言描述
import { storage } from './storage';
import { logger } from './logger';

const MIRROR_KEY = 'persona_mirror';
const MIRROR_HISTORY_KEY = 'persona_mirror_history';

// ============= 数据采集 =============

const collectAllBehaviorData = () => {
  const allData = storage.getAll();
  const sources = [];

  // 德州扑克数据
  const pokerGames = allData.pokerGames || [];
  if (pokerGames.length > 0) sources.push(`德州扑克 (${pokerGames.length}局)`);

  // 台球数据
  const billiardsGames = allData.billiardsGames || [];
  const billiardsSessions = allData.billiardsSessions || [];
  if (billiardsGames.length > 0 || billiardsSessions.length > 0) {
    sources.push(`台球 (${billiardsGames.length + billiardsSessions.length}次)`);
  }

  // 健身数据
  const fitnessSessions = allData.fitnessSessions || [];
  if (fitnessSessions.length > 0) sources.push(`健身 (${fitnessSessions.length}次)`);

  // 博弈台数据
  let gameTableHistory = [];
  try {
    const raw = localStorage.getItem('gametable_history');
    if (raw) gameTableHistory = JSON.parse(raw);
  } catch (e) {}
  if (gameTableHistory.length > 0) sources.push(`模拟博弈台 (${gameTableHistory.length}局)`);

  // 娱乐方式数据
  let entertainmentHistory = [];
  try {
    const raw = localStorage.getItem('entertainment_history');
    if (raw) entertainmentHistory = JSON.parse(raw);
  } catch (e) {}
  if (entertainmentHistory.length > 0) sources.push(`娱乐方式 (${entertainmentHistory.length}次)`);

  // 调酒/状态数据
  const bartenderSessions = allData.bartenderSessions || [];
  if (bartenderSessions.length > 0) sources.push(`调酒 (${bartenderSessions.length}次)`);

  // 陪练对话
  const coachConversations = allData.coachConversations || [];
  if (coachConversations.length > 0) sources.push(`AI陪练 (${coachConversations.length}次)`);

  return {
    allData,
    pokerGames,
    billiardsGames,
    billiardsSessions,
    fitnessSessions,
    gameTableHistory,
    entertainmentHistory,
    bartenderSessions,
    coachConversations,
    sources,
  };
};

// ============= 翻译规则 =============

// 决策风格：基于德州和台球数据
const translateDecisionStyle = (data) => {
  const { pokerGames, billiardsGames } = data;
  const descriptions = [];

  // 从德州数据推断
  if (pokerGames.length > 0) {
    const recentGames = pokerGames.slice(-10);
    const totalRaises = recentGames.reduce((s, g) => s + (g.raiseCount || 0), 0);
    const totalFolds = recentGames.reduce((s, g) => s + (g.foldCount || 0), 0);
    const totalActions = recentGames.reduce((s, g) => s + (g.totalActions || 1), 0);

    const aggression = totalActions > 0 ? totalRaises / totalActions : 0.3;
    const tightness = totalActions > 0 ? totalFolds / totalActions : 0.3;

    if (aggression > 0.5) {
      descriptions.push('你在风险面前倾向于主动出击，而不是被动等待');
    } else if (tightness > 0.5) {
      descriptions.push('你在风险面前倾向于谨慎观察，只在有把握时行动');
    } else if (aggression > 0.3 && tightness > 0.2) {
      descriptions.push('你在风险面前倾向于主动控制，在观察和行动之间保持平衡');
    } else {
      descriptions.push('你在风险面前倾向于主动控制，而不是被动等待');
    }
  }

  // 从台球数据推断
  if (billiardsGames.length > 0) {
    const recentGames = billiardsGames.slice(-5);
    const avgAimTime = recentGames.reduce((s, g) => s + (g.avgAimTime || 3), 0) / recentGames.length;

    if (avgAimTime > 5) {
      descriptions.push('你做决定前会花时间观察路径，不急于出手');
    } else if (avgAimTime < 2) {
      descriptions.push('你做决定时反应迅速，倾向于相信第一判断');
    } else {
      descriptions.push('你做决定之前习惯先看清楚路径，但不会过度犹豫');
    }
  }

  if (descriptions.length === 0) {
    descriptions.push('你在风险面前倾向于主动控制，而不是被动等待');
    descriptions.push('你做决定之前习惯先看清楚路径，但不会过度犹豫');
  }

  return descriptions.slice(0, 2);
};

// 执行风格：基于健身和台球数据
const translateExecutionStyle = (data) => {
  const { fitnessSessions, billiardsSessions, pokerGames } = data;
  const descriptions = [];

  // 从健身数据推断
  if (fitnessSessions.length > 0) {
    const recent = fitnessSessions.slice(-10);
    const completionRate = recent.filter(s => s.completed).length / Math.max(recent.length, 1);
    const avgDuration = recent.reduce((s, r) => s + (r.duration || 0), 0) / Math.max(recent.length, 1);

    if (completionRate >= 0.8) {
      descriptions.push(`你对自己有要求，计划完成率保持在 ${Math.round(completionRate * 100)}% 以上`);
    } else if (completionRate >= 0.5) {
      descriptions.push('你对自己有要求，但也能接受弹性和不完美');
    } else {
      descriptions.push('你更看重当下的感受，计划可以为状态让路');
    }

    if (avgDuration > 1800) {
      descriptions.push('你愿意在一件事上投入足够的时间，不急于求成');
    }
  }

  // 从台球数据推断坚持度
  if (billiardsSessions.length > 0) {
    const recent = billiardsSessions.slice(-5);
    const avgShots = recent.reduce((s, r) => s + (r.totalShots || 0), 0) / Math.max(recent.length, 1);
    const quitEarly = recent.filter(r => r.quitEarly).length;

    if (quitEarly === 0 && avgShots > 10) {
      descriptions.push('你开始了一件事就倾向于做完，不会轻易中途放弃');
    } else if (quitEarly > 0) {
      descriptions.push('你会在执行中根据实际情况调整，发现不对就及时止损');
    }
  }

  if (descriptions.length === 0) {
    descriptions.push('你对自己有要求，但也能接受弹性');
    descriptions.push('你会在执行中根据实际情况调整，而不是硬撑');
  }

  return descriptions.slice(0, 2);
};

// 社交风格：基于博弈台和陪练数据
const translateSocialStyle = (data) => {
  const { gameTableHistory, coachConversations, entertainmentHistory } = data;
  const descriptions = [];

  // 从博弈台数据推断
  if (gameTableHistory.length > 0) {
    const recent = gameTableHistory.slice(-5);
    const avgStrategySwitches = recent.reduce((s, g) => s + (g.strategySwitches || 0), 0) / Math.max(recent.length, 1);
    const wins = recent.filter(g => g.result === 'win').length;
    const winRate = wins / Math.max(recent.length, 1);

    if (avgStrategySwitches > 2) {
      descriptions.push('你能读懂别人的策略，但更倾向于按自己的节奏走');
    } else if (winRate > 0.5) {
      descriptions.push('你在多人博弈中倾向于观察后再行动，不轻易被对手带节奏');
    } else {
      descriptions.push('你在多方博弈中不主动结盟，也不主动对抗');
    }

    if (avgStrategySwitches < 1) {
      descriptions.push('你有自己的策略框架，不会轻易被外界干扰改变');
    }
  }

  // 从娱乐方式推断社交偏好
  if (entertainmentHistory.length > 0) {
    const recent = entertainmentHistory.slice(-10);
    const soloModes = recent.filter(r =>
      ['music', 'story', 'doodle', 'starmap', 'writing', 'silence'].includes(r.mode)
    ).length;

    if (soloModes / Math.max(recent.length, 1) > 0.7) {
      descriptions.push('你在独处中更容易获得能量，社交对你来说是消耗也是补充');
    }
  }

  // 从陪练对话推断
  if (coachConversations.length > 0) {
    const recent = coachConversations.slice(-5);
    const avgMessages = recent.reduce((s, c) => s + (c.messageCount || 0), 0) / Math.max(recent.length, 1);

    if (avgMessages > 10) {
      descriptions.push('你愿意在需要时寻求反馈，但更多时候是自我对话');
    }
  }

  if (descriptions.length === 0) {
    descriptions.push('你能读懂别人，但不一定会跟随');
    descriptions.push('你在多方博弈中不主动结盟，也不主动对抗');
  }

  return descriptions.slice(0, 2);
};

// 时间风格：基于娱乐方式和调酒数据
const translateTimeStyle = (data) => {
  const { entertainmentHistory, bartenderSessions, fitnessSessions } = data;
  const descriptions = [];
  let storyMode = null;

  // 从调酒会话获取故事模式（雪茄/烟火）
  if (bartenderSessions.length > 0) {
    const recent = bartenderSessions[bartenderSessions.length - 1];
    storyMode = recent.storyMode;
  }

  // 也从currentSession检查
  const allData = storage.getAll();
  if (!storyMode && allData.currentSession) {
    storyMode = allData.currentSession.storyMode;
  }

  if (storyMode === 'cigar') {
    descriptions.push('你更倾向于沉静的节奏，在缓慢中保持清醒');
  } else if (storyMode === 'firework') {
    descriptions.push('你更倾向于热烈的节奏，在迸发中获得能量');
  } else {
    descriptions.push('你的节奏感偏向沉静，不喜欢太急促的变化');
  }

  // 从娱乐方式推断注意力持续时间
  if (entertainmentHistory.length > 0) {
    const recent = entertainmentHistory.slice(-10);
    const avgDuration = recent.reduce((s, r) => s + (r.duration || 0), 0) / Math.max(recent.length, 1);
    const switchCount = recent.reduce((s, r) => s + (r.switchCount || 0), 0);

    if (avgDuration > 300000 && switchCount < 3) {
      descriptions.push('你的注意力可以持续较长时间，但需要一个合适的入口');
    } else if (switchCount > 5) {
      descriptions.push('你的注意力容易被新事物吸引，在切换中保持活力');
    } else {
      descriptions.push('你的注意力可以持续较长时间，但需要入口');
    }
  }

  if (descriptions.length === 1) {
    descriptions.push('你的注意力可以持续较长时间，但需要入口');
  }

  return descriptions.slice(0, 2);
};

// 认知风格：基于MindSpeak和整体数据
const translateCognitiveStyle = (data) => {
  const { coachConversations, pokerGames, billiardsGames } = data;
  const descriptions = [];

  // 从陪练对话推断语言结构
  if (coachConversations.length > 0) {
    const recent = coachConversations.slice(-3);
    const structured = recent.filter(c => c.structuredThinking).length;

    if (structured > 0) {
      descriptions.push('你习惯用结构化的方式理解世界');
    } else {
      descriptions.push('你习惯用结构化的方式理解世界');
    }
  }

  // 从德州和台球的组合推断
  if (pokerGames.length > 0 && billiardsGames.length > 0) {
    descriptions.push('你擅长在不同领域之间建立连接，从一个游戏里学到的可以用到另一个');
  } else if (pokerGames.length > 0) {
    descriptions.push('你擅长在概率和直觉之间建立平衡');
  } else if (billiardsGames.length > 0) {
    descriptions.push('你擅长在路径和结果之间建立因果');
  }

  if (descriptions.length === 0) {
    descriptions.push('你习惯用结构化的方式理解世界');
    descriptions.push('你擅长在不同领域之间建立连接');
  }

  return descriptions.slice(0, 2);
};

// ============= 主引擎 =============

export const personaMirrorEngine = {
  // 生成人格镜子
  generate: () => {
    logger.session('生成人格镜子');

    const data = collectAllBehaviorData();

    const mirror = {
      decisionStyle: translateDecisionStyle(data),
      executionStyle: translateExecutionStyle(data),
      socialStyle: translateSocialStyle(data),
      timeStyle: translateTimeStyle(data),
      cognitiveStyle: translateCognitiveStyle(data),
      sources: data.sources.length > 0 ? data.sources : ['暂无行为数据，先去玩一玩吧'],
      updatedAt: Date.now(),
      dataSummary: {
        totalSessions:
          data.pokerGames.length +
          data.billiardsGames.length +
          data.billiardsSessions.length +
          data.fitnessSessions.length +
          data.gameTableHistory.length +
          data.entertainmentHistory.length +
          data.bartenderSessions.length,
      },
    };

    // 保存
    try {
      localStorage.setItem(MIRROR_KEY, JSON.stringify(mirror));

      // 保存历史
      const historyRaw = localStorage.getItem(MIRROR_HISTORY_KEY);
      const history = historyRaw ? JSON.parse(historyRaw) : [];
      history.unshift({ ...mirror, id: Date.now() });
      localStorage.setItem(MIRROR_HISTORY_KEY, JSON.stringify(history.slice(0, 52)));
    } catch (e) {
      logger.error('保存人格镜子失败', e);
    }

    return mirror;
  },

  // 获取当前镜子
  getCurrent: () => {
    try {
      const raw = localStorage.getItem(MIRROR_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  },

  // 获取历史
  getHistory: () => {
    try {
      const raw = localStorage.getItem(MIRROR_HISTORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  },

  // 格式化时间
  formatDate: (ts) => {
    if (!ts) return '从未生成';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
};

export default personaMirrorEngine;
