#!/usr/bin/env pwsh
<#
.SYNOPSIS
Load test comparing old (561ms) vs new (optimized) latency
100 requests: 50x /api/tasks/:projectId + 50x /api/auto-rollback/check

.EXAMPLE
./load-test-optimized.ps1 -Count 100 -Concurrent 5
#>

param(
    [int]$Count = 100,
    [int]$Concurrent = 5,
    [string]$BaseUrl = 'https://api-server-production-8157.up.railway.app'
)

function Write-Section {
    param([string]$Title)
    Write-Host "`n▶ $Title" -ForegroundColor Cyan -BackgroundColor Black
}

function Write-Result {
    param([string]$Message, [string]$Color = 'White')
    Write-Host $Message -ForegroundColor $Color
}

Write-Section "LOAD TEST: 100 Requests (Optimized Cache + Redis Metrics)"
Write-Result "Configuration:"
Write-Result "  Base URL: $BaseUrl"
Write-Result "  Total Requests: $Count"
Write-Result "  Concurrent: $Concurrent"
Write-Result "  Split: 50x /api/tasks/:projectId + 50x /api/auto-rollback/check"

$metrics = @{
    tasksLatencies = @()
    rollbackLatencies = @()
    tasksErrors = 0
    rollbackErrors = 0
    totalTime = 0
}

$sw = [System.Diagnostics.Stopwatch]::StartNew()

# Prepare tasks
$taskRequests = @()
for ($i = 0; $i -lt ($Count / 2); $i++) {
    $projectId = 43 + ($i % 5)
    $taskRequests += @{
        url = "$BaseUrl/api/tasks/$projectId"
        type = 'tasks'
    }
}

# Prepare rollback checks
$rollbackRequests = @()
for ($i = 0; $i -lt ($Count / 2); $i++) {
    $rollbackRequests += @{
        url = "$BaseUrl/api/auto-rollback/check"
        type = 'rollback'
    }
}

# Combine and shuffle
$allRequests = $taskRequests + $rollbackRequests | Get-Random -Count ($Count)

# Execute with concurrency
$i = 0
$jobs = @()

foreach ($req in $allRequests) {
    $i++

    # Create async job
    $job = {
        param($url, $type)
        $reqSw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 30 -ErrorAction Stop
            $reqSw.Stop()

            return @{
                type = $type
                latency = $reqSw.ElapsedMilliseconds
                statusCode = $response.StatusCode
                error = $null
            }
        } catch {
            $reqSw.Stop()
            return @{
                type = $type
                latency = $reqSw.ElapsedMilliseconds
                statusCode = 0
                error = $_.Exception.Message
            }
        }
    }

    $jobs += Start-Job -ScriptBlock $job -ArgumentList $req.url, $req.type

    # Maintain concurrency
    if ($jobs.Count -ge $Concurrent -or $i -eq $Count) {
        $completed = $jobs | Wait-Job
        foreach ($job in $completed) {
            $result = $job | Receive-Job

            if ($result.error) {
                if ($result.type -eq 'tasks') { $metrics.tasksErrors++ }
                else { $metrics.rollbackErrors++ }
            } else {
                if ($result.type -eq 'tasks') {
                    $metrics.tasksLatencies += $result.latency
                } else {
                    $metrics.rollbackLatencies += $result.latency
                }
            }

            $job | Remove-Job
        }
        $jobs = @()
    }
}

$sw.Stop()
$metrics.totalTime = $sw.ElapsedMilliseconds

# Calculate statistics
function Get-Stats {
    param([array]$latencies)
    if ($latencies.Count -eq 0) { return $null }

    $sorted = $latencies | Sort-Object
    $avg = ($latencies | Measure-Object -Average).Average
    $min = $sorted[0]
    $max = $sorted[-1]
    $p95 = $sorted[[int]($sorted.Count * 0.95)]
    $p99 = $sorted[[int]($sorted.Count * 0.99)]

    return @{
        count = $latencies.Count
        avg = [math]::Round($avg)
        min = $min
        max = $max
        p95 = $p95
        p99 = $p99
    }
}

$tasksStats = Get-Stats $metrics.tasksLatencies
$rollbackStats = Get-Stats $metrics.rollbackLatencies

Write-Section "RESULTS"

Write-Result "`n📊 /api/tasks/:projectId (50 requests)"
if ($tasksStats) {
    Write-Result "  Success: $($tasksStats.count) requests"
    Write-Result "  Avg:     $($tasksStats.avg)ms  (Target: <300ms)" -Color $(if ($tasksStats.avg -le 300) { 'Green' } else { 'Yellow' })
    Write-Result "  Min:     $($tasksStats.min)ms"
    Write-Result "  Max:     $($tasksStats.max)ms"
    Write-Result "  P95:     $($tasksStats.p95)ms"
    Write-Result "  P99:     $($tasksStats.p99)ms"
    Write-Result "  Errors:  $($metrics.tasksErrors)"
} else {
    Write-Result "  ❌ All requests failed" -Color Red
}

Write-Result "`n🔄 /api/auto-rollback/check (50 requests)"
if ($rollbackStats) {
    Write-Result "  Success: $($rollbackStats.count) requests"
    Write-Result "  Avg:     $($rollbackStats.avg)ms  (Target: <300ms)" -Color $(if ($rollbackStats.avg -le 300) { 'Green' } else { 'Yellow' })
    Write-Result "  Min:     $($rollbackStats.min)ms"
    Write-Result "  Max:     $($rollbackStats.max)ms"
    Write-Result "  P95:     $($rollbackStats.p95)ms"
    Write-Result "  P99:     $($rollbackStats.p99)ms"
    Write-Result "  Errors:  $($metrics.rollbackErrors)"
} else {
    Write-Result "  ❌ All requests failed" -Color Red
}

# Overall statistics
$allLatencies = $metrics.tasksLatencies + $metrics.rollbackLatencies
$allStats = Get-Stats $allLatencies
$totalErrors = $metrics.tasksErrors + $metrics.rollbackErrors

Write-Result "`n📈 OVERALL (100 requests in $($metrics.totalTime)ms)"
if ($allStats) {
    Write-Result "  Successful: $($allStats.count) requests"
    Write-Result "  Avg:        $($allStats.avg)ms  (Target: <350ms, Current baseline: 561ms)" -Color $(if ($allStats.avg -le 350) { 'Green' } else { 'Yellow' })
    Write-Result "  Min:        $($allStats.min)ms"
    Write-Result "  Max:        $($allStats.max)ms"
    Write-Result "  P95:        $($allStats.p95)ms"
    Write-Result "  P99:        $($allStats.p99)ms"
    Write-Result "  Errors:     $totalErrors"
    Write-Result "  Error Rate: $(if ($allStats.count -gt 0) { [math]::Round(($totalErrors / ($allStats.count + $totalErrors)) * 100, 2) })%"

    # Show improvement
    $improvement = [math]::Round(((561 - $allStats.avg) / 561) * 100)
    if ($improvement -gt 0) {
        Write-Result "  ✅ Improvement: $improvement% faster than baseline (561ms → $($allStats.avg)ms)" -Color Green
    } else {
        Write-Result "  ⚠️  Need further optimization: $($allStats.avg)ms vs target 250-350ms" -Color Yellow
    }
} else {
    Write-Result "  ❌ All requests failed" -Color Red
}

Write-Host "`n" -NoNewline
