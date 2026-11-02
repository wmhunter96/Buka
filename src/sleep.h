#pragma once

#include <cstdint>

#include "animation.h"

void initSleep();
void prepareSleepWakePose();
void requestSleep(uint32_t now);
void onAnimationApplied(AnimationId id, uint32_t now);
// Restarts the idle countdown, e.g. while a clip plays over the idle pose.
void noteActivity(uint32_t now);
void updateSleep(uint32_t now);
bool isSleeping();
// True in the last stretch of the idle countdown before sleep: the final
// 2 minutes of sleep_timeout, or its second half if that is shorter. The
// kaomoji style shows its Sleepy face while drowsy.
bool isDrowsy(uint32_t now);
