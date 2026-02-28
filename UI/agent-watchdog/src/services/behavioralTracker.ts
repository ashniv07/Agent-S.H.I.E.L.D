import { db } from '../db/index.js';

const SMOOTHING = 0.15;   // EMA smoothing factor
const MAX_TRACKED = 20;   // Max tracked actions/targets per agent
const MIN_HISTORY = 3;    // Minimum requests before anomaly detection kicks in

export function getAnomalyScore(agentId: string, action: string, target: string): number {
  const baseline = db.getAgentBaseline(agentId);
  if (!baseline || baseline.totalRequests < MIN_HISTORY) return 0;

  let score = 0;

  // Factor 1: Unusual action for this agent (+15)
  const actionNorm = action.toLowerCase().trim();
  const knownActions = baseline.typicalActions.map((a) => a.toLowerCase().trim());
  if (!knownActions.includes(actionNorm)) {
    score += 15;
  }

  // Factor 2: Unusual target for this agent (+15)
  const targetNorm = target.toLowerCase().trim();
  const knownTargets = baseline.typicalTargets.map((t) => t.toLowerCase().trim());
  const targetMatches = knownTargets.some(
    (t) => targetNorm.includes(t) || t.includes(targetNorm)
  );
  if (!targetMatches) {
    score += 15;
  }

  // Factor 3: Frequency spike — more than 2× requests vs baseline avg (+10)
  const recentCount = db.getRequestCountInLastHour(agentId);
  if (baseline.avgRequestsPerHour > 0 && recentCount > baseline.avgRequestsPerHour * 2) {
    score += 10;
  }

  // Factor 4: High historical risk — agent has a pattern of risky requests (+10)
  if (baseline.totalRequests >= 5 && baseline.avgRiskScore > 65) {
    score += 10;
  }

  return Math.min(50, score);
}

export function updateBaseline(
  agentId: string,
  action: string,
  target: string,
  riskScore: number
): void {
  const existing = db.getAgentBaseline(agentId);

  if (!existing) {
    db.upsertAgentBaseline({
      agentId,
      typicalActions: [action],
      typicalTargets: [target],
      avgRequestsPerHour: 1,
      avgRiskScore: riskScore,
      totalRequests: 1,
    });
    return;
  }

  // Update typical actions (keep up to MAX_TRACKED unique entries)
  const actions = [...existing.typicalActions];
  if (!actions.map((a) => a.toLowerCase()).includes(action.toLowerCase())) {
    actions.push(action);
    if (actions.length > MAX_TRACKED) actions.shift();
  }

  // Update typical targets (keep up to MAX_TRACKED unique entries)
  const targets = [...existing.typicalTargets];
  if (!targets.map((t) => t.toLowerCase()).includes(target.toLowerCase())) {
    targets.push(target);
    if (targets.length > MAX_TRACKED) targets.shift();
  }

  // EMA for risk score
  const newAvgRisk = existing.avgRiskScore * (1 - SMOOTHING) + riskScore * SMOOTHING;

  // EMA for requests per hour
  const recentCount = db.getRequestCountInLastHour(agentId);
  const newAvgRPH = existing.avgRequestsPerHour * (1 - SMOOTHING) + recentCount * SMOOTHING;

  db.upsertAgentBaseline({
    agentId,
    typicalActions: actions,
    typicalTargets: targets,
    avgRequestsPerHour: newAvgRPH,
    avgRiskScore: newAvgRisk,
    totalRequests: existing.totalRequests + 1,
  });
}
