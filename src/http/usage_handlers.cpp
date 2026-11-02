#include <ArduinoJson.h>

#include <optional>

#include "display/oled.h"
#include "display/usage_overlay.h"
#include "http/handlers.h"
#include "http/request.h"
#include "http/response.h"

namespace {

struct UsageField {
  const char* key;
  UsageWindowId id;
};

constexpr UsageField kFields[] = {
  {"five_hour", UsageWindowId::FiveHour},
  {"seven_day", UsageWindowId::SevenDay},
};

enum class UsageAction : uint8_t {
  Keep,
  Clear,
  Set,
};

struct UsageUpdate {
  UsageAction action = UsageAction::Keep;
  float usedPercent = 0.0f;
  uint32_t resetsIn = 0;
};

// Absent keeps the window, null clears it. Otherwise both fields must be valid.
std::optional<UsageUpdate> readWindow(JsonVariantConst value) {
  UsageUpdate update;
  if (value.isUnbound()) {
    return update;
  }
  if (value.isNull()) {
    update.action = UsageAction::Clear;
    return update;
  }
  if (!value.is<JsonObjectConst>()) {
    return std::nullopt;
  }

  const JsonVariantConst pct = value["used_percentage"];
  const JsonVariantConst resetsIn = value["resets_in"];

  if (!pct.is<float>() || pct.as<float>() < 0.0f || pct.as<float>() > 100.0f) {
    return std::nullopt;
  }
  if (!resetsIn.is<uint32_t>() || resetsIn.as<uint32_t>() < 1 ||
      resetsIn.as<uint32_t>() > USAGE_RESETS_IN_MAX_S) {
    return std::nullopt;
  }

  update.action = UsageAction::Set;
  update.usedPercent = pct.as<float>();
  update.resetsIn = resetsIn.as<uint32_t>();
  return update;
}

void addWindow(JsonDocument& reply, const UsageField& field) {
  float pct = 0.0f;
  uint32_t resetsIn = 0;
  if (!usageWindowActive(field.id, pct, resetsIn)) {
    reply[field.key] = nullptr;
    return;
  }
  JsonObject w = reply[field.key].to<JsonObject>();
  w["used_percentage"] = pct;
  w["resets_in"] = resetsIn;
}

}  // namespace

void handleUsagePost(WebServer& server) {
  JsonDocument request;
  if (!readJsonBody(server, request)) {
    return;
  }
  const JsonObjectConst body = request.as<JsonObjectConst>();

  // Validate everything first so a bad field changes nothing.
  UsageUpdate updates[USAGE_WINDOW_COUNT];
  for (size_t i = 0; i < USAGE_WINDOW_COUNT; i++) {
    const std::optional<UsageUpdate> update = readWindow(body[kFields[i].key]);
    if (!update) {
      const String message = String("invalid ") + kFields[i].key;
      sendError(server, 400, message.c_str());
      return;
    }
    updates[i] = *update;
  }

  const JsonVariantConst showFor = body["show_for"];
  if (!showFor.isUnbound() &&
      (!showFor.is<uint32_t>() || showFor.as<uint32_t>() > USAGE_SHOW_FOR_MAX_S)) {
    sendError(server, 400, "invalid show_for");
    return;
  }

  for (size_t i = 0; i < USAGE_WINDOW_COUNT; i++) {
    switch (updates[i].action) {
      case UsageAction::Keep:
        break;
      case UsageAction::Clear:
        usageClearWindow(kFields[i].id);
        break;
      case UsageAction::Set:
        usageSetWindow(kFields[i].id, updates[i].usedPercent, updates[i].resetsIn);
        break;
    }
  }

  if (!showFor.isUnbound()) {
    usageShowFor(showFor.as<uint32_t>());
  }

  JsonDocument reply;
  reply["ok"] = true;
  for (const UsageField& field : kFields) {
    addWindow(reply, field);
  }
  reply["showing"] = usageShowingFor();
  reply["shown"] = oledAvailable && usageOverlaySupported();
  sendJson(server, 200, reply);
}
