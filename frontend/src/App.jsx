import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Space, Card, Typography, Modal, Form, Input, Select, message, Divider, Tag } from 'antd';
import { 
  HomeOutlined, 
  TrophyOutlined, 
  UserOutlined,
  SettingOutlined,
  PlusOutlined,
  LoginOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  BulbOutlined,
  InfoCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import PokerTable from './components/PokerTable/PokerTable';
import Dashboard from './components/Dashboard/Dashboard';
import GameLobby from './components/GameLobby/GameLobby';
import Profile from './components/Profile/Profile';
import Stats from './components/Stats/Stats';
import { useGameStore } from './store/gameStore';
import './App.css';

const { Header, Content, Footer, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;

// 内部页面组件，有 navigate 上下文
function HomePage() {
  const navigate = useNavigate();
  const { 
    gameState, 
    playerId, 
    createGame, 
    isLoading 
  } = useGameStore();

  const [showGuide, setShowGuide] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [quickDifficulty, setQuickDifficulty] = useState('medium');

  const handleQuickStart = async (playerName) => {
    try {
      await createGame(playerName || 'Player', quickDifficulty);
      setShowQuickStart(false);
      message.success('游戏已创建！');
    } catch (err) {
      message.error('创建游戏失败');
    }
  };

  const handleGoLobby = () => {
    navigate('/lobby');
  };

  return (
    <div className="home-page fade-in">
      {gameState ? (
        <div className="game-container">
          <PokerTable gameState={gameState} playerId={playerId} />
          <Dashboard gameState={gameState} />
        </div>
      ) : (
        <div className="welcome-section">
          <Card className="welcome-card">
            <div className="welcome-icon">♠️</div>
            <Title level={1} className="welcome-title">
              Y.Mine · Poker Egg
            </Title>
            <Text className="welcome-subtitle">
              德州扑克 · 凯利公式 · AI陪练
            </Text>
            <div className="welcome-divider" />
            <Space size="middle" className="welcome-actions" wrap>
              <Button 
                type="primary" 
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={() => setShowQuickStart(true)}
              >
                ⚡ 快速开始
              </Button>
              <Button 
                size="large"
                icon={<PlusOutlined />}
                onClick={handleGoLobby}
              >
                🎯 大厅创建
              </Button>
              <Button 
                size="large"
                icon={<BulbOutlined />}
                onClick={() => setShowGuide(true)}
              >
                📖 如何玩
              </Button>
              <Button 
                size="large"
                ghost
                onClick={() => window.open('/easter-egg.html', '_blank')}
                style={{ color: '#a78bfa' }}
              >
                🥚 彩蛋
              </Button>
            </Space>
          </Card>

          <div className="features-grid">
            <Card className="feature-card">
              <div className="feature-icon">🤖</div>
              <Title level={4}>AI陪练</Title>
              <Text>3个难度级别，从新手到高手<br/>实时决策，模拟真实对手</Text>
            </Card>
            <Card className="feature-card">
              <div className="feature-icon">📊</div>
              <Title level={4}>凯利公式</Title>
              <Text>实时计算最优投注比例<br/>胜率×赔率=科学决策</Text>
            </Card>
            <Card className="feature-card">
              <div className="feature-icon">🎯</div>
              <Title level={4}>表理映射</Title>
              <Text>博弈状态可视化分析<br/>赔率、张力、安全边际一目了然</Text>
            </Card>
          </div>
        </div>
      )}

      {/* 快速开始弹窗 */}
      <Modal
        title="⚡ 快速开始"
        open={showQuickStart}
        onCancel={() => setShowQuickStart(false)}
        footer={null}
      >
        <Form layout="vertical" onFinish={(v) => handleQuickStart(v.player_name)}>
          <Form.Item name="player_name" label="你的昵称" initialValue="Player">
            <Input placeholder="输入昵称" />
          </Form.Item>
          <Form.Item label="AI难度">
            <Select value={quickDifficulty} onChange={setQuickDifficulty}>
              <Select.Option value="easy">😊 简单 - 初学练习</Select.Option>
              <Select.Option value="medium">🤔 中等 - 一般玩家</Select.Option>
              <Select.Option value="hard">🔥 困难 - 高手挑战</Select.Option>
            </Select>
          </Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            block 
            size="large"
            loading={isLoading}
          >
            开始游戏
          </Button>
        </Form>
      </Modal>

      {/* 如何玩指南 */}
      <Modal
        title="📖 如何玩德州扑克"
        open={showGuide}
        onCancel={() => setShowGuide(false)}
        footer={[<Button key="ok" type="primary" onClick={() => setShowGuide(false)}>明白了</Button>]}
        width={600}
      >
        <div className="guide-content">
          <div className="guide-section">
            <Title level={4}>🎯 游戏目标</Title>
            <Paragraph>
              赢取对手的筹码！通过组合你的2张手牌和5张公共牌，
              组成最强的5张牌，或通过下注迫使对手弃牌。
            </Paragraph>
          </div>
          
          <div className="guide-section">
            <Title level={4}>🃏 牌型大小（从大到小）</Title>
            <div className="hand-ranking">
              <Tag color="gold">1. 皇家同花顺</Tag>
              <Tag color="orange">2. 同花顺</Tag>
              <Tag color="red">3. 四条</Tag>
              <Tag color="magenta">4. 葫芦</Tag>
              <Tag color="purple">5. 同花</Tag>
              <Tag color="blue">6. 顺子</Tag>
              <Tag color="cyan">7. 三条</Tag>
              <Tag color="green">8. 两对</Tag>
              <Tag color="lime">9. 一对</Tag>
              <Tag color="default">10. 高牌</Tag>
            </div>
          </div>

          <div className="guide-section">
            <Title level={4}>🎮 行动选项</Title>
            <ul>
              <li><b>弃牌(Fold)</b>：放弃本手牌，不参与继续下注</li>
              <li><b>过牌(Check)</b>：不下注，把选择权传给下一位</li>
              <li><b>跟注(Call)</b>：跟上下注金额，继续参与</li>
              <li><b>加注(Raise)</b>：增加下注金额，向对手施压</li>
              <li><b>ALL IN</b>：押上所有筹码，孤注一掷</li>
            </ul>
          </div>

          <div className="guide-section">
            <Title level={4}>📊 凯利公式是什么？</Title>
            <Paragraph>
              凯利公式帮你计算<strong>最优投注比例</strong>：
              <br/><code>K% = (W × R - L) / R</code>
              <br/>其中 W=胜率，R=赔率，L=败率。
              <br/>凯利指数 > 0 表示有利可图，越大越好！
            </Paragraph>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { disconnectGame } = useGameStore();

  // 启动时检查登录状态
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setIsLoggedIn(true);
      } catch (e) {
        // 忽略解析错误
      }
    }
  }, []);

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsLoggedIn(true);
        setUser(data.user);
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        message.success('登录成功！');
        setLoginModalVisible(false);
      } else {
        message.error('登录失败，请检查用户名和密码');
      }
    } catch (error) {
      message.error('网络错误，请稍后重试');
    }
    setLoading(false);
  };

  const handleRegister = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      
      if (response.ok) {
        message.success('注册成功！请登录');
        setRegisterModalVisible(false);
        setLoginModalVisible(true);
      } else {
        message.error('注册失败，请检查信息');
      }
    } catch (error) {
      message.error('网络错误，请稍后重试');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectGame();
    message.success('已退出登录');
  };

  return (
    <BrowserRouter>
      <Layout className="app-layout">
        <Header className="app-header">
          <div className="header-left">
            <Link to="/" className="logo-link">
              <span className="logo">♠️ Poker Egg</span>
            </Link>
          </div>
          
          <Menu theme="dark" mode="horizontal" className="header-menu" selectable={false}>
            <Menu.Item key="home" icon={<HomeOutlined />}>
              <Link to="/">牌桌</Link>
            </Menu.Item>
            <Menu.Item key="lobby" icon={<PlusOutlined />}>
              <Link to="/lobby">大厅</Link>
            </Menu.Item>
            <Menu.Item key="stats" icon={<TrophyOutlined />}>
              <Link to="/stats">战绩</Link>
            </Menu.Item>
            <Menu.Item key="profile" icon={<UserOutlined />}>
              <Link to="/profile">个人</Link>
            </Menu.Item>
          </Menu>

          <div className="header-right">
            {isLoggedIn ? (
              <Space>
                <Button 
                  type="text" 
                  ghost
                  onClick={() => window.open('/easter-egg.html', '_blank')}
                  style={{ color: '#a78bfa', fontSize: '16px', padding: '4px 8px' }}
                  title="🎯 查看经典彩蛋"
                >
                  🥚
                </Button>
                <Text style={{ color: '#fff' }}>👋 {user?.username || '玩家'}</Text>
                <Button type="primary" ghost icon={<LogoutOutlined />} onClick={handleLogout}>
                  退出
                </Button>
              </Space>
            ) : (
              <Space>
                <Button 
                  type="text" 
                  ghost
                  onClick={() => window.open('/easter-egg.html', '_blank')}
                  style={{ color: '#a78bfa', fontSize: '16px', padding: '4px 8px' }}
                  title="🎯 查看经典彩蛋"
                >
                  🥚
                </Button>
                <Button type="default" ghost onClick={() => setLoginModalVisible(true)}>登录</Button>
                <Button type="primary" onClick={() => setRegisterModalVisible(true)}>注册</Button>
              </Space>
            )}
          </div>
        </Header>

        <Content className="app-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/lobby" element={<GameLobby />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Content>

        <Footer className="app-footer">
          <Text type="secondary">
            © 2024 Poker Egg · Made with ❤️ by HelloMind-star
          </Text>
        </Footer>
      </Layout>

      {/* 登录弹窗 */}
      <Modal
        title="🔐 登录"
        open={loginModalVisible}
        onCancel={() => setLoginModalVisible(false)}
        footer={null}
        className="auth-modal"
      >
        <Form onFinish={handleLogin} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>登录</Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">
              还没有账号？ 
              <Button type="link" onClick={() => {
                setLoginModalVisible(false);
                setRegisterModalVisible(true);
              }}>立即注册</Button>
            </Text>
          </div>
        </Form>
      </Modal>

      {/* 注册弹窗 */}
      <Modal
        title="📝 注册"
        open={registerModalVisible}
        onCancel={() => setRegisterModalVisible(false)}
        footer={null}
        className="auth-modal"
      >
        <Form onFinish={handleRegister} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少3个字符' }
          ]}>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' }
          ]}>
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' }
          ]}>
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>注册</Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">
              已有账号？ 
              <Button type="link" onClick={() => {
                setRegisterModalVisible(false);
                setLoginModalVisible(true);
              }}>立即登录</Button>
            </Text>
          </div>
        </Form>
      </Modal>
    </BrowserRouter>
  );
}

export default App;
