'use strict';
/**
 * 한국 종목 스코어링 — 지표 계산 + 점수 함수 모음
 *
 * 모든 점수 함수: { score: 0~100, value: 표시값, label: '강함/보통/약함' 등, color: 'green|blue|yellow|red' }
 */

// ═════════════════════════════════════════════════════════════════════════════
// 1. 기본 유틸
// ═════════════════════════════════════════════════════════════════════════════
const clamp = (s, min = 0, max = 100) => Math.max(min, Math.min(max, s));
const round = (n, d = 1) => n == null || isNaN(n) ? null : +n.toFixed(d);

function colorOf(score) {
  if (score == null) return 'gray';
  if (score >= 75) return 'green';
  if (score >= 55) return 'blue';
  if (score >= 40) return 'yellow';
  return 'red';
}

function labelOf(score) {
  if (score == null) return '—';
  if (score >= 75) return '강함';
  if (score >= 55) return '양호';
  if (score >= 40) return '보통';
  return '약함';
}

function mkResult(score, value, comment = '') {
  return { score: score == null ? null : clamp(Math.round(score)), value, label: labelOf(score), color: colorOf(score), comment };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. 기본 지표 계산 (RSI/ADX/ATR/MACD/OBV/볼린저)
// ═════════════════════════════════════════════════════════════════════════════

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch > 0) gains += ch; else losses -= ch;
  }
  let avgG = gains / period, avgL = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = ch > 0 ? ch : 0, l = ch < 0 ? -ch : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
  }
  if (avgL === 0) return 100;
  return 100 - 100 / (1 + (avgG / avgL));
}

function atr(highs, lows, closes, period = 14) {
  if (highs.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < trs.length; i++) a = (a * (period - 1) + trs[i]) / period;
  return a;
}

// ADX (Average Directional Index) — Wilder method
function adx(highs, lows, closes, period = 14) {
  if (highs.length < period * 2) return null;
  const tr = [], plusDM = [], minusDM = [];
  for (let i = 1; i < highs.length; i++) {
    const upMove   = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  let atrW   = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let plusW  = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let minusW = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  const dxList = [];
  for (let i = period; i < tr.length; i++) {
    atrW   = atrW   - atrW   / period + tr[i];
    plusW  = plusW  - plusW  / period + plusDM[i];
    minusW = minusW - minusW / period + minusDM[i];
    const plusDI  = 100 * plusW  / atrW;
    const minusDI = 100 * minusW / atrW;
    const sum = plusDI + minusDI;
    const dx  = sum === 0 ? 0 : 100 * Math.abs(plusDI - minusDI) / sum;
    dxList.push(dx);
  }
  if (dxList.length < period) return null;
  let a = dxList.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < dxList.length; i++) a = (a * (period - 1) + dxList[i]) / period;
  return a;
}

function ema(values, period) {
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = new Array(period - 1).fill(null).concat([e]);
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
    out.push(e);
  }
  return out;
}

function macd(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return null;
  const fastE = ema(closes, fast);
  const slowE = ema(closes, slow);
  const macdLine = closes.map((_, i) => (fastE[i] != null && slowE[i] != null) ? fastE[i] - slowE[i] : null);
  const macdValid = macdLine.filter(v => v != null);
  const sigLine = ema(macdValid, signal);
  const lastMacd = macdLine.at(-1);
  const lastSig  = sigLine.at(-1);
  const lastHist = lastMacd - lastSig;
  const prevMacd = macdLine.at(-2);
  const prevSig  = sigLine.at(-2);
  const prevHist = prevMacd - prevSig;
  return {
    macd: lastMacd, signal: lastSig, hist: lastHist,
    crossUp:   prevMacd < prevSig && lastMacd > lastSig,
    crossDown: prevMacd > prevSig && lastMacd < lastSig,
    rising:    lastHist > prevHist,
  };
}

function obv(closes, volumes) {
  if (closes.length < 2) return [];
  const o = [0];
  for (let i = 1; i < closes.length; i++) {
    if      (closes[i] > closes[i - 1]) o.push(o[i - 1] + volumes[i]);
    else if (closes[i] < closes[i - 1]) o.push(o[i - 1] - volumes[i]);
    else                                 o.push(o[i - 1]);
  }
  return o;
}

function bollinger(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean  = slice.reduce((a, b) => a + b, 0) / period;
  const std   = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  return { upper: mean + mult * std, middle: mean, lower: mean - mult * std, std };
}

// 허스트 지수 (R/S 분석, 단순화 버전)
function hurst(closes) {
  if (closes.length < 50) return null;
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const ns = [10, 20, 40, 80].filter(n => n <= rets.length);
  const xs = [], ys = [];
  for (const n of ns) {
    const chunks = Math.floor(rets.length / n);
    let totalRS = 0, valid = 0;
    for (let i = 0; i < chunks; i++) {
      const sub = rets.slice(i * n, (i + 1) * n);
      const mean = sub.reduce((a, b) => a + b, 0) / n;
      const dev  = sub.map(r => r - mean);
      const cumDev = [];
      let s = 0;
      for (const d of dev) { s += d; cumDev.push(s); }
      const R = Math.max(...cumDev) - Math.min(...cumDev);
      const S = Math.sqrt(dev.reduce((a, b) => a + b * b, 0) / n);
      if (S > 0) { totalRS += Math.log(R / S); valid++; }
    }
    if (valid > 0) { xs.push(Math.log(n)); ys.push(totalRS / valid); }
  }
  if (xs.length < 2) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? null : num / den;
}

// 칼만 필터 (단순화: 상수 추세 + 노이즈)
function kalmanTrend(closes) {
  if (closes.length < 20) return null;
  let x = closes[0];        // 추정치
  let p = 1;                // 오차 공분산
  const q = 0.0001;         // 프로세스 노이즈
  const r = 0.01;           // 측정 노이즈
  const filtered = [x];
  for (let i = 1; i < closes.length; i++) {
    p = p + q;
    const k = p / (p + r);
    x = x + k * (closes[i] - x);
    p = (1 - k) * p;
    filtered.push(x);
  }
  const last = filtered.at(-1);
  const prev = filtered.at(-10);
  return prev ? (last / prev - 1) * 100 : null;
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. CAN SLIM 점수 함수 (7개)
// ═════════════════════════════════════════════════════════════════════════════

/** C - EPS 가속도 (분기 EPS YoY [+ 가속 여부]) */
function scoreEpsAccel(quarterEps, isConsensus = null) {
  if (!quarterEps || quarterEps.length < 5) {
    return mkResult(null, null, '분기 EPS 데이터 부족');
  }

  // 컨센서스 분리: 실제 데이터만 사용
  const actualEps = quarterEps.map((v, i) => {
    if (!isConsensus) return v;
    return isConsensus[i] === 'Y' || isConsensus[i] === true ? null : v;
  }).filter(v => v != null);

  if (actualEps.length < 5) return mkResult(null, null, '실분기 데이터 부족');

  const latest  = actualEps.at(-1);
  const yearAgo = actualEps.at(-5);   // 4분기 전 = YoY 비교
  if (yearAgo == null || yearAgo === 0 || latest == null) {
    return mkResult(null, null, 'YoY 계산 불가');
  }
  const yoy = (latest / yearAgo - 1) * 100;

  // 가속도 비교 (8분기 있을 때만)
  let accel = null, prevYoY = null;
  if (actualEps.length >= 6) {
    const prevQ      = actualEps.at(-2);
    const prevYearAgo = actualEps.length >= 6 ? actualEps.at(-6) : null;
    if (prevYearAgo != null && prevYearAgo !== 0 && prevQ != null) {
      prevYoY = (prevQ / prevYearAgo - 1) * 100;
      accel = yoy - prevYoY;
    }
  }

  // 점수: YoY 25%+ = 합격
  let s = 0;
  if      (yoy > 100)  s = 95;
  else if (yoy > 50)   s = 85;
  else if (yoy > 25)   s = 70;  // 오닐 기준
  else if (yoy > 10)   s = 55;
  else if (yoy > 0)    s = 40;
  else if (yoy > -25)  s = 25;
  else                 s = 10;
  if (accel != null && accel > 0) s = Math.min(100, s + 10);

  const value = `+${round(yoy, 1)}%`;
  let comment;
  if (accel == null) comment = `YoY ${round(yoy)}%  · 가속도 미정`;
  else if (accel > 0) comment = `가속 중 (전분기 ${round(prevYoY)}%p → ${round(yoy)}%p)`;
  else                comment = `둔화 (전분기 ${round(prevYoY)}%p → ${round(yoy)}%p)`;
  return mkResult(clamp(s), value, comment);
}

/** A - 연간 ROE 실적 */
function scoreAnnualRoe(roe) {
  if (roe == null) return mkResult(null, null, 'ROE 데이터 없음');
  let s = 0;
  if (roe > 25)      s = 100;
  else if (roe > 17) s = 85;
  else if (roe > 10) s = 60;
  else if (roe > 5)  s = 40;
  else if (roe > 0)  s = 20;
  else               s = 5;
  const comment = roe < 17 ? `기준(17%) 미달` : `우수 (기준 17%↑)`;
  return mkResult(s, `${round(roe)}%`, comment);
}

/** N - 신고가/피봇 돌파 (52주 고가 대비 12% 이내) */
function scoreNewHigh(currentPrice, high52w) {
  if (!currentPrice || !high52w) return mkResult(null, null);
  const distPct = (currentPrice / high52w - 1) * 100;  // 음수: 고가 아래
  let s = 0;
  if (distPct >= -3)        s = 100;
  else if (distPct >= -7)   s = 85;
  else if (distPct >= -12)  s = 65;
  else if (distPct >= -20)  s = 40;
  else                      s = 20;
  const comment = distPct >= -12 ? `신고가 근처` : `52주 고가 ${Math.abs(round(distPct))}% 아래`;
  return mkResult(s, `${round(distPct)}%`, comment);
}

/** S - 거래량 확인 돌파 (최근 거래량 / 평균) */
function scoreVolumeBreakout(volumes) {
  if (!volumes || volumes.length < 21) return mkResult(null, null);
  const last = volumes.at(-1);
  const avg20 = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  if (avg20 === 0) return mkResult(null, null);
  const ratio = last / avg20;
  let s = 0;
  if (ratio > 2.5)      s = 100;
  else if (ratio > 1.5) s = 75;
  else if (ratio > 1)   s = 50;
  else if (ratio > 0.7) s = 30;
  else                  s = 10;
  return mkResult(s, `${round(ratio, 2)}x`, `평균 대비 ${ratio >= 1 ? '활발' : '저조'}`);
}

/** L - 주도주 RS 등급 (vs KOSPI 12M 수익률, 0~99) */
function scoreRsRating(stockReturn12m, kospiReturn12m) {
  if (stockReturn12m == null || kospiReturn12m == null) return mkResult(null, null);
  const rel = stockReturn12m - kospiReturn12m;  // 초과수익률 (%p)
  // RS 등급: 0~99 (KOSPI 대비 초과수익률을 백분위로 매핑)
  let rs = 50;
  if (rel > 100)       rs = 99;
  else if (rel > 60)   rs = 95;
  else if (rel > 30)   rs = 85;
  else if (rel > 15)   rs = 75;
  else if (rel > 5)    rs = 65;
  else if (rel > 0)    rs = 55;
  else if (rel > -10)  rs = 40;
  else if (rel > -25)  rs = 25;
  else                 rs = 10;
  const s = rs;
  const comment = rs >= 80 ? `시장 주도주` : rs >= 60 ? `시장 추종` : `시장 부진`;
  return mkResult(s, `${rs}점`, comment);
}

/** I - 기관 수급 (최근 20일 기관 순매수 합계) */
function scoreInstitutionFlow(dealTrend) {
  if (!dealTrend || dealTrend.length === 0) return mkResult(null, null, '데이터 없음');
  const recent20 = dealTrend.slice(0, 20);  // 최신 20일
  let buyDays = 0, sellDays = 0, totalNet = 0;
  for (const d of recent20) {
    if (d.organ == null) continue;
    if (d.organ > 0) buyDays++;
    if (d.organ < 0) sellDays++;
    totalNet += d.organ;
  }
  const buyRatio = recent20.length > 0 ? buyDays / recent20.length : 0;
  let s = 0;
  if (buyRatio > 0.7 && totalNet > 0)        s = 90;
  else if (buyRatio > 0.5 && totalNet > 0)   s = 70;
  else if (buyRatio >= 0.4 && totalNet > 0)  s = 55;
  else if (buyRatio >= 0.3)                  s = 35;
  else                                       s = 15;
  const totalK = totalNet / 1000;
  const value = totalNet > 0 ? `+${Math.abs(round(totalK, 0)).toLocaleString()}K` : `-${Math.abs(round(totalK, 0)).toLocaleString()}K`;
  const comment = `매수 ${buyDays}일 / 매도 ${sellDays}일`;
  return mkResult(s, value, comment);
}

/** M - 시장 방향 (KOSPI 추세) */
function scoreMarketDirection(kospiCloses) {
  if (!kospiCloses || kospiCloses.length < 50) return mkResult(null, null);
  const ma21 = kospiCloses.slice(-21).reduce((a, b) => a + b, 0) / 21;
  const ma50 = kospiCloses.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const last = kospiCloses.at(-1);
  const r1m = (last / kospiCloses.at(-21) - 1) * 100;
  const r3m = kospiCloses.length >= 63 ? (last / kospiCloses.at(-63) - 1) * 100 : null;

  let s = 50;
  if (last > ma21 && ma21 > ma50)      s += 30;  // 정배열
  else if (last > ma21)                s += 15;
  else if (last < ma21 && ma21 < ma50) s -= 30;
  if (r1m > 3)  s += 10;
  if (r1m < -3) s -= 10;
  s = clamp(s);
  let comment;
  if (s >= 75)      comment = 'STRONG_BULL · 강한 상승 추세';
  else if (s >= 55) comment = 'BULL · 상승 추세';
  else if (s >= 40) comment = 'NEUTRAL · 횡보';
  else              comment = 'BEAR · 하락 추세';
  return mkResult(s, `${round(r1m, 1)}%`, comment);
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Quant 지표 (11개)
// ═════════════════════════════════════════════════════════════════════════════

/** 모멘텀 (12M/6M/3M 가중평균) */
function scoreMomentum(closes) {
  if (!closes || closes.length < 22) return mkResult(null, null);
  const last = closes.at(-1);
  const r1m  = closes.length >= 22  ? (last / closes.at(-22)  - 1) * 100 : null;
  const r3m  = closes.length >= 63  ? (last / closes.at(-63)  - 1) * 100 : null;
  const r6m  = closes.length >= 126 ? (last / closes.at(-126) - 1) * 100 : null;
  const r12m = closes.length >= 252 ? (last / closes.at(-252) - 1) * 100 : null;

  const vals = [r1m, r3m, r6m, r12m].filter(v => v != null);
  if (!vals.length) return mkResult(null, null);
  const weighted = vals.reduce((a, b, i) => a + b * (i + 1), 0) / vals.reduce((a, _, i) => a + (i + 1), 0);

  let s = 0;
  if (weighted > 50)      s = 95;
  else if (weighted > 25) s = 80;
  else if (weighted > 10) s = 65;
  else if (weighted > 0)  s = 50;
  else if (weighted > -10) s = 35;
  else                    s = 15;

  const comment = `1년 ${r12m != null ? (r12m > 0 ? '+' : '') + round(r12m) : '—'}% / 3개월 ${r3m != null ? (r3m > 0 ? '+' : '') + round(r3m) : '—'}%`;
  return mkResult(s, `${round(weighted)}점`, comment);
}

/** 통계적 Z-Score (60일 평균 대비) */
function scoreZScore(closes) {
  if (!closes || closes.length < 60) return mkResult(null, null);
  const slice = closes.slice(-60);
  const mean = slice.reduce((a, b) => a + b, 0) / 60;
  const std  = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / 60);
  if (std === 0) return mkResult(null, null);
  const z = (closes.at(-1) - mean) / std;
  let s = 0;
  // Z-Score 0~+1.6 = 정상 상승, ±0.5 = 평균선, +2 이상 = 과열
  if (z > 2.5)        s = 30;
  else if (z > 1.5)   s = 60;
  else if (z > 0.5)   s = 85;
  else if (z > -0.5)  s = 70;
  else if (z > -1.5)  s = 50;
  else                s = 30;
  const comment = z > 1.5 ? '과열 구간' : z < -1 ? '저평가 구간' : '정상 범위';
  return mkResult(s, round(z, 2), comment);
}

/** 변동성 조정 (Sharpe 근사) */
function scoreVolAdj(closes) {
  if (!closes || closes.length < 21) return mkResult(null, null);
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
  const recent = rets.slice(-20);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const std  = Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length);
  if (std === 0) return mkResult(null, null);
  const sharpe = (mean / std) * Math.sqrt(252);  // 연환산
  let s = 0;
  if (sharpe > 2)       s = 95;
  else if (sharpe > 1)  s = 80;
  else if (sharpe > 0)  s = 60;
  else if (sharpe > -1) s = 35;
  else                  s = 15;
  return mkResult(s, round(sharpe, 2), `변동성 대비 수익률`);
}

/** 다중 신호도 (여러 조건 충족 개수) */
function scoreMultiSignal(signals) {
  // signals: { rsiOk, macdUp, bbBreak, volSpike, instBuy, newsPositive, ... }
  const flags = Object.values(signals).filter(v => v === true).length;
  const total = Object.keys(signals).length;
  if (total === 0) return mkResult(null, null);
  const ratio = flags / total;
  const s = ratio * 100;
  return mkResult(s, `${flags}/${total}`, `${flags}개 조건 충족`);
}

/** 낙폭 위험도 (고점 대비 하락 + ATR) */
function scoreDrawdownRisk(closes, atrVal) {
  if (!closes || closes.length < 60) return mkResult(null, null);
  const peak = Math.max(...closes.slice(-126));
  const last = closes.at(-1);
  const dd = (last / peak - 1) * 100;  // 음수
  const atrPct = atrVal ? (atrVal / last) * 100 : 0;
  // 점수: 낙폭 작고 변동성 낮을수록 안전
  const dangerScore = Math.abs(dd) + atrPct * 2;
  let s = 100 - dangerScore;
  s = clamp(s);
  const comment = dd < -20 ? '큰 낙폭' : dd < -10 ? '보통' : '안정';
  return mkResult(s, `${round(dd)}%`, comment);
}

/** 스마트머니 흐름 (OBV + 외인/기관 추세) */
function scoreSmartMoney(closes, volumes, dealTrend) {
  if (!closes || closes.length < 20) return mkResult(null, null);
  const obvSeries = obv(closes, volumes);
  const obvNow = obvSeries.at(-1);
  const obvAgo = obvSeries.at(-20);
  const obvTrend = obvAgo !== 0 ? (obvNow - obvAgo) / Math.abs(obvAgo) * 100 : 0;

  let foreignNet = 0, organNet = 0;
  if (dealTrend && dealTrend.length > 0) {
    for (const d of dealTrend.slice(0, 20)) {
      foreignNet += d.foreigner || 0;
      organNet   += d.organ     || 0;
    }
  }
  const smartNet = foreignNet + organNet;  // 스마트머니 = 외인+기관

  let s = 50;
  if (obvTrend > 5)         s += 20;
  else if (obvTrend > 0)    s += 10;
  else if (obvTrend < -5)   s -= 20;
  if (smartNet > 0)         s += 20;
  else if (smartNet < 0)    s -= 20;
  s = clamp(s);
  const comment = smartNet > 0 ? `스마트머니 유입` : `스마트머니 유출`;
  return mkResult(s, `${round(obvTrend)}%`, comment);
}

/** 공매도 비율 */
function scoreShortSale(shortSale, volumes) {
  if (!shortSale || shortSale.length === 0) return mkResult(null, null, '공매도 데이터 없음');
  const recent = shortSale.slice(-5);
  let totalSS = 0, totalVol = 0;
  for (const d of recent) { totalSS += d.ssVolume; totalVol += d.totalVolume; }
  if (totalVol === 0) return mkResult(null, null);
  const ratio = (totalSS / totalVol) * 100;
  // 공매도 비율이 낮을수록 좋음 (5%↓ 안전, 20%↑ 위험)
  let s = 0;
  if (ratio < 2)       s = 95;
  else if (ratio < 5)  s = 80;
  else if (ratio < 10) s = 60;
  else if (ratio < 20) s = 35;
  else                 s = 15;
  return mkResult(s, `${round(ratio, 1)}%`, ratio < 5 ? '안전' : ratio < 15 ? '보통' : '위험');
}

/** 가치·퀄리티 팩터 */
function scoreValueQuality(per, pbr, roe, opMargin) {
  const peS  = per == null ? null : (per < 10 ? 100 : per < 15 ? 85 : per < 25 ? 65 : per < 40 ? 40 : 15);
  const pbS  = pbr == null ? null : (pbr < 1 ? 100 : pbr < 2 ? 80 : pbr < 4 ? 55 : pbr < 8 ? 30 : 10);
  const roS  = roe == null ? null : (roe > 20 ? 100 : roe > 10 ? 70 : roe > 5 ? 45 : 20);
  const opS  = opMargin == null ? null : (opMargin > 20 ? 100 : opMargin > 10 ? 70 : opMargin > 5 ? 45 : 20);
  const vals = [peS, pbS, roS, opS].filter(v => v != null);
  if (!vals.length) return mkResult(null, null);
  const s = vals.reduce((a, b) => a + b, 0) / vals.length;
  return mkResult(s, round(s), `가치+퀄리티 종합`);
}

/** 황균 파워 (RSI 65↑ 시점의 Z-Score) */
function scoreSurgePower(closes, rsiVal) {
  if (!closes || closes.length < 60) return mkResult(null, null);
  if (rsiVal == null) return mkResult(null, null);
  const slice = closes.slice(-60);
  const mean = slice.reduce((a, b) => a + b, 0) / 60;
  const std  = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / 60);
  const z = std > 0 ? (closes.at(-1) - mean) / std : 0;
  let s = 30;
  if (rsiVal >= 65 && z > 1.5)  s = 90;  // 강력 상승 + 과열
  else if (rsiVal >= 65)        s = 70;
  else if (rsiVal >= 55)        s = 55;
  else if (rsiVal >= 45)        s = 40;
  else                          s = 25;
  return mkResult(s, `RSI ${round(rsiVal, 1)}`, z > 1 ? '강한 상승력' : '중립');
}

/** Target Price Factor (목표주가 vs 현재가) */
function scoreTargetPrice(currentPrice, opinions, cnsPer, cnsEps) {
  let targetPrice = null;
  let source = '';
  if (opinions && opinions.length > 0) {
    // 증권사 평균 목표가
    const valid = opinions.filter(o => o.targetPrice > 0);
    if (valid.length > 0) {
      targetPrice = valid.reduce((a, b) => a + b.targetPrice, 0) / valid.length;
      source = `증권사 ${valid.length}곳 평균`;
    }
  }
  if (targetPrice == null && cnsPer && cnsEps) {
    targetPrice = cnsPer * cnsEps;
    source = '추정PER × 추정EPS';
  }
  if (!targetPrice || !currentPrice) return mkResult(null, null, '목표가 데이터 없음');
  const upside = (targetPrice / currentPrice - 1) * 100;
  let s = 0;
  if (upside > 30)       s = 95;
  else if (upside > 15)  s = 80;
  else if (upside > 5)   s = 60;
  else if (upside > -5)  s = 45;
  else                   s = 20;
  return mkResult(s, `+${round(upside)}%`, `목표가 ${Math.round(targetPrice).toLocaleString()}원 (${source})`);
}

/** 허스트 지수 */
function scoreHurst(closes) {
  const h = hurst(closes);
  if (h == null) return mkResult(null, null);
  // 0.5 < H < 1: 추세 지속성, 0.5 = 랜덤워크, < 0.5 = 평균회귀
  let s = 50;
  if (h > 0.7)      s = 90;
  else if (h > 0.6) s = 75;
  else if (h > 0.5) s = 60;
  else if (h > 0.4) s = 40;
  else              s = 25;
  const comment = h > 0.6 ? '강한 추세 지속성' : h > 0.5 ? '약한 추세' : '평균회귀 성향';
  return mkResult(s, round(h, 2), comment);
}

/** 칼만 필터 트렌드 */
function scoreKalman(closes) {
  const trend = kalmanTrend(closes);
  if (trend == null) return mkResult(null, null);
  let s = 50;
  if (trend > 5)      s = 90;
  else if (trend > 2) s = 75;
  else if (trend > 0) s = 60;
  else if (trend > -2) s = 40;
  else                s = 25;
  return mkResult(s, `${round(trend)}%`, '노이즈 제거 후 추세');
}

/** 시장 심리 추정 (거래량 + 등락 강도) */
function scoreSentiment(closes, volumes) {
  if (closes.length < 5 || volumes.length < 5) return mkResult(null, null);
  let upDays = 0, downDays = 0, upVol = 0, downVol = 0;
  for (let i = closes.length - 5; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) { upDays++;   upVol   += volumes[i]; }
    if (closes[i] < closes[i - 1]) { downDays++; downVol += volumes[i]; }
  }
  const totalVol = upVol + downVol;
  if (totalVol === 0) return mkResult(null, null);
  const upRatio = upVol / totalVol;
  let s = upRatio * 100;
  const comment = `5일 중 상승 ${upDays}일`;
  return mkResult(s, `${round(upRatio * 100)}%`, comment);
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. 기술 지표 점수
// ═════════════════════════════════════════════════════════════════════════════

function scoreRsi(rsiVal) {
  if (rsiVal == null) return mkResult(null, null);
  let s, label;
  if (rsiVal >= 70)      { s = 30;  label = '과매수 (조정 주의)'; }
  else if (rsiVal >= 60) { s = 75;  label = '강세'; }
  else if (rsiVal >= 50) { s = 70;  label = '중립↑'; }
  else if (rsiVal >= 40) { s = 55;  label = '중립↓'; }
  else if (rsiVal >= 30) { s = 50;  label = '약세'; }
  else                   { s = 65;  label = '과매도 (매수 기회)'; }
  return mkResult(s, round(rsiVal, 1), label);
}

function scoreAdx(adxVal) {
  if (adxVal == null) return mkResult(null, null);
  let s, label;
  if (adxVal >= 40)      { s = 90; label = '강한 추세'; }
  else if (adxVal >= 25) { s = 70; label = '추세 존재'; }
  else                   { s = 40; label = '횡보'; }
  return mkResult(s, round(adxVal, 1), label);
}

function scoreAtrPct(atrVal, price) {
  if (atrVal == null || !price) return mkResult(null, null);
  const pct = (atrVal / price) * 100;
  // ATR%가 너무 크면 위험, 너무 작으면 정체
  let s = 60;
  if (pct > 8)       s = 30;
  else if (pct > 4)  s = 60;
  else if (pct > 2)  s = 75;
  else               s = 65;
  return mkResult(s, `${round(pct, 2)}%`, pct > 5 ? '높은 변동성' : '안정적');
}

function scoreVwapDist(currentPrice, vwap) {
  if (!currentPrice || !vwap) return mkResult(null, null, '분봉 데이터 없음');
  const dist = (currentPrice / vwap - 1) * 100;
  let s;
  if (dist > 5)        s = 60;
  else if (dist > 0)   s = 85;
  else if (dist > -5)  s = 60;
  else                 s = 35;
  return mkResult(s, `${dist > 0 ? '+' : ''}${round(dist, 2)}%`, dist > 0 ? 'VWAP 위 (강세)' : 'VWAP 아래 (약세)');
}

function scoreVolumeRatio(volumes) {
  if (!volumes || volumes.length < 21) return mkResult(null, null);
  const last = volumes.at(-1);
  const avg = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  if (avg === 0) return mkResult(null, null);
  const ratio = last / avg;
  const s = ratio > 2 ? 90 : ratio > 1.5 ? 75 : ratio > 1 ? 60 : 40;
  return mkResult(s, `${round(ratio, 2)}x`, ratio > 1.5 ? '활발' : '보통');
}

function scoreMacd(macdObj) {
  if (!macdObj) return mkResult(null, null);
  let s = 50;
  let label = '중립';
  if (macdObj.crossUp)       { s = 90; label = '상승 전환 중'; }
  else if (macdObj.crossDown){ s = 20; label = '하락 전환'; }
  else if (macdObj.hist > 0 && macdObj.rising)   { s = 75; label = '상승 모멘텀'; }
  else if (macdObj.hist > 0)                     { s = 60; label = '약한 상승'; }
  else if (macdObj.hist < 0 && !macdObj.rising)  { s = 30; label = '하락 모멘텀'; }
  else                                            { s = 45; label = '하락 약화'; }
  return mkResult(s, round(macdObj.hist, 2), label);
}

function scoreOrb(minuteBars, currentPrice) {
  if (!minuteBars || minuteBars.length === 0) return mkResult(null, null, '분봉 데이터 없음');
  // 오늘 시초 30분 봉 추출 (9:00 ~ 9:30)
  const today = minuteBars.at(-1)?.date;
  const todayBars = minuteBars.filter(b => b.date === today);
  if (todayBars.length === 0) return mkResult(null, null);
  const opening30 = todayBars.slice(0, 30);  // 1분봉 기준 처음 30개
  if (opening30.length === 0) return mkResult(null, null);
  const orHigh = Math.max(...opening30.map(b => b.high));
  const orLow  = Math.min(...opening30.map(b => b.low));
  const ratio = currentPrice / orHigh;
  let s = 50;
  let label = '범위 내';
  if (currentPrice > orHigh)      { s = 90; label = '상향 돌파'; }
  else if (currentPrice < orLow)  { s = 25; label = '하향 이탈'; }
  return mkResult(s, currentPrice > orHigh ? '돌파' : currentPrice < orLow ? '이탈' : '대기', label);
}

function scoreNR7(highs, lows) {
  if (!highs || highs.length < 7) return mkResult(null, null);
  const ranges = [];
  for (let i = highs.length - 7; i < highs.length; i++) ranges.push(highs[i] - lows[i]);
  const minIdx = ranges.indexOf(Math.min(...ranges));
  const isNR7 = minIdx === ranges.length - 1;
  const s = isNR7 ? 80 : 40;
  return mkResult(s, isNR7 ? '압축 준비' : '보통', isNR7 ? '7봉 최소 범위' : '');
}

function scoreBollinger(bb, currentPrice) {
  if (!bb || !currentPrice) return mkResult(null, null);
  const pos = (currentPrice - bb.lower) / (bb.upper - bb.lower);
  let s, label;
  if (pos > 1)         { s = 30; label = '상단 돌파 (과열)'; }
  else if (pos > 0.8)  { s = 60; label = '상단 근접'; }
  else if (pos > 0.2)  { s = 75; label = '중간 구간'; }
  else if (pos > 0)    { s = 70; label = '하단 근접 (반등 가능)'; }
  else                 { s = 50; label = '하단 이탈'; }
  return mkResult(s, `${round(pos * 100)}%`, label);
}

// (scoreRsRating은 위 CAN SLIM 섹션에서 이미 정의됨 — 중복 제거)

// ═════════════════════════════════════════════════════════════════════════════
// 6. 재무 지표 점수
// ═════════════════════════════════════════════════════════════════════════════

function scorePer(per) {
  if (per == null) return mkResult(null, null);
  let s, label;
  if (per < 10)      { s = 95; label = '저평가'; }
  else if (per < 15) { s = 80; label = '저평가'; }
  else if (per < 25) { s = 60; label = '보통'; }
  else if (per < 40) { s = 35; label = '고평가 주의'; }
  else               { s = 15; label = '고평가 위험'; }
  return mkResult(s, round(per, 1), label);
}

function scorePbr(pbr) {
  if (pbr == null) return mkResult(null, null);
  let s, label;
  if (pbr < 1)       { s = 95; label = '자산 대비 저평가'; }
  else if (pbr < 2)  { s = 75; label = '적정'; }
  else if (pbr < 4)  { s = 50; label = '약간 비쌈'; }
  else if (pbr < 8)  { s = 30; label = '비쌈'; }
  else               { s = 10; label = '매우 비쌈'; }
  return mkResult(s, round(pbr, 2), label);
}

function scoreRoe(roe) {
  if (roe == null) return mkResult(null, null);
  let s, label;
  if (roe > 25)      { s = 100; label = '탁월'; }
  else if (roe > 17) { s = 85;  label = '오닐 기준 합격'; }
  else if (roe > 10) { s = 60;  label = '보통'; }
  else if (roe > 5)  { s = 35;  label = '낮음'; }
  else if (roe > 0)  { s = 20;  label = '매우 낮음'; }
  else               { s = 5;   label = '적자'; }
  return mkResult(s, `${round(roe)}%`, label);
}

function scoreEpsGrowth(epsArr, isConsensus = null) {
  if (!epsArr || epsArr.length < 5) return mkResult(null, null);
  // 컨센서스 제외하고 실제 데이터만
  const actual = epsArr.map((v, i) => {
    if (!isConsensus) return v;
    return isConsensus[i] === 'Y' || isConsensus[i] === true ? null : v;
  }).filter(v => v != null);
  if (actual.length < 5) return mkResult(null, null, '실분기 데이터 부족');
  const last = actual.at(-1), yearAgo = actual.at(-5);
  if (yearAgo == null || yearAgo === 0 || last == null) return mkResult(null, null);
  const growth = (last / yearAgo - 1) * 100;
  let s, label;
  if (growth > 100)     { s = 100; label = '고성장'; }
  else if (growth > 25) { s = 80;  label = '성장주 기준'; }
  else if (growth > 10) { s = 60;  label = '양호'; }
  else if (growth > 0)  { s = 40;  label = '둔화'; }
  else                  { s = 15;  label = '역성장'; }
  return mkResult(s, `${growth > 0 ? '+' : ''}${round(growth)}%`, label);
}

function scoreOpMargin(om) {
  if (om == null) return mkResult(null, null);
  let s, label;
  if (om > 25)      { s = 95; label = '탁월'; }
  else if (om > 15) { s = 80; label = '우수'; }
  else if (om > 8)  { s = 60; label = '보통'; }
  else if (om > 0)  { s = 35; label = '낮음'; }
  else              { s = 10; label = '적자'; }
  return mkResult(s, `${round(om)}%`, label);
}

function scoreDebtRatio(dr) {
  if (dr == null) return mkResult(null, null);
  let s, label;
  if (dr < 50)       { s = 95; label = '매우 안전'; }
  else if (dr < 100) { s = 80; label = '양호'; }
  else if (dr < 200) { s = 50; label = '주의'; }
  else if (dr < 400) { s = 25; label = '위험'; }
  else               { s = 10; label = '매우 위험'; }
  return mkResult(s, `${round(dr)}%`, label);
}

function scoreDividendYield(dy) {
  if (dy == null) return mkResult(null, null);
  let s;
  if (dy === 0)        s = 35;
  else if (dy >= 2 && dy <= 6) s = 100;
  else if (dy >= 1)    s = 70;
  else if (dy > 6)     s = 60;
  else                 s = 45;
  return mkResult(s, `${round(dy, 2)}%`, dy === 0 ? '무배당' : '');
}

function scoreRevenueGrowth(revenue, revenue_t1) {
  if (revenue == null || revenue_t1 == null || revenue_t1 === 0) return mkResult(null, null);
  const g = (revenue / revenue_t1 - 1) * 100;
  let s;
  if (g > 30)       s = 95;
  else if (g > 15)  s = 80;
  else if (g > 5)   s = 60;
  else if (g > 0)   s = 45;
  else              s = 20;
  return mkResult(s, `${g > 0 ? '+' : ''}${round(g)}%`, '매출 성장률');
}

// ═════════════════════════════════════════════════════════════════════════════
// Export
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
  // 유틸
  clamp, round, colorOf, labelOf, mkResult,
  // 지표 계산
  rsi, atr, adx, ema, macd, obv, bollinger, hurst, kalmanTrend,
  // CAN SLIM
  scoreEpsAccel, scoreAnnualRoe, scoreNewHigh, scoreVolumeBreakout,
  scoreRsRating, scoreInstitutionFlow, scoreMarketDirection,
  // Quant
  scoreMomentum, scoreZScore, scoreVolAdj, scoreMultiSignal, scoreDrawdownRisk,
  scoreSmartMoney, scoreShortSale, scoreValueQuality, scoreSurgePower,
  scoreTargetPrice, scoreHurst, scoreKalman, scoreSentiment,
  // 기술
  scoreRsi, scoreAdx, scoreAtrPct, scoreVwapDist, scoreVolumeRatio,
  scoreMacd, scoreOrb, scoreNR7, scoreBollinger,
  // 재무
  scorePer, scorePbr, scoreRoe, scoreEpsGrowth, scoreOpMargin,
  scoreDebtRatio, scoreDividendYield, scoreRevenueGrowth,
};
