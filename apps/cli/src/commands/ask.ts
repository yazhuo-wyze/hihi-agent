import type { Command } from 'commander';
import { runChat } from '../chat.js';

export function registerAsk(program: Command): void {
  program
    .command('ask <prompt...>')
    .description('单轮非交互问答（不允许工具调用）。交互模式请直接运行 hihi')
    .option('--model <id>', '本次使用的模型 id')
    .action(async (parts: string[], opts: { model?: string }) => {
      await runChat({
        mode: 'ask',
        prompt: parts.join(' '),
        interactive: false,
        modelOverride: opts.model,
      });
    });
}

