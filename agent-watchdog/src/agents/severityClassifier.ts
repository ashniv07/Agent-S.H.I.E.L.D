import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../config/index.js';
import type { SeverityLevel } from '../types/index.js';
import type { WatchdogStateType } from './state.js';

const llm = new ChatAnthropic({
  apiKey: config.anthropicApiKey,
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
});

export async function severityClassifierAgent(
  state: WatchdogStateType
): Promise<Partial<WatchdogStateType>> {
  const { request, monitorResult, analysisResult } = state;

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

Consider:
1. Number and severity of violations
2. Type of data/systems at risk
3. Intent analysis from worker monitor
4. Potential impact if the request succeeds
5. Historical context of the agent

Respond in JSON format:
{
  "overallSeverity": "LOW|MEDIUM|HIGH|CRITICAL",
  "riskScore": 0-100,
  "reasoning": "detailed explanation of the severity assessment",
  "primaryConcerns": ["main factors driving the severity"],
  "mitigatingFactors": ["any factors that lower the risk"]
}`;

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

Provide severity classification with detailed reasoning.`,
    },
  ]);

  let parsed: {
    overallSeverity: SeverityLevel;
    riskScore: number;
    reasoning: string;
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

  return {
    severityResult: {
      overallSeverity: parsed.overallSeverity,
      riskScore: parsed.riskScore,
      reasoning: fullReasoning,
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
