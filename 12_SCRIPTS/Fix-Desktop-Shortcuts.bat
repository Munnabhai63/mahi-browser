@echo off
title MAHI BROWSER - Shortcut and Icon Fixer
cd /d "%~dp0"
echo ===================================================
echo     MAHI BROWSER - FIXING DESKTOP ICONS AND SHORTCUTS
echo ===================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-desktop-shortcut.ps1"
echo.
echo ===================================================
echo   Done! All Desktop shortcuts are ready with icons.
echo ===================================================
ping 127.0.0.1 -n 3 >nul