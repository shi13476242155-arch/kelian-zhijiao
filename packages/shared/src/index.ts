export type CoreLiteracy =
  | "信息意识"
  | "计算思维"
  | "数字化学习与创新"
  | "信息社会责任";

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
