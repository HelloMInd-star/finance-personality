/**
 * BartenderPageV2 · 调酒主页面（Level 2 + Level 3 升级版）
 *
 * 借鉴 Y.Mine 源项目 CocktailPage 三层信息架构：
 *   Ⅰ 时段校准横幅 · 同一人格在不同时段不同推荐（生物学昼夜节律）
 *   Ⅱ 五步成夜说明卡 · 评分后自动消失（与反馈回路闭环）
 *   Ⅲ CocktailBuilder · 步进式调酒搭建（封装 6 步流程）
 *   Ⅳ 结果展示 + FeedbackRating · 喝后评分 → 向量校准 → 影响下一杯
 *
 * 视觉：深空紫金（磨砂玻璃 + 紫金渐变 + 微妙发光）
 * 无 Ant Design 依赖
 */
import React, { useState, useMemo, useEffect } from 'react';
import CocktailBuilder from '../components/CocktailBuilder/CocktailBuilder';
import CocktailCard from '../components/CocktailCard/CocktailCard';
import FeedbackRating from '../components/FeedbackRating/FeedbackRating';
import FeedbackTimeline from '../components/FeedbackTimeline/FeedbackTimeline';
import VectorRadar from '../components/VectorRadar/VectorRadar';
import { useAppStore } from '../store/appStore';
import { storage } from '../utils/storage';
import { calibrateVector } from '../utils/feedbackEngine';
import { resolveTimeSlot, describeBiologyShift, applyBiologyShift } from '../utils/timeEngine';
import { deriveVectorFromContext } from '../utils/vectorDeriver';
import { logger } from '../utils/logger';
import './BartenderPageV2.css';

// 默认 11 维中性向量（值域 [0,1]）· 用于无 baseVector 时的兜底
const DEFAULT_VECTOR = new Array(11).fill(0.5);

const BartenderPageV2 = () => {
  // 阶段：builder / result
  const [stage, setStage] = useState('builder');
  const [recipe, setRecipe] = useState(null);
  const [context, setContext] = useState(null);
  // 本轮派生向量（用于结果页雷达图）
  const [derivedVector, setDerivedVector] = useState(null);

  // appStore 数据
  const data = useAppStore((s) => s.data);
  const refresh = useAppStore((s) => s.refresh);

  // 说明卡片关闭态 · sessionStorage 持久化
  const [dismissGuide, setDismissGuide] = useState(() => {
    try {
      return sessionStorage.getItem('ymine-bartender-guide-dismissed') === '1';
    } catch {
      return false;
    }
  });

  const dismissGuideCard = () => {
    setDismissGuide(true);
    try {
      sessionStorage.setItem('ymine-bartender-guide-dismissed', '1');
    } catch {
      /* sessionStorage 不可用 · 静默降级 */
    }
  };

  // 反馈历史 · 评分闭环回流
  const feedbackHistory = data?.feedbackHistory || [];
  const isFirstVisit = feedbackHistory.length === 0;

  // 评分后自动关闭说明卡（闭环语义）
  useEffect(() => {
    if (feedbackHistory.length > 0 && !dismissGuide) {
      dismissGuideCard();
    }
  }, [feedbackHistory.length, dismissGuide]);

  // ====== 持久化基础向量 ======
  // 从 storage 读取；若无则用 DEFAULT_VECTOR 兜底
  const baseVector = useMemo(() => {
    const stored = storage.getBaseVector();
    if (Array.isArray(stored) && stored.length === 11) {
      logger.session('[BartenderPageV2] 读取持久化 baseVector', stored.map((v) => +v.toFixed(2)));
      return stored;
    }
    return DEFAULT_VECTOR;
  }, [data]);

  // ====== 时段校准 ======
  const currentSlot = useMemo(() => resolveTimeSlot(new Date()), []);
  const bioShifts = useMemo(() => describeBiologyShift(currentSlot), [currentSlot]);

  // 校准向量：baseVector + feedbackHistory 校准
  const calibratedVector = useMemo(() => {
    return calibrateVector(baseVector, feedbackHistory);
  }, [baseVector, feedbackHistory]);

  // 动态向量：校准向量 + 时段偏移（当前推荐用）
  const dynamicVector = useMemo(() => {
    return applyBiologyShift(calibratedVector, currentSlot);
  }, [calibratedVector, currentSlot]);

  // ====== CocktailBuilder 完成 ======
  const handleComplete = (r, ctx) => {
    setRecipe(r);
    setContext(ctx);
    setStage('result');

    // 派生向量并持久化（仅首次调酒写入）
    const derived = deriveVectorFromContext(ctx);
    setDerivedVector(derived);

    const stored = storage.getBaseVector();
    if (!Array.isArray(stored) || stored.length !== 11) {
      storage.setBaseVector(derived);
      logger.session('[BartenderPageV2] 首次调酒，写入 baseVector', derived.map((v) => +v.toFixed(2)));
    } else {
      logger.session('[BartenderPageV2] 已有 baseVector，本轮派生向量仅用于展示', derived.map((v) => +v.toFixed(2)));
    }

    logger.session('[BartenderPageV2] 配方生成', r?.name);
  };

  // ====== FeedbackRating 提交后回调 ======
  const handleFeedbackSubmitted = (fb) => {
    logger.session('[BartenderPageV2] 评分已提交', fb);
    // 触发 appStore 刷新（FeedbackRating 内部已调 addFeedback）
    refresh();
  };

  // ====== 存档到故事集 ======
  const [isSaved, setIsSaved] = useState(false);
  useEffect(() => {
    setIsSaved(false);
  }, [recipe]);

  const handleSaveToStories = () => {
    if (!recipe || isSaved) return;
    const session = {
      bartender: context?.bartender?.key,
      bartenderName: context?.bartender?.name,
      emotion: context?.emotion,
      baseSpirit: context?.baseSpirit,
      storySeed: context?.storySeed,
      specialNote: context?.specialNote,
      zodiacCorrect: context?.zodiacCorrect,
      cocktail: recipe,
      createdAt: Date.now(),
    };
    storage.addBartenderSession(session);
    setIsSaved(true);
    refresh();
    logger.session('[BartenderPageV2] 配方已存档', recipe.name);
  };

  // ====== 重新开始 ======
  const handleRestart = () => {
    setStage('builder');
    setRecipe(null);
    setContext(null);
    setIsSaved(false);
  };

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <div className="bp2-page">
      {/* 页面标题区 */}
      <header className="bp2-header">
        <h1 className="bp2-title">调酒 · Elixir</h1>
        <p className="bp2-subtitle">每一杯，都是夜为你写下的一则注脚。</p>
        <div className="bp2-divider" />
      </header>

      {/* Ⅰ · 时段校准横幅 */}
      <section
        className="bp2-time-banner"
        style={{
          '--slot-color': currentSlot.auraColor,
          background: `linear-gradient(135deg, ${currentSlot.auraColor}11, rgba(30, 19, 64, 0.6))`,
        }}
      >
        <div className="bp2-time-banner__orb">
          <span
            className="bp2-time-banner__orb-dot"
            style={{ background: currentSlot.auraColor, boxShadow: `0 0 10px ${currentSlot.auraColor}` }}
          />
          <div>
            <div className="bp2-time-banner__label">时段校准</div>
            <div className="bp2-time-banner__slot">
              {currentSlot.label} · {currentSlot.orbState}
            </div>
          </div>
        </div>
        <div className="bp2-time-banner__note">
          {currentSlot.biologyNote} · {currentSlot.poem}
        </div>
        {bioShifts.length > 0 && (
          <div className="bp2-time-banner__shifts">
            {bioShifts.map((s) => (
              <span
                key={s.dim}
                className={s.sign === '+' ? 'bp2-shift bp2-shift--up' : 'bp2-shift bp2-shift--down'}
              >
                {s.label}{s.sign}{s.delta.toFixed(2)}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Ⅱ · 五步成夜说明卡 · 仅首次进入且未关闭时展示 · 评分后自动消失 */}
      {stage === 'builder' && isFirstVisit && !dismissGuide && (
        <section className="bp2-guide">
          <div className="bp2-guide__header">
            <span className="bp2-guide__icon">◆</span>
            <div>
              <div className="bp2-guide__eyebrow">How It Works · 使用指南</div>
              <h3 className="bp2-guide__title">人格调酒 · 五步成夜</h3>
            </div>
          </div>
          <ol className="bp2-guide__steps">
            {[
              { n: '①', t: '调酒师选择', d: '锁定风格基调' },
              { n: '②', t: '六步采集', d: '情绪/基酒/提问/手记/星座/笔记' },
              { n: '③', t: '生成配方', d: '分子调酒引擎派生' },
              { n: '④', t: '喝后评分', d: '收集味觉信号' },
              { n: '⑤', t: '向量校准', d: '下一杯更懂你' },
            ].map((step, idx) => (
              <li key={step.n} className="bp2-guide__step">
                <span className="bp2-guide__step-num">{step.n}</span>
                <span className="bp2-guide__step-title">{step.t}</span>
                <span className="bp2-guide__step-desc">{step.d}</span>
                {idx < 4 && <span className="bp2-guide__step-arrow">→</span>}
              </li>
            ))}
          </ol>
          <p className="bp2-guide__loop">
            第 ④⑤步构成反馈回路 · 你的每一次评分都会校准向量，让下一杯更贴近此刻的你。
          </p>
          <button type="button" className="bp2-guide__close" onClick={dismissGuideCard}>
            了解了 · 入夜
          </button>
        </section>
      )}

      {/* Ⅲ · CocktailBuilder · 6 步流程 */}
      {stage === 'builder' && (
        <CocktailBuilder
          onComplete={handleComplete}
          dynamicVector={dynamicVector}
        />
      )}

      {/* Ⅳ · 结果展示 + 反馈回路 */}
      {stage === 'result' && recipe && (
        <section className="bp2-result">
          <header className="bp2-result__header">
            <button type="button" className="bp2-btn bp2-btn--ghost" onClick={handleRestart}>
              ← 再来一杯
            </button>
            <div className="bp2-result__bartender">
              {context?.bartender?.icon} {context?.bartender?.name}
            </div>
          </header>

          <CocktailCard data={recipe} bartender={context?.bartender} />

          {/* 向量可视化 · 三向量对比（基础 / 校准 / 动态） */}
          <VectorRadar
            baseVector={baseVector}
            calibratedVector={calibratedVector}
            dynamicVector={dynamicVector}
            title="人格向量 · 三态对比"
            size={380}
          />

          {/* 喝后评分 · 反馈回路闭环节点 */}
          <FeedbackRating
            recipeId={`bp2-${recipe?.name || 'unknown'}`}
            scene="bartender-classic"
            onSubmitted={handleFeedbackSubmitted}
          />

          {/* 校准反馈提示 · 评分后展示 */}
          {feedbackHistory.length > 0 && (
            <div className="bp2-calibrated">
              <span className="bp2-calibrated__dot" />
              <span className="bp2-calibrated__text">
                向量已校准 · {feedbackHistory.length} 次评分累积 · 下一杯会更贴近此刻的你
              </span>
            </div>
          )}

          {/* 评分历史时间线 · 仅在有评分时展示 */}
          {feedbackHistory.length > 0 && (
            <FeedbackTimeline history={feedbackHistory} maxItems={10} />
          )}

          {/* 存档按钮 */}
          <div className="bp2-result__actions">
            <button
              type="button"
              className={`bp2-btn ${isSaved ? 'bp2-btn--saved' : 'bp2-btn--primary'}`}
              onClick={handleSaveToStories}
              disabled={isSaved}
            >
              {isSaved ? '✓ 已存档到故事集' : '存档到故事集'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default BartenderPageV2;
