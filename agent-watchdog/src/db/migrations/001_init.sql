-- Agent Watchdog Initial Schema

-- Requests table: stores incoming agent requests
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    context TEXT,
    metadata TEXT, -- JSON
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'approved', 'flagged', 'killed')),
    decision TEXT CHECK (decision IN ('APPROVE', 'FLAG', 'KILL')),
    decision_reasoning TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT
);

-- Violations table: detected policy violations
CREATE TABLE IF NOT EXISTS violations (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    evidence TEXT,
    suggested_fix TEXT,
    detected_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (request_id) REFERENCES requests(id)
);

-- Audit logs table: decision audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    action TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'FLAG', 'KILL')),
    reasoning TEXT NOT NULL,
    pipeline_path TEXT, -- JSON array of agent names
    monitor_result TEXT, -- JSON
    analysis_result TEXT, -- JSON
    severity_result TEXT, -- JSON
    fix_result TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (request_id) REFERENCES requests(id)
);

-- Agent permissions table: agent permission states
CREATE TABLE IF NOT EXISTS agent_permissions (
    agent_id TEXT PRIMARY KEY,
    is_active INTEGER DEFAULT 1,
    permissions TEXT, -- JSON array
    blocked_at TEXT,
    blocked_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_requests_agent_id ON requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_violations_request_id ON violations(request_id);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_agent_id ON audit_logs(agent_id);
