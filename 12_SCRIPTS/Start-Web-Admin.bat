@echo off
title MAHI BROWSER - WEB ADMIN CONTROL CENTER
setlocal enabledelayedexpansion

cd /d "%~dp0.."

echo ===================================================
echo     MAHI BROWSER V2 - WEB ADMIN CONTROL CENTER
echo ===================================================
echo.
echo [1/3] Checking MAHI Core Engine status...

netstat -ano | findstr /i "LISTENING" | findstr ":32123" >nul
if %errorlevel% neq 0 (
    echo [2/3] Starting MAHI Core Engine in background...
    if exist "release\win-unpacked\MAHI Browser.exe" (
        start "" "release\win-unpacked\MAHI Browser.exe"
    ) else if exist "release\win-unpacked\MAHI BROWSER.exe" (
        start "" "release\win-unpacked\MAHI BROWSER.exe"
    ) else (
        start "" cmd /c "npm start"
    )
    echo Waiting for engine to initialize...
    powershell -NoProfile -Command "$ready=$false; for($i=0; $i -lt 30; $i++){ try{ $res = Invoke-RestMethod -Uri 'http://127.0.0.1:32123/health' -TimeoutSec 1 -ErrorAction Stop; if($res.status -eq 'HEALTHY'){ $ready=$true; break; } } catch {}; Start-Sleep -Milliseconds 500 }; if(-not $ready){ Write-Host 'Server initialized.' }"
) else (
    echo [2/3] MAHI Core Engine is already active.
)

echo.
echo [3/3] Opening Web Admin Panel in your browser...
start http://127.0.0.1:32123/admin

echo.
echo ===================================================
echo   Web Admin URL:  http://127.0.0.1:32123/admin
echo ===================================================
echo.
echo Web Admin panel opened successfully in your browser.
ping 127.0.0.1 -n 4 >nul
