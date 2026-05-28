import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { LoadingSpinner } from './LoadingSpinner';
import {
  IconChartBar, IconTrendUp, IconWallet, IconBank, IconCash, IconBolt, IconScale,
  IconArrowUp, IconArrowDown, IconCheck, IconStar, IconWarning, IconExternal,
  IconSearch, IconDot, IconScore,
} from './Icons';

// ─── 색상 유틸 ────────────────────────────────────────────────────────────────
const COLOR_MAP = {
  green:  '#3fb950',
  blue:   '#58a6ff',
  yellow: '#d29922',
  red:    '#f85149',
  gray:   '#484f58',
};
const TEXT_CLS = {
  green:  'text-brand-green',
  blue:   'text-brand-blue',
  yellow: 'text-brand-yellow',
  red:    'text-brand-red',
  gray:   'text-gray-500',
};
const BG_CLS = {
  green:  'bg-brand-green/10 border-brand-green/20',
  blue:   'bg-brand-blue/10 border-brand-blue/20',
  yellow: 'bg-brand-yellow/10 border-brand-yellow/20',
  red:    'bg-brand-red/10 border-brand-red/20',
  gray:   'bg-surface-raised border-surface-border',
};

const fmtNum   = (v) => v == null ? '—' : v.toLocaleString('ko-KR');
const fmtPrice = (v) => v == null ? '—' : `₩${Math.round(v).toLocaleString('ko-KR')}`;
const fmtPct   = (v, sign = true) => v == null ? '—' : `${sign && v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const fmtCap   = (v) => {
  if (v == null) return '—';
  if (v >= 10000) return `${(v / 10000).toFixed(1)}조`;
  return `${v.toLocaleString()}억`;
};

// ─── 종목 빠른 선택 ──────────────────────────────────────────────────────────
const QUICK = [
  { code: '005930', name: '삼성전자' },
  { code: '000660', name: 'SK하이닉스' },
  { code: '373220', name: 'LG에너지솔루션' },
  { code: '207940', name: '삼성바이오로직스' },
  { code: '005380', name: '현대차' },
  { code: '035720', name: '카카오' },
  { code: '035420', name: 'NAVER' },
  { code: '042700', name: '한미반도체' },
];

// ═════════════════════════════════════════════════════════════════════════════
export function StockScorer() {
  const [query,   setQuery]   = useState('');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // 자동완성
  const [allStocks,      setAllStocks]      = useState([]);
  const [searchResults,  setSearchResults]  = useState([]);
  const [showDropdown,   setShowDropdown]   = useState(false);
  const [activeIndex,    setActiveIndex]    = useState(-1);
  const [selectedCode,   setSelectedCode]   = useState(''); // 확정 선택된 종목코드
  const dropdownRef = useRef(null);

  // 전종목 리스트 캐싱 (마운트 시 1회)
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/api/valuation/all-stocks');
        if (res.data?.success && Array.isArray(res.data.stocks)) {
          setAllStocks(res.data.stocks);
        }
      } catch (e) {
        console.warn('종목 리스트 캐싱 실패:', e.message);
      }
    })();
  }, []);

  // 입력 변경 시 필터링
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

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selectStock = (stock) => {
    setQuery(`${stock.name} (${stock.code})`);
    setSelectedCode(stock.code);
    setShowDropdown(false);
    setActiveIndex(-1);
    search(stock.code);
  };

  const search = async (code) => {
    // 우선순위: 인자 > 선택된 코드 > 입력에서 숫자 추출
    const c = code || selectedCode || query.replace(/[^0-9]/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(c)) {
      setError('종목명 또는 6자리 종목코드를 입력하세요 (예: 005930 / 삼성전자)');
      return;
    }
    setLoading(true); setError(null); setData(null); setShowDropdown(false);
    try {
      const res = await axios.get(`/api/stock-score/${c}`, { timeout: 60000 });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (showDropdown && searchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, searchResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0) selectStock(searchResults[activeIndex]);
        else if (searchResults.length === 1) selectStock(searchResults[0]);
        else search();
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    } else if (e.key === 'Enter') {
      search();
    }
  };

  const handleQueryChange = (v) => {
    setQuery(v);
    // 사용자가 손으로 다시 입력하면 선택 해제
    if (selectedCode && !v.includes(selectedCode)) setSelectedCode('');
  };

  const handleQuick = (code, name) => {
    setQuery(`${name} (${code})`);
    setSelectedCode(code);
    search(code);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 검색 (드롭다운이 카드 밖으로 나가도록 overflow-visible) */}
      <div className="card" style={{ overflow: 'visible' }}>
        <div className="card-header">
          <div>
            <span className="card-title">한국 종목 점수 분석</span>
            <p className="text-xs text-gray-600 mt-0.5">종목명 또는 6자리 코드 입력 · 자동완성 지원</p>
          </div>
        </div>
        <div className="px-4 py-3 flex flex-col gap-3 relative">
          <div className="flex gap-2 relative">
            <div className="relative flex-1" ref={dropdownRef}>
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 z-10" />
              <input
                type="text"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="종목명 또는 6자리 코드 입력 (예: 삼성전자 / 005930)"
                autoComplete="off"
                className="w-full pl-9 pr-4 py-2 text-sm bg-surface-raised border border-surface-border rounded-lg
                           text-gray-200 placeholder-gray-700 focus:outline-none focus:border-brand-blue"
              />
              {selectedCode && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-brand-blue/15 text-brand-blue text-xs font-mono rounded border border-brand-blue/30">
                  {selectedCode}
                </span>
              )}

              {/* 자동완성 드롭다운 */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-surface-card border border-surface-border rounded-lg shadow-2xl max-h-80 overflow-y-auto">
                  {searchResults.map((s, idx) => (
                    <button
                      key={s.code}
                      onClick={() => selectStock(s)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between border-b border-surface-border last:border-0 transition-colors ${
                        activeIndex === idx
                          ? 'bg-brand-blue/15 text-brand-blue'
                          : 'text-gray-300 hover:bg-surface-raised'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconDot className={`w-1.5 h-1.5 shrink-0 ${activeIndex === idx ? 'text-brand-blue' : 'text-gray-700'}`} />
                        <span className="text-sm font-semibold truncate">{s.name}</span>
                        {s.market && (
                          <span className={`shrink-0 text-xs px-1 py-0.5 rounded font-mono ${
                            s.market === 'KOSPI' ? 'bg-brand-blue/10 text-brand-blue' :
                            s.market === 'KOSDAQ' ? 'bg-brand-green/10 text-brand-green' :
                            'bg-gray-700/30 text-gray-500'
                          }`}>{s.market}</span>
                        )}
                      </div>
                      <span className="shrink-0 ml-2 font-mono text-xs text-gray-500">{s.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => search()} disabled={loading || !query}
                    className="btn-primary px-5 py-2 text-sm font-semibold whitespace-nowrap">
              {loading ? (
                <><span className="w-3.5 h-3.5 border border-brand-blue border-t-transparent rounded-full animate-spin" /> 분석 중</>
              ) : '점수 분석'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-700">빠른 선택:</span>
            {QUICK.map(({ code, name }) => (
              <button key={code} onClick={() => handleQuick(code, name)} disabled={loading}
                      className="px-2.5 py-0.5 text-xs rounded-full border border-surface-border bg-surface-raised
                                 text-gray-500 hover:text-gray-200 hover:border-gray-500 font-mono">
                {code} <span className="text-gray-700 font-sans">{name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 상태 */}
      {error && (
        <div className="px-4 py-3 rounded-lg border border-brand-red/20 bg-brand-red/5 text-xs text-brand-red flex items-center gap-2">
          <IconWarning className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {loading && (
        <div className="card px-6 py-10 flex flex-col items-center gap-3">
          <LoadingSpinner />
          <p className="text-sm text-gray-400">KIS · DART · 네이버 데이터 수집 중...</p>
          <p className="text-xs text-gray-700">분봉·공매도·증권사 의견·재무 데이터 병렬 호출 · 약 10-20초</p>
        </div>
      )}

      {/* 결과 */}
      {data && !loading && (
        <>
          <StockHeader data={data} />
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            <LeftPanel data={data} />
            <div className="flex flex-col gap-4">
              <CategorySummary data={data} />
              <CanSlimSection canSlim={data.canSlim} score={data.scores.canSlim} />
              <QuantSection quant={data.quant} score={data.scores.quant} />
              <TechSection tech={data.tech} score={data.scores.tech} />
              <FinSection fin={data.fin} score={data.scores.fin} />
              {data.consensus && <ConsensusSection consensus={data.consensus} currentPrice={data.currentPrice} />}
              {data.earningsSurprise?.length > 0 && <EarningsSurprise items={data.earningsSurprise} />}
              {data.peers?.length > 0 && <PeersTable peers={data.peers} currentCode={data.code} />}
              {data.disclosures?.length > 0 && <DisclosuresList disclosures={data.disclosures} />}
            </div>
          </div>
          <p className="text-xs text-gray-700 text-center py-2 flex items-center justify-center gap-1.5">
            <IconWarning className="w-3 h-3" />
            본 점수는 참고 지표입니다. 투자 결정은 본인 책임 · 데이터: KIS · DART · 네이버 ·
            기준: {new Date(data.timestamp).toLocaleString('ko-KR')}
          </p>
        </>
      )}

      {!data && !loading && !error && (
        <div className="empty-state py-16">
          <div className="w-14 h-14 rounded-full bg-surface-raised flex items-center justify-center text-gray-500 mb-2">
            <IconChartBar className="w-7 h-7" />
          </div>
          <p className="empty-state-title">종목코드 입력 후 점수 분석을 실행하세요</p>
          <p className="empty-state-desc">CAN SLIM 7개 · Quant 13개 · 기술 12개 · 재무 10개 항목 종합 채점</p>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. 종목 헤더
// ═════════════════════════════════════════════════════════════════════════════
function StockHeader({ data }) {
  const up = (data.dayChange ?? 0) >= 0;
  return (
    <div className="card">
      <div className="px-5 py-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-gray-100 truncate">{data.name}</h2>
            <span className="font-mono text-sm text-gray-500 bg-surface-raised px-2 py-0.5 rounded">{data.code}</span>
            {data.market && data.market !== '—' && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                data.market === 'KOSPI' ? 'bg-brand-blue/10 text-brand-blue' : 'bg-brand-green/10 text-brand-green'
              }`}>{data.market}</span>
            )}
            {data.sector && data.sector !== '—' && (
              <span className="text-xs text-gray-600">{data.sector}</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-2xl font-bold text-gray-100">{fmtPrice(data.currentPrice)}</div>
          {data.dayChange != null && (
            <div className={`font-mono text-sm font-semibold flex items-center justify-end gap-1 ${up ? 'text-brand-green' : 'text-brand-red'}`}>
              {up ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />}
              {fmtPct(data.dayChange)}
            </div>
          )}
        </div>
        <div className="shrink-0 text-xs space-y-1 min-w-[140px]">
          <div className="flex justify-between gap-3 text-gray-500"><span>시가총액</span><span className="font-mono text-gray-300">{fmtCap(data.marketCapEok)}</span></div>
          {data.foreignRate != null && (
            <div className="flex justify-between gap-3 text-gray-500"><span>외인소진율</span><span className="font-mono text-gray-300">{data.foreignRate.toFixed(2)}%</span></div>
          )}
          {data.volatility != null && (
            <div className="flex justify-between gap-3 text-gray-500"><span>변동성(ATR)</span><span className="font-mono text-gray-300">{data.volatility}%</span></div>
          )}
        </div>
        {data.high52w && data.low52w && (
          <div className="shrink-0 min-w-[180px]">
            <div className="text-xs text-gray-500 mb-1.5">52주 가격 범위</div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500">
              <span>{fmtPrice(data.low52w)}</span>
              <div className="flex-1 relative bg-surface-raised rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-brand-blue/60"
                     style={{ width: `${Math.min(100, Math.max(0, (data.currentPrice - data.low52w) / (data.high52w - data.low52w) * 100))}%` }} />
              </div>
              <span>{fmtPrice(data.high52w)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. 좌측 패널 (종합 점수 + 진입 단계)
// ═════════════════════════════════════════════════════════════════════════════
function LeftPanel({ data }) {
  const phaseColor = {
    STRONG_BUY: 'text-brand-green border-brand-green/30 bg-brand-green/5',
    BUY:        'text-brand-blue  border-brand-blue/30 bg-brand-blue/5',
    HOLD:       'text-brand-yellow border-brand-yellow/30 bg-brand-yellow/5',
    WATCH:      'text-gray-400 border-gray-600/30 bg-gray-700/5',
    AVOID:      'text-brand-red border-brand-red/30 bg-brand-red/5',
  };

  const color = data.totalScore >= 75 ? 'green' : data.totalScore >= 55 ? 'blue' : data.totalScore >= 40 ? 'yellow' : 'red';

  return (
    <div className="flex flex-col gap-4">
      {/* 종합 점수 */}
      <div className="card p-4 text-center">
        <div className="text-xs text-gray-500 mb-2">이 회사 자체는 좋은가?</div>
        <div className="text-xs text-gray-600 mb-3">종합 점수 (재무·밸류·기술·수급 모두 합산)</div>
        <CircularScore score={data.totalScore} grade={data.grade} color={color} size={140} />
        <div className={`mt-3 px-3 py-1.5 rounded-lg border text-sm font-bold inline-block ${phaseColor[data.phase] || phaseColor.WATCH}`}>
          {data.phaseLabel}
        </div>
      </div>

      {/* 실적 한눈에 (재무 핵심) */}
      <div className="card">
        <div className="card-header"><span className="card-title">실적 한눈에</span></div>
        <div className="p-3 space-y-2">
          <MiniMetric label="EPS 성장률" value={data.fin?.epsGrowth?.value} score={data.fin?.epsGrowth?.score} color={data.fin?.epsGrowth?.color} hint="분기 전년비" />
          <MiniMetric label="ROE" value={data.fin?.roe?.value} score={data.fin?.roe?.score} color={data.fin?.roe?.color} hint="자기자본이익률" />
          <MiniMetric label="영업이익률" value={data.fin?.opMargin?.value} score={data.fin?.opMargin?.score} color={data.fin?.opMargin?.color} hint="매출 대비 영업이익" />
          <MiniMetric label="부채비율" value={data.fin?.debtRatio?.value} score={data.fin?.debtRatio?.score} color={data.fin?.debtRatio?.color} hint="총부채/자본" />
          <MiniMetric label="PER" value={data.fin?.per?.value} score={data.fin?.per?.score} color={data.fin?.per?.color} hint="주가/순이익" />
        </div>
      </div>

      {/* 회사 가치 + 진입 타이밍 그리드 */}
      <div className="card p-4">
        <div className="card-title mb-2">회사 가치 · 진입 타이밍</div>
        <p className="text-xs text-gray-600 mb-3">이 종목이 (1) 본질 가치가 좋은지 · (2) 지금 진입 적기인지 좌표상 표시</p>
        <QuadrantChart finScore={data.scores.fin} techScore={data.scores.tech} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, score, color, hint }) {
  return (
    <div className="bg-surface-raised rounded p-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        {score != null && <span className={`text-xs font-mono font-bold ${TEXT_CLS[color]}`}>{score}</span>}
      </div>
      <div className={`text-base font-mono font-bold ${TEXT_CLS[color] || 'text-gray-300'}`}>{value ?? '—'}</div>
      {hint && <div className="text-xs text-gray-700 mt-0.5">{hint}</div>}
    </div>
  );
}

function CircularScore({ score, grade, color, size = 130 }) {
  const r = size * 0.35;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const offset = c - ((score || 0) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1c2128" strokeWidth={8} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLOR_MAP[color]} strokeWidth={8}
              strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={size * 0.27} fontWeight="700" fill={COLOR_MAP[color]} fontFamily="JetBrains Mono">
        {score ?? '—'}
      </text>
      <text x={cx} y={cy + size * 0.15} textAnchor="middle" fontSize={11} fill="#6e7681">/ 100 · {grade}</text>
    </svg>
  );
}

function QuadrantChart({ finScore, techScore }) {
  const size = 200;
  const fx = (finScore  ?? 50) / 100 * size;
  const ty = (1 - (techScore ?? 50) / 100) * size;
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} className="border border-surface-border rounded">
      <rect x="0"           y="0"           width={size / 2} height={size / 2} fill="#3fb950" fillOpacity={0.08} />
      <rect x={size / 2}    y="0"           width={size / 2} height={size / 2} fill="#58a6ff" fillOpacity={0.08} />
      <rect x="0"           y={size / 2}    width={size / 2} height={size / 2} fill="#f85149" fillOpacity={0.08} />
      <rect x={size / 2}    y={size / 2}    width={size / 2} height={size / 2} fill="#d29922" fillOpacity={0.08} />
      <line x1="0" y1={size / 2} x2={size} y2={size / 2} stroke="#30363d" strokeWidth={0.5} strokeDasharray="2 2" />
      <line x1={size / 2} y1="0" x2={size / 2} y2={size} stroke="#30363d" strokeWidth={0.5} strokeDasharray="2 2" />
      <text x="6" y="14" fontSize="8" fill="#3fb950">강한 회사·좋은 타이밍</text>
      <text x={size - 100} y="14" fontSize="8" fill="#58a6ff">약한 회사·좋은 타이밍</text>
      <text x="6" y={size - 6} fontSize="8" fill="#f85149">강한 회사·나쁜 타이밍</text>
      <text x={size - 100} y={size - 6} fontSize="8" fill="#d29922">약한 회사·나쁜 타이밍</text>
      <circle cx={fx} cy={ty} r="6" fill="#f85149" stroke="#fff" strokeWidth={1.5} />
      <text x="6" y={size / 2 - 2} fontSize="7" fill="#6e7681">기술↑</text>
      <text x={size - 18} y={size / 2 + 9} fontSize="7" fill="#6e7681">재무↑</text>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. 카테고리 요약 (4개 점수 + 가중)
// ═════════════════════════════════════════════════════════════════════════════
function CategorySummary({ data }) {
  const cats = [
    { key: 'canSlim', label: 'CAN SLIM',  weight: '30%', score: data.scores.canSlim },
    { key: 'quant',   label: 'Quant',     weight: '25%', score: data.scores.quant },
    { key: 'tech',    label: '기술 지표',  weight: '20%', score: data.scores.tech },
    { key: 'fin',     label: '재무 지표',  weight: '25%', score: data.scores.fin },
  ];
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">카테고리별 점수</span>
        <span className="text-xs text-gray-600">가중평균 합산 → 종합 {data.totalScore}점</span>
      </div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {cats.map(c => {
          const color = c.score >= 75 ? 'green' : c.score >= 55 ? 'blue' : c.score >= 40 ? 'yellow' : 'red';
          return (
            <div key={c.key} className={`rounded-lg border p-3 ${BG_CLS[color]}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{c.label}</span>
                <span className="text-xs text-gray-700">{c.weight}</span>
              </div>
              <div className={`text-2xl font-bold font-mono ${TEXT_CLS[color]}`}>{c.score ?? '—'}</div>
              <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${c.score || 0}%`, background: COLOR_MAP[color] }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. CAN SLIM 섹션
// ═════════════════════════════════════════════════════════════════════════════
const CAN_SLIM_META = {
  C: { name: 'EPS 가속도',  hint: '분기 순이익이 50% 이상 폭발적으로 늘었는가' },
  A: { name: '연간 ROE 실적', hint: '자기자본이익률 17%↑ 기준' },
  N: { name: '신고가/피봇 돌파', hint: '52주 최고가보다 12% 아래에 있는가' },
  S: { name: '거래량 확인 돌파', hint: '거래량이 평소의 1.5배 수준인가' },
  L: { name: '주도주 판별', hint: '시장 대비 상대강도(RS) 99점이 시장 주도주' },
  I: { name: '기관 수급', hint: '기관 자금 흐름 (외인 매수 강도 MFI 71)' },
  M: { name: '시장 방향', hint: '시장 전체가 강한 상승 추세 (CAN SLIM의 핵심 조건)' },
};

function CanSlimSection({ canSlim, score }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <span className="badge-green">CAN SLIM</span>
          <span className="card-title">분석</span>
        </div>
        <span className="text-xs text-gray-600">합산 {score}점</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="text-xs text-brand-green mb-3 font-semibold flex items-center gap-2">
          <span className="flex-1 h-px bg-brand-green/30" />
          <span className="tracking-wider">CAN SLIM 원칙 요약</span>
          <span className="flex-1 h-px bg-brand-green/30" />
        </div>
        {Object.entries(canSlim).map(([key, val]) => (
          <CanSlimRow key={key} code={key} val={val} meta={CAN_SLIM_META[key]} />
        ))}
      </div>
    </div>
  );
}

function CanSlimRow({ code, val, meta }) {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded bg-surface-raised">
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm border ${BG_CLS[val.color]} ${TEXT_CLS[val.color]}`}>
        {code}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-semibold text-gray-300">{meta.name}</div>
          {val.score != null && (
            <span className={`text-xs font-mono font-bold ${TEXT_CLS[val.color]}`}>{val.score}점</span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{val.comment || meta.hint}</div>
      </div>
      {val.value != null && (
        <div className={`shrink-0 text-sm font-mono font-bold ${TEXT_CLS[val.color]}`}>{val.value}</div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. Quant 섹션 (그리드 카드)
// ═════════════════════════════════════════════════════════════════════════════
const QUANT_META = {
  momentum:     { name: '모멘텀',          tag: 'Quant', hint: '1년·6M·3M 수익률 가중평균' },
  zscore:       { name: '통계적 Z-Score',  tag: 'Math',  hint: '60일 평균 대비 표준편차' },
  volAdj:       { name: '변동성 조정',      tag: 'Adj',   hint: '변동성 대비 수익률 (Sharpe 근사)' },
  multiSignal:  { name: '다중 신호도',      tag: 'Quant', hint: '8개 기술 조건 충족 개수' },
  drawdown:     { name: '낙폭 위험도',      tag: 'Quant', hint: '최근 6개월 고점 대비 하락폭' },
  smartMoney:   { name: '스마트머니 흐름',   tag: 'Quant', hint: 'OBV + 외인/기관 순매수 추세' },
  shortSale:    { name: '공매도 비율',      tag: 'Quant', hint: '최근 5일 공매도 비중' },
  valueQuality: { name: '가치·퀄리티 팩터', tag: 'Quant', hint: 'PER·PBR·ROE·영업이익률 종합' },
  surgePower:   { name: '황균 파워',        tag: 'Quant', hint: 'RSI 65↑ 시점의 Z-Score' },
  targetPrice:  { name: 'Target Price',    tag: 'Quant', hint: '증권사 목표가 대비 상승여력' },
  hurst:        { name: '허스트 지수',      tag: 'Math',  hint: '추세 지속성·방향 예측력' },
  kalman:       { name: '칼만 필터',        tag: 'Math',  hint: '노이즈 제거 후 추세 신호' },
  sentiment:    { name: '시장 심리 추정',    tag: 'Sentiment', hint: '거래량·등락 강도 합성' },
};

const TAG_CLS = {
  Quant:     'bg-brand-blue/15 text-brand-blue border-brand-blue/25',
  Math:      'bg-brand-purple/15 text-brand-purple border-brand-purple/25',
  Adj:       'bg-brand-yellow/15 text-brand-yellow border-brand-yellow/25',
  Sentiment: 'bg-brand-green/15 text-brand-green border-brand-green/25',
};

function QuantSection({ quant, score }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Quant 지표</span>
        <span className="text-xs text-gray-600">합산 {score}점</span>
      </div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {Object.entries(quant).map(([key, val]) => (
          <QuantCard key={key} val={val} meta={QUANT_META[key]} />
        ))}
      </div>
    </div>
  );
}

function QuantCard({ val, meta }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border p-3 ${BG_CLS[val.color]} cursor-pointer transition-colors hover:bg-opacity-20`}
         onClick={() => setOpen(o => !o)}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold ${TAG_CLS[meta.tag] || 'badge-neutral'}`}>{meta.tag}</span>
        <span className="text-xs font-semibold text-gray-300 flex-1 truncate">{meta.name}</span>
      </div>
      <div className={`text-2xl font-bold font-mono text-center ${TEXT_CLS[val.color]}`}>
        {val.score ?? '—'}
      </div>
      <div className="mt-2 h-1 bg-surface rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${val.score || 0}%`, background: COLOR_MAP[val.color] }} />
      </div>
      {val.value != null && (
        <div className="text-center text-xs text-gray-500 mt-1.5 font-mono">{val.value}</div>
      )}
      {open && (val.comment || meta.hint) && (
        <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-surface-border">{val.comment || meta.hint}</p>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. 기술 지표 섹션 (목록형)
// ═════════════════════════════════════════════════════════════════════════════
const TECH_META = {
  rsi:        { name: 'RSI (14)',  hint: '70↑ 과매수(조정 주의) · 30↓ 과매도(매수 기회)' },
  adx:        { name: 'ADX',        hint: '25↑ 추세 존재 · 40↑ 강한 추세 · 25↓ 횡보' },
  atrPct:     { name: 'ATR%',       hint: '높을수록 변동성 큼 — 위험과 기회 동시' },
  vwap:       { name: 'VWAP 거리',  hint: '양수=평균가 위(강세) · 음수=아래(약세)' },
  volRatio:   { name: '거래량 비율', hint: '1↑ 평소보다 활발 · 2↑ 기관 참여 가능성' },
  macd:       { name: 'MACD 방향',  hint: '히스토그램 양수=상승 모멘텀 · 음수=하락 모멘텀' },
  orb:        { name: 'ORB 신호',    hint: '시초가 범위 돌파 시 매수 신호' },
  nr7:        { name: 'NR7 압축',    hint: '변동폭 수축 후 큰 움직임 대비' },
  bollinger:  { name: '볼린저밴드',  hint: '하단 반등=매수 기회 · 상단=과열 주의' },
  rsRating:   { name: 'RS 등급',     hint: '80↑ 시장 주도주 · 40↓ 부진주' },
  ret12m:     { name: '12M 수익률',  hint: '1년간 주가 등락 — 양수면 상승 추세' },
  ret3m:      { name: '3M 수익률',   hint: '3개월간 주가 등락 — 단기 추세 확인' },
};

function TechSection({ tech, score }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <IconDot className="w-2 h-2 text-brand-green" />
          <span className="card-title">기술 지표</span>
        </div>
        <span className="text-xs text-gray-600">합산 {score}점</span>
      </div>
      <div className="divide-y divide-surface-border">
        {Object.entries(tech).map(([key, val]) => (
          <MetricRow key={key} val={val} meta={TECH_META[key]} />
        ))}
      </div>
    </div>
  );
}

function MetricRow({ val, meta }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface-raised/40">
      <div className={`shrink-0 w-1 h-10 rounded-full`} style={{ background: COLOR_MAP[val.color] }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-300">{meta.name}</div>
        <div className="text-xs text-gray-600 mt-0.5">{val.comment || meta.hint}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`text-sm font-mono font-bold ${TEXT_CLS[val.color]}`}>{val.value ?? '—'}</div>
        {val.score != null && (
          <div className="text-xs text-gray-600 mt-0.5">{val.label} · {val.score}점</div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. 재무 지표 섹션
// ═════════════════════════════════════════════════════════════════════════════
const FIN_META = {
  per:           { name: 'PER',          hint: '주가 ÷ 순이익 · 15↓ 저평가 · 40↑ 고평가' },
  pbr:           { name: 'PBR',          hint: '주가 ÷ 순자산 · 1↓ 자산 대비 저렴' },
  roe:           { name: 'ROE',          hint: '자기자본이익률 · 17%↑ 오닐 기준 합격' },
  epsGrowth:     { name: 'EPS 성장률',   hint: '분기 순이익 전년비 · 25%↑ 성장주 기준' },
  epsAccel:      { name: 'EPS 가속',      hint: '전분기 대비 성장 가속 중인가 (CAN SLIM C원칙)' },
  revenueGrowth: { name: '매출 성장',     hint: '전년비 매출 성장률 — 양수=매출 확장 중' },
  dividendYield: { name: '배당수익률',    hint: '연간 배당금 ÷ 현재가 (배당주 참고)' },
  opMargin:      { name: '영업이익률',    hint: '매출 대비 영업이익 · 20%↑ 우수' },
  debtRatio:     { name: '부채비율',      hint: '100%↓ 양호 · 200%↑ 위험' },
  marketCap:     { name: '시가총액',      hint: '기업 규모 — 클수록 안정적' },
};

function FinSection({ fin, score }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <IconDot className="w-2 h-2 text-brand-green" />
          <span className="card-title">재무 지표</span>
        </div>
        <span className="text-xs text-gray-600">합산 {score}점</span>
      </div>
      <div className="divide-y divide-surface-border">
        {Object.entries(fin).map(([key, val]) => (
          <MetricRow key={key} val={val} meta={FIN_META[key]} />
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. 증권사 컨센서스
// ═════════════════════════════════════════════════════════════════════════════
function ConsensusSection({ consensus, currentPrice }) {
  const upColor = consensus.upside > 0 ? 'green' : 'red';
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">증권사 컨센서스</span>
        {consensus.count > 0 && <span className="text-xs text-gray-600">{consensus.count}곳 의견 종합</span>}
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-surface-raised rounded p-3 text-center">
          <div className="text-xs text-gray-600 mb-1">최저</div>
          <div className="font-mono text-sm font-bold text-gray-300">{fmtPrice(consensus.min)}</div>
        </div>
        <div className="bg-surface-raised rounded p-3 text-center">
          <div className="text-xs text-gray-600 mb-1">평균 목표가</div>
          <div className="font-mono text-lg font-bold text-brand-blue">{fmtPrice(consensus.avg)}</div>
        </div>
        <div className="bg-surface-raised rounded p-3 text-center">
          <div className="text-xs text-gray-600 mb-1">최고</div>
          <div className="font-mono text-sm font-bold text-gray-300">{fmtPrice(consensus.max)}</div>
        </div>
        <div className={`rounded p-3 text-center border ${BG_CLS[upColor]}`}>
          <div className="text-xs text-gray-600 mb-1">상승여력 (현재가 대비)</div>
          <div className={`font-mono text-lg font-bold ${TEXT_CLS[upColor]}`}>{consensus.upside > 0 ? '+' : ''}{consensus.upside}%</div>
        </div>
      </div>
      {consensus.estimated && (
        <div className="px-4 pb-3 text-xs text-gray-600">* 추정PER × 추정EPS로 산출 (증권사 직접 의견 없음)</div>
      )}
      {consensus.opinions?.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-xs text-gray-500 mb-2">최근 의견</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-600 border-b border-surface-border">
                  <th className="text-left py-1.5 px-2">날짜</th>
                  <th className="text-left py-1.5 px-2">증권사</th>
                  <th className="text-left py-1.5 px-2">의견</th>
                  <th className="text-right py-1.5 px-2">목표가</th>
                </tr>
              </thead>
              <tbody>
                {consensus.opinions.map((o, i) => (
                  <tr key={i} className="border-b border-surface-border last:border-0">
                    <td className="py-1.5 px-2 text-gray-500 font-mono">{o.date}</td>
                    <td className="py-1.5 px-2 text-gray-300">{o.broker}</td>
                    <td className="py-1.5 px-2 text-gray-400">{o.opinion}</td>
                    <td className="py-1.5 px-2 text-right text-gray-300 font-mono">{fmtPrice(o.targetPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. 실적 서프라이즈
// ═════════════════════════════════════════════════════════════════════════════
function EarningsSurprise({ items }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">실적 서프라이즈</span>
        <span className="text-xs text-gray-600">최근 분기 EPS · Y=컨센서스 추정 / N=실제</span>
      </div>
      <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        {items.map((it, i) => {
          const isCons = it.isConsensus === 'Y' || it.isConsensus === true;
          return (
            <div key={i} className={`rounded p-3 border text-center ${isCons ? 'border-brand-blue/20 bg-brand-blue/5' : 'border-brand-green/20 bg-brand-green/5'}`}>
              <div className="text-xs text-gray-600 mb-1">{it.period?.slice(0, 4)}.{it.period?.slice(4, 6)}</div>
              <div className={`text-xs ${isCons ? 'text-brand-blue' : 'text-brand-green'} font-semibold mb-1 flex items-center justify-center gap-1`}>
                {isCons ? <IconStar className="w-3 h-3" /> : <IconCheck className="w-3 h-3" />}
                {isCons ? '컨센서스' : '실제'}
              </div>
              <div className="text-sm font-mono font-bold text-gray-200">{fmtNum(it.eps)}원</div>
              <div className="text-xs text-gray-700 mt-1">EPS</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. 경쟁사 테이블
// ═════════════════════════════════════════════════════════════════════════════
function PeersTable({ peers, currentCode }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">같은 섹터 경쟁사</span>
        <span className="text-xs text-gray-600">시총 상위 {peers.length}개 (클릭하여 점수 분석)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-surface-border bg-surface-raised">
              <th className="text-left px-3 py-2 font-medium">종목</th>
              <th className="text-right px-3 py-2 font-medium">시총</th>
              <th className="text-left px-3 py-2 font-medium">섹터</th>
            </tr>
          </thead>
          <tbody>
            {peers.map(p => (
              <tr key={p.code} className="border-b border-surface-border last:border-0 hover:bg-surface-raised/40 cursor-pointer"
                  onClick={() => { window.location.hash = `score-${p.code}`; window.location.reload(); }}>
                <td className="px-3 py-2">
                  <div className="font-semibold text-gray-200">{p.name}</div>
                  <div className="text-gray-600 font-mono">{p.code}</div>
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-300">{fmtCap(p.marketCapEok)}</td>
                <td className="px-3 py-2 text-gray-500">{p.sector}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. 공시 목록
// ═════════════════════════════════════════════════════════════════════════════
function DisclosuresList({ disclosures }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">최근 공시</span>
        <span className="text-xs text-gray-600">DART 전자공시</span>
      </div>
      <div className="divide-y divide-surface-border">
        {disclosures.map((d, i) => {
          const date = `${d.date.slice(0, 4)}.${d.date.slice(4, 6)}.${d.date.slice(6, 8)}`;
          return (
            <a key={i} href={d.url} target="_blank" rel="noreferrer"
               className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface-raised/40 transition-colors">
              <span className="font-mono text-xs text-gray-600 w-24 shrink-0">{date}</span>
              <span className="text-sm text-gray-300 flex-1 truncate">{d.title}</span>
              <IconExternal className="w-3 h-3 text-gray-700 shrink-0" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
