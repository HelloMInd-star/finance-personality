import React from 'react';

/**
 * PageHeader — 统一页面标题组件
 * @param {string} icon - emoji 或图标
 * @param {string} title - 标题
 * @param {string} desc - 描述
 * @param {ReactNode} extra - 右侧额外内容（如标签）
 */
const PageHeader = ({ icon, title, desc, extra }) => {
  return (
    <div className="ds-page-header">
      <div className="ds-page-header-content">
        {icon && <div className="ds-page-header-icon">{icon}</div>}
        <div>
          {title && <div className="ds-page-header-title">{title}</div>}
          {desc && <div className="ds-page-header-desc">{desc}</div>}
        </div>
        {extra && <div style={{ marginLeft: 'auto' }}>{extra}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
