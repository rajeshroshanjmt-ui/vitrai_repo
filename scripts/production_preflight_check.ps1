# Production Pre-Flight Deployment Checklist (PowerShell)
# Validates environment, services, providers, and network before going live.
#
# Usage:
#   .\scripts\production_preflight_check.ps1
#
#   .\scripts\production_preflight_check.ps1 -BaseUrl "http://localhost/api" `
#     -LanggraphUrl "http://localhost:8001" `
#     -RedisUrl "redis:6379"

param(
    [string]$BaseUrl = "http://localhost/api",
    [string]$LanggraphUrl = "http://localhost:8001",
    [string]$RedisUrl = "redis:6379",
    [int]$TimeoutSeconds = 5
)

$ErrorActionPreference = "Continue"  # Don't stop on errors; we want to collect all failures

# Colors
$Colors = @{
    Pass    = "Green"
    Fail    = "Red"
    Warn    = "Yellow"
    Info    = "Cyan"
    Section = "Blue"
}

# Tracking
$ChecksPassed = 0
$ChecksFailed = 0
$Warnings = 0

function Log-Pass {
    param([string]$Message)
    Write-Host "✓ " -ForegroundColor $Colors.Pass -NoNewline
    Write-Host $Message
    $script:ChecksPassed++
}

function Log-Fail {
    param([string]$Message)
    Write-Host "✗ " -ForegroundColor $Colors.Fail -NoNewline
    Write-Host $Message
    $script:ChecksFailed++
}

function Log-Warn {
    param([string]$Message)
    Write-Host "⚠ " -ForegroundColor $Colors.Warn -NoNewline
    Write-Host $Message
    $script:Warnings++
}

function Log-Info {
    param([string]$Message)
    Write-Host "ℹ " -ForegroundColor $Colors.Info -NoNewline
    Write-Host $Message
}

function Log-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host ("━" * 60) -ForegroundColor $Colors.Section
    Write-Host $Title -ForegroundColor $Colors.Section
    Write-Host ("━" * 60) -ForegroundColor $Colors.Section
}

function Test-Http {
    param(
        [string]$Url,
        [int]$Timeout = 5
    )
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $Timeout -ErrorAction Stop
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

function Test-TcpConnection {
    param(
        [string]$Host,
        [int]$Port,
        [int]$Timeout = 5
    )
    $tcp = New-Object System.Net.Sockets.TcpClient
    $asyncResult = $tcp.BeginConnect($Host, $Port, $null, $null)
    $connected = $asyncResult.AsyncWaitHandle.WaitOne($Timeout * 1000)
    if ($connected) {
        try { $tcp.EndConnect($asyncResult) } catch { $connected = $false }
    }
    $tcp.Close()
    return $connected
}

# Main checks
Log-Section "Environment Variables"

$CriticalVars = @(
    "JWT_SECRET",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "REDIS_HOST",
    "REDIS_PORT",
    "DEFAULT_LLM_PROVIDER"
)

foreach ($var in $CriticalVars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ([string]::IsNullOrEmpty($value)) {
        Log-Fail "$var is not set"
    }
    else {
        Log-Pass "$var is set"
    }
}

# Warn on weak JWT secrets
$JwtSecret = [Environment]::GetEnvironmentVariable("JWT_SECRET")
if ($JwtSecret.Length -lt 32) {
    Log-Warn "JWT_SECRET is shorter than 32 characters; consider using a stronger secret"
}

Log-Section "LLM Provider Configuration"

$DefaultLlm = [Environment]::GetEnvironmentVariable("DEFAULT_LLM_PROVIDER") ?? "ollama"
Log-Info "DEFAULT_LLM_PROVIDER: $DefaultLlm"

# OpenAI checks
$OpenAiKey = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY")
if ($DefaultLlm -eq "openai" -or -not [string]::IsNullOrEmpty($OpenAiKey)) {
    if ([string]::IsNullOrEmpty($OpenAiKey)) {
        Log-Fail "OPENAI_API_KEY is required for OpenAI but not set"
    }
    else {
        Log-Pass "OPENAI_API_KEY is set"
    }
    $OpenAiModel = [Environment]::GetEnvironmentVariable("OPENAI_MODEL")
    if ([string]::IsNullOrEmpty($OpenAiModel)) {
        Log-Warn "OPENAI_MODEL not set; will use default (gpt-4o-mini)"
    }
    else {
        Log-Pass "OPENAI_MODEL: $OpenAiModel"
    }
}

# Anthropic checks
$AnthropicKey = [Environment]::GetEnvironmentVariable("ANTHROPIC_API_KEY")
if ($DefaultLlm -eq "anthropic" -or -not [string]::IsNullOrEmpty($AnthropicKey)) {
    if ([string]::IsNullOrEmpty($AnthropicKey)) {
        Log-Fail "ANTHROPIC_API_KEY is required for Anthropic but not set"
    }
    else {
        Log-Pass "ANTHROPIC_API_KEY is set"
    }
}

# Azure OpenAI checks
$AzureKey = [Environment]::GetEnvironmentVariable("AZURE_OPENAI_API_KEY")
$AzureEndpoint = [Environment]::GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT")
if ($DefaultLlm -eq "azure_openai" -or -not [string]::IsNullOrEmpty($AzureKey)) {
    if ([string]::IsNullOrEmpty($AzureEndpoint)) {
        Log-Fail "AZURE_OPENAI_ENDPOINT is required for Azure OpenAI but not set"
    }
    else {
        Log-Pass "AZURE_OPENAI_ENDPOINT is set"
    }
}

# Ollama checks
$OllamaUrl = [Environment]::GetEnvironmentVariable("OLLAMA_BASE_URL")
if ($DefaultLlm -eq "ollama" -or -not [string]::IsNullOrEmpty($OllamaUrl)) {
    if ([string]::IsNullOrEmpty($OllamaUrl)) {
        Log-Fail "OLLAMA_BASE_URL is required for Ollama but not set"
    }
    else {
        Log-Pass "OLLAMA_BASE_URL: $OllamaUrl"
    }
}

Log-Section "Service Connectivity"

Log-Info "Testing backend health at $BaseUrl/health/ready"
if (Test-Http "$BaseUrl/health/ready" -Timeout $TimeoutSeconds) {
    Log-Pass "Backend is ready"
}
else {
    Log-Fail "Backend health check failed (URL: $BaseUrl/health/ready)"
}

Log-Info "Testing LangGraph health at $LanggraphUrl/health/ready"
if (Test-Http "$LanggraphUrl/health/ready" -Timeout $TimeoutSeconds) {
    Log-Pass "LangGraph worker is ready"
}
else {
    Log-Fail "LangGraph health check failed (URL: $LanggraphUrl/health/ready)"
}

# Database connectivity
Log-Info "Checking database configuration"
$DatabaseUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL")
if ([string]::IsNullOrEmpty($DatabaseUrl)) {
    Log-Fail "DATABASE_URL environment variable is not set"
}
elseif ($DatabaseUrl -match "postgresql") {
    Log-Pass "PostgreSQL connection string is configured"
}
else {
    Log-Warn "DATABASE_URL is set but may not be PostgreSQL"
}

# Redis connectivity
Log-Info "Checking Redis connectivity at $RedisUrl"
$RedisHost, $RedisPort = $RedisUrl -split ":"
if (Test-TcpConnection -Host $RedisHost -Port $RedisPort -Timeout $TimeoutSeconds) {
    Log-Pass "Redis is reachable at $RedisUrl"
}
else {
    Log-Fail "Cannot connect to Redis at $RedisUrl"
}

Log-Section "LLM Provider Connectivity"

# Test Ollama
if (-not [string]::IsNullOrEmpty($OllamaUrl)) {
    Log-Info "Testing Ollama connectivity at $OllamaUrl/api/tags"
    try {
        $response = Invoke-RestMethod -Uri "$OllamaUrl/api/tags" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response) {
            Log-Pass "Ollama /api/tags endpoint responding"
        }
    }
    catch {
        # Try /v1
        try {
            $response = Invoke-RestMethod -Uri "$OllamaUrl/v1/tags" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            Log-Warn "Ollama /api/tags failed but /v1/tags succeeded; make sure OLLAMA_API_PREFIX=/v1 is set"
        }
        catch {
            Log-Fail "Ollama is not responding at $OllamaUrl"
        }
    }

    # Check model availability
    $OllamaLlm = [Environment]::GetEnvironmentVariable("OLLAMA_LLM_MODEL") ?? "llama3.2"
    $OllamaEmbed = [Environment]::GetEnvironmentVariable("OLLAMA_EMBED_MODEL") ?? "nomic-embed-text"
    Log-Info "Checking Ollama models ($OllamaLlm, $OllamaEmbed)"
    try {
        $models = Invoke-RestMethod -Uri "$OllamaUrl/api/tags" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        $modelNames = $models.models.name -join ","
        if ($modelNames -match $OllamaLlm) {
            Log-Pass "Ollama model $OllamaLlm is available"
        }
        else {
            Log-Warn "Ollama model $OllamaLlm is not available"
        }
    }
    catch {
        Log-Warn "Could not retrieve Ollama model list"
    }
}

# Test OpenAI
if (-not [string]::IsNullOrEmpty($OpenAiKey)) {
    Log-Info "Validating OpenAI API configuration"
    Log-Pass "OpenAI API key configured (not testing to avoid quota consumption)"
}

# Test Anthropic
if (-not [string]::IsNullOrEmpty($AnthropicKey)) {
    Log-Info "Validating Anthropic API configuration"
    Log-Pass "Anthropic API key configured (not testing to avoid quota consumption)"
}

Log-Section "Security & Network"

if ($BaseUrl -match "^https://") {
    Log-Pass "Backend uses HTTPS"
}
else {
    Log-Warn "Backend is not using HTTPS; ensure it's behind a load balancer with TLS termination in production"
}

$AppEnv = [Environment]::GetEnvironmentVariable("APP_ENV")
if ($AppEnv -eq "production") {
    Log-Pass "APP_ENV is set to production"
}
else {
    Log-Warn "APP_ENV is not set to 'production'; make sure this is intentional"
}

if (-not [string]::IsNullOrEmpty($JwtSecret) -and $JwtSecret -ne "change-me") {
    Log-Pass "JWT_SECRET appears to be non-default"
}
else {
    Log-Fail "JWT_SECRET is using default or weak value; set a strong random secret"
}

Log-Section "Summary"

Write-Host ""
Write-Host "Passed:   " -NoNewline
Write-Host $ChecksPassed -ForegroundColor $Colors.Pass
Write-Host "Failed:   " -NoNewline
Write-Host $ChecksFailed -ForegroundColor $Colors.Fail
Write-Host "Warnings: " -NoNewline
Write-Host $Warnings -ForegroundColor $Colors.Warn
Write-Host ""

if ($ChecksFailed -gt 0) {
    Write-Host "❌ Deployment blocked: $ChecksFailed critical checks failed." -ForegroundColor $Colors.Fail
    Write-Host "Fix the issues above and re-run this check."
    exit 1
}
elseif ($Warnings -gt 0) {
    Write-Host "⚠️  Deployment allowed with $Warnings warnings." -ForegroundColor $Colors.Warn
    Write-Host "Review the warnings above before proceeding to production."
    exit 0
}
else {
    Write-Host "✅ All checks passed! Deployment is ready." -ForegroundColor $Colors.Pass
    exit 0
}
