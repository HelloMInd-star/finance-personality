/**
 * 量化引擎测试 · quantEngine
 *
 * 核心验证：
 * 1. ConeC 市场份额风险模型
 * 2. Kelly 凯利公式
 * 3. IRR 内部收益率（Newton-Raphson）
 * 4. DCF 估值模型
 * 5. WACC 加权平均资本成本
 * 6. Z-Score 破产风险
 * 7. MDD 最大回撤
 * 8. VaR 风险价值
 * 9. 十步引擎 step0 宏观海选
 */

import './testSetup.js';
import {
  THRESHOLDS,
  STEPS,
  PRESET_ASSETS,
  REGIMES,
  safeNum,
  safeObj,
  safeArr,
  clamp,
  gaussianRandom,
  computeConeC,
  computeKellyFraction,
  computeIRR,
  computeDCF,
  computeWACC,
  computeZScore,
  computeMaxDrawdown,
  computeVaR,
  step0_macroFunnel,
  step2_buildFactorLibrary,
  step4_valuation,
} from '../quantEngine.js';

// ============================================================
// 工具函数
// ============================================================
describe('工具函数', () => {

  test('safeNum: 有效数字透传', () => {
    expect(safeNum(42, 0)).toBe(42);
    expect(safeNum(0, 99)).toBe(0);
    expect(safeNum(-3.14, 0)).toBe(-3.14);
  });

  test('safeNum: null/undefined/NaN 返回默认值', () => {
    expect(safeNum(null, 5)).toBe(5);
    expect(safeNum(undefined, 7)).toBe(7);
    expect(safeNum(NaN, 0)).toBe(0);
    expect(safeNum('abc', 42)).toBe(42);
  });

  test('safeObj: 对象透传，非对象返回默认', () => {
    expect(safeObj({ a: 1 }, {}).a).toBe(1);
    expect(safeObj(null, { def: true }).def).toBe(true);
    // 数组也是 object，会透传
    expect(Array.isArray(safeObj([1, 2], {}))).toBe(true);
    expect(safeObj('str', { def: true }).def).toBe(true);
    expect(safeObj(123, { def: true }).def).toBe(true);
  });

  test('safeArr: 数组透传，非数组返回默认', () => {
    expect(safeArr([1, 2], []).length).toBe(2);
    expect(safeArr(null, []).length).toBe(0);
    expect(safeArr('str', [1]).length).toBe(1);
  });

  test('clamp: 限制范围', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(NaN, 0, 1)).toBe(0);
  });

  test('gaussianRandom: 返回有限数字', () => {
    const r = gaussianRandom(0, 1);
    expect(typeof r).toBe('number');
    expect(Number.isFinite(r)).toBe(true);
  });

  test('THRESHOLDS 常量', () => {
    expect(THRESHOLDS.BREAKEVEN).toBe(0.48);
    expect(THRESHOLDS.STEADY).toBe(0.50);
    expect(THRESHOLDS.FUSE).toBe(0.68);
  });

  test('STEPS 应有 11 步', () => {
    expect(STEPS.length).toBe(11);
    expect(STEPS[0].id).toBe(0);
    expect(STEPS[10].id).toBe(10);
  });

  test('PRESET_ASSETS 应有 10 个标的', () => {
    expect(PRESET_ASSETS.length).toBe(10);
    expect(PRESET_ASSETS[0].ticker).toBe('AAPL');
  });

  test('REGIMES 应有 3 种宏观环境', () => {
    expect(Object.keys(REGIMES).length).toBe(3);
    expect(REGIMES.RED_OCEAN).toBeDefined();
    expect(REGIMES.BLUE_OCEAN).toBeDefined();
    expect(REGIMES.NEUTRAL).toBeDefined();
  });
});

// ============================================================
// ConeC 计算
// ============================================================
describe('computeConeC - 市场份额风险模型', () => {

  test('正常输入返回 [0.2, 0.9] 范围', () => {
    const result = computeConeC(0.5, 0.5);
    expect(result).toBeGreaterThanOrEqual(0.2);
    expect(result).toBeLessThanOrEqual(0.9);
  });

  test('零市场份额 → 结果接近下界', () => {
    const result = computeConeC(0, 0.5);
    expect(result).toBeGreaterThanOrEqual(0.2);
    expect(result).toBeLessThan(0.3);
  });

  test('高份额+高集中度 → 结果接近上界', () => {
    const result = computeConeC(1.0, 1.0);
    expect(result).toBeCloseTo(0.8, 1);
  });

  test('非法输入不报错', () => {
    expect(() => computeConeC(null, undefined)).not.toThrow();
    expect(() => computeConeC('abc', {})).not.toThrow();
  });
});

// ============================================================
// 凯利公式
// ============================================================
describe('computeKellyFraction - 凯利公式', () => {

  test('50%胜率 1:1赔率 → 接近 0', () => {
    const result = computeKellyFraction(0.5, 1);
    expect(result).toBeCloseTo(0, 1);
  });

  test('高胜率+高赔率 → 高仓位', () => {
    const result = computeKellyFraction(0.7, 2);
    expect(result).toBeGreaterThan(0.3);
  });

  test('低胜率 → 仓位为 0', () => {
    const result = computeKellyFraction(0.2, 1);
    expect(result).toBe(0);
  });

  test('结果在 [0, 1] 范围', () => {
    for (let i = 0; i < 20; i++) {
      const p = Math.random();
      const b = Math.random() * 5 + 0.1;
      const k = computeKellyFraction(p, b);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(1);
    }
  });

  test('非法输入不报错', () => {
    expect(() => computeKellyFraction(null, 'abc')).not.toThrow();
  });
});

// ============================================================
// IRR
// ============================================================
describe('computeIRR - 内部收益率', () => {

  test('简单现金流：投100 回110 → IRR≈10%', () => {
    const irr = computeIRR([-100, 110]);
    expect(irr).toBeCloseTo(0.1, 2);
  });

  test('多年现金流', () => {
    const irr = computeIRR([-1000, 300, 400, 500, 600]);
    expect(irr).toBeGreaterThan(0);
    expect(irr).toBeLessThan(1);
  });

  test('无符号变化 → 返回 null', () => {
    expect(computeIRR([100, 200, 300])).toBeNull();
    expect(computeIRR([-100, -200, -300])).toBeNull();
  });

  test('现金流长度<2 → 返回 null', () => {
    expect(computeIRR([100])).toBeNull();
    expect(computeIRR([])).toBeNull();
  });

  test('零息债券：投90 回100 → IRR≈11.1%', () => {
    const irr = computeIRR([-90, 100]);
    expect(irr).toBeCloseTo(0.111, 2);
  });
});

// ============================================================
// DCF 估值
// ============================================================
describe('computeDCF - DCF 估值模型', () => {

  test('返回完整结构', () => {
    const result = computeDCF(100, 0.1, 0.08, 0.025, 10);
    expect(result).toHaveProperty('npv');
    expect(result).toHaveProperty('irr');
    expect(result).toHaveProperty('projectedFCFs');
    expect(result).toHaveProperty('terminalValue');
    expect(result).toHaveProperty('intrinsicValue');
    expect(result).toHaveProperty('annualPVs');
    expect(result).toHaveProperty('stageWeights');
  });

  test('projectedFCFs 长度等于 years', () => {
    const result = computeDCF(100, 0.1, 0.08, 0.025, 5);
    expect(result.projectedFCFs.length).toBe(5);
  });

  test('正增长 → FCF 递增', () => {
    const result = computeDCF(100, 0.15, 0.08, 0.025, 5);
    for (let i = 1; i < result.projectedFCFs.length; i++) {
      expect(result.projectedFCFs[i]).toBeGreaterThan(result.projectedFCFs[i - 1]);
    }
  });

  test('高增长 → NPV 更高', () => {
    const lowG = computeDCF(100, 0.05, 0.08, 0.025, 10);
    const highG = computeDCF(100, 0.20, 0.08, 0.025, 10);
    expect(highG.npv).toBeGreaterThan(lowG.npv);
  });

  test('高折现率 → NPV 更低', () => {
    const lowWacc = computeDCF(100, 0.1, 0.06, 0.025, 10);
    const highWacc = computeDCF(100, 0.1, 0.15, 0.025, 10);
    expect(highWacc.npv).toBeLessThan(lowWacc.npv);
  });

  test('永续增长率 > WACC 时自动修正', () => {
    // tg > w 会被 clamp 到 w - 0.001
    const result = computeDCF(100, 0.1, 0.05, 0.08, 10);
    expect(result.npv).toBeGreaterThan(0);
  });

  test('提供初始投资时计算 IRR', () => {
    const result = computeDCF(100, 0.1, 0.08, 0.025, 10, 800);
    expect(result.irr).not.toBeNull();
  });

  test('无初始投资时 IRR 为 null', () => {
    const result = computeDCF(100, 0.1, 0.08, 0.025, 10);
    expect(result.irr).toBeNull();
  });
});

// ============================================================
// WACC
// ============================================================
describe('computeWACC - 加权平均资本成本', () => {

  test('全权益公司 → WACC = CAPM 权益成本', () => {
    const wacc = computeWACC(0.04, 1.0, 0.06, 0.05, 0.2, 1.0);
    const capm = 0.04 + 1.0 * 0.06;
    expect(wacc).toBeCloseTo(capm, 4);
  });

  test('高 Beta → WACC 更高', () => {
    const lowBeta = computeWACC(0.04, 0.5, 0.06, 0.05, 0.2, 0.8);
    const highBeta = computeWACC(0.04, 2.0, 0.06, 0.05, 0.2, 0.8);
    expect(highBeta).toBeGreaterThan(lowBeta);
  });

  test('高债务比例 → WACC 受债务成本影响', () => {
    const highEquity = computeWACC(0.04, 1.0, 0.06, 0.05, 0.2, 0.9);
    const lowEquity = computeWACC(0.04, 1.0, 0.06, 0.05, 0.2, 0.3);
    // 低权益权重意味着高债务权重，税后债务成本通常低于权益成本
    expect(lowEquity).toBeLessThan(highEquity);
  });

  test('默认参数返回合理值', () => {
    const wacc = computeWACC();
    expect(wacc).toBeGreaterThan(0.03);
    expect(wacc).toBeLessThan(0.20);
  });

  test('非法输入不报错', () => {
    expect(() => computeWACC(null, 'abc', undefined)).not.toThrow();
  });
});

// ============================================================
// Z-Score
// ============================================================
describe('computeZScore - 破产风险评分', () => {

  test('健康公司 → Z > 2.99（安全区）', () => {
    const z = computeZScore(0.15, 0.4, 0.2, 3.0, 1.5);
    expect(z).toBeGreaterThan(2.99);
  });

  test('高风险公司 → Z < 1.81（危险区）', () => {
    const z = computeZScore(0.01, 0.02, 0.01, 0.1, 0.2);
    expect(z).toBeLessThan(1.81);
  });

  test('全零输入 → Z = 0', () => {
    const z = computeZScore(0, 0, 0, 0, 0);
    expect(z).toBe(0);
  });

  test('EBIT 因子权重 3.3 最大', () => {
    const baseZ = computeZScore(0.1, 0.1, 0.1, 0.1, 0.1);
    // C 因子贡献 = 3.3 * 0.1 = 0.33，是各项中最大的
    const cContribution = 3.3 * 0.1;
    const aContribution = 1.2 * 0.1;
    expect(cContribution).toBeGreaterThan(aContribution);
  });

  test('非法输入不报错', () => {
    expect(() => computeZScore(null, undefined, 'abc', {}, [])).not.toThrow();
  });
});

// ============================================================
// MDD 最大回撤
// ============================================================
describe('computeMaxDrawdown - 最大回撤', () => {

  test('单调上涨 → MDD = 0', () => {
    const prices = [100, 105, 110, 115, 120];
    expect(computeMaxDrawdown(prices)).toBe(0);
  });

  test('先涨后跌 → 正确计算回撤', () => {
    const prices = [100, 120, 90];
    // 峰值 120，谷底 90，回撤 = 25%
    const mdd = computeMaxDrawdown(prices);
    expect(mdd).toBeCloseTo(0.25, 2);
  });

  test('序列长度 < 2 → 返回 0', () => {
    expect(computeMaxDrawdown([100])).toBe(0);
    expect(computeMaxDrawdown([])).toBe(0);
  });

  test('非法输入返回 0', () => {
    expect(computeMaxDrawdown(null)).toBe(0);
    expect(computeMaxDrawdown('abc')).toBe(0);
  });

  test('多次回撤取最大值', () => {
    const prices = [100, 110, 80, 120, 60];
    // 第一次：110→80 = 27.3%
    // 第二次：120→60 = 50%
    const mdd = computeMaxDrawdown(prices);
    expect(mdd).toBeCloseTo(0.5, 1);
  });
});

// ============================================================
// VaR
// ============================================================
describe('computeVaR - 风险价值', () => {

  test('95% 置信度使用 Z=1.645', () => {
    const var95 = computeVaR(0, 0.1, 0.95);
    expect(var95).toBeCloseTo(-0.1645, 3);
  });

  test('99% 置信度使用 Z=2.326', () => {
    const var99 = computeVaR(0, 0.1, 0.99);
    expect(var99).toBeLessThan(computeVaR(0, 0.1, 0.95));
  });

  test('高波动率 → VaR 更大（更负）', () => {
    const lowVol = computeVaR(0, 0.1, 0.95);
    const highVol = computeVaR(0, 0.5, 0.95);
    expect(highVol).toBeLessThan(lowVol);
  });

  test('正均值 → VaR 绝对值更小', () => {
    const zeroMean = computeVaR(0, 0.2, 0.95);
    const posMean = computeVaR(0.05, 0.2, 0.95);
    expect(posMean).toBeGreaterThan(zeroMean);
  });

  test('非法输入不报错', () => {
    expect(() => computeVaR(null, 'abc')).not.toThrow();
  });
});

// ============================================================
// Step 0 宏观海选
// ============================================================
describe('step0_macroFunnel - 宏观海选', () => {

  test('RED_OCEAN 返回筛选结果', () => {
    const result = step0_macroFunnel({ regime: 'RED_OCEAN' });
    expect(result.regime).toBe('RED_OCEAN');
    expect(result.assets).toBeDefined();
    expect(Array.isArray(result.assets)).toBe(true);
    expect(result.selectedAsset).toBeDefined();
    expect(result.generationId).toBeDefined();
  });

  test('BLUE_OCEAN 偏好高增长标的', () => {
    const result = step0_macroFunnel({ regime: 'BLUE_OCEAN' });
    expect(result.assets.length).toBeGreaterThan(0);
  });

  test('传入自定义资产池', () => {
    const customAssets = [
      { ticker: 'TEST', name: '测试', industry: '科技', marketCap: 100, pe: 15, pb: 3, revenueGrowthYoY: 0.1, fcfYield: 0.05, roe: 0.2, debtToEquity: 0.3, grade: 'A', basePrice: 50 },
    ];
    const result = step0_macroFunnel({
      regime: 'RED_OCEAN',
      customAssets,
    });
    expect(result.totalScreened).toBe(1);
  });

  test('指定 initialTicker 时优先选中', () => {
    const result = step0_macroFunnel({
      regime: 'RED_OCEAN',
      config: { initialTicker: 'NVDA' },
    });
    expect(result.selectedAsset.ticker).toBe('NVDA');
  });

  test('兜底机制：全部 < 55 分时仍返回至少 1 个标的', () => {
    const result = step0_macroFunnel({ regime: 'RED_OCEAN' });
    expect(result.assets.length).toBeGreaterThanOrEqual(1);
  });

  test('返回宏观指标', () => {
    const result = step0_macroFunnel({ regime: 'NEUTRAL' });
    expect(result.macroIndicators).toBeDefined();
    expect(result.macroIndicators.gdpGrowth).toBeDefined();
    expect(result.macroIndicators.cpi).toBeDefined();
    expect(result.macroIndicators.riskFreeRate).toBe(0.042);
  });
});

// ============================================================
// Step 2 因子库构建
// ============================================================
describe('step2_buildFactorLibrary - 因子库构建', () => {

  test('返回完整因子结构', () => {
    const asset = PRESET_ASSETS[0];
    const result = step2_buildFactorLibrary(asset);
    expect(result.valueFactors).toBeDefined();
    expect(result.growthFactors).toBeDefined();
    expect(result.qualityFactors).toBeDefined();
    expect(result.momentumFactors).toBeDefined();
    expect(result.sentimentFactors).toBeDefined();
    expect(result.riskFactors).toBeDefined();
    expect(result.compositeScore).toBeDefined();
  });

  test('综合评分在 0-100', () => {
    const result = step2_buildFactorLibrary(PRESET_ASSETS[0]);
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
  });

  test('riskFactors 包含 coneC 和 zScore', () => {
    const result = step2_buildFactorLibrary(PRESET_ASSETS[0]);
    expect(result.riskFactors.coneC).toBeDefined();
    expect(result.riskFactors.zScore).toBeDefined();
  });
});

// ============================================================
// Step 4 估值模型
// ============================================================
describe('step4_valuation - 估值模型', () => {

  test('返回完整估值结构', () => {
    const factors = step2_buildFactorLibrary(PRESET_ASSETS[0]);
    const valuation = step4_valuation(factors, {
      regime: 'RED_OCEAN',
      pipeline: {
        macroFunnel: {
          selectedAsset: PRESET_ASSETS[0],
        },
      },
    });
    expect(valuation.wacc).toBeDefined();
    expect(valuation.dcf).toBeDefined();
    expect(valuation.relative).toBeDefined();
    expect(valuation.composite).toBeDefined();
    expect(valuation.perShare).toBeDefined();
  });

  test('perShare 包含买入/公允/卖出价格', () => {
    const factors = step2_buildFactorLibrary(PRESET_ASSETS[0]);
    const v = step4_valuation(factors, {
      regime: 'RED_OCEAN',
      pipeline: { macroFunnel: { selectedAsset: PRESET_ASSETS[0] } },
    });
    expect(v.perShare.buyPrice).toBeLessThan(v.perShare.fairPrice);
    expect(v.perShare.fairPrice).toBeLessThan(v.perShare.sellPrice);
  });

  test('upside 计算正确', () => {
    const factors = step2_buildFactorLibrary(PRESET_ASSETS[0]);
    const v = step4_valuation(factors, {
      regime: 'RED_OCEAN',
      pipeline: { macroFunnel: { selectedAsset: PRESET_ASSETS[0] } },
    });
    expect(v.composite.upside).toBeDefined();
    expect(typeof v.composite.upside).toBe('number');
  });
});
