/**
 * 通用 API 客户端
 * 封装 fetch 请求，统一处理响应和错误
 * 支持：超时控制、网络错误自动重试、错误消息透传
 */
import { logger } from './logger';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
const DEFAULT_TIMEOUT = 15000; // 15s 超时
const MAX_RETRIES = 2; // 网络错误最多重试 2 次
const RETRY_DELAY = 800; // 重试间隔 ms

// 获取存储的 token
const getToken = () => {
  try {
    return localStorage.getItem('auth_token') || null;
  } catch (_) {
    return null;
  }
};

// 存储 token
export const setAuthToken = (token) => {
  try {
    if (token) {
      localStorage.setItem('auth_token', token);
      logger.info('Token 已保存');
    } else {
      localStorage.removeItem('auth_token');
      logger.info('Token 已清除');
    }
  } catch (e) {
    logger.error('Token 存储失败', e);
  }
};

/**
 * 带超时的 fetch
 */
const fetchWithTimeout = (url, config, timeout = DEFAULT_TIMEOUT) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...config, signal: controller.signal })
    .finally(() => clearTimeout(timer));
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 通用请求方法（带超时 + 重试）
 */
const request = async (url, options = {}) => {
  let fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const method = options.method || 'GET';
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const maxRetries = options.retry !== false ? MAX_RETRIES : 0;

  const token = getToken();
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  };

  if (options.body && method !== 'GET') {
    config.body = typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body);
  }

  if (options.params && method === 'GET') {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v);
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
    }
  }

  logger.info(`→ ${method} ${fullUrl}`);
  const startTime = Date.now();

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(fullUrl, config, timeout);
      const duration = Date.now() - startTime;

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errorMsg = errData.error || errData.detail || errorMsg;
        } catch (_) {}
        logger.error(`← ${method} ${fullUrl} ✗ (${duration}ms)`, errorMsg);
        const err = new Error(errorMsg);
        err.statusCode = response.status;
        throw err;
      }

      const data = await response.json();
      logger.info(`← ${method} ${fullUrl} ✓ (${duration}ms)`, { success: data.success });

      if (data.success === false) {
        throw new Error(data.error || '请求失败');
      }

      return data.data !== undefined ? data.data : data;
    } catch (e) {
      lastError = e;
      const duration = Date.now() - startTime;
      const isAbort = e.name === 'AbortError';
      const isNetwork = e.name === 'TypeError' || e.message?.includes('Failed to fetch');

      if (isAbort || isNetwork) {
        e.isNetworkError = true;
        if (attempt < maxRetries) {
          logger.info(`↻ 重试 ${attempt + 1}/${maxRetries} ${method} ${fullUrl}`);
          await sleep(RETRY_DELAY * (attempt + 1));
          continue;
        }
        logger.error(`← ${method} ${fullUrl} ✗ ${isAbort ? '超时' : '网络错误'} (${duration}ms)`, e.message);
      } else {
        // 非网络错误（如 4xx/5xx）不重试
        throw e;
      }
    }
  }

  throw lastError || new Error('请求失败');
};

export const apiClient = {
  get: (url, params) => request(url, { method: 'GET', params }),
  post: (url, body) => request(url, { method: 'POST', body }),
  put: (url, body) => request(url, { method: 'PUT', body }),
  delete: (url) => request(url, { method: 'DELETE' }),

  // 认证相关
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password }, retry: false }),
  register: (username, email, password) => request('/auth/register', { method: 'POST', body: { username, email, password }, retry: false }),
  getMe: () => request('/auth/me', { method: 'GET' }),

  // 培养方案相关
  getDevelopmentPlan: () => request('/development/plan', { method: 'GET' }),
  generateDevelopmentPlan: (input) => request('/development/plan/generate', { method: 'POST', body: input || {} }),
  getDevelopmentPlanHistory: (limit = 10) => request('/development/plan/history', { method: 'GET', params: { limit } }),

  // 行情 / 估值因子 / K 线（东方财富+腾讯 多源兜底）
  marketGetQuote: (symbol) => request('/market/quote', { method: 'GET', params: { symbol } }),
  marketGetKline: (symbol, days = 120) => request('/market/kline', { method: 'GET', params: { symbol, days } }),
  marketGetValuation: (symbol) => request('/market/valuation', { method: 'GET', params: { symbol } }),
  // 批量估值需多只标的 × 多数据源，超时放宽到 45s；慢但可靠，关闭自动重试避免叠加卡顿
  marketBatchValuation: (symbols = []) => request('/market/valuation/batch', { method: 'POST', body: { symbols }, timeout: 45000, retry: false }),
};

export default apiClient;
