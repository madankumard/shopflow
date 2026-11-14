<#
.SYNOPSIS
    Deletes the kind clusters for the named environments, to free disk space and memory.
.DESCRIPTION
    Deleting a cluster destroys everything in it for good: its database, its generated
    passwords and its downloaded images. The environments must be named; there is no default.
    A deleted environment can be created again, empty, with create-clusters.ps1.
.EXAMPLE
    .\infra\delete-clusters.ps1 -Environment qa, preprod, prod
#>
param(
    [Parameter(Mandatory)][string[]]$Environment
)

. "$PSScriptRoot\common.ps1"
$kind = Get-KindPath
$existing = & $kind get clusters

foreach ($e in $Environment) {
    Assert-Environment $e
    $cluster = "shopflow-$e"
    if ($existing -notcontains $cluster) {
        Write-Host "[$e] no cluster to delete"
        continue
    }
    $ErrorActionPreference = 'Continue'   # kind reports progress on stderr
    & $kind delete cluster --name $cluster 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "[$e] could not delete $cluster" }
    Write-Host "[$e] deleted $cluster"
}
