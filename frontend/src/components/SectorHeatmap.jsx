import { useApi } from '../hooks/useApi';
import { fmtPct, intensityColor } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorState } from './ErrorState';

function textColor(pct) {
  if (pct == null) return 'text-gray-400';
  return pct > 0 ? 'text-green-300' : pct < 0 ? 'text-red-300' : 'text-gray-400';
}

export function SectorHeatmap({ refreshKey }) {
  const { data: sectors, loading, error, refetch } = useApi('/api/market/sectors', { deps: [refreshKey] });

  return (
    <div className="card flex flex-col h-full">
      <div className="card-header">
        <span className="card-title">섹터 성과</span>
        <span className="text-xs text-gray-600">당일 등락률</span>
      </div>
      <div className="p-3 flex-1">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <LoadingSpinner text="섹터 데이터 불러오는 중..." />
          </div>
        )}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {sectors && (
          <div className="grid grid-cols-2 gap-1.5 h-full">
            {sectors.map(s => (
              <div
                key={s.symbol}
                className="rounded p-2.5 flex flex-col justify-between cursor-default transition-opacity hover:opacity-90"
                style={{ backgroundColor: intensityColor(s.dp) }}
                title={`${s.name}: ${s.symbol} — ${fmtPct(s.dp)}`}
              >
                <span className="text-xs text-gray-200 truncate font-medium">{s.name}</span>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs font-mono text-gray-500">{s.symbol}</span>
                  <span className={`text-xs font-mono font-semibold ${textColor(s.dp)}`}>
                    {s.dp > 0 ? '▲' : s.dp < 0 ? '▼' : '─'} {fmtPct(s.dp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
