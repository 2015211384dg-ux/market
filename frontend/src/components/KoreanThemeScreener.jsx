import { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import { KR_THEME_GROUPS, toKisCode, calcUndervalScore, scoreColorCls } from '../data/krThemes';
import { FundamentalBadge } from './FundamentalBadge';
import { StockDetailModal } from './StockDetailModal';
import { LoadingSpinner } from './LoadingSpinner';

const FUND_COLS = [
  { key: 'pbr',             label: 'PBR',       hint: '주가순자산비율 (KIS)' },
  { key: 'per',             label: 'PER',       hint: '주가수익비율 TTM (KIS)' },
  { key: 'evEbitda',        label: 'EV/EBITDA', hint: '기업가치/EBITDA (Yahoo)' },
  { key: 'roe',             label: 'ROE',       hint: '자기자본이익률 (KIS·DART)' },
  { key: 'roa',             label: 'ROA',       hint: '총자산이익률 (DART)' },
  { key: 'operatingMargin', label: '영업이익률',  hint: '영업이익/매출 (DART)' },
  { key: 'netMargin',       label: '순이익률',   hint: '순이익/매출 (DART)' },
  { key: 'debtToEquity',    label: '부채비율',   hint: '총부채/자본 (DART)' },
];

const DEFAULT_FILTER = {
  pbrMax: '', perMin: '', perMax: '',
  evEbitdaMax: '', roeMin: '', roaMin: '',
  minScore: 0, undervalOnly: false,
};

// 초기 선택: 첫 그룹의 첫 자식
const INIT_GROUP = KR_THEME_GROUPS[0].id;
const INIT_THEME = KR_THEME_GROUPS[0].children[0].id;

export function KoreanThemeScreener() {
  const [groupId,    setGroupId]    = useState(INIT_GROUP);
  const [themeId,    setThemeId]    = useState(INIT_THEME);
  // 네이버 업종 종목 캐시: { naverNo: [{code, name, yahooSymbol}] }
  const [naverStocks, setNaverStocks] = useState({});
  // KIS 시세 캐시: { kisCode: { price, dayChangePct, marketCapEok, per, pbr, roe, ... } }
  const [prices,     setPrices]     = useState({});
  // 재무지표 캐시: { kisCode: { pbr, per, roe, evEbitda, roa, ... } }
  // - 기본값: KIS inquire-price에서 자동 추출 (PBR·PER·ROE — 소형주 포함)
  // - 보강: Yahoo Finance (EV/EBITDA·ROA·영업이익률·순이익률·부채비율)
  const [funds,      setFunds]      = useState({});
  const [naverLoading, setNaverLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [dartLoading,  setDartLoading]  = useState(false);
  const [fundLoading,  setFundLoading]  = useState(false); // Yahoo EV/EBITDA
  const [filter,     setFilter]     = useState(DEFAULT_FILTER);
  const [filterOpen, setFilterOpen] = useState(true);
  const [sortBy,     setSortBy]     = useState('marketCapEok');
  const [sortDir,    setSortDir]    = useState('desc');
  const [selected,   setSelected]   = useState(null);

  const loadedYahoo  = useRef(new Set());
  const loadedDart   = useRef(new Set());
  const loadedPrices = useRef(new Set());

  const group = KR_THEME_GROUPS.find(g => g.id === groupId) || KR_THEME_GROUPS[0];
  const theme = group.children.find(t => t.id === themeId) || group.children[0];

  // 그룹 변경 시 첫 번째 자식으로 리셋
  const handleGroupChange = (gid) => {
    const g = KR_THEME_GROUPS.find(x => x.id === gid);
    setGroupId(gid);
    if (g) setThemeId(g.children[0].id);
  };

  // 현재 테마의 종목 목록 결정
  const themeStocks = useMemo(() => {
    if (!theme) return [];
    if (theme.stocks) return theme.stocks.map(s => ({ ...s, _naverCode: toKisCode(s.code) }));
    if (theme.naverNo) return (naverStocks[theme.naverNo] || []).map(s => ({
      code: s.yahooSymbol || (s.code + '.KS'),
      name: s.name,
      _naverCode: s.code,
    }));
    return [];
  }, [theme, naverStocks]);

  // 네이버 업종 종목 로드
  useEffect(() => {
    if (!theme?.naverNo) return;
    const no = theme.naverNo;
    if (naverStocks[no] !== undefined) return;

    setNaverLoading(true);
    axios.get(`/api/kr-market/naver-sector/${no}`)
      .then(r => setNaverStocks(prev => ({ ...prev, [no]: r.data })))
      .catch(() => setNaverStocks(prev => ({ ...prev, [no]: [] })))
      .finally(() => setNaverLoading(false));
  }, [theme?.naverNo]);

  // KIS 시세 + 기본 재무지표 로드
  useEffect(() => {
    if (themeStocks.length === 0) return;

    const kisCodes = themeStocks.map(s => s._naverCode || toKisCode(s.code));
    const cacheKey = kisCodes.slice().sort().join(',');
    if (loadedPrices.current.has(cacheKey)) return;

    setPriceLoading(true);
    axios.post('/api/kr-market/theme-prices', { codes: kisCodes })
      .then(r => {
        setPrices(prev => ({ ...prev, ...r.data }));
        const kisFunds = {};
        Object.entries(r.data).forEach(([code, p]) => {
          if (!p) return;
          kisFunds[code] = {
            pbr: p.pbr ?? null,
            per: p.per ?? null,
            roe: p.roe ?? null,
            evEbitda: null, roa: null, operatingMargin: null,
            netMargin: null, debtToEquity: null,
            _source: 'KIS',
          };
        });
        setFunds(prev => ({ ...kisFunds, ...prev }));
        loadedPrices.current.add(cacheKey);
      })
      .catch(() => {})
      .finally(() => setPriceLoading(false));
  }, [themeStocks]);

  // DART 재무비율 자동 로드 (ROA·ROE·영업이익률·순이익률·부채비율 — 전종목 커버)
  useEffect(() => {
    if (themeStocks.length === 0) return;
    if (loadedDart.current.has(themeId)) return;

    const kisCodes = themeStocks.map(s => s._naverCode || toKisCode(s.code));
    setDartLoading(true);
    axios.post('/api/kr-market/dart-financials', { codes: kisCodes })
      .then(r => {
        setFunds(prev => {
          const next = { ...prev };
          Object.entries(r.data).forEach(([code, d]) => {
            if (!d) return;
            const ex = next[code] || {};
            next[code] = {
              ...ex,
              roe:             d.roe             ?? ex.roe             ?? null,
              roa:             d.roa             ?? ex.roa             ?? null,
              operatingMargin: d.operatingMargin ?? ex.operatingMargin ?? null,
              netMargin:       d.netMargin       ?? ex.netMargin       ?? null,
              debtToEquity:    d.debtToEquity    ?? ex.debtToEquity    ?? null,
              _source: ex._source ? ex._source.replace('KIS', 'KIS+DART') : 'DART',
            };
          });
          return next;
        });
        loadedDart.current.add(themeId);
      })
      .catch(() => {})
      .finally(() => setDartLoading(false));
  }, [themeId, themeStocks]);

  // Yahoo: EV/EBITDA·섹터 정보 자동 보강 (대형주 위주, 소형주는 DART로 충분)
  useEffect(() => {
    if (themeStocks.length === 0) return;
    if (loadedYahoo.current.has(themeId)) return;

    const symbols = themeStocks.map(s => s.code);
    const batches = [];
    for (let i = 0; i < symbols.length; i += 45) batches.push(symbols.slice(i, i + 45));

    setFundLoading(true);
    Promise.all(batches.map(b =>
      axios.post('/api/kr-market/fundamentals', { symbols: b }).then(r => r.data).catch(() => ({}))
    ))
      .then(results => {
        const merged = Object.assign({}, ...results);
        setFunds(prev => {
          const next = { ...prev };
          Object.entries(merged).forEach(([sym, yf]) => {
            if (!yf) return;
            const code = toKisCode(sym);
            const ex = next[code] || {};
            next[code] = {
              ...ex,
              // Yahoo 값 우선, 없으면 기존(KIS·DART) 유지
              pbr:             yf.pbr             ?? ex.pbr             ?? null,
              per:             yf.per             ?? ex.per             ?? null,
              roe:             yf.roe             ?? ex.roe             ?? null,
              evEbitda:        yf.evEbitda        ?? ex.evEbitda        ?? null,
              roa:             yf.roa             ?? ex.roa             ?? null,
              operatingMargin: yf.operatingMargin ?? ex.operatingMargin ?? null,
              netMargin:       yf.netMargin       ?? ex.netMargin       ?? null,
              debtToEquity:    yf.debtToEquity    ?? ex.debtToEquity    ?? null,
              industry:        yf.industry        ?? ex.industry        ?? null,
              sector:          yf.sector          ?? ex.sector          ?? null,
              _source: 'Yahoo+KIS+DART',
            };
          });
          return next;
        });
        loadedYahoo.current.add(themeId);
      })
      .catch(() => {})
      .finally(() => setFundLoading(false));
  }, [themeId, themeStocks]);

  // 수동 재로드 (Yahoo EV/EBITDA 재시도)
  const loadYahooEnrich = () => {
    if (fundLoading || themeStocks.length === 0) return;
    loadedYahoo.current.delete(themeId);
    const symbols = themeStocks.map(s => s.code);
    const batches = [];
    for (let i = 0; i < symbols.length; i += 45) batches.push(symbols.slice(i, i + 45));
    setFundLoading(true);
    Promise.all(batches.map(b =>
      axios.post('/api/kr-market/fundamentals', { symbols: b }).then(r => r.data).catch(() => ({}))
    ))
      .then(results => {
        const merged = Object.assign({}, ...results);
        setFunds(prev => {
          const next = { ...prev };
          Object.entries(merged).forEach(([sym, yf]) => {
            if (!yf) return;
            const code = toKisCode(sym);
            const ex = next[code] || {};
            next[code] = { ...ex,
              pbr: yf.pbr ?? ex.pbr ?? null, per: yf.per ?? ex.per ?? null,
              roe: yf.roe ?? ex.roe ?? null, evEbitda: yf.evEbitda ?? ex.evEbitda ?? null,
              roa: yf.roa ?? ex.roa ?? null, operatingMargin: yf.operatingMargin ?? ex.operatingMargin ?? null,
              netMargin: yf.netMargin ?? ex.netMargin ?? null, debtToEquity: yf.debtToEquity ?? ex.debtToEquity ?? null,
              industry: yf.industry ?? ex.industry ?? null, sector: yf.sector ?? ex.sector ?? null,
              _source: 'Yahoo+KIS+DART',
            };
          });
          return next;
        });
        loadedYahoo.current.add(themeId);
      })
      .finally(() => setFundLoading(false));
  };

  const setF = (key, val) => setFilter(prev => ({ ...prev, [key]: val }));

  const handleSort = col => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  // 행 데이터 합성
  const rows = useMemo(() => {
    return themeStocks
      .map(s => {
        const kisCode = s._naverCode || toKisCode(s.code);
        const p = prices[kisCode] || {};
        const f = funds[kisCode] || null;   // kisCode 기준으로 통일
        const score = calcUndervalScore(f);
        return { ...s, kisCode, price: p.price, dayChangePct: p.dayChangePct, marketCapEok: p.marketCapEok, fund: f, score };
      })
      .filter(r => {
        if (filter.undervalOnly && r.score < 1) return false;
        if (filter.minScore > 0 && r.score < filter.minScore) return false;
        const f = r.fund;
        if (!f) return true;
        if (filter.pbrMax      !== '' && f.pbr      != null && f.pbr      > +filter.pbrMax)      return false;
        if (filter.perMin      !== '' && f.per      != null && f.per      < +filter.perMin)      return false;
        if (filter.perMax      !== '' && f.per      != null && f.per      > +filter.perMax)      return false;
        if (filter.evEbitdaMax !== '' && f.evEbitda != null && f.evEbitda > +filter.evEbitdaMax) return false;
        if (filter.roeMin      !== '' && f.roe      != null && f.roe      < +filter.roeMin)      return false;
        if (filter.roaMin      !== '' && f.roa      != null && f.roa      < +filter.roaMin)      return false;
        return true;
      })
      .sort((a, b) => {
        const getVal = r => {
          if (sortBy === 'score')        return r.score;
          if (sortBy === 'price')        return r.price;
          if (sortBy === 'dayChangePct') return r.dayChangePct;
          if (sortBy === 'marketCapEok') return r.marketCapEok;
          return r.fund?.[sortBy];
        };
        let av = getVal(a), bv = getVal(b);
        if (av == null) av = sortDir === 'asc' ?  Infinity : -Infinity;
        if (bv == null) bv = sortDir === 'asc' ?  Infinity : -Infinity;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
  }, [themeStocks, prices, funds, filter, sortBy, sortDir, theme]);

  // 재무지표 출처 요약
  const fundSourceSummary = useMemo(() => {
    if (themeStocks.length === 0) return null;
    let full = 0, partial = 0, none = 0;
    themeStocks.forEach(s => {
      const code = s._naverCode || toKisCode(s.code);
      const f = funds[code];
      if (!f) { none++; }
      else if (f._source?.includes('DART') || f._source?.includes('Yahoo')) full++;
      else partial++;
    });
    return { full, partial, none };
  }, [themeStocks, funds]);

  const ThSort = ({ col, label, hint }) => (
    <th
      onClick={() => handleSort(col)}
      className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap cursor-pointer hover:text-gray-300 select-none text-xs"
    >
      <span className={hint ? 'border-b border-dashed border-gray-700 cursor-help' : ''} title={hint}>{label}</span>
      {sortBy === col && <span className="ml-1 text-brand-blue">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );

  const isLoading = naverLoading || priceLoading || dartLoading || fundLoading;
  const yahooLoaded = loadedYahoo.current.has(themeId);

  return (
    <div className="flex flex-col">

      {/* ── 셀렉터 바 ── */}
      <div className="px-4 py-3 border-b border-surface-border flex items-center gap-3 flex-wrap bg-surface-raised/30">
        {/* 대그룹 드롭다운 */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-600">그룹</span>
          <select
            value={groupId}
            onChange={e => handleGroupChange(e.target.value)}
            className="bg-surface-raised border border-surface-border rounded px-2.5 py-1.5 text-sm text-gray-200 font-semibold cursor-pointer min-w-[140px]"
          >
            {KR_THEME_GROUPS.map(g => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </div>

        {/* 서브테마 드롭다운 */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-600">테마 / 업종</span>
          <select
            value={themeId}
            onChange={e => setThemeId(e.target.value)}
            className="bg-surface-raised border border-surface-border rounded px-2.5 py-1.5 text-sm text-gray-200 cursor-pointer min-w-[200px]"
          >
            {group.children.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* 설명 */}
        <div className="flex flex-col gap-0.5 ml-2">
          <span className="text-xs text-gray-600">&nbsp;</span>
          <span className="text-xs text-gray-400">{theme?.desc}</span>
        </div>

        {/* 로딩 상태 */}
        <div className="ml-auto flex items-center gap-3 text-xs">
          {naverLoading  && <span className="text-gray-500 flex items-center gap-1"><LoadingSpinner size="sm" />업종 종목</span>}
          {priceLoading  && <span className="text-brand-blue flex items-center gap-1"><LoadingSpinner size="sm" />KIS 시세</span>}
          {dartLoading   && <span className="text-green-500 flex items-center gap-1"><LoadingSpinner size="sm" />DART 재무</span>}
          {fundLoading   && <span className="text-yellow-500 flex items-center gap-1"><LoadingSpinner size="sm" />Yahoo EV</span>}
          {!isLoading && rows.length > 0 && (
            <span className="text-gray-600">
              <b className="text-gray-300">{rows.length}</b>/{themeStocks.length}종목
            </span>
          )}
          <button
            onClick={() => setFilterOpen(o => !o)}
            className="text-gray-500 hover:text-gray-300 flex items-center gap-1 px-2 py-1 rounded border border-surface-border"
          >
            필터 {filterOpen ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* ── 필터 패널 ── */}
      {filterOpen && (
        <div className="px-4 py-3 border-b border-surface-border">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={filter.undervalOnly}
                  onChange={e => setF('undervalOnly', e.target.checked)} className="accent-brand-blue" />
                <span className="text-gray-300 font-semibold">저평가만</span>
              </label>
              <span className="text-gray-600">최소</span>
              <select value={filter.minScore} onChange={e => setF('minScore', +e.target.value)}
                className="bg-surface-raised border border-surface-border rounded px-1.5 py-0.5 text-gray-200 text-xs">
                {[0,1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}점↑</option>)}
              </select>
            </div>
            <div className="w-px h-4 bg-surface-border" />
            <FI label="PBR≤"       v={filter.pbrMax}      s={v=>setF('pbrMax',v)}      ph="1.5" />
            <div className="flex items-center gap-1">
              <span className="text-gray-500">PER</span>
              <FI v={filter.perMin} s={v=>setF('perMin',v)} ph="최소" w="w-14"/>
              <span className="text-gray-600">~</span>
              <FI v={filter.perMax} s={v=>setF('perMax',v)} ph="최대" w="w-14"/>
            </div>
            <FI label="EV/EBITDA≤" v={filter.evEbitdaMax} s={v=>setF('evEbitdaMax',v)} ph="12" />
            <FI label="ROE≥"       v={filter.roeMin}      s={v=>setF('roeMin',v)}      ph="10" u="%"/>
            <FI label="ROA≥"       v={filter.roaMin}      s={v=>setF('roaMin',v)}      ph="5"  u="%"/>
            <button onClick={() => setFilter(DEFAULT_FILTER)} className="text-xs text-gray-600 hover:text-gray-300 ml-auto">초기화</button>
          </div>
        </div>
      )}

      {/* ── 재무지표 상태바 (naverNo 테마에서 Yahoo 보강 버튼 표시) ── */}
      {themeStocks.length > 0 && fundSourceSummary && (
        <div className="px-4 py-2 border-b border-surface-border flex items-center gap-3 flex-wrap text-xs">
          {/* 재무지표 출처 요약 */}
          <div className="flex items-center gap-2 text-gray-500">
            <span>재무지표:</span>
            {fundSourceSummary.full > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-green-900/20 text-green-400 border border-green-800/30">
                완전 {fundSourceSummary.full}종목
              </span>
            )}
            {fundSourceSummary.partial > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                KIS만 {fundSourceSummary.partial}종목
              </span>
            )}
            {fundSourceSummary.none > 0 && (
              <span className="text-gray-700">{fundSourceSummary.none}종목 대기중</span>
            )}
          </div>
          {/* Yahoo 재로드 버튼 (로드 완료 후에만 표시) */}
          {yahooLoaded && !fundLoading && (
            <button
              onClick={loadYahooEnrich}
              className="ml-auto text-xs px-3 py-1.5 bg-yellow-900/20 hover:bg-yellow-900/40 text-yellow-400 rounded border border-yellow-800/30 transition-colors flex items-center gap-1.5"
            >
              Yahoo 재로드
            </button>
          )}
        </div>
      )}

      {/* ── 테이블 ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-border bg-surface-raised">
              <th className="px-3 py-2 text-left text-gray-500 font-medium text-xs whitespace-nowrap">종목</th>
              <ThSort col="price"        label="현재가(KIS)"  />
              <ThSort col="dayChangePct" label="등락률"       />
              <ThSort col="marketCapEok" label="시총(억)"     />
              <ThSort col="score"        label="저평가점수" hint="PBR·PER·EV/EBITDA·ROE·ROA 기준 0~9점" />
              <th className="px-2 py-2 text-center text-gray-600 font-medium text-xs whitespace-nowrap border-l border-surface-border" colSpan={FUND_COLS.length}>
                재무 지표
              </th>
            </tr>
            <tr className="border-b border-surface-border bg-surface-raised">
              {Array(5).fill(null).map((_, i) => <th key={i} />)}
              {FUND_COLS.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)}
                  className="px-2 py-1 text-center text-gray-600 font-medium whitespace-nowrap cursor-pointer hover:text-gray-300 border-l first:border-l-surface-border text-xs">
                  <span className="border-b border-dashed border-gray-700" title={col.hint}>{col.label}</span>
                  {sortBy === col.key && <span className="ml-1 text-brand-blue">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(naverLoading || (themeStocks.length === 0 && isLoading)) && (
              <tr><td colSpan={5 + FUND_COLS.length} className="px-4 py-8 text-center">
                <div className="flex justify-center"><LoadingSpinner text="종목 목록 로딩 중..." /></div>
              </td></tr>
            )}
            {!naverLoading && rows.length === 0 && themeStocks.length > 0 && (
              <tr><td colSpan={5 + FUND_COLS.length} className="px-4 py-6 text-center text-sm text-gray-600">
                조건에 해당하는 종목이 없습니다.
              </td></tr>
            )}
            {rows.map(r => {
              const f      = r.fund;
              const isUp   = (r.dayChangePct ?? 0) > 0;
              const isDown = (r.dayChangePct ?? 0) < 0;
              const dpCls  = isUp ? 'text-brand-green' : isDown ? 'text-brand-red' : 'text-gray-400';
              const mkt    = r.code?.endsWith('.KS') ? 'KOSPI' : 'KOSDAQ';
              const srcCls = f?._source?.includes('Yahoo')
                ? 'text-yellow-600'
                : f?._source === 'KIS'
                  ? 'text-brand-blue/50'
                  : '';

              return (
                <tr key={r.kisCode || r.code} className="data-row cursor-pointer" onClick={() => {
                  setSelected(r.code || (r.kisCode + '.KS'));
                }}>
                  {/* 종목명 */}
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-gray-200">{r.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-gray-600 font-mono">{r.kisCode}</span>
                      <span className={`text-xs px-1 rounded font-mono ${
                        mkt === 'KOSPI' ? 'bg-brand-blue/10 text-brand-blue' : 'bg-brand-green/10 text-brand-green'
                      }`}>{mkt}</span>
                      {f?._source && (
                        <span className={`text-xs ${srcCls}`} title={`재무출처: ${f._source}`}>
                          {f._source?.includes('Yahoo') ? '●' : '◦'}
                        </span>
                      )}
                    </div>
                    {f?.industry && <div className="text-gray-700 mt-0.5 truncate max-w-[140px]">{f.industry}</div>}
                  </td>

                  {/* 현재가 (KIS) */}
                  <td className="px-3 py-2.5 font-mono text-gray-200">
                    {r.price != null ? `₩${r.price.toLocaleString('ko-KR')}` : <span className="text-gray-700">{priceLoading ? '…' : '—'}</span>}
                  </td>

                  {/* 등락률 */}
                  <td className={`px-3 py-2.5 font-mono ${dpCls}`}>
                    {r.dayChangePct != null ? `${isUp?'+':''}${r.dayChangePct.toFixed(2)}%` : <span className="text-gray-700">{priceLoading ? '…' : '—'}</span>}
                  </td>

                  {/* 시총 */}
                  <td className="px-3 py-2.5 font-mono text-gray-400">
                    {r.marketCapEok != null ? `${r.marketCapEok.toLocaleString()}억` : '—'}
                  </td>

                  {/* 저평가 점수 */}
                  <td className="px-3 py-2.5 text-center">
                    {f ? (
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border ${scoreColorCls(r.score)}`}>{r.score}</span>
                    ) : (
                      <span className="text-gray-700 text-xs">{priceLoading ? '…' : '—'}</span>
                    )}
                  </td>

                  {/* 재무 지표 */}
                  {FUND_COLS.map(col => (
                    (priceLoading || fundLoading) && !f
                      ? <td key={col.key} className="px-2 py-2.5 text-center text-gray-700 text-xs">…</td>
                      : <FundamentalBadge key={col.key} metricKey={col.key} value={f?.[col.key] ?? null} sector={f?.sector ?? null} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 하단 범례 */}
      <div className="px-4 py-2 border-t border-surface-border flex items-center gap-3 flex-wrap text-xs text-gray-700">
        <span className="text-gray-500 font-medium">저평가 점수</span>
        <span>PBR&lt;1.0 +2/&lt;1.5 +1</span>·
        <span>PER&lt;10 +2/&lt;15 +1</span>·
        <span>EV/EBITDA&lt;8 +2/&lt;12 +1</span>·
        <span>ROE&gt;20% +2/&gt;10% +1</span>·
        <span>ROA&gt;5% +1</span>
        <span className="ml-auto">
          <span className="text-brand-blue/60">KIS</span> PBR·PER·ROE·
          <span className="text-green-600">DART</span> ROA·마진·부채비율·
          <span className="text-yellow-600">Yahoo</span> EV/EBITDA
        </span>
      </div>

      {selected && (
        <StockDetailModal symbol={selected} isKorean onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// 필터 입력 컴포넌트
function FI({ label, v, s, ph, u, w = 'w-16' }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {label && <span className="text-gray-500 whitespace-nowrap">{label}</span>}
      <input type="number" value={v} onChange={e => s(e.target.value)} placeholder={ph}
        className={`${w} bg-surface-raised border border-surface-border rounded px-1.5 py-0.5 text-gray-200 text-xs placeholder-gray-700`} />
      {u && <span className="text-gray-600">{u}</span>}
    </div>
  );
}
