import React, { useState, useEffect } from 'react';
import { Layout, Menu, Tooltip, Avatar, Dropdown } from 'antd';
import {
  HomeOutlined,
  BookOutlined,
  MessageOutlined,
  SettingOutlined,
  TrophyOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '../../utils/logger';
import './Layout.css';

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '首页' },
  { key: '/psychology', icon: <InfoCircleOutlined />, label: '心理盘面' },
  { key: '/bartender', icon: <TrophyOutlined />, label: '调酒' },
  { key: '/billiards', icon: <BookOutlined />, label: '台球' },
  { key: '/poker', icon: <PlayCircleOutlined />, label: '德州扑克' },
  { key: '/stories', icon: <MessageOutlined />, label: '故事集' },
  { key: '/coach-logs', icon: <SettingOutlined />, label: '陪练记录' },
];

const AppLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    logger.route(`页面加载: ${location.pathname}`);
  }, [location.pathname]);

  const userMenuItems = [
    { key: 'profile', icon: <Avatar size="small" style={{ backgroundColor: '#722ed1' }}>Y</Avatar>, label: '个人中心' },
    { type: 'divider' },
    { key: 'export', icon: <ReloadOutlined />, label: '导出数据', onClick: () => logger.ui('点击导出数据') },
  ];

  const selectedKey = menuItems.find(m => location.pathname.startsWith(m.key) && m.key !== '/')
    ? location.pathname
    : '/';

  const handleMenuClick = ({ key }) => {
    logger.route(`导航到: ${key}`);
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className="app-sider"
        width={220}
        collapsedWidth={72}
        trigger={null}
      >
        <div className="sider-logo">
          {!collapsed ? (
            <span className="logo-text">Y.Mine</span>
          ) : (
            <span className="logo-text-collapsed">Y</span>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          className="sider-menu"
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div className="header-left">
            <span className="breadcrumb">{menuItems.find(m => m.key === selectedKey)?.label || '首页'}</span>
          </div>
          <div className="header-right">
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="user-info">
                <Avatar size="small" style={{ backgroundColor: '#722ed1' }}>Y</Avatar>
                {!collapsed && <span className="user-name">隐士</span>}
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="app-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
