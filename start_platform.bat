@echo off
title OptiVerse - Universal Operations Research Platform Launcher
color 0B
chcp 65001 >nul

echo =====================================================================
echo           OptiVerse: Universal Operations Research Platform
echo =====================================================================
echo.
echo [1/3] Starting Backend Server (FastAPI on http://127.0.0.1:8000)...
start "OptiVerse - Backend Server" cmd /k "cd /d "%~dp0" && python run_backend.py"

echo [2/3] Waiting for Backend initialization...
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend Client (Vite on http://localhost:5173)...
start "OptiVerse - Frontend Client" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Waiting for services to come online...
timeout /t 3 /nobreak >nul

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo =====================================================================
echo   Platform is running!
echo   - Web UI:       http://localhost:5173
echo   - Backend Docs: http://127.0.0.1:8000/docs
echo.
echo   To stop the platform, close the Backend and Frontend windows,
echo   or run stop_platform.bat.
echo =====================================================================
echo.
pause
