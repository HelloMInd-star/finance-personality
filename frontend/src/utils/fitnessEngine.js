/**
 * 健身计划引擎
 *
 * 功能：
 * - 训练计划模板生成
 * - 执行偏差检测
 * - 偏离类型识别
 * - 心情盘生成
 * - 行为金融映射
 */

import { logger } from './logger';

// ============= 训练类型 =============

export const TRAINING_TYPES = {
  strength: {
    key: 'strength',
    label: '力量',
    icon: '🏋️',
    color: '#e74c3c',
    desc: '重量训练，长期收益',
    defaultExercises: [
      { name: '卧推', sets: 4, repsPerSet: 8, weight: 60 },
      { name: '深蹲', sets: 4, repsPerSet: 10, weight: 80 },
      { name: '硬拉', sets: 3, repsPerSet: 8, weight: 100 },
    ],
    defaultIntensity: 75,
    riskLevel: 'high',     // 高风险
    timePreference: 'long'  // 长期
  },
  cardio: {
    key: 'cardio',
    label: '有氧',
    icon: '🏃',
    color: '#3498db',
    desc: '心肺训练，短期见效',
    defaultExercises: [
      { name: '跑步机', sets: 1, repsPerSet: [30], weight: 0, duration: 30 },
      { name: '椭圆机', sets: 1, repsPerSet: [20], weight: 0, duration: 20 },
    ],
    defaultIntensity: 60,
    riskLevel: 'low',
    timePreference: 'short'
  },
  flexibility: {
    key: 'flexibility',
    label: '柔韧',
    icon: '🧘',
    color: '#2ecc71',
    desc: '拉伸恢复，低强度',
    defaultExercises: [
      { name: '动态拉伸', sets: 1, repsPerSet: [10], weight: 0, duration: 10 },
      { name: '瑜伽体式', sets: 3, repsPerSet: [5], weight: 0, duration: 15 },
      { name: '静态拉伸', sets: 1, repsPerSet: [8], weight: 0, duration: 10 },
    ],
    defaultIntensity: 35,
    riskLevel: 'low',
    timePreference: 'balanced'
  },
  hybrid: {
    key: 'hybrid',
    label: '综合',
    icon: '🔄',
    color: '#9b59b6',
    desc: '混合训练，均衡发展',
    defaultExercises: [
      { name: '开合跳', sets: 3, repsPerSet: [20], weight: 0 },
      { name: '俯卧撑', sets: 3, repsPerSet: [12], weight: 0 },
      { name: '深蹲跳', sets: 3, repsPerSet: [10], weight: 0 },
      { name: '平板支撑', sets: 3, repsPerSet: [1], weight: 0, duration: 45 },
    ],
    defaultIntensity: 65,
    riskLevel: 'medium',
    timePreference: 'balanced'
  }
};

// 疲劳度选项
export const FATIGUE_LEVELS = [
  { key: 'low', label: '轻松', color: '#52c41a', factor: 1.0 },
  { key: 'medium', label: '中等', color: '#faad14', factor: 0.85 },
  { key: 'high', label: '较高', color: '#fa8c16', factor: 0.7 },
  { key: 'exhausted', label: '筋疲力尽', color: '#eb2f96', factor: 0.5 },
];

// ============= 计划生成 =============

/**
 * 根据训练类型生成默认计划
 */
export function generatePlan(trainingType) {
  const type = TRAINING_TYPES[trainingType];
  if (!type) return null;

  return {
    exercises: type.defaultExercises.map(e => ({
      ...e,
      restInterval: 60
    })),
    targetIntensity: type.defaultIntensity,
    restInterval: 60
  };
}

// ============= 偏差检测 =============

/**
 * 计算执行偏差
 */
export function calculateDeviation(plan, execution, modifications) {
  if (!plan || !execution) {
    return { completionRate: 0, deviationType: 'none', planModifications: 0 };
  }

  const totalSets = plan.exercises.reduce((sum, e) => sum + e.sets, 0);
  const completedSets = execution.completedSets || 0;

  // 完成率
  let completionRate = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  // 考虑实际完成次数 vs 计划次数
  if (execution.actualReps && execution.actualReps.length > 0) {
    let plannedReps = 0;
    let actualReps = 0;
    plan.exercises.forEach(ex => {
      plannedReps += ex.sets * (ex.repsPerSet?.[0] || 10);
    });
    actualReps = execution.actualReps.reduce((a, b) => a + b, 0);
    if (plannedReps > 0) {
      completionRate = Math.min(100, (actualReps / plannedReps) * 100);
    }
  }

  // 偏离类型判断
  let deviationType = 'none';
  const planMods = modifications || 0;

  if (completionRate >= 95 && planMods === 0) {
    deviationType = 'none'; // 完全按计划
  } else if (completionRate < 60) {
    deviationType = 'early_end'; // 提前结束
  } else if (completionRate >= 110) {
    deviationType = 'extended'; // 延长/加量
  } else if (planMods > 0 && completionRate < 90) {
    deviationType = 'reduced_intensity'; // 降低强度
  } else if (planMods > 0 && completionRate >= 100) {
    deviationType = 'increased_intensity'; // 增加强度
  } else if (completionRate < 90) {
    deviationType = 'reduced_intensity';
  }

  logger.session('健身-偏差检测', {
    完成率: completionRate.toFixed(1) + '%',
    偏离类型: deviationType,
    计划修改次数: planMods
  });

  return {
    completionRate: +completionRate.toFixed(1),
    deviationType,
    planModifications: planMods
  };
}

// ============= 标签生成 =============

/**
 * 根据完成率生成偏差标签
 */
export function generateDeviationTag(completionRate, intensity) {
  let label, personality, industry;

  // 基于完成率
  if (completionRate >= 90) {
    label = '纪律型执行者';
    personality = '高J（计划型）';
    industry = '金融（稳定型）';
  } else if (completionRate >= 70) {
    label = '执行有波动';
    personality = '平衡型';
    industry = '消费（均衡型）';
  } else {
    label = '计划执行不稳定';
    personality = '高P（随性型）';
    industry = '科技（高波动型）';
  }

  // 基于强度调整行业
  if (intensity >= 80) {
    industry = industry === '金融' ? '能源' : industry;
  } else if (intensity <= 40) {
    industry = industry === '科技' ? '消费' : industry;
  }

  return { label, personality, industry };
}

// ============= 心情盘生成 =============

/**
 * 生成健身心情盘数据
 */
export function generateFitnessMood(sessionData) {
  const { plan, execution, deviation, trainingType, fatigue } = sessionData;

  // 基础情绪
  let mood = 50;

  // 完成率影响
  if (deviation?.completionRate) {
    mood += (deviation.completionRate - 60) * 0.5; // 60%→0, 100%→+20
  }

  // 自我驱动（超额完成）
  if (deviation?.deviationType === 'extended' || deviation?.deviationType === 'increased_intensity') {
    mood += 15;
  }

  // 疲劳度影响
  const fatigueLevel = fatigue || 'medium';
  const fatigueFactor = FATIGUE_LEVELS.find(f => f.key === fatigueLevel)?.factor || 0.85;
  mood = 50 + (mood - 50) * fatigueFactor;

  // 波动率
  const volatility = 0.03 + (deviation?.planModifications || 0) * 0.01
    + (100 - (deviation?.completionRate || 50)) * 0.002;

  // 行业映射
  const typeInfo = TRAINING_TYPES[trainingType];
  let industry = typeInfo?.riskLevel === 'high' ? '能源'
    : typeInfo?.riskLevel === 'low' ? '金融' : '消费';

  if (deviation?.completionRate < 70) industry = '科技';

  const totalSets = plan?.exercises?.reduce((s, e) => s + e.sets, 0) || 0;
  const completedSets = execution?.completedSets || 0;

  const trend = deviation?.completionRate >= 85 ? 'stable'
    : deviation?.completionRate >= 65 ? 'improving' : 'worsening';

  logger.session('健身心情盘生成', {
    训练类型: trainingType,
    完成率: deviation?.completionRate,
    情绪: mood.toFixed(0),
    行业: industry
  });

  return {
    mood: Math.max(0, Math.min(100, Math.round(mood))),
    volatility: +volatility.toFixed(4),
    industry,
    totalSets,
    completedSets,
    completionRate: deviation?.completionRate || 0,
    deviationType: deviation?.deviationType || 'none',
    planModifications: deviation?.planModifications || 0,
    intensity: plan?.targetIntensity || 50,
    fatigue: fatigueLevel,
    trend,
    summary: `${typeInfo?.label || ''}训练 · ${completedSets}/${totalSets}组 · 完成${(deviation?.completionRate || 0).toFixed(0)}%`
  };
}

// ============= 会话记录创建 =============

export function createFitnessSession(data) {
  return {
    sessionId: Date.now().toString(),
    timestamp: Date.now(),
    trainingType: data.trainingType || 'strength',
    plan: data.plan || null,
    execution: data.execution || null,
    deviation: data.deviation || null,
    mood: data.mood || null,
    fatigue: data.fatigue || 'medium'
  };
}

export const fitnessEngine = {
  generatePlan,
  calculateDeviation,
  generateDeviationTag,
  generateFitnessMood,
  createFitnessSession
};
