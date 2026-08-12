/**
 * 人格培养方案引擎
 *
 * 基于人格数据，生成可执行的个人发展方案
 * 四大模块：语言系统、认知系统、行为系统、表达系统
 */

import { logger } from './logger';

// ============= MBTI → 语言系统映射 =============
const LANGUAGE_MAP = {
  INTJ: {
    learningStyle: ['reading', 'logical'],
    learningStyleLabel: '阅读型 + 系统型',
    approach: [
      '以语法结构和逻辑分析为主，建立完整知识体系',
      '优先阅读技术文档、学术论文等结构化材料',
      '通过写作输出强化语言内化（日记、博客、技术文章）',
      '使用 Anki 等工具进行间隔重复记忆',
    ],
    path: ['语法框架', '技术文档精读', '专业写作', '学术听力'],
    level: { vocabulary: 5000, listening: 'B1', reading: 'B2', speaking: 'A2', writing: 'B1' },
    weeklyGoal: '完成 3 篇技术文章的精读，并写一篇 300 词的英文总结',
  },
  INTP: {
    learningStyle: ['reading', 'exploratory'],
    learningStyleLabel: '阅读型 + 探索型',
    approach: [
      '通过感兴趣的领域自然习得语言（技术、科学、哲学）',
      '使用英文原版书籍和论文作为主要输入',
      '尝试用英文解释复杂概念，训练逻辑表达',
      '在编程、文档等日常场景中刻意使用英文',
    ],
    path: ['兴趣驱动阅读', '概念解释练习', '技术英文写作', '播客听力'],
    level: { vocabulary: 4500, listening: 'B1', reading: 'B2', speaking: 'A2', writing: 'B1' },
    weeklyGoal: '阅读一本英文技术书籍的一个章节，并整理核心概念笔记',
  },
  ENTJ: {
    learningStyle: ['auditory', 'conversational'],
    learningStyleLabel: '听力型 + 对话型',
    approach: [
      '以播客和演讲为主，训练商务和领导力语言',
      '参加英文辩论或演讲俱乐部，锻炼表达',
      '模拟商业谈判、会议等场景进行对话练习',
      '观看 TED、商业访谈等视频材料',
    ],
    path: ['商务播客', '演讲练习', '会议模拟', '谈判对话'],
    level: { vocabulary: 5500, listening: 'B2', reading: 'B1', speaking: 'B1', writing: 'B1' },
    weeklyGoal: '听 3 期商业播客，并做 2 次 5 分钟的英文演讲录音',
  },
  ENTP: {
    learningStyle: ['auditory', 'debate'],
    learningStyleLabel: '听力型 + 辩论型',
    approach: [
      '通过辩论和讨论快速提升语言流利度',
      '观看辩论比赛、访谈节目，学习论点表达',
      '参与英文讨论小组或线上社区',
      '练习即兴表达，用英文阐述不同观点',
    ],
    path: ['辩论材料', '即兴表达', '讨论参与', '多视角写作'],
    level: { vocabulary: 5000, listening: 'B2', reading: 'B1', speaking: 'B1', writing: 'B1' },
    weeklyGoal: '参加 1 次英文线上讨论，并写 2 篇不同立场的观点短文',
  },
  INFJ: {
    learningStyle: ['reading', 'immersive'],
    learningStyleLabel: '阅读型 + 沉浸型',
    approach: [
      '以文学作品和情感类材料为主，培养语言质感',
      '通过诗歌、散文、小说感受语言的韵律',
      '坚持英文日记，记录内心想法和感受',
      '观看文艺电影、纪录片，沉浸在语言环境中',
    ],
    path: ['文学阅读', '情感表达写作', '影视沉浸', '诗歌赏析'],
    level: { vocabulary: 4800, listening: 'B1', reading: 'B2', speaking: 'A2', writing: 'B2' },
    weeklyGoal: '阅读 1 篇英文散文，并写 1 首英文短诗或日记',
  },
  INFP: {
    learningStyle: ['reading', 'creative'],
    learningStyleLabel: '阅读型 + 创作型',
    approach: [
      '通过小说、诗歌、创意写作培养语言感知',
      '用英文进行创意写作（故事、诗歌、剧本）',
      '沉浸在英文音乐、电影等艺术形式中',
      '创建个人英文博客，记录成长和思考',
    ],
    path: ['小说阅读', '创意写作', '音乐影视', '博客记录'],
    level: { vocabulary: 4200, listening: 'B1', reading: 'B2', speaking: 'A2', writing: 'B2' },
    weeklyGoal: '写 1 篇英文创意短文（200 词），并学唱 1 首英文歌',
  },
  ENFJ: {
    learningStyle: ['conversational', 'visual'],
    learningStyleLabel: '对话型 + 视觉型',
    approach: [
      '以影视材料和对话为主，在人际互动中学习',
      '观看电影、剧集，模仿台词和表达方式',
      '组织或参加英文语言交换活动',
      '用英文进行分享、演讲、教学',
    ],
    path: ['影视跟读', '角色扮演', '语言交换', '分享演讲'],
    level: { vocabulary: 5000, listening: 'B2', reading: 'B1', speaking: 'B1', writing: 'B1' },
    weeklyGoal: '跟读 2 集美剧，并参加 1 次语言交换活动',
  },
  ENFP: {
    learningStyle: ['conversational', 'experiential'],
    learningStyleLabel: '对话型 + 体验型',
    approach: [
      '通过真实场景对话和互动自然习得',
      '用英文交朋友、聊天、参加社交活动',
      '观看脱口秀、综艺节目，学习地道表达',
      '尝试用英文即兴创作和表演',
    ],
    path: ['社交对话', '综艺脱口秀', '即兴表演', '朋友交流'],
    level: { vocabulary: 4500, listening: 'B2', reading: 'B1', speaking: 'B1', writing: 'A2' },
    weeklyGoal: '看 2 期脱口秀，并与朋友进行 30 分钟全英文对话',
  },
  ISTJ: {
    learningStyle: ['reading', 'repetitive'],
    learningStyleLabel: '阅读型 + 重复型',
    approach: [
      '以结构化教材和系统练习为主，稳扎稳打',
      '每日固定时间进行听说读写训练',
      '使用传统教材和练习册打好基础',
      '通过大量重复练习形成肌肉记忆',
    ],
    path: ['教材系统学习', '语法练习', '每日听力', '重复记忆'],
    level: { vocabulary: 4000, listening: 'A2', reading: 'B1', speaking: 'A2', writing: 'B1' },
    weeklyGoal: '完成教材 1 个单元学习，并进行 5 次 30 分钟的听力训练',
  },
  ISFJ: {
    learningStyle: ['reading', 'supportive'],
    learningStyleLabel: '阅读型 + 支持型',
    approach: [
      '在温暖支持的环境中学习，注重理解和应用',
      '选择实用、贴近生活的学习材料',
      '通过教别人来巩固自己的学习',
      '使用卡片、图表等可视化工具辅助记忆',
    ],
    path: ['实用材料', '情景对话', '互助学习', '可视化笔记'],
    level: { vocabulary: 3800, listening: 'A2', reading: 'B1', speaking: 'A2', writing: 'B1' },
    weeklyGoal: '学习 50 个实用词汇，并与学习伙伴进行 2 次情景对话练习',
  },
  ESTJ: {
    learningStyle: ['conversational', 'practical'],
    learningStyleLabel: '对话型 + 实用型',
    approach: [
      '以实用场景对话和任务驱动学习',
      '聚焦职场、商务等实际应用场景',
      '通过完成具体任务提升语言能力',
      '模拟会议、汇报、谈判等工作场景',
    ],
    path: ['职场英语', '任务驱动', '模拟会议', '商务写作'],
    level: { vocabulary: 4800, listening: 'B1', reading: 'B1', speaking: 'B1', writing: 'B1' },
    weeklyGoal: '完成 1 次英文工作汇报模拟，并写 2 封商务邮件',
  },
  ESFJ: {
    learningStyle: ['conversational', 'social'],
    learningStyleLabel: '对话型 + 社交型',
    approach: [
      '在社交互动中学习语言，注重人际连接',
      '参加英文聚会、俱乐部等社交活动',
      '通过关心他人、帮助他人来练习语言',
      '学习日常交流、情感表达等实用内容',
    ],
    path: ['社交聚会', '日常对话', '情感表达', '互助学习'],
    level: { vocabulary: 4000, listening: 'B1', reading: 'A2', speaking: 'B1', writing: 'A2' },
    weeklyGoal: '参加 1 次英文社交活动，并写 3 条英文问候/感谢信息',
  },
  ISTP: {
    learningStyle: ['kinesthetic', 'visual'],
    learningStyleLabel: '体验型 + 视觉型',
    approach: [
      '通过动手实践和视觉材料学习语言',
      '使用英文教程、说明书进行实际操作',
      '观看技术视频、DIY 教程等动手类内容',
      '在编程、维修、制作等活动中使用英文',
    ],
    path: ['视频教程', '动手操作', '技术文档', '实践场景'],
    level: { vocabulary: 4200, listening: 'B1', reading: 'B1', speaking: 'A2', writing: 'A2' },
    weeklyGoal: '跟着 1 个英文教程完成 1 个动手项目，并记录关键术语',
  },
  ISFP: {
    learningStyle: ['kinesthetic', 'artistic'],
    learningStyleLabel: '体验型 + 艺术型',
    approach: [
      '通过艺术、手工、自然体验等感受性方式学习',
      '用英文描述感官体验（看、听、触、闻）',
      '学习艺术、设计、自然等领域的英文词汇',
      '通过绘画、手工、音乐等多感官方式记忆',
    ],
    path: ['艺术材料', '感官描述', '自然主题', '多感官记忆'],
    level: { vocabulary: 3500, listening: 'A2', reading: 'B1', speaking: 'A2', writing: 'B1' },
    weeklyGoal: '用英文描述 1 次自然或艺术体验，并学习 20 个相关词汇',
  },
  ESTP: {
    learningStyle: ['conversational', 'experiential'],
    learningStyleLabel: '对话型 + 体验型',
    approach: [
      '在真实场景中快速学习，注重即时应用',
      '通过运动、旅行、冒险等活动接触英文',
      '学习地道俚语和街头表达',
      '在压力场景下练习沟通和反应',
    ],
    path: ['运动场景', '旅行英语', '地道表达', '实战对话'],
    level: { vocabulary: 4500, listening: 'B1', reading: 'A2', speaking: 'B1', writing: 'A2' },
    weeklyGoal: '学习 30 个地道表达，并与外国朋友进行 1 次运动或休闲活动',
  },
  ESFP: {
    learningStyle: ['conversational', 'performative'],
    learningStyleLabel: '对话型 + 表演型',
    approach: [
      '通过表演、歌唱、互动等娱乐方式学习',
      '学唱英文歌、模仿电影台词',
      '参加英文表演、即兴剧场等活动',
      '在游戏和娱乐中自然习得语言',
    ],
    path: ['歌曲学习', '电影模仿', '即兴表演', '游戏互动'],
    level: { vocabulary: 4000, listening: 'B1', reading: 'A2', speaking: 'B1', writing: 'A2' },
    weeklyGoal: '学唱 2 首英文歌，并参加 1 次英文互动游戏或表演',
  },
};

// ============= MBTI → 认知系统映射 =============
const COGNITIVE_MAP = {
  // 直觉型（N）
  INTJ: {
    strengths: ['系统思维', '战略规划', '独立思考', '概念建模'],
    weaknesses: ['细节关注度', '团队协作耐心', '情感表达'],
    strengthActions: [
      '每周进行 1 次跨学科阅读和思考连接',
      '学习系统动力学和复杂系统建模',
      '用思维导图建立个人知识体系',
    ],
    weaknessActions: [
      '每日进行 5 分钟细节观察训练（写下 3 个被忽略的细节）',
      '学习数据分析基础，培养数据敏感度',
      '刻意练习在团队中倾听和理解他人视角',
    ],
    resources: ['《系统思考》', '《第五项修炼》', '《结构思考力》', 'Coursera 模型思维课程'],
  },
  INTP: {
    strengths: ['逻辑分析', '抽象思维', '创新思维', '批判性思维'],
    weaknesses: ['执行力', '计划落地', '社交敏感'],
    strengthActions: [
      '每周分析 1 个复杂问题，写出完整逻辑链',
      '学习哲学和逻辑学，深化思维深度',
      '练习用第一性原理拆解问题',
    ],
    weaknessActions: [
      '每周完成 1 个小项目（即使不完美）',
      '学习项目管理基础，用工具跟踪进度',
      '每日进行 10 分钟主动社交练习',
    ],
    resources: ['《思考，快与慢》', '《逻辑学导论》', '《精益创业》', '可汗学院逻辑课程'],
  },
  ENTJ: {
    strengths: ['战略思维', '决策力', '领导力', '系统规划'],
    weaknesses: ['耐心倾听', '情感关怀', '细节处理'],
    strengthActions: [
      '每周进行 1 次战略复盘和规划',
      '学习商业战略和军事战略思想',
      '带领 1 个小项目练习领导力',
    ],
    weaknessActions: [
      '每日进行 15 分钟不打断的倾听练习',
      '学习情绪智能和共情能力训练',
      '刻意练习关注任务细节和执行质量',
    ],
    resources: ['《战略论》', '《领导力》', '《情商》', '哈佛商业评论战略类文章'],
  },
  ENTP: {
    strengths: ['创意思维', '辩论能力', '快速学习', '多视角思考'],
    weaknesses: ['专注力', '完成度', '深入钻研'],
    strengthActions: [
      '每周进行 1 次头脑风暴并记录 20 个想法',
      '参加辩论或讨论活动锻炼表达',
      '学习横向思维和创意工具',
    ],
    weaknessActions: [
      '使用番茄工作法训练专注力（从 25 分钟开始）',
      '刻意选择 1 个想法深入执行到底',
      '学习深度工作方法，设定无干扰时段',
    ],
    resources: ['《水平思考》', '《创意黏力学》', '《深度工作》', 'Ideo 设计思维课程'],
  },
  INFJ: {
    strengths: ['洞察思维', '系统思考', '价值判断', '长期规划'],
    weaknesses: ['现实落地', '自我怀疑', '冲突处理'],
    strengthActions: [
      '每周进行 1 次深度反思和洞察记录',
      '学习哲学和心理学，深化对人性的理解',
      '用系统思维分析社会和组织问题',
    ],
    weaknessActions: [
      '选择 1 个洞察进行小范围验证和落地',
      '每日记录 3 个成功经历，增强自信',
      '学习非暴力沟通和冲突解决技巧',
    ],
    resources: ['《人类简史》', '《非暴力沟通》', '《思考，快与慢》', '积极心理学课程'],
  },
  INFP: {
    strengths: ['价值思维', '创意表达', '共情理解', '理想建构'],
    weaknesses: ['现实适应', '计划执行', '批评接受'],
    strengthActions: [
      '每周进行 1 次价值观反思和表达练习',
      '通过写作、艺术等形式表达内心世界',
      '学习文学和哲学，深化精神世界',
    ],
    weaknessActions: [
      '设定可执行的小目标并每日完成',
      '学习时间管理和任务分解方法',
      '练习将批评视为反馈而非否定',
    ],
    resources: ['《艺术家之路》', '《心流》', '《高效能人士的七个习惯》', '写作疗愈课程'],
  },
  ENFJ: {
    strengths: ['人际思维', '共情理解', '沟通表达', '团队协调'],
    weaknesses: ['边界设定', '自我照顾', '冲突处理'],
    strengthActions: [
      '每周组织 1 次团队讨论或学习活动',
      '学习心理学和沟通理论深化理解',
      '练习不同风格的沟通和表达',
    ],
    weaknessActions: [
      '学习设定健康的人际边界',
      '每日安排独处和自我充电时间',
      '练习直接表达不同意见而不回避冲突',
    ],
    resources: ['《非暴力沟通》', '《关键对话》', '《界限》', '教练技术课程'],
  },
  ENFP: {
    strengths: ['创意思维', '人际洞察', '热情感染', '可能性思维'],
    weaknesses: ['专注力', '细节处理', '持续跟进'],
    strengthActions: [
      '每周探索 1 个新领域或新想法',
      '参加创意工作坊或社交活动激发灵感',
      '练习可能性思考和愿景构建',
    ],
    weaknessActions: [
      '使用可视化工具跟踪任务进度',
      '设定明确的截止日期和里程碑',
      '寻找 accountability partner 互相督促',
    ],
    resources: ['《创意，信心》', '《跃迁》', '《搞定》', '设计思维工作坊'],
  },
  // 实感型（S）
  ISTJ: {
    strengths: ['细节思维', '逻辑推理', '计划执行', '质量把控'],
    weaknesses: ['创新思维', '灵活调整', '大局观'],
    strengthActions: [
      '每周进行 1 次流程优化和细节改进',
      '学习项目管理和质量控制方法',
      '刻意练习系统性的思考和决策',
    ],
    weaknessActions: [
      '每周尝试 1 个新方法或新路径',
      '学习战略思维和商业全局视角',
      '练习在信息不完整时快速决策',
    ],
    resources: ['《项目管理知识体系指南》', '《创新者的窘境》', '《从优秀到卓越》'],
  },
  ISFJ: {
    strengths: ['细节观察', '共情理解', '服务意识', '稳定执行'],
    weaknesses: ['自信表达', '边界设定', '变化适应'],
    strengthActions: [
      '每日记录 3 个观察到的美好细节',
      '学习护理、教育等服务类知识深化能力',
      '建立个人日常系统确保稳定输出',
    ],
    weaknessActions: [
      '每日刻意表达 1 次真实想法（即使不完美）',
      '学习设定健康的工作和人际边界',
      '每周尝试 1 个小变化打破常规',
    ],
    resources: ['《被讨厌的勇气》', '《界限》', '《心流》'],
  },
  ESTJ: {
    strengths: ['执行思维', '组织规划', '决策果断', '效率优化'],
    weaknesses: ['情感感知', '灵活调整', '创新接纳'],
    strengthActions: [
      '每周优化 1 个工作或生活流程',
      '学习组织管理和运营效率方法',
      '练习在压力下快速做出高质量决策',
    ],
    weaknessActions: [
      '每日进行 10 分钟情感感知练习（识别自己和他人情绪）',
      '学习刻意放慢节奏，倾听不同意见',
      '每周尝试 1 个非传统的方法解决问题',
    ],
    resources: ['《高效能人士的七个习惯》', '《关键对话》', '《创新者的基因》'],
  },
  ESFJ: {
    strengths: ['人际思维', '细节关怀', '协调组织', '服务热情'],
    weaknesses: ['自我需求', '批评处理', '独立决策'],
    strengthActions: [
      '每周组织 1 次家庭或朋友聚会',
      '学习事件管理和活动策划技能',
      '练习细致的关怀和支持表达',
    ],
    weaknessActions: [
      '每日安排专属的自我关爱时间',
      '练习将批评与自我价值分离',
      '每周独立做出 1 个重要决定（不依赖他人意见）',
    ],
    resources: ['《自爱》', '《被讨厌的勇气》', '《界限》'],
  },
  ISTP: {
    strengths: ['实操思维', '问题解决', '冷静分析', '灵活应变'],
    weaknesses: ['长期规划', '情感表达', '承诺坚持'],
    strengthActions: [
      '每周动手解决 1 个实际问题',
      '学习机械、电子、编程等实操技能',
      '练习危机情况下的冷静决策',
    ],
    weaknessActions: [
      '设定 1 个 3 个月目标并分解到每日行动',
      '学习情绪词汇和情感表达方法',
      '刻意练习长期承诺并坚持完成',
    ],
    resources: ['《刻意练习》', '《情商》', '《原子习惯》'],
  },
  ISFP: {
    strengths: ['美学思维', '感官敏锐', '动手能力', '共情能力'],
    weaknesses: ['自信表达', '计划能力', '冲突应对'],
    strengthActions: [
      '每周进行 1 次艺术创作或手工制作',
      '练习用感官语言描述体验和感受',
      '学习设计、摄影、音乐等美学技能',
    ],
    weaknessActions: [
      '公开展示 1 次作品并收集反馈',
      '学习简单的项目规划和时间管理',
      '练习温和但坚定地表达不同意见',
    ],
    resources: ['《艺术家之路》', '《设计心理学》', '《心流》'],
  },
  ESTP: {
    strengths: ['行动思维', '快速决策', '灵活应变', '资源整合'],
    weaknesses: ['长期规划', '耐心坚持', '风险评估'],
    strengthActions: [
      '每周主动出击 1 个新机会或挑战',
      '学习谈判、销售等实战沟通技能',
      '练习快速分析和利用现有资源',
    ],
    weaknessActions: [
      '设定 1 个需要坚持 6 个月的目标',
      '学习在行动前进行系统的风险评估',
      '刻意练习延迟满足和长远思考',
    ],
    resources: ['《谈判力》', '《穷查理宝典》', '《远见》'],
  },
  ESFP: {
    strengths: ['体验思维', '人际魅力', '情绪感染', '即兴表达'],
    weaknesses: ['专注深度', '长期承诺', '规划能力'],
    strengthActions: [
      '每周进行 1 次新体验或冒险活动',
      '学习表演、演讲等表达性技能',
      '练习在人群中自然展现个人魅力',
    ],
    weaknessActions: [
      '每日进行 30 分钟深度专注练习',
      '设定并坚持 1 个需要长期投入的项目',
      '学习基础的财务和人生规划',
    ],
    resources: ['《表演》', '《深度工作》', '《小狗钱钱》'],
  },
};

// ============= MBTI → 行为系统映射 =============
const BEHAVIORAL_MAP = {
  // J型
  INTJ: {
    habits: [
      '每日固定 2 小时深度工作时间（不被打扰）',
      '每周日晚间进行下周规划（30 分钟）',
      '每日阅读 30 分钟专业书籍',
      '建立个人知识管理系统并每日更新',
    ],
    schedule: '晨间深度工作 → 午间处理事务 → 下午学习充电 → 晚间复盘规划',
    dailyActions: [
      '完成 1 个最重要的任务（MIT）',
      '阅读至少 10 页专业书籍',
      '记录 1 个有价值的洞察或想法',
    ],
    weeklySummary: '每周完成 5 个重要任务，阅读 50 页专业内容，产出 3 个新想法',
  },
  INTP: {
    habits: [
      '每日留出 1 小时不受打扰的思考时间',
      '建立个人兴趣项目，每周投入 5 小时',
      '随手记录想法和灵感（使用笔记应用）',
      '每周进行 1 次深度主题探索',
    ],
    schedule: '弹性时间块：深度思考（2h）→ 探索学习（2h）→ 项目实践（2h）→ 放松充电',
    dailyActions: [
      '花 30 分钟深入思考 1 个感兴趣的问题',
      '在个人项目上取得 1 个小进展',
      '记录至少 3 个想法或灵感',
    ],
    weeklySummary: '每周完成 1 个项目里程碑，探索 1 个新主题，记录 20 个想法',
  },
  ENTJ: {
    habits: [
      '每日早晨 30 分钟战略规划和优先级排序',
      '每周召开 1 次个人「董事会」复盘',
      '建立目标追踪系统，每日更新进度',
      '每日进行 30 分钟运动保持精力',
    ],
    schedule: '晨间规划（30min）→ 高价值任务（上午）→ 会议沟通（下午）→ 运动复盘（晚间）',
    dailyActions: [
      '完成当日优先级最高的 3 个任务',
      '进行 1 次重要沟通或决策',
      '向目标前进至少 1%',
    ],
    weeklySummary: '每周完成 15 个高价值任务，做出 5 个重要决策，向季度目标推进',
  },
  ENTP: {
    habits: [
      '每日留出 1 小时进行头脑风暴和创意探索',
      '每周接触 1 个新领域或新想法',
      '建立想法收集系统，定期回顾和筛选',
      '参加 1 次讨论或辩论活动保持思维活跃',
    ],
    schedule: '创意时段（上午）→ 讨论交流（下午）→ 项目推进（晚间）→ 灵感记录',
    dailyActions: [
      '产生至少 10 个新想法',
      '与至少 1 个人进行有深度的交流',
      '在项目上实现 1 个创意突破',
    ],
    weeklySummary: '每周产生 70 个新想法，完成 1 次深入讨论，实现 1 个创意项目里程碑',
  },
  INFJ: {
    habits: [
      '每日 30 分钟冥想或独处反思',
      '每周进行 1 次深度写作（1000 字以上）',
      '建立个人价值观清单，定期回顾校准',
      '每日阅读有深度的文学或哲学作品',
    ],
    schedule: '晨间冥想反思 → 深度专注工作 → 午后阅读充电 → 晚间写作表达',
    dailyActions: [
      '进行 20 分钟冥想或反思',
      '在重要项目上取得深入进展',
      '写 500 字以上的记录或创作',
    ],
    weeklySummary: '每周完成 1 篇深度文章，进行 5 次冥想，在个人成长上取得实质性进步',
  },
  INFP: {
    habits: [
      '每日进行创意表达（写作/绘画/音乐）',
      '每周接触 1 次自然或艺术活动',
      '建立个人价值观驱动的目标系统',
      '每日独处充电时间（至少 1 小时）',
    ],
    schedule: '自由节奏：灵感来了就创作 → 需要时就休息充电 → 按内在节奏推进',
    dailyActions: [
      '进行 30 分钟创意表达',
      '花时间感受和记录内在情绪',
      '完成 1 件让自己感到有意义的事',
    ],
    weeklySummary: '每周完成 1 个创意作品，进行 1 次自然接触，保持内在的充实和满足',
  },
  ENFJ: {
    habits: [
      '每日与至少 1 个人进行有深度的连接',
      '每周组织 1 次学习或成长小组',
      '建立个人成长日记，记录洞察和感悟',
      '每日阅读心理学或个人成长类书籍',
    ],
    schedule: '人际连接（白天）→ 组织协调（下午）→ 学习成长（晚间）→ 反思记录',
    dailyActions: [
      '与 1 个人进行有质量的对话',
      '帮助或支持至少 1 个人',
      '在个人成长上学到 1 个新东西',
    ],
    weeklySummary: '每周帮助 5 个人，组织 1 次活动，在个人成长上取得显著进步',
  },
  ENFP: {
    habits: [
      '每日探索 1 个新想法或可能性',
      '每周参加 1 次社交或创意活动',
      '建立愿景板或目标可视化系统',
      '每日留出自由时间跟随灵感',
    ],
    schedule: '灵感驱动：探索新想法 → 社交分享 → 创意执行 → 自由放松',
    dailyActions: [
      '探索 1 个令人兴奋的新可能性',
      '与朋友分享想法和热情',
      '在创意项目上取得进展',
    ],
    weeklySummary: '每周探索 7 个新想法，参加 2 次活动，完成 1 个创意小项目',
  },
  ISTJ: {
    habits: [
      '每日严格按照待办清单执行',
      '每周日进行完整的下周计划',
      '建立个人例行程序（早/中/晚）',
      '每日检查任务完成情况并记录',
    ],
    schedule: '固定节奏：晨间例行 → 上午专注任务 → 午后例行事务 → 晚间复盘总结',
    dailyActions: [
      '完成待办清单上的所有任务',
      '保持工作和生活环境的整洁有序',
      '按计划推进长期目标',
    ],
    weeklySummary: '每周完成 100% 的计划任务，保持稳定的节奏和高质量输出',
  },
  ISFJ: {
    habits: [
      '每日花时间关心和支持身边的人',
      '建立稳定的日常节奏确保安全感',
      '每周进行 1 次家庭或个人维护工作',
      '每日记录值得感恩的 3 件事',
    ],
    schedule: '温暖节奏：晨间照顾自己和家人 → 上午专注任务 → 午后关怀支持 → 晚间温馨放松',
    dailyActions: [
      '完成承诺的所有责任和义务',
      '至少支持或关心 1 个人',
      '保持日常的稳定和和谐',
    ],
    weeklySummary: '每周履行所有责任，支持 5 个人，保持生活的温暖和稳定',
  },
  ESTJ: {
    habits: [
      '每日早晨制定清晰的当日计划',
      '每周进行效率复盘和流程优化',
      '建立任务追踪系统确保执行到位',
      '每日进行运动保持身体状态',
    ],
    schedule: '高效节奏：晨间规划 → 上午攻坚 → 下午协调 → 晚间复盘',
    dailyActions: [
      '完成所有计划任务并追求高质量',
      '至少解决 1 个问题或优化 1 个流程',
      '带领团队或自己高效前进',
    ],
    weeklySummary: '每周完成所有计划任务，优化 2 个流程，推动团队高效运转',
  },
  ESFJ: {
    habits: [
      '每日主动联系至少 1 个朋友或家人',
      '每周组织 1 次聚会或活动',
      '建立和谐的人际环境维护习惯',
      '每日记录让自己开心的小事',
    ],
    schedule: '温暖节奏：晨间准备 → 日间社交关怀 → 午后组织协调 → 晚间家庭温馨',
    dailyActions: [
      '主动关心或联系至少 2 个人',
      '营造和谐的人际氛围',
      '完成对他人的承诺和帮助',
    ],
    weeklySummary: '每周联系 14 个人，组织 1 次活动，保持人际圈的温暖和谐',
  },
  // P型
  ISTP: {
    habits: [
      '每日动手实践或操作 1 件事',
      '每周探索 1 个新的技术或技能',
      '建立工具箱和技能库并持续扩充',
      '当遇到问题时立即动手尝试解决',
    ],
    schedule: '灵活节奏：遇到问题就解决 → 有兴趣就深入 → 需要休息就放松',
    dailyActions: [
      '动手解决至少 1 个实际问题',
      '练习或学习 1 个实用技能',
      '保持对周围环境的观察和掌控',
    ],
    weeklySummary: '每周解决 5 个实际问题，学习 1 个新技能，完成 1 个动手项目',
  },
  ISFP: {
    habits: [
      '每日进行感官体验（自然/艺术/美食）',
      '每周进行 1 次艺术或手工创作',
      '建立个人的美学空间和仪式',
      '照顾身边的植物、动物或环境',
    ],
    schedule: '感受节奏：跟随自然和灵感 → 创作时专注投入 → 需要时充分放松',
    dailyActions: [
      '进行 1 次感官体验或艺术创作',
      '感受并记录当下的美好',
      '照顾好自己和周围的小世界',
    ],
    weeklySummary: '每周完成 1 个创作作品，进行 3 次自然接触，保持内心的平和美好',
  },
  ESTP: {
    habits: [
      '每日进行运动或身体活动',
      '每周主动寻找 1 次新体验或挑战',
      '建立快速决策和行动的肌肉记忆',
      '每日与不同的人互动保持状态',
    ],
    schedule: '行动节奏：抓住机会就行动 → 需要时全力冲刺 → 放松时彻底充电',
    dailyActions: [
      '采取至少 1 个大胆行动',
      '在运动或活动中释放能量',
      '利用机会推动事情前进',
    ],
    weeklySummary: '每周完成 3 次大胆行动，进行 5 次运动，抓住并利用好每个机会',
  },
  ESFP: {
    habits: [
      '每日寻找乐趣和开心的事',
      '每周参加 1 次聚会或娱乐活动',
      '建立个人的快乐清单和灵感库',
      '每日与朋友或家人分享快乐',
    ],
    schedule: '快乐节奏：享受当下 → 参与活动 → 与人连接 → 自由放松',
    dailyActions: [
      '做至少 1 件让自己开心的事',
      '与朋友分享快乐和美好',
      '充分感受和享受当下',
    ],
    weeklySummary: '每周参加 2 次活动，让自己开心 7 次，与朋友分享快乐 10 次',
  },
};

// ============= MBTI → 表达系统映射 =============
const EXPRESSIVE_MAP = {
  INTJ: {
    style: '清晰 · 克制 · 结构 · 权威',
    styleDesc: '你的表达风格偏向逻辑清晰、结构严谨，不喜欢冗余和情绪化。适合通过书面、规划、战略等方式发挥影响力。',
    exercises: [
      '每周进行 1 次结构化写作（500 字以上，有清晰的论点和论据）',
      '每日练习用 3 句话总结一个复杂问题',
      '每周录制 1 次 5 分钟的观点表达视频并回看',
    ],
    feedback: '注意在表达中加入适当的情感温度和人际连接，避免过于冰冷或高高在上。建议在正式表达前先建立情感共鸣。',
    imageTips: '延续时尚模块的风格，建议强化「专业权威」的形象定位：利落的剪裁、低调但有质感的面料、中性偏深的色调。配饰选择简约但有品质感的金属或皮质单品。',
  },
  INTP: {
    style: '思辨 · 探索 · 概念 · 灵活',
    styleDesc: '你的表达风格偏向思辨和探索，喜欢用概念和类比解释复杂事物。适合在讨论、写作、教学等场景发挥优势。',
    exercises: [
      '每周写 1 篇概念解释文章（用通俗语言解释专业概念）',
      '每日进行 1 次 2 分钟的即兴解释练习（随机选一个词）',
      '参加 1 次线上或线下的讨论小组',
    ],
    feedback: '注意表达的落地性和可操作性，避免过于抽象或脱离实际。建议在表达后加上「具体来说」或「举个例子」。',
    imageTips: '适合「知识分子休闲」风格：舒适但有质感的棉麻、针织、简约但有设计感的单品。可以尝试一些带有文化或学术气息的配饰（复古眼镜、帆布包等）。',
  },
  ENTJ: {
    style: '果断 · 领导力 · 目标导向 · 有气场',
    styleDesc: '你的表达风格天然带有领导力和决断力，能够清晰传达目标和方向。适合在演讲、会议、谈判等场景发挥影响力。',
    exercises: [
      '每周进行 1 次 10 分钟的演讲练习（可以是模拟会议）',
      '每日练习用 1 句话明确传达一个决定或指令',
      '每周观看 1 次优秀的商业演讲并分析学习',
    ],
    feedback: '注意倾听他人的反馈和意见，避免过于强势或独断。建议在表达后主动询问「你怎么看？」或「有没有不同想法？」。',
    imageTips: '适合「商界领袖」风格：挺括的西装、利落的大衣、质感皮革。选择深色系（深蓝、炭灰、酒红）来强化权威感。配饰选择高品质的金属表带手表、皮质公文包。',
  },
  ENTP: {
    style: '机智 · 辩论 · 即兴 · 有感染力',
    styleDesc: '你的表达风格充满机锋和创意，擅长即兴辩论和多角度阐述。适合在讨论、创意、演讲等场景激发他人。',
    exercises: [
      '每周进行 1 次即兴演讲练习（随机话题，5 分钟）',
      '每日练习 3 个不同角度解释同一个观点',
      '参加 1 次辩论或头脑风暴活动',
    ],
    feedback: '注意表达的聚焦度和深度，避免过于发散或浅尝辄止。建议在发散后做一次总结和收束。',
    imageTips: '适合「创意先锋」风格：可以尝试一些不规则剪裁、金属感面料、混搭风格。用亮色系或金属色作为点缀，展现你的前卫和个性。',
  },
  INFJ: {
    style: '深邃 · 洞察 · 共情 · 有温度',
    styleDesc: '你的表达风格带有深度和洞察力，能够触及他人内心。适合在写作、咨询、教学等一对一或小范围场景发挥影响力。',
    exercises: [
      '每周写 1 篇深度文章（1000 字以上）',
      '每日进行 10 分钟的反思写作',
      '每周与 1 个人进行深度对话（30 分钟以上）',
    ],
    feedback: '注意表达的清晰性和条理性，避免过于隐晦或难以理解。建议在表达前先梳理清楚核心观点。',
    imageTips: '适合「知性文艺」风格：垂坠感面料、柔和的深色调（墨绿、藏青、深紫）、简约但有设计感的单品。可以选择一些带有文化气息的配饰（丝绸围巾、木质饰品）。',
  },
  INFP: {
    style: '诗意 · 真诚 · 柔软 · 有灵气',
    styleDesc: '你的表达风格真诚而富有诗意，能够用文字和情感打动他人。适合在写作、艺术、创意表达等场景发挥独特魅力。',
    exercises: [
      '每周写 1 首诗或 1 篇散文',
      '每日记录 3 个让自己感动的瞬间',
      '尝试用创意方式（绘画/音乐/视频）表达 1 个想法',
    ],
    feedback: '注意表达的逻辑性和结构感，避免过于情绪化或缺乏条理。建议在感性表达后加上理性的总结和升华。',
    imageTips: '适合「浪漫文艺」风格：棉麻、针织、飘逸的面料，柔和的色调（雾蓝、淡紫、米白），层叠穿搭营造氛围感。可以选择一些手工感或自然元素的配饰。',
  },
  ENFJ: {
    style: '温暖 · 鼓舞 · 连接 · 有魅力',
    styleDesc: '你的表达风格温暖而有感染力，能够激发他人的潜力和热情。适合在演讲、教学、教练等场景发挥领导力。',
    exercises: [
      '每周进行 1 次 5 分钟的鼓舞性演讲',
      '每日练习真诚地赞美或鼓励 1 个人',
      '每周组织 1 次分享会或学习小组',
    ],
    feedback: '注意表达的真诚度和边界感，避免过于讨好或失去自我。建议在关怀他人的同时也照顾好自己的需求。',
    imageTips: '适合「温暖优雅」风格：针织、天鹅绒等柔软质感的面料，暖色调（酒红、暖橙、大地色），流线型剪裁。配饰选择一些带有温度感的单品（丝巾、珍珠、柔和的金色饰品）。',
  },
  ENFP: {
    style: '热情 · 创意 · 自由 · 有活力',
    styleDesc: '你的表达风格充满热情和创意，能够用活力感染周围的人。适合在创意、社交、激励等场景发挥能量。',
    exercises: [
      '每周进行 1 次即兴创意表达（可以是故事/演讲/表演）',
      '每日分享 1 个让自己兴奋的想法或发现',
      '参加 1 次社交活动并主动认识新朋友',
    ],
    feedback: '注意表达的持续性和完成度，避免过于冲动或虎头蛇尾。建议在热情表达后制定可执行的行动计划。',
    imageTips: '适合「活力创意」风格：色彩明亮（亮黄、珊瑚、天蓝），休闲混搭，有设计感的单品。可以大胆尝试撞色、印花、层次搭配，展现你的独特个性。',
  },
  ISTJ: {
    style: '稳重 · 准确 · 可靠 · 有条理',
    styleDesc: '你的表达风格稳重而准确，注重事实和细节。适合在正式、专业、需要可靠性的场景发挥优势。',
    exercises: [
      '每周进行 1 次结构化汇报练习',
      '每日练习用清晰简洁的语言描述事实',
      '学习并练习 1 种高效的笔记或记录方法',
    ],
    feedback: '注意表达的灵活性和温度感，避免过于刻板或缺乏人情味。建议在正式表达中加入一些个人化的元素或幽默感。',
    imageTips: '适合「经典专业」风格：合身的西装、挺括的衬衫、品质基础款。选择经典色系（灰、深蓝、卡其），剪裁干净利落。配饰选择简约但高品质的基础款（皮质表带、真皮钱包）。',
  },
  ISFJ: {
    style: '温柔 · 细致 · 关怀 · 可靠',
    styleDesc: '你的表达风格温柔而细致，让人感到被关怀和被重视。适合在服务、教育、关怀类场景发挥独特价值。',
    exercises: [
      '每周进行 1 次温暖的表达练习（可以是感谢信/鼓励的话）',
      '每日练习细致地观察并肯定他人的优点',
      '学习非暴力沟通和积极倾听技巧',
    ],
    feedback: '注意表达的自信度和坚定性，避免过于谦虚或不敢表达真实想法。建议在关怀他人的同时也坚定地表达自己的立场。',
    imageTips: '适合「温柔优雅」风格：柔软的棉质、针织、雪纺，浅色调（浅粉、米色、灰蓝），舒适但有品味的单品。配饰选择精致小巧的饰品（珍珠耳钉、细项链），传递温柔细致的气质。',
  },
  ESTJ: {
    style: '直接 · 果断 · 实际 · 有效率',
    styleDesc: '你的表达风格直接而高效，注重结果和执行。适合在管理、运营、执行类场景发挥领导力。',
    exercises: [
      '每周进行 1 次高效会议或汇报练习',
      '每日练习用最少的话传达最关键的信息',
      '学习结构化思维和金字塔原理',
    ],
    feedback: '注意表达的语气和方式，避免过于生硬或强势。建议在直接表达的同时也考虑他人的感受，用建议的方式代替命令。',
    imageTips: '适合「商界精英」风格：挺括的西装、利落的风衣、精纺面料。选择深蓝、黑、深灰等权威色系。配饰选择高品质的商务单品（皮质手提包、金属袖扣、品牌手表）。',
  },
  ESFJ: {
    style: '亲和 · 热情 · 关怀 · 有号召力',
    styleDesc: '你的表达风格亲和而热情，能够自然地与他人建立连接。适合在社交、服务、组织类场景发挥影响力。',
    exercises: [
      '每周进行 1 次温暖的公开表达（可以是聚会致辞/感谢语）',
      '每日主动与至少 2 个人建立积极的连接',
      '学习有效的赞美和鼓励的表达技巧',
    ],
    feedback: '注意表达的真实性和自我照顾，避免过于讨好或牺牲自己。建议在照顾他人感受的同时也真实地表达自己的需求。',
    imageTips: '适合「温暖亲和」风格：针织、雪纺等柔和面料，暖粉、淡紫、米色等温柔色调，优雅柔和的剪裁。配饰选择带有人情味的单品（丝巾、花饰、圆润的珠宝）。',
  },
  ISTP: {
    style: '冷静 · 简洁 · 实用 · 有力量',
    styleDesc: '你的表达风格冷静而简洁，用最少的话传达最实用的信息。适合在技术、实操、危机处理类场景发挥优势。',
    exercises: [
      '每周进行 1 次技术讲解或操作演示',
      '每日练习用 1 句话说清一个解决方案',
      '学习结构化的问题分析和表达方法',
    ],
    feedback: '注意表达的丰富性和情感性，避免过于单调或缺乏温度。建议在实用表达的基础上增加一些个人风格和幽默感。',
    imageTips: '适合「机能实用」风格：牛仔、机能面料、皮革，黑、灰、军绿等色调，利落干练的剪裁。配饰选择有力量感的单品（皮质手链、机械表、工装靴）。',
  },
  ISFP: {
    style: '自然 · 细腻 · 艺术 · 有温度',
    styleDesc: '你的表达风格自然而细腻，通过感官和艺术方式传递感受。适合在艺术、设计、自然类场景发挥独特美感。',
    exercises: [
      '每周进行 1 次艺术表达（绘画/手工/摄影）',
      '每日用感官语言描述 1 个体验（看到/听到/闻到/触到）',
      '学习视觉化表达和故事化叙述技巧',
    ],
    feedback: '注意表达的清晰度和逻辑性，避免过于模糊或难以捉摸。建议在感性表达后加上简单的理性总结，帮助他人更好地理解。',
    imageTips: '适合「自然艺术」风格：亚麻、丝绸、绒面等天然面料，淡紫、灰绿、粉彩等柔和色调，飘逸自然的剪裁。配饰选择带有自然元素的单品（木质饰品、干花、贝壳）。',
  },
  ESTP: {
    style: '大胆 · 直接 · 有魅力 · 有行动力',
    styleDesc: '你的表达风格大胆而直接，充满行动的力量感。适合在销售、谈判、激励类场景发挥能量。',
    exercises: [
      '每周进行 1 次推销或说服练习',
      '每日练习在 30 秒内抓住他人注意力',
      '学习故事化表达和情绪感染力技巧',
    ],
    feedback: '注意表达的深度和思考性，避免过于表面或冲动。建议在大胆行动前先花 5 分钟思考策略和后果。',
    imageTips: '适合「大胆前卫」风格：皮革、亮面、金属质感，亮红、橙、黑等冲击感色调，紧身或短款的剪裁。配饰选择有冲击力的单品（铆钉、链条、夸张的金属饰品）。',
  },
  ESFP: {
    style: '热情 · 表演 · 闪耀 · 有感染力',
    styleDesc: '你的表达风格热情而富有表演性，能够在人群中脱颖而出。适合在表演、主持、社交类场景发挥魅力。',
    exercises: [
      '每周进行 1 次表演性表达（可以是唱歌/讲故事/主持）',
      '每日练习用夸张但自然的方式表达情绪',
      '参加 1 次表演或即兴活动',
    ],
    feedback: '注意表达的真诚度和适度性，避免过于夸张或显得不真实。建议在热情表达的同时也展现真实的自我和深度。',
    imageTips: '适合「闪耀派对」风格：亮片、缎面、丝绒等有光泽感的面料，金、亮粉、红等闪耀色调，戏剧感廓形。配饰选择大胆的单品（夸张耳环、亮片包、金属感腰带）。',
  },
};

// ============= 核心生成函数 =============
export function generateDevelopmentPlan(input = {}) {
  logger.session('═══════════════════════════════════════');
  logger.session('[培养方案][生成] 开始', input);

  const mbti = input.mbti?.toUpperCase() || 'INTJ';
  const decisionStyle = input.decisionStyle || null;
  const disciplineLevel = input.disciplineLevel || null;
  const socialStyle = input.socialStyle || null;

  // Step 1: 语言系统
  logger.session('[培养方案][Step 1] 语言系统映射', { mbti });
  const langData = LANGUAGE_MAP[mbti] || LANGUAGE_MAP.INTJ;

  // Step 2: 认知系统
  logger.session('[培养方案][Step 2] 认知系统映射', { mbti, decisionStyle });
  const cogData = COGNITIVE_MAP[mbti] || COGNITIVE_MAP.INTJ;

  // Step 3: 行为系统
  logger.session('[培养方案][Step 3] 行为系统映射', { mbti, disciplineLevel });
  const behData = BEHAVIORAL_MAP[mbti] || BEHAVIORAL_MAP.INTJ;

  // Step 4: 表达系统
  logger.session('[培养方案][Step 4] 表达系统映射', { mbti, socialStyle });
  const expData = EXPRESSIVE_MAP[mbti] || EXPRESSIVE_MAP.INTJ;

  // 计算综合状态
  const status = {
    language: langData.level.listening,
    cognitive: (mbti[2] === 'T' ? '逻辑型' : '情感型') + ' · ' + (mbti[1] === 'N' ? '直觉型' : '实感型'),
    behavior: mbti[3] === 'J' ? '高纪律' : '高灵活',
    expression: expData.style.split(' · ')[0],
  };

  const plan = {
    mbti,
    generatedAt: Date.now(),
    status,
    modules: {
      language: {
        learningStyle: langData.learningStyle,
        learningStyleLabel: langData.learningStyleLabel,
        approach: langData.approach,
        path: langData.path,
        progress: langData.level,
        weeklyGoal: langData.weeklyGoal,
      },
      cognitive: {
        strengths: cogData.strengths,
        weaknesses: cogData.weaknesses,
        strengthActions: cogData.strengthActions,
        weaknessActions: cogData.weaknessActions,
        resources: cogData.resources,
      },
      behavioral: {
        habits: behData.habits,
        schedule: behData.schedule,
        dailyActions: behData.dailyActions,
        weeklySummary: behData.weeklySummary,
      },
      expressive: {
        style: expData.style,
        styleDesc: expData.styleDesc,
        exercises: expData.exercises,
        feedback: expData.feedback,
        imageTips: expData.imageTips,
      },
    },
  };

  logger.session('[培养方案][完成] 方案生成成功', {
    mbti,
    moduleCount: 4,
  });
  logger.session('═══════════════════════════════════════');

  return plan;
}

// 获取模块统计信息
export function getModuleStats(plan) {
  if (!plan?.modules) return { language: 0, cognitive: 0, behavioral: 0, expressive: 0 };
  const m = plan.modules;
  return {
    language: (m.language?.approach?.length || 0),
    cognitive: (m.cognitive?.strengthActions?.length || 0) + (m.cognitive?.weaknessActions?.length || 0),
    behavioral: (m.behavioral?.habits?.length || 0),
    expressive: (m.expressive?.exercises?.length || 0),
  };
}

export const developmentEngine = {
  generateDevelopmentPlan,
  getModuleStats,
  LANGUAGE_MAP,
  COGNITIVE_MAP,
  BEHAVIORAL_MAP,
  EXPRESSIVE_MAP,
};

export default developmentEngine;
