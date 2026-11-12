<#
.SYNOPSIS
    Creates the kind clusters that stand in for the dev, qa, preprod and prod servers.
.DESCRIPTION
    Safe to re-run: existing clusters and secrets are left untouched.
    Each cluster gets its own generated database password, stored only as a Kubernetes Secret.
.EXAMPLE
    .\infra\create-clusters.ps1
    .\infra\create-clusters.ps1 -Environment dev
#>
param(
    [string[]]$Environment = @('dev', 'qa', 'preprod', 'prod')
)

. "$PSScriptRoot\common.ps1"
$kind = Get-KindPath

function New-Password {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

$existing = & $kind get clusters

foreach ($e in $Environment) {
    Assert-Environment $e
    $cluster = "shopflow-$e"
    $context = Get-KubeContext $e

    if ($existing -contains $cluster) {
        Write-Host "[$e] cluster already exists"
    }
    else {
        Write-Host "[$e] creating cluster $cluster"
        & $kind create cluster --config "$PSScriptRoot\kind\$e.yaml" --wait 120s
        if ($LASTEXITCODE -ne 0) { throw "kind could not create $cluster" }
    }

    kubectl --context $context apply -f "$PSScriptRoot\k8s\base\namespace.yaml" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "could not create the namespace in $cluster" }

    # Only ever created once: Postgres keeps the password it was first started with.
    kubectl --context $context -n $Namespace get secret shopflow-db 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        kubectl --context $context -n $Namespace create secret generic shopflow-db `
            "--from-literal=username=shopflow" "--from-literal=password=$(New-Password)" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "could not create the database secret in $cluster" }
        Write-Host "[$e] generated database secret"
    }

    Write-Host "[$e] ready at $(Get-EnvironmentUrl $e)"
}
