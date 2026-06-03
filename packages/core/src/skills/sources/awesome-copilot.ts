import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getAppPaths } from '../../paths.js';
import { createLogger } from '../../logger.js';

const log = createLogger('skills:awesome-copilot');

const REPO = 'https://github.com/github/awesome-copilot.git';

export async function clone(): Promise<string> {
  const p = getAppPaths();
  const dest = path.join(p.cache, 'awesome-copilot');
  if (fs.existsSync(dest)) return dest;
  log.info({ dest }, 'clone awesome-copilot');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('git', ['clone', '--depth', '1', REPO, dest], { stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`git exit ${code}`))));
  });
  return dest;
}

export async function search(keyword: string): Promise<{ id: string; path: string; description: string }[]> {
  const dir = await clone();
  const skillsDir = path.join(dir, 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  const out: { id: string; path: string; description: string }[] = [];
  for (const id of fs.readdirSync(skillsDir)) {
    if (!keyword || id.toLowerCase().includes(keyword.toLowerCase())) {
      const skillFile = path.join(skillsDir, id, 'SKILL.md');
      const description = fs.existsSync(skillFile)
        ? fs.readFileSync(skillFile, 'utf8').slice(0, 200)
        : '';
      out.push({ id, path: path.join(skillsDir, id), description });
    }
  }
  return out;
}

export async function install(id: string): Promise<string> {
  const p = getAppPaths();
  const dir = await clone();
  const src = path.join(dir, 'skills', id);
  if (!fs.existsSync(src)) throw new Error(`skill ${id} 未找到`);
  const dest = path.join(p.skills, id);
  fs.cpSync(src, dest, { recursive: true });
  log.info({ id, dest }, '已安装 skill');
  return dest;
}
