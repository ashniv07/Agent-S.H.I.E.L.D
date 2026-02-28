import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AgentRequestSchema } from '../../types/index.js';
import { db } from '../../db/index.js';
import { analyzeRequest } from '../../agents/graph.js';
import { auditLogger } from '../../services/auditLogger.js';
import { killSwitch } from '../../services/killSwitch.js';
import { permissions } from '../../services/permissions.js';
import { getAnomalyScore, updateBaseline } from '../../services/behavioralTracker.js';
import type { Server as SocketIOServer } from 'socket.io';
import type { WatchdogStateType } from '../../agents/state.js';

export function createRequestsRouter(io: SocketIOServer): Router {
  const router = Router();
  const getParam = (param: string | string[]): string => (Array.isArray(param) ? param[0] : param);

  // Submit a new request for analysis
  router.post('/', async (req: Request, res: Response) => {
    try {
      // Validate input
      const parseResult = AgentRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid request format',
          details: parseResult.error.format(),
        });
      }

      const request = parseResult.data;
      const requestId = request.id || uuidv4();
      request.id = requestId;
      request.timestamp = new Date().toISOString();

      // Check if agent is blocked
      if (killSwitch.isBlocked(request.agentId)) {
        const status = killSwitch.getStatus(request.agentId);
        return res.status(403).json({
          error: 'Agent is blocked',
          agentId: request.agentId,
          blockedAt: status.blockedAt,
          blockedReason: status.blockedReason,
        });
      }

      // Ensure agent is registered
      permissions.register(request.agentId);

      // Create request record
      const dbRequest = db.createRequest({
        id: requestId,
        api_key_id: req.authApiKeyId ?? null,
        agent_id: request.agentId,
        action: request.action,
        target: request.target,
        context: request.context || null,
        metadata: request.metadata ? JSON.stringify(request.metadata) : null,
      });

      // Emit new request event
      io.emit('request:new', {
        id: requestId,
        agentId: request.agentId,
        action: request.action,
        target: request.target,
        status: 'processing',
        timestamp: request.timestamp,
      });

      // Update status to processing
      db.updateRequest(requestId, { status: 'processing' });

      // Get behavioral anomaly score before pipeline
      const behavioralAnomalyScore = getAnomalyScore(
        request.agentId,
        request.action,
        request.target
      );

      // Run the analysis pipeline
      const result = await analyzeRequest(request, { behavioralAnomalyScore });

      // Update request with decision
      const statusMap = {
        APPROVE: 'approved' as const,
        FLAG: 'flagged' as const,
        KILL: 'killed' as const,
      };

      db.updateRequest(requestId, {
        status: result.decision ? statusMap[result.decision] : 'flagged',
        decision: result.decision || 'FLAG',
        decision_reasoning: result.decisionReasoning,
        processed_at: new Date().toISOString(),
      });

      // Log to audit trail
      const auditLog = auditLogger.logRequestProcessing(requestId, result);

      // Update behavioral baseline after processing
      const finalRiskScore = result.severityResult?.riskScore ?? 50;
      updateBaseline(request.agentId, request.action, request.target, finalRiskScore);

      const riskScore = result.severityResult?.riskScore ?? 0;
      const severity = result.severityResult?.overallSeverity;
      const shouldBlockAgent =
        result.decision === 'KILL' &&
        (riskScore >= 90 || severity === 'CRITICAL');

      // Trigger kill switch only for truly critical kill conditions.
      // This prevents routine/high (e.g., score ~75) requests from permanently blocking an agent.
      if (shouldBlockAgent) {
        killSwitch.trigger(
          request.agentId,
          `Automatic kill switch triggered. ${result.decisionReasoning}`,
          requestId
        );

        io.emit('killswitch:triggered', {
          agentId: request.agentId,
          requestId,
          reason: result.decisionReasoning,
          timestamp: new Date().toISOString(),
        });
      }

      // Emit violations if any
      if (result.analysisResult?.violations?.length) {
        for (const violation of result.analysisResult.violations) {
          io.emit('violation:detected', {
            requestId,
            agentId: request.agentId,
            violation,
            severity: result.severityResult?.overallSeverity,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Emit processed event
      io.emit('request:processed', {
        id: requestId,
        agentId: request.agentId,
        decision: result.decision,
        severity: result.severityResult?.overallSeverity,
        violationCount: result.analysisResult?.violations?.length || 0,
        processingPath: result.processingPath,
        timestamp: new Date().toISOString(),
      });

      // Return full result
      return res.status(200).json({
        requestId,
        decision: result.decision,
        reasoning: result.decisionReasoning,
        severity: result.severityResult,
        violations: result.analysisResult?.violations,
        suggestions: result.fixResult?.suggestions,
        processingPath: result.processingPath,
        auditLogId: auditLog.id,
      });
    } catch (error) {
      console.error('Error processing request:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Manual kill for a flagged request
  router.post('/:id/manual-kill', async (req: Request, res: Response) => {
    try {
      const requestId = getParam(req.params.id);

      const request = db.getRequest(requestId, req.authApiKeyId);
      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      // Only allow manual kill if the request is flagged or still processing
      if (request.status !== 'flagged' && request.status !== 'processing') {
        return res.status(400).json({
          error: `Cannot manually kill a request with status '${request.status}'`,
        });
      }

      // Trigger the kill switch
      const manualKillReason = `Manual kill initiated by human intervention for request ${requestId}.`;
      killSwitch.trigger(request.agent_id, manualKillReason, requestId);

      // Update request status in DB
      db.updateRequest(requestId, {
        status: 'killed',
        decision: 'KILL',
        decision_reasoning: manualKillReason,
        processed_at: new Date().toISOString(),
      });

      // For auditLogger.logRequestProcessing, construct a minimal PipelineState
      const manualKillResult: WatchdogStateType = {
          request: {
            id: request.id,
            agentId: request.agent_id,
            action: request.action,
            target: request.target,
            context: request.context ?? undefined,
            timestamp: request.created_at,
            metadata: undefined,
          },
          monitorResult: undefined,
          analysisResult: undefined,
          fixResult: undefined,
          decision: 'KILL',
          decisionReasoning: manualKillReason,
          processingPath: ['manualKill'], // Indicating it was a manual kill outside the auto pipeline
          behavioralAnomalyScore: 0,
          error: undefined,
          severityResult: { // A manual kill is a critical intervention
              overallSeverity: 'CRITICAL',
              riskScore: 100,
              reasoning: manualKillReason,
          },
      };
      auditLogger.logRequestProcessing(requestId, manualKillResult);

      // Emit WebSocket event for dashboard
      io.emit('killswitch:triggered', {
        agentId: request.agent_id,
        requestId,
        reason: manualKillReason,
        timestamp: new Date().toISOString(),
        isManual: true, // Add a flag to indicate manual kill
      });

      // Emit updated request:processed event
      io.emit('request:processed', {
        id: requestId,
        agentId: request.agent_id,
        decision: 'KILL',
        severity: manualKillResult.severityResult?.overallSeverity,
        violationCount: db.getViolationsByRequest(requestId, req.authApiKeyId).length,
        processingPath: manualKillResult.processingPath,
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json({
        message: 'Request manually killed successfully',
        requestId,
        agentId: request.agent_id,
      });
    } catch (error) {
      console.error(`Error manually killing request ${req.params.id}:`, error);
      return res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get all requests
  router.get('/', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const requests = db.getRequests(limit, offset, req.authApiKeyId);

      return res.json({
        requests: requests.map((r) => ({
          id: r.id,
          agentId: r.agent_id,
          action: r.action,
          target: r.target,
          context: r.context,
          status: r.status,
          decision: r.decision,
          createdAt: r.created_at,
          processedAt: r.processed_at,
        })),
        pagination: {
          limit,
          offset,
          total: requests.length,
        },
      });
    } catch (error) {
      console.error('Error fetching requests:', error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  // Get a specific request
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const request = db.getRequest(id, req.authApiKeyId);

      if (!request) {
        return res.status(404).json({
          error: 'Request not found',
        });
      }

      const violations = db.getViolationsByRequest(id, req.authApiKeyId);

      return res.json({
        id: request.id,
        agentId: request.agent_id,
        action: request.action,
        target: request.target,
        context: request.context,
        metadata: request.metadata ? JSON.parse(request.metadata) : null,
        status: request.status,
        decision: request.decision,
        decisionReasoning: request.decision_reasoning,
        violations: violations.map((v) => ({
          id: v.id,
          type: v.type,
          description: v.description,
          severity: v.severity,
          evidence: v.evidence,
          suggestedFix: v.suggested_fix,
          detectedAt: v.detected_at,
        })),
        createdAt: request.created_at,
        processedAt: request.processed_at,
      });
    } catch (error) {
      console.error('Error fetching request:', error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  return router;
}
