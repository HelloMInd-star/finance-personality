/**
 * GalaxyConstellation · 入口星系动画
 *
 * 22 颗星体环绕中央种子：
 *   - 4 条轨道环按四元素分组（火内 → 水外）· 各环缓慢自转
 *   - 每颗星体 = 一张大阿尔卡纳 ↔ 一个星体 / 星座
 *   - 圆形发光 · 呼吸 twinkle · hover 高亮 + 符号显现
 *   - 点击星体 → 揭示对应塔罗牌（modal 卡片 · 正逆位可切换）
 *
 * 视觉语言：深空紫金 + 元素派色 + 磨砂玻璃
 * 工程：单 Canvas + RAF · DPR 适配 · 卸载取消 RAF · hex 颜色（addColorStop 用 rgba）
 *
 * 从 Y.Mine 人格调酒系统迁移 · TS → JSX（Tailwind → 自定义 CSS）
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { TAROT_ASTRO_MAP } from '../../utils/tarot/tarotAstroMap.js';
import { deriveTarotCard } from '../../utils/tarot/tarotCustomization.js';
import TarotCardModal from './TarotCardModal.jsx';
import './GalaxyConstellation.css';

/** hex → rgba · 仅 #rrggbb */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

export default function GalaxyConstellation({ size = 480 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const entriesRef = useRef(TAROT_ASTRO_MAP);
  const hoverRef = useRef(null);
  const sizeRef = useRef(size);
  const positionsRef = useRef([]);
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(null);
  selectedRef.current = selected;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const s = Math.max(260, Math.min(rect.width, rect.height));
      sizeRef.current = s;
      canvas.width = s * dpr;
      canvas.height = s * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const start = performance.now();

    const draw = (now) => {
      const s = sizeRef.current;
      const cx = s / 2;
      const cy = s / 2;
      const t = (now - start) / 1000;

      ctx.clearRect(0, 0, s, s);

      // ── 背景星尘 · 缓慢漂移 + twinkle ──
      ctx.save();
      for (let i = 0; i < 64; i++) {
        const a = (i * 137.5) * (Math.PI / 180);
        const rad = (s / 2) * (0.25 + 0.75 * ((i * 13) % 100) / 100);
        const x = cx + Math.cos(a + t * 0.02) * rad;
        const y = cy + Math.sin(a + t * 0.02) * rad;
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.8 + i));
        ctx.globalAlpha = 0.18 * tw;
        ctx.fillStyle = '#e8e0ff';
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // ── 4 条轨道环 ──
      const ringCount = 4;
      const baseR = s * 0.13;
      const ringGap = (s / 2 - baseR - 10) / (ringCount - 1);
      const ringRadii = [0, 1, 2, 3].map((i) => baseR + i * ringGap);

      ctx.save();
      ctx.lineWidth = 1;
      for (let i = 0; i < ringCount; i++) {
        ctx.strokeStyle = 'rgba(155, 123, 212, 0.12)';
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadii[i], 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // ── 中央种子 · 呼吸光晕 ──
      const corePulse = 0.6 + 0.4 * Math.sin(t * 0.9);
      const coreR = s * 0.045;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3.2);
      coreGrad.addColorStop(0, `rgba(240, 198, 116, ${0.9 * corePulse})`);
      coreGrad.addColorStop(0.4, 'rgba(240, 198, 116, 0.22)');
      coreGrad.addColorStop(1, 'rgba(240, 198, 116, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0c674';
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // ── 22 颗星体 ──
      const positions = [];
      // 各环自转速度 · 内环快外环慢
      const ringSpeed = [0.05, 0.038, 0.026, 0.016];
      const hoveredId = hoverRef.current?.entry.tarotId;
      const selectedId = selectedRef.current?.entry.tarotId;

      for (const entry of entriesRef.current) {
        const ringR = ringRadii[entry.ring];
        const ang = entry.angle + t * ringSpeed[entry.ring];
        const x = cx + Math.cos(ang) * ringR;
        const y = cy + Math.sin(ang) * ringR;
        const isHover = hoveredId === entry.tarotId;
        const isSelected = selectedId === entry.tarotId;
        const twinkle = 0.7 + 0.3 * Math.sin(t * 1.6 + entry.tarotId);
        const dotR = isHover || isSelected ? 6.5 : 4.5;
        const glowR = (isHover || isSelected ? 18 : 11) * twinkle;

        // 光晕
        const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        grad.addColorStop(0, hexToRgba(entry.color, 0.85 * twinkle));
        grad.addColorStop(0.5, hexToRgba(entry.color, 0.28));
        grad.addColorStop(1, hexToRgba(entry.color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();

        // 实心星点 · hover/选中时偏暖白
        ctx.fillStyle = isHover || isSelected ? '#fff8e0' : entry.color;
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();

        // hover/选中时显现符号
        if (isHover || isSelected) {
          ctx.fillStyle = '#1a1024';
          ctx.font = 'bold 9px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(entry.symbol, x, y + 0.5);
        }

        positions.push({ entry, x, y, r: glowR });
      }

      positionsRef.current = positions;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  // 命中检测 · 命中则高亮 + tooltip
  const handleMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let found = null;
    for (const p of positionsRef.current) {
      if (Math.hypot(p.x - mx, p.y - my) <= p.r) {
        found = { entry: p.entry, x: p.x, y: p.y };
        break;
      }
    }
    hoverRef.current = found;
    setHover(found);
    canvas.style.cursor = found ? 'pointer' : 'default';
  }, []);

  const handleLeave = useCallback(() => {
    hoverRef.current = null;
    setHover(null);
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'default';
  }, []);

  const handleClick = useCallback(() => {
    const h = hoverRef.current;
    if (!h) return;
    setSelected({ entry: h.entry, reversed: false });
  }, []);

  return (
    <div className="galaxy-constellation">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onClick={handleClick}
        className="galaxy-canvas"
      />

      {/* hover tooltip · 牌名 · 星体名 */}
      {hover && (
        <div
          className="galaxy-tooltip"
          style={{ left: hover.x, top: hover.y - 14 }}
        >
          <span className="galaxy-tooltip-tarot">{hover.entry.tarotName}</span>
          <span className="galaxy-tooltip-sep">·</span>
          <span className="galaxy-tooltip-astro">{hover.entry.celestialName}</span>
        </div>
      )}

      {/* 选中 → 塔罗牌卡片揭示 */}
      {selected && (
        <TarotCardModal
          entry={selected.entry}
          reversed={selected.reversed}
          onToggleReversed={() =>
            setSelected((s) => (s ? { ...s, reversed: !s.reversed } : s))
          }
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
