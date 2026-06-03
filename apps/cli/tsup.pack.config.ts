import { defineConfig } from 'tsup';

/**
 * 打包专用：把整个 CLI（含所有 workspace + npm 依赖）打成单文件 CJS，
 * 供 @yao-pkg/pkg 编译成跨平台二进制。
 *
 * 排除项：
 * - pino-pretty / pino-roll / thread-stream / sonic-boom 由 pino 通过 worker_thread 动态加载，
 *   不能 bundle 进主 bundle，必须以 node_modules 形式作为 pkg assets 一起打包。
 */
export default defineConfig({
  entry: { index: 'src/index.ts' },
  outDir: 'pack',
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  bundle: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  clean: true,
  noExternal: [/.*/],
  external: ['pino-pretty', 'pino-roll', 'thread-stream', 'sonic-boom'],
  banner: { js: '#!/usr/bin/env node' },
});
