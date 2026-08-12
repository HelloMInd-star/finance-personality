/**
 * 音乐偏好分析引擎 · musicProfileEngine
 *
 * 功能：
 * 1. 分析歌单数据提取用户音乐偏好
 * 2. 将音乐偏好映射到行为向量体系（与 vectorMapper.js 对接）
 * 3. 支持网易云音乐 API 数据接入
 * 4. 生成音乐画像（曲风、情绪、节奏、时代等维度）
 *
 * 数据来源：
 * - 网易云歌单数据（通过后端 API 获取）
 * - 用户手动选择的音乐风格偏好
 */

import { logger } from './logger';
import { storage } from './storage';

// ============================================================
// 音乐风格分类体系
// ============================================================

/**
 * 曲风大类
 */
export const GENRE_CATEGORIES = {
  pop: { label: '流行', icon: '🎤', weight: 0.8 },
  rock: { label: '摇滚', icon: '🎸', weight: 0.9 },
  electronic: { label: '电子', icon: '🎛️', weight: 0.85 },
  classical: { label: '古典', icon: '🎻', weight: 0.95 },
  jazz: { label: '爵士', icon: '🎷', weight: 0.9 },
  hiphop: { label: '嘻哈', icon: '🎙️', weight: 0.85 },
  folk: { label: '民谣', icon: '🪕', weight: 0.8 },
  rnb: { label: 'R&B', icon: '🎵', weight: 0.8 },
  metal: { label: '金属', icon: '🤘', weight: 0.9 },
  indie: { label: '独立', icon: '🎨', weight: 0.8 },
};

/**
 * 情绪标签 → 行为向量映射
 */
export const EMOTION_VECTOR_MAP = {
  // 愉悦 → 高风险偏好
  joyful: { riskTolerance: 0.8, decisionSpeed: 0.7 },
  // 平静 → 低风险偏好、慢决策
  calm: { riskTolerance: 0.2, decisionSpeed: 0.3 },
  // 激昂 → 高风险、快决策
  energetic: { riskTolerance: 0.9, decisionSpeed: 0.85 },
  // 忧郁 → 低风险、深思考
  melancholic: { riskTolerance: 0.15, decisionSpeed: 0.4 },
  // 浪漫 → 中等风险、快决策
  romantic: { riskTolerance: 0.5, decisionSpeed: 0.6 },
  // 愤怒 → 高风险、极快决策
  angry: { riskTolerance: 0.95, decisionSpeed: 0.95 },
  // 怀旧 → 低风险、慢决策
  nostalgic: { riskTolerance: 0.25, decisionSpeed: 0.35 },
  // 梦幻 → 中等风险、中等决策
  dreamy: { riskTolerance: 0.6, decisionSpeed: 0.5 },
};

/**
 * BPM → 决策速度映射
 */
export const BPM_SPEED_MAP = {
  slow: { range: [0, 70], decisionSpeed: 0.3, label: '慢速 · 深思熟虑' },
  medium: { range: [70, 110], decisionSpeed: 0.5, label: '中速 · 稳健决策' },
  fast: { range: [110, 150], decisionSpeed: 0.75, label: '快速 · 敏锐反应' },
  very_fast: { range: [150, 200], decisionSpeed: 0.9, label: '极速 · 直觉驱动' },
};

// ============================================================
// 核心引擎
// ============================================================

class MusicProfileEngine {
  constructor() {
    this.profile = null;
    this._loadProfile();
  }

  _loadProfile() {
    try {
      const saved = storage.get('musicProfile');
      if (saved && saved.version) {
        this.profile = saved;
        logger.session('[音乐引擎] 加载已有画像', {
          genres: Object.keys(saved.genreDistribution || {}).length,
          tracks: saved.totalTracks || 0,
        });
      }
    } catch (e) {
      logger.error('[音乐引擎] 加载画像失败', e);
    }
  }

  _saveProfile() {
    if (this.profile) {
      storage.set('musicProfile', this.profile);
    }
  }

  /**
   * 从网易云歌单数据构建音乐画像
   * @param {Object} neteaseData - 网易云 API 返回的歌单数据
   * @returns {Object} 音乐画像
   */
  buildFromNetease(neteaseData) {
    if (!neteaseData || !Array.isArray(neteaseData.tracks)) {
      logger.warn('[音乐引擎] 歌单数据格式无效');
      return null;
    }

    logger.session('[音乐引擎] 开始构建画像', {
      playlistCount: neteaseData.playlists?.length || 0,
      trackCount: neteaseData.tracks.length,
    });

    const tracks = neteaseData.tracks;
    const profile = {
      version: '1.0',
      createdAt: Date.now(),
      source: 'netease',
      totalTracks: tracks.length,
      genreDistribution: this._analyzeGenres(tracks),
      bpmDistribution: this._analyzeBPM(tracks),
      emotionDistribution: this._analyzeEmotions(tracks),
      eraDistribution: this._analyzeEras(tracks),
      artistDiversity: this._analyzeArtists(tracks),
      // 计算综合音乐画像
      computedTraits: {},
      // 映射到行为向量
      behaviorVector: {},
    };

    // 计算综合特质
    profile.computedTraits = this._computeTraits(profile);

    // 映射到行为向量
    profile.behaviorVector = this._mapToBehaviorVector(profile);

    this.profile = profile;
    this._saveProfile();

    logger.session('[音乐引擎] 画像构建完成', {
      dominantGenre: this._getDominantGenre(profile),
      dominantEmotion: this._getDominantEmotion(profile),
      riskInclination: profile.behaviorVector.riskTolerance,
    });

    return profile;
  }

  /**
   * 从用户手动选择构建画像
   * @param {Object} manualInput - 用户选择的风格/情绪
   */
  buildFromManualSelection(manualInput) {
    const profile = {
      version: '1.0',
      createdAt: Date.now(),
      source: 'manual',
      totalTracks: 0,
      genreDistribution: {},
      bpmDistribution: {},
      emotionDistribution: {},
      eraDistribution: {},
      artistDiversity: {},
      computedTraits: {},
      behaviorVector: {},
    };

    // 处理手动选择
    if (manualInput.genres) {
      manualInput.genres.forEach((g) => {
        profile.genreDistribution[g] = (profile.genreDistribution[g] || 0) + 1;
      });
    }

    if (manualInput.emotions) {
      manualInput.emotions.forEach((e) => {
        profile.emotionDistribution[e] = (profile.emotionDistribution[e] || 0) + 1;
      });
    }

    if (manualInput.bpm) {
      profile.bpmDistribution[manualInput.bpm] = 1;
    }

    // 计算特质
    profile.computedTraits = this._computeTraits(profile);
    profile.behaviorVector = this._mapToBehaviorVector(profile);

    this.profile = profile;
    this._saveProfile();
    return profile;
  }

  /**
   * 分析曲风分布
   */
  _analyzeGenres(tracks) {
    const dist = {};
    tracks.forEach((t) => {
      const genre = t.genre || t.style || 'unknown';
      dist[genre] = (dist[genre] || 0) + 1;
    });
    // 归一化
    const total = tracks.length;
    Object.keys(dist).forEach((k) => {
      dist[k] = dist[k] / total;
    });
    return dist;
  }

  /**
   * 分析 BPM 分布
   */
  _analyzeBPM(tracks) {
    const bpmBuckets = { slow: 0, medium: 0, fast: 0, very_fast: 0 };
    tracks.forEach((t) => {
      const bpm = t.bpm || 100;
      if (bpm < 70) bpmBuckets.slow++;
      else if (bpm < 110) bpmBuckets.medium++;
      else if (bpm < 150) bpmBuckets.fast++;
      else bpmBuckets.very_fast++;
    });
    const total = tracks.length;
    Object.keys(bpmBuckets).forEach((k) => {
      bpmBuckets[k] = bpmBuckets[k] / total;
    });
    return bpmBuckets;
  }

  /**
   * 分析情绪分布
   */
  _analyzeEmotions(tracks) {
    const dist = {};
    tracks.forEach((t) => {
      if (t.emotion && EMOTION_VECTOR_MAP[t.emotion]) {
        dist[t.emotion] = (dist[t.emotion] || 0) + 1;
      }
    });
    const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
    Object.keys(dist).forEach((k) => {
      dist[k] = dist[k] / total;
    });
    return dist;
  }

  /**
   * 分析年代分布
   */
  _analyzeEras(tracks) {
    const eras = { before2000: 0, y2000s: 0, y2010s: 0, y2020s: 0 };
    tracks.forEach((t) => {
      const year = t.year || t.publishTime || 2015;
      if (year < 2000) eras.before2000++;
      else if (year < 2010) eras.y2000s++;
      else if (year < 2020) eras.y2010s++;
      else eras.y2020s++;
    });
    const total = tracks.length;
    Object.keys(eras).forEach((k) => {
      eras[k] = eras[k] / total;
    });
    return eras;
  }

  /**
   * 分析艺人多样性
   */
  _analyzeArtists(tracks) {
    const artistCount = {};
    tracks.forEach((t) => {
      const artists = t.artists || [];
      artists.forEach((a) => {
        artistCount[a.name || a.id || 'unknown'] =
          (artistCount[a.name || a.id || 'unknown'] || 0) + 1;
      });
    });
    const uniqueArtists = Object.keys(artistCount).length;
    const totalTracks = tracks.length;
    // 多样性指数：艺人数量/总曲目数（越高越分散）
    return {
      uniqueCount: uniqueArtists,
      diversityRatio: totalTracks > 0 ? uniqueArtists / totalTracks : 0,
      topArtists: Object.entries(artistCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
    };
  }

  /**
   * 计算综合音乐特质
   */
  _computeTraits(profile) {
    const traits = {
      // 风险倾向：基于曲风+情绪
      riskInclination: 0.5,
      // 开放性：曲风多样性
      openness: 0.5,
      // 能量水平：BPM 分布
      energyLevel: 0.5,
      // 情绪稳定性：情绪分布熵
      emotionalStability: 0.5,
      // 怀旧倾向：年代分布
      nostalgia: 0.5,
      // 创新接受度：新歌占比
      innovationAcceptance: 0.5,
    };

    // 风险倾向：摇滚/电子/嘻哈 → 高；古典/民谣 → 低
    const highRiskGenres = ['rock', 'electronic', 'hiphop', 'metal'];
    const lowRiskGenres = ['classical', 'folk', 'jazz'];
    Object.entries(profile.genreDistribution).forEach(([genre, ratio]) => {
      if (highRiskGenres.includes(genre)) traits.riskInclination += ratio * 0.3;
      if (lowRiskGenres.includes(genre)) traits.riskInclination -= ratio * 0.2;
    });

    // 开放性：艺人多样性
    traits.openness = profile.artistDiversity?.diversityRatio || 0.5;

    // 能量水平：BPM 加权
    Object.entries(profile.bpmDistribution).forEach(([bucket, ratio]) => {
      const speed = BPM_SPEED_MAP[bucket];
      if (speed) traits.energyLevel += ratio * speed.decisionSpeed;
    });

    // 怀旧倾向
    traits.nostalgia =
      (profile.eraDistribution?.before2000 || 0) * 0.8 +
      (profile.eraDistribution?.y2000s || 0) * 0.5 +
      (profile.eraDistribution?.y2010s || 0) * 0.2;

    // 创新接受度
    traits.innovationAcceptance =
      (profile.eraDistribution?.y2020s || 0) * 0.9 +
      (profile.eraDistribution?.y2010s || 0) * 0.5;

    // 归一化
    Object.keys(traits).forEach((k) => {
      traits[k] = Math.max(0, Math.min(1, traits[k]));
    });

    return traits;
  }

  /**
   * 映射到行为向量（与 vectorMapper.js 对接）
   * @returns {Object} 行为向量维度值
   */
  _mapToBehaviorVector(profile) {
    const vector = {
      riskTolerance: 0.5,
      decisionSpeed: 0.5,
      noveltySeeking: 0.5,
      emotionalStability: 0.5,
      patience: 0.5,
      aggression: 0.5,
      // 金融相关维度
      financialRiskTolerance: 0.5,
      tradingStyle: 0.5,
      marketSentiment: 0.5,
      valuationApproach: 0.5,
      riskManagement: 0.5,
    };

    const traits = profile.computedTraits || {};

    // 风险承受 → 音乐的风险倾向
    vector.riskTolerance = traits.riskInclination || 0.5;
    vector.financialRiskTolerance = traits.riskInclination || 0.5;

    // 决策速度 → BPM 分析
    const avgBpmSpeed =
      Object.entries(profile.bpmDistribution)
        .reduce((acc, [bucket, ratio]) => {
          const speed = BPM_SPEED_MAP[bucket];
          return acc + (speed ? speed.decisionSpeed * ratio : 0);
        }, 0) || 0.5;
    vector.decisionSpeed = avgBpmSpeed;

    // 新奇寻求 → 开放性 + 创新接受度
    vector.noveltySeeking =
      ((traits.openness || 0.5) + (traits.innovationAcceptance || 0.5)) / 2;

    // 情绪稳定性
    vector.emotionalStability = traits.emotionalStability || 0.5;

    // 耐心 → 慢速音乐偏好
    vector.patience = (profile.bpmDistribution?.slow || 0) * 0.8 + 0.3;

    // 攻击性 → 摇滚/金属偏好
    vector.aggression =
      (profile.genreDistribution?.rock || 0) * 0.6 +
      (profile.genreDistribution?.metal || 0) * 0.8;

    // 交易风格映射
    if (avgBpmSpeed > 0.7) {
      vector.tradingStyle = 0.8; // 短线交易
    } else if (avgBpmSpeed < 0.4) {
      vector.tradingStyle = 0.2; // 长线持有
    } else {
      vector.tradingStyle = 0.5; // 中线波段
    }

    // 市场情绪敏感度
    vector.marketSentiment = (traits.energyLevel || 0.5) * 0.6 + 0.2;

    // 估值方式：古典音乐偏好 → 基本面；电子/嘻哈 → 技术面
    const fundamentalGenres = ['classical', 'jazz', 'folk'];
    const technicalGenres = ['electronic', 'hiphop', 'rock'];
    let fundamentalScore = 0;
    let technicalScore = 0;
    Object.entries(profile.genreDistribution).forEach(([genre, ratio]) => {
      if (fundamentalGenres.includes(genre)) fundamentalScore += ratio;
      if (technicalGenres.includes(genre)) technicalScore += ratio;
    });
    vector.valuationApproach =
      fundamentalScore + technicalScore > 0
        ? fundamentalScore / (fundamentalScore + technicalScore)
        : 0.5;

    // 风险管理：情绪稳定性高 → 好的风控
    vector.riskManagement = traits.emotionalStability || 0.5;

    return vector;
  }

  /**
   * 获取画像摘要
   */
  getProfileSummary() {
    if (!this.profile) return null;

    const traits = this.profile.computedTraits;
    const vector = this.profile.behaviorVector;

    return {
      source: this.profile.source,
      totalTracks: this.profile.totalTracks,
      dominantGenre: this._getDominantGenre(this.profile),
      dominantEmotion: this._getDominantEmotion(this.profile),
      traits: {
        riskLevel: traits.riskInclination > 0.6 ? '高' : traits.riskInclination < 0.4 ? '低' : '中等',
        openness: traits.openness > 0.6 ? '开放' : '保守',
        energy: traits.energyLevel > 0.6 ? '高能量' : '低能量',
        nostalgia: traits.nostalgia > 0.6 ? '怀旧' : '现代',
      },
      behaviorHints: {
        riskTolerance: this._vectorLabel(vector.riskTolerance),
        decisionSpeed: this._vectorLabel(vector.decisionSpeed),
        tradingStyle: vector.tradingStyle > 0.7 ? '短线偏好' : vector.tradingStyle < 0.3 ? '长线偏好' : '中线偏好',
      },
      vector: this.profile.behaviorVector,
    };
  }

  _getDominantGenre(profile) {
    const entries = Object.entries(profile.genreDistribution);
    if (entries.length === 0) return '-';
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }

  _getDominantEmotion(profile) {
    const entries = Object.entries(profile.emotionDistribution);
    if (entries.length === 0) return '-';
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }

  _vectorLabel(value) {
    if (value > 0.7) return '高';
    if (value > 0.5) return '中高';
    if (value > 0.3) return '中低';
    return '低';
  }

  /**
   * 清空画像
   */
  clearProfile() {
    this.profile = null;
    storage.set('musicProfile', null);
    logger.session('[音乐引擎] 画像已清空');
  }

  getProfile() {
    return this.profile;
  }
}

export const musicProfileEngine = new MusicProfileEngine();

/**
 * 将音乐向量合并到用户行为向量
 * @param {Object} userVector - 用户已有向量
 * @param {Object} musicVector - 音乐分析得到的向量
 * @param {number} musicWeight - 音乐向量权重（0-1）
 * @returns {Object} 合并后的向量
 */
export function mergeMusicVector(userVector, musicVector, musicWeight = 0.3) {
  const merged = { ...userVector };
  const userWeight = 1 - musicWeight;

  Object.keys(musicVector).forEach((key) => {
    if (merged[key] !== undefined) {
      merged[key] =
        merged[key] * userWeight + musicVector[key] * musicWeight;
    }
  });

  return merged;
}
