#include "cpp/vercel_abi/vercel_abi.h"

#include <string_view>

#include "absl/crc/crc32c.h"
#include "absl/status/status.h"

namespace ay_vercel {
namespace {

void WriteBe16(uint8_t* dst, uint16_t v) {
  dst[0] = static_cast<uint8_t>((v >> 8) & 0xFF);
  dst[1] = static_cast<uint8_t>(v & 0xFF);
}

void WriteBe32(uint8_t* dst, uint32_t v) {
  dst[0] = static_cast<uint8_t>((v >> 24) & 0xFF);
  dst[1] = static_cast<uint8_t>((v >> 16) & 0xFF);
  dst[2] = static_cast<uint8_t>((v >> 8) & 0xFF);
  dst[3] = static_cast<uint8_t>(v & 0xFF);
}

void WriteBe64(uint8_t* dst, uint64_t v) {
  for (int i = 0; i < 8; ++i) {
    dst[i] = static_cast<uint8_t>((v >> ((7 - i) * 8)) & 0xFF);
  }
}

uint16_t ReadBe16(const uint8_t* src) {
  return static_cast<uint16_t>((static_cast<uint16_t>(src[0]) << 8) | src[1]);
}

uint32_t ReadBe32(const uint8_t* src) {
  return (static_cast<uint32_t>(src[0]) << 24) | (static_cast<uint32_t>(src[1]) << 16) |
         (static_cast<uint32_t>(src[2]) << 8) | static_cast<uint32_t>(src[3]);
}

uint64_t ReadBe64(const uint8_t* src) {
  uint64_t v = 0;
  for (int i = 0; i < 8; ++i) {
    v = (v << 8) | src[i];
  }
  return v;
}

}  // namespace

uint32_t ComputeFrameCrc32c(absl::Span<const uint8_t> payload) {
  std::string_view view(reinterpret_cast<const char*>(payload.data()), payload.size());
  return static_cast<uint32_t>(absl::ComputeCrc32c(view));
}

std::array<uint8_t, kVercelFrameHeaderBytes> EncodeFrameHeader(const VercelFrameHeader& header) {
  std::array<uint8_t, kVercelFrameHeaderBytes> out{};
  out[0] = kVercelFrameMagic[0];
  out[1] = kVercelFrameMagic[1];
  out[2] = kVercelFrameMagic[2];
  out[3] = kVercelFrameMagic[3];
  WriteBe16(&out[4], header.version);
  WriteBe16(&out[6], header.flags);
  WriteBe64(&out[8], header.payload_bytes);
  WriteBe32(&out[16], header.payload_crc32c);
  WriteBe32(&out[20], header.stream_id);
  return out;
}

absl::StatusOr<VercelFrameHeader> DecodeFrameHeader(absl::Span<const uint8_t> wire) {
  if (wire.size() < kVercelFrameHeaderBytes) {
    return absl::InvalidArgumentError("wire frame header smaller than 24 bytes");
  }
  for (size_t i = 0; i < kVercelFrameMagic.size(); ++i) {
    if (wire[i] != kVercelFrameMagic[i]) {
      return absl::InvalidArgumentError("invalid AYVC magic prefix");
    }
  }
  VercelFrameHeader header;
  header.version = ReadBe16(&wire[4]);
  if (header.version != kVercelFrameVersion) {
    return absl::UnimplementedError("unsupported AYVC wire version");
  }
  header.flags = ReadBe16(&wire[6]);
  header.payload_bytes = ReadBe64(&wire[8]);
  header.payload_crc32c = ReadBe32(&wire[16]);
  header.stream_id = ReadBe32(&wire[20]);
  return header;
}

absl::Status VerifyFrame(absl::Span<const uint8_t> wire_header,
                         absl::Span<const uint8_t> payload) {
  absl::StatusOr<VercelFrameHeader> header = DecodeFrameHeader(wire_header);
  if (!header.ok()) {
    return header.status();
  }
  if (payload.size() != header->payload_bytes) {
    return absl::FailedPreconditionError("payload length does not match header");
  }
  uint32_t actual_crc = ComputeFrameCrc32c(payload);
  if (actual_crc != header->payload_crc32c) {
    return absl::DataLossError("payload CRC32C mismatch");
  }
  return absl::OkStatus();
}

}  // namespace ay_vercel
