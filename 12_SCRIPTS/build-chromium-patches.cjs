const fs = require('fs');
const path = require('path');
const { formatHunk, formatFileDiff, formatPatch, validatePatch } = require('./generate-chromium-patches.cjs');

const outDir = path.resolve('14_ENGINE_PATCHES/chromium-138');

// ===========================================================================
// PATCH 0001: 2D Canvas Skia Readout Perturbation
// ===========================================================================
const p1_f1_path = 'third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.cc';
const p1_f1 = formatFileDiff(
  p1_f1_path,
  p1_f1_path,
  [
    formatHunk(5, 5, [
      ' #include "third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.h"',
      ' ',
      '+#include <algorithm>',
      ' #include <cmath>',
      ' #include <cstdint>',
      ' #include <cstdlib>'
    ]),
    formatHunk(23, 24, [
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
    formatHunk(594, 600, [
      '     if (!read_pixels_successful) {',
      '       SkIRect bounds =',
      '           snapshot->PaintImageForCurrentFrame().GetSkImageInfo().bounds();',
      '       DCHECK(!bounds.intersect(SkIRect::MakeXYWH(sx, sy, sw, sh)));',
      '     }',
      '   }',
      ' ',
      '+  // MAHI Native Anti-Detect Engine: Read prefs.mahi via cached renderer config',
      '+  if (image_data) {',
      '+    base::span<uint8_t> raw_bytes = image_data->RawByteSpan();',
      '+    if (!raw_bytes.empty()) {',
      '+      static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+        const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+        if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+        auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+        if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+        return std::optional<base::Value::Dict>();',
      '+      }());',
      '+      if (s_config->has_value()) {',
      '+        const base::Value::Dict& root = **s_config;',
      '+        const std::string* mode = root.FindString("canvasMode");',
      '+        if (mode && *mode != "off") {',
      '+          double noise_val = root.FindDouble("canvasNoise").value_or(0.00001);',
      '+          int cnt_pixels = root.FindInt("canvasCntPixels").value_or(10);',
      '+          unsigned char* pixels = raw_bytes.data();',
      '+          size_t len = raw_bytes.size();',
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
  1, 8,
  'feat(canvas): skia 2d readback and toDataURL hash perturbation reading prefs.mahi',
  [
    'Directly intercepts BaseRenderingContext2D::getImageDataInternal in Blink',
    'and ImageDataBuffer::ToDataURL to apply deterministic persistent hash noise',
    'read from Default/Preferences -> prefs.mahi.canvas configuration.'
  ].join('\n'),
  [p1_f1, p1_f2]
);

// ===========================================================================
// PATCH 0002: WebGL Vendor/Renderer Spoofing & WebGPU Adapter Masking
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
      '+          const std::string* r = root.FindStringByDottedPath("webgl.metadata.renderer");',
      '+          if (!r) r = root.FindString("webglRenderer");',
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
      '+          const std::string* v = root.FindStringByDottedPath("webgl.metadata.vendor");',
      '+          if (!v) v = root.FindString("webglVendor");',
      '+          if (!v) v = root.FindString("gpuVendor");',
      '+          if (v && !v->empty()) {',
      '+            return WebGLAny(script_state, String::FromUTF8(v->c_str()));',
      '+          }',
      '+        }',
      '         if (IdentifiabilityStudySettings::Get()->ShouldSampleType(',
      '                 blink::IdentifiableSurface::Type::kWebGLParameter)) {',
      '           RecordIdentifiableGLParameterDigest('
    ]),
    formatHunk(5086, 5121, [
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
      '+  if (data && !buffer.has_value() && pixels) {',
      '+    static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+      const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+      if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+      auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+      if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+      return std::optional<base::Value::Dict>();',
      '+    }());',
      '+    if (s_config->has_value()) {',
      '+      const base::Value::Dict& root = **s_config;',
      '+      bool noise_enable = root.FindBool("webgl_noise_enable").value_or(false);',
      '+      const std::string* mode = root.FindString("webglMode");',
      '+      if (noise_enable || (mode && *mode != "off")) {',
      '+        double noise_val = root.FindDouble("webgl_noise_value").value_or(0.00001);',
      '+        uint8_t* byte_ptr = static_cast<uint8_t*>(data);',
      '+        size_t total_len = pixels->byteLength();',
      '+        size_t offset_val = offset_in_bytes.ValueOrDie();',
      '+        size_t byte_len = (total_len > offset_val) ? (total_len - offset_val) : 0;',
      '+        uint32_t seed = static_cast<uint32_t>(noise_val * 1000000.0) ^ (width * 37 + height);',
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
    formatHunk(124, 128, [
      ' GPUAdapterInfo* GPUAdapter::CreateAdapterInfoForAdapter() {',
      '+  // MAHI Native Anti-Detect Engine: Read prefs.mahi via cached renderer config for WebGPU adapter spoofing',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    const base::Value::Dict* gpu_info = (*s_config)->FindDictByDottedPath("webGpu.supportedAdapters.highPerformance.info");',
      '+    if (gpu_info) {',
      '+      const std::string* v = gpu_info->FindString("vendor");',
      '+      const std::string* a = gpu_info->FindString("architecture");',
      '+      const std::string* d = gpu_info->FindString("device");',
      '+      const std::string* desc = gpu_info->FindString("description");',
      '+      if (v) vendor_ = String::FromUTF8(v->c_str());',
      '+      if (a) architecture_ = String::FromUTF8(a->c_str());',
      '+      if (d) device_ = String::FromUTF8(d->c_str());',
      '+      if (desc) description_ = String::FromUTF8(desc->c_str());',
      '+    }',
      '+  }',
      '   GPUAdapterInfo* info;',
      '   if (RuntimeEnabledFeatures::WebGPUDeveloperFeaturesEnabled()) {'
    ])
  ],
  '7a0f633..8d15c4a 100644'
);

const patch0002 = formatPatch(
  'a2db4c25b98a31e28b7e283d5a2d109f02c98a31',
  2, 8,
  'feat(webgl): unmasked vendor/renderer spoofing and WebGPU adapter masking reading prefs.mahi',
  [
    'Spoofs WebGL UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL strings in Blink.',
    'Adds deterministic readout noise to WebGL readPixels and masks WebGPU GPUAdapterInfo',
    'reading Default/Preferences -> prefs.mahi.webgl and gpu parameters.'
  ].join('\n'),
  [p2_f1, p2_f2]
);

// ===========================================================================
// PATCH 0003: WebAudio Micro-Jitter (Per-Profile Persistent Seed)
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
      '+  void ApplyMahiNoiseToChannel(unsigned channel_index) const;',
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
    formatHunk(32, 32, [
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
      '+void AudioBuffer::ApplyMahiNoiseToChannel(unsigned channel_index) const {',
      '+  if (channel_index >= channels_.size() || !channels_[channel_index]) return;',
      '+  if (mahi_noise_channels_mask_ & (1u << (channel_index % 32))) return;',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    const base::Value::Dict& root = **s_config;',
      '+    bool noise_enabled = true;',
      '+    if (auto enabled = root.FindBoolByDottedPath("audioContext.enable")) {',
      '+      noise_enabled = *enabled;',
      '+    } else if (auto legacy = root.FindBool("audioNoise")) {',
      '+      noise_enabled = *legacy;',
      '+    }',
      '+    double noise_val = root.FindDoubleByDottedPath("audioContext.noiseValue").value_or(0.00001);',
      '+    if (noise_enabled) {',
      '+      float* data = channels_[channel_index]->Data();',
      '+      size_t len = channels_[channel_index]->length();',
      '+      uint32_t seed = static_cast<uint32_t>(noise_val * 1000000.0) ^ (channel_index * 1337);',
      '+      for (size_t i = 0; i < len; i += 100) {',
      '+        uint32_t j = base::PersistentHash(&seed, sizeof(seed)) % 5;',
      '+        float delta = (static_cast<float>(j) - 2.0f) * 1e-7f;',
      '+        data[i] += delta;',
      '+        seed += 7;',
      '+      }',
      '+    }',
      '+  }',
      '+  mahi_noise_channels_mask_ |= (1u << (channel_index % 32));',
      '+}',
      '+',
      ' NotShared<DOMFloat32Array> AudioBuffer::getChannelData(unsigned channel_index) {',
      '   if (channel_index >= channels_.size()) {',
      '     return NotShared<DOMFloat32Array>(nullptr);',
      '   }',
      ' ',
      '+  ApplyMahiNoiseToChannel(channel_index);',
      '   return NotShared<DOMFloat32Array>(channels_[channel_index].Get());',
      ' }'
    ]),
    formatHunk(231, 270, [
      ' void AudioBuffer::copyFromChannel(NotShared<DOMFloat32Array> destination,',
      '                                   int32_t channel_number,',
      '                                   size_t buffer_offset,',
      '                                   ExceptionState& exception_state) {',
      '   if (channel_number < 0 ||',
      '       static_cast<uint32_t>(channel_number) >= channels_.size()) {',
      '     exception_state.ThrowDOMException(',
      '         DOMExceptionCode::kIndexSizeError,',
      '         ExceptionMessages::IndexOutsideRange(',
      '             "channelNumber", channel_number, 0,',
      '             ExceptionMessages::kInclusiveBound,',
      '             static_cast<int32_t>(channels_.size() - 1),',
      '             ExceptionMessages::kInclusiveBound));',
      ' ',
      '     return;',
      '   }',
      ' ',
      '+  ApplyMahiNoiseToChannel(static_cast<unsigned>(channel_number));',
      '   base::span<const float> src = channels_[channel_number].Get()->AsSpan();',
      '   base::span<float> dst = destination->AsSpan();'
    ])
  ],
  '1708409..6e45f91 100644'
);

const patch0003 = formatPatch(
  'c3e71708b98a31e28b7e283d5a2d109f02c98a31',
  3, 8,
  'feat(webaudio): acoustic fingerprint micro-jitter reading prefs.mahi',
  [
    'Applies deterministic micro-jitter to AudioBuffer channel data in Blink',
    'reading Default/Preferences -> prefs.mahi.audio configuration without audible artifacts.'
  ].join('\n'),
  [p3_f1, p3_f2]
);

// ===========================================================================
// PATCH 0004: ClientRects Subpixel Jitter & FontCache Whitelist Masking
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
    formatHunk(2992, 3015, [
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
    formatHunk(33, 33, [
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
      '+namespace {',
      '+bool IsMahiFontAllowed(const AtomicString& family) {',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (!cmd || !cmd->HasSwitch("font-masking-mode")) return true;',
      '+  std::string mode = cmd->GetSwitchValueASCII("font-masking-mode");',
      '+  if (mode != "1" && mode != "2" && mode != "whitelist") return true;',
      '+  std::string raw_list = cmd->GetSwitchValueASCII("font-masking-list");',
      '+  std::vector<std::string> allowed_fonts;',
      '+  if (raw_list.find(\';\') != std::string::npos) {',
      '+    allowed_fonts = base::SplitString(raw_list, ";", base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY);',
      '+  } else {',
      '+    allowed_fonts = base::SplitString(raw_list, ",", base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY);',
      '+  }',
      '+  if (allowed_fonts.empty() || family.empty()) return true;',
      '+  std::string font_name = family.Utf8();',
      '+  for (const auto& allowed : allowed_fonts) {',
      '+    if (base::EqualsCaseInsensitiveASCII(font_name, allowed)) return true;',
      '+  }',
      '+  return false;',
      '+}',
      '+}  // namespace',
      '+',
      ' const SimpleFontData* FontCache::GetFontData(',
      '     const FontDescription& font_description,',
      '     const AtomicString& family,',
      '     AlternateFontName altername_font_name) {',
      '+  if (!IsMahiFontAllowed(family)) return nullptr;',
      '   if (const FontPlatformData* platform_data = GetFontPlatformData(',
      '           font_description,',
      '           FontFaceCreationParams('
    ]),
    formatHunk(212, 238, [
      ' bool FontCache::IsPlatformFamilyMatchAvailable(',
      '     const FontDescription& font_description,',
      '     const AtomicString& family) {',
      '+  if (!IsMahiFontAllowed(family)) return false;',
      '   return GetFontPlatformData(',
      '       font_description,',
      '       FontFaceCreationParams(AdjustFamilyNameToAvoidUnsupportedFonts(family)),'
    ]),
    formatHunk(221, 248, [
      ' bool FontCache::IsPlatformFontUniqueNameMatchAvailable(',
      '     const FontDescription& font_description,',
      '     const AtomicString& unique_font_name) {',
      '   // Return early to avoid attempting fallback.',
      '   if (unique_font_name.empty()) {',
      '     return false;',
      '   }',
      ' ',
      '+  if (!IsMahiFontAllowed(unique_font_name)) return false;',
      '   return GetFontPlatformData(font_description,',
      '                              FontFaceCreationParams(unique_font_name),',
      '                              AlternateFontName::kLocalUniqueFace);'
    ])
  ],
  '34603fc..a189f72 100644'
);

const patch0004 = formatPatch(
  'd4e83460b98a31e28b7e283d5a2d109f02c98a31',
  4, 8,
  'feat(layout): clientrects jitter and font-cache masking reading prefs.mahi',
  [
    'Reads Default/Preferences -> prefs.mahi.client_rects_noise_enable and font masking options.',
    'Applies sub-pixel jitter to getBoundingClientRect and getClientRects DOMRect values.',
    'Restricts system font queries via FontCache whitelist splitting on \';\' matching launcher.ts flags.'
  ].join('\n'),
  [p4_f1, p4_f2]
);

// ===========================================================================
// PATCH 0005: ICU Timezone, Locale, Hardware Concurrency, and Device Memory
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
      '+  registry->RegisterDictionaryPref("mahi");',
      '+  registry->RegisterDictionaryPref("gologin");',
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
    formatHunk(20, 20, [
      ' #include "base/command_line.h"',
      '+#include "base/json/json_writer.h"',
      ' #include "base/containers/contains.h"'
    ]),
    formatHunk(2628, 2629, [
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
      '+      if (prefs->HasPrefPath("mahi")) {',
      '+        mahi_prefs = &prefs->GetDict("mahi");',
      '+      } else if (prefs->HasPrefPath("gologin")) {',
      '+        mahi_prefs = &prefs->GetDict("gologin");',
      '+      }',
      '+      if (mahi_prefs) {',
      '+        std::string json_str;',
      '+        if (base::JSONWriter::Write(*mahi_prefs, &json_str)) {',
      '+          command_line->AppendSwitchASCII("mahi-config", json_str);',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      '+  if (base::CommandLine::ForCurrentProcess()->HasSwitch("mahi-cdp-isolated")) {',
      '+    command_line->AppendSwitch("mahi-cdp-isolated");',
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
      '+    const std::string* plat = (*s_config)->FindStringByDottedPath("navigator.platform");',
      '+    if (!plat) plat = (*s_config)->FindString("os");',
      '+    if (plat && !plat->empty()) return String::FromUTF8(plat->c_str());',
      '+  }',
      '   // TODO(955620): Consider changing devtools overrides to only allow overriding',
      '   // the platform with a frozen platform to distinguish between',
      '   // mobile and desktop when ReduceUserAgent is enabled.'
    ]),
    formatHunk(103, 121, [
      ' bool Navigator::webdriver() const {',
      '-  if (RuntimeEnabledFeatures::AutomationControlledEnabled())',
      '-    return true;',
      '-',
      '-  bool automation_enabled = false;',
      '-  probe::ApplyAutomationOverride(GetExecutionContext(), automation_enabled);',
      '-  return automation_enabled;',
      '+  // MAHI Ungoogled Privacy: navigator.webdriver always reports false to avoid bot flags',
      '+  return false;',
      ' }',
      ' ',
      ' String Navigator::GetAcceptLanguages() {',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    const std::string* header = (*s_config)->FindString("langHeader");',
      '+    if (header && !header->empty()) return String::FromUTF8(header->c_str());',
      '+    const base::Value::List* langs_list = (*s_config)->FindList("languages");',
      '+    if (langs_list && !langs_list->empty()) {',
      '+      std::string joined_langs;',
      '+      for (size_t i = 0; i < langs_list->size(); ++i) {',
      '+        if ((*langs_list)[i].is_string()) {',
      '+          if (!joined_langs.empty()) joined_langs += ",";',
      '+          joined_langs += (*langs_list)[i].GetString();',
      '+        }',
      '+      }',
      '+      if (!joined_langs.empty()) return String::FromUTF8(joined_langs.c_str());',
      '+    }',
      '+    const std::string* langs = (*s_config)->FindString("languages");',
      '+    if (langs && !langs->empty()) return String::FromUTF8(langs->c_str());',
      '+  }',
      '   if (!DomWindow())',
      '     return DefaultLanguage();'
    ])
  ],
  '1a73d4a..9a3f2b1 100644'
);

const p5_f4_path = 'third_party/blink/renderer/core/events/navigator_events.cc';
const p5_f4 = formatFileDiff(
  p5_f4_path,
  p5_f4_path,
  [
    formatHunk(34, 34, [
      ' #include "third_party/blink/renderer/core/frame/local_frame.h"',
      ' #include "third_party/blink/renderer/core/frame/navigator.h"',
      ' #include "third_party/blink/renderer/core/frame/settings.h"',
      '+#include "base/command_line.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      ' ',
      ' namespace blink {',
      ' '
    ]),
    formatHunk(40, 44, [
      ' int32_t NavigatorEvents::maxTouchPoints(Navigator& navigator) {',
      '+  // MAHI Native Anti-Detect Engine: Read maxTouchPoints from prefs.mahi via cached renderer config',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    std::optional<int> tp = (*s_config)->FindIntByDottedPath("navigator.max_touch_points");',
      '+    if (tp) return static_cast<int32_t>(*tp);',
      '+  }',
      '   LocalDOMWindow* window = navigator.DomWindow();',
      '   return window ? window->GetFrame()->GetSettings()->GetMaxTouchPoints() : 0;'
    ])
  ],
  'a575617..b9472e1 100644'
);

const p5_f5_path = 'third_party/blink/renderer/core/execution_context/navigator_base.cc';
const p5_f5 = formatFileDiff(
  p5_f5_path,
  p5_f5_path,
  [
    formatHunk(11, 11, [
      ' #include "third_party/blink/renderer/core/frame/navigator_concurrent_hardware.h"',
      ' #include "third_party/blink/renderer/core/probe/core_probes.h"',
      ' #include "third_party/blink/renderer/platform/wtf/text/string_builder.h"',
      '+#include "base/command_line.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      '+#include "third_party/blink/public/common/user_agent/user_agent_metadata.h"',
      ' ',
      ' #if !BUILDFLAG(IS_MAC) && !BUILDFLAG(IS_WIN)'
    ]),
    formatHunk(53, 58, [
      ' String NavigatorBase::platform() const {',
      '+  // MAHI Native Anti-Detect Engine: Read platform from prefs.mahi via cached renderer config',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    const std::string* plat = (*s_config)->FindStringByDottedPath("navigator.platform");',
      '+    if (!plat) plat = (*s_config)->FindString("os");',
      '+    if (plat && !plat->empty()) return String::FromUTF8(plat->c_str());',
      '+  }',
      '   ExecutionContext* execution_context = GetExecutionContext();',
      ' '
    ]),
    formatHunk(95, 113, [
      ' UserAgentMetadata NavigatorBase::GetUserAgentMetadata() const {',
      '   ExecutionContext* execution_context = GetExecutionContext();',
      '-  return execution_context ? execution_context->GetUserAgentMetadata()',
      '-                           : blink::UserAgentMetadata();',
      '+  UserAgentMetadata metadata = execution_context',
      '+                                   ? execution_context->GetUserAgentMetadata()',
      '+                                   : blink::UserAgentMetadata();',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    const base::Value::Dict& cfg = **s_config;',
      '+    const std::string* plat = cfg.FindStringByDottedPath("navigator.platform");',
      '+    if (!plat) plat = cfg.FindString("os");',
      '+    if (plat && !plat->empty()) {',
      '+      if (plat->find("Win") != std::string::npos) {',
      '+        metadata.platform = "Windows";',
      '+        metadata.platform_version = "15.0.0";',
      '+      } else if (plat->find("Mac") != std::string::npos) {',
      '+        metadata.platform = "macOS";',
      '+        metadata.platform_version = "15.0.0";',
      '+      } else if (plat->find("Linux") != std::string::npos) {',
      '+        metadata.platform = "Linux";',
      '+        metadata.platform_version = "6.5.0";',
      '+      } else if (plat->find("Android") != std::string::npos) {',
      '+        metadata.platform = "Android";',
      '+        metadata.platform_version = "14.0.0";',
      '+      } else {',
      '+        metadata.platform = *plat;',
      '+      }',
      '+    }',
      '+    const std::string* os_ver = cfg.FindString("osVersion");',
      '+    if (os_ver && !os_ver->empty()) {',
      '+      metadata.platform_version = *os_ver;',
      '+    }',
      '+    std::optional<bool> mobile_enable = cfg.FindBoolByDottedPath("mobile.enable");',
      '+    if (!mobile_enable) mobile_enable = cfg.FindBool("isMobile");',
      '+    if (mobile_enable.has_value()) {',
      '+      metadata.mobile = *mobile_enable;',
      '+    }',
      '+    const std::string* arch = cfg.FindString("hardwareArchitecture");',
      '+    if (!arch) arch = cfg.FindString("cpuArchitecture");',
      '+    if (arch && !arch->empty()) {',
      '+      metadata.architecture = *arch;',
      '+    } else {',
      '+      bool is_m1 = cfg.FindBool("is_m1").value_or(false);',
      '+      if (is_m1 || (plat && plat->find("Mac") != std::string::npos && cfg.FindBool("isAppleSilicon").value_or(false))) {',
      '+        metadata.architecture = "arm";',
      '+      } else {',
      '+        metadata.architecture = "x86";',
      '+      }',
      '+    }',
      '+    metadata.bitness = "64";',
      '+    const std::string* ua = cfg.FindString("userAgent");',
      '+    if (ua && !ua->empty()) {',
      '+      size_t pos = ua->find("Chrome/");',
      '+      if (pos != std::string::npos) {',
      '+        size_t start = pos + 7;',
      '+        size_t end = ua->find(\' \', start);',
      '+        if (end == std::string::npos) end = ua->length();',
      '+        std::string full_ver = ua->substr(start, end - start);',
      '+        if (!full_ver.empty()) {',
      '+          metadata.full_version = full_ver;',
      '+          size_t dot_pos = full_ver.find(\'.\');',
      '+          std::string major_ver = (dot_pos != std::string::npos) ? full_ver.substr(0, dot_pos) : full_ver;',
      '+          UserAgentBrandList major_brands;',
      '+          UserAgentBrandList full_brands;',
      '+          major_brands.emplace_back("Chromium", major_ver);',
      '+          major_brands.emplace_back("Not/A)Brand", "24");',
      '+          major_brands.emplace_back("Google Chrome", major_ver);',
      '+          full_brands.emplace_back("Chromium", full_ver);',
      '+          full_brands.emplace_back("Not/A)Brand", "24.0.0.0");',
      '+          full_brands.emplace_back("Google Chrome", full_ver);',
      '+          metadata.brand_version_list = std::move(major_brands);',
      '+          metadata.brand_full_version_list = std::move(full_brands);',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      '+  return metadata;',
      ' }',
      ' ',
      ' }  // namespace blink'
    ])
  ],
  '64bdfb1..c3182ef 100644'
);

const p5_f6_path = 'third_party/blink/renderer/core/timezone/timezone_controller.cc';
const p5_f6 = formatFileDiff(
  p5_f6_path,
  p5_f6_path,
  [
    formatHunk(6, 6, [
      ' #include "third_party/blink/renderer/core/timezone/timezone_controller.h"',
      ' ',
      '+#include "base/command_line.h"',
      '+#include "base/json/json_reader.h"',
      ' #include "base/feature_list.h"',
      ' #include "mojo/public/cpp/bindings/pending_remote.h"',
      ' #include "mojo/public/cpp/bindings/remote.h"'
    ]),
    formatHunk(118, 120, [
      ' void TimeZoneController::Init() {',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  if (cmd) {',
      '+    String tz_str;',
      '+    if (cmd->HasSwitch("tz")) {',
      '+      std::string val = cmd->GetSwitchValueASCII("tz");',
      '+      if (!val.empty()) {',
      '+        tz_str = String::FromUTF8(val);',
      '+      }',
      '+    } else if (cmd->HasSwitch("mahi-config")) {',
      '+      auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+      if (parsed && parsed->is_dict()) {',
      '+        const std::string* tz = parsed->GetDict().FindStringByDottedPath("timezone.id");',
      '+        if (tz && !tz->empty()) {',
      '+          tz_str = String::FromUTF8(tz->c_str());',
      '+        }',
      '+      }',
      '+    }',
      '+    if (!tz_str.empty()) {',
      '+      SetIcuTimeZoneAndNotifyV8(tz_str);',
      '+      instance().override_timezone_id_ = tz_str;',
      '+    }',
      '+  }',
      '   // monitor must not use HeapMojoRemote. TimeZoneController is not managed by',
      '   // Oilpan. monitor is only used to bind receiver_ here and never used',
      '   // again.'
    ])
  ],
  '8e4166b..3e5917a 100644'
);

const p5_f7_path = 'third_party/blink/renderer/core/frame/navigator_concurrent_hardware.cc';
const p5_f7 = formatFileDiff(
  p5_f7_path,
  p5_f7_path,
  [
    formatHunk(6, 6, [
      ' #include "third_party/blink/renderer/core/frame/navigator_concurrent_hardware.h"',
      ' ',
      '+#include "base/command_line.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      ' #include "base/system/sys_info.h"',
      ' ',
      ' namespace blink {'
    ]),
    formatHunk(12, 16, [
      ' unsigned NavigatorConcurrentHardware::hardwareConcurrency() const {',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    std::optional<int> hc = (*s_config)->FindInt("hardwareConcurrency");',
      '+    if (hc && *hc > 0) return static_cast<unsigned>(*hc);',
      '+  }',
      '   return static_cast<unsigned>(base::SysInfo::NumberOfProcessors());',
      ' }'
    ])
  ],
  'f5c0db2..5a9e2d1 100644'
);

const p5_f8_path = 'third_party/blink/renderer/core/frame/navigator_device_memory.cc';
const p5_f8 = formatFileDiff(
  p5_f8_path,
  p5_f8_path,
  [
    formatHunk(6, 6, [
      ' #include "third_party/blink/renderer/core/frame/navigator_device_memory.h"',
      ' ',
      '+#include "base/command_line.h"',
      '+#include "base/json/json_reader.h"',
      '+#include "base/no_destructor.h"',
      '+#include "base/values.h"',
      ' #include "third_party/blink/public/common/device_memory/approximated_device_memory.h"',
      ' #include "third_party/blink/public/common/privacy_budget/identifiability_metric_builder.h"'
    ]),
    formatHunk(17, 21, [
      ' float NavigatorDeviceMemory::deviceMemory() const {',
      '+  static const base::NoDestructor<std::optional<base::Value::Dict>> s_config([] {',
      '+    const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+    if (!cmd || !cmd->HasSwitch("mahi-config")) return std::optional<base::Value::Dict>();',
      '+    auto parsed = base::JSONReader::Read(cmd->GetSwitchValueASCII("mahi-config"));',
      '+    if (parsed && parsed->is_dict()) return std::make_optional(std::move(parsed->GetDict()));',
      '+    return std::optional<base::Value::Dict>();',
      '+  }());',
      '+  if (s_config->has_value()) {',
      '+    std::optional<double> dm = (*s_config)->FindDouble("deviceMemory");',
      '+    if (!dm) {',
      '+      if (std::optional<int> dm_int = (*s_config)->FindInt("deviceMemory")) {',
      '+        dm = static_cast<double>(*dm_int);',
      '+      }',
      '+    }',
      '+    if (dm && *dm > 0) return static_cast<float>(*dm);',
      '+  }',
      '   return ApproximatedDeviceMemory::GetApproximatedDeviceMemory();',
      ' }'
    ])
  ],
  '2876aad..6b1c8f4 100644'
);

const patch0005 = formatPatch(
  'e5b91adeb98a31e28b7e283d5a2d109f02c98a31',
  5, 8,
  'feat(system): ICU timezone, locale, hardware concurrency, and client hints from prefs.mahi',
  [
    'Registers mahi and gologin dictionaries in browser_prefs.cc.',
    'Transfers profile settings to renderer via AppendExtraCommandLineSwitches and --mahi-config.',
    'Applies timezone override via TimeZoneController, overrides platform, languages, and hardware capacity.'
  ].join('\n'),
  [p5_f1, p5_f2, p5_f3, p5_f4, p5_f5, p5_f6, p5_f7, p5_f8]
);

// ===========================================================================
// PATCH 0006: Ungoogled Privacy, Telemetry Suppression, and WebRTC Relay
// ===========================================================================
const p6_f1_path = 'components/metrics/metrics_service.cc';
const p6_f1 = formatFileDiff(
  p6_f1_path,
  p6_f1_path,
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

const p6_f2_path = 'third_party/blink/renderer/modules/peerconnection/rtc_peer_connection.cc';
const p6_f2 = formatFileDiff(
  p6_f2_path,
  p6_f2_path,
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
      '+        const std::string* rtc_mode = (*s_config)->FindStringByDottedPath("webrtc.mode");',
      '+        if (!rtc_mode) rtc_mode = (*s_config)->FindStringByDottedPath("network.webrtc");',
      '+        bool fill_empty = (*s_config)->FindBoolByDottedPath("webrtc.should_fill_empty_ice_list").value_or(false);',
      '+        if (fill_empty || (rtc_mode && (*rtc_mode == "disabled" || *rtc_mode == "proxy_only" || *rtc_mode == "block" || *rtc_mode == "alerted"))) {',
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
  6, 8,
  'feat(privacy): ungoogled telemetry suppression and WebRTC relay concealment reading prefs.mahi',
  [
    'Forces navigator.webdriver to return false in navigator.cc.',
    'Suppresses Google UMA/RLZ metrics reporting and telemetry ping dispatch.',
    'Mutates parsed WebRTC configuration in rtc_peer_connection.cc checking webrtc.mode, network.webrtc, and should_fill_empty_ice_list to enforce kRelay.'
  ].join('\n'),
  [p6_f1, p6_f2]
);

// ===========================================================================
// PATCH 0007: rebrowser-patches V8 Inspector Isolation
// ===========================================================================
const p7_f1_path = 'v8/src/inspector/v8-runtime-agent-impl.cc';
const p7_f1 = formatFileDiff(
  p7_f1_path,
  p7_f1_path,
  [
    formatHunk(33, 33, [
      ' #include "src/inspector/v8-runtime-agent-impl.h"',
      ' ',
      ' #include <inttypes.h>',
      '+#include <cstdlib>',
      '+#include <cstring>',
      ' ',
      ' #include <memory>',
      ' ',
      ' #include "../../third_party/inspector_protocol/crdtp/json.h"',
      ' #include "include/v8-container.h"',
      ' #include "include/v8-context.h"',
      '+#include "include/v8-isolate.h"',
      ' #include "include/v8-cppgc.h"',
      ' #include "include/v8-function.h"',
      ' #include "include/v8-inspector.h"'
    ]),
    formatHunk(355, 358, [
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
    formatHunk(378, 382, [
      '   InjectedScript::ContextScope scope(m_session, contextId);',
      '   response = scope.initialize();',
      '   if (!response.IsSuccess()) {',
      '     callback->sendFailure(response);',
      '     return;',
      '   }',
      '+',
      '+  // MAHI rebrowser-patches isolation: Protect against Error.prepareStackTrace probe traps without deleting it or aborting',
      '+  v8::Isolate* isolate = m_inspector->isolate();',
      '+  v8::Global<v8::Value> orig_prepare_stack_trace;',
      '+  v8::Global<v8::Object> error_obj;',
      '+  bool had_pst = false;',
      '+  if (isolate && !scope.context().IsEmpty()) {',
      '+    v8::HandleScope eval_handle_scope(isolate);',
      '+    v8::Local<v8::Context> eval_ctx = scope.context();',
      '+    v8::Local<v8::Object> global = eval_ctx->Global();',
      '+    v8::Local<v8::String> error_key = v8::String::NewFromUtf8(isolate, "Error").ToLocalChecked();',
      '+    v8::Local<v8::Value> error_val;',
      '+    if (global->Get(eval_ctx, error_key).ToLocal(&error_val) && error_val->IsObject()) {',
      '+      error_obj.Reset(isolate, error_val.As<v8::Object>());',
      '+      v8::Local<v8::Object> local_error_obj = error_obj.Get(isolate);',
      '+      v8::Local<v8::String> pst_key = v8::String::NewFromUtf8(isolate, "prepareStackTrace").ToLocalChecked();',
      '+      if (local_error_obj->Has(eval_ctx, pst_key).FromMaybe(false)) {',
      '+        v8::Local<v8::Value> local_pst;',
      '+        if (local_error_obj->Get(eval_ctx, pst_key).ToLocal(&local_pst)) {',
      '+          had_pst = true;',
      '+          orig_prepare_stack_trace.Reset(isolate, local_pst);',
      '+          local_error_obj->Set(eval_ctx, pst_key, v8::Undefined(isolate)).Check();',
      '+        }',
      '+      }',
      '+    }',
      '+  }',
      ' ',
      '   if (silent.value_or(false)) scope.ignoreExceptionsAndMuteConsole();',
      '   if (userGesture.value_or(false)) scope.pretendUserGesture();'
    ]),
    formatHunk(417, 449, [
      '     maybeResultValue = v8::debug::EvaluateGlobal(m_inspector->isolate(), source,',
      '                                                  mode, replMode);',
      '   }  // Run microtasks before returning result.',
      '+',
      '+  if (had_pst && !error_obj.IsEmpty() && !orig_prepare_stack_trace.IsEmpty()) {',
      '+    v8::HandleScope restore_scope(isolate);',
      '+    v8::Local<v8::Context> eval_ctx = scope.context();',
      '+    v8::Local<v8::String> pst_key = v8::String::NewFromUtf8(isolate, "prepareStackTrace").ToLocalChecked();',
      '+    v8::Local<v8::Object> local_err = error_obj.Get(isolate);',
      '+    v8::Local<v8::Value> local_pst = orig_prepare_stack_trace.Get(isolate);',
      '+    local_err->Set(eval_ctx, pst_key, local_pst).Check();',
      '+    orig_prepare_stack_trace.Reset();',
      '+    error_obj.Reset();',
      '+  }',
      ' ',
      '   // Re-initialize after running client\'s code, as it could have destroyed',
      '   // context or session.'
    ]),
    formatHunk(1090, 1134, [
      '   m_state->setBoolean(V8RuntimeAgentImplState::runtimeEnabled, true);',
      '   m_inspector->debugger()->setMaxCallStackSizeToCapture(',
      '       this, V8StackTraceImpl::kDefaultMaxCallStackSizeToCapture);',
      '-  m_session->reportAllContexts(this);',
      '+  // MAHI rebrowser-patches isolation: Gate reportAllContexts via inspector state property or MAHI_CDP_ISOLATED',
      '+  bool suppressContextCreated =',
      '+      m_state->booleanProperty("mahiSuppressContextCreated", false);',
      '+  const char* env_isolated = std::getenv("MAHI_CDP_ISOLATED");',
      '+  if (env_isolated && (std::strcmp(env_isolated, "1") == 0 || std::strcmp(env_isolated, "true") == 0)) {',
      '+    suppressContextCreated = true;',
      '+  }',
      '+  if (!suppressContextCreated) {',
      '+    m_session->reportAllContexts(this);',
      '+  }',
      '   V8ConsoleMessageStorage* storage ='
    ]),
    formatHunk(1133, 1185, [
      ' void V8RuntimeAgentImpl::reportExecutionContextCreated(',
      '     InspectedContext* context) {',
      '   if (!m_enabled) return;',
      '+  // MAHI rebrowser-patches isolation: Suppress executionContextCreated leak to prevent detection',
      '+  bool suppressContextCreated =',
      '+      m_state->booleanProperty("mahiSuppressContextCreated", false);',
      '+  const char* env_isolated = std::getenv("MAHI_CDP_ISOLATED");',
      '+  if (env_isolated && (std::strcmp(env_isolated, "1") == 0 || std::strcmp(env_isolated, "true") == 0)) {',
      '+    suppressContextCreated = true;',
      '+  }',
      '+  if (suppressContextCreated) return;',
      '+',
      '   context->setReported(m_session->sessionId(), true);',
      '   std::unique_ptr<protocol::Runtime::ExecutionContextDescription> description =',
      '       protocol::Runtime::ExecutionContextDescription::create()'
    ])
  ],
  '24d69d3..98214fa 100644'
);

const patch0007 = formatPatch(
  'd7fca678b98a31e28b7e283d5a2d109f02c98a31',
  7, 8,
  'feat(inspector): rebrowser-patches V8 inspector execution isolation and Error.prepareStackTrace leak protection',
  [
    'Patches V8 inspector RuntimeAgentImpl to prevent anti-bot detection vectors associated with CDP automation:',
    '1. Prevents Runtime.enable side-effects and unwanted ExecutionContextCreated event leaks via mahiSuppressContextCreated.',
    '2. Neutralizes Error.prepareStackTrace stack inspection probe traps without HandleScope leaks, aborting evaluate, or deleting window.Error.'
  ].join('\n'),
  [p7_f1]
);

// ===========================================================================
// PATCH 0008: rebrowser-patches DevTools Page Handler Isolation
// ===========================================================================
const p8_f1_path = 'content/browser/devtools/protocol/page_handler.cc';
const p8_f1 = formatFileDiff(
  p8_f1_path,
  p8_f1_path,
  [
    formatHunk(14, 14, [
      ' #include <vector>',
      ' ',
      '+#include "base/command_line.h"',
      ' #include "base/functional/bind.h"',
      ' #include "base/location.h"'
    ]),
    formatHunk(656, 657, [
      ' Response PageHandler::Enable(',
      '     std::optional<bool> enable_file_chooser_opened_event) {',
      '+  // MAHI DevTools CDP Isolation: Prevent synthetic lifecycle navigation events',
      '+  const base::CommandLine* cmd = base::CommandLine::ForCurrentProcess();',
      '+  bool suppress_nav = cmd && cmd->HasSwitch("mahi-cdp-isolated");',
      '-  if (!enabled_ && !host_->GetParentOrOuterDocument() &&',
      '+  if (!suppress_nav && !enabled_ && !host_->GetParentOrOuterDocument() &&',
      '       host_->frame_tree_node() &&',
      '       host_->frame_tree_node()->navigation_request()) {'
    ])
  ],
  '1fc8a5c..e91845c 100644'
);

const patch0008 = formatPatch(
  'e89b1fc8b98a31e28b7e283d5a2d109f02c98a31',
  8, 8,
  'feat(devtools): rebrowser-patches PageHandler navigation lifecycle isolation',
  [
    'Patches Content DevTools PageHandler::Enable to suppress synthetic FrameStartedNavigating',
    'lifecycle events when running in isolated CDP mode (--mahi-cdp-isolated).'
  ].join('\n'),
  [p8_f1]
);

// Validate and write all 8 patches
const allPatches = [
  { name: '0001-mahi-canvas-skia-fingerprint-noise.patch', content: patch0001 },
  { name: '0002-mahi-webgl-webgpu-metadata-and-noise.patch', content: patch0002 },
  { name: '0003-mahi-webaudio-acoustic-jitter.patch', content: patch0003 },
  { name: '0004-mahi-clientrects-and-fontcache-masking.patch', content: patch0004 },
  { name: '0005-mahi-icu-timezone-locale-hardware-ch.patch', content: patch0005 },
  { name: '0006-mahi-ungoogled-privacy-telemetry-webrtc.patch', content: patch0006 },
  { name: '0007-mahi-rebrowser-v8-inspector-isolation.patch', content: patch0007 },
  { name: '0008-mahi-rebrowser-page-handler-isolation.patch', content: patch0008 },
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

// Write series file
const seriesContent = allPatches.map(p => p.name).join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'series'), seriesContent, 'utf8');
console.log(`[PASS] Series file updated with ${allPatches.length} patches.`);

console.log('All 8 patches generated and strictly validated!');
