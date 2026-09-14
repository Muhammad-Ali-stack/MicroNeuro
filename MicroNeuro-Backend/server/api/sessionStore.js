import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { OutlookAuthManager } from '../auth/auth.js';

const COOKIE_NAME = 'outlook_session';

function safeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    signed: true,
  };
}

export class ApiSessionStore {
  constructor({ clientId, tenantId, secret = process.env.SESSION_SECRET } = {}) {
    this.clientId = clientId;
    this.tenantId = tenantId;
    this.secret = secret || crypto.randomBytes(32).toString('hex');
    this.sessions = new Map();
    this.tokenRoot = process.env.API_TOKEN_STORAGE_DIR ||
      path.join(os.tmpdir(), 'outlook-rest-tokens');
  }

  get cookieName() {
    return COOKIE_NAME;
  }

  async create(res) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const storageDir = path.join(this.tokenRoot, sessionId);
    await fs.mkdir(storageDir, { recursive: true, mode: 0o700 });
    const manager = new OutlookAuthManager(this.clientId, this.tenantId, {
      storageDir,
      useKeytar: false,
    });
    const session = {
      id: sessionId,
      manager,
      oauthState: null,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    res.cookie(COOKIE_NAME, sessionId, safeCookieOptions());
    return session;
  }

  get(req) {
    const sessionId = req.signedCookies?.[COOKIE_NAME];
    if (!sessionId || typeof sessionId !== 'string') return null;
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.lastAccessedAt = Date.now();
    // Ensure the token manager is scoped to the active connected account.
    if (session.activeConnectedAccountId && session.manager) {
      session.manager.setActiveConnectedAccount(session.activeConnectedAccountId);
    }
    return session;
  }

  findByUserId(userId) {
    for (const session of this.sessions.values()) {
      if (session.databaseUserId === userId) return session;
    }
    return null;
  }

  async destroy(req, res) {
    const session = this.get(req);
    if (session) {
      await session.manager.logout().catch(() => {});
      this.sessions.delete(session.id);
      await fs.rm(path.join(this.tokenRoot, session.id), { recursive: true, force: true }).catch(() => {});
    }
    res.clearCookie(COOKIE_NAME, safeCookieOptions());
  }

  async cleanup(maxAge = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAge;
    for (const session of this.sessions.values()) {
      if (session.lastAccessedAt < cutoff) {
        await session.manager.logout().catch(() => {});
        this.sessions.delete(session.id);
        await fs.rm(path.join(this.tokenRoot, session.id), { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}

export { COOKIE_NAME, safeCookieOptions };