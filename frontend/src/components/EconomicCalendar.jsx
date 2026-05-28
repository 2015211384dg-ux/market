import { useApi } from '../hooks/useApi';
import { fmtDateStr } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorState } from './ErrorState';

function fmtKRW(value) {
  if (!value || isNaN(value)) return null;
  const jo  = 1e12;
  const eok = 1e8;
  if (Math.abs(value) >= jo) {
    const joVal = Math.floor(value / jo);
    const rem   = Math.round((value % jo) / eok);
    return rem > 0 ? `${joVal}조 ${rem}억` : `${joVal}조`;
  }
  if (Math.abs(value) >= eok) {
    return `${Math.round(value / eok)}억`;
  }
  return `${Math.round(value / 10000).toLocaleString()}만`;
}

const IMPACT_CONFIG = {
  high:   { cls: 'text-brand-red',    dot: 'bg-brand-red',    label: 'High' },
  medium: { cls: 'text-brand-yellow', dot: 'bg-brand-yellow', label: 'Med' },
  low:    { cls: 'text-gray-500',     dot: 'bg-gray-600',     label: 'Low' },
};

function getImpact(event) {
  const impact = event.impact?.toLowerCase() || '';
  if (impact.includes('high') || impact === '3') return IMPACT_CONFIG.high;
  if (impact.includes('medium') || impact === '2') return IMPACT_CONFIG.medium;
  return IMPACT_CONFIG.low;
}

export function EconomicCalendar({ refreshKey, market = 'us' }) {
  const apiUrl = market === 'kr' ? '/api/kr-market/calendar' : '/api/insights/calendar';
  const { data, loading, error, refetch } = useApi(apiUrl, { deps: [refreshKey, market] });

  const economic = data?.economic || [];
  const earnings = data?.earnings || [];

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="card-header">
        <span className="card-title">경제 캘린더</span>
        <span className="text-xs text-gray-600">향후 7일</span>
      </div>

      {loading && (
        <div className="p-4">
          <LoadingSpinner text="캘린더 불러오는 중..." />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {data && (
        <div className="flex-1 overflow-y-auto">
          {/* Economic Events */}
          {economic.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-surface-raised border-b border-surface-border">
                <span className="text-xs font-semibold text-gray-400">경제 지표 일정</span>
              </div>
              <div className="divide-y divide-surface-border">
                {economic.map((evt, i) => {
                  const impact = getImpact(evt);
                  return (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${impact.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-200 truncate">{evt.event || evt.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-600">
                            {evt.time ? `${evt.date} ${evt.time}` : fmtDateStr(evt.date)}
                          </span>
                          {evt.country && (
                            <span className="text-xs text-gray-600">{evt.country}</span>
                          )}
                          {evt.estimate && (
                            <span className="text-xs text-gray-500">Est: {evt.estimate}</span>
                          )}
                        </div>
                        {evt.previous && (
                          <span className="text-xs text-gray-600">Prev: {evt.previous}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Earnings */}
          {earnings.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-surface-raised border-b border-surface-border mt-1">
                <span className="text-xs font-semibold text-gray-400">실적 발표 일정</span>
              </div>
              <div className="divide-y divide-surface-border">
                {earnings.slice(0, 12).map((e, i) => {
                  const displayName = market === 'kr'
                    ? (e.name || e.symbol)
                    : e.symbol;
                  const subName = market === 'kr' ? null : (e.name || null);
                  const revFmt = market === 'kr'
                    ? fmtKRW(e.revenueEstimate)
                    : (e.revenueEstimate ? `${Number(e.revenueEstimate / 1e9).toFixed(2)}B` : null);
                  return (
                    <div key={i} className="px-4 py-2 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-gray-200">
                          {displayName}
                        </span>
                        {subName && (
                          <span className="text-xs text-gray-600 ml-2">{subName}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">{fmtDateStr(e.date)}</div>
                        {e.hour && (
                          <div className="text-xs text-gray-700">
                            {e.hour === 'bmo' ? '장전 발표' : e.hour === 'amc' ? '장후 발표' : e.hour}
                          </div>
                        )}
                        {revFmt && (
                          <div className="text-xs text-gray-600">
                            매출 예상: {revFmt}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {economic.length === 0 && earnings.length === 0 && (
            <div className="p-4 text-xs text-gray-600 text-center">
              향후 7일간 예정된 이벤트가 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
