@echo off
title OptiVerse - Stop Platform
color 0C
echo Stopping OptiVerse services...

taskkill /FI "WINDOWTITLE eq OptiVerse - Backend Server*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq OptiVerse - Frontend Client*" /F /T >nul 2>&1

echo.
echo OptiVerse services stopped.
timeout /t 2 >nul
