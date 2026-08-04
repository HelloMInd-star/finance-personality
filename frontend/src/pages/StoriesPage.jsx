import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Empty,
  Tooltip
} from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import CocktailCard from '../components/CocktailCard/CocktailCard';
import { generateCocktailKLine } from '../utils/molecularEngine';
import { musicEngine } from '../utils/musicEngine';
import { storage } from '../utils/storage';
import { logger } from '../utils/logger';

const { Title, Text, Paragraph } = Typography;

const StoriesPage = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [playingId, setPlayingId] = useState(null);

  // 播放单杯配方的音乐
  const handlePlaySession = (session) => {
    if (playingId === session.id) {
      musicEngine.stop();
      setPlayingId(null);
      return;
    }

    const kline = generateCocktailKLine(session.cocktail);
    if (!kline.data || kline.data.length === 0) return;

    musicEngine.stop();
    musicEngine.onComplete = () => setPlayingId(null);

    musicEngine.play(kline.data, {
      mood: kline.moodHint || 0.5,
      industry: kline.industryHint || '科技'
    });

    setPlayingId(session.id);
    logger.session('故事集播放配方音乐', session.cocktail?.name);
  };

  useEffect(() => {
    return () => musicEngine.stop();
  }, []);

  useEffect(() => {
    const data = storage.get('bartenderSessions') || [];
    // 按时间倒序
    const sorted = [...data].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setSessions(sorted);
    logger.session('加载故事集', `${sorted.length}条记录`);
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleDelete = (id) => {
    storage.update('bartenderSessions', (prev) => prev.filter(s => s.id !== id));
    setSessions(prev => prev.filter(s => s.id !== id));
    logger.session('删除故事记录', id);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
                返回首页
              </Button>
              <div>
                <Title level={3} style={{ margin: 0 }}>📚 故事集</Title>
                <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                  所有存档的分子调酒配方 —— {sessions.length} 杯
                </Paragraph>
              </div>
            </Space>
            <Tag color="#D4AF37">{sessions.length} 条记录</Tag>
          </Space>
        </Card>

        {sessions.length === 0 ? (
          <Card>
            <Empty
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">还没有存档的调酒配方</Text>
                  <Button type="primary" onClick={() => navigate('/bartender')}>
                    去调一杯
                  </Button>
                </Space>
              }
            />
          </Card>
        ) : (
          <Row gutter={[24, 24]}>
            {sessions.map((session) => (
              <Col xs={24} md={12} lg={8} key={session.id}>
                <Card
                  size="small"
                  style={{ height: '100%' }}
                  bodyStyle={{ padding: 0 }}
                  title={
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space size={4}>
                        <Tag color={
                          session.bartender === 'cole' ? '#1890ff' :
                          session.bartender === 'finn' ? '#eb2f96' : '#52c41a'
                        }>
                          {session.bartenderName || session.bartender}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatDate(session.createdAt)}
                        </Text>
                      </Space>
                      <Space>
                        <Tooltip title={playingId === session.id ? '停止' : '播放这杯酒'}>
                          <Button
                            type={playingId === session.id ? 'primary' : 'text'}
                            size="small"
                            icon={playingId === session.id ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                            onClick={() => handlePlaySession(session)}
                          />
                        </Tooltip>
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDelete(session.id)}
                          />
                        </Tooltip>
                      </Space>
                    </Space>
                  }
                  extra={
                    <Tag style={{ marginRight: 0 }}>
                      {session.emotion}
                    </Tag>
                  }
                >
                  <div style={{ padding: 12 }}>
                    {session.cocktail && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{
                          fontSize: 20,
                          fontWeight: 500,
                          textAlign: 'center',
                          color: '#D4AF37',
                          marginBottom: 12
                        }}>
                          {session.cocktail.name}
                        </div>
                        <Row gutter={[4, 8]}>
                          <Col span={24}>
                            <Text type="secondary" style={{ fontSize: 11 }}>风味</Text>
                            <div style={{ fontSize: 12 }}>{session.cocktail.flavor}</div>
                          </Col>
                          <Col span={24}>
                            <Text type="secondary" style={{ fontSize: 11 }}>呈现</Text>
                            <div style={{ fontSize: 12 }}>{session.cocktail.presentation}</div>
                          </Col>
                          <Col span={24}>
                            <Text type="secondary" style={{ fontSize: 11 }}>故事</Text>
                            <div style={{ fontSize: 12 }}>{session.storySeed}</div>
                          </Col>
                        </Row>
                        <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            成分：{session.cocktail.ingredients?.slice(0, 3).join(' · ')}
                            {session.cocktail.ingredients?.length > 3 ? '...' : ''}
                          </Text>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Space>
    </div>
  );
};

export default StoriesPage;
