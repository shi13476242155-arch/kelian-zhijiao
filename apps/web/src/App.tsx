import {
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  BrainCircuit,
  ClipboardCheck,
  FileDown,
  Gauge,
  Home,
  Layers3,
  LibraryBig,
  Lightbulb,
  PenLine,
  Route,
  Sparkles,
  UsersRound
} from "lucide-react";
import { navigationItems, sampleLesson } from "./mock";

const iconMap = [
  Home,
  PenLine,
  Sparkles,
  BookOpenText,
  Route,
  Gauge,
  FileDown,
  UsersRound,
  LibraryBig
];

const flowSteps = [
  {
    title: "输入教学需求",
    text: "从课题、课时、学情和教材位置开始，形成可追溯的课例起点。"
  },
  {
    title: "组织任务链",
    text: "把目标、活动、学生产出和教师提示组织成课堂可执行流程。"
  },
  {
    title: "形成证据链",
    text: "把核心素养、评价证据和学生作品连接起来，便于说课与展示。"
  },
  {
    title: "评估并导出",
    text: "检查资源包置信度，导出 JSON、HTML 和后续 Word 文档。"
  }
];

const highlights = [
  {
    icon: BrainCircuit,
    title: "面向课标与素养",
    text: "资源包结构围绕初中信息科技核心素养设计。"
  },
  {
    icon: ClipboardCheck,
    title: "可编辑可评估",
    text: "生成结果不是一次性文本，而是可继续打磨的课堂资产。"
  },
  {
    icon: Layers3,
    title: "适合比赛展示",
    text: "保留标准 JSON、Mock 数据和后续 AI 工作流扩展位置。"
  }
];

export function App() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-5 py-6 lg:block">
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
            {navigationItems.map((item, index) => {
              const Icon = iconMap[index];
              const active = index === 0;
              return (
                <button
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                  }`}
                  key={item}
                  type="button"
                  title={item}
                >
                  <Icon size={18} />
                  <span>{item}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1">
          <section className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="mb-3 inline-flex rounded-md bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                    V0 最小可运行版本
                  </p>
                  <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                    课链智学教师工作台
                  </h1>
                  <p className="mt-4 text-lg leading-8 text-slate-600">
                    {sampleLesson.positioning}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700">
                    快速开始
                    <ArrowRight size={17} />
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-600 hover:text-teal-700">
                    打开样例课例
                    <BookOpenText size={17} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:px-8 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">教师使用流程</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      按备课真实路径组织，先把课堂跑通，再逐步接入智能生成。
                    </p>
                  </div>
                  <BadgeCheck className="text-teal-600" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {flowSteps.map((step, index) => (
                    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={step.title}>
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-white text-sm font-semibold text-teal-700 shadow-sm">
                        {index + 1}
                      </div>
                      <h3 className="font-semibold text-slate-900">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
                <h2 className="text-xl font-semibold text-slate-950">应用亮点</h2>
                <p className="mt-1 text-sm text-slate-500">
                  V0 聚焦结构清晰、演示可信、后续扩展不返工。
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {highlights.map((item) => (
                    <article className="rounded-lg border border-slate-200 p-4" key={item.title}>
                      <item.icon className="mb-4 text-teal-600" size={24} />
                      <h3 className="font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
                <h2 className="text-xl font-semibold text-slate-950">样例课例</h2>
                <p className="mt-1 text-sm text-slate-500">教师可用它验证资源包结构和证据链表达。</p>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-sm text-slate-500">课题</p>
                    <p className="font-semibold text-slate-900">{sampleLesson.title}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-slate-500">年级</p>
                      <p className="mt-1 font-medium">{sampleLesson.grade}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 p-3">
                      <p className="text-slate-500">课时</p>
                      <p className="mt-1 font-medium">{sampleLesson.duration}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">学情提示</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{sampleLesson.learningSituation}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-ink p-6 text-white shadow-soft">
                <h2 className="text-xl font-semibold">下一步建议</h2>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  先完善“新建课例”表单，再把样例资源包生成逻辑接入 AI 生成中心。
                </p>
                <div className="mt-5 rounded-md bg-white/10 p-4 text-sm text-slate-100">
                  每个页面都将保留教师使用提示，方便比赛评委快速理解系统价值。
                </div>
              </div>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}
