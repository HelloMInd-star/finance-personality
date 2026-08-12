import React from 'react';
import { fmt, fmtCompact } from '../../utils/formatters';

/**
 * StatCard — 统一统计卡片
 * @param {string} icon - emoji 图标
 * @param {string|number} value - 数值
 * @param {string} label - 标签
 * @param {string} color - 图标颜色主题：purple / gold / green / pink / blue
 * @param {boolean} compact - 是否使用紧凑格式（大数自动缩写：万/亿/K）
 * @param {number} decimals - 小数位数，默认 2
 * @param {string} suffix - 后缀（如 %、$）
 */
const StatCard = ({ icon, value, label, color = 'purple', compact = false, decimals = 2, suffix = '' }) => {
  const formatValue = (v) => {
    if (typeof v === 'number' && !isNaN(v)) {
      return compact ? fmtCompact(v, decimals) : fmt(v, decimals);
    }
    return v;
  };

  const displayValue = formatValue(value);

  return (
    <div className="ds-stat-card">
      {icon && <div className={`ds-stat-icon ${color}`}>{icon}</div>}
      <div className="ds-stat-info">
        {displayValue !== undefined && (
          <div className="ds-stat-value">
            {displayValue}
            {suffix && <span className="ds-stat-suffix">{suffix}</span>}
          </div>
        )}
        {label && <div className="ds-stat-label">{label}</div>}
      </div>
    </div>
  );
};

export default StatCard;
