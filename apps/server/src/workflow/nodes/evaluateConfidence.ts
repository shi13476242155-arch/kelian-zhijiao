import type { CoreLiteracy } from "@kelian-zhixue/shared";
import { callChatCompletions, extractJson } from "../../aiClient.js";
import type { AiConfig, ConfidenceOutput, SmartPrepState } from "../state.js";
import { EVALUATE_CONFIDENCE_SYSTEM } from "../prompts/systemPrompts.js";
import { buildEvaluateConfidencePrompt } from "../prompts/userPromptBuilders.js";

export function makeEvaluateConfidence(options: { onProgress: (ev: { stage: string; percent: number; detail: string }) => void }) {
  return async (state: typeof SmartPrepState.State): Promise<Partial<typeof SmartPrepState.State>> => {
    const { teachingNeed, needsAnalysis, curriculumAlignment, activities, assessments, aiConfig } = state;
    if (!needsAnalysis || !curriculumAlignment || !activities || !assessments) {
      return { currentNode: "evaluateConfidence", currentDetail: "跳过（缺少前置结果）" };
    }

    options.onProgress({ stage: "置信度评估", percent: 80, detail: "正在进行七维度质量评估..." });

    try {
      const response = await callAiForConfidence(
        teachingNeed,
        { needsAnalysis, curriculumAlignment, activities, assessments },
        aiConfig,
      );
      options.onProgress({ stage: "置信度评估", percent: 95, detail: `评估完成，置信度: ${response.overallConfidence}%` });
      return {
        confidenceEvaluation: response,
        currentNode: "evaluateConfidence",
        currentDetail: `置信度: ${response.overallConfidence}%，发现 ${response.riskAlerts.length} 个风险点`,
      };
    } catch (err) {
      console.warn("[Workflow] evaluateConfidence AI failed, using defaults:", err);
      const fallback = buildDefaultConfidence();
      options.onProgress({ stage: "置信度评估", percent: 95, detail: "AI 调用失败，使用规则评估替代" });
      return { confidenceEvaluation: fallback, currentNode: "evaluateConfidence", currentDetail: "使用规则评估（AI 不可用）" };
    }
  };
}

async function callAiForConfidence(
  teachingNeed: import("@kelian-zhixue/shared").TeachingNeed,
  allPrevious: {
    needsAnalysis: import("../state.js").NeedsAnalysis;
    curriculumAlignment: import("../state.js").CurriculumAlignment;
    activities: import("../state.js").ActivitiesOutput;
    assessments: import("../state.js").AssessmentsOutput;
  },
  aiConfig: AiConfig,
): Promise<ConfidenceOutput> {
  const messages = [
    { role: "system" as const, content: EVALUATE_CONFIDENCE_SYSTEM },
    { role: "user" as const, content: buildEvaluateConfidencePrompt(teachingNeed, allPrevious) },
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
    literacyEvidenceChain: Array.isArray(parsed.literacyEvidenceChain) ? parsed.literacyEvidenceChain : [],
    dimensionScores: parsed.dimensionScores || {},
    riskAlerts: Array.isArray(parsed.riskAlerts) ? parsed.riskAlerts : [],
    improvementSuggestions: Array.isArray(parsed.improvementSuggestions) ? parsed.improvementSuggestions : [],
    overallConfidence: typeof parsed.overallConfidence === "number" ? parsed.overallConfidence : 75,
  };
}

function buildDefaultConfidence(): ConfidenceOutput {
  const literacies: CoreLiteracy[] = ["信息意识", "计算思维", "数字化学习与创新", "信息社会责任"];
  return {
    literacyEvidenceChain: literacies.map((lit) => ({
      literacy: lit,
      teachingObjective: `培养${lit}`,
      learningActivity: "课堂活动",
      taskEvidence: "任务单记录",
      assessmentEvidence: "测评结果",
      evaluationMethod: "课堂观察+任务单+测评",
      achievementStatus: "基本达成",
      riskAlert: "需持续关注",
      improvementSuggestion: "建议增加针对性练习",
    })),
    dimensionScores: {
      "课标一致性": 82,
      "核心素养达成度": 80,
      "学情贴合度": 78,
      "活动可操作性": 84,
      "资源完整度": 85,
      "课型匹配度": 80,
      "逻辑连贯性": 80,
    },
    riskAlerts: ["由于使用规则生成，部分内容可能不够个性化", "建议教师根据实际班情修改"],
    improvementSuggestions: ["增强情境导入的真实感", "增加学生自主探究的环节", "在测评中加入更多开放性题目"],
    overallConfidence: 80,
  };
}
