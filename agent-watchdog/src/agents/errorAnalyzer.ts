
import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../config/index.js';
import { checkPolicyViolations } from '../policies/rules.js';
import type { WatchdogStateType } from './state.js';

const llm = new ChatAnthropic({
  apiKey: config.anthropicApiKey,
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
});

export async function errorAnalyzerAgent(
  state: WatchdogStateType
): Promise<Partial<WatchdogStateType>> {
  const { request, monitorResult } = state;

  // First, run rule-based policy checks
  const contentToCheck = `${request.action} ${request.target} ${request.context || ''} ${JSON.stringify(request.metadata || {})}`;
  const ruleViolations = checkPolicyViolations(contentToCheck);

  // Format rule violations for the LLM
  const ruleViolationSummary = ruleViolations.map((v) => ({
    ruleId: v.rule.id,
    ruleName: v.rule.name,
    category: v.rule.category,
    severity: v.rule.severity,
    matches: v.matches,
  }));

  const systemPrompt = `You are the Error Analyzer Agent in a security pipeline.
Your role is to detect policy violations and security breaches.

You have access to:
1. The original request
2. Worker Monitor analysis results
3. Rule-based policy violation results

Your task:
1. Analyze all violations detected by rules
2. Identify any additional violations the rules might have missed
3. Detect PII exposure risks
4. Identify unauthorized access attempts
5. Flag policy breaches

For each violation, provide:
- Type of violation
- Detailed description
- Evidence supporting the violation

Respond in JSON format:
{
  "violations": [
    {
      "type": "violation type",
      "description": "detailed description",
      "evidence": "specific evidence from the request"
    }
  ],
  "policyBreaches": ["list of specific policies breached"],
  "additionalConcerns": ["any other security concerns"]
}`;

  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Analyze for violations:

ORIGINAL REQUEST:
Agent ID: ${request.agentId}
Action: ${request.action}
Target: ${request.target}
Context: ${request.context || 'No context provided'}

WORKER MONITOR ANALYSIS:
Intent: ${monitorResult?.intent || 'Not analyzed'}
Data Access Patterns: ${JSON.stringify(monitorResult?.dataAccessPatterns || [])}
Risk Indicators: ${JSON.stringify(monitorResult?.riskIndicators || [])}

RULE-BASED VIOLATIONS DETECTED:
${JSON.stringify(ruleViolationSummary, null, 2)}

Provide comprehensive violation analysis.`,
    },
  ]);

  let parsed: {
    violations: Array<{
      type: string;
      description: string;
      evidence: string;
    }>;
    policyBreaches: string[];
    additionalConcerns?: string[];
  };

  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      violations: [],
      policyBreaches: [],
    };
  } catch {
    parsed = {
      violations: [],
      policyBreaches: [],
    };
  }

  // Add rule-based violations to the LLM-detected ones
  for (const rv of ruleViolations) {
    const exists = parsed.violations.some(
      (v) => v.type.toLowerCase().includes(rv.rule.category)
    );
    if (!exists) {
      parsed.violations.push({
        type: rv.rule.name,
        description: rv.rule.description,
        evidence: `Matched patterns: ${rv.matches.join(', ')}`,
      });
    }
  }

  return {
    analysisResult: {
      violations: parsed.violations,
      policyBreaches: [
        ...parsed.policyBreaches,
        ...(parsed.additionalConcerns || []),
      ],
    },
    processingPath: ['errorAnalyzer'],
  };
}
