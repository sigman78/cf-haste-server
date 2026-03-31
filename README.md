```
 _   _           _
| | | | __ _ ___| |_ ___
| |_| |/ _` / __| __/ _ \
|  _  | (_| \__ \ ||  __/
|_| |_|\__,_|___/\__\___|

Cloudflare Workers Edition
```

> Original [haste-server](https://github.com/seejohnrun/haste-server) by John Crepezzi, modernized for Cloudflare's edge network.

A pastebin that runs on Cloudflare Workers. [Demo](https://haste.sigman78.workers.dev/)

## Why this fork

The original runs on Node.js + Redis. This version drops both: Workers replace the server, D1 (SQLite at the edge) replaces Redis. No cold starts, global distribution, fits in the free tier for personal use.

Rewritten in TypeScript with Vite, no jQuery.

## Quick start

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

Your instance will be live at `https://haste.YOUR-SUBDOMAIN.workers.dev`.

## Config

Edit `wrangler.toml` vars:

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

## License

MIT. Original Haste by [John Crepezzi](https://github.com/seejohnrun).
