/**
 * 星盘数据 · 12 星座解读库 + 上升/下降映射 + MBTI 倾向
 * 用于整合方案输出的"星盘印证"卡片
 */

// ========================================
// 12 星座定义(含太阳/月亮/上升三位置解读)
// ========================================

export const ZODIAC_SIGNS = [
  {
    key: 'aries',
    name: '白羊',
    symbol: '♈',
    element: '火',
    sun: '主动、热情、有冲劲，天生具备开创者的勇气。',
    moon: '情绪直白、需要即时反馈，内心如火焰般明亮。',
    rising: '给人活力充沛、行动果决的第一印象。',
    mbtiTendency: 'E + 行动型',
  },
  {
    key: 'taurus',
    name: '金牛',
    symbol: '♉',
    element: '土',
    sun: '稳定、务实、有耐心，擅长在长期中积累价值。',
    moon: '情绪平稳、需要安全感，内心如大地般厚重。',
    rising: '给人稳重可靠、不疾不徐的第一印象。',
    mbtiTendency: 'S + 稳定型',
  },
  {
    key: 'gemini',
    name: '双子',
    symbol: '♊',
    element: '风',
    sun: '灵活、好奇、善沟通，天生是信息的连接者。',
    moon: '情绪多变、需要新鲜感，内心如风般自由。',
    rising: '给人聪明灵活、言谈生动的第一印象。',
    mbtiTendency: 'E + 探索型',
  },
  {
    key: 'cancer',
    name: '巨蟹',
    symbol: '♋',
    element: '水',
    sun: '温和、体贴、有保护欲，天生的情感守护者。',
    moon: '情绪细腻、需要情感连接，内心如潮水般深邃。',
    rising: '给人温暖敏感、富有同理心的第一印象。',
    mbtiTendency: 'F + 关系型',
  },
  {
    key: 'leo',
    name: '狮子',
    symbol: '♌',
    element: '火',
    sun: '自信、热情、有领导力，天生的舞台中心。',
    moon: '情绪强烈、需要认可，内心如骄阳般炽热。',
    rising: '给人自信耀眼、充满魅力的第一印象。',
    mbtiTendency: 'E + 表达型',
  },
  {
    key: 'virgo',
    name: '处女',
    symbol: '♍',
    element: '土',
    sun: '细致、理性、有条理，天生的分析优化者。',
    moon: '情绪克制、需要秩序，内心如精密齿轮般严谨。',
    rising: '给人严谨专业、注重细节的第一印象。',
    mbtiTendency: 'T + 分析型',
  },
  {
    key: 'libra',
    name: '天秤',
    symbol: '♎',
    element: '风',
    sun: '优雅、和谐、善社交，天生的关系协调者。',
    moon: '情绪平衡、需要和谐，内心如天平般追求公正。',
    rising: '给人优雅得体、气质出众的第一印象。',
    mbtiTendency: 'F + 平衡型',
  },
  {
    key: 'scorpio',
    name: '天蝎',
    symbol: '♏',
    element: '水',
    sun: '深沉、敏锐、有洞察力，天生的真相追寻者。',
    moon: '情绪深刻、需要真实，内心如深海般幽邃。',
    rising: '给人神秘深邃、气场强大的第一印象。',
    mbtiTendency: 'I + 洞察型',
  },
  {
    key: 'sagittarius',
    name: '射手',
    symbol: '♐',
    element: '火',
    sun: '乐观、自由、有远见，天生的探索哲学家。',
    moon: '情绪开放、需要自由，内心如箭矢般向往远方。',
    rising: '给人乐观开阔、充满热忱的第一印象。',
    mbtiTendency: 'N + 探索型',
  },
  {
    key: 'capricorn',
    name: '摩羯',
    symbol: '♑',
    element: '土',
    sun: '务实、自律、有目标，天生的长期建设者。',
    moon: '情绪压抑、需要成就，内心如山岳般沉默坚定。',
    rising: '给人成熟可靠、气场沉稳的第一印象。',
    mbtiTendency: 'T + 执行型',
  },
  {
    key: 'aquarius',
    name: '水瓶',
    symbol: '♒',
    element: '风',
    sun: '独立、创新、有前瞻性，天生的未来主义者。',
    moon: '情绪抽离、需要空间，内心如星空般辽远。',
    rising: '给人独特独立、思维超前的第一印象。',
    mbtiTendency: 'N + 系统型',
  },
  {
    key: 'pisces',
    name: '双鱼',
    symbol: '♓',
    element: '水',
    sun: '敏感、共情、有想象力，天生的梦想艺术家。',
    moon: '情绪流动、需要共鸣，内心如海洋般无边无际。',
    rising: '给人梦幻温柔、灵性充盈的第一印象。',
    mbtiTendency: 'F + 直觉型',
  },
];

// 星座 key → 对象索引(快速查找)
const SIGN_MAP = {};
ZODIAC_SIGNS.forEach((s) => (SIGN_MAP[s.key] = s));

// ========================================
// 上升 → 下降(对宫)映射 + 关系模式解读
// ========================================

const DESCENDANT_MAP = {
  aries: 'libra',
  taurus: 'scorpio',
  gemini: 'sagittarius',
  cancer: 'capricorn',
  leo: 'aquarius',
  virgo: 'pisces',
  libra: 'aries',
  scorpio: 'taurus',
  sagittarius: 'gemini',
  capricorn: 'cancer',
  aquarius: 'leo',
  pisces: 'virgo',
};

const DESCENDANT_TEXT = {
  aries: '需要平衡的关系，容易被优雅、理性的人吸引。',
  taurus: '需要深度的关系，容易被神秘、专注的人吸引。',
  gemini: '需要自由的关系，容易被开阔、独立的人吸引。',
  cancer: '需要稳定的关系，容易被务实、有目标的人吸引。',
  leo: '需要共鸣的关系，容易被独立、有思想的人吸引。',
  virgo: '需要理解的关系，容易被柔软、有灵性的人吸引。',
  libra: '需要活力的关系，容易被主动、有冲劲的人吸引。',
  scorpio: '需要踏实的关系，容易被稳重、可靠的人吸引。',
  sagittarius: '需要沟通的关系，容易被灵活、好奇的人吸引。',
  capricorn: '需要温暖的关系，容易被体贴、有保护欲的人吸引。',
  aquarius: '需要认可的关系，容易被自信、有表达力的人吸引。',
  pisces: '需要清晰的关系，容易被理性、有逻辑的人吸引。',
};

// ========================================
// 工具函数
// ========================================

/**
 * 根据上升星座获取下降星座
 */
export function getDescendant(risingKey) {
  return DESCENDANT_MAP[risingKey] || null;
}

/**
 * 获取下降星座的关系模式解读
 */
export function getDescendantText(descendantKey) {
  return DESCENDANT_TEXT[descendantKey] || '';
}

/**
 * 获取星座在指定位置的解读文本
 * @param {string} signKey - 星座 key
 * @param {'sun'|'moon'|'rising'} position - 位置
 */
export function getZodiacText(signKey, position) {
  const sign = SIGN_MAP[signKey];
  if (!sign) return '';
  return sign[position] || '';
}

/**
 * 获取星座对象
 */
export function getSign(signKey) {
  return SIGN_MAP[signKey] || null;
}

/**
 * 生成完整的星盘解读数据
 * @param {{ sun: string, moon: string, rising: string }} zodiacData
 * @returns {{ positions: Array, descendantText: string, hasData: boolean }}
 */
export function generateZodiacReading(zodiacData) {
  if (!zodiacData || (!zodiacData.sun && !zodiacData.moon && !zodiacData.rising)) {
    return { positions: [], descendantText: '', hasData: false };
  }

  const { sun, moon, rising } = zodiacData;
  const descendant = rising ? getDescendant(rising) : null;

  const positions = [
    { label: '太阳', symbol: '☀', signKey: sun, sign: getSign(sun), text: getZodiacText(sun, 'sun') },
    { label: '月亮', symbol: '☽', signKey: moon, sign: getSign(moon), text: getZodiacText(moon, 'moon') },
    { label: '上升', symbol: '↑', signKey: rising, sign: getSign(rising), text: getZodiacText(rising, 'rising') },
  ].filter((p) => p.signKey);

  // 下降星座(基于上升推算)
  if (descendant) {
    positions.push({
      label: '下降',
      symbol: '↓',
      signKey: descendant,
      sign: getSign(descendant),
      text: getDescendantText(descendant),
    });
  }

  return {
    positions,
    descendantText: descendant ? getDescendantText(descendant) : '',
    hasData: true,
  };
}
