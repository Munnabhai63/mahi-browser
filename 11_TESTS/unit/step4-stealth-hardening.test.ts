import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import http from 'node:http';
import crypto from 'node:crypto';
import { ensureProfileStealthExtension, getProfileDebugPort } from '../../02_BROWSER/launcher.js';
import { injectNativeStealthPreferences } from '../../02_BROWSER/stealth-native-preferences.js';
import { getMahiCustomCorePath, getStealthOrbitaEnginePath } from '../../02_BROWSER/detector.js';
import { resolveMultiCoreExecutablePath } from '../../02_BROWSER/services/multi-core-resolver.js';
import { getCommercialPlanById } from '../../07_BACKEND/commercial/commercial-plan-service.js';
import { paymentService } from '../../07_BACKEND/commercial/payment-service.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { Profile } from '../../10_CONFIG/shared/types/profile.js';

describe('Step 4: Pre-C++ Browser Stealth Hardening, 02_BROWSER Cleanup & Commercial Truth', () => {
  let tempBaseDir: string;

  beforeAll(async () => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mahi-step4-test-'));
    await initializeDatabase();
  });

  afterAll(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. ensureProfileStealthExtension honors profile fingerprint settings, Linux UA, dynamic CDP port DNR (rules 2, 3, 4), and Accept-Language', () => {
    const profileDir = path.join(tempBaseDir, 'profile-linux-stealth');
    fs.mkdirSync(profileDir, { recursive: true });

    const mockProfile: Profile = {
      id: 'prof_linux_test_42',
      name: 'Linux Stealth Tester',
      browser: 'chrome',
      platform: 'linux',
      os: 'Linux',
      os_version: 'Ubuntu 24.04',
      storage: { type: 'local' },
      sync: { enabled: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        browser: {
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        },
        viewport: { width: 1920, height: 1080 },
        fingerprint: {
          webglVendor: 'Google Inc. (NVIDIA)',
          webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
          hardwareConcurrency: 8,
          deviceMemory: 8,
          maxTouchPoints: 5,
          canvas: 'noise',
          audio: 'noise',
          webgl: 'noise',
          clientRects: 'noise',
          webrtc: 'proxy_only',
        },
        locale: {
          languages: 'fr-FR,fr,en-US,en',
          timezone: 'Europe/Paris',
        },
      },
    };

    const extPath = ensureProfileStealthExtension(
      profileDir,
      mockProfile.id,
      mockProfile.name,
      mockProfile.settings
    );
    expect(fs.existsSync(extPath)).toBe(true);

    // Verify rules.json (DNR)
    const rulesJsonPath = path.join(extPath, 'rules.json');
    expect(fs.existsSync(rulesJsonPath)).toBe(true);
    const rules = JSON.parse(fs.readFileSync(rulesJsonPath, 'utf8'));

    // Rule 1: Accept-Language modification
    const acceptLangRule = rules.find((r: any) => r.id === 1);
    expect(acceptLangRule).toBeDefined();
    const acceptLangHeader = acceptLangRule.action.requestHeaders.find((h: any) => h.header === 'accept-language');
    expect(acceptLangHeader).toBeDefined();
    expect(acceptLangHeader.value).toContain('fr-FR');

    // Rule 2: Static CDP port 9222 blocking
    const cdpBlockRule2 = rules.find((r: any) => r.id === 2);
    expect(cdpBlockRule2).toBeDefined();
    expect(cdpBlockRule2.action.type).toBe('block');
    expect(cdpBlockRule2.condition.urlFilter).toBe('||127.0.0.1:9222');

    // Rules 3 & 4: Dynamic CDP port blocking using getProfileDebugPort(profileId)
    const expectedPort = getProfileDebugPort(mockProfile.id);
    const cdpBlockRule3 = rules.find((r: any) => r.id === 3);
    expect(cdpBlockRule3).toBeDefined();
    expect(cdpBlockRule3.action.type).toBe('block');
    expect(cdpBlockRule3.condition.urlFilter).toBe(`||127.0.0.1:${expectedPort}`);

    const cdpBlockRule4 = rules.find((r: any) => r.id === 4);
    expect(cdpBlockRule4).toBeDefined();
    expect(cdpBlockRule4.action.type).toBe('block');
    expect(cdpBlockRule4.condition.urlFilter).toBe(`||localhost:${expectedPort}`);

    // Verify stealth-core.js content
    const coreScriptPath = path.join(extPath, 'stealth-core.js');
    expect(fs.existsSync(coreScriptPath)).toBe(true);
    const coreScript = fs.readFileSync(coreScriptPath, 'utf8');

    expect(coreScript).toContain('Linux x86_64');
    expect(coreScript).toContain('Google Inc. (NVIDIA)');
    expect(coreScript).toContain('RTX 3080');
    expect(coreScript).toContain("spoofNavigator('hardwareConcurrency', 8)");
    expect(coreScript).toContain("spoofNavigator('deviceMemory', 8)");
    expect(coreScript).toContain('Europe/Paris');
    expect(coreScript).toContain('fr-FR');
  });

  it('2. stealth-core.js execution in VM context masks navigator, Date, Intl, WebGL, WebGPU, WebRTC, and sweeps automation flags', () => {
    const profileDir = path.join(tempBaseDir, 'profile-vm-exec');
    fs.mkdirSync(profileDir, { recursive: true });

    const mockProfile: Profile = {
      id: 'prof_vm_test',
      name: 'VM Execution Tester',
      browser: 'chrome',
      platform: 'linux',
      os: 'Linux',
      os_version: 'Ubuntu 24.04',
      storage: { type: 'local' },
      sync: { enabled: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        browser: {
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        },
        viewport: { width: 1920, height: 1080 },
        fingerprint: {
          webglVendor: 'Google Inc. (NVIDIA)',
          webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
          hardwareConcurrency: 8,
          deviceMemory: 8,
          maxTouchPoints: 5,
          canvas: 'noise',
          audio: 'noise',
          webgl: 'noise',
          clientRects: 'noise',
          webrtc: 'proxy_only',
        },
        locale: {
          languages: 'fr-FR,fr,en-US,en',
          timezone: 'Europe/Paris',
        },
      },
    };

    const extPath = ensureProfileStealthExtension(
      profileDir,
      mockProfile.id,
      mockProfile.name,
      mockProfile.settings
    );
    const coreScript = fs.readFileSync(path.join(extPath, 'stealth-core.js'), 'utf8');

    // Create a mock browser window & sandbox
    function MockNavigator() {}
    MockNavigator.prototype = {
      webdriver: true,
      hardwareConcurrency: 4,
      deviceMemory: 4,
      platform: 'Win32',
      maxTouchPoints: 0,
      language: 'en-US',
      languages: ['en-US', 'en'],
      userAgent: mockProfile.settings?.browser?.userAgent,
      gpu: {
        requestAdapter: function () {
          return Promise.resolve({
            requestAdapterInfo: function () {
              return Promise.resolve({ vendor: 'mock-vendor', device: 'mock-device' });
            },
          });
        },
      },
    };

    function MockWebGLRenderingContext() {}
    MockWebGLRenderingContext.prototype = {
      getParameter: function (param: number) {
        return 'MockParam';
      },
      getExtension: function () {
        return {
          UNMASKED_VENDOR_WEBGL: 0x9245,
          UNMASKED_RENDERER_WEBGL: 0x9246,
        };
      },
      readPixels: function (x: number, y: number, w: number, h: number, format: any, type: any, pixels: Uint8Array) {
        for (let i = 0; i < pixels.length; i++) pixels[i] = 128;
      },
    };

    function MockRTCPeerConnection(config?: any) {
      this.config = config;
      this.localDescription = null;
      this.onicecandidate = null;
      this.listeners = {} as Record<string, Function[]>;
    }
    MockRTCPeerConnection.prototype = {
      addEventListener: function (type: string, fn: Function) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(fn);
      },
      dispatchEvent: function (event: any) {
        if (this.onicecandidate) this.onicecandidate(event);
        if (this.listeners[event.type]) {
          this.listeners[event.type].forEach((cb: Function) => cb(event));
        }
      },
      setLocalDescription: function (desc: any) {
        this.localDescription = desc;
      },
      createOffer: function () {
        return Promise.resolve({
          type: 'offer',
          sdp: 'v=0\r\no=- 1234 2 IN IP4 127.0.0.1\r\na=candidate:1 1 UDP 2122260223 192.168.1.50 54321 typ host\r\na=candidate:2 1 UDP 1686052607 203.0.113.1 54322 typ srflx raddr 192.168.1.50 rport 54321\r\na=candidate:3 1 UDP 41885695 198.51.100.1 54323 typ relay raddr 203.0.113.1 rport 54322\r\n',
        });
      },
    };

    const navigatorInstance = Object.create(MockNavigator.prototype);
    navigatorInstance.webdriver = true;
    navigatorInstance.hardwareConcurrency = 4;
    navigatorInstance.deviceMemory = 4;
    navigatorInstance.platform = 'Win32';
    navigatorInstance.userAgent = mockProfile.settings?.browser?.userAgent;
    navigatorInstance.gpu = MockNavigator.prototype.gpu;

    const sandbox: Record<string, any> = {
      window: {
        cdc_adoQpoasnfa76pfcZLmcfl_Array: true,
        __webdriver_evaluate: () => {},
      },
      navigator: navigatorInstance,
      Navigator: MockNavigator,
      WebGLRenderingContext: MockWebGLRenderingContext,
      WebGL2RenderingContext: MockWebGLRenderingContext,
      RTCPeerConnection: MockRTCPeerConnection,
      Date: Date,
      Intl: Intl,
      Function: Function,
      console: console,
    };
    sandbox.window.window = sandbox.window;
    sandbox.window.navigator = navigatorInstance;
    sandbox.window.WebGLRenderingContext = MockWebGLRenderingContext;
    sandbox.window.RTCPeerConnection = MockRTCPeerConnection;
    sandbox.window.Date = Date;
    sandbox.window.Intl = Intl;

    const context = vm.createContext(sandbox);
    vm.runInContext(coreScript, context);

    // 1. Navigator spoofing
    expect(context.navigator.webdriver).toBe(false);
    expect(context.navigator.hardwareConcurrency).toBe(8);
    expect(context.navigator.deviceMemory).toBe(8);
    expect(context.navigator.platform).toBe('Linux x86_64');
    expect(context.navigator.language).toBe('fr-FR');
    expect(context.navigator.languages[0]).toBe('fr-FR');
    expect(Object.isFrozen(context.navigator.languages)).toBe(true);

    // 2. Intl timezone & Date offset
    const resolvedTz = context.Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(resolvedTz).toBe('Europe/Paris');
    // Ensure default Intl.DateTimeFormat constructor adopts target timezone
    const dtf = new context.Intl.DateTimeFormat();
    expect(dtf.resolvedOptions().timeZone).toBe('Europe/Paris');

    // 3. Automation flag sweep
    expect(context.window.cdc_adoQpoasnfa76pfcZLmcfl_Array).toBeUndefined();
    expect(context.window.__webdriver_evaluate).toBeUndefined();

    // 4. WebGL getParameter spoofing
    const gl = new context.WebGLRenderingContext();
    const vendorParam = gl.getParameter(0x9245);
    const rendererParam = gl.getParameter(0x9246);
    expect(vendorParam).toBe('Google Inc. (NVIDIA)');
    expect(rendererParam).toContain('RTX 3080');

    // 5. Native toString masking
    const toStringOutput = Function.prototype.toString.call(gl.getParameter);
    expect(toStringOutput).toContain('[native code]');

    // 6. WebRTC relay policy & candidate filtering
    const pc = new context.window.RTCPeerConnection({ iceServers: [] });
    expect(pc.config?.iceTransportPolicy).toBe('relay');

    let candidateDropped = true;
    pc.onicecandidate = (e: any) => {
      candidateDropped = false;
    };
    pc.dispatchEvent({ type: 'icecandidate', candidate: { candidate: 'candidate:1 1 UDP 123 192.168.1.1 5000 typ host' } });
    expect(candidateDropped).toBe(true);

    // 7. WebGPU adapter info spoofing
    return context.navigator.gpu.requestAdapter().then(async (adapter: any) => {
      expect(adapter).toBeDefined();
      expect(adapter.info.description).toContain('RTX 3080');
      const reqInfo = await adapter.requestAdapterInfo();
      expect(reqInfo.description).toContain('RTX 3080');
    });
  });

  it('3. stealth-core.js respects fingerprint: off settings without injecting overrides', () => {
    const profileDir = path.join(tempBaseDir, 'profile-stealth-off');
    fs.mkdirSync(profileDir, { recursive: true });

    const mockProfile: Profile = {
      id: 'prof_off_test',
      name: 'Fingerprint Off Tester',
      browser: 'chrome',
      platform: 'windows',
      os: 'Windows',
      os_version: '11',
      storage: { type: 'local' },
      sync: { enabled: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        browser: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/133.0.0.0 Safari/537.36',
        },
        viewport: { width: 1920, height: 1080 },
        fingerprint: {
          canvas: 'off',
          audio: 'off',
          webgl: 'off',
          clientRects: 'off',
          webrtc: 'off',
        },
      },
    };

    const extPath = ensureProfileStealthExtension(
      profileDir,
      mockProfile.id,
      mockProfile.name,
      mockProfile.settings
    );
    const coreScript = fs.readFileSync(path.join(extPath, 'stealth-core.js'), 'utf8');

    // Canvas, audio, webgl noise hooks must be compiled out with if (false) blocks
    expect(coreScript).toContain('if (false)');

    // In VM context, verify WebGL getParameter is NOT hooked when webgl: 'off'
    function MockWebGLContext() {}
    MockWebGLContext.prototype = {
      getParameter: function () {
        return 'RawOriginalParam';
      },
    };

    const sandbox: Record<string, any> = {
      window: {},
      navigator: { userAgent: mockProfile.settings?.browser?.userAgent },
      Navigator: function () {},
      WebGLRenderingContext: MockWebGLContext,
      WebGL2RenderingContext: MockWebGLContext,
      Date: Date,
      Intl: Intl,
      Function: Function,
      console: console,
    };
    sandbox.window.window = sandbox.window;
    sandbox.window.WebGLRenderingContext = MockWebGLContext;

    const ctx = vm.createContext(sandbox);
    vm.runInContext(coreScript, ctx);

    const gl = new ctx.WebGLRenderingContext();
    expect(gl.getParameter(0x9245)).toBe('RawOriginalParam');
  });

  it('4. injectNativeStealthPreferences writes identical deterministic configs to both prefs.mahi and prefs.gologin', () => {
    const profileDir = path.join(tempBaseDir, 'profile-prefs-test');
    fs.mkdirSync(profileDir, { recursive: true });

    const mockProfile: Profile = {
      id: 'prof_prefs_sync_99',
      name: 'Prefs Synchronizer',
      browser: 'chrome',
      platform: 'windows',
      os: 'Windows',
      os_version: '10',
      storage: { type: 'local' },
      sync: { enabled: false },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        browser: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/133.0.0.0 Safari/537.36',
        },
        viewport: { width: 1920, height: 1080 },
        fingerprint: {
          canvas: 'noise',
          audio: 'noise',
          webgl: 'noise',
          clientRects: 'noise',
          webrtc: 'proxy_only',
        },
      },
    };

    injectNativeStealthPreferences(profileDir, mockProfile, mockProfile.settings);

    const defaultPrefsPath = path.join(profileDir, 'Default', 'Preferences');
    expect(fs.existsSync(defaultPrefsPath)).toBe(true);

    const prefs = JSON.parse(fs.readFileSync(defaultPrefsPath, 'utf8'));
    expect(prefs.mahi).toBeDefined();
    expect(prefs.gologin).toBeDefined();

    // Verify deep parity between MAHI native schema and legacy GoLogin compatibility mirror
    expect(prefs.mahi).toEqual(prefs.gologin);
    expect(prefs.mahi.canvasMode).toBe('noise');
    expect(prefs.mahi.client_rects_noise_enable).toBe(true);
    expect(prefs.mahi.webgl_noise_enable).toBe(true);
  });

  it('5. detector.ts and multi-core-resolver.ts resolve getMahiCustomCorePath and accept all valid coreType values', () => {
    // getMahiCustomCorePath() is exported alongside getStealthOrbitaEnginePath alias
    expect(typeof getMahiCustomCorePath).toBe('function');
    expect(typeof getStealthOrbitaEnginePath).toBe('function');
    expect(getStealthOrbitaEnginePath).toBe(getMahiCustomCorePath);

    // resolveMultiCoreExecutablePath handles resolution
    const resolution = resolveMultiCoreExecutablePath(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    );
    expect(resolution).toBeDefined();
    expect(resolution.majorVersion).toBe(130);
    // Accepts all valid MultiCoreResolution['coreType'] targets on clean Linux, Windows & CI runners
    expect(['exact-multi-core', 'mahi-custom-core', 'mahi-bundled', 'mahi-managed', 'stealth-orbita', 'system-chromium']).toContain(resolution.coreType);
  });

  it('6. commercial-plan-service returns non-zero prices, and verifyYoupiPgOrder detects amount tampering', async () => {
    // 1. Plan service non-zero prices matching canonical calculation
    const plan = getCommercialPlanById('professional_10');
    expect(plan).toBeDefined();
    expect(plan?.priceMonthly).toBe(599);
    expect(plan?.priceAnnual).toBe(3594);

    // 2. YouPI-PG amount tampering prevention
    const db = getDatabase();
    const testOrderId = `order_tamper_test_${Date.now()}`;
    const testUserId = `user_tamper_${Date.now()}`;

    // Insert mock pending payment expecting ₹599 (59900 paise)
    db.prepare(`
      INSERT INTO commercial_payments (
        id, user_id, plan_id, billing_cycle, amount_cents, currency,
        provider, status, external_payment_id, external_order_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      testOrderId,
      testUserId,
      'professional_10',
      'MONTHLY',
      59900, // ₹599.00
      'INR',
      'youpi_pg',
      'PENDING',
      `pay_${testOrderId}`,
      testOrderId
    );

    // Start a temporary mock server that returns tampered amount ₹100 instead of ₹599
    let mockServer: http.Server;
    let mockPort = 0;
    await new Promise<void>((resolve) => {
      mockServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'SUCCESS',
          paymentId: `pay_${testOrderId}`,
          orderId: testOrderId,
          amount: 100, // Tampered amount: ₹100 instead of ₹599
        }));
      });
      mockServer.listen(0, '127.0.0.1', () => {
        mockPort = (mockServer.address() as any).port;
        resolve();
      });
    });

    const originalBaseUrl = process.env.YOUPI_PG_BASE_URL;
    const originalApiKey = process.env.YOUPI_PG_API_KEY;
    process.env.YOUPI_PG_BASE_URL = `http://127.0.0.1:${mockPort}`;
    process.env.YOUPI_PG_API_KEY = 'test_key';

    try {
      const result = await paymentService.verifyYoupiPgOrder(testOrderId, testUserId);
      expect(result.success).toBe(false);
      expect(result.status).toBe('AMOUNT_MISMATCH');
      expect(result.error).toContain('AMOUNT_TAMPERING_DETECTED');
    } finally {
      mockServer!.close();
      if (originalBaseUrl !== undefined) {
        process.env.YOUPI_PG_BASE_URL = originalBaseUrl;
      } else {
        delete process.env.YOUPI_PG_BASE_URL;
      }
      if (originalApiKey !== undefined) {
        process.env.YOUPI_PG_API_KEY = originalApiKey;
      } else {
        delete process.env.YOUPI_PG_API_KEY;
      }
    }
  });

  it('7. Stripe USD canonical webhook verification succeeds without AMOUNT_TAMPERING_DETECTED error', async () => {
    const db = getDatabase();
    const testUserId = `user_stripe_usd_${Date.now()}`;
    const testOrderId = `order_stripe_usd_${Date.now()}`;

    // Ensure user exists
    db.prepare(`
      INSERT OR IGNORE INTO commercial_users (id, email, password_hash, status, created_at, updated_at)
      VALUES (?, ?, 'dummy_hash', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(testUserId, `${testUserId}@example.com`);

    const secret = 'whsec_stripe_test_secret_for_usd';
    const nowSec = Math.floor(Date.now() / 1000);

    // 1. Legitimate USD Stripe event: professional_10 monthly = $7 (700 cents)
    const legitPayloadObj = {
      id: `evt_stripe_${Date.now()}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: testOrderId,
          client_reference_id: testUserId,
          amount_total: 700, // $7.00 USD
          currency: 'usd',
          metadata: {
            userId: testUserId,
            planId: 'professional_10',
            billingCycle: 'MONTHLY',
          },
        },
      },
    };
    const legitPayload = JSON.stringify(legitPayloadObj);
    const legitSig = crypto.createHmac('sha256', secret).update(`${nowSec}.${legitPayload}`).digest('hex');
    const legitHeader = `t=${nowSec},v1=${legitSig}`;

    const legitResult = await paymentService.handleWebhook('stripe', legitPayload, legitHeader, { secret });
    expect(legitResult.success).toBe(true);

    // 2. Tampered USD Stripe event: professional_10 monthly paying only $5 (500 cents instead of 700)
    const tamperedPayloadObj = {
      id: `evt_stripe_tampered_${Date.now()}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `order_tampered_${Date.now()}`,
          client_reference_id: testUserId,
          amount_total: 500, // Tampered: $5.00 USD (< $7.00 required)
          currency: 'usd',
          metadata: {
            userId: testUserId,
            planId: 'professional_10',
            billingCycle: 'MONTHLY',
          },
        },
      },
    };
    const tamperedPayload = JSON.stringify(tamperedPayloadObj);
    const tamperedSig = crypto.createHmac('sha256', secret).update(`${nowSec}.${tamperedPayload}`).digest('hex');
    const tamperedHeader = `t=${nowSec},v1=${tamperedSig}`;

    await expect(
      paymentService.handleWebhook('stripe', tamperedPayload, tamperedHeader, { secret })
    ).rejects.toThrow('AMOUNT_TAMPERING_DETECTED');
  });
});
