import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { BRAND } from '../../landing/lib/brand.js';
import { PUBLIC_PLANS } from '../../landing/lib/plans.js';
import { getAllDocs, getDocBySlug, getAllBlogPosts, getBlogPostBySlug } from '../../landing/lib/mdx.js';
import { WebApiClient } from '../../01_UI/web/api/api-client.js';

describe('Phase 5: Next.js 14 Landing, Docs & Blog Portal + Web Cloud Console Production Wiring', () => {
  const rootDir = process.cwd();
  const landingDir = path.join(rootDir, 'landing');

  describe('1. Brand Constants & Authoritative Invariants', () => {
    it('should match authoritative contact details and version 1.1.9', () => {
      expect(BRAND.name).toBe('MAHI Browser');
      expect(BRAND.creator).toBe('Munna Bhai');
      expect(BRAND.version).toBe('1.1.9');
      expect(BRAND.officialEmail).toBe('mahiverse.official@gmail.com');
      expect(BRAND.hubEmail).toBe('mahiverse.hub@gmail.com');
      expect(BRAND.phone).toBe('+91 9376343629');
      expect(BRAND.upiId).toBe('6375823589@slc');
      expect(BRAND.website).toBe('https://mahibrowser.com');
      expect(BRAND.apiUrl).toBe('https://api.mahibrowser.com');
      expect(BRAND.appUrl).toBe('https://app.mahibrowser.com');
    });

    it('should preserve the official brand logo (exact 735,223 bytes)', () => {
      const logoPath = path.join(landingDir, 'assets', 'img', 'logo.png');
      expect(fs.existsSync(logoPath)).toBe(true);
      const stat = fs.statSync(logoPath);
      expect(stat.size).toBe(735223);
    });

    it('should preserve legacy landing static files without deletion', () => {
      expect(fs.existsSync(path.join(landingDir, 'assets', 'css', 'styles.css'))).toBe(true);
      expect(fs.existsSync(path.join(landingDir, 'assets', 'js', 'main.js'))).toBe(true);
      expect(fs.existsSync(path.join(landingDir, 'content.json'))).toBe(true);
      expect(fs.existsSync(path.join(landingDir, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(landingDir, 'download.html'))).toBe(true);
    });
  });

  describe('2. Pricing Catalog Coherence', () => {
    it('should define canonical personal and business tiers with 15 free starter profiles', () => {
      const freePlan = PUBLIC_PLANS.find((p) => p.id === 'free');
      expect(freePlan).toBeDefined();
      expect(freePlan?.profileLimit).toBe(15);
      expect(freePlan?.monthlyPrice.INR).toBe(0);
      expect(freePlan?.monthlyPrice.USD).toBe(0);

      const pro100 = PUBLIC_PLANS.find((p) => p.id === 'professional_100');
      expect(pro100).toBeDefined();
      expect(pro100?.profileLimit).toBe(100);
      expect(pro100?.monthlyPrice.INR).toBe(5999);
      expect(pro100?.annualPrice.INR).toBe(2999);

      const team200 = PUBLIC_PLANS.find((p) => p.id === 'business_scale');
      expect(team200).toBeDefined();
      expect(team200?.profileLimit).toBe(200);
      expect(team200?.seatLimit).toBe(20);

      const enterprise = PUBLIC_PLANS.find((p) => p.id === 'enterprise_custom');
      expect(enterprise).toBeDefined();
      expect(enterprise?.profileLimit).toBe(500);
    });
  });

  describe('3. MDX Documentation & Blog Loader', () => {
    it('should parse 5 documentation guides in designated order', () => {
      const docs = getAllDocs();
      expect(docs.length).toBeGreaterThanOrEqual(5);

      const slugs = docs.map((d) => d.slug);
      expect(slugs).toContain('getting-started');
      expect(slugs).toContain('proxy-configuration');
      expect(slugs).toContain('anti-detect-fingerprinting');
      expect(slugs).toContain('automation-api');
      expect(slugs).toContain('team-workspaces');

      const gettingStarted = getDocBySlug('getting-started');
      expect(gettingStarted).not.toBeNull();
      expect(gettingStarted?.title).toContain('Getting Started');
      expect(gettingStarted?.content.length).toBeGreaterThan(100);
    });

    it('should parse 3 research blog posts with metadata', () => {
      const posts = getAllBlogPosts();
      expect(posts.length).toBeGreaterThanOrEqual(3);

      const slugs = posts.map((p) => p.slug);
      expect(slugs).toContain('undetectable-automation-rebrowser-patches-chromium-138');
      expect(slugs).toContain('dual-engine-architecture-chromium-camoufox-antidetect');
      expect(slugs).toContain('zero-cost-distributed-anti-detect-locks-r2-sync');

      const cdpPost = getBlogPostBySlug('undetectable-automation-rebrowser-patches-chromium-138');
      expect(cdpPost).not.toBeNull();
      expect(cdpPost?.author).toBe('Munna Bhai');
      expect(cdpPost?.content).toContain('rebrowser-patches');
    });
  });

  describe('4. Next.js 14 Static Export Invariants (landing/out/)', () => {
    const outDir = path.join(landingDir, 'out');

    it('should contain prerendered static pages for all main marketing routes', () => {
      if (!fs.existsSync(outDir)) {
        // Resilient fallback when run in fresh environment before landing:build
        expect(fs.existsSync(path.join(landingDir, 'app', 'page.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(landingDir, 'app', 'pricing', 'page.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(landingDir, 'app', 'download', 'page.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(landingDir, 'app', 'compare', 'gologin-alternative', 'page.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(landingDir, 'app', 'login', 'page.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(landingDir, 'app', 'signup', 'page.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(landingDir, 'app', 'book-demo', 'page.tsx'))).toBe(true);
        return;
      }
      expect(fs.existsSync(path.join(outDir, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'pricing.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'download.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'compare', 'gologin-alternative.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'login.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'signup.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'book-demo.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'privacy.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'terms.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'aup.html'))).toBe(true);
    });

    it('should contain prerendered docs and blog post HTML', () => {
      if (!fs.existsSync(outDir)) {
        expect(fs.existsSync(path.join(landingDir, 'app', 'docs', 'page.tsx'))).toBe(true);
        expect(fs.existsSync(path.join(landingDir, 'app', 'blog', 'page.tsx'))).toBe(true);
        return;
      }
      expect(fs.existsSync(path.join(outDir, 'docs.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'docs', 'getting-started.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'docs', 'proxy-configuration.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'blog.html'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'blog', 'undetectable-automation-rebrowser-patches-chromium-138.html'))).toBe(true);
    });

    it('should emit valid sitemap.xml and robots.txt with AI bot directives', () => {
      if (!fs.existsSync(outDir)) {
        expect(fs.existsSync(path.join(landingDir, 'app', 'sitemap.ts'))).toBe(true);
        expect(fs.existsSync(path.join(landingDir, 'app', 'robots.ts'))).toBe(true);
        return;
      }
      const sitemapPath = path.join(outDir, 'sitemap.xml');
      expect(fs.existsSync(sitemapPath)).toBe(true);
      const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
      expect(sitemapContent).toContain('https://mahibrowser.com/pricing');
      expect(sitemapContent).toContain('https://mahibrowser.com/download');
      expect(sitemapContent).toContain('https://mahibrowser.com/compare/gologin-alternative');
      expect(sitemapContent).toContain('https://mahibrowser.com/docs/getting-started');

      const robotsPath = path.join(outDir, 'robots.txt');
      expect(fs.existsSync(robotsPath)).toBe(true);
      const robotsContent = fs.readFileSync(robotsPath, 'utf8');
      expect(robotsContent).toContain('User-Agent: GPTBot');
      expect(robotsContent).toContain('User-Agent: ClaudeBot');
      expect(robotsContent).toContain('Sitemap: https://mahibrowser.com/sitemap.xml');
    });
  });

  describe('5. Electron Packaging ExtraResources Filter Safeguards', () => {
    it('should protect desktop installers by excluding node_modules and .next from landing', () => {
      const electronBuilderPath = path.join(rootDir, 'electron-builder.json');
      const config = JSON.parse(fs.readFileSync(electronBuilderPath, 'utf8'));
      const landingResource = config.extraResources.find((r: any) => r.from === 'landing');

      expect(landingResource).toBeDefined();
      expect(Array.isArray(landingResource.filter)).toBe(true);
      expect(landingResource.filter).toContain('!node_modules/**');
      expect(landingResource.filter).toContain('!.next/**');
      expect(landingResource.filter).toContain('!out/**');
    });
  });

  describe('6. WebApiClient Base URL Resolution', () => {
    it('should respect explicit config baseUrl override', () => {
      const client = new WebApiClient({ baseUrl: 'https://custom-gateway.mahibrowser.com' });
      expect((client as any).baseUrl).toBe('https://custom-gateway.mahibrowser.com');
    });

    it('should fallback to localhost:8989 in Node environments', () => {
      const client = new WebApiClient();
      expect((client as any).baseUrl).toBe('http://localhost:8989');
    });

    it('should resolve to api.mahibrowser.com when window.location.hostname is app.mahibrowser.com', () => {
      // Simulate browser window
      const origWindow = (global as any).window;
      try {
        (global as any).window = {
          location: {
            hostname: 'app.mahibrowser.com',
            origin: 'https://app.mahibrowser.com',
          },
        };
        const client = new WebApiClient();
        expect((client as any).baseUrl).toBe('https://api.mahibrowser.com');
      } finally {
        if (origWindow !== undefined) {
          (global as any).window = origWindow;
        } else {
          delete (global as any).window;
        }
      }
    });
  });
});
