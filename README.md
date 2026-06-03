# hihi-agent

基于 [@github/copilot-sdk](https://github.com/github/copilot-sdk) 的 AI agent，提供 CLI 和 Web 控制台双形态。

## 特性

- **CLI**：`ask`（仅问答）/ `auto`（自动批准工具，危险命令二次确认）
- **Web**：Next.js + Tailwind，SSE 流式输出，模型下拉切换
- **多模型**：OpenAI 兼容（DeepSeek/Qwen/Ollama）BYOK，未配置时回退 GitHub Copilot 登录态
- **MCP**：Claude Desktop 兼容格式
- **Skill**：本地目录 + SkillHub / awesome-copilot 远程源
- **统一日志**：pino，按天滚动，敏感字段自动脱敏
- **优雅退出**：`/exit` / `Ctrl+D` / 双击 `Ctrl+C`，单击 `Ctrl+C` 中断当前请求

## 快速开始

```bash
pnpm install
pnpm build

# 配置一个模型（也可不配，使用 gh auth login 后的 Copilot 登录态）
node apps/cli/bin/hihi.mjs config set-provider

# 直接进入交互模式（默认 ask，按 Tab 切换 auto）
node apps/cli/bin/hihi.mjs

# 也可指定初始模式 / 模型
node apps/cli/bin/hihi.mjs --mode auto --model deepseek-chat

# 单轮非交互（脚本场景）
node apps/cli/bin/hihi.mjs ask "你好"
node apps/cli/bin/hihi.mjs auto "把 dist 清掉"

# Web 控制台
node apps/cli/bin/hihi.mjs web --port 3000
```

## CLI 命令

```
hihi [--mode ask|auto] [--model <id>]    # 进入 REPL（默认）
hihi ask <prompt> [--model <id>]         # 单轮非交互问答
hihi auto <prompt> [--model <id>]        # 单轮非交互执行
hihi web [--port 3000]                   # 启动 Next.js

hihi config show
hihi config set-provider                 # 交互式添加模型
hihi config list-models
hihi config use-model <id>
hihi config rm-model <id>

hihi mcp add|list|rm|enable|disable
hihi skill add|list|rm|enable|disable|search

hihi session list|rm <id>

hihi logs path
hihi logs tail [-n 200]

-v / -vv                                 # 调高日志级别
```

### REPL 键位与斜杠命令

| 按键              | 行为                            |
| ----------------- | ------------------------------- |
| `Tab`             | ask ⇄ auto                      |
| `Enter`           | 发送                            |
| `Ctrl+C` (单击)   | 中断当前请求                    |
| `Ctrl+C` (双击)   | 退出                            |
| `Ctrl+D`          | 退出                            |
| `↑` / `↓`         | 输入历史                        |

```
/help              帮助
/mode [ask|auto]   显示 / 切换模式
/model [id]        列出 / 切换模型（下一轮生效）
/session           当前会话 id
/clear             清屏
/reset             开新会话
/exit | /quit      退出
```

## 配置目录

```
~/.hihi-agent/
├── config.json   # provider + 多模型注册表 (chmod 600)
├── mcp.json      # MCP servers
├── skills/       # 本地 skill（每个目录含 SKILL.md）
├── logs/         # 按天滚动，保留 7 天
└── cache/        # awesome-copilot clone 等
```

## 安全

- `config.json` 自动 `chmod 600`；日志通过 pino redact 屏蔽 `apiKey/authorization`。
- `auto` 黑名单仅是护栏，不能替代沙箱。Web 端建议绑 `127.0.0.1`。

## 不做

多用户/OAuth、桌面客户端、移动端、自建推理。
