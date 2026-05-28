require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const rateLimit = require('express-rate-limit');
const cron     = require('node-cron');

const marketRouter = require('./routes/market');
const newsRouter = require('./routes/news');
const screenerRouter = require('./routes/screener');
const insightsRouter = require('./routes/insights');
const macroDataRouter = require('./routes/macro-data');
const krMarketRouter = require('./routes/kr-market');
const mvpRouter = require('./routes/mvp');
const stockDetailRouter = require('./routes/stock-detail');
const kisScreenerRouter  = require('./routes/kis-screener');
const pegScreenerRouter  = require('./routes/peg-screener');
const valuationRouter    = require('./routes/valuation');
const stockScoreRouter   = require('./routes/stock-score');
const { initDart } = require('./services/dart');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:8080', 'http://localhost:3000'] }));
app.use(express.json());

// Rate limit: 1000 requests per 15 minutes per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later.' },
}));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/market', marketRouter);
app.use('/api/news', newsRouter);
app.use('/api/screener', screenerRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/macro-data', macroDataRouter);
app.use('/api/kr-market', krMarketRouter);
app.use('/api/mvp', mvpRouter);
app.use('/api/stock-detail', stockDetailRouter);
app.use('/api/kis-screener', kisScreenerRouter);
app.use('/api/peg-screener', pegScreenerRouter);
app.use('/api/valuation', valuationRouter);
app.use('/api/stock-score', stockScoreRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    finnhubKey: !!process.env.FINNHUB_API_KEY,
    anthropicKey: !!process.env.ANTHROPIC_API_KEY,
  });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Market Overview API running on http://localhost:${PORT}`);
  if (!process.env.FINNHUB_API_KEY)   console.warn('WARNING: FINNHUB_API_KEY not set');
  if (!process.env.ANTHROPIC_API_KEY) console.warn('WARNING: ANTHROPIC_API_KEY not set');
  if (!process.env.DART_API_KEY)      console.warn('WARNING: DART_API_KEY not set — PBR 비활성화');
  // DART corp_code 매핑 테이블 백그라운드 초기화
  initDart().catch(e => console.error('[DART] 초기화 오류:', e.message));
});

// ─── 매 영업일 00:30 한국 시장 전체 종목 스크리너 ────────────────────────────
cron.schedule('30 0 * * 1-5', async () => {
  console.log('[CRON] kr-market 전체 종목 스크리너 시작 (00:30)');
  try {
    const { runFullScreener } = require('./routes/kr-market');
    await runFullScreener();
    console.log('[CRON] kr-market 전체 종목 스크리너 완료');
  } catch (e) {
    console.error('[CRON] kr-market 스크리너 오류:', e.message);
  }
}, { timezone: 'Asia/Seoul' });

// ─── 매 영업일 01:00 KIS 기법 스크리너 자동 실행 (코스피+코스닥 전종목) ──────
cron.schedule('0 1 * * 1-5', async () => {
  console.log('[CRON] KIS 기법 스크리너 시작 (01:00)');
  try {
    await kisScreenerRouter.runFullScreener();
    console.log('[CRON] KIS 기법 스크리너 완료');
  } catch (e) {
    console.error('[CRON] KIS 스크리너 오류:', e.message);
  }
}, { timezone: 'Asia/Seoul' });
