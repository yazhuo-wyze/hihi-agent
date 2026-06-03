# hihi-agent 实施计划

## 1. 问题与目标

基于 [@github/copilot-sdk](https://github.com/github/copilot-sdk) (Node.js/TypeScript) 构建一个 agent 应用 `hihi-agent`：

- **CLI**：`ask`（仅问答，拒绝所有工具）/ `auto`（自动批准工具，含危险命令黑名单二次确认）
- **Web**：Next.js + shadcn/ui，单用户本地工具（localhost），SSE 流式输出
- **可扩展**：自定义 MCP（文件 + Web UI 编辑）、自定义 Skill（默认 SkillHub 搜索/安装，备用 awesome-copilot，本地目录）
- **LLM**：支持 OpenAI / OpenAI 兼容（DeepSeek、Qwen、Ollama 等）BYOK；未配置时回退到 GitHub Copilot 登录态（`useLoggedInUser: true`，需用户已 `gh auth login` 且具备 Copilot 订阅）
- **会话**：CLI / Web 均支持历史持久化与恢复（复用 SDK 内置 `~/.copilot` + 应用层 `~/.hihi-agent`）

## 2. 整体架构

```
hihi-agent/  (pnpm workspace, TypeScript)
├── packages/
│   ├── core/              # 核心层 (SDK 封装、配置、MCP/Skill 加载、Provider 选择)
│   │   ├── client.ts      # createAgentClient(options) -> CopilotClient
│   │   ├── config.ts      # ~/.hihi-agent/config.json 读写
│   │   ├── provider.ts    # OpenAI / OpenAI 兼容 / Copilot 登录态
│   │   ├── mcp.ts         # 加载 mcp.json -> Tool[]，启动子进程并桥接 stdio
│   │   ├── skills/        # 本地加载 + sources/{skillhub,awesome-copilot}.ts
│   │   ├── permission.ts  # ask=denyAll, auto=blacklist + confirm
│   │   └── session.ts     # 会话历史抽象（列表/恢复/删除）
│   └── shared/            # 共享类型 (Message, ToolCall, Config, ...)
├── apps/
│   ├── cli/               # commander + ink (可选) + chalk
│   │   ├── bin/hihi.ts
│   │   └── src/commands/{ask,auto,mcp,skill,config,session}.ts
│   └── web/               # Next.js 14 App Router + shadcn/ui
│       ├── app/
│       │   ├── api/chat/route.ts      # SSE 转发 session 事件
│       │   ├── api/sessions/...
│       │   ├── api/mcp/...
│       │   ├── api/skills/...
│       │   └── api/config/...
│       ├── app/(chat)/page.tsx        # 对话主界面
│       ├── app/settings/page.tsx      # Provider / MCP / Skill 配置 UI
│       └── components/ui/             # shadcn 组件
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── README.md
```

## 3. 配置与数据目录

```
~/.hihi-agent/
├── config.json         # provider, defaultModel, theme 等
├── mcp.json            # MCP servers 配置 (Claude Desktop 兼容格式)
├── skills/             # 本地 skill 目录 (SKILL.md + 资源)
└── cache/              # 远程拉取的 skill 缓存
```

`config.json` 示例：
```json
{
  "provider": { "type": "openai-compat", "baseURL": "...", "apiKey": "...", "model": "deepseek-chat" },
  "fallback": "github-copilot",
  "models": [
    { "id": "deepseek-chat",  "provider": "openai-compat", "baseURL": "https://api.deepseek.com/v1", "apiKey": "..." },
    { "id": "qwen-max",       "provider": "openai-compat", "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1", "apiKey": "..." },
    { "id": "gpt-5",          "provider": "github-copilot" },
    { "id": "llama3:8b",      "provider": "openai-compat", "baseURL": "http://localhost:11434/v1" }
  ],
  "currentModel": "deepseek-chat",
  "auto": { "blacklist": ["rm -rf", "sudo", "curl|sh", "wget|sh", "dd ", "mkfs"] }
}
```

## 4. 关键设计

### 4.1 Provider 选择
- 若 `config.provider` 存在 → 通过 `SessionConfig.provider`（BYOK）传入
- 否则 → `CopilotClient({ useLoggedInUser: true })`，model 默认 `gpt-5`
- 启动时探测：未登录 + 无 key → 引导用户运行 `hihi config set-provider` 或 `gh auth login`

### 4.2 MCP 加载
- 读 `mcp.json`（兼容 Claude Desktop schema：`{ mcpServers: { name: { command, args, env } } }`）
- 对每个 server：用 `@modelcontextprotocol/sdk` 的 stdio client 连接 → 列出工具 → 转换为 SDK `Tool[]` 注入 `createSession({ tools })`
- `handler` 中调用对应 MCP client 执行
- Web UI 提供 servers 列表的增删改查 + 启用/禁用开关

### 4.3 Skill 加载
- 扫描 `~/.hihi-agent/skills/*/SKILL.md`（frontmatter: name, description, allowed-tools）
- 拼入 `SessionConfig.systemMessage`（追加模式）
- **默认远程源 = SkillHub** (`https://www.skillhub.cn`)
  - 在 `packages/core/skills/sources/skillhub.ts` 中封装 `search(keyword)` / `fetch(id)` 接口（HTTP client，端点占位待官方 API 文档补全）
  - 通过 `~/.hihi-agent/config.json` 的 `skillSource` 字段可切换默认源
- **备用源 = awesome-copilot**（GitHub 仓库白名单，`git clone --depth 1` 到 cache）
- CLI：`hihi skill search <关键词>` 默认查 SkillHub；`hihi skill add <id>` 默认从 SkillHub 安装；`--source awesome-copilot` 切换
- Web UI 提供：搜索框（SkillHub）→ 结果卡片 → 一键安装；本地已装 skill 列表与启用/卸载

### 4.4 权限策略
- `ask`：`onPermissionRequest = denyAll`（拦截所有工具调用，仅 LLM 文本回复）
- `auto`：自定义 handler：
  - 命中黑名单子串 → CLI 提示 y/N 二次确认；Web → 弹 shadcn Dialog
  - 否则 `approveAll`

### 4.5 Web 流式
- `POST /api/chat`：body `{ sessionId?, prompt, mode }` → 返回 SSE
- 服务端订阅 `session.on("assistant.message" | "tool.call" | "session.idle")` → 转 SSE event
- 前端 `EventSource` 渲染 markdown（react-markdown + shiki）

### 4.6 会话历史
- 复用 SDK `client.listSessions()` / `resumeSession()`
- CLI：`hihi session list/resume/rm`
- Web：侧边栏列表，点击恢复
- 恢复会话默认沿用原 model；可通过 `/model` 命令或 Web 顶部下拉切换，切换后写入会话元数据

### 4.7 模型切换（新增）
- **模型注册表**：`config.json` 的 `models[]`，每项含 `id / provider / baseURL / apiKey / extraHeaders`
- **当前模型**：`currentModel` 字段；`createAgentClient` 启动时按它选择 provider
- **CLI 切换**：
  - 非交互：`hihi config use-model <id>`、`hihi ask --model <id> "..."`
  - 交互式 REPL 内：`/model`（列出 + 方向键选择，回车确认）、`/model <id>`（直接切换）
  - 切换在下一轮提问生效（不打断当前流）
- **Web 切换**：聊天页顶部 `<ModelPicker>`（shadcn Select），从 `/api/models` 拉列表；切换通过 `PATCH /api/sessions/:id { model }` 持久化到当前会话
- **模型管理 UI**：设置页"模型"Tab，增删改测（"测试连接" → 调用 `/v1/models` 或一次最小 chat 请求验证可用性）
- **GitHub Copilot 模型**：通过 SDK `client.listModels()` 动态拉取并合并到下拉

### 4.8 统一日志（新增）
- **库**：`pino`（高性能、结构化 JSON）+ `pino-pretty`（开发态彩色输出）
- **封装**：`packages/core/logger.ts` 暴露 `createLogger(scope)`，所有模块通过 `const log = createLogger('mcp')` 获取带 scope 的子 logger
- **级别**：`trace | debug | info | warn | error | fatal`
  - 默认 `info`；`--verbose` / `-v` → `debug`；`-vv` → `trace`
  - 环境变量 `HIHI_LOG_LEVEL` 覆盖
- **输出目标**：
  - CLI 交互态：stderr + pino-pretty（不污染 stdout 的 LLM 输出/管道使用）
  - CLI 非交互态 / Web：写文件 `~/.hihi-agent/logs/hihi-YYYY-MM-DD.log`（按天滚动，保留 7 天，用 `pino-roll`）
  - Web 服务端日志同时进文件 + stdout
- **结构字段**：`{ time, level, scope, sessionId?, runId?, model?, msg, err? }`
- **关键埋点**：
  - provider 选择 / 模型切换
  - MCP 子进程 spawn / exit / stderr
  - 工具调用开始/结束（含耗时 & 是否被权限拦截）
  - LLM 请求耗时、token 用量、错误与重试
  - 信号处理与 shutdown 步骤
- **敏感信息脱敏**：pino `redact` 配置 `['*.apiKey', '*.authorization', 'config.models[*].apiKey']`
- **前端**：浏览器侧用轻量 wrapper（`debug` 包或自实现），按 `localStorage.hihiLog` 开关；错误通过 `/api/log` 上报到服务端 pino
- **CLI 子命令**：`hihi logs tail [-n 200]`、`hihi logs path`

### 4.9 CLI 退出与中断（新增）
- **交互式 REPL 退出方式**：
  - `/exit` 或 `/quit` 命令
  - `Ctrl+D`（EOF）
  - 连按两次 `Ctrl+C`（首次中断当前请求并提示"再按一次退出"，1.5s 内再次触发则退出）
- **中断当前请求**：REPL 内单次 `Ctrl+C` 调用 `AbortController.abort()`，取消 LLM 流与正在执行的工具
- **优雅关闭流程**（无论交互/非交互）：
  1. abort 进行中的 session
  2. 关闭所有 MCP 子进程（`client.close()` + `child.kill('SIGTERM')`，2s 后 `SIGKILL` 兜底）
  3. flush 会话历史到磁盘
  4. process.exit(0)
- **信号处理**：监听 `SIGINT` / `SIGTERM` / `beforeExit`，统一走上述清理钩子；防止重复触发（`isShuttingDown` 标志）
- **Web 端对应**：聊天框右侧"停止"按钮调用 `DELETE /api/chat/:runId` → 服务端 abort 对应 session

## 5. CLI 命令一览

> 默认行为：`hihi`（无子命令）直接进入交互式 REPL，初始模式为 `ask`，**REPL 内按 `Tab` 在 `ask` / `auto` 之间切换**（提示符前缀实时变化：`ask ❯` / `auto ❯`）。同时保留 `ask` / `auto` 显式子命令用于脚本/管道场景。

```
hihi                                 # 进入 REPL（默认 ask，Tab 切换 auto）
hihi --mode auto                     # 进入 REPL 初始为 auto
hihi --model <id>                    # 进入 REPL 并指定模型
hihi ask "问题"                      # 单轮非交互问答 (denyAll)
hihi ask --model <id> "问题"         # 本次指定模型
hihi auto "帮我把 dist 清理掉"       # 单轮非交互执行（黑名单二次确认）
hihi web [--port 3000]               # 启动 Next.js
hihi config set-provider             # 交互式向导
hihi config use-model <id>           # 切换默认模型
hihi config list-models              # 列出已配置模型
hihi mcp add|list|rm|enable|disable
hihi skill add|list|rm|enable|disable
hihi session list|resume <id>|rm <id>
hihi logs tail [-n 200]              # 查看最新日志
hihi logs path                       # 打印日志文件路径
hihi --verbose / -v / -vv            # 全局日志级别覆盖
```

### REPL 内置斜杠命令
```
/help            显示帮助
/mode [ask|auto] 显示或切换模式（也可直接按 Tab）
/model [id]      列出或切换模型
/session         显示当前会话 id
/clear           清屏（不清历史）
/reset           开新会话
/exit | /quit    退出（等价 Ctrl+D / 双击 Ctrl+C）
```

### REPL 键位

| 按键             | 行为                                |
| ---------------- | ----------------------------------- |
| `Tab`            | ask ⇄ auto 模式切换                 |
| `Enter`          | 发送                                |
| `Shift+Enter`    | 换行（如终端支持）                  |
| `Ctrl+C` (单击)  | 中断当前请求                        |
| `Ctrl+C` (双击)  | 退出                                |
| `Ctrl+D`         | 退出                                |
| `↑` / `↓`        | 输入历史（用 `readline` 内置历史）  |

> 命令前缀统一为 `hihi`（修正旧版 `wyze`）。

## 6. 技术选型

- 运行时：Node.js ≥ 20，TypeScript 5.4+
- 包管理：pnpm workspace
- CLI：commander + chalk + prompts + ora（如需 TUI 可后期加 ink）
- Web：Next.js 14 App Router、shadcn/ui、Tailwind、react-markdown、shiki、lucide-icons、zustand（会话状态）
- MCP：`@modelcontextprotocol/sdk`
- 质量：eslint + prettier + vitest（core 单测）

## 7. 里程碑（todos）

1. scaffold-workspace — 初始化 pnpm workspace、tsconfig、lint 配置
2. core-config — `~/.hihi-agent` 配置读写 + schema 校验 (zod) + 多模型注册表
3. core-provider — Provider 选择 + 按 modelId 动态构造 + Copilot 登录态回退
4. core-permission — ask/auto 权限策略 + 黑名单
5. core-session — 封装 createSession/resumeSession + 事件聚合 + AbortController
6. core-mcp — MCP 加载器 + 工具桥接 + 子进程生命周期
7. core-skills — 本地加载器 + SkillHub + awesome-copilot + 源切换
8. core-shutdown — 统一 shutdown hook（信号处理、清理 MCP、flush 会话）
9. core-logger — pino 封装、scope、级别、文件滚动、redact、`hihi logs` 子命令
9. cli-base — commander 入口 + ask/auto + REPL + 斜杠命令（含 /model /exit）
10. cli-mgmt — config/mcp/skill/session 子命令（含 use-model / list-models）
11. cli-stream — token 流式输出 + 双击 Ctrl+C 退出 + 单击中断
12. web-scaffold — Next.js + shadcn 初始化
13. web-chat — 对话页 + SSE + markdown + 停止按钮
14. web-model-picker — 顶部模型下拉 + /api/models + 会话级模型持久化
15. web-settings — Provider / 模型管理 / MCP / Skill 配置 UI（含"测试连接"）
16. web-sessions — 会话侧边栏
17. integration — `hihi web` 启动 next、端到端冒烟
18. docs — README + 快速开始

## 8. 风险与待办

- GitHub Copilot 登录态：用户需安装 `gh` 并 `gh auth login --scopes copilot`；首启动需检测并提示
- MCP 子进程生命周期管理：CLI 退出/Web 重启时正确清理
- auto 黑名单匹配是字符串包含，仅作护栏，不能替代沙箱；README 中明确说明
- 远程 skill 拉取需校验来源；SkillHub 的实际 REST API 待补全（当前为 SPA，需用户提供官方 API 文档或反向得到 XHR 端点后填入 `skillhub.ts`）；awesome-copilot 仅允许仓库白名单
- 自定义指令"必须用 Python"与本需求矛盾，本项目按用户明确要求使用 TypeScript

## 9. 不做（明确范围外）

- 多用户 / OAuth / 团队协作
- 桌面客户端（Electron/Tauri）
- 移动端
- 自建 LLM 推理
