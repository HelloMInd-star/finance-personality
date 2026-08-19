/**
 * 人格音乐画像 · PersonaMusic
 *
 * 蓝图第 4 站：六维向量 → 音乐风格推荐 + Web Audio 氛围合成 + 主题曲解锁
 *  - 🌑 真实人格：baseVector → 桥接六维（护照同源）
 *  - 🎭 社交面具：自评 MBTI → 原型六维（护照同源）
 *  - 12 风格推荐 / 10 原型歌单 / 合成参数：人格实验室 IP 原样移植
 *  - 主题曲彩蛋：向量落入 ISFJ 区间 → 解锁《Sweater Weather》
 *
 * 数据全部本地（算留本地）：storage.userState.currentMbti / storage.baseVector
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../../utils/storage';
import {
  DIMS,
  bridgeBaseVector,
  getMaskVector,
  findClosestArchetype,
} from '../PassportModule/passportData';
import {
  getStyleRecommendations,
  getPlaylistRecommendations,
  getAudioParams,
  themeUnlocked,
  themeDistance,
  THEME_SONG,
} from './personaMusicData';
import './PersonaMusic.css';

const DIM_KEYS = DIMS.map((d) => d.key);

// ── Web Audio 氛围合成器（demos IP 原样算法，React ref 化管理） ──
function createReverbBuffer(ctx, duration, decay) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * decay));
    }
  }
  return buffer;
}

function PersonaMusic() {
  const navigate = useNavigate();

  const [mbti] = useState(() => storage.getUserState()?.currentMbti || 'INTJ');
  const [baseVector] = useState(() => storage.getBaseVector());

  const trueVec = useMemo(() => bridgeBaseVector(baseVector), [baseVector]);
  const maskVec = useMemo(() => getMaskVector(mbti), [mbti]);

  const [side, setSide] = useState(trueVec ? 'true' : 'mask');
  const vec = side === 'true' && trueVec ? trueVec : maskVec;
  const archetype = useMemo(() => (vec ? findClosestArchetype(vec) : null), [vec]);

  const styles = useMemo(() => (vec ? getStyleRecommendations(vec) : []), [vec]);
  const playlists = useMemo(() => (vec ? getPlaylistRecommendations(vec) : []), [vec]);
  const audioParams = useMemo(() => (vec ? getAudioParams(vec) : null), [vec]);

  const unlocked = vec ? themeUnlocked(vec) : false;
  const dist = vec ? themeDistance(vec) : 99;

  // ── 氛围合成器状态 ──
  const audioCtxRef = useRef(null);
  const nodesRef = useRef([]);
  const [ambientPlaying, setAmbientPlaying] = useState(false);

  // ── 主题曲播放器状态 ──
  const themeAudioRef = useRef(null);
  const [themePlaying, setThemePlaying] = useState(false);

  const stopAmbient = () => {
    const ctx = audioCtxRef.current;
    if (ctx) {
      const now = ctx.currentTime;
      try {
        nodesRef.current
          .filter((n) => n instanceof GainNode && n.gain)
          .forEach((g) => g.gain.linearRampToValueAtTime(0, now + 0.3));
      } catch (e) { /* noop */ }
      setTimeout(() => {
        nodesRef.current.forEach((node) => {
          try {
            if (node.stopTimer) clearTimeout(node.stopTimer);
            if (node.pulseIntervalId) clearInterval(node.pulseIntervalId);
            if (node.stop && typeof node.stop === 'function') node.stop();
            if (node.disconnect && typeof node.disconnect === 'function') node.disconnect();
          } catch (e) { /* noop */ }
        });
        nodesRef.current = [];
      }, 400);
    }
    setAmbientPlaying(false);
  };

  const startAmbient = () => {
    if (ambientPlaying || !vec || !audioParams) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    const params = audioParams;
    const now = ctx.currentTime;
    const duration = 20; // 20 秒
    const active = nodesRef.current;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.5, now + 0.5);
    masterGain.connect(ctx.destination);
    active.push(masterGain);

    const convolver = ctx.createConvolver();
    convolver.buffer = createReverbBuffer(ctx, params.reverb, 2);
    const reverbGain = ctx.createGain();
    reverbGain.gain.setValueAtTime(params.reverb * 0.5, now);
    convolver.connect(reverbGain);
    reverbGain.connect(masterGain);
    active.push(convolver, reverbGain);

    for (let i = 0; i < params.layers; i++) {
      const layerDelay = i * 0.5;

      const oscLow = ctx.createOscillator();
      const gainLow = ctx.createGain();
      oscLow.type = i === 0 ? 'sine' : 'triangle';
      oscLow.frequency.setValueAtTime(params.bassFreq + i * 8, now + layerDelay);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.1 + i * 0.05, now);
      lfoGain.gain.setValueAtTime(3 + i, now);
      lfo.connect(lfoGain);
      lfoGain.connect(oscLow.frequency);
      lfo.start(now);
      oscLow.start(now + layerDelay);
      active.push(lfo, lfoGain, oscLow);

      gainLow.gain.setValueAtTime(0, now + layerDelay);
      gainLow.gain.linearRampToValueAtTime(params.lowVolume / params.layers, now + layerDelay + 0.3);
      oscLow.connect(gainLow);
      gainLow.connect(masterGain);
      gainLow.connect(convolver);
      active.push(gainLow);

      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) data[j] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(params.filterFreq + i * 400, now);
      bandpass.Q.setValueAtTime(0.7, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now + layerDelay);
      noiseGain.gain.linearRampToValueAtTime(params.highVolume / params.layers, now + layerDelay + 0.3);

      noise.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseGain.connect(convolver);
      noise.start(now + layerDelay);
      active.push(noise, bandpass, noiseGain);
    }

    const pulseInterval = 60 / params.tempo;
    const pulseOsc = ctx.createOscillator();
    const pulseGain = ctx.createGain();
    pulseOsc.type = 'sine';
    pulseOsc.frequency.setValueAtTime(90, now);
    pulseGain.gain.setValueAtTime(0, now);
    pulseOsc.connect(pulseGain);
    pulseGain.connect(masterGain);
    pulseOsc.start(now);
    active.push(pulseOsc, pulseGain);

    let pulseCount = 0;
    const maxPulses = Math.floor(duration / pulseInterval);
    const pulseIntervalId = setInterval(() => {
      if (pulseCount >= maxPulses) {
        clearInterval(pulseIntervalId);
        return;
      }
      const t = ctx.currentTime;
      pulseGain.gain.setValueAtTime(0.08, t);
      pulseGain.gain.exponentialRampToValueAtTime(0.001, t + pulseInterval * 0.5);
      pulseCount++;
    }, pulseInterval * 1000);

    const stopTimer = setTimeout(() => stopAmbient(), duration * 1000);
    active.push({ stopTimer, pulseIntervalId });
    setAmbientPlaying(true);
  };

  const toggleAmbient = () => {
    if (ambientPlaying) stopAmbient();
    else {
      if (themePlaying) toggleTheme(); // 避免混音
      startAmbient();
    }
  };

  const toggleTheme = () => {
    if (themePlaying && themeAudioRef.current) {
      themeAudioRef.current.pause();
      setThemePlaying(false);
      return;
    }
    if (ambientPlaying) stopAmbient(); // 避免混音
    if (!themeAudioRef.current) {
      themeAudioRef.current = new Audio(THEME_SONG.audioUrl);
      themeAudioRef.current.volume = 0.8;
      themeAudioRef.current.addEventListener('ended', () => setThemePlaying(false));
    }
    themeAudioRef.current
      .play()
      .then(() => setThemePlaying(true))
      .catch(() => setThemePlaying(false));
  };

  // 切面 / 卸载时清理音频
  useEffect(() => {
    stopAmbient();
    if (themeAudioRef.current) {
      themeAudioRef.current.pause();
      setThemePlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  useEffect(
    () => () => {
      stopAmbient();
      if (themeAudioRef.current) themeAudioRef.current.pause();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (!vec) return null;

  return (
    <div className="pm-wrap">
      {/* ── 双面开关 ── */}
      <div className="pm-side-bar">
        <div className="pm-side-switch">
          {trueVec && (
            <button
              className={`pm-side-btn true ${side === 'true' ? 'on' : ''}`}
              onClick={() => setSide('true')}
            >
              🌑 按真实人格
            </button>
          )}
          <button
            className={`pm-side-btn mask ${side === 'mask' ? 'on' : ''}`}
            onClick={() => setSide('mask')}
          >
            🎭 按社交面具
          </button>
        </div>
        <div className="pm-side-note">
          {side === 'true' && trueVec
            ? '你的行为说你最近听起来像这样'
            : `你口中的你（${mbti}）听起来像这样`}
          {archetype && (
            <span className="pm-arch">
              · 最近邻原型 <b>{archetype.name}</b>
            </span>
          )}
        </div>
      </div>

      {/* ── 六维向量条 ── */}
      <div className="pm-vec glass">
        {DIMS.map((d) => {
          const pct = Math.round((vec[d.key] ?? 0.5) * 100);
          return (
            <div className="pm-vec-row" key={d.key}>
              <span className="pm-vec-name" style={{ color: d.color }}>
                {d.icon} {d.name}
              </span>
              <div className="pm-vec-bar">
                <div className="pm-vec-fill" style={{ width: `${pct}%`, background: d.color }} />
              </div>
              <span className="pm-vec-val">{pct}%</span>
            </div>
          );
        })}
      </div>

      {/* ── 推荐风格 ── */}
      <div className="pm-section">
        <div className="pm-sec-title">推荐风格</div>
        <div className="pm-styles">
          {styles.map((s, i) => (
            <div className="pm-style-tag" key={s.key} style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="pm-style-name">{s.name}</div>
              <div className="pm-style-mood">
                {s.mood} · {s.bpm} BPM
              </div>
              <div className="pm-style-desc">{s.desc}</div>
              <div className="pm-style-arch">{s.archetype}原型</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 原型歌单 ── */}
      <div className="pm-section">
        <div className="pm-sec-title">原型氛围歌单</div>
        <div className="pm-playlists">
          {playlists.map((p, i) => (
            <div className="pm-pl-card glass" key={p.title} style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="pm-pl-title">{p.title}</div>
              <div className="pm-pl-mood">{p.mood}</div>
              <div className="pm-pl-songs">
                {p.songs.map(([name, artist]) => (
                  <div key={name}>
                    <span>{name}</span> — {artist}
                  </div>
                ))}
              </div>
              <div className="pm-pl-arch">{p.archetype}原型 · 曲风示意</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Web Audio 氛围合成 ── */}
      <div className="pm-section">
        <div className="pm-sec-title">人格氛围合成</div>
        <div className="pm-player glass">
          <button className={`pm-play-btn ${ambientPlaying ? 'playing' : ''}`} onClick={toggleAmbient}>
            {ambientPlaying ? '⏸ 停止播放' : '▶ 播放我的氛围音'}
          </button>
          <div className="pm-player-status">20 秒氛围音频 · 六维实时合成 · 无外部文件依赖</div>
          <div className="pm-param-bars">
            <div className="pm-param">
              <div className="pm-param-label">低频深度</div>
              <div className="pm-param-bar">
                <div className="pm-param-fill" style={{ width: `${(audioParams.bassFreq / 100) * 100}%`, background: '#A78BFA' }} />
              </div>
              <div className="pm-param-val">{audioParams.bassFreq.toFixed(0)} Hz</div>
            </div>
            <div className="pm-param">
              <div className="pm-param-label">高频亮度</div>
              <div className="pm-param-bar">
                <div className="pm-param-fill" style={{ width: `${(audioParams.highFreq / 2000) * 100}%`, background: '#22D3EE' }} />
              </div>
              <div className="pm-param-val">{audioParams.highFreq.toFixed(0)} Hz</div>
            </div>
            <div className="pm-param">
              <div className="pm-param-label">节奏</div>
              <div className="pm-param-bar">
                <div className="pm-param-fill" style={{ width: `${(audioParams.tempo / 120) * 100}%`, background: '#FBBF24' }} />
              </div>
              <div className="pm-param-val">{audioParams.tempo.toFixed(0)} BPM</div>
            </div>
          </div>
          <div className="pm-param-bars second">
            <div className="pm-param">
              <div className="pm-param-label">层数</div>
              <div className="pm-param-val">{audioParams.layers} 层</div>
            </div>
            <div className="pm-param">
              <div className="pm-param-label">混响</div>
              <div className="pm-param-val">{Math.round(audioParams.reverb * 100)}%</div>
            </div>
            <div className="pm-param">
              <div className="pm-param-label">滤波器</div>
              <div className="pm-param-val">{audioParams.filterFreq.toFixed(0)} Hz</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 人格主题曲 ── */}
      <div className="pm-section">
        <div className="pm-sec-title">人格主题曲{unlocked ? ' · 已解锁' : ''}</div>
        {unlocked ? (
          <div className="pm-theme-card glass unlocked">
            <div className="pm-theme-info">
              <div className="pm-theme-badge">{THEME_SONG.badge}</div>
              <div className="pm-theme-title">{THEME_SONG.title}</div>
              <div className="pm-theme-meta">{THEME_SONG.meta}</div>
              <div className="pm-theme-actions">
                <button className="pm-play-btn gold" onClick={toggleTheme}>
                  {themePlaying ? '⏸ 暂停' : '▶ 播放主题曲'}
                </button>
                <a className="pm-theme-link" href={THEME_SONG.playlistUrl} target="_blank" rel="noopener noreferrer">
                  网易云歌单《{THEME_SONG.playlistName}》↗
                </a>
              </div>
            </div>
            <div className="pm-theme-qr">
              <img src={THEME_SONG.qrUrl} alt="网易云歌单二维码" />
              <div className="pm-theme-qr-caption">扫码听完整版</div>
            </div>
          </div>
        ) : (
          <div className="pm-theme-card glass locked">
            <div className="pm-theme-lock-icon">♪</div>
            <div>
              <div className="pm-theme-lock-title">主题曲未解锁</div>
              <div className="pm-theme-lock-hint">
                当{side === 'true' && trueVec ? '真实人格' : '社交面具'}向量进入「守卫者 ISFJ」区间时，解锁第一首人格主题曲
                <br />
                <span className="pm-theme-clue">{THEME_SONG.clue}</span>
                <span className="pm-theme-dist">当前距离 {dist.toFixed(2)} / 解锁半径 0.20</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 真实面空态引导 ── */}
      {!trueVec && (
        <div className="pm-empty glass">
          <div className="pm-empty-emoji">🌑</div>
          <div className="pm-empty-title">真实人格面尚未采集</div>
          <div className="pm-empty-hint">去玩几局扑克、调几杯酒，你的行为会慢慢画出你的声音</div>
          <div className="pm-empty-actions">
            <button className="pm-empty-btn" onClick={() => navigate('/bartender')}>🍸 去调酒</button>
            <button className="pm-empty-btn" onClick={() => navigate('/poker')}>♠️ 去扑克</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonaMusic;
