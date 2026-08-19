import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import './HeroPage.css';

const { Title, Text } = Typography;

const HeroPage = () => {
  const navigate = useNavigate();

  const handleEnter = () => {
    navigate('/showcase', { replace: true });
  };

  return (
    <div className="hero-page">
      {/* 星云光晕层 */}
      <div className="hero-nebula hero-nebula-purple" />
      <div className="hero-nebula hero-nebula-gold" />

      {/* 浮动粒子 */}
      <div className="hero-particles">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="hero-particle"
            style={{
              left: `${(i * 4.17 + 3) % 100}%`,
              top: `${(i * 7.3 + 5) % 100}%`,
              animationDelay: `${(i * 0.4) % 6}s`,
              animationDuration: `${8 + (i % 5) * 2}s`,
              opacity: 0.15 + (i % 4) * 0.12,
            }}
          />
        ))}
      </div>

      {/* 网格扫描线 */}
      <div className="hero-grid-overlay" />

      {/* 主内容 */}
      <div className="hero-content">
        <div className="hero-logo-mark">Y.Mine</div>
        <Title level={1} className="hero-main-title">
          欢迎回到 <span className="hero-gold-text">Y.Mine</span>
        </Title>
        <Text className="hero-subtitle">
          你的人格数字孪生空间
        </Text>
        <Text className="hero-guide">
          每一次选择，都在塑造你的金融人格
        </Text>
        <Button
          type="primary"
          size="large"
          icon={<RocketOutlined />}
          onClick={handleEnter}
          className="hero-enter-btn"
        >
          开启导览
        </Button>
      </div>
    </div>
  );
};

export default HeroPage;
