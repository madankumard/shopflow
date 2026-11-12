<#
.SYNOPSIS
    Makes one environment pick up changed settings from the shopflow-config repo.
.DESCRIPTION
    The Config Server serves a pushed change immediately, but the backend reads its settings
    only at start-up. This restarts the backend pods one at a time; no image is rebuilt.
.EXAMPLE
    .\infra\reload-config.ps1 -Environment qa
#>
param(
    [Parameter(Mandatory)][string]$Environment
)

. "$PSScriptRoot\common.ps1"
Assert-Environment $Environment
$context = Get-KubeContext $Environment

kubectl --context $context -n $Namespace rollout restart deployment/backend
if ($LASTEXITCODE -ne 0) { throw "[$Environment] could not restart the backend" }

kubectl --context $context -n $Namespace rollout status deployment/backend --timeout=300s
if ($LASTEXITCODE -ne 0) { throw "[$Environment] the backend did not come back" }

Write-Host "[$Environment] backend restarted with the current settings: $(Get-EnvironmentUrl $Environment)"
