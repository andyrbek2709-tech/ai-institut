#!/bin/bash
# Architecture regression guard — blocks forbidden patterns before they reach production.
# Run in CI or pre-commit: bash scripts/validate-architecture.sh

ERRORS=0
FRONTEND_SRC="enghub-main/src"

red()   { echo -e "\033[31m[FAIL]\033[0m $1"; }
green() { echo -e "\033[32m[OK]\033[0m $1"; }
warn()  { echo -e "\033[33m[WARN]\033[0m $1"; }

echo "=== EngHub Architecture Validator ==="
echo ""

# ─── RULE 1: No relative /api calls in frontend TypeScript/TSX ───────────────
echo "--- Rule 1: No relative /api calls ---"
HITS=$(grep -rn "fetch(['\"\`]/api/" "$FRONTEND_SRC" --include="*.ts" --include="*.tsx" \
  | grep -v "\.legacy\." | grep -v "node_modules" || true)
if [ -n "$HITS" ]; then
  red "Relative /api fetch() calls found (use REACT_APP_RAILWAY_API_URL instead):"
  echo "$HITS"
  ERRORS=$((ERRORS+1))
else
  green "No relative /api fetch() calls"
fi

# ─── RULE 2: No Vercel URLs in source ────────────────────────────────────────
echo "--- Rule 2: No Vercel references ---"
VERCEL_HITS=$(grep -rn "vercel\.app\|vercel\.com\|VERCEL_URL\|vercel-functions\|vercel\.json" \
  "$FRONTEND_SRC" "services/" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" \
  | grep -v "node_modules" | grep -v "dist/" | grep -v "DECOMMISSIONED\|decommissioned\|PURGED\|legacy" || true)
if [ -n "$VERCEL_HITS" ]; then
  red "Vercel references found (Vercel is PERMANENTLY DECOMMISSIONED):"
  echo "$VERCEL_HITS"
  ERRORS=$((ERRORS+1))
else
  green "No Vercel references in source"
fi

# ─── RULE 3: No VITE_API_BASE_URL env var usage (old Vite era) ───────────────
echo "--- Rule 3: No VITE_API_BASE_URL usage ---"
VITE_HITS=$(grep -rn "VITE_API_BASE_URL" "$FRONTEND_SRC" --include="*.ts" --include="*.tsx" | grep -v "node_modules" || true)
if [ -n "$VITE_HITS" ]; then
  red "VITE_API_BASE_URL found — use REACT_APP_RAILWAY_API_URL instead:"
  echo "$VITE_HITS"
  ERRORS=$((ERRORS+1))
else
  green "No VITE_API_BASE_URL usage"
fi

# ─── RULE 4: No sticky-routing or multi-provider logic in new code ────────────
echo "--- Rule 4: No deprecated rollout/sticky-routing in new code ---"
ROLLOUT_HITS=$(grep -rn "sticky.routing\|api-rollout\|api-selection" "$FRONTEND_SRC" \
  --include="*.ts" --include="*.tsx" \
  | grep -v "node_modules" | grep -v "\.legacy\." || true)
if [ -n "$ROLLOUT_HITS" ]; then
  warn "Sticky-routing / rollout logic referenced (should be dead code):"
  echo "$ROLLOUT_HITS"
  # Warning only — legacy files may still import these
else
  green "No deprecated rollout/sticky-routing references"
fi

# ─── RULE 5: API server has diagnostics endpoint ─────────────────────────────
echo "--- Rule 5: Diagnostics route exists ---"
if [ -f "services/api-server/src/routes/diagnostics.ts" ]; then
  green "diagnostics.ts route exists"
else
  red "services/api-server/src/routes/diagnostics.ts missing"
  ERRORS=$((ERRORS+1))
fi

# ─── RULE 6: No enghub-frontend directory (stale duplicate) ──────────────────
echo "--- Rule 6: No enghub-frontend duplicate directory ---"
if [ -d "enghub-frontend" ]; then
  warn "enghub-frontend/ still exists — should be removed (use enghub-main/)"
  # Warning only — may not be fatal
else
  green "enghub-frontend/ not present"
fi

# ─── RULE 7: Frontend Dockerfile has ARG for REACT_APP_* ─────────────────────
echo "--- Rule 7: Dockerfile declares REACT_APP_RAILWAY_API_URL ARG ---"
if grep -q "ARG REACT_APP_RAILWAY_API_URL" "enghub-main/Dockerfile" 2>/dev/null; then
  green "Dockerfile has REACT_APP_RAILWAY_API_URL ARG"
else
  red "enghub-main/Dockerfile missing ARG REACT_APP_RAILWAY_API_URL"
  ERRORS=$((ERRORS+1))
fi

echo ""
echo "=============================="
if [ $ERRORS -eq 0 ]; then
  echo -e "\033[32m✅ All architecture checks passed\033[0m"
  exit 0
else
  echo -e "\033[31m❌ $ERRORS check(s) failed — fix before deploying\033[0m"
  exit 1
fi
