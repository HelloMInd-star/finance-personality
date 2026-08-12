import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Divider,
  Tooltip,
  List,
  Spin,
  Tabs,
  Progress,
  Avatar,
  Statistic,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  HeartOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  BulbOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { personaMirrorEngine } from '../utils/personaMirrorEngine';
import { fashionEngine, generateFashionCardImage } from '../utils/fashionEngine';
import { developmentEngine, getModuleStats } from '../utils/developmentEngine';
import { apiClient } from '../utils/apiClient';
import { storage } from '../utils/storage';
import { logger } from '../utils/logger';

const { Title, Text, Paragraph } = Typography;

// ============= 维度配置 =============
const DIMENSION_CONFIG = {
  decisionStyle: {
    icon: <ThunderboltOutlined style={{ color: '#ef4444' }} />,
    title: '你的决策风格',
    color: '#ef4444',
  },
  executionStyle: {
    icon: <CheckCircleOutlined style={{ color: '#10b981' }} />,
    title: '你的执行风格',
    color: '#10b981',
  },
  socialStyle: {
    icon: <TeamOutlined style={{ color: '#3b82f6' }} />,
    title: '你的社交风格',
    color: '#3b82f6',
  },
  timeStyle: {
    icon: <ClockCircleOutlined style={{ color: '#f59e0b' }} />,
    title: '你的时间风格',
    color: '#f59e0b',
  },
  cognitiveStyle: {
    icon: <BulbOutlined style={{ color: '#7c3aed' }} />,
    title: '你的认知风格',
    color: '#7c3aed',
  },
};

// ============= 维度卡片组件 =============
const DimensionCard = ({ config, items }) => (
  <Card
    style={{
      background: 'rgba(30, 19, 64, 0.6)',
      borderRadius: 16,
      borderLeft: `4px solid ${config.color}`,
      marginBottom: 16,
    }}
    size="small"
  >
    <Space style={{ marginBottom: 12 }}>
      <span style={{ fontSize: 20 }}>{config.icon}</span>
      <Title level={5} style={{ color: '#fff', margin: 0 }}>
        {config.title}
      </Title>
    </Space>
    <List
      size="small"
      dataSource={items}
      renderItem={(item) => (
        <List.Item style={{ borderBottom: 'none', padding: '6px 0' }}>
          <Space align="start" style={{ width: '100%' }}>
            <Text style={{ color: config.color, marginTop: 2 }}>●</Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>
              {item}
            </Text>
          </Space>
        </List.Item>
      )}
    />
  </Card>
);

// ============= 主页面 =============
const PersonaMirrorPage = () => {
  const navigate = useNavigate();
  const [mirror, setMirror] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [fashionReport, setFashionReport] = useState(null);
  const [fashionLoading, setFashionLoading] = useState(false);
  const [fashionImage, setFashionImage] = useState(null);
  const [fashionImageLoading, setFashionImageLoading] = useState(false);
  const [fashionImageError, setFashionImageError] = useState(null);
  const [developmentPlan, setDevelopmentPlan] = useState(null);
  const [developmentLoading, setDevelopmentLoading] = useState(false);
  const [expandedModule, setExpandedModule] = useState('language');

  // 初始加载
  useEffect(() => {
    const current = personaMirrorEngine.getCurrent();
    if (current) {
      setMirror(current);
    } else {
      handleRegenerate();
    }

    // 恢复时尚报告
    const savedFashion = storage.get('fashionReport');
    if (savedFashion) {
      setFashionReport(savedFashion);
    }
    const savedFashionImage = storage.get('fashionImage');
    if (savedFashionImage) {
      setFashionImage(savedFashionImage);
    }
    const savedDevPlan = storage.get('developmentPlan');
    if (savedDevPlan) {
      setDevelopmentPlan(savedDevPlan);
    }
  }, []);

  const handleRegenerate = () => {
    setLoading(true);
    setTimeout(() => {
      const newMirror = personaMirrorEngine.generate();
      setMirror(newMirror);
      setLoading(false);
      logger.session('重新生成人格镜子');
    }, 800);
  };

  // 从人格镜子提取 MBTI（如果有的话）
  const getFashionInput = () => {
    // 先从 mirror 里提取，没有就用默认值
    let mbti = 'INTJ';
    if (mirror?.mbti) mbti = mirror.mbti;
    if (mirror?.summary?.includes('INTJ')) mbti = 'INTJ';
    if (mirror?.summary?.includes('ENFP')) mbti = 'ENFP';

    // 从 localStorage 获取其他数据
    const tarotData = storage.get('tarotHistory') || [];
    const recentTarot = tarotData.slice(0, 3).map(t => t.cardName).filter(Boolean);

    const cocktailData = storage.get('cocktailPreference') || {};

    return {
      mbti,
      risingSign: mirror?.risingSign || null,
      venusSign: mirror?.venusSign || null,
      marsSign: mirror?.marsSign || null,
      recentTarot,
      baseSpirit: cocktailData.baseSpirit || null,
      flavorTags: cocktailData.flavorTags || [],
    };
  };

  const handleGenerateFashion = async () => {
    logger.session('[时尚表达] 生成时尚报告');
    setFashionLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const input = getFashionInput();
      const report = fashionEngine.generateFashionReport(input);

      if (report) {
        setFashionReport(report);
        storage.set('fashionReport', report);
        message.success(`时尚报告已生成：${report.theme}`);
        logger.session('[时尚表达] 报告生成成功', { theme: report.theme });
      }
    } catch (err) {
      logger.error('[时尚表达] 生成失败', err);
      message.error('生成时尚报告时出错');
    } finally {
      setFashionLoading(false);
    }
  };

  // 生成穿搭卡片图片
  const handleGenerateFashionCard = async () => {
    if (!fashionReport) {
      message.warning('请先生成时尚报告');
      return;
    }

    logger.session('[时尚表达] 生成穿搭卡片图片');
    setFashionImageLoading(true);
    setFashionImageError(null);

    try {
      const result = await generateFashionCardImage(fashionReport);
      if (result.success) {
        setFashionImage(result.url);
        setFashionImageError(null);
        storage.set('fashionImage', result.url);
        const attemptText = result.attempts > 1 ? `（经过 ${result.attempts} 次尝试）` : '';
        message.success(`穿搭卡片已生成${attemptText}，快去分享吧~`);
        logger.session('[时尚表达] 穿搭卡片生成成功', {
          imageUrlLength: result.url.length,
          attempts: result.attempts,
        });
      } else {
        setFashionImageError(result);
        const attemptText = result.attempts > 1 ? `（已尝试 ${result.attempts} 次）` : '';
        message.warning(`${result.tip}${attemptText}`);
        logger.error('[时尚表达] 穿搭卡片生成失败', result);
      }
    } catch (err) {
      logger.error('[时尚表达] 生成穿搭卡片异常', err);
      setFashionImageError({
        success: false,
        error: err?.message || '未知错误',
        errorType: 'unknown',
        tip: '生成失败，请稍后重试',
      });
      message.error('生成穿搭卡片时出错，请稍后重试');
    } finally {
      setFashionImageLoading(false);
    }
  };

  // 生成人格培养方案（优先从后端拉取）
  const handleGenerateDevelopment = async () => {
    logger.session('[培养方案] 生成培养方案');
    setDevelopmentLoading(true);

    try {
      const mbti = mirror?.mbti || 'INTJ';
      let plan = null;
      let usedBackend = false;

      // 优先从后端拉取（如果有 token）
      try {
        const hasToken = localStorage.getItem('auth_token');
        if (hasToken) {
          logger.session('[培养方案] 尝试从后端拉取方案');
          const backendPlan = await apiClient.generateDevelopmentPlan({
            mbti,
            decisionStyle: mirror?.decisionStyle || null,
          });
          if (backendPlan) {
            plan = backendPlan;
            usedBackend = true;
            logger.session('[培养方案] 从后端拉取成功');
          }
        }
      } catch (backendErr) {
        logger.session('[培养方案] 后端拉取失败，使用本地引擎', backendErr.message);
      }

      // 后端不可用时回退到本地引擎
      if (!plan) {
        await new Promise(resolve => setTimeout(resolve, 300));
        plan = developmentEngine.generateDevelopmentPlan({
          mbti,
          decisionStyle: mirror?.decisionStyle || null,
        });
      }

      if (plan) {
        setDevelopmentPlan(plan);
        storage.set('developmentPlan', plan);
        if (usedBackend) {
          message.success('培养方案已从云端同步 🌱');
        } else {
          message.success('培养方案已生成，开始你的成长之旅吧 🌱');
        }
        logger.session('[培养方案] 方案生成成功', { mbti, usedBackend });
      }
    } catch (err) {
      logger.error('[培养方案] 生成失败', err);
      message.error('生成培养方案时出错');
    } finally {
      setDevelopmentLoading(false);
    }
  };

  // 自动生成培养方案（当人格镜子有数据时，优先从后端拉取）
  useEffect(() => {
    if (mirror && !developmentPlan) {
      const autoFetch = async () => {
        try {
          const hasToken = localStorage.getItem('auth_token');
          if (hasToken) {
            logger.session('[培养方案] 自动从后端拉取方案');
            const backendPlan = await apiClient.getDevelopmentPlan();
            if (backendPlan) {
              setDevelopmentPlan(backendPlan);
              storage.set('developmentPlan', backendPlan);
              logger.session('[培养方案] 自动从后端拉取成功');
              return;
            }
          }
        } catch (err) {
          logger.session('[培养方案] 自动从后端拉取失败，使用本地引擎', err.message);
        }
        // 回退到本地生成
        handleGenerateDevelopment();
      };
      autoFetch();
    }
  }, [mirror]);

  // 自动生成时尚报告（当人格镜子有数据时）
  useEffect(() => {
    if (mirror && !fashionReport) {
      handleGenerateFashion();
    }
  }, [mirror]);

  const history = useMemo(() => personaMirrorEngine.getHistory(), [mirror]);

  if (loading && !mirror) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="正在从你的行为中提取轮廓..." />
      </div>
    );
  }

  return (
    <div className="persona-mirror-page fade-in" style={{ padding: 16 }}>
      {/* 顶部标题区 */}
      <Card
        style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(30,19,64,0.6) 100%)',
          borderRadius: 16,
          border: '1px solid rgba(139,92,246,0.4)',
        }}
      >
        <Space size="large" wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
              返回
            </Button>
            <div>
              <Title level={3} style={{ color: '#fff', margin: 0 }}>
                <EyeOutlined style={{ color: '#7c3aed', marginRight: 8 }} />
                人格镜子
              </Title>
              <Text type="secondary" style={{ fontStyle: 'italic' }}>
                "这是系统从你的行为中看到的你"
              </Text>
            </div>
          </Space>
          <Space>
            <Tooltip title="基于你最近的行为记录生成">
              <Tag icon={<InfoCircleOutlined />} color="purple">
                {mirror?.dataSummary?.totalSessions || 0} 次行为记录
              </Tag>
            </Tooltip>
            <Button
              type="primary"
              icon={<ReloadOutlined spin={loading} />}
              onClick={handleRegenerate}
              loading={loading}
            >
              重新生成
            </Button>
          </Space>
        </Space>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        centered
        size="large"
        style={{ marginBottom: 16 }}
        items={[
          {
            key: 'overview',
            label: (
              <span style={{ fontSize: 15 }}>
                <EyeOutlined style={{ marginRight: 6 }} />
                人格概述
              </span>
            ),
          },
          {
            key: 'fashion',
            label: (
              <span style={{ fontSize: 15 }}>
                👗 时尚表达
              </span>
            ),
          },
          {
            key: 'development',
            label: (
              <span style={{ fontSize: 15 }}>
                🌱 培养方案
              </span>
            ),
          },
        ]}
      />

      {activeTab === 'overview' && (
      <Row gutter={[16, 16]}>
        {/* 左侧：人格描述 */}
        <Col xs={24} lg={16}>
          <Spin spinning={loading} tip="正在重新生成...">
            {mirror && (
              <>
                <DimensionCard
                  config={DIMENSION_CONFIG.decisionStyle}
                  items={mirror.decisionStyle}
                />
                <DimensionCard
                  config={DIMENSION_CONFIG.executionStyle}
                  items={mirror.executionStyle}
                />
                <DimensionCard
                  config={DIMENSION_CONFIG.socialStyle}
                  items={mirror.socialStyle}
                />
                <DimensionCard
                  config={DIMENSION_CONFIG.timeStyle}
                  items={mirror.timeStyle}
                />
                <DimensionCard
                  config={DIMENSION_CONFIG.cognitiveStyle}
                  items={mirror.cognitiveStyle}
                />
              </>
            )}
          </Spin>
        </Col>

        {/* 右侧：数据来源和说明 */}
        <Col xs={24} lg={8}>
          <Card
            style={{
              background: 'rgba(30, 19, 64, 0.6)',
              borderRadius: 16,
              marginBottom: 16,
            }}
            size="small"
            title={
              <Space>
                <InfoCircleOutlined style={{ color: '#7c3aed' }} />
                <span>数据来源</span>
              </Space>
            }
          >
            <List
              size="small"
              dataSource={mirror?.sources || []}
              renderItem={(source) => (
                <List.Item style={{ borderBottom: 'none', padding: '4px 0' }}>
                  <Tag color="purple">{source}</Tag>
                </List.Item>
              )}
            />
            {(!mirror?.sources || mirror.sources.length === 0) && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                暂无数据，先去玩几个模块吧！
              </Text>
            )}
            <Divider style={{ borderColor: 'rgba(139,92,246,0.2)', margin: '12px 0' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              更新时间: {personaMirrorEngine.formatDate(mirror?.updatedAt)}
            </Text>
          </Card>

          <Card
            style={{
              background: 'rgba(30, 19, 64, 0.6)',
              borderRadius: 16,
              marginBottom: 16,
            }}
            size="small"
            title={
              <Space>
                <HeartOutlined style={{ color: '#ef4444' }} />
                <span>关于人格镜子</span>
              </Space>
            }
          >
            <Paragraph style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0 }}>
              这不是标签，是描述。
            </Paragraph>
            <Paragraph style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
              系统不会说"你是INTJ"，而是描述"你在什么样的场景里最能发挥"。
            </Paragraph>
            <Paragraph style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
              每一次行为都会让这面镜子更清晰一点。
            </Paragraph>
          </Card>

          <Card
            style={{
              background: 'rgba(30, 19, 64, 0.6)',
              borderRadius: 16,
              cursor: 'pointer',
            }}
            size="small"
            onClick={() => setShowHistory(!showHistory)}
          >
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <ReloadOutlined style={{ color: '#7c3aed' }} />
                <Text style={{ color: '#fff' }}>历史版本 ({history.length})</Text>
              </Space>
              <Text type="secondary">{showHistory ? '收起' : '展开'}</Text>
            </Space>
            {showHistory && history.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <List
                  size="small"
                  dataSource={history.slice(0, 7)}
                  renderItem={(item, idx) => (
                    <List.Item style={{ borderBottom: '1px solid rgba(139,92,246,0.1)', padding: '6px 0' }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Tag color={idx === 0 ? 'green' : 'default'}>
                          {idx === 0 ? '当前' : `#${history.length - idx}`}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {personaMirrorEngine.formatDate(item.updatedAt)}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>
      )}

      {activeTab === 'fashion' && (
        <Spin spinning={fashionLoading} tip="正在从你的人格中提取时尚表达...">
          {fashionReport ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* 主题卡片 */}
              <Card
                style={{
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(30,19,64,0.6) 100%)',
                  borderRadius: 16,
                  border: '1px solid rgba(139,92,246,0.4)',
                }}
              >
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    👗 你的时尚表达 · 人格穿搭报告
                  </Text>
                  <Title level={3} style={{ color: '#a78bfa', margin: '12px 0 4px' }}>
                    "{fashionReport.theme}"
                  </Title>
                  <Space size={[8, 8]} wrap style={{ justifyContent: 'center', marginTop: 8 }}>
                    {fashionReport.keywords.map((k, i) => (
                      <Tag color="purple" key={i} style={{ fontSize: 13, padding: '2px 10px' }}>
                        {k}
                      </Tag>
                    ))}
                  </Space>
                </div>

                <Divider style={{ borderColor: 'rgba(139,92,246,0.2)', margin: '16px 0' }} />

                {/* 数据来源 */}
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    人格基础：{fashionReport.mbti}
                    {fashionReport.risingSign && ` · 上升${fashionReport.risingSign}`}
                    {fashionReport.recentTarot?.length > 0 && ` · 塔罗：${fashionReport.recentTarot[0]}`}
                  </Text>
                </div>
              </Card>

              {/* 主色调 */}
              <Card
                title={<span style={{ color: '#fff' }}>🎨 主色调推荐</span>}
                style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
              >
                <Space size={[12, 12]} wrap style={{ justifyContent: 'center' }}>
                  {fashionReport.colors.map((c, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: 12,
                          background: fashionReport.colorHex?.[i] || '#7c3aed',
                          border: '2px solid rgba(255,255,255,0.2)',
                          marginBottom: 6,
                        }}
                      />
                      <Text style={{ color: '#fff', fontSize: 12 }}>{c}</Text>
                    </div>
                  ))}
                </Space>
              </Card>

              {/* 面料 + 版型 */}
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Card
                    title={<span style={{ color: '#fff' }}>🧵 面料倾向</span>}
                    style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)', height: '100%' }}
                  >
                    <Space size={[8, 8]} wrap>
                      {fashionReport.fabrics.map((f, i) => (
                        <Tag key={i} color="#7c3aed" style={{ fontSize: 14, padding: '4px 12px' }}>
                          {f}
                        </Tag>
                      ))}
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card
                    title={<span style={{ color: '#fff' }}>✂️ 版型风格</span>}
                    style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)', height: '100%' }}
                  >
                    <Space size={[8, 8]} wrap>
                      {fashionReport.silhouettes.map((s, i) => (
                        <Tag key={i} color="#a78bfa" style={{ fontSize: 14, padding: '4px 12px' }}>
                          {s}
                        </Tag>
                      ))}
                    </Space>
                  </Card>
                </Col>
              </Row>

              {/* 配饰建议 */}
              <Card
                title={<span style={{ color: '#fff' }}>💍 配饰建议</span>}
                style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
              >
                <Space size={[8, 8]} wrap>
                  {fashionReport.accessories.map((a, i) => (
                    <Tag key={i} color="#10b981" style={{ fontSize: 14, padding: '4px 12px' }}>
                      {a}
                    </Tag>
                  ))}
                </Space>
              </Card>

              {/* 当季建议 */}
              <Card
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.3)',
                }}
              >
                <Space align="start" style={{ width: '100%' }}>
                  <span style={{ fontSize: 24 }}>🌿</span>
                  <div>
                    <Text style={{ color: '#10b981', fontSize: 13, fontWeight: 600 }}>当季建议</Text>
                    <Paragraph style={{ color: '#fff', fontSize: 15, margin: '4px 0 0' }}>
                      {fashionReport.seasonalAdvice}
                    </Paragraph>
                  </div>
                </Space>
              </Card>

              {/* 穿搭卡片图片 */}
              {(fashionImage || fashionImageLoading || fashionImageError) && (
                <Card
                  style={{
                    background: fashionImageError
                      ? 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(124,58,237,0.1) 100%)'
                      : 'linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(124,58,237,0.12) 100%)',
                    border: fashionImageError
                      ? '1px solid rgba(239,68,68,0.35)'
                      : '1px solid rgba(234,179,8,0.35)',
                    textAlign: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: fashionImageError ? '#ef4444' : '#eab308',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'block',
                      marginBottom: 12,
                    }}
                  >
                    {fashionImageError ? '⚠️ 图片生成失败' : '🖼️ 你的穿搭效果图'}
                  </Text>

                  {fashionImageLoading ? (
                    <div style={{ padding: '40px 20px' }}>
                      <Spin tip="AI 正在绘制你的穿搭风格..." size="large" />
                      <div style={{ marginTop: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          首次生成需要 10-30 秒，请耐心等待 ✨
                        </Text>
                      </div>
                    </div>
                  ) : fashionImageError ? (
                    <div style={{ padding: '24px 20px', textAlign: 'left' }}>
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <div>
                          <Text style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>
                            {fashionImageError.tip}
                          </Text>
                          {fashionImageError.attempts > 1 && (
                            <div style={{ marginTop: 6 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                已自动重试 {fashionImageError.attempts} 次
                              </Text>
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 8,
                            padding: '12px 16px',
                          }}
                        >
                          <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: 600 }}>💡 建议</Text>
                          <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: '#cbd5e0', fontSize: 13 }}>
                            <li>检查网络连接是否正常</li>
                            <li>等待 1-2 分钟后再尝试</li>
                            <li>如果持续失败，可能是 AI 服务暂时繁忙</li>
                          </ul>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <Button
                            type="primary"
                            icon={<ReloadOutlined />}
                            onClick={handleGenerateFashionCard}
                            loading={fashionImageLoading}
                          >
                            重新生成
                          </Button>
                        </div>
                      </Space>
                    </div>
                  ) : (
                    <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                      <img
                        src={fashionImage}
                        alt="穿搭卡片"
                        style={{ width: '100%', maxHeight: 500, objectFit: 'cover', display: 'block' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          logger.error('[时尚表达] 图片显示失败', fashionImage);
                          setFashionImageError({
                            success: false,
                            error: '图片无法显示',
                            errorType: 'network',
                            tip: '图片加载失败，请检查网络后重试',
                          });
                        }}
                      />
                    </div>
                  )}
                </Card>
              )}

              {/* 操作按钮 */}
              <div style={{ textAlign: 'center' }}>
                <Space>
                  <Button
                    type="primary"
                    size="large"
                    icon={<CameraOutlined />}
                    onClick={handleGenerateFashionCard}
                    loading={fashionImageLoading}
                  >
                    {fashionImage ? '🔄 重新生成穿搭卡片' : '📸 生成穿搭卡片'}
                  </Button>
                  <Button size="large" icon={<ReloadOutlined />} onClick={handleGenerateFashion} loading={fashionLoading}>
                    🔄 重新生成报告
                  </Button>
                </Space>
              </div>
            </Space>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👗</div>
              <Title level={4} style={{ color: '#fff' }}>正在生成你的时尚表达...</Title>
              <Text type="secondary">基于你的人格数据，正在翻译为可感知的视觉语言</Text>
            </div>
          )}
        </Spin>
      )}

      {activeTab === 'development' && (
        <Spin spinning={developmentLoading} tip="正在为你定制个人发展方案...">
          {developmentPlan ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* 标题卡片 */}
              <Card
                style={{
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(124,58,237,0.15) 100%)',
                  border: '1px solid rgba(34,197,94,0.4)',
                  borderRadius: 16,
                }}
              >
                <Space size="large" align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <Title level={3} style={{ color: '#fff', margin: 0 }}>🌱 人格培养方案</Title>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      基于你的人格画像（{developmentPlan.mbti}），为你定制的成长路径
                    </Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>当前综合状态</Text>
                    <div style={{ marginTop: 8 }}>
                      <Tag color="#3b82f6">语言 {developmentPlan.status.language}</Tag>
                      <Tag color="#8b5cf6">认知 {developmentPlan.status.cognitive}</Tag>
                      <Tag color="#f59e0b">行为 {developmentPlan.status.behavior}</Tag>
                      <Tag color="#ec4899">表达 {developmentPlan.status.expression}</Tag>
                    </div>
                  </div>
                </Space>
              </Card>

              {/* 四大模块概览卡片 */}
              <Row gutter={[12, 12]}>
                {[
                  { key: 'language', icon: '🌐', title: '语言系统', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                  { key: 'cognitive', icon: '🧠', title: '认知系统', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
                  { key: 'behavioral', icon: '⚡', title: '行为系统', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                  { key: 'expressive', icon: '🎤', title: '表达系统', color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
                ].map(mod => {
                  const stats = getModuleStats(developmentPlan);
                  const isExpanded = expandedModule === mod.key;
                  return (
                    <Col xs={24} sm={12} key={mod.key}>
                      <Card
                        hoverable
                        onClick={() => setExpandedModule(isExpanded ? null : mod.key)}
                        style={{
                          background: mod.bg,
                          border: `1px solid ${mod.color}50`,
                          borderRadius: 12,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Space size="middle">
                            <span style={{ fontSize: 32 }}>{mod.icon}</span>
                            <div>
                              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{mod.title}</Text>
                              <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {mod.key === 'language' && `${developmentPlan.modules.language.approach.length} 项建议`}
                                  {mod.key === 'cognitive' && `${developmentPlan.modules.cognitive.strengthActions.length + developmentPlan.modules.cognitive.weaknessActions.length} 项建议`}
                                  {mod.key === 'behavioral' && `${developmentPlan.modules.behavioral.habits.length} 项建议`}
                                  {mod.key === 'expressive' && `${developmentPlan.modules.expressive.exercises.length} 项建议`}
                                </Text>
                              </div>
                            </div>
                          </Space>
                          <Text style={{ color: mod.color, fontSize: 20 }}>
                            {isExpanded ? '−' : '+'}
                          </Text>
                        </Space>
                      </Card>
                    </Col>
                  );
                })}
              </Row>

              {/* 展开的模块详情 */}
              {expandedModule === 'language' && (
                <Card
                  style={{
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: 12,
                  }}
                >
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                      <Text style={{ color: '#3b82f6', fontSize: 16, fontWeight: 600 }}>🌐 语言系统 · 英语学习方案</Text>
                      <div style={{ marginTop: 12 }}>
                        <Tag color="blue">{developmentPlan.modules.language.learningStyleLabel}</Tag>
                      </div>
                    </div>

                    <div>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>📚 推荐学习路径</Text>
                      <div style={{ marginTop: 8, paddingLeft: 8 }}>
                        {developmentPlan.modules.language.path.map((p, i) => (
                          <div key={i} style={{ color: '#cbd5e0', fontSize: 13, padding: '4px 0' }}>
                            {i < developmentPlan.modules.language.path.length - 1 ? (
                              <span style={{ color: '#3b82f6', marginRight: 8 }}>→</span>
                            ) : (
                              <span style={{ color: '#22c55e', marginRight: 8 }}>✓</span>
                            )}
                            {p}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>🎯 学习方法建议</Text>
                      <ul style={{ marginTop: 8, paddingLeft: 20, color: '#cbd5e0' }}>
                        {developmentPlan.modules.language.approach.map((a, i) => (
                          <li key={i} style={{ padding: '4px 0', fontSize: 13 }}>{a}</li>
                        ))}
                      </ul>
                    </div>

                    <Row gutter={[12, 12]}>
                      {Object.entries(developmentPlan.modules.language.progress).map(([key, val]) => {
                        const labels = { vocabulary: '词汇量', listening: '听力', reading: '阅读', speaking: '口语', writing: '写作' };
                        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
                        const pct = typeof val === 'number'
                          ? Math.min(100, (val / 10000) * 100)
                          : ((levels.indexOf(val) + 1) / levels.length) * 100;
                        return (
                          <Col xs={12} sm={8} key={key}>
                            <div style={{ textAlign: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>{labels[key] || key}</Text>
                              <div style={{ marginTop: 4 }}>
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
                                  {typeof val === 'number' ? val.toLocaleString() : val}
                                </Text>
                              </div>
                              <Progress percent={Math.round(pct)} showInfo={false} size="small" strokeColor="#3b82f6" />
                            </div>
                          </Col>
                        );
                      })}
                    </Row>

                    <div
                      style={{
                        background: 'rgba(59,130,246,0.15)',
                        borderRadius: 8,
                        padding: '12px 16px',
                      }}
                    >
                      <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600 }}>🎯 本周目标</Text>
                      <Paragraph style={{ color: '#fff', fontSize: 14, margin: '4px 0 0' }}>
                        {developmentPlan.modules.language.weeklyGoal}
                      </Paragraph>
                    </div>
                  </Space>
                </Card>
              )}

              {expandedModule === 'cognitive' && (
                <Card
                  style={{
                    background: 'rgba(139,92,246,0.08)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: 12,
                  }}
                >
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                      <Text style={{ color: '#8b5cf6', fontSize: 16, fontWeight: 600 }}>🧠 认知系统 · 思维能力提升</Text>
                    </div>

                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12}>
                        <div
                          style={{
                            background: 'rgba(34,197,94,0.1)',
                            borderRadius: 8,
                            padding: '16px',
                            border: '1px solid rgba(34,197,94,0.3)',
                          }}
                        >
                          <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: 600 }}>💪 优势强化</Text>
                          <div style={{ marginTop: 8 }}>
                            {developmentPlan.modules.cognitive.strengths.map((s, i) => (
                              <Tag key={i} color="green" style={{ margin: '4px', fontSize: 12 }}>{s}</Tag>
                            ))}
                          </div>
                          <ul style={{ marginTop: 12, paddingLeft: 18, color: '#cbd5e0' }}>
                            {developmentPlan.modules.cognitive.strengthActions.map((a, i) => (
                              <li key={i} style={{ padding: '4px 0', fontSize: 13 }}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      </Col>
                      <Col xs={24} sm={12}>
                        <div
                          style={{
                            background: 'rgba(239,68,68,0.1)',
                            borderRadius: 8,
                            padding: '16px',
                            border: '1px solid rgba(239,68,68,0.3)',
                          }}
                        >
                          <Text style={{ color: '#f87171', fontSize: 14, fontWeight: 600 }}>🎯 短板补齐</Text>
                          <div style={{ marginTop: 8 }}>
                            {developmentPlan.modules.cognitive.weaknesses.map((s, i) => (
                              <Tag key={i} color="red" style={{ margin: '4px', fontSize: 12 }}>{s}</Tag>
                            ))}
                          </div>
                          <ul style={{ marginTop: 12, paddingLeft: 18, color: '#cbd5e0' }}>
                            {developmentPlan.modules.cognitive.weaknessActions.map((a, i) => (
                              <li key={i} style={{ padding: '4px 0', fontSize: 13 }}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      </Col>
                    </Row>

                    <div>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>📖 推荐学习资源</Text>
                      <div style={{ marginTop: 8 }}>
                        {developmentPlan.modules.cognitive.resources.map((r, i) => (
                          <Tag key={i} color="purple" style={{ margin: '4px', fontSize: 13 }}>{r}</Tag>
                        ))}
                      </div>
                    </div>
                  </Space>
                </Card>
              )}

              {expandedModule === 'behavioral' && (
                <Card
                  style={{
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 12,
                  }}
                >
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                      <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: 600 }}>⚡ 行为系统 · 习惯与行动</Text>
                    </div>

                    <div>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>⏰ 推荐时间节奏</Text>
                      <Paragraph style={{ color: '#cbd5e0', fontSize: 13, margin: '8px 0 0' }}>
                        {developmentPlan.modules.behavioral.schedule}
                      </Paragraph>
                    </div>

                    <div>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>🎯 习惯养成建议</Text>
                      <ul style={{ marginTop: 8, paddingLeft: 20, color: '#cbd5e0' }}>
                        {developmentPlan.modules.behavioral.habits.map((h, i) => (
                          <li key={i} style={{ padding: '4px 0', fontSize: 13 }}>
                            <CheckCircleOutlined style={{ color: '#f59e0b', marginRight: 6 }} />
                            {h}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>📅 每日微行动</Text>
                      <div style={{ marginTop: 8 }}>
                        {developmentPlan.modules.behavioral.dailyActions.map((a, i) => (
                          <Tag key={i} color="orange" style={{ margin: '4px', fontSize: 12 }}>{a}</Tag>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'rgba(245,158,11,0.15)',
                        borderRadius: 8,
                        padding: '12px 16px',
                      }}
                    >
                      <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>📊 每周总结</Text>
                      <Paragraph style={{ color: '#fff', fontSize: 14, margin: '4px 0 0' }}>
                        {developmentPlan.modules.behavioral.weeklySummary}
                      </Paragraph>
                    </div>
                  </Space>
                </Card>
              )}

              {expandedModule === 'expressive' && (
                <Card
                  style={{
                    background: 'rgba(236,72,153,0.08)',
                    border: '1px solid rgba(236,72,153,0.3)',
                    borderRadius: 12,
                  }}
                >
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                      <Text style={{ color: '#ec4899', fontSize: 16, fontWeight: 600 }}>🎤 表达系统 · 沟通与形象</Text>
                    </div>

                    <div>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>💎 表达风格定位</Text>
                      <div style={{ marginTop: 8 }}>
                        {developmentPlan.modules.expressive.style.split(' · ').map((s, i) => (
                          <Tag key={i} color="magenta" style={{ margin: '4px', fontSize: 13 }}>{s}</Tag>
                        ))}
                      </div>
                      <Paragraph style={{ color: '#cbd5e0', fontSize: 13, margin: '12px 0 0' }}>
                        {developmentPlan.modules.expressive.styleDesc}
                      </Paragraph>
                    </div>

                    <div>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>🎯 日常练习建议</Text>
                      <ul style={{ marginTop: 8, paddingLeft: 20, color: '#cbd5e0' }}>
                        {developmentPlan.modules.expressive.exercises.map((e, i) => (
                          <li key={i} style={{ padding: '4px 0', fontSize: 13 }}>{e}</li>
                        ))}
                      </ul>
                    </div>

                    <div
                      style={{
                        background: 'rgba(236,72,153,0.1)',
                        borderRadius: 8,
                        padding: '12px 16px',
                      }}
                    >
                      <Text style={{ color: '#f472b6', fontSize: 13, fontWeight: 600 }}>💡 反馈与建议</Text>
                      <Paragraph style={{ color: '#fff', fontSize: 13, margin: '4px 0 0' }}>
                        {developmentPlan.modules.expressive.feedback}
                      </Paragraph>
                    </div>

                    <div
                      style={{
                        background: 'rgba(234,179,8,0.1)',
                        borderRadius: 8,
                        padding: '12px 16px',
                        border: '1px solid rgba(234,179,8,0.2)',
                      }}
                    >
                      <Text style={{ color: '#eab308', fontSize: 13, fontWeight: 600 }}>👗 形象管理建议（与时尚模块联动）</Text>
                      <Paragraph style={{ color: '#fff', fontSize: 13, margin: '4px 0 0' }}>
                        {developmentPlan.modules.expressive.imageTips}
                      </Paragraph>
                    </div>
                  </Space>
                </Card>
              )}

              {/* 操作按钮 */}
              <div style={{ textAlign: 'center' }}>
                <Space>
                  <Button
                    type="primary"
                    size="large"
                    icon={<CheckCircleOutlined />}
                    onClick={() => message.success('方案已加入你的成长计划！')}
                  >
                    📥 采纳此方案
                  </Button>
                  <Button
                    size="large"
                    icon={<ReloadOutlined />}
                    onClick={handleGenerateDevelopment}
                    loading={developmentLoading}
                  >
                    🔄 重新生成
                  </Button>
                </Space>
              </div>
            </Space>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
              <Title level={4} style={{ color: '#fff' }}>正在为你定制培养方案...</Title>
              <Text type="secondary">基于你的人格画像，正在生成个性化的成长路径</Text>
            </div>
          )}
        </Spin>
      )}
    </div>
  );
};

export default PersonaMirrorPage;
