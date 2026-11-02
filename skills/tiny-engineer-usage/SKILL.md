---
name: tiny-engineer-usage
description: Show the user's Claude usage limits (5-hour and weekly) on the Tiny Engineer desk robot's OLED and report the numbers. Use whenever the user asks to "show usage", "check my usage", "how much usage do I have left", "usage limits", or to put their usage on the robot. Do not answer that you cannot see the plan or limits: the robot holds them.
---

# Tiny Engineer: show Claude usage limits

The robot already knows the user's Claude.ai usage: Claude Code's status line runs `tiny-engineer statusline`, which sends the 5-hour and weekly `rate_limits` to the robot in the background. Showing them is one command, and its output contains the numbers, so you can both put the bars on the robot and tell the user the percentages.

## Run it

```bash
tiny-engineer usage        # bars on the OLED for 15 s
tiny-engineer usage 60     # longer (max 600 s)
tiny-engineer usage off    # hide now
```

If `tiny-engineer` is not on PATH, use `npx -y tiny-engineer usage` or `node <firmware checkout>/packages/tiny-engineer-cli/bin/tiny-engineer.js usage`. The robot URL and token come from the CLI's user config; no flags needed.

## Read the result

| Output | Tell the user |
| --- | --- |
| `showing 5h 32% · wk 27% for 15s` | Those percentages: 5-hour window and weekly window used, now on the robot's screen |
| `... but no usage yet (the status line sends it after a reply)` | The robot has no numbers yet (it rebooted, or the status line has not run since); they arrive within a minute of the next Claude Code reply. Meanwhile `/usage` in Claude Code shows them |
| `robot has no 128x64 OLED` | The numbers are stored but this robot's screen cannot draw them |
| `robot unreachable` | Robot is off or the URL changed; check `tiny-engineer doctor` |

The bars only draw while the robot's screen is on (a user prompt wakes it). Reset times are on the user's Claude Code status line (`5h 32% (1h54m) · wk 27% (3d6h)`).

## Setup (once)

1. Status line in `~/.claude/settings.json`: `{"statusLine": {"type": "command", "command": "tiny-engineer statusline", "refreshInterval": 60}}` (or the `node …/tiny-engineer.js statusline` form).
2. Details: [docs/integration.md](../../docs/integration.md#usage-limits-on-the-oled).
