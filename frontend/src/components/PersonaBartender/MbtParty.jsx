/**
 * MBTI 企业家酒局 · 完整方案
 * 6 步流程:进入酒局 → 选基酒 → 饮用方式 → 雪茄 → 对话 → 报告
 */
import React, { useState, Suspense, lazy } from 'react';
import { Button, Progress, Tag, message } from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  SPIRITS,
  DRINK_STYLES,
  CIGAR_OPTIONS,
  SCENE_INTRO,
  PARTY_STEPS,
} from './partyData.js';
import {
  getRandomTopic,
  generateDialogueScene,
  matchPartyPersona,
  generateReport,
  saveToUserProfile,
} from './partyEngine.js';

// 懒加载 3D 分子组件 (只在报告页加载,减少首屏负担)
const MoleculeViewer = lazy(() => import('../MoleculeViewer/MoleculeViewer.jsx'));

import './MbtParty.css';

export default function MbtParty() {
  const [step, setStep] = useState(0); // 0-5
  const [spirit, setSpirit] = useState(null);
  const [drinkStyle, setDrinkStyle] = useState(null);
  const [cigar, setCigar] = useState(null);
  const [topic, setTopic] = useState(null);
  const [choice, setChoice] = useState(null);
  const [report, setReport] = useState(null);

  const reset = () => {
    setStep(0);
    setSpirit(null);
    setDrinkStyle(null);
    setCigar(null);
    setTopic(null);
    setChoice(null);
    setReport(null);
  };

  // 步骤 5: 生成报告
  const generateResult = (topicId, choiceKey) => {
    const result = matchPartyPersona(spirit, drinkStyle, cigar, topicId, choiceKey);
    const rpt = generateReport(result);
    setReport(rpt);
    saveToUserProfile(result);
    setStep(5);
  };

  // === 渲染各步骤 ===

  // Step 0: 进入酒局
  if (step === 0) {
    return (
      <div className="mbt-party">
        <div className="mbt-scene">
          <div className="mbt-scene-icon">🚪</div>
          <div className="mbt-scene-text">{SCENE_INTRO}</div>
          <Button
            type="primary"
            size="large"
            onClick={() => setStep(1)}
            className="mbt-next-btn"
          >
            走向吧台
          </Button>
        </div>
        <PartyProgress step={step} />
      </div>
    );
  }

  // Step 1: 选择基酒
  if (step === 1) {
    return (
      <div className="mbt-party">
        <div className="mbt-step-header">
          <h2>🥃 今晚，你选哪一杯？</h2>
          <p>每种基酒对应一种企业家人格</p>
        </div>
        <div className="mbt-spirit-grid">
          {SPIRITS.map((s) => (
            <button
              key={s.key}
              className={`mbt-spirit-card ${spirit === s.key ? 'selected' : ''}`}
              onClick={() => {
                setSpirit(s.key);
                setStep(2);
              }}
              style={{ borderColor: spirit === s.key ? s.color : undefined }}
            >
              <span className="mbt-spirit-icon">{s.icon}</span>
              <span className="mbt-spirit-name">{s.name}</span>
              <span className="mbt-spirit-mbti">{s.mbtiTypes.join(' / ')}</span>
              <span className="mbt-spirit-traits">{s.traits.join(' · ')}</span>
            </button>
          ))}
        </div>
        <PartyProgress step={step} onBack={() => setStep(0)} />
      </div>
    );
  }

  // Step 2: 饮用方式
  if (step === 2) {
    const selectedSpirit = SPIRITS.find((s) => s.key === spirit);
    return (
      <div className="mbt-party">
        <div className="mbt-step-header">
          <h2>🧊 怎么喝？</h2>
          <p>你选了 {selectedSpirit.icon} {selectedSpirit.name}，饮用方式反映你的认知风格</p>
        </div>
        <div className="mbt-option-row">
          {DRINK_STYLES.map((d) => (
            <button
              key={d.key}
              className={`mbt-option-card ${drinkStyle === d.key ? 'selected' : ''}`}
              onClick={() => {
                setDrinkStyle(d.key);
                setStep(3);
              }}
            >
              <span className="mbt-option-icon">{d.icon}</span>
              <span className="mbt-option-name">{d.name}</span>
              <span className="mbt-option-tag">{d.cognitiveStyle}</span>
              <span className="mbt-option-desc">{d.desc}</span>
            </button>
          ))}
        </div>
        <PartyProgress step={step} onBack={() => setStep(1)} />
      </div>
    );
  }

  // Step 3: 雪茄
  if (step === 3) {
    return (
      <div className="mbt-party">
        <div className="mbt-step-header">
          <h2>🚬 来一支雪茄吗？</h2>
          <p>侍者递来一支雪茄，你的选择反映时间偏好</p>
        </div>
        <div className="mbt-option-row two-col">
          {CIGAR_OPTIONS.map((c) => (
            <button
              key={c.key}
              className={`mbt-option-card ${cigar === c.key ? 'selected' : ''}`}
              onClick={() => {
                setCigar(c.key);
                // 随机选取话题并进入对话
                setTopic(getRandomTopic());
                setStep(4);
              }}
            >
              <span className="mbt-option-icon">{c.icon}</span>
              <span className="mbt-option-name">{c.name}</span>
              <span className="mbt-option-tag">{c.timePreference}</span>
              <span className="mbt-option-desc">{c.desc}</span>
            </button>
          ))}
        </div>
        <PartyProgress step={step} onBack={() => setStep(2)} />
      </div>
    );
  }

  // Step 4: 对话环节
  if (step === 4 && topic) {
    const sceneText = generateDialogueScene(spirit, topic);
    return (
      <div className="mbt-party">
        <div className="mbt-step-header">
          <h2>💬 酒局对话</h2>
        </div>
        <div className="mbt-dialogue-scene">{sceneText}</div>
        <div className="mbt-dialogue-options">
          {topic.options.map((opt) => (
            <button
              key={opt.key}
              className={`mbt-dialogue-option ${choice === opt.key ? 'selected' : ''}`}
              onClick={() => {
                setChoice(opt.key);
                generateResult(topic.id, opt.key);
              }}
            >
              <span className="mbt-dialogue-letter">{opt.key}</span>
              <span className="mbt-dialogue-text">{opt.text}</span>
              <Tag className="mbt-dialogue-style">{opt.style}</Tag>
            </button>
          ))}
        </div>
        <PartyProgress step={step} onBack={() => setStep(3)} />
      </div>
    );
  }

  // Step 5: 酒局报告
  if (step === 5 && report) {
    const handleShare = () => {
      const text = `我的MBTI企业家酒局人格：${report.personaType} · ${report.personaName}\n选酒：${report.spiritName}\n角色：${report.roleName}\n"${report.roleDesc}"`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => message.success('报告已复制'));
      }
    };

    const mol = report.molecule || {};

    return (
      <div className="mbt-party">
        <div className="mbt-report">
          <div className="mbt-report-header">
            <div className="mbt-report-title">🍸 你的酒局人格</div>
            <div className="mbt-report-spirit">
              {report.spiritIcon} {report.spiritName}
            </div>
          </div>

          <div className="mbt-report-body">
            <div className="mbt-report-row">
              <span className="mbt-label">对应人格</span>
              <Tag color="purple">{report.personaType}</Tag>
              <span className="mbt-value">{report.personaName}</span>
              <span className="mbt-match">匹配度 {report.matchPercent}%</span>
            </div>

            <div className="mbt-report-row">
              <span className="mbt-label">对话风格</span>
              <span className="mbt-value">{report.dialogueStyle}</span>
            </div>

            <div className="mbt-report-row">
              <span className="mbt-label">认知风格</span>
              <span className="mbt-value">{report.cognitiveStyle}</span>
              <span className="mbt-label" style={{ marginLeft: 16 }}>时间偏好</span>
              <span className="mbt-value">{report.timePreference}</span>
            </div>

            <div className="mbt-report-row">
              <span className="mbt-label">酒局角色</span>
              <Tag color="gold">{report.roleName}</Tag>
            </div>

            {/* 3D 分子结构 */}
            {report.moleculeKey && (
              <div className="mbt-report-molecule">
                <div className="mbt-molecule-head">
                  <span className="mbt-molecule-title">🧬 人格分子结构</span>
                  <span className="mbt-molecule-formula">{mol.formula}</span>
                </div>
                <div className="mbt-molecule-desc">{mol.desc}</div>
                <Suspense fallback={<div className="mbt-molecule-loading">分子加载中…</div>}>
                  <MoleculeViewer
                    moleculeKey={report.moleculeKey}
                    height={340}
                    autoRotate={true}
                    showInfo={false}
                  />
                </Suspense>
              </div>
            )}

            {/* 调酒配方详情 */}
            <div className="mbt-report-recipe">
              <div className="mbt-recipe-title">🍹 调酒配方</div>
              <div className="mbt-recipe-grid">
                <div className="mbt-recipe-item">
                  <span className="mbt-recipe-label">分子名称</span>
                  <span className="mbt-recipe-value">{mol.name}</span>
                </div>
                <div className="mbt-recipe-item">
                  <span className="mbt-recipe-label">化学式</span>
                  <span className="mbt-recipe-value mbt-recipe-formula">{mol.formula}</span>
                </div>
                <div className="mbt-recipe-item">
                  <span className="mbt-recipe-label">基酒</span>
                  <span className="mbt-recipe-value">{mol.spirit}</span>
                </div>
                <div className="mbt-recipe-item">
                  <span className="mbt-recipe-label">风味</span>
                  <span className="mbt-recipe-value">{mol.flavor}</span>
                </div>
                <div className="mbt-recipe-item">
                  <span className="mbt-recipe-label">温度</span>
                  <span className="mbt-recipe-value">{mol.temperature}</span>
                </div>
                <div className="mbt-recipe-item">
                  <span className="mbt-recipe-label">呈现方式</span>
                  <span className="mbt-recipe-value">{mol.presentation}</span>
                </div>
              </div>
              <div className="mbt-recipe-flavor-note">
                <span className="mbt-recipe-note-label">风味描述</span>
                <span className="mbt-recipe-note-text">这杯「{mol.name}」融合了 {mol.flavor} 的分子结构，{mol.temperature}饮用最能释放其气场。{mol.presentation}的视觉呈现，对应你{report.personaType}型人格的内在节奏。</span>
              </div>
            </div>

            {/* 脉轮联动洞察 */}
            {report.chakraInsight && report.chakraInsight.hasResult && (
              <div className="mbt-report-chakra">
                <div className="mbt-chakra-title">🌀 脉轮能量洞察</div>
                <div className="mbt-chakra-row">
                  <span className="mbt-chakra-label">最强脉轮</span>
                  <span className="mbt-chakra-value">{report.chakraInsight.dominantName}</span>
                  <span className="mbt-chakra-insight">{report.chakraInsight.dominantInsight}</span>
                </div>
                {report.chakraInsight.flavorHint && (
                  <div className="mbt-chakra-row">
                    <span className="mbt-chakra-label">配方修正</span>
                    <span className="mbt-chakra-value">{report.chakraInsight.flavorHint}</span>
                    <span className="mbt-chakra-insight">{report.chakraInsight.flavorReason}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mbt-report-quote">
              <div className="mbt-quote-mark">"</div>
              <div className="mbt-quote-text">{report.roleDesc}</div>
            </div>

            <div className="mbt-report-dialogue">
              <div className="mbt-dialogue-label">你的发言</div>
              <div className="mbt-dialogue-response">"{report.userResponse}"</div>
              <div className="mbt-dialogue-source">回应：{report.topicQuestion}</div>
            </div>

            <div className="mbt-report-traits">
              {report.traits.map((t, i) => (
                <Tag key={i} className="mbt-trait-tag">{t}</Tag>
              ))}
            </div>
          </div>

          <div className="mbt-report-actions">
            <Button icon={<SaveOutlined />} className="mbt-action-btn" onClick={() => message.success('已保存到用户画像')}>
              保存画像
            </Button>
            <Button icon={<ShareAltOutlined />} className="mbt-action-btn" onClick={handleShare}>
              分享报告
            </Button>
            <Button type="primary" icon={<ReloadOutlined />} className="mbt-action-btn mbt-restart" onClick={reset}>
              新酒局
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// 进度条组件
function PartyProgress({ step, onBack }) {
  const percent = ((step + 1) / PARTY_STEPS.length) * 100;
  return (
    <div className="mbt-progress-bar">
      {onBack && step > 0 && (
        <Button
          size="small"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          className="mbt-back-btn"
        >
          上一步
        </Button>
      )}
      <Progress
        percent={percent}
        strokeColor={{ from: '#a855f7', to: '#ffd700' }}
        format={() => `${step + 1} / ${PARTY_STEPS.length}`}
      />
    </div>
  );
}
