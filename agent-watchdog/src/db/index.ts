import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomBytes } from 'crypto';
import { config } from '../config/index.js';
import type {
  RequestRow,
  ViolationRow,
  AuditLogRow,
  AgentPermissionRow,
} from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class DatabaseService {
  private db: Database.Database;

  constructor() {
    // Ensure data directory exists
    const dbDir = dirname(config.databasePath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(config.databasePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.runMigrations();
  }

  private runMigrations(): void {
    const migration1 = readFileSync(join(__dirname, 'migrations', '001_init.sql'), 'utf-8');
    this.db.exec(migration1);
    const migration2Path = join(__dirname, 'migrations', '002_behavioral.sql');
    if (existsSync(migration2Path)) {
      const migration2 = readFileSync(migration2Path, 'utf-8');
      this.db.exec(migration2);
    }
    const migration3Path = join(__dirname, 'migrations', '003_api_keys.sql');
    if (existsSync(migration3Path)) {
      const migration3 = readFileSync(migration3Path, 'utf-8');
      this.db.exec(migration3);
    }
    this.ensureRequestApiKeyScopeColumn();
  }

  private ensureRequestApiKeyScopeColumn(): void {
    const columns = this.db.prepare('PRAGMA table_info(requests)').all() as Array<{ name: string }>;
    const hasApiKeyId = columns.some((column) => column.name === 'api_key_id');
    if (!hasApiKeyId) {
      this.db.exec('ALTER TABLE requests ADD COLUMN api_key_id TEXT');
    }
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_requests_api_key_id ON requests(api_key_id)');
  }

  private buildScopeWhere(apiKeyId?: string): { clause: string; params: unknown[] } {
    if (!apiKeyId) return { clause: '', params: [] };
    return { clause: ' WHERE api_key_id = ?', params: [apiKeyId] };
  }

  // Request operations
  createRequest(request: Omit<RequestRow, 'created_at' | 'processed_at' | 'status' | 'decision' | 'decision_reasoning'>): RequestRow {
    const stmt = this.db.prepare(`
      INSERT INTO requests (id, api_key_id, agent_id, action, target, context, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      request.id,
      request.api_key_id,
      request.agent_id,
      request.action,
      request.target,
      request.context,
      request.metadata
    );
    return this.getRequest(request.id)!;
  }

  getRequest(id: string, apiKeyId?: string): RequestRow | undefined {
    if (!apiKeyId) {
      const stmt = this.db.prepare('SELECT * FROM requests WHERE id = ?');
      return stmt.get(id) as RequestRow | undefined;
    }
    const stmt = this.db.prepare('SELECT * FROM requests WHERE id = ? AND api_key_id = ?');
    return stmt.get(id, apiKeyId) as RequestRow | undefined;
  }

  getRequests(limit = 100, offset = 0, apiKeyId?: string): RequestRow[] {
    const scope = this.buildScopeWhere(apiKeyId);
    const stmt = this.db.prepare(
      `SELECT * FROM requests${scope.clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    );
    return stmt.all(...scope.params, limit, offset) as RequestRow[];
  }

  updateRequest(
    id: string,
    updates: Partial<Pick<RequestRow, 'status' | 'decision' | 'decision_reasoning' | 'processed_at'>>
  ): RequestRow | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.decision !== undefined) {
      fields.push('decision = ?');
      values.push(updates.decision);
    }
    if (updates.decision_reasoning !== undefined) {
      fields.push('decision_reasoning = ?');
      values.push(updates.decision_reasoning);
    }
    if (updates.processed_at !== undefined) {
      fields.push('processed_at = ?');
      values.push(updates.processed_at);
    }

    if (fields.length === 0) return this.getRequest(id);

    values.push(id);
    const stmt = this.db.prepare(
      `UPDATE requests SET ${fields.join(', ')} WHERE id = ?`
    );
    stmt.run(...values);
    return this.getRequest(id);
  }

  // Violation operations
  createViolation(violation: Omit<ViolationRow, 'detected_at'>): ViolationRow {
    const stmt = this.db.prepare(`
      INSERT INTO violations (id, request_id, type, description, severity, evidence, suggested_fix)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      violation.id,
      violation.request_id,
      violation.type,
      violation.description,
      violation.severity,
      violation.evidence,
      violation.suggested_fix
    );
    return this.getViolation(violation.id)!;
  }

  getViolation(id: string): ViolationRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM violations WHERE id = ?');
    return stmt.get(id) as ViolationRow | undefined;
  }

  getViolationsByRequest(requestId: string, apiKeyId?: string): ViolationRow[] {
    if (!apiKeyId) {
      const stmt = this.db.prepare(
        'SELECT * FROM violations WHERE request_id = ? ORDER BY detected_at DESC'
      );
      return stmt.all(requestId) as ViolationRow[];
    }
    const stmt = this.db.prepare(`
      SELECT v.*
      FROM violations v
      JOIN requests r ON r.id = v.request_id
      WHERE v.request_id = ? AND r.api_key_id = ?
      ORDER BY v.detected_at DESC
    `);
    return stmt.all(requestId, apiKeyId) as ViolationRow[];
  }

  getViolations(limit = 100, offset = 0, apiKeyId?: string): ViolationRow[] {
    if (!apiKeyId) {
      const stmt = this.db.prepare(
        'SELECT * FROM violations ORDER BY detected_at DESC LIMIT ? OFFSET ?'
      );
      return stmt.all(limit, offset) as ViolationRow[];
    }
    const stmt = this.db.prepare(`
      SELECT v.*
      FROM violations v
      JOIN requests r ON r.id = v.request_id
      WHERE r.api_key_id = ?
      ORDER BY v.detected_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(apiKeyId, limit, offset) as ViolationRow[];
  }

  // Audit log operations
  createAuditLog(log: Omit<AuditLogRow, 'created_at'>): AuditLogRow {
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (id, request_id, agent_id, action, decision, reasoning, pipeline_path, monitor_result, analysis_result, severity_result, fix_result)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      log.id,
      log.request_id,
      log.agent_id,
      log.action,
      log.decision,
      log.reasoning,
      log.pipeline_path,
      log.monitor_result,
      log.analysis_result,
      log.severity_result,
      log.fix_result
    );
    return this.getAuditLog(log.id)!;
  }

  getAuditLog(id: string): AuditLogRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM audit_logs WHERE id = ?');
    return stmt.get(id) as AuditLogRow | undefined;
  }

  getAuditLogs(limit = 100, offset = 0, apiKeyId?: string): AuditLogRow[] {
    if (!apiKeyId) {
      const stmt = this.db.prepare(
        'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
      );
      return stmt.all(limit, offset) as AuditLogRow[];
    }
    const stmt = this.db.prepare(`
      SELECT a.*
      FROM audit_logs a
      JOIN requests r ON r.id = a.request_id
      WHERE r.api_key_id = ?
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(apiKeyId, limit, offset) as AuditLogRow[];
  }

  getAuditLogsByAgent(agentId: string, apiKeyId?: string): AuditLogRow[] {
    if (!apiKeyId) {
      const stmt = this.db.prepare(
        'SELECT * FROM audit_logs WHERE agent_id = ? ORDER BY created_at DESC'
      );
      return stmt.all(agentId) as AuditLogRow[];
    }
    const stmt = this.db.prepare(`
      SELECT a.*
      FROM audit_logs a
      JOIN requests r ON r.id = a.request_id
      WHERE a.agent_id = ? AND r.api_key_id = ?
      ORDER BY a.created_at DESC
    `);
    return stmt.all(agentId, apiKeyId) as AuditLogRow[];
  }

  // Agent permission operations
  getAgentPermission(agentId: string): AgentPermissionRow | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM agent_permissions WHERE agent_id = ?'
    );
    return stmt.get(agentId) as AgentPermissionRow | undefined;
  }

  upsertAgentPermission(
    permission: Omit<AgentPermissionRow, 'created_at' | 'updated_at'>
  ): AgentPermissionRow {
    const existing = this.getAgentPermission(permission.agent_id);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE agent_permissions
        SET is_active = ?, permissions = ?, blocked_at = ?, blocked_reason = ?, updated_at = datetime('now')
        WHERE agent_id = ?
      `);
      stmt.run(
        permission.is_active,
        permission.permissions,
        permission.blocked_at,
        permission.blocked_reason,
        permission.agent_id
      );
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO agent_permissions (agent_id, is_active, permissions, blocked_at, blocked_reason)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(
        permission.agent_id,
        permission.is_active,
        permission.permissions,
        permission.blocked_at,
        permission.blocked_reason
      );
    }

    return this.getAgentPermission(permission.agent_id)!;
  }

  getAllAgentPermissions(): AgentPermissionRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM agent_permissions ORDER BY agent_id'
    );
    return stmt.all() as AgentPermissionRow[];
  }

  // Statistics
  getStats(apiKeyId?: string): {
    totalRequests: number;
    approvedRequests: number;
    flaggedRequests: number;
    killedRequests: number;
    totalViolations: number;
    criticalViolations: number;
    activeAgents: number;
    blockedAgents: number;
  } {
    let requestStats: { total: number; approved: number; flagged: number; killed: number };
    let violationStats: { total: number; critical: number };
    let agentStats: { active: number; blocked: number };

    if (!apiKeyId) {
      requestStats = this.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN decision = 'APPROVE' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN decision = 'FLAG' THEN 1 ELSE 0 END) as flagged,
          SUM(CASE WHEN decision = 'KILL' THEN 1 ELSE 0 END) as killed
        FROM requests
      `).get() as { total: number; approved: number; flagged: number; killed: number };

      violationStats = this.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical
        FROM violations
      `).get() as { total: number; critical: number };

      agentStats = this.db.prepare(`
        SELECT
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as blocked
        FROM agent_permissions
      `).get() as { active: number; blocked: number };
    } else {
      requestStats = this.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN decision = 'APPROVE' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN decision = 'FLAG' THEN 1 ELSE 0 END) as flagged,
          SUM(CASE WHEN decision = 'KILL' THEN 1 ELSE 0 END) as killed
        FROM requests
        WHERE api_key_id = ?
      `).get(apiKeyId) as { total: number; approved: number; flagged: number; killed: number };

      violationStats = this.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN v.severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical
        FROM violations v
        JOIN requests r ON r.id = v.request_id
        WHERE r.api_key_id = ?
      `).get(apiKeyId) as { total: number; critical: number };

      agentStats = this.db.prepare(`
        SELECT
          SUM(CASE WHEN ap.is_active = 1 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN ap.is_active = 0 THEN 1 ELSE 0 END) as blocked
        FROM agent_permissions ap
        WHERE ap.agent_id IN (SELECT DISTINCT agent_id FROM requests WHERE api_key_id = ?)
      `).get(apiKeyId) as { active: number; blocked: number };
    }

    return {
      totalRequests: requestStats.total || 0,
      approvedRequests: requestStats.approved || 0,
      flaggedRequests: requestStats.flagged || 0,
      killedRequests: requestStats.killed || 0,
      totalViolations: violationStats.total || 0,
      criticalViolations: violationStats.critical || 0,
      activeAgents: agentStats?.active || 0,
      blockedAgents: agentStats?.blocked || 0,
    };
  }

  // Behavioral baseline operations
  getAgentBaseline(agentId: string): {
    agentId: string;
    typicalActions: string[];
    typicalTargets: string[];
    avgRequestsPerHour: number;
    avgRiskScore: number;
    totalRequests: number;
    lastUpdated: string;
  } | undefined {
    const stmt = this.db.prepare('SELECT * FROM agent_behavior_baseline WHERE agent_id = ?');
    const row = stmt.get(agentId) as {
      agent_id: string;
      typical_actions: string;
      typical_targets: string;
      avg_requests_per_hour: number;
      avg_risk_score: number;
      total_requests: number;
      last_updated: string;
    } | undefined;
    if (!row) return undefined;
    return {
      agentId: row.agent_id,
      typicalActions: JSON.parse(row.typical_actions),
      typicalTargets: JSON.parse(row.typical_targets),
      avgRequestsPerHour: row.avg_requests_per_hour,
      avgRiskScore: row.avg_risk_score,
      totalRequests: row.total_requests,
      lastUpdated: row.last_updated,
    };
  }

  upsertAgentBaseline(data: {
    agentId: string;
    typicalActions: string[];
    typicalTargets: string[];
    avgRequestsPerHour: number;
    avgRiskScore: number;
    totalRequests: number;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO agent_behavior_baseline
        (agent_id, typical_actions, typical_targets, avg_requests_per_hour, avg_risk_score, total_requests, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(agent_id) DO UPDATE SET
        typical_actions = excluded.typical_actions,
        typical_targets = excluded.typical_targets,
        avg_requests_per_hour = excluded.avg_requests_per_hour,
        avg_risk_score = excluded.avg_risk_score,
        total_requests = excluded.total_requests,
        last_updated = datetime('now')
    `);
    stmt.run(
      data.agentId,
      JSON.stringify(data.typicalActions),
      JSON.stringify(data.typicalTargets),
      data.avgRequestsPerHour,
      data.avgRiskScore,
      data.totalRequests
    );
  }

  getRequestCountInLastHour(agentId: string): number {
    const stmt = this.db.prepare(
      `SELECT COUNT(*) as count FROM requests WHERE agent_id = ? AND created_at > datetime('now', '-1 hour')`
    );
    const row = stmt.get(agentId) as { count: number };
    return row.count;
  }

  getAuditLogByRequest(requestId: string, apiKeyId?: string): AuditLogRow | undefined {
    if (!apiKeyId) {
      const stmt = this.db.prepare(
        'SELECT * FROM audit_logs WHERE request_id = ? ORDER BY created_at DESC LIMIT 1'
      );
      return stmt.get(requestId) as AuditLogRow | undefined;
    }
    const stmt = this.db.prepare(`
      SELECT a.*
      FROM audit_logs a
      JOIN requests r ON r.id = a.request_id
      WHERE a.request_id = ? AND r.api_key_id = ?
      ORDER BY a.created_at DESC
      LIMIT 1
    `);
    return stmt.get(requestId, apiKeyId) as AuditLogRow | undefined;
  }

  getTopologyData(limit = 50, apiKeyId?: string): {
    agents: Array<{ agentId: string; isActive: number; violationCount: number }>;
    edges: Array<{ id: string; agentId: string; decision: string | null; createdAt: string }>;
  } {
    let agents: Array<{ agentId: string; isActive: number; violationCount: number }>;
    let edges: Array<{ id: string; agentId: string; decision: string | null; createdAt: string }>;

    if (!apiKeyId) {
      agents = this.db.prepare(`
        SELECT ap.agent_id as agentId, ap.is_active as isActive,
               COUNT(DISTINCT v.id) as violationCount
        FROM agent_permissions ap
        LEFT JOIN requests r ON r.agent_id = ap.agent_id
        LEFT JOIN violations v ON v.request_id = r.id
        GROUP BY ap.agent_id, ap.is_active
      `).all() as Array<{ agentId: string; isActive: number; violationCount: number }>;

      edges = this.db.prepare(`
        SELECT id, agent_id as agentId, decision, created_at as createdAt
        FROM requests ORDER BY created_at DESC LIMIT ?
      `).all(limit) as Array<{ id: string; agentId: string; decision: string | null; createdAt: string }>;
    } else {
      agents = this.db.prepare(`
        SELECT ap.agent_id as agentId, ap.is_active as isActive,
               COUNT(DISTINCT v.id) as violationCount
        FROM agent_permissions ap
        LEFT JOIN requests r ON r.agent_id = ap.agent_id AND r.api_key_id = ?
        LEFT JOIN violations v ON v.request_id = r.id
        WHERE ap.agent_id IN (SELECT DISTINCT agent_id FROM requests WHERE api_key_id = ?)
        GROUP BY ap.agent_id, ap.is_active
      `).all(apiKeyId, apiKeyId) as Array<{ agentId: string; isActive: number; violationCount: number }>;

      edges = this.db.prepare(`
        SELECT id, agent_id as agentId, decision, created_at as createdAt
        FROM requests
        WHERE api_key_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(apiKeyId, limit) as Array<{ id: string; agentId: string; decision: string | null; createdAt: string }>;
    }

    return { agents, edges };
  }

  getAgentIdsByApiKey(apiKeyId: string): string[] {
    const rows = this.db.prepare(
      'SELECT DISTINCT agent_id as agentId FROM requests WHERE api_key_id = ? ORDER BY agent_id'
    ).all(apiKeyId) as Array<{ agentId: string }>;
    return rows.map((row) => row.agentId);
  }

  // ── API key operations ─────────────────────────────────────────────────────

  /** Generate a new API key, store its SHA-256 hash, return the plaintext key (shown once). */
  createApiKey(name: string): { id: string; key: string; preview: string; name: string; createdAt: string } {
    const id = randomBytes(8).toString('hex');
    const raw = `aw_${randomBytes(24).toString('hex')}`;          // aw_ + 48 hex chars
    const hash = createHash('sha256').update(raw).digest('hex');
    const preview = `${raw.slice(0, 8)}…${raw.slice(-4)}`;         // aw_12ab…ef89

    this.db.prepare(`
      INSERT INTO api_keys (id, key_hash, key_preview, name)
      VALUES (?, ?, ?, ?)
    `).run(id, hash, preview, name);

    const row = this.db.prepare('SELECT created_at FROM api_keys WHERE id = ?').get(id) as { created_at: string };
    return { id, key: raw, preview, name, createdAt: row.created_at };
  }

  listApiKeys(): Array<{ id: string; preview: string; name: string; isActive: number; createdAt: string; lastUsedAt: string | null }> {
    return (this.db.prepare(`
      SELECT id, key_preview as preview, name, is_active as isActive,
             created_at as createdAt, last_used_at as lastUsedAt
      FROM api_keys ORDER BY created_at DESC
    `).all()) as Array<{ id: string; preview: string; name: string; isActive: number; createdAt: string; lastUsedAt: string | null }>;
  }

  revokeApiKey(id: string): void {
    this.db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(id);
  }

  deleteApiKey(id: string): void {
    this.db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
  }

  hasActiveApiKeys(): boolean {
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1'
    ).get() as { count: number };
    return row.count > 0;
  }

  /** Validate incoming key. Returns true and touches last_used_at if valid. */
  resolveApiKey(raw: string): { id: string; preview: string; name: string } | undefined {
    const hash = createHash('sha256').update(raw).digest('hex');
    const row = this.db.prepare(
      'SELECT id, key_preview as preview, name FROM api_keys WHERE key_hash = ? AND is_active = 1'
    ).get(hash) as { id: string; preview: string; name: string } | undefined;
    if (!row) return undefined;
    this.db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?').run(row.id);
    return row;
  }

  validateApiKey(raw: string): boolean {
    return Boolean(this.resolveApiKey(raw));
  }

  close(): void {
    this.db.close();
  }
}

export const db = new DatabaseService();
