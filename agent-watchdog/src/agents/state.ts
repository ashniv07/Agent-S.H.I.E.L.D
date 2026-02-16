import { Annotation } from '@langchain/langgraph';
import type { AgentRequest, Decision, SeverityLevel } from '../types/index.js';

// Define the state annotation for LangGraph
export const WatchdogState = Annotation.Root({
  // Input request
  request: Annotation<AgentRequest>({
    reducer: (_, y) => y,
  }),

  // Worker Monitor results
  monitorResult: Annotation<{
    intent: string;
    dataAccessPatterns: string[];
    riskIndicators: string[];
  } | undefined>({
    reducer: (_, y) => y,
  }),

  // Error Analyzer results
  analysisResult: Annotation<{
    violations: Array<{
      type: string;
      description: string;
      evidence: string;
    }>;
    policyBreaches: string[];
  } | undefined>({
    reducer: (_, y) => y,
  }),

  // Severity Classifier results
  severityResult: Annotation<{
    overallSeverity: SeverityLevel;
    riskScore: number;
    reasoning: string;
  } | undefined>({
    reducer: (_, y) => y,
  }),

  // Fix Proposer results
  fixResult: Annotation<{
    suggestions: Array<{
      action: string;
      description: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
    }>;
    sanitizedRequest?: AgentRequest;
  } | undefined>({
    reducer: (_, y) => y,
  }),

  // Final decision
  decision: Annotation<Decision | undefined>({
    reducer: (_, y) => y,
  }),

  decisionReasoning: Annotation<string | undefined>({
    reducer: (_, y) => y,
  }),

  // Track which agents processed this request
  processingPath: Annotation<string[]>({
    reducer: (x, y) => [...(x || []), ...y],
    default: () => [],
  }),

  // Error tracking
  error: Annotation<string | undefined>({
    reducer: (_, y) => y,
  }),
});

export type WatchdogStateType = typeof WatchdogState.State;
