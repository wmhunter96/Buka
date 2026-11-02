#include "display/eyes/modes/print_start.h"

#include "display/eyes.h"
#include "display/eyes/core/constants.h"
#include "display/eyes/core/util.h"

void startPrintStartEyes(uint32_t now) {
  (void)now;
}

void updatePrintStartEyes(uint32_t now) {
  (void)now;

  Eye& left = mutableLeftEye();
  Eye& right = mutableRightEye();

  left = eyes::DEFAULT_LEFT;
  right = eyes::eyeWithHeight(eyes::DEFAULT_RIGHT.x, eyes::DEFAULT_RIGHT.width, 3);
}
