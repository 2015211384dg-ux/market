import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { LoadingSpinner } from './LoadingSpinner';
import {
  IconSearch, IconArrowUp, IconArrowDown, IconCheck, IconStar,
  IconWarning, IconExternal, IconDot, IconChartBar,
} from './Icons';

/*  ───────────────────────────────────────────────────────────────────────────
 *  StockScorer — 미니멀 모노톤 재설계
 *  - 채도 낮은 색만 (등락/주요 강조만)
 *  - 정보 위계는 폰트 크기·여백·굵기로 표현
 *  - 게이지·아이콘 박스 모두 모노톤 (필요 시에만 색)
 *  ─────────────────────────────────────────────────────────────────────────── */

// ─── 포맷터 ──────────────────────────────────────────────────────────────────
const fmtNum   = v => v == null ? '—' : v.toLocaleString('ko-KR');
const fmtPrice = v => v == null ? '—' : `₩${Math.round(v).toLocaleString('ko-KR')}`;
const fmtPct   = (v, sign = true) => v == null ? '—' : `${sign && v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const fmtCap   = v => {
  if (v == null) return '—';
  if (v >= 10000) return `${(v / 10000).toFixed(1)}조`;
  return `${v.toLocaleString()}억`;
};

// ─── 점수 → 톤다운된 신호 (강한 색 X) ─────────────────────────────────────────
function signalCls(score) {
  if (score == null) return 'text-gray-600';
  if (score >= 70)  return 'text-emerald-400';
  if (score >= 45)  return 'text-gray-200';
  return 'text-rose-400';
}
function signalBarBg(score) {
  if (score == null) return 'bg-gray-800';
  if (score >= 70)  return 'bg-emerald-500/70';
  if (score >= 45)  return 'bg-gray-400';
  return 'bg-rose-500/70';
}
function signalLabel(score) {
  if (score == null) return '—';
  if (score >= 80) return '우수';
  if (score >= 65) return '양호';
  if (score >= 45) return '보통';
  if (score >= 30) return '미흡';
  return '약함';
}

// ─── 빠른 선택 종목 ─────────────────────────────────────────────────────────
const QUICK = [
  { code: '005930', name: '삼성전자' },
  { code: '000660', name: 'SK하이닉스' },
  { code: '373220', name: 'LG에너지솔루션' },
  { code: '207940', name: '삼성바이오로직스' },
  { code: '005380', name: '현대차' },
  { code: '035720', name: '카카오' },
];

// ═════════════════════════════════════════════════════════════════════════════
export function StockScorer() {
  const [query,         setQuery]         = useState('');
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [allStocks,     setAllStocks]     = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [activeIndex,   setActiveIndex]   = useState(-1);
  const [selectedCode,  setSelectedCode]  = useState('');
  const dropdownRef = useRef(null);

  // 전종목 로드 (1회)
  useEffect(() => {
    axios.get('/api/valuation/all-stocks')
      .then(r => r.data?.success && setAllStocks(r.data.stocks))
      .catch(() => {});
  }, []);

  // 필터링
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1 || allStocks.length === 0) {
      setSearchResults([]); setShowDropdown(false); setActiveIndex(-1);
      return;
    }
    const ql = q.toLowerCase();
    const filtered = allStocks
      .filter(s => s.name?.toLowerCase().includes(ql) || s.code?.includes(q))
      .slice(0, 10);
    setSearchResults(filtered);
    setShowDropdown(filtered.length > 0);
    setActiveIndex(-1);
  }, [query, allStocks]);

  // 외부 클릭 닫기
  useEffect(() => {
    const onClick = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selectStock = stock => {
    setQuery(`${stock.name} (${stock.code})`);
    setSelectedCode(stock.code);
    setShowDropdown(false);
    search(stock.code);
  };

  const search = async code => {
    const c = code || selectedCode || query.replace(/[^0-9]/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(c)) {
      setError('종목명 또는 6자리 종목코드를 입력하세요');
      return;
    }
    setLoading(true); setError(null); setData(null); setShowDropdown(false);
    try {
      const res = await axios.get(`/api/stock-score/${c}`, { timeout: 60000 });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || '데이터를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = e => {
    if (showDropdown && searchResults.length > 0) {
      if (e.key === 'ArrowDown')   { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, searchResults.length - 1)); }
      else if (e.key === 'ArrowUp'){ e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter')  { e.preventDefault(); if (activeIndex >= 0) selectStock(searchResults[activeIndex]); else if (searchResults.length === 1) selectStock(searchResults[0]); else search(); }
      else if (e.key === 'Escape') { setShowDropdown(false); }
    } else if (e.key === 'Enter')  { search(); }
  };

  const handleQuery = v => {
    setQuery(v);
    if (selectedCode && !v.includes(selectedCode)) setSelectedCode('');
  };

  const handleQuick = (code, name) => {
    setQuery(`${name} (${code})`); setSelectedCode(code); search(code);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 검색 — 카드 없이 깔끔하게 */}
      <SearchBar
        query={query} onChange={handleQuery} onKeyDown={handleKeyDown}
        onSearch={() => search()} loading={loading}
        selectedCode={selectedCode} dropdownRef={dropdownRef}
        showDropdown={showDropdown} searchResults={searchResults}
        activeIndex={activeIndex} setActiveIndex={setActiveIndex}
        selectStock={selectStock}
      />

      {/* 빠른 선택 */}
      <div className="flex flex-wrap gap-1 items-center -mt-3">
        <span className="text-xs text-gray-700 mr-1">빠른 선택</span>
        {QUICK.map(({ code, name }) => (
          <button key={code} onClick={() => handleQuick(code, name)} disabled={loading}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-200 transition-colors">
            {name}
          </button>
        ))}
      </div>

      {/* 에러 */}
      {error && (
        <div className="px-4 py-3 border-l-2 border-rose-500/50 bg-rose-500/5 text-sm text-rose-300 flex items-center gap-2">
          <IconWarning className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="py-16 flex flex-col items-center gap-3 text-gray-500">
          <LoadingSpinner />
          <p className="text-sm">분석 데이터 수집 중</p>
          <p className="text-xs text-gray-700">KIS · DART · 네이버 병렬 호출</p>
        </div>
      )}

      {/* 결과 */}
      {data && !loading && (
        <>
          <Hero data={data} />
          <CategoryGrid data={data} />

          <Section label="CAN SLIM" weight="30%" score={data.scores.canSlim}>
            <CanSlimList canSlim={data.canSlim} />
          </Section>

          <Section label="Quant 지표" weight="25%" score={data.scores.quant}>
            <MetricList items={data.quant} meta={QUANT_META} />
          </Section>

          <Section label="기술 지표" weight="20%" score={data.scores.tech}>
            <MetricList items={data.tech} meta={TECH_META} />
          </Section>

          <Section label="재무 지표" weight="25%" score={data.scores.fin}>
            <MetricList items={data.fin} meta={FIN_META} />
          </Section>

          {data.consensus && <Consensus consensus={data.consensus} />}
          {data.earningsSurprise?.length > 0 && <EarningsSurprise items={data.earningsSurprise} />}
          {data.peers?.length > 0 && <Peers peers={data.peers} onSelect={(c, n) => handleQuick(c, n)} />}
          {data.disclosures?.length > 0 && <Disclosures items={data.disclosures} />}

          <p className="text-xs text-gray-700 text-center py-4 flex items-center justify-center gap-2">
            <IconWarning className="w-3 h-3" />
            본 점수는 참고용 · 투자 결정은 본인 책임 · {new Date(data.timestamp).toLocaleString('ko-KR')}
          </p>
        </>
      )}

      {/* 빈 상태 */}
      {!data && !loading && !error && (
        <div className="py-24 flex flex-col items-center gap-4 text-gray-700">
          <IconChartBar className="w-12 h-12" />
          <p className="text-sm text-gray-500">종목을 검색하면 점수가 표시됩니다</p>
          <p className="text-xs">CAN SLIM · Quant · 기술 · 재무 항목 종합 분석</p>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SearchBar
// ═════════════════════════════════════════════════════════════════════════════
function SearchBar({ query, onChange, onKeyDown, onSearch, loading, selectedCode,
                     dropdownRef, showDropdown, searchResults, activeIndex, setActiveIndex, selectStock }) {
  return (
    <div className="flex gap-2 relative">
      <div className="relative flex-1" ref={dropdownRef}>
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 z-10" />
        <input
          type="text" value={query}
          onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
          placeholder="종목명 또는 6자리 코드 — 예: 삼성전자 · 005930"
          autoComplete="off"
          className="w-full pl-9 pr-12 py-3 text-sm bg-transparent border-0 border-b border-gray-700
                     text-gray-100 placeholder-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
        />
        {selectedCode && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-mono text-gray-500 border border-gray-700 rounded">
            {selectedCode}
          </span>
        )}

        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-[#1c2128] border border-gray-700 rounded shadow-2xl max-h-80 overflow-y-auto">
            {searchResults.map((s, idx) => (
              <button key={s.code} onClick={() => selectStock(s)} onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full text-left px-3 py-2.5 flex items-center justify-between border-b border-gray-800 last:border-0 transition-colors ${
                        activeIndex === idx ? 'bg-gray-800 text-gray-100' : 'text-gray-400 hover:bg-gray-800/50'
                      }`}>
                <span className="text-sm">{s.name}</span>
                <span className="ml-2 font-mono text-xs text-gray-600">{s.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={onSearch} disabled={loading || !query}
              className="px-6 py-3 text-sm font-medium text-gray-200 border border-gray-700 hover:border-gray-400
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        {loading ? '분석 중' : '분석'}
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Hero — 종목 헤더 + 종합 점수
// ═════════════════════════════════════════════════════════════════════════════
function Hero({ data }) {
  const up = (data.dayChange ?? 0) >= 0;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 py-2 border-b border-gray-800 pb-8">
      {/* 좌: 종목 정보 */}
      <div className="space-y-4">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl font-light text-gray-100 tracking-tight">{data.name}</h1>
            <span className="text-sm font-mono text-gray-600">{data.code}</span>
            {data.market && data.market !== '—' && (
              <span className="text-xs text-gray-600 uppercase tracking-wider">{data.market}</span>
            )}
            {data.sector && data.sector !== '—' && (
              <span className="text-xs text-gray-700">· {data.sector}</span>
            )}
          </div>
        </div>

        <div className="flex items-end gap-4">
          <span className="text-4xl font-mono font-light text-gray-100 tracking-tight">{fmtPrice(data.currentPrice)}</span>
          {data.dayChange != null && (
            <span className={`text-sm font-mono flex items-center gap-1 mb-1 ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
              {up ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />}
              {fmtPct(data.dayChange)}
            </span>
          )}
        </div>

        {/* 보조 메트릭 — 가로 나열 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 pt-2">
          <Stat label="시가총액" value={fmtCap(data.marketCapEok)} />
          <Stat label="외인소진율" value={data.foreignRate != null ? `${data.foreignRate.toFixed(2)}%` : '—'} />
          <Stat label="변동성 ATR" value={data.volatility != null ? `${data.volatility}%` : '—'} />
          <Stat label="52주 범위"
                value={data.high52w && data.low52w
                  ? `${fmtPrice(data.low52w)} – ${fmtPrice(data.high52w)}`.replace(/₩/g, '')
                  : '—'} small />
        </div>
      </div>

      {/* 우: 종합 점수 */}
      <div className="flex flex-col items-center justify-center gap-2 lg:border-l lg:border-gray-800 lg:pl-8 lg:min-w-[200px]">
        <span className="text-xs text-gray-600 uppercase tracking-widest">종합 점수</span>
        <div className="flex items-baseline gap-2">
          <span className={`text-6xl font-light font-mono tracking-tight ${signalCls(data.totalScore)}`}>
            {data.totalScore ?? '—'}
          </span>
          <span className="text-sm text-gray-600">/ 100</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-mono">{data.grade}</span>
          <span className="text-gray-700">·</span>
          <span>{data.phaseLabel}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, small }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-600 uppercase tracking-wider">{label}</span>
      <span className={`font-mono text-gray-300 ${small ? 'text-xs' : 'text-sm'}`}>{value}</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CategoryGrid — 4개 점수
// ═════════════════════════════════════════════════════════════════════════════
function CategoryGrid({ data }) {
  const cats = [
    { key: 'canSlim', label: 'CAN SLIM',  weight: 30, score: data.scores.canSlim },
    { key: 'quant',   label: 'QUANT',     weight: 25, score: data.scores.quant },
    { key: 'tech',    label: '기술',       weight: 20, score: data.scores.tech },
    { key: 'fin',     label: '재무',       weight: 25, score: data.scores.fin },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-800">
      {cats.map(c => (
        <div key={c.key} className="bg-[#0d1117] p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 uppercase tracking-wider">{c.label}</span>
            <span className="text-xs text-gray-700">{c.weight}%</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-light font-mono tracking-tight ${signalCls(c.score)}`}>
              {c.score ?? '—'}
            </span>
            <span className="text-xs text-gray-700">/ 100</span>
          </div>
          {/* 미세한 진행 바 */}
          <div className="h-px bg-gray-800 mt-1 overflow-hidden">
            <div className={`h-full ${signalBarBg(c.score)}`}
                 style={{ width: `${c.score || 0}%` }} />
          </div>
          <span className="text-xs text-gray-600">{signalLabel(c.score)}</span>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Section — 공용 섹션 컨테이너
// ═════════════════════════════════════════════════════════════════════════════
function Section({ label, weight, score, children }) {
  return (
    <section className="py-4">
      <div className="flex items-baseline justify-between border-b border-gray-800 pb-2 mb-4">
        <h2 className="text-xs text-gray-400 uppercase tracking-widest font-medium">{label}</h2>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          {weight && <span>가중 {weight}</span>}
          {score != null && (
            <span className={`font-mono ${signalCls(score)}`}>{score}점</span>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CAN SLIM 리스트 — 알파벳 강조
// ═════════════════════════════════════════════════════════════════════════════
const CAN_SLIM_META = {
  C: { name: 'EPS 가속도',         hint: '분기 EPS YoY +25% 이상' },
  A: { name: '연간 ROE 실적',      hint: 'ROE 17% 이상' },
  N: { name: '신고가 / 피봇 돌파', hint: '52주 고가 12% 이내' },
  S: { name: '거래량 확인 돌파',   hint: '평균 대비 1.5배 이상' },
  L: { name: '주도주 RS 등급',     hint: 'KOSPI 대비 상대강도' },
  I: { name: '기관 수급',          hint: '최근 20일 기관 순매수' },
  M: { name: '시장 방향',          hint: 'KOSPI 추세' },
};

function CanSlimList({ canSlim }) {
  return (
    <div className="divide-y divide-gray-800">
      {Object.entries(canSlim).map(([key, val]) => (
        <div key={key} className="grid grid-cols-[40px_1fr_auto_auto] items-center gap-4 py-3.5">
          <span className={`text-xl font-mono font-light text-center ${signalCls(val.score)}`}>{key}</span>
          <div>
            <div className="text-sm text-gray-300">{CAN_SLIM_META[key].name}</div>
            <div className="text-xs text-gray-600 mt-0.5">{val.comment || CAN_SLIM_META[key].hint}</div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-mono ${signalCls(val.score)}`}>{val.value ?? '—'}</div>
            <div className="text-xs text-gray-700 mt-0.5">{signalLabel(val.score)}</div>
          </div>
          <span className={`font-mono text-sm w-10 text-right ${signalCls(val.score)}`}>
            {val.score ?? '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MetricList — Quant/기술/재무 공용
// ═════════════════════════════════════════════════════════════════════════════
const QUANT_META = {
  momentum:     { name: '모멘텀' },
  zscore:       { name: '통계적 Z-Score' },
  volAdj:       { name: '변동성 조정 (Sharpe 근사)' },
  multiSignal:  { name: '다중 신호도' },
  drawdown:     { name: '낙폭 위험도' },
  smartMoney:   { name: '스마트머니 흐름' },
  shortSale:    { name: '공매도 비율' },
  valueQuality: { name: '가치·퀄리티 팩터' },
  surgePower:   { name: '황균 파워' },
  targetPrice:  { name: '목표가 팩터' },
  hurst:        { name: '허스트 지수' },
  kalman:       { name: '칼만 필터 추세' },
  sentiment:    { name: '시장 심리' },
};
const TECH_META = {
  rsi:        { name: 'RSI (14)' },
  adx:        { name: 'ADX' },
  atrPct:     { name: 'ATR %' },
  vwap:       { name: 'VWAP 거리' },
  volRatio:   { name: '거래량 비율' },
  macd:       { name: 'MACD 방향' },
  orb:        { name: 'ORB 신호' },
  nr7:        { name: 'NR7 압축' },
  bollinger:  { name: '볼린저밴드 위치' },
  rsRating:   { name: 'RS 등급' },
  ret12m:     { name: '12개월 수익률' },
  ret3m:      { name: '3개월 수익률' },
};
const FIN_META = {
  per:           { name: 'PER' },
  pbr:           { name: 'PBR' },
  roe:           { name: 'ROE' },
  epsGrowth:     { name: 'EPS 성장률' },
  epsAccel:      { name: 'EPS 가속' },
  revenueGrowth: { name: '매출 성장' },
  dividendYield: { name: '배당 수익률' },
  opMargin:      { name: '영업이익률' },
  debtRatio:     { name: '부채비율' },
  marketCap:     { name: '시가총액' },
};

function MetricList({ items, meta }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
      {Object.entries(items).map(([key, val]) => (
        <div key={key} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2.5 border-b border-gray-800/60">
          <div className="min-w-0">
            <div className="text-sm text-gray-300">{meta[key]?.name ?? key}</div>
            {val.comment && (
              <div className="text-xs text-gray-600 mt-0.5 truncate">{val.comment}</div>
            )}
          </div>
          <div className={`font-mono text-sm text-right ${signalCls(val.score)}`}>
            {val.value ?? '—'}
          </div>
          <div className={`font-mono text-xs w-8 text-right ${signalCls(val.score)}`}>
            {val.score ?? '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Consensus
// ═════════════════════════════════════════════════════════════════════════════
function Consensus({ consensus }) {
  const upColor = consensus.upside > 0 ? 'text-emerald-400' : 'text-rose-400';
  return (
    <Section label="증권사 컨센서스" weight={null} score={null}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
        <PriceBox label="최저" value={fmtPrice(consensus.min)} />
        <PriceBox label="평균 목표가" value={fmtPrice(consensus.avg)} big />
        <PriceBox label="최고" value={fmtPrice(consensus.max)} />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-600 uppercase tracking-wider">상승 여력</span>
          <span className={`text-2xl font-mono font-light ${upColor}`}>
            {consensus.upside > 0 ? '+' : ''}{consensus.upside}%
          </span>
        </div>
      </div>
      {consensus.estimated && (
        <p className="text-xs text-gray-700 mb-3">* 추정PER × 추정EPS 산출 (증권사 직접 의견 없음)</p>
      )}
      {consensus.opinions?.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-600 uppercase tracking-wider border-b border-gray-800">
              <th className="text-left py-2 font-medium">날짜</th>
              <th className="text-left py-2 font-medium">증권사</th>
              <th className="text-left py-2 font-medium">의견</th>
              <th className="text-right py-2 font-medium">목표가</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {consensus.opinions.map((o, i) => (
              <tr key={i}>
                <td className="py-2 font-mono text-xs text-gray-600">{o.date}</td>
                <td className="py-2 text-gray-300">{o.broker}</td>
                <td className="py-2 text-gray-500 text-xs">{o.opinion}</td>
                <td className="py-2 text-right font-mono text-gray-300">{fmtPrice(o.targetPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function PriceBox({ label, value, big }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-600 uppercase tracking-wider">{label}</span>
      <span className={`font-mono text-gray-200 font-light ${big ? 'text-2xl' : 'text-base'}`}>{value}</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EarningsSurprise
// ═════════════════════════════════════════════════════════════════════════════
function EarningsSurprise({ items }) {
  return (
    <Section label="실적 (최근 분기)" weight={null} score={null}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((it, i) => {
          const isCons = it.isConsensus === 'Y' || it.isConsensus === true;
          return (
            <div key={i} className="border border-gray-800 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{it.period?.slice(0, 4)}.{it.period?.slice(4, 6)}</span>
                <span className={`flex items-center gap-1 ${isCons ? 'text-gray-500' : 'text-emerald-400'}`}>
                  {isCons ? <IconStar className="w-3 h-3" /> : <IconCheck className="w-3 h-3" />}
                  {isCons ? '추정' : '실적'}
                </span>
              </div>
              <div className="font-mono text-lg text-gray-200">{fmtNum(it.eps)}</div>
              <div className="text-xs text-gray-700">EPS · 원</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Peers
// ═════════════════════════════════════════════════════════════════════════════
function Peers({ peers, onSelect }) {
  return (
    <Section label="같은 섹터 경쟁사" weight={null} score={null}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-600 uppercase tracking-wider border-b border-gray-800">
            <th className="text-left py-2 font-medium">종목</th>
            <th className="text-right py-2 font-medium">시가총액</th>
            <th className="text-left py-2 font-medium pl-6">섹터</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {peers.map(p => (
            <tr key={p.code} onClick={() => onSelect(p.code, p.name)} className="cursor-pointer hover:bg-gray-800/30 transition-colors">
              <td className="py-3">
                <div className="text-gray-300">{p.name}</div>
                <div className="font-mono text-xs text-gray-600">{p.code}</div>
              </td>
              <td className="py-3 text-right font-mono text-gray-300">{fmtCap(p.marketCapEok)}</td>
              <td className="py-3 pl-6 text-xs text-gray-500">{p.sector}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Disclosures
// ═════════════════════════════════════════════════════════════════════════════
function Disclosures({ items }) {
  return (
    <Section label="최근 공시 (DART)" weight={null} score={null}>
      <div className="divide-y divide-gray-800/60">
        {items.map((d, i) => {
          const date = `${d.date.slice(0, 4)}.${d.date.slice(4, 6)}.${d.date.slice(6, 8)}`;
          return (
            <a key={i} href={d.url} target="_blank" rel="noreferrer"
               className="py-2.5 flex items-center gap-4 text-sm hover:text-gray-100 transition-colors group">
              <span className="font-mono text-xs text-gray-600 w-20 shrink-0">{date}</span>
              <span className="text-gray-400 flex-1 truncate group-hover:text-gray-100">{d.title}</span>
              <IconExternal className="w-3 h-3 text-gray-700 shrink-0 group-hover:text-gray-400" />
            </a>
          );
        })}
      </div>
    </Section>
  );
}
