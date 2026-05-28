const express = require('express');
const router = express.Router();
const { getHistorical, getQuotes } = require('../services/yahoo');
const { calculateRSI, calculate60DayRange, calculateATR, getRSIZone } = require('../services/calculations');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 900 }); // 15-minute cache (screener is slow)

// ─── Universe of stocks to screen ────────────────────────────────────────────
// S&P 100 + high-beta names for best screening results
const UNIVERSE = [
  // Mega-cap tech
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AVGO', 'AMD', 'INTC',
  // Financials
  'JPM', 'BAC', 'GS', 'MS', 'WFC', 'C', 'BLK', 'AXP', 'V', 'MA',
  // Healthcare
  'JNJ', 'UNH', 'LLY', 'ABBV', 'MRK', 'PFE', 'TMO', 'ABT', 'AMGN', 'GILD',
  // Consumer
  'AMZN', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT', 'COST', 'WMT', 'PG', 'KO', 'PEP',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'OXY', 'MPC',
  // Industrial / Other
  'BA', 'CAT', 'GE', 'MMM', 'HON', 'RTX', 'UPS', 'FDX', 'DE',
  // Tech / Growth
  'NFLX', 'ADBE', 'CRM', 'QCOM', 'TXN', 'ORCL', 'CSCO', 'IBM',
  // High-beta / popular
  'COIN', 'MSTR', 'PLTR', 'RIVN', 'LCID', 'SOFI', 'UPST', 'RBLX', 'SNAP', 'UBER', 'LYFT',
  // Commodities / Materials
  'FCX', 'NEM', 'VALE', 'CLF', 'AA',
  // ETFs (useful for macro screening)
  'SPY', 'QQQ', 'IWM', 'XLE', 'XLF', 'XLK',
];

// Deduplicate
const SCREEN_UNIVERSE = [...new Set(UNIVERSE)];

async function screenStock(symbol) {
  try {
    // ~90 캘린더일 = 약 63 거래일
    const candles = await getHistorical(symbol, 90);

    if (!candles || candles.length < 30) return null;

    const closes  = candles.map(c => c.close);
    const highs   = candles.map(c => c.high);
    const lows    = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume || 0);

    // 최근 60 거래일만 사용
    const days = Math.min(60, closes.length);
    const recentCloses  = closes.slice(-days);
    const recentHighs   = highs.slice(-days);
    const recentLows    = lows.slice(-days);
    const recentVolumes = volumes.slice(-days);

    const rsi = calculateRSI(recentCloses, 14);
    const rangePct = calculate60DayRange(recentHighs, recentLows);
    const atr = calculateATR(recentHighs, recentLows, recentCloses, 14);

    // 저점이 고점보다 먼저여야 함 (상승 방향만 허용)
    const maxHigh = Math.max(...recentHighs);
    const minLow  = Math.min(...recentLows);
    const highIdx = recentHighs.lastIndexOf(maxHigh); // 가장 최근 고점
    const lowIdx  = recentLows.indexOf(minLow);       // 가장 오래된 저점
    if (highIdx <= lowIdx) return null; // 고점 이후 저점 → 하락 중 → 제외

    const currentPrice = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2] || currentPrice;
    const dayChange = ((currentPrice - prevClose) / prevClose) * 100;

    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
    const latestVolume = recentVolumes[recentVolumes.length - 1] || 0;
    const relVolume = avgVolume > 0 ? latestVolume / avgVolume : 0;

    const high60 = Math.max(...recentHighs);
    const low60 = Math.min(...recentLows);

    // Price position within 60-day range (0% = at low, 100% = at high)
    const pricePosition = high60 > low60
      ? ((currentPrice - low60) / (high60 - low60)) * 100
      : 50;

    return {
      symbol,
      rsi: rsi !== null ? Math.round(rsi * 10) / 10 : null,
      rsiZone: getRSIZone(rsi),
      rangePct: Math.round(rangePct * 10) / 10,
      currentPrice,
      dayChange: Math.round(dayChange * 100) / 100,
      high60,
      low60,
      pricePosition: Math.round(pricePosition),
      atr: atr ? Math.round(atr * 100) / 100 : null,
      avgVolume: Math.round(avgVolume),
      relVolume: Math.round(relVolume * 100) / 100,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    return null;
  }
}

// ─── GET /api/screener ───────────────────────────────────────────────────────
// Query params:
//   rsiMin (default 20), rsiMax (default 60)
//   rangeMin (default 50) — 60일 등락폭 하한 (이상 = 변동성 큰 종목)
//   limit (default 20)
router.get('/', async (req, res) => {
  const rsiMin  = parseFloat(req.query.rsiMin)  || 20;
  const rsiMax  = parseFloat(req.query.rsiMax)  || 60;
  const rangeMin = parseFloat(req.query.rangeMin) ?? 50;
  const limit   = parseInt(req.query.limit) || 20;

  const cacheKey = `screener_${rsiMin}_${rsiMax}_${rangeMin}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const results = [];
    const BATCH_SIZE = 10;
    for (let i = 0; i < SCREEN_UNIVERSE.length; i += BATCH_SIZE) {
      const batch = SCREEN_UNIVERSE.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(batch.map(s => screenStock(s)));
      batchResults.forEach(r => {
        if (r.status === 'fulfilled' && r.value) results.push(r.value);
      });
    }

    // RSI 범위 + 60일 등락폭 하한 필터 (변동성 큰 종목)
    const filtered = results
      .filter(s =>
        s.rsi !== null &&
        s.rsi >= rsiMin &&
        s.rsi <= rsiMax &&
        s.rangePct >= rangeMin
      )
      .sort((a, b) => b.rangePct - a.rangePct) // 등락폭 큰 순
      .slice(0, limit);

    // 필터된 종목만 회사명 일괄 조회 (최소 API 호출)
    try {
      const quotes = await getQuotes(filtered.map(s => s.symbol));
      const nameMap = {};
      quotes.forEach(q => { if (q?.symbol && q?.name) nameMap[q.symbol] = q.name; });
      filtered.forEach(s => { s.name = nameMap[s.symbol] || s.symbol; });
    } catch { /* 이름 조회 실패해도 티커로 표시 */ }

    const response = {
      results: filtered,
      total: filtered.length,
      universe: SCREEN_UNIVERSE.length,
      screened: results.length,
      criteria: { rsiMin, rsiMax, rangeMin },
      timestamp: new Date().toISOString(),
    };

    cache.set(cacheKey, response);
    res.json(response);
  } catch (err) {
    console.error('Screener error:', err.message);
    res.status(500).json({ error: 'Screener failed', message: err.message });
  }
});

// ─── GET /api/screener/universe ──────────────────────────────────────────────
router.get('/universe', (req, res) => {
  res.json({ symbols: SCREEN_UNIVERSE, count: SCREEN_UNIVERSE.length });
});

module.exports = router;
