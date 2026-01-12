```
 _   _           _
| | | | __ _ ___| |_ ___
| |_| |/ _` / __| __/ _ \
|  _  | (_| \__ \ ||  __/
|_| |_|\__,_|___/\__\___|

Cloudflare Workers Edition
```

> **Note:** This is a modernized version of Haste rebuilt for Cloudflare Workers with D1 database, TypeScript, and Vite. For the original Node.js version, see [seejohnrun/haste-server](https://github.com/seejohnrun/haste-server).

Modern, cloud-native pastebin server running on Cloudflare's global edge network.

## What is Haste?

Haste is an open-source pastebin that makes sharing code and text incredibly simple. Type, save, share - that's it.

**Major design objectives:**
* Be really pretty
* Be really simple
* Be easy to set up and use

## This Modernized Version

This version has been completely rewritten for the modern web:

- **Global Edge Deployment** - Runs on Cloudflare's 300+ data centers worldwide
- **Zero Cold Starts** - Always-on Workers runtime
- **D1 Database** - SQLite at the edge for reliable persistence
- **Modern Stack** - TypeScript, Vite, Hono framework
- **No jQuery** - Pure TypeScript with modern DOM APIs
- **Tested** - Comprehensive test suite included

## Quick Start

```bash
# Install dependencies
npm install

# Setup database
npm run db:migrate:local

# Start development server
npm run dev
```

Visit `http://localhost:8787` and start pasting!

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Runtime** | Cloudflare Workers |
| **Backend** | Hono (lightweight web framework) |
| **Database** | D1 (Cloudflare's SQLite) |
| **Frontend** | TypeScript + Vite |
| **Build** | Vite 6.x |
| **Deploy** | Wrangler CLI |

## Testing

```bash
# Run automated test suite
npm test

# Inspect database
npm run db:inspect

# Run custom queries
npm run db:query "SELECT * FROM documents"
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local development server |
| `npm run build` | Build frontend assets |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm test` | Run API test suite |
| `npm run db:migrate:local` | Run database migrations locally |
| `npm run db:migrate:remote` | Run migrations in production |
| `npm run db:inspect` | View recent documents in database |

## Deployment

### Local Development
Already set up! Just run `npm run dev`.

### Production Deployment

1. **Create D1 database:**
   ```bash
   npm run db:create
   ```
   Update `wrangler.toml` with the returned `database_id`

2. **Run migrations:**
   ```bash
   npm run db:migrate:remote
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

Your Haste server will be live at `https://haste.YOUR-SUBDOMAIN.workers.dev`

## Configuration

Edit `wrangler.toml`:

```toml
[vars]
MAX_PASTE_SIZE = "400000"      # Max paste size (400KB)
KEY_LENGTH = "10"              # Length of paste IDs
DEFAULT_EXPIRE_DAYS = "30"     # Days until expiration
```

## Usage

### Web Interface

- Type or paste your content
- Press **Ctrl+S** to save
- Share the URL

### Keyboard Shortcuts

- **Ctrl + S** - Save paste
- **Ctrl + N** - New paste
- **Ctrl + D** - Duplicate & edit
- **Ctrl + T** - Share on Twitter

### API

```bash
# Create paste
curl -X POST http://localhost:8787/documents \
  -H "Content-Type: text/plain" \
  -d "your content here"

# Get paste
curl http://localhost:8787/documents/YOUR_KEY

# Get raw content
curl http://localhost:8787/raw/YOUR_KEY
```

## Migration from Original Haste

This version is API-compatible but uses different infrastructure:

- **Storage**: D1 instead of Redis/file system
- **Runtime**: Cloudflare Workers instead of Node.js
- **Dependencies**: Modern packages, no legacy dependencies

To migrate data, export from your old storage and import to D1 using:
```bash
npm run db:query "INSERT INTO documents (id, content, created_at, expires_at) VALUES (?, ?, ?, ?)"
```

## Performance

- **Document creation**: < 50ms
- **Document retrieval**: < 20ms
- **Static assets**: < 10ms (CDN edge)
- **Global latency**: < 50ms (99th percentile)

## Cost

Cloudflare Workers Free Tier includes:
- 100,000 requests/day
- 10ms CPU time per request
- 5GB D1 storage
- 5 million D1 reads/day
- 100,000 D1 writes/day

Perfect for personal use or small teams!

## Contributing

This is a modernized fork. For issues specific to this Cloudflare version, please open an issue in this repository.

For the original Haste project:
- [haste-server](https://github.com/seejohnrun/haste-server) - Original server
- [haste-client](https://github.com/seejohnrun/haste-client) - CLI client

## License

MIT License

Original Haste by [John Crepezzi](https://github.com/seejohnrun)
Cloudflare Workers modernization - 2026

