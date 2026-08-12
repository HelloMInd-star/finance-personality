/**
 * 脉轮测试模块
 * 三阶段流程:引导 → 21 题答题 → 雷达图结果
 */
import React, { useState, useMemo } from 'react';
import { Button, Progress, Tag, message } from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { QUESTIONS, CHAKRAS, TOTAL_QUESTIONS } from './chakraData.js';
import { generateResult, saveResult } from './chakraEngine.js';
import './ChakraTest.css';

export default function ChakraTest() {
  const [stage, setStage] = useState('intro'); // intro | test | result
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState(new Array(TOTAL_QUESTIONS).fill(null));
  const [result, setResult] = useState(null);

  // === 流程控制 ===
  const handleStart = () => {
    setStage('test');
    setCurrentQ(0);
    setAnswers(new Array(TOTAL_QUESTIONS).fill(null));
  };

  const handleAnswer = (score) => {
    const next = [...answers];
    next[currentQ] = score;
    setAnswers(next);

    if (currentQ < TOTAL_QUESTIONS - 1) {
      setTimeout(() => setCurrentQ(currentQ + 1), 180);
    } else {
      // 完成所有题目
      const r = generateResult(next);
      setResult(r);
      saveResult(r);
      setTimeout(() => setStage('result'), 400);
      message.success('脉轮测试完成');
    }
  };

  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ(currentQ - 1);
  };

  const handleRestart = () => {
    setStage('intro');
    setCurrentQ(0);
    setAnswers(new Array(TOTAL_QUESTIONS).fill(null));
    setResult(null);
  };

  // === 渲染 ===

  // 阶段 1: 引导页
  if (stage === 'intro') {
    return (
      <div className="chakra-test">
        <div className="ct-intro">
          <div className="ct-intro-icon">🌀</div>
          <h1 className="ct-intro-title">七脉轮能量测试</h1>
          <p className="ct-intro-desc">
            通过 21 道题，绘制你的七脉轮能量分布图
          </p>
          <p className="ct-intro-sub">
            每个脉轮 3 题，覆盖海底轮 · 脐轮 · 太阳轮 · 心轮 · 喉轮 · 眉心轮 · 顶轮
          </p>

          <div className="ct-chakra-preview">
            {CHAKRAS.map((c) => (
              <div className="ct-chakra-dot" key={c.key} title={`${c.name} · ${c.desc}`}>
                <span className="ct-chakra-orb" style={{ background: c.color }} />
                <span className="ct-chakra-name">{c.name}</span>
              </div>
            ))}
          </div>

          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            onClick={handleStart}
            className="ct-start-btn"
          >
            开始脉轮测试
          </Button>
        </div>
      </div>
    );
  }

  // 阶段 2: 答题
  if (stage === 'test') {
    const q = QUESTIONS[currentQ];
    const progress = ((currentQ + 1) / TOTAL_QUESTIONS) * 100;
    const selected = answers[currentQ];
    const chakra = CHAKRAS.find((c) => c.key === q.chakra);

    return (
      <div className="chakra-test">
        <div className="ct-test">
          <div className="ct-progress">
            <Progress
              percent={progress}
              strokeColor={{ from: '#7B4CFF', to: '#D4AF37' }}
              format={() => `${currentQ + 1} / ${TOTAL_QUESTIONS}`}
            />
          </div>

          <div className="ct-question-card">
            <div className="ct-question-meta">
              <Tag color="purple" className="ct-chakra-tag" style={{ borderColor: chakra.color }}>
                <span className="ct-tag-orb" style={{ background: chakra.color }} />
                {chakra.name}
              </Tag>
              <span className="ct-question-num">Q{currentQ + 1}</span>
            </div>
            <h2 className="ct-question-text">{q.text}</h2>

            <div className="ct-options">
              {q.options.map((opt) => (
                <button
                  key={opt.score}
                  className={`ct-option ${selected === opt.score ? 'selected' : ''}`}
                  onClick={() => handleAnswer(opt.score)}
                >
                  <span className="ct-option-score">{opt.score}</span>
                  <span className="ct-option-text">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ct-test-footer">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={handlePrev}
              disabled={currentQ === 0}
            >
              上一题
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 阶段 3: 结果
  if (stage === 'result' && result) {
    return <ChakraResultView result={result} onRestart={handleRestart} />;
  }

  return null;
}

// ========================================
// 结果页:雷达图 + 脉轮状态列表 + 平衡建议
// ========================================

function ChakraResultView({ result, onRestart }) {
  const radarOption = useMemo(() => buildRadarOption(result), [result]);

  const handleShare = () => {
    const lines = result.details.map(
      (d) => `${d.chakra.name}: ${d.status.label}(${d.score}分)`
    );
    const text = `🌀 我的七脉轮能量分布\n${lines.join('\n')}\n最强: ${
      CHAKRAS.find((c) => c.key === result.dominantChakra).name
    } · 最弱: ${CHAKRAS.find((c) => c.key === result.weakestChakra).name}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => message.success('结果已复制到剪贴板'));
    }
  };

  const handleSave = () => {
    message.success('已保存到用户画像');
  };

  return (
    <div className="chakra-test">
      <div className="ct-result">
        <div className="ct-result-header">
          <div className="ct-result-title">🌀 你的七脉轮能量分布</div>
          <div className="ct-result-subtitle">
            最强脉轮：
            <span style={{ color: getColor(result.dominantChakra) }}>
              {CHAKRAS.find((c) => c.key === result.dominantChakra).name}
            </span>
            {'  ·  '}
            最弱脉轮：
            <span style={{ color: getColor(result.weakestChakra) }}>
              {CHAKRAS.find((c) => c.key === result.weakestChakra).name}
            </span>
          </div>
        </div>

        {/* 七脉轮雷达图 */}
        <div className="ct-radar-card">
          <ReactECharts
            option={radarOption}
            style={{ height: 380, width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
        </div>

        {/* 各脉轮状态列表 */}
        <div className="ct-chakra-list">
          <div className="ct-list-title">各脉轮状态</div>
          {result.details.map((d) => (
            <div className="ct-chakra-row" key={d.chakra.key}>
              <span className="ct-row-orb" style={{ background: d.chakra.color }} />
              <span className="ct-row-name">{d.chakra.name}</span>
              <Tag className="ct-row-status" style={statusStyle(d.status)}>
                {d.status.label}
              </Tag>
              <span className="ct-row-score">{d.score}分</span>
              <span className="ct-row-hint">{d.hint}</span>
            </div>
          ))}
        </div>

        {/* 平衡建议 */}
        <div className="ct-balance-card">
          <div className="ct-balance-title">📊 整体平衡建议</div>
          <div className="ct-balance-text">{result.balanceSummary}</div>
        </div>

        {/* 操作按钮 */}
        <div className="ct-actions">
          <Button icon={<SaveOutlined />} className="ct-action-btn" onClick={handleSave}>
            保存画像
          </Button>
          <Button icon={<ShareAltOutlined />} className="ct-action-btn" onClick={handleShare}>
            分享结果
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            className="ct-action-btn ct-restart-btn"
            onClick={onRestart}
          >
            重新测试
          </Button>
        </div>
      </div>
    </div>
  );
}

// ========================================
// 工具函数
// ========================================

function getColor(chakraKey) {
  return CHAKRAS.find((c) => c.key === chakraKey)?.color || '#7B4CFF';
}

function statusStyle(status) {
  return {
    color: status.color,
    borderColor: status.color + '60',
    background: status.color + '15',
  };
}

/**
 * 构建 ECharts 雷达图配置
 */
function buildRadarOption(result) {
  const indicators = CHAKRAS.map((c) => ({
    name: c.name,
    max: 12,
    color: c.color,
  }));

  const values = CHAKRAS.map((c) => result.scores[c.key] || 0);

  return {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: 'rgba(15,10,40,0.95)',
      borderColor: 'rgba(139,92,246,0.3)',
      textStyle: { color: '#fff' },
      formatter: () => {
        const lines = CHAKRAS.map((c, i) =>
          `${c.name}: ${values[i]}分`
        );
        return lines.join('<br/>');
      },
    },
    radar: {
      indicator: indicators,
      shape: 'polygon',
      splitNumber: 4,
      center: ['50%', '52%'],
      radius: '68%',
      axisName: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        fontWeight: 600,
        formatter: (name) => {
          const c = CHAKRAS.find((x) => x.name === name);
          return c ? `{orb|●}${name}` : name;
        },
        rich: {
          orb: { fontSize: 14 },
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(139,92,246,0.18)',
          width: 1,
        },
      },
      splitArea: {
        areaStyle: {
          color: [
            'rgba(139,92,246,0.02)',
            'rgba(139,92,246,0.04)',
            'rgba(139,92,246,0.06)',
            'rgba(139,92,246,0.08)',
          ],
        },
      },
      axisLine: {
        lineStyle: { color: 'rgba(139,92,246,0.25)' },
      },
      axisIndicator: {
        show: true,
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: values,
            name: '七脉轮能量',
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: {
              width: 2,
              color: '#D4AF37',
            },
            itemStyle: {
              color: '#D4AF37',
              borderColor: '#fff',
              borderWidth: 1,
            },
            areaStyle: {
              color: {
                type: 'radial',
                x: 0.5, y: 0.5, r: 0.8,
                colorStops: [
                  { offset: 0, color: 'rgba(212,175,55,0.35)' },
                  { offset: 1, color: 'rgba(123,76,255,0.15)' },
                ],
              },
            },
            label: {
              show: true,
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              formatter: (params) => params.value,
              backgroundColor: 'rgba(15,10,40,0.7)',
              borderRadius: 8,
              padding: [2, 6],
            },
          },
        ],
      },
    ],
  };
}
