'use strict';
/**
 * KIS 기법 스크리너 라우터
 *
 * GET  /api/kis-screener/indicators → 전 종목 지표값 원시 데이터 (클라이언트 실시간 필터용)
 * GET  /api/kis-screener/results    → 기본 조건 통과 결과 (하위 호환)
 * POST /api/kis-screener/run        → 전체 재계산 강제 실행
 * GET  /api/kis-screener/universe   → 전종목 리스트
 *
 * 지원 기법: babgeunset(밥그릇), yeokmaegong(역매공파), jijunbong(기준봉/눌림목), diving(다이빙기법), dead(데드기법)
 * 새벽 1시 크론 자동 실행, 결과 24시간 디스크 캐시
 */
const express   = require('express');
const router    = express.Router();
const NodeCache = require('node-cache');
const fs        = require('fs');
const path      = require('path');

const { getHistorical, getStockInfo } = require('../services/yahoo');   // KIS API는 100봉 제한 → Yahoo Finance 사용
const { getKRFullUniverse } = require('../services/krFullUniverse');
const {
  calcMA, calcDeviation,
  calcBBUpperSeries, calcCCISeries,
  downsampleToWeekly,
  findMACrossUpInN, findIchimokuBreakUpInN, findCrossUpFixedInN, findCrossUpDynamicInN,
  maxTurnoverInN, hasNewHighVolumeInN, hasVolumeSpikeInN,
  avgVolume, avgTurnoverEok,
  hasConsolidation, isBBConverging, hasAccumBar,
  hasReversalCandleInN, highToCurrentPct,
} = require('../services/kisIndicators');

// ── 캐시 ──────────────────────────────────────────────────────────────────────
const cache           = new NodeCache({ stdTTL: 86400 });
const FULL_CACHE_KEY  = 'kis_full_screener';
const IND_CACHE_KEY   = 'kis_indicators';

// 종목별 차트 캐시 (OHLCV, 24h)
const chartCache = new NodeCache({ stdTTL: 86400 });

// ── 디스크 캐시 ───────────────────────────────────────────────────────────────
const FULL_DISK_PATH = path.join(__dirname, '../data/kis-screener-cache.json');
const IND_DISK_PATH  = path.join(__dirname, '../data/kis-indicator-cache.json');

function saveToDisk(type, data) {
  const p = type === 'indicators' ? IND_DISK_PATH : FULL_DISK_PATH;
  try { fs.writeFileSync(p, JSON.stringify(data), 'utf8'); }
  catch (e) { console.warn(`[KIS] 디스크 저장 실패 (${type}):`, e.message); }
}

function loadFromDisk(type) {
  const p = type === 'indicators' ? IND_DISK_PATH : FULL_DISK_PATH;
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`[KIS] 디스크 로드 실패 (${type}):`, e.message);
    return null;
  }
}

// 서버 시작 시 디스크 캐시 복원
(function restoreFromDisk() {
  [['full', FULL_CACHE_KEY], ['indicators', IND_CACHE_KEY]].forEach(([type, key]) => {
    const data = loadFromDisk(type);
    if (!data?.timestamp) return;
    const ageMs = Date.now() - new Date(data.timestamp).getTime();
    if (ageMs >= 24 * 60 * 60 * 1000) {
      console.log(`[KIS] ${type} 캐시 만료 (${data.timestamp})`);
      return;
    }
    const ttl = Math.floor((24 * 60 * 60 * 1000 - ageMs) / 1000);
    cache.set(key, data, ttl);
    const cnt = type === 'indicators' ? data.screened : data.universe;
    console.log(`[KIS] ${type} 캐시 복원 완료 (${data.timestamp}, ${cnt}개)`);
  });
})();

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 공통 필터 ─────────────────────────────────────────────────────────────────
// 크론 실행 시 느슨하게 적용해 더 많은 종목 포함 → 클라이언트에서 세밀 필터
const CRON_FILTER = { minVolume: 10000, minTurnoverEok: 1 };

function passCommonFilter(bars, filters = {}) {
  const { minVolume = 50000, minTurnoverEok = 5 } = filters;
  const volumes = bars.map(b => b.volume);
  if (avgVolume(volumes, 20) < minVolume) return false;
  if (avgTurnoverEok(bars, 20) < minTurnoverEok) return false;
  return true;
}

// ═════════════════════════════════════════════════════════════════════════════
// 지표 계산 함수 — 조건 체크 없이 원시 지표값만 반환
// ═════════════════════════════════════════════════════════════════════════════

function computeBabgeunsetIndicators(bars) {
  if (bars.length < 450) return null;

  const closes  = bars.map(b => b.close);
  const highs   = bars.map(b => b.high);
  const lows    = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume);
  const close   = closes[closes.length - 1];

  const ma224 = calcMA(closes, 224);
  const ma448 = calcMA(closes, 448);
  if (!ma224) return null;

  const dev224 = calcDeviation(close, ma224);
  const dev448 = ma448 ? calcDeviation(close, ma448) : null;

  // MA 돌파 — 최대 30봉 이내
  const maCrossUpBarsAgo224 = findMACrossUpInN(closes, 224, 30) || null;
  const maCrossUpBarsAgo448 = ma448 ? (findMACrossUpInN(closes, 448, 30) || null) : null;

  // 구름대 돌파 — 최대 30봉
  const ichimokuBreakBarsAgo = findIchimokuBreakUpInN(highs, lows, closes, 30) || null;

  // 주봉 CCI(48) -100 상향돌파 — 최대 10주
  let cciCrossBarsAgo = null;
  const weeklyBars = downsampleToWeekly(bars);
  if (weeklyBars.length >= 50) {
    const wC = weeklyBars.map(b => b.close);
    const wH = weeklyBars.map(b => b.high);
    const wL = weeklyBars.map(b => b.low);
    cciCrossBarsAgo = findCrossUpFixedInN(calcCCISeries(wH, wL, wC, 48), -100, 10) || null;
  }

  // BB 상한 돌파 — period 33 / 41 각각 최대 30봉
  const bbBreakBarsAgo33 = findCrossUpDynamicInN(closes, calcBBUpperSeries(closes, 33), 30) || null;
  const bbBreakBarsAgo41 = findCrossUpDynamicInN(closes, calcBBUpperSeries(closes, 41), 30) || null;

  return {
    dev224:               dev224  != null ? +dev224.toFixed(2)  : null,
    dev448:               dev448  != null ? +dev448.toFixed(2)  : null,
    maCrossUpBarsAgo224,
    maCrossUpBarsAgo448,
    ichimokuBreakBarsAgo,
    cciCrossBarsAgo,
    bbBreakBarsAgo33,
    bbBreakBarsAgo41,
    maxTurnover15:        +maxTurnoverInN(bars, 15).toFixed(1),
    newHighVol:           hasNewHighVolumeInN(volumes, 15),
    hasVolumeSpike10:     hasVolumeSpikeInN(volumes, 10, 500),
  };
}

function computeYeokmaegongIndicators(bars) {
  if (bars.length < 450) return null;

  const closes  = bars.map(b => b.close);
  const highs   = bars.map(b => b.high);
  const lows    = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume);
  const close   = closes[closes.length - 1];

  const ma5   = calcMA(closes, 5);
  const ma20  = calcMA(closes, 20);
  const ma60  = calcMA(closes, 60);
  const ma112 = calcMA(closes, 112);
  const ma224 = calcMA(closes, 224);
  const ma448 = calcMA(closes, 448);
  if (!ma112 || !ma224 || !ma448) return null;

  const dev112 = calcDeviation(close, ma112);

  return {
    dev112:         dev112 != null ? +dev112.toFixed(2) : null,
    isReverseAlign: ma448 > ma224 && ma224 > ma112 && ma112 > close,
    isShortTermBull:!!(ma5 && ma20 && ma5 > ma20),
    isAboveMa60:    !!(ma60 && close > ma60),
    hasAccum:       hasAccumBar(volumes, 60, 300),          // 기본값으로 사전 계산
    hasConsol:      hasConsolidation(highs, lows, closes, 20, 10), // 기본값
    bbConverging:   isBBConverging(closes, 20, 2, 60),
    // 표시용 수치 (reverseAlign 문자열 조합용)
    ma112: +ma112.toFixed(0),
    ma224: +ma224.toFixed(0),
    ma448: +ma448.toFixed(0),
    closeRound: Math.round(close),
  };
}

function computeJijunbongIndicators(bars) {
  if (bars.length < 230) return null;

  const closes  = bars.map(b => b.close);
  const highs   = bars.map(b => b.high);
  const volumes = bars.map(b => b.volume);
  const close   = closes[closes.length - 1];
  const ma224   = calcMA(closes, 224);
  if (!ma224) return null;

  const dev224 = calcDeviation(close, ma224);

  // 224일선 돌파 — 최대 60봉
  let ma224BreakBarsAgo = null;
  let ma224BreakIsValid = false;
  const crossN = findMACrossUpInN(closes, 224, 60);
  if (crossN) {
    ma224BreakBarsAgo = crossN;
    const idx = closes.length - crossN;
    if (idx > 0) {
      const isUp   = closes[idx] > bars[idx].open;
      const avgVol = avgVolume(volumes.slice(0, idx), 20);
      ma224BreakIsValid = isUp && volumes[idx] >= avgVol * 2;
    }
  }

  return {
    ma224:            +ma224.toFixed(0),
    dev224:           dev224 != null ? +dev224.toFixed(2) : null,
    ma224BreakBarsAgo,
    ma224BreakIsValid,
    pullbackPct:      +highToCurrentPct(closes, highs, 30).toFixed(1),
    hasReversal10:    hasReversalCandleInN(closes, 10),
    hasReversal30:    hasReversalCandleInN(closes, 30),
  };
}

// ── EMA 헬퍼 (데드기법 전용 — 종가 기준 지수이동평균) ─────────────────────────
function calcEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

function calcEMASeries(closes, period) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < period) return out;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = ema;
  for (let i = period; i < closes.length; i++) { ema = closes[i] * k + ema * (1 - k); out[i] = ema; }
  return out;
}

// 최근 N봉에서 종가와 EMA 시계열의 교차 횟수 = 접촉 횟수
function countEMACrossings(closes, emaSeries, lookback) {
  let count = 0;
  const start = Math.max(closes.length - lookback, 1);
  for (let i = start; i < closes.length; i++) {
    if (emaSeries[i] == null || emaSeries[i - 1] == null) continue;
    if ((closes[i - 1] >= emaSeries[i - 1]) !== (closes[i] >= emaSeries[i])) count++;
  }
  return count;
}

function computeDeadIndicators(bars) {
  if (bars.length < 450) return null;

  const closes  = bars.map(b => b.close);
  const highs   = bars.map(b => b.high);
  const close   = closes[closes.length - 1];

  const ema112 = calcEMA(closes, 112);
  const ema224 = calcEMA(closes, 224);
  const ema448 = calcEMA(closes, 448);
  if (!ema112 || !ema224 || !ema448) return null;

  const devEma112 = calcDeviation(close, ema112);
  const devEma224 = calcDeviation(close, ema224);
  const devEma448 = calcDeviation(close, ema448);

  // 부채꼴: EMA112 > EMA224 > EMA448
  const isFanned     = ema112 > ema224 && ema224 > ema448;
  const fanSpreadPct = ema448 > 0 ? (ema112 - ema448) / ema448 * 100 : 0;

  // 급등: 최근 150봉 내 저점→고점
  const SURGE_WINDOW = 150;
  const wStart = Math.max(0, closes.length - SURGE_WINDOW);
  let peakGIdx = wStart, peakHigh = highs[wStart];
  for (let i = wStart + 1; i < highs.length; i++) {
    if (highs[i] > peakHigh) { peakHigh = highs[i]; peakGIdx = i; }
  }
  let trough = closes[wStart];
  for (let i = wStart; i <= peakGIdx; i++) { if (closes[i] < trough) trough = closes[i]; }
  const surgePct = trough > 0 ? (peakHigh - trough) / trough * 100 : 0;

  // 접촉 횟수: 최근 30봉 내 각 EMA 교차 수
  const ema112Series = calcEMASeries(closes, 112);
  const ema224Series = calcEMASeries(closes, 224);
  const ema448Series = calcEMASeries(closes, 448);
  const touchCount112 = countEMACrossings(closes, ema112Series, 30);
  const touchCount224 = countEMACrossings(closes, ema224Series, 30);
  const touchCount448 = countEMACrossings(closes, ema448Series, 30);

  return {
    ema112:       +ema112.toFixed(0),
    ema224:       +ema224.toFixed(0),
    ema448:       +ema448.toFixed(0),
    devEma112:    devEma112 != null ? +devEma112.toFixed(2) : null,
    devEma224:    devEma224 != null ? +devEma224.toFixed(2) : null,
    devEma448:    devEma448 != null ? +devEma448.toFixed(2) : null,
    isFanned,
    fanSpreadPct: +fanSpreadPct.toFixed(1),
    surgePct:     +surgePct.toFixed(1),
    touchCount112,
    touchCount224,
    touchCount448,
  };
}

function computeDivingIndicators(bars) {
  if (bars.length < 50) return null;

  const closes  = bars.map(b => b.close);
  const highs   = bars.map(b => b.high);
  const volumes = bars.map(b => b.volume);
  const close   = closes[closes.length - 1];

  const ma15 = calcMA(closes, 15);
  const ma33 = calcMA(closes, 33);
  if (!ma15 || !ma33) return null;

  const dev15 = calcDeviation(close, ma15);
  const dev33 = calcDeviation(close, ma33);

  // ── 급등 탐지: 최근 90봉 내 고점 ────────────────────────────────────────
  const SURGE_WINDOW = 90;
  const wStart = Math.max(0, closes.length - SURGE_WINDOW);

  let peakGIdx = wStart;
  let peakHigh = highs[wStart];
  for (let i = wStart + 1; i < highs.length; i++) {
    if (highs[i] > peakHigh) { peakHigh = highs[i]; peakGIdx = i; }
  }

  // 고점 이전 저점 (closes 기준)
  let trough = closes[wStart];
  let troughGIdx = wStart;
  for (let i = wStart; i <= peakGIdx; i++) {
    if (closes[i] < trough) { trough = closes[i]; troughGIdx = i; }
  }

  const surgePct    = trough > 0 ? (peakHigh - trough) / trough * 100 : 0;
  const surgeBarsAgo = closes.length - 1 - peakGIdx;

  // 급등 구간 거래량: 고점 ±5봉 최대 vs 20일 평균
  const avg20Vol     = avgVolume(volumes, 20);
  const vFrom        = Math.max(0, peakGIdx - 5);
  const vTo          = Math.min(volumes.length - 1, peakGIdx + 5);
  const maxSurgeVol  = Math.max(...volumes.slice(vFrom, vTo + 1));
  const surgeVolRatio = avg20Vol > 0 ? maxSurgeVol / avg20Vol : 0;

  // 최근 60봉 내 224일선 아래 있었는지
  let belowMa224In60 = false;
  if (closes.length >= 224) {
    const checkFrom = Math.max(223, closes.length - 60);
    for (let i = checkFrom; i < closes.length; i++) {
      const ma224AtI = closes.slice(i - 223, i + 1).reduce((a, b) => a + b, 0) / 224;
      if (closes[i] < ma224AtI) { belowMa224In60 = true; break; }
    }
  }

  // 외봉 여부: 고점 이후 highs 중 고점의 90% 이상 없으면 외봉
  const afterPeakHighs = highs.slice(peakGIdx + 1);
  const isSinglePeak   = afterPeakHighs.length === 0
    || !afterPeakHighs.some(h => h >= peakHigh * 0.90);

  // 고점 대비 현재 하락률 (음수)
  const dropFromPeak = peakHigh > 0 ? (close - peakHigh) / peakHigh * 100 : 0;

  // ── 엘리엇 2파 판단 ──────────────────────────────────────────────────────
  // 1파 크기 = 고점 - 저점
  const wave1Size = peakHigh - trough;
  // 피보나치 되돌림 비율: 현재 하락이 1파 상승폭의 몇 %인지
  const retracePct = wave1Size > 0 ? (peakHigh - close) / wave1Size * 100 : 0;
  // 2파의 핵심 규칙: 현재가가 1파 시작점(저점)을 깨면 안 됨
  const wave1StartOk = close > trough;

  return {
    dev15:           dev15 != null ? +dev15.toFixed(2) : null,
    dev33:           dev33 != null ? +dev33.toFixed(2) : null,
    surgePct:        +surgePct.toFixed(1),
    surgeBarsAgo,
    surgeVolRatio:   +surgeVolRatio.toFixed(1),
    belowMa224In60,
    isSinglePeak,
    dropFromPeak:    +dropFromPeak.toFixed(1),
    retracePct:      +retracePct.toFixed(1),
    wave1StartOk,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 조건 적용 함수 — 지표값 + 조건 → boolean
// (프론트엔드의 clientFilter*.js 와 동일한 로직)
// ═════════════════════════════════════════════════════════════════════════════

function applyBabgeunsetConditions(ind, cond = {}) {
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

function applyYeokmaegongConditions(ind, cond = {}) {
  if (!ind) return false;
  const {
    reverseAlignment = true,
    shortTermBull = true,
    accumBar = true,
    consolidation = true,
    bbConverge = true,
    ma112Near = true, ma112NearMin = -3, ma112NearMax = 2,
    aboveMa60 = true,
  } = cond;

  if (reverseAlignment  && !ind.isReverseAlign) return false;
  if (shortTermBull) {
    if (!ind.isShortTermBull) return false;
    if (aboveMa60 && !ind.isAboveMa60) return false;
  }
  if (accumBar     && !ind.hasAccum)     return false;
  if (consolidation && !ind.hasConsol)   return false;
  if (bbConverge   && !ind.bbConverging) return false;
  if (ma112Near && ind.dev112 != null &&
      (ind.dev112 < ma112NearMin || ind.dev112 > ma112NearMax)) return false;
  return true;
}

function applyJijunbongConditions(ind, cond = {}) {
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
    const ok = reversalBars <= 10 ? ind.hasReversal10 : ind.hasReversal30;
    if (!ok) return false;
  }
  return true;
}

function applyDeadConditions(ind, cond = {}) {
  if (!ind) return false;
  const {
    surgePctCheck = true,  surgePctMin  = 50,
    fannedCheck   = true,  fanSpreadMin = 5,
    maxTouches    = 1,
    nearEma112    = true,  ema112Min = -5, ema112Max = 10,
    nearEma224    = true,  ema224Min = -5, ema224Max = 10,
    nearEma448    = false, ema448Min = -5, ema448Max = 10,
  } = cond;

  if (surgePctCheck && ind.surgePct < surgePctMin)  return false;
  if (fannedCheck) {
    if (!ind.isFanned)                              return false;
    if (ind.fanSpreadPct < fanSpreadMin)            return false;
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

function applyDivingConditions(ind, cond = {}) {
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

  if (surgePctCheck && ind.surgePct < surgePctMin)              return false;
  if (surgeVolCheck && ind.surgeVolRatio < surgeVolRatioMin)    return false;
  if (belowMa224    && !ind.belowMa224In60)                     return false;
  if (singlePeak    && !ind.isSinglePeak)                       return false;
  if (dropCheck) {
    if (ind.dropFromPeak > -dropMin || ind.dropFromPeak < -dropMax) return false;
  }
  // 엘리엇 2파: 피보나치 되돌림 구간
  if (fibCheck && (ind.retracePct < fibMin || ind.retracePct > fibMax)) return false;
  // 엘리엇 핵심 규칙: 2파는 1파 시작점을 깰 수 없음
  if (wave1Rule && !ind.wave1StartOk) return false;
  if (nearMa15 || nearMa33) {
    let ok = false;
    if (nearMa15 && ind.dev15 != null && ind.dev15 >= ma15NearMin && ind.dev15 <= ma15NearMax) ok = true;
    if (nearMa33 && ind.dev33 != null && ind.dev33 >= ma33NearMin && ind.dev33 <= ma33NearMax) ok = true;
    if (!ok) return false;
  }
  return true;
}

// ═════════════════════════════════════════════════════════════════════════════
// 결과 변환 헬퍼 — 지표 raw 데이터 → 테이블 표시용 객체
// ═════════════════════════════════════════════════════════════════════════════

function baseOf(s) {
  return {
    code: s.code, name: s.name, market: s.market,
    sector: s.sector, marketCapEok: s.marketCapEok,
    close: s.close, dayChange: s.dayChange,
    volume: s.volume, turnoverEok: s.turnoverEok,
  };
}

function toBabgeunsetResult(s, cond = {}) {
  const ind = s.babgeunset;
  const bbPeriod = cond.bbPeriod || 33;
  const bbBreakBarsAgo = bbPeriod === 41
    ? (ind.bbBreakBarsAgo41 || ind.bbBreakBarsAgo33)
    : (ind.bbBreakBarsAgo33 || ind.bbBreakBarsAgo41);
  return {
    ...baseOf(s), method: 'babgeunset', methodLabel: '밥그릇 3번자리',
    dev224: ind.dev224, dev448: ind.dev448,
    ichimokuBreakBarsAgo: ind.ichimokuBreakBarsAgo,
    cciCrossBarsAgo: ind.cciCrossBarsAgo,
    bbBreakBarsAgo,
    maxTurnover15: ind.maxTurnover15, newHighVol: ind.newHighVol,
  };
}

function toYeokmaegongResult(s) {
  const ind = s.yeokmaegong;
  return {
    ...baseOf(s), method: 'yeokmaegong', methodLabel: '역매공파 112',
    dev112: ind.dev112,
    reverseAlign: `${ind.ma448} > ${ind.ma224} > ${ind.ma112} > ${ind.closeRound}`,
    hasAccum: ind.hasAccum, hasConsol: ind.hasConsol, bbConverging: ind.bbConverging,
  };
}

function toJijunbongResult(s) {
  const ind = s.jijunbong;
  return {
    ...baseOf(s), method: 'jijunbong', methodLabel: '기준봉/눌림목',
    ma224: ind.ma224, dev224: ind.dev224,
    ma224BreakN: ind.ma224BreakBarsAgo,
    pullbackPct: ind.pullbackPct,
    hasReversal: ind.hasReversal10,
  };
}

function toDeadResult(s) {
  const ind = s.dead;
  return {
    ...baseOf(s), method: 'dead', methodLabel: '데드기법',
    surgePct:     ind.surgePct,
    fanSpreadPct: ind.fanSpreadPct,
    devEma112:    ind.devEma112,
    devEma224:    ind.devEma224,
    devEma448:    ind.devEma448,
    touchCount112: ind.touchCount112,
    touchCount224: ind.touchCount224,
  };
}

function toDivingResult(s) {
  const ind = s.diving;
  return {
    ...baseOf(s), method: 'diving', methodLabel: '다이빙기법',
    surgePct:      ind.surgePct,
    retracePct:    ind.retracePct,
    dropFromPeak:  ind.dropFromPeak,
    dev15:         ind.dev15,
    dev33:         ind.dev33,
    isSinglePeak:  ind.isSinglePeak,
    surgeVolRatio: ind.surgeVolRatio,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 단일 종목 전 지표 계산
// ═════════════════════════════════════════════════════════════════════════════

async function computeStockAllIndicators(stock, commonFilters) {
  try {
    // Yahoo Finance: 1100 캘린더일 ≈ 약 750 거래일 (밥그릇 522봉 충분)
    // 심볼: 코드 + .KS / .KQ
    const suffix = stock.market === 'KOSPI' ? '.KS' : '.KQ';
    const symbol = `${stock.code}${suffix}`;
    const rawBars = await getHistorical(symbol, 1100);
    if (!rawBars || rawBars.length < 100) return null;

    // Yahoo Finance에는 turnover 없음 → close × volume으로 계산 (원 단위)
    const bars = rawBars.map(b => ({ ...b, turnover: b.close * b.volume }));

    if (!passCommonFilter(bars, commonFilters)) return null;

    const lastBar = bars[bars.length - 1];
    const prevBar = bars[bars.length - 2];
    const dayChange = prevBar?.close > 0
      ? ((lastBar.close - prevBar.close) / prevBar.close) * 100 : 0;
    const volumes = bars.map(b => b.volume);

    return {
      code:             stock.code,
      name:             stock.name,
      market:           stock.market,
      sector:           stock.sector,
      marketCapEok:     stock.marketCapEok,
      close:            Math.round(lastBar.close),
      dayChange:        +dayChange.toFixed(2),
      volume:           lastBar.volume,
      turnoverEok:      +(lastBar.turnover / 1e8).toFixed(1),
      avgVol20:         Math.round(avgVolume(volumes, 20)),
      avgTurnoverEok20: +avgTurnoverEok(bars, 20).toFixed(1),
      babgeunset:       computeBabgeunsetIndicators(bars),
      yeokmaegong:      computeYeokmaegongIndicators(bars),
      jijunbong:        computeJijunbongIndicators(bars),
      diving:           computeDivingIndicators(bars),
      dead:             computeDeadIndicators(bars),
    };
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 전체 스크리너 실행 (크론 01:00 + POST /run)
// ═════════════════════════════════════════════════════════════════════════════

async function runFullScreener() {
  console.log('[KIS] 전체 스크리너 시작');

  const naverUniverse = await getKRFullUniverse();
  const universe = naverUniverse.map(u => ({
    code:     u.symbol.replace(/\.(KS|KQ)$/, ''),
    name:     u.name,
    market:   u.symbol.endsWith('.KS') ? 'KOSPI' : 'KOSDAQ',
    sector:   '',
    marketCapEok: 0,
  }));
  console.log(`[KIS] 유니버스: ${universe.length}개 (관리/정지/ETF 제외)`);

  const allIndicators = [];
  const BATCH = 10;
  const BATCH_DELAY = 500;

  for (let i = 0; i < universe.length; i += BATCH) {
    const batch   = universe.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(s => computeStockAllIndicators(s, CRON_FILTER))
    );
    settled.forEach(r => { if (r.status === 'fulfilled' && r.value) allIndicators.push(r.value); });

    if ((i / BATCH) % 20 === 0) {
      console.log(`[KIS] 스크리닝 진행: ${Math.min(i + BATCH, universe.length)} / ${universe.length}`);
    }
    if (i + BATCH < universe.length) await sleep(BATCH_DELAY);
  }

  const timestamp = new Date().toISOString();

  // 지표 원시 데이터 저장 (클라이언트 실시간 필터용)
  const indPayload = {
    data:      allIndicators,
    timestamp,
    universe:  universe.length,
    screened:  allIndicators.length,
  };
  cache.set(IND_CACHE_KEY, indPayload, 24 * 60 * 60);
  saveToDisk('indicators', indPayload);

  // 기본 조건 결과 생성 (하위 호환 / /results 엔드포인트용)
  const hits = { babgeunset: [], yeokmaegong: [], jijunbong: [], diving: [], dead: [] };
  allIndicators.forEach(s => {
    if (applyBabgeunsetConditions(s.babgeunset))   hits.babgeunset.push(toBabgeunsetResult(s));
    if (applyYeokmaegongConditions(s.yeokmaegong)) hits.yeokmaegong.push(toYeokmaegongResult(s));
    if (applyJijunbongConditions(s.jijunbong))     hits.jijunbong.push(toJijunbongResult(s));
    if (applyDivingConditions(s.diving))            hits.diving.push(toDivingResult(s));
    if (applyDeadConditions(s.dead))               hits.dead.push(toDeadResult(s));
  });

  const fullPayload = {
    results:   hits,
    universe:  universe.length,
    timestamp,
    summary:   Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, v.length])),
  };
  cache.set(FULL_CACHE_KEY, fullPayload, 24 * 60 * 60);
  saveToDisk('full', fullPayload);

  console.log('[KIS] 완료:', fullPayload.summary, `| 지표: ${allIndicators.length}개`);
  return fullPayload;
}

// ── GET /api/kis-screener/indicators ─────────────────────────────────────────
router.get('/indicators', (req, res) => {
  const cached = cache.get(IND_CACHE_KEY);
  if (cached) return res.json({ ...cached, fromCache: true });
  res.json({
    pending: true,
    message: '지표 데이터가 없습니다. 매 영업일 새벽 1시에 자동 업데이트됩니다.',
  });
});

// ── GET /api/kis-screener/results ─────────────────────────────────────────────
router.get('/results', (req, res) => {
  const cached = cache.get(FULL_CACHE_KEY);
  if (cached) return res.json({ ...cached, fromCache: true });
  res.json({
    pending: true,
    message: '스크리닝 결과가 없습니다. 매 영업일 새벽 1시에 자동 업데이트됩니다.',
    timestamp: null,
  });
});

// ── POST /api/kis-screener/run ────────────────────────────────────────────────
router.post('/run', async (req, res) => {
  const cached = cache.get(IND_CACHE_KEY);
  if (cached && !req.body?.force) {
    return res.json({
      fromCache: true,
      message:   '캐시 결과 반환 (force:true로 재실행)',
      timestamp: cached.timestamp,
      screened:  cached.screened,
    });
  }
  res.json({ accepted: true, message: '스크리닝 시작 — /api/kis-screener/indicators 에서 완료 후 확인.' });
  runFullScreener().catch(e => console.error('[KIS /run]', e.message));
});

// ── GET /api/kis-screener/chart/:code ────────────────────────────────────────
// 종목 캔들스틱 차트 데이터 (OHLCV, 캐시 24h)
router.get('/chart/:code', async (req, res) => {
  const { code } = req.params;
  const market   = (req.query.market || 'KOSPI').toUpperCase();
  const cacheKey = `chart_${code}_${market}`;

  const cached = chartCache.get(cacheKey);
  if (cached) return res.json({ ...cached, fromCache: true });

  try {
    const suffix = market === 'KOSDAQ' ? '.KQ' : '.KS';
    const symbol = `${code}${suffix}`;
    // 3650 캘린더일 ≈ 10년 (1Y/3Y/5Y/10Y 기간 버튼 지원)
    const rawBars = await getHistorical(symbol, 3650);
    if (!rawBars || rawBars.length === 0) {
      return res.status(404).json({ error: '차트 데이터 없음' });
    }

    const ohlcv = rawBars.map(b => ({
      date:   b.date instanceof Date ? b.date.toISOString().slice(0, 10) : String(b.date).slice(0, 10),
      open:   b.open,
      high:   b.high,
      low:    b.low,
      close:  b.close,
      volume: b.volume,
    }));

    // 시총·섹터는 캐시된 스크리너 데이터에 없으므로 실시간 조회
    const info = await getStockInfo(symbol);

    const result = { code, market, ohlcv, ...info };
    chartCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[KIS chart] ${code}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/kis-screener/universe ────────────────────────────────────────────
router.get('/universe', async (req, res) => {
  try {
    const universe = await getKRFullUniverse();
    res.json({ count: universe.length, stocks: universe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 크론(server.js 01:00)에서 호출
router.runFullScreener = runFullScreener;
module.exports = router;
