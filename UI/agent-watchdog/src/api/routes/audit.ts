import { Router, type Request, type Response } from 'express';
import { auditLogger } from '../../services/auditLogger.js';
import { db } from '../../db/index.js';

export const auditRouter = Router();

// Get all audit logs
auditRouter.get('/', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = auditLogger.getAll(limit, offset, req.authApiKeyId);

    return res.json({
      logs,
      pagination: {
        limit,
        offset,
        total: logs.length,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Get audit log by ID
auditRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const log = auditLogger.getById(id, req.authApiKeyId);

    if (!log) {
      return res.status(404).json({
        error: 'Audit log not found',
      });
    }

    // Fetch raw row to include parsed pipeline JSON fields (severityResult, etc.)
    const rawRow = db.getAuditLog(id);
    return res.json({
      ...log,
      pipelinePath: rawRow?.pipeline_path ? JSON.parse(rawRow.pipeline_path) : [],
      monitorResult: rawRow?.monitor_result ? JSON.parse(rawRow.monitor_result) : null,
      analysisResult: rawRow?.analysis_result ? JSON.parse(rawRow.analysis_result) : null,
      severityResult: rawRow?.severity_result ? JSON.parse(rawRow.severity_result) : null,
      fixResult: rawRow?.fix_result ? JSON.parse(rawRow.fix_result) : null,
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Get audit logs for a specific agent
auditRouter.get('/agent/:agentId', (req: Request, res: Response) => {
  try {
    const agentId = Array.isArray(req.params.agentId) ? req.params.agentId[0] : req.params.agentId;
    const logs = auditLogger.getByAgent(agentId, req.authApiKeyId);

    return res.json({
      agentId,
      logs,
      total: logs.length,
    });
  } catch (error) {
    console.error('Error fetching agent audit logs:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Get violations
auditRouter.get('/violations/all', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const violations = db.getViolations(limit, offset, req.authApiKeyId);

    return res.json({
      violations: violations.map((v) => ({
        id: v.id,
        requestId: v.request_id,
        type: v.type,
        description: v.description,
        severity: v.severity,
        evidence: v.evidence,
        suggestedFix: v.suggested_fix,
        detectedAt: v.detected_at,
      })),
      pagination: {
        limit,
        offset,
        total: violations.length,
      },
    });
  } catch (error) {
    console.error('Error fetching violations:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Get audit log by request ID
auditRouter.get('/request/:requestId', (req: Request, res: Response) => {
  try {
    const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
    const log = db.getAuditLogByRequest(requestId, req.authApiKeyId);
    if (!log) {
      return res.status(404).json({ error: 'Audit log not found for this request' });
    }
    return res.json({
      id: log.id,
      requestId: log.request_id,
      agentId: log.agent_id,
      action: log.action,
      decision: log.decision,
      reasoning: log.reasoning,
      pipelinePath: log.pipeline_path ? JSON.parse(log.pipeline_path) : [],
      monitorResult: log.monitor_result ? JSON.parse(log.monitor_result) : null,
      analysisResult: log.analysis_result ? JSON.parse(log.analysis_result) : null,
      severityResult: log.severity_result ? JSON.parse(log.severity_result) : null,
      fixResult: log.fix_result ? JSON.parse(log.fix_result) : null,
      timestamp: log.created_at,
    });
  } catch (error) {
    console.error('Error fetching audit log by request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get statistics scoped to the authenticated API key/session
auditRouter.get('/stats/summary', (req: Request, res: Response) => {
  try {
    const stats = db.getStats(req.authApiKeyId);

    return res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});
