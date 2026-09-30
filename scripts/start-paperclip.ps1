<#
.SYNOPSIS
  One-click startup for the local Paperclip dev stack.

.DESCRIPTION
  Double-clicking this script (or the desktop shortcut that points at it) does
  the whole first-run dance:

    1. If the stack is already up, just opens the browser and exits.
    2. Installs workspace dependencies when they are missing or the lockfile
       is newer than the last install.
    3. Starts `pnpm dev`, which runs `db:migrate` itself before serving.
    4. Waits for /api/health, then opens http://localhost:3100.

  The window stays open so dev logs are visible. Closing the window stops the
  server.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-paperclip.ps1
#>
[CmdletBinding()]
param(
  # Skip the browser launch (useful when scripting this).
  [switch]$NoBrowser,

  # Seconds to wait for the stack to report healthy before giving up.
  [int]$TimeoutSeconds = 300
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Url = 'http://localhost:3100'
$HealthUrl = "$Url/api/health"

Set-Location $RepoRoot

function Write-Step($message) {
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Write-Fail($message) {
  Write-Host "==> $message" -ForegroundColor Red
}

function Test-StackHealthy {
  try {
    $response = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 3 -UseBasicParsing
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

# Already running? Then this is just "show me the app".
if (Test-StackHealthy) {
  Write-Step "Paperclip is already running at $Url"
  if (-not $NoBrowser) { Start-Process $Url }
  exit 0
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Fail "pnpm not found on PATH. Install Node.js and run: npm i -g pnpm@9.15.4"
  Read-Host "Press Enter to close"
  exit 1
}

# Install when node_modules is absent, or when the lockfile moved on since the
# last install. pnpm writes .modules.yaml as its install marker.
$lockfile = Join-Path $RepoRoot 'pnpm-lock.yaml'
$installMarker = Join-Path $RepoRoot 'node_modules\.modules.yaml'
$needsInstall = $true
if ((Test-Path -LiteralPath $installMarker) -and (Test-Path -LiteralPath $lockfile)) {
  $needsInstall = (Get-Item -LiteralPath $lockfile).LastWriteTimeUtc -gt `
    (Get-Item -LiteralPath $installMarker).LastWriteTimeUtc
}

if ($needsInstall) {
  Write-Step "Installing workspace dependencies (first run or lockfile changed)"
  & pnpm install
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "pnpm install failed with exit code $LASTEXITCODE"
    Read-Host "Press Enter to close"
    exit $LASTEXITCODE
  }
} else {
  Write-Step "Dependencies are up to date, skipping install"
}

Write-Step "Starting the dev stack (this runs db:migrate first)"
Write-Host "    API + UI: $Url"
Write-Host "    Keep this window open. Close it to stop the server."
Write-Host ""

# Watch mode stays in the foreground and prints server output here.
$child = Start-Process -FilePath 'pnpm.cmd' `
  -ArgumentList 'dev' `
  -WorkingDirectory $RepoRoot `
  -NoNewWindow -PassThru

# Poll for readiness so the browser opens on a working app rather than a blank
# port. A slow first build is normal, hence the generous default timeout.
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$ready = $false
while ((Get-Date) -lt $deadline) {
  if ($child.HasExited) {
    $code = $child.ExitCode
    if ($null -eq $code) { $code = 1 }
    Write-Fail "The dev server exited early with code $code. See the output above."
    Read-Host "Press Enter to close"
    exit $code
  }
  if (Test-StackHealthy) { $ready = $true; break }
  Start-Sleep -Seconds 2
}

if ($ready) {
  Write-Step "Paperclip is up at $Url"
  if (-not $NoBrowser) { Start-Process $Url }
} else {
  Write-Fail "Stack did not become healthy within $TimeoutSeconds seconds."
  Write-Fail "Check the output above. If this was a first run, the initial build may need longer."
  Write-Fail "Or raise the budget: -TimeoutSeconds 600"
}

Write-Host ""
Write-Host "Press Ctrl+C or close this window to stop the server."
$child.WaitForExit()
exit $child.ExitCode
