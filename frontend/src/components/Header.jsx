import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

export function Header({ onRefreshAll, refreshing, lastRefresh }) {
  const [time, setTime] = useState(new Date());
  const { data: status } = useApi('/api/market/status');

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isOpen = status?.isOpen;

  // KST = UTC+9
  const kstTime = new Date(time.getTime() + 9 * 3600 * 1000);
  const kstStr = kstTime.toISOString().slice(11, 19);

  // ET: UTC-4 (EDT) or UTC-5 (EST) — approximate based on DST
  const etOffsetHours = isDST(time) ? -4 : -5;
  const etTime = new Date(time.getTime() + etOffsetHours * 3600 * 1000);
  const etStr = etTime.toISOString().slice(11, 19);

  const dateStr = time.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  });

  return (
    <header className="border-b border-surface-border bg-surface-card px-6 py-0 flex items-center justify-between sticky top-0 z-50" style={{ minHeight: '52px' }}>
      {/* Left: Logo + market status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-brand-blue" />
          </div>
          <span className="text-sm font-bold tracking-tight text-gray-100">Market Overview</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
          style={{
            backgroundColor: isOpen ? 'rgba(35,134,54,0.12)' : 'rgba(255,255,255,0.04)',
            borderColor: isOpen ? 'rgba(35,134,54,0.3)' : 'rgba(255,255,255,0.08)',
          }}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-brand-green animate-pulse' : 'bg-gray-600'}`} />
          <span className={`text-xs font-medium ${isOpen ? 'text-brand-green' : 'text-gray-500'}`}>
            {isOpen ? 'LIVE' : '마감'}
          </span>
        </div>
      </div>

      {/* Right: Dual clock + refresh */}
      <div className="flex items-center gap-5">
        {/* Dual time display */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-2 text-right">
            <div className="text-right">
              <div className="text-xs text-gray-600 uppercase tracking-widest leading-none mb-0.5">KST</div>
              <div className="font-mono text-sm text-gray-300 leading-none">{kstStr}</div>
            </div>
            <div className="w-px h-6 bg-surface-border" />
            <div className="text-right">
              <div className="text-xs text-gray-600 uppercase tracking-widest leading-none mb-0.5">ET</div>
              <div className="font-mono text-sm text-gray-300 leading-none">{etStr}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="text-xs text-gray-600">{dateStr}</div>
            {lastRefresh && (
              <div className="text-xs text-gray-700">
                업데이트: {lastRefresh.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onRefreshAll}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-raised hover:bg-surface-border rounded border border-surface-border transition-colors disabled:opacity-50"
        >
          <RefreshIcon spinning={refreshing} />
          {refreshing ? '새로고침 중...' : '새로고침'}
        </button>
      </div>
    </header>
  );
}

// Approximate US DST: second Sunday of March → first Sunday of November
function isDST(date) {
  const year = date.getFullYear();
  const dstStart = nthSunday(year, 2, 2); // March (month=2), 2nd Sunday
  const dstEnd   = nthSunday(year, 10, 1); // November (month=10), 1st Sunday
  return date >= dstStart && date < dstEnd;
}

function nthSunday(year, month, n) {
  const d = new Date(year, month, 1);
  // Find first Sunday
  d.setDate(1 + ((7 - d.getDay()) % 7));
  // Advance by (n-1) weeks
  d.setDate(d.getDate() + (n - 1) * 7);
  return d;
}

function RefreshIcon({ spinning }) {
  return (
    <svg
      className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
