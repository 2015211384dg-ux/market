import { useState, lazy, Suspense } from 'react';
import { useApi } from '../hooks/useApi';
import { ErrorState } from './ErrorState';
const IndicatorModal = lazy(() => import('./IndicatorModal').then(m => ({ default: m.IndicatorModal })));
import { LoadingSpinner } from './LoadingSpinner';
import {
  IconInflation, IconBank, IconBonds, IconLabor, IconGrowth,
  IconConsumer, IconHousing, IconOil, IconGlobe, IconSentiment,
} from './Icons';

// ─── 카테고리 탭 정의 ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'inflation',   label: '인플레이션', Icon: IconInflation },
  { id: 'monetary',    label: '통화정책',   Icon: IconBank },
  { id: 'bonds',       label: '금리/채권',  Icon: IconBonds },
  { id: 'labor',       label: '고용',       Icon: IconLabor },
  { id: 'growth',      label: '경기/성장',  Icon: IconGrowth },
  { id: 'consumer',    label: '소비',       Icon: IconConsumer },
  { id: 'housing',     label: '주택',       Icon: IconHousing },
  { id: 'commodities', label: '원자재',     Icon: IconOil },
  { id: 'global',      label: '글로벌',     Icon: IconGlobe },
  { id: 'sentiment',   label: '시장심리',   Icon: IconSentiment },
];

// ─── 신호등 색상 계산 ─────────────────────────────────────────────────────────
function getSignalColor(ind) {
  if (ind.value === null) return { bg: 'bg-gray-800', text: 'text-gray-400', dot: 'bg-gray-600' };
  const v = ind.value;
  if (ind.bearAbove !== undefined && v > ind.bearAbove)
    return { bg: 'bg-red-900/20', text: 'text-red-400', dot: 'bg-red-500' };
  if (ind.bearBelow !== undefined && v < ind.bearBelow)
    return { bg: 'bg-red-900/20', text: 'text-red-400', dot: 'bg-red-500' };
  if (ind.bullAbove !== undefined && v > ind.bullAbove)
    return { bg: 'bg-green-900/20', text: 'text-green-400', dot: 'bg-green-500' };
  if (ind.bullBelow !== undefined && v < ind.bullBelow)
    return { bg: 'bg-green-900/20', text: 'text-green-400', dot: 'bg-green-500' };
  return { bg: 'bg-yellow-900/10', text: 'text-yellow-300', dot: 'bg-yellow-500' };
}

function getChangeArrow(change) {
  if (change === null || change === undefined) return null;
  return change > 0 ? '▲' : change < 0 ? '▼' : '─';
}

function getChangeColor(change, invertLogic = false) {
  if (change === null || change === undefined) return 'text-gray-500';
  const isUp = change > 0;
  if (invertLogic) return isUp ? 'text-red-400' : 'text-green-400';
  return isUp ? 'text-green-400' : 'text-red-400';
}

// 인플레이션 지표는 상승 = 부정적
const INVERT_CATEGORIES = ['inflation'];

// ─── 개별 지표 카드 ───────────────────────────────────────────────────────────
function IndicatorCard({ ind, onClick }) {
  const signal = getSignalColor(ind);
  const invert = INVERT_CATEGORIES.includes(ind.category);
  const changeColor = getChangeColor(ind.change, invert);
  const arrow = getChangeArrow(ind.change);
  const hasValue = ind.value !== null && ind.value !== undefined;

  const formattedValue = () => {
    if (!hasValue) return '—';
    const v = ind.value;
    if (ind.display === '%') return `${v.toFixed(2)}%`;
    if (ind.display === '$T') return `$${v}T`;
    if (ind.display === '$B') return `$${Number(v).toLocaleString()}B`;
    if (ind.display === '$') return `$${v.toFixed(2)}`;
    if (ind.display === 'K') return `${Number(v).toLocaleString()}K`;
    if (ind.display === 'M') return `${v}M`;
    if (ind.display === 'pts') return v.toFixed(1);
    return v.toFixed(2);
  };

  const formattedChange = () => {
    if (ind.change === null || ind.change === undefined) return null;
    const c = Math.abs(ind.change);
    if (ind.display === '%') return `${c.toFixed(2)}%`;
    if (ind.display === 'K') return `${c.toFixed(0)}K`;
    if (ind.display === 'pts') return c.toFixed(1);
    return c.toFixed(2);
  };

  const isClickable = !!ind.id;

  return (
    <div
      className={`rounded-lg border border-surface-border p-3 ${signal.bg} flex flex-col gap-1.5 ${
        isClickable ? 'cursor-pointer hover:border-gray-500 transition-colors group' : ''
      }`}
      onClick={isClickable ? onClick : undefined}
      title={isClickable ? '클릭하여 상세 차트 보기' : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${signal.dot}`} />
          <span className="text-xs text-gray-400 truncate">{ind.nameKo}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {ind.freq && (
            <span className="text-xs text-gray-700">{ind.freq}</span>
          )}
          {isClickable && (
            <svg className="w-3 h-3 text-gray-700 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <span className={`text-base font-mono font-semibold ${signal.text}`}>
          {formattedValue()}
        </span>
        {ind.change !== null && ind.change !== undefined && (
          <span className={`text-xs font-mono ${changeColor} flex items-center gap-0.5`}>
            {arrow} {formattedChange()}
          </span>
        )}
      </div>

      {ind.prevValue !== null && ind.prevValue !== undefined && (
        <div className="text-xs text-gray-600">
          이전: {ind.prevValue.toFixed(2)}{ind.display === '%' ? '%' : ''}
          {ind.date && <span className="ml-1.5 text-gray-700">{ind.date?.slice(0, 7)}</span>}
        </div>
      )}

      {ind.target !== undefined && hasValue && (
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-xs text-gray-600">목표: {ind.target}%</span>
          <div className="flex-1 h-0.5 bg-gray-800 rounded">
            <div
              className={`h-full rounded ${signal.dot}`}
              style={{ width: `${Math.min(100, (ind.value / (ind.target * 3)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {ind.note && !hasValue && (
        <span className="text-xs text-gray-600 italic">{ind.note}</span>
      )}
      {ind.error && !hasValue && (
        <span className="text-xs text-gray-700 italic">{ind.error}</span>
      )}
    </div>
  );
}

// ─── 시장 데이터 카드 (실시간) ────────────────────────────────────────────────
function MarketCard({ item }) {
  const isUp = item.changePct >= 0;
  const changeClass = isUp ? 'text-green-400' : 'text-red-400';
  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{item.nameKo}</span>
        <span className="text-xs text-gray-600">{item.symbol}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-base font-mono font-semibold text-gray-200">
          {item.display === '$' ? `$${item.value?.toFixed(2)}` : item.value?.toFixed(2) ?? '—'}
        </span>
        <span className={`text-xs font-mono ${changeClass}`}>
          {isUp ? '▲' : '▼'} {Math.abs(item.changePct)?.toFixed(2)}%
        </span>
      </div>
      <div className="text-xs text-gray-600">
        이전 종가: {item.prevValue?.toFixed(2)}
      </div>
    </div>
  );
}

// ─── 카테고리 요약 (탭 헤더 옆 미니 신호등) ──────────────────────────────────
function CategoryBadge({ indicators }) {
  if (!indicators || indicators.length === 0) return null;
  const valid = indicators.filter(i => i.value !== null);
  const bearCount = valid.filter(i => {
    const s = getSignalColor(i);
    return s.dot === 'bg-red-500';
  }).length;
  const bullCount = valid.filter(i => {
    const s = getSignalColor(i);
    return s.dot === 'bg-green-500';
  }).length;
  if (bearCount === 0 && bullCount === 0) return null;
  return (
    <div className="flex gap-0.5 ml-1">
      {bullCount > 0 && <span className="text-xs text-green-500">●{bullCount}</span>}
      {bearCount > 0 && <span className="text-xs text-red-500">●{bearCount}</span>}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function MacroDashboard({ refreshKey }) {
  const [activeTab, setActiveTab] = useState('inflation');
  const [selectedInd, setSelectedInd] = useState(null);
  const { data, loading, error, refetch } = useApi('/api/macro-data', { deps: [refreshKey] });

  const getTabData = (tabId) => {
    if (!data) return [];
    const fredData = data.fred?.[tabId] || [];
    const marketData = data.market?.[tabId] || [];
    const manualData = data.manual?.[tabId] || [];
    return { fred: fredData, market: marketData, manual: manualData };
  };

  const allIndicators = data
    ? Object.values(data.fred || {}).flat()
    : [];

  return (
    <>
    {selectedInd && (
      <Suspense fallback={null}>
        <IndicatorModal ind={selectedInd} onClose={() => setSelectedInd(null)} />
      </Suspense>
    )}
    <div className="card flex flex-col">
      {/* 헤더 */}
      <div className="card-header">
        <div>
          <span className="card-title">매크로 경제 지표</span>
          {data && !data.hasFredKey && (
            <span className="ml-2 text-xs text-yellow-500">⚠ FRED API 키 미설정 — 경제지표 없음</span>
          )}
        </div>
        <span className="text-xs text-gray-600">
          {data?.timestamp ? `업데이트: ${new Date(data.timestamp).toLocaleTimeString('ko-KR')}` : ''}
        </span>
      </div>

      {/* 탭 */}
      <div className="flex overflow-x-auto border-b border-surface-border px-4 gap-1 flex-shrink-0">
        {TABS.map(tab => {
          const tabAllInds = data?.fred?.[tab.id] || [];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <CategoryBadge indicators={tabAllInds} />
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="p-4 min-h-[280px]">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size="lg" text="FRED 데이터 불러오는 중..." />
          </div>
        )}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {data && (() => {
          const { fred, market, manual } = getTabData(activeTab);
          const hasAny = fred.length > 0 || market.length > 0 || manual.length > 0;

          if (!hasAny) {
            return (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="empty-state-title">표시할 지표 없음</p>
                <p className="empty-state-desc">FRED API 키를 설정하면 이 카테고리 데이터가 표시됩니다</p>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {/* FRED 지표 */}
              {fred.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {fred.map(ind => <IndicatorCard key={ind.id} ind={ind} onClick={() => setSelectedInd(ind)} />)}
                </div>
              )}

              {/* 시장 실시간 지표 */}
              {market.length > 0 && (
                <>
                  {fred.length > 0 && <div className="border-t border-surface-border pt-2" />}
                  <div className="section-label my-2">실시간 시세</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {market.map(item => <MarketCard key={item.symbol} item={item} />)}
                  </div>
                </>
              )}

              {/* 수동/외부 지표 */}
              {manual.length > 0 && (
                <>
                  {(fred.length > 0 || market.length > 0) && <div className="border-t border-surface-border pt-2" />}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {manual.map(ind => <IndicatorCard key={ind.id} ind={ind} onClick={() => setSelectedInd(ind)} />)}
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* FRED 키 없을 때 안내 */}
      {data && !data.hasFredKey && (
        <div className="px-4 pb-4">
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 text-xs text-yellow-400">
            <b>FRED API 키를 설정하면 경제지표 데이터가 표시됩니다.</b><br />
            발급: https://fred.stlouisfed.org/docs/api/api_key.html (무료, 즉시 발급)<br />
            설정: <code className="bg-black/30 px-1 rounded">backend/.env</code>에 <code className="bg-black/30 px-1 rounded">FRED_API_KEY=키값</code> 추가
          </div>
        </div>
      )}
    </div>
    </>
  );
}
