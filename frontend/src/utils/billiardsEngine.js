/**
 * 台球模拟引擎
 *
 * 功能：
 * - 球台布局生成
 * - 碰撞物理模拟（简化版）
 * - 折射角度计算
 * - 路径偏差计算
 * - 偏差标签生成
 * - 心情盘生成
 *
 * 所有坐标基于：
 * - 球台内沿：800 x 400 (单位：像素)
 * - 球半径：12px
 */

import { logger } from './logger';

// ============= 球台常量 =============

export const TABLE = {
  width: 800,
  height: 400,
  cushion: 24,       // 库边宽度
  ballRadius: 12,     // 球半径
  pocketRadius: 20,   // 袋口半径
  friction: 0.985,    // 摩擦系数
  minVelocity: 0.1,   // 最小速度（低于此值视为停止）
};

// 六个袋口位置（球台内沿坐标）
export const POCKETS = [
  { x: 0, y: 0, name: '左上袋' },
  { x: TABLE.width / 2, y: 0, name: '上中袋' },
  { x: TABLE.width, y: 0, name: '右上袋' },
  { x: 0, y: TABLE.height, name: '左下袋' },
  { x: TABLE.width / 2, y: TABLE.height, name: '下中袋' },
  { x: TABLE.width, y: TABLE.height, name: '右下袋' },
];

// ============= 工具函数 =============

const distance = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

const angleBetween = (from, to) => Math.atan2(to.y - from.y, to.x - from.x);

const normalizeAngle = (deg) => {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
};

// ============= 球局生成 =============

/**
 * 生成一局球的初始布局
 * @returns {{ cueBall: Object, targetBalls: Object[] }}
 */
export function generateRack(difficulty = 'easy') {
  const W = TABLE.width;
  const H = TABLE.height;
  const R = TABLE.ballRadius;

  // 母球：左半边随机
  const cueBall = {
    id: 0,
    x: W * 0.25 + (Math.random() - 0.5) * 100,
    y: H * 0.5 + (Math.random() - 0.5) * 100,
    vx: 0,
    vy: 0,
    isPocketed: false,
    isCue: true,
    color: '#ffffff'
  };

  // 目标球数量
  const targetCount = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  const targetBalls = [];
  const colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6'];

  for (let i = 0; i < targetCount; i++) {
    // 目标球放在右半边
    targetBalls.push({
      id: i + 1,
      x: W * 0.55 + Math.random() * (W * 0.35),
      y: H * 0.2 + Math.random() * (H * 0.6),
      vx: 0,
      vy: 0,
      isPocketed: false,
      isCue: false,
      color: colors[i % colors.length],
      number: i + 1
    });
  }

  logger.session('生成球局', `难度:${difficulty} 目标球:${targetCount}`);
  return { cueBall, targetBalls };
}

// ============= 瞄准预测 =============

/**
 * 计算瞄准路径和预期折射
 * @param {Object} cueBall 母球
 * @param {Object} targetBall 目标球
 * @param {number} angleDeg 瞄准角度（度，0=向右）
 * @param {number} power 力度（1-100）
 * @returns {{ aimLine: Object, expectedReflection: Object, expectedLanding: Object }}
 */
export function calculateAimPrediction(cueBall, targetBall, angleDeg, power) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const speed = power * 0.08; // 力度→速度

  // 瞄准线：从母球出发，沿瞄准方向
  const aimEnd = {
    x: cueBall.x + Math.cos(angleRad) * 600,
    y: cueBall.y + Math.sin(angleRad) * 600
  };

  // 计算与目标球的碰撞点
  // 用参数方程：射线与圆的交点
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  const fx = cueBall.x - targetBall.x;
  const fy = cueBall.y - targetBall.y;
  const r = TABLE.ballRadius * 2;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;

  const discriminant = b * b - 4 * a * c;

  let contactPoint = null;
  let expectedLanding = null;
  let expectedReflectionAngle = null;

  if (discriminant >= 0) {
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (t > 0) {
      // 碰撞点（母球中心位置）
      contactPoint = {
        x: cueBall.x + dx * t,
        y: cueBall.y + dy * t
      };

      // 目标球预期落点：沿碰撞方向延伸
      const hitAngle = angleBetween(contactPoint, targetBall);
      const travelDist = speed * 30;
      expectedLanding = {
        x: targetBall.x + Math.cos(hitAngle) * travelDist,
        y: targetBall.y + Math.sin(hitAngle) * travelDist
      };

      // 母球预期折射角度：垂直于碰撞方向
      // 简化：入射角 = 反射角
      const normalAngle = hitAngle; // 法线方向
      const incomingAngle = angleDeg;
      const reflectRad = 2 * normalAngle - (incomingAngle * Math.PI) / 180 + Math.PI;
      expectedReflectionAngle = normalizeAngle((reflectRad * 180) / Math.PI);
    }
  }

  // 如果没有碰撞，预期落点就是瞄准线末端
  if (!expectedLanding) {
    expectedLanding = aimEnd;
    expectedReflectionAngle = normalizeAngle(angleDeg + 180);
  }

  return {
    aimLine: { start: { x: cueBall.x, y: cueBall.y }, end: aimEnd },
    contactPoint,
    expectedLanding,
    expectedReflectionAngle,
    willHit: !!contactPoint
  };
}

// ============= 物理模拟 =============

/**
 * 模拟一次击球的完整过程
 * 返回每一帧的球状态，用于动画播放
 */
export function simulateShot(cueBall, targetBalls, angleDeg, power) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const speed = power * 0.08;

  // 克隆球数据
  const cue = { ...cueBall, vx: Math.cos(angleRad) * speed, vy: Math.sin(angleRad) * speed };
  const targets = targetBalls.map(b => ({ ...b }));
  const allBalls = [cue, ...targets];

  const frames = [];
  const maxFrames = 300;
  let actualReflectionAngle = null;
  let contactFrame = -1;

  for (let frame = 0; frame < maxFrames; frame++) {
    // 移动球
    for (const ball of allBalls) {
      if (ball.isPocketed) continue;
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vx *= TABLE.friction;
      ball.vy *= TABLE.friction;

      // 速度太小就停止
      if (Math.abs(ball.vx) < TABLE.minVelocity) ball.vx = 0;
      if (Math.abs(ball.vy) < TABLE.minVelocity) ball.vy = 0;

      // 库边反弹
      const R = TABLE.ballRadius;
      if (ball.x - R < 0) { ball.x = R; ball.vx = -ball.vx * 0.8; }
      if (ball.x + R > TABLE.width) { ball.x = TABLE.width - R; ball.vx = -ball.vx * 0.8; }
      if (ball.y - R < 0) { ball.y = R; ball.vy = -ball.vy * 0.8; }
      if (ball.y + R > TABLE.height) { ball.y = TABLE.height - R; ball.vy = -ball.vy * 0.8; }

      // 进袋检测
      for (const pocket of POCKETS) {
        if (distance(ball, pocket) < TABLE.pocketRadius) {
          ball.isPocketed = true;
          ball.x = -100; ball.y = -100;
          ball.vx = 0; ball.vy = 0;
          break;
        }
      }
    }

    // 球与球碰撞检测
    for (let i = 0; i < allBalls.length; i++) {
      for (let j = i + 1; j < allBalls.length; j++) {
        const a = allBalls[i];
        const b = allBalls[j];
        if (a.isPocketed || b.isPocketed) continue;

        const dist = distance(a, b);
        const minDist = TABLE.ballRadius * 2;

        if (dist < minDist && dist > 0) {
          // 记录母球第一次碰撞
          if (contactFrame === -1 && (a.isCue || b.isCue)) {
            contactFrame = frame;
            // 计算实际折射角度
            const cueB = a.isCue ? a : b;
            if (cueB) {
              actualReflectionAngle = normalizeAngle(
                (Math.atan2(cueB.vy, cueB.vx) * 180) / Math.PI
              );
            }
          }

          // 简化弹性碰撞
          const nx = (b.x - a.x) / dist;
          const ny = (b.y - a.y) / dist;
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const p = 2 * (dvx * nx + dvy * ny) / 2;

          a.vx -= p * nx;
          a.vy -= p * ny;
          b.vx += p * nx;
          b.vy += p * ny;

          // 分离重叠
          const overlap = minDist - dist;
          a.x -= (overlap / 2) * nx;
          a.y -= (overlap / 2) * ny;
          b.x += (overlap / 2) * nx;
          b.y += (overlap / 2) * ny;
        }
      }
    }

    // 保存这一帧
    frames.push({
      cue: { x: cue.x, y: cue.y, isPocketed: cue.isPocketed },
      targets: targets.map(t => ({ x: t.x, y: t.y, isPocketed: t.isPocketed, id: t.id }))
    });

    // 检查是否全部停止
    const allStopped = allBalls.every(b =>
      b.isPocketed || (Math.abs(b.vx) < 0.01 && Math.abs(b.vy) < 0.01)
    );
    if (allStopped && frame > 20) break;
  }

  // 实际落点（目标球最终位置）
  const actualLanding = targets[0]?.isPocketed
    ? { x: -1, y: -1, isPocketed: true }
    : { x: targets[0]?.x || 0, y: targets[0]?.y || 0, isPocketed: false };

  // 如果没有碰撞记录，用最终角度
  if (actualReflectionAngle === null) {
    actualReflectionAngle = normalizeAngle(
      (Math.atan2(cue.vy || 0.001, cue.vx || 0.001) * 180) / Math.PI
    );
  }

  return {
    frames,
    actualLanding,
    actualReflectionAngle,
    cuePocketed: cue.isPocketed,
    allTargetsPocketed: targets.every(t => t.isPocketed),
    pocketedCount: targets.filter(t => t.isPocketed).length
  };
}

// ============= 偏差计算 =============

/**
 * 计算偏差值和偏差等级
 */
export function calculateDeviation(expected, actual, expectedReflection, actualReflection) {
  // 路径偏差（归一化到 0-1）
  let pathDeviation = 0;
  if (expected && actual && !actual.isPocketed && actual.x >= 0) {
    const dist = distance(expected, actual);
    pathDeviation = Math.min(1, dist / (TABLE.width * 0.5));
  }

  // 折射偏差（度）
  let reflectionDeviation = 0;
  if (expectedReflection !== null && actualReflection !== null) {
    let diff = Math.abs(expectedReflection - actualReflection);
    if (diff > 180) diff = 360 - diff;
    reflectionDeviation = diff;
  }

  // 偏差等级
  let deviationLevel;
  if (reflectionDeviation < 5) deviationLevel = '精准';
  else if (reflectionDeviation < 15) deviationLevel = '偏差';
  else deviationLevel = '失控';

  return {
    pathDeviation: +pathDeviation.toFixed(3),
    reflectionDeviation: +reflectionDeviation.toFixed(1),
    deviationLevel
  };
}

// ============= 标签生成 =============

/**
 * 根据折射偏差生成偏差标签
 */
export function generateDeviationTag(reflectionDeviation) {
  if (reflectionDeviation < 3) return { label: '路径预判大师', personality: '高J', industry: '金融' };
  if (reflectionDeviation < 10) return { label: '走位合理', personality: '平衡型', industry: '消费' };
  if (reflectionDeviation < 20) return { label: '走位偏差', personality: '高P', industry: '能源' };
  return { label: '路径感知薄弱', personality: '低空间感知', industry: '科技' };
}

/**
 * 生成整局的心情盘数据
 */
export function generateBilliardsMood(shots) {
  if (!shots || shots.length === 0) {
    return { mood: 50, volatility: 0.05, industry: '金融', summary: '暂无数据' };
  }

  const pocketed = shots.filter(s => s.isPocketed).length;
  const avgDeviation = shots.reduce((a, s) => a + (s.reflectionDeviation || 0), 0) / shots.length;
  const avgAimTime = shots.reduce((a, s) => a + (s.aimDuration || 0), 0) / shots.length;
  const offensiveRatio = shots.filter(s => s.shotType === 'offensive').length / shots.length;

  // 情绪值：进球率影响
  const pocketRate = pocketed / shots.length;
  const mood = Math.round(30 + pocketRate * 50 - avgDeviation * 0.5);

  // 波动率：偏差越大波动越大
  const volatility = 0.03 + avgDeviation * 0.005;

  // 行业映射：根据平均偏差
  let industry = '金融';
  if (avgDeviation < 5) industry = '金融';
  else if (avgDeviation < 12) industry = '消费';
  else if (avgDeviation < 20) industry = '能源';
  else industry = '科技';

  const deviationTrend = shots.length >= 3
    ? (shots[shots.length - 1].reflectionDeviation < shots[0].reflectionDeviation ? 'improving' :
       shots[shots.length - 1].reflectionDeviation > shots[0].reflectionDeviation + 5 ? 'worsening' : 'stable')
    : 'stable';

  logger.session('台球心情盘生成', {
    击球数: shots.length,
    进球: pocketed,
    平均偏差: avgDeviation.toFixed(1),
    情绪: mood,
    行业: industry
  });

  return {
    mood: Math.max(0, Math.min(100, mood)),
    volatility: +volatility.toFixed(4),
    industry,
    pocketed,
    totalShots: shots.length,
    avgDeviation: +avgDeviation.toFixed(1),
    avgAimTime: +avgAimTime.toFixed(1),
    offensiveRatio: +offensiveRatio.toFixed(2),
    deviationTrend,
    summary: `${shots.length}杆·进${pocketed}球·平均偏差${avgDeviation.toFixed(1)}°`
  };
}

// ============= 数据结构 =============

/**
 * 创建一次击球记录
 */
export function createShotRecord(data) {
  return {
    shotId: Date.now(),
    timestamp: Date.now(),
    aimAngle: data.aimAngle || 0,
    aimPower: data.aimPower || 50,
    adjustmentCount: data.adjustmentCount || 0,
    aimDuration: data.aimDuration || 0,
    expectedLanding: data.expectedLanding || { x: 0, y: 0 },
    actualLanding: data.actualLanding || { x: 0, y: 0 },
    deviation: data.deviation || 0,
    isPocketed: data.isPocketed || false,
    shotType: data.shotType || 'offensive',
    expectedReflectionAngle: data.expectedReflectionAngle || 0,
    actualReflectionAngle: data.actualReflectionAngle || 0,
    reflectionDeviation: data.reflectionDeviation || 0,
    deviationLevel: data.deviationLevel || '精准'
  };
}

export const billiardsEngine = {
  generateRack,
  calculateAimPrediction,
  simulateShot,
  calculateDeviation,
  generateDeviationTag,
  generateBilliardsMood,
  createShotRecord
};
