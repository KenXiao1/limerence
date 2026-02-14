# Limerence Pi Web

基于 `pi-mono` 生态（`@mariozechner/pi-agent-core` + `@mariozechner/pi-web-ui`）重建的 Web 端。

## 仓库分工

- `pi-web/`：当前主线实现（继续开发、部署、修复都在这里）
- `legacy-web/`：legacy React 版本，保留为 Intro/UI 参考与对照，不再作为主部署目标

## 功能

- Agent Loop 直接使用 `pi-agent-core`
- 保留 Intro 首页（`/`）+ 聊天页（`/chat`）双视图
- 保留 Limerence 原始 6 个工具：
  - `memory_search`
  - `web_search`
  - `note_write`
  - `note_read`
  - `file_read`
  - `file_write`
- BM25 记忆检索（CJK 分词）
- IndexedDB 持久化（会话、记忆、笔记、文件）
- Netlify Edge Functions：
  - `/api/llm/v1/chat/completions`
  - `/api/web-search`

## 本地开发

```bash
cd pi-web
npm install
npm run dev
```

## 静态分析

```bash
cd pi-web
npm run lint
npm run check:loc
npm run static
```

- `npm run lint`：运行 `oxlint`（启用 `--deny-warnings`，warning 也会失败）
- `npm run check:loc`：校验源码文件 LOC 上限（默认每文件 500 行）
- `npm run static`：依次执行 `typecheck + lint + check:loc`，用于本地和 CI 统一门禁
- GitHub Actions 工作流 `pi-web-static-analysis.yml` 会在 `pi-web/**` 相关变更的 `push/pull_request` 上自动执行 `npm run static`

## Netlify GitHub 部署（推荐）

1. 在 Netlify 里选择 `Add new site -> Import an existing project`
2. 连接你的 GitHub 仓库
3. 使用仓库根目录的 `netlify.toml`（已默认指向 `pi-web`）
4. 在 Site settings -> Environment variables 配置（按需）：
   - `LLM_API_KEY`
   - `LLM_BASE_URL`
   - `LLM_MODEL_ID`

如果配置了 `LLM_API_KEY`，可在页面右上角切换 `Proxy` 模式，前端将通过 Netlify 代理调用模型。

> 备注：本地 `netlify deploy` 仅用于临时验证，正式发布建议只走 GitHub 自动构建。
