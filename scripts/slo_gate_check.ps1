param(
    [string]$BaseUrl = "http://localhost/api",
    [string]$TenantId = "00000000-0000-0000-0000-000000000001",
    [string]$Email = "slo-check-admin@vetrai.com",
    [string]$Role = "admin",
    [int]$ReadyProbeCount = 10,
    [int]$ExecuteIterations = 20,
    [int]$ExecuteWarmupCount = 2,
    [int]$MaxExecuteP95Ms = 300
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

function Get-PercentileMs {
    param(
        [Parameter(Mandatory = $true)][double[]]$Values,
        [Parameter(Mandatory = $true)][double]$Percentile
    )

    if ($Values.Count -eq 0) {
        throw "Cannot compute percentile on empty values list."
    }

    $sorted = $Values | Sort-Object
    $index = [Math]::Ceiling(($Percentile / 100.0) * $sorted.Count) - 1
    $index = [Math]::Max(0, [Math]::Min($index, $sorted.Count - 1))
    return [Math]::Round([double]$sorted[$index], 2)
}

if ($ReadyProbeCount -lt 1) {
    throw "ReadyProbeCount must be >= 1."
}
if ($ExecuteIterations -lt 1) {
    throw "ExecuteIterations must be >= 1."
}
if ($ExecuteWarmupCount -lt 0) {
    throw "ExecuteWarmupCount must be >= 0."
}

$readySuccess = 0
for ($i = 1; $i -le $ReadyProbeCount; $i++) {
    try {
        $ready = Invoke-RestMethod -Method GET -Uri "$BaseUrl/health/ready"
        if ($ready.status -eq "ok") {
            $readySuccess++
        }
    }
    catch {
        # Probe failed; keep sampling to compute final ratio.
    }
    Start-Sleep -Milliseconds 150
}

$readyRatio = [Math]::Round(($readySuccess / $ReadyProbeCount) * 100.0, 2)
if ($readySuccess -ne $ReadyProbeCount) {
    throw "Readiness SLO gate failed: $readySuccess/$ReadyProbeCount successful probes ($readyRatio%)."
}

$tokenResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/auth/token" -Body @{
    email = $Email
    tenant_id = $TenantId
    role = $Role
}
$headers = @{ Authorization = "Bearer $($tokenResp.access_token)" }

$createResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/create" -Headers $headers -Body @{
    name = "SLO Latency Check Flow"
    json_definition = @{ nodes = @("rag", "tools", "llm") }
}
$flowId = $createResp.flow_id

Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/$flowId/publish" -Headers $headers -Body @{} | Out-Null

$totalCalls = $ExecuteWarmupCount + $ExecuteIterations
$latenciesMs = @()
for ($i = 1; $i -le $totalCalls; $i++) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $resp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/$flowId/execute" -Headers $headers -Body @{
        input = @{ question = "slo-latency-check-$i" }
        enable_tools = $false
        wait_for_ingestion = $false
    }
    $sw.Stop()

    if ($resp.status -ne "queued") {
        throw "Execute response status was not queued at iteration $i."
    }

    if ($i -gt $ExecuteWarmupCount) {
        $latenciesMs += [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)
    }
}

$p95Ms = Get-PercentileMs -Values $latenciesMs -Percentile 95
$avgMs = [Math]::Round((($latenciesMs | Measure-Object -Average).Average), 2)
$maxMs = [Math]::Round((($latenciesMs | Measure-Object -Maximum).Maximum), 2)

if ($p95Ms -gt $MaxExecuteP95Ms) {
    throw "Execute latency SLO gate failed: p95=${p95Ms}ms exceeds threshold ${MaxExecuteP95Ms}ms."
}

$summary = [ordered]@{
    readiness = [ordered]@{
        successful_probes = $readySuccess
        total_probes = $ReadyProbeCount
        success_percent = $readyRatio
    }
    execute_latency_ms = [ordered]@{
        measured_iterations = $ExecuteIterations
        warmup_iterations = $ExecuteWarmupCount
        p95 = $p95Ms
        average = $avgMs
        max = $maxMs
        threshold_p95 = $MaxExecuteP95Ms
    }
    flow_id = $flowId
}

$summary | ConvertTo-Json -Depth 10
