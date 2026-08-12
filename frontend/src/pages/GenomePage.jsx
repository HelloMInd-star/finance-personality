import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Button,
  Input,
  InputNumber,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Progress,
  Divider,
  Tooltip,
  Empty,
  Tabs,
  Radio,
  Checkbox,
  Slider,
  Modal,
  Popconfirm,
  List,
  Avatar,
  Statistic,
  message,
} from 'antd';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  CheckCircleFilled,
  BulbOutlined,
  WarningOutlined,
  AimOutlined,
  RiseOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  StarOutlined,
  HistoryOutlined,
  DeleteOutlined,
  EyeOutlined,
  BarChartOutlined,
  DiffOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { analyzeInvestorDNA, generateReportFromDNA } from '../utils/genomeEngine';
import { CHROMOSOME_META } from '../utils/genomeData';
import {
  STAIRCASE_GROUPS,
  STAIRCASE_QUESTIONS,
  calculateStaircaseDNA,
} from '../utils/staircaseData';
import { dnaHistory, formatDate, MODE_LABEL } from '../utils/dnaHistory';
import { logger } from '../utils/logger';
import {
  shoppingEngine,
  getConsumptionProfile,
  generateConsumptionReport,
} from '../utils/shoppingEngine';
import { storage } from '../utils/storage';
import ReactECharts from 'echarts-for-react';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// 预设示例
const PRESETS = [
  {
    label: '深度研究型长期投资者',
    text: '我喜欢深入研究公司财报和行业格局，建立自己的投资原则体系，买入后一般持有5年以上，不在意短期波动。偏好分散配置但会给高确信度标的重仓。性格偏内向，喜欢独立思考，不会跟风追热点。',
  },
  {
    label: '激进趋势交易者',
    text: '我喜欢追逐市场热点，快进快出，一般持仓几天到几周。喜欢用杠杆放大收益，all in是常有的事。相信盘感和经验，不太喜欢看枯燥的财报。性格外向，喜欢和人讨论股票。',
  },
  {
    label: '稳健定投派',
    text: '我追求稳健的收益，主要做指数基金定投，每月固定投入。不追求暴利，也不承担太大风险。相信长期复利的力量，持有期一般3-5年。不太关心每天的涨跌。',
  },
];

const GenomePage = () => {
  const [activeTab, setActiveTab] = useState('quick');

  // ===== 快速测试状态 =====
  const [inputText, setInputText] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);

  // ===== 爬楼梯状态 =====
  const [currentStep, setCurrentStep] = useState(0); // 0 = 开始, 1-12 = 答题, 13 = 完成
  const [answers, setAnswers] = useState({});
  const [stairLoading, setStairLoading] = useState(false);

  // ===== 共享报告状态 =====
  const [report, setReport] = useState(null);

  // ===== 历史记录状态 =====
  const [historyRecords, setHistoryRecords] = useState(dnaHistory.list());
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);
  const [detailRecord, setDetailRecord] = useState(null);
  const [compareResult, setCompareResult] = useState(null);

  // ===== 消费画像状态 =====
  const [consumptionForm, setConsumptionForm] = useState({
    recentPurchase: '',
    dailyAppOpens: 3,
    preference: 'quality',
    waitForDiscount: 'sometimes',
  });
  const [consumptionReport, setConsumptionReport] = useState(null);
  const [consumptionLoading, setConsumptionLoading] = useState(false);
  const [consumptionErrors, setConsumptionErrors] = useState({});

  // 从 localStorage 恢复消费画像数据
  useEffect(() => {
    try {
      const savedData = storage.get('shoppingData');
      if (savedData) {
        if (savedData.consumptionInput) {
          setConsumptionForm(prev => ({ ...prev, ...savedData.consumptionInput }));
        }
        if (savedData.consumptionReport) {
          setConsumptionReport(savedData.consumptionReport);
        }
      }
    } catch (err) {
      logger.error('[消费画像] 恢复本地数据失败', err);
    }
  }, []);

  // 根据当前 step 找到对应的问题
  const currentQuestion = useMemo(() => {
    if (currentStep < 1 || currentStep > STAIRCASE_QUESTIONS.length) return null;
    return STAIRCASE_QUESTIONS[currentStep - 1];
  }, [currentStep]);

  // 根据当前 step 找到对应的组
  const currentGroup = useMemo(() => {
    if (!currentQuestion) return null;
    return STAIRCASE_GROUPS.find((g) => g.id === currentQuestion.groupId);
  }, [currentQuestion]);

  // 计算进度（已回答的题目数）
  const answeredCount = Object.keys(answers).length;
  const totalSteps = STAIRCASE_QUESTIONS.length;

  // ===== 快速测试 =====
  const handleQuickAnalyze = () => {
    if (!inputText.trim()) return;
    setQuickLoading(true);
    logger.session('[DNA分析][快速] 开始分析');

    setTimeout(() => {
      const result = analyzeInvestorDNA(inputText);
      setReport(result);
      setQuickLoading(false);
      // 自动保存历史
      const saved = dnaHistory.save(result, 'quick', { text: inputText });
      setHistoryRecords(dnaHistory.list());
      logger.session('[DNA分析][快速] 完成，已保存历史', saved.id, result.winner.master.name);
    }, 600);
  };

  const handlePreset = (preset) => {
    setInputText(preset.text);
    setReport(null);
    logger.session('[DNA分析][快速] 选择预设', preset.label);
  };

  const handleQuickReset = () => {
    setInputText('');
    setReport(null);
    logger.session('[DNA分析][快速] 重置');
  };

  // ===== 爬楼梯 =====
  const handleStartStaircase = () => {
    setCurrentStep(1);
    setAnswers({});
    setReport(null);
    logger.session('[DNA分析][爬楼梯] 开始');
  };

  const handleSelectAnswer = (optionIndex) => {
    if (!currentQuestion) return;

    const newAnswers = {
      ...answers,
      [currentQuestion.id]: optionIndex,
    };
    setAnswers(newAnswers);

    // 自动前进
    setTimeout(() => {
      if (currentStep >= totalSteps) {
        // 最后一题，提交分析
        handleSubmitStaircase(newAnswers);
      } else {
        setCurrentStep(currentStep + 1);
      }
    }, 300);
  };

  const handleSubmitStaircase = (finalAnswers) => {
    setStairLoading(true);
    logger.session('[DNA分析][爬楼梯] 提交分析');

    setTimeout(() => {
      const userDNA = calculateStaircaseDNA(finalAnswers);
      const result = generateReportFromDNA(userDNA);

      setReport(result);
      setCurrentStep(totalSteps + 1);
      setStairLoading(false);
      // 自动保存历史
      const saved = dnaHistory.save(result, 'staircase', { answers: finalAnswers });
      setHistoryRecords(dnaHistory.list());
      logger.session('[DNA分析][爬楼梯] 完成，已保存历史', saved.id, result.winner.master.name);
    }, 800);
  };

  const handleStairReset = () => {
    setCurrentStep(0);
    setAnswers({});
    setReport(null);
    logger.session('[DNA分析][爬楼梯] 重置');
  };

  // ===== 通用 =====
  const getChromosomeColor = (value) => {
    if (value < 30) return '#52c41a';
    if (value < 70) return '#faad14';
    return '#f5222d';
  };

  const renderChromosomeBars = (dna, showLabel = true) => {
    const dims = ['risk', 'time', 'style', 'model'];
    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {dims.map((dim) => {
          const meta = CHROMOSOME_META[dim];
          return (
            <div key={dim}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                  {showLabel && `${meta.code} `}
                  {meta.name}
                </Text>
                <Space size={4}>
                  <Text type="secondary" style={{ fontSize: 11 }}>{meta.left}</Text>
                  <Text style={{ color: '#a78bfa', fontWeight: 600 }}>{dna[dim]}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{meta.right}</Text>
                </Space>
              </Space>
              <Progress
                percent={dna[dim]}
                showInfo={false}
                strokeColor={getChromosomeColor(dna[dim])}
                size="small"
                style={{ marginTop: 4 }}
              />
            </div>
          );
        })}
        <div>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              {showLabel && 'Chr-5 '}
              人格染色体（MBTI）
            </Text>
            <Tag color="#8b5cf6" style={{ margin: 0 }}>{dna.mbti}</Tag>
          </Space>
        </div>
      </Space>
    );
  };

  // ===== 爬楼梯视觉组件 =====
  const renderStaircaseVisual = () => {
    // 反转显示：第1级在底部，第12级在顶部
    const reversed = [...STAIRCASE_QUESTIONS].reverse();

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '20px 0' }}>
        {reversed.map((q, idx) => {
          const stepNum = STAIRCASE_QUESTIONS.length - idx;
          const group = STAIRCASE_GROUPS.find((g) => g.id === q.groupId);
          const isAnswered = answers[q.id] !== undefined;
          const isCurrent = stepNum === currentStep;
          const isLocked = stepNum > currentStep;

          // 阶梯宽度（越高越窄，符合透视感）
          const widthPercent = 60 + (stepNum / totalSteps) * 40;

          let bgColor = 'rgba(139,92,246,0.15)';
          let borderColor = 'rgba(139,92,246,0.2)';
          let textColor = 'rgba(255,255,255,0.5)';

          if (isAnswered) {
            bgColor = 'rgba(16,185,129,0.2)';
            borderColor = 'rgba(16,185,129,0.4)';
            textColor = '#10b981';
          }
          if (isCurrent) {
            bgColor = 'rgba(139,92,246,0.35)';
            borderColor = 'rgba(167,139,250,0.8)';
            textColor = '#fff';
          }

          return (
            <div
              key={q.id}
              style={{
                width: `${widthPercent}%`,
                padding: '10px 16px',
                borderRadius: 8,
                background: bgColor,
                border: `1px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.3s ease',
                transform: isCurrent ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isCurrent ? '0 0 20px rgba(139,92,246,0.4)' : 'none',
              }}
            >
              <Space>
                <Text style={{ color: textColor, fontWeight: 600, fontSize: 13 }}>
                  {isAnswered ? <CheckCircleOutlined /> : `${stepNum}.`}
                </Text>
                <Text style={{ color: textColor, fontSize: 12 }}>
                  {group?.name}
                </Text>
              </Space>
              {isCurrent && (
                <Tag color="#a78bfa" style={{ margin: 0, fontSize: 11 }}>
                  <StarOutlined /> 进行中
                </Tag>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ===== Tab 内容 =====
  const renderQuickTab = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title={<span style={{ color: '#fff' }}><BulbOutlined /> 描述你的投资风格</span>}
        style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>试试预设示例：</Text>
            <Space wrap style={{ marginTop: 4 }}>
              {PRESETS.map((p) => (
                <Tag
                  key={p.label}
                  color="purple"
                  style={{ cursor: 'pointer', padding: '4px 10px' }}
                  onClick={() => handlePreset(p)}
                >
                  {p.label}
                </Tag>
              ))}
            </Space>
          </div>

          <TextArea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="请描述你的投资风格、决策习惯、风险偏好、持有周期、研究方式等信息...越详细分析越准确。"
            rows={6}
            style={{
              background: 'rgba(0,0,0,0.3)',
              color: '#fff',
              borderColor: 'rgba(139,92,246,0.3)',
            }}
          />

          <Space>
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={quickLoading}
              onClick={handleQuickAnalyze}
              disabled={!inputText.trim()}
            >
              基因测序 & 比对
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleQuickReset}>
              重置
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {inputText.length} 字
            </Text>
          </Space>
        </Space>
      </Card>

      {!report && !quickLoading && (
        <Card style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <Empty
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary">输入描述后点击「基因测序 & 比对」生成你的DNA报告</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  支持：风险偏好、时间周期、研究风格、思维模型、MBTI人格 5个维度分析
                </Text>
              </Space>
            }
          />
        </Card>
      )}
    </Space>
  );

  const renderStairTab = () => {
    // 起始页
    if (currentStep === 0) {
      return (
        <Card
          style={{
            background: 'rgba(30,19,64,0.8)',
            border: '1px solid rgba(139,92,246,0.2)',
            textAlign: 'center',
          }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <div style={{ fontSize: 60, marginBottom: 12 }}>🧗</div>
              <Title level={3} style={{ color: '#a78bfa', margin: 0 }}>
                人格爬楼梯
              </Title>
              <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                回答 12 道问题，一步步爬上属于你的人格楼梯
              </Paragraph>
            </div>

            <Row gutter={[16, 16]} style={{ maxWidth: 600, margin: '0 auto' }}>
              {STAIRCASE_GROUPS.map((g) => (
                <Col xs={12} md={8} key={g.id}>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: 'rgba(139,92,246,0.1)',
                      border: '1px solid rgba(139,92,246,0.2)',
                    }}
                  >
                    <Text style={{ color: '#a78bfa', fontWeight: 600 }}>{g.name}</Text>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                      {g.steps} 级台阶 · 权重 ×{g.weight}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>

            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 越往上的台阶权重越大（斐波那契数列：1, 1, 2, 3, 5），越后面的选择越关键
            </Text>

            <Button
              type="primary"
              size="large"
              icon={<RiseOutlined />}
              onClick={handleStartStaircase}
              style={{ minWidth: 200 }}
            >
              开始爬楼梯
            </Button>
          </Space>
        </Card>
      );
    }

    // 答题页
    if (currentStep >= 1 && currentStep <= totalSteps && !report) {
      return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 进度条 */}
          <Card style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Tag color="#a78bfa">
                  {currentGroup?.name} · 权重 ×{currentGroup?.weight}
                </Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {answeredCount} / {totalSteps}
                </Text>
              </Space>
              <Progress
                percent={Math.round((answeredCount / totalSteps) * 100)}
                strokeColor="#a78bfa"
                showInfo={false}
              />
            </Space>
          </Card>

          <Row gutter={[24, 24]}>
            {/* 左侧：楼梯可视化 */}
            <Col xs={24} md={10}>
              <Card
                title={<span style={{ color: '#fff', fontSize: 14 }}><RiseOutlined /> 楼梯进度</span>}
                style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
                bodyStyle={{ maxHeight: 480, overflowY: 'auto' }}
              >
                {renderStaircaseVisual()}
              </Card>
            </Col>

            {/* 右侧：问题 */}
            <Col xs={24} md={14}>
              <Card
                style={{
                  background: 'rgba(30,19,64,0.8)',
                  border: '1px solid rgba(167,139,250,0.5)',
                  minHeight: 480,
                }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <Tag color="#8b5cf6" style={{ marginBottom: 12 }}>
                      第 {currentStep} 级 · {currentGroup?.name}
                    </Tag>
                    <Title level={4} style={{ color: '#fff', marginTop: 0, marginBottom: 8 }}>
                      {currentQuestion?.question}
                    </Title>
                    {currentQuestion?.mbtiDimension && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        MBTI 维度：{currentQuestion.mbtiDimension}
                      </Text>
                    )}
                  </div>

                  <div>
                    <Radio.Group
                      value={answers[currentQuestion.id]}
                      onChange={(e) => handleSelectAnswer(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {currentQuestion?.options.map((opt, optIdx) => {
                          const isSelected = answers[currentQuestion.id] === optIdx;
                          return (
                            <div
                              key={optIdx}
                              onClick={() => handleSelectAnswer(optIdx)}
                              style={{
                                padding: 16,
                                borderRadius: 10,
                                background: isSelected
                                  ? 'rgba(139,92,246,0.25)'
                                  : 'rgba(0,0,0,0.2)',
                                border: isSelected
                                  ? '1px solid rgba(167,139,250,0.8)'
                                  : '1px solid rgba(139,92,246,0.15)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <Space>
                                <div
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    border: `2px solid ${isSelected ? '#a78bfa' : 'rgba(255,255,255,0.3)'}`,
                                    background: isSelected ? '#a78bfa' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  {String.fromCharCode(65 + optIdx)}
                                </div>
                                <Text style={{ color: isSelected ? '#fff' : 'rgba(255,255,255,0.85)' }}>
                                  {opt.label}
                                </Text>
                              </Space>
                            </div>
                          );
                        })}
                      </Space>
                    </Radio.Group>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button onClick={handleStairReset} size="small">
                      <ReloadOutlined /> 重新开始
                    </Button>
                    {answeredCount > 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        还剩 {totalSteps - answeredCount} 题
                      </Text>
                    )}
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>

          {stairLoading && (
            <Card style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)', textAlign: 'center' }}>
              <Space direction="vertical">
                <div style={{ fontSize: 40 }}>🧬</div>
                <Text style={{ color: '#a78bfa' }}>正在进行基因测序与比对...</Text>
              </Space>
            </Card>
          )}
        </Space>
      );
    }

    return null;
  };

  // ===== 历史记录操作 =====
  const handleDeleteHistory = (id) => {
    dnaHistory.remove(id);
    setHistoryRecords(dnaHistory.list());
    setSelectedHistoryIds(selectedHistoryIds.filter((i) => i !== id));
    logger.session('[DNA历史] 删除记录', id);
  };

  const handleClearHistory = () => {
    dnaHistory.clear();
    setHistoryRecords([]);
    setSelectedHistoryIds([]);
    logger.session('[DNA历史] 清空所有记录');
  };

  const handleViewDetail = (record) => {
    setDetailRecord(record);
    logger.session('[DNA历史] 查看详情', record.id);
  };

  const handleCompare = () => {
    if (selectedHistoryIds.length < 2) return;
    const result = dnaHistory.compare(selectedHistoryIds);
    setCompareResult(result);
    logger.session('[DNA历史] 对比', selectedHistoryIds.length, '条记录');
  };

  const toggleSelectHistory = (id, checked) => {
    if (checked) {
      setSelectedHistoryIds([...selectedHistoryIds, id]);
    } else {
      setSelectedHistoryIds(selectedHistoryIds.filter((i) => i !== id));
    }
  };

  const handleSelectAllHistory = (checked) => {
    if (checked) {
      setSelectedHistoryIds(historyRecords.map((r) => r.id));
    } else {
      setSelectedHistoryIds([]);
    }
  };

  // ===== 趋势图 ECharts 配置 =====
  const trendChartOption = useMemo(() => {
    if (historyRecords.length === 0) return null;

    // 按时间排序（从早到晚）
    const sorted = [...historyRecords].sort((a, b) => a.createdAt - b.createdAt);

    const xAxisData = sorted.map((r) => formatDate(r.createdAt));
    const dims = ['risk', 'time', 'style', 'model'];
    const dimColors = {
      risk: '#f5222d',
      time: '#52c41a',
      style: '#1890ff',
      model: '#faad14',
    };

    const series = dims.map((dim) => ({
      name: CHROMOSOME_META[dim].name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      data: sorted.map((r) => r.userDNA[dim]),
      lineStyle: {
        width: 3,
        color: dimColors[dim],
      },
      itemStyle: {
        color: dimColors[dim],
        borderColor: '#fff',
        borderWidth: 2,
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: dimColors[dim] + '30' },
            { offset: 1, color: dimColors[dim] + '00' },
          ],
        },
      },
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15,10,40,0.95)',
        borderColor: 'rgba(139,92,246,0.3)',
        textStyle: { color: '#fff' },
        axisPointer: {
          type: 'cross',
          lineStyle: { color: 'rgba(139,92,246,0.5)' },
        },
      },
      legend: {
        data: dims.map((d) => CHROMOSOME_META[d].name),
        textStyle: { color: 'rgba(255,255,255,0.85)' },
        top: 0,
        icon: 'circle',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: 40,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxisData,
        axisLine: { lineStyle: { color: 'rgba(139,92,246,0.3)' } },
        axisLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { show: false },
        axisLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(139,92,246,0.1)' } },
      },
      series,
    };
  }, [historyRecords]);

  // ===== 历史记录 Tab =====
  const renderHistoryTab = () => {
    const allSelected = historyRecords.length > 0 && selectedHistoryIds.length === historyRecords.length;

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 趋势图 */}
        {trendChartOption && (
          <Card
            title={<span style={{ color: '#fff' }}><BarChartOutlined /> 染色体分数趋势</span>}
            style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
          >
            <ReactECharts
              option={trendChartOption}
              style={{ height: 320, width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </Card>
        )}

        {/* 工具栏 */}
        <Card style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Checkbox
                checked={allSelected}
                onChange={(e) => handleSelectAllHistory(e.target.checked)}
              >
                全选
              </Checkbox>
              <Text type="secondary" style={{ fontSize: 12 }}>
                已选 {selectedHistoryIds.length} / {historyRecords.length} 条
              </Text>
            </Space>
            <Space>
              <Button
                type="primary"
                icon={<DiffOutlined />}
                onClick={handleCompare}
                disabled={selectedHistoryIds.length < 2}
              >
                对比选中 ({selectedHistoryIds.length})
              </Button>
              <Popconfirm
                title="确定要清空所有历史记录吗？"
                description="此操作不可恢复"
                onConfirm={handleClearHistory}
                okText="清空"
                cancelText="取消"
              >
                <Button icon={<DeleteOutlined />} danger disabled={historyRecords.length === 0}>
                  清空所有
                </Button>
              </Popconfirm>
            </Space>
          </Space>
        </Card>

        {/* 记录列表 */}
        {historyRecords.length === 0 ? (
          <Card style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <Empty
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">还没有历史记录</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    完成一次 DNA 分析后会自动保存
                  </Text>
                </Space>
              }
            />
          </Card>
        ) : (
          <Card style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <List
              dataSource={historyRecords}
              renderItem={(record) => {
                const isSelected = selectedHistoryIds.includes(record.id);
                return (
                  <List.Item
                    style={{
                      padding: '16px 0',
                      borderBottom: '1px solid rgba(139,92,246,0.1)',
                      background: isSelected ? 'rgba(139,92,246,0.05)' : 'transparent',
                      margin: '0 -24px',
                      paddingLeft: 24,
                      paddingRight: 24,
                    }}
                  >
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => toggleSelectHistory(record.id, e.target.checked)}
                        />
                        <Avatar
                          style={{
                            background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
                            fontWeight: 700,
                          }}
                        >
                          {record.winner.name.charAt(0)}
                        </Avatar>
                        <Space direction="vertical" size={2}>
                          <Space>
                            <Text style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
                              {record.winner.name}
                            </Text>
                            <Tag color="#8b5cf6" style={{ margin: 0 }}>
                              {record.winner.mbti}
                            </Tag>
                            <Tag color={record.mode === 'quick' ? 'blue' : 'purple'} style={{ margin: 0 }}>
                              {MODE_LABEL[record.mode]}
                            </Tag>
                          </Space>
                          <Space size={16}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              相似度 <Text style={{ color: '#a78bfa' }}>{record.winner.similarity}%</Text>
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {formatDate(record.createdAt)}
                            </Text>
                          </Space>
                        </Space>
                      </Space>
                      <Space>
                        <Button
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => handleViewDetail(record)}
                        >
                          详情
                        </Button>
                        <Popconfirm
                          title="删除这条记录？"
                          onConfirm={() => handleDeleteHistory(record.id)}
                          okText="删除"
                          cancelText="取消"
                        >
                          <Button size="small" icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                      </Space>
                    </Space>
                  </List.Item>
                );
              }}
            />
          </Card>
        )}
      </Space>
    );
  };

  // ===== 对比结果渲染 =====
  const renderCompareView = () => {
    if (!compareResult) return null;

    const { records, chromosomeChanges, mbtiChanges, winnerChanges } = compareResult;
    const dims = ['risk', 'time', 'style', 'model'];

    const getTrendIcon = (trend) => {
      if (trend === 'up') return <ArrowUpOutlined style={{ color: '#52c41a' }} />;
      if (trend === 'down') return <ArrowDownOutlined style={{ color: '#f5222d' }} />;
      return <MinusOutlined style={{ color: '#8c8c8c' }} />;
    };

    return (
      <Card
        title={<span style={{ color: '#fff' }}><DiffOutlined /> 染色体变化对比</span>}
        style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
        extra={
          <Button size="small" onClick={() => setCompareResult(null)}>
            关闭
          </Button>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 记录时间线 */}
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>对比记录（按时间）：</Text>
            <Space wrap style={{ marginTop: 8 }}>
              {records.map((r, idx) => (
                <Tag key={r.id} color={idx === 0 ? 'default' : 'purple'}>
                  #{idx + 1} {r.winner.name} ({formatDate(r.createdAt)})
                </Tag>
              ))}
            </Space>
          </div>

          {/* 染色体变化 */}
          <Row gutter={[16, 16]}>
            {dims.map((dim) => {
              const change = chromosomeChanges[dim];
              const meta = CHROMOSOME_META[dim];
              return (
                <Col xs={24} md={12} key={dim}>
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(139,92,246,0.15)',
                    }}
                  >
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        {getTrendIcon(change.trend)}
                        <Text style={{ color: '#fff', fontWeight: 600 }}>{meta.name}</Text>
                      </Space>
                      <Tag
                        color={
                          change.delta > 0 ? 'green' : change.delta < 0 ? 'red' : 'default'
                        }
                        style={{ margin: 0 }}
                      >
                        {change.delta > 0 ? '+' : ''}{change.delta}
                      </Tag>
                    </Space>

                    <div style={{ marginTop: 12 }}>
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        {change.values.map((val, idx) => (
                          <div key={idx}>
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                #{idx + 1} {records[idx]?.winner.name}
                              </Text>
                              <Text style={{ color: '#a78bfa', fontSize: 12 }}>{val}</Text>
                            </Space>
                            <Progress
                              percent={val}
                              showInfo={false}
                              strokeColor="#a78bfa"
                              size="small"
                              style={{ marginTop: 2 }}
                            />
                          </div>
                        ))}
                      </Space>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>

          {/* MBTI 变化 */}
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.2)',
            }}
          >
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Text style={{ color: '#fff', fontWeight: 600 }}>🧬 人格染色体（MBTI）变化</Text>
            </Space>
            <Space wrap style={{ marginTop: 8 }}>
              {mbtiChanges.map((mbti, idx) => (
                <Space key={idx}>
                  <Tag color="#8b5cf6" style={{ fontSize: 14, padding: '4px 12px' }}>
                    {mbti}
                  </Tag>
                  {idx < mbtiChanges.length - 1 && <ArrowRightOutlined style={{ color: '#8c8c8c' }} />}
                </Space>
              ))}
            </Space>
          </div>

          {/* 最像的人变化 */}
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 600 }}>🏆 最像你的投资人变化</Text>
            <Space wrap style={{ marginTop: 8 }}>
              {winnerChanges.map((name, idx) => (
                <Space key={idx}>
                  <Tag color="green" style={{ fontSize: 13, padding: '4px 12px' }}>
                    {name}
                  </Tag>
                  {idx < winnerChanges.length - 1 && <ArrowRightOutlined style={{ color: '#8c8c8c' }} />}
                </Space>
              ))}
            </Space>
          </div>
        </Space>
      </Card>
    );
  };

  // ===== 报告渲染 =====
  const renderReport = () => {
    if (!report) return null;
    return (
      <>
        <Card
          title={<span style={{ color: '#fff' }}>🧬 基因测序结果</span>}
          style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
        >
          {renderChromosomeBars(report.userDNA)}
        </Card>

        <Card
          title={<span style={{ color: '#fff' }}>🎯 Top3 基因亲缘匹配</span>}
          style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
        >
          <Row gutter={[24, 24]}>
            {report.top3.map((item, idx) => {
              const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
              const rankColor = idx === 0 ? '#faad14' : idx === 1 ? '#bfbfbf' : '#d46b08';
              return (
                <Col xs={24} md={8} key={item.master.id}>
                  <div
                    style={{
                      padding: 20,
                      borderRadius: 12,
                      background: idx === 0 ? 'rgba(250,173,20,0.1)' : 'rgba(139,92,246,0.1)',
                      border: `1px solid ${idx === 0 ? 'rgba(250,173,20,0.3)' : 'rgba(139,92,246,0.2)'}`,
                      textAlign: 'center',
                      height: '100%',
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{rankIcon}</div>
                    <Title level={4} style={{ color: rankColor, margin: '0 0 4px' }}>
                      第{idx + 1}名
                    </Title>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                      {item.master.name}
                    </div>
                    <Tag color={idx === 0 ? 'gold' : 'purple'} style={{ marginBottom: 12 }}>
                      {item.master.mbti}
                    </Tag>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#a78bfa' }}>
                      {item.similarity}%
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>相似度</Text>

                    <Divider style={{ margin: '12px 0' }} />

                    <div style={{ textAlign: 'left' }}>
                      {['risk', 'time', 'style', 'model'].map((dim) => (
                        <div key={dim} style={{ marginBottom: 6 }}>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {CHROMOSOME_META[dim].name}
                            </Text>
                            <Text style={{ fontSize: 12, color: item.detailMatch[dim] >= 70 ? '#52c41a' : '#faad14' }}>
                              {item.detailMatch[dim]}%
                            </Text>
                          </Space>
                        </div>
                      ))}
                      <div>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>MBTI 匹配</Text>
                          <Text style={{ fontSize: 12, color: item.detailMatch.mbti >= 70 ? '#52c41a' : '#faad14' }}>
                            {item.detailMatch.mbti}%
                          </Text>
                        </Space>
                      </div>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        </Card>

        <Card
          title={<span style={{ color: '#fff' }}>🏆 最像你的投资人：{report.winner.master.name}</span>}
          style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">核心标签：</Text>
              <Space wrap style={{ marginLeft: 8 }}>
                {report.winner.master.coreTags.map((tag) => (
                  <Tag key={tag} color="purple">{tag}</Tag>
                ))}
              </Space>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 8,
                background: 'rgba(139,92,246,0.1)',
                borderLeft: '3px solid #a78bfa',
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>大师名言：</Text>
              <Paragraph style={{ color: '#fff', fontSize: 15, fontStyle: 'italic', margin: '4px 0 0' }}>
                "{report.winner.master.quote}"
              </Paragraph>
            </div>

            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <div style={{ color: '#52c41a', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  <CheckCircleFilled /> 你的决策优势（显性基因）
                </div>
                <Space direction="vertical" size={4}>
                  {report.winner.master.advantages.map((a, i) => (
                    <Text key={i} style={{ color: 'rgba(255,255,255,0.85)' }}>• {a}</Text>
                  ))}
                </Space>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ color: '#faad14', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  <WarningOutlined /> 你的决策盲区（隐性风险基因）
                </div>
                <Space direction="vertical" size={4}>
                  {report.winner.master.blindspots.map((b, i) => (
                    <Text key={i} style={{ color: 'rgba(255,255,255,0.85)' }}>• {b}</Text>
                  ))}
                </Space>
              </Col>
            </Row>

            <div
              style={{
                padding: 16,
                borderRadius: 8,
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
              }}
            >
              <div style={{ color: '#10b981', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                <AimOutlined /> 一步行动建议（基因优化）
              </div>
              <Text style={{ color: '#fff' }}>{report.winner.master.action}</Text>
            </div>
          </Space>
        </Card>

        <Card
          title={
            <span style={{ color: report.purpleGroup.isPurple ? '#c084fc' : '#fff' }}>
              🔮 紫人组检测：{report.purpleGroup.isPurple ? '✅ 触发' : '❌ 未触发'}
            </span>
          }
          style={{
            background: report.purpleGroup.isPurple
              ? 'rgba(139,92,246,0.15)'
              : 'rgba(30,19,64,0.8)',
            border: report.purpleGroup.isPurple
              ? '1px solid rgba(192,132,252,0.4)'
              : '1px solid rgba(139,92,246,0.2)',
          }}
        >
          {!report.purpleGroup.isPurple ? (
            <Empty
              description={
                <Text type="secondary">
                  Top3 中只有 {report.purpleGroup.purpleCount} 位属于紫人组（需要 ≥2 位触发）。
                  紫人组 = INTJ/INTP/ENTJ/ENTP，即 N 系直觉 + T 系思维主导者。
                </Text>
              }
            />
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Space wrap>
                  {report.purpleGroup.purpleTypes.map((t) => (
                    <Tag key={t} color="#c084fc" style={{ padding: '4px 12px', fontSize: 14 }}>
                      {t} · {report.purpleGroup.info?.name || ''}
                    </Tag>
                  ))}
                </Space>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                  你具备「直觉 + 思维」主导的认知模式，属于投资世界中的"少数派基因"
                </Text>
              </div>

              <Row gutter={[24, 16]}>
                <Col xs={24} md={8}>
                  <div style={{ color: '#c084fc', fontWeight: 600, marginBottom: 8 }}>
                    ⚡ 紫人独特优势
                  </div>
                  <Space direction="vertical" size={4}>
                    {report.purpleGroup.info?.advantages?.map((a, i) => (
                      <Text key={i} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>• {a}</Text>
                    ))}
                  </Space>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ color: '#faad14', fontWeight: 600, marginBottom: 8 }}>
                    🕳️ 紫人典型盲区
                  </div>
                  <Space direction="vertical" size={4}>
                    {report.purpleGroup.info?.blindspots?.map((b, i) => (
                      <Text key={i} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>• {b}</Text>
                    ))}
                  </Space>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ color: '#10b981', fontWeight: 600, marginBottom: 8 }}>
                    🚀 紫人进化路径
                  </div>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                    {report.purpleGroup.info?.evolution}
                  </Text>
                </Col>
              </Row>
            </Space>
          )}
        </Card>

      </>
    );
  };

  // ============ 消费画像渲染 ============
  const renderConsumptionSection = () => {
    const winnerProfile = report?.winner?.master;
    const consProfile = winnerProfile ? getConsumptionProfile(winnerProfile.id) : null;

    return (
      <>
        {/* 功能一：投资人消费画像展示 */}
        <Card
          title={<span style={{ color: '#fff' }}>🛒 {consProfile ? `你像${consProfile.personName}一样购物` : '投资人消费画像'}</span>}
          style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
        >
          {consProfile ? (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={[16, 12]}>
                <Col xs={24} md={8}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>消费风格</div>
                  <Tag color="purple" style={{ fontSize: 14, padding: '4px 12px' }}>{consProfile.styleLabel}</Tag>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>消费频率</div>
                  <Text style={{ color: '#fff', fontSize: 15 }}>{consProfile.frequency} · 高质 · 长期使用</Text>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>典型消费</div>
                  <Space wrap>
                    {consProfile.categories.map((c, i) => (
                      <Tag key={i} color="#52c41a">{c}</Tag>
                    ))}
                  </Space>
                </Col>
              </Row>

              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: 'rgba(139,92,246,0.1)',
                  borderLeft: '3px solid #a78bfa',
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>消费原则：</Text>
                <Paragraph style={{ color: '#fff', fontSize: 15, fontStyle: 'italic', margin: '4px 0 0' }}>
                  "{consProfile.principle}"
                </Paragraph>
              </div>

              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <Text style={{ color: '#a78bfa', fontSize: 14, fontStyle: 'italic' }}>
                  "{consProfile.shoppingQuote}"
                </Text>
              </div>
            </Space>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🧬</div>
              <div style={{ fontSize: 14 }}>先做一次 DNA 测试，就能看到你最像哪位投资人的消费习惯</div>
            </div>
          )}
        </Card>

        {/* 功能二：用户消费行为输入 */}
        <Card
          title={<span style={{ color: '#fff' }}>📝 我的消费习惯</span>}
          style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text style={{ color: '#fff', display: 'block', marginBottom: 6 }}>
                我最近买的最贵的东西：
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>（选填，填了更准哦~）</Text>
              </Text>
              <Input
                placeholder="例如：一台 MacBook Pro、一次旅行..."
                value={consumptionForm.recentPurchase}
                status={consumptionErrors.recentPurchase ? 'error' : ''}
                onChange={(e) => {
                  setConsumptionForm(prev => ({ ...prev, recentPurchase: e.target.value }));
                  clearConsumptionError('recentPurchase');
                }}
                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}
              />
              {consumptionErrors.recentPurchase && (
                <Text type="danger" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  💡 {consumptionErrors.recentPurchase}
                </Text>
              )}
            </div>

            <div>
              <Text style={{ color: '#fff', display: 'block', marginBottom: 6 }}>
                我每天会打开购物软件 {consumptionForm.dailyAppOpens} 次
              </Text>
              <Slider
                min={0}
                max={20}
                value={consumptionForm.dailyAppOpens}
                onChange={(val) => {
                  setConsumptionForm(prev => ({ ...prev, dailyAppOpens: val }));
                  clearConsumptionError('dailyAppOpens');
                }}
                marks={{ 0: '0', 5: '5', 10: '10', 15: '15', 20: '20+' }}
              />
              {consumptionErrors.dailyAppOpens && (
                <Text type="danger" style={{ fontSize: 12, marginTop: -8, display: 'block' }}>
                  💡 {consumptionErrors.dailyAppOpens}
                </Text>
              )}
            </div>

            <div>
              <Text style={{ color: '#fff', display: 'block', marginBottom: 6 }}>我购物时更看重：</Text>
              <Radio.Group
                value={consumptionForm.preference}
                onChange={(e) => {
                  setConsumptionForm(prev => ({ ...prev, preference: e.target.value }));
                  clearConsumptionError('preference');
                }}
              >
                <Radio value="quality">质量</Radio>
                <Radio value="price">价格</Radio>
                <Radio value="brand">品牌</Radio>
                <Radio value="appearance">外观</Radio>
              </Radio.Group>
              {consumptionErrors.preference && (
                <Text type="danger" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  💡 {consumptionErrors.preference}
                </Text>
              )}
            </div>

            <div>
              <Text style={{ color: '#fff', display: 'block', marginBottom: 6 }}>我会为了等降价而等待：</Text>
              <Radio.Group
                value={consumptionForm.waitForDiscount}
                onChange={(e) => {
                  setConsumptionForm(prev => ({ ...prev, waitForDiscount: e.target.value }));
                  clearConsumptionError('waitForDiscount');
                }}
              >
                <Radio value="never">从不</Radio>
                <Radio value="sometimes">偶尔</Radio>
                <Radio value="often">经常</Radio>
              </Radio.Group>
              {consumptionErrors.waitForDiscount && (
                <Text type="danger" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  💡 {consumptionErrors.waitForDiscount}
                </Text>
              )}
            </div>

            <Button
              type="primary"
              size="large"
              onClick={handleGenerateConsumptionReport}
              loading={consumptionLoading}
              block
            >
              {consumptionLoading ? '分析中...' : '🎯 生成我的消费风格报告'}
            </Button>
          </Space>
        </Card>

        {/* 功能三：消费风格报告 */}
        {consumptionReport && (
          <Card
            id="consumption-report-section"
            title={<span style={{ color: '#fff' }}>📊 你的消费风格报告</span>}
            style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Statistic
                    title={<span style={{ color: '#94a3b8' }}>消费决策类型</span>}
                    value={consumptionReport.typeLabel}
                    valueStyle={{ color: '#a78bfa' }}
                  />
                  {consumptionReport.matchedInvestor && (
                    <Text style={{ color: '#52c41a', fontSize: 13 }}>
                      和 {consumptionReport.matchedInvestor.name} 相似度 {consumptionReport.investorSimilarity}%
                    </Text>
                  )}
                </Col>
                <Col xs={24} md={12}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>核心维度</div>
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <div>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>延迟满足能力</Text>
                        <Text style={{ color: consumptionReport.delayGratification >= 70 ? '#52c41a' : '#faad14', fontSize: 12 }}>
                          {consumptionReport.delayGratification >= 70 ? '高' : consumptionReport.delayGratification >= 40 ? '中' : '低'}
                        </Text>
                      </Space>
                      <Progress percent={consumptionReport.delayGratification} showInfo={false} size="small" status={consumptionReport.delayGratification >= 70 ? 'success' : 'active'} />
                    </div>
                    <div>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>冲动购买倾向</Text>
                        <Text style={{ color: consumptionReport.impulseTendency <= 40 ? '#52c41a' : '#ef4444', fontSize: 12 }}>
                          {consumptionReport.impulseTendency <= 40 ? '低' : consumptionReport.impulseTendency <= 70 ? '中' : '高'}
                        </Text>
                      </Space>
                      <Progress percent={100 - consumptionReport.impulseTendency} showInfo={false} size="small" status={consumptionReport.impulseTendency <= 40 ? 'success' : 'exception'} />
                    </div>
                    <div>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>价格敏感度</Text>
                        <Text style={{ color: '#a78bfa', fontSize: 12 }}>
                          {consumptionReport.priceSensitivity >= 70 ? '高' : consumptionReport.priceSensitivity >= 40 ? '中等' : '低'}
                        </Text>
                      </Space>
                      <Progress percent={consumptionReport.priceSensitivity} showInfo={false} size="small" />
                    </div>
                  </Space>
                </Col>
              </Row>

              <Row gutter={[16, 12]}>
                <Col xs={24} md={12}>
                  <div style={{ padding: 12, borderRadius: 8, background: 'rgba(250,173,20,0.1)', border: '1px solid rgba(250,173,20,0.2)' }}>
                    <Text style={{ color: '#faad14', fontSize: 12, fontWeight: 600 }}>最像的投资人</Text>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>
                        {consumptionReport.matchedInvestor?.emoji} {consumptionReport.matchedInvestor?.name}
                      </span>
                      <Tag color="gold" style={{ marginLeft: 8 }}>{consumptionReport.investorSimilarity}%</Tag>
                    </div>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div style={{ padding: 12, borderRadius: 8, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: 600 }}>最像的创业家</Text>
                    <div style={{ marginTop: 4 }}>
                      <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>
                        {consumptionReport.matchedEntrepreneur?.emoji} {consumptionReport.matchedEntrepreneur?.name}
                      </span>
                      <Tag color="purple" style={{ marginLeft: 8 }}>{consumptionReport.entrepreneurSimilarity}%</Tag>
                    </div>
                  </div>
                </Col>
              </Row>

              <Paragraph style={{ color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: 14 }}>
                {consumptionReport.description}
              </Paragraph>
            </Space>
          </Card>
        )}
      </>
    );
  };

  // 校验消费表单
  const validateConsumptionForm = () => {
    const errors = {};

    // 最近购买的东西：选填，但如果填了要有内容
    if (consumptionForm.recentPurchase && consumptionForm.recentPurchase.trim().length < 2) {
      errors.recentPurchase = '描述太短啦，多写两个字让分析更准确吧~';
    }

    // 每天打开购物软件次数：必须在合理范围
    if (consumptionForm.dailyAppOpens < 0 || consumptionForm.dailyAppOpens > 20) {
      errors.dailyAppOpens = '购物软件打开次数要在 0-20 之间哦';
    }

    // 购物偏好：必须选择
    if (!consumptionForm.preference) {
      errors.preference = '选一个你最看重的点吧~';
    }

    // 是否等降价：必须选择
    if (!consumptionForm.waitForDiscount) {
      errors.waitForDiscount = '这个也选一下吧，分析会更准的';
    }

    setConsumptionErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 清除单个字段的错误
  const clearConsumptionError = (field) => {
    if (consumptionErrors[field]) {
      setConsumptionErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleGenerateConsumptionReport = async () => {
    logger.session('═══════════════════════════════════════');
    logger.session('[消费画像][提交] 开始数据交互流程', consumptionForm);

    // Step 1: 表单校验
    logger.session('[消费画像][步骤1/5] 表单校验...');
    const isValid = validateConsumptionForm();
    if (!isValid) {
      const errorCount = Object.keys(consumptionErrors).length;
      const firstError = Object.values(consumptionErrors)[0];
      const errMsg = errorCount > 1
        ? `有 ${errorCount} 个地方需要调整：${firstError}`
        : firstError || '请检查一下输入内容哦~';
      logger.session('[消费画像][步骤1/5] ❌ 表单校验失败', {
        errorCount,
        errors: consumptionErrors,
      });
      message.warning(errMsg);
      logger.session('═══════════════════════════════════════');
      return;
    }
    logger.session('[消费画像][步骤1/5] ✅ 表单校验通过');

    setConsumptionLoading(true);

    try {
      // Step 2: 模拟异步处理
      logger.session('[消费画像][步骤2/5] 预处理（300ms延迟）...');
      await new Promise(resolve => setTimeout(resolve, 300));
      logger.session('[消费画像][步骤2/5] ✅ 预处理完成');

      // Step 3: 调用引擎生成报告
      logger.session('[消费画像][步骤3/5] 调用消费风格匹配引擎...');
      const report = generateConsumptionReport(consumptionForm);
      logger.session('[消费画像][步骤3/5] ✅ 引擎返回结果', {
        hasReport: !!report,
        reportType: report?.typeLabel,
      });

      if (!report) {
        logger.error('[消费画像][步骤3/5] ❌ 引擎返回空结果');
        message.warning('哎呀，生成报告时遇到了一点小问题，再试一次吧~');
        logger.session('═══════════════════════════════════════');
        return;
      }

      // Step 4: 更新状态 + 本地存储
      logger.session('[消费画像][步骤4/5] 保存结果（state + localStorage）...');
      setConsumptionReport(report);
      const saveData = {
        consumptionInput: consumptionForm,
        consumptionReport: report,
        updatedAt: Date.now(),
      };
      storage.set('shoppingData', saveData);
      logger.session('[消费画像][步骤4/5] ✅ 保存成功', {
        reportId: report.generatedAt,
        storageKey: 'shoppingData',
      });

      // Step 5: 用户反馈 + 滚动定位
      logger.session('[消费画像][步骤5/5] 用户反馈 + 滚动定位...');
      const matchedName = report.matchedInvestor?.name || '那位神秘投资人';
      message.success(`搞定！发现你和 ${matchedName} 的消费风格最像~`);
      logger.session('[消费画像][步骤5/5] ✅ 完成', {
        type: report.typeLabel,
        matchedInvestor: matchedName,
        similarity: `${report.investorSimilarity}%`,
      });

      setTimeout(() => {
        const reportSection = document.getElementById('consumption-report-section');
        if (reportSection) {
          reportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          logger.session('[消费画像][滚动] 已滚动到报告区域');
        } else {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          logger.session('[消费画像][滚动] 滚动到页面底部');
        }
      }, 100);

    } catch (err) {
      logger.error('[消费画像][提交] ❌ 异常中断', {
        error: err?.message || err,
        stack: err?.stack,
      });
      message.error('哎呀，分析时出了点小状况，再试一下就好啦~');
    } finally {
      setConsumptionLoading(false);
      logger.session('═══════════════════════════════════════');
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 标题区 */}
        <Card style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <div>
                <Title level={3} style={{ margin: 0, color: '#a78bfa' }}>
                  <ThunderboltOutlined /> 投资人 DNA 分析
                </Title>
                <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                  通过你的决策描述，拆解5条染色体，找到与你最相似的投资大师
                </Paragraph>
              </div>
            </Space>
            <Space>
              <Tag color="#8b5cf6">染色体树版</Tag>
              <Tag color="#c084fc">斐波那契权重</Tag>
            </Space>
          </Space>
        </Card>

        {/* Tab 切换 */}
        {!report && (
          <Card
            style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)', padding: 0 }}
            bodyStyle={{ padding: 0 }}
          >
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              centered
              items={[
                {
                  key: 'quick',
                  label: (
                    <span>
                      <BulbOutlined /> 快速测试
                    </span>
                  ),
                },
                {
                  key: 'staircase',
                  label: (
                    <span>
                      <RiseOutlined /> 人格爬楼梯
                    </span>
                  ),
                },
                {
                  key: 'history',
                  label: (
                    <span>
                      <HistoryOutlined /> 历史记录
                      {historyRecords.length > 0 && (
                        <Tag color="#8b5cf6" style={{ marginLeft: 6, fontSize: 10 }}>
                          {historyRecords.length}
                        </Tag>
                      )}
                    </span>
                  ),
                },
              ]}
              style={{ padding: '0 24px' }}
            />
            <div style={{ padding: '0 24px 24px' }}>
              {activeTab === 'quick' && renderQuickTab()}
              {activeTab === 'staircase' && renderStairTab()}
              {activeTab === 'history' && renderHistoryTab()}
            </div>
          </Card>
        )}

        {/* 报告区 */}
        {report && (
          <>
            <Space style={{ width: '100%', justifyContent: 'center' }}>
              <Button icon={<ReloadOutlined />} onClick={() => setReport(null)}>
                重新测试
              </Button>
              <Button
                icon={<ArrowRightOutlined />}
                type="primary"
                onClick={() => {
                  setReport(null);
                  setActiveTab(activeTab === 'quick' ? 'staircase' : 'quick');
                }}
              >
                {activeTab === 'quick' ? '试试爬楼梯模式' : '试试快速测试模式'}
              </Button>
            </Space>
            {renderReport()}
          </>
        )}

        {/* ===== 消费画像板块 ===== */}
        {renderConsumptionSection()}

        {/* 对比视图 */}
        {compareResult && renderCompareView()}
      </Space>

      {/* 详情 Modal */}
      <Modal
        title={
          <Space>
            <Text style={{ color: '#fff' }}>📋 DNA 报告详情</Text>
            {detailRecord && (
              <Tag color={detailRecord.mode === 'quick' ? 'blue' : 'purple'}>
                {MODE_LABEL[detailRecord.mode]}
              </Tag>
            )}
          </Space>
        }
        open={!!detailRecord}
        onCancel={() => setDetailRecord(null)}
        footer={[
          <Button key="close" onClick={() => setDetailRecord(null)}>
            关闭
          </Button>,
        ]}
        width={720}
        style={{ top: 20 }}
        styles={{
          header: { background: 'rgba(30,19,64,0.95)', borderBottom: '1px solid rgba(139,92,246,0.2)' },
          body: { background: 'rgba(15,10,40,0.98)' },
          footer: { background: 'rgba(30,19,64,0.95)', borderTop: '1px solid rgba(139,92,246,0.2)' },
          mask: { background: 'rgba(0,0,0,0.85)' },
        }}
      >
        {detailRecord && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                测试时间：{formatDate(detailRecord.createdAt)}
              </Text>
            </div>

            {/* 基因测序 */}
            <Card
              title={<span style={{ color: '#fff', fontSize: 14 }}>🧬 基因测序结果</span>}
              style={{ background: 'rgba(30,19,64,0.6)', border: '1px solid rgba(139,92,246,0.2)' }}
              size="small"
            >
              {renderChromosomeBars(detailRecord.userDNA)}
            </Card>

            {/* Top3 */}
            <Card
              title={<span style={{ color: '#fff', fontSize: 14 }}>🎯 Top3 匹配</span>}
              style={{ background: 'rgba(30,19,64,0.6)', border: '1px solid rgba(139,92,246,0.2)' }}
              size="small"
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {detailRecord.top3.map((t, idx) => (
                  <div
                    key={t.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: idx === 0 ? 'rgba(250,173,20,0.1)' : 'rgba(139,92,246,0.05)',
                      border: `1px solid ${idx === 0 ? 'rgba(250,173,20,0.3)' : 'rgba(139,92,246,0.15)'}`,
                    }}
                  >
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Text style={{ fontSize: 18 }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</Text>
                        <Text style={{ color: '#fff', fontWeight: 600 }}>{t.name}</Text>
                        <Tag color="#8b5cf6" style={{ margin: 0 }}>{t.mbti}</Tag>
                      </Space>
                      <Text style={{ color: '#a78bfa', fontWeight: 700, fontSize: 16 }}>{t.similarity}%</Text>
                    </Space>
                  </div>
                ))}
              </Space>
            </Card>

            {/* 紫人组 */}
            <Card
              title={
                <span style={{ color: detailRecord.purpleGroup.isPurple ? '#c084fc' : '#fff', fontSize: 14 }}>
                  🔮 紫人组检测：{detailRecord.purpleGroup.isPurple ? '✅ 触发' : '❌ 未触发'}
                </span>
              }
              style={{
                background: detailRecord.purpleGroup.isPurple ? 'rgba(139,92,246,0.1)' : 'rgba(30,19,64,0.6)',
                border: detailRecord.purpleGroup.isPurple
                  ? '1px solid rgba(192,132,252,0.4)'
                  : '1px solid rgba(139,92,246,0.2)',
              }}
              size="small"
            >
              {detailRecord.purpleGroup.isPurple ? (
                <Space wrap>
                  {detailRecord.purpleGroup.purpleTypes.map((t) => (
                    <Tag key={t} color="#c084fc">
                      {t}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Top3 中只有 {detailRecord.purpleGroup.purpleCount} 位属于紫人组
                </Text>
              )}
            </Card>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default GenomePage;
