<#
.SYNOPSIS
    Deletes image versions that no running container uses, inside each cluster.
.DESCRIPTION
    Every deployment leaves the previous image versions behind in the cluster. This removes
    them. Running environments are not affected. Do not run it while a deployment is in
    progress: an image that has been downloaded but not yet started counts as unused.
    Rolling back to an older tag still works afterwards; the cluster downloads it again.
.EXAMPLE
    .\infra\prune-images.ps1
    .\infra\prune-images.ps1 -Environment dev
#>
param(
    [string[]]$Environment = @('dev', 'qa', 'preprod', 'prod')
)

. "$PSScriptRoot\common.ps1"

function Get-ImageStoreSizeMB([string]$Node) {
    [int]((docker exec $Node du -sm /var/lib/containerd) -split '\s+')[0]
}

foreach ($e in $Environment) {
    Assert-Environment $e
    $node = "shopflow-$e-control-plane"

    $before = Get-ImageStoreSizeMB $node
    $removed = @(docker exec $node crictl rmi --prune 2>$null | Where-Object { $_ -match '^Deleted:' }).Count
    if ($LASTEXITCODE -ne 0) { throw "[$e] could not prune images" }
    $after = Get-ImageStoreSizeMB $node

    Write-Host "[$e] removed $removed unused images, freed $($before - $after) MB ($after MB still in use)"
}
