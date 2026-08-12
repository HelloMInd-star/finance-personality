/**
 * 陪练记录 API 服务
 * 调用后端 /api/coach/* 接口
 */
import { apiClient } from './apiClient';
import { logger } from './logger';
import { getCurrentUserId } from './userContext';

const USER_ID = getCurrentUserId();

/**
 * 获取会话列表（支持高级筛选和排序）
 */
export const fetchSessions = async (filters = {}) => {
  const done = logger.flow('陪练 API', 'fetchSessions()', filters);
  try {
    const params = {
      user_id: USER_ID,
      game_type: filters.gameType && filters.gameType !== 'all' ? filters.gameType : undefined,
      difficulty: filters.difficulty && filters.difficulty !== 'all' ? filters.difficulty : undefined,
      search: filters.search || undefined,
      start_time: filters.startTime || undefined,
      end_time: filters.endTime || undefined,
      min_win_rate: filters.minWinRate,
      max_win_rate: filters.maxWinRate,
      min_chips: filters.minChips,
      max_chips: filters.maxChips,
      min_hands: filters.minHands,
      max_hands: filters.maxHands,
      mood_before: filters.moodBefore?.join(',') || undefined,
      mood_after: filters.moodAfter?.join(',') || undefined,
      tags: filters.tags?.join(',') || undefined,
      sort_by: filters.sortBy || 'start_time',
      sort_order: filters.sortOrder || 'desc',
    };
    const data = await apiClient.get('/coach/sessions', params);
    done(`返回 ${data?.length || 0} 条`);
    return data || [];
  } catch (e) {
    done('失败: ' + e.message);
    throw e;
  }
};

/**
 * 获取单个会话详情（含消息）
 */
export const fetchSession = async (sessionId) => {
  const done = logger.flow('陪练 API', `fetchSession(${sessionId})`);
  try {
    const data = await apiClient.get(`/coach/sessions/${sessionId}`);
    done(`消息数: ${data?.messages?.length || 0}`);
    return data;
  } catch (e) {
    done('失败: ' + e.message);
    throw e;
  }
};

/**
 * 创建会话
 */
export const createSession = async (sessionData) => {
  const done = logger.flow('陪练 API', `createSession()`, { id: sessionData.id });
  try {
    const data = await apiClient.post('/coach/sessions', sessionData);
    done('创建成功');
    return data;
  } catch (e) {
    done('失败: ' + e.message);
    throw e;
  }
};

/**
 * 删除会话
 */
export const deleteSession = async (sessionId) => {
  const done = logger.flow('陪练 API', `deleteSession(${sessionId})`);
  try {
    await apiClient.delete(`/coach/sessions/${sessionId}`);
    done('删除成功');
    return true;
  } catch (e) {
    done('失败: ' + e.message);
    throw e;
  }
};

/**
 * 获取统计数据
 */
export const fetchStats = async (filters = {}) => {
  const done = logger.flow('陪练 API', 'fetchStats()', filters);
  try {
    const params = {
      user_id: USER_ID,
      game_type: filters.gameType && filters.gameType !== 'all' ? filters.gameType : undefined,
      difficulty: filters.difficulty && filters.difficulty !== 'all' ? filters.difficulty : undefined,
    };
    const data = await apiClient.get('/coach/stats', params);
    done(`会话: ${data?.total_sessions || 0}, 手数: ${data?.total_hands || 0}`);
    return data;
  } catch (e) {
    done('失败: ' + e.message);
    throw e;
  }
};

export const coachApi = {
  fetchSessions,
  fetchSession,
  createSession,
  deleteSession,
  fetchStats,
};

export default coachApi;
