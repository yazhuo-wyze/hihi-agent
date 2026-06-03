import type { Command } from 'commander';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function registerWeb(program: Command): void {
  program
    .command('web')
    .description('启动 Web 控制台 (Next.js)')
    .option('--port <port>', '端口', '3000')
    .action((opts: { port: string }) => {
      const webDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../web',
      );
      const child = spawn('pnpm', ['dev', '--port', opts.port], {
        cwd: webDir,
        stdio: 'inherit',
        env: { ...process.env, PORT: opts.port },
      });
      child.on('exit', (code) => process.exit(code ?? 0));
    });
}
