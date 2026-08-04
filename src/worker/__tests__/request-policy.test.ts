/** @jest-environment node */

import { Hono } from 'hono';
import { installRequestPolicy } from '../request-policy';
import type { Env } from '../types';

function limiter(success = true): RateLimit {
  return {
    limit: jest.fn().mockResolvedValue({ success }),
  };
}

function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    MAX_PASTE_SIZE: '10',
    KEY_LENGTH: '10',
    DEFAULT_EXPIRE_DAYS: '30',
    CREATE_RATE_LIMITER: limiter(),
    READ_RATE_LIMITER: limiter(),
    ...overrides,
  } as Env;
}

function testApp() {
  const app = new Hono<{ Bindings: Env }>();
  installRequestPolicy(app);
  app.get('/ok', (c) => c.text('ok'));
  app.get('/redirect', () => Response.redirect('https://example.com'));
  app.get('/documents/:id', (c) => c.text(c.req.param('id')));
  app.post('/documents', async (c) => c.text(await c.req.text()));
  return app;
}

describe('request policy', () => {
  it('adds lightweight security headers globally', async () => {
    const response = await testApp().request('/ok', {}, testEnv());

    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('can add headers to responses whose original headers are immutable', async () => {
    const response = await testApp().request('/redirect', {}, testEnv());

    expect(response.status).toBe(302);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('rejects cross-origin browser document creation', async () => {
    const env = testEnv();
    const response = await testApp().request(
      'https://haste.example/documents',
      {
        method: 'POST',
        headers: { Origin: 'https://attacker.example' },
        body: 'hello',
      },
      env
    );

    expect(response.status).toBe(403);
    expect(env.CREATE_RATE_LIMITER.limit).not.toHaveBeenCalled();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('permits non-browser API clients without an Origin header', async () => {
    const response = await testApp().request(
      'https://haste.example/documents',
      { method: 'POST', body: 'hello' },
      testEnv()
    );

    expect(response.status).toBe(200);
  });

  it('rejects request bodies before an unbounded read', async () => {
    const response = await testApp().request(
      'https://haste.example/documents',
      { method: 'POST', body: 'x'.repeat(11) },
      testEnv()
    );

    expect(response.status).toBe(413);
  });

  it('returns 429 when the read limiter denies a request', async () => {
    const response = await testApp().request(
      'https://haste.example/documents/known-key',
      {},
      testEnv({ READ_RATE_LIMITER: limiter(false) })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
  });
});
