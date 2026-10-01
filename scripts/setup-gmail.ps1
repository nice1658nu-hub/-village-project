$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envPath = Join-Path $projectRoot 'backend\.env'
if (-not (Test-Path -LiteralPath $envPath)) { throw 'backend/.env was not found.' }

Write-Host 'SmartVillage Gmail setup' -ForegroundColor Cyan
Write-Host 'Use a Google App Password, not your normal Gmail password.'
Write-Host 'Google 2-Step Verification must be enabled.'
$gmail = (Read-Host 'Gmail address').Trim()
if ($gmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Invalid email address.' }

$securePassword = Read-Host '16-character Google App Password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try { $appPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer).Replace(' ', '') }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }
if ($appPassword.Length -lt 16) { throw 'Google App Passwords contain 16 characters.' }

function Set-EnvValue([string]$Key, [string]$Value) {
    $content = Get-Content -LiteralPath $envPath
    $line = "$Key=$Value"
    if ($content -match "^$([regex]::Escape($Key))=") {
        $content = $content -replace "^$([regex]::Escape($Key))=.*$", $line
    } else { $content += $line }
    # .env contains ASCII configuration values; ASCII also avoids a UTF-8 BOM
    # being added by Windows PowerShell 5.1 in front of APP_NAME.
    Set-Content -LiteralPath $envPath -Value $content -Encoding ascii
}

Set-EnvValue 'MAIL_MAILER' 'smtp'
Set-EnvValue 'MAIL_SCHEME' 'smtp'
Set-EnvValue 'MAIL_HOST' 'smtp.gmail.com'
Set-EnvValue 'MAIL_PORT' '587'
Set-EnvValue 'MAIL_USERNAME' $gmail
Set-EnvValue 'MAIL_PASSWORD' $appPassword
Set-EnvValue 'MAIL_FROM_ADDRESS' $gmail
Set-EnvValue 'MAIL_FROM_NAME' '"SmartVillage"'

$resolvedProjectRoot = (Resolve-Path -LiteralPath $projectRoot).Path
if ($resolvedProjectRoot -notmatch '^([A-Za-z]):\\(.*)$') {
    throw 'Cannot convert the Windows project path to a WSL path.'
}
$driveLetter = $Matches[1].ToLowerInvariant()
$linuxPathPart = $Matches[2].Replace('\', '/')
$linuxProjectRoot = "/mnt/$driveLetter/$linuxPathPart"
wsl.exe bash -lc "cd '$linuxProjectRoot/backend' && php artisan config:clear && php artisan mail:test '$gmail'"
if ($LASTEXITCODE -ne 0) { throw 'Email test failed. Verify the Gmail App Password.' }
$appPassword = $null
Write-Host 'Gmail setup completed. Check Inbox and Spam.' -ForegroundColor Green
Write-Host 'Never share or commit backend/.env.' -ForegroundColor Yellow
