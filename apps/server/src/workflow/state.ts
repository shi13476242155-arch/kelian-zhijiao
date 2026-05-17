import { Annotation } from "@langchain/langgraph";
import type { ClassroomResourcePackage, CoreLiteracy, LayeredAssessment, LearningDiagnosisTemplate, LearningTaskSheet, LiteracyEvidence, TeachingNeed, TeachingProcedure, TpackAnalysis } from "@kelian-zhixue/shared";

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface NeedsAnalysis {
  keyConcepts: string[];
  studentReadiness: string;
  equipmentConstraints: string;
  recommendedApproach: string;
  knowledgePointChain: string[];
}

export interface CurriculumAlignment {
  matchedStandards: string[];
  teachingGuideReferences: string[];
  coreLiteracyMapping: Array<{ literacy: CoreLiteracy; targetDescription: string }>;
  tpackAnalysis: TpackAnalysis;
  learningObjectives: string[];
}

export interface ActivitiesOutput {
  teachingProcedures: TeachingProcedure[];
  questionChain: string[];
  learningTaskSheet: Pick<LearningTaskSheet, "taskGoal" | "scenarioIntroduction" | "taskSteps" | "learningSupports" | "groupRoles" | "recordTable" | "reflectionQuestions">;
  evaluationDesign: string[];
  blackboardDesign: string[];
  reflectionSuggestions: string[];
}

export interface AssessmentsOutput {
  layeredAssessment: LayeredAssessment;
  learningDiagnosisTemplate: LearningDiagnosisTemplate;
}

export interface ConfidenceOutput {
  literacyEvidenceChain: LiteracyEvidence[];
  dimensionScores: Record<string, number>;
  riskAlerts: string[];
  improvementSuggestions: string[];
  overallConfidence: number;
}

export const SmartPrepState = Annotation.Root({
  // --- Immutable inputs ---
  teachingNeed: Annotation<TeachingNeed>({
    default: () => ({}) as TeachingNeed,
    reducer: (_, update) => update,
  }),
  aiConfig: Annotation<AiConfig>({
    default: () => ({ apiKey: "", baseUrl: "", model: "" }),
    reducer: (_, update) => update,
  }),
  guideBasis: Annotation<unknown>({
    default: () => undefined,
    reducer: (_, update) => update,
  }),

  // --- Node outputs ---
  needsAnalysis: Annotation<NeedsAnalysis | undefined>({
    default: () => undefined,
    reducer: (_, update) => update,
  }),
  curriculumAlignment: Annotation<CurriculumAlignment | undefined>({
    default: () => undefined,
    reducer: (_, update) => update,
  }),
  activities: Annotation<ActivitiesOutput | undefined>({
    default: () => undefined,
    reducer: (_, update) => update,
  }),
  assessments: Annotation<AssessmentsOutput | undefined>({
    default: () => undefined,
    reducer: (_, update) => update,
  }),
  confidenceEvaluation: Annotation<ConfidenceOutput | undefined>({
    default: () => undefined,
    reducer: (_, update) => update,
  }),

  // --- Assembly output ---
  finalResource: Annotation<ClassroomResourcePackage | undefined>({
    default: () => undefined,
    reducer: (_, update) => update,
  }),

  // --- Progress tracking ---
  currentNode: Annotation<string>({
    default: () => "",
    reducer: (_, update) => update,
  }),
  currentDetail: Annotation<string>({
    default: () => "",
    reducer: (_, update) => update,
  }),
});
