import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Several Claude Code sessions share one robot. Each hook event carries a
// session_id; this module keeps a small shared record of which sessions are
// working so that one session finishing (ring), closing (sleep) or starting
// (welcome) does not leave the robot idle while another is still busy.

/** Poses that mean "this session is working". */
export const WORKING_ANIMS = new Set(["typing", "reading", "thinking"]);

/**
 * One-shot poses and roughly how long they run before the robot settles
 * (docs/api.md#post-anim). After one plays, a busy session's pose resumes.
 */
export const ONE_SHOT_MS = {
  ring: 2500,
  welcome: 4000,
  wakeup: 7000,
  error: 3000,
  abort: 3500,
  print_start: 3000,
};

/** A session with no events for this long is treated as gone (crash, kill). */
export const STALE_MS = 10 * 60 * 1000;

/**
 * @typedef {{ status: "working" | "waiting" | "idle", anim: string | null, at: number }} SessionRecord
 * @typedef {{ sessions: Record<string, SessionRecord>, lastEventAt: number }} SessionState
 * @typedef {{ post: string | null, resume: { anim: string, afterMs: number } | null }} Plan
 */

/** @returns {SessionState} */
export function emptyState() {
  return { sessions: {}, lastEventAt: 0 };
}

/**
 * Status a session is in after it caused |anim| via |event|.
 * @param {string} event
 * @param {string | null} anim
 * @param {SessionRecord | undefined} previous
 * @returns {SessionRecord["status"]}
 */
function statusAfter(event, anim, previous) {
  if (anim && WORKING_ANIMS.has(anim)) return "working";
  // A failed tool call mid-turn: the turn carries on.
  if (event === "PostToolUseFailure") return "working";
  if (anim === "attention") return "waiting";
  if (anim === null) return previous?.status ?? "idle";
  return "idle";
}

/**
 * The most recent other session that is still working, if any.
 * @param {SessionState} state
 * @param {string} sessionId
 * @returns {SessionRecord | null}
 */
function busyOther(state, sessionId) {
  /** @type {SessionRecord | null} */
  let best = null;
  for (const [id, rec] of Object.entries(state.sessions)) {
    if (id === sessionId || rec.status !== "working" || !rec.anim) continue;
    if (!best || rec.at > best.at) best = rec;
  }
  return best;
}

/**
 * Decide what to post for one hook event and update the shared state.
 * Pure: returns the new state instead of writing it.
 * @param {SessionState} state
 * @param {{ sessionId: string, event: string, anim: string | null }} hook
 * @param {number} nowMs
 * @returns {{ state: SessionState, plan: Plan }}
 */
export function decide(state, hook, nowMs) {
  /** @type {Record<string, SessionRecord>} */
  const sessions = {};
  for (const [id, rec] of Object.entries(state.sessions ?? {})) {
    if (nowMs - rec.at < STALE_MS) sessions[id] = rec;
  }

  const { sessionId, event, anim } = hook;
  const previous = sessions[sessionId];

  if (event === "SessionEnd") {
    delete sessions[sessionId];
  } else {
    const status = statusAfter(event, anim, previous);
    sessions[sessionId] = {
      status,
      // Remember the working pose so other sessions can hand back to it.
      anim: status === "working" ? (anim && WORKING_ANIMS.has(anim) ? anim : previous?.anim ?? "thinking") : null,
      at: nowMs,
    };
  }

  const next = { sessions, lastEventAt: nowMs };
  const other = busyOther(next, sessionId);

  /** @type {Plan} */
  let plan = { post: anim, resume: null };
  if (other?.anim) {
    if (anim === "sleep") {
      // Someone is still working: do not nod off, keep their pose.
      plan = { post: other.anim, resume: null };
    } else if (anim && anim in ONE_SHOT_MS) {
      plan = {
        post: anim,
        resume: { anim: other.anim, afterMs: ONE_SHOT_MS[/** @type {keyof typeof ONE_SHOT_MS} */ (anim)] },
      };
    }
  }

  return { state: next, plan };
}

/**
 * True when a resume planned at |plannedAt| should still run: no newer hook
 * event has taken over the pose, and the session it resumes is still working.
 * @param {SessionState} state
 * @param {number} plannedAt
 * @param {string} anim
 * @returns {boolean}
 */
export function resumeStillValid(state, plannedAt, anim) {
  if ((state.lastEventAt ?? 0) > plannedAt) return false;
  return Object.values(state.sessions ?? {}).some(
    (rec) => rec.status === "working" && rec.anim === anim,
  );
}

/** @returns {string} */
export function defaultSessionStatePath() {
  return join(tmpdir(), "tiny-engineer-claude-sessions.json");
}

/**
 * @param {string} path
 * @returns {SessionState}
 */
export function readSessionState(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (parsed && typeof parsed === "object" && parsed.sessions && typeof parsed.sessions === "object") {
      return { sessions: parsed.sessions, lastEventAt: Number(parsed.lastEventAt) || 0 };
    }
  } catch {
    // missing or corrupt: start fresh
  }
  return emptyState();
}

/**
 * Write via rename so concurrent hooks never read a half-written file.
 * @param {string} path
 * @param {SessionState} state
 */
export function writeSessionState(path, state) {
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, path);
  } catch {
    // Best effort: a lost write only means one stale decision.
  }
}
