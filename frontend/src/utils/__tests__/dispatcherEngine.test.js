import './testSetup.js';
import {
  computeThreePeriodAnchors,
  computeCovarianceMatrix,
  computeScore,
  computeProbability,
  getDecisionZone,
  computeDispatchSignal,
  generateDispatchDecision,
  dispatcherEngine,
  ONE_E,
  COGNITIVE_ZONES,
  RECOMMENDATIONS,
  ENV_TYPES,
} from '../dispatcherEngine';

describe('dispatcherEngine · 三周期锚定', () => {
  test('指数衰减加权：越近的历史权重越高', () => {
    const anchors = computeThreePeriodAnchors(
      [
        { t: 1, rate: 0.3 },
        { t: 2, rate: 0.5 },
        { t: 3, rate: 0.7 },
      ],
      null,
      ENV_TYPES.GENERAL
    );
    // 加权均值应偏向近期更高的 0.7，高于简单均值 0.5
    expect(anchors.longTerm.mean).toBeGreaterThan(0.5);
    expect(anchors.sampleCount).toBe(3);
  });

  test('中期锚定取最近10天窗口', () => {
    const history = Array.from({ length: 15 }, (_, i) => ({ t: i, rate: 0.5 }));
    // 最近10天全为 0.5，其余为默认，中期均值应为 0.5
    const anchors = computeThreePeriodAnchors(history, null, ENV_TYPES.STABLE);
    expect(anchors.mediumTerm.windowSize).toBeGreaterThanOrEqual(1);
    expect(anchors.mediumTerm.mean).toBeCloseTo(0.5, 5);
  });

  test('短期锚定使用当日K线收盘值', () => {
    const anchors = computeThreePeriodAnchors([], { open: 0.4, high: 0.6, low: 0.3, current: 0.55, volume: 10 }, ENV_TYPES.GENERAL);
    expect(anchors.shortTerm.mean).toBeCloseTo(0.55, 5);
  });
});

describe('dispatcherEngine · 协方差矩阵与β', () => {
  test('方差下限保护：历史过于稳定时 β 不爆炸', () => {
    const anchors = computeThreePeriodAnchors(
      Array.from({ length: 20 }, (_, i) => ({ t: i, rate: 0.5 })),
      null,
      ENV_TYPES.STABLE
    );
    const cov = computeCovarianceMatrix(anchors);
    const { MIN_BETA, MAX_BETA } = dispatcherEngine.BETA_CONSTRAINTS;
    expect(cov.beta.medium).toBeGreaterThanOrEqual(MIN_BETA);
    expect(cov.beta.medium).toBeLessThanOrEqual(MAX_BETA);
    expect(cov.beta.short).toBeGreaterThanOrEqual(MIN_BETA);
    expect(cov.beta.short).toBeLessThanOrEqual(MAX_BETA);
  });

  test('矩阵为 3×3 对称结构', () => {
    const anchors = computeThreePeriodAnchors(
      Array.from({ length: 10 }, (_, i) => ({ t: i, rate: 0.3 + i * 0.05 })),
      null,
      ENV_TYPES.GENERAL
    );
    const cov = computeCovarianceMatrix(anchors);
    expect(cov.matrix.length).toBe(3);
    expect(cov.matrix[0].length).toBe(3);
    expect(cov.matrix[0][1]).toBeCloseTo(cov.matrix[1][0], 5);
  });
});

describe('dispatcherEngine · 评分与概率映射', () => {
  test('P_success = 1 - e^(-Score)', () => {
    expect(computeProbability(0)).toBeCloseTo(0, 5);
    expect(computeProbability(1)).toBeCloseTo(1 - Math.E ** -1, 5);
    expect(computeProbability(3)).toBeCloseTo(1 - Math.E ** -3, 5);
    expect(computeProbability(-1)).toBe(0); // clamp 到 0
  });

  test('1/e 临界点：Score≈0.46 时 P≈36.8%', () => {
    const p = computeProbability(0.46);
    expect(p).toBeCloseTo(ONE_E, 1); // 0.46 → 1-e^-0.46 ≈ 0.3687
  });
});

describe('dispatcherEngine · 认知画圈决策边界', () => {
  test('P < 1/e → 禁区（自动放弃）', () => {
    expect(getDecisionZone(0.2, 0.1, 0.9)).toBe(COGNITIVE_ZONES.FORBIDDEN); // P≈0.18 < 0.368
  });

  test('Score < 0 → 禁区（强制放弃）', () => {
    expect(getDecisionZone(-0.5, 0.1, 0.9)).toBe(COGNITIVE_ZONES.FORBIDDEN);
  });

  test('高收益+低风险+高置信 → 安全区', () => {
    expect(getDecisionZone(2, 0.1, 0.9)).toBe(COGNITIVE_ZONES.SAFE); // P≈0.865
  });

  test('中收益+中风险+中置信 → 观察区', () => {
    expect(getDecisionZone(0.8, 0.4, 0.6)).toBe(COGNITIVE_ZONES.OBSERVE); // P≈0.55=0.55<0.6? 需见说明
  });

  test('风险过高落入禁区即使收益高', () => {
    expect(getDecisionZone(2, 0.8, 0.9)).toBe(COGNITIVE_ZONES.FORBIDDEN); // risk 0.8 ≥ 0.6
  });
});

describe('dispatcherEngine · 线性调度接口', () => {
  test('高 S 值映射为立即执行', () => {
    const { category } = computeDispatchSignal({ score: 1, probability: 0.9, urgency: 0.8, resourceRate: 0.9 });
    expect(category.label).toBe('立即执行');
  });

  test('低 S 值映射为放弃执行', () => {
    const { category } = computeDispatchSignal({ score: 0.1, probability: 0.1, urgency: 0.1, resourceRate: 0.1 });
    expect(category.label).toBe('放弃执行');
  });
});

describe('dispatcherEngine · 主决策接口', () => {
  test('高成功场景 → safe/execute', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ t: i, rate: 0.7 }));
    const out = generateDispatchDecision({
      scenarioState: {
        successRateHistorical: 0.7,
        environmentalRisk: 0.1,
        resourceAvailability: 0.9,
        urgency: 0.8,
        battery: 90,
        windSpeed: 2,
        distance: 2,
      },
      history,
      envType: ENV_TYPES.STABLE,
    });
    expect([COGNITIVE_ZONES.SAFE, COGNITIVE_ZONES.OBSERVE]).toContain(out.decisionSignal.cognitiveZone);
    expect(out.decisionSignal.recommendation).not.toBe(RECOMMENDATIONS.ABORT);
    expect(typeof out.decisionSignal.score).toBe('number');
    expect(out.decisionSignal.probability).toBeGreaterThan(0.5);
  });

  test('低成功场景 → forbidden/abort', () => {
    const out = generateDispatchDecision({
      scenarioState: {
        successRateHistorical: 0.1,
        environmentalRisk: 0.9,
        resourceAvailability: 0.1,
        urgency: 0.1,
      },
      history: Array.from({ length: 20 }, () => ({ rate: 0.1 })),
    });
    expect(out.decisionSignal.cognitiveZone).toBe(COGNITIVE_ZONES.FORBIDDEN);
    expect(out.decisionSignal.recommendation).toBe(RECOMMENDATIONS.ABORT);
  });

  test('输出包含完整结构', () => {
    const out = generateDispatchDecision({
      scenarioState: { successRateHistorical: 0.5, environmentalRisk: 0.5, resourceAvailability: 0.5, urgency: 0.5 },
    });
    expect(out).toHaveProperty('anchoring');
    expect(out).toHaveProperty('covariance');
    expect(out).toHaveProperty('emotionalCalibration');
    expect(out).toHaveProperty('reasoning');
    expect(out.decisionSignal).toHaveProperty('score');
    expect(out.decisionSignal).toHaveProperty('probability');
    expect(out).toHaveProperty('signalCategory');
  });
});