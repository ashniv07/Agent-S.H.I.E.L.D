import { useState } from 'react';

interface PipelineStage {
  id: string;
  label: string;
  icon: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  summary: string;
  details?: Record<string, unknown> | string | null;
}

interface AuditData {
  requestId?: string;
  agentId?: string;
  action?: string;
  target?: string;
  decision?: string;
  reasoning?: string;
  monitorResult?: { intent?: string; riskIndicators?: string[]; dataAccessPatterns?: string[] } | null;
  analysisResult?: { violations?: Array<{ type: string; description: string; evidence: string }>; policyBreaches?: string[] } | null;
  severityResult?: { overallSeverity?: string; riskScore?: number; reasoning?: string; triggeredRules?: string[]; riskFactors?: unknown[] } | null;
  fixResult?: { suggestions?: Array<{ action: string; description: string; priority: string }> } | null;
  pipelinePath?: string[];
}

interface PipelineTraceProps {
  auditData: AuditData;
}

const statusStyles = {
  pass: { dot: 'bg-green-500', border: 'border-green-600', text: 'text-green-400', label: 'PASS' },
  warn: { dot: 'bg-yellow-500', border: 'border-yellow-600', text: 'text-yellow-400', label: 'WARN' },
  fail: { dot: 'bg-red-500',   border: 'border-red-600',   text: 'text-red-400',   label: 'FAIL' },
  skip: { dot: 'bg-gray-600',  border: 'border-gray-700',  text: 'text-gray-500',  label: 'SKIP' },
};

function buildStages(audit: AuditData): PipelineStage[] {
  const violations = audit.analysisResult?.violations || [];
  const riskScore = audit.severityResult?.riskScore ?? 0;
  const severity = audit.severityResult?.overallSeverity || 'UNKNOWN';
  const decision = audit.decision || 'UNKNOWN';

  const decisionStatus: PipelineStage['status'] =
    decision === 'KILL' ? 'fail' :
    decision === 'FLAG' ? 'warn' : 'pass';

  const violationStatus: PipelineStage['status'] =
    violations.length === 0 ? 'pass' :
    violations.some((v) => (v as { severity?: string }).severity === 'CRITICAL') ? 'fail' : 'warn';

  const riskStatus: PipelineStage['status'] =
    riskScore >= 86 ? 'fail' :
    riskScore >= 61 ? 'warn' :
    riskScore >= 31 ? 'warn' : 'pass';

  const severityStatus: PipelineStage['status'] =
    severity === 'CRITICAL' ? 'fail' :
    severity === 'HIGH' ? 'warn' :
    severity === 'MEDIUM' ? 'warn' : 'pass';

  return [
    {
      id: 'received',
      label: 'Request Received',
      icon: '📥',
      status: 'pass',
      summary: `${audit.agentId || 'unknown'} → ${audit.action || 'unknown'}`,
      details: {
        agentId: audit.agentId,
        action: audit.action,
        target: audit.target,
        intent: audit.monitorResult?.intent,
        riskIndicators: audit.monitorResult?.riskIndicators,
      },
    },
    {
      id: 'rules',
      label: 'Rules Triggered',
      icon: '🔍',
      status: violationStatus,
      summary: violations.length === 0
        ? 'No violations detected'
        : `${violations.length} violation${violations.length > 1 ? 's' : ''} — ${(audit.severityResult?.triggeredRules || []).join(', ') || 'policy rules matched'}`,
      details: {
        violations: violations,
        policyBreaches: audit.analysisResult?.policyBreaches,
        triggeredRules: audit.severityResult?.triggeredRules,
      },
    },
    {
      id: 'risk',
      label: 'Risk Calculated',
      icon: '⚖️',
      status: riskStatus,
      summary: `Score: ${riskScore}/100`,
      details: {
        riskScore,
        riskFactors: audit.severityResult?.riskFactors,
        reasoning: audit.severityResult?.reasoning,
      },
    },
    {
      id: 'severity',
      label: 'Severity Classified',
      icon: '🏷️',
      status: severityStatus,
      summary: severity,
      details: {
        severity,
        riskScore,
        triggeredRules: audit.severityResult?.triggeredRules,
      },
    },
    {
      id: 'action',
      label: 'Action Taken',
      icon: '⚡',
      status: decisionStatus,
      summary: decision,
      details: {
        decision,
        reasoning: audit.reasoning,
        suggestions: audit.fixResult?.suggestions,
      },
    },
  ];
}

function StageCard({ stage, isLast }: { stage: PipelineStage; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const s = statusStyles[stage.status];

  return (
    <div className="flex items-start gap-0">
      <div className="flex flex-col items-center">
        {/* Circle node */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-8 h-8 rounded-full border-2 ${s.border} flex items-center justify-center text-base flex-shrink-0 hover:scale-110 transition-transform cursor-pointer`}
          title="Click to expand"
        >
          {stage.icon}
        </button>
        {/* Connector line */}
        {!isLast && <div className="w-0.5 h-full bg-gray-700 mt-1" style={{ minHeight: '20px' }} />}
      </div>

      <div className="ml-3 pb-4 flex-1 min-w-0">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-sm font-semibold text-gray-200">{stage.label}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${s.dot.replace('bg-', 'bg-').replace('500', '900/60')} border ${s.border} ${s.text}`}>
            {s.label}
          </span>
          <span className="text-xs text-gray-400 truncate">{stage.summary}</span>
          <span className="text-gray-600 text-xs ml-auto">{expanded ? '▲' : '▼'}</span>
        </div>

        {expanded && stage.details && (
          <div className="mt-2 p-2 bg-gray-800/60 rounded border border-gray-700 text-xs font-mono text-gray-300 overflow-auto max-h-40">
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(stage.details, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function PipelineTrace({ auditData }: PipelineTraceProps) {
  const stages = buildStages(auditData);

  return (
    <div className="rounded-xl bg-gray-900/60 border border-gray-700 p-4">
      <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
        <span>Pipeline Trace</span>
        <span className="text-xs text-gray-500 font-normal">— click any stage to inspect</span>
      </h4>
      <div>
        {stages.map((stage, idx) => (
          <StageCard key={stage.id} stage={stage} isLast={idx === stages.length - 1} />
        ))}
      </div>
    </div>
  );
}
