/**
 * 调酒板块入口 - 双板块切换
 *   1. 企业家人格分子调酒生成器（6 题测试 → 人格酒 + 3D 分子结构）
 *   2. MBTI 企业家酒局（6 步沉浸式酒局场景）
 */
import React, { useState, useMemo, Suspense, lazy } from 'react';
import { Button, Progress, Tag, Space, message } from 'antd';
import {
  ArrowRightOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  SaveOutlined,
  ShareAltOutlined,
  ExperimentOutlined,
  ExperimentFilled,
  CoffeeOutlined,
} from '@ant-design/icons';
import { QUESTIONS } from './personaData.js';
import { getMatchResult } from './personaEngine.js';
import { MOLECULES } from '../MoleculeViewer/moleculeData.js';
import MbtParty from './MbtParty.jsx';
import FeedbackRating from '../FeedbackRating/FeedbackRating';
import FeedbackTimeline from '../FeedbackTimeline/FeedbackTimeline';
import VectorRadar from '../VectorRadar/VectorRadar';
import GalaxyConstellation from '../TarotGalaxy/GalaxyConstellation';
import { useAppStore } from '../../store/appStore';
import { storage } from '../../utils/storage';
import { calibrateVector } from '../../utils/feedbackEngine';
import './PersonaBartender.css';

// 懒加载 3D 组件(只在结果页加载,减少首屏负担)
const MoleculeViewer = lazy(() => import('../MoleculeViewer/MoleculeViewer.jsx'));
// 蓝图第 3 站：今夜酒单（卡片仪式 · 数据驱动）
const CocktailRitual = lazy(() => import('../CocktailRitual/CocktailRitual.jsx'));

const TOTAL_QUESTIONS = 6;

const TABS = [
  { key: 'tonight', label: '今夜酒单', icon: <span>🍸</span>, desc: '读你的人格向量 → 今夜精选三杯' },
  { key: 'molecule', label: '分子调酒生成器', icon: <ExperimentFilled />, desc: '6 题人格测试 → 人格酒 + 3D 分子结构' },
  { key: 'party', label: 'MBTI 企业家酒局', icon: <CoffeeOutlined />, desc: '选酒入场 → 对话模拟 → 酒局人格报告' },
];

export default function PersonaBartender() {
  const [activeTab, setActiveTab] = useState('tonight');

  return (
    <div className="persona-bartender">
      <div className="pb-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`pb-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <span className="pb-tab-icon">{t.icon}</span>
            <span className="pb-tab-label">{t.label}</span>
          </button>
        ))}
      </div>
      {activeTab === 'tonight' ? (
        <Suspense fallback={null}>
          <CocktailRitual />
        </Suspense>
      ) : activeTab === 'molecule' ? (
        <MoleculeBartender />
      ) : (
        <MbtParty />
      )}
    </div>
  );
}

/**
 * 板块 1：企业家人格分子调酒生成器
 * 6 题人格测试 → 匹配 20 种企业家人格 → 生成人格酒 + 3D 分子结构
 */
function MoleculeBartender() {
  const [stage, setStage] = useState('intro'); // intro | test | result
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);

  // === 反馈回路：读取 baseVector + feedbackHistory ===
  const data = useAppStore((s) => s.data);
  const refresh = useAppStore((s) => s.refresh);
  const feedbackHistory = data?.feedbackHistory || [];
  const baseVector = useMemo(() => {
    const stored = storage.getBaseVector();
    return Array.isArray(stored) && stored.length === 11 ? stored : null;
  }, [data]);
  const calibratedVector = useMemo(() => {
    const base = baseVector || new Array(11).fill(0.5);
    return calibrateVector(base, feedbackHistory);
  }, [baseVector, feedbackHistory]);

  // === 流程控制 ===
  const handleStart = () => {
    setStage('test');
    setCurrentQ(0);
    setAnswers([]);
  };

  const handleAnswer = (choice) => {
    const newAnswers = [...answers];
    newAnswers[currentQ] = choice;
    setAnswers(newAnswers);

    if (currentQ < TOTAL_QUESTIONS - 1) {
      setTimeout(() => setCurrentQ(currentQ + 1), 200);
    } else {
      // 完成所有题目,计算结果
      const matchResult = getMatchResult(newAnswers);
      setResult(matchResult);
      setTimeout(() => setStage('result'), 400);
    }
  };

  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ(currentQ - 1);
  };

  const handleRestart = () => {
    setStage('intro');
    setCurrentQ(0);
    setAnswers([]);
    setResult(null);
  };

  // === 保存/分享 ===
  const handleSave = () => {
    if (!result) return;
    const saved = JSON.parse(localStorage.getItem('persona_cocktails') || '[]');
    saved.push({
      ...result,
      savedAt: Date.now(),
    });
    localStorage.setItem('persona_cocktails', JSON.stringify(saved));
    message.success('人格酒已保存到本地');
  };

  const handleShare = () => {
    if (!result) return;
    const text = `我的企业家人格酒：${result.molecule.name}（匹配度 ${result.matchPercent}%）\n${result.story}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        message.success('结果已复制到剪贴板');
      });
    } else {
      message.info(text);
    }
  };

  // === 渲染 ===

  // 阶段 1: 引导页
  if (stage === 'intro') {
    return (
      <div className="pb-content">
        <div className="pb-intro">
          {/* 星系入口 · 22 颗星体 ↔ 22 张塔罗 · 点击揭示 */}
          <div className="pb-intro-galaxy">
            <GalaxyConstellation />
            <p className="pb-intro-galaxy-hint">
              22 颗星 · 22 张塔罗 · 点一颗，看它的牌
            </p>
          </div>

          <div className="pb-intro-icon">🍸</div>
          <h1 className="pb-intro-title">企业家人格 · 分子调酒生成器</h1>
          <p className="pb-intro-desc">
            通过 6 个问题，找到属于你的企业家人格酒
          </p>
          <p className="pb-intro-sub">
            完成测试后，你将获得一杯「人格酒」+ 可保存的分子结构图形
          </p>
          <Button
            type="primary"
            size="large"
            icon={<ExperimentOutlined />}
            onClick={handleStart}
            className="pb-start-btn"
          >
            开始人格测试
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

    return (
      <div className="pb-content">
        <div className="pb-test">
          {/* 进度条 */}
          <div className="pb-progress">
            <Progress
              percent={progress}
              strokeColor={{ from: '#a855f7', to: '#ffd700' }}
              format={() => `${currentQ + 1} / ${TOTAL_QUESTIONS}`}
            />
          </div>

          {/* 题目 */}
          <div className="pb-question-card">
            <div className="pb-question-num">Q{currentQ + 1}</div>
            <h2 className="pb-question-text">{q.text}</h2>

            <div className="pb-options">
              <button
                className={`pb-option ${selected === 'A' ? 'selected' : ''}`}
                onClick={() => handleAnswer('A')}
              >
                <span className="pb-option-label">A</span>
                <span className="pb-option-text">{q.optionA.label}</span>
              </button>
              <button
                className={`pb-option ${selected === 'B' ? 'selected' : ''}`}
                onClick={() => handleAnswer('B')}
              >
                <span className="pb-option-label">B</span>
                <span className="pb-option-text">{q.optionB.label}</span>
              </button>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="pb-test-footer">
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
    const { molecule, matchPercent, mbti, story } = result;

    return (
      <div className="pb-content">
        <div className="pb-result">
          {/* 头部：人格信息 */}
          <div className="pb-result-header">
            <div className="pb-result-title">🍸 你的人格酒</div>
            <div className="pb-result-persona">
              <span className="pb-person-name">{molecule.relatedPerson}</span>
              <Tag color="purple" className="pb-mbti-tag">{molecule.relatedPersona}</Tag>
            </div>
            <div className="pb-match-bar">
              <span className="pb-match-label">匹配度</span>
              <span className="pb-match-value">{matchPercent}%</span>
            </div>
          </div>

          {/* 3D 分子结构 */}
          <div className="pb-molecule-section">
            <Suspense fallback={<div className="pb-molecule-loading">分子加载中…</div>}>
              <MoleculeViewer
                moleculeKey={result.moleculeKey}
                height={380}
                autoRotate={true}
                showInfo={true}
              />
            </Suspense>
          </div>

          {/* 调酒配方 */}
          <div className="pb-recipe-card">
            <div className="pb-recipe-title">调酒配方</div>
            <div className="pb-recipe-grid">
              <div className="pb-recipe-item">
                <span className="pb-recipe-label">基酒</span>
                <span className="pb-recipe-value">{molecule.relatedSpirit}</span>
              </div>
              <div className="pb-recipe-item">
                <span className="pb-recipe-label">风味</span>
                <span className="pb-recipe-value">{molecule.flavor}</span>
              </div>
              <div className="pb-recipe-item">
                <span className="pb-recipe-label">温度</span>
                <span className="pb-recipe-value">{molecule.temperature}</span>
              </div>
              <div className="pb-recipe-item">
                <span className="pb-recipe-label">呈现</span>
                <span className="pb-recipe-value">{molecule.presentation}</span>
              </div>
            </div>
          </div>

          {/* 故事文本 */}
          <div className="pb-story-card">
            <div className="pb-story-text">"{story}"</div>
          </div>

          {/* 回味评分：喝后评分 → 向量校准 → 推荐优化 */}
          <FeedbackRating
            recipeId={`molecule-${result.moleculeKey}`}
            scene="persona-bartender"
            onSubmitted={() => refresh()}
          />

          {/* 向量雷达图 · 反馈回路可视化（有 baseVector 时展示） */}
          {baseVector && (
            <VectorRadar
              baseVector={baseVector}
              calibratedVector={calibratedVector}
              title="人格向量 · 调酒基线"
              size={340}
            />
          )}

          {/* 评分历史时间线 · 有评分时展示 */}
          {feedbackHistory.length > 0 && (
            <FeedbackTimeline history={feedbackHistory} maxItems={5} />
          )}

          {/* 操作按钮 */}
          <div className="pb-actions">
            <Button
              icon={<SaveOutlined />}
              onClick={handleSave}
              className="pb-action-btn"
            >
              保存图形
            </Button>
            <Button
              icon={<ShareAltOutlined />}
              onClick={handleShare}
              className="pb-action-btn"
            >
              分享结果
            </Button>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleRestart}
              className="pb-action-btn pb-restart-btn"
            >
              重新测试
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
