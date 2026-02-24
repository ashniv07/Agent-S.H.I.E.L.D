import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import type { WatchdogStateType } from '../agents/state.js';
import type { Decision, AuditLog } from '../types/index.js';

class AuditLoggerService {
  private getOrCreateSystemRequestId(agentId: string, action: string, reason: string): string {
    const systemRequestId = uuidv4();
    db.createRequest({
      id: systemRequestId,
      api_key_id: null,
      agent_id: agentId,
      action,
      target: `system://${action.toLowerCase()}`,
      context: reason,
      metadata: JSON.stringify({ systemEvent: true }),
    });
    db.updateRequest(systemRequestId, {
      status: 'approved',
      decision: 'APPROVE',
      decision_reasoning: reason,
      processed_at: new Date().toISOString(),
    });
    return systemRequestId;
  }
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
  logKillSwitch(agentId: string, reason: string, previousState: boolean, requestId?: string): void {
    const resolvedRequestId = requestId ?? this.getOrCreateSystemRequestId(agentId, 'KILL_SWITCH_ACTIVATED', reason);
    db.createAuditLog({
      id: uuidv4(),
      request_id: resolvedRequestId,
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
  logRestore(agentId: string, reason: string, previousState: boolean, requestId?: string): void {
    const resolvedRequestId = requestId ?? this.getOrCreateSystemRequestId(agentId, 'KILL_SWITCH_DEACTIVATED', reason);
    db.createAuditLog({
      id: uuidv4(),
      request_id: resolvedRequestId,
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
  getAll(limit = 100, offset = 0, apiKeyId?: string): AuditLog[] {
    const logs = db.getAuditLogs(limit, offset, apiKeyId);
    return logs.map(this.formatAuditLog);
  }

  /**
   * Get audit logs for a specific agent
   */
  getByAgent(agentId: string, apiKeyId?: string): AuditLog[] {
    const logs = db.getAuditLogsByAgent(agentId, apiKeyId);
    return logs.map(this.formatAuditLog);
  }

  /**
   * Get audit log by ID
   */
  getById(id: string, apiKeyId?: string): AuditLog | undefined {
    const log = db.getAuditLog(id);
    if (apiKeyId && log?.request_id) {
      const scoped = db.getRequest(log.request_id, apiKeyId);
      if (!scoped) return undefined;
    }
    return log ? this.formatAuditLog(log) : undefined;
  }

  private formatAuditLog(row: ReturnType<typeof db.getAuditLog>): AuditLog {
    if (!row) throw new Error('Audit log not found');

    return {
      id: row.id,
      requestId: row.request_id ?? '',
      agentId: row.agent_id,
      action: row.action,
      decision: row.decision as Decision,
      reasoning: row.reasoning,
      violations: row.analysis_result
        ? JSON.parse(row.analysis_result).violations?.map(
            (v: { type: string; description: string; evidence: string }) => ({
              id: uuidv4(),
              requestId: row.request_id ?? '',
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
