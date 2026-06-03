import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { AppPaths } from '@hihi-agent/shared';

export function getAppPaths(): AppPaths {
  const home = process.env.HIHI_HOME || path.join(os.homedir(), '.hihi-agent');
  const p: AppPaths = {
    home,
    config: path.join(home, 'config.json'),
    mcp: path.join(home, 'mcp.json'),
    skills: path.join(home, 'skills'),
    logs: path.join(home, 'logs'),
    cache: path.join(home, 'cache'),
  };
  for (const dir of [p.home, p.skills, p.logs, p.cache]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return p;
}
