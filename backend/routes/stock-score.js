'use strict';
/**
 * GET /api/stock-score/:code
 * 한국 종목 종합 점수 분석 (CAN SLIM + Quant + 기술 + 재무 + 공시·실적)
 * code: 6자리 종목코드 (예: 005930)
 */
const express = require('express');
const router  = express.Router();
const NodeCache = require('node-cache');

const {
  getOHLCV, getPrice, getKOSPIOHLCV, getStockList,
  getMinuteOHLCV, getShortSale, getInvestOpinion,
} = require('../services/kis');
const { getHistorical } = require('../services/yahoo');
const { getDartFullFinancials, getDartDisclosures } = require('../services/dart');
const { getNaverAnnualFinance, getNaverQuarterFinance } = require('../services/naverAnnual');
const { getIntegration } = require('../services/naverIntegration');
const S = require('../services/scoreKR');

// KOSPI fallback: KIS 지수 API 실패 시 Yahoo ^KS11 사용
async function getKospiSeries(nDays = 400) {
  try {
    const data = await getKOSPIOHLCV(nDays);
    if (data && data.length >= 30) return data;
  } catch {}
  try {
    // Yahoo는 캘린더일 기준 → 400일이면 약 270 거래일
    const yf = await getHistorical('^KS11', Math.ceil(nDays * 1.5));
    return yf.map(d => ({
      date: d.date instanceof Date ? d.date.toISOString().slice(0, 10).replace(/-/g, '') : String(d.date),
      close: d.close,
    }));
  } catch {
    return [];
  }
}

const cache = new NodeCache({ stdTTL: 1800 }); // 30분 캐시

// ─── 보조 유틸 ────────────────────────────────────────────────────────────────
function rTotal(arr) {
  // 가중 평균 (값 있는 것만)
  let sum = 0, w = 0;
  for (const [score, weight] of arr) {
    if (score == null) continue;
    sum += score * weight;
    w += weight;
  }
  return w === 0 ? null : Math.round(sum / w);
}

function gradeOf(s) {
  if (s == null) return '—';
  if (s >= 85) return 'A+';
  if (s >= 75) return 'A';
  if (s >= 65) return 'B';
  if (s >= 50) return 'C';
  if (s >= 35) return 'D';
  return 'F';
}

function getRangeMin(arr, from, to) {
  return Math.min(...arr.slice(from, to));
}

// ─── VWAP 계산 (분봉 → 누적) ──────────────────────────────────────────────────
function calcVWAP(minBars) {
  if (!minBars || minBars.length === 0) return null;
  const today = minBars.at(-1)?.date;
  const todayBars = minBars.filter(b => b.date === today);
  if (todayBars.length === 0) return null;
  let pvSum = 0, vSum = 0;
  for (const b of todayBars) {
    const tp = (b.high + b.low + b.close) / 3;
    pvSum += tp * b.volume;
    vSum  += b.volume;
  }
  return vSum > 0 ? pvSum / vSum : null;
}

// ─── 라우트 ───────────────────────────────────────────────────────────────────
router.get('/:code', async (req, res) => {
  let code = req.params.code.trim().toUpperCase().replace(/\.(KS|KQ|KOSPI|KOSDAQ)$/i, '');

  // 6자리 종목코드만 허용
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({
      error: '한국 종목코드(6자리)만 지원합니다. 예: 005930 (삼성전자)',
    });
  }

  const cached = cache.get(code);
  if (cached) return res.json(cached);

  try {
    // ── 병렬 데이터 수집 ─────────────────────────────────────────────────────
    const [
      stockListR, ohlcvR, priceR, kospiR, minuteR, shortR, opinionR,
      naverIntgR, naverAnnR, naverQtrR, dartFinR, dartDiscR,
    ] = await Promise.allSettled([
      getStockList(),
      getOHLCV(code, 280),       // 약 280거래일 = 14개월 (12M 수익률 계산용)
      getPrice(code),
      getKospiSeries(280),
      getMinuteOHLCV(code),
      getShortSale(code),
      getInvestOpinion(code),
      getIntegration(code),
      getNaverAnnualFinance(code),
      getNaverQuarterFinance(code),
      getDartFullFinancials(code),
      getDartDisclosures(code, 10),
    ]);

    const stockList = stockListR.value || [];
    const ohlcv     = ohlcvR.value     || [];
    const price     = priceR.value     || null;
    const kospi     = kospiR.value     || [];
    const minute    = minuteR.value    || [];
    const shortSale = shortR.value     || [];
    const opinions  = opinionR.value   || [];
    const naverIntg = naverIntgR.value || null;
    const naverAnn  = naverAnnR.value  || null;
    const naverQtr  = naverQtrR.value  || null;
    const dartFin   = dartFinR.value   || null;
    const disclosures = dartDiscR.value || [];

    if (!price || ohlcv.length < 30) {
      return res.status(404).json({ error: `'${code}' 종목 데이터를 가져올 수 없습니다.` });
    }

    // ── 기본 정보 ─────────────────────────────────────────────────────────────
    const stockInfo = stockList.find(s => s.code === code) || {};
    const closes  = ohlcv.map(d => d.close);
    const highs   = ohlcv.map(d => d.high);
    const lows    = ohlcv.map(d => d.low);
    const volumes = ohlcv.map(d => d.volume);
    const currentPrice = price.close;

    // ── 기술 지표 계산 ────────────────────────────────────────────────────────
    const rsiVal   = S.rsi(closes, 14);
    const adxVal   = S.adx(highs, lows, closes, 14);
    const atrVal   = S.atr(highs, lows, closes, 14);
    const macdObj  = S.macd(closes);
    const bbVal    = S.bollinger(closes, 20, 2);
    const vwap     = calcVWAP(minute);

    // ── 수익률 ────────────────────────────────────────────────────────────────
    const get = (arr, daysAgo) => arr.length > daysAgo ? arr.at(-(daysAgo + 1)) : null;
    const ret = (now, past) => (past && past !== 0) ? (now / past - 1) * 100 : null;
    const last = closes.at(-1);
    const r1m  = ret(last, get(closes, 22));
    const r3m  = ret(last, get(closes, 63));
    const r6m  = ret(last, get(closes, 126));
    // 12M: 252거래일 없으면 가장 오래된 종가 사용
    const r12mIdx = Math.max(0, closes.length - 252);
    const r12m = closes.length >= 200 ? ret(last, closes[r12mIdx]) : null;

    const kospiLast = kospi.length > 0 ? kospi.at(-1).close : null;
    // 12M 비교: 정확히 252거래일 없어도 가능한 한 가장 오래된 종가로 계산
    const kospi12mAgo = kospi.length >= 200
      ? kospi[Math.max(0, kospi.length - 252)]?.close
      : null;
    const kospi12m = kospi12mAgo ? ret(kospiLast, kospi12mAgo) : null;

    // ── 52주 고저 ────────────────────────────────────────────────────────────
    const slice52w = ohlcv.slice(-252);
    const high52w = naverIntg?.high52w || (slice52w.length > 0 ? Math.max(...slice52w.map(d => d.high)) : null);
    const low52w  = naverIntg?.low52w  || (slice52w.length > 0 ? Math.min(...slice52w.map(d => d.low))  : null);

    // ── CAN SLIM 점수 ─────────────────────────────────────────────────────────
    const canSlim = {
      C: S.scoreEpsAccel(naverQtr?.eps, naverQtr?.isConsensus),
      A: S.scoreAnnualRoe(dartFin?.roe ?? naverAnn?.roe?.at(-1) ?? null),
      N: S.scoreNewHigh(currentPrice, high52w),
      S: S.scoreVolumeBreakout(volumes),
      L: S.scoreRsRating(r12m, kospi12m),
      I: S.scoreInstitutionFlow(naverIntg?.dealTrend),
      M: S.scoreMarketDirection(kospi.map(k => k.close)),
    };
    const canSlimScore = rTotal([
      [canSlim.C.score, 1.5], [canSlim.A.score, 1.5], [canSlim.N.score, 1],
      [canSlim.S.score, 1],   [canSlim.L.score, 1.5], [canSlim.I.score, 1],
      [canSlim.M.score, 0.5],
    ]);

    // ── Quant 점수 ────────────────────────────────────────────────────────────
    const signals = {
      rsiOk:      rsiVal != null && rsiVal >= 40 && rsiVal <= 70,
      macdUp:     macdObj?.hist > 0,
      bbUpper:    bbVal && currentPrice > bbVal.middle,
      volSpike:   volumes.length >= 21 && volumes.at(-1) > (volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20) * 1.5,
      instBuy:    naverIntg?.dealTrend?.slice(0, 5).reduce((a, d) => a + (d.organ || 0), 0) > 0,
      adxStrong:  adxVal != null && adxVal > 25,
      foreignBuy: naverIntg?.dealTrend?.slice(0, 5).reduce((a, d) => a + (d.foreigner || 0), 0) > 0,
      aboveMA:    closes.length >= 60 && currentPrice > (closes.slice(-60).reduce((a, b) => a + b, 0) / 60),
    };

    const quant = {
      momentum:     S.scoreMomentum(closes),
      zscore:       S.scoreZScore(closes),
      volAdj:       S.scoreVolAdj(closes),
      multiSignal:  S.scoreMultiSignal(signals),
      drawdown:     S.scoreDrawdownRisk(closes, atrVal),
      smartMoney:   S.scoreSmartMoney(closes, volumes, naverIntg?.dealTrend),
      shortSale:    S.scoreShortSale(shortSale, volumes),
      valueQuality: S.scoreValueQuality(price.per, price.pbr, dartFin?.roe, dartFin?.opMargin),
      surgePower:   S.scoreSurgePower(closes, rsiVal),
      targetPrice:  S.scoreTargetPrice(currentPrice, opinions, naverIntg?.cnsPer, naverIntg?.cnsEps),
      hurst:        S.scoreHurst(closes),
      kalman:       S.scoreKalman(closes),
      sentiment:    S.scoreSentiment(closes, volumes),
    };
    const quantScore = rTotal(Object.values(quant).map(q => [q.score, 1]));

    // ── 기술 지표 점수 ────────────────────────────────────────────────────────
    const tech = {
      rsi:        S.scoreRsi(rsiVal),
      adx:        S.scoreAdx(adxVal),
      atrPct:     S.scoreAtrPct(atrVal, currentPrice),
      vwap:       S.scoreVwapDist(currentPrice, vwap),
      volRatio:   S.scoreVolumeRatio(volumes),
      macd:       S.scoreMacd(macdObj),
      orb:        S.scoreOrb(minute, currentPrice),
      nr7:        S.scoreNR7(highs, lows),
      bollinger:  S.scoreBollinger(bbVal, currentPrice),
      rsRating:   S.scoreRsRating(r12m, kospi12m),
      ret12m:     S.mkResult(
                    r12m == null ? null : (r12m > 50 ? 95 : r12m > 25 ? 80 : r12m > 0 ? 60 : r12m > -20 ? 35 : 15),
                    r12m == null ? null : `${r12m > 0 ? '+' : ''}${S.round(r12m)}%`, '1년 수익률'),
      ret3m:      S.mkResult(
                    r3m == null ? null : (r3m > 15 ? 95 : r3m > 5 ? 75 : r3m > 0 ? 55 : r3m > -10 ? 30 : 10),
                    r3m == null ? null : `${r3m > 0 ? '+' : ''}${S.round(r3m)}%`, '3개월 수익률'),
    };
    const techScore = rTotal(Object.values(tech).map(t => [t.score, 1]));

    // ── 재무 지표 점수 ────────────────────────────────────────────────────────
    const fin = {
      per:           S.scorePer(price.per),
      pbr:           S.scorePbr(price.pbr),
      roe:           S.scoreRoe(dartFin?.roe ?? naverAnn?.roe?.at(-1) ?? null),
      epsGrowth:     S.scoreEpsGrowth(naverQtr?.eps, naverQtr?.isConsensus),
      epsAccel:      S.scoreEpsAccel(naverQtr?.eps, naverQtr?.isConsensus),
      revenueGrowth: S.scoreRevenueGrowth(dartFin?.revenue, dartFin?.revenue_t1),
      dividendYield: S.scoreDividendYield(naverIntg?.dividendYield),
      opMargin:      S.scoreOpMargin(dartFin?.opMargin),
      debtRatio:     S.scoreDebtRatio(dartFin?.debtRatio),
      marketCap:     S.mkResult(70, price.marketCapEok ? `${(price.marketCapEok / 10000).toFixed(1)}조` : '—', '시가총액'),
    };
    const finScore = rTotal(Object.values(fin).map(f => [f.score, 1]));

    // ── 종합 점수 (가중) ──────────────────────────────────────────────────────
    const totalScore = rTotal([
      [canSlimScore, 0.30],
      [quantScore,   0.25],
      [techScore,    0.20],
      [finScore,     0.25],
    ]);
    const grade = gradeOf(totalScore);

    // ── 진입 단계 판정 ────────────────────────────────────────────────────────
    let phase = 'WAIT', phaseLabel = '관망';
    if (totalScore != null) {
      if      (totalScore >= 75) { phase = 'STRONG_BUY'; phaseLabel = '강력 매수'; }
      else if (totalScore >= 60) { phase = 'BUY';        phaseLabel = '매수 검토'; }
      else if (totalScore >= 45) { phase = 'HOLD';       phaseLabel = '눌림 대기'; }
      else if (totalScore >= 30) { phase = 'WATCH';      phaseLabel = '관망'; }
      else                       { phase = 'AVOID';      phaseLabel = '회피'; }
    }

    // ── 변동성 (ATR 기반) ─────────────────────────────────────────────────────
    const volatility = atrVal && currentPrice ? +(atrVal / currentPrice * 100).toFixed(2) : null;

    // ── 증권사 컨센서스 ──────────────────────────────────────────────────────
    let consensus = null;
    if (opinions.length > 0) {
      const targets = opinions.map(o => o.targetPrice).filter(t => t > 0);
      if (targets.length > 0) {
        consensus = {
          count:   opinions.length,
          min:     Math.min(...targets),
          max:     Math.max(...targets),
          avg:     Math.round(targets.reduce((a, b) => a + b, 0) / targets.length),
          upside:  +(((targets.reduce((a, b) => a + b, 0) / targets.length) / currentPrice - 1) * 100).toFixed(1),
          opinions: opinions.slice(0, 8),
        };
      }
    }
    // 컨센서스 없으면 추정 PER/EPS 활용
    if (!consensus && naverIntg?.cnsPer && naverIntg?.cnsEps) {
      const est = Math.round(naverIntg.cnsPer * naverIntg.cnsEps);
      consensus = {
        count: 0,
        min: est, max: est, avg: est,
        upside: +((est / currentPrice - 1) * 100).toFixed(1),
        opinions: [],
        estimated: true,
      };
    }

    // ── 실적 서프라이즈 (네이버 분기 컨센서스 vs 실제) ────────────────────────
    let earningsSurprise = [];
    if (naverQtr?.eps && naverQtr?.periods && naverQtr?.isConsensus) {
      for (let i = 0; i < naverQtr.periods.length; i++) {
        const eps = naverQtr.eps[i];
        if (eps == null) continue;
        // 이전 분기의 컨센서스(추정)와 비교
        const period = naverQtr.periods[i];
        const isCons = naverQtr.isConsensus[i];
        earningsSurprise.push({
          period,
          eps,
          isConsensus: isCons,
        });
      }
      earningsSurprise = earningsSurprise.slice(-4);
    }

    // ── 같은 섹터 경쟁사 ──────────────────────────────────────────────────────
    let peers = [];
    if (stockInfo.sector) {
      peers = stockList
        .filter(s => s.sector === stockInfo.sector && s.code !== code)
        .sort((a, b) => (b.marketCapEok || 0) - (a.marketCapEok || 0))
        .slice(0, 5)
        .map(s => ({ code: s.code, name: s.name, sector: s.sector, marketCapEok: s.marketCapEok }));
    }

    // ── 최종 응답 ────────────────────────────────────────────────────────────
    const result = {
      // 헤더
      code,
      name:         naverIntg?.stockName || stockInfo.name || price.code,
      sector:       stockInfo.sector || '—',
      market:       stockInfo.market || '—',
      currentPrice,
      prevClose:    price.prevClose,
      dayChange:    price.prevClose ? +((currentPrice / price.prevClose - 1) * 100).toFixed(2) : null,
      marketCapEok: price.marketCapEok,
      foreignRate:  naverIntg?.foreignRate || null,
      high52w, low52w,

      // 종합 점수
      totalScore, grade, phase, phaseLabel, volatility,

      // 카테고리별 점수
      scores: {
        canSlim: canSlimScore,
        quant:   quantScore,
        tech:    techScore,
        fin:     finScore,
      },

      // 상세 항목
      canSlim, quant, tech, fin,

      // 추가 정보
      consensus,
      earningsSurprise,
      disclosures,
      peers,

      timestamp: new Date().toISOString(),
      _meta: {
        sources: {
          ohlcv:    ohlcv.length > 0,
          kospi:    kospi.length > 0,
          minute:   minute.length > 0,
          shortSale: shortSale.length > 0,
          opinions: opinions.length,
          naver:    !!naverIntg,
          dart:     !!dartFin,
          quarter:  !!naverQtr,
        },
      },
    };

    cache.set(code, result);
    res.json(result);
  } catch (err) {
    console.error(`[stock-score] ${code}:`, err.message);
    res.status(500).json({ error: `데이터 분석 실패: ${err.message}` });
  }
});

module.exports = router;
