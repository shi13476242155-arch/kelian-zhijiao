import { useMemo, useRef, useState } from "react";
import type { ClassroomResourcePackage } from "@kelian-zhixue/shared";
import { Bot, CheckCircle2, ClipboardList, FileUp, GraduationCap, ImagePlus, Loader2, Send, Settings, Sparkles, X } from "lucide-react";

type StudentInfo = {
  className: string;
  studentName: string;
  studentNumber: string;
};

type TabId = "task" | "assessment" | "assistant";
type Screen = "setup" | "learning";

type AssessmentItem = {
  id: string;
  type: "单选题" | "判断题" | "简答题" | "分析题（选做）";
  prompt: string;
  stem?: string;
  options?: string[];
  answer?: string;
};

type TaskResponse = {
  text: string;
  imageBase64?: string;
};

type StudentLearningData = {
  id: string;
  exportedAt: string;
  studentInfo: StudentInfo;
  lesson: {
    title: string;
    grade: string;
    module: string;
  };
  startedAt: string;
  finishedAt: string;
  taskResponses: Array<{ id: string; prompt: string; response: string; imageBase64?: string }>;
  assessmentResponses: Array<{ id: string; type: string; prompt: string; response: string; studentAnswer?: string; correctAnswer?: string }>;
  assistantMessages: Array<{ role: "student" | "assistant"; content: string; time: string }>;
  progress: {
    taskCompletionRate: number;
    assessmentCompletionRate: number;
  };
  diagnosisSignals: {
    conceptUnderstanding: string;
    processExpression: string;
    transferAbility: string;
    responsibilityAwareness: string;
  };
};

const apiBaseUrl = "http://localhost:3000";

function loadAiSettings() {
  try {
    const raw = localStorage.getItem("kelian.student.aiSettings");
    return raw ? JSON.parse(raw) : { apiKey: "", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash" };
  } catch {
    return { apiKey: "", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash" };
  }
}

const emptyStudentInfo: StudentInfo = {
  className: "",
  studentName: "",
  studentNumber: ""
};

function hasDrawingKeyword(prompt: string) {
  return /画图|流程图|图示|画画|绘制|图画|画一画|画出|作图|示意图/.test(prompt);
}

function parseAssessmentItem(prompt: string, type: string, id: string): AssessmentItem {
  // 单选题解析
  if (type === "单选题") {
    const stemMatch = prompt.match(/^单选题\d*[：:]\s*(.+?)(?=\n?\s*A[.、])/s);
    const stem = stemMatch ? stemMatch[1].trim() : prompt.split("\n")[0].replace(/^单选题\d*[：:]\s*/, "").trim();
    const options: string[] = [];
    const optRegex = /([A-D])[.、]\s*(.+?)(?=\s*(?:[A-D][.、]|参考答案|$))/gs;
    let optMatch: RegExpExecArray | null;
    while ((optMatch = optRegex.exec(prompt)) !== null) {
      options.push(`${optMatch[1]}. ${optMatch[2].trim()}`);
    }
    const ansMatch = prompt.match(/参考答案[：:]\s*([A-D])/);
    const answer = ansMatch ? ansMatch[1] : "";
    return { id, type: "单选题", prompt, stem, options, answer };
  }
  // 判断题解析
  if (type === "判断题") {
    const stemMatch = prompt.match(/^判断题\d*[：:]\s*(.+?)(?=\n?\s*参考|$)/s);
    const stem = stemMatch ? stemMatch[1].trim().replace(/^["""]|["""]$/g, "") : prompt.replace(/^判断题\d*[：:]\s*/, "").replace(/参考答案.+$/s, "").trim();
    const ansMatch = prompt.match(/参考答案[：:]\s*(对|错)/);
    const answer = ansMatch ? ansMatch[1] : "";
    return { id, type: "判断题", prompt, stem, answer };
  }
  // 简答题和分析题保持原样
  return { id, type: type as AssessmentItem["type"], prompt, stem: prompt };
}

export function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [resourcePackage, setResourcePackage] = useState<ClassroomResourcePackage | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo>(emptyStudentInfo);
  const [startedAt, setStartedAt] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("task");
  const [taskResponses, setTaskResponses] = useState<Record<string, TaskResponse>>({});
  const [assessmentResponses, setAssessmentResponses] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: "student" | "assistant"; content: string; time: string }>>([
    {
      role: "assistant",
      content: "上传课堂资源包后，我会根据任务单和测评题给你学习提示。",
      time: new Date().toISOString()
    }
  ]);
  const [message, setMessage] = useState("");
  const [aiSettings, setAiSettings] = useState(loadAiSettings);
  const [showAiSettings, setShowAiSettings] = useState(false);

  function saveAiSettings(patch: Partial<ReturnType<typeof loadAiSettings>>) {
    setAiSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("kelian.student.aiSettings", JSON.stringify(next));
      return next;
    });
  }

  const rawAssessmentItems = useMemo(() => {
    if (!resourcePackage) {
      return [];
    }
    return [
      ...resourcePackage.layeredAssessment.basicUnderstanding.map((prompt, index) => ({ id: `choice-${index}`, type: "单选题", prompt })),
      ...resourcePackage.layeredAssessment.principleExplanation.map((prompt, index) => ({ id: `judge-${index}`, type: "判断题", prompt })),
      ...resourcePackage.layeredAssessment.scenarioTransfer.map((prompt, index) => ({ id: `short-${index}`, type: "简答题", prompt })),
      ...resourcePackage.layeredAssessment.creativeExpression.map((prompt, index) => ({ id: `analysis-${index}`, type: "分析题（选做）", prompt }))
    ];
  }, [resourcePackage]);

  const assessmentItems = useMemo(() => {
    return rawAssessmentItems.map((item) => parseAssessmentItem(item.prompt, item.type, item.id));
  }, [rawAssessmentItems]);

  const taskItems = useMemo(() => {
    if (!resourcePackage) {
      return [];
    }
    return [
      ...resourcePackage.learningTaskSheet.taskSteps,
      ...resourcePackage.learningTaskSheet.reflectionQuestions.map((item) => `反思：${item}`)
    ].map((prompt, index) => ({ id: `task-${index}`, prompt }));
  }, [resourcePackage]);

  const studentReady = studentInfo.className.trim() && studentInfo.studentName.trim() && studentInfo.studentNumber.trim();
  const canStart = resourcePackage && studentReady;

  const taskProgress = useMemo(() => {
    const total = taskItems.length;
    const done = taskItems.filter((item) => {
      const r = taskResponses[item.id];
      return (r?.text?.trim().length ?? 0) > 0 || Boolean(r?.imageBase64);
    }).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [taskItems, taskResponses]);

  const assessmentProgress = useMemo(() => {
    const total = assessmentItems.length;
    const done = assessmentItems.filter((item) => (assessmentResponses[item.id] ?? "").trim().length > 0).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [assessmentItems, assessmentResponses]);

  async function handleUpload(file: File | null) {
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ClassroomResourcePackage | { resourcePackage?: ClassroomResourcePackage };
      const nextPackage = "resourcePackage" in parsed && parsed.resourcePackage ? parsed.resourcePackage : (parsed as ClassroomResourcePackage);
      if (!nextPackage.learningTaskSheet || !nextPackage.layeredAssessment) {
        setMessage("这个文件不是有效的课堂资源包，请上传教师端导出的 JSON。");
        return;
      }
      setResourcePackage(nextPackage);
      setMessage("课堂资源包已载入，请填写学生信息后开始学习。");
      setAssistantMessages([
        {
          role: "assistant",
          content: `已载入《${nextPackage.teachingNeed.topicName}》。你可以先阅读任务单，遇到困难时来问我。`,
          time: new Date().toISOString()
        }
      ]);
    } catch {
      setMessage("文件读取失败，请确认上传的是 JSON 格式课堂资源包。");
    }
  }

  function startLearning() {
    if (!canStart) {
      setMessage("请先上传资源包，并填写班级、姓名和学号。");
      return;
    }
    setStartedAt(new Date().toISOString());
    setScreen("learning");
    setActiveTab("task");
    setMessage("");
  }

  async function askAssistant() {
    const input = assistantInput.trim();
    if (!input || !resourcePackage || assistantLoading) return;
    const now = new Date().toISOString();
    setAssistantMessages((current) => [...current, { role: "student", content: input, time: now }]);
    setAssistantInput("");
    setAssistantLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/ai/student-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiConfig: { apiKey: aiSettings.apiKey, baseUrl: aiSettings.baseUrl, model: aiSettings.model },
          question: input,
          context: {
            topicName: resourcePackage.teachingNeed.topicName,
            grade: String(resourcePackage.teachingNeed.grade),
            currentTask: activeTab === "task" ? "学习任务单" : activeTab === "assessment" ? "测评题" : "AI 伴学",
            taskGoal: resourcePackage.learningTaskSheet.taskGoal,
            learningSupports: resourcePackage.learningTaskSheet.learningSupports
          }
        })
      });

      if (response.ok) {
        const data = await response.json() as { reply?: string };
        setAssistantMessages((current) => [...current, { role: "assistant", content: data.reply ?? "我暂时无法回答，请换个问题试试。", time: new Date().toISOString() }]);
      } else {
        setAssistantMessages((current) => [...current, { role: "assistant", content: fallbackReply(input, resourcePackage), time: new Date().toISOString() }]);
      }
    } catch {
      setAssistantMessages((current) => [...current, { role: "assistant", content: fallbackReply(input, resourcePackage), time: new Date().toISOString() }]);
    } finally {
      setAssistantLoading(false);
    }
  }

  function finishClass() {
    if (!resourcePackage || !startedAt) {
      setMessage("请先开始学习，再导出学习数据。");
      return;
    }
    const data = buildStudentLearningData({
      resourcePackage,
      studentInfo,
      startedAt,
      taskItems,
      taskResponses,
      assessmentItems,
      assessmentResponses,
      assistantMessages
    });
    downloadJson(data, `${studentInfo.className}-${studentInfo.studentName}-${resourcePackage.teachingNeed.topicName}-学习数据.json`);
  }

  return (
    <main className="h-full text-ink w-full flex flex-col overflow-hidden bg-white">
        {screen === "setup" ? (
          <>
            <header className="shrink-0 border-b border-[#ebe7e2] bg-gradient-to-br from-white via-[#fbfaf8] to-[#fff8f4] px-4 py-3 text-[#17191c]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fff8f4] text-[#d9826b] ring-1 ring-[#f2d8cf]">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold">课链智教学生端</p>
                  <p className="text-[11px] text-[#77736e]">课堂任务 · 测评 · AI伴学</p>
                </div>
              </div>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              <div className="rounded-2xl border border-[#ebe7e2] bg-white/88 p-3 shadow-[0_10px_24px_rgba(50,42,36,0.05)]">
                <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#f2d8cf] bg-[#fff8f4] px-3 py-2.5 text-xs font-semibold text-[#bd6a56] hover:bg-[#fbeee8] transition">
                  <FileUp size={15} />
                  上传教师资源包 JSON
                  <input
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>
                {resourcePackage ? (
                  <div className="mt-3 rounded-xl bg-[#fbfaf8] p-2.5">
                    <p className="text-xs font-semibold text-[#17191c]">《{resourcePackage.teachingNeed.topicName}》</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#77736e]">
                      {resourcePackage.teachingNeed.grade}｜{resourcePackage.teachingNeed.courseModule}｜{resourcePackage.teachingNeed.classHours}课时
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-[#ebe7e2] bg-white/88 p-3 shadow-[0_10px_24px_rgba(50,42,36,0.05)]">
                <p className="text-xs font-semibold text-[#17191c]">学生信息</p>
                <p className="mt-0.5 text-[11px] leading-4 text-[#77736e]">仅用于本节课学习记录和学情分析。</p>
                <div className="mt-2 grid gap-2">
                  <StudentInput label="班级" value={studentInfo.className} onChange={(value) => setStudentInfo((current) => ({ ...current, className: value }))} />
                  <StudentInput label="姓名" value={studentInfo.studentName} onChange={(value) => setStudentInfo((current) => ({ ...current, studentName: value }))} />
                  <StudentInput label="学号" value={studentInfo.studentNumber} onChange={(value) => setStudentInfo((current) => ({ ...current, studentNumber: value }))} />
                </div>
                <button
                  className="mt-3 w-full rounded-lg bg-[#17191c] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#2a2a2d] disabled:cursor-not-allowed disabled:bg-[#cbc3bb]"
                  disabled={!canStart}
                  onClick={startLearning}
                  type="button"
                >
                  开始学习
                </button>
              </div>

              <div className="rounded-2xl border border-[#ebe7e2] bg-white/88 shadow-[0_10px_24px_rgba(50,42,36,0.05)]">
                <button
                  className="flex w-full items-center justify-between px-3 py-2.5 text-xs transition"
                  onClick={() => setShowAiSettings(!showAiSettings)}
                  type="button"
                >
                  <span className="flex items-center gap-1.5 font-semibold text-[#17191c]">
                    <Settings size={13} />
                    AI 伴学设置
                  </span>
                  <span className="text-[10px] text-[#9d9b98]">{showAiSettings ? "收起" : "展开"}</span>
                </button>
                {showAiSettings && (
                  <div className="border-t border-[#ebe7e2] px-3 py-3 space-y-2.5">
                    <label className="grid gap-0.5 text-xs">
                      <span className="font-semibold text-[#4b4b4c]">API Key</span>
                      <input
                        className="rounded-md border border-[#ebe7e2] bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-[#d9826b] focus:ring-2 focus:ring-[#fbeee8]"
                        onChange={(e) => saveAiSettings({ apiKey: e.target.value })}
                        placeholder="sk-..."
                        type="password"
                        value={aiSettings.apiKey}
                      />
                    </label>
                    <label className="grid gap-0.5 text-xs">
                      <span className="font-semibold text-[#4b4b4c]">接口地址</span>
                      <input
                        className="rounded-md border border-[#ebe7e2] bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-[#d9826b] focus:ring-2 focus:ring-[#fbeee8]"
                        onChange={(e) => saveAiSettings({ baseUrl: e.target.value })}
                        value={aiSettings.baseUrl}
                      />
                    </label>
                    <label className="grid gap-0.5 text-xs">
                      <span className="font-semibold text-[#4b4b4c]">模型</span>
                      <input
                        className="rounded-md border border-[#ebe7e2] bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-[#d9826b] focus:ring-2 focus:ring-[#fbeee8]"
                        onChange={(e) => saveAiSettings({ model: e.target.value })}
                        value={aiSettings.model}
                      />
                    </label>
                    <p className="text-[10px] leading-4 text-[#9d9b98]">填写 API Key 后 AI 伴学才能智能回复。Key 仅保存在本机，不会上传。</p>
                  </div>
                )}
              </div>

              {message ? <p className="rounded-lg bg-[#fff8f4] px-3 py-2 text-xs leading-5 text-[#bd6a56]">{message}</p> : null}
            </div>
          </>
        ) : (
          <>
            <header className="flex shrink-0 items-center justify-between border-b border-[#ebe7e2] bg-white/80 px-3 py-2 backdrop-blur">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#17191c]">《{resourcePackage?.teachingNeed.topicName}》</p>
                <p className="text-[10px] text-[#77736e]">{resourcePackage?.teachingNeed.grade} · {resourcePackage?.teachingNeed.courseModule}</p>
              </div>
              <button className="ml-2 shrink-0 rounded-md bg-[#17191c] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#2a2a2d] transition" onClick={finishClass} type="button">下课导出</button>
            </header>

            <div className="flex shrink-0 border-b border-[#ebe7e2]">
              <TabButton active={activeTab === "task"} badge={taskProgress.done > 0 ? `${taskProgress.done}/${taskProgress.total}` : undefined} icon={<ClipboardList size={13} />} label="任务单" onClick={() => setActiveTab("task")} />
              <TabButton active={activeTab === "assessment"} badge={assessmentProgress.done > 0 ? `${assessmentProgress.done}/${assessmentProgress.total}` : undefined} icon={<CheckCircle2 size={13} />} label="测试题" onClick={() => setActiveTab("assessment")} />
              <TabButton active={activeTab === "assistant"} icon={<Bot size={13} />} label="AI伴学" onClick={() => setActiveTab("assistant")} />
            </div>

            <div className="shrink-0 border-b border-[#f0ebe6] px-3 py-1.5">
              <div className="flex items-center gap-2 text-[10px] text-[#9d9b98]">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#f2efeb]">
                  <div className="h-full rounded-full bg-[#d9826b] transition-all" style={{ width: `${Math.round(((taskProgress.done + assessmentProgress.done) / (taskProgress.total + assessmentProgress.total || 1)) * 100)}%` }} />
                </div>
                <span>{taskProgress.done + assessmentProgress.done}/{taskProgress.total + assessmentProgress.total}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {activeTab === "task" && resourcePackage ? (
                <TaskPanel
                  resourcePackage={resourcePackage}
                  taskItems={taskItems}
                  responses={taskResponses}
                  onTextChange={(id, text) => setTaskResponses((current) => ({ ...current, [id]: { text, imageBase64: current[id]?.imageBase64 } }))}
                  onImageChange={(id, imageBase64) => setTaskResponses((current) => ({ ...current, [id]: { text: current[id]?.text ?? "", imageBase64 } }))}
                  onImageRemove={(id) => setTaskResponses((current) => ({ ...current, [id]: { text: current[id]?.text ?? "" } }))}
                  previewImage={previewImage}
                  onPreviewImage={setPreviewImage}
                />
              ) : null}
              {activeTab === "assessment" ? (
                <AssessmentPanel items={assessmentItems} responses={assessmentResponses} onChange={(id, value) => setAssessmentResponses((current) => ({ ...current, [id]: value }))} />
              ) : null}
              {activeTab === "assistant" ? (
                <AssistantPanel input={assistantInput} loading={assistantLoading} messages={assistantMessages} onAsk={askAssistant} onInput={setAssistantInput} />
              ) : null}
            </div>
          </>
        )}
    </main>
  );
}

function StudentInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="grid gap-0.5 text-xs">
      <span className="font-semibold text-[#4b4b4c]">{label}</span>
      <input
        className="rounded-md border border-[#ebe7e2] bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-[#d9826b] focus:ring-2 focus:ring-[#fbeee8]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function TabButton({
  active,
  badge,
  icon,
  label,
  onClick
}: {
  active: boolean;
  badge?: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex flex-1 items-center justify-center gap-1 px-1 py-2 text-xs font-semibold transition ${
        active ? "bg-[#fff8f4] text-[#bd6a56]" : "text-[#77736e] hover:bg-[#fbfaf8]"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
      {badge ? <span className="rounded-full bg-[#f2d8cf] px-1 py-0.5 text-[9px] font-bold text-[#bd6a56]">{badge}</span> : null}
    </button>
  );
}

function TaskPanel({
  onImageChange,
  onImageRemove,
  onPreviewImage,
  onTextChange,
  previewImage,
  resourcePackage,
  responses,
  taskItems
}: {
  onImageChange: (id: string, base64: string) => void;
  onImageRemove: (id: string) => void;
  onPreviewImage: (url: string | null) => void;
  onTextChange: (id: string, text: string) => void;
  previewImage: string | null;
  resourcePackage: ClassroomResourcePackage;
  responses: Record<string, TaskResponse>;
  taskItems: Array<{ id: string; prompt: string }>;
}) {
  return (
    <div className="space-y-3">
      <InfoBlock title="任务目标" items={resourcePackage.learningTaskSheet.taskGoal} />
      <div className="rounded-lg bg-[#fff8f4] p-3 text-sm leading-6 text-[#4b4b4c]">
        <p className="font-semibold text-[#bd6a56]">情境导入</p>
        <p className="mt-1">{resourcePackage.learningTaskSheet.scenarioIntroduction}</p>
      </div>
      {taskItems.map((item, index) => {
        const drawing = hasDrawingKeyword(item.prompt);
        const resp = responses[item.id];
        return (
          <TaskCard
            key={item.id}
            drawing={drawing}
            index={index}
            imageBase64={resp?.imageBase64}
            onImageChange={(b64) => onImageChange(item.id, b64)}
            onImageRemove={() => onImageRemove(item.id)}
            onPreview={onPreviewImage}
            onTextChange={(text) => onTextChange(item.id, text)}
            prompt={item.prompt}
            text={resp?.text ?? ""}
          />
        );
      })}
      <InfoBlock title="学习支架" items={resourcePackage.learningTaskSheet.learningSupports} />
      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => onPreviewImage(null)}>
          <img alt="预览" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" src={previewImage} />
        </div>
      ) : null}
    </div>
  );
}

function TaskCard({
  drawing,
  imageBase64,
  index,
  onImageChange,
  onImageRemove,
  onPreview,
  onTextChange,
  prompt,
  text
}: {
  drawing: boolean;
  imageBase64?: string;
  index: number;
  onImageChange: (base64: string) => void;
  onImageRemove: () => void;
  onPreview: (url: string | null) => void;
  onTextChange: (text: string) => void;
  prompt: string;
  text: string;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onImageChange(String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
  }

  return (
    <article className="rounded-2xl border border-[#ebe7e2] bg-white/90 p-3 shadow-[0_10px_24px_rgba(50,42,36,0.05)]">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fbeee8] text-xs font-bold text-[#bd6a56]">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-6 text-[#4b4b4c]">{prompt}</p>
          <textarea
            className="mt-3 min-h-20 w-full resize-y rounded-xl border border-[#ebe7e2] bg-white/90 px-3 py-2 text-sm leading-6 outline-none focus:border-[#d9826b] focus:ring-2 focus:ring-[#fbeee8]"
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="把你的想法写在这里"
            value={text}
          />
          {drawing ? (
            <div className="mt-2">
              {imageBase64 ? (
                <div className="relative inline-block">
                  <img
                    alt="已上传"
                    className="max-h-32 max-w-full cursor-pointer rounded-lg border border-[#ebe7e2] object-contain"
                    onClick={() => onPreview(imageBase64)}
                    src={imageBase64}
                  />
                  <button
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    onClick={onImageRemove}
                    type="button"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#d8d1ca] px-3 py-2 text-xs text-[#77736e] hover:border-[#d9826b] hover:text-[#d9826b] transition"
                  onClick={() => fileRef.current?.click()}
                  type="button"
                >
                  <ImagePlus size={15} />
                  上传图片（流程图/示意图）
                  <input accept="image/png,image/jpeg,image/gif" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} ref={fileRef} type="file" />
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function AssessmentPanel({
  items,
  onChange,
  responses
}: {
  items: AssessmentItem[];
  onChange: (id: string, value: string) => void;
  responses: Record<string, string>;
}) {
  const globalIndex = useRef(0);
  return (
    <div className="space-y-3">
      {items.map((item) => {
        globalIndex.current += 1;
        const qNum = globalIndex.current;
        if (item.type === "单选题") {
          return <ChoiceQuestion key={item.id} item={item} num={qNum} onChange={(v) => onChange(item.id, v)} value={responses[item.id] ?? ""} />;
        }
        if (item.type === "判断题") {
          return <JudgeQuestion key={item.id} item={item} num={qNum} onChange={(v) => onChange(item.id, v)} value={responses[item.id] ?? ""} />;
        }
        // 简答题和分析题用文本输入
        const isOptional = item.type === "分析题（选做）";
        return (
          <article key={item.id} className="rounded-2xl border border-[#ebe7e2] bg-white/90 p-3 shadow-[0_10px_24px_rgba(50,42,36,0.05)]">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fbeee8] text-xs font-bold text-[#bd6a56]">{qNum}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#bd6a56]">{item.type}</span>
                  {isOptional ? <span className="rounded bg-[#f2efeb] px-1.5 py-0.5 text-[11px] text-[#77736e]">选做</span> : null}
                </div>
                <p className="mt-1 text-sm leading-6 text-[#4b4b4c]">{item.stem ?? item.prompt}</p>
                <textarea
                  className="mt-3 min-h-24 w-full resize-y rounded-lg border border-[#ebe7e2] px-3 py-2 text-sm leading-6 outline-none focus:border-[#d9826b] focus:ring-2 focus:ring-[#fbeee8]"
                  onChange={(event) => onChange(item.id, event.target.value)}
                  placeholder="把你的想法写在这里"
                  value={responses[item.id] ?? ""}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ChoiceQuestion({
  item,
  num,
  onChange,
  value
}: {
  item: AssessmentItem;
  num: number;
  onChange: (value: string) => void;
  value: string;
}) {
  const selected = value.trim();
  return (
    <article className="rounded-2xl border border-[#ebe7e2] bg-white/90 p-3 shadow-[0_10px_24px_rgba(50,42,36,0.05)]">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fbeee8] text-xs font-bold text-[#bd6a56]">{num}</span>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-[#bd6a56]">单选题</span>
          <p className="mt-1 text-sm leading-6 text-[#4b4b4c]">{item.stem ?? item.prompt}</p>
          <div className="mt-3 grid gap-2">
            {(item.options ?? []).map((opt) => {
              const label = opt.charAt(0);
              const active = selected === label;
              return (
                <button
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    active ? "border-[#d9826b] bg-[#fff8f4] text-[#8f5748] ring-1 ring-[#d9826b]" : "border-[#ebe7e2] bg-white text-[#4b4b4c] hover:border-[#e2a08e] hover:bg-[#fff8f4]/50"
                  }`}
                  key={label}
                  onClick={() => onChange(active ? "" : label)}
                  type="button"
                >
                  <span className="font-semibold">{opt}</span>
                  {active ? <span className="ml-2 text-xs text-[#d9826b]">✓ 已选择</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}

function JudgeQuestion({
  item,
  num,
  onChange,
  value
}: {
  item: AssessmentItem;
  num: number;
  onChange: (value: string) => void;
  value: string;
}) {
  const selected = value.trim();
  return (
    <article className="rounded-2xl border border-[#ebe7e2] bg-white/90 p-3 shadow-[0_10px_24px_rgba(50,42,36,0.05)]">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fbeee8] text-xs font-bold text-[#bd6a56]">{num}</span>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-[#bd6a56]">判断题</span>
          <p className="mt-1 text-sm leading-6 text-[#4b4b4c]">{item.stem ?? item.prompt}</p>
          <div className="mt-3 flex gap-3">
            {(["对", "错"] as const).map((choice) => {
              const active = selected === choice;
              return (
                <button
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? choice === "对" ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500" : "border-red-400 bg-red-50 text-red-700 ring-1 ring-red-400"
                      : "border-[#ebe7e2] bg-white text-[#5f5e5c] hover:border-[#e2a08e]"
                  }`}
                  key={choice}
                  onClick={() => onChange(active ? "" : choice)}
                  type="button"
                >
                  {choice === "对" ? "✓ 对" : "✗ 错"}
                  {active ? <span className="ml-1 text-xs">已选</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}

function AssistantPanel({
  input,
  loading,
  messages,
  onAsk,
  onInput
}: {
  input: string;
  loading: boolean;
  messages: Array<{ role: "student" | "assistant"; content: string; time: string }>;
  onAsk: () => void;
  onInput: (value: string) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {messages.map((message, index) => (
        <div
          className={`rounded-lg px-3 py-2 text-sm leading-6 ${
            message.role === "assistant" ? "bg-[#fff8f4] text-[#4b4b4c]" : "bg-[#f2efeb] text-[#4b4b4c]"
          }`}
          key={`${message.time}-${index}`}
        >
          <p className="flex items-center gap-1 text-xs font-semibold text-[#77736e]">
            {message.role === "assistant" ? (
              <><Sparkles size={12} /> AI伴学</>
            ) : (
              "我"
            )}
          </p>
          <p className="mt-1">{message.content}</p>
        </div>
      ))}
      {loading ? (
        <div className="flex items-center gap-2 rounded-lg bg-[#fff8f4] px-3 py-3 text-sm text-[#bd6a56]">
          <Loader2 size={16} className="animate-spin" />
          <span>AI 正在思考...</span>
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-[#ebe7e2] px-3 py-2 text-sm outline-none focus:border-[#d9826b] focus:ring-2 focus:ring-[#fbeee8]"
          disabled={loading}
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onAsk();
            }
          }}
          placeholder="写下你的问题"
          value={input}
        />
        <button className="rounded-lg bg-[#17191c] px-3 text-white disabled:opacity-50" disabled={loading} onClick={onAsk} type="button">
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>
    </div>
  );
}

function InfoBlock({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-lg bg-[#fbfaf8] p-3">
      <p className="text-sm font-semibold text-[#17191c]">{title}</p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-[#5f5e5c]">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function fallbackReply(question: string, resourcePackage: ClassroomResourcePackage) {
  const topic = resourcePackage.teachingNeed.topicName;
  if (question.includes("不会") || question.includes("不懂") || question.includes("怎么")) {
    return `可以先把“${topic}”拆成三步：看到什么现象、这个过程有哪些步骤、每一步有什么作用。先写你能确定的一步，再慢慢补全。`;
  }
  if (question.includes("答案") || question.includes("测评")) {
    return "我不能直接替你写答案，但可以提醒你：先找题目中的真实情境，再用课堂任务单里的步骤、证据和责任建议来回答。";
  }
  if (question.includes("流程") || question.includes("步骤")) {
    return "你可以用“先……接着……然后……最后……”来表达流程。如果涉及数据或信息处理，记得写清输入、处理和输出。";
  }
  return "建议你先回到任务单，找到和这个问题最接近的一条学习支架，再用自己的话写出理解。我可以继续帮你把思路拆小。";
}

function buildStudentLearningData({
  assessmentItems,
  assessmentResponses,
  assistantMessages,
  resourcePackage,
  startedAt,
  studentInfo,
  taskItems,
  taskResponses
}: {
  assessmentItems: AssessmentItem[];
  assessmentResponses: Record<string, string>;
  assistantMessages: Array<{ role: "student" | "assistant"; content: string; time: string }>;
  resourcePackage: ClassroomResourcePackage;
  startedAt: string;
  studentInfo: StudentInfo;
  taskItems: Array<{ id: string; prompt: string }>;
  taskResponses: Record<string, TaskResponse>;
}): StudentLearningData {
  const taskCompletionRate = completionRate(taskItems.map((item) => taskResponses[item.id]?.text ?? ""));
  const assessmentCompletionRate = completionRate(assessmentItems.map((item) => assessmentResponses[item.id]));
  return {
    id: `student-data-${Date.now()}`,
    exportedAt: new Date().toISOString(),
    studentInfo,
    lesson: {
      title: resourcePackage.teachingNeed.topicName,
      grade: resourcePackage.teachingNeed.grade,
      module: resourcePackage.teachingNeed.courseModule
    },
    startedAt,
    finishedAt: new Date().toISOString(),
    taskResponses: taskItems.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      response: taskResponses[item.id]?.text ?? "",
      imageBase64: taskResponses[item.id]?.imageBase64
    })),
    assessmentResponses: assessmentItems.map((item) => ({
      id: item.id,
      type: item.type,
      prompt: item.prompt,
      response: assessmentResponses[item.id] ?? "",
      studentAnswer: item.type === "单选题" || item.type === "判断题" ? (assessmentResponses[item.id] ?? "") : undefined,
      correctAnswer: item.answer
    })),
    assistantMessages,
    progress: {
      taskCompletionRate,
      assessmentCompletionRate
    },
    diagnosisSignals: {
      conceptUnderstanding: assessmentCompletionRate > 0.75 ? "基本掌握" : "需要巩固",
      processExpression: taskCompletionRate > 0.75 ? "表达较完整" : "过程表达偏弱",
      transferAbility: hasLongResponse(assessmentResponses) ? "有迁移表达" : "需要支持",
      responsibilityAwareness: containsAny(Object.values(taskResponses).map((r) => r.text).join("") + Object.values(assessmentResponses).join(""), ["安全", "隐私", "责任", "规范"])
        ? "较好"
        : "需要引导"
    }
  };
}

function completionRate(values: Array<string | undefined>) {
  if (values.length === 0) {
    return 0;
  }
  return Number((values.filter((value) => value && value.trim().length > 0).length / values.length).toFixed(2));
}

function hasLongResponse(responses: Record<string, string>) {
  return Object.values(responses).some((value) => value.trim().length >= 30);
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function downloadJson(data: StudentLearningData, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeFileName(filename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").trim() || "学生学习数据.json";
}
