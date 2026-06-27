export const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    goal TEXT,
    status TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'claimed', 'blocked', 'review', 'done')),
    context TEXT,
    agent TEXT,
    repo TEXT,
    worktree TEXT,
    branch TEXT,
    blocked_reason TEXT,
    review_note TEXT,
    done_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    claimed_at TEXT,
    released_at TEXT,
    blocked_at TEXT,
    review_at TEXT,
    done_at TEXT,
    last_heartbeat_at TEXT,
    heartbeat_note TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor TEXT,
    note TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent, updated_at);
CREATE INDEX IF NOT EXISTS idx_events_task_id ON events(task_id, created_at);

INSERT OR REPLACE INTO schema_meta(key, value) VALUES ('schema_version', '1');
`;
