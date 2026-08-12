/**
 * DNA 历史记录存储
 * localStorage 持久化 + CRUD
 */
import { logger } from './logger';

const STORAGE_KEY = 'dna_history';

const readAll = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    logger.error('[DNA历史] 读取失败', e.message);
    return [];
  }
};

const writeAll = (records) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    logger.error('[DNA历史] 写入失败', e.message);
  }
};

// 生成唯一 ID
const genId = () => `dna_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// 格式化日期
export const formatDate = (timestamp) => {
  const d = new Date(timestamp);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// 模式中文
export const MODE_LABEL = {
  quick: '快速测试',
  staircase: '人格爬楼梯',
};

/**
 * DNA 历史记录 API
 */
export const dnaHistory = {
  /**
   * 保存一条新记录
   * @param {Object} report - analyzeInvestorDNA 返回的报告
   * @param {string} mode - 'quick' | 'staircase'
   * @param {Object} meta - 附加元信息（如答题选项等）
   * @returns {Object} - 保存后的完整记录
   */
  save(report, mode = 'quick', meta = {}) {
    const record = {
      id: genId(),
      createdAt: Date.now(),
      mode,
      meta,
      // 精简存储：只保留核心数据
      userDNA: report.userDNA,
      winner: {
        id: report.winner.master.id,
        name: report.winner.master.name,
        mbti: report.winner.master.mbti,
        similarity: report.winner.similarity,
        coreTags: report.winner.master.coreTags,
        quote: report.winner.master.quote,
      },
      top3: report.top3.map((t) => ({
        id: t.master.id,
        name: t.master.name,
        mbti: t.master.mbti,
        similarity: t.similarity,
      })),
      purpleGroup: {
        isPurple: report.purpleGroup.isPurple,
        purpleCount: report.purpleGroup.purpleCount,
        purpleTypes: report.purpleGroup.purpleTypes,
      },
    };

    const all = readAll();
    all.unshift(record); // 最新的在前面
    writeAll(all);

    logger.session('[DNA历史] 保存记录', { id: record.id, mode, winner: record.winner.name });
    return record;
  },

  /**
   * 获取所有记录（按时间倒序）
   */
  list() {
    const all = readAll();
    logger.session('[DNA历史] 读取列表', `${all.length}条`);
    return all;
  },

  /**
   * 获取单条记录详情
   */
  get(id) {
    const all = readAll();
    const record = all.find((r) => r.id === id);
    logger.session('[DNA历史] 获取详情', id);
    return record || null;
  },

  /**
   * 删除一条记录
   */
  remove(id) {
    const all = readAll();
    const filtered = all.filter((r) => r.id !== id);
    writeAll(filtered);
    logger.session('[DNA历史] 删除记录', id);
    return filtered;
  },

  /**
   * 清空所有记录
   */
  clear() {
    writeAll([]);
    logger.session('[DNA历史] 清空所有记录');
  },

  /**
   * 对比多条记录的染色体变化
   * @param {string[]} ids - 要对比的记录 ID 数组
   */
  compare(ids) {
    const all = readAll();
    const records = ids.map((id) => all.find((r) => r.id === id)).filter(Boolean);

    if (records.length < 2) {
      return null;
    }

    // 按时间排序
    records.sort((a, b) => a.createdAt - b.createdAt);

    // 计算染色体变化
    const dims = ['risk', 'time', 'style', 'model'];
    const changes = {};

    for (const dim of dims) {
      const values = records.map((r) => r.userDNA[dim]);
      changes[dim] = {
        values,
        delta: values[values.length - 1] - values[0],
        trend: values[values.length - 1] > values[0] ? 'up' : values[values.length - 1] < values[0] ? 'down' : 'flat',
      };
    }

    // MBTI 变化
    const mbtiChanges = records.map((r) => r.userDNA.mbti);

    // 最像的人变化
    const winnerChanges = records.map((r) => r.winner.name);

    logger.session('[DNA历史] 对比记录', `${records.length}条`);

    return {
      records,
      chromosomeChanges: changes,
      mbtiChanges,
      winnerChanges,
    };
  },
};

export default dnaHistory;
