'use strict';
/**
 * PEG 퀀트 스크리너 — 신한투자증권 "PER로 사고 PEG로 고른다" 방법론 근사 구현
 *
 * GET /api/peg-screener/sectors            → 섹터 목록 (하드코딩 레거시)
 * GET /api/peg-screener/run/:sector        → 하드코딩 섹터 Z-Score 스크리닝 결과
 * POST /api/peg-screener/refresh/:sector   → 하드코딩 섹터 캐시 강제 재계산
 *
 * GET /api/peg-screener/run-naver/:naverNo?group=<groupId>   → 네이버 업종 전종목 스크리닝
 * POST /api/peg-screener/refresh-naver/:naverNo?group=<groupId> → 강제 재계산
 *
 * 팩터 가중치 (리포트 기준):
 *   IT하드웨어·기계  = PER 20% | PBR 10% | EPS 2Y CAGR 20% | EPS YoY 30% | ROE 10% | EPS변동성 5% | 부채비율 5%
 *   IT가전(2차전지)  = PER 20% | PBR 10% | EPS YoY 50%     | ROE 10%     | EPS변동성 5% | 부채비율 5%
 *
 * 역수 Z-Score 적용: PER, PBR, EPS변동성, 부채비율 (낮을수록 좋음)
 */

const express   = require('express');
const router    = express.Router();
const NodeCache = require('node-cache');
const fs        = require('fs');
const path      = require('path');

const { getPrice }                                    = require('../services/kis');
const { getNaverAnnualFinance, getNaverQuarterFinance } = require('../services/naverAnnual');
const { getSectorStocks }                             = require('../services/naverSector');
const { getDartFullFinancials }                       = require('../services/dart');

// ── 그룹별 팩터 가중치 ────────────────────────────────────────────────────────
const SECTOR_WEIGHTS = {
  'it-hardware':   { per: 0.20, pbr: 0.10, cagr: 0.20, yoy: 0.30, roe: 0.10, vol: 0.05, debt: 0.05 },
  'it-appliances': { per: 0.20, pbr: 0.10, cagr: 0.00, yoy: 0.50, roe: 0.10, vol: 0.05, debt: 0.05 },
  'machinery':     { per: 0.20, pbr: 0.10, cagr: 0.20, yoy: 0.30, roe: 0.10, vol: 0.05, debt: 0.05 },
};

// ── 캐시 ─────────────────────────────────────────────────────────────────────
const memCache   = new NodeCache({ stdTTL: 86400 }); // 24h
const DISK_DIR   = path.join(__dirname, '../data');
const diskPath   = s => path.join(DISK_DIR, `peg-screener-${s}.json`);

function saveDisk(sector, data) {
  try { fs.writeFileSync(diskPath(sector), JSON.stringify(data), 'utf8'); } catch {}
}
function loadDisk(sector) {
  try {
    if (!fs.existsSync(diskPath(sector))) return null;
    return JSON.parse(fs.readFileSync(diskPath(sector), 'utf8'));
  } catch { return null; }
}

// 서버 시작 시 디스크 캐시 복원
['it-hardware', 'it-appliances', 'machinery'].forEach(s => {
  const d = loadDisk(s);
  if (!d?.timestamp) return;
  const ageMs = Date.now() - new Date(d.timestamp).getTime();
  if (ageMs < 86400 * 1000) {
    const ttl = Math.floor((86400 * 1000 - ageMs) / 1000);
    memCache.set(`peg_${s}`, d, ttl);
    console.log(`[PEG] ${s} 캐시 복원 (${d.timestamp}, ${d.results?.length}종목)`);
  }
});

// ── 섹터 정의 ────────────────────────────────────────────────────────────────
const SECTORS = {
  'it-hardware': {
    name: 'IT하드웨어',
    badge: 'text-sky-400 border-sky-400/30 bg-sky-400/10',
    stocks: [
      { code: '009150', name: '삼성전기' },
      { code: '011070', name: 'LG이노텍' },
      { code: '007660', name: '이수페타시스' },
      { code: '353200', name: '대덕전자' },
      { code: '098460', name: '고영' },
      { code: '218410', name: 'RFHIC' },
      { code: '078600', name: '대주전자재료' },
      { code: '007810', name: '코리아써키트' },
      { code: '140860', name: '파크시스템스' },
      { code: '189300', name: '인텔리안테크' },
    ],
    weights: { per: 0.20, pbr: 0.10, cagr: 0.20, yoy: 0.30, roe: 0.10, vol: 0.05, debt: 0.05 },
    position: '비중확대',
    peg: 0.6,
  },
  'it-appliances': {
    name: 'IT가전 / 2차전지',
    badge: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    stocks: [
      { code: '373220', name: 'LG에너지솔루션' },
      { code: '006400', name: '삼성SDI' },
      { code: '066570', name: 'LG전자' },
      { code: '247540', name: '에코프로비엠' },
      { code: '066970', name: '엘앤에프' },
      { code: '450080', name: '에코프로머티' },
      { code: '058610', name: '에스피지' },
      { code: '082920', name: '비츠로셀' },
      { code: '137400', name: '피엔티' },
      { code: '365340', name: '성일하이텍' },
    ],
    // IT가전: EPS CAGR 가중치 0, YoY 50%
    weights: { per: 0.20, pbr: 0.10, cagr: 0.00, yoy: 0.50, roe: 0.10, vol: 0.05, debt: 0.05 },
    position: '비중확대*',
    peg: 0.5,
  },
  'machinery': {
    name: '기계',
    badge: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    stocks: [
      { code: '267260', name: 'HD현대일렉트릭' },
      { code: '010120', name: 'LS ELECTRIC' },
      { code: '298040', name: '효성중공업' },
      { code: '006260', name: 'LS' },
      { code: '001440', name: '대한전선' },
      { code: '241560', name: '두산밥캣' },
      { code: '103590', name: '일진전기' },
      { code: '267270', name: 'HD건설기계' },
      { code: '432320', name: '산일전기' },
      { code: '229640', name: 'LS에코에너지' },
    ],
    weights: { per: 0.20, pbr: 0.10, cagr: 0.20, yoy: 0.30, roe: 0.10, vol: 0.05, debt: 0.05 },
    position: '비중유지',
    peg: 1.4,
  },
};

// ── 통계 헬퍼 ─────────────────────────────────────────────────────────────────
function mean(arr) {
  const valid = arr.filter(v => v != null && isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}
function std(arr) {
  const m = mean(arr);
  if (m == null) return null;
  const valid = arr.filter(v => v != null && isFinite(v));
  if (valid.length < 2) return null;
  const variance = valid.reduce((s, v) => s + (v - m) ** 2, 0) / valid.length;
  return Math.sqrt(variance);
}
function zScore(value, m, s) {
  if (value == null || m == null || !s || s === 0) return null;
  return (value - m) / s;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 종목별 원시 데이터 수집 ───────────────────────────────────────────────────
async function fetchStockMetrics(code, name, period = 'annual') {
  try {
    const price = await getPrice(code);
    if (!price || !price.close) return null;

    const { per: kisPer, pbr: kisPbr, eps, bps, roe: kisRoe, marketCapEok, close } = price;

    const fetchFn = period === 'quarter' ? getNaverQuarterFinance : getNaverAnnualFinance;
    const fin     = await fetchFn(code);

    let epsCagr2Y = null;
    let epsYoY    = null;
    let epsVol    = null;
    let debtRatio = null;
    let naverRoe  = null;
    let naverPbr  = null;
    let naverPer  = null;
    let epsStatus = null; // null | '흑자전환' | '적자전환' | '적자지속' | '손실축소'

    if (fin) {
      // actualEps[i]: 해당 기간의 실제 EPS (컨센서스면 null, 0이면 null)
      const actualEps = fin.periods.map((p, i) =>
        (!fin.isConsensus[i] && fin.eps[i] != null) ? fin.eps[i] : null
      );
      const consensusEps = fin.periods
        .map((p, i) => (fin.isConsensus[i] && fin.eps[i] != null) ? fin.eps[i] : null)
        .filter(v => v != null);

      if (period === 'annual') {
        // ── 연간 로직 ──────────────────────────────────────────────────────────
        const actuals = actualEps.filter(v => v != null && v !== 0);
        if (actuals.length >= 2) {
          const eT  = actuals[actuals.length - 1];
          const eT1 = actuals[actuals.length - 2];
          const eT2 = actuals.length >= 3 ? actuals[actuals.length - 3] : null;

          // YoY: 컨센서스 선행 → 실제 직전
          if (consensusEps.length > 0 && eT && eT !== 0) {
            epsYoY = (consensusEps[0] / eT) - 1;
          } else if (eT1 && eT1 !== 0) {
            epsYoY = (eT / eT1) - 1;
          }

          // 2Y CAGR + 순이익 상태 판정
          if (eT2 != null) {
            if (eT > 0 && eT2 > 0) {
              epsCagr2Y = Math.pow(eT / eT2, 0.5) - 1;
            } else if (eT > 0 && eT2 < 0) {
              epsStatus = '흑자전환';
            } else if (eT < 0 && eT2 > 0) {
              epsStatus = '적자전환';
            } else if (eT < 0 && eT2 < 0) {
              epsStatus = Math.abs(eT) < Math.abs(eT2) ? '손실축소' : '적자지속';
            }
          } else if (eT1 != null) {
            // eT2 없을 때 1년 비교로 상태만 판정
            if      (eT > 0 && eT1 < 0) epsStatus = '흑자전환';
            else if (eT < 0 && eT1 > 0) epsStatus = '적자전환';
            else if (eT < 0 && eT1 < 0) epsStatus = Math.abs(eT) < Math.abs(eT1) ? '손실축소' : '적자지속';
          }

          // 변동성 (YoY stddev)
          if (eT2 != null && eT2 !== 0 && eT1 !== 0) {
            epsVol = std([(eT / eT1) - 1, (eT1 / eT2) - 1]);
          }
        }
      } else {
        // ── 분기 로직 (동기 대비 YoY, periods 배열 인덱스 기준) ────────────────
        // periods 배열 그대로 유지 — 인덱스 4 = 4분기 전(동기)
        const lastIdx = actualEps.map((v, i) => v != null ? i : -1).filter(i => i !== -1).at(-1);

        if (lastIdx != null) {
          const eT = actualEps[lastIdx];

          // 동기 대비 YoY: 4 분기 앞 인덱스
          const eSameQ1Y = lastIdx >= 4 ? actualEps[lastIdx - 4] : null;
          if (eSameQ1Y != null && eSameQ1Y !== 0) {
            epsYoY = (eT / eSameQ1Y) - 1;
          } else if (consensusEps.length > 0 && eT && eT !== 0) {
            epsYoY = (consensusEps[0] / eT) - 1;
          }

          // 2Y CAGR: 동기 8 분기 전 + 상태 판정
          const eSameQ2Y = lastIdx >= 8 ? actualEps[lastIdx - 8] : null;
          if (eSameQ2Y != null) {
            if (eT > 0 && eSameQ2Y > 0) {
              epsCagr2Y = Math.pow(eT / eSameQ2Y, 0.5) - 1;
            } else if (eT > 0 && eSameQ2Y < 0) {
              epsStatus = '흑자전환';
            } else if (eT < 0 && eSameQ2Y > 0) {
              epsStatus = '적자전환';
            } else if (eT < 0 && eSameQ2Y < 0) {
              epsStatus = Math.abs(eT) < Math.abs(eSameQ2Y) ? '손실축소' : '적자지속';
            }
          } else if (eSameQ1Y != null && !epsStatus) {
            if      (eT > 0 && eSameQ1Y < 0) epsStatus = '흑자전환';
            else if (eT < 0 && eSameQ1Y > 0) epsStatus = '적자전환';
          }

          // 변동성: 가능한 동기 YoY 쌍들의 stddev
          const yoyPairs = [];
          for (let i = 0; i < actualEps.length; i++) {
            if (actualEps[i] != null && i >= 4 && actualEps[i - 4] != null && actualEps[i - 4] !== 0) {
              yoyPairs.push((actualEps[i] / actualEps[i - 4]) - 1);
            }
          }
          if (yoyPairs.length >= 2) epsVol = std(yoyPairs);
        }
      }

      // 부채비율 · ROE: 최신 실제 값 (연간/분기 공통)
      const lastActual = (arr) => fin.periods
        .map((p, i) => (!fin.isConsensus[i] && arr[i] != null) ? arr[i] : null)
        .filter(v => v != null).at(-1) ?? null;

      debtRatio = lastActual(fin.debtRatio);
      naverRoe  = lastActual(fin.roe);
      naverPbr  = lastActual(fin.pbr);
      naverPer  = lastActual(fin.per);
    }

    // KIS 우선 → Naver 폴백
    let per = kisPer ?? naverPer ?? null;
    let pbr = kisPbr ?? naverPbr ?? null;
    let roe = naverRoe ?? kisRoe ?? ((eps && bps && bps > 0) ? +(eps / bps * 100).toFixed(2) : null);

    // ── DART: 기본 폴백 + 거장 지표 계산 ──────────────────────────────────────
    const d         = await getDartFullFinancials(code);
    let dartExtra   = null;
    const extra     = {};

    // Graham Number: KIS eps + bps 기반 (DART 불필요)
    if (eps != null && bps != null && eps > 0 && bps > 0) {
      const gn = Math.sqrt(22.5 * eps * bps);
      extra.grahamNum      = Math.round(gn);
      extra.grahamDiscount = +((gn - close) / gn * 100).toFixed(1);
    }

    if (d) {
      // 기존 폴백: Naver 누락 지표 보완
      if (epsYoY    == null && d.niYoY     != null) epsYoY    = d.niYoY;
      if (epsVol    == null && d.niVol     != null) epsVol    = d.niVol;
      if (debtRatio == null && d.debtRatio != null) debtRatio = d.debtRatio;
      if (roe       == null && d.roe       != null) roe       = d.roe;
      if (epsCagr2Y == null) {
        if (d.niCagr2Y != null) {
          epsCagr2Y = d.niCagr2Y;
        } else if (d.niStatus && !epsStatus) {
          epsStatus = d.niStatus;
        }
      }
      if (pbr == null && d.equity != null && d.equity > 0 && marketCapEok && close) {
        const shares = Math.round(marketCapEok * 1e8 / close);
        if (shares > 0) {
          const dartBps = d.equity / shares;
          if (dartBps > 0) pbr = +(close / dartBps).toFixed(2);
        }
      }
      dartExtra = { roa: d.roa, opMargin: d.opMargin, netMargin: d.netMargin, year: d.year, fsDiv: d.fsDiv };

      // ── 거장 지표 계산 ───────────────────────────────────────────────────────
      const mktCap  = marketCapEok != null ? marketCapEok * 1e8 : null;
      const cashAmt = d.cash ?? 0;

      // PSR (Philip Fisher/Ken Fisher) = 시가총액 / 매출액
      if (mktCap && d.revenue > 0) {
        extra.psr = +(mktCap / d.revenue).toFixed(2);
      }

      // EV = 시가총액 + 부채총계 - 현금
      const ev = (mktCap != null && d.totalLiab != null) ? mktCap + d.totalLiab - cashAmt : null;

      // Earnings Yield = EBIT / EV (Greenblatt Magic Formula 밸류에이션)
      if (ev != null && ev > 0 && d.opIncome != null) {
        extra.earningsYield = +(d.opIncome / ev * 100).toFixed(1);
      }

      // ROIC = 세후영업이익 / 투하자본 (Greenblatt Magic Formula 수익성)
      // 투하자본 = 자기자본 + 장기부채(부채총계-유동부채) - 초과현금
      if (d.opIncome != null && d.equity > 0) {
        const clv = d.currentLiab ?? 0;
        const ic  = d.equity + (d.totalLiab ?? 0) - clv - cashAmt;
        if (ic > 0) extra.roic = +(d.opIncome * 0.78 / ic * 100).toFixed(1); // 세율 22% 가정
      }

      // EPS 가속도 (O'Neil CANSLIM A) = 현재 YoY - 이전 YoY (퍼센트포인트)
      if (d.ni_t != null && d.ni_t1 != null && d.ni_t2 != null && d.ni_t1 !== 0 && d.ni_t2 !== 0) {
        const yoy1 = d.ni_t  / d.ni_t1 - 1;
        const yoy2 = d.ni_t1 / d.ni_t2 - 1;
        extra.epsAccel = +((yoy1 - yoy2) * 100).toFixed(1);
      }

      // Piotroski F-Score (부분: 5개 기준)
      // F1: 순이익>0, F2: ROA 개선, F3: 레버리지 감소, F4: 자산회전율 개선, F5: 매출 성장
      let pScore = 0, pMax = 0;
      if (d.ni_t != null) { pMax++; if (d.ni_t > 0) pScore++; }
      if (d.ni_t != null && d.ni_t1 != null && d.totalAssets > 0) {
        pMax++;
        const roa_t  = d.ni_t  / d.totalAssets;
        const roa_t1 = d.ni_t1 / (d.totalAssets_t1 ?? d.totalAssets);
        if (roa_t > roa_t1) pScore++;
      }
      if (d.totalLiab_t1 != null && d.equity_t1 != null && d.equity_t1 > 0 && d.equity > 0) {
        pMax++;
        if ((d.totalLiab / d.equity) < (d.totalLiab_t1 / d.equity_t1)) pScore++;
      }
      if (d.revenue != null && d.revenue_t1 != null && d.totalAssets > 0 && d.totalAssets_t1 > 0) {
        pMax++;
        if (d.revenue / d.totalAssets > d.revenue_t1 / d.totalAssets_t1) pScore++;
      }
      if (d.revenue != null && d.revenue_t1 != null && d.revenue_t1 !== 0) {
        pMax++;
        if (d.revenue > d.revenue_t1) pScore++;
      }
      if (pMax > 0) { extra.piotroski = pScore; extra.piotroskiMax = pMax; }
    }

    // 흑자전환 종목: YoY를 CAGR 프록시로 Z-Score에 반영
    if (epsStatus === '흑자전환' && epsCagr2Y == null && epsYoY != null && epsYoY > 0) {
      epsCagr2Y = epsYoY;
    }

    // PEG: 2Y CAGR 우선 → YoY 대체 (둘 다 양수일 때만 계산)
    const growthForPeg = epsCagr2Y ?? epsYoY;
    let peg = null;
    if (per && per > 0 && growthForPeg != null && growthForPeg > 0) {
      peg = +(per / (growthForPeg * 100)).toFixed(2);
    }

    // PEGY (Lynch): PER / (YoY 성장률%) — 배당 제외 근사치, epsYoY 확정 후 계산
    if (per != null && per > 0 && epsYoY != null && epsYoY > 0) {
      extra.pegy = +(per / (epsYoY * 100)).toFixed(2);
    }

    return {
      code, name,
      raw: { per, pbr, epsCagr2Y, epsYoY, roe, epsVol, debtRatio },
      cagrStatus: epsStatus,
      peg, price: close, marketCapEok,
      dart: dartExtra,
      extra,
    };
  } catch (e) {
    console.warn(`[PEG] fetchStockMetrics ${code}:`, e.message?.slice(0, 80));
    return null;
  }
}

// ── Z-Score 기반 복합 점수 산출 ───────────────────────────────────────────────
function calcScores(stocks, weights) {
  const metrics = ['per', 'pbr', 'epsCagr2Y', 'epsYoY', 'roe', 'epsVol', 'debtRatio'];
  // 역수 지표 (낮을수록 좋음 → Z-Score 반전)
  const inverse = new Set(['per', 'pbr', 'epsVol', 'debtRatio']);

  const statMap = {};
  for (const m of metrics) {
    const vals = stocks.map(s => s.raw[m]).filter(v => v != null && isFinite(v));
    statMap[m] = { mean: mean(vals), std: std(vals) };
  }

  return stocks.map(s => {
    const z = {};
    let score = 0;
    let totalW = 0;

    for (const m of metrics) {
      const { mean: mn, std: sd } = statMap[m];
      let zv = zScore(s.raw[m], mn, sd);
      if (zv == null) { z[m] = null; continue; }
      if (inverse.has(m)) zv = -zv; // 낮을수록 좋은 지표는 반전
      z[m] = +zv.toFixed(3);

      const w = weights[m === 'epsCagr2Y' ? 'cagr'
                      : m === 'epsYoY'    ? 'yoy'
                      : m === 'epsVol'    ? 'vol'
                      : m === 'debtRatio' ? 'debt'
                      : m] ?? 0;

      if (w > 0) { score += w * zv; totalW += w; }
    }

    // 가중치 합이 1이 아닐 경우 정규화
    const compositeScore = totalW > 0 ? +(score / totalW).toFixed(3) : null;

    return { ...s, zScores: z, compositeScore };
  });
}

// ── 섹터 스크리닝 메인 함수 ───────────────────────────────────────────────────
async function runSectorScreener(sectorKey) {
  const sector = SECTORS[sectorKey];
  if (!sector) throw new Error(`알 수 없는 섹터: ${sectorKey}`);

  console.log(`[PEG] ${sector.name} 스크리닝 시작 (${sector.stocks.length}종목)`);

  const raw = [];
  for (const { code, name } of sector.stocks) {
    const data = await fetchStockMetrics(code, name, 'annual');
    if (data) raw.push(data);
    await sleep(300);
  }

  if (raw.length === 0) throw new Error('데이터 수집 실패 — KIS/DART 키 확인');

  const scored = calcScores(raw, sector.weights);
  scored.sort((a, b) => (b.compositeScore ?? -99) - (a.compositeScore ?? -99));

  const result = {
    sector:    sectorKey,
    name:      sector.name,
    position:  sector.position,
    reportPeg: sector.peg,
    weights:   sector.weights,
    results:   scored,
    timestamp: new Date().toISOString(),
  };

  memCache.set(`peg_${sectorKey}`, result, 86400);
  saveDisk(sectorKey, result);
  console.log(`[PEG] ${sector.name} 완료: ${scored.length}종목`);
  return result;
}

// ── 라우트 ────────────────────────────────────────────────────────────────────
router.get('/sectors', (req, res) => {
  res.json(Object.entries(SECTORS).map(([key, s]) => ({
    key,
    name:     s.name,
    badge:    s.badge,
    position: s.position,
    peg:      s.peg,
    count:    s.stocks.length,
  })));
});

router.get('/run/:sector', async (req, res) => {
  const sectorKey = req.params.sector;
  if (!SECTORS[sectorKey]) return res.status(404).json({ error: '섹터 없음' });

  // 캐시 우선
  const cached = memCache.get(`peg_${sectorKey}`);
  if (cached) return res.json(cached);

  // 디스크 캐시 (12h 이내)
  const disk = loadDisk(sectorKey);
  if (disk?.timestamp) {
    const ageH = (Date.now() - new Date(disk.timestamp).getTime()) / 3600000;
    if (ageH < 24) {
      memCache.set(`peg_${sectorKey}`, disk, Math.floor((24 - ageH) * 3600));
      return res.json(disk);
    }
  }

  // 새로 계산
  try {
    const result = await runSectorScreener(sectorKey);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/refresh/:sector', async (req, res) => {
  const sectorKey = req.params.sector;
  if (!SECTORS[sectorKey]) return res.status(404).json({ error: '섹터 없음' });
  memCache.del(`peg_${sectorKey}`);
  try {
    const result = await runSectorScreener(sectorKey);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 네이버 업종 번호 기반 스크리닝 헬퍼 ─────────────────────────────────────
async function runNaverScreener(naverNo, group, period = 'annual') {
  const weights = SECTOR_WEIGHTS[group];
  if (!weights) throw new Error(`알 수 없는 그룹: ${group}`);

  const sectorStocks = await getSectorStocks(naverNo);
  if (!sectorStocks.length) throw new Error('해당 업종 종목 없음');

  console.log(`[PEG] naverNo=${naverNo} group=${group} period=${period} 시작 (${sectorStocks.length}종목)`);

  const raw = [];
  for (const { code, name } of sectorStocks) {
    const data = await fetchStockMetrics(code, name, period);
    if (data) raw.push(data);
    await sleep(150);
  }

  if (!raw.length) throw new Error('데이터 수집 실패 — KIS/Naver 키 확인');

  const scored = calcScores(raw, weights);
  scored.sort((a, b) => (b.compositeScore ?? -99) - (a.compositeScore ?? -99));

  const result = {
    naverNo, group, period, weights,
    results: scored,
    timestamp: new Date().toISOString(),
    count: scored.length,
  };

  const cKey    = `peg_naver_${naverNo}_${group}_${period}`;
  const diskKey = `naver-${naverNo}-${group}-${period}`;
  memCache.set(cKey, result, 86400);
  saveDisk(diskKey, result);
  console.log(`[PEG] naverNo=${naverNo} 완료: ${scored.length}종목`);
  return result;
}

// ── 종목 리스트 기반 스크리닝 헬퍼 (stocks 타입 테마) ───────────────────────
async function runStocksScreener(themeId, stocks, group, period = 'annual') {
  const weights = SECTOR_WEIGHTS[group];
  if (!weights) throw new Error(`알 수 없는 그룹: ${group}`);

  console.log(`[PEG] theme=${themeId} group=${group} period=${period} 시작 (${stocks.length}종목)`);
  const raw = [];
  for (const { code, name } of stocks) {
    const data = await fetchStockMetrics(code, name, period);
    if (data) raw.push(data);
    await sleep(150);
  }

  if (!raw.length) throw new Error('데이터 수집 실패');

  const scored = calcScores(raw, weights);
  scored.sort((a, b) => (b.compositeScore ?? -99) - (a.compositeScore ?? -99));

  const result = {
    themeId, group, period, weights,
    results: scored,
    timestamp: new Date().toISOString(),
    count: scored.length,
  };

  const cKey    = `peg_theme_${themeId}_${group}_${period}`;
  const diskKey = `theme-${themeId}-${group}-${period}`;
  memCache.set(cKey, result, 86400);
  saveDisk(diskKey, result);
  console.log(`[PEG] theme=${themeId} 완료: ${scored.length}종목`);
  return result;
}

// ── 종목 리스트 라우트 ────────────────────────────────────────────────────────
router.post('/run-stocks', async (req, res) => {
  const { themeId, stocks } = req.body;
  const group  = (req.query.group  || 'it-hardware').toString();
  const period = (req.query.period || 'annual').toString();
  if (!SECTOR_WEIGHTS[group]) return res.status(400).json({ error: '유효하지 않은 그룹' });
  if (!['annual', 'quarter'].includes(period)) return res.status(400).json({ error: '유효하지 않은 period' });
  if (!themeId || !Array.isArray(stocks) || stocks.length === 0) return res.status(400).json({ error: '잘못된 요청' });

  const cKey    = `peg_theme_${themeId}_${group}_${period}`;
  const diskKey = `theme-${themeId}-${group}-${period}`;

  const cached = memCache.get(cKey);
  if (cached) return res.json(cached);

  const disk = loadDisk(diskKey);
  if (disk?.timestamp) {
    const ageH = (Date.now() - new Date(disk.timestamp).getTime()) / 3600000;
    if (ageH < 24) { memCache.set(cKey, disk, Math.floor((24 - ageH) * 3600)); return res.json(disk); }
  }

  try {
    return res.json(await runStocksScreener(themeId, stocks, group, period));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/refresh-stocks', async (req, res) => {
  const { themeId, stocks } = req.body;
  const group  = (req.query.group  || 'it-hardware').toString();
  const period = (req.query.period || 'annual').toString();
  if (!SECTOR_WEIGHTS[group]) return res.status(400).json({ error: '유효하지 않은 그룹' });
  if (!['annual', 'quarter'].includes(period)) return res.status(400).json({ error: '유효하지 않은 period' });
  if (!themeId || !Array.isArray(stocks) || stocks.length === 0) return res.status(400).json({ error: '잘못된 요청' });
  memCache.del(`peg_theme_${themeId}_${group}_${period}`);
  try {
    return res.json(await runStocksScreener(themeId, stocks, group, period));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── 네이버 업종 라우트 ────────────────────────────────────────────────────────
router.get('/run-naver/:naverNo', async (req, res) => {
  const { naverNo } = req.params;
  const group  = (req.query.group  || 'it-hardware').toString();
  const period = (req.query.period || 'annual').toString();
  if (!SECTOR_WEIGHTS[group]) return res.status(400).json({ error: '유효하지 않은 그룹' });
  if (!['annual', 'quarter'].includes(period)) return res.status(400).json({ error: '유효하지 않은 period' });

  const cKey    = `peg_naver_${naverNo}_${group}_${period}`;
  const diskKey = `naver-${naverNo}-${group}-${period}`;

  const cached = memCache.get(cKey);
  if (cached) return res.json(cached);

  const disk = loadDisk(diskKey);
  if (disk?.timestamp) {
    const ageH = (Date.now() - new Date(disk.timestamp).getTime()) / 3600000;
    if (ageH < 24) { memCache.set(cKey, disk, Math.floor((24 - ageH) * 3600)); return res.json(disk); }
  }

  try {
    return res.json(await runNaverScreener(naverNo, group, period));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/refresh-naver/:naverNo', async (req, res) => {
  const { naverNo } = req.params;
  const group  = (req.query.group  || 'it-hardware').toString();
  const period = (req.query.period || 'annual').toString();
  if (!SECTOR_WEIGHTS[group]) return res.status(400).json({ error: '유효하지 않은 그룹' });
  if (!['annual', 'quarter'].includes(period)) return res.status(400).json({ error: '유효하지 않은 period' });
  memCache.del(`peg_naver_${naverNo}_${group}_${period}`);
  try {
    return res.json(await runNaverScreener(naverNo, group, period));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
