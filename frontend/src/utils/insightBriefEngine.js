/**
 * 人格洞察简报生成器 · InsightBrief
 * 基于认知画圈、六维向量、塔罗、音乐画像自动生成文本洞察
 */

const DIM_LABELS = {
  risk: '风险承受',
  speed: '决策速度',
  grit: '抗压韧性',
  social: '社交倾向',
  emotionStability: '情绪稳定',
  openness: '探索开放',
};

const DIM_THRESHOLDS = {
  risk: { high: '高风险偏好', low: '保守稳健', mid: '平衡型' },
  speed: { high: '快速决策', low: '深思熟虑', mid: '稳健节奏' },
  grit: { high: '高韧性', low: '需强化韧性', mid: '中等韧性' },
  social: { high: '社交活跃', low: '内省倾向', mid: '平衡社交' },
  emotionStability: { high: '情绪稳定', low: '情绪波动', mid: '中等稳定' },
  openness: { high: '高度开放', low: '稳健保守', mid: '适度开放' },
};

const TAROT_INFLUENCE = {
  '愚者': { risk: 0.15, openness: 0.2, speed: 0.1, icon: '🎴', tip: '今日适合尝试新事物' },
  '魔术师': { risk: 0.1, speed: 0.15, openness: 0.1, icon: '🎩', tip: '发挥你的创造力' },
  '女祭司': { emotionStability: 0.15, grit: 0.1, social: -0.1, icon: '🌙', tip: '倾听内心声音' },
  '皇后': { social: 0.15, openness: 0.1, emotionStability: 0.05, icon: '👑', tip: '滋养身边的人' },
  '皇帝': { risk: 0.1, grit: 0.15, speed: 0.05, icon: '⚔️', tip: '展现领导才能' },
  '战车': { grit: 0.2, speed: 0.1, risk: 0.05, icon: '🏛️', tip: '果断推进目标' },
  '力量': { emotionStability: 0.2, grit: 0.1, icon: '🦁', tip: '以柔克刚' },
  '隐士': { social: -0.15, openness: 0.1, emotionStability: 0.1, icon: '🕯️', tip: '内省时刻' },
  '命运之轮': { risk: 0.1, openness: 0.15, icon: '🎡', tip: '拥抱变化' },
  '正义': { emotionStability: 0.15, grit: 0.1, icon: '⚖️', tip: '公正决策' },
  '倒吊人': { speed: -0.15, grit: 0.1, emotionStability: 0.1, icon: '🙃', tip: '换个角度看问题' },
  '死神': { grit: 0.15, risk: -0.1, icon: '💀', tip: '结束是新的开始' },
  '节制': { emotionStability: 0.2, risk: -0.05, icon: '🕊️', tip: '平衡是关键' },
  '恶魔': { risk: 0.2, speed: 0.1, icon: '😈', tip: '警惕诱惑' },
  '塔': { risk: 0.15, social: -0.1, icon: '🗼', tip: '迎接突变' },
  '星星': { openness: 0.2, emotionStability: 0.15, icon: '⭐', tip: '保持希望' },
  '月亮': { emotionStability: -0.15, openness: 0.1, icon: '🌕', tip: '关注潜意识' },
  '太阳': { social: 0.2, emotionStability: 0.2, icon: '☀️', tip: '尽情绽放' },
  '审判': { grit: 0.15, emotionStability: 0.1, icon: '📯', tip: '重新评估目标' },
  '世界': { openness: 0.2, social: 0.15, icon: '🌍', tip: '圆满完成' },
};

/**
 * 基于六维向量生成人格类型标签
 */
export function classifyPersona(dims) {
  if (!dims) return { type: '探索者', traits: [], archetype: '' };

  const scores = Object.entries(dims)
    .filter(([k]) => DIM_LABELS[k])
    .map(([k, v]) => ({ key: k, val: v }));

  const sorted = [...scores].sort((a, b) => b.val - a.val);
  const top3 = sorted.slice(0, 3);
  const bottom2 = sorted.slice(-2);

  const traits = top3.map((t) => {
    const label = DIM_LABELS[t.key];
    const level = t.val > 0.7 ? '高' : t.val > 0.4 ? '中' : '低';
    return `${level}${label}`;
  });

  const archetypes = [
    { type: '冒险家', cond: (d) => d.risk > 0.7 && d.openness > 0.6 },
    { type: '策略家', cond: (d) => d.grit > 0.7 && d.emotionStability > 0.6 && d.risk < 0.6 },
    { type: '社交家', cond: (d) => d.social > 0.7 && d.openness > 0.5 },
    { type: '思想家', cond: (d) => d.emotionStability > 0.7 && d.social < 0.4 },
    { type: '行动派', cond: (d) => d.speed > 0.7 && d.risk > 0.5 },
    { type: '守护者', cond: (d) => d.grit > 0.7 && d.emotionStability > 0.6 },
    { type: '艺术家', cond: (d) => d.openness > 0.7 && d.emotionStability < 0.6 },
  ];

  let archetype = '探索者';
  for (const a of archetypes) {
    if (a.cond(dims)) {
      archetype = a.type;
      break;
    }
  }

  return {
    type: archetype,
    traits,
    top: top3,
    bottom: bottom2,
  };
}

/**
 * 基于认知画圈生成洞察
 */
export function generateInsights(circle, dims, tarotToday, musicProfile) {
  const insights = {
    summary: '',
    strengths: [],
    risks: [],
    suggestions: [],
    todayFocus: '',
    archetype: '',
    tarotInfluence: null,
    musicAlignment: null,
  };

  // 1. 人格原型
  const persona = classifyPersona(dims);
  insights.archetype = persona.type;

  // 2. 优势分析（前3维度）
  persona.top.forEach((t) => {
    if (t.val > 0.6) {
      insights.strengths.push({
        dim: DIM_LABELS[t.key],
        level: Math.round(t.val * 100),
        label: t.val > 0.7 ? '显著优势' : '稳定优势',
      });
    }
  });

  // 3. 风险提示（后2维度或内耗）
  persona.bottom.forEach((t) => {
    if (t.val < 0.35) {
      insights.risks.push({
        dim: DIM_LABELS[t.key],
        level: Math.round(t.val * 100),
        label: '待发展',
        suggestion: getSuggestionForDim(t.key, t.val),
      });
    }
  });

  // 认知画圈内耗
  if (circle?.layers?.harmony?.friction > 20) {
    insights.risks.push({
      dim: '认知内耗',
      level: circle.layers.harmony.friction,
      label: '内耗偏高',
      suggestion: '近期认知冲突较多，建议通过冥想或塔罗引导梳理',
    });
  }

  // 4. 塔罗影响
  if (tarotToday?.card) {
    const tarotName = tarotToday.card.name;
    const influence = TAROT_INFLUENCE[tarotName];
    if (influence) {
      insights.tarotInfluence = {
        name: tarotName,
        icon: influence.icon,
        tip: influence.tip,
        modifiers: Object.entries(influence)
          .filter(([k]) => DIM_LABELS[k])
          .map(([k, v]) => ({
            dim: DIM_LABELS[k],
            modifier: v > 0 ? `+${Math.round(v * 100)}%` : `${Math.round(v * 100)}%`,
            direction: v > 0 ? 'boost' : 'suppress',
          })),
      };
      // 塔罗叠加到风险/建议
      Object.entries(influence).forEach(([k, v]) => {
        if (DIM_LABELS[k] && v < -0.1) {
          insights.risks.push({
            dim: DIM_LABELS[k],
            level: Math.round((dims[k] || 0.5) * 100),
            label: `塔罗抑制：${tarotName}`,
            suggestion: influence.tip,
          });
        }
      });
    }
  }

  // 5. 音乐画像对齐
  if (musicProfile) {
    const behaviors = musicProfile.behaviorVector || {};
    const musicLabels = [];
    if (behaviors.riskTolerance > 0.6) musicLabels.push('音乐偏好高风险');
    if (behaviors.decisionSpeed > 0.6) musicLabels.push('音乐偏好快节奏');
    if (behaviors.emotionalStability > 0.6) musicLabels.push('音乐偏好情绪稳定');
    if (musicLabels.length > 0) {
      insights.musicAlignment = {
        genres: musicProfile.genreDistribution
          ? Object.entries(musicProfile.genreDistribution)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([k]) => k)
          : [],
        behaviors: musicLabels,
        aligned: true,
      };
    }
  }

  // 6. 今日焦点
  if (insights.tarotInfluence) {
    insights.todayFocus = `${insights.tarotInfluence.tip}（${insights.tarotInfluence.name}正影响）`;
  } else if (insights.strengths.length > 0) {
    insights.todayFocus = `发挥 ${insights.strengths[0].dim} 优势，推进今日目标`;
  } else if (insights.risks.length > 0) {
    insights.todayFocus = `关注 ${insights.risks[0].dim} 维度，避免内耗`;
  }

  // 7. 行动建议
  insights.suggestions = buildSuggestions(persona, insights.tarotInfluence, circle);

  // 8. 摘要
  insights.summary = `你是一位${persona.type}型人格，在${insights.strengths.map((s) => s.dim).join('、') || '核心维度'}方面表现突出。今日焦点：${insights.todayFocus}。`;

  return insights;
}

function getSuggestionForDim(dim, val) {
  const suggestions = {
    risk: val < 0.3 ? '可适度尝试超出舒适区的决策' : '注意风险管理，避免过度保守',
    speed: val < 0.3 ? '放慢决策节奏，深思熟虑后行动' : '适当放慢速度，提升决策质量',
    grit: val < 0.3 ? '将大目标拆解为小里程碑，逐步推进' : '保持韧性，注意劳逸结合',
    social: val < 0.3 ? '主动与信任的人交流，获取外部视角' : '适度社交，保持独立思考',
    emotionStability: val < 0.3 ? '建立情绪觉察习惯，写日记或冥想' : '情绪管理良好，可帮助他人',
    openness: val < 0.3 ? '尝试新的思维方式，阅读跨领域书籍' : '保持开放心态，聚焦深度探索',
  };
  return suggestions[dim] || '持续关注该维度的发展';
}

function buildSuggestions(persona, tarot, circle) {
  const suggestions = [];

  // 基于塔罗
  if (tarot?.tip) {
    suggestions.push({
      icon: tarot.icon,
      text: tarot.tip,
      type: 'tarot',
    });
  }

  // 基于优势
  if (persona.top?.length > 0) {
    const top = persona.top[0];
    suggestions.push({
      icon: '💪',
      text: `用 ${DIM_LABELS[top.key]} 维度的优势，处理当前最具挑战性的任务`,
      type: 'strength',
    });
  }

  // 基于内耗
  if (circle?.layers?.harmony?.friction > 15) {
    suggestions.push({
      icon: '🧘',
      text: `认知内耗 ${circle.layers.harmony.friction}%，建议花 10 分钟整理思路或冥想`,
      type: 'warning',
    });
  }

  // 基于薄弱维度
  if (persona.bottom?.length > 0 && persona.bottom[0].val < 0.4) {
    const weak = persona.bottom[0];
    suggestions.push({
      icon: '🎯',
      text: `重点发展 ${DIM_LABELS[weak.key]} 维度：${getSuggestionForDim(weak.key, weak.val)}`,
      type: 'development',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      icon: '✨',
      text: '当前各维度发展均衡，保持现有节奏，持续探索新的可能性',
      type: 'balanced',
    });
  }

  return suggestions;
}
