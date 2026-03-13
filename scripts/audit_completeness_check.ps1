param(
    [string]$BaseUrl = "http://localhost/api",
    [string]$TenantId = "00000000-0000-0000-0000-000000000001",
    [string]$Email = "audit-check-admin@vetrai.com",
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

function Assert-NotBlank {
    param(
        [Parameter(Mandatory = $true)][object]$Value,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if ($null -eq $Value) {
        throw "$Label is null."
    }
    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) {
        throw "$Label is empty."
    }
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

$evaluateResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/agent/tasks/evaluate" -Headers $headers -Body @{
    task_description = "Apply scoped frontend style update with quick regression checks"
    requested_paths = @("frontend/ui/src/styles.css")
    requested_tools = @("file_read", "file_write", "test_runner")
    requires_write = $true
    estimated_tokens = 300
    expected_duration_ms = 3000
    expected_files_changed = 1
    expected_total_changed_bytes = 2048
}

if (-not $evaluateResp.allowed) {
    $reasons = $evaluateResp.reasons -join "; "
    throw "Expected policy approval but evaluate returned rejected: $reasons"
}

$taskId = $evaluateResp.task_id
Assert-NotBlank -Value $taskId -Label "task_id"

$runningResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/agent/tasks/report" -Headers $headers -Body @{
    task_id = $taskId
    status = "running"
    files_changed = @("frontend/ui/src/styles.css")
    changed_bytes = 512
    execution_duration_ms = 400
    tokens_used = 120
}
if ($runningResp.status -ne "running") {
    throw "Expected running status from report endpoint."
}

$completedResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/agent/tasks/report" -Headers $headers -Body @{
    task_id = $taskId
    status = "completed"
    files_changed = @("frontend/ui/src/styles.css")
    changed_bytes = 1024
    execution_duration_ms = 800
    tokens_used = 240
    branch_name = "feature/audit-completeness-check"
    pr_url = "https://example.invalid/pr/audit-completeness-check"
}
if ($completedResp.status -ne "completed") {
    throw "Expected completed status from report endpoint."
}

$auditResp = Invoke-JsonApi -Method "GET" -Uri "$BaseUrl/agent/tasks/audit?task_id=$taskId&limit=50" -Headers $headers
$items = @($auditResp.items)
if ($auditResp.total_count -lt 3 -or $items.Count -lt 3) {
    throw "Expected at least 3 audit records for the task (policy_approved, running, completed)."
}

$expectedActions = @(
    "agent_task_policy_approved",
    "agent_task_running",
    "agent_task_completed"
)
$expectedActionSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$expectedActions)
$actualActionSet = [System.Collections.Generic.HashSet[string]]::new()

foreach ($item in $items) {
    Assert-NotBlank -Value $item.audit_log_id -Label "audit_log_id"
    Assert-NotBlank -Value $item.task_id -Label "item.task_id"
    Assert-NotBlank -Value $item.tenant_id -Label "tenant_id"
    Assert-NotBlank -Value $item.actor_email -Label "actor_email"
    Assert-NotBlank -Value $item.action -Label "action"
    Assert-NotBlank -Value $item.created_at -Label "created_at"
    if ($item.task_id -ne $taskId) {
        throw "Audit item task_id mismatch. Expected $taskId but found $($item.task_id)."
    }
    if ($null -eq $item.details) {
        throw "Audit item details is null for action $($item.action)."
    }
    [DateTimeOffset]::Parse($item.created_at) | Out-Null
    [void]$actualActionSet.Add([string]$item.action)
}

foreach ($action in $expectedActionSet) {
    if (-not $actualActionSet.Contains($action)) {
        throw "Expected audit action `$action` is missing from /agent/tasks/audit response."
    }
}

$completedAudit = Invoke-JsonApi -Method "GET" -Uri "$BaseUrl/agent/tasks/audit?task_id=$taskId&status=completed&limit=10" -Headers $headers
if ($completedAudit.total_count -lt 1) {
    throw "Expected at least one completed audit record when filtering by status=completed."
}

$summary = [ordered]@{
    task_id = $taskId
    total_task_audit_records = $auditResp.total_count
    expected_actions_present = $true
    completed_filter_count = $completedAudit.total_count
}

# Check for flow lifecycle, DLQ, evaluation, and user audit actions
Write-Host "Checking for flow lifecycle, DLQ, evaluation, and user audit coverage..." -ForegroundColor Cyan

$allAuditResp = Invoke-JsonApi -Method "GET" -Uri "$BaseUrl/flows/audit?limit=100" -Headers $headers
$allAuditItems = @($allAuditResp.data)

$expectedFlowActions = @(
    "flow.published",
    "flow.executed",
    "dlq_replay",
    "dlq_delete",
    "evaluation.created",
    "ingestion.started",
    "user.invited",
    "user.deleted",
    "user.role_changed"
)

Write-Host "Total audit records found: $($allAuditResp.total)" -ForegroundColor Gray
if ($allAuditResp.total -gt 0) {
    $foundActions = @($allAuditItems | Select-Object -ExpandProperty action -Unique)
    Write-Host "Sample actions found in audit log: $([string]::Join(', ', $foundActions[0..5]))" -ForegroundColor Gray

    $missingActions = @()
    foreach ($action in $expectedFlowActions) {
        $found = $foundActions -contains $action
        if (-not $found) {
            $missingActions += $action
        } else {
            Write-Host "✓ Found audit action: $action" -ForegroundColor Green
        }
    }

    if ($missingActions.Count -gt 0) {
        Write-Host "⚠ Missing audit actions (may not be triggered yet): $([string]::Join(', ', $missingActions))" -ForegroundColor Yellow
    }
}

$summary['flow_lifecycle_coverage'] = $missingActions.Count -eq 0 -or $allAuditResp.total -lt 1 ? "unchecked" : ($missingActions.Count -eq 0 ? "complete" : "partial")
$summary | ConvertTo-Json -Depth 10
