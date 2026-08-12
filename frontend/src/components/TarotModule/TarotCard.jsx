/**
 * 塔罗牌 SVG 牌面组件
 * 22 张大牌,每张独立几何符号设计
 * 深色底 + 金色线条 + 罗马数字 + 牌名
 */
import React from 'react';

const GOLD = '#D4AF37';
const GOLD_DIM = 'rgba(212, 175, 55, 0.4)';

/**
 * 根据 symbol 类型渲染中心几何符号
 * viewBox: 0 0 200 300, 符号区域约 y:70-230
 */
function renderSymbol(symbol, color) {
  const cx = 100;
  const cy = 150;
  const stroke = color || GOLD;

  switch (symbol) {
    // 0 愚者 — 上行箭头 + 顶部小圆(太阳)
    case 'fool':
      return (
        <g stroke={stroke} fill="none" strokeWidth="1.5" strokeLinecap="round">
          <circle cx={cx} cy={85} r="10" />
          <line x1={cx} y1={100} x2={cx} y2={210} strokeWidth="2" />
          <polyline points="82,130 100,110 118,130" strokeWidth="2" />
          <circle cx={cx} cy={85} r="6" fill={stroke} fillOpacity="0.15" />
        </g>
      );

    // I 魔术师 — 无限符号
    case 'magician':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinecap="round">
          <path d="M 70 150 C 70 125, 100 125, 100 150 C 100 175, 130 175, 130 150 C 130 125, 100 125, 100 150 C 100 175, 70 175, 70 150 Z" />
          <circle cx={cx} cy={150} r="38" stroke={GOLD_DIM} strokeWidth="1" strokeDasharray="3 4" />
        </g>
      );

    // II 女祭司 — 双柱 + 月亮 + 中心光点
    case 'priestess':
      return (
        <g stroke={stroke} fill="none" strokeWidth="1.5" strokeLinecap="round">
          <line x1={60} y1={95} x2={60} y2={210} strokeWidth="2" />
          <line x1={140} y1={95} x2={140} y2={210} strokeWidth="2" />
          <circle cx={60} cy={90} r="4" fill={stroke} />
          <circle cx={140} cy={90} r="4" fill={stroke} />
          <path d="M 88 130 A 16 16 0 1 0 112 130 A 12 12 0 1 1 88 130 Z" fill={stroke} fillOpacity="0.15" transform="rotate(15 100 140)" />
          <circle cx={cx} cy={170} r="3" fill={stroke} />
          <line x1={80} y1={170} x2={120} y2={170} stroke={GOLD_DIM} />
        </g>
      );

    // III 女皇 — 六瓣花(Vesica Piscis)
    case 'empress':
      return (
        <g stroke={stroke} fill="none" strokeWidth="1.5">
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <circle key={deg} cx={cx + 16 * Math.cos((deg * Math.PI) / 180)} cy={cy + 16 * Math.sin((deg * Math.PI) / 180)} r="20" />
          ))}
          <circle cx={cx} cy={cy} r="6" fill={stroke} fillOpacity="0.2" />
        </g>
      );

    // IV 皇帝 — 方形 + 对角十字
    case 'emperor':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinecap="round">
          <rect x={70} y={110} width="60" height="80" rx="2" />
          <line x1={70} y1={110} x2={130} y2={190} stroke={GOLD_DIM} strokeWidth="1" />
          <line x1={130} y1={110} x2={70} y2={190} stroke={GOLD_DIM} strokeWidth="1" />
          <line x1={cx} y1={100} x2={cx} y2={200} />
          <line x1={60} y1={cy} x2={140} y2={cy} />
        </g>
      );

    // V 教皇 — 三层横杠 + 竖线(三重冠)
    case 'hierophant':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinecap="round">
          <line x1={75} y1={110} x2={125} y2={110} />
          <line x1={70} y1={130} x2={130} y2={130} />
          <line x1={65} y1={150} x2={135} y2={150} />
          <line x1={cx} y1={95} x2={cx} y2={195} />
          <circle cx={cx} cy={95} r="5" fill={stroke} fillOpacity="0.2" />
          <line x1={85} y1={180} x2={85} y2={200} strokeWidth="1.5" />
          <line x1={115} y1={180} x2={115} y2={200} strokeWidth="1.5" />
        </g>
      );

    // VI 恋人 — 两个交叠圆
    case 'lovers':
      return (
        <g stroke={stroke} fill="none" strokeWidth="1.5">
          <circle cx={82} cy={cy} r="28" />
          <circle cx={118} cy={cy} r="28" />
          <circle cx={cx} cy={cy} r="4" fill={stroke} fillOpacity="0.3" />
          <line x1={cx} y1={110} x2={cx} y2={195} stroke={GOLD_DIM} strokeDasharray="2 3" />
        </g>
      );

    // VII 战车 — 八角星
    case 'chariot':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinejoin="round">
          <polygon points="100,95 110,135 150,135 118,158 130,195 100,172 70,195 82,158 50,135 90,135" />
          <circle cx={cx} cy={cy} r="5" fill={stroke} fillOpacity="0.2" />
        </g>
      );

    // VIII 力量 — 无限符号 + 外圈射线
    case 'strength':
      return (
        <g stroke={stroke} fill="none" strokeWidth="1.5" strokeLinecap="round">
          <path d="M 75 150 C 75 132, 95 132, 100 150 C 105 168, 125 168, 125 150 C 125 132, 105 132, 100 150 C 95 168, 75 168, 75 150 Z" strokeWidth="2" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            return <line key={i} x1={cx + 42 * Math.cos(a)} y1={cy + 42 * Math.sin(a)} x2={cx + 50 * Math.cos(a)} y2={cy + 50 * Math.sin(a)} strokeWidth="1" stroke={GOLD_DIM} />;
          })}
        </g>
      );

    // IX 隐士 — 六边形灯笼 + 中心光点
    case 'hermit':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinejoin="round">
          <polygon points="100,95 130,112 130,148 100,165 70,148 70,112" />
          <polygon points="100,115 120,125 120,145 100,155 80,145 80,125" stroke={GOLD_DIM} strokeWidth="1" />
          <circle cx={cx} cy={cy} r="6" fill={stroke} fillOpacity="0.3" />
          <line x1={cx} y1={75} x2={cx} y2={95} strokeWidth="1.5" />
        </g>
      );

    // X 命运之轮 — 圆 + 八辐
    case 'wheel':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2">
          <circle cx={cx} cy={cy} r="45" />
          <circle cx={cx} cy={cy} r="32" stroke={GOLD_DIM} strokeWidth="1" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * 45 * Math.PI) / 180;
            return <line key={i} x1={cx} y1={cy} x2={cx + 45 * Math.cos(a)} y2={cy + 45 * Math.sin(a)} strokeWidth="1.5" />;
          })}
          <circle cx={cx} cy={cy} r="5" fill={stroke} fillOpacity="0.2" />
        </g>
      );

    // XI 正义 — 天平(三角 + 水平线 + 悬挂)
    case 'justice':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinecap="round">
          <line x1={cx} y1={95} x2={cx} y2={200} />
          <line x1={65} y1={130} x2={135} y2={130} />
          <line x1={65} y1={130} x2={65} y2={150} stroke={GOLD_DIM} />
          <line x1={135} y1={130} x2={135} y2={150} stroke={GOLD_DIM} />
          <polygon points="50,150 80,150 65,165" />
          <polygon points="120,150 150,150 135,165" />
          <line x1={70} y1={200} x2={130} y2={200} strokeWidth="2" />
        </g>
      );

    // XII 倒吊人 — 倒三角 + 中心圆
    case 'hanged':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinejoin="round">
          <polygon points="70,110 130,110 100,185" />
          <line x1={cx} y1={95} x2={cx} y2={110} stroke={GOLD_DIM} />
          <circle cx={cx} cy={140} r="6" fill={stroke} fillOpacity="0.2" />
          <line x1={85} y1={195} x2={115} y2={195} strokeWidth="1.5" />
        </g>
      );

    // XIII 死神 — 螺旋
    case 'death':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinecap="round">
          <path d="M 100 110 A 40 40 0 1 1 60 150 A 30 30 0 1 1 90 150 A 20 20 0 1 1 110 150 A 10 10 0 1 1 100 150" />
          <circle cx={cx} cy={cy} r="3" fill={stroke} />
        </g>
      );

    // XIV 节制 — 两个交叠三角(六芒星)
    case 'temperance':
      return (
        <g stroke={stroke} fill="none" strokeWidth="1.5" strokeLinejoin="round">
          <polygon points="100,100 135,160 65,160" />
          <polygon points="100,200 65,140 135,140" />
          <circle cx={cx} cy={cy} r="4" fill={stroke} fillOpacity="0.2" />
        </g>
      );

    // XV 恶魔 — 倒五角星
    case 'devil':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinejoin="round">
          <polygon points="100,110 118,170 70,135 130,135 82,170" />
          <circle cx={cx} cy={cy} r="45" stroke={GOLD_DIM} strokeWidth="1" strokeDasharray="2 4" />
        </g>
      );

    // XVI 高塔 — 闪电(锯齿) + 竖线
    case 'tower':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x={78} y={100} width="44" height="100" rx="1" />
          <polyline points="100,95 85,130 105,140 90,170 100,195" strokeWidth="2.5" />
          <line x1={78} y1={130} x2={122} y2={130} stroke={GOLD_DIM} strokeWidth="1" />
        </g>
      );

    // XVII 星星 — 八角星 + 中心点
    case 'star':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinejoin="round">
          <polygon points="100,90 108,130 148,130 116,152 128,190 100,168 72,190 84,152 52,130 92,130" />
          <circle cx={cx} cy={cy} r="4" fill={stroke} fillOpacity="0.3" />
        </g>
      );

    // XVIII 月亮 — 弯月 + 滴落
    case 'moon':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinecap="round">
          <path d="M 115 110 A 38 38 0 1 0 115 190 A 28 28 0 1 1 115 110 Z" fill={stroke} fillOpacity="0.08" />
          <circle cx={75} cy={210} r="2" fill={stroke} />
          <circle cx={cx} cy={215} r="2" fill={stroke} />
          <circle cx={125} cy={210} r="2" fill={stroke} />
        </g>
      );

    // XIX 太阳 — 圆 + 放射线
    case 'sun':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinecap="round">
          <circle cx={cx} cy={cy} r="30" fill={stroke} fillOpacity="0.08" />
          <circle cx={cx} cy={cy} r="30" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            return <line key={i} x1={cx + 36 * Math.cos(a)} y1={cy + 36 * Math.sin(a)} x2={cx + 48 * Math.cos(a)} y2={cy + 48 * Math.sin(a)} strokeWidth="1.5" />;
          })}
          <circle cx={cx} cy={cy} r="6" fill={stroke} fillOpacity="0.3" />
        </g>
      );

    // XX 审判 — 号角(V形 + 线)
    case 'judgement':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="65,120 100,100 135,120" />
          <polyline points="70,140 100,125 130,140" stroke={GOLD_DIM} />
          <line x1={cx} y1={100} x2={cx} y2={195} />
          <line x1={75} y1={195} x2={125} y2={195} />
          <circle cx={cx} cy={95} r="4" fill={stroke} fillOpacity="0.2" />
        </g>
      );

    // XXI 世界 — 圆 + 内十字(曼陀罗)
    case 'world':
      return (
        <g stroke={stroke} fill="none" strokeWidth="2">
          <circle cx={cx} cy={cy} r="45" />
          <ellipse cx={cx} cy={cy} rx="45" ry="20" stroke={GOLD_DIM} strokeWidth="1" />
          <ellipse cx={cx} cy={cy} rx="20" ry="45" stroke={GOLD_DIM} strokeWidth="1" />
          <line x1={55} y1={cy} x2={145} y2={cy} stroke={GOLD_DIM} strokeWidth="1" />
          <line x1={cx} y1={105} x2={cx} y2={195} stroke={GOLD_DIM} strokeWidth="1" />
          <circle cx={cx} cy={cy} r="6" fill={stroke} fillOpacity="0.25" />
        </g>
      );

    default:
      return <circle cx={cx} cy={cy} r="30" stroke={stroke} fill="none" strokeWidth="2" />;
  }
}

/**
 * 塔罗牌牌面组件
 * @param {{ card: object, width?: number, height?: number }} props
 */
export default function TarotCard({ card, width = 200, height = 300 }) {
  if (!card) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 300"
      style={{ display: 'block' }}
    >
      {/* 顶部罗马数字 */}
      <text
        x="100"
        y="40"
        textAnchor="middle"
        fill={GOLD}
        fontSize="16"
        fontWeight="300"
        letterSpacing="3"
        fontFamily="serif"
      >
        {card.id}
      </text>

      {/* 顶部装饰线 */}
      <line x1="70" y1="52" x2="130" y2="52" stroke={GOLD_DIM} strokeWidth="0.8" />

      {/* 中心几何符号 */}
      {renderSymbol(card.symbol, card.color)}

      {/* 底部装饰线 */}
      <line x1="70" y1="248" x2="130" y2="248" stroke={GOLD_DIM} strokeWidth="0.8" />

      {/* 底部牌名 */}
      <text
        x="100"
        y="270"
        textAnchor="middle"
        fill={GOLD}
        fontSize="13"
        fontWeight="400"
        letterSpacing="4"
        fontFamily="serif"
      >
        {card.name}
      </text>

      {/* 底部英文牌名 */}
      <text
        x="100"
        y="285"
        textAnchor="middle"
        fill="rgba(212,175,55,0.4)"
        fontSize="8"
        letterSpacing="2"
      >
        {card.nameEn.toUpperCase()}
      </text>
    </svg>
  );
}
