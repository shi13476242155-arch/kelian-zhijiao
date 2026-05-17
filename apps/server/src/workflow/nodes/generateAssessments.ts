import type { TeachingNeed } from "@kelian-zhixue/shared";
import { callChatCompletions, extractJson } from "../../aiClient.js";
import type { ActivitiesOutput, AiConfig, AssessmentsOutput, CurriculumAlignment, SmartPrepState } from "../state.js";
import { GENERATE_ASSESSMENTS_SYSTEM } from "../prompts/systemPrompts.js";
import { buildGenerateAssessmentsPrompt } from "../prompts/userPromptBuilders.js";

export function makeGenerateAssessments(options: { onProgress: (ev: { stage: string; percent: number; detail: string }) => void }) {
  return async (state: typeof SmartPrepState.State): Promise<Partial<typeof SmartPrepState.State>> => {
    const { teachingNeed, curriculumAlignment, activities, aiConfig } = state;
    if (!curriculumAlignment || !activities) {
      return { currentNode: "generateAssessments", currentDetail: "跳过（缺少前置结果）" };
    }

    options.onProgress({ stage: "评价生成", percent: 62, detail: "正在生成分层测评题..." });

    try {
      const response = await callAiForAssessments(teachingNeed, curriculumAlignment, activities, aiConfig);
      const totalQuestions =
        response.layeredAssessment.basicUnderstanding.length +
        response.layeredAssessment.principleExplanation.length +
        response.layeredAssessment.scenarioTransfer.length +
        response.layeredAssessment.creativeExpression.length;
      options.onProgress({ stage: "评价生成", percent: 78, detail: `已生成 ${totalQuestions} 道分层测评题和学情诊断表` });
      return { assessments: response, currentNode: "generateAssessments", currentDetail: `已生成 ${totalQuestions} 道测评题` };
    } catch (err) {
      console.warn("[Workflow] generateAssessments AI failed, using defaults:", err);
      const fallback = buildDefaultAssessments(teachingNeed);
      options.onProgress({ stage: "评价生成", percent: 78, detail: "AI 调用失败，使用规则生成替代" });
      return { assessments: fallback, currentNode: "generateAssessments", currentDetail: "使用规则生成（AI 不可用）" };
    }
  };
}

async function callAiForAssessments(
  teachingNeed: TeachingNeed,
  curriculumAlignment: CurriculumAlignment,
  activities: ActivitiesOutput,
  aiConfig: AiConfig,
): Promise<AssessmentsOutput> {
  const messages = [
    { role: "system" as const, content: GENERATE_ASSESSMENTS_SYSTEM },
    { role: "user" as const, content: buildGenerateAssessmentsPrompt(teachingNeed, curriculumAlignment, activities) },
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

  // 安全转为字符串数组，防止 AI 返回对象导致前端渲染崩溃
  const toStringArray = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => (typeof item === "string" ? item : String(item)));
  };

  return {
    layeredAssessment: {
      basicUnderstanding: toStringArray(parsed.layeredAssessment?.basicUnderstanding),
      principleExplanation: toStringArray(parsed.layeredAssessment?.principleExplanation),
      scenarioTransfer: toStringArray(parsed.layeredAssessment?.scenarioTransfer),
      creativeExpression: toStringArray(parsed.layeredAssessment?.creativeExpression),
    },
    learningDiagnosisTemplate: {
      evaluationDimensions: toStringArray(parsed.learningDiagnosisTemplate?.evaluationDimensions),
      dataSources: toStringArray(parsed.learningDiagnosisTemplate?.dataSources),
      dataTracking: toStringArray(parsed.learningDiagnosisTemplate?.dataTracking),
      dataFormat: Array.isArray(parsed.learningDiagnosisTemplate?.dataFormat) ? parsed.learningDiagnosisTemplate.dataFormat : [],
      diagnosisRules: toStringArray(parsed.learningDiagnosisTemplate?.diagnosisRules),
      outputResults: toStringArray(parsed.learningDiagnosisTemplate?.outputResults),
    },
  };
}

function buildDefaultAssessments(teachingNeed: TeachingNeed): AssessmentsOutput {
  const topic = teachingNeed.topicName;
  return {
    layeredAssessment: {
      basicUnderstanding: [
        `单选题1：下列关于"${topic}"的描述，正确的是哪一项？\nA. ${topic}只涉及技术操作层面\nB. ${topic}的核心是理解其基本原理和过程\nC. ${topic}与实际数字生活没有关联\nD. ${topic}不需要遵循任何规范\n参考答案：B`,
        `单选题2：学习"${topic}"时，以下哪种做法最能体现计算思维？\nA. 直接记住结论\nB. 把问题拆分为清晰的步骤并表达过程\nC. 背诵课文定义\nD. 只关注最终结果\n参考答案：B`,
      ],
      principleExplanation: [
        `判断题1：学习"${topic}"时，只要记住操作步骤就够了，不需要理解为什么。\n参考答案：错`,
        `判断题2："${topic}"涉及信息处理和分析的过程，需要关注输入、处理和输出。\n参考答案：对`,
      ],
      scenarioTransfer: [
        `简答题1：请用"先……接着……然后……最后……"的句式，描述"${topic}"中的关键过程，并指出一个最容易出错的环节。\n评分要点：步骤表述清晰得2分；能指出易错环节得1分；语言完整得1分。`,
        `简答题2：请举一个校园或家庭生活中的例子，说明"${topic}"的方法可以怎样帮助你解决实际问题。\n评分要点：举例恰当得2分；能说明方法迁移得1分；表达清晰得1分。`,
      ],
      creativeExpression: [
        `分析题1（选做）：如果把"${topic}"迁移到一个全新的数字生活场景，你会如何设计一个学习任务？请写清场景、步骤和可能的学习证据。\n评价维度：场景真实合理(3分)、步骤清晰可操作(3分)、学习证据明确(2分)、有安全或责任意识(2分)。`,
      ],
    },
    learningDiagnosisTemplate: {
      evaluationDimensions: ["概念理解", "过程表达", "应用迁移", "责任意识", "协作参与"],
      dataSources: ["任务单文字记录", "测评题答案", "课堂展示表现", "同伴互评记录"],
      dataTracking: ["任务单中核心概念记录的完整度", "测评题各层级的得分分布", "课堂展示中的表达质量"],
      dataFormat: [{ "维度": "概念理解", "数据来源": "测评题基础理解部分和任务单", "收集方式": "自动评分+教师标注" }],
      diagnosisRules: [
        "任务单中概念关系图空白的同学，需要在课后补充完成",
        "测评题基础理解部分正确率低于60%的同学，需要课后个别辅导",
        "情境迁移题回答字数少于30字的同学，需要额外提供表达支架",
      ],
      outputResults: ["个人学习报告", "班级整体分析", "分层教学建议"],
    },
  };
}
