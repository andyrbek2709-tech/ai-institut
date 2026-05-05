# EngHub Orchestrator Service

Event-driven background worker for EngHub platform. Listens to Redis Streams for domain events and applies orchestration rules, managing task lifecycles, dependencies, deadlines, and notifications.

## Architecture

### Overview

```
[API Layer]
    ↓
[Redis Streams] (task-events)
    ↓
[Orchestrator Service] (consumer group)
    ├─ Event Handlers (7 types)
    ├─ State Machine (7 task statuses)
    ├─ Database Service (Supabase RLS)
    └─ Notification Service (3 channels)
    ↓
[Supabase Database]
[Telegram/Email/In-App]
```

### Components

#### Redis Streams
- **Stream:** `task-events`
- **Consumer Group:** `orchestrator-group` (configurable)
- **Pattern:** XREADGROUP with acknowledgment
- **Reliability:** At-least-once processing via consumer groups

#### Event Types (13 user-triggered + 9 system)

**User-triggered:**
- `task.created` — Task created by engineer
- `file.attached` — File uploaded to task
- `task.submitted_for_review` — Ready for lead review
- `review.comment_added` — Lead/GIP adds comment
- `task.accepted_by_lead` — Lead approves for GIP review
- `task.returned_by_lead` — Lead requests rework
- `task.approved_by_gip` — GIP final approval
- `task.returned_by_gip` — GIP requests rework
- `dependency.created` — Dependency link created
- `dependent_task.approved` — Blocking task approved

**System auto-generated:**
- `deadline.approaching_2d` — Hourly check
- `deadline.approaching_1d`
- `deadline.exceeded`
- `blocking.24h/48h/72h` — Escalation ladder
- `review.timeout_lead_24h/48h` — Lead non-response
- `review.timeout_gip_24h`
- `heartbeat.check` — System health

#### Task State Machine

```
created
  ├─ (start_work) → in_progress
  └─ (await_dependency) → awaiting_data

in_progress
  ├─ (submit_for_review) → review_lead
  └─ (block_by_dependency) → awaiting_data

review_lead
  ├─ (lead_approves) → review_gip
  └─ (lead_returns) → rework

rework
  └─ (resubmit) → review_lead

review_gip
  ├─ (gip_approves) → approved [terminal]
  └─ (gip_returns) → rework

awaiting_data
  └─ (dependency_resolved) → in_progress
```

#### Handlers (7 implemented)

1. **task.created** — Initialize, notify lead
2. **task.submitted_for_review** — Validate file, transition to review_lead, notify lead
3. **task.returned (lead/gip)** — Increment rework_count, transition to rework, notify assignee
4. **task.approved_by_gip** — Transition to approved, unblock dependents, auto-publish unblock events
5. **deadline.approaching** — Update color (green/yellow/red/black), escalated notifications
6. **(Placeholder)** dependency.completed — Unblock dependent tasks
7. **(Placeholder)** blocking escalation — 24h lead reminder → 36h Telegram → 48h GIP alert

#### Database Service
- **Tables:** tasks, task_dependencies, notifications, task_history
- **Operations:**
  - `getTask()` — Fetch task state
  - `updateTaskStatus()` — Atomic status transition
  - `unblockDependentTasks()` — Cascade unblock with validation
  - `createNotification()` — Insert notification record
  - `createTaskHistory()` — Audit trail
  - `getProjectLead/Gip/User()` — Role lookups
  - `updateTaskDeadlineColor()` — UI deadline indicator

#### Notification Service
- **Channels:** In-app, Email, Telegram
- **Severity:** info, warning, error
- **Flow:** Process event → determine channel list → send async → log failures
- **Telegram:** Optional (checks for bot token)

#### State Machine
- **Validators:** validateSubmit(), validateReturn(), validateApprove()
- **Queries:** canTransition(), getNextStatus(), isTerminalStatus()
- **Idempotency:** Validates current state before transition

### Error Handling & Reliability

#### Retry Strategy
- **Mechanism:** `withRetry()` with exponential backoff
- **Retries:** 3 attempts (configurable)
- **Delay:** 1000ms base (configurable), 2^(attempt-1) multiplier
- **Retryable errors:** DatabaseError, RetryableError
- **Non-retryable:** ValidationError

#### Idempotent Processing
- **Consumer group:** Each message acknowledged only after success
- **Dead-letter:** Failed messages remain in stream, logged, re-attempted on next read
- **State validation:** All handlers check current task state before updating

#### Graceful Shutdown
- **Signals:** SIGTERM, SIGINT
- **Process:** Set flag → stop accepting new reads → close Redis → exit
- **Pending:** In-flight messages stay in group, reprocessed on restart

## Getting Started

### Prerequisites
- Node.js 20+
- Redis 6.0+
- Supabase project with required tables (see schema below)

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Set required variables:
```env
REDIS_URL=redis://localhost:6379
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
LOG_LEVEL=info
```

3. (Optional) Telegram notifications:
```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=-1001234567890
```

### Running

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

**Docker:**
```bash
docker build -t enghub-orchestrator .
docker run --env-file .env enghub-orchestrator
```

## Database Schema

Required tables (Supabase):

### tasks
```sql
CREATE TABLE tasks (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL,
  assignee_id UUID,
  status VARCHAR NOT NULL,
  deadline_at TIMESTAMP,
  deadline_color VARCHAR DEFAULT 'green',
  rework_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### task_dependencies
```sql
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY,
  parent_task_id BIGINT NOT NULL,
  dependent_task_id BIGINT NOT NULL,
  deadline TIMESTAMP,
  resolved_at TIMESTAMP,
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id),
  FOREIGN KEY (dependent_task_id) REFERENCES tasks(id)
);
```

### notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR NOT NULL,
  title VARCHAR,
  message TEXT,
  task_id BIGINT,
  channels VARCHAR[] DEFAULT '{"in_app"}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### task_history
```sql
CREATE TABLE task_history (
  id UUID PRIMARY KEY,
  task_id BIGINT NOT NULL,
  event_type VARCHAR NOT NULL,
  old_value VARCHAR,
  new_value VARCHAR,
  user_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

## Event Publishing

The API layer publishes events to Redis Stream. Example:

```javascript
// From Express/API layer
const messageId = await redis.xadd(
  'task-events',
  '*',
  'event_type', 'task.submitted_for_review',
  'task_id', '123',
  'project_id', 'uuid-here',
  'user_id', 'user-uuid',
  'metadata', JSON.stringify({ comment: 'Ready for review' }),
  'timestamp', Date.now().toString()
);
```

## Monitoring

### Logs
- **Format:** Pino with pretty-print (dev) / JSON (prod)
- **Levels:** debug, info, warn, error
- **Key events:** Service start, event processing, errors, graceful shutdown

### Health Check
```bash
# Check Redis connection
curl http://localhost:6379

# Monitor logs
docker logs -f enghub-orchestrator
```

### Metrics (Future)
- Events processed per minute
- Avg processing time per event type
- Retry count distribution
- Notification delivery success rate

## Development

### Project Structure
```
src/
├── index.ts           # Entry point, main event loop
├── config/
│   └── environment.ts # Environment loading & validation
├── redis/
│   ├── client.ts      # Redis Stream client
│   └── stream.ts      # Event type definitions
├── services/
│   ├── database.ts    # Supabase operations
│   ├── notifications.ts
│   └── state-machine.ts
├── handlers/
│   ├── index.ts       # Event processor dispatcher
│   ├── task-created.ts
│   ├── task-submitted.ts
│   ├── task-review-returned.ts
│   ├── task-approved.ts
│   └── deadline-approaching.ts
└── utils/
    ├── logger.ts
    └── errors.ts
```

### Testing
Add Jest tests for handlers and state machine:
```bash
npm test
```

## Deployment

### Docker Compose (local)
```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  orchestrator:
    build: .
    environment:
      REDIS_URL: redis://redis:6379
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
    depends_on:
      - redis
```

### Production (Kubernetes / VPS)
- Build image: `docker build -t enghub-orchestrator .`
- Push to registry
- Deploy with env vars from secrets
- Monitor with ELK stack or similar
- Set resource limits (CPU: 500m, Memory: 512Mi)

## Future Enhancements

1. **Scaling:** Multiple consumer instances with load-balanced consumer group
2. **Dead-letter queue:** Separate stream for permanently failed messages
3. **Metrics export:** Prometheus exporter for events/latencies/errors
4. **Scheduled events:** Deadline monitoring via separate scheduler (cron alternative)
5. **WebSocket integration:** Real-time notifications to frontend consumers
6. **Audit logging:** Enhanced trail for compliance
7. **Circuit breaker:** Failover for external services (Telegram, email)

## Troubleshooting

### Redis Connection Fails
```
Error: Connection refused
Solution: Check REDIS_URL, ensure Redis is running
```

### Task Stuck in review_lead
- Check `task_history` for last event
- Verify lead exists in `projects.lead_id`
- Check notification logs for delivery failures

### Events Not Processing
```bash
# Check consumer group lag
redis-cli XINFO GROUPS task-events

# Check pending messages
redis-cli XPENDING task-events orchestrator-group
```

## License

Internal use only.
