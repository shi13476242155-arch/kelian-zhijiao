import type { CoreLiteracy, TeachingNeed } from "@kelian-zhixue/shared";
import { callChatCompletions, extractJson } from "../../aiClient.js";
import type { AiConfig, CurriculumAlignment, NeedsAnalysis, SmartPrepState } from "../state.js";
import { ALIGN_CURRICULUM_SYSTEM } from "../prompts/systemPrompts.js";
import { buildAlignCurriculumPrompt } from "../prompts/userPromptBuilders.js";

export function makeAlignCurriculum(options: { onProgress: (ev: { stage: string; percent: number; detail: string }) => void }) {
  return async (state: typeof SmartPrepState.State): Promise<Partial<typeof SmartPrepState.State>> => {
    const { teachingNeed, needsAnalysis, aiConfig, guideBasis } = state;
    if (!needsAnalysis) {
      return { currentNode: "alignCurriculum", currentDetail: "跳过（缺少需求分析结果）" };
    }

    options.onProgress({ stage: "课标对齐", percent: 22, detail: "正在匹配课程标准..." });

    try {
      const response = await callAiForCurriculumAlignment(teachingNeed, needsAnalysis, aiConfig, guideBasis);
      options.onProgress({ stage: "课标对齐", percent: 38, detail: `已匹配 ${response.matchedStandards.length} 条课标，完成 TPACK 分析` });
      return { curriculumAlignment: response, currentNode: "alignCurriculum", currentDetail: `已匹配 ${response.matchedStandards.length} 条课标` };
    } catch (err) {
      console.warn("[Workflow] alignCurriculum AI failed, using defaults:", err);
      const fallback = buildDefaultCurriculumAlignment(teachingNeed, needsAnalysis);
      options.onProgress({ stage: "课标对齐", percent: 38, detail: "AI 调用失败，使用规则对齐替代" });
      return { curriculumAlignment: fallback, currentNode: "alignCurriculum", currentDetail: "使用规则对齐（AI 不可用）" };
    }
  };
}

async function callAiForCurriculumAlignment(
  teachingNeed: TeachingNeed,
  needsAnalysis: NeedsAnalysis,
  aiConfig: AiConfig,
  guideBasis?: unknown,
): Promise<CurriculumAlignment> {
  const messages = [
    { role: "system" as const, content: ALIGN_CURRICULUM_SYSTEM },
    { role: "user" as const, content: buildAlignCurriculumPrompt(teachingNeed, needsAnalysis, guideBasis) },
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

  return {
    matchedStandards: Array.isArray(parsed.matchedStandards) ? parsed.matchedStandards : [],
    teachingGuideReferences: Array.isArray(parsed.teachingGuideReferences) ? parsed.teachingGuideReferences : [],
    coreLiteracyMapping: Array.isArray(parsed.coreLiteracyMapping) ? parsed.coreLiteracyMapping : [],
    tpackAnalysis: {
      ck: parsed.tpackAnalysis?.ck || "",
      pk: parsed.tpackAnalysis?.pk || "",
      tk: parsed.tpackAnalysis?.tk || "",
      pck: parsed.tpackAnalysis?.pck || "",
      tck: parsed.tpackAnalysis?.tck || "",
      tpk: parsed.tpackAnalysis?.tpk || "",
      tpack: parsed.tpackAnalysis?.tpack || "",
    },
    learningObjectives: Array.isArray(parsed.learningObjectives) ? parsed.learningObjectives : [],
  };
}

function buildDefaultCurriculumAlignment(teachingNeed: TeachingNeed, needsAnalysis: NeedsAnalysis): CurriculumAlignment {
  const grade = String(teachingNeed.grade);
  const module = String(teachingNeed.courseModule);
  return {
    matchedStandards: [
      `依据《义务教育信息科技课程标准（2022年版）》${grade}「${module}」模块要求，本课涉及信息意识与计算思维的培养。`,
    ],
    teachingGuideReferences: [
      `参照义务教育信息科技教学指南${grade}「${module}」相关章节。`,
    ],
    coreLiteracyMapping: [
      { literacy: "信息意识" as CoreLiteracy, targetDescription: `能从${teachingNeed.topicName}相关情境中发现信息问题` },
      { literacy: "计算思维" as CoreLiteracy, targetDescription: `能运用问题分解和模式识别方法分析${needsAnalysis.keyConcepts[0] || teachingNeed.topicName}` },
      { literacy: "数字化学习与创新" as CoreLiteracy, targetDescription: `能利用数字工具完成${teachingNeed.topicName}相关的学习任务` },
      { literacy: "信息社会责任" as CoreLiteracy, targetDescription: `能在${teachingNeed.topicName}学习过程中体现信息安全意识和责任担当` },
    ],
    tpackAnalysis: {
      ck: `本课涉及${needsAnalysis.keyConcepts.join("、")}等核心概念，属于${module}模块的关键内容。`,
      pk: "采用情境导入结合任务驱动的教学策略，注重学生的体验和参与。",
      tk: "利用计算机教室和网络环境，辅以多媒体教学资源。",
      pck: `将${teachingNeed.topicName}的抽象概念通过具体实例和类比让学生理解。`,
      tck: "借助数字工具展示抽象概念的可视化表达。",
      tpk: "利用信息技术支持分组协作和即时反馈。",
      tpack: `在${module}教学中整合技术、教学法和内容知识，实现${teachingNeed.topicName}的有效教学。`,
    },
    learningObjectives: [
      `信息意识：能识别${teachingNeed.topicName}相关的信息问题，初步判断信息来源的可靠性。`,
      `计算思维：能运用分解和抽象的方法理解${teachingNeed.topicName}的基本过程，建立概念模型。`,
      `数字化学习与创新：能利用数字工具完成${teachingNeed.topicName}的学习任务，创造性地表达学习成果。`,
      `信息社会责任：能在${teachingNeed.topicName}的学习和实践中关注信息安全与责任问题。`,
    ],
  };
}
