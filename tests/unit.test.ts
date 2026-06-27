import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs, parseGlobalArgs, splitOption } from "../src/cli/parser.js";
import {
  countTasksByStatus,
  emptyStatusCounts,
  isTaskStatus,
  parseTaskStatus,
  type TaskRow,
} from "../src/domain/task.js";
import { formatJson } from "../src/format/json.js";
import { formatMarkdown, formatTaskSection } from "../src/format/markdown.js";
import { formatRow, formatTaskTable } from "../src/format/table.js";
import { utcNow } from "../src/shared/clock.js";
import { assertNonEmpty, normalizeOptional } from "../src/shared/text.js";
import { resolveDbPath } from "../src/storage/connection.js";
import { asNumber, asNullableString, asString, toTaskRow } from "../src/storage/row.js";
import { buildTaskFilters } from "../src/storage/tasks.js";

const baseTask: TaskRow = {
  id: 1,
  title: "Task",
  goal: "Goal",
  status: "claimed",
  context: "Context",
  agent: "codex",
  repo: "pulse",
  worktree: "/tmp/pulse",
  branch: "main",
  blocked_reason: "blocked",
  review_note: "review",
  done_note: null,
  created_at: "2026-06-27T00:00:00Z",
  updated_at: "2026-06-27T00:00:01Z",
  claimed_at: "2026-06-27T00:00:00Z",
  released_at: null,
  blocked_at: "2026-06-27T00:00:01Z",
  review_at: "2026-06-27T00:00:02Z",
  done_at: null,
  last_heartbeat_at: "2026-06-27T00:00:03Z",
  heartbeat_note: "alive",
};

test("task status helpers parse, reject, and count statuses", () => {
  assert.equal(isTaskStatus("todo"), true);
  assert.equal(isTaskStatus("paused"), false);
  assert.equal(parseTaskStatus("done"), "done");
  assert.throws(() => parseTaskStatus("paused"), /status must be one of/);

  assert.deepEqual(emptyStatusCounts(), { blocked: 0, review: 0, claimed: 0, todo: 0, done: 0 });
  assert.deepEqual(countTasksByStatus([baseTask, { ...baseTask, id: 2, status: "blocked" }]), {
    blocked: 1,
    review: 0,
    claimed: 1,
    todo: 0,
    done: 0,
  });
});

test("formatters render json, markdown, and tables", () => {
  assert.match(formatJson([baseTask]), /"title": "Task"/);
  assert.match(formatMarkdown([], "2026-06-27T00:00:00Z"), /_No tasks\._/);

  const markdown = formatMarkdown([baseTask], "2026-06-27T00:00:00Z");
  assert.match(markdown, /- Blocked reason: blocked/);
  assert.match(markdown, /Context/);

  const minimalTask = {
    ...baseTask,
    goal: null,
    context: null,
    agent: null,
    repo: null,
    worktree: null,
    branch: null,
    blocked_reason: null,
    review_note: null,
    last_heartbeat_at: null,
    heartbeat_note: null,
  };
  assert.doesNotMatch(formatTaskSection(minimalTask).join("\n"), /Blocked reason/);
  assert.match(formatTaskTable([minimalTask]), /Task/);
  assert.equal(formatRow(["a"], [3]), "a  ");
});

test("parser handles positional and option variants", () => {
  assert.deepEqual(splitOption("format=json"), ["format", "json"]);
  assert.deepEqual(splitOption("format"), ["format", undefined]);

  const parsed = parseArgs(["title", "--goal=MVP", "--agent", "codex"]);
  assert.deepEqual(parsed.positional, ["title"]);
  assert.equal(parsed.options.get("goal"), "MVP");
  assert.equal(parsed.options.get("agent"), "codex");

  assert.equal(parseGlobalArgs(["--db=/tmp/pulse.db", "list"]).dbPath, "/tmp/pulse.db");
  assert.equal(parseGlobalArgs(["--db", "/tmp/pulse.db", "list"]).rest[0], "list");
});

test("path and text helpers normalize deterministic inputs", () => {
  assert.equal(resolveDbPath(undefined, { PULSE_DB: "/tmp/from-env.db" }, "/home/user"), "/tmp/from-env.db");
  assert.equal(resolveDbPath("~", {}, "/home/user"), "/home/user");
  assert.equal(resolveDbPath("~/pulse.db", {}, "/home/user"), "/home/user/pulse.db");
  assert.match(resolveDbPath("relative.db", {}, "/home/user"), /relative\.db$/);

  assert.equal(normalizeOptional(undefined), null);
  assert.equal(normalizeOptional(null), null);
  assert.equal(normalizeOptional("  "), null);
  assert.equal(normalizeOptional("  value  "), "value");
  assert.doesNotThrow(() => assertNonEmpty("name", "value"));
  assert.throws(() => assertNonEmpty("name", "  "), /name must not be empty/);
  assert.match(utcNow(), /^\d{4}-\d{2}-\d{2}T/);
});

test("row conversion validates sqlite row shape", () => {
  assert.equal(asString("value", "col"), "value");
  assert.equal(asNullableString(null, "col"), null);
  assert.equal(asNullableString("value", "col"), "value");
  assert.equal(asNumber(1, "id"), 1);
  assert.throws(() => asString(1, "col"), /col is not a string/);
  assert.throws(() => asNumber("1", "id"), /id is not a number/);
  assert.throws(() => toTaskRow(null), /invalid task row/);
  assert.throws(() => toTaskRow({ ...baseTask, id: "bad" }), /id is not a number/);
  assert.throws(() => toTaskRow({ ...baseTask, status: "paused" }), /status must be one of/);
  assert.deepEqual(toTaskRow(baseTask), baseTask);
});

test("task filter builder composes sql fragments safely", () => {
  assert.deepEqual(buildTaskFilters({}), { whereSql: "", params: [] });
  assert.deepEqual(buildTaskFilters({ status: "blocked" }), { whereSql: " WHERE status = ?", params: ["blocked"] });
  assert.deepEqual(buildTaskFilters({ agent: "codex" }), { whereSql: " WHERE agent = ?", params: ["codex"] });
  assert.deepEqual(buildTaskFilters({ status: "review", agent: "codex" }), {
    whereSql: " WHERE status = ? AND agent = ?",
    params: ["review", "codex"],
  });
  assert.throws(() => buildTaskFilters({ status: "paused" }), /status must be one of/);
});
