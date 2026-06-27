import { parseTaskStatus, type TaskRow } from "../domain/task.js";

export function toTaskRow(row: unknown): TaskRow {
  if (typeof row !== "object" || row === null) {
    throw new Error("database returned an invalid task row");
  }
  const record = row as Record<string, unknown>;
  return {
    id: asNumber(record.id, "id"),
    title: asString(record.title, "title"),
    goal: asNullableString(record.goal, "goal"),
    status: parseTaskStatus(asString(record.status, "status")),
    context: asNullableString(record.context, "context"),
    agent: asNullableString(record.agent, "agent"),
    repo: asNullableString(record.repo, "repo"),
    worktree: asNullableString(record.worktree, "worktree"),
    branch: asNullableString(record.branch, "branch"),
    blocked_reason: asNullableString(record.blocked_reason, "blocked_reason"),
    review_note: asNullableString(record.review_note, "review_note"),
    done_note: asNullableString(record.done_note, "done_note"),
    created_at: asString(record.created_at, "created_at"),
    updated_at: asString(record.updated_at, "updated_at"),
    claimed_at: asNullableString(record.claimed_at, "claimed_at"),
    released_at: asNullableString(record.released_at, "released_at"),
    blocked_at: asNullableString(record.blocked_at, "blocked_at"),
    review_at: asNullableString(record.review_at, "review_at"),
    done_at: asNullableString(record.done_at, "done_at"),
    last_heartbeat_at: asNullableString(record.last_heartbeat_at, "last_heartbeat_at"),
    heartbeat_note: asNullableString(record.heartbeat_note, "heartbeat_note"),
  };
}

export function asString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`database column ${name} is not a string`);
  }
  return value;
}

export function asNullableString(value: unknown, name: string): string | null {
  if (value === null) {
    return null;
  }
  return asString(value, name);
}

export function asNumber(value: unknown, name: string): number {
  if (typeof value !== "number") {
    throw new Error(`database column ${name} is not a number`);
  }
  return value;
}
