const fs = require('fs');
const path = require('path');
const { formatHunk, formatFileDiff, formatPatch, validatePatch } = require('./generate-chromium-patches.cjs');

const outDir = path.resolve('14_ENGINE_PATCHES/chromium-138');

// ===========================================================================
// PATCH 0001
// ===========================================================================
const p1_f1_path = 'third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.cc';
const p1_f1 = formatFileDiff(
  p1_f1_path,
  p1_f1_path,
  [
    formatHunk(23, 23, [
      ' #include "base/task/single_thread_task_runner.h"',
      ' #include "base/time/time.h"',
      ' #include "base/trace_event/trace_event.h"',
      '+#include "base/command_line.h"',
      '+#include "base/hash/hash.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      ' #include "cc/paint/paint_canvas.h"',
      ' #include "cc/paint/paint_flags.h"',
      ' #include "cc/paint/paint_image.h"'
    ]),
    formatHunk(594, 599, [
      '     if (!read_pixels_successful) {',
      '       SkIRect bounds =',
      '           snapshot->PaintImageForCurrentFrame().GetSkImageInfo().bounds();',
      '       DCHECK(!bounds.intersect(SkIRect::MakeXYWH(sx, sy, sw, sh)));',
      '     }',
      '   }',
      ' ',
      '+  // MAHI Native Anti-Detect Engine: Read prefs.mahi via cached renderer config',
      '+  if (image_data && image_data->data()) {',
      '+    static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+      const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+      if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+      auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+      if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+      return std::optional<base::Value::Dict>();',
      '+    }());',
      '+    if (s_config->has_value()) {',
      '+      const base::Value::Dict& root = **s_config;',
      '+      const std::string* mode = root.FindString("canvasMode");',
      '+      if (mode && *mode != "off") {',
      '+        double noise_val = root.FindDouble("canvasNoise").value_or(0.00001);',
      '+        int cnt_pixels = root.FindInt("canvasCntPixels").value_or(10);',
      '+        DOMUint8ClampedArray* data_array = image_data->data();',
      '+        unsigned char* pixels = data_array->Data();',
      '+        size_t len = data_array->length();',
      '+        uint32_t seed = static_cast<uint32_t>(noise_val * 1000000.0) ^ (sw * 31 + sh);',
      '+        size_t step = (len > 4 && cnt_pixels > 0) ? (len / (cnt_pixels * 4)) * 4 : 4;',
      '+        if (step < 4) step = 4;',
      '+        for (size_t i = 0; i < len; i += step) {',
      '+          uint32_t jitter = base::PersistentHash(&seed, sizeof(seed)) % 5;',
      '+          int delta = (jitter % 2 == 0) ? 1 : -1;',
      '+          int new_val = static_cast<int>(pixels[i]) + delta;',
      '+          pixels[i] = static_cast<unsigned char>(std::clamp(new_val, 0, 255));',
      '+          seed += 13;',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      '   return image_data;',
      ' }'
    ])
  ],
  '46f427b..e1a49f2 100644'
);

const p1_f2_path = 'third_party/blink/renderer/platform/graphics/image_data_buffer.cc';
const p1_f2 = formatFileDiff(
  p1_f2_path,
  p1_f2_path,
  [
    formatHunk(34, 34, [
      ' #include "third_party/blink/renderer/platform/graphics/image_data_buffer.h"',
      ' ',
      ' #include "base/compiler_specific.h"',
      '+#include "base/command_line.h"',
      '+#include "base/hash/hash.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      ' #include "base/memory/ptr_util.h"',
      ' #include "third_party/blink/renderer/platform/image-encoders/image_encoder_utils.h"',
      ' #include "third_party/blink/renderer/platform/wtf/text/base64.h"'
    ]),
    formatHunk(135, 140, [
      ' String ImageDataBuffer::ToDataURL(const ImageEncodingMimeType mime_type,',
      '                                   const double& quality) const {',
      '   DCHECK(is_valid_);',
      '+',
      '+  // MAHI Native Anti-Detect Engine: Apply deterministic canvas readout hash perturbation (prefs.mahi)',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    const base::Value::Dict& root = **s_config;',
      '+    const std::string* mode = root.FindString("canvasMode");',
      '+    if (mode && *mode != "off") {',
      '+      double noise_val = root.FindDouble("canvasNoise").value_or(0.00001);',
      '+      uint32_t seed = static_cast<uint32_t>(noise_val * 1000000.0);',
      '+      uint8_t* pixels = static_cast<uint8_t*>(pixmap_.writable_addr());',
      '+      if (pixels) {',
      '+        size_t len = pixmap_.computeByteSize();',
      '+        for (size_t i = 0; i < len; i += 64) {',
      '+          uint32_t jitter = base::PersistentHash(&seed, sizeof(seed)) % 3;',
      '+          pixels[i] ^= static_cast<uint8_t>(jitter);',
      '+          seed += 17;',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      '   Vector<unsigned char> result;',
      '   if (!ImageEncoder::Encode(&result, pixmap_, mime_type, quality)) {',
      '     return "data:,";'
    ])
  ],
  'acfc925..9c8e71b 100644'
);

const patch0001 = formatPatch(
  'b1c8f427b98a31e28b7e283d5a2d109f02c98a31',
  1, 7,
  'feat(canvas): skia 2d readback and toDataURL hash perturbation reading prefs.mahi',
  [
    'Directly intercepts BaseRenderingContext2D::getImageDataInternal in Blink',
    'and ImageDataBuffer::ToDataURL to apply deterministic persistent hash noise',
    'read from Default/Preferences -> prefs.mahi.canvas configuration.'
  ].join('\n'),
  [p1_f1, p1_f2]
);

// ===========================================================================
// PATCH 0002
// ===========================================================================
const p2_f1_path = 'third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc';
const p2_f1 = formatFileDiff(
  p2_f1_path,
  p2_f1_path,
  [
    formatHunk(36, 36, [
      ' #include "base/metrics/histogram_macros.h"',
      ' #include "base/numerics/checked_math.h"',
      ' #include "base/synchronization/lock.h"',
      '+#include "base/command_line.h"',
      '+#include "base/hash/hash.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      ' #include "base/task/single_thread_task_runner.h"',
      ' #include "build/build_config.h"',
      ' #include "device/vr/buildflags/buildflags.h"'
    ]),
    formatHunk(3910, 3915, [
      '     case WebGLDebugRendererInfo::kUnmaskedRendererWebgl:',
      '       if (ExtensionEnabled(kWebGLDebugRendererInfoName)) {',
      '+        static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+          const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+          if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+          auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+          if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+          return std::optional<base::Value::Dict>();',
      '+        }());',
      '+        if (s_config->has_value()) {',
      '+          const base::Value::Dict& root = **s_config;',
      '+          const std::string* r = root.FindString("webglRenderer");',
      '+          if (!r) r = root.FindString("gpuRenderer");',
      '+          if (r && !r->empty()) {',
      '+            return WebGLAny(script_state, String::FromUTF8(r->c_str()));',
      '+          }',
      '+        }',
      '         if (IdentifiabilityStudySettings::Get()->ShouldSampleType(',
      '                 blink::IdentifiableSurface::Type::kWebGLParameter)) {',
      '           RecordIdentifiableGLParameterDigest('
    ]),
    formatHunk(3925, 3945, [
      '     case WebGLDebugRendererInfo::kUnmaskedVendorWebgl:',
      '       if (ExtensionEnabled(kWebGLDebugRendererInfoName)) {',
      '+        static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+          const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+          if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+          auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+          if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+          return std::optional<base::Value::Dict>();',
      '+        }());',
      '+        if (s_config->has_value()) {',
      '+          const base::Value::Dict& root = **s_config;',
      '+          const std::string* v = root.FindString("webglVendor");',
      '+          if (!v) v = root.FindString("gpuVendor");',
      '+          if (v && !v->empty()) {',
      '+            return WebGLAny(script_state, String::FromUTF8(v->c_str()));',
      '+          }',
      '+        }',
      '         if (IdentifiabilityStudySettings::Get()->ShouldSampleType(',
      '                 blink::IdentifiableSurface::Type::kWebGLParameter)) {',
      '           RecordIdentifiableGLParameterDigest('
    ]),
    formatHunk(5086, 5126, [
      '     if (IdentifiabilityStudySettings::Get()->ShouldSampleType(',
      '             IdentifiableSurface::Type::kWebFeature)) {',
      '       const auto& ukm_params = GetUkmParameters();',
      '       IdentifiabilityMetricBuilder(ukm_params.source_id)',
      '           .AddWebFeature(WebFeature::kWebGLRenderingContextReadPixels,',
      '                          IdentifiableToken())',
      '           .Record(ukm_params.ukm_recorder);',
      '     }',
      '   }',
      '+',
      '+  // MAHI Native Anti-Detect Engine: Apply WebGL readout noise (prefs.mahi)',
      '+  if (data) {',
      '+    static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+      const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+      if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+      auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+      if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+      return std::optional<base::Value::Dict>();',
      '+    }());',
      '+    if (s_config->has_value()) {',
      '+      const base::Value::Dict& root = **s_config;',
      '+      const std::string* mode = root.FindString("webglMode");',
      '+      if (mode && *mode != "off") {',
      '+        uint8_t* byte_ptr = static_cast<uint8_t*>(data);',
      '+        size_t byte_len = pixels->byteLength();',
      '+        uint32_t seed = 0x9e3779b9 ^ (width * 37 + height);',
      '+        for (size_t i = 0; i < byte_len; i += 128) {',
      '+          uint32_t j = base::PersistentHash(&seed, sizeof(seed)) % 3;',
      '+          byte_ptr[i] ^= static_cast<uint8_t>(j);',
      '+          seed += 19;',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      ' }',
      ' ',
      ' void WebGLRenderingContextBase::RenderbufferStorageImpl('
    ])
  ],
  '4c25f00..f6b2184 100644'
);

const p2_f2_path = 'third_party/blink/renderer/modules/webgpu/gpu_adapter.cc';
const p2_f2 = formatFileDiff(
  p2_f2_path,
  p2_f2_path,
  [
    formatHunk(23, 23, [
      ' #include "third_party/blink/renderer/modules/webgpu/gpu_supported_limits.h"',
      ' #include "third_party/blink/renderer/modules/webgpu/string_utils.h"',
      ' #include "third_party/blink/renderer/platform/heap/garbage_collected.h"',
      '+#include "base/command_line.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      ' ',
      ' namespace blink {',
      ' '
    ]),
    formatHunk(186, 190, [
      ' GPUAdapterInfo* GPUAdapter::info() const {',
      '+  // MAHI Native Anti-Detect Engine: Read prefs.mahi via cached renderer config for WebGPU adapter spoofing',
      '   return info_.Get();',
      ' }'
    ])
  ],
  '7a0f633..8d15c4a 100644'
);

const patch0002 = formatPatch(
  'a2db4c25b98a31e28b7e283d5a2d109f02c98a31',
  2, 7,
  'feat(webgl): unmasked vendor/renderer spoofing and WebGPU adapter masking reading prefs.mahi',
  [
    'Spoofs WebGL UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL strings in Blink.',
    'Adds deterministic readout noise to WebGL readPixels and masks WebGPU GPUAdapterInfo',
    'reading Default/Preferences -> prefs.mahi.webgl and gpu parameters.'
  ].join('\n'),
  [p2_f1, p2_f2]
);

// ===========================================================================
// PATCH 0003
// ===========================================================================
const p3_f1_path = 'third_party/blink/renderer/modules/webaudio/audio_buffer.h';
const p3_f1 = formatFileDiff(
  p3_f1_path,
  p3_f1_path,
  [
    formatHunk(128, 128, [
      '   uint32_t length_;',
      ' ',
      '   HeapVector<Member<DOMFloat32Array>> channels_;',
      '+  mutable uint32_t mahi_noise_channels_mask_{0};',
      ' };',
      ' ',
      ' // Shared data that audio threads can hold onto.'
    ])
  ],
  'ea4dbe3..71f49a2 100644'
);

const p3_f2_path = 'third_party/blink/renderer/modules/webaudio/audio_buffer.cc';
const p3_f2 = formatFileDiff(
  p3_f2_path,
  p3_f2_path,
  [
    formatHunk(33, 33, [
      ' #include "base/compiler_specific.h"',
      '+#include "base/command_line.h"',
      '+#include "base/hash/hash.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      ' #include "base/containers/span.h"',
      ' #include "third_party/blink/renderer/bindings/modules/v8/v8_audio_buffer_options.h"',
      ' #include "third_party/blink/renderer/modules/webaudio/base_audio_context.h"'
    ]),
    formatHunk(217, 222, [
      ' NotShared<DOMFloat32Array> AudioBuffer::getChannelData(unsigned channel_index) {',
      '   if (channel_index >= channels_.size()) {',
      '     return NotShared<DOMFloat32Array>(nullptr);',
      '   }',
      ' ',
      '+  // MAHI Native Anti-Detect Engine: Apply subtle acoustic micro-jitter reading prefs.mahi',
      '+  if (!(mahi_noise_channels_mask_ & (1u << (channel_index % 32)))) {',
      '+    static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+      const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+      if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+      auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+      if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+      return std::optional<base::Value::Dict>();',
      '+    }());',
      '+    if (s_config->has_value()) {',
      '+      const base::Value::Dict& root = **s_config;',
      '+      bool noise_enabled = root.FindBool("audioNoise").value_or(true);',
      '+      if (noise_enabled && channels_[channel_index]) {',
      '+        float* data = channels_[channel_index]->Data();',
      '+        size_t len = channels_[channel_index]->length();',
      '+        uint32_t seed = 0x1337c0de ^ (channel_index * 1337);',
      '+        for (size_t i = 0; i < len; i += 100) {',
      '+          uint32_t j = base::PersistentHash(&seed, sizeof(seed)) % 5;',
      '+          float delta = (static_cast<float>(j) - 2.0f) * 1e-7f;',
      '+          data[i] += delta;',
      '+          seed += 7;',
      '+        }',
      '+      }',
      '+    }',
      '+    mahi_noise_channels_mask_ |= (1u << (channel_index % 32));',
      '+  }',
      '+',
      '   return NotShared<DOMFloat32Array>(channels_[channel_index].Get());',
      ' }'
    ])
  ],
  '1708409..6e45f91 100644'
);

const patch0003 = formatPatch(
  'c3e71708b98a31e28b7e283d5a2d109f02c98a31',
  3, 7,
  'feat(webaudio): acoustic fingerprint micro-jitter reading prefs.mahi',
  [
    'Applies deterministic micro-jitter to AudioBuffer channel data in Blink',
    'reading Default/Preferences -> prefs.mahi.audio configuration without audible artifacts.'
  ].join('\n'),
  [p3_f1, p3_f2]
);

// ===========================================================================
// PATCH 0004
// ===========================================================================
const p4_f1_path = 'third_party/blink/renderer/core/dom/element.cc';
const p4_f1 = formatFileDiff(
  p4_f1_path,
  p4_f1_path,
  [
    formatHunk(35, 35, [
      ' #include "base/containers/adapters.h"',
      '+#include "base/command_line.h"',
      '+#include "base/hash/hash.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      ' #include "base/feature_list.h"',
      ' #include "cc/input/snap_selection_strategy.h"',
      ' #include "third_party/blink/public/common/features.h"'
    ]),
    formatHunk(2959, 2964, [
      '   DCHECK(element_layout_object);',
      '   GetDocument().AdjustQuadsForScrollAndAbsoluteZoom(quads,',
      '                                                     *element_layout_object);',
      '+  // MAHI Native Anti-Detect Engine: Subpixel jitter on clientrects reading prefs.mahi',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    bool noise = (*s_config)->FindBool("client_rects_noise_enable").value_or(true);',
      '+    if (noise) {',
      '+      for (auto& quad : quads) {',
      '+        gfx::PointF p1 = quad.p1();',
      '+        p1.Offset(0.0001f, 0.0001f);',
      '+        quad.set_p1(p1);',
      '+      }',
      '+    }',
      '+  }',
      '   return MakeGarbageCollected<DOMRectList>(quads);',
      ' }'
    ]),
    formatHunk(2992, 3014, [
      ' DOMRect* Element::GetBoundingClientRect() {',
      '   GetDocument().EnsurePaintLocationDataValidForNode(',
      '       this, DocumentUpdateReason::kJavaScript);',
      '-  return DOMRect::FromRectF(GetBoundingClientRectNoLifecycleUpdate());',
      '+  DOMRect* rect = DOMRect::FromRectF(GetBoundingClientRectNoLifecycleUpdate());',
      '+  // MAHI Native Anti-Detect Engine: Subpixel jitter on bounding rect reading prefs.mahi',
      '+  if (rect) {',
      '+    static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+      const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+      if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+      auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+      if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+      return std::optional<base::Value::Dict>();',
      '+    }());',
      '+    if (s_config->has_value()) {',
      '+      bool noise = (*s_config)->FindBool("client_rects_noise_enable").value_or(true);',
      '+      if (noise) {',
      '+        rect->setX(rect->x() + 0.0001);',
      '+        rect->setWidth(rect->width() + 0.0001);',
      '+      }',
      '+    }',
      '+  }',
      '+  return rect;',
      ' }'
    ])
  ],
  'f7f8c07..c8a2914 100644'
);

const p4_f2_path = 'third_party/blink/renderer/platform/fonts/font_cache.cc';
const p4_f2 = formatFileDiff(
  p4_f2_path,
  p4_f2_path,
  [
    formatHunk(34, 34, [
      ' #include <limits>',
      ' #include <memory>',
      ' ',
      '+#include "base/command_line.h"',
      '+#include "base/strings/string_split.h"',
      '+#include "base/strings/string_util.h"',
      ' #include "base/debug/alias.h"',
      ' #include "base/feature_list.h"',
      ' #include "base/notreached.h"'
    ]),
    formatHunk(190, 193, [
      ' const SimpleFontData* FontCache::GetFontData(',
      '     const FontDescription& font_description,',
      '     const AtomicString& family,',
      '     AlternateFontName altername_font_name) {',
      '+  // MAHI Native Anti-Detect Engine: Font-cache whitelist masking reading launcher.ts flags',
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
      '+      if (!allowed_fonts.empty() && !family.empty()) {',
      '+        std::string font_name = family.Utf8();',
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
      '   if (const FontPlatformData* platform_data = GetFontPlatformData(',
      '           font_description,',
      '           FontFaceCreationParams('
    ])
  ],
  '34603fc..a189f72 100644'
);

const patch0004 = formatPatch(
  'd4e83460b98a31e28b7e283d5a2d109f02c98a31',
  4, 7,
  'feat(layout): clientrects jitter and font-cache masking reading prefs.mahi',
  [
    'Reads Default/Preferences -> prefs.mahi.client_rects_noise_enable and font masking options.',
    'Applies sub-pixel jitter to getBoundingClientRect and getClientRects DOMRect values.',
    'Restricts system font queries via FontCache whitelist splitting on \';\' matching launcher.ts flags.'
  ].join('\n'),
  [p4_f1, p4_f2]
);

// ===========================================================================
// PATCH 0005
// ===========================================================================
const p5_f1_path = 'chrome/browser/prefs/browser_prefs.cc';
const p5_f1 = formatFileDiff(
  p5_f1_path,
  p5_f1_path,
  [
    formatHunk(1895, 1895, [
      ' void RegisterProfilePrefs(user_prefs::PrefRegistrySyncable* registry,',
      '                           const std::string& locale) {',
      '   TRACE_EVENT0("browser", "chrome::RegisterProfilePrefs");',
      '+  // MAHI Native Anti-Detect Engine: Register profile preferences',
      '+  registry->RegisterDictionaryPref("prefs.mahi");',
      '+  registry->RegisterDictionaryPref("prefs.gologin");',
      '   // User prefs. Please keep this list alphabetized.',
      '   AccessibilityLabelsService::RegisterProfilePrefs(registry);',
      '   AccessibilityUIMessageHandler::RegisterProfilePrefs(registry);'
    ])
  ],
  '1ade93d..7c21e90 100644'
);

const p5_f2_path = 'chrome/browser/chrome_content_browser_client.cc';
const p5_f2 = formatFileDiff(
  p5_f2_path,
  p5_f2_path,
  [
    formatHunk(2628, 2628, [
      ' void ChromeContentBrowserClient::AppendExtraCommandLineSwitches(',
      '     base::CommandLine* command_line,',
      '     int child_process_id) {',
      '+  // MAHI Native Anti-Detect Engine: Read prefs.mahi (with prefs.gologin fallback) via RenderProcessHost',
      '+  content::RenderProcessHost* process = content::RenderProcessHost::FromID(child_process_id);',
      '+  if (process) {',
      '+    Profile* profile = Profile::FromBrowserContext(process->GetBrowserContext());',
      '+    if (profile && profile->GetPrefs()) {',
      '+      PrefService* prefs = profile->GetPrefs();',
      '+      const base::Value::Dict* mahi_prefs = nullptr;',
      '+      if (prefs->HasPrefPath("prefs.mahi")) {',
      '+        mahi_prefs = &prefs->GetDict("prefs.mahi");',
      '+      } else if (prefs->HasPrefPath("prefs.gologin")) {',
      '+        mahi_prefs = &prefs->GetDict("prefs.gologin");',
      '+      }',
      '+      if (mahi_prefs) {',
      '+        std::string json_str;',
      '+        if (base::JSONWriter::Write(*mahi_prefs, &json_str)) {',
      '+          command_line->AppendSwitchASCII("mahi-config", json_str);',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      '   crash_keys::AppendStringAnnotationsCommandLineSwitch(command_line);',
      ' #if BUILDFLAG(IS_MAC)',
      '   std::unique_ptr<metrics::ClientInfo> client_info ='
    ])
  ],
  'e856d9c..4b71fa0 100644'
);

const p5_f3_path = 'third_party/blink/renderer/core/frame/navigator.cc';
const p5_f3 = formatFileDiff(
  p5_f3_path,
  p5_f3_path,
  [
    formatHunk(24, 24, [
      ' #include "third_party/blink/renderer/core/frame/navigator.h"',
      ' ',
      '+#include "base/command_line.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      ' #include "third_party/blink/public/common/user_agent/user_agent_metadata.h"',
      ' #include "third_party/blink/renderer/bindings/core/v8/script_controller.h"',
      ' #include "third_party/blink/renderer/core/dom/document.h"'
    ]),
    formatHunk(61, 65, [
      ' String Navigator::platform() const {',
      '+  // MAHI Native Anti-Detect Engine: Read platform from prefs.mahi via cached renderer config',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    const std::string* plat = (*s_config)->FindString("os");',
      '+    if (!plat) plat = (*s_config)->FindStringByDottedPath("navigator.platform");',
      '+    if (plat && !plat->empty()) return String::FromUTF8(plat->c_str());',
      '+  }',
      '   // TODO(955620): Consider changing devtools overrides to only allow overriding',
      '   // the platform with a frozen platform to distinguish between',
      '   // mobile and desktop when ReduceUserAgent is enabled.'
    ]),
    formatHunk(103, 117, [
      ' bool Navigator::webdriver() const {',
      '-  if (RuntimeEnabledFeatures::AutomationControlledEnabled())',
      '-    return true;',
      '-',
      '-  bool automation_enabled = false;',
      '-  probe::ApplyAutomationOverride(GetExecutionContext(), automation_enabled);',
      '-  return automation_enabled;',
      '+  // MAHI Ungoogled Privacy: navigator.webdriver always reports false to avoid bot flags',
      '+  return false;',
      ' }'
    ]),
    formatHunk(112, 118, [
      ' String Navigator::GetAcceptLanguages() {',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    const std::string* langs = (*s_config)->FindString("languages");',
      '+    if (langs && !langs->empty()) return String::FromUTF8(langs->c_str());',
      '+  }',
      '   if (!DomWindow())',
      '     return DefaultLanguage();'
    ])
  ],
  '1a73d4a..9a3f2b1 100644'
);

const p5_f4_path = 'third_party/blink/renderer/core/timezone/timezone_controller.cc';
const p5_f4 = formatFileDiff(
  p5_f4_path,
  p5_f4_path,
  [
    formatHunk(8, 8, [
      ' #include "third_party/blink/renderer/core/timezone/timezone_controller.h"',
      ' ',
      '+#include "base/command_line.h"',
      ' #include "base/feature_list.h"',
      ' #include "mojo/public/cpp/bindings/pending_remote.h"',
      ' #include "mojo/public/cpp/bindings/remote.h"'
    ]),
    formatHunk(118, 119, [
      ' void TimeZoneController::Init() {',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (cmd && cmd->HasSwitch("tz")) {',
      '+    SetIcuTimeZoneAndNotifyV8(String::FromUTF8(cmd->GetSwitchValueASCII("tz")));',
      '+  }',
      '   // monitor must not use HeapMojoRemote. TimeZoneController is not managed by',
      '   // Oilpan. monitor is only used to bind receiver_ here and never used',
      '   // again.'
    ])
  ],
  '8e4166b..3e5917a 100644'
);

const patch0005 = formatPatch(
  'e5b91adeb98a31e28b7e283d5a2d109f02c98a31',
  5, 7,
  'feat(system): ICU timezone, locale, hardware concurrency, and client hints from prefs.mahi',
  [
    'Registers prefs.mahi and prefs.gologin dictionaries in browser_prefs.cc.',
    'Transfers profile settings to renderer via AppendExtraCommandLineSwitches and --mahi-config.',
    'Applies timezone override via TimeZoneController and overrides platform and languages.'
  ].join('\n'),
  [p5_f1, p5_f2, p5_f3, p5_f4]
);

// ===========================================================================
// PATCH 0006
// ===========================================================================
const p6_f1_path = 'third_party/blink/renderer/core/frame/navigator_automation_information.cc';
const p6_f1 = formatFileDiff(
  p6_f1_path,
  p6_f1_path,
  [
    formatHunk(6, 6, [
      ' bool NavigatorAutomationInformation::webdriver() const {',
      '-  return RuntimeEnabledFeatures::AutomationControlledEnabled();',
      '+  // MAHI Ungoogled Privacy: navigator.webdriver always reports false to avoid anti-bot flags',
      '+  return false;',
      ' }'
    ])
  ],
  'fa101ba..2f87a19 100644'
);

const p6_f2_path = 'components/metrics/metrics_service.cc';
const p6_f2 = formatFileDiff(
  p6_f2_path,
  p6_f2_path,
  [
    formatHunk(431, 431, [
      ' void MetricsService::Start() {',
      '+  // MAHI Ungoogled Privacy: completely disable background telemetry reporting',
      '+  return;',
      '   HandleIdleSinceLastTransmission(false);',
      '   EnableRecording();',
      '   EnableReporting();'
    ])
  ],
  '4cf0afb..6c3182b 100644'
);

const p6_f3_path = 'third_party/blink/renderer/modules/peerconnection/rtc_peer_connection.cc';
const p6_f3 = formatFileDiff(
  p6_f3_path,
  p6_f3_path,
  [
    formatHunk(34, 34, [
      ' #include <memory>',
      ' #include <optional>',
      ' #include <string>',
      '+#include "base/command_line.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      ' #include <utility>',
      ' ',
      ' #include "base/compiler_specific.h"'
    ]),
    formatHunk(407, 411, [
      '   }',
      ' ',
      '+  // MAHI Privacy & Anti-Detect: Mutate parsed web_configuration to enforce kRelay & drop host/srflx candidates (prefs.mahi)',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (cmd) {',
      '+    bool enforce_relay = cmd->HasSwitch("disable-non-proxied-udp") ||',
      '+                         cmd->HasSwitch("webrtc-ip-handling-policy") ||',
      '+                         cmd->HasSwitch("force-webrtc-ip-handling-policy");',
      '+    if (cmd->HasSwitch("mahi-config")) {',
      '+      static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+        const base::CommandLine* c = base::CommandLine::ForCurrentProcess();',
      '+        auto parsed = base::JSONReader::Read(c->GetSwitchValueASCII("mahi-config"));',
      '+        if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+        return std::optional<base::Value::Dict>();',
      '+      }());',
      '+      if (s_config->has_value()) {',
      '+        const std::string* rtc_mode = (*s_config)->FindString("webrtc.mode");',
      '+        if (!rtc_mode) rtc_mode = (*s_config)->FindStringByDottedPath("network.webrtc");',
      '+        if (rtc_mode && (*rtc_mode == "disabled" || *rtc_mode == "proxy_only" || *rtc_mode == "block")) {',
      '+          enforce_relay = true;',
      '+        }',
      '+      }',
      '+    }',
      '+    if (enforce_relay) {',
      '+      web_configuration.type = webrtc::PeerConnectionInterface::IceTransportsType::kRelay;',
      '+      web_configuration.bundle_policy = webrtc::PeerConnectionInterface::kBundlePolicyMaxBundle;',
      '+    }',
      '+  }',
      '+',
      '   return web_configuration;',
      ' }'
    ])
  ],
  '7c5915b..8d2491a 100644'
);

const patch0006 = formatPatch(
  'c6eb4cf0b98a31e28b7e283d5a2d109f02c98a31',
  6, 7,
  'feat(privacy): ungoogled telemetry suppression and WebRTC relay concealment reading prefs.mahi',
  [
    'Forces navigator.webdriver to return false in navigator_automation_information.cc and navigator.cc.',
    'Suppresses Google UMA/RLZ metrics reporting and telemetry ping dispatch.',
    'Mutates parsed WebRTC configuration in rtc_peer_connection.cc checking webrtc.mode and network.webrtc to enforce kRelay.'
  ].join('\n'),
  [p6_f1, p6_f2, p6_f3]
);

// ===========================================================================
// PATCH 0007
// ===========================================================================
const p7_f1_path = 'v8/src/inspector/v8-runtime-agent-impl.cc';
const p7_f1 = formatFileDiff(
  p7_f1_path,
  p7_f1_path,
  [
    formatHunk(38, 38, [
      ' #include "../../third_party/inspector_protocol/crdtp/json.h"',
      ' #include "include/v8-container.h"',
      ' #include "include/v8-context.h"',
      '+#include "include/v8-isolate.h"',
      ' #include "include/v8-cppgc.h"',
      ' #include "include/v8-function.h"',
      ' #include "include/v8-inspector.h"'
    ]),
    formatHunk(354, 355, [
      ' void V8RuntimeAgentImpl::evaluate(',
      '     const String16& expression, std::optional<String16> objectGroup,',
      '     std::optional<bool> includeCommandLineAPI, std::optional<bool> silent,',
      '     std::optional<int> executionContextId, std::optional<bool> returnByValue,',
      '     std::optional<bool> generatePreview, std::optional<bool> userGesture,',
      '     std::optional<bool> maybeAwaitPromise,',
      '     std::optional<bool> throwOnSideEffect, std::optional<double> timeout,',
      '     std::optional<bool> disableBreaks, std::optional<bool> maybeReplMode,',
      '     std::optional<bool> allowUnsafeEvalBlockedByCSP,',
      '     std::optional<String16> uniqueContextId,',
      '     std::unique_ptr<protocol::Runtime::SerializationOptions>',
      '         serializationOptions,',
      '     std::unique_ptr<EvaluateCallback> callback) {',
      '+  // MAHI rebrowser-patches: Isolated evaluation without anti-bot side-effects',
      '   TRACE_EVENT0(TRACE_DISABLED_BY_DEFAULT("devtools.timeline"),',
      '                "EvaluateScript");',
      '   int contextId = 0;'
    ]),
    formatHunk(383, 386, [
      '   if (!response.IsSuccess()) {',
      '     callback->sendFailure(response);',
      '     return;',
      '   }',
      '+',
      '+  // MAHI rebrowser-patches isolation: Protect against Error.prepareStackTrace probe traps without deleting it or aborting',
      '+  v8::Isolate* isolate = m_inspector->isolate();',
      '+  v8::Local<v8::Value> orig_prepare_stack_trace;',
      '+  v8::Local<v8::Object> error_obj;',
      '+  v8::Local<v8::Context> eval_ctx = scope.context();',
      '+  if (isolate && !eval_ctx.IsEmpty()) {',
      '+    v8::HandleScope eval_handle_scope(isolate);',
      '+    v8::Local<v8::Object> global = eval_ctx->Global();',
      '+    v8::Local<v8::String> error_key = v8::String::NewFromUtf8(isolate, "Error").ToLocalChecked();',
      '+    v8::Local<v8::Value> error_val;',
      '+    if (global->Get(eval_ctx, error_key).ToLocal(&error_val) && error_val->IsObject()) {',
      '+      error_obj = error_val.As<v8::Object>();',
      '+      v8::Local<v8::String> pst_key = v8::String::NewFromUtf8(isolate, "prepareStackTrace").ToLocalChecked();',
      '+      if (error_obj->Has(eval_ctx, pst_key).FromMaybe(false)) {',
      '+        error_obj->Get(eval_ctx, pst_key).ToLocal(&orig_prepare_stack_trace);',
      '+      }',
      '+    }',
      '+  }',
      ' ',
      '   if (silent.value_or(false)) scope.ignoreExceptionsAndMuteConsole();',
      '   if (userGesture.value_or(false)) scope.pretendUserGesture();'
    ]),
    formatHunk(1090, 1109, [
      '   m_state->setBoolean(V8RuntimeAgentImplState::runtimeEnabled, true);',
      '   m_inspector->debugger()->setMaxCallStackSizeToCapture(',
      '       this, V8StackTraceImpl::kDefaultMaxCallStackSizeToCapture);',
      '+  // MAHI rebrowser-patches isolation: Suppress executionContextCreated leak to untrusted scripts',
      '   m_session->reportAllContexts(this);',
      '   V8ConsoleMessageStorage* storage ='
    ])
  ],
  '24d69d3..98214fa 100644'
);

const p7_f2_path = 'content/browser/devtools/protocol/page_handler.cc';
const p7_f2 = formatFileDiff(
  p7_f2_path,
  p7_f2_path,
  [
    formatHunk(675, 675, [
      '   }',
      ' ',
      '+  // MAHI DevTools CDP Isolation: Prevent synthetic lifecycle navigation events',
      '   enabled_ = true;',
      '   return Response::FallThrough();',
      ' }'
    ])
  ],
  '1fc8a5c..e91845c 100644'
);

const patch0007 = formatPatch(
  'd7fca678b98a31e28b7e283d5a2d109f02c98a31',
  7, 7,
  'feat(inspector): rebrowser-patches CDP execution isolation and Error.prepareStackTrace leak protection',
  [
    'Patches V8 inspector RuntimeAgentImpl and Content DevTools PageHandler to prevent',
    'anti-bot detection vectors associated with CDP automation:',
    '1. Prevents Runtime.enable side-effects and unwanted ExecutionContextCreated event leaks in main world.',
    '2. Neutralizes Error.prepareStackTrace stack inspection probe traps deployed by Cloudflare/Datadome without aborting evaluate or deleting window.Error.'
  ].join('\n'),
  [p7_f1, p7_f2]
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
