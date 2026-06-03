export type ProviderType = 'openai-compat' | 'openai' | 'github-copilot';

export interface ModelEntry {
  id: string;
  provider: ProviderType;
  baseURL?: string;
  apiKey?: string;
  extraHeaders?: Record<string, string>;
  label?: string;
}

export interface AutoConfig {
  blacklist: string[];
}

export interface HihiConfig {
  currentModel?: string;
  models: ModelEntry[];
  fallback?: 'github-copilot';
  auto: AutoConfig;
  skillSource?: 'skillhub' | 'awesome-copilot';
  web?: { port?: number; token?: string };
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

export type RunMode = 'ask' | 'auto';

export interface AppPaths {
  home: string;
  config: string;
  mcp: string;
  skills: string;
  logs: string;
  cache: string;
}

export interface ChatEvent {
  type: 'token' | 'message' | 'tool' | 'error' | 'done' | 'permission';
  data: any;
}
