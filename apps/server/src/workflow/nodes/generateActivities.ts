import type { TeachingNeed } from "@kelian-zhixue/shared";
import { getProcedureNamesByType } from "@kelian-zhixue/shared";
import { callChatCompletions, extractJson } from "../../aiClient.js";
import type { ActivitiesOutput, AiConfig, CurriculumAlignment, NeedsAnalysis, SmartPrepState } from "../state.js";
import { GENERATE_ACTIVITIES_SYSTEM } from "../prompts/systemPrompts.js";
import { buildGenerateActivitiesPrompt } from "../prompts/userPromptBuilders.js";

interface RawProcedure {
  phase?: unknown;
  duration?: unknown;
  keyQuestion?: unknown;
  teacherActivity?: unknown;
  studentActivity?: unknown;
  designIntent?: unknown;
}

export function makeGenerateActivities(options: { onProgress: (ev: { stage: string; percent: number; detail: string }) => void }) {
  return async (state: typeof SmartPrepState.State): Promise<Partial<typeof SmartPrepState.State>> => {
    const { teachingNeed, needsAnalysis, curriculumAlignment, aiConfig } = state;
    if (!needsAnalysis || !curriculumAlignment) {
      return { currentNode: "generateActivities", currentDetail: "跳过（缺少前置结果）" };
    }

    options.onProgress({ stage: "活动生成", percent: 40, detail: "正在生成教学设计..." });

    try {
      const response = await callAiForActivities(teachingNeed, needsAnalysis, curriculumAlignment, aiConfig);
      const procCount = response.teachingProcedures.length;
      options.onProgress({ stage: "活动生成", percent: 58, detail: `已设计 ${procCount} 个教学环节，生成学习任务单` });
      return { activities: response, currentNode: "generateActivities", currentDetail: `已设计 ${procCount} 个教学环节` };
    } catch (err) {
      console.warn("[Workflow] generateActivities AI failed, using defaults:", err);
      const fallback = buildDefaultActivities(teachingNeed);
      options.onProgress({ stage: "活动生成", percent: 58, detail: "AI 调用失败，使用规则生成替代" });
      return { activities: fallback, currentNode: "generateActivities", currentDetail: "使用规则生成（AI 不可用）" };
    }
  };
}

async function callAiForActivities(
  teachingNeed: TeachingNeed,
  needsAnalysis: NeedsAnalysis,
  curriculumAlignment: CurriculumAlignment,
  aiConfig: AiConfig,
): Promise<ActivitiesOutput> {
  const messages = [
    { role: "system" as const, content: GENERATE_ACTIVITIES_SYSTEM },
    { role: "user" as const, content: buildGenerateActivitiesPrompt(teachingNeed, needsAnalysis, curriculumAlignment) },
  ];

  let response = await callChatCompletions({
    apiKey: aiConfig.apiKey,
    baseUrl: aiConfig.baseUrl,
    jsonMode: true,
    messages,
    model: aiConfig.model,
    temperature: 0.2,
  });

  if (!response.ok && [400, 404, 422].includes(response.status)) {
    response = await callChatCompletions({
      apiKey: aiConfig.apiKey,
      baseUrl: aiConfig.baseUrl,
      jsonMode: false,
      messages,
      model: aiConfig.model,
      temperature: 0.2,
    });
  }

  if (!response.ok) {
    throw new Error(`AI 返回异常：${response.status}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJson(content));

  const rawProcedures: RawProcedure[] = Array.isArray(parsed.teachingProcedures) ? parsed.teachingProcedures : [];
  const validProcedures = rawProcedures.filter((p) => p && typeof p.phase === "string" && p.phase.trim().length > 0);
  const expectedNames = getProcedureNamesByType(String(teachingNeed.lessonType || "新知建构课"));

  // 确保 duration 始终带单位
  const normalizeDuration = (d: unknown, fallback = "10分钟"): string => {
    if (typeof d === "number") return d + "分钟";
    if (typeof d === "string" && d.trim()) {
      const t = d.trim();
      if (t.includes("分钟")) return t;
      if (/^\d+$/.test(t)) return t + "分钟";
      return t;
    }
    return fallback;
  };

  // 按课型预期环节名称对齐：AI 返回的有效环节直接采用，不足的用课型默认名称补齐
  const teachingProcedures = expectedNames.map((name, i) => {
    if (i < validProcedures.length) {
      const p = validProcedures[i];
      return {
        phase: p.phase || name,
        duration: normalizeDuration(p.duration),
        keyQuestion: p.keyQuestion || "",
        teacherActivity: p.teacherActivity || "",
        studentActivity: p.studentActivity || "",
        designIntent: p.designIntent || "",
      };
    }
    return {
      phase: name,
      duration: "10分钟",
      keyQuestion: `${name}环节中，学生需要围绕"${teachingNeed.topicName}"解决什么问题？`,
      teacherActivity: `围绕"${teachingNeed.topicName}"组织${name}活动，提供必要材料、示例和追问。`,
      studentActivity: `完成${name}任务，在任务单中记录发现、步骤和证据。`,
      designIntent: `通过${name}环节推动课堂进程，帮助学生逐步建构理解。`,
    };
  });

  // 如果 AI 返回了超出课型预期的环节（如自定义扩展），追加到末尾
  const extraProcedures = validProcedures.slice(expectedNames.length).map((p) => ({
    phase: p.phase,
    duration: normalizeDuration(p.duration),
    keyQuestion: p.keyQuestion || "",
    teacherActivity: p.teacherActivity || "",
    studentActivity: p.studentActivity || "",
    designIntent: p.designIntent || "",
  }));

  // 安全转为字符串数组，防止 AI 返回对象导致前端渲染崩溃
  const toStringArray = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => (typeof item === "string" ? item : String(item)));
  };

  return {
    teachingProcedures: teachingProcedures.concat(extraProcedures),
    questionChain: toStringArray(parsed.questionChain),
    learningTaskSheet: {
      taskGoal: toStringArray(parsed.learningTaskSheet?.taskGoal),
      scenarioIntroduction: String(parsed.learningTaskSheet?.scenarioIntroduction || ""),
      taskSteps: toStringArray(parsed.learningTaskSheet?.taskSteps),
      learningSupports: toStringArray(parsed.learningTaskSheet?.learningSupports),
      groupRoles: toStringArray(parsed.learningTaskSheet?.groupRoles),
      recordTable: Array.isArray(parsed.learningTaskSheet?.recordTable) ? parsed.learningTaskSheet.recordTable : [],
      reflectionQuestions: toStringArray(parsed.learningTaskSheet?.reflectionQuestions),
    },
    evaluationDesign: toStringArray(parsed.evaluationDesign),
    blackboardDesign: toStringArray(parsed.blackboardDesign),
    reflectionSuggestions: toStringArray(parsed.reflectionSuggestions),
  };
}

function buildDefaultActivities(teachingNeed: TeachingNeed): ActivitiesOutput {
  const topic = teachingNeed.topicName;
  const names = getProcedureNamesByType(String(teachingNeed.lessonType || "新知建构课"));
  const durations = ["5分钟", "7分钟", "10分钟", "10分钟", "8分钟", "5分钟"];
  const teachingProcedures = names.map((phase, i) => ({
    phase,
    duration: durations[i] || "10分钟",
    keyQuestion: `${phase}环节中，学生需要围绕"${topic}"解决什么问题？`,
    teacherActivity: `围绕"${topic}"组织${phase}活动，提供必要材料、示例和追问，提醒学生留下学习证据。`,
    studentActivity: `完成${phase}任务，在学习任务单中记录自己的发现、步骤、证据或修改意见。`,
    designIntent: `让学生在${String(teachingNeed.lessonType || "新知建构课")}的课堂结构中逐步形成理解，并能迁移到真实数字生活。`,
  }));

  return {
    teachingProcedures,
    questionChain: [`${topic}是什么？`, `${topic}的核心要素有哪些？`, `这些要素是如何相互关联的？`, `${topic}在实际中如何应用？`],
    learningTaskSheet: {
      taskGoal: [
        `能说出${topic}的定义和核心要素`,
        `能描述${topic}的基本过程和原理`,
        `能运用所学分析${topic}相关的实际问题`,
        `能在学习过程中体现合作意识和探究精神`,
      ],
      scenarioIntroduction: `假如你在生活中遇到了与${topic}相关的情境，你会如何分析和处理？`,
      taskSteps: [
        "任务一（5分钟）：在任务单上写出你对课题的已有认识。",
        "任务二（10分钟）：根据课堂讲解，完成概念关系图的填写。",
        "任务三（10分钟）：完成实践应用任务，在任务单上记录过程和结果。",
        "任务四（5分钟）：完成自我评价和反思问题。",
      ],
      learningSupports: [
        "核心概念关键词清单",
        "概念关系图模板",
        "实践任务操作提示卡",
      ],
      groupRoles: ["自评：按评价标准给自己打分并写一句评语", "互评：对你的搭档写一句肯定和一条建议"],
      recordTable: [{ "评估维度": "概念理解", "评分标准": "能用自己话解释核心概念", "自评": "", "互评": "" }],
      reflectionQuestions: ["这课中你最有收获的部分是什么？", "还有什么概念你觉得还不够清楚？", "你能想到一个生活中运用本课知识的例子吗？"],
    },
    evaluationDesign: ["课堂参与度观察", "任务单完成质量", "小组展示表现"],
    blackboardDesign: [`课题：${topic}`, "一、核心概念", "二、基本原理", "三、实践应用"],
    reflectionSuggestions: ["学生对核心概念的掌握程度如何？", "教学节奏是否合适？", "下次教学是否需要在某个环节增加更多支架？"],
  };
}
