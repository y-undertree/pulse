---
name: pulse-shared-state
description: Use when Codex needs to coordinate coding work through the Pulse CLI shared state: inspect pulse status or summary, create or claim tasks, update heartbeat, mark blocked/review/done, or keep multi-agent repo work observable.
---

# Pulse Shared State

## Overview

Use Pulse as the lightweight shared state layer for multi-agent coding work. Keep the human-facing state current without requiring the human to reopen every chat history.

## Workflow

1. Inspect state before changing files:

```bash
pulse summary
pulse status
```

2. Reuse an existing task when it matches the work. Do not create duplicate tasks just because the title wording differs.

```bash
pulse claim <task-id> --agent <agent-name> --note "starting work"
```

3. Create a new task only when no suitable task exists. Record repo, worktree, branch, goal, and context when they are cheaply knowable.

```bash
pulse add "<task title>" \
  --goal "<goal>" \
  --context "<short context>" \
  --repo "<repo name>" \
  --worktree "$(pwd)" \
  --branch "$(git branch --show-current)" \
  --agent <agent-name>
```

4. Update heartbeat when the meaningful working state changes or long-running work continues.

```bash
pulse beat <task-id> --agent <agent-name> --note "<current progress>"
```

5. Use explicit state transitions.

```bash
pulse block <task-id> --agent <agent-name> --reason "<decision or input needed>"
pulse review <task-id> --agent <agent-name> --note "<what the human should review>"
pulse done <task-id> --agent <agent-name> --note "<verification or outcome>"
```

## Rules

- Use the current agent name, for example `codex`, `claude`, or `gemini`.
- Prefer `review` over `done` when human review, PR review, merge, or a decision is still pending.
- Use `block` when progress depends on a human decision, unavailable external input, or an unresolved environment problem.
- Do not invent repo, worktree, branch, or verification facts. If a value is unknown, omit it or state the uncertainty in `--note`.
- Do not store the Pulse SQLite database inside the Git repo. Use `--db`, `PULSE_DB`, or the default `~/.pulse/pulse.db`.
- If `pulse` is not available, report that clearly. In this repo, `npm run link:local` installs the command and this skill together.

## Output Expectations

- Mention the Pulse task id in status updates and final replies when a task was claimed or created.
- Include any Pulse command failure in the final reply with the command intent and error summary.
- Keep Pulse updates truthful and compact; the goal is observability, not a second chat transcript.
