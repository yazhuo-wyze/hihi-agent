import fs from 'node:fs';
import path from 'node:path';
import { getAppPaths } from '../paths.js';
import { createLogger } from '../logger.js';

const log = createLogger('skills');

export interface LocalSkill {
  id: string;
  name: string;
  description: string;
  allowedTools?: string[];
  path: string;
  body: string;
  enabled: boolean;
}

function parseFrontmatter(content: string): {
  meta: Record<string, any>;
  body: string;
} {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: content };
  const meta: Record<string, any> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) meta[kv[1].trim()] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2] };
}

export function listLocalSkills(): LocalSkill[] {
  const p = getAppPaths();
  if (!fs.existsSync(p.skills)) return [];
  const result: LocalSkill[] = [];
  for (const dir of fs.readdirSync(p.skills)) {
    const skillDir = path.join(p.skills, dir);
    const skillFile = path.join(skillDir, 'SKILL.md');
    if (!fs.statSync(skillDir).isDirectory() || !fs.existsSync(skillFile)) continue;
    try {
      const raw = fs.readFileSync(skillFile, 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      const disabledFile = path.join(skillDir, '.disabled');
      result.push({
        id: dir,
        name: meta.name || dir,
        description: meta.description || '',
        allowedTools: meta['allowed-tools']?.split(',').map((s: string) => s.trim()),
        path: skillDir,
        body,
        enabled: !fs.existsSync(disabledFile),
      });
    } catch (err) {
      log.warn({ err, dir }, '加载 skill 失败');
    }
  }
  return result;
}

export function buildSkillsSystemMessage(skills: LocalSkill[]): string {
  const enabled = skills.filter((s) => s.enabled);
  if (!enabled.length) return '';
  const parts = enabled.map(
    (s) => `### Skill: ${s.name}\n${s.description}\n\n${s.body.trim()}`,
  );
  return `# 自定义 Skills\n\n${parts.join('\n\n---\n\n')}`;
}

export function setSkillEnabled(id: string, enabled: boolean): void {
  const p = getAppPaths();
  const skillDir = path.join(p.skills, id);
  if (!fs.existsSync(skillDir)) throw new Error(`skill 不存在: ${id}`);
  const flag = path.join(skillDir, '.disabled');
  if (enabled) {
    if (fs.existsSync(flag)) fs.unlinkSync(flag);
  } else {
    fs.writeFileSync(flag, '');
  }
}

export function removeSkill(id: string): void {
  const p = getAppPaths();
  const skillDir = path.join(p.skills, id);
  if (fs.existsSync(skillDir)) fs.rmSync(skillDir, { recursive: true, force: true });
}
