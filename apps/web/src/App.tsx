import { useEffect, useMemo, useRef, useState } from "react";
import { Component } from "react";
import type { ReactNode } from "react";
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import {
  ArrowRight,
  BookOpen,
  Braces,
  CheckCircle,
  Circle,
  ClipboardEdit,
  FileText,
  FolderOpen,
  Gauge,
  GitBranch,
  HelpCircle,
  Lightbulb,
  ClipboardCheck,
  Database,
  Download,
  Home,
  LibraryBig,
  ListTodo,
  MessageSquare,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  RefreshCw,
  Save,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  UsersRound,
  Waypoints,
  X
} from "lucide-react";
import type {
  ClassroomResourcePackage,
  CoreLiteracy,
  GenerationScope,
  Grade,
  LessonType,
  TeachingNeed,
  TeachingProcedure
} from "@kelian-zhixue/shared";
import { getProcedureNamesByType } from "@kelian-zhixue/shared";
import { builtInGuideLibrary } from "./data/defaultGuideLibrary";

type PageId =
  | "home"
  | "new-lesson"
  | "prep-workbench"
  | "resource-check"
  | "export"
  | "learning-profile"
  | "cases"
  | "guide-library"
  | "settings";

type ResourceTab = "design" | "task" | "assessment" | "diagnosis" | "materials";

type AssistantPreview = {
  action: string;
  original: string;
  process: string[];
  reason: string;
  revised: string;
  title: string;
};

type LocalSettings = {
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  defaultClassHours: string;
  defaultEquipmentCondition: string;
  defaultGenerationScope: GenerationScope;
  defaultGrade: Grade;
  defaultLessonType: LessonType;
  defaultStudentRequirement: "required" | "optional";
  exportStyle: "简洁教案版" | "教研展示版" | "比赛提交版";
  teacherName: string;
  teachingPreferences: string[];
};

type DesignPointsDraft = {
  basis: {
    curriculumStandard: string;
    equipmentContext: string;
    studentContext: string;
    teachingGuide: string;
  };
  breakthroughStrategies: string[];
  teacherEditableText: {
    teachingDifficulty: string;
    teachingFocus: string;
    teachingObjectives: string;
  };
  teachingDifficulty: string[];
  teachingFocus: string[];
  teachingObjectives: Array<{
    evidence: string;
    literacy: CoreLiteracy;
    objective: string;
  }>;
};

type GuideBasisEntry = {
  difficultPoints: string[];
  grade: string;
  id: string;
  keyPoints: string[];
  keywords: string[];
  learningObjectives: string[];
  lessonTitle: string;
  module: string;
  source: string;
  suggestedActivities: string[];
  updatedAt: string;
};

const teachingNeedStorageKey = "kelian.teachingNeed.v1";
const resourcePackageStorageKey = "kelian.resourcePackage.v2";
const resourceStatusStorageKey = "kelian.resourcePackage.status.v2";
const confirmedVersionStorageKey = "kelian.confirmedVersion.v3";
const resourceCheckStorageKey = "kelian.resourceCheck.v3";
const resourceSavedAtStorageKey = "kelian.resourcePackage.savedAt.v2";
const resourceExportedAtStorageKey = "kelian.resourcePackage.exportedAt.v4";
const resourceVersionStorageKey = "kelian.resourcePackage.version.v2";
const localSettingsStorageKey = "kelian.localSettings.v8";
const guideLibraryStorageKey = "kelian.guideLibrary.v8";
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

const navItems: Array<{ id: PageId; label: string; icon: typeof Home }> = [
  { id: "home", label: "工作台首页", icon: Home },
  { id: "new-lesson", label: "新建课例", icon: PenLine },
  { id: "prep-workbench", label: "备课工作台", icon: Sparkles },
  { id: "resource-check", label: "资源检测", icon: ClipboardCheck },
  { id: "export", label: "资源导出", icon: Download },
  { id: "learning-profile", label: "学情分析", icon: UsersRound },
  { id: "cases", label: "精品案例", icon: LibraryBig },
  { id: "guide-library", label: "课程数据库", icon: Database },
  { id: "settings", label: "系统设置", icon: Settings }
];

const navGroups = [
  { title: "备课流程", items: navItems.filter((item) => ["home", "new-lesson", "prep-workbench", "resource-check", "export"].includes(item.id)) },
  { title: "课后分析", items: navItems.filter((item) => item.id === "learning-profile") },
  { title: "资源中心", items: navItems.filter((item) => ["cases", "guide-library"].includes(item.id)) },
  { title: "本机配置", items: navItems.filter((item) => item.id === "settings") }
];

const defaultModuleByGrade: Record<string, string> = {
  七年级: "互联网应用与创新",
  八年级: "物联网实践与探索",
  九年级: "人工智能与智慧社会"
};

const lessonTypes = ["新知建构课", "项目实践课", "实验探究课", "技能应用课", "跨学科主题课"];
const lessonTypeHints: Record<string, string> = {
  新知建构课: "通过真实情境建立概念与原理理解。",
  项目实践课: "围绕完整项目推进方案设计与迭代。",
  实验探究课: "通过实验验证假设并形成解释。",
  技能应用课: "聚焦操作技能训练与迁移应用。",
  跨学科主题课: "连接多学科问题并产出综合作品。"
};
const coreLiteracies = ["信息意识", "计算思维", "数字化学习与创新", "信息社会责任"];
const promptTemplates = ["项目式学习", "跨学科融合", "小组协作", "真实情境", "计算思维", "交互性强", "工程实践"];

const templateText: Record<string, string> = {
  项目式学习: "希望围绕一个真实项目组织探究、制作和展示。",
  跨学科融合: "希望结合其他学科情境设计综合性学习任务。",
  小组协作: "希望安排小组分工、协作探究和成果交流。",
  真实情境: "希望结合真实生活或校园情境设计学习任务。",
  计算思维: "希望突出分解问题、抽象建模、设计算法和迁移表达。",
  交互性强: "希望课堂活动有较强互动，便于学生参与、讨论和即时反馈。",
  工程实践: "希望引导学生经历设计、制作、测试、优化和展示的过程。"
};

const defaultLocalSettings: LocalSettings = {
  aiApiKey: "",
  aiBaseUrl: "https://api.deepseek.com",
  aiModel: "deepseek-v4-flash",
  defaultClassHours: "1",
  defaultEquipmentCondition: "机房可上网，学生两人一机，教师机可投屏。",
  defaultGenerationScope: "生成完整课堂资源包" as GenerationScope,
  defaultGrade: "七年级" as Grade,
  defaultLessonType: "新知建构课" as LessonType,
  defaultStudentRequirement: "required",
  exportStyle: "教研展示版",
  teacherName: "",
  teachingPreferences: ["真实情境", "任务驱动", "小组协作"]
};

const defaultGuideLibrary = builtInGuideLibrary.map((item) => normalizeGuideEntry(item));

// 全局生成状态标记 — 用于跨组件导航保护
let globalIsGenerating = false;

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#f7f6f4] p-8">
          <div className="max-w-lg rounded-2xl border border-rose-200 bg-white/90 p-6 shadow-card backdrop-blur">
            <h2 className="text-lg font-bold text-rose-600">页面渲染出错</h2>
            <p className="mt-2 text-sm text-[#6f706f]">请刷新页面后重试。如持续出现，请清除浏览器本机数据。</p>
            <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-[#fef2f2] p-3 text-xs leading-5 text-rose-800">{this.state.error?.message}</pre>
            <button className="btn-primary mt-4" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }} type="button">刷新页面</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const [page, setPage] = useState<PageId>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activePage = resolvePage(page);

  function navigate(next: PageId | string) {
    if (globalIsGenerating) {
      const ok = window.confirm("AI 正在生成资源包，切换页面将中断生成。是否继续？");
      if (!ok) return;
      globalIsGenerating = false;
    }
    setPage(resolvePage(next));
  }

  return (
    <div className="min-h-screen bg-[#f7f6f4] text-[#17191c]">
      <aside className={`fixed inset-y-0 left-0 z-20 flex flex-col border-r border-[#ebe7e2] bg-white/76 shadow-[18px_0_45px_rgba(50,42,36,0.06)] backdrop-blur-xl transition-all duration-200 ${sidebarCollapsed ? "w-20 px-3" : "w-64 px-4"}`}>
        <div className="flex flex-col flex-1 min-h-0">
        <div className="mb-7 mt-5 flex items-start justify-between">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? "w-full justify-center" : ""}`}>
            <div className="nav-breathe flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff8f4] text-[#d9826b] shadow-[0_10px_24px_rgba(217,130,107,0.16)] ring-1 ring-[#f2d8cf]">
              <Lightbulb className="h-7 w-7" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <div className="text-lg font-bold tracking-tight text-[#17191c]">课链智教</div>
                <span className="mt-0.5 text-xs text-[#8d8882]">
                  AI备教学评一体化系统
                </span>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button className="rounded-lg p-1.5 text-[#8d8882] hover:bg-[#fff8f4] hover:text-[#17191c]" onClick={() => setSidebarCollapsed(true)} title="折叠导航" type="button">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {sidebarCollapsed && (
          <button className="mb-4 flex h-9 w-full items-center justify-center rounded-lg text-[#8d8882] hover:bg-[#fff8f4] hover:text-[#17191c]" onClick={() => setSidebarCollapsed(false)} title="展开导航" type="button">
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        {!sidebarCollapsed && (
          <div className="mb-6 rounded-2xl border border-[#ebe7e2] bg-[#fbfaf8]/80 px-3 py-2.5 shadow-[0_10px_24px_rgba(50,42,36,0.04)]">
            <p className="text-xs font-medium text-[#4b4b4c]">教师工作台</p>
            <p className="mt-0.5 text-xs text-[#8d8882]">智能备课 · 精准教学 · 数据迭代</p>
          </div>
        )}
        <nav className="flex-1 space-y-5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.title}>
              {!sidebarCollapsed && <p className="mb-2 px-2 text-xs font-medium tracking-wider text-[#9d9b98] uppercase">{group.title}</p>}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.id;
                  return (
                    <button
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                        active ? "bg-white text-[#17191c] font-semibold nav-breathe ring-1 ring-[#ebe7e2]" : "text-[#77736e] hover:bg-[#fff8f4] hover:text-[#17191c]"
                      } ${sidebarCollapsed ? "justify-center" : ""}`}
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      title={item.label}
                      type="button"
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#d9826b]" : ""}`} />
                      {!sidebarCollapsed && item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        {!sidebarCollapsed && (
          <div className="mt-auto mb-4 rounded-2xl border border-[#f2d8cf] bg-[#fff8f4]/90 p-3">
            <p className="text-xs font-semibold text-[#bd6a56]">V3.0 智能升级版</p>
            <p className="mt-0.5 text-xs leading-5 text-[#77736e]">AI协同教学闭环，全流程已贯通。</p>
          </div>
        )}
        </div>
      </aside>
      <main className={`min-h-screen px-8 py-6 transition-all duration-200 ${sidebarCollapsed ? "ml-20" : "ml-64"}`}>
        <ErrorBoundary>
        {activePage === "home" && <HomePage onNavigate={navigate} />}
        {activePage === "new-lesson" && <NewLessonPage onNavigate={navigate} />}
        {activePage === "prep-workbench" && <PrepWorkbenchPage onNavigate={navigate} />}
        {activePage === "resource-check" && <ResourceCheckPage onNavigate={navigate} />}
        {activePage === "export" && <ExportPage onNavigate={navigate} />}
        {activePage === "learning-profile" && <LearningProfilePage />}
        {activePage === "cases" && <CasesPage onNavigate={navigate} />}
        {activePage === "guide-library" && <GuideLibraryPage />}
        {activePage === "settings" && <SettingsPage />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

function resolvePage(id: string): PageId {
  if (["generate", "revise", "resource-generate", "resource-edit"].includes(id)) return "prep-workbench";
  if (["literacy", "quality", "literacy-evidence", "resource-quality"].includes(id)) return "resource-check";
  if (id === "case-library") return "cases";
  return navItems.some((item) => item.id === id) ? (id as PageId) : "home";
}

function HomePage({ onNavigate }: { onNavigate: (id: PageId) => void }) {
  const source = loadResourceSource();
  const currentNeed = source.resource?.teachingNeed ?? readJson<TeachingNeed>(teachingNeedStorageKey);
  const savedAt = localStorage.getItem(resourceSavedAtStorageKey) || "";
  const check = readJson<{ confidence: number; conclusion: string }>(resourceCheckStorageKey);
  const hasResource = Boolean(source.resource);
  const hasCheck = Boolean(check && hasResource);

  const workflowSteps = [
    { id: "new-lesson", label: "新建课例", desc: "填写课题与学情", icon: PenLine, done: Boolean(currentNeed) },
    { id: "prep-workbench", label: "AI 备课", desc: "生成课堂资源包", icon: Sparkles, done: hasResource },
    { id: "resource-check", label: "资源检测", desc: "质量评估与建议", icon: ClipboardCheck, done: hasCheck },
    { id: "export", label: "资源导出", desc: "Word / HTML / JSON", icon: Download, done: Boolean(localStorage.getItem(resourceExportedAtStorageKey)) },
  ] as const;

  const completedSteps = workflowSteps.filter((s) => s.done).length;
  const nextStep = workflowSteps.find((s) => !s.done);

  return (
    <PageFrame
      title="工作台首页"
      subtitle="从最近课例继续，或新建一节信息科技课的课堂资源包。"
      headerExtra={currentNeed ? (
        <LessonStatusBar
          need={currentNeed}
          status={source.resource ? source.status : "未生成"}
          savedAt={savedAt}
          note={check ? `最近检测：${check.conclusion}` : "建议按新建课例、备课工作台、资源检测、资源导出的顺序推进。"}
        />
      ) : undefined}
    >
      <div className="space-y-6">
        {/* Hero + Actions | 最近课例 + 资源中心 */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="panel-card overflow-hidden">
            <div className="border-b border-[#ebe7e2] bg-gradient-to-br from-white/90 via-[#fbfaf8] to-[#fff8f4] px-6 py-5">
              <p className="text-sm font-semibold text-[#9d9b98]">教师备课入口</p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#17191c]">把灵感和 AI 链成一堂好课，开始一节好课。</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#6f706f]">
                先确定课例，再进入备课工作台完成 AI 生成、修订、检测和导出。
              </p>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <ActionCard title="新建课例" text="填写课题、学情和设备条件。" button="开始新建" primary onClick={() => onNavigate("new-lesson")} />
              <ActionCard title="继续备课" text="查看并修改已生成资源。" button="进入工作台" onClick={() => onNavigate("prep-workbench")} />
              <ActionCard title="精品案例" text="载入完整样例快速体验。" button="打开案例" onClick={() => onNavigate("cases")} />
            </div>
          </section>

          <section className="panel-card p-5 flex flex-col">
            <p className="text-sm font-semibold text-[#9d9b98]">最近课例</p>
            {currentNeed ? (
              <>
                <h2 className="mt-3 text-lg font-semibold text-[#17191c] leading-tight">《{currentNeed.topicName || "未命名课例"}》</h2>
                <p className="mt-1.5 text-xs leading-5 text-[#6f706f]">{String(currentNeed.grade)}｜{currentNeed.courseModule}｜{String(currentNeed.lessonType)}</p>
                <button className="btn-primary mt-4 w-full text-sm" onClick={() => onNavigate(hasResource ? "prep-workbench" : "new-lesson")} type="button">
                  {hasResource ? "继续备课" : "继续填写课例"}
                </button>
                {hasResource && <button className="btn-secondary mt-2 w-full text-sm" onClick={() => onNavigate("resource-check")} type="button">查看检测</button>}
                {hasResource && hasCheck && <button className="btn-secondary mt-2 w-full text-sm" onClick={() => onNavigate("export")} type="button">导出资源</button>}
              </>
            ) : (
              <>
                <h2 className="mt-3 text-lg font-semibold text-[#17191c] leading-tight">《数据分包灵活传》</h2>
                <p className="mt-3 text-xs leading-5 text-[#6f706f]">第一次使用可以先载入样例课例，快速体验完整流程。</p>
                <button className="btn-secondary mt-4 w-full text-sm" onClick={() => loadSampleLesson(onNavigate)} type="button">以此为模板新建</button>
              </>
            )}
            <div className="mt-auto pt-4">
              <p className="text-xs font-semibold text-[#9d9b98] mb-2">资源中心</p>
              <button className="flex w-full items-center gap-2 rounded-lg border border-[#ebe7e2] bg-white px-3 py-2 text-left text-xs transition hover:border-[#e2d5cc]" onClick={() => onNavigate("cases")} type="button">
                <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[#d9826b]" />
                精品案例
              </button>
              <button className="mt-1.5 flex w-full items-center gap-2 rounded-lg border border-[#ebe7e2] bg-white px-3 py-2 text-left text-xs transition hover:border-[#e2d5cc]" onClick={() => onNavigate("guide-library")} type="button">
                <LibraryBig className="h-3.5 w-3.5 shrink-0 text-[#4a8c63]" />
                教学指南库
              </button>
            </div>
          </section>
        </div>

        {/* 工作流全景 */}
        <section>
          <p className="mb-4 text-sm font-semibold text-[#9d9b98]">工作流全景</p>
          <div className="grid gap-4 md:grid-cols-2">
            {/* 备课工作流 */}
            <div className="panel-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff8f4] text-[#d9826b]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#17191c]">备课工作流</h3>
                  <p className="text-xs text-[#9d9b98]">{completedSteps}/{workflowSteps.length} 步完成</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                {workflowSteps.map((step, i) => (
                  <span key={step.id} className="flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${step.done ? "bg-[#fff8f4] text-[#bd6a56]" : "bg-[#f5f4f2] text-[#9d9b98]"}`}>
                      {step.label}
                    </span>
                    {i < workflowSteps.length - 1 && <span className="text-[#d5d1cb]">→</span>}
                  </span>
                ))}
              </div>
              {nextStep && (
                <button className="mt-4 text-xs font-medium text-[#d9826b] hover:text-[#c7725c]" onClick={() => onNavigate(nextStep.id as PageId)} type="button">
                  下一步：{nextStep.label} →
                </button>
              )}
              <p className="mt-3 text-xs leading-5 text-[#6f706f]">
                从新建课例到导出课堂资源包，AI 全流程辅助。支持随时返回修改，每步结果可观察、可追溯。
              </p>
            </div>

            {/* AI 修订工作流 */}
            <div className="panel-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f0ff] text-[#7c6bb4]">
                  <PenLine className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#17191c]">AI 修订工作流</h3>
                  <p className="text-xs text-[#9d9b98]">嵌入备课工作台，随时可用</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">选中内容</span>
                <span className="text-[#d5d1cb]">→</span>
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">快捷修订</span>
                <span className="text-[#d5d1cb]">→</span>
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">预览差异</span>
                <span className="text-[#d5d1cb]">→</span>
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">应用</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#6f706f]">
                选中正文任意段落，AI 可降低难度、补充追问、增加支架、优化表达，逐段打磨到满意。
              </p>
              {hasResource && (
                <button className="mt-3 text-xs font-medium text-[#7c6bb4] hover:text-[#6a5a9e]" onClick={() => onNavigate("prep-workbench")} type="button">
                  进入备课工作台使用 →
                </button>
              )}
            </div>

            {/* 学情分析工作流 */}
            <div className="panel-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fef3e4] text-[#c98a4b]">
                  <UsersRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#17191c]">学情分析工作流</h3>
                  <p className="text-xs text-[#9d9b98]">课后使用，诊断与改进</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">导入学生数据</span>
                <span className="text-[#d5d1cb]">→</span>
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">班级诊断</span>
                <span className="text-[#d5d1cb]">→</span>
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">分层建议</span>
                <span className="text-[#d5d1cb]">→</span>
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">教学改进</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#6f706f]">
                导入学生提交的学习数据，自动生成班级诊断报告，识别共性薄弱点，输出分层教学和改进建议。
              </p>
              <button className="mt-3 text-xs font-medium text-[#c98a4b] hover:text-[#b07a3b]" onClick={() => onNavigate("learning-profile")} type="button">
                进入学情分析 →
              </button>
            </div>

            {/* 学生端课堂工作流 */}
            <div className="panel-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f6eb4]">
                  <Monitor className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#17191c]">学生端课堂工作流</h3>
                  <p className="text-xs text-[#9d9b98]">课堂上使用，以学为中心</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">教师分发资源包</span>
                <span className="text-[#d5d1cb]">→</span>
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">学生接收任务</span>
                <span className="text-[#d5d1cb]">→</span>
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">完成操作记录</span>
                <span className="text-[#d5d1cb]">→</span>
                <span className="rounded-full bg-[#f5f4f2] px-2 py-0.5 font-medium text-[#9d9b98]">同伴互评</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#6f706f]">
                教师导出课堂资源包后，学生在课堂上通过学生端接收任务，完成操作记录、提交学习证据，支撑过程性评价。
              </p>
            </div>
          </div>
        </section>

      </div>
    </PageFrame>
  );
}

function ActionCard({ button, onClick, primary, text, title }: { button: string; onClick: () => void; primary?: boolean; text: string; title: string }) {
  return (
    <div className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${primary ? "border-[#f2d8cf] bg-[#fff8f4] shadow-[0_16px_34px_rgba(217,130,107,0.12)]" : "border-[#ebe7e2] bg-white/86 hover:border-[#e2d5cc] shadow-[0_10px_24px_rgba(50,42,36,0.05)]"}`}>
      <h3 className="font-semibold text-[#17191c]">{title}</h3>
      <p className="mt-2 min-h-10 text-sm leading-5 text-[#6f706f]">{text}</p>
      <button className={`mt-4 w-full ${primary ? "btn-primary" : "btn-secondary"}`} onClick={onClick} type="button">
        {button}
      </button>
    </div>
  );
}

function NewLessonPage({ onNavigate }: { onNavigate: (id: PageId) => void }) {
  const [need, setNeed] = useState<TeachingNeed>(() => loadTeachingNeed());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [formNotice, setFormNotice] = useState("");
  const [draftingDesignPoints, setDraftingDesignPoints] = useState(false);
  const [designBasis, setDesignBasis] = useState<DesignPointsDraft["basis"] | null>(null);

  function update<K extends keyof TeachingNeed>(key: K, value: TeachingNeed[K]) {
    const next = { ...need, [key]: value, updatedAt: new Date().toISOString() };
    if (key === "grade") next.courseModule = defaultModuleByGrade[String(value)] ?? next.courseModule;
    setNeed(next);
    if (errors[String(key)]) setErrors((old) => ({ ...old, [String(key)]: "" }));
    if (formNotice) setFormNotice("");
  }

  function goStepTwoFromHeader() {
    if (step === 2) return;
    goStepTwo();
  }

  function appendTemplate(label: string) {
    const text = templateText[label];
    if (!text || need.additionalNeeds.includes(text)) return;
    update("additionalNeeds", `${need.additionalNeeds ? `${need.additionalNeeds}\n` : ""}${text}` as TeachingNeed["additionalNeeds"]);
  }

  function fillContextByAi() {
    const next = suggestNeedContext(need);
    setNeed(next);
    setErrors((old) => ({ ...old, studentFoundation: "", equipmentCondition: "" }));
    setFormNotice("");
  }

  async function draftDesignPoints() {
    if (!need.topicName.trim()) {
      setFormNotice("请先填写课题名称，再让 AI 起草教学目标、重点和难点。");
      return;
    }
    setDraftingDesignPoints(true);
    setFormNotice("正在参考课程标准、教学指南和学情信息起草教学设计要点...");
    const draft = await draftDesignPointsWithAi(need);
    setNeed((old) => ({
      ...old,
      teachingObjectives: draft.teacherEditableText.teachingObjectives,
      teachingFocus: draft.teacherEditableText.teachingFocus,
      teachingDifficulty: draft.teacherEditableText.teachingDifficulty,
      updatedAt: new Date().toISOString()
    }));
    setDesignBasis(draft.basis);
    setErrors((old) => ({ ...old, teachingObjectives: "", teachingFocus: "", teachingDifficulty: "" }));
    setFormNotice("已生成教学目标、重点和难点，请根据本班情况修改确认。");
    setDraftingDesignPoints(false);
  }

  function save() {
    localStorage.setItem(teachingNeedStorageKey, JSON.stringify({ ...need, updatedAt: new Date().toISOString() }));
    setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
  }

  function goStepTwo() {
    const result = validateNeedStepOne(need);
    setErrors(result);
    if (Object.keys(result).length > 0) {
      setFormNotice(`请先补充：${Object.values(result).join("、")}`);
      return;
    }
    setFormNotice("");
    setStep(2);
  }

  function next() {
    const result = validateNeed(need);
    setErrors(result);
    if (Object.keys(result).length > 0) {
      setStep(1);
      setFormNotice(`请先补充：${Object.values(result).join("、")}`);
      return;
    }
    setFormNotice("");
    save();
    clearResourceLifecycle();
    onNavigate("prep-workbench");
  }

  return (
    <PageFrame
      title="新建课例"
      subtitle="分两步完成新课准备：先确定课堂边界，再完善教学设计要点。"
      headerExtra={<LessonStatusBar need={need} status="未生成" savedAt={savedAt} note="当前处于课例输入阶段，完成后进入备课工作台生成课堂资源。" />}
    >
      <div className="mb-5 rounded-xl border border-[#ebe7e2] bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${step === 1 ? "bg-[#fbeee8] text-[#bd6a56]" : "bg-[#f5f5f6] text-[#9d9b98]"}`} onClick={() => setStep(1)} type="button">
            1 / 2 基础信息与学情
          </button>
          <span className="text-[#c9ccd1]">→</span>
          <button className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${step === 2 ? "bg-[#fbeee8] text-[#bd6a56]" : "bg-[#f5f5f6] text-[#9d9b98]"}`} onClick={goStepTwoFromHeader} type="button">
            2 / 2 教学目标和偏好
          </button>
          <span className="ml-auto text-xs text-[#9d9b98]">{step === 1 ? "先完成必填项，避免填表焦虑" : "再补充教学目标、重难点和个性化要求"}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          {step === 1 && (
            <>
              <Card title="基础信息">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="课题名称" required error={errors.topicName}>
                    <input className="input" value={need.topicName} onChange={(e) => update("topicName", e.target.value)} placeholder="例如：数据分包灵活传" />
                  </Field>
                  <Field label="年级" required>
                    <select className="input" value={String(need.grade)} onChange={(e) => update("grade", e.target.value as Grade)}>
                      {["七年级", "八年级", "九年级"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field label="课程模块" required error={errors.courseModule}>
                    <input className="input" value={need.courseModule} onChange={(e) => update("courseModule", e.target.value)} />
                  </Field>
                  <Field label="课时数" required error={errors.classHours}>
                    <input className="input" value={need.classHours} onChange={(e) => update("classHours", e.target.value)} placeholder="例如：1" />
                  </Field>
                  <Field label="资源生成范围" required>
                    <select className="input" value={String(need.generationScope)} onChange={(e) => update("generationScope", e.target.value as GenerationScope)}>
                      {["只生成教学设计", "生成完整课堂资源包"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-[#4b4b4c]">课堂类型 <span className="text-[#d9826b]">*</span></p>
                  <div className="grid gap-2 md:grid-cols-5">
                    {lessonTypes.map((item) => (
                      <button
                        className={`rounded-xl border px-3 py-3 text-left transition ${String(need.lessonType) === item ? "border-[#d9826b] bg-[#fff8f4] text-[#bd6a56]" : "border-[#ebe7e2] bg-white text-[#6f706f] hover:bg-[#f7f6f4]"}`}
                        key={item}
                        onClick={() => update("lessonType", item as LessonType)}
                        type="button"
                      >
                        <span className="block text-sm font-semibold">{item}</span>
                        <span className="mt-1 block text-xs leading-5 text-[#9d9b98]">{lessonTypeHints[item]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              <Card
                title="学情与条件"
                action={<div className="flex items-center gap-2"><button className="rounded-md border border-[#ebe7e2] px-2 py-1.5 text-sm text-[#9d9b98] hover:border-[#d9826b] hover:text-[#bd6a56] transition" onClick={() => setNeed(prev => ({ ...prev, studentFoundation: "", equipmentCondition: "", updatedAt: new Date().toISOString() }))} type="button"><X className="h-3.5 w-3.5" /></button><button className="rounded-md border border-[#d9826b] px-3 py-1.5 text-sm text-[#bd6a56]" onClick={fillContextByAi} type="button">✨ AI 自动推测</button></div>}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="学生基础" required error={errors.studentFoundation}>
                    <textarea className="input min-h-28" value={need.studentFoundation} onChange={(e) => update("studentFoundation", e.target.value)} placeholder={`【认知基础】学生已掌握……\n【能力水平】学生能……但……\n【学习特征】偏好……的学习方式\n【心理与态度】对……感兴趣/存在畏难情绪`} />
                  </Field>
                  <Field label="机房或设备条件" required error={errors.equipmentCondition}>
                    <textarea className="input min-h-28" value={need.equipmentCondition} onChange={(e) => update("equipmentCondition", e.target.value)} placeholder="例如：机房可上网，学生两人一机，教师机可投屏。" />
                  </Field>
                </div>
                <p className="mt-3 rounded-md bg-[#f7f8fa] px-3 py-2 text-xs text-[#9d9b98]">输入课题和年级后，可一键补齐常见学情与设备条件草案，再按本班真实情况微调。</p>
              </Card>
            </>
          )}

          {step === 2 && (
            <>
              <Card title="教学设计要点" action={<div className="flex items-center gap-2"><button className="rounded-md border border-[#ebe7e2] px-2 py-1.5 text-sm text-[#9d9b98] hover:border-[#d9826b] hover:text-[#bd6a56] transition" onClick={() => setNeed(prev => ({ ...prev, teachingObjectives: "", teachingFocus: "", teachingDifficulty: "", updatedAt: new Date().toISOString() }))} type="button"><X className="h-3.5 w-3.5" /></button><button className="rounded-md border border-[#d9826b] px-3 py-1.5 text-sm text-[#bd6a56] disabled:opacity-60" disabled={draftingDesignPoints} onClick={draftDesignPoints} type="button">{draftingDesignPoints ? "起草中..." : "✨ AI 帮我起草"}</button></div>}>
                <div className="grid gap-4">
                  <Field label="基于核心素养的教学目标">
                    <textarea className="input min-h-28" value={need.teachingObjectives} onChange={(e) => update("teachingObjectives", e.target.value)} />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="教学重点"><textarea className="input min-h-24" value={need.teachingFocus} onChange={(e) => update("teachingFocus", e.target.value)} /></Field>
                    <Field label="教学难点"><textarea className="input min-h-24" value={need.teachingDifficulty} onChange={(e) => update("teachingDifficulty", e.target.value)} /></Field>
                  </div>
                </div>
                {designBasis && (
                  <div className="mt-4 rounded-xl border border-[#f2d8cf] bg-[#fff8f4] p-3 text-sm leading-6 text-[#8f5748]">
                    <p className="font-semibold text-[#17191c]">本次起草依据</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>{designBasis.curriculumStandard}</li>
                      <li>{designBasis.teachingGuide}</li>
                      <li>{designBasis.studentContext}</li>
                      <li>{designBasis.equipmentContext}</li>
                    </ul>
                  </div>
                )}
              </Card>

              <Card title="个性化生成向导">
                <div className="mb-3 flex flex-wrap gap-2">
                  {promptTemplates.map((item) => (
                    <button className="rounded-md border border-[#ebe7e2] px-3 py-1.5 text-sm text-[#4b4b4c] hover:border-[#d9826b] hover:text-[#bd6a56]" key={item} onClick={() => appendTemplate(item)} type="button">
                      {item}
                    </button>
                  ))}
                </div>
                <textarea className="input min-h-28" value={need.additionalNeeds} onChange={(e) => update("additionalNeeds", e.target.value)} placeholder="例如：希望结合其他学科情境设计综合性学习任务。" />
              </Card>
            </>
          )}

          {formNotice && (
            <div className="rounded-lg border border-[#f2d8cf] bg-[#fff8f4] px-4 py-3 text-sm leading-6 text-[#8f5748]">
              {formNotice}
            </div>
          )}

          <PageActionBar
            primaryLabel={step === 1 ? "下一步：填写教学目标和偏好" : "进入备课工作台"}
            onPrimary={step === 1 ? goStepTwo : next}
            secondaryLabel={step === 2 ? "返回上一步" : undefined}
            onSecondary={step === 2 ? () => setStep(1) : undefined}
            note={savedAt ? `草稿已保存：${savedAt}` : "填写过程可随时保存草稿。"}
          >
            <button className="btn-secondary" onClick={save} type="button"><Save className="h-4 w-4" />保存草稿</button>
          </PageActionBar>
        </section>

        <aside className="sticky top-6 h-fit rounded-xl border border-[#ebe7e2] bg-white p-5 shadow-sm">
          <h3 className="font-semibold">本课生成建议</h3>
          {!need.topicName ? (
            <p className="mt-3 text-sm leading-6 text-[#77736e]">先输入课题与年级，右侧会实时更新更贴近课堂的建议。</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm leading-6 text-[#5f5e5c]">
              <li><b>课程定位：</b>{need.grade}《{need.topicName}》建议放在"{need.courseModule}"模块中组织。</li>
              <li><b>活动节奏：</b>{need.lessonType}推荐流程"{getProcedureNames(String(need.lessonType)).join(" → ")}"。</li>
              <li><b>学情抓手：</b>{need.studentFoundation || "建议补充学生已有经验和可能困难。"}</li>
              <li><b>资源建议：</b>建议同步生成教学设计、任务单、测评题和学情诊断表。</li>
            </ul>
          )}
        </aside>
      </div>
    </PageFrame>
  );
}

function PrepWorkbenchPage({ onNavigate }: { onNavigate: (id: PageId) => void }) {
  const [need, setNeed] = useState<TeachingNeed | null>(() => readJson(teachingNeedStorageKey));
  const [resource, setResource] = useState<ClassroomResourcePackage | null>(() => readJson(resourcePackageStorageKey));
  const [tab, setTab] = useState<ResourceTab>("design");
  const [savedAt, setSavedAt] = useState("");
  const [status, setStatus] = useState(() => localStorage.getItem(resourceStatusStorageKey) || "AI初稿");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [assistantText, setAssistantText] = useState("先点击正文中的一段内容，再选择改写动作。\n我们会先给出差异预览，再由你决定是否采纳。");
  const [assistantInput, setAssistantInput] = useState("");
  const [selectedText, setSelectedText] = useState<{ label: string; value: string } | null>(null);
  const [preview, setPreview] = useState<AssistantPreview | null>(null);
  const [operationNotice, setOperationNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStage, setGeneratingStage] = useState("");
  const applyRef = useRef<((next: string) => void) | null>(null);

  // 浏览器关闭/刷新保护 + 组件卸载时重置全局状态
  useEffect(() => {
    if (!isGenerating) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => {
      window.removeEventListener("beforeunload", guard);
      globalIsGenerating = false;
    };
  }, [isGenerating]);

  if (!need) {
    return (
      <EmptyState title="请先新建课例" text="备课工作台需要先读取课题、学情和设备条件。" action="去新建课例" onAction={() => onNavigate("new-lesson")} />
    );
  }

  async function generate() {
    if (!need) return;
    if (resource && status !== "AI初稿") {
      const ok = window.confirm("重新生成可能覆盖当前已修改内容。建议先保存或确认定稿，再重新生成。是否继续？");
      if (!ok) return;
    }
    setIsGenerating(true);
    setOperationNotice("");
    setGeneratingStage("正在调用 AI 生成课堂资源包...");
    globalIsGenerating = true;
    const fallback = createResourcePackage(need);
    const { notice, resource: next } = await generateResourceWithAi(need, fallback);
    setGeneratingStage("");
    setResource(next);
    localStorage.setItem(resourcePackageStorageKey, JSON.stringify(next));
    localStorage.setItem(resourceStatusStorageKey, "AI初稿");
    setResourceVersion(next.id);
    clearResourceReviewArtifacts();
    setStatus("AI初稿");
    setHasUnsavedChanges(false);
    setSavedAt("");
    setSelectedText(null);
    setPreview(null);
    setOperationNotice(notice);
    setIsGenerating(false);
    globalIsGenerating = false;
  }

  async function generateDeep() {
    if (!need) return;
    if (resource && status !== "AI初稿") {
      const ok = window.confirm("深度生成将重新生成全部内容，可能覆盖当前修改。是否继续？");
      if (!ok) return;
    }
    setIsGenerating(true);
    setOperationNotice("");
    setGeneratingStage("深度生成 · 需求分析...");
    globalIsGenerating = true;
    const fallback = createResourcePackage(need);
    const { notice, resource: next } = await generateWithWorkflow(
      need,
      fallback,
      (stage, detail) => setGeneratingStage(`${stage} · ${detail}`),
      (msg) => setOperationNotice(msg),
    );
    setGeneratingStage("");
    setResource(next);
    localStorage.setItem(resourcePackageStorageKey, JSON.stringify(next));
    localStorage.setItem(resourceStatusStorageKey, "AI初稿");
    setResourceVersion(next.id);
    clearResourceReviewArtifacts();
    setStatus("AI初稿");
    setHasUnsavedChanges(false);
    setSavedAt("");
    setSelectedText(null);
    setPreview(null);
    setOperationNotice(notice);
    setIsGenerating(false);
    globalIsGenerating = false;
  }

  function updateResource(next: ClassroomResourcePackage) {
    setResource(next);
    setStatus("教师修改版");
    setHasUnsavedChanges(true);
    localStorage.setItem(resourceStatusStorageKey, "教师修改版");
    clearResourceReviewArtifacts();
    setOperationNotice("内容已修改，记得保存后再确认定稿。");
  }

  function save() {
    if (!resource) return;
    localStorage.setItem(resourcePackageStorageKey, JSON.stringify(resource));
    const nextSavedAt = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    localStorage.setItem(resourceSavedAtStorageKey, nextSavedAt);
    setSavedAt(nextSavedAt);
    setHasUnsavedChanges(false);
    setOperationNotice(`修改已保存：${nextSavedAt}`);
  }

  function confirm() {
    if (!resource) return;
    save();
    localStorage.setItem(confirmedVersionStorageKey, JSON.stringify(resource));
    localStorage.setItem(resourceStatusStorageKey, "教师确认版");
    setStatus("教师确认版");
    setHasUnsavedChanges(false);
    setOperationNotice("已确认定稿，可以进入资源检测。");
  }

  function changeLessonType(value: string) {
    if (!need) return;
    const nextNeed = { ...need, lessonType: value as LessonType, updatedAt: new Date().toISOString() };
    setNeed(nextNeed);
    localStorage.setItem(teachingNeedStorageKey, JSON.stringify(nextNeed));
    if (resource) {
      const nextResource = {
        ...resource,
        teachingNeed: nextNeed,
        teachingDesign: {
          ...resource.teachingDesign,
          basicInfo: { ...resource.teachingDesign.basicInfo, lessonType: value as LessonType },
          procedures: getProcedureNames(value).map((phase, index) => createProcedure(phase, index, nextNeed.topicName || "本课", nextNeed))
        }
      };
      updateResource(nextResource);
    }
  }

  function handleActivate(payload: { apply: (next: string) => void; label: string; value: string }) {
    applyRef.current = payload.apply;
    setSelectedText({ label: payload.label, value: payload.value });
    setPreview(null);
    setAssistantText(`已选中「${payload.label}」。你可以点快捷修订，也可以写下自己的修改要求。`);
  }

  function runAssistant(action: string, request = "") {
    if (!selectedText) {
      setAssistantText("请先在正文区点击一段内容，再使用 AI 修订助手。");
      return;
    }
    const currentNeed = need;
    if (!currentNeed) {
      setAssistantText("课例信息缺失，请返回重试。");
      return;
    }
    const nextPreview = buildAssistantPreview({
      action,
      module: tab,
      need: currentNeed,
      original: selectedText.value,
      request
    });
    setPreview(nextPreview);
    setAssistantText(makeAssistantSuggestion(tab, action, request));
  }

  function runCustomAssistant() {
    const request = assistantInput.trim();
    if (!request) {
      setAssistantText("请先写下你希望怎么改，例如：降低七年级学生理解难度，或增加一个网络伦理讨论。");
      return;
    }
    runAssistant("按教师要求修订", request);
  }

  function acceptPreview() {
    if (!preview || !applyRef.current) return;
    applyRef.current(preview.revised);
    setSelectedText((prev) => (prev ? { ...prev, value: preview.revised } : prev));
    setStatus("教师修改版");
    localStorage.setItem(resourceStatusStorageKey, "教师修改版");
    setHasUnsavedChanges(true);
    setOperationNotice("AI 修订建议已应用到当前内容，请记得保存修改。");
    setAssistantText(`已应用到「${selectedText?.label || "当前内容"}」。这只是教师修改版，不会自动定稿。`);
    setPreview(null);
  }

  return (
    <PageFrame
      title="备课工作台"
      subtitle="生成、查看、直接修改并确认课堂资源包。"
      headerExtra={<LessonStatusBar need={need} status={resource ? status : "未生成"} savedAt={savedAt || localStorage.getItem(resourceSavedAtStorageKey) || ""} note={hasUnsavedChanges ? "当前有未保存修改，进入检测前请先保存。" : resource ? "当前处于资源修订阶段，建议先保存修改，再确认定稿并进入资源检测。" : "当前还没有生成资源包，请先生成课堂资源包。"} />}
    >
      <section className="panel-card mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe7e2] bg-[#fbfaf8] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="status-chip">{resource ? "资源修订" : "资源生成"}</span>
            {hasUnsavedChanges && <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">有未保存修改</span>}
            {isGenerating && generatingStage && <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700 animate-pulse">{generatingStage}</span>}
            {operationNotice && <span className="rounded-lg border border-[#f2d8cf] bg-[#fff8f4] px-2 py-1 text-[#bd6a56]">{operationNotice}</span>}
            {!isGenerating && <span className="rounded-md border border-[#ebe7e2] bg-white px-2 py-1 text-[#6f706f]">点击内容块即可修改</span>}
          </div>
          {resource && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={isGenerating} onClick={generateDeep} type="button" title="5步工作流 · 可观察每一步生成过程">
                <Sparkles className="h-4 w-4" />深度生成
              </button>
              <button className="btn-secondary" disabled={isGenerating} onClick={generate} type="button">{isGenerating ? (generatingStage || "生成中...") : "快速生成（轻量预览）"}</button>
              <button className="btn-secondary" onClick={save} type="button"><Save className="h-4 w-4" />保存修改</button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold text-[#17191c]">{need.topicName || "未命名课例"}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#6f706f]">
              <span>{String(need.grade)}</span>
              <span>｜</span>
              <span>{need.courseModule}</span>
              <span>｜</span>
              <span>{need.classHours}课时</span>
              <span>｜</span>
              <select className="rounded-lg border border-[#ebe7e2] bg-white px-2 py-1 text-sm text-[#17191c] outline-none focus:border-[#d9826b]" value={String(need.lessonType)} onChange={(event) => changeLessonType(event.target.value)}>
                {lessonTypes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#9d9b98]">切换课程类型后，教学流程会按对应课型更新。重新生成前可先保存当前修改。</p>
        </div>
      </section>

      {!resource ? (
        isGenerating ? (
          <div className="panel-card flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 ring-4 ring-blue-100">
              <Sparkles className="h-8 w-8 animate-pulse text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-[#17191c]">正在生成课堂资源包</h2>
            <p className="mt-2 text-sm text-[#6f706f]">{generatingStage || "请稍候..."}</p>
            <p className="mt-4 max-w-md text-xs text-[#9d9b98]">AI 正在根据课例信息、教学指南和课型要求生成完整的课堂资源包，请勿切换页面。深度生成约需 2-3 分钟。</p>
          </div>
        ) : (
          <>
            <EmptyState title="还没有生成资源包" text="深度生成通过5步AI工作流产出完整课堂资源包，过程透明可观察，约需2-3分钟。" action="深度生成课堂资源包" onAction={generateDeep} />
            {!isGenerating ? (
              <p className="mt-3 text-center text-xs text-[#9d9b98]">
                如需快速预览，可先使用
                <button className="mx-1 text-[#9d9b98] underline hover:text-[#17191c]" onClick={generate} type="button">快速生成</button>
                （约15-30秒，仅含核心环节）
              </p>
            ) : null}
          </>
        )
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="document-surface p-5">
            <div className="mb-4 flex flex-wrap gap-2 border-b border-[#ebe7e2] pb-4">
              {resourceTabs.map((item) => (
                <button
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${tab === item.id ? "bg-[#fbeee8] text-[#bd6a56]" : "border border-[#ebe7e2] bg-[#f7f6f4] text-[#6f706f] hover:bg-white"}`}
                  key={item.id}
                  onClick={() => {
                    setTab(item.id);
                    setSelectedText(null);
                    setPreview(null);
                    applyRef.current = null;
                    setAssistantText("已切换资源模块，请先点击正文中的一段内容，再让助手修订。");
                  }}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <ResourceEditor resource={resource} tab={tab} onChange={updateResource} onActivate={handleActivate} />
          </section>
          <aside className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto space-y-4">
            <Card title="设计依据">
              <p className="text-sm leading-6 text-[#5f5e5c]">本课依据义务教育信息科技课程标准与教学指南，重点关注真实情境、过程证据、活动可操作性和责任意识。</p>
            </Card>
            <Card title="AI 修订助手">
              <p className="text-sm text-[#77736e]">当前模块：{resourceTabs.find((item) => item.id === tab)?.label}</p>
              <div className="mt-2 rounded-md border border-[#ebe7e2] bg-[#fbfaf8] px-3 py-2 text-xs leading-5 text-[#6f706f]">
                {selectedText ? (
                  <>
                    <p className="font-semibold text-[#17191c]">已选中：{selectedText.label}</p>
                    <p className="mt-1 line-clamp-2">{selectedText.value}</p>
                  </>
                ) : (
                  "请先点击正文中的一段内容，助手会针对这段内容给出可采纳的修订建议。"
                )}
              </div>
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold text-[#6f706f]">快捷修订</p>
                <div className="flex flex-wrap gap-2">
                  {getAssistantActions(tab).map((item) => (
                    <button
                      className="rounded-md border border-[#ebe7e2] px-2 py-1 text-xs text-[#4e5969] hover:border-[#d9826b] hover:text-[#bd6a56] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!selectedText}
                      key={item}
                      onClick={() => runAssistant(item)}
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-2 block text-xs font-semibold text-[#6f706f]">教师个性化要求</label>
                <textarea
                  className="input min-h-24"
                  onChange={(event) => setAssistantInput(event.target.value)}
                  placeholder="例如：这个活动七年级学生可能听不懂，帮我改得更具体。"
                  value={assistantInput}
                />
                <button className="btn-primary mt-2 w-full" disabled={!selectedText} onClick={runCustomAssistant} type="button">
                  生成修订建议
                </button>
              </div>
              <div className="mt-3 rounded-md bg-[#fff8f4] p-3 text-sm leading-6 text-[#4b4b4c] whitespace-pre-wrap">{assistantText}</div>

              {preview && (
                <div className="mt-3 space-y-3 rounded-md border border-[#f2d8cf] bg-white p-3">
                  <div>
                    <p className="text-sm font-semibold text-[#17191c]">{preview.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#6f706f]">{preview.reason}</p>
                  </div>
                  <div className="rounded-md bg-[#fbfaf8] p-2">
                    <p className="text-xs font-semibold text-[#9d9b98]">生成过程</p>
                    <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs leading-5 text-[#6f706f]">
                      {preview.process.map((item) => <li key={item}>{item}</li>)}
                    </ol>
                  </div>
                  <div className="rounded-md border border-rose-100 bg-rose-50 p-2 text-xs leading-5 text-rose-800 whitespace-pre-wrap">当前内容：{preview.original}</div>
                  <div className="rounded-md border border-emerald-100 bg-emerald-50 p-2 text-xs leading-5 text-emerald-800 whitespace-pre-wrap">建议替换为：{preview.revised}</div>
                  <div className="grid gap-2">
                    <button className="btn-primary w-full" onClick={acceptPreview} type="button">应用到当前内容</button>
                    <button className="btn-secondary w-full" onClick={() => runAssistant(preview.action, assistantInput)} type="button">重新生成</button>
                    <button className="btn-secondary w-full" onClick={() => setPreview(null)} type="button">暂不应用</button>
                  </div>
                  <p className="text-xs leading-5 text-[#9d9b98]">应用后只替换当前选中的内容块，不会自动覆盖整份资源，也不会自动定稿。</p>
                </div>
              )}
            </Card>
          </aside>
          <div className="xl:col-span-2">
            <PageActionBar
              primaryLabel={hasUnsavedChanges ? "保存修改" : status === "教师确认版" ? "进入资源检测" : "确认定稿"}
              onPrimary={hasUnsavedChanges ? save : status === "教师确认版" ? () => onNavigate("resource-check") : confirm}
              secondaryLabel={hasUnsavedChanges ? undefined : status === "教师确认版" ? undefined : "保存修改"}
              onSecondary={hasUnsavedChanges || status === "教师确认版" ? undefined : save}
              note={hasUnsavedChanges ? "当前有未保存修改，请先保存，再确认定稿。" : status === "教师确认版" ? "资源已确认定稿，下一步建议进入资源检测。" : "检测和导出前，建议先保存修改并确认定稿。"}
            />
          </div>
        </div>
      )}
    </PageFrame>
  );
}

const resourceTabs: Array<{ id: ResourceTab; label: string }> = [
  { id: "design", label: "教学设计" },
  { id: "task", label: "学习任务单" },
  { id: "assessment", label: "分层测评题" },
  { id: "diagnosis", label: "学情诊断表" },
  { id: "materials", label: "课堂材料" }
];

function ResourceEditor({
  onActivate,
  onChange,
  resource,
  tab
}: {
  onActivate?: (payload: { apply: (next: string) => void; label: string; value: string }) => void;
  onChange: (value: ClassroomResourcePackage) => void;
  resource: ClassroomResourcePackage;
  tab: ResourceTab;
}) {
  if (tab === "design") {
    const design = resource.teachingDesign || { teachingAnalysis: [], teachingMethods: [], teachingObjectives: [], procedures: [] };
    return (
      <div className="space-y-4">
        <EditableList icon={Lightbulb} title="教学分析" items={design.teachingAnalysis} onActivate={onActivate} onChange={(items) => onChange({ ...resource, teachingDesign: { ...design, teachingAnalysis: items } })} />
        <EditableList icon={Waypoints} title="教学方法" items={design.teachingMethods} onActivate={onActivate} onChange={(items) => onChange({ ...resource, teachingDesign: { ...design, teachingMethods: items } })} />
        <EditableList icon={Target} title="基于核心素养的教学目标" items={design.teachingObjectives} onActivate={onActivate} onChange={(items) => onChange({ ...resource, teachingDesign: { ...design, teachingObjectives: items } })} />
        <ProcedureEditor procedures={design.procedures} onActivate={onActivate} onChange={(procedures) => onChange({ ...resource, teachingDesign: { ...design, procedures } })} />
      </div>
    );
  }
  if (tab === "task") {
    const task = resource.learningTaskSheet || { taskGoal: [], scenarioIntroduction: "", taskSteps: [], learningSupports: [], groupRoles: [], recordTable: [], reflectionQuestions: [] };
    return (
      <div className="space-y-4">
        <EditableList icon={Target} title="学习目标" items={task.taskGoal} onActivate={onActivate} onChange={(items) => onChange({ ...resource, learningTaskSheet: { ...task, taskGoal: items } })} />
        <EditableList icon={ListTodo} title="学习任务" items={task.taskSteps} onActivate={onActivate} onChange={(items) => onChange({ ...resource, learningTaskSheet: { ...task, taskSteps: items } })} />
        <EditableList icon={BookOpen} title="学法指导" items={task.learningSupports} onActivate={onActivate} onChange={(items) => onChange({ ...resource, learningTaskSheet: { ...task, learningSupports: items } })} />
        <div className="saas-card">
          <div className="saas-card-header">
            <ClipboardEdit className="h-4 w-4 shrink-0 text-[#d9826b]" />
            操作记录
          </div>
          <div className="saas-list-item">
            <span className="saas-list-num">1</span>
            <EditableText title="" value={task.scenarioIntroduction} onActivate={onActivate ? ({ value, apply }) => onActivate({ label: "操作记录", value, apply }) : undefined} onChange={(value) => onChange({ ...resource, learningTaskSheet: { ...task, scenarioIntroduction: value } })} />
          </div>
        </div>
        <EditableList icon={MessageSquare} title="课堂评价" items={task.groupRoles} onActivate={onActivate} onChange={(items) => onChange({ ...resource, learningTaskSheet: { ...task, groupRoles: items } })} />
        <EditableList icon={RefreshCw} title="课堂反思" items={task.reflectionQuestions} onActivate={onActivate} onChange={(items) => onChange({ ...resource, learningTaskSheet: { ...task, reflectionQuestions: items } })} />
      </div>
    );
  }
  if (tab === "assessment") {
    const item = resource.layeredAssessment || { basicUnderstanding: [], principleExplanation: [], scenarioTransfer: [], creativeExpression: [] };
    return (
      <div className="space-y-4">
        <EditableList icon={CheckCircle} title="基础理解（单选题）" items={item.basicUnderstanding} onActivate={onActivate} onChange={(items) => onChange({ ...resource, layeredAssessment: { ...item, basicUnderstanding: items } })} />
        <EditableList icon={HelpCircle} title="原理阐述（判断题）" items={item.principleExplanation} onActivate={onActivate} onChange={(items) => onChange({ ...resource, layeredAssessment: { ...item, principleExplanation: items } })} />
        <EditableList icon={ArrowRight} title="情境迁移（简答题）" items={item.scenarioTransfer} onActivate={onActivate} onChange={(items) => onChange({ ...resource, layeredAssessment: { ...item, scenarioTransfer: items } })} />
        <EditableList icon={Star} title="创意表达（分析题·选做）" items={item.creativeExpression} onActivate={onActivate} onChange={(items) => onChange({ ...resource, layeredAssessment: { ...item, creativeExpression: items } })} />
      </div>
    );
  }
  if (tab === "diagnosis") {
    const d = resource.learningDiagnosisTemplate || { evaluationDimensions: [], dataSources: [], dataTracking: [], dataFormat: [], diagnosisRules: [], outputResults: [] };
    return (
      <div className="space-y-4">
        <EditableList icon={Gauge} title="评价维度" items={d.evaluationDimensions} onActivate={onActivate} onChange={(items) => onChange({ ...resource, learningDiagnosisTemplate: { ...d, evaluationDimensions: items } })} />
        <EditableList icon={Database} title="数据来源" items={d.dataSources} onActivate={onActivate} onChange={(items) => onChange({ ...resource, learningDiagnosisTemplate: { ...d, dataSources: items } })} />
        <EditableList icon={SlidersHorizontal} title="诊断规则" items={d.diagnosisRules} onActivate={onActivate} onChange={(items) => onChange({ ...resource, learningDiagnosisTemplate: { ...d, diagnosisRules: items } })} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="saas-card">
        <div className="saas-card-header">
          <FolderOpen className="h-4 w-4 shrink-0 text-[#d9826b]" />
          课堂材料
        </div>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-[#374151]">
          <li>情境材料：与课题相关的真实生活或校园数字情境。</li>
          <li>小组活动卡：记录任务、证据、分工和展示要求。</li>
          <li>展示评价表：关注完整性、准确性、可理解性和责任表达。</li>
        </ul>
      </div>
    </div>
  );
}

function EditableList({
  icon: Icon,
  items,
  onActivate,
  onChange,
  title
}: {
  icon?: React.ComponentType<{ className?: string }>;
  items: string[];
  onActivate?: (payload: { apply: (next: string) => void; label: string; value: string }) => void;
  onChange: (items: string[]) => void;
  title: string;
}) {
  const safeItems = Array.isArray(items) ? items.map((i) => (typeof i === "string" ? i : String(i))) : [];
  return (
    <div className="saas-card">
      <div className="saas-card-header">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#d9826b]" /> : <Circle className="h-2.5 w-2.5 shrink-0 fill-[#d9826b] text-[#d9826b]" />}
        {title}
      </div>
      {safeItems.map((item, index) => (
        <div key={`${title}-${index}`} className="saas-list-item">
          <span className="saas-list-num">{index + 1}</span>
          <EditableText
            title=""
            value={item}
            onActivate={onActivate ? ({ value, apply }) => onActivate({ label: `${title} · 第${index + 1}条`, value, apply }) : undefined}
            onChange={(value) => onChange(safeItems.map((old, i) => (i === index ? value : old)))}
          />
        </div>
      ))}
    </div>
  );
}

function EditableText({
  onActivate,
  onChange,
  title,
  value
}: {
  onActivate?: (payload: { apply: (next: string) => void; label: string; value: string }) => void;
  onChange: (value: string) => void;
  title: string;
  value: string;
}) {
  const safeValue = typeof value === "string" ? value : String(value);
  const [editing, setEditing] = useState(false);
  return (
    <div className="min-w-0 flex-1">
      {title && <p className="mb-1 text-xs font-medium text-[#9d9b98]">{title}</p>}
      {editing ? (
        <textarea
          autoFocus
          className="saas-editable-textarea w-full"
          onBlur={() => setEditing(false)}
          onFocus={() => onActivate?.({ label: title, value: safeValue, apply: onChange })}
          onChange={(e) => onChange(e.target.value)}
          value={safeValue}
        />
      ) : (
        <button
          className="saas-editable"
          onClick={() => {
            onActivate?.({ label: title, value: safeValue, apply: onChange });
            setEditing(true);
          }}
          type="button"
        >
          {safeValue}
        </button>
      )}
    </div>
  );
}

const procedureColumns = [
  { key: "keyQuestion" as const, label: "关键问题", w: "14%" },
  { key: "teacherActivity" as const, label: "教师活动", w: "30%" },
  { key: "studentActivity" as const, label: "学生活动", w: "25%" },
  { key: "designIntent" as const, label: "设计意图", w: "19%" },
];

function formatDuration(d: string): string {
  if (!d) return "";
  if (d.includes("分钟")) return d;
  if (/^\d+$/.test(d)) return d + "分钟";
  return d;
}

function ProcedureEditor({
  onActivate,
  onChange,
  procedures
}: {
  onActivate?: (payload: { apply: (next: string) => void; label: string; value: string }) => void;
  onChange: (items: TeachingProcedure[]) => void;
  procedures: TeachingProcedure[];
}) {
  const safeProcedures = Array.isArray(procedures) ? procedures : [];
  return (
    <div className="saas-card">
      <div className="saas-card-header">
        <GitBranch className="h-4 w-4 shrink-0 text-[#d9826b]" />
        教学流程
      </div>
      <div className="saas-table-wrap">
        <table className="saas-table">
          <colgroup>
            <col style={{ width: "11%" }} />
            {procedureColumns.map((c) => <col key={c.key} style={{ width: c.w }} />)}
          </colgroup>
          <thead>
            <tr>
              <th>教学环节</th>
              {procedureColumns.map((c) => <th key={c.key}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {safeProcedures.map((item, index) => (
              <tr key={`${item.phase}-${index}`}>
                <td>
                  <span className="cell-phase">{item.phase || `环节${index + 1}`}</span>
                  {item.duration ? <span className="cell-duration">{formatDuration(item.duration)}</span> : null}
                </td>
                {procedureColumns.map((c) => (
                  <td key={c.key}>
                    <TableCellEditor
                      initial={item[c.key] || ""}
                      onActivate={onActivate ? ({ value, apply }) => onActivate({ label: `${item.phase} · ${c.label}`, value, apply }) : undefined}
                      onChange={(value) => onChange(procedures.map((old, i) => (i === index ? { ...old, [c.key]: value } : old)))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableCellEditor({
  initial,
  onActivate,
  onChange
}: {
  initial: string;
  onActivate?: (payload: { apply: (next: string) => void; label: string; value: string }) => void;
  onChange: (value: string) => void;
}) {
  const safeInitial = typeof initial === "string" ? initial : String(initial);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(safeInitial);
  return editing ? (
    <textarea
      autoFocus
      className="cell-textarea"
      onBlur={() => { onChange(value); setEditing(false); }}
      onFocus={() => onActivate?.({ label: "", value: safeInitial, apply: onChange })}
      onChange={(e) => setValue(e.target.value)}
      value={value}
    />
  ) : (
    <button
      className="cell-editable"
      onClick={() => { onActivate?.({ label: "", value: safeInitial, apply: onChange }); setValue(safeInitial); setEditing(true); }}
      type="button"
    >
      {safeInitial || " "}
    </button>
  );
}

function ResourceCheckPage({ onNavigate }: { onNavigate: (id: PageId) => void }) {
  const source = loadResourceSource();
  const savedAt = localStorage.getItem(resourceSavedAtStorageKey) || "";
  const result = useMemo(() => (source.resource ? createCheckResult(source.resource, source.status) : null), [source.resource, source.status]);
  const [checkedAt, setCheckedAt] = useState("");
  const [checkNotice, setCheckNotice] = useState("");

  function saveCheck() {
    if (!result) return;
    const nextCheckedAt = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    localStorage.setItem(resourceCheckStorageKey, JSON.stringify({ ...result, resourceVersion: getCurrentResourceVersion(), checkedAt: nextCheckedAt }));
    setCheckedAt(nextCheckedAt);
    setCheckNotice(`检测结果已更新：${nextCheckedAt}`);
  }

  if (!source.resource || !result) {
    return <EmptyState title="请先进入备课工作台生成资源" text="资源检测需要读取已经生成的课堂资源包。" action="进入备课工作台" onAction={() => onNavigate("prep-workbench")} />;
  }

  return (
    <PageFrame
      title="资源检测"
      subtitle="把素养证据链和质量评估合在一起，帮助教师判断资源是否适合导出。"
      headerExtra={<LessonStatusBar need={source.resource.teachingNeed} status={checkedAt ? "已检测" : source.status} savedAt={savedAt} note={source.status === "教师确认版" ? "当前资源已定稿，可以进行正式检测。" : "当前资源尚未确认定稿，检测结果仅作为修改参考。"} />}
    >
      <section className="overflow-hidden rounded-xl border border-[#f2d8cf] bg-white shadow-[0_8px_24px_rgba(31,35,41,0.05)]">
        <div className="grid gap-5 bg-gradient-to-br from-[#fff8f4] to-white p-5 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
          <div className="flex items-center justify-center">
            <ScoreRing value={Math.round(result.confidence * 100)} label="总体置信度" />
          </div>
          <div>
            <StatusPill tone={result.canExport ? "green" : source.status === "教师确认版" ? "amber" : "red"}>
              {result.canExport ? "建议导出" : source.status === "教师确认版" ? "建议修改后导出" : "暂不建议正式导出"}
            </StatusPill>
            <h2 className="mt-3 text-2xl font-bold text-[#17191c]">{result.conclusion}</h2>
            <p className="mt-3 text-sm leading-6 text-[#6f706f]">
              这份体检报告优先帮你判断三件事：资源能不能导出、主要弱项在哪里、下一步应该怎么改。
            </p>
            {source.status !== "教师确认版" && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                当前还不是教师确认版，检测结果适合作为修改参考，不建议作为正式导出依据。
              </p>
            )}
          </div>
          <div className="rounded-lg border border-[#ebe7e2] bg-white p-4">
            <p className="text-xs text-[#9d9b98]">下一步建议</p>
            <p className="mt-2 text-lg font-semibold text-[#17191c]">{result.nextStep}</p>
            <button className="btn-primary mt-4 w-full" onClick={saveCheck} type="button">重新检测</button>
            {checkedAt && <p className="mt-2 text-xs text-[#bd6a56]">已重新检测：{checkedAt}</p>}
            {checkNotice && <p className="mt-2 text-xs text-[#bd6a56]">{checkNotice}</p>}
          </div>
        </div>
        <div className="grid gap-3 border-t border-[#edf0f3] p-4 md:grid-cols-3">
          <Metric label="资源状态" value={source.status} />
          <Metric label="是否建议导出" value={result.canExport ? "建议导出" : "建议修改"} />
          <Metric label="检测重点" value="证据链与可操作性" />
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#17191c]">质量体检指标</h2>
          <span className="text-sm text-[#9d9b98]">先看低分项，再回备课工作台修改</span>
        </div>
        {/* 质量总览 */}
        <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(() => {
            const avg = Math.round(result.quality.reduce((s, q) => s + q.score, 0) / result.quality.length);
            const green = result.quality.filter((q) => q.score >= 85).length;
            const amber = result.quality.filter((q) => q.score >= 75 && q.score < 85).length;
            const red = result.quality.filter((q) => q.score < 75).length;
            const weakest = result.quality.reduce((a, b) => (a.score < b.score ? a : b));
            return (
              <>
                <div className="rounded-lg border border-[#ebe7e2] bg-white p-3 text-center">
                  <p className="text-2xl font-bold text-[#17191c]">{avg}</p>
                  <p className="text-xs text-[#9d9b98]">平均分</p>
                </div>
                <div className="rounded-lg border border-[#ebe7e2] bg-white p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#d9826b]" />
                    <span className="text-lg font-bold text-[#17191c]">{green}</span>
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                    <span className="text-lg font-bold text-[#17191c]">{amber}</span>
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                    <span className="text-lg font-bold text-[#17191c]">{red}</span>
                  </div>
                  <p className="text-xs text-[#9d9b98]">绿 · 黄 · 红分布</p>
                </div>
                <div className="rounded-lg border border-[#ebe7e2] bg-white p-3 text-center col-span-2 sm:col-span-2">
                  <p className="text-sm font-semibold text-amber-600 truncate">⚠ 最需关注：{weakest.dimension}</p>
                  <p className="text-xs text-[#6f706f] mt-1 line-clamp-2">{weakest.risk}</p>
                </div>
              </>
            );
          })()}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {result.quality.map((item) => (
            <QualityCheckCard item={item} key={item.dimension} onEdit={() => onNavigate("prep-workbench")} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#17191c]">核心素养证据链</h2>
          <span className="text-sm text-[#9d9b98]">目标 → 活动 → 证据 → 评价</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
        {result.evidence.map((item) => (
          <EvidenceChainCard item={item} key={item.literacy} />
        ))}
        </div>
      </section>
      <PageActionBar
        primaryLabel="进入资源导出"
        onPrimary={() => { saveCheck(); onNavigate("export"); }}
        secondaryLabel="返回备课工作台修改"
        onSecondary={() => onNavigate("prep-workbench")}
        note={result.canExport ? "检测结果建议导出。进入导出页后可选择 Word、HTML 或 JSON。" : "建议根据体检报告先回到备课工作台修改，再正式导出。"}
      />
    </PageFrame>
  );
}

function ExportPage({ onNavigate }: { onNavigate: (id: PageId) => void }) {
  const source = loadResourceSource();
  const check = readCurrentResourceCheck();
  const [format, setFormat] = useState<"word" | "html" | "json">("word");
  const [exportedAt, setExportedAt] = useState(readCurrentExportedAt());

  if (!source.resource) {
    return <EmptyState title="还没有可导出的资源" text="请先进入备课工作台生成课堂资源包。" action="进入备课工作台" onAction={() => onNavigate("prep-workbench")} />;
  }
  const resource = source.resource;

  async function exportFile() {
    const safeName = resource.teachingNeed.topicName || "课堂资源包";
    if (format === "json") downloadBlob(new Blob([JSON.stringify(resource, null, 2)], { type: "application/json" }), `${safeName}.json`);
    if (format === "html") downloadBlob(new Blob([buildHtml(resource)], { type: "text/html;charset=utf-8" }), `${safeName}.html`);
    if (format === "word") downloadBlob(await buildDocx(resource), `${safeName}.docx`);
    const nextExportedAt = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    localStorage.setItem(resourceExportedAtStorageKey, JSON.stringify({ resourceVersion: getCurrentResourceVersion(), exportedAt: nextExportedAt }));
    setExportedAt(nextExportedAt);
  }

  return (
    <PageFrame
      title="资源导出"
      subtitle="导出 Word 教学文档、HTML 课堂页和 JSON 资源包。"
      headerExtra={(
        <LessonStatusBar
          need={resource.teachingNeed}
          status={exportedAt ? "已导出" : source.status}
          savedAt={localStorage.getItem(resourceSavedAtStorageKey) || ""}
          note={source.status === "教师确认版" ? "当前为教师确认版，可作为正式资源导出。" : "当前不是教师确认版，可以导出草稿，但建议先确认定稿。"}
        />
      )}
    >
      <section className="rounded-xl border border-[#ebe7e2] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">{resource.teachingNeed.topicName}</h2>
        <p className="mt-1 text-sm text-[#77736e]">{String(resource.teachingNeed.grade)}｜{resource.teachingNeed.courseModule}｜{source.status === "教师确认版" ? "正式导出" : "草稿导出"}</p>
        <p className="mt-3 rounded-md bg-[#fbfaf8] p-3 text-sm text-[#5f5e5c]">{check?.conclusion || "建议先完成资源检测，再进行正式导出。"}</p>
        {exportedAt && <p className="mt-3 rounded-md bg-[#fff8f4] p-3 text-sm text-[#bd6a56]">已导出：{exportedAt}。下一步可在学生端上传资源包进行课堂学习。</p>}
      </section>
      <section className="mt-5">
        <div className="flex rounded-2xl border border-[#ebe7e2] bg-white p-1.5 shadow-[0_8px_32px_rgba(50,42,36,0.05)]">
          {([
            ["word", "Word 教学文档", "正式教案结构，标题层级清楚。", FileText],
            ["html", "HTML 课堂页", "适合课堂展示或浏览器打开。", Monitor],
            ["json", "JSON 资源包", "保留完整结构化数据。", Braces]
          ] as const).map(([id, title, text, Icon]) => (
            <button
              className={`flex flex-1 items-center justify-center gap-3 rounded-xl px-5 py-4 transition-all duration-300 ${
                format === id
                  ? "bg-[#17191c] text-white shadow-[0_8px_24px_rgba(23,25,28,0.22)]"
                  : "text-[#77736e] hover:bg-[#fbfaf8] hover:text-[#17191c]"
              }`}
              key={id}
              onClick={() => setFormat(id)}
              type="button"
            >
              <Icon className={`h-6 w-6 shrink-0 mt-px ${format === id ? "text-white" : "text-[#9d9b98]"}`} />
              <div className="text-left">
                <p className="text-[15px] font-semibold leading-5">{title}</p>
                <p className={`mt-0.5 text-xs leading-4 ${format === id ? "text-[#a09b94]" : "text-[#9d9b98]"}`}>{text}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
      <Card title="导出内容预览" className="mt-5">
        <ol className="grid gap-2 text-sm text-[#5f5e5c] md:grid-cols-2">
          {["基本信息", "教学分析", "教学方法", "教学目标", "教学重点与难点", "教学流程", "学习任务单", "分层测评题", "学情诊断表", "核心素养证据链"].map((item, index) => <li key={item}>{index + 1}. {item}</li>)}
        </ol>
      </Card>
      <PageActionBar
        primaryLabel="导出所选格式"
        onPrimary={exportFile}
        secondaryLabel="进入资源检测"
        onSecondary={() => onNavigate("resource-check")}
        note={source.status === "教师确认版" ? "建议优先导出 Word 教学文档用于上课和提交。" : "当前为草稿导出，正式使用前建议回到备课工作台确认定稿。"}
      >
        <button className="btn-secondary" onClick={() => onNavigate("prep-workbench")} type="button">返回备课工作台</button>
      </PageActionBar>
    </PageFrame>
  );
}

function LearningProfilePage() {
  const [files, setFiles] = useState<Array<{ name: string; data: StudentData }>>([]);
  const analysis = useMemo(() => createClassAnalysis(files.map((item) => item.data)), [files]);

  async function upload(fileList: FileList | null) {
    if (!fileList) return;
    const loaded = await Promise.all(Array.from(fileList).map(async (file) => ({ name: file.name, data: JSON.parse(await file.text()) as StudentData })));
    setFiles((old) => [...old, ...loaded]);
  }

  function exportAnalysis() {
    downloadBlob(new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" }), "班级学情分析.json");
  }

  return (
    <PageFrame title="学情分析" subtitle="上传学生端学习数据，形成班级学情分析和教学改进建议。">
      <section className="panel-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-[#f2fbf7] to-white p-5">
          <div>
            <StatusPill tone={files.length > 0 ? "green" : "amber"}>{files.length > 0 ? "已读取学生数据" : "等待上传学生数据"}</StatusPill>
            <h2 className="mt-3 text-2xl font-bold text-[#17191c]">班级学情看板</h2>
            <p className="mt-2 text-sm leading-6 text-[#6f706f]">上传学生端导出的学习数据后，系统会汇总任务完成、测评表现、薄弱点和分层建议。</p>
          </div>
          <label className="btn-primary cursor-pointer">
            上传学生数据
            <input accept=".json,application/json" className="hidden" multiple onChange={(e) => upload(e.target.files)} type="file" />
          </label>
        </div>
        <div className="border-t border-[#edf0f3] px-5 py-3 text-sm text-[#6f706f]">
          已上传 <b className="text-[#17191c]">{files.length}</b> 份学生数据
        </div>
      </section>
      {files.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-[#d8d1ca] p-8 text-center text-[#77736e]">请先上传学生端导出的学习数据 JSON。</p>
      ) : (
        <div className="mt-5 space-y-5">
          <section className="grid gap-4 md:grid-cols-4">
            <Metric label="班级人数" value={`${analysis.count}人`} />
            <Metric label="任务完成率" value={`${analysis.taskRate}%`} />
            <Metric label="测评完成率" value={`${analysis.assessmentRate}%`} />
            <Metric label="主要薄弱点" value={analysis.weakPoint} />
          </section>
          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card title="班级整体表现">
              <div className="space-y-4">
                <ProgressBar label="学习任务完成" value={analysis.taskRate} />
                <ProgressBar label="测评完成表现" value={analysis.assessmentRate} />
                {analysis.issueBars.map((item) => <ProgressBar inverse key={item.label} label={item.label} value={item.value} />)}
              </div>
            </Card>
            <Card title="核心素养简要表现">
              <div className="grid gap-3 sm:grid-cols-2">
                {analysis.literacy.map((item) => (
                  <div className="rounded-lg border border-[#edf0f3] bg-[#fbfaf8] p-3" key={item.name}>
                    <p className="font-semibold text-[#17191c]">{item.name}</p>
                    <p className="mt-2 text-sm leading-6 text-[#6f706f]">{item.comment}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>
          <section className="grid gap-5 lg:grid-cols-3">
            <StudentGroupCard title="稳定掌握组" tone="green" names={analysis.groups.strong} text="可安排展示、迁移表达或同伴支持任务。" />
            <StudentGroupCard title="需要支架组" tone="amber" names={analysis.groups.support} text="建议提供流程图模板、句式支架或同伴协助。" />
            <StudentGroupCard title="继续观察组" tone="gray" names={analysis.groups.watch} text="课堂中重点观察任务记录和追问回答。" />
          </section>
          <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Card title="薄弱点优先级">
              <div className="space-y-3">
                {analysis.weaknessRank.map((item, index) => (
                  <div className="flex items-center gap-3 rounded-lg border border-[#edf0f3] bg-[#fbfaf8] p-3" key={item.label}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#fbeee8] text-sm font-bold text-[#bd6a56]">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#17191c]">{item.label}</p>
                      <ProgressBar compact value={item.value} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="教学改进建议">
              <div className="space-y-3">
                {analysis.suggestions.map((item) => (
                  <div className="rounded-lg border border-[#f2d8cf] bg-[#fff8f4] p-3 text-sm leading-6 text-[#8f5748]" key={item}>{item}</div>
                ))}
              </div>
            </Card>
          </section>
          <button className="btn-primary" onClick={exportAnalysis} type="button">导出分析结果</button>
        </div>
      )}
    </PageFrame>
  );
}

function CasesPage({ onNavigate }: { onNavigate: (id: PageId) => void }) {
  return (
    <PageFrame title="精品案例" subtitle="载入完整样例课例，快速体验全流程。">
      <div className="grid gap-5 md:grid-cols-2">
        {/* 案例一：数据分包灵活传 */}
          <div className="rounded-xl border border-[#ebe7e2] bg-white shadow-[0_2px_8px_rgba(31,35,41,0.06)] overflow-hidden">
          <div className="bg-gradient-to-r from-[#fff8f4] to-[#fef2e2] px-5 py-4 border-b border-[#f2d8cf]">
            <span className="text-xs font-semibold text-[#bd6a56] bg-white/80 rounded-md px-2 py-0.5">七年级 · 互联网应用与创新</span>
            <h3 className="mt-2 text-lg font-bold text-[#17191c]">《数据分包灵活传》</h3>
            <p className="mt-1 text-sm text-[#6f706f]">课型：新知建构课 ｜ 1课时</p>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <p className="text-xs font-semibold text-[#9d9b98] uppercase">核心问题</p>
              <p className="mt-1 text-sm leading-6 text-[#17191c]">互联网上的视频、图片、文件是如何从服务器到达我们设备的？数据在传输过程中经历了什么？</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9d9b98] uppercase">教学流程</p>
              <p className="mt-1 text-sm leading-6 text-[#6f706f]">真实情境（快递包裹运输视频）→ 问题分解（大文件如何传输）→ 原理探究（存储转发与分包策略）→ 模型建构（数据包编号与重组流程）→ 体系建构（TCP/IP 分层思想）→ 迁移应用（生活中还有哪些系统用类似思路）</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9d9b98] uppercase">核心素养聚焦</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {["信息意识：从网络使用中发现数据传输问题", "计算思维：理解存储转发与分包重组的算法逻辑", "数字化学习与创新：用流程图表达数据传输过程", "信息社会责任：讨论数据传输中的隐私保护"].map((s) => (
                  <span className="rounded-md bg-[#f7f8fa] px-2 py-1 text-xs text-[#4e5969]" key={s}>{s}</span>
                ))}
              </div>
            </div>
            <button className="mt-3 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition" onClick={() => loadSampleLesson(onNavigate)} type="button">
              载入此案例并生成资源包
            </button>
          </div>
        </div>

        {/* 案例二：智能浇花小管家 */}
        <div className="rounded-xl border border-[#ebe7e2] bg-white shadow-[0_2px_8px_rgba(31,35,41,0.06)] overflow-hidden">
          <div className="bg-gradient-to-r from-[#e8f0ff] to-[#f4f7fd] px-5 py-4 border-b border-[#dce4f5]">
            <span className="text-xs font-semibold text-[#2e5db7] bg-white/80 rounded-md px-2 py-0.5">八年级 · 物联网实践与探索</span>
            <h3 className="mt-2 text-lg font-bold text-[#17191c]">《智能浇花小管家》</h3>
            <p className="mt-1 text-sm text-[#6f706f]">课型：项目实践课 ｜ 2课时</p>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <p className="text-xs font-semibold text-[#9d9b98] uppercase">核心问题</p>
              <p className="mt-1 text-sm leading-6 text-[#17191c]">校园绿植假期无人照料怎么办？能否用物联网传感器、控制器和反馈机制，设计一套自动浇花系统？</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9d9b98] uppercase">教学流程</p>
              <p className="mt-1 text-sm leading-6 text-[#6f706f]">问题驱动（假期绿植干枯问题）→ 需求分析（土壤湿度检测 + 自动浇水）→ 方案设计（传感器选型、控制逻辑、反馈机制）→ 迭代优化（测试与调试）→ 成果展示（小组展示物联浇花方案）→ 反思评价（技术局限与改进方向）</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#9d9b98] uppercase">核心素养聚焦</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {["信息意识：从真实校园问题中发现物联需求", "计算思维：设计自动灌溉的控制算法与条件判断", "数字化学习与创新：搭建传感器+执行器的原型系统", "信息社会责任：讨论物联设备的安全使用与数据保护"].map((s) => (
                  <span className="rounded-md bg-[#f7f8fa] px-2 py-1 text-xs text-[#4e5969]" key={s}>{s}</span>
                ))}
              </div>
            </div>
            <button className="mt-3 w-full rounded-lg bg-[#2e5db7] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#254d9e] transition" onClick={() => loadSampleLesson2(onNavigate)} type="button">
              载入此案例并生成资源包
            </button>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

function GuideLibraryPage() {
  const [entries, setEntries] = useState<GuideBasisEntry[]>(() => loadGuideLibrary());
  const [search, setSearch] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<GuideBasisEntry>(() => createEmptyGuideEntry());
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const filtered = entries.filter((item) => {
    const text = `${item.lessonTitle} ${item.grade} ${item.module} ${item.keywords.join(" ")}`;
    return !search.trim() || text.includes(search.trim());
  });
  const groupedEntries = groupGuideEntries(filtered);

  function saveEntries(next: GuideBasisEntry[], message: string) {
    setEntries(next);
    localStorage.setItem(guideLibraryStorageKey, JSON.stringify(next));
    setNotice(message);
  }

  function importFromText() {
    const result = parseGuideJsonEntries(jsonText);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    const nextEntries = result.entries;
    saveEntries(mergeGuideEntries(entries, nextEntries), `已导入 ${nextEntries.length} 条课程数据。`);
    setJsonText("");
  }

  async function importFromFiles(fileList: FileList | null) {
    if (!fileList) return;
    const imported: GuideBasisEntry[] = [];
    for (const file of Array.from(fileList)) {
      const text = await file.text();
      const parsed = file.name.endsWith(".json") ? parseGuideJsonEntries(text) : { entries: parseGuideTextEntry(text, file.name), ok: true as const };
      if (parsed.ok) imported.push(...parsed.entries);
    }
    if (imported.length === 0) {
      setNotice("没有识别到可导入的依据条目。建议优先上传结构化 JSON。");
      return;
    }
    saveEntries(mergeGuideEntries(entries, imported), `已从文件导入 ${imported.length} 条课程数据。`);
  }

  function addManualEntry() {
    if (!form.lessonTitle.trim()) {
      setNotice("请先填写课题名称。");
      return;
    }
    saveEntries(mergeGuideEntries(entries, [normalizeGuideEntry(form)]), `已保存《${form.lessonTitle}》课程数据。`);
    setForm(createEmptyGuideEntry());
  }

  function removeEntry(id: string) {
    saveEntries(entries.filter((item) => item.id !== id), "已删除该课程数据。");
  }

  function resetDefault() {
    if (!window.confirm("确定恢复内置数据库吗？这会保留你已导入的其他条目。")) return;
    saveEntries(mergeGuideEntries(entries, defaultGuideLibrary), "已恢复内置课程数据。");
  }

  function isGroupOpen(groupKey: string, index: number) {
    if (search.trim()) return true;
    return openGroups[groupKey] ?? index === 0;
  }

  function toggleGroup(groupKey: string) {
    setOpenGroups((old) => ({ ...old, [groupKey]: !(old[groupKey] ?? false) }));
  }

  return (
    <PageFrame title="课程数据库" subtitle="导入或维护《教学指南》等课时数据，供 AI 生成教学目标和资源时优先引用。">
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          <Card title="已导入数据">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input className="input max-w-md" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索课题、模块或关键词" />
              <button className="btn-secondary" onClick={resetDefault} type="button">恢复内置数据</button>
              <button className="btn-secondary" onClick={() => downloadBlob(new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" }), "课链智教课程数据库.json")} type="button">导出数据库</button>
            </div>
            {notice && <p className="mb-3 rounded-md bg-[#fff8f4] px-3 py-2 text-sm text-[#8f5748]">{notice}</p>}
            <div className="space-y-3">
              {groupedEntries.map((group, index) => {
                const open = isGroupOpen(group.key, index);
                return (
                  <div className="overflow-hidden rounded-lg border border-[#ebe7e2] bg-white" key={group.key}>
                    <button className="flex w-full items-center justify-between bg-[#fbfaf8] px-4 py-3 text-left hover:bg-[#f7f8fa]" onClick={() => toggleGroup(group.key)} type="button">
                      <div>
                        <p className="font-semibold text-[#17191c]">{group.grade}｜{group.module}</p>
                        <p className="mt-1 text-xs text-[#9d9b98]">{group.items.length} 个课时依据</p>
                      </div>
                      <span className="rounded-md bg-white px-2 py-1 text-xs text-[#6f706f]">{open ? "收起" : "展开"}</span>
                    </button>
                    {open && (
                      <div className="grid gap-3 border-t border-[#edf0f3] p-3">
                        {group.items.map((item) => (
                          <div className="rounded-lg border border-[#edf0f3] bg-white p-4" key={item.id}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h2 className="font-semibold text-[#17191c]">《{item.lessonTitle}》</h2>
                                <p className="mt-1 text-sm text-[#6f706f]">{item.source}</p>
                              </div>
                              <button className="rounded-md border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50" onClick={() => removeEntry(item.id)} type="button">删除</button>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <MiniList title="学习目标" items={item.learningObjectives} />
                              <MiniList title="教学重难点" items={[...item.keyPoints, ...item.difficultPoints]} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.keywords.map((keyword) => <span className="rounded-md bg-[#f7f8fa] px-2 py-1 text-xs text-[#6f706f]" key={keyword}>{keyword}</span>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="rounded-lg border border-dashed border-[#d8dbe0] p-8 text-center text-[#9d9b98]">没有找到匹配的依据条目。</p>}
            </div>
          </Card>

          <Card title="粘贴 JSON 导入">
            <textarea className="input min-h-44 font-mono text-xs" value={jsonText} onChange={(event) => setJsonText(event.target.value)} placeholder='支持单条对象或数组，例如 [{"lessonTitle":"探秘网页与代码","learningObjectives":["..."]}]' />
            <div className="mt-3 flex flex-wrap gap-3">
              <button className="btn-primary" onClick={importFromText} type="button">导入 JSON</button>
              <label className="btn-secondary cursor-pointer">
                上传 JSON / TXT / MD
                <input accept=".json,.txt,.md,application/json,text/plain" className="hidden" multiple onChange={(event) => importFromFiles(event.target.files)} type="file" />
              </label>
            </div>
          </Card>
        </section>

        <aside className="sticky top-6 h-fit space-y-5">
          <Card title="手动新增课时依据">
            <div className="space-y-3">
              <Field label="课题名称"><input className="input" value={form.lessonTitle} onChange={(event) => setForm({ ...form, lessonTitle: event.target.value })} /></Field>
              <Field label="年级"><input className="input" value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} /></Field>
              <Field label="课程模块"><input className="input" value={form.module} onChange={(event) => setForm({ ...form, module: event.target.value })} /></Field>
              <Field label="关键词（用顿号或逗号分隔）"><input className="input" value={form.keywords.join("、")} onChange={(event) => setForm({ ...form, keywords: splitLines(event.target.value) })} /></Field>
              <Field label="学习目标（一行一个）"><textarea className="input min-h-24" value={form.learningObjectives.join("\n")} onChange={(event) => setForm({ ...form, learningObjectives: splitLines(event.target.value) })} /></Field>
              <Field label="教学重点（一行一个）"><textarea className="input min-h-20" value={form.keyPoints.join("\n")} onChange={(event) => setForm({ ...form, keyPoints: splitLines(event.target.value) })} /></Field>
              <Field label="教学难点（一行一个）"><textarea className="input min-h-20" value={form.difficultPoints.join("\n")} onChange={(event) => setForm({ ...form, difficultPoints: splitLines(event.target.value) })} /></Field>
              <Field label="建议活动（一行一个）"><textarea className="input min-h-20" value={form.suggestedActivities.join("\n")} onChange={(event) => setForm({ ...form, suggestedActivities: splitLines(event.target.value) })} /></Field>
              <button className="btn-primary w-full" onClick={addManualEntry} type="button">保存到数据库</button>
            </div>
          </Card>
        </aside>
      </div>
    </PageFrame>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState<LocalSettings>(() => loadLocalSettings());
  const [savedAt, setSavedAt] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);

  function update<K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) {
    setSettings((old) => ({ ...old, [key]: value }));
  }

  function togglePreference(value: string) {
    setSettings((old) => ({
      ...old,
      teachingPreferences: old.teachingPreferences.includes(value)
        ? old.teachingPreferences.filter((item) => item !== value)
        : [...old.teachingPreferences, value]
    }));
  }

  function saveSettings() {
    localStorage.setItem(localSettingsStorageKey, JSON.stringify(settings));
    setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
  }

  async function testAiConnection() {
    setTesting(true);
    setTestResult("正在测试模型连接...");
    try {
      const response = await fetch(`${apiBaseUrl}/api/ai/test-connection`, {
        body: JSON.stringify({ aiConfig: buildAiConfig(settings) }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const data = (await response.json().catch(() => null)) as { detail?: string; error?: string; message?: string; model?: string } | null;
      setTestResult(response.ok ? `连接成功：${data?.model || settings.aiModel}` : `连接失败：${data?.error || "请检查密钥和模型地址"}${data?.detail ? `（${data.detail}）` : ""}`);
    } catch {
      setTestResult("连接失败：请确认后端服务已启动。");
    } finally {
      setTesting(false);
    }
  }

  function clearCurrentLesson() {
    if (!window.confirm("确定清空当前课例、资源、检测和导出记录吗？系统设置会保留。")) return;
    clearResourceLifecycle();
    localStorage.removeItem(teachingNeedStorageKey);
    setTestResult("已清空当前课例和资源数据。");
  }

  function exportSettings() {
    downloadBlob(new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" }), "课链智教本机设置.json");
  }

  return (
    <PageFrame title="系统设置" subtitle="配置本机 AI 生成、教师常用信息和默认备课偏好。">
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <section className="space-y-5">
          <Card title="AI 模型设置">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="模型服务地址">
                <input className="input" value={settings.aiBaseUrl} onChange={(event) => update("aiBaseUrl", event.target.value)} placeholder="https://api.deepseek.com/v1" />
              </Field>
              <Field label="模型名称">
                <input className="input" value={settings.aiModel} onChange={(event) => update("aiModel", event.target.value)} placeholder="deepseek-v4-flash" />
              </Field>
              <Field label="API Key">
                <input className="input" type="password" value={settings.aiApiKey} onChange={(event) => update("aiApiKey", event.target.value)} placeholder="仅保存在本机浏览器" />
              </Field>
              <div className="flex items-end gap-2">
                <button className="btn-secondary" disabled={testing} onClick={testAiConnection} type="button">{testing ? "测试中..." : "测试连接"}</button>
                {testResult && <span className="text-sm text-[#6f706f]">{testResult}</span>}
              </div>
            </div>
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              说明：本页密钥只用于本机调试，会保存在浏览器 localStorage。正式部署建议改为服务端环境变量或学校内网密钥管理。
            </p>
          </Card>

          <Card title="教师资料">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="教师姓名">
                <input className="input" value={settings.teacherName} onChange={(event) => update("teacherName", event.target.value)} placeholder="用于导出文档署名，可不填" />
              </Field>
              <Field label="默认年级">
                <select className="input" value={String(settings.defaultGrade)} onChange={(event) => update("defaultGrade", event.target.value as Grade)}>
                  {["七年级", "八年级", "九年级"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="默认课时">
                <input className="input" value={settings.defaultClassHours} onChange={(event) => update("defaultClassHours", event.target.value)} />
              </Field>
            </div>
          </Card>

          <Card title="默认备课偏好">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="默认课堂类型">
                <select className="input" value={String(settings.defaultLessonType)} onChange={(event) => update("defaultLessonType", event.target.value as LessonType)}>
                  {lessonTypes.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="默认生成范围">
                <select className="input" value={String(settings.defaultGenerationScope)} onChange={(event) => update("defaultGenerationScope", event.target.value as GenerationScope)}>
                  {["只生成教学设计", "生成完整课堂资源包"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-[#4b4b4c]">常用教学偏好</p>
              <div className="flex flex-wrap gap-2">
                {promptTemplates.map((item) => (
                  <button
                    className={`rounded-md border px-3 py-1.5 text-sm ${settings.teachingPreferences.includes(item) ? "border-[#d9826b] bg-[#fbeee8] text-[#bd6a56]" : "border-[#dee3e8] bg-white text-[#6f706f]"}`}
                    key={item}
                    onClick={() => togglePreference(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <Field label="默认机房或设备条件">
              <textarea className="input mt-2 min-h-24" value={settings.defaultEquipmentCondition} onChange={(event) => update("defaultEquipmentCondition", event.target.value)} />
            </Field>
          </Card>

          <Card title="导出与学生端">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Word 文档风格">
                <select className="input" value={settings.exportStyle} onChange={(event) => update("exportStyle", event.target.value as LocalSettings["exportStyle"])}>
                  {["简洁教案版", "教研展示版", "比赛提交版"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="学生信息填写">
                <select className="input" value={settings.defaultStudentRequirement} onChange={(event) => update("defaultStudentRequirement", event.target.value as LocalSettings["defaultStudentRequirement"])}>
                  <option value="required">要求填写班级、姓名、学号</option>
                  <option value="optional">允许暂不填写</option>
                </select>
              </Field>
            </div>
          </Card>

          <PageActionBar primaryLabel="保存设置" onPrimary={saveSettings} note={savedAt ? `设置已保存：${savedAt}` : "设置只保存在本机浏览器，用于本地演示和个人备课。"}>
            <button className="btn-secondary" onClick={exportSettings} type="button">导出设置</button>
          </PageActionBar>
        </section>

        <aside className="sticky top-6 h-fit space-y-5">
          <Card title="当前配置状态">
            <InfoRows rows={[
              ["AI 模型", settings.aiModel || "未填写"],
              ["密钥状态", settings.aiApiKey ? "已填写" : "未填写"],
              ["默认年级", String(settings.defaultGrade)],
              ["默认课型", String(settings.defaultLessonType)],
              ["教师姓名", settings.teacherName || "未填写"]
            ]} />
          </Card>
          <Card title="本地数据管理">
            <div className="space-y-3">
              <button className="btn-secondary w-full" onClick={clearCurrentLesson} type="button">清空当前课例与资源</button>
              <button className="btn-secondary w-full" onClick={() => {
                if (!window.confirm("确定恢复系统设置默认值吗？")) return;
                setSettings(defaultLocalSettings);
                localStorage.setItem(localSettingsStorageKey, JSON.stringify(defaultLocalSettings));
                setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
              }} type="button">恢复默认设置</button>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#9d9b98]">清空课例不会删除系统设置；恢复默认设置不会删除已生成资源。</p>
          </Card>
        </aside>
      </div>
    </PageFrame>
  );
}

function LessonStatusBar({ need, note, savedAt, status }: { need: TeachingNeed; note?: string; savedAt?: string; status: string }) {
  return (
    <div
      className="flex max-w-[560px] flex-wrap items-center justify-end gap-2 rounded-lg border border-[#ebe7e2] bg-white/90 px-3 py-2 text-xs text-[#6f706f] shadow-[0_1px_2px_rgba(31,35,41,0.04)]"
      title={note || `${need.courseModule || ""} ${String(need.lessonType || "")}`}
    >
      <span className="status-chip">{status}</span>
      <strong className="max-w-[220px] truncate text-[#17191c]">《{need.topicName || "未命名课例"}》</strong>
      {savedAt && <span className="rounded-md bg-[#f7f8fa] px-2 py-1">保存 {savedAt}</span>}
    </div>
  );
}

function PageActionBar({
  children,
  note,
  onPrimary,
  onSecondary,
  primaryLabel,
  secondaryLabel
}: {
  children?: ReactNode;
  note: string;
  onPrimary: () => void | Promise<void>;
  onSecondary?: () => void;
  primaryLabel: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce3ea] bg-white/95 p-4 shadow-[0_-8px_24px_rgba(31,35,41,0.06)] backdrop-blur">
      <span className="text-sm leading-6 text-[#6f706f]">{note}</span>
      <div className="flex flex-wrap gap-3">
        {children}
        {secondaryLabel && onSecondary && <button className="btn-secondary" onClick={onSecondary} type="button">{secondaryLabel}</button>}
        <button className="btn-primary" onClick={onPrimary} type="button">{primaryLabel}</button>
      </div>
    </div>
  );
}

function PageFrame({ children, headerExtra, subtitle, title }: { children: ReactNode; headerExtra?: ReactNode; subtitle: string; title: string }) {
  return (
    <div className="mx-auto max-w-[1320px]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#ebe7e2] pb-4">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-[#d9826b]">课链智教</p>
          <h1 className="text-[23px] font-semibold tracking-tight text-[#17191c]">{title}</h1>
          <p className="mt-1.5 text-sm text-[#6f706f]">{subtitle}</p>
        </div>
        {headerExtra}
      </header>
      {children}
    </div>
  );
}

function Card({ action, children, className = "", title }: { action?: ReactNode; children: ReactNode; className?: string; title: string }) {
  return (
    <section className={`panel-card p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[#17191c]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ children, error, label, required }: { children: ReactNode; error?: string; label: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#4b4b4c]">{label}{required && <span className="ml-1 text-[#d9826b]">*</span>}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#bd6a56]">{error}</span>}
    </label>
  );
}

function EmptyState({ action, onAction, text, title }: { action: string; onAction: () => void; text: string; title: string }) {
  return (
    <div className="panel-card border-dashed border-[#d8dbe0] p-10 text-center">
      <h2 className="text-xl font-semibold text-[#17191c]">{title}</h2>
      <p className="mt-2 text-[#6f706f]">{text}</p>
      <button className="btn-primary mt-5" onClick={onAction} type="button">{action}</button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-card p-4">
      <p className="text-xs text-[#77736e]">{label}</p>
      <p className="mt-2 text-lg font-bold text-[#17191c]">{value}</p>
    </div>
  );
}

function ScoreRing({ label, value }: { label: string; value: number }) {
  const angle = Math.max(0, Math.min(100, value)) * 3.6;
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="grid h-36 w-36 place-items-center rounded-full"
        style={{ background: `conic-gradient(#d9826b ${angle}deg, #e8edf2 ${angle}deg)` }}
      >
        <div className="grid h-28 w-28 place-items-center rounded-full bg-white shadow-inner">
          <div className="text-center">
            <p className="text-3xl font-bold text-[#17191c]">{value}%</p>
            <p className="text-xs text-[#9d9b98]">{label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "amber" | "red" | "gray" }) {
  const styles = {
    green: "border-[#f2d8cf] bg-[#fff8f4] text-[#bd6a56]",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-rose-200 bg-rose-50 text-rose-700",
    gray: "border-[#ebe7e2] bg-[#f7f8fa] text-[#6f706f]"
  };
  return <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}

function scoreTone(score: number): "green" | "amber" | "red" {
  if (score >= 85) return "green";
  if (score >= 75) return "amber";
  return "red";
}

function QualityCheckCard({
  item,
  onEdit
}: {
  item: { dimension: string; evidence: string; risk: string; score: number; suggestion: string };
  onEdit: () => void;
}) {
  const tone = scoreTone(item.score);
  const color = tone === "green" ? "#d9826b" : tone === "amber" ? "#f59e0b" : "#ef4444";
  const bg = tone === "green" ? "bg-[#fff8f4]" : tone === "amber" ? "bg-[#fef7e6]" : "bg-[#fef2f2]";
  const border = tone === "green" ? "border-[#f2d8cf]" : tone === "amber" ? "border-amber-200" : "border-rose-200";
  return (
    <div className="rounded-xl border border-[#ebe7e2] bg-white shadow-[0_1px_2px_rgba(31,35,41,0.04)] overflow-hidden">
      {/* 顶部：得分 + 维度名 */}
      <div className="flex items-center gap-4 p-4">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 ${border} ${bg}`}>
          <span className="text-2xl font-bold" style={{ color }}>{item.score}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-[#17191c]">{item.dimension}</p>
          <ProgressBar compact value={item.score} />
          <p className="mt-1 text-xs text-[#9d9b98] truncate">{item.evidence}</p>
        </div>
      </div>
      {/* 底部：风险 + 建议 */}
      <div className="border-t border-[#edf0f3] grid grid-cols-1 sm:grid-cols-2">
        <div className="p-3 border-b sm:border-b-0 sm:border-r border-[#edf0f3]">
          <p className="text-xs font-semibold text-amber-600 mb-1">⚠ 风险</p>
          <p className="text-xs leading-5 text-[#6f706f]">{item.risk}</p>
        </div>
        <div className="p-3">
          <p className="text-xs font-semibold text-[#bd6a56] mb-1">✦ 怎么改</p>
          <p className="text-xs leading-5 text-[#6f706f]">{item.suggestion}</p>
        </div>
      </div>
      <div className="border-t border-[#edf0f3] px-4 py-2.5 flex justify-end">
        <button className="text-xs font-semibold text-[#bd6a56] hover:text-[#8f5748]" onClick={onEdit} type="button">
          去备课工作台修改 →
        </button>
      </div>
    </div>
  );
}

function EvidenceChainCard({
  item
}: {
  item: { activity: string; assessmentEvidence: string; evaluation: string; goal: string; literacy: string; status: string; suggestion: string; taskEvidence: string };
}) {
  const nodes = [
    ["目标", item.goal],
    ["活动", item.activity],
    ["任务证据", item.taskEvidence],
    ["测评证据", item.assessmentEvidence],
    ["评价", item.evaluation]
  ];
  return (
    <div className="rounded-xl border border-[#ebe7e2] bg-white p-4 shadow-[0_1px_2px_rgba(31,35,41,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-lg font-bold text-[#17191c]">{item.literacy}</p>
        <StatusPill tone={item.status.includes("缺") ? "red" : item.status.includes("弱") ? "amber" : "green"}>{item.status || "完整"}</StatusPill>
      </div>
      <div className="space-y-2">
        {nodes.map(([label, value], index) => (
          <div className="grid grid-cols-[70px_minmax(0,1fr)] gap-3" key={label}>
            <div className="flex flex-col items-center">
              <span className="rounded-md bg-[#fff8f4] px-2 py-1 text-xs font-semibold text-[#bd6a56]">{label}</span>
              {index < nodes.length - 1 && <span className="my-1 h-5 w-px bg-[#f2d8cf]" />}
            </div>
            <p className="rounded-md bg-[#fbfaf8] px-3 py-2 text-sm leading-6 text-[#4e5969]">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-md bg-[#fff8f4] px-3 py-2 text-sm leading-6 text-[#8f5748]">优化建议：{item.suggestion}</p>
    </div>
  );
}

function ProgressBar({ compact = false, inverse = false, label, value }: { compact?: boolean; inverse?: boolean; label?: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const color = inverse ? (safeValue >= 60 ? "#d9826b" : "#f59e0b") : safeValue >= 80 ? "#d9826b" : safeValue >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className={compact ? "mt-2" : ""}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-[#4e5969]">{label}</span>
          <span className="font-semibold text-[#17191c]">{safeValue}%</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-[#eef1f4]">
        <div className="h-full rounded-full transition-all" style={{ width: `${safeValue}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function StudentGroupCard({ names, text, title, tone }: { names: string[]; text: string; title: string; tone: "green" | "amber" | "gray" }) {
  return (
    <div className="rounded-xl border border-[#ebe7e2] bg-white p-4 shadow-[0_1px_2px_rgba(31,35,41,0.04)]">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-[#17191c]">{title}</p>
        <StatusPill tone={tone}>{names.length}人</StatusPill>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#6f706f]">{text}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(names.length ? names : ["暂无"]).map((name) => (
          <span className="rounded-md border border-[#edf0f3] bg-[#fbfaf8] px-2 py-1 text-xs text-[#6f706f]" key={name}>{name}</span>
        ))}
      </div>
    </div>
  );
}

function MiniList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-md bg-[#fbfaf8] p-3">
      <p className="text-xs font-semibold text-[#9d9b98]">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#4e5969]">
        {items.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
        {items.length === 0 && <li>未填写</li>}
      </ul>
    </div>
  );
}

function InfoRows({ rows }: { rows: string[][] }) {
  return (
    <dl className="space-y-3 text-sm leading-6">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="font-semibold text-[#4b4b4c]">{label}</dt>
          <dd className="text-[#5f5e5c]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function loadTeachingNeed(): TeachingNeed {
  const saved = readJson<TeachingNeed>(teachingNeedStorageKey);
  const settings = loadLocalSettings();
  const preferenceText = settings.teachingPreferences
    .map((item) => templateText[item])
    .filter(Boolean)
    .join("\n");
  return saved ?? {
    topicName: "",
    grade: settings.defaultGrade,
    courseModule: defaultModuleByGrade[String(settings.defaultGrade)],
    classHours: settings.defaultClassHours,
    studentFoundation: "",
    equipmentCondition: settings.defaultEquipmentCondition,
    teachingObjectives: "",
    teachingFocus: "",
    teachingDifficulty: "",
    lessonType: settings.defaultLessonType,
    generationScope: settings.defaultGenerationScope,
    additionalNeeds: preferenceText,
    updatedAt: new Date().toISOString()
  };
}

function validateNeed(need: TeachingNeed) {
  const result: Record<string, string> = {};
  if (!need.topicName.trim()) result.topicName = "请先写下本节课的课题。";
  if (!need.courseModule.trim()) result.courseModule = "请填写课程模块。";
  if (!need.classHours.trim()) result.classHours = "请填写课时数。";
  if (!need.studentFoundation.trim()) result.studentFoundation = "请从认知基础、能力水平、学习特征、心理与态度四个维度描述学生基础。";
  if (!need.equipmentCondition.trim()) result.equipmentCondition = "请写明机房或设备条件。";
  return result;
}

function validateNeedStepOne(need: TeachingNeed) {
  const result = validateNeed(need);
  return compactErrors({
    topicName: result.topicName,
    courseModule: result.courseModule,
    classHours: result.classHours,
    studentFoundation: result.studentFoundation,
    equipmentCondition: result.equipmentCondition
  });
}

function compactErrors(errors: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => Boolean(value))) as Record<string, string>;
}

function suggestNeedContext(need: TeachingNeed): TeachingNeed {
  const isGrade7 = String(need.grade) === "七年级";
  const isGrade8 = String(need.grade) === "八年级";

  // 按教育理论四维度分析学情
  const cognitives = isGrade7
    ? "学生能熟练使用手机、平板等日常数字工具，但对数据如何传输、网络如何连接的底层过程缺乏系统认识。"
    : isGrade8
    ? "学生已了解互联网基本概念，有一定的信息搜索和处理经验，但对物联网的感知层、传输层、应用层三层架构尚未建立完整认识。"
    : "学生已具备互联网和物联网的基础知识，有一定的数字化项目操作经验，但对人工智能的原理、数据驱动决策的过程理解较浅。";

  const skills = isGrade7
    ? "能使用浏览器访问网页、搜索信息；部分学生能制作简单图文文档；多数学生缺乏流程图绘制和过程性表达的训练。"
    : isGrade8
    ? "能使用常用办公软件和在线工具；部分学生有简单的编程或图形化编程经验；多数学生需要支架辅助才能完成抽象概念的具象化表达。"
    : "能独立完成信息搜索和处理；多数学生能进行简单的数据分析和图表制作；部分学生在逻辑推理和抽象建模方面需要更多引导。";

  const learnStyle = isGrade7
    ? "偏好直观、动手操作的学习方式；对真实情境中的问题有好奇心，但持续注意力约10-15分钟；小组合作中需要明确分工引导。"
    : isGrade8
    ? "喜欢通过对比、案例讨论进行学习；能在有范本的情况下模仿操作；对技术如何改变生活有较强的探究兴趣。"
    : "喜欢挑战开放性问题，但面对复杂任务时容易焦虑；适合项目式学习和自主探究，需要教师适度放手和适时引导。";

  const attitudes = isGrade7
    ? "对信息技术课普遍感兴趣，但容易将其等同于「玩电脑」；信息安全和个人隐私保护意识较弱；需要在本课中强化信息责任的意识。"
    : isGrade8
    ? "对智能设备和技术应用有较强好奇心；有初步的网络安全和信息保护意识，但自觉遵守规范的意识不够稳定。"
    : "对人工智能等前沿技术有强烈兴趣，但部分学生可能因难度产生畏难情绪；具备基本的信息社会责任感，能在讨论中表达自己的观点。";

  const foundation = [
    `【认知基础】${cognitives}`,
    `【能力水平】${skills}`,
    `【学习特征】${learnStyle}`,
    `【心理与态度】${attitudes}`,
  ].join("\n");

  return {
    ...need,
    studentFoundation: need.studentFoundation || foundation,
    equipmentCondition: need.equipmentCondition || "机房网络稳定，2人一机；教师机可投屏并支持分组展示与即时点评。",
    additionalNeeds: need.additionalNeeds || "希望课堂中强化小组协作、过程证据留存和课堂即时反馈。",
    updatedAt: new Date().toISOString()
  };
}

function fillDesignPoints(need: TeachingNeed): TeachingNeed {
  const topic = need.topicName || "本课";
  return {
    ...need,
    teachingObjectives: [
      `信息意识：能从"${topic}"相关真实情境中发现信息问题。`,
      `计算思维：能把"${topic}"中的关键过程拆分为清晰步骤。`,
      "数字化学习与创新：能使用合适工具完成记录、表达或作品优化。",
      "信息社会责任：能结合课堂情境提出安全、规范、负责任的技术使用建议。"
    ].join("\n"),
    teachingFocus: `理解"${topic}"的关键过程，并能用图示、记录或作品表达学习结果。`,
    teachingDifficulty: "把抽象的信息科技原理转化为学生能解释、能迁移、能评价的课堂证据。",
    updatedAt: new Date().toISOString()
  };
}

function sanitizeResource(resource: ClassroomResourcePackage): ClassroomResourcePackage {
  // 确保教学环节每个字段都有内容，防止 AI 漏掉 teacherActivity / studentActivity
  const procedures = (resource.teachingDesign?.procedures || []).map((p, i) => ({
    phase: p.phase || `环节${i + 1}`,
    duration: p.duration || "10分钟",
    keyQuestion: p.keyQuestion || `${p.phase || "本环节"}的核心问题是什么？`,
    teacherActivity: p.teacherActivity || `教师组织${p.phase || "教学"}活动，提供材料、示例和追问，引导学生思考并记录。`,
    studentActivity: p.studentActivity || `学生完成${p.phase || "学习"}任务，在任务单中记录发现、步骤和证据。`,
    designIntent: p.designIntent || `通过${p.phase || "本环节"}推进课堂进程，帮助学生建构理解。`,
  }));
  return {
    ...resource,
    teachingDesign: { ...resource.teachingDesign, procedures },
  };
}

function createResourcePackage(need: TeachingNeed): ClassroomResourcePackage {
  const topic = need.topicName || "未命名课题";
  const procedures = getProcedureNames(String(need.lessonType)).map((phase, index) => createProcedure(phase, index, topic, need));
  const objectives = (need.teachingObjectives || fillDesignPoints(need).teachingObjectives).split("\n").filter(Boolean);
  return {
    id: `resource-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    teachingNeed: need,
    curriculumBasis: {
      standards: ["义务教育信息科技课程标准", "关注真实问题、过程证据和责任意识。"],
      teachingGuides: ["义务教育信息科技课程教学指南", "从学生经验出发组织可操作的学习活动。"],
      coreLiteracy: coreLiteracies as CoreLiteracy[]
    },
    tpackAnalysis: {
      ck: `学生需要理解"${topic}"涉及的基本概念和过程关系。`,
      pk: `采用${String(need.lessonType)}组织课堂活动。`,
      tk: `结合${need.equipmentCondition || "机房设备"}开展观察、记录和展示。`,
      pck: "学科内容与教学法的交集：把抽象概念拆成学生可完成的任务。",
      tck: "技术与学科内容的交集：用图示、表格或作品呈现信息过程。",
      tpk: "技术与教学法的交集：用数字工具支持协作、反馈和评价。",
      tpack: "围绕课题整合学科内容、教学方法和课堂技术环境。"
    },
    literacyEvidenceChain: coreLiteracies.map((name, index) => ({
      literacy: name as CoreLiteracy,
      teachingObjective: objectives[index] || objectives[0] || `围绕${topic}形成核心素养目标。`,
      learningActivity: procedures[index % procedures.length].phase,
      taskEvidence: "学习任务单、过程记录、作品或小组说明。",
      assessmentEvidence: "测评题作答、迁移表达和课堂追问回答。",
      evaluationMethod: "教师观察、同伴互评、任务单检查和测评结果综合判断。",
      achievementStatus: "完整",
      riskAlert: "如果只关注结果，可能忽略学生解释过程。",
      improvementSuggestion: "在任务单中保留学生思考和修改痕迹。"
    })),
    teachingDesign: {
      basicInfo: {
        topicName: topic,
        grade: need.grade,
        courseModule: need.courseModule || defaultModuleByGrade[String(need.grade)],
        classHours: need.classHours || "1",
        lessonType: need.lessonType
      },
      curriculumAnalysis: [`本课属于${need.courseModule}模块，依据《义务教育信息科技课程标准（2022 年版）》相关条目设计。`],
      learningAnalysis: need.studentFoundation || "学生有日常数字设备使用经验，但对背后的信息过程认识不足。",
      teachingAnalysis: [
        `内容分析：本课围绕"${topic}"展开，帮助学生理解关键概念、过程关系和应用价值。`,
        `课型分析：本课为${String(need.lessonType)}，流程为${getProcedureNames(String(need.lessonType)).join(" → ")}。`,
        `学情分析：${need.studentFoundation || "学生有生活经验，需要通过类比、图示和任务记录建立结构化理解。"}`,
        `课标依据：依据《义务教育信息科技课程标准（2022 年版）》中${need.courseModule || "相应"}模块的要求，注重真实问题解决、过程证据和责任意识。`,
        `个性化要求：${need.additionalNeeds || "按常规信息科技课堂组织，注重学生的真实体验和思维发展。"}`
      ],
      teachingMethods: buildTeachingMethods(need),
      teachingObjectives: objectives,
      keyAndDifficultPoints: {
        focus: need.teachingFocus || `理解"${topic}"的关键过程，并能用图示或文字说明。`,
        difficulty: need.teachingDifficulty || "把抽象过程转化为学生能解释、能迁移的学习证据。"
      },
      resourcesAndEnvironment: [need.equipmentCondition || "机房可上网，教师机可投屏。", "学习任务单、测评题、过程记录表。"],
      procedures,
      questionChain: procedures.map((item) => item.keyQuestion),
      evaluationDesign: ["检查学习任务单完成度。", "观察小组交流和展示质量。", "结合分层测评题判断理解水平。"],
      blackboardDesign: [`课题：${topic}`, getProcedureNames(String(need.lessonType)).join(" → "), "学习证据：任务单、流程图、测评题、反思记录"],
      reflectionSuggestions: ["观察学生是否真正理解过程关系。", "根据测评薄弱点调整下一节课。"]
    },
    learningTaskSheet: buildLearningTaskSheet(topic, need),
    layeredAssessment: {
      basicUnderstanding: [
        `单选题1：学习"${topic}"时，最重要的是先明确什么？\nA. 最终答案  B. 真实问题和关键步骤  C. 软件名称  D. 课堂座位\n参考答案：B`,
        `单选题2：如果要证明自己理解了"${topic}"的过程，下面哪种证据最合适？\nA. 只说"我懂了"  B. 抄写课题  C. 流程图、记录表或作品说明  D. 只看同伴展示\n参考答案：C`
      ],
      principleExplanation: [
        `判断题1："${topic}"只要记住结论，不需要说明过程。\n参考答案：错`,
        `判断题2：在信息科技课上学习"${topic}"时，用流程图或步骤图来表达过程是一种好的学习证据。\n参考答案：对`,
      ],
      scenarioTransfer: [
        `简答题1：请用"先……再……最后……"说明"${topic}"中的关键过程，并写出一个你认为最容易出错的地方。\n评分要点：过程步骤完整得2分；易错点合理得1分；表达清晰得1分。`,
        `简答题2：请你设计一个校园场景，让同学在真实情境中应用"${topic}"的方法，并说明需要收集什么学习证据。\n评分要点：场景合理得2分；证据明确得2分。`,
      ],
      creativeExpression: [
        `分析题（选做）：如果把"${topic}"迁移到一个校园或家庭数字生活场景，你会怎样设计任务？请说明场景、步骤、学习证据和安全责任提醒。`
      ]
    },
    learningDiagnosisTemplate: {
      evaluationDimensions: ["概念理解", "过程表达", "任务完成", "责任意识"],
      dataSources: ["学习任务单", "测评题", "小组展示", "课堂反思"],
      dataTracking: ["任务完成率", "测评完成率", "学生提问与追问记录"],
      dataFormat: [{ 字段: "studentName", 含义: "学生姓名", 示例: "张同学" }],
      diagnosisRules: ["任务完成率低于60%的学生需要课后支持。", "情境迁移题薄弱说明需要补充真实案例。"],
      outputResults: ["班级整体分析", "学生分层建议", "教学改进建议"]
    }
  };
}

function buildLearningTaskSheet(topic: string, need: TeachingNeed) {
  const extra = need.additionalNeeds.includes("跨学科") || need.additionalNeeds.includes("其他学科")
    ? ["拓展任务（5分钟）：结合其他学科情境，说明本课方法还能解决哪个真实问题。"]
    : [];
  return {
    taskGoal: [
      `1. 能结合"${topic}"说清本节课要解决的真实问题。`,
      `2. 能用图示、表格或文字表达"${topic}"中的关键过程。`,
      "3. 能在小组交流中说明自己的操作依据，并根据同伴建议修改。",
      "4. 能联系真实数字生活，提出安全、规范、负责任的使用建议。"
    ],
    scenarioIntroduction: [
      "观察记录：我在情境中发现的现象是：__________。",
      `过程记录：我认为"${topic}"可以分成这些步骤：__________。`,
      "证据记录：我用来证明自己理解的材料是：流程图 / 表格 / 截图 / 文字说明。",
      "问题记录：我还没有想明白的问题是：__________。"
    ].join("\n"),
    taskSteps: [
      `任务一（8分钟）：阅读或观察课堂情境，圈出与"${topic}"有关的关键信息，写下一个最想解决的问题。`,
      `任务二（12分钟）：小组合作梳理"${topic}"的关键步骤，用流程图、表格或纸条模拟方式表示过程。`,
      `任务三（15分钟）：完成小组作品或过程模型，说明每一步的作用，并根据同伴追问修改表达。`,
      ...extra
    ],
    learningSupports: [
      "先看现象，再拆步骤，最后说明每一步为什么必要。",
      "说不清原理时，可以先画图，再用一句话解释图中的箭头或顺序。",
      "展示时按「我的结论—我的证据—我的疑问」三句话表达。"
    ],
    groupRoles: [
      "自评：我能否说清本节课的关键过程，并留下完整操作记录。",
      "互评：同伴能否看懂我的流程图、表格或作品说明。",
      "教师评价：重点看任务完成度、表达清晰度、证据完整度和责任意识。",
      "改进：根据评价意见修改一个表达不清或证据不足的地方。"
    ],
    recordTable: [
      { 记录项目: "观察到的现象", 填写提示: "写出真实情境中的问题或现象", 示例: "视频播放、网页打开、智能设备响应" },
      { 记录项目: "关键步骤", 填写提示: "按顺序写出3-5个步骤", 示例: "提出请求、处理信息、返回结果" },
      { 记录项目: "学习证据", 填写提示: "写出你用什么证明理解", 示例: "流程图、截图、解释文字" },
      { 记录项目: "责任提醒", 填写提示: "写出安全、隐私或规范使用建议", 示例: "保护隐私、核验来源、规范表达" }
    ],
    reflectionQuestions: [
      "今天我最清楚理解的一点是：__________。",
      "我在任务中遇到的一个困难是：__________，我是这样解决的：__________。",
      "如果把今天的方法用到另一个真实场景，我可以这样迁移：__________。"
    ]
  };
}

function getProcedureNames(type: string) {
  return getProcedureNamesByType(type);
}

function createProcedure(phase: string, index: number, topic: string, need: TeachingNeed): TeachingProcedure {
  const durations = ["5分钟", "7分钟", "10分钟", "10分钟", "8分钟", "5分钟"];
  return {
    phase,
    duration: durations[index] ?? "5分钟",
    keyQuestion: `${phase}环节中，学生需要围绕"${topic}"想清楚什么？`,
    teacherActivity: `围绕"${topic}"组织${phase}活动，提供必要材料、示例和追问，提醒学生留下学习证据。`,
    studentActivity: `完成${phase}任务，在学习任务单中记录自己的发现、步骤、证据或修改意见。`,
    designIntent: `让学生在${String(need.lessonType)}的课堂结构中逐步形成理解，并能迁移到真实数字生活。`
  };
}

function buildTeachingMethods(need: TeachingNeed) {
  const type = String(need.lessonType);
  const methodMap: Record<string, string[]> = {
    新知建构课: ["主导教学法：发现/探究式学习。", "辅助策略：情境教学法、问题引导、类比法、概念图和适时讲授。"],
    项目实践课: ["主导教学法：项目式学习。", "辅助策略：任务驱动、需求分析、方案设计、迭代优化和展示评价。"],
    实验探究课: ["主导教学法：实验探究式学习。", "辅助策略：猜想假设、实验设计、证据解释和交流论证。"],
    技能应用课: ["主导教学法：技能训练与应用。", "辅助策略：示范教学、模仿操作、变式练习、即时反馈和技能迁移。"],
    跨学科主题课: ["主导教学法：跨学科主题学习。", "辅助策略：真实问题解决、综合实践、方案设计和作品创作。"]
  };
  const extras = need.additionalNeeds ? [`个性化策略：${need.additionalNeeds}`] : [];
  return [...(methodMap[type] ?? methodMap.新知建构课), ...extras];
}

function findGuideBasis(need: TeachingNeed) {
  const matched = matchGuideEntry(need);
  if (matched) {
    return {
      guideObjectives: matched.learningObjectives,
      guideFocus: matched.keyPoints,
      guideDifficulty: matched.difficultPoints,
      lessonTitle: matched.lessonTitle,
      source: matched.source,
      suggestedActivities: matched.suggestedActivities
    };
  }

  const topic = need.topicName || "本课";
  const module = need.courseModule || defaultModuleByGrade[String(need.grade)] || "信息科技";
  const isNetwork = `${topic}${module}`.includes("数据") || `${topic}${module}`.includes("互联网") || `${topic}${module}`.includes("网络");
  const isAi = `${topic}${module}`.includes("人工智能") || `${topic}${module}`.includes("智能");
  const isIot = `${topic}${module}`.includes("物联网") || `${topic}${module}`.includes("传感");

  if (isNetwork) {
    return {
      guideObjectives: ["理解互联网应用中数据传输的基本过程。", "能用图示、类比或流程表达数据拆分、传输和重组。", "能讨论网络服务中的隐私保护和责任边界。"],
      guideFocus: ["数据分包、编号、传输和重组的基本过程。", "用可视化方式表达抽象的信息传输过程。"],
      guideDifficulty: ["从生活类比过渡到真实网络数据传输原理。", "把技术过程与隐私保护、责任使用联系起来。"],
      suggestedActivities: ["用「快递分包」模拟数据拆分、编号、传输和重组。", "组织学生讨论网络服务收集和使用数据的边界。"]
    };
  }
  if (isIot) {
    return {
      guideObjectives: ["理解物联网设备采集、传输、处理和反馈的基本过程。", "能结合真实设备说明传感器数据的作用。", "能讨论智能设备使用中的安全与责任。"],
      guideFocus: ["物联网系统中感知、传输、处理、反馈的关系。", "用流程图表达设备工作过程。"],
      guideDifficulty: ["理解数据从物理世界进入数字系统后的处理过程。", "结合设备条件设计可实施的探究任务。"],
      suggestedActivities: ["观察传感器数据变化并记录现象。", "小组设计校园物联网应用方案。"]
    };
  }
  if (isAi) {
    return {
      guideObjectives: ["理解人工智能系统需要数据、模型和判断规则支撑。", "能结合校园或生活情境说明智能系统的基本工作过程。", "能讨论人工智能使用中的公平、隐私与责任。"],
      guideFocus: ["数据、模型、判断与反馈之间的关系。", "用情境分析解释人工智能应用。"],
      guideDifficulty: ["避免把人工智能理解成简单自动化工具。", "把技术原理与伦理责任联系起来。"],
      suggestedActivities: ["分析一个校园智能应用的数据来源和判断过程。", "讨论智能系统出错时应如何改进和承担责任。"]
    };
  }
  return {
    guideObjectives: [`理解"${topic}"涉及的关键信息过程。`, "能用图示、表格或作品说明学习过程。", "能联系真实数字生活提出安全、规范、负责任的建议。"],
    guideFocus: [`理解"${topic}"的关键过程。`, "形成可观察、可评价的学习证据。"],
    guideDifficulty: ["把抽象的信息科技概念转化为学生能解释的过程。", "把课堂任务与真实应用情境联系起来。"],
    suggestedActivities: ["从真实情境提出问题。", "通过小组任务形成过程记录和展示证据。"]
  };
}

function loadGuideLibrary() {
  const saved = readJson<GuideBasisEntry[]>(guideLibraryStorageKey);
  return saved && saved.length > 0 ? mergeGuideEntries(defaultGuideLibrary, saved) : defaultGuideLibrary;
}

function matchGuideEntry(need: TeachingNeed) {
  const topic = normalizeText(need.topicName);
  const module = normalizeText(need.courseModule);
  const grade = normalizeText(String(need.grade));
  const scored = loadGuideLibrary().map((entry) => {
    let score = 0;
    const lessonTitle = normalizeText(entry.lessonTitle);
    const entryModule = normalizeText(entry.module);
    const entryGrade = normalizeText(entry.grade);
    if (topic && lessonTitle === topic) score += 100;
    if (topic && (lessonTitle.includes(topic) || topic.includes(lessonTitle))) score += 60;
    if (entryGrade && grade && entryGrade === grade) score += 12;
    if (entryModule && module && (entryModule.includes(module) || module.includes(entryModule))) score += 12;
    for (const keyword of entry.keywords) {
      const key = normalizeText(keyword);
      if (key && topic.includes(key)) score += 16;
    }
    return { entry, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 28 ? scored[0].entry : null;
}

function normalizeText(value: string) {
  return value.replace(/[《》"""'，,。.\s]/g, "").toLowerCase();
}

function buildLocalDesignPointsDraft(need: TeachingNeed): DesignPointsDraft {
  const topic = need.topicName || "本课";
  const guide = findGuideBasis(need);
  const studentContext = need.studentFoundation || "学生已有日常数字工具使用经验，但对背后的信息过程理解不足。";
  const equipmentContext = need.equipmentCondition || "结合当前机房条件，建议采用可观察、可记录、可展示的课堂活动。";
  const teachingObjectives: DesignPointsDraft["teachingObjectives"] = [
    {
      literacy: "信息意识",
      objective: `能从"${topic}"相关真实情境中发现信息问题，说明本课内容与数字生活的关系。`,
      evidence: "学生能在任务单中写出一个与课题相关的问题或现象。"
    },
    {
      literacy: "计算思维",
      objective: `能把"${topic}"中的关键过程拆分为清晰步骤，并用图示、表格或文字表达。`,
      evidence: "学生能提交流程图、步骤表或过程说明。"
    },
    {
      literacy: "数字化学习与创新",
      objective: "能使用合适工具记录、整理和展示小组学习成果，并根据反馈修改。",
      evidence: "学生能提交小组记录、作品截图或展示说明。"
    },
    {
      literacy: "信息社会责任",
      objective: "能结合课堂情境讨论安全、隐私、规范使用或责任边界。",
      evidence: "学生能提出一条具体、合理、可执行的责任建议。"
    }
  ];
  const teachingFocus = guide.guideFocus;
  const teachingDifficulty = guide.guideDifficulty;
  return {
    basis: {
      curriculumStandard: "课标依据：围绕信息意识、计算思维、数字化学习与创新、信息社会责任确定目标。",
      teachingGuide: `指南依据：${String(need.grade)}"${need.courseModule || "信息科技"}"模块建议关注：${guide.guideObjectives.join("；")}`,
      studentContext: `学情依据：${studentContext}`,
      equipmentContext: `设备依据：${equipmentContext}`
    },
    breakthroughStrategies: guide.suggestedActivities,
    teacherEditableText: {
      teachingDifficulty: teachingDifficulty.join("\n"),
      teachingFocus: teachingFocus.join("\n"),
      teachingObjectives: teachingObjectives.map((item) => `${item.literacy}：${item.objective}\n证据：${item.evidence}`).join("\n")
    },
    teachingDifficulty,
    teachingFocus,
    teachingObjectives
  };
}

function getAssistantActions(tab: ResourceTab) {
  const actionMap: Record<ResourceTab, string[]> = {
    design: ["优化教学流程", "补充教师追问", "降低理解难度", "增加过程性评价", "强化核心素养目标", "改得更适合公开课"],
    task: ["细化任务步骤", "增加学习支架", "降低任务难度", "补充小组协作", "增加操作记录", "增加课堂反思"],
    assessment: ["增加基础题", "增加情境迁移题", "增加开放表达题", "补充答案解析", "调整题目难度", "强化素养证据"],
    diagnosis: ["补充评价维度", "补充数据采集项", "补充诊断规则", "增加分层建议", "增加教学改进建议"],
    materials: ["补充情境材料", "生成活动卡", "完善展示评价表", "增加课堂提示语", "强化安全提醒"]
  };
  return actionMap[tab];
}

function makeAssistantSuggestion(tab: ResourceTab, action: string, request = "") {
  const names: Record<ResourceTab, string> = {
    design: "教学设计",
    task: "学习任务单",
    assessment: "分层测评题",
    diagnosis: "学情诊断表",
    materials: "课堂材料"
  };
  const requestText = request ? `\n已结合你的要求："${request}"。` : "";
  return `已根据"${names[tab]}"和"${action}"生成修订建议。请先看预览，确认合适后再应用到当前内容。${requestText}`;
}

function buildAssistantPreview({
  action,
  module,
  need,
  original,
  request
}: {
  action: string;
  module: ResourceTab;
  need: TeachingNeed;
  original: string;
  request: string;
}): AssistantPreview {
  const normalized = original.trim();
  const topic = need.topicName || "本课内容";
  const lessonType = String(need.lessonType || "本课");
  const custom = request.trim();
  const baseReason = `当前内容属于"${resourceTabs.find((item) => item.id === module)?.label || "课堂资源"}"，需要同时考虑${String(need.grade)}学生基础、${lessonType}课堂结构和可观察的学习证据。`;
  let title = `${action}建议`;
  let revised = normalized;

  if (!normalized) {
    revised = `围绕"${topic}"补充一段可直接用于课堂的内容，写清学生要做什么、留下什么证据、教师如何观察。${custom ? `\n教师要求：${custom}` : ""}`;
    return buildPreviewResult(action, original, revised, title, baseReason, need, module);
  }

  const isRewrite =
    action.includes("难度") ||
    action.includes("优化") ||
    action.includes("强化") ||
    action.includes("公开课") ||
    action.includes("完善") ||
    action.includes("提示语") ||
    action.includes("安全提醒") ||
    action.includes("教师要求");

  if (isRewrite) {
    if (action.includes("难度")) {
      title = "降低理解难度（改写）";
      revised = normalized
        .replace(/抽象|概念性|专业性/g, "具体")
        .replace(/分析|探究/g, "理解")
        .replace(/阐述|论述/g, "说说");
      if (!revised.includes("生活")) revised = `【生活情境引入】先让学生回忆生活中与"${topic}"相关的经历。\n${revised}`;
      if (!revised.includes("一句话")) revised = `${revised}\n【理解检查】请学生用自己的话解释关键步骤，确保每个学生都能说清楚。`;
    } else if (action.includes("优化")) {
      title = "优化教学流程（改写）";
      revised = `【教学意图】通过"${topic}"帮助学生建立从现象到原理的认知路径。\n【学生任务】观察→记录→讨论→展示，每个环节留下书面证据。\n【教师评价点】看步骤是否清晰、解释是否准确、能否迁移应用。\n${normalized}`;
    } else if (action.includes("强化") && action.includes("素养")) {
      title = "强化核心素养目标（改写）";
      revised = normalized;
      if (!revised.includes("信息意识")) revised = `【信息意识】能识别"${topic}"相关的信息问题。\n${revised}`;
      if (!revised.includes("计算思维")) revised = `${revised}\n【计算思维】能将"${topic}"的过程抽象为可执行的步骤。`;
      if (!revised.includes("责任")) revised = `${revised}\n【信息社会责任】在使用"${topic}"相关技术时注意安全与伦理。`;
    } else if (action.includes("公开课")) {
      title = "适合公开课的表达（改写）";
      revised = `【课堂导入】通过真实情境引入"${topic}"，激发学生好奇。\n【核心活动】${normalized}\n【亮点设计】增加学生展示环节，邀请同伴互评，体现"以学为中心"。\n【课堂总结】引导学生归纳"${topic}"的关键要点，形成可迁移的认知结构。`;
    } else if (action.includes("完善")) {
      title = "完善展示评价表（改写）";
      revised = `【评价维度】完整性 | 准确性 | 可理解性 | 责任表达\n${normalized}\n【评分标准】每维度 1-4 分，3 分以上为达标。\n【反馈句式】"你在___方面做得很好，建议在___方面可以___。"`;
    } else if (action.includes("教师要求")) {
      title = "按教师要求修订（改写）";
      revised = custom
        ? `【教师要求】${custom}\n\n【修订后文本】\n${normalized}`
        : normalized;
    } else {
      title = "优化课堂表达（改写）";
      revised = `【教学提示】${normalized}\n【课堂用语】教师在讲解"${topic}"时使用"我们先看现象→再拆步骤→最后说原因"的结构。\n【安全/规范提醒】提醒学生在操作中注意信息安全和隐私保护。`;
    }
    if (custom && !action.includes("教师要求")) revised = `${revised}\n\n【教师要求】${custom}`;
  } else {
    // 补充类：保留原文 + 明确标注补充内容
    const supplement =
      action.includes("追问")
        ? `关键问题：这个过程为什么要按这样的顺序完成？\n教师追问：如果少了其中一步，会影响结果吗？请学生用"现象—原因—证据"的方式说明。`
        : action.includes("支架") || action.includes("步骤")
        ? `第一步，圈出任务中的关键词；\n第二步，用图示或表格整理过程；\n第三步，小组互问一个"为什么"；\n第四步，根据同伴建议修改记录。`
        : action.includes("评价") || action.includes("证据")
        ? `学生需要提交一份可观察成果，如流程图、操作记录、截图说明或小组展示卡。教师重点看"步骤是否清楚、解释是否准确、是否能提出安全与责任提醒"。`
        : action.includes("答案") || action.includes("题")
        ? `建议答案包含关键词、判断理由和一个生活化迁移例子；选做题可让学生联系网络安全、隐私保护或数字责任表达观点。`
        : action.includes("诊断") || action.includes("分层") || action.includes("数据")
        ? `记录学生是否能独立说明步骤、是否能完成任务证据、是否能解释错误原因。对基础薄弱学生提供示例句式，对提升组增加迁移问题或作品优化要求。`
        : action.includes("协作")
        ? `角色分工：组长（组织协调）、记录员（书面记录）、发言人（展示汇报）、检查员（核查完成度）。每轮任务完成后角色轮换。`
        : action.includes("改进建议")
        ? `基于当前诊断数据，提出2-3条具体可操作的教学改进建议。每一条建议包含：问题描述→改进策略→预期效果。如"学生在XX环节表现较弱，建议下次增加XX支架，预计能提升XX"。`
        : action.includes("记录")
        ? `操作记录模板：①我做了什么→②我观察到什么→③我遇到的困难→④我是如何解决的。鼓励用截图、流程图辅助说明。`
        : action.includes("反思")
        ? `反思引导：①这节课我学到的最重要的三件事是什么？②我还有什么没弄清楚的？③下次学习类似内容我会怎么做？`
        : action.includes("基础题")
        ? `【基础题示例】请用自己的话解释"${topic}"的含义，并写出至少两个关键步骤。`
        : action.includes("情境迁移")
        ? `【情境迁移题】如果在一个新的场景中遇到"${topic}"相关的问题，你会如何运用今天学到的知识？`
        : action.includes("开放表达")
        ? `【开放表达题】请结合"${topic}"，谈谈你对"技术如何影响生活方式"的看法，100 字以上。`
        : action.includes("情境材料")
        ? `【情境材料】选取学生熟悉的校园或家庭场景，设计与"${topic}"相关的真实问题情境。包含背景描述、具体任务和预期成果。`
        : action.includes("活动卡")
        ? `【小组活动卡】任务名称：___ | 组长：___ | 时间：___分钟\n步骤一（2分钟）：个人阅读任务要求\n步骤二（5分钟）：小组讨论并完成记录\n步骤三（3分钟）：准备 1 分钟口头展示\n展示要求：说清做了什么、发现了什么、还有什么问题。`
        : action.includes("提示语")
        ? `【课堂提示】①开始前：明确任务目标和时间限制；②过程中：巡视观察，对困难小组提供追问；③结束前：提醒学生整理记录、准备展示。`
        : action.includes("安全")
        ? `【安全提醒】①操作前检查设备状态；②不泄露个人隐私信息；③遇到异常情况及时报告教师；④使用正版软件和合法资源。`
        : `明确学生角色分工、时间限制和可提交成果，让这段内容能在课堂中直接执行。`;

    revised = `【原文保留】\n${normalized}\n\n【补充内容】${action.includes("追问") ? "关键问题与教师追问" : action.includes("支架") || action.includes("步骤") ? "学习支架与可执行步骤" : action.includes("评价") || action.includes("证据") ? "过程性评价证据" : action.includes("答案") || action.includes("题") ? "答题提示与答案解析" : action.includes("诊断") || action.includes("分层") || action.includes("数据") ? "学情诊断与分层建议" : action.includes("协作") ? "小组协作方案" : action.includes("改进建议") ? "教学改进建议" : action.includes("记录") ? "操作记录模板" : action.includes("反思") ? "课堂反思引导" : action.includes("基础题") ? "基础理解题" : action.includes("情境迁移") ? "情境迁移题" : action.includes("开放表达") ? "开放表达题" : action.includes("情境材料") ? "情境材料" : action.includes("活动卡") ? "活动卡" : action.includes("提示语") ? "课堂提示语" : action.includes("安全") ? "安全提醒" : "补充建议"}\n${supplement}`;
    if (custom) revised = `${revised}\n\n【教师要求】${custom}`;
  }

  return buildPreviewResult(action, original, revised, title, baseReason, need, module);
}

function buildPreviewResult(action: string, original: string, revised: string, title: string, reason: string, need: TeachingNeed, module: ResourceTab): AssistantPreview {
  return {
    action,
    original,
    process: [
      `读取当前选中的${resourceTabs.find((item) => item.id === module)?.label || "资源内容"}`,
      `结合课题"${need.topicName || "本课"}"、年级和课型判断课堂可操作性`,
      "生成可预览、可采纳的单段修订建议"
    ],
    reason,
    revised,
    title
  };
}

function createCheckResult(resource: ClassroomResourcePackage, status: string) {
  const hasConfirmed = status === "教师确认版";
  const hasEthics = JSON.stringify(resource).includes("安全") || JSON.stringify(resource).includes("隐私") || JSON.stringify(resource).includes("责任");
  const base = hasConfirmed ? 0.9 : 0.78;
  const confidence = Math.min(0.96, base + (hasEthics ? 0.04 : -0.06));

  // 实际分析资源内容，产生差异化指标
  const procedures = resource.teachingDesign?.procedures ?? [];
  const hasProcedures = procedures.length > 0;
  const hasDurations = procedures.every((p) => p.duration && /\d/.test(p.duration));
  const objectives = resource.teachingDesign?.teachingObjectives ?? [];
  const hasAllFourLiteracies = ["信息意识", "计算思维", "数字化学习与创新", "信息社会责任"].every((l) =>
    objectives.some((o) => o.includes(l))
  );
  const hasQuestionChain = (resource.teachingDesign?.questionChain ?? []).length >= 3;
  const analysisText = (resource.teachingDesign?.teachingAnalysis ?? []).join(" ");
  const hasSpecificStudents = analysisText.includes("学生") && analysisText.length > 80;
  const taskSheet = resource.learningTaskSheet;
  const hasTaskSteps = (taskSheet?.taskSteps ?? []).length >= 3;
  const hasScenario = (taskSheet?.scenarioIntroduction ?? "").length >= 30;
  const standardsRef = resource.curriculumBasis?.standards ?? [];
  const hasStandards = standardsRef.length > 0;
  const assessmentItems = [
    ...(resource.layeredAssessment?.basicUnderstanding ?? []),
    ...(resource.layeredAssessment?.principleExplanation ?? []),
    ...(resource.layeredAssessment?.scenarioTransfer ?? []),
    ...(resource.layeredAssessment?.creativeExpression ?? []),
  ];
  const hasAssessment = assessmentItems.length >= 5;

  // 计算实际分数
  const alignmentScore = hasStandards ? 90 : hasConfirmed ? 84 : 78;
  const literacyScore = hasAllFourLiteracies ? 88 : objectives.length >= 2 ? 82 : 74;
  const adaptabilityScore = hasSpecificStudents ? 86 : hasConfirmed ? 80 : 72;
  const operabilityScore = hasDurations && hasProcedures ? 86 : hasProcedures ? 80 : 70;
  const completenessScore = hasAssessment && hasTaskSteps ? 92 : hasTaskSteps ? 84 : 74;
  const runnabilityScore = hasScenario && hasTaskSteps ? 86 : 78;
  const ethicsScore = hasEthics ? 88 : 72;

  // 每个指标差异化风险和建议
  const qualityItems: Array<{ dimension: string; score: number; evidence: string; risk: string; suggestion: string }> = [
    {
      dimension: "课标一致性",
      score: alignmentScore,
      evidence: hasStandards
        ? `已引用 ${standardsRef.length} 条课标条目。`
        : "未显式引用课标条目。",
      risk: hasStandards
        ? "课标条目与教学活动的对应关系不够明确。"
        : "缺少课标依据，教学方向可能偏离课程要求。",
      suggestion: hasStandards
        ? "在教学设计中逐条标注课标条目对应的教学环节。"
        : "在备课工作台中补充《2022版信息科技课标》具体条目引用。",
    },
    {
      dimension: "核心素养达成度",
      score: literacyScore,
      evidence: hasAllFourLiteracies
        ? "四个核心素养均有教学目标覆盖。"
        : `已覆盖 ${objectives.length} 个素养维度，${hasAllFourLiteracies ? "" : "部分维度缺失。"}`,
      risk: hasAllFourLiteracies
        ? "部分素养维度的活动证据不够充分。"
        : "缺失的素养维度会导致证据链不完整。",
      suggestion: hasAllFourLiteracies
        ? "为每个素养目标补充对应的学生活动和评价证据。"
        : "补充缺失素养维度的教学目标、活动和评价方式。",
    },
    {
      dimension: "学情适配度",
      score: adaptabilityScore,
      evidence: hasSpecificStudents
        ? "已包含学生基础和学情分析。"
        : "学情描述较笼统，未体现班级特点。",
      risk: "统一的教学设计可能无法适应班级实际差异。",
      suggestion: "在学情分析中加入学生前备知识、常见困难和兴趣点。",
    },
    {
      dimension: "活动可操作性",
      score: operabilityScore,
      evidence: hasDurations
        ? "教学环节均标注了时长。"
        : hasProcedures
          ? "教学环节存在，但部分未标注时长。"
          : "教学环节缺失。",
      risk: hasDurations
        ? "环节时长分配是否合理需要实际检验。"
        : "无时长标注，教师难以把握课堂节奏。",
      suggestion: hasDurations
        ? "根据实际试讲调整各环节时长分配。"
        : "为每个教学环节标注建议时长，并在任务单中细化步骤。",
    },
    {
      dimension: "资源完整度",
      score: completenessScore,
      evidence: `任务单 ${hasTaskSteps ? "已" : "未"}完成，测评题 ${hasAssessment ? assessmentItems.length : 0} 道${hasAssessment ? "" : "（不足）"}，${hasQuestionChain ? "已" : "未"}构建问题链。`,
      risk: !hasAssessment
        ? "测评题不足会影响学习效果检验。"
        : !hasQuestionChain
          ? "缺少问题链，课堂追问设计偏弱。"
          : "资源整体完整，但部分细节可进一步优化。",
      suggestion: !hasAssessment
        ? "补充分层测评题，每层至少2道。"
        : !hasQuestionChain
          ? "补充4-6个递进问题形成问题链。"
          : "检查各模块之间的一致性，确保目标、活动、评价三对齐。",
    },
    {
      dimension: "学生端可运行性",
      score: runnabilityScore,
      evidence: hasScenario
        ? "已包含情境导入和任务步骤，学生端可正常使用。"
        : "情境导入过短，学生端体验可能不足。",
      risk: hasScenario
        ? "AI学伴的引导语可能需要结合课题进一步优化。"
        : "学生端缺少情境引导，课堂启动环节薄弱。",
      suggestion: "在学生端预览任务单，确认所有步骤描述清晰、支架可用。",
    },
    {
      dimension: "AI伦理与安全性",
      score: ethicsScore,
      evidence: hasEthics
        ? "已包含安全、隐私或责任相关表达。"
        : "安全、隐私和伦理内容偏弱。",
      risk: hasEthics
        ? "伦理内容可能停留在表面，需加深与课题的结合。"
        : "信息科技课应强化学生的安全意识和伦理判断力。",
      suggestion: hasEthics
        ? "在反思环节中加入具体的安全和隐私讨论问题。"
        : "在任务单和反思中加入数字安全、隐私保护或技术伦理的具体讨论点。",
    },
  ];

  return {
    confidence,
    canExport: confidence >= 0.85 && hasConfirmed,
    conclusion: hasConfirmed ? "这套资源已基本达到导出条件，可以进入资源导出。" : "当前资源尚未确认定稿，建议先返回备课工作台完成教师确认。",
    nextStep: hasConfirmed ? "进入资源导出" : "返回修改并确认定稿",
    evidence: resource.literacyEvidenceChain.map((item) => ({
      literacy: String(item.literacy),
      goal: item.teachingObjective,
      activity: item.learningActivity,
      taskEvidence: item.taskEvidence,
      assessmentEvidence: item.assessmentEvidence,
      evaluation: item.evaluationMethod,
      status: item.achievementStatus,
      suggestion: item.improvementSuggestion
    })),
    quality: qualityItems,
  };
}

function loadResourceSource() {
  const confirmed = readJson<ClassroomResourcePackage>(confirmedVersionStorageKey);
  if (confirmed) return { resource: confirmed, status: "教师确认版" };
  const draft = readJson<ClassroomResourcePackage>(resourcePackageStorageKey);
  return { resource: draft, status: localStorage.getItem(resourceStatusStorageKey) || (draft ? "AI初稿" : "无资源") };
}

function getCurrentResourceVersion() {
  const resource = readJson<ClassroomResourcePackage>(resourcePackageStorageKey) ?? readJson<ClassroomResourcePackage>(confirmedVersionStorageKey);
  return resource?.id || localStorage.getItem(resourceVersionStorageKey) || "";
}

function setResourceVersion(version: string) {
  localStorage.setItem(resourceVersionStorageKey, version);
}

function readCurrentResourceCheck() {
  const check = readJson<{ confidence: number; conclusion: string; resourceVersion?: string; checkedAt?: string }>(resourceCheckStorageKey);
  if (!check) return null;
  return check.resourceVersion === getCurrentResourceVersion() ? check : null;
}

function readCurrentExportedAt() {
  const raw = localStorage.getItem(resourceExportedAtStorageKey);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { resourceVersion?: string; exportedAt?: string };
    return parsed.resourceVersion === getCurrentResourceVersion() ? parsed.exportedAt || "" : "";
  } catch {
    return "";
  }
}

function clearResourceReviewArtifacts() {
  localStorage.removeItem(confirmedVersionStorageKey);
  localStorage.removeItem(resourceCheckStorageKey);
  localStorage.removeItem(resourceExportedAtStorageKey);
}

function clearResourceLifecycle() {
  localStorage.removeItem(resourcePackageStorageKey);
  localStorage.removeItem(resourceStatusStorageKey);
  localStorage.removeItem(resourceSavedAtStorageKey);
  localStorage.removeItem(resourceVersionStorageKey);
  clearResourceReviewArtifacts();
}

function buildHtml(resource: ClassroomResourcePackage) {
  const task = resource.learningTaskSheet;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(resource.teachingNeed.topicName)}</title><style>body{font-family:Arial,"Microsoft YaHei",sans-serif;line-height:1.7;max-width:920px;margin:40px auto;color:#0f172a}h1{text-align:center}h2{border-bottom:1px solid #cbd5e1;padding-bottom:6px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:8px;vertical-align:top}</style></head><body>
<h1>${escapeHtml(resource.teachingNeed.topicName)}</h1>
${section("一、基本信息", [`年级：${String(resource.teachingNeed.grade)}`, `模块：${resource.teachingNeed.courseModule}`, `课型：${String(resource.teachingNeed.lessonType)}`])}
${section("二、教学分析", resource.teachingDesign.teachingAnalysis)}
${section("三、教学方法", resource.teachingDesign.teachingMethods)}
${section("四、教学目标", resource.teachingDesign.teachingObjectives)}
<h2>五、教学流程</h2><table><thead><tr><th>环节</th><th>关键问题/教师追问</th><th>教师活动</th><th>学生活动</th><th>设计意图</th></tr></thead><tbody>${resource.teachingDesign.procedures.map((item) => `<tr><td>${escapeHtml(item.phase)}<br>${escapeHtml(item.duration)}</td><td>${escapeHtml(item.keyQuestion)}</td><td>${escapeHtml(item.teacherActivity)}</td><td>${escapeHtml(item.studentActivity)}</td><td>${escapeHtml(item.designIntent)}</td></tr>`).join("")}</tbody></table>
${section("六、学习任务单", formatTaskItems(task))}
${section("七、分层测评题", [...resource.layeredAssessment.basicUnderstanding, ...resource.layeredAssessment.principleExplanation, ...resource.layeredAssessment.scenarioTransfer, ...resource.layeredAssessment.creativeExpression])}
</body></html>`;
}

function section(title: string, items: string[]) {
  return `<h2>${escapeHtml(title)}</h2><ol>${items.filter(Boolean).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

async function buildDocx(resource: ClassroomResourcePackage) {
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: resource.teachingNeed.topicName, bold: true, size: 32 })] }),
    heading("一、基本信息"),
    ...docList([`年级：${String(resource.teachingNeed.grade)}`, `模块：${resource.teachingNeed.courseModule}`, `课型：${String(resource.teachingNeed.lessonType)}`]),
    heading("二、教学分析"),
    ...docList(resource.teachingDesign.teachingAnalysis),
    heading("三、教学方法"),
    ...docList(resource.teachingDesign.teachingMethods),
    heading("四、教学目标"),
    ...docList(resource.teachingDesign.teachingObjectives),
    heading("五、教学流程"),
    buildProcedureTable(resource.teachingDesign.procedures),
    heading("六、学习任务单"),
    ...docList(formatTaskItems(resource.learningTaskSheet)),
    heading("七、分层测评题"),
    ...docList([...resource.layeredAssessment.basicUnderstanding, ...resource.layeredAssessment.principleExplanation, ...resource.layeredAssessment.scenarioTransfer, ...resource.layeredAssessment.creativeExpression])
  ];
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

function heading(text: string) {
  return new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text, bold: true, size: 26 })] });
}

function docList(items: string[]) {
  return items.filter(Boolean).map((item, index) => new Paragraph({ children: [new TextRun(`${index + 1}. ${item}`)] }));
}

function buildProcedureTable(items: TeachingProcedure[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: ["教学环节", "关键问题/教师追问", "教师活动", "学生活动", "设计意图"].map((text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) }),
      ...items.map((item) => new TableRow({ children: [(item.phase || "环节") + (item.duration ? "（" + formatDuration(item.duration) + "）" : ""), item.keyQuestion, item.teacherActivity, item.studentActivity, item.designIntent].map((text) => new TableCell({ children: [new Paragraph(text || "")] })) }))
    ]
  });
}

function formatTaskItems(task: ClassroomResourcePackage["learningTaskSheet"]) {
  return ["【学习目标】", ...task.taskGoal, "【学习任务】", ...task.taskSteps, "【学法指导】", ...task.learningSupports, "【操作记录】", task.scenarioIntroduction, "【课堂评价】", ...task.groupRoles, "【课堂反思】", ...task.reflectionQuestions];
}

function loadSampleLesson(onNavigate: (id: PageId) => void) {
  const need: TeachingNeed = {
    ...loadTeachingNeed(),
    topicName: "数据分包灵活传",
    grade: "七年级" as Grade,
    courseModule: "互联网应用与创新",
    classHours: "1",
    studentFoundation: "学生熟悉上网和视频播放，但不了解数据如何传输。",
    equipmentCondition: "机房可上网，学生两人一机，教师机可投屏。",
    lessonType: "新知建构课" as LessonType,
    generationScope: "生成完整课堂资源包" as GenerationScope,
    additionalNeeds: "希望结合真实生活情境设计学习任务。",
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(teachingNeedStorageKey, JSON.stringify(need));
  const resource = createResourcePackage(need);
  localStorage.setItem(resourcePackageStorageKey, JSON.stringify(resource));
  localStorage.setItem(resourceStatusStorageKey, "AI初稿");
  setResourceVersion(resource.id);
  localStorage.removeItem(resourceSavedAtStorageKey);
  clearResourceReviewArtifacts();
  onNavigate("prep-workbench");
}

function loadSampleLesson2(onNavigate: (id: PageId) => void) {
  const need: TeachingNeed = {
    ...loadTeachingNeed(),
    topicName: "智能浇花小管家",
    grade: "八年级" as Grade,
    courseModule: "物联网实践与探索",
    classHours: "2",
    studentFoundation: "学生已了解传感器基本概念，能用物联实验设备读取数据，对真实问题有探究兴趣。",
    equipmentCondition: "物联实验套件（含土壤湿度传感器、温湿度传感器、水泵模块、主控板），机房可上网。",
    lessonType: "项目实践课" as LessonType,
    generationScope: "生成完整课堂资源包" as GenerationScope,
    additionalNeeds: "希望突出项目式学习特点，注重方案设计、迭代优化和成果展示。",
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(teachingNeedStorageKey, JSON.stringify(need));
  const resource = createResourcePackage(need);
  localStorage.setItem(resourcePackageStorageKey, JSON.stringify(resource));
  localStorage.setItem(resourceStatusStorageKey, "AI初稿");
  setResourceVersion(resource.id);
  localStorage.removeItem(resourceSavedAtStorageKey);
  clearResourceReviewArtifacts();
  onNavigate("prep-workbench");
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function generateWithWorkflow(
  need: TeachingNeed,
  fallback: ClassroomResourcePackage,
  onProgress: (stage: string, detail: string) => void,
  onNotice: (msg: string) => void,
) {
  const settings = loadLocalSettings();
  const guideBasis = findGuideBasis(need);
  try {
    const response = await fetch(`${apiBaseUrl}/api/ai/generate-workflow`, {
      body: JSON.stringify({
        aiConfig: buildAiConfig(settings),
        fallbackResource: fallback,
        guideBasis,
        teachingNeed: need,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { error?: string } | null;
      return {
        notice: `${error?.error || "工作流启动失败"} 已自动使用本地示例生成。`,
        resource: fallback,
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { notice: "浏览器不支持流式读取，已使用本地示例生成。", resource: fallback };
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let finalResource: ClassroomResourcePackage | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const lines = part.split("\n");
        const eventLine = lines.find((l) => l.startsWith("event:"));
        const dataLine = lines.find((l) => l.startsWith("data:"));
        if (!eventLine || !dataLine) continue;

        const eventType = eventLine.replace("event:", "").trim();
        let data: Record<string, unknown> | null = null;
        try {
          data = JSON.parse(dataLine.replace("data:", "").trim());
        } catch {
          continue;
        }

        if (eventType === "progress" && data) {
          onProgress(String(data.stage || ""), String(data.detail || ""));
        } else if (eventType === "result" && data) {
          finalResource = data.resource as ClassroomResourcePackage;
        } else if (eventType === "fallback" && data) {
          onNotice(String(data.message || "正在使用备用生成方式..."));
        } else if (eventType === "error") {
          onNotice(`AI 工作流异常：${data?.error || "未知错误"}`);
        }
      }
    }

    if (finalResource?.teachingDesign && finalResource.learningTaskSheet) {
      return { notice: "AI 工作流已生成课堂资源包，请先查看并按班级情况修改。", resource: sanitizeResource(finalResource) };
    }
    return { notice: "工作流返回不完整，已自动使用本地示例生成。", resource: fallback };
  } catch {
    // Layer 3: Frontend fallback — try old single-call, then local
    try {
      const result = await generateResourceWithAi(need, fallback);
      onNotice("工作流连接失败，已通过备用方式生成。");
      return result;
    } catch {
      return { notice: "暂时无法连接后端 AI 服务，已自动使用本地示例生成。", resource: fallback };
    }
  }
}

async function generateResourceWithAi(need: TeachingNeed, fallback: ClassroomResourcePackage) {
  const settings = loadLocalSettings();
  const guideBasis = findGuideBasis(need);
  try {
    const response = await fetch(`${apiBaseUrl}/api/ai/generate-resource`, {
      body: JSON.stringify({ aiConfig: buildAiConfig(settings), fallbackResource: fallback, guideBasis, teachingNeed: need }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { error?: string } | null;
      return {
        notice: `${error?.error || "AI 生成暂不可用"} 已自动使用本地示例生成，后续可继续编辑。`,
        resource: fallback
      };
    }
    const data = (await response.json()) as { resource?: ClassroomResourcePackage; source?: string };
    if (!data.resource?.teachingDesign || !data.resource.learningTaskSheet) {
      return { notice: "AI 返回内容结构不完整，已自动使用本地示例生成。", resource: fallback };
    }
    return { notice: "AI 已生成课堂资源包，请先查看并按班级情况修改。", resource: sanitizeResource(data.resource) };
  } catch {
    return { notice: "暂时无法连接后端 AI 服务，已自动使用本地示例生成。", resource: fallback };
  }
}

async function draftDesignPointsWithAi(need: TeachingNeed): Promise<DesignPointsDraft> {
  const settings = loadLocalSettings();
  const guideBasis = findGuideBasis(need);
  const fallback = buildLocalDesignPointsDraft(need);
  try {
    const response = await fetch(`${apiBaseUrl}/api/ai/draft-design-points`, {
      body: JSON.stringify({ aiConfig: buildAiConfig(settings), fallbackDraft: fallback, guideBasis, teachingNeed: need }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as { draft?: DesignPointsDraft };
    if (!data.draft?.teacherEditableText?.teachingObjectives) return fallback;
    return data.draft;
  } catch {
    return fallback;
  }
}

function loadLocalSettings(): LocalSettings {
  const saved = readJson<Partial<LocalSettings>>(localSettingsStorageKey);
  return { ...defaultLocalSettings, ...(saved || {}) };
}

function buildAiConfig(settings: LocalSettings) {
  return {
    apiKey: settings.aiApiKey.trim(),
    baseUrl: settings.aiBaseUrl.trim(),
    model: settings.aiModel.trim()
  };
}

function createEmptyGuideEntry(): GuideBasisEntry {
  return {
    difficultPoints: [],
    grade: "七年级",
    id: `guide-${Date.now()}`,
    keyPoints: [],
    keywords: [],
    learningObjectives: [],
    lessonTitle: "",
    module: "互联网应用与创新",
    source: "义务教育信息科技教学指南",
    suggestedActivities: [],
    updatedAt: new Date().toISOString()
  };
}

function parseGuideJsonEntries(text: string): { entries: GuideBasisEntry[]; ok: true } | { error: string; ok: false } {
  const trimmed = stripCodeFence(text).trim();
  if (!trimmed) return { error: "请先粘贴 JSON 内容。", ok: false };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const entries = list.map((item) => normalizeGuideEntry(item)).filter((item) => item.lessonTitle);
    if (entries.length === 0) return { error: "JSON 已解析，但没有找到课题名称字段。请检查 lessonTitle 或「课题名称」。", ok: false };
    return { entries, ok: true };
  } catch (error) {
    const extracted = extractJsonPayload(trimmed);
    if (extracted && extracted !== trimmed) {
      try {
        const parsed = JSON.parse(extracted) as unknown;
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const entries = list.map((item) => normalizeGuideEntry(item)).filter((item) => item.lessonTitle);
        if (entries.length > 0) return { entries, ok: true };
      } catch {
        // Fall through to the clearer original error below.
      }
    }
    return {
      error: `JSON 解析失败：${error instanceof Error ? error.message : "格式不正确"}。请确认没有多余说明文字，或只保留 [{...}] / {...} 内容。`,
      ok: false
    };
  }
}

function normalizeGuideEntry(value: unknown): GuideBasisEntry {
  const raw = (value || {}) as Record<string, unknown>;
  const item = raw as Partial<GuideBasisEntry> & {
    keypoints?: string[];
    lesson?: string;
    objectives?: string[];
    title?: string;
  };
  const lessonTitle = stringField(raw, ["lessonTitle", "title", "lesson", "课题名称", "课题", "课时名称", "课程名称"]);
  return {
    difficultPoints: toStringList(firstField(raw, ["difficultPoints", "difficulties", "难点", "教学难点"])),
    grade: stringField(raw, ["grade", "年级"]) || "七年级",
    id: String(item.id || `guide-${lessonTitle || Date.now()}-${Math.random().toString(16).slice(2)}`),
    keyPoints: toStringList(firstField(raw, ["keyPoints", "keypoints", "重点", "教学重点"])),
    keywords: toStringList(firstField(raw, ["keywords", "关键词"])),
    learningObjectives: toStringList(firstField(raw, ["learningObjectives", "objectives", "学习目标", "目标"])),
    lessonTitle,
    module: normalizeGuideModule(stringField(raw, ["module", "课程模块", "模块"]) || "互联网应用与创新", stringField(raw, ["grade", "年级"]) || "七年级"),
    source: stringField(raw, ["source", "依据来源", "来源"]) || "义务教育信息科技教学指南",
    suggestedActivities: toStringList(firstField(raw, ["suggestedActivities", "activities", "建议活动", "活动建议", "教学活动"])),
    updatedAt: new Date().toISOString()
  };
}

function parseGuideTextEntry(text: string, filename = "") {
  const lines = splitLines(text.trim());
  if (lines.length === 0) return [];
  return [normalizeGuideEntry({
    lessonTitle: filename.replace(/\.(txt|md)$/i, "") || lines[0],
    learningObjectives: lines,
    source: filename || "文本导入"
  })];
}

function stripCodeFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractJsonPayload(value: string) {
  const start = value.search(/[[{]/);
  if (start < 0) return "";
  const opener = value[start];
  const closer = opener === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === opener) depth += 1;
    if (char === closer) depth -= 1;
    if (depth === 0) return value.slice(start, index + 1);
  }
  return "";
}

function firstField(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  }
  return undefined;
}

function stringField(raw: Record<string, unknown>, keys: string[]) {
  const value = firstField(raw, keys);
  return value === undefined || value === null ? "" : String(value).trim();
}

function mergeGuideEntries(oldEntries: GuideBasisEntry[], newEntries: GuideBasisEntry[]) {
  const map = new Map(oldEntries.map((item) => [item.id, item]));
  for (const entry of newEntries) map.set(entry.id, entry);
  return Array.from(map.values());
}

function groupGuideEntries(entries: GuideBasisEntry[]) {
  const map = new Map<string, { grade: string; items: GuideBasisEntry[]; key: string; module: string }>();
  for (const entry of entries) {
    const grade = entry.grade || "未分年级";
    const module = normalizeGuideModule(entry.module || "未分模块", grade);
    const key = `${grade}__${module}`;
    const group = map.get(key) || { grade, items: [], key, module };
    group.items.push(entry);
    map.set(key, group);
  }
  return Array.from(map.values())
    .map((group) => ({ ...group, items: group.items.sort((a, b) => a.lessonTitle.localeCompare(b.lessonTitle, "zh-CN")) }))
    .sort((a, b) => `${a.grade}${a.module}`.localeCompare(`${b.grade}${b.module}`, "zh-CN"));
}

function normalizeGuideModule(module: string, grade: string) {
  if (grade.includes("九年级")) return "人工智能与智慧社会";
  return module.replace("人工智能与智慧社会人工智能", "人工智能与智慧社会").trim();
}

function splitLines(value: string) {
  return value.split(/[\n、,，;；]/).map((item) => item.trim()).filter(Boolean);
}

function toStringList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return splitLines(value);
  return [];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

interface StudentData {
  studentInfo?: { className?: string; studentName?: string; studentNumber?: string };
  progress?: { taskCompletionRate?: number; assessmentCompletionRate?: number };
  diagnosisSignals?: Record<string, string>;
}

function createClassAnalysis(items: StudentData[]) {
  const count = items.length;
  const taskRate = Math.round(avg(items.map((item) => item.progress?.taskCompletionRate ?? 0)));
  const assessmentRate = Math.round(avg(items.map((item) => item.progress?.assessmentCompletionRate ?? 0)));
  const weakPoint = assessmentRate < 70 ? "测评理解偏弱" : taskRate < 70 ? "任务完成偏弱" : "整体表现较稳定";
  const names = (list: StudentData[]) => list.map((item, index) => item.studentInfo?.studentName || `学生${index + 1}`);
  const taskWeakness = Math.max(0, 100 - taskRate);
  const assessmentWeakness = Math.max(0, 100 - assessmentRate);
  const responsibilityWeakness = Math.round(items.filter((item) => !JSON.stringify(item.diagnosisSignals || {}).includes("责任")).length / Math.max(1, count) * 100);
  const expressionWeakness = Math.round((taskWeakness + assessmentWeakness) / 2);
  const weaknessRank = [
    { label: "概念理解不清", value: assessmentWeakness },
    { label: "任务步骤不完整", value: taskWeakness },
    { label: "表达证据不足", value: expressionWeakness },
    { label: "安全责任表达偏弱", value: responsibilityWeakness }
  ].sort((a, b) => b.value - a.value);
  return {
    count,
    taskRate,
    assessmentRate,
    weakPoint,
    literacy: [
      { name: "信息意识", comment: taskRate >= 75 ? "能较好发现和描述信息问题。" : "需要更多真实情境引导。" },
      { name: "计算思维", comment: assessmentRate >= 75 ? "过程表达较清楚。" : "步骤拆分和解释还需加强。" },
      { name: "数字化学习与创新", comment: "可结合任务完成情况继续观察。" },
      { name: "信息社会责任", comment: "建议在反思中继续加入安全、隐私和规范使用表达。" }
    ],
    groups: {
      strong: names(items.filter((item) => (item.progress?.taskCompletionRate ?? 0) >= 80 && (item.progress?.assessmentCompletionRate ?? 0) >= 80)),
      support: names(items.filter((item) => (item.progress?.taskCompletionRate ?? 0) < 60 || (item.progress?.assessmentCompletionRate ?? 0) < 60)),
      watch: names(items.filter((item) => {
        const task = item.progress?.taskCompletionRate ?? 0;
        const assessment = item.progress?.assessmentCompletionRate ?? 0;
        return task >= 60 && assessment >= 60 && (task < 80 || assessment < 80);
      }))
    },
    issueBars: [
      { label: "任务薄弱比例", value: taskWeakness },
      { label: "测评薄弱比例", value: assessmentWeakness },
      { label: "表达证据不足", value: expressionWeakness }
    ],
    suggestions: [
      weakPoint === "测评理解偏弱" ? "下一节课建议增加原理解释和情境迁移练习。" : "下一节课可安排更高阶的迁移表达任务。",
      "对需要支持的学生提供流程图模板或句式支架。",
      "保留学生任务单和测评题作为后续学情追踪依据。"
    ],
    weaknessRank
  };
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
}

export default App;
