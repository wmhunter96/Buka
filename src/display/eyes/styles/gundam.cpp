#include "display/eyes/styles/eye_style.h"

#include <Adafruit_SSD1306.h>

#include "animation/dead.h"
#include "display/eyes/core/blink.h"
#include "display/eyes/core/constants.h"
#include "display/eyes/core/draw.h"
#include "display/eyes/core/util.h"
#include "display/oled.h"
#include "display/oled_internal.h"
#include "pins.h"

// Mobile-suit face in the 128x32 frame: V-fin and forehead crest above the
// eyes, faceplate cheek lines, mouth vents and chin below. The eyes are narrow
// angular slits that slope down toward the center (the stern stare), pointed
// at the outer end and square-cut at the inner end. They follow the classic pose, so every
// animation's glances, blinks, squints and sleep still read; the head stays
// fixed, like a helmet.

namespace {

constexpr int16_t kCenterX = OLED_WIDTH / 2;

// Where the two fin blades meet, just above the crest.
constexpr int16_t kFinBaseY = 9;
// Fin tips sit above the inner part of each eye.
constexpr int16_t kFinTipInset = 26;

void drawVFin() {
  // The face mirrors around x = 63.5, so x pairs with OLED_WIDTH - 1 - x.
  const int16_t leftTip = (int16_t)(kCenterX - kFinTipInset - 12);
  const int16_t rightTip = (int16_t)(OLED_WIDTH - 1 - leftTip);

  // Two-pixel blades.
  for (int16_t dy = 0; dy < 2; dy++) {
    display.drawLine(kCenterX, (int16_t)(kFinBaseY - dy), leftTip, (int16_t)(1 - dy), SSD1306_WHITE);
    display.drawLine(
      (int16_t)(kCenterX - 1), (int16_t)(kFinBaseY - dy), rightTip, (int16_t)(1 - dy), SSD1306_WHITE
    );
  }

  // Forehead crest (the sensor block where the blades meet).
  display.fillRect((int16_t)(kCenterX - 4), 6, 8, 5, SSD1306_WHITE);
  display.drawFastHLine((int16_t)(kCenterX - 2), 8, 4, SSD1306_BLACK);
}

void drawFaceplate() {
  // Cheek lines from beside the eyes down to the chin.
  display.drawLine((int16_t)(kCenterX - 18), 21, (int16_t)(kCenterX - 9), 30, SSD1306_WHITE);
  display.drawLine((int16_t)(kCenterX + 17), 21, (int16_t)(kCenterX + 8), 30, SSD1306_WHITE);

  // Mouth vents: two slits with a rib across each.
  display.fillRect((int16_t)(kCenterX - 6), 24, 3, 6, SSD1306_WHITE);
  display.fillRect((int16_t)(kCenterX + 3), 24, 3, 6, SSD1306_WHITE);
  display.drawFastHLine((int16_t)(kCenterX - 6), 27, 3, SSD1306_BLACK);
  display.drawFastHLine((int16_t)(kCenterX + 3), 27, 3, SSD1306_BLACK);

  // Chin.
  display.drawFastHLine((int16_t)(kCenterX - 9), 31, 18, SSD1306_WHITE);
}

// One eye inside its rendered pose box. |innerOnRight| is true for the
// screen-left eye, whose inner (center-side) end is on its right.
void drawGundamEye(const Eye& r, bool innerOnRight) {
  if (r.width <= 0 || r.height <= 0) {
    return;
  }

  if (r.height <= 2) {
    // Nearly shut: a thin slit.
    display.drawFastHLine(r.x, (int16_t)(r.y + r.height / 2), r.width, SSD1306_WHITE);
    return;
  }

  const float h = (float)r.height;
  const int16_t lastCol = (int16_t)(r.width - 1);

  for (int16_t c = 0; c <= lastCol; c++) {
    const float along = lastCol > 0 ? (float)c / lastCol : 1.0f;
    // 0 at the outer tip, 1 at the inner end.
    const float t = innerOnRight ? along : 1.0f - along;

    // Straight top edge sloping down toward the center; the slit thickens
    // from a sharp outer point to a tall, square-cut inner end.
    const float top = h * (0.12f + 0.36f * t);
    const float bottom = top + h * (0.16f + 0.36f * t);

    const int16_t y0 = (int16_t)(r.y + (int16_t)(top + 0.5f));
    const int16_t y1 = (int16_t)(r.y + (int16_t)(bottom + 0.5f));
    if (y1 >= y0) {
      display.drawFastVLine((int16_t)(r.x + c), y0, (int16_t)(y1 - y0 + 1), SSD1306_WHITE);
    }
  }
}

void drawGundam(
  EyeMode mode,
  AnimationId /*animation*/,
  uint32_t /*modeStartedMs*/,
  uint32_t /*now*/,
  EyeStyleSleepPhase /*sleepPhase*/
) {
  if (mode == EyeMode::Dead && deadShowingX()) {
    drawDeadXEyes(leftEye(), rightEye());
    return;
  }

  if (!oledAvailable) {
    return;
  }

  display.clearDisplay();
  drawVFin();
  drawFaceplate();
  drawGundamEye(eyes::renderEye(leftEye(), blinkOpenAmount()), true);
  drawGundamEye(eyes::renderEye(rightEye(), blinkOpenAmount()), false);
  display.display();
}

}  // namespace

extern const EyeStyleRenderer kGundamEyeStyle = {
  "gundam",
  true,
  true,
  drawGundam,
};
