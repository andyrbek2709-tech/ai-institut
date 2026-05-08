#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Complete workflow for applying database indexes and running performance tests
.DESCRIPTION
  This script guides through the entire process of:
  1. Getting SQL code to apply in Supabase
  2. Running verification checks
  3. Executing load tests
  4. Collecting performance metrics
.PARAMETER SkipBrowser
  Skip opening browser for Supabase editor
#>

param(
  [switch]$SkipBrowser = $false,
  [string]$ApiBase = "https://api-server-production-8157.up.railway.app"
)

$ErrorActionPreference = "Continue"
$sqlFile = "enghub-main\supabase\migrations\026_api_performance_indexes.sql"
$supabaseUrl = "https://app.supabase.com/project/jbdljdwlfimvmqybzynv/sql"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                            ║" -ForegroundColor Cyan
Write-Host "║  DATABASE INDEX OPTIMIZATION - COMPLETE WORKFLOW           ║" -ForegroundColor Cyan
Write-Host "║  Project: EngHub | Supabase: jbdljdwlfimvmqybzynv        ║" -ForegroundColor Cyan
Write-Host "║                                                            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Show SQL Code
Write-Host "┌─ STEP 1: Display SQL Code to Apply" -ForegroundColor Green
Write-Host "└─────────────────────────────────────" -ForegroundColor Green
Write-Host ""

if (Test-Path $sqlFile) {
  $sqlContent = Get-Content $sqlFile -Raw
  Write-Host "SQL file location: $sqlFile" -ForegroundColor Yellow
  Write-Host "File size: $($(Get-Item $sqlFile).Length) bytes" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "First 20 lines of SQL:" -ForegroundColor Cyan
  Write-Host "─" * 60 -ForegroundColor Gray
  $sqlLines = $sqlContent -split "`n"
  for ($i = 0; $i -lt [Math]::Min(20, $sqlLines.Count); $i++) {
    Write-Host $sqlLines[$i]
  }
  Write-Host "─" * 60 -ForegroundColor Gray
  Write-Host "[... $($sqlLines.Count - 20) more lines ...]" -ForegroundColor Gray
} else {
  Write-Host "ERROR: SQL file not found at $sqlFile" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "✓ SQL ready to apply" -ForegroundColor Green
Write-Host ""

# Step 2: Open Supabase Editor
Write-Host "┌─ STEP 2: Open Supabase SQL Editor" -ForegroundColor Green
Write-Host "└─────────────────────────────────────" -ForegroundColor Green
Write-Host ""
Write-Host "Opening Supabase dashboard..." -ForegroundColor Yellow

if (-not $SkipBrowser) {
  Start-Process $supabaseUrl
  Write-Host "✓ Browser opened to: $supabaseUrl" -ForegroundColor Green
} else {
  Write-Host "Skipped browser (--SkipBrowser flag)" -ForegroundColor Yellow
  Write-Host "Manual URL: $supabaseUrl" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Manual steps in Supabase:" -ForegroundColor Cyan
Write-Host "  1. Go to SQL Editor tab" -ForegroundColor White
Write-Host "  2. Click 'New Query'" -ForegroundColor White
Write-Host "  3. Copy entire SQL code from: $sqlFile" -ForegroundColor Yellow
Write-Host "  4. Paste into editor" -ForegroundColor White
Write-Host "  5. Click 'RUN' button" -ForegroundColor White
Write-Host "  6. Wait 2-5 minutes for completion" -ForegroundColor White
Write-Host "  7. Check for green 'Success' message" -ForegroundColor White
Write-Host ""

# Step 3: Verification Prompt
Write-Host "┌─ STEP 3: Verify Index Creation" -ForegroundColor Green
Write-Host "└──────────────────────────────" -ForegroundColor Green
Write-Host ""
Write-Host "After SQL execution, verify indexes in Supabase SQL Editor:" -ForegroundColor Cyan
Write-Host ""
Write-Host "SELECT indexname FROM pg_indexes WHERE tablename = 'tasks';" -ForegroundColor Yellow
Write-Host ""
Write-Host "Expected indexes:" -ForegroundColor Cyan
Write-Host "  ✓ idx_tasks_project_id" -ForegroundColor White
Write-Host "  ✓ idx_tasks_project_id_status" -ForegroundColor White
Write-Host "  ✓ idx_tasks_status" -ForegroundColor White
Write-Host ""

$verified = Read-Host "Press ENTER once SQL execution is complete and indexes are verified (or 'q' to quit)"
if ($verified -eq 'q') {
  Write-Host "Aborting." -ForegroundColor Yellow
  exit 0
}

Write-Host ""
Write-Host "✓ Indexes created" -ForegroundColor Green
Write-Host ""

# Step 4: Run Load Test
Write-Host "┌─ STEP 4: Run Load Test (100 requests)" -ForegroundColor Green
Write-Host "└────────────────────────────────────────" -ForegroundColor Green
Write-Host ""
Write-Host "Starting load test against Railway API..." -ForegroundColor Yellow
Write-Host ""

. .\load-test-performance.ps1 -Count 100 -ApiBase $ApiBase

Write-Host ""

# Step 5: Wait and Get Metrics
Write-Host "┌─ STEP 5: Collect Performance Metrics" -ForegroundColor Green
Write-Host "└─────────────────────────────────────" -ForegroundColor Green
Write-Host ""
Write-Host "Waiting 15 seconds for metrics to be recorded..." -ForegroundColor Yellow

for ($i = 15; $i -gt 0; $i--) {
  Write-Host -NoNewline "`r  Waiting: $i seconds  "
  Start-Sleep -Seconds 1
}
Write-Host ""
Write-Host ""

Write-Host "Fetching detailed metrics report..." -ForegroundColor Yellow
Write-Host ""

. .\get-metrics-report.ps1 -ApiBase $ApiBase

Write-Host ""
Write-Host "┌─ STEP 6: Final Report" -ForegroundColor Green
Write-Host "└─────────────────────" -ForegroundColor Green
Write-Host ""
Write-Host "Optimization Applied:" -ForegroundColor Cyan
Write-Host "  Date:              $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Write-Host "  Migration:         026_api_performance_indexes.sql"
Write-Host "  Indexes Created:   7 new indexes + 1 view"
Write-Host "  Target Latency:    150-300ms"
Write-Host ""
Write-Host "Database Performance:" -ForegroundColor Cyan
Write-Host "  Endpoint:          /api/tasks/:projectId"
Write-Host "  Expected Impact:   60% latency reduction (687ms → 250-300ms)"
Write-Host ""
Write-Host "  Endpoint:          /api/auto-rollback/check"
Write-Host "  Expected Impact:   70% latency reduction (1306ms → 200-250ms)"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Monitor production metrics for 15-30 minutes" -ForegroundColor White
Write-Host "  2. Verify cache stabilization (latency should decrease further)" -ForegroundColor White
Write-Host "  3. Check /api/metrics/summary for aggregated performance" -ForegroundColor White
Write-Host "  4. Update STATE.md with results" -ForegroundColor White
Write-Host ""
Write-Host "✓ Optimization workflow complete!" -ForegroundColor Green
Write-Host ""
