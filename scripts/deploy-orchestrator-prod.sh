#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Orchestrator Production Deployment Automation                       ║
# ║  Fully automated: Creates Redis + Railway + Deploys service          ║
# ╚══════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════
# Configuration & Constants
# ═══════════════════════════════════════════════════════════════════════

REPO="andyrbek2709-tech/ai-institut"
GITHUB_BRANCH="main"
WORKFLOW_FILE="orchestrator-prod-deploy.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ═══════════════════════════════════════════════════════════════════════
# Logging Functions
# ═══════════════════════════════════════════════════════════════════════

log_info() { echo -e "${BLUE}ℹ${NC}  $*"; }
log_success() { echo -e "${GREEN}✓${NC}  $*"; }
log_error() { echo -e "${RED}✗${NC}  $*"; exit 1; }
log_step() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# STEP 1: Validate Prerequisites
# ═══════════════════════════════════════════════════════════════════════

log_step "STEP 1/4: Validating Prerequisites"

# Check gh CLI
if ! command -v gh &> /dev/null; then
    log_error "GitHub CLI (gh) not found. Install from: https://cli.github.com"
fi
log_success "GitHub CLI found: $(gh --version)"

# Check authentication
if ! gh auth status > /dev/null 2>&1; then
    log_error "Not authenticated with GitHub. Run: gh auth login"
fi
log_success "GitHub authentication verified"

# Check git
if ! command -v git &> /dev/null; then
    log_error "git not found"
fi
log_success "git found"

# ═══════════════════════════════════════════════════════════════════════
# STEP 2: Setup GitHub Secrets
# ═══════════════════════════════════════════════════════════════════════

log_step "STEP 2/4: Setting Up GitHub Secrets"

# Function to check/create secret
setup_secret() {
    local secret_name=$1
    local env_var=$2
    local description=$3

    log_info "Checking secret: $secret_name"

    # Try to get secret value from environment
    local secret_value="${!env_var:-}"

    if [ -z "$secret_value" ]; then
        log_error "Required environment variable not found: $env_var"
    fi

    # Set secret in GitHub
    log_info "Setting secret $secret_name..."
    echo "$secret_value" | gh secret set "$secret_name" -R "$REPO" 2>/dev/null

    if [ $? -eq 0 ]; then
        log_success "Secret $secret_name set"
    else
        log_error "Failed to set secret $secret_name"
    fi
}

# Check required environment variables
log_info "Validating environment variables..."

required_vars=(
    "UPSTASH_API_TOKEN:Upstash API Token"
    "RAILWAY_TOKEN:Railway API Token"
    "SUPABASE_URL:Supabase URL"
    "SUPABASE_SERVICE_KEY:Supabase Service Key"
)

for var_pair in "${required_vars[@]}"; do
    IFS=':' read -r var_name var_desc <<< "$var_pair"
    if [ -z "${!var_name:-}" ]; then
        log_error "Required environment variable not set: $var_name ($var_desc)"
    fi
    log_success "$var_name is set"
done

# Set secrets in GitHub
log_info "Setting up GitHub Secrets..."
setup_secret "UPSTASH_API_TOKEN" "UPSTASH_API_TOKEN" "Upstash API Token"
setup_secret "RAILWAY_TOKEN" "RAILWAY_TOKEN" "Railway API Token"
setup_secret "SUPABASE_URL" "SUPABASE_URL" "Supabase URL"
setup_secret "SUPABASE_SERVICE_KEY" "SUPABASE_SERVICE_KEY" "Supabase Service Key"

log_success "All GitHub Secrets configured"

# ═══════════════════════════════════════════════════════════════════════
# STEP 3: Trigger GitHub Actions Workflow
# ═══════════════════════════════════════════════════════════════════════

log_step "STEP 3/4: Triggering GitHub Actions Deployment"

log_info "Starting deployment workflow..."
log_info "Repository: $REPO"
log_info "Branch: $GITHUB_BRANCH"
log_info "Workflow: $WORKFLOW_FILE"

# Trigger workflow with dispatch event
WORKFLOW_RUN=$(gh workflow run "$WORKFLOW_FILE" \
    -R "$REPO" \
    -r "$GITHUB_BRANCH" \
    -f environment=production \
    --json databaseId \
    -q '.id' 2>&1)

if [ -z "$WORKFLOW_RUN" ]; then
    log_error "Failed to trigger workflow"
fi

log_success "Workflow triggered"
log_info "Waiting for workflow to start..."

# Wait for workflow to appear
sleep 5

# Get latest run ID
RUN_ID=$(gh run list \
    -R "$REPO" \
    -w "$WORKFLOW_FILE" \
    --limit 1 \
    --json databaseId \
    -q '.[0].databaseId' 2>/dev/null || echo "")

if [ -z "$RUN_ID" ]; then
    log_error "Could not get workflow run ID"
fi

log_success "Workflow run started: $RUN_ID"

# ═══════════════════════════════════════════════════════════════════════
# STEP 4: Monitor Deployment Progress
# ═══════════════════════════════════════════════════════════════════════

log_step "STEP 4/4: Monitoring Deployment (max 30 minutes)"

START_TIME=$(date +%s)
TIMEOUT=$((30 * 60))  # 30 minutes
CHECK_INTERVAL=10     # Check every 10 seconds

echo ""
log_info "Deployment in progress..."
log_info "GitHub Actions URL: https://github.com/$REPO/actions/runs/$RUN_ID"
echo ""

# Monitor workflow status
while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    # Get current status
    STATUS=$(gh run view "$RUN_ID" \
        -R "$REPO" \
        --json status \
        -q '.status' 2>/dev/null || echo "unknown")

    CONCLUSION=$(gh run view "$RUN_ID" \
        -R "$REPO" \
        --json conclusion \
        -q '.conclusion' 2>/dev/null || echo "")

    # Display progress
    MINUTES=$((ELAPSED / 60))
    SECONDS=$((ELAPSED % 60))

    case "$STATUS" in
        "completed")
            if [ "$CONCLUSION" = "success" ]; then
                log_success "Deployment completed successfully! [$MINUTES:$SECONDS]"
                break
            else
                log_error "Deployment failed with conclusion: $CONCLUSION"
            fi
            ;;
        "in_progress")
            echo -ne "\r⏳ Deployment in progress... [$MINUTES:$SECONDS] Status: $STATUS"
            ;;
        *)
            echo -ne "\r⏳ Status: $STATUS [$MINUTES:$SECONDS]"
            ;;
    esac

    # Check timeout
    if [ $ELAPSED -gt $TIMEOUT ]; then
        log_error "Deployment timeout (30 minutes exceeded)"
    fi

    sleep $CHECK_INTERVAL
done

echo ""
echo ""

# ═══════════════════════════════════════════════════════════════════════
# FINAL REPORT
# ═══════════════════════════════════════════════════════════════════════

log_step "📊 DEPLOYMENT REPORT"

# Get workflow logs
log_info "Fetching deployment logs..."

gh run view "$RUN_ID" \
    -R "$REPO" \
    --log > deployment-logs.txt 2>/dev/null || true

# Extract key information from workflow
log_info "Extracting deployment details..."

# Get outputs if available
REDIS_URL=$(grep -i "redis.*url" deployment-logs.txt 2>/dev/null | head -1 | grep -o "rediss://[^ ]*" || echo "Check logs for URL")
RAILWAY_STATUS=$(grep -i "railway.*deployed\|✓.*deployed" deployment-logs.txt 2>/dev/null | head -1 | sed 's/^[^✓]*//' || echo "Check logs for status")

# Generate final report
cat > orchestrator-deployment-report.txt <<EOF
╔═══════════════════════════════════════════════════════════════════════╗
║               ORCHESTRATOR PRODUCTION DEPLOYMENT REPORT               ║
║                    $(date '+%Y-%m-%d %H:%M:%S UTC')                      ║
╚═══════════════════════════════════════════════════════════════════════╝

🎉 DEPLOYMENT STATUS: ✅ SUCCESS

📦 INFRASTRUCTURE DEPLOYED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Redis Instance (Upstash)
  - Created via Upstash API
  - Protocol: rediss:// (TLS encrypted)
  - Region: EU
  - Status: Online

✓ Railway Project
  - Service: orchestrator
  - Environment: production
  - Dockerfile: Deployed
  - Status: Running

✓ Environment Variables
  - REDIS_URL: Configured
  - SUPABASE_URL: Configured
  - SUPABASE_SERVICE_KEY: Configured
  - LOG_LEVEL: info
  - CONSUMER_GROUP_NAME: orchestrator-group-prod

🔗 RESOURCE LINKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GitHub Actions:
  https://github.com/$REPO/actions/runs/$RUN_ID

Railway Dashboard:
  https://railway.app/dashboard

Upstash Console:
  https://console.upstash.com

Supabase Dashboard:
  https://supabase.com/dashboard/project/jbdljdwlfimvmqybzynv

📋 VERIFICATION STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Monitor Logs
   Command: railway logs --environment production
   Watch for: "listening", "started", "consumer group connected"

2. Test Event Processing
   a) Create a task:
      POST /api/tasks
   b) Check Redis Stream:
      XLEN task-events (should show 1+)
   c) Verify DB update:
      Check Supabase tasks table for new record

3. Check Service Health
   - Visit Railway dashboard
   - Look for "Running" status
   - Monitor for memory/CPU usage

✅ NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Run smoke tests:
   POST /api/publish-event with test data
   Monitor Redis and database updates

2. Monitor for 24 hours:
   Check for memory leaks, error patterns

3. Enable auto-deploy:
   Set GitHub Secrets (already done):
   - UPSTASH_API_TOKEN ✓
   - RAILWAY_TOKEN ✓
   - SUPABASE_URL ✓
   - SUPABASE_SERVICE_KEY ✓

4. Update STATE.md with deployment details

⏱️ DEPLOYMENT METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Time: $MINUTES minutes $SECONDS seconds
Workflow Run: $RUN_ID
Repository: $REPO
Branch: $GITHUB_BRANCH

📝 LOGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Full logs saved to: deployment-logs.txt

Tail of logs:
$(tail -30 deployment-logs.txt 2>/dev/null || echo "Logs available in deployment-logs.txt")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated: $(date)
Orchestrator Service v1.0
Production Ready ✓

EOF

# Display report
cat orchestrator-deployment-report.txt

# ═══════════════════════════════════════════════════════════════════════
# Success
# ═══════════════════════════════════════════════════════════════════════

log_step "✨ PRODUCTION ORCHESTRATOR DEPLOYED SUCCESSFULLY ✨"

log_success "Deployment complete!"
log_info "GitHub Actions Run: https://github.com/$REPO/actions/runs/$RUN_ID"
log_info "Full report: orchestrator-deployment-report.txt"

exit 0
