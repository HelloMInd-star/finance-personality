/**
 * 人格护照 · PassportPage
 *
 * 蓝图第 2 站：社交面具 × 真实人格 双面检视
 *  - 面具面（金）：自评 MBTI → 原型映射 —— 你说的你
 *  - 真实面（青）：baseVector 行为采集 → 桥接六维 —— 你的行为说的你
 *  - 差异检视：六维对照 + 裂合指数 + 规则洞察（人格实验室 IP）
 *
 * 数据全部本地（算留本地）：storage.userState.currentMbti / storage.baseVector
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../../utils/storage';
import {
  DIMS,
  ARCHETYPES,
  ALL_MBTI,
  HOT_DELTA,
  bridgeBaseVector,
  getMaskVector,
  getMaskArchetype,
  findClosestArchetype,
  computeDiff,
  buildInsight,
  levelOf,
  makeDocNo,
} from './passportData';
import './PassportPage.css';

// 六维条（两面复用，accent 仅用于标注，条色用维度自身颜色）
function VectorRows({ vec }) {
  return (
    <div className="pp-vec-list">
      {DIMS.map((d) => {
        const pct = Math.round((vec[d.key] ?? 0.5) * 100);
        return (
          <div className="pp-vec-row" key={d.key}>
            <div className="pp-vec-meta">
              <span className="pp-vec-name" style={{ color: d.color }}>
                <span>{d.icon}</span>
                {d.name} <small>{d.en}</small>
              </span>
              <span className="pp-vec-val">{pct}%</span>
            </div>
            <div className="pp-vec-bar">
              <div className="pp-vec-fill" style={{ width: `${pct}%`, background: d.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PassportPage() {
  const navigate = useNavigate();

  const [mbti, setMbti] = useState(() => storage.getUserState()?.currentMbti || 'INTJ');
  const [baseVector] = useState(() => storage.getBaseVector());
  const [flipped, setFlipped] = useState(false);

  const data = useMemo(() => {
    const maskVec = getMaskVector(mbti);
    const maskArch = getMaskArchetype(mbti);
    const trueVec = bridgeBaseVector(baseVector);
    const trueArch = trueVec ? findClosestArchetype(trueVec) : null;
    const diff = maskVec && trueVec ? computeDiff(maskVec, trueVec) : null;
    const insight = diff ? buildInsight(diff) : null;
    const docNo = maskVec && trueVec ? makeDocNo(maskVec, trueVec) : null;
    return { maskVec, maskArch, trueVec, trueArch, diff, insight, docNo };
  }, [mbti, baseVector]);

  const issueDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const handlePickMbti = (m) => {
    setMbti(m);
    storage.setUserState({ currentMbti: m });
    if (flipped) setFlipped(false);
  };

  const { maskVec, maskArch, trueVec, trueArch, diff, insight, docNo } = data;

  return (
    <div className="passport-page">
      <div className="passport-inner">
        {/* 头部 */}
        <header className="passport-header pp-reveal">
          <h1 className="passport-title">🪪 人格护照</h1>
          <p className="passport-subtitle">社交面具 × 真实人格 · 社交是学习的结果，不是本能</p>
        </header>

        {/* 双面护照卡 */}
        <div className="pp-flip-zone pp-reveal" style={{ animationDelay: '0.08s' }}>
          <div className="pp-flip-scene">
            <div className={`pp-flip-card ${flipped ? 'is-flipped' : ''}`}>
              {/* 面具面（金） */}
              <div className="pp-face pp-face--mask">
                <span className="pp-face-tag">社交面具 · 你口中的你</span>
                {maskArch && (
                  <>
                    <div className="pp-arch-head">
                      <div className="pp-arch-emoji">{maskArch.emoji}</div>
                      <div className="pp-arch-name" style={{ color: maskArch.color }}>{maskArch.name}</div>
                      <div className="pp-arch-mbti">{mbti} · MBTI 自评映射</div>
                      <span className="pp-arch-desc">{maskArch.desc}</span>
                    </div>
                    <VectorRows vec={maskVec} />
                  </>
                )}
                <div className="pp-face-foot">
                  <div className="pp-src">SOURCE: SELF-REPORT / MBTI</div>
                  <div>面具是你的自画像——它重要，但它只是开场白</div>
                </div>
              </div>

              {/* 真实面（青） */}
              <div className="pp-face pp-face--true">
                <span className="pp-face-tag">真实人格 · 你的行为说的你</span>
                {trueVec && trueArch ? (
                  <>
                    <div className="pp-arch-head">
                      <div className="pp-arch-emoji">{trueArch.emoji}</div>
                      <div className="pp-arch-name" style={{ color: trueArch.color }}>{trueArch.name}</div>
                      <div className="pp-arch-mbti">行为采集 · 最近邻原型</div>
                      <span className="pp-arch-desc">{trueArch.desc}</span>
                    </div>
                    <VectorRows vec={trueVec} />
                    <div className="pp-face-foot">
                      <div className="pp-src">SOURCE: BEHAVIOR / BASE-VECTOR 11D</div>
                      <div>由调酒、对局与反馈回路沉淀的行为向量桥接而成</div>
                    </div>
                  </>
                ) : (
                  <div className="pp-empty">
                    <span className="pp-empty-emoji">🌑</span>
                    <div className="pp-empty-title">这一面还是空白</div>
                    <div className="pp-empty-desc">
                      真实人格不由问卷填写，由行为沉淀。
                      去调一杯酒、打一局牌，系统会把你的每个选择
                      翻译成这一面的向量。
                    </div>
                    <div className="pp-empty-actions">
                      <button className="pp-btn pp-btn--cyan" onClick={() => navigate('/bartender')}>🍸 去调酒</button>
                      <button className="pp-btn" onClick={() => navigate('/poker')}>♠️ 去对局</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button className="pp-flip-toggle" onClick={() => setFlipped((f) => !f)}>
            {flipped ? '⇄ 翻回社交面具' : '⇄ 翻到真实人格'}
          </button>
        </div>

        {/* 差异检视（双面齐备才展开） */}
        {diff && insight && (
          <>
            <h2 className="pp-section-title pp-reveal">🎭 双面检视</h2>
            <p className="pp-section-sub pp-reveal">|Δ| ≥ {HOT_DELTA} 的维度会被点亮——那是面具最用力的地方</p>

            <div className="pp-diff-card pp-reveal" style={{ animationDelay: '0.05s' }}>
              <div className="pp-diff-head">
                <span>维度</span>
                <span style={{ color: 'var(--pp-gold)' }}>面具</span>
                <span style={{ color: 'var(--pp-cyan)' }}>真实</span>
                <span>Δ</span>
              </div>
              {diff.deltas.map((row) => {
                const d = DIMS.find((x) => x.key === row.key);
                const hot = Math.abs(row.delta) >= HOT_DELTA;
                return (
                  <div className={`pp-diff-row ${hot ? 'is-hot' : ''}`} key={row.key}>
                    <span className="pp-diff-dim" style={{ color: d.color }}>
                      <span>{d.icon}</span>{d.name} <small>{d.en}</small>
                    </span>
                    <span className="pp-diff-side">
                      <span className="pp-mini-bar">
                        <span className="pp-mini-fill" style={{ display: 'block', width: `${row.mask}%`, background: 'var(--pp-gold)' }} />
                      </span>
                      <span className="pp-mini-val">{row.mask}</span>
                    </span>
                    <span className="pp-diff-side">
                      <span className="pp-mini-bar">
                        <span className="pp-mini-fill" style={{ display: 'block', width: `${row.true}%`, background: 'var(--pp-cyan)' }} />
                      </span>
                      <span className="pp-mini-val">{row.true}</span>
                    </span>
                    <span className={`pp-diff-delta ${hot ? 'pp-diff-delta--hot' : 'pp-diff-delta--ok'}`}>
                      {row.delta > 0 ? '+' : ''}{row.delta}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pp-insight pp-reveal" style={{ animationDelay: '0.1s' }}>
              <div className="pp-insight-persona">「{insight.persona}」</div>
              <div className="pp-insight-sentences">
                {insight.sentences.map((s, i) => <p key={i}>{s}</p>)}
              </div>
              <div className="pp-fissure">
                <div className="pp-fissure-meta">
                  <span>裂合指数 {Math.round(diff.absMean)}</span>
                  <span>{levelOf(diff.absMean)}</span>
                </div>
                <div className="pp-fissure-bar">
                  <div className="pp-fissure-fill" style={{ width: `${Math.min(100, (diff.absMean / 40) * 100)}%` }} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* MBTI 自评选择器 */}
        <h2 className="pp-section-title pp-reveal">✍️ 你的自评</h2>
        <p className="pp-section-sub pp-reveal">换一个 MBTI，面具面即时重绘——它是你对自己的陈述，会被如实记录</p>
        <div className="pp-mbti-grid pp-reveal" style={{ animationDelay: '0.05s' }}>
          {ALL_MBTI.map((m) => (
            <div
              key={m}
              className={`pp-mbti-chip ${m === mbti ? 'is-active' : ''}`}
              onClick={() => handlePickMbti(m)}
            >
              {m}
            </div>
          ))}
        </div>

        {/* 原型图谱 */}
        <h2 className="pp-section-title pp-reveal">🧬 人格原型图谱</h2>
        <div className="pp-legend pp-reveal">
          <span><i style={{ background: 'var(--pp-gold)' }} />面具原型</span>
          <span><i style={{ background: 'var(--pp-cyan)' }} />真实原型</span>
        </div>
        <div className="pp-arch-grid pp-reveal" style={{ animationDelay: '0.05s' }}>
          {ARCHETYPES.map((a) => {
            const isMask = maskArch?.id === a.id;
            const isTrue = trueArch?.id === a.id;
            return (
              <div
                key={a.id}
                className={`pp-arch-chip ${isMask ? 'is-mask' : ''} ${isTrue ? 'is-true' : ''}`}
              >
                <span className="pp-ac-emoji">{a.emoji}</span>
                <div className="pp-ac-name" style={{ color: a.color }}>{a.name}</div>
                <div className="pp-ac-desc">{a.desc}</div>
                {(isMask || isTrue) && (
                  <div className="pp-ac-mark" style={{ color: isMask ? 'var(--pp-gold)' : 'var(--pp-cyan)' }}>
                    {isMask && isTrue ? '◆ 双面同栖' : isMask ? '◆ 面具所在' : '◆ 真实所在'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 护照详情 */}
        <h2 className="pp-section-title pp-reveal">📜 护照详情</h2>
        <div className="pp-detail-card pp-reveal" style={{ animationDelay: '0.05s' }}>
          <div className="pp-detail-row">
            <span className="pp-detail-label">证件编号</span>
            <span className="pp-detail-value pp-detail-value--id">{docNo || 'YM-____-____'}</span>
          </div>
          <div className="pp-detail-row">
            <span className="pp-detail-label">签发日期</span>
            <span className="pp-detail-value">{issueDate}</span>
          </div>
          <div className="pp-detail-row">
            <span className="pp-detail-label">面具来源</span>
            <span className="pp-detail-value">MBTI 自评 · {mbti}</span>
          </div>
          <div className="pp-detail-row">
            <span className="pp-detail-label">真实来源</span>
            <span className="pp-detail-value">{trueVec ? '行为向量 11D（调酒/对局/反馈）' : '未采集'}</span>
          </div>
          <div className="pp-detail-row">
            <span className="pp-detail-label">签发机构</span>
            <span className="pp-detail-value">Y.MINE 人格实验室</span>
          </div>
        </div>

        <p className="pp-footnote">MIDNIGHT TAVERN · 人格护照 —— 你示人的样子，和你居住的样子，都值得被签发</p>
      </div>
    </div>
  );
}

export default PassportPage;
