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
  ReloadOutlined,
  BulbOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  CoffeeOutlined,
  TeamOutlined,
  EyeOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  SoundOutlined,
  StarOutlined,
  LineChartOutlined,
  RadiusSettingOutlined,
  CrownOutlined,
  FundProjectionScreenOutlined,
  FilterOutlined,
  SafetyCertificateOutlined,
  RadarChartOutlined,
  FolderOpenOutlined,
  FundOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '../../utils/logger';
import './Layout.css';

const { Sider, Content, Header } = Layout;

const menuItems = [
  {
    key: 'navigate',
    type: 'group',
    label: 'Navigate',
    children: [
      { key: '/dashboard', icon: <HomeOutlined />, label: '工作台首页' },
      { key: '/cockpit', icon: <RadarChartOutlined />, label: '驾驶舱' },
      { key: '/archive', icon: <FolderOpenOutlined />, label: '投资人档案' },
    ],
  },
  {
    key: 'entrance',
    type: 'group',
    label: 'Entrance',
    children: [
      { key: '/tarot', icon: <CrownOutlined />, label: '塔罗指引' },
      { key: '/bartender', icon: <TrophyOutlined />, label: '调酒' },
    ],
  },
  {
    key: 'finance',
    type: 'group',
    label: 'Finance',
    children: [
      { key: '/funnel', icon: <FilterOutlined />, label: '信息漏斗' },
      { key: '/stock', icon: <LineChartOutlined />, label: '股价模拟' },
      { key: '/finance', icon: <FundProjectionScreenOutlined />, label: '公司理财' },
      { key: '/risk', icon: <SafetyCertificateOutlined />, label: '风险压力' },
      { key: '/vector', icon: <RadarChartOutlined />, label: '向量分析' },
      { key: '/ib-dashboard', icon: <FundOutlined />, label: '投行看板' },
      { key: '/trust-dashboard', icon: <DeploymentUnitOutlined />, label: '可信中台' },
    ],
  },
  {
    key: 'behavior',
    type: 'group',
    label: 'Behavior',
    children: [
      { key: '/poker', icon: <PlayCircleOutlined />, label: '德州扑克' },
      { key: '/billiards', icon: <TrophyOutlined />, label: '台球' },
      { key: '/fitness', icon: <ThunderboltOutlined />, label: '健身' },
      { key: '/music', icon: <SoundOutlined />, label: 'K线音乐' },
      { key: '/game-table', icon: <TeamOutlined />, label: '模拟博弈台' },
      { key: '/entertainment', icon: <CoffeeOutlined />, label: '娱乐方式' },
    ],
  },
  {
    key: 'persona',
    type: 'group',
    label: 'Persona',
    children: [
      { key: '/mindspeak', icon: <BulbOutlined />, label: '认知引擎' },
      { key: '/persona-mirror', icon: <EyeOutlined />, label: '人格镜子' },
      { key: '/psychology', icon: <InfoCircleOutlined />, label: '心理盘面' },
      { key: '/genome', icon: <ExperimentOutlined />, label: 'DNA分析' },
      { key: '/chakra', icon: <RadiusSettingOutlined />, label: '脉轮测试' },
      { key: '/cultivation-plan', icon: <StarOutlined />, label: '培养方案' },
    ],
  },
  {
    key: 'output',
    type: 'group',
    label: 'Output',
    children: [
      { key: '/content-hub', icon: <AppstoreOutlined />, label: '内容中枢' },
      { key: '/game-engine', icon: <ThunderboltOutlined />, label: '游戏引擎' },
      { key: '/robot', icon: <RobotOutlined />, label: '人形机器人' },
      { key: '/drone-dispatch', icon: <RocketOutlined />, label: '无人机调度' },
    ],
  },
  {
    key: 'records',
    type: 'group',
    label: 'Records',
    children: [
      { key: '/stories', icon: <BookOutlined />, label: '故事集' },
      { key: '/coach-logs', icon: <MessageOutlined />, label: '陪练记录' },
    ],
  },
  {
    key: 'system',
    type: 'group',
    label: 'System',
    children: [
      { key: '/tools', icon: <SettingOutlined />, label: '系统工具' },
    ],
  },
];

const flattenMenuItems = () => {
  const result = [];
  menuItems.forEach(group => {
    if (group.children) {
      group.children.forEach(item => result.push(item));
    }
  });
  return result;
};

const flatMenuItems = flattenMenuItems();

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

  const selectedKey = flatMenuItems.find(m => location.pathname.startsWith(m.key) && m.key !== '/')
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
          <div className="breadcrumb-wrap">
            <span className="breadcrumb">{flatMenuItems.find(m => m.key === selectedKey)?.label || '首页'}</span>
            <span className="breadcrumb-sub">Y.Mine Dashboard</span>
          </div>
          <div className="header-right">
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="user-info">
                <div className="user-avatar">Y</div>
                <span className="user-name">隐士</span>
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
