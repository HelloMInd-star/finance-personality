// ============================================================
// 人格音乐画像 · 数据与推荐引擎
// 移植自 ymine-demos/music（IP 原样保留），六维值域 [0,1]
// ============================================================

// 12 种风格推荐库 · 人格-音乐映射
export const STYLE_MAP = {
  darkTrap: { name: '深夜 Trap Soul', tags: ['Trap', 'R&B', '暗潮'], mood: '深沉 · 迷幻', bpm: '65-85', desc: '808 低频 + 氛围合成器 + 慵懒人声', archetype: '夜唤者' },
  melodicRap: { name: '冷峻 Melodic Rap', tags: ['Hip-Hop', '旋律', '冷感'], mood: '克制 · 锐利', bpm: '75-95', desc: '精准鼓点 + 旋律说唱 + 极简制作', archetype: '炼金者' },
  ambientRnb: { name: '氛围 R&B', tags: ['R&B', '氛围', '柔和'], mood: '温暖 · 流动', bpm: '60-80', desc: '柔和合成器 + 切分节奏 + 情感人声', archetype: '月潮者' },
  jazzHop: { name: '爵士嘻哈', tags: ['Jazz', 'Hip-Hop', '慵懒'], mood: '松弛 · 优雅', bpm: '70-90', desc: '爵士采样 + 舒缓鼓点 + 钢琴旋律', archetype: '暮色者' },
  electronicDream: { name: '电子梦境', tags: ['Electronic', 'Dream Pop', '迷幻'], mood: '漂浮 · 梦幻', bpm: '50-70', desc: '合成器音墙 + 空灵人声 + 慢节奏', archetype: '织梦者' },
  minimalClassical: { name: '极简古典', tags: ['Classical', 'Minimal', '钢琴'], mood: '专注 · 沉思', bpm: '40-60', desc: '钢琴独奏 + 弦乐铺垫 + 留白', archetype: '守序者' },
  rockBallad: { name: '摇滚叙事', tags: ['Rock', 'Ballad', '吉他'], mood: '力量 · 感性', bpm: '80-100', desc: '电吉他 + 叙事性歌词 + 渐进鼓点', archetype: '焰心者' },
  upbeatPop: { name: '活力流行', tags: ['Pop', 'Dance', '电子'], mood: '明亮 · 跃动', bpm: '110-130', desc: '流行结构 + 电子元素 + 明快节奏', archetype: '焰心者' },
  loFiChill: { name: 'Lo-Fi 放松', tags: ['Lo-Fi', 'Chill', '低保真'], mood: '温暖 · 怀旧', bpm: '60-80', desc: '低保真质感 + 简单节奏 + 环境音采样', archetype: '雾行者' },
  latinFusion: { name: '拉丁融合', tags: ['Latin', 'Fusion', '打击乐'], mood: '热情 · 律动', bpm: '100-120', desc: '拉丁节奏 + 爵士和声 + 即兴', archetype: '暮色者' },
  darkSynth: { name: '暗波合成', tags: ['Synthwave', 'Dark', '工业'], mood: '冷峻 · 压迫', bpm: '90-110', desc: '模拟合成器 + 工业鼓机 + 暗黑气质', archetype: '独酌者' },
  orchestralEpic: { name: '史诗管弦', tags: ['Orchestral', 'Epic', '电影'], mood: '宏大 · 庄严', bpm: '60-90', desc: '管弦乐团 + 合唱 + 渐进高潮', archetype: '领航者' },
};

// 10 张原型氛围歌单
export const PLAYLISTS = [
  { title: '深夜实验室', mood: '专注 · 深度工作', archetype: '炼金者', songs: [['Blue in Green', 'Miles Davis'], ['Weightless', 'Marconi Union'], ['Avril 14th', 'Aphex Twin']] },
  { title: '霓虹漫游', mood: '都市 · 夜行', archetype: '夜唤者', songs: [['Blinding Lights', 'The Weeknd'], ['Nights', 'Frank Ocean'], ['After Hours', 'The Weeknd']] },
  { title: '静谧回响', mood: '冥想 · 内省', archetype: '独酌者', songs: [['Gymnopédie No.1', 'Satie'], ['Spiegel im Spiegel', 'Arvo Pärt'], ['Clair de Lune', 'Debussy']] },
  { title: '节奏实验室', mood: '律动 · 实验', archetype: '焰心者', songs: [['Lose Yourself to Dance', 'Daft Punk'], ['Electric Feel', 'MGMT'], ['Midnight City', 'M83']] },
  { title: '氛围叙事', mood: '电影感 · 沉浸', archetype: '织梦者', songs: [['Time', 'Hans Zimmer'], ['On the Nature of Daylight', 'Max Richter'], ['Experience', 'Ludovico Einaudi']] },
  { title: '低音引力', mood: '深沉 · 力量', archetype: '守序者', songs: [['Limit to Your Love', 'James Blake'], ['Teardrop', 'Massive Attack'], ['Angel', 'Massive Attack']] },
  { title: '晨雾漫步', mood: '清新 · 朦胧', archetype: '雾行者', songs: [['Holocene', 'Bon Iver'], ['To Build a Home', 'Cinematic Orchestra'], ['Bloom', 'The Paper Kites']] },
  { title: '日落大道', mood: '温暖 · 怀旧', archetype: '暮色者', songs: [['Sunset Lover', 'Petit Biscuit'], ['Redbone', 'Childish Gambino'], ['Electric', 'Alina Baraz']] },
  { title: '潮汐之力', mood: '流动 · 力量', archetype: '月潮者', songs: [['Tides', 'Bonobo'], ['Breathe', 'Télépopmusik'], ['Porcelain', 'Moby']] },
  { title: '军令如山', mood: '史诗 · 庄严', archetype: '领航者', songs: [['Heart of Courage', 'Two Steps From Hell'], ['Lux Aeterna', 'Clint Mansell'], ['O Fortuna', 'Carl Orff']] },
];

// ============================================================
// 六维 → 风格推荐 · 多象限规则（IP 原样）
// ============================================================
export function getStyleRecommendations(vec) {
  const recs = [];

  // ENT + SPD → 能量-节奏象限
  const energy = vec.ENT * 0.6 + vec.SPD * 0.4;
  if (energy > 0.7) {
    recs.push('upbeatPop', 'rockBallad', 'darkTrap');
  } else if (energy > 0.45) {
    recs.push('melodicRap', 'latinFusion', 'darkSynth');
  } else if (energy > 0.25) {
    recs.push('ambientRnb', 'jazzHop', 'electronicDream');
  } else {
    recs.push('loFiChill', 'minimalClassical', 'ambientRnb');
  }

  // TOL + LEAD → 复杂度-结构象限
  const complexity = vec.TOL * 0.5 + vec.LEAD * 0.5;
  if (complexity > 0.6) {
    recs.push('jazzHop', 'orchestralEpic', 'darkSynth');
  } else if (complexity < 0.3) {
    recs.push('upbeatPop', 'loFiChill');
  }

  // VIS + INF → 视觉-表现象限
  const expressiveness = vec.VIS * 0.5 + vec.INF * 0.5;
  if (expressiveness > 0.7) {
    recs.push('electronicDream', 'latinFusion', 'orchestralEpic');
  }
  if (expressiveness < 0.3) {
    recs.push('minimalClassical', 'loFiChill');
  }

  // INF 高 → 甜美/表现对应流行/氛围
  if (vec.INF > 0.7) {
    recs.push('upbeatPop', 'ambientRnb');
  }

  const unique = [...new Set(recs)];
  return unique.slice(0, 6).map((k) => ({ key: k, ...STYLE_MAP[k] })).filter((s) => s.name);
}

export function getPlaylistRecommendations(vec) {
  const energy = vec.ENT * 0.6 + vec.SPD * 0.4;
  const sorted = [...PLAYLISTS].sort((a, b) => {
    const aEnergy = ['焰心者', '夜唤者'].includes(a.archetype) ? 1 : ['织梦者', '月潮者'].includes(a.archetype) ? 0.5 : 0;
    const bEnergy = ['焰心者', '夜唤者'].includes(b.archetype) ? 1 : ['织梦者', '月潮者'].includes(b.archetype) ? 0.5 : 0;
    return Math.abs(energy - aEnergy) - Math.abs(energy - bEnergy);
  });
  return sorted.slice(0, 3);
}

// ============================================================
// 六维 → Web Audio 合成参数（IP 原样）
// ============================================================
export function getAudioParams(vec) {
  return {
    bassFreq: 60 + vec.TOL * 40,             // 低频 60-100Hz (TOL高→更深)
    highFreq: 800 + vec.ENT * 1200,          // 高频 800-2000Hz (ENT高→更亮)
    lowVolume: 0.15 + (1 - vec.ENT) * 0.15,  // 低音量 (ENT低→更柔和)
    highVolume: 0.05 + vec.ENT * 0.15,       // 高音量 (ENT高→更刺激)
    layers: 2 + Math.floor(vec.TOL * 3),     // 层数 2-5 (TOL高→更复杂)
    tempo: 40 + vec.SPD * 80,                // BPM 40-120 (SPD高→更快)
    reverb: 0.3 + vec.VIS * 0.5,             // 混响 (VIS高→更空灵)
    filterFreq: 400 + vec.INF * 1600,        // 滤波器 (INF高→更明亮)
  };
}

// ============================================================
// 人格主题曲 · ISFJ 区间解锁（IP 原样）
// ============================================================
// 注：demos 原中心 {TOL:0.65,...} 是其 ISFJ 滑块预设；finance 面具向量来自
// MBTI→原型映射，故中心对齐为「守序者」原型向量（ISFJ 映射），保持「ISFJ 区间解锁」语义。
export const THEME_CENTER = { TOL: 0.35, SPD: 0.30, INF: 0.80, ENT: 0.20, LEAD: 0.75, VIS: 0.30 };
export const THEME_RADIUS = 0.2;

export const THEME_SONG = {
  badge: 'ISFJ 守卫者 · 主题曲 No.01',
  title: 'Sweater Weather',
  meta: "Y.MINE 原创 AI 音乐 · 3'26'' · 毛衣与冷天气的矛盾体，正如守护者温柔而坚韧",
  audioUrl: '/assets/radio/sweater-weather.mp3',
  qrUrl: '/assets/radio/netease-playlist-qr.png',
  playlistUrl: 'https://163cn.tv/bcXc6I9W',
  playlistName: 'first cup',
  clue: '线索：高包容 · 慢节奏 · 温和主导 · 内向能量',
};

export function themeDistance(vec) {
  let sum = 0;
  for (const k of Object.keys(THEME_CENTER)) {
    const d = (vec[k] || 0) - THEME_CENTER[k];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function themeUnlocked(vec) {
  return themeDistance(vec) <= THEME_RADIUS;
}
