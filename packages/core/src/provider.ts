import type { HihiConfig, ModelEntry } from '@hihi-agent/shared';
import { createLogger } from './logger.js';

const log = createLogger('provider');

export interface ResolvedProvider {
  modelId: string;
  source: 'byok' | 'github-copilot';
  model?: ModelEntry;
}

export function resolveProvider(cfg: HihiConfig, override?: string): ResolvedProvider {
  const wantId = override || cfg.currentModel;
  if (wantId) {
    const model = cfg.models.find((m) => m.id === wantId);
    if (model) {
      log.debug({ modelId: model.id, provider: model.provider }, '使用配置中的模型');
      if (model.provider === 'github-copilot') {
        return { modelId: model.id, source: 'github-copilot', model };
      }
      return { modelId: model.id, source: 'byok', model };
    }
    log.warn({ wantId }, '找不到指定模型，回退到默认');
  }
  if (cfg.models.length > 0) {
    const first = cfg.models[0];
    return {
      modelId: first.id,
      source: first.provider === 'github-copilot' ? 'github-copilot' : 'byok',
      model: first,
    };
  }
  log.info('未配置模型，回退到 GitHub Copilot 登录态');
  return { modelId: 'auto', source: 'github-copilot' };
}

export function buildClientOptions(p: ResolvedProvider): Record<string, any> {
  if (p.source === 'github-copilot') {
    return { useLoggedInUser: true };
  }
  const m = p.model!;
  return {
    provider: {
      type: m.provider === 'openai' ? 'openai' : 'openai-compatible',
      baseURL: m.baseURL,
      apiKey: m.apiKey,
      headers: m.extraHeaders,
    },
  };
}
