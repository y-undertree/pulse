export function helpText(): string {
  return `usage: pulse [--db DB] {init,add,list,status,summary,claim,release,block,review,done,beat,export} ...

SQLite shared state for AI coding agents.

commands:
  init      Create the Pulse database.
  add       Add a task.
  list      List tasks.
  status    Show an observation-focused task status.
  summary   Show a concise operational summary.
  claim     Claim a task.
  release   Release a task.
  block     Mark a task as blocked.
  review    Mark a task as waiting for review.
  done      Mark a task as done.
  beat      Update a task heartbeat.
  export    Export state as Markdown.

options:
  --db DB   SQLite database path. Defaults to PULSE_DB or ~/.pulse/pulse.db.
`;
}
