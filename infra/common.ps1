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
