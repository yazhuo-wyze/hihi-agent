import { CopilotClient } from '@github/copilot-sdk';
import type { HihiConfig, RunMode } from '@hihi-agent/shared';
import { resolveProvider, buildClientOptions } from './provider.js';
import { createPermissionHandler, type ConfirmFn } from './permission.js';
import { listLocalSkills, buildSkillsSystemMessage } from './skills/index.js';
import { getEnabledMcpServers } from './mcp.js';
import { onShutdown } from './shutdown.js';
import { createLogger } from './logger.js';

const log = createLogger('session');

export interface RunOptions {
  config: HihiConfig;
  mode: RunMode;
  modelOverride?: string;
  confirm: ConfirmFn;
  resumeSessionId?: string;
}

export interface RunningSession {
  client: CopilotClient;
  session: any;
  modelId: string;
  abort: AbortController;
  end: () => Promise<void>;
}

export async function startSession(opts: RunOptions): Promise<RunningSession> {
  const resolved = resolveProvider(opts.config, opts.modelOverride);
  log.info({ modelId: resolved.modelId, source: resolved.source }, '启动会话');

  const clientOpts: any = buildClientOptions(resolved);
  const client = new CopilotClient(clientOpts);

  const skills = listLocalSkills();
  const systemMessage = buildSkillsSystemMessage(skills);

  const perm = createPermissionHandler({
    mode: opts.mode,
    blacklist: opts.config.auto.blacklist,
    confirm: opts.confirm,
  });

  const mcpServers = getEnabledMcpServers();

  const sessionConfig: any = {
    model: resolved.modelId,
    onPermissionRequest: perm,
    systemMessage: systemMessage ? { append: systemMessage } : undefined,
    mcpServers: Object.keys(mcpServers).length ? mcpServers : undefined,
  };

  const session =
    opts.resumeSessionId != null
      ? await client.resumeSession(opts.resumeSessionId, sessionConfig)
      : await client.createSession(sessionConfig);

  const abort = new AbortController();
  const end = async () => {
    try {
      await session.disconnect();
    } catch (err) {
      log.debug({ err }, 'session.disconnect 出错');
    }
    try {
      await client.stop();
    } catch (err) {
      log.debug({ err }, 'client.stop 出错');
    }
  };

  onShutdown(end);

  return { client, session, modelId: resolved.modelId, abort, end };
}
