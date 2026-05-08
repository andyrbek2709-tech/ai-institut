#!/usr/bin/env pwsh
# Load test for API performance after index creation
# Tests: /api/tasks/:projectId and /api/auto-rollback/check

param(
  [int]$Count = 100,
  [string]$ApiBase = "https://api-server-production-8157.up.railway.app"
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  API PERFORMANCE LOAD TEST - After Index Creation         ║" -ForegroundColor Cyan
Write-Host "║  100 requests across 2 endpoints                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$taskResults = @()
$rollbackResults = @()
$projectId = 43

# Test 1: /api/tasks/:projectId (50 requests)
Write-Host "PHASE 1: Testing /api/tasks/$projectId (50 requests)" -ForegroundColor Green
$sw = [System.Diagnostics.Stopwatch]::StartNew()

for ($i = 1; $i -le 50; $i++) {
  $reqStart = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-WebRequest -Uri "$ApiBase/api/tasks/$projectId" -TimeoutSec 10 -UseBasicParsing
    $latency = $reqStart.ElapsedMilliseconds
    $taskResults += @{
      status = $response.StatusCode
      latency = $latency
      success = $true
    }
    Write-Host "  ✓ Request $i : $($response.StatusCode) OK ($latency ms)" -ForegroundColor Green
  } catch {
    $latency = $reqStart.ElapsedMilliseconds
    $taskResults += @{
      status = $_.Exception.Response.StatusCode
      latency = $latency
      success = $false
      error = $_.Exception.Message
    }
    Write-Host "  ✗ Request $i : ERROR ($latency ms)" -ForegroundColor Red
  }
}

$phase1Time = $sw.Elapsed.TotalSeconds
Write-Host "Phase 1 Time: $phase1Time seconds" -ForegroundColor Yellow
Write-Host ""

# Test 2: /api/auto-rollback/check (50 requests)
Write-Host "PHASE 2: Testing /api/auto-rollback/check (50 requests)" -ForegroundColor Green
$sw = [System.Diagnostics.Stopwatch]::StartNew()

for ($i = 1; $i -le 50; $i++) {
  $reqStart = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-WebRequest -Uri "$ApiBase/api/auto-rollback/check" -TimeoutSec 10 -UseBasicParsing
    $latency = $reqStart.ElapsedMilliseconds
    $rollbackResults += @{
      status = $response.StatusCode
      latency = $latency
      success = $true
    }
    Write-Host "  ✓ Request $i : $($response.StatusCode) OK ($latency ms)" -ForegroundColor Green
  } catch {
    $latency = $reqStart.ElapsedMilliseconds
    $rollbackResults += @{
      status = $_.Exception.Response.StatusCode
      latency = $latency
      success = $false
      error = $_.Exception.Message
    }
    Write-Host "  ✗ Request $i : ERROR ($latency ms)" -ForegroundColor Red
  }
}

$phase2Time = $sw.Elapsed.TotalSeconds
Write-Host "Phase 2 Time: $phase2Time seconds" -ForegroundColor Yellow
Write-Host ""

# Analyze results
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  RESULTS SUMMARY                                           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$taskSuccess = ($taskResults | Where-Object { $_.success }).Count
$taskLatencies = ($taskResults | Where-Object { $_.success } | Select-Object -ExpandProperty latency)
$taskAvg = if ($taskLatencies) { [math]::Round(($taskLatencies | Measure-Object -Average).Average, 2) } else { 0 }
$taskMin = if ($taskLatencies) { ($taskLatencies | Measure-Object -Minimum).Minimum } else { 0 }
$taskMax = if ($taskLatencies) { ($taskLatencies | Measure-Object -Maximum).Maximum } else { 0 }

Write-Host "GET /api/tasks/:projectId" -ForegroundColor Cyan
Write-Host "  Success Rate:  $taskSuccess/50 ($(($taskSuccess/50)*100)%)"
Write-Host "  Avg Latency:   $taskAvg ms"
Write-Host "  Min Latency:   $taskMin ms"
Write-Host "  Max Latency:   $taskMax ms"
Write-Host ""

$rollbackSuccess = ($rollbackResults | Where-Object { $_.success }).Count
$rollbackLatencies = ($rollbackResults | Where-Object { $_.success } | Select-Object -ExpandProperty latency)
$rollbackAvg = if ($rollbackLatencies) { [math]::Round(($rollbackLatencies | Measure-Object -Average).Average, 2) } else { 0 }
$rollbackMin = if ($rollbackLatencies) { ($rollbackLatencies | Measure-Object -Minimum).Minimum } else { 0 }
$rollbackMax = if ($rollbackLatencies) { ($rollbackLatencies | Measure-Object -Maximum).Maximum } else { 0 }

Write-Host "GET /api/auto-rollback/check" -ForegroundColor Cyan
Write-Host "  Success Rate:  $rollbackSuccess/50 ($(($rollbackSuccess/50)*100)%)"
Write-Host "  Avg Latency:   $rollbackAvg ms"
Write-Host "  Min Latency:   $rollbackMin ms"
Write-Host "  Max Latency:   $rollbackMax ms"
Write-Host ""

# Overall
$totalSuccess = $taskSuccess + $rollbackSuccess
$overallAvg = [math]::Round((($taskLatencies + $rollbackLatencies) | Measure-Object -Average).Average, 2)

Write-Host "OVERALL" -ForegroundColor Yellow
Write-Host "  Total Requests:    100"
Write-Host "  Success:           $totalSuccess/100 ($(($totalSuccess/100)*100)%)"
Write-Host "  Average Latency:   $overallAvg ms"
Write-Host "  Target:            150-300ms (from optimization plan)"
Write-Host ""

if ($overallAvg -lt 300) {
  Write-Host "✓ PASSED: Latency is below target!" -ForegroundColor Green
} elseif ($overallAvg -lt 400) {
  Write-Host "⚠ WARNING: Latency is slightly above target, needs monitoring" -ForegroundColor Yellow
} else {
  Write-Host "✗ FAILED: Latency exceeds target significantly" -ForegroundColor Red
}

Write-Host ""
Write-Host "Next: Run '/metrics/summary' endpoint to get detailed metrics report" -ForegroundColor Cyan
