import { getBaseUrl, getHttpAuthToken, resolveTransport } from "../config/env.js";
import { robotFetch } from "../robot/client.js";
import { parseCommonArgs } from "../util/args.js";
import { createOutput } from "../util/output.js";

/** Firmware cap for `show_for` (docs/api.md#post-usage). */
export const SHOW_FOR_MAX_S = 600;
export const SHOW_FOR_DEFAULT_S = 15;

/**
 * @param {string | undefined} arg
 * @returns {{ seconds: number } | { error: string }}
 */
export function parseShowSeconds(arg) {
  if (arg === undefined) return { seconds: SHOW_FOR_DEFAULT_S };
  if (arg === "off" || arg === "hide") return { seconds: 0 };
  if (!/^\d+$/.test(arg)) return { error: `seconds must be a whole number, or "off": ${arg}` };
  const seconds = Number(arg);
  if (seconds > SHOW_FOR_MAX_S) return { error: `seconds must be 0–${SHOW_FOR_MAX_S}` };
  return { seconds };
}

/**
 * Human summary of a POST /usage reply.
 * @param {Record<string, unknown>} body
 * @param {number} seconds
 * @returns {string}
 */
export function describeReply(body, seconds) {
  if (seconds === 0) return "usage bars hidden";
  if (body.shown === false) return "robot has no 128x64 OLED; usage bars not drawn";
  const parts = [];
  for (const [key, label] of [
    ["five_hour", "5h"],
    ["seven_day", "wk"],
  ]) {
    const w = /** @type {{ used_percentage?: number } | null | undefined} */ (body[key]);
    if (w && typeof w.used_percentage === "number") parts.push(`${label} ${Math.round(w.used_percentage)}%`);
  }
  if (parts.length === 0) {
    return `showing for ${seconds}s, but no usage yet (the status line sends it after a reply)`;
  }
  return `showing ${parts.join(" · ")} for ${seconds}s`;
}

/**
 * @param {{ url?: string, seconds: number }} request
 * @returns {Promise<{ ok: true, body: Record<string, unknown> } | { ok: false, error: string }>}
 */
export async function postShow({ url, seconds }) {
  try {
    const res = await robotFetch(
      url ?? getBaseUrl(),
      "/usage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show_for: seconds }),
        signal: AbortSignal.timeout(3000),
      },
      getHttpAuthToken({ urlOverride: url !== undefined }),
    );
    const text = await res.text();
    /** @type {Record<string, unknown>} */
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      // not JSON
    }
    if (!res.ok) {
      return { ok: false, error: typeof body.error === "string" ? body.error : `HTTP ${res.status}` };
    }
    return { ok: true, body };
  } catch (err) {
    return { ok: false, error: `robot unreachable: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * `tiny-engineer usage [seconds|off]`: show the usage bars on the OLED for a
 * while (default 15 s). The numbers come from `tiny-engineer statusline`.
 * @param {import("../util/output.js").Output} out
 * @param {string[]} argv
 * @param {boolean} quietGlobal
 * @param {{ post?: typeof postShow }} [deps]
 */
export async function runUsage(out, argv, quietGlobal, deps = {}) {
  const opts = parseCommonArgs(argv);
  const quiet = quietGlobal || opts.quiet;
  const localOut = quiet === out.quiet ? out : createOutput({ quiet, style: out.style });

  if (opts.error) {
    localOut.error(opts.error);
    process.exitCode = 1;
    return;
  }
  if (opts.help) {
    console.log(`Usage: tiny-engineer usage [seconds|off] [--url <base>]

Show Claude usage limits on the robot's 128x64 OLED for <seconds>
(default ${SHOW_FOR_DEFAULT_S}, max ${SHOW_FOR_MAX_S}); "off" hides them now.
Numbers come from \`tiny-engineer statusline\` (Claude Code status line). HTTP only.`);
    return;
  }

  const parsed = parseShowSeconds(opts.rest[0]);
  if ("error" in parsed) {
    localOut.error(parsed.error);
    process.exitCode = 1;
    return;
  }

  const resolved = resolveTransport(opts.transport);
  if (resolved.error) {
    localOut.error(resolved.error);
    process.exitCode = 1;
    return;
  }
  if (resolved.transport !== "http") {
    localOut.error("usage needs the HTTP transport");
    process.exitCode = 1;
    return;
  }

  const result = await (deps.post ?? postShow)({ url: opts.url, seconds: parsed.seconds });
  if (!result.ok) {
    localOut.error(result.error);
    process.exitCode = 1;
    return;
  }
  localOut.ok(describeReply(result.body, parsed.seconds));
  process.exitCode = 0;
}
