import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { dispatchCommand, errorMessage } from "../src/cli/app.js";
import type { Io } from "../src/cli/types.js";

import { createDbPath, runCli, runMain } from "./helpers.js";

test("help is printed when no command or help flag is provided", () => {
  assert.match(runMain().stdout, /usage: pulse/);
  assert.match(runMain("--help").stdout, /SQLite shared state/);
  assert.match(runMain("-h").stdout, /status\s+Show an observation-focused task status/);
});

test("unknown command and invalid global options return actionable errors", () => {
  assert.match(runMain("unknown").stderr, /unknown command 'unknown'/);
  assert.match(runMain("--db").stderr, /--db requires a value/);
});

test("init creates the database schema and enables WAL", () => {
  const { dbPath, cleanup } = createDbPath();
  try {
    const result = runCli(dbPath, "init");

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Initialized Pulse database/);
    assert.equal(readJournalMode(dbPath), "wal");
  } finally {
    cleanup();
  }
});

test("task lifecycle covers claim, beat, block, review, release, and done", () => {
  const { dbPath, cleanup } = createDbPath();
  try {
    let result = runCli(
      dbPath,
      "add",
      "Implement MVP",
      "--goal",
      "Pulse",
      "--context",
      "SQLite shared state",
      "--repo",
      "pulse",
      "--worktree",
      "/tmp/pulse",
      "--branch",
      "main",
    );
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Added #1/);

    result = runCli(dbPath, "claim", "1", "--agent", "codex", "--note", "starting");
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Claimed #1 by codex/);

    result = runCli(dbPath, "beat", "1", "--agent", "codex", "--note", "schema done");
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Heartbeat #1/);

    result = runCli(dbPath, "block", "1", "--reason", "waiting for decision");
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Blocked #1/);

    result = runCli(dbPath, "review", "1", "--agent", "codex", "--note", "ready for review");
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Review #1/);

    result = runCli(dbPath, "release", "1");
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Released #1/);

    result = runCli(dbPath, "done", "1", "--agent", "codex", "--note", "complete");
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Done #1/);

    result = runCli(dbPath, "list", "--format", "json");
    assert.equal(result.code, 0, result.stderr);
    const tasks = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    assert.equal(tasks[0]?.status, "done");
    assert.equal(tasks[0]?.done_note, "complete");
    assert.equal(tasks[0]?.blocked_reason, null);
    assert.equal(tasks[0]?.review_note, null);
  } finally {
    cleanup();
  }
});

test("list filters by status and agent, and table format is stable", () => {
  const { dbPath, cleanup } = createDbPath();
  try {
    runCli(dbPath, "add", "First");
    runCli(dbPath, "add", "Second", "--agent", "claude");
    runCli(dbPath, "add", "Third");
    runCli(dbPath, "review", "3", "--note", "needs review");

    let result = runCli(dbPath, "list", "--status", "claimed", "--format", "json");

    assert.equal(result.code, 0, result.stderr);
    let tasks = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.title, "Second");

    result = runCli(dbPath, "list", "--agent", "claude", "--format", "json");

    assert.equal(result.code, 0, result.stderr);
    tasks = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.agent, "claude");

    result = runCli(dbPath, "list", "--status", "review", "--format", "json");

    assert.equal(result.code, 0, result.stderr);
    tasks = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.title, "Third");

    result = runCli(dbPath, "list");

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /ID\s+Status\s+Agent\s+Goal\s+Branch\s+Title/);
    assert.match(result.stdout, /Second/);
  } finally {
    cleanup();
  }
});

test("status and summary expose observation-focused views", () => {
  const { dbPath, cleanup } = createDbPath();
  try {
    assert.match(runCli(dbPath, "status").stdout, /No tasks\./);
    assert.match(runCli(dbPath, "summary").stdout, /No tasks\./);

    runCli(dbPath, "add", "Active task", "--agent", "codex", "--branch", "main");
    runCli(dbPath, "beat", "1", "--agent", "codex", "--note", "working");
    runCli(dbPath, "add", "Blocked task", "--agent", "claude", "--branch", "fix");
    runCli(dbPath, "block", "2", "--reason", "needs input");
    runCli(dbPath, "add", "Review task");
    runCli(dbPath, "review", "3", "--note", "ready");
    runCli(dbPath, "add", "Todo task");
    runCli(dbPath, "add", "Done task");
    runCli(dbPath, "done", "5");

    const status = runCli(dbPath, "status");
    assert.equal(status.code, 0, status.stderr);
    assert.match(status.stdout, /Pulse Status/);
    assert.match(status.stdout, /Attention/);
    assert.match(status.stdout, /#2 \[blocked\] Blocked task/);
    assert.match(status.stdout, /#3 \[review\] Review task/);
    assert.match(status.stdout, /Active/);
    assert.match(status.stdout, /#1 \[claimed\] Active task/);
    assert.match(status.stdout, /Backlog/);
    assert.match(status.stdout, /#4 \[todo\] Todo task/);
    assert.match(status.stdout, /Done/);
    assert.match(status.stdout, /#5 \[done\] Done task/);

    const summary = runCli(dbPath, "summary");
    assert.equal(summary.code, 0, summary.stderr);
    assert.match(summary.stdout, /5 task\(s\): 1 blocked, 1 review, 1 claimed, 1 todo, 1 done\./);
    assert.match(summary.stdout, /Needs attention: #2 Blocked task; #3 Review task\./);
    assert.match(summary.stdout, /Active agents: codex on #1 Active task\./);
    assert.match(summary.stdout, /Next todo: #4 Todo task\./);
  } finally {
    cleanup();
  }
});

test("export markdown contains empty and populated operational state", () => {
  const { dbPath, cleanup } = createDbPath();
  try {
    let result = runCli(dbPath, "export");
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /_No tasks\._/);

    runCli(dbPath, "add", "Investigate failure", "--goal", "Release", "--agent", "codex");
    runCli(dbPath, "beat", "1", "--note", "checking logs");
    runCli(dbPath, "block", "1", "--reason", "blocked reason");
    runCli(dbPath, "review", "1", "--note", "ready for review");

    result = runCli(dbPath, "export");

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /# Pulse State/);
    assert.match(result.stdout, /- review: 1/);
    assert.match(result.stdout, /### #1 Investigate failure/);
    assert.match(result.stdout, /- Review note: ready for review/);
    assert.match(result.stdout, /- Heartbeat note: checking logs/);
  } finally {
    cleanup();
  }
});

test("command validation errors are reported through main", () => {
  const { dbPath, cleanup } = createDbPath();
  try {
    assert.match(runCli(dbPath, "claim", "99", "--agent", "codex").stderr, /task 99 does not exist/);
    assert.match(runCli(dbPath, "claim", "0", "--agent", "codex").stderr, /task id must be a positive integer/);
    assert.match(runCli(dbPath, "claim", "1").stderr, /claim requires --agent/);
    assert.match(runCli(dbPath, "block", "1").stderr, /block requires --reason/);
    assert.match(runCli(dbPath, "add").stderr, /title is required/);
    assert.match(runCli(dbPath, "add", "one", "two").stderr, /add expected 1 positional/);
    assert.match(runCli(dbPath, "list", "--format", "xml").stderr, /format must be one of/);
    assert.match(runCli(dbPath, "list", "--status", "paused").stderr, /status must be one of/);
    assert.match(runCli(dbPath, "list", "--agent").stderr, /--agent requires a value/);
    assert.match(runCli(dbPath, "init", "extra").stderr, /init expected 0 positional/);
    assert.match(runCli(dbPath, "status", "extra").stderr, /status expected 0 positional/);
    assert.match(runCli(dbPath, "summary", "extra").stderr, /summary expected 0 positional/);
  } finally {
    cleanup();
  }
});

test("done tasks reject mutable state transitions", () => {
  const { dbPath, cleanup } = createDbPath();
  try {
    runCli(dbPath, "add", "Already done");
    runCli(dbPath, "done", "1");

    assert.match(runCli(dbPath, "claim", "1", "--agent", "codex").stderr, /cannot be claimed/);
    assert.match(runCli(dbPath, "release", "1").stderr, /cannot be released/);
    assert.match(runCli(dbPath, "block", "1", "--reason", "x").stderr, /cannot be blocked/);
    assert.match(runCli(dbPath, "review", "1").stderr, /cannot be moved to review/);
  } finally {
    cleanup();
  }
});

test("dispatchCommand propagates programmer errors for direct callers", () => {
  const io: Io = {
    stdout: () => undefined,
    stderr: () => undefined,
  };
  assert.throws(() => dispatchCommand("/tmp/pulse.db", "unknown", [], io), /unknown command/);
});

test("errorMessage handles Error and non-Error values", () => {
  assert.equal(errorMessage(new Error("boom")), "boom");
  assert.equal(errorMessage("plain"), "plain");
});

function readJournalMode(dbPath: string): string {
  const db = new DatabaseSync(dbPath);
  try {
    const row = db.prepare("PRAGMA journal_mode").get() as { readonly journal_mode: string };
    return row.journal_mode;
  } finally {
    db.close();
  }
}
