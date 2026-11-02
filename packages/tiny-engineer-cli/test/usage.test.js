import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SHOW_FOR_DEFAULT_S,
  SHOW_FOR_MAX_S,
  describeReply,
  parseShowSeconds,
  runUsage,
} from "../src/commands/usage.js";
import { createOutput } from "../src/util/output.js";
import { createStyle } from "../src/util/style.js";

test("parseShowSeconds defaults, off, and limits", () => {
  assert.deepEqual(parseShowSeconds(undefined), { seconds: SHOW_FOR_DEFAULT_S });
  assert.deepEqual(parseShowSeconds("30"), { seconds: 30 });
  assert.deepEqual(parseShowSeconds("off"), { seconds: 0 });
  assert.deepEqual(parseShowSeconds("hide"), { seconds: 0 });
  assert.deepEqual(parseShowSeconds(String(SHOW_FOR_MAX_S)), { seconds: SHOW_FOR_MAX_S });
  assert.ok("error" in parseShowSeconds(String(SHOW_FOR_MAX_S + 1)));
  assert.ok("error" in parseShowSeconds("-5"));
  assert.ok("error" in parseShowSeconds("1.5"));
});

test("describeReply", () => {
  const both = {
    shown: true,
    five_hour: { used_percentage: 62.4, resets_in: 10 },
    seven_day: { used_percentage: 23, resets_in: 10 },
  };
  assert.equal(describeReply(both, 15), "showing 5h 62% · wk 23% for 15s");
  assert.equal(describeReply({ shown: true, five_hour: null, seven_day: null }, 15).includes("no usage yet"), true);
  assert.equal(describeReply({ shown: false }, 15), "robot has no 128x64 OLED; usage bars not drawn");
  assert.equal(describeReply(both, 0), "usage bars hidden");
});

function quietOut() {
  return createOutput({ quiet: true, style: createStyle({ color: false }) });
}

test("runUsage posts show_for and succeeds", async () => {
  const calls = [];
  process.exitCode = undefined;
  await runUsage(quietOut(), ["30", "--url", "http://robot"], true, {
    post: async (req) => {
      calls.push(req);
      return { ok: true, body: { shown: true, five_hour: null, seven_day: null } };
    },
  });
  assert.deepEqual(calls, [{ url: "http://robot", seconds: 30 }]);
  assert.equal(process.exitCode, 0);
});

test("runUsage rejects bad seconds without posting", async () => {
  let posted = false;
  process.exitCode = undefined;
  await runUsage(quietOut(), ["999"], true, {
    post: async () => {
      posted = true;
      return { ok: true, body: {} };
    },
  });
  assert.equal(posted, false);
  assert.equal(process.exitCode, 1);
  process.exitCode = 0;
});

test("runUsage reports robot errors", async () => {
  process.exitCode = undefined;
  await runUsage(quietOut(), [], true, {
    post: async () => ({ ok: false, error: "robot unreachable: timeout" }),
  });
  assert.equal(process.exitCode, 1);
  process.exitCode = 0;
});
