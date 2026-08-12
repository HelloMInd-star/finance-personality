/**
 * Y.Mine 公司理财引擎 v1.0.0
 *
 * 资本结构理论三剑客 + 公司理财核心能力：
 *  - APV  调整净现值法 (Adjusted Present Value)
 *  - FTE  权益现金流法 (Flow to Equity)
 *  - MM   莫迪利亚尼-米勒定理 (Modigliani-Miller Propositions)
 *  - 最优资本结构 (权衡理论)
 *  - 股利政策 (剩余股利法)
 *  - 并购估值 (协同效应 + 溢价)
 *  - 三方法互验 (APV / FTE / WACC 理论上应给出相同的杠杆企业价值)
 *
 * 理论一致性：
 *   WACC 法、APV 法、FTE 法 三种杠杆企业估值方法在理论上应给出相同结果。
 *   本引擎提供 crossValidateValuation() 用于三方法互验，容差 ±2%。
 *
 * 与 quantEngine.js 的关系：
 *   - quantEngine.computeWACC() 提供 WACC 法估值
 *   - 本文件提供 APV / FTE 两种替代方法
 *   - 三方法互验可作为三角审计的金融侧校验
 */

import { logger } from './logger';
import { auditLogStore } from './storageBus';

// ============================================================
// 内部工具函数（避免与 quantEngine 循环依赖）
// ============================================================
function safeNum(v, def = 0) {
  return typeof v === 'number' && !isNaN(v) ? v : def;
}
function safeArr(v, def = []) {
  return Array.isArray(v) ? v : def;
}
function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, safeNum(v, 0)));
}

/**
 * 现值计算工具：Σ CF_t / (1+r)^t
 */
function presentValue(cashflows, rate) {
  const r = safeNum(rate, 0.08);
  if (r <= -1) return 0;
  return safeArr(cashflows, []).reduce((acc, cf, t) => acc + safeNum(cf, 0) / Math.pow(1 + r, t + 1), 0);
}

// ============================================================
// 一、APV 调整净现值法
// ============================================================

/**
 * APV 调整净现值法 (Adjusted Present Value)
 *
 * 公式：
 *   V_L = V_U + PV(税盾) - PV(财务困境成本) - PV(发行成本)
 *
 * 其中：
 *   V_U = 无杠杆企业价值 = Σ FCF_t / (1+K_0)^t        （K_0 = 无杠杆权益成本）
 *   PV(税盾) = T × D                                    （永续债务假设）
 *            或 Σ (T × D_t × K_d) / (1+K_d)^t          （动态债务）
 *   PV(困境成本) = π × (V_U + PV(税盾)) × 困境损失率    （π = 困境概率）
 *   PV(发行成本) = 直接发行费用
 *
 * 适用场景：
 *   - 项目融资（债务比例随时间变化）
 *   - 杠杆收购 LBO 估值
 *   - 与 WACC 法互验
 *
 * @param {object} params
 * @param {number[]} params.unleveredFCFs - 无杠杆自由现金流 [FCF_1, FCF_2, ...]
 * @param {number} params.costOfCapital - 无杠杆权益成本 K_0
 * @param {number} params.debtAmount - 债务金额 D
 * @param {number} params.costOfDebt - 债务成本 K_d
 * @param {number} params.taxRate - 企业所得税率 T
 * @param {number} [params.distressProbability=0.1] - 财务困境概率 π
 * @param {number} [params.distressCostRate=0.25] - 困境损失率（占企业价值比例）
 * @param {number} [params.issueCosts=0] - 债务发行成本
 * @returns {object} { unleveredValue, taxShieldPV, distressCostPV, issueCostPV, leveredValue, breakdown }
 */
export function computeAPV(params = {}) {
  logger.session('[CorpFin:APV] ▶ 入口', {
    原始输入: params,
    无杠杆FCF序列: params.unleveredFCFs,
    无杠杆权益成本_K0: params.costOfCapital,
    债务金额_D: params.debtAmount,
    债务成本_Kd: params.costOfDebt,
    税率_T: params.taxRate,
  });

  const fcfs = safeArr(params.unleveredFCFs, []);
  const K0 = clamp(safeNum(params.costOfCapital, 0.1), 0.01, 0.5);
  const D = safeNum(params.debtAmount, 0);
  const Kd = clamp(safeNum(params.costOfDebt, 0.05), 0.001, 0.3);
  const T = clamp(safeNum(params.taxRate, 0.21), 0, 0.5);
  const pi = clamp(safeNum(params.distressProbability, 0.1), 0, 1);
  const distressRate = clamp(safeNum(params.distressCostRate, 0.25), 0, 1);
  const issueCosts = safeNum(params.issueCosts, 0);

  if (fcfs.length === 0) {
    logger.session('[CorpFin:APV] ⚠ 空现金流', { 原因: 'unleveredFCFs 为空', 返回: null });
    return null;
  }

  logger.session('[CorpFin:APV] 参数归一化', {
    预测年数: fcfs.length,
    无杠杆权益成本_K0: `${(K0 * 100).toFixed(2)}%`,
    债务金额_D: +D.toFixed(2),
    债务成本_Kd: `${(Kd * 100).toFixed(2)}%`,
    税率_T: `${(T * 100).toFixed(1)}%`,
    困境概率_π: `${(pi * 100).toFixed(1)}%`,
    困境损失率: `${(distressRate * 100).toFixed(1)}%`,
    发行成本: +issueCosts.toFixed(2),
  });

  // 阶段一：无杠杆企业价值 V_U
  const unleveredValue = presentValue(fcfs, K0);
  logger.session('[CorpFin:APV] 阶段一：无杠杆企业价值 V_U', {
    公式: `V_U = Σ FCF_t / (1+K0)^t，K0=${(K0 * 100).toFixed(2)}%`,
    现金流明细: fcfs.map((cf, t) => ({
      年: `Y${t + 1}`,
      FCF: +safeNum(cf, 0).toFixed(4),
      折现因子: `1/(1+${(K0 * 100).toFixed(1)}%)^${t + 1} = ${+(1 / Math.pow(1 + K0, t + 1)).toFixed(5)}`,
      折现值: +(safeNum(cf, 0) / Math.pow(1 + K0, t + 1)).toFixed(4),
    })),
    V_U合计: +unleveredValue.toFixed(4),
  });

  // 阶段二：税盾现值 PV(税盾) = T × D（永续债务假设，MM有税命题I）
  const taxShieldPV = T * D;
  logger.session('[CorpFin:APV] 阶段二：税盾现值', {
    公式: 'PV(税盾) = T × D （永续债务假设）',
    计算: `${T.toFixed(4)} × ${D.toFixed(2)} = ${taxShieldPV.toFixed(4)}`,
    税盾现值: +taxShieldPV.toFixed(4),
    备注: '若债务动态变化，应改为 Σ (T × D_t × Kd) / (1+Kd)^t',
  });

  // 阶段三：财务困境成本现值
  const preDistressValue = unleveredValue + taxShieldPV;
  const distressCostPV = pi * distressRate * preDistressValue;
  logger.session('[CorpFin:APV] 阶段三：财务困境成本', {
    公式: 'PV(困境) = π × 困境损失率 × (V_U + 税盾)',
    税后企业价值_困境前: +preDistressValue.toFixed(4),
    计算: `${(pi * 100).toFixed(1)}% × ${(distressRate * 100).toFixed(1)}% × ${preDistressValue.toFixed(2)}`,
    困境成本现值: +distressCostPV.toFixed(4),
  });

  // 阶段四：发行成本
  const issueCostPV = Math.max(0, issueCosts);
  logger.session('[CorpFin:APV] 阶段四：发行成本', {
    发行成本: +issueCostPV.toFixed(4),
  });

  // 最终：V_L = V_U + 税盾 - 困境成本 - 发行成本
  const leveredValue = unleveredValue + taxShieldPV - distressCostPV - issueCostPV;
  const breakdown = {
    V_U无杠杆价值: +unleveredValue.toFixed(2),
    税盾现值: +taxShieldPV.toFixed(2),
    困境成本现值: +distressCostPV.toFixed(2),
    发行成本: +issueCostPV.toFixed(2),
    V_L杠杆企业价值: +leveredValue.toFixed(2),
    税盾贡献率: leveredValue > 0 ? `${(taxShieldPV / leveredValue * 100).toFixed(2)}%` : '-',
    困境成本占比: leveredValue > 0 ? `${(distressCostPV / leveredValue * 100).toFixed(2)}%` : '-',
  };

  logger.session('[CorpFin:APV] ✓ 完成', {
    ...breakdown,
    最终公式: `V_L = ${unleveredValue.toFixed(2)} + ${taxShieldPV.toFixed(2)} - ${distressCostPV.toFixed(2)} - ${issueCostPV.toFixed(2)} = ${leveredValue.toFixed(2)}`,
    APV解读: leveredValue > unleveredValue ? '杠杆增加价值（税盾收益 > 困境成本）' : '杠杆减损价值（困境成本 > 税盾收益）',
  });

  auditLogStore.append('corpfin', 'apv', {
    V_U: unleveredValue, taxShield: taxShieldPV, distress: distressCostPV, V_L: leveredValue,
  });

  return {
    unleveredValue,
    taxShieldPV,
    distressCostPV,
    issueCostPV,
    leveredValue,
    breakdown,
  };
}

// ============================================================
// 二、FTE 权益现金流法
// ============================================================

/**
 * FTE 权益现金流法 (Flow to Equity)
 *
 * 公式：
 *   V_E = Σ LCF_t / (1+K_E)^t
 *
 * 其中：
 *   LCF (杠杆权益现金流) = FCF - 利息×(1-T) = FCF - D×K_d×(1-T)
 *   K_E = 权益成本（CAPM 或 MM 命题II）
 *
 * 与 APV 的关系：
 *   V_L (APV) = V_E (FTE) + D
 *   即：杠杆企业价值 = 权益价值 + 债务价值
 *
 * 适用场景：
 *   - 资本结构稳定的企业估值
 *   - 银行/金融机构估值（债务是核心业务）
 *   - 与 APV 互验
 *
 * @param {object} params
 * @param {number[]} params.unleveredFCFs - 无杠杆自由现金流 [FCF_1, FCF_2, ...]
 * @param {number} params.costOfEquity - 杠杆权益成本 K_E
 * @param {number} params.debtAmount - 债务金额 D
 * @param {number} params.costOfDebt - 债务成本 K_d
 * @param {number} params.taxRate - 企业所得税率 T
 * @returns {object} { equityValue, leveredValue, leveredFCFs, breakdown }
 */
export function computeFTE(params = {}) {
  logger.session('[CorpFin:FTE] ▶ 入口', {
    原始输入: params,
    无杠杆FCF序列: params.unleveredFCFs,
    权益成本_KE: params.costOfEquity,
    债务金额_D: params.debtAmount,
    债务成本_Kd: params.costOfDebt,
    税率_T: params.taxRate,
  });

  const fcfs = safeArr(params.unleveredFCFs, []);
  const KE = clamp(safeNum(params.costOfEquity, 0.12), 0.01, 0.5);
  const D = safeNum(params.debtAmount, 0);
  const Kd = clamp(safeNum(params.costOfDebt, 0.05), 0.001, 0.3);
  const T = clamp(safeNum(params.taxRate, 0.21), 0, 0.5);

  if (fcfs.length === 0) {
    logger.session('[CorpFin:FTE] ⚠ 空现金流', { 原因: 'unleveredFCFs 为空', 返回: null });
    return null;
  }

  logger.session('[CorpFin:FTE] 参数归一化', {
    预测年数: fcfs.length,
    权益成本_KE: `${(KE * 100).toFixed(2)}%`,
    债务金额_D: +D.toFixed(2),
    债务成本_Kd: `${(Kd * 100).toFixed(2)}%`,
    税率_T: `${(T * 100).toFixed(1)}%`,
  });

  // 阶段一：计算各年杠杆权益现金流 LCF = FCF - D×K_d×(1-T)
  // 假设债务金额 D 在预测期内保持稳定（永续债务假设）
  const afterTaxInterest = D * Kd * (1 - T);
  const leveredFCFs = fcfs.map((fcf, t) => {
    const lcf = safeNum(fcf, 0) - afterTaxInterest;
    return {
      年: `Y${t + 1}`,
      无杠杆FCF: +safeNum(fcf, 0).toFixed(4),
      税后利息: `D×Kd×(1-T) = ${D}×${(Kd * 100).toFixed(2)}%×${(1 - T).toFixed(2)} = ${+afterTaxInterest.toFixed(4)}`,
      杠杆权益现金流_LCF: +lcf.toFixed(4),
    };
  });

  logger.session('[CorpFin:FTE] 阶段一：杠杆权益现金流 LCF', {
    公式: 'LCF = FCF - D×Kd×(1-T)',
    税后利息_每年: +afterTaxInterest.toFixed(4),
    各年明细: leveredFCFs,
  });

  // 阶段二：折现求权益价值 V_E
  const lcfSeries = leveredFCFs.map(item => item.杠杆权益现金流_LCF);
  const equityValue = presentValue(lcfSeries, KE);
  logger.session('[CorpFin:FTE] 阶段二：权益价值折现', {
    公式: `V_E = Σ LCF_t / (1+KE)^t，KE=${(KE * 100).toFixed(2)}%`,
    折现明细: lcfSeries.map((lcf, t) => ({
      年: `Y${t + 1}`,
      LCF: +lcf.toFixed(4),
      折现因子: `1/(1+${(KE * 100).toFixed(1)}%)^${t + 1} = ${+(1 / Math.pow(1 + KE, t + 1)).toFixed(5)}`,
      折现值: +(lcf / Math.pow(1 + KE, t + 1)).toFixed(4),
    })),
    V_E权益价值合计: +equityValue.toFixed(4),
  });

  // 阶段三：杠杆企业价值 V_L = V_E + D
  const leveredValue = equityValue + D;
  const breakdown = {
    V_E权益价值: +equityValue.toFixed(2),
    债务价值_D: +D.toFixed(2),
    V_L杠杆企业价值: +leveredValue.toFixed(2),
    权益占比: leveredValue > 0 ? `${(equityValue / leveredValue * 100).toFixed(2)}%` : '-',
    债务占比: leveredValue > 0 ? `${(D / leveredValue * 100).toFixed(2)}%` : '-',
  };

  logger.session('[CorpFin:FTE] ✓ 完成', {
    ...breakdown,
    最终公式: `V_L = V_E + D = ${equityValue.toFixed(2)} + ${D.toFixed(2)} = ${leveredValue.toFixed(2)}`,
    FTE解读: equityValue > 0 ? '权益价值为正，项目可投资' : '权益价值为负，项目应放弃',
  });

  auditLogStore.append('corpfin', 'fte', { V_E: equityValue, D, V_L: leveredValue });

  return {
    equityValue,
    leveredValue,
    leveredFCFs: leveredFCFs,
    breakdown,
  };
}

// ============================================================
// 三、MM 定理 (Modigliani-Miller Propositions)
// ============================================================

/**
 * MM 定理 - 莫迪利亚尼-米勒资本结构理论
 *
 * 命题I（无税）：V_L = V_U
 *   资本结构与企业价值无关，杠杆不改变企业总价值
 *
 * 命题I（有税）：V_L = V_U + T×D
 *   杠杆企业价值 = 无杠杆价值 + 税盾现值
 *   利息抵税是企业杠杆的唯一收益来源
 *
 * 命题II（无税）：K_E = K_0 + (K_0 - K_d) × (D/E)
 *   权益成本随杠杆线性上升，斜率 = (K_0 - K_d)
 *   WACC 不随杠杆变化（与命题I一致）
 *
 * 命题II（有税）：K_E = K_0 + (K_0 - K_d) × (D/E) × (1-T)
 *   税率降低了权益成本对杠杆的敏感度
 *
 * @param {object} params
 * @param {number} params.unleveredValue - 无杠杆企业价值 V_U
 * @param {number} params.debtValue - 债务价值 D
 * @param {number} params.equityValue - 权益价值 E（杠杆下）
 * @param {number} params.costOfCapital - 无杠杆权益成本 K_0
 * @param {number} params.costOfDebt - 债务成本 K_d
 * @param {number} params.taxRate - 企业所得税率 T
 * @returns {object} MM定理全套推导结果
 */
export function computeMMProposition(params = {}) {
  logger.session('[CorpFin:MM] ▶ 入口', {
    原始输入: params,
    无杠杆价值_VU: params.unleveredValue,
    债务价值_D: params.debtValue,
    权益价值_E: params.equityValue,
    无杠杆权益成本_K0: params.costOfCapital,
    债务成本_Kd: params.costOfDebt,
    税率_T: params.taxRate,
  });

  const V_U = safeNum(params.unleveredValue, 0);
  const D = safeNum(params.debtValue, 0);
  const E = safeNum(params.equityValue, 0);
  const K0 = clamp(safeNum(params.costOfCapital, 0.1), 0.01, 0.5);
  const Kd = clamp(safeNum(params.costOfDebt, 0.05), 0.001, 0.3);
  const T = clamp(safeNum(params.taxRate, 0.21), 0, 0.5);

  const DE = E > 0 ? D / E : 0; // 债务权益比

  logger.session('[CorpFin:MM] 参数归一化', {
    V_U无杠杆价值: +V_U.toFixed(2),
    D债务价值: +D.toFixed(2),
    E权益价值: +E.toFixed(2),
    D_E债务权益比: +DE.toFixed(4),
    K0无杠杆权益成本: `${(K0 * 100).toFixed(2)}%`,
    Kd债务成本: `${(Kd * 100).toFixed(2)}%`,
    T税率: `${(T * 100).toFixed(1)}%`,
  });

  // 命题I（无税）：V_L = V_U
  const propI_noTax = {
    公式: 'V_L = V_U （资本结构无关性）',
    V_L: +V_U.toFixed(2),
    解读: '无税世界下，杠杆不改变企业总价值',
  };

  // 命题I（有税）：V_L = V_U + T×D
  const taxShield = T * D;
  const propI_withTax = {
    公式: `V_L = V_U + T×D = ${V_U.toFixed(2)} + ${T.toFixed(2)}×${D.toFixed(2)}`,
    税盾现值: +taxShield.toFixed(2),
    V_L: +(V_U + taxShield).toFixed(2),
    解读: '杠杆收益 = 税盾现值 = T×D',
  };

  // 命题II（无税）：K_E = K_0 + (K_0 - K_d) × (D/E)
  const KE_noTax = K0 + (K0 - Kd) * DE;
  const propII_noTax = {
    公式: `K_E = K_0 + (K_0 - K_d) × (D/E) = ${(K0 * 100).toFixed(2)}% + (${(K0 * 100).toFixed(2)}% - ${(Kd * 100).toFixed(2)}%) × ${DE.toFixed(4)}`,
    K_E: +KE_noTax.toFixed(6),
    K_E百分比: `${(KE_noTax * 100).toFixed(4)}%`,
    解读: '权益成本随杠杆线性上升，斜率 = (K_0 - K_d)',
  };

  // 命题II（有税）：K_E = K_0 + (K_0 - K_d) × (D/E) × (1-T)
  const KE_withTax = K0 + (K0 - Kd) * DE * (1 - T);
  const propII_withTax = {
    公式: `K_E = K_0 + (K_0 - K_d) × (D/E) × (1-T) = ${(K0 * 100).toFixed(2)}% + (${(K0 * 100).toFixed(2)}% - ${(Kd * 100).toFixed(2)}%) × ${DE.toFixed(4)} × ${(1 - T).toFixed(2)}`,
    K_E: +KE_withTax.toFixed(6),
    K_E百分比: `${(KE_withTax * 100).toFixed(4)}%`,
    解读: '税率降低权益成本对杠杆的敏感度（斜率 × (1-T)）',
  };

  // WACC 验证（无税 vs 有税）
  const V_L_noTax = V_U;
  const V_L_withTax = V_U + taxShield;
  const wacc_noTax = E > 0 && V_L_noTax > 0 ? KE_noTax * (E / V_L_noTax) + Kd * (D / V_L_noTax) : K0;
  const wacc_withTax = E > 0 && V_L_withTax > 0
    ? KE_withTax * (E / V_L_withTax) + Kd * (1 - T) * (D / V_L_withTax)
    : K0;

  logger.session('[CorpFin:MM] ✓ 完成', {
    '命题I_无税': propI_noTax,
    '命题I_有税': propI_withTax,
    '命题II_无税': propII_noTax,
    '命题II_有税': propII_withTax,
    WACC验证: {
      无税WACC: `${(wacc_noTax * 100).toFixed(4)}% （应 = K0 = ${(K0 * 100).toFixed(2)}%，验证命题I一致性）`,
      有税WACC: `${(wacc_withTax * 100).toFixed(4)}% （应 < K0，因税盾降低了加权成本）`,
    },
    理论一致性: 'WACC法、APV法、FTE法在相同假设下应给出相同的 V_L',
  });

  auditLogStore.append('corpfin', 'mm_proposition', {
    V_U, D, E, T, taxShield, V_L_withTax,
  });

  return {
    propositionI: {
      noTax: propI_noTax,
      withTax: propI_withTax,
    },
    propositionII: {
      noTax: propII_noTax,
      withTax: propII_withTax,
    },
    waccVerification: {
      noTax: wacc_noTax,
      withTax: wacc_withTax,
      k0Benchmark: K0,
    },
    taxShieldPV: taxShield,
    leveredValue: V_L_withTax,
  };
}

// ============================================================
// 四、最优资本结构（权衡理论）
// ============================================================

/**
 * 最优资本结构 - 权衡理论 (Trade-off Theory)
 *
 * 公式：
 *   V_L(D) = V_U + T×D - PV(困境成本)(D)
 *   最优 D* 满足 dV_L/dD = 0，即 d(PV困境)/dD = T
 *
 * 困境成本模型：
 *   PV(困境) = π(D) × 困境损失率 × V_L
 *   π(D) = 基础概率 × (1 + α × (D/V_U)^β)  （杠杆越高，困境概率加速上升）
 *
 * 求解方法：在 [0, maxLeverage] 区间网格搜索 V_L 最大的 D
 *
 * @param {object} params
 * @param {number} params.unleveredValue - 无杠杆企业价值 V_U
 * @param {number} params.taxRate - 税率 T
 * @param {number} params.costOfDebt - 债务成本 K_d
 * @param {number} [params.distressCostRate=0.25] - 困境损失率
 * @param {number} [params.baseDistressProbability=0.05] - 基础困境概率
 * @param {number} [params.distressSensitivity=2.0] - 困境概率对杠杆的敏感度 α
 * @param {number} [params.maxLeverage=0.8] - 最大杠杆率 D/V_U
 * @param {number} [params.gridSize=0.01] - 网格搜索步长
 * @returns {object} { optimalD, optimalLeverage, optimalValue, curve, breakdown }
 */
export function optimalCapitalStructure(params = {}) {
  logger.session('[CorpFin:OptCap] ▶ 入口', {
    原始输入: params,
    无杠杆价值_VU: params.unleveredValue,
    税率_T: params.taxRate,
  });

  const V_U = safeNum(params.unleveredValue, 100);
  const T = clamp(safeNum(params.taxRate, 0.21), 0, 0.5);
  const Kd = clamp(safeNum(params.costOfDebt, 0.05), 0.001, 0.3);
  const distressRate = clamp(safeNum(params.distressCostRate, 0.25), 0, 1);
  const basePi = clamp(safeNum(params.baseDistressProbability, 0.05), 0, 1);
  const alpha = safeNum(params.distressSensitivity, 2.0);
  const maxLev = clamp(safeNum(params.maxLeverage, 0.8), 0.1, 1);
  const grid = clamp(safeNum(params.gridSize, 0.01), 0.005, 0.1);

  logger.session('[CorpFin:OptCap] 参数归一化', {
    V_U: +V_U.toFixed(2),
    T税率: `${(T * 100).toFixed(1)}%`,
    Kd债务成本: `${(Kd * 100).toFixed(2)}%`,
    困境损失率: `${(distressRate * 100).toFixed(1)}%`,
    基础困境概率: `${(basePi * 100).toFixed(1)}%`,
    困境敏感度_α: alpha,
    最大杠杆率: `${(maxLev * 100).toFixed(0)}%`,
    网格步长: grid,
  });

  // 网格搜索：遍历 D/V_U 从 0 到 maxLeverage
  const curve = [];
  let optimalD = 0;
  let optimalValue = V_U;
  let optimalIdx = 0;

  for (let i = 0; i * grid <= maxLev; i++) {
    const leverage = i * grid; // D / V_U
    const D = leverage * V_U;
    const taxShield = T * D;
    // 困境概率：π(D) = basePi × (1 + α × leverage^2)
    const pi = basePi * (1 + alpha * leverage * leverage);
    // 困境成本现值
    const distressCost = pi * distressRate * (V_U + taxShield);
    // 杠杆企业价值
    const V_L = V_U + taxShield - distressCost;

    curve.push({
      杠杆率_D_VU: +leverage.toFixed(4),
      债务_D: +D.toFixed(2),
      税盾: +taxShield.toFixed(2),
      困境概率_π: +pi.toFixed(4),
      困境成本: +distressCost.toFixed(2),
      V_L: +V_L.toFixed(2),
      价值增量: +(V_L - V_U).toFixed(2),
    });

    if (V_L > optimalValue) {
      optimalValue = V_L;
      optimalD = D;
      optimalIdx = i;
    }
  }

  const optimalLeverage = optimalD / V_U;
  const taxShieldAtOptimal = T * optimalD;
  const piAtOptimal = basePi * (1 + alpha * optimalLeverage * optimalLeverage);
  const distressAtOptimal = piAtOptimal * distressRate * (V_U + taxShieldAtOptimal);

  const breakdown = {
    V_U无杠杆价值: +V_U.toFixed(2),
    最优债务_Dstar: +optimalD.toFixed(2),
    最优杠杆率: `${(optimalLeverage * 100).toFixed(2)}%`,
    最优企业价值_VLstar: +optimalValue.toFixed(2),
    价值增量: +(optimalValue - V_U).toFixed(2),
    最优税盾: +taxShieldAtOptimal.toFixed(2),
    最优困境成本: +distressAtOptimal.toFixed(2),
    最优困境概率: `${(piAtOptimal * 100).toFixed(2)}%`,
  };

  logger.session('[CorpFin:OptCap] 权衡曲线关键节点', {
    网格点数: curve.length,
    无杠杆点: curve[0],
    最优点: curve[optimalIdx],
    最大杠杆点: curve[curve.length - 1],
  });
  logger.session('[CorpFin:OptCap] ✓ 完成', {
    ...breakdown,
    理论解读: optimalD > 0
      ? `存在最优杠杆 ${(optimalLeverage * 100).toFixed(1)}%，税盾边际收益 = 困境边际成本`
      : '无最优杠杆（税盾收益始终 < 困境成本），应全权益融资',
    决策建议: optimalLeverage < 0.1 ? '建议全权益融资' :
               optimalLeverage < 0.3 ? '保守杠杆' :
               optimalLeverage < 0.5 ? '适中杠杆' : '激进杠杆',
  });

  auditLogStore.append('corpfin', 'optimal_capital', {
    V_U, D_star: optimalD, leverage: optimalLeverage, V_L: optimalValue,
  });

  return {
    optimalD,
    optimalLeverage,
    optimalValue,
    curve,
    breakdown,
  };
}

// ============================================================
// 五、股利政策（剩余股利法）
// ============================================================

/**
 * 股利政策 - 剩余股利法 (Residual Dividend Policy)
 *
 * 理论：企业应优先满足投资需求（NPV>0 项目），剩余利润再作为股利发放。
 *
 * 公式：
 *   所需权益融资 = (资本支出 + 营运资本增加) × 目标权益比例
 *   股利 = 净利润 - 所需权益融资
 *
 * 决策规则：
 *   - 股利 > 0：发放股利
 *   - 股利 < 0：不发放股利，需外部权益融资
 *   - 股利 = 0：刚好满足投资需求
 *
 * @param {object} params
 * @param {number} params.netIncome - 净利润
 * @param {number} params.capex - 资本支出
 * @param {number} params.workingCapitalChange - 营运资本增加额
 * @param {number} params.targetEquityRatio - 目标权益比例（0-1）
 * @returns {object} { dividend, payoutRatio, externalFinancingNeeded, breakdown }
 */
export function dividendPolicy(params = {}) {
  logger.session('[CorpFin:Dividend] ▶ 入口', {
    原始输入: params,
    净利润: params.netIncome,
    资本支出: params.capex,
    营运资本增加: params.workingCapitalChange,
    目标权益比例: params.targetEquityRatio,
  });

  const NI = safeNum(params.netIncome, 0);
  const capex = safeNum(params.capex, 0);
  const deltaNWC = safeNum(params.workingCapitalChange, 0);
  const targetE = clamp(safeNum(params.targetEquityRatio, 0.6), 0, 1);

  logger.session('[CorpFin:Dividend] 参数归一化', {
    净利润_NI: +NI.toFixed(2),
    资本支出_Capex: +capex.toFixed(2),
    营运资本增加_ΔNWC: +deltaNWC.toFixed(2),
    目标权益比例: `${(targetE * 100).toFixed(1)}%`,
  });

  // 总投资需求
  const totalInvestment = capex + deltaNWC;
  // 所需权益融资
  const equityFinancingNeeded = totalInvestment * targetE;
  // 剩余股利
  const dividend = NI - equityFinancingNeeded;
  // 股利支付率
  const payoutRatio = NI > 0 ? dividend / NI : 0;
  // 是否需要外部融资
  const externalFinancingNeeded = dividend < 0 ? Math.abs(dividend) : 0;

  const breakdown = {
    净利润: +NI.toFixed(2),
    总投资需求: +totalInvestment.toFixed(2),
    所需权益融资: +equityFinancingNeeded.toFixed(2),
    剩余股利: +dividend.toFixed(2),
    股利支付率: `${(payoutRatio * 100).toFixed(2)}%`,
    外部融资需求: +externalFinancingNeeded.toFixed(2),
  };

  logger.session('[CorpFin:Dividend] ✓ 完成', {
    ...breakdown,
    计算式: `股利 = NI - (Capex + ΔNWC) × 目标权益比例 = ${NI.toFixed(2)} - ${totalInvestment.toFixed(2)} × ${(targetE * 100).toFixed(0)}% = ${dividend.toFixed(2)}`,
    决策: dividend > 0 ? `发放股利 ${dividend.toFixed(2)}` :
          dividend === 0 ? '不发放股利，刚好满足投资' :
          `不发放股利，需外部权益融资 ${externalFinancingNeeded.toFixed(2)}`,
    政策解读: payoutRatio > 0.6 ? '高股利支付率（成熟期企业）' :
              payoutRatio > 0.3 ? '适中股利支付率' :
              payoutRatio > 0 ? '低股利支付率（成长期企业）' : '零股利（高速扩张期）',
  });

  auditLogStore.append('corpfin', 'dividend_policy', {
    NI, dividend, payoutRatio, external: externalFinancingNeeded,
  });

  return {
    dividend,
    payoutRatio,
    externalFinancingNeeded,
    breakdown,
  };
}

// ============================================================
// 六、并购估值（协同效应 + 溢价）
// ============================================================

/**
 * 并购估值 - 协同效应与收购溢价分析
 *
 * 公式：
 *   V_combined = V_A + V_T + Synergy
 *   Synergy = 收入协同 + 成本协同 + 税务协同
 *   溢价 = 收购价 - V_T（目标独立价值）
 *   并购 NPV = Synergy - 溢价
 *
 * @param {object} params
 * @param {number} params.acquirerValue - 收购方独立价值 V_A
 * @param {number} params.targetValue - 目标方独立价值 V_T
 * @param {number} [params.revenueSynergy=0] - 收入协同现值
 * @param {number} [params.costSynergy=0] - 成本协同现值
 * @param {number} [params.taxSynergy=0] - 税务协同现值（如净经营损失结转）
 * @param {number} [params.acquisitionPrice] - 实际收购价（默认 = V_T）
 * @param {number} [params.integrationCost=0] - 整合成本
 * @returns {object} { combinedValue, totalSynergy, premium, dealNPV, breakdown }
 */
export function mergerValuation(params = {}) {
  logger.session('[CorpFin:M&A] ▶ 入口', {
    原始输入: params,
    收购方价值_VA: params.acquirerValue,
    目标方价值_VT: params.targetValue,
    收入协同: params.revenueSynergy,
    成本协同: params.costSynergy,
    税务协同: params.taxSynergy,
  });

  const V_A = safeNum(params.acquirerValue, 0);
  const V_T = safeNum(params.targetValue, 0);
  const revSyn = safeNum(params.revenueSynergy, 0);
  const costSyn = safeNum(params.costSynergy, 0);
  const taxSyn = safeNum(params.taxSynergy, 0);
  const acqPrice = safeNum(params.acquisitionPrice, V_T);
  const integrationCost = safeNum(params.integrationCost, 0);

  logger.session('[CorpFin:M&A] 参数归一化', {
    V_A收购方价值: +V_A.toFixed(2),
    V_T目标方价值: +V_T.toFixed(2),
    收入协同: +revSyn.toFixed(2),
    成本协同: +costSyn.toFixed(2),
    税务协同: +taxSyn.toFixed(2),
    收购价: +acqPrice.toFixed(2),
    整合成本: +integrationCost.toFixed(2),
  });

  // 协同效应总值
  const totalSynergy = revSyn + costSyn + taxSyn;
  // 合并后企业价值（扣除整合成本）
  const combinedValue = V_A + V_T + totalSynergy - integrationCost;
  // 收购溢价 = 收购价 - 目标独立价值
  const premium = acqPrice - V_T;
  const premiumRate = V_T > 0 ? premium / V_T : 0;
  // 并购 NPV = 协同效应 - 溢价 - 整合成本
  const dealNPV = totalSynergy - premium - integrationCost;

  const breakdown = {
    V_A收购方价值: +V_A.toFixed(2),
    V_T目标方价值: +V_T.toFixed(2),
    协同效应_收入: +revSyn.toFixed(2),
    协同效应_成本: +costSyn.toFixed(2),
    协同效应_税务: +taxSyn.toFixed(2),
    协同效应_合计: +totalSynergy.toFixed(2),
    整合成本: +integrationCost.toFixed(2),
    V_combined合并价值: +combinedValue.toFixed(2),
    收购溢价: +premium.toFixed(2),
    溢价率: `${(premiumRate * 100).toFixed(2)}%`,
    并购NPV: +dealNPV.toFixed(2),
  };

  logger.session('[CorpFin:M&A] ✓ 完成', {
    ...breakdown,
    协同公式: `Synergy = 收入协同 + 成本协同 + 税务协同 = ${revSyn.toFixed(2)} + ${costSyn.toFixed(2)} + ${taxSyn.toFixed(2)} = ${totalSynergy.toFixed(2)}`,
    合并价值公式: `V_combined = V_A + V_T + Synergy - 整合成本 = ${V_A.toFixed(2)} + ${V_T.toFixed(2)} + ${totalSynergy.toFixed(2)} - ${integrationCost.toFixed(2)} = ${combinedValue.toFixed(2)}`,
    并购NPV公式: `NPV = Synergy - 溢价 - 整合成本 = ${totalSynergy.toFixed(2)} - ${premium.toFixed(2)} - ${integrationCost.toFixed(2)} = ${dealNPV.toFixed(2)}`,
    决策: dealNPV > 0
      ? `✓ 并购创造价值 ${dealNPV.toFixed(2)}（协同 > 溢价 + 整合成本）`
      : `✗ 并购减损价值 ${Math.abs(dealNPV).toFixed(2)}（溢价/整合成本 > 协同）`,
    溢价合理性: premiumRate > 0.5 ? '溢价过高（>50%），需谨慎' :
                premiumRate > 0.3 ? '溢价较高（30-50%）' :
                premiumRate > 0.1 ? '溢价合理（10-30%）' :
                premiumRate >= 0 ? '溢价较低（<10%）' : '折价收购',
  });

  auditLogStore.append('corpfin', 'merger_valuation', {
    V_A, V_T, synergy: totalSynergy, premium, dealNPV,
  });

  return {
    combinedValue,
    totalSynergy,
    premium,
    premiumRate,
    dealNPV,
    breakdown,
  };
}

// ============================================================
// 七、三方法互验（APV / FTE / WACC）
// ============================================================

/**
 * 杠杆企业估值三方法互验
 *
 * 理论：WACC 法、APV 法、FTE 法 在相同假设下应给出相同的 V_L。
 *   - WACC 法：V_L = Σ FCF / (1+WACC)^t
 *   - APV 法：V_L = V_U + 税盾 - 困境成本
 *   - FTE 法：V_L = V_E + D = Σ LCF / (1+K_E)^t + D
 *
 * 容差：±2%（与三角审计 ±0.02 一致）
 *
 * @param {object} params
 * @param {number[]} params.unleveredFCFs - 无杠杆自由现金流
 * @param {number} params.costOfCapital - 无杠杆权益成本 K_0
 * @param {number} params.costOfEquity - 杠杆权益成本 K_E
 * @param {number} params.wacc - 加权平均资本成本
 * @param {number} params.debtAmount - 债务金额 D
 * @param {number} params.costOfDebt - 债务成本 K_d
 * @param {number} params.taxRate - 税率 T
 * @returns {object} { waccValue, apvValue, fteValue, consistency, verdict }
 */
export function crossValidateValuation(params = {}) {
  logger.session('[CorpFin:CrossVal] ▶ 入口', {
    原始输入: params,
    说明: 'APV / FTE / WACC 三方法应给出相同的杠杆企业价值 V_L',
  });

  const fcfs = safeArr(params.unleveredFCFs, []);
  const K0 = clamp(safeNum(params.costOfCapital, 0.1), 0.01, 0.5);
  const KE = clamp(safeNum(params.costOfEquity, 0.12), 0.01, 0.5);
  const WACC = clamp(safeNum(params.wacc, 0.08), 0.01, 0.5);
  const D = safeNum(params.debtAmount, 0);
  const Kd = clamp(safeNum(params.costOfDebt, 0.05), 0.001, 0.3);
  const T = clamp(safeNum(params.taxRate, 0.21), 0, 0.5);

  if (fcfs.length === 0) {
    logger.session('[CorpFin:CrossVal] ⚠ 空现金流', { 返回: null });
    return null;
  }

  // WACC 法
  const waccValue = presentValue(fcfs, WACC);

  // APV 法（无困境成本，纯 MM 有税）
  const V_U = presentValue(fcfs, K0);
  const apvValue = V_U + T * D;

  // FTE 法
  const afterTaxInterest = D * Kd * (1 - T);
  const lcfSeries = fcfs.map(fcf => safeNum(fcf, 0) - afterTaxInterest);
  const fteEquity = presentValue(lcfSeries, KE);
  const fteValue = fteEquity + D;

  // 一致性检验（±2%）
  const values = [waccValue, apvValue, fteValue];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const deviations = values.map(v => Math.abs(v - mean) / Math.max(0.01, Math.abs(mean)));
  const maxDeviation = Math.max(...deviations);
  const isConsistent = maxDeviation <= 0.02;

  const result = {
    waccValue: +waccValue.toFixed(4),
    apvValue: +apvValue.toFixed(4),
    fteValue: +fteValue.toFixed(4),
    平均值: +mean.toFixed(4),
    最大偏差: `${(maxDeviation * 100).toFixed(4)}%`,
    容差: '±2%',
    consistency: isConsistent,
    verdict: isConsistent
      ? '✓ 三方法一致（偏差 ≤ 2%），杠杆企业估值可信'
      : `✗ 三方法不一致（最大偏差 ${ (maxDeviation * 100).toFixed(2) }% > 2%），需检查假设一致性`,
    各方法偏差: {
      WACC法: `${(deviations[0] * 100).toFixed(4)}%`,
      APV法: `${(deviations[1] * 100).toFixed(4)}%`,
      FTE法: `${(deviations[2] * 100).toFixed(4)}%`,
    },
  };

  logger.session('[CorpFin:CrossVal] 三方法计算结果', {
    WACC法_VL: result.waccValue,
    APV法_VL: result.apvValue,
    FTE法_VL: result.fteValue,
    平均值: result.平均值,
  });
  logger.session('[CorpFin:CrossVal] ✓ 完成', result);

  auditLogStore.append('corpfin', 'cross_validate', {
    wacc: waccValue, apv: apvValue, fte: fteValue,
    maxDeviation, consistent: isConsistent,
  });

  return result;
}

// ============================================================
// 模块导出
// ============================================================
export default {
  computeAPV,
  computeFTE,
  computeMMProposition,
  optimalCapitalStructure,
  dividendPolicy,
  mergerValuation,
  crossValidateValuation,
};
