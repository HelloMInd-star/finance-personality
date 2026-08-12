/**
 * 回味评分组件
 *
 * 闭环最后一环：喝后评分 → appStore.addFeedback → calibrateVector
 *
 * 视觉：深空紫金（磨砂玻璃 + 紫金渐变 + 金光悬浮）
 * 交互：1-5 星整体评分 + 可选细分维度（风味/香气/情绪）
 * 动画色全部走 CSS 变量
 */
import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import './FeedbackRating.css';

const DIM_OPTIONS = [
  { key: 'flavor', label: '风味' },
  { key: 'scent', label: '香气' },
  { key: 'mood', label: '情绪' },
];

const STAR_PATH =
  'M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7L12 17.8 5.7 21l1.7-7L2 9.5l7.1-.6L12 2z';

function Stars({ value, onPick, size = 'md', ariaLabel }) {
  return (
    <div className="fb-rating__stars" role="radiogroup" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`fb-star fb-star--${size} ${value >= n ? 'is-on' : ''}`}
          onClick={() => onPick(n)}
          aria-label={`${n} 分`}
          aria-pressed={value === n}
        >
          <svg viewBox="0 0 24 24" className="fb-star__svg">
            <path d={STAR_PATH} />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function FeedbackRating({ recipeId, scene, onSubmitted }) {
  const addFeedback = useAppStore((s) => s.addFeedback);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [dims, setDims] = useState({ flavor: 0, scent: 0, mood: 0 });
  const [expanded, setExpanded] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (rating === 0) return;
    const fb = {
      recipeId: recipeId || 'unknown',
      rating,
      dimensions: expanded
        ? { flavor: dims.flavor, scent: dims.scent, mood: dims.mood }
        : undefined,
      ts: Date.now(),
      scene: scene || undefined,
    };
    addFeedback(fb);
    setSubmitted(true);
    if (typeof onSubmitted === 'function') onSubmitted(fb);
  };

  const reset = () => {
    setRating(0);
    setHover(0);
    setDims({ flavor: 0, scent: 0, mood: 0 });
    setExpanded(false);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="fb-rating fb-rating--done">
        <div className="fb-rating__glow" />
        <div className="fb-rating__done-icon">✦</div>
        <div className="fb-rating__done-text">回味已记录</div>
        <div className="fb-rating__done-sub">向量已朝你的偏好微调</div>
        <button type="button" className="fb-rating__reset" onClick={reset}>
          再评一次
        </button>
      </div>
    );
  }

  return (
    <div className="fb-rating">
      <div className="fb-rating__header">
        <span className="fb-rating__title">回味评分</span>
        <span className="fb-rating__line" />
      </div>
      <div className="fb-rating__hint">这杯酒，给你的感受如何？</div>

      <div className="fb-rating__stars fb-rating__stars--main">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`fb-star fb-star--md ${
              (hover || rating) >= n ? 'is-on' : ''
            }`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} 分`}
            aria-pressed={rating === n}
          >
            <svg viewBox="0 0 24 24" className="fb-star__svg">
              <path d={STAR_PATH} />
            </svg>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="fb-rating__expand"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? '收起细分维度' : '细分维度评分（选填）'}
      </button>

      {expanded && (
        <div className="fb-rating__dims">
          {DIM_OPTIONS.map(({ key, label }) => (
            <div key={key} className="fb-rating__dim">
              <span className="fb-rating__dim-label">{label}</span>
              <Stars
                value={dims[key]}
                onPick={(n) =>
                  setDims((p) => ({ ...p, [key]: p[key] === n ? 0 : n }))
                }
                size="sm"
                ariaLabel={`${label}评分`}
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="fb-rating__submit"
        disabled={rating === 0}
        onClick={handleSubmit}
      >
        记录回味
      </button>
    </div>
  );
}
