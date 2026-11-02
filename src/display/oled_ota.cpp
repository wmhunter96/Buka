#include <Adafruit_SSD1306.h>

#include "display/oled.h"
#include "display/oled_internal.h"
#include "pins.h"

// Shown while a Wi-Fi update is written: happy closed eyes (^ ^), a small
// smile, and a progress bar, so the robot keeps a face instead of a text
// screen. The face mirrors around x = 63.5 in the 128x32 frame.

namespace {

void drawHappyEye(int16_t cx) {
  constexpr int16_t kY = 14;
  constexpr int16_t kHalf = 9;
  constexpr int16_t kRise = 6;
  for (int16_t d = 0; d < 2; d++) {
    display.drawLine((int16_t)(cx - kHalf), (int16_t)(kY + d), cx, (int16_t)(kY - kRise + d), SSD1306_WHITE);
    display.drawLine(cx, (int16_t)(kY - kRise + d), (int16_t)(cx + kHalf), (int16_t)(kY + d), SSD1306_WHITE);
  }
}

void drawSmile() {
  display.drawLine(58, 17, 61, 20, SSD1306_WHITE);
  display.drawFastHLine(61, 20, 6, SSD1306_WHITE);
  display.drawLine(66, 20, 69, 17, SSD1306_WHITE);
}

}  // namespace

void showOtaFace(int percent) {
  if (!oledAvailable) {
    return;
  }

  if (percent < 0) {
    percent = 0;
  } else if (percent > 100) {
    percent = 100;
  }

  display.clearDisplay();
  drawHappyEye(32);
  drawHappyEye((int16_t)(OLED_WIDTH - 1 - 32));
  drawSmile();

  constexpr int16_t kBarX = 24;
  constexpr int16_t kBarY = 24;
  constexpr int16_t kBarW = OLED_WIDTH - 2 * kBarX;
  constexpr int16_t kBarH = 7;
  display.drawRect(kBarX, kBarY, kBarW, kBarH, SSD1306_WHITE);
  const int16_t fill = (int16_t)((kBarW - 4) * percent / 100);
  if (fill > 0) {
    display.fillRect(kBarX + 2, kBarY + 2, fill, kBarH - 4, SSD1306_WHITE);
  }

  display.display();
}
