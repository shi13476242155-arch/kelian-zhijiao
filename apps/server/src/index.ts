import cors from "cors";
import express from "express";
import type { AppInfo, ClassroomResourcePackage, TeachingNeed } from "@kelian-zhixue/shared";
import { callChatCompletions, extractJson, loadLocalEnv, resolveAiConfig, simplifyAiError } from "./aiClient.js";
import { buildSmartPrepGraph } from "./workflow/graph.js";
import { sendDone, sendError, sendFallback, sendProgress, sendResult, buildSseWriter } from "./workflow/sse.js";
import { generateViaSingleCall } from "./workflow/fallback.js";

loadLocalEnv();

const app = express();
const port = Number(process.env.PORT ?? 3000);

const appInfo: AppInfo = {
  name: "课链智教",
  version: "0.0.1",
  stage: "V0 最小可运行版本",
  description: "初中信息科技AI协同教学与学情闭环系统。",
  features: ["教师工作台", "标准化课堂资源包", "Mock 数据", "后续 AI 工作流扩展预留"]
};

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "kelian-zhixue-server",
    time: new Date().toISOString()
  });
});

app.get("/api/app-info", (_req, res) => {
  res.json(appInfo);
});

app.post("/api/ai/generate-resource", async (req, res) => {
  const teachingNeed = req.body?.teachingNeed as TeachingNeed | undefined;
  const fallbackResource = req.body?.fallbackResource as ClassroomResourcePackage | undefined;
  const guideBasis = req.body?.guideBasis;
  const aiConfig = resolveAiConfig(req.body?.aiConfig);

  if (!teachingNeed?.topicName) {
    res.status(400).json({ error: "请先填写课题名称，再生成课堂资源包。" });
    return;
  }

  const { apiKey, baseUrl, model } = aiConfig;

  if (!apiKey) {
    res.status(400).json({ error: "后端尚未配置 AI_API_KEY，已交由前端使用本地 mock 生成。" });
    return;
  }

  try {
    let response = await callChatCompletions({ apiKey, baseUrl, jsonMode: true, messages: buildGenerateMessages(teachingNeed, fallbackResource, guideBasis), model, temperature: 0.2 });
    if (!response.ok && [400, 404, 422].includes(response.status)) {
      response = await callChatCompletions({ apiKey, baseUrl, jsonMode: false, messages: buildGenerateMessages(teachingNeed, fallbackResource, guideBasis), model, temperature: 0.2 });
    }

    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ error: `AI 服务返回异常：${response.status}`, detail: text.slice(0, 500) });
      return;
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    const resource = parseAiResource(content);
    res.json({ model, resource, source: "ai" });
  } catch (error) {
    res.status(502).json({
      error: "AI 服务调用失败，请检查模型地址、密钥或网络。",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/api/ai/test-connection", async (req, res) => {
  const { apiKey, baseUrl, model } = resolveAiConfig(req.body?.aiConfig);
  if (!apiKey) {
    res.status(400).json({ error: "请先填写 API Key。" });
    return;
  }
  try {
    const response = await callChatCompletions({
      apiKey,
      baseUrl,
      jsonMode: false,
      messages: [
        { role: "system", content: "你是连接测试助手。请用一句中文回复连接正常。" },
        { role: "user", content: "请回复：连接正常" }
      ],
      model,
      temperature: 0
    });
    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ error: `AI 服务返回异常：${response.status}`, detail: simplifyAiError(text) });
      return;
    }
    res.json({ message: "连接正常", model });
  } catch (error) {
    res.status(502).json({ error: "连接失败，请检查模型地址、密钥或网络。", detail: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/ai/draft-design-points", async (req, res) => {
  const teachingNeed = req.body?.teachingNeed as TeachingNeed | undefined;
  const guideBasis = req.body?.guideBasis;
  const fallbackDraft = req.body?.fallbackDraft;
  const { apiKey, baseUrl, model } = resolveAiConfig(req.body?.aiConfig);

  if (!teachingNeed?.topicName) {
    res.status(400).json({ error: "请先填写课题名称。" });
    return;
  }
  if (!apiKey) {
    res.status(400).json({ error: "请先配置 API Key。" });
    return;
  }

  try {
    let response = await callChatCompletions({
      apiKey,
      baseUrl,
      jsonMode: true,
      messages: buildDesignPointMessages(teachingNeed, guideBasis, fallbackDraft),
      model,
      temperature: 0.2
    });
    if (!response.ok && [400, 404, 422].includes(response.status)) {
      response = await callChatCompletions({
        apiKey,
        baseUrl,
        jsonMode: false,
        messages: buildDesignPointMessages(teachingNeed, guideBasis, fallbackDraft),
        model,
        temperature: 0.2
      });
    }
    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ error: `AI 服务返回异常：${response.status}`, detail: simplifyAiError(text) });
      return;
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    const draft = JSON.parse(extractJson(content));
    if (!draft.teacherEditableText?.teachingObjectives || !draft.teacherEditableText?.teachingFocus || !draft.teacherEditableText?.teachingDifficulty) {
      throw new Error("AI 输出缺少教学设计要点字段。");
    }
    res.json({ draft, model, source: "ai" });
  } catch (error) {
    res.status(502).json({ error: "AI 起草失败，已交由前端使用本地依据生成。", detail: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/ai/student-assistant", async (req, res) => {
  const { aiConfig, question, context } = (req.body ?? {}) as {
    aiConfig?: unknown;
    question?: string;
    context?: { topicName?: string; grade?: string; currentTask?: string; taskGoal?: string[]; learningSupports?: string[] };
  };

  if (!question?.trim()) {
    res.status(400).json({ error: "请先输入问题。" });
    return;
  }

  const { apiKey, baseUrl, model } = resolveAiConfig(aiConfig);
  if (!apiKey || apiKey === "your_api_key_here") {
    res.status(400).json({ error: "后端尚未配置 AI_API_KEY，AI 伴学暂不可用。" });
    return;
  }

  try {
    const response = await callChatCompletions({
      apiKey,
      baseUrl,
      jsonMode: false,
      messages: buildStudentAssistantMessages(question, context),
      model,
      temperature: 0.5
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      res.status(502).json({ error: `AI 服务返回异常：${response.status}`, detail: text.slice(0, 500) });
      return;
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = data.choices?.[0]?.message?.content ?? "";
    if (!reply.trim()) {
      res.status(502).json({ error: "AI 返回为空，请稍后重试。" });
      return;
    }

    res.json({ reply, model, source: "ai" });
  } catch (error) {
    res.status(502).json({ error: "AI 服务调用失败，请检查网络或稍后重试。", detail: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/ai/generate-workflow", async (req, res) => {
  const teachingNeed = req.body?.teachingNeed as TeachingNeed | undefined;
  const fallbackResource = req.body?.fallbackResource as ClassroomResourcePackage | undefined;
  const guideBasis = req.body?.guideBasis;
  const aiConfig = resolveAiConfig(req.body?.aiConfig);

  if (!teachingNeed?.topicName) {
    res.status(400).json({ error: "请先填写课题名称。" });
    return;
  }

  if (!aiConfig.apiKey) {
    res.status(400).json({ error: "请先配置 API Key。" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const write = buildSseWriter(res);

  try {
    const graph = buildSmartPrepGraph({
      onProgress: (ev) => {
        sendProgress(write, ev.stage, ev.percent, ev.detail, ev.stage);
      },
    });

    const result = await graph.invoke({
      teachingNeed,
      aiConfig: { apiKey: aiConfig.apiKey, baseUrl: aiConfig.baseUrl, model: aiConfig.model },
      guideBasis,
    });

    if (result.finalResource) {
      sendResult(
        write,
        result.finalResource,
        result.confidenceEvaluation?.overallConfidence,
        result.confidenceEvaluation?.riskAlerts,
      );
      sendDone(write, "智能备课工作流完成");
    } else {
      sendError(write, "工作流未生成有效资源");
    }
  } catch (error) {
    console.warn("[Workflow] Graph-level failure, falling back to single call:", error);
    // Layer 2 fallback: single-shot AI generation
    try {
      sendFallback(write, "工作流引擎异常，正在使用备用生成方式...");
      const fallbackResult = await generateViaSingleCall(teachingNeed, aiConfig, fallbackResource, guideBasis);
      if (fallbackResult) {
        sendResult(write, fallbackResult);
        sendDone(write, "已通过备用方式生成");
      } else {
        sendError(write, "AI 服务暂时不可用，请稍后重试");
      }
    } catch (fallbackErr) {
      sendError(
        write,
        "AI 服务暂时不可用，请稍后重试或使用本地生成。",
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
      );
    }
  } finally {
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Kelian Zhixue server is running at http://localhost:${port}`);
});

function buildGenerateMessages(teachingNeed: TeachingNeed, fallbackResource?: ClassroomResourcePackage, guideBasis?: unknown) {
  return [
    {
      role: "system",
      content: buildSystemPrompt()
    },
    {
      role: "user",
      content: buildGeneratePrompt(teachingNeed, fallbackResource, guideBasis)
    }
  ];
}

function buildSystemPrompt() {
  return [
    "你是拥有 20 年教龄的初中信息科技教研员，同时每周上 12 节课。",
    "你严格依据《义务教育信息科技课程标准（2022 年版）》设计每一节课。",
    "",
    "## 你熟悉的三个课程模块",
    "- 七年级「互联网应用与创新」：围绕互联网基本原理、数据传输、网络协议、网页制作、在线学习与生活、网络安全与责任。",
    "- 八年级「物联网实践与探索」：围绕传感器、RFID/蓝牙等通信方式、MQTT 协议、物联系统三层结构、智能控制与反馈、物联安全。",
    "- 九年级「人工智能与智慧社会」：围绕 AI 基本概念与实现方式、自然语言处理、图像识别与生成、推理与决策、智慧社会与伦理。",
    "",
    "## 五种课型及其教学流程",
    "- 新知建构课：真实情境 → 问题分解 → 原理探究 → 模型建构 → 体系建构 → 迁移应用",
    "- 项目实践课：问题驱动 → 需求分析 → 方案设计 → 迭代优化 → 成果展示 → 反思评价",
    "- 实验探究课：问题驱动 → 猜想假设 → 实验设计 → 解释论证 → 评估交流 → 迁移拓展",
    "- 技能应用课：任务驱动 → 范例解析 → 模仿操作 → 变式练习 → 技能整合 → 综合创新",
    "- 跨学科主题课：真实问题 → 跨科探究 → 方案设计 → 作品创作 → 展示评价 → 拓展反思",
    "",
    "## 四个核心素养的定义",
    "- 信息意识：对信息的敏感度和判断力，能发现信息问题、评估信息来源。",
    "- 计算思维：运用计算机科学的思想方法解决问题，包括问题分解、模式识别、抽象化和算法设计。",
    "- 数字化学习与创新：利用数字工具和资源进行学习与创造，适应数字化环境。",
    "- 信息社会责任：理解信息安全、隐私保护、法律法规，负责任地使用信息技术。",
    "",
    "## 输出铁律",
    "1. 严格输出合法 JSON，不要 Markdown，不要注释。",
    "2. 保留 fallbackResource 的全部字段名和 JSON 结构，只替换内容。",
    "3. 用中文输出所有文本字段。",
    "4. 每个教学活动必须包含：教师具体话术、学生具体任务、可观察的学习证据。",
    "5. 测评题必须分四层：基础理解（识记）、原理阐述（解释）、情境迁移（应用）、创意表达（创新）。",
    "6. 不用万能模板语言（如「根据实际情况调整」），每一句话都要针对本课。"
  ].join("\n");
}

function buildGeneratePrompt(teachingNeed: TeachingNeed, fallbackResource?: ClassroomResourcePackage, guideBasis?: unknown) {
  const guideLines = guideBasis ? buildGuideBasisSection(guideBasis) : "";
  const lessonType = String(teachingNeed.lessonType || "新知建构课");
  const procedureNames = getProcedureNamesForPrompt(lessonType);
  const methodLines = getTeachingMethodsForPrompt(lessonType);

  return [
    `请根据以下全部信息，生成一份高质量的初中信息科技课堂资源包 JSON。`,
    "",
    "## 本课基本信息",
    `课题：${teachingNeed.topicName}`,
    `年级：${String(teachingNeed.grade)}`,
    `模块：${String(teachingNeed.courseModule)}`,
    `课型：${lessonType}`,
    `课时：${String(teachingNeed.classHours || "1")}`,
    `设备条件：${String(teachingNeed.equipmentCondition || "")}`,
    `学生基础：${String(teachingNeed.studentFoundation || "")}`,
    `教师补充要求：${String(teachingNeed.additionalNeeds || "")}`,
    "",
    "## 课型要求",
    `本课为「${lessonType}」，教学流程必须按以下环节展开：${procedureNames.join(" → ")}。`,
    `每个环节必须包含：核心问题（keyQuestion）、教师活动（teacherActivity，写具体话术和动作）、学生活动（studentActivity，写具体任务）、设计意图（designIntent）。`,
    `建议教学方法：${methodLines}`,
    "",
    guideLines,
    "",
    "## 教学活动设计铁律（最重要）",
    "每个教学环节（procedures 数组中的每个对象）必须包含全部 5 个字段：phase、duration、keyQuestion、teacherActivity、studentActivity、designIntent。缺少任何一个字段都是不合格的输出。",
    "teacherActivity 字段（必填！）必须写 80-200 字：教师在课堂上实际说的话（至少1句原话用引号标出）和做的动作（发材料、巡视、投屏、追问），写清组织方式（全班/小组/个人）。例如「教师展示快递包裹图片，提问：'这个包裹从北京到广州经过了哪些步骤？'请同学们在任务单上写出至少3个步骤。教师巡视各小组，对进度慢的小组提示'先从寄件开始想'。」",
    "studentActivity 字段（必填！）必须写 60-150 字：学生具体做什么（观察/讨论/记录/操作/展示）、产出什么（任务单某栏、口头回答、流程图、界面截图）、互动形式（独立/两人互查/小组交流）。例如「小组合作在 A3 纸上画出数据包传输的5个步骤，标注每一步的作用，选一名代表准备1分钟展示。每位同学在任务单'过程记录'栏填写自己的理解。」",
    "keyQuestion 必须是一个具体可追问的问题，不能是「学生需要想清楚什么」这样的套话。",
    "designIntent 必须解释为什么这个环节这样设计，与课型和素养目标的关系，30-80 字。",
    "环节之间要有逻辑递进：前一个环节的产出是后一个环节的输入。",
    "",
    "## 学习任务单要求",
    "taskGoal：4 条具体可检测的目标，用「能……」句式。",
    "scenarioIntroduction：一段 200 字以内的真实情境描述，直接用于课堂导入。",
    "taskSteps：3-4 个具体任务步骤，每个标注时长、学生产出和评价标准。",
    "learningSupports：3 条具体的学习支架（如提示卡模板、关键词清单、连句表达）。",
    "groupRoles：自评、互评、教师评价的具体维度和标准。",
    "reflectionQuestions：3 个引导反思的问题。",
    "",
    "## 分层测评题要求（每道题必须是纯文本字符串，严格按以下格式）",
    "basicUnderstanding（基础理解）：至少 2 道单选题。每题格式：单选题N：<题干>\\nA. <选项A>\\nB. <选项B>\\nC. <选项C>\\nD. <选项D>\\n参考答案：<A/B/C/D>",
    "principleExplanation（原理阐述）：至少 2 道判断题。每题格式：判断题N：<陈述>\\n参考答案：<对或错>",
    "scenarioTransfer（情境迁移）：至少 2 道简答题。每题格式：简答题N：<题干>\\n评分要点：<得分点>",
    "creativeExpression（创意表达）：至少 1 道分析题（选做）。每题格式：分析题N（选做）：<题干>\\n评价维度：<维度>",
    "",
    "## 学情诊断表要求",
    "evaluationDimensions：4-5 个评价维度，涵盖知识、过程、素养、态度。",
    "dataSources：具体的课堂数据来源（任务单、测评题、展示记录、课堂追问等）。",
    "diagnosisRules：至少 3 条具体可执行的诊断规则（如「任务单中过程记录为空的学生需要课后补充」）。",
    "",
    "## TPACK 分析要求",
    "每个维度（CK/PK/TK/PCK/TCK/TPK/TPACK）写 1-2 句针对本课的实质性分析，不要用「涉及概念」「结合设备」这样的套话。",
    "",
    "## 核心素养证据链要求",
    "围绕四个核心素养各设计一条 evidence chain：明确素养类型 → 对应教学目标 → 学习活动 → 任务证据 → 评价方式。",
    "",
    "## 输出格式",
    "只输出一个 JSON 对象，字段结构与 fallbackResource 完全一致。不要输出任何解释文字。",
    "",
    `TeachingNeed: ${JSON.stringify(teachingNeed)}`,
    `fallbackResource: ${JSON.stringify(fallbackResource ?? {})}`
  ].join("\n");
}

function buildGuideBasisSection(guideBasis: unknown) {
  const gb = guideBasis as Record<string, unknown>;
  const lines: string[] = ["## 教学指南依据（来自教材配套教学指南库）"];
  if (Array.isArray(gb.guideObjectives) && gb.guideObjectives.length > 0) {
    lines.push(`本课教学目标建议：${gb.guideObjectives.join("；")}`);
  }
  if (Array.isArray(gb.guideFocus) && gb.guideFocus.length > 0) {
    lines.push(`本课教学重点建议：${gb.guideFocus.join("；")}`);
  }
  if (Array.isArray(gb.guideDifficulty) && gb.guideDifficulty.length > 0) {
    lines.push(`本课教学难点建议：${gb.guideDifficulty.join("；")}`);
  }
  if (Array.isArray(gb.suggestedActivities) && gb.suggestedActivities.length > 0) {
    lines.push(`本课建议课堂活动：${gb.suggestedActivities.join("；")}`);
  }
  return lines.join("\n");
}

function getProcedureNamesForPrompt(type: string) {
  const map: Record<string, string[]> = {
    新知建构课: ["真实情境", "问题分解", "原理探究", "模型建构", "体系建构", "迁移应用"],
    项目实践课: ["问题驱动", "需求分析", "方案设计", "迭代优化", "成果展示", "反思评价"],
    实验探究课: ["问题驱动", "猜想假设", "实验设计", "解释论证", "评估交流", "迁移拓展"],
    技能应用课: ["任务驱动", "范例解析", "模仿操作", "变式练习", "技能整合", "综合创新"],
    跨学科主题课: ["真实问题", "跨科探究", "方案设计", "作品创作", "展示评价", "拓展反思"]
  };
  return map[type] ?? map.新知建构课;
}

function getTeachingMethodsForPrompt(type: string) {
  const map: Record<string, string> = {
    新知建构课: "发现/探究式学习为主，辅以情境教学法、类比法、概念图。",
    项目实践课: "项目式学习，任务驱动、方案设计、迭代优化、展示评价。",
    实验探究课: "实验探究式学习，猜想假设、实验设计、证据解释、交流论证。",
    技能应用课: "技能训练与应用，示范教学、模仿操作、变式练习、即时反馈。",
    跨学科主题课: "跨学科主题学习，真实问题解决、综合实践、作品创作。"
  };
  return map[type] ?? map.新知建构课;
}

function buildDesignPointMessages(teachingNeed: TeachingNeed, guideBasis: unknown, fallbackDraft: unknown) {
  const guideSection = guideBasis ? buildGuideBasisSection(guideBasis) : "";
  return [
    {
      role: "system",
      content: [
        "你是初中信息科技教研员，专门负责审核和起草教学设计要点。",
        "你必须严格依据 2022 版义务教育信息科技课程标准、教学指南、学情和设备条件来起草。",
        "四个核心素养是：信息意识、计算思维、数字化学习与创新、信息社会责任。",
        "教学目标的标题必须表述为「基于核心素养的教学目标」。",
        "每个目标必须包含具体可观察的学习证据。",
        "重点难点必须针对课题内容本身和本班学情，不能用通用套话。",
        "必须输出 JSON，不要 Markdown。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "请输出与 fallbackDraft 完全相同的 JSON 字段结构，只替换为更高质量内容。",
        "",
        guideSection,
        "",
        "## 教学目标要求（格式铁律）",
        "四个目标分别对应四个核心素养（信息意识、计算思维、数字化学习与创新、信息社会责任），每个目标含：",
        "- literacy：核心素养名称",
        "- objective：具体可检测的教学目标（用「能……」句式，行为动词明确）",
        "- evidence：课堂上可以观察到的学习证据（学生做了什么、产出了什么、说了什么）",
        "",
        "teacherEditableText.teachingObjectives 的文本格式必须严格如下（每个目标两行，目标行和证据行之间用换行分隔）：",
        "信息意识：能……（具体目标）",
        "证据：……（可观察的学习证据）",
        "计算思维：能……（具体目标）",
        "证据：……（可观察的学习证据）",
        "数字化学习与创新：能……（具体目标）",
        "证据：……（可观察的学习证据）",
        "信息社会责任：能……（具体目标）",
        "证据：……（可观察的学习证据）",
        "注意：每个目标后面必须紧跟一行「证据：」，证据必须是课堂上可观察到的具体行为或产出。",
        "",
        "## 重点难点要求",
        "- teachingFocus：2-3 条具体的教学重点，指向本课核心概念和过程",
        "- teachingDifficulty：2-3 条具体的教学难点，说明学生可能卡在哪里以及为什么",
        "",
        "## 突破策略要求",
        "- breakthroughStrategies：3-4 条具体策略，每条说明用什么方法帮助学生突破难点",
        "",
        `TeachingNeed: ${JSON.stringify(teachingNeed)}`,
        `FallbackDraft: ${JSON.stringify(fallbackDraft ?? {})}`
      ].join("\n\n")
    }
  ];
}

function normalizeDuration(d: unknown, fallback = "10分钟"): string {
  if (typeof d === "number") return d + "分钟";
  if (typeof d === "string" && d.trim()) {
    const t = d.trim();
    if (t.includes("分钟")) return t;
    if (/^\d+$/.test(t)) return t + "分钟";
    return t;
  }
  return fallback;
}

function parseAiResource(content: string) {
  const parsed = JSON.parse(extractJson(content)) as ClassroomResourcePackage;
  if (!parsed.teachingNeed || !parsed.teachingDesign || !parsed.learningTaskSheet || !parsed.layeredAssessment || !parsed.learningDiagnosisTemplate) {
    throw new Error("AI 输出缺少课堂资源包必要字段。");
  }
  // 确保教学环节每个字段都有内容，防止 AI 漏掉 teacherActivity / studentActivity
  if (Array.isArray(parsed.teachingDesign.procedures)) {
    parsed.teachingDesign.procedures = parsed.teachingDesign.procedures.map((p, i) => ({
      phase: p.phase || `环节${i + 1}`,
      duration: normalizeDuration(p.duration),
      keyQuestion: p.keyQuestion || `${p.phase || "本环节"}的核心问题是什么？`,
      teacherActivity: p.teacherActivity || `教师组织${p.phase || "教学"}活动，提供材料、示例和追问，引导学生思考并记录。`,
      studentActivity: p.studentActivity || `学生完成${p.phase || "学习"}任务，在任务单中记录发现、步骤和证据。`,
      designIntent: p.designIntent || `通过${p.phase || "本环节"}推进课堂进程，帮助学生建构理解。`,
    }));
  }
  return parsed;
}

function buildStudentAssistantMessages(question: string, context?: { topicName?: string; grade?: string; currentTask?: string; taskGoal?: string[]; learningSupports?: string[] }) {
  const ctx = context ?? {};
  return [
    {
      role: "system",
      content: [
        "你是初中信息科技课堂的 AI 伴学助手，正在陪伴一名学生完成课堂任务和测评。",
        "",
        "## 你的角色",
        "- 你是苏格拉底式引导者：通过追问、拆解、类比帮助学生自己找到答案，绝不直接给出答案。",
        "- 你是耐心鼓励者：用温和积极的语气，肯定学生的每一次努力。",
        "- 你是学习支架：把复杂问题拆成小步骤，提供思考框架和表达模板。",
        "",
        "## 铁律",
        "1. 绝不直接给出测评题的答案或任务单的完整填写内容。",
        "2. 用提问引导思考：「你观察到了什么？」「可以先拆成几步？」「还记得课堂上的类比吗？」",
        "3. 遇到学生说「不会」「不懂」时，先安慰再拆解：「没关系，我们一步一步来。你先说说你已经理解的部分。」",
        "4. 回复控制在 3-5 句话，简洁有力，符合初中生的阅读水平。",
        "5. 涉及信息安全、隐私、责任时，要强调负责任的使用。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        ctx.topicName ? `当前课题：《${ctx.topicName}》（${ctx.grade || ""}）` : "",
        ctx.currentTask ? `学生正在完成：${ctx.currentTask}` : "",
        ctx.taskGoal?.length ? `任务目标：${ctx.taskGoal.join("；")}` : "",
        ctx.learningSupports?.length ? `可用学习支架：${ctx.learningSupports.join("；")}` : "",
        "",
        `学生的问题：${question}`,
        "",
        "请作为 AI 伴学助手回复。"
      ].filter(Boolean).join("\n")
    }
  ];
}

