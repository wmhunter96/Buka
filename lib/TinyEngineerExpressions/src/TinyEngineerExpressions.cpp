#include "TinyEngineerExpressions.h"
#include "expression_assets.h"
#include "gundam_assets.h"

#include <cstring>

namespace tiny_engineer {
namespace expressions {

namespace {

uint8_t readByte(const uint8_t* address) {
#if defined(ARDUINO)
  return pgm_read_byte(address);
#else
  return *address;
#endif
}

uint16_t readWord(const uint16_t* address) {
#if defined(ARDUINO)
  return pgm_read_word(address);
#else
  return *address;
#endif
}

const char* const kNames[kExpressionCount] = {
    "idle", "happy", "laugh", "wink", "curious", "thinking", "surprise", "smug",
    "sleepy", "sleep", "sad", "cry", "angry", "panic", "shy", "love"};

// One generated asset table (expression_assets.h, gundam_assets.h, ...).
struct AssetTable {
  const uint8_t* rleData;
  std::size_t rleDataSize;
  const uint16_t* frameOffsets;
  std::size_t uniqueFrameCount;
  const uint8_t (*frameIndices)[kFramesPerExpression];
};

const AssetTable kTables[kFaceSetCount] = {
    {detail::kRleData, detail::kRleDataSize, detail::kFrameOffsets,
     detail::kUniqueFrameCount, detail::kFrameIndices},
    {gundam_detail::kRleData, gundam_detail::kRleDataSize,
     gundam_detail::kFrameOffsets, gundam_detail::kUniqueFrameCount,
     gundam_detail::kFrameIndices},
};

}  // namespace

const char* name(Expression expression) {
  const auto index = static_cast<uint8_t>(expression);
  return index < kExpressionCount ? kNames[index] : nullptr;
}

bool render(FaceSet set, Expression expression, uint32_t elapsedMs,
            uint8_t* output, std::size_t outputSize) {
  const auto setIndex = static_cast<uint8_t>(set);
  const auto index = static_cast<uint8_t>(expression);
  if (setIndex >= kFaceSetCount || index >= kExpressionCount ||
      output == nullptr || outputSize < kFrameBytes) {
    return false;
  }
  const AssetTable& table = kTables[setIndex];

  const auto frame = (elapsedMs % kLoopDurationMs) / kFrameDurationMs;
  const auto uniqueFrame = readByte(&table.frameIndices[index][frame]);
  if (uniqueFrame >= table.uniqueFrameCount) return false;

  const std::size_t begin = readWord(&table.frameOffsets[uniqueFrame]);
  const std::size_t end = readWord(&table.frameOffsets[uniqueFrame + 1]);
  if (begin > end || end > table.rleDataSize || (end - begin) % 2 != 0) {
    return false;
  }

  // Validate the complete frame before writing, so even corrupt assets leave
  // the caller's buffer unchanged. Every pair is an unsigned (count, value).
  std::size_t decodedSize = 0;
  for (std::size_t cursor = begin; cursor < end; cursor += 2) {
    const auto count = readByte(&table.rleData[cursor]);
    if (count == 0 || count > kFrameBytes - decodedSize) return false;
    decodedSize += count;
  }
  if (decodedSize != kFrameBytes) return false;

  std::size_t written = 0;
  for (std::size_t cursor = begin; cursor < end; cursor += 2) {
    const auto count = readByte(&table.rleData[cursor]);
    const auto value = readByte(&table.rleData[cursor + 1]);
    std::memset(output + written, value, count);
    written += count;
  }
  return true;
}

bool render(Expression expression, uint32_t elapsedMs,
            uint8_t* output, std::size_t outputSize) {
  return render(FaceSet::Kaomoji, expression, elapsedMs, output, outputSize);
}

}  // namespace expressions
}  // namespace tiny_engineer
