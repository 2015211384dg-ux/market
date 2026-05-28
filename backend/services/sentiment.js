/**
 * 시장심리 지표 서비스
 * - CNN Fear & Greed Index
 * - Put/Call Ratio (SPY 옵션 기반, Yahoo Finance)
 */
const axios = require('axios');
const NodeCache = require('node-cache');
const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const cache = new NodeCache({ stdTTL: 900 }); // 15분

// ─── CNN Fear & Greed ─────────────────────────────────────────────────────────
async function getFearAndGreed() {
  const cached = cache.get('fear_greed');
  if (cached) return cached;

  try {
    const res = await axios.get(
      'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://www.cnn.com',
          'Referer': 'https://www.cnn.com/markets/fear-and-greed',
        },
        timeout: 8000,
      }
    );

    const fg = res.data?.fear_and_greed;
    if (!fg) return null;

    const RATING_KO = {
      'extreme fear':  '극도의 공포',
      'fear':          '공포',
      'neutral':       '중립',
      'greed':         '탐욕',
      'extreme greed': '극도의 탐욕',
    };

    const result = {
      score:         Math.round(fg.score * 10) / 10,
      rating:        fg.rating,
      ratingKo:      RATING_KO[fg.rating?.toLowerCase()] || fg.rating,
      prevClose:     Math.round((fg.previous_close ?? fg.score) * 10) / 10,
      prev1week:     Math.round((fg.previous_1_week ?? fg.score) * 10) / 10,
      prev1month:    Math.round((fg.previous_1_month ?? fg.score) * 10) / 10,
      timestamp:     fg.timestamp,
    };

    cache.set('fear_greed', result);
    return result;
  } catch (e) {
    console.warn('[sentiment] Fear&Greed failed:', e.message);
    return null;
  }
}

// ─── Put/Call Ratio (SPY + QQQ 옵션 기반) ────────────────────────────────────
async function getPutCallRatio() {
  const cached = cache.get('put_call');
  if (cached) return cached;

  try {
    const [spyOpts, qqqOpts] = await Promise.allSettled([
      yf.options('SPY'),
      yf.options('QQQ'),
    ]);

    let totalPuts = 0, totalCalls = 0;

    for (const r of [spyOpts, qqqOpts]) {
      if (r.status !== 'fulfilled') continue;
      const chain = r.value?.options?.[0];
      if (!chain) continue;
      totalPuts  += (chain.puts  || []).reduce((s, p) => s + (p.volume || 0), 0);
      totalCalls += (chain.calls || []).reduce((s, c) => s + (c.volume || 0), 0);
    }

    if (!totalCalls) return null;

    const ratio = totalPuts / totalCalls;
    const signal = ratio > 1.2 ? '과도한 풋 매수 (공포)'
                 : ratio > 1.0 ? '방어적 포지션'
                 : ratio > 0.7 ? '중립'
                 : '콜 편향 (탐욕)';

    const result = {
      ratio:     Math.round(ratio * 1000) / 1000,
      totalPuts,
      totalCalls,
      signal,
      note: 'SPY+QQQ 당일 옵션 거래량 기준',
    };

    cache.set('put_call', result, 900);
    return result;
  } catch (e) {
    console.warn('[sentiment] PutCall failed:', e.message);
    return null;
  }
}

async function getAllSentiment() {
  const [fg, pc] = await Promise.allSettled([getFearAndGreed(), getPutCallRatio()]);
  return {
    fearGreed: fg.status === 'fulfilled' ? fg.value : null,
    putCall:   pc.status === 'fulfilled' ? pc.value : null,
  };
}

module.exports = { getFearAndGreed, getPutCallRatio, getAllSentiment };
