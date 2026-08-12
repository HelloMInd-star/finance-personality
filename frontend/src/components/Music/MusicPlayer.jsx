import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Slider,
  Tag,
  Tooltip,
  Modal,
  message,
  Spin,
} from 'antd';
import {
  PlayCircleFilled,
  PauseCircleFilled,
  SoundOutlined,
  RightOutlined,
  LeftOutlined,
  ReloadOutlined,
  QrcodeOutlined,
  AudioOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import QRCode from 'qrcode';
import { musicEngine } from '../../utils/musicEngine';
import { musicProfileEngine } from '../../utils/musicProfileEngine';
import { getSongUrl } from '../../utils/musicApi';
import { logger } from '../../utils/logger';
import './MusicPlayer.css';

const { Title, Text } = Typography;

const GENRE_COLORS = {
  pop: '#ec4899',
  rock: '#ef4444',
  electronic: '#8b5cf6',
  classical: '#f59e0b',
  jazz: '#6366f1',
  hiphop: '#f97316',
  folk: '#10b981',
  rnb: '#d946ef',
};

const EMOTION_COLORS = {
  happy: '#fbbf24',
  sad: '#3b82f6',
  energetic: '#ef4444',
  calm: '#10b981',
  romantic: '#ec4899',
  focused: '#6366f1',
};

export default function MusicPlayer({ profile, userInfo, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [playMode, setPlayMode] = useState('synthetic'); // 'real' | 'synthetic'

  const canvasRef = useRef(null);
  const progressRef = useRef(0);
  const progressRafRef = useRef(null);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const isPlayingRef = useRef(false);
  const vizRafRef = useRef(null);
  const audioRef = useRef(null);
  const audioTrackIdRef = useRef(null);

  const summary = useMemo(() => {
    if (!profile) return null;
    return musicProfileEngine.getProfileSummary();
  }, [profile]);

  const tracks = useMemo(() => {
    if (!profile || !profile.tracks) return [];
    return profile.tracks.slice(0, 8).map((t, i) => ({
      id: t.id || i,
      name: t.name || `Track ${i + 1}`,
      artist: t.artists?.[0]?.name || 'Unknown',
      duration: t.duration || 180000,
    }));
  }, [profile]);

  const currentTrackInfo = tracks[currentTrack] || {
    name: 'Generated Music',
    artist: 'Music Profile Engine',
    duration: 240000,
  };

  const primaryColor = GENRE_COLORS[summary?.dominantGenre] || '#7c3aed';
  const emotionColor = EMOTION_COLORS[summary?.dominantEmotion] || '#7c3aed';

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // ============ 音频可视化：纯 ref 动画，不触发 React 重渲染 ============
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let rafId;
    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, 'rgba(124, 58, 237, 0.05)');
      bgGrad.addColorStop(1, 'rgba(14, 165, 233, 0.05)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      const barCount = 32;
      const gap = 3;
      const barWidth = (w - (barCount - 1) * gap) / barCount;
      const playing = isPlayingRef.current;

      for (let i = 0; i < barCount; i++) {
        const barHeight = playing
          ? 6 + Math.random() * (h * 0.75)
          : 3 + Math.random() * 5;

        const x = i * (barWidth + gap);
        const y = h - barHeight;

        const grad = ctx.createLinearGradient(x, y, x, h);
        grad.addColorStop(0, primaryColor);
        grad.addColorStop(0.5, emotionColor);
        grad.addColorStop(1, 'rgba(124, 58, 237, 0.2)');

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(x, y, barWidth, 2);
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    vizRafRef.current = rafId;
    return () => cancelAnimationFrame(rafId);
  }, [primaryColor, emotionColor]);

  // ============ 进度更新 ============
  useEffect(() => {
    if (!isPlaying) {
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
      return;
    }

    const update = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const dur = durationRef.current || 240000;
      const pct = Math.min(1, elapsed / dur);

      progressRef.current = pct;
      setProgress(pct);

      if (pct >= 1) {
        nextTrackInternal();
        return;
      }
      progressRafRef.current = requestAnimationFrame(update);
    };
    progressRafRef.current = requestAnimationFrame(update);

    return () => {
      if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    };
  }, [isPlaying]);

  const nextTrackInternal = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
    progressRef.current = 0;
    setCurrentTrack((prev) => (prev + 1) % Math.max(tracks.length, 1));
  }, [tracks.length]);

  // ============ 获取歌曲 URL ============
  const fetchAndPlay = useCallback(async (trackIndex) => {
    const track = tracks[trackIndex];
    if (!track || !track.id) {
      // 没有真实歌曲 ID，回退到合成模式
      playSynthetic();
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('netease_token');
      const result = await getSongUrl(track.id, token);

      if (result.success && result.data?.url) {
        // 成功获取 URL，使用真实音频播放
        setAudioUrl(result.data.url);
        setPlayMode('real');
        audioTrackIdRef.current = track.id;
        
        // 等待音频加载
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('音频加载超时')), 10000);
            audioRef.current.oncanplaythrough = () => {
              clearTimeout(timeout);
              resolve();
            };
            audioRef.current.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('音频加载失败'));
            };
          });
          
          audioRef.current.volume = volume;
          await audioRef.current.play();
          setIsPlaying(true);
          durationRef.current = audioRef.current.duration * 1000;
        }
      } else {
        // 获取失败，回退到合成模式
        logger.warn('获取歌曲URL失败，回退到合成模式', result.message);
        message.warning(`${track.name} 暂无版权，使用合成音`);
        playSynthetic();
      }
    } catch (err) {
      logger.error('播放失败', err.message);
      message.error('播放失败: ' + err.message);
      playSynthetic();
    } finally {
      setIsLoading(false);
    }
  }, [tracks, volume]);

  // ============ 合成音播放（回退方案） ============
  const playSynthetic = useCallback(() => {
    setPlayMode('synthetic');
    const klineData = generateMockKLineFromProfile(profile, currentTrack);
    if (klineData.length > 0) {
      startTimeRef.current =
        Date.now() - progressRef.current * (durationRef.current || 240000);
      musicEngine.setVolume(volume);
      musicEngine.play(klineData, {
        mood: summary?.avgMood || 0.5,
        industry: summary?.dominantIndustry || 'default',
      });
      durationRef.current = 240000;
      setIsPlaying(true);
    }
  }, [profile, currentTrack, volume, summary]);

  // ============ 播放/暂停 ============
  const togglePlay = useCallback(async () => {
    if (isLoading) return;

    if (isPlaying) {
      setIsPlaying(false);
      if (playMode === 'real' && audioRef.current) {
        audioRef.current.pause();
      } else {
        musicEngine.stop();
      }
    } else {
      // 尝试真实播放
      await fetchAndPlay(currentTrack);
    }
  }, [isPlaying, isLoading, playMode, currentTrack, fetchAndPlay]);

  const nextTrack = useCallback(async () => {
    setIsPlaying(false);
    setProgress(0);
    progressRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const nextIdx = (currentTrack + 1) % Math.max(tracks.length, 1);
    setCurrentTrack(nextIdx);
    // 自动播放下一首
    if (tracks[nextIdx]?.id) {
      await fetchAndPlay(nextIdx);
    }
  }, [currentTrack, tracks.length, tracks, fetchAndPlay]);

  const prevTrack = useCallback(async () => {
    setIsPlaying(false);
    setProgress(0);
    progressRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const prevIdx = Math.max(0, currentTrack - 1);
    setCurrentTrack(prevIdx);
    if (tracks[prevIdx]?.id) {
      await fetchAndPlay(prevIdx);
    }
  }, [currentTrack, tracks, fetchAndPlay]);

  // ============ QR 码生成 ============
  const generateQR = useCallback(async () => {
    try {
      const shareData = {
        t: profile?.source || 'demo',
        g: summary?.dominantGenre || 'unknown',
        e: summary?.dominantEmotion || 'unknown',
        b: summary?.avgBpm || 120,
        ts: tracks.map((t) => t.name).join('|').slice(0, 100),
        u: userInfo?.nickname || 'Guest',
      };

      const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
      const baseUrl = window.location.origin;
      const qrUrl = `${baseUrl}/player/${encoded}`;

      const dataUrl = await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: 'M',
        width: 256,
        margin: 2,
        color: { dark: '#1e1340', light: '#ffffff' },
      });

      setQrDataUrl(dataUrl);
      setShowQR(true);
      logger.session('QR generated', qrUrl);
    } catch (e) {
      message.error('QR code generation failed');
    }
  }, [profile, summary, tracks, userInfo]);

  const copyQRUrl = useCallback(async () => {
    try {
      const shareData = {
        t: profile?.source || 'demo',
        g: summary?.dominantGenre || 'unknown',
        e: summary?.dominantEmotion || 'unknown',
        b: summary?.avgBpm || 120,
        u: userInfo?.nickname || 'Guest',
      };
      const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
      const baseUrl = window.location.origin;
      await navigator.clipboard.writeText(`${baseUrl}/player/${encoded}`);
      message.success('Link copied');
    } catch (_) {}
  }, [profile, summary, userInfo]);

  const discStyle = {
    background: `conic-gradient(from 0deg, ${primaryColor}, ${emotionColor}, ${primaryColor})`,
    boxShadow: `0 0 60px ${primaryColor}40, inset 0 0 30px rgba(0,0,0,0.3)`,
  };

  const formatTime = (pct, duration) => {
    const total = duration || 240;
    const sec = Math.floor(total * pct);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="music-player-container">
      <Card className="music-player-card glass-card">
        <div className="player-header">
          <div className="player-disc-wrapper">
            <div
              className={`player-disc ${isPlaying ? 'playing' : ''}`}
              style={discStyle}
            >
              <div className="player-disc-inner">
                <AudioOutlined style={{ fontSize: 32, color: '#fff' }} />
              </div>
              <div className="disc-ring disc-ring-1" />
              <div className="disc-ring disc-ring-2" />
              <div className="disc-ring disc-ring-3" />
            </div>
            {isPlaying && (
              <div className="player-glow" style={{ background: primaryColor }} />
            )}
          </div>

          <div className="player-info">
            <Tag color="purple" style={{ marginBottom: 8 }}>
              <SoundOutlined /> {summary?.dominantGenre || 'Unknown'}
            </Tag>
            <Title level={5} style={{ margin: 0, color: '#fff' }}>
              {currentTrackInfo.name}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {currentTrackInfo.artist}
            </Text>

            <div className="player-visualizer">
              <canvas
                ref={canvasRef}
                width={320}
                height={60}
                style={{ width: '100%', height: 60 }}
              />
            </div>

            <div className="player-progress">
              <span className="time-label">
                {formatTime(progress, currentTrackInfo.duration / 1000)}
              </span>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${progress * 100}%`,
                    background: `linear-gradient(90deg, ${primaryColor}, ${emotionColor})`,
                    boxShadow: isPlaying ? `0 0 10px ${primaryColor}` : 'none',
                  }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(progress * 100)}
                  onChange={(e) => {
                    const pct = e.target.value / 100;
                    setProgress(pct);
                    progressRef.current = pct;
                    startTimeRef.current =
                      Date.now() - pct * (durationRef.current || 240000);
                  }}
                  className="progress-input"
                />
              </div>
              <span className="time-label">
                {formatTime(1, currentTrackInfo.duration / 1000)}
              </span>
            </div>
          </div>
        </div>

        <div className="player-controls">
          <Space size="large" align="center">
            <Tooltip title="Previous">
              <Button
                shape="circle"
                icon={<LeftOutlined />}
                onClick={prevTrack}
                className="ctrl-btn"
              />
            </Tooltip>

            <Button
              shape="circle"
              size="large"
              icon={
                isPlaying ? (
                  <PauseCircleFilled style={{ fontSize: 36 }} />
                ) : (
                  <PlayCircleFilled style={{ fontSize: 36 }} />
                )
              }
              onClick={togglePlay}
              className="play-btn"
            />

            <Tooltip title="Next">
              <Button
                shape="circle"
                icon={<RightOutlined />}
                onClick={nextTrack}
                className="ctrl-btn"
              />
            </Tooltip>

            <div className="divider" />

            <Space>
              <SoundOutlined style={{ color: 'rgba(255,255,255,0.6)' }} />
              <Slider
                value={Math.round(volume * 100)}
                onChange={(v) => {
                  setVolume(v / 100);
                  musicEngine.setVolume(v / 100);
                  if (audioRef.current) {
                    audioRef.current.volume = v / 100;
                  }
                }}
                style={{ width: 80 }}
                tooltip={{ formatter: (v) => `${v}%` }}
              />
            </Space>

            <div className="divider" />

            <Tooltip title="Scan to listen on mobile">
              <Button
                icon={<QrcodeOutlined style={{ fontSize: 20 }} />}
                onClick={generateQR}
                className="qr-btn"
              />
            </Tooltip>

            {onClose && (
              <Tooltip title="Close">
                <Button onClick={onClose} className="ctrl-btn">
                  Close
                </Button>
              </Tooltip>
            )}
          </Space>
        </div>

        {tracks.length > 1 && (
          <div className="player-tracks">
            {tracks.map((t, i) => (
              <div
                key={t.id}
                className={`track-item ${i === currentTrack ? 'active' : ''}`}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentTrack(i);
                  setProgress(0);
                }}
              >
                <div className="track-num">
                  {i === currentTrack && isPlaying ? '♪' : i + 1}
                </div>
                <div className="track-info">
                  <span className="track-name">{t.name}</span>
                  <span className="track-artist">{t.artist}</span>
                </div>
                {i === currentTrack && (
                  <div className="track-wave">
                    {[...Array(4)].map((_, idx) => (
                      <span key={idx} className="wave-bar" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={showQR}
        onCancel={() => setShowQR(false)}
        footer={null}
        width={340}
        centered
        className="qr-modal"
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <QrcodeOutlined style={{ fontSize: 32, color: primaryColor }} />
          <Title level={5} style={{ marginTop: 8 }}>
            Scan to Listen
          </Title>
          <Text
            type="secondary"
            style={{ fontSize: 12, display: 'block', marginBottom: 16 }}
          >
            Scan the QR code with your phone to enjoy your music profile on mobile
          </Text>

          {qrDataUrl && (
            <div className="qr-image-wrapper">
              <img
                src={qrDataUrl}
                alt="QR Code"
                style={{ width: 220, height: 220, borderRadius: 12 }}
              />
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Button onClick={copyQRUrl} icon={<ReloadOutlined />}>
              Copy Link
            </Button>
          </div>

          <Text
            type="secondary"
            style={{ fontSize: 11, marginTop: 12, display: 'block' }}
          >
            Tip: The link contains your music profile data for sharing
          </Text>
        </div>
      </Modal>

      {/* 真实音频元素 */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={(e) => {
          const audio = e.target;
          if (audio.duration > 0) {
            const pct = audio.currentTime / audio.duration;
            setProgress(pct);
            progressRef.current = pct;
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          // 自动播放下一首
          const nextIdx = (currentTrack + 1) % Math.max(tracks.length, 1);
          setCurrentTrack(nextIdx);
          if (tracks[nextIdx]?.id) {
            fetchAndPlay(nextIdx);
          } else {
            playSynthetic();
          }
        }}
        onError={() => {
          logger.warn('音频播放错误，回退到合成模式');
          playSynthetic();
        }}
        style={{ display: 'none' }}
      />

      {/* 加载状态 */}
      {isLoading && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
          }}
        >
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />}
            tip="正在获取歌曲..."
          />
        </div>
      )}
    </div>
  );
}

function generateMockKLineFromProfile(profile, trackIdx) {
  const data = [];
  const basePrice = 100 + trackIdx * 20;
  const seed = (trackIdx + 1) * 7;

  for (let i = 0; i < 50; i++) {
    const change =
      Math.sin(i * 0.3 + seed) * 5 + Math.cos(i * 0.1 + seed) * 3;
    data.push({
      time: Date.now() - (50 - i) * 60000,
      open: basePrice + change,
      close: basePrice + change + Math.random() * 3 - 1.5,
      high: basePrice + change + 5,
      low: basePrice + change - 5,
      volume: Math.floor(1000 + Math.random() * 5000),
    });
  }
  return data;
}
