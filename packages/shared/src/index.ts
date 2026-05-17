/** 五种课型 → 六环节教学流程映射（依据 2022 版课标教学指南） */
export const PROCEDURE_NAMES_MAP: Record<string, string[]> = {
  新知建构课: ["真实情境", "问题分解", "原理探究", "模型建构", "体系建构", "迁移应用"],
  项目实践课: ["问题驱动", "需求分析", "方案设计", "迭代优化", "成果展示", "反思评价"],
  实验探究课: ["问题驱动", "猜想假设", "实验设计", "解释论证", "评估交流", "迁移拓展"],
  技能应用课: ["任务驱动", "范例解析", "模仿操作", "变式练习", "技能整合", "综合创新"],
  跨学科主题课: ["真实问题", "跨科探究", "方案设计", "作品创作", "展示评价", "拓展反思"],
};

export function getProcedureNamesByType(lessonType: string): string[] {
  return PROCEDURE_NAMES_MAP[lessonType] ?? PROCEDURE_NAMES_MAP.新知建构课;
}

export function getFlowSummary(lessonType: string): string {
  return getProcedureNamesByType(lessonType).join(" → ");
}

export type CoreLiteracy =
  | "信息意识"
  | "计算思维"
  | "数字化学习与创新"
  | "信息社会责任";

export type Grade = "七年级" | "八年级" | "九年级";

export type LessonType = "新知建构课" | "项目实践课" | "实验探究课" | "技能应用课" | "跨学科主题课";

export type GenerationScope = "只生成教学设计" | "生成完整课堂资源包";

export interface TeachingNeed {
  topicName: string;
  grade: Grade;
  courseModule: string;
  classHours: string;
  studentFoundation: string;
  equipmentCondition: string;
  teachingObjectives: string;
  teachingFocus: string;
  teachingDifficulty: string;
  lessonType: LessonType;
  generationScope: GenerationScope;
  additionalNeeds: string;
  updatedAt: string;
}

export interface CurriculumBasis {
  standards: string[];
  teachingGuides: string[];
  coreLiteracy: CoreLiteracy[];
}

export interface TpackAnalysis {
  ck: string;
  pk: string;
  tk: string;
  pck: string;
  tck: string;
  tpk: string;
  tpack: string;
}

export interface LiteracyEvidence {
  literacy: CoreLiteracy;
  teachingObjective: string;
  learningActivity: string;
  taskEvidence: string;
  assessmentEvidence: string;
  evaluationMethod: string;
  achievementStatus: string;
  riskAlert: string;
  improvementSuggestion: string;
}

export interface TeachingProcedure {
  phase: string;
  duration: string;
  keyQuestion: string;
  teacherActivity: string;
  studentActivity: string;
  designIntent: string;
}

export interface TeachingDesign {
  basicInfo: {
    topicName: string;
    grade: Grade;
    courseModule: string;
    classHours: string;
    lessonType: LessonType;
  };
  curriculumAnalysis: string[];
  learningAnalysis: string;
  teachingAnalysis: string[];
  teachingMethods: string[];
  teachingObjectives: string[];
  keyAndDifficultPoints: {
    focus: string;
    difficulty: string;
  };
  resourcesAndEnvironment: string[];
  procedures: TeachingProcedure[];
  questionChain: string[];
  evaluationDesign: string[];
  blackboardDesign: string[];
  reflectionSuggestions: string[];
}

export interface LearningTaskSheet {
  taskGoal: string[];
  scenarioIntroduction: string;
  taskSteps: string[];
  learningSupports: string[];
  groupRoles: string[];
  recordTable: Array<Record<string, string>>;
  reflectionQuestions: string[];
}

export interface LayeredAssessment {
  basicUnderstanding: string[];
  principleExplanation: string[];
  scenarioTransfer: string[];
  creativeExpression: string[];
}

export interface LearningDiagnosisTemplate {
  evaluationDimensions: string[];
  dataSources: string[];
  dataTracking: string[];
  dataFormat: Array<Record<string, string>>;
  diagnosisRules: string[];
  outputResults: string[];
}

export interface ClassroomResourcePackage {
  id: string;
  generatedAt: string;
  teachingNeed: TeachingNeed;
  curriculumBasis: CurriculumBasis;
  tpackAnalysis: TpackAnalysis;
  literacyEvidenceChain: LiteracyEvidence[];
  teachingDesign: TeachingDesign;
  learningTaskSheet: LearningTaskSheet;
  layeredAssessment: LayeredAssessment;
  learningDiagnosisTemplate: LearningDiagnosisTemplate;
}

export interface LearningActivity {
  id: string;
  title: string;
  durationMinutes: number;
  teacherPrompt: string;
  studentTask: string;
  evidence: string;
  literacy: CoreLiteracy[];
}

export interface AssessmentItem {
  id: string;
  dimension: string;
  evidence: string;
  levelDescriptions: string[];
}

export interface LessonPackage {
  id: string;
  title: string;
  grade: string;
  module?: string;
  duration: string;
  subject: "初中信息科技";
  positioning: string;
  learningSituation: string;
  objectives: string[];
  activities: LearningActivity[];
  assessments: AssessmentItem[];
  exportFormats: Array<"JSON" | "HTML" | "Word">;
}

export interface AppInfo {
  name: string;
  version: string;
  stage: string;
  description: string;
  features: string[];
}

// SSE workflow event types
export interface WorkflowProgressEvent {
  stage: string;
  percent: number;
  detail: string;
  nodeId: string;
}

export interface WorkflowResultEvent {
  resource: ClassroomResourcePackage;
  confidence?: number;
  riskAlerts?: string[];
}

export interface WorkflowErrorEvent {
  error: string;
  detail?: string;
}
