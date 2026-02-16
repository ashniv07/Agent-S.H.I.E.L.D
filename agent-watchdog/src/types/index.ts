import { z } from 'zod';

// Severity levels for violations
export const SeverityLevel = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type SeverityLevel = z.infer<typeof SeverityLevel>;

// Decision types for the decision engine
export const Decision = z.enum(['APPROVE', 'FLAG', 'KILL']);
export type Decision = z.infer<typeof Decision>;

// Agent request schema
export const AgentRequestSchema = z.object({
  id: z.string().uuid().optional(),
  agentId: z.string(),
  action: z.string(),
  target: z.string(),
  context: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type AgentRequest = z.infer<typeof AgentRequestSchema>;

// Violation schema
export const ViolationSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  type: z.string(),
  description: z.string(),
  severity: SeverityLevel,
  evidence: z.string().optional(),
  suggestedFix: z.string().optional(),
  detectedAt: z.string().datetime(),
});
export type Violation = z.infer<typeof ViolationSchema>;

// Audit log entry
export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  agentId: z.string(),
  action: z.string(),
  decision: Decision,
  reasoning: z.string(),
  violations: z.array(ViolationSchema).optional(),
  timestamp: z.string().datetime(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

// Agent permission state
export const AgentPermissionSchema = z.object({
  agentId: z.string(),
  isActive: z.boolean(),
  permissions: z.array(z.string()),
  blockedAt: z.string().datetime().optional(),
  blockedReason: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AgentPermission = z.infer<typeof AgentPermissionSchema>;

// Pipeline state for LangGraph
export const PipelineStateSchema = z.object({
  request: AgentRequestSchema,
  monitorResult: z.object({
    intent: z.string(),
    dataAccessPatterns: z.array(z.string()),
    riskIndicators: z.array(z.string()),
  }).optional(),
  analysisResult: z.object({
    violations: z.array(z.object({
      type: z.string(),
      description: z.string(),
      evidence: z.string(),
    })),
    policyBreaches: z.array(z.string()),
  }).optional(),
  severityResult: z.object({
    overallSeverity: SeverityLevel,
    riskScore: z.number().min(0).max(100),
    reasoning: z.string(),
  }).optional(),
  fixResult: z.object({
    suggestions: z.array(z.object({
      action: z.string(),
      description: z.string(),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    })),
    sanitizedRequest: AgentRequestSchema.optional(),
  }).optional(),
  decision: Decision.optional(),
  decisionReasoning: z.string().optional(),
  processingPath: z.array(z.string()).default([]),
});
export type PipelineState = z.infer<typeof PipelineStateSchema>;

// WebSocket event types
export type WSEventType =
  | 'request:new'
  | 'request:processed'
  | 'violation:detected'
  | 'killswitch:triggered'
  | 'agent:status';

export interface WSEvent {
  type: WSEventType;
  data: unknown;
  timestamp: string;
}
