import React from 'react';

/**
 * SectionCard — 统一区块卡片
 * 带有 hover 霓虹边框 + 顶部流光效果
 * @param {string} title - 卡片标题
 * @param {string} icon - 标题图标（emoji）
 * @param {ReactNode} extra - 标题栏右侧内容
 * @param {ReactNode} children - 卡片内容
 * @param {boolean} noHeader - 是否隐藏标题栏
 */
const SectionCard = ({ title, icon, extra, children, noHeader }) => {
  return (
    <div className="ds-section-card">
      {!noHeader && (title || extra) && (
        <div className="ds-section-card-header">
          <div className="ds-section-card-title">
            {icon && <span className="icon">{icon}</span>}
            {title && <span>{title}</span>}
          </div>
          {extra}
        </div>
      )}
      <div className="ds-section-card-body">
        {children}
      </div>
    </div>
  );
};

export default SectionCard;
