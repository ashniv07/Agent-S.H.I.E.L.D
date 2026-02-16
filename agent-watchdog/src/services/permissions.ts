import { db } from '../db/index.js';
import type { AgentPermission } from '../types/index.js';

export interface PermissionUpdate {
  agentId: string;
  permissions?: string[];
  isActive?: boolean;
}

class PermissionService {
  /**
   * Get permissions for an agent
   */
  get(agentId: string): AgentPermission {
    const row = db.getAgentPermission(agentId);

    if (!row) {
      // Return default permissions for unknown agents
      return {
        agentId,
        isActive: true,
        permissions: ['read', 'write'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      agentId: row.agent_id,
      isActive: row.is_active === 1,
      permissions: JSON.parse(row.permissions || '[]'),
      blockedAt: row.blocked_at || undefined,
      blockedReason: row.blocked_reason || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Update permissions for an agent
   */
  update(update: PermissionUpdate): AgentPermission {
    const existing = db.getAgentPermission(update.agentId);

    const newPermissions = update.permissions ??
      (existing ? JSON.parse(existing.permissions || '[]') : ['read', 'write']);

    const isActive = update.isActive ??
      (existing ? existing.is_active === 1 : true);

    db.upsertAgentPermission({
      agent_id: update.agentId,
      is_active: isActive ? 1 : 0,
      permissions: JSON.stringify(newPermissions),
      blocked_at: existing?.blocked_at || null,
      blocked_reason: existing?.blocked_reason || null,
    });

    return this.get(update.agentId);
  }

  /**
   * Check if an agent has a specific permission
   */
  hasPermission(agentId: string, permission: string): boolean {
    const agentPerms = this.get(agentId);

    if (!agentPerms.isActive) {
      return false;
    }

    return agentPerms.permissions.includes(permission) ||
           agentPerms.permissions.includes('*');
  }

  /**
   * Add a permission to an agent
   */
  addPermission(agentId: string, permission: string): AgentPermission {
    const current = this.get(agentId);
    const permissions = [...new Set([...current.permissions, permission])];
    return this.update({ agentId, permissions });
  }

  /**
   * Remove a permission from an agent
   */
  removePermission(agentId: string, permission: string): AgentPermission {
    const current = this.get(agentId);
    const permissions = current.permissions.filter(p => p !== permission);
    return this.update({ agentId, permissions });
  }

  /**
   * Get all agents with their permissions
   */
  getAll(): AgentPermission[] {
    const rows = db.getAllAgentPermissions();
    return rows.map(row => ({
      agentId: row.agent_id,
      isActive: row.is_active === 1,
      permissions: JSON.parse(row.permissions || '[]'),
      blockedAt: row.blocked_at || undefined,
      blockedReason: row.blocked_reason || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Register a new agent with default permissions
   */
  register(agentId: string, permissions: string[] = ['read', 'write']): AgentPermission {
    const existing = db.getAgentPermission(agentId);

    if (existing) {
      return this.get(agentId);
    }

    db.upsertAgentPermission({
      agent_id: agentId,
      is_active: 1,
      permissions: JSON.stringify(permissions),
      blocked_at: null,
      blocked_reason: null,
    });

    return this.get(agentId);
  }

  /**
   * Validate if an action is allowed based on permissions
   */
  validateAction(agentId: string, action: string): {
    allowed: boolean;
    reason?: string;
  } {
    const agentPerms = this.get(agentId);

    if (!agentPerms.isActive) {
      return {
        allowed: false,
        reason: `Agent ${agentId} is blocked: ${agentPerms.blockedReason || 'No reason provided'}`,
      };
    }

    // Map actions to required permissions
    const actionPermissionMap: Record<string, string[]> = {
      read_file: ['read', '*'],
      write_file: ['write', '*'],
      delete_file: ['delete', 'write', '*'],
      execute_command: ['execute', '*'],
      network_request: ['network', '*'],
      database_query: ['database', '*'],
    };

    const requiredPerms = actionPermissionMap[action] || [action, '*'];
    const hasPermission = requiredPerms.some(p =>
      agentPerms.permissions.includes(p)
    );

    if (!hasPermission) {
      return {
        allowed: false,
        reason: `Agent ${agentId} lacks permission for action: ${action}. Required: ${requiredPerms.join(' or ')}`,
      };
    }

    return { allowed: true };
  }
}

export const permissions = new PermissionService();
