/**
 * 基准库多介质分发引擎
 *
 * 功能：
 * - 翻译规则引擎（短视频/短剧/调酒/电商）
 * - 内容生成器（规则 + 人物数据 → 内容单元）
 * - 批量生成（20人 × 4介质 = 80个内容单元）
 *
 * 核心价值：一次建模，多端分发。内容不再是"写出来的"，而是"算出来的"。
 */

import { logger } from './logger';
import { getProfileById, ALL_PROFILES } from './benchmarkProfiles';

// ============= 介质类型定义 =============

export const MEDIUM_TYPES = {
  VIDEO: 'video',
  DRAMA: 'drama',
  COCKTAIL: 'cocktail',
  ECOMMERCE: 'ecommerce'
};

export const MEDIUM_LABELS = {
  video: '短视频',
  drama: '红果短剧',
  cocktail: '调酒配方',
  ecommerce: '电商推荐'
};

export const MEDIUM_ICONS = {
  video: '🎬',
  drama: '🎭',
  cocktail: '🍸',
  ecommerce: '🛒'
};

// ============= 1. 短视频规则引擎 =============

/**
 * 短视频规则：
 * - 标题：{name} 的 {number} 年
 * - 开场悬念：他 {age} 岁时，做了一件事改变了一生
 * - 金句插入：{quote}
 * - 核心洞察：他的核心逻辑只有四个字：{model}
 * - 案例佐证：就像 {case}，他选择 {action}
 * - 生活细节：他的生活 {style} 到难以置信
 */
function generateVideoContent(profile) {
  const { name, lifeNodes, quotes, mentalModels, cases, consumption, tags } = profile;
  logger.session('[翻译规则·短视频] 开始生成', { 人物: name });

  try {
    // 计算年数（取第一个人生节点到现在）
    const firstNode = lifeNodes?.[0];
    const currentYear = new Date().getFullYear();
    const years = firstNode ? currentYear - firstNode.year : 50;
    logger.info('[翻译规则·短视频] 计算年数', { name, years, firstNodeYear: firstNode?.year });

    // 开场年龄
    const startAge = firstNode ? Math.max(1, firstNode.year - (currentYear - years)) : 20;

    // 标题
    const title = `${name} ${years} 年的秘密`;
    logger.info('[翻译规则·短视频] 生成标题', { title });

    // 正文
    const lines = [];

    // 开场悬念
    if (firstNode) {
      const age = Math.max(10, currentYear - years - firstNode.year + 20);
      lines.push(`他 ${age} 岁时，${firstNode.event.replace(/^\d+岁/, '')}。`);
      logger.info('[翻译规则·短视频] 开场悬念已添加', { age, firstNodeEvent: firstNode.event });
    } else {
      logger.info('[翻译规则·短视频] 无人生节点，跳过开场悬念', { name });
    }

    lines.push('不是靠运气，不是靠内幕，靠的是四个字——');

    // 核心洞察
    if (mentalModels && mentalModels.length > 0) {
      lines.push(`${mentalModels[0]}。`);
      lines.push(`他只做他能看懂的事。看不懂的不碰，错过了也不后悔。`);
      logger.info('[翻译规则·短视频] 核心洞察已添加', { model: mentalModels[0] });
    } else {
      logger.error('[翻译规则·短视频] 思维模型为空', { name });
    }

    // 案例佐证
    if (cases && cases.length > 0) {
      const c = cases[0];
      lines.push(`${c.year} 年，${c.title}。`);
      lines.push(`${c.summary}。`);
      logger.info('[翻译规则·短视频] 案例佐证已添加', { case: c.title, year: c.year });
    } else {
      logger.info('[翻译规则·短视频] 无案例数据', { name });
    }

    // 金句
    if (quotes && quotes.length > 0) {
      lines.push(`"${quotes[0]}"`);
      logger.info('[翻译规则·短视频] 金句已添加', { quote: quotes[0].substring(0, 30) + '...' });
    } else {
      logger.info('[翻译规则·短视频] 无金句数据', { name });
    }

    // 生活细节
    if (consumption) {
      lines.push(`他的生活${consumption.style}到不可置信。`);
      logger.info('[翻译规则·短视频] 生活细节已添加', { style: consumption.style });
    } else {
      logger.info('[翻译规则·短视频] 无消费习惯数据', { name });
    }

    lines.push('如果你只知道他的名字，你就错过了一切。');

    const result = {
      title,
      body: lines.join('\n'),
      tags: [...tags, '短视频', name]
    };

    logger.session('[翻译规则·短视频] 生成完成', {
      人物: name,
      标题: title,
      正文行数: lines.length,
      标签数: result.tags.length
    });

    return result;
  } catch (error) {
    logger.error('[翻译规则·短视频] 生成失败', { name, error: error.message });
    throw error;
  }
}

// ============= 2. 红果短剧规则引擎 =============

/**
 * 红果短剧规则：
 * - 第一幕：人物登场 + 年代背景（lifeNodes[0]）
 * - 第二幕：决策时刻（cases[0]）
 * - 第三幕：金句转折（quotes[0]）
 * - 第四幕：核心认知（mentalModels[0]）
 * - 结尾：感官意象（taste）
 */
function generateDramaContent(profile) {
  const { name, lifeNodes, cases, quotes, mentalModels, taste, tags } = profile;
  logger.session('[翻译规则·红果短剧] 开始生成', { 人物: name });

  try {
    const firstNode = lifeNodes?.[0];
    const dramaCase = cases?.[0];
    const sceneLines = [];

    // 第一幕：人物登场
    if (firstNode) {
      sceneLines.push(`【场景】${firstNode.year} 年。`);
      sceneLines.push(`一个年轻人站在人生的十字路口。`);
      sceneLines.push(``);
      sceneLines.push(`旁白："${firstNode.event}"`);
      sceneLines.push(``);
      logger.info('[翻译规则·红果短剧] 第一幕：人物登场已添加', { year: firstNode.year, event: firstNode.event });
    } else {
      logger.info('[翻译规则·红果短剧] 无人生节点，跳过第一幕', { name });
    }

    // 第二幕：决策时刻
    if (dramaCase) {
      sceneLines.push(`【转场】多年后。`);
      sceneLines.push(`${name} 站在一个抉择面前。`);
      sceneLines.push(``);
      sceneLines.push(`他说："${dramaCase.summary.split('，')[0]}。"`);
      sceneLines.push(``);
      logger.info('[翻译规则·红果短剧] 第二幕：决策时刻已添加', { case: dramaCase.title });
    } else {
      logger.info('[翻译规则·红果短剧] 无案例数据，跳过第二幕', { name });
    }

    // 第三幕：金句转折
    if (quotes && quotes.length > 0) {
      sceneLines.push(`【转折】`);
      sceneLines.push(`镜头拉近，${name} 的眼神变得坚定。`);
      sceneLines.push(``);
      sceneLines.push(`"${quotes[0]}"`);
      sceneLines.push(``);
      logger.info('[翻译规则·红果短剧] 第三幕：金句转折已添加', { quote: quotes[0].substring(0, 30) + '...' });
    } else {
      logger.info('[翻译规则·红果短剧] 无金句数据，跳过第三幕', { name });
    }

    // 第四幕：核心认知
    if (mentalModels && mentalModels.length > 0) {
      sceneLines.push(`【揭示】`);
      sceneLines.push(`他的核心逻辑从未变过——`);
      sceneLines.push(`${mentalModels.slice(0, 3).join(' + ')}。`);
      sceneLines.push(``);
      logger.info('[翻译规则·红果短剧] 第四幕：核心认知已添加', { models: mentalModels.slice(0, 3) });
    } else {
      logger.error('[翻译规则·红果短剧] 思维模型为空', { name });
    }

    // 结尾：感官意象
    if (taste) {
      const spiritName = taste.spirit || '烈酒';
      const tempDesc = taste.temperature || '常温';
      sceneLines.push(`【尾声】`);
      sceneLines.push(`这杯酒叫"${name}·经典"。`);
      sceneLines.push(`${spiritName}，${tempDesc}，简单到极致。`);
      sceneLines.push(`正如他本人。`);
      logger.info('[翻译规则·红果短剧] 尾声：感官意象已添加', { spirit: spiritName, temperature: tempDesc });
    } else {
      logger.info('[翻译规则·红果短剧] 无品味数据，跳过尾声', { name });
    }

    const result = {
      title: `${name} · 人生四幕`,
      body: sceneLines.join('\n'),
      tags: [...tags, '短剧', name]
    };

    logger.session('[翻译规则·红果短剧] 生成完成', {
      人物: name,
      标题: result.title,
      场景数: sceneLines.filter(l => l.startsWith('【')).length,
      正文行数: sceneLines.length
    });

    return result;
  } catch (error) {
    logger.error('[翻译规则·红果短剧] 生成失败', { name, error: error.message });
    throw error;
  }
}

// ============= 3. 调酒/雪茄规则引擎 =============

/**
 * 调酒规则：
 * - 酒名：{name}·{风格}
 * - 基酒：taste.spirit
 * - 风味：taste.flavor（拼接）
 * - 温度：taste.temperature
 * - 呈现：taste.presentation
 * - 配方来源：{name} 的生活方式
 */
function generateCocktailContent(profile) {
  const { name, taste, decisionStyle, tags, consumption } = profile;
  logger.session('[翻译规则·调酒] 开始生成', { 人物: name });

  try {
    const spirit = taste?.spirit || '威士忌';
    const flavors = taste?.flavor || ['烟熏', '橙皮'];
    const temperature = taste?.temperature || '常温';
    const presentation = taste?.presentation || '简约光晕';
    logger.info('[翻译规则·调酒] 品味参数解析', { spirit, flavors, temperature, presentation });

    if (!taste) {
      logger.error('[翻译规则·调酒] 品味数据为空，使用默认值', { name });
    }

    // 酒名后缀
    const styleSuffix = decisionStyle?.split('，')[0]?.slice(0, 4) || '经典';
    logger.info('[翻译规则·调酒] 酒名后缀生成', { styleSuffix, fromDecisionStyle: decisionStyle?.split('，')[0] });

    // 成分建议（基于风味）
    const ingredients = [];
    const spiritMap = {
      '威士忌': '波本威士忌 45ml',
      '金酒': '伦敦干金酒 45ml',
      '红酒': '黑皮诺红酒 60ml',
      '手冲': '冷萃咖啡 60ml'
    };
    const baseIngredient = spiritMap[spirit] || '波本威士忌 45ml';
    ingredients.push(baseIngredient);
    logger.info('[翻译规则·调酒] 基酒已确定', { spirit, baseIngredient });

    const flavorIngredients = {
      '烟熏': '烟熏苦精 2滴',
      '橙皮': '橙皮苦精 2滴',
      '黑巧克力': '黑巧克力利口酒 15ml',
      '草本': '草本利口酒 15ml',
      '蜂蜜': '蜂蜜糖浆 10ml',
      '肉桂': '肉桂棒',
      '薄荷': '新鲜薄荷叶',
      '焦糖': '焦糖糖浆 10ml',
      '香草': '香草糖浆 5ml',
      '海盐': '海盐少许',
      '辣椒': '辣椒苦精 1滴',
      '罗勒': '新鲜罗勒叶',
      '柑橘': '柑橘皮',
      '浆果': '新鲜浆果',
      '花香': '橙花水 2滴',
      '坚果': '坚果利口酒 10ml',
      '可可': '可可利口酒 15ml',
      '黑樱桃': '黑樱桃利口酒 15ml',
      '橡木': '橡木片浸渍',
      '紫罗兰': '紫罗兰利口酒 10ml',
      '松露': '松露油 1滴',
      '甘草': '甘草利口酒 10ml',
      '雪松': '雪松苦精 1滴',
      '黑醋栗': '黑醋栗利口酒 15ml',
      '杜松子': '杜松子利口酒 10ml',
      '柠檬皮': '柠檬皮',
      '西柚': '西柚皮',
      '黄瓜': '黄瓜片'
    };

    const matchedFlavors = [];
    const unmatchedFlavors = [];
    flavors.forEach(f => {
      if (flavorIngredients[f]) {
        ingredients.push(flavorIngredients[f]);
        matchedFlavors.push(f);
      } else {
        unmatchedFlavors.push(f);
      }
    });
    logger.info('[翻译规则·调酒] 风味配料匹配', {
      匹配成功: matchedFlavors.join(', '),
      未匹配: unmatchedFlavors.length > 0 ? unmatchedFlavors.join(', ') : '无'
    });

    // 装饰建议
    const garnishMap = {
      '简约光晕': '橙皮扭花，杯沿火焰',
      '干冰烟雾': '干冰产生的烟雾效果',
      '精准分层': '三种颜色渐变分层',
      '水果装饰': '新鲜浆果 + 薄荷叶',
      '火焰点燃': '表层高酒精点燃',
      '金箔点缀': '食用金箔 + 杯底透光',
      '烟雾弥漫': '迷迭香烟熏',
      '分层结构': '上下两层不同风味',
      '杯底透光': '杯底放置LED灯座',
      '气泡上升': '苏打水产生的气泡',
      '简约呈现': '无多余装饰，保持纯粹'
    };
    const garnish = garnishMap[presentation] || '根据个人喜好装饰';
    logger.info('[翻译规则·调酒] 装饰方式已确定', { presentation, garnish });

    const bodyLines = [
      `## ${name}·${styleSuffix}`,
      ``,
      `### 风味画像`,
      `基酒：${spirit}`,
      `风味：${flavors.join(' + ')}`,
      `温度：${temperature}`,
      `呈现：${presentation}`,
      ``,
      `### 配方`,
      ...ingredients.map((ing, i) => `${i + 1}. ${ing}`),
      ``,
      `### 装饰`,
      garnish,
      ``,
      `### 配方来源`,
      `来自${name}的生活方式——${decisionStyle || '独特的个人哲学'}。`,
      consumption?.style && `消费习惯：${consumption.style}主义。`
    ].filter(Boolean);

    const result = {
      title: `${name}·${styleSuffix} 调酒配方`,
      body: bodyLines.join('\n'),
      tags: [...tags, '调酒', spirit, name]
    };

    logger.session('[翻译规则·调酒] 生成完成', {
      人物: name,
      标题: result.title,
      配料数: ingredients.length,
      标签数: result.tags.length
    });

    return result;
  } catch (error) {
    logger.error('[翻译规则·调酒] 生成失败', { name, error: error.message });
    throw error;
  }
}

// ============= 4. 电商/淘宝规则引擎 =============

/**
 * 电商规则：
 * - 人格标签：{name}式消费
 * - 推荐品类：consumption.categories
 * - 推荐风格：consumption.style
 * - 购买节奏：consumption.frequency
 */
function generateEcommerceContent(profile) {
  const { name, consumption, decisionStyle, tags, mentalModels } = profile;
  logger.session('[翻译规则·电商] 开始生成', { 人物: name });

  try {
    const categories = consumption?.categories || ['书籍', '简约款'];
    const style = consumption?.style || '实用';
    const frequency = consumption?.frequency || '中频';
    logger.info('[翻译规则·电商] 消费参数解析', { categories, style, frequency });

    if (!consumption) {
      logger.error('[翻译规则·电商] 消费数据为空，使用默认值', { name });
    }

    // 风格描述
    const styleDesc = {
      '极简': '极简主义——只买真正需要的，每一件都是精品',
      '实用': '实用主义——功能优先，不为品牌溢价买单',
      '奢侈': '品质主义——宁缺毋滥，追求极致体验',
      '体验': '体验主义——花钱买经历，不买物品'
    };
    const styleDescription = styleDesc[style] || style;
    logger.info('[翻译规则·电商] 消费风格映射', { style, styleDescription });

    // 频率描述
    const freqDesc = {
      '低频': '低频高质——买得少，但每件都用很久',
      '中频': '适度消费——有计划地更新，保持新鲜感',
      '高频': '高频尝新——喜欢体验新品，保持对生活的热情'
    };
    const freqDescription = freqDesc[frequency] || frequency;
    logger.info('[翻译规则·电商] 消费频率映射', { frequency, freqDescription });

    // 推荐品类（扩展）
    const categoryExtensions = {
      '书籍': ['经典文学', '商业传记', '哲学思考', '科技前沿'],
      '可乐': ['经典可乐', '限量版包装', '周边收藏品'],
      '简约西装': ['定制西装', '经典款衬衫', '简约配饰'],
      '艺术品': ['限量版画', '雕塑作品', '艺术摄影集'],
      '高端定制': ['定制西装', '定制皮鞋', '定制腕表'],
      '哲学书籍': ['存在主义', '东方哲学', '逻辑学', '伦理学'],
      '系统工具': ['效率软件订阅', '生产力硬件', '知识管理系统'],
      '订阅服务': ['音乐会员', '视频会员', '知识付费'],
      '经典款': ['经典白T恤', '原色牛仔裤', '基础款卫衣'],
      '日常消费': ['精品咖啡', '优质食材', '舒适家居'],
      '体验服务': ['旅行套餐', '课程学习', 'SPA体验'],
      '儿童用品': ['益智玩具', '优质绘本', '儿童家具'],
      '科技产品': ['最新数码', '智能家居', '效率工具'],
      '太空体验': ['太空旅游套餐', '天文望远镜', '航天周边'],
      '高速交通': ['私人飞机体验', '高铁商务舱', '豪华租车'],
      '太极文化': ['太极课程', '中式服装', '养生茶具'],
      '艺术品收藏': ['古董收藏', '当代艺术', '书法作品'],
      '公益项目': ['慈善捐赠', '公益旅行', '环保产品'],
      '数字内容': ['电子书', '在线课程', '音乐专辑'],
      '游戏IP': ['游戏周边', '限定版主机', '电竞设备'],
      '信息服务': ['数据订阅', '研报服务', '行业报告'],
      '效率工具': ['生产力软件', '自动化服务', '时间管理系统'],
      '知识付费': ['大师课', '年度会员', '私教服务'],
      '智能硬件': ['智能家居', '可穿戴设备', '机器人'],
      '农产品': ['有机食品', '产地直供', '特色农产品'],
      '日用百货': ['高品质日用品', '环保产品', '极简家居'],
      '高性价比商品': ['工厂直供', 'C2M定制', '品牌折扣'],
      '本地生活': ['餐饮代金券', '美容美发', '休闲娱乐'],
      '外卖': ['健康餐', '特色美食', '轻食沙拉'],
      '旅行服务': ['机票酒店', '旅行套餐', '当地体验'],
      '汽车': ['新能源车', '豪华车', '汽车配件'],
      '家庭用品': ['智能家居', '厨房电器', '收纳系统']
    };

    const matchedCategories = [];
    const unmatchedCategories = [];
    const extendedCategories = categories.map(cat => {
      const ext = categoryExtensions[cat];
      if (ext) {
        matchedCategories.push(cat);
        return `${cat}（${ext.join(' / ')}）`;
      } else {
        unmatchedCategories.push(cat);
        return cat;
      }
    });
    logger.info('[翻译规则·电商] 推荐品类扩展', {
      原始品类: categories.join(', '),
      匹配扩展: matchedCategories.join(', '),
      未匹配: unmatchedCategories.length > 0 ? unmatchedCategories.join(', ') : '无'
    });

    // 消费金句
    const quoteLines = mentalModels?.slice(0, 2).map(m =>
      `"${m}" —— 这也体现在他的消费选择中。`
    ) || [];
    if (quoteLines.length > 0) {
      logger.info('[翻译规则·电商] 消费金句已添加', { count: quoteLines.length });
    } else {
      logger.info('[翻译规则·电商] 无思维模型数据，跳过消费金句', { name });
    }

    const bodyLines = [
      `## 你的消费风格：${style}主义`,
      ``,
      `你像${name}一样购物——${styleDescription}。`,
      ``,
      `### 推荐品类`,
      ...extendedCategories.map(c => `• ${c}`),
      ``,
      `### 购买节奏`,
      freqDescription,
      ``,
      ...quoteLines,
      ``,
      `### 决策风格延伸`,
      decisionStyle || '独特的个人哲学',
      ``,
      `> 💡 标签：${tags.slice(0, 5).join(' · ')}`
    ];

    const result = {
      title: `${name}式消费指南`,
      body: bodyLines.join('\n'),
      tags: [...tags, '电商', style, name]
    };

    logger.session('[翻译规则·电商] 生成完成', {
      人物: name,
      标题: result.title,
      推荐品类数: extendedCategories.length,
      标签数: result.tags.length
    });

    return result;
  } catch (error) {
    logger.error('[翻译规则·电商] 生成失败', { name, error: error.message });
    throw error;
  }
}

// ============= 内容生成器主引擎 =============

const GENERATORS = {
  [MEDIUM_TYPES.VIDEO]: generateVideoContent,
  [MEDIUM_TYPES.DRAMA]: generateDramaContent,
  [MEDIUM_TYPES.COCKTAIL]: generateCocktailContent,
  [MEDIUM_TYPES.ECOMMERCE]: generateEcommerceContent
};

/**
 * 内部函数：直接使用 profile 对象生成内容单元（跳过人物查询，用于批量场景）
 * @param {object} profile - 人物档案对象
 * @param {string} medium - 介质类型
 * @returns {ContentUnit} 内容单元
 */
function generateFromProfile(profile, medium) {
  try {
    if (!profile || !medium) {
      return null;
    }

    const generator = GENERATORS[medium];
    if (!generator) {
      logger.error('[内容生成器] 介质类型不支持', {
        medium,
        支持类型: Object.keys(GENERATORS).join(', ')
      });
      return null;
    }

    const content = generator(profile);

    const unit = {
      id: `${profile.id}_${medium}_${Date.now()}`,
      personId: profile.id,
      personName: profile.name,
      personEmoji: profile.emoji,
      personType: profile.type,
      medium,
      mediumLabel: MEDIUM_LABELS[medium],
      mediumIcon: MEDIUM_ICONS[medium],
      title: content.title,
      body: content.body,
      tags: content.tags,
      generatedAt: Date.now()
    };

    return unit;
  } catch (error) {
    logger.error('[内容生成器] 生成异常', {
      personId: profile?.id,
      name: profile?.name,
      medium,
      error: error.message,
      stack: error.stack?.substring(0, 200)
    });
    return null;
  }
}

/**
 * 生成单个内容单元
 * @param {string} personId - 人物ID
 * @param {string} medium - 介质类型
 * @returns {ContentUnit} 内容单元
 */
export function generate(personId, medium) {
  logger.session('[内容生成器] generate 入口', { personId, medium });

  try {
    if (!personId) {
      logger.error('[内容生成器] 参数错误：personId 为空', { personId, medium });
      return null;
    }
    if (!medium) {
      logger.error('[内容生成器] 参数错误：medium 为空', { personId, medium });
      return null;
    }

    const profile = getProfileById(personId);
    if (!profile) {
      logger.error('[内容生成器] 人物不存在', { personId, medium, 可用人物数: ALL_PROFILES.length });
      return null;
    }
    logger.info('[内容生成器] 人物查询成功', { id: profile.id, name: profile.name, type: profile.type });
    logger.info('[内容生成器] 介质生成器已就绪', { medium, mediumLabel: MEDIUM_LABELS[medium] });
    logger.info('[内容生成器] 调用翻译规则引擎...', { name: profile.name, medium: MEDIUM_LABELS[medium] });

    const unit = generateFromProfile(profile, medium);

    if (unit) {
      logger.info('[内容生成器] 翻译规则引擎返回', { title: unit.title, bodyLines: unit.body.split('\n').length, tagsCount: unit.tags.length });
      logger.session('[内容生成器] 生成完成', {
        id: unit.id,
        人物: profile.name,
        介质: MEDIUM_LABELS[medium],
        标题: unit.title,
        标签数: unit.tags.length
      });
    }

    return unit;
  } catch (error) {
    logger.error('[内容生成器] 生成异常', {
      personId,
      medium,
      error: error.message,
      stack: error.stack?.substring(0, 200)
    });
    return null;
  }
}

/**
 * 批量生成所有内容单元
 * 20人 × 4介质 = 80个内容单元
 * @returns {ContentUnit[]} 所有内容单元
 */
export function generateAll() {
  const startTime = Date.now();
  logger.session('[内容生成器] generateAll 开始批量生成', {
    人物数: ALL_PROFILES.length,
    介质数: Object.keys(MEDIUM_TYPES).length,
    预计产出: ALL_PROFILES.length * Object.keys(MEDIUM_TYPES).length
  });

  try {
    const results = [];
    const errors = [];
    let processedCount = 0;
    const totalCount = ALL_PROFILES.length * Object.keys(MEDIUM_TYPES).length;

    for (const profile of ALL_PROFILES) {
      for (const medium of Object.values(MEDIUM_TYPES)) {
        processedCount++;
        logger.info(`[内容生成器] 进度 ${processedCount}/${totalCount}`, {
          当前人物: profile.name,
          当前介质: MEDIUM_LABELS[medium]
        });

        const unit = generateFromProfile(profile, medium);
        if (unit) {
          results.push(unit);
        } else {
          errors.push({ personId: profile.id, medium });
          logger.error('[内容生成器] 单个生成失败，已跳过', {
            personId: profile.id,
            name: profile.name,
            medium
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.session('[内容生成器] generateAll 批量生成完成', {
      实际产出: results.length,
      失败数: errors.length,
      耗时: `${duration}ms`,
      平均每个: `${Math.round(duration / Math.max(results.length, 1))}ms`
    });

    if (errors.length > 0) {
      logger.error('[内容生成器] 批量生成存在失败项', { 失败列表: errors });
    }

    return results;
  } catch (error) {
    logger.error('[内容生成器] generateAll 批量生成异常', {
      error: error.message,
      stack: error.stack?.substring(0, 200)
    });
    return [];
  }
}

/**
 * 按介质批量生成
 */
export function generateByMedium(medium) {
  logger.session('[内容生成器] generateByMedium 入口', { medium, mediumLabel: MEDIUM_LABELS[medium] });

  try {
    if (!medium || !GENERATORS[medium]) {
      logger.error('[内容生成器] generateByMedium 介质无效', {
        medium,
        支持类型: Object.keys(GENERATORS).join(', ')
      });
      return [];
    }

    const results = [];
    const errors = [];
    for (const profile of ALL_PROFILES) {
      logger.info('[内容生成器] generateByMedium 处理中', { name: profile.name });
      const unit = generateFromProfile(profile, medium);
      if (unit) {
        results.push(unit);
      } else {
        errors.push(profile.name);
      }
    }

    logger.session('[内容生成器] generateByMedium 完成', {
      medium: MEDIUM_LABELS[medium],
      成功数: results.length,
      失败数: errors.length,
      失败人物: errors.join(', ')
    });

    return results;
  } catch (error) {
    logger.error('[内容生成器] generateByMedium 异常', {
      medium,
      error: error.message
    });
    return [];
  }
}

/**
 * 按人物批量生成（4个介质）
 */
export function generateByPerson(personId) {
  logger.session('[内容生成器] generateByPerson 入口', { personId });

  try {
    if (!personId) {
      logger.error('[内容生成器] generateByPerson personId 为空');
      return [];
    }

    const profile = getProfileById(personId);
    if (!profile) {
      logger.error('[内容生成器] generateByPerson 人物不存在', { personId });
      return [];
    }

    const results = [];
    const errors = [];
    for (const medium of Object.values(MEDIUM_TYPES)) {
      logger.info('[内容生成器] generateByPerson 处理中', { name: profile.name, medium: MEDIUM_LABELS[medium] });
      const unit = generateFromProfile(profile, medium);
      if (unit) {
        results.push(unit);
      } else {
        errors.push(MEDIUM_LABELS[medium]);
      }
    }

    logger.session('[内容生成器] generateByPerson 完成', {
      人物: profile.name,
      成功数: results.length,
      失败数: errors.length,
      失败介质: errors.join(', ')
    });

    return results;
  } catch (error) {
    logger.error('[内容生成器] generateByPerson 异常', {
      personId,
      error: error.message
    });
    return [];
  }
}

// ============= 异步分批版本（避免主线程阻塞） =============

const BATCH_SIZE = 10;

export function yieldToMainThread() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * 异步分批生成所有内容单元（避免主线程长时间阻塞）
 * @param {object} [options]
 * @param {number} [options.batchSize=10] - 每批处理的任务数
 * @param {Function} [options.onProgress] - 进度回调 (processed, total) => void
 * @returns {Promise<ContentUnit[]>}
 */
export async function generateAllAsync(options = {}) {
  const { batchSize = BATCH_SIZE, onProgress } = options;
  const startTime = Date.now();
  const mediums = Object.values(MEDIUM_TYPES);
  const totalCount = ALL_PROFILES.length * mediums.length;

  logger.session('[内容生成器] generateAllAsync 开始异步批量生成', {
    人物数: ALL_PROFILES.length,
    介质数: mediums.length,
    预计产出: totalCount,
    批大小: batchSize
  });

  try {
    const results = [];
    const errors = [];
    let processedCount = 0;

    for (let i = 0; i < ALL_PROFILES.length; i++) {
      const profile = ALL_PROFILES[i];
      for (let j = 0; j < mediums.length; j++) {
        const medium = mediums[j];
        processedCount++;

        logger.info(`[内容生成器] 进度 ${processedCount}/${totalCount}`, {
          当前人物: profile.name,
          当前介质: MEDIUM_LABELS[medium]
        });

        const unit = generateFromProfile(profile, medium);
        if (unit) {
          results.push(unit);
        } else {
          errors.push({ personId: profile.id, medium });
        }

        if (processedCount % batchSize === 0) {
          if (onProgress) onProgress(processedCount, totalCount);
          await yieldToMainThread();
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.session('[内容生成器] generateAllAsync 批量生成完成', {
      实际产出: results.length,
      失败数: errors.length,
      耗时: `${duration}ms`,
      平均每个: `${Math.round(duration / Math.max(results.length, 1))}ms`
    });

    if (errors.length > 0) {
      logger.error('[内容生成器] 批量生成存在失败项', { 失败列表: errors });
    }

    if (onProgress) onProgress(totalCount, totalCount);
    return results;
  } catch (error) {
    logger.error('[内容生成器] generateAllAsync 批量生成异常', {
      error: error.message,
      stack: error.stack?.substring(0, 200)
    });
    return [];
  }
}

/**
 * 异步按介质批量生成
 */
export async function generateByMediumAsync(medium, options = {}) {
  const { batchSize = BATCH_SIZE, onProgress } = options;

  logger.session('[内容生成器] generateByMediumAsync 入口', { medium, mediumLabel: MEDIUM_LABELS[medium] });

  try {
    if (!medium || !GENERATORS[medium]) {
      logger.error('[内容生成器] generateByMediumAsync 介质无效', {
        medium,
        支持类型: Object.keys(GENERATORS).join(', ')
      });
      return [];
    }

    const results = [];
    const errors = [];
    const totalCount = ALL_PROFILES.length;

    for (let i = 0; i < ALL_PROFILES.length; i++) {
      const profile = ALL_PROFILES[i];
      logger.info('[内容生成器] generateByMediumAsync 处理中', { name: profile.name });
      const unit = generateFromProfile(profile, medium);
      if (unit) {
        results.push(unit);
      } else {
        errors.push(profile.name);
      }

      if ((i + 1) % batchSize === 0) {
        if (onProgress) onProgress(i + 1, totalCount);
        await yieldToMainThread();
      }
    }

    logger.session('[内容生成器] generateByMediumAsync 完成', {
      medium: MEDIUM_LABELS[medium],
      成功数: results.length,
      失败数: errors.length
    });

    if (onProgress) onProgress(totalCount, totalCount);
    return results;
  } catch (error) {
    logger.error('[内容生成器] generateByMediumAsync 异常', {
      medium,
      error: error.message
    });
    return [];
  }
}

/**
 * 异步按人物批量生成（4个介质）
 */
export async function generateByPersonAsync(personId) {
  logger.session('[内容生成器] generateByPersonAsync 入口', { personId });

  try {
    if (!personId) {
      logger.error('[内容生成器] generateByPersonAsync personId 为空');
      return [];
    }

    const profile = getProfileById(personId);
    if (!profile) {
      logger.error('[内容生成器] generateByPersonAsync 人物不存在', { personId });
      return [];
    }

    const results = [];
    const errors = [];
    for (const medium of Object.values(MEDIUM_TYPES)) {
      logger.info('[内容生成器] generateByPersonAsync 处理中', { name: profile.name, medium: MEDIUM_LABELS[medium] });
      const unit = generateFromProfile(profile, medium);
      if (unit) {
        results.push(unit);
      } else {
        errors.push(MEDIUM_LABELS[medium]);
      }
      await yieldToMainThread();
    }

    logger.session('[内容生成器] generateByPersonAsync 完成', {
      人物: profile.name,
      成功数: results.length,
      失败数: errors.length
    });

    return results;
  } catch (error) {
    logger.error('[内容生成器] generateByPersonAsync 异常', {
      personId,
      error: error.message
    });
    return [];
  }
}

// ============= 导出 =============

export const contentHubEngine = {
  generate,
  generateAll,
  generateByMedium,
  generateByPerson,
  generateAllAsync,
  generateByMediumAsync,
  generateByPersonAsync,
  yieldToMainThread,
  MEDIUM_TYPES,
  MEDIUM_LABELS,
  MEDIUM_ICONS
};

export default contentHubEngine;
