<#
.SYNOPSIS
    Checks that an environment is serving the app, and optionally that it runs the expected tag.
.EXAMPLE
    .\infra\smoke-test.ps1 -Environment dev -Tag 3f2a9c1
#>
param(
    [Parameter(Mandatory)][string]$Environment,
    [string]$Tag
)

. "$PSScriptRoot\common.ps1"
Assert-Environment $Environment
$context = Get-KubeContext $Environment
$url = Get-EnvironmentUrl $Environment

function Get-WithRetry([string]$Uri) {
    $lastError = $null
    foreach ($attempt in 1..12) {
        try {
            return Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 10
        }
        catch {
            $lastError = $_
            Start-Sleep -Seconds 5
        }
    }
    throw "[$Environment] $Uri did not respond: $lastError"
}

if ($Tag) {
    foreach ($app in 'backend', 'frontend', 'config-server') {
        $image = kubectl --context $context -n $Namespace get deployment $app -o "jsonpath={.spec.template.spec.containers[0].image}"
        if ($image -ne "$ImageRepository/shopflow-${app}:$Tag") {
            throw "[$Environment] $app runs $image, expected tag $Tag"
        }
    }
    Write-Host "[$Environment] all deployments run tag $Tag"
}

$page = Get-WithRetry "$url/"
if ($page.Content -notmatch '<app-root') { throw "[$Environment] the home page is not the Angular app" }
Write-Host "[$Environment] home page OK"

$products = (Get-WithRetry "$url/api/products").Content | ConvertFrom-Json
if (@($products).Count -lt 1) { throw "[$Environment] the products API returned no products" }
Write-Host "[$Environment] products API OK ($(@($products).Count) products)"

# The environment name is served by the Config Server, so this proves the settings reached the app
# (and the products check above proves the database password from Vault did).
$info = (Get-WithRetry "$url/api/info").Content | ConvertFrom-Json
if ($info.environment -ne $Environment) {
    throw "[$Environment] the app reports environment '$($info.environment)'"
}
if ($Tag -and $info.version -ne $Tag) {
    throw "[$Environment] the app reports version '$($info.version)', expected $Tag"
}
Write-Host "[$Environment] app info OK (environment $($info.environment), version $($info.version))"

# Login: Keycloak must answer through the app's own address and name that address as issuer,
# and the backend must refuse a protected call that carries no login.
$issuer = "$url/auth/realms/shopflow"
$discovery = (Get-WithRetry "$issuer/.well-known/openid-configuration").Content | ConvertFrom-Json
if ($discovery.issuer -ne $issuer) {
    throw "[$Environment] Keycloak reports issuer '$($discovery.issuer)', expected $issuer"
}
$status = 0
try {
    Invoke-WebRequest -Uri "$url/api/products" -Method Post -ContentType 'application/json' -Body '{}' -UseBasicParsing -TimeoutSec 10 | Out-Null
}
catch {
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
}
if ($status -ne 401) {
    throw "[$Environment] adding a product without a login returned $status, expected 401"
}
# Orders exist only for logged-in users.
$status = 0
try {
    Invoke-WebRequest -Uri "$url/api/orders" -UseBasicParsing -TimeoutSec 10 | Out-Null
    $status = 200
}
catch {
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
}
if ($status -ne 401) {
    throw "[$Environment] listing orders without a login returned $status, expected 401"
}
# Reports are for admins.
$status = 0
try {
    Invoke-WebRequest -Uri "$url/api/reports" -UseBasicParsing -TimeoutSec 10 | Out-Null
    $status = 200
}
catch {
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
}
if ($status -ne 401) {
    throw "[$Environment] reading the reports without a login returned $status, expected 401"
}
Write-Host "[$Environment] login OK (Keycloak reachable, protected calls refused without a token)"

Write-Host "[$Environment] smoke test passed"
