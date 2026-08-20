/**
 * 决策拼图墙 + 策略编译 decide() v1
 *
 * 蓝图第 5 站 5.2：
 *  - 决策碎片墙：localStorage「poker_decisions」逐条渲染为碎片卡，按街分组上墙
 *  - 策略编译器：纯本地聚合碎片 -> 生成可溯源的 decide() 代码（TS 主 / Python 辅）
 * 图形一律内联 SVG（零字体依赖，跨设备无豆腐块）
 */

import React, { useEffect, useMemo, useState } from 'react';
import { getDecisions } from '../PokerArena/pokerArenaApi';
import {
  MIN_FRAGMENTS,
  STAGE_ORDER,
  STAGE_LABEL,
  ACTION_LABEL,
  analyzeDecisions,
  compileStrategy,
} from './strategyCompiler';
import './PokerPuzzle.css';

const MAX_PER_STAGE = 40; // 每街最多上墙碎片数（防爆 DOM）

// ── 内联 SVG 图标 ──
function ShardIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 1.8l7.8 6.1-3.4 14.3L4.2 13.9z" />
    </svg>
  );
}

function BoltIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
    </svg>
  );
}

const ACTION_CLASS = { fold: 'fold', check: 'check', call: 'call', raise: 'raise', allin: 'allin' };

function fmtTime(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── 迷你条形：牌力 / 风险 ──
function MiniBar({ label, value, tone }) {
  const pct = Math.round(Math.min(1, Math.max(0, typeof value === 'number' ? value : 0)) * 100);
  return (
    <div className="pp-bar-row">
      <span className="pp-bar-label">{label}</span>
      <span className="pp-bar-track">
        <i className={`pp-bar-fill ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="pp-bar-val">{pct}</span>
    </div>
  );
}

// ── 单枚碎片卡 ──
function Fragment({ d }) {
  const actClass = ACTION_CLASS[d.action] || 'fold';
  return (
    <div className={`pp-frag act-${actClass}`}>
      <div className="pp-frag-top">
        <span className={`pp-frag-action ${actClass}`}>{ACTION_LABEL[d.action] || d.action}</span>
        <span className="pp-frag-ms">
          {typeof d.decisionMs === 'number' ? `${(d.decisionMs / 1000).toFixed(1)}s` : '--'}
        </span>
      </div>
      <MiniBar label="牌力" value={d.situation} tone="gold" />
      <MiniBar label="风险" value={d.riskReward} tone="cyan" />
      <div className="pp-frag-meta">
        <span>#{d.handSeq != null ? d.handSeq : '?'}</span>
        <span>{d.position === 'late' ? '后位' : '前位'}</span>
        <span>{d.ts ? fmtTime(d.ts) : ''}</span>
      </div>
    </div>
  );
}

function PokerPuzzle() {
  const [decisions, setDecisions] = useState(() => getDecisions());
  const [compiled, setCompiled] = useState(null);
  const [lang, setLang] = useState('ts');
  const [copied, setCopied] = useState(false);

  const refresh = () => {
    setDecisions(getDecisions());
    setCompiled(null);
    setCopied(false);
  };

  // 回到本页时自动重读 localStorage（打完牌回来碎片即更新）
  useEffect(() => {
    const onFocus = () => setDecisions(getDecisions());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const stats = useMemo(() => analyzeDecisions(decisions), [decisions]);
  const n = stats.total;
  const canCompile = n >= MIN_FRAGMENTS;

  // 按街分组（街内新的在前），未知街进 other 抽屉
  const grouped = useMemo(() => {
    const g = {};
    STAGE_ORDER.forEach((st) => {
      g[st] = [];
    });
    const other = [];
    [...decisions]
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .forEach((d) => {
        if (STAGE_ORDER.indexOf(d.stage) >= 0) g[d.stage].push(d);
        else other.push(d);
      });
    if (other.length) g.other = other;
    return g;
  }, [decisions]);

  const shelfKeys = STAGE_ORDER.filter((st) => grouped[st] && grouped[st].length).concat(
    grouped.other ? ['other'] : []
  );

  const doCompile = () => {
    setCompiled(compileStrategy(decisions));
    setLang('ts');
    setCopied(false);
  };

  const codeText = compiled && compiled.ok ? (lang === 'ts' ? compiled.tsCode : compiled.pyCode) : '';

  const copyCode = async () => {
    if (!codeText) return;
    try {
      await navigator.clipboard.writeText(codeText);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = codeText;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        /* 剪贴板不可用时静默 */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="pp-wrap">
      {/* ── 头部：收集进度 ── */}
      <div className="pp-glass pp-hero">
        <div className="pp-hero-title">
          <ShardIcon size={20} />
          <span>决策拼图墙</span>
        </div>
        <div className="pp-hero-sub">
          午夜竞技场的每个决策都会沉淀为一枚碎片 · 攒够 {MIN_FRAGMENTS} 枚即可编译你的 decide()
        </div>
        <div className="pp-hero-progress">
          <span className="pp-hero-count">
            已收集 <b>{n}</b> 枚碎片
          </span>
          {n > 0 && (
            <span className="pp-hero-range">
              {stats.gameCount} 个牌局 · {stats.dateStart} 至 {stats.dateEnd}
            </span>
          )}
          <button className="pp-refresh" onClick={refresh}>
            刷新
          </button>
        </div>
        <div className="pp-progress-track">
          <i style={{ width: `${Math.min(100, (n / MIN_FRAGMENTS) * 100)}%` }} />
        </div>
        <div className="pp-progress-note">
          {canCompile ? '燃料充足，可以编译' : `编译燃料 ${Math.min(n, MIN_FRAGMENTS)}/${MIN_FRAGMENTS}`}
        </div>
      </div>

      {/* ── 碎片墙 ── */}
      {n === 0 ? (
        <div className="pp-glass pp-empty">
          <span className="pp-empty-icon">
            <ShardIcon size={34} />
          </span>
          <div className="pp-empty-title">墙上还没有碎片</div>
          <div className="pp-empty-sub">
            去「午夜竞技场」打几局 —— 你的每个弃牌、跟注、加注，都会变成这里的一枚碎片
          </div>
        </div>
      ) : (
        shelfKeys.map((st) => {
          const arr = grouped[st];
          const shown = arr.slice(0, MAX_PER_STAGE);
          return (
            <div className="pp-glass pp-shelf" key={st}>
              <div className="pp-shelf-head">
                <span className="pp-shelf-name">{st === 'other' ? '未知街' : STAGE_LABEL[st]}</span>
                <span className="pp-shelf-count">{arr.length} 枚</span>
              </div>
              <div className="pp-shelf-wall">
                {shown.map((d, i) => (
                  <Fragment key={`${d.ts || 0}-${d.handSeq || 0}-${i}`} d={d} />
                ))}
              </div>
              {arr.length > shown.length && (
                <div className="pp-shelf-more">还有 {arr.length - shown.length} 枚碎片在抽屉里</div>
              )}
            </div>
          );
        })
      )}

      {/* ── 策略编译器 ── */}
      <div className="pp-glass pp-compiler">
        <div className="pp-compiler-head">
          <div>
            <div className="pp-compiler-title">
              <BoltIcon size={15} />
              <span>策略编译器 · decide() v1</span>
            </div>
            <div className="pp-compiler-sub">纯本地聚合 · 零网络 · 每个数字都可溯源到碎片</div>
          </div>
          <button className="pp-compile-btn" onClick={doCompile} disabled={!canCompile}>
            编译我的策略
          </button>
        </div>

        {!canCompile && n > 0 && (
          <div className="pp-insufficient">
            碎片不够，再打几局 —— 已收集 {n}/{MIN_FRAGMENTS} 枚，还差 {MIN_FRAGMENTS - n} 枚点火
          </div>
        )}
        {!canCompile && n === 0 && (
          <div className="pp-insufficient">先在午夜竞技场留下 {MIN_FRAGMENTS} 个决策，再回来编译</div>
        )}

        {compiled && compiled.ok && (
          <div className="pp-result">
            {/* 画像参数 chips（每个都带计数溯源） */}
            <div className="pp-profile">
              <div className="pp-profile-chip">
                <label>激进度</label>
                <b>{(compiled.stats.aggression * 100).toFixed(0)}%</b>
                <span>
                  激进 {compiled.stats.aggN} / {compiled.stats.aggD} 手
                </span>
              </div>
              <div className="pp-profile-chip">
                <label>弃牌率</label>
                <b>{(compiled.stats.foldRate * 100).toFixed(0)}%</b>
                <span>
                  弃牌 {compiled.stats.counts.fold} / {compiled.stats.total} 手
                </span>
              </div>
              <div className="pp-profile-chip">
                <label>抗 Tilt</label>
                <b>{(compiled.stats.tiltResist * 100).toFixed(0)}%</b>
                <span>{compiled.stats.tiltNote}</span>
              </div>
              <div className="pp-profile-chip">
                <label>诈唬率</label>
                <b>{(compiled.stats.bluffRate * 100).toFixed(0)}%</b>
                <span>{compiled.stats.bluffNote}</span>
              </div>
              <div className="pp-profile-chip">
                <label>中位思考</label>
                <b>{(compiled.stats.medDecisionMs / 1000).toFixed(1)}s</b>
                <span>{compiled.stats.total} 条决策时长中位数</span>
              </div>
            </div>

            {/* 各街分布堆叠条 */}
            <div className="pp-stage-stats">
              <div className="pp-stage-legend">
                <span>
                  <i className="dot f" /> 弃牌
                </span>
                <span>
                  <i className="dot c" /> 跟过
                </span>
                <span>
                  <i className="dot r" /> 加全
                </span>
              </div>
              {STAGE_ORDER.filter((st) => compiled.stats.stageStats[st]).map((st) => {
                const t = compiled.stats.stageStats[st];
                return (
                  <div className="pp-stage-stat" key={st}>
                    <span className="pp-stage-stat-name">
                      {STAGE_LABEL[st]} {t.n} 手
                    </span>
                    <span className="pp-stage-stat-bars">
                      <i className="f" style={{ width: `${t.foldPct * 100}%` }} />
                      <i className="c" style={{ width: `${t.callPct * 100}%` }} />
                      <i className="r" style={{ width: `${t.raisePct * 100}%` }} />
                    </span>
                    <span className="pp-stage-stat-ms">{(t.medDecisionMs / 1000).toFixed(1)}s</span>
                  </div>
                );
              })}
            </div>

            {/* 代码区：TS 主 / Python 辅 */}
            <div className="pp-code-head">
              <div className="pp-lang-switch">
                <button className={lang === 'ts' ? 'on' : ''} onClick={() => setLang('ts')}>
                  TypeScript
                </button>
                <button className={lang === 'py' ? 'on' : ''} onClick={() => setLang('py')}>
                  Python
                </button>
              </div>
              <button className="pp-copy-btn" onClick={copyCode}>
                {copied ? '已复制' : '复制代码'}
              </button>
            </div>
            <pre className="pp-code">
              <code>{codeText}</code>
            </pre>
            <div className="pp-code-note">
              decide() 是通用决策函数：把 handStrength / potOdds 映射到任何小游戏的局势与赔率，即可复用你的画像
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PokerPuzzle;
