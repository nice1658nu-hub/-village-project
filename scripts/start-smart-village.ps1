$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedProjectRoot = (Resolve-Path -LiteralPath $projectRoot).Path
if ($resolvedProjectRoot -notmatch '^([A-Za-z]):\\(.*)$') {
    throw 'Cannot convert the Windows project path to a WSL path.'
}
$driveLetter = $Matches[1].ToLowerInvariant()
$linuxPathPart = $Matches[2].Replace('\', '/')
$linuxProjectRoot = "/mnt/$driveLetter/$linuxPathPart"

Write-Host 'Starting MySQL...' -ForegroundColor Cyan
wsl.exe -u root service mysql start | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'MySQL could not be started in WSL.' }

Write-Host 'Starting Apache and phpMyAdmin access...' -ForegroundColor Cyan
wsl.exe -u root service apache2 start | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Apache could not be started in WSL.' }
$nodePath = 'C:\Program Files\nodejs\node.exe'
$phpMyAdminProxy = Join-Path $projectRoot 'scripts\phpmyadmin-proxy.cjs'
$existingPhpMyAdminProxy = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if (-not $existingPhpMyAdminProxy) {
    Start-Process -FilePath $nodePath -ArgumentList @($phpMyAdminProxy) -WindowStyle Hidden
}

Write-Host 'Starting Laravel Backend...' -ForegroundColor Cyan
$backendOutput = Join-Path $projectRoot 'backend-server.stdout.log'
$backendError = Join-Path $projectRoot 'backend-server.stderr.log'
$existingBackend = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if (-not $existingBackend) {
    Start-Process -FilePath 'wsl.exe' -ArgumentList @('bash', "$linuxProjectRoot/scripts/start-backend.sh") -WindowStyle Hidden -RedirectStandardOutput $backendOutput -RedirectStandardError $backendError
} else {
    Write-Host 'Laravel Backend is already running.' -ForegroundColor DarkGray
}

Write-Host 'Starting React Frontend...' -ForegroundColor Cyan
$npmPath = 'C:\Program Files\nodejs\npm.cmd'
if (-not (Test-Path -LiteralPath $npmPath)) {
    throw 'Node.js was not found at C:\Program Files\nodejs. Reinstall Node.js or Laravel Herd.'
}
$frontendOutput = Join-Path $projectRoot 'frontend-server.stdout.log'
$frontendError = Join-Path $projectRoot 'frontend-server.stderr.log'
$existingFrontend = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if (-not $existingFrontend) {
    Start-Process -FilePath $npmPath -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $frontendOutput -RedirectStandardError $frontendError
} else {
    Write-Host 'React Frontend is already running.' -ForegroundColor DarkGray
}

$frontendReady = $null
$backendReady = $null
for ($attempt = 1; $attempt -le 15; $attempt++) {
    Start-Sleep -Seconds 1
    $frontendReady = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
    $backendReady = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    if ($frontendReady -and $backendReady) { break }
}

if (-not $frontendReady -or -not $backendReady) {
    Write-Host 'SmartVillage could not start.' -ForegroundColor Red
    Write-Host "Frontend log: $frontendError"
    Write-Host "Backend log:  $backendError"
    if (Test-Path $frontendError) { Get-Content $frontendError -Tail 20 | Out-Host }
    if (Test-Path $backendError) { Get-Content $backendError -Tail 20 | Out-Host }
    throw 'One or more servers did not open within 15 seconds.'
}

Start-Process 'http://127.0.0.1:5173/'
Write-Host ''
Write-Host 'SmartVillage started successfully.' -ForegroundColor Green
Write-Host 'Frontend: http://127.0.0.1:5173/'
Write-Host 'Backend:  http://127.0.0.1:8000/'
Write-Host 'phpMyAdmin: http://127.0.0.1:8081/phpmyadmin/'
