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

# One address: login only works on localhost, so nginx sends pages opened by any other address
# there, but must never redirect API or login calls (a redirected POST arrives as a GET).
# Sent to 127.0.0.1 with the Host header set, and without following redirects.
function Send-Raw([string]$Method, [string]$HostHeader, [string]$Path) {
    $port = ([Uri]$url).Port
    $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$port$Path")
    $request.Method = $Method
    $request.Host = $HostHeader
    $request.AllowAutoRedirect = $false
    $request.Timeout = 10000
    if ($Method -eq 'POST') {
        $body = [Text.Encoding]::UTF8.GetBytes('{}')
        $request.ContentType = 'application/json'
        $request.ContentLength = $body.Length
        $stream = $request.GetRequestStream()
        $stream.Write($body, 0, $body.Length)
        $stream.Close()
    }
    try { $response = $request.GetResponse() }
    catch [System.Net.WebException] { $response = $_.Exception.Response }
    if (-not $response) { throw "[$Environment] no answer to $Method $Path as $HostHeader" }
    $result = [pscustomobject]@{ Status = [int]$response.StatusCode; Location = $response.Headers['Location'] }
    $response.Close()
    $result
}
$port = ([Uri]$url).Port
$redirect = Send-Raw 'GET' "127.0.0.1:$port" '/products?check=1'
if ($redirect.Status -ne 302 -or $redirect.Location -ne "$url/products?check=1") {
    throw "[$Environment] a page opened as 127.0.0.1 answered $($redirect.Status) $($redirect.Location), expected a redirect to $url/products?check=1"
}
$api = Send-Raw 'POST' "127.0.0.1:$port" '/api/orders'
if ($api.Status -ne 401) {
    throw "[$Environment] a POST to the API as 127.0.0.1 answered $($api.Status), expected 401 (passed to the backend, not redirected)"
}
Write-Host "[$Environment] one address OK (pages redirect to localhost, API calls do not)"

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
