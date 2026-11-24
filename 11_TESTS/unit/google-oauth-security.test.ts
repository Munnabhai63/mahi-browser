import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleProfile,
} from '../../07_BACKEND/commercial/google-oauth-service.js';

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
});
