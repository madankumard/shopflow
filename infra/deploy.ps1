<#
.SYNOPSIS
    Deploys one image tag to one environment and waits until it is running.
.DESCRIPTION
    Applies the environment's kustomize overlay with our images pinned to the given tag.
    Used by the deploy pipeline and usable by hand.
.EXAMPLE
    .\infra\deploy.ps1 -Environment dev -Tag 3f2a9c1
#>
param(
    [Parameter(Mandatory)][string]$Environment,
    [Parameter(Mandatory)][string]$Tag
)

. "$PSScriptRoot\common.ps1"
Assert-Environment $Environment
$context = Get-KubeContext $Environment

# A throwaway kustomization that wraps the overlay and pins the image tag.
$deployDir = Join-Path $PSScriptRoot "k8s\.deploy\$Environment"
New-Item -ItemType Directory -Force $deployDir | Out-Null
$kustomization = @"
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../overlays/$Environment
images:
$(($AppImages | ForEach-Object { "  - name: $ImageRepository/$_`n    newTag: `"$Tag`"" }) -join "`n")
"@
[IO.File]::WriteAllText((Join-Path $deployDir 'kustomization.yaml'), $kustomization)

# The manifests refer to these secrets; make sure they exist (they are never overwritten).
Initialize-ClusterSecrets $Environment

Write-Host "[$Environment] deploying tag $Tag"
kubectl --context $context apply -k $deployDir
if ($LASTEXITCODE -ne 0) { throw "[$Environment] kubectl apply failed" }

# In dependency order: the backend needs the database, Vault and the Config Server.
foreach ($workload in 'statefulset/db', 'deployment/vault', 'deployment/config-server', 'deployment/backend', 'deployment/frontend') {
    # Generous: on a first deploy the cluster may still be downloading images.
    kubectl --context $context -n $Namespace rollout status $workload --timeout=600s
    if ($LASTEXITCODE -ne 0) {
        kubectl --context $context -n $Namespace get pods
        throw "[$Environment] $workload did not become ready"
    }
}

Write-Host "[$Environment] tag $Tag is running at $(Get-EnvironmentUrl $Environment)"
