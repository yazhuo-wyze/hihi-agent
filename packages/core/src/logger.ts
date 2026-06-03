import pino, { type Logger } from 'pino';
import path from 'node:path';
import { getAppPaths } from './paths.js';

let rootLogger: Logger | null = null;
const isPackagedBinary = Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg);

export interface LoggerOptions {
  level?: string;
  toFile?: boolean;
  pretty?: boolean;
}

function build(opts: LoggerOptions): Logger {
  const level = (opts.level || process.env.HIHI_LOG_LEVEL || 'info') as pino.Level;
  const redact = {
    paths: [
      '*.apiKey',
      '*.authorization',
      'config.models[*].apiKey',
      'apiKey',
      'authorization',
      'headers.authorization',
    ],
    censor: '[REDACTED]',
  };

  if (isPackagedBinary) {
    const streams: pino.StreamEntry[] = [];
    if (opts.pretty !== false) {
      streams.push({ level, stream: process.stderr });
    }
    if (opts.toFile !== false) {
      const paths = getAppPaths();
      streams.push({
        level: 'trace',
        stream: pino.destination(path.join(paths.logs, 'hihi.log')),
      });
    }
    return pino(
      {
        level,
        redact,
        base: { pid: process.pid },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      streams.length ? pino.multistream(streams) : undefined,
    );
  }

  const targets: pino.TransportTargetOptions[] = [];
  if (opts.pretty !== false) {
    targets.push({
      target: 'pino-pretty',
      level,
      options: { destination: 2, colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
    });
  }
  if (opts.toFile !== false) {
    const paths = getAppPaths();
    targets.push({
      target: 'pino-roll',
      level: 'trace',
      options: {
        file: path.join(paths.logs, 'hihi'),
        frequency: 'daily',
        mkdir: true,
        extension: '.log',
        limit: { count: 7 },
      },
    });
  }

  return pino({
    level,
    redact,
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: targets.length ? { targets } : undefined,
  });
}

function getRoot(): Logger {
  if (!rootLogger) rootLogger = build({ level: 'warn' });
  return rootLogger;
}

export function initLogger(opts: LoggerOptions = {}): Logger {
  rootLogger = build(opts);
  return rootLogger;
}

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

/**
 * 返回一个懒代理 logger：每次调用方法时都从当前 rootLogger 派生 child，
 * 保证模块加载顺序在 initLogger 之前时不会卡死在默认级别。
 */
export function createLogger(scope: string): Logger {
  const proxy: any = {};
  for (const lvl of LEVELS) {
    proxy[lvl] = (...args: any[]) => {
      const child = getRoot().child({ scope });
      (child as any)[lvl](...args);
    };
  }
  proxy.child = (bindings: any) => getRoot().child({ scope, ...bindings });
  return proxy as Logger;
}

export function setLevel(level: string): void {
  if (rootLogger) rootLogger.level = level;
}
