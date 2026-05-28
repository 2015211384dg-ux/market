import { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import { LoadingSpinner } from './LoadingSpinner';

// ── 기법 메타 ─────────────────────────────────────────────────────────────────
const METHOD_META = {
  babgeunset: {
    label:           '밥그릇 3번자리',
    badgeCls:        'text-brand-blue border-brand-blue/30 bg-brand-blue/10',
    borderCls:       'border-brand-blue/20',
    headerCls:       'bg-brand-blue/5',
    countCls:        'text-brand-blue',
    tabActiveCls:    'border-brand-blue text-brand-blue',
    resultBorderCls: 'border-brand-blue/30',
    resultBgCls:     'bg-brand-blue/5 hover:bg-brand-blue/10',
    desc:            '1·2년선 이격도 내 + 장기선 돌파 + 구름대 돌파 + 주봉 CCI -100 탈출',
  },
  yeokmaegong: {
    label:           '역매공파 112',
    badgeCls:        'text-brand-purple border-brand-purple/30 bg-brand-purple/10',
    borderCls:       'border-brand-purple/20',
    headerCls:       'bg-brand-purple/5',
    countCls:        'text-brand-purple',
    tabActiveCls:    'border-brand-purple text-brand-purple',
    resultBorderCls: 'border-brand-purple/30',
    resultBgCls:     'bg-brand-purple/5 hover:bg-brand-purple/10',
    desc:            '장기 역배열 저평가 + 단기 정배열 전환 + 매집봉 + 공구리 수렴',
  },
  jijunbong: {
    label:           '기준봉/눌림목',
    badgeCls:        'text-brand-yellow border-brand-yellow/30 bg-brand-yellow/10',
    borderCls:       'border-brand-yellow/20',
    headerCls:       'bg-brand-yellow/5',
    countCls:        'text-brand-yellow',
    tabActiveCls:    'border-brand-yellow text-brand-yellow',
    resultBorderCls: 'border-brand-yellow/30',
    resultBgCls:     'bg-brand-yellow/5 hover:bg-brand-yellow/10',
    desc:            '224일선 돌파 기준봉 후 -5%∼-15% 눌림목 구간',
  },
  dead: {
    label:           '데드기법',
    badgeCls:        'text-brand-green border-brand-green/30 bg-brand-green/10',
    borderCls:       'border-brand-green/20',
    headerCls:       'bg-brand-green/5',
    countCls:        'text-brand-green',
    tabActiveCls:    'border-brand-green text-brand-green',
    resultBorderCls: 'border-brand-green/30',
    resultBgCls:     'bg-brand-green/5 hover:bg-brand-green/10',
    desc:            'EMA 112·224·448일선 부채꼴 → 닫히는 과정에서 각 선 첫 접촉 시 반등 공략',
  },
  diving: {
    label:           '다이빙기법',
    badgeCls:        'text-brand-red border-brand-red/30 bg-brand-red/10',
    borderCls:       'border-brand-red/20',
    headerCls:       'bg-brand-red/5',
    countCls:        'text-brand-red',
    tabActiveCls:    'border-brand-red text-brand-red',
    resultBorderCls: 'border-brand-red/30',
    resultBgCls:     'bg-brand-red/5 hover:bg-brand-red/10',
    desc:            '강력 급등(30%+) 후 외봉 급락 → 15·33일선 근접 시 기술적 반등 공략',
  },
};

// ── 기본 조건값 ───────────────────────────────────────────────────────────────
const DEFAULT_COMMON = { minVolume: 50000, minTurnoverEok: 5 };

const DEFAULT_CONDITIONS = {
  babgeunset: {
    ma224Deviation: true,  ma448Deviation: false,
    ma224DevMin: -2,  ma224DevMax: 5,
    ma448DevMin: -2,  ma448DevMax: 5,
    maBreakN: true,        maBreakBars: 15,
    ichimokuBreak: true,   ichimokuBreakBars: 15,
    weeklyCCI: true,       weeklyCCIBars: 3,
    bbBreak: true,         bbPeriod: 33,  bbBreakBars: 15,
    turnover100Eok: true,
    newHighVolume: true,
    volumeSpike500: false, volumeSpikeBars: 10,
  },
  yeokmaegong: {
    reverseAlignment: true,
    shortTermBull: true,
    accumBar: true,  accumBarBars: 60, accumBarPct: 300,
    consolidation: true, consolMinBars: 20, consolMaxRange: 10,
    bbConverge: true,
    ma112Near: true, ma112NearMin: -3, ma112NearMax: 2,
    aboveMa60: true,
  },
  jijunbong: {
    ma224Breakout: true, ma224BreakBars: 30,
    pullback: true, pullbackMin: 5, pullbackMax: 15,
    reversalCandle: false, reversalBars: 10,
  },
  dead: {
    surgePctCheck: true,  surgePctMin: 50,
    fannedCheck:   true,  fanSpreadMin: 5,
    maxTouches:    1,
    nearEma112:    true,  ema112Min: -5, ema112Max: 10,
    nearEma224:    true,  ema224Min: -5, ema224Max: 10,
    nearEma448:    false, ema448Min: -5, ema448Max: 10,
  },
  diving: {
    surgePctCheck: true,  surgePctMin: 30,
    surgeVolCheck: true,  surgeVolRatioMin: 2,
    belowMa224:    true,
    singlePeak:    true,
    dropCheck:     true,  dropMin: 5,  dropMax: 45,
    nearMa15:      true,  ma15NearMin: -5, ma15NearMax: 15,
    nearMa33:      true,  ma33NearMin: -5, ma33NearMax: 20,
    fibCheck:      true,  fibMin: 38.2, fibMax: 78.6,
    wave1Rule:     true,
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// 클라이언트 조건 필터 — 백엔드 apply*Conditions 와 동일한 로직
// ═════════════════════════════════════════════════════════════════════════════

function filterBabgeunset(ind, cond) {
  if (!ind) return false;
  const {
    ma224Deviation = true,  ma448Deviation = false,
    ma224DevMin = -2,       ma224DevMax = 5,
    ma448DevMin = -2,       ma448DevMax = 5,
    maBreakN = true,        maBreakBars = 15,
    ichimokuBreak = true,   ichimokuBreakBars = 15,
    weeklyCCI = true,       weeklyCCIBars = 3,
    bbBreak = true,         bbPeriod = 33,  bbBreakBars = 15,
    turnover100Eok = true,
    newHighVolume = true,
    volumeSpike500 = false,
  } = cond;

  if (ma224Deviation || ma448Deviation) {
    let ok = false;
    if (ma224Deviation && ind.dev224 != null && ind.dev224 >= ma224DevMin && ind.dev224 <= ma224DevMax) ok = true;
    if (ma448Deviation && ind.dev448 != null && ind.dev448 >= ma448DevMin && ind.dev448 <= ma448DevMax) ok = true;
    if (!ok) return false;
  }
  if (maBreakN) {
    const ok = (ind.maCrossUpBarsAgo224 && ind.maCrossUpBarsAgo224 <= maBreakBars) ||
               (ind.maCrossUpBarsAgo448 && ind.maCrossUpBarsAgo448 <= maBreakBars);
    if (!ok) return false;
  }
  if (ichimokuBreak && (!ind.ichimokuBreakBarsAgo || ind.ichimokuBreakBarsAgo > ichimokuBreakBars)) return false;
  if (weeklyCCI     && (!ind.cciCrossBarsAgo      || ind.cciCrossBarsAgo > weeklyCCIBars))          return false;
  if (bbBreak) {
    const a = bbPeriod === 41 ? ind.bbBreakBarsAgo41 : ind.bbBreakBarsAgo33;
    const b = bbPeriod === 41 ? ind.bbBreakBarsAgo33 : ind.bbBreakBarsAgo41;
    if (!(a && a <= bbBreakBars) && !(b && b <= bbBreakBars)) return false;
  }
  if (turnover100Eok && ind.maxTurnover15 < 100) return false;
  if (newHighVolume  && !ind.newHighVol) return false;
  if (volumeSpike500 && !ind.hasVolumeSpike10) return false;
  return true;
}

function filterYeokmaegong(ind, cond) {
  if (!ind) return false;
  const {
    reverseAlignment = true, shortTermBull = true,
    accumBar = true, consolidation = true, bbConverge = true,
    ma112Near = true, ma112NearMin = -3, ma112NearMax = 2,
    aboveMa60 = true,
  } = cond;

  if (reverseAlignment  && !ind.isReverseAlign)   return false;
  if (shortTermBull) {
    if (!ind.isShortTermBull) return false;
    if (aboveMa60 && !ind.isAboveMa60) return false;
  }
  if (accumBar      && !ind.hasAccum)     return false;
  if (consolidation && !ind.hasConsol)    return false;
  if (bbConverge    && !ind.bbConverging) return false;
  if (ma112Near && ind.dev112 != null &&
      (ind.dev112 < ma112NearMin || ind.dev112 > ma112NearMax)) return false;
  return true;
}

function filterJijunbong(ind, cond) {
  if (!ind) return false;
  const {
    ma224Breakout = true, ma224BreakBars = 30,
    pullback = true, pullbackMin = 5, pullbackMax = 15,
    reversalCandle = false, reversalBars = 10,
  } = cond;

  if (ma224Breakout) {
    if (!ind.ma224BreakBarsAgo || ind.ma224BreakBarsAgo > ma224BreakBars) return false;
    if (!ind.ma224BreakIsValid) return false;
  }
  if (pullback && (ind.pullbackPct < pullbackMin || ind.pullbackPct > pullbackMax)) return false;
  if (reversalCandle) {
    if (!(reversalBars <= 10 ? ind.hasReversal10 : ind.hasReversal30)) return false;
  }
  return true;
}

function filterDiving(ind, cond) {
  if (!ind) return false;
  const {
    surgePctCheck = true,   surgePctMin = 30,
    surgeVolCheck = true,   surgeVolRatioMin = 2,
    belowMa224    = true,
    singlePeak    = true,
    dropCheck     = true,   dropMin = 5,   dropMax = 45,
    nearMa15      = true,   ma15NearMin = -5, ma15NearMax = 15,
    nearMa33      = true,   ma33NearMin = -5, ma33NearMax = 20,
    fibCheck      = true,   fibMin = 38.2, fibMax = 78.6,
    wave1Rule     = true,
  } = cond;

  if (surgePctCheck && ind.surgePct < surgePctMin)           return false;
  if (surgeVolCheck && ind.surgeVolRatio < surgeVolRatioMin) return false;
  if (belowMa224    && !ind.belowMa224In60)                  return false;
  if (singlePeak    && !ind.isSinglePeak)                    return false;
  if (dropCheck) {
    if (ind.dropFromPeak > -dropMin || ind.dropFromPeak < -dropMax) return false;
  }
  if (fibCheck && (ind.retracePct < fibMin || ind.retracePct > fibMax)) return false;
  if (wave1Rule && !ind.wave1StartOk) return false;
  if (nearMa15 || nearMa33) {
    let ok = false;
    if (nearMa15 && ind.dev15 != null && ind.dev15 >= ma15NearMin && ind.dev15 <= ma15NearMax) ok = true;
    if (nearMa33 && ind.dev33 != null && ind.dev33 >= ma33NearMin && ind.dev33 <= ma33NearMax) ok = true;
    if (!ok) return false;
  }
  return true;
}

function filterDead(ind, cond) {
  if (!ind) return false;
  const {
    surgePctCheck = true, surgePctMin = 50,
    fannedCheck = true, fanSpreadMin = 5,
    maxTouches = 1,
    nearEma112 = true, ema112Min = -5, ema112Max = 10,
    nearEma224 = true, ema224Min = -5, ema224Max = 10,
    nearEma448 = false, ema448Min = -5, ema448Max = 10,
  } = cond;
  if (surgePctCheck && ind.surgePct < surgePctMin) return false;
  if (fannedCheck) {
    if (!ind.isFanned) return false;
    if (ind.fanSpreadPct < fanSpreadMin) return false;
  }
  if (nearEma112 || nearEma224 || nearEma448) {
    let ok = false;
    if (nearEma112 && ind.devEma112 != null && ind.devEma112 >= ema112Min && ind.devEma112 <= ema112Max && ind.touchCount112 <= maxTouches) ok = true;
    if (nearEma224 && ind.devEma224 != null && ind.devEma224 >= ema224Min && ind.devEma224 <= ema224Max && ind.touchCount224 <= maxTouches) ok = true;
    if (nearEma448 && ind.devEma448 != null && ind.devEma448 >= ema448Min && ind.devEma448 <= ema448Max && ind.touchCount448 <= maxTouches) ok = true;
    if (!ok) return false;
  }
  return true;
}

// ── 지표 → 결과 행 변환 ───────────────────────────────────────────────────────
function baseOf(s) {
  return {
    code: s.code, name: s.name, market: s.market,
    sector: s.sector, marketCapEok: s.marketCapEok,
    close: s.close, dayChange: s.dayChange,
    volume: s.volume, turnoverEok: s.turnoverEok,
  };
}

function toBabgeunsetRow(s, cond) {
  const ind = s.babgeunset;
  const bbPeriod = cond?.bbPeriod || 33;
  const bbBreakBarsAgo = bbPeriod === 41
    ? (ind.bbBreakBarsAgo41 || ind.bbBreakBarsAgo33)
    : (ind.bbBreakBarsAgo33 || ind.bbBreakBarsAgo41);
  return {
    ...baseOf(s),
    method: 'babgeunset', methodLabel: '밥그릇 3번자리',
    dev224: ind.dev224, dev448: ind.dev448,
    ichimokuBreakBarsAgo: ind.ichimokuBreakBarsAgo,
    cciCrossBarsAgo: ind.cciCrossBarsAgo,
    bbBreakBarsAgo,
    maxTurnover15: ind.maxTurnover15,
    newHighVol: ind.newHighVol,
  };
}

function toYeokmaegongRow(s) {
  const ind = s.yeokmaegong;
  return {
    ...baseOf(s),
    method: 'yeokmaegong', methodLabel: '역매공파 112',
    dev112: ind.dev112,
    reverseAlign: `${ind.ma448} > ${ind.ma224} > ${ind.ma112} > ${ind.closeRound}`,
    hasAccum: ind.hasAccum, hasConsol: ind.hasConsol, bbConverging: ind.bbConverging,
  };
}

function toJijunbongRow(s) {
  const ind = s.jijunbong;
  return {
    ...baseOf(s),
    method: 'jijunbong', methodLabel: '기준봉/눌림목',
    ma224: ind.ma224, dev224: ind.dev224,
    ma224BreakN: ind.ma224BreakBarsAgo,
    pullbackPct: ind.pullbackPct,
    hasReversal: ind.hasReversal10,
  };
}

function toDivingRow(s) {
  const ind = s.diving;
  return {
    ...baseOf(s),
    method: 'diving', methodLabel: '다이빙기법',
    surgePct:      ind.surgePct,
    retracePct:    ind.retracePct,
    dropFromPeak:  ind.dropFromPeak,
    dev15:         ind.dev15,
    dev33:         ind.dev33,
    isSinglePeak:  ind.isSinglePeak,
    surgeVolRatio: ind.surgeVolRatio,
  };
}

function toDeadRow(s) {
  const ind = s.dead;
  return {
    ...baseOf(s),
    method: 'dead', methodLabel: '데드기법',
    surgePct:      ind.surgePct,
    isFanned:      ind.isFanned,
    fanSpreadPct:  ind.fanSpreadPct,
    devEma112:     ind.devEma112,
    devEma224:     ind.devEma224,
    devEma448:     ind.devEma448,
    touchCount112: ind.touchCount112,
    touchCount224: ind.touchCount224,
    touchCount448: ind.touchCount448,
  };
}

// ── 날짜 포맷 ─────────────────────────────────────────────────────────────────
function fmtTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} 기준`;
}

// ═════════════════════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ═════════════════════════════════════════════════════════════════════════════
export function KisScreener() {
  const [commonFilters,  setCommonFilters]  = useState(DEFAULT_COMMON);
  const [conditions,     setConditions]     = useState(DEFAULT_CONDITIONS);
  const [activeMethod,   setActiveMethod]   = useState('babgeunset');
  const [selectedStock,  setSelectedStock]  = useState(null);

  // 지표 원시 데이터 (서버에서 1회 로드, 이후 클라이언트에서 필터)
  const [indicators,    setIndicators]    = useState(null);   // array
  const [indMeta,       setIndMeta]       = useState(null);   // { timestamp, universe, screened }
  const [loadingInd,    setLoadingInd]    = useState(true);
  const [indPending,    setIndPending]    = useState(false);
  const [updating,      setUpdating]      = useState(false);
  const [updateMsg,     setUpdateMsg]     = useState(null);
  const pollTimerRef = useRef(null);

  // 지표 데이터 로드
  useEffect(() => {
    setLoadingInd(true);
    axios.get('/api/kis-screener/indicators')
      .then(res => {
        const d = res.data;
        if (d.pending) {
          setIndPending(true);
        } else {
          setIndicators(d.data);
          setIndMeta({ timestamp: d.timestamp, universe: d.universe, screened: d.screened });
        }
      })
      .catch(() => setIndPending(true))
      .finally(() => setLoadingInd(false));
  }, []);

  // 수동 업데이트 — POST /run → 폴링으로 완료 감지
  const runUpdate = () => {
    if (updating) return;
    setUpdating(true);
    setUpdateMsg('업데이트 요청 중...');

    const prevTs = indMeta?.timestamp;

    axios.post('/api/kis-screener/run', { force: true })
      .then(() => {
        setUpdateMsg('전 종목 지표 계산 중 (약 5분 소요)...');

        let elapsed = 0;
        const INTERVAL = 15000;
        const MAX_WAIT  = 10 * 60 * 1000;

        const poll = () => {
          axios.get('/api/kis-screener/indicators')
            .then(res => {
              const d = res.data;
              if (!d.pending && d.timestamp && d.timestamp !== prevTs) {
                setIndicators(d.data);
                setIndMeta({ timestamp: d.timestamp, universe: d.universe, screened: d.screened });
                setIndPending(false);
                setUpdateMsg(null);
                setUpdating(false);
                return;
              }
              elapsed += INTERVAL;
              if (elapsed >= MAX_WAIT) {
                setUpdateMsg('업데이트 타임아웃. 나중에 다시 확인하세요.');
                setUpdating(false);
                return;
              }
              pollTimerRef.current = setTimeout(poll, INTERVAL);
            })
            .catch(() => {
              elapsed += INTERVAL;
              if (elapsed >= MAX_WAIT) {
                setUpdateMsg('업데이트 확인 실패.');
                setUpdating(false);
                return;
              }
              pollTimerRef.current = setTimeout(poll, INTERVAL);
            });
        };
        pollTimerRef.current = setTimeout(poll, INTERVAL);
      })
      .catch(() => {
        setUpdateMsg('업데이트 요청 실패.');
        setUpdating(false);
      });
  };

  useEffect(() => () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); }, []);

  const updateCondition = (method, key, value) =>
    setConditions(prev => ({ ...prev, [method]: { ...prev[method], [key]: value } }));

  const updateCommon = (key, value) =>
    setCommonFilters(prev => ({ ...prev, [key]: value }));

  // ── 클라이언트 실시간 필터 ─────────────────────────────────────────────────
  const results = useMemo(() => {
    if (!indicators) return null;

    const { minVolume = 50000, minTurnoverEok = 5 } = commonFilters;

    const pass = s =>
      s.avgVol20         >= minVolume &&
      s.avgTurnoverEok20 >= minTurnoverEok;

    return {
      babgeunset: indicators
        .filter(s => pass(s) && filterBabgeunset(s.babgeunset, conditions.babgeunset))
        .map(s => toBabgeunsetRow(s, conditions.babgeunset))
        .sort((a, b) => (b.marketCapEok || 0) - (a.marketCapEok || 0)),

      yeokmaegong: indicators
        .filter(s => pass(s) && filterYeokmaegong(s.yeokmaegong, conditions.yeokmaegong))
        .map(s => toYeokmaegongRow(s))
        .sort((a, b) => (b.marketCapEok || 0) - (a.marketCapEok || 0)),

      jijunbong: indicators
        .filter(s => pass(s) && filterJijunbong(s.jijunbong, conditions.jijunbong))
        .map(s => toJijunbongRow(s))
        .sort((a, b) => (b.marketCapEok || 0) - (a.marketCapEok || 0)),

      diving: indicators
        .filter(s => pass(s) && filterDiving(s.diving, conditions.diving))
        .map(s => toDivingRow(s))
        .sort((a, b) => (a.dropFromPeak || 0) - (b.dropFromPeak || 0)),

      dead: indicators
        .filter(s => pass(s) && filterDead(s.dead, conditions.dead))
        .map(s => toDeadRow(s))
        .sort((a, b) => (b.marketCapEok || 0) - (a.marketCapEok || 0)),
    };
  }, [indicators, conditions, commonFilters]);

  const totalHits = results
    ? Object.values(results).reduce((a, v) => a + v.length, 0)
    : null;

  return (
    <div className="flex flex-col gap-4">

      {/* 상태 배너 */}
      {loadingInd && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-border bg-surface-raised text-xs text-gray-500">
          <LoadingSpinner size="sm" />
          <span>지표 데이터 로드 중…</span>
        </div>
      )}
      {!loadingInd && indPending && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-border bg-surface-raised text-xs text-gray-500">
          <span>⏳</span>
          <span>지표 데이터가 없습니다. 매 영업일 새벽 1시에 자동 업데이트됩니다.</span>
          <button
            onClick={runUpdate}
            disabled={updating}
            className="ml-auto px-3 py-1 rounded border border-brand-blue/30 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 disabled:opacity-40 transition-colors"
          >
            {updating ? '업데이트 중...' : '지금 업데이트'}
          </button>
        </div>
      )}
      {!loadingInd && indMeta && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-border bg-surface-raised text-xs text-gray-500">
          <span className="text-brand-green">●</span>
          <span>캐시된 지표 ({fmtTimestamp(indMeta.timestamp)})</span>
          <span className="text-gray-600">|</span>
          <span>분석 {indMeta.screened?.toLocaleString()}종목</span>
          {totalHits !== null && (
            <>
              <span className="text-gray-600">|</span>
              <span>조건 해당 <b className="text-gray-200">{totalHits}</b>개</span>
            </>
          )}
          <button
            onClick={runUpdate}
            disabled={updating}
            className="ml-auto px-3 py-1 rounded border border-surface-border hover:border-brand-blue/30 hover:text-gray-300 disabled:opacity-40 transition-colors"
          >
            {updating ? '업데이트 중...' : '지표 업데이트'}
          </button>
        </div>
      )}
      {updating && updateMsg && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-yellow-800/30 bg-yellow-900/10 text-xs text-yellow-400">
          <LoadingSpinner size="sm" />
          <span>{updateMsg}</span>
        </div>
      )}
      {!updating && updateMsg && (
        <div className="px-4 py-2 rounded-lg border border-surface-border bg-surface-raised text-xs text-gray-500">
          {updateMsg}
        </div>
      )}

      {/* 공통 필터 */}
      <CommonFilters filters={commonFilters} onChange={updateCommon} />

      {/* 기법 탭 */}
      <div className="flex gap-0 border-b border-surface-border">
        {Object.entries(METHOD_META).map(([key, m]) => (
          <button
            key={key}
            onClick={() => setActiveMethod(key)}
            className={`px-5 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeMethod === key
                ? m.tabActiveCls
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {m.label}
            {results && (
              <span className={`ml-2 font-bold ${activeMethod === key ? m.countCls : 'text-gray-600'}`}>
                {results[key]?.length ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 기법별 조건 패널 */}
      {activeMethod === 'babgeunset' && (
        <BabgeunsetPanel
          cond={conditions.babgeunset}
          onChange={(k, v) => updateCondition('babgeunset', k, v)}
        />
      )}
      {activeMethod === 'yeokmaegong' && (
        <YeokmaegongPanel
          cond={conditions.yeokmaegong}
          onChange={(k, v) => updateCondition('yeokmaegong', k, v)}
        />
      )}
      {activeMethod === 'jijunbong' && (
        <JijunbongPanel
          cond={conditions.jijunbong}
          onChange={(k, v) => updateCondition('jijunbong', k, v)}
        />
      )}
      {activeMethod === 'diving' && (
        <DivingPanel
          cond={conditions.diving}
          onChange={(k, v) => updateCondition('diving', k, v)}
        />
      )}
      {activeMethod === 'dead' && (
        <DeadPanel
          cond={conditions.dead}
          onChange={(k, v) => updateCondition('dead', k, v)}
        />
      )}

      {/* 결과 */}
      {results && <ResultsArea results={results} onSelect={setSelectedStock} />}

      {/* 차트 모달 */}
      {selectedStock && (
        <StockChartModal
          stock={selectedStock}
          method={selectedStock.method}
          onClose={() => setSelectedStock(null)}
        />
      )}

    </div>
  );
}

// ── 공통 필터 패널 ────────────────────────────────────────────────────────────
function CommonFilters({ filters, onChange }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-surface-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-raised text-xs font-semibold text-gray-300 hover:bg-surface-border/30 transition-colors"
      >
        <span>공통 필터 (코스피+코스닥 전종목)</span>
        <span className="text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 py-3 flex flex-wrap gap-6 text-xs">
          <NumInput
            label="최소 거래량(20일평균)"
            value={filters.minVolume}
            onChange={v => onChange('minVolume', v)}
            unit="주"
          />
          <NumInput
            label="최소 거래대금(20일평균)"
            value={filters.minTurnoverEok}
            onChange={v => onChange('minTurnoverEok', v)}
            unit="억원"
          />
          <div className="flex items-center gap-4 text-gray-500">
            <span className="badge-neutral">보통주만</span>
            <span className="badge-neutral">관리종목 제외</span>
            <span className="badge-neutral">우선주 제외</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 밥그릇 3번자리 패널 ───────────────────────────────────────────────────────
function BabgeunsetPanel({ cond, onChange }) {
  return (
    <div className={`rounded-lg border overflow-hidden ${METHOD_META.babgeunset.borderCls}`}>
      <div className={`px-4 py-2.5 flex items-center justify-between ${METHOD_META.babgeunset.headerCls}`}>
        <div>
          <span className="text-xs font-semibold text-brand-blue">밥그릇 3번자리</span>
          <span className="ml-3 text-xs text-gray-500">{METHOD_META.babgeunset.desc}</span>
        </div>
        <span className="text-xs text-gray-600">조건 변경 시 즉시 반영</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-xs">

        <CondSection title="이격도 (둘 중 하나)">
          <CheckRow label="1년선(224일) 이격도" checked={cond.ma224Deviation} onChange={v => onChange('ma224Deviation', v)}>
            <RangeInputs min={cond.ma224DevMin} max={cond.ma224DevMax}
              onMin={v => onChange('ma224DevMin', v)} onMax={v => onChange('ma224DevMax', v)} unit="%" />
          </CheckRow>
          <CheckRow label="2년선(448일) 이격도" checked={cond.ma448Deviation} onChange={v => onChange('ma448Deviation', v)}>
            <RangeInputs min={cond.ma448DevMin} max={cond.ma448DevMax}
              onMin={v => onChange('ma448DevMin', v)} onMax={v => onChange('ma448DevMax', v)} unit="%" />
          </CheckRow>
        </CondSection>

        <CondSection title="돌파 조건">
          <CheckRow label="장기선 N봉 이내 돌파" checked={cond.maBreakN} onChange={v => onChange('maBreakN', v)}>
            <NumInput label="" value={cond.maBreakBars} onChange={v => onChange('maBreakBars', v)} unit="봉 이내" />
          </CheckRow>
          <CheckRow label="구름대 상향 돌파" checked={cond.ichimokuBreak} onChange={v => onChange('ichimokuBreak', v)}>
            <NumInput label="" value={cond.ichimokuBreakBars} onChange={v => onChange('ichimokuBreakBars', v)} unit="봉 이내" />
          </CheckRow>
          <CheckRow label="볼린저 상한선 돌파" checked={cond.bbBreak} onChange={v => onChange('bbBreak', v)}>
            <div className="flex items-center gap-1">
              <select
                className="bg-surface-raised border border-surface-border rounded px-1.5 py-0.5 text-xs text-gray-300"
                value={cond.bbPeriod}
                onChange={e => onChange('bbPeriod', +e.target.value)}
              >
                <option value={33}>33일</option>
                <option value={41}>41일</option>
              </select>
              <NumInput label="" value={cond.bbBreakBars} onChange={v => onChange('bbBreakBars', v)} unit="봉 이내" />
            </div>
          </CheckRow>
        </CondSection>

        <CondSection title="주봉 지표">
          <CheckRow label="주봉 CCI(48) -100 상향 돌파" checked={cond.weeklyCCI} onChange={v => onChange('weeklyCCI', v)}>
            <NumInput label="" value={cond.weeklyCCIBars} onChange={v => onChange('weeklyCCIBars', v)} unit="봉 이내" />
          </CheckRow>
        </CondSection>

        <CondSection title="거래량 조건">
          <CheckRow label="15봉 이내 거래대금 100억↑" checked={cond.turnover100Eok} onChange={v => onChange('turnover100Eok', v)} />
          <CheckRow label="15봉 이내 신고 거래량" checked={cond.newHighVolume} onChange={v => onChange('newHighVolume', v)} />
          <CheckRow label="거래량 급증 (선택)" checked={cond.volumeSpike500} onChange={v => onChange('volumeSpike500', v)}>
            <NumInput label="" value={cond.volumeSpikeBars} onChange={v => onChange('volumeSpikeBars', v)} unit="봉 이내 500%" />
          </CheckRow>
        </CondSection>

      </div>
    </div>
  );
}

// ── 역매공파 112 패널 ─────────────────────────────────────────────────────────
function YeokmaegongPanel({ cond, onChange }) {
  return (
    <div className={`rounded-lg border overflow-hidden ${METHOD_META.yeokmaegong.borderCls}`}>
      <div className={`px-4 py-2.5 flex items-center justify-between ${METHOD_META.yeokmaegong.headerCls}`}>
        <div>
          <span className="text-xs font-semibold text-brand-purple">역매공파 112</span>
          <span className="ml-3 text-xs text-gray-500">{METHOD_META.yeokmaegong.desc}</span>
        </div>
        <span className="text-xs text-gray-600">조건 변경 시 즉시 반영</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-xs">

        <CondSection title="이평선 배열">
          <CheckRow label="장기 역배열 (448 > 224 > 112 > 종가)" checked={cond.reverseAlignment} onChange={v => onChange('reverseAlignment', v)} />
          <CheckRow label="단기 정배열 (MA5 > MA20)" checked={cond.shortTermBull} onChange={v => onChange('shortTermBull', v)} />
          <CheckRow label="60일선 위 종가" checked={cond.aboveMa60} onChange={v => onChange('aboveMa60', v)} />
          <CheckRow label="112일선 근접" checked={cond.ma112Near} onChange={v => onChange('ma112Near', v)}>
            <RangeInputs min={cond.ma112NearMin} max={cond.ma112NearMax}
              onMin={v => onChange('ma112NearMin', v)} onMax={v => onChange('ma112NearMax', v)} unit="%" />
          </CheckRow>
        </CondSection>

        <CondSection title="매집 & 수렴">
          <CheckRow label="매집봉 (평균 대비 거래량 급증)" checked={cond.accumBar} onChange={v => onChange('accumBar', v)}>
            <div className="flex flex-col gap-1 mt-1">
              <NumInput label="최근" value={cond.accumBarBars} onChange={v => onChange('accumBarBars', v)} unit="봉 내" />
              <NumInput label="기준" value={cond.accumBarPct} onChange={v => onChange('accumBarPct', v)} unit="%" />
            </div>
          </CheckRow>
          <CheckRow label="공구리 (횡보 수렴)" checked={cond.consolidation} onChange={v => onChange('consolidation', v)}>
            <div className="flex flex-col gap-1 mt-1">
              <NumInput label="최소" value={cond.consolMinBars} onChange={v => onChange('consolMinBars', v)} unit="봉 이상" />
              <NumInput label="범위" value={cond.consolMaxRange} onChange={v => onChange('consolMaxRange', v)} unit="% 이내" />
            </div>
          </CheckRow>
          <CheckRow label="볼린저 수렴 (힘의 응축)" checked={cond.bbConverge} onChange={v => onChange('bbConverge', v)} />
        </CondSection>

      </div>
    </div>
  );
}

// ── 기준봉/눌림목 패널 ────────────────────────────────────────────────────────
function JijunbongPanel({ cond, onChange }) {
  return (
    <div className={`rounded-lg border overflow-hidden ${METHOD_META.jijunbong.borderCls}`}>
      <div className={`px-4 py-2.5 flex items-center justify-between ${METHOD_META.jijunbong.headerCls}`}>
        <div>
          <span className="text-xs font-semibold text-brand-yellow">기준봉/눌림목</span>
          <span className="ml-3 text-xs text-gray-500">{METHOD_META.jijunbong.desc}</span>
        </div>
        <span className="text-xs text-gray-600">조건 변경 시 즉시 반영</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-xs">

        <CondSection title="기준봉">
          <CheckRow label="224일선 돌파 기준봉 (강봉+거래량)" checked={cond.ma224Breakout} onChange={v => onChange('ma224Breakout', v)}>
            <NumInput label="" value={cond.ma224BreakBars} onChange={v => onChange('ma224BreakBars', v)} unit="봉 이내" />
          </CheckRow>
        </CondSection>

        <CondSection title="눌림목">
          <CheckRow label="급등 후 눌림목 구간" checked={cond.pullback} onChange={v => onChange('pullback', v)}>
            <RangeInputs min={cond.pullbackMin} max={cond.pullbackMax}
              onMin={v => onChange('pullbackMin', v)} onMax={v => onChange('pullbackMax', v)} unit="% 하락" />
          </CheckRow>
        </CondSection>

        <CondSection title="캔들 (선택)">
          <CheckRow label="역주행 캔들 (추세 전환 양봉)" checked={cond.reversalCandle} onChange={v => onChange('reversalCandle', v)}>
            <NumInput label="" value={cond.reversalBars} onChange={v => onChange('reversalBars', v)} unit="봉 이내" />
          </CheckRow>
        </CondSection>

      </div>
    </div>
  );
}

// ── 다이빙기법 패널 ───────────────────────────────────────────────────────────
function DivingPanel({ cond, onChange }) {
  return (
    <div className={`rounded-lg border overflow-hidden ${METHOD_META.diving.borderCls}`}>
      <div className={`px-4 py-2.5 flex items-center justify-between ${METHOD_META.diving.headerCls}`}>
        <div>
          <span className="text-xs font-semibold text-brand-red">다이빙기법</span>
          <span className="ml-3 text-xs text-gray-500">{METHOD_META.diving.desc}</span>
        </div>
        <span className="text-xs text-gray-600">조건 변경 시 즉시 반영</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-xs">

        <CondSection title="세력 입성 확인">
          <CheckRow label="최소 급등률" checked={cond.surgePctCheck} onChange={v => onChange('surgePctCheck', v)}>
            <NumInput label="이상" value={cond.surgePctMin} onChange={v => onChange('surgePctMin', v)} unit="%" />
          </CheckRow>
          <CheckRow label="급등 시 거래량 (평균 대비)" checked={cond.surgeVolCheck} onChange={v => onChange('surgeVolCheck', v)}>
            <NumInput label="이상" value={cond.surgeVolRatioMin} onChange={v => onChange('surgeVolRatioMin', v)} unit="배" />
          </CheckRow>
          <CheckRow label="최근 60봉 내 224일선 아래 있었음" checked={cond.belowMa224} onChange={v => onChange('belowMa224', v)} />
        </CondSection>

        <CondSection title="하락 형태">
          <CheckRow label="외봉 급락 (쌍봉·삼봉 제외)" checked={cond.singlePeak} onChange={v => onChange('singlePeak', v)} />
          <CheckRow label="고점 대비 하락 범위" checked={cond.dropCheck} onChange={v => onChange('dropCheck', v)}>
            <RangeInputs min={cond.dropMin} max={cond.dropMax}
              onMin={v => onChange('dropMin', v)} onMax={v => onChange('dropMax', v)} unit="% 하락" />
          </CheckRow>
        </CondSection>

        <CondSection title="이평선 근접 (둘 중 하나)">
          <CheckRow label="15일선 근접" checked={cond.nearMa15} onChange={v => onChange('nearMa15', v)}>
            <RangeInputs min={cond.ma15NearMin} max={cond.ma15NearMax}
              onMin={v => onChange('ma15NearMin', v)} onMax={v => onChange('ma15NearMax', v)} unit="% 이격" />
          </CheckRow>
          <CheckRow label="33일선 근접" checked={cond.nearMa33} onChange={v => onChange('nearMa33', v)}>
            <RangeInputs min={cond.ma33NearMin} max={cond.ma33NearMax}
              onMin={v => onChange('ma33NearMin', v)} onMax={v => onChange('ma33NearMax', v)} unit="% 이격" />
          </CheckRow>
        </CondSection>

        <CondSection title="엘리엇 2파 조건">
          <CheckRow label="피보나치 되돌림 구간" checked={cond.fibCheck} onChange={v => onChange('fibCheck', v)}>
            <div className="mt-1 space-y-1">
              <RangeInputs min={cond.fibMin} max={cond.fibMax}
                onMin={v => onChange('fibMin', v)} onMax={v => onChange('fibMax', v)} unit="% 되돌림" />
              <div className="text-gray-600 text-xs ml-1">38.2% / 61.8% / 78.6% 기준</div>
            </div>
          </CheckRow>
          <CheckRow label="1파 시작점 불침범 (2파 핵심 규칙)" checked={cond.wave1Rule} onChange={v => onChange('wave1Rule', v)} />
        </CondSection>

      </div>
    </div>
  );
}

// ── 데드기법 패널 ─────────────────────────────────────────────────────────────
function DeadPanel({ cond, onChange }) {
  return (
    <div className={`rounded-lg border overflow-hidden ${METHOD_META.dead.borderCls}`}>
      <div className={`px-4 py-2.5 flex items-center justify-between ${METHOD_META.dead.headerCls}`}>
        <div>
          <span className="text-xs font-semibold text-brand-green">데드기법</span>
          <span className="ml-3 text-xs text-gray-500">{METHOD_META.dead.desc}</span>
        </div>
        <span className="text-xs text-gray-600">조건 변경 시 즉시 반영</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-xs">

        <CondSection title="세력 입성 확인">
          <CheckRow label="최근 150봉 내 급등 여부" checked={cond.surgePctCheck} onChange={v => onChange('surgePctCheck', v)}>
            <NumInput label="이상" value={cond.surgePctMin} onChange={v => onChange('surgePctMin', v)} unit="%" />
          </CheckRow>
        </CondSection>

        <CondSection title="부채꼴 조건">
          <CheckRow label="EMA 112·224·448 부채꼴 형성" checked={cond.fannedCheck} onChange={v => onChange('fannedCheck', v)}>
            <NumInput label="최소 스프레드" value={cond.fanSpreadMin} onChange={v => onChange('fanSpreadMin', v)} unit="%" />
          </CheckRow>
        </CondSection>

        <CondSection title="이평선 타점 (하나 이상)">
          <CheckRow label="EMA 112일선 근접" checked={cond.nearEma112} onChange={v => onChange('nearEma112', v)}>
            <RangeInputs min={cond.ema112Min} max={cond.ema112Max}
              onMin={v => onChange('ema112Min', v)} onMax={v => onChange('ema112Max', v)} unit="% 이격" />
          </CheckRow>
          <CheckRow label="EMA 224일선 근접" checked={cond.nearEma224} onChange={v => onChange('nearEma224', v)}>
            <RangeInputs min={cond.ema224Min} max={cond.ema224Max}
              onMin={v => onChange('ema224Min', v)} onMax={v => onChange('ema224Max', v)} unit="% 이격" />
          </CheckRow>
          <CheckRow label="EMA 448일선 근접 (선택)" checked={cond.nearEma448} onChange={v => onChange('nearEma448', v)}>
            <RangeInputs min={cond.ema448Min} max={cond.ema448Max}
              onMin={v => onChange('ema448Min', v)} onMax={v => onChange('ema448Max', v)} unit="% 이격" />
          </CheckRow>
        </CondSection>

        <CondSection title="접촉 횟수">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">최대 터치 횟수</span>
            <NumInput label="" value={cond.maxTouches} onChange={v => onChange('maxTouches', v)} unit="회 이하" />
          </div>
          <div className="text-gray-600 mt-1">여러 번 닿은 선은 효력 약화 → 첫 접촉 선호</div>
        </CondSection>

      </div>
    </div>
  );
}

// ── 결과 영역 ─────────────────────────────────────────────────────────────────
function ResultsArea({ results, onSelect }) {
  const [expanded, setExpanded] = useState(
    Object.keys(results).find(k => results[k].length > 0) || Object.keys(results)[0]
  );

  return (
    <div className="space-y-4">
      {Object.entries(results).map(([method, stocks]) => {
        const meta       = METHOD_META[method];
        const isExpanded = expanded === method;
        return (
          <div key={method} className={`rounded-lg border overflow-hidden ${
            stocks.length > 0 ? meta.resultBorderCls : 'border-surface-border'
          }`}>
            <button
              onClick={() => setExpanded(isExpanded ? null : method)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                stocks.length > 0 ? meta.resultBgCls : 'bg-surface-raised'
              }`}
            >
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${meta.badgeCls}`}>
                {meta.label}
              </span>
              <span className={`text-sm font-bold ${stocks.length > 0 ? meta.countCls : 'text-gray-600'}`}>
                {stocks.length}개
              </span>
              <span className="text-xs text-gray-500 ml-2">종목 클릭 시 차트</span>
              <span className="text-xs text-gray-600 ml-auto">{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && stocks.length === 0 && (
              <div className="px-4 py-4 text-xs text-gray-600 text-center">
                조건에 해당하는 종목이 없습니다.
              </div>
            )}
            {isExpanded && stocks.length > 0 && (
              <div className="overflow-x-auto">
                <ScreenerTable stocks={stocks} method={method} onSelect={onSelect} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScreenerTable({ stocks, method, onSelect }) {
  const [sortBy,  setSortBy]  = useState('marketCapEok');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = col => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const sorted = [...stocks].sort((a, b) => {
    const av = a[sortBy] ?? -Infinity;
    const bv = b[sortBy] ?? -Infinity;
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const extraCols = {
    babgeunset: [
      { key: 'dev224',               label: '이격도(224일)',     hint: '종가/224일선 이격도 (%)' },
      { key: 'ichimokuBreakBarsAgo', label: '구름대 돌파',      hint: 'N봉 전 상향 돌파' },
      { key: 'cciCrossBarsAgo',      label: 'CCI 돌파',         hint: '주봉 CCI -100 탈출 N봉 전' },
      { key: 'bbBreakBarsAgo',       label: 'BB 상한 돌파',     hint: 'N봉 전 볼린저 상한선 돌파' },
      { key: 'maxTurnover15',        label: '15봉 최대거래대금', hint: '억원' },
    ],
    yeokmaegong: [
      { key: 'reverseAlign',  label: '역배열 현황',   hint: 'MA448 > MA224 > MA112 > 종가' },
      { key: 'dev112',        label: '112선 이격도',  hint: '종가 기준 (%)' },
      { key: 'hasAccum',      label: '매집봉',        fmt: v => v ? '✓' : '—' },
      { key: 'hasConsol',     label: '공구리',        fmt: v => v ? '✓' : '—' },
      { key: 'bbConverging',  label: 'BB수렴',        fmt: v => v ? '✓' : '—' },
    ],
    jijunbong: [
      { key: 'ma224BreakN', label: '기준봉 N봉 전',  hint: 'MA224 돌파 후 경과' },
      { key: 'pullbackPct', label: '눌림목 %',       hint: '고점 대비 하락률' },
      { key: 'dev224',      label: '224선 이격도',   hint: '종가 기준 (%)' },
      { key: 'hasReversal', label: '역주행캔들',     fmt: v => v ? '✓' : '—' },
    ],
    diving: [
      { key: 'surgePct',     label: '1파 급등률',    hint: '저점→고점 상승률 (%)' },
      { key: 'retracePct',   label: '피보 되돌림',   hint: '2파 되돌림 비율 (%) — 38.2~78.6% = 정상 2파 구간' },
      { key: 'dropFromPeak', label: '고점 대비',     hint: '고점 대비 현재 하락률 (%) — 음수' },
      { key: 'dev15',        label: '15일선 이격',   hint: '현재가 기준 (%)' },
      { key: 'dev33',        label: '33일선 이격',   hint: '현재가 기준 (%)' },
      { key: 'isSinglePeak', label: '외봉',          fmt: v => v ? '✓' : '✗' },
    ],
    dead: [
      { key: 'surgePct',     label: '급등률',        hint: '최근 150봉 내 최대 상승률 (%)' },
      { key: 'isFanned',     label: '부채꼴',        fmt: v => v ? '✓' : '✗' },
      { key: 'fanSpreadPct', label: '부채꼴 폭',     hint: 'EMA448 기준 EMA112 이격 (%)' },
      { key: 'devEma112',    label: 'EMA112 이격',   hint: '현재가 기준 (%)' },
      { key: 'devEma224',    label: 'EMA224 이격',   hint: '현재가 기준 (%)' },
      { key: 'touchCount112',label: 'EMA112 터치',   hint: '최근 30봉 내 교차 횟수' },
    ],
  };

  const baseCols = [
    { key: 'name',         label: '종목명',    sortable: false },
    { key: 'market',       label: '시장',      sortable: false },
    { key: 'close',        label: '현재가',    fmt: v => v ? `₩${v.toLocaleString()}` : '—' },
    { key: 'dayChange',    label: '등락률',    fmt: v => v !== undefined ? `${v > 0 ? '+' : ''}${v?.toFixed(2)}%` : '—' },
    { key: 'marketCapEok', label: '시총(억)',  fmt: v => v ? `${v.toLocaleString()}억` : '—' },
    { key: 'turnoverEok',  label: '거래대금',  fmt: v => v ? `${v}억` : '—' },
  ];

  const allCols = [...baseCols, ...(extraCols[method] || [])];

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-surface-border bg-surface-raised">
          {allCols.map(col => (
            <th
              key={col.key}
              onClick={() => col.sortable !== false && handleSort(col.key)}
              className={`px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap ${
                col.sortable !== false ? 'cursor-pointer hover:text-gray-300' : ''
              }`}
            >
              <span className={col.hint ? 'border-b border-dashed border-gray-700 cursor-help' : ''} title={col.hint || ''}>
                {col.label}
              </span>
              {sortBy === col.key && (
                <span className="ml-1 text-brand-blue">{sortDir === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map(s => (
          <tr key={s.code} className="data-row cursor-pointer" onClick={() => onSelect && onSelect(s)}>
            {allCols.map(col => {
              const val     = s[col.key];
              const display = col.fmt ? col.fmt(val) : (val ?? '—');

              if (col.key === 'dayChange') {
                return (
                  <td key={col.key} className={`px-3 py-2.5 font-mono ${
                    s.dayChange > 0 ? 'text-brand-green' : s.dayChange < 0 ? 'text-brand-red' : 'text-gray-400'
                  }`}>{display}</td>
                );
              }
              if (col.key === 'name') {
                return (
                  <td key={col.key} className="px-3 py-2.5">
                    <div className="font-semibold text-gray-200">{s.name}</div>
                    <div className="text-gray-600 font-mono">{s.code}</div>
                    {s.sector && <div className="text-gray-700 mt-0.5">{s.sector}</div>}
                  </td>
                );
              }
              if (col.key === 'market') {
                return (
                  <td key={col.key} className="px-3 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      s.market === 'KOSPI'
                        ? 'bg-brand-blue/10 text-brand-blue'
                        : 'bg-brand-green/10 text-brand-green'
                    }`}>{s.market}</span>
                  </td>
                );
              }
              return (
                <td key={col.key} className="px-3 py-2.5 text-gray-300 font-mono">{display}</td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── 공통 UI 컴포넌트 ──────────────────────────────────────────────────────────
function CondSection({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-gray-600 font-semibold text-xs border-b border-surface-border pb-1">{title}</div>
      {children}
    </div>
  );
}

function CheckRow({ label, checked, onChange, children }) {
  return (
    <div className={`flex flex-col gap-1 ${!checked ? 'opacity-40' : ''}`}>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="accent-brand-blue"
        />
        <span className={`text-xs ${checked ? 'text-gray-300' : 'text-gray-500'}`}>{label}</span>
      </label>
      {checked && children && <div className="ml-5">{children}</div>}
    </div>
  );
}

function NumInput({ label, value, onChange, unit, hint }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {label && <span className="text-gray-500">{label}</span>}
      <input
        type="number"
        value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-16 bg-surface-raised border border-surface-border rounded px-1.5 py-0.5 text-gray-200 text-xs text-right"
      />
      {unit && <span className="text-gray-600">{unit}</span>}
      {hint && <span className="text-gray-700">{hint}</span>}
    </div>
  );
}

function RangeInputs({ min, max, onMin, onMax, unit }) {
  return (
    <div className="flex items-center gap-1 text-xs ml-0">
      <input
        type="number"
        value={min}
        onChange={e => onMin(+e.target.value)}
        className="w-14 bg-surface-raised border border-surface-border rounded px-1.5 py-0.5 text-gray-200 text-xs text-right"
      />
      <span className="text-gray-600">~</span>
      <input
        type="number"
        value={max}
        onChange={e => onMax(+e.target.value)}
        className="w-14 bg-surface-raised border border-surface-border rounded px-1.5 py-0.5 text-gray-200 text-xs text-right"
      />
      {unit && <span className="text-gray-600">{unit}</span>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 차트 모달
// ═════════════════════════════════════════════════════════════════════════════

const PERIODS = [
  { key: '6M', label: '6개월', days: 126,  resample: 'daily'  },
  { key: '1Y', label: '1년',   days: 252,  resample: 'daily'  },
  { key: '3Y', label: '3년',   days: 756,  resample: 'weekly' },
  { key: '5Y', label: '5년',   days: 1260, resample: 'weekly' },
];

function StockChartModal({ stock, method, onClose }) {
  const [chartData, setChartData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState('1Y');
  const meta = METHOD_META[method];

  // ESC 닫기
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 차트 데이터 로드 (종목별 캐시)
  useEffect(() => {
    if (!stock) return;
    setLoading(true);
    setChartData(null);
    axios.get(`/api/kis-screener/chart/${stock.code}?market=${stock.market}`)
      .then(res => setChartData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stock?.code]);

  if (!stock) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="relative bg-surface-base border border-surface-border rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-border sticky top-0 bg-surface-base z-10">
          <span className="font-bold text-gray-100 text-base">{stock.name}</span>
          <span className="text-gray-500 font-mono text-sm">{stock.code}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
            stock.market === 'KOSPI' ? 'bg-brand-blue/10 text-brand-blue' : 'bg-brand-green/10 text-brand-green'
          }`}>{stock.market}</span>
          <span className={`text-xs px-2 py-0.5 rounded border ${meta.badgeCls}`}>{meta.label}</span>
          {(chartData?.sector || stock.sector) && (
            <span className="text-xs text-gray-600">{chartData?.sector || stock.sector}</span>
          )}
          <div className="ml-auto flex items-center gap-4">
            <div>
              <span className="text-base font-bold text-gray-100">₩{stock.close?.toLocaleString()}</span>
              <span className={`ml-2 text-sm font-semibold ${
                stock.dayChange > 0 ? 'text-brand-green' : stock.dayChange < 0 ? 'text-brand-red' : 'text-gray-400'
              }`}>
                {stock.dayChange > 0 ? '+' : ''}{stock.dayChange?.toFixed(2)}%
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 w-8 h-8 flex items-center justify-center rounded hover:bg-surface-raised transition-colors text-lg"
            >✕</button>
          </div>
        </div>

        {/* 기간 선택 버튼 */}
        <div className="px-4 pt-3 flex items-center gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                period === p.key
                  ? 'bg-surface-border text-gray-100'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-surface-raised'
              }`}
            >{p.label}</button>
          ))}
        </div>

        {/* 차트 영역 */}
        <div className="px-4 pt-2 pb-2">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-500 gap-2">
              <LoadingSpinner size="sm" /><span>차트 로드 중...</span>
            </div>
          ) : chartData?.ohlcv?.length > 0 ? (
            <CandlestickChart ohlcv={chartData.ohlcv} method={method} period={period} />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
              차트 데이터를 불러올 수 없습니다.
            </div>
          )}
        </div>

        {/* 지표 요약 — chartData에서 시총·섹터 보완 */}
        <IndicatorPanel
          stock={{ ...stock, ...( chartData ? { marketCapEok: chartData.marketCapEok, sector: chartData.sector } : {}) }}
          method={method}
          meta={meta}
        />
      </div>
    </div>
  );
}

// ── 캔들스틱 SVG 차트 ─────────────────────────────────────────────────────────
const MA_CONFIG = {
  babgeunset:  [
    { p: 224, color: '#facc15', label: 'MA224(1년)' },
    { p: 448, color: '#d1d5db', label: 'MA448(2년)' },
  ],
  yeokmaegong: [
    { p: 5,   color: '#60a5fa', label: 'MA5' },
    { p: 20,  color: '#fb923c', label: 'MA20' },
    { p: 60,  color: '#c084fc', label: 'MA60' },
    { p: 112, color: '#f87171', label: 'MA112' },
    { p: 224, color: '#facc15', label: 'MA224' },
    { p: 448, color: '#d1d5db', label: 'MA448' },
  ],
  jijunbong:   [
    { p: 60,  color: '#c084fc', label: 'MA60' },
    { p: 224, color: '#facc15', label: 'MA224(1년)' },
  ],
  diving: [
    { p: 15,  color: '#fb923c', label: 'MA15' },
    { p: 33,  color: '#f87171', label: 'MA33' },
    { p: 224, color: '#facc15', label: 'MA224' },
  ],
  dead: [
    { p: 112, color: '#facc15', label: 'EMA112' },
    { p: 224, color: '#d1d5db', label: 'EMA224' },
    { p: 448, color: '#60a5fa', label: 'EMA448' },
  ],
};

function calcMASeries(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const sum = closes.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0);
    return sum / period;
  });
}

// 일봉 → 주봉 (월요일 기준 grouping)
function toWeekly(bars) {
  const weeks = {};
  for (const b of bars) {
    const d   = new Date(b.date);
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const key = mon.toISOString().slice(0, 10);
    if (!weeks[key]) weeks[key] = { date: key, open: b.open, high: b.high, low: b.low, close: b.close };
    else {
      weeks[key].high  = Math.max(weeks[key].high, b.high);
      weeks[key].low   = Math.min(weeks[key].low,  b.low);
      weeks[key].close = b.close;
    }
  }
  return Object.values(weeks).sort((a, b) => a.date.localeCompare(b.date));
}

// 일봉 → 월봉
function toMonthly(bars) {
  const months = {};
  for (const b of bars) {
    const key = b.date.slice(0, 7);
    if (!months[key]) months[key] = { date: key + '-01', open: b.open, high: b.high, low: b.low, close: b.close };
    else {
      months[key].high  = Math.max(months[key].high, b.high);
      months[key].low   = Math.min(months[key].low,  b.low);
      months[key].close = b.close;
    }
  }
  return Object.values(months).sort((a, b) => a.date.localeCompare(b.date));
}

// X축 날짜 포맷 (기간에 따라 다르게)
function fmtXLabel(dateStr, resample) {
  if (!dateStr) return '';
  if (resample === 'monthly') return dateStr.slice(0, 7).replace('-', '.');
  if (resample === 'weekly')  return dateStr.slice(0, 7).replace('-', '.');
  return dateStr.slice(0, 7).replace('-', '.');
}

function CandlestickChart({ ohlcv, method, period = '1Y' }) {
  const W = 860, H = 320;
  const PAD = { t: 26, r: 12, b: 26, l: 62 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const pCfg  = PERIODS.find(p => p.key === period) || PERIODS[1];
  const maCfg = MA_CONFIG[method] || MA_CONFIG.babgeunset;

  // 1) 전체 ohlcv를 먼저 리샘플 (MA 계산에 충분한 과거 데이터 확보)
  const allBars = pCfg.resample === 'weekly' ? toWeekly(ohlcv) : ohlcv;

  // 2) 표시할 캔들 수 (기간 → 봉 수 환산)
  const targetCount = pCfg.resample === 'weekly'
    ? Math.ceil(pCfg.days / 5)   // 주봉: 5거래일 = 1주
    : pCfg.days;                 // 일봉: 그대로

  // 3) MA를 전체 allBars 기준으로 계산 → 마지막 targetCount개 슬라이스
  //    (슬라이스 후 계산 시 MA224가 뒤 29봉만 표시되는 문제 해결)
  const closesAll  = allBars.map(b => b.close);
  const maPeriodOf = p => Math.max(2, Math.round(pCfg.resample === 'weekly' ? p / 5 : p));

  const maValues  = {};
  const maVisible = [];
  for (const cfg of maCfg) {
    const mp   = maPeriodOf(cfg.p);
    const full = calcMASeries(closesAll, mp);
    const sliced = full.slice(-targetCount);
    if (sliced.some(v => v != null)) {
      maValues[cfg.p] = sliced;
      maVisible.push(cfg);
    }
  }

  // 4) 표시 캔들 슬라이스
  const data = allBars.slice(-targetCount);
  const SHOW = data.length;

  // 가격 도메인 (캔들 + MA 모두 포함)
  const allPrices = [
    ...data.flatMap(d => [d.high, d.low]),
    ...Object.values(maValues).flatMap(v => v.filter(Boolean)),
  ].filter(v => v > 0);
  if (allPrices.length === 0) return null;

  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const pad  = (maxP - minP) * 0.06;
  const dMin = minP - pad;
  const dMax = maxP + pad;

  const xOf = i  => PAD.l + (i + 0.5) * (chartW / SHOW);
  const yOf = p  => PAD.t + chartH * (1 - (p - dMin) / (dMax - dMin));
  const cW  = Math.max(1, Math.min(10, chartW / SHOW - 1));

  // Y축 틱
  const yTicks = 5;
  const fmtP   = v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v/1e3)}K` : Math.round(v);

  // X축 레이블 간격 (약 6개)
  const xStep = Math.max(1, Math.floor(SHOW / 6));

  // MA 꺾은선 path
  const maPath = (vals) => {
    let d = ''; let moved = false;
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] == null) { moved = false; continue; }
      const px = xOf(i).toFixed(1), py = yOf(vals[i]).toFixed(1);
      d += moved ? `L${px},${py}` : `M${px},${py}`;
      moved = true;
    }
    return d;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded" style={{ background: '#0c1629' }}>

      {/* 배경 그리드 */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const price = dMin + (dMax - dMin) * i / yTicks;
        const y     = yOf(price);
        return (
          <g key={i}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#1e2d4a" strokeWidth={1} />
            <text x={PAD.l - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#4b5563">{fmtP(price)}</text>
          </g>
        );
      })}

      {/* MA 꺾은선 */}
      {maVisible.map(({ p, color }) => (
        <path key={p} d={maPath(maValues[p])} fill="none" stroke={color} strokeWidth={1.5} opacity={0.85} />
      ))}

      {/* 캔들 */}
      {data.map((d, i) => {
        const x     = xOf(i);
        const isUp  = d.close >= d.open;
        const color = isUp ? '#4ade80' : '#f87171';
        const bTop  = yOf(Math.max(d.open, d.close));
        const bBot  = yOf(Math.min(d.open, d.close));
        return (
          <g key={i}>
            <line x1={x} y1={yOf(d.high)} x2={x} y2={yOf(d.low)} stroke={color} strokeWidth={1} />
            <rect x={x - cW / 2} y={bTop} width={cW} height={Math.max(1, bBot - bTop)} fill={color} />
          </g>
        );
      })}

      {/* X축 날짜 */}
      {data.map((d, i) => {
        if (i % xStep !== 0) return null;
        return (
          <text key={i} x={xOf(i)} y={H - 5} textAnchor="middle" fontSize={9} fill="#4b5563">
            {fmtXLabel(d.date, pCfg.resample)}
          </text>
        );
      })}

      {/* MA 범례 */}
      {maVisible.map(({ p, color, label }, i) => (
        <g key={p} transform={`translate(${PAD.l + i * 80}, 7)`}>
          <line x1={0} y1={5} x2={14} y2={5} stroke={color} strokeWidth={2} />
          <text x={17} y={9} fontSize={9} fill={color}>{label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── 지표 요약 패널 ────────────────────────────────────────────────────────────
function IndicatorPanel({ stock, method, meta }) {
  let items = [];

  const base = [
    { label: '시가총액', value: stock.marketCapEok ? `${stock.marketCapEok.toLocaleString()}억` : '—' },
    { label: '거래대금(당일)', value: stock.turnoverEok ? `${stock.turnoverEok}억` : '—' },
    { label: '섹터', value: stock.sector || '—' },
  ];

  if (method === 'babgeunset') {
    items = [
      ...base,
      { label: '1년선(224일) 이격도', value: stock.dev224 != null ? `${stock.dev224 > 0 ? '+' : ''}${stock.dev224}%` : '—' },
      { label: '2년선(448일) 이격도', value: stock.dev448 != null ? `${stock.dev448 > 0 ? '+' : ''}${stock.dev448}%` : '—' },
      { label: '구름대 돌파', value: stock.ichimokuBreakBarsAgo ? `${stock.ichimokuBreakBarsAgo}봉 전` : '—' },
      { label: 'CCI 돌파(주봉)', value: stock.cciCrossBarsAgo ? `${stock.cciCrossBarsAgo}주 전` : '—' },
      { label: 'BB 상한 돌파', value: stock.bbBreakBarsAgo ? `${stock.bbBreakBarsAgo}봉 전` : '—' },
      { label: '15봉 최대 거래대금', value: stock.maxTurnover15 ? `${stock.maxTurnover15}억` : '—' },
      { label: '신고 거래량', value: stock.newHighVol ? '✓' : '—' },
    ];
  } else if (method === 'yeokmaegong') {
    items = [
      ...base,
      { label: '역배열 현황', value: stock.reverseAlign || '—', wide: true },
      { label: '112선 이격도', value: stock.dev112 != null ? `${stock.dev112 > 0 ? '+' : ''}${stock.dev112}%` : '—' },
      { label: '매집봉', value: stock.hasAccum ? '✓' : '—' },
      { label: '공구리 수렴', value: stock.hasConsol ? '✓' : '—' },
      { label: 'BB 수렴', value: stock.bbConverging ? '✓' : '—' },
    ];
  } else if (method === 'jijunbong') {
    items = [
      ...base,
      { label: '224선 이격도', value: stock.dev224 != null ? `${stock.dev224 > 0 ? '+' : ''}${stock.dev224}%` : '—' },
      { label: '224선 현재가', value: stock.ma224 ? `₩${stock.ma224?.toLocaleString()}` : '—' },
      { label: '기준봉 시점', value: stock.ma224BreakN ? `${stock.ma224BreakN}봉 전` : '—' },
      { label: '눌림목 하락폭', value: stock.pullbackPct != null ? `-${stock.pullbackPct}%` : '—' },
      { label: '역주행 캔들', value: stock.hasReversal ? '✓' : '—' },
    ];
  } else if (method === 'diving') {
    items = [
      ...base,
      { label: '1파 급등률', value: stock.surgePct != null ? `+${stock.surgePct}%` : '—' },
      { label: '피보 되돌림', value: stock.retracePct != null ? `${Number(stock.retracePct).toFixed(1)}%` : '—' },
      { label: '고점 대비', value: stock.dropFromPeak != null ? `${Number(stock.dropFromPeak).toFixed(1)}%` : '—' },
      { label: '15일선 이격', value: stock.dev15 != null ? `${stock.dev15 > 0 ? '+' : ''}${stock.dev15}%` : '—' },
      { label: '33일선 이격', value: stock.dev33 != null ? `${stock.dev33 > 0 ? '+' : ''}${stock.dev33}%` : '—' },
      { label: '외봉', value: stock.isSinglePeak ? '✓' : '—' },
    ];
  } else if (method === 'dead') {
    items = [
      ...base,
      { label: '급등률', value: stock.surgePct != null ? `+${stock.surgePct}%` : '—' },
      { label: '부채꼴', value: stock.isFanned ? '✓ 형성됨' : '미형성' },
      { label: '부채꼴 폭', value: stock.fanSpreadPct != null ? `${Number(stock.fanSpreadPct).toFixed(1)}%` : '—' },
      { label: 'EMA112 이격', value: stock.devEma112 != null ? `${stock.devEma112 > 0 ? '+' : ''}${stock.devEma112}%` : '—' },
      { label: 'EMA224 이격', value: stock.devEma224 != null ? `${stock.devEma224 > 0 ? '+' : ''}${stock.devEma224}%` : '—' },
      { label: 'EMA448 이격', value: stock.devEma448 != null ? `${stock.devEma448 > 0 ? '+' : ''}${stock.devEma448}%` : '—' },
      { label: 'EMA112 접촉', value: stock.touchCount112 != null ? `${stock.touchCount112}회` : '—' },
      { label: 'EMA224 접촉', value: stock.touchCount224 != null ? `${stock.touchCount224}회` : '—' },
    ];
  }

  return (
    <div className="px-5 pb-5 pt-2">
      <div className="text-xs text-gray-600 mb-2 flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded border text-xs ${meta.badgeCls}`}>{meta.label}</span>
        <span className="text-gray-500">{meta.desc}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {items.map(({ label, value, wide }) => (
          <div key={label} className={`bg-surface-raised rounded px-3 py-2 text-xs ${wide ? 'col-span-2' : ''}`}>
            <div className="text-gray-500 mb-0.5">{label}</div>
            <div className="text-gray-200 font-semibold break-all">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
