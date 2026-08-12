/**
 * FeedbackTimeline · 评分历史时间线
 *
 * 展示 feedbackHistory 中的评分记录
 * 视觉：深空紫金 · 时间线形式 · 默认折叠
 *
 * 数据结构（来自 FeedbackRating 提交）：
 *   {
 *     id, timestamp,
 *     recipeId, rating, dimensions, scene
 *   }
 *
 * Props:
 *   - history: FeedbackSignal[] 评分历史
 *   - maxItems: number 最多展示条数（默认 10）
 */
import React, { useState, useMemo } from 'react';
import './FeedbackTimeline.css';

// ============================================================
// 工具
// ============================================================

const STAR_PATH =
  'M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7L12 17.8 5.7 21l1.7-7L2 9.5l7.1-.6L12 2z';

/** 相对时间格式化 */
function relativeTime(ts) {
  if (!ts) return '未知时间';
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 场景 label 映射 */
const SCENE_LABELS = {
  'bartender-classic': '经典调酒',
  'persona-bartender': '人格调酒',
  sandbox: '沙盘',
};

// ============================================================
// 子组件
// ============================================================

function MiniStars({ value }) {
  return (
    <div className="ft-stars" aria-label={`${value} 分`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          className={`ft-star ${value >= n ? 'is-on' : ''}`}
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </div>
  );
}

function TimelineItem({ item }) {
  const [expanded, setExpanded] = useState(false);
  const hasDims = item.dimensions && Object.values(item.dimensions).some((v) => v > 0);
  const sceneLabel = SCENE_LABELS[item.scene] || item.scene || '未分类';

  return (
    <li className="ft-item">
      <div className="ft-item__dot" />
      <div className="ft-item__content">
        <header className="ft-item__header">
          <span className="ft-item__time">{relativeTime(item.timestamp || item.ts)}</span>
          <span className="ft-item__scene">{sceneLabel}</span>
        </header>
        <div className="ft-item__main">
          <MiniStars value={item.rating} />
          <span className="ft-item__rating-num">{item.rating}.0</span>
          {hasDims && (
            <button
              type="button"
              className="ft-item__expand"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? '收起' : '详情'}
            </button>
          )}
        </div>
        {expanded && hasDims && (
          <div className="ft-item__dims">
            {Object.entries(item.dimensions).map(([k, v]) => (
              <div key={k} className="ft-item__dim">
                <span className="ft-item__dim-label">
                  {k === 'flavor' ? '风味' : k === 'scent' ? '香气' : k === 'mood' ? '情绪' : k}
                </span>
                <MiniStars value={v} />
              </div>
            ))}
          </div>
        )}
        {item.recipeId && (
          <div className="ft-item__recipe">{item.recipeId.replace(/^bp2-/, '')}</div>
        )}
      </div>
    </li>
  );
}

// ============================================================
// 主组件
// ============================================================

export default function FeedbackTimeline({ history = [], maxItems = 10 }) {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(() => {
    return [...history]
      .sort((a, b) => (b.timestamp || b.ts || 0) - (a.timestamp || a.ts || 0))
      .slice(0, maxItems);
  }, [history, maxItems]);

  if (!history || history.length === 0) {
    return null; // 无评分时不渲染
  }

  // 计算统计
  const avg = useMemo(() => {
    if (history.length === 0) return 0;
    const sum = history.reduce((s, r) => s + (r.rating || 0), 0);
    return +(sum / history.length).toFixed(1);
  }, [history]);

  return (
    <section className="ft-timeline">
      <header className="ft-timeline__header">
        <div className="ft-timeline__title-group">
          <span className="ft-timeline__icon">◇</span>
          <div>
            <div className="ft-timeline__eyebrow">Feedback Loop</div>
            <h4 className="ft-timeline__title">评分历史</h4>
          </div>
        </div>
        <div className="ft-timeline__stats">
          <span className="ft-timeline__count">{history.length} 次</span>
          <span className="ft-timeline__avg">均分 {avg}</span>
          <button
            type="button"
            className="ft-timeline__toggle"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '收起' : '展开'}
          </button>
        </div>
      </header>

      {open && (
        <ol className="ft-list">
          {sorted.map((item) => (
            <TimelineItem key={item.id || item.timestamp} item={item} />
          ))}
        </ol>
      )}

      {!open && (
        <div className="ft-timeline__hint">
          点击「展开」查看 {history.length} 条评分记录
        </div>
      )}
    </section>
  );
}
