<#
.SYNOPSIS
    Runs the browser tests in e2e/ against one environment.
.DESCRIPTION
    Playwright drives a real browser through the main journeys: logging in as each test
    user, placing an order, shipping it and cancelling one. The tests place real orders,
    so they are allowed on dev and qa only.
    First use on a machine: cd e2e; npm ci; npx playwright install chromium
.EXAMPLE
    .\infra\e2e-test.ps1 -Environment dev
    .\infra\e2e-test.ps1 -Environment dev -Headed     # watch the browser do it
#>
param(
    [Parameter(Mandatory)][ValidateSet('dev', 'qa')][string]$Environment,
    [switch]$Headed
)

. "$PSScriptRoot\common.ps1"
$context = Get-KubeContext $Environment

# The test users' password is generated per cluster; hand it to the tests without printing it.
$encoded = kubectl --context $context -n $Namespace get secret shopflow-keycloak -o "jsonpath={.data.user-password}"
if ($LASTEXITCODE -ne 0 -or -not $encoded) { throw "[$Environment] could not read the shopflow-keycloak secret" }
$env:E2E_USER_PASSWORD = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
$env:E2E_BASE_URL = Get-EnvironmentUrl $Environment

$arguments = @('playwright', 'test')
if ($Headed) { $arguments += '--headed' }

Push-Location (Join-Path $PSScriptRoot '..\e2e')
try {
    Write-Host "[$Environment] running browser tests against $($env:E2E_BASE_URL)"
    npx @arguments
    $failed = $LASTEXITCODE -ne 0
}
finally {
    Pop-Location
    $env:E2E_USER_PASSWORD = $null
}

if ($failed) {
    throw "[$Environment] browser tests failed. Open the report with: cd e2e; npx playwright show-report"
}
Write-Host "[$Environment] browser tests passed"
