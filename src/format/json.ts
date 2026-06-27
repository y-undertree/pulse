import type { TaskRow } from "../domain/task.js";

export function formatJson(tasks: readonly TaskRow[]): string {
  return JSON.stringify(tasks, null, 2);
}
