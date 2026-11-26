import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import http from 'node:http';
import { URL } from 'node:url';
import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleProfile,
  verifyGoogleIdToken,
  _setGoogleJwksForTesting,
} from '../../07_BACKEND/commercial/google-oauth-service.js';
import { handleCommercialApiRoutes } from '../../07_BACKEND/commercial/commercial-api-router.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';

describe('Google OAuth Security — Mock Bypass Guard', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('When NODE_ENV === "test"', () => {
    it('permits mock code exchange and returns simulated token payload', async () => {
      const code = 'mock_code_security_test_123';
      const redirectUri = 'https://mahibrowser.com/auth/callback';

      const tokens = await exchangeGoogleAuthorizationCode(code, redirectUri);
      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBe(`mock_access_token_${code}`);
      expect(tokens.idToken).toBe(`mock_id_token_${code}`);
      expect(tokens.expiresIn).toBe(3600);
    });

    it('permits mock access token profile fetch and returns simulated claims', async () => {
      const token = 'mock_access_token_alice_testing';
      const claims = await fetchGoogleProfile(token);

      expect(claims).toBeDefined();
      expect(claims.sub).toBe('google_sub_alice_testing');
      expect(claims.email).toBe('alice_testing@gmail.com');
      expect(claims.email_verified).toBe(true);
      expect(claims.name).toBe('Google User alice_testing');
    });
  });

  describe('When NODE_ENV === "production"', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('strictly blocks mock_code_ bypass from returning simulated tokens', async () => {
      const code = 'mock_code_attacker_root';
      const redirectUri = 'https://mahibrowser.com/auth/callback';

      // In production, mock_code_ must NOT resolve to mock tokens;
      // it must proceed to real OAuth (which throws missing config or rejects network)
      let resolvedTokens: any = null;
      try {
        resolvedTokens = await exchangeGoogleAuthorizationCode(code, redirectUri);
      } catch (err: any) {
        expect(err).toBeDefined();
      }

      expect(resolvedTokens).toBeNull();
    });

    it('strictly blocks mock_access_token_ bypass from returning simulated claims', async () => {
      const token = 'mock_access_token_attacker_root';

      let resolvedClaims: any = null;
      try {
        resolvedClaims = await fetchGoogleProfile(token);
      } catch (err: any) {
        expect(err).toBeDefined();
      }

      expect(resolvedClaims).toBeNull();
    });
  });

  describe('When NODE_ENV === "development"', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('strictly blocks mock_code_ bypass in development environment', async () => {
      const code = 'mock_code_dev_attempt';
      const redirectUri = 'https://mahibrowser.com/auth/callback';

      let resolvedTokens: any = null;
      try {
        resolvedTokens = await exchangeGoogleAuthorizationCode(code, redirectUri);
      } catch (err: any) {
        expect(err).toBeDefined();
      }

      expect(resolvedTokens).toBeNull();
    });

    it('strictly blocks mock_access_token_ bypass in development environment', async () => {
      const token = 'mock_access_token_dev_attempt';

      let resolvedClaims: any = null;
      try {
        resolvedClaims = await fetchGoogleProfile(token);
      } catch (err: any) {
        expect(err).toBeDefined();
      }

      expect(resolvedClaims).toBeNull();
    });
  });

  describe('Sub-Step 1A: POST /api/v1/auth/google & Cryptographic ID Token Verification', () => {
    const prevClientId = process.env.GOOGLE_CLIENT_ID;
    const prevClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const prevRedirect = process.env.GOOGLE_REDIRECT_URI;

    beforeAll(async () => {
      await initializeDatabase();
    });

    afterEach(() => {
      _setGoogleJwksForTesting(null);
      if (prevClientId !== undefined) process.env.GOOGLE_CLIENT_ID = prevClientId;
      else delete process.env.GOOGLE_CLIENT_ID;
      if (prevClientSecret !== undefined) process.env.GOOGLE_CLIENT_SECRET = prevClientSecret;
      else delete process.env.GOOGLE_CLIENT_SECRET;
      if (prevRedirect !== undefined) process.env.GOOGLE_REDIRECT_URI = prevRedirect;
      else delete process.env.GOOGLE_REDIRECT_URI;
    });

    it('rejects raw unverified email/sub POST requests to /api/v1/auth/google with 401', async () => {
      const req = {
        method: 'POST',
        url: '/api/v1/auth/google',
        headers: { host: '127.0.0.1:8989', 'content-type': 'application/json' },
        body: {
          email: 'victim-admin@mahibrowser.com',
          sub: 'spoofed_sub_999',
          email_verified: true,
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as http.IncomingMessage;

      let statusCode = 0;
      let rawBody = '';
      const res = {
        setHeader: () => {},
        getHeader: () => undefined,
        writeHead: (code: number) => {
          statusCode = code;
        },
        end: (chunk?: string) => {
          if (chunk) rawBody += chunk;
        },
      } as unknown as http.ServerResponse;

      const handled = await handleCommercialApiRoutes(
        req,
        res,
        '/api/v1/auth/google',
        'POST',
        new URL('http://127.0.0.1:8989/api/v1/auth/google')
      );

      expect(handled).toBe(true);
      expect(statusCode).toBe(401);
      const parsed = JSON.parse(rawBody);
      expect(parsed.success).toBe(false);
      expect(parsed.token).toBeUndefined();
    });

    it('cryptographically verifies RS256 Google ID tokens via JWKS and rejects forged/wrong-audience/expired tokens', async () => {
      const clientId = 'mahi-test-client-id.apps.googleusercontent.com';
      process.env.GOOGLE_CLIENT_ID = clientId;
      process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
      process.env.GOOGLE_REDIRECT_URI = 'https://api.mahibrowser.com/api/v1/auth/google/callback';

      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
      _setGoogleJwksForTesting([{ ...jwk, kid: 'kid-unit-1', alg: 'RS256', use: 'sig' }]);

      const signJwt = (hdr: object, pay: object) => {
        const h = Buffer.from(JSON.stringify(hdr)).toString('base64url');
        const p = Buffer.from(JSON.stringify(pay)).toString('base64url');
        const sig = crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url');
        return `${h}.${p}.${sig}`;
      };

      const now = Math.floor(Date.now() / 1000);
      const validJwt = signJwt(
        { alg: 'RS256', kid: 'kid-unit-1', typ: 'JWT' },
        {
          iss: 'https://accounts.google.com',
          aud: clientId,
          sub: '108999111222333444',
          email: 'Verified.User@gmail.com',
          email_verified: true,
          name: 'Verified User',
          exp: now + 300,
        }
      );

      const claims = await verifyGoogleIdToken(validJwt);
      expect(claims.sub).toBe('108999111222333444');
      expect(claims.email).toBe('verified.user@gmail.com');
      expect(claims.email_verified).toBe(true);

      const wrongAudJwt = signJwt(
        { alg: 'RS256', kid: 'kid-unit-1', typ: 'JWT' },
        {
          iss: 'https://accounts.google.com',
          aud: 'other-client.apps.googleusercontent.com',
          sub: '108999111222333444',
          email: 'verified.user@gmail.com',
          email_verified: true,
          exp: now + 300,
        }
      );
      await expect(verifyGoogleIdToken(wrongAudJwt)).rejects.toThrow(/audience mismatch/i);

      const expiredJwt = signJwt(
        { alg: 'RS256', kid: 'kid-unit-1', typ: 'JWT' },
        {
          iss: 'https://accounts.google.com',
          aud: clientId,
          sub: '108999111222333444',
          email: 'verified.user@gmail.com',
          email_verified: true,
          exp: now - 60,
        }
      );
      await expect(verifyGoogleIdToken(expiredJwt)).rejects.toThrow(/expired/i);

      const tamperedParts = validJwt.split('.');
      tamperedParts[2] = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      await expect(verifyGoogleIdToken(tamperedParts.join('.'))).rejects.toThrow(/signature verification failed/i);
    });
  });
});
