import { createLogger } from '../../logger.js';

const log = createLogger('skills:skillhub');

const BASE = process.env.HIHI_SKILLHUB_BASE || 'https://www.skillhub.cn';

export interface SkillHubItem {
  id: string;
  name: string;
  description: string;
  downloadUrl?: string;
}

/**
 * 注意：SkillHub 当前为 SPA，官方 REST 端点待补全。
 * 此处实现采用占位策略：先尝试 /api/skills?q=，失败则回退 awesome-copilot。
 */
export async function search(keyword: string): Promise<SkillHubItem[]> {
  const url = `${BASE}/api/skills?q=${encodeURIComponent(keyword)}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    return (data.items || data.skills || []) as SkillHubItem[];
  } catch (err) {
    log.warn({ err: String(err) }, 'SkillHub API 不可用，请使用 awesome-copilot 备用源');
    return [];
  }
}

export async function fetchSkill(id: string): Promise<string | null> {
  const url = `${BASE}/api/skills/${encodeURIComponent(id)}/download`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    log.warn({ err: String(err), id }, 'SkillHub 下载失败');
    return null;
  }
}
