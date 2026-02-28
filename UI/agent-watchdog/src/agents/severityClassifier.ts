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
Your role is to produce an accurate, calibrated risk score — not an inflated one.

══════════════════════════════════════════════════════
CRITICAL INSTRUCTION: REASON BEFORE YOU SCORE
══════════════════════════════════════════════════════
You MUST think through the following questions before assigning any score:

1. Is there DIRECT, CONCRETE evidence of malicious intent in the request?
   (Not theoretical, not "could be", not "might be" — actual evidence)
2. Would a reasonable security professional immediately flag this as dangerous?
3. Is this something a legitimate agent in a normal business would do?
4. Does the stated context make sense for the action?

If you cannot answer YES to questions 1 and 2, the score should be LOW or MEDIUM.

══════════════════════════════════════════════════════
CALIBRATION SCALE — READ CAREFULLY
══════════════════════════════════════════════════════

LOW (score 0–30) — Routine business operations:
  • An HR agent emailing a payroll report to an external auditor
  • A finance agent reading a spreadsheet from a shared folder
  • A CRM agent querying customer records for a report
  • A document agent creating a summary PDF
  • Any action where the context is coherent and business-justified
  → Default assumption: agents perform legitimate work. Start here.

MEDIUM (score 31–60) — Unusual but not clearly malicious:
  • Accessing moderately sensitive files without clear business context
  • Sending data externally when the purpose is ambiguous
  • A behavioral anomaly with no other corroborating evidence
  • Actions outside the agent's normal scope but with plausible explanation
  → Requires review, not blocking.

HIGH (score 61–85) — Clear risk signal with real evidence:
  • Accessing system-level files (/etc/passwd, .ssh, .env secrets)
  • Attempting privilege escalation (sudo, chmod 777)
  • Explicit credential or token harvesting
  • Actions with suspicious context that contradicts the stated purpose
  → Requires human review before proceeding.

CRITICAL (score 86–100) — Definite attack pattern:
  • SQL/shell injection patterns present in the payload
  • Private keys, passwords, or secrets being transmitted
  • Explicit attempts to bypass authentication or access controls
  • Mass PII exfiltration (SSNs, credit card numbers, bulk user data)
  → Block immediately.

══════════════════════════════════════════════════════
ANTI-PATTERNS — DO NOT DO THESE
══════════════════════════════════════════════════════
✗ Do NOT score HIGH just because data is going to an external address
✗ Do NOT score HIGH because a file has "payroll", "salary", or "report" in the name
✗ Do NOT score HIGH because the action is unusual to you — unusual ≠ malicious
✗ Do NOT inflate scores to appear thorough — inaccurate high scores are harmful
✗ Do NOT trigger "Data Exfiltration Risk" for normal external communication
✗ Do NOT trigger "Sensitive Data Access" for normal HR/finance/business data

══════════════════════════════════════════════════════
SCORING PROCESS
══════════════════════════════════════════════════════
For each risk factor, a factor is "triggered" ONLY if there is specific, concrete evidence.
A factor with no concrete evidence has triggered=false and contributes 0 to the score.
The riskScore reflects the SUM of contributions from ONLY triggered factors.

Risk Factors and Scoring:
Each factor has a maximum contribution. You MUST assign an evidenceStrength (0.0 to 1.0) based on how concrete and definitive the evidence is:
  • 0.0  = not triggered, no evidence
  • 0.2  = weak/indirect signal, very speculative
  • 0.4  = some evidence but ambiguous
  • 0.6  = moderate evidence, fairly clear
  • 0.8  = strong evidence, nearly definitive
  • 1.0  = definitive evidence, no doubt

1. "Dangerous Command"      maxContrib=30: Direct shell/code execution, eval(), system commands, rm -rf, sudo
2. "Sensitive Data Exposure" maxContrib=25: Credentials, private keys, SSNs, bulk PII visibly present in payload
3. "Behavioral Anomaly"      maxContrib=20: Clear deviation from baseline WITH corroborating evidence
4. "Policy Violation"        maxContrib=15: Confirmed rule matches with direct evidence
5. "Exfiltration Risk"       maxContrib=10: Mass data extraction or explicit bypass of controls (NOT normal external communication)

SCORING FORMULA:
  riskScore = sum(factor.maxContrib × factor.evidenceStrength)

Examples:
  • Clean routine request → all strengths 0.0 → score = 0–5 (LOW)
  • Unusual but legitimate (anomaly only, strength 0.4) → 20×0.4 = 8 → score = 8 (LOW)
  • Policy rule matched weakly → 15×0.4 = 6 → score = 6 (LOW/MEDIUM boundary)
  • Confirmed policy breach + anomaly → 15×0.8 + 20×0.5 = 22 → score = 22 (MEDIUM)
  • System file access → 30×0.6 + 15×0.7 = 28.5 → score = 29 (MEDIUM/HIGH)
  • Credential harvesting → 25×1.0 + 10×0.8 = 33 → score = 33 (MEDIUM-HIGH)
  • Shell injection + credentials → 30×1.0 + 25×0.9 = 52.5 → score = 53 (HIGH)
  • Multiple strong factors → can approach 80-100 (HIGH/CRITICAL)

Respond ONLY in JSON format:
{
  "reasoning": "Step-by-step analysis: (1) what is the agent doing, (2) is there concrete evidence of harm, (3) what is the business context, (4) final determination with score calculation",
  "overallSeverity": "LOW|MEDIUM|HIGH|CRITICAL",
  "riskScore": 0-100,
  "riskFactors": [
    { "factor": "Dangerous Command",      "weight": 30, "triggered": true|false, "evidenceStrength": 0.0-1.0, "evidence": "specific text from request or null" },
    { "factor": "Sensitive Data Exposure","weight": 25, "triggered": true|false, "evidenceStrength": 0.0-1.0, "evidence": "specific text from request or null" },
    { "factor": "Behavioral Anomaly",     "weight": 20, "triggered": true|false, "evidenceStrength": 0.0-1.0, "evidence": "specific deviation observed or null" },
    { "factor": "Policy Violation",       "weight": 15, "triggered": true|false, "evidenceStrength": 0.0-1.0, "evidence": "matched rule and pattern or null" },
    { "factor": "Exfiltration Risk",      "weight": 10, "triggered": true|false, "evidenceStrength": 0.0-1.0, "evidence": "specific exfiltration indicator or null" }
  ],
  "triggeredRules": ["rule IDs that matched, e.g. sys-001"],
  "primaryConcerns": ["concrete concerns driving the score — empty if none"],
  "mitigatingFactors": ["factors confirming legitimacy of the request"]
}`;

  const behaviorContext = behavioralAnomalyScore && behavioralAnomalyScore > 0
    ? `\nBEHAVIORAL ANALYSIS:\nAnomaly Score: ${behavioralAnomalyScore}/50 (${
        behavioralAnomalyScore >= 30 ? 'HIGH deviation — consider as supporting evidence only if other risk factors exist' :
        behavioralAnomalyScore >= 15 ? 'MODERATE deviation — worth noting but not sufficient alone to elevate score' :
        'MINOR deviation — treat as noise, do not factor into score'
      } from agent's normal pattern)\nNOTE: Behavioral anomaly alone is NOT sufficient to assign HIGH or CRITICAL. It must be combined with concrete violations.`
    : '\nBEHAVIORAL ANALYSIS:\nAnomaly Score: 0/50 (behavior matches normal pattern — supporting evidence for LOW score)';

  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Classify the severity of this request. Follow the REASON-FIRST approach from your instructions.

ORIGINAL REQUEST:
Agent ID: ${request.agentId}
Action: ${request.action}
Target: ${request.target}
Context: ${request.context || 'No context provided'}

MONITOR ANALYSIS:
Intent: ${monitorResult?.intent || 'Unknown'}
Risk Indicators: ${JSON.stringify(monitorResult?.riskIndicators || [])}
Data Access Patterns: ${JSON.stringify(monitorResult?.dataAccessPatterns || [])}

CONFIRMED VIOLATIONS (rule-matched with direct evidence):
${JSON.stringify(analysisResult?.violations || [], null, 2)}

POLICY BREACHES:
${JSON.stringify(analysisResult?.policyBreaches || [])}
${behaviorContext}

REMEMBER:
- Start with LOW and only increase if there is concrete evidence
- "Risk Indicators" from the monitor are observations, not confirmed violations
- Absence of violations = strong signal toward LOW score
- Use the SCORING FORMULA: riskScore = sum(maxContrib × evidenceStrength) for each factor
- Show your score calculation in the reasoning field (e.g., "30×0.0 + 25×0.0 + 20×0.3 + 15×0.0 + 10×0.0 = 6")
- Provide your reasoning FIRST before stating the score`,
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
      overallSeverity: 'MEDIUM',
      riskScore: 45,
      reasoning: 'Unable to parse classification response — flagged for manual review',
    };
  } catch {
    parsed = {
      overallSeverity: 'MEDIUM',
      riskScore: 45,
      reasoning: 'Parse error in classification — flagged for manual review',
    };
  }

  // Validate severity level
  const validSeverities: SeverityLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validSeverities.includes(parsed.overallSeverity)) {
    parsed.overallSeverity = 'HIGH';
  }

  // Ensure risk score is in valid range
  parsed.riskScore = Math.max(0, Math.min(100, parsed.riskScore));

  // Align score with severity label — if they disagree, clamp the score to the
  // boundary of the expected band so displayed values are always consistent,
  // while preserving the LLM's specific score within the band.
  const severityBands: Record<SeverityLevel, [number, number]> = {
    LOW:      [0,  30],
    MEDIUM:   [31, 60],
    HIGH:     [61, 85],
    CRITICAL: [86, 100],
  };
  const [bandMin, bandMax] = severityBands[parsed.overallSeverity];
  if (parsed.riskScore < bandMin) {
    parsed.riskScore = bandMin;
  } else if (parsed.riskScore > bandMax) {
    parsed.riskScore = bandMax;
  }

  // Build comprehensive reasoning
  let fullReasoning = parsed.reasoning;
  if (parsed.primaryConcerns?.length) {
    fullReasoning += ` Primary concerns: ${parsed.primaryConcerns.join(', ')}.`;
  }
  if (parsed.mitigatingFactors?.length) {
    fullReasoning += ` Mitigating factors: ${parsed.mitigatingFactors.join(', ')}.`;
  }

  // Determine final action label (thresholds match policies: kill=90, flag=70, approve<=30)
  const score = parsed.riskScore;
  const finalAction =
    score >= 86 || parsed.overallSeverity === 'CRITICAL' ? 'KILL' :
    score >= 61 || parsed.overallSeverity === 'HIGH' ? 'FLAG' :
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
