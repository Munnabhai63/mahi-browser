@echo off
title MAHI BROWSER
cd /d "%~dp0.."
echo ===================================================
echo           STARTING MAHI BROWSER
echo ===================================================
echo.
echo Cleaning any old background processes...
taskkill /F /IM electron.exe >nul 2>&1
echo.
echo Building application...
call npm run build
echo.
echo Launching MAHI BROWSER...
call npx electron .
