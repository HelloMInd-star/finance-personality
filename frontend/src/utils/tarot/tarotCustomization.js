/**
 * 塔罗牌定制 · 元素派色 + deriveTarotCard 派生函数
 *
 * 用于 GalaxyConstellation 揭示卡片 · 由元素派生主色/强调色
 *
 * 从 Y.Mine 人格调酒系统迁移 · TS → JS（仅塔罗部分）
 */

import { getTarotCardById, TAROT_CARDS } from './tarotCards.js';

/** 塔罗元素 → 主色/强调色映射 · 呼应四元素气质 */
export const TAROT_ELEMENT_COLOR = {
  火: { primary: '#c4392f', accent: '#e87060' }, // 烈焰红
  水: { primary: '#5a9bbf', accent: '#9bd1e8' }, // 深海蓝
  风: { primary: '#9b7bd4', accent: '#c8a5e0' }, // 灵风紫
  土: { primary: '#8f5a3c', accent: '#c4856b' }, // 大地棕
};

/**
 * 由牌 id + 正逆位派生塔罗定制卡
 * @param {number} cardId
 * @param {boolean} [isReversed=false]
 */
export function deriveTarotCard(cardId, isReversed = false) {
  const card = getTarotCardById(cardId) ?? TAROT_CARDS[0];
  const colors = TAROT_ELEMENT_COLOR[card.element] ?? TAROT_ELEMENT_COLOR.风;
  return {
    cardId: card.id,
    name: card.name,
    nameEn: card.nameEn,
    arcana: card.arcana,
    element: card.element,
    isReversed,
    meaning: isReversed ? card.meaningReversed : card.meaningUpright,
    primary: colors.primary,
    accent: colors.accent,
    symbol: card.name.charAt(0),
    personaWeights: card.personaWeights,
  };
}

/** 大阿尔卡纳选项 · 用于选择器（22 张） */
export const TAROT_MAJOR_OPTIONS = TAROT_CARDS.filter((c) => c.arcana === 'major').map((c) => ({
  id: c.id,
  name: c.name,
  nameEn: c.nameEn,
  element: c.element,
}));
