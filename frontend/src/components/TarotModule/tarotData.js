/**
 * 塔罗 22 张大牌 · MBTI 映射数据
 * 每张牌含:牌号 / 名称 / MBTI / 关键词 / 寓意 / 符号类型 / 主色
 */

export const TAROT_CARDS = [
  {
    id: '0',
    name: '愚者',
    nameEn: 'The Fool',
    mbti: 'ENFP',
    keywords: ['开始', '冒险', '信任'],
    meaning: '敢闯敢试、冒险精神、自由。你拥有无限可能，今夜适合踏出舒适区，拥抱未知。',
    symbol: 'fool',
    color: '#FBBF24',
  },
  {
    id: 'I',
    name: '魔术师',
    nameEn: 'The Magician',
    mbti: 'ENTP',
    keywords: ['创造', '技能', '专注'],
    meaning: '玩转资源、即兴创造、灵活。你手中已握有所需的一切，今夜适合将想法落地。',
    symbol: 'magician',
    color: '#A78BFA',
  },
  {
    id: 'II',
    name: '女祭司',
    nameEn: 'The High Priestess',
    mbti: 'INTJ',
    keywords: ['直觉', '神秘', '潜藏'],
    meaning: '深邃智慧、洞察本质、内在力量。你拥有穿透表象的天赋，今夜你的直觉比逻辑更值得信任。',
    symbol: 'priestess',
    color: '#818CF8',
  },
  {
    id: 'III',
    name: '女皇',
    nameEn: 'The Empress',
    mbti: 'ENFJ',
    keywords: ['丰盛', '滋养', '美丽'],
    meaning: '滋养引领、感染力强、丰盛。你天生具备凝聚人心的力量，今夜适合以温度连接他人。',
    symbol: 'empress',
    color: '#F472B6',
  },
  {
    id: 'IV',
    name: '皇帝',
    nameEn: 'The Emperor',
    mbti: 'ENTJ',
    keywords: ['权威', '结构', '控制'],
    meaning: '掌控全局、果断决策、权威。你天生适合构建秩序，今夜适合以决断力推动局面。',
    symbol: 'emperor',
    color: '#DC2626',
  },
  {
    id: 'V',
    name: '教皇',
    nameEn: 'The Hierophant',
    mbti: 'INFJ',
    keywords: ['信仰', '传承', '智慧'],
    meaning: '精神导师、价值观引领、使命感。你承载着更深的意义，今夜适合传递你的信念。',
    symbol: 'hierophant',
    color: '#D4AF37',
  },
  {
    id: 'VI',
    name: '恋人',
    nameEn: 'The Lovers',
    mbti: 'ISFP',
    keywords: ['选择', '和谐', '关系'],
    meaning: '追随本心、选择、和谐。今夜你面临一个重要的选择，听从内心而非理性。',
    symbol: 'lovers',
    color: '#34D399',
  },
  {
    id: 'VII',
    name: '战车',
    nameEn: 'The Chariot',
    mbti: 'ESTJ',
    keywords: ['胜利', '决心', '行动'],
    meaning: '一往无前、攻坚克难、意志力。今夜的胜利属于意志坚定者，全力推进你的目标。',
    symbol: 'chariot',
    color: '#3B82F6',
  },
  {
    id: 'VIII',
    name: '力量',
    nameEn: 'Strength',
    mbti: 'ISFJ',
    keywords: ['内在力量', '耐心', '控制'],
    meaning: '温柔守护、坚韧、耐心。真正的力量不在于对抗，而在于温柔的坚持与包容。',
    symbol: 'strength',
    color: '#F59E0B',
  },
  {
    id: 'IX',
    name: '隐士',
    nameEn: 'The Hermit',
    mbti: 'INTP',
    keywords: ['内省', '寻找', '智慧'],
    meaning: '独立思考、追求真理、孤独。今夜适合退入内在，在独处中寻找属于你的答案。',
    symbol: 'hermit',
    color: '#94A3B8',
  },
  {
    id: 'X',
    name: '命运之轮',
    nameEn: 'Wheel of Fortune',
    mbti: 'ESTP',
    keywords: ['机遇', '变化', '转变'],
    meaning: '抓住机会、顺势而为、变化。命运的转盘正在转向你，今夜适合果断出手。',
    symbol: 'wheel',
    color: '#10B981',
  },
  {
    id: 'XI',
    name: '正义',
    nameEn: 'Justice',
    mbti: 'ISTJ',
    keywords: ['公正', '诚实', '平衡'],
    meaning: '规则秩序、可靠、公正。今夜的天平倾向有备而来者，以事实和规则取胜。',
    symbol: 'justice',
    color: '#0EA5E9',
  },
  {
    id: 'XII',
    name: '倒吊人',
    nameEn: 'The Hanged Man',
    mbti: 'INFJ',
    keywords: ['放手', '臣服', '新视角'],
    meaning: '牺牲小我、换位思考、臣服。换个角度，困境即是转机，今夜适合放下执念。',
    symbol: 'hanged',
    color: '#6366F1',
  },
  {
    id: 'XIII',
    name: '死神',
    nameEn: 'Death',
    mbti: 'ESFP',
    keywords: ['结束', '转变', '新生'],
    meaning: '打破框架、颠覆、新生。旧的模式正在瓦解，今夜适合拥抱结束带来的新生。',
    symbol: 'death',
    color: '#7C3AED',
  },
  {
    id: 'XIV',
    name: '节制',
    nameEn: 'Temperance',
    mbti: 'ISTP',
    keywords: ['平衡', '调和', '流动'],
    meaning: '平衡调和、适应、优化。今夜找到流动的节奏，在对立之间寻得最优解。',
    symbol: 'temperance',
    color: '#06B6D4',
  },
  {
    id: 'XV',
    name: '恶魔',
    nameEn: 'The Devil',
    mbti: 'ESTP',
    keywords: ['束缚', '释放', '物质'],
    meaning: '突破底线、极致的专注。今夜你被某种渴望驱动，将其转化为极致的专注力。',
    symbol: 'devil',
    color: '#B91C1C',
  },
  {
    id: 'XVI',
    name: '高塔',
    nameEn: 'The Tower',
    mbti: 'ESFP',
    keywords: ['幻灭', '突破', '觉悟'],
    meaning: '突如其来的改变、觉醒。旧的结构正在崩塌，这并非灾难，而是必要的觉醒。',
    symbol: 'tower',
    color: '#EF4444',
  },
  {
    id: 'XVII',
    name: '星星',
    nameEn: 'The Star',
    mbti: 'INFP',
    keywords: ['希望', '梦想', '宁静'],
    meaning: '希望理想、灵感、信仰。今夜的宇宙在向你传递信号，保持信念，灵感会降临。',
    symbol: 'star',
    color: '#38BDF8',
  },
  {
    id: 'XVIII',
    name: '月亮',
    nameEn: 'The Moon',
    mbti: 'INFP',
    keywords: ['潜意识', '恐惧', '幻想'],
    meaning: '深层情绪、潜意识、直觉。今夜适合直面内心深处的恐惧，那里藏着真正的力量。',
    symbol: 'moon',
    color: '#A5B4FC',
  },
  {
    id: 'XIX',
    name: '太阳',
    nameEn: 'The Sun',
    mbti: 'ESFJ',
    keywords: ['成功', '快乐', '温暖'],
    meaning: '温暖照亮、快乐、生命力。今夜属于你，毫无保留地释放你的光芒与热情。',
    symbol: 'sun',
    color: '#FCD34D',
  },
  {
    id: 'XX',
    name: '审判',
    nameEn: 'Judgement',
    mbti: 'INFJ',
    keywords: ['觉醒', '重生', '召唤'],
    meaning: '觉醒、召唤、人生转折。一个更大的使命正在召唤你，今夜适合倾听内在的声音。',
    symbol: 'judgement',
    color: '#FBBF24',
  },
  {
    id: 'XXI',
    name: '世界',
    nameEn: 'The World',
    mbti: 'INTJ',
    keywords: ['完成', '整合', '成就'],
    meaning: '圆满完成、整合、全知。一个周期即将圆满，今夜适合回望并整合你的全部经历。',
    symbol: 'world',
    color: '#D4AF37',
  },
];

export const TAROT_COUNT = TAROT_CARDS.length;

/**
 * 随机抽取一张牌
 */
export function drawRandomCard() {
  const idx = Math.floor(Math.random() * TAROT_CARDS.length);
  return TAROT_CARDS[idx];
}

/**
 * 根据 id 查找牌
 */
export function getCardById(id) {
  return TAROT_CARDS.find((c) => c.id === id);
}

/**
 * 根据 symbol 类型查找牌(用于联动)
 */
export function getCardsByMbti(mbti) {
  return TAROT_CARDS.filter((c) => c.mbti === mbti);
}
