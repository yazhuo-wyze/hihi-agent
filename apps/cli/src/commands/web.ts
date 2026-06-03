import type { Command } from 'commander';
import { spawn } from 'node:child_process';
import path from 'node:path';

function resolveModuleDir(): string {
  // ESM: import.meta.url；CJS / pkg 二进制：__dirname
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && (import.meta as any).url) {
      // 动态 require fileURLToPath 以避免 CJS bundle 报错
      const { fileURLToPath } = require('node:url');
      // @ts-ignore
      return path.dirname(fileURLToPath((import.meta as any).url));
    }
  } catch {
    /* fall through */
  }
  // @ts-ignore
  return typeof __dirname === 'string' ? __dirname : process.cwd();
}

export function registerWeb(program: Command): void {
  program
    .command('web')
    .description('启动 Web 控制台 (Next.js，需源码环境，不适用于打包后的单文件二进制)')
    .option('--port <port>', '端口', '3000')
    .action((opts: { port: string }) => {
      const webDir = path.resolve(resolveModuleDir(), '../../../web');
      const child = spawn('pnpm', ['dev', '--port', opts.port], {
        cwd: webDir,
        stdio: 'inherit',
        env: { ...process.env, PORT: opts.port },
      });
      child.on('exit', (code) => process.exit(code ?? 0));
    });
}

