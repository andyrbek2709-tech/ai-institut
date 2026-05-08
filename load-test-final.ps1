# Load Test: Final verification after optimization

param([int]$Count = 100, [string]$ApiUrl = "https://api-server-production-8157.up.railway.app")

$colors = @{ Success = "Green"; Warning = "Yellow"; Error = "Red"; Info = "Cyan" }

function Test-Endpoint {
    param([string]$Path, [string]$Method = "GET")
    $start = Get-Date
    try {
        $resp = Invoke-WebRequest -Uri "$ApiUrl$Path" -Method $Method -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
        $ms = (Get-Date - $start).TotalMilliseconds
        return @{ OK = $true; MS = $ms; Status = $resp.StatusCode }
    } catch {
        $ms = (Get-Date - $start).TotalMilliseconds
        return @{ OK = $false; MS = $ms; Status = 0; Msg = $_.Exception.Message }
    }
}

Write-Host "=== DATABASE OPTIMIZATION LOAD TEST ===" -ForegroundColor Cyan
Write-Host "Endpoints: /api/tasks/*, /api/auto-rollback/check"
Write-Host "Requests: $Count"
Write-Host ""

$results = @()
$endpoints = @("/api/tasks/43", "/api/auto-rollback/check", "/api/tasks/44", "/api/auto-rollback/check")

for ($i = 1; $i -le $Count; $i++) {
    $ep = $endpoints[($i - 1) % 4]
    $result = Test-Endpoint -Path $ep
    $results += @{ Endpoint = $ep; MS = $result.MS; OK = $result.OK }

    if ($result.OK) {
        if ($result.MS -gt 500) { Write-Host -NoNewline "S" }
        elseif ($result.MS -gt 300) { Write-Host -NoNewline "w" }
        else { Write-Host -NoNewline "." }
    } else {
        Write-Host -NoNewline "X"
    }

    if ($i % 25 -eq 0) { Write-Host "" }
    Start-Sleep -Milliseconds 20
}

Write-Host ""
Write-Host ""

# Statistics
$group_tasks = $results | Where { $_.Endpoint -match "tasks" }
$group_auto = $results | Where { $_.Endpoint -match "auto-rollback" }

$avg_tasks = ($group_tasks.MS | Measure -Average).Average
$avg_auto = ($group_auto.MS | Measure -Average).Average
$avg_all = ($results.MS | Measure -Average).Average
$min_all = ($results.MS | Measure -Minimum).Minimum
$max_all = ($results.MS | Measure -Maximum).Maximum

Write-Host "RESULTS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "GET /api/tasks/:projectId"
Write-Host "  Avg: $(($avg_tasks).ToString('F0'))ms"
$tasks_ok = if ($avg_tasks -le 300) { "OPTIMAL" } elseif ($avg_tasks -le 500) { "GOOD" } else { "SLOW" }
Write-Host "  Status: $tasks_ok"

Write-Host ""
Write-Host "GET /api/auto-rollback/check"
Write-Host "  Avg: $(($avg_auto).ToString('F0'))ms"
$auto_ok = if ($avg_auto -le 300) { "OPTIMAL" } elseif ($avg_auto -le 500) { "GOOD" } else { "SLOW" }
Write-Host "  Status: $auto_ok"

Write-Host ""
Write-Host "OVERALL:"
Write-Host "  Avg: $(($avg_all).ToString('F0'))ms"
Write-Host "  Min: $(($min_all).ToString('F0'))ms"
Write-Host "  Max: $(($max_all).ToString('F0'))ms"
Write-Host "  Success rate: $($results.OK.Where({$_}).Count)/$Count"

Write-Host ""
Write-Host "OPTIMIZATION STATUS:" -ForegroundColor Cyan
if ($avg_all -le 300) {
    Write-Host "SUCCESS - Latency within target range (150-300ms)" -ForegroundColor Green
} elseif ($avg_all -le 500) {
    Write-Host "PARTIAL - Latency acceptable (300-500ms)" -ForegroundColor Yellow
    Write-Host "Next: Apply database indexes via Supabase to achieve target" -ForegroundColor Yellow
} else {
    Write-Host "WAITING - Need to apply database indexes" -ForegroundColor Yellow
    Write-Host "Instructions: See APPLY_DB_OPTIMIZATION.md" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Target comparison:"
Write-Host "  Before: 400-1000ms"
Write-Host "  Now: $(($avg_all).ToString('F0'))ms"
if ($avg_all -lt 800) {
    $pct = ([math]::Round((800 - $avg_all) / 800 * 100))
    Write-Host "  Improvement: $pct%"
}
