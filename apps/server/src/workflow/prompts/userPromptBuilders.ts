import type { TeachingNeed } from "@kelian-zhixue/shared";
import type { ActivitiesOutput, AssessmentsOutput, CurriculumAlignment, NeedsAnalysis } from "../state.js";

export function buildNeedsAnalysisPrompt(teachingNeed: TeachingNeed) {
  return [
    "请分析以下课例信息，输出教学需求分析结果。",
    "",
    `课题：${teachingNeed.topicName}`,
    `年级：${String(teachingNeed.grade)}`,
    `模块：${String(teachingNeed.courseModule)}`,
    `课型：${String(teachingNeed.lessonType || "新知建构课")}`,
    `课时：${String(teachingNeed.classHours || "1")}`,
    `设备条件：${String(teachingNeed.equipmentCondition || "标准机房")}`,
    `学生基础：${String(teachingNeed.studentFoundation || "具备基本的信息技术操作能力")}`,
    `教师补充要求：${String(teachingNeed.additionalNeeds || "")}`,
    "",
    "请输出 JSON。",
  ].join("\n");
}

export function buildAlignCurriculumPrompt(
  teachingNeed: TeachingNeed,
  needsAnalysis: NeedsAnalysis,
  guideBasis?: unknown,
) {
  const guideLines = guideBasis ? buildGuideLines(guideBasis) : "";
  return [
    "请根据以下信息进行课标对齐分析。",
    "",
    `课题：${teachingNeed.topicName}`,
    `年级：${String(teachingNeed.grade)}`,
    `模块：${String(teachingNeed.courseModule)}`,
    `课型：${String(teachingNeed.lessonType || "新知建构课")}`,
    "",
    "## 需求分析结果（来自上一环节）",
    `核心知识点：${needsAnalysis.keyConcepts.join("、")}`,
    `知识点关系链：${needsAnalysis.knowledgePointChain.join(" → ")}`,
    `学生基础：${needsAnalysis.studentReadiness}`,
    `推荐策略：${needsAnalysis.recommendedApproach}`,
    "",
    guideLines,
    "",
    "请输出 JSON。",
  ].join("\n");
}

export function buildGenerateActivitiesPrompt(
  teachingNeed: TeachingNeed,
  needsAnalysis: NeedsAnalysis,
  curriculumAlignment: CurriculumAlignment,
) {
  const lessonType = String(teachingNeed.lessonType || "新知建构课");
  return [
    `请根据以下信息，为《${teachingNeed.topicName}》生成完整的课堂活动设计。`,
    "",
    "## 本课基本信息",
    `课题：${teachingNeed.topicName}`,
    `年级：${String(teachingNeed.grade)}`,
    `模块：${String(teachingNeed.courseModule)}`,
    `课型：${lessonType}`,
    `课时：${String(teachingNeed.classHours || "1")}`,
    "",
    "## 需求分析结果",
    `核心知识点：${needsAnalysis.keyConcepts.join("、")}`,
    `知识链：${needsAnalysis.knowledgePointChain.join(" → ")}`,
    `学生基础：${needsAnalysis.studentReadiness}`,
    `设备条件：${needsAnalysis.equipmentConstraints}`,
    `教学策略建议：${needsAnalysis.recommendedApproach}`,
    "",
    "## 课标对齐结果",
    `教学目标：${curriculumAlignment.learningObjectives.join("；")}`,
    `匹配课标：${curriculumAlignment.matchedStandards.slice(0, 3).join("；")}`,
    `核心素养映射：${curriculumAlignment.coreLiteracyMapping.map((m) => `${m.literacy}(${m.targetDescription})`).join("；")}`,
    "",
    "## TPACK 分析参考",
    `CK(内容知识)：${curriculumAlignment.tpackAnalysis.ck}`,
    `PK(教学法知识)：${curriculumAlignment.tpackAnalysis.pk}`,
    `TK(技术知识)：${curriculumAlignment.tpackAnalysis.tk}`,
    `TPACK(整合知识)：${curriculumAlignment.tpackAnalysis.tpack}`,
    "",
    "请输出 JSON，包含完整的 teachingProcedures、questionChain、learningTaskSheet、evaluationDesign、blackboardDesign、reflectionSuggestions。",
  ].join("\n");
}

export function buildGenerateAssessmentsPrompt(
  teachingNeed: TeachingNeed,
  curriculumAlignment: CurriculumAlignment,
  activities: ActivitiesOutput,
) {
  const allProcedures = activities.teachingProcedures
    .map((p) => `【${p.phase}(${p.duration})】教师：${p.teacherActivity.slice(0, 100)}… 学生：${p.studentActivity.slice(0, 100)}…`)
    .join("\n");

  return [
    `请根据以下信息，为《${teachingNeed.topicName}》生成分层测评题和学情诊断表。`,
    "",
    `课题：${teachingNeed.topicName}`,
    `年级：${String(teachingNeed.grade)}`,
    "",
    "## 教学目标（必须覆盖）",
    ...curriculumAlignment.learningObjectives.map((obj, i) => `目标${i + 1}：${obj}`),
    "",
    "## 主要素养维度",
    ...curriculumAlignment.coreLiteracyMapping.map((m) => `${m.literacy}：${m.targetDescription}`),
    "",
    "## 教学环节概览",
    allProcedures,
    "",
    "## 任务单任务列表",
    ...activities.learningTaskSheet.taskSteps.map((s, i) => `任务${i + 1}：${s}`),
    "",
    "请输出 JSON，包含 layeredAssessment 和 learningDiagnosisTemplate。",
    "所有测评题标注参考答案或评分要点。",
  ].join("\n");
}

export function buildEvaluateConfidencePrompt(
  teachingNeed: TeachingNeed,
  allPreviousOutputs: {
    needsAnalysis: NeedsAnalysis;
    curriculumAlignment: CurriculumAlignment;
    activities: ActivitiesOutput;
    assessments: AssessmentsOutput;
  },
) {
  return [
    `请对《${teachingNeed.topicName}》的完整课堂资源包进行置信度评估。`,
    "",
    `课型：${String(teachingNeed.lessonType || "新知建构课")}`,
    `年级：${String(teachingNeed.grade)}`,
    "",
    "## 已生成的教学设计",
    `教学环节共 ${allPreviousOutputs.activities.teachingProcedures.length} 个：`,
    ...allPreviousOutputs.activities.teachingProcedures.map((p) => `- ${p.phase}(${p.duration})：教师「${p.teacherActivity.slice(0, 80)}…」学生「${p.studentActivity.slice(0, 80)}…」`),
    "",
    "## 已生成的任务单",
    `目标：${allPreviousOutputs.activities.learningTaskSheet.taskGoal.join("；")}`,
    `任务步骤数：${allPreviousOutputs.activities.learningTaskSheet.taskSteps.length}`,
    "",
    "## 已生成的测评题",
    `基础理解：${allPreviousOutputs.assessments.layeredAssessment.basicUnderstanding.length} 题`,
    `原理阐述：${allPreviousOutputs.assessments.layeredAssessment.principleExplanation.length} 题`,
    `情境迁移：${allPreviousOutputs.assessments.layeredAssessment.scenarioTransfer.length} 题`,
    `创意表达：${allPreviousOutputs.assessments.layeredAssessment.creativeExpression.length} 题`,
    "",
    "## 已生成的诊断表",
    `评价维度：${allPreviousOutputs.assessments.learningDiagnosisTemplate.evaluationDimensions.join("、")}`,
    `诊断规则：${allPreviousOutputs.assessments.learningDiagnosisTemplate.diagnosisRules.join("；")}`,
    "",
    "请从七个维度对以上内容进行置信度评估，并为四个核心素养生成完整的证据链。输出 JSON。",
  ].join("\n");
}

function buildGuideLines(guideBasis: unknown): string {
  const gb = guideBasis as Record<string, unknown>;
  if (!gb) return "";
  const lines: string[] = ["## 教学指南依据"];
  if (Array.isArray(gb.guideObjectives) && gb.guideObjectives.length > 0) {
    lines.push(`教学目标建议：${gb.guideObjectives.join("；")}`);
  }
  if (Array.isArray(gb.guideFocus) && gb.guideFocus.length > 0) {
    lines.push(`教学重点建议：${gb.guideFocus.join("；")}`);
  }
  if (Array.isArray(gb.guideDifficulty) && gb.guideDifficulty.length > 0) {
    lines.push(`教学难点建议：${gb.guideDifficulty.join("；")}`);
  }
  if (Array.isArray(gb.suggestedActivities) && gb.suggestedActivities.length > 0) {
    lines.push(`建议课堂活动：${gb.suggestedActivities.join("；")}`);
  }
  return lines.join("\n");
}
