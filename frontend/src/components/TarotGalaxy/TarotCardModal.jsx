/**
 * TarotCardModal · 塔罗牌揭示卡片
 *
 * 点击星系中的星体后弹出：
 *   - 牌面（元素派色 + 金线 + 牌义）
 *   - 正逆位切换
 *   - personaWeights 六维向量展示（正位金/逆位紫，正负条）
 *   - 收起按钮
 */

import { deriveTarotCard } from '../../utils/tarot/tarotCustomization.js';
import { DIMS, DIM_LABEL, DIM_DESC } from '../../utils/tarot/tarotEngine.js';

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

export default function TarotCardModal({ entry, reversed, onToggleReversed, onClose }) {
  const spec = deriveTarotCard(entry.tarotId, reversed);
  const title = reversed ? `${spec.name}·逆` : spec.name;

  // 逆位时权重反转用于展示
  const displayWeights = reversed
    ? Object.fromEntries(
        Object.entries(spec.personaWeights).map(([k, v]) => [k, -v]),
      )
    : spec.personaWeights;

  return (
    <div className="galaxy-modal-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        {/* 牌面 */}
        <div
          className="tarot-card"
          style={{
            width: 220,
            height: 330,
            background: `linear-gradient(180deg, ${hexToRgba(entry.color, 0.45)} 0%, #15102e 50%, #070414 100%)`,
            boxShadow: `0 12px 48px ${hexToRgba(entry.color, 0.4)}, 0 0 32px ${hexToRgba(entry.color, 0.25)}`,
          }}
        >
          <div className="tarot-card-top-line" />
          <div className="tarot-card-symbol">{entry.symbol}</div>
          <div className="tarot-card-celestial">{entry.celestialName}</div>

          <div className="tarot-card-center">
            <div className="tarot-card-title" style={{ color: entry.color }}>
              {title}
            </div>
            <div
              className="tarot-card-divider"
              style={{ background: spec.accent, opacity: 0.7 }}
            />
            <div className="tarot-card-name-en">{spec.nameEn}</div>
            <div className="tarot-card-meta">
              {spec.element} · {entry.celestialType === 'planet' ? '行星' : '星座'}
            </div>
          </div>

          <div className="tarot-card-meaning">{spec.meaning}</div>
          <div className="tarot-card-bottom-line" />
        </div>

        {/* 控件 */}
        <div className="tarot-card-controls">
          <button className="tarot-btn-reverse" onClick={onToggleReversed}>
            {reversed ? '切回正位' : '查看逆位'}
          </button>
          <button className="tarot-btn-close" onClick={onClose}>
            ✕ 收起
          </button>
        </div>

        {/* personaWeights 六维展示 */}
        <div className="tarot-weights">
          <div className="tarot-weights-title">人格权重 · 六维</div>
          <div className="tarot-weights-grid">
            {DIMS.map((dim) => {
              const w = displayWeights[dim] ?? 0;
              const isPositive = w >= 0;
              const widthPct = Math.min(50, Math.abs(w) * 200);
              return (
                <div key={dim} className="tarot-weight-item">
                  <span className="tarot-weight-label">
                    {dim}·{DIM_LABEL[dim]}
                  </span>
                  <div className="tarot-weight-bar">
                    <div className="tarot-weight-bar-center" />
                    <div
                      className="tarot-weight-bar-fill"
                      style={{
                        left: isPositive ? '50%' : `${50 - widthPct}%`,
                        width: `${widthPct}%`,
                        background: isPositive
                          ? 'var(--accent-gold)'
                          : 'var(--primary)',
                      }}
                    />
                  </div>
                  <span className="tarot-weight-value">
                    {w > 0 ? '+' : ''}
                    {w.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
