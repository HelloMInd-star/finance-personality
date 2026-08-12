/**
 * 脉轮测试题库 + 七脉轮定义
 * 每脉轮 3 题,共 21 题,每题 1-4 分
 */

// ========================================
// 七脉轮定义(传统颜色 + 中文名 + 位置)
// ========================================

export const CHAKRAS = [
  {
    key: 'root',
    name: '海底轮',
    nameEn: 'Root',
    color: '#E53935',       // 红
    position: '脊柱底部',
    element: '土',
    desc: '与身体、生存、安全感相连',
    balanceHint: '你与身体的连接是稳固的，安全感与生命力充沛。',
    avgHint: '身体的连接有待加强，需要更多扎根与稳定。',
    weakHint: '需要更多自我关爱与接纳，关注身体与安全感。',
  },
  {
    key: 'sacral',
    name: '脐轮',
    nameEn: 'Sacral',
    color: '#FB8C00',       // 橙
    position: '下腹部',
    element: '水',
    desc: '与情绪、感受、创造力相连',
    balanceHint: '情绪流动自如，感受力与创造力活跃。',
    avgHint: '情绪表达有待释放，让感受更自由地流动。',
    weakHint: '情绪能量阻塞，需要学习接纳与表达感受。',
  },
  {
    key: 'solar',
    name: '太阳轮',
    nameEn: 'Solar Plexus',
    color: '#FDD835',       // 黄
    position: '胃部',
    element: '火',
    desc: '与自信、意志力、个人力量相连',
    balanceHint: '自信和决策力突出，个人力量充沛。',
    avgHint: '自信可以更稳定，让意志力更聚焦。',
    weakHint: '需要重建自信，激活内在的力量中心。',
  },
  {
    key: 'heart',
    name: '心轮',
    nameEn: 'Heart',
    color: '#43A047',       // 绿
    position: '胸口',
    element: '风',
    desc: '与爱、同理心、人际关系相连',
    balanceHint: '爱与同理心平衡，人际关系融洽。',
    avgHint: '可以让心更打开一些，给予和接受更多爱。',
    weakHint: '需要更多自我关爱和接纳，让心轮重新敞开。',
  },
  {
    key: 'throat',
    name: '喉轮',
    nameEn: 'Throat',
    color: '#1E88E5',       // 蓝
    position: '喉咙',
    element: '以太',
    desc: '与表达、沟通、真理相连',
    balanceHint: '表达清晰真实，沟通能力出众。',
    avgHint: '表达上可以更勇敢，让声音被听见。',
    weakHint: '需要练习真实表达，释放被压抑的声音。',
  },
  {
    key: 'thirdEye',
    name: '眉心轮',
    nameEn: 'Third Eye',
    color: '#5E35B1',       // 靛
    position: '眉心',
    element: '光',
    desc: '与直觉、想象力、洞察力相连',
    balanceHint: '直觉力敏锐，洞察与想象力丰富。',
    avgHint: '直觉正在发展，可以更多信任内在的声音。',
    weakHint: '需要唤醒内在视觉，练习静心与观察。',
  },
  {
    key: 'crown',
    name: '顶轮',
    nameEn: 'Crown',
    color: '#8E24AA',       // 紫
    position: '头顶',
    element: '思',
    desc: '与灵性、智慧、宇宙连接相连',
    balanceHint: '灵性连接通畅，与更高智慧保持对话。',
    avgHint: '灵性连接正在发展，保持开放与好奇。',
    weakHint: '可以更多思考生命的意义，开启灵性维度。',
  },
];

// 脉轮 key 列表(用于遍历)
export const CHAKRA_KEYS = CHAKRAS.map((c) => c.key);

// ========================================
// 21 题题库(按脉轮分组,每脉轮 3 题)
// ========================================

export const QUESTIONS = [
  // --- 海底轮 (1-3) ---
  { id: 1, chakra: 'root', text: '你多久会做一次身体锻炼？',
    options: [
      { score: 1, label: '从不' },
      { score: 2, label: '偶尔' },
      { score: 3, label: '经常' },
      { score: 4, label: '每天' },
    ] },
  { id: 2, chakra: 'root', text: '你的饮食质量如何？',
    options: [
      { score: 1, label: '糟糕' },
      { score: 2, label: '一般' },
      { score: 3, label: '良好' },
      { score: 4, label: '绝佳' },
    ] },
  { id: 3, chakra: 'root', text: '你如何评估自己身体的总体健康状况？',
    options: [
      { score: 1, label: '差' },
      { score: 2, label: '一般' },
      { score: 3, label: '良好' },
      { score: 4, label: '绝佳' },
    ] },

  // --- 脐轮 (4-6) ---
  { id: 4, chakra: 'sacral', text: '你如何评估自己感受情绪的能力？',
    options: [
      { score: 1, label: '很弱' },
      { score: 2, label: '中等' },
      { score: 3, label: '较强' },
      { score: 4, label: '很强' },
    ] },
  { id: 5, chakra: 'sacral', text: '你如何评估自己表达情绪的能力？',
    options: [
      { score: 1, label: '很弱' },
      { score: 2, label: '中等' },
      { score: 3, label: '较强' },
      { score: 4, label: '很强' },
    ] },
  { id: 6, chakra: 'sacral', text: '你如何评估自己处理愤怒的能力？',
    options: [
      { score: 1, label: '很弱' },
      { score: 2, label: '中等' },
      { score: 3, label: '较强' },
      { score: 4, label: '很强' },
    ] },

  // --- 太阳轮 (7-9) ---
  { id: 7, chakra: 'solar', text: '你是否有自信？',
    options: [
      { score: 1, label: '几乎从不' },
      { score: 2, label: '有时' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },
  { id: 8, chakra: 'solar', text: '你是否有自尊心？',
    options: [
      { score: 1, label: '几乎从不' },
      { score: 2, label: '有时' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },
  { id: 9, chakra: 'solar', text: '你是否能为自己做主？',
    options: [
      { score: 1, label: '几乎从不' },
      { score: 2, label: '有时' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },

  // --- 心轮 (10-12) ---
  { id: 10, chakra: 'heart', text: '你爱自己吗？',
    options: [
      { score: 1, label: '不爱' },
      { score: 2, label: '偶尔' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },
  { id: 11, chakra: 'heart', text: '你是否具有同情心？',
    options: [
      { score: 1, label: '很少' },
      { score: 2, label: '有时' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },
  { id: 12, chakra: 'heart', text: '你处理人际关系的能力如何？',
    options: [
      { score: 1, label: '差' },
      { score: 2, label: '一般' },
      { score: 3, label: '良好' },
      { score: 4, label: '极好' },
    ] },

  // --- 喉轮 (13-15) ---
  { id: 13, chakra: 'throat', text: '你是否能清晰表达自己的想法？',
    options: [
      { score: 1, label: '从不' },
      { score: 2, label: '有时' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },
  { id: 14, chakra: 'throat', text: '你是个好的倾听者吗？',
    options: [
      { score: 1, label: '不是' },
      { score: 2, label: '有时' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },
  { id: 15, chakra: 'throat', text: '你是否敢于说出真话？',
    options: [
      { score: 1, label: '从不' },
      { score: 2, label: '有时' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },

  // --- 眉心轮 (16-18) ---
  { id: 16, chakra: 'thirdEye', text: '你是否相信自己的直觉？',
    options: [
      { score: 1, label: '从不' },
      { score: 2, label: '有时' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },
  { id: 17, chakra: 'thirdEye', text: '你会有（且能记住）生动的梦境吗？',
    options: [
      { score: 1, label: '从不' },
      { score: 2, label: '偶尔' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },
  { id: 18, chakra: 'thirdEye', text: '你的想象力是否丰富？',
    options: [
      { score: 1, label: '不' },
      { score: 2, label: '一般' },
      { score: 3, label: '丰富' },
      { score: 4, label: '极其丰富' },
    ] },

  // --- 顶轮 (19-21) ---
  { id: 19, chakra: 'crown', text: '你是否思考过生命的意义？',
    options: [
      { score: 1, label: '从未' },
      { score: 2, label: '偶尔' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },
  { id: 20, chakra: 'crown', text: '你是否信任宇宙/生命的智慧？',
    options: [
      { score: 1, label: '从不' },
      { score: 2, label: '有时' },
      { score: 3, label: '经常' },
      { score: 4, label: '总是' },
    ] },
  { id: 21, chakra: 'crown', text: '你是否做过静心冥想或深度放松？',
    options: [
      { score: 1, label: '从不' },
      { score: 2, label: '偶尔' },
      { score: 3, label: '经常' },
      { score: 4, label: '每天' },
    ] },
];

// ========================================
// 状态阈值规则
// ========================================

export const STATUS_LEVELS = {
  strong: { key: 'strong', label: '强壮', color: '#43A047', min: 9, max: 12 },
  average: { key: 'average', label: '平均', color: '#FDD835', min: 6, max: 8 },
  weak: { key: 'weak', label: '虚弱', color: '#E53935', min: 3, max: 5 },
};

export const TOTAL_QUESTIONS = QUESTIONS.length; // 21
