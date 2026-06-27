import type { DatabaseSync } from "node:sqlite";

import { parseTaskStatus, type TaskInput, type TaskRow, type TaskStatus } from "../domain/task.js";
import { utcNow } from "../shared/clock.js";
import { assertNonEmpty, normalizeOptional } from "../shared/text.js";

import { initialize, withDatabase } from "./connection.js";
import { toTaskRow } from "./row.js";

type SqlValue = string | number | null;

export function addTask(dbPath: string, task: TaskInput): TaskRow {
  assertNonEmpty("title", task.title);
  initialize(dbPath);
  return withDatabase(dbPath, (db) => {
    const now = utcNow();
    const agent = normalizeOptional(task.agent);
    const status: TaskStatus = agent === null ? "todo" : "claimed";
    const result = db
      .prepare(
        `
        INSERT INTO tasks (
            title, goal, status, context, agent, repo, worktree, branch,
            created_at, updated_at, claimed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        task.title.trim(),
        normalizeOptional(task.goal),
        status,
        normalizeOptional(task.context),
        agent,
        normalizeOptional(task.repo),
        normalizeOptional(task.worktree),
        normalizeOptional(task.branch),
        now,
        now,
        agent === null ? null : now,
      );
    const taskId = Number(result.lastInsertRowid);
    appendEvent(db, taskId, "add", agent, task.context);
    return getTask(db, taskId);
  });
}

export function listTasks(
  dbPath: string,
  filters: { readonly status?: TaskStatus | undefined; readonly agent?: string | undefined } = {},
): TaskRow[] {
  initialize(dbPath);
  const { whereSql, params } = buildTaskFilters(filters);
  const rows = withDatabase(dbPath, (db) =>
    db
      .prepare(
        `
        SELECT * FROM tasks${whereSql}
        ORDER BY
            CASE status
                WHEN 'blocked' THEN 0
                WHEN 'review' THEN 1
                WHEN 'claimed' THEN 2
                WHEN 'todo' THEN 3
                WHEN 'done' THEN 4
            END,
            id
        `,
      )
      .all(...params),
  );
  return rows.map(toTaskRow);
}

export function claimTask(dbPath: string, taskId: number, agent: string, note?: string | undefined): TaskRow {
  assertNonEmpty("agent", agent);
  return updateMutableTask(dbPath, taskId, "claimed", (db, current, now) => {
    db.prepare(
      `
      UPDATE tasks
      SET status = 'claimed',
          agent = ?,
          blocked_reason = NULL,
          review_note = NULL,
          updated_at = ?,
          claimed_at = ?
      WHERE id = ?
      `,
    ).run(agent.trim(), now, now, taskId);
    appendEvent(db, taskId, "claim", agent, note);
    return current;
  });
}

export function releaseTask(dbPath: string, taskId: number, note?: string | undefined): TaskRow {
  return updateMutableTask(dbPath, taskId, "released", (db, current, now) => {
    db.prepare(
      `
      UPDATE tasks
      SET status = 'todo',
          agent = NULL,
          blocked_reason = NULL,
          review_note = NULL,
          updated_at = ?,
          released_at = ?
      WHERE id = ?
      `,
    ).run(now, now, taskId);
    appendEvent(db, taskId, "release", current.agent, note);
    return current;
  });
}

export function blockTask(dbPath: string, taskId: number, reason: string, agent?: string | undefined): TaskRow {
  assertNonEmpty("reason", reason);
  return updateMutableTask(dbPath, taskId, "blocked", (db, current, now) => {
    const actor = normalizeOptional(agent) ?? current.agent;
    db.prepare(
      `
      UPDATE tasks
      SET status = 'blocked',
          blocked_reason = ?,
          review_note = NULL,
          updated_at = ?,
          blocked_at = ?
      WHERE id = ?
      `,
    ).run(reason.trim(), now, now, taskId);
    appendEvent(db, taskId, "block", actor, reason);
    return current;
  });
}

export function reviewTask(dbPath: string, taskId: number, note?: string | undefined, agent?: string | undefined): TaskRow {
  return updateMutableTask(dbPath, taskId, "moved to review", (db, current, now) => {
    const actor = normalizeOptional(agent) ?? current.agent;
    db.prepare(
      `
      UPDATE tasks
      SET status = 'review',
          review_note = ?,
          blocked_reason = NULL,
          updated_at = ?,
          review_at = ?
      WHERE id = ?
      `,
    ).run(normalizeOptional(note), now, now, taskId);
    appendEvent(db, taskId, "review", actor, note);
    return current;
  });
}

export function completeTask(dbPath: string, taskId: number, note?: string | undefined, agent?: string | undefined): TaskRow {
  initialize(dbPath);
  return withDatabase(dbPath, (db) => {
    const current = getTask(db, taskId);
    const actor = normalizeOptional(agent) ?? current.agent;
    const now = utcNow();
    db.prepare(
      `
      UPDATE tasks
      SET status = 'done',
          done_note = ?,
          blocked_reason = NULL,
          review_note = NULL,
          updated_at = ?,
          done_at = ?
      WHERE id = ?
      `,
    ).run(normalizeOptional(note), now, now, taskId);
    appendEvent(db, taskId, "done", actor, note);
    return getTask(db, taskId);
  });
}

export function beatTask(dbPath: string, taskId: number, agent?: string | undefined, note?: string | undefined): TaskRow {
  initialize(dbPath);
  return withDatabase(dbPath, (db) => {
    const current = getTask(db, taskId);
    const actor = normalizeOptional(agent) ?? current.agent;
    const now = utcNow();
    db.prepare(
      `
      UPDATE tasks
      SET last_heartbeat_at = ?,
          heartbeat_note = ?,
          agent = COALESCE(?, agent),
          updated_at = ?
      WHERE id = ?
      `,
    ).run(now, normalizeOptional(note), normalizeOptional(agent), now, taskId);
    appendEvent(db, taskId, "beat", actor, note);
    return getTask(db, taskId);
  });
}

export function buildTaskFilters(filters: {
  readonly status?: TaskStatus | string | undefined;
  readonly agent?: string | undefined;
}): { readonly whereSql: string; readonly params: readonly SqlValue[] } {
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (filters.status !== undefined) {
    where.push("status = ?");
    params.push(parseTaskStatus(filters.status));
  }
  if (filters.agent !== undefined) {
    where.push("agent = ?");
    params.push(filters.agent);
  }
  return { whereSql: where.length === 0 ? "" : ` WHERE ${where.join(" AND ")}`, params };
}

export function getTask(db: DatabaseSync, taskId: number): TaskRow {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
  if (row === undefined) {
    throw new Error(`task ${taskId} does not exist`);
  }
  return toTaskRow(row);
}

export function appendEvent(
  db: DatabaseSync,
  taskId: number,
  eventType: string,
  actor: string | null | undefined,
  note: string | null | undefined,
): void {
  db.prepare(
    `
    INSERT INTO events(task_id, event_type, actor, note, created_at)
    VALUES (?, ?, ?, ?, ?)
    `,
  ).run(taskId, eventType, normalizeOptional(actor), normalizeOptional(note), utcNow());
}

function updateMutableTask(
  dbPath: string,
  taskId: number,
  action: string,
  update: (db: DatabaseSync, current: TaskRow, now: string) => TaskRow,
): TaskRow {
  initialize(dbPath);
  return withDatabase(dbPath, (db) => {
    const current = getTask(db, taskId);
    if (current.status === "done") {
      throw new Error(`task ${taskId} is done and cannot be ${action}`);
    }
    update(db, current, utcNow());
    return getTask(db, taskId);
  });
}
