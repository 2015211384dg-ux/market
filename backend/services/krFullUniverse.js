/**
 * 네이버 금융에서 KOSPI + KOSDAQ 전 종목을 가져와
 * ETF/ETN/관리종목/환기종목/거래정지 제외한 순수 일반주 리스트 반환
 * 24시간 캐시
 */
const axios    = require('axios');
const iconv    = require('iconv-lite');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 86400 }); // 24시간

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer':         'https://finance.naver.com/sise/',
};

// ETF / ETN / 레버리지 / 인버스 제외 키워드
const ETF_RE = /KODEX|TIGER|KINDEX|KOSEF|ARIRANG|HANARO|ACE |SOL |PLUS|KIM |TIMEFOLIO|WOORI|FOCUS|KBSTAR|KB ?Star|레버리지|인버스|선물|ETF|ETN|인덱스|국고채|단기채|TR\b|합성/i;

// 관리종목 / 환기종목 마커 (네이버 금융 표기)
const WARN_RE = /^\*|관리|환기|정지/;

async function fetchNaverPage(sosok, page) {
  const url = `https://finance.naver.com/sise/sise_market_sum.nhn?sosok=${sosok}&page=${page}`;
  try {
    const r = await axios.get(url, {
      headers: HEADERS,
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    const html = iconv.decode(Buffer.from(r.data), 'euc-kr');

    // 코드 + 이름 추출
    const stocks = [...html.matchAll(/code=(\d{6})"[^>]*class="tltle">([^<]+)<\/a>/g)]
      .map(m => ({ code: m[1], name: m[2].trim() }));

    // 거래정지 종목은 거래량 0으로 표시됨: naver에서 td에 '-' 또는 0
    // 관리/환기: 이름 앞에 * 또는 특수 마크 확인
    // 페이지에서 추가 마커 확인
    const managedCodes = new Set(
      [...html.matchAll(/class="mkhandi[^"]*"[^>]*>.*?code=(\d{6})/gs)].map(m => m[1])
    );

    return stocks.map(s => ({
      ...s,
      isWarning: WARN_RE.test(s.name) || managedCodes.has(s.code),
    }));
  } catch {
    return [];
  }
}

// 네이버 금융 총 페이지 수 확인
async function getLastPage(sosok) {
  const url = `https://finance.naver.com/sise/sise_market_sum.nhn?sosok=${sosok}&page=1`;
  try {
    const r = await axios.get(url, { headers: HEADERS, responseType: 'arraybuffer', timeout: 8000 });
    const html = iconv.decode(Buffer.from(r.data), 'euc-kr');
    const m = html.match(/page=(\d+)"[^>]*>맨뒤/);
    return m ? parseInt(m[1]) : 40;
  } catch {
    return 40;
  }
}

/**
 * KOSPI + KOSDAQ 전종목 (ETF/관리/환기/거래정지 제외) 반환
 * [{ code, name, suffix }] → Yahoo 형식: 005930.KS
 */
async function getKRFullUniverse() {
  const cacheKey = 'kr_full_universe';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 총 페이지 수 확인 (병렬)
  const [kospiPages, kosdaqPages] = await Promise.all([
    getLastPage(0),
    getLastPage(1),
  ]);

  console.log(`[krFullUniverse] KOSPI ${kospiPages}p / KOSDAQ ${kosdaqPages}p`);

  // 모든 페이지 병렬 fetch (과도한 동시 요청 방지: 10개씩 배치)
  const fetchBatched = async (sosok, totalPages, suffix) => {
    const all = [];
    const BATCH = 10;
    for (let i = 0; i < totalPages; i += BATCH) {
      const pages = Array.from({ length: Math.min(BATCH, totalPages - i) }, (_, j) => i + j + 1);
      const results = await Promise.allSettled(pages.map(p => fetchNaverPage(sosok, p)));
      results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value); });
    }
    return all.map(s => ({ ...s, suffix }));
  };

  const [kospiAll, kosdaqAll] = await Promise.all([
    fetchBatched(0, kospiPages, '.KS'),
    fetchBatched(1, kosdaqPages, '.KQ'),
  ]);

  // 중복 제거 + ETF/관리/환기 필터
  const seen = new Set();
  const universe = [...kospiAll, ...kosdaqAll]
    .filter(s => {
      if (seen.has(s.code)) return false;
      if (ETF_RE.test(s.name)) return false;
      if (s.isWarning) return false;
      seen.add(s.code);
      return true;
    })
    .map(s => ({
      symbol: `${s.code}${s.suffix}`,
      name: s.name,
    }));

  console.log(`[krFullUniverse] 최종 종목 수: ${universe.length}`);

  if (universe.length > 200) {
    cache.set(cacheKey, universe);
  }

  return universe;
}

module.exports = { getKRFullUniverse };
