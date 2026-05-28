const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/**
 * 종목 시총·섹터 조회 (차트 모달용)
 * marketCapEok: 억원, sector: 섹터명
 */
async function getStockInfo(symbol) {
  try {
    const q = await yf.quote(symbol);
    return {
      marketCapEok: q.marketCap ? Math.round(q.marketCap / 1e8) : null,
      sector:       q.sector || null,
    };
  } catch {
    return { marketCapEok: null, sector: null };
  }
}

/**
 * 단일 종목 현재가 조회
 */
async function getQuote(symbol) {
  try {
    const q = await yf.quote(symbol);
    return {
      symbol,
      c:  q.regularMarketPrice          ?? 0,
      pc: q.regularMarketPreviousClose   ?? 0,
      d:  q.regularMarketChange          ?? 0,
      dp: q.regularMarketChangePercent   ?? 0,
      name: q.shortName || q.longName || symbol,
    };
  } catch (e) {
    console.warn(`[yahoo] quote failed for ${symbol}:`, e.message);
    return null;
  }
}

/**
 * 복수 종목 현재가 (null 제거)
 */
async function getQuotes(symbols) {
  const results = await Promise.allSettled(symbols.map(s => getQuote(s)));
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

/**
 * 일봉 히스토리 (최근 N일)
 * returns: [{ date, open, high, low, close, volume }, ...]
 */
async function getHistorical(symbol, days = 70) {
  try {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    const rows = await yf.historical(symbol, {
      period1: from,
      period2: to,
      interval: '1d',
    });
    return rows.map(r => {
      // adjClose / close 비율로 open도 동일하게 수정
      // (미조정 open vs 수정 close 혼용 시 배당·분할 이전 봉이 전부 음봉으로 표시되는 문제 방지)
      const adjFactor = (r.adjClose && r.close) ? r.adjClose / r.close : 1;
      return {
        date:   r.date,
        open:   +(r.open * adjFactor).toFixed(2),
        high:   r.adjHigh != null ? +r.adjHigh.toFixed(2) : +(r.high * adjFactor).toFixed(2),
        low:    r.adjLow  != null ? +r.adjLow.toFixed(2)  : +(r.low  * adjFactor).toFixed(2),
        close:  +(r.adjClose ?? r.close).toFixed(2),
        volume: r.volume ?? 0,
      };
    });
  } catch (e) {
    console.warn(`[yahoo] historical failed for ${symbol}:`, e.message);
    return [];
  }
}

/**
 * 한국 시장 뉴스 — 구글 뉴스 RSS (한국어, 네이버·다음·연합 등 국내 언론 포함)
 */
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const _xmlParser = new XMLParser({ ignoreAttributes: false, ignoreDeclaration: true });

const KR_NEWS_QUERIES = [
  '코스피 코스닥 증시',
  '삼성전자 SK하이닉스 주가',
  '한국 주식 시장 금리',
  '현대차 LG 카카오 네이버 주가',
];

async function getKoreanNews(limit = 20) {
  try {
    const settled = await Promise.allSettled(
      KR_NEWS_QUERIES.map(q =>
        axios.get(
          `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }
        )
      )
    );

    const seen = new Set();
    const news = [];

    for (const r of settled) {
      if (r.status !== 'fulfilled') continue;
      let items = [];
      try {
        const parsed = _xmlParser.parse(r.value.data);
        items = parsed?.rss?.channel?.item || [];
        if (!Array.isArray(items)) items = [items];
      } catch { continue; }

      for (const item of items) {
        const url = item.link || item.guid?.['#text'] || item.guid;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        news.push({
          id:       url,
          headline: item.title || '',
          summary:  item.description || null,
          source:   item.source?.['#text'] || item.source || '',
          url,
          image:    null,
          datetime: item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : null,
          category: 'korea',
          related:  '',
        });
      }
    }

    // 최신순 정렬
    news.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
    return news.slice(0, limit);
  } catch (e) {
    console.warn('[kr-news] getKoreanNews failed:', e.message);
    return [];
  }
}

/**
 * 한국 시장 영문 뉴스 — Yahoo Finance search (영어)
 */
const KR_NEWS_EN_QUERIES = ['Korea stock', 'KOSPI KOSDAQ', 'Samsung Electronics', 'SK Hynix LG Korea', 'Hyundai Kia Korea'];

async function getKoreanNewsEn(limit = 20) {
  try {
    const settled = await Promise.allSettled(
      KR_NEWS_EN_QUERIES.map(q => yf.search(q, { newsCount: 8, quotesCount: 0 }))
    );
    const seen = new Set();
    const news = [];
    for (const r of settled) {
      if (r.status !== 'fulfilled') continue;
      for (const item of (r.value.news || [])) {
        if (!item.uuid || seen.has(item.uuid)) continue;
        seen.add(item.uuid);
        news.push({
          id:       item.uuid,
          headline: item.title,
          summary:  null,
          source:   item.publisher,
          url:      item.link,
          image:    item.thumbnail?.resolutions?.[1]?.url || item.thumbnail?.resolutions?.[0]?.url || null,
          datetime: item.providerPublishTime ? Math.floor(new Date(item.providerPublishTime).getTime() / 1000) : null,
          category: 'korea-en',
          related:  (item.relatedTickers || []).join(','),
        });
      }
    }
    news.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
    return news.slice(0, limit);
  } catch (e) {
    console.warn('[kr-news-en] failed:', e.message);
    return [];
  }
}

/**
 * 주요 한국 종목 실적 발표 일정 (Yahoo Finance calendarEvents)
 */
const KR_EARNINGS_UNIVERSE = [
  { symbol: '005930.KS', name: '삼성전자' },
  { symbol: '000660.KS', name: 'SK하이닉스' },
  { symbol: '035420.KS', name: 'NAVER' },
  { symbol: '005380.KS', name: '현대차' },
  { symbol: '000270.KS', name: '기아' },
  { symbol: '068270.KS', name: '셀트리온' },
  { symbol: '207940.KS', name: '삼성바이오로직스' },
  { symbol: '051910.KS', name: 'LG화학' },
  { symbol: '035720.KS', name: '카카오' },
  { symbol: '006400.KS', name: '삼성SDI' },
  { symbol: '003550.KS', name: 'LG' },
  { symbol: '066570.KS', name: 'LG전자' },
];

async function getKoreanEarningsCalendar() {
  const now = Date.now();
  const in60days = now + 60 * 86400 * 1000;

  const settled = await Promise.allSettled(
    KR_EARNINGS_UNIVERSE.map(({ symbol, name }) =>
      yf.quoteSummary(symbol, { modules: ['calendarEvents'] })
        .then(r => ({ symbol, name, cal: r.calendarEvents }))
        .catch(() => null)
    )
  );

  const results = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    const { symbol, name, cal } = r.value;
    const dates = cal?.earnings?.earningsDate || [];
    for (const d of dates) {
      const ts = new Date(d).getTime();
      if (ts >= now && ts <= in60days) {
        results.push({
          symbol,
          name,
          date: new Date(d).toISOString().split('T')[0],
          epsEstimate: cal?.earnings?.earningsAverage ?? null,
          revenueEstimate: cal?.earnings?.revenueAverage ?? null,
          isEstimate: cal?.earnings?.isEarningsDateEstimate ?? true,
        });
        break; // 가장 가까운 날짜 하나만
      }
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = { getQuote, getQuotes, getHistorical, getStockInfo, getKoreanNews, getKoreanNewsEn, getKoreanEarningsCalendar };
