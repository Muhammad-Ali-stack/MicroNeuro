import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../api/app.js';

describe('REST API adapter', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const { app } = createApp({ clientId: 'test-client', tenantId: 'test-tenant' });
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  it('exposes a public health endpoint without Microsoft credentials', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('ok');
  });

  it('reports the complete registered tool count', async () => {
    const response = await fetch(`${baseUrl}/api/v1`);
    expect(response.status).toBe(200);
    expect((await response.json()).toolCount).toBe(48);
  });

  it('protects Graph operations with the session cookie', async () => {
    const response = await fetch(`${baseUrl}/api/v1/outlook/messages`);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('creates a signed session and returns an OAuth configuration error clearly', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.authorizationUrl).toContain('login.microsoftonline.com');
    expect(response.headers.get('set-cookie')).toContain('outlook_session=');
  });
});