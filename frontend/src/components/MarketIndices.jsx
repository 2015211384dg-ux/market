import { useApi } from '../hooks/useApi';
import { fmtPrice, fmtPct, changeClass } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorState } from './ErrorState';

const VIX_REGIME = (vix) => {
  if (!vix) return null;
  if (vix < 15) return { label: '변동성 낮음', color: 'text-brand-green', bg: 'bg-brand-green/10 border-brand-green/25' };
  if (vix < 20) return { label: '안정적', color: 'text-brand-green', bg: 'bg-brand-green/10 border-brand-green/25' };
  if (vix < 25) return { label: '주의', color: 'text-brand-yellow', bg: 'bg-brand-yellow/10 border-brand-yellow/25' };
  if (vix < 30) return { label: '불안 고조', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/25' };
  if (vix < 40) return { label: '공포 심화', color: 'text-brand-red', bg: 'bg-brand-red/10 border-brand-red/25' };
  return { label: '패닉', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/25' };
};

export function MarketIndices({ refreshKey }) {
  const { data, loading, error, refetch } = useApi('/api/market/indices', { deps: [refreshKey] });

  if (loading) {
    return (
      <div className="border-b border-surface-border bg-surface-card px-6 py-3 flex items-center gap-4">
        <LoadingSpinner text="지수 불러오는 중..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="border-b border-surface-border bg-surface-card px-4 py-2">
        <ErrorState message={error || '지수 데이터를 불러오지 못했습니다'} onRetry={refetch} />
      </div>
    );
  }

  const vixEntry = data.find(d => d.symbol === 'VIX');
  const vixRegime = vixEntry ? VIX_REGIME(vixEntry.c) : null;

  return (
    <div className="border-b border-surface-border bg-surface-card">
      <div className="px-4 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {data.map((item, idx) => (
            <IndexTicker key={item.symbol} item={item} isLast={idx === data.length - 1} />
          ))}

          {vixRegime && (
            <div className="pl-6 ml-4 border-l border-surface-border flex items-center gap-2 py-3">
              <span className="text-xs text-gray-600">VIX 레짐</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${vixRegime.color} ${vixRegime.bg}`}>
                {vixRegime.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IndexTicker({ item, isLast }) {
  const cls = changeClass(item.dp);
  const isVix = item.symbol === 'VIX';
  const effectiveCls = isVix ? changeClass(-item.dp) : cls;
  const isUp = isVix ? item.dp < 0 : item.dp > 0;
  const isDown = isVix ? item.dp > 0 : item.dp < 0;

  return (
    <div className={`px-5 py-3 flex items-center gap-3 ${!isLast ? 'border-r border-surface-border' : ''}`}>
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold text-gray-300">{item.name}</span>
          <span className="text-xs text-gray-700 font-mono">{item.symbol}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Triangle indicator */}
          <span className={`text-xs leading-none ${effectiveCls}`}>
            {isUp ? '▲' : isDown ? '▼' : '■'}
          </span>
          <span className={`font-mono text-base font-semibold ${effectiveCls}`}>
            {fmtPrice(item.c)}
          </span>
          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${effectiveCls} ${
            isUp ? 'bg-brand-green/10' : isDown ? 'bg-brand-red/10' : 'bg-gray-700/50'
          }`}>
            {fmtPct(item.dp)}
          </span>
        </div>
      </div>
    </div>
  );
}
