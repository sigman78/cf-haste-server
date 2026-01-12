# Haste - Cloudflare Workers Edition

A modern, cloud-native version of Haste pastebin server, rebuilt for Cloudflare Workers with D1 database.

## What's New

This is a complete modernization of the original Haste server:

### 🚀 Modern Stack
- **Cloudflare Workers** - Serverless edge computing for global performance
- **Hono** - Fast, lightweight web framework for Workers
- **D1 Database** - Cloudflare's SQLite database for reliable storage
- **TypeScript** - Full type safety across frontend and backend
- **Vite** - Modern bundler with HMR for fast development
- **Vanilla TS** - Removed jQuery dependency, using modern DOM APIs

### ✨ Key Improvements
- **Global Edge Deployment** - Deploy to 300+ data centers worldwide
- **Zero Cold Starts** - Workers runtime is always warm
- **Built-in CDN** - Static assets served from edge automatically
- **Modern JavaScript** - ES2022 syntax, async/await, no callbacks
- **Type Safe** - TypeScript throughout the entire stack
- **Better DX** - Hot module reloading, instant deploys

## Prerequisites

- Node.js 18 or later
- npm or yarn
- Cloudflare account (free tier works!)
- Wrangler CLI (installed automatically)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Create D1 Database

```bash
npm run db:create
```

This will output a database ID. Copy it and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "haste-db"
database_id = "your-database-id-here"
```

### 3. Run Migrations

For local development:
```bash
npm run db:migrate:local
```

For production:
```bash
npm run db:migrate:remote
```

### 4. Start Development Server

```bash
npm run dev
```

Your Haste server will be available at `http://localhost:8787`

## Development

### Available Scripts

- `npm run dev` - Start local development server with hot reload
- `npm run build` - Build frontend assets with Vite
- `npm run deploy` - Build and deploy to Cloudflare
- `npm run preview` - Preview with remote resources
- `npm run type-check` - Run TypeScript type checking
- `npm run db:create` - Create new D1 database
- `npm run db:migrate:local` - Apply migrations locally
- `npm run db:migrate:remote` - Apply migrations to production

### Project Structure

```
cf-haste-server/
├── src/
│   ├── worker/          # Cloudflare Worker backend
│   │   ├── index.ts     # Main worker with Hono routes
│   │   └── storage.ts   # D1 storage implementation
│   ├── client/          # Frontend application
│   │   ├── index.html   # HTML template
│   │   ├── application.ts  # Main TypeScript application
│   │   └── *.css        # Stylesheets
│   └── shared/          # Shared types between worker and client
│       └── types.ts
├── migrations/          # D1 database migrations
│   └── 0001_create_documents_table.sql
├── dist/               # Build output (gitignored)
├── wrangler.toml       # Cloudflare configuration
├── vite.config.ts      # Vite bundler configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies and scripts
```

## Deployment

### First Time Deployment

1. **Login to Cloudflare**
   ```bash
   npx wrangler login
   ```

2. **Create and Migrate Database**
   ```bash
   npm run db:create
   # Update wrangler.toml with database_id
   npm run db:migrate:remote
   ```

3. **Build and Deploy**
   ```bash
   npm run deploy
   ```

Your Haste server will be deployed to `https://haste.YOUR-SUBDOMAIN.workers.dev`

### Continuous Deployment

After initial setup, just run:
```bash
npm run deploy
```

### Custom Domain

To use a custom domain:

1. Add your domain to Cloudflare
2. Update `wrangler.toml`:
   ```toml
   routes = [
     { pattern = "haste.example.com", custom_domain = true }
   ]
   ```
3. Deploy again

## Configuration

Edit `wrangler.toml` to configure:

```toml
[vars]
MAX_PASTE_SIZE = "400000"      # Max paste size in bytes (400KB)
KEY_LENGTH = "10"              # Length of generated paste IDs
DEFAULT_EXPIRE_DAYS = "30"     # Days until pastes expire
```

## API Endpoints

### Create Paste
```bash
POST /documents
Content-Type: text/plain

# Returns: { "key": "abc123" }
```

### Get Paste
```bash
GET /documents/:key

# Returns: { "content": "...", "key": "abc123" }
```

### Get Raw Paste
```bash
GET /raw/:key

# Returns: Plain text content
```

### Health Check
```bash
GET /health

# Returns: { "status": "ok", "timestamp": 1234567890 }
```

## Features

- ✅ Create and share pastes instantly
- ✅ Automatic syntax highlighting for 20+ languages
- ✅ Keyboard shortcuts (Ctrl+S to save, Ctrl+N for new)
- ✅ Clean, dark Solarized theme
- ✅ Direct URL sharing with language extensions
- ✅ Twitter integration for easy sharing
- ✅ Raw text endpoint for downloading
- ✅ Automatic expiration after 30 days
- ✅ Mobile-responsive design
- ✅ No accounts or login required

## Keyboard Shortcuts

- **Ctrl + S** - Save current paste
- **Ctrl + N** - Create new paste
- **Ctrl + D** - Duplicate current paste for editing
- **Ctrl + T** - Share on Twitter
- **Tab** - Insert 2 spaces (in textarea)

## Language Support

Automatic syntax highlighting for:
- JavaScript, TypeScript, Python, Ruby, PHP
- Java, C++, C#, Go, Rust
- HTML, CSS, XML, Markdown
- SQL, Bash, Shell
- And many more...

Use file extensions in URLs: `/abc123.js`, `/abc123.py`, etc.

## Monitoring & Logs

View logs in real-time:
```bash
npx wrangler tail
```

View analytics in the Cloudflare dashboard:
- Request volume
- Response times
- Error rates
- Geographic distribution

## Database Management

### View Local Database
```bash
npx wrangler d1 execute haste-db --local --command "SELECT * FROM documents LIMIT 10"
```

### View Production Database
```bash
npx wrangler d1 execute haste-db --command "SELECT * FROM documents LIMIT 10"
```

### Backup Database
```bash
npx wrangler d1 export haste-db --output backup.sql
```

## Troubleshooting

### Database Not Found
Make sure you've created the D1 database and updated `wrangler.toml` with the correct `database_id`.

### Build Errors
Clear build cache:
```bash
rm -rf dist node_modules
npm install
npm run build
```

### Worker Not Updating
Force a fresh deployment:
```bash
npm run build
npx wrangler deploy --force
```

## Migration from Original Haste

The API is compatible with the original Haste server, but:

1. **Storage**: Data is in D1, not Redis/file system
2. **No Node.js server**: Runs on Cloudflare Workers
3. **New dependencies**: Uses modern npm packages
4. **TypeScript**: Everything is typed

To migrate existing data, export from Redis/files and import to D1 using the database CLI.

## Performance

Typical response times:
- **Cold start**: N/A (Workers have no cold starts)
- **Document creation**: < 50ms
- **Document retrieval**: < 20ms
- **Static assets**: < 10ms (served from CDN edge)

## Costs

Cloudflare Workers Free Tier includes:
- 100,000 requests/day
- 10ms CPU time per request
- 5GB D1 storage
- 5 million D1 reads/day
- 100,000 D1 writes/day

Perfect for personal use or small teams!

## Contributing

This is a modernized fork. For the original project:
- [haste-server](https://github.com/seejohnrun/haste-server)
- [haste-client](https://github.com/seejohnrun/haste-client)

## License

MIT License - see original project

## Credits

- Original Haste by [John Crepezzi](https://github.com/seejohnrun)
- Modernized for Cloudflare Workers
- Built with [Hono](https://hono.dev/), [Vite](https://vitejs.dev/), and [D1](https://developers.cloudflare.com/d1/)
