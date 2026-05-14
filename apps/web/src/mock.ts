import type { LessonPackage } from "@kelian-zhixue/shared";

export interface WorkspacePage {
  id: string;
  navLabel: string;
  title: string;
  subtitle: string;
}

export interface RecentLesson {
  title: string;
  grade: string;
  updatedAt: string;
}

export const workspacePages: WorkspacePage[] = [
  {
    id: "home",
    navLabel: "工作台首页",
    title: "课链智学教师工作台",
    subtitle: "把一节信息科技课，整理成可上课、可修改、可导出的课堂资源包。"
  },
  {
    id: "new-lesson",
    navLabel: "新建课例",
    title: "新建课例",
    subtitle: "填写课题、年级、学情和设备条件，作为智能生成课堂资源的起点。"
  },
  {
    id: "prep-workbench",
    navLabel: "备课工作台",
    title: "备课工作台",
    subtitle: "生成课堂资源包，修订教学内容，并确认最终可用的上课材料。"
  },
  {
    id: "literacy",
    navLabel: "素养证据链",
    title: "素养证据链",
    subtitle: "查看核心素养、教学目标、学习活动、任务证据、测评证据与评价方式之间的对应关系。"
  },
  {
    id: "quality",
    navLabel: "质量评估",
    title: "质量评估",
    subtitle: "从课标一致性、学情适配度、活动可操作性和资源完整度等方面检查资源质量。"
  },
  {
    id: "export",
    navLabel: "资源导出",
    title: "资源导出",
    subtitle: "导出 Word 教学文档、HTML 课堂页和 JSON 资源包。"
  },
  {
    id: "learning-profile",
    navLabel: "学情分析",
    title: "学情分析",
    subtitle: "导入学生学习数据，生成班级学情分析和教学改进建议。"
  },
  {
    id: "cases",
    navLabel: "精品案例",
    title: "精品案例",
    subtitle: "查看适合展示和借鉴的初中信息科技精品样例课例。"
  }
];

export const recentLesson: RecentLesson = {
  title: "人工智能初步",
  grade: "八年级",
  updatedAt: "10:24"
};

export const sampleLesson: LessonPackage = {
  id: "sample-network-package-001",
  title: "数据分包灵活传",
  grade: "七年级",
  module: "互联网应用与创新",
  duration: "1课时",
  subject: "初中信息科技",
  positioning: "把数据传输原理转化为可上课、可修改、可导出的课堂资源包。",
  learningSituation: "学生熟悉上网和视频播放，但不了解数据是如何传输的。",
  objectives: [
    "能用生活类比解释数据分包传输的基本过程。",
    "能描述数据拆分、编号、传输和重组的关系。",
    "能讨论网络服务中的隐私保护问题。"
  ],
  activities: [
    {
      id: "act-1",
      title: "生活类比",
      durationMinutes: 8,
      teacherPrompt: "用快递分包情境引导学生理解大文件为什么要拆分传输。",
      studentTask: "说出快递分包中需要编号和核对的原因。",
      evidence: "学生能说出拆分、编号和重组的基本关系。",
      literacy: ["信息意识", "计算思维"]
    },
    {
      id: "act-2",
      title: "过程建模",
      durationMinutes: 22,
      teacherPrompt: "组织学生把数据包传输过程画成步骤图。",
      studentTask: "小组完成数据拆分、传输、重组过程图。",
      evidence: "过程图能体现数据包编号、到达顺序和重组结果。",
      literacy: ["计算思维", "数字化学习与创新"]
    },
    {
      id: "act-3",
      title: "隐私讨论",
      durationMinutes: 10,
      teacherPrompt: "引导学生讨论网络服务中的数据安全和隐私保护。",
      studentTask: "写出一条使用网络服务时保护隐私的建议。",
      evidence: "学生能联系真实网络服务提出合理建议。",
      literacy: ["信息社会责任"]
    }
  ],
  assessments: [
    {
      id: "assess-1",
      dimension: "原理解释",
      evidence: "学生对数据分包、编号、传输和重组的说明",
      levelDescriptions: ["需要提示", "基本说清", "能结合情境解释"]
    }
  ],
  exportFormats: ["JSON", "HTML", "Word"]
};
