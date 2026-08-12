/**
 * 网易云音乐接入组件 · NetEaseConnect
 *
 * 功能：
 * 1. 手机号登录 / 二维码扫码登录
 * 2. 获取歌单列表
 * 3. 分析音乐画像
 * 4. 查看音乐偏好与行为向量映射
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  List,
  Tag,
  Space,
  Typography,
  Progress,
  Row,
  Col,
  Statistic,
  Empty,
  Spin,
  message,
  Divider,
  Tabs,
  Alert,
  Steps,
  Avatar,
  Tooltip,
} from 'antd';
import {
  CloudOutlined,
  LoginOutlined,
  UnorderedListOutlined,
  SearchOutlined,
  UserOutlined,
  LoadingOutlined,
  MobileOutlined,
  QrcodeOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import {
  getMusicStatus,
  neteaseLogin,
  getUserPlaylists,
  analyzeMusicProfile,
} from '../../utils/musicApi';
import { musicProfileEngine } from '../../utils/musicProfileEngine';
import { logger } from '../../utils/logger';
import MusicPlayer from './MusicPlayer';

const { Title, Text, Paragraph } = Typography;

const NetEaseConnect = () => {
  // 步骤状态：login -> playlists -> analyzing -> result
  const [step, setStep] = useState('login');
  const [loginMethod, setLoginMethod] = useState('phone'); // phone | qrcode
  const [loginLoading, setLoginLoading] = useState(false);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [qrPolling, setQrPolling] = useState(false);
  const qrPollingTimer = useRef(null);

  const [token, setToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);
  const [profile, setProfile] = useState(null);
  const [serviceStatus, setServiceStatus] = useState(null);

  useEffect(() => {
    checkService();
    const savedToken = localStorage.getItem('netease_token');
    const savedUser = localStorage.getItem('netease_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUserInfo(JSON.parse(savedUser));
        setStep('playlists');
      } catch (_) {}
    }
    return () => {
      if (qrPollingTimer.current) {
        clearInterval(qrPollingTimer.current);
      }
    };
  }, []);

  const checkService = async () => {
    try {
      const status = await getMusicStatus();
      setServiceStatus(status.data);
      logger.session('[网易云] 服务状态', status.data);
    } catch (e) {
      logger.warn('[网易云] 服务不可用', e.message);
      setServiceStatus({ demo_mode: true, netease_api_available: false });
    }
  };

  const handleLogin = async (values) => {
    setLoginLoading(true);
    try {
      const result = await neteaseLogin(values.phone, values.password);
      if (result.success) {
        setToken(result.token);
        setUserInfo(result.user_info);
        localStorage.setItem('netease_token', result.token);
        localStorage.setItem('netease_user', JSON.stringify(result.user_info));
        message.success(result.message || '登录成功');
        setStep('playlists');
        await fetchPlaylists(result.token, result.user_info?.user_id);
      } else {
        message.error(result.message || '登录失败');
      }
    } catch (e) {
      message.error('登录失败: ' + (e.message || '网络错误'));
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchPlaylists = async (tokenVal, uid) => {
    setPlaylistsLoading(true);
    try {
      const result = await getUserPlaylists(tokenVal, uid);
      if (result.success) {
        setPlaylists(result.playlists || []);
        if (result.demo_mode) {
          message.info('当前为演示模式，使用模拟歌单数据');
        }
      }
    } catch (e) {
      message.error('获取歌单失败: ' + (e.message || '网络错误'));
    } finally {
      setPlaylistsLoading(false);
    }
  };

  const togglePlaylist = (id) => {
    setSelectedPlaylists(prev => {
      if (prev.includes(id)) {
        return prev.filter(pid => pid !== id);
      }
      if (prev.length >= 5) {
        message.warning('最多选择 5 个歌单');
        return prev;
      }
      return [...prev, id];
    });
  };

  const selectAll = () => {
    if (selectedPlaylists.length === playlists.length) {
      setSelectedPlaylists([]);
    } else {
      setSelectedPlaylists(playlists.slice(0, 5).map(p => p.id));
    }
  };

  const handleAnalyze = async () => {
    if (selectedPlaylists.length === 0) {
      message.warning('请选择至少 1 个歌单');
      return;
    }
    setAnalyzing(true);
    try {
      const result = await analyzeMusicProfile({
        token,
        uid: userInfo?.user_id,
        playlist_ids: selectedPlaylists,
      });
      const rawData = result.data || result;
      if (rawData && Array.isArray(rawData.tracks) && rawData.tracks.length > 0) {
        const musicProfile = musicProfileEngine.buildFromNetease(rawData);
        const profileWithTracks = {
          ...musicProfile,
          tracks: rawData.tracks.slice(0, 8).map((t, i) => ({
            id: t.id || t.songId || i,
            name: t.name || t.songName || `Track ${i + 1}`,
            artists: t.artists || (t.artist ? [{ name: t.artist }] : []),
            duration: t.duration || 180000,
          })),
          source: rawData.source || 'netease',
          totalTracks: rawData.total_tracks || rawData.totalTracks || 0,
        };
        setProfile(profileWithTracks);
        localStorage.setItem('netease_profile', JSON.stringify(profileWithTracks));
        setStep('result');
        message.success(`音乐画像分析完成，共 ${profileWithTracks.totalTracks} 首歌曲`);
      } else {
        message.error('未获取到歌曲数据，请重试或切换歌单');
      }
    } catch (e) {
      message.error('分析失败: ' + (e.message || '网络错误'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDisconnect = () => {
    if (qrPollingTimer.current) {
      clearInterval(qrPollingTimer.current);
    }
    localStorage.removeItem('netease_token');
    localStorage.removeItem('netease_user');
    localStorage.removeItem('netease_profile');
    setToken(null);
    setUserInfo(null);
    setPlaylists([]);
    setSelectedPlaylists([]);
    setProfile(null);
    setStep('login');
    message.info('已断开网易云连接');
  };

  const getSummary = () => {
    if (profile) return musicProfileEngine.getProfileSummary();
    try {
      const saved = localStorage.getItem('netease_profile');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null;
  };

  // 模拟二维码登录（演示模式）
  const generateMockQRCode = () => {
    setQrCodeUrl('mock_qrcode_' + Date.now());
    setQrPolling(true);
    message.info('请在模拟页面扫码（3秒后自动登录）');
    
    let count = 0;
    qrPollingTimer.current = setInterval(() => {
      count++;
      if (count >= 3) {
        clearInterval(qrPollingTimer.current);
        qrPollingTimer.current = null;
        setQrPolling(false);
        // 模拟登录成功
        const mockToken = 'mock_qr_token_' + Date.now();
        const mockUser = {
          nickname: '扫码用户',
          user_id: 100000,
          avatar_url: '',
        };
        setToken(mockToken);
        setUserInfo(mockUser);
        localStorage.setItem('netease_token', mockToken);
        localStorage.setItem('netease_user', JSON.stringify(mockUser));
        message.success('扫码登录成功');
        setStep('playlists');
        fetchPlaylists(mockToken, mockUser.user_id);
      }
    }, 1000);
  };

  // ============= 渲染：登录界面 =============
  const renderLogin = () => (
    <Card className="glass-card netease-login-card">
      <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
        <CloudOutlined style={{ fontSize: 48, color: '#c20c0c' }} />
        <Title level={4} style={{ marginTop: 16 }}>网易云音乐接入</Title>
        <Paragraph type="secondary">
          登录网易云账号，分析你的音乐偏好，映射到行为向量体系
        </Paragraph>

        {serviceStatus?.demo_mode ? (
          <Alert
            type="warning"
            showIcon
            icon={<InfoCircleOutlined />}
            message="演示模式"
            description="当前未连接网易云 API，使用模拟数据。可输入任意手机号和密码进行测试。"
            style={{ maxWidth: 400, margin: '0 auto', textAlign: 'left' }}
          />
        ) : (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message="已连接网易云 API"
            style={{ maxWidth: 400, margin: '0 auto' }}
          />
        )}
      </div>

      <Tabs
        activeKey={loginMethod}
        onChange={(key) => {
          setLoginMethod(key);
          if (key === 'qrcode' && !qrCodeUrl && serviceStatus?.demo_mode) {
            generateMockQRCode();
          }
        }}
        centered
        style={{ maxWidth: 400, margin: '0 auto' }}
      >
        <Tabs.TabPane
          tab={
            <span>
              <MobileOutlined /> 手机号登录
            </span>
          }
          key="phone"
        >
          <Form
            onFinish={handleLogin}
            layout="vertical"
            style={{ maxWidth: 320, margin: '0 auto' }}
            requiredMark={false}
          >
            <Form.Item
              name="phone"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^\d{11}$/, message: '请输入11位手机号' },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="手机号"
                size="large"
                maxLength={11}
                type="tel"
              />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                placeholder="密码"
                size="large"
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loginLoading}
                icon={<LoginOutlined />}
                style={{
                  background: 'linear-gradient(135deg, #c20c0c 0%, #7c3aed 100%)',
                  border: 'none',
                }}
              >
                登录网易云
              </Button>
            </Form.Item>
            {serviceStatus?.demo_mode && (
              <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 12 }}>
                💡 演示模式下可输入任意11位手机号和密码
              </Text>
            )}
          </Form>
        </Tabs.TabPane>

        <Tabs.TabPane
          tab={
            <span>
              <QrcodeOutlined /> 扫码登录
            </span>
          }
          key="qrcode"
        >
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            {!qrCodeUrl ? (
              <Space direction="vertical" size="large">
                <div style={{ fontSize: 48 }}>📱</div>
                <Text>使用网易云音乐 App 扫码登录</Text>
                <Button
                  type="primary"
                  icon={<QrcodeOutlined />}
                  onClick={generateMockQRCode}
                  style={{
                    background: 'linear-gradient(135deg, #c20c0c 0%, #7c3aed 100%)',
                    border: 'none',
                  }}
                >
                  {serviceStatus?.demo_mode ? '生成模拟二维码' : '获取二维码'}
                </Button>
              </Space>
            ) : (
              <Space direction="vertical" size="large" align="center">
                <div
                  style={{
                    width: 200,
                    height: 200,
                    margin: '0 auto',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '2px solid rgba(212, 175, 55, 0.3)',
                  }}
                >
                  {/* 模拟二维码动画 */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
                      animation: 'qrScan 2s linear infinite',
                    }}
                  />
                  <div style={{ fontSize: 64, opacity: 0.8 }}>🔲</div>
                  {qrPolling && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                        color: '#d4af37',
                        fontSize: 12,
                      }}
                    >
                      等待扫描中...
                    </div>
                  )}
                </div>
                <div>
                  <Text type="secondary">请使用网易云 App 扫描二维码</Text>
                </div>
                {!qrPolling && (
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={generateMockQRCode}
                  >
                    刷新二维码
                  </Button>
                )}
                <Button
                  size="small"
                  type="link"
                  onClick={() => {
                    setQrCodeUrl(null);
                    if (qrPollingTimer.current) {
                      clearInterval(qrPollingTimer.current);
                      setQrPolling(false);
                    }
                  }}
                >
                  取消
                </Button>
              </Space>
            )}
          </div>
        </Tabs.TabPane>
      </Tabs>

      {/* 登录方式说明 */}
      <div style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
        <Space direction="vertical" size="small">
          <Text type="secondary" style={{ fontSize: 12 }}>
            <SafetyOutlined /> 隐私保护：你的登录信息仅用于本次会话，不会存储密码。
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <InfoCircleOutlined /> 分析完成后可在 Dashboard 查看音乐画像。
          </Text>
        </Space>
      </div>

      <style>{`
        @keyframes qrScan {
          0% { transform: translateY(0); }
          50% { transform: translateY(198px); }
          100% { transform: translateY(0); }
        }
      `}</style>
    </Card>
  );

  // ============= 渲染：歌单选择 =============
  const renderPlaylists = () => (
    <Card
      className="glass-card"
      title={
        <Space>
          <UnorderedListOutlined />
          <span>选择歌单（{selectedPlaylists.length}/{Math.min(playlists.length, 5)}）</span>
        </Space>
      }
      extra={
        <Space>
          <Button size="small" onClick={selectAll} disabled={analyzing}>
            {selectedPlaylists.length === playlists.length ? '取消全选' : '全选'}
          </Button>
          <Button
            type="primary"
            size="small"
            disabled={selectedPlaylists.length === 0}
            loading={analyzing}
            onClick={handleAnalyze}
            icon={<SearchOutlined />}
          >
            开始分析
          </Button>
        </Space>
      }
    >
      {/* 用户信息条 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'rgba(124, 58, 237, 0.1)',
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Avatar
          style={{
            background: 'linear-gradient(135deg, #c20c0c, #7c3aed)',
          }}
        >
          {userInfo?.nickname?.[0] || '用'}
        </Avatar>
        <div style={{ flex: 1 }}>
          <Text strong>{userInfo?.nickname || '音乐用户'}</Text>
          {serviceStatus?.demo_mode && (
            <Tag color="orange" style={{ marginLeft: 8 }}>演示模式</Tag>
          )}
        </div>
        <Button
          size="small"
          danger
          icon={<DisconnectOutlined />}
          onClick={handleDisconnect}
        >
          断开
        </Button>
      </div>

      {/* 步骤提示 */}
      <Steps
        current={1}
        size="small"
        className="netease-steps"
        items={[
          { title: '登录' },
          { title: '选择歌单' },
          { title: '分析画像' },
          { title: '查看结果' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {playlistsLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
          <div style={{ marginTop: 16 }}>加载歌单中...</div>
        </div>
      ) : playlists.length === 0 ? (
        <Empty
          description="暂无歌单"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button onClick={() => fetchPlaylists(token, userInfo?.user_id)}>
            重新加载
          </Button>
        </Empty>
      ) : (
        <List
          grid={{ gutter: 12, xs: 1, sm: 2, md: 2, lg: 3 }}
          dataSource={playlists}
          renderItem={(item) => (
            <List.Item style={{ border: 'none' }}>
              <div
                onClick={() => togglePlaylist(item.id)}
                style={{
                  cursor: 'pointer',
                  background: selectedPlaylists.includes(item.id)
                    ? 'rgba(124, 58, 237, 0.2)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: selectedPlaylists.includes(item.id)
                    ? '1px solid rgba(124, 58, 237, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: 12,
                  transition: 'all 0.2s',
                }}
              >
                <Space align="start" style={{ width: '100%' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #c20c0c, #7c3aed)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    🎵
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.track_count || 0} 首歌曲
                    </Text>
                  </div>
                  {selectedPlaylists.includes(item.id) && (
                    <CheckCircleOutlined style={{ color: '#7c3aed', fontSize: 18 }} />
                  )}
                </Space>
              </div>
            </List.Item>
          )}
        />
      )}

      <Divider />

      <div style={{ textAlign: 'right' }}>
        <Space>
          <Button onClick={handleDisconnect} icon={<DisconnectOutlined />}>
            断开连接
          </Button>
          <Button
            type="primary"
            disabled={selectedPlaylists.length === 0}
            loading={analyzing}
            onClick={handleAnalyze}
            icon={<SearchOutlined />}
            style={{
              background: 'linear-gradient(135deg, #c20c0c 0%, #7c3aed 100%)',
              border: 'none',
            }}
          >
            分析音乐画像
          </Button>
        </Space>
      </div>
    </Card>
  );

  // ============= 渲染：分析中 =============
  const renderAnalyzing = () => (
    <Card className="glass-card" style={{ textAlign: 'center', padding: 40 }}>
      <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
      <Title level={4} style={{ marginTop: 24 }}>
        正在分析音乐画像...
      </Title>
      <Text type="secondary">
        分析 {selectedPlaylists.length} 个歌单中的音乐数据，生成行为向量映射
      </Text>
    </Card>
  );

  // ============= 渲染：画像结果 =============
  const renderResult = () => {
    const summary = getSummary();
    if (!summary) return <Empty description="暂无画像数据" />;

    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 播放器 */}
        <MusicPlayer profile={profile} userInfo={userInfo} />

        {/* 用户信息 */}
        <Card className="glass-card">
          <Row gutter={16} align="middle">
            <Col>
              <Avatar
                size={64}
                style={{
                  background: 'linear-gradient(135deg, #c20c0c, #7c3aed)',
                  fontSize: 28,
                }}
              >
                {userInfo?.nickname?.[0] || '🎵'}
              </Avatar>
            </Col>
            <Col flex={1}>
              <Title level={4} style={{ margin: 0 }}>
                {userInfo?.nickname || '音乐用户'}
              </Title>
              <Text type="secondary">
                分析 {summary.totalTracks || 0} 首歌曲 ·{' '}
                {profile?.source === 'netease' ? '网易云真实数据' : '演示数据'}
              </Text>
            </Col>
            <Col>
              <Space>
                <Button onClick={() => setStep('playlists')} icon={<ReloadOutlined />}>
                  重新选择
                </Button>
                <Button danger onClick={handleDisconnect} icon={<DisconnectOutlined />}>
                  断开
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 画像概览 */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card className="glass-card" style={{ textAlign: 'center' }}>
              <Statistic
                title="主导曲风"
                value={summary.dominantGenre || '-'}
                valueStyle={{ color: '#a855f7', fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="glass-card" style={{ textAlign: 'center' }}>
              <Statistic
                title="主导情绪"
                value={summary.dominantEmotion || '-'}
                valueStyle={{ color: '#10b981', fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="glass-card" style={{ textAlign: 'center' }}>
              <Statistic
                title="风险水平"
                value={summary.traits?.riskLevel || '-'}
                valueStyle={{
                  color:
                    summary.traits?.riskLevel === '高'
                      ? '#ef4444'
                      : summary.traits?.riskLevel === '低'
                      ? '#10b981'
                      : '#f59e0b',
                  fontSize: 20,
                }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="glass-card" style={{ textAlign: 'center' }}>
              <Statistic
                title="交易风格"
                value={summary.behaviorHints?.tradingStyle || '-'}
                valueStyle={{ color: '#fbbf24', fontSize: 20 }}
              />
            </Card>
          </Col>
        </Row>

        {/* 行为向量映射 */}
        <Card className="glass-card" title="行为向量映射（音乐偏好 → 人格维度）">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <div>
                <Space>
                  <Text strong>🎯 风险承受度</Text>
                  <Text type="secondary">{Math.round(summary.vector?.riskTolerance * 100) || 0}%</Text>
                </Space>
                <Progress
                  percent={Math.round((summary.vector?.riskTolerance || 0) * 100)}
                  strokeColor="#a855f7"
                  showInfo={false}
                />
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div>
                <Space>
                  <Text strong>⚡ 决策速度</Text>
                  <Text type="secondary">{Math.round(summary.vector?.decisionSpeed * 100) || 0}%</Text>
                </Space>
                <Progress
                  percent={Math.round((summary.vector?.decisionSpeed || 0) * 100)}
                  strokeColor="#fbbf24"
                  showInfo={false}
                />
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div>
                <Space>
                  <Text strong>🎲 新奇寻求</Text>
                  <Text type="secondary">{Math.round(summary.vector?.noveltySeeking * 100) || 0}%</Text>
                </Space>
                <Progress
                  percent={Math.round((summary.vector?.noveltySeeking || 0) * 100)}
                  strokeColor="#10b981"
                  showInfo={false}
                />
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div>
                <Space>
                  <Text strong>🛡️ 情绪稳定性</Text>
                  <Text type="secondary">{Math.round(summary.vector?.emotionalStability * 100) || 0}%</Text>
                </Space>
                <Progress
                  percent={Math.round((summary.vector?.emotionalStability || 0) * 100)}
                  strokeColor="#06b6d4"
                  showInfo={false}
                />
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div>
                <Space>
                  <Text strong>⏳ 耐心度</Text>
                  <Text type="secondary">{Math.round(summary.vector?.patience * 100) || 0}%</Text>
                </Space>
                <Progress
                  percent={Math.round((summary.vector?.patience || 0) * 100)}
                  strokeColor="#8b5cf6"
                  showInfo={false}
                />
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div>
                <Space>
                  <Text strong>⚔️ 攻击性</Text>
                  <Text type="secondary">{Math.round(summary.vector?.aggression * 100) || 0}%</Text>
                </Space>
                <Progress
                  percent={Math.round((summary.vector?.aggression || 0) * 100)}
                  strokeColor="#ef4444"
                  showInfo={false}
                />
              </div>
            </Col>
          </Row>
        </Card>

        {/* 金融维度映射 */}
        <Card className="glass-card" title="金融行为分析">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="金融风险承受"
                  value={summary.behaviorHints?.riskTolerance || '-'}
                  suffix="/ 高"
                  valueStyle={{ color: '#ec4899' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="决策风格"
                  value={summary.behaviorHints?.decisionSpeed || '-'}
                  suffix="/ 快"
                  valueStyle={{ color: '#fbbf24' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title="交易风格"
                  value={summary.behaviorHints?.tradingStyle || '-'}
                  valueStyle={{ color: '#a855f7' }}
                />
              </Card>
            </Col>
          </Row>
          <Divider style={{ margin: '16px 0' }} />
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Space>
                <Text type="secondary" style={{ flex: 1 }}>估值方式倾向</Text>
                <Text type="secondary">{Math.round((summary.vector?.valuationApproach || 0) * 100)}%</Text>
              </Space>
              <Progress
                percent={Math.round((summary.vector?.valuationApproach || 0) * 100)}
                strokeColor="#f59e0b"
                format={(p) => (p > 50 ? '基本面分析' : '技术面分析')}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Space>
                <Text type="secondary" style={{ flex: 1 }}>风险管理能力</Text>
                <Text type="secondary">{Math.round((summary.vector?.riskManagement || 0) * 100)}%</Text>
              </Space>
              <Progress
                percent={Math.round((summary.vector?.riskManagement || 0) * 100)}
                strokeColor="#10b981"
              />
            </Col>
          </Row>
        </Card>

        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message="音乐画像已保存"
          description="音乐画像已保存到本地，将与你的行为数据（德州扑克、台球、健身）共同构建完整的人格向量。音乐偏好数据会以 30% 权重融合到你的行为分析中。"
        />
      </Space>
    );
  };

  // 根据步骤渲染
  return (
    <div className="netease-connect">
      {step === 'login' && renderLogin()}
      {step === 'playlists' && renderPlaylists()}
      {step === 'analyzing' && renderAnalyzing()}
      {step === 'result' && renderResult()}
    </div>
  );
};

export default NetEaseConnect;
