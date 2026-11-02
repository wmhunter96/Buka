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

  // Rows above (and below) the frame on a taller panel. 0 on the stock panel.
  static constexpr int16_t kMarginRows = (OLED_PANEL_HEIGHT - OLED_HEIGHT) / 2;

  // Hides Adafruit_SSD1306::display() (not virtual): every frame goes out
  // through `display.display()`, so the usage strips are redrawn on top of
  // whatever the frame left in the buffer. See display/usage_overlay.cpp.
  void display() {
    drawMargins();
    Adafruit_SSD1306::display();
  }

  void drawPixel(int16_t x, int16_t y, uint16_t color) override {
    if (raw_) {
      Adafruit_SSD1306::drawPixel(x, y, color);
      return;
    }
    if (y < 0 || y >= OLED_HEIGHT) {
      return;
    }
    Adafruit_SSD1306::drawPixel(x, static_cast<int16_t>(y + kYOffset), color);
  }

  void drawFastHLine(int16_t x, int16_t y, int16_t w, uint16_t color) override {
    if (raw_) {
      Adafruit_SSD1306::drawFastHLine(x, y, w, color);
      return;
    }
    if (y < 0 || y >= OLED_HEIGHT) {
      return;
    }
    Adafruit_SSD1306::drawFastHLine(x, static_cast<int16_t>(y + kYOffset), w, color);
  }

  void drawFastVLine(int16_t x, int16_t y, int16_t h, uint16_t color) override {
    if (raw_) {
      Adafruit_SSD1306::drawFastVLine(x, y, h, color);
      return;
    }
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
  // Draws the usage strips in the margin rows (no-op without margins).
  void drawMargins();

  // True while drawMargins() runs: panel coordinates, no shift or clip.
  bool raw_ = false;

  static constexpr int16_t kYOffset = kMarginRows;
  static_assert(OLED_PANEL_HEIGHT >= OLED_HEIGHT, "panel shorter than frame");
};

extern TeDisplay display;
