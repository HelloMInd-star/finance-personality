/**
 * 塔罗 × 网易云歌单 · 今夜氛围映射
 * 22 张大牌 → 7 种今夜氛围 → 真实网易云歌单
 *
 * 歌单 ID 来源:2026-08-19 公开搜索(云音乐官方/高分活跃歌单)
 * 若某歌单失效:按 mood 关键词在网易云搜同风格歌单,替换 playlistId 即可
 * 播放:网易云 outchain 外链播放器(官方支持,页内可播)
 */

export const MOODS = {
  ignite: {
    key: 'ignite',
    name: '启程之火',
    desc: '今夜适合踏出舒适区，让肾上腺素替你开路',
    playlistId: '13905314237',
    playlistName: '100首英文超燃爆曲',
  },
  flow: {
    key: 'flow',
    name: '心流',
    desc: '创造者的频率，万物在手中归位',
    playlistId: '13335483641',
    playlistName: 'Lofi专注时刻 · 云音乐官方',
  },
  midnight: {
    key: 'midnight',
    name: '深夜内省',
    desc: '把音量调小，把内心调大',
    playlistId: '7849335657',
    playlistName: '冷门宝藏R&B · TrapSoul进阶',
  },
  warmth: {
    key: 'warmth',
    name: '温度',
    desc: '连接他人之前，先被温柔接住',
    playlistId: '12651884817',
    playlistName: 'R&B清新小曲 · 治愈温柔氛围',
  },
  power: {
    key: 'power',
    name: '掌控',
    desc: '秩序与信念，今夜的王座属于你',
    playlistId: '13716691192',
    playlistName: '史诗级震撼背景音乐',
  },
  transform: {
    key: 'transform',
    name: '蜕变',
    desc: '旧结构的崩塌声，是新生的鼓点',
    playlistId: '12870814291',
    playlistName: '旋律说唱 · Hiphop与R&B融合',
  },
  dream: {
    key: 'dream',
    name: '星梦',
    desc: '闭上眼，宇宙在梦里替你留着灯',
    playlistId: '17966316142',
    playlistName: '梦境睡眠 · 迷雾梦境轻音(2026)',
  },
};

/** 22 张大牌 id → 氛围 key */
const CARD_MOOD_MAP = {
  '0': 'ignite', // 愚者 — 开始/冒险
  I: 'flow', // 魔术师 — 创造/专注
  II: 'midnight', // 女祭司 — 直觉/神秘
  III: 'warmth', // 女皇 — 丰盛/滋养
  IV: 'power', // 皇帝 — 权威/掌控
  V: 'power', // 教皇 — 信念/传承
  VI: 'warmth', // 恋人 — 关系/和谐
  VII: 'ignite', // 战车 — 胜利/行动
  VIII: 'warmth', // 力量 — 温柔守护
  IX: 'midnight', // 隐士 — 内省/独处
  X: 'ignite', // 命运之轮 — 机遇/顺势
  XI: 'power', // 正义 — 规则/裁决
  XII: 'transform', // 倒吊人 — 臣服/新视角
  XIII: 'transform', // 死神 — 结束/新生
  XIV: 'flow', // 节制 — 平衡/流动
  XV: 'transform', // 恶魔 — 束缚/释放
  XVI: 'transform', // 高塔 — 崩塌/觉醒
  XVII: 'dream', // 星星 — 希望/梦想
  XVIII: 'midnight', // 月亮 — 潜意识
  XIX: 'ignite', // 太阳 — 生命力
  XX: 'transform', // 审判 — 觉醒/重生
  XXI: 'power', // 世界 — 圆满/成就
};

/** 根据牌 id 取今夜氛围 */
export function getMoodForCard(cardId) {
  const key = CARD_MOOD_MAP[cardId] || 'midnight';
  return MOODS[key];
}

/** outchain 页内播放器地址 */
export function playlistEmbedUrl(playlistId) {
  return `https://music.163.com/outchain/player?type=0&id=${playlistId}&auto=0&height=90`;
}

/** 网易云歌单完整页地址 */
export function playlistPageUrl(playlistId) {
  return `https://music.163.com/playlist?id=${playlistId}`;
}
