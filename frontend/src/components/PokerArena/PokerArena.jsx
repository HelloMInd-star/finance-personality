/**
 * 扑克竞技场 · PokerArena
 *
 * 蓝图第 5 站 5.1：用户下场 1v1，牌局真跑在 poker-egg Railway 引擎
 *  - 16 型 MBTI 人格对手上桌（ai_personality）
 *  - HTTP 轮询驱动（免 WebSocket）；轮到我时停轮询等操作
 *  - Kelly 面板：决策时显示引擎胜率/赔率/建议（引擎的标准答案）
 *  - 通用决策采集：每个操作落 poker_decisions（5.2 策略编译原材料）
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { storage } from '../../utils/storage';
import {
  arenaApi,
  OPPONENTS,
  OPPONENT_GROUPS,
  estimateHandStrength,
  buildDecisionLog,
  appendDecision,
  getDecisions,
} from './pokerArenaApi';
import './PokerArena.css';

const SUIT_ICON = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };
const STAGE_LABEL = { preflop: '翻前', flop: '翻牌', turn: '转牌', river: '河牌', showdown: '摊牌' };
const POLL_MS = 1800;

function CardFace({ card, hidden }) {
  if (hidden) return <div className="pa-card back">🂠</div>;
  const red = card.color === 'red' || card.suit === '♥' || card.suit === '♦';
  return (
    <div className={`pa-card ${red ? 'red' : 'black'}`}>
      <span className="pa-card-rank">{card.rank}</span>
      <span className="pa-card-suit">{SUIT_ICON[card.suit] || card.suit}</span>
    </div>
  );
}

function PokerArena() {
  const [phase, setPhase] = useState('lobby'); // lobby | playing | error
  const [opponent, setOpponent] = useState('INTJ');
  const [game, setGame] = useState(null); // { gameId, playerId, aiId }
  const [state, setState] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [raiseAmt, setRaiseAmt] = useState(40);
  const [handSeq, setHandSeq] = useState(0);
  const [streak, setStreak] = useState(0);
  const [logCount, setLogCount] = useState(() => getDecisions().length);

  const pollRef = useRef(null);
  const turnStartRef = useRef(0);
  const handOverHandledRef = useRef(false);
  const stateRef = useRef(null);
  stateRef.current = state;

  const me = state?.players?.find((p) => !p.is_ai);
  const ai = state?.players?.find((p) => p.is_ai);
  const myIndex = state?.players?.findIndex((p) => !p.is_ai) ?? 0;
  const isMyTurn =
    state && !state.hand_over && state.current_player === myIndex && me && !me.folded && !me.all_in;

  const toCall = useMemo(() => {
    if (!state || !me) return 0;
    return Math.max(0, (state.current_bet || 0) - (me.bet || 0));
  }, [state, me]);

  const myStrength = useMemo(
    () => (me?.hole_cards?.length ? estimateHandStrength(me.hole_cards, state?.board || []) : 0.5),
    [me, state]
  );

  // ── 开局 ──
  const startMatch = async () => {
    setBusy(true);
    setErr('');
    try {
      const name = storage.getUserState()?.name || '酒馆客';
      const created = await arenaApi.createGame(name, opponent);
      const g = { gameId: created.game_id, playerId: created.player_id, aiId: created.ai_player_id };
      setGame(g);
      await arenaApi.startGame(g.gameId);
      setHandSeq(1);
      setStreak(0);
      handOverHandledRef.current = false;
      setPhase('playing');
    } catch (e) {
      setErr(`开桌失败：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // ── 轮询 ──
  useEffect(() => {
    if (phase !== 'playing' || !game) return undefined;
    let cancelled = false;

    const tick = async () => {
      try {
        const s = await arenaApi.getState(game.gameId);
        if (cancelled) return;
        setState(s);
        const idx = s.players.findIndex((p) => !p.is_ai);
        const meP = s.players[idx];
        const myTurn = !s.hand_over && s.current_player === idx && meP && !meP.folded && !meP.all_in;
        if (myTurn) {
          if (!turnStartRef.current) {
            turnStartRef.current = Date.now();
            arenaApi.getAnalysis(game.gameId, game.playerId).then(setAnalysis).catch(() => setAnalysis(null));
          }
          return; // 轮到我：停轮询等操作
        }
        turnStartRef.current = 0;
        setAnalysis(null);
        pollRef.current = setTimeout(tick, POLL_MS);
      } catch (e) {
        if (!cancelled) pollRef.current = setTimeout(tick, POLL_MS * 2);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [phase, game]);

  // ── 一手结算：更新连势 ──
  useEffect(() => {
    if (!state?.hand_over || handOverHandledRef.current || !me) return;
    handOverHandledRef.current = true;
    const winners = state.winners || (state.winner ? [state.winner] : []);
    const iWon = winners.some((w) => (w.id || w.player_id) === me.id);
    setStreak((s) => (iWon ? (s >= 0 ? s + 1 : 1) : s <= 0 ? s - 1 : -1));
  }, [state, me]);

  // ── 操作 ──
  const act = async (actionType, amount = 0) => {
    if (!game || !state || busy) return;
    const s = stateRef.current;
    const meNow = s.players.find((p) => !p.is_ai);
    const decisionMs = turnStartRef.current ? Date.now() - turnStartRef.current : 0;
    const aiName = s.players.find((p) => p.is_ai)?.ai_personality || opponent;
    const position = meNow.is_dealer || meNow.is_sb ? 'late' : 'early';
    const callNow = Math.max(0, (s.current_bet || 0) - (meNow.bet || 0));

    const log = buildDecisionLog({
      gameId: game.gameId,
      handSeq,
      stage: s.stage,
      holeCards: meNow.hole_cards,
      board: s.board,
      pot: s.pot,
      toCall: callNow,
      myChips: meNow.chips,
      position,
      streak,
      decisionMs,
      action: actionType,
      raisePct: actionType === 'raise' || actionType === 'allin' ? (s.pot > 0 ? amount / s.pot : null) : null,
      opponent: aiName,
    });
    appendDecision(log);
    setLogCount((c) => c + 1);

    setBusy(true);
    try {
      await arenaApi.postAction(game.gameId, game.playerId, actionType, amount);
      turnStartRef.current = 0;
      setAnalysis(null);
      const ns = await arenaApi.getState(game.gameId);
      setState(ns);
      pollRef.current = setTimeout(async function poll() {
        try {
          const s2 = await arenaApi.getState(game.gameId);
          setState(s2);
          const idx = s2.players.findIndex((p) => !p.is_ai);
          const meP = s2.players[idx];
          const myTurn = !s2.hand_over && s2.current_player === idx && meP && !meP.folded && !meP.all_in;
          if (myTurn) {
            turnStartRef.current = Date.now();
            arenaApi.getAnalysis(game.gameId, game.playerId).then(setAnalysis).catch(() => setAnalysis(null));
            return;
          }
          pollRef.current = setTimeout(poll, POLL_MS);
        } catch (e) {
          pollRef.current = setTimeout(poll, POLL_MS * 2);
        }
      }, 600);
    } catch (e) {
      setErr(`操作失败：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // ── 下一手 ──
  const nextHand = async () => {
    if (!game) return;
    setBusy(true);
    try {
      await arenaApi.startGame(game.gameId);
      handOverHandledRef.current = false;
      setHandSeq((h) => h + 1);
      turnStartRef.current = 0;
      setAnalysis(null);
      const s = await arenaApi.getState(game.gameId);
      setState(s);
    } catch (e) {
      setErr(`开新一手失败：${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const backToLobby = () => {
    setPhase('lobby');
    setGame(null);
    setState(null);
    setAnalysis(null);
  };

  // ══════════ 渲染 ══════════
  if (phase === 'lobby') {
    return (
      <div className="pa-wrap">
        <div className="pa-lobby glass">
          <div className="pa-lobby-title">🌙 午夜竞技场</div>
          <div className="pa-lobby-sub">
            真实牌局 · poker-egg 人格引擎 · 每个对手都是一种打法人格
            <br />
            你的每个决策都会被记录，成为「策略编译」的原材料
          </div>
          {err && <div className="pa-err">{err}</div>}
          <div className="pa-opp-groups">
            {OPPONENT_GROUPS.map((g) => (
              <div className="pa-opp-group" key={g.group}>
                <div className="pa-opp-group-name">{g.group}</div>
                <div className="pa-opp-row">
                  {g.types.map((t) => (
                    <button
                      key={t}
                      className={`pa-opp-chip ${opponent === t ? 'on' : ''}`}
                      onClick={() => setOpponent(t)}
                    >
                      <b>{t}</b>
                      <span>{OPPONENTS[t].style}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button className="pa-start-btn" onClick={startMatch} disabled={busy}>
            {busy ? '开桌中…' : `⚔️ 挑战 ${opponent} · ${OPPONENTS[opponent].archetype}`}
          </button>
          {logCount > 0 && <div className="pa-log-note">已采集 {logCount} 条决策 · 策略编译燃料</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="pa-wrap">
      {/* ── 牌桌头 ── */}
      <div className="pa-head glass">
        <div className="pa-head-left">
          <span className="pa-head-title">第 {handSeq} 手 · {STAGE_LABEL[state?.stage] || state?.stage}</span>
          {streak !== 0 && (
            <span className={`pa-streak ${streak > 0 ? 'win' : 'lose'}`}>
              {streak > 0 ? `🔥 连赢 ${streak}` : `🌧 连输 ${Math.abs(streak)}`}
            </span>
          )}
        </div>
        <div className="pa-head-right">
          <span className="pa-pot">底池 <b>{state?.pot ?? 0}</b></span>
          <button className="pa-quit" onClick={backToLobby}>离开牌桌</button>
        </div>
      </div>

      {err && <div className="pa-err">{err}</div>}

      {/* ── 对手区 ── */}
      <div className="pa-seat glass ai">
        <div className="pa-seat-info">
          <span className="pa-seat-name">{ai?.name || `${opponent} · ${OPPONENTS[opponent].archetype}`}</span>
          <span className="pa-seat-style">{OPPONENTS[ai?.ai_personality || opponent]?.style}</span>
        </div>
        <div className="pa-seat-cards">
          {state?.hand_over && ai?.hole_cards?.length
            ? ai.hole_cards.map((c, i) => <CardFace key={i} card={c} />)
            : [0, 1].map((i) => <CardFace key={i} hidden />)}
        </div>
        <div className="pa-seat-chips">
          💰 {ai?.chips ?? '—'}
          {ai?.bet > 0 && <span className="pa-seat-bet">下注 {ai.bet}</span>}
          {ai?.folded && <span className="pa-tag folded">已弃牌</span>}
          {ai?.all_in && <span className="pa-tag allin">ALL-IN</span>}
          {!state?.hand_over && state?.current_player === 1 && <span className="pa-thinking">思考中…</span>}
        </div>
      </div>

      {/* ── 公共牌 ── */}
      <div className="pa-board glass">
        <div className="pa-board-cards">
          {(state?.board || []).map((c, i) => <CardFace key={i} card={c} />)}
          {!(state?.board || []).length && <span className="pa-board-empty">等待翻牌…</span>}
        </div>
      </div>

      {/* ── 结算条 ── */}
      {state?.hand_over && (
        <div className="pa-result glass">
          <div className="pa-result-text">
            {(state.winners || []).some((w) => (w.id || w.player_id) === me?.id)
              ? `🏆 你拿下底池 ${state.pot}`
              : `🌑 ${ai?.name} 拿下底池 ${state.pot}`}
          </div>
          <button className="pa-next-btn" onClick={nextHand} disabled={busy}>
            {busy ? '洗牌中…' : '▶ 下一手'}
          </button>
        </div>
      )}

      {/* ── 我的区 ── */}
      <div className={`pa-seat glass me ${isMyTurn ? 'myturn' : ''}`}>
        <div className="pa-seat-info">
          <span className="pa-seat-name">你</span>
          <span className="pa-seat-strength">
            牌力评估 {(myStrength * 100).toFixed(0)}%
            <i style={{ width: `${myStrength * 100}%` }} />
          </span>
        </div>
        <div className="pa-seat-cards">
          {(me?.hole_cards || []).map((c, i) => <CardFace key={i} card={c} />)}
        </div>
        <div className="pa-seat-chips">
          💰 {me?.chips ?? '—'}
          {me?.bet > 0 && <span className="pa-seat-bet">下注 {me.bet}</span>}
          {me?.folded && <span className="pa-tag folded">已弃牌</span>}
          {me?.all_in && <span className="pa-tag allin">ALL-IN</span>}
        </div>
      </div>

      {/* ── Kelly 面板（轮到我） ── */}
      {isMyTurn && analysis && (
        <div className="pa-kelly glass">
          <div className="pa-kelly-title">🧠 引擎视角 · {analysis.hand_name || '胜率演算'}</div>
          <div className="pa-kelly-grid">
            <div><label>真胜率</label><b>{analysis.win_rate != null ? `${(analysis.win_rate * 100).toFixed(1)}%` : '—'}</b></div>
            <div><label>底池赔率</label><b>{analysis.pot_odds != null ? `${(analysis.pot_odds * 100).toFixed(1)}%` : '—'}</b></div>
            <div><label>Kelly 建议</label><b>{analysis.kelly_fraction != null ? `${(analysis.kelly_fraction * 100).toFixed(0)}%` : '—'}</b></div>
            <div><label>建议注额</label><b>{analysis.kelly_bet != null ? analysis.kelly_bet : '—'}</b></div>
          </div>
        </div>
      )}

      {/* ── 操作区 ── */}
      {isMyTurn && !state?.hand_over && (
        <div className="pa-actions glass">
          <button className="pa-act fold" onClick={() => act('fold')} disabled={busy}>弃牌</button>
          {toCall === 0 ? (
            <button className="pa-act check" onClick={() => act('check')} disabled={busy}>过牌</button>
          ) : (
            <button className="pa-act call" onClick={() => act('call')} disabled={busy}>跟注 {toCall}</button>
          )}
          <div className="pa-raise-box">
            <input
              type="range"
              min={state?.min_raise || 20}
              max={Math.max(me?.chips || 20, state?.min_raise || 20)}
              step={state?.big_blind || 20}
              value={raiseAmt}
              onChange={(e) => setRaiseAmt(Number(e.target.value))}
            />
            <button className="pa-act raise" onClick={() => act('raise', raiseAmt)} disabled={busy}>
              加注 {raiseAmt}
            </button>
          </div>
          <button className="pa-act allin" onClick={() => act('allin', me?.chips || 0)} disabled={busy}>
            ALL-IN
          </button>
        </div>
      )}

      {!isMyTurn && !state?.hand_over && (
        <div className="pa-waiting">
          {me?.folded ? '你已弃牌，等待本手结束…' : '对手行动中…'}
        </div>
      )}
    </div>
  );
}

export default PokerArena;
