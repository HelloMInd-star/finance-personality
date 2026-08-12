/**
 * 塔罗牌数据 · 78 张
 *   22 张大阿尔卡纳 · 手写牌义 + 人格权重
 *   56 张小阿尔卡纳 · 程序化生成（4 花色 × 14 张）
 *
 * 人格权重范围 -0.25 ~ +0.25，呼应牌意
 * 六维 PersonaVector：TOL(容错) SPD(速度) INF(信息) ENT(热情) LEAD(主导) VIS(直觉)
 *
 * 从 Y.Mine 人格调酒系统迁移 · TS → JS
 */

// ═════════════════════════════════════════════════════════
// 大阿尔卡纳 · 22 张
// ═════════════════════════════════════════════════════════

const MAJOR_ARCANA = [
  {
    id: 0, name: '愚者', nameEn: 'The Fool', arcana: 'major', element: '风',
    meaningUpright: '新的开始 · 纯真 · 自由 · 冒险',
    meaningReversed: '鲁莽 · 轻率 · 未经思考的跃步',
    personaWeights: { VIS: 0.2, TOL: 0.15, ENT: 0.1 },
  },
  {
    id: 1, name: '魔术师', nameEn: 'The Magician', arcana: 'major', element: '风',
    meaningUpright: '创造 · 意志 · 技巧 · 显化',
    meaningReversed: '操纵 · 滥用才能 · 欺瞒',
    personaWeights: { LEAD: 0.2, VIS: 0.15 },
  },
  {
    id: 2, name: '女祭司', nameEn: 'The High Priestess', arcana: 'major', element: '水',
    meaningUpright: '直觉 · 神秘 · 内在智慧 · 静默',
    meaningReversed: '秘密 · 被压抑的直觉 · 表面化',
    personaWeights: { INF: 0.2, VIS: 0.15 },
  },
  {
    id: 3, name: '皇后', nameEn: 'The Empress', arcana: 'major', element: '土',
    meaningUpright: '丰饶 · 母性 · 创造力 · 滋养',
    meaningReversed: '依赖 · 过度保护 · 创造停滞',
    personaWeights: { LEAD: 0.15, INF: 0.1 },
  },
  {
    id: 4, name: '皇帝', nameEn: 'The Emperor', arcana: 'major', element: '火',
    meaningUpright: '权威 · 秩序 · 结构 · 统御',
    meaningReversed: '专制 · 僵化 · 滥权',
    personaWeights: { LEAD: 0.25, TOL: 0.1 },
  },
  {
    id: 5, name: '教皇', nameEn: 'The Hierophant', arcana: 'major', element: '土',
    meaningUpright: '传统 · 教导 · 信仰 · 体制',
    meaningReversed: '反叛 · 非常规 · 自由信念',
    personaWeights: { INF: 0.18, LEAD: 0.08 },
  },
  {
    id: 6, name: '恋人', nameEn: 'The Lovers', arcana: 'major', element: '风',
    meaningUpright: '选择 · 结合 · 价值 · 和谐',
    meaningReversed: '失调 · 错误选择 · 关系裂痕',
    personaWeights: { VIS: 0.15, ENT: 0.1 },
  },
  {
    id: 7, name: '战车', nameEn: 'The Chariot', arcana: 'major', element: '火',
    meaningUpright: '意志 · 胜利 · 控制 · 前进',
    meaningReversed: '失控 · 方向迷失 · 冲动',
    personaWeights: { LEAD: 0.22, TOL: 0.12 },
  },
  {
    id: 8, name: '力量', nameEn: 'Strength', arcana: 'major', element: '火',
    meaningUpright: '勇气 · 克制 · 柔韧 · 内在力量',
    meaningReversed: '自我怀疑 · 软弱 · 失控',
    personaWeights: { TOL: 0.15, LEAD: 0.1 },
  },
  {
    id: 9, name: '隐者', nameEn: 'The Hermit', arcana: 'major', element: '土',
    meaningUpright: '内省 · 智慧 · 孤独 · 寻道',
    meaningReversed: '孤立 · 封闭 · 拒绝指引',
    personaWeights: { INF: 0.22, VIS: 0.1 },
  },
  {
    id: 10, name: '命运之轮', nameEn: 'Wheel of Fortune', arcana: 'major', element: '火',
    meaningUpright: '机遇 · 循环 · 转折 · 命运',
    meaningReversed: '逆流 · 厄运 · 抗拒变化',
    personaWeights: { TOL: 0.18, VIS: 0.1 },
  },
  {
    id: 11, name: '正义', nameEn: 'Justice', arcana: 'major', element: '风',
    meaningUpright: '公正 · 平衡 · 真相 · 裁决',
    meaningReversed: '不公 · 偏见 · 逃避责任',
    personaWeights: { INF: 0.18, TOL: -0.08 },
  },
  {
    id: 12, name: '倒吊人', nameEn: 'The Hanged Man', arcana: 'major', element: '水',
    meaningUpright: '视角转换 · 牺牲 · 暂停 · 觉悟',
    meaningReversed: '停滞 · 无谓牺牲 · 抗拒改变',
    personaWeights: { VIS: 0.2, TOL: -0.1 },
  },
  {
    id: 13, name: '死神', nameEn: 'Death', arcana: 'major', element: '水',
    meaningUpright: '终结 · 转变 · 离去 · 新生',
    meaningReversed: '抗拒结束 · 停滞 · 恐惧变化',
    personaWeights: { TOL: 0.15, ENT: -0.1 },
  },
  {
    id: 14, name: '节制', nameEn: 'Temperance', arcana: 'major', element: '火',
    meaningUpright: '调和 · 平衡 · 耐心 · 融合',
    meaningReversed: '失调 · 过度 · 不耐',
    personaWeights: { INF: 0.12, TOL: -0.08 },
  },
  {
    id: 15, name: '恶魔', nameEn: 'The Devil', arcana: 'major', element: '土',
    meaningUpright: '束缚 · 欲望 · 执念 · 物质',
    meaningReversed: '解脱 · 觉醒 · 挣脱束缚',
    personaWeights: { ENT: 0.18, TOL: 0.15 },
  },
  {
    id: 16, name: '高塔', nameEn: 'The Tower', arcana: 'major', element: '火',
    meaningUpright: '突变 · 崩塌 · 觉醒 · 真相揭露',
    meaningReversed: '延缓灾难 · 抗拒突变 · 恐惧',
    personaWeights: { TOL: 0.2, SPD: 0.15 },
  },
  {
    id: 17, name: '星星', nameEn: 'The Star', arcana: 'major', element: '风',
    meaningUpright: '希望 · 灵感 · 信念 · 宁静',
    meaningReversed: '绝望 · 失望 · 信心动摇',
    personaWeights: { VIS: 0.22, ENT: 0.1 },
  },
  {
    id: 18, name: '月亮', nameEn: 'The Moon', arcana: 'major', element: '水',
    meaningUpright: '迷雾 · 潜意识 · 幻象 · 直觉',
    meaningReversed: '释惑 · 真相浮现 · 恐惧消散',
    personaWeights: { VIS: 0.2, INF: -0.1 },
  },
  {
    id: 19, name: '太阳', nameEn: 'The Sun', arcana: 'major', element: '火',
    meaningUpright: '成功 · 活力 · 喜悦 · 清明',
    meaningReversed: '暂时的阴霾 · 过度乐观 · 失光',
    personaWeights: { ENT: 0.22, LEAD: 0.12 },
  },
  {
    id: 20, name: '审判', nameEn: 'Judgement', arcana: 'major', element: '火',
    meaningUpright: '重生 · 召唤 · 觉醒 · 裁决',
    meaningReversed: '自我怀疑 · 错过召唤 · 苛责',
    personaWeights: { LEAD: 0.15, TOL: 0.12 },
  },
  {
    id: 21, name: '世界', nameEn: 'The World', arcana: 'major', element: '土',
    meaningUpright: '圆满 · 成就 · 整合 · 终章',
    meaningReversed: '未竟 · 拖延 · 缺失闭环',
    personaWeights: { LEAD: 0.18, INF: 0.12 },
  },
];

// ═════════════════════════════════════════════════════════
// 小阿尔卡纳 · 56 张（程序化生成）
// ═════════════════════════════════════════════════════════

const SUIT_META = {
  权杖: {
    en: 'Wands', element: '火',
    base: { LEAD: 0.1, TOL: 0.08, ENT: 0.06 },
    theme: '行动 · 热情 · 创造',
  },
  圣杯: {
    en: 'Cups', element: '水',
    base: { ENT: 0.1, VIS: 0.08 },
    theme: '情感 · 关系 · 直觉',
  },
  宝剑: {
    en: 'Swords', element: '风',
    base: { SPD: 0.1, VIS: 0.08, INF: 0.06 },
    theme: '思维 · 冲突 · 决断',
  },
  星币: {
    en: 'Pentacles', element: '土',
    base: { INF: 0.1, TOL: -0.06 },
    theme: '物质 · 稳定 · 务实',
  },
};

/** 数字牌 1-10 的牌义微调词 */
const NUMBER_THEME = {
  1: '萌发',
  2: '抉择',
  3: '扩展',
  4: '稳固',
  5: '冲突',
  6: '和谐',
  7: '防御',
  8: '推进',
  9: '圆满前夕',
  10: '完成',
};

/** 宫廷牌元数据 */
const COURT_META = [
  { rank: '侍从', rankEn: 'Page', extra: { SPD: 0.04 }, theme: '学习 · 萌芽' },
  { rank: '骑士', rankEn: 'Knight', extra: { SPD: 0.08, TOL: 0.04 }, theme: '行动 · 进取' },
  { rank: '王后', rankEn: 'Queen', extra: { ENT: 0.06, VIS: 0.04 }, theme: '滋养 · 接纳' },
  { rank: '国王', rankEn: 'King', extra: { LEAD: 0.08, INF: 0.04 }, theme: '权威 · 统御' },
];

/** 合并权重 · 保留 3 位小数 */
function mergeWeights(...parts) {
  const out = {};
  for (const p of parts) {
    for (const [k, v] of Object.entries(p)) {
      out[k] = (out[k] ?? 0) + (v ?? 0);
    }
  }
  for (const k of Object.keys(out)) {
    out[k] = Math.round((out[k] ?? 0) * 1000) / 1000;
  }
  return out;
}

function buildMinorArcana() {
  const cards = [];
  let id = 22;

  for (const suit of Object.keys(SUIT_META)) {
    const meta = SUIT_META[suit];

    // Ace（1）· 纯粹能量，花色主维度加成
    cards.push({
      id: id++,
      name: `${suit}王牌`,
      nameEn: `Ace of ${meta.en}`,
      arcana: 'minor',
      element: meta.element,
      meaningUpright: `${meta.theme} · 萌发 · 纯粹契机`,
      meaningReversed: `${meta.theme} · 延误 · 能量受阻`,
      personaWeights: mergeWeights(meta.base, { LEAD: 0.04 }),
    });

    // 2-10 数字牌
    for (let n = 2; n <= 10; n++) {
      cards.push({
        id: id++,
        name: `${suit}${n}`,
        nameEn: `${n} of ${meta.en}`,
        arcana: 'minor',
        element: meta.element,
        meaningUpright: `${meta.theme} · ${NUMBER_THEME[n]}`,
        meaningReversed: `${meta.theme} · ${NUMBER_THEME[n]}之逆`,
        personaWeights: { ...meta.base },
      });
    }

    // 宫廷牌 4 张
    for (const c of COURT_META) {
      cards.push({
        id: id++,
        name: `${suit}${c.rank}`,
        nameEn: `${c.rankEn} of ${meta.en}`,
        arcana: 'minor',
        element: meta.element,
        meaningUpright: `${meta.theme} · ${c.theme}`,
        meaningReversed: `${meta.theme} · ${c.theme}之阴影`,
        personaWeights: mergeWeights(meta.base, c.extra),
      });
    }
  }

  return cards;
}

// ═════════════════════════════════════════════════════════
// 导出
// ═════════════════════════════════════════════════════════

export const TAROT_CARDS = [...MAJOR_ARCANA, ...buildMinorArcana()];

export function getTarotCardById(id) {
  return TAROT_CARDS.find((c) => c.id === id);
}

/** 随机抽 n 张不重复牌 · 含正逆位（种子随机便于测试回放） */
export function drawRandomTarot(n, seed) {
  const pool = [...TAROT_CARDS];
  let rng = seed ?? Date.now();
  const rand = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
  const drawn = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(rand() * pool.length);
    drawn.push(pool.splice(idx, 1)[0]);
  }
  return drawn;
}
