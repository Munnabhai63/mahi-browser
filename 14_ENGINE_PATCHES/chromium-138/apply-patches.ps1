<#
==============================================================================
MAHI BROWSER — Apply Chromium 138 Native Anti-Detect C++ Patches (Windows)
Target: Chromium 138.0.7204.0
==============================================================================
#>
[CmdletBinding()]
param (
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$ChromiumSrc
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

if ([string]::IsNullOrWhiteSpace($ChromiumSrc)) {
    if ((Test-Path "BUILD.gn") -and (Test-Path "third_party\blink")) {
        $ChromiumSrc = (Get-Item .).FullName
    } elseif ((Test-Path "..\..\BUILD.gn") -and (Test-Path "..\..\third_party\blink")) {
        $ChromiumSrc = (Get-Item "..\..").FullName
    } else {
        Write-Error "ERROR: Please specify path to Chromium 'src' directory.`nUsage: .\apply-patches.ps1 -ChromiumSrc C:\chromium\src"
        exit 1
    }
}

if (-not (Test-Path (Join-Path $ChromiumSrc "BUILD.gn")) -or -not (Test-Path (Join-Path $ChromiumSrc "third_party\blink"))) {
    Write-Error "ERROR: Target directory '$ChromiumSrc' is not a valid Chromium source tree."
    exit 1
}

$SeriesFile = Join-Path $ScriptDir "series"
if (-not (Test-Path $SeriesFile)) {
    Write-Error "ERROR: Series file not found at '$SeriesFile'"
    exit 1
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  MAHI BROWSER — Applying C++ Engine Patches to Chromium 138" -ForegroundColor Cyan
Write-Host "  Target: $ChromiumSrc" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$AppliedCount = 0

try {
    $lines = Get-Content $SeriesFile
    foreach ($rawLine in $lines) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
            continue
        }

        $patchFile = Join-Path $ScriptDir $line
        if (-not (Test-Path $patchFile)) {
            Write-Error "[-] FAILED: Patch file not found: $line"
            exit 1
        }

        # Check if patch targets nested V8 repository (src/v8) or Chromium root (src)
        $touchesV8 = Select-String -Path $patchFile -Pattern "^(diff --git a/v8/|--- a/v8/)" -Quiet
        if ($touchesV8) {
            $targetDir = Join-Path $ChromiumSrc "v8"
            $stripArgs = @("-p2")
        } else {
            $targetDir = $ChromiumSrc
            $stripArgs = @("-p1")
        }

        Write-Host -NoNewline "[+] Testing patch: $line ... "
        $checkArgs = @("apply", "--check", "--whitespace=nowarn") + $stripArgs + @($patchFile)
        $checkProcess = Start-Process -FilePath "git" -ArgumentList $checkArgs -WorkingDirectory $targetDir -NoNewWindow -Wait -PassThru
        if ($checkProcess.ExitCode -eq 0) {
            Write-Host "OK" -ForegroundColor Green
            Write-Host -NoNewline "    Applying: $line ... "
            $applyArgs = @("apply", "--whitespace=nowarn") + $stripArgs + @($patchFile)
            $applyProcess = Start-Process -FilePath "git" -ArgumentList $applyArgs -WorkingDirectory $targetDir -NoNewWindow -Wait -PassThru
            if ($applyProcess.ExitCode -eq 0) {
                Write-Host "APPLIED" -ForegroundColor Green
                $AppliedCount++
            } else {
                Write-Error "ERROR: Failed applying patch $line"
                exit 1
            }
        } else {
            # Check if patch is already applied in reverse
            $reverseArgs = @("apply", "--reverse", "--check") + $stripArgs + @($patchFile)
            $reverseProcess = Start-Process -FilePath "git" -ArgumentList $reverseArgs -WorkingDirectory $targetDir -NoNewWindow -Wait -PassThru
            if ($reverseProcess.ExitCode -eq 0) {
                Write-Host "ALREADY APPLIED (skipping)" -ForegroundColor Yellow
                $AppliedCount++
            } else {
                Write-Host "FAILED" -ForegroundColor Red
                Write-Error "ERROR: git apply check failed for patch $line"
                exit 1
            }
        }
    }

    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "  SUCCESS: Applied $AppliedCount MAHI C++ patches cleanly." -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Cyan
} catch {
    Write-Error $_
    exit 1
}
