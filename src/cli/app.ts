import {
  addTask,
  beatTask,
  blockTask,
  claimTask,
  completeTask,
  listTasks,
  releaseTask,
  reviewTask,
} from "../storage/tasks.js";
import { initialize } from "../storage/connection.js";
import { formatJson } from "../format/json.js";
import { formatMarkdown } from "../format/markdown.js";
import { formatTaskTable } from "../format/table.js";

import { helpText } from "./help.js";
import {
  ensureNoPositionals,
  ensurePositionCount,
  parseArgs,
  parseGlobalArgs,
  parseStatusOption,
  requiredOption,
  requiredPositional,
  requiredTaskId,
} from "./parser.js";
import type { Io } from "./types.js";

export function main(argv: readonly string[], io: Io): number {
  try {
    const globalArgs = parseGlobalArgs(argv);
    const [command, ...commandArgs] = globalArgs.rest;
    if (command === undefined || command === "-h" || command === "--help") {
      io.stdout(helpText());
      return 0;
    }

    return dispatchCommand(globalArgs.dbPath, command, commandArgs, io);
  } catch (error) {
    io.stderr(`pulse: error: ${errorMessage(error)}\n`);
    return 1;
  }
}

export function dispatchCommand(
  dbPath: string,
  command: string,
  commandArgs: readonly string[],
  io: Io,
): number {
  switch (command) {
    case "init":
      ensureNoPositionals(parseArgs(commandArgs), "init");
      initialize(dbPath);
      io.stdout(`Initialized Pulse database: ${dbPath}\n`);
      return 0;
    case "add":
      return handleAdd(dbPath, commandArgs, io);
    case "list":
      return handleList(dbPath, commandArgs, io);
    case "claim":
      return handleClaim(dbPath, commandArgs, io);
    case "release":
      return handleRelease(dbPath, commandArgs, io);
    case "block":
      return handleBlock(dbPath, commandArgs, io);
    case "review":
      return handleReview(dbPath, commandArgs, io);
    case "done":
      return handleDone(dbPath, commandArgs, io);
    case "beat":
      return handleBeat(dbPath, commandArgs, io);
    case "export":
      ensureNoPositionals(parseArgs(commandArgs), "export");
      io.stdout(formatMarkdown(listTasks(dbPath)));
      return 0;
    default:
      throw new Error(`unknown command '${command}'`);
  }
}

function handleAdd(dbPath: string, args: readonly string[], io: Io): number {
  const parsed = parseArgs(args);
  const title = requiredPositional(parsed, 0, "title");
  ensurePositionCount(parsed, 1, "add");
  const task = addTask(dbPath, {
    title,
    goal: parsed.options.get("goal"),
    context: parsed.options.get("context"),
    agent: parsed.options.get("agent"),
    repo: parsed.options.get("repo"),
    worktree: parsed.options.get("worktree"),
    branch: parsed.options.get("branch"),
  });
  io.stdout(`Added #${task.id}: ${task.title} [${task.status}]\n`);
  return 0;
}

function handleList(dbPath: string, args: readonly string[], io: Io): number {
  const parsed = parseArgs(args);
  ensurePositionCount(parsed, 0, "list");
  const format = parsed.options.get("format") ?? "table";
  if (format !== "table" && format !== "json") {
    throw new Error("format must be one of: table, json");
  }
  const tasks = listTasks(dbPath, {
    status: parseStatusOption(parsed.options.get("status")),
    agent: parsed.options.get("agent"),
  });
  io.stdout(format === "json" ? `${formatJson(tasks)}\n` : formatTaskTable(tasks));
  return 0;
}

function handleClaim(dbPath: string, args: readonly string[], io: Io): number {
  const parsed = parseArgs(args);
  const taskId = requiredTaskId(parsed, "claim");
  const agent = requiredOption(parsed, "agent", "claim");
  const task = claimTask(dbPath, taskId, agent, parsed.options.get("note"));
  io.stdout(`Claimed #${task.id} by ${task.agent as string}\n`);
  return 0;
}

function handleRelease(dbPath: string, args: readonly string[], io: Io): number {
  const parsed = parseArgs(args);
  const taskId = requiredTaskId(parsed, "release");
  const task = releaseTask(dbPath, taskId, parsed.options.get("note"));
  io.stdout(`Released #${task.id}\n`);
  return 0;
}

function handleBlock(dbPath: string, args: readonly string[], io: Io): number {
  const parsed = parseArgs(args);
  const taskId = requiredTaskId(parsed, "block");
  const reason = requiredOption(parsed, "reason", "block");
  const task = blockTask(dbPath, taskId, reason, parsed.options.get("agent"));
  io.stdout(`Blocked #${task.id}: ${task.blocked_reason as string}\n`);
  return 0;
}

function handleReview(dbPath: string, args: readonly string[], io: Io): number {
  const parsed = parseArgs(args);
  const taskId = requiredTaskId(parsed, "review");
  const task = reviewTask(dbPath, taskId, parsed.options.get("note"), parsed.options.get("agent"));
  io.stdout(`Review #${task.id}: ${task.title}\n`);
  return 0;
}

function handleDone(dbPath: string, args: readonly string[], io: Io): number {
  const parsed = parseArgs(args);
  const taskId = requiredTaskId(parsed, "done");
  const task = completeTask(dbPath, taskId, parsed.options.get("note"), parsed.options.get("agent"));
  io.stdout(`Done #${task.id}: ${task.title}\n`);
  return 0;
}

function handleBeat(dbPath: string, args: readonly string[], io: Io): number {
  const parsed = parseArgs(args);
  const taskId = requiredTaskId(parsed, "beat");
  const task = beatTask(dbPath, taskId, parsed.options.get("agent"), parsed.options.get("note"));
  io.stdout(`Heartbeat #${task.id}: ${task.last_heartbeat_at as string}\n`);
  return 0;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
