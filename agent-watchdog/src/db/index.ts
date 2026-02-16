import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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
    const migrationPath = join(__dirname, 'migrations', '001_init.sql');
    const migration = readFileSync(migrationPath, 'utf-8');
    this.db.exec(migration);
  }

  // Request operations
  createRequest(request: Omit<RequestRow, 'created_at' | 'processed_at' | 'status' | 'decision' | 'decision_reasoning'>): RequestRow {
    const stmt = this.db.prepare(`
      INSERT INTO requests (id, agent_id, action, target, context, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      request.id,
      request.agent_id,
      request.action,
      request.target,
      request.context,
      request.metadata
    );
    return this.getRequest(request.id)!;
  }

  getRequest(id: string): RequestRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM requests WHERE id = ?');
    return stmt.get(id) as RequestRow | undefined;
  }

  getRequests(limit = 100, offset = 0): RequestRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM requests ORDER BY created_at DESC LIMIT ? OFFSET ?'
    );
    return stmt.all(limit, offset) as RequestRow[];
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

  getViolationsByRequest(requestId: string): ViolationRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM violations WHERE request_id = ? ORDER BY detected_at DESC'
    );
    return stmt.all(requestId) as ViolationRow[];
  }

  getViolations(limit = 100, offset = 0): ViolationRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM violations ORDER BY detected_at DESC LIMIT ? OFFSET ?'
    );
    return stmt.all(limit, offset) as ViolationRow[];
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

  getAuditLogs(limit = 100, offset = 0): AuditLogRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
    );
    return stmt.all(limit, offset) as AuditLogRow[];
  }

  getAuditLogsByAgent(agentId: string): AuditLogRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM audit_logs WHERE agent_id = ? ORDER BY created_at DESC'
    );
    return stmt.all(agentId) as AuditLogRow[];
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
  getStats(): {
    totalRequests: number;
    approvedRequests: number;
    flaggedRequests: number;
    killedRequests: number;
    totalViolations: number;
    criticalViolations: number;
    activeAgents: number;
    blockedAgents: number;
  } {
    const requestStats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN decision = 'APPROVE' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN decision = 'FLAG' THEN 1 ELSE 0 END) as flagged,
        SUM(CASE WHEN decision = 'KILL' THEN 1 ELSE 0 END) as killed
      FROM requests
    `).get() as { total: number; approved: number; flagged: number; killed: number };

    const violationStats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical
      FROM violations
    `).get() as { total: number; critical: number };

    const agentStats = this.db.prepare(`
      SELECT
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as blocked
      FROM agent_permissions
    `).get() as { active: number; blocked: number };

    return {
      totalRequests: requestStats.total,
      approvedRequests: requestStats.approved || 0,
      flaggedRequests: requestStats.flagged || 0,
      killedRequests: requestStats.killed || 0,
      totalViolations: violationStats.total,
      criticalViolations: violationStats.critical || 0,
      activeAgents: agentStats?.active || 0,
      blockedAgents: agentStats?.blocked || 0,
    };
  }

  close(): void {
    this.db.close();
  }
}

export const db = new DatabaseService();
