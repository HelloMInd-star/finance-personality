/**
 * 培养方案引擎单元测试
 *
 * 核心验证：
 * 1. 阶段判定逻辑（determinePhase）
 * 2. 阶段进度追踪（calculatePhaseProgress）
 * 3. 会话总数计算（calculateTotalSessions）
 * 4. 六维能力分数计算（calculateDimensionScores）- 对数递减版本
 * 5. 薄弱项识别（identifyWeakDimensions）
 * 6. 分层提升建议（getImprovementSuggestion）
 * 7. 智能今日任务生成（generateTodayTasks）- 与薄弱项联动
 */

import {
  determinePhase,
  calculatePhaseProgress,
  calculateTotalSessions,
  calculateDimensionScores,
  identifyWeakDimensions,
  generateTodayTasks,
  getImprovementSuggestion,
  PHASE_CONFIG,
  PHASE_THRESHOLDS,
  DIMENSION_KEYS,
  WEAK_DIMENSION_THRESHOLD,
  SCORE_CONFIG,
} from '../cultivationEngine.js';

// ============================================================
// 阶段判定测试
// ============================================================
describe('determinePhase - 阶段判定逻辑', () => {

  test('0 次训练 → 基础期 (foundation)', () => {
    const result = determinePhase(0);
    expect(result.key).toBe('foundation');
    expect(result.label).toBe('基础期');
  });

  test('5 次训练 → 基础期 (foundation)', () => {
    const result = determinePhase(5);
    expect(result.key).toBe('foundation');
  });

  test('9 次训练 → 基础期 (foundation)', () => {
    const result = determinePhase(9);
    expect(result.key).toBe('foundation');
  });

  test('边界值：10 次训练 → 强化期 (enhance)', () => {
    const result = determinePhase(10);
    expect(result.key).toBe('enhance');
    expect(result.label).toBe('强化期');
  });

  test('15 次训练 → 强化期 (enhance)', () => {
    const result = determinePhase(15);
    expect(result.key).toBe('enhance');
  });

  test('29 次训练 → 强化期 (enhance)', () => {
    const result = determinePhase(29);
    expect(result.key).toBe('enhance');
  });

  test('边界值：30 次训练 → 精通期 (master)', () => {
    const result = determinePhase(30);
    expect(result.key).toBe('master');
    expect(result.label).toBe('精通期');
  });

  test('50 次训练 → 精通期 (master)', () => {
    const result = determinePhase(50);
    expect(result.key).toBe('master');
  });

  test('100 次训练 → 精通期 (master)', () => {
    const result = determinePhase(100);
    expect(result.key).toBe('master');
  });

  test('负数输入 → 基础期 (foundation)', () => {
    const result = determinePhase(-5);
    expect(result.key).toBe('foundation');
  });

  test('null 输入 → 基础期 (foundation)', () => {
    const result = determinePhase(null);
    expect(result.key).toBe('foundation');
  });

  test('undefined 输入 → 基础期 (foundation)', () => {
    const result = determinePhase(undefined);
    expect(result.key).toBe('foundation');
  });

  test('非数字输入（字符串）→ 基础期 (foundation)', () => {
    const result = determinePhase('10');
    expect(result.key).toBe('foundation');
  });

  test('返回的阶段对象应包含完整信息（含 unlocks）', () => {
    const result = determinePhase(0);
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('label');
    expect(result).toHaveProperty('duration');
    expect(result).toHaveProperty('desc');
    expect(result).toHaveProperty('unlocks');
    expect(Array.isArray(result.unlocks)).toBe(true);
  });

  test('PHASE_CONFIG 应有 3 个阶段，每个都有 unlocks', () => {
    expect(PHASE_CONFIG.length).toBe(3);
    PHASE_CONFIG.forEach(phase => {
      expect(phase.unlocks).toBeDefined();
      expect(phase.unlocks.length).toBeGreaterThan(0);
    });
  });

  test('阈值常量应正确定义', () => {
    expect(PHASE_THRESHOLDS.foundation_max).toBe(10);
    expect(PHASE_THRESHOLDS.enhance_max).toBe(30);
  });

  test('全范围覆盖测试：0-100 每个数字都返回正确阶段', () => {
    for (let i = 0; i <= 100; i++) {
      const result = determinePhase(i);
      if (i < 10) {
        expect(result.key).toBe('foundation');
      } else if (i < 30) {
        expect(result.key).toBe('enhance');
      } else {
        expect(result.key).toBe('master');
      }
    }
  });
});

// ============================================================
// 阶段进度追踪测试
// ============================================================
describe('calculatePhaseProgress - 阶段进度追踪', () => {

  test('0 次训练 → 基础期 0% 进度，还需 10 次', () => {
    const progress = calculatePhaseProgress(0);
    expect(progress.currentPhase.key).toBe('foundation');
    expect(progress.nextPhase.key).toBe('enhance');
    expect(progress.currentProgress).toBe(0);
    expect(progress.sessionsNeeded).toBe(10);
    expect(progress.isFinalPhase).toBe(false);
  });

  test('5 次训练 → 基础期 50% 进度，还需 5 次', () => {
    const progress = calculatePhaseProgress(5);
    expect(progress.currentPhase.key).toBe('foundation');
    expect(progress.currentProgress).toBe(50);
    expect(progress.sessionsNeeded).toBe(5);
  });

  test('9 次训练 → 基础期 90% 进度，还需 1 次', () => {
    const progress = calculatePhaseProgress(9);
    expect(progress.currentPhase.key).toBe('foundation');
    expect(progress.currentProgress).toBe(90);
    expect(progress.sessionsNeeded).toBe(1);
  });

  test('10 次训练 → 强化期 0% 进度，还需 20 次', () => {
    const progress = calculatePhaseProgress(10);
    expect(progress.currentPhase.key).toBe('enhance');
    expect(progress.nextPhase.key).toBe('master');
    expect(progress.currentProgress).toBe(0);
    expect(progress.sessionsNeeded).toBe(20);
    expect(progress.isFinalPhase).toBe(false);
  });

  test('20 次训练 → 强化期 50% 进度，还需 10 次', () => {
    const progress = calculatePhaseProgress(20);
    expect(progress.currentPhase.key).toBe('enhance');
    expect(progress.currentProgress).toBe(50);
    expect(progress.sessionsNeeded).toBe(10);
  });

  test('29 次训练 → 强化期 95% 进度，还需 1 次', () => {
    const progress = calculatePhaseProgress(29);
    expect(progress.currentPhase.key).toBe('enhance');
    expect(progress.currentProgress).toBe(95);
    expect(progress.sessionsNeeded).toBe(1);
  });

  test('30 次训练 → 精通期，最终阶段', () => {
    const progress = calculatePhaseProgress(30);
    expect(progress.currentPhase.key).toBe('master');
    expect(progress.nextPhase).toBeNull();
    expect(progress.currentProgress).toBe(100);
    expect(progress.sessionsNeeded).toBe(0);
    expect(progress.isFinalPhase).toBe(true);
  });

  test('100 次训练 → 精通期，进度保持 100%', () => {
    const progress = calculatePhaseProgress(100);
    expect(progress.currentPhase.key).toBe('master');
    expect(progress.currentProgress).toBe(100);
    expect(progress.isFinalPhase).toBe(true);
  });

  test('null 输入 → 基础期 0%', () => {
    const progress = calculatePhaseProgress(null);
    expect(progress.currentPhase.key).toBe('foundation');
    expect(progress.currentProgress).toBe(0);
  });

  test('应包含所有必要字段', () => {
    const progress = calculatePhaseProgress(5);
    expect(progress).toHaveProperty('currentPhase');
    expect(progress).toHaveProperty('nextPhase');
    expect(progress).toHaveProperty('currentProgress');
    expect(progress).toHaveProperty('sessionsNeeded');
    expect(progress).toHaveProperty('isFinalPhase');
  });
});

// ============================================================
// 会话总数计算测试
// ============================================================
describe('calculateTotalSessions - 会话总数计算', () => {

  test('空数据 → 0 次', () => {
    const result = calculateTotalSessions({});
    expect(result).toBe(0);
  });

  test('null 数据 → 0 次', () => {
    const result = calculateTotalSessions(null);
    expect(result).toBe(0);
  });

  test('undefined 数据 → 0 次', () => {
    const result = calculateTotalSessions(undefined);
    expect(result).toBe(0);
  });

  test('5 场德州 + 3 场台球 + 2 次健身 + 4 次调酒 = 14 次', () => {
    const data = {
      pokerGames: new Array(5).fill({}),
      billiardsGames: new Array(3).fill({}),
      fitnessSessions: new Array(2).fill({}),
      bartenderSessions: new Array(4).fill({}),
    };
    const result = calculateTotalSessions(data);
    expect(result).toBe(14);
  });

  test('部分数组缺失时不会报错', () => {
    const data = {
      pokerGames: new Array(3).fill({}),
    };
    const result = calculateTotalSessions(data);
    expect(result).toBe(3);
  });

  test('所有数组都为空时返回 0', () => {
    const data = {
      pokerGames: [],
      billiardsGames: [],
      fitnessSessions: [],
      bartenderSessions: [],
    };
    const result = calculateTotalSessions(data);
    expect(result).toBe(0);
  });
});

// ============================================================
// 六维能力分数计算测试（对数递减版本）
// ============================================================
describe('calculateDimensionScores - 六维能力分数计算（对数递减）', () => {

  test('空数据 → 返回基于默认值的初始分数', () => {
    const scores = calculateDimensionScores({});
    // 空数据时：次数为 0 → logScale(0) = 0
    // discipline: 50 + 50(calcAvg默认值) * 0.4 + 0 = 70
    expect(scores.discipline).toBe(70);
    // riskControl: 50 + 50 * 0.3 = 65
    expect(scores.riskControl).toBe(65);
    // decisionSpeed: 55 + 0 = 55
    expect(scores.decisionSpeed).toBe(55);
    // emotionalStability: 50 + 50 * 0.4 + 0 = 70
    expect(scores.emotionalStability).toBe(70);
    // creativity: 55 + 0 = 55
    expect(scores.creativity).toBe(55);
    // endurance: 50 + 50 * 0.3 + 0 = 65
    expect(scores.endurance).toBe(65);
  });

  test('null 数据 → 返回默认值（使用 SCORE_CONFIG）', () => {
    const scores = calculateDimensionScores(null);
    expect(scores.discipline).toBe(SCORE_CONFIG.baseScore);
    expect(scores.riskControl).toBe(SCORE_CONFIG.baseScore);
    expect(scores.decisionSpeed).toBe(SCORE_CONFIG.baseScore + 5);
    expect(scores.creativity).toBe(SCORE_CONFIG.baseScore + 5);
  });

  test('所有分数应不超过 95 分上限', () => {
    const data = {
      pokerGames: new Array(1000).fill({ riskScore: 100, tiltScore: 100 }),
      billiardsGames: new Array(1000).fill({}),
      fitnessSessions: new Array(1000).fill({ completion: 100, duration: 100 }),
      bartenderSessions: new Array(1000).fill({}),
    };
    const scores = calculateDimensionScores(data);
    Object.values(scores).forEach(score => {
      expect(score).toBeLessThanOrEqual(SCORE_CONFIG.maxScore);
    });
  });

  test('增加德州扑克次数应提高纪律性和情绪稳定分数', () => {
    const baseScores = calculateDimensionScores({ pokerGames: [] });
    const highScores = calculateDimensionScores({ pokerGames: new Array(50).fill({}) });
    expect(highScores.discipline).toBeGreaterThan(baseScores.discipline);
  });

  test('增加调酒次数应提高创造力和情绪稳定分数', () => {
    const baseScores = calculateDimensionScores({ bartenderSessions: [] });
    const highScores = calculateDimensionScores({ bartenderSessions: new Array(50).fill({}) });
    expect(highScores.creativity).toBeGreaterThan(baseScores.creativity);
    expect(highScores.emotionalStability).toBeGreaterThan(baseScores.emotionalStability);
  });

  test('对数递减效应：前 10 次的提升远大于 100-110 次', () => {
    const scores0 = calculateDimensionScores({ bartenderSessions: [] });
    const scores10 = calculateDimensionScores({ bartenderSessions: new Array(10).fill({}) });
    const scores100 = calculateDimensionScores({ bartenderSessions: new Array(100).fill({}) });
    const scores110 = calculateDimensionScores({ bartenderSessions: new Array(110).fill({}) });

    const earlyGain = scores10.creativity - scores0.creativity;
    const lateGain = scores110.creativity - scores100.creativity;

    // 早期提升应该远大于后期提升（递减效应）
    expect(earlyGain).toBeGreaterThan(lateGain);
  });

  test('SCORE_CONFIG 应定义完整', () => {
    expect(SCORE_CONFIG.baseScore).toBe(50);
    expect(SCORE_CONFIG.maxScore).toBe(95);
    expect(SCORE_CONFIG.logScaleFactor).toBeDefined();
    expect(SCORE_CONFIG.weights).toBeDefined();
  });

  test('返回的维度应包含全部 6 个维度', () => {
    const scores = calculateDimensionScores({});
    expect(Object.keys(scores)).toEqual(expect.arrayContaining([
      DIMENSION_KEYS.DISCIPLINE,
      DIMENSION_KEYS.RISK_CONTROL,
      DIMENSION_KEYS.DECISION_SPEED,
      DIMENSION_KEYS.EMOTIONAL_STABILITY,
      DIMENSION_KEYS.CREATIVITY,
      DIMENSION_KEYS.ENDURANCE,
    ]));
  });
});

// ============================================================
// 薄弱项识别测试
// ============================================================
describe('identifyWeakDimensions - 薄弱项识别', () => {

  test('所有维度都高于阈值 → 返回空数组', () => {
    const scores = {
      discipline: 80,
      riskControl: 75,
      decisionSpeed: 70,
      emotionalStability: 85,
      creativity: 90,
      endurance: 72,
    };
    const result = identifyWeakDimensions(scores);
    expect(result).toEqual([]);
  });

  test('部分维度低于阈值 → 只返回薄弱项', () => {
    const scores = {
      discipline: 80,
      riskControl: 50,
      decisionSpeed: 45,
      emotionalStability: 85,
      creativity: 90,
      endurance: 72,
    };
    const result = identifyWeakDimensions(scores);
    expect(result.length).toBe(2);
    expect(result.map(r => r.key)).toContain('riskControl');
    expect(result.map(r => r.key)).toContain('decisionSpeed');
  });

  test('薄弱项应按分数从低到高排序', () => {
    const scores = {
      discipline: 60,
      riskControl: 40,
      decisionSpeed: 50,
      emotionalStability: 85,
      creativity: 90,
      endurance: 72,
    };
    const result = identifyWeakDimensions(scores);
    expect(result[0].score).toBe(40);
    expect(result[1].score).toBe(50);
    expect(result[2].score).toBe(60);
  });

  test('默认阈值应为 65', () => {
    expect(WEAK_DIMENSION_THRESHOLD).toBe(65);
  });

  test('可以自定义薄弱阈值', () => {
    const scores = { discipline: 70, riskControl: 72 };
    const resultDefault = identifyWeakDimensions(scores);
    const resultCustom = identifyWeakDimensions(scores, 75);
    expect(resultDefault.length).toBe(0);
    expect(resultCustom.length).toBe(2);
  });

  test('空输入 → 返回空数组', () => {
    const result = identifyWeakDimensions(null);
    expect(result).toEqual([]);
  });

  test('薄弱项应包含优先级字段（新增）', () => {
    const scores = { discipline: 40, riskControl: 55, creativity: 63 };
    const result = identifyWeakDimensions(scores);
    // 40 < 50 → high
    expect(result.find(r => r.key === 'discipline').priority).toBe('high');
    // 55 在 50-65 之间 → medium
    expect(result.find(r => r.key === 'riskControl').priority).toBe('medium');
    // 63 在 50-65 之间 → medium
    expect(result.find(r => r.key === 'creativity').priority).toBe('medium');
  });

  test('薄弱项应包含完整的维度元信息', () => {
    const scores = { discipline: 40 };
    const result = identifyWeakDimensions(scores);
    expect(result[0]).toHaveProperty('key');
    expect(result[0]).toHaveProperty('score');
    expect(result[0]).toHaveProperty('label');
    expect(result[0]).toHaveProperty('color');
    expect(result[0]).toHaveProperty('priority');
  });
});

// ============================================================
// 分层提升建议测试
// ============================================================
describe('getImprovementSuggestion - 分层提升建议', () => {

  test('每个维度都有对应的建议', () => {
    Object.values(DIMENSION_KEYS).forEach(key => {
      const suggestion = getImprovementSuggestion(key);
      expect(typeof suggestion).toBe('string');
      expect(suggestion.length).toBeGreaterThan(0);
    });
  });

  test('未知维度返回默认建议', () => {
    const suggestion = getImprovementSuggestion('unknown_key');
    expect(typeof suggestion).toBe('string');
    expect(suggestion.length).toBeGreaterThan(0);
  });

  test('低分段（< 50）应返回 beginner 层级建议', () => {
    const suggestion = getImprovementSuggestion(DIMENSION_KEYS.DISCIPLINE, 30);
    expect(typeof suggestion).toBe('string');
    expect(suggestion.length).toBeGreaterThan(0);
    // beginner 建议提到"时间表"、"闹钟"等入门词汇
    expect(suggestion).toMatch(/训练时间表|闹钟|固定/);
  });

  test('中间分段（50-69）应返回 intermediate 层级建议', () => {
    const suggestion = getImprovementSuggestion(DIMENSION_KEYS.DISCIPLINE, 60);
    expect(typeof suggestion).toBe('string');
    expect(suggestion.length).toBeGreaterThan(0);
    // intermediate 建议提到"执行率"、"不打折"等进阶词汇
    expect(suggestion).toMatch(/执行率|不打折/);
  });

  test('高分段（≥ 70）应返回 advanced 层级建议', () => {
    const suggestion = getImprovementSuggestion(DIMENSION_KEYS.DISCIPLINE, 85);
    expect(typeof suggestion).toBe('string');
    expect(suggestion.length).toBeGreaterThan(0);
    // advanced 建议提到"连续纪录"、"打卡链"、"帮助他人"等高阶词汇
    expect(suggestion).toMatch(/连续|纪录|打卡链|帮助他人/);
  });

  test('每个维度的不同分层建议应有所不同', () => {
    Object.values(DIMENSION_KEYS).forEach(key => {
      const beginner = getImprovementSuggestion(key, 30);
      const intermediate = getImprovementSuggestion(key, 60);
      const advanced = getImprovementSuggestion(key, 85);
      // 三个层级的建议应该都不一样
      expect(beginner).not.toBe(intermediate);
      expect(intermediate).not.toBe(advanced);
    });
  });

  test('默认分数（不传第二个参数）应返回 intermediate 建议', () => {
    const suggestion = getImprovementSuggestion(DIMENSION_KEYS.RISK_CONTROL);
    // 默认 50 分 → intermediate
    expect(suggestion).toMatch(/底池赔率|跟注|加注/);
  });
});

// ============================================================
// 今日任务生成测试（智能版本）
// ============================================================
describe('generateTodayTasks - 智能今日任务生成', () => {

  const realDateNow = Date.now.bind(global.Date);

  beforeEach(() => {
    const today = new Date('2026-08-05T12:00:00');
    global.Date = class extends Date {
      constructor(date) {
        super(date || today);
      }
      static now() { return today.getTime(); }
    };
  });

  afterEach(() => {
    global.Date.now = realDateNow;
  });

  test('今日无任何训练记录 → 应包含所有训练任务', () => {
    const tasks = generateTodayTasks({
      pokerGames: [],
      billiardsGames: [],
      fitnessSessions: [],
      bartenderSessions: [],
    });
    // 3 个训练 + 2 个日常任务
    expect(tasks.length).toBe(5);
  });

  test('今日已完成所有训练 → 只包含日常任务', () => {
    const today = new Date('2026-08-05T10:00:00').toISOString();
    const tasks = generateTodayTasks({
      pokerGames: [{ createdAt: today }],
      billiardsGames: [{ createdAt: today }],
      fitnessSessions: [{ createdAt: today }],
      bartenderSessions: [{ createdAt: today }],
    });
    // 只剩 2 个日常任务：调酒 + 冥想
    expect(tasks.length).toBe(2);
    // 日常任务优先级至少是 low（可能因薄弱项被提升为 medium）
    expect(['low', 'medium']).toContain(tasks[0].priority);
  });

  test('今日只训练了德州 → 包含台球和健身任务', () => {
    const today = new Date('2026-08-05T10:00:00').toISOString();
    const tasks = generateTodayTasks({
      pokerGames: [{ createdAt: today }],
      billiardsGames: [],
      fitnessSessions: [],
    });
    expect(tasks.length).toBe(4); // 台球 + 健身 + 2 个日常
  });

  test('任务应包含紧急度字段（urgency）', () => {
    const tasks = generateTodayTasks({});
    tasks.forEach(task => {
      expect(task).toHaveProperty('urgency');
      expect(typeof task.urgency).toBe('number');
    });
  });

  test('任务应按紧急度从高到低排序', () => {
    const tasks = generateTodayTasks({});
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i - 1].urgency).toBeGreaterThanOrEqual(tasks[i].urgency);
    }
  });

  test('薄弱项存在时，相关任务优先级应被提升', () => {
    // 构造数据：让风险控制和情绪稳定成为薄弱项（低分）
    const weakData = {
      pokerGames: [], // 德州扑克次数为 0 → 风险控制和情绪稳定低分
      billiardsGames: new Array(20).fill({}), // 台球次数多 → 决策速度高分
      fitnessSessions: new Array(20).fill({ completion: 100, duration: 100 }),
      bartenderSessions: new Array(20).fill({}),
    };
    const tasks = generateTodayTasks(weakData);
    // 德州扑克任务（与风险控制、情绪稳定相关）应该是 high 优先
    const pokerTask = tasks.find(t => t.id === 'poker');
    expect(pokerTask).toBeDefined();
    expect(pokerTask.priority).toBe('high');
  });

  test('任务应包含必要字段', () => {
    const tasks = generateTodayTasks({});
    tasks.forEach(task => {
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('desc');
      expect(task).toHaveProperty('icon');
      expect(task).toHaveProperty('priority');
      expect(task).toHaveProperty('urgency');
      expect(task).toHaveProperty('relatedDimensions');
    });
  });

  test('优先级只能是 high/medium/low', () => {
    const tasks = generateTodayTasks({});
    tasks.forEach(task => {
      expect(['high', 'medium', 'low']).toContain(task.priority);
    });
  });

  test('昨天的训练记录不影响今日任务', () => {
    const yesterday = new Date('2026-08-04T10:00:00').toISOString();
    const tasks = generateTodayTasks({
      pokerGames: [{ createdAt: yesterday }],
      billiardsGames: [{ createdAt: yesterday }],
      fitnessSessions: [{ createdAt: yesterday }],
    });
    expect(tasks.length).toBe(5);
  });

  test('传入自定义分数时应使用该分数计算紧急度', () => {
    const customScores = {
      discipline: 90,    // 高分 → 不紧急
      riskControl: 90,   // 高分
      decisionSpeed: 40, // 低分 → 紧急
      emotionalStability: 90,
      creativity: 90,
      endurance: 90,
    };
    const tasks = generateTodayTasks({}, customScores);
    // 台球任务（与决策速度相关）应该排在前面且是高优先
    const billiardsTask = tasks.find(t => t.id === 'billiards');
    expect(billiardsTask).toBeDefined();
    expect(billiardsTask.priority).toBe('high');
  });
});

// ============================================================
// 集成测试：阶段判定与总会话数联动
// ============================================================
describe('集成测试：阶段判定与总会话数联动', () => {

  test('新用户（0次训练）应在基础期，进度 0%', () => {
    const data = { pokerGames: [], billiardsGames: [], fitnessSessions: [], bartenderSessions: [] };
    const total = calculateTotalSessions(data);
    const phase = determinePhase(total);
    const progress = calculatePhaseProgress(total);
    expect(total).toBe(0);
    expect(phase.key).toBe('foundation');
    expect(progress.currentProgress).toBe(0);
  });

  test('活跃用户（20次训练）应在强化期，进度 50%', () => {
    const data = {
      pokerGames: new Array(8).fill({}),
      billiardsGames: new Array(5).fill({}),
      fitnessSessions: new Array(4).fill({}),
      bartenderSessions: new Array(3).fill({}),
    };
    const total = calculateTotalSessions(data);
    const phase = determinePhase(total);
    const progress = calculatePhaseProgress(total);
    expect(total).toBe(20);
    expect(phase.key).toBe('enhance');
    expect(progress.currentProgress).toBe(50);
  });

  test('资深用户（50次训练）应在精通期', () => {
    const data = {
      pokerGames: new Array(20).fill({}),
      billiardsGames: new Array(15).fill({}),
      fitnessSessions: new Array(10).fill({}),
      bartenderSessions: new Array(5).fill({}),
    };
    const total = calculateTotalSessions(data);
    const phase = determinePhase(total);
    const progress = calculatePhaseProgress(total);
    expect(total).toBe(50);
    expect(phase.key).toBe('master');
    expect(progress.isFinalPhase).toBe(true);
  });

  test('刚好 10 次 → 强化期边界验证', () => {
    const data = {
      pokerGames: new Array(5).fill({}),
      billiardsGames: new Array(3).fill({}),
      fitnessSessions: new Array(2).fill({}),
      bartenderSessions: [],
    };
    const total = calculateTotalSessions(data);
    const phase = determinePhase(total);
    const progress = calculatePhaseProgress(total);
    expect(total).toBe(10);
    expect(phase.key).toBe('enhance');
    expect(progress.currentProgress).toBe(0);
  });

  test('刚好 30 次 → 精通期边界验证', () => {
    const data = {
      pokerGames: new Array(12).fill({}),
      billiardsGames: new Array(8).fill({}),
      fitnessSessions: new Array(6).fill({}),
      bartenderSessions: new Array(4).fill({}),
    };
    const total = calculateTotalSessions(data);
    const phase = determinePhase(total);
    const progress = calculatePhaseProgress(total);
    expect(total).toBe(30);
    expect(phase.key).toBe('master');
    expect(progress.isFinalPhase).toBe(true);
  });
});
