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
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "APP_VER=%%v"
if exist "release\MAHI-Browser-Setup-%APP_VER%.exe" (
    copy /y "release\MAHI-Browser-Setup-%APP_VER%.exe" "%USERPROFILE%\Desktop\MAHI-Browser-Setup-%APP_VER%.exe" >nul
    echo  [OK] Copied MAHI-Browser-Setup-%APP_VER%.exe to Desktop
)
if exist "release\MAHI-Browser-Portable-%APP_VER%.exe" (
    copy /y "release\MAHI-Browser-Portable-%APP_VER%.exe" "%USERPROFILE%\Desktop\MAHI-Browser-Portable-%APP_VER%.exe" >nul
    echo  [OK] Copied MAHI-Browser-Portable-%APP_VER%.exe to Desktop
)

echo.
echo Step 4: Updating Desktop Shortcuts...
call "%~dp0Fix-Desktop-Shortcuts.bat"

echo.
echo ===================================================
echo  BUILD COMPLETE! Fresh Installers & Shortcuts Ready!
echo ===================================================
pause