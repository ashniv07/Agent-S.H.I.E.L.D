import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { killSwitch } from '../../services/killSwitch.js';
import { permissions } from '../../services/permissions.js';
import type { Server as SocketIOServer } from 'socket.io';

// Helper to extract string param
function getParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export function createAgentsRouter(io: SocketIOServer): Router {
  const router = Router();

  // Get all agents
  router.get('/', (_req: Request, res: Response) => {
    try {
      const agents = permissions.getAll();

      return res.json({
        agents: agents.map((a) => ({
          agentId: a.agentId,
          isActive: a.isActive,
          permissions: a.permissions,
          blockedAt: a.blockedAt,
          blockedReason: a.blockedReason,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
        total: agents.length,
      });
    } catch (error) {
      console.error('Error fetching agents:', error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  // Get a specific agent
  router.get('/:agentId', (req: Request, res: Response) => {
    try {
      const agentId = getParam(req.params.agentId);
      const agent = permissions.get(agentId);
      const status = killSwitch.getStatus(agentId);

      return res.json({
        ...agent,
        killSwitchStatus: status,
      });
    } catch (error) {
      console.error('Error fetching agent:', error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  // Update agent permissions
  const updatePermissionsSchema = z.object({
    permissions: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  });

  router.patch('/:agentId/permissions', (req: Request, res: Response) => {
    try {
      const agentId = getParam(req.params.agentId);
      const parseResult = updatePermissionsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid request format',
          details: parseResult.error.format(),
        });
      }

      const updated = permissions.update({
        agentId,
        ...parseResult.data,
      });

      io.emit('agent:status', {
        agentId,
        action: 'permissions_updated',
        permissions: updated.permissions,
        timestamp: new Date().toISOString(),
      });

      return res.json(updated);
    } catch (error) {
      console.error('Error updating permissions:', error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  // Trigger kill switch for an agent
  const killSwitchSchema = z.object({
    reason: z.string().min(1, 'Reason is required'),
  });

  router.post('/:agentId/killswitch', (req: Request, res: Response) => {
    try {
      const agentId = getParam(req.params.agentId);
      const parseResult = killSwitchSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid request format',
          details: parseResult.error.format(),
        });
      }

      const result = killSwitch.trigger(agentId, parseResult.data.reason);

      io.emit('killswitch:triggered', {
        agentId,
        reason: parseResult.data.reason,
        timestamp: result.timestamp,
        manual: true,
      });

      return res.json(result);
    } catch (error) {
      console.error('Error triggering kill switch:', error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  // Restore an agent (disable kill switch)
  router.post('/:agentId/restore', (req: Request, res: Response) => {
    try {
      const agentId = getParam(req.params.agentId);
      const parseResult = killSwitchSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid request format',
          details: parseResult.error.format(),
        });
      }

      const result = killSwitch.restore(agentId, parseResult.data.reason);

      io.emit('agent:status', {
        agentId,
        action: 'restored',
        reason: parseResult.data.reason,
        timestamp: result.timestamp,
      });

      return res.json(result);
    } catch (error) {
      console.error('Error restoring agent:', error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  // Get blocked agents
  router.get('/status/blocked', (_req: Request, res: Response) => {
    try {
      const blocked = killSwitch.getBlockedAgents();

      return res.json({
        blockedAgents: blocked,
        total: blocked.length,
      });
    } catch (error) {
      console.error('Error fetching blocked agents:', error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  // Emergency kill all
  router.post('/emergency/kill-all', (req: Request, res: Response) => {
    try {
      const parseResult = killSwitchSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid request format',
          details: parseResult.error.format(),
        });
      }

      const results = killSwitch.emergencyKillAll(parseResult.data.reason);

      io.emit('killswitch:triggered', {
        agentId: 'ALL',
        reason: `EMERGENCY: ${parseResult.data.reason}`,
        timestamp: new Date().toISOString(),
        affectedAgents: results.map((r) => r.agentId),
      });

      return res.json({
        message: 'Emergency kill switch activated for all agents',
        results,
      });
    } catch (error) {
      console.error('Error triggering emergency kill:', error);
      return res.status(500).json({
        error: 'Internal server error',
      });
    }
  });

  return router;
}
