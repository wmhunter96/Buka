#include "display/eyes/styles/eye_style.h"
#include "display/eyes/styles/kaomoji.h"

#include <Adafruit_SSD1306.h>
#include <TinyEngineerExpressions.h>

#include "display/oled.h"
#include "display/oled_internal.h"

// Expression-playback styles: `kaomoji` and `gundam` play the 16-face sets
// from lib/TinyEngineerExpressions with the same mood mapping; only the
// drawings differ.

namespace {

namespace expressions = tiny_engineer::expressions;

uint8_t g_kaomojiFrame[expressions::kFrameBytes];
expressions::Expression g_activeExpression = expressions::Expression::Idle;
uint32_t g_expressionStartedMs = 0;
bool g_expressionArmed = false;

expressions::Expression expressionFor(
  EyeMode mode,
  AnimationId animation,
  EyeStyleSleepPhase sleepPhase
) {
  if (sleepPhase == EyeStyleSleepPhase::Closing ||
      animation == AnimationId::Sleep) {
    return expressions::Expression::Sleep;
  }

  if (sleepPhase == EyeStyleSleepPhase::Opening) {
    return expressions::Expression::Idle;
  }

  switch (mode) {
    case EyeMode::Idle:
      return expressions::Expression::Idle;
    case EyeMode::Typing:
    case EyeMode::Thinking:
      return expressions::Expression::Thinking;
    case EyeMode::Reading:
    case EyeMode::Attention:
      return expressions::Expression::Curious;
    case EyeMode::Ring:
      return expressions::Expression::Surprise;
    case EyeMode::Welcome:
    case EyeMode::Talking:
      return expressions::Expression::Happy;
    case EyeMode::Error:
      return expressions::Expression::Angry;
    case EyeMode::Abort:
      return expressions::Expression::Panic;
    case EyeMode::Wakeup:
      return expressions::Expression::Sleepy;
    case EyeMode::Dead:
      return expressions::Expression::Sad;
    case EyeMode::PrintStart:
      return expressions::Expression::Wink;
  }

  return expressions::Expression::Idle;
}

void drawExpression(
  expressions::FaceSet set,
  EyeMode mode,
  AnimationId animation,
  uint32_t now,
  EyeStyleSleepPhase sleepPhase
) {
  if (!oledAvailable) {
    return;
  }

  const auto expression = expressionFor(mode, animation, sleepPhase);
  if (!g_expressionArmed || expression != g_activeExpression) {
    g_activeExpression = expression;
    g_expressionStartedMs = now;
    g_expressionArmed = true;
  }

  const uint32_t elapsed = now - g_expressionStartedMs;

  if (!expressions::render(
        set,
        expression,
        elapsed,
        g_kaomojiFrame,
        sizeof(g_kaomojiFrame)
      )) {
    return;
  }

  display.clearDisplay();
  display.drawBitmap(
    0,
    0,
    g_kaomojiFrame,
    expressions::kWidth,
    expressions::kHeight,
    SSD1306_WHITE
  );
  display.display();
}

void drawKaomoji(
  EyeMode mode,
  AnimationId animation,
  uint32_t /*modeStartedMs*/,
  uint32_t now,
  EyeStyleSleepPhase sleepPhase
) {
  drawExpression(expressions::FaceSet::Kaomoji, mode, animation, now, sleepPhase);
}

void drawGundam(
  EyeMode mode,
  AnimationId animation,
  uint32_t /*modeStartedMs*/,
  uint32_t now,
  EyeStyleSleepPhase sleepPhase
) {
  drawExpression(expressions::FaceSet::Gundam, mode, animation, now, sleepPhase);
}

}  // namespace

void kaomojiResetPlayback(uint32_t now) {
  g_expressionArmed = false;
  g_expressionStartedMs = now;
  g_activeExpression = expressions::Expression::Idle;
}

extern const EyeStyleRenderer kKaomojiEyeStyle = {
  "kaomoji",
  false,
  false,
  drawKaomoji,
};

extern const EyeStyleRenderer kGundamEyeStyle = {
  "gundam",
  false,
  false,
  drawGundam,
};
