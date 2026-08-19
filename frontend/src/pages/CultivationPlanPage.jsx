import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography, Row, Col, Progress, Tag, Space, Divider, List, Empty, Button } from 'antd';
import {
  RiseOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
  HeartOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StarOutlined,
  FireOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../store/appStore';
import { storage } from '../utils/storage';
import { logger } from '../utils/logger';
import { apiClient } from '../utils/apiClient';
import {
  determinePhase,
  calculatePhaseProgress,
  calculateTotalSessions,
  calculateDimensionScores,
  identifyWeakDimensions,
  generateTodayTasks,
  getImprovementSuggestion,
  DIMENSION_CONFIG,
  PHASE_CONFIG,
} from '../utils/cultivationEngine.js';

const { Title, Text, Paragraph } = Typography;

// 覆盖 DIMENSION_CONFIG 中的图标为 React 组件
DIMENSION_CONFIG.discipline.icon = <TrophyOutlined />;
DIMENSION_CONFIG.riskControl.icon = <SafetyOutlined />;
DIMENSION_CONFIG.decisionSpeed.icon = <ThunderboltOutlined />;
DIMENSION_CONFIG.emotionalStability.icon = <HeartOutlined />;
DIMENSION_CONFIG.creativity.icon = <BulbOutlined />;
DIMENSION_CONFIG.endurance.icon = <FireOutlined />;

const CultivationPlanPage = () => {
  const navigate = useNavigate();
  const { data } = useAppStore();

  const totalSessions = useMemo(() => calculateTotalSessions(data), [data]);

  const persona = useMemo(() => {
    return storage.get('psychologyProfile') || storage.get('userState') || null;
  }, []);

  const currentPhase = useMemo(() => determinePhase(totalSessions), [totalSessions]);

  const phaseProgress = useMemo(() => calculatePhaseProgress(totalSessions), [totalSessions]);

  const dimensionScores = useMemo(() => calculateDimensionScores(data), [data]);

  const todayTasks = useMemo(() => generateTodayTasks(data), [data]);

  const weakDimensions = useMemo(() => identifyWeakDimensions(dimensionScores), [dimensionScores]);

  // ✦ AI 成长教练寄语(DeepSeek 点亮工程 · 登录态真调)
  const [coachNote, setCoachNote] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const hasToken = !!localStorage.getItem('auth_token');
  const handleCoachNote = async () => {
    if (coachLoading) return;
    setCoachLoading(true);
    setCoachNote(null);
    try {
      const res = await apiClient.llmGenerate('growth_coach', {
        phase_name: currentPhase.label,
        phase_desc: currentPhase.desc,
        weak_dims: (weakDimensions.map(w => w.label).join('、') || '无显著弱项').slice(0, 120),
        today_tasks: (todayTasks.slice(0, 3).map(t => t.title).join('；') || '今日无待办').slice(0, 150),
        mbti: persona?.mbti || persona?.currentMbti || '探索者',
      });
      if (res?.text) setCoachNote(res.text);
    } catch (e) {
      logger.error('[AI教练寄语] 失败', e);
    } finally {
      setCoachLoading(false);
    }
  };

  logger.session('培养方案页面加载', `阶段: ${currentPhase.key}, 会话数: ${totalSessions}`);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{
        fontSize: 28,
        fontWeight: 800,
        marginTop: 0,
        marginBottom: 4,
        background: 'var(--gradient-title)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        🌱 培养方案
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 28, fontSize: 14, lineHeight: 1.7 }}>
        基于你的行为数据与人格画像，定制专属成长路径
      </p>

      {/* 当前阶段 — hero-card 视觉 */}
      <div className="hero-card" style={{ marginBottom: 28, padding: '28px 32px' }}>
        <Row align="middle" gutter={24} style={{ position: 'relative', zIndex: 1 }}>
          <Col flex="1">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 52, height: 52,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(251, 191, 36, 0.08))',
                border: '1px solid rgba(251, 191, 36, 0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26,
                boxShadow: '0 0 20px rgba(251, 191, 36, 0.25)',
              }}>
                <StarOutlined style={{ color: '#fbbf24' }} />
              </div>
              <div>
                <h4 style={{ color: '#fff', margin: 0, fontSize: 18, fontWeight: 700 }}>
                  当前阶段：{currentPhase.label}
                </h4>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>
                  时长：{currentPhase.duration} · {currentPhase.desc}
                </div>
              </div>
            </div>
            {/* 阶段进度条 */}
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                  {phaseProgress.isFinalPhase
                    ? '🎉 已进入精通期，持续精进中'
                    : `距离「${phaseProgress.nextPhase?.label}」还需 ${phaseProgress.sessionsNeeded} 次训练`}
                </span>
                <span style={{
                  fontWeight: 700, fontSize: 14,
                  background: 'var(--gradient-purple-gold)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  {Math.round(phaseProgress.currentProgress)}%
                </span>
              </div>
              <Progress
                percent={Math.round(phaseProgress.currentProgress)}
                showInfo={false}
                size="small"
              />
            </div>
            {/* ✦ AI 成长教练寄语(登录解锁) */}
            <div style={{ marginTop: 16 }}>
              {hasToken ? (
                <div>
                  <Button
                    size="small"
                    loading={coachLoading}
                    onClick={handleCoachNote}
                    style={{ background: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.35)', color: '#D4AF37' }}
                  >
                    {coachNote ? '换一段教练寄语' : '✦ 生成今晚的教练寄语'}
                  </Button>
                  {coachNote && (
                    <div style={{ marginTop: 12, padding: '14px 18px', background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 12 }}>
                      <div style={{ fontSize: 12, color: '#D4AF37', letterSpacing: 1, marginBottom: 6 }}>✦ AI 成长教练 · 看了你的训练记录</div>
                      <div style={{ fontSize: 13, lineHeight: 1.9, color: 'rgba(255,255,255,0.88)', whiteSpace: 'pre-wrap' }}>{coachNote}</div>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  size="small"
                  onClick={() => navigate('/login', { state: { from: '/cultivation-plan' } })}
                  style={{ background: 'transparent', border: '1px dashed rgba(212,175,55,0.25)', color: 'rgba(212,175,55,0.75)' }}
                >
                  ✦ 登录解锁 AI 成长教练寄语 →
                </Button>
              )}
            </div>

            {/* 阶段解锁内容 */}
            {currentPhase.unlocks && (
              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {currentPhase.unlocks.map((unlock, idx) => (
                  <div key={idx} className="hero-badge purple" style={{ margin: 0 }}>
                    🔓 {unlock}
                  </div>
                ))}
              </div>
            )}
          </Col>
          <Col>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 40, fontWeight: 800, lineHeight: 1.1,
                background: 'var(--gradient-title)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {totalSessions}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 6, letterSpacing: 1 }}>
                累计训练次数
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <Row gutter={[20, 20]} style={{ marginBottom: 8 }}>
        {/* 左侧：能力维度雷达 */}
        <Col xs={24} md={14}>
          <Card
            title={
              <span style={{ color: '#fff' }}>
                📊 能力维度分析
              </span>
            }
            style={{
              marginBottom: 20,
              background: 'rgba(30,19,64,0.8)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 16,
            }}
            headStyle={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}
          >
            <Row gutter={[16, 16]}>
              {Object.entries(dimensionScores).map(([key, score]) => {
                const config = DIMENSION_CONFIG[key];
                return (
                  <Col xs={24} sm={12} key={key}>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: config.color }}>{config.icon}</span>
                          {config.label}
                        </span>
                        <Tag color={score >= 70 ? 'green' : score >= 50 ? 'blue' : 'orange'}>
                          {score}分
                        </Tag>
                      </div>
                      <Progress
                        percent={score}
                        showInfo={false}
                        strokeColor={{
                          '0%': config.color,
                          '100%': score >= 70 ? '#34d399' : config.color,
                        }}
                        trailColor="rgba(255,255,255,0.08)"
                        size="small"
                      />
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>

          {/* 薄弱项提升建议 */}
          {weakDimensions.length > 0 && (
            <Card
              title={
                <span style={{ color: '#fff' }}>
                  🎯 薄弱项提升建议
                </span>
              }
              style={{
                background: 'rgba(30,19,64,0.8)',
                border: '1px solid rgba(251,191,36,0.2)',
                borderRadius: 16,
              }}
              headStyle={{ borderBottom: '1px solid rgba(251,191,36,0.1)' }}
            >
              <List
                dataSource={weakDimensions}
                renderItem={(item) => (
                  <List.Item style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>
                    <List.Item.Meta
                      avatar={
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: `linear-gradient(135deg, ${item.color}40, ${item.color}20)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            color: item.color,
                          }}
                        >
                          {item.icon}
                        </div>
                      }
                      title={<span style={{ color: '#fff' }}>{item.label} · 当前 {item.score} 分</span>}
                      description={
                        <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                          建议：{getImprovementSuggestion(item.key, item.score)}
                        </span>
                      }
                    />
                    <RiseOutlined style={{ color: '#34d399', fontSize: 20 }} />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>

        {/* 右侧：今日任务 */}
        <Col xs={24} md={10}>
          <Card
            title={
              <span style={{ color: '#fff' }}>
                ⚡ 今日任务
              </span>
            }
            style={{
              marginBottom: 20,
              background: 'rgba(30,19,64,0.8)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 16,
            }}
            headStyle={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}
          >
            {todayTasks.length === 0 ? (
              <Empty description="今日任务已全部完成 🎉" />
            ) : (
              <List
                dataSource={todayTasks}
                renderItem={(task) => (
                  <List.Item
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      padding: '14px 0',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <List.Item.Meta
                      avatar={
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: task.priority === 'high'
                              ? 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(239,68,68,0.1))'
                              : task.priority === 'medium'
                              ? 'linear-gradient(135deg, rgba(251,191,36,0.3), rgba(251,191,36,0.1))'
                              : 'linear-gradient(135deg, rgba(96,165,250,0.3), rgba(96,165,250,0.1))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 22,
                          }}
                        >
                          {task.icon}
                        </div>
                      }
                      title={
                        <span style={{ color: '#fff', fontSize: 14 }}>
                          {task.title}
                          <Tag
                            color={task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'gold' : 'blue'}
                            style={{ marginLeft: 8 }}
                          >
                            {task.priority === 'high' ? '高优先' : task.priority === 'medium' ? '中优先' : '低优先'}
                          </Tag>
                        </span>
                      }
                      description={<span style={{ color: 'rgba(255,255,255,0.8)' }}>{task.desc}</span>}
                    />
                    <CheckCircleOutlined style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18 }} />
                  </List.Item>
                )}
              />
            )}
          </Card>

          {/* 成长阶段 */}
          <Card
            title={
              <span style={{ color: '#fff' }}>
                🌟 成长路径
              </span>
            }
            style={{
              background: 'rgba(30,19,64,0.8)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 16,
            }}
            headStyle={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}
          >
            {PHASE_CONFIG.map((phase, idx) => {
              const isActive = phase.key === currentPhase.key;
              const isPast = PHASE_CONFIG.findIndex(p => p.key === currentPhase.key) > idx;
              return (
                  <div
                    key={phase.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      padding: '14px 0',
                      borderBottom: idx < PHASE_CONFIG.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      position: 'relative',
                    }}
                  >
                    {/* 左侧连接线 */}
                    {idx < PHASE_CONFIG.length - 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: 15,
                          top: 44,
                          bottom: -2,
                          width: '2px',
                          background: isPast
                            ? 'linear-gradient(180deg, #34d399, rgba(168, 85, 247, 0.3))'
                            : isActive
                            ? 'linear-gradient(180deg, #a855f7, rgba(255,255,255,0.08))'
                            : 'rgba(255,255,255,0.06)',
                          borderRadius: 2,
                        }}
                      />
                    )}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: isActive
                          ? 'var(--gradient-purple-gold)'
                          : isPast
                          ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.35), rgba(52, 211, 153, 0.12))'
                          : 'rgba(255,255,255,0.06)',
                        border: isActive
                          ? '1px solid rgba(212, 175, 55, 0.5)'
                          : isPast
                          ? '1px solid rgba(52, 211, 153, 0.35)'
                          : '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isPast ? '#34d399' : isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                        fontWeight: 700,
                        flexShrink: 0,
                        position: 'relative',
                        zIndex: 1,
                        boxShadow: isActive
                          ? '0 0 16px rgba(168, 85, 247, 0.4), 0 0 8px rgba(212, 175, 55, 0.25)'
                          : isPast
                          ? '0 0 10px rgba(52, 211, 153, 0.25)'
                          : 'none',
                      }}
                    >
                      {isPast ? <CheckCircleOutlined /> : idx + 1}
                    </div>
                    <div style={{ flex: 1, paddingTop: 3 }}>
                      <div style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                        {phase.label}
                        <span style={{ marginLeft: 10, color: 'rgba(255,255,255,0.65)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ClockCircleOutlined /> {phase.duration}
                        </span>
                        {isActive && (
                          <div className="hero-badge purple" style={{ marginLeft: 10 }}>
                            进行中
                          </div>
                        )}
                      </div>
                      <div style={{ color: isActive ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.6 }}>
                        {phase.desc}
                      </div>
                    </div>
                  </div>
                );
            })}
          </Card>
        </Col>
      </Row>

    </div>
  );
};

export default CultivationPlanPage;
