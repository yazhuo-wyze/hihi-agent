import type { Command } from 'commander';
import { runChat } from '../chat.js';

export function registerAuto(program: Command): void {
  program
    .command('auto <prompt...>')
    .description('单轮非交互执行（危险命令二次确认）。交互模式请用 hihi --mode auto')
    .option('--model <id>', '本次使用的模型 id')
    .action(async (parts: string[], opts: { model?: string }) => {
      await runChat({
        mode: 'auto',
        prompt: parts.join(' '),
        interactive: false,
        modelOverride: opts.model,
      });
    });
}

