import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getBaseUrl, getHttpAuthToken, resolveTransport } from "../config/env.js";
import { robotFetch } from "../robot/client.js";
import { readStdin } from "../util/stdin.js";

/** Firmware cap for `resets_in` (docs/api.md#post-usage). */
export const RESETS_IN_MAX_S = 8 * 24 * 60 * 60;

/** Re-send unchanged numbers this often so a rebooted robot catches up. */
export const RESEND_AFTER_MS = 5 * 60 * 1000;

const POST_TIMEOUT_MS = 1500;

const WINDOWS = /** @type {const} */ (["five_hour", "seven_day"]);

/**
 * @typedef {{ used_percentage: number, resets_in: number }} UsageWindow
 * @typedef {{ five_hour: UsageWindow | null, seven_day: UsageWindow | null }} UsagePayload
 */

/**
 * One rate-limit window from Claude Code's status line JSON, or null when it is
 * missing, malformed, or already reset.
 * @param {unknown} raw
 * @param {number} nowSec
 * @returns {UsageWindow | null}
 */
function readWindow(raw, nowSec) {
  if (!raw || typeof raw !== "object") return null;
  const { used_percentage: pct, resets_at: resetsAt } = /** @type {Record<string, unknown>} */ (raw);
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt)) return null;
  const resetsIn = Math.round(resetsAt - nowSec);
  if (resetsIn < 1) return null;
  return {
    used_percentage: Math.min(100, Math.max(0, Math.round(pct * 10) / 10)),
    resets_in: Math.min(RESETS_IN_MAX_S, resetsIn),
  };
}

/**
 * Body for POST /usage, or null when the status line JSON has no `rate_limits`
 * (API-key billing, or before the first response). Null means "send nothing",
 * so the robot keeps whatever it last showed.
 * @param {unknown} input parsed status line JSON
 * @param {number} nowSec Unix seconds
 * @returns {UsagePayload | null}
 */
export function usagePayload(input, nowSec) {
  const limits = /** @type {Record<string, unknown> | undefined} */ (
    input && typeof input === "object" ? /** @type {Record<string, unknown>} */ (input).rate_limits : undefined
  );
  if (!limits || typeof limits !== "object") return null;
  return {
    five_hour: readWindow(limits.five_hour, nowSec),
    seven_day: readWindow(limits.seven_day, nowSec),
  };
}

/**
 * @param {number} seconds
 * @returns {string} e.g. "2h14m", "3d4h", "45m"
 */
export function formatDuration(seconds) {
  const m = Math.max(0, Math.floor(seconds / 60));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d${h}h`;
  if (h > 0) return `${h}h${String(m % 60).padStart(2, "0")}m`;
  return `${m}m`;
}

/**
 * Terminal status line: model, then each usage window with its reset countdown.
 * @param {unknown} input
 * @param {UsagePayload | null} payload
 * @returns {string}
 */
export function formatStatusLine(input, payload) {
  const model =
    input && typeof input === "object"
      ? /** @type {{ model?: { display_name?: unknown } }} */ (input).model?.display_name
      : undefined;
  const parts = [typeof model === "string" && model ? model : "Claude"];
  if (payload?.five_hour) {
    parts.push(`5h ${Math.round(payload.five_hour.used_percentage)}% (${formatDuration(payload.five_hour.resets_in)})`);
  }
  if (payload?.seven_day) {
    parts.push(`wk ${Math.round(payload.seven_day.used_percentage)}% (${formatDuration(payload.seven_day.resets_in)})`);
  }
  return parts.join(" · ");
}

/**
 * What decides "changed": rounded percentages and which windows exist, not the
 * countdown (the robot counts down on its own).
 * @param {UsagePayload} payload
 * @returns {string}
 */
export function payloadKey(payload) {
  return WINDOWS.map((w) => {
    const win = payload[w];
    return win ? `${w}:${Math.round(win.used_percentage)}` : `${w}:-`;
  }).join("|");
}

/**
 * @param {string} key
 * @param {{ key?: string, at?: number } | null} last
 * @param {number} nowMs
 * @returns {boolean}
 */
export function shouldSend(key, last, nowMs) {
  if (!last || last.key !== key) return true;
  return typeof last.at !== "number" || nowMs - last.at >= RESEND_AFTER_MS;
}

/** @returns {string} */
export function defaultStatePath() {
  return join(tmpdir(), "tiny-engineer-usage.json");
}

/**
 * @param {string} path
 * @returns {{ key?: string, at?: number } | null}
 */
function readState(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * `tiny-engineer statusline`: Claude Code `statusLine` command. Prints the
 * status line first, then (HTTP transport only) POSTs /usage when the numbers
 * changed. Fail-open: an offline robot never delays or breaks the status line.
 * @param {string[]} argv
 * @param {{ stdinText?: string, nowMs?: number, statePath?: string, write?: (line: string) => unknown, post?: (payload: UsagePayload) => Promise<boolean> }} [deps]
 */
export async function runStatusline(argv, deps = {}) {
  const stdinText = deps.stdinText ?? (await readStdin());
  const nowMs = deps.nowMs ?? Date.now();
  // Wait for the flush: the CLI exits hard afterwards, and piped stdout is
  // asynchronous on some platforms.
  const write =
    deps.write ??
    ((line) => new Promise((resolve) => process.stdout.write(`${line}\n`, () => resolve(undefined))));

  /** @type {unknown} */
  let input = null;
  try {
    input = stdinText.trim() ? JSON.parse(stdinText) : null;
  } catch {
    input = null;
  }

  const payload = usagePayload(input, nowMs / 1000);
  await write(formatStatusLine(input, payload));

  if (!payload || argv.includes("--no-robot")) return;

  const statePath = deps.statePath ?? defaultStatePath();
  const key = payloadKey(payload);
  if (!shouldSend(key, readState(statePath), nowMs)) return;

  const post = deps.post ?? postUsage;
  if (await post(payload)) {
    try {
      writeFileSync(statePath, JSON.stringify({ key, at: nowMs }));
    } catch {
      // A missing cache only means the next refresh sends again.
    }
  }
}

/**
 * @param {UsagePayload} payload
 * @returns {Promise<boolean>} true when the robot accepted it
 */
async function postUsage(payload) {
  const resolved = resolveTransport(undefined);
  if (resolved.error || resolved.transport !== "http") return false;
  try {
    const res = await robotFetch(
      getBaseUrl(),
      "/usage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(POST_TIMEOUT_MS),
      },
      getHttpAuthToken({ urlOverride: false }),
    );
    return res.ok;
  } catch {
    return false;
  }
}
