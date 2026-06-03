import readline from 'node:readline';
import prompts from 'prompts';
import chalk from 'chalk';
import {
  loadConfig,
  startSession,
  runShutdown,
  type RunningSession,
} from '@hihi-agent/core';
import type { RunMode } from '@hihi-agent/shared';

export interface RunChatOptions {
  mode: RunMode;
  prompt?: string;
  interactive: boolean;
  modelOverride?: string;
}

const confirmFn = async (q: string): Promise<boolean> => {
  const { ok } = await prompts({ type: 'confirm', name: 'ok', message: q, initial: false });
  return Boolean(ok);
};

function modeColor(mode: RunMode): (s: string) => string {
  return mode === 'auto' ? chalk.yellow : chalk.cyan;
}

function makePrompt(mode: RunMode): string {
  return modeColor(mode)(`${mode} ❯ `);
}

export async function runChat(opts: RunChatOptions): Promise<void> {
  const cfg = loadConfig();
  let currentModel = opts.modelOverride;
  let mode: RunMode = opts.mode;

  let running: RunningSession = await startSession({
    config: cfg,
    mode,
    modelOverride: currentModel,
    confirm: confirmFn,
  });

  const restart = async () => {
    await running.end();
    running = await startSession({
      config: loadConfig(),
      mode,
      modelOverride: currentModel,
      confirm: confirmFn,
    });
  };

  const sendAndPrint = async (prompt: string): Promise<void> => {
    let printedHeader = false;
    const off = running.session.on?.((event: any) => {
      if (event.type === 'assistant.message' && event.data?.content) {
        if (!printedHeader) {
          process.stdout.write(chalk.green('\n助手: '));
          printedHeader = true;
        }
        process.stdout.write(String(event.data.content));
      } else if (event.type === 'tool.call') {
        process.stderr.write(chalk.gray(`\n[tool] ${event.data?.name ?? '?'}\n`));
      } else if (event.type === 'error') {
        process.stderr.write(chalk.red(`\n[error] ${JSON.stringify(event.data)}\n`));
      }
    });
    try {
      if (typeof running.session.sendAndWait === 'function') {
        await running.session.sendAndWait({ prompt });
      } else {
        await running.session.send({ prompt });
      }
      process.stdout.write('\n');
    } finally {
      if (typeof off === 'function') off();
    }
  };

  // --------- 非交互单轮 ---------
  if (!opts.interactive && opts.prompt) {
    console.log(chalk.gray(`模型: ${running.modelId}  |  模式: ${mode}`));
    await sendAndPrint(opts.prompt);
    await running.end();
    return;
  }

  // --------- 交互式 REPL ---------
  console.log(chalk.gray(`模型: ${running.modelId}`));
  console.log(
    chalk.gray('Tab 切换 ask/auto  |  斜杠命令: /help /mode /model /session /clear /reset /exit'),
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: makePrompt(mode),
    historySize: 200,
  });

  // 启用 keypress 事件以拦截 Tab
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin, rl);
    process.stdin.setRawMode(true);
  }

  process.stdin.on('keypress', (_str: string | undefined, key: readline.Key) => {
    if (key && key.name === 'tab') {
      // 清整行（包括已被 readline 回显的 \t）
      process.stdout.write('\r\x1b[2K');
      (rl as any).line = ((rl as any).line || '').replace(/\t/g, '');
      (rl as any).cursor = (rl as any).line.length;

      mode = mode === 'ask' ? 'auto' : 'ask';
      restart()
        .then(() => {
          process.stdout.write(chalk.gray(`[模式 -> ${mode}]`) + '\n');
          rl.setPrompt(makePrompt(mode));
          rl.prompt(true);
        })
        .catch((err) => {
          process.stderr.write(chalk.red(`\n切换模式失败: ${err?.message || err}\n`));
          rl.prompt(true);
        });
    }
  });

  rl.setPrompt(makePrompt(mode));
  rl.prompt();

  let busy = false;

  const handleLine = async (line: string): Promise<void> => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }

    if (text === '/exit' || text === '/quit') {
      rl.close();
      await runShutdown(0);
      return;
    }
    if (text === '/help') {
      console.log(`
/help              显示帮助
/mode [ask|auto]   显示或切换模式（也可按 Tab）
/model [id]        列出或切换模型
/session           显示当前会话 id
/clear             清屏
/reset             开新会话
/exit | /quit      退出
`);
      rl.prompt();
      return;
    }
    if (text === '/clear') {
      console.clear();
      rl.prompt();
      return;
    }
    if (text === '/session') {
      console.log('sessionId:', running.session.sessionId);
      rl.prompt();
      return;
    }
    if (text === '/reset') {
      await restart();
      console.log(chalk.gray(`已重置会话 (model=${running.modelId})`));
      rl.prompt();
      return;
    }
    if (text.startsWith('/mode')) {
      const rest = text.slice(5).trim();
      if (!rest) {
        console.log(`当前模式: ${mode}`);
      } else if (rest === 'ask' || rest === 'auto') {
        mode = rest;
        await restart();
        rl.setPrompt(makePrompt(mode));
        console.log(chalk.gray(`已切换模式: ${mode}`));
      } else {
        console.log('用法: /mode [ask|auto]');
      }
      rl.prompt();
      return;
    }
    if (text.startsWith('/model')) {
      const rest = text.slice(6).trim();
      const cfgNow = loadConfig();
      if (!rest) {
        console.log('可用模型:');
        for (const m of cfgNow.models) {
          console.log(`  ${m.id === (currentModel || cfgNow.currentModel) ? '*' : ' '} ${m.id}  (${m.provider})`);
        }
        rl.prompt();
        return;
      }
      currentModel = rest;
      await restart();
      console.log(chalk.gray(`已切换模型: ${running.modelId}`));
      rl.prompt();
      return;
    }

    try {
      await sendAndPrint(text);
    } catch (err: any) {
      console.error(chalk.red(`错误: ${err?.message || err}`));
    }
    rl.prompt();
  };

  rl.on('line', (line) => {
    if (busy) return;
    busy = true;
    handleLine(line)
      .catch((err) => console.error(chalk.red(err?.message || err)))
      .finally(() => {
        busy = false;
      });
  });

  rl.on('close', () => {
    void runShutdown(0);
  });

  // 保持事件循环
  await new Promise<void>(() => undefined);
}
