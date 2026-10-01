$ErrorActionPreference = "Stop"

$node = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path -LiteralPath $node)) {
    $node = "C:\Users\ASUS\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}
$proxy = Join-Path $PSScriptRoot "phpmyadmin-proxy.cjs"
$listening = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue

if (-not $listening) {
    wsl.exe -u root service apache2 start | Out-Host
    Start-Process -FilePath $node -ArgumentList @($proxy) -WindowStyle Hidden
}

$ready = $false
for ($attempt = 1; $attempt -le 20; $attempt++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8081/phpmyadmin/" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
}
if (-not $ready) { throw "phpMyAdmin proxy did not start within 20 seconds." }

Start-Process "http://127.0.0.1:8081/phpmyadmin/"
