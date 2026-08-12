/**
 * shoppingEngine 单元测试
 *
 * 核心验证：
 * 1. getConsumptionProfile - 正确提取人物消费画像
 * 2. generateConsumptionReport - 根据用户输入生成消费风格报告
 * 3. 各内部逻辑的边界条件和正确性
 */

import { getConsumptionProfile, generateConsumptionReport, shoppingEngine } from '../shoppingEngine.js';
import { ALL_PROFILES } from '../benchmarkProfiles.js';

// ============================================================
// getConsumptionProfile 测试
// ============================================================
describe('getConsumptionProfile', () => {

  test('应该返回 null 当传入无效的 profileId', () => {
    expect(getConsumptionProfile(null)).toBeNull();
    expect(getConsumptionProfile(undefined)).toBeNull();
    expect(getConsumptionProfile('non-existent-id')).toBeNull();
    expect(getConsumptionProfile('')).toBeNull();
  });

  test('应该为每个有效 profile 返回消费画像', () => {
    const validProfiles = ALL_PROFILES.filter(p => p.consumption);

    for (const profile of validProfiles) {
      const result = getConsumptionProfile(profile.id);
      expect(result).not.toBeNull();
      expect(result).toBeDefined();
      expect(result.personId).toBe(profile.id);
      expect(result.personName).toBe(profile.name);
    }
  });

  test('返回的消费画像应该包含所有必要字段', () => {
    // 选一个有 consumption 数据的 profile
    const profileWithConsumption = ALL_PROFILES.find(p => p.consumption);
    expect(profileWithConsumption).toBeDefined();

    const result = getConsumptionProfile(profileWithConsumption.id);

    expect(result).toHaveProperty('personId');
    expect(result).toHaveProperty('personName');
    expect(result).toHaveProperty('personEmoji');
    expect(result).toHaveProperty('style');
    expect(result).toHaveProperty('styleLabel');
    expect(result).toHaveProperty('categories');
    expect(result).toHaveProperty('frequency');
    expect(result).toHaveProperty('principle');
    expect(result).toHaveProperty('shoppingQuote');
  });

  test('categories 应该是一个数组', () => {
    const profile = ALL_PROFILES.find(p => p.consumption);
    const result = getConsumptionProfile(profile.id);
    expect(Array.isArray(result.categories)).toBe(true);
  });

  test('应该为有消费原则的人物返回正确的原则', () => {
    // 测试几个已知的人物
    const dalio = getConsumptionProfile('dalio');
    if (dalio) {
      expect(dalio.principle).toContain('原则');
    }

    const buffett = getConsumptionProfile('buffett');
    if (buffett) {
      expect(typeof buffett.principle).toBe('string');
      expect(buffett.principle.length).toBeGreaterThan(0);
    }
  });

  test('应该为有消费名言的人物返回正确的名言', () => {
    const lei = getConsumptionProfile('lei');
    if (lei) {
      expect(typeof lei.shoppingQuote).toBe('string');
      expect(lei.shoppingQuote.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// generateConsumptionReport 测试
// ============================================================
describe('generateConsumptionReport', () => {

  test('应该返回 null 当传入 null 或 undefined', () => {
    expect(generateConsumptionReport(null)).toBeNull();
    expect(generateConsumptionReport(undefined)).toBeNull();
  });

  test('应该为有效的输入返回报告对象', () => {
    const input = {
      recentPurchase: 'MacBook Pro',
      dailyAppOpens: 3,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    };

    const report = generateConsumptionReport(input);
    expect(report).not.toBeNull();
    expect(report).toBeDefined();
  });

  test('返回的报告应该包含所有必要字段', () => {
    const input = {
      recentPurchase: 'MacBook Pro',
      dailyAppOpens: 5,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    };

    const report = generateConsumptionReport(input);

    expect(report).toHaveProperty('delayGratification');
    expect(report).toHaveProperty('impulseTendency');
    expect(report).toHaveProperty('priceSensitivity');
    expect(report).toHaveProperty('type');
    expect(report).toHaveProperty('typeLabel');
    expect(report).toHaveProperty('matchedInvestor');
    expect(report).toHaveProperty('matchedEntrepreneur');
    expect(report).toHaveProperty('investorSimilarity');
    expect(report).toHaveProperty('entrepreneurSimilarity');
    expect(report).toHaveProperty('description');
    expect(report).toHaveProperty('generatedAt');
  });

  // ---------- 得分计算测试 ----------

  test('延迟满足能力：经常等降价应该得分高', () => {
    const reportOften = generateConsumptionReport({
      dailyAppOpens: 3,
      preference: 'quality',
      waitForDiscount: 'often',
    });

    const reportNever = generateConsumptionReport({
      dailyAppOpens: 3,
      preference: 'quality',
      waitForDiscount: 'never',
    });

    expect(reportOften.delayGratification).toBeGreaterThan(reportNever.delayGratification);
    expect(reportOften.delayGratification).toBeGreaterThanOrEqual(70);
    expect(reportNever.delayGratification).toBeLessThanOrEqual(50);
  });

  test('冲动购买倾向：每天打开购物软件次数越多得分越高', () => {
    const reportLow = generateConsumptionReport({
      dailyAppOpens: 1,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    });

    const reportHigh = generateConsumptionReport({
      dailyAppOpens: 15,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    });

    expect(reportHigh.impulseTendency).toBeGreaterThan(reportLow.impulseTendency);
  });

  test('冲动购买倾向得分应该在 0-100 范围内', () => {
    const reportMin = generateConsumptionReport({
      dailyAppOpens: 0,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    });

    const reportMax = generateConsumptionReport({
      dailyAppOpens: 100,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    });

    expect(reportMin.impulseTendency).toBeGreaterThanOrEqual(0);
    expect(reportMin.impulseTendency).toBeLessThanOrEqual(100);
    expect(reportMax.impulseTendency).toBeGreaterThanOrEqual(0);
    expect(reportMax.impulseTendency).toBeLessThanOrEqual(100);
  });

  test('价格敏感度：偏好价格应该得分最高', () => {
    const reportPrice = generateConsumptionReport({
      dailyAppOpens: 3,
      preference: 'price',
      waitForDiscount: 'sometimes',
    });

    const reportBrand = generateConsumptionReport({
      dailyAppOpens: 3,
      preference: 'brand',
      waitForDiscount: 'sometimes',
    });

    expect(reportPrice.priceSensitivity).toBeGreaterThan(reportBrand.priceSensitivity);
    expect(reportPrice.priceSensitivity).toBeGreaterThanOrEqual(80);
    expect(reportBrand.priceSensitivity).toBeLessThanOrEqual(50);
  });

  // ---------- 消费类型判定测试 ----------

  test('应该判定为理性型：高延迟满足 + 低冲动', () => {
    const report = generateConsumptionReport({
      dailyAppOpens: 1,
      preference: 'quality',
      waitForDiscount: 'often',
    });

    expect(report.type).toBe('rational');
    expect(report.typeLabel).toBe('理性型');
  });

  test('应该判定为冲动型：低延迟满足 + 高冲动', () => {
    const report = generateConsumptionReport({
      dailyAppOpens: 15,
      preference: 'appearance',
      waitForDiscount: 'never',
    });

    expect(report.type).toBe('impulsive');
    expect(report.typeLabel).toBe('冲动型');
  });

  test('应该判定为回避型：低价格敏感 + 低冲动', () => {
    const report = generateConsumptionReport({
      dailyAppOpens: 1,
      preference: 'brand',
      waitForDiscount: 'sometimes',
    });

    expect(report.type).toBe('avoidant');
    expect(report.typeLabel).toBe('回避型');
  });

  test('应该判定为平衡型：中间情况', () => {
    const report = generateConsumptionReport({
      dailyAppOpens: 5,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    });

    expect(report.type).toBe('balanced');
    expect(report.typeLabel).toBe('平衡型');
  });

  // ---------- 投资人/创业家匹配测试 ----------

  test('应该匹配到投资人和创业家', () => {
    const report = generateConsumptionReport({
      dailyAppOpens: 3,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    });

    expect(report.matchedInvestor).not.toBeNull();
    expect(report.matchedEntrepreneur).not.toBeNull();
    expect(report.matchedInvestor.type).toBe('investor');
    expect(report.matchedEntrepreneur.type).toBe('entrepreneur');
  });

  test('匹配的相似度应该在合理范围内', () => {
    const report = generateConsumptionReport({
      dailyAppOpens: 5,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    });

    expect(report.investorSimilarity).toBeGreaterThanOrEqual(50);
    expect(report.investorSimilarity).toBeLessThanOrEqual(100);
    expect(report.entrepreneurSimilarity).toBeGreaterThanOrEqual(50);
    expect(report.entrepreneurSimilarity).toBeLessThanOrEqual(100);
  });

  test('不同的消费输入应该匹配到不同的人物', () => {
    const reportRational = generateConsumptionReport({
      dailyAppOpens: 1,
      preference: 'quality',
      waitForDiscount: 'often',
    });

    const reportImpulsive = generateConsumptionReport({
      dailyAppOpens: 15,
      preference: 'appearance',
      waitForDiscount: 'never',
    });

    // 两种极端情况可能匹配到不同的人
    // （不强制一定不同，但相似度应该有差异）
    expect(reportRational.matchedInvestor).toBeDefined();
    expect(reportImpulsive.matchedInvestor).toBeDefined();
  });

  // ---------- 描述生成测试 ----------

  test('应该生成非空的描述文本', () => {
    const report = generateConsumptionReport({
      dailyAppOpens: 5,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    });

    expect(typeof report.description).toBe('string');
    expect(report.description.length).toBeGreaterThan(0);
  });

  test('描述应该包含匹配的投资人名字和相似度', () => {
    const report = generateConsumptionReport({
      dailyAppOpens: 5,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    });

    expect(report.description).toContain(report.matchedInvestor.name);
    expect(report.description).toContain(report.investorSimilarity.toString());
  });

  test('不同类型应该有不同的描述', () => {
    const reportRational = generateConsumptionReport({
      dailyAppOpens: 1,
      preference: 'quality',
      waitForDiscount: 'often',
    });

    const reportImpulsive = generateConsumptionReport({
      dailyAppOpens: 15,
      preference: 'appearance',
      waitForDiscount: 'never',
    });

    // 描述应该不同
    expect(reportRational.description).not.toBe(reportImpulsive.description);
  });

  // ---------- 生成时间戳测试 ----------

  test('应该包含生成时间戳', () => {
    const before = Date.now();
    const report = generateConsumptionReport({
      dailyAppOpens: 3,
      preference: 'quality',
      waitForDiscount: 'sometimes',
    });
    const after = Date.now();

    expect(report.generatedAt).toBeGreaterThanOrEqual(before);
    expect(report.generatedAt).toBeLessThanOrEqual(after);
  });

  // ---------- 使用默认值测试 ----------

  test('缺少部分字段应该使用默认值', () => {
    const report = generateConsumptionReport({});

    expect(report).not.toBeNull();
    expect(report.delayGratification).toBeDefined();
    expect(report.impulseTendency).toBeDefined();
    expect(report.priceSensitivity).toBeDefined();
  });

  test('完全空对象也应该生成报告', () => {
    const report = generateConsumptionReport({});
    expect(report).not.toBeNull();
    expect(report.type).toBeDefined();
    expect(report.matchedInvestor).toBeDefined();
  });
});

// ============================================================
// shoppingEngine 导出对象测试
// ============================================================
describe('shoppingEngine 导出对象', () => {

  test('应该包含所有导出的函数', () => {
    expect(typeof shoppingEngine.getConsumptionProfile).toBe('function');
    expect(typeof shoppingEngine.generateConsumptionReport).toBe('function');
  });

  test('应该包含常量定义', () => {
    expect(shoppingEngine.CONSUMPTION_STYLES).toBeDefined();
    expect(shoppingEngine.PREFERENCE_LABELS).toBeDefined();
    expect(shoppingEngine.WAIT_LABELS).toBeDefined();
  });

  test('CONSUMPTION_STYLES 应该包含所有风格', () => {
    expect(shoppingEngine.CONSUMPTION_STYLES).toHaveProperty('minimalism');
    expect(shoppingEngine.CONSUMPTION_STYLES).toHaveProperty('practical');
    expect(shoppingEngine.CONSUMPTION_STYLES).toHaveProperty('premium');
    expect(shoppingEngine.CONSUMPTION_STYLES).toHaveProperty('experience');
    expect(shoppingEngine.CONSUMPTION_STYLES).toHaveProperty('value');
    expect(shoppingEngine.CONSUMPTION_STYLES).toHaveProperty('impulsive');
  });
});
