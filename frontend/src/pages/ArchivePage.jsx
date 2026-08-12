import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Progress, Typography, Input, Row, Col, Empty } from 'antd';
import { ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import { INVESTOR_PROFILES } from '../utils/investorEngine';
import './ArchivePage.css';

const { Title, Text, Paragraph } = Typography;

const DIMS = [
  { key: 'riskTolerance', label: '风险容忍', color: '#22d3ee', invert: true },
  { key: 'timePreference', label: '时间偏好', color: '#f59e0b' },
  { key: 'executionDiscipline', label: '执行纪律', color: '#34d399' },
  { key: 'reflectionDeviation', label: '路径预判', color: '#a855f7' },
  { key: 'aimPrecision', label: '决策精度', color: '#f472b6' },
];

const ArchivePage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [mbtiFilter, setMbtiFilter] = useState('');

  const mbtiTypes = useMemo(() => {
    const types = [...new Set(INVESTOR_PROFILES.map(p => p.mbti))].sort();
    return types;
  }, []);

  const filtered = useMemo(() => {
    return INVESTOR_PROFILES.filter(p => {
      const matchSearch = !search ||
        p.name.includes(search) ||
        p.mbti.toLowerCase().includes(search.toLowerCase()) ||
        p.mbtiLabel?.includes(search);
      const matchMbti = !mbtiFilter || p.mbti === mbtiFilter;
      return matchSearch && matchMbti;
    });
  }, [search, mbtiFilter]);

  return (
    <div className="archive-page">
      {/* 标题栏 */}
      <div className="archive-header">
        <div className="archive-header-left">
          <span className="archive-back" onClick={() => navigate('/cockpit')}>
            <ArrowLeftOutlined /> 驾驶舱
          </span>
          <Title level={3} className="archive-title">
            📁 投资人档案库
          </Title>
          <Text className="archive-count">
            共 {INVESTOR_PROFILES.length} 位投资人 · 真实案例映射
          </Text>
        </div>
        <div className="archive-header-right">
          <Input
            placeholder="搜索姓名 / MBTI"
            prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="archive-search"
            allowClear
          />
        </div>
      </div>

      {/* MBTI 筛选 */}
      <div className="archive-filters">
        <span
          className={`archive-filter-chip ${!mbtiFilter ? 'active' : ''}`}
          onClick={() => setMbtiFilter('')}
        >
          全部
        </span>
        {mbtiTypes.map(t => (
          <span
            key={t}
            className={`archive-filter-chip ${mbtiFilter === t ? 'active' : ''}`}
            onClick={() => setMbtiFilter(mbtiFilter === t ? '' : t)}
          >
            {t}
          </span>
        ))}
      </div>

      {/* 投资人卡片网格 */}
      {filtered.length === 0 ? (
        <Empty description="未找到匹配的投资人" style={{ marginTop: 60 }} />
      ) : (
        <Row gutter={[16, 16]} className="archive-grid">
          {filtered.map(inv => (
            <Col xs={24} sm={12} lg={8} xl={6} key={inv.id}>
              <Card className="archive-card" size="small">
                {/* 顶部 */}
                <div className="archive-card-top">
                  <div className="archive-card-avatar">
                    {inv.emoji}
                  </div>
                  <div className="archive-card-info">
                    <div className="archive-card-name">{inv.name}</div>
                    <div className="archive-card-tags">
                      <Tag className="archive-mbti-tag">{inv.mbti}</Tag>
                      <span className="archive-mbti-label">{inv.mbtiLabel}</span>
                    </div>
                  </div>
                </div>

                {/* 名言 */}
                <div className="archive-quote">
                  <Text className="archive-quote-text">"{inv.famousQuote}"</Text>
                </div>

                {/* 决策风格 */}
                <div className="archive-style">
                  <Text type="secondary" className="archive-style-label">决策风格</Text>
                  <Text className="archive-style-text">{inv.decisionStyle}</Text>
                </div>

                {/* 五维数据 */}
                <div className="archive-dims">
                  {DIMS.map(d => {
                    const val = inv[d.key] || 50;
                    return (
                      <div key={d.key} className="archive-dim-row">
                        <span className="archive-dim-name">{d.label}</span>
                        <Progress
                          percent={d.invert ? 100 - val : val}
                          showInfo={false}
                          size="small"
                          strokeColor={d.color}
                          trailColor="rgba(255,255,255,0.06)"
                          className="archive-dim-bar"
                        />
                        <span className="archive-dim-val" style={{ color: d.color }}>
                          {d.invert ? 100 - val : val}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* 匹配描述 */}
                <div className="archive-match">
                  <Text className="archive-match-text">{inv.matchDescription}</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default ArchivePage;
