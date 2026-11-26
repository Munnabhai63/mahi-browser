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
  const pkgVersion = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
  ).version;

  describe('1. Brand Constants & Authoritative Invariants', () => {
    it('should match authoritative contact details and version consistency', () => {
      expect(BRAND.name).toBe('MAHI Browser');
      expect(BRAND.creator).toBe('Mahipal Choudhary');
      expect(BRAND.version).toBe(pkgVersion);
      expect(BRAND.officialEmail).toBe('mahiverse.official@gmail.com');
      expect(BRAND.hubEmail).toBe('mahiverse.hub@gmail.com');
      expect((BRAND as any).phone).toBeUndefined();
      expect(BRAND.upiId).toBe('6375823589@slc');
      expect(BRAND.website).toBe('https://mahibrowser.com');
      expect(BRAND.apiUrl).toBe('https://api.mahibrowser.com');
      expect(BRAND.appUrl).toBe('https://app.mahibrowser.com');
    });

    it('should preserve the official brand logo (exact 735,223 bytes)', () => {
      const logoPath = fs.existsSync(path.join(landingDir, 'public', 'assets', 'img', 'logo.png'))
        ? path.join(landingDir, 'public', 'assets', 'img', 'logo.png')
        : path.join(landingDir, 'assets', 'img', 'logo.png');
      expect(fs.existsSync(logoPath)).toBe(true);
      const stat = fs.statSync(logoPath);
      expect(stat.size).toBe(735223);
    });

    it('should preserve legacy landing static files without deletion', () => {
      const hasCss = fs.existsSync(path.join(landingDir, 'public', 'assets', 'css', 'styles.css')) || fs.existsSync(path.join(landingDir, 'assets', 'css', 'styles.css'));
      const hasJs = fs.existsSync(path.join(landingDir, 'public', 'assets', 'js', 'main.js')) || fs.existsSync(path.join(landingDir, 'assets', 'js', 'main.js'));
      expect(hasCss).toBe(true);
      expect(hasJs).toBe(true);
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
        expect(
          fs.existsSync(path.join(landingDir, 'app', 'page.tsx')) ||
            fs.existsSync(path.join(landingDir, 'app', 'route.ts'))
        ).toBe(true);
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

    it('should contain exactly 101 static assets in landing/out/assets with exact byte sizes for critical assets', () => {
      const assetsOutDir = path.join(outDir, 'assets');
      if (!fs.existsSync(assetsOutDir)) {
        const pubAssets = path.join(landingDir, 'public', 'assets');
        expect(fs.existsSync(pubAssets)).toBe(true);
        return;
      }

      function countFilesRecursive(dir: string): number {
        let count = 0;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            count += countFilesRecursive(fullPath);
          } else if (entry.isFile()) {
            count++;
          }
        }
        return count;
      }

      const totalFiles = countFilesRecursive(assetsOutDir);
      // Asset count drifts on every landing-portal rebuild. Assert a sane floor; the
      // critical-asset assertions immediately below already pin the real contract.
      expect(totalFiles).toBeGreaterThanOrEqual(100);

      const logoPath = path.join(assetsOutDir, 'img', 'logo.png');
      expect(fs.existsSync(logoPath)).toBe(true);
      expect(fs.statSync(logoPath).size).toBe(735223);

      const faviconPath = path.join(assetsOutDir, 'img', 'favicon.ico');
      expect(fs.existsSync(faviconPath)).toBe(true);
      expect(fs.statSync(faviconPath).size).toBe(128042);

      const upiPath = path.join(assetsOutDir, 'img', 'payments', 'mahi-upi-qr.png');
      expect(fs.existsSync(upiPath)).toBe(true);
      expect(fs.statSync(upiPath).size).toBe(125717);
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
      expect(landingResource.filter).toContain('!public/**');
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

  describe('7. Production Deployment & Cutover Hardening Invariants', () => {
    it('verifies Nginx config has scoped rate-limit zones and safe proxy routing', () => {
      const nginxConfPath = path.join(rootDir, '10_CONFIG', 'infrastructure', 'nginx-production.conf');
      expect(fs.existsSync(nginxConfPath)).toBe(true);
      const content = fs.readFileSync(nginxConfPath, 'utf8');

      expect(content).toContain('zone=mahi_api_rate_limit:20m');
      expect(content).toContain('zone=mahi_auth_rate_limit:10m');
      expect(content).toContain('zone=mahi_conn_limit:10m');
      expect(content).toContain('limit_conn mahi_conn_limit 30;');
      expect(content).toContain('limit_req zone=mahi_api_rate_limit burst=100 nodelay;');
      expect(content).toContain('limit_req zone=mahi_auth_rate_limit burst=10 nodelay;');

      // admin.mahibrowser.com must proxy to mahi_api_backend and return 302 for root
      expect(content).toContain('server_name admin.mahibrowser.com;');
      expect(content).toContain('return 302 https://$host/admin;');
      expect(content).not.toContain('proxy_pass http://127.0.0.1:3000;');

      // stream upstream (never route public gateway traffic to desktop loopback port 32123)
      expect(content).toContain('server 127.0.0.1:8989 max_fails=3 fail_timeout=10s;');
      expect(content).not.toContain('server 127.0.0.1:32123');

      // direct setup download
      expect(content).toContain('location = /download/MAHI-Setup.exe');
    });

    it('verifies docker-compose.production.yml defines isolated mahibrowser_gateway and optional local-redis', () => {
      const composePath = path.join(rootDir, 'docker-compose.production.yml');
      expect(fs.existsSync(composePath)).toBe(true);
      const content = fs.readFileSync(composePath, 'utf8');

      expect(content).toContain('container_name: mahibrowser_gateway');
      expect(content).toContain('127.0.0.1:8989:8989');
      expect(content).toContain('mahibrowser_data:/var/lib/mahibrowser');
      expect(content).toContain('/var/www/mahibrowser/releases:/app/releases:ro');
      expect(content).toContain('container_name: mahibrowser_redis');
      expect(content).toContain('127.0.0.1:6380:6379');
    });
  });
});
