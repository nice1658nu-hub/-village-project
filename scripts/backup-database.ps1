$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$linuxRoot = (wsl.exe wslpath -a ($projectRoot -replace '\\', '/')).Trim()
if (-not $linuxRoot) {
    throw "Project path was not found in WSL."
}

Write-Host "Backing up the database and uploaded files..." -ForegroundColor Cyan
wsl.exe -u root bash "$linuxRoot/scripts/backup-database.sh"
if ($LASTEXITCODE -ne 0) {
    throw "Backup failed. Check that MySQL is running in WSL."
}

Write-Host "Backup completed." -ForegroundColor Green
Write-Host "Files: $projectRoot\backend\storage\backups"
