import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Modal,
  Empty,
  Tooltip,
  Popconfirm,
  message,
  Divider,
  Slider,
  DatePicker,
  Row,
  Col,
} from 'antd';
import {
  ArrowLeftOutlined,
  SearchOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
  ClockCircleOutlined,
  BulbOutlined,
  CommentOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { coachLogsEngine } from '../utils/coachLogsEngine';
import { logger } from '../utils/logger';

const { Title, Text } = Typography;
const { Option } = Select;

// ============================================================
// 难度标签配置
// ============================================================
const DIFFICULTY_CONFIG = {
  easy: { color: 'green', label: '😊 简单' },
  medium: { color: 'blue', label: '🤔 中等' },
  hard: { color: 'red', label: '🔥 困难' },
};

const GAME_TYPE_CONFIG = {
  poker: { color: 'purple', icon: '🃏' },
  game_table: { color: 'cyan', icon: '♟️' },
  billiards: { color: 'gold', icon: '🎱' },
};

const MOOD_CONFIG = {
  calm: { label: '平静', emoji: '😌' },
  anxious: { label: '焦虑', emoji: '😰' },
  excited: { label: '兴奋', emoji: '🤩' },
  tired: { label: '疲惫', emoji: '😴' },
  focused: { label: '专注', emoji: '🎯' },
  frustrated: { label: '沮丧', emoji: '😤' },
};

// ============================================================
// 消息类型图标
// ============================================================
const MESSAGE_TYPE_CONFIG = {
  hand_review: { icon: '📊', label: '手牌复盘', color: '#a78bfa' },
  tip: { icon: '💡', label: '陪练建议', color: '#fbbf24' },
  chat: { icon: '💬', label: '对话', color: '#60a5fa' },
  summary: { icon: '📝', label: '总结', color: '#f472b6' },
  system: { icon: '🔔', label: '系统', color: '#94a3b8' },
};

// ============================================================
// 主页面
// ============================================================
const CoachLogsPage = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [stats, setStats] = useState({
    total_sessions: 0, total_hands: 0, avg_win_rate: 0,
    total_chips: 0, avg_session_duration: 0,
    by_game_type: {}, mood_distribution: {},
  });
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [gameTypeFilter, setGameTypeFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [dateRange, setDateRange] = useState(null);
  const [winRateRange, setWinRateRange] = useState([0, 100]);
  const [chipsRange, setChipsRange] = useState([-500, 500]);
  const [handsRange, setHandsRange] = useState([0, 200]);
  const [moodBefore, setMoodBefore] = useState([]);
  const [moodAfter, setMoodAfter] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('start_time');
  const [sortOrder, setSortOrder] = useState('desc');
  const [detailSession, setDetailSession] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 初始化加载
  useEffect(() => {
    const loadData = async () => {
      const done = logger.flow('陪练记录页面', 'mount 初始化加载');
      try {
        setLoading(true);
        const data = await coachLogsEngine.init();
        setSessions(data);
        done(`加载 ${data.length} 条记录, 模式: ${coachLogsEngine.isBackendAvailable ? 'API' : '本地'}`);
        logger.ui('陪练记录页面挂载完成', {
          sessions: data.length,
          backend: coachLogsEngine.isBackendAvailable,
        });
      } catch (e) {
        logger.error('陪练记录页面初始化异常', e.message, e);
        done('异常: ' + e.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 筛选和统计（依赖变化时重新计算）
  useEffect(() => {
    const applyFilters = async () => {
      const filters = {
        search: searchText,
        gameType: gameTypeFilter,
        difficulty: difficultyFilter,
        startTime: dateRange?.[0]?.valueOf(),
        endTime: dateRange?.[1]?.valueOf(),
        minWinRate: winRateRange[0],
        maxWinRate: winRateRange[1],
        minChips: chipsRange[0],
        maxChips: chipsRange[1],
        minHands: handsRange[0],
        maxHands: handsRange[1],
        moodBefore,
        moodAfter,
        tags: selectedTags,
        sortBy,
        sortOrder,
      };
      logger.session('筛选条件变化', filters);

      const [filtered, statsResult] = await Promise.all([
        coachLogsEngine.getSessions(filters),
        coachLogsEngine.getStats({
          gameType: gameTypeFilter,
          difficulty: difficultyFilter,
        }),
      ]);

      setFilteredSessions(filtered);
      setStats(statsResult);
      logger.ui(`筛选结果: ${filtered.length} 条`, {
        sessions: statsResult.total_sessions,
        hands: statsResult.total_hands,
        winRate: statsResult.avg_win_rate,
        chips: statsResult.total_chips,
        sort: `${sortBy}/${sortOrder}`,
      });
    };
    applyFilters();
  }, [sessions, searchText, gameTypeFilter, difficultyFilter, dateRange,
      winRateRange, chipsRange, handsRange, moodBefore, moodAfter,
      selectedTags, sortBy, sortOrder]);

  // 打开详情
  const handleOpenDetail = async (session) => {
    logger.session('点击会话卡片打开详情', {
      id: session.id,
      game_type: session.game_type,
      hands: session.total_hands,
    });

    // 如果是列表数据（不含完整消息），从后端取详情
    let fullSession = session;
    if (!session.messages || session.messages.length === 0) {
      const detail = await coachLogsEngine.getSession(session.id);
      if (detail) fullSession = detail;
    }

    setDetailSession(fullSession);
    setDetailOpen(true);
    logger.ui('详情弹窗已打开', { messages: fullSession.messages?.length || 0 });
  };

  // 删除
  const handleDelete = async (sessionId) => {
    const done = logger.flow('陪练记录页面', `handleDelete() 删除会话`, { sessionId });
    try {
      const updated = await coachLogsEngine.deleteSession(sessionId);
      setSessions(updated);
      done(`剩余 ${updated.length} 条记录`);
      message.success('已删除该条陪练记录');
    } catch (e) {
      logger.error('删除陪练记录异常', e.message, e);
      done('异常: ' + e.message);
    }
  };

  // 重置模拟数据
  const handleReset = async () => {
    const done = logger.flow('陪练记录页面', `handleReset() 重置模拟数据`);
    try {
      const data = await coachLogsEngine.resetMock();
      setSessions(data);
      done(`已重置为 ${data.length} 条记录`);
      message.success('已重置为模拟数据');
    } catch (e) {
      logger.error('重置模拟数据异常', e.message, e);
      done('异常: ' + e.message);
    }
  };

  return (
    <div className="coach-logs-page fade-in">
      {/* 顶部导航 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} type="text">
            返回
          </Button>
          <div>
            <Title level={3} style={{ margin: 0, color: '#fff' }}>
              🎯 陪练记录
            </Title>
            <Text type="secondary">
              你与 AI 陪练的每一次对话，都是认知的镜子
            </Text>
          </div>
        </div>
        <Tooltip title="重置为模拟数据">
          <Button icon={<ReloadOutlined />} onClick={handleReset} type="text">
            重置
          </Button>
        </Tooltip>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <Card className="stat-card" size="small">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(167, 139, 250, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              📋
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>总会话</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{stats.total_sessions}</div>
            </div>
          </div>
        </Card>

        <Card className="stat-card" size="small">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(96, 165, 250, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              🃏
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>总手数</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{stats.total_hands}</div>
            </div>
          </div>
        </Card>

        <Card className="stat-card" size="small">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(52, 211, 153, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              <TrophyOutlined style={{ color: '#34d399' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>平均胜率</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: stats.avg_win_rate >= 50 ? '#34d399' : '#f87171' }}>
                {stats.avg_win_rate}%
              </div>
            </div>
          </div>
        </Card>

        <Card className="stat-card" size="small">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: stats.total_chips >= 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {stats.total_chips >= 0
                ? <RiseOutlined style={{ color: '#34d399' }} />
                : <FallOutlined style={{ color: '#f87171' }} />}
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>筹码变化</div>
              <div style={{
                fontSize: 24, fontWeight: 700,
                color: stats.total_chips >= 0 ? '#34d399' : '#f87171',
              }}>
                {stats.total_chips >= 0 ? '+' : ''}{stats.total_chips}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 高级筛选栏 */}
      <Card className="filter-card" size="small" style={{ marginBottom: 20 }}>
        <Space wrap style={{ width: '100%' }} size={12}>
          <Input
            placeholder="搜索陪练点评、标签..."
            prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
          <Select
            value={gameTypeFilter}
            onChange={setGameTypeFilter}
            style={{ width: 140 }}
          >
            <Option value="all">🎮 全部游戏</Option>
            <Option value="poker">🃏 德州扑克</Option>
            <Option value="game_table">♟️ 模拟博弈台</Option>
            <Option value="billiards">🎱 台球</Option>
          </Select>
          <Select
            value={difficultyFilter}
            onChange={setDifficultyFilter}
            style={{ width: 140 }}
          >
            <Option value="all">🎯 全部难度</Option>
            <Option value="easy">😊 简单</Option>
            <Option value="medium">🤔 中等</Option>
            <Option value="hard">🔥 困难</Option>
          </Select>
          <Select
            mode="multiple"
            placeholder="🏷️ 标签筛选"
            value={selectedTags}
            onChange={setSelectedTags}
            style={{ minWidth: 180 }}
            allowClear
          >
            {['位置感', '翻牌前范围', '底池管理', '心态管理', '弃牌纪律', '赔率计算', '持续下注'].map(tag => (
              <Option key={tag} value={tag}>{tag}</Option>
            ))}
          </Select>
          <Select
            mode="multiple"
            placeholder="🤗 训练前情绪"
            value={moodBefore}
            onChange={setMoodBefore}
            style={{ minWidth: 150 }}
            allowClear
          >
            {Object.entries(MOOD_CONFIG).map(([key, val]) => (
              <Option key={key} value={key}>{val.emoji} {val.label}</Option>
            ))}
          </Select>
          <Select
            mode="multiple"
            placeholder="😌 训练后情绪"
            value={moodAfter}
            onChange={setMoodAfter}
            style={{ minWidth: 150 }}
            allowClear
          >
            {Object.entries(MOOD_CONFIG).map(([key, val]) => (
              <Option key={key} value={key}>{val.emoji} {val.label}</Option>
            ))}
          </Select>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder={['开始日期', '结束日期']}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 130 }}
          >
            <Option value="start_time">🕐 按时间</Option>
            <Option value="win_rate">📊 按胜率</Option>
            <Option value="chips_change">💰 按筹码</Option>
            <Option value="total_hands">🎴 按手数</Option>
          </Select>
          <Select
            value={sortOrder}
            onChange={setSortOrder}
            style={{ width: 100 }}
          >
            <Option value="desc">⬇️ 降序</Option>
            <Option value="asc">⬆️ 升序</Option>
          </Select>
          <Button
            onClick={() => {
              setSearchText(''); setGameTypeFilter('all'); setDifficultyFilter('all');
              setDateRange(null); setWinRateRange([0, 100]); setChipsRange([-500, 500]);
              setHandsRange([0, 200]); setMoodBefore([]); setMoodAfter([]);
              setSelectedTags([]); setSortBy('start_time'); setSortOrder('desc');
            }}
          >
            重置筛选
          </Button>
          <div style={{ flex: 1, textAlign: 'right', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
            共 {filteredSessions.length} 条记录
          </div>
        </Space>

        {/* 范围筛选滑块 */}
        <Divider style={{ margin: '12px 0', borderColor: 'rgba(255,255,255,0.08)' }} />
        <Row gutter={24} style={{ marginTop: 4 }}>
          <Col span={8}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              📊 胜率范围：{winRateRange[0]}% ~ {winRateRange[1]}%
            </div>
            <Slider
              range
              min={0}
              max={100}
              value={winRateRange}
              onChange={setWinRateRange}
              tooltip={{ formatter: v => `${v}%` }}
            />
          </Col>
          <Col span={8}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              💰 筹码变化：{chipsRange[0]} ~ {chipsRange[1]}
            </div>
            <Slider
              range
              min={-1000}
              max={1000}
              step={50}
              value={chipsRange}
              onChange={setChipsRange}
            />
          </Col>
          <Col span={8}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              🎴 总手数：{handsRange[0]} ~ {handsRange[1]}
            </div>
            <Slider
              range
              min={0}
              max={300}
              step={10}
              value={handsRange}
              onChange={setHandsRange}
            />
          </Col>
        </Row>
      </Card>

      {/* 会话列表 */}
      {filteredSessions.length === 0 ? (
        <Empty
          description={
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>
              {searchText || gameTypeFilter !== 'all' || difficultyFilter !== 'all'
                ? '没有匹配的陪练记录'
                : '还没有陪练记录，去玩一局德州扑克吧！'}
            </span>
          }
          style={{ marginTop: 60 }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredSessions.map((session) => {
            const diffCfg = DIFFICULTY_CONFIG[session.ai_difficulty] || DIFFICULTY_CONFIG.medium;
            const gameCfg = GAME_TYPE_CONFIG[session.game_type] || GAME_TYPE_CONFIG.poker;
            const moodBefore = MOOD_CONFIG[session.mood_before];
            const moodAfter = MOOD_CONFIG[session.mood_after];

            return (
              <Card
                key={session.id}
                className="session-card"
                hoverable
                onClick={() => handleOpenDetail(session)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {/* 左侧游戏图标 */}
                  <div style={{
                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                    background: `rgba(${gameCfg.color === 'purple' ? '167,139,250' : gameCfg.color === 'cyan' ? '34,211,238' : '251,191,36'}, 0.15)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26,
                  }}>
                    {gameCfg.icon}
                  </div>

                  {/* 中间信息 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <Text strong style={{ color: '#fff', fontSize: 16 }}>
                        {session.game_type_label}
                      </Text>
                      <Tag color={diffCfg.color}>{diffCfg.label}</Tag>
                      <Tag color={gameCfg.color}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {Math.round(((session.end_time || 0) - (session.start_time || 0)) / 60000)} 分钟
                      </Tag>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                        🃏 {session.total_hands} 手
                      </span>
                      <span style={{ color: session.win_rate >= 50 ? '#34d399' : '#f87171', fontSize: 13 }}>
                        <TrophyOutlined style={{ marginRight: 4 }} />
                        胜率 {session.win_rate}%
                      </span>
                      <span style={{
                        color: session.chips_change >= 0 ? '#34d399' : '#f87171',
                        fontSize: 13, fontWeight: 600,
                      }}>
                        {session.chips_change >= 0 ? '+' : ''}{session.chips_change} 筹码
                      </span>
                    </div>

                    <Text
                      type="secondary"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: 'rgba(255,255,255,0.55)',
                      }}
                    >
                      {session.coach_summary}
                    </Text>

                    {session.tags && session.tags.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {session.tags.map((tag, i) => (
                          <Tag
                            key={i}
                            style={{
                              background: 'rgba(167, 139, 250, 0.1)',
                              border: '1px solid rgba(167, 139, 250, 0.25)',
                              color: '#c4b5fd',
                              margin: '0 4px 4px 0',
                            }}
                          >
                            #{tag}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 右侧时间和操作 */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                        {coachLogsEngine.formatDate(session.start_time)}
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4, marginTop: 4,
                        justifyContent: 'flex-end',
                      }}>
                        <span style={{ fontSize: 14 }}>{moodBefore?.emoji}</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                        <span style={{ fontSize: 14 }}>{moodAfter?.emoji}</span>
                      </div>
                    </div>
                    <Popconfirm
                      title="确定删除这条陪练记录？"
                      description="删除后无法恢复"
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleDelete(session.id);
                      }}
                      onClick={(e) => e?.stopPropagation()}
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                        onClick={(e) => e?.stopPropagation()}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 详情弹窗 */}
      {detailSession && (
        <SessionDetailModal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          session={detailSession}
        />
      )}
    </div>
  );
};

// ============================================================
// 详情弹窗组件
// ============================================================
const SessionDetailModal = ({ open, onClose, session }) => {
  const diffCfg = DIFFICULTY_CONFIG[session.ai_difficulty] || DIFFICULTY_CONFIG.medium;
  const gameCfg = GAME_TYPE_CONFIG[session.game_type] || GAME_TYPE_CONFIG.poker;
  const moodBefore = MOOD_CONFIG[session.mood_before];
  const moodAfter = MOOD_CONFIG[session.mood_after];

  // 统计消息类型分布
  const messageStats = useMemo(() => {
    const msgs = session.messages || [];
    const counts = {};
    msgs.forEach(m => {
      counts[m.message_type] = (counts[m.message_type] || 0) + 1;
      counts[m.role] = (counts[m.role] || 0) + 1;
    });
    return { total: msgs.length, counts };
  }, [session.messages]);

  // 弹窗打开/关闭日志
  useEffect(() => {
    if (open) {
      logger.session('详情弹窗渲染会话', {
        id: session.id,
        messages: messageStats.total,
        messageTypes: messageStats.counts,
      });
      logger.ui('详情弹窗 Modal 已挂载', {
        sessionId: session.id,
        messages: messageStats.total,
      });
    }
  }, [open, session.id, messageStats.total, messageStats.counts]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
      className="coach-detail-modal"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>{gameCfg.icon}</span>
          <div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
              {session.game_type_label} · 陪练记录
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
              {coachLogsEngine.formatDate(session.start_time)}
            </div>
          </div>
        </div>
      }
    >
      {/* 会话概览 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        marginBottom: 16,
      }}>
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(167, 139, 250, 0.08)',
          border: '1px solid rgba(167, 139, 250, 0.15)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>总局数</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{session.total_hands}</div>
        </div>
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(52, 211, 153, 0.08)',
          border: '1px solid rgba(52, 211, 153, 0.15)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>胜率</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>{session.win_rate}%</div>
        </div>
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: session.chips_change >= 0 ? 'rgba(52, 211, 153, 0.08)' : 'rgba(248, 113, 113, 0.08)',
          border: `1px solid ${session.chips_change >= 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)'}`,
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>筹码</div>
          <div style={{
            fontSize: 20, fontWeight: 700,
            color: session.chips_change >= 0 ? '#34d399' : '#f87171',
          }}>
            {session.chips_change >= 0 ? '+' : ''}{session.chips_change}
          </div>
        </div>
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(96, 165, 250, 0.08)',
          border: '1px solid rgba(96, 165, 250, 0.15)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>情绪</div>
          <div style={{ fontSize: 20 }}>
            {moodBefore?.emoji} → {moodAfter?.emoji}
          </div>
        </div>
      </div>

      {/* 陪练总结 */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background: 'rgba(167, 139, 250, 0.05)',
          border: '1px solid rgba(167, 139, 250, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <BulbOutlined style={{ color: '#a78bfa', fontSize: 18, marginTop: 2 }} />
          <div>
            <div style={{ color: '#c4b5fd', fontWeight: 600, marginBottom: 6 }}>陪练总结</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>
              {session.coach_summary}
            </div>
          </div>
        </div>
      </Card>

      <Divider style={{ margin: '16px 0', borderColor: 'rgba(255,255,255,0.06)' }}>
        <CommentOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />
        <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>对话记录</span>
      </Divider>

      {/* 消息列表 */}
      <div style={{
        maxHeight: 400, overflowY: 'auto', paddingRight: 8,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {session.messages && session.messages.length > 0 ? (
          session.messages.map((msg) => {
            const typeCfg = MESSAGE_TYPE_CONFIG[msg.message_type] || MESSAGE_TYPE_CONFIG.system;
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: isUser
                    ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(139, 92, 246, 0.15))'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isUser
                    ? '1px solid rgba(167, 139, 250, 0.25)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                }}>
                  {!isUser && msg.message_type !== 'chat' && msg.message_type !== 'system' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      marginBottom: 6, fontSize: 11,
                      color: typeCfg.color,
                    }}>
                      <span>{typeCfg.icon}</span>
                      <span style={{ fontWeight: 600 }}>{typeCfg.label}</span>
                    </div>
                  )}
                  <div style={{
                    color: isUser ? '#e9d5ff' : 'rgba(255,255,255,0.75)',
                    lineHeight: 1.6, fontSize: 13,
                  }}>
                    {msg.content}
                  </div>
                  {msg.metadata && msg.metadata.hand && (
                    <div style={{
                      marginTop: 8, padding: '6px 10px', borderRadius: 6,
                      background: 'rgba(0,0,0,0.2)', fontSize: 11,
                      color: 'rgba(255,255,255,0.5)',
                    }}>
                      手牌: <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{msg.metadata.hand}</span>
                      {' · '}位置: {msg.metadata.position}
                      {' · '}底池: {msg.metadata.pot}
                    </div>
                  )}
                  <div style={{
                    marginTop: 4, fontSize: 10,
                    color: 'rgba(255,255,255,0.3)', textAlign: 'right',
                  }}>
                    {coachLogsEngine.formatDate(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <Empty description={<span style={{ color: 'rgba(255,255,255,0.3)' }}>暂无对话记录</span>} />
        )}
      </div>
    </Modal>
  );
};

export default CoachLogsPage;
