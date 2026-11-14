<#
.SYNOPSIS
    Creates the kind clusters that stand in for separate servers. Without -Environment it
    creates the active environments (see $ActiveEnvironments in common.ps1); name one of
    dev, qa, preprod or prod to create that one.
.DESCRIPTION
    Safe to re-run: existing clusters and secrets are left untouched.
    Each cluster gets its own generated database password and Vault token, stored only as Kubernetes Secrets.
.EXAMPLE
    .\infra\create-clusters.ps1
    .\infra\create-clusters.ps1 -Environment dev
#>
param(
    [string[]]$Environment
)

. "$PSScriptRoot\common.ps1"
if (-not $Environment) { $Environment = $ActiveEnvironments }
$kind = Get-KindPath


$existing = & $kind get clusters
$imagesPulled = $false

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

    # Copy third-party images in from this machine so each cluster does not download them.
    if (-not $imagesPulled) {
        foreach ($image in $PreloadImages) {
            docker pull -q $image | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "could not pull $image" }
        }
        $imagesPulled = $true
    }
    $ErrorActionPreference = 'Continue'   # kind reports progress on stderr
    foreach ($image in $PreloadImages) {
        & $kind load docker-image $image --name $cluster 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "could not load $image into $cluster" }
    }

    Initialize-ClusterSecrets $e

    Write-Host "[$e] ready at $(Get-EnvironmentUrl $e)"
}
