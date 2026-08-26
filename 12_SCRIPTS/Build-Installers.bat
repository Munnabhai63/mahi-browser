@echo off
title MAHI BROWSER - Installer & Package Builder
cd /d "%~dp0.."
echo ===================================================
echo      MAHI BROWSER - BUILDING SETUP AND PORTABLE EXE
echo ===================================================
echo.
echo Step 1: Building Frontend and Main Process Bundles...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Check errors above.
    pause
    exit /b %errorlevel%
)

echo.
echo Step 2: Packaging Windows Installers (NSIS Setup & Portable)...
call npm run dist
if %errorlevel% neq 0 (
    echo [ERROR] Packaging failed!
    pause
    exit /b %errorlevel%
)

echo.
echo Step 3: Copying fresh installer packages to Desktop for easy sharing...
if exist "release\MAHI BROWSER-1.0.0-Setup.exe" (
    copy /y "release\MAHI BROWSER-1.0.0-Setup.exe" "%USERPROFILE%\Desktop\MAHI BROWSER-1.0.0-Setup.exe" >nul
    echo  [OK] Copied MAHI BROWSER-1.0.0-Setup.exe to Desktop
)
if exist "release\MAHI BROWSER-1.0.0-Portable.exe" (
    copy /y "release\MAHI BROWSER-1.0.0-Portable.exe" "%USERPROFILE%\Desktop\MAHI BROWSER-1.0.0-Portable.exe" >nul
    echo  [OK] Copied MAHI BROWSER-1.0.0-Portable.exe to Desktop
)

echo.
echo Step 4: Updating Desktop Shortcuts...
call "%~dp0Fix-Desktop-Shortcuts.bat"

echo.
echo ===================================================
echo  BUILD COMPLETE! Fresh Installers & Shortcuts Ready!
echo ===================================================
pause