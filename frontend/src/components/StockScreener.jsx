import { useState, useCallback } from 'react';
import axios from 'axios';
import { fmtPrice, fmtPct, changeClass, rsiColor, rsiBarColor } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';
import { FundamentalBadge } from './FundamentalBadge';
import { StockDetailModal } from './StockDetailModal';

const DEFAULT_PARAMS = { rsiMin: 20, rsiMax: 40, rangeMin: 50 };
const PROGRESS_STEPS = [
  '종목 데이터 수집 중...',
  '과거 데이터 불러오는 중...',
  'RSI & 가격 범위 계산 중...',
  '거의 완료됐습니다...',
];

export function StockScreener({
  onResults,
  apiBase = '/api/screener',
  label = '종목 스크리너',
  desc = '60일 등락폭 ≥50% · 설정된 RSI 범위 · 평균회귀 후보 종목',
  isKorean = false,
  noCard = false,
}) {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [sortBy, setSortBy] = useState('rangePct');
  const [sortDir, setSortDir] = useState('desc');
  const [fundamentals, setFundamentals] = useState({});
  const [fundLoading, setFundLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress(PROGRESS_STEPS[0]);

    try {
      const qs = new URLSearchParams({
        rsiMin: params.rsiMin,
        rsiMax: params.rsiMax,
        rangeMin: params.rangeMin,
        limit: 30,
      });

      let stepIdx = 0;
      const timer = setInterval(() => {
        stepIdx = (stepIdx + 1) % PROGRESS_STEPS.length;
        setProgress(PROGRESS_STEPS[stepIdx]);
      }, 5000);

      const res = await axios.get(`${apiBase}?${qs}`, { timeout: 120000 });
      clearInterval(timer);

      setData(res.data);
      setProgress(null);
      if (onResults) onResults(res.data.results);

      // 한국 종목이면 재무 데이터 후처리 로드
      if (isKorean && res.data.results?.length > 0) {
        setFundLoading(true);
        const symbols = res.data.results.map(r => r.symbol);
        axios.post('/api/kr-market/fundamentals', { symbols })
          .then(r => setFundamentals(r.data))
          .catch(() => {})
          .finally(() => setFundLoading(false));
      }
    } catch (err) {
      setError(err?.response?.data?.error || '스크리닝 실패. API 키를 확인하고 다시 시도해 주세요.');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, [params, onResults]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const sorted = data?.results
    ? [...data.results].sort((a, b) => {
        const av = a[sortBy] ?? -Infinity;
        const bv = b[sortBy] ?? -Infinity;
        return sortDir === 'asc' ? av - bv : bv - av;
      })
    : [];

  return (
    <div className={noCard ? 'flex flex-col' : 'card flex flex-col'}>
      <div className="card-header">
        <div>
          <span className="card-title">{label}</span>
          <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <FilterInput
            label="RSI 최소"
            value={params.rsiMin}
            onChange={v => setParams(p => ({ ...p, rsiMin: v }))}
            min={0} max={100}
          />
          <FilterInput
            label="RSI 최대"
            value={params.rsiMax}
            onChange={v => setParams(p => ({ ...p, rsiMax: v }))}
            min={0} max={100}
          />
          <FilterInput
            label="등락폭 ≥"
            value={params.rangeMin}
            onChange={v => setParams(p => ({ ...p, rangeMin: v }))}
            min={0} max={500}
            suffix="%"
          />

          <button
            onClick={run}
            disabled={loading}
            className="btn-primary whitespace-nowrap"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border border-brand-blue border-t-transparent rounded-full animate-spin" />
                실행 중...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                스크리닝 실행
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status */}
      {loading && (
        <div className="px-4 py-3 border-b border-surface-border flex items-center gap-3">
          <LoadingSpinner />
          <span className="text-xs text-gray-500">{progress}</span>
          <span className="text-xs text-gray-600">
            (80여 개 종목을 분석하며 약 30~60초 소요됩니다)
          </span>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 text-xs text-brand-red bg-brand-red/5 border-b border-surface-border">
          {error}
        </div>
      )}

      {data && !loading && (
        <div className="px-4 py-2 border-b border-surface-border flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          <span><b className="text-gray-300">{data.results.length}</b>개 종목 검색됨</span>
          <span>{data.screened}/{data.universe} 종목 분석</span>
          <span>RSI {data.criteria.rsiMin}–{data.criteria.rsiMax}</span>
          <span>등락폭 ≥{data.criteria.rangeMin}%</span>
          <span className="text-gray-700">
            업데이트: {new Date(data.timestamp).toLocaleTimeString('ko-KR')}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        {!data && !loading && !error && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
            </div>
            <p className="empty-state-title">스크리닝 준비 완료</p>
            <p className="empty-state-desc">필터를 조정하고 <b className="text-gray-400">스크리닝 실행</b>을 클릭하세요</p>
          </div>
        )}

        {sorted.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-surface-raised">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    className={`px-3 py-2 text-left text-gray-500 font-medium ${col.sortable !== false ? 'cursor-pointer hover:text-gray-300' : ''} whitespace-nowrap`}
                  >
                    <span className={col.hint ? 'border-b border-dashed border-gray-600 cursor-help' : ''} title={col.hint || ''}>
                      {col.key === 'symbol' && isKorean ? '종목명' : col.label}
                      {col.hint && <span className="ml-1 text-gray-700">?</span>}
                    </span>
                    {sortBy === col.key && (
                      <span className="ml-1 text-brand-blue">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
                {isKorean && FUND_COLUMNS.map(col => (
                  <th key={col.key} className="px-2 py-2 text-center text-gray-500 font-medium whitespace-nowrap">
                    <span className="border-b border-dashed border-gray-600 cursor-help" title={col.hint}>
                      {col.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(stock => (
                <ScreenerRow
                  key={stock.symbol}
                  stock={stock}
                  isKorean={isKorean}
                  fund={fundamentals[stock.symbol]}
                  fundLoading={fundLoading}
                  onSelect={setSelectedSymbol}
                />
              ))}
            </tbody>
          </table>
        )}

        {data && sorted.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="empty-state-title">조건에 맞는 종목 없음</p>
            <p className="empty-state-desc">RSI 범위나 등락폭 기준을 조정해 보세요</p>
          </div>
        )}
      </div>

      {selectedSymbol && (
        <StockDetailModal
          symbol={selectedSymbol}
          isKorean={isKorean}
          onClose={() => setSelectedSymbol(null)}
        />
      )}
    </div>
  );
}

const COLUMNS = [
  { key: 'symbol',        label: '종목코드',       sortable: false },
  { key: 'currentPrice',  label: '현재가' },
  { key: 'dayChange',     label: '당일 등락' },
  { key: 'rsi',           label: 'RSI(14)' },
  { key: 'rangePct',      label: '60일 등락폭' },
  { key: 'pricePosition', label: '범위 내 위치', hint: '낮을수록 저가 근처 (0%=최저가, 100%=최고가)' },
  { key: 'high60',        label: '60일 고가' },
  { key: 'low60',         label: '60일 저가' },
  { key: 'relVolume',     label: '상대 거래량' },
];

const FUND_COLUMNS = [
  { key: 'pbr',             label: 'PBR',      hint: '주가순자산비율 (DART 기준) — 클릭하여 업종 평균 확인' },
  { key: 'per',             label: 'PER',      hint: '주가수익비율 (TTM) — 클릭하여 업종 평균 확인' },
  { key: 'evEbitda',        label: 'EV/EBITDA',hint: '기업가치/EBITDA — 클릭하여 업종 평균 확인' },
  { key: 'roe',             label: 'ROE',      hint: '자기자본이익률 — 클릭하여 업종 평균 확인' },
  { key: 'roa',             label: 'ROA',      hint: '총자산이익률 — 클릭하여 업종 평균 확인' },
  { key: 'operatingMargin', label: '영업이익률', hint: '영업이익/매출 — 클릭하여 업종 평균 확인' },
  { key: 'netMargin',       label: '순이익률',  hint: '순이익/매출 — 클릭하여 업종 평균 확인' },
  { key: 'debtToEquity',    label: '부채비율',  hint: '총부채/자본 — 클릭하여 업종 평균 확인' },
  { key: 'currentRatio',    label: '유동비율',  hint: '유동자산/유동부채 — 클릭하여 업종 평균 확인' },
  { key: 'revenueGrowth',   label: '매출성장',  hint: '전년 동기 대비 매출 증가율 — 클릭하여 업종 평균 확인' },
  { key: 'earningsGrowth',  label: '이익성장',  hint: '전년 동기 대비 이익 증가율 — 클릭하여 업종 평균 확인' },
  { key: 'fcfYield',        label: 'FCF수익률', hint: '잉여현금흐름/시가총액 — 클릭하여 업종 평균 확인' },
  { key: 'dividendYield',   label: '배당수익률', hint: '연간 배당금/주가 — 클릭하여 업종 평균 확인' },
];

function fmtKRWPrice(val) {
  if (val == null || isNaN(val)) return '—';
  return '₩' + Math.round(val).toLocaleString('ko-KR');
}

function ScreenerRow({ stock, isKorean = false, fund = null, fundLoading = false, onSelect }) {
  const dpCls = changeClass(stock.dayChange);
  const relVolClass = stock.relVolume > 1.5 ? 'text-brand-yellow' : stock.relVolume > 1 ? 'text-gray-300' : 'text-gray-500';
  const priceFmt = isKorean ? fmtKRWPrice : (v) => `$${fmtPrice(v)}`;
  const sector = fund?.sector || null;

  return (
    <tr
      className="data-row !cursor-pointer"
      onClick={() => onSelect(stock.symbol)}
      title="클릭하면 차트·기업 정보를 볼 수 있습니다"
    >
      {/* Symbol / Name */}
      <td className="px-3 py-2.5">
        {isKorean ? (
          <div>
            <span className="font-semibold text-gray-200">{stock.name || stock.symbol}</span>
            <span className="block text-gray-600 font-mono text-xs">{stock.symbol}</span>
          </div>
        ) : (
          <div>
            <span className="font-mono font-semibold text-gray-200">{stock.symbol}</span>
            {stock.name && stock.name !== stock.symbol && (
              <span className="block text-gray-600 text-xs truncate max-w-[120px]">{stock.name}</span>
            )}
          </div>
        )}
      </td>

      {/* Price */}
      <td className="px-3 py-2.5 font-mono text-gray-200">{priceFmt(stock.currentPrice)}</td>

      {/* 1D Change */}
      <td className={`px-3 py-2.5 font-mono ${dpCls}`}>{fmtPct(stock.dayChange)}</td>

      {/* RSI */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`font-mono font-semibold ${rsiColor(stock.rsi)}`}>
            {stock.rsi?.toFixed(1) ?? '—'}
          </span>
          <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${rsiBarColor(stock.rsi)}`}
              style={{ width: `${stock.rsi ?? 0}%` }}
            />
          </div>
        </div>
      </td>

      {/* 60D Range */}
      <td className="px-3 py-2.5">
        <span className="font-mono text-brand-yellow">{stock.rangePct?.toFixed(1) ?? '—'}%</span>
      </td>

      {/* Price Position in Range */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-14 h-1.5 bg-gray-800 rounded-full overflow-hidden relative">
            <div
              className="absolute top-0 w-1.5 h-1.5 rounded-full bg-brand-blue"
              style={{ left: `calc(${Math.min(98, stock.pricePosition ?? 0)}% - 3px)` }}
            />
          </div>
          <span className={`text-xs font-mono ${
            (stock.pricePosition ?? 50) <= 25 ? 'text-green-400 font-semibold' :
            (stock.pricePosition ?? 50) <= 50 ? 'text-gray-300' :
            'text-gray-600'
          }`}>
            {stock.pricePosition ?? '—'}%
            {(stock.pricePosition ?? 50) <= 25 && <span className="ml-0.5 text-green-500">↓저가근처</span>}
          </span>
        </div>
      </td>

      {/* 60D High / Low */}
      <td className="px-3 py-2.5 font-mono text-gray-400">{priceFmt(stock.high60)}</td>
      <td className="px-3 py-2.5 font-mono text-gray-400">{priceFmt(stock.low60)}</td>

      {/* Relative Volume */}
      <td className={`px-3 py-2.5 font-mono ${relVolClass}`}>
        {stock.relVolume?.toFixed(2) ?? '—'}x
      </td>

      {/* 재무 지표 (한국 종목만) */}
      {isKorean && FUND_COLUMNS.map(col => (
        fundLoading && !fund
          ? <td key={col.key} className="px-2 py-2.5 text-center text-gray-700 text-xs">…</td>
          : <FundamentalBadge key={col.key} metricKey={col.key} value={fund?.[col.key] ?? null} sector={sector} />
      ))}
    </tr>
  );
}

function FilterInput({ label, value, onChange, min, max, suffix = '' }) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs text-gray-500 whitespace-nowrap">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="w-16 px-2 py-1 text-xs font-mono bg-surface-raised border border-surface-border rounded text-gray-200 focus:outline-none focus:border-brand-blue"
      />
      {suffix && <span className="text-xs text-gray-600">{suffix}</span>}
    </div>
  );
}
