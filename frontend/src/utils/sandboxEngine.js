/**
 * MBTI 酒局模拟沙盘引擎
 * 第三层：模拟社交酒局场景 + 人格动态图谱
 */
import { logger } from './logger';

// ============================================================
// 酒局场景
// ============================================================

const SCENARIOS = [
  {
    id: 'business',
    title: '商务晚宴',
    desc: '一场重要的行业晚宴，桌上有你的客户、合作伙伴和竞争对手。',
    atmosphere: 'formal',
    background: '水晶吊灯、西装革履、低声交谈',
  },
  {
    id: 'friends',
    title: '朋友聚会',
    desc: '和几个认识多年的老朋友在一家小酒馆，今晚只想放松。',
    atmosphere: 'casual',
    background: '暖黄灯光、木质桌椅、笑声不断',
  },
  {
    id: 'networking',
    title: '行业交流会',
    desc: '每周一次的行业酒会，每个人都在递名片、找机会。',
    atmosphere: 'professional',
    background: '高脚杯、西装外套、名片交换',
  },
  {
    id: 'date',
    title: '约会小酌',
    desc: '和一个有好感的人在酒吧，你们刚认识不久。',
    atmosphere: 'intimate',
    background: '烛光、爵士乐、暧昧气氛',
  },
  {
    id: 'celebration',
    title: '庆功派对',
    desc: '团队完成了一个大项目，今晚是庆功宴。',
    atmosphere: 'festive',
    background: '气球、香槟、欢笑声',
  },
];

// ============================================================
// 酒局中的 MBTI 角色
// ============================================================

const MBTI_CHARACTERS = [
  {
    mbti: 'ENTJ',
    name: 'Alex',
    role: '公司创始人',
    desc: '气场很强，说话直接，主导着大部分对话',
    color: '#ff4757',
  },
  {
    mbti: 'INFP',
    name: 'Luna',
    role: '独立设计师',
    desc: '安静地坐在角落，但笑起来很好看',
    color: '#a29bfe',
  },
  {
    mbti: 'ESTP',
    name: 'Jake',
    role: '销售总监',
    desc: '桌上的气氛担当，段子一个接一个',
    color: '#fdcb6e',
  },
  {
    mbti: 'INTJ',
    name: 'Vera',
    role: '战略顾问',
    desc: '话不多，但每一句都切中要害',
    color: '#74b9ff',
  },
  {
    mbti: 'ENFJ',
    name: 'Mia',
    role: '人力资源总监',
    desc: '总能注意到没说话的人，主动照顾每个人',
    color: '#55efc4',
  },
  {
    mbti: 'ISTP',
    name: 'Kai',
    role: '工程师',
    desc: '默默喝着酒，偶尔蹦出一个冷笑话',
    color: '#636e72',
  },
];

// ============================================================
// 五轮选择配置
// ============================================================

const ROUNDS = [
  {
    round: 1,
    title: '落座',
    desc: '你走进酒局，房间里有几个人。你会选择坐在哪里？',
    dimension: 'E/I',
    dimensionLabel: '能量来源',
    question: '靠近谁坐下？',
  },
  {
    round: 2,
    title: '话题',
    desc: '有人提出了一个话题，你的第一反应是？',
    dimension: 'T/F',
    dimensionLabel: '决策方式',
    question: '如何回应？',
  },
  {
    round: 3,
    title: '冲突',
    desc: '两个人因为某个观点产生了分歧，你会？',
    dimension: 'J/P',
    dimensionLabel: '生活方式',
    question: '如何处理冲突？',
  },
  {
    round: 4,
    title: '敬酒',
    desc: '有人举起酒杯向你走来，说"敬你一杯"。你会？',
    dimension: 'E/I',
    dimensionLabel: '社交策略',
    question: '如何应对？',
  },
  {
    round: 5,
    title: '离场',
    desc: '酒局接近尾声，你会怎么结束今晚？',
    dimension: 'J/P',
    dimensionLabel: '结束方式',
    question: '如何离场？',
  },
];

// ============================================================
// 各轮的具体选项
// ============================================================

const ROUND_OPTIONS = {
  1: [
    { key: 'a', text: '主动走向最热闹的那群人', traits: { E: 20, I: -10 } },
    { key: 'b', text: '找一个安静的角落，先观察一下', traits: { E: -10, I: 20 } },
    { key: 'c', text: '直接走向那个看起来最有气场的人', traits: { E: 10, I: 5, T: 10 } },
    { key: 'd', text: '找那个独自坐在角落的人，觉得TA可能有故事', traits: { I: 15, F: 10 } },
  ],
  2: [
    { key: 'a', text: '分析数据和逻辑，给出客观判断', traits: { T: 20, F: -10, N: 5 } },
    { key: 'b', text: '先考虑大家的感受，照顾每个人的情绪', traits: { F: 20, T: -10, E: 5 } },
    { key: 'c', text: '开个玩笑，把气氛搞轻松', traits: { E: 15, P: 10 } },
    { key: 'd', text: '先听听大家怎么说，再表态', traits: { I: 10, J: 5 } },
  ],
  3: [
    { key: 'a', text: '分析双方的逻辑，判断谁更有道理', traits: { T: 15, J: 10 } },
    { key: 'b', text: '试图调解，找一个双方都能接受的方案', traits: { F: 15, J: 5 } },
    { key: 'c', text: '不站队，先观察一会儿再表态', traits: { P: 15, I: 10 } },
    { key: 'd', text: '把话题岔开，换一个轻松点的', traits: { P: 15, E: 10 } },
  ],
  4: [
    { key: 'a', text: '大方地喝一口，顺便聊点别的', traits: { E: 15, P: 5 } },
    { key: 'b', text: '礼貌地推辞，说自己不太能喝', traits: { I: 10, J: 5 } },
    { key: 'c', text: '喝，但只喝一小口意思一下', traits: { I: 5, F: 10 } },
    { key: 'd', text: '借机敬酒，聊起一个对方感兴趣的话题', traits: { E: 10, T: 10, J: 5 } },
  ],
  5: [
    { key: 'a', text: '提前离场，和每个人打好招呼再走', traits: { J: 15, E: 5 } },
    { key: 'b', text: '留到最后，帮着收拾一下', traits: { J: 10, F: 15, I: 5 } },
    { key: 'c', text: '看情况，有事先走，没事多待一会儿', traits: { P: 15, I: 5 } },
    { key: 'd', text: '悄悄走，不想太引人注目', traits: { I: 20, P: 5 } },
  ],
};

// ============================================================
// MBTI 概率映射表
// ============================================================

const MBTI_TRAITS = {
  INTJ: { I: 25, N: 25, T: 25, J: 25 },
  INTP: { I: 25, N: 25, T: 25, P: 25 },
  ENTJ: { E: 25, N: 25, T: 25, J: 25 },
  ENTP: { E: 25, N: 25, T: 25, P: 25 },
  INFJ: { I: 25, N: 25, F: 25, J: 25 },
  INFP: { I: 25, N: 25, F: 25, P: 25 },
  ENFJ: { E: 25, N: 25, F: 25, J: 25 },
  ENFP: { E: 25, N: 25, F: 25, P: 25 },
  ISTJ: { I: 25, S: 25, T: 25, J: 25 },
  ISFJ: { I: 25, S: 25, F: 25, J: 25 },
  ESTJ: { E: 25, S: 25, T: 25, J: 25 },
  ESFJ: { E: 25, S: 25, F: 25, J: 25 },
  ISTP: { I: 25, S: 25, T: 25, P: 25 },
  ISFP: { I: 25, S: 25, F: 25, P: 25 },
  ESTP: { E: 25, S: 25, T: 25, P: 25 },
  ESFP: { E: 25, S: 25, F: 25, P: 25 },
};

// ============================================================
// 调酒师评语（酒局版）
// ============================================================

const BARTENDER_SANDBOX_COMMENTS = {
  cole: [
    '你在酒局里像一个观察者，但你介入的时候，说的都是关键点。',
    '你的选择很有策略性。每一步都有目的。',
    '不张扬，但存在感很强。这是一种稀有的品质。',
  ],
  finn: [
    '你太有意思了！你的选择完全出乎我的意料，但又很有道理。',
    '我喜欢你这种随性又聪明的风格。酒局因为你变得有趣了。',
    '你总能在合适的时候说合适的话。这是天赋。',
  ],
  sol: [
    '嗯...你在酒局里有一种特别的安静。不是没有存在感，是选择了观察。',
    '你的选择...很真实。很多人在酒局里扮演别人，你没有。',
    '我感觉到了一些东西。很深。但可能你自己都没意识到。',
  ],
};

// ============================================================
// 沙盘引擎类
// ============================================================

class SandboxEngine {
  constructor() {
    logger.info('SandboxEngine 初始化');
  }

  /**
   * 获取随机场景
   */
  getRandomScenario() {
    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    logger.session('[沙盘] 生成场景', scenario.title);
    return scenario;
  }

  /**
   * 获取场景中的4个随机角色
   */
  getRandomCharacters(count = 4) {
    const shuffled = [...MBTI_CHARACTERS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * 获取某一轮的配置
   */
  getRoundConfig(roundNum) {
    const round = ROUNDS.find(r => r.round === roundNum);
    const options = ROUND_OPTIONS[roundNum] || [];
    return { round, options };
  }

  /**
   * 获取所有轮次配置
   */
  getAllRounds() {
    return ROUNDS.map(r => ({
      ...r,
      options: ROUND_OPTIONS[r.round] || [],
    }));
  }

  /**
   * 根据用户的选择计算 MBTI 维度和概率分布
   * @param {Array} choices - 用户的选择 [{round, optionKey}]
   * @param {Object} level1Data - 第一层调酒数据
   * @param {Object} level2Data - 第二层挑战数据
   * @returns {Object} 人格图谱
   */
  calculatePersonality(choices, level1Data = {}, level2Data = {}) {
    logger.session('[沙盘] 计算人格图谱', { choices: choices?.length });

    // 初始化各维度的分数
    const scores = {
      E: 50, I: 50,
      S: 50, N: 50,
      T: 50, F: 50,
      J: 50, P: 50,
    };

    // 记录每轮选择的描述
    const choiceDescriptions = [];

    // 根据选择累加分数
    choices.forEach(choice => {
      const { round, optionKey } = choice;
      const options = ROUND_OPTIONS[round] || [];
      const selected = options.find(o => o.key === optionKey);

      if (selected) {
        choiceDescriptions.push({
          round,
          title: ROUNDS.find(r => r.round === round)?.title,
          text: selected.text,
        });

        if (selected.traits) {
          Object.entries(selected.traits).forEach(([trait, value]) => {
            if (scores[trait] !== undefined) {
              scores[trait] += value;
            }
          });
        }
      }
    });

    // 第一层调酒数据修正
    if (level1Data?.emotion) {
      const emotionModifiers = {
        calm: { I: 5, T: 5 },
        passion: { E: 5, P: 5 },
        deep: { I: 5, N: 5 },
        tired: { I: 10 },
        excited: { E: 10, P: 5 },
        nostalgic: { I: 5, F: 5 },
      };
      const mods = emotionModifiers[level1Data.emotion] || {};
      Object.entries(mods).forEach(([trait, value]) => {
        if (scores[trait] !== undefined) {
          scores[trait] += value;
        }
      });
    }

    // 第二层挑战赛数据修正
    if (level2Data?.totalScore) {
      // 高分增加自信（E）维度
      if (level2Data.totalScore >= 80) {
        scores.E += 5;
      }
      // 创意得分高增加 N（直觉）维度
      if (level2Data.creativityScore >= 75) {
        scores.N += 5;
      }
    }

    // 计算各维度百分比
    const dimensions = {
      'E/I': this._calcDimensionPercent(scores.E, scores.I),
      'S/N': this._calcDimensionPercent(scores.S, scores.N),
      'T/F': this._calcDimensionPercent(scores.T, scores.F),
      'J/P': this._calcDimensionPercent(scores.J, scores.P),
    };

    // 计算 MBTI 类型
    const mbtiType = this._calcMBTIType(dimensions);

    // 计算各 MBTI 类型的概率分布
    const probabilities = this._calcMBTIProbabilities(dimensions, scores);

    const result = {
      dimensions,
      scores,
      mbtiType,
      probabilities,
      choiceDescriptions,
      calculatedAt: Date.now(),
    };

    logger.session('[沙盘] 人格图谱计算完成', {
      mbtiType,
      topProb: probabilities[0],
    });

    return result;
  }

  _calcDimensionPercent(a, b) {
    const total = Math.max(1, a + b);
    const percentA = Math.round((a / total) * 100);
    const percentB = 100 - percentA;
    const dominant = a >= b ? 'A' : 'B';
    return { percentA, percentB, dominant };
  }

  _calcMBTIType(dimensions) {
    const ei = dimensions['E/I'].dominant === 'A' ? 'E' : 'I';
    const sn = dimensions['S/N'].dominant === 'A' ? 'S' : 'N';
    const tf = dimensions['T/F'].dominant === 'A' ? 'T' : 'F';
    const jp = dimensions['J/P'].dominant === 'A' ? 'J' : 'P';
    return ei + sn + tf + jp;
  }

  _calcMBTIProbabilities(dimensions, scores) {
    logger.session('[沙盘] 计算 MBTI 概率分布', { scores });

    // 使用维度比例相乘来计算匹配度
    // 这样可以显著放大不同类型之间的概率差异
    const dimPairs = [
      ['E', 'I'], ['S', 'N'], ['T', 'F'], ['J', 'P']
    ];

    const results = Object.entries(MBTI_TRAITS).map(([type, traits]) => {
      let matchScore = 1;

      dimPairs.forEach(([a, b]) => {
        const total = (scores[a] || 50) + (scores[b] || 50);
        if (total <= 0) return;

        // 如果类型偏好 a，匹配度 = scores[a]/total
        // 如果类型偏好 b，匹配度 = scores[b]/total
        if (traits[a] !== undefined) {
          matchScore *= (scores[a] || 50) / total;
        } else if (traits[b] !== undefined) {
          matchScore *= (scores[b] || 50) / total;
        }
      });

      return { type, score: matchScore };
    });

    // 归一化转换为概率
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const probabilities = results.map(r => ({
      type: r.type,
      probability: totalScore > 0 ? Math.round((r.score / totalScore) * 100) : 6,
    }));

    // 按概率降序排列
    probabilities.sort((a, b) => b.probability - a.probability);

    // 确保概率总和为 100%（修正四舍五入误差）
    const probSum = probabilities.reduce((sum, p) => sum + p.probability, 0);
    if (probSum !== 100 && probabilities.length > 0) {
      probabilities[0].probability += (100 - probSum);
    }

    logger.session('[沙盘] 概率分布计算完成', {
      top: probabilities[0],
      bottom: probabilities[probabilities.length - 1],
      spread: probabilities[0].probability - probabilities[probabilities.length - 1].probability,
    });

    return probabilities;
  }

  /**
   * 获取调酒师评语
   */
  getBartenderComment(bartenderKey, personalityData) {
    const comments = BARTENDER_SANDBOX_COMMENTS[bartenderKey] || [];
    return comments[Math.floor(Math.random() * comments.length)];
  }
}

export const sandboxEngine = new SandboxEngine();

// 导出常量
export {
  SCENARIOS,
  MBTI_CHARACTERS,
  ROUNDS,
  ROUND_OPTIONS,
  MBTI_TRAITS,
};
