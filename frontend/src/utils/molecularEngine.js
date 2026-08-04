import { logger } from './logger';

/**
 * 分子调酒映射引擎
 * 把 6步流程采集的数据 → 鸡尾酒配方
 *
 * 映射维度：
 * - 情绪底色 → 风味主调
 * - 基酒 → 基础风味层
 * - 提问答案 → 风味层次
 * - 过渡手记 → 质地
 * - 星座猜测 → 温度
 * - 调酒师风格 → 呈现方式
 * - 故事种子 → 酒名灵感
 */

// ============ 数据配置 ============

// 3位调酒师
export const BARTENDERS = {
  cole: {
    key: 'cole',
    name: 'Cole',
    title: '架构师调酒师',
    icon: '🏛️',
    style: '精准、层次分明、每一步都有目的',
    color: '#1890ff',
    personality: 'INTJ',
    specialty: '古典调酒、分层结构'
  },
  finn: {
    key: 'finn',
    name: 'Finn',
    title: '实验派调酒师',
    icon: '🔬',
    style: '打破边界、即兴、用意想不到的组合',
    color: '#eb2f96',
    personality: 'ENFP',
    specialty: '分子调酒、创意组合'
  },
  sol: {
    key: 'sol',
    name: 'Sol',
    title: '观察者调酒师',
    icon: '🌊',
    style: '深邃、内敛、先观察再出手',
    color: '#52c41a',
    personality: 'INTP',
    specialty: '清酒调酒、层次渐变'
  }
};

// 情绪底色选项
export const EMOTION_OPTIONS = [
  { key: 'calm', label: '冷静观察者', desc: '一切都在掌控之中' },
  { key: 'passion', label: '热烈探索者', desc: '对世界充满好奇' },
  { key: 'deep', label: '深邃沉思者', desc: '沉浸在自己的世界里' },
  { key: 'tired', label: '疲惫归人', desc: '需要一点温暖' },
  { key: 'excited', label: '期待冒险', desc: '准备好开始新旅程' },
  { key: 'nostalgic', label: '怀旧旅人', desc: '想念某个旧时光' }
];

// 基酒选项
export const BASE_SPIRITS = [
  { key: 'whisky', label: '威士忌', icon: '🥃', flavor: '木质 + 焦糖' },
  { key: 'gin', label: '金酒', icon: '🌿', flavor: '草本 + 柑橘' },
  { key: 'wine', label: '红酒', icon: '🍷', flavor: '浆果 + 单宁' },
  { key: 'coffee', label: '手冲', icon: '☕', flavor: '花香 + 坚果' }
];

// 关键提问（根据基酒变化）
export const QUESTIONS = {
  whisky: [
    { key: 'neat', label: '纯饮不加冰', desc: '我要的是本质' },
    { key: 'on_rocks', label: '加一块冰慢慢化', desc: '时间会给出答案' },
    { key: 'cocktail', label: '调一杯古典', desc: '经典自有道理' }
  ],
  gin: [
    { key: 'dry', label: 'Dry Martini', desc: '极致的干' },
    { key: 'gin_tonic', label: 'Gin & Tonic', desc: '清爽简单' },
    { key: 'complex', label: '来点复杂的', desc: '层次越多越好' }
  ],
  wine: [
    { key: 'bold', label: '浓郁饱满', desc: '我要的是冲击感' },
    { key: 'elegant', label: '优雅平衡', desc: '不过不失' },
    { key: 'light', label: '轻盈易饮', desc: '轻松就好' }
  ],
  coffee: [
    { key: 'black', label: '黑咖啡不加糖', desc: '真实的味道' },
    { key: 'latte', label: '一杯拿铁', desc: '温柔一点' },
    { key: 'cold', label: '冷萃', desc: '慢慢来的味道' }
  ]
};

// 故事种子
export const STORY_SEEDS = [
  { key: 'night_walk', label: '一个人走夜路回家' },
  { key: 'reunion', label: '和旧友久别重逢' },
  { key: 'adventure', label: '即将开始的冒险' },
  { key: 'silence', label: '一天结束后的沉默' },
  { key: 'first_date', label: '第一次约会之前' },
  { key: 'move_on', label: '决定不再回头' }
];

// 星座选项
export const ZODIAC_SIGNS = [
  '白羊座', '金牛座', '双子座', '巨蟹座',
  '狮子座', '处女座', '天秤座', '天蝎座',
  '射手座', '摩羯座', '水瓶座', '双鱼座'
];

// ============ 风味映射 ============

const EMOTION_FLAVOR = {
  '冷静观察者': '烟熏 + 橙皮',
  '热烈探索者': '热带水果 + 辣椒',
  '深邃沉思者': '黑巧克力 + 薄荷',
  '疲惫归人': '蜂蜜 + 肉桂',
  '期待冒险': '生姜 + 柠檬草',
  '怀旧旅人': '香草 + 烤杏仁'
};

const BASE_FLAVOR = {
  '威士忌': '木质 + 焦糖',
  '金酒': '草本 + 柑橘',
  '红酒': '浆果 + 单宁',
  '手冲': '花香 + 坚果'
};

const TEMPERATURE_MAP = {
  '一个人走夜路回家': '常温，杯壁微热',
  '和旧友久别重逢': '常温，略带温热',
  '即将开始的冒险': '冰镇，杯壁结霜',
  '一天结束后的沉默': '室温，无额外处理',
  '第一次约会之前': '微冰，起泡感',
  '决定不再回头': '烈酒温度，杯壁微烫'
};

const PRESENTATION_INDUSTRY = {
  '科技': '干冰烟雾缓缓升起',
  '消费': '水果装饰 + 气泡上升',
  '能源': '表层火焰点燃，杯壁微热',
  '金融': '金箔点缀，杯底透光'
};

const NAME_PARTS = {
  '一个人走夜路回家': ['隐士', '夜行', '孤影', '暮光'],
  '和旧友久别重逢': ['重逢', '旧时光', '归人', '故园'],
  '即将开始的冒险': ['先锋', '冒险家', '启程', '破晓'],
  '一天结束后的沉默': ['余晖', '停泊', '沉静', '星夜'],
  '第一次约会之前': ['悸动', '初遇', '心跳', '微光'],
  '决定不再回头': ['决断', '新生', '断层', '远行'],
  cole: ['架构', '指挥', '秩序', '几何'],
  finn: ['即兴', '实验', '边界', '量子'],
  sol: ['深潜', '结构', '观察', '潮汐']
};

const INGREDIENTS_POOL = [
  '波本威士忌', '苏格兰威士忌', '伦敦干金酒', '黑皮诺红酒',
  '意式浓缩', '冷萃咖啡', '橙皮苦精', '安格斯特拉苦精',
  '新鲜橙汁', '蔓越莓汁', '青柠汁', '蜂蜜糖浆',
  '焦糖糖浆', '香草糖浆', '新鲜薄荷', '迷迭香',
  '罗勒叶', '黄瓜片', '西柚皮', '柠檬皮',
  '蛋白', '奶油', '椰子水', '姜汁啤酒',
  '汤力水', '苏打水', '香槟', '黑巧克力碎'
];

// ============ 映射函数 ============

function mapFlavor(emotion, baseSpirit) {
  const emotionFlavor = EMOTION_FLAVOR[emotion] || '';
  const baseFlavor = BASE_FLAVOR[baseSpirit] || '';
  if (emotionFlavor && baseFlavor) return `${emotionFlavor} + ${baseFlavor}`;
  return emotionFlavor || baseFlavor || '经典平衡';
}

function mapTexture(personality, baseSpirit, transitionNote) {
  if (personality?.includes('J')) return '分层结构（上层轻盈，下层厚重）';
  if (personality?.includes('P')) return '融合渐变（无边界过渡）';
  if (baseSpirit === '威士忌' || baseSpirit === '红酒') return '厚重沉淀感';
  if (transitionNote?.includes('快') || transitionNote?.includes('急')) return '冲击感，入口即变';
  return '轻盈悬浮感';
}

function mapTemperature(storySeed, zodiacCorrect) {
  const base = TEMPERATURE_MAP[storySeed] || '常温';
  if (zodiacCorrect) return base + '（调酒师额外调整了温度）';
  return base;
}

function mapPresentation(industry, baseSpirit, bartenderStyle) {
  if (PRESENTATION_INDUSTRY[industry]) return PRESENTATION_INDUSTRY[industry];
  if (baseSpirit === '金酒') return '草本烟雾弥漫';
  if (bartenderStyle === 'finn') return '干冰 + 食用花瓣';
  if (bartenderStyle === 'cole') return '精准分层，杯沿橙皮';
  if (bartenderStyle === 'sol') return '简约光晕，杯底透光';
  return '简约呈现';
}

function generateCocktailName(storySeed, bartenderStyle, emotion) {
  const seedParts = NAME_PARTS[storySeed] || ['无名'];
  const bartenderParts = NAME_PARTS[bartenderStyle] || ['调'];

  const prefix = seedParts[Math.floor(Math.random() * seedParts.length)];
  const suffix = bartenderParts[Math.floor(Math.random() * bartenderParts.length)];

  // 组合规则：前缀 + 之 + 后缀
  const name = `${prefix}之${suffix}`;

  logger.session('生成酒名', { 故事: storySeed, 调酒师: bartenderStyle, 结果: name });
  return name;
}

function pickIngredients(baseSpirit, emotion, count = 5) {
  const selected = [];

  // 必选基酒
  const spiritMap = {
    '威士忌': ['波本威士忌'],
    '金酒': ['伦敦干金酒'],
    '红酒': ['黑皮诺红酒'],
    '手冲': ['冷萃咖啡']
  };
  selected.push(...(spiritMap[baseSpirit] || ['波本威士忌']));

  // 根据情绪选
  const emotionIngredients = {
    '冷静观察者': ['橙皮苦精', '迷迭香'],
    '热烈探索者': ['姜汁啤酒', '新鲜薄荷'],
    '深邃沉思者': ['黑巧克力碎', '香草糖浆'],
    '疲惫归人': ['蜂蜜糖浆', '奶油'],
    '期待冒险': ['青柠汁', '苏打水'],
    '怀旧旅人': ['香草糖浆', '烤杏仁']
  };
  selected.push(...(emotionIngredients[emotion] || ['蜂蜜糖浆']));

  // 随机补充
  const remaining = INGREDIENTS_POOL.filter(i => !selected.includes(i));
  while (selected.length < count && remaining.length > 0) {
    const idx = Math.floor(Math.random() * remaining.length);
    selected.push(remaining.splice(idx, 1)[0]);
  }

  return selected.slice(0, count);
}

function generateRecipeSource(input) {
  const parts = [];
  if (input.emotion) parts.push(`情绪「${input.emotion}」`);
  if (input.baseSpirit) parts.push(`基酒「${input.baseSpirit}」`);
  if (input.bartenderStyle) parts.push(`调酒师「${input.bartenderStyle.toUpperCase()}」`);
  if (input.storySeed) parts.push(`故事「${input.storySeed}」`);
  return parts.join(' × ');
}

// ============ 主引擎 ============

export class MolecularEngine {
  /**
   * 根据输入数据生成分子鸡尾酒配方
   */
  generate(input) {
    logger.flow('分子调酒引擎', '开始生成配方', JSON.stringify(input));

    const flavor = mapFlavor(input.emotion, input.baseSpirit);
    const texture = mapTexture(input.personality, input.baseSpirit, input.transitionNote);
    const temperature = mapTemperature(input.storySeed, input.zodiacCorrect);
    const presentation = mapPresentation(input.industry, input.baseSpirit, input.bartenderStyle);
    const name = generateCocktailName(input.storySeed, input.bartenderStyle, input.emotion);
    const ingredients = pickIngredients(input.baseSpirit, input.emotion);
    const recipeSource = generateRecipeSource(input);

    const output = {
      name,
      flavor,
      texture,
      temperature,
      presentation,
      ingredients,
      recipeSource
    };

    logger.session('配方生成完成', { 酒名: name, 风味: flavor });
    return output;
  }
}

export const molecularEngine = new MolecularEngine();
