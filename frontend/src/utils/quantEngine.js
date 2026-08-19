/**
 * Y.Mine 机构级量化投研十一步闭环引擎 v2.1.0
 *
 * 核心铁律：Step 8 最终仓位必须且只能调用 enforceRiskControl() 进行强制门控
 * 熔断触发时 actual=0，不可绕过
 *
 * 十一步流程：
 *  0. 宏观海选 (Macro Funnel)
 *  1. 信息清洗ETL (Data Ingestion)
 *  2. 因子库构建 (Factor Library)
 *  3. 核心定价准备 (Pricing Preparation)
 *  4. 估值模型 (Valuation Model - DCF/WACC)
 *  5. 沙盘决策推演 (Sandbox Simulation)
 *  6. 动态周期观测 (Dynamic Cycle)
 *  7. 人性偏差校验 (Rationality Check)
 *  8. 熔断风控对冲 (Risk Control Hedge)
 *  9. 执行下单 (Execution Order)
 * 10. 绩效归因 (Performance Attribution)
 *
 * 金融风险向量精算：
 *  - ConeC: 市场份额×行业集中度风险模型
 *  - 凯利公式 (Kelly Criterion): 最优仓位计算
 *  - DCF 估值: 自由现金流折现
 *  - WACC: 加权平均资本成本
 *  - Z-Score: 破产风险评分
 *  - MDD: 最大回撤控制
 *  - VaR: 风险价值
 */

import { logger } from './logger';
import { isFuseActive, checkMaxDrawdown, checkValuationBreach } from './fuse';
import { auditLogStore } from './storageBus';

// ============================================================
// 配置常量
// ============================================================
export const THRESHOLDS = Object.freeze({
  BREAKEVEN: 0.48,
  STEADY: 0.50,
  FUSE: 0.68,
});

// 十一步定义
export const STEPS = [
  { id: 0, name: '宏观海选', icon: '🌊', channel: 'macroFunnel' },
  { id: 1, name: '信息清洗ETL', icon: '🧹', channel: 'ingestion' },
  { id: 2, name: '因子库构建', icon: '⚗️', channel: 'factorLibrary' },
  { id: 3, name: '核心定价准备', icon: '⚖️', channel: 'pricingPrep' },
  { id: 4, name: '估值模型', icon: '📐', channel: 'valuationV2' },
  { id: 5, name: '沙盘决策推演', icon: '🔮', channel: 'sandbox' },
  { id: 6, name: '动态周期观测', icon: '📈', channel: 'simulationResult' },
  { id: 7, name: '人性偏差校验', icon: '🧠', channel: 'rationalityScore' },
  { id: 8, name: '熔断风控对冲', icon: '🛡️', channel: 'riskControl' },
  { id: 9, name: '执行下单', icon: '⚡', channel: 'executionOrder' },
  { id: 10, name: '绩效归因', icon: '🎯', channel: 'attribution' },
];

// 预设资产池
export const PRESET_ASSETS = [
  { ticker: 'AAPL', name: '苹果', industry: '科技', marketCap: 2800, pe: 28, pb: 45, revenueGrowthYoY: 0.08, fcfYield: 0.035, roe: 1.5, debtToEquity: 1.8, grade: 'A', basePrice: 185 },
  { ticker: 'MSFT', name: '微软', industry: '科技', marketCap: 3100, pe: 35, pb: 12, revenueGrowthYoY: 0.15, fcfYield: 0.03, roe: 0.4, debtToEquity: 0.4, grade: 'S', basePrice: 410 },
  { ticker: 'NVDA', name: '英伟达', industry: '半导体', marketCap: 2500, pe: 70, pb: 50, revenueGrowthYoY: 2.6, fcfYield: 0.02, roe: 1.2, debtToEquity: 0.3, grade: 'S', basePrice: 875 },
  { ticker: 'GOOGL', name: '谷歌', industry: '互联网', marketCap: 2000, pe: 25, pb: 6, revenueGrowthYoY: 0.13, fcfYield: 0.04, roe: 0.3, debtToEquity: 0.2, grade: 'A', basePrice: 170 },
  { ticker: 'AMZN', name: '亚马逊', industry: '电商/云', marketCap: 1900, pe: 60, pb: 8, revenueGrowthYoY: 0.12, fcfYield: 0.02, roe: 0.2, debtToEquity: 0.5, grade: 'A', basePrice: 185 },
  { ticker: 'XOM', name: '埃克森美孚', industry: '能源', marketCap: 450, pe: 10, pb: 2, revenueGrowthYoY: -0.05, fcfYield: 0.08, roe: 0.2, debtToEquity: 0.3, grade: 'B', basePrice: 110 },
  { ticker: 'JNJ', name: '强生', industry: '医药', marketCap: 380, pe: 15, pb: 5, revenueGrowthYoY: 0.06, fcfYield: 0.05, roe: 0.25, debtToEquity: 0.4, grade: 'B', basePrice: 155 },
  { ticker: 'JPM', name: '摩根大通', industry: '银行', marketCap: 500, pe: 11, pb: 1.8, revenueGrowthYoY: 0.2, fcfYield: 0, roe: 0.15, debtToEquity: 0, grade: 'B', basePrice: 195 },
  { ticker: 'TSLA', name: '特斯拉', industry: '新能源', marketCap: 600, pe: 50, pb: 12, revenueGrowthYoY: 0.1, fcfYield: 0.01, roe: 0.25, debtToEquity: 0.2, grade: 'A', basePrice: 245 },
  { ticker: 'BRK.B', name: '伯克希尔', industry: '多元金融', marketCap: 900, pe: 9, pb: 1.5, revenueGrowthYoY: 0.05, fcfYield: 0.04, roe: 0.15, debtToEquity: 0.3, grade: 'S', basePrice: 410 },
  // —— 美股补充 ——
  { ticker: 'META', name: 'Meta', industry: '社交/广告', marketCap: 1300, pe: 27, pb: 8, revenueGrowthYoY: 0.2, fcfYield: 0.03, roe: 0.35, debtToEquity: 0.3, grade: 'A', basePrice: 500 },
  { ticker: 'NFLX', name: '奈飞', industry: '流媒体', marketCap: 290, pe: 40, pb: 12, revenueGrowthYoY: 0.15, fcfYield: 0.02, roe: 0.3, debtToEquity: 0.6, grade: 'A', basePrice: 670 },
  { ticker: 'AMD', name: 'AMD', industry: '半导体', marketCap: 240, pe: 45, pb: 4, revenueGrowthYoY: 0.1, fcfYield: 0.015, roe: 0.08, debtToEquity: 0.05, grade: 'B', basePrice: 150 },
  { ticker: 'AVGO', name: '博通', industry: '半导体', marketCap: 750, pe: 35, pb: 10, revenueGrowthYoY: 0.4, fcfYield: 0.04, roe: 0.5, debtToEquity: 1.0, grade: 'A', basePrice: 160 },
  { ticker: 'COST', name: '好市多', industry: '零售', marketCap: 390, pe: 50, pb: 14, revenueGrowthYoY: 0.06, fcfYield: 0.015, roe: 0.3, debtToEquity: 0.4, grade: 'A', basePrice: 880 },
  { ticker: 'KO', name: '可口可乐', industry: '消费', marketCap: 290, pe: 24, pb: 10, revenueGrowthYoY: 0.05, fcfYield: 0.03, roe: 0.4, debtToEquity: 1.5, grade: 'B', basePrice: 66 },
  { ticker: 'DIS', name: '迪士尼', industry: '娱乐', marketCap: 170, pe: 40, pb: 2, revenueGrowthYoY: 0.03, fcfYield: 0.03, roe: 0.05, debtToEquity: 0.5, grade: 'B', basePrice: 95 },
  { ticker: 'V', name: 'Visa', industry: '支付', marketCap: 550, pe: 30, pb: 14, revenueGrowthYoY: 0.1, fcfYield: 0.035, roe: 0.5, debtToEquity: 0.6, grade: 'S', basePrice: 275 },
  // —— 中概 ——
  { ticker: 'BABA', name: '阿里巴巴', industry: '电商/云', marketCap: 230, pe: 20, pb: 2, revenueGrowthYoY: 0.07, fcfYield: 0.06, roe: 0.1, debtToEquity: 0.2, grade: 'A', basePrice: 100 },
  { ticker: 'PDD', name: '拼多多', industry: '电商', marketCap: 190, pe: 12, pb: 4, revenueGrowthYoY: 0.6, fcfYield: 0.05, roe: 0.4, debtToEquity: 0.1, grade: 'A', basePrice: 135 },
  { ticker: 'JD', name: '京东', industry: '电商/物流', marketCap: 60, pe: 11, pb: 1.6, revenueGrowthYoY: 0.06, fcfYield: 0.05, roe: 0.15, debtToEquity: 0.3, grade: 'B', basePrice: 40 },
  { ticker: 'NIO', name: '蔚来', industry: '新能源车', marketCap: 9, pe: 0, pb: 2.5, revenueGrowthYoY: 0.2, fcfYield: -0.2, roe: -1.5, debtToEquity: 3.0, grade: 'C', basePrice: 5 },
  // —— A股 ——
  { ticker: '600519', name: '贵州茅台', industry: '白酒', marketCap: 250, pe: 24, pb: 8, revenueGrowthYoY: 0.15, fcfYield: 0.03, roe: 0.35, debtToEquity: 0.0, grade: 'S', basePrice: 1450 },
  { ticker: '000858', name: '五粮液', industry: '白酒', marketCap: 70, pe: 16, pb: 4, revenueGrowthYoY: 0.08, fcfYield: 0.04, roe: 0.25, debtToEquity: 0.0, grade: 'A', basePrice: 125 },
  { ticker: '601318', name: '中国平安', industry: '保险', marketCap: 140, pe: 9, pb: 1.0, revenueGrowthYoY: 0.05, fcfYield: 0.05, roe: 0.12, debtToEquity: 0.0, grade: 'B', basePrice: 55 },
  { ticker: '600036', name: '招商银行', industry: '银行', marketCap: 130, pe: 7, pb: 1.0, revenueGrowthYoY: 0.02, fcfYield: 0, roe: 0.16, debtToEquity: 0, grade: 'A', basePrice: 40 },
  { ticker: '300750', name: '宁德时代', industry: '电池', marketCap: 160, pe: 22, pb: 4.5, revenueGrowthYoY: 0.1, fcfYield: 0.02, roe: 0.22, debtToEquity: 0.5, grade: 'A', basePrice: 250 },
  { ticker: '002594', name: '比亚迪', industry: '新能源车', marketCap: 110, pe: 20, pb: 4, revenueGrowthYoY: 0.15, fcfYield: 0.01, roe: 0.2, debtToEquity: 0.8, grade: 'A', basePrice: 260 },
  { ticker: '600900', name: '长江电力', industry: '公用事业', marketCap: 100, pe: 20, pb: 3, revenueGrowthYoY: 0.05, fcfYield: 0.04, roe: 0.15, debtToEquity: 1.2, grade: 'B', basePrice: 28 },
  { ticker: '601899', name: '紫金矿业', industry: '有色矿业', marketCap: 70, pe: 15, pb: 3.5, revenueGrowthYoY: 0.12, fcfYield: 0.03, roe: 0.25, debtToEquity: 0.8, grade: 'A', basePrice: 18 },
  { ticker: '000001', name: '平安银行', industry: '银行', marketCap: 35, pe: 5, pb: 0.6, revenueGrowthYoY: -0.05, fcfYield: 0, roe: 0.11, debtToEquity: 0, grade: 'B', basePrice: 11 },
  { ticker: '600030', name: '中信证券', industry: '券商', marketCap: 60, pe: 16, pb: 1.5, revenueGrowthYoY: 0.05, fcfYield: 0, roe: 0.08, debtToEquity: 0, grade: 'B', basePrice: 28 },
];

// 宏观环境
export const REGIMES = {
  RED_OCEAN: { id: 'RED_OCEAN', label: '红海防御', desc: '低增长高波动，注重价值与安全边际', color: '#ef4444' },
  BLUE_OCEAN: { id: 'BLUE_OCEAN', label: '蓝海成长', desc: '高增长低波动，注重成长与弹性', color: '#10b981' },
  NEUTRAL: { id: 'NEUTRAL', label: '中性平衡', desc: '均衡配置，攻守兼备', color: '#f59e0b' },
};

// ============================================================
// 工具函数
// ============================================================
export function generateId() {
  return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

export function safeNum(v, def = 0) {
  return typeof v === 'number' && !isNaN(v) ? v : def;
}

export function safeObj(v, def = {}) {
  return v && typeof v === 'object' ? v : def;
}

export function safeStr(v, def = '') {
  return typeof v === 'string' ? v : def;
}

export function safeArr(v, def = []) {
  return Array.isArray(v) ? v : def;
}

export function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, safeNum(v, 0)));
}

// 高斯随机数 (Box-Muller)
export function gaussianRandom(mean = 0, std = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ============================================================
// 金融风险向量精算核心算法
// ============================================================

/**
 * ConeC 计算 - 市场份额与行业集中度风险模型
 * ConeC = 市场份额 × 行业集中度 / V × 0.8
 * 值域: [0.2, 0.9]
 *
 * @param {number} marketShare - 市场份额 (0-1)
 * @param {number} industryConcentration - 行业集中度 (0.1-1)
 * @returns {number} ConeC 风险值
 */
export function computeConeC(marketShare, industryConcentration) {
  logger.session('[Quant:Risk][ConeC] ▶ 入口', {
    原始输入_marketShare: marketShare,
    原始输入_industryConcentration: industryConcentration,
  });
  const V = 1.0;
  const m = safeNum(marketShare, 0);
  const rho0 = Math.max(0.1, safeNum(industryConcentration, 0.4));
  const rawValue = m * rho0 / V * 0.8;
  const result = clamp(rawValue, 0.2, 0.9);
  const clamped = Math.abs(rawValue - result) > 1e-6;

  logger.session('[Quant:Risk][ConeC] ✓ 完成', {
    归一化后_marketShare_m: m,
    归一化后_industryConcentration_rho0: rho0,
    公式: `${m} × ${rho0} / ${V} × 0.8`,
    中间计算_rawValue: +rawValue.toFixed(6),
    是否被clamp: clamped,
    clamp区间: '[0.2, 0.9]',
    最终输出_ConeC: +result.toFixed(6),
  });
  return result;
}

/**
 * 凯利公式 - 最优仓位计算
 * f* = (p·(b+1) - 1) / b
 *
 * @param {number} p - 获胜概率 (0-1)
 * @param {number} b - 盈亏比 (赔率)
 * @returns {number} 凯利分数 [0, 1]
 */
export function computeKellyFraction(p, b) {
  logger.session('[Quant:Risk][Kelly] ▶ 入口', {
    原始输入_p_winRate: p,
    原始输入_b_odds: b,
  });
  const winP = clamp(safeNum(p, 0.5), 0.01, 0.99);
  const odds = Math.max(0.1, safeNum(b, 1));
  const numerator = winP * (odds + 1) - 1;
  const raw = numerator / odds;
  const result = clamp(raw, 0, 1);
  const edge = winP - (1 - winP) / odds; // 期望优势
  const clamped = Math.abs(raw - result) > 1e-6;

  logger.session('[Quant:Risk][Kelly] ✓ 完成', {
    归一化后_winRate: winP,
    归一化后_odds: odds,
    公式分子: `(${winP} × (${odds}+1) - 1) = ${+numerator.toFixed(6)}`,
    原始结果_rawKelly: +raw.toFixed(6),
    数学期望优势_edge: +edge.toFixed(6),
    是否被clamp: clamped,
    clamp区间: '[0, 1]',
    最终输出_kellyFraction: +result.toFixed(6),
    仓位解读: result < 0.1 ? '空仓/观望' : result < 0.3 ? '轻仓' : result < 0.5 ? '半仓' : result < 0.75 ? '重仓' : '满仓',
  });
  return result;
}

/**
 * IRR (内部收益率) - Newton-Raphson 迭代法
 * 求解 NPV(r) = Σ CF_t / (1+r)^t = 0
 *
 * 算法：
 *   1. 构造 NPV(r) 与导数 dNPV/dr
 *   2. 牛顿迭代：r_{n+1} = r_n - NPV(r_n) / (dNPV/dr)
 *   3. 收敛条件：|r_{n+1} - r_n| < 1e-8 或达到 100 次上限
 *
 * @param {number[]} cashflows - 现金流序列，CF_0 通常为负（初始投资）
 * @param {number} guess - 初始猜测值（默认 0.1）
 * @returns {number|null} IRR，无法求解返回 null
 */
export function computeIRR(cashflows, guess = 0.1) {
  logger.session('[Quant:Risk][IRR] ▶ 入口', {
    原始输入_cashflows: Array.isArray(cashflows) ? cashflows : [],
    现金流长度: Array.isArray(cashflows) ? cashflows.length : 0,
    原始输入_guess: guess,
  });
  const cf = safeArr(cashflows, []);
  if (cf.length < 2) {
    logger.session('[Quant:Risk][IRR] ⚠ 样本不足', { 原因: '现金流长度<2', 返回: null });
    return null;
  }
  // IRR 存在的必要条件：现金流至少有一次正、一次负（符号变化）
  let hasPositive = false, hasNegative = false;
  for (const v of cf) {
    if (safeNum(v, 0) > 0) hasPositive = true;
    if (safeNum(v, 0) < 0) hasNegative = true;
  }
  if (!hasPositive || !hasNegative) {
    logger.session('[Quant:Risk][IRR] ⚠ 无符号变化', {
      原因: 'IRR 要求现金流至少有一次正一次负',
      含正现金流: hasPositive,
      含负现金流: hasNegative,
      返回: null,
    });
    return null;
  }

  const MAX_ITER = 100;
  const TOLERANCE = 1e-8;
  let r = safeNum(guess, 0.1);
  const iterations = [];
  let converged = false;
  let finalNPV = 0;

  for (let i = 0; i < MAX_ITER; i++) {
    let npv = 0, dnpv = 0; // NPV 与 dNPV/dr
    for (let t = 0; t < cf.length; t++) {
      const cft = safeNum(cf[t], 0);
      const df = Math.pow(1 + r, t);
      npv += cft / df;
      if (t > 0) dnpv -= t * cft / Math.pow(1 + r, t + 1);
    }
    finalNPV = npv;
    if (Math.abs(dnpv) < 1e-12) {
      logger.session('[Quant:Risk][IRR] ⚡ 导数过小中断', {
        迭代次数: i + 1,
        当前r: +r.toFixed(8),
        导数dNPV: +dnpv.toFixed(12),
        中断原因: 'dNPV/dr < 1e-12，避免除零',
      });
      break;
    }
    const rNew = r - npv / dnpv;
    iterations.push({
      迭代: i + 1,
      当前r: +r.toFixed(8),
      NPV: +npv.toFixed(8),
      导数: +dnpv.toFixed(8),
      下一步r: +rNew.toFixed(8),
    });
    if (Math.abs(rNew - r) < TOLERANCE) {
      converged = true;
      r = rNew;
      break;
    }
    r = rNew;
  }

  // IRR 合理区间限制 [-99%, 1000%]
  const irr = clamp(r, -0.99, 10);

  logger.session('[Quant:Risk][IRR] 迭代过程', {
    总迭代数: iterations.length,
    是否收敛: converged,
    迭代明细: iterations.slice(0, 10), // 只打印前 10 次避免日志过长
  });
  logger.session('[Quant:Risk][IRR] ✓ 完成', {
    最终IRR: +irr.toFixed(6),
    IRR百分比: `${(irr * 100).toFixed(4)}%`,
    收敛阈值: TOLERANCE,
    实际迭代: iterations.length,
    最终NPV_应接近0: +finalNPV.toFixed(8),
    IRR解读: irr < 0 ? '亏损项目(IRR<0)' : irr < 0.05 ? '低于无风险利率' : irr < 0.1 ? '一般' : irr < 0.2 ? '良好' : irr < 0.3 ? '优秀' : '极高(需核查)',
  });
  return irr;
}

/**
 * DCF 估值模型 - 自由现金流折现
 * 前 N 年明确预测 + 永续价值
 *
 * @param {number} fcf - 当前自由现金流
 * @param {number} growthRate - 初期增长率
 * @param {number} wacc - 加权平均资本成本
 * @param {number} terminalGrowth - 永续增长率
 * @param {number} years - 预测年数
 * @param {number} initialInvestment - 初始投资（可选，用于计算真实 IRR；为 0 时不计算 IRR）
 * @returns {object} { npv, irr, projectedFCFs, terminalValue, intrinsicValue, annualPVs, stageWeights }
 */
export function computeDCF(fcf, growthRate, wacc, terminalGrowth = 0.025, years = 10, initialInvestment = 0) {
  logger.session('[Quant:Risk][DCF] ▶ 入口', {
    原始输入_fcf: fcf,
    原始输入_growthRate: growthRate,
    原始输入_wacc: wacc,
    原始输入_terminalGrowth: terminalGrowth,
    原始输入_years: years,
  });
  let pv = 0;
  const projectedFCFs = [];
  const annualPVs = []; // 每年折现明细
  let curFcf = safeNum(fcf, 1);
  const g = safeNum(growthRate, 0.05);
  const w = Math.max(0.01, safeNum(wacc, 0.08));
  const tg = clamp(safeNum(terminalGrowth, 0.025), 0, w - 0.001);
  const n = safeNum(years, 10);

  logger.session('[Quant:Risk][DCF] 参数归一化', {
    当前FCF_curFcf: curFcf,
    初期增长率_g: `${(g * 100).toFixed(2)}%`,
    折现率WACC_w: `${(w * 100).toFixed(2)}%`,
    永续增长率_tg: `${(tg * 100).toFixed(2)}%`,
    预测年数_n: n,
    永续增长校验: `tg(${tg.toFixed(4)}) < w(${w.toFixed(4)}) ? ${tg < w ? '✓合法' : '✗非法(已修正)'}`,
  });

  for (let t = 1; t <= n; t++) {
    // 前3年高增长，之后逐步衰减
    const decayFactor = Math.pow(0.8, Math.max(0, t - 3));
    const gt = t <= 3 ? g : Math.max(0.03, g * decayFactor);
    const prevFcf = curFcf;
    curFcf = curFcf * (1 + gt);
    const discountFactor = 1 / Math.pow(1 + w, t);
    const fcfPV = curFcf * discountFactor;
    pv += fcfPV;
    projectedFCFs.push(curFcf);
    annualPVs.push({
      年: `Y${t}`,
      增长假设: t <= 3 ? `前3年固定g=${(g * 100).toFixed(1)}%` : `衰减g×0.8^${t - 3}=${(gt * 100).toFixed(2)}%`,
      当年FCF: +curFcf.toFixed(4),
      环比增长: prevFcf > 0 ? `${((curFcf / prevFcf - 1) * 100).toFixed(2)}%` : '-',
      折现因子: `1/(1+${(w * 100).toFixed(1)}%)^${t} = ${+discountFactor.toFixed(5)}`,
      折现值PV: +fcfPV.toFixed(4),
    });
  }

  const lastProjectedFCF = projectedFCFs[projectedFCFs.length - 1];
  const terminalValue = lastProjectedFCF * (1 + tg) / Math.max(0.001, w - tg);
  const terminalDiscountFactor = 1 / Math.pow(1 + w, n);
  const terminalPV = terminalValue * terminalDiscountFactor;
  const npv = pv + terminalPV;

  const stageWeights = {
    明确预测期PV: +pv.toFixed(2),
    明确预测期权重: `${(pv / npv * 100).toFixed(1)}%`,
    永续期TerminalPV: +terminalPV.toFixed(2),
    永续期权重: `${(terminalPV / npv * 100).toFixed(1)}%`,
  };

  logger.session('[Quant:Risk][DCF] 阶段一：明确预测期折现明细', {
    年数: n,
    每年明细: annualPVs,
    合计PV: +pv.toFixed(4),
  });
  logger.session('[Quant:Risk][DCF] 阶段二：永续价值计算', {
    最后一年FCF: +lastProjectedFCF.toFixed(4),
    永续公式: `TV = ${+lastProjectedFCF.toFixed(4)} × (1+${tg.toFixed(4)}) / (${w.toFixed(4)} - ${tg.toFixed(4)})`,
    TerminalValue_raw: +terminalValue.toFixed(2),
    折现到T0: `TV × 1/(1+w)^${n} = ${+terminalValue.toFixed(2)} × ${+terminalDiscountFactor.toFixed(6)}`,
    TerminalPV: +terminalPV.toFixed(2),
  });
  // 构造完整现金流序列用于 IRR 求解（含初始投资，最后一年并入终值）
  const investment = safeNum(initialInvestment, 0);
  let irr = null;
  let irrNote = '';
  if (investment > 0 && projectedFCFs.length > 0) {
    // CF_0 = -投资, CF_1..CF_{n-1} = 各年FCF, CF_n = 最后一年FCF + 终值
    const irrCashflows = [
      -investment,
      ...projectedFCFs.slice(0, -1),
      projectedFCFs[projectedFCFs.length - 1] + terminalValue,
    ];
    irr = computeIRR(irrCashflows, w);
    irrNote = irr === null ? 'Newton-Raphson 未收敛/无符号变化，IRR 不可解' : 'Newton-Raphson 迭代求解';
  } else {
    irrNote = '未提供 initialInvestment，无法计算真实 IRR（如需 IRR 请传入第 6 个参数）';
  }

  logger.session('[Quant:Risk][DCF] ✓ 完成', {
    ...stageWeights,
    总内在价值NPV: +npv.toFixed(2),
    IRR求解方式: irrNote,
    IRR值: irr === null ? null : +irr.toFixed(6),
    IRR百分比: irr === null ? null : `${(irr * 100).toFixed(4)}%`,
    初始投资: investment > 0 ? +investment.toFixed(2) : '未提供',
    '永续价值敏感度_若tg±0.5%': `TV在w=${(w*100).toFixed(1)}%下每变动1%永续增长约变动 ${+(terminalValue / (w - tg) * 0.01 / npv * 100).toFixed(2)}% NPV`,
  });

  return {
    npv,
    irr, // 真实 IRR（Newton-Raphson 迭代），无初始投资时为 null
    irrNote,
    projectedFCFs,
    terminalValue,
    intrinsicValue: npv,
    annualPVs,
    stageWeights,
  };
}

/**
 * WACC - 加权平均资本成本
 * WACC = Re·We + Rd·(1-T)·Wd
 * Re = Rf + β·(Rm-Rf)  (CAPM)
 *
 * @param {number} rf - 无风险利率
 * @param {number} beta - Beta 系数
 * @param {number} marketPremium - 市场风险溢价
 * @param {number} costOfDebt - 债务成本
 * @param {number} taxRate - 税率
 * @param {number} equityWeight - 权益权重
 * @returns {number} WACC
 */
export function computeWACC(rf = 0.042, beta = 1, marketPremium = 0.055, costOfDebt = 0.05, taxRate = 0.21, equityWeight = 0.8) {
  logger.session('[Quant:Risk][WACC] ▶ 入口', {
    原始输入_rf: rf,
    原始输入_beta: beta,
    原始输入_marketPremium: marketPremium,
    原始输入_costOfDebt: costOfDebt,
    原始输入_taxRate: taxRate,
    原始输入_equityWeight: equityWeight,
  });
  const r = safeNum(rf, 0.042);
  const b = safeNum(beta, 1);
  const mp = safeNum(marketPremium, 0.055);
  const cod = safeNum(costOfDebt, 0.05);
  const tr = safeNum(taxRate, 0.21);
  const ew = clamp(safeNum(equityWeight, 0.8), 0, 1);
  const dw = 1 - ew; // 债务权重

  const capmFormula = `${(r * 100).toFixed(2)}% + ${b.toFixed(2)} × ${(mp * 100).toFixed(2)}%`;
  const costOfEquity = r + b * mp; // CAPM
  const afterTaxCostOfDebt = cod * (1 - tr);
  const wacc = costOfEquity * ew + afterTaxCostOfDebt * dw;

  const breakdown = {
    'CAPM权益成本 Re': {
      公式: `Rf + β·(Rm-Rf) = ${capmFormula}`,
      结果: `${(costOfEquity * 100).toFixed(3)}%`,
      权重: `${(ew * 100).toFixed(1)}%`,
      贡献: `${(costOfEquity * ew * 100).toFixed(3)}%`,
    },
    '税后债务成本 Rd(1-T)': {
      公式: `${(cod * 100).toFixed(2)}% × (1 - ${(tr * 100).toFixed(1)}%)`,
      结果: `${(afterTaxCostOfDebt * 100).toFixed(3)}%`,
      权重: `${(dw * 100).toFixed(1)}%`,
      贡献: `${(afterTaxCostOfDebt * dw * 100).toFixed(3)}%`,
    },
  };

  logger.session('[Quant:Risk][WACC] 参数归一化', {
    无风险利率_Rf: `${(r * 100).toFixed(2)}%`,
    Beta_β: b,
    市场溢价_MRP: `${(mp * 100).toFixed(2)}%`,
    税前债务成本_Rd: `${(cod * 100).toFixed(2)}%`,
    税率_T: `${(tr * 100).toFixed(1)}%`,
    权益权重_We: `${(ew * 100).toFixed(1)}%`,
    债务权重_Wd: `${(dw * 100).toFixed(1)}%`,
    '权重校验_We+Wd': `${((ew + dw) * 100).toFixed(0)}%`,
  });
  logger.session('[Quant:Risk][WACC] 分项计算明细', breakdown);
  logger.session('[Quant:Risk][WACC] ✓ 完成', {
    权益成本: `${(costOfEquity * 100).toFixed(2)}%`,
    税后债务成本: `${(afterTaxCostOfDebt * 100).toFixed(2)}%`,
    最终WACC: `${(wacc * 100).toFixed(3)}%`,
    WACC解读: wacc < 0.07 ? '低WACC -> 高估值支撑' : wacc < 0.1 ? '中性' : '高WACC -> 估值承压',
  });

  return wacc;
}

/**
 * Altman Z-Score - 破产风险评分
 * Z > 2.99: 安全区 | 1.81 < Z < 2.99: 灰色区 | Z < 1.81: 危险区
 */
export function computeZScore(workingCapitalRatio, retainedEarningsRatio, EBITRatio, marketCapDebtRatio, revenueRatio) {
  logger.session('[Quant:Risk][ZScore] ▶ 入口', {
    A_workingCapital_TA: workingCapitalRatio,
    B_retainedEarnings_TA: retainedEarningsRatio,
    C_EBIT_TA: EBITRatio,
    D_marketCap_TotalLiab: marketCapDebtRatio,
    E_revenue_TA: revenueRatio,
  });

  const A = safeNum(workingCapitalRatio, 0);
  const B = safeNum(retainedEarningsRatio, 0);
  const C = safeNum(EBITRatio, 0);
  const D = safeNum(marketCapDebtRatio, 0);
  const E = safeNum(revenueRatio, 0);

  const contributions = [
    { factor: 'A', label: '营运资本/总资产', 权重: 1.2, 输入: A, 贡献: +(1.2 * A).toFixed(5) },
    { factor: 'B', label: '留存收益/总资产', 权重: 1.4, 输入: B, 贡献: +(1.4 * B).toFixed(5) },
    { factor: 'C', label: 'EBIT/总资产',     权重: 3.3, 输入: C, 贡献: +(3.3 * C).toFixed(5) },
    { factor: 'D', label: '市值/总负债',     权重: 0.6, 输入: D, 贡献: +(0.6 * D).toFixed(5) },
    { factor: 'E', label: '营收/总资产',     权重: 1.0, 输入: E, 贡献: +(1.0 * E).toFixed(5) },
  ];

  const Z = (
    1.2 * A +
    1.4 * B +
    3.3 * C +
    0.6 * D +
    1.0 * E
  );

  let zone = '灰色区';
  let zoneRisk = '中风险';
  if (Z > 2.99) { zone = '安全区'; zoneRisk = '低风险'; }
  else if (Z < 1.81) { zone = '危险区'; zoneRisk = '高风险'; }

  const formulaStr = contributions.map(c => `${c.权重}×${c.输入.toFixed(4)}`).join(' + ');

  logger.session('[Quant:Risk][ZScore] 分项贡献', {
    Altman公式: `Z = ${formulaStr}`,
    各项: contributions,
    合计: +Z.toFixed(5),
  });
  logger.session('[Quant:Risk][ZScore] ✓ 完成', {
    原始5因子: [A, B, C, D, E],
    计算式: formulaStr,
    ZScore: +Z.toFixed(4),
    分区判断: zone,
    风险等级: zoneRisk,
    边界: `Z < 1.81(危险)  1.81 < Z < 2.99(灰色)  Z > 2.99(安全)`,
  });
  return Z;
}

/**
 * 最大回撤 (MDD) 计算
 * MDD = (Peak - Trough) / Peak
 */
export function computeMaxDrawdown(priceSeries) {
  logger.session('[Quant:Risk][MDD] ▶ 入口', {
    输入价格序列长度: Array.isArray(priceSeries) ? priceSeries.length : 0,
    前3个样本: Array.isArray(priceSeries) ? priceSeries.slice(0, 3) : [],
    后3个样本: Array.isArray(priceSeries) ? priceSeries.slice(-3) : [],
  });
  const series = safeArr(priceSeries, []);
  if (series.length < 2) {
    logger.session('[Quant:Risk][MDD] ⚠ 样本不足', { 原因: '序列长度<2', 返回: 0 });
    return 0;
  }

  let peak = series[0];
  let peakIdx = 0;
  let trough = series[0];
  let troughIdx = 0;
  let maxDD = 0;
  let maxDDPeakIdx = 0;
  let maxDDTroughIdx = 0;
  const drawdownSeries = [];

  for (let i = 0; i < series.length; i++) {
    const price = series[i];
    let updatedPeak = false;
    if (price > peak) {
      peak = price;
      peakIdx = i;
      updatedPeak = true;
    }
    const dd = peak > 0 ? (peak - price) / peak : 0;
    drawdownSeries.push({ idx: i, price, currentPeak: peak, 回撤: +(dd * 100).toFixed(3) + '%' });
    if (dd > maxDD) {
      maxDD = dd;
      maxDDPeakIdx = peakIdx;
      maxDDTroughIdx = i;
      trough = price;
      troughIdx = i;
    }
  }

  const recoveryDays = series.length - maxDDTroughIdx - 1;
  const peakPrice = series[maxDDPeakIdx];
  const bottomPrice = series[maxDDTroughIdx];
  const lossAmount = peakPrice - bottomPrice;

  logger.session('[Quant:Risk][MDD] 回撤路径关键节点', {
    峰值日期: `D${maxDDPeakIdx}`,
    峰值价格: +peakPrice.toFixed(4),
    谷底日期: `D${maxDDTroughIdx}`,
    谷底价格: +bottomPrice.toFixed(4),
    回撤金额: +lossAmount.toFixed(4),
    回撤持续天数: maxDDTroughIdx - maxDDPeakIdx,
    距离末端剩余天数: recoveryDays,
  });
  logger.session('[Quant:Risk][MDD] ✓ 完成', {
    样本数: series.length,
    峰值: +peak.toFixed(4),
    谷值: +trough.toFixed(4),
    最大回撤MDD: +(maxDD * 100).toFixed(3) + '%',
    MDD解读: maxDD > 0.4 ? '极其严重' : maxDD > 0.3 ? '严重' : maxDD > 0.2 ? '显著' : maxDD > 0.1 ? '一般' : '温和',
  });
  return maxDD;
}

/**
 * VaR (风险价值) 计算 - 参数法
 * 在 95% 置信度下，最大损失不超过 VaR
 */
export function computeVaR(meanReturn, volatility, confidence = 0.95) {
  logger.session('[Quant:Risk][VaR] ▶ 入口', {
    原始输入_meanReturn: meanReturn,
    原始输入_volatility: volatility,
    原始输入_confidence: confidence,
  });
  const mu = safeNum(meanReturn, 0);
  const sigma = safeNum(volatility, 0.3);
  const conf = safeNum(confidence, 0.95);
  // 标准正态分布分位数: 95% -> 1.645, 99% -> 2.326, 90% -> 1.282
  let zScore;
  if (conf >= 0.99) zScore = 2.326;
  else if (conf >= 0.975) zScore = 1.960;
  else if (conf >= 0.95) zScore = 1.645;
  else if (conf >= 0.90) zScore = 1.282;
  else zScore = 1.0;

  const formula = `VaR_${(conf * 100).toFixed(0)}% = μ - Z·σ = ${mu.toFixed(5)} - ${zScore} × ${sigma.toFixed(5)}`;
  const var95 = mu - zScore * sigma;

  logger.session('[Quant:Risk][VaR] 参数', {
    年化收益_μ: `${(mu * 100).toFixed(3)}%`,
    年化波动_σ: `${(sigma * 100).toFixed(3)}%`,
    置信度: `${(conf * 100).toFixed(1)}%`,
    标准分位数_Z: zScore,
  });
  logger.session('[Quant:Risk][VaR] ✓ 完成', {
    计算式: formula,
    VaR_绝对: +var95.toFixed(5),
    VaR_百分比: `${(var95 * 100).toFixed(3)}%`,
    含义: `在${(conf * 100).toFixed(0)}%置信度下，预期最大损失不超过 ${(Math.abs(var95) * 100).toFixed(2)}%`,
    日VaR近似: `${(var95 / Math.sqrt(252) * 100).toFixed(3)}%/日 (假设252交易日正态化)`,
  });
  return var95;
}

// ============================================================
// 默认因子库
// ============================================================
export function getDefaultFactorLibrary(assetId = 'AAPL', regime = 'RED_OCEAN') {
  const r = regime;
  return {
    assetId,
    processedAt: Date.now(),
    regime: r,
    valueFactors: {
      pe_ttm: 20, pb_lf: 5, ps_ttm: 3, ev_ebitda: 12,
      dividendYield: 0.02, fcfYield: 0.03,
      pePercentile: 0.5, pbPercentile: 0.5,
    },
    growthFactors: {
      revenueGrowth3yCAGR: 0.1, earningsGrowth3yCAGR: 0.1, fcfGrowth3yCAGR: 0.08,
      revenueGrowthYoY: 0.1, earningsGrowthYoY: 0.1,
      epsGrowthNextFY: 0.1, revenueGrowthNextFY: 0.08,
    },
    qualityFactors: {
      roe_ttm: 0.2, roa_ttm: 0.08, grossMargin: 0.4, operatingMargin: 0.2, netMargin: 0.15,
      debtToEquity: 0.5, currentRatio: 1.5, interestCoverage: 8, earningsStability: 0.8,
    },
    momentumFactors: {
      return1m: 0, return3m: 0.02, return6m: 0.05, return12m: 0.1,
      relativeStrength: 0.5, northboundFlow: 0, institutionalHolding: 0.6,
    },
    sentimentFactors: {
      newsSentiment: 0.5, analystConsensus: 0.5, socialSentiment: 0.5,
      shortInterestRatio: 0.04, putCallRatio: 0.8, vixAdjustment: 1,
    },
    riskFactors: {
      coneC: 0.4, zScore: 0,
      mdd: r === 'BLUE_OCEAN' ? 0.25 : 0.35,
      drawdown: 0.1,
      volatility30d: r === 'BLUE_OCEAN' ? 0.2 : 0.35,
      beta: r === 'BLUE_OCEAN' ? 1.3 : 0.9,
      valueAtRisk95: 0.03,
      maxDrawdown1y: r === 'BLUE_OCEAN' ? 0.3 : 0.45,
    },
    factorZScores: {},
    compositeScore: 50,
  };
}

// ============================================================
// 十一步引擎核心实现
// ============================================================

/**
 * Step 0: 宏观海选 - 从资产池中筛选符合当前宏观环境的标的
 * 支持通过 options.customAssets / context.customAssets 传入真实行情资产池；
 * 同时通过 options.marketFactors / context.marketFactors 传每只 ticker 的
 * { marketShare, industryConcentration, initialPrice, intrinsicPrice } 做真实值覆盖。
 */
export function step0_macroFunnel(context = {}) {
  const regime = safeStr(context.regime, 'RED_OCEAN');
  const now = Date.now();
  const config = safeObj(context.config, {});
  const customAssets = Array.isArray(config.customAssets) && config.customAssets.length
    ? config.customAssets
    : Array.isArray(context.customAssets) && context.customAssets.length
      ? context.customAssets
      : null;
  const assetPool = customAssets || PRESET_ASSETS;
  const factorsByTicker = safeObj(config.marketFactors || context.marketFactors || {}, {});

  logger.session('[Quant:Step0][宏观海选] ▶ 入口', {
    Step: 0,
    名称: '宏观海选 + 筛选',
    宏观环境_regime: regime,
    regime含义: REGIMES[regime]?.label || regime,
    指定标的_initialTicker: config.initialTicker || '(未指定，取Top1)',
    海选池来源: customAssets ? '外部真实资产池' : '内置 PRESET_ASSETS',
    海选池数量: assetPool.length,
    真实Factors覆盖数量: Object.keys(factorsByTicker).length,
  });

  const rawScored = assetPool.map(asset => {
    let score = 50;
    const reasons = [];
    const breakdown = {};
    const ticker = safeStr(asset.ticker);
    const tickerFactors = safeObj(factorsByTicker[ticker], {});

    if (regime === 'RED_OCEAN') {
      if (asset.pe <= 20) { score += 15; reasons.push('低PE防御性'); breakdown.低PE = 15; } else breakdown.低PE = 0;
      if (asset.fcfYield >= 0.04) { score += 15; reasons.push('高自由现金流'); breakdown.高FCF收益率 = 15; } else breakdown.高FCF收益率 = 0;
      if (asset.debtToEquity <= 0.5) { score += 10; reasons.push('低负债稳健'); breakdown.低负债 = 10; } else breakdown.低负债 = 0;
      if (asset.revenueGrowthYoY < 0.2) { score += 5; reasons.push('盈利稳定性高'); breakdown.盈利稳定 = 5; } else breakdown.盈利稳定 = 0;
    } else if (regime === 'BLUE_OCEAN') {
      if (asset.revenueGrowthYoY >= 0.15) { score += 20; reasons.push('高增长弹性'); breakdown.高增长 = 20; } else breakdown.高增长 = 0;
      if (asset.pe >= 25) { score += 10; reasons.push('成长溢价'); breakdown.成长溢价 = 10; } else breakdown.成长溢价 = 0;
      if (asset.roe >= 0.2) { score += 10; reasons.push('高资本回报'); breakdown.高ROE = 10; } else breakdown.高ROE = 0;
      if (asset.grade === 'S' || asset.grade === 'A') { score += 5; reasons.push('优质评级'); breakdown.评级 = 5; } else breakdown.评级 = 0;
    } else {
      const peTerm = Math.abs(asset.pe - 25) < 15 ? 10 : 0;
      const growthTerm = (asset.revenueGrowthYoY > 0.05 && asset.revenueGrowthYoY < 0.3) ? 10 : 0;
      const gradeTerm = (asset.grade === 'S' || asset.grade === 'A') ? 10 : 0;
      score = 50 + peTerm + growthTerm + gradeTerm;
      if (peTerm) reasons.push('PE适中');
      if (growthTerm) reasons.push('增速健康');
      if (gradeTerm) reasons.push('优质评级');
      Object.assign(breakdown, { PE适中: peTerm, 增速健康: growthTerm, 优质评级: gradeTerm });
    }

    // 风险向量精算：优先用真实 marketShare/industryConcentration，否则沿用旧式推导
    const mktShare = safeNum(tickerFactors.marketShare, Math.max(0.01, asset.marketCap / 5000));
    const industryConc = safeNum(tickerFactors.industryConcentration, regime === 'BLUE_OCEAN' ? 0.6 : 0.4);
    const coneC = computeConeC(mktShare, industryConc);
    const zScore = gaussianRandom() * (regime === 'BLUE_OCEAN' ? 0.8 : 0.6);
    const mdd = regime === 'BLUE_OCEAN' ? 0.2 : 0.3;

    const finalScore = clamp(score, 0, 100);
    return {
      ...asset,
      marketShare: tickerFactors.marketShare !== undefined ? tickerFactors.marketShare : asset.marketShare,
      industryConcentration: tickerFactors.industryConcentration !== undefined ? tickerFactors.industryConcentration : asset.industryConcentration,
      initialPrice: tickerFactors.initialPrice !== undefined ? tickerFactors.initialPrice : asset.basePrice,
      intrinsicPrice: tickerFactors.intrinsicPrice !== undefined ? tickerFactors.intrinsicPrice : undefined,
      打分明细: { 基准分: 50, ...breakdown, 合计: finalScore },
      screeningScore: finalScore,
      selectionReasons: reasons,
      macroSignals: { coneC, zScore, mdd },
    };
  });

  // 打印打分明细前5名
  const sortedAll = [...rawScored].sort((a, b) => b.screeningScore - a.screeningScore);
  logger.session('[Quant:Step0][宏观海选] 全资产打分明细(按分数)', sortedAll.map(a => ({
    ticker: a.ticker,
    name: a.name,
    分数: a.screeningScore,
    明细: a.打分明细,
    理由: a.selectionReasons,
  })));

  const assets = rawScored
    .filter(a => a.screeningScore >= 55)
    .sort((a, b) => b.screeningScore - a.screeningScore);

  logger.session('[Quant:Step0][宏观海选] 过滤阶段', {
    阈值: '≥55分',
    过滤前数量: rawScored.length,
    过滤后数量: assets.length,
    被排除标的: rawScored.filter(a => a.screeningScore < 55).map(a => `${a.ticker}(${a.screeningScore})`),
  });

  // 兜底：确保至少有一个资产
  let finalAssets = assets;
  let usedFallback = false;
  if (finalAssets.length === 0) {
    usedFallback = true;
    const fallback = assetPool[0];
    const fbFactors = safeObj(factorsByTicker[safeStr(fallback.ticker)], {});
    finalAssets = [{
      ...fallback,
      screeningScore: 60,
      selectionReasons: ['默认标的兜底（全部<55分）'],
      macroSignals: { coneC: 0.4, zScore: 0, mdd: 0.3 },
      initialPrice: fbFactors.initialPrice !== undefined ? fbFactors.initialPrice : fallback.basePrice,
      intrinsicPrice: fbFactors.intrinsicPrice !== undefined ? fbFactors.intrinsicPrice : undefined,
      marketShare: fbFactors.marketShare,
      industryConcentration: fbFactors.industryConcentration,
    }];
    logger.session('[Quant:Step0][宏观海选] ⚠ 触发兜底', { 原因: '全部标的<55分', 兜底标的: finalAssets[0].ticker });
  }

  const initialTicker = config.initialTicker;
  let specifiedMatched = initialTicker ? finalAssets.find(a => a.ticker === initialTicker) : null;
  // 如果用户输入的代码（比如用户手动输入了 600519）不在当前资产池中，允许直接以该 ticker 创建一个"单标的池"
  if (initialTicker && !specifiedMatched) {
    const customFb = {
      ticker: initialTicker,
      name: safeStr(config.initialTickerName, initialTicker),
      industry: safeStr(config.initialTickerIndustry, '综合'),
      marketCap: safeNum(config.initialTickerMarketCap, 200),
      pe: safeNum(config.initialTickerPE, 25),
      pb: safeNum(config.initialTickerPB, 4),
      revenueGrowthYoY: safeNum(config.initialTickerGrowth, 0.1),
      fcfYield: safeNum(config.initialTickerFCFYield, 0.03),
      roe: safeNum(config.initialTickerROE, 0.15),
      debtToEquity: safeNum(config.initialTickerDE, 0.5),
      grade: safeStr(config.initialTickerGrade, 'A'),
      basePrice: safeNum(config.initialTickerBasePrice, 1),
    };
    const fbFactors = safeObj(factorsByTicker[initialTicker], {});
    const coneC = computeConeC(
      safeNum(fbFactors.marketShare, 0.2),
      safeNum(fbFactors.industryConcentration, 0.45)
    );
    specifiedMatched = {
      ...customFb,
      screeningScore: 70,
      selectionReasons: ['用户指定标的'],
      macroSignals: { coneC, zScore: 0, mdd: 0.3 },
      initialPrice: fbFactors.initialPrice !== undefined ? fbFactors.initialPrice : customFb.basePrice,
      intrinsicPrice: fbFactors.intrinsicPrice,
      marketShare: fbFactors.marketShare,
      industryConcentration: fbFactors.industryConcentration,
    };
    // 插入到 finalAssets 头部，让它能被选中
    finalAssets = [specifiedMatched, ...finalAssets.filter(a => a.ticker !== initialTicker)];
    logger.session('[Quant:Step0][宏观海选] ℹ 插入用户指定标的', { 指定: initialTicker });
  }
  const selectedAsset = specifiedMatched || finalAssets[0];

  const macroIndicators = {
    gdpGrowth: regime === 'BLUE_OCEAN' ? 0.04 : regime === 'RED_OCEAN' ? 0.02 : 0.03,
    cpi: regime === 'BLUE_OCEAN' ? 0.03 : regime === 'RED_OCEAN' ? 0.05 : 0.04,
    riskFreeRate: 0.042,
    m2Growth: regime === 'BLUE_OCEAN' ? 0.1 : regime === 'RED_OCEAN' ? 0.06 : 0.08,
    vix: regime === 'BLUE_OCEAN' ? 15 : regime === 'RED_OCEAN' ? 25 : 20,
    marketSentiment: regime === 'BLUE_OCEAN' ? 70 : regime === 'RED_OCEAN' ? 40 : 55,
  };
  const criteria = {
    regime,
    hardFilters: regime === 'RED_OCEAN'
      ? { maxPE: 20, minFCFYield: 0.04, maxDebtToEquity: 0.6 }
      : regime === 'BLUE_OCEAN'
        ? { minRevenueGrowth: 0.12, minROE: 0.15 }
        : { maxPE: 60, minFCFYield: 0.01 },
    softWeights: regime === 'RED_OCEAN'
      ? { valuation: 0.4, growth: 0.1, quality: 0.4, momentum: 0.1 }
      : regime === 'BLUE_OCEAN'
        ? { valuation: 0.15, growth: 0.4, quality: 0.2, momentum: 0.25 }
        : { valuation: 0.25, growth: 0.25, quality: 0.25, momentum: 0.25 },
  };

  const result = {
    generationId: generateId(),
    timestamp: now,
    regime,
    macroIndicators,
    criteria,
    assets: finalAssets,
    totalScreened: assetPool.length,
    totalPassed: finalAssets.length,
    selectedAsset,
  };

  logger.session('[Quant:Step0][宏观海选] ✓ 完成', {
    海选GenerationId: result.generationId,
    是否触发兜底: usedFallback,
    筛选通过数量: `${finalAssets.length}/${assetPool.length}`,
    Top3: finalAssets.slice(0, 3).map(a => `${a.ticker}(${a.screeningScore})`),
    最终选中标的: selectedAsset.ticker,
    选中理由: selectedAsset.selectionReasons,
    宏观指标: {
      GDP: `${(macroIndicators.gdpGrowth * 100).toFixed(1)}%`,
      CPI: `${(macroIndicators.cpi * 100).toFixed(1)}%`,
      VIX: macroIndicators.vix,
      情绪: macroIndicators.marketSentiment,
    },
    硬过滤器: criteria.hardFilters,
    软权重: criteria.softWeights,
  });

  auditLogStore.append('quant', 'macro_funnel', {
    regime,
    passed: finalAssets.length,
    selected: selectedAsset.ticker,
  });

  return result;
}

/**
 * Step 1-2: 信息清洗ETL + 因子库构建
 */
export function step2_buildFactorLibrary(input = {}, context = {}) {
  const regime = safeStr(context.regime, 'RED_OCEAN');
  const asset = safeObj(input.selectedAsset) || safeObj(input);
  const assetId = safeStr(asset.ticker, 'AAPL');
  const basePE = safeNum(asset.pe, 20);
  const baseGrowth = safeNum(asset.revenueGrowthYoY, 0.1);
  const basePB = safeNum(asset.pb, 5);
  const baseFCFYield = safeNum(asset.fcfYield, 0.03);
  const baseROE = safeNum(asset.roe, 0.2);
  const baseDE = safeNum(asset.debtToEquity, 0.5);

  // 风险向量精算
  const coneC = computeConeC(safeNum(asset.marketCap, 1000) / 5000, regime === 'BLUE_OCEAN' ? 0.55 : 0.4);
  const zScoreRaw = gaussianRandom() * (regime === 'BLUE_OCEAN' ? 0.7 : 0.9);
  const zScore = computeZScore(
    0.1 + Math.random() * 0.1,  // 营运资本/总资产
    0.2 + Math.random() * 0.3,  // 留存收益/总资产
    0.1 + Math.random() * 0.15, // EBIT/总资产
    baseDE < 0.5 ? 2 : 0.5 + Math.random(), // 市值/总负债
    0.8 + Math.random() * 0.6   // 营收/总资产
  );

  const riskFactors = {
    coneC,
    zScore,
    mdd: regime === 'BLUE_OCEAN' ? 0.25 : 0.35,
    drawdown: Math.random() * 0.2,
    volatility30d: regime === 'BLUE_OCEAN' ? 0.2 : 0.35,
    beta: regime === 'BLUE_OCEAN' ? 1.2 + Math.random() * 0.3 : 0.8 + Math.random() * 0.2,
    valueAtRisk95: 0.02 + Math.random() * 0.03,
    maxDrawdown1y: regime === 'BLUE_OCEAN' ? 0.3 : 0.45,
  };

  // 综合评分
  const valueScore = clamp(100 - (basePE / 80) * 50 - (basePB / 60) * 30 + baseFCFYield * 1000 * 0.2, 0, 100);
  const growthScore = clamp(baseGrowth * 300 + 30, 0, 100);
  const qualityScore = clamp(baseROE * 200 + (2 - baseDE) * 20, 0, 100);
  const riskScore = clamp(100 - (riskFactors.volatility30d * 150 + riskFactors.mdd * 80), 0, 100);
  const weights = context.pipeline?.macroFunnel?.criteria?.softWeights || { valuation: 0.25, growth: 0.25, quality: 0.25, momentum: 0.25 };
  const compositeScore = clamp(
    valueScore * (weights.valuation || 0.25) +
    growthScore * (weights.growth || 0.25) +
    qualityScore * (weights.quality || 0.25) +
    riskScore * 0.25,
    0, 100
  );

  const result = {
    assetId,
    processedAt: Date.now(),
    regime,
    valueFactors: {
      pe_ttm: basePE, pb_lf: basePB, ps_ttm: basePE * 0.8, ev_ebitda: basePE * 0.7,
      dividendYield: baseFCFYield * 0.6, fcfYield: baseFCFYield,
      pePercentile: clamp(basePE / 80, 0, 1), pbPercentile: clamp(basePB / 60, 0, 1),
      valueScore,
    },
    growthFactors: {
      revenueGrowth3yCAGR: baseGrowth, earningsGrowth3yCAGR: baseGrowth * 1.1, fcfGrowth3yCAGR: baseGrowth * 0.9,
      revenueGrowthYoY: baseGrowth, earningsGrowthYoY: baseGrowth * 1.05,
      epsGrowthNextFY: Math.max(0.05, baseGrowth * (regime === 'BLUE_OCEAN' ? 1.2 : 0.8)),
      revenueGrowthNextFY: Math.max(0.03, baseGrowth * (regime === 'BLUE_OCEAN' ? 1.15 : 0.85)),
      growthScore,
    },
    qualityFactors: {
      roe_ttm: baseROE, roa_ttm: baseROE * 0.4,
      grossMargin: 0.3 + Math.random() * 0.3, operatingMargin: 0.15 + Math.random() * 0.25, netMargin: 0.1 + Math.random() * 0.2,
      debtToEquity: baseDE, currentRatio: 1.2 + Math.random(), interestCoverage: 5 + Math.random() * 10,
      earningsStability: 0.7 + Math.random() * 0.3,
      qualityScore,
    },
    momentumFactors: {
      return1m: (Math.random() - 0.4) * 0.1,
      return3m: (Math.random() - 0.3) * 0.2,
      return6m: (Math.random() - 0.2) * 0.3,
      return12m: (Math.random() - 0.1) * 0.5,
      relativeStrength: 0.3 + Math.random() * 0.5,
      northboundFlow: (Math.random() - 0.3) * 0.05,
      institutionalHolding: 0.4 + Math.random() * 0.4,
      momentumScore: clamp(50 + Math.random() * 30, 0, 100),
    },
    sentimentFactors: {
      newsSentiment: (regime === 'BLUE_OCEAN' ? 0.6 : regime === 'RED_OCEAN' ? 0.3 : 0.45) + (Math.random() - 0.5) * 0.4,
      analystConsensus: (regime === 'BLUE_OCEAN' ? 0.6 : regime === 'RED_OCEAN' ? 0.3 : 0.45) + (Math.random() - 0.5) * 0.3,
      socialSentiment: (regime === 'BLUE_OCEAN' ? 0.6 : regime === 'RED_OCEAN' ? 0.3 : 0.45) + (Math.random() - 0.5) * 0.6,
      shortInterestRatio: 0.02 + Math.random() * 0.08,
      putCallRatio: 0.6 + Math.random() * 0.6,
      vixAdjustment: ((regime === 'BLUE_OCEAN' ? 15 : regime === 'RED_OCEAN' ? 25 : 20) / 20),
    },
    riskFactors: {
      ...riskFactors,
      riskScore,
    },
    factorZScores: {},
    compositeScore: +compositeScore.toFixed(1),
  };

  logger.session('[Quant] Step 1-2 因子库构建完成', {
    标的: assetId,
    综合评分: result.compositeScore,
    ConeC: riskFactors.coneC.toFixed(3),
    'Z-Score': zScore.toFixed(2),
  });

  auditLogStore.append('quant', 'factor_library', {
    assetId,
    compositeScore: result.compositeScore,
    riskVector: { coneC: riskFactors.coneC, zScore },
  });

  return result;
}

/**
 * Step 4: 估值模型 - DCF + WACC + 相对估值
 */
export function step4_valuation(factors = {}, context = {}) {
  const regime = safeStr(context.regime, 'RED_OCEAN');
  const asset = safeObj(context.pipeline?.macroFunnel?.selectedAsset, PRESET_ASSETS[0]);
  const growthFactors = safeObj(factors.growthFactors);
  const qualityFactors = safeObj(factors.qualityFactors);
  const riskFactors = safeObj(factors.riskFactors);
  const valueFactors = safeObj(factors.valueFactors);

  logger.session('[Quant:Step4][估值模型] ▶ 入口', {
    Step: 4,
    名称: 'DCF+相对估值',
    标的: asset.ticker,
    regime,
    因子快照: {
      PE_ttm: valueFactors.pe_ttm,
      PB_lf: valueFactors.pb_lf,
      FCF收益率: valueFactors.fcfYield,
      营收增速NextFY: growthFactors.revenueGrowthNextFY,
      ROE: qualityFactors.roe_ttm,
      'D/E': qualityFactors.debtToEquity,
      Beta: riskFactors.beta,
    },
  });

  // WACC 计算
  const rf = 0.042;
  const marketPremium = 0.055;
  const cod = 0.05; // 税前债务成本
  const taxRate = 0.21;
  const equityWeightRaw = 1 / (1 + safeNum(qualityFactors.debtToEquity, 0.5));
  const equityWeight = clamp(equityWeightRaw, 0.1, 0.95);

  logger.session('[Quant:Step4][估值模型] WACC输入参数', {
    Rf无风险利率: `${(rf * 100).toFixed(2)}%`,
    MRP市场溢价: `${(marketPremium * 100).toFixed(2)}%`,
    Beta: safeNum(riskFactors.beta, 1).toFixed(3),
    Rd债务成本: `${(cod * 100).toFixed(2)}%`,
    T税率: `${(taxRate * 100).toFixed(1)}%`,
    权益权重计算: `1/(1+D/E) = 1/(1+${safeNum(qualityFactors.debtToEquity, 0.5)}) = ${equityWeightRaw.toFixed(4)} -> clamp后 ${(equityWeight * 100).toFixed(1)}%`,
  });
  const wacc = computeWACC(rf, safeNum(riskFactors.beta, 1), marketPremium, cod, taxRate, equityWeight);

  // 当前自由现金流估算
  const assetMarketCap = safeNum(asset.marketCap, 1000); // 原始单位是 十亿
  const fcfYieldInput = safeNum(valueFactors.fcfYield, 0.03);
  const currentFCF = assetMarketCap * 10 * fcfYieldInput;
  logger.session('[Quant:Step4][估值模型] FCF计算', {
    输入市值_十亿: assetMarketCap,
    转为亿: assetMarketCap * 10,
    FCF收益率: `${(fcfYieldInput * 100).toFixed(2)}%`,
    当前FCF_亿: `${currentFCF.toFixed(2)}亿`,
    公式: `市值(亿) × FCF收益率 = ${(assetMarketCap * 10).toFixed(2)}亿 × ${(fcfYieldInput * 100).toFixed(2)}%`,
  });

  // DCF 估值
  const dcfGrowthInput = safeNum(growthFactors.revenueGrowthNextFY, 0.08);
  const dcfResult = computeDCF(currentFCF, dcfGrowthInput, wacc, 0.025, 10);

  // 相对估值 (PE)
  const peFair = regime === 'BLUE_OCEAN' ? 35 : regime === 'RED_OCEAN' ? 15 : 22;
  const currentPE = safeNum(valueFactors.pe_ttm, 20);
  const marketCapBillions = assetMarketCap * 10;
  const earnings = marketCapBillions / currentPE;
  const peValuation = earnings * peFair;
  logger.session('[Quant:Step4][估值模型] PE相对估值', {
    regime环境: regime,
    公允PE_fair: peFair,
    当前PE_current: currentPE,
    总盈利_亿: `${earnings.toFixed(2)}亿`,
    PE估值_亿: `${peValuation.toFixed(2)}亿 = 盈利 × 公允PE = ${earnings.toFixed(2)} × ${peFair}`,
  });

  // PB 估值
  const pbFair = regime === 'BLUE_OCEAN' ? 10 : regime === 'RED_OCEAN' ? 3 : 5;
  const currentPB = safeNum(valueFactors.pb_lf, 5);
  const bookValue = marketCapBillions / currentPB;
  const pbValuation = bookValue * pbFair;
  logger.session('[Quant:Step4][估值模型] PB相对估值', {
    公允PB_fair: pbFair,
    当前PB_current: currentPB,
    净资产_亿: `${bookValue.toFixed(2)}亿`,
    PB估值_亿: `${pbValuation.toFixed(2)}亿 = 净资产 × 公允PB = ${bookValue.toFixed(2)} × ${pbFair}`,
  });

  // 综合估值
  const wDCF = 0.4, wPE = 0.35, wPB = 0.25;
  const compositeValuation = dcfResult.intrinsicValue * wDCF + peValuation * wPE + pbValuation * wPB;
  const upside = (compositeValuation - marketCapBillions) / marketCapBillions;
  logger.session('[Quant:Step4][估值模型] 综合加权', {
    权重_DCF: `${(wDCF * 100).toFixed(0)}%`,
    权重_PE: `${(wPE * 100).toFixed(0)}%`,
    权重_PB: `${(wPB * 100).toFixed(0)}%`,
    校验权重和: `${((wDCF + wPE + wPB) * 100).toFixed(0)}%`,
    DCF_亿: `${dcfResult.intrinsicValue.toFixed(2)} × ${wDCF} = ${(dcfResult.intrinsicValue * wDCF).toFixed(2)}`,
    PE_亿: `${peValuation.toFixed(2)} × ${wPE} = ${(peValuation * wPE).toFixed(2)}`,
    PB_亿: `${pbValuation.toFixed(2)} × ${wPB} = ${(pbValuation * wPB).toFixed(2)}`,
    综合估值_亿: `${compositeValuation.toFixed(2)}亿`,
    当前市值_亿: `${marketCapBillions.toFixed(2)}亿`,
    上涨空间: `${(upside * 100).toFixed(2)}%`,
  });

  // 安全边际 + 三区间
  const marginOfSafety = regime === 'BLUE_OCEAN' ? 0.15 : regime === 'RED_OCEAN' ? 0.3 : 0.22;
  const buyZone = compositeValuation * (1 - marginOfSafety);
  const fairZone = compositeValuation;
  const sellZone = compositeValuation * (1 + marginOfSafety * 1.5);
  const basePrice = safeNum(asset.basePrice, 100);

  const result = {
    valuationDate: Date.now(),
    regime,
    wacc,
    dcf: dcfResult,
    relative: {
      pe: { current: currentPE, fair: peFair, valuation: peValuation },
      pb: { current: currentPB, fair: pbFair, valuation: pbValuation },
    },
    composite: {
      valuation: compositeValuation,
      upside,
      marginOfSafety,
      zones: { buy: buyZone, fair: fairZone, sell: sellZone },
      weights: { DCF: wDCF, PE: wPE, PB: wPB },
    },
    perShare: {
      currentPrice: basePrice,
      intrinsicPrice: (compositeValuation / marketCapBillions) * basePrice,
      buyPrice: (buyZone / marketCapBillions) * basePrice,
      fairPrice: (fairZone / marketCapBillions) * basePrice,
      sellPrice: (sellZone / marketCapBillions) * basePrice,
    },
  };

  logger.session('[Quant:Step4][估值模型] ✓ 完成', {
    标的: asset.ticker,
    WACC: `${(wacc * 100).toFixed(2)}%`,
    DCF估值_万亿: `${(dcfResult.intrinsicValue / 10000).toFixed(3)}万亿`,
    PE估值_万亿: `${(peValuation / 10000).toFixed(3)}万亿`,
    PB估值_万亿: `${(pbValuation / 10000).toFixed(3)}万亿`,
    综合估值_万亿: `${(compositeValuation / 10000).toFixed(3)}万亿`,
    安全边际: `${(marginOfSafety * 100).toFixed(0)}%`,
    每股区间_买入公允卖出: `$${result.perShare.buyPrice.toFixed(2)} / $${result.perShare.fairPrice.toFixed(2)} / $${result.perShare.sellPrice.toFixed(2)}`,
    上涨空间: `${(upside * 100).toFixed(2)}%`,
    建议: upside > 0.3 ? '🟢低估/强烈买入' : upside > 0.1 ? '🟢低估/买入' : upside > -0.1 ? '🟡合理/持有' : upside > -0.25 ? '🔴高估/减仓' : '🔴严重高估/卖出',
  });

  // L3 估值越界检查
  if (upside > 1.5 || upside < -0.5) {
    const normalizedUpside = clamp((upside + 0.5) / 2.0, 0, 1);
    checkValuationBreach(normalizedUpside, `${asset.ticker}_upside`, 0, 1, 0.85);
  }

  auditLogStore.append('quant', 'valuation', {
    ticker: asset.ticker,
    intrinsicPrice: result.perShare.intrinsicPrice,
    upside: +(upside * 100).toFixed(2),
  });

  return result;
}

/**
 * Step 5-6: 沙盘决策推演 + 动态周期观测 (股价模拟)
 */
export function step6_simulation(factors = {}, valuation = {}, context = {}) {
  const regime = safeStr(context.regime, 'RED_OCEAN');
  const asset = safeObj(context.pipeline?.macroFunnel?.selectedAsset, PRESET_ASSETS[0]);
  const riskFactors = safeObj(factors.riskFactors);
  const perShare = safeObj(valuation.perShare);

  const currentPrice = safeNum(perShare.currentPrice, 100);
  const intrinsicPrice = safeNum(perShare.intrinsicPrice, currentPrice * 1.1);
  const vol30dInput = safeNum(riskFactors.volatility30d, 0.3);
  const volatility = vol30dInput / Math.sqrt(252);
  const drift = (intrinsicPrice - currentPrice) / currentPrice / 252;

  logger.session('[Quant:Step6][沙盘模拟] ▶ 入口', {
    Step: 6,
    名称: '股价蒙特卡洛模拟',
    标的: asset.ticker,
    regime,
    价格锚点: { 现价: `$${currentPrice.toFixed(2)}`, 内在价: `$${intrinsicPrice.toFixed(2)}` },
    趋势: intrinsicPrice >= currentPrice
      ? `向上漂移 = ${((intrinsicPrice - currentPrice) / currentPrice * 100).toFixed(1)}% /年`
      : `向下漂移 = ${((intrinsicPrice - currentPrice) / currentPrice * 100).toFixed(1)}% /年`,
    波动率: `日σ=${volatility.toFixed(5)} = 年σ${(vol30dInput * 100).toFixed(1)}% / √252`,
    日漂移_drift: `+${(drift * 100).toFixed(5)}% /天`,
    均值回归: `每日修正 (intrinsic-price)/intrinsic * 0.002`,
    模拟天数: context.simDays || 252,
  });

  // 模拟
  const tradingDays = context.simDays || 252;
  const priceSeries = [currentPrice];
  const returnSeries = [];
  let price = currentPrice;
  const shockSample = []; // 仅采集前5天扰动做日志

  for (let i = 1; i <= tradingDays; i++) {
    const meanReversion = (intrinsicPrice - price) / intrinsicPrice * 0.002;
    const shock = gaussianRandom() * volatility;
    const dailyReturn = drift + meanReversion + shock;
    price = price * (1 + dailyReturn);
    priceSeries.push(+price.toFixed(2));
    returnSeries.push(+dailyReturn.toFixed(6));
    if (i <= 5) shockSample.push({
      day: i,
      漂移_drift: +(drift * 100).toFixed(4),
      均值回归_mr: +(meanReversion * 100).toFixed(4),
      随机扰动_shock: +(shock * 100).toFixed(4),
      日收益_r: `${(dailyReturn * 100).toFixed(3)}%`,
      价格: `$${price.toFixed(2)}`,
    });
  }

  logger.session('[Quant:Step6][沙盘模拟] 前5日样本(用于核对漂移+扰动+均值回归)', {
    说明: 'dailyReturn = drift + meanReversion + shock；price = price_prev × (1 + dailyReturn)',
    sample: shockSample,
  });

  // 统计指标
  const finalPrice = priceSeries[priceSeries.length - 1];
  const totalReturn = (finalPrice - currentPrice) / currentPrice;
  const mdd = computeMaxDrawdown(priceSeries);
  const meanReturn = returnSeries.reduce((a, b) => a + b, 0) / returnSeries.length;
  const variance = returnSeries.reduce((a, r) => a + (r - meanReturn) ** 2, 0) / returnSeries.length;
  const annualVol = Math.sqrt(variance) * Math.sqrt(252);
  const sharpe = annualVol > 0 ? (meanReturn * 252 - 0.042) / annualVol : 0;
  const sortinoNumerator = meanReturn * 252 - 0.042;
  const downsideReturns = returnSeries.filter(r => r < 0);
  const downsideDev = downsideReturns.length > 0
    ? Math.sqrt(downsideReturns.reduce((a, r) => a + r * r, 0) / downsideReturns.length) * Math.sqrt(252)
    : 0.1;
  const sortino = downsideDev > 0 ? sortinoNumerator / downsideDev : sharpe;
  const winRate = returnSeries.filter(r => r > 0).length / returnSeries.length;
  const var95 = computeVaR(meanReturn * 252, annualVol, 0.95);

  logger.session('[Quant:Step6][沙盘模拟] 统计指标计算过程', {
    样本数_日收益: returnSeries.length,
    日均值r̄: `${(meanReturn * 100).toFixed(5)}%`,
    年化均值: `${(meanReturn * 252 * 100).toFixed(2)}%`,
    年化波动率σ: `${(annualVol * 100).toFixed(2)}%  (标准差×√252)`,
    Sharpe: `(年化均值-4.2%)/σ = ${sharpe.toFixed(3)}`,
    下行波动率: `${(downsideDev * 100).toFixed(2)}% (负收益标准差×√252)`,
    Sortino: `(年化均值-4.2%)/下行σ = ${sortino.toFixed(3)}`,
    胜率: `${(winRate * 100).toFixed(1)}%  (正收益天数/总天数)`,
    最大回撤MDD: `${(mdd * 100).toFixed(2)}% (由ComputeMaxDrawdown计算)`,
    VaR_95: `${(var95 * 100).toFixed(2)}% (由ComputeVaR计算 α=0.95)`,
  });

  checkMaxDrawdown(clamp(1 - mdd, 0, 1));

  const result = {
    simulationDate: Date.now(),
    regime,
    parameters: {
      initialPrice: currentPrice,
      intrinsicPrice,
      dailyVol: volatility,
      dailyDrift: drift,
      meanReversionStrength: 0.002,
      tradingDays,
    },
    priceSeries,
    returnSeries,
    statistics: {
      finalPrice: +finalPrice.toFixed(2),
      totalReturn: +totalReturn.toFixed(4),
      annualizedReturn: +((1 + totalReturn) ** (252 / tradingDays) - 1).toFixed(4),
      maxDrawdown: +mdd.toFixed(4),
      annualVolatility: +annualVol.toFixed(4),
      sharpeRatio: +sharpe.toFixed(3),
      sortinoRatio: +sortino.toFixed(3),
      winRate: +winRate.toFixed(4),
      var95: +var95.toFixed(4),
      calmarRatio: mdd > 0 ? +(((1 + totalReturn) ** (252 / tradingDays) - 1) / mdd).toFixed(3) : 0,
    },
  };

  logger.session('[Quant:Step6][沙盘模拟] ✓ 完成', {
    标的: asset.ticker,
    模拟K线长度: priceSeries.length,
    '开-收盘价': `$${currentPrice.toFixed(2)} -> $${finalPrice.toFixed(2)}`,
    区间收益: `${(totalReturn * 100).toFixed(2)}%`,
    年化收益: `${(((1 + totalReturn) ** (252 / tradingDays) - 1) * 100).toFixed(2)}%`,
    风险指标: {
      MDD: `${(mdd * 100).toFixed(2)}%`,
      σ年化: `${(annualVol * 100).toFixed(2)}%`,
      VaR95: `${(var95 * 100).toFixed(2)}%`,
      Sharpe: sharpe.toFixed(3),
      Sortino: sortino.toFixed(3),
      Calmar: result.statistics.calmarRatio,
      胜率: `${(winRate * 100).toFixed(1)}%`,
    },
    历史关键价位: {
      期间最高点: `$${Math.max(...priceSeries).toFixed(2)} (第${priceSeries.indexOf(Math.max(...priceSeries))}日)`,
      期间最低点: `$${Math.min(...priceSeries).toFixed(2)} (第${priceSeries.indexOf(Math.min(...priceSeries))}日)`,
    },
  });

  auditLogStore.append('quant', 'simulation', {
    ticker: asset.ticker,
    totalReturn: +(totalReturn * 100).toFixed(2),
    maxDrawdown: +(mdd * 100).toFixed(2),
    sharpe: +sharpe.toFixed(2),
  });

  return result;
}

/**
 * Step 7: 人性偏差校验 - 检查理性程度
 */
export function step7_rationalityCheck(simulation = {}, userBehavior = {}) {
  const stats = safeObj(simulation.statistics);
  const maxDD = safeNum(stats.maxDrawdown, 0.3);

  logger.session('[Quant:Step7][人性偏差] ▶ 入口', {
    Step: 7,
    名称: '理性评分 + 偏差加权',
    沙盘统计: {
      胜率: stats.winRate,
      Sharpe: stats.sharpeRatio,
      MDD: stats.maxDrawdown,
    },
    用户传入偏差剖面: Object.keys(userBehavior).length > 0 ? userBehavior : '(未传入，用默认值)',
  });

  // 理性分量
  const winRate = safeNum(userBehavior.winRate, stats.winRate || 0.5);
  const profitFactor = safeNum(userBehavior.profitFactor, 1.5);
  const ddTolerance = clamp(1 - Math.max(0, maxDD - 0.2) / 0.5, 0, 1);
  const sharpeNorm = clamp((safeNum(stats.sharpeRatio, 0.5) + 1) / 3, 0, 1);

  // 偏差剖面
  const lossAversionBias = safeNum(userBehavior.lossAversion, 0.3);
  const overconfidenceBias = safeNum(userBehavior.overconfidence, 0.2);
  const herdingBias = safeNum(userBehavior.herding, 0.15);
  const recencyBias = safeNum(userBehavior.recency, 0.2);
  const biasPenalty = (lossAversionBias + overconfidenceBias + herdingBias + recencyBias) / 4;

  const rationalPositive = winRate * 25 + profitFactor * 20 + ddTolerance * 25 + sharpeNorm * 30;
  const rationalityScore = clamp(rationalPositive * (1 - biasPenalty * 0.5), 0, 100);

  logger.session('[Quant:Step7][人性偏差] 分差明细', {
    正向理性分量: {
      胜率贡献: `winRate(${winRate.toFixed(3)}) × 25 = ${(winRate * 25).toFixed(2)} / 25`,
      盈亏比贡献: `profitFactor(${profitFactor.toFixed(2)}) × 20 = ${(profitFactor * 20).toFixed(2)} / 20 -> clamp到最大20`,
      回撤容忍贡献: `DDTolerance(${ddTolerance.toFixed(3)}) × 25 = ${(ddTolerance * 25).toFixed(2)} / 25  [公式: 1 - max(0, MDD-0.2)/0.5]`,
      Sharpe贡献: `SharpeNorm(${sharpeNorm.toFixed(3)}) × 30 = ${(sharpeNorm * 30).toFixed(2)} / 30  [公式: (Sharpe+1)/3 clamp]`,
      正向合计: `${rationalPositive.toFixed(2)} / 100`,
    },
    偏差惩罚剖面: {
      损失厌恶: lossAversionBias.toFixed(3),
      过度自信: overconfidenceBias.toFixed(3),
      羊群效应: herdingBias.toFixed(3),
      近因偏差: recencyBias.toFixed(3),
      惩罚均值_biasPenalty: `${(biasPenalty * 100).toFixed(1)}%`,
    },
    最终公式: `rationalPositive × (1 - biasPenalty × 0.5) = ${rationalPositive.toFixed(2)} × ${(1 - biasPenalty * 0.5).toFixed(3)} = ${rationalityScore.toFixed(1)}`,
  });

  // 偏差标签
  const biases = [];
  if (lossAversionBias > 0.4) biases.push({ id: 'lossAversion', label: '损失厌恶', severity: lossAversionBias });
  if (overconfidenceBias > 0.4) biases.push({ id: 'overconfidence', label: '过度自信', severity: overconfidenceBias });
  if (herdingBias > 0.4) biases.push({ id: 'herding', label: '羊群效应', severity: herdingBias });
  if (recencyBias > 0.4) biases.push({ id: 'recency', label: '近因偏差', severity: recencyBias });

  const result = {
    rationalityScore: +rationalityScore.toFixed(1),
    biasPenalty: +biasPenalty.toFixed(3),
    biases,
    recommendations: [
      rationalityScore < 50 ? '⚠️ 理性评分偏低，建议降低仓位，等待更明确信号' : null,
      biases.some(b => b.id === 'lossAversion') ? '💡 设置机械止损规则，避免主观情绪干扰' : null,
      biases.some(b => b.id === 'overconfidence') ? '💡 每笔交易前记录三条反面理由' : null,
      maxDD > 0.25 ? '⚠️ 回撤过大，建议减仓 30% 等待回调企稳' : null,
    ].filter(Boolean),
  };

  logger.session('[Quant:Step7][人性偏差] ✓ 完成', {
    理性评分: `${rationalityScore.toFixed(1)}/100  (${rationalityScore >= 70 ? '🟢理性充足' : rationalityScore >= 50 ? '🟡一般' : '🔴非理性'})`,
    偏差数量: `${biases.length}个`,
    识别到的偏差: biases.map(b => `${b.label}(${b.severity.toFixed(2)})`),
    建议条数: result.recommendations.length,
  });

  auditLogStore.append('quant', 'rationality_check', {
    score: result.rationalityScore,
    biasCount: biases.length,
  });

  return result;
}

/**
 * Step 8: 熔断风控对冲 - 最终仓位计算 (强制门控)
 * 核心铁律：必须通过此函数，熔断触发时 actualPosition = 0
 */
export function step8_riskControl(valuation = {}, simulation = {}, rationality = {}, context = {}) {
  const asset = safeObj(context.pipeline?.macroFunnel?.selectedAsset, PRESET_ASSETS[0]);
  const stats = safeObj(simulation.statistics);
  const factors = safeObj(context.pipeline?.factorLibrary);
  const riskFactors = safeObj(factors.riskFactors);

  logger.session('[Quant:Step8][风控门控] ▶ 入口', {
    Step: 8,
    名称: '凯利公式+5重风险约束+熔断门控 (核心铁律)',
    标的: asset.ticker,
    上游输入快照: {
      沙盘统计: {
        winRate: stats.winRate,
        totalReturn: stats.totalReturn,
        MDD: stats.maxDrawdown,
        VaR95: stats.var95,
      },
      估值: {
        upside: valuation.composite?.upside,
      },
      理性评分: rationality.rationalityScore,
      风险因子: {
        coneC: riskFactors.coneC,
        maxDrawdown1y: riskFactors.maxDrawdown1y,
        zScore: riskFactors.zScore,
      },
    },
  });

  // ============ 理论仓位 (凯利公式) ============
  const rawWinRate = clamp(safeNum(stats.winRate, 0.5) + safeNum(rationality.rationalityScore, 50) / 500 - 0.1, 0.3, 0.85);
  const winRate = rawWinRate;
  const profitFactor = Math.max(1.1, (Math.abs(safeNum(stats.totalReturn, 0.1)) || 0.1) * 10);
  logger.session('[Quant:Step8][风控门控] 凯利公式输入', {
    胜率_winRate计算: `沙盘胜率(${safeNum(stats.winRate, 0.5).toFixed(3)}) + 理性/500(${safeNum(rationality.rationalityScore, 50) / 500}) - 0.1 -> clamp到[0.3,0.85] = ${winRate.toFixed(4)}`,
    盈亏比_profitFactor计算: `max(1.1, |沙盘收益(${safeNum(stats.totalReturn, 0.1).toFixed(3)})| × 10) = ${profitFactor.toFixed(3)}`,
  });
  const theoreticalKelly = computeKellyFraction(winRate, profitFactor);
  const halfKelly = theoreticalKelly * 0.5;
  logger.session('[Quant:Step8][风控门控] 凯利-半凯利', {
    '理论凯利_f*': `(b×p - q)/b = (${profitFactor.toFixed(2)} × ${winRate.toFixed(3)} - ${(1 - winRate).toFixed(3)}) / ${profitFactor.toFixed(2)} = ${(theoreticalKelly * 100).toFixed(2)}%`,
    '半凯利(防过拟合)': `${(halfKelly * 100).toFixed(2)}%  = 理论凯利 × 0.5`,
  });

  // ============ 风险约束调整 ============
  let riskAdjusted = halfKelly;
  const adjustChain = [{ stage: '半凯利基线', 仓位: +(riskAdjusted * 100).toFixed(2), 系数: 1, 原因: 'Kelly × 0.5' }];

  // 1. 最大回撤约束
  const mdd = safeNum(stats.maxDrawdown, 0.3);
  const mddLimit = safeNum(riskFactors.maxDrawdown1y, 0.4);
  let mddMul = 1;
  if (mdd > mddLimit * 0.7) {
    mddMul = clamp(1 - (mdd - mddLimit * 0.7) / (mddLimit * 0.3), 0.2, 1);
    riskAdjusted *= mddMul;
  }
  adjustChain.push({
    stage: '①MDD约束',
    仓位: +(riskAdjusted * 100).toFixed(2),
    系数: +mddMul.toFixed(4),
    原因: mddMul < 1
      ? `MDD=${(mdd * 100).toFixed(1)}% > 0.7×阈值(${(mddLimit * 70).toFixed(1)}%)，仓位×${mddMul.toFixed(3)}`
      : 'MDD未触发阈值，×1',
  });

  // 2. VaR 约束
  const var95 = Math.abs(safeNum(stats.var95, 0.03));
  let varMul = 1;
  if (var95 > 0.05) {
    varMul = clamp(0.05 / var95, 0.3, 1);
    riskAdjusted *= varMul;
  }
  adjustChain.push({
    stage: '②VaR约束',
    仓位: +(riskAdjusted * 100).toFixed(2),
    系数: +varMul.toFixed(4),
    原因: varMul < 1
      ? `VaR95=${(var95 * 100).toFixed(2)}% > 5%，仓位×${varMul.toFixed(3)}=clamp(5%/VaR)`
      : 'VaR未超标，×1',
  });

  // 3. 理性评分约束
  const rationalityScore = safeNum(rationality.rationalityScore, 50);
  let ratMul = 1;
  if (rationalityScore < 60) {
    ratMul = clamp(rationalityScore / 60, 0.3, 1);
    riskAdjusted *= ratMul;
  }
  adjustChain.push({
    stage: '③理性约束',
    仓位: +(riskAdjusted * 100).toFixed(2),
    系数: +ratMul.toFixed(4),
    原因: ratMul < 1
      ? `理性${rationalityScore.toFixed(1)}<60，仓位×${ratMul.toFixed(3)}=clamp(分数/60)`
      : '理性≥60，×1',
  });

  // 4. 估值约束 - 追涨杀跌限制
  const upside = safeNum(valuation.composite?.upside, 0);
  let valMul = 1;
  if (upside < 0) {
    valMul = clamp(1 + upside, 0.1, 1);
    riskAdjusted *= valMul;
  }
  adjustChain.push({
    stage: '④估值约束',
    仓位: +(riskAdjusted * 100).toFixed(2),
    系数: +valMul.toFixed(4),
    原因: valMul < 1
      ? `Upside=${(upside * 100).toFixed(1)}%<0（高估），仓位×${valMul.toFixed(3)}=clamp(1+upside)`
      : 'Upside≥0（低估/合理），×1',
  });

  // 5. ConeC 集中度风险约束
  const coneC = safeNum(riskFactors.coneC, 0.4);
  let coneMul = 1;
  if (coneC > 0.7) {
    coneMul = clamp(1 - (coneC - 0.7) * 2, 0.5, 1);
    riskAdjusted *= coneMul;
  }
  adjustChain.push({
    stage: '⑤ConeC约束',
    仓位: +(riskAdjusted * 100).toFixed(2),
    系数: +coneMul.toFixed(4),
    原因: coneMul < 1
      ? `ConeC=${coneC.toFixed(3)}>0.7，仓位×${coneMul.toFixed(3)}`
      : 'ConeC≤0.7，×1',
  });

  logger.session('[Quant:Step8][风控门控] 5重约束链式乘法', {
    说明: '自顶向下逐次乘系数，最终得到riskAdjusted = halfKelly × ① × ② × ③ × ④ × ⑤',
    chain: adjustChain,
    最终风险调整后仓位: `${(riskAdjusted * 100).toFixed(2)}%`,
  });

  // ============ 核心铁律：熔断强制门控 ============
  const fuseActive = isFuseActive();
  let actualPosition = clamp(riskAdjusted, 0, 1);
  let blockedReason = null;

  if (fuseActive) {
    actualPosition = 0;
    blockedReason = '🛑 熔断已触发，强制平仓 (0 仓位)';
    logger.session('[Quant:Step8][风控门控] 熔断强制门控触发 -> 仓位归零');
  }

  // ============ 止盈止损设置 ============
  const currentPrice = safeNum(valuation.perShare?.currentPrice, 100);
  const stopLoss = currentPrice * (1 - Math.min(0.15, mddLimit * 0.5));
  const takeProfit = currentPrice * (1 + Math.max(0.2, Math.abs(safeNum(stats.totalReturn, 0.3)) * 1.5));

  const result = {
    positionCalcDate: Date.now(),
    inputs: {
      winRate: +winRate.toFixed(4),
      profitFactor: +profitFactor.toFixed(3),
      coneC: safeNum(riskFactors.coneC, 0.4),
      zScore: safeNum(riskFactors.zScore, 0),
    },
    positions: {
      theoreticalKelly: +theoreticalKelly.toFixed(4),
      halfKelly: +halfKelly.toFixed(4),
      riskAdjusted: +riskAdjusted.toFixed(4),
      actualPosition: +actualPosition.toFixed(4),
    },
    orders: {
      stopLossPrice: +stopLoss.toFixed(2),
      takeProfitPrice: +takeProfit.toFixed(2),
      positionSize: `${(actualPosition * 100).toFixed(0)}%`,
    },
    hedge: {
      needHedge: coneC > 0.6 || mdd > 0.2,
      hedgeRatio: coneC > 0.6 ? 0.2 : 0,
      instruments: coneC > 0.6 ? ['指数期权PUT', 'VIX看涨'] : [],
    },
    fuse: {
      active: fuseActive,
      blockedReason,
    },
    warnings: [
      !blockedReason && actualPosition < halfKelly * 0.5 ? '⚠️ 风险约束导致仓位远低于凯利建议' : null,
      actualPosition === 0 && !fuseActive ? '⚠️ 风险评分过低，建议空仓观望' : null,
    ].filter(Boolean),
    adjustChain,
  };

  logger.session('[Quant:Step8][风控门控] ✓ 完成', {
    标的: asset.ticker,
    熔断状态: fuseActive ? '🛑已触发' : '✅正常',
    仓位梯队: {
      理论凯利: `${(theoreticalKelly * 100).toFixed(1)}%`,
      半凯利: `${(halfKelly * 100).toFixed(1)}%`,
      风险调整后: `${(riskAdjusted * 100).toFixed(1)}%`,
      最终实际仓位: `🎯 ${(actualPosition * 100).toFixed(1)}%`,
    },
    订单: {
      止损价: `$${stopLoss.toFixed(2)}  = 现价$${currentPrice.toFixed(2)} × (1 - min(0.15, MDD阈值×0.5))`,
      止盈价: `$${takeProfit.toFixed(2)}  = 现价 × (1 + max(0.2, |收益|×1.5))`,
    },
    对冲建议: result.hedge.needHedge
      ? `需对冲 比例${(result.hedge.hedgeRatio * 100).toFixed(0)}% 工具: ${result.hedge.instruments.join('/')}`
      : '无需对冲',
    警告: result.warnings.length > 0 ? result.warnings : '(无)',
  });

  auditLogStore.append('quant', 'risk_control', {
    ticker: asset.ticker,
    theoreticalKelly: +(theoreticalKelly * 100).toFixed(2),
    actualPosition: +(actualPosition * 100).toFixed(2),
    fuseActive,
  });

  return result;
}

/**
 * Step 9-10: 执行下单 + 绩效归因
 */
export function step10_attribution(riskControl = {}, simulation = {}, context = {}) {
  const asset = safeObj(context.pipeline?.macroFunnel?.selectedAsset, PRESET_ASSETS[0]);
  const stats = safeObj(simulation.statistics);
  const position = safeNum(riskControl.positions?.actualPosition, 0);
  const benchmarkReturn = safeNum(context.benchmarkReturn, 0.08);

  logger.session('[Quant:Step10][绩效归因] ▶ 入口', {
    Step: 10,
    名称: 'Brinson归因 + 信息比率',
    标的: asset.ticker,
    上游仓位: `${(position * 100).toFixed(1)}%`,
    沙盘总收益: `${(safeNum(stats.totalReturn, 0) * 100).toFixed(2)}%`,
    年化σ: `${(safeNum(stats.annualVolatility, 0.3) * 100).toFixed(2)}%`,
    基准假设: `${(benchmarkReturn * 100).toFixed(1)}% (大盘指数年化)`,
  });

  const portfolioReturn = safeNum(stats.totalReturn, 0) * position;
  const alpha = portfolioReturn - benchmarkReturn * position;
  const selectionEffect = alpha * 0.6;
  const allocationEffect = alpha * 0.3;
  const interactionEffect = alpha * 0.1;

  logger.session('[Quant:Step10][绩效归因] 归因拆解', {
    组合总收益: `沙盘收益×仓位 = ${(safeNum(stats.totalReturn, 0) * 100).toFixed(2)}% × ${(position * 100).toFixed(0)}% = ${(portfolioReturn * 100).toFixed(2)}%`,
    基准同期收益: `基准${(benchmarkReturn * 100).toFixed(1)}% × 仓位${(position * 100).toFixed(0)}% = ${(benchmarkReturn * position * 100).toFixed(2)}%`,
    超额收益α: `组合 - 基准 = ${(portfolioReturn * 100).toFixed(2)}% - ${(benchmarkReturn * position * 100).toFixed(2)}% = ${(alpha * 100).toFixed(2)}%`,
    Brinson拆解: {
      '选股效应(60%)': `${(selectionEffect * 100).toFixed(2)}% = α × 0.6`,
      '配置效应(30%)': `${(allocationEffect * 100).toFixed(2)}% = α × 0.3`,
      '交互效应(10%)': `${(interactionEffect * 100).toFixed(2)}% = α × 0.1`,
      校验: `三者之和 = ${((selectionEffect + allocationEffect + interactionEffect) * 100).toFixed(2)}% 应 = α ${(alpha * 100).toFixed(2)}%`,
    },
  });

  const annualVol = safeNum(stats.annualVolatility, 0.3);
  const informationRatio = annualVol > 0 ? +(alpha / annualVol).toFixed(3) : 0;
  const trackingError = +(annualVol * 0.3).toFixed(4);

  const result = {
    attributionDate: Date.now(),
    ticker: asset.ticker,
    portfolio: {
      return: +portfolioReturn.toFixed(4),
      position: +position.toFixed(4),
    },
    benchmark: {
      return: benchmarkReturn,
      alpha: +alpha.toFixed(4),
    },
    attribution: {
      selectionEffect: +selectionEffect.toFixed(4),
      allocationEffect: +allocationEffect.toFixed(4),
      interactionEffect: +interactionEffect.toFixed(4),
    },
    riskAdjusted: {
      informationRatio,
      trackingError,
    },
  };

  logger.session('[Quant:Step10][绩效归因] ✓ 完成', {
    标的: asset.ticker,
    组合收益: `${(portfolioReturn * 100).toFixed(2)}%`,
    超额Alpha: `${(alpha * 100).toFixed(2)}%  (${alpha >= 0 ? '🟢跑赢' : '🔴跑输'}基准)`,
    信息比率IR: `α/σ = ${informationRatio}  (${informationRatio >= 0.5 ? '🟢优秀' : informationRatio >= 0 ? '🟡可接受' : '🔴需优化'})`,
    跟踪误差TE: `${(trackingError * 100).toFixed(2)}%`,
  });

  auditLogStore.append('quant', 'attribution', {
    ticker: asset.ticker,
    alpha: +(alpha * 100).toFixed(2),
    informationRatio: result.riskAdjusted.informationRatio,
  });

  return result;
}

// ============================================================
// 十一步一键运行主入口
// ============================================================

/**
 * 执行完整的十一步量化投研闭环
 *
 * @param {object} options
 * @param {string} options.regime - 宏观环境 (RED_OCEAN/BLUE_OCEAN/NEUTRAL)
 * @param {string} options.initialTicker - 指定初始标的代码
 * @param {number} options.simDays - 模拟交易日数量
 * @returns {object} 完整引擎输出
 */
export function runQuantEngine(options = {}) {
  const flow = logger.flow('QuantEngine', '十一步引擎启动', options);
  const context = {
    regime: options.regime || 'NEUTRAL',
    customAssets: options.customAssets,
    marketFactors: options.marketFactors,
    config: {
      initialTicker: options.initialTicker,
      initialTickerName: options.initialTickerName,
      initialTickerIndustry: options.initialTickerIndustry,
      initialTickerMarketCap: options.initialTickerMarketCap,
      initialTickerPE: options.initialTickerPE,
      initialTickerPB: options.initialTickerPB,
      initialTickerGrowth: options.initialTickerGrowth,
      initialTickerFCFYield: options.initialTickerFCFYield,
      initialTickerROE: options.initialTickerROE,
      initialTickerDE: options.initialTickerDE,
      initialTickerGrade: options.initialTickerGrade,
      initialTickerBasePrice: options.initialTickerBasePrice,
      customAssets: options.customAssets,
      marketFactors: options.marketFactors,
    },
    simDays: options.simDays || 252,
    pipeline: {},
  };

  try {
    // Step 0
    const macroFunnel = step0_macroFunnel(context);
    context.pipeline.macroFunnel = macroFunnel;

    // Step 1-2
    const factorLibrary = step2_buildFactorLibrary(macroFunnel.selectedAsset, context);
    context.pipeline.factorLibrary = factorLibrary;

    // Step 3-4
    const valuation = step4_valuation(factorLibrary, context);
    context.pipeline.valuation = valuation;

    // Step 5-6
    const simulation = step6_simulation(factorLibrary, valuation, context);
    context.pipeline.simulation = simulation;

    // Step 7
    const rationality = step7_rationalityCheck(simulation, options.userBehavior || {});
    context.pipeline.rationality = rationality;

    // Step 8 (核心：强制门控)
    const riskControl = step8_riskControl(valuation, simulation, rationality, context);
    context.pipeline.riskControl = riskControl;

    // Step 9-10
    const attribution = step10_attribution(riskControl, simulation, context);

    const output = {
      engineVersion: 'v2.1.0',
      runId: generateId(),
      runAt: Date.now(),
      regime: context.regime,
      pipeline: {
        macroFunnel,
        factorLibrary,
        valuation,
        simulation,
        rationality,
        riskControl,
        attribution,
      },
      summary: {
        ticker: macroFunnel.selectedAsset.ticker,
        name: macroFunnel.selectedAsset.name,
        currentPrice: valuation.perShare.currentPrice,
        intrinsicPrice: valuation.perShare.intrinsicPrice,
        upside: valuation.composite.upside,
        recommendation: getRecommendation(valuation, riskControl, rationality),
        position: riskControl.positions.actualPosition,
        riskLevel: getRiskLevel(factorLibrary.riskFactors, simulation.statistics),
      },
    };

    flow('十一步引擎完成', {
      标的: output.summary.ticker,
      建议: output.summary.recommendation,
      目标仓位: `${(output.summary.position * 100).toFixed(0)}%`,
    });

    return output;
  } catch (e) {
    logger.error('[Quant] 十一步引擎运行异常', e);
    flow('异常终止', e.message);
    throw e;
  }
}

// 辅助：投资建议
function getRecommendation(valuation, riskControl, rationality) {
  const upside = safeNum(valuation.composite?.upside, 0);
  const actualPos = safeNum(riskControl.positions?.actualPosition, 0);
  const fuseActive = riskControl.fuse?.active;

  if (fuseActive) return '🛑 熔断触发：空仓观望';
  if (actualPos === 0) return '⚪ 空仓：风险过高或理性不足';
  if (upside > 0.3 && actualPos > 0.5) return '🟢 强烈买入';
  if (upside > 0.1 && actualPos > 0.3) return '🟢 买入';
  if (upside > -0.1 && actualPos > 0.1) return '🟡 持有';
  if (upside < -0.15) return '🔴 减仓/卖出';
  return '🟡 观望/轻仓';
}

// 辅助：风险等级
function getRiskLevel(riskFactors, stats) {
  const coneC = safeNum(riskFactors?.coneC, 0.4);
  const mdd = safeNum(stats?.maxDrawdown, 0.3);
  const vol = safeNum(stats?.annualVolatility, 0.3);
  const score = (coneC * 30 + mdd * 40 + vol * 30) * 100;

  if (score < 30) return { level: '低风险', color: '#10b981', score: +score.toFixed(0) };
  if (score < 55) return { level: '中风险', color: '#f59e0b', score: +score.toFixed(0) };
  return { level: '高风险', color: '#ef4444', score: +score.toFixed(0) };
}

// ============================================================
// 导出引擎对象
// ============================================================
export const quantEngine = {
  // 配置
  THRESHOLDS,
  STEPS,
  PRESET_ASSETS,
  REGIMES,
  // 核心算法 (金融风险向量精算)
  computeConeC,
  computeKellyFraction,
  computeDCF,
  computeWACC,
  computeZScore,
  computeMaxDrawdown,
  computeVaR,
  // 十一步各阶段
  step0_macroFunnel,
  step2_buildFactorLibrary,
  step4_valuation,
  step6_simulation,
  step7_rationalityCheck,
  step8_riskControl,
  step10_attribution,
  // 主入口
  runQuantEngine,
  getDefaultFactorLibrary,
  // 工具
  generateId,
  gaussianRandom,
  clamp,
  safeNum,
};

export default quantEngine;
