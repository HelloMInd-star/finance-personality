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
  Progress,
  Tooltip,
  Statistic,
  Table,
  Input,
  Divider,
  Badge,
  Alert,
  List,
} from 'antd';
import {
  ArrowLeftOutlined,
  HomeOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  LinkOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import mindSpeakEngine, {
  MODULES,
  calculateInitialSteadyState,
  calculateModuleConfidences,
  calculatePanopticMatrix,
  updateSteadyState,
  translate,
  logAudit,
  getMindSpeakState,
  saveMindSpeakState,
} from '../utils/mindspeakEngine';
import { storage } from '../utils/storage';
import { logger } from '../utils/logger';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const MindSpeakPage = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [translateResult, setTranslateResult] = useState(null);
  const [activeTab, setActiveTab] = useState('modules'); // modules | matrix | audit

  // 从 Y.Mine 读取数据
  const yMineData = useMemo(() => storage.get() || {}, []);
  const userState = yMineData.userState || {};
  const stories = yMineData.stories || [];

  // MindSpeak 状态
  const [msState, setMsState] = useState(() => getMindSpeakState());

  // 计算各模块置信度
  const moduleConfidences = useMemo(() => {
    const confs = calculateModuleConfidences(yMineData);
    // 合并已保存的状态
    return { ...confs, ...(msState.moduleConfidences || {}) };
  }, [yMineData, msState.moduleConfidences]);

  // 全局稳态
  const steadyState = useMemo(() => {
    if (msState.steadyState) return msState.steadyState;
    return calculateInitialSteadyState(yMineData);
  }, [yMineData, msState.steadyState]);

  // 全景矩阵
  const panopticMatrix = useMemo(() => {
    return calculatePanopticMatrix(moduleConfidences);
  }, [moduleConfidences]);

  // 审计日志（从故事集中筛选）
  const auditLogs = useMemo(() => {
    return stories.filter((s) => s.type === 'mindspeak').slice(-20).reverse();
  }, [stories]);

  // 当前联动的模块
  const activeLinkModule = useMemo(() => {
    // 根据行为数据判断当前最活跃的输入源
    const { pokerGames = [], billiardsSessions = [], fitnessSessions = [] } = yMineData;
    if (pokerGames.length > 0) return { field: '德州扑克', module: '时态↔凯利', icon: '♠️' };
    if (billiardsSessions.length > 0) return { field: '台球', module: '边界↔异常检测', icon: '🎱' };
    if (fitnessSessions.length > 0) return { field: '健身', module: '工程↔PACD', icon: '💪' };
    return { field: '暂无', module: '等待行为数据', icon: '📡' };
  }, [yMineData]);

  // 执行翻译
  const handleTranslate = () => {
    if (!inputText.trim()) {
      logger.ui('MindSpeak翻译: 输入为空');
      return;
    }
    const result = translate(inputText, yMineData);
    setTranslateResult(result);
    setMsState(getMindSpeakState());
    logger.session('MindSpeak翻译完成', {
      inputLength: inputText.length,
      activeModules: result.activeCount,
      steadyState: result.steadyState,
    });
  };

  // 重置状态
  const handleReset = () => {
    const initialState = {
      steadyState: calculateInitialSteadyState(yMineData),
      moduleConfidences: calculateModuleConfidences(yMineData),
      emergencyStop: false,
    };
    saveMindSpeakState(initialState);
    setMsState(initialState);
    setTranslateResult(null);
    logAudit('reset', { reason: '手动重置' });
    logger.session('MindSpeak状态已重置');
  };

  // 稳态颜色
  const getSteadyStateColor = (val) => {
    if (val < 0.42) return '#ef4444';
    if (val < 0.52) return '#f59e0b';
    if (val < 0.62) return '#10b981';
    return '#3b82f6';
  };

  // 稳态标签
  const getSteadyStateLabel = (val) => {
    if (val < 0.42) return '低稳态';
    if (val < 0.52) return '中低稳态';
    if (val < 0.62) return '中高稳态';
    return '高稳态';
  };

  return (
    <div className="mindspeak-page fade-in" style={{ padding: 16 }}>
      {/* 顶部导航 */}
      <Card style={{ marginBottom: 16, background: 'rgba(30, 19, 64, 0.6)' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/psychology')}>
              返回心理盘面
            </Button>
            <Button icon={<HomeOutlined />} onClick={() => navigate('/')}>
              总控台
            </Button>
            <Divider type="vertical" />
            <Title level={4} style={{ margin: 0 }}>
              🧠 认知引擎 · MindSpeak V19.0
            </Title>
          </Space>
          <Space>
            <Tag color="purple">Y.Mine 总控台 › 认知引擎</Tag>
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {/* 左侧：核心控制区 */}
        <Col xs={24} lg={16}>
          {/* 全局稳态 + 输入区 */}
          <Card
            title={
              <Space>
                <span style={{ fontSize: 20 }}>⚡</span>
                <span>全局稳态控制</span>
                <Tag color={getSteadyStateColor(steadyState)} style={{ marginLeft: 8 }}>
                  {getSteadyStateLabel(steadyState)}
                </Tag>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[24, 16]}>
              <Col xs={24} md={8}>
                <Statistic
                  title="全局稳态值"
                  value={steadyState.toFixed(3)}
                  precision={3}
                  valueStyle={{ color: getSteadyStateColor(steadyState) }}
                  prefix={<ThunderboltOutlined />}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  合法范围: 0.350 ~ 0.680
                </Text>
                <Progress
                  percent={((steadyState - 0.35) / 0.33) * 100}
                  showInfo={false}
                  strokeColor={getSteadyStateColor(steadyState)}
                  style={{ marginTop: 8 }}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="激活模块"
                  value={MODULES.filter((m) => (moduleConfidences[m.id] || 0) > 0.4).length}
                  suffix={`/ ${MODULES.length}`}
                  valueStyle={{ color: '#8b5cf6' }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  置信度阈值: 0.4
                </Text>
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="平均置信度"
                  value={(Object.values(moduleConfidences).reduce((a, b) => a + b, 0) / MODULES.length * 100).toFixed(1)}
                  suffix="%"
                  valueStyle={{ color: '#10b981' }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  基于当前行为数据
                </Text>
              </Col>
            </Row>

            <Divider />

            {/* 翻译输入 */}
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>认知翻译输入</Text>
              <TextArea
                rows={3}
                placeholder="输入需要翻译的文本，MindSpeak 将通过 11 个模块进行语言→数理→算法的映射..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPressEnter={(e) => {
                  if (e.shiftKey) return;
                  e.preventDefault();
                  handleTranslate();
                }}
              />
              <Space>
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleTranslate}>
                  执行翻译
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置状态
                </Button>
              </Space>
            </Space>

            {/* 翻译结果 */}
            {translateResult && (
              <>
                <Divider />
                <Alert
                  type="info"
                  showIcon
                  message="翻译完成"
                  description={translateResult.summary}
                />
              </>
            )}
          </Card>

          {/* 11 个模块卡片 */}
          <Card
            title={
              <Space>
                <span style={{ fontSize: 20 }}>🧩</span>
                <span>11 个语言 → 数理 → 算法映射模块</span>
              </Space>
            }
          >
            <Row gutter={[12, 12]}>
              {MODULES.map((mod) => {
                const conf = moduleConfidences[mod.id] || mod.defaultConfidence;
                const isActive = conf > 0.4;
                return (
                  <Col xs={24} sm={12} lg={8} key={mod.id}>
                    <Card
                      size="small"
                      style={{
                        background: isActive ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                        borderColor: isActive ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Space>
                            <span style={{ fontSize: 18 }}>{mod.icon}</span>
                            <Text strong>{mod.name}</Text>
                          </Space>
                          <Badge
                            status={isActive ? 'success' : 'default'}
                            text={isActive ? '激活' : '休眠'}
                          />
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {mod.description}
                        </Text>
                        <Space split={<Divider type="vertical" />} style={{ fontSize: 12 }}>
                          <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>
                            {mod.mathField}
                          </Tag>
                          <Text type="secondary">{mod.algorithm}</Text>
                        </Space>
                        <Progress
                          percent={conf * 100}
                          size="small"
                          showInfo={false}
                          strokeColor={isActive ? '#8b5cf6' : '#666'}
                        />
                        <Text type="secondary" style={{ fontSize: 11, textAlign: 'right' }}>
                          置信度 {(conf * 100).toFixed(1)}%
                        </Text>
                      </Space>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </Col>

        {/* 右侧：联动面板 + 审计日志 */}
        <Col xs={24} lg={8}>
          {/* Y.Mine 联动状态面板 */}
          <Card
            title={
              <Space>
                <LinkOutlined style={{ color: '#10b981' }} />
                <span>Y.Mine 联动状态</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>当前输入源</Text>
                <div>
                  <Tag color="purple">
                    {activeLinkModule.icon} {activeLinkModule.field}
                  </Tag>
                </div>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>情绪值 → 稳态映射</Text>
                <div>
                  <Text strong>{userState.emotion || 50}</Text>
                  <Text type="secondary"> → </Text>
                  <Text strong style={{ color: getSteadyStateColor(steadyState) }}>
                    {steadyState.toFixed(3)}
                  </Text>
                </div>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>风险偏好 → 偏置</Text>
                <div>
                  <Tag color={userState.riskPreference === 'conservative' ? 'blue' : userState.riskPreference === 'aggressive' ? 'red' : 'gold'}>
                    {userState.riskPreference === 'conservative' ? '保守' : userState.riskPreference === 'aggressive' ? '激进' : '均衡'}
                  </Tag>
                  <Text type="secondary"> → </Text>
                  <Text strong>
                    {userState.riskPreference === 'conservative' ? '-0.05' : userState.riskPreference === 'aggressive' ? '+0.05' : '0'}
                  </Text>
                </div>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>当前模块联动</Text>
                <div>
                  <Text strong>{activeLinkModule.module}</Text>
                </div>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>人格画像</Text>
                <div>
                  <Tag color="purple">{userState.currentMbti || 'INTP'}</Tag>
                  <Text type="secondary"> 置信度 {userState.mbtiConfidence || 60}%</Text>
                </div>
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <Alert
                type="info"
                showIcon
                icon={<DatabaseOutlined />}
                message="数据流"
                description="行为数据 → MindSpeak 翻译 → 画像/K线/音乐"
                style={{ fontSize: 12 }}
              />
            </Space>
          </Card>

          {/* 全景矩阵 */}
          <Card
            title={
              <Space>
                <span style={{ fontSize: 18 }}>🔲</span>
                <span>全景关联矩阵</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: 2, textAlign: 'left' }}></th>
                    {MODULES.map((m) => (
                      <th key={m.id} style={{ padding: 2, textAlign: 'center', transform: 'rotate(-45deg)', transformOrigin: 'bottom left', height: 50 }}>
                        <span style={{ whiteSpace: 'nowrap' }}>{m.icon}{m.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((m, i) => (
                    <tr key={m.id}>
                      <td style={{ padding: 2, whiteSpace: 'nowrap', fontSize: 11 }}>
                        {m.icon} {m.name}
                      </td>
                      {panopticMatrix[i]?.map((val, j) => (
                        <td
                          key={j}
                          style={{
                            padding: 2,
                            textAlign: 'center',
                            background: `rgba(139, 92, 246, ${val * 0.5})`,
                            fontSize: 10,
                          }}
                        >
                          {val.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 审计日志 */}
          <Card
            title={
              <Space>
                <span style={{ fontSize: 18 }}>📜</span>
                <span>审计日志</span>
                <Tag color="default" style={{ marginLeft: 8 }}>{auditLogs.length} 条</Tag>
              </Space>
            }
          >
            {auditLogs.length === 0 ? (
              <Text type="secondary">暂无认知记录，执行翻译后日志将显示在这里。</Text>
            ) : (
              <List
                size="small"
                dataSource={auditLogs}
                renderItem={(item) => (
                  <List.Item>
                    <Space direction="vertical" style={{ width: '100%' }} size={0}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Tag color="purple" style={{ margin: 0 }}>{item.action}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        激活模块: {item.details?.activeModules || '-'}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MindSpeakPage;
