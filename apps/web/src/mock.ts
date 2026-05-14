import type { LessonPackage } from "@kelian-zhixue/shared";

export const sampleLesson: LessonPackage = {
  id: "sample-data-thinking-001",
  title: "用流程图表达生活中的算法",
  grade: "七年级",
  duration: "1课时",
  subject: "初中信息科技",
  positioning: "帮助教师将教学需求转化为符合课标、指向核心素养、贴合学情、可编辑、可评估、可导出的课堂资源包。",
  learningSituation: "学生熟悉生活流程，但对算法的确定性、顺序结构和流程图表达还缺少系统认识。",
  objectives: ["描述关键步骤", "绘制顺序结构流程图", "依据证据优化表达"],
  activities: [
    {
      id: "act-1",
      title: "情境导入",
      durationMinutes: 8,
      teacherPrompt: "从校园借书流程切入，追问步骤顺序是否可调整。",
      studentTask: "用三句话描述借书过程。",
      evidence: "学生能说出关键步骤和顺序理由。",
      literacy: ["信息意识", "计算思维"]
    },
    {
      id: "act-2",
      title: "任务探究",
      durationMinutes: 22,
      teacherPrompt: "提供流程图符号支架，强调开始、处理、判断和结束。",
      studentTask: "小组合作绘制借书流程图。",
      evidence: "流程图结构完整、顺序清晰。",
      literacy: ["计算思维", "数字化学习与创新"]
    },
    {
      id: "act-3",
      title: "展示评价",
      durationMinutes: 10,
      teacherPrompt: "组织同伴互评，聚焦完整性、准确性和规范性。",
      studentTask: "根据评价表修改流程图。",
      evidence: "学生能基于反馈完成有效修改。",
      literacy: ["数字化学习与创新", "信息社会责任"]
    }
  ],
  assessments: [
    {
      id: "assess-1",
      dimension: "流程表达准确性",
      evidence: "流程图步骤、顺序和符号",
      levelDescriptions: ["需支持", "基本达成", "表现突出"]
    }
  ],
  exportFormats: ["JSON", "HTML", "Word"]
};

export const navigationItems = [
  "工作台首页",
  "新建课例",
  "AI生成中心",
  "资源编辑",
  "素养证据链",
  "置信度评估",
  "资源导出",
  "学情分析",
  "案例库"
];
