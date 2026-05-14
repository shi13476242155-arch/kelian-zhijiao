import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  ClassroomResourcePackage,
  CoreLiteracy,
  GenerationScope,
  Grade,
  LessonType,
  TeachingNeed
} from "@kelian-zhixue/shared";
import {
  ArrowRight,
  BookOpenText,
  Check,
  ClipboardCheck,
  FileDown,
  Gauge,
  Home,
  LibraryBig,
  Lightbulb,
  PenLine,
  Route,
  Save,
  Sparkles,
  UsersRound
} from "lucide-react";
import { recentLesson, sampleLesson, workspacePages } from "./mock";

const teachingNeedStorageKey = "kelian.teachingNeed.v1";
const resourcePackageStorageKey = "kelian.resourcePackage.v2";
const resourcePackageStatusKey = "kelian.resourcePackage.status.v2";
const teacherDraftStorageKey = "kelian.teacherDraft.v2.6";
const assistantMessagesStorageKey = "kelian.assistantMessages.v2.6";
const revisionLogStorageKey = "kelian.revisionLog.v2.6";

const defaultModuleByGrade: Record<Grade, string> = {
  七年级: "互联网应用与创新",
  八年级: "物联网实践与探索",
  九年级: "人工智能与智慧社会人工智能"
};

const lessonTypes: LessonType[] = ["新授课", "项目实践课", "实验探究课", "技能训练课", "跨学科主题课"];

const generationScopes: GenerationScope[] = ["只生成教学设计", "生成完整课堂资源包"];

const promptTemplates = [
  { label: "项目式学习", text: "希望围绕一个真实项目组织探究、制作和展示。" },
  { label: "跨学科融合", text: "希望结合其他学科情境设计综合性学习任务。" },
  { label: "小组协作", text: "希望安排小组分工、协作探究和成果交流。" },
  { label: "真实情境", text: "希望结合真实生活或校园情境设计学习任务。" },
  { label: "计算思维", text: "希望突出分解问题、抽象建模、设计算法和迁移表达。" },
  { label: "交互性强", text: "希望课堂活动有较强互动，便于学生参与、讨论和即时反馈。" },
  { label: "工程实践", text: "希望引导学生经历设计、制作、测试、优化和展示的过程。" }
];

const assistantPersonas: AssistantPersona[] = ["资深信息科技教师", "教学设计专家", "AI教研员"];

const iconMap = [
  Home,
  PenLine,
  Sparkles,
  Route,
  Gauge,
  FileDown,
  UsersRound,
  LibraryBig
];

const quickEntries = [
  {
    title: "新建课例",
    text: "填写课题、学情和设备条件。",
    meta: "从空白课例开始",
    button: "开始新建",
    target: "new-lesson",
    icon: PenLine,
    primary: true
  },
  {
    title: "继续备课",
    text: "生成、修订并定稿资源。",
    meta: `最后编辑：${recentLesson.grade}《${recentLesson.title}》 ${recentLesson.updatedAt}`,
    button: "进入备课工作台",
    target: "prep-workbench",
    icon: ClipboardCheck,
    primary: false
  },
  {
    title: "打开案例",
    text: "先看一个完整样例。",
    meta: `推荐：《${sampleLesson.title}》`,
    button: "查看案例",
    target: "cases",
    icon: BookOpenText,
    primary: false
  }
];

const flowSteps = [
  { title: "新建课例", description: "确定学情与目标", target: "new-lesson" },
  { title: "备课工作台", description: "生成并修订资源", target: "prep-workbench", ai: true },
  { title: "素养证据链", description: "对齐目标与证据", target: "literacy" },
  { title: "质量评估", description: "对齐课标要求", target: "quality" },
  { title: "资源导出", description: "多格式打包", target: "export" },
  { title: "学情分析", description: "形成改进建议", target: "learning-profile" }
];

const emptyTeachingNeed: TeachingNeed = {
  topicName: "",
  grade: "七年级",
  courseModule: defaultModuleByGrade["七年级"],
  classHours: "1",
  studentFoundation: "",
  equipmentCondition: "",
  teachingObjectives: "",
  teachingFocus: "",
  teachingDifficulty: "",
  lessonType: "新授课",
  generationScope: "生成完整课堂资源包",
  additionalNeeds: "",
  updatedAt: ""
};

const requiredMessages: Partial<Record<keyof TeachingNeed, string>> = {
  topicName: "请先写下本节课的课题，方便后续生成资源。",
  grade: "请选择授课年级。",
  courseModule: "请确认本课所属课程模块。",
  classHours: "请填写本课计划使用的课时数。",
  studentFoundation: "请简单说明学生已有基础，便于生成更贴合班级的资源。",
  equipmentCondition: "请说明机房或设备条件，避免生成无法落地的活动。",
  lessonType: "请选择本节课的课堂类型。",
  generationScope: "请选择希望系统生成到什么程度。"
};

type TeachingNeedErrors = Partial<Record<keyof TeachingNeed, string>>;
type AssistantPersona = "资深信息科技教师" | "教学设计专家" | "AI教研员";

interface SuggestionCardData {
  title: string;
  reason: string;
  content: string;
}

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  persona: AssistantPersona;
  module: string;
  content: string;
  time: string;
  applied: boolean;
  suggestion?: SuggestionCardData;
}

interface RevisionLogItem {
  id: string;
  time: string;
  module: string;
  action: string;
  description: string;
  source: "ai_suggestion";
  persona: AssistantPersona;
}

function resolvePageId(pageId: string) {
  if (pageId === "generate" || pageId === "revise" || pageId === "resource-generate" || pageId === "resource-edit") {
    return "prep-workbench";
  }
  return pageId;
}

export function App() {
  const [activePageId, setActivePageId] = useState(workspacePages[0].id);
  const canonicalPageId = resolvePageId(activePageId);
  const activePage = useMemo(
    () => workspacePages.find((page) => page.id === canonicalPageId) ?? workspacePages[0],
    [canonicalPageId]
  );
  const isHome = activePage.id === "home";

  function navigate(pageId: string) {
    setActivePageId(resolvePageId(pageId));
  }

  function loadSampleLesson() {
    window.localStorage.setItem("kelian.currentLesson", JSON.stringify(sampleLesson));
    navigate("prep-workbench");
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-5 py-6 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-600 text-white">
              <Lightbulb size={23} />
            </div>
            <div>
              <p className="text-lg font-semibold">课链智学</p>
              <p className="text-sm text-slate-500">教师智能导学工作台</p>
            </div>
          </div>

          <nav className="space-y-1">
            {workspacePages.map((page, index) => {
              const Icon = iconMap[index];
              const active = page.id === activePage.id;
              return (
                <button
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                  }`}
                  key={page.id}
                  onClick={() => navigate(page.id)}
                  type="button"
                  title={page.navLabel}
                >
                  <Icon size={18} />
                  <span>{page.navLabel}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1">
          <section className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8">
              <div className="max-w-3xl">
                <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                  {activePage.title}
                </h1>
                <p className="mt-3 text-lg leading-8 text-slate-600">{activePage.subtitle}</p>
              </div>
            </div>
          </section>

          {isHome ? (
            <HomePage activePageId={canonicalPageId} onNavigate={navigate} onUseTemplate={loadSampleLesson} />
          ) : activePageId === "new-lesson" ? (
            <NewLessonPage onNext={() => navigate("prep-workbench")} />
          ) : canonicalPageId === "prep-workbench" ? (
            <PrepWorkbenchPage onNavigate={navigate} />
          ) : canonicalPageId === "literacy" ? (
            <LiteracyEvidencePage onNavigate={navigate} />
          ) : canonicalPageId === "cases" ? (
            <CasesPage onNavigate={navigate} />
          ) : (
            <PlaceholderPage title={activePage.title} onBackHome={() => navigate("home")} />
          )}
        </main>
      </div>
    </div>
  );
}

function HomePage({
  activePageId,
  onNavigate,
  onUseTemplate
}: {
  activePageId: string;
  onNavigate: (pageId: string) => void;
  onUseTemplate: () => void;
}) {
  const currentStepIndex =
    activePageId === "home" ? 0 : flowSteps.findIndex((step) => step.target === activePageId);

  return (
    <section className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-teal-100 bg-white p-6 shadow-soft">
          <div className="mb-6">
            <p className="text-sm font-semibold text-teal-700">今日备课</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">从新建课例开始</h2>
            <p className="mt-3 text-sm text-slate-500">先确定课题和学情，再生成、修订和导出材料。</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {quickEntries.map((entry) => (
              <div
                className={`flex min-h-56 flex-col rounded-lg border p-4 ${
                  entry.primary ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"
                }`}
                key={entry.title}
              >
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-md ${
                    entry.primary ? "bg-teal-600 text-white" : "bg-slate-50 text-teal-700"
                  }`}
                >
                  <entry.icon size={22} />
                </div>
                <h3 className="text-lg font-semibold text-slate-950">{entry.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{entry.text}</p>
                <p className="mt-3 text-xs leading-5 text-slate-500">{entry.meta}</p>
                <button
                  className={`mt-auto inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition ${
                    entry.primary
                      ? "bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                      : "bg-white text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50"
                  }`}
                  onClick={() => onNavigate(entry.target)}
                  type="button"
                >
                  {entry.button}
                  <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold text-teal-700">示例课例</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">《{sampleLesson.title}》</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
              {sampleLesson.grade}
            </span>
            <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
              {sampleLesson.module}
            </span>
            <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
              {sampleLesson.duration}
            </span>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-600">
            用“快递分包”类比数据拆分、编号、传输和重组。
          </p>
          <button
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-50"
            onClick={onUseTemplate}
            type="button"
          >
            以此为模板新建
            <ArrowRight size={16} />
          </button>
        </aside>
      </div>

      <FlowTrack activePageId={activePageId} onNavigate={onNavigate} />
    </section>
  );
}

function NewLessonPage({ onNext }: { onNext: () => void }) {
  const [need, setNeed] = useState<TeachingNeed>(() => loadTeachingNeed());
  const [errors, setErrors] = useState<TeachingNeedErrors>({});
  const [savedMessage, setSavedMessage] = useState(getInitialSaveMessage(need.updatedAt));
  const [assistMessage, setAssistMessage] = useState("");

  function updateField<K extends keyof TeachingNeed>(field: K, value: TeachingNeed[K]) {
    setNeed((current) => {
      if (field === "grade") {
        const nextGrade = value as Grade;
        const shouldUseDefaultModule =
          !current.courseModule ||
          Object.values(defaultModuleByGrade).includes(current.courseModule);
        return {
          ...current,
          grade: nextGrade,
          courseModule: shouldUseDefaultModule ? defaultModuleByGrade[nextGrade] : current.courseModule
        };
      }
      return { ...current, [field]: value };
    });
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSavedMessage("有未保存修改");
  }

  function saveNeed(nextNeed = need) {
    const payload = { ...nextNeed, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(teachingNeedStorageKey, JSON.stringify(payload));
    setNeed(payload);
    setSavedMessage(`草稿已保存：${formatTime(payload.updatedAt)}`);
    return payload;
  }

  function handleNext() {
    const nextErrors = validateTeachingNeed(need);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSavedMessage("还有几项关键信息需要补充后再进入备课工作台。");
      return;
    }
    saveNeed();
    onNext();
  }

  function appendTemplate(text: string) {
    updateField("additionalNeeds", appendSentence(need.additionalNeeds, text));
  }

  function handleAiDraft() {
    if (!need.topicName.trim()) {
      setAssistMessage("请先填写课题名称，再让系统试写目标和重难点。");
      return;
    }
    const draft = createDesignDraft(need);
    setNeed((current) => ({ ...current, ...draft }));
    setAssistMessage("已生成教学目标、重点和难点初稿，请根据班级情况修改确认。");
    setSavedMessage("有未保存修改");
  }

  const hasTopic = need.topicName.trim().length > 0;

  return (
    <section className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
            <div className="mb-5">
              <p className="text-sm font-semibold text-teal-700">教学需求</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">先写最关键的信息</h2>
              <p className="mt-2 text-sm text-slate-500">
                先告诉系统课题、年级和班级情况，目标和重难点可以让系统先写初稿。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                error={errors.topicName}
                label="课题名称"
                onChange={(value) => updateField("topicName", value)}
                placeholder="例如：数据分包灵活传"
                required
                value={need.topicName}
              />
              <SelectField
                error={errors.grade}
                label="年级"
                onChange={(value) => updateField("grade", value as Grade)}
                options={["七年级", "八年级", "九年级"]}
                required
                value={need.grade}
              />
              <TextField
                error={errors.courseModule}
                hint={`当前年级推荐：${defaultModuleByGrade[need.grade]}`}
                label="课程模块"
                onChange={(value) => updateField("courseModule", value)}
                required
                value={need.courseModule}
              />
              <TextField
                error={errors.classHours}
                label="课时数"
                onChange={(value) => updateField("classHours", value)}
                placeholder="例如：1"
                required
                value={need.classHours}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
            <div className="mb-4">
              <p className="text-sm font-semibold text-teal-700">个性化生成向导</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">把你的想法告诉系统</h3>
            </div>
            <TextAreaField
              minHeightClass="min-h-32"
              onChange={(value) => updateField("additionalNeeds", value)}
              placeholder="例如：希望课堂活动多一些小组讨论，评价题贴近校园网络使用情境。"
              value={need.additionalNeeds}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {promptTemplates.map((template) => (
                <button
                  className="rounded-md bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-100 transition hover:bg-teal-100"
                  key={template.label}
                  onClick={() => appendTemplate(template.text)}
                  type="button"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-950">学情与课堂条件</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextAreaField
                error={errors.studentFoundation}
                hint="例如：学生会使用浏览器，但不了解数据传输过程。"
                label="学生基础"
                minHeightClass="min-h-40"
                onChange={(value) => updateField("studentFoundation", value)}
                required
                value={need.studentFoundation}
              />
              <TextAreaField
                error={errors.equipmentCondition}
                hint="例如：机房可上网，学生两人一机，教师机可投屏。"
                label="机房或设备条件"
                minHeightClass="min-h-40"
                onChange={(value) => updateField("equipmentCondition", value)}
                required
                value={need.equipmentCondition}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">教学设计要点</h3>
                <p className="mt-1 text-sm text-slate-500">这里可以先让系统写初稿，教师再修改确认。</p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-50"
                onClick={handleAiDraft}
                type="button"
              >
                <Sparkles size={16} />
                试试 AI 帮我写
              </button>
            </div>
            {assistMessage ? <p className="mt-3 text-sm text-amber-700">{assistMessage}</p> : null}
            <div className="mt-4 grid gap-4">
              <TextAreaField
                hint="写下希望学生本节课能理解、会做或能表达的内容。"
                label="教学目标"
                onChange={(value) => updateField("teachingObjectives", value)}
                value={need.teachingObjectives}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <TextAreaField
                  label="教学重点"
                  onChange={(value) => updateField("teachingFocus", value)}
                  placeholder="例如：理解数据分包传输的基本过程。"
                  value={need.teachingFocus}
                />
                <TextAreaField
                  label="教学难点"
                  onChange={(value) => updateField("teachingDifficulty", value)}
                  placeholder="例如：用生活类比解释编号、传输和重组。"
                  value={need.teachingDifficulty}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-950">生成方式</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SelectField
                error={errors.lessonType}
                label="课堂类型"
                onChange={(value) => updateField("lessonType", value as LessonType)}
                options={lessonTypes}
                required
                value={need.lessonType}
              />
              <SelectField
                error={errors.generationScope}
                label="生成范围"
                onChange={(value) => updateField("generationScope", value as GenerationScope)}
                options={generationScopes}
                required
                value={need.generationScope}
              />
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-5 border-t border-slate-200 bg-paper/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
            <div className="mx-auto flex max-w-[1180px] flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
              <p className={`text-sm ${Object.keys(errors).length > 0 ? "text-amber-700" : "text-slate-500"}`}>
                {savedMessage || "草稿会保存在本机，刷新页面后仍可继续填写。"}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-50"
                  onClick={() => saveNeed()}
                  type="button"
                >
                  <Save size={16} />
                  保存草稿
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                  onClick={handleNext}
                  type="button"
                >
                  下一步：进入备课工作台
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="sticky top-6 rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold text-teal-700">本课生成建议</p>
            {hasTopic ? (
              <>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">{need.topicName}</h2>
                <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                  {buildDetailedSuggestions(need).map((suggestion) => (
                    <SuggestionItem key={suggestion.title} title={suggestion.title} text={suggestion.text} />
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                输入课题和年级后，系统将为您匹配课程标准与教学建议。
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

const resourceTabs = [
  { id: "basis", label: "课程依据" },
  { id: "tpack", label: "TPACK 分析" },
  { id: "literacy", label: "素养证据链" },
  { id: "design", label: "教学设计" },
  { id: "task", label: "学习任务单" },
  { id: "assessment", label: "分层测评题" },
  { id: "diagnosis", label: "学情诊断模板" }
] as const;

type ResourceTabId = (typeof resourceTabs)[number]["id"];

function PrepWorkbenchPage({ onNavigate }: { onNavigate: (pageId: string) => void }) {
  const [need] = useState<TeachingNeed>(() => loadTeachingNeedForGeneration());
  const [resourcePackage, setResourcePackage] = useState<ClassroomResourcePackage | null>(() =>
    loadResourcePackage()
  );
  const [activeTab, setActiveTab] = useState<ResourceTabId>("basis");
  const [message, setMessage] = useState("");
  const [editorText, setEditorText] = useState(() => {
    const savedPackage = loadResourcePackage();
    return loadTeacherDraft() || (savedPackage ? getEditableText(savedPackage) : "");
  });
  const [isFinalized, setIsFinalized] = useState(() => loadResourceStatus() === "finalized");
  const [persona, setPersona] = useState<AssistantPersona>("资深信息科技教师");
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>(() => loadAssistantMessages());
  const [freeRequest, setFreeRequest] = useState("");
  const hasTeachingNeed = need.topicName.trim().length > 0;
  const currentPackage =
    resourcePackage?.teachingNeed.topicName === need.topicName ? resourcePackage : null;
  const currentModule = getResourceModuleLabel(activeTab);
  const resourceStatus = isFinalized
    ? "教师确认版"
    : currentPackage && "teacherEditedText" in currentPackage
      ? "教师修改版"
      : "AI初稿";

  function handleGenerate() {
    const nextPackage = createMockResourcePackage(need);
    window.localStorage.setItem(resourcePackageStorageKey, JSON.stringify(nextPackage));
    window.localStorage.setItem(resourcePackageStatusKey, "draft");
    setResourcePackage(nextPackage);
    setActiveTab("basis");
    setEditorText(packageToEditableText(nextPackage));
    window.localStorage.setItem(teacherDraftStorageKey, packageToEditableText(nextPackage));
    setIsFinalized(false);
    setMessage(`已生成并保存：${formatTime(nextPackage.generatedAt)}`);
  }

  function handleSaveEdits() {
    if (!currentPackage) {
      setMessage("请先生成课堂资源包，再保存修改。");
      return;
    }
    const nextPackage = {
      ...currentPackage,
      generatedAt: new Date().toISOString(),
      teacherEditedText: editorText
    } as ClassroomResourcePackage & { teacherEditedText: string };
    window.localStorage.setItem(resourcePackageStorageKey, JSON.stringify(nextPackage));
    window.localStorage.setItem(resourcePackageStatusKey, "draft");
    window.localStorage.setItem(teacherDraftStorageKey, editorText);
    setResourcePackage(nextPackage);
    setIsFinalized(false);
    setMessage(`修改已保存：${formatTime(nextPackage.generatedAt)}`);
  }

  function handleFinalize() {
    if (!currentPackage) {
      setMessage("请先生成课堂资源包，再确认定稿。");
      return;
    }
    window.localStorage.setItem(resourcePackageStatusKey, "finalized");
    setIsFinalized(true);
    setMessage("已确认定稿，后续可进入质量评估或导出资源包。");
  }

  function handleAskAssistant(action: string) {
    if (!currentPackage) {
      setMessage("请先生成课堂资源包，再使用 AI 修订助手。");
      return;
    }
    const now = new Date().toISOString();
    const userMessage: AssistantMessage = {
      id: createId("user"),
      role: "user",
      persona,
      module: currentModule,
      content: action,
      time: now,
      applied: false
    };
    const suggestion = createAssistantSuggestion({
      persona,
      module: currentModule,
      tab: activeTab,
      action,
      need
    });
    const assistantMessage: AssistantMessage = {
      id: createId("assistant"),
      role: "assistant",
      persona,
      module: currentModule,
      content: suggestion.content,
      time: new Date().toISOString(),
      applied: false,
      suggestion
    };
    persistAssistantMessages([...assistantMessages, userMessage, assistantMessage]);
  }

  function handleFreeAsk() {
    const request = freeRequest.trim();
    if (!request) {
      setMessage("请先写下你的修订需求。");
      return;
    }
    handleAskAssistant(request);
    setFreeRequest("");
  }

  function persistAssistantMessages(nextMessages: AssistantMessage[]) {
    setAssistantMessages(nextMessages);
    window.localStorage.setItem(assistantMessagesStorageKey, JSON.stringify(nextMessages));
  }

  function handleApplySuggestion(message: AssistantMessage) {
    if (!message.suggestion || !currentPackage) {
      return;
    }
    const appliedText = [
      editorText.trim(),
      "",
      `【AI 修订建议已应用｜${message.module}｜${message.persona}】`,
      message.suggestion.content
    ]
      .filter(Boolean)
      .join("\n");
    const nextPackage = {
      ...currentPackage,
      generatedAt: new Date().toISOString(),
      teacherEditedText: appliedText
    } as ClassroomResourcePackage & { teacherEditedText: string };
    const logItem: RevisionLogItem = {
      id: createId("revision"),
      time: new Date().toISOString(),
      module: message.module,
      action: "应用 AI 修订建议",
      description: message.suggestion.title,
      source: "ai_suggestion",
      persona: message.persona
    };
    const nextMessages = assistantMessages.map((item) =>
      item.id === message.id ? { ...item, applied: true } : item
    );
    setEditorText(appliedText);
    setResourcePackage(nextPackage);
    setIsFinalized(false);
    persistAssistantMessages(nextMessages);
    saveRevisionLog(logItem);
    window.localStorage.setItem(resourcePackageStorageKey, JSON.stringify(nextPackage));
    window.localStorage.setItem(resourcePackageStatusKey, "draft");
    window.localStorage.setItem(teacherDraftStorageKey, appliedText);
    setMessage("AI 修订建议已应用，并保存为教师修改版。");
  }

  function handleDismissSuggestion(messageId: string) {
    persistAssistantMessages(assistantMessages.filter((item) => item.id !== messageId));
  }

  if (!hasTeachingNeed) {
    return (
      <section className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold text-teal-700">还没有可生成的课例</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">请先填写新建课例信息</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            备课工作台会根据课题、年级、课程模块、学情和设备条件生成课堂资源包。先完成教学需求输入，生成结果会保存在本机。
          </p>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
            onClick={() => onNavigate("new-lesson")}
            type="button"
          >
            去新建课例
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">当前课例</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">《{need.topicName}》</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-md bg-teal-50 px-2.5 py-1 text-teal-700">{need.grade}</span>
              <span className="rounded-md bg-teal-50 px-2.5 py-1 text-teal-700">{need.courseModule}</span>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-600">{need.classHours}课时</span>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-600">{need.lessonType}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
              onClick={handleGenerate}
              type="button"
            >
              <Sparkles size={16} />
              生成课堂资源包
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-50"
              onClick={handleSaveEdits}
              type="button"
            >
              <Save size={16} />
              保存修改
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-50"
              onClick={handleFinalize}
              type="button"
            >
              <Check size={16} />
              确认定稿
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-50"
              onClick={() => onNavigate("literacy")}
              type="button"
            >
              查看素养证据链
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <span className="font-semibold text-slate-900">备课状态：</span>
          本页使用本地 mock 规则生成课堂资源包，教师可在当前页面修改并定稿。
          {isFinalized ? <span className="ml-2 text-teal-700">当前资源已定稿。</span> : null}
          {message ? <span className="ml-2 text-teal-700">{message}</span> : null}
        </div>
      </div>

      {currentPackage ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {resourceTabs.map((tab) => (
                <button
                  className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? "bg-teal-600 text-white"
                      : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-teal-50 hover:text-teal-700"
                  }`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="mt-5">{renderResourceTab(currentPackage, activeTab)}</div>
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-950">编辑模式</h3>
                  <p className="mt-1 text-sm text-slate-500">按分区文本修订资源包，适合先快速打磨课堂材料。</p>
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                  onClick={handleSaveEdits}
                  type="button"
                >
                  <Save size={16} />
                  保存修改
                </button>
              </div>
              <textarea
                className="mt-4 min-h-96 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                onChange={(event) => setEditorText(event.target.value)}
                value={editorText}
              />
            </div>
          </div>
          <aside className="space-y-4">
            <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-lg border border-teal-100 bg-teal-50 p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <Sparkles className="text-teal-700" size={18} />
                <h3 className="font-semibold text-slate-950">AI 修订助手</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                本阶段先提供演示建议。建议不会自动覆盖正文，应用后会追加到编辑区。
              </p>

              <div className="mt-4 rounded-md bg-white p-3 text-sm leading-6 ring-1 ring-teal-100">
                <DetailLine label="当前课题" value={need.topicName} />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <DetailLine label="当前模块" value={currentModule} />
                  <DetailLine label="资源状态" value={resourceStatus} />
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-900">助手人设</p>
                <div className="mt-2 grid gap-2">
                  {assistantPersonas.map((item) => (
                    <button
                      className={`rounded-md px-3 py-2 text-left text-sm font-semibold ring-1 transition ${
                        persona === item
                          ? "bg-teal-600 text-white ring-teal-600"
                          : "bg-white text-slate-700 ring-teal-100 hover:bg-teal-50"
                      }`}
                      key={item}
                      onClick={() => setPersona(item)}
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{getPersonaHint(persona)}</p>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-900">快捷修订</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {getQuickRevisionActions(activeTab).map((action) => (
                    <button
                      className="rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-100 transition hover:bg-teal-100"
                      key={action}
                      onClick={() => handleAskAssistant(action)}
                      type="button"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-900">自由修订需求</p>
                <textarea
                  className="mt-2 min-h-24 w-full resize-y rounded-md border border-teal-100 bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) => setFreeRequest(event.target.value)}
                  placeholder="例如：这个活动七年级学生可能听不懂，帮我改得更具体。"
                  value={freeRequest}
                />
                <button
                  className="mt-2 w-full rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
                  onClick={handleFreeAsk}
                  type="button"
                >
                  生成修订建议
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-sm font-semibold text-slate-900">AI 修订建议</p>
                {assistantMessages.filter((item) => item.role === "assistant").length === 0 ? (
                  <div className="rounded-md bg-white p-3 text-sm leading-6 text-slate-500 ring-1 ring-teal-100">
                    选择一个快捷修订，或写下你的具体需求，助手会生成可应用的建议卡片。
                  </div>
                ) : null}
                {assistantMessages
                  .filter((item) => item.role === "assistant")
                  .slice()
                  .reverse()
                  .map((item) => (
                    <SuggestionCard
                      key={item.id}
                      message={item}
                      onApply={() => handleApplySuggestion(item)}
                      onDismiss={() => handleDismissSuggestion(item.id)}
                    />
                  ))}
              </div>

              <div className="mt-4 grid gap-2 border-t border-teal-100 pt-4">
                <button
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-50"
                  onClick={() => onNavigate("quality")}
                  type="button"
                >
                  进入质量评估
                </button>
                <button
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-50"
                  onClick={() => onNavigate("export")}
                  type="button"
                >
                  导出资源包
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold text-teal-700">待生成内容</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-950">完整课堂资源包</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              {resourceTabs.map((tab) => (
                <div className="rounded-md bg-slate-50 p-3" key={tab.id}>
                  <Check className="mb-2 text-teal-600" size={16} />
                  {tab.label}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-teal-100 bg-teal-50 p-6">
            <p className="text-sm font-semibold text-teal-700">生成依据</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-950">来自新建课例的教学需求</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              系统将综合“{need.topicName}”、{need.grade}、{need.courseModule}、{need.lessonType}
              、学生基础和设备条件，生成可修改的课堂资源初稿。
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function LiteracyEvidencePage({ onNavigate }: { onNavigate: (pageId: string) => void }) {
  const resourcePackage = loadResourcePackage();

  if (!resourcePackage) {
    return (
      <section className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold text-teal-700">还没有素养证据链</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">请先生成课堂资源包</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            生成资源包后，本页会自动展示“核心素养—教学目标—学习活动—任务证据—测评证据—评价方式”的对应关系。
          </p>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
            onClick={() => onNavigate("prep-workbench")}
            type="button"
          >
            进入备课工作台
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold text-teal-700">当前课例</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          《{resourcePackage.teachingNeed.topicName}》素养证据链
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          用证据链检查课堂活动是否真正支撑核心素养，而不是只停留在素养名称罗列。
        </p>
      </div>
      <div className="mt-6 space-y-4">
        {resourcePackage.literacyEvidenceChain.map((item) => (
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft" key={item.literacy}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-semibold text-slate-950">{item.literacy}</h3>
              <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                {item.achievementStatus}
              </span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <DetailLine label="教学目标" value={item.teachingObjective} />
              <DetailLine label="学习活动" value={item.learningActivity} />
              <DetailLine label="任务证据" value={item.taskEvidence} />
              <DetailLine label="测评证据" value={item.assessmentEvidence} />
              <DetailLine label="评价方式" value={item.evaluationMethod} />
              <DetailLine label="优化建议" value={item.improvementSuggestion} />
            </div>
          </article>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-50"
          onClick={() => onNavigate("prep-workbench")}
          type="button"
        >
          返回备课工作台
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          onClick={() => onNavigate("quality")}
          type="button"
        >
          进入质量评估
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

function CasesPage({ onNavigate }: { onNavigate: (pageId: string) => void }) {
  function loadCase() {
    window.localStorage.setItem("kelian.currentLesson", JSON.stringify(sampleLesson));
    onNavigate("prep-workbench");
  }

  return (
    <section className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8">
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold text-teal-700">精品案例</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">《{sampleLesson.title}》</h2>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-md bg-teal-50 px-2.5 py-1 text-teal-700">{sampleLesson.grade}</span>
            <span className="rounded-md bg-teal-50 px-2.5 py-1 text-teal-700">{sampleLesson.module}</span>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-600">{sampleLesson.duration}</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            亮点：用“快递分包”类比数据拆分、编号、传输和重组，并引导学生讨论网络服务中的隐私保护。
          </p>
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
            onClick={loadCase}
            type="button"
          >
            载入案例
            <ArrowRight size={16} />
          </button>
        </article>
      </div>
    </section>
  );
}

function FlowTrack({
  activePageId,
  onNavigate
}: {
  activePageId: string;
  onNavigate: (pageId: string) => void;
}) {
  const currentStepIndex =
    activePageId === "home" ? 0 : flowSteps.findIndex((step) => step.target === activePageId);

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white/90 px-5 py-4 shadow-soft backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-950">备课流程</h2>
        <span className="text-xs text-slate-500">点击步骤快速进入对应环节</span>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
        {flowSteps.map((step, index) => {
          const isCurrent = currentStepIndex === index;
          const isDone = currentStepIndex > index;
          return (
            <div className="contents" key={step.target}>
              <button
                className={`min-h-16 rounded-md px-3 py-2 text-left ring-1 transition ${
                  isCurrent
                    ? "bg-gradient-to-br from-teal-600 to-teal-700 text-white ring-teal-600 shadow-sm"
                    : isDone
                      ? "bg-slate-50 text-slate-500 ring-slate-200"
                      : "bg-white text-slate-600 ring-slate-200 hover:text-teal-700 hover:ring-teal-200"
                }`}
                onClick={() => onNavigate(step.target)}
                type="button"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {isDone ? <Check size={14} /> : null}
                  {step.ai ? <Sparkles size={14} /> : null}
                  {step.title}
                </span>
                <span className={`mt-1 block text-xs ${isCurrent ? "text-teal-50" : "text-slate-400"}`}>
                  {step.description}
                </span>
              </button>
              {index < flowSteps.length - 1 ? (
                <div className="hidden items-center justify-center gap-1 px-1 md:flex" aria-hidden="true">
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TextField({
  error,
  hint,
  label,
  onChange,
  placeholder,
  required,
  value
}: {
  error?: string;
  hint?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-sm font-semibold text-slate-800">
        {required ? <span className="text-base leading-none text-amber-600">*</span> : null}
        {label}
      </span>
      <input
        className={`mt-2 w-full rounded-md border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 ${
          error ? "border-amber-400" : "border-slate-300"
        }`}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <FieldHelp error={error} hint={hint} />
    </label>
  );
}

function TextAreaField({
  error,
  hint,
  label,
  minHeightClass = "min-h-28",
  onChange,
  placeholder,
  required,
  value
}: {
  error?: string;
  hint?: string;
  label?: string;
  minHeightClass?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      {label ? (
        <span className="flex items-center gap-1 text-sm font-semibold text-slate-800">
          {required ? <span className="text-base leading-none text-amber-600">*</span> : null}
          {label}
        </span>
      ) : null}
      <textarea
        className={`${label ? "mt-2" : ""} ${minHeightClass} w-full resize-y rounded-md border bg-white px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 ${
          error ? "border-amber-400" : "border-slate-300"
        }`}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <FieldHelp error={error} hint={hint} />
    </label>
  );
}

function SelectField({
  error,
  label,
  onChange,
  options,
  required,
  value
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-sm font-semibold text-slate-800">
        {required ? <span className="text-base leading-none text-amber-600">*</span> : null}
        {label}
      </span>
      <select
        className={`mt-2 w-full rounded-md border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 ${
          error ? "border-amber-400" : "border-slate-300"
        }`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FieldHelp error={error} />
    </label>
  );
}

function FieldHelp({ error, hint }: { error?: string; hint?: string }) {
  if (error) {
    return <p className="mt-1 text-xs leading-5 text-amber-700">{error}</p>;
  }
  if (hint) {
    return <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>;
  }
  return null;
}

function SuggestionItem({ text, title }: { text: string; title: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1">{text}</p>
    </div>
  );
}

function renderResourceTab(resourcePackage: ClassroomResourcePackage, activeTab: ResourceTabId) {
  if (activeTab === "basis") {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <ContentCard title="课程标准依据">
          <CompactList items={resourcePackage.curriculumBasis.standards} />
        </ContentCard>
        <ContentCard title="教学指南依据">
          <CompactList items={resourcePackage.curriculumBasis.teachingGuides} />
        </ContentCard>
        <ContentCard title="核心素养">
          <CompactList items={resourcePackage.curriculumBasis.coreLiteracy} />
        </ContentCard>
      </div>
    );
  }

  if (activeTab === "tpack") {
    const entries = [
      ["CK 学科知识", resourcePackage.tpackAnalysis.ck],
      ["PK 教学法知识", resourcePackage.tpackAnalysis.pk],
      ["TK 技术知识", resourcePackage.tpackAnalysis.tk],
      ["PCK 学科内容与教学法的交集", resourcePackage.tpackAnalysis.pck],
      ["TCK 技术与学科内容的交集", resourcePackage.tpackAnalysis.tck],
      ["TPK 技术与教学法的交集", resourcePackage.tpackAnalysis.tpk],
      ["TPACK 综合分析", resourcePackage.tpackAnalysis.tpack]
    ];
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {entries.map(([title, text]) => (
          <ContentCard key={title} title={title}>
            <p className="text-sm leading-6 text-slate-600">{text}</p>
          </ContentCard>
        ))}
      </div>
    );
  }

  if (activeTab === "literacy") {
    return (
      <div className="grid gap-4">
        {resourcePackage.literacyEvidenceChain.map((item) => (
          <ContentCard key={item.literacy} title={item.literacy}>
            <div className="grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-2">
              <DetailLine label="教学目标" value={item.teachingObjective} />
              <DetailLine label="学习活动" value={item.learningActivity} />
              <DetailLine label="任务证据" value={item.taskEvidence} />
              <DetailLine label="测评证据" value={item.assessmentEvidence} />
              <DetailLine label="评价方式" value={item.evaluationMethod} />
              <DetailLine label="达成状态" value={item.achievementStatus} />
              <DetailLine label="风险提示" value={item.riskAlert} />
              <DetailLine label="优化建议" value={item.improvementSuggestion} />
            </div>
          </ContentCard>
        ))}
      </div>
    );
  }

  if (activeTab === "design") {
    const design = resourcePackage.teachingDesign;
    return (
      <div className="space-y-4">
        <ContentCard title="基本信息">
          <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
            <DetailLine label="课题" value={design.basicInfo.topicName} />
            <DetailLine label="年级" value={design.basicInfo.grade} />
            <DetailLine label="课程模块" value={design.basicInfo.courseModule} />
            <DetailLine label="课时" value={`${design.basicInfo.classHours}课时`} />
            <DetailLine label="课堂类型" value={design.basicInfo.lessonType} />
          </div>
        </ContentCard>
        <div className="grid gap-4 md:grid-cols-2">
          <ContentCard title="课标与指南分析">
            <CompactList items={design.curriculumAnalysis} />
          </ContentCard>
          <ContentCard title="学情分析">
            <p className="text-sm leading-6 text-slate-600">{design.learningAnalysis}</p>
          </ContentCard>
          <ContentCard title="教学目标">
            <CompactList items={design.teachingObjectives} />
          </ContentCard>
          <ContentCard title="教学重点难点">
            <DetailLine label="重点" value={design.keyAndDifficultPoints.focus} />
            <DetailLine label="难点" value={design.keyAndDifficultPoints.difficulty} />
          </ContentCard>
          <ContentCard title="教学资源与环境">
            <CompactList items={design.resourcesAndEnvironment} />
          </ContentCard>
          <ContentCard title="问题链">
            <CompactList items={design.questionChain} />
          </ContentCard>
          <ContentCard title="评价设计">
            <CompactList items={design.evaluationDesign} />
          </ContentCard>
          <ContentCard title="板书设计">
            <CompactList items={design.blackboardDesign} />
          </ContentCard>
        </div>
        <ContentCard title="教学流程">
          <div className="space-y-3">
            {design.procedures.map((procedure) => (
              <div className="rounded-md border border-slate-200 p-4" key={procedure.phase}>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-slate-950">{procedure.phase}</h4>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {procedure.duration}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-3">
                  <DetailLine label="教师活动" value={procedure.teacherActivity} />
                  <DetailLine label="学生活动" value={procedure.studentActivity} />
                  <DetailLine label="设计意图" value={procedure.designIntent} />
                </div>
              </div>
            ))}
          </div>
        </ContentCard>
        <ContentCard title="教学反思建议">
          <CompactList items={design.reflectionSuggestions} />
        </ContentCard>
      </div>
    );
  }

  if (activeTab === "task") {
    const task = resourcePackage.learningTaskSheet;
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <ContentCard title="任务目标">
          <CompactList items={task.taskGoal} />
        </ContentCard>
        <ContentCard title="情境导入">
          <p className="text-sm leading-6 text-slate-600">{task.scenarioIntroduction}</p>
        </ContentCard>
        <ContentCard title="任务步骤">
          <CompactList items={task.taskSteps} />
        </ContentCard>
        <ContentCard title="学习支架">
          <CompactList items={task.learningSupports} />
        </ContentCard>
        <ContentCard title="小组分工">
          <CompactList items={task.groupRoles} />
        </ContentCard>
        <ContentCard title="反思问题">
          <CompactList items={task.reflectionQuestions} />
        </ContentCard>
        <div className="md:col-span-2">
          <ContentCard title="记录表">
            <MiniTable rows={task.recordTable} />
          </ContentCard>
        </div>
      </div>
    );
  }

  if (activeTab === "assessment") {
    const assessment = resourcePackage.layeredAssessment;
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <ContentCard title="基础理解">
          <CompactList items={assessment.basicUnderstanding} />
        </ContentCard>
        <ContentCard title="原理解释">
          <CompactList items={assessment.principleExplanation} />
        </ContentCard>
        <ContentCard title="情境迁移">
          <CompactList items={assessment.scenarioTransfer} />
        </ContentCard>
        <ContentCard title="创新表达">
          <CompactList items={assessment.creativeExpression} />
        </ContentCard>
      </div>
    );
  }

  const diagnosis = resourcePackage.learningDiagnosisTemplate;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ContentCard title="评价维度">
        <CompactList items={diagnosis.evaluationDimensions} />
      </ContentCard>
      <ContentCard title="数据来源">
        <CompactList items={diagnosis.dataSources} />
      </ContentCard>
      <ContentCard title="数据埋点">
        <CompactList items={diagnosis.dataTracking} />
      </ContentCard>
      <ContentCard title="数据格式">
        <MiniTable rows={diagnosis.dataFormat} />
      </ContentCard>
      <ContentCard title="诊断规则">
        <CompactList items={diagnosis.diagnosisRules} />
      </ContentCard>
      <ContentCard title="输出结果">
        <CompactList items={diagnosis.outputResults} />
      </ContentCard>
    </div>
  );
}

function ContentCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-base font-semibold text-slate-950">{title}</h3>
      {children}
    </article>
  );
}

function CompactList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-6 text-slate-600">
      {items.map((item) => (
        <li className="flex gap-2" key={item}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function MiniTable({ rows }: { rows: Array<Record<string, string>> }) {
  if (rows.length === 0) {
    return null;
  }
  const headers = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}-${Object.values(row).join("-")}`}>
              {headers.map((header) => (
                <td className="border-b border-slate-100 px-3 py-2 leading-6 text-slate-600" key={header}>
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuggestionCard({
  message,
  onApply,
  onDismiss
}: {
  message: AssistantMessage;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const suggestion = message.suggestion;
  if (!suggestion) {
    return null;
  }

  return (
    <article className="rounded-md bg-white p-3 ring-1 ring-teal-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-950">{suggestion.title}</h4>
          <p className="mt-1 text-xs text-slate-500">
            {message.persona} · {message.module} · {formatTime(message.time)}
          </p>
        </div>
        {message.applied ? (
          <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">已应用</span>
        ) : null}
      </div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        <DetailLine label="修改理由" value={suggestion.reason} />
        <DetailLine label="建议内容" value={suggestion.content} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={message.applied}
          onClick={onApply}
          type="button"
        >
          应用到当前模块
        </button>
        <button
          className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
          onClick={onDismiss}
          type="button"
        >
          暂不应用
        </button>
      </div>
    </article>
  );
}

function PlaceholderPage({ title, onBackHome }: { title: string; onBackHome: () => void }) {
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Sparkles size={21} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">本页将在下一阶段开发。</p>
          </div>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          onClick={onBackHome}
          type="button"
        >
          返回首页
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

function loadTeachingNeed(): TeachingNeed {
  try {
    const raw = window.localStorage.getItem(teachingNeedStorageKey);
    if (!raw) {
      return emptyTeachingNeed;
    }
    return { ...emptyTeachingNeed, ...JSON.parse(raw) } as TeachingNeed;
  } catch {
    return emptyTeachingNeed;
  }
}

function loadTeachingNeedForGeneration(): TeachingNeed {
  const savedNeed = loadTeachingNeed();
  if (savedNeed.topicName.trim()) {
    return savedNeed;
  }

  try {
    const rawLesson = window.localStorage.getItem("kelian.currentLesson");
    if (!rawLesson) {
      return savedNeed;
    }
    const lesson = JSON.parse(rawLesson) as typeof sampleLesson;
    return {
      ...emptyTeachingNeed,
      topicName: lesson.title,
      grade: lesson.grade as Grade,
      courseModule: lesson.module ?? defaultModuleByGrade["七年级"],
      classHours: lesson.duration.replace("课时", "") || "1",
      studentFoundation: lesson.learningSituation,
      equipmentCondition: "机房可上网，学生两人一机，教师机可投屏，可使用浏览器和在线协作白板。",
      teachingObjectives: lesson.objectives.join("\n"),
      teachingFocus: `理解“${lesson.title}”中的关键概念，并能用课堂任务表达学习结果。`,
      teachingDifficulty: "把抽象的信息科技过程转化为学生能观察、能解释、能迁移的活动成果。",
      lessonType: "新授课",
      generationScope: "生成完整课堂资源包"
    };
  } catch {
    return savedNeed;
  }
}

function loadResourcePackage(): ClassroomResourcePackage | null {
  try {
    const raw = window.localStorage.getItem(resourcePackageStorageKey);
    return raw ? (JSON.parse(raw) as ClassroomResourcePackage) : null;
  } catch {
    return null;
  }
}

function loadResourceStatus() {
  return window.localStorage.getItem(resourcePackageStatusKey) ?? "draft";
}

function loadTeacherDraft() {
  return window.localStorage.getItem(teacherDraftStorageKey) ?? "";
}

function loadAssistantMessages(): AssistantMessage[] {
  try {
    const raw = window.localStorage.getItem(assistantMessagesStorageKey);
    return raw ? (JSON.parse(raw) as AssistantMessage[]) : [];
  } catch {
    return [];
  }
}

function loadRevisionLog(): RevisionLogItem[] {
  try {
    const raw = window.localStorage.getItem(revisionLogStorageKey);
    return raw ? (JSON.parse(raw) as RevisionLogItem[]) : [];
  } catch {
    return [];
  }
}

function saveRevisionLog(item: RevisionLogItem) {
  window.localStorage.setItem(revisionLogStorageKey, JSON.stringify([...loadRevisionLog(), item]));
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getEditableText(resourcePackage: ClassroomResourcePackage) {
  const savedText = (resourcePackage as ClassroomResourcePackage & { teacherEditedText?: string }).teacherEditedText;
  return savedText ?? packageToEditableText(resourcePackage);
}

function packageToEditableText(resourcePackage: ClassroomResourcePackage) {
  const design = resourcePackage.teachingDesign;
  const task = resourcePackage.learningTaskSheet;
  const assessment = resourcePackage.layeredAssessment;
  const diagnosis = resourcePackage.learningDiagnosisTemplate;

  return [
    `【教学设计】`,
    `课题：${design.basicInfo.topicName}`,
    `年级：${design.basicInfo.grade}`,
    `模块：${design.basicInfo.courseModule}`,
    `教学目标：\n${design.teachingObjectives.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    `教学重点：${design.keyAndDifficultPoints.focus}`,
    `教学难点：${design.keyAndDifficultPoints.difficulty}`,
    `教学流程：\n${design.procedures
      .map(
        (item, index) =>
          `${index + 1}. ${item.phase}（${item.duration}）\n教师活动：${item.teacherActivity}\n学生活动：${item.studentActivity}\n设计意图：${item.designIntent}`
      )
      .join("\n\n")}`,
    "",
    `【学习任务单】`,
    `任务目标：\n${task.taskGoal.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    `情境导入：${task.scenarioIntroduction}`,
    `任务步骤：\n${task.taskSteps.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    "",
    `【素养证据链】`,
    resourcePackage.literacyEvidenceChain
      .map(
        (item) =>
          `${item.literacy}\n教学目标：${item.teachingObjective}\n学习活动：${item.learningActivity}\n任务证据：${item.taskEvidence}\n测评证据：${item.assessmentEvidence}\n评价方式：${item.evaluationMethod}`
      )
      .join("\n\n"),
    "",
    `【分层测评题】`,
    `基础理解：\n${assessment.basicUnderstanding.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    `原理解释：\n${assessment.principleExplanation.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    `情境迁移：\n${assessment.scenarioTransfer.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    `创新表达：\n${assessment.creativeExpression.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    "",
    `【学情诊断模板】`,
    `评价维度：\n${diagnosis.evaluationDimensions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    `诊断规则：\n${diagnosis.diagnosisRules.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    "",
    `【TPACK 分析】`,
    `CK：${resourcePackage.tpackAnalysis.ck}`,
    `PK：${resourcePackage.tpackAnalysis.pk}`,
    `TK：${resourcePackage.tpackAnalysis.tk}`,
    `PCK：${resourcePackage.tpackAnalysis.pck}`,
    `TCK：${resourcePackage.tpackAnalysis.tck}`,
    `TPK：${resourcePackage.tpackAnalysis.tpk}`,
    `TPACK：${resourcePackage.tpackAnalysis.tpack}`
  ].join("\n\n");
}

function validateTeachingNeed(need: TeachingNeed): TeachingNeedErrors {
  const requiredFields: Array<keyof TeachingNeed> = [
    "topicName",
    "grade",
    "courseModule",
    "classHours",
    "studentFoundation",
    "equipmentCondition",
    "lessonType",
    "generationScope"
  ];
  return requiredFields.reduce<TeachingNeedErrors>((result, field) => {
    const value = String(need[field] ?? "").trim();
    if (!value) {
      result[field] = requiredMessages[field];
    }
    return result;
  }, {});
}

function createDesignDraft(need: TeachingNeed) {
  return {
    teachingObjectives: [
      `能结合${need.topicName}说明相关信息科技概念或过程。`,
      "能在课堂任务中完成观察、分析、表达或作品制作。",
      "能联系真实数字生活情境，形成安全、负责的技术使用意识。"
    ].join("\n"),
    teachingFocus: `围绕“${need.topicName}”，帮助学生理解核心概念，并完成可观察的课堂任务。`,
    teachingDifficulty: "引导学生把抽象的信息科技原理转化为能解释、能表达、能迁移的学习成果。"
  };
}

function appendSentence(current: string, sentence: string) {
  if (!current.trim()) {
    return sentence;
  }
  if (current.includes(sentence)) {
    return current;
  }
  return `${current.trim()}\n${sentence}`;
}

function getInitialSaveMessage(updatedAt: string) {
  if (!updatedAt) {
    return "草稿会保存在本机，刷新页面后仍可继续填写。";
  }
  return `已恢复上次草稿：${formatTime(updatedAt)}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildDetailedSuggestions(need: TeachingNeed) {
  return [
    {
      title: "课程定位建议",
      text: `${need.grade}《${need.topicName}》可放在“${need.courseModule || defaultModuleByGrade[need.grade]}”模块中处理，建议用${need.classHours || "1"}课时完成核心概念理解和课堂产出。`
    },
    {
      title: "学情处理建议",
      text: need.studentFoundation.trim()
        ? `可从学生已有基础切入：${need.studentFoundation.trim()} 建议把新概念转化为可观察、可讨论、可操作的课堂任务。`
        : "建议补充学生已有经验、常见误区和操作基础，方便后续生成更贴合班级的活动。"
    },
    {
      title: "活动设计建议",
      text: `${getLessonTypeAdvice(need.lessonType)}${need.additionalNeeds.trim() ? ` 可结合你的偏好：${need.additionalNeeds.trim()}` : ""}`
    },
    {
      title: "评价与证据建议",
      text: "建议把学生的任务单、过程记录、课堂表达和作品结果作为评价证据，重点观察核心素养是否落实到活动和产出中。"
    },
    {
      title: "备课生成建议",
      text: getGenerationAdvice(need.generationScope)
    },
    {
      title: "设备落地提醒",
      text: need.equipmentCondition.trim()
        ? `当前设备条件为：${need.equipmentCondition.trim()} 建议生成资源时避免依赖无法保障的软件、账号或网络环境。`
        : "建议补充机房、网络、终端和投屏条件，避免生成课堂上难以实施的活动。"
    }
  ];
}

function getGenerationAdvice(scope: GenerationScope) {
  if (scope === "只生成教学设计") {
    return "优先生成教学目标、课堂活动、教师提示和评价建议，便于教师快速形成教案初稿。";
  }
  return "建议生成教学设计、学习任务单、分层测评题和学情诊断表，形成可上课、可修改、可导出的资源包。";
}

function getLessonTypeAdvice(type: LessonType) {
  if (type === "项目实践课") {
    return "建议围绕真实项目设置阶段任务，让学生经历计划、制作、测试和展示。";
  }
  if (type === "实验探究课") {
    return "建议安排观察、操作、记录和解释环节，让学生在探究中理解信息科技原理。";
  }
  if (type === "技能训练课") {
    return "建议把关键技能拆成清晰步骤，配合示范、练习和即时反馈帮助学生形成熟练操作。";
  }
  if (type === "跨学科主题课") {
    return "建议明确跨学科情境、真实问题和学生表达成果，避免只停留在资料拼接。";
  }
  return "建议突出概念理解、演示探究和随堂检测，让学生先理解再迁移。";
}

function getResourceModuleLabel(tab: ResourceTabId) {
  return resourceTabs.find((item) => item.id === tab)?.label ?? "教学设计";
}

function getPersonaHint(persona: AssistantPersona) {
  if (persona === "资深信息科技教师") {
    return "关注课堂真实可操作性、学生是否听得懂、活动是否好组织。";
  }
  if (persona === "教学设计专家") {
    return "关注教学目标、活动流程、问题链和评价一致性。";
  }
  return "关注课程标准、核心素养、教研表达和展示材料表述。";
}

function getQuickRevisionActions(tab: ResourceTabId) {
  const actions: Record<ResourceTabId, string[]> = {
    basis: ["对齐课程标准", "补充教学指南依据", "强化核心素养表达"],
    design: ["优化教学流程", "补充问题链", "降低学生理解难度", "增加课堂追问", "增加过程性评价", "补充核心素养目标"],
    task: ["增加学习支架", "细化任务步骤", "补充小组分工", "增加记录表", "降低任务难度", "增加反思问题"],
    assessment: ["增加基础题", "增加情境迁移题", "增加开放表达题", "补充答案解析", "调整题目难度", "补充核心素养测评证据"],
    literacy: ["检查薄弱素养", "补充任务证据", "补充测评证据", "补充评价方式", "增强信息社会责任", "增强数字化学习与创新"],
    tpack: ["补充学科知识分析", "补充教学法建议", "补充技术工具使用建议", "强化技术与教学融合", "改得更适合信息科技课堂"],
    diagnosis: ["补充评价维度", "补充数据采集项", "补充诊断规则", "增加学生分层建议", "增加教学改进建议"]
  };
  return actions[tab];
}

function createAssistantSuggestion({
  action,
  module,
  need,
  persona,
  tab
}: {
  action: string;
  module: string;
  need: TeachingNeed;
  persona: AssistantPersona;
  tab: ResourceTabId;
}): SuggestionCardData {
  const topic = need.topicName || "本课";
  const personaFocus = getPersonaFocus(persona);
  const lowerAction = action.toLowerCase();

  if (tab === "design") {
    if (action.includes("降低学生理解难度") || lowerAction.includes("听不懂")) {
      return {
        title: "增加生活化类比降低理解难度",
        reason: `${need.grade}学生面对“${topic}”时，容易把技术过程想得过于抽象。${personaFocus}`,
        content: `建议在导入环节增加一个可操作类比：让学生把一段完整信息写在纸条上，再拆成多个带编号的小纸条，由不同同学传递，最后按编号重组。教师追问：“如果编号丢失、顺序打乱，会出现什么问题？”再引出“${topic}”中的关键过程。`
      };
    }
    if (action.includes("问题链") || action.includes("追问")) {
      return {
        title: "补充由浅入深的问题链",
        reason: `当前教学设计需要让学生从生活现象逐步走向信息科技原理。${personaFocus}`,
        content: `建议增加问题链：1. 生活中哪里见过类似“${topic}”的现象？2. 这个过程可以拆成哪些步骤？3. 每一步输入和输出是什么？4. 如果某一步出错，结果会怎样？5. 这个技术使用时需要注意哪些安全或责任问题？`
      };
    }
    return {
      title: "优化教学流程的课堂可实施性",
      reason: `教学流程需要清楚写出教师怎么组织、学生怎么做、证据怎么留下。${personaFocus}`,
      content: `建议把教学流程调整为“情境导入5分钟、任务探究15分钟、小组建模10分钟、展示互评8分钟、检测反思7分钟”。每个环节都配套任务单记录项，确保学生有可提交的过程证据。`
    };
  }

  if (tab === "task") {
    if (action.includes("降低") || action.includes("复杂")) {
      return {
        title: "把任务单拆成三步完成",
        reason: `任务单如果一次性要求过多，学生容易只忙着填写而忽视理解。${personaFocus}`,
        content: `建议把任务单改为三步：第一步“写出现象”，第二步“画出3到5个关键步骤”，第三步“用一句话解释每一步作用”。拓展问题放到最后，供完成较快的小组挑战。`
      };
    }
    return {
      title: "增加任务支架和小组分工",
      reason: `学习任务单要让学生拿到后知道先做什么、谁负责、怎样记录。${personaFocus}`,
      content: `建议补充小组角色：记录员填写任务单，建模员绘制流程图，汇报员说明小组思路，检查员对照评价标准核对遗漏。任务步骤旁增加“我需要留下的证据”一栏。`
    };
  }

  if (tab === "assessment") {
    return {
      title: "补充分层测评与答案解析",
      reason: `测评题需要同时检查概念理解、原理解释、迁移应用和开放表达。${personaFocus}`,
      content: `建议增加一道基础题：“请用一句话说明${topic}解决了什么问题。”增加一道迁移题：“校园网络变慢时，你会从哪些环节分析原因？”每题后补充参考要点，便于教师快速判断学生是否真正理解。`
    };
  }

  if (tab === "literacy") {
    if (action.includes("信息社会责任")) {
      return {
        title: "补充网络隐私与伦理讨论证据",
        reason: `当前课例如果只关注技术原理，容易弱化信息社会责任。${personaFocus}`,
        content: `建议增加讨论题：“网络服务在提供便利的同时是否可以收集用户数据？哪些数据可以收集，哪些数据不应收集？”并将学生观点表达、理由是否充分、建议是否可执行纳入评价证据。`
      };
    }
    return {
      title: "补齐核心素养到评价证据的对应关系",
      reason: `素养证据链要能看出目标、活动、任务证据和测评证据之间的连接。${personaFocus}`,
      content: `建议为每个核心素养增加一条可观察证据：信息意识对应问题提出，计算思维对应过程图，数字化学习与创新对应协作作品，信息社会责任对应隐私保护建议。`
    };
  }

  if (tab === "tpack") {
    return {
      title: "强化技术与教学融合表达",
      reason: `TPACK 分析要说明技术为什么服务于本课学习，而不是简单罗列工具。${personaFocus}`,
      content: `建议补充：用投屏展示典型小组模型，用电子任务单收集过程证据，用在线协作白板支持同伴互评。技术工具的作用是让“${topic}”的过程可视化、可讨论、可评价。`
    };
  }

  if (tab === "diagnosis") {
    return {
      title: "补充分层诊断与教学改进建议",
      reason: `学情诊断不仅要记录结果，还要能指导下一步教学。${personaFocus}`,
      content: `建议把学生分为三类：基础巩固组重点补概念，表达提升组重点练流程图和解释，拓展挑战组设计新情境。课后根据任务单完成度、测评题错误点和反思问题生成班级改进建议。`
    };
  }

  return {
    title: "补充课程依据与课堂落点",
    reason: `课程依据需要和本课活动对应，避免只写标准名称。${personaFocus}`,
    content: `建议在课程依据中补充“本课通过真实情境、过程建模和责任讨论落实核心素养”，并说明每项依据对应哪一个课堂任务。`
  };
}

function getPersonaFocus(persona: AssistantPersona) {
  if (persona === "资深信息科技教师") {
    return "建议优先保证学生听得懂、活动好组织、课堂时间能落地。";
  }
  if (persona === "教学设计专家") {
    return "建议重点检查目标、活动、问题链和评价是否一致。";
  }
  return "建议表达上对齐课程标准、核心素养和教研展示材料。";
}

function createMockResourcePackage(need: TeachingNeed): ClassroomResourcePackage {
  const topic = need.topicName.trim();
  const module = need.courseModule || defaultModuleByGrade[need.grade];
  const objectives = normalizeLines(need.teachingObjectives, [
    `能说出“${topic}”涉及的关键信息科技概念。`,
    `能在课堂任务中完成与“${topic}”相关的观察、分析和表达。`,
    "能结合真实数字生活情境，形成安全、负责、主动的技术使用意识。"
  ]);
  const focus = need.teachingFocus || `理解“${topic}”的关键过程，并能用图示、记录或作品表达学习结果。`;
  const difficulty =
    need.teachingDifficulty || "把抽象的信息科技原理转化为学生能解释、能迁移、能评价的课堂证据。";
  const scenario = buildScenario(topic, need.additionalNeeds);

  return {
    id: `resource-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    teachingNeed: need,
    curriculumBasis: {
      standards: [
        "义务教育信息科技课程标准：关注学生在真实问题中理解信息系统、数据处理、网络应用和智能技术的基本思想。",
        "强调以核心素养为导向，组织可实践、可表达、可评价的学习活动。",
        `本课围绕“${topic}”，引导学生经历问题发现、过程分析、方案表达和责任讨论。`
      ],
      teachingGuides: [
        "义务教育信息科技课程教学指南：建议从学生熟悉的数字生活经验出发，设计任务驱动的探究活动。",
        "课堂活动需要兼顾概念理解、操作体验、合作交流和学习证据采集。",
        `结合${need.grade}学生特点，建议用${need.classHours || "1"}课时完成导入、探究、表达、评价和反思。`
      ],
      coreLiteracy: ["信息意识", "计算思维", "数字化学习与创新", "信息社会责任"]
    },
    tpackAnalysis: {
      ck: `学生需要理解“${topic}”所涉及的基本概念、过程关系和实际应用，能够用自己的话解释关键现象。`,
      pk: `采用${need.lessonType}组织课堂，先用真实情境激活经验，再通过任务单、小组讨论和展示评价促进理解。`,
      tk: `使用浏览器、投屏、在线协作白板或本地记录表支持观察、记录、表达和即时反馈，适配当前设备条件：${need.equipmentCondition || "普通机房环境"}。`,
      pck: `将“${topic}”拆成学生能完成的连续任务，降低抽象概念门槛，用问题链推动学生从现象走向原理。`,
      tck: `通过图示、流程记录、数据表或作品截图呈现“${topic}”的关键过程，让不可见的信息过程可视化。`,
      tpk: "用在线记录表收集学生观点，用投屏展示典型成果，用即时测评检查理解差异，帮助教师及时调整节奏。",
      tpack: `本课把${module}的学科内容、任务驱动教学法和课堂技术环境整合起来，形成“情境体验-过程建模-证据评价-责任迁移”的课堂结构。`
    },
    literacyEvidenceChain: createLiteracyEvidence(topic, objectives),
    teachingDesign: {
      basicInfo: {
        topicName: topic,
        grade: need.grade,
        courseModule: module,
        classHours: need.classHours || "1",
        lessonType: need.lessonType
      },
      curriculumAnalysis: [
        `本课属于${module}，重点不是让学生记忆术语，而是让学生理解“${topic}”背后的信息过程。`,
        "教学指南强调从真实场景出发，组织学生通过观察、操作、记录和表达形成学习证据。",
        "评价需要覆盖概念理解、任务完成、合作表达和责任意识，避免只看最终答案。"
      ],
      learningAnalysis:
        need.studentFoundation ||
        "学生有日常数字设备使用经验，但对背后的信息处理过程认识不足，容易停留在现象描述，需要通过类比、图示和任务记录建立结构化理解。",
      teachingObjectives: objectives,
      keyAndDifficultPoints: {
        focus,
        difficulty
      },
      resourcesAndEnvironment: [
        need.equipmentCondition || "机房可上网，学生两人一机，教师机可投屏。",
        "教师准备情境材料、任务单、过程记录表、测评题和展示评价表。",
        "学生使用浏览器、纸质或电子任务单、小组协作记录工具完成学习任务。"
      ],
      procedures: [
        {
          phase: "情境导入",
          duration: "5分钟",
          teacherActivity: `呈现${scenario}，追问学生：这个现象背后可能经历了哪些信息处理步骤？`,
          studentActivity: "结合生活经验说出现象、猜测原因，在任务单上记录自己的初始判断。",
          designIntent: "用真实场景降低进入门槛，让学生带着问题进入探究。"
        },
        {
          phase: "任务探究",
          duration: "15分钟",
          teacherActivity: `发放任务单，引导学生把“${topic}”拆成若干步骤，并用箭头、表格或流程图表达过程。`,
          studentActivity: "小组分工完成过程梳理，标出关键步骤、输入输出和可能出错的位置。",
          designIntent: "把抽象过程可视化，落实计算思维中的分解、抽象和建模。"
        },
        {
          phase: "交流建模",
          duration: "10分钟",
          teacherActivity: "选择两组作品投屏展示，追问模型是否完整、顺序是否合理、证据是否充分。",
          studentActivity: "对照同伴作品修改本组记录，补充遗漏步骤或改进表达方式。",
          designIntent: "通过对比和修订提升表达质量，形成可评价的学习证据。"
        },
        {
          phase: "责任迁移",
          duration: "8分钟",
          teacherActivity: "设置校园或家庭数字生活情境，引导学生讨论技术使用中的安全、隐私和责任。",
          studentActivity: "写出一条可执行的使用建议，并说明依据。",
          designIntent: "把技术理解迁移到真实生活，落实信息社会责任。"
        },
        {
          phase: "检测反思",
          duration: "7分钟",
          teacherActivity: "组织完成分层测评题，收集任务单和关键回答，给出下一步学习建议。",
          studentActivity: "完成基础题和迁移题，写下本节课最清楚和仍困惑的一点。",
          designIntent: "及时诊断学习效果，为后续修订资源和学情分析提供数据。"
        }
      ],
      questionChain: [
        `你在生活中见过哪些与“${topic}”有关的现象？`,
        "这个现象可以拆成哪些步骤？每一步的输入和输出是什么？",
        "如果某一步出错，最终结果会受到什么影响？",
        "怎样用流程图、表格或作品截图证明你理解了这个过程？",
        "这个技术在使用时需要注意哪些安全、隐私或责任问题？"
      ],
      evaluationDesign: [
        "任务单完成度：步骤完整、表达清楚、有关键证据。",
        "小组展示质量：能解释过程、回应追问、根据反馈修改。",
        "测评题表现：基础概念准确，能完成情境迁移。",
        "责任表达：能提出与真实数字生活相关的合理建议。"
      ],
      blackboardDesign: [
        `课题：${topic}`,
        "真实情境 -> 关键问题 -> 过程拆解 -> 证据表达 -> 责任迁移",
        "核心方法：观察现象、分解步骤、建立模型、验证表达",
        "学习证据：任务单、过程图、测评题、反思记录"
      ],
      reflectionSuggestions: [
        "观察学生是否真正理解过程关系，还是只复述教师示例。",
        "检查任务单中的记录项是否过多，是否影响课堂节奏。",
        "根据测评题错误集中点，调整下一课时的讲解或练习。"
      ]
    },
    learningTaskSheet: {
      taskGoal: [
        `理解“${topic}”中的关键过程。`,
        "能用图示、表格或文字说明任务中的步骤关系。",
        "能联系真实生活提出安全、负责的技术使用建议。"
      ],
      scenarioIntroduction: scenario,
      taskSteps: [
        "任务一：记录你看到的现象，并写出一个最想解决的问题。",
        `任务二：小组讨论“${topic}”可能包含的关键步骤，并按顺序排列。`,
        "任务三：用流程图或表格表达步骤、输入、输出和可能的风险。",
        "任务四：展示本组模型，听取同伴建议后修改。",
        "任务五：完成迁移问题，写出一条面向真实生活的使用建议。"
      ],
      learningSupports: [
        "可以用“先发生什么、接着发生什么、最后得到什么”梳理过程。",
        "如果说不清原因，先画出步骤图，再补充每一步的作用。",
        "评价同伴作品时，可以从完整性、准确性、可理解性三个角度提建议。"
      ],
      groupRoles: [
        "记录员：负责填写任务单和整理关键证据。",
        "建模员：负责绘制流程图、表格或作品结构。",
        "汇报员：负责说明本组思路并回应追问。",
        "检查员：负责对照评价标准检查遗漏。"
      ],
      recordTable: [
        { 记录项: "生活现象", 填写提示: "写出你观察到的真实现象", 示例: "视频播放、网页打开、智能设备响应" },
        { 记录项: "关键步骤", 填写提示: "按顺序写出3-5个步骤", 示例: "提出请求、处理信息、返回结果" },
        { 记录项: "证据材料", 填写提示: "写出你用什么证明理解", 示例: "流程图、截图、解释文字" },
        { 记录项: "风险提醒", 填写提示: "写出安全或责任注意点", 示例: "保护隐私、核验来源、规范表达" }
      ],
      reflectionQuestions: [
        "我今天最清楚理解的一个过程是什么？",
        "小组模型中哪一步最容易出错？为什么？",
        "如果把今天的方法用到另一个生活情境，可以怎样迁移？"
      ]
    },
    layeredAssessment: {
      basicUnderstanding: [
        `请用一句话说明“${topic}”主要解决什么问题。`,
        "从下列步骤中选出最先发生的一步，并说明理由。",
        "判断：只要会使用软件，就一定理解背后的信息处理过程。请说明对错。"
      ],
      principleExplanation: [
        `请用“输入-处理-输出”的方式解释“${topic}”中的一个关键过程。`,
        "如果中间某一步出现错误，最终结果可能发生什么变化？",
        "请结合课堂任务单，说明你的小组模型为什么是合理的。"
      ],
      scenarioTransfer: [
        "校园网络突然变慢时，你会从哪些环节分析可能原因？",
        `把“${topic}”的思路迁移到一个家庭数字生活场景，并写出处理步骤。`,
        "面对陌生网络服务，你会如何判断它是否值得信任？"
      ],
      creativeExpression: [
        `设计一张面向七、八年级同学的“${topic}”说明图，要求通俗、准确、有提示。`,
        "请为本课设计一个新的课堂情境，并说明它能帮助理解哪个概念。",
        "提出一个改进课堂任务单的小建议，让学习证据更容易收集。"
      ]
    },
    learningDiagnosisTemplate: {
      evaluationDimensions: [
        "概念理解：能否准确说明关键术语和过程关系。",
        "过程表达：能否用图示、表格或文字清楚表达步骤。",
        "合作探究：是否参与小组分工、讨论和修订。",
        "迁移责任：能否联系真实生活提出合理建议。"
      ],
      dataSources: [
        "学生任务单记录",
        "小组过程图或作品截图",
        "课堂展示与追问回答",
        "分层测评题作答",
        "课后反思问题"
      ],
      dataTracking: [
        "记录任务单是否完成关键步骤。",
        "记录学生是否能解释模型中的关键节点。",
        "记录测评题基础题、迁移题、表达题的得分。",
        "记录学生提出的安全或责任建议是否具体可执行。"
      ],
      dataFormat: [
        { 字段: "studentName", 含义: "学生姓名", 示例: "张同学" },
        { 字段: "taskCompletion", 含义: "任务单完成度", 示例: "完整 / 部分 / 未完成" },
        { 字段: "modelAccuracy", 含义: "过程模型准确度", 示例: "3分" },
        { 字段: "transferAnswer", 含义: "情境迁移回答", 示例: "能联系校园网络说明" },
        { 字段: "supportNeeded", 含义: "后续支持建议", 示例: "需要补充流程表达练习" }
      ],
      diagnosisRules: [
        "如果基础理解题错误超过2题，建议回到概念解释和生活类比。",
        "如果过程表达不完整，建议补充流程图支架和同伴互评。",
        "如果迁移题空泛，建议增加真实情境材料和示范回答。",
        "如果责任建议缺少可执行性，建议提供安全、隐私、规范使用的判断清单。"
      ],
      outputResults: [
        "班级整体掌握情况：概念理解、过程表达、迁移应用分别给出等级。",
        "学生分层建议：基础巩固组、表达提升组、拓展挑战组。",
        "教学改进建议：下一节课需要补讲的问题和可优化的活动环节。"
      ]
    }
  };
}

function normalizeLines(value: string, fallback: string[]) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : fallback;
}

function buildScenario(topic: string, additionalNeeds: string) {
  const preference = additionalNeeds.trim() ? ` 本课还要体现：${additionalNeeds.trim()}` : "";
  if (topic.includes("数据") || topic.includes("网络") || topic.includes("分包")) {
    return `学校午间有很多同学同时观看校园电视台视频，有时视频会卡顿。请用“快递分包”的方式解释数据为什么要拆分、编号、传输和重组。${preference}`;
  }
  if (topic.includes("人工智能") || topic.includes("智能")) {
    return `校园门口的智能识别设备能快速判断通行信息。请分析它需要哪些数据、怎样做出判断，以及使用时要注意哪些隐私问题。${preference}`;
  }
  if (topic.includes("物联网")) {
    return `校园植物角安装了温湿度传感器，请分析设备如何采集数据、传输数据并触发提醒。${preference}`;
  }
  return `从学生熟悉的校园数字生活现象出发，围绕“${topic}”提出问题、拆解过程、表达证据并讨论责任。${preference}`;
}

function createLiteracyEvidence(topic: string, objectives: string[]) {
  const literacyItems: Array<{
    literacy: CoreLiteracy;
    objective: string;
    activity: string;
    taskEvidence: string;
    assessmentEvidence: string;
    method: string;
    risk: string;
    improvement: string;
  }> = [
    {
      literacy: "信息意识",
      objective: objectives[0] ?? `能发现“${topic}”与真实数字生活的关系。`,
      activity: "观察真实情境，提出与课题有关的信息问题。",
      taskEvidence: "任务单中的现象记录和问题描述。",
      assessmentEvidence: "基础理解题中对课题价值和现象原因的判断。",
      method: "教师巡看任务单，结合课堂追问进行口头评价。",
      risk: "学生可能只描述表面现象，不能提出有信息价值的问题。",
      improvement: "提供“现象-问题-可能原因”的句式支架。"
    },
    {
      literacy: "计算思维",
      objective: objectives[1] ?? `能拆解“${topic}”中的关键过程。`,
      activity: "小组把关键过程拆成步骤，并用流程图或表格建模。",
      taskEvidence: "小组过程图、步骤表和修改痕迹。",
      assessmentEvidence: "原理解释题中对输入、处理、输出关系的说明。",
      method: "使用流程完整性、逻辑准确性、表达清晰度三项标准评价。",
      risk: "学生容易把生活类比当成结论，忽略真实的信息处理逻辑。",
      improvement: "增加反例追问：如果某一步缺失，结果会怎样。"
    },
    {
      literacy: "数字化学习与创新",
      objective: "能使用数字工具记录、整理和展示小组学习成果。",
      activity: "使用电子任务单或协作白板整理模型，展示并根据反馈修改。",
      taskEvidence: "协作记录、作品截图和展示说明。",
      assessmentEvidence: "创新表达题中的说明图、课堂新情境或任务优化建议。",
      method: "同伴互评与教师点评结合，关注作品是否可读、可解释、可迁移。",
      risk: "学生可能把注意力放在版式美化，忽视内容准确性。",
      improvement: "先给内容评价标准，再允许美化表达。"
    },
    {
      literacy: "信息社会责任",
      objective: "能结合真实应用讨论安全、隐私和规范使用问题。",
      activity: "围绕校园或家庭数字生活情境提出使用建议。",
      taskEvidence: "任务单中的风险提醒和责任建议。",
      assessmentEvidence: "情境迁移题中对安全、隐私或规范行为的回答。",
      method: "依据建议是否具体、合理、可执行进行评价。",
      risk: "学生回答可能停留在“注意安全”等口号。",
      improvement: "提供“谁可能受影响、如何避免、我能怎么做”的表达支架。"
    }
  ];

  return literacyItems.map((item) => ({
    literacy: item.literacy,
    teachingObjective: item.objective,
    learningActivity: item.activity,
    taskEvidence: item.taskEvidence,
    assessmentEvidence: item.assessmentEvidence,
    evaluationMethod: item.method,
    achievementStatus: "V2 mock 预设：待课堂实施后根据学生证据更新。",
    riskAlert: item.risk,
    improvementSuggestion: item.improvement
  }));
}
