/**
 * 投资人DNA分析 - 引擎层
 * 包含：基因测序、基因比对、紫人组检测
 */
import {
  MASTER_GENOMES,
  CHROMOSOME_WEIGHTS,
  KEYWORD_MAP,
  MBTI_KEYWORDS,
  PURPLE_GROUP,
  PURPLE_GROUP_INFO,
  calculateMBTIMatch,
} from './genomeData';
import { logger } from './logger';

// ============== Step 1: 基因测序（关键词提取 + 维度量化） ==============

const countKeywordHits = (text, keywordList) => {
  let hits = 0;
  for (const kw of keywordList) {
    if (text.includes(kw)) hits++;
  }
  return hits;
};

/**
 * 从输入文本中提取5条染色体分数
 * @param {string} input - 用户描述文本
 * @returns {Object} - { risk, time, style, model, mbti }
 */
export const sequenceDNA = (input) => {
  const text = input || '';
  logger.session('[DNA测序] 开始分析输入', text.slice(0, 50));

  // 数值维度评分
  const scores = {
    risk: calculateNumericScore(text, KEYWORD_MAP.risk),
    time: calculateNumericScore(text, KEYWORD_MAP.time),
    style: calculateNumericScore(text, KEYWORD_MAP.style),
    model: calculateNumericScore(text, KEYWORD_MAP.model),
  };

  // MBTI 推断
  const mbti = inferMBTI(text);

  logger.session('[DNA测序] 完成', { scores, mbti });
  return { ...scores, mbti };
};

// 计算数值维度分数（0-100）
const calculateNumericScore = (text, dimensionMap) => {
  const leftHits = countKeywordHits(text, dimensionMap.conservative || dimensionMap.short || dimensionMap.intuitive || dimensionMap.single || []);
  const neutralHits = countKeywordHits(text, dimensionMap.neutral || dimensionMap.medium || dimensionMap.mixed || dimensionMap.moderate || []);
  const rightHits = countKeywordHits(text, dimensionMap.aggressive || dimensionMap.long || dimensionMap.analytical || dimensionMap.multi || []);

  const total = leftHits + neutralHits + rightHits;
  if (total === 0) return 50; // 无关键词时默认中性

  // 加权计算
  const weighted = leftHits * 15 + neutralHits * 50 + rightHits * 85;
  const raw = weighted / total;

  // 有命中时适当放大极端程度
  const amplified = raw + (raw - 50) * 0.3;
  return Math.round(Math.max(0, Math.min(100, amplified)));
};

// 推断 MBTI
const inferMBTI = (text) => {
  const dimensions = {
    EI: { E: countKeywordHits(text, MBTI_KEYWORDS.E), I: countKeywordHits(text, MBTI_KEYWORDS.I) },
    SN: { S: countKeywordHits(text, MBTI_KEYWORDS.S), N: countKeywordHits(text, MBTI_KEYWORDS.N) },
    TF: { T: countKeywordHits(text, MBTI_KEYWORDS.T), F: countKeywordHits(text, MBTI_KEYWORDS.F) },
    JP: { J: countKeywordHits(text, MBTI_KEYWORDS.J), P: countKeywordHits(text, MBTI_KEYWORDS.P) },
  };

  const e = dimensions.EI.E >= dimensions.EI.I ? 'E' : 'I';
  const s = dimensions.SN.S >= dimensions.SN.N ? 'S' : 'N';
  const t = dimensions.TF.T >= dimensions.TF.F ? 'T' : 'F';
  const j = dimensions.JP.J >= dimensions.JP.P ? 'J' : 'P';

  return `${e}${s}${t}${j}`;
};

// ============== Step 2: 基因比对（相似度计算） ==============

/**
 * 计算用户与某位大师的染色体相似度
 */
const calculateSimilarity = (userDNA, masterDNA) => {
  // 数值维度匹配（Chr-1 ~ Chr-4）
  const numericDims = ['risk', 'time', 'style', 'model'];
  let numericMatch = 0;

  for (const dim of numericDims) {
    const dimMatch = 100 - Math.abs(userDNA[dim] - masterDNA.chromosomes[dim]);
    numericMatch += dimMatch * CHROMOSOME_WEIGHTS[dim];
  }

  // MBTI 匹配（Chr-5）
  const mbtiMatch = calculateMBTIMatch(userDNA.mbti, masterDNA.mbti);
  const mbtiWeighted = mbtiMatch * CHROMOSOME_WEIGHTS.mbti;

  const total = Math.round(numericMatch + mbtiWeighted);
  return Math.max(0, Math.min(100, total));
};

/**
 * 与所有大师比对，返回Top3
 */
export const compareWithMasters = (userDNA) => {
  logger.session('[DNA比对] 用户DNA', userDNA);

  const results = MASTER_GENOMES.map((master) => {
    const similarity = calculateSimilarity(userDNA, master);
    const detailMatch = {
      risk: 100 - Math.abs(userDNA.risk - master.chromosomes.risk),
      time: 100 - Math.abs(userDNA.time - master.chromosomes.time),
      style: 100 - Math.abs(userDNA.style - master.chromosomes.style),
      model: 100 - Math.abs(userDNA.model - master.chromosomes.model),
      mbti: calculateMBTIMatch(userDNA.mbti, master.mbti),
    };
    return { master, similarity, detailMatch };
  });

  // 按相似度降序
  results.sort((a, b) => b.similarity - a.similarity);

  const top3 = results.slice(0, 3);
  logger.session('[DNA比对] Top3', top3.map(t => `${t.master.name}: ${t.similarity}%`));

  return {
    all: results,
    top3,
    winner: top3[0],
  };
};

// ============== Step 3: 紫人组检测 ==============

export const detectPurpleGroup = (top3) => {
  const purpleCount = top3.filter(
    (t) => PURPLE_GROUP.includes(t.master.mbti)
  ).length;

  const isPurple = purpleCount >= 2;

  // 收集 Top3 中的紫人类型
  const purpleTypes = [...new Set(
    top3
      .filter((t) => PURPLE_GROUP.includes(t.master.mbti))
      .map((t) => t.master.mbti)
  )];

  logger.session('[紫人组检测]', { purpleCount, isPurple, purpleTypes });

  return {
    isPurple,
    purpleCount,
    purpleTypes,
    info: isPurple && purpleTypes.length > 0 ? PURPLE_GROUP_INFO[purpleTypes[0]] : null,
  };
};

// ============== Step 4: 生成完整报告 ==============

/**
 * 一站式：输入文本 → 完整报告
 */
export const analyzeInvestorDNA = (input) => {
  logger.session('========== DNA分析开始 ==========');
  const startTime = Date.now();

  // Step 1: 基因测序
  const userDNA = sequenceDNA(input);

  // Step 2: 基因比对
  const comparison = compareWithMasters(userDNA);

  // Step 3: 紫人组检测
  const purpleResult = detectPurpleGroup(comparison.top3);

  const elapsed = Date.now() - startTime;
  logger.session(`========== DNA分析完成 (${elapsed}ms) ==========`);

  return {
    userDNA,
    top3: comparison.top3,
    winner: comparison.winner,
    purpleGroup: purpleResult,
    generatedAt: Date.now(),
  };
};

/**
 * 从已有 DNA 分数直接生成报告（爬楼梯模式使用）
 */
export const generateReportFromDNA = (userDNA) => {
  logger.session('========== DNA分析(直接DNA)开始 ==========');
  const startTime = Date.now();

  logger.session('[DNA测序] 使用已有DNA', userDNA);

  // Step 2: 基因比对
  const comparison = compareWithMasters(userDNA);

  // Step 3: 紫人组检测
  const purpleResult = detectPurpleGroup(comparison.top3);

  const elapsed = Date.now() - startTime;
  logger.session(`========== DNA分析完成 (${elapsed}ms) ==========`);

  return {
    userDNA,
    top3: comparison.top3,
    winner: comparison.winner,
    purpleGroup: purpleResult,
    generatedAt: Date.now(),
  };
};
