# API Server

Unified Node.js backend for EngHub, replacing Vercel serverless functions.

## Architecture

```
Frontend (Vercel)
    ↓ fetch('/api/...')
    ↓
API Server (Express on Railway)
    ├── Routes: /api/publish-event, /api/tasks, /api/admin-users, etc.
    ├── Config: Redis (Upstash), Supabase
    └── Middleware: Auth, CORS, Error handling
    ↓
Redis (Upstash) ← Events
Supabase (Postgres, Auth)
Orchestrator Service (Redis consumer)
```

## Quick Start

### Local Development

1. **Copy environment variables:**
   ```bash
   cp .env.example .env
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run with Docker Compose (includes Redis):**
   ```bash
   docker-compose up
   ```

   Or locally (requires Redis running):
   ```bash
   npm run dev
   ```

4. **Test the API:**
   ```bash
   curl -X POST http://localhost:3000/api/publish-event \
     -H "Content-Type: application/json" \
     -d '{"event_type": "task.created", "task_id": "123"}'
   ```

### Build for Production

```bash
npm run build
npm start
```

## Environment Variables

See `.env.example` for all available options.

**Required:**
- `REDIS_URL`: Redis connection string (local or Upstash)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase public key
- `SUPABASE_SERVICE_KEY`: Supabase secret key

**Optional:**
- `LIVEKIT_*`: Video meeting provider
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`: AI services
- `TELEGRAM_*`: Notifications

## Health Checks

- **GET /health** — Simple health check (always 200)
- **GET /ready** — Readiness check (verifies Redis connection)

## Endpoints

### Events
- **POST /api/publish-event** — Publish event to Redis Stream

### (To be migrated from Vercel)
- `/api/tasks` — Task CRUD
- `/api/admin-users` — User management
- `/api/storage-sign-url` — File upload
- `/api/notifications-create` — Notifications
- `/api/orchestrator` — AI Copilot
- And 11 more...

## Deployment (Railway)

1. **Create Railway project:**
   ```bash
   railway init
   railway link
   ```

2. **Set environment variables:**
   ```bash
   railway variables set REDIS_URL="rediss://..."
   railway variables set SUPABASE_URL="..."
   # etc.
   ```

3. **Deploy:**
   ```bash
   railway up
   ```

## Development

- **Type-safe:** TypeScript with strict mode
- **Logging:** Pino logger with structured output
- **Graceful shutdown:** Proper cleanup on SIGTERM/SIGINT
- **Error handling:** Centralized error middleware

## Next Steps

1. ✅ Basic structure + publish-event endpoint
2. ⏳ Migrate remaining Vercel API endpoints
3. ⏳ Local testing with Orchestrator
4. ⏳ Deploy to Railway
5. ⏳ Switch frontend API calls from Vercel to Railway

## Troubleshooting

**Redis connection failed:**
- Check `REDIS_URL` format
- For local: ensure Redis is running (`docker-compose up redis`)
- For Upstash: ensure firewall allows connections

**Supabase auth errors:**
- Verify `SUPABASE_SERVICE_KEY` is set (not anon key)
- Check project URL is correct

**TypeScript errors:**
```bash
npm run typecheck
```

**Build issues:**
```bash
rm -rf node_modules dist package-lock.json
npm install
npm run build
```
