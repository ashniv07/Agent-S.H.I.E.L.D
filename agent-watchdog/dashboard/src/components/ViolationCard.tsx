import { useState } from 'react';
import { RiskScoreCard } from './RiskScoreCard.js';
import { PipelineTrace } from './PipelineTrace.js';

interface Violation {
  id: string;
  requestId?: string;
  type: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence?: string;
  suggestedFix?: string;
  detectedAt: string;
}

interface ViolationCardProps {
  violation: Violation;
}

const severityColors = {
  LOW:      'bg-green-900/50 border-green-500 text-green-400',
  MEDIUM:   'bg-yellow-900/50 border-yellow-500 text-yellow-400',
  HIGH:     'bg-orange-900/50 border-orange-500 text-orange-400',
  CRITICAL: 'bg-red-900/50 border-red-500 text-red-400',
};

const severityBadgeColors = {
  LOW:      'bg-green-600',
  MEDIUM:   'bg-yellow-600',
  HIGH:     'bg-orange-600',
  CRITICAL: 'bg-red-600',
};

interface AuditData {
  id: string;
  requestId: string;
  agentId: string;
  action: string;
  decision: 'APPROVE' | 'FLAG' | 'KILL';
  reasoning: string;
  timestamp: string;
  pipelinePath?: string[];
  monitorResult?: { intent?: string; riskIndicators?: string[]; dataAccessPatterns?: string[] } | null;
  analysisResult?: { violations?: Array<{ type: string; description: string; evidence: string }>; policyBreaches?: string[] } | null;
  severityResult?: {
    overallSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskScore?: number;
    reasoning?: string;
    riskFactors?: Array<{ factor: string; weight: number; triggered: boolean; evidence: string | null }>;
    triggeredRules?: string[];
    finalAction?: string;
  } | null;
  fixResult?: { suggestions?: Array<{ action: string; description: string; priority: string }> } | null;
}

export function ViolationCard({ violation }: ViolationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const handleInspect = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (!violation.requestId) {
      setExpanded(true);
      return;
    }
    if (auditData) {
      setExpanded(true);
      return;
    }
    setLoadingAudit(true);
    try {
      const res = await fetch(`/api/audit/request/${violation.requestId}`);
      if (res.ok) {
        setAuditData((await res.json()) as AuditData);
      }
    } catch {
      // show panel anyway
    } finally {
      setLoadingAudit(false);
      setExpanded(true);
    }
  };

  return (
    <div className={`border-l-4 rounded-lg overflow-hidden ${severityColors[violation.severity]} animate-slide-in`}>
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 text-xs font-bold rounded ${severityBadgeColors[violation.severity]} text-white`}>
              {violation.severity}
            </span>
            <span className="font-semibold text-gray-100">{violation.type}</span>
          </div>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <span className="text-xs text-gray-400">
              {new Date(violation.detectedAt).toLocaleTimeString()}
            </span>
            {violation.requestId && (
              <button
                onClick={handleInspect}
                disabled={loadingAudit}
                className="px-2 py-0.5 text-xs rounded border border-cyan-700 text-cyan-400 hover:bg-cyan-900/30 transition-colors disabled:opacity-50"
              >
                {loadingAudit ? '...' : expanded ? 'Close' : 'Inspect'}
              </button>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-300 mb-2">{violation.description}</p>

        {violation.evidence && (
          <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs font-mono text-gray-400">
            <span className="text-gray-500">Evidence: </span>
            {violation.evidence}
          </div>
        )}

        {violation.suggestedFix && (
          <div className="mt-2 p-2 bg-blue-900/30 rounded text-xs">
            <span className="text-blue-400 font-semibold">Suggested Fix: </span>
            <span className="text-gray-300">{violation.suggestedFix}</span>
          </div>
        )}
      </div>

      {/* Expanded inspection panel */}
      {expanded && (
        <div className="border-t border-gray-700/50 p-4 space-y-4 bg-gray-900/40">
          {auditData?.severityResult && (
            <RiskScoreCard
              riskScore={auditData.severityResult.riskScore ?? 0}
              severity={auditData.severityResult.overallSeverity ?? violation.severity}
              riskFactors={auditData.severityResult.riskFactors}
              triggeredRules={auditData.severityResult.triggeredRules}
              finalAction={auditData.severityResult.finalAction ?? auditData.decision}
              reasoning={auditData.severityResult.reasoning}
            />
          )}

          {auditData && (
            <PipelineTrace
              auditData={{
                requestId: auditData.requestId,
                agentId: auditData.agentId,
                action: auditData.action,
                decision: auditData.decision,
                reasoning: auditData.reasoning,
                monitorResult: auditData.monitorResult,
                analysisResult: auditData.analysisResult,
                severityResult: auditData.severityResult,
                fixResult: auditData.fixResult,
                pipelinePath: auditData.pipelinePath,
              }}
            />
          )}

          {!auditData && (
            <p className="text-xs text-gray-500 text-center py-2">
              No audit trace available for this violation
            </p>
          )}
        </div>
      )}
    </div>
  );
}
