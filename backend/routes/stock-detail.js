const express = require('express');
const router = express.Router();
const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { getCompanyProfile } = require('../services/finnhub');
const { getHistorical } = require('../services/yahoo');
const NodeCache = require('node-cache');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const cache = new NodeCache({ stdTTL: 3600 }); // 1시간 캐시 (차트 데이터용)

// ─── 인사이트 영구 디스크 캐시 ────────────────────────────────────────────────
const INSIGHT_CACHE_PATH = path.join(__dirname, '../data/insight-cache.json');

function loadInsightCache() {
  try {
    return JSON.parse(fs.readFileSync(INSIGHT_CACHE_PATH, 'utf8'));
  } catch { return {}; }
}

function saveInsightCache(cache) {
  fs.writeFileSync(INSIGHT_CACHE_PATH, JSON.stringify(cache, null, 2));
}

const insightCache = loadInsightCache();
console.log(`[stock-detail] 인사이트 캐시 로드: ${Object.keys(insightCache).length}개 종목`);

async function generateKoreanInsight(symbol, name, rawDesc, industry, sector, employees, marketCap, currency) {
  // 디스크 캐시 확인 — 있으면 API 호출 없이 바로 반환
  if (insightCache[symbol]) return insightCache[symbol];
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // 의미있는 정보가 없으면 호출하지 않음
  if (!rawDesc && (!name || name === symbol) && !industry && !sector) return null;
  try {
    const isKRW = currency === 'KRW';
    const capStr = marketCap
      ? (isKRW
          ? (marketCap >= 1e12 ? `${(marketCap/1e12).toFixed(1)}조원` : `${(marketCap/1e8).toFixed(0)}억원`)
          : (marketCap >= 1e12 ? `$${(marketCap/1e12).toFixed(1)}T` : `$${(marketCap/1e9).toFixed(0)}B`))
      : null;
    const context = [
      `종목명: ${name !== symbol ? name : '?'} (${symbol})`,
      sector   ? `섹터: ${sector}` : null,
      industry ? `산업: ${industry}` : null,
      capStr   ? `시가총액: ${capStr}` : null,
      employees ? `임직원: ${employees.toLocaleString()}명` : null,
      rawDesc  ? `\n[영문 사업 설명]\n${rawDesc.slice(0, 1200)}` : null,
    ].filter(Boolean).join('\n');

    const msg = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{
        role: 'user',
        content: `다음 기업 정보를 바탕으로 한국어로 3~4문장의 투자자 관점 기업 요약을 작성해줘.
핵심 사업 모델, 주요 수익원, 경쟁 우위나 리스크 중 투자자에게 실질적으로 중요한 내용 위주로.
뻔한 "글로벌 리더입니다" 류의 표현은 피하고 구체적으로 써줘.

${context}

요약만 출력하고 제목이나 불릿 없이 바로 본문으로 시작해.`,
      }],
    });
    const insight = msg.content[0]?.text?.trim() || null;
    if (insight) {
      insightCache[symbol] = insight;
      saveInsightCache(insightCache);
    }
    return insight;
  } catch (e) {
    console.warn(`[stock-detail] Claude insight 실패 (${symbol}):`, e.message);
    return null;
  }
}

// GET /api/stock-detail/:symbol
router.get('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const cached = cache.get(symbol);
  if (cached) return res.json(cached);

  try {
    // 병렬로 데이터 수집
    const [profileRaw, candles, summaryRaw] = await Promise.allSettled([
      getCompanyProfile(symbol),
      getHistorical(symbol, 90),
      yf.quoteSummary(symbol, { modules: ['assetProfile', 'summaryDetail', 'quoteType'] }),
    ]);

    const profile = profileRaw.status === 'fulfilled' ? profileRaw.value : {};
    const history = candles.status === 'fulfilled' ? candles.value : [];
    const summary = summaryRaw.status === 'fulfilled' ? summaryRaw.value : {};

    const assetProfile = summary?.assetProfile || {};
    const summaryDetail = summary?.summaryDetail || {};
    const quoteType    = summary?.quoteType || {};

    const isKorean  = symbol.includes('.KS') || symbol.includes('.KQ');
    const currency  = isKorean ? 'KRW' : 'USD';
    const name      = profile.name
      || quoteType.longName
      || quoteType.shortName
      || assetProfile.longName
      || symbol;
    const industry  = profile.finnhubIndustry || assetProfile.industry || null;
    const sector    = assetProfile.sector || null;
    const employees = assetProfile.fullTimeEmployees || null;
    const marketCap = profile.marketCapitalization
      ? (isKorean ? profile.marketCapitalization * 1e6 : profile.marketCapitalization * 1e6)
      : (summaryDetail.marketCap ?? null);
    const rawDesc   = assetProfile.longBusinessSummary || null;

    const insight = await generateKoreanInsight(symbol, name, rawDesc, industry, sector, employees, marketCap, currency);

    const result = {
      symbol,
      name,
      logo: profile.logo || null,
      exchange: profile.exchange || null,
      industry,
      sector,
      country: profile.country || assetProfile.country || null,
      marketCap,
      website: profile.weburl || assetProfile.website || null,
      description: insight || rawDesc,
      currency,
      employees,
      dividendYield: summaryDetail.dividendYield ?? null,
      // 차트용 일봉 (date, close, volume)
      candles: history.map(c => ({
        date: c.date instanceof Date
          ? c.date.toISOString().slice(0, 10)
          : String(c.date).slice(0, 10),
        close: c.close,
        volume: c.volume,
      })),
    };

    cache.set(symbol, result);
    res.json(result);
  } catch (err) {
    console.error(`[stock-detail] ${symbol}:`, err.message);
    res.status(500).json({ error: '종목 상세 정보를 불러오지 못했습니다.' });
  }
});

module.exports = router;
