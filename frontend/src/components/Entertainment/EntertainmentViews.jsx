import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Input,
  Progress,
  Slider,
} from 'antd';
import {
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  DeleteOutlined,
  SaveOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateRightOutlined,
} from '@ant-design/icons';
import {
  getRandomStoryFragment,
  getRandomMusicStyle,
  getDoodlePalette,
  generateStars,
  STAR_CONSTELLATIONS,
} from '../../utils/entertainmentEngine';
import { musicEngine } from '../../utils/musicEngine';
import { storage } from '../../utils/storage';
import '../../pages/EntertainmentPage.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ============= 导出所有视图 =============
export const EntertainmentViews = ({ mode, onInteraction, session, onExit }) => {
  return (
    <div style={{ flex: 1 }}>
      {mode === 'music' && <MusicWanderer onInteraction={onInteraction} />}
      {mode === 'story' && <StoryDrift onInteraction={onInteraction} />}
      {mode === 'doodle' && <PixelDoodle onInteraction={onInteraction} />}
      {mode === 'starmap' && <StarMapWanderer onInteraction={onInteraction} />}
      {mode === 'write' && <FreeWriting onInteraction={onInteraction} />}
      {mode === 'silence' && <BlankSilence onInteraction={onInteraction} onExit={onExit} />}
    </div>
  );
};

// ============= 1. 🎵 音乐漫游 =============
const MusicWanderer = ({ onInteraction }) => {
  const [currentStyle, setCurrentStyle] = useState(() => getRandomMusicStyle());
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    if (isPlaying) {
      musicEngine.stop();
      setIsPlaying(false);
    } else {
      const config = musicEngine.inferConfigFromData({
        volatility: 0.3,
        trend: 0,
        avgPrice: 50,
        volume: 50,
      });
      musicEngine.play({
        ...config,
        bpm: currentStyle.bpmRange[0] + Math.random() * (currentStyle.bpmRange[1] - currentStyle.bpmRange[0]),
      });
      setIsPlaying(true);
    }
    onInteraction({ type: 'play_toggle', value: !isPlaying, timestamp: Date.now() });
  };

  const handleNext = () => {
    setCurrentStyle(getRandomMusicStyle());
    onInteraction({ type: 'skip', timestamp: Date.now() });
    if (isPlaying) {
      musicEngine.stop();
      setTimeout(() => handlePlay(), 200);
    }
  };

  const handleStay = () => {
    onInteraction({ type: 'stay', timestamp: Date.now() });
  };

  return (
    <div className="music-wanderer">
      <div className="music-wanderer-emoji">🎵</div>
      <Title level={3} className="music-wanderer-title">音乐漫游中</Title>
      <Text type="secondary" className="music-wanderer-style">当前风格：{currentStyle.name}</Text>
      <Space className="music-wanderer-buttons" wrap>
        <Button type="primary" size="large" icon={isPlaying ? <PauseOutlined /> : <PlayCircleOutlined />} onClick={handlePlay}>
          {isPlaying ? '暂停' : '播放'}
        </Button>
        <Button size="large" icon={<RightOutlined />} onClick={handleNext}>下一首</Button>
        <Button size="large" onClick={handleStay}>停留</Button>
      </Space>
      <div className="music-wanderer-tags">
        <Tag color="purple">无歌单</Tag>
        <Tag color="blue">可跳过</Tag>
        <Tag color="green">可停留</Tag>
      </div>
    </div>
  );
};

// ============= 2. 📖 故事漂流 =============
const StoryDrift = ({ onInteraction }) => {
  const [fragment, setFragment] = useState(() => getRandomStoryFragment(-1));
  const [readCount, setReadCount] = useState(0);

  const handleNext = () => {
    const newFragment = getRandomStoryFragment(fragment.index);
    setFragment(newFragment);
    setReadCount((c) => c + 1);
    onInteraction({ type: 'next_story', timestamp: Date.now() });
  };

  const handleStay = () => {
    onInteraction({ type: 'stay_story', timestamp: Date.now() });
  };

  return (
    <div className="story-drift">
      <div className="story-drift-header">
        <div className="story-drift-emoji">📖</div>
        <Tag color="blue">已读 {readCount} 段</Tag>
      </div>
      <Card className="story-fragment-card">
        <Paragraph className="story-fragment-text">
          "{fragment.text}"
        </Paragraph>
      </Card>
      <div className="story-drift-actions">
        <Space wrap>
          <Button type="primary" size="large" icon={<RightOutlined />} onClick={handleNext}>
            下一段
          </Button>
          <Button size="large" onClick={handleStay}>再品一品</Button>
        </Space>
      </div>
      <div className="story-drift-tags">
        <Tag color="purple">无情节</Tag>
        <Tag color="blue">可跳过</Tag>
        <Tag color="green">可停留</Tag>
      </div>
    </div>
  );
};

// ============= 3. 🎨 像素涂鸦 =============
const PixelDoodle = ({ onInteraction }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [emotion, setEmotion] = useState(50);
  const [pixelSize, setPixelSize] = useState(8);
  const palette = useMemo(() => getDoodlePalette(emotion), [emotion]);
  const [currentColor, setCurrentColor] = useState(palette[0]);

  useEffect(() => {
    setCurrentColor(palette[0]);
  }, [palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const y = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    return {
      x: Math.floor((x - rect.left) / pixelSize) * pixelSize,
      y: Math.floor((y - rect.top) / pixelSize) * pixelSize,
    };
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasPos(e);
    ctx.fillStyle = currentColor;
    ctx.fillRect(pos.x, pos.y, pixelSize, pixelSize);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onInteraction({ type: 'clear_canvas', timestamp: Date.now() });
  };

  return (
    <div className="pixel-doodle">
      <div className="pixel-doodle-header">
        <Text type="secondary">心情调色板 · 滑动改变情绪</Text>
        <Slider
          min={0}
          max={100}
          value={emotion}
          onChange={setEmotion}
          marks={{ 0: '😢', 50: '😐', 100: '😄' }}
          tooltip={{ formatter: (v) => `情绪: ${v}` }}
        />
      </div>

      <div className="pixel-doodle-palette">
        {palette.map((color, i) => (
          <div
            key={i}
            onClick={() => setCurrentColor(color)}
            className={`pixel-doodle-color-swatch ${currentColor === color ? 'active' : ''}`}
            style={{ background: color, color: color }}
          />
        ))}
      </div>

      <div className="pixel-doodle-size-row">
        <Text type="secondary" className="pixel-doodle-size-label">像素大小:</Text>
        <Tag color="purple">{pixelSize}px</Tag>
        <Slider
          min={4}
          max={24}
          value={pixelSize}
          onChange={setPixelSize}
        />
      </div>

      <div className="pixel-doodle-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={560}
          height={400}
          className="pixel-doodle-canvas"
          onMouseDown={(e) => { setIsDrawing(true); draw(e); }}
          onMouseMove={draw}
          onMouseUp={() => setIsDrawing(false)}
          onMouseLeave={() => setIsDrawing(false)}
          onTouchStart={(e) => { setIsDrawing(true); draw(e); }}
          onTouchMove={draw}
          onTouchEnd={() => setIsDrawing(false)}
        />
      </div>

      <div className="pixel-doodle-actions">
        <Space>
          <Button icon={<DeleteOutlined />} onClick={handleClear}>清空画布</Button>
        </Space>
        <div className="pixel-doodle-tags">
          <Tag color="purple">无目标</Tag>
          <Tag color="blue">无对错</Tag>
          <Tag color="green">颜色随心情</Tag>
        </div>
      </div>
    </div>
  );
};

// ============= 4. 🌌 星图漫游 =============
const StarMapWanderer = ({ onInteraction }) => {
  const [stars] = useState(() => generateStars(80));
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(null);

  const handleZoomIn = () => {
    setZoom((z) => Math.min(3, z + 0.3));
    onInteraction({ type: 'zoom_in', timestamp: Date.now() });
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.5, z - 0.3));
    onInteraction({ type: 'zoom_out', timestamp: Date.now() });
  };

  const handleRotate = () => {
    setRotation((r) => r + 30);
    onInteraction({ type: 'rotate', timestamp: Date.now() });
  };

  return (
    <div className="starmap-wanderer">
      <div className="starmap-controls">
        <Space>
          <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
          <Tag color="purple">缩放: {zoom.toFixed(1)}x</Tag>
          <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
          <Button icon={<RotateRightOutlined />} onClick={handleRotate}>
            旋转
          </Button>
        </Space>
      </div>

      <div className="starmap-viewport">
        <div
          className="starmap-content"
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
        >
          {stars.map((star) => (
            <div
              key={star.id}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(null)}
              className={`starmap-star ${star.constellation ? 'constellation' : 'normal'}`}
              style={{
                left: `${star.x * 100}%`,
                top: `${star.y * 100}%`,
                width: star.size * 2,
                height: star.size * 2,
                animationDuration: `${star.twinkleSpeed}s`,
              }}
            />
          ))}
        </div>

        {hoveredStar && hoveredStar.constellation && (
          <div className="starmap-constellation-label">
            <Text>✨ {hoveredStar.constellation}</Text>
          </div>
        )}
      </div>

      <div className="starmap-footer">
        <Text type="secondary">
          共 {stars.length} 颗星星 · {stars.filter((s) => s.constellation).length} 个星座标记
        </Text>
        <div className="starmap-tags">
          <Tag color="purple">无目标</Tag>
          <Tag color="blue">无终点</Tag>
          <Tag color="green">可缩放可旋转</Tag>
        </div>
      </div>
    </div>
  );
};

// ============= 5. 📝 自由书写 =============
const FreeWriting = ({ onInteraction }) => {
  const [content, setContent] = useState('');
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    setCharCount(content.length);
  }, [content]);

  const handleDelete = () => {
    setContent('');
    onInteraction({ type: 'delete_content', timestamp: Date.now() });
  };

  const handleSave = () => {
    if (!content.trim()) return;
    try {
      const data = storage.get() || {};
      const stories = data.stories || [];
      stories.push({
        id: `story_${Date.now()}`,
        type: 'freewrite',
        content,
        timestamp: Date.now(),
        charCount,
      });
      storage.set({ ...data, stories });
    } catch (e) {
      console.error('保存失败', e);
    }
    onInteraction({ type: 'save_story', charCount, timestamp: Date.now() });
  };

  return (
    <div className="free-writing">
      <div className="free-writing-header">
        <div className="free-writing-emoji">📝</div>
        <Tag color="green">{charCount} 字</Tag>
      </div>

      <TextArea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="随意写点什么吧... 可以是心情、想法、碎碎念，什么都可以。不存档、不评判，只是此刻的你。"
        rows={12}
        className="free-writing-textarea"
      />

      <div className="free-writing-actions">
        <Space>
          <Button icon={<DeleteOutlined />} onClick={handleDelete} danger>全部删除</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} disabled={!content.trim()}>
            存入故事集
          </Button>
        </Space>
      </div>

      <div className="free-writing-tags">
        <Tag color="purple">随意输入</Tag>
        <Tag color="blue">默认不存档</Tag>
        <Tag color="green">可删除可保留</Tag>
      </div>
    </div>
  );
};

// ============= 6. 🧘 空白静置 =============
const BlankSilence = ({ onInteraction, onExit }) => {
  const TOTAL_SECONDS = 180; // 3分钟
  const [remaining, setRemaining] = useState(TOTAL_SECONDS);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          setIsActive(false);
          onInteraction({ type: 'silence_complete', timestamp: Date.now() });
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive, onInteraction]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = ((TOTAL_SECONDS - remaining) / TOTAL_SECONDS) * 100;

  return (
    <div className="blank-silence">
      <div className="blank-silence-emoji">🧘</div>

      <div className="blank-silence-timer">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>

      <div className="blank-silence-progress">
        <Progress
          percent={progress}
          showInfo={false}
          strokeColor={{
            '0%': '#a78bfa',
            '100%': '#ec4899',
          }}
          strokeWidth={4}
        />
      </div>

      <Text type="secondary" className="blank-silence-desc">
        什么都不用做，什么都不用想。
        <br />
        就让时间这样静静流过。
      </Text>

      <div className="blank-silence-actions">
        {remaining === 0 ? (
          <Button type="primary" size="large" onClick={() => onExit('timeout')}>
            完成静置
          </Button>
        ) : (
          <Button onClick={() => {
            onInteraction({ type: 'early_exit', remaining, timestamp: Date.now() });
            onExit('manual');
          }}>
            提前离开
          </Button>
        )}
      </div>

      <div className="blank-silence-tags">
        <Tag color="purple">纯计时</Tag>
        <Tag color="blue">无交互</Tag>
        <Tag color="green">3分钟</Tag>
      </div>
    </div>
  );
};
