import type { ClassroomResourcePackage, TeachingNeed } from "@kelian-zhixue/shared";
import { callChatCompletions, extractJson, resolveAiConfig } from "../aiClient.js";

/**
 * Layer 2 fallback: calls the original single-shot generate-resource endpoint logic inline.
 * Used when the LangGraph workflow fails at the graph level.
 */
export async function generateViaSingleCall(
  teachingNeed: TeachingNeed,
  aiConfigInput: unknown,
  fallbackResource?: ClassroomResourcePackage,
  guideBasis?: unknown,
): Promise<ClassroomResourcePackage | null> {
  const { apiKey, baseUrl, model } = resolveAiConfig(aiConfigInput);
  if (!apiKey) return null;

  try {
    let response = await callChatCompletions({
      apiKey,
      baseUrl,
      jsonMode: true,
      messages: buildFallbackMessages(teachingNeed, fallbackResource, guideBasis),
      model,
      temperature: 0.2,
    });

    if (!response.ok && [400, 404, 422].includes(response.status)) {
      response = await callChatCompletions({
        apiKey,
        baseUrl,
        jsonMode: false,
        messages: buildFallbackMessages(teachingNeed, fallbackResource, guideBasis),
        model,
        temperature: 0.2,
      });
    }

    if (!response.ok) return null;

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    const resource = JSON.parse(extractJson(content)) as ClassroomResourcePackage;

    if (!resource.teachingNeed || !resource.teachingDesign || !resource.learningTaskSheet) {
      return null;
    }

    return resource;
  } catch {
    return null;
  }
}

function buildFallbackMessages(
  teachingNeed: TeachingNeed,
  fallbackResource?: ClassroomResourcePackage,
  guideBasis?: unknown,
) {
  // Reuse the same system prompt pattern as the original endpoint
  const systemPrompt = [
    "你是拥有 20 年教龄的初中信息科技教研员，同时每周上 12 节课。",
    "你严格依据《义务教育信息科技课程标准（2022 年版）》设计每一节课。",
    "请根据用户提供的课例信息，生成一份完整的初中信息科技课堂资源包 JSON。",
    "输出严格 JSON，字段包括：teachingNeed, curriculumBasis, tpackAnalysis, literacyEvidenceChain, teachingDesign, learningTaskSheet, layeredAssessment, learningDiagnosisTemplate。",
  ].join("\n");

  const guideLines = guideBasis ? buildGuideLinesFallback(guideBasis) : "";

  const userPrompt = [
    `请生成《${teachingNeed.topicName}》的完整课堂资源包 JSON。`,
    `年级：${String(teachingNeed.grade)}，模块：${String(teachingNeed.courseModule)}，课型：${String(teachingNeed.lessonType || "新知建构课")}`,
    guideLines,
    fallbackResource ? `参考结构：${JSON.stringify(fallbackResource).slice(0, 2000)}` : "",
  ].join("\n");

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
}

function buildGuideLinesFallback(guideBasis: unknown): string {
  const gb = guideBasis as Record<string, unknown>;
  if (!gb) return "";
  const lines: string[] = [];
  if (Array.isArray(gb.guideObjectives) && gb.guideObjectives.length > 0) {
    lines.push(`教学目标建议：${gb.guideObjectives.join("；")}`);
  }
  if (Array.isArray(gb.guideFocus) && gb.guideFocus.length > 0) {
    lines.push(`教学重点建议：${gb.guideFocus.join("；")}`);
  }
  return lines.join("\n");
}
