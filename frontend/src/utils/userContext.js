/**
 * 用户上下文工具
 * 统一管理当前用户 ID，替代散落在各文件中的 demo_user 硬编码
 *
 * 优先级：
 * 1. localStorage 'user_id'（登录后设置）
 * 2. storage.user.id（如有）
 * 3. 'demo_user'（开发兜底）
 */
import { storage } from './storage';
import { logger } from './logger';

const USER_ID_KEY = 'user_id';

/**
 * 获取当前用户 ID
 * @returns {string}
 */
export function getCurrentUserId() {
  try {
    // 优先从 localStorage 直接读取
    const direct = localStorage.getItem(USER_ID_KEY);
    if (direct) return direct;

    // 其次从 storage.user 读取
    const user = storage.get('user');
    if (user && user.id) return user.id;

    // 开发兜底
    return 'demo_user';
  } catch (_) {
    return 'demo_user';
  }
}

/**
 * 设置当前用户 ID（登录成功后调用）
 * @param {string} id
 */
export function setCurrentUserId(id) {
  if (!id) return;
  try {
    localStorage.setItem(USER_ID_KEY, id);
    logger.info(`[UserContext] 用户 ID 已设置: ${id}`);
  } catch (e) {
    logger.error('[UserContext] 设置用户 ID 失败', e);
  }
}

/**
 * 清除用户 ID（登出时调用）
 */
export function clearCurrentUserId() {
  try {
    localStorage.removeItem(USER_ID_KEY);
    logger.info('[UserContext] 用户 ID 已清除');
  } catch (_) {}
}
