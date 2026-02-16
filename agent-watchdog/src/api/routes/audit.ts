import { Router, type Request, type Response } from 'express';
import { auditLogger } from '../../services/auditLogger.js';
import { db } from '../../db/index.js';

export const auditRouter = Router();

// Get all audit logs
auditRouter.get('/', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = auditLogger.getAll(limit, offset);

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
    const log = auditLogger.getById(id);

    if (!log) {
      return res.status(404).json({
        error: 'Audit log not found',
      });
    }

    return res.json(log);
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
    const logs = auditLogger.getByAgent(agentId);

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

    const violations = db.getViolations(limit, offset);

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

// Get statistics
auditRouter.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const stats = db.getStats();

    return res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});
