/**
 * Y.Mine 行为决策沙盘 - 调试日志系统
 * 
 * 用法：
 *   import { logger } from '../utils/logger';
 *   logger.route('从首页跳到德州');
 *   logger.game('创建牌局', { difficulty: 'medium' });
 *   logger.storage('写入', 'userState', data);
 *   logger.session('选择故事', 'cigar');
 *   logger.error('出错了', error);
 * 
 * 浏览器控制台查看：
 *   筛选 "Y.Mine" 或按标签（[ROUTE]/[GAME]/[STORAGE]...）过滤
 */

const LOG_PREFIX = 'Y.Mine';
const LOG_COLORS = {
  route: '#22c55e',
  game: '#3b82f6',
  storage: '#f59e0b',
  session: '#a78bfa',
  ui: '#ec4899',
  error: '#ef4444',
  info: '#94a3b8',
};

const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').slice(0, 19) + '.' + String(now.getMilliseconds()).padStart(3, '0');
};

const formatArgs = (args) => {
  return args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
};

const createLogger = (type, level = 'log') => {
  const color = LOG_COLORS[type] || LOG_COLORS.info;
  return (...args) => {
    const timestamp = getTimestamp();
    const tag = `[${type.toUpperCase()}]`;
    const message = formatArgs(args);
    console[level](
      `%c${LOG_PREFIX}%c ${tag} %c${timestamp}%c ${message}`,
      `background: ${color}; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;`,
      `color: ${color}; font-weight: bold;`,
      'color: #64748b; font-size: 11px;',
      'color: inherit;'
    );
  };
};

export const logger = {
  route: createLogger('route'),
  game: createLogger('game'),
  storage: createLogger('storage'),
  session: createLogger('session'),
  ui: createLogger('ui'),
  error: createLogger('error', 'error'),
  info: createLogger('info', 'info'),

  /**
   * 记录一个带计时的流程节点
   * const done = logger.flow('调酒流程', '开始');
   * // ... 做一些事情
   * done('完成'); // 自动计算耗时
   */
  flow: (flowName, stepName, ...args) => {
    const startTime = Date.now();
    createLogger('session')(`[${flowName}] → ${stepName}`, ...args);
    return (endStepName, ...endArgs) => {
      const duration = Date.now() - startTime;
      createLogger('session')(`[${flowName}] ✓ ${endStepName} (${duration}ms)`, ...endArgs);
    };
  },

  /**
   * 记录一个函数调用的参数和返回值
   */
  wrap: (fnName, fn) => {
    return (...args) => {
      createLogger('info')(`→ ${fnName}()`, args.length > 0 ? args : '(无参数)');
      const start = Date.now();
      try {
        const result = fn(...args);
        const duration = Date.now() - start;
        if (result && typeof result.then === 'function') {
          return result.then(r => {
            createLogger('info')(`← ${fnName}() ✓ (${Date.now() - start}ms)`, r);
            return r;
          }).catch(e => {
            createLogger('error', 'error')(`✗ ${fnName}()`, e.message);
            throw e;
          });
        }
        createLogger('info')(`← ${fnName}() ✓ (${duration}ms)`, result);
        return result;
      } catch (e) {
        createLogger('error', 'error')(`✗ ${fnName}()`, e.message);
        throw e;
      }
    };
  },
};

export default logger;
