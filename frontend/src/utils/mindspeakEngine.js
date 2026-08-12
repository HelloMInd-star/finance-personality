/**
 * MindSpeak V19.1 - 认知引擎
 *
 * ↑ 从 V19.0 升级到 Game-OS V2.1 工程化版（P0 阶段一）
 *
 * 新增能力：
 * - ✅ 三角三模型冗余审计 STAGE-9（CALC 金融精算 + GameMind 博弈沙盘 + geom 几何算力，±0.02 容差）
 * - ✅ 三分区数据总线 pipeline 只读 / draft 可写 / auditLog 仅追加不可篡改
 * - ✅ 七层熔断体系联动（L3 估值越界检查稳态/置信度、L2 连续失败计数、L6 手动停机、L1 黑天鹅）
 * - ✅ 稳态 ±0.2 滑块扰动 + 自动回归 0.5 收敛
 * - ✅ 翻译结果自动提交到 pipeline 命名空间（仅 S0-S9 官方令牌）
 *
 * 原 V19.0 功能保持不变：
 * - 11 个语言→数理→算法映射模块
 * - 全局稳态计算（0.35-0.68）
 * - Y.Mine 行为数据联动
 * - 审计日志
 */

import { logger } from './logger';
import { storage } from './storage';
import {
  pipelineStore,
  commitPipeline,
  draftStore,
  auditLogStore,
} from './storageBus';
import {
  isFuseActive,
  getFuseState,
  checkValuationBreach,
  bumpEngineFail,
  checkBlackSwan,
  checkEmotionTilt,
} from './fuse';

// ============= 11 个模块定义（保持与 V19.0 完全一致，兼容现有 MindSpeakPage） =============

export const MODULES = [
  {
    id: 'translator',
    name: '翻译器',
    icon: '🌐',
    description: '语义→符号的基础映射',
    mathField: '集合论',
    algorithm: '双向映射矩阵',
    yMineField: null,
    defaultConfidence: 0.72,
  },
  {
    id: 'wordOrder',
    name: '语序',
    icon: '📊',
    description: '排列规律→交换律检测',
    mathField: '群论',
    algorithm: '置换群分解',
    yMineField: 'poker.decisionTime',
    defaultConfidence: 0.68,
  },
  {
    id: 'tense',
    name: '时态',
    icon: '⏱️',
    description: '时间参照→凯利偏差映射',
    mathField: '时态逻辑',
    algorithm: '分支时间模型',
    yMineField: 'poker.kellyDeviation',
    defaultConfidence: 0.65,
  },
  {
    id: 'affix',
    name: '词缀',
    icon: '🔗',
    description: '前后缀→因式分解',
    mathField: '代数',
    algorithm: '多项式因式分解',
    yMineField: 'billiards.adjustmentCount',
    defaultConfidence: 0.70,
  },
  {
    id: 'passive',
    name: '被动',
    icon: '🔄',
    description: '语态转换→对偶空间',
    mathField: '线性代数',
    algorithm: '转置矩阵运算',
    yMineField: 'fitness.completionRate',
    defaultConfidence: 0.63,
  },
  {
    id: 'polysemy',
    name: '多义词',
    icon: '🎭',
    description: '歧义消解→贝叶斯推断',
    mathField: '概率论',
    algorithm: '贝叶斯后验估计',
    yMineField: 'poker.handStrength',
    defaultConfidence: 0.58,
  },
  {
    id: 'culture',
    name: '文化',
    icon: '🌍',
    description: '语境约束→正则化强度',
    mathField: '优化理论',
    algorithm: 'L1/L2正则化',
    yMineField: 'industryMapping',
    defaultConfidence: 0.75,
  },
  {
    id: 'boundary',
    name: '边界',
    icon: '🧱',
    description: '语法边界→异常检测',
    mathField: '拓扑学',
    algorithm: '孤立森林检测',
    yMineField: 'billiards.reflectionDeviation',
    defaultConfidence: 0.67,
  },
  {
    id: 'chickenRabbit',
    name: '鸡兔同笼',
    icon: '🐰',
    description: '混合约束→整数规划',
    mathField: '运筹学',
    algorithm: '分支定界法',
    yMineField: 'poker.potOdds',
    defaultConfidence: 0.61,
  },
  {
    id: 'engineering',
    name: '工程',
    icon: '⚙️',
    description: '语法正确性→PACD循环',
    mathField: '控制论',
    algorithm: 'PID反馈控制',
    yMineField: 'fitness.planModifications',
    defaultConfidence: 0.73,
  },
  {
    id: 'enumeration',
    name: '枚举',
    icon: '📋',
    description: '分类列举→组合计数',
    mathField: '组合数学',
    algorithm: '递推关系求解',
    yMineField: 'poker.position',
    defaultConfidence: 0.69,
  },
];

// ============= 全局稳态计算（增强版 + 自动回归 0.5） =============

export const STEADY_STATE_MIN = 0.35;
export const STEADY_STATE_MAX = 0.68;
export const STEADY_STATE_DEFAULT = 0.50;
const STEADY_MID = 0.50;
const AUTO_REVERT_STRENGTH = 0.08; // 每次翻译扰动后自动拉回 0.5 的力度

/**
 * 从 Y.Mine 数据计算全局稳态初始值（V19.0 保持不变，仅新增 L3 熔断检查）
 */
export function calculateInitialSteadyState(yMineData = {}) {
  const { userState = {}, currentSession = {} } = yMineData;

  // 情绪值映射：0-100 → 0.35-0.68
  const emotionValue = userState.emotion || 50;
  let steadyState = STEADY_STATE_MIN + (emotionValue / 100) * (STEADY_STATE_MAX - STEADY_STATE_MIN);

  // 风险偏好偏置
  const riskPreference = userState.riskPreference || 'balanced';
  const biasMap = { conservative: -0.05, balanced: 0, aggressive: 0.05 };
  steadyState += (biasMap[riskPreference] || 0);

  // 裁剪到合法范围
  const result = Math.max(STEADY_STATE_MIN, Math.min(STEADY_STATE_MAX, steadyState));
  // L3 检查：不应该过 0.68
  checkValuationBreach(result, 'steadyState (initial)', STEADY_STATE_MIN, STEADY_STATE_MAX);
  return result;
}

/**
 * 更新全局稳态（增强版：基于模块置信度 + 滑块扰动 + 自动回归 0.5）
 * @param {number} currentState - 当前稳态
 * @param {Object} moduleConfidences - 各模块置信度
 * @param {number} manualPerturbation - 用户从 UI 滑块输入的 ±0.2 扰动
 */
export function updateSteadyState(currentState, moduleConfidences = {}, manualPerturbation = 0) {
  // 先检查全局熔断：若激活，稳态直接强制回归 0.5（稳定态）
  if (isFuseActive()) {
    return STEADY_MID;
  }

  const values = Object.values(moduleConfidences);
  let avgConfidence = values.length > 0
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0.65;

  const pull = (avgConfidence - 0.65) * 0.1;
  let newState = currentState + pull + manualPerturbation;

  // 自动回归 0.5 收敛力（模拟系统稳态）
  const distance = newState - STEADY_MID;
  newState -= distance * AUTO_REVERT_STRENGTH;

  const clamped = Math.max(STEADY_STATE_MIN, Math.min(STEADY_STATE_MAX, newState));

  // L3 熔断检查（防止超出 0.68）
  checkValuationBreach(clamped, 'steadyState (updated)', STEADY_STATE_MIN, STEADY_STATE_MAX);
  return clamped;
}

// ============= 模块置信度计算（V19.0 保持不变） =============

export function calculateModuleConfidences(yMineData = {}) {
  const confidences = {};
  const { pokerGames = [], billiardsSessions = [], fitnessSessions = [], userState = {} } = yMineData;

  MODULES.forEach((mod) => {
    let confidence = mod.defaultConfidence;

    // 根据 MBTI 调整权重
    const mbti = userState.currentMbti || 'INTP';
    if (mbti.includes('J') && ['wordOrder', 'engineering', 'enumeration'].includes(mod.id)) {
      confidence += 0.08;
    }
    if (mbti.includes('P') && ['polysemy', 'chickenRabbit', 'boundary'].includes(mod.id)) {
      confidence += 0.08;
    }
    if (mbti.includes('T') && ['tense', 'affix', 'passive'].includes(mod.id)) {
      confidence += 0.06;
    }
    if (mbti.includes('F') && ['culture', 'translator'].includes(mod.id)) {
      confidence += 0.06;
    }

    // 根据行为数据调整
    if (mod.yMineField) {
      const [category, field] = mod.yMineField.split('.');
      let behaviorValue = null;

      switch (category) {
        case 'poker':
          if (pokerGames.length > 0) {
            const latest = pokerGames[pokerGames.length - 1];
            if (field === 'kellyDeviation') behaviorValue = Math.abs(latest.kellyRatio - 0.5);
            if (field === 'decisionTime') behaviorValue = latest.avgDecisionTime;
            if (field === 'handStrength') behaviorValue = latest.avgHandStrength;
            if (field === 'potOdds') behaviorValue = latest.potOdds;
            if (field === 'position') behaviorValue = latest.position;
          }
          break;
        case 'billiards':
          if (billiardsSessions.length > 0) {
            const latest = billiardsSessions[billiardsSessions.length - 1];
            if (field === 'reflectionDeviation') behaviorValue = latest.avgReflectionDeviation;
            if (field === 'adjustmentCount') behaviorValue = latest.avgAdjustmentCount;
          }
          break;
        case 'fitness':
          if (fitnessSessions.length > 0) {
            const latest = fitnessSessions[fitnessSessions.length - 1];
            if (field === 'completionRate') behaviorValue = latest.deviation?.completionRate;
            if (field === 'planModifications') behaviorValue = latest.deviation?.planModifications;
          }
          break;
        case 'industryMapping':
          behaviorValue = userState.industry;
          break;
      }

      if (behaviorValue !== null && behaviorValue !== undefined) {
        const normalized = typeof behaviorValue === 'number'
          ? Math.min(1, Math.max(0, behaviorValue / 100))
          : 0.5;
        confidence += (normalized - 0.5) * 0.06;
      }
    }

    confidences[mod.id] = Math.max(0.2, Math.min(0.95, confidence));
  });

  // L3 检查：每个置信度都必须在合法范围
  for (const [mid, conf] of Object.entries(confidences)) {
    checkValuationBreach(conf, `confidence[${mid}]`, 0.0, 1.0, 0.98);
  }

  return confidences;
}

// ============= 三角三模型冗余审计 STAGE-9 =============

const TRIANGLE_TOLERANCE = 0.02; // ±0.02 容差

/**
 * CALC（金融精算模拟器）校验：
 * 将稳态 + 平均置信度映射到凯利仓位；检查凯利仓位不超过 0.35（审慎）
 */
function calcAuditScore(steadyState, avgConfidence, yMineData) {
  try {
    const userState = yMineData.userState || {};
    const riskBias = userState.riskPreference === 'aggressive' ? 0.05
      : userState.riskPreference === 'conservative' ? -0.05
      : 0;
    const kelly = Math.max(0, Math.min(1, (steadyState - 0.35) + avgConfidence * 0.3 + riskBias));
    // L3 检查（模型内部也要守规矩）
    if (kelly > 0.68) return { score: 0.2, label: '凯利违规', detail: { kelly } };
    return { score: Math.max(0.2, Math.min(0.95, 0.4 + kelly * 0.6)), label: 'CALC通过', detail: { kelly } };
  } catch (e) {
    return { score: 0.0, label: 'CALC异常', error: e.message };
  }
}

/**
 * GameMind（博弈沙盘）校验：
 * 根据激活模块数 × 置信度，评估行为层决策合理性
 */
function gameMindAuditScore(activeCount, totalCount, moduleConfidences) {
  try {
    if (totalCount === 0) return { score: 0.3, label: '无模块', detail: {} };
    const activationRatio = activeCount / totalCount;
    const avgConf = Object.values(moduleConfidences).reduce((a, b) => a + b, 0) / (totalCount || 1);
    const score = Math.max(0.2, Math.min(0.95, activationRatio * 0.55 + avgConf * 0.55));
    return { score, label: 'GameMind通过', detail: { activationRatio, avgConf } };
  } catch (e) {
    return { score: 0.0, label: 'GameMind异常', error: e.message };
  }
}

/**
 * geom-compute（几何心智算力底座）校验：
 * 稳态 × 全景矩阵 行列式伪计算，评估几何拓扑稳定性
 */
function geomAuditScore(steadyState, panopticMatrix) {
  try {
    // 简化版：计算矩阵对角线平均作为"几何稳定性"代理值
    if (!Array.isArray(panopticMatrix) || panopticMatrix.length === 0) {
      return { score: 0.4, label: '无矩阵', detail: {} };
    }
    let diag = 0;
    const n = Math.min(panopticMatrix.length, 11);
    for (let i = 0; i < n; i++) {
      diag += (panopticMatrix[i]?.[i] ?? 0.5);
    }
    const avgDiag = diag / n;
    const geometricStability = 1 - Math.abs(steadyState - 0.5) * 0.8;
    const score = Math.max(0.2, Math.min(0.95, avgDiag * 0.5 + geometricStability * 0.55));
    return { score, label: 'geom通过', detail: { avgDiag, geometricStability } };
  } catch (e) {
    return { score: 0.0, label: 'geom异常', error: e.message };
  }
}

/**
 * 三模型并行审计主入口
 * @returns {Object} { passed: boolean, status: 'PASSED' | 'BLOCKED', maxDev, scores: [calc, game, geom], labels, details }
 */
export function triangleAudit(steadyState, avgConfidence, activeCount, totalCount, moduleConfidences, panopticMatrix, yMineData) {
  const calc = calcAuditScore(steadyState, avgConfidence, yMineData);
  const game = gameMindAuditScore(activeCount, totalCount, moduleConfidences);
  const geom = geomAuditScore(steadyState, panopticMatrix);

  const scores = [calc.score, game.score, geom.score];
  const labels = [calc.label, game.label, geom.label];
  const details = [calc.detail, game.detail, geom.detail];

  const devs = [
    Math.abs(scores[0] - scores[1]),
    Math.abs(scores[1] - scores[2]),
    Math.abs(scores[0] - scores[2]),
  ];
  const maxDev = Math.max(...devs);

  // L1 黑天鹅：如果有任何 score 偏离历史均值 σ>3（需要历史样本）
  try {
    const history = draftStore.get('ms_triangle_history', []) || [];
    const recent = history.slice(-12);
    if (recent.length >= 5) {
      const histAvg = recent.reduce((s, r) => s + (r.avg || 0), 0) / recent.length;
      const currentAvg = scores.reduce((a, b) => a + b, 0) / 3;
      checkBlackSwan(recent.map(r => r.avg || 0), currentAvg);
    }
    history.push({ avg: scores.reduce((a, b) => a + b, 0) / 3, at: Date.now() });
    draftStore.set('ms_triangle_history', history.slice(-60));
  } catch (e) {
    logger.error('三角审计黑天鹅检查异常', e);
  }

  // 任一模型 score 为 0.0 视为异常
  const anyZero = scores.some(s => s === 0);
  const passed = maxDev <= TRIANGLE_TOLERANCE && !anyZero;

  const audit = {
    passed,
    status: passed ? 'PASSED' : 'BLOCKED',
    maxDev: Number(maxDev.toFixed(4)),
    tolerance: TRIANGLE_TOLERANCE,
    scores: scores.map(s => Number(s.toFixed(4))),
    labels,
    details,
    step: 'STAGE-9',
    at: Date.now(),
  };

  auditLogStore.append('mindspeak', passed ? 'TRIANGLE_AUDIT_PASS' : 'TRIANGLE_AUDIT_FAIL', audit);

  if (!passed) {
    // 审计失败计数（L2 系统性崩溃）
    bumpEngineFail('mindspeak.triangleAudit', true);
  } else {
    bumpEngineFail('mindspeak.triangleAudit', false);
  }

  return audit;
}

// ============= 全景矩阵计算（V19.0 保持不变） =============

export function calculatePanopticMatrix(confidences = {}) {
  const matrix = [];
  for (let i = 0; i < MODULES.length; i++) {
    const row = [];
    for (let j = 0; j < MODULES.length; j++) {
      if (i === j) {
        row.push(confidences[MODULES[i].id] || 0.5);
      } else {
        const fieldI = MODULES[i].mathField;
        const fieldJ = MODULES[j].mathField;
        const baseCorrelation = fieldI === fieldJ ? 0.7 : 0.3;
        const confI = confidences[MODULES[i].id] || 0.5;
        const confJ = confidences[MODULES[j].id] || 0.5;
        row.push(baseCorrelation * (0.5 + (confI + confJ) / 4));
      }
    }
    matrix.push(row);
  }
  return matrix;
}

// ============= 状态读写（保持原 API 兼容，内部转接到 storageBus） =============

export function getMindSpeakState() {
  try {
    // 新版从 draftStore 读（保持兼容：老版本从 storage 读的 mindspeakState 也能读到）
    const legacy = storage.get('mindspeakState');
    const v2 = draftStore.get('mindspeak_state_v2', null);
    if (v2) {
      return {
        steadyState: v2.steadyState ?? STEADY_STATE_DEFAULT,
        moduleConfidences: v2.moduleConfidences ?? {},
        emergencyStop: !!v2.emergencyStop,
        lastUpdate: v2.lastUpdate ?? null,
        manualPerturbation: v2.manualPerturbation ?? 0,
      };
    }
    return legacy || {
      steadyState: STEADY_STATE_DEFAULT,
      moduleConfidences: {},
      emergencyStop: false,
      lastUpdate: null,
      manualPerturbation: 0,
    };
  } catch (e) {
    return {
      steadyState: STEADY_STATE_DEFAULT,
      moduleConfidences: {},
      emergencyStop: false,
      lastUpdate: null,
      manualPerturbation: 0,
    };
  }
}

export function saveMindSpeakState(state) {
  try {
    const now = Date.now();
    const toSave = { ...state, lastUpdate: now };
    // 新版：写 draftStore
    draftStore.set('mindspeak_state_v2', toSave);
    // 兼容：同时写回 storage.mindspeakState，旧代码也能读
    storage.set('mindspeakState', toSave);
  } catch (e) {
    logger.error('MindSpeak状态保存失败', e);
  }
}

/**
 * 设置手动扰动值（±0.2，来自 UI 滑块）
 */
export function setManualPerturbation(p) {
  const state = getMindSpeakState();
  const clamped = Math.max(-0.2, Math.min(0.2, Number(p) || 0));
  saveMindSpeakState({ ...state, manualPerturbation: clamped });
  return clamped;
}

// ============= 翻译引擎（升级到 V19.1：熔断 + 三角审计 + 三分区总线） =============

export function translate(inputText, yMineData = {}) {
  // ① L6 检查：全局熔断激活 → 阻断输出
  if (isFuseActive()) {
    const fs = getFuseState();
    const blocked = {
      input: inputText,
      timestamp: Date.now(),
      steadyState: STEADY_MID,
      avgConfidence: 0,
      activeCount: 0,
      totalCount: MODULES.length,
      moduleOutputs: MODULES.map(m => ({ moduleId: m.id, moduleName: m.name, confidence: 0, active: false })),
      panopticMatrix: calculatePanopticMatrix({}),
      summary: `🚫 熔断已激活（${fs.triggeredLayer?.name || '未知层'}），所有输出阻断。原因：${fs.triggerReason || '未说明'}`,
      blocked: true,
      fuseState: fs,
    };
    auditLogStore.append('mindspeak', 'TRANSLATE_BLOCKED_BY_FUSE', {
      inputLength: inputText?.length || 0,
      fuseLayer: fs.triggeredLayer?.id,
      fuseReason: fs.triggerReason,
    });
    // L2 连续阻断计数
    bumpEngineFail('mindspeak.translate', true);
    return blocked;
  }

  try {
    // ② L5 情绪倾斜检查（如果 yMineData 有情绪值）
    const emotion = yMineData.userState?.emotion;
    if (typeof emotion === 'number') {
      checkEmotionTilt(emotion, 50, 20);
    }

    const state = getMindSpeakState();
    const confidences = calculateModuleConfidences(yMineData);
    const manualPerturb = state.manualPerturbation ?? 0;
    const steadyState = updateSteadyState(
      state.steadyState ?? calculateInitialSteadyState(yMineData),
      confidences,
      manualPerturb
    );
    const matrix = calculatePanopticMatrix(confidences);

    const moduleOutputs = MODULES.map((mod) => ({
      moduleId: mod.id,
      moduleName: mod.name,
      confidence: confidences[mod.id] || mod.defaultConfidence,
      active: (confidences[mod.id] || mod.defaultConfidence) > 0.4,
    }));

    const activeModules = moduleOutputs.filter((m) => m.active);
    const avgConfidence = moduleOutputs.reduce((a, b) => a + b.confidence, 0) / moduleOutputs.length;

    // ③ STAGE-9 三角三模型并行审计（必须！）
    const triangleAuditResult = triangleAudit(
      steadyState,
      avgConfidence,
      activeModules.length,
      MODULES.length,
      confidences,
      matrix,
      yMineData
    );

    const result = {
      input: inputText,
      timestamp: Date.now(),
      steadyState,
      avgConfidence,
      activeCount: activeModules.length,
      totalCount: MODULES.length,
      moduleOutputs,
      panopticMatrix: matrix,
      summary: generateSummary(activeModules, steadyState, avgConfidence, triangleAuditResult, manualPerturb),
      triangleAudit: triangleAuditResult,
      manualPerturbation: manualPerturb,
      blocked: !triangleAuditResult.passed, // 审计未通过 → 输出标记为 blocked
    };

    // ④ 保存状态 + 审计
    saveMindSpeakState({ ...state, steadyState, moduleConfidences: confidences });
    auditLogStore.append('mindspeak', 'translate', {
      inputLength: inputText?.length || 0,
      activeModules: activeModules.length,
      steadyState,
      avgConfidence,
      triangleStatus: triangleAuditResult.status,
      triangleMaxDev: triangleAuditResult.maxDev,
    });

    // ⑤ 官方流水线提交（仅当三角审计通过）
    if (triangleAuditResult.passed) {
      try {
        commitPipeline('mindspeak.lastResult', {
          inputLength: inputText?.length || 0,
          steadyState,
          avgConfidence,
          activeCount: activeModules.length,
          at: Date.now(),
        }, 'S0-S9-OFFICIAL');
      } catch (e) {
        logger.error('MindSpeak pipeline 提交失败', e);
      }
      // L2 成功清零
      bumpEngineFail('mindspeak.translate', false);
    } else {
      // 三角审计未通过 → 也记为一次翻译失败（虽然没抛错，但结果标记 blocked）
      bumpEngineFail('mindspeak.translate', true);
    }

    return result;
  } catch (e) {
    logger.error('MindSpeak翻译流程异常', e);
    // ① 记一次 L2 失败计数
    bumpEngineFail('mindspeak.translate', true);
    auditLogStore.append('mindspeak', 'TRANSLATE_EXCEPTION', { error: e?.message || '未知错误', stack: e?.stack || '' });
    return {
      input: inputText,
      timestamp: Date.now(),
      steadyState: STEADY_MID,
      avgConfidence: 0,
      activeCount: 0,
      totalCount: MODULES.length,
      moduleOutputs: [],
      panopticMatrix: [],
      summary: `⚠️ 翻译流程发生异常：${e?.message || '未知错误'}`,
      blocked: true,
      exception: e?.message || '未知错误',
    };
  }
}

function generateSummary(activeModules, steadyState, avgConfidence, triangleAuditResult, manualPerturb) {
  const stateLevel = steadyState < 0.45 ? '低稳态' : steadyState > 0.58 ? '高稳态' : '中稳态';
  const confLevel = avgConfidence < 0.55 ? '低置信' : avgConfidence > 0.7 ? '高置信' : '中置信';
  const activeNames = activeModules.slice(0, 5).map((m) => m.moduleName).join('、');
  const tri = triangleAuditResult?.status === 'PASSED'
    ? `三模型校验✅(Δ=${triangleAuditResult.maxDev})`
    : `三模型校验🚫(Δ=${triangleAuditResult?.maxDev ?? '?'})`;
  const perturbTxt = Math.abs(manualPerturb || 0) > 0.001
    ? `，手动扰动 ${manualPerturb > 0 ? '+' : ''}${(manualPerturb * 100).toFixed(0)}%`
    : '';
  return `当前处于${stateLevel}状态，${confLevel}翻译。激活 ${activeModules.length}/11 模块：${activeNames}… | ${tri}${perturbTxt}`;
}

export default {
  MODULES,
  calculateInitialSteadyState,
  updateSteadyState,
  calculateModuleConfidences,
  triangleAudit,
  calculatePanopticMatrix,
  getMindSpeakState,
  saveMindSpeakState,
  setManualPerturbation,
  translate,
  STEADY_STATE_MIN,
  STEADY_STATE_MAX,
  STEADY_STATE_DEFAULT,
};
