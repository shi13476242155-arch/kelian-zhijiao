import { StateGraph, START, END } from "@langchain/langgraph";
import type { ClassroomResourcePackage, TeachingNeed } from "@kelian-zhixue/shared";
import { getFlowSummary } from "@kelian-zhixue/shared";
import { SmartPrepState } from "./state.js";
import { makeAnalyzeNeeds } from "./nodes/analyzeNeeds.js";
import { makeAlignCurriculum } from "./nodes/alignCurriculum.js";
import { makeGenerateActivities } from "./nodes/generateActivities.js";
import { makeGenerateAssessments } from "./nodes/generateAssessments.js";
import { makeEvaluateConfidence } from "./nodes/evaluateConfidence.js";

export function buildSmartPrepGraph(options: {
  onProgress: (ev: { stage: string; percent: number; detail: string }) => void;
}) {
  const graph = new StateGraph(SmartPrepState)
    .addNode("analyzeNeeds", makeAnalyzeNeeds(options))
    .addNode("alignCurriculum", makeAlignCurriculum(options))
    .addNode("generateActivities", makeGenerateActivities(options))
    .addNode("generateAssessments", makeGenerateAssessments(options))
    .addNode("evaluateConfidence", makeEvaluateConfidence(options))
    .addNode("assembleResource", makeAssembleResource(options))
    .addEdge(START, "analyzeNeeds")
    .addEdge("analyzeNeeds", "alignCurriculum")
    .addEdge("alignCurriculum", "generateActivities")
    .addEdge("generateActivities", "generateAssessments")
    .addEdge("generateAssessments", "evaluateConfidence")
    .addEdge("evaluateConfidence", "assembleResource")
    .addEdge("assembleResource", END);

  return graph.compile();
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

function makeAssembleResource(options: { onProgress: (ev: { stage: string; percent: number; detail: string }) => void }) {
  return (state: typeof SmartPrepState.State): Partial<typeof SmartPrepState.State> => {
    const { teachingNeed, needsAnalysis, curriculumAlignment, activities, assessments, confidenceEvaluation } = state;

    options.onProgress({ stage: "组装资源", percent: 98, detail: "正在拼装完整课堂资源包..." });

    if (!teachingNeed?.topicName) {
      return { currentNode: "assembleResource", currentDetail: "缺少课题信息，无法组装" };
    }

    const resource: ClassroomResourcePackage = {
      id: `resource-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      teachingNeed: teachingNeed as TeachingNeed,
      curriculumBasis: {
        standards: curriculumAlignment?.matchedStandards ?? [],
        teachingGuides: curriculumAlignment?.teachingGuideReferences ?? [],
        coreLiteracy: curriculumAlignment?.coreLiteracyMapping?.map((m: { literacy: string }) => m.literacy as import("@kelian-zhixue/shared").CoreLiteracy) ?? [],
      },
      tpackAnalysis: curriculumAlignment?.tpackAnalysis ?? {
        ck: "", pk: "", tk: "", pck: "", tck: "", tpk: "", tpack: "",
      },
      literacyEvidenceChain: confidenceEvaluation?.literacyEvidenceChain ?? [],
      teachingDesign: {
        basicInfo: {
          topicName: teachingNeed.topicName,
          grade: teachingNeed.grade,
          courseModule: teachingNeed.courseModule,
          classHours: teachingNeed.classHours,
          lessonType: teachingNeed.lessonType,
        },
        curriculumAnalysis: curriculumAlignment?.matchedStandards ?? [],
        learningAnalysis: needsAnalysis?.studentReadiness ?? "",
        teachingAnalysis: [
          `内容分析：本课围绕"${teachingNeed.topicName}"展开，${needsAnalysis?.keyConcepts?.join("、") || "核心概念"}构成知识主线，${(curriculumAlignment?.matchedStandards || []).slice(0, 1).join("；")}。`,
          `课型分析：本课为${String(teachingNeed.lessonType || "新知建构课")}，教学流程按 ${getFlowSummary(String(teachingNeed.lessonType))} 展开，体现${String(teachingNeed.lessonType || "新知建构课")}的教学特征。`,
          `学情分析：${needsAnalysis?.studentReadiness || teachingNeed.studentFoundation || "学生具备基本的信息技术操作能力，需要通过真实情境和结构化任务建立深层理解。"}`,
          `课标依据：${(curriculumAlignment?.matchedStandards || []).slice(0, 3).join("；") || "依据《义务教育信息科技课程标准（2022 年版）》相关条目。"}`,
          `个性化要求：${teachingNeed.additionalNeeds || "按常规信息科技课堂组织，注重学生的真实体验和思维发展。"}`,
        ],
        teachingMethods: needsAnalysis?.recommendedApproach ? [needsAnalysis.recommendedApproach] : [],
        teachingObjectives: curriculumAlignment?.learningObjectives ?? [],
        keyAndDifficultPoints: {
          focus: curriculumAlignment?.coreLiteracyMapping?.map((m: { literacy: string; targetDescription: string }) => `${m.literacy}：${m.targetDescription}`).join("；") ?? "",
          difficulty: needsAnalysis?.equipmentConstraints ?? "",
        },
        resourcesAndEnvironment: needsAnalysis?.equipmentConstraints ? [needsAnalysis.equipmentConstraints] : [],
        procedures: (activities?.teachingProcedures ?? []).map((p, i) => ({
          phase: p.phase || `环节${i + 1}`,
          duration: normalizeDuration(p.duration),
          keyQuestion: p.keyQuestion || `${p.phase || "本环节"}的核心问题是什么？`,
          teacherActivity: p.teacherActivity || `教师组织${p.phase || "教学"}活动，提供材料、示例和追问，引导学生思考并记录。`,
          studentActivity: p.studentActivity || `学生完成${p.phase || "学习"}任务，在任务单中记录发现、步骤和证据。`,
          designIntent: p.designIntent || `通过${p.phase || "本环节"}推进课堂进程，帮助学生建构理解。`,
        })),
        questionChain: activities?.questionChain ?? [],
        evaluationDesign: activities?.evaluationDesign ?? [],
        blackboardDesign: activities?.blackboardDesign ?? [],
        reflectionSuggestions: activities?.reflectionSuggestions ?? [],
      },
      learningTaskSheet: activities?.learningTaskSheet ?? {
        taskGoal: [],
        scenarioIntroduction: "",
        taskSteps: [],
        learningSupports: [],
        groupRoles: [],
        recordTable: [],
        reflectionQuestions: [],
      },
      layeredAssessment: assessments?.layeredAssessment ?? {
        basicUnderstanding: [],
        principleExplanation: [],
        scenarioTransfer: [],
        creativeExpression: [],
      },
      learningDiagnosisTemplate: assessments?.learningDiagnosisTemplate ?? {
        evaluationDimensions: [],
        dataSources: [],
        dataTracking: [],
        dataFormat: [],
        diagnosisRules: [],
        outputResults: [],
      },
    };

    options.onProgress({ stage: "组装资源", percent: 100, detail: "课堂资源包组装完成" });

    return {
      currentNode: "assembleResource",
      currentDetail: "资源包组装完成",
      finalResource: resource,
    };
  };
}
