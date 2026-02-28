import { useMemo } from 'react';

export interface RiskFactor {
  factor: string;
  weight: number;
  triggered: boolean;
  evidence: string | null;
}

interface RiskScoreCardProps {
  riskScore: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors?: RiskFactor[];
  triggeredRules?: string[];
  finalAction?: string;
  reasoning?: string;
}

const severityConfig = {
  LOW:      { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',  border: '#22d3ee', label: 'LOW' },
  MEDIUM:   { color: '#facc15', bg: 'rgba(250,204,21,0.1)',  border: '#facc15', label: 'MEDIUM' },
  HIGH:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: '#f97316', label: 'HIGH' },
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: '#ef4444', label: 'CRITICAL' },
};

const actionConfig: Record<string, { bg: string; text: string; label: string }> = {
  APPROVE:      { bg: 'bg-green-700',  text: 'text-white', label: 'APPROVED' },
  FLAG:         { bg: 'bg-yellow-600', text: 'text-white', label: 'FLAGGED' },
  KILL:         { bg: 'bg-red-700',    text: 'text-white', label: 'KILL SWITCH' },
  BLOCK:        { bg: 'bg-red-700',    text: 'text-white', label: 'BLOCKED' },
};

function ArcGauge({ score, color }: { score: number; color: string }) {
  // SVG arc gauge: 240 degree sweep
  const R = 54;
  const cx = 64;
  const cy = 70;
  const startAngle = -210; // degrees
  const totalAngle = 240;
  const angle = startAngle + (score / 100) * totalAngle;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const startX = cx + R * Math.cos(toRad(startAngle));
  const startY = cy + R * Math.sin(toRad(startAngle));
  const endX = cx + R * Math.cos(toRad(angle));
  const endY = cy + R * Math.sin(toRad(angle));
  const largeArc = (score / 100) * totalAngle > 180 ? 1 : 0;

  const trackEndAngle = startAngle + totalAngle;
  const trackEndX = cx + R * Math.cos(toRad(trackEndAngle));
  const trackEndY = cy + R * Math.sin(toRad(trackEndAngle));

  return (
    <svg width="128" height="100" viewBox="0 0 128 100">
      {/* Track */}
      <path
        d={`M ${startX} ${startY} A ${R} ${R} 0 1 1 ${trackEndX} ${trackEndY}`}
        fill="none"
        stroke="#374151"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Score arc */}
      {score > 0 && (
        <path
          d={`M ${startX} ${startY} A ${R} ${R} 0 ${largeArc} 1 ${endX} ${endY}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      )}
      {/* Score text */}
      <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
        {score}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fill="#9ca3af" fontSize="10">
        / 100
      </text>
    </svg>
  );
}

export function RiskScoreCard({
  riskScore,
  severity,
  riskFactors = [],
  triggeredRules = [],
  finalAction,
  reasoning,
}: RiskScoreCardProps) {
  const cfg = severityConfig[severity] || severityConfig.HIGH;
  const action = finalAction?.toUpperCase() || 'FLAG';
  const actionCfg = actionConfig[action] || actionConfig.FLAG;

  const triggeredFactors = useMemo(() => riskFactors.filter((f) => f.triggered), [riskFactors]);
  const untriggeredFactors = useMemo(() => riskFactors.filter((f) => !f.triggered), [riskFactors]);

  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <div className="flex items-start gap-4">
        {/* Gauge */}
        <div className="flex-shrink-0">
          <ArcGauge score={riskScore} color={cfg.color} />
          <div className="text-center -mt-1">
            <span
              className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white"
              style={{ background: cfg.color }}
            >
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-200">Risk Assessment</h4>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${actionCfg.bg} ${actionCfg.text}`}>
              {actionCfg.label}
            </span>
          </div>

          {/* Risk factors */}
          {riskFactors.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {triggeredFactors.map((f) => (
                <div key={f.factor}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-orange-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                      {f.factor}
                    </span>
                    <span className="text-gray-400">{f.weight}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${f.weight}%`, background: cfg.color }}
                    />
                  </div>
                  {f.evidence && (
                    <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">{f.evidence}</p>
                  )}
                </div>
              ))}
              {untriggeredFactors.map((f) => (
                <div key={f.factor}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-gray-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" />
                      {f.factor}
                    </span>
                    <span className="text-gray-600">{f.weight}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gray-700" style={{ width: `${f.weight}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Triggered rules */}
          {triggeredRules.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {triggeredRules.map((rule) => (
                <span
                  key={rule}
                  className="px-1.5 py-0.5 bg-red-900/50 border border-red-700 rounded text-xs font-mono text-red-400"
                >
                  {rule}
                </span>
              ))}
            </div>
          )}

          {/* Reasoning */}
          {reasoning && (
            <p className="text-xs text-gray-400 line-clamp-2">{reasoning}</p>
          )}
        </div>
      </div>
    </div>
  );
}
