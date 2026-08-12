import { logger } from './logger';

/**
 * K线音乐引擎
 * 把 K线数据翻译成听觉叙事
 *
 * 映射逻辑：
 * - 节奏：K线波动幅度 → BPM（波动大→快，波动小→慢）
 * - 音色：行业映射 → 振荡器类型（科技→方波，消费→正弦，能源→三角波）
 * - 调性：情绪值 → 大调/小调（情绪高→大调，情绪低→小调）
 * - 音高：K线价格位置 → 音阶中的音
 */

// 大调音阶（C大调）
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
// 小调音阶（C小调）
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];

// 行业音色映射
const INDUSTRY_TIMBRE = {
  tech: { type: 'square', gain: 0.15, label: '科技' },
  consumer: { type: 'sine', gain: 0.2, label: '消费' },
  energy: { type: 'triangle', gain: 0.18, label: '能源' },
  finance: { type: 'sawtooth', gain: 0.12, label: '金融' },
  default: { type: 'sine', gain: 0.18, label: '默认' }
};

class MusicEngine {
  constructor() {
    this.audioContext = null;
    this.isPlaying = false;
    this.currentTimers = [];
    this.currentNoteIndex = 0;
    this.totalNotes = 0;
    this.onProgress = null;
    this.onComplete = null;
    this.globalVolume = 0.7;
  }

  setVolume(v) {
    this.globalVolume = Math.max(0, Math.min(1, v));
  }

  _ensureContext() {
    if (!this.audioContext) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AC();
      logger.session('音乐引擎初始化', `采样率:${this.audioContext.sampleRate}Hz`);
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /**
   * 从K线数据计算音乐参数
   * @param {Array} klineData - K线数据 [{close, high, low, volume}, ...]
   * @param {Object} options - { mood: 0-1, industry: string }
   * @returns {Object} 音乐参数
   */
  analyzeKLine(klineData, options = {}) {
    if (!klineData || klineData.length < 2) {
      return { bpm: 80, scale: MAJOR_SCALE, timbre: INDUSTRY_TIMBRE.default, notes: [] };
    }

    // 1. 计算波动幅度 → BPM
    const returns = [];
    for (let i = 1; i < klineData.length; i++) {
      const prev = klineData[i - 1].close;
      const curr = klineData[i].close;
      returns.push(Math.abs((curr - prev) / prev));
    }
    const avgVolatility = returns.reduce((a, b) => a + b, 0) / returns.length;
    // 波动率 0.1% → BPM 60，波动率 5% → BPM 160
    const bpm = Math.min(180, Math.max(60, 60 + avgVolatility * 2000));

    // 2. 情绪值 → 调性
    const mood = options.mood ?? 0.5;
    const scale = mood >= 0.5 ? MAJOR_SCALE : MINOR_SCALE;
    const modeLabel = mood >= 0.5 ? '大调（乐观）' : '小调（谨慎）';

    // 3. 行业 → 音色
    const industry = options.industry || 'default';
    const timbre = INDUSTRY_TIMBRE[industry] || INDUSTRY_TIMBRE.default;

    // 4. 价格位置 → 音高序列
    const closes = klineData.map(d => d.close);
    const minPrice = Math.min(...closes);
    const maxPrice = Math.max(...closes);
    const priceRange = maxPrice - minPrice || 1;

    const notes = klineData.map((d, i) => {
      // 归一化价格到 0-1
      const normalized = (d.close - minPrice) / priceRange;
      // 映射到音阶索引
      const noteIdx = Math.floor(normalized * (scale.length - 1));
      // 成交量映射到音量
      const volNorm = d.volume ? Math.min(1, d.volume / 1000) : 0.5;

      return {
        semitone: scale[noteIdx],
        duration: 0.4,
        volume: 0.3 + volNorm * 0.5,
        price: d.close,
        index: i
      };
    });

    logger.session('K线音乐分析完成', {
      数据点: klineData.length,
      BPM: Math.round(bpm),
      调性: modeLabel,
      音色: timbre.label,
      情绪值: mood.toFixed(2)
    });

    return { bpm, scale, timbre, notes, modeLabel };
  }

  /**
   * 播放单个音符
   */
  _playNote(frequency, startTime, duration, timbre, volume) {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = timbre.type;
    osc.frequency.value = frequency;

    // ADSR 包络
    const baseGain = timbre.gain * volume * this.globalVolume;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(baseGain, startTime + 0.02); // Attack
    gain.gain.linearRampToValueAtTime(baseGain * 0.7, startTime + 0.1); // Decay
    gain.gain.linearRampToValueAtTime(baseGain * 0.7, startTime + duration - 0.05); // Sustain
    gain.gain.linearRampToValueAtTime(0, startTime + duration); // Release

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  /**
   * 播放 K线音乐
   */
  play(klineData, options = {}) {
    this._ensureContext();
    this.stop();

    const { bpm, timbre, notes, modeLabel } = this.analyzeKLine(klineData, options);
    this.totalNotes = notes.length;
    this.currentNoteIndex = 0;
    this.isPlaying = true;

    const beatDuration = 60 / bpm;
    const noteDuration = beatDuration * 0.8;
    const baseFreq = 261.63; // 中央 C

    logger.session('开始播放K线音乐', `BPM:${Math.round(bpm)} ${modeLabel} 音色:${timbre.label}`);

    // 调度所有音符
    const startTime = this.audioContext.currentTime + 0.1;

    notes.forEach((note, i) => {
      const freq = baseFreq * Math.pow(2, note.semitone / 12);
      const noteStart = startTime + i * noteDuration;

      this._playNote(freq, noteStart, noteDuration * note.duration, timbre, note.volume);

      // 进度回调
      const timer = setTimeout(() => {
        this.currentNoteIndex = i + 1;
        if (this.onProgress) {
          this.onProgress(i + 1, this.totalNotes, note);
        }
        if (i === notes.length - 1) {
          this.isPlaying = false;
          if (this.onComplete) this.onComplete();
          logger.session('K线音乐播放完成');
        }
      }, (i * noteDuration + 0.05) * 1000);
      this.currentTimers.push(timer);
    });

    return { bpm, modeLabel, timbreLabel: timbre.label, totalNotes: notes.length };
  }

  stop() {
    if (this.currentTimers.length > 0) {
      this.currentTimers.forEach(t => clearTimeout(t));
      this.currentTimers = [];
    }
    if (this.isPlaying) {
      logger.session('音乐停止');
    }
    this.isPlaying = false;
    this.currentNoteIndex = 0;
  }

  getProgress() {
    return {
      current: this.currentNoteIndex,
      total: this.totalNotes,
      isPlaying: this.isPlaying
    };
  }
}

export const musicEngine = new MusicEngine();

/**
 * 生成模拟K线数据（用于演示）
 * @param {number} count - 数据点数量
 * @param {Object} seed - 种子参数
 */
export function generateMockKLine(count = 30, seed = {}) {
  const {
    startPrice = 100,
    volatility = 0.02,
    trend = 0,
    industry = 'default'
  } = seed;

  const data = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5 + trend) * volatility * price;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
    const volume = Math.floor(100 + Math.random() * 500);

    data.push({
      time: i,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume
    });

    price = close;
  }

  return { data, industry };
}

/**
 * 从德州扑克历史数据生成 K 线
 * 筹码变化 → 价格走势
 */
export function generateKLineFromPokerHistory(pokerGames = []) {
  if (!pokerGames || pokerGames.length === 0) {
    return { data: generateMockKLine(30).data, source: '模拟数据' };
  }

  // 从每局游戏的筹码变化生成数据点
  const data = [];
  let cumulativeChips = 1000; // 初始筹码

  pokerGames.forEach((game, i) => {
    const profit = game.profit || game.result || 0;
    const open = cumulativeChips;
    const close = cumulativeChips + profit;
    const high = Math.max(open, close) + Math.abs(profit) * 0.3;
    const low = Math.min(open, close) - Math.abs(profit) * 0.3;
    const volume = game.hands || Math.floor(20 + Math.random() * 100);

    data.push({
      time: i,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
      gameId: game.id
    });

    cumulativeChips = close;
  });

  // 如果数据点太少，用模拟数据补充
  if (data.length < 10) {
    const mock = generateMockKLine(30 - data.length).data;
    mock.forEach((d, i) => {
      data.push({
        ...d,
        time: data.length + i
      });
    });
  }

  logger.session('生成K线', `数据源:德州历史 ${pokerGames.length}局, 补充模拟:${Math.max(0, 30 - pokerGames.length)}点`);

  return { data, source: `德州历史 ${pokerGames.length} 局` };
}

/**
 * 计算 K 线的技术指标
 */
export function calculateKLineStats(klineData) {
  if (!klineData || klineData.length < 2) {
    return { returnRate: 0, maxDD: 0, volatility: 0, avgVolume: 0 };
  }

  const start = klineData[0].close;
  const end = klineData[klineData.length - 1].close;
  const returnRate = ((end - start) / start) * 100;

  // 最大回撤
  let peak = klineData[0].close;
  let maxDD = 0;
  for (const d of klineData) {
    if (d.close > peak) peak = d.close;
    const dd = ((peak - d.close) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }

  // 波动率（收益率标准差）
  const returns = [];
  for (let i = 1; i < klineData.length; i++) {
    returns.push((klineData[i].close - klineData[i-1].close) / klineData[i-1].close);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - avgReturn) ** 2, 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100;

  // 平均成交量
  const avgVolume = klineData.reduce((a, b) => a + (b.volume || 0), 0) / klineData.length;

  return {
    returnRate: +returnRate.toFixed(2),
    maxDD: +maxDD.toFixed(2),
    volatility: +volatility.toFixed(2),
    avgVolume: Math.round(avgVolume)
  };
}
