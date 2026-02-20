import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import type { WatchdogStateType } from '../agents/state.js';
import type { Decision, AuditLog } from '../types/index.js';

class AuditLoggerService {
  /**
   * Log a complete request processing result
   */
  logRequestProcessing(
    requestId: string,
    state: WatchdogStateType
  ): AuditLog {
    const { request, monitorResult, analysisResult, severityResult, fixResult, decision, decisionReasoning, processingPath } = state;

    const auditLog = db.createAuditLog({
      id: uuidv4(),
      request_id: requestId,
      agent_id: request.agentId,
      action: request.action,
      decision: decision || 'FLAG',
      reasoning: decisionReasoning || 'No reasoning provided',
      pipeline_path: JSON.stringify(processingPath),
      monitor_result: monitorResult ? JSON.stringify(monitorResult) : null,
      analysis_result: analysisResult ? JSON.stringify(analysisResult) : null,
      severity_result: severityResult ? JSON.stringify(severityResult) : null,
      fix_result: fixResult ? JSON.stringify(fixResult) : null,
    });

    // Also create violation records
    if (analysisResult?.violations) {
      for (const violation of analysisResult.violations) {
        db.createViolation({
          id: uuidv4(),
          request_id: requestId,
          type: violation.type,
          description: violation.description,
          severity: severityResult?.overallSeverity || 'MEDIUM',
          evidence: violation.evidence,
          suggested_fix: fixResult?.suggestions?.[0]?.description || null,
        });
      }
    }

    return this.formatAuditLog(auditLog);
  }

  /**
   * Log a kill switch activation
   */
  logKillSwitch(agentId: string, reason: string, previousState: boolean): void {
    const systemRequestId = uuidv4();
    db.createAuditLog({
      id: uuidv4(),
      request_id: null,
      agent_id: agentId,
      action: 'KILL_SWITCH_ACTIVATED',
      decision: 'KILL',
      reasoning: `Kill switch activated. Reason: ${reason}. Previous state: ${previousState ? 'active' : 'blocked'}`,
      pipeline_path: JSON.stringify(['killSwitch']),
      monitor_result: null,
      analysis_result: null,
      severity_result: null,
      fix_result: null,
    });
  }

  /**
   * Log a kill switch restoration
   */
  logRestore(agentId: string, reason: string, previousState: boolean): void {
    const systemRequestId = uuidv4();
    db.createAuditLog({
      id: uuidv4(),
      request_id: null,
      agent_id: agentId,
      action: 'KILL_SWITCH_DEACTIVATED',
      decision: 'APPROVE',
      reasoning: `Kill switch deactivated. Reason: ${reason}. Previous state: ${previousState ? 'active' : 'blocked'}`,
      pipeline_path: JSON.stringify(['killSwitch']),
      monitor_result: null,
      analysis_result: null,
      severity_result: null,
      fix_result: null,
    });
  }

  /**
   * Get all audit logs
   */
  getAll(limit = 100, offset = 0): AuditLog[] {
    const logs = db.getAuditLogs(limit, offset);
    return logs.map(this.formatAuditLog);
  }

  /**
   * Get audit logs for a specific agent
   */
  getByAgent(agentId: string): AuditLog[] {
    const logs = db.getAuditLogsByAgent(agentId);
    return logs.map(this.formatAuditLog);
  }

  /**
   * Get audit log by ID
   */
  getById(id: string): AuditLog | undefined {
    const log = db.getAuditLog(id);
    return log ? this.formatAuditLog(log) : undefined;
  }

  private formatAuditLog(row: ReturnType<typeof db.getAuditLog>): AuditLog {
    if (!row) throw new Error('Audit log not found');

    return {
      id: row.id,
      requestId: row.request_id,
      agentId: row.agent_id,
      action: row.action,
      decision: row.decision as Decision,
      reasoning: row.reasoning,
      violations: row.analysis_result
        ? JSON.parse(row.analysis_result).violations?.map(
            (v: { type: string; description: string; evidence: string }) => ({
              id: uuidv4(),
              requestId: row.request_id,
              type: v.type,
              description: v.description,
              severity: 'MEDIUM' as const,
              evidence: v.evidence,
              detectedAt: row.created_at,
            })
          )
        : undefined,
      timestamp: row.created_at,
    };
  }
}

export const auditLogger = new AuditLoggerService();
