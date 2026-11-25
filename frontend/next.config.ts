import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Loads src/i18n/request.ts for next-intl.
const withNextIntl = createNextIntlPlugin();
const backendOrigin = process.env.BACKEND_API_ORIGIN;

const nextConfig: NextConfig = {
  // No AI agent files in the repository. See AGENTS.md at the repository root.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return backendOrigin
      ? [{ source: '/api/v1/:path*', destination: `${backendOrigin}/api/v1/:path*` }]
      : [];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default withNextIntl(nextConfig);
