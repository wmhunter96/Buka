#pragma once

#include <cstdint>

// Reset expression face playback (kaomoji and gundam styles) so the next
// draw starts at frame 0.
void kaomojiResetPlayback(uint32_t now);
