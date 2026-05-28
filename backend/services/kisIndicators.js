'use strict';
/**
 * 기술적 지표 계산 모듈 (KIS 스크리너용)
 * 모든 함수는 순수 함수 — 외부 상태 없음
 */

// ── 이동평균 ──────────────────────────────────────────────────────────────────

function calcMA(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** 이격도 (%) */
function calcDeviation(price, ma) {
  if (!ma || ma === 0) return null;
  return ((price - ma) / ma) * 100;
}

// ── 볼린저밴드 ────────────────────────────────────────────────────────────────

function _bbCalc(closes, period, mult = 2) {
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const std  = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  return {
    upper:     mean + mult * std,
    middle:    mean,
    lower:     mean - mult * std,
    bandwidth: std > 0 ? (mult * 2 * std) / mean * 100 : 0,
  };
}

/** 볼린저밴드 현재값 */
function calcBollingerBands(closes, period, mult = 2) {
  if (closes.length < period) return null;
  return _bbCalc(closes, period, mult);
}

/**
 * 볼린저밴드 상한선 시계열 반환 (전체 구간)
 * @returns {number[]}  closes와 동일 길이, 충분한 데이터 없는 초반은 null
 */
function calcBBUpperSeries(closes, period, mult = 2) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    const mean  = slice.reduce((a, b) => a + b, 0) / period;
    const std   = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    return mean + mult * std;
  });
}

/**
 * 볼린저밴드 폭(Bandwidth) 시계열
 * @returns {number[]}
 */
function calcBBBandwidthSeries(closes, period, mult = 2) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    const mean  = slice.reduce((a, b) => a + b, 0) / period;
    const std   = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    return mean > 0 ? (mult * 2 * std) / mean * 100 : null;
  });
}

// ── CCI (Commodity Channel Index) ────────────────────────────────────────────

/**
 * CCI 시계열 반환
 * CCI = (TP - SMA_TP) / (0.015 * MeanDev_TP)
 */
function calcCCISeries(highs, lows, closes, period) {
  const len = closes.length;
  const result = new Array(len).fill(null);
  for (let i = period - 1; i < len; i++) {
    const tps = [];
    for (let j = i - period + 1; j <= i; j++) {
      tps.push((highs[j] + lows[j] + closes[j]) / 3);
    }
    const mean = tps.reduce((a, b) => a + b, 0) / period;
    const md   = tps.reduce((a, tp) => a + Math.abs(tp - mean), 0) / period;
    result[i] = md === 0 ? 0 : (tps[tps.length - 1] - mean) / (0.015 * md);
  }
  return result;
}

// ── 일봉 → 주봉 다운샘플링 ───────────────────────────────────────────────────

/**
 * 일봉 배열(oldest first)을 주봉으로 변환
 * @param {Array<{open,high,low,close,volume,turnover}>} dailyBars
 * @returns {Array<{open,high,low,close,volume,turnover}>}
 */
function downsampleToWeekly(dailyBars, weekSize = 5) {
  const result = [];
  for (let i = 0; i < dailyBars.length; i += weekSize) {
    const chunk = dailyBars.slice(i, i + weekSize);
    if (chunk.length === 0) continue;
    result.push({
      open:     chunk[0].open,
      high:     Math.max(...chunk.map(d => d.high)),
      low:      Math.min(...chunk.map(d => d.low)),
      close:    chunk[chunk.length - 1].close,
      volume:   chunk.reduce((a, d) => a + d.volume, 0),
      turnover: chunk.reduce((a, d) => a + d.turnover, 0),
    });
  }
  return result;
}

// ── 이치모쿠 구름대 ───────────────────────────────────────────────────────────

function _midpoint(highs, lows, period, idx) {
  if (idx < period - 1) return null;
  let maxH = -Infinity, minL = Infinity;
  for (let j = idx - period + 1; j <= idx; j++) {
    if (highs[j] > maxH) maxH = highs[j];
    if (lows[j]  < minL) minL = lows[j];
  }
  return (maxH + minL) / 2;
}

/**
 * 이치모쿠 구름대 상단/하단 시계열 반환
 * (선행 스팬 A, B를 26봉 이전으로 shift해서 현재 구름 계산)
 */
function calcIchimokuCloudSeries(highs, lows) {
  const n = highs.length;
  const spanA = new Array(n).fill(null);
  const spanB = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const tenkan = _midpoint(highs, lows, 9,  i);
    const kijun  = _midpoint(highs, lows, 26, i);
    if (tenkan !== null && kijun !== null) spanA[i] = (tenkan + kijun) / 2;
    spanB[i] = _midpoint(highs, lows, 52, i);
  }

  // 현재 구름 = 26봉 전에 계산된 SpanA/B
  const cloudTop    = new Array(n).fill(null);
  const cloudBottom = new Array(n).fill(null);
  for (let i = 26; i < n; i++) {
    const a = spanA[i - 26];
    const b = spanB[i - 26];
    if (a !== null && b !== null) {
      cloudTop[i]    = Math.max(a, b);
      cloudBottom[i] = Math.min(a, b);
    }
  }
  return { cloudTop, cloudBottom };
}

// ── 교차 탐지 ─────────────────────────────────────────────────────────────────

/**
 * 고정 임계값 상향 돌파를 최근 n봉 내에서 찾기
 * @returns {number|null}  몇 봉 전인지 (1=직전봉), null=미발생
 */
function findCrossUpFixedInN(series, threshold, n) {
  const len = series.length;
  for (let i = len - 1; i >= Math.max(1, len - n); i--) {
    if (series[i] > threshold && series[i - 1] <= threshold) {
      return len - i; // bars ago (1-based)
    }
  }
  return null;
}

/**
 * 동적 임계값(시계열) 상향 돌파를 최근 n봉 내에서 찾기
 * @param {number[]} values     가격 시계열
 * @param {(number|null)[]} thresholds  임계값 시계열 (같은 길이)
 * @returns {number|null}
 */
function findCrossUpDynamicInN(values, thresholds, n) {
  const len = values.length;
  for (let i = len - 1; i >= Math.max(1, len - n); i--) {
    const th0 = thresholds[i];
    const th1 = thresholds[i - 1];
    if (th0 === null || th1 === null) continue;
    if (values[i] > th0 && values[i - 1] <= th1) {
      return len - i;
    }
  }
  return null;
}

/**
 * 가격이 이평선을 최근 n봉 내에 상향 돌파했는지
 * 이평선 시계열 자체를 계산해서 탐지
 */
function findMACrossUpInN(closes, maPeriod, n) {
  const len = closes.length;
  if (len < maPeriod + n) return null;
  const maSeries = closes.map((_, i) => {
    if (i < maPeriod - 1) return null;
    return closes.slice(i - maPeriod + 1, i + 1).reduce((a, b) => a + b, 0) / maPeriod;
  });
  return findCrossUpDynamicInN(closes, maSeries, n);
}

// ── 이치모쿠 상향 돌파 ───────────────────────────────────────────────────────

function findIchimokuBreakUpInN(highs, lows, closes, n) {
  const { cloudTop } = calcIchimokuCloudSeries(highs, lows);
  return findCrossUpDynamicInN(closes, cloudTop, n);
}

// ── 거래량 / 거래대금 분석 ────────────────────────────────────────────────────

/** 최근 n봉 이내 최대 거래대금 (억원) */
function maxTurnoverInN(bars, n) {
  const slice = bars.slice(-n);
  return Math.max(...slice.map(b => b.turnover)) / 1e8;
}

/** 최근 n봉 이내 거래량이 해당 종목 기준봉 신고가인지 */
function hasNewHighVolumeInN(volumes, n) {
  if (volumes.length < 2) return false;
  const recent    = volumes.slice(-n);
  const baseline  = volumes.slice(0, -n);
  if (baseline.length === 0) return false;
  const maxBaseline = Math.max(...baseline);
  return Math.max(...recent) > maxBaseline;
}

/** 최근 n봉 이내 직전봉 대비 x% 거래량 급증 */
function hasVolumeSpikeInN(volumes, n, thresholdPct = 500) {
  const slice = volumes.slice(-n - 1);
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1];
    if (prev > 0 && (slice[i] / prev) * 100 >= thresholdPct) return true;
  }
  return false;
}

/** 평균 거래량 (최근 period봉) */
function avgVolume(volumes, period = 20) {
  const slice = volumes.slice(-period);
  return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
}

/** 평균 거래대금 (억원, 최근 period봉) */
function avgTurnoverEok(bars, period = 20) {
  const slice = bars.slice(-period);
  return slice.length > 0
    ? slice.reduce((a, b) => a + b.turnover, 0) / slice.length / 1e8
    : 0;
}

// ── 공구리 (횡보 탐지) ───────────────────────────────────────────────────────

/**
 * 최근 bars에서 minBars 이상 횡보 구간이 있는지
 * 횡보 = 최고가-최저가 범위가 maxRangePct% 이내, 저점 갱신 없음
 */
function hasConsolidation(highs, lows, closes, minBars = 20, maxRangePct = 10) {
  const len = closes.length;
  if (len < minBars) return false;

  // 최근 80봉에서 탐색
  const lookback = Math.min(len, 80);
  const hSlice   = highs.slice(-lookback);
  const lSlice   = lows.slice(-lookback);

  let bestLen = 0;
  for (let start = 0; start < lookback - minBars; start++) {
    const windowH = hSlice.slice(start, start + minBars);
    const windowL = lSlice.slice(start, start + minBars);
    const maxH = Math.max(...windowH);
    const minL = Math.min(...windowL);
    if (minL <= 0) continue;
    const rangePct = (maxH - minL) / minL * 100;
    if (rangePct <= maxRangePct) {
      // 저점 갱신 없음 확인
      let noNewLow = true;
      let runningMin = lSlice[start];
      for (let k = start + 1; k < start + minBars; k++) {
        if (lSlice[k] < runningMin * 0.995) { noNewLow = false; break; }
        runningMin = Math.min(runningMin, lSlice[k]);
      }
      if (noNewLow) bestLen = Math.max(bestLen, minBars);
    }
  }
  return bestLen >= minBars;
}

// ── 볼린저 수렴 탐지 ─────────────────────────────────────────────────────────

/**
 * 현재 밴드폭이 lookback 구간의 최솟값과 가까운지 (closePct% 이내)
 */
function isBBConverging(closes, period = 20, mult = 2, lookback = 60, closePct = 200) {
  const bwSeries = calcBBBandwidthSeries(closes, period, mult)
    .slice(-lookback)
    .filter(v => v !== null);
  if (bwSeries.length < 10) return false;
  const minBw  = Math.min(...bwSeries);
  const currBw = bwSeries[bwSeries.length - 1];
  return currBw <= minBw * (1 + closePct / 100);
}

// ── 매집봉 탐지 ──────────────────────────────────────────────────────────────

/**
 * 최근 lookbackBars 이내에 평균 대비 thresholdPct% 이상 거래량 봉이 있는지
 */
function hasAccumBar(volumes, lookbackBars = 60, thresholdPct = 300) {
  if (volumes.length < lookbackBars + 20) return false;
  const baseline    = volumes.slice(0, -lookbackBars);
  const avgVol      = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const recentVols  = volumes.slice(-lookbackBars);
  return recentVols.some(v => v >= avgVol * (thresholdPct / 100));
}

// ── 역주행 캔들 탐지 ─────────────────────────────────────────────────────────

/**
 * 최근 n봉 이내에 역주행 캔들(하락 추세 중 강한 양봉)이 있는지
 * 조건: 전날보다 종가 > 3% 상승, 음봉 3봉 이상 연속 후
 */
function hasReversalCandleInN(closes, n = 10) {
  const len = closes.length;
  const slice = closes.slice(-n - 3);
  for (let i = 3; i < slice.length; i++) {
    // 최소 2봉 연속 하락 후 강한 양봉
    const prevDown = slice[i - 2] < slice[i - 3] && slice[i - 1] < slice[i - 2];
    const strongUp = (slice[i] - slice[i - 1]) / slice[i - 1] * 100 >= 3;
    if (prevDown && strongUp) return true;
  }
  return false;
}

/**
 * 최근 고점 대비 현재 하락률 (%) — 눌림목 탐지용
 * @returns {number}  양수 = 하락, 음수 = 고점 위
 */
function highToCurrentPct(closes, highs, lookback = 30) {
  const recentHighs = highs.slice(-lookback);
  const peak = Math.max(...recentHighs);
  const curr = closes[closes.length - 1];
  if (peak === 0) return 0;
  return (peak - curr) / peak * 100; // 양수 = 고점 아래
}

module.exports = {
  calcMA,
  calcDeviation,
  calcBollingerBands,
  calcBBUpperSeries,
  calcBBBandwidthSeries,
  calcCCISeries,
  downsampleToWeekly,
  calcIchimokuCloudSeries,
  findCrossUpFixedInN,
  findCrossUpDynamicInN,
  findMACrossUpInN,
  findIchimokuBreakUpInN,
  maxTurnoverInN,
  hasNewHighVolumeInN,
  hasVolumeSpikeInN,
  avgVolume,
  avgTurnoverEok,
  hasConsolidation,
  isBBConverging,
  hasAccumBar,
  hasReversalCandleInN,
  highToCurrentPct,
};
