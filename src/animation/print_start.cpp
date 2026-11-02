#include <Arduino.h>

#include "animation.h"
#include "animation/print_start.h"
#include "animation/util.h"
#include "hardware/servo_wrapper.h"
#include "servos.h"

namespace {

constexpr float kRaiseSpeedDegS = 90.0f;
constexpr float kNodSpeedDegS = 70.0f;
constexpr float kReturnSpeedDegS = 60.0f;
// Long enough for the wink face (3 s loop) to read.
constexpr uint32_t kHoldMs = 1600;

// Pose units are -1..1 of each joint's saved range.
constexpr float kRightHandUp = 0.6f;
constexpr float kHeadUp = 0.5f;
constexpr float kHeadNod = -0.1f;

enum class Phase {
  Raise,
  Hold,
  Nod,
  Return,
  Done,
};

Phase g_phase = Phase::Raise;
uint32_t g_phaseStartedMs = 0;

bool stopped(int servo) {
  return !servoAt(servo).isMoving();
}

void enter(Phase phase, uint32_t now) {
  g_phase = phase;
  g_phaseStartedMs = now;
}

}  // namespace

void startPrintStart() {
  anim::stopAnimServos();
  servoAt(SERVO_BODY).setNormTarget(0.0f, kRaiseSpeedDegS);
  servoAt(SERVO_NECK).setNormTarget(0.0f, kRaiseSpeedDegS);
  servoAt(SERVO_HAND_RIGHT).setNormTarget(kRightHandUp, kRaiseSpeedDegS);
  servoAt(SERVO_HEAD).setNormTarget(kHeadUp, kRaiseSpeedDegS);
  enter(Phase::Raise, millis());
}

void updatePrintStart(uint32_t now) {
  updateAllServos();

  switch (g_phase) {
    case Phase::Raise:
      if (stopped(SERVO_HAND_RIGHT) && stopped(SERVO_HEAD)) {
        enter(Phase::Hold, now);
      }
      break;

    case Phase::Hold:
      if (now - g_phaseStartedMs >= kHoldMs) {
        servoAt(SERVO_HEAD).setNormTarget(kHeadNod, kNodSpeedDegS);
        enter(Phase::Nod, now);
      }
      break;

    case Phase::Nod:
      if (stopped(SERVO_HEAD)) {
        anim::parkForTransition();
        servoAt(SERVO_HEAD).setNormTarget(0.0f, kReturnSpeedDegS);
        enter(Phase::Return, now);
      }
      break;

    case Phase::Return:
      if (anim::isTransitionParkComplete() && stopped(SERVO_HEAD)) {
        enter(Phase::Done, now);
        finishAnimation(now);
      }
      break;

    case Phase::Done:
      break;
  }
}
