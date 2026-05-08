#!/usr/bin/env pwsh
# Get detailed performance metrics after index creation and load test

param(
  [string]$ApiBase = "https://api-server-production-8157.up.railway.app"
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  PERFORMANCE METRICS REPORT                                ║" -ForegroundColor Cyan
Write-Host "║  After Index Creation + Load Test                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Get metrics summary
Write-Host "Fetching metrics summary..." -ForegroundColor Green

try {
  $response = Invoke-WebRequest -Uri "$ApiBase/api/metrics/summary" -TimeoutSec 10 -UseBasicParsing
  $metrics = $response.Content | ConvertFrom-Json

  Write-Host ""
  Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
  Write-Host "║  ENDPOINT PERFORMANCE BREAKDOWN                            ║" -ForegroundColor Yellow
  Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
  Write-Host ""

  if ($metrics.endpoints) {
    foreach ($endpoint in $metrics.endpoints) {
      Write-Host "Endpoint: $($endpoint.name)" -ForegroundColor Cyan
      Write-Host "  Requests:    $($endpoint.request_count)"
      Write-Host "  Avg Latency: $($endpoint.avg_latency) ms"
      Write-Host "  Error Rate:  $($endpoint.error_rate)%"
      Write-Host ""
    }
  }

  Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
  Write-Host "║  AGGREGATE METRICS                                         ║" -ForegroundColor Yellow
  Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
  Write-Host ""

  Write-Host "Overall Performance:" -ForegroundColor Cyan
  Write-Host "  Total Requests:   $($metrics.total_requests)"
  Write-Host "  Error Rate:       $($metrics.error_rate)%"
  Write-Host "  Avg Latency:      $($metrics.avg_latency) ms"
  Write-Host "  Max Latency:      $($metrics.max_latency) ms"
  Write-Host ""

  # Improvement calculation
  $baseline = 996  # From STATE.md
  $current = $metrics.avg_latency
  if ($baseline -gt 0) {
    $improvement = [math]::Round(((($baseline - $current) / $baseline) * 100), 2)
    Write-Host "Performance Improvement:" -ForegroundColor Yellow
    Write-Host "  Baseline:         $baseline ms (before indexes)"
    Write-Host "  Current:          $current ms (after indexes)"
    Write-Host "  Improvement:      $improvement%"

    if ($improvement -ge 60) {
      Write-Host "  Status:           ✓ EXCELLENT (60%+ improvement)" -ForegroundColor Green
    } elseif ($improvement -ge 50) {
      Write-Host "  Status:           ✓ GOOD (50%+ improvement)" -ForegroundColor Green
    } elseif ($improvement -ge 30) {
      Write-Host "  Status:           ⚠ ACCEPTABLE (30%+ improvement)" -ForegroundColor Yellow
    } else {
      Write-Host "  Status:           ✗ NEEDS REVIEW (<30% improvement)" -ForegroundColor Red
    }
  }

  Write-Host ""
  Write-Host "By Provider:" -ForegroundColor Cyan
  if ($metrics.by_provider) {
    foreach ($provider in @("railway", "vercel")) {
      $data = $metrics.by_provider | Where-Object { $_.provider -eq $provider }
      if ($data) {
        Write-Host "  $provider"
        Write-Host "    Requests:  $($data.request_count)"
        Write-Host "    Latency:   $($data.avg_latency) ms"
        Write-Host "    Error:     $($data.error_rate)%"
      }
    }
  }

} catch {
  Write-Host "ERROR: Could not fetch metrics" -ForegroundColor Red
  Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ""
  Write-Host "This is normal if:" -ForegroundColor Yellow
  Write-Host "  1. /api/metrics/summary is not yet deployed on Railway"
  Write-Host "  2. No metrics have been recorded yet"
  Write-Host "  3. Railway service is warming up"
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor Cyan
  Write-Host "  1. Run load test: ./load-test-performance.ps1" -ForegroundColor White
  Write-Host "  2. Wait 10-15 seconds for metrics to be recorded"
  Write-Host "  3. Run this script again" -ForegroundColor White
}

Write-Host ""
Write-Host "Report generation complete." -ForegroundColor Green
