import type { Env } from './types';

/**
 * All env-var parsing lives here so routes never touch raw strings
 * or repeat fallback values.
 */
export interface ServerConfig {
  maxPasteSize: number;
  keyLength: number;
  defaultExpireDays: number;
  browserCacheMaxAge: number;
  cdnCacheMaxAge: number;
  cdnStaleWhileRevalidate: number;
}

function intVar(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getServerConfig(env: Env): ServerConfig {
  return {
    maxPasteSize: intVar(env.MAX_PASTE_SIZE, 400000),
    keyLength: intVar(env.KEY_LENGTH, 10),
    defaultExpireDays: intVar(env.DEFAULT_EXPIRE_DAYS, 30),
    browserCacheMaxAge: intVar(env.BROWSER_CACHE_MAX_AGE, 0),
    cdnCacheMaxAge: intVar(env.CDN_CACHE_MAX_AGE, 0),
    cdnStaleWhileRevalidate: intVar(env.CDN_STALE_WHILE_REVALIDATE, 0),
  };
}
