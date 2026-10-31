#pragma once

#include <Adafruit_SSD1306.h>

#include "pins.h"

// The faces and text are laid out for a 128x32 frame (OLED_WIDTH x OLED_HEIGHT).
// On a taller panel (OLED_PANEL_HEIGHT, e.g. a 0.96" 128x64 SSD1306) that frame
// is drawn centered vertically and the rows above and below stay dark. With the
// stock 128x32 panel the offset is 0 and this behaves like Adafruit_SSD1306.
//
// Every GFX primitive ends in drawPixel / drawFastHLine / drawFastVLine, so
// clipping and shifting here covers text, bitmaps, rects and the eye shapes.
class TeDisplay : public Adafruit_SSD1306 {
 public:
  explicit TeDisplay(TwoWire* wire)
    : Adafruit_SSD1306(OLED_WIDTH, OLED_PANEL_HEIGHT, wire, -1) {}

  void drawPixel(int16_t x, int16_t y, uint16_t color) override {
    if (y < 0 || y >= OLED_HEIGHT) {
      return;
    }
    Adafruit_SSD1306::drawPixel(x, static_cast<int16_t>(y + kYOffset), color);
  }

  void drawFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) override {
    if (y < 0 || y >= OLED_HEIGHT) {
      return;
    }
    Adafruit_SSD1306::drawFastHLine(x, static_cast<int16_t>(y + kYOffset), w, color);
  }

  void drawFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) override {
    if (y < 0) {
      h = static_cast<int16_t>(h + y);
      y = 0;
    }
    if (y + h > OLED_HEIGHT) {
      h = static_cast<int16_t>(OLED_HEIGHT - y);
    }
    if (h <= 0) {
      return;
    }
    Adafruit_SSD1306::drawFastVLine(x, static_cast<int16_t>(y + kYOffset), h, color);
  }

 private:
  static constexpr int16_t kYOffset = (OLED_PANEL_HEIGHT - OLED_HEIGHT) / 2;
  static_assert(OLED_PANEL_HEIGHT >= OLED_HEIGHT, "panel shorter than frame");
};

extern TeDisplay display;
