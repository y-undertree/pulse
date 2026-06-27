import { parseTaskStatus, type TaskStatus } from "../domain/task.js";
import { resolveDbPath } from "../storage/connection.js";

import type { GlobalArgs, ParsedArgs } from "./types.js";

export function parseGlobalArgs(argv: readonly string[]): GlobalArgs {
  const rest: string[] = [];
  let dbPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (arg === "--db") {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error("--db requires a value");
      }
      dbPath = value;
      index += 1;
    } else if (arg.startsWith("--db=")) {
      dbPath = arg.slice("--db=".length);
    } else {
      rest.push(arg);
    }
  }
  return { dbPath: resolveDbPath(dbPath), rest };
}

export function parseArgs(args: readonly string[]): ParsedArgs {
  const options = new Map<string, string>();
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] as string;
    if (arg.startsWith("--")) {
      const [key, inlineValue] = splitOption(arg.slice(2));
      const value = inlineValue ?? args[index + 1];
      if (value === undefined) {
        throw new Error(`--${key} requires a value`);
      }
      options.set(key, value);
      if (inlineValue === undefined) {
        index += 1;
      }
    } else {
      positional.push(arg);
    }
  }
  return { options, positional };
}

export function requiredTaskId(parsed: ParsedArgs, command: string): number {
  const value = requiredPositional(parsed, 0, "task_id");
  ensurePositionCount(parsed, 1, command);
  const taskId = Number(value);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new Error("task id must be a positive integer");
  }
  return taskId;
}

export function requiredPositional(parsed: ParsedArgs, index: number, name: string): string {
  const value = parsed.positional[index];
  if (value === undefined) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function requiredOption(parsed: ParsedArgs, name: string, command: string): string {
  const value = parsed.options.get(name);
  if (value === undefined) {
    throw new Error(`${command} requires --${name}`);
  }
  return value;
}

export function ensureNoPositionals(parsed: ParsedArgs, command: string): void {
  ensurePositionCount(parsed, 0, command);
}

export function ensurePositionCount(parsed: ParsedArgs, expected: number, command: string): void {
  if (parsed.positional.length !== expected) {
    throw new Error(`${command} expected ${expected} positional argument(s), got ${parsed.positional.length}`);
  }
}

export function parseStatusOption(value: string | undefined): TaskStatus | undefined {
  return value === undefined ? undefined : parseTaskStatus(value);
}

export function splitOption(value: string): readonly [string, string | undefined] {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex === -1) {
    return [value, undefined];
  }
  return [value.slice(0, separatorIndex), value.slice(separatorIndex + 1)];
}
