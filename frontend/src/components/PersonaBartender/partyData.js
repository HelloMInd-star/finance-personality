/**
 * MBTI 企业家酒局数据
 * 基酒库 → MBTI映射 + 饮用方式 + 雪茄选择 + 话题池 + 角色定义
 */

// ========================================
// 8 种基酒 → MBTI 映射
// ========================================

export const SPIRITS = [
  {
    key: 'whiskey', name: '威士忌', icon: '🥃', color: '#d4a056',
    mbtiTypes: ['INTJ', 'ISTJ'],
    personas: ['马斯克', '巴菲特'],
    traits: ['系统架构', '长期主义', '沉稳'],
    dialogueStyle: '沉稳、结构化',
    catchphrase: '我看清全貌之后，才会做决定。',
  },
  {
    key: 'gin', name: '金酒', icon: '🍸', color: '#88c0d0',
    mbtiTypes: ['ENTP', 'INTP'],
    personas: ['索罗斯', '盖茨'],
    traits: ['颠覆创新', '逻辑推演', '锐利'],
    dialogueStyle: '锐利、反问式',
    catchphrase: '为什么不用另一种方式看这个问题？',
  },
  {
    key: 'tequila', name: '龙舌兰', icon: '🌵', color: '#f9c74f',
    mbtiTypes: ['ENTJ', 'ESTJ'],
    personas: ['孙正义', '任正非'],
    traits: ['战略指挥', '快速扩张', '果断'],
    dialogueStyle: '直接、冲击式',
    catchphrase: '机会只有一次，上不上？',
  },
  {
    key: 'sake', name: '清酒', icon: '🍶', color: '#e8e8e8',
    mbtiTypes: ['INTP', 'INFJ'],
    personas: ['稻盛和夫', '宫崎骏'],
    traits: ['纯净', '深度', '极致'],
    dialogueStyle: '精准、克制',
    catchphrase: '细节决定结果。',
  },
  {
    key: 'wine', name: '红酒', icon: '🍷', color: '#c1272d',
    mbtiTypes: ['INFJ', 'ENFJ'],
    personas: ['马丁·路德·金'],
    traits: ['共情', '远见', '柔和'],
    dialogueStyle: '共情、开放式',
    catchphrase: '你真正想要的是什么？',
  },
  {
    key: 'rum', name: '朗姆酒', icon: '🦜', color: '#f4a261',
    mbtiTypes: ['ENFP', 'ESFP'],
    personas: ['布兰森', '马云'],
    traits: ['热情', '自由', '感染力'],
    dialogueStyle: '热烈、叙事式',
    catchphrase: '这件事，我经历过。',
  },
  {
    key: 'baijiu', name: '白酒', icon: '🏮', color: '#e63946',
    mbtiTypes: ['ESTJ', 'ENTJ'],
    personas: ['任正非', '贝索斯'],
    traits: ['凛冽', '直接', '力量'],
    dialogueStyle: '直白、结论式',
    catchphrase: '行就行，不行就换。',
  },
  {
    key: 'vodka', name: '伏特加', icon: '❄️', color: '#a8dadc',
    mbtiTypes: ['ISTP', 'ESTP'],
    personas: ['技术型创业者'],
    traits: ['精准', '克制', '行动派'],
    dialogueStyle: '简洁、行动式',
    catchphrase: '做。',
  },
];

// ========================================
// 饮用方式 → 认知风格映射
// ========================================

export const DRINK_STYLES = [
  { key: 'neat', name: '纯饮', icon: '🥃', cognitiveStyle: '结构化', desc: '不掺杂，原汁原味' },
  { key: 'rocks', name: '加冰', icon: '🧊', cognitiveStyle: '灵活', desc: '缓慢释放，层层展开' },
  { key: 'cocktail', name: '调酒', icon: '🍹', cognitiveStyle: '创意', desc: '混合创造，无限可能' },
];

// ========================================
// 雪茄选择 → 时间偏好映射
// ========================================

export const CIGAR_OPTIONS = [
  { key: 'yes', name: '选一支雪茄', icon: '🚬', timePreference: '长期主义', desc: '愿意花时间等待一支雪茄燃尽' },
  { key: 'no', name: '不用，谢谢', icon: '🚭', timePreference: '实用主义', desc: '直接进入正题' },
];

// ========================================
// 酒局场景
// ========================================

export const SCENE_INTRO = `你走进一间雪茄吧，暖黄色的灯光下，三位企业家正在交谈。吧台上放着几杯酒——威士忌、金酒、龙舌兰……侍者走到你面前："今晚，你选哪一杯？"`;

// ========================================
// 话题池（每个话题有 4 个回应选项）
// ========================================

export const TOPICS = [
  {
    id: 'ai_decision',
    question: '"AI会不会取代人类的决策？"',
    options: [
      { key: 'A', text: 'AI是工具，决策权永远在人手里', style: '结构化', mbtiHint: 'T' },
      { key: 'B', text: '取决于什么层面的决策', style: '分析型', mbtiHint: 'N' },
      { key: 'C', text: '这问题本身就问错了', style: '反问式', mbtiHint: 'P' },
      { key: 'D', text: '我更关心AI不能做什么', style: '共情式', mbtiHint: 'F' },
    ],
  },
  {
    id: 'long_termism',
    question: '"长期主义是策略还是信仰？"',
    options: [
      { key: 'A', text: '是策略，有明确的回报周期', style: '结构化', mbtiHint: 'T' },
      { key: 'B', text: '是信仰，因为你无法证明它一定对', style: '信念型', mbtiHint: 'N' },
      { key: 'C', text: '取决于你能不能活到那天', style: '务实型', mbtiHint: 'S' },
      { key: 'D', text: '长期主义本身就是一种奢侈', style: '叙事式', mbtiHint: 'F' },
    ],
  },
  {
    id: 'founder_quality',
    question: '"创始人最重要的是什么？"',
    options: [
      { key: 'A', text: '看清方向的能力', style: '远见型', mbtiHint: 'N' },
      { key: 'B', text: '扛住压力的韧性', style: '结构化', mbtiHint: 'J' },
      { key: 'C', text: '让人愿意跟你走', style: '共情式', mbtiHint: 'F' },
      { key: 'D', text: '快速做决定，哪怕是对的', style: '行动式', mbtiHint: 'P' },
    ],
  },
  {
    id: 'opportunity',
    question: '"怎么判断一个机会值不值得投入？"',
    options: [
      { key: 'A', text: '算清楚下行风险，再谈收益', style: '结构化', mbtiHint: 'T' },
      { key: 'B', text: '看它能不能改变行业格局', style: '远见型', mbtiHint: 'N' },
      { key: 'C', text: '先干了再说，边走边调', style: '行动式', mbtiHint: 'P' },
      { key: 'D', text: '看团队能不能扛住最坏的情况', style: '共情式', mbtiHint: 'F' },
    ],
  },
];

// ========================================
// 酒局角色定义
// ========================================

export const PARTY_ROLES = {
  observer: { key: 'observer', name: '观察者', desc: '你习惯先听，然后再说。你不轻易开口，但开口的时候，往往是全场最安静的时刻。' },
  initiator: { key: 'initiator', name: '发起者', desc: '你总能找到话题的切入点，用一句话把所有人的注意力拉过来。' },
  challenger: { key: 'challenger', name: '挑战者', desc: '你不怕打破和谐。你的问题总是直击要害，让人不得不重新思考。' },
  connector: { key: 'connector', name: '连接者', desc: '你善于把不同人的观点串起来，在分歧中找到共识。' },
};

// ========================================
// 酒局步骤定义
// ========================================

export const PARTY_STEPS = [
  { title: '进入酒局', icon: '🚪' },
  { title: '选择基酒', icon: '🥃' },
  { title: '饮用方式', icon: '🧊' },
  { title: '雪茄', icon: '🚬' },
  { title: '对话环节', icon: '💬' },
  { title: '酒局报告', icon: '📊' },
];
