import fs from 'node:fs';
import { getAppPaths } from './paths.js';
import { createLogger } from './logger.js';

const log = createLogger('mcp');

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface McpFile {
  mcpServers: Record<string, McpServerConfig>;
}

export function loadMcpConfig(): McpFile {
  const p = getAppPaths();
  if (!fs.existsSync(p.mcp)) return { mcpServers: {} };
  try {
    return JSON.parse(fs.readFileSync(p.mcp, 'utf8'));
  } catch (err) {
    log.error({ err }, 'mcp.json 解析失败');
    return { mcpServers: {} };
  }
}

export function saveMcpConfig(file: McpFile): void {
  const p = getAppPaths();
  fs.writeFileSync(p.mcp, JSON.stringify(file, null, 2), { mode: 0o600 });
}

export function updateMcp(mutator: (f: McpFile) => void): McpFile {
  const file = loadMcpConfig();
  mutator(file);
  saveMcpConfig(file);
  return file;
}

/**
 * 将 mcp.json 中启用的 server 转换成 SDK SessionConfig.mcpServers 形态
 * （SDK 直接支持 MCPStdioServerConfig）
 */
export function getEnabledMcpServers(): Record<string, McpServerConfig> {
  const file = loadMcpConfig();
  const out: Record<string, McpServerConfig> = {};
  for (const [name, srv] of Object.entries(file.mcpServers)) {
    if (!srv.disabled) out[name] = srv;
  }
  return out;
}
