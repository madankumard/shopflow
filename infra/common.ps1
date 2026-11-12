# Shared settings for the infra scripts. Dot-source this file: . "$PSScriptRoot\common.ps1"

# Each environment is its own kind cluster, reachable on its own local port.
$Environments = [ordered]@{
    dev     = 8081
    qa      = 8082
    preprod = 8083
    prod    = 8084
}

$Namespace = 'shopflow'
$ImageRepository = 'ghcr.io/madankumard'
# Our own images, built by CI and tagged with the commit.
$AppImages = 'shopflow-backend', 'shopflow-frontend', 'shopflow-config-server'
# Third-party images, copied into each cluster from this machine so the clusters do not each
# download them. Keep in step with infra/k8s/base/postgres.yaml, vault.yaml and keycloak.yaml.
$PreloadImages = 'postgres:18', 'hashicorp/vault:2.2.1', 'quay.io/keycloak/keycloak:26.8.1'

function Get-KubeContext([string]$Environment) {
    "kind-shopflow-$Environment"
}

function Get-EnvironmentUrl([string]$Environment) {
    "http://localhost:$($Environments[$Environment])"
}

function Assert-Environment([string]$Environment) {
    if (-not $Environments.Contains($Environment)) {
        throw "Unknown environment '$Environment'. Use one of: $($Environments.Keys -join ', ')"
    }
}

# winget installs kind as an alias that shells opened before the install cannot see.
function Get-KindPath {
    $cmd = Get-Command kind -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $link = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\kind.exe'
    if (Test-Path $link) { return $link }
    throw 'kind is not installed. Run: winget install Kubernetes.kind'
}

function New-Password {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

# Creates the namespace and the per-cluster secrets if they are missing. Each secret is
# generated once and never changed: Postgres keeps the password it was first started with.
function Initialize-ClusterSecrets([string]$Environment) {
    $context = Get-KubeContext $Environment

    kubectl --context $context apply -f "$PSScriptRoot\k8s\base\namespace.yaml" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "[$Environment] could not create the namespace" }

    $secrets = [ordered]@{
        'shopflow-db'    = { @('--from-literal=username=shopflow', "--from-literal=password=$(New-Password)") }
        'shopflow-vault' = { @("--from-literal=root-token=$(New-Password)") }
        # admin-password: Keycloak's own admin console. user-password: the three test users.
        'shopflow-keycloak' = { @("--from-literal=admin-password=$(New-Password)", "--from-literal=user-password=$(New-Password)") }
    }
    foreach ($name in $secrets.Keys) {
        kubectl --context $context -n $Namespace get secret $name 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            # @(...) keeps a single literal as a one-item list; without it the string is split up.
            $literals = @(& $secrets[$name])
            kubectl --context $context -n $Namespace create secret generic $name @literals | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "[$Environment] could not create the secret $name" }
            Write-Host "[$Environment] generated secret $name"
        }
    }
}
