$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$archive = Join-Path $env:TEMP "smart-village-backend-update.tar.gz"
$remote = "smartvillagematong@ssh-smartvillagematong.alwaysdata.net"

Set-Location -LiteralPath $projectRoot

Write-Host ""
Write-Host "[1/3] Preparing backend files..." -ForegroundColor Cyan
& tar -czf $archive -C $projectRoot `
    "backend/app/Http/Controllers/Shared/MediaController.php" `
    "backend/app/Http/Controllers/Tao/TaoWorkflowController.php" `
    "backend/app/Providers/AppServiceProvider.php" `
    "backend/routes/api.php"
if ($LASTEXITCODE -ne 0) { throw "Could not prepare the backend update." }

Write-Host ""
Write-Host "[2/3] Uploading to Alwaysdata..." -ForegroundColor Cyan
Write-Host "Enter your Alwaysdata password when prompted." -ForegroundColor Yellow
& scp $archive "${remote}:~/backend-update.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "Backend upload failed." }

Write-Host ""
Write-Host "[3/3] Installing the update and refreshing Laravel..." -ForegroundColor Cyan
Write-Host "Enter the same Alwaysdata password again." -ForegroundColor Yellow
& ssh $remote "cd ~/www && tar -xzf ~/backend-update.tar.gz && cd backend && php artisan optimize:clear && php artisan config:cache && php artisan route:cache"
if ($LASTEXITCODE -ne 0) { throw "Backend update failed." }

Write-Host ""
Write-Host "BACKEND DEPLOY COMPLETE" -ForegroundColor Green
Write-Host "The image route is now active. Refresh the website and test the image again." -ForegroundColor Green
