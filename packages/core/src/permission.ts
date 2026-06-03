import type { RunMode } from '@hihi-agent/shared';
import { createLogger } from './logger.js';

const log = createLogger('permission');

export type ConfirmFn = (question: string) => Promise<boolean>;

export interface PermissionHandlerOptions {
  mode: RunMode;
  blacklist: string[];
  confirm: ConfirmFn;
}

function matchesBlacklist(text: string, blacklist: string[]): string | null {
  const lower = text.toLowerCase();
  for (const pat of blacklist) {
    if (lower.includes(pat.toLowerCase())) return pat;
  }
  return null;
}

export function createPermissionHandler(opts: PermissionHandlerOptions) {
  return async (req: any) => {
    if (opts.mode === 'ask') {
      log.debug({ tool: req?.tool?.name }, 'ask 模式，拒绝工具调用');
      return { decision: 'deny', reason: 'ask 模式不允许工具调用' };
    }
    const cmd =
      req?.input?.command || req?.input?.cmd || JSON.stringify(req?.input ?? {});
    const hit = matchesBlacklist(String(cmd), opts.blacklist);
    if (hit) {
      log.warn({ hit, cmd }, '命中黑名单，需要用户确认');
      const ok = await opts.confirm(`命中危险模式 "${hit}"，是否允许执行？\n${cmd}`);
      return ok ? { decision: 'allow' } : { decision: 'deny', reason: '用户拒绝' };
    }
    return { decision: 'allow' };
  };
}
