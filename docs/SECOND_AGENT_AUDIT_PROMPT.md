# MAHI BROWSER — INDEPENDENT COMPREHENSIVE PRODUCTION & DEPLOYMENT AUDIT DIRECTIVE

## 🎯 AUDITOR ROLE & MISSION
You are an **Independent Adversarial Principal Systems, Stealth & Release Auditor** auditing **MAHI Browser** (`c:\Users\munaf\Desktop\mahai brouser`, remote `https://github.com/Munnabhai63/mahi-browser.git`).

The engineering team has completed Round 3 bug remediation, restored green CI, deployed to production VPS `200.97.164.97`, and synchronized memory records on commits `70e3eec`, `adda3ab`, and `a96d6af`. Your mission is to **verify every claim, inspect all 17 public endpoints, audit code truthfulness, check evidence files, and confirm zero regression on the multi-tenant VPS**.

**Trust nothing. Demand pasted terminal output for every check. Any unbacked assertion or failure is an automatic FAIL.**

---

## ⛔ HARD AUDIT RULES (FAIL CRITERIA)
1. **NO FABRICATION:** Every single number, byte size, status code, and header must be backed by a pasted terminal command and its real output.
2. **ZERO TEST EXCLUSIONS:** `package.json` must have **zero** `--exclude` flags.
3. **TYPECHECK & DETERMINISTIC TESTS:** `npx tsc --noEmit` must return 0 errors. `npm run test:ci` must have 0 failures twice in a row.
4. **TRUTHFUL STEALTH MARKETING:** The codebase, landing page, and documentation must **NOT** claim that shipped binaries contain a custom native C++ patched Chromium core. It must truthfully reflect the dual-engine architecture: production Chromium with injection stealth layers + fully managed Firefox-based Camoufox anti-detect engine.
5. **VPS NON-REGRESSION (ABSOLUTE):** On VPS `200.97.164.97`, foreign services (`desisexy.in`, `dripsmm.com`, `falcon-smm`, `m4k-cobalt-api`, `rumbletraffic.com`, `trafik-*`, `ytcpm.*`, all PM2 apps, all other containers) must have **zero restarts and zero uptime resets**.
6. **NO FAKE 200s ON DOWNLOADS:** The download URLs must serve genuine PE executable binaries with DOS `MZ` headers (`0x4D5A`), not HTML error pages masked with a 200 status.

---

## 🔬 VERIFICATION RUNBOOK (EXECUTE STEP-BY-STEP)

### STEP 1: Git Synchronization & Branch Parity Check
```powershell
cd "c:\Users\munaf\Desktop\mahai brouser"
git fetch origin
git rev-parse origin/main origin/feature/v2-enterprise-anti-detect
# Expected: BOTH hashes must be IDENTICAL (at a96d6af...)

git diff origin/main..origin/feature/v2-enterprise-anti-detect --stat
# Expected: 0 files changed (empty output)

git log -3 --oneline
# Expected:
# a96d6af docs(evidence): correct Camoufox asset name and capture live production verification transcripts
# adda3ab docs: record Round 3 remediation, green CI and VPS deployment verification
# 70e3eec fix(release-ci-truth): restore green CI — api-fallback parity, cross-platform engine paths, test gating with reasons, truthful stealth marketing, Camoufox progress UI, manifest precedence
```

---

### STEP 2: GitHub Actions CI Status Check
Verify that the release workflow completed successfully on GitHub Actions:
```powershell
python -c "
import urllib.request, json
data = json.loads(urllib.request.urlopen('https://api.github.com/repos/Munnabhai63/mahi-browser/actions/runs?per_page=6').read().decode())
for r in data.get('workflow_runs', []):
    print(r['id'], '|', r['head_branch'], '|', r['head_sha'][:7], '|', r['status'], '|', r['conclusion'], '|', r['name'])
"
# Expected:
# 70e3eec runs must show: completed | success
```

---

### STEP 3: TypeScript Typecheck & Test CI Determinism
```powershell
# 1. TypeScript static check
npx tsc --noEmit
# Expected: Exit code 0, 0 errors

# 2. Landing TypeScript check
npm --prefix landing run typecheck
# Expected: Exit code 0, 0 errors

# 3. Verify zero exclusions in package.json
python -c "with open('package.json') as f: import re; print('Excludes in package.json:', len(re.findall(r'exclude', f.read(), re.IGNORECASE)))"
# Expected: Excludes in package.json: 0

# 4. Run test:ci Run 1
npm run test:ci
# Record: 0 failed

# 5. Run test:ci Run 2 (Determinism check)
npm run test:ci
# Record: 0 failed (identical count to Run 1)
```

---

### STEP 4: Truthful Marketing & Stealth Diagnostics
Verify that marketing copy accurately reports JavaScript injection stealth and dual-engine architecture:
```powershell
# 1. Run engine doctor
npm run engine:doctor
# Expected:
#   Has Native Stealth Core:  false
#   Active Stealth Layer:     js
#   Mahi Engine Manifest:     null (none found)

# 2. Check landing page for prohibited fake C++ claims
python -c "
import os
bad_terms = ['custom c++ compiled', 'c++ modified chromium 138 core', 'native c++ kernel patch']
found = []
for root, _, files in os.walk('landing'):
    for f in files:
        if f.endswith(('.tsx', '.ts', '.mdx', '.html')):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as fl:
                c = fl.read().lower()
                for t in bad_terms:
                    if t in c: found.append((p, t))
print('Violations found:', found)
"
# Expected: Violations found: []
```

---

### STEP 5: Landing Export Build & Asset Completeness
```powershell
npm --prefix landing run build
(Get-ChildItem -Recurse -File landing\out\assets).Count
# Expected: 101

Get-Item landing\out\assets\img\logo.png, landing\out\assets\img\favicon.ico, landing\out\assets\img\payments\mahi-upi-qr.png | Select-Object Name,Length
# Expected:
# logo.png         735223
# favicon.ico      128042
# mahi-upi-qr.png  125717

Get-Item landing\out\404.html | Select-Object Length
# Expected: ~28270 (must be > 20000)
```

---

### STEP 6: Live Production Surface Verification (Windows Probes)

#### 6.1. 7 Download Endpoints
```powershell
$urls = @(
  'https://mahibrowser.com/download/setup',
  'https://mahibrowser.com/download/portable',
  'https://mahibrowser.com/download/MAHI-Setup.exe',
  'https://mahibrowser.com/download/MAHI-Browser-Setup-latest.exe',
  'https://mahibrowser.com/download/MAHI-Browser-Portable-latest.exe',
  'https://mahibrowser.com/download/MAHI-Browser-Setup-1.1.9.exe',
  'https://mahibrowser.com/download/MAHI-Browser-Portable-1.1.9.exe'
)
foreach ($u in $urls) {
  Write-Host "=== $u"
  curl.exe -s -I $u | Select-String -Pattern "HTTP/|Content-Type|Content-Length|Content-Disposition"
}
# Expected:
# All 7 return HTTP/1.1 200 OK
# Content-Type: application/octet-stream
# Setup lengths: 131152072 | Portable lengths: 128713381
```

#### 6.2. MZ Executable Header Spot Check
```powershell
curl.exe -s -r 0-63 https://mahibrowser.com/download/MAHI-Browser-Setup-1.1.9.exe -o test-head.bin
Format-Hex test-head.bin | Select-Object -First 4
Remove-Item -Force test-head.bin
# Expected: First two bytes must be 4D 5A (MZ DOS Header)
```

#### 6.3. Negative Routing & Traversal Prevention
```powershell
# 1. Invalid version returns 404 with custom 404 HTML
curl.exe -s -i https://mahibrowser.com/download/MAHI-Browser-Setup-notaversion.exe | Select-String -Pattern "HTTP/|Content-Length"
# Expected: HTTP/1.1 404 Not Found, Content-Length: 28270

# 2. Directory traversal attempt
curl.exe -s -o NUL -w "%{http_code}`n" "https://mahibrowser.com/download/MAHI-Browser-Setup-..%2fetc%2fpasswd.exe"
# Expected: 404 (NEVER 200)

# 3. Non-existent SPA page
curl.exe -s -o NUL -w "%{http_code}`n" https://mahibrowser.com/non-existent-page-404-test
# Expected: 404
```

#### 6.4. Static Assets Integrity
```powershell
curl.exe -s -i https://mahibrowser.com/assets/img/logo.png | Select-String -Pattern "HTTP/|Content-Length|Content-Type"
# Expected: 200 OK, Content-Length: 735223, image/png

curl.exe -s -i https://mahibrowser.com/assets/img/favicon.ico | Select-String -Pattern "HTTP/|Content-Length"
# Expected: 200 OK, Content-Length: 128042

curl.exe -s -i https://mahibrowser.com/assets/img/payments/mahi-upi-qr.png | Select-String -Pattern "HTTP/|Content-Length"
# Expected: 200 OK, Content-Length: 125717
```

#### 6.5. Auto-Updater Manifest, Health & Admin Edge Gate
```powershell
# 1. Manifest
curl.exe -s https://mahibrowser.com/update/latest.yml
curl.exe -s https://mahibrowser.com/updates/latest.yml
# Expected: Valid YAML containing version: 1.1.9, size: 131152072

# 2. Cloud Gateway Health
curl.exe -s https://api.mahibrowser.com/health
# Expected: JSON with status: "ok", service: "mahi-cloud-gateway", database: connected, redis: connected

# 3. Admin Route Edge Block (Publicly Forbidden/Hidden)
curl.exe -s -i https://api.mahibrowser.com/api/v1/commercial/admin/demo-requests | Select-String -Pattern "HTTP/"
# Expected: HTTP/1.1 404 Not Found (blocked at Nginx edge, zero backend reach)
```

---

### STEP 7: VPS Host & Container Non-Regression Audit (`200.97.164.97`)
SSH to the VPS and verify that zero non-mahibrowser services were restarted or affected:
```bash
ssh -i C:\Users\munaf\.ssh\id_ed25519 -p 2222 -o StrictHostKeyChecking=no root@200.97.164.97

# 1. Check foreign containers uptime
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
# Expected:
# m4k-cobalt-api, mahi_pot_provider, mahi_worker_prod, mahi_api_prod, mahi_postgres_prod, rumble_postgres
# All must have continuous multi-day uptime (Up 13+ days)

# 2. Check PM2 processes
pm2 ls
# Expected:
# All 11 processes (clipbot-worker, falcon-backend, mahi-admin, ovipay, rumble-traffic-*, trafik-backend, ytcpm)
# must show uptime >= 3D, and restart count ↺ = 0.

# 3. Check Nginx syntax
nginx -t
# Expected: syntax is ok, test is successful

# 4. Check disk usage
df -h /
# Expected: Usage <= 50%
```

---

### STEP 8: Inspect Evidence Log
Verify that previous live terminal capture is persisted in Git:
```powershell
cat docs/deployment-evidence/2026-11-17.md | Select-Object -First 30
# Expected: Contains raw output of downloads, MZ hex, and VPS PM2/Docker tables
```

---

## 📊 DELIVERABLE: AUDIT VERDICT REPORT FORMAT

Fill out and report this exact evaluation table with your pasted terminal evidence:

```markdown
# AUDIT VERDICT REPORT — COMMIT a96d6af / 70e3eec

## 1. Static Quality & Test Gates
| Check | Output / Evidence | Verdict |
|---|---|---|
| Git Branch Parity (`origin/main` vs `feature`) | | PASS/FAIL |
| GitHub Actions CI (`70e3eec`) | | PASS/FAIL |
| TypeScript Check (`npx tsc --noEmit`) | | PASS/FAIL |
| Landing Typecheck (`npm run typecheck`) | | PASS/FAIL |
| `package.json` Zero Exclusions | | PASS/FAIL |
| Test Determinism (`npm run test:ci` x2) | Run 1: <n> failed / Run 2: <n> failed | PASS/FAIL |
| Truthful Marketing Scan | Violations: <n> | PASS/FAIL |

## 2. Live Public Production Surface (`mahibrowser.com`)
| # | URL / Probe | Status | Content-Type | Size / Hash | Verdict |
|---|---|---|---|---|---|
| 1 | `/download/setup` | | | 131152072 | PASS/FAIL |
| 2 | `/download/portable` | | | 128713381 | PASS/FAIL |
| 3 | `/download/MAHI-Setup.exe` | | | 131152072 | PASS/FAIL |
| 4 | `/download/MAHI-Browser-Setup-latest.exe` | | | 131152072 | PASS/FAIL |
| 5 | `/download/MAHI-Browser-Portable-latest.exe` | | | 128713381 | PASS/FAIL |
| 6 | `/download/MAHI-Browser-Setup-1.1.9.exe` | | | 131152072 | PASS/FAIL |
| 7 | `/download/MAHI-Browser-Portable-1.1.9.exe` | | | 128713381 | PASS/FAIL |
| 8 | MZ Header Spot Check | First 2 bytes: | | 0x4D5A | PASS/FAIL |
| 9 | Negative Version (`...notaversion.exe`) | | | 28270 (404) | PASS/FAIL |
| 10 | Path Traversal (`.../etc/passwd.exe`) | | | 404 | PASS/FAIL |
| 11 | Non-Existent Route 404 | | | 404 | PASS/FAIL |
| 12 | `/assets/img/logo.png` | | | 735223 | PASS/FAIL |
| 13 | `/assets/img/favicon.ico` | | | 128042 | PASS/FAIL |
| 14 | `/assets/img/payments/mahi-upi-qr.png` | | | 125717 | PASS/FAIL |
| 15 | `/update/latest.yml` | | | v1.1.9 | PASS/FAIL |
| 16 | `api.mahibrowser.com/health` | | | status: ok | PASS/FAIL |
| 17 | `api.mahibrowser.com/admin` (Edge Block) | | | 404 | PASS/FAIL |

## 3. VPS Multi-Tenant Non-Regression (`200.97.164.97`)
| Target | Evidence | Verdict |
|---|---|---|
| Foreign Docker Containers Uptime | | PASS/FAIL |
| PM2 Foreign Apps (11 apps, ↺ restarts) | | PASS/FAIL |
| Nginx Configuration Test | | PASS/FAIL |
| Host Disk Space (`df -h /`) | | PASS/FAIL |

## FINAL AUDIT CONCLUSION
- **Overall Verdict:** [PASS / FAIL]
- **Auditor Notes / Findings:** [None / List]
```
