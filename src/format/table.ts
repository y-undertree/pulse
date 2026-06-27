import type { TaskRow } from "../domain/task.js";

const headers = ["ID", "Status", "Agent", "Goal", "Branch", "Title"] as const;
type TableRow = readonly [string, string, string, string, string, string];

export function formatTaskTable(tasks: readonly TaskRow[]): string {
  const data: TableRow[] = tasks.map((task) => [
    String(task.id),
    task.status,
    task.agent ?? "-",
    task.goal ?? "-",
    task.branch ?? "-",
    task.title,
  ]);
  const widths = headers.map((header, index) => columnWidth(header.length, index, data));
  const lines = [formatRow(headers, widths), formatRow(widths.map((width) => "-".repeat(width)), widths)];
  for (const row of data) {
    lines.push(formatRow(row, widths));
  }
  return `${lines.join("\n")}\n`;
}

export function formatRow(values: readonly string[], widths: readonly number[]): string {
  return values.map((value, index) => value.padEnd(widths[index] as number)).join("  ");
}

function columnWidth(minWidth: number, index: number, rows: readonly TableRow[]): number {
  let width = minWidth;
  for (const row of rows) {
    width = Math.max(width, (row[index] as string).length);
  }
  return width;
}
