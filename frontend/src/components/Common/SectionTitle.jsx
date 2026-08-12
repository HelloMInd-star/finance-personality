import React from 'react';

/**
 * SectionTitle — 统一小节标题
 * 带彩色竖线装饰，支持多种颜色
 * @param {string} title - 标题文字
 * @param {string} color - 竖线颜色：purple(默认) / gold / green / pink
 * @param {ReactNode} extra - 右侧额外内容
 */
const SectionTitle = ({ title, color = 'purple', extra }) => {
  return (
    <div className="ds-section-title">
      <span className={`line ${color !== 'purple' ? color : ''}`}></span>
      <h3>{title}</h3>
      {extra && <span className="extra">{extra}</span>}
    </div>
  );
};

export default SectionTitle;
