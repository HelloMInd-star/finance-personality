/**
 * 塔罗指引模块 · 仪式版
 * 扇形牌阵选牌 → 3D 翻牌 → 分段叙事结果(牌面/牌意/人格/AI/今夜歌单)
 * 深空粒子背景(Canvas) + 氛围光点 + 金辉标题
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { drawRandomCard } from './tarotData.js';
import { getMoodForCard, playlistEmbedUrl, playlistPageUrl } from './tarotPlaylist.js';
import TarotCard from './TarotCard.jsx';
import ZodiacCard from '../ZodiacModule/ZodiacCard.jsx';
import { storage } from '../../utils/storage';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';
import './TarotDraw.css';

// MBTI → 简短人格描述(用于结果页展示)
const MBTI_DESC = {
  INTJ: '系统架构师', INTP: '逻辑思考者', ENTJ: '战略指挥官', ENTP: '创新辩论家',
  INFJ: '理想引路人', INFP: '理想主义诗人', ENFJ: '激励型导师', ENFP: '热情探索者',
  ISTJ: '秩序守护者', ISFJ: '温柔守护者', ESTJ: '执行管理者', ESFJ: '温暖组织者',
  ISTP: '精准工匠', ISFP: '美学行者', ESTP: '行动冒险家', ESFP: '活力表演者',
};

// 扇形牌阵布局:7 张牌背,以底部为轴扇形展开(hover 效果走 CSS 变量叠加)
const FAN_LAYOUT = Array.from({ length: 7 }).map((_, i) => {
  const offset = i - 3; // -3..3
  return {
    '--fan-rotate': `${offset * 9}deg`,
    '--fan-y': `${Math.abs(offset) * 12}px`,
    zIndex: 7 - Math.abs(offset),
  };
});

export default function TarotDraw() {
  const navigate = useNavigate();
  const [stage, setStage] = useState('idle'); // idle | drawing | revealed
  const [card, setCard] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [glowActive, setGlowActive] = useState(false);
  const [aiReading, setAiReading] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState(null);
  const hasToken = !!localStorage.getItem('auth_token');
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  // === 深空粒子背景 ===
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      // 生成粒子(密度随面积调整)
      const count = Math.min(60, Math.floor((canvas.width * canvas.height) / 12000));
      particles = Array.from({ length: count }).map(() => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        opacity: Math.random() * 0.5 + 0.1,
        twinkle: Math.random() * Math.PI * 2,
      }));
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.twinkle += 0.02;
        // 边界环绕
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        const alpha = p.opacity * (0.5 + 0.5 * Math.sin(p.twinkle));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
        ctx.fill();
      });
      animRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // === 抽牌(扇阵中选一张触发) ===
  const handleDraw = useCallback(() => {
    if (stage === 'drawing') return;
    const drawn = drawRandomCard();
    setCard(drawn);
    setFlipped(false);
    setGlowActive(false);
    setStage('drawing');

    // 短暂延迟后触发翻转(让牌背先显示)
    setTimeout(() => {
      setFlipped(true);
      setGlowActive(true);
      // 翻转动画完成后显示结果
      setTimeout(() => {
        setStage('revealed');
        saveDraw(drawn);
        logger.session('[塔罗] 抽牌完成', { card: drawn.name, mbti: drawn.mbti });
      }, 900);
    }, 300);
  }, [stage]);

  // === 保存抽牌记录到 localStorage ===
  const saveDraw = (drawnCard) => {
    try {
      const record = {
        cardId: drawnCard.id,
        cardName: drawnCard.name,
        mbti: drawnCard.mbti,
        drawnAt: Date.now(),
        context: 'entry',
      };
      storage.setUserState({ tarotDraw: record });
      storage.update('tarotHistory', (prev) => {
        const hist = Array.isArray(prev) ? prev : [];
        hist.push(record);
        if (hist.length > 30) hist.shift();
        return hist;
      });
    } catch (e) {
      logger.error('[塔罗] 保存失败', e);
    }
  };

  // === 揭晓后:已登录则调用 AI 个性化解牌(未登录保持本地牌意,不触发花钱请求) ===
  useEffect(() => {
    if (stage !== 'revealed' || !card || !hasToken) return;
    let cancelled = false;
    setAiLoading(true);
    setAiReading(null);
    apiClient.llmGenerate('tarot_reading', {
      card_name: card.name,
      card_name_en: card.nameEn,
      keywords: (card.keywords || []).join('、'),
      meaning: card.meaning,
      mbti: card.mbti,
      mbti_desc: MBTI_DESC[card.mbti] || '',
    }).then((res) => {
      if (!cancelled && res?.text) setAiReading(res.text);
    }).catch(() => {
      // 静默降级:本地牌意兜底
    }).finally(() => {
      if (!cancelled) setAiLoading(false);
    });
    // 并联:今日行动建议(同条件触发,独立降级)
    setAiAdvice(null);
    apiClient.llmGenerate('tarot_advice', {
      card_name: card.name,
      keywords: (card.keywords || []).join('、'),
      mbti: card.mbti,
    }).then((res) => {
      if (!cancelled && res?.text) setAiAdvice(res.text);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [stage, card, hasToken]);

  const handleRedraw = () => {
    setStage('idle');
    setFlipped(false);
    setGlowActive(false);
    setCard(null);
  };

  // === 进入分子调酒 ===
  const handleEnterBartender = () => {
    logger.session('[塔罗] 进入分子调酒', { tarotMbti: card?.mbti });
    navigate('/bartender');
  };

  const mbtiDesc = card ? (MBTI_DESC[card.mbti] || '人格探索者') : '';
  const mood = card ? getMoodForCard(card.id) : null;

  return (
    <div className="tarot-module">
      <canvas ref={canvasRef} className="tarot-particle-bg" />

      {/* 氛围光点(漂浮紫金光斑) */}
      <div className="tarot-aura">
        <span className="tarot-aura-dot tarot-aura-dot-1" />
        <span className="tarot-aura-dot tarot-aura-dot-2" />
        <span className="tarot-aura-dot tarot-aura-dot-3" />
      </div>

      {/* 标题 */}
      <div className="tarot-header">
        <div className="tarot-header-icon">✦</div>
        <h1 className="tarot-header-title">
          {stage === 'revealed' ? '你的指引牌' : '今夜，抽一张指引牌'}
        </h1>
        <div className="tarot-header-sub">
          {stage === 'revealed'
            ? '让牌面成为你今夜的人格底色'
            : '牌阵已布好，凭直觉选一张'}
        </div>
      </div>

      {/* 扇形牌阵(idle 阶段) */}
      {stage === 'idle' && (
        <>
          <div className="tarot-fan">
            {FAN_LAYOUT.map((style, i) => (
              <div
                key={i}
                className="tarot-fan-card"
                style={style}
                onClick={handleDraw}
              >
                <span className="tarot-fan-card-symbol">✦</span>
              </div>
            ))}
          </div>
          <div className="tarot-fan-hint">凭直觉，选一张</div>
          <div className="tarot-draw-hint">22 张大牌 · 对应 16 种人格</div>
        </>
      )}

      {/* 中央牌面舞台(抽牌后) */}
      {stage !== 'idle' && (
        <div className="tarot-card-stage">
          <div className={`tarot-glow-ring ${glowActive ? 'active' : ''}`} />
          <div className={`tarot-card-inner ${flipped ? 'flipped' : ''}`}>
            {/* 牌背 */}
            <div className="tarot-card-back">
              <span className="tarot-card-back-symbol">✦</span>
            </div>

            {/* 牌面正面 */}
            <div className="tarot-card-front">
              {card && <TarotCard card={card} />}
            </div>
          </div>
        </div>
      )}

      {/* 抽牌中提示 */}
      {stage === 'drawing' && !flipped && (
        <div className="tarot-draw-hint">牌面正在翻转…</div>
      )}

      {/* 结果区域 · 分段叙事 */}
      {stage === 'revealed' && card && mood && (
        <div className="tarot-result">
          {/* 第一章 · 牌面 */}
          <div className="tarot-section" style={{ animationDelay: '0.05s' }}>
            <div className="tarot-result-name">{card.name}</div>
            <div className="tarot-result-name-en">{card.nameEn}</div>
            <div className="tarot-result-keywords">
              {card.keywords.map((kw) => (
                <span className="tarot-keyword-tag" key={kw}>{kw}</span>
              ))}
            </div>
          </div>

          {/* 第二章 · 牌意 */}
          <div className="tarot-section" style={{ animationDelay: '0.2s' }}>
            <div className="tarot-section-title">✦ 牌 意</div>
            <div className="tarot-result-meaning">{card.meaning}</div>
            <div className="tarot-result-mbti">
              <span className="tarot-mbti-icon">🔮</span>
              <span className="tarot-mbti-label">对应人格</span>
              <span className="tarot-mbti-value">{card.mbti}</span>
              <span className="tarot-mbti-desc">· {mbtiDesc}</span>
            </div>
          </div>

          {/* 第三章 · AI 解牌师(登录态真调 DeepSeek;未登录引导解锁) */}
          <div className="tarot-section tarot-section-wide" style={{ animationDelay: '0.35s' }}>
            {hasToken ? (
              <div className="tarot-ai-reading">
                <div className="tarot-ai-label">✦ AI 驻馆解牌师 · 为你凝视此牌</div>
                {aiLoading ? (
                  <div className="tarot-ai-loading">解牌师正在凝视牌面…</div>
                ) : aiReading ? (
                  <div className="tarot-ai-text">{aiReading}</div>
                ) : null}
                {aiAdvice && (
                  <div className="tarot-ai-advice">
                    <div className="tarot-ai-label">✦ 今日行动指引</div>
                    <div className="tarot-ai-text">{aiAdvice}</div>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="tarot-ai-locked"
                onClick={() => navigate('/login', { state: { from: '/tarot' } })}
              >
                ✦ 登录解锁 AI 个性化解牌 →
              </button>
            )}
          </div>

          {/* 第四章 · 今夜歌单(按牌映射氛围 × 网易云) */}
          <div className="tarot-section tarot-section-wide" style={{ animationDelay: '0.5s' }}>
            <div className="tarot-playlist">
              <div className="tarot-playlist-label">✦ 今夜歌单 · {mood.name}</div>
              <div className="tarot-playlist-desc">{mood.desc}</div>
              <iframe
                className="tarot-playlist-frame"
                title={`今夜歌单-${mood.name}`}
                src={playlistEmbedUrl(mood.playlistId)}
                loading="lazy"
              />
              <a
                className="tarot-playlist-link"
                href={playlistPageUrl(mood.playlistId)}
                target="_blank"
                rel="noreferrer"
              >
                在网易云打开 · {mood.playlistName} →
              </a>
            </div>
          </div>

          {/* 动作 */}
          <div className="tarot-section" style={{ animationDelay: '0.65s' }}>
            <div className="tarot-actions">
              <button
                className="tarot-action-btn tarot-action-primary"
                onClick={handleEnterBartender}
              >
                进入分子调酒 →
              </button>
              <button
                className="tarot-action-btn tarot-action-secondary"
                onClick={handleRedraw}
              >
                重新抽牌
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 星盘印证(人格画像印证·与塔罗同属神秘学专区) */}
      <div style={{ width: '100%', maxWidth: 640, marginTop: 40 }}>
        <ZodiacCard />
      </div>
    </div>
  );
}
