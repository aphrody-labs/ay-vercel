#include "cpp/vercel_abi/vercel_abi.h"

#include <gtest/gtest.h>

#include <vector>

namespace ay_vercel {
namespace {

TEST(VercelAbiTest, RoundTripsHeaderAndVerifiesCrc32c) {
  const std::vector<uint8_t> payload = {'v', 'e', 'r', 'c', 'e', 'l'};
  VercelFrameHeader hdr;
  hdr.flags = 1;
  hdr.payload_bytes = payload.size();
  hdr.payload_crc32c = ComputeFrameCrc32c(payload);
  hdr.stream_id = 7;

  const auto wire = EncodeFrameHeader(hdr);
  const auto status = VerifyFrame(wire, payload);
  EXPECT_TRUE(status.ok()) << status.message();

  std::vector<uint8_t> tampered = payload;
  tampered[0] = 'V';
  EXPECT_FALSE(VerifyFrame(wire, tampered).ok());
}

}  // namespace
}  // namespace ay_vercel
