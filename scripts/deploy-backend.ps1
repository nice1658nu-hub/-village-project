$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$archive = Join-Path $env:TEMP "smart-village-backend-update.tar.gz"
$remote = "smartvillagematong@ssh-smartvillagematong.alwaysdata.net"
$firebaseCredentials = Join-Path $projectRoot "backend\storage\app\firebase\service-account.json"

Set-Location -LiteralPath $projectRoot

Write-Host ""
Write-Host "[1/3] Preparing backend files..." -ForegroundColor Cyan
& tar -czf $archive -C $projectRoot `
    "backend/app/Http/Controllers/Cases/IncidentController.php" `
    "backend/app/Http/Controllers/Shared/MediaController.php" `
    "backend/app/Http/Controllers/Tao/TaoWorkflowController.php" `
    "backend/app/Services/FirebasePushService.php" `
    "backend/app/Providers/AppServiceProvider.php" `
    "backend/config/services.php" `
    "backend/routes/api.php"
if ($LASTEXITCODE -ne 0) { throw "Could not prepare the backend update." }

if (-not (Test-Path -LiteralPath $firebaseCredentials -PathType Leaf)) {
    throw "Firebase service account file was not found: $firebaseCredentials"
}

Write-Host ""
Write-Host "[2/3] Uploading to Alwaysdata..." -ForegroundColor Cyan
Write-Host "Enter your Alwaysdata password when prompted." -ForegroundColor Yellow
Write-Host "Uploading the private Firebase key (it is not added to Git)..." -ForegroundColor Cyan
& scp $archive $firebaseCredentials "${remote}:~/"
if ($LASTEXITCODE -ne 0) { throw "Backend or Firebase key upload failed." }

Write-Host ""
Write-Host "[3/3] Installing the update and refreshing Laravel..." -ForegroundColor Cyan
Write-Host "Enter the same Alwaysdata password again." -ForegroundColor Yellow
& ssh $remote "cd ~/www && tar -xzf ~/smart-village-backend-update.tar.gz && mkdir -p backend/storage/app/firebase && mv ~/service-account.json backend/storage/app/firebase/service-account.json && chmod 600 backend/storage/app/firebase/service-account.json && cd backend && php artisan optimize:clear && php artisan config:cache && php artisan route:cache"
if ($LASTEXITCODE -ne 0) { throw "Backend update failed." }

Write-Host ""
Write-Host "BACKEND DEPLOY COMPLETE" -ForegroundColor Green
Write-Host "Firebase Push is now configured. Create a NEW notification and test it after closing Chrome." -ForegroundColor Green
