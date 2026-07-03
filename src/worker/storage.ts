import type { DocumentStore, Env } from './types';
import { getServerConfig } from './config';

const CONSONANTS = 'bcdfghjklmnpqrstvwxyz';
const VOWELS = 'aeiou';
const MIN_KEY_LENGTH = 6;
const MAX_CREATE_ATTEMPTS = 10;

/**
 * Generate a pronounceable random key, e.g. "tavelu-hasoq".
 * Uses crypto randomness; uniqueness is enforced at insert time.
 */
export function randomKey(length: number): string {
  const keyLength = Math.max(length, MIN_KEY_LENGTH);
  const bytes = crypto.getRandomValues(new Uint8Array(keyLength));

  let key = '';
  for (let i = 0; i < keyLength; i++) {
    const pool = i % 3 === 1 ? VOWELS : CONSONANTS;
    key += pool[bytes[i] % pool.length];
    if (i % 6 === 5 && i < keyLength - 1) key += '-';
  }
  return key;
}

export class D1DocumentStore implements DocumentStore {
  constructor(
    private db: D1Database,
    private defaultExpireDays: number = 30
  ) {}

  async get(key: string): Promise<string | null> {
    const now = Math.floor(Date.now() / 1000);

    const result = await this.db
      .prepare(
        `SELECT content FROM documents
         WHERE id = ? AND (expires_at IS NULL OR expires_at > ?)`
      )
      .bind(key, now)
      .first<{ content: string }>();

    return result?.content ?? null;
  }

  async incrementViews(key: string): Promise<void> {
    await this.db.prepare('UPDATE documents SET views = views + 1 WHERE id = ?').bind(key).run();
  }

  async create(content: string, keyLength: number, expireDays?: number): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const days = expireDays ?? this.defaultExpireDays;
    const expiresAt = days > 0 ? now + days * 24 * 60 * 60 : null;

    // ON CONFLICT DO NOTHING makes the uniqueness check atomic: a colliding
    // key inserts zero rows and we retry, so an existing paste is never
    // silently overwritten.
    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
      const key = randomKey(keyLength);
      const result = await this.db
        .prepare(
          `INSERT INTO documents (id, content, created_at, expires_at, views)
           VALUES (?, ?, ?, ?, 0)
           ON CONFLICT(id) DO NOTHING`
        )
        .bind(key, content, now, expiresAt)
        .run();

      if (result.meta.changes > 0) {
        return key;
      }
    }

    throw new Error('Failed to generate unique key after maximum attempts');
  }

  async cleanup(): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const result = await this.db
      .prepare('DELETE FROM documents WHERE expires_at IS NOT NULL AND expires_at <= ?')
      .bind(now)
      .run();

    return result.meta.changes;
  }
}

export function createStore(env: Env): DocumentStore {
  return new D1DocumentStore(env.DB, getServerConfig(env).defaultExpireDays);
}
