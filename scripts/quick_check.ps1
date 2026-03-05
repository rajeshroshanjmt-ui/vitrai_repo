param(
    [string]$BaseUrl = "http://localhost/api",
    [string]$TenantId = "00000000-0000-0000-0000-000000000001",
    [string]$Email = "admin@vetrai.com",
    [string]$Role = "admin"
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
        $jsonBody = $Body | ConvertTo-Json -Depth 30
    }

    if ($null -eq $Headers) {
        return Invoke-RestMethod -Method $Method -Uri $Uri -ContentType "application/json" -Body $jsonBody
    }
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json" -Body $jsonBody
}

$health = Invoke-RestMethod -Method GET -Uri "$BaseUrl/health/ready"
if ($health.status -ne "ok") {
    throw "Backend health check failed."
}

$tokenResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/auth/token" -Body @{
    email = $Email
    tenant_id = $TenantId
    role = $Role
}
$headers = @{ Authorization = "Bearer $($tokenResp.access_token)" }

$createResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/create" -Headers $headers -Body @{
    name = "Quick Check Flow"
    json_definition = @{ nodes = @("rag", "tools", "llm") }
}
$flowId = $createResp.flow_id

$publishResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/$flowId/publish" -Headers $headers -Body @{}
$usageResp = Invoke-JsonApi -Method "GET" -Uri "$BaseUrl/flows/usage" -Headers $headers

$ingestResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/$flowId/documents" -Headers $headers -Body @{
    documents = @(
        @{ text = "Refunds are allowed within 30 days for unused subscriptions."; source = "quick-check"; metadata = @{ topic = "refund-policy" } }
    )
}

$blocked = $false
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
        $blocked = $true
    }
    else {
        throw
    }
}

if (-not $blocked) {
    throw "Expected HTTP 409 from execute while ingestion is queued/processing."
}

$agentEvalResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/agent/tasks/evaluate" -Headers $headers -Body @{
    task_description = "Apply scoped frontend style update with quick regression checks"
    requested_paths = @("frontend/ui/src/styles.css")
    requested_tools = @("file_read", "file_write", "test_runner")
    requires_write = $true
    estimated_tokens = 500
    expected_duration_ms = 5000
    expected_files_changed = 1
    expected_total_changed_bytes = 2048
}
if (-not $agentEvalResp.allowed) {
    $reasons = $agentEvalResp.reasons -join "; "
    throw "Agent policy evaluation was rejected: $reasons"
}

$agentConfigResp = Invoke-JsonApi -Method "GET" -Uri "$BaseUrl/agent/tasks/config" -Headers $headers
if (($agentConfigResp.limits.max_runtime_files_changed -as [int]) -lt 1) {
    throw "Agent config limits were not returned as expected."
}

$agentTaskId = $agentEvalResp.task_id
$agentRunningResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/agent/tasks/report" -Headers $headers -Body @{
    task_id = $agentTaskId
    status = "running"
    files_changed = @("frontend/ui/src/styles.css")
    changed_bytes = 512
    execution_duration_ms = 400
    tokens_used = 120
}
if ($agentRunningResp.status -ne "running") {
    throw "Expected running status from agent report endpoint."
}

$agentCompletedResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/agent/tasks/report" -Headers $headers -Body @{
    task_id = $agentTaskId
    status = "completed"
    files_changed = @("frontend/ui/src/styles.css")
    changed_bytes = 1024
    execution_duration_ms = 800
    tokens_used = 240
    branch_name = "feature/quick-check-guardrails"
    pr_url = "https://example.invalid/pr/quick-check-guardrails"
}
if ($agentCompletedResp.status -ne "completed") {
    throw "Expected completed status from agent report endpoint."
}

$agentAuditResp = Invoke-JsonApi -Method "GET" -Uri "$BaseUrl/agent/tasks/audit?status=completed&task_id=$agentTaskId" -Headers $headers
$agentAuditItem = $agentAuditResp.items | Select-Object -First 1
if ($agentAuditResp.total_count -lt 1 -or $null -eq $agentAuditItem) {
    throw "Expected at least one completed agent task audit record."
}
if ($agentAuditItem.task_id -ne $agentTaskId) {
    throw "Agent audit response task_id did not match the evaluated task."
}

$ingestions = Invoke-JsonApi -Method "GET" -Uri "$BaseUrl/flows/$flowId/ingestions" -Headers $headers
$latest = $ingestions | Select-Object -First 1
if ($null -eq $latest) {
    throw "No ingestion job was returned by /ingestions endpoint."
}

$summary = [ordered]@{
    flow_id = $flowId
    published_version = $publishResp.published_version
    usage_snapshot = [ordered]@{
        monthly_tokens_used = $usageResp.monthly_tokens_used
        monthly_usage_percent = $usageResp.monthly_usage_percent
        queue_depth_total = $usageResp.queue_depth.total
    }
    ingestion_job = $latest
    execute_blocked = $blocked
    agent_task = [ordered]@{
        task_id = $agentTaskId
        config_loaded = $true
        policy_allowed = $agentEvalResp.allowed
        running_status = $agentRunningResp.status
        completed_status = $agentCompletedResp.status
        completed_audit_records = $agentAuditResp.total_count
    }
}

$summary | ConvertTo-Json -Depth 20
