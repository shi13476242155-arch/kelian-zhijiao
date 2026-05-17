import type { TeachingNeed } from "@kelian-zhixue/shared";
import { callChatCompletions, extractJson } from "../../aiClient.js";
import type { AiConfig, NeedsAnalysis, SmartPrepState } from "../state.js";
import { NEEDS_ANALYSIS_SYSTEM } from "../prompts/systemPrompts.js";
import { buildNeedsAnalysisPrompt } from "../prompts/userPromptBuilders.js";

export function makeAnalyzeNeeds(options: { onProgress: (ev: { stage: string; percent: number; detail: string }) => void }) {
  return async (state: typeof SmartPrepState.State): Promise<Partial<typeof SmartPrepState.State>> => {
    const { teachingNeed, aiConfig } = state;
    options.onProgress({ stage: "需求分析", percent: 2, detail: "正在分析课例信息..." });

    try {
      const response = await callAiForNeedsAnalysis(teachingNeed, aiConfig);
      options.onProgress({ stage: "需求分析", percent: 18, detail: `已识别 ${response.keyConcepts.length} 个核心知识点` });
      return { needsAnalysis: response, currentNode: "analyzeNeeds", currentDetail: `已识别 ${response.keyConcepts.length} 个核心知识点` };
    } catch (err) {
      console.warn("[Workflow] analyzeNeeds AI failed, using defaults:", err);
      const fallback = buildDefaultNeedsAnalysis(teachingNeed);
      options.onProgress({ stage: "需求分析", percent: 18, detail: "AI 调用失败，使用规则分析替代" });
      return { needsAnalysis: fallback, currentNode: "analyzeNeeds", currentDetail: "使用规则分析（AI 不可用）" };
    }
  };
}

async function callAiForNeedsAnalysis(teachingNeed: TeachingNeed, aiConfig: AiConfig): Promise<NeedsAnalysis> {
  const messages = [
    { role: "system" as const, content: NEEDS_ANALYSIS_SYSTEM },
    { role: "user" as const, content: buildNeedsAnalysisPrompt(teachingNeed) },
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
    keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
    studentReadiness: String(parsed.studentReadiness || ""),
    equipmentConstraints: String(parsed.equipmentConstraints || ""),
    recommendedApproach: String(parsed.recommendedApproach || ""),
    knowledgePointChain: Array.isArray(parsed.knowledgePointChain) ? parsed.knowledgePointChain : [],
  };
}

function buildDefaultNeedsAnalysis(teachingNeed: TeachingNeed): NeedsAnalysis {
  const topic = teachingNeed.topicName;
  return {
    keyConcepts: [topic, `${topic}的基本原理`, `${topic}的实际应用`],
    studentReadiness: teachingNeed.studentFoundation || "学生具备基本的计算机操作能力，对互联网有初步了解。",
    equipmentConstraints: teachingNeed.equipmentCondition || "标准计算机教室，联网正常。",
    recommendedApproach: "采用情境导入 + 任务驱动的方式，从生活实例出发引出核心概念。",
    knowledgePointChain: ["生活情境 → 核心概念 → 原理探究 → 实践应用 → 总结提升"],
  };
}
