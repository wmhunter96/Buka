import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  RESEND_AFTER_MS,
  RESETS_IN_MAX_S,
  formatDuration,
  formatStatusLine,
  payloadKey,
  runStatusline,
  shouldSend,
  usagePayload,
} from "../src/commands/statusline.js";

const NOW = 1_800_000_000;

function input(limits) {
  return { model: { display_name: "Opus" }, ...(limits ? { rate_limits: limits } : {}) };
}

test("usagePayload converts resets_at to seconds remaining", () => {
  const p = usagePayload(
    input({
      five_hour: { used_percentage: 38.24, resets_at: NOW + 8040 },
      seven_day: { used_percentage: 17, resets_at: NOW + 302400 },
    }),
    NOW,
  );
  assert.deepEqual(p, {
    five_hour: { used_percentage: 38.2, resets_in: 8040 },
    seven_day: { used_percentage: 17, resets_in: 302400 },
  });
});

test("usagePayload is null without rate_limits", () => {
  assert.equal(usagePayload(input(null), NOW), null);
  assert.equal(usagePayload(null, NOW), null);
});

test("usagePayload drops reset, missing, or malformed windows", () => {
  const p = usagePayload(
    input({
      five_hour: { used_percentage: 50, resets_at: NOW - 1 },
      seven_day: { used_percentage: "x", resets_at: NOW + 10 },
    }),
    NOW,
  );
  assert.deepEqual(p, { five_hour: null, seven_day: null });
});

test("usagePayload clamps percent and resets_in to the firmware ranges", () => {
  const p = usagePayload(
    input({ five_hour: { used_percentage: 104, resets_at: NOW + RESETS_IN_MAX_S * 2 } }),
    NOW,
  );
  assert.deepEqual(p?.five_hour, { used_percentage: 100, resets_in: RESETS_IN_MAX_S });
  assert.equal(p?.seven_day, null);
});

test("formatDuration", () => {
  assert.equal(formatDuration(45 * 60), "45m");
  assert.equal(formatDuration(2 * 3600 + 14 * 60), "2h14m");
  assert.equal(formatDuration(2 * 3600 + 5 * 60), "2h05m");
  assert.equal(formatDuration(3 * 86400 + 4 * 3600), "3d4h");
  assert.equal(formatDuration(-5), "0m");
});

test("formatStatusLine shows model and windows", () => {
  const p = {
    five_hour: { used_percentage: 38.2, resets_in: 8040 },
    seven_day: { used_percentage: 17, resets_in: 302400 },
  };
  assert.equal(formatStatusLine(input(null), p), "Opus · 5h 38% (2h14m) · wk 17% (3d12h)");
  assert.equal(formatStatusLine(input(null), null), "Opus");
  assert.equal(formatStatusLine(null, null), "Claude");
});

test("payloadKey ignores the countdown", () => {
  const a = { five_hour: { used_percentage: 38.2, resets_in: 100 }, seven_day: null };
  const b = { five_hour: { used_percentage: 38.4, resets_in: 50 }, seven_day: null };
  assert.equal(payloadKey(a), payloadKey(b));
  assert.notEqual(payloadKey(a), payloadKey({ ...a, five_hour: { used_percentage: 39, resets_in: 1 } }));
});

test("shouldSend on change or after the resend interval", () => {
  assert.equal(shouldSend("k", null, 0), true);
  assert.equal(shouldSend("k", { key: "j", at: 0 }, 1), true);
  assert.equal(shouldSend("k", { key: "k", at: 0 }, RESEND_AFTER_MS - 1), false);
  assert.equal(shouldSend("k", { key: "k", at: 0 }, RESEND_AFTER_MS), true);
});

function harness(stdin, { postOk = true, state } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "te-statusline-"));
  const statePath = join(dir, "state.json");
  if (state) writeFileSync(statePath, JSON.stringify(state));
  const lines = [];
  const posts = [];
  const deps = {
    stdinText: stdin,
    nowMs: NOW * 1000,
    statePath,
    write: (line) => lines.push(line),
    post: async (payload) => {
      posts.push(payload);
      return postOk;
    },
  };
  return { deps, lines, posts, statePath };
}

const LIMITS_JSON = JSON.stringify(
  input({ five_hour: { used_percentage: 38, resets_at: NOW + 8040 } }),
);

test("runStatusline prints, posts, and caches", async () => {
  const h = harness(LIMITS_JSON);
  await runStatusline([], h.deps);
  assert.deepEqual(h.lines, ["Opus · 5h 38% (2h14m)"]);
  assert.equal(h.posts.length, 1);
  assert.equal(JSON.parse(readFileSync(h.statePath, "utf8")).at, NOW * 1000);
});

test("runStatusline skips unchanged numbers", async () => {
  const h = harness(LIMITS_JSON, { state: { key: "five_hour:38|seven_day:-", at: NOW * 1000 } });
  await runStatusline([], h.deps);
  assert.equal(h.lines.length, 1);
  assert.equal(h.posts.length, 0);
});

test("runStatusline does not cache a failed post", async () => {
  const h = harness(LIMITS_JSON, { postOk: false });
  await runStatusline([], h.deps);
  assert.throws(() => readFileSync(h.statePath, "utf8"));
});

test("runStatusline without rate_limits or with --no-robot only prints", async () => {
  const none = harness(JSON.stringify(input(null)));
  await runStatusline([], none.deps);
  assert.deepEqual(none.lines, ["Opus"]);
  assert.equal(none.posts.length, 0);

  const off = harness(LIMITS_JSON);
  await runStatusline(["--no-robot"], off.deps);
  assert.equal(off.posts.length, 0);
});

test("runStatusline tolerates bad stdin", async () => {
  const h = harness("not json");
  await runStatusline([], h.deps);
  assert.deepEqual(h.lines, ["Claude"]);
});
