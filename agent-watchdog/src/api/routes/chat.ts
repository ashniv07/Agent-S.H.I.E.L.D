import { Router, type Request, type Response } from 'express';
import { ChatAnthropic } from '@langchain/anthropic';
import { config } from '../../config/index.js';
import { db } from '../../db/index.js';

const llm = new ChatAnthropic({
  apiKey: config.anthropicApiKey,
  model: 'claude-sonnet-4-20250514',
  temperature: 0.3,
});

export const chatRouter = Router();

chatRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { message, history = [] } = req.body as {
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Gather live system snapshot
    const stats = db.getStats(req.authApiKeyId);
    const recentRequests = db.getRequests(15, 0, req.authApiKeyId);
    const recentViolations = db.getViolations(15, 0, req.authApiKeyId);
    const scopedAgentIds = req.authApiKeyId ? db.getAgentIdsByApiKey(req.authApiKeyId) : null;
    const agents = db
      .getAllAgentPermissions()
      .filter((agent) => !scopedAgentIds || scopedAgentIds.includes(agent.agent_id));
    const recentAuditLogs = db.getAuditLogs(8, 0, req.authApiKeyId);

    // Build a concise live-data context block
    const agentSummary = agents.length
      ? agents.map((a) => `  • "${a.agent_id}": ${a.is_active ? 'ACTIVE' : `BLOCKED — ${a.blocked_reason || 'no reason given'}`}`).join('\n')
      : '  (none registered)';

    const requestSummary = recentRequests.length
      ? recentRequests.map((r) =>
          `  • [${r.decision ?? 'PENDING'}] Agent "${r.agent_id}" → "${r.action}" on "${r.target}" (${r.created_at?.slice(0, 19) ?? 'unknown'})`
        ).join('\n')
      : '  (none)';

    const violationSummary = recentViolations.length
      ? recentViolations.map((v) => {
          const agent = recentRequests.find((r) => r.id === v.request_id)?.agent_id ?? 'unknown';
          return `  • [${v.severity}] ${v.type}: ${v.description} — Agent: "${agent}"`;
        }).join('\n')
      : '  (none)';

    const auditSummary = recentAuditLogs.length
      ? recentAuditLogs.map((l) =>
          `  • [${l.decision}] "${l.agent_id}" — ${l.action} — ${(l.reasoning ?? '').slice(0, 120)}`
        ).join('\n')
      : '  (none)';

    const liveContext = `
=== LIVE SYSTEM SNAPSHOT (${new Date().toLocaleString()}) ===

STATS:
  Total Requests:    ${stats.totalRequests}
  Approved:          ${stats.approvedRequests}
  Flagged:           ${stats.flaggedRequests}
  Killed:            ${stats.killedRequests}
  Total Violations:  ${stats.totalViolations}
  Critical:          ${stats.criticalViolations}
  Active Agents:     ${stats.activeAgents}
  Blocked Agents:    ${stats.blockedAgents}

AGENTS (all ${agents.length}):
${agentSummary}

RECENT REQUESTS (last ${recentRequests.length}):
${requestSummary}

RECENT VIOLATIONS (last ${recentViolations.length}):
${violationSummary}

RECENT AUDIT DECISIONS (last ${recentAuditLogs.length}):
${auditSummary}
=== END OF LIVE DATA ===`;

    const systemPrompt = `You are the intelligent operations assistant for **Agent-Watchdog**, an enterprise AI governance and security monitoring platform.

## What Agent-Watchdog Does
Agent-Watchdog monitors AI agent requests through a multi-agent LangGraph security pipeline:
1. **Orchestrator** — initial risk assessment and routing
2. **Worker Monitor** — intent analysis, behavioral pattern detection
3. **Error Analyzer** — rule-based + LLM policy violation detection (25+ rules across System Access, PII, Data Access, Network, Authorization categories)
4. **Severity Classifier** — weighted risk scoring 0–100, using 5 factors: Dangerous Command (30%), Sensitive Data Access (25%), Behavioral Anomaly (20%), Policy Violation Severity (15%), Data Exfiltration Risk (10%)
5. **Fix Proposer** — remediation and sanitization suggestions
6. **Decision Engine** — final verdict: APPROVE / FLAG / KILL

## Key Concepts
- **Risk Score 0–100**: severity thresholds: LOW (0–30), MEDIUM (31–60), HIGH (61–85), CRITICAL (86–100)
- **Decisions**: APPROVE (auto), FLAG (human review), KILL (blocked + agent kill-switch triggered)
- **Kill Switch**: permanently blocks an agent until manually restored
- **Behavioral Tracking**: exponential moving average baseline per agent; anomaly score 0–50 added to risk
- **Topology Map**: real-time ReactFlow graph — agent nodes (color = violation heat), edges (color = decision)
- **Audit Trail**: two views — Technical (full JSON metadata) and Business (plain-English impact summary)
- **Violations**: each has type, severity, evidence, suggested fix, and links to full pipeline trace

## Your Capabilities
You have access to the live system data below. You can:
- Answer questions about current stats, trends, and risk posture
- Identify which agents are blocked and why
- Explain recent violations and their severity
- Summarize recent decisions and audit reasoning
- Help interpret risk scores and pipeline outputs
- Suggest next steps for flagged or killed requests
- Explain any concept or feature of Agent-Watchdog

Respond clearly and professionally. Use bullet points for lists. Be specific with numbers from the live data.
${liveContext}`;

    // Build multi-turn messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const response = await llm.invoke(messages);

    const reply =
      typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
        ? response.content
            .map((c) => (typeof c === 'object' && 'text' in c ? (c as { text: string }).text : ''))
            .join('')
        : 'Unable to generate a response.';

    return res.json({ reply, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({
      error: 'Chat failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
