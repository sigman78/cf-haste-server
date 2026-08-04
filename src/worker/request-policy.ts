import type { Hono, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getServerConfig } from './config';
import type { Env } from './types';

type App = { Bindings: Env };

const JSON_ENCODING_EXPANSION = 6;
const JSON_ENVELOPE_BYTES = 1024;

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; " +
    "form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; connect-src 'self'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Origin-Agent-Cluster': '?1',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
} as const;

const addSecurityHeaders: MiddlewareHandler<App> = async (c, next) => {
  await next();

  // Responses returned by fetch bindings (including ASSETS) can have immutable
  // headers. Clone once at the boundary before applying the global policy.
  const response = new Response(c.res.body, c.res);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  c.res = response;
};

function isDocumentWrite(path: string, method: string): boolean {
  return method === 'POST' && path === '/documents';
}

function isDocumentRead(path: string, method: string): boolean {
  return method === 'GET' && /^\/(?:documents|raw)\/[^/]+$/.test(path);
}

function isCrossOriginBrowserWrite(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true;

  const origin = request.headers.get('origin');
  if (!origin) return false; // Non-browser clients such as curl do not send Origin.

  try {
    return new URL(origin).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}

function rateLimitKey(request: Request): string {
  // This service has no accounts or API keys, so the connecting IP is the
  // least-bad coarse identity available. Keep configured limits NAT-friendly.
  return request.headers.get('cf-connecting-ip') || 'unknown-client';
}

async function checkRateLimit(c: Parameters<MiddlewareHandler<App>>[0], limiter: RateLimit) {
  try {
    const { success } = await limiter.limit({ key: rateLimitKey(c.req.raw) });
    if (success) return null;

    c.header('Retry-After', '60');
    return c.json({ message: 'Too many requests' }, 429);
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return c.json({ message: 'Request policy unavailable' }, 503);
  }
}

const enforceRequestPolicy: MiddlewareHandler<App> = async (c, next) => {
  const path = c.req.path;
  const method = c.req.method;

  if (isDocumentWrite(path, method)) {
    if (isCrossOriginBrowserWrite(c.req.raw)) {
      return c.json({ message: 'Cross-origin document creation is not allowed' }, 403);
    }

    const limited = await checkRateLimit(c, c.env.CREATE_RATE_LIMITER);
    if (limited) return limited;

    // JSON string escaping can expand one decoded content byte to six request
    // bytes (for example, "\u0000"). The route enforces the exact decoded byte
    // limit after parsing; this guard prevents unbounded buffering beforehand.
    const maxPasteSize = getServerConfig(c.env).maxPasteSize;
    const isJson = (c.req.header('content-type') || '').toLowerCase().includes('application/json');
    return bodyLimit({
      maxSize: isJson ? maxPasteSize * JSON_ENCODING_EXPANSION + JSON_ENVELOPE_BYTES : maxPasteSize,
      onError: (context) => context.json({ message: 'Request body is too large' }, 413),
    })(c, next);
  }

  if (isDocumentRead(path, method)) {
    const limited = await checkRateLimit(c, c.env.READ_RATE_LIMITER);
    if (limited) return limited;
  }

  await next();
};

/** Install the complete HTTP boundary policy in one place. */
export function installRequestPolicy(app: Hono<App>): void {
  // Register security headers first so they are also applied to policy errors.
  app.use('*', addSecurityHeaders);
  app.use('*', enforceRequestPolicy);
}
