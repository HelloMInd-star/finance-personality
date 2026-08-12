/**
 * 消费风格匹配引擎
 * 功能：
 *  1. 提取投资人/创业家的消费画像
 *  2. 根据用户输入匹配消费风格
 *  3. 生成消费风格报告
 */

import { ALL_PROFILES, getProfileById } from './benchmarkProfiles';
import { logger } from './logger';

// ============= 消费风格维度 =============

const CONSUMPTION_STYLES = {
  minimalism: { name: '极简主义', desc: '只买需要的，注重品质而非数量' },
  practical: { name: '实用主义', desc: '功能优先，不为品牌和外观付费' },
  premium: { name: '品质导向', desc: '愿意为高品质和经典设计支付溢价' },
  experience: { name: '体验导向', desc: '更愿意为服务、体验和独特性付费' },
  value: { name: '价值敏感', desc: '精打细算，追求性价比' },
  impulsive: { name: '冲动消费', desc: '容易被情绪和营销打动' },
};

const PREFERENCE_LABELS = {
  quality: '质量',
  price: '价格',
  brand: '品牌',
  appearance: '外观',
};

const WAIT_LABELS = {
  never: '从不',
  sometimes: '偶尔',
  often: '经常',
};

// ============= 从人物数据提取消费画像 =============

/**
 * 获取人物的消费画像（用于展示）
 */
export function getConsumptionProfile(profileId) {
  const profile = getProfileById(profileId);
  if (!profile) return null;

  const cons = profile.consumption || {};

  return {
    personId: profile.id,
    personName: profile.name,
    personEmoji: profile.emoji,
    style: cons.style || '未定义',
    styleLabel: CONSUMPTION_STYLES[cons.style]?.name || cons.style,
    categories: cons.categories || [],
    frequency: cons.frequency || '未定义',
    principle: extractConsumptionPrinciple(profile),
    shoppingQuote: extractShoppingQuote(profile),
  };
}

function extractConsumptionPrinciple(profile) {
  const principles = {
    buffett: '只买我需要的东西。',
    munger: '要买好东西，而不是便宜东西。',
    sorros: '在变化中寻找机会，消费也是一种投资。',
    simons: '用数据和模型做消费决策。',
    dalio: '消费要和你的原则保持一致。',
    druckenmiller: '在确信的事情上重拳出击，其他时候保持克制。',
    lynch: '买你懂的东西，消费也是如此。',
    templeton: '在别人贪婪时恐惧，在别人恐惧时消费。',
    kaufman: '为知识和能力付费，是最好的投资。',
    liu: '消费是为了更好的生活，而不是为了炫耀。',
    lei: '性价比是永恒的追求。',
    huang: '为普惠而消费，为价值而等待。',
    zhang: 'all in 你真正热爱的东西。',
    wang: '长期主义消费，一次买对用十年。',
    xu: '消费也是一种表达自我的方式。',
    zhou: '体验比物质更重要。',
    wu: '技术驱动消费，买最新最好的。',
    zheng: '消费要服务于你的人生目标。',
    sun: '为团队和未来消费。',
  };
  return principles[profile.id] || '消费是一种选择。';
}

function extractShoppingQuote(profile) {
  const quotes = {
    buffett: '和他一样，你不是在购物，是在做选择。',
    munger: '理性消费，是一种人生智慧。',
    sorros: '每一次消费，都是对世界的一次下注。',
    simons: '让数据告诉你，什么值得买。',
    dalio: '建立你的消费原则，然后坚守它。',
    druckenmiller: '该出手时就出手，不该花的一分不花。',
    lynch: '从日常生活中发现消费的价值。',
    templeton: '最好的消费时机，是别人都不买的时候。',
    kaufman: '把钱花在能让你变得更好的东西上。',
    liu: '消费的本质，是为了更专注地做重要的事。',
    lei: '感动人心，价格厚道。',
    huang: '和他一样，你消费的不是商品，是价值观。',
    zhang: 'all in 你真正想要的生活。',
    wang: '一次买对，胜过十次妥协。',
    xu: '消费是你生活方式的投影。',
    zhou: '更好的体验，造就更好的你。',
    wu: '技术改变消费，消费改变生活。',
    zheng: '每一分钱，都要花在你的人生目标上。',
    sun: '为你的团队和未来投资。',
  };
  return quotes[profile.id] || '你的消费方式，定义了你的人生。';
}

// ============= 消费风格报告生成 =============

/**
 * 根据用户输入生成消费风格报告
 * @param {object} input - 用户消费输入
 * @param {string} input.recentPurchase - 最近买的最贵的东西
 * @param {number} input.dailyAppOpens - 每天打开购物软件次数
 * @param {'quality'|'price'|'brand'|'appearance'} input.preference - 购物更看重什么
 * @param {'never'|'sometimes'|'often'} input.waitForDiscount - 会为了等降价而等待
 * @returns {object} 消费风格报告
 */
export function generateConsumptionReport(input) {
  logger.session('═══════════════════════════════════════');
  logger.session('[消费引擎][生成报告] 开始', input);

  if (!input) {
    logger.error('[消费引擎][生成报告] ❌ 输入为空');
    return null;
  }

  // Step 1: 计算各维度得分
  logger.session('[消费引擎][步骤1/4] 计算消费维度得分...');
  const scores = calculateConsumptionScores(input);
  logger.session('[消费引擎][步骤1/4] ✅ 得分计算完成', scores);

  // Step 2: 确定消费决策类型
  logger.session('[消费引擎][步骤2/4] 判定消费决策类型...');
  const type = determineConsumptionType(scores);
  const typeLabels = { rational: '理性型', impulsive: '冲动型', balanced: '平衡型', avoidant: '回避型' };
  logger.session(`[消费引擎][步骤2/4] ✅ 类型判定: ${typeLabels[type] || type} (${type})`);

  // Step 3: 匹配最接近的投资人/创业家
  logger.session('[消费引擎][步骤3/4] 匹配基准库人物...');
  const matches = matchProfilesByConsumption(scores, input);
  logger.session('[消费引擎][步骤3/4] ✅ 人物匹配完成', {
    investor: matches.investor?.name,
    investorSimilarity: matches.investorSimilarity,
    entrepreneur: matches.entrepreneur?.name,
    entrepreneurSimilarity: matches.entrepreneurSimilarity,
  });

  // Step 4: 生成自然语言描述
  logger.session('[消费引擎][步骤4/4] 生成自然语言描述...');
  const description = generateDescription(type, scores, matches);
  logger.session(`[消费引擎][步骤4/4] ✅ 描述生成: ${description.slice(0, 50)}...`);

  const report = {
    ...scores,
    type,
    typeLabel: typeLabels[type] || type,
    matchedInvestor: matches.investor,
    matchedEntrepreneur: matches.entrepreneur,
    investorSimilarity: matches.investorSimilarity,
    entrepreneurSimilarity: matches.entrepreneurSimilarity,
    description,
    generatedAt: Date.now(),
  };

  logger.session('[消费引擎][生成报告] ✅ 完成', {
    type: report.typeLabel,
    matchedInvestor: report.matchedInvestor?.name,
    investorSimilarity: `${report.investorSimilarity}%`,
  });
  logger.session('═══════════════════════════════════════');

  return report;
}

function calculateConsumptionScores(input) {
  const { dailyAppOpens = 3, preference = 'quality', waitForDiscount = 'sometimes' } = input;

  // 延迟满足能力（0-100）
  const waitMapping = { never: 30, sometimes: 60, often: 85 };
  const waitScore = waitMapping[waitForDiscount] || 50;
  logger.session('[消费引擎][得分计算] 延迟满足', {
    input: waitForDiscount,
    mapping: waitMapping,
    result: waitScore,
  });

  // 冲动购买倾向（0-100）
  const impulseScore = Math.min(100, Math.max(0, dailyAppOpens * 12 + 20));
  logger.session('[消费引擎][得分计算] 冲动倾向', {
    input: dailyAppOpens,
    formula: `min(100, max(0, ${dailyAppOpens} * 12 + 20))`,
    result: impulseScore,
  });

  // 价格敏感度（0-100）
  const priceMapping = { price: 90, quality: 55, brand: 30, appearance: 40 };
  const priceScore = priceMapping[preference] || 50;
  logger.session('[消费引擎][得分计算] 价格敏感', {
    input: preference,
    mapping: priceMapping,
    result: priceScore,
  });

  const result = {
    delayGratification: waitScore,
    impulseTendency: impulseScore,
    priceSensitivity: priceScore,
    preference,
  };

  logger.session('[消费引擎][得分计算] 汇总结果', result);

  return result;
}

function determineConsumptionType(scores) {
  const { delayGratification, impulseTendency, priceSensitivity } = scores;
  const conditions = [
    {
      type: 'rational',
      label: '理性型',
      check: delayGratification >= 70 && impulseTendency <= 40,
      reason: `延迟满足${delayGratification}≥70 且 冲动倾向${impulseTendency}≤40`,
    },
    {
      type: 'impulsive',
      label: '冲动型',
      check: delayGratification <= 40 && impulseTendency >= 70,
      reason: `延迟满足${delayGratification}≤40 且 冲动倾向${impulseTendency}≥70`,
    },
    {
      type: 'avoidant',
      label: '回避型',
      check: priceSensitivity <= 30 && impulseTendency <= 40,
      reason: `价格敏感${priceSensitivity}≤30 且 冲动倾向${impulseTendency}≤40`,
    },
    {
      type: 'balanced',
      label: '平衡型',
      check: true,
      reason: '不满足其他类型条件，默认平衡型',
    },
  ];

  for (const c of conditions) {
    logger.session(`[消费引擎][类型判定] ${c.label}`, {
      condition: c.reason,
      result: c.check ? '✅ 命中' : '❌ 未命中',
    });
    if (c.check) {
      logger.session('[消费引擎][类型判定] 最终结果', {
        type: c.type,
        label: c.label,
        matchedCondition: c.reason,
      });
      return c.type;
    }
  }

  return 'balanced';
}

function matchProfilesByConsumption(scores, input) {
  const { delayGratification, impulseTendency, priceSensitivity, preference } = scores;

  let bestInvestor = null;
  let bestInvestorScore = -Infinity;
  let bestEntrepreneur = null;
  let bestEntrepreneurScore = -Infinity;

  logger.session('[消费引擎][人物匹配] 开始遍历基准库', {
    totalProfiles: ALL_PROFILES.length,
    scores: { delayGratification, impulseTendency, priceSensitivity, preference },
  });

  for (let i = 0; i < ALL_PROFILES.length; i++) {
    const profile = ALL_PROFILES[i];
    const cons = profile.consumption || {};

    // 风格匹配度
    let styleMatch = 50;
    const styleReasons = [];
    if (cons.style === '极简' && delayGratification >= 70 && impulseTendency <= 40) {
      styleMatch = 90; styleReasons.push('极简风格匹配');
    }
    if (cons.style === '实用' && preference === 'quality') {
      styleMatch = 85; styleReasons.push('实用风格匹配');
    }
    if (cons.style === '品质' && priceSensitivity <= 40) {
      styleMatch = 85; styleReasons.push('品质风格匹配');
    }
    if (cons.style === '体验' && preference === 'appearance') {
      styleMatch = 80; styleReasons.push('体验风格匹配');
    }
    if (cons.style === '价值' && priceSensitivity >= 70) {
      styleMatch = 85; styleReasons.push('价值风格匹配');
    }

    // 频率匹配
    let freqMatch = 50;
    const freqReasons = [];
    if (cons.frequency === '低频' && impulseTendency <= 50) {
      freqMatch = 85; freqReasons.push('低频匹配');
    }
    if (cons.frequency === '高频' && impulseTendency >= 60) {
      freqMatch = 75; freqReasons.push('高频匹配');
    }

    const totalScore = styleMatch * 0.7 + freqMatch * 0.3;

    logger.session(`[消费引擎][人物匹配][${i + 1}/${ALL_PROFILES.length}] ${profile.name}`, {
      type: profile.type,
      style: cons.style,
      frequency: cons.frequency,
      styleMatch,
      styleReasons,
      freqMatch,
      freqReasons,
      totalScore: Math.round(totalScore),
    });

    if (profile.type === 'investor' && totalScore > bestInvestorScore) {
      bestInvestorScore = totalScore;
      bestInvestor = profile;
      logger.session(`[消费引擎][人物匹配] 🏆 新最佳投资人: ${profile.name} (${Math.round(totalScore)}分)`);
    }
    if (profile.type === 'entrepreneur' && totalScore > bestEntrepreneurScore) {
      bestEntrepreneurScore = totalScore;
      bestEntrepreneur = profile;
      logger.session(`[消费引擎][人物匹配] 🏆 新最佳创业家: ${profile.name} (${Math.round(totalScore)}分)`);
    }
  }

  const result = {
    investor: bestInvestor,
    entrepreneur: bestEntrepreneur,
    investorSimilarity: Math.round(bestInvestorScore),
    entrepreneurSimilarity: Math.round(bestEntrepreneurScore),
  };

  logger.session('[消费引擎][人物匹配] 最终结果', {
    bestInvestor: bestInvestor?.name,
    investorScore: Math.round(bestInvestorScore),
    bestEntrepreneur: bestEntrepreneur?.name,
    entrepreneurScore: Math.round(bestEntrepreneurScore),
  });

  return result;
}

function generateDescription(type, scores, matches) {
  const typeDesc = {
    rational: '你是一个理性的消费者，在购物前会仔细思考，不轻易被营销打动。',
    impulsive: '你容易被情绪和新鲜感驱动，购物时常常凭直觉做决定。',
    balanced: '你在理性和冲动之间保持平衡，既会享受购物也会控制预算。',
    avoidant: '你对消费持克制态度，更愿意把钱花在真正重要的事情上。',
  }[type] || '';

  const invName = matches.investor?.name || '未知';
  const sim = matches.investorSimilarity;

  return `${typeDesc} 你的消费风格与 ${invName} 最为接近（相似度 ${sim}%）。`;
}

// ============= 工具函数 =============

export const shoppingEngine = {
  getConsumptionProfile,
  generateConsumptionReport,
  CONSUMPTION_STYLES,
  PREFERENCE_LABELS,
  WAIT_LABELS,
};

export default shoppingEngine;
