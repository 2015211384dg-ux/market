const express = require('express');
const router  = express.Router();
const NodeCache = require('node-cache');
const fs      = require('fs');
const path    = require('path');
const { getQuote, getQuotes, getHistorical, getKoreanNews, getKoreanNewsEn, getKoreanEarningsCalendar } = require('../services/yahoo');
const { getCalendar } = require('../services/econCalendar');
const { calculateRSI, calculate60DayRange, getRSIZone } = require('../services/calculations');
const { getKRStockUniverse } = require('../services/krStockList');
const { getKRFullUniverse }  = require('../services/krFullUniverse');
const { saveScreenerToExcel, EXPORT_DIR } = require('../services/excelExport');
const { estimateSentiment } = require('../services/newssentiment');
const { getFundamentalsBatch } = require('../services/fundamentals');

const cache     = new NodeCache({ stdTTL: 300 });   // 일반 캐시 5분
const fullCache = new NodeCache({ stdTTL: 86400 }); // 전체 스크리너 캐시 24시간

// ─── 전체 스크리너 디스크 캐시 ────────────────────────────────────────────────
const DISK_CACHE_PATH = path.join(__dirname, '../data/full-screener-cache.json');

function saveToDisk(data) {
  try {
    fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify(data), 'utf8');
  } catch (e) {
    console.warn('[FullScreener] 디스크 캐시 저장 실패:', e.message);
  }
}

function loadFromDisk() {
  try {
    if (!fs.existsSync(DISK_CACHE_PATH)) return null;
    const raw = fs.readFileSync(DISK_CACHE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[FullScreener] 디스크 캐시 로드 실패:', e.message);
    return null;
  }
}

// 서버 시작 시 디스크 캐시 복원 + 오늘치 없으면 자동 재실행
(function restoreFromDisk() {
  const data = loadFromDisk();
  const todayKey = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/\. /g, '-').replace('.', '');
  if (data) {
    fullCache.set('full_last', data, 86400 * 2);
    if (data.runDate === todayKey) {
      fullCache.set(`full_${todayKey}`, data, 86400);
      console.log(`[FullScreener] 디스크 캐시 복원 완료 (${data.runDate}, ${data.total}개 종목)`);
      return; // 오늘치 있으면 재실행 불필요
    }
    console.log(`[FullScreener] 이전 캐시 복원 (${data.runDate}) — 오늘치 없음, 백그라운드 재실행`);
  } else {
    console.log('[FullScreener] 캐시 없음 — 백그라운드 초기 실행');
  }

  // 평일(월~금)에만 실행 (주말엔 시장 데이터가 없으므로 스킵)
  const dayOfWeek = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' });
  if (['Sat', 'Sun'].includes(dayOfWeek)) {
    console.log('[FullScreener] 주말 — 자동 재실행 스킵');
    return;
  }

  // 서버 완전 기동 후 실행되도록 5초 지연
  setTimeout(() => {
    runFullScreener().catch(e => console.error('[FullScreener] 자동 재실행 오류:', e.message));
  }, 5000);
})();

// ─── 한국 주요 지수 ───────────────────────────────────────────────────────────
const KR_INDICES = [
  { symbol: '^KS11',  name: 'KOSPI'     },
  { symbol: '^KQ11',  name: 'KOSDAQ'    },
  { symbol: '^KS200', name: 'KOSPI 200' },
];

// ─── 섹터 대표 ETF (KODEX / TIGER 시리즈) ────────────────────────────────────
const KR_SECTORS = [
  { symbol: '091160.KS', name: '반도체'       },
  { symbol: '102110.KS', name: 'IT (TIGER)'  },
  { symbol: '102780.KS', name: '은행/금융'    },
  { symbol: '117680.KS', name: '증권'        },
  { symbol: '139220.KS', name: '헬스케어'     },
  { symbol: '140710.KS', name: '운송'        },
  { symbol: '157490.KS', name: '소비재'       },
  { symbol: '229200.KS', name: 'KOSDAQ 150'  },
  { symbol: '091170.KS', name: '화학'        },
  { symbol: '098560.KS', name: '미디어/통신'  },
];

// ─── GET /api/kr-market/indices ──────────────────────────────────────────────
router.get('/indices', async (req, res) => {
  const cacheKey = 'kr_indices';
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const quotes = await getQuotes(KR_INDICES.map(i => i.symbol));
    const result = KR_INDICES.map(meta => {
      const q = quotes.find(q => q.symbol === meta.symbol);
      if (!q || !q.c) return null;
      return { symbol: meta.symbol, name: meta.name, c: q.c, pc: q.pc, d: q.d, dp: q.dp };
    }).filter(Boolean);

    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[kr-market/indices]', err.message);
    res.status(500).json({ error: '한국 지수 조회 실패', message: err.message });
  }
});

// ─── GET /api/kr-market/sectors ─────────────────────────────────────────────
router.get('/sectors', async (req, res) => {
  const cacheKey = 'kr_sectors';
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const quotes = await getQuotes(KR_SECTORS.map(s => s.symbol));
    const result = KR_SECTORS.map(meta => {
      const q = quotes.find(q => q.symbol === meta.symbol);
      return {
        symbol: meta.symbol,
        name:   meta.name,
        c:  q?.c  ?? 0,
        pc: q?.pc ?? 0,
        d:  q?.d  ?? 0,
        dp: q?.dp ?? 0,
      };
    }).filter(s => s.c > 0).sort((a, b) => (b.dp || 0) - (a.dp || 0));

    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[kr-market/sectors]', err.message);
    res.status(500).json({ error: '한국 섹터 조회 실패', message: err.message });
  }
});

// ─── 공통 종목 스크리닝 함수 ─────────────────────────────────────────────────
async function screenKRStock(symbol, nameHint, { rsiMin, rsiMax, rangeMin }) {
  try {
    const candles = await getHistorical(symbol, 90);
    if (candles.length < 20) return null;

    const closes  = candles.map(c => c.close);
    const highs   = candles.map(c => c.high);
    const lows    = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume || 0);

    const rsi      = calculateRSI(closes, 14);
    const rangePct = calculate60DayRange(highs, lows);

    if (rsi === null || rsi < rsiMin || rsi > rsiMax) return null;
    if (rangePct < rangeMin) return null;

    // 저점 → 고점 방향만 (하락 중인 종목 제외)
    const maxHigh = Math.max(...highs);
    const minLow  = Math.min(...lows);
    const highIdx = highs.lastIndexOf(maxHigh);
    const lowIdx  = lows.indexOf(minLow);
    if (highIdx <= lowIdx) return null;

    const currentPrice  = closes[closes.length - 1];
    const prevClose     = closes[closes.length - 2] ?? currentPrice;
    const dayChange     = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0;
    const high60        = Math.max(...highs.slice(-60));
    const low60         = Math.min(...lows.slice(-60));
    const pricePosition = high60 > low60 ? ((currentPrice - low60) / (high60 - low60)) * 100 : 50;
    const avgVol        = volumes.slice(-60).reduce((a, b) => a + b, 0) / 60;
    const relVolume     = avgVol > 0 ? (volumes[volumes.length - 1] / avgVol) : 0;

    // 이름은 hint 우선 (getQuote 생략으로 속도 향상)
    const name = nameHint || symbol;

    return {
      symbol,
      name,
      rsi:           +rsi.toFixed(1),
      rsiZone:       getRSIZone(rsi),
      rangePct:      +rangePct.toFixed(1),
      currentPrice,
      dayChange:     +dayChange.toFixed(2),
      high60,
      low60,
      pricePosition: +pricePosition.toFixed(0),
      relVolume:     +relVolume.toFixed(2),
    };
  } catch {
    return null;
  }
}

async function runBatchScreener(symbolList, criteria, BATCH = 8) {
  const results = [];
  for (let i = 0; i < symbolList.length; i += BATCH) {
    const batch = symbolList.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(item => {
        const symbol   = typeof item === 'string' ? item : item.symbol;
        const nameHint = typeof item === 'string' ? null  : item.name;
        return screenKRStock(symbol, nameHint, criteria);
      })
    );
    settled.forEach(r => { if (r.status === 'fulfilled' && r.value) results.push(r.value); });
  }
  return results;
}

// ─── GET /api/kr-market/screener ────────────────────────────────────────────
router.get('/screener', async (req, res) => {
  const rsiMin   = parseFloat(req.query.rsiMin)   || 20;
  const rsiMax   = parseFloat(req.query.rsiMax)   || 40;
  const rangeMin = parseFloat(req.query.rangeMin) || 50;

  const cacheKey = `kr_screener_${rsiMin}_${rsiMax}_${rangeMin}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const universe   = await getKRStockUniverse({ total: 500 });
    const criteria   = { rsiMin, rsiMax, rangeMin };
    const allResults = await runBatchScreener(universe, criteria);

    const filtered = allResults
      .sort((a, b) => b.rangePct - a.rangePct)
      .slice(0, 30);

    const response = {
      results:  filtered,
      total:    filtered.length,
      universe: universe.length,
      screened: allResults.length,
      criteria,
      timestamp: new Date().toISOString(),
    };

    cache.set(cacheKey, response);
    res.json(response);
  } catch (err) {
    console.error('[kr-market/screener]', err.message);
    res.status(500).json({ error: '한국 스크리너 실패', message: err.message });
  }
});

// ─── GET /api/kr-market/screener-full ────────────────────────────────────────
// 매일 00:30 자동 실행 결과 반환 (전 종목 · ETF/관리/환기/거래정지 제외)
router.get('/screener-full', async (req, res) => {
  const todayKey = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/\. /g, '-').replace('.', '');
  const cached = fullCache.get(`full_${todayKey}`);
  if (cached) return res.json(cached);

  // 아직 오늘 결과 없음 → 마지막 결과(메모리 → 디스크 순) 반환
  const lastResult = fullCache.get('full_last') || loadFromDisk();
  if (lastResult) return res.json({ ...lastResult, isLastRun: true });

  res.json({ results: [], total: 0, universe: 0, screened: 0, notYetRun: true,
    message: '매일 오전 12:30에 자동 실행됩니다. 첫 실행 전입니다.' });
});

// ─── 전체 종목 스크리너 실행 함수 (cron 호출용) ──────────────────────────────
async function runFullScreener({ rsiMin = 20, rsiMax = 40, rangeMin = 50 } = {}) {
  console.log('[FullScreener] 전체 종목 리스트 가져오는 중...');
  const universe = await getKRFullUniverse(); // ETF/관리/환기 제외 전 종목
  console.log(`[FullScreener] ${universe.length}개 종목 스크리닝 시작`);

  const criteria   = { rsiMin, rsiMax, rangeMin };
  const allResults = await runBatchScreener(universe, criteria, 10);

  const filtered = allResults.sort((a, b) => b.rangePct - a.rangePct);

  const todayKey = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/\. /g, '-').replace('.', '');
  const runTime  = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  const response = {
    results:  filtered,
    total:    filtered.length,
    universe: universe.length,
    screened: allResults.length,
    criteria,
    runAt:    runTime,
    runDate:  todayKey,
    timestamp: new Date().toISOString(),
  };

  fullCache.set(`full_${todayKey}`, response, 86400);
  fullCache.set('full_last', response, 86400 * 2);
  saveToDisk(response);

  console.log(`[FullScreener] 완료: ${filtered.length}개 종목 검색됨`);

  // 엑셀 저장 (백그라운드 — 실패해도 응답에 영향 없음)
  saveScreenerToExcel(filtered, response).catch(e =>
    console.error('[Excel] 저장 실패:', e.message)
  );

  return response;
}

// ─── POST /api/kr-market/screener-full/run ───────────────────────────────────
// 전체 스크리너 수동 실행 (크론 대기 없이 즉시 실행)
router.post('/screener-full/run', async (req, res) => {
  try {
    console.log('[FullScreener] 수동 실행 요청');
    // 즉시 응답 후 백그라운드 실행
    res.json({ message: '전체 스크리너 실행 시작. 완료까지 수 분 소요됩니다.' });
    const result = await runFullScreener();
    console.log(`[FullScreener] 수동 실행 완료: ${result.total}개`);
  } catch (err) {
    console.error('[FullScreener] 수동 실행 오류:', err.message);
  }
});

// ─── POST /api/kr-market/fundamentals ────────────────────────────────────────
// body: { symbols: ['005930.KS', ...] } 또는 { stocks: [{ symbol, ... }] }
router.post('/fundamentals', async (req, res) => {
  const stocks = Array.isArray(req.body?.stocks)
    ? req.body.stocks
    : Array.isArray(req.body?.symbols)
      ? req.body.symbols.map(s => ({ symbol: s }))
      : null;

  if (!stocks?.length) {
    return res.status(400).json({ error: 'symbols 또는 stocks 배열이 필요합니다' });
  }
  if (stocks.length > 200) {
    return res.status(400).json({ error: '한 번에 최대 200개까지 조회 가능합니다' });
  }
  try {
    const data = await getFundamentalsBatch(stocks);
    res.json(data);
  } catch (err) {
    console.error('[kr-market/fundamentals]', err.message);
    res.status(500).json({ error: '재무 데이터 조회 실패' });
  }
});

// ─── GET /api/kr-market/naver-sector/:no ─────────────────────────────────────
// 네이버 금융 업종 번호로 전종목 반환
router.get('/naver-sector/:no', async (req, res) => {
  try {
    const { getSectorStocks } = require('../services/naverSector');
    const stocks = await getSectorStocks(req.params.no);
    res.json(stocks);
  } catch (err) {
    console.error('[naver-sector]', err.message);
    res.status(500).json({ error: '업종 종목 조회 실패', message: err.message });
  }
});

// ─── POST /api/kr-market/theme-prices ────────────────────────────────────────
// KIS API로 테마 종목 실시간 시세 조회
// body: { codes: ["005930", "000660", ...] }  (6자리 종목코드)
router.post('/theme-prices', async (req, res) => {
  const codes = req.body?.codes;
  if (!Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({ error: 'codes 배열이 필요합니다' });
  }

  // 5분 캐시 (종목코드 정렬 후 키 생성)
  const cacheKey = `theme_prices_${[...codes].sort().join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const { getPrice } = require('../services/kis');
    const results = {};

    // KIS API 병렬 호출 (최대 10개씩)
    const BATCH = 10;
    for (let i = 0; i < codes.length; i += BATCH) {
      const slice = codes.slice(i, i + BATCH);
      await Promise.all(slice.map(async code => {
        try {
          const p = await getPrice(code);
          const dayChangePct = p.prevClose > 0
            ? +((p.close - p.prevClose) / p.prevClose * 100).toFixed(2)
            : null;
          results[code] = {
            price:        p.close        || null,
            prevClose:    p.prevClose    || null,
            dayChangePct,
            marketCapEok: p.marketCapEok || null,
            volume:       p.volume       || null,
            // KIS 재무지표 (소형주 포함 전종목 제공)
            per:  p.per  ?? null,
            pbr:  p.pbr  ?? null,
            roe:  p.roe  ?? null,
            eps:  p.eps  ?? null,
            bps:  p.bps  ?? null,
          };
        } catch {
          results[code] = null;
        }
      }));
    }

    cache.set(cacheKey, results, 300); // 5분 캐시
    res.json(results);
  } catch (err) {
    console.error('[kr-market/theme-prices]', err.message);
    res.status(500).json({ error: 'KIS 시세 조회 실패', message: err.message });
  }
});

// ─── POST /api/kr-market/dart-financials ─────────────────────────────────────
// DART 공시 기반 재무비율 일괄 조회 (ROA·ROE·영업이익률·순이익률·부채비율)
// body: { codes: ["005930", "000660", ...] }
router.post('/dart-financials', async (req, res) => {
  const codes = req.body?.codes;
  if (!Array.isArray(codes) || codes.length === 0)
    return res.status(400).json({ error: 'codes 배열 필요' });
  if (codes.length > 100)
    return res.status(400).json({ error: '최대 100종목' });

  const cacheKey = `dart_fin_${[...codes].sort().join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const { getFinancialRatios } = require('../services/dart');
  const results = {};

  // 동시 5개 병렬 (DART API rate limit 고려)
  const CONC = 5;
  for (let i = 0; i < codes.length; i += CONC) {
    await Promise.all(
      codes.slice(i, i + CONC).map(async code => {
        results[code] = await getFinancialRatios(code).catch(() => null);
      })
    );
  }

  cache.set(cacheKey, results, 86400); // 24시간
  res.json(results);
});

// ─── GET /api/kr-market/news ─────────────────────────────────────────────────
router.get('/news', async (req, res) => {
  const cacheKey = 'kr_news';
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const items = await getKoreanNews(20);
    const result = items.map(n => ({
      ...n,
      sentiment: estimateSentiment(n.headline || ''),
    }));

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (err) {
    console.error('[kr-market/news]', err.message);
    res.status(500).json({ error: '한국 뉴스 조회 실패', message: err.message });
  }
});

// ─── GET /api/kr-market/news/en ──────────────────────────────────────────────
router.get('/news/en', async (req, res) => {
  const cacheKey = 'kr_news_en';
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const items = await getKoreanNewsEn(20);
    const result = items.map(n => ({
      ...n,
      sentiment: estimateSentiment(n.headline || ''),
    }));
    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (err) {
    console.error('[kr-market/news/en]', err.message);
    res.status(500).json({ error: '영문 뉴스 조회 실패', message: err.message });
  }
});

// ─── GET /api/kr-market/calendar ─────────────────────────────────────────────
// BOK 2026 금통위 일정 (한국은행 공식 발표 기준)
const BOK_2026 = [
  { date: '2026-01-16', event: '한국은행 금통위 - 기준금리 결정', country: 'KR', impact: 'high' },
  { date: '2026-02-25', event: '한국은행 금통위 - 기준금리 결정', country: 'KR', impact: 'high' },
  { date: '2026-04-17', event: '한국은행 금통위 - 기준금리 결정', country: 'KR', impact: 'high' },
  { date: '2026-05-28', event: '한국은행 금통위 - 기준금리 결정', country: 'KR', impact: 'high' },
  { date: '2026-07-17', event: '한국은행 금통위 - 기준금리 결정', country: 'KR', impact: 'high' },
  { date: '2026-08-27', event: '한국은행 금통위 - 기준금리 결정', country: 'KR', impact: 'high' },
  { date: '2026-10-16', event: '한국은행 금통위 - 기준금리 결정', country: 'KR', impact: 'high' },
  { date: '2026-11-26', event: '한국은행 금통위 - 기준금리 결정', country: 'KR', impact: 'high' },
];

router.get('/calendar', async (req, res) => {
  const cacheKey = 'kr_calendar';
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    // BOK 금통위 + 한국 관련 US 주요 이벤트
    const economic = getCalendar('kr', 60).slice(0, 6);

    // Yahoo 실적 캘린더
    const earningsRaw = await getKoreanEarningsCalendar();
    const earnings = earningsRaw.map(e => ({
      symbol:          e.symbol.replace('.KS', '').replace('.KQ', ''),
      name:            e.name,
      date:            e.date,
      hour:            '',
      epsEstimate:     e.epsEstimate,
      revenueEstimate: e.revenueEstimate,
      isEstimate:      e.isEstimate,
    }));

    const result = { economic, earnings };
    cache.set(cacheKey, result, 3600);
    res.json(result);
  } catch (err) {
    console.error('[kr-market/calendar]', err.message);
    res.status(500).json({ error: '한국 캘린더 조회 실패', message: err.message });
  }
});

module.exports = Object.assign(router, { runFullScreener });
