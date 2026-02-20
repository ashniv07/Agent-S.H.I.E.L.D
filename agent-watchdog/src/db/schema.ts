import { z } from 'zod';

// Database row schemas (snake_case for DB compatibility)

export const RequestRowSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  action: z.string(),
  target: z.string(),
  context: z.string().nullable(),
  metadata: z.string().nullable(), // JSON string
  status: z.enum(['pending', 'processing', 'approved', 'flagged', 'killed']),
  decision: z.enum(['APPROVE', 'FLAG', 'KILL']).nullable(),
  decision_reasoning: z.string().nullable(),
  created_at: z.string(),
  processed_at: z.string().nullable(),
});
export type RequestRow = z.infer<typeof RequestRowSchema>;

export const ViolationRowSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  type: z.string(),
  description: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  evidence: z.string().nullable(),
  suggested_fix: z.string().nullable(),
  detected_at: z.string(),
});
export type ViolationRow = z.infer<typeof ViolationRowSchema>;

export const AuditLogRowSchema = z.object({
  id: z.string(),
  request_id: z.string().nullable(),
  agent_id: z.string(),
  action: z.string(),
  decision: z.enum(['APPROVE', 'FLAG', 'KILL']),
  reasoning: z.string(),
  pipeline_path: z.string().nullable(), // JSON
  monitor_result: z.string().nullable(), // JSON
  analysis_result: z.string().nullable(), // JSON
  severity_result: z.string().nullable(), // JSON
  fix_result: z.string().nullable(), // JSON
  created_at: z.string(),
});
export type AuditLogRow = z.infer<typeof AuditLogRowSchema>;

export const AgentPermissionRowSchema = z.object({
  agent_id: z.string(),
  is_active: z.number(), // SQLite uses 0/1 for boolean
  permissions: z.string().nullable(), // JSON
  blocked_at: z.string().nullable(),
  blocked_reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AgentPermissionRow = z.infer<typeof AgentPermissionRowSchema>;
