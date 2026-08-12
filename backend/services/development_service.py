"""
人格培养方案服务层
基于用户人格数据生成个性化发展方案
包含语言、认知、行为、表达四个模块
"""
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# ============================================================
# MBTI 语言系统映射
# ============================================================

LANGUAGE_MAP = {
    'INTJ': {
        'learningStyle': 'reading',
        'learningStyleLabel': '阅读型 + 系统型',
        'approach': [
            '以语法结构和逻辑分析为主',
            '使用技术类英文文档作为阅读材料',
            '建立语言知识的系统框架',
            '通过写作加深语法掌握'
        ],
        'path': ['基础语法结构', '技术文档精读', '专业学术写作', '跨语言逻辑表达'],
        'progress': {
            'vocabulary': 5000,
            'listening': 'B1',
            'reading': 'B2',
            'speaking': 'A2',
            'writing': 'B1'
        },
        'weeklyGoal': '完成3篇技术文章的精读，整理核心术语表'
    },
    'INTP': {
        'learningStyle': 'reading',
        'learningStyleLabel': '阅读型 + 系统型',
        'approach': [
            '通过分析语言规律掌握语法',
            '阅读科学与哲学类英文原著',
            '使用思维导图整理语言结构',
            '编程与英语结合学习'
        ],
        'path': ['语法逻辑分析', '科学论文阅读', '概念性写作', '抽象思维表达'],
        'progress': {
            'vocabulary': 4500,
            'listening': 'B1',
            'reading': 'B2',
            'speaking': 'A2',
            'writing': 'B1'
        },
        'weeklyGoal': '阅读1篇英文学术论文摘要，记录20个专业词汇'
    },
    'ENTJ': {
        'learningStyle': 'auditory',
        'learningStyleLabel': '听力型 + 对话型',
        'approach': [
            '收听商业和领导力播客',
            '参与英语辩论和演讲活动',
            '通过对话练习提高流利度',
            '模拟商务谈判场景'
        ],
        'path': ['商务听力训练', '对话流利度', '演讲与表达', '领导力沟通'],
        'progress': {
            'vocabulary': 6000,
            'listening': 'B2',
            'reading': 'B1',
            'speaking': 'B1',
            'writing': 'B1'
        },
        'weeklyGoal': '收听5期商业播客，完成2次模拟商务对话'
    },
    'ENTP': {
        'learningStyle': 'auditory',
        'learningStyleLabel': '听力型 + 对话型',
        'approach': [
            '收听辩论和脱口秀节目',
            '参与即兴英语对话',
            '通过争论和讨论学习',
            '尝试用英语进行头脑风暴'
        ],
        'path': ['辩论听力', '即兴对话', '创意表达', '跨文化沟通'],
        'progress': {
            'vocabulary': 5500,
            'listening': 'B2',
            'reading': 'B1',
            'speaking': 'B1',
            'writing': 'A2'
        },
        'weeklyGoal': '观看3场英文辩论，完成1次英语即兴演讲练习'
    },
    'INFJ': {
        'learningStyle': 'reading',
        'learningStyleLabel': '阅读型 + 沉浸型',
        'approach': [
            '阅读文学作品和诗歌',
            '通过写作表达内心世界',
            '观看有深度的人文电影',
            '写英语日记和随笔'
        ],
        'path': ['文学阅读', '情感词汇', '创意写作', '人文表达'],
        'progress': {
            'vocabulary': 5000,
            'listening': 'B1',
            'reading': 'B2',
            'speaking': 'B1',
            'writing': 'B2'
        },
        'weeklyGoal': '阅读1篇英文短篇小说，完成3篇英语日记'
    },
    'INFP': {
        'learningStyle': 'reading',
        'learningStyleLabel': '阅读型 + 沉浸型',
        'approach': [
            '阅读幻想和 YA 小说',
            '用英语写诗和故事',
            '通过音乐学习英语',
            '参与英语创意写作小组'
        ],
        'path': ['故事阅读', '情感表达', '创意写作', '艺术化沟通'],
        'progress': {
            'vocabulary': 4500,
            'listening': 'B1',
            'reading': 'B2',
            'speaking': 'A2',
            'writing': 'B2'
        },
        'weeklyGoal': '阅读1本英文青少年小说的2个章节，创作1首英文短诗'
    },
    'ENFJ': {
        'learningStyle': 'auditory',
        'learningStyleLabel': '对话型 + 视觉型',
        'approach': [
            '观看人文主题的影视材料',
            '参与社交英语对话',
            '进行角色扮演练习',
            '教授他人来巩固自己的学习'
        ],
        'path': ['影视听力', '社交对话', '角色扮演', '激励性表达'],
        'progress': {
            'vocabulary': 5500,
            'listening': 'B2',
            'reading': 'B1',
            'speaking': 'B2',
            'writing': 'B1'
        },
        'weeklyGoal': '观看2部英文电影，组织1次英语角讨论活动'
    },
    'ENFP': {
        'learningStyle': 'auditory',
        'learningStyleLabel': '对话型 + 视觉型',
        'approach': [
            '观看美剧和脱口秀',
            '参与有趣的英语社交活动',
            '用英语讲故事和笑话',
            '多国语言混合学习'
        ],
        'path': ['娱乐影视', '社交表达', '故事讲述', '多元化沟通'],
        'progress': {
            'vocabulary': 5000,
            'listening': 'B2',
            'reading': 'B1',
            'speaking': 'B2',
            'writing': 'A2'
        },
        'weeklyGoal': '观看3集美剧，用英语给朋友讲一个有趣的故事'
    },
    'ISTJ': {
        'learningStyle': 'reading',
        'learningStyleLabel': '阅读型 + 重复型',
        'approach': [
            '使用结构化教材系统学习',
            '做语法和词汇的重复练习',
            '背诵常用句型和表达',
            '制定严格的学习计划并执行'
        ],
        'path': ['基础教材', '语法强化', '词汇积累', '实用写作'],
        'progress': {
            'vocabulary': 6000,
            'listening': 'B1',
            'reading': 'B2',
            'speaking': 'A2',
            'writing': 'B1'
        },
        'weeklyGoal': '完成教材的5课内容，背诵100个核心词汇'
    },
    'ISFJ': {
        'learningStyle': 'reading',
        'learningStyleLabel': '阅读型 + 重复型',
        'approach': [
            '使用温暖友好的学习材料',
            '反复练习日常对话',
            '通过帮助他人学习来巩固',
            '学习实用的日常英语'
        ],
        'path': ['日常英语', '对话练习', '实用表达', '关怀式沟通'],
        'progress': {
            'vocabulary': 5000,
            'listening': 'B1',
            'reading': 'B1',
            'speaking': 'B1',
            'writing': 'B1'
        },
        'weeklyGoal': '学习10个日常场景对话，完成3次听力练习'
    },
    'ESTJ': {
        'learningStyle': 'auditory',
        'learningStyleLabel': '对话型 + 实用型',
        'approach': [
            '学习实用商务英语',
            '进行真实场景对话练习',
            '任务驱动式学习',
            '建立英语学习的制度和规范'
        ],
        'path': ['商务英语', '场景对话', '任务训练', '管理沟通'],
        'progress': {
            'vocabulary': 6500,
            'listening': 'B2',
            'reading': 'B1',
            'speaking': 'B2',
            'writing': 'B1'
        },
        'weeklyGoal': '完成2个商务英语任务，进行1次全英文工作会议模拟'
    },
    'ESFJ': {
        'learningStyle': 'auditory',
        'learningStyleLabel': '对话型 + 实用型',
        'approach': [
            '学习社交和服务场景英语',
            '在真实社交中练习',
            '小组合作学习',
            '关注他人的反馈来改进'
        ],
        'path': ['社交英语', '服务场景', '团队对话', '和谐沟通'],
        'progress': {
            'vocabulary': 5500,
            'listening': 'B2',
            'reading': 'B1',
            'speaking': 'B2',
            'writing': 'B1'
        },
        'weeklyGoal': '参加2次英语社交活动，用英语完成1次服务场景模拟'
    },
    'ISTP': {
        'learningStyle': 'kinesthetic',
        'learningStyleLabel': '体验型 + 视觉型',
        'approach': [
            '通过动手实践学习英语',
            '观看技术教程和DIY视频',
            '在实际操作中使用英语',
            '学习机械和技术相关词汇'
        ],
        'path': ['技术英语', '实操场景', '视频学习', '实用技能表达'],
        'progress': {
            'vocabulary': 4500,
            'listening': 'B1',
            'reading': 'B1',
            'speaking': 'B1',
            'writing': 'A2'
        },
        'weeklyGoal': '观看3个英文技术教程视频，用英文记录操作步骤'
    },
    'ISFP': {
        'learningStyle': 'kinesthetic',
        'learningStyleLabel': '体验型 + 视觉型',
        'approach': [
            '通过艺术和音乐学习英语',
            '沉浸式体验英语文化',
            '观看美学相关视频',
            '用英语进行艺术创作'
        ],
        'path': ['艺术英语', '沉浸体验', '美学表达', '感官式学习'],
        'progress': {
            'vocabulary': 4000,
            'listening': 'B1',
            'reading': 'B1',
            'speaking': 'B1',
            'writing': 'A2'
        },
        'weeklyGoal': '听5首英文歌曲并理解歌词，用英文描述一幅艺术作品'
    },
    'ESTP': {
        'learningStyle': 'kinesthetic',
        'learningStyleLabel': '对话型 + 体验型',
        'approach': [
            '在真实社交场景中学习',
            '通过行动和体验掌握',
            '看体育和娱乐节目',
            '参与竞争性的英语活动'
        ],
        'path': ['社交实战', '娱乐英语', '行动表达', '高能量沟通'],
        'progress': {
            'vocabulary': 5000,
            'listening': 'B2',
            'reading': 'A2',
            'speaking': 'B2',
            'writing': 'A2'
        },
        'weeklyGoal': '参加1次英语社交聚会，观看2场英文体育赛事'
    },
    'ESFP': {
        'learningStyle': 'kinesthetic',
        'learningStyleLabel': '对话型 + 体验型',
        'approach': [
            '通过娱乐和表演学习',
            '参与派对和社交活动',
            '看综艺节目和真人秀',
            '用英语唱歌和表演'
        ],
        'path': ['娱乐英语', '表演表达', '社交互动', '活力沟通'],
        'progress': {
            'vocabulary': 4500,
            'listening': 'B2',
            'reading': 'A2',
            'speaking': 'B2',
            'writing': 'A2'
        },
        'weeklyGoal': '观看2集英文真人秀，学唱2首英文歌曲'
    }
}

# ============================================================
# MBTI 认知系统映射
# ============================================================

COGNITIVE_MAP = {
    # 直觉型 N
    'INTJ': {'strengths': ['系统思维', '战略规划'], 'weaknesses': ['细节关注', '情感感知'],
             'strengthActions': ['学习系统动力学', '进行跨学科研究', '每周写战略分析笔记'],
             'weaknessActions': ['每日数据记录练习', '进行5分钟正念观察', '学习财务报表分析'],
             'resources': ['《系统思考》', '《第五项修炼》', '《战略思维》']},
    'INTP': {'strengths': ['逻辑分析', '抽象思维'], 'weaknesses': ['执行落地', '人际沟通'],
             'strengthActions': ['研究形式逻辑', '阅读哲学原著', '构建理论模型'],
             'weaknessActions': ['每日完成1个小目标', '练习主动发起对话', '学习项目管理基础'],
             'resources': ['《思考，快与慢》', '《逻辑哲学论》', '《金字塔原理》']},
    'ENTJ': {'strengths': ['战略执行', '决策果断'], 'weaknesses': ['耐心倾听', '情感共鸣'],
             'strengthActions': ['学习企业战略', '做复杂决策练习', '阅读领导力书籍'],
             'weaknessActions': ['每日主动倾听5分钟', '练习共情回应', '学习非暴力沟通'],
             'resources': ['《从优秀到卓越》', '《领导力》', '《高效能人士的七个习惯》']},
    'ENTP': {'strengths': ['创意发散', '快速联想'], 'weaknesses': ['专注坚持', '系统规划'],
             'strengthActions': ['每日头脑风暴', '参加黑客马拉松', '练习思维导图'],
             'weaknessActions': ['使用番茄工作法', '制定周计划', '学习深度工作方法'],
             'resources': ['《创意黏合剂》', '《深度工作》', '《专注力》']},
    'INFJ': {'strengths': ['洞察人性', '长期规划'], 'weaknesses': ['实际操作', '冲突处理'],
             'strengthActions': ['写深度观察日记', '学习心理学理论', '进行人生设计'],
             'weaknessActions': ['学习动手技能', '练习表达不同意见', '阅读冲突管理书籍'],
             'resources': ['《思考，快与慢》', '《被讨厌的勇气》', '《人生设计课》']},
    'INFP': {'strengths': ['共情能力', '创意表达'], 'weaknesses': ['逻辑分析', '计划执行'],
             'strengthActions': ['练习情感写作', '学习艺术治疗', '进行创意冥想'],
             'weaknessActions': ['学习基础统计学', '制定每日时间表', '阅读批判性思维书籍'],
             'resources': ['《艺术家的路》', '《创造性自信》', '《批判性思维》']},
    'ENFJ': {'strengths': ['人际洞察', '激励鼓舞'], 'weaknesses': ['独立决策', '自我照顾'],
             'strengthActions': ['学习教练技术', '阅读心理学', '练习公众演讲'],
             'weaknessActions': ['练习独处和反思', '学会说不', '制定自我关怀计划'],
             'resources': ['《教练式领导》', '《非暴力沟通》', '《内向者优势》']},
    'ENFP': {'strengths': ['热情感染', '创意连接'], 'weaknesses': ['细节执行', '情绪稳定'],
             'strengthActions': ['练习即兴演讲', '连接不同领域的人', '记录灵感火花'],
             'weaknessActions': ['使用GTD方法', '练习情绪日记', '学习正念冥想'],
             'resources': ['《搞定》', '《情商》', '《创意，是一笔灵魂交易》']},

    # 实感型 S
    'ISTJ': {'strengths': ['细节精准', '可靠执行'], 'weaknesses': ['创新思维', '灵活应变'],
             'strengthActions': ['学习质量管理', '做精细数据分析', '建立标准化流程'],
             'weaknessActions': ['每周尝试新事物', '练习发散思维', '学习设计思维'],
             'resources': ['《创新者的窘境》', '《设计思维》', '《水平思考》']},
    'ISFJ': {'strengths': ['踏实可靠', '关怀他人'], 'weaknesses': [' assertiveness', '变化适应'],
             'strengthActions': ['学习护理和服务', '建立支持系统', '练习积极倾听'],
             'weaknessActions': ['练习表达需求', '尝试不熟悉的事物', '学习变化管理'],
             'resources': ['《表达力》', '《谁动了我的奶酪》', '《关键对话》']},
    'ESTJ': {'strengths': ['组织管理', '务实高效'], 'weaknesses': ['情感细腻', '创新开放'],
             'strengthActions': ['学习项目管理', '优化工作流程', '建立高效团队'],
             'weaknessActions': ['练习情感表达', '阅读文艺作品', '参加创意工作坊'],
             'resources': ['《项目管理知识体系》', '《情商》', '《创新者的基因》']},
    'ESFJ': {'strengths': ['团队协作', '服务热情'], 'weaknesses': ['独立思考', '接受批评'],
             'strengthActions': ['学习团队建设', '培养服务意识', '建立人际网络'],
             'weaknessActions': ['练习独立做决定', '记录反直觉思考', '阅读哲学科普'],
             'resources': ['《团队协作的五大障碍》', '《思考的艺术》', '《苏菲的世界》']},
    'ISTP': {'strengths': ['动手能力', '问题解决'], 'weaknesses': ['长期规划', '表达沟通'],
             'strengthActions': ['学习技术技能', '做DIY项目', '练习故障排除'],
             'weaknessActions': ['制定年度计划', '练习公众演讲', '写技术博客'],
             'resources': ['《原子习惯》', '《演讲的力量》', '《搞定》']},
    'ISFP': {'strengths': ['艺术感知', '动手创作'], 'weaknesses': ['逻辑规划', '时间管理'],
             'strengthActions': ['学习艺术技能', '进行手工创作', '培养审美能力'],
             'weaknessActions': ['学习基础财务', '使用日程规划', '阅读商业思维书籍'],
             'resources': ['《艺术的故事》', '《小狗钱钱》', '《时间管理》']},
    'ESTP': {'strengths': ['行动力强', '随机应变'], 'weaknesses': ['深度思考', '长期坚持'],
             'strengthActions': ['学习销售技能', '参加竞技活动', '练习快速决策'],
             'weaknessActions': ['每日冥想10分钟', '阅读深度文章', '学习长期投资'],
             'resources': ['《思考，快与慢》', '《原则》', '《投资最重要的事》']},
    'ESFP': {'strengths': ['社交魅力', '适应力强'], 'weaknesses': ['专注深度', '规划未来'],
             'strengthActions': ['学习表演艺术', '参加社交活动', '培养即兴能力'],
             'weaknessActions': ['练习深度阅读', '制定人生规划', '学习延迟满足'],
             'resources': ['《深度工作》', '《人生的智慧》', '《坚毅》']},
}

# ============================================================
# MBTI 行为系统映射
# ============================================================

BEHAVIORAL_MAP = {
    # J型
    'INTJ': {'habits': ['每日固定15分钟专注学习', '每周日晚制定下周计划', '每晚复盘当日成果'],
             'schedule': '晨间深度工作（8:00-11:00）+ 下午执行任务 + 晚间复盘',
             'dailyActions': ['读20页书', '写100字反思', '完成3项最重要的任务'],
             'weeklySummary': '完成周计划的80%以上，记录关键成果和待改进点'},
    'INFJ': {'habits': ['晨间冥想10分钟', '每日写日记', '每周一次深度对话'],
             'schedule': '清晨反思 + 白天专注创造 + 晚间阅读与写作',
             'dailyActions': ['冥想', '写日记', '完成1件有意义的事'],
             'weeklySummary': '保持内心平静，完成创造性工作，维护重要关系'},
    'ISTJ': {'habits': ['固定时间起床和就寝', '每日按清单执行任务', '每周日整理房间'],
             'schedule': '严格按照时间表执行，上午处理重要事务',
             'dailyActions': ['按时起床', '完成任务清单', '整理工作区域'],
             'weeklySummary': '100%完成计划任务，保持生活秩序井然'},
    'ISFJ': {'habits': ['早起准备一天', '每日感恩记录', '周末为家人做饭'],
             'schedule': '晨间照顾家人 + 上午专注工作 + 晚间陪伴',
             'dailyActions': ['感恩3件事', '完成工作职责', '关心一个人'],
             'weeklySummary': '工作尽责，照顾好家人，保持生活温馨'},
    'ENTJ': {'habits': ['早起运动+规划', '每日会议排期', '每周战略复盘'],
             'schedule': '晨间锻炼+规划 + 白天密集会议 + 晚间总结',
             'dailyActions': ['运动', '完成关键决策', '指导团队成员'],
             'weeklySummary': '达成关键目标，团队效率提升，推进重要项目'},
    'ESTJ': {'habits': ['严格执行时间表', '每日检查进度', '每周团队例会'],
             'schedule': '早间计划会 + 白天执行 + 晚间汇总',
             'dailyActions': ['检查进度', '沟通协调', '确保质量'],
             'weeklySummary': '团队目标达成，流程顺畅，无重大问题'},
    'ENFJ': {'habits': ['晨间激励冥想', '每日与不同人交流', '每周帮助他人'],
             'schedule': '清晨准备 + 白天社交与工作 + 晚间关怀',
             'dailyActions': ['鼓励1个人', '完成工作任务', '自我反思'],
             'weeklySummary': '团队士气高，帮助他人成长，个人也有进步'},
    'ESFJ': {'habits': ['早起为家人准备', '每日社交互动', '每周组织聚会'],
             'schedule': '晨间照顾 + 白天工作社交 + 晚间家庭时光',
             'dailyActions': ['问候3个人', '完成工作', '照顾家庭'],
             'weeklySummary': '人际关系和谐，家庭温馨，工作顺利'},

    # P型
    'INTP': {'habits': ['感兴趣时深度学习', '记录突发灵感', '允许弹性工作时间'],
             'schedule': '任务分段进行，在状态好时深度工作，灵感来随时记录',
             'dailyActions': ['研究感兴趣的问题', '记录思考', '保持好奇心'],
             'weeklySummary': '探索新知，解决至少一个有趣的问题，保持思维活跃'},
    'INFP': {'habits': ['跟随灵感创作', '与自己对话', '定期接触大自然'],
             'schedule': '创意工作与休息交替，根据心情调整节奏',
             'dailyActions': ['创作表达', '自我觉察', '做真实的自己'],
             'weeklySummary': '有创造性产出，内心平和，做了让自己开心的事'},
    'ISTP': {'habits': ['动手实践', '灵活安排任务', '随时应对问题'],
             'schedule': '动手工作 + 解决问题 + 享受当下',
             'dailyActions': ['动手做1件事', '解决1个问题', '享受乐趣'],
             'weeklySummary': '完成实操项目，掌握新技能，有成就感'},
    'ISFP': {'habits': ['用感官感受生活', '随性创作', '与美好事物共处'],
             'schedule': '感受当下 + 艺术创作 + 享受生活',
             'dailyActions': ['感官体验', '艺术表达', '照顾自己'],
             'weeklySummary': '有艺术创作，享受了生活，内心充实'},
    'ENTP': {'habits': ['头脑风暴', '多任务切换', '随时讨论和辩论'],
             'schedule': '任务分段 + 灵活切换 + 社交充电',
             'dailyActions': ['头脑风暴', '讨论交流', '探索新想法'],
             'weeklySummary': '产生多个创意，进行了有趣的讨论，学习了新东西'},
    'ENFP': {'habits': ['追逐热情', '和有趣的人交流', '体验新鲜事物'],
             'schedule': '跟随热情 + 社交互动 + 灵感爆发',
             'dailyActions': ['做喜欢的事', '社交互动', '创造乐趣'],
             'weeklySummary': '玩得开心，有创造性产出，建立了新连接'},
    'ESTP': {'habits': ['行动优先', '随机应变', '活在当下'],
             'schedule': '把握每个机会 + 快速行动 + 享受刺激',
             'dailyActions': ['采取行动', '解决问题', '享受生活'],
             'weeklySummary': '抓住了机会，解决了问题，过得精彩'},
    'ESFP': {'habits': ['主动社交', '尝试新体验', '寻找快乐'],
             'schedule': '社交 + 娱乐 + 体验生活',
             'dailyActions': ['社交互动', '享受乐趣', '创造快乐'],
             'weeklySummary': '和朋友玩得开心，体验了新事物，充满活力'},
}

# ============================================================
# MBTI 表达系统映射
# ============================================================

EXPRESSIVE_MAP = {
    'INTJ': {'style': '清晰 · 克制 · 结构',
             'styleDesc': '你的表达风格简洁有力，注重逻辑和结构。说话时深思熟虑，不喜欢冗余的表达。在人群中可能显得安静，但一旦发言往往切中要害。',
             'exercises': ['每周2次2分钟即兴演讲', '尝试用3句话解释复杂概念', '练习在会议上主动发言1次'],
             'feedback': '你的表达有很强的说服力，但可以适当增加一些情感温度，让他人更容易感受到你的真诚。',
             'imageTips': '建议选择简约、质感好的服装，深色系更能凸显你的理性气质。参考时尚模块的详细推荐。'},
    'INTP': {'style': '深度 · 思辨 · 幽默',
             'styleDesc': '你善于深度分析，说话时喜欢引用概念和逻辑。偶尔展现出的冷幽默很有魅力。但需要注意不要过于抽象，要贴近听众。',
             'exercises': ['用通俗语言解释技术概念', '每周讲1个笑话', '练习给别人做5分钟培训'],
             'feedback': '你的思维深度让人钦佩，但表达时要注意从听众的角度出发，让内容更容易被理解。',
             'imageTips': '可以选择一些带有设计感但不过于张扬的单品，展示你独特的品味。'},
    'ENTJ': {'style': '直接 · 有力 · 领导力',
             'styleDesc': '你说话直接有力，不绕弯子，天然带有领导气场。擅长激励和指挥，但有时可能显得过于强势。',
             'exercises': ['练习在发言前先征求他人意见', '每周进行1次公开演讲', '学习用故事传达观点'],
             'feedback': '你的领导力表达令人印象深刻，注意适当示弱和倾听，会让你更有魅力。',
             'imageTips': '选择剪裁合身的正装或商务休闲装，展现你的专业和权威。'},
    'ENTP': {'style': '机智 · 雄辩 · 有趣',
             'styleDesc': '你思维敏捷，善于辩论，说话时经常有出人意料的妙语。喜欢挑战既有观点，但要注意不要为了辩论而辩论。',
             'exercises': ['每周参加1次辩论或讨论', '练习用30秒讲清楚一个观点', '学习写有说服力的邮件'],
             'feedback': '你的机智和幽默很吸引人，注意把握分寸，避免让人感觉被冒犯。',
             'imageTips': '可以尝试一些大胆的搭配，展示你的个性和自信。'},
    'INFJ': {'style': '深刻 · 温和 · 共情',
             'styleDesc': '你表达时温和而有深度，善于体察他人的情绪。说话有分量，能给人带来启发。但需要注意不要过于追求完美。',
             'exercises': ['每周写1篇深度文章', '练习给朋友提供真诚的建议', '在小组中分享个人感悟'],
             'feedback': '你的话语能触动人的内心，这是非常珍贵的能力。可以练习更直接地表达自己的需求。',
             'imageTips': '选择自然、舒适但有质感的服装，柔和的色系更能衬托你的气质。'},
    'INFP': {'style': '真诚 · 诗意 · 治愈',
             'styleDesc': '你的表达真诚而富有诗意，善于用故事和隐喻来传达想法。给人温暖的感觉，但有时可能过于理想化。',
             'exercises': ['每周写1首诗或短文', '用故事来传达观点', '练习在公众场合分享个人经历'],
             'feedback': '你的真诚很打动人，但在需要做决断时可以更坚定一些。',
             'imageTips': '可以选择一些有文艺感的单品，展现你独特的审美和内心世界。'},
    'ENFJ': {'style': '温暖 · 激励 · 连接',
             'styleDesc': '你说话温暖而有感染力，善于激励他人，天生就是教练和导师的料。注意不要过于照顾他人而忽略自己。',
             'exercises': ['每周做1次公众演讲', '练习鼓励身边的人', '学习用故事激励团队'],
             'feedback': '你有让他人变得更好的天赋，记得也要关怀自己。',
             'imageTips': '选择温暖色系的服装，搭配一些经典的配饰，展现你的亲和力。'},
    'ENFP': {'style': '热情 · 多彩 · 启发',
             'styleDesc': '你表达充满热情和能量，善于用创意点亮气氛。给人带来无限的可能性，但有时可能缺乏系统性。',
             'exercises': ['每周进行1次即兴演讲', '用视觉辅助来表达想法', '练习把大想法拆成可执行的步骤'],
             'feedback': '你的热情很有感染力，注意落地执行，想法就会变成现实。',
             'imageTips': '可以大胆尝试色彩和混搭，展现你充满活力的个性。'},
    'ISTJ': {'style': '稳重 · 清晰 · 可靠',
             'styleDesc': '你说话稳重、有条理，给人可靠的感觉。习惯用事实和数据说话，但有时可能显得过于严肃。',
             'exercises': ['每周练习1次轻松的闲聊', '用图表辅助汇报', '学习在发言中加入个人经验'],
             'feedback': '你的可靠性是最大的资产，适当展现个人一面会让你更有亲和力。',
             'imageTips': '选择经典、低调但有品质的基本款，展现你的专业和可靠。'},
    'ISFJ': {'style': '亲切 · 细致 · 支持',
             'styleDesc': '你说话亲切温暖，善于关注细节，给人踏实的支持。但有时可能过于委婉，需要更直接地表达。',
             'exercises': ['练习更直接地表达需求', '每周进行1次正面反馈', '学习在沟通中设定边界'],
             'feedback': '你的细心和关怀让人感到温暖，学会更直接地表达会让沟通更高效。',
             'imageTips': '选择舒适、自然的服装，柔和的颜色和简约的设计最适合你。'},
    'ESTJ': {'style': '果断 · 务实 · 组织',
             'styleDesc': '你说话直接、有条理，善于组织和安排。做事效率高，但有时可能显得不够灵活。',
             'exercises': ['练习在做决定前听取不同意见', '每周进行1次团队建设活动', '学习用幽默化解紧张'],
             'feedback': '你的组织能力非常出色，增加一些灵活性会让团队更有创造力。',
             'imageTips': '选择整洁、干练的职业装，展现你的专业和组织能力。'},
    'ESFJ': {'style': '热情 · 和谐 · 社交',
             'styleDesc': '你说话热情友好，善于营造和谐氛围，是天生的社交达人。注意不要为了和谐而回避问题。',
             'exercises': ['练习处理困难对话', '每周组织1次社交活动', '学习给出建设性的反馈'],
             'feedback': '你的社交能力让人如沐春风，学会优雅地处理冲突会让你更强大。',
             'imageTips': '选择时尚但不过分张扬的服装，展现你的社交魅力。'},
    'ISTP': {'style': '简洁 · 务实 · 行动',
             'styleDesc': '你说话简洁明了，注重实际效果。善于解决问题，但表达时可能显得不够情绪化。',
             'exercises': ['练习分享自己的感受', '用演示来辅助表达', '每周进行1次演讲练习'],
             'feedback': '你的解决问题的能力很强，适当表达情感会让你更有魅力。',
             'imageTips': '选择功能性强、简约耐用的单品，展现你的务实和动手能力。'},
    'ISFP': {'style': '温柔 · 感官 · 自然',
             'styleDesc': '你表达温和而自然，善于用行动而非语言来传达。给人舒服自在的感觉，但有时可能被忽视。',
             'exercises': ['练习用语言表达感受', '每周分享1次创作', '学习在必要时坚定立场'],
             'feedback': '你的艺术感和温柔很有吸引力，学会让自己被看见。',
             'imageTips': '选择舒适、有质感的自然色系服装，展现你的艺术气质。'},
    'ESTP': {'style': '活力 · 直接 · 行动',
             'styleDesc': '你说话充满活力，直接且务实。善于说服他人，但有时可能冲动。',
             'exercises': ['练习思考后再发言', '每周进行1次深度对话', '学习做长期规划'],
             'feedback': '你的行动力和魅力很强，增加一些思考深度会让你更有影响力。',
             'imageTips': '可以选择一些有活力的单品，展现你热爱生活的一面。'},
    'ESFP': {'style': '欢乐 · 生动 · 表演',
             'styleDesc': '你表达生动有趣，善于带动气氛，天生就是表演者。但有时需要处理严肃问题时可以更稳重。',
             'exercises': ['练习处理严肃话题', '每周进行1次深度分享', '学习在适当的时候安静倾听'],
             'feedback': '你有让所有人开心的天赋，学会在需要的时候展现严肃的一面。',
             'imageTips': '可以大胆尝试色彩和流行元素，展现你充满魅力的个性。'},
}


def generate_development_plan(input_data: Optional[Dict] = None) -> Dict[str, Any]:
    """
    生成人格培养方案

    Args:
        input_data: 输入数据，包含 mbti, decision_style, discipline, time_preference 等

    Returns:
        完整的培养方案字典
    """
    if input_data is None:
        input_data = {}

    mbti = (input_data.get('mbti') or 'INTJ').upper()
    decision_style = input_data.get('decisionStyle') or input_data.get('decision_style')
    discipline = input_data.get('discipline')
    time_preference = input_data.get('timePreference') or input_data.get('time_preference')

    # 语言系统映射
    lang_data = LANGUAGE_MAP.get(mbti, LANGUAGE_MAP['INTJ'])

    # 认知系统映射
    cog_data = COGNITIVE_MAP.get(mbti, COGNITIVE_MAP['INTJ'])

    # 行为系统映射
    beh_data = BEHAVIORAL_MAP.get(mbti, BEHAVIORAL_MAP['INTJ'])

    # 表达系统映射
    exp_data = EXPRESSIVE_MAP.get(mbti, EXPRESSIVE_MAP['INTJ'])

    # 综合状态
    status = {
        'language': lang_data['progress']['listening'],
        'cognitive': _get_cognitive_label(mbti),
        'behavior': _get_behavior_label(mbti, discipline),
        'expression': _get_expression_label(mbti)
    }

    plan = {
        'mbti': mbti,
        'generatedAt': int(datetime.now().timestamp() * 1000),
        'status': status,
        'modules': {
            'language': lang_data,
            'cognitive': cog_data,
            'behavioral': beh_data,
            'expressive': exp_data
        }
    }

    logger.info(f"[DevelopmentPlan] 生成培养方案完成: mbti={mbti}")
    return plan


def _get_cognitive_label(mbti: str) -> str:
    """根据 MBTI 获取认知标签"""
    if 'T' in mbti:
        return '逻辑型'
    elif 'F' in mbti:
        return '情感型'
    elif 'N' in mbti:
        return '直觉型'
    else:
        return '实感型'


def _get_behavior_label(mbti: str, discipline: Optional[str]) -> str:
    """根据 MBTI 和纪律性获取行为标签"""
    if discipline == 'high' or 'J' in mbti:
        return '高纪律'
    elif discipline == 'low' or 'P' in mbti:
        return '灵活型'
    return '平衡型'


def _get_expression_label(mbti: str) -> str:
    """根据 MBTI 获取表达标签"""
    if 'E' in mbti:
        return '外放型'
    elif 'I' in mbti:
        return '克制型'
    return '平衡型'


def get_module_stats(plan: Dict) -> Dict[str, int]:
    """获取各模块的建议数量统计"""
    modules = plan.get('modules', {})
    return {
        'language': len(modules.get('language', {}).get('approach', [])),
        'cognitive': (
            len(modules.get('cognitive', {}).get('strengthActions', [])) +
            len(modules.get('cognitive', {}).get('weaknessActions', []))
        ),
        'behavioral': len(modules.get('behavioral', {}).get('habits', [])),
        'expressive': len(modules.get('expressive', {}).get('exercises', []))
    }
