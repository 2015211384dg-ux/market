const express = require('express');
const router = express.Router();
const { getQuote, getQuotes } = require('../services/yahoo');
const { getObservation } = require('../services/fred');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 300 });

// ─── 지수 심볼 ────────────────────────────────────────────────────────────────
const INDEX_SYMBOLS = [
  { symbol: '^GSPC', name: 'S&P 500',    type: 'index' },
  { symbol: '^NDX',  name: '나스닥 100', type: 'index' },
  { symbol: '^DJI',  name: '다우존스',   type: 'index' },
  { symbol: '^RUT',  name: '러셀 2000',  type: 'index' },
  { symbol: '^VIX',  name: '공포지수',   type: 'volatility' },
];

const SECTOR_ETFS = [
  { symbol: 'XLK',  name: '기술' },
  { symbol: 'XLF',  name: '금융' },
  { symbol: 'XLV',  name: '헬스케어' },
  { symbol: 'XLE',  name: '에너지' },
  { symbol: 'XLI',  name: '산업재' },
  { symbol: 'XLY',  name: '경기소비재' },
  { symbol: 'XLP',  name: '필수소비재' },
  { symbol: 'XLU',  name: '유틸리티' },
  { symbol: 'XLRE', name: '부동산' },
  { symbol: 'XLB',  name: '소재' },
  { symbol: 'XLC',  name: '통신서비스' },
];

const MACRO_SYMBOLS = [
  { symbol: 'GLD',  name: '금',          key: 'gold' },
  { symbol: 'USO',  name: '원유 (WTI)',  key: 'oil' },
  { symbol: 'UUP',  name: '달러 인덱스', key: 'dxy' },
  { symbol: 'CPER', name: '구리',        key: 'copper' },
];

// 국채 금리는 FRED DGS 시리즈로 실제 수익률 조회
const YIELD_SERIES = [
  { id: 'DGS2',  name: '미국채 2년 금리',  key: 'twoYear', units: 'lin' },
  { id: 'DGS20', name: '미국채 20년 금리', key: 'tlt',      units: 'lin' },
];

// ─── GET /api/market/indices ─────────────────────────────────────────────────
router.get('/indices', async (req, res) => {
  try {
    const cacheKey = 'indices';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const results = await Promise.allSettled(
      INDEX_SYMBOLS.map(meta =>
        getQuote(meta.symbol).then(q => q && q.c > 0 ? { ...meta, ...q } : null)
      )
    );

    const finalData = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    cache.set(cacheKey, finalData);
    res.json(finalData);
  } catch (err) {
    console.error('Indices error:', err.message);
    res.status(500).json({ error: 'Failed to fetch indices' });
  }
});

// ─── GET /api/market/sectors ─────────────────────────────────────────────────
router.get('/sectors', async (req, res) => {
  try {
    const cacheKey = 'sectors';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const quotes = await getQuotes(SECTOR_ETFS.map(s => s.symbol));

    const data = quotes
      .filter(q => q.c && q.c > 0)
      .map(q => {
        const meta = SECTOR_ETFS.find(s => s.symbol === q.symbol) || {};
        return { ...q, symbol: q.symbol, name: meta.name || q.name };
      })
      .sort((a, b) => (b.dp || 0) - (a.dp || 0));

    cache.set(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error('Sectors error:', err.message);
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

// ─── GET /api/market/macro ───────────────────────────────────────────────────
router.get('/macro', async (req, res) => {
  try {
    const cacheKey = 'macro';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [macroQuotes, vixQ, ...yieldResults] = await Promise.all([
      getQuotes(MACRO_SYMBOLS.map(s => s.symbol)),
      getQuote('^VIX'),
      ...YIELD_SERIES.map(y => getObservation(y).catch(() => null)),
    ]);

    const result = {};
    macroQuotes.forEach(q => {
      const meta = MACRO_SYMBOLS.find(s => s.symbol === q.symbol);
      if (meta && q.c > 0) result[meta.key] = { ...meta, ...q };
    });

    if (vixQ && vixQ.c > 0) {
      result.vix = { symbol: '^VIX', name: '공포지수(VIX)', ...vixQ };
    }

    // 국채 수익률 (FRED)
    yieldResults.forEach((obs, i) => {
      if (!obs || obs.value == null) return;
      const meta = YIELD_SERIES[i];
      result[meta.key] = {
        symbol: meta.id,
        name:   meta.name,
        key:    meta.key,
        c:      obs.value,      // 실제 금리 %
        pc:     obs.prevValue ?? obs.value,
        d:      obs.change ?? 0,
        dp:     obs.prevValue ? ((obs.value - obs.prevValue) / obs.prevValue) * 100 : 0,
        isYield: true,
      };
    });

    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('Macro error:', err.message);
    res.status(500).json({ error: 'Failed to fetch macro data' });
  }
});

// ─── GET /api/market/status ──────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const cacheKey = 'market_status';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    // Yahoo Finance quote의 marketState로 장 상태 판단
    const q = await getQuote('^GSPC');
    const state = q?.marketState || 'CLOSED';
    const isOpen = state === 'REGULAR';
    const status = { isOpen, session: state };

    cache.set(cacheKey, status, 60);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch market status' });
  }
});

module.exports = router;
