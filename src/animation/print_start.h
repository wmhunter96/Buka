#pragma once

#include <stdint.h>

// One-shot "print started" fist pump: right hand and head up, a nod, then
// back to the `none` pose. No audio. Finishes to `none`.
void startPrintStart();
void updatePrintStart(uint32_t now);
