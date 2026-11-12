<#
.SYNOPSIS
    Shows the test logins for one environment.
.DESCRIPTION
    Each cluster has its own generated passwords, kept only in that cluster's
    shopflow-keycloak Secret. This reads them so you can log in.
.EXAMPLE
    .\infra\show-logins.ps1 -Environment dev
#>
param(
    [Parameter(Mandatory)][string]$Environment
)

. "$PSScriptRoot\common.ps1"
Assert-Environment $Environment
$context = Get-KubeContext $Environment
$url = Get-EnvironmentUrl $Environment

function Get-SecretValue([string]$Key) {
    $encoded = kubectl --context $context -n $Namespace get secret shopflow-keycloak -o "jsonpath={.data.$Key}"
    if ($LASTEXITCODE -ne 0 -or -not $encoded) { throw "[$Environment] could not read the shopflow-keycloak secret" }
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
}

$userPassword = Get-SecretValue 'user-password'
$adminPassword = Get-SecretValue 'admin-password'

Write-Host ""
Write-Host "ShopFlow $Environment : $url"
Write-Host "  Users (role = first part of the name): customer1, warehouse1, admin1"
Write-Host "  Password for all three:                $userPassword"
Write-Host ""
Write-Host "Keycloak admin console: $url/auth/admin/"
Write-Host "  Username: admin"
Write-Host "  Password: $adminPassword"
Write-Host ""
