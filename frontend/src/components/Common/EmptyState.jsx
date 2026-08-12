import React from 'react';

/**
 * EmptyState — 统一空状态
 * @param {string} icon - emoji 图标
 * @param {string} text - 提示文字
 */
const EmptyState = ({ icon = '🔮', text = '暂无数据' }) => {
  return (
    <div className="ds-empty-state">
      <div className="ds-empty-icon">{icon}</div>
      <div className="ds-empty-text">{text}</div>
    </div>
  );
};

export default EmptyState;
