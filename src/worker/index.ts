import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, SaveResponse, GetResponse } from '../shared/types';
import { createStore } from './storage';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// Get document by key
app.get('/documents/:id', async (c) => {
  const key = c.req.param('id');

  // Special handling for "about" - load from about.md static file
  if (key === 'about') {
    try {
      const aboutUrl = new URL(c.req.url);
      aboutUrl.pathname = '/_about.md';
      const aboutResponse = await c.env.ASSETS.fetch(new Request(aboutUrl.toString(), { method: 'GET' }));

      if (aboutResponse.ok) {
        const content = await aboutResponse.text();
        const response: GetResponse = {
          content,
          key: 'about',
        };
        return c.json(response);
      }
    } catch (error) {
      console.error('Error loading about.md:', error);
    }
    return c.json({ message: 'Document not found' }, 404);
  }

  const store = createStore(c.env);

  try {
    const content = await store.get(key);

    if (!content) {
      return c.json({ message: 'Document not found' }, 404);
    }

    const response: GetResponse = {
      content,
      key,
    };

    return c.json(response);
  } catch (error) {
    console.error('Error retrieving document:', error);
    return c.json({ message: 'Error retrieving document' }, 500);
  }
});

// Create new document
app.post('/documents', async (c) => {
  const store = createStore(c.env);
  const maxSize = parseInt(c.env.MAX_PASTE_SIZE || '400000');
  const keyLength = parseInt(c.env.KEY_LENGTH || '10');

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

    if (content.length > maxSize) {
      return c.json(
        { message: `Document exceeds maximum size of ${maxSize} bytes` },
        400
      );
    }

    // Generate unique key and save
    const key = await store.generateKey(keyLength);
    await store.set(key, content);

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
app.get('/raw/:id', async (c) => {
  const key = c.req.param('id');
  const store = createStore(c.env);

  try {
    const content = await store.get(key);

    if (!content) {
      return c.text('Document not found', 404);
    }

    return c.text(content, 200, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
  } catch (error) {
    console.error('Error retrieving raw document:', error);
    return c.text('Error retrieving document', 500);
  }
});

// Serve static assets from Vite build
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname;

  // If path looks like a document key (e.g., /abc123 or /abc123.js),
  // serve index.html to let the SPA handle routing
  const isDocumentRoute = path.match(/^\/[a-zA-Z0-9]+(\.[a-z]+)?$/);
  const isAssetRoute = path.startsWith('/assets/') || path.endsWith('.css') ||
                       path.endsWith('.png') || path.endsWith('.txt');

  if (isDocumentRoute && !isAssetRoute) {
    // Rewrite to index.html for SPA routing
    // Create a clean GET request to avoid issues with ASSETS binding
    const indexUrl = new URL(c.req.url);
    indexUrl.pathname = '/index.html';
    return c.env.ASSETS.fetch(new Request(indexUrl.toString(), { method: 'GET' }));
  }

  // Forward all other requests to the static assets
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
