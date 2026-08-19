import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Avatar, Tag, Tooltip, Progress } from 'antd';
import {
  ExperimentOutlined,
  TeamOutlined,
  RadiusSettingOutlined,
  LineChartOutlined,
  FolderOpenOutlined,
  UserOutlined,
  SettingOutlined,
  HomeOutlined,
  RadarChartOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { cognitiveCircleEngine } from '../utils/cognitiveCircleEngine';
import { INVESTOR_PROFILES } from '../utils/investorEngine';
import { storage } from '../utils/storage';
import './CockpitPage.css';

const CockpitPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 数据沉浸：认知画圈
  const circle = useMemo(() => {
    try { return cognitiveCircleEngine.build(); } catch (_) { return null; }
  }, []);

  // 人格锚点
  const userProfile = storage.get('userProfile') || {};
  const mbti = userProfile.mbti || 'INTJ';
  const mbtiMap = {
    INTJ: '系统架构师', INTP: '逻辑学家', ENTJ: '指挥官', ENTP: '辩论家',
    INFJ: '提倡者', INFP: '调停者', ENFJ: '主人公', ENFP: '竞选者',
    ISTJ: '物流师', ISFJ: '守卫者', ESTJ: '总经理', ESFJ: '执政官',
    ISTP: '鉴赏家', ISFP: '探险家', ESTP: '企业家', ESFP: '表演者',
  };
  const mbtiLabel = mbtiMap[mbti] || '探索者';

  // 今日塔罗
  let tarotToday = null;
  try { tarotToday = JSON.parse(localStorage.getItem('tarot_daily_card') || 'null'); } catch (_) {}

  // 六维数据
  const dims = circle?.dimensions || { risk: 0.5, speed: 0.5, grit: 0.5, social: 0.5, emotionStability: 0.5, openness: 0.5 };

  const dimList = [
    { k: 'risk', label: '风险', color: '#22d3ee' },
    { k: 'speed', label: '速度', color: '#f472b6' },
    { k: 'grit', label: '韧性', color: '#34d399' },
    { k: 'social', label: '社交', color: '#a855f7' },
    { k: 'emotionStability', label: '情绪', color: '#f59e0b' },
    { k: 'openness', label: '探索', color: '#60a5fa' },
  ];

  // 功能卡片
  const cards = [
    {
      key: 'persona',
      icon: <UserOutlined />,
      emoji: '👤',
      title: '当前人格',
      desc: `${mbti} · ${mbtiLabel}`,
      action: () => navigate('/persona-mirror'),
      accent: 'gold',
    },
    {
      key: 'bartender',
      icon: <ExperimentOutlined />,
      emoji: '🍸',
      title: '分子调酒',
      desc: '进入状态',
      action: () => navigate('/bartender'),
      accent: 'purple',
    },
    {
      key: 'lounge',
      icon: <TeamOutlined />,
      emoji: '🍷',
      title: '企业家酒局',
      desc: '进入社交',
      action: () => navigate('/game-table'),
      accent: 'pink',
    },
    {
      key: 'chakra',
      icon: <RadiusSettingOutlined />,
      emoji: '🌀',
      title: '脉轮测试',
      desc: '当前能量状态',
      action: () => navigate('/chakra'),
      accent: 'blue',
    },
    {
      key: 'finance',
      icon: <LineChartOutlined />,
      emoji: '📊',
      title: '金融模拟',
      desc: 'K线预览',
      action: () => navigate('/finance'),
      accent: 'green',
    },
    {
      key: 'archive',
      icon: <FolderOpenOutlined />,
      emoji: '📁',
      title: '投资人档案',
      desc: `查看 ${INVESTOR_PROFILES.length} 位投资人`,
      action: () => navigate('/archive'),
      accent: 'gold',
    },
  ];

  // 底部导航
  const bottomNav = [
    { key: '/dashboard', icon: <HomeOutlined />, label: '首页' },
    { key: '/bartender', icon: <ExperimentOutlined />, label: '调酒' },
    { key: '/game-table', icon: <TeamOutlined />, label: '酒局' },
    { key: '/chakra', icon: <RadiusSettingOutlined />, label: '脉轮' },
    { key: '/finance', icon: <LineChartOutlined />, label: '金融' },
    { key: '/archive', icon: <FolderOpenOutlined />, label: '档案' },
  ];

  // 认知画圈缩略图节点位置
  const circleNodes = circle?.nodes?.slice(0, 8) || [];
  const circleEdges = circle?.edges || [];

  return (
    <div className="cockpit-page">
      {/* 顶部导航 */}
      <header className="cockpit-header">
        <div className="cockpit-logo" onClick={() => navigate('/dashboard', { replace: true })}>
          <span className="cockpit-logo-text">Y.Mine</span>
          <span className="cockpit-logo-sub">COCKPIT</span>
        </div>
        <div className="cockpit-header-right">
          <Tag className="cockpit-mbti-tag" color="gold">
            <UserOutlined /> {mbti}
          </Tag>
          <Tooltip title="设置">
            <div className="cockpit-settings-btn">
              <SettingOutlined />
            </div>
          </Tooltip>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="cockpit-main">
        {/* === 数据沉浸：左认知画圈 + 右人格向量 === */}
        <section className="cockpit-immersive">
          {/* 认知画圈缩略图 */}
          <div className="cockpit-circle-mini" onClick={() => navigate('/psychology')}>
            <div className="cockpit-circle-label">
              <RadarChartOutlined /> 认知画圈
            </div>
            <svg viewBox="0 0 200 200" className="cockpit-circle-svg">
              {/* 三环 */}
              <circle cx="100" cy="100" r="30" className="cockpit-ring core" />
              <circle cx="100" cy="100" r="60" className="cockpit-ring support" />
              <circle cx="100" cy="100" r="85" className="cockpit-ring edge" />
              {/* 中心 */}
              <circle cx="100" cy="100" r="12" fill="url(#cockpitCenter)" />
              <defs>
                <radialGradient id="cockpitCenter" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fde68a" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.3" />
                </radialGradient>
              </defs>
              {/* 边 */}
              {circleEdges.slice(0, 10).map((e, i) => {
                const a = circleNodes.find(n => n.id === e.from);
                const b = circleNodes.find(n => n.id === e.to);
                if (!a || !b) return null;
                const ra = a.layer === 'core' ? 30 : a.layer === 'support' ? 60 : 85;
                const rb = b.layer === 'core' ? 30 : b.layer === 'support' ? 60 : 85;
                const aa = (a.angle - 90) * Math.PI / 180;
                const ba = (b.angle - 90) * Math.PI / 180;
                const x1 = 100 + Math.cos(aa) * ra, y1 = 100 + Math.sin(aa) * ra;
                const x2 = 100 + Math.cos(ba) * rb, y2 = 100 + Math.sin(ba) * rb;
                const cls = e.type === 'reinforce' ? 'reinforce' : e.type === 'conflict' ? 'conflict' : e.type === 'complement' ? 'complement' : 'balance';
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={`cockpit-edge ${cls}`} />;
              })}
              {/* 节点 */}
              {circleNodes.map((n, i) => {
                const r = n.layer === 'core' ? 30 : n.layer === 'support' ? 60 : 85;
                const a = (n.angle - 90) * Math.PI / 180;
                const x = 100 + Math.cos(a) * r;
                const y = 100 + Math.sin(a) * r;
                return (
                  <g key={n.id}>
                    <circle cx={x} cy={y} r="4.5" fill={n.color || '#a855f7'} opacity="0.9" style={{ filter: `drop-shadow(0 0 4px ${n.color || '#a855f7'})` }} />
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 5 }}>{n.emoji}</text>
                  </g>
                );
              })}
            </svg>
            <div className="cockpit-circle-stats">
              <span>{circle?.stats?.nodeCount || 0} 节点</span>
              <span>合力 {circle?.layers?.harmony?.synergy || 0}%</span>
            </div>
          </div>

          {/* 人格向量 + 塔罗底色 */}
          <div className="cockpit-vector-panel">
            <div className="cockpit-vector-title">
              <CrownOutlined /> 人格向量 · 六维基线
            </div>
            <div className="cockpit-dim-grid">
              {dimList.map(d => (
                <div key={d.k} className="cockpit-dim-item">
                  <div className="cockpit-dim-head">
                    <span style={{ color: d.color }}>{d.label}</span>
                    <span className="cockpit-dim-val">{Math.round((dims[d.k] || 0) * 100)}</span>
                  </div>
                  <Progress
                    percent={Math.round((dims[d.k] || 0) * 100)}
                    showInfo={false}
                    size="small"
                    strokeColor={d.color}
                    trailColor="rgba(255,255,255,0.06)"
                  />
                </div>
              ))}
            </div>

            {/* 今日塔罗底色 */}
            {tarotToday?.card && (
              <div className="cockpit-tarot-strip" onClick={() => navigate('/tarot')}>
                <span className="cockpit-tarot-emoji">🎴</span>
                <div className="cockpit-tarot-info">
                  <span className="cockpit-tarot-name">{tarotToday.card.name}</span>
                  <span className="cockpit-tarot-meaning">{tarotToday.card.meaning || '今日人格底色'}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* === 功能卡片网格 === */}
        <section className="cockpit-cards">
          {cards.map(card => (
            <div
              key={card.key}
              className={`cockpit-card accent-${card.accent}`}
              onClick={card.action}
            >
              <div className="cockpit-card-glow" />
              <div className="cockpit-card-emoji">{card.emoji}</div>
              <div className="cockpit-card-body">
                <div className="cockpit-card-title">{card.title}</div>
                <div className="cockpit-card-desc">{card.desc}</div>
              </div>
              <div className="cockpit-card-arrow">→</div>
            </div>
          ))}
        </section>
      </main>

      {/* 底部导航 */}
      <nav className="cockpit-bottom-nav">
        {bottomNav.map(item => (
          <div
            key={item.key}
            className={`cockpit-nav-item ${
              (location.pathname === '/cockpit' && item.key === '/dashboard') ||
              location.pathname === item.key
                ? 'active'
                : ''
            }`}
            onClick={() => navigate(item.key)}
          >
            <span className="cockpit-nav-icon">{item.icon}</span>
            <span className="cockpit-nav-label">{item.label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
};

export default CockpitPage;
