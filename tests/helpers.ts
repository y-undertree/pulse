import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { main } from "../src/cli/app.js";
import type { Io } from "../src/cli/types.js";

export interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface TempDb {
  readonly dbPath: string;
  readonly cleanup: () => void;
}

export function createDbPath(): TempDb {
  const directory = mkdtempSync(join(tmpdir(), "pulse-test-"));
  return {
    dbPath: join(directory, "pulse.db"),
    cleanup: () => {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export function runCli(dbPath: string, ...args: string[]): RunResult {
  return runMain("--db", dbPath, ...args);
}

export function runMain(...args: string[]): RunResult {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: Io = {
    stdout: (text) => {
      stdout.push(text);
    },
    stderr: (text) => {
      stderr.push(text);
    },
  };
  const code = main(args, io);
  return { code, stdout: stdout.join(""), stderr: stderr.join("") };
}
