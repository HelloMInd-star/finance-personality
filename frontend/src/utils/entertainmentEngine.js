/**
 * 娱乐方式引擎 · Entertainment Engine
 *
 * 功能定位：
 * 无目的、无输赢、无完成度的娱乐活动选择系统
 * 让用户在"什么都不做"的时间里自然选择，系统只观察，不评判
 *
 * 6 种娱乐方式：
 * 1. 🎵 音乐漫游 - 随机播放，无歌单
 * 2. 📖 故事漂流 - 随机段落，无情节
 * 3. 🎨 像素涂鸦 - 无目标，无对错
 * 4. 🌌 星图漫游 - 无目标，无终点
 * 5. 📝 自由书写 - 随意输入，不存档
 * 6. 🧘 空白静置 - 什么都不做，3分钟
 */

import { logger } from './logger';
import { storage } from './storage';

// ============= 娱乐方式定义 =============

export const ENTERTAINMENT_MODES = [
  {
    id: 'music',
    name: '音乐漫游',
    emoji: '🎵',
    shortDesc: '随机播放，无歌单',
    fullDesc: '可跳过，可停留',
    sensoryType: 'auditory', // 听觉
    activityLevel: 'low',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.15))',
  },
  {
    id: 'story',
    name: '故事漂流',
    emoji: '📖',
    shortDesc: '随机段落，无情节',
    fullDesc: '可跳过，可停留',
    sensoryType: 'text', // 文本
    activityLevel: 'low',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(16, 185, 129, 0.15))',
  },
  {
    id: 'doodle',
    name: '像素涂鸦',
    emoji: '🎨',
    shortDesc: '无目标，无对错',
    fullDesc: '颜色随心情变化',
    sensoryType: 'visual', // 视觉
    activityLevel: 'medium',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(236, 72, 153, 0.15))',
  },
  {
    id: 'starmap',
    name: '星图漫游',
    emoji: '🌌',
    shortDesc: '无目标，无终点',
    fullDesc: '可缩放，可旋转',
    sensoryType: 'visual',
    activityLevel: 'medium',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(59, 130, 246, 0.15))',
  },
  {
    id: 'write',
    name: '自由书写',
    emoji: '📝',
    shortDesc: '随意输入，不存档',
    fullDesc: '可删除，可保留',
    sensoryType: 'text',
    activityLevel: 'high',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(251, 191, 36, 0.15))',
  },
  {
    id: 'silence',
    name: '空白静置',
    emoji: '🧘',
    shortDesc: '什么都不做，3分钟',
    fullDesc: '纯计时，无交互',
    sensoryType: 'silence', // 静默
    activityLevel: 'none',
    color: '#64748b',
    gradient: 'linear-gradient(135deg, rgba(100, 116, 139, 0.2), rgba(139, 92, 246, 0.1))',
  },
];

// ============= 故事漂流素材库 =============

export const STORY_FRAGMENTS = [
  '月光洒在空无一人的站台上，一只猫慢悠悠地走过，留下一串无声的脚印。',
  '咖啡馆的角落里，有人在写一封永远不会寄出的信，笔尖在纸上沙沙作响。',
  '雨后的森林里，蘑菇们争先恐后地从土里钻出来，像是在参加一场秘密聚会。',
  '旧书店的二楼，阳光穿过积满灰尘的窗户，照亮了无数沉睡的故事。',
  '海边的灯塔守夜人望着远处的船，每一盏灯都是一个未说完的梦。',
  '山顶的风很大，他把外套裹紧，看着云从脚下流过，时间仿佛静止了。',
  '地铁隧道里，列车呼啸而过，她盯着窗外的黑暗，想着今天晚餐吃什么。',
  '冬夜里，卖热饮的小推车冒着白汽，路人停下脚步，接过一杯温暖。',
  '阁楼的箱子里，翻出了一叠泛黄的照片，每张都记录着一个被遗忘的夏天。',
  '清晨的面包店，第一批面包刚出炉，香气弥漫了整条街道。',
  '桥上有人在钓鱼，河水静静地流，浮标在水面上轻轻摇晃。',
  '图书馆的静音区，只有翻书的声音，每个人都在自己的世界里。',
  '夕阳下的操场，一个人影在慢慢跑步，影子被拉得很长很长。',
  '花店打烊前，店主把当天剩下的花包好，送给了路过的小女孩。',
  '深夜的便利店，店员在看一本漫画，门口的风铃偶尔响起。',
];

// ============= 音乐风格库 =============

export const MUSIC_STYLES = [
  { id: 'ambient', name: '环境音景', bpmRange: [60, 80], mood: 'calm' },
  { id: 'lofi', name: 'Lo-Fi 节拍', bpmRange: [70, 90], mood: 'relaxed' },
  { id: 'piano', name: '钢琴独奏', bpmRange: [50, 70], mood: 'melancholy' },
  { id: 'synthwave', name: '合成器波', bpmRange: [90, 110], mood: 'dreamy' },
  { id: 'jazz', name: '慵懒爵士', bpmRange: [80, 100], mood: 'chill' },
  { id: 'classical', name: '古典小品', bpmRange: [50, 80], mood: 'reflective' },
  { id: 'nature', name: '自然白噪音', bpmRange: [0, 0], mood: 'peaceful' },
];

// ============= 像素调色板 =============

export const DOODLE_PALETTES = {
  calm: ['#a78bfa', '#c4b5fd', '#818cf8', '#6366f1', '#4f46e5'],
  happy: ['#fbbf24', '#fcd34d', '#fde047', '#f59e0b', '#d97706'],
  melancholy: ['#64748b', '#94a3b8', '#475569', '#334155', '#1e293b'],
  energetic: ['#f472b6', '#fb7185', '#f43f5e', '#ec4899', '#db2777'],
  dreamy: ['#8b5cf6', '#a855f7', '#d946ef', '#c084fc', '#e879f9'],
  peaceful: ['#10b981', '#34d399', '#6ee7b7', '#6ee7b7', '#a7f3d0'],
  zen: ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'],
};

// ============= 星图星座名 =============

export const STAR_CONSTELLATIONS = [
  '猎户座', '天蝎座', '仙女座', '狮子座', '金牛座',
  '双子座', '巨蟹座', '处女座', '天秤座', '射手座',
  '摩羯座', '水瓶座', '双鱼座', '白羊座', '北斗七星',
  '仙后座', '大熊座', '小熊座', '天鹅座', '天琴座',
];

// ============= 会话数据结构 =============

/**
 * 开始娱乐会话
 */
export function startEntertainmentSession(modeId) {
  const mode = ENTERTAINMENT_MODES.find((m) => m.id === modeId);
  if (!mode) return null;

  const session = {
    id: `ent_${Date.now()}`,
    modeId,
    modeName: mode.name,
    startTime: Date.now(),
    endTime: null,
    duration: 0,
    switchCount: 0,
    contentInteractions: [], // 内容交互记录
    exitMethod: null, // 'manual' | 'timeout' | 'switch'
    emotionBefore: null,
    emotionAfter: null,
    notes: '',
  };

  logger.session('娱乐会话开始', {
    方式: mode.name,
    感官类型: mode.sensoryType,
    活动强度: mode.activityLevel,
  });

  return session;
}

/**
 * 结束娱乐会话
 */
export function endEntertainmentSession(session, exitMethod = 'manual') {
  if (!session) return null;

  const endTime = Date.now();
  const duration = Math.round((endTime - session.startTime) / 1000);

  const completedSession = {
    ...session,
    endTime,
    duration,
    exitMethod,
  };

  // 保存到 localStorage
  saveEntertainmentSession(completedSession);

  logger.session('娱乐会话结束', {
    方式: completedSession.modeName,
    持续时长: formatDuration(duration),
    切换次数: completedSession.switchCount,
    退出方式: exitMethod,
  });

  return completedSession;
}

/**
 * 保存娱乐会话记录
 */
function saveEntertainmentSession(session) {
  try {
    const data = storage.get() || {};
    const sessions = data.entertainmentSessions || [];
    sessions.push(session);
    storage.set({
      ...data,
      entertainmentSessions: sessions.slice(-100), // 最多保留 100 条
    });
  } catch (e) {
    logger.error('保存娱乐会话失败', e);
  }
}

/**
 * 获取娱乐会话历史
 */
export function getEntertainmentHistory() {
  try {
    const data = storage.get() || {};
    return data.entertainmentSessions || [];
  } catch (e) {
    logger.error('获取娱乐历史失败', e);
    return [];
  }
}

// ============= 数据分析 =============

/**
 * 分析娱乐行为数据
 */
export function analyzeEntertainmentBehavior() {
  const history = getEntertainmentHistory();
  if (history.length === 0) {
    return {
      totalSessions: 0,
      preferenceStats: {},
      avgDuration: 0,
      avgSwitchFrequency: 0,
      dominantSensoryType: null,
      attentionStability: 50,
    };
  }

  // 方式偏好统计
  const preferenceStats = {};
  let totalDuration = 0;
  let totalSwitches = 0;
  const sensoryCounts = {};

  history.forEach((s) => {
    preferenceStats[s.modeId] = (preferenceStats[s.modeId] || 0) + 1;
    totalDuration += s.duration || 0;
    totalSwitches += s.switchCount || 0;

    const mode = ENTERTAINMENT_MODES.find((m) => m.id === s.modeId);
    if (mode) {
      sensoryCounts[mode.sensoryType] = (sensoryCounts[mode.sensoryType] || 0) + 1;
    }
  });

  // 主导感官类型
  const dominantSensory = Object.entries(sensoryCounts).sort((a, b) => b[1] - a[1])[0];

  // 注意力稳定性（基于平均停留时间和切换频率）
  const avgDuration = totalDuration / history.length;
  const avgSwitches = totalSwitches / history.length;
  const attentionStability = Math.max(
    0,
    Math.min(100, 50 + (avgDuration / 60 - 3) * 10 - avgSwitches * 15)
  );

  logger.session('娱乐行为分析', {
    总会话数: history.length,
    平均时长: formatDuration(Math.round(avgDuration)),
    平均切换: avgSwitches.toFixed(1),
    注意力稳定性: attentionStability.toFixed(0),
  });

  return {
    totalSessions: history.length,
    preferenceStats,
    avgDuration: Math.round(avgDuration),
    avgSwitchFrequency: avgSwitches,
    dominantSensoryType: dominantSensory ? dominantSensory[0] : null,
    attentionStability: Math.round(attentionStability),
    history,
  };
}

// ============= 感官类型解释 =============

export const SENSORY_TYPE_LABELS = {
  auditory: { label: '听觉型', desc: '偏好声音和音乐，通过听觉获取能量' },
  visual: { label: '视觉型', desc: '偏好图像和色彩，通过视觉获取能量' },
  text: { label: '文本型', desc: '偏好文字和叙事，通过阅读获取能量' },
  silence: { label: '静默型', desc: '偏好安静和独处，通过静默获取能量' },
};

// ============= 工具函数 =============

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  return `${Math.floor(seconds / 3600)}时${Math.floor((seconds % 3600) / 60)}分`;
}

/**
 * 获取随机故事片段
 */
export function getRandomStoryFragment(excludeIndex = -1) {
  let index;
  do {
    index = Math.floor(Math.random() * STORY_FRAGMENTS.length);
  } while (index === excludeIndex && STORY_FRAGMENTS.length > 1);
  return { text: STORY_FRAGMENTS[index], index };
}

/**
 * 获取随机音乐风格
 */
export function getRandomMusicStyle() {
  return MUSIC_STYLES[Math.floor(Math.random() * MUSIC_STYLES.length)];
}

/**
 * 根据情绪获取调色板
 */
export function getDoodlePalette(emotion = 50) {
  if (emotion < 30) return DOODLE_PALETTES.melancholy;
  if (emotion < 50) return DOODLE_PALETTES.calm;
  if (emotion < 70) return DOODLE_PALETTES.peaceful || DOODLE_PALETTES.calm;
  if (emotion < 85) return DOODLE_PALETTES.happy;
  return DOODLE_PALETTES.energetic;
}

/**
 * 生成星星坐标
 */
export function generateStars(count = 50) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      id: i,
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2 + 1,
      brightness: Math.random() * 0.5 + 0.5,
      twinkleSpeed: Math.random() * 2 + 1,
      constellation: Math.random() < 0.15
        ? STAR_CONSTELLATIONS[Math.floor(Math.random() * STAR_CONSTELLATIONS.length)]
        : null,
    });
  }
  return stars;
}

// ============= 导出 =============

export const entertainmentEngine = {
  ENTERTAINMENT_MODES,
  STORY_FRAGMENTS,
  MUSIC_STYLES,
  DOODLE_PALETTES,
  STAR_CONSTELLATIONS,
  SENSORY_TYPE_LABELS,
  startEntertainmentSession,
  endEntertainmentSession,
  getEntertainmentHistory,
  analyzeEntertainmentBehavior,
  getRandomStoryFragment,
  getRandomMusicStyle,
  getDoodlePalette,
  generateStars,
  formatDuration,
};
