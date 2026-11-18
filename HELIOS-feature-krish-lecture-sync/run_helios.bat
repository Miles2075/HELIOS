@echo off
title HELIOS Intelligence Suite Launcher
echo ===================================================
echo   Starting HELIOS AI Intelligence Suite
echo ===================================================
echo.

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found in .venv!
    pause
    exit /b 1
)

echo [1/3] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "HELIOS Backend (Port 8000)" /min cmd /c ".\.venv\Scripts\uvicorn.exe backend.main:app --host 127.0.0.1 --port 8000"

echo [2/3] Starting Vite Frontend on http://127.0.0.1:5173 ...
start "HELIOS Frontend (Port 5173)" /min cmd /c "cd frontend && npm run dev -- --host 127.0.0.1 --port 5173"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak > nul

echo.
echo ===================================================
echo   HELIOS is LIVE and READY!
echo   Main URL:     http://127.0.0.1:8000
echo   Frontend Dev: http://127.0.0.1:5173
echo ===================================================
echo.
echo Opening browser to http://127.0.0.1:8000 ...
start http://127.0.0.1:8000
