import { policies } from '../policies/index.js';
import type { Decision } from '../types/index.js';
import type { WatchdogStateType } from './state.js';

export async function decisionEngine(
  state: WatchdogStateType
): Promise<Partial<WatchdogStateType>> {
  const { severityResult, analysisResult } = state;

  const riskScore = severityResult?.riskScore ?? 50;
  const severity = severityResult?.overallSeverity ?? 'MEDIUM';
  const violationCount = analysisResult?.violations?.length ?? 0;

  let decision: Decision;
  let reasoning: string;

  // Decision logic based on thresholds and severity
  if (
    riskScore >= policies.killThreshold ||
    severity === 'CRITICAL'
  ) {
    decision = 'KILL';
    reasoning = buildReasoning('KILL', {
      riskScore,
      severity,
      violationCount,
      severityReasoning: severityResult?.reasoning,
    });
  } else if (
    riskScore >= policies.flagThreshold ||
    severity === 'HIGH' ||
    violationCount >= 1
  ) {
    decision = 'FLAG';
    reasoning = buildReasoning('FLAG', {
      riskScore,
      severity,
      violationCount,
      severityReasoning: severityResult?.reasoning,
    });
  } else if (riskScore <= policies.autoApprovalThreshold && severity === 'LOW') {
    decision = 'APPROVE';
    reasoning = buildReasoning('APPROVE', {
      riskScore,
      severity,
      violationCount,
      severityReasoning: severityResult?.reasoning,
    });
  } else {
    // Default to FLAG for uncertain cases
    decision = 'FLAG';
    reasoning = buildReasoning('FLAG', {
      riskScore,
      severity,
      violationCount,
      severityReasoning: severityResult?.reasoning,
      note: 'Defaulting to FLAG for borderline case',
    });
  }

  return {
    decision,
    decisionReasoning: reasoning,
    processingPath: ['decisionEngine'],
  };
}

function buildReasoning(
  decision: Decision,
  params: {
    riskScore: number;
    severity: string;
    violationCount: number;
    severityReasoning?: string;
    note?: string;
  }
): string {
  const parts: string[] = [];

  parts.push(`Decision: ${decision}`);
  parts.push(`Risk Score: ${params.riskScore}/100`);
  parts.push(`Severity Level: ${params.severity}`);
  parts.push(`Violations Detected: ${params.violationCount}`);

  if (params.severityReasoning) {
    parts.push(`Analysis: ${params.severityReasoning}`);
  }

  if (params.note) {
    parts.push(`Note: ${params.note}`);
  }

  switch (decision) {
    case 'KILL':
      parts.push(
        'Action: Request blocked immediately. Kill switch triggered if needed.'
      );
      break;
    case 'FLAG':
      parts.push(
        'Action: Request flagged for human review. Execution paused pending approval.'
      );
      break;
    case 'APPROVE':
      parts.push(
        'Action: Request approved. Proceeding with monitoring enabled.'
      );
      break;
  }

  return parts.join(' | ');
}
