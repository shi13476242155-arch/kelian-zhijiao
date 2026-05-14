# 课链智学

《课链智学——初中信息科技智能导学系统》是一套面向一线信息科技教师的智能导学工作台。V0 版本先提供可运行的前端工作台、后端健康检查接口、标准化课堂资源包样例和后续扩展结构。

## 零基础运行方法

1. 安装 Node.js 20 或更高版本。
2. 在项目根目录打开终端。
3. 第一次运行先安装依赖：

```bash
npm install
```

4. 启动开发环境：

```bash
npm run dev
```

5. 浏览器打开：

```text
http://localhost:5173
```

后端接口默认运行在：

```text
http://localhost:3000
```

如果提示 3000 端口被占用，请先关闭之前启动的 Node/Vite/Express 窗口，再重新运行 `npm run dev`。

## 常用命令

```bash
npm run dev
npm run build
npm run lint
```

## V0 已有功能

- 教师工作台首页
- 左侧教学流程导航
- 系统一句话定位、教师使用流程、应用亮点
- 快速开始与打开样例课例
- Mock 课堂资源包数据
- Express 后端接口：
  - `GET /api/health`
  - `GET /api/app-info`

## 项目结构

```text
kelian-zhixue/
├── apps/web
├── apps/server
├── packages/shared
├── samples
├── docs
├── README.md
├── TODO.md
├── .env.example
└── package.json
```

## 重要说明

V0 暂不接真实 AI，也不接数据库。后续会在保留标准 JSON 课堂资源包的基础上，逐步接入 LangGraph、OpenAI 兼容模型接口、Word 导出、素养证据链和置信度评估。
