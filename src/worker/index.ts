import { Hono } from 'hono';
import type { Env } from './types';
import { api } from './api';
import { createStore } from './storage';

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// Document API: /documents, /documents/:id, /raw/:id
app.route('/', api);

// Serve static assets from Vite build
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname;

  // If path looks like a document key (e.g., /abc123 or /abc123.js or /abc123.js/fork),
  // serve index.html to let the SPA handle routing
  const isDocumentRoute = path.match(/^\/[\w-]+(\.[\w]+)?([\/\w\.-])*$/);
  // Actually existing resources should be served as default w/o worker so this is redundant
  const isAssetRoute = path.startsWith('/assets/');

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

export default {
  fetch: app.fetch,

  // Cron trigger (see wrangler.toml [triggers]) purges expired documents
  async scheduled(_controller, env, ctx) {
    const store = createStore(env);
    ctx.waitUntil(
      store
        .cleanup()
        .then((deleted) => console.log(`Cleanup: removed ${deleted} expired documents`))
        .catch((err) => console.error('Cleanup failed:', err))
    );
  },
} satisfies ExportedHandler<Env>;
