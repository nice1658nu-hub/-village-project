$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$phpPath = Join-Path $projectRoot '.tools\php\php.exe'

if (-not (Test-Path -LiteralPath $phpPath)) {
    throw 'Bundled PHP runtime was not found.'
}

Write-Host '1/2 Running Laravel tests with the isolated SQLite test database...' -ForegroundColor Cyan
Push-Location (Join-Path $projectRoot 'backend')
try {
    & $phpPath artisan test
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
}
finally { Pop-Location }

Write-Host '2/2 Building the frontend...' -ForegroundColor Cyan
Push-Location $projectRoot
try {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npm) {
        & $npm.Source run build
    }
    else {
        $node = Get-Command node.exe -ErrorAction SilentlyContinue
        $vite = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
        if (-not $node -or -not (Test-Path -LiteralPath $vite)) {
            throw 'Node.js or the local Vite package was not found.'
        }
        & $node.Source $vite build
    }
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
}
finally { Pop-Location }

Write-Host 'SmartVillage readiness check passed.' -ForegroundColor Green
