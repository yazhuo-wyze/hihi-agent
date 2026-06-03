import type { Command } from 'commander';
import chalk from 'chalk';
import { loadMcpConfig, updateMcp } from '@hihi-agent/core';

export function registerMcp(program: Command): void {
  const m = program.command('mcp').description('MCP 服务器管理');

  m.command('list').description('列出').action(() => {
    const f = loadMcpConfig();
    for (const [name, s] of Object.entries(f.mcpServers)) {
      console.log(`${s.disabled ? ' ' : chalk.green('*')} ${name}\t${s.command} ${(s.args || []).join(' ')}`);
    }
  });

  m.command('add <name> <command> [args...]')
    .description('添加 stdio MCP server')
    .action((name: string, command: string, args: string[]) => {
      updateMcp((f) => {
        f.mcpServers[name] = { command, args };
      });
      console.log(chalk.green(`已添加 ${name}`));
    });

  m.command('rm <name>').description('删除').action((name: string) => {
    updateMcp((f) => {
      delete f.mcpServers[name];
    });
    console.log(chalk.gray(`已删除 ${name}`));
  });

  m.command('enable <name>').action((name: string) => {
    updateMcp((f) => {
      if (f.mcpServers[name]) f.mcpServers[name].disabled = false;
    });
  });

  m.command('disable <name>').action((name: string) => {
    updateMcp((f) => {
      if (f.mcpServers[name]) f.mcpServers[name].disabled = true;
    });
  });
}
