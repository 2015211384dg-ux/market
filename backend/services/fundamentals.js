const { getDartFullFinancials } = require('./dart');
const { getPrice }              = require('./kis');
const NodeCache                 = require('node-cache');

const cache = new NodeCache({ stdTTL: 86400 }); // 24시간

async function getFundamentals(symbol) {
  const cached = cache.get(symbol);
  if (cached !== undefined) return cached;

  try {
    const stockCode = symbol.replace(/\.(KS|KQ)$/, '');

    const [d, kis] = await Promise.all([
      getDartFullFinancials(stockCode).catch(() => null),
      getPrice(stockCode).catch(() => null),
    ]);

    // ── DART 기반 순수 재무 비율 (가격 불필요) ────────────────────────────────
    const roe             = d?.equity > 0 && d?.ni_t != null
                              ? +(d.ni_t / d.equity * 100).toFixed(1) : null;
    const roa             = d?.totalAssets > 0 && d?.ni_t != null
                              ? +(d.ni_t / d.totalAssets * 100).toFixed(1) : null;
    const operatingMargin = d?.revenue > 0 && d?.opIncome != null
                              ? +(d.opIncome / d.revenue * 100).toFixed(1) : null;
    const netMargin       = d?.revenue > 0 && d?.ni_t != null
                              ? +(d.ni_t / d.revenue * 100).toFixed(1) : null;
    const debtToEquity    = d?.equity > 0 && d?.totalLiab != null
                              ? +(d.totalLiab / d.equity * 100).toFixed(1) : null;
    const currentRatio    = d?.currentLiab > 0 && d?.currentAssets != null
                              ? +(d.currentAssets / d.currentLiab).toFixed(2) : null;
    const revenueGrowth   = d?.revenue_t1 != null && d.revenue_t1 !== 0 && d?.revenue != null
                              ? +((d.revenue / d.revenue_t1 - 1) * 100).toFixed(1) : null;
    const earningsGrowth  = d?.ni_t1 != null && d.ni_t1 !== 0 && d?.ni_t != null
                              ? +((d.ni_t / d.ni_t1 - 1) * 100).toFixed(1) : null;

    // ── KIS 제공 밸류에이션 (PBR, PER) ───────────────────────────────────────
    // KIS 값 우선, 없으면 DART 시총 추정으로 계산
    const mktCap = kis?.marketCapEok != null ? kis.marketCapEok * 1e8 : null;

    let pbr = kis?.pbr ?? null;
    let per = kis?.per ?? null;
    if (pbr == null && mktCap != null && d?.equity > 0)
      pbr = +(mktCap / d.equity).toFixed(2);
    if (per == null && mktCap != null && d?.ni_t > 0)
      per = +(mktCap / d.ni_t).toFixed(1);

    // ── EV/EBIT (DART opIncome 기반, D&A 미포함) ──────────────────────────────
    let evEbitda = null;
    if (mktCap != null && d?.totalLiab != null && d?.opIncome > 0) {
      const cashAmt = d.cash ?? 0;
      const ev      = mktCap + d.totalLiab - cashAmt;
      if (ev > 0) evEbitda = +(ev / d.opIncome).toFixed(1);
    }

    const result = {
      roe, roa, operatingMargin, netMargin, debtToEquity, currentRatio,
      revenueGrowth, earningsGrowth,
      pbr, per, evEbitda,
      fcfYield:      null,
      dividendYield: null,
      _dartYear: d?.year ?? null,
    };

    cache.set(symbol, result);
    return result;
  } catch (e) {
    console.warn(`[fundamentals] ${symbol}:`, e.message);
    return null;
  }
}

async function getFundamentalsBatch(stocks, BATCH = 5) {
  const symbols = stocks.map(s => (typeof s === 'string' ? s : s.symbol));
  const results = {};
  for (let i = 0; i < symbols.length; i += BATCH) {
    await Promise.all(
      symbols.slice(i, i + BATCH).map(async sym => {
        results[sym] = await getFundamentals(sym);
      })
    );
  }
  return results;
}

module.exports = { getFundamentals, getFundamentalsBatch };
