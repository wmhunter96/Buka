#include "display/usage_overlay.h"

#include <Arduino.h>

#include "display/oled_internal.h"

namespace {

struct UsageWindow {
  bool present = false;
  float usedPercent = 0.0f;
  uint32_t receivedMs = 0;
  uint32_t resetsInMs = 0;
};

UsageWindow g_windows[USAGE_WINDOW_COUNT];

uint32_t g_showStartedMs = 0;
uint32_t g_showForMs = 0;

UsageWindow& windowFor(UsageWindowId id) {
  return g_windows[static_cast<size_t>(id)];
}

}  // namespace

void usageSetWindow(UsageWindowId id, float usedPercent, uint32_t resetsInSec) {
  UsageWindow& w = windowFor(id);
  w.present = true;
  w.usedPercent = constrain(usedPercent, 0.0f, 100.0f);
  w.receivedMs = millis();
  w.resetsInMs = resetsInSec * 1000UL;
}

void usageClearWindow(UsageWindowId id) {
  windowFor(id).present = false;
}

bool usageWindowActive(UsageWindowId id, float& usedPercent, uint32_t& resetsInSec) {
  UsageWindow& w = windowFor(id);
  if (!w.present) {
    return false;
  }

  const uint32_t elapsed = millis() - w.receivedMs;
  if (elapsed >= w.resetsInMs) {
    w.present = false;
    return false;
  }

  usedPercent = w.usedPercent;
  resetsInSec = (w.resetsInMs - elapsed) / 1000UL;
  return true;
}

void usageShowFor(uint32_t seconds) {
  g_showStartedMs = millis();
  g_showForMs = seconds * 1000UL;
}

uint32_t usageShowingFor() {
  const uint32_t elapsed = millis() - g_showStartedMs;
  if (elapsed >= g_showForMs) {
    g_showForMs = 0;
    return 0;
  }
  // Round up so a window that is still open never reports 0.
  return (g_showForMs - elapsed + 999UL) / 1000UL;
}

bool usageOverlaySupported() {
  return TeDisplay::kMarginRows >= 16;
}

namespace {

// One strip: "5h [=======     ]  38%". Coordinates are panel rows.
void drawUsageRow(TeDisplay& d, int16_t top, const char* label, UsageWindowId id) {
  float pct = 0.0f;
  uint32_t resetsIn = 0;
  if (!usageWindowActive(id, pct, resetsIn)) {
    return;
  }

  constexpr int16_t kTextY = 4;
  constexpr int16_t kBarX = 16;
  constexpr int16_t kBarW = 80;
  constexpr int16_t kBarH = 8;

  d.setCursor(0, static_cast<int16_t>(top + kTextY));
  d.print(label);

  const int16_t barY = static_cast<int16_t>(top + kTextY);
  d.drawRect(kBarX, barY, kBarW, kBarH, SSD1306_WHITE);
  const int16_t fillW = static_cast<int16_t>(lroundf((kBarW - 4) * pct / 100.0f));
  if (fillW > 0) {
    d.fillRect(kBarX + 2, static_cast<int16_t>(barY + 2), fillW, kBarH - 4, SSD1306_WHITE);
  }

  char text[6];
  snprintf(text, sizeof(text), "%d%%", static_cast<int>(lroundf(pct)));
  const int16_t textW = static_cast<int16_t>(strlen(text) * 6);
  d.setCursor(static_cast<int16_t>(OLED_WIDTH - textW), static_cast<int16_t>(top + kTextY));
  d.print(text);
}

}  // namespace

void TeDisplay::drawMargins() {
  if (kMarginRows < 16) {
    return;
  }

  // Text state belongs to whoever drew the frame; put it back afterwards.
  const int16_t cx = cursor_x;
  const int16_t cy = cursor_y;
  const uint16_t fg = textcolor;
  const uint16_t bg = textbgcolor;
  const uint8_t sx = textsize_x;
  const uint8_t sy = textsize_y;
  const bool wrapText = wrap;
  GFXfont* font = gfxFont;

  raw_ = true;
  setFont(nullptr);
  setTextSize(1);
  setTextWrap(false);
  setTextColor(SSD1306_WHITE);

  const int16_t bottomTop = static_cast<int16_t>(kMarginRows + OLED_HEIGHT);
  fillRect(0, 0, OLED_WIDTH, kMarginRows, SSD1306_BLACK);
  fillRect(0, bottomTop, OLED_WIDTH, kMarginRows, SSD1306_BLACK);
  if (usageShowingFor() > 0) {
    drawUsageRow(*this, 0, "5h", UsageWindowId::FiveHour);
    drawUsageRow(*this, bottomTop, "wk", UsageWindowId::SevenDay);
  }

  raw_ = false;
  cursor_x = cx;
  cursor_y = cy;
  textcolor = fg;
  textbgcolor = bg;
  textsize_x = sx;
  textsize_y = sy;
  wrap = wrapText;
  gfxFont = font;
}
