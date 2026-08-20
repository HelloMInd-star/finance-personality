# ♠️ 人格金融孪生平台

> 人格数字孪生空间 · 行为决策沙盘 · React + Python 全栈应用

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![Vite 5](https://img.shields.io/badge/Vite-5646CFF?logo=vite)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Ant Design](https://img.shields.io/badge/AntDesign-5-0170FE?logo=antdesign)](https://ant.design/)

---

## 📖 项目简介

**Y.Mine** 是一个以"行为采集 → 人格映射 → 金融叙事生成"为核心链路的数字孪生平台。通过德州扑克、台球、健身、调酒等多种行为场景采集用户决策数据，融合塔罗底色、脉轮能量、音乐画像等多源信息，构建六维人格向量模型，最终生成个性化的人格洞察简报和金融行为分析。

### 🌐 五域生态定位

本仓库是 **Y.Mine 五域生态的中枢 / 策展首页（finance 策展首页）**，与其余四域互通：

| 域 | 定位 |
|----|------|
| **finance-personality（本仓库）** | 五域中枢 · 策展首页 |
| ymine 主站 | 人格引擎主站 |
| poker-egg | 扑克域 |
| personality-wine | 调酒域 |
| ymine-validation-hub | 验证中枢 |

六站回跳条已全绿 ✅ —— 五域之间可相互回跳，生态闭环打通。

**线上地址**：后端 API 部署于 Railway — `https://finance-personality-api-production.up.railway.app`

### 核心理念

```
每一次选择，都在塑造你的金融人格

行为采集 ──► 认知画圈 ──► 人格向量 ──► 洞察简报
    │            │            │            │
  德州扑克     塔罗联动     六维雷达图    优势/风险/建议
  台球        脉轮映射     原型分类      行动推荐
  健身        音乐画像     ECharts可视化  塔罗影响标签
  调酒        多源融合     交互式节点     音乐联动
```

---

## ✨ 功能特性

### 🏠 工作台首页（Dashboard）

- **六维人格雷达图** — 基于 ECharts 的交互式雷达图，支持维度悬停详情、峰值/谷值标记
- **人格洞察简报** — 自动分类人格原型（探索者/策略家/社交家等 7 种），生成优势分析、风险提示和行动建议
- **认知画圈缩略图** — 三环拓扑结构，展示核心/支撑/边缘节点关系
- **塔罗 × 音乐联动** — 今日塔罗底色卡片 + 网易云音乐画像连接入口
- **最近活动时间线** — 行为采集历史记录

### 🎮 行为采集层

| 模块 | 路由 | 核心功能 |
|------|------|---------|
| 🃏 德州扑克 | `/poker` | 完整对局流程 + 凯利公式 + 风险偏好分析 |
| 🎱 台球 | `/billiards` | 瞄准角度/力度/决策速度的行为采集 |
| 💪 健身 | `/fitness` | 训练纪律/强度偏差/计划执行力追踪 |
| 🎵 K线音乐 | `/music` | AudioContext 音频合成 + 情绪匹配 + 网易云接入 |
| 🍸 分子调酒 | `/bartender` | 叙事基调 + 情绪映射 + MBTI 人格配方 |
| ♟️ 模拟博弈台 | `/game-table` | 多人格 AI 对弈 + 策略推演 |

#### 🃏 扑克线深度工程（5.1 / 5.2）

- **5.1 人格决策引擎** — 8 维人格参数驱动 AI 决策，每次行动附带人格化理由，并具备 tilt（上头）记忆：连败/被 Bad Beat 后 AI 风格会真实漂移
- **5.2 Kelly 面板** — 蒙特卡洛模拟真胜率逐街重算 + 牌型识别，搭配前端 `AnalysisPanel` 实时呈现凯利下注建议

#### 🧩 PokerPuzzle 决策拼图墙 × 策略编译器

- 实现位置：`frontend/src/components/PokerPuzzle/PokerPuzzle.jsx`
- 对局中的决策碎片按街上墙聚合，攒够 `MIN_FRAGMENTS` 燃料门槛后，**纯本地编译**为可溯源的 `decide()` 决策代码（TypeScript 为主 / Python 为辅双版本）
- 每一行生成的代码都可回溯到具体碎片，四维量化全溯源 —— 你的策略，你自己"编译"出来

### 🧠 人格认知层

| 模块 | 路由 | 核心功能 |
|------|------|---------|
| 🌀 认知画圈 | `/psychology` | 三环拓扑图 + 节点关系 + 合力计算 |
| 👁️ 人格镜子 | `/persona-mirror` | MBTI/大五人格映射 + 行为偏好分析 |
| 🧬 DNA 分析 | `/genome` | 六维能力基因图谱 + 历史追踪 |
| 💡 MindSpeak | `/mindspeak` | 思维流追踪 + 认知模式识别（11 模块 + 三模型审计） |
| 🃏 塔罗指引 | `/tarot` | 22 张大阿尔卡那 + 人格维度影响 |
| 🔄 脉轮测试 | `/chakra` | 7 脉轮能量测试 + 行为维度映射 |
| 📈 向量分析 | `/vector` | 六维向量精算 + 趋势分析 |
| ⚠️ 风险压力 | `/risk` | 风险偏好测试 + 压力场景模拟 |
| 🌱 培养方案 | `/cultivation-plan` | 基于能力短板的个性化成长路径 |

### 💰 金融模拟层

| 模块 | 路由 | 核心功能 |
|------|------|---------|
| 📊 股价模拟 | `/stock` | 32 只预设池（美股/中概/A股分组卡片墙）+ 东方财富实时行情（多源合并兜底）+ K 线图 + 十一步闭环 + 数据时间戳 + 运行历史 CSV 导出 |
| 🏢 公司理财 | `/finance` | 财务建模 + 融资模拟 |
| 🔻 信息漏斗 | `/funnel` | 多源信息过滤 + 决策权重 |
| 📁 投资人档案 | `/archive` | 投资人/企业家画像库 |
| 🏦 投行看板 | `/ib-dashboard` | `InvestBankDashboardPage` — 投资人契合度看板 + AI 投资人格解读 |
| 📈 实时行情 | `/stock` | `StockPage` — 东方财富实时行情多源合并 + 数据时间戳 |

### 🎵 多模态人格数据流（网易云音乐画像）

```
NetEaseConnect.jsx（网易云手机号 / 二维码扫码登录）
        │
        ▼
   歌单拉取 ──► 音乐画像分析 ──► 行为向量映射（注入六维人格向量）
```

- 实现位置：`frontend/src/components/Music/NetEaseConnect.jsx`（另有 `PersonaMusic.jsx`、`tarotPlaylist.js` 协同）
- 音乐偏好作为人格数据的一个模态，与塔罗底色、扑克决策等多源信息融合进同一条人格数据流

### 🚀 输出与扩展层

| 模块 | 路由 | 核心功能 |
|------|------|---------|
| 📦 内容中枢 | `/content-hub` | 基于人格画像的个性化内容推荐 |
| 🎲 游戏引擎 | `/game-engine` | 多人格 AI 引擎层 |
| 🤖 人形机器人 | `/robot` | 认知决策 + 6 种人格模式 + 行为节奏 |
| 🚁 无人机调度 | `/drone-dispatch` | 任务规划 + 调度算法可视化 |
| 🎮 驾驶舱 | `/cockpit` | 全景数据沉浸 + 功能卡片导航 |

### 🛠️ 系统层

| 模块 | 路由 | 核心功能 |
|------|------|---------|
| 📚 故事集 | `/stories` | 调酒会话历史 + 配方音乐回放 |
| 💬 陪练记录 | `/coach-logs` | AI 陪练对话历史 + 行为反馈 |
| ⚙️ 系统工具 | `/tools` | 数据导入导出 + 存储管理 |

### ✦ AI 叙事层（DeepSeek 点亮工程 · P0 + P1 已完成 ✅）

> **统一口径：数字全部本地计算，LLM 只做叙事层。** 所有方法论计算（量化引擎 / 认知画圈 / 投资人匹配）仍在本地引擎完成保证确定性；LLM 只负责叙事个性化，不碰方法论与映射数据。

**P0 + P1 已点亮**：后端 LLM 通用路由 + 登录页 + 九大 LLM 模板全站点亮，实现位置 `backend/app.py` L1196-1380。

| AI 能力 | 挂载点 | 触发方式 |
|---------|--------|---------|
| 🃏 AI 驻馆解牌师 + 今日行动指引 | 塔罗指引 `/tarot` | 抽牌揭晓自动调用 |
| 🏦 AI 投资人格解读 | 投行看板 `/ib-dashboard` | 按钮触发（契合点 / 差异点 / 选择建议） |
| 📋 人格金融综合报告 | 工作台首页 `/dashboard` | 按钮触发（跨模块汇总塔罗/酒局/投资人/成长阶段 → 一致性分析 + 矛盾点 + 建议） |
| 🌱 成长教练寄语 | 培养方案 `/cultivation-plan` | 按钮触发 |
| 🧠 AI 人格简报（心理简报） | 认知画圈 `/psychology` | 按钮触发 |
| 🃏 扑克教练 | 德州扑克 `/poker` | 按钮触发 |
| 🍸 主理人回顾（酒局主持） | MBTI 企业家酒局 | 按钮触发 |
| 🚁 AI 调度播报 | 无人机调度 `/drone-dispatch` | 按钮触发 |
| 🤖 AI 实时对话 | 人形机器人 `/robot` | 输入框自由对话（按当前人格策略语气回应） |

**架构要点**：

- 一条通用 LLM 代理路由 `POST /api/llm/generate` + 服务端 Prompt 模板注册表（9 条模板：塔罗解读 / 投资人视角 / 综合报告 / 扑克教练 / 酒局主持 / 无人机 / 机器人 / 心理简报等，统一"午夜酒馆"人设）
- API Key 仅服务端环境变量持有，不下发前端；仅注册表内模板可调（防任意 prompt 滥用）
- 参数白名单 + 200 字符/项 + max_tokens 护栏 + temperature 0.8
- JWT 登录门控：已登录真调 LLM，未登录走本地模板兜底 + 金色「登录解锁」引导

### 🔐 用户系统

- 注册 / 登录（JWT + bcrypt 密码哈希，token 存 localStorage）
- 注册规则：用户名 3-50 位 + 邮箱格式校验 + 密码 ≥ 6 位；同邮箱不可重复
- 登录后解锁全部 AI 叙事能力

---

## 🛠️ 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| Vite | 5 | 构建工具 |
| React Router | 6 | 路由管理 |
| Ant Design | 5 | UI 组件库 |
| Zustand | 4 | 状态管理 |
| ECharts | 6 | 数据可视化（雷达图/K线图） |
| Three.js | 0.185 | 3D 分子渲染 |
| Framer Motion | 10 | 动画效果 |
| Recharts | 2 | 辅助图表 |
| Axios | 1.6 | HTTP 请求 |
| Day.js | 1.11 | 日期处理 |

### 后端

| 技术 | 用途 |
|------|------|
| FastAPI | Web 框架 |
| WebSocket | 实时通信 |
| SQLAlchemy | ORM |
| PostgreSQL | 数据库 |
| Redis | 缓存 |
| scikit-learn | AI/ML 引擎 |
| JWT + bcrypt | 用户认证 / 密码哈希 |
| DeepSeek API | LLM 叙事层（服务端模板注册表代理，httpx 异步调用） |
| 东方财富 + 新浪 + 腾讯行情 | 实时行情多源合并兜底 |

### 基础设施

| 技术 | 用途 |
|------|------|
| Docker + Docker Compose | 容器化部署 |
| Nginx | 反向代理 + 静态文件 |
| GitHub Actions | CI/CD |
| GitHub Pages | 前端静态部署 |
| Railway | 后端部署 |

---

## 🏗️ 项目结构

```
poker-egg-fullstack/
├── frontend/                    # React 前端应用
│   ├── src/
│   │   ├── components/          # 可复用组件
│   │   │   ├── ChakraTest/      # 脉轮测试
│   │   │   ├── Dashboard/       # 仪表盘组件（PersonaRadar）
│   │   │   ├── GameLobby/       # 游戏大厅
│   │   │   ├── Layout/          # 布局组件（AppLayout）
│   │   │   ├── MoleculeViewer/  # 3D 分子查看器
│   │   │   ├── Music/           # 音乐播放器 + 网易云连接（NetEaseConnect / PersonaMusic）
│   │   │   ├── PersonaBartender/# 调酒组件
│   │   │   ├── PokerTable/      # 德州扑克牌桌（含 AnalysisPanel Kelly 面板）
│   │   │   ├── PokerPuzzle/     # 决策拼图墙 × 策略编译器（本地编译 decide()）
│   │   │   ├── TarotModule/     # 塔罗模块
│   │   │   └── ZodiacModule/    # 星座模块
│   │   ├── pages/               # 页面组件（30+）
│   │   │   ├── DashboardPage.jsx    # 工作台首页
│   │   │   ├── CockpitPage.jsx      # 驾驶舱
│   │   │   ├── HeroPage.jsx         # 欢迎引导页
│   │   │   ├── PokerPage.jsx        # 德州扑克
│   │   │   ├── InvestBankDashboardPage.jsx  # 投行看板
│   │   │   ├── StockPage.jsx        # 实时行情
│   │   │   ├── PsychologyPage.jsx   # 认知画圈
│   │   │   ├── MusicPage.jsx        # K线音乐
│   │   │   └── ...
│   │   ├── store/               # 状态管理（Zustand）
│   │   │   ├── appStore.js
│   │   │   └── gameStore.js
│   │   ├── utils/               # 业务引擎（40+）
│   │   │   ├── cognitiveCircleEngine.js  # 认知画圈引擎
│   │   │   ├── insightBriefEngine.js     # 洞察简报引擎
│   │   │   ├── robotCognitiveEngine.js   # 机器人认知引擎
│   │   │   ├── quantEngine.js            # 量化引擎
│   │   │   ├── genomeEngine.js           # DNA 分析引擎
│   │   │   ├── musicProfileEngine.js     # 音乐画像引擎
│   │   │   └── ...
│   │   ├── styles/              # 全局样式
│   │   ├── App.jsx              # 根组件 + 路由配置
│   │   └── main.jsx             # 入口文件
│   ├── vite.config.js           # Vite 配置（代码分割）
│   ├── nginx.conf               # Nginx 配置
│   ├── Dockerfile               # 前端 Docker
│   └── package.json
│
├── backend/                     # Python 后端
│   ├── app.py                   # FastAPI 主应用
│   ├── ai/ai_engine.py          # AI 决策引擎
│   ├── auth/auth.py             # JWT 认证
│   ├── models/                  # 数据模型
│   ├── services/                # 业务服务（eastmoneyData 实时行情多源合并等）
│   ├── requirements.txt
│   └── Dockerfile
│
├── netease-api/                 # 网易云音乐 API 服务
│   ├── server.js
│   └── package.json
│
├── nginx/                       # Nginx 配置
│   └── nginx.conf
│
├── .github/workflows/deploy.yml # CI/CD
├── docker-compose.yml           # Docker 编排
└── README.md
```

---

## 🚀 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 克隆项目
git clone https://github.com/HelloMind-star/poker-egg-fullstack.git
cd poker-egg-fullstack

# 一键启动（开发环境）
docker-compose up -d

# 访问
# 前端: http://localhost:5173
# 后端: http://localhost:5000
# API 文档: http://localhost:5000/docs
# pgAdmin: http://localhost:5050 (需 --profile devtools)
```

### 方式二：本地开发

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 5000

# 前端（新终端）
cd frontend
npm install
npm run dev

# 网易云音乐 API（可选）
cd netease-api
npm install
node server.js
```

访问 http://localhost:5173 ，访问后会自动跳转到工作台首页 `/dashboard`。

> 💡 **提示**：如果没有安装 PostgreSQL 和 Redis，后端会自动降级为**内存模式**。内存模式下任意用户名密码可登录，重启后数据丢失。

---

## 🧭 导航架构

```
浏览器 / ──自动重定向──► /dashboard（工作台首页）

/welcome     → HeroPage 欢迎引导页（全屏，仅首次访问）
/dashboard   → 工作台首页（主入口，侧边栏导航）
/cockpit     → 驾驶舱（在 AppLayout 内，统一侧边栏）

所有功能页统一在 AppLayout 内渲染，共享侧边栏导航。
所有"返回首页"按钮统一指向 /dashboard。
```

### 侧边栏菜单分组

| 分组 | 包含模块 |
|------|---------|
| Navigate | 工作台首页、驾驶舱、投资人档案 |
| Entrance | 塔罗指引、调酒 |
| Finance | 信息漏斗、股价模拟、公司理财、风险压力、向量分析 |
| Behavior | 德州扑克、台球、健身、K线音乐、模拟博弈台、娱乐方式 |
| Persona | 认知引擎、人格镜子、心理盘面、DNA分析、脉轮测试、培养方案 |
| Output | 内容中枢、游戏引擎、人形机器人、无人机调度 |
| Records | 故事集、陪练记录 |

---

## 📊 核心数据流

```
用户行为数据
    │
    ├── 德州扑克对局 ──► 风险偏好 / 决策速度
    ├── 台球对局 ──► 瞄准精度 / 力度控制
    ├── 健身记录 ──► 训练纪律 / 强度偏差
    ├── 调酒会话 ──► 情绪状态 / 叙事偏好
    └── 音乐画像 ──► 情绪基调 / 能量水平
         │
         ▼
    localStorage（ymine_sandbox_v1）
         │
         ▼
    cognitiveCircleEngine.build()
         │
         ├── 基础维度计算（六维向量）
         ├── 塔罗牌义权重注入
         ├── 脉轮能量映射
         └── 多源融合 → 认知画圈拓扑
              │
              ▼
    insightBriefEngine.generateInsights()
         │
         ├── 人格原型分类
         ├── 优势维度分析
         ├── 风险提示
         ├── 塔罗影响标签
         └── 行动建议
              │
              ▼
    Dashboard 渲染
         ├── PersonaRadar 雷达图
         ├── 洞察简报卡片
         └── 认知画圈缩略图
```

---

## 🌐 部署指南

### 前端部署到 GitHub Pages

```bash
cd frontend
npm run build
# 将 dist/ 部署到 GitHub Pages
```

### 后端部署到 Railway

> 当前线上地址：`https://finance-personality-api-production.up.railway.app`

1. 在 Railway 创建新项目
2. 连接 GitHub 仓库
3. 设置 Root Directory 为 `backend`
4. 添加环境变量（见下方）
5. 自动部署

### Docker 生产部署

```bash
docker-compose --profile production up -d
# Nginx 监听 80/443 端口
```

---

## 📝 环境变量

### 后端

```env
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://redis:6379
SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
CORS_ORIGINS=["http://localhost:5173"]
DEEPSEEK_API_KEY=sk-xxx        # LLM 叙事层（仅服务端持有，不下发前端）
```

### 前端

```env
VITE_API_URL=https://your-backend-domain.com
VITE_WS_URL=wss://your-backend-domain.com
```

---

## 📋 开发计划

### ✅ 已完成

#### P0 — 核心数据通路

- [x] localStorage 双轨存储（userState + psychologyProfile）
- [x] cognitiveCircleEngine 多源融合引擎
- [x] 音乐数据通路修复（NetEaseConnect → MusicPlayer）
- [x] 认知画圈自动刷新（storage 事件监听）

#### P1 — 沉浸感升级

- [x] 六维向量升级为 ECharts 雷达图（PersonaRadar 组件）
- [x] 人格洞察简报生成器（insightBriefEngine）
- [x] 塔罗 × 认知联动（塔罗牌义权重注入）
- [x] 脉轮 × 行为数据映射（7 脉轮 → 6 维度）

#### P2 — 导航与布局修复

- [x] 路由架构扁平化（Dashboard 作为主入口）
- [x] CockpitPage 纳入 AppLayout（统一侧边栏）
- [x] 所有"返回首页"按钮统一指向 /dashboard
- [x] Dashboard 移动端响应式适配（375px / 640px / 1024px 断点）

#### ✦ LLM 叙事层点亮（2026-08，P0 + P1 已完成）

- [x] 后端 LLM 通用代理路由 + 9 模板注册表（DeepSeek），实现位置 `backend/app.py` L1196-1380
- [x] 用户注册 / 登录系统（JWT + bcrypt）+ 登录页
- [x] 9 大 LLM 模板全站点亮（塔罗解读 / 投资人视角 / 综合报告 / 扑克教练 / 酒局主持 / 无人机 / 机器人 / 心理简报等）
- [x] 统一口径落地：**数字全部本地计算，LLM 只做叙事层**
- [x] 行情实验室扩容：预设池 10 → 32 只（美股 18 / 中概 4 / A股 10）+ 东方财富实时行情 + 分组卡片墙 + 数据时间戳 + 运行历史 CSV 导出

#### 🃏 扑克线 5.x — 从牌桌到策略编译器

- [x] 5.1 人格决策引擎：8 维人格参数 + 人格化理由 + tilt 记忆
- [x] 5.2 Kelly 面板：蒙特卡洛真胜率逐街重算 + 牌型识别 + AnalysisPanel 前端
- [x] PokerPuzzle 决策拼图墙 × 策略编译器：碎片聚合纯本地编译可溯源 `decide()`（TS 为主 / Python 为辅，MIN_FRAGMENTS 燃料门槛，四维量化全溯源）

#### 🌐 五域生态互通

- [x] 本仓库定位为五域中枢 / 策展首页（finance 策展首页），与 ymine 主站 / poker-egg / personality-wine / ymine-validation-hub 互通
- [x] 六站回跳条全绿
- [x] 后端上线 Railway：`https://finance-personality-api-production.up.railway.app`

### 🔲 待开发

#### P2 — 体验打磨（进行中）

- [ ] **P2-1 全局导航栏移动端折叠**
  - 侧边栏在 768px 以下转为抽屉式
  - 底部固定导航栏（5 个常用入口）
  - 触摸手势支持（左滑打开侧边栏）

- [ ] **P2-3 ToolsPage 功能扩充**
  - 数据导入（从 JSON 文件恢复）
  - 设置面板（主题切换、通知偏好）
  - 日志查看器（实时 session 日志）
  - 缓存管理（按模块清除）

- [ ] **P2-4 ContentHub 内容分类导航**
  - 按类型筛选（视频/文章/播客）
  - 收藏 / 稍后查看
  - 浏览历史
  - 内容搜索高亮

- [ ] **P2-5 DroneDispatch 地图可视化**
  - 集成 react-leaflet 或高德地图
  - 调度区域显示 + 路径规划
  - 实时无人机位置标记

- [ ] **P2-6 性能优化**
  - 路由级懒加载（已实现 React.lazy）
  - vendor chunk 手动分包
  - 首屏加载 < 3s
  - 图片懒加载

#### P3 — 数据深度

- [ ] **P3-1 后端数据持久化**
  - 用户行为数据云端同步
  - 跨设备数据一致性
  - 历史数据趋势分析

- [ ] **P3-2 AI 增强**
  - 基于行为数据的个性化推荐
  - 人格预测模型训练
  - ~~自然语言洞察生成（LLM 接入）~~ ✅ 已完成（见「LLM 叙事层点亮」）

- [ ] **P3-3 社交功能**
  - 人格画像分享
  - 好友对比分析
  - 排行榜系统

#### P4 — 移动端 APP

- [ ] PWA 改造（Service Worker + Manifest）
- [ ] 离线模式支持
- [ ] 推送通知
- [ ] 原生 APP 封装（React Native / Taro）

---

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/AmazingFeature`）
3. 提交更改（`git commit -m 'Add some AmazingFeature'`）
4. 推送到分支（`git push origin feature/AmazingFeature`）
5. 开启 Pull Request

---

## 📄 开源协议

本项目采用 MIT 协议 — 详见 [LICENSE](LICENSE) 文件

---

## 👨‍💻 作者

**HelloMind-star** (Mine)

- GitHub: [@HelloMind-star](https://github.com/HelloMind-star)

---

## ⭐ 支持项目

如果这个项目对你有帮助，请给个 Star ⭐ 支持一下！
