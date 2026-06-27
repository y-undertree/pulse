export const statusOrder = {
  blocked: 0,
  review: 1,
  claimed: 2,
  todo: 3,
  done: 4,
} as const;

export type TaskStatus = keyof typeof statusOrder;

export const validStatuses = Object.keys(statusOrder) as TaskStatus[];

export interface TaskInput {
  readonly title: string;
  readonly goal?: string | undefined;
  readonly context?: string | undefined;
  readonly agent?: string | undefined;
  readonly repo?: string | undefined;
  readonly worktree?: string | undefined;
  readonly branch?: string | undefined;
}

export interface TaskRow {
  readonly id: number;
  readonly title: string;
  readonly goal: string | null;
  readonly status: TaskStatus;
  readonly context: string | null;
  readonly agent: string | null;
  readonly repo: string | null;
  readonly worktree: string | null;
  readonly branch: string | null;
  readonly blocked_reason: string | null;
  readonly review_note: string | null;
  readonly done_note: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly claimed_at: string | null;
  readonly released_at: string | null;
  readonly blocked_at: string | null;
  readonly review_at: string | null;
  readonly done_at: string | null;
  readonly last_heartbeat_at: string | null;
  readonly heartbeat_note: string | null;
}

export function isTaskStatus(value: string): value is TaskStatus {
  return validStatuses.includes(value as TaskStatus);
}

export function parseTaskStatus(value: string): TaskStatus {
  if (!isTaskStatus(value)) {
    throw new Error(`status must be one of: ${validStatuses.join(", ")}`);
  }
  return value;
}

export function emptyStatusCounts(): Record<TaskStatus, number> {
  return Object.fromEntries(validStatuses.map((status) => [status, 0])) as Record<TaskStatus, number>;
}

export function countTasksByStatus(tasks: readonly TaskRow[]): Record<TaskStatus, number> {
  const counts = emptyStatusCounts();
  for (const task of tasks) {
    counts[task.status] += 1;
  }
  return counts;
}
