import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../config/index.js';
import type { WatchdogStateType } from './state.js';

const llm = new ChatAnthropic({
  apiKey: config.anthropicApiKey,
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
});

export async function workerMonitorAgent(
  state: WatchdogStateType
): Promise<Partial<WatchdogStateType>> {
  const { request } = state;

  const systemPrompt = `You are the Worker Monitor Agent in a security pipeline.
Your role is to deeply inspect agent requests and extract:
1. The true intent behind the request
2. Data access patterns (what data is being accessed, how)
3. Risk indicators (anything suspicious or concerning)

Be thorough in your analysis. Look for:
- Hidden intentions in the request context
- Unusual data access patterns
- Potential data exfiltration attempts
- Privilege escalation attempts
- Policy circumvention attempts

Respond in JSON format:
{
  "intent": "detailed description of the apparent intent",
  "dataAccessPatterns": ["list of data access patterns identified"],
  "riskIndicators": ["list of potential risk indicators"],
  "suspiciousElements": ["any suspicious elements found"],
  "confidence": 0.0-1.0
}`;

  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Deeply inspect this agent request:
Agent ID: ${request.agentId}
Action: ${request.action}
Target: ${request.target}
Context: ${request.context || 'No context provided'}
Metadata: ${JSON.stringify(request.metadata || {})}

Provide a thorough security analysis.`,
    },
  ]);

  let parsed: {
    intent: string;
    dataAccessPatterns: string[];
    riskIndicators: string[];
    suspiciousElements?: string[];
    confidence?: number;
  };

  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      intent: 'Unable to determine intent',
      dataAccessPatterns: ['Unknown'],
      riskIndicators: ['Analysis failed - treating as suspicious'],
    };
  } catch {
    parsed = {
      intent: 'Error parsing analysis',
      dataAccessPatterns: ['Unknown'],
      riskIndicators: ['Parse error - treating as suspicious'],
    };
  }

  // Merge suspicious elements into risk indicators
  const allRiskIndicators = [
    ...parsed.riskIndicators,
    ...(parsed.suspiciousElements || []),
  ];

  return {
    monitorResult: {
      intent: parsed.intent,
      dataAccessPatterns: parsed.dataAccessPatterns,
      riskIndicators: allRiskIndicators,
    },
    processingPath: ['workerMonitor'],
  };
}
