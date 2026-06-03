import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { getAppPaths } from '@hihi-agent/core';

export function registerLogs(program: Command): void {
  const l = program.command('logs').description('日志');

  l.command('path').action(() => {
    console.log(getAppPaths().logs);
  });

  l.command('tail')
    .option('-n, --lines <n>', '行数', '200')
    .action((opts: { lines: string }) => {
      const dir = getAppPaths().logs;
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith('hihi') && f.endsWith('.log'))
        .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
      if (!files.length) {
        console.log('（无日志）');
        return;
      }
      const fp = path.join(dir, files[0].f);
      const content = fs.readFileSync(fp, 'utf8').split('\n');
      const n = parseInt(opts.lines, 10) || 200;
      console.log(content.slice(-n).join('\n'));
    });
}
