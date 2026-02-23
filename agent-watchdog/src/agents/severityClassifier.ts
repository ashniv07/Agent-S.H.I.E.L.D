import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../config/index.js';
import type { SeverityLevel } from '../types/index.js';
import type { WatchdogStateType } from './state.js';
import type { RiskFactor } from './state.js';

const llm = new ChatAnthropic({
  apiKey: config.anthropicApiKey,
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
});

export async function severityClassifierAgent(
  state: WatchdogStateType
): Promise<Partial<WatchdogStateType>> {
  const { request, monitorResult, analysisResult, behavioralAnomalyScore } = state;

  const systemPrompt = `You are the Severity Classifier Agent in a security pipeline.
Your role is to assess the overall risk level of a request based on all gathered information.

Severity Levels:
- LOW: Minor policy deviations, low risk, can be auto-approved with logging
- MEDIUM: Notable concerns that warrant review but aren't immediately dangerous
- HIGH: Significant security risks that require human review before proceeding
- CRITICAL: Immediate threat that should be blocked automatically

Risk Score (0-100):
- 0-30: LOW severity
- 31-60: MEDIUM severity
- 61-85: HIGH severity
- 86-100: CRITICAL severity

You MUST output a structured risk assessment with weighted factors. Each factor contributes to the total risk score.

Risk Factors to evaluate (weights must sum to 100):
1. "Dangerous Command" (weight 30): Direct execution of system commands, shell injection, code eval
2. "Sensitive Data Access" (weight 25): PII, credentials, secrets, private keys, system files
3. "Behavioral Anomaly" (weight 20): Deviation from agent's normal behavior pattern
4. "Policy Violation Severity" (weight 15): Number and severity of policy rule matches
5. "Data Exfiltration Risk" (weight 10): Potential for data leakage or unauthorized transfer

For each factor: set triggered=true if evidence exists, provide the evidence string, and set weight contribution proportionally.

Respond ONLY in JSON format:
{
  "overallSeverity": "LOW|MEDIUM|HIGH|CRITICAL",
  "riskScore": 0-100,
  "reasoning": "detailed explanation",
  "riskFactors": [
    { "factor": "Dangerous Command", "weight": 30, "triggered": true|false, "evidence": "string or null" },
    { "factor": "Sensitive Data Access", "weight": 25, "triggered": true|false, "evidence": "string or null" },
    { "factor": "Behavioral Anomaly", "weight": 20, "triggered": true|false, "evidence": "string or null" },
    { "factor": "Policy Violation Severity", "weight": 15, "triggered": true|false, "evidence": "string or null" },
    { "factor": "Data Exfiltration Risk", "weight": 10, "triggered": true|false, "evidence": "string or null" }
  ],
  "triggeredRules": ["list of rule IDs that matched, e.g. sys-001, pii-002"],
  "primaryConcerns": ["main factors driving the severity"],
  "mitigatingFactors": ["any factors that lower the risk"]
}`;

  const behaviorContext = behavioralAnomalyScore && behavioralAnomalyScore > 0
    ? `\nBEHAVIORAL ANALYSIS:\nAnomaly Score: ${behavioralAnomalyScore}/50 (${
        behavioralAnomalyScore >= 30 ? 'HIGH deviation' :
        behavioralAnomalyScore >= 15 ? 'MODERATE deviation' : 'MINOR deviation'
      } from agent's normal pattern)\nThis agent is behaving unusually compared to its baseline.`
    : '\nBEHAVIORAL ANALYSIS:\nAnomaly Score: 0/50 (behavior matches normal pattern for this agent)';

  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Classify the severity of this request:

ORIGINAL REQUEST:
Agent ID: ${request.agentId}
Action: ${request.action}
Target: ${request.target}
Context: ${request.context || 'No context provided'}

MONITOR ANALYSIS:
Intent: ${monitorResult?.intent || 'Unknown'}
Risk Indicators: ${JSON.stringify(monitorResult?.riskIndicators || [])}
Data Access Patterns: ${JSON.stringify(monitorResult?.dataAccessPatterns || [])}

VIOLATIONS DETECTED:
${JSON.stringify(analysisResult?.violations || [], null, 2)}

POLICY BREACHES:
${JSON.stringify(analysisResult?.policyBreaches || [])}
${behaviorContext}

Provide severity classification with detailed reasoning and complete riskFactors array.`,
    },
  ]);

  let parsed: {
    overallSeverity: SeverityLevel;
    riskScore: number;
    reasoning: string;
    riskFactors?: RiskFactor[];
    triggeredRules?: string[];
    primaryConcerns?: string[];
    mitigatingFactors?: string[];
  };

  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      overallSeverity: 'HIGH',
      riskScore: 75,
      reasoning: 'Unable to parse classification - defaulting to HIGH',
    };
  } catch {
    parsed = {
      overallSeverity: 'HIGH',
      riskScore: 75,
      reasoning: 'Parse error - defaulting to HIGH severity',
    };
  }

  // Validate severity level
  const validSeverities: SeverityLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validSeverities.includes(parsed.overallSeverity)) {
    parsed.overallSeverity = 'HIGH';
  }

  // Ensure risk score is in valid range
  parsed.riskScore = Math.max(0, Math.min(100, parsed.riskScore));

  // Build comprehensive reasoning
  let fullReasoning = parsed.reasoning;
  if (parsed.primaryConcerns?.length) {
    fullReasoning += ` Primary concerns: ${parsed.primaryConcerns.join(', ')}.`;
  }
  if (parsed.mitigatingFactors?.length) {
    fullReasoning += ` Mitigating factors: ${parsed.mitigatingFactors.join(', ')}.`;
  }

  // Determine final action label
  const score = parsed.riskScore;
  const finalAction =
    score >= 90 || parsed.overallSeverity === 'CRITICAL' ? 'KILL' :
    score >= 70 || parsed.overallSeverity === 'HIGH' ? 'FLAG' :
    score <= 30 && parsed.overallSeverity === 'LOW' ? 'APPROVE' : 'FLAG';

  return {
    severityResult: {
      overallSeverity: parsed.overallSeverity,
      riskScore: parsed.riskScore,
      reasoning: fullReasoning,
      riskFactors: parsed.riskFactors || [],
      triggeredRules: parsed.triggeredRules || [],
      finalAction,
    },
    processingPath: ['severityClassifier'],
  };
}

// Router to decide if we need fix proposals
export function severityRouter(
  state: WatchdogStateType
): 'fixProposer' | 'decision' {
  const { severityResult, analysisResult } = state;

  // If there are violations or severity is not LOW, get fix proposals
  if (
    (analysisResult?.violations?.length ?? 0) > 0 ||
    severityResult?.overallSeverity !== 'LOW'
  ) {
    return 'fixProposer';
  }

  // Low severity with no violations can go straight to decision
  return 'decision';
}
