import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Card, Button, Space, Typography, Tag, Row, Col, Statistic,
  Divider, Tabs, Slider, Select, Alert, Progress, Table, Tooltip,
  Badge, Radio, List, Empty, Descriptions, Popconfirm, Switch,
  Input, message,
} from 'antd';
import {
  ArrowLeftOutlined, HomeOutlined, ReloadOutlined, LineChartOutlined,
  ThunderboltOutlined, SafetyOutlined, RiseOutlined, FallOutlined,
  InfoCircleOutlined, ExperimentOutlined, FireOutlined, WalletOutlined,
  AimOutlined, CalculatorOutlined, HistoryOutlined, PlayCircleOutlined,
  StopOutlined, DatabaseOutlined, BulbOutlined, SettingOutlined,
  SyncOutlined, CloudDownloadOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import * as echarts from 'echarts';

import {
  quantEngine,
  STEPS,
  PRESET_ASSETS,
  REGIMES,
} from '../utils/quantEngine';
import { logger } from '../utils/logger';
import { storage } from '../utils/storage';
import { auditLogStore } from '../utils/storageBus';
import { apiClient } from '../utils/apiClient';
import {
  isFuseActive, getFuseState, triggerFuse, resetFuse,
  checkMaxDrawdown, checkValuationBreach,
} from '../utils/fuse';
import './StockPage.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// ============================================================
// 股价模拟器主页面
// ============================================================
const StockPage = () => {
  const navigate = useNavigate();
  const chartRef = useRef(null);
  const klineRef = useRef(null);
  const riskRadarRef = useRef(null);
  const stepProgressRef = useRef(null);
  const chartInstance = useRef(null);
  const klineInstance = useRef(null);
  const riskRadarInstance = useRef(null);
  const stepProgressInstance = useRef(null);

  // ============ 输入参数状态 ============
  const [regime, setRegime] = useState('NEUTRAL');
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [customTicker, setCustomTicker] = useState('');
  const [assetQuery, setAssetQuery] = useState('');  // 标的搜索/自由输入
  const [useRealtimeData, setUseRealtimeData] = useState(false);
  const [realtimeLoading, setRealtimeLoading] = useState(false);
  const [realtimeSnapshot, setRealtimeSnapshot] = useState(null);  // { symbol, quote, asset, factors, kline }

  // 预设资产分组卡片墙（美股/中概/A股）
  const ASSET_GROUPS = useMemo(() => {
    const CN_ADR = ['BABA', 'PDD', 'JD', 'NIO'];
    const groups = [
      { key: 'us', label: '美股', assets: [] },
      { key: 'adr', label: '中概', assets: [] },
      { key: 'cn', label: 'A股', assets: [] },
    ];
    const q = assetQuery.trim().toLowerCase();
    PRESET_ASSETS.forEach((a) => {
      if (q && !a.ticker.toLowerCase().includes(q) && !(a.name || '').toLowerCase().includes(q)) return;
      if (/^\d/.test(a.ticker)) groups[2].assets.push(a);
      else if (CN_ADR.includes(a.ticker)) groups[1].assets.push(a);
      else groups[0].assets.push(a);
    });
    return groups.filter((g) => g.assets.length > 0);
  }, [assetQuery]);

  // 导出运行历史 CSV（BOM 防 Excel 中文乱码）
  const exportHistory = () => {
    try {
      const header = '时间,标的,环境,建议,仓位,上涨空间,数据源\n';
      const rows = runHistory.map((h) => [
        new Date(h.runAt).toLocaleString('zh-CN'),
        h.ticker,
        REGIMES[h.regime]?.label || h.regime,
        h.recommendation,
        (h.position * 100).toFixed(0) + '%',
        (h.upside > 0 ? '+' : '') + (h.upside * 100).toFixed(1) + '%',
        h.dataSource === 'realtime' ? '东方财富实时' : '内置预设',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quant_history_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('已导出运行历史 CSV');
    } catch (e) { message.error('导出失败'); logger.error('导出历史失败', e); }
  };
  const [simDays, setSimDays] = useState(126); // 半年
  const [manualPerturb, setManualPerturb] = useState(0); // ±20% 扰动
  const [autoRefresh, setAutoRefresh] = useState(false);

  // ============ 引擎输出状态 ============
  const [engineResult, setEngineResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [runHistory, setRunHistory] = useState([]);

  // ============ 熔断状态 ============
  const [fuseActive, setFuseActive] = useState(false);
  const [fuseState, setFuseState] = useState(null);

  // ============ Tab 状态 ============
  const [tabKey, setTabKey] = useState('simulation');

  // 定时刷新熔断状态
  useEffect(() => {
    const t = setInterval(() => {
      setFuseActive(isFuseActive());
      if (isFuseActive()) setFuseState(getFuseState());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ============================================================
  // 实时行情获取
  // ============================================================
  const effectiveTicker = useMemo(() => {
    if (useRealtimeData && customTicker.trim()) return customTicker.trim().toUpperCase();
    return selectedTicker;
  }, [useRealtimeData, customTicker, selectedTicker]);

  const fetchRealtimeData = async (symbol) => {
    if (!symbol) return null;
    setRealtimeLoading(true);
    const hide = message.loading(`正在从东方财富拉取 ${symbol} 实时行情...`, 0);
    try {
      logger.session('[StockPage][Realtime] 拉取实时行情', { symbol });
      const [val, kline] = await Promise.all([
        apiClient.marketGetValuation(symbol),
        apiClient.marketGetKline(symbol, Math.max(simDays, 120)).catch(() => ({ bars: [] })),
      ]);
      const snapshot = { ...val, kline: kline?.bars || [], fetchedAt: Date.now() };
      setRealtimeSnapshot(snapshot);
      logger.session('[StockPage][Realtime] 行情已拉取', {
        ticker: snapshot?.asset?.ticker,
        price: snapshot?.quote?.price,
        涨跌幅: snapshot?.quote?.change_pct,
        K线条数: snapshot?.kline?.length,
      });
      message.success(`${snapshot.asset?.name || symbol} 实时行情已更新`);
      return snapshot;
    } catch (e) {
      logger.error('[StockPage][Realtime] 拉取失败', e);
      message.error(`拉取实时行情失败：${e.message || e}`);
      setRealtimeSnapshot(null);
      return null;
    } finally {
      hide();
      setRealtimeLoading(false);
    }
  };

  // 标的搜索框回车：命中预设→直接选中；预设外→自动开实时开关并拉行情
  const handleAssetSearch = () => {
    const q = assetQuery.trim();
    if (!q) return;
    const upper = q.toUpperCase();
    const hit = PRESET_ASSETS.find(
      (a) => a.ticker.toUpperCase() === upper || a.name === q
    );
    if (hit) {
      setSelectedTicker(hit.ticker);
      setUseRealtimeData(false);
      setRealtimeSnapshot(null);
      setCustomTicker('');
      setAssetQuery('');
      message.success(`已选中 ${hit.ticker} · ${hit.name}`);
    } else {
      setCustomTicker(upper);
      setUseRealtimeData(true);
      setAssetQuery('');
      fetchRealtimeData(upper);
    }
  };

  // 历史记录从 localStorage 读取
  useEffect(() => {
    try {
      const hist = storage.get('quantRunHistory') || [];
      setRunHistory(hist.slice(-20));
    } catch (e) { /* ignore */ }
  }, []);

  // ============================================================
  // 运行引擎
  // ============================================================
  const runEngine = async () => {
    if (running) return;
    setRunning(true);
    setCurrentStep(0);

    // 如果勾选了实时行情，先拉一遍（自定义代码优先，否则拉当前 selectedTicker）
    let snapshot = realtimeSnapshot;
    if (useRealtimeData) {
      const symbol = customTicker.trim() || selectedTicker;
      if (symbol) {
        snapshot = await fetchRealtimeData(symbol);
      }
    }

    const ticker = (snapshot?.asset?.ticker) || effectiveTicker;
    logger.session('[StockPage] 启动十一步量化引擎', {
      regime, ticker, simDays, perturb: manualPerturb,
      数据源: useRealtimeData ? (snapshot ? '东方财富实时' : '实时源失败→回退内置') : '内置 PRESET_ASSETS',
    });

    // 模拟十一步进度
    for (let i = 0; i < STEPS.length; i++) {
      setCurrentStep(i);
      await new Promise(r => setTimeout(r, 120));
    }

    try {
      // 扰动参数
      const perturbedRegime = manualPerturb > 0.1
        ? 'BLUE_OCEAN'
        : manualPerturb < -0.1
          ? 'RED_OCEAN'
          : regime;

      // 构建量化引擎入参
      const runOpts = {
        regime: perturbedRegime,
        initialTicker: ticker,
        simDays,
      };

      // 如果有实时行情快照 → 直接传入给 step0_macroFunnel / factors
      if (snapshot?.asset) {
        runOpts.initialTickerName = snapshot.asset.name;
        runOpts.initialTickerIndustry = snapshot.asset.industry;
        runOpts.initialTickerMarketCap = snapshot.asset.marketCap;
        runOpts.initialTickerPE = snapshot.asset.pe;
        runOpts.initialTickerPB = snapshot.asset.pb;
        runOpts.initialTickerGrowth = snapshot.asset.revenueGrowthYoY;
        runOpts.initialTickerFCFYield = snapshot.asset.fcfYield;
        runOpts.initialTickerROE = snapshot.asset.roe;
        runOpts.initialTickerDE = snapshot.asset.debtToEquity;
        runOpts.initialTickerGrade = snapshot.asset.grade;
        runOpts.initialTickerBasePrice = snapshot.asset.basePrice;
        // customAssets 用"当前资产 + 内置池"的合并池，保证海选打分有对比
        runOpts.customAssets = [
          snapshot.asset,
          ...PRESET_ASSETS.filter(a => a.ticker !== snapshot.asset.ticker),
        ];
        if (snapshot.factors) {
          runOpts.marketFactors = { [snapshot.asset.ticker]: snapshot.factors };
        }
      }

      const result = quantEngine.runQuantEngine(runOpts);
      setEngineResult(result);
      setCurrentStep(STEPS.length);

      // 保存历史
      try {
        const hist = storage.get('quantRunHistory') || [];
        hist.push({
          runId: result.runId,
          runAt: result.runAt,
          ticker: result.summary.ticker,
          recommendation: result.summary.recommendation,
          position: result.summary.position,
          upside: result.summary.upside,
          regime: result.regime,
          dataSource: useRealtimeData ? 'realtime' : 'preset',
        });
        const trimmed = hist.slice(-20);
        storage.set('quantRunHistory', trimmed);
        setRunHistory(trimmed);
      } catch (e) { logger.error('保存量化历史失败', e); }

      logger.session('[StockPage] 量化引擎执行完成', {
        标的: result.summary.ticker,
        建议: result.summary.recommendation,
        上涨空间: `${(result.summary.upside * 100).toFixed(1)}%`,
      });
    } catch (e) {
      logger.error('[StockPage] 量化引擎执行失败', e);
      message.error(`引擎执行异常：${e.message || e}`);
    } finally {
      setRunning(false);
    }
  };

  // 自动刷新：实时数据 + 引擎每 15 秒重跑
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      runEngine();
    }, 15000); // 15秒自动重跑
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, regime, selectedTicker, useRealtimeData, customTicker, simDays, manualPerturb]);

  // 首次加载时自动运行一次
  useEffect(() => {
    runEngine();
    // eslint-disable-next-line
  }, []);

  // ============================================================
  // 图表渲染
  // ============================================================
  useEffect(() => {
    if (!chartRef.current || !engineResult?.pipeline?.simulation) return;

    const sim = engineResult.pipeline.simulation;
    const prices = sim.priceSeries;
    const days = prices.map((_, i) => `D${i}`);

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark');
    }

    const currentPrice = sim.parameters.initialPrice;
    const intrinsicPrice = sim.parameters.intrinsicPrice;

    chartInstance.current.setOption({
      backgroundColor: 'transparent',
      title: {
        text: `${engineResult.summary.ticker} 股价模拟走势`,
        subtext: `${simDays}交易日 · ${REGIMES[engineResult.regime]?.label || '中性'}`,
        left: 'left',
        textStyle: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
        subtextStyle: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(18,16,40,0.95)',
        borderColor: 'rgba(168,85,247,0.4)',
        textStyle: { color: '#fff' },
      },
      legend: {
        data: ['模拟价格', '内在价值', '买入区', '卖出区'],
        top: 0, right: 0,
        textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
      },
      grid: { left: '8%', right: '5%', top: '18%', bottom: '12%' },
      xAxis: {
        type: 'category',
        data: days,
        axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, interval: Math.floor(days.length / 10) },
        axisLine: { lineStyle: { color: 'rgba(168,85,247,0.3)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: 'rgba(255,255,255,0.5)', fontSize: 10,
          formatter: v => `$${v.toFixed(0)}`,
        },
        splitLine: { lineStyle: { color: 'rgba(168,85,247,0.1)' } },
      },
      series: [
        {
          name: '模拟价格',
          type: 'line',
          data: prices,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#a855f7' },
              { offset: 0.5, color: '#ec4899' },
              { offset: 1, color: '#fbbf24' },
            ]),
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(168,85,247,0.3)' },
              { offset: 1, color: 'rgba(168,85,247,0.02)' },
            ]),
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              {
                yAxis: currentPrice, name: '当前价',
                lineStyle: { color: 'rgba(16,185,129,0.6)', type: 'dashed' },
                label: { formatter: `现价 $${currentPrice.toFixed(0)}`, color: 'rgba(16,185,129,0.8)' },
              },
              {
                yAxis: intrinsicPrice, name: '内在价值',
                lineStyle: { color: 'rgba(251,191,36,0.8)', type: 'dashed' },
                label: { formatter: `目标 $${intrinsicPrice.toFixed(0)}`, color: 'rgba(251,191,36,0.9)' },
              },
            ],
          },
        },
        {
          name: '内在价值',
          type: 'line',
          data: new Array(prices.length).fill(intrinsicPrice),
          symbol: 'none',
          lineStyle: { color: 'rgba(251,191,36,0.3)', type: 'dotted', width: 1 },
        },
        {
          name: '买入区',
          type: 'line',
          data: new Array(prices.length).fill(engineResult.pipeline.valuation.perShare.buyPrice),
          symbol: 'none',
          lineStyle: { color: 'rgba(16,185,129,0.4)', type: 'dotted', width: 1 },
          areaStyle: {
            color: 'rgba(16,185,129,0.08)',
            origin: 'start',
          },
        },
        {
          name: '卖出区',
          type: 'line',
          data: new Array(prices.length).fill(engineResult.pipeline.valuation.perShare.sellPrice),
          symbol: 'none',
          lineStyle: { color: 'rgba(239,68,68,0.4)', type: 'dotted', width: 1 },
          areaStyle: {
            color: 'rgba(239,68,68,0.08)',
            origin: 'end',
          },
        },
      ],
    });

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [engineResult, simDays]);

  // 风险雷达图
  useEffect(() => {
    if (!riskRadarRef.current || !engineResult) return;
    if (!riskRadarInstance.current) {
      riskRadarInstance.current = echarts.init(riskRadarRef.current, 'dark');
    }

    const risks = engineResult.pipeline.factorLibrary?.riskFactors || {};
    const val = engineResult.pipeline.valuation?.composite || {};
    const stats = engineResult.pipeline.simulation?.statistics || {};

    riskRadarInstance.current.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(18,16,40,0.95)',
        borderColor: 'rgba(168,85,247,0.4)',
        textStyle: { color: '#fff' },
      },
      radar: {
        indicator: [
          { name: '估值安全', max: 100 },
          { name: '波动控制', max: 100 },
          { name: '回撤防御', max: 100 },
          { name: '集中度风险', max: 100 },
          { name: '理性评分', max: 100 },
          { name: '流动性', max: 100 },
        ],
        radius: '65%',
        center: ['50%', '55%'],
        axisName: {
          color: 'rgba(255,255,255,0.7)',
          fontSize: 11,
        },
        splitArea: {
          areaStyle: {
            color: [
              'rgba(168,85,247,0.03)',
              'rgba(168,85,247,0.06)',
              'rgba(168,85,247,0.03)',
              'rgba(168,85,247,0.06)',
            ],
          },
        },
        splitLine: { lineStyle: { color: 'rgba(168,85,247,0.2)' } },
        axisLine: { lineStyle: { color: 'rgba(168,85,247,0.3)' } },
      },
      series: [{
        type: 'radar',
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#a855f7', width: 2 },
        itemStyle: { color: '#ec4899' },
        areaStyle: {
          color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
            { offset: 0, color: 'rgba(236,72,153,0.5)' },
            { offset: 1, color: 'rgba(168,85,247,0.15)' },
          ]),
        },
        data: [{
          value: [
            Math.max(0, 100 - (val.upside < 0 ? Math.abs(val.upside) * 200 : 0)),       // 估值安全
            Math.max(0, 100 - safeNum(stats.annualVolatility, 0.3) * 200),            // 波动控制
            Math.max(0, 100 - safeNum(stats.maxDrawdown, 0.3) * 200),                 // 回撤防御
            Math.max(0, 100 - safeNum(risks.coneC, 0.4) * 120),                        // 集中度风险
            safeNum(engineResult.pipeline.rationality?.rationalityScore, 50),         // 理性评分
            60 + Math.random() * 30,                                                    // 流动性
          ],
          name: '风险向量',
        }],
      }],
    });
  }, [engineResult]);

  // 十一步进度条
  useEffect(() => {
    if (!stepProgressRef.current) return;
    if (!stepProgressInstance.current) {
      stepProgressInstance.current = echarts.init(stepProgressRef.current, 'dark');
    }
    const stepStatus = STEPS.map((s, i) => i < currentStep ? 3 : i === currentStep && running ? 2 : 0);
    stepProgressInstance.current.setOption({
      backgroundColor: 'transparent',
      grid: { left: 10, right: 10, top: 10, bottom: 10 },
      xAxis: {
        type: 'category',
        data: STEPS.map(s => s.name),
        axisLabel: {
          color: 'rgba(255,255,255,0.5)', fontSize: 9, interval: 0,
          rotate: 30,
        },
        axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: { show: false, max: 1 },
      series: [{
        type: 'bar',
        barWidth: '65%',
        data: STEPS.map((_, i) => ({
          value: 1,
          itemStyle: {
            color: stepStatus[i] === 3
              ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#a855f7' },
                { offset: 1, color: '#ec4899' },
              ])
              : stepStatus[i] === 2
                ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#fbbf24' },
                  { offset: 1, color: '#f59e0b' },
                ])
                : 'rgba(255,255,255,0.08)',
            borderRadius: [4, 4, 0, 0],
          },
        })),
        label: {
          show: true,
          position: 'top',
          formatter: (p) => {
            const status = stepStatus[p.dataIndex];
            return status === 3 ? '✓' : status === 2 ? '⏳' : '';
          },
          color: '#fff',
          fontSize: 10,
        },
      }],
    });
  }, [currentStep, running]);

  // 清理
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      klineInstance.current?.dispose();
      riskRadarInstance.current?.dispose();
      stepProgressInstance.current?.dispose();
    };
  }, []);

  // ============================================================
  // 辅助函数
  // ============================================================
  const safeNum = (v, def = 0) => typeof v === 'number' && !isNaN(v) ? v : def;

  // ============================================================
  // 快捷操作
  // ============================================================
  const handleEmergencyStop = () => {
    triggerFuse('MANUAL_STOP', '用户手动触发股价模拟器紧急停机', {
      source: 'StockPage',
      ticker: selectedTicker,
    });
    logger.session('[StockPage] 🛑 用户触发紧急停机');
  };

  const handleResetFuse = () => {
    resetFuse(true);
    setFuseState(null);
    logger.session('[StockPage] 熔断已手动重置');
  };

  // ============================================================
  // 渲染子组件
  // ============================================================

  // 十一步进度面板
  const StepProgressPanel = () => (
    <Card className="stock-step-card glass-card" size="small">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <CalculatorOutlined style={{ color: '#a855f7', marginRight: 8 }} />
        <Text strong style={{ color: 'rgba(255,255,255,0.9)' }}>十一步量化投研闭环</Text>
        <Tag
          color={currentStep >= STEPS.length ? 'green' : running ? 'gold' : 'default'}
          style={{ marginLeft: 'auto' }}
        >
          {running ? `Step ${currentStep + 1}/${STEPS.length}` : currentStep >= STEPS.length ? '已完成' : '待运行'}
        </Tag>
      </div>
      <div ref={stepProgressRef} style={{ width: '100%', height: 70 }} />
    </Card>
  );

  // Hero 头卡
  const HeroCard = () => {
    const s = engineResult?.summary;
    const risk = s?.riskLevel;
    return (
      <Card className="stock-hero-card glass-gold">
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} md={13}>
            <Space direction="vertical" size={6}>
              <Space wrap>
                <Tag color="purple">量化引擎 v2.1</Tag>
                {s && (
                  <Tag color={risk?.color || '#f59e0b'} style={{ border: 'none' }}>
                    {risk?.level || '风险评估中'}
                  </Tag>
                )}
                {fuseActive && <Tag color="red" icon={<FireOutlined />}>熔断触发</Tag>}
              </Space>
              <Title level={3} style={{ margin: 0, color: '#fff' }}>
                {s ? `${s.ticker} · ${s.name}` : '股价模拟器'}
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.65)' }}>
                {s
                  ? `建议：${s.recommendation} · 目标仓位 ${(s.position * 100).toFixed(0)}%`
                  : '基于十一步量化引擎 + 金融风险向量精算的智能投研系统'}
              </Text>
            </Space>
          </Col>
          <Col xs={24} md={11}>
            <Row gutter={16} className="stock-hero-stats">
              <Col span={8} className="stat-cell">
                <div className="stat-label">当前价</div>
                <div className="stat-value" style={{ color: '#fff' }}>
                  <span className="stat-prefix">$</span>
                  {safeNum(s?.currentPrice, 0).toFixed(2)}
                </div>
              </Col>
              <Col span={8} className="stat-cell">
                <div className="stat-label">目标价</div>
                <div className="stat-value" style={{ color: s && s.upside > 0 ? '#10b981' : '#ef4444' }}>
                  <span className="stat-prefix">$</span>
                  {safeNum(s?.intrinsicPrice, 0).toFixed(2)}
                </div>
              </Col>
              <Col span={8} className="stat-cell">
                <div className="stat-label">上涨空间</div>
                <div className="stat-value" style={{ color: s && s.upside > 0 ? '#10b981' : '#ef4444' }}>
                  {s?.upside > 0 ? '+' : ''}{(safeNum(s?.upside, 0) * 100).toFixed(1)}<span className="stat-suffix">%</span>
                </div>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>
    );
  };

  // 参数控制面板
  const ControlPanel = () => (
    <Card className="stock-control-card glass-card" size="small" title={
      <Space><SettingOutlined style={{ color: '#a855f7' }} /><Text strong style={{ color: 'rgba(255,255,255,0.85)' }}>参数配置</Text></Space>
    }>
      <Space direction="vertical" size={18} style={{ width: '100%' }} className="stock-control-space">
        <div>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>宏观环境</Text>
          <Radio.Group
            value={regime}
            onChange={e => setRegime(e.target.value)}
            style={{ width: '100%', marginTop: 6 }}
            optionType="button"
            buttonStyle="solid"
            size="small"
          >
            {Object.values(REGIMES).map(r => (
              <Radio.Button key={r.id} value={r.id} style={{
                background: regime === r.id ? r.color : 'transparent',
                color: regime === r.id ? '#fff' : 'rgba(255,255,255,0.6)',
                borderColor: 'rgba(168,85,247,0.3)',
              }}>
                {r.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>

        <div>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>选择标的（{PRESET_ASSETS.length} 只预设 · 可搜索/自选）</Text>
            <Text style={{ color: '#D4AF37', fontSize: 11, fontWeight: 700 }}>{selectedTicker}</Text>
          </Space>
          <Input
            allowClear
            size="small"
            placeholder="搜索预设，或输入任意代码回车拉实时（AAPL / 600519 / 000001）"
            value={assetQuery}
            onChange={(e) => setAssetQuery(e.target.value)}
            onPressEnter={handleAssetSearch}
            style={{ marginTop: 6 }}
          />
          <div style={{ maxHeight: 238, overflowY: 'auto', marginTop: 8, paddingRight: 4 }}>
            {ASSET_GROUPS.map((g) => (
              <div key={g.key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 6 }}>
                  {g.label} · {g.assets.length}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {g.assets.map((a) => {
                    const active = a.ticker === selectedTicker;
                    const disabled = useRealtimeData && !!customTicker.trim();
                    return (
                      <div
                        key={a.ticker}
                        onClick={() => {
                          if (disabled) return;
                          setSelectedTicker(a.ticker);
                          setUseRealtimeData(false);
                          setRealtimeSnapshot(null);
                        }}
                        style={{
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.45 : 1,
                          padding: '6px 8px',
                          borderRadius: 8,
                          border: active ? '1px solid rgba(212,175,55,0.6)' : '1px solid rgba(168,85,247,0.18)',
                          background: active ? 'rgba(212,175,55,0.10)' : 'rgba(168,85,247,0.05)',
                          transition: 'all .15s',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: active ? '#D4AF37' : 'rgba(255,255,255,0.85)' }}>{a.ticker}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name} · {a.industry}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              <CloudDownloadOutlined style={{ marginRight: 4 }} />
              接东方财富实时行情
            </Text>
            <Switch
              checked={useRealtimeData}
              onChange={setUseRealtimeData}
              size="small"
            />
          </Space>
          <Input
            allowClear
            size="small"
            placeholder="股票代码：AAPL / 600519 / 000001"
            value={customTicker}
            onChange={(e) => setCustomTicker(e.target.value)}
            onPressEnter={() => useRealtimeData && runEngine()}
            style={{ marginTop: 8 }}
            suffix={
              <Tooltip title="实时拉取：AAPL(美股) / 600519(沪) / 000001(深)">
                <InfoCircleOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />
              </Tooltip>
            }
            disabled={!useRealtimeData}
          />
          {realtimeSnapshot?.quote && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
              数据时间 {realtimeSnapshot.fetchedAt ? new Date(realtimeSnapshot.fetchedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '—'}
              {realtimeSnapshot.quote.provider ? ` · 来源 ${realtimeSnapshot.quote.provider}` : ''}
            </div>
          )}
          {realtimeSnapshot?.quote && (
            <Row gutter={12} style={{ marginTop: 10 }}>
              <Col span={12}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                    {realtimeSnapshot.quote.name} · 实时价
                  </span>}
                  value={realtimeSnapshot.quote.price}
                  valueStyle={{
                    color: realtimeSnapshot.quote.change_pct >= 0 ? '#ef4444' : '#10b981',
                    fontSize: 14, fontWeight: 700,
                  }}
                  prefix={realtimeSnapshot.symbol?.market === 'US' ? '$' : '¥'}
                  suffix={
                    <span style={{
                      fontSize: 10,
                      color: realtimeSnapshot.quote.change_pct >= 0 ? '#ef4444' : '#10b981',
                    }}>
                      {realtimeSnapshot.quote.change_pct >= 0 ? '+' : ''}
                      {(realtimeSnapshot.quote.change_pct * 100).toFixed(2)}%
                    </span>
                  }
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>PE · PB · ROE</span>}
                  value={realtimeSnapshot.asset?.pe || 0}
                  valueStyle={{ color: '#a855f7', fontSize: 14, fontWeight: 700 }}
                  suffix={
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>
                      &nbsp;/ {(realtimeSnapshot.asset?.pb || 0).toFixed(2)} / {((realtimeSnapshot.asset?.roe || 0) * 100).toFixed(1)}%
                    </span>
                  }
                />
              </Col>
            </Row>
          )}
        </div>

        <div>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>模拟周期</Text>
            <Text style={{ color: '#a855f7', fontSize: 12 }}>{simDays} 日 ({(simDays / 252 * 12).toFixed(0)}月)</Text>
          </Space>
          <Slider
            min={20}
            max={504}
            step={1}
            value={simDays}
            onChange={setSimDays}
            marks={{ 63: '3M', 126: '6M', 252: '1Y', 504: '2Y' }}
            tooltip={{ formatter: v => `${v}日` }}
          />
        </div>

        <div>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>稳态扰动 (环境模拟)</Text>
            <Text style={{ color: manualPerturb > 0 ? '#10b981' : manualPerturb < 0 ? '#ef4444' : '#a855f7', fontSize: 12 }}>
              {manualPerturb > 0 ? '+' : ''}{(manualPerturb * 100).toFixed(0)}%
            </Text>
          </Space>
          <Slider
            min={-0.2}
            max={0.2}
            step={0.01}
            value={manualPerturb}
            onChange={setManualPerturb}
            marks={{ '-0.2': '-20%', 0: '0', 0.2: '+20%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Switch
              checked={autoRefresh}
              onChange={setAutoRefresh}
              size="small"
            />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>15s 自动重算</Text>
          </Space>
        </div>

        <Divider style={{ margin: '2px 0', borderColor: 'rgba(168,85,247,0.15)' }} />

        <Space style={{ width: '100%' }} size={8}>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={running}
            onClick={runEngine}
            block
            className="btn-purple-gold"
          >
            {running ? `运行中 Step ${currentStep + 1}` : '运行十一步引擎'}
          </Button>
          <Popconfirm
            title="确认触发紧急停机？"
            description="将强制设置仓位为 0 并锁定系统。"
            onConfirm={handleEmergencyStop}
            okText="立即停机"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<StopOutlined />} className="stock-stop-btn" />
          </Popconfirm>
          <Button icon={<ReloadOutlined />} onClick={() => {
            handleResetFuse();
            runEngine();
          }} />
        </Space>

        {fuseActive && (
          <Alert
            message="🛑 熔断已触发"
            description={fuseState ? `层级: ${fuseState.layer?.name} · ${fuseState.reason}` : '强制仓位归零'}
            type="error"
            showIcon
            action={
              <Button size="small" danger ghost onClick={handleResetFuse}>重置</Button>
            }
            style={{ fontSize: 11 }}
          />
        )}
      </Space>
    </Card>
  );

  // 仓位与订单面板
  const PositionPanel = () => {
    const rc = engineResult?.pipeline?.riskControl;
    if (!rc) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待引擎输出" />;

    return (
      <Card className="stock-position-card glass-card" size="small" title={
        <Space><SafetyOutlined style={{ color: '#a855f7' }} /><Text strong style={{ color: 'rgba(255,255,255,0.85)' }}>Step 8 · 风控门控</Text></Space>
      }>
        <Row gutter={[12, 16]}>
          <Col xs={12}>
            <Card size="small" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 10 }}>
              <Statistic
                title={<Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>理论凯利</Text>}
                value={safeNum(rc.positions?.theoreticalKelly, 0) * 100}
                suffix="%"
                valueStyle={{ color: '#a855f7', fontSize: 16, fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12}>
            <Card size="small" style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.25)', borderRadius: 10 }}>
              <Statistic
                title={<Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>半凯利</Text>}
                value={safeNum(rc.positions?.halfKelly, 0) * 100}
                suffix="%"
                valueStyle={{ color: '#ec4899', fontSize: 16, fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={24}>
            <Card size="small" style={{
              background: fuseActive
                ? 'rgba(239,68,68,0.12)'
                : 'rgba(16,185,129,0.1)',
              border: `1px solid ${fuseActive ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.35)'}`,
              borderRadius: 10,
            }}>
              <Row align="middle">
                <Col flex="auto">
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>实际仓位 (强制门控)</Text>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{
                      color: fuseActive ? '#ef4444' : '#10b981',
                      fontSize: 28, fontWeight: 800,
                    }}>
                      {safeNum(rc.positions?.actualPosition, 0) * 100}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>%</span>
                  </div>
                </Col>
                <Col>
                  <Progress
                    type="dashboard"
                    percent={safeNum(rc.positions?.actualPosition, 0) * 100}
                    width={70}
                    strokeColor={{ '0%': '#10b981', '100%': '#a855f7' }}
                    trailColor="rgba(255,255,255,0.06)"
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        <Divider style={{ margin: '12px 0', borderColor: 'rgba(168,85,247,0.15)' }} />

        <Descriptions
          size="small"
          column={1}
          labelStyle={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}
          contentStyle={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}
        >
          <Descriptions.Item label="止损价">
            <Text type="danger" style={{ fontSize: 13, fontWeight: 600 }}>
              ${safeNum(rc.orders?.stopLossPrice, 0).toFixed(2)}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="止盈价">
            <Text type="success" style={{ fontSize: 13, fontWeight: 600 }}>
              ${safeNum(rc.orders?.takeProfitPrice, 0).toFixed(2)}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="对冲策略">
            {rc.hedge?.needHedge ? (
              <Space>
                <Tag color="orange" style={{ fontSize: 10 }}>
                  对冲 {rc.hedge.hedgeRatio * 100}%
                </Tag>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                  {rc.hedge.instruments?.join(' · ')}
                </Text>
              </Space>
            ) : (
              <Tag color="default" style={{ fontSize: 10 }}>无需对冲</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>

        {rc.warnings?.length > 0 && (
          <>
            <Divider style={{ margin: '12px 0', borderColor: 'rgba(168,85,247,0.15)' }} />
            <List
              size="small"
              dataSource={rc.warnings}
              renderItem={item => (
                <List.Item style={{ border: 'none', padding: '4px 0', color: 'rgba(251,191,36,0.9)', fontSize: 11 }}>
                  {item}
                </List.Item>
              )}
            />
          </>
        )}
      </Card>
    );
  };

  // 风险向量精算面板
  const RiskVectorPanel = () => {
    const factors = engineResult?.pipeline?.factorLibrary;
    const risks = factors?.riskFactors;
    if (!risks) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待因子计算" />;

    const columns = [
      {
        title: '指标',
        dataIndex: 'name',
        key: 'name',
        render: (t, r) => (
          <Space>
            <span style={{ color: r.color, fontSize: 14 }}>{r.icon}</span>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{t}</Text>
          </Space>
        ),
      },
      {
        title: '公式',
        dataIndex: 'formula',
        key: 'formula',
        render: t => <Text code style={{ color: 'rgba(168,85,247,0.8)', fontSize: 10 }}>{t}</Text>,
      },
      {
        title: '数值',
        dataIndex: 'value',
        key: 'value',
        render: (v, r) => (
          <Text strong style={{ color: r.color, fontSize: 12 }}>
            {r.formatter ? r.formatter(v) : v}
          </Text>
        ),
      },
      {
        title: '解释',
        dataIndex: 'explain',
        key: 'explain',
        render: t => <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{t}</Text>,
      },
    ];

    const data = [
      {
        key: 'coneC', name: 'ConeC 集中度风险', icon: '🎯',
        formula: 'm·ρ₀/V×0.8',
        value: safeNum(risks.coneC, 0),
        formatter: v => v.toFixed(3),
        color: safeNum(risks.coneC, 0) > 0.7 ? '#ef4444' : safeNum(risks.coneC, 0) > 0.5 ? '#f59e0b' : '#10b981',
        explain: safeNum(risks.coneC, 0) > 0.7 ? '高度集中，需分散' : safeNum(risks.coneC, 0) > 0.5 ? '中度集中' : '分散良好',
      },
      {
        key: 'zScore', name: 'Z-Score 破产风险', icon: '⚠️',
        formula: 'Altman Z = 1.2A+1.4B+3.3C+0.6D+E',
        value: safeNum(risks.zScore, 0),
        formatter: v => v.toFixed(2),
        color: safeNum(risks.zScore, 0) < 1.81 ? '#ef4444' : safeNum(risks.zScore, 0) < 2.99 ? '#f59e0b' : '#10b981',
        explain: safeNum(risks.zScore, 0) < 1.81 ? '危险区' : safeNum(risks.zScore, 0) < 2.99 ? '灰色区' : '安全区',
      },
      {
        key: 'mdd', name: 'MDD 最大回撤容忍', icon: '📉',
        formula: '(Peak-Trough)/Peak',
        value: safeNum(risks.maxDrawdown1y, 0),
        formatter: v => `${(v * 100).toFixed(0)}%`,
        color: safeNum(risks.maxDrawdown1y, 0) > 0.4 ? '#ef4444' : safeNum(risks.maxDrawdown1y, 0) > 0.25 ? '#f59e0b' : '#10b981',
        explain: `30日波动率 ${(safeNum(risks.volatility30d, 0) * 100).toFixed(0)}%`,
      },
      {
        key: 'var', name: 'VaR(95%) 风险价值', icon: '🛡️',
        formula: 'μ - 1.645σ',
        value: safeNum(risks.valueAtRisk95, 0),
        formatter: v => `-${(v * 100).toFixed(1)}%`,
        color: safeNum(risks.valueAtRisk95, 0) > 0.05 ? '#ef4444' : '#10b981',
        explain: '95%置信日损失上限',
      },
      {
        key: 'beta', name: 'Beta 系统风险', icon: '📊',
        formula: 'Cov(r,rm)/Var(rm)',
        value: safeNum(risks.beta, 1),
        formatter: v => v.toFixed(2),
        color: safeNum(risks.beta, 1) > 1.3 ? '#ef4444' : Math.abs(safeNum(risks.beta, 1) - 1) < 0.2 ? '#10b981' : '#f59e0b',
        explain: safeNum(risks.beta, 1) > 1 ? '高于市场波动' : '低于市场波动',
      },
    ];

    return (
      <Row gutter={20}>
        <Col xs={24} md={14}>
          <Card
            className="glass-card"
            size="small"
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#a855f7' }} />
                <Text strong style={{ color: 'rgba(255,255,255,0.85)' }}>金融风险向量精算</Text>
              </Space>
            }
          >
            <Table
              size="small"
              columns={columns}
              dataSource={data}
              pagination={false}
              rowKey="key"
              showHeader={false}
              style={{ fontSize: 11 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card
            className="glass-card"
            size="small"
            title={
              <Space>
                <AimOutlined style={{ color: '#a855f7' }} />
                <Text strong style={{ color: 'rgba(255,255,255,0.85)' }}>风险雷达</Text>
              </Space>
            }
          >
            <div ref={riskRadarRef} style={{ width: '100%', height: 320 }} />
          </Card>
        </Col>
      </Row>
    );
  };

  // 估值模型面板
  const ValuationPanel = () => {
    const val = engineResult?.pipeline?.valuation;
    const stats = engineResult?.pipeline?.simulation?.statistics;
    if (!val) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待估值计算" />;

    return (
      <Row gutter={20}>
        <Col xs={24} md={14}>
          <Card
            className="glass-card"
            size="small"
            title={
              <Space>
                <CalculatorOutlined style={{ color: '#a855f7' }} />
                <Text strong style={{ color: 'rgba(255,255,255,0.85)' }}>Step 4 · 估值模型 (DCF + WACC)</Text>
              </Space>
            }
          >
            <Descriptions
              size="small"
              column={2}
              labelStyle={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}
              contentStyle={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}
            >
              <Descriptions.Item label="WACC (加权资本成本)">
                <Text strong style={{ color: '#fbbf24' }}>{(safeNum(val.wacc, 0) * 100).toFixed(2)}%</Text>
              </Descriptions.Item>
              <Descriptions.Item label="DCF 内在价值 (十亿)">
                <Text strong style={{ color: '#a855f7' }}>${(safeNum(val.dcf?.intrinsicValue, 0) / 10000).toFixed(2)}T</Text>
              </Descriptions.Item>
              <Descriptions.Item label="PE 相对估值">
                <Text>
                  现价{val.relative?.pe?.current?.toFixed(0)}x ·
                  公允{val.relative?.pe?.fair?.toFixed(0)}x
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="PB 相对估值">
                <Text>
                  现价{val.relative?.pb?.current?.toFixed(0)}x ·
                  公允{val.relative?.pb?.fair?.toFixed(0)}x
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="安全边际">
                <Tag color="purple" style={{ fontSize: 10 }}>
                  {(safeNum(val.composite?.marginOfSafety, 0) * 100).toFixed(0)}%
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="综合上涨空间">
                <Text strong style={{ color: safeNum(val.composite?.upside, 0) > 0 ? '#10b981' : '#ef4444' }}>
                  {safeNum(val.composite?.upside, 0) > 0 ? '+' : ''}
                  {(safeNum(val.composite?.upside, 0) * 100).toFixed(1)}%
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '12px 0', borderColor: 'rgba(168,85,247,0.15)' }} />

            <Text strong style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>估值区间</Text>
            <div style={{ marginTop: 8 }}>
              <Row gutter={8}>
                <Col flex={1}>
                  <Card size="small" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, textAlign: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>买入价</Text>
                    <div style={{ color: '#10b981', fontWeight: 700 }}>
                      ${safeNum(val.perShare?.buyPrice, 0).toFixed(2)}
                    </div>
                  </Card>
                </Col>
                <Col flex={1}>
                  <Card size="small" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, textAlign: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>公允价</Text>
                    <div style={{ color: '#fbbf24', fontWeight: 700 }}>
                      ${safeNum(val.perShare?.fairPrice, 0).toFixed(2)}
                    </div>
                  </Card>
                </Col>
                <Col flex={1}>
                  <Card size="small" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, textAlign: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>卖出价</Text>
                    <div style={{ color: '#ef4444', fontWeight: 700 }}>
                      ${safeNum(val.perShare?.sellPrice, 0).toFixed(2)}
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Card
            className="glass-card"
            size="small"
            title={
              <Space>
                <ExperimentOutlined style={{ color: '#a855f7' }} />
                <Text strong style={{ color: 'rgba(255,255,255,0.85)' }}>模拟绩效</Text>
              </Space>
            }
          >
            <Row gutter={[8, 12]}>
              <Col xs={12}>
                <Statistic
                  title={<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>总收益</span>}
                  value={safeNum(stats?.totalReturn, 0) * 100}
                  suffix="%"
                  prefix={safeNum(stats?.totalReturn, 0) > 0 ? '+' : ''}
                  valueStyle={{ color: safeNum(stats?.totalReturn, 0) > 0 ? '#10b981' : '#ef4444', fontSize: 16, fontWeight: 700 }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title={<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>年化收益</span>}
                  value={safeNum(stats?.annualizedReturn, 0) * 100}
                  suffix="%"
                  valueStyle={{ color: '#a855f7', fontSize: 16, fontWeight: 700 }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title={<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Sharpe</span>}
                  value={safeNum(stats?.sharpeRatio, 0)}
                  precision={2}
                  valueStyle={{
                    color: safeNum(stats?.sharpeRatio, 0) > 1 ? '#10b981' : safeNum(stats?.sharpeRatio, 0) > 0 ? '#f59e0b' : '#ef4444',
                    fontSize: 16, fontWeight: 700,
                  }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title={<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Sortino</span>}
                  value={safeNum(stats?.sortinoRatio, 0)}
                  precision={2}
                  valueStyle={{ color: '#ec4899', fontSize: 16, fontWeight: 700 }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title={<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>最大回撤</span>}
                  value={safeNum(stats?.maxDrawdown, 0) * 100}
                  suffix="%"
                  valueStyle={{
                    color: safeNum(stats?.maxDrawdown, 0) > 0.3 ? '#ef4444' : '#f59e0b',
                    fontSize: 16, fontWeight: 700,
                  }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title={<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>胜率</span>}
                  value={safeNum(stats?.winRate, 0) * 100}
                  suffix="%"
                  valueStyle={{ color: '#fbbf24', fontSize: 16, fontWeight: 700 }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title={<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Calmar</span>}
                  value={safeNum(stats?.calmarRatio, 0)}
                  precision={2}
                  valueStyle={{ color: '#8b5cf6', fontSize: 16, fontWeight: 700 }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title={<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>年化波动</span>}
                  value={safeNum(stats?.annualVolatility, 0) * 100}
                  suffix="%"
                  valueStyle={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: 700 }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    );
  };

  // 人性偏差 & 归因面板
  const HumanPanel = () => {
    const rat = engineResult?.pipeline?.rationality;
    const attr = engineResult?.pipeline?.attribution;
    if (!rat) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待校验计算" />;

    return (
      <Row gutter={20}>
        <Col xs={24} md={12}>
          <Card
            className="glass-card"
            size="small"
            title={
              <Space>
                <BulbOutlined style={{ color: '#a855f7' }} />
                <Text strong style={{ color: 'rgba(255,255,255,0.85)' }}>Step 7 · 人性偏差校验</Text>
              </Space>
            }
          >
            <Row align="middle" gutter={16}>
              <Col span={10} style={{ textAlign: 'center' }}>
                <Progress
                  type="circle"
                  percent={safeNum(rat.rationalityScore, 0)}
                  width={110}
                  strokeColor={{ '0%': '#ef4444', '50%': '#fbbf24', '100%': '#10b981' }}
                  trailColor="rgba(255,255,255,0.06)"
                />
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: -8 }}>理性评分</div>
              </Col>
              <Col span={14}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>偏差惩罚系数: </Text>
                <Text strong style={{ color: '#ec4899' }}>{(safeNum(rat.biasPenalty, 0) * 100).toFixed(1)}%</Text>
                <Divider style={{ margin: '8px 0', borderColor: 'rgba(168,85,247,0.15)' }} />
                {rat.biases?.length > 0 ? (
                  <List
                    size="small"
                    header={<Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>识别的偏差</Text>}
                    dataSource={rat.biases}
                    renderItem={b => (
                      <List.Item style={{ border: 'none', padding: '4px 0' }}>
                        <Tag color={b.severity > 0.5 ? 'red' : 'orange'} style={{ fontSize: 10 }}>{b.label}</Tag>
                        <Progress
                          percent={b.severity * 100}
                          size="small"
                          showInfo={false}
                          strokeColor={b.severity > 0.5 ? '#ef4444' : '#f59e0b'}
                          style={{ flex: 1, marginLeft: 8 }}
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Tag color="green" style={{ fontSize: 11 }}>未检测到显著偏差</Tag>
                )}
              </Col>
            </Row>
            {rat.recommendations?.length > 0 && (
              <>
                <Divider style={{ margin: '12px 0', borderColor: 'rgba(168,85,247,0.15)' }} />
                <List
                  size="small"
                  header={<Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>建议</Text>}
                  dataSource={rat.recommendations}
                  renderItem={item => (
                    <List.Item style={{ border: 'none', padding: '4px 0', color: 'rgba(168,85,247,0.9)', fontSize: 11 }}>
                      {item}
                    </List.Item>
                  )}
                />
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            className="glass-card"
            size="small"
            title={
              <Space>
                <DatabaseOutlined style={{ color: '#a855f7' }} />
                <Text strong style={{ color: 'rgba(255,255,255,0.85)' }}>Step 10 · 绩效归因</Text>
              </Space>
            }
          >
            <Row gutter={8}>
              <Col xs={12}>
                <Card size="small" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8 }}>
                  <Statistic
                    title={<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Alpha</span>}
                    value={safeNum(attr?.benchmark?.alpha, 0) * 100}
                    suffix="%"
                    prefix={safeNum(attr?.benchmark?.alpha, 0) > 0 ? '+' : ''}
                    valueStyle={{
                      color: safeNum(attr?.benchmark?.alpha, 0) > 0 ? '#10b981' : '#ef4444',
                      fontSize: 18, fontWeight: 700,
                    }}
                  />
                </Card>
              </Col>
              <Col xs={12}>
                <Card size="small" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 8 }}>
                  <Statistic
                    title={<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>信息比率 IR</span>}
                    value={safeNum(attr?.riskAdjusted?.informationRatio, 0)}
                    precision={2}
                    valueStyle={{ color: '#a855f7', fontSize: 18, fontWeight: 700 }}
                  />
                </Card>
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0', borderColor: 'rgba(168,85,247,0.15)' }} />
            <Text strong style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>收益归因拆解</Text>
            <div style={{ marginTop: 8 }}>
              <List
                size="small"
                dataSource={[
                  { label: '选股效应', v: safeNum(attr?.attribution?.selectionEffect, 0), c: '#10b981' },
                  { label: '配置效应', v: safeNum(attr?.attribution?.allocationEffect, 0), c: '#a855f7' },
                  { label: '交互效应', v: safeNum(attr?.attribution?.interactionEffect, 0), c: '#fbbf24' },
                ]}
                renderItem={item => (
                  <List.Item style={{ border: 'none', padding: '6px 0' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, width: 80 }}>{item.label}</Text>
                    <Progress
                      percent={Math.abs(item.v) * 1000}
                      size="small"
                      showInfo={false}
                      strokeColor={item.c}
                      trailColor="rgba(255,255,255,0.06)"
                      style={{ flex: 1 }}
                    />
                    <Text style={{ color: item.c, fontSize: 11, width: 60, textAlign: 'right' }}>
                      {item.v > 0 ? '+' : ''}{(item.v * 100).toFixed(2)}%
                    </Text>
                  </List.Item>
                )}
              />
            </div>
          </Card>
        </Col>
      </Row>
    );
  };

  // 宏观海选结果面板
  const MacroFunnelPanel = () => {
    const macro = engineResult?.pipeline?.macroFunnel;
    if (!macro) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待海选计算" />;

    const columns = [
      { title: '代码', dataIndex: 'ticker', key: 'ticker', render: t => <Text strong style={{ color: '#a855f7' }}>{t}</Text> },
      { title: '名称', dataIndex: 'name', key: 'name', render: n => <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{n}</Text> },
      { title: '行业', dataIndex: 'industry', key: 'industry', render: i => <Tag color="default" style={{ fontSize: 10 }}>{i}</Tag> },
      {
        title: '筛选分', dataIndex: 'screeningScore', key: 'score',
        sorter: (a, b) => a.screeningScore - b.screeningScore,
        render: v => (
          <Space>
            <Progress percent={v} size="small" showInfo={false} style={{ width: 70 }} strokeColor="#a855f7" />
            <Text strong style={{ color: '#a855f7', fontSize: 12 }}>{v}</Text>
          </Space>
        ),
      },
      {
        title: '评级', dataIndex: 'grade', key: 'grade',
        render: g => <Tag color={g === 'S' ? 'gold' : g === 'A' ? 'purple' : 'default'} style={{ fontSize: 10 }}>{g}</Tag>,
      },
      {
        title: '入选理由', dataIndex: 'selectionReasons', key: 'reasons',
        render: arr => (
          <Space wrap>
            {arr.slice(0, 3).map(r => <Tag key={r} color="blue" style={{ fontSize: 10 }}>{r}</Tag>)}
          </Space>
        ),
      },
    ];

    return (
      <Row gutter={20}>
        <Col xs={24} md={7}>
          <Card className="glass-card" size="small" title={
            <Space><LineChartOutlined style={{ color: '#a855f7' }} /><Text strong style={{ color: 'rgba(255,255,255,0.85)' }}>宏观指标</Text></Space>
          }>
            <Descriptions
              size="small"
              column={1}
              labelStyle={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}
              contentStyle={{ color: 'rgba(255,255,255,0.9)', fontSize: 12 }}
            >
              <Descriptions.Item label="GDP 增速">{(safeNum(macro.macroIndicators?.gdpGrowth, 0) * 100).toFixed(1)}%</Descriptions.Item>
              <Descriptions.Item label="CPI">{(safeNum(macro.macroIndicators?.cpi, 0) * 100).toFixed(1)}%</Descriptions.Item>
              <Descriptions.Item label="无风险利率">{(safeNum(macro.macroIndicators?.riskFreeRate, 0) * 100).toFixed(2)}%</Descriptions.Item>
              <Descriptions.Item label="M2 增速">{(safeNum(macro.macroIndicators?.m2Growth, 0) * 100).toFixed(1)}%</Descriptions.Item>
              <Descriptions.Item label="VIX">
                <Tag color={safeNum(macro.macroIndicators?.vix, 20) > 25 ? 'red' : safeNum(macro.macroIndicators?.vix, 20) > 18 ? 'orange' : 'green'} style={{ fontSize: 10 }}>
                  {safeNum(macro.macroIndicators?.vix, 20)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="市场情绪">
                <Progress percent={safeNum(macro.macroIndicators?.marketSentiment, 50)} size="small" strokeColor="#a855f7" />
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} md={17}>
          <Card className="glass-card" size="small" title={
            <Space>
              <RiseOutlined style={{ color: '#a855f7' }} />
              <Text strong style={{ color: 'rgba(255,255,255,0.85)' }}>
                Step 0 · 宏观海选 ({macro.totalPassed}/{macro.totalScreened})
              </Text>
              <Tag color="purple" style={{ fontSize: 10 }}>{REGIMES[engineResult.regime]?.label}</Tag>
            </Space>
          }>
            <Table
              size="small"
              columns={columns}
              dataSource={macro.assets}
              rowKey="ticker"
              pagination={{ pageSize: 5, size: 'small' }}
              style={{ fontSize: 11 }}
            />
          </Card>
        </Col>
      </Row>
    );
  };

  // 历史记录 & 审计
  const HistoryPanel = () => (
    <Card
      className="glass-card"
      size="small"
      title={
        <Space>
          <HistoryOutlined style={{ color: '#a855f7' }} />
          <Text strong style={{ color: 'rgba(255,255,255,0.85)' }}>运行历史 / 审计日志</Text>
        </Space>
      }
      extra={runHistory.length > 0 && (
        <Button
          size="small"
          icon={<DownloadOutlined />}
          onClick={exportHistory}
          style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.35)', color: '#a855f7' }}
        >
          导出 CSV
        </Button>
      )}
    >
      {runHistory.length > 0 ? (
        <Table
          size="small"
          columns={[
            {
              title: '时间', dataIndex: 'runAt', key: 't',
              render: t => <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>
                {new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
              </Text>,
            },
            { title: '标的', dataIndex: 'ticker', key: 'ticker', render: t => <Text strong style={{ color: '#a855f7' }}>{t}</Text> },
            { title: '环境', dataIndex: 'regime', key: 'regime', render: r => <Tag color={REGIMES[r]?.color || '#f59e0b'} style={{ fontSize: 10 }}>{REGIMES[r]?.label || r}</Tag> },
            { title: '建议', dataIndex: 'recommendation', key: 'rec', render: r => <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{r}</Text> },
            {
              title: '仓位', dataIndex: 'position', key: 'pos',
              render: p => <Text strong style={{ color: p > 0.5 ? '#10b981' : p > 0.1 ? '#f59e0b' : '#ef4444' }}>{(p * 100).toFixed(0)}%</Text>,
            },
            {
              title: '上涨空间', dataIndex: 'upside', key: 'up',
              render: v => <Text style={{ color: v > 0 ? '#10b981' : '#ef4444', fontSize: 11 }}>
                {v > 0 ? '+' : ''}{(v * 100).toFixed(1)}%
              </Text>,
            },
          ]}
          dataSource={[...runHistory].reverse()}
          rowKey="runId"
          pagination={{ pageSize: 6, size: 'small' }}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无运行记录" />
      )}
    </Card>
  );

  // ============================================================
  // 主渲染
  // ============================================================
  return (
    <div className="stock-page">
      {/* 头部 */}
      <div className="page-header">
        <Space align="center">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard')}
            style={{ color: 'rgba(255,255,255,0.6)' }}
          />
          <Space direction="vertical" size={0}>
            <span className="page-title">股价模拟器</span>
            <span className="page-subtitle">Y.Mine Quant Engine · 十一步闭环 + 风险向量精算</span>
          </Space>
        </Space>
        <Space>
          <Tag icon={<WalletOutlined />} color="purple">
            标的: {selectedTicker}
          </Tag>
          <Tag icon={<LineChartOutlined />} color={REGIMES[regime]?.color}>
            {REGIMES[regime]?.label}
          </Tag>
          <Button
            type="text"
            icon={<HomeOutlined />}
            onClick={() => navigate('/dashboard')}
            style={{ color: 'rgba(255,255,255,0.5)' }}
          />
        </Space>
      </div>

      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        {/* Hero + 进度 */}
        <HeroCard />
        <StepProgressPanel />

        {/* 主体：左侧参数 + 中间Tab + 右侧仓位 */}
        <Row gutter={20}>
          <Col xs={24} lg={6}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <ControlPanel />
              <PositionPanel />
            </Space>
          </Col>

          <Col xs={24} lg={18}>
            <Card
              className="glass-card stock-tabs-card"
              styles={{ body: { padding: 0 } }}
            >
              <Tabs
                activeKey={tabKey}
                onChange={setTabKey}
                tabBarStyle={{
                  padding: '0 20px',
                  borderBottom: '1px solid rgba(168,85,247,0.15)',
                  margin: 0,
                }}
                items={[
                  {
                    key: 'simulation',
                    label: <Space><LineChartOutlined />股价模拟</Space>,
                    children: (
                      <div className="stock-tab-pane">
                        <div ref={chartRef} style={{ width: '100%', height: 400 }} />
                      </div>
                    ),
                  },
                  {
                    key: 'valuation',
                    label: <Space><CalculatorOutlined />估值模型</Space>,
                    children: <div className="stock-tab-pane"><ValuationPanel /></div>,
                  },
                  {
                    key: 'risk',
                    label: <Space><ThunderboltOutlined />风险向量精算</Space>,
                    children: <div className="stock-tab-pane"><RiskVectorPanel /></div>,
                  },
                  {
                    key: 'macro',
                    label: <Space><RiseOutlined />宏观海选</Space>,
                    children: <div className="stock-tab-pane"><MacroFunnelPanel /></div>,
                  },
                  {
                    key: 'human',
                    label: <Space><BulbOutlined />人性 & 归因</Space>,
                    children: <div className="stock-tab-pane"><HumanPanel /></div>,
                  },
                  {
                    key: 'history',
                    label: <Space><HistoryOutlined />运行历史</Space>,
                    children: <div className="stock-tab-pane"><HistoryPanel /></div>,
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  );
};

export default StockPage;
