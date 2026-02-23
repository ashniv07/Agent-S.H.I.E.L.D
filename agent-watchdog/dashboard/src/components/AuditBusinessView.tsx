import { RiskScoreCard } from './RiskScoreCard.js';

interface SeverityResult {
  overallSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore?: number;
  reasoning?: string;
  riskFactors?: Array<{ factor: string; weight: number; triggered: boolean; evidence: string | null }>;
  triggeredRules?: string[];
  finalAction?: string;
}

interface AuditEntry {
  id: string;
  requestId: string;
  agentId: string;
  action: string;
  decision: 'APPROVE' | 'FLAG' | 'KILL';
  reasoning: string;
  timestamp: string;
  monitorResult?: { intent?: string; riskIndicators?: string[]; dataAccessPatterns?: string[] } | null;
  analysisResult?: { violations?: Array<{ type: string; description: string; evidence: string }>; policyBreaches?: string[] } | null;
  severityResult?: SeverityResult | null;
  fixResult?: { suggestions?: Array<{ action: string; description: string; priority: string }> } | null;
}

interface AuditBusinessViewProps {
  entry: AuditEntry;
}

const decisionMessages: Record<string, { headline: string; color: string }> = {
  APPROVE: { headline: 'Request approved — no significant risk detected', color: 'text-green-400' },
  FLAG:    { headline: 'Request flagged for human review — elevated risk detected', color: 'text-yellow-400' },
  KILL:    { headline: 'Request blocked — critical security threat detected', color: 'text-red-400' },
};

function impactFromViolations(violations: Array<{ type: string }> = []): string {
  if (violations.length === 0) return 'No significant data exposure or system impact detected.';
  const types = violations.map((v) => v.type.toLowerCase());
  const impacts: string[] = [];
  if (types.some((t) => t.includes('pii') || t.includes('ssn') || t.includes('credit'))) {
    impacts.push('Personal Identifiable Information (PII) may be exposed');
  }
  if (types.some((t) => t.includes('system') || t.includes('file') || t.includes('exec'))) {
    impacts.push('System-level access or command execution attempted');
  }
  if (types.some((t) => t.includes('sql') || t.includes('data'))) {
    impacts.push('Database records at risk of unauthorized access or modification');
  }
  if (types.some((t) => t.includes('auth') || t.includes('privilege'))) {
    impacts.push('Unauthorized privilege escalation attempted');
  }
  if (types.some((t) => t.includes('network') || t.includes('net'))) {
    impacts.push('Suspicious network activity detected');
  }
  if (impacts.length === 0) {
    impacts.push(`${violations.length} policy violation${violations.length > 1 ? 's' : ''} detected requiring review`);
  }
  return impacts.join('; ') + '.';
}

export function AuditBusinessView({ entry }: AuditBusinessViewProps) {
  const violations = entry.analysisResult?.violations || [];
  const severity = (entry.severityResult?.overallSeverity || 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  const riskScore = entry.severityResult?.riskScore || 0;
  const dm = decisionMessages[entry.decision] || decisionMessages.FLAG;
  const suggestions = entry.fixResult?.suggestions || [];

  return (
    <div className="space-y-4 p-1">
      {/* Plain-language headline */}
      <div className="bg-gray-800/60 rounded-lg p-3">
        <p className="text-sm text-gray-300">
          Agent <span className="font-semibold text-cyan-400">{entry.agentId}</span> attempted to{' '}
          <span className="font-semibold text-white">{entry.action}</span>
        </p>
        <p className={`text-sm font-semibold mt-1 ${dm.color}`}>{dm.headline}</p>
      </div>

      {/* Intent */}
      {entry.monitorResult?.intent && (
        <div className="bg-gray-800/60 rounded-lg p-3 text-sm">
          <span className="text-gray-500 block text-xs mb-1 uppercase tracking-wide">Detected Intent</span>
          <p className="text-gray-200">{entry.monitorResult.intent}</p>
        </div>
      )}

      {/* Impact */}
      <div className="bg-gray-800/60 rounded-lg p-3 text-sm">
        <span className="text-gray-500 block text-xs mb-1 uppercase tracking-wide">Potential Impact</span>
        <p className="text-gray-200">{impactFromViolations(violations)}</p>
      </div>

      {/* Risk gauge (simplified — no factor details) */}
      <RiskScoreCard
        riskScore={riskScore}
        severity={severity}
        finalAction={entry.severityResult?.finalAction || entry.decision}
        reasoning={entry.reasoning}
        triggeredRules={entry.severityResult?.triggeredRules}
      />

      {/* Recommended actions */}
      {suggestions.length > 0 && (
        <div className="bg-gray-800/60 rounded-lg p-3">
          <span className="text-gray-500 block text-xs mb-2 uppercase tracking-wide">Recommended Actions</span>
          <ul className="space-y-1.5">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${
                    s.priority === 'HIGH' ? 'bg-red-500' :
                    s.priority === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                />
                <div>
                  <span className="text-gray-200 font-medium">{s.action}</span>
                  <p className="text-gray-400 text-xs">{s.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-xs text-gray-500 text-right">
        Processed: {new Date(entry.timestamp).toLocaleString()}
      </p>
    </div>
  );
}
