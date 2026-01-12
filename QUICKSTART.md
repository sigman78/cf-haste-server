# Quick Start Guide

Get your Haste pastebin server running on Cloudflare Workers in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Cloudflare account (free tier is fine)

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Login to Cloudflare
```bash
npx wrangler login
```

### 3. Create D1 Database
```bash
npm run db:create
```

**Important**: Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "haste-db"
database_id = "paste-your-id-here"  # ← Update this line
```

### 4. Run Database Migrations

For local development:
```bash
npm run db:migrate:local
```

For production (after deploying):
```bash
npm run db:migrate:remote
```

### 5. Start Local Development Server
```bash
npm run dev
```

Visit `http://localhost:8787` to see your Haste server!

### 6. Deploy to Production
```bash
npm run deploy
```

Your Haste server is now live at `https://haste.YOUR-SUBDOMAIN.workers.dev`

## What's Next?

- **Configure**: Edit `wrangler.toml` to adjust paste size limits, expiration, etc.
- **Custom Domain**: Add your own domain in Cloudflare dashboard
- **Monitor**: View logs with `npx wrangler tail`
- **Share**: Start pasting and sharing code!

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Build frontend assets |
| `npm run deploy` | Deploy to Cloudflare |
| `npm run type-check` | Check TypeScript types |
| `npx wrangler tail` | View live logs |

## Keyboard Shortcuts

- **Ctrl + S** - Save paste
- **Ctrl + N** - New paste
- **Ctrl + D** - Duplicate & edit
- **Ctrl + T** - Share on Twitter

## Need Help?

- Full documentation: See `README-CLOUDFLARE.md`
- Cloudflare Workers docs: https://developers.cloudflare.com/workers/
- D1 Database docs: https://developers.cloudflare.com/d1/

## Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ↓
┌─────────────────┐
│ Cloudflare Edge │
│    (Workers)    │
└────────┬────────┘
         │
         ↓
    ┌────────┐
    │   D1   │
    │Database│
    └────────┘
```

- **Frontend**: TypeScript + Vite (no jQuery!)
- **Backend**: Hono framework on Workers
- **Database**: D1 (SQLite at the edge)
- **Deploy**: Global CDN, 300+ locations

Enjoy your modernized Haste server! 🚀
