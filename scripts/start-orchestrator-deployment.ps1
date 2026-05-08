# ╔═════════════════════════════════════════════════════════════════╗
# ║  Orchestrator Production Deployment — PowerShell Launcher        ║
# ╚═════════════════════════════════════════════════════════════════╝

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "🚀 Orchestrator Production Deployment" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path "$scriptDir\.."
$deployScript = "$scriptDir\deploy-orchestrator-prod.sh"

Write-Host "📁 Working Directory: $repoRoot" -ForegroundColor Blue
Write-Host "📝 Deploy Script: $deployScript" -ForegroundColor Blue
Write-Host ""

# Check prerequisites
Write-Host "🔍 Checking Prerequisites..." -ForegroundColor Cyan
Write-Host ""

# Check gh CLI
try {
    $ghVersion = gh --version 2>&1
    Write-Host "✓ GitHub CLI: $($ghVersion.Split(' ')[2])" -ForegroundColor Green
} catch {
    Write-Host "✗ GitHub CLI not found. Install from: https://cli.github.com" -ForegroundColor Red
    exit 1
}

# Check git
try {
    $gitVersion = git --version 2>&1
    Write-Host "✓ Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Git not found" -ForegroundColor Red
    exit 1
}

# Check gh authentication
try {
    $authStatus = gh auth status 2>&1
    Write-Host "✓ GitHub Authentication: Verified" -ForegroundColor Green
} catch {
    Write-Host "✗ Not authenticated with GitHub. Run: gh auth login" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check environment variables
Write-Host "🔐 Checking Environment Variables..." -ForegroundColor Cyan
Write-Host ""

$requiredVars = @(
    "UPSTASH_API_TOKEN",
    "RAILWAY_TOKEN",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY"
)

$missingVars = @()

foreach ($var in $requiredVars) {
    if ([string]::IsNullOrEmpty([System.Environment]::GetEnvironmentVariable($var))) {
        $missingVars += $var
        Write-Host "✗ $var — NOT SET" -ForegroundColor Red
    } else {
        $value = [System.Environment]::GetEnvironmentVariable($var)
        $masked = if ($value.Length -gt 20) {
            $value.Substring(0, 10) + "..." + $value.Substring($value.Length - 10)
        } else {
            "****" * ($value.Length / 4)
        }
        Write-Host "✓ $var — SET ($masked)" -ForegroundColor Green
    }
}

Write-Host ""

if ($missingVars.Count -gt 0) {
    Write-Host "❌ Missing Environment Variables:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "   - $var" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "📋 Please set these variables before running deployment:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Option 1: Export from GitHub Secrets (manual)" -ForegroundColor Yellow
    Write-Host "   - Visit: https://github.com/andyrbek2709-tech/ai-institut/settings/secrets/actions" -ForegroundColor Gray
    Write-Host "   - Copy each secret value" -ForegroundColor Gray
    Write-Host "   - Export as environment variable" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Option 2: Set via PowerShell:" -ForegroundColor Yellow
    Write-Host '   $env:UPSTASH_API_TOKEN = "your-token"' -ForegroundColor Gray
    Write-Host '   $env:RAILWAY_TOKEN = "your-token"' -ForegroundColor Gray
    Write-Host '   $env:SUPABASE_URL = "your-url"' -ForegroundColor Gray
    Write-Host '   $env:SUPABASE_SERVICE_KEY = "your-key"' -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# ════════════════════════════════════════════════════════════════════

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ All Prerequisites Met" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Starting Orchestrator Production Deployment..." -ForegroundColor Cyan
Write-Host ""

# Run deployment script
& bash $deployScript

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "✨ DEPLOYMENT SUCCESSFUL ✨" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Reports generated:" -ForegroundColor Green
    Write-Host "   - orchestrator-deployment-report.txt" -ForegroundColor Gray
    Write-Host "   - deployment-logs.txt" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ DEPLOYMENT FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check deployment-logs.txt for details" -ForegroundColor Yellow
    exit 1
}
