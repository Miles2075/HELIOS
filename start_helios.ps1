$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path (Join-Path $ScriptDir "HELIOS-feature-krish-lecture-sync")) {
    $Root = Join-Path $ScriptDir "HELIOS-feature-krish-lecture-sync"
} else {
    $Root = $ScriptDir
}

$BackendExe = Join-Path $Root ".venv\Scripts\uvicorn.exe"
$FrontendDir = Join-Path $Root "frontend"

Write-Host "===================================================" -ForegroundColor Magenta
Write-Host " Starting HELIOS AI Intelligence Suite" -ForegroundColor Magenta
Write-Host "===================================================" -ForegroundColor Magenta

Write-Host "[1/3] Starting HELIOS Backend on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Start-Process -FilePath $BackendExe `
  -ArgumentList "backend.main:app", "--host", "127.0.0.1", "--port", "8000" `
  -WorkingDirectory $Root `
  -WindowStyle Minimized

Write-Host "[2/3] Starting HELIOS Frontend on http://127.0.0.1:5173 ..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c", "npm run dev -- --host 127.0.0.1 --port 5173" `
  -WorkingDirectory $FrontendDir `
  -WindowStyle Minimized

Write-Host "[3/3] Waiting 3 seconds for services to boot..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "HELIOS is live! Opening http://127.0.0.1:8000 in your browser..." -ForegroundColor Green
Start-Process "http://127.0.0.1:8000"
