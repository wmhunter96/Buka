import test from "node:test";
import assert from "node:assert/strict";
import { formatFileModifications } from "../src/integrations/claude-code/files.js";
import { animationForEvent } from "../src/integrations/claude-code/map.js";
import { createStyle } from "../src/util/style.js";

test("lifecycle events map to their poses", () => {
  assert.equal(animationForEvent({ hook_event_name: "SessionEnd" }), "sleep");
  assert.equal(
    animationForEvent({ hook_event_name: "SessionEnd", reason: "prompt_input_exit" }),
    "sleep"
  );
  for (const reason of ["clear", "resume"]) {
    assert.equal(
      animationForEvent({ hook_event_name: "SessionEnd", reason }),
      null,
      reason
    );
  }
  assert.equal(
    animationForEvent({ hook_event_name: "UserPromptSubmit" }),
    "reading"
  );
  assert.equal(
    animationForEvent({ hook_event_name: "SubagentStart" }),
    "thinking"
  );
  assert.equal(
    animationForEvent({ hook_event_name: "PostToolBatch" }),
    "thinking"
  );
  assert.equal(
    animationForEvent({ hook_event_name: "PostToolUseFailure" }),
    "error"
  );
  assert.equal(animationForEvent({ hook_event_name: "PreCompact" }), "thinking");
  assert.equal(
    animationForEvent({ hook_event_name: "PermissionRequest" }),
    "attention"
  );
  assert.equal(
    animationForEvent({ hook_event_name: "PermissionDenied" }),
    "abort"
  );
  assert.equal(
    animationForEvent({
      hook_event_name: "Notification",
      notification_type: "permission_prompt",
    }),
    "attention"
  );
  assert.equal(animationForEvent({ hook_event_name: "Stop" }), "ring");
  assert.equal(animationForEvent({ hook_event_name: "StopFailure" }), "error");
});

test("SessionStart welcomes only a fresh launch; every other start wakes up", () => {
  assert.equal(
    animationForEvent({ hook_event_name: "SessionStart", source: "startup" }),
    "welcome"
  );
  for (const source of ["resume", "clear", "compact", "fork", "other", undefined]) {
    assert.equal(
      animationForEvent({ hook_event_name: "SessionStart", source }),
      "wakeup",
      String(source)
    );
  }
});

test("PreToolUse maps reading tools to reading", () => {
  for (const tool of ["Read", "Grep", "Glob", "WebFetch", "WebSearch"]) {
    assert.equal(
      animationForEvent({ hook_event_name: "PreToolUse", tool_name: tool }),
      "reading",
      tool
    );
  }
});

test("PreToolUse maps typing tools to typing", () => {
  for (const tool of ["Bash", "PowerShell", "Edit", "Write", "NotebookEdit"]) {
    assert.equal(
      animationForEvent({ hook_event_name: "PreToolUse", tool_name: tool }),
      "typing",
      tool
    );
  }
});

test("PreToolUse skips unknown or missing tools", () => {
  assert.equal(
    animationForEvent({ hook_event_name: "PreToolUse", tool_name: "AskUserQuestion" }),
    null
  );
  assert.equal(
    animationForEvent({ hook_event_name: "PreToolUse", tool_name: "mcp__x__y" }),
    null
  );
  assert.equal(animationForEvent({ hook_event_name: "PreToolUse" }), null);
});

test("skips missing, unknown, or Cursor-cased hook_event_name", () => {
  assert.equal(animationForEvent(undefined), null);
  assert.equal(animationForEvent(null), null);
  assert.equal(animationForEvent({}), null);
  assert.equal(animationForEvent({ hook_event_name: "" }), null);
  assert.equal(animationForEvent({ hook_event_name: "PostToolUse" }), null);
  assert.equal(animationForEvent({ hook_event_name: "stop" }), null);
  assert.equal(animationForEvent({ hook_event_name: "constructor" }), null);
});

test("describeFiles reports Write tool_input path", () => {
  const lines = formatFileModifications(
    {
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: "/proj/a.js" },
    },
    createStyle({ color: false }),
  );
  assert.deepEqual(lines, ["✎  touching: /proj/a.js"]);
});

test("usage phrases show the usage bars; other prompts do not", async () => {
  const { usageShowSecondsForEvent, USAGE_COMMAND_SHOW_S } = await import("../src/integrations/claude-code/map.js");
  const ev = (prompt) => ({ hook_event_name: "UserPromptSubmit", prompt });
  for (const prompt of ["usage", "Usage", "  show my usage  ", "check my usage?", "Show My Usage!", "how much usage do I have left?", "what's my usage", "usage limits."]) {
    assert.equal(usageShowSecondsForEvent(ev(prompt)), USAGE_COMMAND_SHOW_S, prompt);
  }
  for (const prompt of ["reduce memory usage in this function", "usage of the api", "show my usage and then fix the bug", "/usage", "usages", ""]) {
    assert.equal(usageShowSecondsForEvent(ev(prompt)), null, prompt);
  }
  assert.equal(usageShowSecondsForEvent({ hook_event_name: "Stop", prompt: "usage" }), null);
  assert.equal(usageShowSecondsForEvent({ hook_event_name: "UserPromptSubmit" }), null);
});

test("claude-code afterPost posts show_for only for usage phrases", async () => {
  const { claudeCode } = await import("../src/integrations/claude-code/index.js");
  const calls = [];
  const post = async (req) => {
    calls.push(req);
    return { ok: true, body: {} };
  };
  const input = (prompt) => ({ event: "UserPromptSubmit", meta: { raw: { hook_event_name: "UserPromptSubmit", prompt } } });
  await claudeCode.afterPost(input("show my usage"), { url: "http://robot" }, { post });
  await claudeCode.afterPost(input("hello"), { url: "http://robot" }, { post });
  assert.deepEqual(calls, [{ url: "http://robot", seconds: 30 }]);
});
