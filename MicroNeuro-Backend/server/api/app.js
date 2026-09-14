import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { ApiSessionStore } from './sessionStore.js';
import { toolRegistry } from './toolRegistry.js';
import { InputValidator, ValidationError } from '../utils/InputValidator.js';
import { getRateLimitMetricsTool, resetRateLimitMetricsTool } from '../tools/common/rateLimitUtils.js';
import { registerIntelligenceRoutes } from './intelligenceRoutes.js';
import prisma from '../../lib/prisma.js';
import { ensureDatabaseUser } from '../../services/intelligence.js';

const validator = new InputValidator();

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function asQueryValue(value, schema) {
  if (schema?.type === 'array') {
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return String(value).split(',').map(item => item.trim()).filter(Boolean);
  }
  if (schema?.type === 'number' || schema?.type === 'integer') {
    const number = Number(value);
    return Number.isNaN(number) ? value : number;
  }
  if (schema?.type === 'boolean') return value === 'true' || value === '1';
  if (schema?.type === 'object' && typeof value === 'string') {
    try { return JSON.parse(value); } catch {}
  }
  return value;
}

function buildArgs(req, spec) {
  const properties = spec.schema?.inputSchema?.properties || {};
  const source = { ...(req.method === 'GET' ? req.query : req.body), ...req.params };
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [
    key, typeof value === 'string' ? asQueryValue(value, properties[key]) : value,
  ]));
}

function parseToolResult(result) {
  if (!result) return null;
  if (result.isError) {
    const text = result.content?.find(item => item.type === 'text')?.text || 'Tool execution failed';
    let details = result._errorDetails || {};
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') details = { ...details, ...parsed };
    } catch {}
    const error = new Error(text);
    error.statusCode = details.statusCode;
    error.details = details;
    error.isToolError = true;
    throw error;
  }
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = result.content?.find(item => item.type === 'text')?.text;
  if (text === undefined) return result;
  try { return JSON.parse(text); } catch { return { text }; }
}

function errorStatus(error) {
  if (error instanceof ValidationError || error.name === 'ValidationError') return 400;
  if (error.statusCode === 401 || error.details?.type === 'authentication' || /authentication|not authenticated/i.test(error.message)) return 401;
  if (error.statusCode === 404) return 404;
  if (error.statusCode === 429 || error.details?.type === 'rate_limit') return 429;
  if (error.statusCode >= 400 && error.statusCode < 600) return error.statusCode;
  return 500;
}

function sendError(res, error, requestId) {
  const status = errorStatus(error);
  const body = {
    error: {
      code: status === 401 ? 'AUTHENTICATION_REQUIRED' : status === 400 ? 'VALIDATION_ERROR' : 'REQUEST_FAILED',
      message: status === 500 ? 'The request could not be completed.' : error.message,
      requestId,
    },
  };
  if (status === 400 && error.errors) body.error.details = error.errors;
  if (error.details && status !== 500) body.error.details = error.details;
  if (error.details?.retryAfter) res.set('Retry-After', String(error.details.retryAfter));
  return res.status(status).json(body);
}

function sessionRequired(store) {
  return (req, res, next) => {
    const session = store.get(req);
    if (!session) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authenticate with Microsoft at GET /api/v1/auth/login first.',
        },
      });
    }
    req.session = session;
    next();
  };
}

function getRedirectUri(req) {
  if (process.env.OAUTH_REDIRECT_URI) return process.env.OAUTH_REDIRECT_URI;
  if (process.env.MCP_OUTLOOK_REDIRECT_URI && !process.env.MCP_OUTLOOK_REDIRECT_URI.includes(':0')) {
    return process.env.MCP_OUTLOOK_REDIRECT_URI;
  }
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/api/v1/auth/callback`;
}

export function createApp(options = {}) {
  const clientId = options.clientId || process.env.AZURE_CLIENT_ID;
  const tenantId = options.tenantId || process.env.AZURE_TENANT_ID;
  const store = options.sessionStore || new ApiSessionStore({ clientId, tenantId });
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(value => value.trim()) : true,
    credentials: true,
  }));
  app.use(cookieParser(store.secret));
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));
  app.use((req, res, next) => {
    const requestId = req.get('x-request-id') || crypto.randomUUID();
    req.requestId = requestId;
    res.set('x-request-id', requestId);
    const started = Date.now();
    res.on('finish', () => console.info(JSON.stringify({
      requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - started,
    })));
    next();
  });

  app.get('/health', (req, res) => res.json({
    status: 'ok',
    service: 'outlook-rest-api',
    version: 'v1',
    microsoftConfigured: Boolean(clientId && tenantId),
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/v1', (req, res) => res.json({
    name: 'Outlook REST API',
    version: 'v1',
    authentication: '/api/v1/auth/login',
    documentation: '/API.md',
    toolCount: toolRegistry.length,
  }));

  app.get('/api/v1/auth/login', async (req, res, next) => {
    try {
      if (!clientId || !tenantId) {
        return res.status(503).json({ error: { code: 'OAUTH_NOT_CONFIGURED', message: 'AZURE_CLIENT_ID and AZURE_TENANT_ID are required.' } });
      }
      const session = store.get(req) || await store.create(res);
      const state = crypto.randomBytes(24).toString('hex');
      const addAccount = req.query.addAccount === 'true';
      session.oauthState = { value: state, createdAt: Date.now(), redirectUri: getRedirectUri(req), addAccount };
      const authorizationUrl = await session.manager.createAuthorizationUrl(session.oauthState.redirectUri, state, { addAccount });
      res.json({ data: { authorizationUrl, redirectUri: session.oauthState.redirectUri } });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/auth/callback', async (req, res, next) => {
    try {
      const session = store.get(req);
      const { code, state, error, error_description: errorDescription } = req.query;
      if (error) return res.status(400).send(`<h1>Microsoft authentication failed</h1><p>${String(errorDescription || error).replace(/[<>]/g, '')}</p>`);
      if (!session || !session.oauthState || !state || state !== session.oauthState.value) {
        return res.status(400).send('<h1>Authentication failed</h1><p>Invalid or expired OAuth state.</p>');
      }
      if (!code || Date.now() - session.oauthState.createdAt > 10 * 60 * 1000) {
        return res.status(400).send('<h1>Authentication failed</h1><p>The authorization code is missing or expired.</p>');
      }
      const result = await session.manager.authenticateWithAuthorizationCode(code, session.oauthState.redirectUri);
      session.oauthState = null;

      // Look up or create the app User + ConnectedAccount for the returned Microsoft account.
      const msAccount = result.user;
      const email = (msAccount?.mail || msAccount?.email || '').toLowerCase();
      if (!email) throw new Error('Microsoft account does not provide an email address.');

      const appUser = await prisma.user.upsert({
        where: { email },
        update: { displayName: msAccount.displayName || null },
        create: { email, displayName: msAccount.displayName || null },
      });
      session.databaseUserId = appUser.id;

      const existingAccount = await prisma.connectedAccount.findUnique({
        where: { microsoftAccountId: msAccount.id },
      });

      let connectedAccount;
      if (existingAccount) {
        connectedAccount = await prisma.connectedAccount.update({
          where: { id: existingAccount.id },
          data: { email, displayName: msAccount.displayName || null },
        });
      } else {
        const accountCount = await prisma.connectedAccount.count({ where: { appUserId: appUser.id } });
        connectedAccount = await prisma.connectedAccount.create({
          data: {
            appUserId: appUser.id,
            microsoftAccountId: msAccount.id,
            email,
            displayName: msAccount.displayName || null,
            isActive: accountCount === 0,
          },
        });
      }

      // Store tokens for this connected account and set it as the active scope.
      // Re-store the tokens under the connected-account-scoped key.
      const tokenResponse = session.manager.lastTokenResponse;
      if (tokenResponse) {
        session.manager.setActiveConnectedAccount(connectedAccount.id);
        await session.manager.tokenManager.storeTokens(
          tokenResponse.access_token,
          tokenResponse.refresh_token,
          tokenResponse.expires_in,
        );
      }

      session.activeConnectedAccountId = connectedAccount.id;
      session.manager.setActiveConnectedAccount(connectedAccount.id);

      res.type('html').send(`<h1>Authentication successful</h1><p>Connected as ${String(msAccount?.displayName || 'Microsoft user').replace(/[<>]/g, '')}. You may close this window.</p>`);
    } catch (err) { next(err); }
  });

  app.get('/api/v1/auth/me', sessionRequired(store), async (req, res, next) => {
    try {
      const user = req.session.manager.authenticationRecord;
      const activeAccount = req.session.activeConnectedAccountId
        ? await prisma.connectedAccount.findUnique({ where: { id: req.session.activeConnectedAccountId } })
        : null;
      res.json({ data: { authenticated: Boolean(req.session.manager.isAuthenticated), user: user || null, activeConnectedAccount: activeAccount ? { id: activeAccount.id, email: activeAccount.email, displayName: activeAccount.displayName, isActive: activeAccount.isActive } : null } });
    } catch (error) { next(error); }
  });

  app.get('/api/v1/auth/accounts', sessionRequired(store), async (req, res, next) => {
    try {
      const user = await ensureDatabaseUser(req.session.manager);
      const accounts = await prisma.connectedAccount.findMany({
        where: { appUserId: user.id },
        select: { id: true, email: true, displayName: true, isActive: true, connectedAt: true },
        orderBy: { connectedAt: 'asc' },
      });
      res.json({ data: accounts });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/auth/switch-account', sessionRequired(store), async (req, res, next) => {
    try {
      const connectedAccountId = String(req.body?.connectedAccountId || '').trim();
      if (!connectedAccountId) throw validationError('connectedAccountId is required.');
      const user = await ensureDatabaseUser(req.session.manager);
      const account = await prisma.connectedAccount.findFirst({
        where: { id: connectedAccountId, appUserId: user.id },
      });
      if (!account) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Connected account not found.' } });

      await prisma.$transaction([
        prisma.connectedAccount.updateMany({ where: { appUserId: user.id, isActive: true }, data: { isActive: false } }),
        prisma.connectedAccount.update({ where: { id: connectedAccountId }, data: { isActive: true } }),
      ]);

      req.session.activeConnectedAccountId = connectedAccountId;
      req.session.manager.setActiveConnectedAccount(connectedAccountId);

      res.json({ data: { switchedTo: { id: account.id, email: account.email, displayName: account.displayName } } });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/auth/remove-account', sessionRequired(store), async (req, res, next) => {
    try {
      const connectedAccountId = String(req.body?.connectedAccountId || '').trim();
      if (!connectedAccountId) throw validationError('connectedAccountId is required.');
      const user = await ensureDatabaseUser(req.session.manager);
      const account = await prisma.connectedAccount.findFirst({
        where: { id: connectedAccountId, appUserId: user.id },
      });
      if (!account) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Connected account not found.' } });

      const wasActive = account.isActive;
      const remaining = await prisma.connectedAccount.count({
        where: { appUserId: user.id, NOT: { id: connectedAccountId } },
      });

      // Clear tokens for this account.
      req.session.manager.setActiveConnectedAccount(connectedAccountId);
      await req.session.manager.tokenManager.clearTokens().catch(() => {});

      await prisma.connectedAccount.delete({ where: { id: connectedAccountId } });

      if (wasActive && remaining > 0) {
        const nextAccount = await prisma.connectedAccount.findFirst({
          where: { appUserId: user.id },
          orderBy: { connectedAt: 'asc' },
        });
        if (nextAccount) {
          await prisma.connectedAccount.update({ where: { id: nextAccount.id }, data: { isActive: true } });
          req.session.activeConnectedAccountId = nextAccount.id;
          req.session.manager.setActiveConnectedAccount(nextAccount.id);
          return res.json({ data: { removed: connectedAccountId, autoSwitchedTo: { id: nextAccount.id, email: nextAccount.email } } });
        }
      }

      if (remaining === 0) {
        await store.destroy(req, res);
        return res.json({ data: { removed: connectedAccountId, loggedOut: true } });
      }

      res.json({ data: { removed: connectedAccountId } });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/auth/logout', async (req, res, next) => {
    try { await store.destroy(req, res); res.json({ data: { loggedOut: true } }); } catch (error) { next(error); }
  });

  const requireSession = sessionRequired(store);
  registerIntelligenceRoutes(app, { requireSession, store });
  for (const spec of toolRegistry) {
    const handler = async (req, res, next) => {
      try {
        const args = buildArgs(req, spec);
        if (spec.schema?.inputSchema) validator.validateSchema(args, spec.schema.inputSchema);
        await req.session.manager.ensureAuthenticated();
        const result = await spec.handler(req.session.manager, args);
        const data = parseToolResult(result);
        const response = { data };
        if (args.limit !== undefined) {
          const count = Array.isArray(data) ? data.length : data?.count;
          response.pagination = { limit: args.limit, count: count ?? null, hasMore: count === args.limit };
        }
        res.json(response);
      } catch (error) { next(error); }
    };
    app[spec.method.toLowerCase()](spec.path, requireSession, handler);
  }

  app.get('/api/v1/system/rate-limit', requireSession, async (req, res, next) => {
    try { res.json({ data: parseToolResult(await getRateLimitMetricsTool(req.session.manager, req.query)) }); } catch (error) { next(error); }
  });
  app.post('/api/v1/system/rate-limit/reset', requireSession, async (req, res, next) => {
    try { res.json({ data: parseToolResult(await resetRateLimitMetricsTool(req.session.manager, req.body || {})) }); } catch (error) { next(error); }
  });

  app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: req.requestId } }));
 app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('ERROR CAUGHT:', error);
    sendError(res, error, req.requestId);
  });

  return { app, store, toolRegistry };
}