#pragma once

#include <stddef.h>
#include <stdint.h>

// Claude usage limits pushed by the host (POST /usage), shown on request in
// the spare rows above and below the face on a panel taller than the 128x32
// frame (TE_OLED_128X64). The strips stay dark until usageShowFor() opens a
// short display window. Held in RAM only; a usage window drops itself once its
// reset time passes. The firmware has no wall clock, so the host sends seconds
// until reset and the countdown runs on millis().

enum class UsageWindowId : uint8_t {
  FiveHour = 0,
  SevenDay = 1,
};

constexpr size_t USAGE_WINDOW_COUNT = 2;

// Longest accepted countdown: one day past the weekly window.
constexpr uint32_t USAGE_RESETS_IN_MAX_S = 8UL * 24UL * 60UL * 60UL;

void usageSetWindow(UsageWindowId id, float usedPercent, uint32_t resetsInSec);
void usageClearWindow(UsageWindowId id);

// True while the window holds data whose reset time has not passed.
bool usageWindowActive(UsageWindowId id, float& usedPercent, uint32_t& resetsInSec);

// Longest on-request display window.
constexpr uint32_t USAGE_SHOW_FOR_MAX_S = 600;

// Draw the bars for |seconds| from now (0 hides them now).
void usageShowFor(uint32_t seconds);

// Seconds the bars stay visible, 0 when hidden.
uint32_t usageShowingFor();

// True when this panel has spare rows to draw the bars in.
bool usageOverlaySupported();
