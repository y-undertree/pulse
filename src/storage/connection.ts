import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { schemaSql } from "./schema.js";

export function resolveDbPath(
  rawPath: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = homedir(),
): string {
  const value = rawPath ?? env.PULSE_DB ?? "~/.pulse/pulse.db";
  if (value === "~") {
    return homeDirectory;
  }
  if (value.startsWith("~/")) {
    return resolve(homeDirectory, value.slice(2));
  }
  return resolve(value);
}

export function initialize(dbPath: string): void {
  withDatabase(dbPath, (db) => {
    db.exec(schemaSql);
  });
}

export function withDatabase<T>(dbPath: string, callback: (db: DatabaseSync) => T): T {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  enableWalMode(db);
  db.exec("PRAGMA foreign_keys = ON");
  try {
    return callback(db);
  } finally {
    db.close();
  }
}

interface JournalModeRow {
  readonly journal_mode: string;
}

function enableWalMode(db: DatabaseSync): void {
  const row = db.prepare("PRAGMA journal_mode = WAL").get() as unknown as JournalModeRow;
  if (row.journal_mode !== "wal") {
    throw new Error(`failed to enable SQLite WAL mode: journal_mode=${row.journal_mode}`);
  }
}
