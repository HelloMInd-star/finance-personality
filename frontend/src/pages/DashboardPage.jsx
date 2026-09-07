import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Progress,
  Tooltip,
  Popover,
  Divider,
  List,
} from 'antd';
import {
  TrophyOutlined,
  PlayCircleOutlined,
  LineChartOutlined,
  RightCircleOutlined,
  CrownOutlined,
  RadarChartOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  BulbOutlined,
  RiseOutlined,
  FireOutlined,
  WarningOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../store/appStore';
import { storage } from '../utils/storage';
import { cognitiveCircleEngine } from '../utils/cognitiveCircleEngine';
import { generateInsights, classifyPersona } from '../utils/insightBriefEngine';
import { investorEngine } from '../utils/investorEngine';
import { apiClient } from '../utils/apiClient';
import {
  determinePhase, calculateTotalSessions, calculateDimensionScores, identifyWeakDimensions,
} from '../utils/cultivationEngine.js';
import PersonaRadar from '../components/Dashboard/PersonaRadar';
import { logger } from '../utils/logger';
import './DashboardPage.css';

const { Title, Text, Paragraph } = Typography;

const DIMS = [
  { k: 'risk', label: '风险', color: '#22d3ee' },
  { k: 'speed', label: '速度', color: '#f472b6' },
  { k: 'grit', label: '韧性', color: '#34d399' },
  { k: 'social', label: '社交', color: '#a855f7' },
  { k: 'emotionStability', label: '情绪', color: '#f59e0b' },
  { k: 'openness', label: '探索', color: '#60a5fa' },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { data } = useAppStore();
  const userState = data.userState;
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [circleRefreshKey, setCircleRefreshKey] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [masterReport, setMasterReport] = useState(null);
  const [masterLoading, setMasterLoading] = useState(false);
  const hasToken = !!localStorage.getItem('auth_token');

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return '早安';
    if (h >= 12 && h < 18) return '午安';
    if (h >= 18 && h < 22) return '晚安';
    return '夜深了';
  }, []);

  // 数据沉浸：认知画圈 + 六维向量
  const circle = useMemo(() => {
    try {
      const data = cognitiveCircleEngine.build({ forceRefresh: circleRefreshKey > 0 });
      setLastRefresh(new Date());
      return data;
    } catch (_) { return null; }
  }, [circleRefreshKey]);

  const refreshCircle = useCallback(() => {
    // 强制刷新：清除缓存后重建
    try { localStorage.removeItem('__circle_cache__data'); } catch (_) {}
    setCircleRefreshKey(k => k + 1);
    logger.session('[Dashboard] 认知画圈已手动刷新');
  }, []);

  // 自动监听 storage 变化（跨标签页同步）
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'ymine_sandbox_v1' || e.key === 'netease_profile') {
        logger.session('[Dashboard] 检测到数据变化，刷新认知画圈');
        setCircleRefreshKey(k => k + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const dims = circle?.dimensions || { risk: 0.5, speed: 0.5, grit: 0.5, social: 0.5, emotionStability: 0.5, openness: 0.5 };

  const userProfile = storage.get('userProfile') || {};
  const mbti = userProfile.mbti || userState.currentMbti || 'INTJ';
  const mbtiMap = {
    INTJ: '系统架构师', INTP: '逻辑学家', ENTJ: '指挥官', ENTP: '辩论家',
    INFJ: '提倡者', INFP: '调停者', ENFJ: '主人公', ENFP: '竞选者',
    ISTJ: '物流师', ISFJ: '守卫者', ESTJ: '总经理', ESFJ: '执政官',
    ISTP: '鉴赏家', ISFP: '探险家', ESTP: '企业家', ESFP: '表演者',
  };

  let tarotToday = null;
  try { tarotToday = JSON.parse(localStorage.getItem('tarot_daily_card') || 'null'); } catch (_) {}

  let musicProfile = null;
  try { musicProfile = JSON.parse(localStorage.getItem('netease_profile') || 'null'); } catch (_) {}

  // 人格洞察简报
  const insights = useMemo(() => {
    try {
      return generateInsights(circle, dims, tarotToday, musicProfile);
    } catch (_) {
      return null;
    }
  }, [circle, dims, tarotToday, musicProfile]);

  const persona = useMemo(() => classifyPersona(dims), [dims]);

  const sources = circle?.sources || [];

  // 统计数据
  const stats = useMemo(() => {
    const bartenderSessions = storage.get('bartenderSessions') || [];
    const pokerGames = storage.get('pokerGames') || [];
    const fitnessSessions = storage.get('fitnessSessions') || [];
    const billiardsGames = storage.get('billiardsGames') || [];
    const totalScore = circle ? Math.round(
      ((1 - dims.risk) * 0.25 + dims.grit * 0.3 + dims.emotionStability * 0.25 + dims.openness * 0.2) * 100
    ) : 72;

    return {
      bartenderCount: bartenderSessions.length,
      pokerRounds: pokerGames.length,
      workoutDays: fitnessSessions.filter(s => s.completed).length,
      billiardsCount: billiardsGames.length,
      abilityScore: totalScore,
    };
  }, [userState, circle]);

  // 动态徽章数据
  const tarotName = tarotToday?.card?.name || null;
  let chakraStatus = null;
  try {
    const chakraResult = storage.getUserState()?.chakraResult;
    if (chakraResult?.dominantChakra) {
      const dominantDetail = chakraResult.details?.find(d => d.chakra?.key === chakraResult.dominantChakra);
      chakraStatus = dominantDetail ? `${dominantDetail.chakra.name} ${dominantDetail.score}分` : '已测试';
    }
  } catch (_) {}

  let musicStatus = null;
  try {
    const music = JSON.parse(localStorage.getItem('netease_profile') || 'null');
    if (music) {
      musicStatus = music.source === 'netease' ? '网易云已连接' : 'Demo 数据';
    }
  } catch (_) {}

  let mirrorStatus = null;
  try {
    const mirrors = JSON.parse(localStorage.getItem('persona_mirrors') || '[]');
    mirrorStatus = mirrors.length ? `${mirrors.length} 面镜子` : null;
  } catch (_) {}

  // 核心系统入口（7张卡）
  const coreSystems = [
    {
      key: 'bartender',
      title: '分子调酒',
      subtitle: '情绪入口',
      desc: '6步情绪采集 · MBTI酒局 · 状态锚定',
      badge: stats.bartenderCount ? `${stats.bartenderCount} 次` : '待开启',
      badgeTone: stats.bartenderCount ? 'gold' : 'muted',
      accent: 'gold',
      icon: '🍸',
      action: () => navigate('/bartender'),
    },
    {
      key: 'chakra',
      title: '脉轮测试',
      subtitle: '能量扫描',
      desc: '7脉轮能量分布 · 实时状态 · 激活引导',
      badge: chakraStatus || '待测试',
      badgeTone: chakraStatus ? 'purple' : 'muted',
      accent: 'purple',
      icon: '🌀',
      action: () => navigate('/chakra'),
    },
    {
      key: 'tarot',
      title: '塔罗指引',
      subtitle: '今日牌面',
      desc: '每日一牌 · 人格底色 · 行动建议',
      badge: tarotName || '待抽取',
      badgeTone: tarotName ? 'gold' : 'muted',
      accent: 'gold',
      icon: '🎴',
      action: () => navigate('/tarot'),
    },
    {
      key: 'music',
      title: '音乐画像',
      subtitle: '人格旋律',
      desc: '网易云歌单分析 · 曲风情绪 · 画像合成',
      badge: musicStatus || '未连接',
      badgeTone: musicStatus ? 'blue' : 'muted',
      accent: 'blue',
      icon: '🎵',
      action: () => navigate('/music'),
    },
    {
      key: 'billiards',
      title: '台球训练',
      subtitle: '行为推演',
      desc: '路径推演 · 瞄准决策 · 折射分析',
      badge: stats.billiardsCount ? `${stats.billiardsCount} 局` : '待开启',
      badgeTone: stats.billiardsCount ? 'purple' : 'muted',
      accent: 'purple',
      icon: '🎱',
      action: () => navigate('/billiards'),
    },
    {
      key: 'finance',
      title: '金融模拟',
      subtitle: '资本沙盘',
      desc: '股价 · 理财 · 风险 · 漏斗',
      badge: '4 个子系统',
      badgeTone: 'green',
      accent: 'green',
      icon: '📈',
      action: () => navigate('/finance'),
    },
    {
      key: 'mirror',
      title: '人格镜子',
      subtitle: 'MBTI 对照',
      desc: '投资人映射 · 名人镜像 · 自我校准',
      badge: mirrorStatus || '待探索',
      badgeTone: mirrorStatus ? 'gold' : 'muted',
      accent: 'gold',
      icon: '🪞',
      action: () => navigate('/persona-mirror'),
    },
  ];

  // 最近活动
  const recentActivities = useMemo(() => {
    const activities = [];
    const bartenderSessions = storage.get('bartenderSessions') || [];
    if (bartenderSessions.length) {
      const last = bartenderSessions[bartenderSessions.length - 1];
      activities.push({
        id: 'b_' + last.id,
        icon: '🍸',
        title: '完成一次分子调酒',
        subtitle: `${last.recipeId || '自定义配方'} · ${last.moodDelta > 0 ? '情绪上扬' : last.moodDelta < 0 ? '情绪下沉' : '情绪持平'}`,
        time: last.timestamp ? new Date(last.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' }) : '今日',
      });
    }
    const pokerGames = storage.get('pokerGames') || [];
    if (pokerGames.length) {
      const last = pokerGames[pokerGames.length - 1];
      activities.push({
        id: 'p_' + last.id,
        icon: '🎴',
        title: '完成一局德州扑克',
        subtitle: `盈亏 ${last.profit >= 0 ? '+' : ''}${last.profit || 0} · 手数 ${last.totalActions || 0}`,
        time: last.timestamp ? new Date(last.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' }) : '今日',
      });
    }
    const fitnessSessions = storage.get('fitnessSessions') || [];
    if (fitnessSessions.length) {
      const last = fitnessSessions[fitnessSessions.length - 1];
      activities.push({
        id: 'f_' + last.id,
        icon: '💪',
        title: '完成一次健身训练',
        subtitle: `${last.type || '力量训练'} · 时长 ${last.duration || 0} 分钟`,
        time: last.timestamp ? new Date(last.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' }) : '今日',
      });
    }
    if (activities.length === 0) {
      activities.push({
        id: 'empty_1',
        icon: '🌱',
        title: '还没有活动记录',
        subtitle: '去调酒、打台球或健身，开启你的第一次行为采集',
        time: '等待开始',
      });
    }
    return activities.slice(0, 5);
  }, []);

  // 画圈节点位置计算
  const circleNodes = circle?.nodes?.slice(0, 8) || [];
  const circleEdges = circle?.edges?.slice(0, 12) || [];

  // ✦ 人格金融综合报告(DeepSeek 点亮工程 · 跨模块人格痕迹汇总)
  const handleMasterReport = async () => {
    if (masterLoading) return;
    setMasterLoading(true);
    setMasterReport(null);
    try {
      const tarotCard = storage.getUserState()?.tarotDraw?.cardName
        || (storage.get('tarotHistory') || []).slice(-1)[0]?.cardName || '未抽牌';
      const partyHist = storage.getUserState()?.partyHistory || [];
      const partyPersona = partyHist.length ? partyHist.slice(-1)[0].persona : '未入局';
      let invName = '未匹配';
      let invSim = '—';
      try {
        const ud = investorEngine.extractUserData();
        const m0 = investorEngine.matchInvestor(ud)[0];
        if (m0) { invName = m0.investor.name; invSim = `${m0.similarity}%`; }
      } catch (_) {}
      let phaseName = '—';
      let weakDims = '—';
      try {
        const total = calculateTotalSessions(data);
        phaseName = determinePhase(total)?.label || '—';
        const scores = calculateDimensionScores(data);
        const weak = identifyWeakDimensions(scores) || [];
        weakDims = weak.map(w => (typeof w === 'string' ? w : (w.label || w.key))).join('、') || '无显著弱项';
      } catch (_) {}
      const res = await apiClient.llmGenerate('master_report', {
        mbti: `${mbti}(${mbtiMap[mbti] || '探索者'})`,
        tarot_card: String(tarotCard).slice(0, 50),
        party_persona: String(partyPersona).slice(0, 80),
        investor_name: String(invName).slice(0, 50),
        similarity: String(invSim),
        phase_name: String(phaseName).slice(0, 60),
        weak_dims: String(weakDims).slice(0, 120),
      });
      if (res?.text) setMasterReport(res.text);
    } catch (e) {
      logger.error('[综合报告] 生成失败', e);
    } finally {
      setMasterLoading(false);
    }
  };

  return (
    <div className="dashboard-page fade-in">
      {/* === Hero 欢迎区 + 数据沉浸 === */}
      <Card className="dashboard-hero">
        <div className="hero-content">
          {/* 左侧：问候 */}
          <div className="hero-left">
            <div className="hero-greeting">
              <span className="greeting-text">{greeting}</span>
              <span className="greeting-emoji">✨</span>
            </div>
            <Title level={2} className="hero-title">
              欢迎回到 <span className="text-gradient">Y.Mine</span>
            </Title>
            <Text className="hero-subtitle">
              你的专属金融人格实验室 · 每一次选择都在塑造你
            </Text>
            <Space className="hero-tags" wrap>
              <Tag className="hero-tag hero-tag-mbti" icon={<CrownOutlined />}>
                {mbti} · {mbtiMap[mbti] || '探索者'}
              </Tag>
              {sources.slice(0, 3).map((s, i) => (
                <Tag key={i} className="hero-tag hero-tag-source">
                  {s}
                </Tag>
              ))}
              {sources.length > 3 && (
                <Tag className="hero-tag hero-tag-source">+{sources.length - 3}</Tag>
              )}
            </Space>
            <div className="hero-actions">
              <Button
                type="primary"
                size="large"
                className="hero-primary-btn"
                onClick={() => navigate('/cockpit')}
              >
                进入驾驶舱 <RightCircleOutlined />
              </Button>
              <Button
                size="large"
                className="hero-ghost-btn"
                onClick={() => navigate('/psychology')}
              >
                <RadarChartOutlined /> 查看完整认知画圈
              </Button>
            </div>
          </div>

          {/* 右侧：数据沉浸面板 */}
          <div className="hero-right">
            {/* 认知画圈缩略图 */}
            <div className="hero-circle-card" onClick={() => navigate('/psychology')}>
              <div className="hero-circle-header">
                <RadarChartOutlined /> 认知画圈
                <span className="hero-circle-synergy">
                  合力 {circle?.layers?.harmony?.synergy || 0}%
                </span>
                <Tooltip title="点击查看完整认知画圈详情">
                  <InfoCircleOutlined style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
                </Tooltip>
                <Button
                  size="small"
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={(e) => { e.stopPropagation(); refreshCircle(); }}
                  title="刷新认知画圈"
                  style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 'auto', fontSize: 11 }}
                />
              </div>
              <svg viewBox="0 0 200 200" className="hero-circle-svg">
                <defs>
                  <radialGradient id="hcCenter" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fde68a" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.2" />
                  </radialGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                {/* 三环背景 */}
                <circle cx="100" cy="100" r="30" className="hc-ring core" />
                <circle cx="100" cy="100" r="60" className="hc-ring support" />
                <circle cx="100" cy="100" r="85" className="hc-ring edge" />
                {/* 中心节点 */}
                <circle cx="100" cy="100" r="14" fill="url(#hcCenter)">
                  <animate attributeName="r" values="12;16;12" dur="3s" repeatCount="indefinite" />
                </circle>
                {/* 中心光晕 */}
                <circle cx="100" cy="100" r="20" fill="none" stroke="rgba(212,175,55,0.3)">
                  <animate attributeName="r" values="14;24;14" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.1;0.6" dur="3s" repeatCount="indefinite" />
                </circle>
                {/* 关系连线（带动画） */}
                {circleEdges.map((e, i) => {
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
                  const isActive = hoveredNode && (hoveredNode.id === a.id || hoveredNode.id === b.id);
                  return (
                    <line
                      key={i}
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      className={`hc-edge ${cls} ${isActive ? 'active' : ''}`}
                      style={{
                        animationDelay: `${i * 0.1}s`,
                        strokeWidth: isActive ? 2.5 : 1,
                        opacity: isActive ? 1 : 0.5,
                      }}
                    >
                      <animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${2 + i * 0.2}s`} repeatCount="indefinite" />
                    </line>
                  );
                })}
                {/* 节点（带交互） */}
                {circleNodes.map((n) => {
                  const r = n.layer === 'core' ? 30 : n.layer === 'support' ? 60 : 85;
                  const a = (n.angle - 90) * Math.PI / 180;
                  const x = 100 + Math.cos(a) * r;
                  const y = 100 + Math.sin(a) * r;
                  const isHovered = hoveredNode?.id === n.id;
                  const isSelected = selectedNode?.id === n.id;
                  const nodeSize = isHovered || isSelected ? 7 : 5;
                  const nodeColor = n.color || '#a855f7';
                  return (
                    <g
                      key={n.id}
                      className="hc-node-group"
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        setHoveredNode(n);
                      }}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(selectedNode?.id === n.id ? null : n);
                        navigate('/psychology');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* 光晕效果 */}
                      {(isHovered || isSelected) && (
                        <circle
                          cx={x} cy={y} r="12"
                          fill={nodeColor}
                          opacity="0.2"
                        >
                          <animate attributeName="r" values="8;14;8" dur="1.5s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.3;0.1;0.3" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                      )}
                      {/* 主节点 */}
                      <circle
                        cx={x} cy={y}
                        r={nodeSize}
                        fill={nodeColor}
                        filter="url(#glow)"
                        style={{
                          transition: 'all 0.2s ease',
                          filter: isHovered ? `drop-shadow(0 0 10px ${nodeColor})` : `drop-shadow(0 0 5px ${nodeColor})`,
                        }}
                      />
                      {/* 节点脉冲 */}
                      <circle
                        cx={x} cy={y}
                        r={nodeSize + 2}
                        fill="none"
                        stroke={nodeColor}
                        strokeWidth="1"
                        opacity="0.5"
                      >
                        <animate attributeName="r" values={`${nodeSize};${nodeSize + 6};${nodeSize}`} dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                      </circle>
                      {/* Hover Tooltip */}
                      {isHovered && (
                        <foreignObject x={x + 10} y={y - 15} width="100" height="40">
                          <div style={{
                            background: 'rgba(0,0,0,0.85)',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            border: `1px solid ${nodeColor}`,
                          }}>
                            <div style={{ fontWeight: 600 }}>{n.label || n.name || '节点'}</div>
                            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px' }}>
                              {n.layer === 'core' ? '核心层' : n.layer === 'support' ? '支撑层' : '边缘层'}
                              {' · '}
                              {Math.round((n.strength || 0.5) * 100)}%
                            </div>
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                })}
              </svg>
              <div className="hero-circle-footer">
                <span>{circle?.stats?.nodeCount || 0} 节点</span>
                <span>{circle?.stats?.edgeCount || 0} 关系</span>
                <span>内耗 {circle?.layers?.harmony?.friction || 0}%</span>
                {hoveredNode && (
                  <span style={{ color: hoveredNode.color, fontWeight: 600 }}>
                    · {hoveredNode.label || hoveredNode.name}
                  </span>
                )}
                {lastRefresh && (
                  <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                    上次更新 {lastRefresh.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* === ✦ 人格金融综合报告(跨模块汇总 · 选择建议) === */}
      <Card
        title={<span style={{ color: '#fff' }}>✦ 人格金融综合报告 · 跨模块人格痕迹汇总</span>}
        style={{ marginBottom: 24, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(212,175,55,0.22)' }}
      >
        {hasToken ? (
          <div>
            <Paragraph style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 12 }}>
              汇总塔罗指引、酒局原型、投资人匹配与成长阶段的人格痕迹，由 AI 总分析师生成综合报告与选择建议。
            </Paragraph>
            <Button
              icon={<StarOutlined />}
              loading={masterLoading}
              onClick={handleMasterReport}
              style={{ background: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.35)', color: '#D4AF37' }}
            >
              {masterReport ? '重新生成综合报告' : '生成我的综合报告'}
            </Button>
            {masterReport && (
              <div style={{ marginTop: 14, padding: '16px 20px', background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: '#D4AF37', letterSpacing: 1, marginBottom: 8 }}>✦ AI 总分析师 · 综合报告与选择建议</div>
                <div style={{ fontSize: 14, lineHeight: 2, color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-wrap' }}>{masterReport}</div>
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={() => navigate('/login', { state: { from: '/dashboard' } })}
            style={{ background: 'transparent', border: '1px dashed rgba(212,175,55,0.25)', color: 'rgba(212,175,55,0.75)' }}
          >
            ✦ 登录解锁人格金融综合报告 →
          </Button>
        )}
      </Card>

      {/* === 六维人格向量 · 雷达图 + 塔罗 + 洞察 === */}
      <Row gutter={[16, 16]} className="vector-row">
        <Col xs={24} lg={10}>
          <Card className="vector-card radar-card" size="small">
            <div className="vector-header">
              <CrownOutlined /> 六维人格雷达
              <Space size="small" style={{ marginLeft: 'auto' }}>
                {persona?.type && (
                  <Tag color="purple" style={{ marginRight: 8 }}>
                    原型：{persona.type}
                  </Tag>
                )}
                <span className="vector-source">融合音乐画像 · 权重 30%</span>
              </Space>
            </div>
            <PersonaRadar dimensions={dims} size={280} />
            <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
              {DIMS.map((d) => (
                <Col xs={12} sm={8} md={4} key={d.k}>
                  <div className="vector-dim-compact">
                    <span className="vector-dim-label" style={{ color: d.color }}>
                      {d.label}
                    </span>
                    <span className="vector-dim-value" style={{ color: d.color }}>
                      {Math.round((dims[d.k] || 0) * 100)}
                    </span>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        {/* 塔罗 × 洞察联动 */}
        <Col xs={24} lg={14}>
          <Card className="insight-card" size="small">
            <div className="insight-header">
              <BulbOutlined /> 今日洞察简报
              {insights?.todayFocus && (
                <Tag color="gold" style={{ marginLeft: 'auto' }}>
                  <StarOutlined /> {insights.todayFocus}
                </Tag>
              )}
            </div>

            {insights?.summary && (
              <Paragraph className="insight-summary">
                {insights.summary}
              </Paragraph>
            )}

            <Row gutter={[12, 12]}>
              {/* 塔罗联动 */}
              <Col xs={24} sm={12}>
                {tarotToday?.card ? (
                  <div
                    className="tarot-insight-block"
                    onClick={() => navigate('/tarot')}
                  >
                    <div className="tarot-insight-header">
                      <span className="tarot-insight-icon">🎴</span>
                      <div>
                        <div className="tarot-insight-title">{tarotToday.card.name}</div>
                        <div className="tarot-insight-sub">今日塔罗底色</div>
                      </div>
                    </div>
                    {insights?.tarotInfluence && (
                      <div className="tarot-influence">
                        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                          {insights.tarotInfluence.tip}
                        </div>
                        <Space size={[4, 4]} wrap>
                          {insights.tarotInfluence.modifiers.map((m, i) => (
                            <Tag
                              key={i}
                              color={m.direction === 'boost' ? 'green' : 'red'}
                              style={{ fontSize: 11 }}
                            >
                              {m.dim} {m.modifier}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    )}
                    <RightCircleOutlined className="tarot-arrow" />
                  </div>
                ) : (
                  <div
                    className="tarot-insight-block empty"
                    onClick={() => navigate('/tarot')}
                  >
                    <div className="tarot-insight-header">
                      <span className="tarot-insight-icon">🎴</span>
                      <div>
                        <div className="tarot-insight-title">抽取今日塔罗</div>
                        <div className="tarot-insight-sub">塔罗底色影响认知权重</div>
                      </div>
                    </div>
                    <RightCircleOutlined className="tarot-arrow" />
                  </div>
                )}
              </Col>

              {/* 音乐联动 */}
              <Col xs={24} sm={12}>
                {insights?.musicAlignment ? (
                  <div className="music-insight-block">
                    <div className="insight-block-header">
                      <span>🎵</span>
                      <div>
                        <div className="insight-block-title">音乐画像联动</div>
                        <div className="insight-block-sub">已融合到人格向量</div>
                      </div>
                    </div>
                    <Space size={[4, 4]} wrap style={{ marginTop: 4 }}>
                      {insights.musicAlignment.genres.map((g, i) => (
                        <Tag key={i} color="purple" style={{ fontSize: 11 }}>
                          {g}
                        </Tag>
                      ))}
                      {insights.musicAlignment.behaviors.map((b, i) => (
                        <Tag key={i} style={{ fontSize: 11 }}>
                          {b}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                ) : (
                  <div
                    className="music-insight-block empty"
                    onClick={() => navigate('/music')}
                  >
                    <div className="insight-block-header">
                      <span>🎵</span>
                      <div>
                        <div className="insight-block-title">连接网易云</div>
                        <div className="insight-block-sub">音乐偏好 → 人格向量映射</div>
                      </div>
                    </div>
                    <RightCircleOutlined className="tarot-arrow" />
                  </div>
                )}
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0' }} />

            {/* 优势 / 风险 / 建议 */}
            <Row gutter={[12, 12]}>
              {insights?.strengths?.length > 0 && (
                <Col xs={24} sm={8}>
                  <div className="insight-column strengths">
                    <div className="insight-col-header">
                      <RiseOutlined style={{ color: '#34d399' }} />
                      <span>优势维度</span>
                    </div>
                    <Space direction="vertical" size={4}>
                      {insights.strengths.map((s, i) => (
                        <div key={i} className="insight-item">
                          <span className="insight-item-dim">{s.dim}</span>
                          <span className="insight-item-level" style={{ color: '#34d399' }}>
                            {s.level}%
                          </span>
                          <Tag style={{ fontSize: 10 }}>{s.label}</Tag>
                        </div>
                      ))}
                    </Space>
                  </div>
                </Col>
              )}

              {insights?.risks?.length > 0 && (
                <Col xs={24} sm={8}>
                  <div className="insight-column risks">
                    <div className="insight-col-header">
                      <WarningOutlined style={{ color: '#fb7185' }} />
                      <span>关注维度</span>
                    </div>
                    <Space direction="vertical" size={4}>
                      {insights.risks.map((r, i) => (
                        <div key={i} className="insight-item">
                          <span className="insight-item-dim">{r.dim}</span>
                          <span className="insight-item-level" style={{ color: '#fb7185' }}>
                            {r.level}%
                          </span>
                          <Tag color="red" style={{ fontSize: 10 }}>{r.label}</Tag>
                        </div>
                      ))}
                    </Space>
                  </div>
                </Col>
              )}

              {insights?.suggestions?.length > 0 && (
                <Col xs={24} sm={insights?.strengths?.length > 0 || insights?.risks?.length > 0 ? 8 : 24}>
                  <div className="insight-column suggestions">
                    <div className="insight-col-header">
                      <BulbOutlined style={{ color: '#fbbf24' }} />
                      <span>今日建议</span>
                    </div>
                    <Space direction="vertical" size={4}>
                      {insights.suggestions.map((s, i) => (
                        <div key={i} className={`insight-suggestion type-${s.type}`}>
                          <span className="suggestion-icon">{s.icon}</span>
                          <span className="suggestion-text">{s.text}</span>
                        </div>
                      ))}
                    </Space>
                  </div>
                </Col>
              )}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* === 核心数据卡 === */}
      <Row gutter={[12, 12]} className="stats-row">
        <Col xs={12} md={6}>
          <Card className="stat-card stat-bartender" size="small">
            <div className="stat-icon">🍸</div>
            <div className="stat-info">
              <div className="stat-value">{stats.bartenderCount}</div>
              <div className="stat-label">调酒杯数</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card stat-poker" size="small">
            <div className="stat-icon">🎴</div>
            <div className="stat-info">
              <div className="stat-value">{stats.pokerRounds}</div>
              <div className="stat-label">德州手数</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card stat-fitness" size="small">
            <div className="stat-icon">💪</div>
            <div className="stat-info">
              <div className="stat-value">{stats.workoutDays}</div>
              <div className="stat-label">训练完成</div>
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card stat-ability" size="small">
            <div className="stat-icon">⭐</div>
            <div className="stat-info">
              <div className="stat-value">{stats.abilityScore}</div>
              <div className="stat-label">人格综合分</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* === 核心系统入口 === */}
      <div className="section-block">
        <div className="section-header">
          <div className="section-title-row">
            <span className="section-indicator" />
            <Title level={4} className="section-title">核心系统</Title>
            <Tag className="section-tag">Core Systems</Tag>
          </div>
          <Text className="section-desc">从入口到行为，三层体验层层递进</Text>
        </div>
        <Row gutter={[16, 16]}>
          {coreSystems.map((sys) => (
            <Col xs={24} sm={12} md={8} lg={6} key={sys.key}>
              <Card
                className={`system-card system-${sys.key} accent-${sys.accent}`}
                hoverable
                onClick={sys.action}
                bodyStyle={{ padding: 0 }}
              >
                <div className="system-card-banner">
                  <div className="system-card-emoji">{sys.icon}</div>
                  <Tag className={`system-card-badge badge-${sys.badgeTone || 'muted'}`}>{sys.badge}</Tag>
                </div>
                <div className="system-card-body">
                  <div className="system-card-title-row">
                    <Text strong className="system-card-title">{sys.title}</Text>
                    <Tag className="system-card-subtitle-tag">{sys.subtitle}</Tag>
                  </div>
                  <Text className="system-card-desc">{sys.desc}</Text>
                  <div className="system-card-action">
                    <Button type="link" className="enter-btn">
                      进入 <RightCircleOutlined />
                    </Button>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* === 最近活动 === */}
      <div className="section-block">
        <div className="section-header">
          <div className="section-title-row">
            <span className="section-indicator section-indicator-purple" />
            <Title level={4} className="section-title">最近活动</Title>
            <Tag className="section-tag section-tag-purple">Timeline</Tag>
          </div>
          <Text className="section-desc">追踪你的每一次选择</Text>
        </div>
        <Card className="timeline-card">
          <div className="timeline-list">
            {recentActivities.map((act) => (
              <div key={act.id} className="timeline-item" onClick={() => navigate('/cockpit')}>
                <div className="timeline-dot">{act.icon}</div>
                <div className="timeline-content">
                  <div className="timeline-title-row">
                    <Text strong className="timeline-title">{act.title}</Text>
                    <Text className="timeline-time">{act.time}</Text>
                  </div>
                  <Text className="timeline-subtitle">{act.subtitle}</Text>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
