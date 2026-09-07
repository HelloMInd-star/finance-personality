import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ShowcasePage —— 策展式首页（面试官导览）
 * 定位：平台对外首屏。策展 5 个必看 Demo + 同构系统矩阵出口 + 全场景二级入口。
 * 个人工作台保留在 /dashboard，本页只承担「讲故事」职责。
 * 视觉：卡片全量复用 Dashboard 系统卡片语言（rgba(30,19,64,0.6) 紫调玻璃 +
 * 渐变 banner + 大 emoji + 玻璃徽标 + hover 紫光浮起），与全站其他页面同频。
 */

const COLORS = {
  text: '#ffffff',
  sec: 'rgba(255, 255, 255, 0.7)',
  dim: 'rgba(255, 255, 255, 0.4)',
  purple: '#a855f7',
  purpleLight: '#c4b5fd',
  gold: '#D4AF37',
  cardBg: 'rgba(30, 19, 64, 0.6)',            // 同 .system-card
  cardBgSoft: 'rgba(30, 19, 64, 0.4)',
  cardBorder: 'rgba(139, 92, 246, 0.18)',     // 同 .system-card
  cardBorderHover: 'rgba(139, 92, 246, 0.5)', // 同 .system-card:hover
};

const S = {
  page: {
    minHeight: '100vh',
    background: 'transparent', // 继承 body 全局紫金深空氛围（index.css body::before）
    color: COLORS.text,
    fontFamily: "'Segoe UI', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    padding: '56px 24px 80px',
  },
  wrap: { maxWidth: 1080, margin: '0 auto' },

  /* ===== Hero ===== */
  badge: {
    display: 'inline-block',
    fontSize: 12,
    letterSpacing: 2,
    color: COLORS.purpleLight,
    border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 999,
    padding: '5px 16px',
    marginBottom: 22,
    background: COLORS.cardBgSoft,
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
  sub: { fontSize: 15, lineHeight: 1.9, color: COLORS.sec, maxWidth: 760, margin: '0 0 20px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 26 },
  chip: {
    fontSize: 12, color: COLORS.sec,
    border: `1px solid ${COLORS.cardBorder}`, borderRadius: 999, padding: '4px 12px',
    background: COLORS.cardBgSoft,
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  btnPrimary: {
    padding: '12px 26px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #a855f7 0%, #D4AF37 100%)', // var(--gradient-btn-primary)
    color: '#fff', fontSize: 14, fontWeight: 600,
    boxShadow: '0 0 24px rgba(168, 85, 247, 0.2)', // var(--glow-purple)
    transition: 'all 0.3s ease',
  },
  btnGhost: {
    padding: '12px 22px', borderRadius: 10, cursor: 'pointer',
    background: COLORS.cardBgSoft, border: `1px solid ${COLORS.cardBorder}`,
    color: COLORS.sec, fontSize: 14, transition: 'all 0.3s ease',
  },

  /* ===== 分区标题 ===== */
  section: { marginTop: 56 },
  sectionTitle: { fontSize: 18, fontWeight: 600, margin: '0 0 4px' },
  sectionSub: { fontSize: 12.5, color: COLORS.dim, marginBottom: 18, letterSpacing: 1 },

  /* ===== 系统卡片（复用 Dashboard system-card 语言）===== */
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  card: {
    display: 'block', textAlign: 'left', width: '100%',
    padding: 0, borderRadius: 16, overflow: 'hidden',
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.cardBorder}`,
    cursor: 'pointer', transition: 'all 0.3s ease', color: COLORS.text,
  },
  banner: (gradient) => ({
    height: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 20px', position: 'relative', overflow: 'hidden',
    background: gradient,
  }),
  bannerSheen: { // 等价于 .system-card-banner::before 的高光层
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  bannerEmoji: {
    fontSize: 36, color: '#fff', zIndex: 1,
    filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))',
  },
  bannerTag: {
    fontSize: 11, fontWeight: 500, color: '#fff', zIndex: 1,
    background: 'rgba(255, 255, 255, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: 999, padding: '3px 12px',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    whiteSpace: 'nowrap',
  },
  cardBody: { padding: '18px 20px 20px' },
  cardName: { fontSize: 15, fontWeight: 600, marginBottom: 6 },
  cardDesc: { fontSize: 12.5, lineHeight: 1.7, color: COLORS.sec },
  cardGo: { marginTop: 10, fontSize: 12, color: COLORS.purpleLight },

  /* ===== 全场景索引 ===== */
  linkGroups: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  linkGroup: {
    padding: '14px 16px', borderRadius: 16,
    background: COLORS.cardBgSoft, border: `1px solid ${COLORS.cardBorder}`,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  },
  linkGroupTitle: { fontSize: 12, color: COLORS.dim, letterSpacing: 2, marginBottom: 10 },
  linkItem: {
    display: 'block', fontSize: 13, color: COLORS.sec, padding: '4px 0',
    cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left', width: '100%',
  },
};

/* 紫金家族 banner 渐变（每张卡一支，全部落在品牌色系内） */
const GRAD = {
  violetDeep: 'linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)',
  purpleCore: 'linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)',
  purpleGold: 'linear-gradient(135deg, #a855f7 0%, #D4AF37 100%)',
  violetSoft: 'linear-gradient(135deg, #7c3aed 0%, #c4b5fd 100%)',
  goldViolet: 'linear-gradient(135deg, #8b5cf6 0%, #D4AF37 100%)',
};

const CURATED = [
  {
    emoji: '🧬', tag: '方法论旗舰', name: 'DNA分析 · 决策染色体', path: '/genome', grad: GRAD.purpleCore,
    desc: 'IEEE 论文同款方法论的可交互版：八维决策基因、核型诊断、漂移检测。看这一页就知道整套系统怎么思考。',
  },
  {
    emoji: '📈', tag: '金融核心', name: '股价模拟', path: '/stock', grad: GRAD.purpleGold,
    desc: '人格 × 市场行为：不同决策人格在同一行情下的操作分叉，行为金融学的实时推演台。',
  },
  {
    emoji: '🎴', tag: '全栈在线', name: '德州扑克', path: '/poker', grad: GRAD.violetDeep,
    desc: '16 型人格 AI 牌手在线对局，FastAPI + WebSocket 全栈实战，人格化决策全程可解释。',
  },
  {
    emoji: '🪞', tag: '向量引擎', name: '人格镜子', path: '/persona-mirror', grad: GRAD.violetSoft,
    desc: '六维向量最近邻映射：投资人镜像、名人镜像，看「你的人格在金融史上有哪些影子」。',
  },
  {
    emoji: '🧠', tag: '认知科学', name: '认知引擎 MindSpeak', path: '/mindspeak', grad: GRAD.goldViolet,
    desc: '认知画圈：概念节点、关系张力、内耗与合力的可视化推演，决策的底层操作系统。',
  },
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

  // 与 .system-card hover 完全同参数：浮起 -6px + 紫边 0.5 + 双层紫光阴影
  const hover = (e, on) => {
    const el = e.currentTarget;
    el.style.transform = on ? 'translateY(-6px)' : 'none';
    el.style.borderColor = on ? COLORS.cardBorderHover : COLORS.cardBorder;
    el.style.boxShadow = on
      ? '0 16px 48px rgba(0, 0, 0, 0.4), 0 0 30px rgba(139, 92, 246, 0.15)'
      : 'none';
  };

  const renderCard = (c, tagText, onClick, href) => {
    const inner = (
      <>
        <div style={S.banner(c.grad)}>
          <div style={S.bannerSheen} />
          <span style={S.bannerEmoji}>{c.emoji}</span>
          <span style={S.bannerTag}>{tagText}</span>
        </div>
        <div style={S.cardBody}>
          <div style={S.cardName}>{c.name}</div>
          <div style={S.cardDesc}>{c.desc}</div>
          <div style={S.cardGo}>{href ? 'Live ↗' : '进入 →'}</div>
        </div>
      </>
    );
    const common = {
      style: S.card,
      onMouseEnter: e => hover(e, true),
      onMouseLeave: e => hover(e, false),
    };
    return href
      ? <a key={href} {...common} href={href} target="_blank" rel="noopener noreferrer" style={{ ...S.card, textDecoration: 'none' }}>{inner}</a>
      : <button key={c.path} {...common} onClick={onClick}>{inner}</button>;
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
        </div>

        {/* ===== 策展必看 ===== */}
        <div style={S.section}>
          <div style={S.sectionTitle}>🎯 策展动线 · 五站看懂这套系统</div>
          <div style={S.sectionSub}>CURATED PATH · 按顺序参观约 5 分钟</div>
          <div style={S.grid2}>
            {CURATED.map((c, i) => renderCard(c, `第 ${i + 1} 站 · ${c.tag}`, () => navigate(c.path)))}
          </div>
        </div>


        {/* ===== 全场景索引（二级入口）===== */}
        <div style={S.section}>
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
    </div>
  );
};

export default ShowcasePage;
