import { StateGraph, END } from '@langchain/langgraph';
import { WatchdogState, type WatchdogStateType } from './state.js';
import { orchestratorAgent, orchestratorRouter } from './orchestrator.js';
import { workerMonitorAgent } from './workerMonitor.js';
import { errorAnalyzerAgent } from './errorAnalyzer.js';
import { severityClassifierAgent, severityRouter } from './severityClassifier.js';
import { fixProposerAgent } from './fixProposer.js';
import { decisionEngine } from './decisionEngine.js';

// Build the LangGraph workflow
function createWatchdogGraph() {
  const workflow = new StateGraph(WatchdogState)
    // Add all agent nodes
    .addNode('orchestrator', orchestratorAgent)
    .addNode('workerMonitor', workerMonitorAgent)
    .addNode('errorAnalyzer', errorAnalyzerAgent)
    .addNode('severityClassifier', severityClassifierAgent)
    .addNode('fixProposer', fixProposerAgent)
    .addNode('decisionMaker', decisionEngine)

    // Define edges
    // Entry point
    .addEdge('__start__', 'orchestrator')

    // Orchestrator routes to worker monitor or directly to decision
    .addConditionalEdges('orchestrator', orchestratorRouter, {
      workerMonitor: 'workerMonitor',
      decision: 'decisionMaker',
    })

    // Worker monitor always goes to error analyzer
    .addEdge('workerMonitor', 'errorAnalyzer')

    // Error analyzer goes to severity classifier
    .addEdge('errorAnalyzer', 'severityClassifier')

    // Severity classifier conditionally routes to fix proposer or decision
    .addConditionalEdges('severityClassifier', severityRouter, {
      fixProposer: 'fixProposer',
      decision: 'decisionMaker',
    })

    // Fix proposer always goes to decision
    .addEdge('fixProposer', 'decisionMaker')

    // Decision is the end
    .addEdge('decisionMaker', END);

  return workflow.compile();
}

// Export compiled graph
export const watchdogGraph = createWatchdogGraph();

// Helper function to run the pipeline
export async function analyzeRequest(
  request: WatchdogStateType['request']
): Promise<WatchdogStateType> {
  const initialState: Partial<WatchdogStateType> = {
    request,
    processingPath: [],
  };

  const result = await watchdogGraph.invoke(initialState);
  return result as WatchdogStateType;
}
