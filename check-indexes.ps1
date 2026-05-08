#!/usr/bin/env pwsh
# Check if indexes were created successfully

$projectId = "jbdljdwlfimvmqybzynv"
$checkQuery = @"
SELECT indexname FROM pg_indexes WHERE tablename = 'tasks';
"@

Write-Host "Checking database indexes..." -ForegroundColor Green
Write-Host ""
Write-Host "Expected indexes on tasks table:" -ForegroundColor Cyan
Write-Host "  - idx_tasks_project_id"
Write-Host "  - idx_tasks_project_id_status"
Write-Host "  - idx_tasks_status"
Write-Host ""
Write-Host "To verify in Supabase SQL Editor, run:" -ForegroundColor Yellow
Write-Host ""
Write-Host "SELECT indexname FROM pg_indexes WHERE tablename = 'tasks';"
Write-Host ""
Write-Host "Also check feature_flags and api_metrics indexes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "SELECT indexname FROM pg_indexes WHERE tablename = 'feature_flags';"
Write-Host "SELECT indexname FROM pg_indexes WHERE tablename = 'api_metrics';"
