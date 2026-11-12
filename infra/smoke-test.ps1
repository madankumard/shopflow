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
    foreach ($app in 'backend', 'frontend') {
        $image = kubectl --context $context -n $Namespace get deployment $app -o "jsonpath={.spec.template.spec.containers[0].image}"
        if ($image -ne "$ImageRepository/shopflow-${app}:$Tag") {
            throw "[$Environment] $app runs $image, expected tag $Tag"
        }
    }
    Write-Host "[$Environment] both deployments run tag $Tag"
}

$page = Get-WithRetry "$url/"
if ($page.Content -notmatch '<app-root') { throw "[$Environment] the home page is not the Angular app" }
Write-Host "[$Environment] home page OK"

$products = (Get-WithRetry "$url/api/products").Content | ConvertFrom-Json
if (@($products).Count -lt 1) { throw "[$Environment] the products API returned no products" }
Write-Host "[$Environment] products API OK ($(@($products).Count) products)"

Write-Host "[$Environment] smoke test passed"
