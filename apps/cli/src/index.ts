import { Command } from 'commander';
import {
  initLogger,
  createLogger,
  installSignalHandlers,
  runShutdown,
} from '@hihi-agent/core';
import { registerAsk } from './commands/ask.js';
import { registerAuto } from './commands/auto.js';
import { registerConfig } from './commands/config.js';
import { registerMcp } from './commands/mcp.js';
import { registerSkill } from './commands/skill.js';
import { registerSession } from './commands/session.js';
import { registerLogs } from './commands/logs.js';
import { registerWeb } from './commands/web.js';
import { runChat } from './chat.js';
import type { RunMode } from '@hihi-agent/shared';

const program = new Command();

program
  .name('hihi')
  .description(
    'hihi-agent —— 基于 GitHub Copilot SDK 的 AI agent\n直接运行 `hihi` 进入交互模式，REPL 内按 Tab 在 ask/auto 间切换',
  )
  .version('0.1.0')
  .option('-v, --verbose', '调高日志级别 (-v=debug, -vv=trace)', (_v, prev: number) => prev + 1, 0)
  .option('--mode <mode>', '默认进入 REPL 的模式 (ask|auto)', 'ask')
  .option('--model <id>', '指定模型 id')
  .hook('preAction', (cmd) => {
    const verbose = (cmd.opts() as any).verbose || 0;
    const interactive = process.stdout.isTTY;
    // 交互式默认仅显示 warn 以上，避免污染界面；-v / -vv 提升
    const level = verbose >= 2 ? 'trace' : verbose >= 1 ? 'debug' : interactive ? 'warn' : 'info';
    initLogger({ pretty: interactive, toFile: true, level });
    installSignalHandlers();
    createLogger('cli').debug({ verbose, level }, 'cli 启动');
  });

registerAsk(program);
registerAuto(program);
registerConfig(program);
registerMcp(program);
registerSkill(program);
registerSession(program);
registerLogs(program);
registerWeb(program);

// 默认动作：无子命令 -> 进入 REPL
program.action(async (opts: { mode?: string; model?: string }) => {
  const mode: RunMode = opts.mode === 'auto' ? 'auto' : 'ask';
  await runChat({
    mode,
    interactive: true,
    modelOverride: opts.model,
  });
});

// Ctrl+C：单击中断，1.5s 内再次按下退出
let ctrlCCount = 0;
let ctrlCTimer: NodeJS.Timeout | null = null;
process.on('SIGINT', () => {
  ctrlCCount++;
  if (ctrlCCount >= 2) {
    void runShutdown(130);
    return;
  }
  process.stderr.write('\n(再按一次 Ctrl+C 退出)\n');
  if (ctrlCTimer) clearTimeout(ctrlCTimer);
  ctrlCTimer = setTimeout(() => {
    ctrlCCount = 0;
  }, 1500);
});

program.parseAsync(process.argv).catch(async (err) => {
  createLogger('cli').error({ err }, '命令执行失败');
  console.error(err?.message || err);
  await runShutdown(1);
});
