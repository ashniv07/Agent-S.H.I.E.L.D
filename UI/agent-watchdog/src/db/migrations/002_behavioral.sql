CREATE TABLE IF NOT EXISTS agent_behavior_baseline (
  agent_id TEXT PRIMARY KEY,
  typical_actions TEXT NOT NULL DEFAULT '[]',
  typical_targets TEXT NOT NULL DEFAULT '[]',
  avg_requests_per_hour REAL NOT NULL DEFAULT 0,
  avg_risk_score REAL NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);
