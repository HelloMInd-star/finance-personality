import React, { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';

let themeRegistered = false;
function ensureTheme() {
  if (themeRegistered) return;
  echarts.registerTheme('ymine-dark', {
    backgroundColor: 'transparent',
    textStyle: { color: 'rgba(255,255,255,0.85)' },
    legend: { textStyle: { color: 'rgba(255,255,255,0.7)' } },
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
      borderColor: 'rgba(168,85,247,0.4)',
      textStyle: { color: '#fff' },
    },
  });
  themeRegistered = true;
}

export default function PersonaRadar({
  dimensions,
  size = 280,
  showHistory = false,
  className = '',
}) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  const DIMS = [
    { k: 'risk', label: '风险', color: '#22d3ee' },
    { k: 'speed', label: '速度', color: '#f472b6' },
    { k: 'grit', label: '韧性', color: '#34d399' },
    { k: 'social', label: '社交', color: '#a855f7' },
    { k: 'emotionStability', label: '情绪', color: '#f59e0b' },
    { k: 'openness', label: '探索', color: '#60a5fa' },
  ];

  const buildOption = useCallback(() => {
    const indicators = DIMS.map((d) => ({
      name: d.label,
      max: 1,
      color: d.color,
    }));

    const values = DIMS.map((d) => Math.min(1, Math.max(0, dimensions?.[d.k] ?? 0.5)));

    const avgColor = `rgba(168, 85, 247, 0.3)`;
    const maxIdx = values.indexOf(Math.max(...values));
    const maxDim = DIMS[maxIdx];

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.seriesType === 'radar') {
            const data = params.value;
            let html = `<div style="font-weight:600;margin-bottom:4px">${params.name}</div>`;
            DIMS.forEach((d, i) => {
              const v = data[i];
              const pct = Math.round(v * 100);
              const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
              html += `<div style="display:flex;align-items:center;gap:6px;font-size:11px">
                <span style="color:${d.color};width:32px">${d.label}</span>
                <span style="opacity:0.5;font-family:monospace">${bar}</span>
                <span style="font-weight:600;color:${d.color}">${pct}%</span>
              </div>`;
            });
            html += `<div style="margin-top:4px;color:${maxDim.color};font-size:11px">
              ⚡ 主导维度：${maxDim.label}
            </div>`;
            return html;
          }
          return '';
        },
      },
      radar: {
        indicator: indicators,
        radius: '65%',
        center: ['50%', '52%'],
        startAngle: 90,
        splitNumber: 4,
        axisName: {
          color: 'rgba(255,255,255,0.8)',
          fontSize: 12,
          fontWeight: 500,
          formatter: (name, indicator) => {
            const dim = DIMS.find((d) => d.label === name);
            const val = dimensions?.[dim?.k] ?? 0;
            return `{name|${name}} {val|${Math.round(val * 100)}}`;
          },
          rich: {
            name: { color: 'rgba(255,255,255,0.8)', fontSize: 12, padding: [0, 4] },
            val: { color: '#d4af37', fontSize: 11, fontWeight: 600 },
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
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#a855f7', width: 2 },
          areaStyle: {
            color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
              { offset: 0, color: 'rgba(168, 85, 247, 0.1)' },
              { offset: 1, color: 'rgba(168, 85, 247, 0.4)' },
            ]),
          },
          itemStyle: {
            color: (params) => {
              const dim = DIMS[params.dataIndex];
              return dim?.color || '#a855f7';
            },
          },
          emphasis: {
            lineStyle: { width: 3 },
            areaStyle: { opacity: 0.6 },
            itemStyle: { borderColor: '#fff', borderWidth: 2 },
          },
          data: [
            {
              value: values,
              name: '当前人格',
              // 标记最高和最低点
              markPoint: {
                symbol: 'pin',
                symbolSize: 40,
                data: [
                  { type: 'max', name: '峰值', itemStyle: { color: '#d4af37' } },
                  { type: 'min', name: '谷值', itemStyle: { color: '#fb7185' } },
                ],
              },
            },
          ],
        },
      ],
      graphic: showHistory
        ? [
            {
              type: 'text',
              left: 'center',
              bottom: 10,
              style: {
                text: `主导维度：${maxDim.label} ${Math.round(values[maxIdx] * 100)}%`,
                fill: maxDim.color,
                fontSize: 12,
                fontWeight: 600,
              },
            },
          ]
        : [],
    };
  }, [dimensions, showHistory]);

  useEffect(() => {
    if (!ref.current) return;
    ensureTheme();
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, 'ymine-dark');
    }
    const opt = buildOption();
    if (opt) chartRef.current.setOption(opt, true);

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [buildOption]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`persona-radar ${className}`}
      style={{ width: '100%', height: size }}
    />
  );
}
