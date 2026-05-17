# 课链智教 AI 多智能体与工作流设计

## 一、设计理念

系统不追求"一个通用大模型解决所有问题"，而是按教学场景的实际需求，将 AI 能力拆分为多个具有明确职责的智能体，每个智能体有独立的系统提示词、输入上下文和输出格式约束。所有智能体通过统一的 OpenAI 兼容接口调用。

---

## 二、总体架构

```
┌──────────────────────────────────────────────────────────────┐
│                   课链智教 AI 智能体体系                        │
├──────────────────────────────────────────────────────────────┤
│  教师端智能体                                                  │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  LangGraph 6节点 SSE 工作流（深度生成模式）             │     │
│  │  analyzeNeeds → alignCurriculum → generateActivities │     │
│  │  → generateAssessments → evaluateConfidence         │     │
│  │  → assembleResource                                 │     │
│  ├─────────────────────────────────────────────────────┤     │
│  │  快速生成：ResourceGenerator（单次调用）               │     │
│  │  起草助手：DesignDrafter                             │     │
│  │  修订助手：RevisionAssistant（7方向局部修订）          │     │
│  │  学情分析：LearningAnalyst                           │     │
│  └─────────────────────────────────────────────────────┘     │
│  学生端智能体                                                  │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  AI伴学：StudentAssistant（苏格拉底式引导）            │     │
│  └─────────────────────────────────────────────────────┘     │
│  共享引擎                                                     │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  本地规则引擎：LocalRuleEngine（所有智能体的离线回退）   │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## 三、LangGraph 6节点 SSE 工作流（深度生成）

### 3.1 架构概述

深度生成模式基于 LangGraph `StateGraph` 实现，将资源生成拆分为 6 个独立节点以 DAG 编排，每个节点有独立的系统提示词和容错策略。全过程通过 SSE 实时推送进度至前端。

### 3.2 状态定义 (`state.ts`, 100行)

```typescript
interface WorkflowState {
  teachingNeed: TeachingNeed;          // 教师输入
  matchedGuides: GuideEntry[];         // 匹配的课程指南
  // 各节点输出
  needsAnalysis?: NeedsAnalysis;
  curriculumAlignment?: CurriculumAlignment;
  activities?: ActivitySet;
  assessments?: AssessmentSet;
  confidence?: ConfidenceReport;
  // 最终输出
  resourcePackage?: ClassroomResourcePackage;
  // 过程追踪
  currentNode: string;
  errors: WorkflowError[];
}
```

### 3.3 六节点详解

#### 节点1：analyzeNeeds — 需求分析 (77行)

| 项目 | 内容 |
|------|------|
| 职责 | 分析课例：核心知识点提取、学生准备度评估、设备约束识别、推荐教学策略 |
| 系统提示词 | 定位为"教学需求分析师"，要求输出结构化需求分析 |
| 容错 | 规则引擎基于年级、模块、课题名称生成默认分析 |
| SSE事件 | `progress: {step: "analyzeNeeds", percent: 5, message: "正在分析教学需求..."}` |

#### 节点2：alignCurriculum — 课标对齐 (117行)

| 项目 | 内容 |
|------|------|
| 职责 | 匹配2022版课标条目、TPACK 七维度分析（CK/PK/TK/PCK/TCK/TPK/TPACK）、四条核心素养映射 |
| 系统提示词 | 定位为"课程标准解读专家"，注入课标条目和TPACK框架 |
| 容错 | 规则引擎基于课程数据库匹配结果生成默认对齐 |
| SSE事件 | `progress: {step: "alignCurriculum", percent: 20, message: "正在对齐课程标准..."}` |

#### 节点3：generateActivities — 活动生成 (195行)

| 项目 | 内容 |
|------|------|
| 职责 | 按课型生成6环节教学流程、问题链设计、学习任务单、评价设计、板书设计、反思建议 |
| 系统提示词 | 定位为"教学活动设计师"，注入五种课型的六环节流程模板 |
| 容错 | 规则引擎按课型生成默认6环节流程 |
| SSE事件 | `progress: {step: "generateActivities", percent: 40, message: "正在设计教学活动..."}` |

#### 节点4：generateAssessments — 测评生成 (130行)

| 项目 | 内容 |
|------|------|
| 职责 | 按四层认知层次生成测评题：基础理解(单选2题)→原理阐述(判断1题)→情境迁移(简答1题)→创意表达(分析选做1题)；学情诊断模板 |
| 系统提示词 | 定位为"教学评价设计师"，注入分层测评规范和核心素养维度 |
| 容错 | 规则引擎生成默认分层题目 |
| SSE事件 | `progress: {step: "generateAssessments", percent: 65, message: "正在设计测评题目..."}` |

#### 节点5：evaluateConfidence — 置信度评估 (116行)

| 项目 | 内容 |
|------|------|
| 职责 | 7维度质量评估（课标一致性、素养达成度、学情贴合度、活动可操作性、资源完整度、课型匹配度、逻辑连贯性）；4条核心素养证据链（目标→活动→任务证据→测评证据→评价方法）；置信度综合评分 |
| 系统提示词 | 定位为"教学质量评估专家"，注入评估维度标准和证据链模板 |
| 容错 | 规则引擎按资源完整度生成默认置信度评分 |
| SSE事件 | `progress: {step: "evaluateConfidence", percent: 85, message: "正在评估资源质量..."}` |

#### 节点6：assembleResource — 资源组装（`graph.ts` 内联）

确定性地将前5个节点的输出组装为完整的 `ClassroomResourcePackage`，无需 AI 调用。

### 3.4 SSE 事件流

```
Client                    Server
  │  POST /api/ai/generate-workflow
  │                         │
  │  ◄── progress: analyzeNeeds (5%)
  │  ◄── progress: alignCurriculum (20%)
  │  ◄── progress: generateActivities (40%)
  │  ◄── progress: generateAssessments (65%)
  │  ◄── progress: evaluateConfidence (85%)
  │  ◄── progress: assembleResource (95%)
  │  ◄── done: { resourcePackage }
  │
  OR (fallback):
  │  ◄── fallback: { message, resourcePackage }
  │  ◄── done
  │
  OR (error):
  │  ◄── error: { message }
```

### 3.5 三层容错机制

| 层级 | 触发条件 | 处理方式 |
|------|----------|----------|
| 节点级 | 单节点 AI 调用超时/失败 | 规则引擎生成该节点的默认输出，继续下一节点 |
| 图级 | 多个节点失败或图执行异常 | `fallback.ts` 调用单次 AI 生成（`generateViaSingleCall`）兜底 |
| 前端级 | 后端完全不可用 | 前端 `createResourcePackage()` 本地规则引擎生成完整资源包 |

---

## 四、快速生成智能体（ResourceGenerator）

**调用方式**：POST `/api/ai/generate-resource`，单次 AI 调用完成所有资源生成。

**系统提示词三层注入**：
1. **角色层**：20年初中信息科技教研员
2. **知识层**：四条核心素养定义、五种课型六环节流程、TPACK七维度、分层测评规范
3. **约束层**（六条铁律）：JSON完整性、课型匹配、素养覆盖、可观察行为、认知层次、伦理安全

**输出格式**：完整的 `ClassroomResourcePackage` JSON。

---

## 五、教学设计起草智能体（DesignDrafter）

**调用**：POST `/api/ai/draft-design-points`

根据课题、年级、模块，生成三条核心素养目标和教学重难点。容错时使用课程数据库匹配条目填充。

---

## 六、AI 修订智能体（RevisionAssistant）

**设计原则**：局部优化而非整体重构，保留原文核心信息。

**7个快捷修订方向**：

| 方向 | 提示词策略 |
|------|-----------|
| 优化教学流程 | 检查环节顺序逻辑，提出更顺畅的过渡方案 |
| 增加教师追问 | 在关键知识点处插入引导性问题 |
| 降低难度 | 简化术语、增加类比、拆分步骤 |
| 增加过程性评价 | 在学习活动中嵌入可观察的评价指标 |
| 改得更具体 | 将抽象描述替换为可操作的行为描述 |
| 增强情境关联 | 将抽象任务与学生的数字生活经验建立联系 |
| 补充学科核心素养 | 在活动中显性标注素养培养点和培养方式 |

修订结果以 Diff 预览展示（原文红色、建议绿色、修订理由），教师确认方应用。

---

## 七、AI 伴学智能体（StudentAssistant）

**调用**：POST `/api/ai/student-assistant`

**五层约束提示词**：
1. **角色层**：耐心友善的学习伙伴
2. **行为层**：不直接给答案、使用提问引导、拆解复杂问题、提供思考支架
3. **格式层**：每次3-5句话，一个回复聚焦一个问题
4. **知识层**：附带课题、年级、模块、当前任务、学习目标、学法指导
5. **伦理层**：关注信息社会责任，鼓励诚实记录学习过程

**上下文注入**：每次对话附带当前课题信息和最近5轮对话历史。

---

## 八、学情分析智能体（LearningAnalyst）

基础统计（完成率、分层）由前端规则引擎完成。AI 接口预留用于生成深度的教学改进建议和个性化评语。

---

## 九、本地规则引擎（LocalRuleEngine）

当 AI 不可用时，自动切换至本地引擎，确保系统始终可运行：

| 能力 | 实现 |
|------|------|
| 资源包生成 | `createResourcePackage()`：按课型模板+课程数据库匹配生成 |
| 指南匹配 | `matchGuideEntry()`：加权评分算法（课题名、年级、模块、关键词） |
| 设计起草 | `buildLocalDesignPointsDraft()`：从指南条目提取目标、重难点 |
| 修订建议 | `buildAssistantPreview()`：按修订方向应用改写模板 |
| 伴学回复 | `generateRuleBasedReply()`：关键词匹配+苏格拉底式引导话术 |

切换对用户透明，教师和学生无需感知当前使用的是 AI 还是本地引擎。

---

## 十、设计特色

1. **教师可控**：所有 AI 输出须经教师确认，AI 是"建议者"而非"决策者"
2. **苏格拉底式伴学**：五层约束确保 AI 不直接给答案
3. **透明回退**：AI 与本地引擎之间无缝切换
4. **领域知识注入**：所有提示词注入课标和教学指南结构知识
5. **模型无关**：OpenAI 兼容协议，不绑定特定模型
6. **SSE 流式体验**：6节点工作流进度实时可视，教师可感知 AI 思考过程
