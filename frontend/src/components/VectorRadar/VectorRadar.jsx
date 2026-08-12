/**
 * VectorRadar · 11 维向量雷达图（多向量对比）
 *
 * 用于在调酒结果页可视化：
 *  - 基础向量（持久化值，金色）
 *  - 校准向量（基础 + feedbackHistory 校准，紫色）
 *  - 动态向量（校准 + 时段偏移，玫红，当前推荐用）
 *
 * 视觉：深空紫金，磨砂玻璃容器
 * 数据：11 维（通用 6 + 金融 5）
 */

import React, { useRef, useEffect, useMemo } from 'react';
import * as echarts from 'echarts';
import { VECTOR_DIMENSIONS } from '../../utils/vectorMapper';
import './VectorRadar.css';

// 主题注册（只注册一次）
let themeRegistered = false;
function ensureTheme() {
  if (themeRegistered) return;
  echarts.registerTheme('ymine-vector-dark', {
    backgroundColor: 'transparent',
    textStyle: { color: 'rgba(255,255,255,0.85)' },
    legend: { textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: 11 } },
    radar: {
      axisName: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(168,85,247,0.18)' } },
      splitArea: {
        areaStyle: {
          color: ['rgba(168,85,247,0.02)', 'rgba(168,85,247,0.05)'],
        },
      },
      axisLine: { lineStyle: { color: 'rgba(168,85,247,0.25)' } },
    },
    tooltip: {
      backgroundColor: 'rgba(15,10,30,0.92)',
      borderColor: 'rgba(212,175,55,0.4)',
      textStyle: { color: '#fff', fontSize: 12 },
    },
  });
  themeRegistered = true;
}

// ============================================================
// 主组件
// ============================================================

/**
 * @param {Object} props
 * @param {number[]} props.baseVector - 基础向量（11 维）
 * @param {number[]} [props.calibratedVector] - 校准向量（可选）
 * @param {number[]} [props.dynamicVector] - 动态向量（可选，当前推荐用）
 * @param {string} [props.title] - 标题
 * @param {number} [props.size] - 高度（px）
 */
export default function VectorRadar({
  baseVector,
  calibratedVector,
  dynamicVector,
  title = '人格向量',
  size = 360,
}) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  // 构建数据系列
  const series = useMemo(() => {
    const result = [];
    if (Array.isArray(baseVector)) {
      result.push({
        name: '基础向量',
        values: baseVector.slice(0, 11).map((v) => +v.toFixed(3)),
        color: '#D4AF37', // 金色
        areaColor: 'rgba(212, 175, 55, 0.15)',
      });
    }
    if (Array.isArray(calibratedVector)) {
      result.push({
        name: '校准向量',
        values: calibratedVector.slice(0, 11).map((v) => +v.toFixed(3)),
        color: '#8b5cf6', // 紫色
        areaColor: 'rgba(139, 92, 246, 0.15)',
      });
    }
    if (Array.isArray(dynamicVector)) {
      result.push({
        name: '动态向量',
        values: dynamicVector.slice(0, 11).map((v) => +v.toFixed(3)),
        color: '#ec4899', // 玫红
        areaColor: 'rgba(236, 72, 153, 0.15)',
      });
    }
    return result;
  }, [baseVector, calibratedVector, dynamicVector]);

  // 构建 ECharts option
  const option = useMemo(() => {
    const indicators = VECTOR_DIMENSIONS.map((d) => ({
      name: d.label,
      max: 1,
      color: d.color,
    }));

    const seriesData = series.map((s) => ({
      value: s.values,
      name: s.name,
      lineStyle: { color: s.color, width: 2 },
      areaStyle: {
        color: s.areaColor,
      },
      itemStyle: { color: s.color },
      symbol: 'circle',
      symbolSize: 5,
      emphasis: {
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.4 },
      },
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.seriesType !== 'radar') return '';
          const data = params.value;
          let html = `<div style="font-weight:600;margin-bottom:6px;color:${params.color}">${params.name}</div>`;
          VECTOR_DIMENSIONS.forEach((d, i) => {
            const v = data[i];
            const pct = Math.round((v ?? 0) * 100);
            const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
            html += `<div style="display:flex;align-items:center;gap:6px;font-size:11px;margin:2px 0">
              <span style="color:${d.color};width:56px">${d.label}</span>
              <span style="opacity:0.5;font-family:monospace">${bar}</span>
              <span style="font-weight:600;color:${d.color};width:36px;text-align:right">${pct}%</span>
            </div>`;
          });
          return html;
        },
      },
      legend: {
        data: series.map((s) => s.name),
        bottom: 8,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
      },
      radar: {
        indicator: indicators,
        radius: '62%',
        center: ['50%', '48%'],
        startAngle: 90,
        splitNumber: 4,
        axisName: {
          color: 'rgba(255,255,255,0.8)',
          fontSize: 11,
          fontWeight: 500,
          formatter: (name) => {
            const dim = VECTOR_DIMENSIONS.find((d) => d.label === name);
            if (!dim) return name;
            // 基础向量值
            const baseVal = baseVector?.[dim.index] ?? 0;
            return `{name|${name}} {val|${Math.round(baseVal * 100)}}`;
          },
          rich: {
            name: { color: 'rgba(255,255,255,0.8)', fontSize: 11, padding: [0, 4] },
            val: { color: '#D4AF37', fontSize: 10, fontWeight: 600 },
          },
        },
        splitArea: {
          areaStyle: {
            color: ['rgba(168,85,247,0.03)', 'rgba(168,85,247,0.06)'],
          },
        },
      },
      series: [
        {
          type: 'radar',
          data: seriesData,
        },
      ],
    };
  }, [series, baseVector]);

  // 初始化 + 更新
  useEffect(() => {
    if (!ref.current) return;
    ensureTheme();
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, 'ymine-vector-dark');
    }
    chartRef.current.setOption(option, true);

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [option]);

  // 卸载时 dispose
  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  // 无数据兜底
  if (series.length === 0) {
    return (
      <div className="vector-radar vector-radar--empty" style={{ height: size }}>
        <span className="vector-radar__empty-text">暂无向量数据</span>
      </div>
    );
  }

  return (
    <div className="vector-radar">
      <div className="vector-radar__header">
        <span className="vector-radar__icon">◆</span>
        <div>
          <div className="vector-radar__eyebrow">Persona Vector</div>
          <h4 className="vector-radar__title">{title}</h4>
        </div>
      </div>
      <div
        ref={ref}
        className="vector-radar__chart"
        style={{ width: '100%', height: size }}
      />
      <div className="vector-radar__legend-hint">
        {series.map((s) => (
          <span key={s.name} className="vector-radar__legend-item">
            <span
              className="vector-radar__legend-dot"
              style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
