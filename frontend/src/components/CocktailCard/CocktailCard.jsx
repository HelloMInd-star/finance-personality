import React from 'react';
import { Card, Tag, Space, Typography, Divider } from 'antd';

const { Title, Text } = Typography;

/**
 * 分子调酒配方卡
 * 展示酒名、风味、质地、温度、呈现、成分、来源
 */
const CocktailCard = ({ data, bartender }) => {
  if (!data) return null;

  return (
    <div style={{
      maxWidth: 420,
      margin: '0 auto',
      background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)',
      borderRadius: 20,
      border: '1px solid rgba(212, 175, 55, 0.3)',
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(212, 175, 55, 0.1)'
    }}>
      {/* 头部：酒名 */}
      <div style={{
        padding: '32px 24px 24px',
        textAlign: 'center',
        background: 'linear-gradient(180deg, rgba(212, 175, 55, 0.15) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)'
      }}>
        <div style={{
          fontSize: 11,
          color: '#D4AF37',
          letterSpacing: 4,
          textTransform: 'uppercase',
          marginBottom: 8
        }}>
          {bartender ? `${bartender.icon} ${bartender.name} 特调` : '今夜特调'}
        </div>
        <Title level={2} style={{
          margin: 0,
          color: '#fff',
          fontWeight: 500,
          fontSize: 32,
          letterSpacing: 2
        }}>
          {data.name}
        </Title>
      </div>

      {/* 详情 */}
      <div style={{ padding: 24 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <InfoRow label="风味" value={data.flavor} color="#D4AF37" />
          <InfoRow label="质地" value={data.texture} color="#fff" />
          <InfoRow label="温度" value={data.temperature} color="#87CEEB" />
          <InfoRow label="呈现" value={data.presentation} color="#FFA07A" />

          <Divider style={{ margin: '8px 0', borderColor: 'rgba(255,255,255,0.1)' }} />

          {/* 成分 */}
          <div>
            <div style={{
              fontSize: 11,
              color: '#888',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 8
            }}>
              成分
            </div>
            <Space wrap size={[6, 6]}>
              {data.ingredients.map((ing, i) => (
                <Tag
                  key={i}
                  style={{
                    background: 'rgba(212, 175, 55, 0.1)',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                    color: '#D4AF37',
                    borderRadius: 12,
                    padding: '2px 12px',
                    fontSize: 12
                  }}
                >
                  {ing}
                </Tag>
              ))}
            </Space>
          </div>
        </Space>
      </div>

      {/* 底部：配方来源 */}
      <div style={{
        padding: '16px 24px',
        background: 'rgba(0,0,0,0.2)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        fontSize: 11,
        color: '#666',
        textAlign: 'center',
        letterSpacing: 1
      }}>
        配方来源：{data.recipeSource}
      </div>
    </div>
  );
};

const InfoRow = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
    <div style={{
      fontSize: 11,
      color: '#666',
      letterSpacing: 2,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      paddingTop: 2
    }}>
      {label}
    </div>
    <div style={{
      fontSize: 14,
      color: color || '#fff',
      textAlign: 'right',
      lineHeight: 1.5,
      maxWidth: 240
    }}>
      {value}
    </div>
  </div>
);

export default CocktailCard;
