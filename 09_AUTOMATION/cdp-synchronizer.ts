import http from 'node:http';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Socket } from 'node:net';
import { getProfileDebugPort } from '../02_BROWSER/launcher.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';

export interface CdpTabInfo {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export interface SlaveSyncStatus {
  slaveId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastError?: string;
  lastMirroredAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal CDP WebSocket Client
// Uses Node.js built-in http module for WebSocket upgrade.
// Works reliably in Electron's main process (Node.js 20) regardless of
// whether globalThis.WebSocket exists. Only handles text frames (sufficient
// for Chrome DevTools Protocol JSON messages).
// ─────────────────────────────────────────────────────────────────────────────
class CdpWsClient {
  private socket: Socket | null = null;
  private _readyState: number = 0; // 0=CONNECTING, 1=OPEN, 3=CLOSED
  private _onMessage: ((data: string) => void) | null = null;
  private recvBuf: Buffer = Buffer.alloc(0);

  get readyState(): number {
    return this._readyState;
  }

  set onMessage(handler: (data: string) => void) {
    this._onMessage = handler;
  }

  /**
   * Opens a WebSocket connection to a Chrome DevTools Protocol endpoint.
   * Returns a connected client ready to send/receive.
   */
  static connect(wsUrl: string, timeoutMs: number = 4000): Promise<CdpWsClient> {
    return new Promise((resolve, reject) => {
      const client = new CdpWsClient();
      let resolved = false;

      try {
        const url = new URL(wsUrl);
        const key = crypto.randomBytes(16).toString('base64');

        const req = http.request({
          hostname: url.hostname,
          port: url.port || 80,
          path: url.pathname + (url.search || ''),
          method: 'GET',
          headers: {
            Connection: 'Upgrade',
            Upgrade: 'websocket',
            'Sec-WebSocket-Key': key,
            'Sec-WebSocket-Version': '13',
          },
        });

        req.on('upgrade', (_res, socket, head) => {
          client.socket = socket;
          client._readyState = 1;
          client.recvBuf = head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);

          socket.on('data', (chunk: Buffer) => {
            client.recvBuf = Buffer.concat([client.recvBuf, chunk]);
            client.parseFrames();
          });

          socket.on('close', () => {
            client._readyState = 3;
          });

          socket.on('error', () => {
            client._readyState = 3;
          });

          if (!resolved) {
            resolved = true;
            resolve(client);
          }
        });

        req.on('error', (err) => {
          client._readyState = 3;
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });

        req.setTimeout(timeoutMs, () => {
          req.destroy();
          client._readyState = 3;
          if (!resolved) {
            resolved = true;
            reject(new Error('WebSocket connect timeout'));
          }
        });

        req.end();
      } catch (err) {
        client._readyState = 3;
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      }
    });
  }

  /** Parse incoming WebSocket frames from the receive buffer. */
  private parseFrames(): void {
    while (this.recvBuf.length >= 2) {
      const opcode = this.recvBuf[0] & 0x0f;
      const masked = (this.recvBuf[1] & 0x80) !== 0;
      let payloadLen = this.recvBuf[1] & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (this.recvBuf.length < 4) return;
        payloadLen = this.recvBuf.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (this.recvBuf.length < 10) return;
        payloadLen = this.recvBuf.readUInt32BE(6); // lower 32 bits (sufficient for CDP)
        offset = 10;
      }

      if (masked) offset += 4;
      if (this.recvBuf.length < offset + payloadLen) return;

      let payload = this.recvBuf.subarray(offset, offset + payloadLen);
      if (masked) {
        const maskKey = this.recvBuf.subarray(offset - 4, offset);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      // Advance buffer past this frame
      this.recvBuf = Buffer.from(this.recvBuf.subarray(offset + payloadLen));

      if (opcode === 1 && this._onMessage) {
        // Text frame
        try {
          this._onMessage(payload.toString('utf8'));
        } catch {}
      } else if (opcode === 8) {
        // Close frame
        this._readyState = 3;
        try {
          this.socket?.end();
        } catch {}
        return;
      }
      // Opcode 9 (ping) → we could send pong but CDP doesn't use them
    }
  }

  /** Send a text frame (client→server: masked as per RFC 6455). */
  send(data: string): void {
    if (this._readyState !== 1 || !this.socket) return;

    const payload = Buffer.from(data, 'utf8');
    const mask = crypto.randomBytes(4);
    let header: Buffer;

    if (payload.length < 126) {
      header = Buffer.alloc(6);
      header[0] = 0x81; // FIN + text opcode
      header[1] = 0x80 | payload.length;
      mask.copy(header, 2);
    } else if (payload.length < 65536) {
      header = Buffer.alloc(8);
      header[0] = 0x81;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
      mask.copy(header, 4);
    } else {
      header = Buffer.alloc(14);
      header[0] = 0x81;
      header[1] = 0x80 | 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(payload.length, 6);
      mask.copy(header, 10);
    }

    // Mask the payload
    const masked = Buffer.from(payload);
    for (let i = 0; i < masked.length; i++) {
      masked[i] ^= mask[i % 4];
    }

    try {
      this.socket.write(Buffer.concat([header, masked]));
    } catch {}
  }

  /** Close the WebSocket connection gracefully. */
  close(): void {
    if (this._readyState === 3) return;
    this._readyState = 3;
    if (this.socket) {
      // Send a masked close frame
      const frame = Buffer.alloc(6);
      frame[0] = 0x88; // FIN + close opcode
      frame[1] = 0x80; // MASK + 0 length
      crypto.randomBytes(4).copy(frame, 2);
      try {
        this.socket.write(frame);
      } catch {}
      try {
        this.socket.end();
      } catch {}
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CDP Synchronizer — Real Multi-Window Action Mirroring
//
// Architecture:
//   Master Browser ──(CDP Runtime.addBinding)──► CdpSynchronizer
//       │
//       │  (captures: click, type, key, scroll)
//       ▼
//   CdpSynchronizer ──(CDP Input/Runtime)──► Slave Browser(s)
//
// The master browser gets a capture script injected via CDP that detects
// user actions and sends them back through Runtime.addBinding. The
// synchronizer then dispatches equivalent actions to all slave browsers
// via CDP WebSocket.
// ─────────────────────────────────────────────────────────────────────────────

export class CdpSynchronizer extends EventEmitter {
  private active = false;
  private isPausedState = false;
  private masterProfileId: string | null = null;
  private slaveProfileIds: string[] = [];
  private slaveStatuses: Map<string, SlaveSyncStatus> = new Map();
  private pollTimer: NodeJS.Timeout | null = null;
  private lastMasterUrl: string | null = null;
  private slaveWsCache: Map<string, CdpWsClient> = new Map();
  private masterWs: CdpWsClient | null = null;
  private msgId = 1;

  public isRunning(): boolean {
    return this.active;
  }

  public isPaused(): boolean {
    return this.isPausedState;
  }

  public pause(): void {
    if (!this.active) return;
    this.isPausedState = true;
    this.emit('sync-paused');
  }

  public resume(): void {
    if (!this.active) return;
    this.isPausedState = false;
    this.emit('sync-resumed');
  }

  public getMasterProfileId(): string | null {
    return this.masterProfileId;
  }

  public getSlaveProfileIds(): string[] {
    return [...this.slaveProfileIds];
  }

  public getSlaveStatuses(): SlaveSyncStatus[] {
    return this.slaveProfileIds
      .filter((id) => id !== this.masterProfileId)
      .map((id) => {
        const found = this.slaveStatuses.get(id);
        if (found) return found;
        const cached = this.slaveWsCache.get(id);
        return {
          slaveId: id,
          status: cached && cached.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
        };
      });
  }

  public async reconnectSlave(slaveId: string): Promise<boolean> {
    const existing = this.slaveWsCache.get(slaveId);
    if (existing) {
      try { existing.close(); } catch {}
      this.slaveWsCache.delete(slaveId);
    }
    const ws = await this.getSlaveWs(slaveId);
    const ok = !!ws && ws.readyState === 1;
    this.slaveStatuses.set(slaveId, {
      slaveId,
      status: ok ? 'CONNECTED' : 'ERROR',
      lastError: ok ? undefined : 'Failed to connect CDP socket',
    });
    return ok;
  }

  public async addSlave(slaveId: string): Promise<boolean> {
    if (!this.slaveProfileIds.includes(slaveId)) {
      this.slaveProfileIds.push(slaveId);
    }
    return this.reconnectSlave(slaveId);
  }

  public removeSlave(slaveId: string): void {
    this.slaveProfileIds = this.slaveProfileIds.filter((id) => id !== slaveId);
    const ws = this.slaveWsCache.get(slaveId);
    if (ws) {
      try { ws.close(); } catch {}
      this.slaveWsCache.delete(slaveId);
    }
    this.slaveStatuses.delete(slaveId);
  }

  private nextId(): number {
    return this.msgId++;
  }

  /**
   * Starts the CDP synchronizer: connects to master browser, injects action
   * capture script, and prepares connections to slave browsers.
   */
  public async start(masterProfileId: string, slaveProfileIds: string[]): Promise<boolean> {
    // Clean up any previous session
    this.stop();

    this.active = true;
    this.isPausedState = false;
    this.masterProfileId = masterProfileId;
    this.slaveProfileIds = slaveProfileIds;
    this.slaveStatuses.clear();
    this.lastMasterUrl = null;
    this.msgId = 1;

    try {
      logActivity(
        'SYSTEM',
        'INFO',
        'CDP_SYNCHRONIZER_STARTED',
        `CDP Native Synchronizer active for Master: ${masterProfileId} with ${slaveProfileIds.length} Slaves.`
      );
    } catch {}

    // Initialize slave statuses
    for (const slaveId of slaveProfileIds) {
      if (slaveId !== masterProfileId) {
        this.slaveStatuses.set(slaveId, {
          slaveId,
          status: 'DISCONNECTED',
        });
      }
    }

    // Connect to master browser and inject capture script
    await this.connectToMaster();

    // Pre-connect to slave browsers
    for (const slaveId of slaveProfileIds) {
      if (slaveId !== masterProfileId) {
        this.getSlaveWs(slaveId).catch(() => {});
      }
    }

    // Start background URL watcher (catches omnibox navigation, bookmarks, etc.)
    this.startMasterUrlWatcher();

    return true;
  }

  public stop(): void {
    this.active = false;
    this.isPausedState = false;
    this.masterProfileId = null;
    this.slaveProfileIds = [];
    this.slaveStatuses.clear();
    this.lastMasterUrl = null;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Close master WebSocket
    if (this.masterWs) {
      try {
        this.masterWs.close();
      } catch {}
      this.masterWs = null;
    }

    // Close all slave WebSocket connections
    for (const [, ws] of this.slaveWsCache) {
      try {
        ws.close();
      } catch {}
    }
    this.slaveWsCache.clear();
  }

  // ─── Master Browser Connection & Action Capture ───────────────────────────

  /**
   * Connects to the master browser via CDP WebSocket, enables required
   * domains, adds a JavaScript binding for action capture, and injects
   * the capture script into the page.
   */
  private async connectToMaster(): Promise<void> {
    if (!this.masterProfileId) return;

    try {
      const tabs = await this.getTabsForProfile(this.masterProfileId);
      if (!tabs || tabs.length === 0 || !tabs[0].webSocketDebuggerUrl) return;

      const masterTab = tabs[0];
      const ws = await CdpWsClient.connect(masterTab.webSocketDebuggerUrl!);
      this.masterWs = ws;

      // Enable required CDP domains
      ws.send(JSON.stringify({ id: this.nextId(), method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: this.nextId(), method: 'Page.enable' }));

      // Create a binding that the injected script can call to send actions back
      // Runtime.addBinding survives page navigations automatically
      ws.send(JSON.stringify({
        id: this.nextId(),
        method: 'Runtime.addBinding',
        params: { name: '__mahiSync' },
      }));

      // Inject capture script for all future navigations
      const captureScript = this.getMasterCaptureScript();
      ws.send(JSON.stringify({
        id: this.nextId(),
        method: 'Page.addScriptToEvaluateOnNewDocument',
        params: { source: captureScript },
      }));

      // Inject into the currently loaded page immediately
      ws.send(JSON.stringify({
        id: this.nextId(),
        method: 'Runtime.evaluate',
        params: { expression: captureScript },
      }));

      // Listen for binding calls from the injected script
      ws.onMessage = (data: string) => {
        try {
          const msg = JSON.parse(data);
          if (
            msg.method === 'Runtime.bindingCalled' &&
            msg.params?.name === '__mahiSync'
          ) {
            const action = JSON.parse(msg.params.payload);
            this.handleMasterAction(action);
          }
        } catch {}
      };
    } catch (err) {
      // Master connection failed — URL watcher still works as fallback
      try {
        logActivity(
          'SYSTEM',
          'WARNING',
          'CDP_MASTER_CONNECT_FAILED',
          `Could not connect CDP to master browser: ${err}`
        );
      } catch {}
    }
  }

  /**
   * Generates the JavaScript capture script injected into the master browser.
   * This script detects user actions (click, type, key, scroll) and sends
   * them back through the __mahiSync CDP binding.
   */
  private getMasterCaptureScript(): string {
    return `(function(){
  if(window.__mahiSyncCapture)return;
  window.__mahiSyncCapture=true;

  function send(a){try{window.__mahiSync(JSON.stringify(a))}catch(e){}}

  /* ── Click ── */
  document.addEventListener('click',function(e){
    send({
      type:'CLICK',
      payload:{
        xRatio:e.clientX/Math.max(1,window.innerWidth),
        yRatio:e.clientY/Math.max(1,window.innerHeight),
        button:e.button||0
      },
      timestamp:Date.now()
    });
  },true);

  /* ── Text Input ── */
  document.addEventListener('input',function(e){
    if(e.inputType==='insertText'&&e.data){
      send({type:'TYPE',payload:{value:e.data},timestamp:Date.now()});
    }else if(e.inputType==='deleteContentBackward'){
      send({type:'KEY',payload:{key:'Backspace'},timestamp:Date.now()});
    }
  },true);

  /* ── Special Keys ── */
  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'){
      send({type:'KEY',payload:{key:'Enter'},timestamp:Date.now()});
    }
  },true);

  /* ── Scroll (debounced 100ms) ── */
  var _st;
  window.addEventListener('scroll',function(){
    clearTimeout(_st);
    _st=setTimeout(function(){
      var maxS=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      send({type:'SCROLL',payload:{scrollYRatio:window.scrollY/maxS},timestamp:Date.now()});
    },100);
  },true);
})();`;
  }

  /**
   * Handles an action captured from the master browser and dispatches
   * it to all slave browsers via CDP.
   */
  private handleMasterAction(action: any): void {
    if (!this.active) return;

    if (action.type === 'CLICK' && action.payload) {
      this.dispatchCdpClick(
        action.payload.xRatio,
        action.payload.yRatio,
        action.payload.button || 0
      );
    } else if (action.type === 'TYPE' && action.payload) {
      this.dispatchCdpType(action.payload.value || '', false);
    } else if (action.type === 'KEY' && action.payload) {
      this.dispatchCdpKey(action.payload.key || 'Enter');
    } else if (action.type === 'SCROLL' && action.payload) {
      this.dispatchCdpScroll(action.payload.scrollYRatio || 0);
    }
  }

  // ─── Slave Browser Connections ────────────────────────────────────────────

  /**
   * Gets or creates a cached WebSocket connection to a slave browser's active tab.
   */
  private async getSlaveWs(slaveId: string): Promise<CdpWsClient | null> {
    // Check cache
    const cached = this.slaveWsCache.get(slaveId);
    if (cached && cached.readyState === 1) return cached;

    // Clean stale entry
    if (cached) {
      try { cached.close(); } catch {}
      this.slaveWsCache.delete(slaveId);
    }

    // Connect to first page tab
    try {
      const tabs = await this.getTabsForProfile(slaveId);
      if (!tabs || tabs.length === 0 || !tabs[0].webSocketDebuggerUrl) return null;

      const ws = await CdpWsClient.connect(tabs[0].webSocketDebuggerUrl);
      if (ws.readyState === 1) {
        this.slaveWsCache.set(slaveId, ws);
        return ws;
      }
    } catch {}

    return null;
  }

  // ─── CDP Tab Discovery ────────────────────────────────────────────────────

  /**
   * Fetches active tabs list from Chrome CDP endpoint via HTTP.
   */
  public async getTabsForProfile(profileId: string): Promise<CdpTabInfo[]> {
    const port = getProfileDebugPort(profileId);
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const tabs = JSON.parse(body);
            if (Array.isArray(tabs)) {
              resolve(tabs.filter((t) => t.type === 'page'));
            } else {
              resolve([]);
            }
          } catch {
            resolve([]);
          }
        });
      });

      req.on('error', () => {
        resolve([]);
      });
      req.setTimeout(800, () => {
        req.destroy();
        resolve([]);
      });
    });
  }

  // ─── URL Navigation Watcher ───────────────────────────────────────────────

  /**
   * Polls the master browser tab URL every 450ms. When the URL changes
   * (e.g. user types in omnibox, clicks a bookmark), it replicates the
   * navigation to all slave windows.
   */
  private startMasterUrlWatcher(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);

    this.pollTimer = setInterval(async () => {
      if (!this.active || !this.masterProfileId) return;

      try {
        const masterTabs = await this.getTabsForProfile(this.masterProfileId);
        if (!masterTabs || masterTabs.length === 0) return;

        const masterUrl = masterTabs[0].url;
        if (
          !masterUrl ||
          masterUrl.startsWith('chrome://newtab') ||
          masterUrl === 'about:blank'
        ) {
          return;
        }

        if (masterUrl !== this.lastMasterUrl) {
          this.lastMasterUrl = masterUrl;
          await this.replicateUrlToSlaves(masterUrl);
        }
      } catch {}
    }, 450);
  }

  // ─── Action Dispatch to Slaves ────────────────────────────────────────────

  /**
   * Navigates all slave profiles to the target URL using CDP Page.navigate.
   */
  public async replicateUrlToSlaves(targetUrl: string): Promise<void> {
    if (!this.active || this.isPausedState) return;
    if (!targetUrl || targetUrl.startsWith('chrome://')) return;

    let didMirror = false;
    for (const slaveId of this.slaveProfileIds) {
      if (slaveId === this.masterProfileId) continue;
      try {
        const ws = await this.getSlaveWs(slaveId);
        if (ws && ws.readyState === 1) {
          ws.send(
            JSON.stringify({
              id: this.nextId(),
              method: 'Page.navigate',
              params: { url: targetUrl },
            })
          );
          this.slaveStatuses.set(slaveId, {
            slaveId,
            status: 'CONNECTED',
            lastMirroredAt: new Date().toISOString(),
          });
          didMirror = true;
        } else {
          this.slaveStatuses.set(slaveId, {
            slaveId,
            status: 'DISCONNECTED',
            lastError: 'WebSocket socket closed or unavailable',
          });
        }
      } catch (err: any) {
        this.slaveStatuses.set(slaveId, {
          slaveId,
          status: 'ERROR',
          lastError: err?.message || String(err),
        });
        this.slaveWsCache.delete(slaveId);
      }
    }
    if (didMirror) {
      this.emit('action-mirrored');
    }
  }

  /**
   * Dispatches a mouse click to all slave tabs using viewport-relative
   * coordinates. Uses Runtime.evaluate to dispatch a proper DOM MouseEvent
   * at the correct position regardless of window size differences.
   */
  public async dispatchCdpClick(
    xRatio: number,
    yRatio: number,
    button: number = 0
  ): Promise<void> {
    if (!this.active || this.isPausedState) return;

    let didMirror = false;
    for (const slaveId of this.slaveProfileIds) {
      if (slaveId === this.masterProfileId) continue;
      try {
        const ws = await this.getSlaveWs(slaveId);
        if (!ws || ws.readyState !== 1) {
          this.slaveStatuses.set(slaveId, {
            slaveId,
            status: 'DISCONNECTED',
            lastError: 'WebSocket socket closed or unavailable',
          });
          continue;
        }

        ws.send(
          JSON.stringify({
            id: this.nextId(),
            method: 'Runtime.evaluate',
            params: {
              expression: `(function(){
  var x=Math.round(${xRatio}*window.innerWidth);
  var y=Math.round(${yRatio}*window.innerHeight);
  var el=document.elementFromPoint(x,y);
  if(el){
    var o={bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:${button}};
    el.dispatchEvent(new MouseEvent('mousedown',o));
    el.dispatchEvent(new MouseEvent('mouseup',o));
    el.dispatchEvent(new MouseEvent('click',o));
    if(el.matches&&el.matches('input,textarea,select,[contenteditable]'))el.focus();
  }
})()`,
            },
          })
        );
        this.slaveStatuses.set(slaveId, {
          slaveId,
          status: 'CONNECTED',
          lastMirroredAt: new Date().toISOString(),
        });
        didMirror = true;
      } catch (err: any) {
        this.slaveStatuses.set(slaveId, {
          slaveId,
          status: 'ERROR',
          lastError: err?.message || String(err),
        });
        this.slaveWsCache.delete(slaveId);
      }
    }
    if (didMirror) {
      this.emit('action-mirrored');
    }
  }

  /**
   * Dispatches text input and Enter key to all slave tabs via CDP.
   */
  public async dispatchCdpType(
    text: string,
    isEnter: boolean = false
  ): Promise<void> {
    if (!this.active || this.isPausedState) return;

    let didMirror = false;
    for (const slaveId of this.slaveProfileIds) {
      if (slaveId === this.masterProfileId) continue;
      try {
        const ws = await this.getSlaveWs(slaveId);
        if (!ws || ws.readyState !== 1) {
          this.slaveStatuses.set(slaveId, {
            slaveId,
            status: 'DISCONNECTED',
            lastError: 'WebSocket socket closed or unavailable',
          });
          continue;
        }

        if (text) {
          ws.send(
            JSON.stringify({
              id: this.nextId(),
              method: 'Input.insertText',
              params: { text },
            })
          );
        }

        if (isEnter) {
          setTimeout(() => {
            try {
              ws.send(
                JSON.stringify({
                  id: this.nextId(),
                  method: 'Input.dispatchKeyEvent',
                  params: {
                    type: 'rawKeyDown',
                    windowsVirtualKeyCode: 13,
                    nativeVirtualKeyCode: 13,
                    unmodifiedText: '\r',
                    text: '\r',
                    key: 'Enter',
                    code: 'Enter',
                  },
                })
              );
              ws.send(
                JSON.stringify({
                  id: this.nextId(),
                  method: 'Input.dispatchKeyEvent',
                  params: {
                    type: 'keyUp',
                    windowsVirtualKeyCode: 13,
                    nativeVirtualKeyCode: 13,
                    key: 'Enter',
                    code: 'Enter',
                  },
                })
              );
            } catch {}
          }, 30);
        }

        this.slaveStatuses.set(slaveId, {
          slaveId,
          status: 'CONNECTED',
          lastMirroredAt: new Date().toISOString(),
        });
        didMirror = true;
      } catch (err: any) {
        this.slaveStatuses.set(slaveId, {
          slaveId,
          status: 'ERROR',
          lastError: err?.message || String(err),
        });
        this.slaveWsCache.delete(slaveId);
      }
    }
    if (didMirror) {
      this.emit('action-mirrored');
    }
  }

  /**
   * Dispatches a keyboard event (Enter, Backspace, Tab) to all slave tabs.
   */
  public async dispatchCdpKey(key: string): Promise<void> {
    if (!this.active || this.isPausedState) return;

    const keyMap: Record<
      string,
      { keyCode: number; key: string; code: string }
    > = {
      Enter: { keyCode: 13, key: 'Enter', code: 'Enter' },
      Backspace: { keyCode: 8, key: 'Backspace', code: 'Backspace' },
      Tab: { keyCode: 9, key: 'Tab', code: 'Tab' },
    };

    const info = keyMap[key];
    if (!info) return;

    let didMirror = false;
    for (const slaveId of this.slaveProfileIds) {
      if (slaveId === this.masterProfileId) continue;
      try {
        const ws = await this.getSlaveWs(slaveId);
        if (!ws || ws.readyState !== 1) {
          this.slaveStatuses.set(slaveId, {
            slaveId,
            status: 'DISCONNECTED',
            lastError: 'WebSocket socket closed or unavailable',
          });
          continue;
        }

        ws.send(
          JSON.stringify({
            id: this.nextId(),
            method: 'Input.dispatchKeyEvent',
            params: {
              type: 'rawKeyDown',
              windowsVirtualKeyCode: info.keyCode,
              nativeVirtualKeyCode: info.keyCode,
              key: info.key,
              code: info.code,
            },
          })
        );
        ws.send(
          JSON.stringify({
            id: this.nextId(),
            method: 'Input.dispatchKeyEvent',
            params: {
              type: 'keyUp',
              windowsVirtualKeyCode: info.keyCode,
              nativeVirtualKeyCode: info.keyCode,
              key: info.key,
              code: info.code,
            },
          })
        );

        this.slaveStatuses.set(slaveId, {
          slaveId,
          status: 'CONNECTED',
          lastMirroredAt: new Date().toISOString(),
        });
        didMirror = true;
      } catch (err: any) {
        this.slaveStatuses.set(slaveId, {
          slaveId,
          status: 'ERROR',
          lastError: err?.message || String(err),
        });
        this.slaveWsCache.delete(slaveId);
      }
    }
    if (didMirror) {
      this.emit('action-mirrored');
    }
  }

  /**
   * Dispatches scroll to all slave tabs using Runtime.evaluate.
   */
  public async dispatchCdpScroll(scrollYRatio: number): Promise<void> {
    if (!this.active || this.isPausedState) return;

    let didMirror = false;
    for (const slaveId of this.slaveProfileIds) {
      if (slaveId === this.masterProfileId) continue;
      try {
        const ws = await this.getSlaveWs(slaveId);
        if (!ws || ws.readyState !== 1) {
          this.slaveStatuses.set(slaveId, {
            slaveId,
            status: 'DISCONNECTED',
            lastError: 'WebSocket socket closed or unavailable',
          });
          continue;
        }

        ws.send(
          JSON.stringify({
            id: this.nextId(),
            method: 'Runtime.evaluate',
            params: {
              expression: `window.scrollTo({top:${scrollYRatio}*(document.documentElement.scrollHeight-window.innerHeight),behavior:'smooth'})`,
            },
          })
        );

        this.slaveStatuses.set(slaveId, {
          slaveId,
          status: 'CONNECTED',
          lastMirroredAt: new Date().toISOString(),
        });
        didMirror = true;
      } catch (err: any) {
        this.slaveStatuses.set(slaveId, {
          slaveId,
          status: 'ERROR',
          lastError: err?.message || String(err),
        });
        this.slaveWsCache.delete(slaveId);
      }
    }
    if (didMirror) {
      this.emit('action-mirrored');
    }
  }
}

export const cdpSynchronizer = new CdpSynchronizer();
