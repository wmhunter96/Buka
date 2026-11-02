import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  ONE_SHOT_MS,
  STALE_MS,
  decide,
  emptyState,
  readSessionState,
  resumeStillValid,
  writeSessionState,
} from "../src/integrations/claude-code/sessions.js";

/** Run a sequence of [sessionId, event, anim] and return the last result. */
function run(steps, start = emptyState(), t0 = 1_000_000) {
  let state = start;
  let last;
  steps.forEach(([sessionId, event, anim], i) => {
    last = decide(state, { sessionId, event, anim }, t0 + i * 1000);
    state = last.state;
  });
  return last;
}

test("single session: poses pass through unchanged", () => {
  for (const anim of ["typing", "reading", "thinking", "ring", "sleep", "welcome", "attention"]) {
    const { plan } = run([["a", "X", anim]]);
    assert.deepEqual(plan, { post: anim, resume: null }, anim);
  }
});

test("A finishes while B works: bell, then B's pose resumes", () => {
  const { plan } = run([
    ["b", "PreToolUse", "typing"],
    ["a", "PreToolUse", "reading"],
    ["a", "Stop", "ring"],
  ]);
  assert.deepEqual(plan, { post: "ring", resume: { anim: "typing", afterMs: ONE_SHOT_MS.ring } });
});

test("A closes while B works: no sleep, B's pose instead", () => {
  const { plan, state } = run([
    ["b", "PreToolUse", "reading"],
    ["a", "SessionEnd", "sleep"],
  ]);
  assert.deepEqual(plan, { post: "reading", resume: null });
  assert.equal(state.sessions.a, undefined);
});

test("new session starts while B works: welcome, then back to work", () => {
  const { plan } = run([
    ["b", "PostToolBatch", "thinking"],
    ["a", "SessionStart", "welcome"],
  ]);
  assert.deepEqual(plan, { post: "welcome", resume: { anim: "thinking", afterMs: ONE_SHOT_MS.welcome } });
});

test("both finished: the last bell stands and sleep is allowed", () => {
  const rang = run([
    ["a", "PreToolUse", "typing"],
    ["b", "PreToolUse", "typing"],
    ["a", "Stop", "ring"],
    ["b", "Stop", "ring"],
  ]);
  assert.deepEqual(rang.plan, { post: "ring", resume: null });

  const slept = run([["b", "SessionEnd", "sleep"]], rang.state, 2_000_000);
  assert.deepEqual(slept.plan, { post: "sleep", resume: null });
});

test("the most recently active working session is resumed", () => {
  const { plan } = run([
    ["b", "PreToolUse", "typing"],
    ["c", "PreToolUse", "reading"],
    ["a", "Stop", "ring"],
  ]);
  assert.equal(plan.resume?.anim, "reading");
});

test("a waiting (permission) session does not count as working", () => {
  const { plan } = run([
    ["b", "PermissionRequest", "attention"],
    ["a", "Stop", "ring"],
  ]);
  assert.deepEqual(plan, { post: "ring", resume: null });
});

test("a failed tool call keeps the session working with its last pose", () => {
  const { plan } = run([
    ["b", "PreToolUse", "typing"],
    ["b", "PostToolUseFailure", "error"],
    ["a", "Stop", "ring"],
  ]);
  assert.equal(plan.resume?.anim, "typing");
});

test("unmapped events keep a session alive without changing its status", () => {
  const { state } = run([
    ["b", "PreToolUse", "typing"],
    ["b", "PreToolUse", null],
  ]);
  assert.equal(state.sessions.b.status, "working");
  assert.equal(state.sessions.b.anim, "typing");
});

test("stale sessions are dropped", () => {
  const first = run([["b", "PreToolUse", "typing"]]);
  const later = decide(first.state, { sessionId: "a", event: "Stop", anim: "ring" }, 1_000_000 + STALE_MS + 1);
  assert.deepEqual(later.plan, { post: "ring", resume: null });
  assert.equal(later.state.sessions.b, undefined);
});

test("resumeStillValid: a newer event or a finished session cancels the hand-back", () => {
  const { state } = run([
    ["b", "PreToolUse", "typing"],
    ["a", "Stop", "ring"],
  ]);
  const plannedAt = state.lastEventAt;
  assert.equal(resumeStillValid(state, plannedAt, "typing"), true);

  const newer = decide(state, { sessionId: "b", event: "PreToolUse", anim: "reading" }, plannedAt + 500).state;
  assert.equal(resumeStillValid(newer, plannedAt, "typing"), false);

  const bDone = { ...state, sessions: { ...state.sessions, b: { ...state.sessions.b, status: "idle" } } };
  assert.equal(resumeStillValid(bDone, plannedAt, "typing"), false);
});

test("state round-trips through the file and survives corruption", () => {
  const dir = mkdtempSync(join(tmpdir(), "te-sessions-"));
  const path = join(dir, "s.json");
  assert.deepEqual(readSessionState(path), emptyState());
  const { state } = run([["b", "PreToolUse", "typing"]]);
  writeSessionState(path, state);
  assert.deepEqual(readSessionState(path), state);
});
