param(
    [string]$BaseUrl = "http://localhost/api",
    [string]$TenantA = "00000000-0000-0000-0000-000000000001",
    [string]$TenantB = "00000000-0000-0000-0000-000000000002",
    [string]$EmailA = "tenant-a-admin@vetrai.com",
    [string]$EmailB = "tenant-b-admin@vetrai.com"
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

function Assert-HttpStatus {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter()][hashtable]$Headers,
        [Parameter()][object]$Body,
        [Parameter(Mandatory = $true)][int]$ExpectedStatus
    )

    try {
        Invoke-JsonApi -Method $Method -Uri $Uri -Headers $Headers -Body $Body | Out-Null
        if ($ExpectedStatus -ne 200) {
            throw "Expected HTTP $ExpectedStatus from $Method $Uri but request succeeded with 200."
        }
    }
    catch {
        $response = $_.Exception.Response
        if ($null -eq $response) {
            throw
        }
        $actualStatus = [int]$response.StatusCode
        if ($actualStatus -ne $ExpectedStatus) {
            throw "Expected HTTP $ExpectedStatus from $Method $Uri but got $actualStatus."
        }
    }
}

$tokenA = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/auth/token" -Body @{
    email = $EmailA
    tenant_id = $TenantA
    role = "admin"
}
$headersA = @{ Authorization = "Bearer $($tokenA.access_token)" }

$tokenB = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/auth/token" -Body @{
    email = $EmailB
    tenant_id = $TenantB
    role = "admin"
}
$headersB = @{ Authorization = "Bearer $($tokenB.access_token)" }

$createResp = Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/create" -Headers $headersA -Body @{
    name = "Tenant A Isolation Flow"
    json_definition = @{ nodes = @("rag", "tools", "llm") }
}
$flowA = $createResp.flow_id

Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/$flowA/publish" -Headers $headersA -Body @{} | Out-Null
Invoke-JsonApi -Method "POST" -Uri "$BaseUrl/flows/$flowA/execute" -Headers $headersA -Body @{
    input = @{ question = "tenant-a-check" }
    enable_tools = $true
    wait_for_ingestion = $false
} | Out-Null

# Cross-tenant access attempts must fail.
Assert-HttpStatus -Method "GET" -Uri "$BaseUrl/flows/$flowA/ingestions" -Headers $headersB -ExpectedStatus 404
Assert-HttpStatus -Method "POST" -Uri "$BaseUrl/flows/$flowA/publish" -Headers $headersB -Body @{} -ExpectedStatus 404
Assert-HttpStatus -Method "POST" -Uri "$BaseUrl/flows/$flowA/execute" -Headers $headersB -Body @{
    input = @{ question = "tenant-b-cross-access" }
    enable_tools = $true
    wait_for_ingestion = $false
} -ExpectedStatus 404
Assert-HttpStatus -Method "POST" -Uri "$BaseUrl/flows/$flowA/documents" -Headers $headersB -Body @{
    documents = @(
        @{ text = "cross-tenant test"; source = "tenant-b"; metadata = @{ scope = "deny" } }
    )
} -ExpectedStatus 404

$logsA = Invoke-JsonApi -Method "GET" -Uri "$BaseUrl/flows/logs" -Headers $headersA
$logsB = Invoke-JsonApi -Method "GET" -Uri "$BaseUrl/flows/logs" -Headers $headersB

$tenantAHasFlow = @($logsA | Where-Object { $_.flow_id -eq $flowA }).Count -ge 1
if (-not $tenantAHasFlow) {
    throw "Tenant A logs did not include the expected flow execution."
}

$tenantBHasFlow = @($logsB | Where-Object { $_.flow_id -eq $flowA }).Count -ge 1
if ($tenantBHasFlow) {
    throw "Tenant B logs leaked Tenant A flow executions."
}

$summary = [ordered]@{
    tenant_a = $TenantA
    tenant_b = $TenantB
    flow_id = $flowA
    cross_tenant_requests_blocked = $true
    tenant_log_isolation = $true
}

$summary | ConvertTo-Json -Depth 10
