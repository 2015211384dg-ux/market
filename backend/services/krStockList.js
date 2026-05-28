/**
 * 네이버 금융 시가총액 순위에서 한국 종목 리스트를 동적으로 가져옴
 * ETF / 레버리지 / 인버스 제외, 일반 주식만 최대 500개
 * 24시간 캐시
 */
const axios  = require('axios');
const iconv  = require('iconv-lite');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 86400 }); // 24시간

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer':         'https://finance.naver.com/sise/',
};

// ETF / ETN / 인버스 / 레버리지 종목 제외 키워드
const ETF_RE = /KODEX|TIGER|KINDEX|KOSEF|ARIRANG|HANARO|ACE |SOL |PLUS|KIM |TIMEFOLIO|WOORI|FOCUS|SMART|KB Star|KBSTAR|레버리지|인버스|선물|ETF|ETN|인덱스|국고채|단기채|채권|TR$| TR |합성|스팩|SPAC/i;

async function fetchNaverPage(sosok, page) {
  const url = `https://finance.naver.com/sise/sise_market_sum.nhn?sosok=${sosok}&page=${page}`;
  const r = await axios.get(url, {
    headers: HEADERS,
    responseType: 'arraybuffer',
    timeout: 10000,
  });
  const html = iconv.decode(Buffer.from(r.data), 'euc-kr');
  return [...html.matchAll(/code=(\d{6})"[^>]*class="tltle">([^<]+)<\/a>/g)]
    .map(m => ({ code: m[1], name: m[2].trim() }));
}

/**
 * KOSPI + KOSDAQ 일반 주식 최대 total개 반환
 * Yahoo Finance 형식: 005930.KS / 247540.KQ
 */
async function getKRStockUniverse({ total = 500 } = {}) {
  const cacheKey = `kr_universe_${total}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // ETF 비율 ~25% 가정 → 여유 있게 더 많이 fetch
  // KOSPI 60%, KOSDAQ 40% 비율로 배분
  const kospiTarget  = Math.ceil(total * 0.60);
  const kosdaqTarget = total - kospiTarget;

  // 넉넉하게 페이지 수 설정 (ETF 제외 후 부족할 수 있으므로 1.6배)
  const kospiPages  = Math.ceil((kospiTarget  * 1.6) / 50);
  const kosdaqPages = Math.ceil((kosdaqTarget * 1.6) / 50);

  // 병렬 fetch
  const fetchAll = async (sosok, pages) => {
    const results = await Promise.allSettled(
      Array.from({ length: pages }, (_, i) => fetchNaverPage(sosok, i + 1))
    );
    return results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);
  };

  const [kospiRaw, kosdaqRaw] = await Promise.all([
    fetchAll(0, kospiPages),
    fetchAll(1, kosdaqPages),
  ]);

  // ETF 제외 + 중복 코드 제거
  const dedup = (arr) => {
    const seen = new Set();
    return arr.filter(s => {
      if (seen.has(s.code) || ETF_RE.test(s.name)) return false;
      seen.add(s.code);
      return true;
    });
  };

  const kospi  = dedup(kospiRaw).slice(0, kospiTarget).map(s => `${s.code}.KS`);
  const kosdaq = dedup(kosdaqRaw).slice(0, kosdaqTarget).map(s => `${s.code}.KQ`);

  const universe = [...kospi, ...kosdaq];

  console.log(`[krStockList] KOSPI ${kospi.length} + KOSDAQ ${kosdaq.length} = ${universe.length}개`);

  if (universe.length > 100) {
    cache.set(cacheKey, universe);
  }

  return universe;
}

/**
 * 검색용 전체 종목 리스트 (이름 포함)
 */
async function getKRStockListFull() {
  const cacheKey = 'kr_stock_list_full';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  console.log('[krStockList] 전체 종목 리스트 로드 시작 (네이버)...');
  
  // 코스피/코스닥 각 20페이지(1000개씩) 조회
  const fetchAll = async (sosok) => {
    const pages = 20;
    const results = await Promise.allSettled(
      Array.from({ length: pages }, (_, i) => fetchNaverPage(sosok, i + 1))
    );
    return results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);
  };

  const [kospiRaw, kosdaqRaw] = await Promise.all([
    fetchAll(0),
    fetchAll(1),
  ]);

  const seen = new Set();
  const list = [...kospiRaw, ...kosdaqRaw]
    .filter(s => {
      if (seen.has(s.code) || ETF_RE.test(s.name)) return false;
      seen.add(s.code);
      return true;
    });

  console.log(`[krStockList] 전체 종목 로드 완료: ${list.length}개`);
  cache.set(cacheKey, list);
  return list;
}

module.exports = { getKRStockUniverse, getKRStockListFull };
