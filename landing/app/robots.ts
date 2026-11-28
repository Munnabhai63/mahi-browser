import type { MetadataRoute } from 'next';
import { BRAND } from '../lib/brand';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = BRAND.website;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/download/setup', '/download/portable'],
      },
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Amazonbot'],
        allow: ['/', '/docs/', '/blog/', '/compare/'],
        disallow: ['/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
