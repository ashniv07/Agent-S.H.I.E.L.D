import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../config/index.js';
import type { WatchdogStateType } from './state.js';

const llm = new ChatAnthropic({
  apiKey: config.anthropicApiKey,
  model: 'claude-sonnet-4-20250514',
  temperature: 0.3, // Slightly higher for creative suggestions
});

export async function fixProposerAgent(
  state: WatchdogStateType
): Promise<Partial<WatchdogStateType>> {
  const { request, monitorResult, analysisResult, severityResult } = state;

  const systemPrompt = `You are the Fix Proposer Agent in a security pipeline.
Your role is to suggest mitigations and fixes for detected violations.

For each violation or concern, propose:
1. Immediate mitigations
2. Sanitization strategies
3. Alternative approaches
4. Permission changes needed

Your suggestions should be:
- Actionable and specific
- Prioritized by urgency
- Consider the agent's legitimate needs

Also provide a sanitized version of the request if possible - one that achieves
the agent's apparent goal without the security risks.

Respond in JSON format:
{
  "suggestions": [
    {
      "action": "specific action to take",
      "description": "detailed description of the fix",
      "priority": "HIGH|MEDIUM|LOW",
      "appliesTo": "which violation this addresses"
    }
  ],
  "sanitizedRequest": {
    "agentId": "same as original",
    "action": "sanitized action",
    "target": "sanitized target",
    "context": "updated context if needed"
  },
  "canBeSanitized": true/false,
  "sanitizationNotes": "explanation of changes made"
}`;

  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Propose fixes for this request:

ORIGINAL REQUEST:
Agent ID: ${request.agentId}
Action: ${request.action}
Target: ${request.target}
Context: ${request.context || 'No context provided'}

DETECTED INTENT:
${monitorResult?.intent || 'Unknown'}

VIOLATIONS:
${JSON.stringify(analysisResult?.violations || [], null, 2)}

POLICY BREACHES:
${JSON.stringify(analysisResult?.policyBreaches || [])}

SEVERITY:
Level: ${severityResult?.overallSeverity || 'Unknown'}
Score: ${severityResult?.riskScore || 'Unknown'}
Reasoning: ${severityResult?.reasoning || 'Unknown'}

Provide actionable fix suggestions.`,
    },
  ]);

  let parsed: {
    suggestions: Array<{
      action: string;
      description: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      appliesTo?: string;
    }>;
    sanitizedRequest?: {
      agentId: string;
      action: string;
      target: string;
      context?: string;
    };
    canBeSanitized?: boolean;
    sanitizationNotes?: string;
  };

  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      suggestions: [
        {
          action: 'Manual review required',
          description: 'Unable to generate automated suggestions',
          priority: 'HIGH',
        },
      ],
    };
  } catch {
    parsed = {
      suggestions: [
        {
          action: 'Manual review required',
          description: 'Parse error in fix generation',
          priority: 'HIGH',
        },
      ],
    };
  }

  // Validate priorities
  const validPriorities = ['HIGH', 'MEDIUM', 'LOW'];
  parsed.suggestions = parsed.suggestions.map((s) => ({
    ...s,
    priority: validPriorities.includes(s.priority) ? s.priority : 'MEDIUM',
  }));

  // Sort by priority
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  parsed.suggestions.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return {
    fixResult: {
      suggestions: parsed.suggestions,
      sanitizedRequest: parsed.sanitizedRequest
        ? {
            id: request.id,
            agentId: parsed.sanitizedRequest.agentId,
            action: parsed.sanitizedRequest.action,
            target: parsed.sanitizedRequest.target,
            context: parsed.sanitizedRequest.context,
          }
        : undefined,
    },
    processingPath: ['fixProposer'],
  };
}
