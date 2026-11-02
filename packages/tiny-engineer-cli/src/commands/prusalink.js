import crypto from "node:crypto";

import {
  decide,
  defaultSessionStatePath,
  readSessionState,
  resumeStillValid,
  writeSessionState,
} from "../integrations/claude-code/sessions.js";
import { robotSetAnim, formatRobotError } from "../robot/transport.js";
import { createOutput } from "../util/output.js";

// Watches a Prusa printer through PrusaLink's local API (GET /api/v1/status)
// and animates the robot on print start (`print_start`) and finish (`ring`).
// Nothing is posted while a print runs.

export const DEFAULT_INTERVAL_S = 5;
export const DEFAULT_USER = "maker";
/** Shares the robot with Claude Code sessions (see claude-code/sessions.js). */
export const PRINTER_SESSION_ID = "prusalink-printer";

const ACTIVE_STATES = new Set(["PRINTING", "PAUSED"]);

/**
 * Robot animation for a printer state change, or null.
 * A print that is already running when the watcher starts (prev null) is not
 * a new start.
 * @param {string | null} prev
 * @param {string | null} next
 * @returns {"print_start" | "ring" | null}
 */
export function animationForTransition(prev, next) {
  if (!prev || !next || prev === next) return null;
  if (next === "PRINTING" && !ACTIVE_STATES.has(prev)) return "print_start";
  if (next === "FINISHED" && ACTIVE_STATES.has(prev)) return "ring";
  return null;
}

/**
 * Parse a `WWW-Authenticate: Digest ...` header.
 * @param {string | null} header
 * @returns {Record<string, string> | null}
 */
export function parseDigestChallenge(header) {
  if (!header || !/^\s*Digest\s/i.test(header)) return null;
  /** @type {Record<string, string>} */
  const fields = {};
  const re = /(\w+)=(?:"([^"]*)"|([^\s,]+))/g;
  let match;
  while ((match = re.exec(header.replace(/^\s*Digest\s+/i, ""))) !== null) {
    fields[match[1].toLowerCase()] = match[2] ?? match[3];
  }
  return fields.nonce && fields.realm !== undefined ? fields : null;
}

/** @param {string} value */
function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex");
}

/**
 * RFC 2617 / 7616 Digest `Authorization` header value (MD5, qop=auth or none).
 * @param {{ user: string, password: string, method: string, uri: string, challenge: Record<string, string>, cnonce?: string, nc?: number }} params
 * @returns {string}
 */
export function digestAuthorization({ user, password, method, uri, challenge, cnonce, nc = 1 }) {
  const { realm, nonce, opaque } = challenge;
  const qop = challenge.qop
    ?.split(",")
    .map((q) => q.trim())
    .includes("auth")
    ? "auth"
    : null;
  const ha1 = md5(`${user}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const ncHex = nc.toString(16).padStart(8, "0");
  const clientNonce = cnonce ?? crypto.randomBytes(8).toString("hex");
  const response = qop
    ? md5(`${ha1}:${nonce}:${ncHex}:${clientNonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);
  const parts = [
    `username="${user}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
    'algorithm=MD5',
  ];
  if (qop) parts.push(`qop=${qop}`, `nc=${ncHex}`, `cnonce="${clientNonce}"`);
  if (opaque) parts.push(`opaque="${opaque}"`);
  return `Digest ${parts.join(", ")}`;
}

/**
 * Fetch the printer state. Digest auth when a password is given (MK4, Core
 * One, MINI, XL), X-Api-Key when an API key is given (PrusaLink on a Pi).
 * @param {{ url: string, user?: string, password?: string, apiKey?: string, timeoutMs?: number, fetchFn?: typeof fetch }} opts
 * @returns {Promise<string>} printer.state, e.g. "PRINTING"
 */
export async function fetchPrinterState({ url, user = DEFAULT_USER, password, apiKey, timeoutMs = 4000, fetchFn = fetch }) {
  const base = url.replace(/\/+$/, "");
  const uri = "/api/v1/status";
  /** @type {Record<string, string>} */
  const headers = { Accept: "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;

  let res = await fetchFn(base + uri, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 401 && password) {
    const challenge = parseDigestChallenge(res.headers.get("www-authenticate"));
    if (!challenge) throw new Error("printer asked for auth but sent no Digest challenge");
    headers.Authorization = digestAuthorization({ user, password, method: "GET", uri, challenge });
    res = await fetchFn(base + uri, { headers, signal: AbortSignal.timeout(timeoutMs) });
  }
  if (res.status === 401) throw new Error("printer refused the credentials (401)");
  if (!res.ok) throw new Error(`printer answered HTTP ${res.status}`);
  const body = /** @type {{ printer?: { state?: unknown } }} */ (await res.json());
  const state = body?.printer?.state;
  if (typeof state !== "string") throw new Error("printer status has no printer.state");
  return state.toUpperCase();
}

/**
 * Post one printer animation, sharing the robot with Claude Code sessions: if
 * a session is still working, its pose resumes after the one-shot.
 * @param {string} anim
 * @param {{ url?: string, transport?: string, port?: string | null }} robotOpts
 * @param {{ setAnim?: typeof robotSetAnim, statePath?: string, now?: () => number, sleep?: (ms: number) => Promise<void> }} [deps]
 */
export async function postPrinterAnimation(anim, robotOpts, deps = {}) {
  const setAnim = deps.setAnim ?? robotSetAnim;
  const statePath = deps.statePath ?? defaultSessionStatePath();
  const now = (deps.now ?? Date.now)();
  const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  const { state, plan } = decide(
    readSessionState(statePath),
    { sessionId: PRINTER_SESSION_ID, event: "PrinterEvent", anim },
    now,
  );
  writeSessionState(statePath, state);

  const result = plan.post ? await setAnim(plan.post, robotOpts) : { ok: true };
  if (plan.resume) {
    await sleep(plan.resume.afterMs);
    if (resumeStillValid(readSessionState(statePath), now, plan.resume.anim)) {
      await setAnim(plan.resume.anim, robotOpts);
    }
  }
  return result;
}

/**
 * @param {string[]} argv
 */
export function parsePrusaLinkArgs(argv) {
  /** @type {{ printer?: string, user: string, password?: string, apiKey?: string, interval: number, once: boolean, url?: string, transport?: string, quiet: boolean, help: boolean, error?: string }} */
  const opts = {
    printer: process.env.PRUSALINK_URL,
    user: process.env.PRUSALINK_USER || DEFAULT_USER,
    password: process.env.PRUSALINK_PASSWORD,
    apiKey: process.env.PRUSALINK_API_KEY,
    interval: DEFAULT_INTERVAL_S,
    once: false,
    quiet: false,
    help: false,
  };
  const valueFlags = {
    "--printer": "printer",
    "--user": "user",
    "--password": "password",
    "--api-key": "apiKey",
    "--url": "url",
    "--transport": "transport",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const [flag, inline] = arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    if (flag in valueFlags) {
      const value = inline ?? argv[++i];
      if (!value) return { ...opts, error: `${flag} requires a value` };
      opts[valueFlags[flag]] = value;
    } else if (flag === "--interval") {
      const value = Number(inline ?? argv[++i]);
      if (!Number.isFinite(value) || value < 1 || value > 300) return { ...opts, error: "--interval must be 1-300 seconds" };
      opts.interval = value;
    } else if (flag === "--once") {
      opts.once = true;
    } else if (flag === "-q" || flag === "--quiet") {
      opts.quiet = true;
    } else if (flag === "-h" || flag === "--help") {
      opts.help = true;
    } else {
      return { ...opts, error: `unknown option: ${arg}` };
    }
  }
  if (!opts.help && !opts.printer) return { ...opts, error: "--printer <http://printer-ip> (or PRUSALINK_URL) is required" };
  if (!opts.help && !opts.password && !opts.apiKey) {
    return { ...opts, error: "--password (or PRUSALINK_PASSWORD), or --api-key (PRUSALINK_API_KEY), is required" };
  }
  return opts;
}

const HELP = `Usage: tiny-engineer prusalink --printer <http://printer-ip> --password <pw> [options]

Watch a Prusa printer through PrusaLink and animate the robot:
  print starts   -> print_start (fist pump, wink)
  print finishes -> ring (bell)
Nothing plays while a print runs. Runs until stopped (Ctrl+C).

Options:
  --printer <url>         Printer base URL (or PRUSALINK_URL)
  --user <name>           Digest user (default: ${DEFAULT_USER}; or PRUSALINK_USER)
  --password <pw>         PrusaLink password from the printer's network
                          settings (or PRUSALINK_PASSWORD) — MK4, Core One, MINI, XL
  --api-key <key>         X-Api-Key instead of a password (or PRUSALINK_API_KEY)
  --interval <s>          Poll interval, 1-300 (default ${DEFAULT_INTERVAL_S})
  --once                  Print the current state and exit
  --url <base>            Robot URL (default: TINY_ENGINEER_URL / user config)
  -q, --quiet             Only print errors
`;

/**
 * @param {import("../util/output.js").Output} out
 * @param {string[]} argv
 * @param {boolean} quietGlobal
 */
export async function runPrusaLink(out, argv, quietGlobal) {
  const opts = parsePrusaLinkArgs(argv);
  const quiet = quietGlobal || opts.quiet;
  const log = quiet === out.quiet ? out : createOutput({ quiet, style: out.style });

  if (opts.help) {
    console.log(HELP);
    return;
  }
  if (opts.error) {
    log.error(opts.error);
    process.exitCode = 1;
    return;
  }

  const printer = { url: /** @type {string} */ (opts.printer), user: opts.user, password: opts.password, apiKey: opts.apiKey };
  const robotOpts = { url: opts.url, transport: opts.transport };
  const stamp = () => new Date().toLocaleTimeString();

  if (opts.once) {
    try {
      log.ok(`printer state: ${await fetchPrinterState(printer)}`);
      process.exitCode = 0;
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
    return;
  }

  log.info(`watching ${printer.url} every ${opts.interval}s (Ctrl+C to stop)`);
  /** @type {string | null} */
  let prev = null;
  let lastError = "";
  for (;;) {
    try {
      const state = await fetchPrinterState(printer);
      if (lastError) log.info(`${stamp()} printer reachable again`);
      lastError = "";
      if (state !== prev) log.info(`${stamp()} printer ${prev ?? "(start)"} -> ${state}`);
      const anim = animationForTransition(prev, state);
      prev = state;
      if (anim) {
        const result = await postPrinterAnimation(anim, robotOpts);
        if (result.ok) log.ok(`${stamp()} robot: ${anim}`);
        else log.error(`robot: ${formatRobotError(result)}`);
      }
    } catch (err) {
      // Keep the last state: a printer that drops off Wi-Fi mid-print and comes
      // back still counts as the same print.
      const message = err instanceof Error ? err.message : String(err);
      if (message !== lastError) log.error(`${stamp()} ${message}`);
      lastError = message;
    }
    await new Promise((resolve) => setTimeout(resolve, opts.interval * 1000));
  }
}
