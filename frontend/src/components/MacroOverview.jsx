import { useApi } from '../hooks/useApi';
import { fmtPrice, fmtPct, changeClass } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorState } from './ErrorState';

const ITEMS = [
  { key: 'gold',     label: '금',          icon: '◈', prefix: '$' },
  { key: 'oil',      label: '원유 (WTI)',  icon: '⬡',  prefix: '$' },
  { key: 'dxy',      label: '달러 인덱스', icon: '$', prefix: '' },
  { key: 'copper',   label: '구리',        icon: '◆', prefix: '$' },
  { key: 'tlt',      label: '미국채 20년', icon: '⌗', prefix: '' },
  { key: 'twoYear',  label: '미국채 2년',  icon: '⌗', prefix: '' },
];

function YieldSpread({ macro }) {
  const y20 = macro?.tlt?.c;
  const y2  = macro?.twoYear?.c;
  if (y20 == null || y2 == null) return null;
  const spread = (y20 - y2).toFixed(2);
  const isInverted = spread < 0;

  return (
    <div className="mt-3 pt-3 border-t border-surface-border">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">20Y–2Y 스프레드</span>
        <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${
          isInverted
            ? 'text-brand-red bg-brand-red/10'
            : 'text-brand-green bg-brand-green/10'
        }`}>
          {spread >= 0 ? '+' : ''}{spread}%p {isInverted ? '⚠ 역전' : '정상'}
        </span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        20년: {y20?.toFixed(2)}% · 2년: {y2?.toFixed(2)}%
      </div>
    </div>
  );
}

function VixGauge({ vix }) {
  if (!vix) return null;
  const val = vix.c || 0;
  const pct = Math.min(100, (val / 60) * 100);
  const color = val < 15 ? '#3fb950' : val < 25 ? '#d29922' : val < 35 ? '#f85149' : '#ff4444';
  const label = val < 15 ? '안정' : val < 20 ? '보통' : val < 30 ? '경계' : val < 40 ? '공포' : '패닉';

  return (
    <div className="mt-3 pt-3 border-t border-surface-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-400">공포지수 (VIX)</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs" style={{ color }}>{val.toFixed(2)}</span>
          <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{
            color,
            backgroundColor: color + '1a',
          }}>{label}</span>
        </div>
      </div>
      <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-700 mt-1">
        <span>0</span>
        <span>15</span>
        <span>30</span>
        <span>45</span>
        <span>60+</span>
      </div>
    </div>
  );
}

export function MacroOverview({ refreshKey }) {
  const { data: macro, loading, error, refetch } = useApi('/api/market/macro', { deps: [refreshKey] });

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="card-header">
        <span className="card-title">매크로 & 위험 지표</span>
      </div>
      <div className="p-3 flex-1 overflow-y-auto">
        {loading && <LoadingSpinner text="매크로 데이터 불러오는 중..." />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {macro && (
          <>
            <div className="divide-y divide-surface-border">
              {ITEMS.map(({ key, label, icon, prefix }) => {
                const item = macro[key];
                if (!item) return null;
                const cls = changeClass(item.dp);
                const isUp = item.dp > 0;
                const isDown = item.dp < 0;
                const changeVal = item.isYield
                  ? `${item.d >= 0 ? '+' : ''}${item.d?.toFixed(3)}%p`
                  : fmtPct(item.dp);

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2 px-1 rounded hover:bg-surface-raised transition-colors cursor-default"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-4 text-center">{icon}</span>
                      <span className="text-xs text-gray-400">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-200">
                        {item.isYield
                          ? `${item.c?.toFixed(2)}%`
                          : `${prefix}${fmtPrice(item.c)}`}
                      </span>
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${cls} ${
                        isUp ? 'bg-brand-green/10' : isDown ? 'bg-brand-red/10' : 'bg-gray-700/50'
                      }`}>
                        {isUp ? '▲' : isDown ? '▼' : '─'} {changeVal}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <VixGauge vix={macro.vix} />
            <YieldSpread macro={macro} />
          </>
        )}
      </div>
    </div>
  );
}
