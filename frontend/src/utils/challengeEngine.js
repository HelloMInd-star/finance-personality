/**
 * 人格调酒挑战赛引擎
 * 第二层：限时主题挑战 + 评委评分系统
 */
import { logger } from './logger';
import { BARTENDERS } from './molecularEngine';

// ============================================================
// 挑战主题库
// ============================================================

const CHALLENGE_THEMES = [
  {
    id: 'anxiety',
    title: '调一杯代表你焦虑的酒',
    desc: '当你感到焦虑时，你会用什么味道来表达？',
    keywords: ['紧张', '不安', '想要逃离'],
    timeLimit: 180,
  },
  {
    id: 'midnight',
    title: '调一杯适合深夜独处的酒',
    desc: '凌晨两点，房间里只有你自己。这杯酒是什么样的？',
    keywords: ['安静', '内省', '温柔'],
    timeLimit: 180,
  },
  {
    id: 'courage',
    title: '调一杯给明天的勇气',
    desc: '明天有一场重要的演讲/会议/告白。你需要一杯什么？',
    keywords: ['力量', '希望', '笃定'],
    timeLimit: 180,
  },
  {
    id: 'memory',
    title: '调一杯童年的味道',
    desc: '闭上眼睛，回到十岁那年。那是什么味道？',
    keywords: ['怀旧', '纯真', '甜'],
    timeLimit: 180,
  },
  {
    id: 'conflict',
    title: '调一杯你和父亲的关系',
    desc: '如果用一杯酒来形容你和父亲的关系，它是什么样的？',
    keywords: ['复杂', '沉默', '深厚'],
    timeLimit: 180,
  },
  {
    id: 'future',
    title: '调一杯十年后的自己',
    desc: '十年后，你在做什么？那时候的你会喝什么？',
    keywords: ['从容', '释然', '沉淀'],
    timeLimit: 180,
  },
  {
    id: 'heartbreak',
    title: '调一杯心碎的解药',
    desc: '如果心碎可以被调进酒里，解药会是什么配方？',
    keywords: ['苦', '回甘', '释放'],
    timeLimit: 180,
  },
  {
    id: 'triumph',
    title: '调一杯胜利的滋味',
    desc: '想象你刚刚完成了一件了不起的事。这杯酒怎么庆祝？',
    keywords: ['喜悦', '爆发', '明亮'],
    timeLimit: 180,
  },
];

// ============================================================
// 风味选择选项
// ============================================================

const FLAVOR_OPTIONS = [
  { key: 'smoky', label: '烟熏', icon: '🔥' },
  { key: 'sweet', label: '甜', icon: '🍯' },
  { key: 'bitter', label: '苦', icon: '🌿' },
  { key: 'sour', label: '酸', icon: '🍋' },
  { key: 'salty', label: '咸', icon: '🧂' },
  { key: 'spicy', label: '辛', icon: '🌶️' },
  { key: 'fruity', label: '果香', icon: '🍓' },
  { key: 'floral', label: '花香', icon: '🌸' },
  { key: 'earthy', label: '泥土', icon: '🌱' },
  { key: 'mineral', label: '矿物', icon: '💎' },
  { key: 'creamy', label: '奶油', icon: '🥛' },
  { key: 'cooling', label: '清凉', icon: '❄️' },
];

// ============================================================
// 配方组合选项
// ============================================================

const BASE_OPTIONS = [
  { key: 'whisky', label: '威士忌', icon: '🥃' },
  { key: 'gin', label: '金酒', icon: '🌿' },
  { key: 'vodka', label: '伏特加', icon: '🥤' },
  { key: 'rum', label: '朗姆', icon: '🏴‍☠️' },
  { key: 'tequila', label: '龙舌兰', icon: '🌵' },
  { key: 'brandy', label: '白兰地', icon: '🍇' },
  { key: 'sake', label: '清酒', icon: '🏯' },
  { key: 'baijiu', label: '白酒', icon: '🏮' },
];

const MIXER_OPTIONS = [
  { key: 'tonic', label: '汤力水', icon: '💧' },
  { key: 'soda', label: '苏打水', icon: '🫧' },
  { key: 'juice', label: '果汁', icon: '🧃' },
  { key: 'tea', label: '茶', icon: '🍵' },
  { key: 'coffee', label: '咖啡', icon: '☕' },
  { key: 'milk', label: '奶', icon: '🥛' },
  { key: 'syrup', label: '糖浆', icon: '🍯' },
  { key: 'bitters', label: '苦精', icon: '🧪' },
];

const GARNISH_OPTIONS = [
  { key: 'citrus', label: '柑橘皮', icon: '🍊' },
  { key: 'cherry', label: '樱桃', icon: '🍒' },
  { key: 'mint', label: '薄荷', icon: '🌿' },
  { key: 'rosemary', label: '迷迭香', icon: '🌲' },
  { key: 'olive', label: '橄榄', icon: '🫒' },
  { key: 'salt', label: '盐边', icon: '🧂' },
  { key: 'sugar', label: '糖边', icon: '🍬' },
  { key: 'smoke', label: '烟熏', icon: '💨' },
];

// ============================================================
// 故事基调选项
// ============================================================

const STORY_TONES = [
  { key: 'tragic', label: '悲剧感', desc: '有些东西注定失去' },
  { key: 'redemptive', label: '救赎感', desc: '黑暗尽头有光' },
  { key: 'nostalgic', label: '怀旧感', desc: '旧时光的温度' },
  { key: 'triumphant', label: '胜利感', desc: '终于等到这一刻' },
  { key: 'quiet', label: '宁静感', desc: '什么都不用再说了' },
  { key: 'mysterious', label: '神秘感', desc: '你还不知道全部真相' },
];

// ============================================================
// 评委评语库
// ============================================================

const JUDGE_COMMENTS = {
  cole: {
    high: [
      '结构清晰，每一层风味都有它的目的。这杯酒有思考在里面。',
      '精准。你知道自己想要什么，并且做到了。',
      '层次分明，递进有序。像一篇好的架构设计。',
    ],
    mid: [
      '基础扎实，但可以再大胆一些。',
      '平衡感不错，缺少一个记忆点。',
      '合格的作品。但我期待看到你的个人风格。',
    ],
    low: [
      '有点乱。先想清楚你要表达什么，再动手。',
      '每一个选择都需要理由。你有想过吗？',
      '还可以。但离"好"还有距离。',
    ],
  },
  finn: {
    high: [
      '太酷了！这个组合我完全没想到，但效果爆炸！',
      '我喜欢你的大胆。这就是调酒该有的样子！',
      '有惊喜！每一口都有新发现。继续保持这种实验精神！',
    ],
    mid: [
      '不错不错！但我觉得你还可以再疯一点。',
      '有意思的尝试。下次试试打破更多规则？',
      '有亮点！但整体还可以更有张力。',
    ],
    low: [
      '嗯...有点保守了。别怕犯错，调酒就是要玩！',
      '太稳妥了。我想看到你不按牌理出牌的样子。',
      '合格，但不够有趣。调酒需要一点疯狂。',
    ],
  },
  sol: {
    high: [
      '嗯...我喝到了一些东西。很安静，很深。你在想什么？',
      '这杯酒...有故事。不是所有人都能调出来的。',
      '我喜欢这种内敛的力量。不急不躁，但很有存在感。',
    ],
    mid: [
      '还不错。但你藏了一些东西，为什么不放出来？',
      '平衡很好。但我想看到更多你自己。',
      '合格的作品。但总觉得少了一点什么。',
    ],
    low: [
      '你好像在隐藏什么。调酒的时候，要诚实。',
      '味道是有了，但没有灵魂。',
      '先别急着调。先感受一下自己。',
    ],
  },
};

// ============================================================
// 挑战赛引擎类
// ============================================================

class ChallengeEngine {
  constructor() {
    logger.info('ChallengeEngine 初始化');
  }

  /**
   * 获取随机挑战主题
   */
  getRandomTheme(excludeIds = []) {
    const available = CHALLENGE_THEMES.filter(t => !excludeIds.includes(t.id));
    const pool = available.length > 0 ? available : CHALLENGE_THEMES;
    const theme = pool[Math.floor(Math.random() * pool.length)];
    logger.session('[挑战赛] 生成主题', theme.title);
    return theme;
  }

  /**
   * 获取所有风味选项
   */
  getFlavorOptions() {
    return FLAVOR_OPTIONS;
  }

  /**
   * 获取所有基酒选项
   */
  getBaseOptions() {
    return BASE_OPTIONS;
  }

  /**
   * 获取所有配料选项
   */
  getMixerOptions() {
    return MIXER_OPTIONS;
  }

  /**
   * 获取所有装饰选项
   */
  getGarnishOptions() {
    return GARNISH_OPTIONS;
  }

  /**
   * 获取所有故事基调选项
   */
  getStoryTones() {
    return STORY_TONES;
  }

  /**
   * 计算评委评分
   * @param {Object} submission - 用户提交的配方
   * @param {Object} theme - 挑战主题
   * @param {Object} level1Data - 第一层调酒数据
   * @returns {Object} 评分结果
   */
  judgeSubmission(submission, theme, level1Data = {}) {
    logger.session('[挑战赛] 开始评分', {
      theme: theme?.title,
      flavors: submission?.flavors?.length,
      base: submission?.base,
    });

    // 人格匹配度评分 (0-100)
    const personalityScore = this._calcPersonalityScore(submission, theme, level1Data);

    // 创意指数评分 (0-100)
    const creativityScore = this._calcCreativityScore(submission, theme);

    // 呈现感评分 (0-100)
    const presentationScore = this._calcPresentationScore(submission, theme);

    // 综合得分
    const totalScore = Math.round(
      personalityScore * 0.4 +
      creativityScore * 0.35 +
      presentationScore * 0.25
    );

    // 生成各评委的分数和评语
    const judges = ['cole', 'finn', 'sol'].map(key => {
      const judge = BARTENDERS[key];
      const judgeScore = this._getJudgeScore(key, totalScore);
      const comment = this._getJudgeComment(key, judgeScore);
      return {
        key,
        name: judge.name,
        icon: judge.icon,
        color: judge.color,
        personality: judge.personality,
        score: judgeScore,
        comment,
      };
    });

    const result = {
      personalityScore,
      creativityScore,
      presentationScore,
      totalScore,
      judges,
      rank: this._getRank(totalScore),
      evaluatedAt: Date.now(),
    };

    logger.session('[挑战赛] 评分完成', {
      totalScore,
      rank: result.rank,
    });

    return result;
  }

  _calcPersonalityScore(submission, theme, level1Data) {
    let score = 50;

    // 风味数量和主题匹配
    const flavorCount = submission?.flavors?.length || 0;
    if (flavorCount >= 3 && flavorCount <= 5) {
      score += 15;
    } else if (flavorCount > 5) {
      score += 5;
    }

    // 如果选择了故事基调，加分
    if (submission?.storyTone) {
      score += 10;
    }

    // 有第一层的情绪数据，匹配度加分
    if (level1Data?.emotion) {
      score += 10;
    }

    // 基酒选择明确
    if (submission?.base) {
      score += 10;
    }

    return Math.min(100, score);
  }

  _calcCreativityScore(submission, theme) {
    let score = 50;

    // 配料组合多样性
    const mixerCount = submission?.mixers?.length || 0;
    if (mixerCount >= 2) {
      score += 15;
    }

    // 装饰选择
    if (submission?.garnish) {
      score += 10;
    }

    // 风味组合的独特性（有苦+甜+酸等对比）
    const flavors = submission?.flavors || [];
    const hasContrast = flavors.includes('bitter') && flavors.includes('sweet') ||
                        flavors.includes('sour') && flavors.includes('sweet');
    if (hasContrast) {
      score += 15;
    }

    // 故事基调有选择
    if (submission?.storyTone) {
      score += 10;
    }

    return Math.min(100, score);
  }

  _calcPresentationScore(submission, theme) {
    let score = 50;

    // 有故事描述
    if (submission?.storyText && submission.storyText.length > 10) {
      score += 20;
    } else if (submission?.storyText) {
      score += 10;
    }

    // 装饰选择增加呈现感
    if (submission?.garnish) {
      score += 15;
    }

    // 配料完整
    const hasAll = submission?.base && submission?.mixers?.length > 0;
    if (hasAll) {
      score += 15;
    }

    return Math.min(100, score);
  }

  _getJudgeScore(judgeKey, totalScore) {
    // 每个评委有不同的评分倾向
    const bias = {
      cole: -2,   // Cole 偏严格
      finn: +3,   // Finn 偏宽松
      sol: 0,     // Sol 中立
    };
    const base = totalScore + (bias[judgeKey] || 0);
    // 加入一点随机性
    const random = Math.floor(Math.random() * 6) - 3;
    return Math.max(0, Math.min(100, base + random));
  }

  _getJudgeComment(judgeKey, score) {
    const comments = JUDGE_COMMENTS[judgeKey];
    if (!comments) return '...';

    let level = 'low';
    if (score >= 80) level = 'high';
    else if (score >= 60) level = 'mid';

    const pool = comments[level];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _getRank(score) {
    if (score >= 90) return { label: 'S', title: '调酒大师', color: '#ffd700' };
    if (score >= 80) return { label: 'A', title: '优秀调酒师', color: '#ff6b6b' };
    if (score >= 70) return { label: 'B', title: '熟练调酒师', color: '#4ecdc4' };
    if (score >= 60) return { label: 'C', title: '见习调酒师', color: '#45b7d1' };
    return { label: 'D', title: '新手调酒师', color: '#96ceb4' };
  }
}

export const challengeEngine = new ChallengeEngine();

// 导出常量
export {
  CHALLENGE_THEMES,
  FLAVOR_OPTIONS,
  BASE_OPTIONS,
  MIXER_OPTIONS,
  GARNISH_OPTIONS,
  STORY_TONES,
};
