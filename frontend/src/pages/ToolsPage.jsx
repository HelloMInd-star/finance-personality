import React from 'react';
import { Button, Card, Space, message, Typography } from 'antd';
import { ClearOutlined, ExportOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAppStore } from '../store/appStore';

const { Title, Paragraph } = Typography;

const ToolsPage = () => {
  const { data, clearAll } = useAppStore();

  const handleClear = () => {
    if (window.confirm('确定要清除所有数据吗？此操作不可恢复！')) {
      clearAll();
      message.success('所有数据已清除');
    }
  };

  const handleExport = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ymine-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('数据已导出');
  };

  const stats = [
    { label: '德州牌局', value: data.pokerGames.length },
    { label: '调酒会话', value: data.bartenderSessions.length },
    { label: '陪练对话', value: data.coachConversations.length },
    { label: '台球对局', value: data.billiardsGames.length },
    { label: '健身记录', value: data.fitnessSessions.length },
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={2} style={{ color: '#a78bfa', marginTop: 0 }}>⚙️ 系统工具</Title>

      <Card style={{ marginBottom: 20, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <Title level={4} style={{ color: '#fff' }}>📊 数据统计</Title>
        <Space wrap size="large">
          {stats.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#a78bfa' }}>{s.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{s.label}</div>
            </div>
          ))}
        </Space>
      </Card>

      <Card style={{ marginBottom: 20, background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <Title level={4} style={{ color: '#fff' }}>🔧 数据管理</Title>
        <Space wrap>
          <Button type="primary" icon={<ExportOutlined />} size="large" onClick={handleExport}>
            导出所有数据
          </Button>
          <Button danger icon={<ClearOutlined />} size="large" onClick={handleClear}>
            清除所有数据
          </Button>
        </Space>
      </Card>

      <Card style={{ background: 'rgba(30,19,64,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <Title level={4} style={{ color: '#fff' }}>
          <InfoCircleOutlined /> 关于 Y.Mine
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.7)' }}>
          Y.Mine · 行为决策沙盘<br/>
          人格映射 → 行为采集 → 金融叙事生成<br/>
          版本：v0.1.0 (内测版)
        </Paragraph>
      </Card>
    </div>
  );
};

export default ToolsPage;
