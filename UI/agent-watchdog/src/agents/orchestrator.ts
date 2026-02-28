import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../config/index.js';
import type { WatchdogStateType } from './state.js';

const llm = new ChatAnthropic({
  apiKey: config.anthropicApiKey,
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
});

export async function orchestratorAgent(
  state: WatchdogStateType
): Promise<Partial<WatchdogStateType>> {
  const { request } = state;

  const systemPrompt = `You are the Orchestrator Agent in a security monitoring pipeline.
Your role is to:
1. Receive incoming agent requests
2. Perform initial assessment
3. Decide the processing path

Analyze the request and determine:
- Whether this is a routine, moderate, or high-risk request
- Which agents need to process this request
- Any immediate red flags

Respond in JSON format:
{
  "initialAssessment": "brief assessment",
  "riskLevel": "routine|moderate|high",
  "requiresFullAnalysis": true/false,
  "immediateFlags": ["list of any immediate concerns"]
}`;

  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Analyze this incoming agent request:
Agent ID: ${request.agentId}
Action: ${request.action}
Target: ${request.target}
Context: ${request.context || 'No context provided'}
Metadata: ${JSON.stringify(request.metadata || {})}`,
    },
  ]);

  let parsed: {
    initialAssessment: string;
    riskLevel: string;
    requiresFullAnalysis: boolean;
    immediateFlags: string[];
  };

  try {
    const content = typeof response.content === 'string' ? response.content : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      initialAssessment: 'Unable to parse response',
      riskLevel: 'high',
      requiresFullAnalysis: true,
      immediateFlags: ['Parse error - treating as high risk'],
    };
  } catch {
    parsed = {
      initialAssessment: 'Error parsing LLM response',
      riskLevel: 'high',
      requiresFullAnalysis: true,
      immediateFlags: ['Parse error - treating as high risk'],
    };
  }

  return {
    processingPath: ['orchestrator'],
    // Store orchestrator analysis in monitor result temporarily
    monitorResult: {
      intent: parsed.initialAssessment,
      dataAccessPatterns: [],
      riskIndicators: parsed.immediateFlags,
    },
  };
}

// Routing function to decide next step
export function orchestratorRouter(
  state: WatchdogStateType
): 'workerMonitor' | 'decision' {
  const { monitorResult } = state;

  // If there are immediate critical flags, we might want to fast-track to decision
  // For now, always go through full pipeline
  if (monitorResult?.riskIndicators && monitorResult.riskIndicators.length > 3) {
    // Many flags - still analyze but note it
  }

  return 'workerMonitor';
}
