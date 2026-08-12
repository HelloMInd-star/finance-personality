/**
 * 调酒 API 服务
 * 调用后端 /api/bartender/* 接口
 */
import { apiClient } from './apiClient';
import { logger } from './logger';
import { getCurrentUserId } from './userContext';

const USER_ID = getCurrentUserId();

/**
 * 获取调酒会话列表
 */
export const fetchBartenderSessions = async (filters = {}) => {
  const done = logger.flow('调酒 API', 'fetchBartenderSessions()', filters);
  try {
    const params = {
      user_id: USER_ID,
      limit: filters.limit || 50,
      bartender: filters.bartender || undefined,
    };
    const data = await apiClient.get('/bartender/sessions', params);
    done(`返回 ${data?.length || 0} 条`);
    return data || [];
  } catch (e) {
    if (e.isNetworkError) {
      done('网络错误，跳过 API');
      return [];
    }
    done('失败: ' + e.message);
    throw e;
  }
};

/**
 * 获取单个调酒会话详情
 */
export const fetchBartenderSession = async (sessionId) => {
  const done = logger.flow('调酒 API', `fetchBartenderSession(${sessionId})`);
  try {
    const data = await apiClient.get(`/bartender/sessions/${sessionId}`);
    done(`配方: ${data?.cocktail?.name || 'N/A'}`);
    return data;
  } catch (e) {
    done('失败: ' + e.message);
    throw e;
  }
};

/**
 * 创建调酒会话
 */
export const createBartenderSession = async (sessionData) => {
  const done = logger.flow('调酒 API', `createBartenderSession()`, { bartender: sessionData.bartender });
  try {
    const body = {
      user_id: USER_ID,
      ...sessionData,
    };
    const data = await apiClient.post('/bartender/sessions', body);
    done(`创建成功: id=${data?.id}, 酒名=${data?.cocktail?.name}`);
    return data;
  } catch (e) {
    if (e.isNetworkError) {
      done('网络错误，跳过 API');
      return null;
    }
    done('失败: ' + e.message);
    throw e;
  }
};

/**
 * 更新调酒会话（挑战赛、沙盘结果、评分等）
 */
export const updateBartenderSession = async (sessionId, updateData) => {
  const done = logger.flow('调酒 API', `updateBartenderSession(${sessionId})`, Object.keys(updateData));
  try {
    const data = await apiClient.put(`/bartender/sessions/${sessionId}`, updateData);
    done('更新成功');
    return data;
  } catch (e) {
    if (e.isNetworkError) {
      done('网络错误，跳过 API');
      return null;
    }
    done('失败: ' + e.message);
    throw e;
  }
};

/**
 * 删除调酒会话
 */
export const deleteBartenderSession = async (sessionId) => {
  const done = logger.flow('调酒 API', `deleteBartenderSession(${sessionId})`);
  try {
    await apiClient.delete(`/bartender/sessions/${sessionId}`);
    done('删除成功');
    return true;
  } catch (e) {
    done('失败: ' + e.message);
    throw e;
  }
};

/**
 * 获取调酒统计数据
 */
export const fetchBartenderStats = async () => {
  const done = logger.flow('调酒 API', 'fetchBartenderStats()');
  try {
    const params = { user_id: USER_ID };
    const data = await apiClient.get('/bartender/stats', params);
    done(`会话: ${data?.total_sessions || 0}`);
    return data;
  } catch (e) {
    if (e.isNetworkError) {
      done('网络错误，跳过 API');
      return {
        total_sessions: 0,
        bartender_count: {},
        emotion_count: {},
        base_spirit_count: {},
        avg_challenge_score: 0,
        mbti_distribution: {},
        recent_sessions: [],
      };
    }
    done('失败: ' + e.message);
    throw e;
  }
};

export const bartenderApi = {
  fetchBartenderSessions,
  fetchBartenderSession,
  createBartenderSession,
  updateBartenderSession,
  deleteBartenderSession,
  fetchBartenderStats,
};

export default bartenderApi;
