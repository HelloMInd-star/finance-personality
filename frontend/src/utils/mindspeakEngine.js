/**
 * MindSpeak V19.0 - 认知引擎
 *
 * 功能：
 * - 11个语言→数理→算法映射模块
 * - 全局稳态计算（0.35-0.68）
 * - Y.Mine 行为数据联动
 * - 审计日志
 */

import { logger } from './logger';
import { storage } from './storage';

// ============= 11个模块定义 =============

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

// ============= 全局稳态计算 =============

const STEADY_STATE_MIN = 0.35;
const STEADY_STATE_MAX = 0.68;
const STEADY_STATE_DEFAULT = 0.50;

/**
 * 从 Y.Mine 数据计算全局稳态初始值
 * @param {Object} yMineData - Y.Mine 行为数据
 * @returns {number} 稳态值 (0.35-0.68)
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
  return Math.max(STEADY_STATE_MIN, Math.min(STEADY_STATE_MAX, steadyState));
}

/**
 * 更新全局稳态（基于模块置信度变化）
 * @param {number} currentState - 当前稳态
 * @param {Object} moduleConfidences - 各模块置信度
 * @returns {number} 新的稳态值
 */
export function updateSteadyState(currentState, moduleConfidences = {}) {
  const values = Object.values(moduleConfidences);
  if (values.length === 0) return currentState;

  // 计算平均置信度对稳态的拉动
  const avgConfidence = values.reduce((a, b) => a + b, 0) / values.length;
  const pull = (avgConfidence - 0.65) * 0.1;

  let newState = currentState + pull;
  return Math.max(STEADY_STATE_MIN, Math.min(STEADY_STATE_MAX, newState));
}

// ============= 模块置信度计算 =============

/**
 * 根据 Y.Mine 行为数据计算各模块置信度
 * @param {Object} yMineData - Y.Mine 全量数据
 * @returns {Object} 各模块置信度 { moduleId: confidence }
 */
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

      // 行为数据存在时微调置信度
      if (behaviorValue !== null && behaviorValue !== undefined) {
        const normalized = typeof behaviorValue === 'number'
          ? Math.min(1, Math.max(0, behaviorValue / 100))
          : 0.5;
        confidence += (normalized - 0.5) * 0.06;
      }
    }

    confidences[mod.id] = Math.max(0.2, Math.min(0.95, confidence));
  });

  return confidences;
}

// ============= 审计日志 =============

/**
 * 记录 MindSpeak 审计日志
 * @param {string} action - 操作类型
 * @param {Object} details - 操作详情
 */
export function logAudit(action, details = {}) {
  const entry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    action,
    details,
    type: 'mindspeak',
  };

  // 写入 Y.Mine 故事集
  try {
    const data = storage.get();
    const stories = data.stories || [];
    stories.push({
      ...entry,
      title: `认知记录 · ${action}`,
      content: JSON.stringify(details, null, 2),
    });
    storage.update({ stories });
    logger.session(`MindSpeak审计: ${action}`, details);
  } catch (e) {
    logger.error('MindSpeak审计日志写入失败', e);
  }

  return entry;
}

/**
 * 获取 MindSpeak 状态
 */
export function getMindSpeakState() {
  try {
    const data = storage.get();
    return data.mindspeakState || {
      steadyState: STEADY_STATE_DEFAULT,
      moduleConfidences: {},
      emergencyStop: false,
      lastUpdate: null,
    };
  } catch (e) {
    return {
      steadyState: STEADY_STATE_DEFAULT,
      moduleConfidences: {},
      emergencyStop: false,
      lastUpdate: null,
    };
  }
}

/**
 * 保存 MindSpeak 状态
 */
export function saveMindSpeakState(state) {
  try {
    storage.update({
      mindspeakState: {
        ...state,
        lastUpdate: Date.now(),
      },
    });
  } catch (e) {
    logger.error('MindSpeak状态保存失败', e);
  }
}

// ============= 全景矩阵计算 =============

/**
 * 计算模块间的关联矩阵
 * @param {Object} confidences - 各模块置信度
 * @returns {Array} 11x11 关联矩阵
 */
export function calculatePanopticMatrix(confidences = {}) {
  const matrix = [];
  for (let i = 0; i < MODULES.length; i++) {
    const row = [];
    for (let j = 0; j < MODULES.length; j++) {
      if (i === j) {
        row.push(confidences[MODULES[i].id] || 0.5);
      } else {
        // 计算模块间关联度（简化模型：基于数学领域相似度）
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

// ============= 翻译引擎 =============

/**
 * 执行一次完整的认知翻译
 * @param {string} inputText - 输入文本
 * @param {Object} yMineData - Y.Mine 行为数据
 * @returns {Object} 翻译结果
 */
export function translate(inputText, yMineData = {}) {
  const state = getMindSpeakState();
  const confidences = calculateModuleConfidences(yMineData);
  const steadyState = updateSteadyState(state.steadyState, confidences);
  const matrix = calculatePanopticMatrix(confidences);

  // 模拟翻译过程
  const moduleOutputs = MODULES.map((mod) => ({
    moduleId: mod.id,
    moduleName: mod.name,
    confidence: confidences[mod.id] || mod.defaultConfidence,
    active: (confidences[mod.id] || mod.defaultConfidence) > 0.4,
  }));

  const activeModules = moduleOutputs.filter((m) => m.active);
  const avgConfidence = moduleOutputs.reduce((a, b) => a + b.confidence, 0) / moduleOutputs.length;

  const result = {
    input: inputText,
    timestamp: Date.now(),
    steadyState,
    avgConfidence,
    activeCount: activeModules.length,
    totalCount: MODULES.length,
    moduleOutputs,
    panopticMatrix: matrix,
    summary: generateSummary(activeModules, steadyState, avgConfidence),
  };

  // 保存状态和审计
  saveMindSpeakState({ steadyState, moduleConfidences: confidences });
  logAudit('translate', {
    inputLength: inputText?.length || 0,
    activeModules: activeModules.length,
    steadyState,
    avgConfidence,
  });

  return result;
}

function generateSummary(activeModules, steadyState, avgConfidence) {
  const stateLevel = steadyState < 0.45 ? '低稳态' : steadyState > 0.58 ? '高稳态' : '中稳态';
  const confLevel = avgConfidence < 0.55 ? '低置信' : avgConfidence > 0.7 ? '高置信' : '中置信';
  const activeNames = activeModules.slice(0, 5).map((m) => m.moduleName).join('、');

  return `当前处于${stateLevel}状态，${confLevel}翻译。激活 ${activeModules.length}/11 模块：${activeNames}…`;
}

export default {
  MODULES,
  calculateInitialSteadyState,
  updateSteadyState,
  calculateModuleConfidences,
  logAudit,
  getMindSpeakState,
  saveMindSpeakState,
  calculatePanopticMatrix,
  translate,
  STEADY_STATE_MIN,
  STEADY_STATE_MAX,
};
