#pragma once

#include <array>
#include <cstdint>

#include "absl/status/statusor.h"
#include "absl/types/span.h"

namespace ay_vercel {

inline constexpr std::array<uint8_t, 4> kVercelFrameMagic = {'A', 'Y', 'V', 'C'};
inline constexpr uint16_t kVercelFrameVersion = 1;
inline constexpr size_t kVercelFrameHeaderBytes = 24;

// Binary telemetry envelope for Vercel Edge/Fluid Compute trace & artifact frames.
struct VercelFrameHeader {
  uint16_t version = kVercelFrameVersion;
  uint16_t flags = 0;
  uint64_t payload_bytes = 0;
  uint32_t payload_crc32c = 0;
  uint32_t stream_id = 0;
};

uint32_t ComputeFrameCrc32c(absl::Span<const uint8_t> payload);
std::array<uint8_t, kVercelFrameHeaderBytes> EncodeFrameHeader(const VercelFrameHeader& header);
absl::StatusOr<VercelFrameHeader> DecodeFrameHeader(absl::Span<const uint8_t> wire);
absl::Status VerifyFrame(absl::Span<const uint8_t> wire_header,
                         absl::Span<const uint8_t> payload);

}  // namespace ay_vercel
