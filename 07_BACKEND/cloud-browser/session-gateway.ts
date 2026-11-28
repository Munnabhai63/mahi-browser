/**
 * MAHI Browser — Interactive Cloud Session Streaming Gateway
 * Phase 10 Architecture
 *
 * Responsibilities:
 * - CDP Screencast bridge (`Page.startScreencast`, `Page.screencastFrameAck`)
 * - Bidirectional remote input forwarding (Mouse clicks, move, wheel, keyboard typing, navigation)
 * - Cryptographically signed, short-lived stream token verification
 * - Client connection lifecycle & 60-second reconnect grace period
 * - Zero surveillance: Frames delivered strictly in memory to authenticated subscribers
 */

import http from 'node:http';
import crypto from 'node:crypto';
import type {
  CloudClientAction,
  CloudServerMessage,
  CloudStreamFrame,
} from '../../10_CONFIG/shared/types/cloud-browser.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('cloud-session-gateway');

export interface StreamClientSubscriber {
  id: string;
  userId: string;
  sessionId: string;
  send: (msg: CloudServerMessage) => void;
  close: () => void;
}

export class SessionGateway {
  private static instance: SessionGateway;
  private activeStreams = new Map<
    string,
    {
      sessionId: string;
      cdpPort: number;
      ws: WebSocket | null;
      subscribers: Set<StreamClientSubscriber>;
      lastFrame?: CloudStreamFrame;
      lastActivityAt: number;
      reconnectGraceTimer?: NodeJS.Timeout;
    }
  >();

  private tokenSecret = crypto.randomBytes(32).toString('hex');

  private constructor() {}

  public static getInstance(): SessionGateway {
    if (!SessionGateway.instance) {
      SessionGateway.instance = new SessionGateway();
    }
    return SessionGateway.instance;
  }

  /**
   * Generates a tamper-proof short-lived token for accessing the stream gateway.
   */
  public createStreamToken(sessionId: string, userId: string, ttlSeconds = 300): string {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const payload = `${sessionId}:${userId}:${expiresAt}`;
    const signature = crypto.createHmac('sha256', this.tokenSecret).update(payload).digest('hex');
    return Buffer.from(JSON.stringify({ sessionId, userId, expiresAt, sig: signature })).toString('base64url');
  }

  /**
   * Validates a stream token against session and user claims.
   */
  public verifyStreamToken(
    token: string,
    expectedSessionId: string,
    expectedUserId: string
  ): boolean {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
      if (decoded.sessionId !== expectedSessionId || decoded.userId !== expectedUserId) {
        return false;
      }
      if (Date.now() > decoded.expiresAt) {
        return false;
      }
      const payload = `${decoded.sessionId}:${decoded.userId}:${decoded.expiresAt}`;
      const expectedSig = crypto.createHmac('sha256', this.tokenSecret).update(payload).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(decoded.sig), Buffer.from(expectedSig));
    } catch {
      return false;
    }
  }

  /**
   * Initializes the CDP screencast bridge for a cloud worker session.
   */
  public async attachSession(sessionId: string, cdpPort: number): Promise<void> {
    if (this.activeStreams.has(sessionId)) {
      return;
    }

    // 1. Discover target page debugger URL via CDP JSON API
    const pageTarget = await this.resolvePageTarget(cdpPort);
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error(`CDP_TARGET_ERROR: Could not find inspectable page target on port ${cdpPort}`);
    }

    const state = {
      sessionId,
      cdpPort,
      ws: null as WebSocket | null,
      subscribers: new Set<StreamClientSubscriber>(),
      lastFrame: undefined as CloudStreamFrame | undefined,
      lastActivityAt: Date.now(),
      reconnectGraceTimer: undefined as NodeJS.Timeout | undefined,
    };
    this.activeStreams.set(sessionId, state);

    // 2. Connect via native WebSocket to Chromium CDP
    let cdpWs: WebSocket;
    try {
      cdpWs = new WebSocket(pageTarget.webSocketDebuggerUrl);
    } catch (wsErr: unknown) {
      this.activeStreams.delete(sessionId);
      throw new Error(`CDP_WS_CONNECT_FAILED: ${wsErr instanceof Error ? wsErr.message : String(wsErr)}`);
    }

    state.ws = cdpWs;

    let cdpMsgId = 1;
    const sendCdp = (method: string, params: Record<string, unknown> = {}) => {
      if (cdpWs.readyState === WebSocket.OPEN) {
        cdpWs.send(JSON.stringify({ id: cdpMsgId++, method, params }));
      }
    };

    cdpWs.addEventListener('open', () => {
      sendCdp('Page.enable');
      sendCdp('Page.startScreencast', {
        format: 'jpeg',
        quality: 75,
        maxWidth: 1280,
        maxHeight: 800,
        everyNthFrame: 1,
      });
    });

    cdpWs.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data.toString());
        if (msg.method === 'Page.screencastFrame') {
          const { data, metadata, sessionId: screencastSessionId } = msg.params;

          // Acknowledge frame to Chromium so it sends subsequent frames
          sendCdp('Page.screencastFrameAck', { sessionId: screencastSessionId });

          const frameMessage: CloudStreamFrame = {
            type: 'frame',
            data,
            metadata: {
              offsetTop: metadata?.offsetTop || 0,
              pageScaleFactor: metadata?.pageScaleFactor || 1,
              deviceWidth: metadata?.deviceWidth || 1280,
              deviceHeight: metadata?.deviceHeight || 800,
              scrollOffsetX: metadata?.scrollOffsetX || 0,
              scrollOffsetY: metadata?.scrollOffsetY || 0,
              timestamp: metadata?.timestamp || Date.now(),
            },
          };

          state.lastFrame = frameMessage;

          // Fan out frame to connected subscribers
          for (const sub of state.subscribers) {
            try {
              sub.send(frameMessage);
            } catch (sendErr) {
              log.debug('Failed pushing screencast frame to subscriber', {
                sessionId,
                subscriberId: sub.id,
                err: sendErr instanceof Error ? sendErr.message : String(sendErr),
              });
            }
          }
        }
      } catch (msgErr) {
        log.debug('Ignored malformed CDP screencast message', {
          sessionId,
          err: msgErr instanceof Error ? msgErr.message : String(msgErr),
        });
      }
    });

    cdpWs.addEventListener('close', () => {
      // Broadcast close if still active
      for (const sub of state.subscribers) {
        sub.send({ type: 'status', state: 'STOPPING', message: 'Chromium stream closed.' });
      }
    });
  }

  /**
   * Queries the Chromium HTTP endpoint to get the active tab's debugger URL.
   */
  private async resolvePageTarget(port: number): Promise<{ type?: string; webSocketDebuggerUrl?: string } | null> {
    for (let i = 0; i < 20; i++) {
      const targets = await new Promise<Array<{ type?: string; webSocketDebuggerUrl?: string }>>((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/json/list`, { timeout: 1000 }, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data) as Array<{ type?: string; webSocketDebuggerUrl?: string }>;
              resolve(Array.isArray(parsed) ? parsed : []);
            } catch {
              resolve([]);
            }
          });
        });
        req.on('error', () => resolve([]));
      });

      const page = targets.find((t) => t.type === 'page');
      if (page) return page;
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }

  /**
   * Registers a client subscriber for interactive screencast reception.
   */
  public subscribeClient(subscriber: StreamClientSubscriber): () => void {
    const stream = this.activeStreams.get(subscriber.sessionId);
    if (!stream) {
      throw new Error(`STREAM_NOT_FOUND: Active stream for session ${subscriber.sessionId} not found.`);
    }

    // Cancel reconnect grace timer if running
    if (stream.reconnectGraceTimer) {
      clearTimeout(stream.reconnectGraceTimer);
      stream.reconnectGraceTimer = undefined;
    }

    stream.subscribers.add(subscriber);

    // Immediately send the latest frame if available so client renders without delay
    if (stream.lastFrame) {
      subscriber.send(stream.lastFrame);
    }

    return () => {
      stream.subscribers.delete(subscriber);
      if (stream.subscribers.size === 0) {
        // Start 60s reconnect grace timer
        stream.reconnectGraceTimer = setTimeout(() => {
          // If no client reconnects within 60s, stream remains in idle state
        }, 60000);
      }
    };
  }

  /**
   * Dispatches client interactive input action (mouse, keyboard, scroll, navigation) to Chromium.
   */
  public dispatchAction(sessionId: string, action: CloudClientAction): void {
    const stream = this.activeStreams.get(sessionId);
    if (stream?.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    stream.lastActivityAt = Date.now();

    const send = (method: string, params: Record<string, unknown> = {}) => {
      stream.ws?.send(JSON.stringify({ id: Math.floor(Math.random() * 1000000), method, params }));
    };

    switch (action.type) {
      case 'mouseClick': {
        const btn = action.button || 'left';
        send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: action.x,
          y: action.y,
          button: btn,
          clickCount: action.clickCount || 1,
        });
        send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: action.x,
          y: action.y,
          button: btn,
          clickCount: action.clickCount || 1,
        });
        break;
      }

      case 'mouseMove': {
        send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: action.x,
          y: action.y,
        });
        break;
      }

      case 'mouseWheel': {
        send('Input.dispatchMouseEvent', {
          type: 'mouseWheel',
          x: action.x,
          y: action.y,
          deltaX: action.deltaX,
          deltaY: action.deltaY,
        });
        break;
      }

      case 'keyDown': {
        send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: action.key,
          code: action.code,
          text: action.text || (action.key.length === 1 ? action.key : undefined),
        });
        break;
      }

      case 'keyUp': {
        send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: action.key,
          code: action.code,
        });
        break;
      }

      case 'navigate': {
        if (action.url) {
          send('Page.navigate', { url: action.url });
        }
        break;
      }

      case 'reload': {
        send('Page.reload');
        break;
      }

      case 'goBack': {
        send('Page.navigateToHistoryEntry', { entryId: -1 });
        break;
      }

      case 'goForward': {
        send('Page.navigateToHistoryEntry', { entryId: 1 });
        break;
      }

      case 'setViewport': {
        send('Emulation.setDeviceMetricsOverride', {
          width: action.width,
          height: action.height,
          deviceScaleFactor: action.deviceScaleFactor || 1,
          mobile: false,
        });
        break;
      }
    }
  }

  /**
   * Closes the active stream and unsubscribes all listeners.
   */
  public detachSession(sessionId: string): void {
    const stream = this.activeStreams.get(sessionId);
    if (!stream) return;

    if (stream.reconnectGraceTimer) {
      clearTimeout(stream.reconnectGraceTimer);
    }

    try {
      if (stream.ws && stream.ws.readyState === WebSocket.OPEN) {
        stream.ws.close();
      }
    } catch (wsErr) {
      log.debug('CDP WebSocket close skipped during detachSession', {
        sessionId,
        err: wsErr instanceof Error ? wsErr.message : String(wsErr),
      });
    }

    for (const sub of stream.subscribers) {
      try {
        sub.close();
      } catch (subErr) {
        log.debug('Subscriber close skipped during detachSession', {
          sessionId,
          subscriberId: sub.id,
          err: subErr instanceof Error ? subErr.message : String(subErr),
        });
      }
    }

    this.activeStreams.delete(sessionId);
  }

  /**
   * Gets the last activity timestamp for idle timeout calculation.
   */
  public getLastActivity(sessionId: string): number {
    return this.activeStreams.get(sessionId)?.lastActivityAt || Date.now();
  }
}

export const sessionGateway = SessionGateway.getInstance();
