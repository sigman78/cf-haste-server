import type { DocumentStore, Env } from '../shared/types';

export class D1DocumentStore implements DocumentStore {
  constructor(
    private db: D1Database,
    private defaultExpireDays: number = 30
  ) {}

  async get(key: string): Promise<string | null> {
    const now = Math.floor(Date.now() / 1000);

    // Get document and check if it's expired
    const result = await this.db
      .prepare(
        `SELECT content, expires_at FROM documents
         WHERE id = ? AND (expires_at IS NULL OR expires_at > ?)`
      )
      .bind(key, now)
      .first<{ content: string; expires_at: number | null }>();

    if (!result) {
      return null;
    }

    // Update view count
    await this.db
      .prepare('UPDATE documents SET views = views + 1 WHERE id = ?')
      .bind(key)
      .run();

    return result.content;
  }

  async set(key: string, content: string, expireDays?: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const days = expireDays ?? this.defaultExpireDays;
    const expiresAt = days > 0 ? now + (days * 24 * 60 * 60) : null;

    await this.db
      .prepare(
        `INSERT INTO documents (id, content, created_at, expires_at, views)
         VALUES (?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET
           content = excluded.content,
           created_at = excluded.created_at,
           expires_at = excluded.expires_at`
      )
      .bind(key, content, now, expiresAt)
      .run();
  }

  async generateKey(length: number, ensureNew: boolean = false): Promise<string> {
    const keyLength = length > 6 ? length : 6;
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    const vowels = 'aeiou';
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let key = '';
      for (let i = 0; i < length; i++) {
        key += pick((i % 3) == 1 ? vowels : consonants);
        if (i % 6 == 5) key += "-";
      }

      if (!ensureNew) return key;

      // Check if key exists
      const exists = await this.db
        .prepare('SELECT 1 FROM documents WHERE id = ?')
        .bind(key)
        .first();

      if (!exists) {
        return key;
      }

      attempts++;
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
  const expireDays = parseInt(env.DEFAULT_EXPIRE_DAYS || '30');
  return new D1DocumentStore(env.DB, expireDays);
}
