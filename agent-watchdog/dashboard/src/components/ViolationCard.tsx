interface Violation {
  id: string;
  type: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence?: string;
  suggestedFix?: string;
  detectedAt: string;
}

interface ViolationCardProps {
  violation: Violation;
}

const severityColors = {
  LOW: 'bg-green-900/50 border-green-500 text-green-400',
  MEDIUM: 'bg-yellow-900/50 border-yellow-500 text-yellow-400',
  HIGH: 'bg-orange-900/50 border-orange-500 text-orange-400',
  CRITICAL: 'bg-red-900/50 border-red-500 text-red-400',
};

const severityBadgeColors = {
  LOW: 'bg-green-600',
  MEDIUM: 'bg-yellow-600',
  HIGH: 'bg-orange-600',
  CRITICAL: 'bg-red-600',
};

export function ViolationCard({ violation }: ViolationCardProps) {
  return (
    <div
      className={`border-l-4 rounded-lg p-4 ${severityColors[violation.severity]} animate-slide-in`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 text-xs font-bold rounded ${severityBadgeColors[violation.severity]} text-white`}
          >
            {violation.severity}
          </span>
          <span className="font-semibold text-gray-100">{violation.type}</span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(violation.detectedAt).toLocaleTimeString()}
        </span>
      </div>

      <p className="text-sm text-gray-300 mb-2">{violation.description}</p>

      {violation.evidence && (
        <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs font-mono text-gray-400">
          <span className="text-gray-500">Evidence: </span>
          {violation.evidence}
        </div>
      )}

      {violation.suggestedFix && (
        <div className="mt-2 p-2 bg-blue-900/30 rounded text-xs">
          <span className="text-blue-400 font-semibold">Suggested Fix: </span>
          <span className="text-gray-300">{violation.suggestedFix}</span>
        </div>
      )}
    </div>
  );
}
