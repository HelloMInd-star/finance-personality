# KMP→IPD 记忆学习层方案 · 挂载进认知引擎

> 目标网站：https://hellomind-star.github.io/ymine/index.html （Game-OS V2.5）
> 本方案聚焦「KMP→IPD→七维向量」记忆学习体系的移植：把 ymine 的**感知→建模→存储→检索→验证→进化**六步闭环，挂载进本项目认知引擎（MindSpeakPage），作为右侧 Tabs 的第 5 个面板，并接入既有三分区数据总线与三角审计。

---

## 一、背景与定位

ymine 的核心观点：**大模型记忆的瓶颈不是"记不住"，而是"不会学习"** —— 需要从交互中持续提取结构、建立关联、更新认知。

其方法论链条为 `KMP → IPD → 七维向量`：

- **感知建模**：从原始交互中抽取可结构化信息（主体·运动·幅值·外部扰动）。
- **向量存储**：映射为向量 + 骨架索引入库，按热度分三级仓储。
- **阈值验证**：过四级净化漏斗 + 球面公理终审，用全局三线（0.48/0.50/0.68）做边界约束。
- **PID 进化**：反馈式更新记忆权重，偏差越大调节力度越大，实现持续进化。

### 本项目现状盘点（已具备，不重复造）

| 能力 | 位置 | 状态 |
|------|------|------|
| 认知引擎（11 模块翻译 + 稳态 + 三角审计） | `mindspeakEngine.js` | ✅ 完整 |
| 三分区数据总线（pipeline 只读 / draft 可写 / auditLog 追加+HMAC） | `storageBus.js` | ✅ 完整 |
| 七层熔断 / 全局三线 0.48/0.50/0.68 | `fuse.js` | ✅ 完整 |
| 可信门控层（S0-S9 + 门控决策） | `trustGate.js` | ✅ 完整 |
| MindSpeak 页面四 Tab（联动/三角审计/矩阵/审计） | `MindSpeakPage.jsx` | ✅ 完整 |

### 关键缺口（本次要补）

1. **无记忆基座**：认知引擎每次翻译是"无状态"的，历史输入/结论没有沉淀、复用、进化。
2. **无学习闭环**：没有"感知→建模→存储→检索→验证→进化"的六步学习流水线。
3. **无骨架检索**：同类输入无法命中历史相似案例，需重复计算。
4. **无进化反馈**：记忆权重不随使用结果更新，无法"越用越准"。

---

## 二、升级目标

在认知引擎内新增一个**记忆学习闭环（KMP→IPD）**，实现四个"有"：

1. **有沉淀**：每次认知翻译 → 抽取结构化记忆 → 入三级仓储。
2. **有复用**：新输入 → 骨架检索 → 命中历史 → 复用相似结论。
3. **有约束**：记忆入库必过四级净化 + 全局三线校验，违规触发 L3 熔断。
4. **有进化**：记忆权重按检索命中/采纳结果做 PID 反馈更新。

---

## 三、架构设计

```
┌──────────────────────────────────────────────┐
│  MindSpeakPage 认知引擎（右侧 Tabs 第 5 面板）   │
│  ① 联动  ② 三角审计  ③ 矩阵  ④ 审计日志      │
│  ⑤ KMP→IPD 记忆学习层（新增）                  │
└───────────────┬──────────────────────────────┘
                │ 触发（翻译成功后联动）
┌───────────────▼──────────────────────────────┐
│  kmpIpdEngine.js  · 六步闭环（新增）           │
│  感知 → 建模 → 存储 → 检索 → 验证 → 进化       │
└───────────────┬──────────────────────────────┘
   ┌────────────┼───────────────┬──────────────┐
┌──▼───┐   ┌────▼───┐   ┌──────▼───┐   ┌────▼──────┐
│四级   │   │三级    │   │KMP骨架    │   │PID进化     │
│净化漏斗│   │三级仓储 │   │检索       │   │反馈调节     │
└───────┘   └────┬───┘   └──────────┘   └───────────┘
                 │ 落盘
        ┌────────▼─────────┐
        │ storageBus 三分区  │
        │ draft_kmp_* 可读写 │
        │ audit_log_kmp 追加 │
        └──────────────────┘
```

### 新增/改动文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `frontend/src/utils/kmpIpdEngine.js` | **新增** | 记忆学习核心：净化漏斗/三级仓储/KMP检索/PID进化/六步闭环 |
| `frontend/src/pages/MindSpeakPage.jsx` | **改动** | 右侧新增 `kmp` Tab 面板 + 翻译成功联动触发学习 |
| `frontend/src/pages/MindSpeakPage.css` | **改动** | KMP 面板样式（复用紫金磨砂风格） |
| `frontend/src/utils/__tests__/kmpIpdEngine.test.js` | **新增** | 六步闭环单测 |
| `frontend/docs/KMP-IPD记忆学习层方案.md` | 本文件 | 方案文档 |

> 说明：菜单与路由**无需改动**（面板挂在认知引擎内部，不新增页面/侧边栏项）。

---

## 四、六步闭环设计（kmpIpdEngine.js 核心）

### 第 1 步 · 感知 Perception

从一次认知翻译结果中提取原始记忆原材料：

```js
perception(translateResult)
// 输入：本次翻译的 { inputText, activeModules, moduleOutputs, steadyState, triangleAudit }
// 输出：原始记忆 { text, source:'mindspeak', entities:[...], signals:{steadyState,sentiment}, at }
```

### 第 2 步 · 建模 Modeling

对原始记忆做**四维结构化**（对齐 ymine 的 L3 校验维度）：

```js
modeling(rawMemory)
// 四维：主体(subject) · 运动(action/motion) · 幅值(magnitude) · 外部扰动(disturbance)
// 输出：结构化记忆 { subject, action, magnitude, disturbance, featureVector }
```

`featureVector` 采用**七维向量**（对齐 ymine financial_vector_spec 的 7D 金融维度，此处做通用化映射）：

```js
// 七维：I 海拔(稳态) / P 坡度(动量) / D 阻尼(波动抑制) / S 熵(复杂度)
//       Dev-I 偏差 / Dev1 回归 / Dev2 历史依赖
featureVector = {
  I:  steadyState,                     // 海拔：稳态贴近中轴
  P:  momentum,                        // 坡度：翻译置信度变化速率
  D:  1 - volatility,                  // 阻尼：波动抑制
  S:  entropy,                         // 熵：激活模块离散度
  DevI: |steadyState - 0.5|,           // 偏差：偏离稳态中轴
  Dev1: convergence,                   // 回归：收敛度
  Dev2: historyDependency,             // 历史：与前序记忆的相关度
}
```

### 第 3 步 · 存储 Storage（三级仓储）

按热度分三级，写入 `draft_kmp_*`（可读写）：

```js
// 三级仓储
HOT  长期公理库  → draft_kmp_hot   高频命中区，常驻，索引完整
WARM 缓冲复审库  → draft_kmp_warm  待升华/待复核区，定期巡检
COLD 废弃归档库  → draft_kmp_cold  低热度/淘汰区，压缩，仅回溯唤醒
```

入库前置逻辑：**四级净化漏斗**（对齐 ymine MemoryBase）：

| 层 | 名称 | 规则 |
|----|------|------|
| L1 | 粗滤降噪 | 剔除语气词/无效零碎，长度 < N 丢弃 |
| L2 | 标签分拣 | 映射到业务标签（策略/风险/认知/噪音） |
| L3 | 四维结构化校验 | 无法拆出【主体·运动·幅值·扰动】→ 转噪音 |
| L4 | 公理终审 | 过全局三线 0.48/0.50/0.68 校验；违规 → L3 熔断 |

### 第 4 步 · 检索 Retrieval（KMP 骨架）

**沿固定骨架调取，非全局遍历**（对齐 ymine KMP 检索引擎）：

```js
retrieve(featureVector, { topK=5 })
// 1. 用 featureVector 的七维向量做余弦相似度
// 2. 只遍历 HOT 库骨架索引（非全量扫描）
// 3. 返回 topK 相似记忆 + 相似度分
```

### 第 5 步 · 验证 Verification

对检索到的候选记忆做**三角校验**（复用既有 STAGE-9 三角审计思路的轻量版）：

```js
verify(candidates, currentAudit)
// 若候选记忆与本次翻译结论的稳态/置信度偏差 > 0.02 → 标记分歧
// 分歧检测 → 写 audit_log_kmp VERIFY_DIVERGENCE
// 一致 → 写 audit_log_kmp VERIFY_PASS
```

### 第 6 步 · 进化 Evolution（PID 反馈）

按采纳结果更新记忆权重（对齐 ymine PID 进化）：

```js
evolve(memoryId, feedback)
// feedback ∈ {hit(+), miss(-), adopted(+更强), rejected(-更强)}
// PID 调节：偏差 e = 目标强度 - 当前强度
//   strength += Kp·e + Ki·∫e + Kd·Δe
// 强度跌破冷阈值 → 降级 COLD；升破热阈值 → 升级 HOT
```

---

## 五、MindSpeakPage 挂载改动

### 1. 右侧 Tabs 新增第 5 项

在 `rightTabItems` 数组追加 `kmp` 面板（见 `MindSpeakPage.jsx` L243-284）：

```jsx
{
  key: 'kmp',
  label: <span><DatabaseOutlined style={{ color: '#10b981' }} /> KMP→IPD 记忆</span>,
  children: <KmpPanel
    memory={kmpState}
    onChangeTab={setRightTabKey}
    onTriggerStudy={runMemoryStudy}
  />,
},
```

### 2. 翻译成功联动触发学习

在 `handleTranslate`（L176-196）成功后追加：

```js
// 翻译成功后触发一次记忆学习闭环
const kmp = kmpIpdEngine.study(result, yMineData);
setKmpState(kmp);
```

### 3. KMP 面板内容

- **六步闭环进度**：感知→建模→存储→检索→验证→进化 六步状态条（对齐 S0-S9 视觉）。
- **三级仓储仪表盘**：HOT / WARM / COLD 条目数与占用（对齐 MemoryBase 三级仪表盘）。
- **最近记忆流**：展示最近入库的结构化记忆（四维 + 七维向量）。
- **骨架检索候选**：展示检索命中的历史相似记忆与相似度。
- **进化反馈**：PID 调节日志（strength 变化曲线）。

---

## 六、数据落盘（storageBus 三分区）

| 命名空间 | 前缀 | 读写 | 用途 |
|----------|------|------|------|
| 长期公理库 | `draft_kmp_hot` | 读写 | 常驻记忆，KMP 检索主索引 |
| 缓冲复审库 | `draft_kmp_warm` | 读写 | 待升华/待复核 |
| 废弃归档库 | `draft_kmp_cold` | 读写 | 淘汰记忆，压缩归档 |
| 进化日志 | `audit_log_kmp` | 仅追加+HMAC | 入库/检索/验证/进化全链路审计 |

> 复用 `draftStore` / `auditLogStore`（见 `storageBus.js`），不新增分区类型，保证三分区规范一致。

---

## 七、实施顺序（P0 → P1）

### P0（本轮，核心闭环）
1. 新建 `kmpIpdEngine.js`：四级净化 + 三级仓储 + KMP 检索 + PID 进化 + 六步闭环 `study()`。
2. 改 `MindSpeakPage.jsx`：新增 `kmp` Tab + 翻译联动触发。
3. 改 `MindSpeakPage.css`：KMP 面板样式（紫金磨砂风格对齐）。
4. 新建 `kmpIpdEngine.test.js` 单测（净化/入库/检索/进化）。
5. 浏览器验证：翻译一次 → 记忆入库 → 检索命中 → 进化日志。

### P1（扩展）
6. 记忆检索结果回注认知引擎（复用相似历史结论加速计算）。
7. 记忆权重可视化曲线（PID 进化过程动画）。
8. 跨模块记忆共享（认知引擎 ↔ 可信总控台）。

---

## 八、风险与说明

- **复用而非重写**：三角审计、熔断、三分区总线均已存在，本层只做"学习编排"，不重复实现。
- **阈值同源**：记忆公理终审沿用 `TRUST_THRESHOLDS`（0.48/0.50/0.68），避免双源漂移。
- **StrictMode 双挂载**：联动触发沿用现有防重复逻辑，避免重复入库。
- **演示为主**：七维向量为前端轻量近似计算，非真实 Embedding 模型；生产环境可替换为后端向量库。