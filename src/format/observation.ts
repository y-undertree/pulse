import { countTasksByStatus, validStatuses, type TaskRow, type TaskStatus } from "../domain/task.js";

const attentionStatuses = new Set<TaskStatus>(["blocked", "review"]);

export function formatStatus(tasks: readonly TaskRow[]): string {
  const lines = ["Pulse Status", "", "Counts", ...formatCounts(tasks)];
  if (tasks.length === 0) {
    lines.push("", "No tasks.");
    return `${lines.join("\n")}\n`;
  }

  appendStatusSection(lines, "Attention", tasks.filter((task) => attentionStatuses.has(task.status)));
  appendStatusSection(lines, "Active", tasks.filter((task) => task.status === "claimed"));
  appendStatusSection(lines, "Backlog", tasks.filter((task) => task.status === "todo"));
  appendStatusSection(lines, "Done", tasks.filter((task) => task.status === "done"));
  return `${lines.join("\n")}\n`;
}

export function formatSummary(tasks: readonly TaskRow[]): string {
  if (tasks.length === 0) {
    return "Pulse Summary\n\nNo tasks.\n";
  }

  const lines = ["Pulse Summary", "", `${tasks.length} task(s): ${formatCountSentence(tasks)}.`];
  const attention = tasks.filter((task) => attentionStatuses.has(task.status));
  const active = tasks.filter((task) => task.status === "claimed");
  const nextTodo = tasks.find((task) => task.status === "todo");

  lines.push(`Needs attention: ${formatTaskList(attention)}.`);
  lines.push(`Active agents: ${formatActiveAgents(active)}.`);
  lines.push(`Next todo: ${nextTodo === undefined ? "none" : formatTaskReference(nextTodo)}.`);
  return `${lines.join("\n")}\n`;
}

function formatCounts(tasks: readonly TaskRow[]): string[] {
  const counts = countTasksByStatus(tasks);
  return validStatuses.map((status) => `- ${status}: ${counts[status]}`);
}

function formatCountSentence(tasks: readonly TaskRow[]): string {
  const counts = countTasksByStatus(tasks);
  return validStatuses.map((status) => `${counts[status]} ${status}`).join(", ");
}

function appendStatusSection(lines: string[], title: string, tasks: readonly TaskRow[]): void {
  lines.push("", title);
  if (tasks.length === 0) {
    lines.push("- none");
    return;
  }
  for (const task of tasks) {
    lines.push(formatStatusLine(task));
  }
}

function formatStatusLine(task: TaskRow): string {
  const owner = task.agent ?? "-";
  const branch = task.branch ?? "-";
  const heartbeat = task.last_heartbeat_at ?? "-";
  return `- #${task.id} [${task.status}] ${task.title} | agent=${owner} | branch=${branch} | heartbeat=${heartbeat}`;
}

function formatTaskList(tasks: readonly TaskRow[]): string {
  if (tasks.length === 0) {
    return "none";
  }
  return tasks.map(formatTaskReference).join("; ");
}

function formatActiveAgents(tasks: readonly TaskRow[]): string {
  if (tasks.length === 0) {
    return "none";
  }
  return tasks.map((task) => `${task.agent ?? "-"} on ${formatTaskReference(task)}`).join("; ");
}

function formatTaskReference(task: TaskRow): string {
  return `#${task.id} ${task.title}`;
}
