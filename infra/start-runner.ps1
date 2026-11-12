<#
.SYNOPSIS
    Starts the self-hosted GitHub Actions runner that deploys to the local clusters.
.DESCRIPTION
    The runner is installed outside the repo and runs as the signed-in user, so it can use
    that user's kubectl contexts. It does not start with Windows: run this after a restart,
    once Docker Desktop is up. Safe to re-run; it does nothing if the runner is already running.
.EXAMPLE
    .\infra\start-runner.ps1
#>
param(
    [string]$RunnerDirectory = (Join-Path $env:USERPROFILE 'actions-runner')
)

if (-not (Test-Path (Join-Path $RunnerDirectory 'run.cmd'))) {
    throw "No runner found in $RunnerDirectory"
}

if (Get-Process -Name 'Runner.Listener' -ErrorAction SilentlyContinue) {
    Write-Host 'The runner is already running.'
    return
}

$log = Join-Path $RunnerDirectory 'runner.log'
$run = Join-Path $RunnerDirectory 'run.cmd'
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "`"`"$run`" > `"$log`" 2>&1`"" `
    -WorkingDirectory $RunnerDirectory -WindowStyle Hidden

Start-Sleep -Seconds 8
if (Get-Process -Name 'Runner.Listener' -ErrorAction SilentlyContinue) {
    Write-Host "The runner is running. Log: $log"
}
else {
    Get-Content $log -Tail 20
    throw 'The runner did not start.'
}
