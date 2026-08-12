import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Tabs,
  Empty,
  Input,
  Select,
  Avatar,
  Divider,
  List,
  Modal,
  Radio,
  Badge,
  Tooltip,
} from 'antd';
import {
  ThunderboltOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  ExperimentOutlined,
  ShopOutlined,
  VideoCameraOutlined,
  CopyOutlined,
  BugOutlined,
  ClearOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import contentHubEngine, { MEDIUM_TYPES, MEDIUM_LABELS, MEDIUM_ICONS } from '../utils/contentHubEngine';
import { ALL_PROFILES, getProfileById, INVESTOR_PROFILES, ENTREPRENEUR_PROFILES } from '../utils/benchmarkProfiles';
import { logger } from '../utils/logger';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

const ContentHubPage = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [generatedUnits, setGeneratedUnits] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const selectedProfile = useMemo(() => {
    if (!selectedPerson) return null;
    return ALL_PROFILES.find(p => p.id === selectedPerson) || null;
  }, [selectedPerson]);
  const [selectedMedium, setSelectedMedium] = useState(MEDIUM_TYPES.VIDEO);
  const [searchText, setSearchText] = useState('');
  const [filterMedium, setFilterMedium] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [detailUnit, setDetailUnit] = useState(null);
  const [generating, setGenerating] = useState(false);

  // ============= 调试日志 =============
  const [debugLogs, setDebugLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [debugFilter, setDebugFilter] = useState('all');
  const logContainerRef = useRef(null);
  const logIdCounter = useRef(0);
  const pendingLogs = useRef([]);
  const flushTimer = useRef(null);

  useEffect(() => {
    const unsubscribe = logger.subscribe((log) => {
      logIdCounter.current += 1;
      pendingLogs.current.push({
        id: logIdCounter.current,
        ...log,
      });

      if (!flushTimer.current) {
        flushTimer.current = setTimeout(() => {
          if (pendingLogs.current.length > 0) {
            setDebugLogs(prev => {
              const merged = [...prev, ...pendingLogs.current];
              return merged.slice(-500);
            });
            pendingLogs.current = [];
          }
          flushTimer.current = null;
        }, 200);
      }
    });

    return () => {
      unsubscribe();
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      if (pendingLogs.current.length > 0) {
        setDebugLogs(prev => [...prev, ...pendingLogs.current].slice(-500));
        pendingLogs.current = [];
      }
    };
  }, []);

  // 自动滚动
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [debugLogs, autoScroll]);

  const filteredDebugLogs = useMemo(() => {
    if (debugFilter === 'all') return debugLogs;
    return debugLogs.filter(log => log.type === debugFilter);
  }, [debugLogs, debugFilter]);

  const handleDebugGenerateVideo = () => {
    setDebugLogs([]);
    logIdCounter.current = 0;
    logger.session('[调试面板] 开始执行 generateByMedium("video")');
    setTimeout(() => {
      const units = contentHubEngine.generateByMedium(MEDIUM_TYPES.VIDEO);
      setGeneratedUnits(prev => [...units, ...prev]);
      logger.session('[调试面板] 执行完成', { 生成数量: units.length });
    }, 300);
  };

  const handleDebugGenerateAll = () => {
    setDebugLogs([]);
    logIdCounter.current = 0;
    logger.session('[调试面板] 开始执行 generateAll()');
    setTimeout(() => {
      const units = contentHubEngine.generateAll();
      setGeneratedUnits(units);
      logger.session('[调试面板] 执行完成', { 生成数量: units.length });
    }, 300);
  };

  const handleClearLogs = () => {
    setDebugLogs([]);
    logIdCounter.current = 0;
  };

  const handleDownloadLogs = () => {
    const content = debugLogs.map(l =>
      `[${l.timestamp}] ${l.tag} ${l.message}`
    ).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============= 生成操作 =============

  const handleGenerateSingle = () => {
    if (!selectedPerson) return;
    setGenerating(true);
    logger.session('[内容中枢] 生成单个内容', { 人物: selectedPerson, 介质: selectedMedium });

    setTimeout(() => {
      const unit = contentHubEngine.generate(selectedPerson, selectedMedium);
      if (unit) {
        setGeneratedUnits(prev => [unit, ...prev]);
      }
      setGenerating(false);
    }, 500);
  };

  const handleGenerateAll = () => {
    setGenerating(true);
    logger.session('[内容中枢] 批量生成所有内容');

    setTimeout(() => {
      const units = contentHubEngine.generateAll();
      setGeneratedUnits(units);
      setGenerating(false);
    }, 800);
  };

  const handleGenerateByPerson = (personId) => {
    setGenerating(true);
    logger.session('[内容中枢] 按人物生成', personId);

    setTimeout(() => {
      const units = contentHubEngine.generateByPerson(personId);
      setGeneratedUnits(prev => [...units, ...prev]);
      setGenerating(false);
    }, 500);
  };

  const handleGenerateByMedium = (medium) => {
    setGenerating(true);
    logger.session('[内容中枢] 按介质生成', medium);

    setTimeout(() => {
      const units = contentHubEngine.generateByMedium(medium);
      setGeneratedUnits(prev => [...units, ...prev]);
      setGenerating(false);
    }, 500);
  };

  const handleReset = () => {
    setGeneratedUnits([]);
    setSelectedPerson(null);
    setSelectedMedium(MEDIUM_TYPES.VIDEO);
    setSearchText('');
    setFilterMedium('all');
    setFilterType('all');
    logger.session('[内容中枢] 重置');
  };

  // ============= 筛选逻辑 =============

  const filteredUnits = useMemo(() => {
    let result = [...generatedUnits];

    if (filterMedium !== 'all') {
      result = result.filter(u => u.medium === filterMedium);
    }

    if (filterType !== 'all') {
      result = result.filter(u => u.personType === filterType);
    }

    if (searchText.trim()) {
      const keyword = searchText.toLowerCase();
      result = result.filter(u =>
        u.title.toLowerCase().includes(keyword) ||
        u.body.toLowerCase().includes(keyword) ||
        u.personName.toLowerCase().includes(keyword) ||
        u.tags.some(t => t.toLowerCase().includes(keyword))
      );
    }

    return result;
  }, [generatedUnits, filterMedium, filterType, searchText]);

  // ============= 人物卡片 =============

  const renderPersonCard = (profile) => {
    const isSelected = selectedPerson === profile.id;
    const typeColor = profile.type === 'investor' ? '#1890ff' : '#eb2f96';
    const typeLabel = profile.type === 'investor' ? '投资人' : '创业家';

    return (
      <Col xs={12} sm={8} md={6} lg={4} key={profile.id}>
        <div
          onClick={() => setSelectedPerson(profile.id)}
          style={{
            padding: 12,
            borderRadius: 10,
            background: isSelected
              ? 'rgba(139,92,246,0.25)'
              : 'rgba(0,0,0,0.2)',
            border: isSelected
              ? '1px solid rgba(167,139,250,0.8)'
              : '1px solid rgba(139,92,246,0.15)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textAlign: 'center',
            height: '100%',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 4 }}>{profile.emoji}</div>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 600, display: 'block' }}>
            {profile.name}
          </Text>
          <Space style={{ marginTop: 4, justifyContent: 'center' }}>
            <Tag color={typeColor} style={{ margin: 0, fontSize: 10 }}>
              {typeLabel}
            </Tag>
            <Tag color="#8b5cf6" style={{ margin: 0, fontSize: 10 }}>
              {profile.mbti}
            </Tag>
          </Space>
        </div>
      </Col>
    );
  };

  // ============= 内容单元卡片 =============

  const renderUnitCard = (unit) => {
    const mediumColors = {
      video: '#1890ff',
      drama: '#eb2f96',
      cocktail: '#52c41a',
      ecommerce: '#faad14'
    };

    return (
      <Col xs={24} sm={12} md={8} lg={6} key={unit.id}>
        <Card
          size="small"
          style={{
            background: 'rgba(30,19,64,0.8)',
            border: '1px solid rgba(139,92,246,0.2)',
            height: '100%',
            cursor: 'pointer'
          }}
          onClick={() => setDetailUnit(unit)}
          styles={{ body: { padding: 12 } }}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Avatar size="small" style={{ backgroundColor: mediumColors[unit.medium] }}>
                {unit.mediumIcon}
              </Avatar>
              <Tag color={mediumColors[unit.medium]} style={{ margin: 0, fontSize: 10 }}>
                {unit.mediumLabel}
              </Tag>
            </Space>

            <Text
              style={{
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {unit.title}
            </Text>

            <Space>
              <Text style={{ fontSize: 12 }}>{unit.personEmoji}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {unit.personName}
              </Text>
            </Space>

            <Text
              type="secondary"
              style={{
                fontSize: 11,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {unit.body}
            </Text>
          </Space>
        </Card>
      </Col>
    );
  };

  // ============= Tab 内容 =============

  const renderGenerateTab = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 人物选择区 */}
      <Card
        title={<span style={{ color: '#fff' }}><ExperimentOutlined /> 选择基准人物</span>}
        style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 类型切换 */}
          <Radio.Group
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value="all">全部 (20)</Radio.Button>
            <Radio.Button value="investor">投资人 (10)</Radio.Button>
            <Radio.Button value="entrepreneur">创业家 (10)</Radio.Button>
          </Radio.Group>

          {/* 人物网格 */}
          <Row gutter={[8, 8]}>
            {(filterType === 'all' ? ALL_PROFILES :
              filterType === 'investor' ? INVESTOR_PROFILES : ENTREPRENEUR_PROFILES
            ).map(renderPersonCard)}
          </Row>

          {selectedPerson && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
              }}
            >
              <Space>
                <Text style={{ color: '#10b981', fontSize: 12 }}>✓ 已选择：</Text>
                <Text style={{ color: '#fff', fontWeight: 600 }}>
                  {selectedProfile?.emoji} {selectedProfile?.name}
                </Text>
              </Space>
            </div>
          )}
        </Space>
      </Card>

      {/* 介质选择 & 生成 */}
      <Card
        title={<span style={{ color: '#fff' }}><VideoCameraOutlined /> 选择分发介质</span>}
        style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={[12, 12]}>
            {Object.values(MEDIUM_TYPES).map(m => {
              const isSelected = selectedMedium === m;
              return (
                <Col xs={12} md={6} key={m}>
                  <div
                    onClick={() => setSelectedMedium(m)}
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
                      textAlign: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 6 }}>{MEDIUM_ICONS[m]}</div>
                    <Text style={{ color: '#fff', fontWeight: 600 }}>{MEDIUM_LABELS[m]}</Text>
                  </div>
                </Col>
              );
            })}
          </Row>

          <Divider style={{ margin: '12px 0', borderColor: 'rgba(139,92,246,0.1)' }} />

          <Space wrap>
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              loading={generating}
              onClick={handleGenerateSingle}
              disabled={!selectedPerson}
            >
              生成：{selectedProfile?.name || '请选择人物'} × {MEDIUM_LABELS[selectedMedium]}
            </Button>
            <Button
              icon={<PlayCircleOutlined />}
              size="large"
              loading={generating}
              onClick={() => handleGenerateByMedium(selectedMedium)}
            >
              生成该介质全部 (20人)
            </Button>
            {selectedPerson && (
              <Button
                icon={<ExperimentOutlined />}
                size="large"
                loading={generating}
                onClick={() => handleGenerateByPerson(selectedPerson)}
              >
                生成该人物全部 (4介质)
              </Button>
            )}
            <Button
              type="primary"
              danger
              size="large"
              icon={<ThunderboltOutlined />}
              loading={generating}
              onClick={handleGenerateAll}
            >
              一键生成全部 (20人 × 4介质 = 80个)
            </Button>
            <Button icon={<ReloadOutlined />} size="large" onClick={handleReset}>
              重置
            </Button>
          </Space>
        </Space>
      </Card>
    </Space>
  );

  const renderLibraryTab = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 筛选区 */}
      <Card
        style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Space wrap style={{ width: '100%' }}>
          <Search
            placeholder="搜索标题、内容、标签..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            value={filterMedium}
            onChange={setFilterMedium}
            style={{ width: 140 }}
          >
            <Option value="all">全部介质</Option>
            {Object.values(MEDIUM_TYPES).map(m => (
              <Option key={m} value={m}>{MEDIUM_ICONS[m]} {MEDIUM_LABELS[m]}</Option>
            ))}
          </Select>
          <Select
            value={filterType}
            onChange={setFilterType}
            style={{ width: 140 }}
          >
            <Option value="all">全部人物</Option>
            <Option value="investor">投资人</Option>
            <Option value="entrepreneur">创业家</Option>
          </Select>
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {generatedUnits.length} 个内容单元 · 筛选后 {filteredUnits.length} 个
          </Text>
        </Space>
      </Card>

      {/* 内容网格 */}
      {filteredUnits.length === 0 ? (
        <Card style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <Empty
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary">
                  {generatedUnits.length === 0
                    ? '还没有生成内容，去「内容生成」标签页开始吧'
                    : '没有符合筛选条件的内容'
                  }
                </Text>
              </Space>
            }
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredUnits.map(renderUnitCard)}
        </Row>
      )}
    </Space>
  );

  // ============= 调试 Tab =============

  const logTypeColors = {
    route: '#22c55e',
    game: '#3b82f6',
    storage: '#f59e0b',
    session: '#a78bfa',
    ui: '#ec4899',
    error: '#ef4444',
    info: '#94a3b8',
  };

  const renderDebugTab = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 操作按钮区 */}
      <Card
        title={<span style={{ color: '#fff' }}><BugOutlined /> 调试控制台</span>}
        style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={handleDebugGenerateVideo}
            >
              🎬 执行 generateByMedium('video') - 生成 20人短视频
            </Button>
            <Button
              size="large"
              icon={<ThunderboltOutlined />}
              onClick={handleDebugGenerateAll}
            >
              ⚡ 执行 generateAll() - 生成全部 80 个
            </Button>
            <Button
              icon={<ClearOutlined />}
              size="large"
              onClick={handleClearLogs}
            >
              清空日志
            </Button>
            <Button
              icon={<DownloadOutlined />}
              size="large"
              onClick={handleDownloadLogs}
              disabled={debugLogs.length === 0}
            >
              下载日志
            </Button>
          </Space>

          <Space wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>
              日志类型过滤：
            </Text>
            <Radio.Group
              size="small"
              value={debugFilter}
              onChange={(e) => setDebugFilter(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="all">全部 ({debugLogs.length})</Radio.Button>
              <Radio.Button value="session">SESSION</Radio.Button>
              <Radio.Button value="info">INFO</Radio.Button>
              <Radio.Button value="error">ERROR</Radio.Button>
            </Radio.Group>
            <Tooltip title={autoScroll ? '已开启自动滚动' : '已关闭自动滚动'}>
              <Button
                size="small"
                type={autoScroll ? 'primary' : 'default'}
                onClick={() => setAutoScroll(!autoScroll)}
              >
                {autoScroll ? '📜 自动滚动' : '📜 手动滚动'}
              </Button>
            </Tooltip>
          </Space>
        </Space>
      </Card>

      {/* 实时日志面板 */}
      <Card
        title={
          <Space>
            <span style={{ color: '#fff' }}>实时日志</span>
            <Badge
              count={filteredDebugLogs.length}
              style={{ backgroundColor: '#8b5cf6' }}
            />
          </Space>
        }
        style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}
        styles={{ body: { padding: 0 } }}
      >
        <div
          ref={logContainerRef}
          style={{
            height: 500,
            overflowY: 'auto',
            background: '#0f0a28',
            padding: 12,
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 12,
            lineHeight: '20px',
          }}
        >
          {filteredDebugLogs.length === 0 ? (
            <div style={{
              color: '#475569',
              textAlign: 'center',
              padding: '80px 0',
              fontSize: 13,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🕵️</div>
              暂无日志，点击上方按钮开始执行
            </div>
          ) : (
            filteredDebugLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  marginBottom: 4,
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: log.level === 'error'
                    ? 'rgba(239,68,68,0.1)'
                    : 'transparent',
                  borderLeft: `3px solid ${logTypeColors[log.type] || '#94a3b8'}`,
                }}
              >
                <span style={{ color: '#64748b', fontSize: 11 }}>
                  {log.timestamp.split(' ')[1]}
                </span>
                <span
                  style={{
                    color: logTypeColors[log.type] || '#94a3b8',
                    fontWeight: 'bold',
                    marginLeft: 8,
                    marginRight: 8,
                  }}
                >
                  {log.tag}
                </span>
                <span style={{ color: log.level === 'error' ? '#fca5a5' : '#e2e8f0' }}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </Space>
  );

  // ============= 主渲染 =============

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 标题区 */}
        <Card style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <div>
                <Title level={3} style={{ margin: 0, color: '#a78bfa' }}>
                  <ThunderboltOutlined /> 基准库 · 多介质内容中枢
                </Title>
                <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                  20位基准人物 × 4种介质 = 80个内容单元 · 一次建模，多端分发
                </Paragraph>
              </div>
            </Space>
            <Space>
              <Tag color="#8b5cf6">投资人 10人</Tag>
              <Tag color="#eb2f96">创业家 10人</Tag>
              <Tag color="#10b981">短视频</Tag>
              <Tag color="#f59e0b">短剧</Tag>
              <Tag color="#1890ff">调酒</Tag>
              <Tag color="#ef4444">电商</Tag>
            </Space>
          </Space>
        </Card>

        {/* Tab 切换 */}
        <Card
          style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)', padding: 0 }}
          styles={{ body: { padding: 0 } }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            centered
            items={[
              {
                key: 'generate',
                label: (
                  <span>
                    <ThunderboltOutlined /> 内容生成
                    {generatedUnits.length > 0 && (
                      <Tag color="#8b5cf6" style={{ marginLeft: 6, fontSize: 10 }}>
                        {generatedUnits.length}
                      </Tag>
                    )}
                  </span>
                ),
              },
              {
                key: 'library',
                label: (
                  <span>
                    <ShopOutlined /> 内容库
                    {filteredUnits.length > 0 && (
                      <Tag color="#10b981" style={{ marginLeft: 6, fontSize: 10 }}>
                        {filteredUnits.length}
                      </Tag>
                    )}
                  </span>
                ),
              },
              {
                key: 'debug',
                label: (
                  <span>
                    <BugOutlined /> 调试面板
                    {debugLogs.length > 0 && (
                      <Tag color="#f59e0b" style={{ marginLeft: 6, fontSize: 10 }}>
                        {debugLogs.length}
                      </Tag>
                    )}
                  </span>
                ),
              },
            ]}
            style={{ padding: '0 24px' }}
          />
          <div style={{ padding: '0 24px 24px' }}>
            {activeTab === 'generate' && renderGenerateTab()}
            {activeTab === 'library' && renderLibraryTab()}
            {activeTab === 'debug' && renderDebugTab()}
          </div>
        </Card>
      </Space>

      {/* 详情 Modal */}
      <Modal
        title={
          <Space>
            <Text style={{ color: '#fff' }}>{detailUnit?.mediumIcon}</Text>
            <Text style={{ color: '#fff' }}>{detailUnit?.title}</Text>
            <Tag color="#8b5cf6">{detailUnit?.mediumLabel}</Tag>
          </Space>
        }
        open={!!detailUnit}
        onCancel={() => setDetailUnit(null)}
        footer={[
          <Button key="close" onClick={() => setDetailUnit(null)}>
            关闭
          </Button>,
          <Button
            key="copy"
            icon={<CopyOutlined />}
            type="primary"
            onClick={() => {
              if (detailUnit) {
                navigator.clipboard?.writeText(`${detailUnit.title}\n\n${detailUnit.body}`);
                logger.session('[内容中枢] 复制内容', detailUnit.title);
              }
            }}
          >
            复制内容
          </Button>
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
        {detailUnit && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 人物信息 */}
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              <Space>
                <Avatar style={{ backgroundColor: '#8b5cf6', fontSize: 20 }}>
                  {detailUnit.personEmoji}
                </Avatar>
                <Space direction="vertical" size={2}>
                  <Text style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
                    {detailUnit.personName}
                  </Text>
                  <Space size={8}>
                    <Tag color={detailUnit.personType === 'investor' ? 'blue' : 'pink'}>
                      {detailUnit.personType === 'investor' ? '投资人' : '创业家'}
                    </Tag>
                    {detailUnit.tags.slice(0, 4).map(tag => (
                      <Tag key={tag} color="purple" style={{ fontSize: 11 }}>{tag}</Tag>
                    ))}
                  </Space>
                </Space>
              </Space>
            </div>

            {/* 正文 */}
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(139,92,246,0.1)',
                whiteSpace: 'pre-wrap',
                color: 'rgba(255,255,255,0.9)',
                lineHeight: 1.8,
                fontSize: 14,
              }}
            >
              {detailUnit.body}
            </div>

            <Text type="secondary" style={{ fontSize: 11 }}>
              生成时间：{new Date(detailUnit.generatedAt).toLocaleString('zh-CN')}
            </Text>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default ContentHubPage;
