import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { setCustomDatabasePath, closeDatabase, getDatabase } from '../../06_DATABASE/connection.js';
import {
  registerUser,
  loginUser,
  verifyToken,
  signToken,
  hashPassword,
  generateSalt,
  getUserById,
  getAllUsers,
  updateUserStatus,
  updateUserPlan,
} from '../../07_BACKEND/commercial/commercial-auth-service.js';
import { getCommercialAuditLogs } from '../../07_BACKEND/commercial/commercial-audit-service.js';

describe('Commercial Authentication & RBAC Service', () => {
  const testDbDir = path.join(process.cwd(), '.test_commercial_auth');
  const testDbPath = path.join(testDbDir, 'commercial_auth_test.sqlite');

  beforeEach(async () => {
    try { fs.mkdirSync(testDbDir, { recursive: true }); } catch {}
    try { fs.unlinkSync(testDbPath); } catch {}
    setCustomDatabasePath(testDbPath);
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
    try { fs.unlinkSync(testDbPath); } catch {}
    try { fs.rmdirSync(testDbDir); } catch {}
  });

  it('should register a new commercial user with hashed password and unique salt', () => {
    const res = registerUser({
      email: 'alex@company.com',
      password: 'SecurePassword123!',
      name: 'Alex Rivera',
    });

    expect(res.success).toBe(true);
    expect(res.user).toBeDefined();
    expect(res.user?.email).toBe('alex@company.com');
    expect(res.user?.name).toBe('Alex Rivera');
    expect(res.user?.status).toBe('ACTIVE');
    expect(res.user?.role).toBe('USER');
    expect(res.token).toBeDefined();

    // Verify password is never stored in plaintext
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM commercial_users WHERE id = ?').get(res.user!.id) as any;
    expect(row.password_hash).not.toBe('SecurePassword123!');
    expect(row.password_hash.length).toBe(64); // SHA-256 hex
    expect(row.salt).toBeDefined();
  });

  it('should prevent duplicate registration with the same email', () => {
    registerUser({ email: 'duplicate@test.com', password: 'Password123' });
    const duplicateRes = registerUser({ email: 'duplicate@test.com', password: 'DifferentPassword456' });

    expect(duplicateRes.success).toBe(false);
    expect(duplicateRes.error).toContain('already exists');
  });

  it('should sign and verify valid JWT tokens and reject tampered tokens', () => {
    const token = signToken({ userId: 'usr_test_123', email: 'test@mahi.com', role: 'ADMIN' });
    expect(token).toBeDefined();

    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe('usr_test_123');
    expect(decoded?.role).toBe('ADMIN');

    // Tampered token
    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(verifyToken(tampered)).toBeNull();
    expect(verifyToken('invalid.token.structure')).toBeNull();
  });

  it('should login an active user with correct password and return valid token', () => {
    registerUser({ email: 'login@test.com', password: 'CorrectPassword123' });

    const loginRes = loginUser({ email: 'login@test.com', password: 'CorrectPassword123' });
    expect(loginRes.success).toBe(true);
    expect(loginRes.token).toBeDefined();
    expect(loginRes.user?.email).toBe('login@test.com');
  });

  it('should reject login with wrong password', () => {
    registerUser({ email: 'wrongpass@test.com', password: 'CorrectPassword123' });

    const loginRes = loginUser({ email: 'wrongpass@test.com', password: 'IncorrectPassword' });
    expect(loginRes.success).toBe(false);
    expect(loginRes.error).toContain('Invalid email or password');
  });

  it('should reject login if user is SUSPENDED or BANNED', () => {
    const reg = registerUser({ email: 'suspended@test.com', password: 'MyPassword123' });
    const userId = reg.user!.id;

    // Admin suspends user
    updateUserStatus(userId, 'SUSPENDED', { id: 'admin', name: 'Admin', role: 'ADMIN' }, 'Billing inquiry pending');

    const suspendedLogin = loginUser({ email: 'suspended@test.com', password: 'MyPassword123' });
    expect(suspendedLogin.success).toBe(false);
    expect(suspendedLogin.error).toContain('suspended');

    // Admin bans user
    updateUserStatus(userId, 'BANNED', { id: 'admin', name: 'Admin', role: 'SUPER_ADMIN' }, 'Terms violation');
    const bannedLogin = loginUser({ email: 'suspended@test.com', password: 'MyPassword123' });
    expect(bannedLogin.success).toBe(false);
    expect(bannedLogin.error).toContain('banned');
  });

  it('should record administrative status changes in audit log', () => {
    const reg = registerUser({ email: 'audituser@test.com', password: 'Password123' });
    updateUserStatus(reg.user!.id, 'SUSPENDED', { id: 'super_admin_1', name: 'Root Admin', role: 'SUPER_ADMIN' }, 'Test suspension');

    const { logs } = getCommercialAuditLogs({ action: 'USER_SUSPENDED' });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actorName).toBe('Root Admin');
    expect(logs[0].targetId).toBe(reg.user!.id);
  });
});
