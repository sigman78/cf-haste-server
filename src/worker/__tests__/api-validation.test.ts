/** @jest-environment node */

import { api } from '../api';
import type { Env } from '../types';

const env = {
  MAX_PASTE_SIZE: '4',
  KEY_LENGTH: '10',
  DEFAULT_EXPIRE_DAYS: '30',
} as Env;

describe('document API validation', () => {
  it('rejects malformed JSON as a client error', async () => {
    const response = await api.request(
      '/documents',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      },
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Invalid JSON body' });
  });

  it('requires JSON content to be a string', async () => {
    const response = await api.request(
      '/documents',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 123 }),
      },
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: 'JSON body must contain a string content field',
    });
  });

  it('enforces paste size in UTF-8 bytes', async () => {
    const response = await api.request(
      '/documents',
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: '€€',
      },
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: 'Document exceeds maximum size of 4 bytes',
    });
  });

  it('creates IDs using the configured strategy', async () => {
    const db = {
      prepare: jest.fn(() => ({
        bind: jest.fn(() => ({
          run: jest.fn().mockResolvedValue({ meta: { changes: 1 } }),
        })),
      })),
    } as unknown as D1Database;

    const response = await api.request(
      '/documents',
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'hello',
      },
      {
        ...env,
        DB: db,
        MAX_PASTE_SIZE: '100',
        KEY_LENGTH: '16',
        KEY_STRATEGY: 'random',
      }
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      key: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/),
    });
  });
});
