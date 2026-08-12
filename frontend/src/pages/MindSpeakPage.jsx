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
  Modal,
  Tabs,
  Slider,
  Switch,
  Popconfirm,
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
  SafetyCertificateOutlined,
  AuditOutlined,
  StopOutlined,
  ExperimentOutlined,
  FrownOutlined,
  SmileOutlined,
  MehOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import mindSpeakEngine, {
  MODULES,
  calculateInitialSteadyState,
  calculateModuleConfidences,
  calculatePanopticMatrix,
  updateSteadyState,
  translate,
  getMindSpeakState,
  saveMindSpeakState,
  setManualPerturbation,
  triangleAudit,
} from '../utils/mindspeakEngine';
import { storage } from '../utils/storage';
import { logger } from '../utils/logger';
import { auditLogStore, busHealthCheck } from '../utils/storageBus';
import kmpIpdEngine, { getKmpState } from '../utils/kmpIpdEngine';
import {
  isFuseActive,
  getFuseState,
  resetFuse,
  emergencyStop,
  getFuseHistory,
} from '../utils/fuse';
import './MindSpeakPage.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const MindSpeakPage = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [translateResult, setTranslateResult] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [showModuleDetail, setShowModuleDetail] = useState(false);

  // 新增：熔断状态 Banner 显示
  const [fuseActive, setFuseActive] = useState(false);
  const [fuseState, setFuseState] = useState(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // 新增：±0.2 手动扰动滑块
  const [manualPerturb, setManualPerturbState] = useState(0);

  // 新增：右侧 Tab 索引（0=联动状态, 1=三角审计, 2=全景矩阵, 3=审计日志）
  const [rightTabKey, setRightTabKey] = useState('link');

  // 新增：审计日志刷新触发器
  const [auditRefreshTs, setAuditRefreshTs] = useState(Date.now());

  // 新增：KMP→IPD 记忆学习层状态
  const [kmpState, setKmpState] = useState(() => getKmpState());
  const [kmpStudy, setKmpStudy] = useState(null);

  // 从 Y.Mine 读取数据
  const yMineData = useMemo(() => storage.getAll() || {}, [translateResult, auditRefreshTs]);
  const userState = yMineData.userState || {};

  // MindSpeak 状态
  const [msState, setMsState] = useState(() => getMindSpeakState());

  // 初始化时从 state 中读取手动扰动
  useEffect(() => {
    setManualPerturbState(msState.manualPerturbation || 0);
  }, []);

  // 定时刷新熔断状态（防止其他页面触发熔断后这里不刷新）
  useEffect(() => {
    const t = setInterval(() => {
      const active = isFuseActive();
      setFuseActive(active);
      if (active || fuseState?.active) setFuseState(getFuseState());
    }, 800);
    return () => clearInterval(t);
  }, [fuseState]);

  // 计算各模块置信度
  const moduleConfidences = useMemo(() => {
    const confs = calculateModuleConfidences(yMineData);
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

  // 当前联动的模块
  const activeLinkModule = useMemo(() => {
    const { pokerGames = [], billiardsSessions = [], fitnessSessions = [] } = yMineData;
    if (pokerGames.length > 0) return { field: '德州扑克', module: '时态↔凯利', icon: '♠️' };
    if (billiardsSessions.length > 0) return { field: '台球', module: '边界↔异常检测', icon: '🎱' };
    if (fitnessSessions.length > 0) return { field: '健身', module: '工程↔PACD', icon: '💪' };
    return { field: '暂无', module: '等待行为数据', icon: '📡' };
  }, [yMineData]);

  // 新增：手动扰动滑块 change
  const handlePerturbChange = (value) => {
    setManualPerturbState(value);
    setManualPerturbation(value);
    setMsState(getMindSpeakState());
    logger.session(`[MindSpeak] 手动扰动: ${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`);
  };

  // 新增：紧急停机按钮
  const handleEmergencyStop = () => {
    const operator = userState?.name || '隐士';
    emergencyStop(operator);
    setFuseActive(true);
    setFuseState(getFuseState());
    setAuditRefreshTs(Date.now());
    logger.error('[MindSpeak] 用户手动触发紧急停机(L6)');
  };

  // 新增：解除熔断（仅 L6 允许直接解除）
  const handleResetFuse = (force = false) => {
    try {
      resetFuse(force);
      setFuseActive(false);
      setFuseState(getFuseState());
      setAuditRefreshTs(Date.now());
      logger.session('[MindSpeak] 熔断已解除，系统恢复');
    } catch (e) {
      Modal.warning({
        title: '⚠️ 解除熔断被拒绝',
        content: e.message,
      });
    }
  };

  // 执行翻译
  const handleTranslate = () => {
    if (!inputText.trim()) {
      logger.ui('MindSpeak翻译: 输入为空');
      return;
    }
    const result = translate(inputText, yMineData);
    setTranslateResult(result);
    setMsState(getMindSpeakState());
    setManualPerturbState(getMindSpeakState().manualPerturbation || 0);
    setAuditRefreshTs(Date.now());

    // 新增：翻译成功后触发 KMP→IPD 记忆学习闭环
    const kmp = kmpIpdEngine.study(result, yMineData);
    setKmpStudy(kmp);
    setKmpState(getKmpState());
    logger.session('KMP→IPD 记忆学习完成', {
      stored: kmp.stored?.id || null,
      tier: kmp.stored?._tier || null,
      candidates: kmp.candidates?.length || 0,
      verifyPass: kmp.verification?.passed,
    });
    logger.session('MindSpeak翻译完成', {
      inputLength: inputText.length,
      activeModules: result.activeCount,
      steadyState: result.steadyState,
      triangle: result.triangleAudit?.status || 'NONE',
    });
    // 如果三角审计 BLOCKED，自动切到对应 Tab
    if (result.triangleAudit && !result.triangleAudit.passed) {
      setRightTabKey('triangle');
    }
  };

  // 重置状态
  const handleReset = () => {
    const initialState = {
      steadyState: calculateInitialSteadyState(yMineData),
      moduleConfidences: calculateModuleConfidences(yMineData),
      emergencyStop: false,
      manualPerturbation: 0,
    };
    saveMindSpeakState(initialState);
    setMsState({ ...initialState });
    setManualPerturbState(0);
    setTranslateResult(null);
    auditLogStore.append('mindspeak', 'reset', { reason: '手动重置' });
    setAuditRefreshTs(Date.now());
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

  // 审计日志（不可篡改版，来自 auditLogStore）
  const auditLogs = useMemo(() => {
    const query = auditLogStore.query({ category: 'mindspeak', limit: 30 });
    return query.entries.slice().reverse();
  }, [auditRefreshTs, translateResult]);

  const auditIntegrity = useMemo(() => auditLogStore.tail(1).integrity, [auditRefreshTs]);

  // 熔断历史
  const fuseHistory = useMemo(() => getFuseHistory(10), [auditRefreshTs]);

  // ================= 右侧 Tab 的面板内容 =================
  const rightTabItems = [
    {
      key: 'link',
      label: (
        <span><LinkOutlined style={{ color: '#10b981' }} /> Y.Mine 联动</span>
      ),
      children: <LinkPanel activeLinkModule={activeLinkModule} userState={userState} steadyState={steadyState} getSteadyStateColor={getSteadyStateColor} />,
    },
    {
      key: 'triangle',
      label: (
        <span><SafetyCertificateOutlined style={{ color: '#a78bfa' }} /> 三角审计 STAGE-9</span>
      ),
      children: (
        <TrianglePanel
          translateResult={translateResult}
          steadyState={steadyState}
          moduleConfidences={moduleConfidences}
          panopticMatrix={panopticMatrix}
          activeCount={MODULES.filter((m) => (moduleConfidences[m.id] || 0) > 0.4).length}
          yMineData={yMineData}
        />
      ),
    },
    {
      key: 'matrix',
      label: (
        <span><ExperimentOutlined style={{ color: '#f59e0b' }} /> 全景关联矩阵</span>
      ),
      children: <MatrixPanel panopticMatrix={panopticMatrix} />,
    },
    {
      key: 'audit',
      label: (
        <span>
          <AuditOutlined style={{ color: '#ef4444' }} /> 审计日志
          {auditIntegrity === 'FAILED' && <Tag color="red" style={{ marginLeft: 4 }}>完整性异常</Tag>}
        </span>
      ),
      children: <AuditPanel logs={auditLogs} integrity={auditIntegrity} fuseHistory={fuseHistory} onRefresh={() => setAuditRefreshTs(Date.now())} />,
    },
    {
      key: 'kmp',
      label: (
        <span><DatabaseOutlined style={{ color: '#10b981' }} /> KMP→IPD 记忆</span>
      ),
      children: (
        <KmpPanel
          kmpState={kmpState}
          kmpStudy={kmpStudy}
          onTriggerStudy={() => {
            if (translateResult) {
              const kmp = kmpIpdEngine.study(translateResult, yMineData);
              setKmpStudy(kmp);
              setKmpState(getKmpState());
            }
          }}
        />
      ),
    },
  ];

  return (
    <div className="mindspeak-page fade-in">
      {/* ① 顶部：熔断激活大红色警告条 */}
      {fuseActive && (
        <Alert
          type="error"
          showIcon
          icon={<StopOutlined />}
          style={{
            marginBottom: 12,
            border: '2px solid #b91c1c',
            background: 'linear-gradient(90deg, rgba(185,28,28,0.22), rgba(239,68,68,0.08))',
          }}
          message={
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Tag color="red" style={{ fontSize: 14, padding: '4px 12px' }}>
                  🚨 {fuseState?.triggeredLayer?.name || '熔断'} 已激活 · canBypass=false
                </Tag>
                <Text strong style={{ color: '#fee2e2' }}>
                  原因: {fuseState?.triggerReason || '未说明'}
                </Text>
              </Space>
              <Space>
                <Text type="secondary" style={{ color: '#fecaca' }}>
                  触发时间: {fuseState?.triggeredAt ? new Date(fuseState.triggeredAt).toLocaleTimeString() : '-'}
                </Text>
                {fuseState?.triggeredLayer?.id === 'MANUAL_STOP' ? (
                  <Button type="primary" danger size="small" onClick={() => handleResetFuse(false)}>
                    解除熔断(L6 手动)
                  </Button>
                ) : (
                  <Popconfirm
                    title="⚠️ 非 L6 熔断强制解除"
                    description="当前熔断层级非手动停机，安全规范禁止直接解除。确认强制解除会写入审计警告日志。是否继续？"
                    onConfirm={() => handleResetFuse(true)}
                    okText="强制解除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button size="small" danger ghost>
                      强制解除(仅限演示)
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Space>
          }
          description={
            <Text style={{ color: '#fecaca' }}>
              所有认知翻译输出已阻断（结果将标记 blocked=true），直到熔断解除。
              {fuseState?.triggeredLayer?.id !== 'MANUAL_STOP' && (
                <> 建议先排查故障原因，再执行强制解除。</>
              )}
            </Text>
          }
        />
      )}

      {/* 顶部导航 */}
      <Card className="mindspeak-header-card">
        <Space className="mindspeak-header-content">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/psychology')}>
              返回心理盘面
            </Button>
            <Button icon={<HomeOutlined />} onClick={() => navigate('/dashboard')}>
              总控台
            </Button>
            <Divider type="vertical" />
            <Title level={4} className="mindspeak-title">
              🧠 认知引擎 · MindSpeak V19.1
              <Tag color="purple" style={{ marginLeft: 8, fontSize: 12 }}>
                Game-OS V2.1 工程化
              </Tag>
            </Title>
          </Space>
          <Space>
            <Tag color={fuseActive ? 'red' : 'green'}>
              {fuseActive ? '🔴 熔断激活' : '🟢 正常运行'}
            </Tag>
            <Tag color="purple">Y.Mine 总控台 › 认知引擎</Tag>
            {/* 🆕 红色紧急停机按钮（L6） */}
            <Popconfirm
              title="🛑 确认触发紧急停机？"
              description="一旦按下，所有认知引擎输出立即阻断，仓位强制归零，写入不可篡改审计日志（canBypass = false）。"
              onConfirm={handleEmergencyStop}
              okText="立即停机"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              disabled={fuseActive}
            >
              <Button
                danger
                type={fuseActive ? 'default' : 'primary'}
                icon={<StopOutlined />}
                style={fuseActive ? { opacity: 0.5 } : {
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  border: 'none',
                  boxShadow: '0 0 0 2px rgba(220,38,38,0.25), 0 4px 16px rgba(220,38,38,0.35)',
                }}
              >
                🛑 紧急停机
              </Button>
            </Popconfirm>
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {/* 左侧：核心控制区 */}
        <Col xs={24} lg={16}>
          {/* 全局稳态 + 输入区 */}
          <Card
            className="mindspeak-steady-card"
            title={
              <Space>
                <span style={{ fontSize: 20 }}>⚡</span>
                <span>全局稳态控制</span>
                <Tag color={getSteadyStateColor(steadyState)} className="mindspeak-steady-label">
                  {getSteadyStateLabel(steadyState)}
                </Tag>
                {Math.abs(manualPerturb) > 0.001 && (
                  <Tag color="geekblue">
                    手动扰动 {manualPerturb > 0 ? '+' : ''}{(manualPerturb * 100).toFixed(0)}%
                  </Tag>
                )}
              </Space>
            }
            extra={
              <Tooltip title="总线健康检查：pipeline只读 / draft可写 / auditLog不可篡改">
                <Tag icon={<DatabaseOutlined />} color={busHealthCheck().status === 'HEALTHY' ? 'green' : 'red'}>
                  BUS: {busHealthCheck().status}
                </Tag>
              </Tooltip>
            }
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
                <Text type="secondary" className="mindspeak-stat-desc">
                  合法范围: 0.350 ~ 0.680
                </Text>
                <Progress
                  percent={((steadyState - 0.35) / 0.33) * 100}
                  showInfo={false}
                  strokeColor={getSteadyStateColor(steadyState)}
                  className="mindspeak-stat-progress"
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="激活模块"
                  value={MODULES.filter((m) => (moduleConfidences[m.id] || 0) > 0.4).length}
                  suffix={`/ ${MODULES.length}`}
                  valueStyle={{ color: '#8b5cf6' }}
                />
                <Text type="secondary" className="mindspeak-stat-desc">
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
                <Text type="secondary" className="mindspeak-stat-desc">
                  基于当前行为数据
                </Text>
              </Col>
            </Row>

            {/* 🆕 手动扰动 ±0.2 滑块 + 自动回归说明 */}
            <Divider />
            <div style={{ marginBottom: 16 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text strong>
                  <SettingOutlined /> 稳态扰动滑块（±20%）
                </Text>
                <Space>
                  <Tooltip title="扰动值自动在 [−0.2, 0.2] 之间裁剪">
                    <Text type="secondary">
                      当前扰动：
                      <Text strong style={{ color: manualPerturb === 0 ? '#64748b' : (manualPerturb > 0 ? '#3b82f6' : '#ec4899') }}>
                        {manualPerturb > 0 ? '+' : ''}{(manualPerturb * 100).toFixed(0)}%
                      </Text>
                    </Text>
                  </Tooltip>
                  <Button
                    size="small"
                    disabled={manualPerturb === 0}
                    onClick={() => handlePerturbChange(0)}
                  >
                    归零
                  </Button>
                </Space>
              </Space>
              <Slider
                min={-0.2}
                max={0.2}
                step={0.01}
                value={manualPerturb}
                onChange={handlePerturbChange}
                tooltip={{ formatter: (v) => `${((v || 0) * 100).toFixed(0)}%` }}
                marks={{
                  '-0.2': <Tag color="magenta">-20%</Tag>,
                  '-0.1': <Tag>-10%</Tag>,
                  '0': <Tag color="green">0 稳态</Tag>,
                  '0.1': <Tag>+10%</Tag>,
                  '0.2': <Tag color="blue">+20%</Tag>,
                }}
              />
              <Text type="secondary" style={{ display: 'block', marginTop: -4 }}>
                <SmileOutlined /> 观察系统偏离 0.5 中轴线后的自动收敛行为。每次翻译后，有 8% 的力度把稳态拉回 0.5。
              </Text>
            </div>

            <Divider />

            {/* 翻译输入 */}
            <Space direction="vertical" className="mindspeak-translate-section">
              <Text strong>认知翻译输入</Text>
              <TextArea
                rows={3}
                placeholder="输入需要翻译的文本，MindSpeak 将通过 11 个模块进行语言→数理→算法的映射，并强制通过三模型三角审计 (STAGE-9, ±0.02 容差)..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPressEnter={(e) => {
                  if (e.shiftKey) return;
                  e.preventDefault();
                  handleTranslate();
                }}
                disabled={fuseActive}
                style={fuseActive ? { background: 'rgba(239,68,68,0.08)', color: '#991b1b' } : {}}
              />
              <Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleTranslate}
                  danger={fuseActive}
                  disabled={fuseActive}
                >
                  {fuseActive ? '🚫 熔断阻断 · 无法翻译' : '执行翻译'}
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置状态
                </Button>
              </Space>
            </Space>

            {/* 翻译结果详情 */}
            {translateResult && (
              <>
                <Divider />

                <Alert
                  type={translateResult.blocked ? 'error' : (translateResult.triangleAudit?.passed ? 'success' : 'warning')}
                  showIcon
                  icon={translateResult.blocked ? <StopOutlined /> : (translateResult.triangleAudit?.passed ? <SafetyCertificateOutlined /> : <WarningOutlined />)}
                  message={translateResult.blocked ? '输出阻断 (blocked=true)' : (translateResult.triangleAudit?.passed ? '翻译完成 · 三模型校验通过' : '翻译完成 · 三角审计未通过，结果标记为阻断')}
                  description={translateResult.summary}
                  className="mindspeak-translate-alert"
                />

                {/* 关键指标 */}
                <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
                  <Col xs={8}>
                    <Statistic
                      title="稳态值"
                      value={translateResult.steadyState.toFixed(3)}
                      precision={3}
                      valueStyle={{ color: getSteadyStateColor(translateResult.steadyState) }}
                      prefix={<ThunderboltOutlined />}
                    />
                  </Col>
                  <Col xs={8}>
                    <Statistic
                      title="激活模块"
                      value={translateResult.activeCount}
                      suffix={`/ ${translateResult.totalCount}`}
                      valueStyle={{ color: '#8b5cf6' }}
                    />
                  </Col>
                  <Col xs={8}>
                    <Statistic
                      title="平均置信度"
                      value={(translateResult.avgConfidence * 100).toFixed(1)}
                      suffix="%"
                      valueStyle={{ color: '#10b981' }}
                    />
                  </Col>
                </Row>

                {/* 🆕 三角审计快速结果条 */}
                {translateResult.triangleAudit && (
                  <TriangleQuickBar audit={translateResult.triangleAudit} />
                )}

                {/* 模块输出详情 */}
                <div style={{ marginTop: 16 }}>
                  <Text strong style={{ marginBottom: 8, display: 'block' }}>
                    各模块输出详情（按置信度排序）
                  </Text>
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={[...translateResult.moduleOutputs].sort((a, b) => b.confidence - a.confidence)}
                    rowKey="moduleId"
                    columns={[
                      {
                        title: '模块',
                        dataIndex: 'moduleName',
                        key: 'moduleName',
                        width: 100,
                        render: (name, record) => (
                          <Space>
                            <Badge status={record.active ? 'success' : 'default'} />
                            <Text strong={record.active}>{name}</Text>
                          </Space>
                        ),
                      },
                      {
                        title: '状态',
                        dataIndex: 'active',
                        key: 'active',
                        width: 60,
                        render: (active) => (
                          <Tag color={active ? 'success' : 'default'}>
                            {active ? '激活' : '休眠'}
                          </Tag>
                        ),
                      },
                      {
                        title: '置信度',
                        dataIndex: 'confidence',
                        key: 'confidence',
                        render: (conf) => (
                          <Progress
                            percent={conf * 100}
                            size="small"
                            showInfo
                            strokeColor={conf > 0.4 ? '#8b5cf6' : '#666'}
                          />
                        ),
                      },
                    ]}
                  />
                </div>
              </>
            )}
          </Card>

          {/* 11 个模块卡片 */}
          <Card
            className="mindspeak-modules-card"
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
                      hoverable
                      className={`mindspeak-module-card ${isActive ? 'active' : 'inactive'}`}
                      onClick={() => {
                        setSelectedModule(mod);
                        setShowModuleDetail(true);
                      }}
                    >
                      <Space direction="vertical" size={4} className="mindspeak-module-content">
                        <Space className="mindspeak-module-header">
                          <Space>
                            <span className="mindspeak-module-icon">{mod.icon}</span>
                            <Text strong>{mod.name}</Text>
                          </Space>
                          <Badge
                            status={isActive ? 'success' : 'default'}
                            text={isActive ? '激活' : '休眠'}
                          />
                        </Space>
                        <Text type="secondary" className="mindspeak-module-desc">
                          {mod.description}
                        </Text>
                        <Space split={<Divider type="vertical" />} className="mindspeak-module-meta">
                          <Tag color="purple" className="mindspeak-module-tag">
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
                        <Text type="secondary" className="mindspeak-module-conf-text">
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

        {/* 右侧：联动/三角审计/矩阵/审计 Tabs */}
        <Col xs={24} lg={8}>
          <Card
            bodyStyle={{ padding: 0 }}
            className="mindspeak-right-tabs-card"
          >
            <Tabs
              activeKey={rightTabKey}
              onChange={setRightTabKey}
              defaultActiveKey="link"
              items={rightTabItems}
              size="small"
              style={{ paddingTop: 0 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 模块详情弹窗 */}
      <Modal
        title={
          <Space>
            <span style={{ fontSize: 24 }}>{selectedModule?.icon}</span>
            <Title level={4} style={{ margin: 0 }}>{selectedModule?.name}</Title>
            <Tag color="purple">{selectedModule?.mathField}</Tag>
          </Space>
        }
        open={showModuleDetail}
        onCancel={() => setShowModuleDetail(false)}
        footer={[
          <Button key="close" onClick={() => setShowModuleDetail(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedModule && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="模块说明"
              description={selectedModule.description}
            />

            <div>
              <Text strong>数学领域</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color="purple">{selectedModule.mathField}</Tag>
              </div>
            </div>

            <div>
              <Text strong>核心算法</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color="blue">{selectedModule.algorithm}</Tag>
              </div>
            </div>

            <div>
              <Text strong>Y.Mine 联动字段</Text>
              <div style={{ marginTop: 4 }}>
                {selectedModule.yMineField ? (
                  <Tag color="green">{selectedModule.yMineField}</Tag>
                ) : (
                  <Tag color="default">基础模块，无外部依赖</Tag>
                )}
              </div>
            </div>

            <Divider />

            <div>
              <Text strong>数学原理</Text>
              <Paragraph style={{ marginTop: 8, lineHeight: 1.8 }}>
                {getModuleMathPrinciple(selectedModule.id)}
              </Paragraph>
            </div>

            <div>
              <Text strong>应用场景</Text>
              <Paragraph style={{ marginTop: 8, lineHeight: 1.8 }}>
                {getModuleUseCase(selectedModule.id)}
              </Paragraph>
            </div>

            <div>
              <Text strong>当前置信度</Text>
              <div style={{ marginTop: 8 }}>
                <Progress
                  percent={(moduleConfidences[selectedModule.id] || selectedModule.defaultConfidence) * 100}
                  strokeColor="#8b5cf6"
                />
              </div>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

// ============= 右侧 Tab 子组件 =============

function LinkPanel({ activeLinkModule, userState, steadyState, getSteadyStateColor }) {
  return (
    <div style={{ padding: '8px 16px 16px' }}>
      <Space direction="vertical" className="mindspeak-link-section" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" className="mindspeak-link-label">当前输入源</Text>
          <div>
            <Tag color="purple">
              {activeLinkModule.icon} {activeLinkModule.field}
            </Tag>
          </div>
        </div>

        <div>
          <Text type="secondary" className="mindspeak-link-label">情绪值 → 稳态映射</Text>
          <div>
            <Text strong>{userState.emotion || 50}</Text>
            <Text type="secondary"> → </Text>
            <Text strong style={{ color: getSteadyStateColor(steadyState) }}>
              {steadyState.toFixed(3)}
            </Text>
          </div>
        </div>

        <div>
          <Text type="secondary" className="mindspeak-link-label">风险偏好 → 偏置</Text>
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
          <Text type="secondary" className="mindspeak-link-label">当前模块联动</Text>
          <div>
            <Text strong>{activeLinkModule.module}</Text>
          </div>
        </div>

        <div>
          <Text type="secondary" className="mindspeak-link-label">人格画像</Text>
          <div>
            <Tag color="purple">{userState.currentMbti || 'INTP'}</Tag>
            <Text type="secondary"> 置信度 {userState.mbtiConfidence || 60}%</Text>
          </div>
        </div>

        <Divider className="mindspeak-divider-tight" />

        <Alert
          type="info"
          showIcon
          icon={<DatabaseOutlined />}
          message="数据流 (三分区总线)"
          description={
            <div>
              <div>📥 <Text code>pipeline_*</Text> 只读：官方流水线提交</div>
              <div>📝 <Text code>draft_*</Text> 可写：草稿/临时状态</div>
              <div>📜 <Text code>audit_log_*</Text> 仅追加不可篡改 + HMAC签名</div>
            </div>
          }
          className="mindspeak-dataflow-alert"
        />
      </Space>
    </div>
  );
}

function TrianglePanel({ translateResult, steadyState, moduleConfidences, panopticMatrix, activeCount, yMineData }) {
  // 如果有 translateResult 用它的审计；否则实时计算一次演示
  const audit = useMemo(() => {
    if (translateResult?.triangleAudit) return translateResult.triangleAudit;
    const avgConf = Object.values(moduleConfidences).reduce((a, b) => a + b, 0) / Math.max(1, MODULES.length);
    return triangleAudit(
      steadyState, avgConf, activeCount, MODULES.length,
      moduleConfidences, panopticMatrix, yMineData
    );
  }, [translateResult, steadyState, moduleConfidences, panopticMatrix, activeCount, yMineData]);

  const engines = [
    { name: 'CALC 金融精算', icon: '💰', desc: '凯利仓位精算模型' },
    { name: 'GameMind 博弈博弈', icon: '♠️' },
    { name: 'geom-compute', icon: '📐', desc: '几何心智算力底座' },
  ];

  return (
    <div style={{ padding: '8px 16px 16px' }}>
      <Alert
        type={audit.passed ? 'success' : 'error'}
        showIcon
        icon={<SafetyCertificateOutlined />}
        style={{ marginBottom: 12 }}
        message={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Tag color={audit.passed ? 'green' : 'red'} style={{ fontSize: 14, padding: '4px 10px' }}>
                STAGE-9: {audit.status}
              </Tag>
              <Text strong>容差 ±{audit.tolerance}，实测最大偏差 {audit.maxDev}</Text>
            </Space>
            {audit.at && <Text type="secondary">{new Date(audit.at).toLocaleTimeString()}</Text>}
          </Space>
        }
        description={
          audit.passed
            ? '三模型输出偏差都在 ±0.02 阈值内，结论一致，结果放行。'
            : '三模型输出分歧过大，结果已标记 blocked=true 阻断交付！'
        }
      />

      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          三模型独立评分（CALC / GameMind / geom-compute）
        </Text>
        <Row gutter={[8, 8]}>
          {audit.scores.map((score, i) => {
            const info = engines[i] || {};
            const ok = score !== 0;
            return (
              <Col xs={24} sm={8} key={i}>
                <Card
                  size="small"
                  style={{
                    borderColor: ok ? 'rgba(139,92,246,0.3)' : '#ef4444',
                    background: `linear-gradient(135deg, rgba(139,92,246,${ok ? 0.08 : 0.04}), rgba(236,72,153,${ok ? 0.05 : 0.02}))`,
                  }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space>
                      <span style={{ fontSize: 20 }}>{info.icon}</span>
                      <Text strong>{info.name}</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>{info.desc}</Text>
                    <Progress
                      percent={score * 100}
                      size="small"
                      format={(p) => <Text strong style={{ color: score === 0 ? '#ef4444' : '#8b5cf6' }}>{audit.labels?.[i] || `${(score * 100).toFixed(1)}%`}</Text>}
                      strokeColor={score === 0 ? '#ef4444' : '#8b5cf6'}
                    />
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <div>
        <Text strong>模型两两偏差矩阵</Text>
        <Table
          size="small"
          pagination={false}
          style={{ marginTop: 8 }}
          dataSource={[
            ['CALC', audit.scores[0], audit.scores[1], Math.abs(audit.scores[0] - audit.scores[1])],
            ['GAME', audit.scores[1], audit.scores[2], Math.abs(audit.scores[1] - audit.scores[2])],
            ['GEOM', audit.scores[2], audit.scores[0], Math.abs(audit.scores[2] - audit.scores[0])],
          ].map((r, i) => ({ key: i, left: r[0], s1: r[1], s2: r[2], dev: r[3] }))}
          columns={[
            { title: '模型', dataIndex: 'left', key: 'left', width: 70 },
            { title: 'Score A', dataIndex: 's1', key: 's1', render: (v) => Number(v).toFixed(4) },
            { title: 'Score B', dataIndex: 's2', key: 's2', render: (v) => Number(v).toFixed(4) },
            {
              title: '|Δ|',
              dataIndex: 'dev',
              key: 'dev',
              render: (v) => {
                const bad = v > audit.tolerance;
                return (
                  <Tag color={bad ? 'red' : 'green'}>
                    {Number(v).toFixed(4)}{bad ? ` > ${audit.tolerance}` : ''}
                  </Tag>
                );
              },
            },
          ]}
        />
      </div>

      {audit.details && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div>
            <Text strong>各模型内部计算细节</Text>
            <List
              size="small"
              style={{ marginTop: 8 }}
              dataSource={audit.details}
              renderItem={(d, i) => (
                <List.Item key={i}>
                  <Space>
                    <Tag color="purple">{['CALC', 'GAME', 'GEOM'][i]}</Tag>
                    <Text code>{JSON.stringify(d || {})}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MatrixPanel({ panopticMatrix }) {
  return (
    <div style={{ padding: '8px 16px 16px' }}>
      <div className="mindspeak-matrix-wrap" style={{ overflowX: 'auto' }}>
        <table className="mindspeak-matrix-table" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th className="mindspeak-matrix-corner"></th>
              {MODULES.map((m) => (
                <th key={m.id} style={{ fontSize: 12, padding: '6px 4px' }}>
                  <span>{m.icon}{m.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m, i) => (
              <tr key={m.id}>
                <td className="mindspeak-matrix-row-label" style={{ fontSize: 12 }}>
                  {m.icon} {m.name}
                </td>
                {panopticMatrix[i]?.map((val, j) => (
                  <td
                    key={j}
                    style={{
                      background: `rgba(139, 92, 246, ${val * 0.5})`,
                      fontSize: 11,
                      padding: '6px 4px',
                      color: val > 0.55 ? '#fff' : '#cbd5e1',
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
    </div>
  );
}

function AuditPanel({ logs, integrity, fuseHistory, onRefresh }) {
  return (
    <div style={{ padding: '8px 16px 16px' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <Space>
          <Tag color={integrity === 'OK' ? 'green' : 'red'} icon={<SafetyCertificateOutlined />}>
            签名完整性: {integrity}
          </Tag>
          <Tag color="purple">{logs.length} 条</Tag>
        </Space>
        <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>刷新</Button>
      </Space>

      {integrity !== 'OK' && (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 8 }}
          message="审计日志完整性异常！"
          description="至少有一条日志的 HMAC 签名不匹配，表明本地 localStorage 审计日志可能被手工修改。_tampered 字段会标记这些条目。"
        />
      )}

      <Divider style={{ margin: '8px 0' }} />

      <Text strong>熔断触发/解除历史（最近 10 条）</Text>
      {fuseHistory.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>暂无熔断历史</Text>
      ) : (
        <List
          size="small"
          style={{ marginBottom: 12 }}
          dataSource={fuseHistory}
          renderItem={(item) => (
            <List.Item key={item.at + item.type}>
              <Space size={4}>
                <Tag color={item.type === 'TRIGGER' ? 'red' : 'green'}>
                  {item.type === 'TRIGGER' ? `${item.layer?.name || '熔断'}触发` : '解除'}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {item.at ? new Date(item.at).toLocaleTimeString() : ''}
                </Text>
                {item.reason && <Text style={{ fontSize: 12 }}>{item.reason}</Text>}
              </Space>
            </List.Item>
          )}
        />
      )}

      <Divider style={{ margin: '8px 0' }} />

      <Text strong>MindSpeak 审计日志（仅追加，不可篡改）</Text>
      {logs.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>暂无认知记录，执行翻译或触发熔断后日志将显示在这里。</Text>
      ) : (
        <List
          size="small"
          dataSource={logs}
          renderItem={(item) => (
            <List.Item style={{ alignItems: 'flex-start', padding: '6px 0' }}>
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Space wrap size={4}>
                  <Tag
                    color={
                      item.action?.includes('FAIL') || item.action?.includes('BLOCKED') || item.action?.includes('EXCEPTION')
                        ? 'red'
                        : item.action?.includes('PASS') || item.action === 'translate'
                        ? 'green'
                        : item.action === 'FUSE_TRIGGERED'
                        ? 'volcano'
                        : 'purple'
                    }
                    style={{ fontSize: 11, padding: '1px 6px' }}
                  >
                    {item._tampered ? '⚠️ ' : ''}{item.action}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {item.iso?.slice(11, 19) || new Date(item.timestamp).toLocaleTimeString()}
                  </Text>
                  {item.details?.triangleStatus && (
                    <Tag color={item.details.triangleStatus === 'PASSED' ? 'green' : 'red'} style={{ fontSize: 11 }}>
                      三角: {item.details.triangleStatus} (Δ={item.details.triangleMaxDev})
                    </Tag>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.5 }}>
                  {item.details && typeof item.details === 'object'
                    ? Object.entries(item.details)
                        .slice(0, 4)
                        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : v}`)
                        .join(' · ')
                    : String(item.details || '').slice(0, 80)}
                </Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  );
}

function TriangleQuickBar({ audit }) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: '12px 16px',
        borderRadius: 12,
        border: `1px solid ${audit.passed ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.35)'}`,
        background: audit.passed
          ? 'linear-gradient(90deg, rgba(16,185,129,0.08), rgba(139,92,246,0.05))'
          : 'linear-gradient(90deg, rgba(239,68,68,0.10), rgba(185,28,28,0.04))',
      }}
    >
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Space wrap>
          <Tag color={audit.passed ? 'green' : 'red'} style={{ fontSize: 13 }}>
            <SafetyCertificateOutlined /> STAGE-9 · {audit.status}
          </Tag>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>CALC</Text>
            <Tag color="purple">{audit.labels?.[0]} {(audit.scores?.[0] * 100).toFixed(1)}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>GAME</Text>
            <Tag color="geekblue">{audit.labels?.[1]} {(audit.scores?.[1] * 100).toFixed(1)}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>geom</Text>
            <Tag color="gold">{audit.labels?.[2]} {(audit.scores?.[2] * 100).toFixed(1)}</Tag>
          </Space>
        </Space>
        <Text strong style={{ color: audit.passed ? '#10b981' : '#ef4444' }}>
          max |Δ| = {audit.maxDev} {audit.maxDev > audit.tolerance ? `> ${audit.tolerance}` : `≤ ${audit.tolerance}`}
        </Text>
      </Space>
    </div>
  );
}

// ============= KMP→IPD 记忆学习层面板 =============

const KMP_STEP_META = {
  passed:  { color: '#10b981', icon: '✅' },
  warning: { color: '#f59e0b', icon: '⚠️' },
  blocked: { color: '#ef4444', icon: '🚫' },
  waiting: { color: '#6b7280', icon: '⏸' },
};

function KmpPanel({ kmpState, kmpStudy, onTriggerStudy }) {
  const tiers = kmpState?.tiers || {};
  const vectorDims = kmpState?.vectorDims || [];
  const steps = kmpStudy?.steps || [];

  return (
    <div style={{ padding: '8px 16px 16px' }}>
      {/* 六步闭环进度 */}
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        🧠 六步学习闭环（感知→建模→存储→检索→验证→进化）
      </Text>
      {steps.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          尚未运行记忆学习，执行一次认知翻译即可触发。
        </Text>
      ) : (
        <Row gutter={[6, 6]} style={{ marginBottom: 12 }}>
          {steps.map((s, i) => {
            const meta = KMP_STEP_META[s.status] || KMP_STEP_META.waiting;
            return (
              <Col xs={12} sm={8} key={i}>
                <Card
                  size="small"
                  style={{
                    borderColor: meta.color,
                    background: `linear-gradient(135deg, rgba(139,92,246,${s.status === 'passed' ? 0.08 : 0.03}), rgba(16,185,129,${s.status === 'passed' ? 0.05 : 0.02}))`,
                  }}
                >
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space>
                      <Text strong style={{ fontSize: 12 }}>{meta.icon} {s.step}</Text>
                      <Tag color={s.status === 'passed' ? 'green' : s.status === 'blocked' ? 'red' : 'default'} style={{ fontSize: 10 }}>{s.status}</Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 10, lineHeight: 1.4 }}>
                      {typeof s.data === 'object' && s.data?.reason
                        ? s.data.reason
                        : s.step === '存储' && s.data?.id
                          ? `#${s.data.id.slice(-6)} · ${s.data.tier}`
                          : s.step === '检索'
                            ? `${s.data?.scanned} 命中`
                            : s.step === '进化' && s.data?.strength
                              ? `强度 ${s.data.strength}`
                              : '完成'}
                    </Text>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* 熔断阻断提示 */}
      {kmpStudy?.blocked && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message="熔断激活，记忆学习已阻断" description={kmpStudy.fuseState?.triggerReason || '未说明'} />
      )}

      {/* 期望被人工触发主动学习 */}
      <Button size="small" icon={<DatabaseOutlined />} onClick={onTriggerStudy} style={{ marginBottom: 12 }}>
        手动触发记忆学习
      </Button>

      <Divider style={{ margin: '12px 0' }} />

      {/* 三级仓储仪表盘 */}
      <Text strong style={{ display: 'block', marginBottom: 8 }}>💾 三级仓储（HOT 长期公理 / WARM 缓冲复审 / COLD 废弃归档）</Text>
      <Row gutter={[8, 8]}>
        {[
          { key: 'hot', label: '🔥 HOT 长期公理库', color: '#ef4444', desc: '高频命中 · KMP检索主索引' },
          { key: 'warm', label: '🌤️ WARM 缓冲复审库', color: '#f59e0b', desc: '待升华/待复核' },
          { key: 'cold', label: '❄️ COLD 废弃归档库', color: '#6b7280', desc: '低热度 · 压缩归档' },
        ].map((t) => (
          <Col xs={24} sm={8} key={t.key}>
            <Card size="small" style={{ borderColor: `${t.color}66` }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text strong style={{ fontSize: 12 }}>{t.label}</Text>
                <Progress
                  percent={(tiers[t.key]?.count || 0) * 10}
                  showInfo={false}
                  strokeColor={t.color}
                  size="small"
                />
                <Text style={{ fontSize: 20 }} strong>{tiers[t.key]?.count || 0}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{t.desc}</Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider style={{ margin: '12px 0' }} />

      {/* 最近记忆流 */}
      <Text strong style={{ display: 'block', marginBottom: 8 }}>📥 最近记忆（HOT 库）</Text>
      {(tiers.hot?.entries || []).length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>暂无记忆。</Text>
      ) : (
        <List
          size="small"
          dataSource={tiers.hot.entries.slice(0, 5)}
          renderItem={(m) => (
            <List.Item style={{ alignItems: 'flex-start', padding: '4px 0' }}>
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                <Space wrap size={4}>
                  <Tag color="purple" style={{ fontSize: 10 }}>{m.label}</Tag>
                  <Text style={{ fontSize: 11 }}>{m.text?.slice(0, 24)}</Text>
                  <Tag color="green" style={{ fontSize: 10 }}>强度 {m.strength?.toFixed(2)}</Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 10 }}>
                  {m.magnitude !== undefined ? `幅值 ${m.magnitude} · ` : ''}{m.hitCount || 0} 次命中
                </Text>
              </Space>
            </List.Item>
          )}
        />
      )}

      <Divider style={{ margin: '12px 0' }} />

      {/* 七维向量维度说明 */}
      <Text strong style={{ display: 'block', marginBottom: 8 }}>📐 七维向量体系</Text>
      <Table
        size="small"
        pagination={false}
        style={{ marginTop: 4 }}
        dataSource={vectorDims}
        rowKey="id"
        columns={[
          { title: '维度', dataIndex: 'id', key: 'id', width: 70, render: (v) => <Tag color="geekblue">{v}</Tag> },
          { title: '名称', dataIndex: 'name', key: 'name', width: 80 },
          { title: '含义', dataIndex: 'desc', key: 'desc' },
        ]}
      />
    </div>
  );
}

// ============= 模块详情辅助函数 =============

function getModuleMathPrinciple(moduleId) {
  const principles = {
    translator: '通过建立语义符号与数学符号之间的双射关系，将自然语言映射到集合论空间。每个语义单元被视为一个集合，翻译过程就是寻找两个集合之间的最优对应关系。使用双向映射矩阵确保翻译的可逆性。',
    wordOrder: '利用群论中的置换群概念，分析句子成分的排列规律。每个语序都是一个置换操作，通过检测置换的奇偶性和循环分解，识别语言的交换律特征。置换群的阶数反映了语言语序的自由度。',
    tense: '基于时态逻辑（Temporal Logic），将时间参照点建模为分支时间结构。使用凯利公式（Kelly Criterion）计算不同时间分支的最优投注比例，时态偏差直接映射为凯利偏差值。',
    affix: '将词缀的添加与移除建模为多项式的因式分解与展开。前缀对应提取公因子，后缀对应展开项。通过代数方法识别词的"根"与"系数"，实现词结构的代数化表示。',
    passive: '利用线性代数中的对偶空间概念，将主动语态和被动语态视为一对对偶向量。语态转换等同于转置矩阵运算，确保语义在转换过程中保持范数不变。',
    polysemy: '使用贝叶斯后验估计进行歧义消解。每个义项都是一个先验假设，上下文提供似然证据，通过贝叶斯公式计算后验概率，选择最大后验假设作为消歧结果。',
    culture: '将文化语境约束建模为机器学习中的正则化项。文化差异对应 L1/L2 正则化强度，用于防止模型过拟合特定语境。正则化权重由文化差异程度动态调整。',
    boundary: '使用拓扑学中的边界检测概念识别语法边界。将语法结构视为拓扑空间，句子成分的边界是空间中的闭包。使用孤立森林算法检测边界异常点。',
    chickenRabbit: '将混合约束问题建模为整数规划。使用分支定界法（Branch and Bound）在解空间中搜索满足所有约束的整数解，类似经典的鸡兔同笼问题的求解策略。',
    engineering: '借鉴控制论中的 PID 反馈控制循环（Proportional-Integral-Derivative）。将语法正确性检查建模为 PACD 循环，通过比例、积分、微分三个环节的反馈迭代确保语法输出的稳定性。',
    enumeration: '使用组合数学中的计数原理进行分类列举。将枚举问题转化为递推关系求解，通过建立状态转移方程计算所有可能的组合数，确保枚举的完备性和无重复性。',
  };
  return principles[moduleId] || '该模块的数学原理正在研究中。';
}

function getModuleUseCase(moduleId) {
  const useCases = {
    translator: '跨语言翻译、多语言对齐、语义搜索、知识图谱构建。当需要将自然语言转换为可计算的符号表示时使用。',
    wordOrder: '句法分析、机器翻译中的语序调整、文本风格迁移、诗词格律分析。特别适合处理语序灵活的语言。',
    tense: '时态分析、时间线抽取、金融文本中的时间参照解析、历史事件时序化。与凯利公式联动可用于交易决策时序分析。',
    affix: '新词发现、词形态分析、词根提取、拼写纠错。适合具有丰富词缀变化的语言处理。',
    passive: '语态转换、文本简化、信息抽取、情感分析中的视角校正。对偶空间方法确保转换的语义保真。',
    polysemy: '词义消歧、搜索查询理解、机器翻译、问答系统。贝叶斯框架可灵活整合上下文和领域知识。',
    culture: '跨文化交流、本地化翻译、文化敏感性检测、多文化产品设计。正则化方法防止输出偏离文化语境。',
    boundary: '分句、分词、命名实体识别、异常文本检测。拓扑学视角特别适合处理模糊边界问题。',
    chickenRabbit: '资源分配、约束满足、排课问题、投资组合优化。整数规划框架可处理复杂的多约束混合问题。',
    engineering: '语法检查器、代码静态分析、自动校对、质量控制。PID 控制确保输出在迭代中稳定收敛。',
    enumeration: '分类统计、排列组合、穷举测试、组合优化。递推方法可高效处理大规模枚举问题。',
  };
  return useCases[moduleId] || '该模块的应用场景正在探索中。';
}

export default MindSpeakPage;
