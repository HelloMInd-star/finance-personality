import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Space, Typography, Tag, message } from 'antd';
import {
  PlayCircleFilled,
  PauseCircleFilled,
  CloudOutlined,
  AudioOutlined,
} from '@ant-design/icons';
import { musicEngine } from '../utils/musicEngine';
import { musicProfileEngine } from '../utils/musicProfileEngine';
import '../components/Music/MusicPlayer.css';

const { Title, Text } = Typography;

const GENRE_EMOJI = {
  pop: '🎤',
  rock: '🎸',
  electronic: '🎛️',
  classical: '🎻',
  jazz: '🎷',
  hiphop: '🎙️',
  folk: '🪕',
  rnb: '🎹',
  unknown: '🎵',
};

const GENRE_COLORS = {
  pop: '#ec4899',
  rock: '#ef4444',
  electronic: '#8b5cf6',
  classical: '#f59e0b',
  jazz: '#6366f1',
  hiphop: '#f97316',
  folk: '#10b981',
  rnb: '#d946ef',
  unknown: '#7c3aed',
};

export default function MobilePlayerPage() {
  const { encoded } = useParams();
  const [profile, setProfile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    try {
      const decoded = decodeURIComponent(atob(encoded));
      const data = JSON.parse(decoded);
      setProfile(data);
      logger.info('移动端画像加载', data);
    } catch (e) {
      setError('无法解析画像数据');
    }
    return () => {
      musicEngine.stop();
    };
  }, [encoded]);

  const genreEmoji = GENRE_EMOJI[profile?.g] || '🎵';
  const primaryColor = GENRE_COLORS[profile?.g] || '#7c3aed';

  // 可视化
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barCount = 24;
      const gap = 2;
      const barW = (w - (barCount - 1) * gap) / barCount;

      for (let i = 0; i < barCount; i++) {
        const hBar = isPlaying
          ? 8 + Math.random() * (h * 0.7)
          : 4 + Math.random() * 4;
        const x = i * (barW + gap);
        const y = h - hBar;

        const grad = ctx.createLinearGradient(x, y, x, h);
        grad.addColorStop(0, primaryColor);
        grad.addColorStop(1, 'rgba(124, 58, 237, 0.3)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, hBar);
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, primaryColor]);

  // 进度
  useEffect(() => {
    if (!isPlaying) return;
    const start = Date.now();
    const dur = 180000;
    const tick = () => {
      const pct = ((Date.now() - start) % dur) / dur;
      setProgress(pct);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      musicEngine.stop();
    } else {
      const klineData = generateKLine(profile);
      if (klineData.length > 0) {
        musicEngine.setVolume(0.7);
        musicEngine.play(klineData, {
          mood: 0.5,
          industry: profile?.g || 'default',
        });
        setIsPlaying(true);
      }
    }
  }, [isPlaying, profile]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 24,
        background: 'linear-gradient(135deg, #1e1340, #0f172a)',
        color: '#fff',
        textAlign: 'center',
      }}>
        <Title level={3}>⚠️ 链接无效</Title>
        <Text type="secondary">{error}</Text>
        <Button type="primary" style={{ marginTop: 24 }} href="/music">
          返回首页
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e1340, #0f172a)',
      }}>
        <Text style={{ color: '#fff' }}>加载中...</Text>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e1340, #0f172a)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 20px',
      color: '#fff',
    }}>
      {/* 头部 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <CloudOutlined style={{ fontSize: 40, color: primaryColor }} />
        <Title level={4} style={{ color: '#fff', marginTop: 8 }}>
          音乐画像播放器
        </Title>
        <Text type="secondary">扫码进入 · 个性化听觉体验</Text>
      </div>

      {/* 唱片 */}
      <div style={{
        position: 'relative',
        width: 200,
        height: 200,
        marginBottom: 24,
      }}>
        <div
          className={`player-disc ${isPlaying ? 'playing' : ''}`}
          style={{
            width: 200,
            height: 200,
            background: `conic-gradient(from 0deg, ${primaryColor}, #ec4899, ${primaryColor})`,
            boxShadow: `0 0 60px ${primaryColor}40`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div style={{
            width: 90,
            height: 90,
            borderRadius: '50%',
            background: 'rgba(30, 19, 64, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '3px solid rgba(255,255,255,0.2)',
          }}>
            <span style={{ fontSize: 40 }}>{genreEmoji}</span>
          </div>
        </div>

        {isPlaying && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: primaryColor,
            opacity: 0.15,
            filter: 'blur(50px)',
            animation: 'pulse-glow 2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* 画像信息 */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Space direction="vertical" size={4} align="center">
          <Tag color="purple">
            {profile.g?.toUpperCase() || 'UNKNOWN'}
          </Tag>
          <Title level={5} style={{ color: '#fff', margin: 0 }}>
            {profile.u || '音乐用户'} 的听觉画像
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            BPM {profile.b || 120} · {profile.e || '未知'}情绪
          </Text>
        </Space>
      </div>

      {/* 可视化 */}
      <canvas
        ref={canvasRef}
        width={300}
        height={70}
        style={{
          width: '100%',
          maxWidth: 320,
          height: 70,
          borderRadius: 12,
          background: 'rgba(0,0,0,0.2)',
          marginBottom: 24,
        }}
      />

      {/* 进度 */}
      <div style={{
        width: '100%',
        maxWidth: 320,
        marginBottom: 16,
      }}>
        <div style={{
          height: 4,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, ${primaryColor}, #ec4899)`,
            boxShadow: isPlaying ? `0 0 10px ${primaryColor}` : 'none',
            transition: 'width 0.1s linear',
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span>{Math.floor(progress * 3)}:00</span>
          <span>3:00</span>
        </div>
      </div>

      {/* 播放按钮 */}
      <Button
        shape="circle"
        size="large"
        icon={
          isPlaying ? (
            <PauseCircleFilled style={{ fontSize: 44 }} />
          ) : (
            <PlayCircleFilled style={{ fontSize: 44 }} />
          )
        }
        onClick={togglePlay}
        style={{
          width: 72,
          height: 72,
          background: `linear-gradient(135deg, ${primaryColor}, #ec4899)`,
          border: 'none',
          color: '#fff',
          boxShadow: `0 4px 20px ${primaryColor}80`,
        }}
      />

      {/* 说明 */}
      <Text type="secondary" style={{
        fontSize: 11,
        marginTop: 32,
        textAlign: 'center',
        maxWidth: 280,
      }}>
        🎧 点击播放按钮，聆听由你的音乐画像生成的个性化旋律
      </Text>
    </div>
  );
}

function generateKLine(profile) {
  const data = [];
  const seed = (profile?.g?.length || 3) * 13;
  const basePrice = 100;

  for (let i = 0; i < 40; i++) {
    const change = Math.sin(i * 0.25 + seed) * 8 + Math.cos(i * 0.1 + seed) * 4;
    data.push({
      time: Date.now() - (40 - i) * 60000,
      open: basePrice + change,
      close: basePrice + change + (Math.random() - 0.5) * 4,
      high: basePrice + change + 6,
      low: basePrice + change - 6,
      volume: Math.floor(1000 + Math.random() * 4000),
    });
  }
  return data;
}
