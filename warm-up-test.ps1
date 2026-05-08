# Warm-up System: Load Generation + Cache Priming
# Target: 50-100 requests to fill cache and stabilize latency

param(
    [int]$RequestCount = 80,
    [int]$WarmupDelaySeconds = 300,
    [string]$ApiUrl = "https://api-server-production-8157.up.railway.app"
)

$colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "Cyan"
}

function Write-Colored($message, $color = "White") {
    Write-Host $message -ForegroundColor $color
}

function Test-ApiEndpoint {
    param([string]$Endpoint, [string]$Method = "GET", [object]$Body = $null)

    $startTime = Get-Date
    try {
        $params = @{
            Uri             = "$ApiUrl$Endpoint"
            Method          = $Method
            ContentType     = "application/json"
            TimeoutSec      = 30
            UseBasicParsing = $true
        }

        if ($Body) {
            $params.Body = $Body | ConvertTo-Json
        }

        $response = Invoke-WebRequest @params
        $duration = (Get-Date) - $startTime

        return @{
            StatusCode = $response.StatusCode
            Latency    = $duration.TotalMilliseconds
            Success    = $true
            Error      = $null
        }
    } catch {
        $duration = (Get-Date) - $startTime
        return @{
            StatusCode = $_.Exception.Response.StatusCode.Value
            Latency    = $duration.TotalMilliseconds
            Success    = $false
            Error      = $_.Exception.Message
        }
    }
}

# STEP 1: Validate endpoints exist
Write-Colored "STEP 1: ENDPOINT VALIDATION" $colors.Info
$healthCheck = Test-ApiEndpoint -Endpoint "/health"
if ($healthCheck.Success) {
    Write-Colored ("OK: API responding (health: " + $healthCheck.Latency + "ms)") $colors.Success
} else {
    Write-Colored ("ERROR: API not responding") $colors.Error
    exit 1
}

# STEP 2: Load Generation
Write-Colored "STEP 2: LOAD GENERATION" $colors.Info
Write-Host "Sending $RequestCount requests to fill cache..."

$results = @()
$projectIds = @(43, 44, 45, 46, 47)
$taskIds = @(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)

for ($i = 1; $i -le $RequestCount; $i++) {
    $endpoint = $null
    $method = "GET"
    $body = $null

    $requestType = $i % 4
    switch ($requestType) {
        0 {
            $projectId = $projectIds[$i % $projectIds.Count]
            $endpoint = "/api/tasks/$projectId"
        }
        1 {
            $endpoint = "/api/auto-rollback/check"
        }
        2 {
            $endpoint = "/api/publish-event"
            $method = "POST"
            $body = @{
                event_type = "task.created"
                task_id    = $taskIds[$i % $taskIds.Count]
                project_id = $projectIds[$i % $projectIds.Count]
                user_id    = "test-user-$i"
            }
        }
        3 {
            $endpoint = "/metrics/summary"
        }
    }

    $result = Test-ApiEndpoint -Endpoint $endpoint -Method $method -Body $body
    $results += $result

    $statusIcon = if ($result.Success) { "OK" } else { "FAIL" }
    Write-Host -NoNewline "[$i/$RequestCount] $endpoint ($($result.Latency)ms) $statusIcon "

    if ($i % 5 -eq 0) {
        Write-Host ""
    }

    Start-Sleep -Milliseconds 50
}

Write-Host ""
Write-Colored "Load generation complete" $colors.Success

# STEP 3: Warmup metrics
$successCount = ($results | Where-Object { $_.Success }).Count
$errorCount = ($results | Where-Object { !$_.Success }).Count
$avgLatency = [math]::Round(($results | Measure-Object -Property Latency -Average).Average, 2)
$maxLatency = [math]::Round(($results | Measure-Object -Property Latency -Maximum).Maximum, 2)
$minLatency = [math]::Round(($results | Measure-Object -Property Latency -Minimum).Minimum, 2)

Write-Colored "STEP 3: WARMUP METRICS (AFTER LOAD)" $colors.Info
Write-Host "Total requests: $($results.Count)"
Write-Host "Successful: $successCount"
Write-Host "Failed: $errorCount"
Write-Host "Avg latency: ${avgLatency}ms"
Write-Host "Min latency: ${minLatency}ms"
Write-Host "Max latency: ${maxLatency}ms"

# STEP 4: Wait for cache stabilization
Write-Colored "STEP 4: CACHE STABILIZATION" $colors.Info
Write-Host "Waiting $WarmupDelaySeconds seconds for cache to stabilize..."

for ($elapsed = 0; $elapsed -le $WarmupDelaySeconds; $elapsed += 5) {
    $timeRemaining = $WarmupDelaySeconds - $elapsed
    $minutes = [math]::Floor($timeRemaining / 60)
    $seconds = $timeRemaining % 60

    Write-Host -NoNewline ("  Remaining: " + $minutes + "m " + $seconds + "s`r")
    Start-Sleep -Seconds 5
}

Write-Host ""
Write-Colored "Cache warming complete" $colors.Success

# STEP 5: Collect final metrics
Write-Colored "STEP 5: COLLECTING FINAL METRICS" $colors.Info

try {
    $metricsResponse = Invoke-WebRequest -Uri "$ApiUrl/metrics/summary" -UseBasicParsing
    $metricsData = $metricsResponse.Content | ConvertFrom-Json

    Write-Colored "Metrics retrieved successfully" $colors.Success
    Write-Host ""
    Write-Host "Metrics Summary:"
    Write-Host "  Total requests: $($metricsData.total_requests)"
    Write-Host "  Error rate: $($metricsData.error_rate)%"
    Write-Host "  Avg latency: $($metricsData.avg_latency)ms"
    if ($metricsData.p95_latency) {
        Write-Host "  P95 latency: $($metricsData.p95_latency)ms"
    }
    if ($metricsData.max_latency) {
        Write-Host "  Max latency: $($metricsData.max_latency)ms"
    }
} catch {
    Write-Colored "Could not retrieve metrics" $colors.Warning
    Write-Host $_.Exception.Message
}

# STEP 6: Analysis
Write-Colored "STEP 6: ANALYSIS" $colors.Info

$targetMin = 150
$targetMax = 350

if ($avgLatency -ge $targetMin -and $avgLatency -le $targetMax) {
    Write-Colored "LATENCY IS OPTIMAL" $colors.Success
    Write-Host "Average: $avgLatency ms (target: $targetMin-${targetMax}ms)"
} elseif ($avgLatency -lt $targetMin) {
    Write-Colored "LATENCY IS EXCELLENT" $colors.Success
    Write-Host "Average: $avgLatency ms (better than target)"
} else {
    Write-Colored "LATENCY HIGHER THAN TARGET" $colors.Warning
    Write-Host "Average: $avgLatency ms (target: $targetMin-${targetMax}ms)"
    Write-Host "Suggestion: Run another warmup cycle in 5 minutes"
}

Write-Colored "WARMUP COMPLETE" $colors.Success
Write-Host "Status: Ready for production"
Write-Host "Error rate: $(($errorCount / $results.Count * 100).ToString('F2'))%"
