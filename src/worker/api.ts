/**
 * Document API routes: create, fetch (JSON), fetch (raw).
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from './types';
import type { GetResponse, SaveResponse } from '../shared/types';
import { createStore } from './storage';
import { getServerConfig, type ServerConfig } from './config';

type AppContext = Context<{ Bindings: Env }>;

export const api = new Hono<{ Bindings: Env }>();

// Markdown pages served from static assets but presented as read-only pastes
const PUBLIC_MD_PAGES: Record<string, string> = {
  about: '/_about.md',
};

function applyDocumentCacheHeaders(c: AppContext, config: ServerConfig): void {
  const isLocalDev = !c.req.raw.cf;
  if (isLocalDev) return;

  if (config.browserCacheMaxAge > 0) {
    c.header('Cache-Control', `public, max-age=${config.browserCacheMaxAge}, immutable`);
  }
  if (config.cdnCacheMaxAge > 0) {
    const value =
      config.cdnStaleWhileRevalidate > 0
        ? `public, max-age=${config.cdnCacheMaxAge}, stale-while-revalidate=${config.cdnStaleWhileRevalidate}`
        : `public, max-age=${config.cdnCacheMaxAge}`;
    c.header('Cloudflare-CDN-Cache-Control', value);
  }
}

function countViewInBackground(c: AppContext, key: string): void {
  const store = createStore(c.env);
  c.executionCtx.waitUntil(
    store.incrementViews(key).catch((err) => console.error('View count update failed:', err))
  );
}

// Get document by key
api.get('/documents/:id', async (c) => {
  const key = c.req.param('id');
  const config = getServerConfig(c.env);

  // Handle "special" pastes
  if (key in PUBLIC_MD_PAGES) {
    try {
      const pageUrl = new URL(c.req.url);
      pageUrl.pathname = PUBLIC_MD_PAGES[key];
      const pageResponse = await c.env.ASSETS.fetch(
        new Request(pageUrl.toString(), { method: 'GET' })
      );

      if (pageResponse.ok) {
        const content = await pageResponse.text();
        const response: GetResponse = {
          content,
          key,
          frozen: true,
        };
        applyDocumentCacheHeaders(c, config);
        return c.json(response);
      }
    } catch (error) {
      console.error('Error loading public file:', error);
    }
    return c.json({ message: 'Document not found' }, 404);
  }

  const store = createStore(c.env);

  try {
    const content = await store.get(key);

    if (content === null) {
      return c.json({ message: 'Document not found' }, 404);
    }

    countViewInBackground(c, key);

    const response: GetResponse = {
      content,
      key,
    };

    applyDocumentCacheHeaders(c, config);
    return c.json(response);
  } catch (error) {
    console.error('Error retrieving document:', error);
    return c.json({ message: 'Error retrieving document' }, 500);
  }
});

// Create new document
api.post('/documents', async (c) => {
  const store = createStore(c.env);
  const config = getServerConfig(c.env);

  try {
    const contentType = c.req.header('content-type') || '';
    let content: string;

    if (contentType.includes('application/json')) {
      const body = await c.req.json<{ content: string }>();
      content = body.content || '';
    } else {
      content = await c.req.text();
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      return c.json({ message: 'No content provided' }, 400);
    }

    if (content.length > config.maxPasteSize) {
      return c.json(
        { message: `Document exceeds maximum size of ${config.maxPasteSize} bytes` },
        400
      );
    }

    const key = await store.create(content, config.keyLength);

    const response: SaveResponse = {
      key,
    };

    return c.json(response, 201);
  } catch (error) {
    console.error('Error saving document:', error);
    return c.json({ message: 'Error saving document' }, 500);
  }
});

// Raw document endpoint (for copy/download)
api.get('/raw/:id', async (c) => {
  const key = c.req.param('id');
  const store = createStore(c.env);

  try {
    const content = await store.get(key);

    if (content === null) {
      return c.text('Document not found', 404);
    }

    countViewInBackground(c, key);

    applyDocumentCacheHeaders(c, getServerConfig(c.env));
    return c.text(content, 200, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
  } catch (error) {
    console.error('Error retrieving raw document:', error);
    return c.text('Error retrieving document', 500);
  }
});
