"""
东方财富行情数据访问层
---------------------------------
设计目标（根据过往踩坑经验做出的防御性设计）：
1) 多源兜底：主源 Eastmoney push2，备用源 腾讯 qt.gtimg.cn
2) 传输兜底：requests 优先，缺失时自动退化 urllib；统一 UA/超时/重试
3) 股票代码归一化：600xxx -> 1.600xxx（沪），000xxx -> 0.000xxx（深），300xxx/688xxx 同理；AAPL/MSFT 美股走 usAAPL
4) 进程内代理可控：不修改系统代理；通过环境变量 QUOTE_PROXY/NO_PROXY 控制
5) 数值字段全部 safe_float/safe_int 处理，单个字段异常不崩整次请求
"""

import re
import os
import json
import time
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# ============================================================
# 可选依赖 & HTTP 客户端层
# ============================================================
try:
    import requests  # type: ignore
    _HAS_REQUESTS = True
except Exception:  # pragma: no cover
    _HAS_REQUESTS = False
    import urllib.request
    import urllib.parse
    import urllib.error


DEFAULT_TIMEOUT = 8  # 秒
DEFAULT_RETRIES = 2
DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def _build_proxies() -> Optional[Dict[str, str]]:
    """进程内控制代理，避免动系统代理"""
    p = os.environ.get("QUOTE_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY")
    if not p:
        return None
    return {"http": p, "https": p}


_DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_UA,
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://quote.eastmoney.com/",
}


def _http_get(url: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None, timeout: int = DEFAULT_TIMEOUT) -> str:
    """统一 HTTP GET（requests 优先，urllib 兜底；重试 2 次；默认带东财 Referer）"""
    hdrs = dict(_DEFAULT_HEADERS)
    if headers:
        hdrs.update(headers)
    proxies = _build_proxies()

    last_err: Optional[Exception] = None
    for attempt in range(DEFAULT_RETRIES + 1):
        try:
            if _HAS_REQUESTS:
                resp = requests.get(url, params=params, headers=hdrs, timeout=timeout, proxies=proxies)
                if resp.status_code >= 400:
                    raise RuntimeError(f"HTTP {resp.status_code}")
                resp.encoding = resp.apparent_encoding or resp.encoding or "utf-8"
                return resp.text
            else:  # pragma: no cover - urllib 兜底
                if params:
                    sep = "&" if "?" in url else "?"
                    url = url + sep + urllib.parse.urlencode(params)
                req = urllib.request.Request(url, headers=hdrs)
                handler_opener = None
                if proxies:
                    handler = urllib.request.ProxyHandler(proxies)
                    handler_opener = urllib.request.build_opener(handler)
                    with handler_opener.open(req, timeout=timeout) as resp:
                        data = resp.read()
                        enc = resp.headers.get_content_charset() or "utf-8"
                        return data.decode(enc, errors="replace")
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    data = resp.read()
                    enc = resp.headers.get_content_charset() or "utf-8"
                    return data.decode(enc, errors="replace")
        except Exception as e:  # noqa: BLE001
            last_err = e
            logger.warning(f"[eastmoney] HTTP GET 失败 (尝试 {attempt+1}/{DEFAULT_RETRIES+1}) {url}: {e}")
            time.sleep(0.4 + attempt * 0.3)
    raise RuntimeError(f"[eastmoney] HTTP GET 多次失败: {last_err}")


# ============================================================
# 工具函数
# ============================================================
def safe_float(v, default: float = 0.0) -> float:
    try:
        if v is None or v == "" or v == "-":
            return default
        return float(str(v).replace(",", "").strip())
    except Exception:
        return default


def safe_int(v, default: int = 0) -> int:
    try:
        if v is None or v == "" or v == "-":
            return default
        return int(float(str(v).replace(",", "").strip()))
    except Exception:
        return default


# ============================================================
# 股票代码归一化
# ============================================================
# Eastmoney secid:  沪市=1.600519, 深市=0.000001, 北交=0.430047, 美股=us.AAPL
# Tencent qt:       沪市=sh600519, 深市=sz000001, 美股=usAAPL

_RE_SH = re.compile(r"^60\d{4}$|^68[0-9]\d{3}$|^900\d{3}$")  # 主板60x/科创板688x/沪B
_RE_SZ = re.compile(r"^00\d{4}$|^30[0-9]\d{3}$|^200\d{3}$")  # 主板00x/创业板30x/深B
_RE_BJ = re.compile(r"^4[0-9]\d{4}$|^8[0-9]\d{4}$")
_RE_US = re.compile(r"^[A-Z]{1,5}([.-][A-Z]{1,4})?$")  # AAPL / BRK.B / TSLA


def normalize_symbol(user_input: str) -> Dict[str, str]:
    """输入原始代码（AAPL / 600519 / 000001 / sh600519 / usAAPL）
    返回 { raw, eastmoney_secid, tencent_code, market }"""
    raw = str(user_input or "").strip()
    low = raw.lower()
    if low.startswith("sh"):
        code = low[2:]
        return {"raw": raw, "eastmoney_secid": f"1.{code}", "tencent_code": f"sh{code}", "market": "SH"}
    if low.startswith("sz"):
        code = low[2:]
        return {"raw": raw, "eastmoney_secid": f"0.{code}", "tencent_code": f"sz{code}", "market": "SZ"}
    if low.startswith("bj"):
        code = low[2:]
        return {"raw": raw, "eastmoney_secid": f"0.{code}", "tencent_code": f"bj{code}", "market": "BJ"}
    if low.startswith("us"):
        us_code = raw[2:].upper()
        return {"raw": raw, "eastmoney_secid": f"us.{us_code}", "tencent_code": f"us{us_code}", "market": "US"}

    if _RE_US.match(raw.upper()):
        return {"raw": raw, "eastmoney_secid": f"us.{raw.upper()}", "tencent_code": f"us{raw.upper()}", "market": "US"}
    if _RE_SH.match(raw):
        return {"raw": raw, "eastmoney_secid": f"1.{raw}", "tencent_code": f"sh{raw}", "market": "SH"}
    if _RE_SZ.match(raw):
        return {"raw": raw, "eastmoney_secid": f"0.{raw}", "tencent_code": f"sz{raw}", "market": "SZ"}
    if _RE_BJ.match(raw):
        return {"raw": raw, "eastmoney_secid": f"0.{raw}", "tencent_code": f"bj{raw}", "market": "BJ"}
    # 未知：默认当 A 股深市处理（兜底不崩溃）
    return {"raw": raw, "eastmoney_secid": f"0.{raw}", "tencent_code": f"sz{raw}", "market": "UNKNOWN"}


# ============================================================
# 主源：东方财富 push2 实时行情
# ============================================================
_EASTMONEY_PUSH2 = "https://push2.eastmoney.com/api/qt/stock/get"
# 同域名另一条路径的实时行情备选（某些网络环境下 push2/get 被 RST，而 /agg 接口更稳定）
_EASTMONEY_PUSH2_ALT = "https://push2.eastmoney.com/api/qt/ulist.np/get"
_EASTMONEY_KLINE = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
_EASTMONEY_FIELDS = (
    "f43,f44,f45,f46,f47,f48,f50,f51,f52,f55,f57,f58,f60,f116,f117,f162,f167,"
    "f168,f169,f170,f171,f173,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192"
)

# TCP/TLS 连通性缓存（进程级，避免每次请求都花 3×8s）
_ENDPOINT_CACHE: Dict[str, Dict[str, Any]] = {}


def _endpoint_ok(key: str, url: str) -> bool:
    """一次性地探测一次 HTTP 连通性；成功后直接缓存，直到进程重启"""
    now = time.time()
    item = _ENDPOINT_CACHE.get(key)
    if item:
        if item.get("ok"):
            return True
        # 失败结果只缓存 60 秒
        if now - item.get("ts", 0) < 60:
            return False
    try:
        _http_get(url, params={"_": str(int(now))}, timeout=4)
        _ENDPOINT_CACHE[key] = {"ok": True, "ts": now}
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[eastmoney] 端点预检测 {key} 不通: {e}")
        _ENDPOINT_CACHE[key] = {"ok": False, "ts": now}
        return False


def _fetch_eastmoney_rt(symbol_info: Dict[str, str]) -> Dict[str, Any]:
    # 先预检测 push2 端点是否可达，不可达直接抛，避免 3×8s 漫长失败
    if not _endpoint_ok("push2", _EASTMONEY_PUSH2 + "?secid=1.600519&fields=f57&_=0"):
        raise RuntimeError("push2.eastmoney.com 端点不通，跳过东财主源")

    params = {
        "secid": symbol_info["eastmoney_secid"],
        "fields": _EASTMONEY_FIELDS,
        "ut": "fa5fd1943c7b386f172d6893dbfba10b",
        "_": str(int(time.time() * 1000)),
    }
    text = _http_get(_EASTMONEY_PUSH2, params=params, timeout=8)
    data = json.loads(text)
    if not data or "data" not in data or data.get("data") is None:
        raise RuntimeError("Eastmoney 返回空数据（可能股票代码或 secid 错误）")
    r = data["data"]

    # f43=当前价, f44=最高, f45=最低, f46=今开, f47=成交量(手), f48=成交额,
    # f50=量比, f51=涨停, f52=跌停, f55=均价, f57=代码, f58=名称,
    # f60=昨收, f116=总市值, f117=流通市值,
    # f162=PE(动), f167=市净率PB, f168=换手率%, f170=市盈率(TTM),
    # f183=营收同比(%), f184=净利润同比(%), f185=净资产收益率ROE(%),
    # f186=毛利率(%), f187=净利率(%), f188=资产负债率(%),
    # f189=总股本, f190=流通股, f191=股息率TTM, f192=市盈率(静)
    def _div(v, n):
        return safe_float(v) / (10 ** n) if safe_float(v) != 0 else 0.0

    price = _div(r.get("f43"), 2)
    close_prev = _div(r.get("f60"), 2)
    change_pct = 0.0
    if close_prev > 0:
        change_pct = (price - close_prev) / close_prev

    return {
        "provider": "eastmoney",
        "source": "push2",
        "symbol": r.get("f57") or symbol_info["raw"],
        "name": r.get("f58") or symbol_info["raw"],
        "market": symbol_info["market"],
        "price": price,
        "high": _div(r.get("f44"), 2),
        "low": _div(r.get("f45"), 2),
        "open": _div(r.get("f46"), 2),
        "close_prev": close_prev,
        "change_pct": change_pct,
        "volume": safe_int(r.get("f47")) * 100,  # 手 -> 股
        "amount": safe_float(r.get("f48")),       # 元
        "turnover_rate": safe_float(r.get("f168")),  # %
        "quantity_ratio": _div(r.get("f50"), 2),
        "limit_up": _div(r.get("f51"), 2),
        "limit_down": _div(r.get("f52"), 2),
        "avg_price": _div(r.get("f55"), 2),
        # 估值
        "pe_dynamic": safe_float(r.get("f162")),
        "pe_ttm": safe_float(r.get("f170")),
        "pe_static": safe_float(r.get("f192")),
        "pb": safe_float(r.get("f167")),
        "roe_ttm": safe_float(r.get("f185")),
        "gross_margin": safe_float(r.get("f186")),
        "net_margin": safe_float(r.get("f187")),
        "debt_ratio": safe_float(r.get("f188")),
        "revenue_growth_yoy": safe_float(r.get("f183")),
        "profit_growth_yoy": safe_float(r.get("f184")),
        "dividend_yield_ttm": safe_float(r.get("f191")),
        "market_cap": safe_float(r.get("f116")),  # 元（东财返回的是元为单位整数）
        "circulating_market_cap": safe_float(r.get("f117")),
        "total_shares": safe_float(r.get("f189")),
        "circulating_shares": safe_float(r.get("f190")),
    }


# ============================================================
# 备用源：腾讯 qt.gtimg.cn 行情文本协议
# ============================================================
def _fetch_tencent_rt(symbol_info: Dict[str, str]) -> Dict[str, Any]:
    url = f"https://qt.gtimg.cn/q={symbol_info['tencent_code']}"
    raw_bytes: Optional[bytes] = None
    if _HAS_REQUESTS:
        resp = requests.get(url, headers={"Referer": "https://finance.qq.com/", "User-Agent": DEFAULT_UA},
                            timeout=DEFAULT_TIMEOUT, proxies=_build_proxies())
        if resp.status_code >= 400:
            raise RuntimeError(f"HTTP {resp.status_code}")
        raw_bytes = resp.content
    else:  # pragma: no cover
        req = urllib.request.Request(url, headers={
            "Referer": "https://finance.qq.com/",
            "User-Agent": DEFAULT_UA,
        })
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
            raw_bytes = resp.read()

    # A 股腾讯返回 GBK 编码；美股/港股返回 UTF-8；自动尝试
    for enc in ("gbk", "utf-8", "latin-1"):
        try:
            text = raw_bytes.decode(enc)
            if '~' in text or '"' in text:
                break
        except Exception:  # noqa: BLE001
            continue
    else:
        text = raw_bytes.decode("utf-8", errors="replace")

    # 形如：v_sh600519="1~贵州茅台~600519~1720.00~1738.03~...~field_n"
    m = re.search(r'"(.+)"', text)
    if not m:
        raise RuntimeError("腾讯行情返回格式无法解析")
    fields = m.group(1).split("~")
    # 根据探测结果：腾讯美股 usAAPL 返回 71 字段；A 股 sh/sz 返回 ~48 字段
    # 统一位序映射（美股、A股实测索引）：
    #  idx[1]=名称, idx[2]=代码, idx[3]=当前价, idx[4]=昨收, idx[5]=今开, idx[6]=成交量(股),
    #  idx[33]=最高, idx[34]=最低, idx[37]=成交额(元/万元混合, 美股是元级, A股是万元级)
    #  idx[38]=换手率%, idx[39]=PE(TTM), idx[44/45]=市值(亿), idx[46]=公司名/PB(不固定！)
    # 防御性做法：按数值特征 + 多候选索引综合取值
    idx = {i: fields[i] for i in range(len(fields))}

    # 多个候选索引依次取第一个非零值（防御位序变动）
    def pick(*candidates):
        for c in candidates:
            v = safe_float(idx.get(c))
            if v not in (None, 0.0):
                return v
        return 0.0

    price = pick(3)
    close_prev = pick(4)
    open_p = pick(5)
    volume = safe_float(idx.get(6))
    amount_raw = safe_float(idx.get(37))
    # 成交额自适应单位：如果 price*volume 远大于 amount_raw，说明 amount_raw 单位是万元 → ×10000
    turnover_by_price = price * volume
    if turnover_by_price > 0 and amount_raw > 0 and (turnover_by_price / amount_raw) > 50:
        amount = amount_raw * 10000
    elif amount_raw > 0 and amount_raw < 1e10:
        # 保守：美股通常 amount_raw 已经在 1e9 左右 (元级)，A 股万元级是 1e5 左右
        # 如果 volume 很大但 amount_raw 很小，×10000
        amount = amount_raw * 10000 if amount_raw < turnover_by_price / 2 else amount_raw
    else:
        amount = amount_raw
    high = pick(33)
    low = pick(34)
    change_pct = ((price - close_prev) / close_prev) if close_prev else 0.0
    turnover_rate = pick(38)
    pe = pick(39, 54)
    # 美股 idx[43]=PB；A 股 idx[46]可能/PB候选也有 idx[44]
    pb = pick(43, 46, 44)
    # 市值（亿）候选：44 / 45 / 53
    mcap_yi = pick(45, 44, 53)
    name = idx.get(1) or symbol_info["raw"]
    code = idx.get(2) or symbol_info["raw"]
    # 补充：idx[57]=涨停价(或年内高), idx[58]=跌停(或年内低), idx[30]=时间
    limit_up = safe_float(idx.get(47, idx.get(57)))
    limit_down = safe_float(idx.get(48, idx.get(58)))
    avg_price = safe_float(idx.get(55))

    return {
        "provider": "tencent",
        "source": "qt.gtimg.cn",
        "symbol": code,
        "name": name,
        "market": symbol_info["market"],
        "price": price,
        "high": high,
        "low": low,
        "open": open_p,
        "close_prev": close_prev,
        "change_pct": change_pct,
        "volume": volume,
        "amount": amount,  # 已按自适应单位换算成元
        "turnover_rate": turnover_rate,
        "quantity_ratio": 0.0,
        "limit_up": limit_up,
        "limit_down": limit_down,
        "avg_price": avg_price,
        "pe_dynamic": pe,
        "pe_ttm": pe,
        "pe_static": 0.0,
        "pb": pb,
        "roe_ttm": 0.0,
        "gross_margin": 0.0,
        "net_margin": 0.0,
        "debt_ratio": 0.0,
        "revenue_growth_yoy": 0.0,
        "profit_growth_yoy": 0.0,
        "dividend_yield_ttm": 0.0,
        "market_cap": mcap_yi * 1e8,  # 亿 -> 元
        "circulating_market_cap": 0.0,
        "total_shares": 0.0,
        "circulating_shares": 0.0,
    }


# ============================================================
# 第 3 源：新浪 hq.sinajs.cn 实时价格（A 股 GBK，美股 UTF-8）
# ============================================================
_SINA_HOST = "https://hq.sinajs.cn/list="


def _sina_code(symbol_info: Dict[str, str]) -> str:
    """新浪代码：沪市=sh600519, 深市=sz000001, 美股=gb_aapl"""
    m = symbol_info["market"]
    raw = symbol_info["raw"]
    if m == "SH":
        return f"sh{raw}"
    if m == "SZ":
        return f"sz{raw}"
    if m == "BJ":
        return f"bj{raw}"
    if m == "US":
        # 美股新浪用 gb_ 前缀 + 大写代码
        return f"gb_{raw.upper()}"
    # 未知：尝试 sh/sz 前缀
    return symbol_info["tencent_code"]


def _fetch_sina_rt(symbol_info: Dict[str, str]) -> Dict[str, Any]:
    """新浪实时价格（A 股字段: 名称,今开,昨收,当前,最高,最低,...,成交量,成交额,...）
    美股字段: 名称,当前价,涨跌幅,时间,涨跌额,昨收,最高,最低,成交量,成交额,..."""
    code = _sina_code(symbol_info)
    url = _SINA_HOST + code
    if _HAS_REQUESTS:
        resp = requests.get(url, headers={"Referer": "https://finance.sina.com.cn/", "User-Agent": DEFAULT_UA},
                            timeout=DEFAULT_TIMEOUT, proxies=_build_proxies())
        if resp.status_code >= 400:
            raise RuntimeError(f"新浪 HTTP {resp.status_code}")
        raw_bytes = resp.content
    else:  # pragma: no cover
        req = urllib.request.Request(url, headers={"Referer": "https://finance.sina.com.cn/", "User-Agent": DEFAULT_UA})
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as resp:
            raw_bytes = resp.read()

    # A 股返回 GBK；美股返回 UTF-8
    for enc in ("gbk", "utf-8", "latin-1"):
        try:
            text = raw_bytes.decode(enc)
            if '=' in text and '"' in text:
                break
        except Exception:
            continue
    else:
        text = raw_bytes.decode("utf-8", errors="replace")

    m = re.search(r'"(.*)"', text)
    if not m:
        raise RuntimeError("新浪行情返回格式无法解析")
    content = m.group(1)
    if not content.strip():
        raise RuntimeError("新浪行情返回空内容（可能代码不存在或非交易时段）")
    fields = content.split(",")
    is_us = symbol_info["market"] == "US"

    if is_us:
        # 美股: 名称,当前价,涨跌幅,时间,涨跌额,昨收,最高,最低,成交量,成交额,...
        price = safe_float(fields[1]) if len(fields) > 1 else 0
        change_pct = safe_float(fields[2]) / 100.0 if len(fields) > 2 else 0  # 新浪美股涨跌幅是百分比数字
        close_prev = safe_float(fields[5]) if len(fields) > 5 else 0
        high = safe_float(fields[6]) if len(fields) > 6 else 0
        low = safe_float(fields[7]) if len(fields) > 7 else 0
        volume = safe_float(fields[8]) if len(fields) > 8 else 0
        amount = safe_float(fields[9]) if len(fields) > 9 else 0
        open_p = 0.0
        name = fields[0] if fields[0] else symbol_info["raw"]
        # 新浪美股不带 PE/PB，留给腾讯或东财补
        return {
            "provider": "sina",
            "source": "hq.sinajs.cn",
            "symbol": symbol_info["raw"],
            "name": name,
            "market": symbol_info["market"],
            "price": price,
            "high": high,
            "low": low,
            "open": open_p,
            "close_prev": close_prev,
            "change_pct": change_pct,
            "volume": volume,
            "amount": amount,
            "turnover_rate": 0.0,
            "quantity_ratio": 0.0,
            "limit_up": 0.0,
            "limit_down": 0.0,
            "avg_price": 0.0,
            "pe_dynamic": 0.0, "pe_ttm": 0.0, "pe_static": 0.0,
            "pb": 0.0,
            "roe_ttm": 0.0, "gross_margin": 0.0, "net_margin": 0.0, "debt_ratio": 0.0,
            "revenue_growth_yoy": 0.0, "profit_growth_yoy": 0.0,
            "dividend_yield_ttm": 0.0,
            "market_cap": 0.0, "circulating_market_cap": 0.0,
            "total_shares": 0.0, "circulating_shares": 0.0,
        }
    else:
        # A 股: 名称,今开,昨收,当前价,最高,最低,买1,卖1,成交量(股),成交额(元),...
        name = fields[0] if fields[0] else symbol_info["raw"]
        open_p = safe_float(fields[1]) if len(fields) > 1 else 0
        close_prev = safe_float(fields[2]) if len(fields) > 2 else 0
        price = safe_float(fields[3]) if len(fields) > 3 else 0
        high = safe_float(fields[4]) if len(fields) > 4 else 0
        low = safe_float(fields[5]) if len(fields) > 5 else 0
        volume = safe_float(fields[8]) if len(fields) > 8 else 0
        amount = safe_float(fields[9]) if len(fields) > 9 else 0
        change_pct = ((price - close_prev) / close_prev) if close_prev else 0.0
        return {
            "provider": "sina",
            "source": "hq.sinajs.cn",
            "symbol": symbol_info["raw"],
            "name": name,
            "market": symbol_info["market"],
            "price": price,
            "high": high,
            "low": low,
            "open": open_p,
            "close_prev": close_prev,
            "change_pct": change_pct,
            "volume": volume,
            "amount": amount,
            "turnover_rate": 0.0,
            "quantity_ratio": 0.0,
            "limit_up": 0.0,
            "limit_down": 0.0,
            "avg_price": 0.0,
            "pe_dynamic": 0.0, "pe_ttm": 0.0, "pe_static": 0.0,
            "pb": 0.0,
            "roe_ttm": 0.0, "gross_margin": 0.0, "net_margin": 0.0, "debt_ratio": 0.0,
            "revenue_growth_yoy": 0.0, "profit_growth_yoy": 0.0,
            "dividend_yield_ttm": 0.0,
            "market_cap": 0.0, "circulating_market_cap": 0.0,
            "total_shares": 0.0, "circulating_shares": 0.0,
        }


# ============================================================
# 第 4 源：东财 datacenter-web（估值 + 财务指标，A 股专用）
# ============================================================
_DATACENTER_BASE = "https://datacenter-web.eastmoney.com/api/data/v1/get"


def _fetch_eastmoney_datacenter(symbol_info: Dict[str, str]) -> Dict[str, Any]:
    """从东财 datacenter-web 拉估值分析 + 主要财务指标（A 股代码 6 位数字）。
    返回与 quote 结构兼容的字典，价格字段用 0（交给新浪/腾讯补），只填估值&财务。"""
    # datacenter 只支持 A 股 6 位代码
    code_digits = re.sub(r'\D', '', symbol_info["raw"])
    if len(code_digits) != 6 or symbol_info["market"] == "US":
        raise RuntimeError("datacenter 仅支持 A 股 6 位代码")

    quote: Dict[str, Any] = {
        "provider": "eastmoney_datacenter",
        "source": "datacenter-web",
        "symbol": symbol_info["raw"],
        "name": symbol_info["raw"],
        "market": symbol_info["market"],
        # 价格类留给新浪/腾讯补
        "price": 0.0, "high": 0.0, "low": 0.0, "open": 0.0, "close_prev": 0.0,
        "change_pct": 0.0, "volume": 0.0, "amount": 0.0,
        "turnover_rate": 0.0, "quantity_ratio": 0.0,
        "limit_up": 0.0, "limit_down": 0.0, "avg_price": 0.0,
        # 估值&财务（待填）
        "pe_dynamic": 0.0, "pe_ttm": 0.0, "pe_static": 0.0,
        "pb": 0.0,
        "roe_ttm": 0.0, "gross_margin": 0.0, "net_margin": 0.0, "debt_ratio": 0.0,
        "revenue_growth_yoy": 0.0, "profit_growth_yoy": 0.0,
        "dividend_yield_ttm": 0.0,
        "market_cap": 0.0, "circulating_market_cap": 0.0,
        "total_shares": 0.0, "circulating_shares": 0.0,
    }

    # 1) 估值分析 RPT_VALUEANALYSIS_DET
    val_url = f"{_DATACENTER_BASE}?reportName=RPT_VALUEANALYSIS_DET&columns=ALL&filter=(SECURITY_CODE=%22{code_digits}%22)&pageSize=1&_={int(time.time()*1000)}"
    try:
        text = _http_get(val_url, timeout=8)
        data = json.loads(text)
        if data.get("result") and data["result"].get("data"):
            r = data["result"]["data"][0]
            quote["name"] = r.get("SECURITY_NAME_ABBR") or quote["name"]
            quote["pe_ttm"] = safe_float(r.get("PE_TTM"))
            quote["pe_static"] = safe_float(r.get("PE_LAR"))
            quote["pe_dynamic"] = safe_float(r.get("PE_TTM"))
            quote["pb"] = safe_float(r.get("PB_MRQ"))
            quote["market_cap"] = safe_float(r.get("TOTAL_MARKET_CAP"))
            quote["circulating_market_cap"] = safe_float(r.get("NOTLIMITED_MARKETCAP_A"))
            quote["total_shares"] = safe_float(r.get("TOTAL_SHARES"))
            quote["circulating_shares"] = safe_float(r.get("FREE_SHARES_A"))
            # 如果新浪/腾讯没给价格，用 datacenter 的收盘价兜底
            if not quote.get("price"):
                quote["price"] = safe_float(r.get("CLOSE_PRICE"))
                quote["change_pct"] = safe_float(r.get("CHANGE_RATE")) / 100.0
    except Exception as e:
        logger.warning(f"[datacenter] 估值分析失败 {code_digits}: {e}")

    # 2) 主要财务指标 RPT_LICO_FN_CPD
    fin_url = f"{_DATACENTER_BASE}?reportName=RPT_LICO_FN_CPD&columns=ALL&filter=(SECURITY_CODE=%22{code_digits}%22)&pageSize=1&_={int(time.time()*1000)}"
    try:
        text = _http_get(fin_url, timeout=8)
        data = json.loads(text)
        if data.get("result") and data["result"].get("data"):
            r = data["result"]["data"][0]
            quote["name"] = r.get("SECURITY_NAME_ABBR") or quote["name"]
            quote["roe_ttm"] = safe_float(r.get("WEIGHTAVG_ROE"))
            quote["revenue_growth_yoy"] = safe_float(r.get("YSTZ"))
            quote["profit_growth_yoy"] = safe_float(r.get("SJLTZ"))
            quote["gross_margin"] = safe_float(r.get("XSMLL"))
            # BPS 每股净资产可用于推 PB；MGJYXJJE 每股经营现金流可用于推 FCF
            bps = safe_float(r.get("BPS"))
            if bps > 0 and quote["price"] > 0 and quote["pb"] == 0:
                quote["pb"] = round(quote["price"] / bps, 4)
    except Exception as e:
        logger.warning(f"[datacenter] 财务指标失败 {code_digits}: {e}")

    return quote


# ============================================================
# 对外实时行情（多源合并：价格走新浪/腾讯，估值&财务走东财 datacenter）
# ============================================================
# 字段合并优先级：先到先得（非 0 非 None 覆盖），但 provider 记录最终主源
_MERGE_FIELDS = [
    "price", "high", "low", "open", "close_prev", "change_pct",
    "volume", "amount", "turnover_rate", "quantity_ratio",
    "limit_up", "limit_down", "avg_price",
    "pe_dynamic", "pe_ttm", "pe_static", "pb",
    "roe_ttm", "gross_margin", "net_margin", "debt_ratio",
    "revenue_growth_yoy", "profit_growth_yoy", "dividend_yield_ttm",
    "market_cap", "circulating_market_cap",
    "total_shares", "circulating_shares",
]


def _merge_quotes(*quotes: Dict[str, Any]) -> Dict[str, Any]:
    """合并多个源的 quote：以第一个为基础，后续源的非空字段覆盖"""
    if not quotes:
        return {}
    base = dict(quotes[0])
    for extra in quotes[1:]:
        if not extra:
            continue
        for k in _MERGE_FIELDS:
            v = extra.get(k)
            # 只在 base 缺失或为 0 时用 extra 覆盖
            if v not in (None, 0, 0.0, "") and not safe_float(base.get(k), -1) > 0:
                base[k] = v
        # name 优先取非数字的真名
        if base.get("name", "").isdigit() and extra.get("name") and not str(extra["name"]).isdigit():
            base["name"] = extra["name"]
    # provider 汇总
    providers = [q.get("provider") for q in quotes if q.get("provider")]
    base["provider"] = "+".join(providers) if providers else base.get("provider", "unknown")
    return base


def get_realtime_quote(symbol: str) -> Dict[str, Any]:
    """
    多源合并获取实时行情：
      - A 股：新浪(价格) + 东财 datacenter(估值&财务) + 腾讯(兜底)
      - 美股：腾讯(价格+PE+PB+市值) + 新浪(价格兜底)
    返回合并后的完整 quote 字典。
    """
    info = normalize_symbol(symbol)
    is_a_share = info["market"] in ("SH", "SZ", "BJ")
    collected: List[Dict[str, Any]] = []
    last_err: Optional[Exception] = None

    if is_a_share:
        # A 股策略：新浪价格 → 东财 datacenter 估值财务 → 腾讯兜底
        for name, fn in (
            ("sina", _fetch_sina_rt),
            ("eastmoney_datacenter", _fetch_eastmoney_datacenter),
            ("tencent", _fetch_tencent_rt),
        ):
            try:
                q = fn(info)
                collected.append(q)
                logger.info(f"[quote] {name} ok: {q.get('symbol')} price={q.get('price')}")
            except Exception as e:  # noqa: BLE001
                last_err = e
                logger.warning(f"[quote] {name} 失败: {e}")
        # 至少需要一个有价格的源
        priced = [q for q in collected if safe_float(q.get("price")) > 0]
        if not priced:
            raise RuntimeError(f"[quote] 所有源均无有效价格: {last_err}")
    else:
        # 美股策略：腾讯(价格+PE+PB+市值) → 新浪(价格兜底)
        for name, fn in (
            ("tencent", _fetch_tencent_rt),
            ("sina", _fetch_sina_rt),
        ):
            try:
                q = fn(info)
                collected.append(q)
                logger.info(f"[quote] {name} ok: {q.get('symbol')} price={q.get('price')}")
            except Exception as e:  # noqa: BLE001
                last_err = e
                logger.warning(f"[quote] {name} 失败: {e}")
        priced = [q for q in collected if safe_float(q.get("price")) > 0]
        if not priced:
            raise RuntimeError(f"[quote] 所有源均无有效价格: {last_err}")

    merged = _merge_quotes(*collected)
    logger.info(f"[quote] ✓ 合并完成: {merged.get('symbol')} = {merged.get('price')} "
                f"PE={merged.get('pe_ttm')} PB={merged.get('pb')} ROE={merged.get('roe_ttm')}% "
                f"营收同比={merged.get('revenue_growth_yoy')}% 来源={merged.get('provider')}")
    return merged


# ============================================================
# 日 K 线（用于 MDD、历史波动率、决策K线展示）
# ============================================================

# 备用源：腾讯 ifzq 日 K 线（前复权 qfqday）
_TENCENT_KLINE_URL = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"


def _fetch_tencent_kline(symbol_info: Dict[str, str], days: int) -> List[Dict[str, Any]]:
    """备用源：腾讯日 K 线。返回与东财相同的字段结构（含 change_pct 百分比）。"""
    param = f"{symbol_info['tencent_code']},day,,,{max(5, int(days))},qfq"
    text = _http_get(_TENCENT_KLINE_URL, params={"param": param}, timeout=10)
    data = json.loads(text)
    if not data or data.get("code") != 0:
        raise RuntimeError("腾讯K线接口返回异常")
    node = (data.get("data") or {}).get(symbol_info["tencent_code"], {})
    rows = node.get("qfqday") or node.get("day") or []
    out: List[Dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) < 6:
            continue
        prev = out[-1]["close"] if out else None
        close = safe_float(row[2])
        change_pct = 0.0
        if prev:
            change_pct = (close - prev) / prev
        out.append({
            "date": str(row[0]),
            "open": safe_float(row[1]),
            "close": close,
            "high": safe_float(row[3]),
            "low": safe_float(row[4]),
            "volume": safe_float(row[5]),
            "amount": 0.0,
            "amplitude_pct": 0.0,
            "change_pct": round(change_pct * 100, 2),
            "change_amt": close - (prev or close),
            "turnover_pct": 0.0,
        })
    if not out:
        raise RuntimeError("腾讯K线无数据")
    return out


def get_daily_kline(symbol: str, days: int = 120) -> List[Dict[str, Any]]:
    """日 K 线（fields: 日期,开盘,收盘,最高,最低,成交量,成交额,振幅%,涨跌幅%,涨跌额,换手率%）
    数据源：东方财富 push2his 主源 → 腾讯 ifzq 备用源，双源兜底以消除"重建"回退。"""
    info = normalize_symbol(symbol)
    errors: List[str] = []

    # 主源：东方财富 push2his
    try:
        if _endpoint_ok("push2his", _EASTMONEY_KLINE + "?secid=1.600519&fields1=f1&fields2=f51&klt=101&fqt=1&lmt=1&_=0"):
            params = {
                "secid": info["eastmoney_secid"],
                "fields1": "f1,f2,f3,f4,f5,f6",
                "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
                "klt": "101",  # 101=日,102=周,103=月
                "fqt": "1",    # 1=前复权
                "end": "20500101",
                "lmt": str(max(5, int(days))),
                "ut": "fa5fd1943c7b386f172d6893dbfba10b",
            }
            text = _http_get(_EASTMONEY_KLINE, params=params, timeout=10)
            data = json.loads(text)
            if data and "data" in data and data["data"] and "klines" in data["data"]:
                out: List[Dict[str, Any]] = []
                for row in data["data"]["klines"]:
                    cols = str(row).split(",")
                    if len(cols) < 11:
                        continue
                    out.append({
                        "date": cols[0],
                        "open": safe_float(cols[1]),
                        "close": safe_float(cols[2]),
                        "high": safe_float(cols[3]),
                        "low": safe_float(cols[4]),
                        "volume": safe_float(cols[5]),
                        "amount": safe_float(cols[6]),
                        "amplitude_pct": safe_float(cols[7]),
                        "change_pct": safe_float(cols[8]),
                        "change_amt": safe_float(cols[9]),
                        "turnover_pct": safe_float(cols[10]),
                    })
                if out:
                    logger.info(f"[kline] 东财主源 ok: {symbol} 条数={len(out)}")
                    return out
    except Exception as e:  # noqa: BLE001
        errors.append(f"eastmoney: {e}")
        logger.warning(f"[kline] 东财K线失败，转腾讯备用源: {e}")

    # 备用源：腾讯 ifzq
    try:
        bars = _fetch_tencent_kline(info, days)
        logger.info(f"[kline] 腾讯备用源 ok: {symbol} 条数={len(bars)}")
        return bars
    except Exception as e:  # noqa: BLE001
        errors.append(f"tencent: {e}")
        logger.warning(f"[kline] 腾讯K线失败: {e}")

    raise RuntimeError("K线多源全部失败: " + "; ".join(errors))


# ============================================================
# 估值因子：把实时行情 -> 量化引擎 PRESET_ASSETS 需要的字段
#   ticker / name / industry / marketCap (亿) / pe / pb /
#   revenueGrowthYoY / fcfYield / roe / debtToEquity / grade / basePrice
# ============================================================
_INDUSTRY_HINT = {
    "SH": "综合", "SZ": "综合", "BJ": "专精特新", "US": "综合", "UNKNOWN": "综合",
}


def estimate_fcf_yield(roe: float, pb: float, net_margin: float) -> float:
    """缺少直接 FCF 字段，使用 ROE/PB/净利率粗估（仅做可比较指标）"""
    if pb <= 0 or roe <= 0:
        return 0.02
    # FCF/市值 ≈ ROE / PB * (净利率 + 0.05)  经验式
    return max(0.005, min(0.2, (roe / 100.0 / pb) * max(0.3, (net_margin / 100.0 + 0.05))))


def estimate_debt_to_equity(debt_ratio: float) -> float:
    """负债率（%） -> 有息负债/权益（简化推导）"""
    dr = safe_float(debt_ratio, 0.0) / 100.0
    if dr <= 0:
        return 0.3
    if dr >= 1:
        return 10.0
    # D/A = dr => D/E = dr / (1 - dr)
    return round(max(0.05, dr / (1 - dr)), 3)


def grade_asset(pe: float, pb: float, roe: float, growth: float) -> str:
    """简单评级 S/A/B/C"""
    score = 0
    score += 3 if 0 < pe < 25 else (2 if 25 <= pe < 40 else 1 if pe > 0 else 0)
    score += 3 if 0 < pb < 5 else (2 if 5 <= pb < 15 else 1 if pb > 0 else 0)
    score += 3 if roe > 15 else (2 if roe > 8 else 1 if roe > 0 else 0)
    score += 3 if growth > 15 else (2 if growth > 0 else 0)
    if score >= 11:
        return "S"
    if score >= 8:
        return "A"
    if score >= 5:
        return "B"
    return "C"


def get_valuation_factors(symbol: str) -> Dict[str, Any]:
    """把实时行情包装成 quantEngine 所需的 PRESET_ASSETS + Factors 结构"""
    quote = get_realtime_quote(symbol)
    info = normalize_symbol(symbol)
    mcap_yi = safe_float(quote["market_cap"]) / 1e8  # 元 -> 亿
    roe = safe_float(quote["roe_ttm"])
    pb = safe_float(quote["pb"])
    net_margin = safe_float(quote["net_margin"])
    growth = safe_float(quote["revenue_growth_yoy"])
    pe = safe_float(quote["pe_ttm"]) or safe_float(quote["pe_dynamic"]) or 30.0
    dr = safe_float(quote["debt_ratio"])
    div_yield = safe_float(quote["dividend_yield_ttm"])

    asset = {
        "ticker": quote["symbol"],
        "name": quote["name"],
        "industry": _INDUSTRY_HINT.get(info["market"], "综合"),
        "marketCap": round(mcap_yi, 2),        # 亿（与 PRESET_ASSETS 单位一致）
        "pe": round(pe if pe > 0 else 30.0, 2),
        "pb": round(pb if pb > 0 else 2.0, 2),
        "revenueGrowthYoY": round(growth / 100.0 if abs(growth) >= 1 else growth, 4),
        "fcfYield": round(estimate_fcf_yield(roe, pb, net_margin), 4),
        "roe": round(max(0.01, roe / 100.0), 4),  # 0~1
        "debtToEquity": estimate_debt_to_equity(dr),
        "grade": grade_asset(pe, pb, roe, growth),
        "basePrice": round(quote["price"] if quote["price"] > 0 else 1.0, 2),
        "close_prev": round(quote["close_prev"], 2),
        "change_pct": round(quote["change_pct"], 4),
        "turnover_rate": quote["turnover_rate"],
        "dividend_yield_ttm": div_yield,
        "net_margin_pct": net_margin,
        "gross_margin_pct": quote["gross_margin"],
    }

    # 行业集中度/市场份额：无法直接从实时行情拿到，保守使用中位数（让量化引擎至少能跑）
    #   - 行业集中度 industryConcentration: 0.3(分散)~0.8(寡头)
    #   - 市场份额 marketShare: 0.01~0.8；用市值排名粗略：mcap 越高 -> 越高
    def _share_by_mcap(m: float) -> float:
        if m <= 0:
            return 0.15
        if m < 50:
            return 0.02
        if m < 300:
            return 0.08
        if m < 1000:
            return 0.18
        if m < 5000:
            return 0.30
        return 0.55

    def _cr_by_industry(ind: str) -> float:
        return {
            "科技": 0.45, "半导体": 0.55, "互联网": 0.65, "电商/云": 0.55,
            "能源": 0.7, "医药": 0.35, "银行": 0.6, "新能源": 0.4,
            "多元金融": 0.5, "专精特新": 0.25, "综合": 0.4,
        }.get(ind, 0.4)

    factors = {
        "marketShare": _share_by_mcap(mcap_yi),
        "industryConcentration": _cr_by_industry(asset["industry"]),
        "initialPrice": quote["price"],
        "intrinsicPrice": 0.0,  # 让量化引擎自己按 DCF 算
    }
    # 给一个基于 PE/PB 粗估的内在价值，让 Step4 更有"锚"
    if pe > 0 and asset["roe"] > 0:
        # 粗略：PE 回到 20 时的理论价 = 当前价 * 20 / PE
        factors["intrinsicPrice"] = round(quote["price"] * 20.0 / pe, 2)
    else:
        factors["intrinsicPrice"] = round(quote["price"] * 1.1, 2)

    return {
        "symbol": info,
        "quote": quote,
        "asset": asset,
        "factors": factors,
    }
