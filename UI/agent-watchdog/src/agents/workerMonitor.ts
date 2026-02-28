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
Your role is to understand what an agent is trying to do, then identify whether anything about the request is genuinely concerning.

STEP 1 — Establish legitimacy first.
Before looking for risks, ask: "Is this something a legitimate agent in a normal business environment would do?"
Examples of ROUTINE actions that are NOT inherently suspicious:
- Sending an email to an external address (accountants, auditors, clients, partners)
- Attaching a business document (spreadsheets, reports, PDFs) to an email
- Reading or writing files as part of a workflow
- Querying a database for business data
- Accessing calendars, CRM systems, or collaboration tools

STEP 2 — Identify the true intent.
Describe what the agent is clearly trying to accomplish. Be charitable: assume legitimate purpose unless there is concrete evidence otherwise.

STEP 3 — Note data access patterns.
Describe what data is involved and how it is being used. Be factual, not speculative.

STEP 4 — List only GENUINE risk indicators.
A risk indicator must be based on CONCRETE evidence in the request, not theoretical possibilities.
Do NOT flag these as risk indicators:
- The action involves an external email address (this is normal business communication)
- A file contains the word "payroll", "salary", or "report" (these are normal business files)
- Data is being sent outside the system (this is normal for external communications)
- The agent is doing something you haven't seen before (novelty ≠ risk)

DO flag these as risk indicators (only if actually present):
- Explicit credential harvesting (passwords, tokens, private keys in transit)
- Shell injection patterns or system command execution in context/metadata
- Bulk exfiltration of large structured data sets without business justification
- Access to system files (/etc/passwd, .ssh, .env secrets)
- SQL injection or authentication bypass patterns
- Actions whose stated context directly contradicts what the request actually does

Keep riskIndicators empty if nothing concrete is found. An empty list is the correct and honest output for a routine request.

Respond ONLY in JSON format:
{
  "intent": "clear, charitable description of what the agent is trying to do",
  "legitimacyAssessment": "ROUTINE | UNUSUAL | SUSPICIOUS — with one-sentence justification",
  "dataAccessPatterns": ["factual list of what data is involved"],
  "riskIndicators": ["only concrete, evidence-backed concerns — empty array if none"],
  "suspiciousElements": ["only elements with direct evidence of malicious intent"],
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
    legitimacyAssessment?: string;
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
      intent: parsed.legitimacyAssessment
        ? `[${parsed.legitimacyAssessment}] ${parsed.intent}`
        : parsed.intent,
      dataAccessPatterns: parsed.dataAccessPatterns,
      riskIndicators: allRiskIndicators,
    },
    processingPath: ['workerMonitor'],
  };
}
