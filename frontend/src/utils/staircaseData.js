/**
 * 人格爬楼梯 - 题库与权重配置
 * 12 级楼梯，5 组，斐波那契分布 (1, 1, 2, 3, 5)
 */

// 斐波那契权重（每组的权重值）
export const FIBONACCI_WEIGHTS = {
  group1: 1,  // 风险
  group2: 1,  // 时间
  group3: 2,  // 风格
  group4: 3,  // 模型
  group5: 5,  // MBTI
};

// 组配置
export const STAIRCASE_GROUPS = [
  {
    id: 'group1',
    name: '风险承受',
    dimension: 'risk',
    steps: 1,
    weight: FIBONACCI_WEIGHTS.group1,
    description: '面对不确定性的基本态度',
  },
  {
    id: 'group2',
    name: '时间视野',
    dimension: 'time',
    steps: 1,
    weight: FIBONACCI_WEIGHTS.group2,
    description: '你做决策时习惯看多远',
  },
  {
    id: 'group3',
    name: '决策风格',
    dimension: 'style',
    steps: 2,
    weight: FIBONACCI_WEIGHTS.group3,
    description: '你处理信息和做出判断的方式',
  },
  {
    id: 'group4',
    name: '市场模型',
    dimension: 'model',
    steps: 3,
    weight: FIBONACCI_WEIGHTS.group4,
    description: '你理解市场运行规律的思维框架',
  },
  {
    id: 'group5',
    name: '人格底色',
    dimension: 'mbti',
    steps: 5,
    weight: FIBONACCI_WEIGHTS.group5,
    description: '你的 MBTI 人格类型',
  },
];

// 12 道题目
// 每道题：id, groupId, question, options[]
// options: { label, value, effects: { dimension: scoreDelta, mbti?: { letter: 'E'|'I'|... } } }
export const STAIRCASE_QUESTIONS = [
  // ===== 组 1：风险承受（1 题） =====
  {
    id: 'q1',
    groupId: 'group1',
    question: '市场突然暴跌 20%，你的第一反应是？',
    options: [
      {
        label: '赶紧清仓，保住本金再说',
        effects: { risk: -30 },
      },
      {
        label: '减仓一半，观望一下',
        effects: { risk: -10 },
      },
      {
        label: '不动，持有等待反弹',
        effects: { risk: 15 },
      },
      {
        label: '加仓！这是抄底的好机会',
        effects: { risk: 35 },
      },
    ],
  },

  // ===== 组 2：时间视野（1 题） =====
  {
    id: 'q2',
    groupId: 'group2',
    question: '你买入一只股票后，通常的计划持有期是？',
    options: [
      {
        label: '几天到几周，赚了就跑',
        effects: { time: -35 },
      },
      {
        label: '几个月到一年',
        effects: { time: -10 },
      },
      {
        label: '1-3 年',
        effects: { time: 20 },
      },
      {
        label: '5 年以上，只要公司没变就不卖',
        effects: { time: 40 },
      },
    ],
  },

  // ===== 组 3：决策风格（2 题） =====
  {
    id: 'q3',
    groupId: 'group3',
    question: '做投资决策时，你更依赖？',
    options: [
      {
        label: '直觉和盘感，感觉对了就上',
        effects: { style: -35 },
      },
      {
        label: '听朋友/大 V 推荐',
        effects: { style: -20 },
      },
      {
        label: '看一些数据和新闻，综合判断',
        effects: { style: 15 },
      },
      {
        label: '深入研究财报和行业，有完整逻辑',
        effects: { style: 40 },
      },
    ],
  },
  {
    id: 'q4',
    groupId: 'group3',
    question: '当你的判断和市场走势相反时，你会？',
    options: [
      {
        label: '马上怀疑自己，跟着市场走',
        effects: { style: -25 },
      },
      {
        label: '有点慌，但再观察几天',
        effects: { style: 0 },
      },
      {
        label: '坚持自己的判断，甚至加仓',
        effects: { style: 25 },
      },
    ],
  },

  // ===== 组 4：市场模型（3 题） =====
  {
    id: 'q5',
    groupId: 'group4',
    question: '你认为市场涨跌主要由什么决定？',
    options: [
      {
        label: '庄家和资金操纵',
        effects: { model: -25 },
      },
      {
        label: '宏观政策和消息面',
        effects: { model: 5 },
      },
      {
        label: '公司基本面和估值',
        effects: { model: 25 },
      },
      {
        label: '多种因素的复杂系统（基本面+情绪+周期）',
        effects: { model: 40 },
      },
    ],
  },
  {
    id: 'q6',
    groupId: 'group4',
    question: '你如何理解"风险"？',
    options: [
      {
        label: '风险 = 亏钱的可能性',
        effects: { model: -10 },
      },
      {
        label: '风险 = 波动大小',
        effects: { model: 10 },
      },
      {
        label: '风险 = 你不知道自己在做什么',
        effects: { model: 30 },
      },
    ],
  },
  {
    id: 'q7',
    groupId: 'group4',
    question: '面对亏损，你的习惯是？',
    options: [
      {
        label: '割肉止损，不能越亏越多',
        effects: { model: -15 },
      },
      {
        label: '死扛，等涨回来再卖',
        effects: { model: 0 },
      },
      {
        label: '分析亏损原因，总结成经验教训',
        effects: { model: 25 },
      },
      {
        label: '建立系统，用原则避免重复犯错',
        effects: { model: 40 },
      },
    ],
  },

  // ===== 组 5：MBTI（5 题，每题对应一个维度） =====
  {
    id: 'q8',
    groupId: 'group5',
    question: '周末你更倾向于？',
    mbtiDimension: 'EI',
    options: [
      { label: '和朋友聚会聊天', effects: { mbti: { E: 1 } } },
      { label: '一个人看书/研究/独处', effects: { mbti: { I: 1 } } },
    ],
  },
  {
    id: 'q9',
    groupId: 'group5',
    question: '做决策时，你更关注？',
    mbtiDimension: 'SN',
    options: [
      { label: '具体事实和数据细节', effects: { mbti: { S: 1 } } },
      { label: '整体趋势和未来可能性', effects: { mbti: { N: 1 } } },
    ],
  },
  {
    id: 'q10',
    groupId: 'group5',
    question: '判断一件事时，你更依赖？',
    mbtiDimension: 'TF',
    options: [
      { label: '逻辑分析和客观标准', effects: { mbti: { T: 1 } } },
      { label: '个人感受和价值观', effects: { mbti: { F: 1 } } },
    ],
  },
  {
    id: 'q11',
    groupId: 'group5',
    question: '你的生活/工作风格更偏向？',
    mbtiDimension: 'JP',
    options: [
      { label: '有计划有条理，按日程走', effects: { mbti: { J: 1 } } },
      { label: '灵活随性，随机应变', effects: { mbti: { P: 1 } } },
    ],
  },
  {
    id: 'q12',
    groupId: 'group5',
    question: '面对新观点时，你的第一反应是？',
    mbtiDimension: 'SN',
    options: [
      { label: '先看有没有实际案例和数据支撑', effects: { mbti: { S: 1 } } },
      { label: '先想象这个观点能推导出什么新模式', effects: { mbti: { N: 1 } } },
    ],
  },
];

/**
 * 根据答题结果计算 DNA 分数（带斐波那契权重）
 * @param {Object} answers - { questionId: optionIndex }
 * @returns {Object} - { risk, time, style, model, mbti }
 */
export const calculateStaircaseDNA = (answers) => {
  const scores = {
    risk: 50,
    time: 50,
    style: 50,
    model: 50,
    mbtiCounts: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
  };

  for (const qId of Object.keys(answers)) {
    const question = STAIRCASE_QUESTIONS.find((q) => q.id === qId);
    if (!question) continue;

    const option = question.options[answers[qId]];
    if (!option) continue;

    const group = STAIRCASE_GROUPS.find((g) => g.id === question.groupId);
    const weight = group ? group.weight : 1;

    // 数值维度（带斐波那契权重放大）
    if (option.effects.risk !== undefined) {
      scores.risk += option.effects.risk * weight * 0.5;
    }
    if (option.effects.time !== undefined) {
      scores.time += option.effects.time * weight * 0.5;
    }
    if (option.effects.style !== undefined) {
      scores.style += option.effects.style * weight * 0.5;
    }
    if (option.effects.model !== undefined) {
      scores.model += option.effects.model * weight * 0.5;
    }

    // MBTI 计数
    if (option.effects.mbti) {
      for (const letter of Object.keys(option.effects.mbti)) {
        scores.mbtiCounts[letter] = (scores.mbtiCounts[letter] || 0) + option.effects.mbti[letter];
      }
    }
  }

  // 钳制到 0-100
  scores.risk = Math.max(0, Math.min(100, Math.round(scores.risk)));
  scores.time = Math.max(0, Math.min(100, Math.round(scores.time)));
  scores.style = Math.max(0, Math.min(100, Math.round(scores.style)));
  scores.model = Math.max(0, Math.min(100, Math.round(scores.model)));

  // 推断 MBTI
  const { mbtiCounts } = scores;
  const e = mbtiCounts.E || 0;
  const i = mbtiCounts.I || 0;
  const s = mbtiCounts.S || 0;
  const n = mbtiCounts.N || 0;
  const t = mbtiCounts.T || 0;
  const f = mbtiCounts.F || 0;
  const j = mbtiCounts.J || 0;
  const p = mbtiCounts.P || 0;

  const mbti =
    (e >= i ? 'E' : 'I') +
    (s >= n ? 'S' : 'N') +
    (t >= f ? 'T' : 'F') +
    (j >= p ? 'J' : 'P');

  delete scores.mbtiCounts;
  scores.mbti = mbti;

  return scores;
};
