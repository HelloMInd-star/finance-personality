/**
 * MBTI 企业家酒局引擎
 * 选酒 → 认知风格 → 时间偏好 → 对话风格 → 人格匹配 → 报告生成
 */

import {
  SPIRITS,
  DRINK_STYLES,
  CIGAR_OPTIONS,
  TOPICS,
  PARTY_ROLES,
} from './partyData.js';
import { MOLECULES, PERSONA_KEYS } from '../MoleculeViewer/moleculeData.js';
import { getPartyChakraInsight } from '../ChakraTest/chakraEngine.js';

/**
 * 获取随机话题
 */
export function getRandomTopic() {
  const idx = Math.floor(Math.random() * TOPICS.length);
  return TOPICS[idx];
}

/**
 * 根据用户选择匹配企业家人格
 * @param {string} spiritKey - 基酒 key
 * @param {string} drinkStyleKey - 饮用方式 key
 * @param {string} cigarKey - 雪茄选择 key
 * @param {string} topicId - 话题 id
 * @param {string} choice - 选项 key (A/B/C/D)
 * @returns {{ spirit: Object, persona: Object, matchPercent: number, dialogueStyle: string, role: Object, topic: Object, option: Object, drinkStyle: Object, cigar: Object }}
 */
export function matchPartyPersona(spiritKey, drinkStyleKey, cigarKey, topicId, choice) {
  const spirit = SPIRITS.find((s) => s.key === spiritKey) || SPIRITS[0];
  const drinkStyle = DRINK_STYLES.find((d) => d.key === drinkStyleKey) || DRINK_STYLES[0];
  const cigar = CIGAR_OPTIONS.find((c) => c.key === cigarKey) || CIGAR_OPTIONS[0];
  const topic = TOPICS.find((t) => t.id === topicId) || TOPICS[0];
  const option = topic.options.find((o) => o.key === choice) || topic.options[0];

  // 基酒确定候选 MBTI 类型
  const candidateMbtiTypes = spirit.mbtiTypes;

  // 从人格分子中找到匹配的候选
  let candidates = PERSONA_KEYS
    .map((key) => MOLECULES[key])
    .filter((mol) => candidateMbtiTypes.includes(mol.relatedPersona));

  // 根据对话选择的 mbtiHint 进一步筛选
  const hinted = candidates.filter((mol) =>
    mol.relatedPersona.includes(option.mbtiHint)
  );
  if (hinted.length > 0) {
    candidates = hinted;
  }

  // 根据饮用方式和雪茄进一步偏好排序
  const scored = candidates.map((mol) => {
    let score = 0;
    // 纯饮偏好 J 型人格
    if (drinkStyleKey === 'neat' && mol.relatedPersona.includes('J')) score += 1;
    // 调酒偏好 P 型人格
    if (drinkStyleKey === 'cocktail' && mol.relatedPersona.includes('P')) score += 1;
    // 选雪茄偏好 N 型人格(长期主义)
    if (cigarKey === 'yes' && mol.relatedPersona.includes('N')) score += 1;
    // 不选雪茄偏好 S 型人格(实用主义)
    if (cigarKey === 'no' && mol.relatedPersona.includes('S')) score += 1;
    return { mol, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const matchedEntry = scored[0] || { mol: candidates[0] || MOLECULES.intj_musk, score: 0 };
  const matched = matchedEntry.mol;

  // 反查 moleculeKey (用于 MoleculeViewer 渲染)
  const moleculeKey = PERSONA_KEYS.find((k) => MOLECULES[k] === matched) || 'intj_musk';

  // 匹配度:基础 70 + 对话匹配 15 + 偏好匹配 15
  const matchPercent = Math.min(99, 70 + (option.mbtiHint ? 15 : 0) + Math.min(matchedEntry.score, 1) * 15);

  // 确定酒局角色
  const role = determineRole(drinkStyleKey, cigarKey, option);

  return {
    spirit,
    drinkStyle,
    cigar,
    persona: matched,
    moleculeKey,
    matchPercent,
    dialogueStyle: spirit.dialogueStyle,
    catchphrase: spirit.catchphrase,
    role,
    topic,
    option,
  };
}

/**
 * 确定用户在酒局中的角色
 */
function determineRole(drinkStyleKey, cigarKey, option) {
  // 反问式/挑战式 → 挑战者
  if (option.style.includes('反问') || option.style.includes('挑战')) {
    return PARTY_ROLES.challenger;
  }
  // 共情式 → 连接者
  if (option.style.includes('共情') || option.style.includes('叙事')) {
    return PARTY_ROLES.connector;
  }
  // 纯饮 + 选雪茄 → 观察者
  if (drinkStyleKey === 'neat' && cigarKey === 'yes') {
    return PARTY_ROLES.observer;
  }
  // 调酒 + 不选雪茄 → 发起者
  if (drinkStyleKey === 'cocktail' && cigarKey === 'no') {
    return PARTY_ROLES.initiator;
  }
  // 默认观察者
  return PARTY_ROLES.observer;
}

/**
 * 生成对话场景文本
 */
export function generateDialogueScene(spiritKey, topic) {
  const spirit = SPIRITS.find((s) => s.key === spiritKey) || SPIRITS[0];
  return `你端起那杯${spirit.name}，走向吧台。你身边的几位企业家正在讨论——${topic.question}。你想说什么？`;
}

/**
 * 生成酒局报告
 */
export function generateReport(result) {
  const {
    spirit, drinkStyle, cigar, persona, moleculeKey,
    matchPercent, dialogueStyle, role, topic, option,
  } = result;

  // 脉轮状态联动:作为酒局报告的辅助分析
  // - 最强脉轮 → 酒局表现亮点
  // - 最弱脉轮 → 调酒配方修正风味
  const chakraInsight = getPartyChakraInsight();

  return {
    spiritName: spirit.name,
    spiritIcon: spirit.icon,
    personaType: persona.relatedPersona,
    personaName: persona.relatedPerson,
    matchPercent,
    dialogueStyle,
    catchphrase: spirit.catchphrase,
    cognitiveStyle: drinkStyle.cognitiveStyle,
    timePreference: cigar.timePreference,
    roleName: role.name,
    roleDesc: role.desc,
    topicQuestion: topic.question,
    userResponse: option.text,
    responseStyle: option.style,
    traits: spirit.traits,
    // 分子数据 (用于 3D 渲染和配方展示)
    moleculeKey,
    molecule: {
      name: persona.name,
      formula: persona.formula,
      desc: persona.desc,
      flavor: persona.flavor,
      spirit: persona.relatedSpirit,
      temperature: persona.temperature,
      presentation: persona.presentation,
    },
    // 脉轮联动洞察(可能为 null,表示用户尚未完成脉轮测试)
    chakraInsight,
  };
}

/**
 * 将酒局数据写入用户画像(localStorage)
 */
export function saveToUserProfile(result) {
  try {
    const profile = JSON.parse(localStorage.getItem('userState') || '{}');
    if (!profile.partyHistory) profile.partyHistory = [];
    profile.partyHistory.push({
      spirit: result.spirit.key,
      drinkStyle: result.drinkStyle.key,
      cigar: result.cigar.key,
      persona: result.persona.relatedPersona,
      role: result.role.key,
      timestamp: Date.now(),
    });
    // 更新用户画像的感官偏好和认知风格
    profile.sensoryPreference = result.spirit.name;
    profile.cognitiveStyle = result.drinkStyle.cognitiveStyle;
    profile.timePreference = result.cigar.timePreference;
    profile.socialStyle = result.role.name;
    localStorage.setItem('userState', JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
