import { createLogger } from './logger.js';

const log = createLogger('shutdown');

type Hook = () => Promise<void> | void;

const hooks: Hook[] = [];
let installed = false;
let isShuttingDown = false;

export function onShutdown(fn: Hook): void {
  hooks.push(fn);
}

export async function runShutdown(code = 0): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log.debug('开始 shutdown');
  for (const h of [...hooks].reverse()) {
    try {
      await Promise.race([
        Promise.resolve(h()),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    } catch (err) {
      log.error({ err }, 'shutdown hook 失败');
    }
  }
  process.exit(code);
}

export function installSignalHandlers(): void {
  if (installed) return;
  installed = true;
  for (const sig of ['SIGTERM', 'SIGHUP'] as const) {
    process.on(sig, () => {
      log.info({ sig }, '收到信号，退出');
      void runShutdown(0);
    });
  }
}
