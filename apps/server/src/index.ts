import cors from "cors";
import express from "express";
import type { AppInfo } from "@kelian-zhixue/shared";

const app = express();
const port = Number(process.env.PORT ?? 3000);

const appInfo: AppInfo = {
  name: "课链智学",
  version: "0.0.1",
  stage: "V0 最小可运行版本",
  description: "面向初中信息科技教师的智能导学工作台。",
  features: ["教师工作台", "标准化课堂资源包", "Mock 数据", "后续 AI 工作流扩展预留"]
};

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "kelian-zhixue-server",
    time: new Date().toISOString()
  });
});

app.get("/api/app-info", (_req, res) => {
  res.json(appInfo);
});

app.listen(port, () => {
  console.log(`Kelian Zhixue server is running at http://localhost:${port}`);
});
