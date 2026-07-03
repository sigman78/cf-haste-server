export interface DocumentRecord {
  id: string;
  content: string;
  created_at: number;
  expires_at: number | null;
  views: number;
}

export interface DocumentStore {
  /** Fetch document content, or null if missing/expired. */
  get(key: string): Promise<string | null>;
  /** Atomically insert content under a fresh unique key and return that key. */
  create(content: string, keyLength: number, expireDays?: number): Promise<string>;
  /** Bump the view counter (best-effort, safe to run in the background). */
  incrementViews(key: string): Promise<void>;
  /** Delete expired documents, returning how many were removed. */
  cleanup(): Promise<number>;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MAX_PASTE_SIZE: string;
  KEY_LENGTH: string;
  DEFAULT_EXPIRE_DAYS: string;
  BROWSER_CACHE_MAX_AGE?: string;
  CDN_CACHE_MAX_AGE?: string;
  CDN_STALE_WHILE_REVALIDATE?: string;
}
