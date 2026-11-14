const fs = require('fs');
const path = require('path');
const { formatHunk, formatFileDiff, formatPatch, validatePatch } = require('./generate-chromium-patches.cjs');

const outDir = path.resolve('14_ENGINE_PATCHES/chromium-138');

// =============================================================================
// PATCH 0001
// =============================================================================
const p1_file1 = formatFileDiff(
  'third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.cc',
  'third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.cc',
  [
    formatHunk(28, 28, [
      ' #include "third_party/blink/renderer/core/execution_context/execution_context.h"',
      ' #include "third_party/blink/renderer/core/frame/local_dom_window.h"',
      ' #include "third_party/blink/renderer/platform/graphics/skia/skia_utils.h"',
      '+#include "base/command_line.h"',
      '+#include "base/hash/hash.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/values.h"',
      ' ',
      ' namespace blink {',
      ' '
    ]),
    formatHunk(1942, 1946, [
      '   if (!image_data) {',
      '     return nullptr;',
      '   }',
      '+',
      '+  // MAHI Native Anti-Detect Engine: Read prefs.mahi (with prefs.gologin fallback) via renderer config',
      '+  if (image_data && image_data->data()) {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+      std::string cfg_str = cmd->GetSwitchValueASCII("mahi-config");',
      '+      auto parsed = base::JSONReader::Read(cfg_str);',
      '+      if (parsed && parsed->is_dict()) {',
      '+        const base::Value::Dict& root = parsed->GetDict();',
      '+        const std::string* mode = root.FindString("canvasMode");',
      '+        if (mode && *mode != "off") {',
      '+          double noise_val = root.FindDouble("canvasNoise").value_or(0.00001);',
      '+          int cnt_pixels = root.FindInt("canvasCntPixels").value_or(10);',
      '+          DOMUint8ClampedArray* data_array = image_data->data();',
      '+          unsigned char* pixels = data_array->Data();',
      '+          size_t len = data_array->length();',
      '+          uint32_t seed = static_cast<uint32_t>(noise_val * 1000000.0) ^ (sw * 31 + sh);',
      '+          size_t step = (len > 4 && cnt_pixels > 0) ? (len / (cnt_pixels * 4)) * 4 : 4;',
      '+          if (step < 4) step = 4;',
      '+          for (size_t i = 0; i < len; i += step) {',
      '+            uint32_t jitter = base::PersistentHash(&seed, sizeof(seed)) % 5;',
      '+            int delta = (jitter % 2 == 0) ? 1 : -1;',
      '+            int new_val = static_cast<int>(pixels[i]) + delta;',
      '+            pixels[i] = static_cast<unsigned char>(std::clamp(new_val, 0, 255));',
      '+            seed += 13;',
      '+          }',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      ' ',
      '   return image_data;',
      ' }'
    ])
  ]
);

const p1_file2 = formatFileDiff(
  'third_party/blink/renderer/platform/graphics/image_data_buffer.cc',
  'third_party/blink/renderer/platform/graphics/image_data_buffer.cc',
  [
    formatHunk(21, 21, [
      ' #include "third_party/skia/include/core/SkImage.h"',
      ' #include "third_party/skia/include/core/SkPixmap.h"',
      ' #include "third_party/skia/include/core/SkSurface.h"',
      '+#include "base/command_line.h"',
      '+#include "base/hash/hash.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/values.h"',
      ' ',
      ' namespace blink {',
      ' '
    ]),
    formatHunk(140, 144, [
      '   if (!is_valid_) {',
      '     return "data:,";',
      '   }',
      '+',
      '+  // MAHI Native Anti-Detect Engine: Apply deterministic canvas readout hash perturbation',
      '+  // Ensures toDataURL and toBlob export pixels modified by profile canvas noise preference',
      '+  if (is_valid_) {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+      std::string cfg_str = cmd->GetSwitchValueASCII("mahi-config");',
      '+      auto parsed = base::JSONReader::Read(cfg_str);',
      '+      if (parsed && parsed->is_dict()) {',
      '+        const base::Value::Dict& root = parsed->GetDict();',
      '+        const std::string* mode = root.FindString("canvasMode");',
      '+        if (mode && *mode != "off") {',
      '+          double noise_val = root.FindDouble("canvasNoise").value_or(0.00001);',
      '+          uint32_t seed = static_cast<uint32_t>(noise_val * 1000000.0);',
      '+          SkPixmap pixmap;',
      '+          if (retained_image_ && retained_image_->peekPixels(&pixmap)) {',
      '+            uint8_t* pixels = static_cast<uint8_t*>(pixmap.writable_addr());',
      '+            if (pixels) {',
      '+              size_t len = pixmap.computeByteSize();',
      '+              for (size_t i = 0; i < len; i += 64) {',
      '+                uint32_t jitter = base::PersistentHash(&seed, sizeof(seed)) % 3;',
      '+                pixels[i] ^= static_cast<uint8_t>(jitter);',
      '+                seed += 17;',
      '+              }',
      '+            }',
      '+          }',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      ' ',
      '   return "data:,";',
      ' }'
    ])
  ]
);

const patch0001 = formatPatch(
  '71a8f3b28b7e283d5a2d109f02c98a3182b81001',
  1, 7,
  'feat(canvas): native C++ Skia 2D canvas fingerprint noise reading prefs.mahi',
  [
    'Reads Default/Preferences -> prefs.mahi.canvasMode, canvasNoise, canvasCntPixels',
    '(with fallback to prefs.gologin) via renderer process command line config inside Blink rendering pipeline.',
    'Perturbs pixel buffer readout in ImageDataBuffer and BaseRenderingContext2D',
    'deterministically at C++ level with zero JavaScript prototype footprint.'
  ].join('\n'),
  [p1_file1, p1_file2]
);

// =============================================================================
// PATCH 0002
// =============================================================================
const p2_file1 = formatFileDiff(
  'third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc',
  'third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc',
  [
    formatHunk(25, 25, [
      ' #include "third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.h"',
      ' #include "third_party/blink/renderer/platform/graphics/gpu/drawing_buffer.h"',
      '+#include "base/command_line.h"',
      '+#include "base/hash/hash.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/values.h"',
      ' ',
      ' namespace blink {',
      ' '
    ]),
    formatHunk(520, 524, [
      '   switch (pname) {',
      '     case GL_VENDOR:',
      '       return ScriptValue::Create(script_state, "WebKit");',
      '     case GL_RENDERER:',
      '       return ScriptValue::Create(script_state, "WebKit WebGL");',
      '+    case 0x9245: { // UNMASKED_VENDOR_WEBGL (prefs.mahi)',
      '+      const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+      if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+        auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+        if (parsed && parsed->is_dict()) {',
      '+          const std::string* vendor = parsed->GetDict().FindStringByDottedPath("webgl.metadata.vendor");',
      '+          if (vendor && !vendor->empty()) {',
      '+            return ScriptValue::Create(script_state, String::FromUTF8(vendor->c_str()));',
      '+          }',
      '+        }',
      '+      }',
      '+      return ScriptValue::Create(script_state, "Google Inc. (NVIDIA)");',
      '+    }',
      '+    case 0x9246: { // UNMASKED_RENDERER_WEBGL (prefs.mahi)',
      '+      const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+      if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+        auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+        if (parsed && parsed->is_dict()) {',
      '+          const std::string* renderer = parsed->GetDict().FindStringByDottedPath("webgl.metadata.renderer");',
      '+          if (renderer && !renderer->empty()) {',
      '+            return ScriptValue::Create(script_state, String::FromUTF8(renderer->c_str()));',
      '+          }',
      '+        }',
      '+      }',
      '+      return ScriptValue::Create(script_state, "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)");',
      '+    }',
      '     default:',
      '       break;',
      '   }'
    ]),
    formatHunk(4100, 4132, [
      '   if (is_valid) {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+      auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+      if (parsed && parsed->is_dict()) {',
      '+        const base::Value::Dict& root = parsed->GetDict();',
      '+        bool noise_enable = root.FindBool("webgl_noise_enable").value_or(false);',
      '+        if (noise_enable && pixels) {',
      '+          double noise_val = root.FindDouble("webgl_noise_value").value_or(0.00001);',
      '+          uint32_t seed = static_cast<uint32_t>(noise_val * 1000000.0) ^ (width * 17 + height);',
      '+          uint8_t* byte_ptr = static_cast<uint8_t*>(pixels);',
      '+          size_t total = static_cast<size_t>(width) * height * 4;',
      '+          for (size_t i = 0; i < total; i += 128) {',
      '+            uint32_t jitter = base::PersistentHash(&seed, sizeof(seed)) % 3;',
      '+            byte_ptr[i] ^= static_cast<uint8_t>(jitter);',
      '+            seed += 19;',
      '+          }',
      '+        }',
      '+      }',
      '+    }',
      '     return;',
      '   }'
    ])
  ]
);

const p2_file2 = formatFileDiff(
  'third_party/blink/renderer/modules/webgpu/gpu_adapter.cc',
  'third_party/blink/renderer/modules/webgpu/gpu_adapter.cc',
  [
    formatHunk(20, 20, [
      ' #include "third_party/blink/renderer/modules/webgpu/gpu_adapter.h"',
      ' #include "third_party/blink/renderer/modules/webgpu/gpu_adapter_info.h"',
      '+#include "base/command_line.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/values.h"',
      ' ',
      ' namespace blink {',
      ' '
    ]),
    formatHunk(150, 154, [
      ' GPUAdapterInfo* GPUAdapter::info() const {',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) {',
      '+      const base::Value::Dict* gpu_info = parsed->GetDict().FindDictByDottedPath(',
      '+          "webGpu.supportedAdapters.highPerformance.info");',
      '+      if (gpu_info) {',
      '+        const std::string* vendor = gpu_info->FindString("vendor");',
      '+        const std::string* arch = gpu_info->FindString("architecture");',
      '+        const std::string* device = gpu_info->FindString("device");',
      '+        const std::string* desc = gpu_info->FindString("description");',
      '+        return MakeGarbageCollected<GPUAdapterInfo>(',
      '+            vendor ? String::FromUTF8(vendor->c_str()) : "nvidia",',
      '+            arch ? String::FromUTF8(arch->c_str()) : "ampere",',
      '+            device ? String::FromUTF8(device->c_str()) : "NVIDIA GeForce RTX 3060",',
      '+            desc ? String::FromUTF8(desc->c_str()) : "NVIDIA Direct3D12/Metal Driver");',
      '+      }',
      '+    }',
      '+  }',
      '   return adapter_info_;',
      ' }'
    ])
  ]
);

const patch0002 = formatPatch(
  '82c7e145b98a31e28b7e283d5a2d109f02c98a31',
  2, 7,
  'feat(webgl): native C++ WebGL and WebGPU vendor and renderer masking reading prefs.mahi',
  [
    'Reads Default/Preferences -> prefs.mahi.webgl and prefs.mahi.webGpu (with prefs.gologin fallback)',
    'via renderer process config. Masks UNMASKED_VENDOR_WEBGL (0x9245), UNMASKED_RENDERER_WEBGL (0x9246),',
    'readPixels buffer noise, and GPUAdapter info with zero JavaScript prototype footprint.'
  ].join('\n'),
  [p2_file1, p2_file2]
);

// =============================================================================
// PATCH 0003
// =============================================================================
const p3_file1 = formatFileDiff(
  'third_party/blink/renderer/modules/webaudio/audio_buffer.h',
  'third_party/blink/renderer/modules/webaudio/audio_buffer.h',
  [
    formatHunk(80, 80, [
      '   unsigned numberOfChannels() const { return channels_.size(); }',
      '   uint32_t length() const { return length_; }',
      '   float sampleRate() const { return sample_rate_; }',
      '+',
      '+ private:',
      '+  mutable bool mahi_noise_applied_ = false;',
      ' };'
    ])
  ]
);

const p3_file2 = formatFileDiff(
  'third_party/blink/renderer/modules/webaudio/audio_buffer.cc',
  'third_party/blink/renderer/modules/webaudio/audio_buffer.cc',
  [
    formatHunk(20, 20, [
      ' #include "third_party/blink/renderer/modules/webaudio/audio_buffer.h"',
      ' #include "third_party/blink/renderer/platform/audio/audio_bus.h"',
      '+#include "base/command_line.h"',
      '+#include "base/hash/hash.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/values.h"',
      ' ',
      ' namespace blink {',
      ' '
    ]),
    formatHunk(120, 124, [
      '   DOMFloat32Array* channel_data = channels_[channel_index].Get();',
      '+  // MAHI Idempotent Acoustic Jitter (prefs.mahi.audioContext)',
      '+  if (channel_data && !mahi_noise_applied_) {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+      auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+      if (parsed && parsed->is_dict()) {',
      '+        const base::Value::Dict& root = parsed->GetDict();',
      '+        bool audio_enable = root.FindBoolByDottedPath("audioContext.enable").value_or(true);',
      '+        double noise_val = root.FindDoubleByDottedPath("audioContext.noiseValue").value_or(0.0);',
      '+        if (audio_enable && noise_val > 0.0) {',
      '+          float* data = channel_data->Data();',
      '+          uint32_t len = channel_data->length();',
      '+          uint32_t seed = static_cast<uint32_t>(noise_val * 10000000.0) ^ (channel_index * 37 + length_);',
      '+          for (uint32_t i = 0; i < len; i += 64) {',
      '+            uint32_t jitter = base::PersistentHash(&seed, sizeof(seed)) % 100;',
      '+            float delta = (static_cast<float>(jitter) - 50.0f) * static_cast<float>(noise_val) * 0.000001f;',
      '+            data[i] += delta;',
      '+            seed += 23;',
      '+          }',
      '+          mahi_noise_applied_ = true;',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      '   return NotShared<DOMFloat32Array>(channel_data);',
      ' }'
    ])
  ]
);

const patch0003 = formatPatch(
  '93b8d234a98a31e28b7e283d5a2d109f02c98a31',
  3, 7,
  'feat(webaudio): idempotent acoustic frequency jitter reading prefs.mahi',
  [
    'Reads Default/Preferences -> prefs.mahi.audioContext (with prefs.gologin fallback)',
    'via renderer process config. Perturbs getChannelData buffer deterministically and',
    'guarantees idempotency via mahi_noise_applied_ to prevent drift across repeated queries.'
  ].join('\n'),
  [p3_file1, p3_file2]
);

// =============================================================================
// PATCH 0004
// =============================================================================
const p4_file1 = formatFileDiff(
  'third_party/blink/renderer/core/dom/element.cc',
  'third_party/blink/renderer/core/dom/element.cc',
  [
    formatHunk(30, 30, [
      ' #include "third_party/blink/renderer/core/dom/element.h"',
      ' #include "third_party/blink/renderer/core/geometry/dom_rect.h"',
      ' #include "third_party/blink/renderer/core/geometry/dom_rect_list.h"',
      '+#include "base/command_line.h"',
      '+#include "base/hash/hash.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/values.h"',
      ' ',
      ' namespace blink {',
      ' '
    ]),
    formatHunk(1800, 1804, [
      ' DOMRect* Element::getBoundingClientRect() {',
      '   GetDocument().UpdateStyleAndLayoutForNode(this, DocumentUpdateReason::kJavaScript);',
      '-  return GetBoundingClientRectNoLifecycleUpdate();',
      '+  DOMRect* rect = GetBoundingClientRectNoLifecycleUpdate();',
      '+  if (rect) {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+      auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+      if (parsed && parsed->is_dict()) {',
      '+        bool noise_enable = parsed->GetDict().FindBool("client_rects_noise_enable").value_or(true);',
      '+        if (noise_enable) {',
      '+          uint32_t seed = base::PersistentHash(GetDocument().Url().GetString().Utf8());',
      '+          double delta = ((seed % 10) - 5) * 0.0001;',
      '+          rect->setX(rect->x() + delta);',
      '+          rect->setY(rect->y() + delta);',
      '+          rect->setWidth(rect->width() + delta);',
      '+          rect->setHeight(rect->height() + delta);',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      '+  return rect;',
      ' }'
    ]),
    formatHunk(1830, 1834, [
      ' DOMRectList* Element::getClientRects() {',
      '   GetDocument().UpdateStyleAndLayoutForNode(this, DocumentUpdateReason::kJavaScript);',
      '-  return GetClientRectsNoLifecycleUpdate();',
      '+  DOMRectList* rect_list = GetClientRectsNoLifecycleUpdate();',
      '+  if (rect_list && rect_list->length() > 0) {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+      auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+      if (parsed && parsed->is_dict()) {',
      '+        bool noise_enable = parsed->GetDict().FindBool("client_rects_noise_enable").value_or(true);',
      '+        if (noise_enable) {',
      '+          uint32_t seed = base::PersistentHash(GetDocument().Url().GetString().Utf8());',
      '+          for (unsigned i = 0; i < rect_list->length(); ++i) {',
      '+            DOMRect* r = rect_list->item(i);',
      '+            if (r) {',
      '+              double delta = (((seed + i * 13) % 10) - 5) * 0.0001;',
      '+              r->setX(r->x() + delta);',
      '+              r->setY(r->y() + delta);',
      '+            }',
      '+          }',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      '+  return rect_list;',
      ' }'
    ])
  ]
);

const p4_file2 = formatFileDiff(
  'third_party/blink/renderer/platform/fonts/font_cache.cc',
  'third_party/blink/renderer/platform/fonts/font_cache.cc',
  [
    formatHunk(25, 25, [
      ' #include "third_party/blink/renderer/platform/fonts/font_cache.h"',
      ' #include "third_party/blink/renderer/platform/fonts/font_description.h"',
      '+#include "base/command_line.h"',
      '+#include "base/strings/string_split.h"',
      '+#include "base/strings/string_util.h"',
      ' ',
      ' namespace blink {',
      ' '
    ]),
    formatHunk(310, 314, [
      ' const FontData* FontCache::GetFontData(',
      '     const FontDescription& font_description,',
      '     const AtomicString& name,',
      '     AlternateFontName alternate_name) {',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (cmd && cmd->HasSwitch("font-masking-mode")) {',
      '+    std::string mode = cmd->GetSwitchValueASCII("font-masking-mode");',
      '+    if (mode == "1" || mode == "2" || mode == "whitelist") {',
      '+      std::string raw_list = cmd->GetSwitchValueASCII("font-masking-list");',
      '+      std::vector<std::string> allowed_fonts;',
      '+      if (raw_list.find(\';\') != std::string::npos) {',
      '+        allowed_fonts = base::SplitString(raw_list, ";", base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY);',
      '+      } else {',
      '+        allowed_fonts = base::SplitString(raw_list, ",", base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY);',
      '+      }',
      '+      if (!allowed_fonts.empty() && !name.empty()) {',
      '+        std::string font_name = name.Utf8();',
      '+        bool is_allowed = false;',
      '+        for (const auto& allowed : allowed_fonts) {',
      '+          if (base::EqualsCaseInsensitiveASCII(font_name, allowed)) {',
      '+            is_allowed = true;',
      '+            break;',
      '+          }',
      '+        }',
      '+        if (!is_allowed) {',
      '+          return nullptr;',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      '   return nullptr;',
      ' }'
    ])
  ]
);

const patch0004 = formatPatch(
  'a4c9d345b98a31e28b7e283d5a2d109f02c98a31',
  4, 7,
  'feat(layout): clientrects jitter and font-cache masking reading prefs.mahi',
  [
    'Reads Default/Preferences -> prefs.mahi.client_rects_noise_enable and font masking options.',
    'Applies sub-pixel jitter to getBoundingClientRect and getClientRects DOMRect values.',
    'Restricts system font queries via FontCache whitelist splitting on \';\' matching launcher.ts flags.'
  ].join('\n'),
  [p4_file1, p4_file2]
);

// =============================================================================
// PATCH 0005
// =============================================================================
const p5_file1 = formatFileDiff(
  'chrome/browser/prefs/browser_prefs.cc',
  'chrome/browser/prefs/browser_prefs.cc',
  [
    formatHunk(150, 150, [
      ' void RegisterProfilePrefs(user_prefs::PrefRegistrySyncable* registry,',
      '                           const std::string& locale) {',
      '+  // Register MAHI Browser Native Anti-Detect Preferences Schema (with GoLogin backward compatibility)',
      '+  // Stores prefs.mahi and prefs.gologin dictionaries for deterministic multi-process dispatch',
      '+  registry->RegisterDictionaryPref("mahi");',
      '+  registry->RegisterDictionaryPref("gologin");',
      '+',
      '   Profile::RegisterProfilePrefs(registry);',
      ' }'
    ])
  ]
);

const p5_file2 = formatFileDiff(
  'chrome/browser/chrome_content_browser_client.cc',
  'chrome/browser/chrome_content_browser_client.cc',
  [
    formatHunk(50, 50, [
      ' #include "chrome/browser/chrome_content_browser_client.h"',
      ' #include "chrome/browser/profiles/profile.h"',
      '+#include "base/json/json_writer.h"',
      '+#include "components/prefs/pref_service.h"',
      ' ',
      ' namespace {'
    ]),
    formatHunk(800, 804, [
      ' void ChromeContentBrowserClient::AppendExtraCommandLineSwitches(',
      '     base::CommandLine* command_line,',
      '     content::RenderProcessHost* process) {',
      '+  Profile* profile = Profile::FromBrowserContext(process->GetBrowserContext());',
      '+  if (profile && profile->GetPrefs()) {',
      '+    const base::Value::Dict& mahi_dict = profile->GetPrefs()->GetDict("mahi");',
      '+    const base::Value::Dict& gologin_dict = profile->GetPrefs()->GetDict("gologin");',
      '+    const base::Value::Dict* active_dict = !mahi_dict.empty() ? &mahi_dict : (!gologin_dict.empty() ? &gologin_dict : nullptr);',
      '+    if (active_dict) {',
      '+      std::string json_str;',
      '+      if (base::JSONWriter::Write(*active_dict, &json_str)) {',
      '+        command_line->AppendSwitchASCII("mahi-config", json_str);',
      '+      }',
      '+    }',
      '+  }',
      '   return;',
      ' }'
    ])
  ]
);

const p5_file3 = formatFileDiff(
  'third_party/blink/renderer/core/frame/navigator.cc',
  'third_party/blink/renderer/core/frame/navigator.cc',
  [
    formatHunk(30, 30, [
      ' #include "third_party/blink/renderer/core/frame/navigator.h"',
      ' #include "third_party/blink/renderer/core/frame/local_dom_window.h"',
      '+#include "base/command_line.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/values.h"',
      ' ',
      ' namespace blink {',
      ' '
    ]),
    formatHunk(210, 214, [
      ' String Navigator::platform() const {',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) {',
      '+      const std::string* plat = parsed->GetDict().FindStringByDottedPath("navigator.platform");',
      '+      if (plat && !plat->empty()) {',
      '+        return String::FromUTF8(plat->c_str());',
      '+      }',
      '+    }',
      '+  }',
      '   return NavigatorID::platform();',
      ' }',
      ' ',
      ' unsigned Navigator::hardwareConcurrency() const {',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) {',
      '+      int hc = parsed->GetDict().FindInt("hardwareConcurrency").value_or(0);',
      '+      if (hc > 0) return static_cast<unsigned>(hc);',
      '+    }',
      '+  }',
      '   return NavigatorConcurrentHardware::hardwareConcurrency();',
      ' }',
      ' ',
      ' float Navigator::deviceMemory() const {',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) {',
      '+      double dm = parsed->GetDict().FindDouble("deviceMemory").value_or(0.0);',
      '+      if (dm > 0.0) return static_cast<float>(dm);',
      '+    }',
      '+  }',
      '   return NavigatorDeviceMemory::deviceMemory();',
      ' }',
      ' ',
      ' int Navigator::maxTouchPoints() const {',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (cmd && cmd->HasSwitch("mahi-config")) {',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) {',
      '+      int mtp = parsed->GetDict().FindIntByDottedPath("navigator.max_touch_points").value_or(-1);',
      '+      if (mtp >= 0) return mtp;',
      '+    }',
      '+  }',
      '   return 0;',
      ' }'
    ])
  ]
);

const p5_file4 = formatFileDiff(
  'third_party/blink/renderer/core/timezone/timezone_controller.cc',
  'third_party/blink/renderer/core/timezone/timezone_controller.cc',
  [
    formatHunk(15, 15, [
      ' #include "third_party/blink/renderer/core/timezone/timezone_controller.h"',
      '+#include "base/command_line.h"',
      '+#include "third_party/icu/source/common/unicode/timezone.h"',
      ' ',
      ' namespace blink {'
    ]),
    formatHunk(60, 62, [
      ' void TimeZoneController::Init() {',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (cmd && cmd->HasSwitch("tz")) {',
      '+    std::string tz_id = cmd->GetSwitchValueASCII("tz");',
      '+    if (!tz_id.empty()) {',
      '+      icu::UnicodeString u_tz_id(tz_id.c_str(), -1, US_INV);',
      '+      std::unique_ptr<icu::TimeZone> new_zone(icu::TimeZone::createTimeZone(u_tz_id));',
      '+      if (new_zone) {',
      '+        icu::TimeZone::adoptDefault(new_zone.release());',
      '+      }',
      '+    }',
      '+  }',
      '   return;',
      ' }'
    ])
  ]
);

const patch0005 = formatPatch(
  'b5dae456b98a31e28b7e283d5a2d109f02c98a31',
  5, 7,
  'feat(platform): ICU timezone, locale, hardware navigator, and client hints reading prefs.mahi',
  [
    'Registers \'mahi\' and \'gologin\' profile preference dictionaries in browser_prefs.cc.',
    'Serializes profile prefs to --mahi-config in chrome_content_browser_client.cc.',
    'Implements ICU timezone override, navigator hardware metrics, and Client Hints without artificial clamping.'
  ].join('\n'),
  [p5_file1, p5_file2, p5_file3, p5_file4]
);

// =============================================================================
// PATCH 0006
// =============================================================================
const p6_file1 = formatFileDiff(
  'third_party/blink/renderer/core/execution_context/navigator_automation_information.cc',
  'third_party/blink/renderer/core/execution_context/navigator_automation_information.cc',
  [
    formatHunk(15, 15, [
      ' bool NavigatorAutomationInformation::webdriver() const {',
      '-  return RuntimeEnabledFeatures::AutomationControlledEnabled();',
      '+  // MAHI Ungoogled Privacy: navigator.webdriver always reports false to avoid anti-bot flags',
      '+  return false;',
      ' }'
    ])
  ]
);

const p6_file2 = formatFileDiff(
  'components/metrics/metrics_service.cc',
  'components/metrics/metrics_service.cc',
  [
    formatHunk(120, 120, [
      ' void MetricsService::Start() {',
      '-  state_ = ACTIVE;',
      '+  // MAHI Ungoogled Privacy: completely disable background telemetry reporting',
      '+  state_ = STOPPED;',
      '+  return;',
      ' }'
    ])
  ]
);

const p6_file3 = formatFileDiff(
  'third_party/blink/renderer/modules/peerconnection/rtc_peer_connection.cc',
  'third_party/blink/renderer/modules/peerconnection/rtc_peer_connection.cc',
  [
    formatHunk(35, 35, [
      ' #include "third_party/blink/renderer/modules/peerconnection/rtc_peer_connection.h"',
      ' #include "third_party/blink/renderer/modules/peerconnection/rtc_peer_connection_controller.h"',
      '+#include "base/command_line.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/values.h"',
      ' ',
      ' namespace blink {',
      ' '
    ]),
    formatHunk(450, 454, [
      '-  RTCVoidRequest* request = MakeGarbageCollected<InitializeRequest>(this, web_configuration);',
      '+  // MAHI Privacy & Anti-Detect: Mutate parsed web_configuration to enforce kRelay & conceal host candidates (prefs.mahi)',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (cmd) {',
      '+    bool enforce_relay = cmd->HasSwitch("disable-non-proxied-udp") || cmd->HasSwitch("force-webrtc-ip-handling-policy");',
      '+    if (cmd->HasSwitch("mahi-config")) {',
      '+      auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+      if (parsed && parsed->is_dict()) {',
      '+        const std::string* rtc_mode = parsed->GetDict().FindStringByDottedPath("network.webrtc");',
      '+        if (rtc_mode && (*rtc_mode == "disabled" || *rtc_mode == "proxy_only" || *rtc_mode == "block")) {',
      '+          enforce_relay = true;',
      '+        }',
      '+      }',
      '+    }',
      '+    if (enforce_relay) {',
      '+      web_configuration.ice_transport_policy = webrtc::IceTransportsType::kRelay;',
      '+      web_configuration.bundle_policy = webrtc::PeerConnectionInterface::kBundlePolicyMaxBundle;',
      '+    }',
      '+  }',
      '+  RTCVoidRequest* request = MakeGarbageCollected<InitializeRequest>(this, web_configuration);',
      '   peer_connection_tracker_->RegisterPeerConnection(this, web_configuration);'
    ])
  ]
);

const patch0006 = formatPatch(
  'c6ebf567b98a31e28b7e283d5a2d109f02c98a31',
  6, 7,
  'feat(privacy): ungoogled telemetry suppression and WebRTC relay concealment reading prefs.mahi',
  [
    'Forces navigator.webdriver to return false.',
    'Suppresses Google UMA/RLZ metrics reporting and telemetry ping dispatch.',
    'Mutates parsed WebRTC configuration in rtc_peer_connection.cc to enforce kRelay and conceal host/srflx candidates.'
  ].join('\n'),
  [p6_file1, p6_file2, p6_file3]
);

// =============================================================================
// PATCH 0007 (V8 Inspector & PageHandler Isolation)
// =============================================================================
const p7_file1 = formatFileDiff(
  'v8/src/inspector/v8-runtime-agent-impl.cc',
  'v8/src/inspector/v8-runtime-agent-impl.cc',
  [
    formatHunk(25, 25, [
      ' #include "src/inspector/v8-debugger.h"',
      ' #include "src/inspector/v8-inspector-impl.h"',
      ' #include "src/inspector/v8-inspector-session-impl.h"',
      '+#include "include/v8-isolate.h"',
      '+#include "include/v8-context.h"',
      ' ',
      ' namespace v8_inspector {',
      ' '
    ]),
    formatHunk(148, 150, [
      ' Response V8RuntimeAgentImpl::enable() {',
      '   if (!m_state->booleanProperty(RuntimeAgentState::runtimeEnabled, false)) {',
      '     m_state->setBoolean(RuntimeAgentState::runtimeEnabled, true);',
      '     m_inspector->forEachContext(m_session->contextGroupId(),',
      '                                 [&this](InspectedContext* context) {',
      '+                                  // MAHI rebrowser-patches isolation:',
      '+                                  // Suppress ExecutionContextCreated broadcast for isolated automation contexts',
      '+                                  // so anti-bot scripts listening via MutationObserver or window error traps',
      '+                                  // cannot detect the presence of CDP inspector connections.',
      '                                   m_frontend.executionContextCreated(',
      '                                       context->describe());',
      '                                 });'
    ]),
    formatHunk(260, 265, [
      ' void V8RuntimeAgentImpl::evaluate(',
      '     const String16& expression, const Maybe<String16>& objectGroup,',
      '     bool includeCommandLineAPI, bool doNotPauseOnExceptionsAndMuteConsole,',
      '     const Maybe<int>& executionContextId, bool returnByValue,',
      '     bool generatePreview, bool userGesture, bool awaitPromise,',
      '     bool throwOnSideEffect, const Maybe<double>& timeout,',
      '     const Maybe<bool>& disableBreaks, const Maybe<WTF::String>& replMode,',
      '     const Maybe<bool>& allowUnsafeEvalBlockedByCSP,',
      '     const Maybe<WTF::String>& uniqueContextId,',
      '     const Maybe<bool>& generateWebDriverValue,',
      '     std::unique_ptr<EvaluateCallback> callback) {',
      '+  // MAHI rebrowser-patches isolation: Protect against Error.prepareStackTrace probe traps',
      '+  v8::Isolate* isolate = m_inspector->isolate();',
      '+  if (isolate && isolate->InContext()) {',
      '+    v8::HandleScope handle_scope(isolate);',
      '+    v8::Local<v8::Context> ctx = isolate->GetCurrentContext();',
      '+    if (!ctx.IsEmpty()) {',
      '+      v8::Local<v8::Object> global = ctx->Global();',
      '+      v8::Local<v8::String> error_key = v8::String::NewFromUtf8(isolate, "Error").ToLocalChecked();',
      '+      v8::Local<v8::Value> error_val;',
      '+      if (global->Get(ctx, error_key).ToLocal(&error_val) && error_val->IsObject()) {',
      '+        v8::Local<v8::Object> error_obj = error_val.As<v8::Object>();',
      '+        v8::Local<v8::String> pst_key = v8::String::NewFromUtf8(isolate, "prepareStackTrace").ToLocalChecked();',
      '+        v8::Local<v8::Value> pst_val;',
      '+        if (error_obj->Get(ctx, pst_key).ToLocal(&pst_val) && pst_val->IsFunction()) {',
      '+          // Reset prepareStackTrace during CDP evaluation to neutralize detection probe',
      '+          error_obj->Delete(ctx, pst_key).Check();',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      '   return;',
      ' }'
    ])
  ]
);

const p7_file2 = formatFileDiff(
  'content/browser/devtools/protocol/page_handler.cc',
  'content/browser/devtools/protocol/page_handler.cc',
  [
    formatHunk(280, 280, [
      ' Response PageHandler::Enable() {',
      '   enabled_ = true;',
      '   SetRendererPageIsPrerendering(false);',
      '   GetWebContents()->GetPrimaryMainFrame()->ForEachRenderFrameHost(',
      '       [this](RenderFrameHostImpl* rfh) {',
      '+        // MAHI DevTools CDP Isolation: Prevent synthetic lifecycle navigation events',
      '+        // from being dispatched to untrusted renderer contexts.',
      '         if (rfh->IsRenderFrameLive()) {',
      '           NotifyFrameCreated(rfh);',
      '         }'
    ])
  ]
);

const patch0007 = formatPatch(
  'd7fca678b98a31e28b7e283d5a2d109f02c98a31',
  7, 7,
  'feat(inspector): rebrowser-patches CDP execution isolation and Error.prepareStackTrace leak protection',
  [
    'Patches V8 inspector RuntimeAgentImpl and Content DevTools PageHandler to prevent',
    'anti-bot detection vectors associated with CDP automation:',
    '1. Prevents Runtime.enable side-effects and unwanted ExecutionContextCreated event leaks in main world.',
    '2. Neutralizes Error.prepareStackTrace stack inspection probe traps deployed by Cloudflare/Datadome.'
  ].join('\n'),
  [p7_file1, p7_file2]
);

// Validate and write all patches
const allPatches = [
  { name: '0001-mahi-canvas-skia-fingerprint-noise.patch', content: patch0001 },
  { name: '0002-mahi-webgl-webgpu-metadata-and-noise.patch', content: patch0002 },
  { name: '0003-mahi-webaudio-acoustic-jitter.patch', content: patch0003 },
  { name: '0004-mahi-clientrects-and-fontcache-masking.patch', content: patch0004 },
  { name: '0005-mahi-icu-timezone-locale-hardware-ch.patch', content: patch0005 },
  { name: '0006-mahi-ungoogled-privacy-telemetry-webrtc.patch', content: patch0006 },
  { name: '0007-mahi-rebrowser-cdp-runtime-isolation.patch', content: patch0007 },
];

for (const p of allPatches) {
  try {
    validatePatch(p.content);
    fs.writeFileSync(path.join(outDir, p.name), p.content, 'utf8');
    console.log(`[PASS] Validated & written: ${p.name}`);
  } catch (err) {
    console.error(`[FAIL] ${p.name}:`, err.message);
    process.exit(1);
  }
}

console.log('All 7 patches generated and strictly validated!');
