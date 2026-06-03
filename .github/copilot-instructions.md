# Copilot Instructions — hihi-agent

> 详细设计见 `plan.md`；快速上手见 `README.md`。

## 项目本质

基于 **`@github/copilot-sdk`** 构建的 AI agent，提供 **CLI**（默认进入 REPL）与 **Web 控制台**（Next.js）双形态。pnpm workspace，单仓多包，全 TypeScript。

```
packages/shared   # 纯类型 (HihiConfig, ModelEntry, RunMode, ...)
packages/core     # 业务核心：config / logger / provider / permission / session / mcp / skills / shutdown
apps/cli          # commander + readline REPL，bin/hihi.mjs 是入口
apps/web          # Next.js 14 App Router，/api/{chat,models,mcp,skills}
```

## 常用命令

```bash
# 安装 + 构建（packages/core 必须在 cli/web 之前构建，build 脚本已按拓扑顺序）
pnpm install
pnpm build                        # 构建 shared + core + cli
pnpm build:web                    # 单独构建 web（较慢）

# 开发态（免构建）
pnpm --filter @hihi-agent/cli dev               # tsx 直跑 CLI 源码
pnpm --filter @hihi-agent/web dev               # Next.js dev server

# 单包构建 / 类型检查（pnpm filter）
pnpm --filter @hihi-agent/core build
pnpm --filter @hihi-agent/web typecheck

# 测试（vitest，目前只在 core 里）
pnpm --filter @hihi-agent/core test                              # 全量
pnpm --filter @hihi-agent/core exec vitest run path/to/file.ts   # 单文件
pnpm --filter @hihi-agent/core exec vitest -t "用例名"            # 单用例

# 跑 CLI（任选一种）
node apps/cli/bin/hihi.mjs                       # 进 REPL（默认 ask，Tab 切 auto）
node apps/cli/bin/hihi.mjs ask "..."             # 单轮非交互
HIHI_HOME=/tmp/hihi-test node apps/cli/bin/hihi.mjs ...   # 隔离配置目录
node apps/cli/bin/hihi.mjs -vv                   # 提升日志到 trace

# Lint
pnpm lint
```

VS Code 一键调试：`.vscode/launch.json` 已含 4 个配置（REPL / ask / auto / web）+ attach。REPL 必须用 `integratedTerminal`，因为依赖真实 TTY 的 raw mode。

## 架构关键点（跨文件理解）

### 1. 包构建产物与外部依赖

- `packages/core` 的 tsup 配置把 `@github/copilot-sdk` 和 `@modelcontextprotocol/sdk` 标为 external。CLI 因此**必须**在自身 `package.json` 里也声明 `@github/copilot-sdk`，否则运行时 `ERR_MODULE_NOT_FOUND`（已踩过）。
- 修改 `packages/core` 后，依赖它的 `apps/cli` 引用的是 `dist/`，**必须重新 `pnpm --filter @hihi-agent/core build`** 才能看到改动；dev 模式 (`tsx`) 也会读 dist 类型。

### 2. Logger 懒代理（重要！）

`packages/core/src/logger.ts` 的 `createLogger(scope)` 返回的是**懒代理**而非真实 pino child：每次 `.info()/.debug()` 调用时才从当前 `rootLogger` 派生 child。

**原因**：模块加载顺序会让 `const log = createLogger('xxx')` 在 `initLogger()` 之前执行。如果直接缓存 child，后续切级别就无效。**新模块写日志一律走 `createLogger`**，不要直接 `pino()`。

CLI 在 commander `preAction` 钩子里调用 `initLogger()`：交互终端默认级别 `warn`（避免污染 REPL），`-v` → debug，`-vv` → trace，环境变量 `HIHI_LOG_LEVEL` 覆盖。文件日志通道始终 `trace`，落 `~/.hihi-agent/logs/hihi-YYYY-MM-DD.log`（pino-roll，保留 7 天）。

敏感字段 `apiKey / authorization / headers.authorization` 通过 pino `redact` 自动脱敏。

### 3. 会话生命周期

`packages/core/src/session.ts` 的 `startSession()` 是**唯一**入口：
1. `resolveProvider(cfg, override)` → 选模型与 provider
2. `buildClientOptions()` → 给 `new CopilotClient(...)` 用
3. `listLocalSkills()` + `buildSkillsSystemMessage()` → 注入 `systemMessage.append`
4. `getEnabledMcpServers()` → 传 `mcpServers`
5. 权限 handler 由 `createPermissionHandler({ mode, blacklist, confirm })` 生成
6. `onShutdown(end)` 注册清理钩子

**模式切换 / 模型切换** 都是销毁旧 session + 调用 `startSession` 重建（见 `apps/cli/src/chat.ts` 的 `restart()`）。不要尝试在已建 session 上换 model。

### 4. CLI REPL 的 raw mode

`apps/cli/src/chat.ts`：
- 用 Node 原生 `readline` + `emitKeypressEvents(stdin)` + `stdin.setRawMode(true)`
- **Tab 键**通过 keypress 拦截：写 `\r\x1b[2K` 清掉 readline 已回显的 `\t`，再清空 `(rl as any).line`，然后 `restart()` + `rl.prompt(true)`
- 提示符按模式着色：`ask ❯`（青）/ `auto ❯`（黄）
- `Ctrl+C` 双击退出（`SIGINT` 计数器，1.5s 窗口）

### 5. 默认模型

`@github/copilot-sdk` v1 的 Copilot 登录态可用模型包括 `auto`、`gpt-5.5`、`claude-sonnet-4.6` 等（用 `client.listModels()` 验证），**不存在 `gpt-5`**。`resolveProvider` 默认回退到 `"auto"`。

### 6. 配置目录

`~/.hihi-agent/` 由 `getAppPaths()` 懒建（权限 0700）：
```
config.json   # HihiConfig（chmod 600，schema 在 packages/core/src/config.ts 的 zod）
mcp.json      # 兼容 Claude Desktop 格式：{ mcpServers: { name: { command, args, env, disabled? } } }
skills/<id>/SKILL.md   # 本地 skill，frontmatter: name/description/allowed-tools；同目录 `.disabled` 文件 = 禁用
logs/         # 按天滚动
cache/        # awesome-copilot clone 等
```

可用 `HIHI_HOME` 重定向（测试时强烈推荐）。

### 7. Skill 远程源

`packages/core/src/skills/sources/` 下两份实现：
- `skillhub.ts` — 默认源，**端点占位**（SkillHub 是 SPA，官方 REST 待补）；失败应回退提示用户加 `--source awesome-copilot`
- `awesome-copilot.ts` — `git clone --depth 1` 到 `cache/`，从 `skills/<id>/SKILL.md` 读取

`HIHI_SKILLHUB_BASE` 环境变量可覆盖 base URL（便于本地 mock）。

### 8. Web SSE

`apps/web/app/api/chat/route.ts` 用 `ReadableStream` 推 SSE，事件 `{ type, data }`，types：`message | tool | error | done`。客户端 (`app/page.tsx`) 用 `AbortController` 实现"停止"按钮（`fetch(..., { signal })`）。

修改 web 与 core 的交互时，确认 `next.config.mjs` 的 `transpilePackages` 与 `serverComponentsExternalPackages` 都正确（pino / pino-pretty / pino-roll / @github/copilot-sdk 全部要在 external 列表里，否则 Next.js 打包会出错）。

## 代码约定

- **ESM only**：包 `"type": "module"`，本地相对导入**必须带 `.js` 后缀**（TS 源里也写 `.js`），这是 NodeNext / Bundler resolution 的要求。
- **不要在 `packages/core` 里 `console.*`**：统一用 `createLogger(scope).{debug,info,warn,error}`，scope 用 kebab-case (`mcp`、`skills:skillhub`)。
- **commander 子命令注册**：每个文件导出 `registerXxx(program: Command)`，在 `apps/cli/src/index.ts` 集中调用。
- **新模块（CLI 子命令、core 模块）**写完后必须 `pnpm --filter <pkg> build` 验证；CLI 不跑 typecheck，类型错误只在 tsup 的 dts 阶段暴露（如果有 `dts: true`）。
- **绝不 commit `~/.hihi-agent/`**：不在仓库内，但若新增 fixture，注意路径隔离。
- **中文交互**：用户面向的文案（CLI 提示、错误、help、日志 msg）保持中文；代码注释按需。

## 当前已知未实现

`plan.md` §7 标记 `blocked` 的：`web-settings`（模型/MCP/Skill 管理 UI 表单）、`web-sessions`（会话侧边栏）、`integration`（端到端冒烟）。新功能落地优先补这些。

## 别做

- 不要把 `@github/copilot-sdk` 改成同步 import 进 web 的 Edge runtime —— 它必须 `runtime = 'nodejs'`。
- 不要在 REPL 路径上 `await new Promise(() => {})` 之外加任何阻塞，要靠 readline 事件循环保活。
- 不要把 `pino` 的 transport `level` 设成跟根一样，文件通道应始终 `trace`（已踩过：会丢日志）。
