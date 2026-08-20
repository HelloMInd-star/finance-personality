// ============================================================
// 策略编译器 · strategyCompiler
// 蓝图第 5 站 5.2：把 localStorage「poker_decisions」聚合为
// 可溯源的 decide() 代码（TS 主 / Python 辅）
// 纯本地计算 · 零网络 · 零 LLM · 每个数字都能指回碎片
// ============================================================

export const MIN_FRAGMENTS = 30; // 编译所需最少碎片数

const AGGRESSIVE_ACTIONS = ['raise', 'allin'];
const PASSIVE_ACTIONS = ['call', 'check'];

export const STAGE_ORDER = ['preflop', 'flop', 'turn', 'river', 'showdown'];
export const STAGE_LABEL = {
  preflop: '翻前',
  flop: '翻牌',
  turn: '转牌',
  river: '河牌',
  showdown: '摊牌',
};
export const ACTION_LABEL = {
  fold: '弃牌',
  check: '过牌',
  call: '跟注',
  raise: '加注',
  allin: '全下',
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const round2 = (v) => Math.round(v * 100) / 100;
const pad2 = (n) => String(n).padStart(2, '0');

function median(nums) {
  const arr = nums.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fmtDateTime(ts) {
  const d = new Date(ts);
  return `${fmtDate(ts)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ── 激进度：某样本集内 (raise+allin) / (raise+allin+call+check)，fold 不参与 ──
function aggRateOf(arr) {
  const a = arr.filter((d) => AGGRESSIVE_ACTIONS.indexOf(d.action) >= 0).length;
  const p = arr.filter((d) => PASSIVE_ACTIONS.indexOf(d.action) >= 0).length;
  return a + p > 0 ? a / (a + p) : null;
}

// ============================================================
// 聚合：决策碎片 -> 画像参数（每个数字都带计数溯源）
// ============================================================
export function analyzeDecisions(decisions) {
  const list = (decisions || []).filter((d) => d && typeof d === 'object' && d.action);
  const total = list.length;

  const counts = { fold: 0, check: 0, call: 0, raise: 0, allin: 0 };
  list.forEach((d) => {
    counts[d.action] = (counts[d.action] || 0) + 1;
  });

  const aggN = counts.raise + counts.allin;
  const pasN = counts.call + counts.check;
  const aggD = aggN + pasN;
  const aggression = aggD > 0 ? aggN / aggD : 0;
  const foldRate = total > 0 ? counts.fold / total : 0;

  // ── 抗 Tilt：连败(streak<=-2) vs 平稳(streak>=0) 的激进度差异折算 0-1 ──
  const tilted = list.filter((d) => (d.streak || 0) <= -2);
  const calm = list.filter((d) => (d.streak || 0) >= 0);
  const tiltedAgg = aggRateOf(tilted);
  const calmAgg = aggRateOf(calm);
  let tiltResist;
  let tiltNote;
  if (tiltedAgg == null || calmAgg == null || tilted.length < 3) {
    tiltResist = 0.5;
    tiltNote = `连败样本 ${tilted.length} 手（<3），按中性 0.5 计`;
  } else {
    const delta = Math.abs(tiltedAgg - calmAgg);
    tiltResist = clamp01(1 - delta * 2);
    tiltNote = `连败>=2 时激进度 ${tiltedAgg.toFixed(2)}(${tilted.length} 手) vs 平稳期 ${calmAgg.toFixed(2)}(${calm.length} 手)，1-|差|x2`;
  }

  // ── 诈唬率：牌力 situation<0.35 时的加注占比 ──
  const weak = list.filter((d) => typeof d.situation === 'number' && d.situation < 0.35);
  const weakRaise = weak.filter((d) => AGGRESSIVE_ACTIONS.indexOf(d.action) >= 0).length;
  const bluffRate = weak.length > 0 ? weakRaise / weak.length : 0;
  const bluffNote =
    weak.length > 0
      ? `牌力<0.35 的 ${weak.length} 手中，加注/全下 ${weakRaise} 手`
      : '牌力<0.35 样本 0 手，无法估计，置 0';

  // ── 各街行动分布 + 决策时长中位数 ──
  const stageStats = {};
  STAGE_ORDER.forEach((st) => {
    const arr = list.filter((d) => d.stage === st);
    if (!arr.length) return;
    const f = arr.filter((d) => d.action === 'fold').length;
    const c = arr.filter((d) => PASSIVE_ACTIONS.indexOf(d.action) >= 0).length;
    const r = arr.filter((d) => AGGRESSIVE_ACTIONS.indexOf(d.action) >= 0).length;
    stageStats[st] = {
      n: arr.length,
      foldPct: f / arr.length,
      callPct: c / arr.length,
      raisePct: r / arr.length,
      medDecisionMs: Math.round(median(arr.map((d) => d.decisionMs || 0))),
    };
  });

  const tsList = list.map((d) => d.ts || 0).filter(Boolean);
  const tsStart = tsList.length ? Math.min.apply(null, tsList) : Date.now();
  const tsEnd = tsList.length ? Math.max.apply(null, tsList) : Date.now();

  const raisePcts = list.map((d) => d.raisePct).filter((v) => typeof v === 'number');
  const raisePctAvg =
    raisePcts.length > 0 ? raisePcts.reduce((a, b) => a + b, 0) / raisePcts.length : null;

  const gameIds = {};
  list.forEach((d) => {
    if (d.gameId) gameIds[d.gameId] = true;
  });

  return {
    total,
    gameCount: Object.keys(gameIds).length,
    counts,
    aggN,
    pasN,
    aggD,
    aggression: round2(aggression),
    foldRate: round2(foldRate),
    tiltResist: round2(tiltResist),
    tiltNote,
    bluffRate: round2(bluffRate),
    bluffNote,
    stageStats,
    medDecisionMs: Math.round(median(list.map((d) => d.decisionMs || 0))),
    raisePctAvg: raisePctAvg == null ? null : round2(raisePctAvg),
    dateStart: fmtDate(tsStart),
    dateEnd: fmtDate(tsEnd),
    compiledAt: fmtDateTime(Date.now()),
  };
}

// ============================================================
// TypeScript 版 decide() 代码生成
// ============================================================
export function generateTsCode(s) {
  const stageLines = STAGE_ORDER.filter((st) => s.stageStats[st]).map((st) => {
    const t = s.stageStats[st];
    return (
      `  ${st}: { n: ${t.n}, foldPct: ${t.foldPct.toFixed(2)}, callPct: ${t.callPct.toFixed(2)}, ` +
      `raisePct: ${t.raisePct.toFixed(2)}, medDecisionMs: ${t.medDecisionMs} }, // ${STAGE_LABEL[st]} ${t.n} 手`
    );
  });

  const lines = [
    '// ============================================================',
    `// decide() v1 · finance-personality 策略编译器产出`,
    `// 数据源：localStorage poker_decisions · ${s.total} 条真实决策 · ${s.gameCount} 个牌局`,
    `// 样本区间：${s.dateStart} -> ${s.dateEnd} · 编译时间：${s.compiledAt}`,
    `// 画像摘要：激进度 ${s.aggression.toFixed(2)} · 弃牌率 ${s.foldRate.toFixed(2)} · 抗 Tilt ${s.tiltResist.toFixed(2)} · 诈唬率 ${s.bluffRate.toFixed(2)}`,
    '// ============================================================',
    '',
    'export interface DecisionContext {',
    '  handStrength: number; // 局势评估 0-1（越高越优）',
    '  potOdds: number; // 风险回报比 0-1（需投入 / 底池，越高越贵）',
    "  position: 'early' | 'late'; // 行动位置（后位信息更多）",
    '  consecutiveLosses: number; // 连续失利次数（0 = 无连败）',
    '}',
    '',
    'export interface PlayerProfile {',
    '  aggression: number; // 0-1 激进倾向',
    '  tiltResist: number; // 0-1 抗失落能力（1 = 连败不失控）',
    '  bluffRate: number; // 0-1 弱势时主动施压频率',
    '}',
    '',
    `/** 我的画像 · ${s.total} 条真实决策聚合（${s.dateStart} -> ${s.dateEnd}） */`,
    'export const MY_PROFILE: PlayerProfile = {',
    `  aggression: ${s.aggression.toFixed(2)}, // 加注+全下 ${s.aggN} / (${s.aggN} 激进 + ${s.pasN} 跟过) 手，弃牌 ${s.counts.fold} 手单列 · 截至 ${s.dateEnd}`,
    `  tiltResist: ${s.tiltResist.toFixed(2)}, // ${s.tiltNote}`,
    `  bluffRate: ${s.bluffRate.toFixed(2)}, // ${s.bluffNote}`,
    '};',
    '',
    '/** 各阶段行动分布（校准参考，decide() 暂不直接使用） */',
    'export const STAGE_STATS = {',
  ].concat(stageLines, [
    '};',
    '',
    'const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));',
    '',
    '/** 确定性伪随机：同一上下文永远同一结果（可复现的直觉） */',
    'function hashFloat(ctx: DecisionContext): number {',
    '  const x = Math.sin(ctx.handStrength * 127.1 + ctx.potOdds * 311.7 + ctx.consecutiveLosses * 74.7) * 43758.5453;',
    '  return x - Math.floor(x);',
    '}',
    '',
    "export function decide(ctx: DecisionContext, profile: PlayerProfile = MY_PROFILE): 'fold' | 'call' | 'raise' {",
    '  // 1) 连败压力：抗 Tilt 越低，连败时越保守（每连败 1 局收敛 0.06，5 局封顶防爆走）',
    '  const tiltPressure = (1 - profile.tiltResist) * Math.min(ctx.consecutiveLosses, 5) * 0.06;',
    '  const agg = clamp01(profile.aggression - tiltPressure);',
    '',
    '  // 2) 位置加成：后位 +0.05 有效牌力（信息优势折价）',
    "  const strength = clamp01(ctx.handStrength + (ctx.position === 'late' ? 0.05 : 0));",
    '',
    '  // 3) 价格是否合算：要价（potOdds）不高于牌力才值得继续',
    '  const priceOk = ctx.potOdds <= strength;',
    '',
    '  // 4) 诈唬判定：弱牌 + 价格合算时，以 bluffRate 频率施压（确定性 hash 复现）',
    '  const bluffing = strength < 0.35 && priceOk && hashFloat(ctx) < profile.bluffRate;',
    '',
    '  // 5) 加注线：激进度越高门槛越低（0.85 -> 0.45）',
    '  const raiseLine = 0.85 - agg * 0.4;',
    "  if ((strength >= raiseLine && priceOk) || bluffing) return 'raise';",
    '',
    '  // 6) 弃牌线：牌力不足且价格不合算 -> 弃牌（越保守线越高 0.35 -> 0.50）',
    '  const foldLine = 0.35 + (1 - agg) * 0.15;',
    "  if (strength < foldLine && !priceOk) return 'fold';",
    '',
    "  return 'call';",
    '}',
    '',
  ]);
  return lines.join('\n');
}

// ============================================================
// Python 版 decide() 代码生成
// ============================================================
export function generatePyCode(s) {
  const stageLines = STAGE_ORDER.filter((st) => s.stageStats[st]).map((st) => {
    const t = s.stageStats[st];
    return (
      `    '${st}': {'n': ${t.n}, 'fold_pct': ${t.foldPct.toFixed(2)}, 'call_pct': ${t.callPct.toFixed(2)}, ` +
      `'raise_pct': ${t.raisePct.toFixed(2)}, 'med_decision_ms': ${t.medDecisionMs}},  # ${STAGE_LABEL[st]} ${t.n} 手`
    );
  });

  const lines = [
    '# ============================================================',
    `# decide() v1 · finance-personality 策略编译器产出`,
    `# 数据源：localStorage poker_decisions · ${s.total} 条真实决策 · ${s.gameCount} 个牌局`,
    `# 样本区间：${s.dateStart} -> ${s.dateEnd} · 编译时间：${s.compiledAt}`,
    `# 画像摘要：激进度 ${s.aggression.toFixed(2)} · 弃牌率 ${s.foldRate.toFixed(2)} · 抗 Tilt ${s.tiltResist.toFixed(2)} · 诈唬率 ${s.bluffRate.toFixed(2)}`,
    '# ============================================================',
    'from dataclasses import dataclass',
    'from typing import Dict, Literal',
    'import math',
    '',
    "Action = Literal['fold', 'call', 'raise']",
    '',
    '',
    '@dataclass',
    'class DecisionContext:',
    '    hand_strength: float      # 局势评估 0-1（越高越优）',
    '    pot_odds: float           # 风险回报比 0-1（需投入 / 底池，越高越贵）',
    "    position: str             # 'early' | 'late'，后位信息更多",
    '    consecutive_losses: int   # 连续失利次数（0 = 无连败）',
    '',
    '',
    '@dataclass',
    'class PlayerProfile:',
    '    aggression: float   # 0-1 激进倾向',
    '    tilt_resist: float  # 0-1 抗失落能力（1 = 连败不失控）',
    '    bluff_rate: float   # 0-1 弱势时主动施压频率',
    '',
    '',
    `# 我的画像 · ${s.total} 条真实决策聚合（${s.dateStart} -> ${s.dateEnd}）`,
    'MY_PROFILE = PlayerProfile(',
    `    aggression=${s.aggression.toFixed(2)},  # 加注+全下 ${s.aggN} / (${s.aggN} 激进 + ${s.pasN} 跟过) 手，弃牌 ${s.counts.fold} 手单列 · 截至 ${s.dateEnd}`,
    `    tilt_resist=${s.tiltResist.toFixed(2)},  # ${s.tiltNote}`,
    `    bluff_rate=${s.bluffRate.toFixed(2)},  # ${s.bluffNote}`,
    ')',
    '',
    '',
    '# 各阶段行动分布（校准参考，decide() 暂不直接使用）',
    'STAGE_STATS: Dict[str, dict] = {',
  ].concat(stageLines, [
    '}',
    '',
    '',
    'def _clamp01(v: float) -> float:',
    '    return min(1.0, max(0.0, v))',
    '',
    '',
    'def _hash_float(ctx: DecisionContext) -> float:',
    '    """确定性伪随机：同一上下文永远同一结果（可复现的直觉）"""',
    '    x = math.sin(ctx.hand_strength * 127.1 + ctx.pot_odds * 311.7 + ctx.consecutive_losses * 74.7) * 43758.5453',
    '    return x - math.floor(x)',
    '',
    '',
    'def decide(ctx: DecisionContext, profile: PlayerProfile = MY_PROFILE) -> Action:',
    '    # 1) 连败压力：抗 Tilt 越低，连败时越保守（每连败 1 局收敛 0.06，5 局封顶防爆走）',
    '    tilt_pressure = (1 - profile.tilt_resist) * min(ctx.consecutive_losses, 5) * 0.06',
    '    agg = _clamp01(profile.aggression - tilt_pressure)',
    '',
    '    # 2) 位置加成：后位 +0.05 有效牌力（信息优势折价）',
    "    strength = _clamp01(ctx.hand_strength + (0.05 if ctx.position == 'late' else 0.0))",
    '',
    '    # 3) 价格是否合算：要价（pot_odds）不高于牌力才值得继续',
    '    price_ok = ctx.pot_odds <= strength',
    '',
    '    # 4) 诈唬判定：弱牌 + 价格合算时，以 bluff_rate 频率施压（确定性 hash 复现）',
    '    bluffing = strength < 0.35 and price_ok and _hash_float(ctx) < profile.bluff_rate',
    '',
    '    # 5) 加注线：激进度越高门槛越低（0.85 -> 0.45）',
    '    raise_line = 0.85 - agg * 0.4',
    '    if (strength >= raise_line and price_ok) or bluffing:',
    "        return 'raise'",
    '',
    '    # 6) 弃牌线：牌力不足且价格不合算 -> 弃牌（越保守线越高 0.35 -> 0.50）',
    '    fold_line = 0.35 + (1 - agg) * 0.15',
    '    if strength < fold_line and not price_ok:',
    "        return 'fold'",
    '',
    "    return 'call'",
    '',
  ]);
  return lines.join('\n');
}

// ============================================================
// 编译入口：数据不足时返回降级原因
// ============================================================
export function compileStrategy(decisions) {
  const list = (decisions || []).filter((d) => d && typeof d === 'object' && d.action);
  const n = list.length;
  if (n === 0) return { ok: false, reason: 'empty', count: 0, needed: MIN_FRAGMENTS };
  if (n < MIN_FRAGMENTS) {
    return { ok: false, reason: 'insufficient', count: n, needed: MIN_FRAGMENTS };
  }
  const stats = analyzeDecisions(list);
  return {
    ok: true,
    count: n,
    stats,
    tsCode: generateTsCode(stats),
    pyCode: generatePyCode(stats),
  };
}
