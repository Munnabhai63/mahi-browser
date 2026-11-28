import net from 'node:net';
import http from 'node:http';
import { createLogger } from '../07_BACKEND/utils/logger.js';
const log = createLogger('cdp-proxy-authenticator');

function debugLog(msg: string) {
  const fn = (globalThis as any).__mahiDebugLog;
  if (fn) fn(msg);
  else log.info(msg);
}

/**
 * Finds an available TCP port on localhost for CDP connection
 */
export async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => resolve(9222));
      }
    });
  });
}

export interface CdpAuthenticatorOptions {
  port: number;
  username: string;
  password: string;
  profileId: string;
  onAuthSuccess?: () => void;
  onAuthFailed?: (error: string) => void;
}

export interface CdpSessionHandle {
  close: () => void;
}

/**
 * Connects to Chromium's Chrome DevTools Protocol (CDP) debugging endpoint
 * and intercepts all Proxy Authentication (HTTP 407) challenges via Fetch.authRequired.
 * Supplies credentials instantly without ever showing the native browser popup.
 */
export async function attachCdpProxyAuthenticator(
  options: CdpAuthenticatorOptions
): Promise<CdpSessionHandle> {
  const { port, username, password, profileId } = options;
  debugLog(`[CDP Authenticator] Initializing background authenticator for profile "${profileId}" on port ${port}...`);

  let isClosed = false;
  let ws: any = null;
  let authAttempts = 0;
  const maxAuthAttempts = 5;

  // Poll for Chromium's CDP JSON endpoint
  const getWebSocketDebuggerUrl = async (retries = 30, delayMs = 150): Promise<string> => {
    for (let i = 0; i < retries; i++) {
      if (isClosed) throw new Error('Session closed before CDP attachment');
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data && data.webSocketDebuggerUrl) {
            return data.webSocketDebuggerUrl;
          }
        }
      } catch (pollErr) {
        log.debug('Waiting for CDP /json/version endpoint in proxy authenticator', {
          port,
          err: pollErr instanceof Error ? pollErr.message : String(pollErr),
        });
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new Error(`Chromium CDP endpoint at 127.0.0.1:${port} was not reachable within timeout.`);
  };

  try {
    const wsUrl = await getWebSocketDebuggerUrl();
    debugLog(`[CDP Authenticator] Connected to Chromium CDP: ${wsUrl}`);

    const WebSocketClass = (globalThis as any).WebSocket;
    if (!WebSocketClass) {
      debugLog(`[CDP Authenticator WARNING] globalThis.WebSocket not found.`);
      return { close: () => {} };
    }

    ws = new WebSocketClass(wsUrl);
    let msgId = 1;
    const send = (method: string, params: any = {}, sessionId?: string) => {
      if (!ws || ws.readyState !== 1) return;
      const payload: any = { id: msgId++, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
    };

    ws.onopen = () => {
      debugLog(`[CDP Authenticator] WebSocket opened. Enabling Fetch.authRequired across all targets...`);
      // Auto-attach to all pages, iframes, and workers
      send('Target.setAutoAttach', {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: true,
      });

      // Enable Fetch with auth handling on root browser session
      send('Fetch.enable', { handleAuthRequests: true });
    };

    ws.onmessage = (event: any) => {
      try {
        const msg = JSON.parse(event.data);

        // When a new page/target is created, enable Fetch on that session
        if (msg.method === 'Target.attachedToTarget' && msg.params?.sessionId) {
          send('Fetch.enable', { handleAuthRequests: true }, msg.params.sessionId);
        }

        // When Chromium receives a Proxy 407 Authentication Required challenge
        if (msg.method === 'Fetch.authRequired') {
          const { requestId, authChallenge } = msg.params;
          const sessionId = msg.sessionId;

          debugLog(
            `[CDP Authenticator] Proxy Auth Challenge intercepted for "${authChallenge?.source || 'Proxy'}" (Origin: ${authChallenge?.origin || 'Unknown'})`
          );

          if (authAttempts >= maxAuthAttempts) {
            debugLog(`[CDP Authenticator ERROR] Proxy authentication failed repeatedly (${authAttempts} attempts). Canceling auth.`);
            send(
              'Fetch.continueWithAuth',
              {
                requestId,
                authChallengeResponse: { response: 'CancelAuth' },
              },
              sessionId
            );
            if (options.onAuthFailed) {
              options.onAuthFailed('Proxy authentication credentials rejected by server.');
            }
            return;
          }

          authAttempts++;

          // Supply saved proxy username and password silently
          send(
            'Fetch.continueWithAuth',
            {
              requestId,
              authChallengeResponse: {
                response: 'ProvideCredentials',
                username,
                password,
              },
            },
            sessionId
          );

          debugLog(`[CDP Authenticator] Supplied credentials silently for "${username}". No native popup will appear.`);
          if (options.onAuthSuccess) {
            options.onAuthSuccess();
          }
        }
      } catch (parseErr) {
        debugLog(`[CDP Authenticator ERROR] Failed to process CDP message: ${parseErr}`);
      }
    };

    ws.onerror = (err: any) => {
      debugLog(`[CDP Authenticator] WebSocket error: ${err?.message || err}`);
    };

    ws.onclose = () => {
      debugLog(`[CDP Authenticator] WebSocket closed for profile "${profileId}".`);
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    debugLog(`[CDP Authenticator] Could not attach CDP session: ${errMsg}`);
  }

  return {
    close: () => {
      isClosed = true;
      if (ws) {
        try {
          ws.close();
        } catch (closeErr) {
          log.debug('CDP proxy authenticator WebSocket close skipped', {
            profileId,
            err: closeErr instanceof Error ? closeErr.message : String(closeErr),
          });
        }
        ws = null;
      }
    },
  };
}
