# MAHI BROWSER — Custom C++ Chromium 138 Anti-Detect Patchset

Target Chromium Milestone: **`138.0.7204.0`** (Commit Position: `1465706`)  
Architecture: **Native C++ Blink/V8/Content Hooks (Zero JavaScript Prototype Monkey-Patching Footprint)**

---

## 1. Overview & Architectural Design

Standard anti-detect browsers rely heavily on injecting JavaScript scripts into `document_start` (`world: 'MAIN'`). However, sophisticated anti-bot engines (CreepJS, Pixelscan, Cloudflare Turnstile, Datadome, Kasada, Akamai) detect JavaScript monkey-patching via:
1. `Function.prototype.toString()` and `Error.stack` introspection.
2. Proxy traps leaking through `Object.getOwnPropertyDescriptor()` on prototype chains.
3. Prototype tampering detection on `WebGLRenderingContext`, `HTMLCanvasElement`, and `AudioBuffer`.
4. `ExecutionContextCreated` and CDP `Runtime.enable` leaks.

MAHI Browser solves this at the root by modifying **Chromium's C++ source code directly**. The compiled binary reads profile configuration directly from Chromium's native `PrefService` under `Default/Preferences` (`prefs.mahi.*`, with backward-compatible fallback to `prefs.gologin.*`).

---

## 2. Patch Series Index (`series`)

| Patch File | Subsystem & Files Modified | Capabilities & Spoofing Invariants |
| :--- | :--- | :--- |
| **`0001-mahi-canvas-skia-fingerprint-noise.patch`** | `blink/modules/canvas/canvas2d/base_rendering_context_2d.cc`<br>`blink/platform/graphics/image_data_buffer.cc` | Reads `prefs.mahi.canvasMode`, `canvasNoise`, `canvasCntPixels`. Perturbs 2D Skia pixel readout in `getImageData` via `RawByteSpan()` and `toDataURL` at the C++ level. |
| **`0002-mahi-webgl-webgpu-metadata-and-noise.patch`** | `blink/modules/webgl/webgl_rendering_context_base.cc`<br>`blink/modules/webgpu/gpu_adapter.cc` | Reads `prefs.mahi.webgl.metadata.{vendor,renderer}`, `webgl_noise_enable`, buffer limits, and `prefs.mahi.webGpu.*`. Delivers unmasked vendor/renderer in `getParameter(0x9245/0x9246)` and WebGPU `GPUAdapterInfo` caching (`[SameObject]`). |
| **`0003-mahi-webaudio-acoustic-jitter.patch`** | `blink/modules/webaudio/audio_buffer.h`<br>`blink/modules/webaudio/audio_buffer.cc` | Reads `prefs.mahi.audioContext.{enable,noiseValue}`. Injects micro-frequency acoustic perturbation in `AudioBuffer::getChannelData` and `AudioBuffer::copyFromChannel` with zero in-place drift. |
| **`0004-mahi-clientrects-and-fontcache-masking.patch`** | `blink/core/dom/element.cc`<br>`blink/platform/fonts/font_cache.cc` | Reads `prefs.mahi.client_rects_noise_enable` for sub-pixel bounding box jitter (<0.005px). Natively honors `--font-masking-mode` and `--font-masking-list` across `GetFontData`, `IsPlatformFamilyMatchAvailable`, and `IsPlatformFontUniqueNameMatchAvailable`. |
| **`0005-mahi-icu-timezone-locale-hardware-ch.patch`** | `chrome/browser/prefs/browser_prefs.cc`<br>`chrome/browser/chrome_content_browser_client.cc`<br>`blink/core/frame/navigator.cc`<br>`blink/core/events/navigator_events.cc`<br>`blink/core/execution_context/navigator_base.cc`<br>`blink/core/timezone/timezone_controller.cc`<br>`navigator_concurrent_hardware.cc`<br>`navigator_device_memory.cc` | Reads `prefs.mahi.navigator.platform`, `max_touch_points`, `hardwareConcurrency`, `deviceMemory`. Aligns main window & Web Worker JS getters with native HTTP Client Hints and timezone persistence. |
| **`0006-mahi-ungoogled-privacy-telemetry-webrtc.patch`** | `components/metrics/metrics_service.cc`<br>`blink/modules/peerconnection/rtc_peer_connection.cc` | Completely strips `navigator.webdriver`. Disables Google background UMA/RLZ telemetry. Enforces relay-only WebRTC policy and drops local/mDNS IP leaks natively. |
| **`0007-mahi-rebrowser-v8-inspector-isolation.patch`** | `v8/src/inspector/v8-runtime-agent-impl.cc` | Targets nested `src/v8` checkout. Eliminates `Runtime.enable` execution context leaks via `mahiSuppressContextCreated` and protects against `Error.prepareStackTrace` CDP stack inspection traps without handle leaks or evaluate failure. |
| **`0008-mahi-rebrowser-page-handler-isolation.patch`** | `content/browser/devtools/protocol/page_handler.cc` | Targets Chromium root `src`. Suppresses synthetic `FrameStartedNavigating` lifecycle navigation events under isolated CDP mode (`--mahi-cdp-isolated`). |

---

## 3. How to Check Out & Build Custom Chromium

### Step 1: Install Chromium Build Tools (`depot_tools`)
```bash
# Clone depot_tools to a directory in your PATH
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
export PATH="$PATH:/path/to/depot_tools" # On Windows, add to System Environment Variables
```

### Step 2: Fetch Chromium Source Code
```bash
mkdir chromium && cd chromium
fetch --nohooks chromium
cd src
git checkout -b mahi-138 138.0.7204.0
gclient sync -D --force --reset
```

### Step 3: Apply the MAHI C++ Patchset
**Linux / macOS:**
```bash
bash /path/to/mahi-browser/14_ENGINE_PATCHES/chromium-138/apply-patches.sh
```

**Windows (PowerShell):**
```powershell
& "C:\path\to\mahi-browser\14_ENGINE_PATCHES\chromium-138\apply-patches.ps1" -ChromiumSrc (Get-Item .).FullName
```

### Step 4: Configure GN Build Flags
Copy `args.gn` to your build output directory:
```bash
mkdir -p out/Default
cp /path/to/mahi-browser/14_ENGINE_PATCHES/chromium-138/args.gn out/Default/args.gn
gn gen out/Default
```

### Step 5: Compile Chromium
```bash
# Compiles the clean official Chromium executable
autoninja -C out/Default chrome
```

### Step 6: Embed `mahi-engine.json` Manifest
Copy `mahi-engine.json` alongside the compiled `chrome.exe` (or `chrome` on Linux/macOS):
```bash
cp /path/to/mahi-browser/14_ENGINE_PATCHES/chromium-138/mahi-engine.json out/Default/mahi-engine.json
```

---

## 4. Verification & QA Checklist (CreepJS & Fingerprint Suites)

After launching a profile using the compiled MAHI Chromium engine:
- [ ] **CreepJS (https://abrahamjuliot.github.io/creepjs/):**
  - Score: **A+ / 0% Lies Detected**
  - Prototype checks: All prototype descriptors return genuine native C++ IDL descriptors (`Object.getOwnPropertyDescriptor(RTCPeerConnection.prototype, 'onicecandidate')`).
  - Worker scope: Web Worker and Shared Worker return identical canvas/webgl noise as the main thread.
- [ ] **BrowserLeaks WebGL (https://browserleaks.com/webgl):**
  - Unmasked Vendor & Renderer match profile `webglVendor` and `webglRenderer`.
  - Zero extension monkey-patching detected in `getParameter`.
- [ ] **BrowserLeaks WebRTC (https://browserleaks.com/webrtc):**
  - Zero local private IP addresses (e.g. `192.168.x.x`, `10.x.x.x`) leaked.
  - Zero STUN/SRFLX public IP leaks when WebRTC mode is set to `disabled` or `proxy_only`.
- [ ] **Pixelscan (https://pixelscan.net/):**
  - Status: **Consistent Fingerprint (Green)**.
  - No mismatch between OS platform and User-Agent headers.
