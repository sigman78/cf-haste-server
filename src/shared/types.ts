export interface DocumentRecord {
  id: string;
  content: string;
  created_at: number;
  expires_at: number | null;
  views: number;
}

export interface DocumentStore {
  get(key: string): Promise<string | null>;
  set(key: string, content: string, expireDays?: number): Promise<void>;
  generateKey(length: number): Promise<string>;
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

export interface SaveResponse {
  key: string;
  url?: string;
}

export interface GetResponse {
  content: string;
  key: string;
  language?: string;
}
