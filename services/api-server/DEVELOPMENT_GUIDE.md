# Development Guide

## Project Structure

```
/services/api-server/
├── src/
│   ├── config/          # External service configs
│   │   ├── environment.ts   # Env validation
│   │   ├── redis.ts         # Redis client
│   │   └── supabase.ts      # Supabase clients
│   ├── middleware/      # Express middleware
│   │   ├── auth.ts          # JWT/auth verification
│   │   ├── cors.ts          # CORS setup
│   │   └── errorHandler.ts  # Error handling
│   ├── routes/          # API route handlers
│   │   └── publish-event.ts # Example endpoint
│   ├── services/        # Business logic
│   │   └── (to be created)
│   ├── utils/           # Utilities
│   │   └── logger.ts    # Pino logger
│   └── index.ts         # Express app + server startup
├── dist/                # Compiled JS (generated)
├── Dockerfile           # Container image
├── docker-compose.yml   # Local dev stack (API + Redis)
├── railway.json         # Railway deployment config
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── .env.example         # Example env vars
└── README.md            # Quick start
```

## Creating a New Endpoint

### 1. Create Route File

Example: `src/routes/admin-users.ts`

```typescript
import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { AdminUserService } from '../services/adminUserService.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Require authentication for all routes
router.use(authMiddleware);

// POST /api/admin-users/create — Create user (admin only)
router.post('/admin-users/create', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role, dept_id } = req.body;

    if (!email || !password || !full_name || !role) {
      throw new ApiError(400, 'email, password, full_name, role are required');
    }

    const service = new AdminUserService();
    const result = await service.createUser({ email, password, full_name, role, dept_id });

    logger.info('User created', { email, role });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error('Failed to create user:', err);
    throw new ApiError(500, 'Failed to create user');
  }
});

export default router;
```

### 2. Create Service File

Example: `src/services/adminUserService.ts`

```typescript
import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role: string;
  dept_id?: string;
}

export class AdminUserService {
  private supabase = getSupabaseAdmin();

  async createUser(input: CreateUserInput) {
    // 1. Create auth user
    const { data: { user }, error: authError } = await this.supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        role: input.role,
        full_name: input.full_name,
      },
    });

    if (authError || !user) {
      throw new Error(`Auth creation failed: ${authError?.message}`);
    }

    // 2. Create app_users profile
    const { data, error } = await this.supabase
      .from('app_users')
      .insert({
        email: input.email,
        full_name: input.full_name,
        role: input.role,
        dept_id: input.dept_id || null,
        supabase_uid: user.id,
      })
      .select()
      .single();

    if (error) {
      // Cleanup: delete auth user if profile creation fails
      await this.supabase.auth.admin.deleteUser(user.id);
      throw new Error(`Profile creation failed: ${error.message}`);
    }

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: data.role,
    };
  }
}
```

### 3. Register in `src/index.ts`

```typescript
// Add to imports
import adminUserRouter from './routes/admin-users.js';

// Add to app configuration (before error handler)
app.use('/api', adminUserRouter);
```

## Common Patterns

### Error Handling

```typescript
try {
  // Do something
} catch (err) {
  if (err instanceof ApiError) throw err;
  logger.error('Operation failed:', err);
  throw new ApiError(500, 'Operation failed', { message: (err as Error).message });
}
```

### Database Queries

```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('id', userId)
  .single();

if (error) throw new Error(error.message);
return data;
```

### Publishing Events

```typescript
const redis = getRedisClient();
await redis.xadd(
  'task-events',
  '*',
  'event_type', 'task.created',
  'task_id', taskId,
  'user_id', userId,
  'timestamp', Date.now().toString()
);
```

### Logging

```typescript
logger.info('User created', { userId, email });
logger.warn('Slow operation', { duration: 1500 });
logger.error('Database error', { code: 'UNIQUE_VIOLATION' });
```

## Testing Locally

### 1. Start Services

```bash
docker-compose up
```

This starts:
- API server on http://localhost:3000
- Redis on redis://localhost:6379

### 2. Test Endpoint

```bash
curl -X POST http://localhost:3000/api/publish-event \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "task.created",
    "task_id": "123",
    "project_id": "456",
    "user_id": "789"
  }'
```

Expected response:
```json
{
  "success": true,
  "message_id": "1234567890-0",
  "event_type": "task.created"
}
```

### 3. Verify Redis Event

```bash
# Connect to Redis
docker exec -it api-server-redis-1 redis-cli

# Check events in stream
XLEN task-events
XRANGE task-events - +
```

## Debugging

### View Logs

```bash
# While docker-compose is running
docker-compose logs -f api-server
docker-compose logs -f redis
```

### TypeScript Issues

```bash
npm run typecheck
```

### Build Issues

```bash
npm run build
```

## Common Mistakes to Avoid

1. **Forgetting `await`** on async operations
   - Always: `await supabase.from(...).select()`
   - Not: `supabase.from(...).select()`

2. **Not checking for null** on query results
   - Always check `if (!data)` or use `.single()` which throws

3. **Exposing service keys** in client code
   - Use `SUPABASE_SERVICE_KEY` only in backend
   - Use `SUPABASE_ANON_KEY` in frontend

4. **Unhandled promise rejections**
   - Always `try/catch` or `.catch()` on promises

5. **Leaking errors to client**
   - Don't send internal error messages
   - Log them, return generic message

6. **Not closing connections**
   - Redis and Supabase clients auto-close on graceful shutdown
   - Check `closeRedis()` in `src/index.ts`

## Performance Tips

- **Batch queries:** Use `Promise.all()` for parallel requests
- **Pagination:** Limit results with `.range(offset, limit)`
- **Caching:** Consider Redis cache for frequently accessed data
- **Indexing:** Ensure database tables have proper indexes
- **Connection pooling:** Let Supabase SDK handle it

## Security Checklist

For each endpoint:
- [ ] Authentication required? (use `authMiddleware`)
- [ ] Authorization check? (use `requireRole([...])`)
- [ ] Input validation? (check required fields)
- [ ] SQL injection safe? (use Supabase SDK, not raw SQL)
- [ ] Rate limiting? (can be added later)
- [ ] Audit logging? (log significant operations)

## Deployment

### Local → Production

1. Push to Git: `git add . && git commit && git push`
2. Railway auto-deploys from `main` branch
3. Check deployment: Visit https://your-railway-app.up.railway.app/health
4. View logs: `railway logs`
5. Debug: `railway shell`

### Environment Variables

```bash
# Set on Railway
railway variables set REDIS_URL="rediss://..."
railway variables set SUPABASE_SERVICE_KEY="..."
# etc.
```

## Useful Commands

```bash
# Start dev server with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run built app
npm start

# Check types
npm run typecheck

# Lint code
npm run lint

# Docker: rebuild + restart
docker-compose down && docker-compose up --build

# Docker: view all logs
docker-compose logs -f

# Redis: interactive shell
docker exec -it api-server-redis-1 redis-cli
```
