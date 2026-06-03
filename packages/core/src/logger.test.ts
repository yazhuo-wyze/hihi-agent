import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalPkg = (process as NodeJS.Process & { pkg?: unknown }).pkg;
const originalHome = process.env.HIHI_HOME;
let tempHome: string | null = null;

afterEach(() => {
  if (originalPkg === undefined) delete (process as NodeJS.Process & { pkg?: unknown }).pkg;
  else (process as NodeJS.Process & { pkg?: unknown }).pkg = originalPkg;

  if (originalHome === undefined) delete process.env.HIHI_HOME;
  else process.env.HIHI_HOME = originalHome;

  if (tempHome) fs.rmSync(tempHome, { recursive: true, force: true });
  tempHome = null;
  vi.resetModules();
});

describe('logger in pkg binaries', () => {
  it('initializes without transport resolution errors', async () => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hihi-logger-'));
    process.env.HIHI_HOME = tempHome;
    (process as NodeJS.Process & { pkg?: unknown }).pkg = {};

    vi.resetModules();
    const { initLogger, createLogger } = await import('./logger.js');

    expect(() => initLogger({ pretty: false, toFile: true, level: 'info' })).not.toThrow();
    expect(() => createLogger('test').info('pkg logger works')).not.toThrow();
  });
});
