/**
 * Native Fastify Route Adapter
 *
 * Bridges Node.js `ServerResponse`-style domain routers into Fastify's native
 * `FastifyReply` lifecycle WITHOUT calling `reply.hijack()`.
 * Supports buffered JSON/HTML/binary responses, empty 204/302 responses,
 * piped file streams (`Readable.pipe(res)`), and live SSE streams (`res.write(...)`).
 */

import type http from 'node:http';
import crypto from 'node:crypto';
import { Writable, PassThrough } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { resolveTrustedClientIp } from '../utils/http-security.js';
import { toSafeErrorResponse } from '../utils/app-error.js';
import { runWithLogContext } from '../utils/logger.js';

export type CommercialDomainHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  method: string,
  parsedUrl: URL,
  routePath: string,
  clientIp: string
) => Promise<boolean>;

export type HttpDispatchHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  parsedUrl: URL
) => Promise<boolean>;

type BridgeOutcome =
  | { kind: 'buffered'; statusCode: number; body: Buffer | string | undefined }
  | { kind: 'stream'; statusCode: number; stream: PassThrough }
  | { kind: 'unhandled' };

export interface RawBridgeRequest extends http.IncomingMessage {
  body?: unknown;
  rawBuffer?: Buffer;
}

class FastifyResponseBridge extends Writable {
  public statusCode = 200;
  public statusMessage = '';
  public headersSent = false;
  public __req: http.IncomingMessage;

  private readonly reply: FastifyReply;
  private readonly rawReq: http.IncomingMessage;
  private readonly bufferedChunks: Buffer[] = [];
  private passthrough: PassThrough | null = null;
  private endInvoked = false;
  private settled = false;
  private resolveOutcome!: (outcome: BridgeOutcome) => void;
  public readonly outcomePromise: Promise<BridgeOutcome>;

  constructor(request: FastifyRequest, reply: FastifyReply) {
    super();
    this.reply = reply;
    this.rawReq = request.raw;
    this.__req = request.raw;
    this.outcomePromise = new Promise<BridgeOutcome>((resolve) => {
      this.resolveOutcome = resolve;
    });
  }

  public setHeader(name: string, value: number | string | readonly string[]): this {
    if (!this.headersSent) {
      this.reply.header(name, value as Parameters<FastifyReply['header']>[1]);
    }
    return this;
  }

  public getHeader(name: string): number | string | string[] | undefined {
    return this.reply.getHeader(name) as number | string | string[] | undefined;
  }

  public hasHeader(name: string): boolean {
    return this.reply.hasHeader(name);
  }

  public getHeaders(): Record<string, number | string | string[] | undefined> {
    return this.reply.getHeaders() as Record<string, number | string | string[] | undefined>;
  }

  public removeHeader(name: string): void {
    if (!this.headersSent) {
      this.reply.removeHeader(name);
    }
  }

  public writeHead(
    statusCode: number,
    statusMessageOrHeaders?: string | http.OutgoingHttpHeaders | http.OutgoingHttpHeader[],
    maybeHeaders?: http.OutgoingHttpHeaders | http.OutgoingHttpHeader[]
  ): this {
    this.statusCode = statusCode;
    const headersObj =
      typeof statusMessageOrHeaders === 'object' && statusMessageOrHeaders !== null
        ? statusMessageOrHeaders
        : typeof maybeHeaders === 'object' && maybeHeaders !== null
        ? maybeHeaders
        : undefined;

    if (typeof statusMessageOrHeaders === 'string') {
      this.statusMessage = statusMessageOrHeaders;
    }

    if (headersObj && !Array.isArray(headersObj)) {
      for (const [k, v] of Object.entries(headersObj)) {
        if (v !== undefined) {
          this.reply.header(k, v as Parameters<FastifyReply['header']>[1]);
        }
      }
    }

    this.headersSent = true;
    return this;
  }

  override end(cb?: () => void): this;
  override end(chunk: unknown, cb?: () => void): this;
  override end(chunk: unknown, encoding: BufferEncoding, cb?: () => void): this;
  override end(chunk?: unknown, encodingOrCb?: BufferEncoding | (() => void), cb?: () => void): this {
    this.endInvoked = true;
    if (typeof chunk === 'function') {
      return super.end(chunk);
    }
    if (typeof encodingOrCb === 'function') {
      return super.end(chunk, encodingOrCb);
    }
    if (encodingOrCb !== undefined) {
      return super.end(chunk, encodingOrCb, cb);
    }
    return super.end(chunk);
  }

  private ensureStreamStarted(): PassThrough {
    if (!this.passthrough) {
      this.passthrough = new PassThrough();
      this.headersSent = true;

      this.rawReq.on('close', () => {
        if (this.passthrough && !this.passthrough.destroyed) {
          this.passthrough.end();
        }
      });

      if (!this.settled) {
        this.settled = true;
        this.resolveOutcome({
          kind: 'stream',
          statusCode: this.statusCode,
          stream: this.passthrough,
        });
      }
    }
    return this.passthrough;
  }

  override _write(
    chunk: unknown,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : chunk instanceof Uint8Array
        ? Buffer.from(chunk)
        : Buffer.from(String(chunk), encoding);
    const contentType = String(this.reply.getHeader('content-type') || '').toLowerCase();

    // Only enter PassThrough streaming when callers use res.write() directly (SSE or piped streams)
    // without having called res.end() for a single-shot buffered payload.
    if (
      this.passthrough ||
      (!this.endInvoked && !this.writableEnded) ||
      contentType.includes('text/event-stream')
    ) {
      const stream = this.ensureStreamStarted();
      if (stream.write(buf)) {
        callback();
      } else {
        stream.once('drain', callback);
      }
      return;
    }

    this.bufferedChunks.push(buf);
    callback();
  }

  override _final(callback: (error?: Error | null) => void): void {
    this.headersSent = true;
    if (this.passthrough) {
      if (!this.passthrough.writableEnded) {
        this.passthrough.end();
      }
      callback();
      return;
    }

    if (!this.settled) {
      this.settled = true;
      let body: Buffer | string | undefined;
      if (this.bufferedChunks.length === 1) {
        body = this.bufferedChunks[0];
      } else if (this.bufferedChunks.length > 1) {
        body = Buffer.concat(this.bufferedChunks);
      }

      if (Buffer.isBuffer(body)) {
        const contentType = String(this.reply.getHeader('content-type') || '').toLowerCase();
        if (
          contentType.includes('application/json') ||
          contentType.includes('text/') ||
          contentType.includes('application/xml') ||
          contentType.includes('application/javascript')
        ) {
          body = body.toString('utf8');
        }
      }

      this.resolveOutcome({
        kind: 'buffered',
        statusCode: this.statusCode,
        body,
      });
    }
    callback();
  }

  public markUnhandled(): void {
    if (!this.settled && !this.headersSent) {
      this.settled = true;
      this.resolveOutcome({ kind: 'unhandled' });
    }
  }

  override _destroy(
    error: Error | null,
    callback: (error?: Error | null) => void
  ): void {
    if (this.passthrough && !this.passthrough.destroyed) {
      this.passthrough.destroy(error ?? undefined);
    }
    if (!this.settled) {
      this.settled = true;
      if (this.headersSent && this.statusCode < 400) {
        this.statusCode = 500;
      }
      this.reply.header('Content-Type', 'application/json');
      this.resolveOutcome({
        kind: 'buffered',
        statusCode: this.statusCode,
        body: JSON.stringify({ success: false, error: 'Stream terminated unexpectedly.' }),
      });
    }
    callback(error);
  }
}

export function normalizeBridgeRequest(request: FastifyRequest): URL {
  const req = request.raw as RawBridgeRequest;
  req.body = request.body;
  if (req.rawBuffer === undefined) {
    if (Buffer.isBuffer(request.body)) {
      req.rawBuffer = request.body;
    } else if (typeof request.body === 'string') {
      req.rawBuffer = Buffer.from(request.body, 'utf8');
    }
  }
  const host = (request.headers.host as string) || '127.0.0.1';
  return new URL(request.url || '/', `http://${host}`);
}

export async function dispatchThroughFastifyReply(
  request: FastifyRequest,
  reply: FastifyReply,
  handler: HttpDispatchHandler
): Promise<boolean> {
  const parsedUrl = normalizeBridgeRequest(request);
  const bridge = new FastifyResponseBridge(request, reply);
  const resAdapter = bridge as unknown as http.ServerResponse;
  const rawReqId = request.headers['x-request-id'];
  const requestId =
    typeof rawReqId === 'string' && rawReqId.trim()
      ? rawReqId.trim().slice(0, 64)
      : request.id || `req_${crypto.randomBytes(6).toString('hex')}`;

  void runWithLogContext({ requestId }, () => handler(request.raw, resAdapter, parsedUrl))
    .then((handled) => {
      if (!handled && !bridge.headersSent && !bridge.writableEnded) {
        bridge.markUnhandled();
      } else if (handled && !bridge.writableEnded) {
        if (!bridge.headersSent) {
          bridge.end();
        }
      }
    })
    .catch((err) => {
      if (!bridge.headersSent && !bridge.writableEnded) {
        const safe = toSafeErrorResponse(err, { fallbackStatus: 500 });
        bridge.writeHead(safe.statusCode, { 'Content-Type': 'application/json' });
        bridge.end(
          JSON.stringify({
            success: false,
            error: safe.message,
            code: safe.code,
            ...(safe.fieldErrors ? { fieldErrors: safe.fieldErrors } : {}),
          })
        );
      } else {
        bridge.destroy(err instanceof Error ? err : new Error(String(err)));
      }
    });

  const outcome = await bridge.outcomePromise;

  if (outcome.kind === 'unhandled') {
    return false;
  }

  if (outcome.kind === 'stream') {
    reply.code(outcome.statusCode).send(outcome.stream);
    return true;
  }

  if (outcome.body === undefined) {
    reply.code(outcome.statusCode).send();
  } else {
    reply.code(outcome.statusCode).send(outcome.body);
  }
  return true;
}

export function normalizeCommercialRoutePath(pathname: string): string {
  if (pathname.startsWith('/auth/') || pathname.startsWith('/me/')) {
    return `/api/v1${pathname}`;
  }
  if (pathname.startsWith('/v1/sync/')) {
    return `/api${pathname}`;
  }
  return pathname;
}

export function registerPrefixBridgePlugin(
  app: FastifyInstance,
  prefixes: string[],
  handlerFactory: () => HttpDispatchHandler
): void {
  const dispatch = async (request: FastifyRequest, reply: FastifyReply) => {
    const handled = await dispatchThroughFastifyReply(request, reply, handlerFactory());
    if (!handled && !reply.sent) {
      return reply.code(404).send({
        success: false,
        error: `Endpoint ${request.method.toUpperCase()} ${request.url.split('?')[0]} not found.`,
      });
    }
    return reply;
  };

  for (const prefix of prefixes) {
    app.register(
      async (instance) => {
        instance.all('', dispatch);
        instance.all('/*', dispatch);
      },
      { prefix }
    );
  }
}

export function wrapCommercialHandlers(handlers: CommercialDomainHandler[]): HttpDispatchHandler {
  return async (req, res, parsedUrl) => {
    const pathname = parsedUrl.pathname;
    const method = (req.method || 'GET').toUpperCase();
    const routePath = normalizeCommercialRoutePath(pathname);
    const clientIp = resolveTrustedClientIp(req);

    for (const handler of handlers) {
      if (await handler(req, res, pathname, method, parsedUrl, routePath, clientIp)) {
        return true;
      }
    }
    return false;
  };
}
