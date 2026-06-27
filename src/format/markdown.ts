import { countTasksByStatus, validStatuses, type TaskRow } from "../domain/task.js";
import { utcNow } from "../shared/clock.js";

export function formatMarkdown(tasks: readonly TaskRow[], generatedAt: string = utcNow()): string {
  const counts = countTasksByStatus(tasks);
  const lines = ["# Pulse State", "", `Generated: ${generatedAt}`, "", "## Summary", ""];
  for (const status of validStatuses) {
    lines.push(`- ${status}: ${counts[status]}`);
  }
  lines.push("", "## Tasks", "");

  if (tasks.length === 0) {
    lines.push("_No tasks._");
    return `${lines.join("\n")}\n`;
  }

  for (const task of tasks) {
    lines.push(...formatTaskSection(task));
  }

  return lines.join("\n");
}

export function formatTaskSection(task: TaskRow): string[] {
  const lines = [
    `### #${task.id} ${task.title}`,
    "",
    `- Status: ${task.status}`,
    `- Agent: ${task.agent ?? "-"}`,
    `- Goal: ${task.goal ?? "-"}`,
    `- Repo: ${task.repo ?? "-"}`,
    `- Worktree: ${task.worktree ?? "-"}`,
    `- Branch: ${task.branch ?? "-"}`,
    `- Updated: ${task.updated_at}`,
  ];
  appendOptionalLine(lines, "Blocked reason", task.blocked_reason);
  appendOptionalLine(lines, "Review note", task.review_note);
  appendOptionalLine(lines, "Last heartbeat", task.last_heartbeat_at);
  appendOptionalLine(lines, "Heartbeat note", task.heartbeat_note);
  if (task.context !== null) {
    lines.push("", task.context);
  }
  lines.push("");
  return lines;
}

function appendOptionalLine(lines: string[], label: string, value: string | null): void {
  if (value !== null) {
    lines.push(`- ${label}: ${value}`);
  }
}
