$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$projectRootForGit = $projectRoot.Replace("\", "/")
$bundledGit = "C:\Users\ASUS\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
$bundledNode = "C:\Users\ASUS\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

$git = if (Test-Path -LiteralPath $bundledGit) { $bundledGit } else { (Get-Command git -ErrorAction Stop).Source }
$node = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { (Get-Command node -ErrorAction Stop).Source }
$vite = Join-Path $projectRoot "node_modules\vite\bin\vite.js"

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    & $git -c "safe.directory=$projectRootForGit" @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed (exit code $LASTEXITCODE)."
    }
}

Set-Location -LiteralPath $projectRoot

Write-Host ""
Write-Host "[1/4] Checking the website build..." -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $vite)) {
    throw "Vite was not found. Run npm install once before deploying."
}
& $node $vite build
if ($LASTEXITCODE -ne 0) {
    throw "Website build failed. Fix the errors shown above, then try again."
}

Write-Host ""
Write-Host "[2/4] Files to deploy:" -ForegroundColor Cyan
Invoke-Git -Arguments @("status", "--short")

Write-Host ""
Write-Host "[3/4] Saving changes to Git..." -ForegroundColor Cyan
Invoke-Git -Arguments @("add", "-A")

& $git -c "safe.directory=$projectRootForGit" diff --cached --quiet
$hasChanges = $LASTEXITCODE -eq 1
if ($LASTEXITCODE -notin 0, 1) {
    throw "Git could not check the changed files."
}

if ($hasChanges) {
    $message = "Update web " + (Get-Date -Format "yyyy-MM-dd HH:mm")
    Invoke-Git -Arguments @(
        "-c", "user.name=nice1658nu-hub",
        "-c", "user.email=nice1658nu-hub@users.noreply.github.com",
        "commit", "-m", $message
    )
} else {
    Write-Host "No new file changes. The latest saved commit will be pushed." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[4/4] Sending to GitHub and Vercel..." -ForegroundColor Cyan
Invoke-Git -Arguments @("push", "origin", "main")

Write-Host ""
Write-Host "DEPLOY COMPLETE" -ForegroundColor Green
Write-Host "Vercel is updating the website automatically. Please wait about 1-2 minutes, then refresh the website." -ForegroundColor Green
Write-Host "https://smartvillagematong.vercel.app" -ForegroundColor Blue
