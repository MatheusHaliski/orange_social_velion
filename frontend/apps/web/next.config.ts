import path from 'node:path';
import type { NextConfig } from 'next';

// O navegador fala só com a origem do Next; /api/* é repassado ao backend Spring. Assim o cookie de sessão
// (orange_session no perfil dev, __Host-orange_session em produção) e o XSRF-TOKEN ficam na mesma origem.
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:8080';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // pacotes do workspace publicados como TypeScript
  transpilePackages: ['@orange-social/api', '@orange-social/tokens'],
  // raiz do workspace npm (frontend/), onde fica o package-lock.json
  turbopack: { root: path.resolve(process.cwd(), '../..') },
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
