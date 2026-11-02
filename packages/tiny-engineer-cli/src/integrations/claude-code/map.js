export const READING_TOOLS = new Set([
  "Read",
  "Grep",
  "Glob",
  "WebFetch",
  "WebSearch",
]);

export const TYPING_TOOLS = new Set([
  "Bash",
  "PowerShell",
  "Edit",
  "Write",
  "NotebookEdit",
]);

const EVENT_ANIM = new Map([
  ["UserPromptSubmit", "reading"],
  ["SubagentStart", "thinking"],
  ["PostToolBatch", "thinking"],
  ["PostToolUseFailure", "error"],
  ["PreCompact", "thinking"],
  ["PermissionRequest", "attention"],
  ["PermissionDenied", "abort"],
  ["Notification", "attention"],
  ["Stop", "ring"],
  ["StopFailure", "error"],
]);

/** How long a usage request shows the robot's usage bars. */
export const USAGE_COMMAND_SHOW_S = 30;

/**
 * Whole messages that ask for usage. Only an exact message (ignoring case,
 * surrounding whitespace and trailing punctuation) counts, so a prompt that
 * merely mentions usage ("reduce memory usage in ...") never triggers it.
 * Claude Code's built-in /usage never reaches hooks, so it is not listed.
 */
export const USAGE_PHRASES = new Set([
  "usage",
  "my usage",
  "show usage",
  "show my usage",
  "check usage",
  "check my usage",
  "usage limits",
  "my usage limits",
  "show my usage limits",
  "check my usage limits",
  "how much usage do i have",
  "how much usage do i have left",
  "how much usage is left",
  "usage left",
  "whats my usage",
  "what's my usage",
  "what is my usage",
]);

/**
 * @param {string} prompt
 * @returns {string}
 */
export function normalizeUsagePrompt(prompt) {
  return prompt.trim().toLowerCase().replace(/[\s]+/g, " ").replace(/[.?!]+$/, "").trim();
}

/**
 * Seconds to show the usage bars for this event, or null: a prompt that is
 * exactly one of USAGE_PHRASES puts the 5-hour/weekly bars on the robot right
 * away (the tiny-engineer-usage skill then reports the numbers).
 * @param {{ hook_event_name?: string, prompt?: unknown }} event
 * @returns {number | null}
 */
export function usageShowSecondsForEvent(event) {
  if (event?.hook_event_name !== "UserPromptSubmit" || typeof event.prompt !== "string") return null;
  return USAGE_PHRASES.has(normalizeUsagePrompt(event.prompt)) ? USAGE_COMMAND_SHOW_S : null;
}

/**
 * Map a Claude Code hook payload to an animation name, or null to skip.
 * @param {{ hook_event_name?: string, tool_name?: string, source?: string, reason?: string }} event
 * @returns {string | null}
 */
export function animationForEvent(event) {
  const name = event?.hook_event_name;
  if (!name) return null;

  if (name === "PreToolUse") {
    const tool = event.tool_name;
    if (READING_TOOLS.has(tool)) return "reading";
    if (TYPING_TOOLS.has(tool)) return "typing";
    return null;
  }

  // Only a fresh launch welcomes; resume, /clear, compaction, fork, or an
  // unknown source wakes up, so one session never plays welcome twice.
  if (name === "SessionStart") {
    return event.source === "startup" ? "welcome" : "wakeup";
  }

  // /clear and /resume end one session and start the next at once. The
  // SessionStart that follows owns the pose; a sleep posted alongside it makes
  // the robot drop the wakeup, so skip it.
  if (name === "SessionEnd") {
    return event.reason === "clear" || event.reason === "resume" ? null : "sleep";
  }

  return EVENT_ANIM.get(name) ?? null;
}
