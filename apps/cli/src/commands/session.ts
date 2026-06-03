import type { Command } from 'commander';
import { loadConfig, resolveProvider, buildClientOptions } from '@hihi-agent/core';

async function withClient<T>(fn: (c: any) => Promise<T>): Promise<T> {
  const { CopilotClient } = await import('@github/copilot-sdk');
  const cfg = loadConfig();
  const client: any = new CopilotClient(buildClientOptions(resolveProvider(cfg)) as any);
  try {
    return await fn(client);
  } finally {
    try {
      await client.stop();
    } catch {
      /* ignore */
    }
  }
}

export function registerSession(program: Command): void {
  const s = program.command('session').description('会话历史');

  s.command('list').action(async () => {
    await withClient(async (c) => {
      const r = await c.listSessions?.();
      console.log(JSON.stringify(r ?? '(SDK 未提供 listSessions)', null, 2));
    });
  });

  s.command('resume <id>').action(async (_id: string) => {
    console.log('请在交互式 REPL 中使用 /reset 重置；resume 通过 SDK API 在后续版本支持');
  });

  s.command('rm <id>').action(async (id: string) => {
    await withClient(async (c) => {
      await c.deleteSession?.({ sessionId: id });
      console.log('已删除', id);
    });
  });
}
