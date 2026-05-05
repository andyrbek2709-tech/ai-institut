# E2E Integration Test Guide — Orchestrator System

**Objective:** Verify full chain: API → Redis → Orchestrator → Database  
**Time Required:** ~5-10 minutes  
**Prerequisites:** Docker, Node.js 20+, access to Supabase SERVICE_KEY

---

## 🚀 QUICK START (Local Docker)

### 1. Prepare Environment

```bash
cd d:\ai-institut\services\orchestrator

# Create .env.local with your Supabase credentials
cat > .env.local << 'EOF'
REDIS_URL=redis://redis:6379
SUPABASE_URL=https://jbdljdwlfimvmqybzynv.supabase.co
SUPABASE_SERVICE_KEY=<PASTE_YOUR_SERVICE_KEY_HERE>
LOG_LEVEL=debug
EOF
```

**Where to find SERVICE_KEY:**
- Vercel Dashboard → enghub project → Settings → Environment Variables → SUPABASE_SERVICE_KEY

### 2. Start Services

```bash
# Terminal 1: Start Redis + Orchestrator
docker-compose up

# Wait for output:
# orchestrator-1  | [timestamp] INFO: Orchestrator service started
# orchestrator-1  | [timestamp] INFO: Consumer group created
# orchestrator-1  | [timestamp] INFO: Listening for events...
```

### 3. Test Event Publishing

```bash
# Terminal 2: Test publish endpoint
curl -X POST http://localhost:3000/api/publish-event \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "task.created",
    "task_id": "test-task-001",
    "project_id": "test-proj-001",
    "user_id": "test-user-001",
    "metadata": {"title": "Test Task"}
  }'

# Expected Response:
# {
#   "success": true,
#   "message_id": "1683100000000-0",
#   "event_type": "task.created"
# }
```

### 4. Verify Event Processing

```bash
# Check Orchestrator logs for handler execution
docker-compose logs -f orchestrator | grep -i "task.created"

# Expected output:
# orchestrator-1  | [timestamp] [DEBUG] Processing event: task.created
# orchestrator-1  | [timestamp] [INFO] handlers/task-created: Notifying lead for task test-task-001
```

### 5. Verify Redis Stream

```bash
# Terminal 3: Check Redis stream
docker exec orchestrator-redis-1 redis-cli

# In redis-cli:
127.0.0.1:6379> XLEN task-events
(integer) 1   # One message in the stream

127.0.0.1:6379> XRANGE task-events - +
1) 1) "1683100000000-0"
   2) 1) "event_type"
      2) "task.created"
      3) "task_id"
      4) "test-task-001"
      5) "project_id"
      6) "test-proj-001"
      ...

127.0.0.1:6379> XINFO GROUPS task-events
1) 1) "name"
   2) "orchestrator-group"
   3) "consumers"
   4) (integer) 1
   5) "pending"
   6) (integer) 0   # All messages acknowledged
```

### 6. Verify Database Update

```bash
# Check Supabase for task history
# Use Supabase Studio or query:
SELECT * FROM task_history 
WHERE task_id = 'test-task-001' 
ORDER BY created_at DESC 
LIMIT 1;

# Expected columns:
# task_id: test-task-001
# event_type: task.created
# old_status: NULL
# new_status: created
# changed_by: test-user-001
# created_at: [current timestamp]
```

---

## 📋 TEST SCENARIOS

### Scenario 1: Task Creation Flow

```bash
# 1. Publish task.created event
curl -X POST http://localhost:3000/api/publish-event \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "task.created",
    "task_id": "scenario-1-task",
    "project_id": "scenario-1-proj",
    "user_id": "engineer-001"
  }'

# 2. Verify in logs (within 1 second)
docker-compose logs orchestrator | tail -20

# 3. Check database
SELECT * FROM task_history WHERE task_id = 'scenario-1-task';
# Expected: 1 row with event_type='task.created'

# 4. Check notification was created (if lead found)
SELECT * FROM notifications 
WHERE created_at > NOW() - INTERVAL '10 seconds'
ORDER BY created_at DESC;
```

### Scenario 2: Task Submission & Approval Flow

```bash
# 1. Create task
curl -X POST http://localhost:3000/api/publish-event \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "task.created",
    "task_id": "scenario-2-task",
    "project_id": "scenario-2-proj",
    "user_id": "engineer-002"
  }'

# Wait 1 second

# 2. Submit for review
curl -X POST http://localhost:3000/api/publish-event \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "task.submitted_for_review",
    "task_id": "scenario-2-task",
    "project_id": "scenario-2-proj",
    "user_id": "engineer-002",
    "metadata": {"submission_note": "Ready for lead review"}
  }'

# Wait 1 second

# 3. Approve task
curl -X POST http://localhost:3000/api/publish-event \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "task.approved_by_gip",
    "task_id": "scenario-2-task",
    "project_id": "scenario-2-proj",
    "user_id": "gip-001"
  }'

# 4. Verify full history
SELECT event_type, COUNT(*) FROM task_history 
WHERE task_id = 'scenario-2-task'
GROUP BY event_type;

# Expected: 3 rows
# - task.created
# - task.submitted_for_review
# - task.approved_by_gip
```

### Scenario 3: Error Handling & Retry

```bash
# 1. Publish invalid event (missing required fields)
curl -X POST http://localhost:3000/api/publish-event \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "task.created"
    # Missing task_id, project_id, user_id
  }'

# 2. Verify error handling in logs
docker-compose logs orchestrator | grep -i "error\|validation"

# 3. Check that event was retried (check xpending count)
docker exec orchestrator-redis-1 redis-cli XPENDING task-events orchestrator-group

# Expected behavior: 
# - Error logged
# - Message remains in stream
# - Retry attempted (up to 3 times)
# - After max retries: logged and skipped
```

---

## 🔍 DIAGNOSTIC COMMANDS

### Check All Consumers

```bash
docker exec orchestrator-redis-1 redis-cli
> XINFO GROUPS task-events

# Output shows:
# - name: orchestrator-group
# - consumers: 1 (or more if scaled)
# - pending: 0 (all acknowledged)
```

### Check Event Processing Rate

```bash
# Method 1: Redis stream length over time
watch -n 1 'docker exec orchestrator-redis-1 redis-cli XLEN task-events'

# Method 2: Real-time logs
docker-compose logs -f orchestrator | grep -i "processing\|handler"
```

### Check for Failures

```bash
# Check orchestrator error logs
docker-compose logs orchestrator | grep -E "ERROR|error|Error"

# Check database for failed tasks
SELECT task_id, COUNT(*) as history_count 
FROM task_history 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY task_id
HAVING history_count = 1;  -- Only created, not progressed (stuck tasks)
```

### Memory & Performance

```bash
# Docker stats
docker stats orchestrator

# Expected:
# CONTAINER CPU % MEM USAGE NET I/O
# orchestrator-1 <10% <200MB <1MB
```

---

## 🛑 CLEANUP

```bash
# Stop all services
docker-compose down

# Remove volumes (clean state)
docker-compose down -v

# Check container status
docker ps | grep orchestrator

# Remove .env.local
rm services/orchestrator/.env.local
```

---

## ✅ SUCCESS CRITERIA

Test is **PASSED** if all of the following are true:

1. ✓ Orchestrator starts without errors
2. ✓ Consumer group created: `orchestrator-group`
3. ✓ Events published to Redis stream: `task-events`
4. ✓ Handler executes within 1 second of publish
5. ✓ task_history table receives new records
6. ✓ Notifications created (if users found in project)
7. ✓ All messages acknowledged (XPENDING = 0)
8. ✓ Graceful shutdown (SIGTERM received)
9. ✓ No memory leaks (memory stable after 1min)
10. ✓ Error handling works (invalid events logged, not crashed)

---

## 🚨 COMMON ISSUES & FIXES

| Issue | Solution |
|-------|----------|
| `Connection refused: 127.0.0.1:6379` | Redis not running: `docker-compose up -d redis` |
| `Supabase 401: Invalid API token` | Check SERVICE_KEY in .env.local, copy from Vercel |
| `Consumer group already exists` | Change CONSUMER_GROUP_NAME in .env.local |
| `XREAD timeout` | Normal behavior, wait for next batch of events |
| `Handler execution error` | Check logs: `docker-compose logs orchestrator` |
| `Memory usage > 500MB` | Possible memory leak, check event handler cleanup |

---

## 📊 SAMPLE TEST RESULTS

```
=== E2E TEST EXECUTION ===

Test Start: 2026-05-05 14:32:00 UTC

✓ Services Started
  - Redis: OK (6379)
  - Orchestrator: OK (listening)
  - Consumer Group: OK (orchestrator-group)

✓ Event Publishing
  - task.created: message_id=1683100000000-0
  - task.submitted_for_review: message_id=1683100001000-0
  - task.approved_by_gip: message_id=1683100002000-0

✓ Event Processing
  - Consumed: 3 events
  - Processed: 3 events
  - Failed: 0 events
  - Duration: 523ms total

✓ Database Updates
  - task_history: 3 new records
  - notifications: 2 created (lead, team)
  - task_dependencies: resolved_at updated (auto-unblock)

✓ Reliability
  - Acknowledgments: 3/3 (100%)
  - Retries used: 0
  - Message loss: 0
  - Duplicates: 0

=== TEST PASSED ===
Duration: 5m 43s
All systems operational ✓
```

---

**Last Updated:** 2026-05-05 14:30 UTC  
**Orchestrator Version:** v1.0  
**Test Framework:** Docker Compose + Redis CLI  
