/**
 * 数字格式化工具 · formatters
 * 统一金融/数值显示格式，避免各页面重复实现
 *
 * 设计原则：
 * 1. 大数值加千分位（1,234,567.89）
 * 2. 百分比统一小数位 + % 后缀
 * 3. 价格带货币符号
 * 4. NaN/null/undefined 统一显示为 -
 * 5. 支持紧凑格式（1.23万、4.56亿）
 */

/**
 * 安全数字检查
 */
const isFinite = (v) => typeof v === 'number' && !isNaN(v);

/**
 * 通用数字格式化
 * @param {number} v - 数值
 * @param {number} decimals - 小数位数，默认2
 * @returns {string}
 */
export const fmt = (v, decimals = 2) => {
  if (!isFinite(v)) return '-';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * 百分比格式化（输入为小数 0.15 → 15%）
 * @param {number} v - 小数或百分数
 * @param {number} decimals - 小数位数，默认2
 * @param {boolean} isRawPercent - 如果为 true，输入已是百分数（如 15 表示 15%）
 * @returns {string}
 */
export const fmtPct = (v, decimals = 2, isRawPercent = false) => {
  if (!isFinite(v)) return '-';
  const val = isRawPercent ? v : v * 100;
  const formatted = val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${formatted}%`;
};

/**
 * 带符号百分比格式化
 * @param {number} v - 小数值
 * @param {number} decimals - 小数位数
 * @returns {string}
 */
export const fmtSignedPct = (v, decimals = 2) => {
  if (!isFinite(v)) return '-';
  const val = v * 100;
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(decimals)}%`;
};

/**
 * 货币格式（带千分位 + 货币符号）
 * @param {number} v - 金额
 * @param {string} currency - 货币符号，默认 $
 * @param {number} decimals - 小数位数
 * @returns {string}
 */
export const fmtCurrency = (v, currency = '$', decimals = 2) => {
  if (!isFinite(v)) return '-';
  return `${currency}${fmt(v, decimals)}`;
};

/**
 * 紧凑格式（大数缩写：万/亿/K/M/B）
 * @param {number} v - 数值
 * @param {number} decimals - 小数位数
 * @returns {string}
 */
export const fmtCompact = (v, decimals = 1) => {
  if (!isFinite(v)) return '-';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';

  if (abs >= 100000000) {
    return `${sign}${(abs / 100000000).toFixed(decimals)}亿`;
  } else if (abs >= 10000) {
    return `${sign}${(abs / 10000).toFixed(decimals)}万`;
  } else if (abs >= 1000) {
    return `${sign}${(abs / 1000).toFixed(decimals)}K`;
  }
  return `${sign}${abs.toFixed(decimals)}`;
};

/**
 * 股票价格格式（2位小数 + 千分位）
 * @param {number} v - 价格
 * @returns {string}
 */
export const fmtPrice = (v) => {
  if (!isFinite(v)) return '-';
  return fmt(v, 2);
};

/**
 * 涨跌幅格式（带颜色标记所需的 sign）
 * @param {number} v - 小数形式涨跌幅
 * @returns {{ text: string, color: string }}
 */
export const fmtChange = (v) => {
  if (!isFinite(v)) return { text: '-', color: '#ffffff' };
  const val = v * 100;
  const sign = val > 0 ? '+' : '';
  return {
    text: `${sign}${val.toFixed(2)}%`,
    color: val > 0 ? '#10b981' : val < 0 ? '#ef4444' : '#ffffff',
  };
};

/**
 * 偏差率格式（用于表格展示）
 * @param {number} v - 偏差值（百分数）
 * @returns {{ text: string, level: 'green'|'yellow'|'red' }}
 */
export const fmtDeviation = (v) => {
  if (!isFinite(v)) return { text: '-', level: 'red' };
  const abs = Math.abs(v);
  let level = 'green';
  if (abs > 5) level = 'red';
  else if (abs > 2) level = 'yellow';
  return {
    text: `${v.toFixed(2)}%`,
    level,
  };
};

/**
 * 安全数字获取（带默认值）
 * @param {*} v - 输入值
 * @param {number} defaultValue - 默认值
 * @returns {number}
 */
export const safeNum = (v, defaultValue = 0) => {
  return isFinite(v) ? v : defaultValue;
};

/**
 * 百分比输入转小数（15% → 0.15）
 * @param {number|string} v - 可以是 "15%" 或 0.15
 * @returns {number}
 */
export const parsePct = (v) => {
  if (typeof v === 'string') {
    const num = parseFloat(v.replace('%', ''));
    return isFinite(num) ? num / 100 : 0;
  }
  return isFinite(v) ? v : 0;
};
