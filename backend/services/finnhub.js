const axios = require('axios');

const BASE_URL = 'https://finnhub.io/api/v1';
const TOKEN = process.env.FINNHUB_API_KEY;

const api = axios.create({
  baseURL: BASE_URL,
  params: { token: TOKEN },
  timeout: 10000,
});

// ─── Rate-limited request queue ─────────────────────────────────────────────
// Finnhub free tier: 60 req/min → 1 req/sec safe threshold
const queue = [];
let lastCall = 0;
const MIN_INTERVAL_MS = 300; // ~3 req/sec → 분당 최대 ~180 호출이지만 실제론 그보다 적음

async function rateLimitedGet(url, params = {}) {
  const now = Date.now();
  const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - now);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const response = await api.get(url, { params });
  return response.data;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Market Quotes ───────────────────────────────────────────────────────────
async function getQuote(symbol) {
  return rateLimitedGet('/quote', { symbol });
}

async function getQuotes(symbols) {
  const results = await Promise.allSettled(
    symbols.map(symbol => getQuote(symbol).then(q => ({ symbol, ...q })))
  );
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

// ─── Historical Candles ──────────────────────────────────────────────────────
async function getCandles(symbol, fromUnix, toUnix, resolution = 'D') {
  return rateLimitedGet('/stock/candle', {
    symbol,
    resolution,
    from: fromUnix,
    to: toUnix,
  });
}

// ─── News ────────────────────────────────────────────────────────────────────
async function getMarketNews(category = 'general', minId = 0) {
  return rateLimitedGet('/news', { category, minId });
}

async function getCompanyNews(symbol, from, to) {
  return rateLimitedGet('/company-news', { symbol, from, to });
}

// ─── Economic Calendar ───────────────────────────────────────────────────────
async function getEconomicCalendar(from, to) {
  return rateLimitedGet('/calendar/economic', { from, to });
}

// ─── Earnings Calendar ───────────────────────────────────────────────────────
async function getEarningsCalendar(from, to) {
  return rateLimitedGet('/calendar/earnings', { from, to });
}

// ─── Company Profile ─────────────────────────────────────────────────────────
async function getCompanyProfile(symbol) {
  return rateLimitedGet('/stock/profile2', { symbol });
}

// ─── Market Status ───────────────────────────────────────────────────────────
async function getMarketStatus(exchange = 'US') {
  return rateLimitedGet('/stock/market-status', { exchange });
}

module.exports = {
  getQuote,
  getQuotes,
  getCandles,
  getMarketNews,
  getCompanyNews,
  getEconomicCalendar,
  getEarningsCalendar,
  getCompanyProfile,
  getMarketStatus,
  sleep,
};
