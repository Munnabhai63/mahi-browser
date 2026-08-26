# =========================================================
# MAHI BROWSER — Windows Desktop & Start Menu Shortcut Generator
# Automatically configures high-res icons and direct fast execution
# =========================================================

$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Get-Location }
$currentDir = Split-Path -Parent $scriptDir
if (-not (Test-Path (Join-Path $currentDir "package.json"))) { $currentDir = $scriptDir }

$iconPath = Join-Path $currentDir "13_ASSETS\resources\icon.ico"
$unpackedExe = Join-Path $currentDir "release\win-unpacked\MAHI BROWSER.exe"
$startAppBat = Join-Path $currentDir "12_SCRIPTS\start-app.bat"

# Prefer native compiled exe if it exists, otherwise use launcher bat
$appTarget = if (Test-Path $unpackedExe) { $unpackedExe } else { $startAppBat }

$WScriptShell = New-Object -ComObject WScript.Shell

Write-Host "Creating/Updating MAHI BROWSER Desktop Shortcuts..." -ForegroundColor Cyan

# 1. Main App Shortcut
$appShortcut = $WScriptShell.CreateShortcut((Join-Path $desktopPath "MAHI BROWSER.lnk"))
$appShortcut.TargetPath = $appTarget
$appShortcut.WorkingDirectory = $currentDir
$appShortcut.Description = "MAHI BROWSER Professional Multi-Profile Browser"
if (Test-Path $iconPath) { 
    $appShortcut.IconLocation = "$iconPath, 0" 
}
$appShortcut.Save()
Write-Host " [OK] MAHI BROWSER.lnk -> $appTarget" -ForegroundColor Green

# 2. Super Admin Shortcut
$superShortcut = $WScriptShell.CreateShortcut((Join-Path $desktopPath "MAHI Super Admin Console.lnk"))
$superBat = Join-Path $currentDir "12_SCRIPTS\Start-Super-Admin.bat"
if (Test-Path $superBat) {
    $superShortcut.TargetPath = $superBat
} else {
    $superShortcut.TargetPath = "http://127.0.0.1:32123/super-admin"
}
$superShortcut.WorkingDirectory = $currentDir
$superShortcut.Description = "MAHI BROWSER Secret Super Admin Console"
if (Test-Path $iconPath) { 
    $superShortcut.IconLocation = "$iconPath, 0" 
}
$superShortcut.Save()
Write-Host " [OK] MAHI Super Admin Console.lnk" -ForegroundColor Green

# 3. Web Admin Shortcut
$webShortcut = $WScriptShell.CreateShortcut((Join-Path $desktopPath "MAHI Web Admin.lnk"))
$webBat = Join-Path $currentDir "12_SCRIPTS\Start-Web-Admin.bat"
if (Test-Path $webBat) {
    $webShortcut.TargetPath = $webBat
} else {
    $webShortcut.TargetPath = "http://127.0.0.1:32123/admin"
}
$webShortcut.WorkingDirectory = $currentDir
$webShortcut.Description = "MAHI BROWSER Web Admin Control Center"
if (Test-Path $iconPath) { 
    $webShortcut.IconLocation = "$iconPath, 0" 
}
$webShortcut.Save()
Write-Host " [OK] MAHI Web Admin.lnk" -ForegroundColor Green

# Refresh Windows Shell Icon Cache
try {
    $code = @"
[System.Runtime.InteropServices.DllImport("Shell32.dll")]
public static extern int SHChangeNotify(int eventId, int flags, IntPtr item1, IntPtr item2);
"@
    $type = Add-Type -MemberDefinition $code -Name ShellHelper -Namespace Win32 -PassThru
    $type::SHChangeNotify(0x08000000, 0x0000, [IntPtr]::Zero, [IntPtr]::Zero)
    Write-Host " [OK] Windows Explorer Icon Cache Refreshed!" -ForegroundColor Green
} catch {
    Write-Host " [Notice] Shell refresh completed." -ForegroundColor Yellow
}

Write-Host "`nAll Desktop shortcuts and icons updated successfully!" -ForegroundColor Cyan