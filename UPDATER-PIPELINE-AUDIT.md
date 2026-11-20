# MAHI Browser — Update Pipeline Audit (origin/main `28551ee`)

**Audited:** 2026-11-16 · **Branch:** `arena/f0c0ba65-mahi-browser` (from `bf1c4d1`)
**Target:** `Munnabhai63/mahi-browser` → `main` → `28551ee`
**Method:** `git show origin/main:*` line reads, `gh api` runs/jobs/annotations, local `npx vitest` repro

> Evidence-only. No claim here is made without a file:line or a command output.

---

## 0. What the owner actually asked

"Users who already have MAHI Browser installed — will they receive the new build?
Right now they don't. Fix the whole pipeline so GitHub push → VPS → user's app works."

**Answer: No. Four independent breaks. Three are now visible in main's CI.**

---

## 1. Break #1 — CI never reaches the VPS (and the one job that would, cannot run)

### 1.1 Tags carry an old workflow
| Tag | Workflow at that tag | Has `softprops/action-gh-release`? | Has `deploy-vps`? |
|---|---|---|---|
| `v1.1.9` (`fc5f990`) | publish + normalise present | **yes** (`:184`) | no |
| `v1.2.0` (`d8a7641`) | **no publish step at all** | **no** | no |

Proof:
```
git merge-base --is-ancestor fc5f990 v1.2.0   → NO
git show d8a7641:.github/workflows/cross-platform-release.yml | grep action-gh-release → empty
```
Consequence: `v1.2.0` produced a **green run** (`44658824180`) that published nothing.
The `v1.2.0` GitHub Release assets exist because they were **uploaded outside CI**.

### 1.2 `deploy-vps` lives only on `main`, never on any tag
```
grep -c deploy-vps   v1.1.9 → 0   |   v1.2.0 → 0   |   origin/main → 1
deploy-vps condition: if: startsWith(github.ref, 'refs/tags/v')   (:283)
```
A tag alone can never trigger it, because the job is not in the tagged tree.
Tag `v1.2.1` today would build a release but **still not deploy**.

### 1.3 `deploy-vps` has never executed once
All tag-triggered runs of this workflow: `v1.2.0` (02:09, success), `v1.1.9` (09:07, success).
Neither tree contained `deploy-vps`. **Zero successful deploys exist in CI history.**

### 1.4 Main's HEAD is red — this is the blocker for everything downstream
Run `44765886726` (`28551ee`):

| Job | Result |
|---|---|
| Resolve Target Matrix | success |
| **Test & Typecheck (windows-latest)** | **failure** |
| Package Desktop | skipped |
| Deploy Release to Production VPS | skipped |

Failing step: `10 Run CI Test Suite (macOS / Windows)`.
Annotation:
```
11_TESTS/unit/account-session-and-quota.test.ts :: AssertionError: expected false to be true
```

**Root cause, reproduced locally** (commit `1253fe3` added `11_TESTS/setup/global-test-setup.ts`):

```ts
// global-test-setup.ts:19
process.env.MAHI_USER_DATA_DIR = testIsolatedDir;
```
```ts
// account-session-and-quota.test.ts:97-99   ← reads APPDATA, ignores the sandbox
const appdata = process.env.APPDATA || '';
const sessionFile = path.join(appdata, 'mahi-browser', 'account-session.enc');
expect(fs.existsSync(sessionFile)).toBe(true);
```
`getWritableUserDataDir()` honours `MAHI_USER_DATA_DIR` **first** (`runtime-paths.ts:53`), so the
file is written to the temp dir while the assertion looks in `%APPDATA%`.

Proof run (on `02430be` + env var, which is exactly what `1253fe3`'s setup file now does):
```
MAHI_USER_DATA_DIR=$(mktemp -d) npx vitest run 11_TESTS/unit/account-session-and-quota.test.ts
→ Tests  1 failed | 9 passed (10)
   ❯ 11_TESTS/unit/account-session-and-quota.test.ts:99:42

# same file, WITHOUT the env var:
npx vitest run 11_TESTS/unit/account-session-and-quota.test.ts
→ Tests  10 passed (10)
```
So: `1253fe3` broke a previously-green test. Fix must be in the **test** (assert against
`getWritableUserDataDir()` / `MAHI_USER_DATA_DIR`), not by deleting the global sandbox.

---

## 2. Break #2 — the artifact that gets deployed is the WRONG artifact

Step order inside `build-and-package` on `origin/main`:

| Line | Step |
|---|---|
| 193 | Generate Checksums (Windows) |
| **199** | **Upload Build Artifacts** ← snapshot taken here |
| 206 | Normalise release filenames (`Setup-latest.exe`, `Portable-latest.exe`) |
| 218 | Generate `latest.json` |
| 226 | Verify `latest.yml` sha512 |
| 253 | Assert blockmap exists |
| 263 | Publish GitHub Release |

`deploy-vps` then downloads `mahi-browser-win-x64` (`:289-293`).

**Consequences:**
1. The artifact contains **no `*-latest.exe`** and **no `latest.json`**.
   (`28551ee` patched the scp lines with `if [ -f ... ]` guards — which makes the job *pass
   silently* while uploading nothing. That is worse than failing: `/download/setup` stays on the
   old build.)
2. The artifact also contains **no blockmap**, so deferred/differential update has nothing to use.
3. `latest.yml` inside the artifact is the raw electron-builder one — `:226` verifies it
   **after** upload, so the verified bytes are never the shipped bytes.

---

## 3. Break #3 — `latest.yml` vs `latest.json` can disagree about *which file* is primary

- `latest.json` generator takes **every** `.exe` (`generate-release-manifest.cjs:31`), then picks
  primary as "contains `Setup-<version>`" → falls back to `Setup` → falls back to `files[0]`.
- Backend download path uses **`currentPendingManifest.files[0]`** (`updater-service.ts:399`) — no
  Setup filter.
- `latest.yml`'s `path:` is whichever installer electron-builder wrote last.
- Target order is `[nsis, portable]` (`electron-builder.json`).

So a readdir order flip can make `files[0]` a **Portable** exe, and the app would try to install a
portable build over an NSIS install. Add the Setup-only filter on both sides and pin the manifest to
the Setup artefact.

---

## 4. Break #4 — a poisoned `feedUrl` is trusted forever (this is the `ERR_CONNECTION_REFUSED`)

On `origin/main` — **still unpatched**:

| Location | Code |
|---|---|
| `updater-service.ts:56` | `feedUrl: data.feedUrl \|\| DEFAULT_UPDATE_FEED_URL` — no validation |
| `updater-service.ts:541-546` | `setUpdateConfig` merges + writes, no validation |
| `updater-provider.ts:35` | `protocol === 'https:' ? https : http` — **plain `http://` and `127.0.0.1` allowed** |
| `register-handlers.ts:1925` | IPC `updater:setConfig` passes renderer input straight through |
| `phase4-updater-pipeline.test.ts:123` | test writes `http://127.0.0.1:<ephemeral>/update/` |
| `phase4-updater-pipeline.test.ts:131-140` | `afterAll` resets provider, **not config** |
| `resetUpdaterStateForTesting()` `:572-581` | resets status, **not `activeConfig`** |

Two separate harms:
1. **Dev machine:** stale `127.0.0.1:<dead port>` → `ERR_CONNECTION_REFUSED` on every check.
2. **Any user:** `feedUrl` is the only thing deciding where the "update" comes from, and the
   integrity hash comes from **that same server** (`:418-422`). One bad value = arbitrary remote
   binary install. Test-setup isolation alone does **not** fix this; the production-side guard does.

---

## 5. Other real gaps on `origin/main` (verified, not blocking the first deploy)

| # | Gap | Evidence |
|---|---|---|
| 5.1 | VPS **IP published** in a public repo | `docs/progress.md:7,13,70,82` → `200.97.164.97`; repo `private=false` |
| 5.2 | Deploy secrets **undocumented** | `.env.example` has no `VPS_*`; `gh api .../actions/secrets` → 403 (no admin token) |
| 5.3 | `concurrency` missing → two `v*` tags / re-runs can interleave on the same release | `grep concurrency` → NONE |
| 5.4 | `deploy-vps` never stops on failure; `/update/latest.yml` is replaced non-atomically (scp) | `:317-341` — no temp+`mv`, no rollback |
| 5.5 | Engine mirror filenames **inconsistent** | app wants `chrome-138-win64.zip`, `chromium-138-win64.zip`, `chrome-138.zip`; mirror script writes `chrome-138.0.7204.92-win64.zip` |
| 5.6 | `publish-engine-mirror.sh` never invoked by any workflow | `grep publish-engine-mirror *.yml` → empty |
| 5.7 | Landing still advertises 1.1.9 macOS/Linux URLs | `landing/lib/brand.ts:22-23`, `landing/components/DownloadButtons.tsx:56,77` |
| 5.8 | `version.ts` fixed (good) but `brand.version` is hardcoded `1.2.1` | `landing/lib/brand.ts:9` |
| 5.9 | No rollback: a bad tag immediately becomes "latest" for 100% of users | no staged rollout / no `/update/latest-prev.yml` |
| 5.10 | Two workflows fire on the same `v*` tag (`build-mahi-chromium.yml:27-29`) | both write to the same release |
| 5.11 | `latest.json` blockmap absent → `electron-updater` will do **full** 300 MB downloads only | `:253` asserts blockmap but `:199` uploaded before it existed |
| 5.12 | No post-deploy install verification (only HTTP HEADs) — a correct-looking manifest over a broken exe passes | `:345-390` checks codes/version strings only |

---

## 6. What must happen (ordered)

1. **Turn main green.** Fix `account-session-and-quota.test.ts` to assert against
   `getWritableUserDataDir()`. No test deletion, no `--forceExit`.
2. **Move Upload Build Artifacts to after Normalise + latest.json + blockmap + sha512 verify.**
3. **Pin `latest.json` `files[0]` to the NSIS Setup exe**; make backend prefer Setup by name.
4. **Sanitize `feedUrl`** (https-only + host allowlist + fall back to `DEFAULT_UPDATE_FEED_URL`) in
   `loadUpdateConfig`, `setUpdateConfig` and the IPC handler; reset `activeConfig` in
   `resetUpdaterStateForTesting`.
5. **Make `deploy-vps` fail loudly** if `*-latest.exe` / `latest.json` / blockmap are missing.
6. **Delete the published VPS IP** from docs; document `VPS_HOST/USER/PORT/SSH_KEY` as secret names.
7. Add `concurrency`, atomic manifest swap (`mv`, not in-place scp), and a real post-deploy
   install test on a clean Windows runner.
8. Ship `v1.2.1` **from a tag that actually contains all of the above** (verify with
   `git show v1.2.1:.github/workflows/cross-platform-release.yml | grep -c deploy-vps` → must be ≥1).

---

*Report generated by read-only inspection. No repository file was modified except adding this document.*
