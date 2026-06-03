import fs from 'node:fs';
import { z } from 'zod';
import type { HihiConfig } from '@hihi-agent/shared';
import { getAppPaths } from './paths.js';
import { createLogger } from './logger.js';

const log = createLogger('config');

const ModelSchema = z.object({
  id: z.string(),
  provider: z.enum(['openai-compat', 'openai', 'github-copilot']),
  baseURL: z.string().optional(),
  apiKey: z.string().optional(),
  extraHeaders: z.record(z.string()).optional(),
  label: z.string().optional(),
});

const ConfigSchema = z.object({
  currentModel: z.string().optional(),
  models: z.array(ModelSchema).default([]),
  fallback: z.literal('github-copilot').optional(),
  auto: z
    .object({
      blacklist: z.array(z.string()).default(['rm -rf', 'sudo', 'curl|sh', 'wget|sh', 'dd ', 'mkfs']),
    })
    .default({ blacklist: ['rm -rf', 'sudo', 'curl|sh', 'wget|sh', 'dd ', 'mkfs'] }),
  skillSource: z.enum(['skillhub', 'awesome-copilot']).default('skillhub'),
  web: z.object({ port: z.number().optional(), token: z.string().optional() }).optional(),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).optional(),
});

export const DEFAULT_CONFIG: HihiConfig = {
  models: [],
  fallback: 'github-copilot',
  auto: { blacklist: ['rm -rf', 'sudo', 'curl|sh', 'wget|sh', 'dd ', 'mkfs'] },
  skillSource: 'skillhub',
};

export function loadConfig(): HihiConfig {
  const p = getAppPaths();
  if (!fs.existsSync(p.config)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p.config, 'utf8'));
    return ConfigSchema.parse(raw) as HihiConfig;
  } catch (err) {
    log.error({ err }, 'config 解析失败，使用默认值');
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(cfg: HihiConfig): void {
  const p = getAppPaths();
  fs.writeFileSync(p.config, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(p.config, 0o600);
  } catch {
    /* ignore */
  }
}

export function updateConfig(mutator: (c: HihiConfig) => void): HihiConfig {
  const cfg = loadConfig();
  mutator(cfg);
  saveConfig(cfg);
  return cfg;
}
