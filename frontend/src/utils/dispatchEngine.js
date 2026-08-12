/**
 * 无人机调度引擎（三层输出）
 *
 * 模式：
 *   single     - 单机调度（基础版）
 *   logistics  - 物流供应链
 *   emergency  - 应急灾害
 *
 * 映射关系：
 *   行为采集 → 飞行状态采集
 *   20人基准库 → 调度策略库（三套）
 *   人格映射 → 状态→策略映射
 *   DNA报告 → 调度方案输出
 */

import { logger } from './logger';

// ============= 模式常量 =============
export const DISPATCH_MODES = {
  SINGLE: 'single',
  LOGISTICS: 'logistics',
  EMERGENCY: 'emergency',
};

export const DISPATCH_MODE_LABELS = {
  [DISPATCH_MODES.SINGLE]: { label: '单机调度', emoji: '🚁', description: '单无人机航线规划' },
  [DISPATCH_MODES.LOGISTICS]: { label: '物流供应链', emoji: '📦', description: '多机协同、仓储配送' },
  [DISPATCH_MODES.EMERGENCY]: { label: '应急灾害', emoji: '🔥', description: '灾害响应、救援调度' },
};

// ============= 模式一：单机调度策略库 =============
const SINGLE_STRATEGIES = [
  {
    id: 'priority-delivery',
    name: '优先配送型',
    emoji: '⚡',
    type: '速度型',
    description: '电量充足、天气良好时，最短路径最快送达',
    condition: (s) => s.battery > 60 && s.windSpeed < 5 && s.obstacleDistance > 100,
    coreLogic: '最短路径算法 + 最大速度巡航',
    action: (s) => ({
      instruction: '保持航线，加速至 15 m/s',
      altitude: Math.min(s.altitude + 10, 120),
      speed: 15,
      heading: '保持当前航向',
      remark: '电量充足，优先保证时效性',
      priority: 'medium',
      estimatedTime: 8,
    }),
  },
  {
    id: 'energy-saving',
    name: '节能模式型',
    emoji: '🌱',
    type: '平衡型',
    description: '电量中等、距离较远时，平衡速度与功耗',
    condition: (s) => s.battery >= 20 && s.battery <= 60,
    coreLogic: '动态速度调节 + 高度优化减少风阻',
    action: (s) => ({
      instruction: '降低速度至 10 m/s，延长续航',
      altitude: 80,
      speed: 10,
      heading: '微调航向利用顺风',
      remark: '中等电量，优先保证到达目的地',
      priority: 'medium',
      estimatedTime: 15,
    }),
  },
  {
    id: 'obstacle-avoidance',
    name: '避障优先型',
    emoji: '🛡️',
    type: '安全型',
    description: '障碍物密集区，绕行优先速度次之',
    condition: (s) => s.obstacleDistance < 50 || s.windSpeed >= 8,
    coreLogic: '超声波避障 + 动态路径重规划',
    action: (s) => {
      const direction = s.obstacleDistance < 30 ? '向右偏航 45°' : '向右偏航 30°';
      return {
        instruction: `${direction}，绕过障碍物`,
        altitude: s.altitude + 20,
        speed: Math.max(s.speed - 3, 5),
        heading: direction,
        remark: `障碍物距离${s.obstacleDistance}m，优先保证飞行安全`,
        priority: 'high',
        estimatedTime: 12,
      };
    },
  },
  {
    id: 'emergency-landing',
    name: '应急降落型',
    emoji: '🆘',
    type: '应急型',
    description: '电量不足或强风时，寻找最近安全降落点',
    condition: (s) => s.battery < 20 || s.windSpeed >= 12,
    coreLogic: '紧急降落算法 + 最近安全点搜索',
    action: (s) => {
      const reason = s.battery < 20 ? `电量仅 ${s.battery}%` : `风速达 ${s.windSpeed} m/s`;
      return {
        instruction: `立即降落在最近安全点（坐标 N39.9° E116.4°）`,
        altitude: 0,
        speed: 2,
        heading: '朝向最近安全点',
        remark: `${reason}，触发应急降落`,
        priority: 'high',
        estimatedTime: 3,
      };
    },
  },
  {
    id: 'cruise-mode',
    name: '稳定巡航型',
    emoji: '✈️',
    type: '稳定型',
    description: '条件适中时，保持稳定飞行',
    condition: () => true,
    coreLogic: 'PID 稳定控制 + 标准巡航高度',
    action: (s) => ({
      instruction: '保持当前参数稳定飞行',
      altitude: 100,
      speed: s.speed || 8,
      heading: '保持当前航向',
      remark: '条件适中，稳定巡航',
      priority: 'low',
      estimatedTime: 20,
    }),
  },
];

// ============= 模式二：物流供应链策略库 =============
const LOGISTICS_STRATEGIES = [
  {
    id: 'inventory-transfer',
    name: '库存调拨型',
    emoji: '🔄',
    type: '优化型',
    description: 'A仓库存高，B仓库存低时，跨仓调拨平衡库存',
    condition: (s) => s.inventory && s.inventory.some(i => i.level > 70) && s.inventory.some(i => i.level < 30),
    coreLogic: '库存平衡算法 + 最短调拨路径',
    action: (s) => {
      const high = s.inventory?.find(i => i.level > 70);
      const low = s.inventory?.find(i => i.level < 30);
      const transferQty = Math.floor((high.level - low.level) / 2);
      return {
        instruction: `从 ${high?.location || 'A仓'} 调拨 ${transferQty} 件至 ${low?.location || 'B仓'}`,
        priority: 'medium',
        estimatedTime: 45,
        fromLocation: high?.location || 'A仓',
        toLocation: low?.location || 'B仓',
        quantity: transferQty,
        remark: '平衡跨仓库存水位，降低缺货风险',
      };
    },
  },
  {
    id: 'route-optimization',
    name: '路径优化型',
    emoji: '🗺️',
    type: '效率型',
    description: '多订单、路况拥堵时，重新规划配送路线',
    condition: (s) => (s.orderCount > 5) || (s.trafficStatus && s.trafficStatus !== 'smooth'),
    coreLogic: 'TSP 路径优化 + 实时路况避堵',
    action: (s) => ({
      instruction: s.trafficStatus === 'congested'
        ? '重新规划配送路线，避开拥堵路段，预计节省 15 分钟'
        : '优化配送顺序，按照优先级排序完成订单',
      priority: 'medium',
      estimatedTime: s.trafficStatus === 'congested' ? 60 : 40,
      optimizedOrders: s.orderCount || 6,
      savedTime: s.trafficStatus === 'congested' ? 15 : 8,
      remark: '基于实时路况动态调整配送方案',
    }),
  },
  {
    id: 'capacity-allocation',
    name: '运力分配型',
    emoji: '🚛',
    type: '调度型',
    description: '订单激增，运力不足时，启用备用车辆',
    condition: (s) => (s.orderCount > 20) || (s.availableVehicles < 3),
    coreLogic: '运力池调度 + 优先级分配算法',
    action: (s) => {
      const extraVehicles = Math.max(0, Math.ceil((s.orderCount || 20) / 10) - (s.availableVehicles || 2));
      return {
        instruction: extraVehicles > 0
          ? `启用 ${extraVehicles} 辆备用车辆，优先分配至高优先级订单`
          : '将现有车辆按订单优先级重新分配',
        priority: 'high',
        estimatedTime: 90,
        dispatchedVehicles: (s.availableVehicles || 2) + extraVehicles,
        highPriorityOrders: Math.ceil((s.orderCount || 20) * 0.3),
        remark: '大促期间运力调度方案，确保高优先级订单及时送达',
      };
    },
  },
  {
    id: 'emergency-restock',
    name: '紧急补货型',
    emoji: '📨',
    type: '应急型',
    description: '库存低于安全线时，触发紧急采购',
    condition: (s) => s.inventory && s.inventory.some(i => i.level < 15),
    coreLogic: '安全库存预警 + 紧急采购流程触发',
    action: (s) => {
      const low = s.inventory?.find(i => i.level < 15);
      const needed = Math.max(50, (80 - (low?.level || 10)) * 2);
      return {
        instruction: `触发紧急补货：${low?.location || '主仓'} 库存仅 ${low?.level || 10}%，紧急采购 ${needed} 件`,
        priority: 'high',
        estimatedTime: 1440,
        targetLocation: low?.location || '主仓',
        restockQuantity: needed,
        deadline: '24 小时内到货',
        remark: '低于安全库存线，触发紧急补货流程',
      };
    },
  },
  {
    id: 'normal-dispatch',
    name: '常规配送型',
    emoji: '📦',
    type: '标准型',
    description: '条件正常时，按标准流程配送',
    condition: () => true,
    coreLogic: '标准配送流程 + 固定路线',
    action: (s) => ({
      instruction: '按标准配送路线执行，按时完成所有订单',
      priority: 'low',
      estimatedTime: 120,
      dispatchedVehicles: s.availableVehicles || 4,
      remark: '常规配送任务，按既定路线执行',
    }),
  },
];

// ============= 模式三：应急灾害策略库 =============
const EMERGENCY_STRATEGIES = [
  {
    id: 'priority-evacuation',
    name: '优先疏散型',
    emoji: '🚨',
    type: '应急型',
    description: '火势/洪水蔓延快时，立即疏散危险区域',
    condition: (s) => s.disasterType && (s.fireLevel > 6 || s.waterLevel > 6 || s.trappedPeople > 50),
    coreLogic: '灾害蔓延模型 + 最优疏散路径规划',
    action: (s) => {
      const area = s.disasterType === 'fire' ? '火势蔓延区' : s.disasterType === 'flood' ? '洪水淹没区' : '灾害核心区';
      const people = s.trappedPeople || 100;
      return {
        instruction: `立即疏散 ${area}，共 ${people} 人需要转移，优先级最高`,
        priority: 'high',
        estimatedTime: 30,
        evacuationArea: area,
        peopleCount: people,
        safePoint: s.disasterType === 'earthquake' ? '开阔地带集结点' : '应急避难所',
        remark: '灾害蔓延迅速，必须优先保证人员安全',
      };
    },
  },
  {
    id: 'supply-drop',
    name: '物资投放型',
    emoji: '🎁',
    type: '救援型',
    description: '灾区物资短缺时，空投紧急物资',
    condition: (s) => s.supplyShortage && s.supplyShortage > 0,
    coreLogic: '物资需求评估 + 精准空投坐标计算',
    action: (s) => {
      const supplies = ['饮用水', '食品', '药品', '毛毯'];
      const dropQty = s.supplyShortage || 500;
      return {
        instruction: `空投 ${dropQty} 份物资至坐标 N39.9° E116.4°，包含：${supplies.join('、')}`,
        priority: 'high',
        estimatedTime: 10,
        dropLocation: 'N39.9° E116.4°',
        supplies,
        quantity: dropQty,
        remark: '灾区物资极度短缺，立即组织空投',
      };
    },
  },
  {
    id: 'comm-restore',
    name: '通信恢复型',
    emoji: '📡',
    type: '保障型',
    description: '通信中断时，派遣无人机中继恢复通信',
    condition: (s) => s.communicationStatus === 'interrupted',
    coreLogic: '通信中继部署 + 信号覆盖范围计算',
    action: (s) => ({
      instruction: '派遣 3 架通信中继无人机，部署于灾区上空 200m 处，恢复通信链路',
      priority: 'high',
      estimatedTime: 15,
      dronesDeployed: 3,
      altitude: 200,
      coverageArea: '半径 5km 范围',
      remark: '通信中断严重影响救援，优先恢复通信保障',
    }),
  },
  {
    id: 'search-rescue',
    name: '搜救探测型',
    emoji: '🔍',
    type: '搜救型',
    description: '有被困人员时，热成像扫描搜索生命迹象',
    condition: (s) => s.trappedPeople && s.trappedPeople > 0 && s.trappedPeople <= 50,
    coreLogic: '热成像识别 + 网格化搜索算法',
    action: (s) => {
      const people = s.trappedPeople || 20;
      return {
        instruction: `热成像扫描受灾区域，搜索 ${people} 名被困人员生命迹象`,
        priority: 'high',
        estimatedTime: 45,
        searchArea: '受灾核心区 2km²',
        estimatedPeople: people,
        searchMethod: '热成像 + 声波探测',
        remark: '黄金救援 72 小时内，全力搜救被困人员',
      };
    },
  },
  {
    id: 'shelter-allocation',
    name: '安置点分配型',
    emoji: '🏠',
    type: '安置型',
    description: '疏散人数超预期时，启用备用安置点',
    condition: (s) => s.displacedPeople && s.displacedPeople > 200,
    coreLogic: '安置点容量评估 + 人员分流方案',
    action: (s) => {
      const people = s.displacedPeople || 300;
      const extraShelters = Math.ceil(people / 200);
      return {
        instruction: `启用 ${extraShelters} 个备用安置点，转移 ${people} 名受灾群众`,
        priority: 'medium',
        estimatedTime: 60,
        sheltersUsed: extraShelters,
        peopleCount: people,
        facilities: ['饮用水', '食品', '医疗服务', '临时厕所'],
        remark: '受灾群众需要妥善安置，确保基本生活保障',
      };
    },
  },
  {
    id: 'monitor-assess',
    name: '监测评估型',
    emoji: '📊',
    type: '评估型',
    description: '其他情况，持续监测并评估灾害态势',
    condition: () => true,
    coreLogic: '多维度数据采集 + 灾害态势评估',
    action: (s) => ({
      instruction: '持续监测灾区态势，实时回传影像数据，评估灾害发展趋势',
      priority: 'low',
      estimatedTime: 120,
      monitoring: ['火势', '水位', '建筑损毁', '人员分布'],
      remark: '全面掌握灾区情况，为后续决策提供数据支持',
    }),
  },
];

// ============= 策略库集合 =============
const STRATEGY_LIBRARIES = {
  [DISPATCH_MODES.SINGLE]: SINGLE_STRATEGIES,
  [DISPATCH_MODES.LOGISTICS]: LOGISTICS_STRATEGIES,
  [DISPATCH_MODES.EMERGENCY]: EMERGENCY_STRATEGIES,
};

// ============= 通用状态评分 =============
function calculateScores(mode, state) {
  const base = { battery: 80, windSpeed: 2, obstacleDistance: 300 };
  const s = { ...base, ...state };

  const safetyScore = Math.min(100, Math.max(0,
    (s.obstacleDistance / 5) + (100 - s.windSpeed * 5)
  ));
  const enduranceScore = s.battery;
  const efficiencyScore = Math.min(100, Math.max(0,
    (100 - Math.abs((s.speed || 8) - 10) * 8) + (100 - s.windSpeed * 3)
  ));

  logger.info('[调度引擎][状态评分]', {
    mode,
    input: { obstacle: s.obstacleDistance, wind: s.windSpeed, battery: s.battery, speed: s.speed },
    scores: { safety: safetyScore, endurance: enduranceScore, efficiency: efficiencyScore },
  });

  return { safetyScore, enduranceScore, efficiencyScore };
}

// ============= 通用策略匹配 =============
function matchStrategy(mode, state) {
  const library = STRATEGY_LIBRARIES[mode] || SINGLE_STRATEGIES;
  const modeLabel = DISPATCH_MODE_LABELS[mode]?.label || mode;
  logger.session('[调度引擎][策略匹配] 开始', {
    mode,
    modeLabel,
    strategyCount: library.length,
    state,
  });

  for (let i = 0; i < library.length; i++) {
    const strategy = library[i];
    try {
      const match = strategy.condition(state);
      logger.info(`[调度引擎][策略匹配][${i + 1}/${library.length}] ${strategy.id}`, {
        strategy: strategy.name,
        matchResult: match ? '✅ 命中' : '❌ 未命中',
      });

      if (match) {
        logger.session(`[调度引擎][策略匹配] ✅ 匹配成功 → ${strategy.name}`, {
          strategyId: strategy.id,
          strategyName: strategy.name,
          strategyType: strategy.type,
          matchIndex: i + 1,
          totalStrategies: library.length,
        });
        return strategy;
      }
    } catch (err) {
      logger.error(`[调度引擎][策略匹配] ❌ 策略 ${strategy.id} 条件判断出错`, {
        strategy: strategy.name,
        error: err?.message || err,
      });
    }
  }

  // 兜底策略（最后一个）
  const fallback = library[library.length - 1];
  logger.session('[调度引擎][策略匹配] ⚠️ 无策略命中，使用兜底策略', {
    fallback: fallback?.name,
  });
  return fallback;
}

// ============= 置信度计算 =============
function calculateConfidence(strategy, state, mode) {
  let base = 70;
  const breakdown = [{ item: '基础分', value: base }];

  if (mode === DISPATCH_MODES.SINGLE) {
    if (strategy.id === 'priority-delivery') {
      const add = (state.battery - 60) * 0.5;
      base += add;
      breakdown.push({ item: '优先配送+电量加成', value: add, battery: state.battery });
    }
    if (strategy.id === 'obstacle-avoidance') {
      const add = (100 - (state.obstacleDistance || 300) / 2);
      base += add;
      breakdown.push({ item: '避障+障碍物近加成', value: add, obstacle: state.obstacleDistance });
    }
    if (strategy.id === 'emergency-landing') {
      const add = (100 - (state.battery || 50) * 2);
      base += add;
      breakdown.push({ item: '应急降落+低电量加成', value: add, battery: state.battery });
    }
  }

  if (mode === DISPATCH_MODES.LOGISTICS) {
    if (strategy.id === 'emergency-restock') {
      base += 20;
      breakdown.push({ item: '紧急补货策略加成', value: 20 });
    }
    if (strategy.id === 'capacity-allocation') {
      base += 15;
      breakdown.push({ item: '运力分配策略加成', value: 15 });
    }
  }

  if (mode === DISPATCH_MODES.EMERGENCY) {
    if (strategy.id === 'priority-evacuation') {
      base += 25;
      breakdown.push({ item: '优先疏散策略加成', value: 25 });
    }
    if (strategy.id === 'comm-restore') {
      base += 20;
      breakdown.push({ item: '通信恢复策略加成', value: 20 });
    }
  }

  const clamped = Math.min(99, Math.max(60, Math.round(base)));
  breakdown.push({ item: '最终结果(钳制后)', value: clamped });

  logger.info('[调度引擎][置信度]', {
    strategy: strategy.name,
    mode,
    rawScore: base,
    finalScore: clamped,
    breakdown,
  });

  return clamped;
}

// ============= 推理解释生成 =============
function generateReasoning(mode, strategy, state) {
  const modeLabel = DISPATCH_MODE_LABELS[mode]?.label || mode;
  const reasons = [];

  if (state.battery !== undefined) {
    if (state.battery < 20) reasons.push(`电量极低（${state.battery}%）`);
    else if (state.battery < 60) reasons.push(`电量中等（${state.battery}%）`);
    else reasons.push(`电量充足（${state.battery}%）`);
  }
  if (state.windSpeed !== undefined) {
    if (state.windSpeed >= 12) reasons.push(`强风（${state.windSpeed}m/s）`);
    else if (state.windSpeed >= 5) reasons.push(`中等风力（${state.windSpeed}m/s）`);
    else reasons.push(`风力较小（${state.windSpeed}m/s）`);
  }
  if (state.obstacleDistance !== undefined) {
    if (state.obstacleDistance < 50) reasons.push(`障碍物近（${state.obstacleDistance}m）`);
    else reasons.push(`周围空旷（障碍物${state.obstacleDistance}m外）`);
  }

  if (mode === DISPATCH_MODES.LOGISTICS) {
    if (state.orderCount) reasons.push(`待处理订单 ${state.orderCount} 单`);
    if (state.availableVehicles !== undefined) reasons.push(`可用车辆 ${state.availableVehicles} 辆`);
    if (state.trafficStatus) reasons.push(`路况：${state.trafficStatus === 'congested' ? '拥堵' : state.trafficStatus === 'moderate' ? '一般' : '顺畅'}`);
  }
  if (mode === DISPATCH_MODES.EMERGENCY) {
    if (state.trappedPeople) reasons.push(`被困人员 ${state.trappedPeople} 人`);
    if (state.communicationStatus === 'interrupted') reasons.push('通信中断');
    if (state.supplyShortage) reasons.push(`物资缺口 ${state.supplyShortage} 份`);
    if (state.displacedPeople) reasons.push(`需安置 ${state.displacedPeople} 人`);
    if (state.disasterType) reasons.push(`灾害类型：${state.disasterType}`);
  }

  const result = `【${modeLabel}】基于：${reasons.join('，')}，匹配最优策略「${strategy.name}」。`;

  logger.info('[调度引擎][推理生成]', {
    mode,
    modeLabel,
    strategy: strategy.name,
    inputKeys: Object.keys(state),
    collectedReasons: reasons,
    result,
  });

  return result;
}

// ============= 主函数：生成调度方案 =============
export function generateDispatchPlan(mode = DISPATCH_MODES.SINGLE, state = {}) {
  const modeLabel = DISPATCH_MODE_LABELS[mode]?.label || mode;
  logger.session('═══════════════════════════════════════');
  logger.session(`[调度引擎][生成方案] 开始`, {
    mode,
    modeLabel,
    state,
  });

  // Step 1: 策略匹配
  logger.session(`[调度引擎][步骤1/5] 策略匹配...`);
  const strategy = matchStrategy(mode, state);
  logger.session(`[调度引擎][步骤1/5] ✅ 匹配到策略: ${strategy.name} (${strategy.id})`);

  // Step 2: 状态评分
  logger.session(`[调度引擎][步骤2/5] 状态评分计算...`);
  const scores = calculateScores(mode, state);
  logger.session(`[调度引擎][步骤2/5] ✅ 评分完成: 安全=${scores.safetyScore}, 续航=${scores.enduranceScore}, 效率=${scores.efficiencyScore}`);

  // Step 3: 动作生成
  logger.session(`[调度引擎][步骤3/5] 执行动作生成...`);
  const action = strategy.action(state);
  logger.session(`[调度引擎][步骤3/5] ✅ 动作生成: ${action.instruction}`, {
    priority: action.priority,
    estimatedTime: action.estimatedTime,
  });

  // Step 4: 置信度计算
  logger.session(`[调度引擎][步骤4/5] 置信度计算...`);
  const confidence = calculateConfidence(strategy, state, mode);
  logger.session(`[调度引擎][步骤4/5] ✅ 置信度: ${confidence}%`);

  // Step 5: 推理生成
  logger.session(`[调度引擎][步骤5/5] 推理过程生成...`);
  const reasoning = generateReasoning(mode, strategy, state);
  logger.session(`[调度引擎][步骤5/5] ✅ 推理完成`);

  const result = {
    mode,
    strategyId: strategy.id,
    strategyName: strategy.name,
    strategyEmoji: strategy.emoji,
    strategyType: strategy.type,
    strategyDescription: strategy.description,
    coreLogic: strategy.coreLogic,
    action,
    confidence,
    reasoning,
    scores,
    generatedAt: Date.now(),
  };

  logger.session(`[调度引擎][生成方案] ✅ 完成`, {
    mode,
    strategy: strategy.name,
    confidence: `${confidence}%`,
    instruction: action.instruction,
  });
  logger.session('═══════════════════════════════════════');

  return result;
}

// ============= 获取策略库 =============
export function getStrategiesByMode(mode) {
  const library = STRATEGY_LIBRARIES[mode] || SINGLE_STRATEGIES;
  return library.map(s => ({
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    type: s.type,
    description: s.description,
    coreLogic: s.coreLogic,
  }));
}

// ============= 默认状态获取 =============
export function getDefaultState(mode) {
  const base = {
    altitude: 100,
    speed: 8,
    battery: 85,
    windSpeed: 2,
    obstacleDistance: 300,
  };

  if (mode === DISPATCH_MODES.LOGISTICS) {
    return {
      ...base,
      inventory: [
        { location: 'A仓', level: 85 },
        { location: 'B仓', level: 45 },
      ],
      orderCount: 12,
      availableVehicles: 4,
      trafficStatus: 'smooth',
    };
  }

  if (mode === DISPATCH_MODES.EMERGENCY) {
    return {
      ...base,
      disasterType: 'fire',
      fireLevel: 5,
      waterLevel: 0,
      trappedPeople: 30,
      supplyShortage: 200,
      communicationStatus: 'normal',
      displacedPeople: 150,
    };
  }

  return base;
}

// ============= 导出 =============
export const droneDispatchEngine = {
  generateDispatchPlan,
  getStrategiesByMode,
  getDefaultState,
  DISPATCH_MODES,
  DISPATCH_MODE_LABELS,
  STRATEGY_LIBRARIES,
};

export default droneDispatchEngine;
