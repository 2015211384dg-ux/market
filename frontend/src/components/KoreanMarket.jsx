import { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { useApi } from '../hooks/useApi';
import { fmtPrice, fmtPct, fmtDate, changeClass, rsiColor, intensityColor } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';
import { StockScreener } from './StockScreener';
import { ErrorState } from './ErrorState';
import { FundamentalBadge } from './FundamentalBadge';
import { StockDetailModal } from './StockDetailModal';
import { KisScreener } from './KisScreener';
import { KoreanThemeScreener } from './KoreanThemeScreener';

// ─── 한국 지수 바 ─────────────────────────────────────────────────────────────
export function KoreanIndices({ refreshKey, skip = false }) {
  const { data, loading, error, refetch } = useApi('/api/kr-market/indices', { deps: [refreshKey], skip });

  if (loading) {
    return (
      <div className="border-b border-surface-border bg-surface-card px-6 py-3 flex items-center gap-4">
        <LoadingSpinner text="한국 시장 불러오는 중..." />
      </div>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="border-b border-surface-border bg-surface-card px-4 py-1">
        <ErrorState message={error || '한국 시장 데이터를 불러오지 못했습니다'} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="border-b border-surface-border bg-surface-card">
      <div className="px-4 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {data.map((item, idx) => {
            const cls = changeClass(item.dp);
            const isUp = item.dp > 0;
            const isDown = item.dp < 0;
            return (
              <div
                key={item.symbol}
                className={`px-5 py-3 flex items-center gap-3 ${idx < data.length - 1 ? 'border-r border-surface-border' : ''}`}
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-semibold text-gray-300">{item.name}</span>
                    <span className="text-xs text-gray-700 font-mono">{item.symbol}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs leading-none ${cls}`}>{isUp ? '▲' : isDown ? '▼' : '■'}</span>
                    <span className={`font-mono text-base font-semibold ${cls}`}>{fmtPrice(item.c)}</span>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${cls} ${
                      isUp ? 'bg-brand-green/10' : isDown ? 'bg-brand-red/10' : 'bg-gray-700/50'
                    }`}>{fmtPct(item.dp)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pl-6 ml-4 border-l border-surface-border flex items-center gap-2 py-3">
            <span className="text-xs text-gray-500">한국 시장</span>
            <span className="text-xs text-gray-600">09:00 ~ 15:30 KST</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 한국 섹터 히트맵 ─────────────────────────────────────────────────────────
export function KoreanSectors({ refreshKey, skip = false }) {
  const { data, loading, error, refetch } = useApi('/api/kr-market/sectors', { deps: [refreshKey], skip });

  return (
    <div className="card flex flex-col h-full">
      <div className="card-header">
        <span className="card-title">한국 섹터</span>
        <span className="text-xs text-gray-600">당일 등락률</span>
      </div>
      <div className="p-3 flex-1">
        {loading && <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {data && (
          <div className="grid grid-cols-2 gap-1.5 h-full">
            {data.map(s => (
              <div
                key={s.symbol}
                className="rounded p-2 flex flex-col justify-between cursor-default"
                style={{ backgroundColor: intensityColor(s.dp) }}
                title={`${s.name}: ${fmtPct(s.dp)}`}
              >
                <span className="text-xs text-gray-400 truncate">{s.name}</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-mono text-gray-500">{s.symbol.replace('.KS', '')}</span>
                  <span className={`text-xs font-mono font-semibold ${s.dp >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {fmtPct(s.dp)}
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

// ─── 한국 스크리너 탭 (빠른 검색 + 전체 종목 + 기법 스크리너) ─────────────────
export function KoreanScreener() {
  const [tab, setTab] = useState('quick');

  const TABS = [
    { key: 'quick',  label: '빠른 검색',   sub: '500종목' },
    { key: 'full',   label: '전체 종목',   sub: '매일 00:30 자동' },
    { key: 'method', label: '기법 스크리너', sub: '밥그릇·역매공파·기준봉' },
    { key: 'theme',  label: '테마 스크리너', sub: '광통신·우주·수소·ESS 등' },
  ];

  return (
    <div className="card flex flex-col">
      {/* 탭 헤더 */}
      <div className="flex border-b border-surface-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
            {t.sub && <span className="text-gray-600 font-normal ml-1">{t.sub}</span>}
          </button>
        ))}
      </div>

      {tab === 'quick' && (
        <StockScreener
          onResults={() => {}}
          apiBase="/api/kr-market/screener"
          label=""
          desc="KOSPI/KOSDAQ 시총 상위 500 · ETF 제외 · 실시간 커스터마이징"
          isKorean
          noCard
        />
      )}

      {tab === 'full' && <FullScreenerPanel />}

      {tab === 'method' && (
        <div className="p-4">
          <KisScreener />
        </div>
      )}

      {tab === 'theme' && <KoreanThemeScreener />}
    </div>
  );
}

// ─── 전체 종목 스크리너 패널 ─────────────────────────────────────────────────
function FullScreenerPanel() {
  const { data, loading, error, refetch } = useApi('/api/kr-market/screener-full', { deps: [] });

  if (loading) return <div className="p-6"><LoadingSpinner text="전체 종목 스크리너 결과 불러오는 중..." /></div>;
  if (error)   return <ErrorState message={error} onRetry={refetch} />;

  if (!data || data.notYetRun) {
    return (
      <div className="p-6 text-center">
        <div className="text-sm text-gray-400 mb-2">아직 실행된 결과가 없습니다</div>
        <div className="text-xs text-gray-600">매일 오전 12:30에 자동 실행됩니다</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* 메타 정보 */}
      <div className="px-4 py-2 border-b border-surface-border flex items-center gap-4 text-xs text-gray-500 flex-wrap">
        {data.isLastRun && (
          <span className="text-brand-yellow">⚠ 이전 실행 결과</span>
        )}
        <span>기준일: <b className="text-gray-300">{data.runDate}</b></span>
        <span>실행시각: <b className="text-gray-300">{data.runAt}</b></span>
        <span><b className="text-gray-300">{data.total}</b>개 검색됨</span>
        <span>{data.screened}/{data.universe} 분석</span>
        <span>RSI {data.criteria?.rsiMin}–{data.criteria?.rsiMax}</span>
        <span>등락폭 ≥{data.criteria?.rangeMin}%</span>
      </div>

      {data.results?.length === 0 && (
        <div className="p-6 text-center text-sm text-gray-500">
          조건에 해당하는 종목이 없습니다.
        </div>
      )}

      {data.results?.length > 0 && (
        <div className="overflow-x-auto">
          <FullScreenerTable results={data.results} />
        </div>
      )}
    </div>
  );
}

const FULL_FUND_COLS = [
  { key: 'pbr',             label: 'PBR',       hint: '주가순자산비율 (DART 기준)' },
  { key: 'per',             label: 'PER',       hint: '주가수익비율 (TTM)' },
  { key: 'evEbitda',        label: 'EV/EBITDA', hint: '기업가치/EBITDA' },
  { key: 'roe',             label: 'ROE',       hint: '자기자본이익률' },
  { key: 'roa',             label: 'ROA',       hint: '총자산이익률' },
  { key: 'operatingMargin', label: '영업이익률',  hint: '영업이익/매출' },
  { key: 'netMargin',       label: '순이익률',   hint: '순이익/매출' },
  { key: 'debtToEquity',    label: '부채비율',   hint: '총부채/자본' },
  { key: 'currentRatio',    label: '유동비율',   hint: '유동자산/유동부채' },
  { key: 'revenueGrowth',   label: '매출성장',   hint: '전년 동기 대비 매출 증가율' },
  { key: 'earningsGrowth',  label: '이익성장',   hint: '전년 동기 대비 이익 증가율' },
  { key: 'fcfYield',        label: 'FCF수익률',  hint: '잉여현금흐름/시가총액' },
  { key: 'dividendYield',   label: '배당수익률',  hint: '연간 배당금/주가' },
];

// ─── 재무 Z-Score 가중 합산 ───────────────────────────────────────────────────
const FUND_WEIGHTS = [
  { key: 'roe',             w: 0.20, dir:  1 },
  { key: 'operatingMargin', w: 0.15, dir:  1 },
  { key: 'earningsGrowth',  w: 0.15, dir:  1 },
  { key: 'revenueGrowth',   w: 0.12, dir:  1 },
  { key: 'roa',             w: 0.10, dir:  1 },
  { key: 'fcfYield',        w: 0.08, dir:  1 },
  { key: 'pbr',             w: 0.08, dir: -1 },
  { key: 'currentRatio',    w: 0.05, dir:  1 },
  { key: 'per',             w: 0.04, dir: -1 },
  { key: 'debtToEquity',    w: 0.03, dir: -1 },
];

function computeFundScores(results, fundamentals) {
  const valsByMetric = {};
  for (const { key } of FUND_WEIGHTS) valsByMetric[key] = [];

  for (const s of results) {
    const f = fundamentals[s.symbol];
    if (!f) continue;
    for (const { key } of FUND_WEIGHTS) {
      const v = f[key];
      if (key === 'per' && (v == null || v <= 0)) continue;
      if (v == null || !isFinite(v)) continue;
      valsByMetric[key].push(v);
    }
  }

  const stats = {};
  for (const { key } of FUND_WEIGHTS) {
    const vs = valsByMetric[key];
    if (vs.length < 3) continue;
    const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
    const std  = Math.sqrt(vs.reduce((a, b) => a + (b - mean) ** 2, 0) / vs.length);
    if (std === 0) continue;
    stats[key] = { mean, std };
  }

  const scores = {};
  for (const s of results) {
    const f = fundamentals[s.symbol];
    if (!f) { scores[s.symbol] = null; continue; }
    let sum = 0, totalW = 0;
    for (const { key, w, dir } of FUND_WEIGHTS) {
      const v = f[key];
      if (key === 'per' && (v == null || v <= 0)) continue;
      const st = stats[key];
      if (v == null || !isFinite(v) || !st) continue;
      const z = Math.max(-2.5, Math.min(2.5, (v - st.mean) / st.std));
      sum    += w * dir * z;
      totalW += w;
    }
    scores[s.symbol] = totalW >= 0.3 ? +(sum / totalW).toFixed(3) : null;
  }
  return scores;
}

function FullScreenerTable({ results }) {
  const [sortBy,  setSortBy]  = useState('fundScore');
  const [sortDir, setSortDir] = useState('desc');
  const [fundamentals, setFundamentals] = useState({});
  const [fundLoading,  setFundLoading]  = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(null);

  useEffect(() => {
    if (!results?.length) return;
    setFundLoading(true);
    const symbols = results.map(r => r.symbol);
    const CHUNK = 50;
    const chunks = [];
    for (let i = 0; i < symbols.length; i += CHUNK) chunks.push(symbols.slice(i, i + CHUNK));
    Promise.all(chunks.map(c => axios.post('/api/kr-market/fundamentals', { symbols: c }).then(r => r.data).catch(() => ({}))))
      .then(parts => setFundamentals(Object.assign({}, ...parts)))
      .finally(() => setFundLoading(false));
  }, [results]);

  const fundScores = useMemo(
    () => Object.keys(fundamentals).length ? computeFundScores(results, fundamentals) : {},
    [results, fundamentals]
  );

  const handleSort = col => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const sorted = useMemo(() => [...results].sort((a, b) => {
    const av = sortBy === 'fundScore' ? (fundScores[a.symbol] ?? -Infinity) : (a[sortBy] ?? -Infinity);
    const bv = sortBy === 'fundScore' ? (fundScores[b.symbol] ?? -Infinity) : (b[sortBy] ?? -Infinity);
    return sortDir === 'asc' ? av - bv : bv - av;
  }), [results, sortBy, sortDir, fundScores]);

  const COLS = [
    { key: 'name',          label: '종목명',      sortable: false },
    { key: 'fundScore',     label: '재무점수',     hint: 'ROE·성장성·수익성·밸류에이션 Z-Score 가중 합산 (높을수록 좋음)' },
    { key: 'currentPrice',  label: '현재가' },
    { key: 'dayChange',     label: '당일 등락' },
    { key: 'rsi',           label: 'RSI(14)' },
    { key: 'rangePct',      label: '60일 등락폭' },
    { key: 'pricePosition', label: '범위 내 위치', hint: '낮을수록 저가 근처 (0%=최저가, 100%=최고가)' },
    { key: 'relVolume',     label: '상대 거래량' },
  ];

  return (
    <>
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-surface-border bg-surface-raised">
          {COLS.map(col => (
            <th key={col.key}
              onClick={() => col.sortable !== false && handleSort(col.key)}
              className={`px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap ${col.sortable !== false ? 'cursor-pointer hover:text-gray-300' : ''}`}
            >
              <span className={col.hint ? 'border-b border-dashed border-gray-600 cursor-help' : ''} title={col.hint || ''}>
                {col.label}{col.hint && <span className="ml-1 text-gray-700">?</span>}
              </span>
              {sortBy === col.key && <span className="ml-1 text-brand-blue">{sortDir === 'asc' ? '↑' : '↓'}</span>}
            </th>
          ))}
          <th className="px-2 py-2 text-center text-gray-600 font-medium text-xs whitespace-nowrap border-l border-surface-border" colSpan={FULL_FUND_COLS.length}>
            재무 지표 {fundLoading && <span className="text-gray-700">(로딩 중…)</span>}
          </th>
        </tr>
        <tr className="border-b border-surface-border bg-surface-raised">
          {COLS.map(col => <th key={col.key} />)}
          {FULL_FUND_COLS.map(col => (
            <th key={col.key} className="px-2 py-1 text-center text-gray-600 font-medium whitespace-nowrap border-l first:border-l-surface-border">
              <span className="border-b border-dashed border-gray-700 cursor-help text-xs" title={col.hint}>{col.label}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map(s => {
          const dpCls = changeClass(s.dayChange);
          const rvCls = s.relVolume > 1.5 ? 'text-brand-yellow' : s.relVolume > 1 ? 'text-gray-300' : 'text-gray-500';
          const fund  = fundamentals[s.symbol] || null;
          const sector = fund?.sector || null;
          const score = fundScores[s.symbol] ?? null;
          return (
            <tr key={s.symbol} className="data-row !cursor-pointer" onClick={() => setSelectedSymbol(s.symbol)}>
              <td className="px-3 py-2.5">
                <div className="font-semibold text-gray-200">{s.name}</div>
                <div className="text-gray-600 font-mono">{s.symbol.replace('.KS','').replace('.KQ','')}</div>
              </td>
              <td className="px-3 py-2.5 text-center">
                {fundLoading && score == null
                  ? <span className="text-gray-700 text-xs">…</span>
                  : score == null
                    ? <span className="text-gray-700 text-xs">—</span>
                    : <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold tabular-nums ${
                        score >= 0.5  ? 'text-emerald-300 bg-emerald-400/15 border-emerald-400/30' :
                        score >= 0    ? 'text-sky-300 bg-sky-400/10 border-sky-400/20' :
                        score >= -0.5 ? 'text-amber-300 bg-amber-400/10 border-amber-400/20' :
                                        'text-red-300 bg-red-400/10 border-red-400/20'
                      }`}>{score >= 0 ? '+' : ''}{score.toFixed(2)}</span>
                }
              </td>
              <td className="px-3 py-2.5 font-mono text-gray-200">
                ₩{Math.round(s.currentPrice).toLocaleString('ko-KR')}
              </td>
              <td className={`px-3 py-2.5 font-mono ${dpCls}`}>{fmtPct(s.dayChange)}</td>
              <td className="px-3 py-2.5">
                <span className={`font-mono font-semibold ${rsiColor(s.rsi)}`}>{s.rsi?.toFixed(1) ?? '—'}</span>
              </td>
              <td className="px-3 py-2.5">
                <span className="font-mono text-brand-yellow">{s.rangePct?.toFixed(1) ?? '—'}%</span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-14 h-1.5 bg-gray-800 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 w-1.5 h-1.5 rounded-full bg-brand-blue"
                      style={{ left: `calc(${Math.min(98, s.pricePosition ?? 0)}% - 3px)` }} />
                  </div>
                  <span className={`text-xs font-mono ${
                    (s.pricePosition ?? 50) <= 25 ? 'text-green-400 font-semibold' :
                    (s.pricePosition ?? 50) <= 50 ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {s.pricePosition ?? '—'}%
                    {(s.pricePosition ?? 50) <= 25 && <span className="ml-0.5 text-green-500">↓저가근처</span>}
                  </span>
                </div>
              </td>
              <td className={`px-3 py-2.5 font-mono ${rvCls}`}>{s.relVolume?.toFixed(2) ?? '—'}x</td>
              {FULL_FUND_COLS.map(col => (
                fundLoading && !fund
                  ? <td key={col.key} className="px-2 py-2.5 text-center text-gray-700 text-xs">…</td>
                  : <FundamentalBadge key={col.key} metricKey={col.key} value={fund?.[col.key] ?? null} sector={sector} />
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>

    {selectedSymbol && (
      <StockDetailModal
        symbol={selectedSymbol}
        isKorean
        onClose={() => setSelectedSymbol(null)}
      />
    )}
    </>
  );
}

// ─── 뉴스 단일 패널 (내부 공용) ──────────────────────────────────────────────
const SENTIMENT_CONFIG = {
  bullish: { cls: 'badge-green',   label: '강세' },
  bearish: { cls: 'badge-red',     label: '약세' },
  neutral: { cls: 'badge-neutral', label: '중립' },
};

function NewsList({ apiUrl, refreshKey, title, subtitle }) {
  const [expanded, setExpanded] = useState(null);
  const { data: news, loading, error, refetch } = useApi(apiUrl, { deps: [refreshKey] });
  const toggle = id => setExpanded(p => p === id ? null : id);

  return (
    <div className="flex flex-col h-full min-w-0 border-r border-surface-border last:border-r-0">
      <div className="px-4 py-2.5 border-b border-surface-border flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-semibold text-gray-300">{title}</span>
        <span className="text-xs text-gray-600">{subtitle}</span>
      </div>
      <div className="overflow-y-auto divide-y divide-surface-border" style={{ maxHeight: '420px' }}>
        {loading && <div className="p-4"><LoadingSpinner /></div>}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {news && news.length === 0 && <div className="p-4 text-xs text-gray-500">뉴스 없음</div>}
        {news && news.map(item => {
          const isOpen = expanded === item.id;
          const s = SENTIMENT_CONFIG[item.sentiment] || SENTIMENT_CONFIG.neutral;
          return (
            <div
              key={item.id}
              className="px-3 py-2.5 hover:bg-surface-raised cursor-pointer transition-colors"
              onClick={() => toggle(item.id)}
            >
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className={s.cls}>{s.label}</span>
                <span className="text-xs text-gray-600 truncate max-w-[100px]">{item.source}</span>
                <span className="text-xs text-gray-700">·</span>
                <span className="text-xs text-gray-600">{fmtDate(item.datetime)}</span>
              </div>
              <p className="text-xs text-gray-200 leading-snug line-clamp-2">{item.headline}</p>
              {isOpen && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-xs text-brand-blue hover:underline mt-1 inline-block"
                >
                  전체 기사 보기 →
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 한국 뉴스 이중 패널 (한국어 + 영어) ────────────────────────────────────
export function KoreanNewsDouble({ refreshKey }) {
  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="card-header flex-shrink-0">
        <span className="card-title">한국 시장 뉴스</span>
      </div>
      <div className="flex-1 overflow-hidden grid grid-cols-2 min-h-0">
        <NewsList
          apiUrl="/api/kr-market/news"
          refreshKey={refreshKey}
          title="국내 뉴스"
          subtitle="네이버·다음·연합 등"
        />
        <NewsList
          apiUrl="/api/kr-market/news/en"
          refreshKey={refreshKey}
          title="글로벌 뉴스"
          subtitle="Bloomberg·Reuters 등"
        />
      </div>
    </div>
  );
}
