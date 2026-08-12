/**
 * 人物匹配增强字段库
 * ==================
 * 独立于基准人物库（benchmarkProfiles）的匹配增强层。
 * benchmarkProfiles 只保存纯人物数据；本文件为此处维护每位人物的 5 维匹配字段，
 * 供投资人/创业家搭配性匹配（加权欧几里得距离）使用。
 *
 * 用法：从 benchmarkProfiles 取人物基础档案，再经 enhanceWithMatch 合并本文件的匹配维度。
 */
import { getProfilesByType, ALL_PROFILES } from './benchmarkProfiles';

// 每位人物的匹配维度（投资人按既有匹配引擎值迁移，创业家按档案推断）
export const MATCH_EXTRA = {
  // ---- 投资人 ----
  buffett:  { executionDiscipline: 95, reflectionDeviation: 85, aimPrecision: 90, kellyDeviation: -0.3, storyPreference: 'cigar' },
  munger:   { executionDiscipline: 88, reflectionDeviation: 80, aimPrecision: 85, kellyDeviation: -0.2, storyPreference: 'both' },
  sorros:   { executionDiscipline: 60, reflectionDeviation: 40, aimPrecision: 55, kellyDeviation: 0.5,  storyPreference: 'firework' },
  dalio:    { executionDiscipline: 90, reflectionDeviation: 75, aimPrecision: 80, kellyDeviation: 0,    storyPreference: 'both' },
  lynch:    { executionDiscipline: 70, reflectionDeviation: 55, aimPrecision: 65, kellyDeviation: 0.2,  storyPreference: 'firework' },
  son:      { executionDiscipline: 55, reflectionDeviation: 30, aimPrecision: 40, kellyDeviation: 0.7,  storyPreference: 'firework' },
  graham:   { executionDiscipline: 92, reflectionDeviation: 88, aimPrecision: 92, kellyDeviation: -0.4, storyPreference: 'cigar' },
  paulson:  { executionDiscipline: 75, reflectionDeviation: 50, aimPrecision: 70, kellyDeviation: 0.4,  storyPreference: 'both' },
  icahn:    { executionDiscipline: 65, reflectionDeviation: 35, aimPrecision: 45, kellyDeviation: 0.6,  storyPreference: 'firework' },
  templeton:{ executionDiscipline: 85, reflectionDeviation: 90, aimPrecision: 88, kellyDeviation: -0.1, storyPreference: 'cigar' },
  // ---- 创业家 ----
  jobs:     { executionDiscipline: 90, reflectionDeviation: 60, aimPrecision: 55, kellyDeviation: 0.3,  storyPreference: 'firework' },
  musk:     { executionDiscipline: 85, reflectionDeviation: 50, aimPrecision: 60, kellyDeviation: 0.6,  storyPreference: 'firework' },
  bezos:    { executionDiscipline: 90, reflectionDeviation: 85, aimPrecision: 88, kellyDeviation: 0.1,  storyPreference: 'cigar' },
  ma:       { executionDiscipline: 70, reflectionDeviation: 55, aimPrecision: 50, kellyDeviation: 0.2,  storyPreference: 'both' },
  ponyo:    { executionDiscipline: 85, reflectionDeviation: 70, aimPrecision: 75, kellyDeviation: 0,    storyPreference: 'cigar' },
  zhang:    { executionDiscipline: 88, reflectionDeviation: 85, aimPrecision: 85, kellyDeviation: 0.2,  storyPreference: 'both' },
  lei:      { executionDiscipline: 90, reflectionDeviation: 65, aimPrecision: 70, kellyDeviation: 0.1,  storyPreference: 'both' },
  huang:    { executionDiscipline: 75, reflectionDeviation: 70, aimPrecision: 70, kellyDeviation: 0.2,  storyPreference: 'both' },
  wang:     { executionDiscipline: 85, reflectionDeviation: 88, aimPrecision: 80, kellyDeviation: 0.1,  storyPreference: 'cigar' },
  li:       { executionDiscipline: 92, reflectionDeviation: 60, aimPrecision: 65, kellyDeviation: 0.2,  storyPreference: 'firework' },
};

/**
 * 合并匹配增强字段到人物档案，返回带 5 维匹配值的完整人物
 */
export function enhanceWithMatch(profile) {
  if (!profile) return profile;
  const extra = MATCH_EXTRA[profile.id];
  return extra ? { ...profile, ...extra } : profile;
}

/**
 * 获取带 5 维匹配字段的人物列表
 * @param {'investor'|'entrepreneur'|undefined} type 人物类型，不传则返回全部
 */
export function getMatchProfiles(type) {
  const list = type ? getProfilesByType(type) : ALL_PROFILES;
  return list.map(enhanceWithMatch);
}