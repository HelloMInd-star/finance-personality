import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ShowcasePage —— 策展式首页（面试官导览）
 * 定位：平台对外首屏。策展 5 个必看 Demo + 同构系统矩阵出口 + 全场景二级入口。
 * 个人工作台保留在 /dashboard，本页只承担「讲故事」职责。
 * 视觉：全量对齐 styles/variables.css 设计系统（酒局紫 × 塔罗古金 × 深空黑磨砂玻璃）。
 */

const COLORS = {
  bgCard: 'rgba(20, 18, 37, 0.5)',          // 同 .home-stat-card 磨砂玻璃
  bgCardSoft: 'rgba(20, 18, 37, 0.4)',
  borderGold: 'rgba(212, 175, 55, 0.25)',   // var(--border-gold)
  borderGoldStrong: 'rgba(212, 175, 55, 0.4)',
  borderPurple: 'rgba(168, 85, 247, 0.2)',  // var(--border-medium)
  text: '#ffffff',
  sec: 'rgba(255, 255, 255, 0.7)',
  dim: 'rgba(255, 255, 255, 0.4)',
  purple: '#a855f7',
  purpleLight: '#c4b5fd',
  gold: '#D4AF37',
};

const S = {
  page: {
    minHeight: '100vh',
    background: 'transparent', // 继承 body 全局紫金深空氛围（index.css body::before）
    color: COLORS.text,
    fontFamily: "'Segoe UI', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    padding: '48px 24px 64px',
  },
  wrap: { maxWidth: 960, margin: '0 auto' },
  badge: {
    display: 'inline-block',
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.purpleLight,
    border: '1px solid rgba(168, 85, 247, 0.35)',
    borderRadius: 999,
    padding: '5px 16px',
    marginBottom: 22,
    background: COLORS.bgCardSoft,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  },
  h1: { fontSize: 34, fontWeight: 700, lineHeight: 1.35, margin: '0 0 14px' },
  h1Accent: {
    background: 'linear-gradient(135deg, #D4AF37 0%, #F5F5F0 50%, #a855f7 100%)', // var(--gradient-title)
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  sub: { fontSize: 15, lineHeight: 1.9, color: COLORS.sec, maxWidth: 720, margin: '0 0 20px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 26 },
  chip: {
    fontSize: 12, color: COLORS.sec,
    border: `1px solid ${COLORS.borderPurple}`, borderRadius: 999, padding: '4px 12px',
    background: COLORS.bgCardSoft,
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  btnPrimary: {
    padding: '12px 26px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #a855f7 0%, #D4AF37 100%)', // var(--gradient-btn-primary)
    color: '#fff', fontSize: 14, fontWeight: 600,
    boxShadow: '0 0 24px rgba(168, 85, 247, 0.2)', // var(--glow-purple)
  },
  btnGhost: {
    padding: '12px 22px', borderRadius: 10, cursor: 'pointer',
    background: COLORS.bgCardSoft, border: `1px solid ${COLORS.borderPurple}`,
    color: COLORS.sec, fontSize: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: 600, margin: '46px 0 4px' },
  sectionSub: { fontSize: 12.5, color: COLORS.dim, marginBottom: 16, letterSpacing: 1 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 },
  card: {
    display: 'block', textAlign: 'left', width: '100%',
    padding: '20px 22px', borderRadius: 16, // var(--radius-md)
    background: COLORS.bgCard,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `1px solid ${COLORS.borderGold}`,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', // var(--shadow-md)
    cursor: 'pointer', transition: 'all .3s cubic-bezier(0.4, 0, 0.2, 1)', color: COLORS.text,
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardEmoji: { fontSize: 22 },
  cardTag: {
    fontSize: 11, color: COLORS.purpleLight,
    border: '1px solid rgba(168, 85, 247, 0.35)', borderRadius: 999, padding: '2px 10px',
  },
  cardName: { fontSize: 15.5, fontWeight: 600, marginBottom: 6 },
  cardDesc: { fontSize: 12.5, lineHeight: 1.7, color: COLORS.sec },
  cardGo: { marginTop: 10, fontSize: 12, color: COLORS.gold },
  linkGroups: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 },
  linkGroup: {
    padding: '14px 16px', borderRadius: 16,
    background: COLORS.bgCardSoft, border: `1px solid ${COLORS.borderPurple}`,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  },
  linkGroupTitle: { fontSize: 12, color: COLORS.dim, letterSpacing: 2, marginBottom: 10 },
  linkItem: {
    display: 'block', fontSize: 13, color: COLORS.sec, padding: '4px 0',
    cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left', width: '100%',
  },
};

const CURATED = [
  {
    emoji: '🧬', tag: '方法论旗舰', name: 'DNA分析 · 决策染色体', path: '/genome',
    desc: 'IEEE 论文同款方法论的可交互版：八维决策基因、核型诊断、漂移检测。看这一页就知道整套系统怎么思考。',
  },
  {
    emoji: '📈', tag: '金融核心', name: '股价模拟', path: '/stock',
    desc: '人格 × 市场行为：不同决策人格在同一行情下的操作分叉，行为金融学的实时推演台。',
  },
  {
    emoji: '🃏', tag: '全栈在线', name: '德州扑克', path: '/poker',
    desc: '16 型人格 AI 牌手在线对局，FastAPI + WebSocket 全栈实战，人格化决策全程可解释。',
  },
  {
    emoji: '🪞', tag: '向量引擎', name: '人格镜子', path: '/persona-mirror',
    desc: '六维向量最近邻映射：投资人镜像、名人镜像，看「你的人格在金融史上有哪些影子」。',
  },
  {
    emoji: '🧠', tag: '认知科学', name: '认知引擎 MindSpeak', path: '/mindspeak',
    desc: '认知画圈：概念节点、关系张力、内耗与合力的可视化推演，决策的底层操作系统。',
  },
];

const MATRIX = [
  { emoji: '🛩️', domain: '低空经济', name: 'AirMind OS', url: 'https://hellomind-star.github.io/airmind-os/', desc: 'Kelly 博弈定价 × 应急调度 × 算力浓度监控的低空决策中枢。' },
  { emoji: '🎬', domain: '内容市场', name: '短剧 MBTI 推演器', url: 'https://hellomind-star.github.io/short-drama-mbti/', desc: '人格向量 × 平台适配，「前额叶×边缘系统」双引擎发布策略。' },
  { emoji: '🎰', domain: '博弈对抗', name: 'Poker Face Arena', url: 'https://hellomind-star.github.io/poker-egg-fullstack/', desc: '独立部署的扑克人格竞技场，16 型 AI 对手公开可玩。' },
  { emoji: '🍸', domain: '消费体验', name: 'Y.MINE 人格调酒系统', url: 'https://hellomind-star.github.io/personality-wine-mixing/', desc: 'MBTI 分子调酒全栈系统：人格 → 风味/声场/视觉的五感映射。' },
  { emoji: '⚙️', domain: '元工具', name: '智能工坊 Agent Studio', url: 'https://hellomind-star.github.io/agent-studio-board/', desc: '多模型路由与 Agent 工作流编排控制台 —— 我指挥 AI 军团的方式。' },
  { emoji: '🌌', domain: '总览', name: '返回作品集', url: 'https://hellomind-star.github.io/ymine-validation-hub/', desc: '跨域应用矩阵总览 · 论文 · 实验集群 · 完整项目列表。' },
];

const GROUPS = [
  { title: 'FINANCE · 金融', items: [
    ['信息漏斗', '/funnel'], ['股价模拟', '/stock'], ['公司理财', '/finance'],
    ['风险压力', '/risk'], ['向量分析', '/vector'], ['投行看板', '/ib-dashboard'], ['可信中台', '/trust-dashboard'],
  ]},
  { title: 'PERSONA · 人格', items: [
    ['DNA分析', '/genome'], ['认知引擎', '/mindspeak'], ['人格镜子', '/persona-mirror'],
    ['心理盘面', '/psychology'], ['脉轮测试', '/chakra'], ['培养方案', '/cultivation-plan'],
  ]},
  { title: 'BEHAVIOR · 行为', items: [
    ['德州扑克', '/poker'], ['台球', '/billiards'], ['健身', '/fitness'],
    ['K线音乐', '/music'], ['模拟博弈台', '/game-table'], ['娱乐方式', '/entertainment'],
  ]},
  { title: 'OUTPUT · 输出', items: [
    ['内容中枢', '/content-hub'], ['游戏引擎', '/game-engine'], ['人形机器人', '/robot'], ['无人机调度', '/drone-dispatch'],
  ]},
  { title: '记录与系统', items: [
    ['驾驶舱', '/cockpit'], ['投资人档案', '/archive'], ['故事集', '/stories'],
    ['陪练记录', '/coach-logs'], ['系统工具', '/tools'], ['塔罗指引', '/tarot'], ['调酒', '/bartender'],
  ]},
];

const ShowcasePage = () => {
  const navigate = useNavigate();

  const hover = (e, on) => {
    e.currentTarget.style.borderColor = on ? COLORS.borderGoldStrong : COLORS.borderGold;
    e.currentTarget.style.transform = on ? 'translateY(-4px)' : 'none';
    e.currentTarget.style.boxShadow = on
      ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 24px rgba(212, 175, 55, 0.2)' // var(--glow-gold)
      : '0 8px 32px rgba(0, 0, 0, 0.4)';
  };

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* ===== Hero 定位 ===== */}
        <span style={S.badge}>GAME-OS 应用层 · 人格金融孪生平台</span>
        <h1 style={S.h1}>
          把行为数据，炼成<span style={S.h1Accent}>可审计的决策人格</span>
        </h1>
        <p style={S.sub}>
          一套 KMP → IPD → 六维向量内核，驱动本平台 30+ 在线交互场景。
          同一内核已迁移至低空经济、内容市场、博弈对抗与消费体验 ——
          下面是一条为面试官设计的 5 分钟动线。
        </p>
        <div style={S.chips}>
          {['30+ 在线交互场景', '16 型人格引擎', '六维决策向量', '全栈自研 React + FastAPI', 'IEEE 预印本方法论'].map(c => (
            <span key={c} style={S.chip}>{c}</span>
          ))}
        </div>
        <div style={S.actions}>
          <button style={S.btnPrimary} onClick={() => navigate('/genome')}>🧬 从决策染色体看起</button>
          <button style={S.btnGhost} onClick={() => navigate('/dashboard')}>进入我的工作台 →</button>
          <a style={{ ...S.btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
             href="https://hellomind-star.github.io/ymine-validation-hub/" target="_blank" rel="noopener noreferrer">
            🌌 作品集总览
          </a>
        </div>

        {/* ===== 策展必看 ===== */}
        <div style={S.sectionTitle}>🎯 策展动线 · 五站看懂这套系统</div>
        <div style={S.sectionSub}>CURATED PATH · 按顺序参观约 5 分钟</div>
        <div style={S.grid2}>
          {CURATED.map((c, i) => (
            <button key={c.path} style={S.card}
                    onClick={() => navigate(c.path)}
                    onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
              <div style={S.cardHead}>
                <span style={S.cardEmoji}>{c.emoji}</span>
                <span style={S.cardTag}>第 {i + 1} 站 · {c.tag}</span>
              </div>
              <div style={S.cardName}>{c.name}</div>
              <div style={S.cardDesc}>{c.desc}</div>
              <div style={S.cardGo}>进入 →</div>
            </button>
          ))}
        </div>

        {/* ===== 同构系统矩阵 ===== */}
        <div style={S.sectionTitle}>🌐 同一内核 · 五个域</div>
        <div style={S.sectionSub}>CROSS-DOMAIN MATRIX · 跨域同构：方法论不换，场景随便换</div>
        <div style={S.grid2}>
          {MATRIX.map(m => (
            <a key={m.url} style={{ ...S.card, textDecoration: 'none' }}
               href={m.url} target="_blank" rel="noopener noreferrer"
               onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
              <div style={S.cardHead}>
                <span style={S.cardEmoji}>{m.emoji}</span>
                <span style={S.cardTag}>{m.domain}</span>
              </div>
              <div style={S.cardName}>{m.name}</div>
              <div style={S.cardDesc}>{m.desc}</div>
              <div style={S.cardGo}>Live ↗</div>
            </a>
          ))}
        </div>

        {/* ===== 全场景索引（二级入口）===== */}
        <div style={S.sectionTitle}>🗂 全场景索引</div>
        <div style={S.sectionSub}>ALL MODULES · 30+ 场景按域分组</div>
        <div style={S.linkGroups}>
          {GROUPS.map(g => (
            <div key={g.title} style={S.linkGroup}>
              <div style={S.linkGroupTitle}>{g.title}</div>
              {g.items.map(([label, path]) => (
                <button key={path} style={S.linkItem}
                        onMouseEnter={e => { e.currentTarget.style.color = COLORS.purpleLight; }}
                        onMouseLeave={e => { e.currentTarget.style.color = COLORS.sec; }}
                        onClick={() => navigate(path)}>
                  {label} <span style={{ color: COLORS.dim, fontSize: 11 }}>→</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShowcasePage;
