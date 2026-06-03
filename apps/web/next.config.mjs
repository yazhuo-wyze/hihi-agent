/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hihi-agent/core', '@hihi-agent/shared'],
  experimental: { serverComponentsExternalPackages: ['@github/copilot-sdk', 'pino', 'pino-pretty', 'pino-roll'] },
};
export default nextConfig;
