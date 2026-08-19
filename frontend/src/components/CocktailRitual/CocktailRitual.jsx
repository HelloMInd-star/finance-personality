/**
 * 今夜酒单 · CocktailRitual（蓝图第 3 站）
 *
 * demos cocktail 卡片仪式 → finance 数据驱动活页面：
 *  - 向量自动读取：baseVector 行为向量（真实）/ MBTI 面具向量（自评）
 *  - 双面选酒：面具想喝的 vs 真实想喝的 —— 与护照页叙事闭环
 *  - 时段加成：timeEngine 七时段（深夜复杂酒款加分等）
 *  - 行动闭环：选酒沉淀 bartenderSessions，回流护照真实面
 *
 * 算留本地：推荐全程本地余弦相似度，不消耗 LLM。
 */

import React, { useMemo, useState } from 'react';
import { message } from 'antd';
import { storage } from '../../utils/storage';
import { resolveTimeSlot } from '../../utils/timeEngine';
import { bridgeBaseVector, getMaskVector, DIMS } from '../PassportModule/passportData';
import { recommendTonight, getMatchReasons } from './cocktailData';
import './CocktailRitual.css';

function CocktailRitual() {
  const slot = useMemo(() => resolveTimeSlot(), []);

  // 双面向量：真实（行为采集）优先可用时默认；面具（MBTI 自评）总有
  const mbti = storage.getUserState()?.currentMbti || 'INTJ';
  const trueVec = useMemo(() => bridgeBaseVector(storage.getBaseVector()), []);
  const maskVec = useMemo(() => getMaskVector(mbti), [mbti]);

  const [side, setSide] = useState(trueVec ? 'true' : 'mask');
  const [stage, setStage] = useState('idle'); // idle | revealed
  const [result, setResult] = useState(null); // { picks, userFlavor }
  const [openId, setOpenId] = useState(null);
  const [chosenId, setChosenId] = useState(null);

  const activeVec = side === 'true' ? trueVec : maskVec;

  const handleDraw = (targetSide = side) => {
    const vec = targetSide === 'true' ? trueVec : maskVec;
    if (!vec) return;
    setResult(recommendTonight(vec, slot.key, 3));
    setStage('revealed');
    setOpenId(null);
    setChosenId(null);
  };

  const handleSwitchSide = (s) => {
    setSide(s);
    if (stage === 'revealed') handleDraw(s);
  };

  const handleChoose = (c) => {
    setChosenId(c.id);
    storage.addBartenderSession({
      type: 'tonight_pick',
      cocktailId: c.id,
      cocktailName: c.name,
      cocktailNameEn: c.nameEn,
      score: Math.round(c.score * 100),
      side,
      slot: slot.key,
      mbti,
    });
    message.success(`「${c.name}」已记入你的酒馆档案`);
  };

  return (
    <div className="ritual-page">
      {/* 头部 */}
      <header className="ritual-header cr-reveal">
        <h2 className="ritual-title">🍸 今夜酒单</h2>
        <p className="ritual-subtitle">从你的人格向量里，舀出今晚最对的三杯</p>
      </header>

      {/* 时段 bar */}
      <div className="ritual-slot cr-reveal" style={{ animationDelay: '0.06s', borderColor: `${slot.auraColor}55` }}>
        <div className="ritual-slot-main">
          <span className="ritual-slot-dot" style={{ background: slot.auraColor, boxShadow: `0 0 12px ${slot.auraColor}` }} />
          <span className="ritual-slot-label">{slot.label} · {slot.orbState}</span>
        </div>
        <div className="ritual-slot-poem">{slot.poem}</div>
        <div className="ritual-slot-bio">{slot.biologyNote}</div>
      </div>

      {/* 双面切换 + 向量来源 */}
      <div className="ritual-source cr-reveal" style={{ animationDelay: '0.12s' }}>
        {trueVec ? (
          <div className="ritual-side-switch">
            <button
              className={`ritual-side-btn ritual-side-btn--true ${side === 'true' ? 'is-active' : ''}`}
              onClick={() => handleSwitchSide('true')}
            >
              🌑 按真实人格选
            </button>
            <button
              className={`ritual-side-btn ritual-side-btn--mask ${side === 'mask' ? 'is-active' : ''}`}
              onClick={() => handleSwitchSide('mask')}
            >
              🎭 按社交面具选
            </button>
          </div>
        ) : (
          <div className="ritual-source-note">
            当前按 <strong>MBTI 自评（{mbti}）</strong>调配——去调酒/对局沉淀行为向量后，可解锁「按真实人格选」
          </div>
        )}
        {trueVec && (
          <div className="ritual-source-note">
            {side === 'true'
              ? '向量来源：行为采集（调酒/对局/反馈回路）—— 你的行为想喝这些'
              : `向量来源：MBTI 自评（${mbti}）—— 你口中的自己想喝这些`}
          </div>
        )}
        <div className="ritual-vec-mini">
          {DIMS.map((d) => (
            <span key={d.key} className="ritual-vec-chip" style={{ borderColor: `${d.color}44`, color: d.color }}>
              {d.icon} {Math.round((activeVec?.[d.key] ?? 0.5) * 100)}
            </span>
          ))}
        </div>
      </div>

      {/* 仪式按钮 */}
      {stage === 'idle' && (
        <div className="ritual-draw-zone cr-reveal" style={{ animationDelay: '0.18s' }}>
          <button className="ritual-draw-btn" onClick={() => handleDraw()}>
            <span className="ritual-draw-btn-main">🌙 今夜为我精选</span>
            <span className="ritual-draw-btn-sub">从 20 款酒中，取最合你向量的三杯</span>
          </button>
        </div>
      )}

      {/* 酒卡 */}
      {stage === 'revealed' && result && (
        <>
          <div className="ritual-picks">
            {result.picks.map((c, i) => {
              const reasons = getMatchReasons(c, result.userFlavor, slot.key);
              const open = openId === c.id;
              const chosen = chosenId === c.id;
              return (
                <div
                  key={`${side}-${c.id}`}
                  className={`ritual-card cr-reveal ${chosen ? 'is-chosen' : ''}`}
                  style={{ animationDelay: `${0.1 + i * 0.15}s`, '--aura': c.auraColor }}
                >
                  <div className="ritual-card-rank">#{i + 1}</div>
                  <div className="ritual-card-head">
                    <div className="ritual-card-name">{c.name}</div>
                    <div className="ritual-card-name-en">{c.nameEn}</div>
                    <div className="ritual-card-tagline">{c.tagline}</div>
                  </div>
                  <div className="ritual-card-meta">
                    <span className="ritual-aura-dot" style={{ background: c.auraColor }} />
                    {c.base} / {c.baseEn} · {c.glass} · {c.difficultyLabel}
                  </div>
                  <div className="ritual-card-sub">ABV {c.abv} · {c.category}</div>

                  <div className="ritual-card-score">
                    <div className="ritual-score-bar">
                      <div className="ritual-score-fill" style={{ width: `${Math.round(c.score * 100)}%`, background: c.auraColor }} />
                    </div>
                    <span className="ritual-score-val">{Math.round(c.score * 100)}%</span>
                  </div>

                  <div className="ritual-reasons">
                    {reasons.map((r, j) => <span key={j} className="ritual-reason-chip">{r}</span>)}
                  </div>

                  <div className="ritual-card-actions">
                    <button className="ritual-btn" onClick={() => setOpenId(open ? null : c.id)}>
                      {open ? '收起 ▲' : '配方与故事 ▼'}
                    </button>
                    <button
                      className={`ritual-btn ritual-btn--pick ${chosen ? 'is-chosen' : ''}`}
                      onClick={() => handleChoose(c)}
                      disabled={!!chosenId && !chosen}
                    >
                      {chosen ? '✓ 今夜就它' : '就它了'}
                    </button>
                  </div>

                  {open && (
                    <div className="ritual-card-detail">
                      <p className="ritual-story">{c.story}</p>
                      <div className="ritual-detail-title">配方</div>
                      <ul className="ritual-ingredients">
                        {c.ingredients.map((ing, j) => (
                          <li key={j}><span>{ing.name}</span><span className="ritual-ing-amt">{ing.amt}</span></li>
                        ))}
                      </ul>
                      <div className="ritual-detail-title">步骤</div>
                      <ol className="ritual-steps">
                        {c.steps.map((s, j) => <li key={j}>{s}</li>)}
                      </ol>
                      <div className="ritual-card-foot">饰以 {c.garnish} · 气质 {c.moods.join(' / ')}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="ritual-after cr-reveal" style={{ animationDelay: '0.6s' }}>
            <button className="ritual-btn" onClick={() => { setStage('idle'); setResult(null); setChosenId(null); }}>
              ↩ 回到吧台
            </button>
            <span className="ritual-after-note">
              选中的酒会沉淀进你的行为档案——它也在悄悄校准护照的真实面
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default CocktailRitual;
