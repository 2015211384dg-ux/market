const express = require('express');
const router = express.Router();
const { getMarketNews } = require('../services/finnhub');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 300 }); // 5-minute cache for news

// ─── GET /api/news ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const category = req.query.category || 'general';
    const limit = parseInt(req.query.limit) || 20;
    const cacheKey = `news_${category}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const news = await getMarketNews(category);

    // Filter and enrich
    const filtered = (Array.isArray(news) ? news : [])
      .filter(n => n.headline && n.url)
      .slice(0, limit)
      .map(n => ({
        id: n.id,
        headline: n.headline,
        summary: n.summary,
        source: n.source,
        url: n.url,
        image: n.image || null,
        datetime: n.datetime,
        category: n.category,
        related: n.related,
        sentiment: estimateSentiment(n.headline + ' ' + (n.summary || '')),
      }));

    cache.set(cacheKey, filtered);
    res.json(filtered);
  } catch (err) {
    console.error('News error:', err.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// ─── GET /api/news/categories ────────────────────────────────────────────────
router.get('/categories', (req, res) => {
  res.json(['general', 'forex', 'crypto', 'merger']);
});

const { estimateSentiment } = require('../services/newssentiment');

module.exports = router;
