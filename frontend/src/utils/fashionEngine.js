/**
 * 人格时尚引擎
 *
 * 映射：人格画像 → 可感知的视觉语言
 * 核心流程：MBTI基础 → 星盘修正 → 塔罗主题 → 调酒细节 → 时尚输出
 */

import { logger } from './logger';

// ============= 3.1 MBTI → 时尚基础映射 =============
const MBTI_FASHION_MAP = {
  INTJ: {
    keywords: ['理性', '结构', '秩序', '克制', '独立'],
    colors: ['深蓝', '炭黑', '烟灰', '象牙白', '墨绿'],
    fabrics: ['羊毛', '纯棉', '精纺', '皮革'],
    silhouettes: ['直线剪裁', '结构感外套', '修身套装'],
    theme: '理性深冬·秩序感穿搭',
    accessories: ['双排扣羊毛大衣', '金属链条包', '极简银饰'],
    colorHex: ['#1e3a5f', '#2d3748', '#cbd5e0', '#fffff0', '#1a4731'],
  },
  INTP: {
    keywords: ['抽象', '逻辑', '独立', '灵活', '思考'],
    colors: ['灰褐', '藏青', '墨绿', '雾霾蓝', '米白'],
    fabrics: ['棉麻', '混纺', '针织', '亚麻'],
    silhouettes: ['宽松垂坠', '解构设计', '层叠穿搭'],
    theme: '抽象森林·松弛感穿搭',
    accessories: ['阔腿裤', '工装夹克', '复古眼镜'],
    colorHex: ['#6b7280', '#1e3a5f', '#166534', '#778899', '#fef3c7'],
  },
  ENTJ: {
    keywords: ['掌控', '力量', '野心', '果断', '权威'],
    colors: ['纯黑', '酒红', '海军蓝', '深灰', '白金'],
    fabrics: ['皮革', '羊毛', '真丝', '羊绒'],
    silhouettes: ['硬朗廓形', '大垫肩', '收腰套装'],
    theme: '权力觉醒·掌控感穿搭',
    accessories: ['皮革风衣', '金属腰带', '深色墨镜'],
    colorHex: ['#000000', '#722f37', '#000080', '#374151', '#e5e7eb'],
  },
  ENTP: {
    keywords: ['即兴', '锐利', '灵活', '创新', '挑战'],
    colors: ['金属银', '炭黑', '铁灰', '电光蓝'],
    fabrics: ['混纺', '机能面料', '亮面', '金属丝'],
    silhouettes: ['不规则剪裁', '解构设计', '拼接款式'],
    theme: '即兴锐利·先锋感穿搭',
    accessories: ['机能风夹克', '金属项链', '不对称设计'],
    colorHex: ['#c0c0c0', '#36454f', '#4a5568', '#1e90ff'],
  },
  INFJ: {
    keywords: ['深邃', '神秘', '共情', '内省', '理想'],
    colors: ['深紫', '墨绿', '藏青', '酒红', '烟灰'],
    fabrics: ['丝绸', '羊毛', '雪纺', '蕾丝'],
    silhouettes: ['垂坠长裙', '包裹感上衣', '飘逸外套'],
    theme: '深邃秘境·氛围感穿搭',
    accessories: ['长款开衫', '流苏围巾', '水晶饰品'],
    colorHex: ['#4a1d6e', '#1a4731', '#1e3a5f', '#722f37', '#708090'],
  },
  INFP: {
    keywords: ['梦幻', '柔软', '理想', '浪漫', '诗意'],
    colors: ['薰衣草紫', '雾霾蓝', '米白', '樱花粉', '薄荷绿'],
    fabrics: ['棉麻', '针织', '雪纺', '蕾丝'],
    silhouettes: ['层叠穿搭', '浪漫裙摆', '宽松版型'],
    theme: '梦幻花园·柔软感穿搭',
    accessories: ['针织开衫', '纱质半裙', '布艺发饰'],
    colorHex: ['#e6e6fa', '#778899', '#fef3c7', '#ffc0cb', '#98fb98'],
  },
  ENFJ: {
    keywords: ['温暖', '鼓舞', '引力', '关怀', '热情'],
    colors: ['暖橙', '酒红', '焦糖', '暖米', '暖棕'],
    fabrics: ['针织', '天鹅绒', '羊毛', '灯芯绒'],
    silhouettes: ['流线型剪裁', '包裹感上衣', '收腰长裙'],
    theme: '暖阳和煦·温暖感穿搭',
    accessories: ['针织毛衣', '羊绒围巾', '暖色耳环'],
    colorHex: ['#ff7f50', '#722f37', '#c19a6b', '#f5deb3', '#8b4513'],
  },
  ENFP: {
    keywords: ['活泼', '自由', '色彩', '创意', '快乐'],
    colors: ['亮黄', '珊瑚红', '天蓝', '薄荷绿', '樱粉'],
    fabrics: ['棉质', '针织', '牛仔', '帆布'],
    silhouettes: ['休闲混搭', '印花元素', '复古版型'],
    theme: '彩虹夏日·活力感穿搭',
    accessories: ['彩色卫衣', '复古牛仔', '夸张配饰'],
    colorHex: ['#ffd700', '#ff7f7f', '#87ceeb', '#98fb98', '#ffb6c1'],
  },
  ISTJ: {
    keywords: ['严谨', '实用', '经典', '可靠', '秩序'],
    colors: ['中灰', '深蓝', '卡其', '藏青', '米白'],
    fabrics: ['纯棉', '羊毛', '斜纹布', '灯芯绒'],
    silhouettes: ['合身基础款', '经典剪裁', '挺括版型'],
    theme: '经典永恒·务实感穿搭',
    accessories: ['白衬衫', '卡其裤', '皮质腰带'],
    colorHex: ['#808080', '#00008b', '#c3b091', '#1e3a5f', '#faf0e6'],
  },
  ISFJ: {
    keywords: ['温柔', '细致', '守护', '温暖', '柔和'],
    colors: ['浅粉', '米色', '灰蓝', '奶白', '淡紫'],
    fabrics: ['棉', '针织', '绒面', '柔软混纺'],
    silhouettes: ['舒适柔美', 'A字版型', '圆领设计'],
    theme: '温柔守护·柔和感穿搭',
    accessories: ['开衫毛衣', 'A字半裙', '珍珠饰品'],
    colorHex: ['#ffc0cb', '#f5f5dc', '#778899', '#fff8dc', '#e6e6fa'],
  },
  ESTJ: {
    keywords: ['果断', '权威', '秩序', '领导', '高效'],
    colors: ['深蓝', '纯黑', '深灰', '炭棕', '白色'],
    fabrics: ['精纺', '皮革', '羊毛', '府绸'],
    silhouettes: ['挺括严谨', '西装套装', '利落剪裁'],
    theme: '权威秩序·专业感穿搭',
    accessories: ['西装外套', '皮质手提包', '简约腕表'],
    colorHex: ['#00008b', '#000000', '#374151', '#3d2b1f', '#ffffff'],
  },
  ESFJ: {
    keywords: ['亲和', '关怀', '温暖', '社交', '和谐'],
    colors: ['暖粉', '淡紫', '米色', '浅蓝', '奶黄'],
    fabrics: ['针织', '雪纺', '蕾丝', '丝绸'],
    silhouettes: ['优雅柔和', '收腰设计', '圆领款式'],
    theme: '和煦微风·亲和感穿搭',
    accessories: ['珍珠项链', '蕾丝上衣', '中长裙'],
    colorHex: ['#ffb6c1', '#dda0dd', '#f5deb3', '#87ceeb', '#fffacd'],
  },
  ISTP: {
    keywords: ['冷静', '灵活', '行动', '独立', '务实'],
    colors: ['纯黑', '铁灰', '军绿', '深蓝', '炭色'],
    fabrics: ['机能面料', '牛仔', '帆布', '皮革'],
    silhouettes: ['机能感设计', '利落剪裁', '工装元素'],
    theme: '冷静行动·机能感穿搭',
    accessories: ['工装夹克', '战术背包', '机械腕表'],
    colorHex: ['#000000', '#4a5568', '#4b5320', '#1e3a5f', '#36454f'],
  },
  ISFP: {
    keywords: ['敏感', '细腻', '艺术', '自然', '柔和'],
    colors: ['薰衣草', '灰绿', '雾霾蓝', '米白', '珊瑚粉'],
    fabrics: ['丝绸', '亚麻', '针织', '雪纺'],
    silhouettes: ['飘逸自然', '柔软版型', '不规则设计'],
    theme: '艺术漫步·自然感穿搭',
    accessories: ['亚麻衬衫', '阔腿裤', '布艺包包'],
    colorHex: ['#e6e6fa', '#8fbc8f', '#778899', '#faf0e6', '#f08080'],
  },
  ESTP: {
    keywords: ['大胆', '冒险', '冲击', '活力', '刺激'],
    colors: ['亮红', '亮橙', '纯黑', '金属', '深棕'],
    fabrics: ['皮革', '亮面', '牛仔', '金属丝'],
    silhouettes: ['紧身短款', '机车元素', '利落剪裁'],
    theme: '大胆冲击·冒险感穿搭',
    accessories: ['机车皮衣', '铆钉靴', '墨镜'],
    colorHex: ['#ff0000', '#ff4500', '#000000', '#c0c0c0', '#3d2b1f'],
  },
  ESFP: {
    keywords: ['热情', '表演', '闪耀', '快乐', '活力'],
    colors: ['金色', '亮粉', '正红', '橙黄', '宝蓝'],
    fabrics: ['亮片', '缎面', '丝绒', '金属丝'],
    silhouettes: ['戏剧感廓形', '大摆长裙', '夸张设计'],
    theme: '闪耀派对·存在感穿搭',
    accessories: ['亮片上衣', '缎面长裙', '夸张耳环'],
    colorHex: ['#ffd700', '#ff69b4', '#dc143c', '#ffa500', '#4169e1'],
  },
};

// ============= 3.2 星盘修正 =============
const ELEMENT_SIGNS = {
  fire: ['白羊', '狮子', '射手'],
  earth: ['金牛', '处女', '摩羯'],
  air: ['双子', '天秤', '水瓶'],
  water: ['巨蟹', '天蝎', '双鱼'],
};

const ELEMENT_MODIFIERS = {
  fire: {
    colorBonus: ['暖橙', '酒红', '金色'],
    fabricBonus: ['皮革', '丝绒'],
    silhouetteBonus: ['大胆剪裁', '夸张配饰'],
  },
  earth: {
    colorBonus: ['焦糖', '卡其', '橄榄绿'],
    fabricBonus: ['羊毛', '棉麻'],
    silhouetteBonus: ['经典款式', '基础款'],
  },
  air: {
    colorBonus: ['银灰', '冰蓝', '金属色'],
    fabricBonus: ['混纺', '机能面料'],
    silhouetteBonus: ['不规则剪裁', '层次穿搭'],
  },
  water: {
    colorBonus: ['深紫', '雾蓝', '银灰'],
    fabricBonus: ['丝绸', '蕾丝'],
    silhouetteBonus: ['垂坠感', '飘逸感'],
  },
};

// ============= 3.3 塔罗 → 时尚主题修正 =============
const TAROT_FASHION_MAP = {
  '力量': { theme: '力量感穿搭', colorEmphasis: ['正红', '酒红'], accessories: ['金属配饰', '皮革单品'] },
  '星星': { theme: '梦幻感穿搭', colorEmphasis: ['天蓝', '银灰'], accessories: ['流苏', '亮片'] },
  '高塔': { theme: '颠覆感穿搭', colorEmphasis: ['纯黑', '深灰'], accessories: ['金属', '链条'] },
  '女祭司': { theme: '神秘感穿搭', colorEmphasis: ['深紫', '纯黑'], accessories: ['银饰', '纱质'] },
  '太阳': { theme: '明亮感穿搭', colorEmphasis: ['金色', '暖橙'], accessories: ['金色配饰'] },
  '月亮': { theme: '朦胧感穿搭', colorEmphasis: ['银灰', '淡紫'], accessories: ['珠光', '蕾丝'] },
  '恋人': { theme: '柔和感穿搭', colorEmphasis: ['粉色', '淡绿'], accessories: ['丝巾', '花饰'] },
  '战车': { theme: '行动感穿搭', colorEmphasis: ['正红', '纯黑'], accessories: ['皮革', '铆钉'] },
  '节制': { theme: '平衡感穿搭', colorEmphasis: ['中性灰', '米白'], accessories: ['极简配饰'] },
  '恶魔': { theme: '张力感穿搭', colorEmphasis: ['暗红', '纯黑'], accessories: ['金属链条'] },
  '世界': { theme: '完整感穿搭', colorEmphasis: ['宝蓝', '金色'], accessories: ['几何配饰'] },
  '死神': { theme: '转变感穿搭', colorEmphasis: ['纯黑', '深灰'], accessories: ['解构感'] },
  '愚者': { theme: '自由感穿搭', colorEmphasis: ['彩色', '混搭'], accessories: ['民族风'] },
  '审判': { theme: '觉醒感穿搭', colorEmphasis: ['金色', '纯白'], accessories: ['几何形'] },
  '隐士': { theme: '内敛感穿搭', colorEmphasis: ['灰色', '橄榄绿'], accessories: ['木质', '皮革'] },
  '命运之轮': { theme: '流转感穿搭', colorEmphasis: ['正红', '金色', '纯黑'], accessories: ['复古配饰'] },
};

// ============= 3.4 调酒偏好修正 =============
const COCKTAIL_MODIFIERS = {
  '威士忌': { colors: ['焦糖棕', '深棕'], fabrics: ['羊毛', '皮革'] },
  '烟熏': { colors: ['炭黑', '深灰'], fabrics: ['皮革', '羊毛'] },
  '金酒': { colors: ['松绿', '薄荷绿'], fabrics: ['棉麻', '垂坠'] },
  '草本': { colors: ['草绿', '森林绿'], fabrics: ['棉麻', '亚麻'] },
  '红酒': { colors: ['酒红', '深紫'], fabrics: ['丝绸', '天鹅绒'] },
  '浆果': { colors: ['深紫', '玫红'], fabrics: ['天鹅绒', '丝绸'] },
  '手冲': { colors: ['米白', '浅棕'], fabrics: ['棉质', '亚麻'] },
  '花香': { colors: ['淡粉', '薰衣草紫'], fabrics: ['棉质', '蕾丝'] },
};

// ============= 辅助函数 =============
function getElementBySign(sign) {
  if (!sign) return null;
  for (const [element, signs] of Object.entries(ELEMENT_SIGNS)) {
    if (signs.some(s => sign.includes(s))) return element;
  }
  return null;
}

function dedupeAndTrim(arr, max = 5) {
  return [...new Set(arr.filter(Boolean))].slice(0, max);
}

// ============= 主函数 =============
export function generateFashionReport(input = {}) {
  logger.session('═══════════════════════════════════════');
  logger.session('[时尚引擎] 生成时尚报告', input);

  const { mbti, risingSign, venusSign, marsSign, recentTarot = [], baseSpirit, flavorTags = [] } = input;

  // Step 1: MBTI 基础映射
  logger.session('[时尚引擎][步骤1/5] MBTI基础映射...');
  const mbtiUpper = (mbti || 'INTJ').toUpperCase();
  const base = MBTI_FASHION_MAP[mbtiUpper] || MBTI_FASHION_MAP.INTJ;
  logger.session(`[时尚引擎][步骤1/5] ✅ MBTI: ${mbtiUpper}`, {
    theme: base.theme,
    colors: base.colors,
  });

  // Step 2: 星盘修正
  logger.session('[时尚引擎][步骤2/5] 星盘修正...');
  const risingElement = getElementBySign(risingSign);
  const venusElement = getElementBySign(venusSign);
  const marsElement = getElementBySign(marsSign);
  const elements = [risingElement, venusElement, marsElement].filter(Boolean);
  logger.session('[时尚引擎][步骤2/5] 星盘元素', {
    rising: risingSign, risingElement,
    venus: venusSign, venusElement,
    mars: marsSign, marsElement,
  });

  let colorPool = [...base.colors];
  let fabricPool = [...base.fabrics];
  let silhouettePool = [...base.silhouettes];

  elements.forEach(elem => {
    const mod = ELEMENT_MODIFIERS[elem];
    if (mod) {
      colorPool = [...colorPool, ...mod.colorBonus];
      fabricPool = [...fabricPool, ...mod.fabricBonus];
      silhouettePool = [...silhouettePool, ...mod.silhouetteBonus];
    }
  });

  // Step 3: 塔罗修正
  logger.session('[时尚引擎][步骤3/5] 塔罗修正...');
  let tarotModifier = null;
  if (recentTarot && recentTarot.length > 0) {
    for (const card of recentTarot) {
      const mod = TAROT_FASHION_MAP[card];
      if (mod) {
        tarotModifier = mod;
        colorPool = [...colorPool, ...mod.colorEmphasis];
        logger.session(`[时尚引擎][步骤3/5] ✅ 塔罗牌: ${card}`, mod);
        break;
      }
    }
  }

  // Step 4: 调酒修正
  logger.session('[时尚引擎][步骤4/5] 调酒偏好修正...');
  const allTags = [baseSpirit, ...flavorTags].filter(Boolean);
  allTags.forEach(tag => {
    for (const [key, mod] of Object.entries(COCKTAIL_MODIFIERS)) {
      if (tag.includes(key) || key.includes(tag)) {
        colorPool = [...colorPool, ...mod.colors];
        fabricPool = [...fabricPool, ...mod.fabrics];
        logger.session(`[时尚引擎][步骤4/5] ✅ 调酒: ${tag}`, mod);
      }
    }
  });

  // Step 5: 汇总生成输出
  logger.session('[时尚引擎][步骤5/5] 汇总输出...');
  const finalColors = dedupeAndTrim(colorPool, 5);
  const finalFabrics = dedupeAndTrim(fabricPool, 5);
  const finalSilhouettes = dedupeAndTrim(silhouettePool, 3);

  let finalKeywords = base.keywords;
  let finalTheme = base.theme;
  let finalAccessories = [...base.accessories];

  // 塔罗主题覆盖
  if (tarotModifier) {
    finalTheme = tarotModifier.theme;
    finalAccessories = dedupeAndTrim([...finalAccessories, ...tarotModifier.accessories], 5);
  }

  // 当季建议生成
  let seasonalAdvice = `基于你的 ${mbtiUpper} 人格基础`;
  if (risingSign) seasonalAdvice += `，上升${risingSign}带来${risingElement === 'fire' ? '热情大胆' : risingElement === 'earth' ? '务实经典' : risingElement === 'air' ? '灵动创新' : '深邃感性'}的气质`;
  if (tarotModifier) seasonalAdvice += `，塔罗「${recentTarot[0]}」建议尝试${tarotModifier.theme.replace('穿搭', '')}`;
  seasonalAdvice += '。';

  const report = {
    mbti: mbtiUpper,
    risingSign,
    venusSign,
    marsSign,
    recentTarot,
    baseSpirit,
    colors: finalColors,
    fabrics: finalFabrics,
    silhouettes: finalSilhouettes,
    theme: finalTheme,
    keywords: finalKeywords,
    accessories: finalAccessories,
    seasonalAdvice,
    colorHex: base.colorHex,
    generatedAt: Date.now(),
  };

  logger.session('[时尚引擎][步骤5/5] ✅ 完成', {
    theme: finalTheme,
    colors: finalColors,
  });
  logger.session('═══════════════════════════════════════');

  return report;
}

// ============= 工具函数 =============
export function getMBTIBase(mbti) {
  return MBTI_FASHION_MAP[mbti?.toUpperCase()] || MBTI_FASHION_MAP.INTJ;
}

// ============= 穿搭卡片图片生成 =============

// 构建高质量的图片生成提示词
export function buildFashionImagePrompt(report) {
  if (!report) return '';

  const { colors, fabrics, silhouettes, theme, keywords, accessories, mbti } = report;

  // 中文描述（用于日志和用户理解）
  const cnPrompt = `
    时尚穿搭主题：${theme}
    气质关键词：${keywords.join('、')}
    MBTI人格：${mbti}
    主色调：${colors.join('、')}
    面料材质：${fabrics.join('、')}
    版型风格：${silhouettes.join('、')}
    配饰建议：${accessories.join('、')}
  `.trim();

  // 英文提示词（用于图片生成，效果更好）
  const colorEn = colors.map(c => {
    const map = {
      '深蓝': 'deep navy blue', '炭黑': 'charcoal black', '烟灰': 'smoky gray',
      '象牙白': 'ivory white', '墨绿': 'ink green', '灰褐': 'taupe brown',
      '藏青': 'navy blue', '雾霾蓝': 'haze blue', '米白': 'cream white',
      '纯黑': 'pure black', '酒红': 'burgundy red', '海军蓝': 'naval blue',
      '深灰': 'dark gray', '白金': 'platinum', '金属银': 'metallic silver',
      '铁灰': 'iron gray', '电光蓝': 'electric blue', '深紫': 'deep purple',
      '薰衣草紫': 'lavender purple', '雾蓝': 'mist blue', '樱花粉': 'sakura pink',
      '薄荷绿': 'mint green', '暖橙': 'warm orange', '焦糖': 'caramel brown',
      '暖米': 'warm beige', '暖棕': 'warm brown', '亮黄': 'bright yellow',
      '珊瑚红': 'coral red', '天蓝': 'sky blue', '中灰': 'medium gray',
      '卡其': 'khaki', '浅粉': 'light pink', '米色': 'beige', '灰蓝': 'gray blue',
      '奶白': 'milk white', '淡紫': 'light purple', '军绿': 'army green',
      '炭色': 'charcoal', '金色': 'gold', '亮粉': 'hot pink', '正红': 'true red',
      '橙黄': 'orange yellow', '宝蓝': 'royal blue', '淡绿': 'light green',
      '中性灰': 'neutral gray', '暗红': 'dark red', '橄榄绿': 'olive green',
      '彩色': 'multicolor', '纯白': 'pure white', '深棕': 'dark brown',
      '松绿': 'pine green', '森林绿': 'forest green', '玫红': 'rose pink',
      '浅棕': 'light brown', '薰衣草紫': 'lavender',
    };
    return map[c] || c;
  }).join(', ');

  const fabricEn = fabrics.map(f => {
    const map = {
      '羊毛': 'wool', '纯棉': 'pure cotton', '精纺': 'worsted fabric',
      '皮革': 'leather', '棉麻': 'cotton linen', '混纺': 'blend fabric',
      '针织': 'knitwear', '亚麻': 'linen', '丝绸': 'silk',
      '雪纺': 'chiffon', '蕾丝': 'lace', '天鹅绒': 'velvet',
      '灯芯绒': 'corduroy', '斜纹布': 'twill', '府绸': 'poplin',
      '亮片': 'sequin', '缎面': 'satin', '丝绒': 'velvet',
      '金属丝': 'metallic thread', '机能面料': 'technical fabric',
      '亮面': 'shiny fabric', '牛仔': 'denim', '帆布': 'canvas',
      '垂坠': 'drapey fabric', '绒面': 'suede', '棉质': 'cotton',
    };
    return map[f] || f;
  }).join(', ');

  const silhouetteEn = silhouettes.map(s => {
    const map = {
      '直线剪裁': 'clean linear tailoring', '结构感外套': 'structured outerwear',
      '修身套装': 'tailored suit', '宽松垂坠': 'loose drapey fit',
      '解构设计': 'deconstructed design', '层叠穿搭': 'layered look',
      '硬朗廓形': 'strong silhouette', '大垫肩': 'oversized shoulder pads',
      '收腰套装': 'cinched waist suit', '不规则剪裁': 'asymmetric cut',
      '拼接款式': 'patchwork style', '垂坠长裙': 'flowing maxi dress',
      '包裹感上衣': 'wrap top', '飘逸外套': 'flowing coat',
      '流线型剪裁': 'sleek streamlined cut', '收腰长裙': 'fitted waist dress',
      '休闲混搭': 'casual mix and match', '印花元素': 'print details',
      '复古版型': 'vintage silhouette', '合身基础款': 'classic fit basics',
      '经典剪裁': 'classic cut', '挺括版型': 'crisp structured fit',
      '优雅柔和': 'elegant soft look', '收腰设计': 'waist cinching design',
      '圆领款式': 'crew neck style', '机能感设计': 'technical design',
      '利落剪裁': 'sharp cut', '工装元素': 'workwear details',
      '飘逸自然': 'flowing natural', '柔软版型': 'soft silhouette',
      '紧身短款': 'tight cropped fit', '机车元素': 'biker details',
      '戏剧感廓形': 'dramatic silhouette', '大摆长裙': 'full maxi skirt',
      '夸张设计': 'exaggerated design', '大胆剪裁': 'bold cut',
      'A字版型': 'A-line silhouette',
    };
    return map[s] || s;
  }).join(', ');

  const keywordsEn = keywords.map(k => {
    const map = {
      '理性': 'rational', '结构': 'structural', '秩序': 'orderly',
      '克制': 'restrained', '独立': 'independent', '抽象': 'abstract',
      '逻辑': 'logical', '灵活': 'flexible', '思考': 'thoughtful',
      '掌控': 'controlling', '力量': 'powerful', '野心': 'ambitious',
      '果断': 'decisive', '即兴': 'impromptu', '锐利': 'sharp',
      '创新': 'innovative', '挑战': 'challenging', '深邃': 'deep',
      '神秘': 'mysterious', '共情': 'empathetic', '内省': 'introspective',
      '理想': 'idealistic', '梦幻': 'dreamy', '柔软': 'soft',
      '浪漫': 'romantic', '诗意': 'poetic', '温暖': 'warm',
      '鼓舞': 'inspiring', '引力': 'magnetic', '关怀': 'caring',
      '热情': 'passionate', '活泼': 'lively', '自由': 'free',
      '色彩': 'colorful', '创意': 'creative', '快乐': 'joyful',
      '严谨': 'rigorous', '实用': 'practical', '经典': 'classic',
      '可靠': 'reliable', '温柔': 'gentle', '细致': 'delicate',
      '守护': 'protective', '柔和': 'soft', '权威': 'authoritative',
      '领导': 'leading', '高效': 'efficient', '亲和': 'approachable',
      '社交': 'sociable', '和谐': 'harmonious', '冷静': 'calm',
      '行动': 'action-oriented', '务实': 'pragmatic', '敏感': 'sensitive',
      '细腻': 'subtle', '艺术': 'artistic', '自然': 'natural',
      '大胆': 'bold', '冒险': 'adventurous', '刺激': 'thrilling',
      '活力': 'energetic', '表演': 'performative', '闪耀': 'shining',
    };
    return map[k] || k;
  }).join(', ');

  const enPrompt = `
    High fashion editorial photo, full body outfit, ${theme} style.
    Personality: ${mbti} (${keywordsEn}).
    Color palette: ${colorEn}.
    Materials: ${fabricEn}.
    Silhouette: ${silhouetteEn}.
    Accessories: ${accessories.join(', ')}.
    Style: high fashion magazine, vogue editorial, professional photography,
    soft studio lighting, elegant pose, full body shot, detailed textures,
    8k resolution, photorealistic, ultra detailed.
    No text, no watermark, clean background.
  `.trim().replace(/\s+/g, ' ');

  logger.session('[时尚引擎][图片提示词]', {
    cn: cnPrompt.slice(0, 100),
    en: enPrompt.slice(0, 150),
  });

  return { cnPrompt, enPrompt };
}

// ============= 图片生成：重试机制 + 错误分类 =============

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1500,
  maxDelay: 8000,
  timeoutMs: 30000,
};

// 错误类型分类
const ERROR_TYPES = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  API: 'api',
  UNKNOWN: 'unknown',
};

function getErrorTip(errorType) {
  const tips = {
    [ERROR_TYPES.NETWORK]: '网络连接不稳定，请检查网络后重试',
    [ERROR_TYPES.TIMEOUT]: 'AI 绘图服务响应较慢，建议稍后再试',
    [ERROR_TYPES.API]: 'AI 绘图服务暂时繁忙，请稍后重试',
    [ERROR_TYPES.UNKNOWN]: '生成失败，请稍后重试',
  };
  return tips[errorType] || tips[ERROR_TYPES.UNKNOWN];
}

function classifyError(err) {
  if (!err) return ERROR_TYPES.UNKNOWN;
  const msg = (err.message || String(err)).toLowerCase();
  if (msg.includes('timeout') || msg.includes('超时')) return ERROR_TYPES.TIMEOUT;
  if (msg.includes('network') || msg.includes('网络') || msg.includes('offline') || msg.includes('failed')) return ERROR_TYPES.NETWORK;
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('429') || msg.includes('server')) return ERROR_TYPES.API;
  return ERROR_TYPES.UNKNOWN;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 带超时的单张图片加载
function loadImageWithTimeout(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`图片加载超时 (${timeoutMs}ms)`));
    }, timeoutMs);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      clearTimeout(timeoutId);
      resolve({
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = (err) => {
      clearTimeout(timeoutId);
      reject(new Error('图片加载失败'));
    };

    img.src = url;
  });
}

// 生成穿搭卡片图片（带重试机制）
export async function generateFashionCardImage(report, size = 'portrait_4_3', options = {}) {
  if (!report) {
    logger.error('[时尚引擎][图片生成] 报告为空');
    return {
      success: false,
      error: '缺少时尚报告数据',
      errorType: ERROR_TYPES.UNKNOWN,
      tip: '请先生成时尚报告',
    };
  }

  const { enPrompt } = buildFashionImagePrompt(report);
  const encodedPrompt = encodeURIComponent(enPrompt);
  const imageUrl = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodedPrompt}&image_size=${size}`;

  logger.session('[时尚引擎][图片生成] 开始', {
    theme: report.theme,
    size,
    urlLength: imageUrl.length,
  });

  const maxRetries = options.maxRetries ?? RETRY_CONFIG.maxRetries;
  let lastError = null;
  let lastErrorType = ERROR_TYPES.UNKNOWN;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const isFirstAttempt = attempt === 0;
    const attemptLabel = isFirstAttempt ? '首次尝试' : `第 ${attempt} 次重试`;

    if (!isFirstAttempt) {
      const backoffMs = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
        RETRY_CONFIG.maxDelay
      );
      logger.session(`[时尚引擎][图片生成] ${attemptLabel}，等待 ${backoffMs}ms 后重试`, {
        attempt,
        maxRetries,
        backoffMs,
      });
      await delay(backoffMs);
    }

    try {
      logger.session(`[时尚引擎][图片生成] ${attemptLabel}：开始加载图片`, { attempt });

      const result = await loadImageWithTimeout(imageUrl, RETRY_CONFIG.timeoutMs);

      logger.session('[时尚引擎][图片生成] ✅ 成功', {
        attempt,
        width: result.width,
        height: result.height,
      });

      return {
        success: true,
        url: result.url,
        width: result.width,
        height: result.height,
        attempts: attempt + 1,
      };
    } catch (err) {
      lastError = err;
      lastErrorType = classifyError(err);

      logger.error(`[时尚引擎][图片生成] ❌ ${attemptLabel}失败`, {
        attempt,
        error: err?.message,
        errorType: lastErrorType,
      });

      // 如果是最后一次重试，不再继续
      if (attempt >= maxRetries) {
        break;
      }
    }
  }

  // 所有重试都失败了
  const tip = getErrorTip(lastErrorType);
  logger.error('[时尚引擎][图片生成] ❌ 全部重试失败', {
    maxRetries,
    lastError: lastError?.message,
    lastErrorType,
    tip,
  });

  return {
    success: false,
    error: lastError?.message || '未知错误',
    errorType: lastErrorType,
    tip,
    attempts: maxRetries + 1,
  };
}

export const fashionEngine = {
  generateFashionReport,
  getMBTIBase,
  buildFashionImagePrompt,
  generateFashionCardImage,
  MBTI_FASHION_MAP,
  TAROT_FASHION_MAP,
};

export default fashionEngine;
