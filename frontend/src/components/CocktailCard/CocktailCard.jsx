/**
 * CocktailCard · 分子调酒配方卡
 *
 * 展示酒名、风味、质地、温度、呈现、成分、来源
 * 视觉：深空紫金（磨砂玻璃 + 紫金渐变 + 微妙发光）
 * 无 Ant Design 依赖 · 纯 JSX + CSS
 */
import React from 'react';
import './CocktailCard.css';

const CocktailCard = ({ data, bartender }) => {
  if (!data) return null;

  return (
    <div className="cc-card">
      {/* 顶部光晕 */}
      <div className="cc-card__glow" />

      {/* 头部：酒名 */}
      <header className="cc-card__header">
        <div className="cc-card__eyebrow">
          {bartender ? `${bartender.icon} ${bartender.name} 特调` : '今夜特调'}
        </div>
        <h2 className="cc-card__name">{data.name}</h2>
        <div className="cc-card__divider" />
      </header>

      {/* 详情 */}
      <div className="cc-card__body">
        <InfoRow label="风味" value={data.flavor} accent="gold" />
        <InfoRow label="质地" value={data.texture} accent="default" />
        <InfoRow label="温度" value={data.temperature} accent="blue" />
        <InfoRow label="呈现" value={data.presentation} accent="coral" />

        <div className="cc-card__sep" />

        {/* 成分 */}
        <div className="cc-card__ingredients">
          <div className="cc-card__ingredients-label">成分</div>
          <div className="cc-card__ingredients-list">
            {data.ingredients?.map((ing, i) => (
              <span key={i} className="cc-chip">{ing}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 底部：配方来源 */}
      <footer className="cc-card__footer">
        配方来源 · {data.recipeSource}
      </footer>
    </div>
  );
};

const InfoRow = ({ label, value, accent = 'default' }) => (
  <div className={`cc-row cc-row--${accent}`}>
    <span className="cc-row__label">{label}</span>
    <span className="cc-row__value">{value}</span>
  </div>
);

export default CocktailCard;
