#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Orchestrator Service — Deploy Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Step 1: Check prerequisites
echo -e "${YELLOW}📋 Step 1: Checking prerequisites...${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install Node.js >= 20${NC}"
    exit 1
fi

if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}⚠️  Railway CLI not found. Installing...${NC}"
    npm install -g @railway/cli
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}\n"

# Step 2: Check environment file
echo -e "${YELLOW}📋 Step 2: Checking environment variables...${NC}"

if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production not found${NC}"
    echo -e "${YELLOW}Please create .env.production with:${NC}"
    echo -e "  REDIS_URL=rediss://default:xxxxx@xxxxx.upstash.io:xxxxx"
    echo -e "  SUPABASE_URL=https://jbdljdwlfimvmqybzynv.supabase.co"
    echo -e "  SUPABASE_SERVICE_KEY=eyJ..."
    echo -e "\nSee DEPLOYMENT.md for full setup guide."
    exit 1
fi

# Load environment
set -a
source .env.production
set +a

# Validate required variables
for var in REDIS_URL SUPABASE_URL SUPABASE_SERVICE_KEY; do
    if [ -z "${!var:-}" ]; then
        echo -e "${RED}❌ Missing required variable: $var${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✓ Environment variables loaded${NC}\n"

# Step 3: Login to Railway
echo -e "${YELLOW}📋 Step 3: Authenticating with Railway...${NC}"

if [ -z "${RAILWAY_TOKEN:-}" ]; then
    echo -e "${YELLOW}⚠️  RAILWAY_TOKEN not set. Opening Railway dashboard...${NC}"
    echo -e "Please get your token from: https://railway.app/account/tokens"
    echo -e "Then set: export RAILWAY_TOKEN=your_token"

    read -p "Enter RAILWAY_TOKEN: " RAILWAY_TOKEN
    export RAILWAY_TOKEN
fi

echo -e "${GREEN}✓ Railway authentication OK${NC}\n"

# Step 4: Deploy to Railway
echo -e "${YELLOW}📋 Step 4: Deploying to Railway...${NC}"

railway up --force

echo -e "${GREEN}✓ Deployment initiated${NC}\n"

# Step 5: Verify deployment
echo -e "${YELLOW}📋 Step 5: Verifying deployment...${NC}"

sleep 10

echo -e "\n${BLUE}Checking logs...${NC}"
railway logs orchestrator --tail -n 20

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  ✓ Orchestrator deployed successfully!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Monitor logs: railway logs orchestrator --follow"
echo -e "2. Check Redis: redis-cli -u \$REDIS_URL XLEN task-events"
echo -e "3. Create a task in EngHub: https://enghub-three.vercel.app"
echo -e "4. Verify event in logs (should see 'Processing event: task.created')\n"

echo -e "${YELLOW}For detailed troubleshooting, see DEPLOYMENT.md${NC}"
