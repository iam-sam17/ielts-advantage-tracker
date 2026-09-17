@echo off
title IELTS Advantage Vault - Local Server
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   IELTS Advantage Vault - Local Server
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   Opening: http://localhost:8080
echo.
echo   Press CTRL+C to stop the server.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd /d "%~dp0"

:: Open browser after a small delay
start "" timeout /t 2 /nobreak >nul && start "" "http://localhost:8080"

:: Start Python HTTP server
python -m http.server 8080
if %errorlevel% neq 0 (
    python3 -m http.server 8080
)

pause
