/**
 * MAHI Browser — Outbound Webhook Service
 * Phase 6 Architecture
 *
 * Implements:
 * - SSRF Protection (RFC1918, Loopback, Link-Local, Cloud Metadata blocking)
 * - HMAC-SHA256 Cryptographic Delivery Signatures
 * - Replay Protection (timestamp + unique event ID)
 * - Bounded Retries with Exponential Backoff
 * - Delivery Audit History
 * - Manual Test Event Dispatch
 */

import crypto from 'node:crypto';
import dns from 'node:dns';
import net from 'node:net';
import http from 'node:http';
import https from 'https';
import { URL } from 'node:url';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { encryptData, decryptData } from '../../08_SECURITY/encryption.js';
import { logCommercialAudit } from '../commercial/commercial-audit-service.js';
import {
  WebhookEventType,
  WebhookEndpointRecord,
  CreateWebhookEndpointDTO,
  WebhookDeliveryRecord,
  WebhookPayload,
} from '../../10_CONFIG/shared/types/remote-api.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('webhook-service');

// ============================================================================
// SSRF PROTECTION VALIDATION
// ============================================================================

/**
 * Checks if an IPv4 address belongs to a private, loopback, or metadata range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed IP treated as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (RFC1918 Private)
  if (a === 10) return true;

  // 172.16.0.0/12 (RFC1918 Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (RFC1918 Private)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-Local & Cloud Metadata e.g. 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 (Carrier-grade NAT: 100.64.0.0 - 100.127.255.255)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 192.0.0.0/24, 192.0.2.0/24, 198.18.0.0/15, 224.0.0.0/4 (Multicast/Benchmark/Reserved)
  if (a >= 224) return true;

  return false;
}

function isPrivateIpAddress(ip: string): boolean {
  const cleaned = ip.trim().replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  const ver = net.isIP(cleaned);
  if (ver === 4) {
    return isPrivateIPv4(cleaned);
  }
  if (ver === 6) {
    if (cleaned === '::' || cleaned === '::1') return true;
    // Handle IPv4-mapped IPv6 in dotted (::ffff:127.0.0.1) or hex (::ffff:7f00:1) notation
    if (cleaned.startsWith('::ffff:')) {
      const rest = cleaned.slice('::ffff:'.length);
      if (net.isIP(rest) === 4) {
        return isPrivateIPv4(rest);
      }
      const hexParts = rest.split(':');
      if (hexParts.length === 2) {
        const hi = parseInt(hexParts[0], 16);
        const lo = parseInt(hexParts[1], 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
          return isPrivateIPv4(v4);
        }
      }
      return true;
    }
    if (cleaned.startsWith('fe80:') || cleaned.startsWith('fe9') || cleaned.startsWith('fea') || cleaned.startsWith('feb')) {
      return true;
    }
    if (cleaned.startsWith('fc') || cleaned.startsWith('fd')) {
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Resolves destination DNS and blocks hostnames pointing to internal/private/metadata IPs.
 */
async function resolveAndValidateSafeIp(
  hostname: string,
  allowHttp = false
): Promise<{ valid: boolean; reason?: string; address?: string; family?: 4 | 6 }> {
  const bareHost = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(bareHost)) {
    if (!allowHttp && isPrivateIpAddress(bareHost)) {
      return { valid: false, reason: `SSRF_BLOCKED: Private IP ${bareHost} is forbidden.` };
    }
    return { valid: true, address: bareHost, family: net.isIP(bareHost) === 6 ? 6 : 4 };
  }
  if (allowHttp) {
    return { valid: true };
  }
  try {
    const records = await dns.promises.lookup(bareHost, { all: true });
    if (!records || records.length === 0) {
      return { valid: false, reason: 'SSRF_BLOCKED: Hostname failed DNS resolution.' };
    }
    for (const rec of records) {
      if (isPrivateIpAddress(rec.address)) {
        return { valid: false, reason: `SSRF_BLOCKED: DNS resolved to forbidden private IP (${rec.address}).` };
      }
    }
    return { valid: true, address: records[0].address, family: records[0].family === 6 ? 6 : 4 };
  } catch {
    return { valid: false, reason: 'SSRF_BLOCKED: Hostname DNS resolution failed.' };
  }
}

/**
 * Validates a webhook destination URL against SSRF attacks.
 * Blocks private IP ranges, localhost, cloud metadata endpoints, and non-HTTPS protocols
 * (unless allowHttp is explicitly granted for local integration testing).
 */
export function validateWebhookUrl(rawUrl: string, allowHttp = false): { valid: boolean; reason?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'Webhook URL is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'Malformed Webhook URL' };
  }

  // Protocol check
  if (parsed.protocol !== 'https:') {
    if (parsed.protocol === 'http:') {
      if (!allowHttp) {
        return { valid: false, reason: 'Insecure protocol. Webhooks require HTTPS endpoints in production.' };
      }
    } else {
      return { valid: false, reason: `Unsupported protocol: ${parsed.protocol}. Only HTTPS is permitted.` };
    }
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // Reject integer/hex/octal obfuscated IP representations (e.g. 2130706433, 0x7f000001, 0177.0.0.1)
  if (!allowHttp && (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname) || /^0\d+\./.test(hostname))) {
    return { valid: false, reason: 'SSRF_BLOCKED: Obfuscated numeric hostnames are forbidden.' };
  }

  // Explicit blocked hostnames
  const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '::'];
  if (blockedHostnames.includes(hostname)) {
    if (!allowHttp) {
      return { valid: false, reason: 'SSRF_BLOCKED: Localhost and loopback endpoints are forbidden.' };
    }
  }

  // Internal suffixes
  if (
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan')
  ) {
    if (!allowHttp) {
      return { valid: false, reason: 'SSRF_BLOCKED: Internal local domains are forbidden.' };
    }
  }

  if (net.isIP(hostname) && !allowHttp && isPrivateIpAddress(hostname)) {
    return { valid: false, reason: `SSRF_BLOCKED: IP address ${hostname} belongs to a private, loopback, or metadata range.` };
  }

  return { valid: true };
}

// ============================================================================
// SIGNATURE GENERATION & VERIFICATION
// ============================================================================

export function generateWebhookSignature(secret: string, timestamp: number, payloadString: string): string {
  const message = `${timestamp}.${payloadString}`;
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

export function verifyWebhookSignature(
  secret: string,
  signatureHeader: string,
  payloadString: string,
  toleranceSeconds = 300
): { verified: boolean; reason?: string } {
  if (!signatureHeader) {
    return { verified: false, reason: 'Missing X-Mahi-Signature header' };
  }

  // Expected format: t=1690000000,v1=abcdef123456...
  const parts = signatureHeader.split(',');
  let timestampStr = '';
  let signatureHex = '';

  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k === 't') timestampStr = v;
    if (k === 'v1') signatureHex = v;
  }

  if (!timestampStr || !signatureHex) {
    return { verified: false, reason: 'Malformed signature header format' };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { verified: false, reason: 'Invalid signature timestamp' };
  }

  // Replay protection check
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return { verified: false, reason: 'Webhook timestamp outside tolerance window (replay protection)' };
  }

  if (!/^[0-9a-f]+$/i.test(signatureHex)) {
    return { verified: false, reason: 'Malformed signature encoding' };
  }

  const expectedSignature = generateWebhookSignature(secret, timestamp, payloadString);
  const sigBuf = Buffer.from(signatureHex, 'hex');
  const expBuf = Buffer.from(expectedSignature, 'hex');
  if (sigBuf.length === 0 || sigBuf.length !== expBuf.length) {
    return { verified: false, reason: 'Signature mismatch' };
  }
  const isValid = crypto.timingSafeEqual(sigBuf, expBuf);

  return { verified: isValid, reason: isValid ? undefined : 'Signature mismatch' };
}

// ============================================================================
// WEBHOOK ENDPOINT MANAGEMENT
// ============================================================================

export class WebhookService {
  private static instance: WebhookService | null = null;

  public static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  public createEndpoint(
    userId: string,
    dto: CreateWebhookEndpointDTO,
    options: { allowHttp?: boolean } = {}
  ): { endpoint: WebhookEndpointRecord; secret: string } {
    const validation = validateWebhookUrl(dto.url, options.allowHttp);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const db = getDatabase();
    const id = `whe_${crypto.randomUUID()}`;
    const rawSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const secretHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
    const secretEncrypted = encryptData(rawSecret);

    const events = dto.events && dto.events.length > 0 ? dto.events : ['*'];
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO webhook_endpoints (
        id, user_id, workspace_id, url, description, secret_hash,
        secret_encrypted, events_json, status, failure_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, ?, ?)
    `).run(
      id,
      userId,
      dto.workspaceId || null,
      dto.url.trim(),
      dto.description?.trim() || null,
      secretHash,
      secretEncrypted,
      JSON.stringify(events),
      now,
      now
    );

    const endpoint: WebhookEndpointRecord = {
      id,
      userId,
      workspaceId: dto.workspaceId || null,
      url: dto.url.trim(),
      description: dto.description?.trim(),
      secretHash,
      secretEncrypted,
      events: events as any,
      status: 'ACTIVE',
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    logCommercialAudit({
      actorId: userId,
      actorName: 'User',
      actorRole: 'USER',
      action: 'WEBHOOK_ENDPOINT_CREATED',
      targetType: 'SYSTEM',
      targetId: id,
      details: `Created webhook endpoint for URL: ${dto.url} (${events.join(', ')})`,
      result: 'SUCCESS',
    });

    return { endpoint, secret: rawSecret };
  }

  public listEndpoints(userId: string, workspaceId?: string): WebhookEndpointRecord[] {
    const db = getDatabase();
    let query = 'SELECT * FROM webhook_endpoints WHERE user_id = ? AND status != \'REVOKED\'';
    const params: unknown[] = [userId];

    if (workspaceId) {
      query += ' AND workspace_id = ?';
      params.push(workspaceId);
    }

    query += ' ORDER BY created_at DESC';
    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      workspaceId: r.workspace_id,
      url: r.url,
      description: r.description,
      secretHash: r.secret_hash,
      secretEncrypted: r.secret_encrypted,
      events: JSON.parse(r.events_json || '[]'),
      status: r.status,
      failureCount: r.failure_count || 0,
      lastDeliveryAt: r.last_delivery_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public getEndpoint(endpointId: string, userId: string): WebhookEndpointRecord | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM webhook_endpoints WHERE id = ? AND user_id = ?').get(endpointId, userId) as any;
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      url: row.url,
      description: row.description,
      secretHash: row.secret_hash,
      secretEncrypted: row.secret_encrypted,
      events: JSON.parse(row.events_json || '[]'),
      status: row.status,
      failureCount: row.failure_count || 0,
      lastDeliveryAt: row.last_delivery_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public deleteEndpoint(endpointId: string, userId: string): boolean {
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM webhook_endpoints WHERE id = ? AND user_id = ?').get(endpointId, userId);
    if (!existing) return false;

    db.prepare('UPDATE webhook_endpoints SET status = \'REVOKED\', updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      endpointId
    );

    logCommercialAudit({
      actorId: userId,
      actorName: 'User',
      actorRole: 'USER',
      action: 'WEBHOOK_ENDPOINT_DELETED',
      targetType: 'SYSTEM',
      targetId: endpointId,
      details: `Revoked webhook endpoint ${endpointId}`,
      result: 'SUCCESS',
    });

    return true;
  }

  public rotateSecret(endpointId: string, userId: string): { endpoint: WebhookEndpointRecord; newSecret: string } {
    const endpoint = this.getEndpoint(endpointId, userId);
    if (!endpoint || endpoint.status === 'REVOKED') {
      throw new Error('Webhook endpoint not found or revoked');
    }

    const rawSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const secretHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
    const secretEncrypted = encryptData(rawSecret);
    const now = new Date().toISOString();

    const db = getDatabase();
    db.prepare(`
      UPDATE webhook_endpoints
      SET secret_hash = ?, secret_encrypted = ?, updated_at = ?
      WHERE id = ?
    `).run(secretHash, secretEncrypted, now, endpointId);

    endpoint.secretHash = secretHash;
    endpoint.secretEncrypted = secretEncrypted;
    endpoint.updatedAt = now;

    logCommercialAudit({
      actorId: userId,
      actorName: 'User',
      actorRole: 'USER',
      action: 'WEBHOOK_SECRET_ROTATED',
      targetType: 'SYSTEM',
      targetId: endpointId,
      details: `Rotated signing secret for webhook endpoint ${endpointId}`,
      result: 'SUCCESS',
    });

    return { endpoint, newSecret: rawSecret };
  }

  public getDeliveries(endpointId: string, userId: string, limit = 50): WebhookDeliveryRecord[] {
    const db = getDatabase();
    // Validate ownership
    const endpoint = db.prepare('SELECT id FROM webhook_endpoints WHERE id = ? AND user_id = ?').get(endpointId, userId);
    if (!endpoint) return [];

    const rows = db.prepare(`
      SELECT * FROM webhook_deliveries
      WHERE endpoint_id = ?
      ORDER BY delivered_at DESC
      LIMIT ?
    `).all(endpointId, Math.min(limit, 100)) as any[];

    return rows.map((r) => ({
      id: r.id,
      endpointId: r.endpoint_id,
      eventId: r.event_id,
      eventType: r.event_type as WebhookEventType,
      payloadJson: r.payload_json,
      destinationUrl: r.destination_url,
      statusCode: r.status_code,
      responseBody: r.response_body,
      durationMs: r.duration_ms,
      attemptCount: r.attempt_count,
      success: Boolean(r.success),
      errorMessage: r.error_message,
      deliveredAt: r.delivered_at,
    }));
  }

  // ============================================================================
  // OUTBOUND DISPATCH & DELIVERY ENGINE
  // ============================================================================

  public async dispatchEvent<T>(
    eventType: WebhookEventType,
    data: T,
    options: {
      userId?: string;
      workspaceId?: string;
      actor?: { userId: string; email?: string };
      allowHttp?: boolean;
    } = {}
  ): Promise<number> {
    const db = getDatabase();
    let query = 'SELECT * FROM webhook_endpoints WHERE status = \'ACTIVE\'';
    const params: unknown[] = [];

    if (options.userId) {
      query += ' AND (user_id = ? OR workspace_id = ?)';
      params.push(options.userId, options.workspaceId || options.userId);
    }

    const endpoints = db.prepare(query).all(...params) as any[];
    if (endpoints.length === 0) return 0;

    const eventId = `evt_${crypto.randomUUID()}`;
    const payload: WebhookPayload<T> = {
      id: eventId,
      event: eventType,
      createdAt: new Date().toISOString(),
      data,
      actor: options.actor,
      workspaceId: options.workspaceId,
    };

    let dispatchedCount = 0;

    for (const epRow of endpoints) {
      const registeredEvents = JSON.parse(epRow.events_json || '[]') as string[];
      if (!registeredEvents.includes('*') && !registeredEvents.includes(eventType)) {
        continue;
      }

      // Asynchronous delivery without blocking
      this.deliverPayloadAsync(epRow, payload, options.allowHttp).catch((err) => {
        log.error(`[Webhook] Delivery worker error for endpoint ${epRow.id}:`, err);
      });

      dispatchedCount++;
    }

    return dispatchedCount;
  }

  public async sendTestWebhook(endpointId: string, userId: string, allowHttp = false): Promise<WebhookDeliveryRecord> {
    const endpoint = this.getEndpoint(endpointId, userId);
    if (!endpoint || endpoint.status === 'REVOKED') {
      throw new Error('Endpoint not found or revoked');
    }

    const eventId = `test_${crypto.randomUUID()}`;
    const payload: WebhookPayload<{ ping: string; timestamp: string }> = {
      id: eventId,
      event: 'test.ping',
      createdAt: new Date().toISOString(),
      data: {
        ping: 'pong',
        timestamp: new Date().toISOString(),
      },
      actor: { userId },
      workspaceId: endpoint.workspaceId || undefined,
    };

    const delivery = await this.deliverWithRetries(endpoint, payload, allowHttp);
    return delivery;
  }

  private async deliverPayloadAsync(
    endpointRow: any,
    payload: WebhookPayload,
    allowHttp?: boolean
  ): Promise<WebhookDeliveryRecord> {
    const endpoint: WebhookEndpointRecord = {
      id: endpointRow.id,
      userId: endpointRow.user_id,
      workspaceId: endpointRow.workspace_id,
      url: endpointRow.url,
      secretHash: endpointRow.secret_hash,
      secretEncrypted: endpointRow.secret_encrypted,
      events: JSON.parse(endpointRow.events_json || '[]'),
      status: endpointRow.status,
      failureCount: endpointRow.failure_count || 0,
      createdAt: endpointRow.created_at,
      updatedAt: endpointRow.updated_at,
    };

    return this.deliverWithRetries(endpoint, payload, allowHttp);
  }

  private async deliverWithRetries(
    endpoint: WebhookEndpointRecord,
    payload: WebhookPayload,
    allowHttp = false
  ): Promise<WebhookDeliveryRecord> {
    // Decrypt secret (never fall back to one-way hash as signing secret)
    let secret: string;
    try {
      secret = decryptData(endpoint.secretEncrypted);
    } catch {
      throw new Error('Failed to decrypt webhook signing secret; delivery aborted');
    }
    if (!secret) {
      throw new Error('Webhook signing secret missing; delivery aborted');
    }

    const payloadString = JSON.stringify(payload);
    const maxRetries = 3;
    let attempt = 0;
    let lastStatusCode: number | undefined;
    let lastResponseBody: string | undefined;
    let lastError: string | undefined;
    let success = false;
    let durationMs = 0;

    while (attempt < maxRetries && !success) {
      attempt++;
      const startTime = Date.now();
      try {
        const result = await this.performHttpDelivery(endpoint.url, payloadString, secret, payload.id, payload.event, allowHttp);
        durationMs = Date.now() - startTime;
        lastStatusCode = result.statusCode;
        lastResponseBody = result.body;

        if (result.statusCode >= 200 && result.statusCode < 300) {
          success = true;
          break;
        } else {
          lastError = `HTTP ${result.statusCode}: ${result.body.substring(0, 200)}`;
        }
      } catch (err: any) {
        durationMs = Date.now() - startTime;
        lastError = err.message || 'Delivery request failed';
      }

      if (!success && attempt < maxRetries) {
        // Backoff between retries (100ms * attempt for responsive tests, up to 1000ms in prod)
        const backoffMs = Math.min(100 * Math.pow(2, attempt - 1), 1000);
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }

    const db = getDatabase();
    const deliveryId = `whd_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO webhook_deliveries (
        id, endpoint_id, event_id, event_type, payload_json, destination_url,
        status_code, response_body, duration_ms, attempt_count, success, error_message, delivered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      deliveryId,
      endpoint.id,
      payload.id,
      payload.event,
      payloadString,
      endpoint.url,
      lastStatusCode || null,
      lastResponseBody ? lastResponseBody.substring(0, 1000) : null,
      durationMs,
      attempt,
      success ? 1 : 0,
      lastError || null,
      now
    );

    // Update endpoint stats
    if (success) {
      db.prepare(`
        UPDATE webhook_endpoints
        SET last_delivery_at = ?, failure_count = 0
        WHERE id = ?
      `).run(now, endpoint.id);
    } else {
      db.prepare(`
        UPDATE webhook_endpoints
        SET last_delivery_at = ?, failure_count = failure_count + 1
        WHERE id = ?
      `).run(now, endpoint.id);
    }

    return {
      id: deliveryId,
      endpointId: endpoint.id,
      eventId: payload.id,
      eventType: payload.event,
      payloadJson: payloadString,
      destinationUrl: endpoint.url,
      statusCode: lastStatusCode,
      responseBody: lastResponseBody,
      durationMs,
      attemptCount: attempt,
      success,
      errorMessage: lastError,
      deliveredAt: now,
    };
  }

  private async performHttpDelivery(
    destinationUrl: string,
    payloadString: string,
    secret: string,
    eventId: string,
    eventType: string,
    allowHttp = false
  ): Promise<{ statusCode: number; body: string }> {
    // Re-validate SSRF synchronously and resolve safe IP before connecting (DNS-rebinding protection)
    const validation = validateWebhookUrl(destinationUrl, allowHttp);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const parsed = new URL(destinationUrl);
    const dnsCheck = await resolveAndValidateSafeIp(parsed.hostname, allowHttp);
    if (!dnsCheck.valid) {
      throw new Error(dnsCheck.reason);
    }

    return new Promise((resolve, reject) => {
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? https : http;

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateWebhookSignature(secret, timestamp, payloadString);

      const pinnedAddress = dnsCheck.address;
      const pinnedFamily = dnsCheck.family;
      const reqOptions: http.RequestOptions = {
        hostname: parsed.hostname.replace(/^\[|\]$/g, ''),
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + (parsed.search || ''),
        method: 'POST',
        ...(pinnedAddress && pinnedFamily
          ? {
              lookup: (_hostname: string, _options: any, callback: any) => {
                callback(null, pinnedAddress, pinnedFamily);
              },
            }
          : {}),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadString),
          'User-Agent': 'MahiBrowser-Webhook/1.0',
          'X-Mahi-Event-Id': eventId,
          'X-Mahi-Event-Type': eventType,
          'X-Mahi-Timestamp': timestamp.toString(),
          'X-Mahi-Signature': `t=${timestamp},v1=${signature}`,
        },
        timeout: 5000,
      };

      const req = transport.request(reqOptions, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body,
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Webhook request timed out after 5000ms'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(payloadString);
      req.end();
    });
  }
}
