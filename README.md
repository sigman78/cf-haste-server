# cf-haste

A pastebin that runs on Cloudflare Workers. [Demo](https://haste.sigman78.workers.dev/)

Fork of [haste-server](https://github.com/seejohnrun/haste-server) rewritten for the edge: no Node.js, no Redis, no cold starts. Uses D1 (SQLite) for storage and Vite + TypeScript on the frontend.

## Setup

```bash
npm install
npm run db:migrate:local
npm run dev          # http://localhost:8787
```

## Deploy

```bash
npx wrangler d1 create haste-db   # copy the database_id into wrangler.toml
npm run db:migrate:remote
npm run deploy
```

## Config

`wrangler.toml` vars:

| Variable              | Default | Description             |
| --------------------- | ------- | ----------------------- |
| `MAX_PASTE_SIZE`      | 400000  | Max paste size in bytes |
| `KEY_LENGTH`          | 10      | Length of paste IDs     |
| `DEFAULT_EXPIRE_DAYS` | 30      | Days until expiration   |

## API

```bash
curl -X POST https://your-worker.dev/documents -H "Content-Type: text/plain" -d "code here"
curl https://your-worker.dev/documents/KEY
curl https://your-worker.dev/raw/KEY
```

## Shortcuts

| Action     | Shortcut            |
| ---------- | ------------------- |
| Save       | Ctrl+Enter / Ctrl+S |
| New        | Alt+Shift+N         |
| Duplicate  | Alt+Shift+D         |
| Share on X | Alt+Shift+X         |

## Tests

```bash
npm test
```
