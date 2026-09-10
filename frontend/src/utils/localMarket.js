/* ============================================================
   localMarket.js · 前端本地行情引擎（零后端依赖）
   ------------------------------------------------------------
   背景：Railway 后端已下线，StockPage 实时行情原指向 /api/market/* 全部 404。
   方案：
   1) 实时报价：直连腾讯行情 qt.gtimg.cn（CORS 全开，GBK 编码需 TextDecoder）
   2) 财务锚点：内置 PRESET_ASSETS（30 标的）→ asset 字段对齐后端
   3) K线：腾讯 K 线接口被 WAF 拦截 → 本地种子随机游走生成（末价锚定实时价）
   接口形状与 apiClient.marketGetValuation / marketGetKline 完全一致，
   StockPage 无需感知数据源差异（可一键切回远端）。
   ============================================================ */
import { PRESET_ASSETS } from './quantEngine.js';

const TENCENT_QUOTE_URL = 'https://qt.gtimg.cn/q=';

export const MARKET_PROVIDER = '腾讯实时 · 本地引擎';
export const MARKET_PROVIDER_FALLBACK = '内置锚点 · 本地引擎';

// ---------- 通用工具 ----------
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function firstValid(...arr) {
  for (const v of arr) {
    const n = num(v);
    if (n > 0 && Number.isFinite(n)) return n;
  }
  return 0;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// mulberry32 种子随机（同输入可复现）
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- 代码规范化 ----------
// 输入：AAPL / 600519 / 600519.SH / sh600519 / 000001 / 300750.SZ / usAAPL
export function normalizeSymbol(raw) {
  let s = String(raw || '').trim().toUpperCase();
  if (!s) return null;
  let code = s;
  let market = null;

  // 交易所后缀 600519.SH / 000001.SZ / AAPL.US
  const suffixMatch = s.match(/^(.+?)\.(SH|SZ|BJ|US)$/);
  if (suffixMatch) {
    code = suffixMatch[1];
    market = suffixMatch[2] === 'US' ? 'US' : 'CN';
  }
  // 前缀 sh600519 / usAAPL
  const prefixMatch = code.match(/^(SH|SZ|BJ|US)(.+)$/);
  if (prefixMatch) {
    code = prefixMatch[2];
    market = prefixMatch[1] === 'US' ? 'US' : 'CN';
  }
  // A 股 6 位数字
  if (/^\d{6}$/.test(code)) {
    const head = code[0];
    if (head === '6') return { symbol: code, market: 'CN', tencentCode: `sh${code}`, code };
    if (head === '0' || head === '3') return { symbol: code, market: 'CN', tencentCode: `sz${code}`, code };
    if (head === '4' || head === '8') return { symbol: code, market: 'CN', tencentCode: `bj${code}`, code };
  }
  // 美股（字母，含 BRK.B 等）
  if (/^[A-Z][A-Z.]*$/.test(code)) {
    return { symbol: code, market: market || 'US', tencentCode: `us${code}`, code };
  }
  return { symbol: code, market: market || 'US', tencentCode: `us${code}`, code };
}

// ---------- 腾讯实时行情 ----------
export async function fetchTencentQuote(tencentCode) {
  const res = await fetch(`${TENCENT_QUOTE_URL}${tencentCode}`, { headers: { Accept: '*/*' } });
  if (!res.ok) throw new Error(`腾讯行情 HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  // 腾讯 A 股行情为 GBK 编码，美股为 UTF-8；统一用 gbk 解码对 ASCII 兼容
  const text = new TextDecoder('gbk').decode(buf);
  const m = text.match(/="([^"]*)"/);
  if (!m || !m[1]) throw new Error(`腾讯行情响应异常: ${tencentCode}`);
  const f = m[1].split('~');
  if (f.length < 40) throw new Error(`腾讯行情字段不足: ${tencentCode} (${f.length})`);

  const price = num(f[3]);
  const closePrev = num(f[4]);
  const open = num(f[5]) || price;
  const high = num(f[33]) || price;
  const low = num(f[34]) || price;
  const volume = num(f[6]); // A股：手；美股：股
  const amount = num(f[37]); // 万元
  const turnover = num(f[38]); // %
  const pe = num(f[39]);
  const pb = firstValid(f[46], f[43], f[44]); // 防御位序
  const mcap = firstValid(f[45], f[44], f[53]); // 亿元

  return {
    symbol: f[2] || tencentCode,
    name: f[1] || tencentCode,
    code: f[2] || tencentCode,
    price,
    close_prev: closePrev,
    open,
    high,
    low,
    volume,
    amount,
    turnover_rate: turnover,
    pe,
    pb,
    market_cap: mcap,
    change_pct: closePrev > 0 ? (price - closePrev) / closePrev : 0,
    provider: MARKET_PROVIDER,
    fetchedAt: Date.now(),
  };
}

// ---------- PRESET 锚点匹配 ----------
export function findPreset(ns) {
  if (!ns) return null;
  const code = ns.code;
  return PRESET_ASSETS.find((a) => String(a.ticker).toUpperCase() === code) || null;
}

// 腾讯失败时用锚点构造静态 quote（页面仍可运行）
export function makeFallbackQuote(ns, preset) {
  const price = preset?.basePrice || 100;
  return {
    symbol: ns.symbol,
    name: preset?.name || ns.code,
    code: ns.symbol,
    price,
    close_prev: price,
    open: price,
    high: price,
    low: price,
    volume: 0,
    amount: 0,
    turnover_rate: 0,
    pe: preset?.pe || 0,
    pb: preset?.pb || 0,
    market_cap: preset?.marketCap || 0,
    change_pct: 0,
    provider: MARKET_PROVIDER_FALLBACK,
    fetchedAt: Date.now(),
  };
}

// ---------- Factors 估算（对齐后端 get_valuation_factors） ----------
const INDUSTRY_CR = {
  白酒: 0.7, 银行: 0.55, 保险: 0.6, 券商: 0.5, 半导体: 0.65,
  互联网: 0.6, 电商: 0.55, '电商/云': 0.6, '电商/物流': 0.5, 能源: 0.45,
  新能源: 0.5, 新能源车: 0.55, 电池: 0.6, 有色矿业: 0.55, 公用事业: 0.6,
  科技: 0.5, 支付: 0.6, '社交/广告': 0.55, 流媒体: 0.5, 医药: 0.4,
  消费: 0.35, 零售: 0.4, 娱乐: 0.4, 多元金融: 0.5,
};

export function estimateFactors(asset, quote) {
  const price = quote.price || asset.basePrice || 100;
  const pe = quote.pe > 0 ? quote.pe : asset.pe > 0 ? asset.pe : 20;
  // intrinsicPrice = price * 20 / pe（后端同式）
  const intrinsicPrice = pe > 0 ? (price * 20) / pe : price * 0.9;

  // marketShare：市值分桶（后端 _share_by_mcap 近似）
  const mc = quote.market_cap > 0 ? quote.market_cap : asset.marketCap || 100;
  let marketShare = 0.03;
  if (mc > 2000) marketShare = 0.28;
  else if (mc > 1000) marketShare = 0.2;
  else if (mc > 500) marketShare = 0.14;
  else if (mc > 200) marketShare = 0.1;
  else if (mc > 80) marketShare = 0.07;
  else if (mc > 30) marketShare = 0.045;
  marketShare = clamp(marketShare, 0.01, 0.4);

  // industryConcentration：行业经验 CR（后端 _cr_by_industry）
  const industry = asset.industry || '综合';
  const industryConcentration = clamp(INDUSTRY_CR[industry] ?? 0.45, 0.2, 0.85);

  return {
    marketShare,
    industryConcentration,
    initialPrice: Math.round(price * 100) / 100,
    intrinsicPrice: Math.round(intrinsicPrice * 100) / 100,
  };
}

// ---------- 估值因子（对齐 /api/market/valuation 返回） ----------
export async function localGetValuation(symbol) {
  const ns = normalizeSymbol(symbol);
  if (!ns) throw new Error(`无法识别的代码: ${symbol}`);

  let quote;
  try {
    quote = await fetchTencentQuote(ns.tencentCode);
  } catch (e) {
    quote = makeFallbackQuote(ns, findPreset(ns));
  }

  const preset = findPreset(ns) || null;
  const price = quote.price || preset?.basePrice || 100;
  const industry = preset?.industry || (ns.market === 'US' ? '科技' : '综合');

  const asset = {
    ticker: preset?.ticker || ns.code,
    name: quote.name && quote.name !== ns.tencentCode ? quote.name : (preset?.name || ns.code),
    industry,
    // marketCap：A股用腾讯实时（亿元）；美股保留锚点（十亿），避免单位错乱
    marketCap: ns.market === 'CN' && quote.market_cap > 0 ? quote.market_cap : (preset?.marketCap ?? 0),
    pe: quote.pe > 0 ? quote.pe : (preset?.pe ?? 0),
    pb: quote.pb > 0 ? quote.pb : (preset?.pb ?? 0),
    revenueGrowthYoY: preset?.revenueGrowthYoY ?? 0.05,
    fcfYield: preset?.fcfYield ?? (quote.pe > 0 ? 0.6 / quote.pe : 0.03),
    roe: preset?.roe ?? 0.1,
    debtToEquity: preset?.debtToEquity ?? 0.4,
    grade: preset?.grade ?? (quote.pe > 60 ? 'C' : quote.pe > 35 ? 'B' : 'A'),
    basePrice: Math.round(price * 100) / 100,
    close_prev: quote.close_prev || price,
    change_pct: quote.change_pct || 0,
    turnover_rate: quote.turnover_rate || 0,
    dividend_yield_ttm: quote.pe > 0 ? clamp(1 / quote.pe * 0.35, 0, 0.1) : 0.02,
    net_margin_pct: preset ? clamp((preset.roe || 0.1) * 0.6, 0.01, 0.6) : 0.15,
    gross_margin_pct: preset ? clamp(0.3 + (preset.roe || 0.1) * 0.5, 0.1, 0.8) : 0.35,
    provider: quote.provider,
  };

  const factors = estimateFactors(asset, quote);
  return { symbol: { symbol: ns.symbol, market: ns.market }, quote, asset, factors };
}

// ---------- K线（本地种子随机游走，末价锚定实时价） ----------
function tradingDays(n) {
  const out = [];
  const d = new Date();
  while (out.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      out.unshift(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
    }
    d.setDate(d.getDate() - 1);
  }
  return out;
}

export async function localGetKline(symbol, days = 120) {
  const ns = normalizeSymbol(symbol);
  if (!ns) throw new Error(`无法识别的代码: ${symbol}`);
  const n = Math.max(20, Math.min(504, Math.floor(days || 120)));

  let quote;
  try {
    quote = await fetchTencentQuote(ns.tencentCode);
  } catch (e) {
    quote = makeFallbackQuote(ns, findPreset(ns));
  }

  const endPrice = quote.price || 100;
  const preset = findPreset(ns) || null;
  const vol = ns.market === 'CN' ? 0.022 : 0.018; // 日波动率
  const rng = mulberry32(hashStr(`kline:${ns.code}:${n}`));

  // Box-Muller 生成日收益率，反向构建价格序列（末根收盘 = 实时价）
  const rets = [];
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rng(), 1e-9);
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    rets.push(clamp(z * vol, -0.09, 0.09));
  }
  const closes = new Array(n);
  closes[n - 1] = endPrice;
  for (let i = n - 2; i >= 0; i--) closes[i] = closes[i + 1] / (1 + rets[i + 1]);

  const dates = tradingDays(n);
  const baseMc = ns.market === 'CN' && quote.market_cap > 0 ? quote.market_cap : (preset?.marketCap ?? 100);
  const baseVol = Math.max(10000, Math.round((baseMc * 1000000) / (endPrice || 100)));

  const bars = closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    const hi = Math.max(open, close) * (1 + rng() * 0.012);
    const lo = Math.min(open, close) * (1 - rng() * 0.012);
    const chg = open > 0 ? (close - open) / open : 0;
    const volume = Math.max(1000, Math.round(baseVol * (0.7 + rng() * 0.9)));
    const amount = Math.round((volume * close) / 10000) / 100; // 万元
    return {
      date: dates[i],
      open: Math.round(open * 100) / 100,
      close: Math.round(close * 100) / 100,
      high: Math.round(hi * 100) / 100,
      low: Math.round(lo * 100) / 100,
      volume,
      amount,
      amplitude_pct: open > 0 ? (hi - lo) / open : 0,
      change_pct: chg,
      change_amt: Math.round((close - open) * 100) / 100,
      turnover_pct: 0,
    };
  });

  return { bars, provider: '本地随机游走 · 腾讯末价锚定', fetchedAt: Date.now() };
}

// ---------- 导出（与 apiClient market 方法同形） ----------
export const localMarket = {
  getValuation: localGetValuation,
  getKline: localGetKline,
  normalizeSymbol,
  fetchTencentQuote,
};

export default localMarket;
