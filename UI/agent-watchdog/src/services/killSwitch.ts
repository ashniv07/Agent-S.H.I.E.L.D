import { db } from '../db/index.js';
import { auditLogger } from './auditLogger.js';
import type { AgentPermission } from '../types/index.js';

export interface KillSwitchResult {
  success: boolean;
  agentId: string;
  previousState: boolean;
  newState: boolean;
  reason: string;
  timestamp: string;
}

class KillSwitchService {
  /**
   * Trigger the kill switch for a specific agent
   * This blocks all future requests from the agent
   */
  trigger(agentId: string, reason: string, requestId?: string): KillSwitchResult {
    const timestamp = new Date().toISOString();
    const existing = db.getAgentPermission(agentId);
    const previousState = existing?.is_active === 1;

    // Update agent permissions to blocked
    db.upsertAgentPermission({
      agent_id: agentId,
      is_active: 0,
      permissions: existing?.permissions || '[]',
      blocked_at: timestamp,
      blocked_reason: reason,
    });

    // Log the kill switch action
    auditLogger.logKillSwitch(agentId, reason, previousState, requestId);

    return {
      success: true,
      agentId,
      previousState,
      newState: false,
      reason,
      timestamp,
    };
  }

  /**
   * Restore an agent's permissions (disable kill switch)
   */
  restore(agentId: string, reason: string, requestId?: string): KillSwitchResult {
    const timestamp = new Date().toISOString();
    const existing = db.getAgentPermission(agentId);
    const previousState = existing?.is_active === 1;

    // Update agent permissions to active
    db.upsertAgentPermission({
      agent_id: agentId,
      is_active: 1,
      permissions: existing?.permissions || '[]',
      blocked_at: null,
      blocked_reason: null,
    });

    // Log the restoration
    auditLogger.logRestore(agentId, reason, previousState, requestId);

    return {
      success: true,
      agentId,
      previousState,
      newState: true,
      reason,
      timestamp,
    };
  }

  /**
   * Check if an agent is currently blocked
   */
  isBlocked(agentId: string): boolean {
    const permission = db.getAgentPermission(agentId);
    return permission?.is_active === 0;
  }

  /**
   * Get the current status of an agent
   */
  getStatus(agentId: string): {
    agentId: string;
    isBlocked: boolean;
    blockedAt?: string;
    blockedReason?: string;
  } {
    const permission = db.getAgentPermission(agentId);

    if (!permission) {
      return {
        agentId,
        isBlocked: false,
      };
    }

    return {
      agentId,
      isBlocked: permission.is_active === 0,
      blockedAt: permission.blocked_at || undefined,
      blockedReason: permission.blocked_reason || undefined,
    };
  }

  /**
   * Get all blocked agents
   */
  getBlockedAgents(): AgentPermission[] {
    return db
      .getAllAgentPermissions()
      .filter((p) => p.is_active === 0)
      .map((p) => ({
        agentId: p.agent_id,
        isActive: false,
        permissions: JSON.parse(p.permissions || '[]'),
        blockedAt: p.blocked_at || undefined,
        blockedReason: p.blocked_reason || undefined,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
  }

  /**
   * Emergency kill all - blocks all known agents
   */
  emergencyKillAll(reason: string): KillSwitchResult[] {
    const agents = db.getAllAgentPermissions();
    const results: KillSwitchResult[] = [];

    for (const agent of agents) {
      results.push(this.trigger(agent.agent_id, `EMERGENCY: ${reason}`));
    }

    return results;
  }
}

export const killSwitch = new KillSwitchService();
