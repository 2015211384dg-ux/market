'use strict';
/**
 * 네이버 금융 업종별 전종목 조회
 * market 정보는 KIS 지표 캐시 또는 KRX 데이터로 보완
 * 24시간 캐시
 */
const axios    = require('axios');
const iconv    = require('iconv-lite');
const fs       = require('fs');
const path     = require('path');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 86400 });

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer':         'https://finance.naver.com/sise/',
};

const ETF_RE = /KODEX|TIGER|KINDEX|KOSEF|ARIRANG|HANARO|ACE |SOL |PLUS|KBSTAR|레버리지|인버스|선물|ETF|ETN|TR\b|합성/i;

// KIS 지표 캐시에서 code → market 매핑 로드
let _marketMap = null;
function getMarketMap() {
  if (_marketMap) return _marketMap;
  _marketMap = {};
  try {
    const p = path.join(__dirname, '../data/kis-indicator-cache.json');
    if (fs.existsSync(p)) {
      const d = JSON.parse(fs.readFileSync(p, 'utf8'));
      const list = d.data || d;
      list.forEach(s => { if (s.code && s.market) _marketMap[s.code] = s.market; });
    }
  } catch {}
  return _marketMap;
}

/**
 * 네이버 업종 번호로 전종목 반환
 * @returns {{ code: string, name: string, market: 'KOSPI'|'KOSDAQ', yahooSymbol: string }[]}
 */
async function getSectorStocks(no) {
  const key = `naver_sector_${no}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url = `https://finance.naver.com/sise/sise_group_detail.nhn?type=upjong&no=${no}`;
  const r = await axios.get(url, { headers: HEADERS, responseType: 'arraybuffer', timeout: 12000 });
  const html = iconv.decode(Buffer.from(r.data), 'euc-kr');

  const raw = [...html.matchAll(/code=(\d{6})[^>]*>([^<]+)<\/a/g)]
    .map(m => ({ code: m[1], name: m[2].trim() }))
    .filter(s => s.name && !ETF_RE.test(s.name));

  // 중복 제거
  const seen = new Set();
  const unique = raw.filter(s => { if (seen.has(s.code)) return false; seen.add(s.code); return true; });

  // market 보완: KIS 캐시 참조 → 없으면 KOSPI 로 기본값
  const mmap = getMarketMap();
  const result = unique.map(s => {
    const market = mmap[s.code] || 'KOSPI';
    const yahooSymbol = s.code + (market === 'KOSPI' ? '.KS' : '.KQ');
    return { code: s.code, name: s.name, market, yahooSymbol };
  });

  cache.set(key, result);
  return result;
}

module.exports = { getSectorStocks };
