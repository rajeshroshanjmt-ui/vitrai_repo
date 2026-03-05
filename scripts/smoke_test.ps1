param(
    [string]$BaseUrl = "http://localhost/api",
    [string]$TenantId = "00000000-0000-0000-0000-000000000001",
    [string]$Email = "admin@vetrai.com",
    [string]$Role = "admin",
    [int]$PollSeconds = 2,
    [int]$IngestionTimeoutSeconds = 240,
    [int]$ExecutionTimeoutSeconds = 240
)

$ErrorActionPreference = "Stop"

function Invoke-JsonApi {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter()][hashtable]$Headers,
        [Parameter()][object]$Body
    )

    $jsonBody = $null
    if ($null -ne $Body) {
        $jsonBody = $Body | ConvertTo-Json -Depth 40
    }

    if ($null -eq $Headers) {
        return Invoke-RestMethod -Method $Method -Uri $Uri -ContentType "application/json" -Body $jsonBody
    }
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json" -Body $jsonBody
}

function Wait-ForIngestion {
    param(
        [string]$FlowId,
        [string]$IngestionJobId,
        [hashtable]$Headers
    )

    $attempts = [Math]::Ceiling($IngestionTimeoutSeconds / $PollSeconds)
    for ($i = 0; $i -lt $attempts; $i++) {
        Start-Sleep -Seconds $PollSeconds
        $jobs = Invoke-JsonApi -Method "GET" -Uri "$BaseUrl/flows/$FlowId/ingestions" -Headers $Headers
        $job = $jobs | Where-Object { $_.ingestion_job_id -eq $IngestionJobId } | Select-Object -First 1
        if ($null -eq $job) {
            continue
        }
        if ($job.status -in @("completed", "failed")) {
            return $job
        }
    }
    throw "Timed out waiting for ingestion job completion: $IngestionJobId"
}

function Wait-ForExecution {
    param(
        [string]$ExecutionLogId,
        [hashtable]$Headers
    )

    $attempts = [Math]::Ceiling($ExecutionTimeoutSeconds / $PollSeconds)
    for ($i = 0; $i -lt $attempts; $i++) {
        Start-Sleep -Seconds $PollSeconds
        $logs = Invoke-JsonApi -Method "GET" -Uri "$BaseUrl/flows/logs?limit=200" -Headers $Headers
        $log = $logs | Where-Object { $_.execution_log_id -eq $ExecutionLogId } | Select-Object -First 1
        if ($null -eq $log) {
            continue
        }
        if ($log.status -in @("completed", "failed")) {
            return $log
        }
    }
    throw "Timed out waiting for execution completion: $ExecutionLogId"
}

function Wait-ForBackendReady {
    $attempts = 60
    for ($i = 0; $i -lt $attempts; $i++) {
        try {
            $ready = Invoke-RestMethod -Method GET -Uri "$BaseUrl/health/ready" -TimeoutSec 5
            if ($ready.status -eq "ok") {
                return
            }
        }
        catch {
            # keep retrying while services warm up
        }
        Start-Sleep -Seconds 2
    }
    throw "Timed out waiting for backend readiness: $BaseUrl/health/ready"
}

Wait-ForBackendReady

$tokenResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/auth/token" -Body @{
    email = $Email
    tenant_id = $TenantId
    role = $Role
}

$headers = @{ Authorization = "Bearer $($tokenResp.access_token)" }

$createResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/create" -Headers $headers -Body @{
    name = "Smoke Test Flow"
    json_definition = @{ nodes = @("rag", "tools", "llm") }
}
$flowId = $createResp.flow_id

$publishResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/$flowId/publish" -Headers $headers -Body @{}

$docText = "Refunds are allowed within 30 days for unused subscriptions."
$ingestResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/$flowId/documents" -Headers $headers -Body @{
    documents = @(
        @{ text = $docText; source = "smoke-test"; metadata = @{ topic = "refund-policy" } },
        @{ text = $docText; source = "smoke-test"; metadata = @{ topic = "refund-policy" } }
    )
}

$ingestionBlocked = $false
try {
    Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/$flowId/execute" -Headers $headers -Body @{
        input = @{ question = "What is the refund window?" }
        enable_tools = $true
        wait_for_ingestion = $true
    } | Out-Null
}
catch {
    $statusCode = [int]$_.Exception.Response.StatusCode
    if ($statusCode -eq 409) {
        $ingestionBlocked = $true
    }
    else {
        throw
    }
}

if (-not $ingestionBlocked) {
    throw "Expected execute to be blocked with HTTP 409 while ingestion is in progress."
}

$ingestionJob = Wait-ForIngestion -FlowId $flowId -IngestionJobId $ingestResp.ingestion_job_id -Headers $headers
if ($ingestionJob.status -ne "completed") {
    throw "Ingestion ended with non-success status: $($ingestionJob.status). Error: $($ingestionJob.error_message)"
}

$executeResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/$flowId/execute" -Headers $headers -Body @{
    input = @{ question = "What is the refund window?" }
    enable_tools = $true
    wait_for_ingestion = $true
}

$executionLog = Wait-ForExecution -ExecutionLogId $executeResp.execution_log_id -Headers $headers
if ($executionLog.status -ne "completed") {
    throw "Execution ended with non-success status: $($executionLog.status). Error: $($executionLog.error_message)"
}

$summary = [ordered]@{
    flow_id = $flowId
    published_version = $publishResp.published_version
    ingestion_job = $ingestionJob
    execution_log = $executionLog
}

$summary | ConvertTo-Json -Depth 20
