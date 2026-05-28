const express = require('express');
const router = express.Router();
const { generateMarketInsights } = require('../services/claude');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 86400 }); // 최대 1일 (자정 TTL로 덮어씀)

// 오늘 자정까지 남은 초 계산
function secondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(60, Math.floor((midnight - now) / 1000));
}

// ─── GET /api/insights/cached ────────────────────────────────────────────────
// Claude API 호출 없이 당일 캐시만 반환 (없으면 content: null)
router.get('/cached', (req, res) => {
  const todayKey = new Date().toISOString().split('T')[0];
  const cacheKey = `insights_${todayKey}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ content: cached, cached: true });
  return res.json({ content: null, cached: false });
});

// ─── POST /api/insights/generate ─────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const { indices, sectors, news, screenerResults, macro, fredData, forceRefresh } = req.body;

    if (!indices || !news) {
      return res.status(400).json({ error: 'indices and news are required' });
    }

    // 당일 날짜 기준 캐시 키 → 같은 날이면 재사용, forceRefresh면 강제 재생성
    const todayKey = new Date().toISOString().split('T')[0]; // e.g. "2026-04-07"
    const cacheKey = `insights_${todayKey}`;

    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json({ content: cached, cached: true });
    }

    // PMI 최신값 자동 수집
    let pmi = null;
    try {
      const { getAllPMI } = require('../services/pmi');
      pmi = await getAllPMI();
    } catch { /* PMI 없어도 브리핑 가능 */ }

    const content = await generateMarketInsights({
      indices: indices || [],
      sectors: sectors || [],
      news: news || [],
      screenerResults: screenerResults || [],
      macro: macro || {},
      fredData: fredData || null,
      pmi,
    });

    // 자정까지만 캐시 유지
    cache.set(cacheKey, content, secondsUntilMidnight());
    res.json({ content, cached: false });
  } catch (err) {
    console.error('Insights error:', err.message);
    res.status(500).json({ error: 'Failed to generate insights', message: err.message });
  }
});

// ─── GET /api/insights/calendar ──────────────────────────────────────────────
router.get('/calendar', async (req, res) => {
  try {
    const { getCalendar } = require('../services/econCalendar');
    const { getEarningsCalendar } = require('../services/finnhub');
    const calCache = new NodeCache({ stdTTL: 3600 });

    const cacheKey = 'calendar_us';
    const cached = calCache.get(cacheKey);
    if (cached) return res.json(cached);

    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const to = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

    const [economic, earnings] = await Promise.allSettled([
      Promise.resolve(getCalendar('us', 14)),
      getEarningsCalendar(from, to),
    ]);

    const result = {
      economic: economic.status === 'fulfilled' ? economic.value : [],
      earnings: earnings.status === 'fulfilled'
        ? (earnings.value?.earningsCalendar || []).slice(0, 20)
        : [],
    };

    calCache.set(cacheKey, result, 3600);
    res.json(result);
  } catch (err) {
    console.error('Calendar error:', err.message);
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
});

module.exports = router;
