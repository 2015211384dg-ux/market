'use strict';
/**
 * 네이버 금융 모바일 API — 종목별 연간 재무 데이터
 * URL: https://m.stock.naver.com/api/stock/{code}/finance/annual
 *
 * 실제 응답 구조:
 * {
 *   financeInfo: {
 *     trTitleList: [{ key: "202312", title: "2023.12.", isConsensus: "N" }, ...],
 *     rowList: [
 *       { title: "EPS",   columns: { "202312": { value: "23,881" }, ... } },
 *       { title: "ROE",   columns: { ... } },
 *       { title: "부채비율", columns: { ... } },
 *       ...
 *     ]
 *   }
 * }
 */
const axios    = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 86400 }); // 24h

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept':          'application/json, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer':         'https://m.stock.naver.com/',
};

/** 숫자 문자열 파싱: "23,881" → 23881, "-" → null */
function parseVal(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, '').trim();
  if (s === '-' || s === '' || s === 'N/A') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * 공통 파서: annual / quarter 모두 동일 구조
 * @param {'annual'|'quarter'} type
 */
async function _fetchNaverFinance(code, type) {
  const cKey = type === 'annual' ? `naver_annual_v2_${code}` : `naver_quarter_v1_${code}`;
  const hit  = cache.get(cKey);
  if (hit !== undefined) return hit;

  try {
    const url = `https://m.stock.naver.com/api/stock/${code}/finance/${type}`;
    const res  = await axios.get(url, { headers: HEADERS, timeout: 12000 });
    const info = res.data?.financeInfo;
    if (!info) { cache.set(cKey, null); return null; }

    const titles = info.trTitleList ?? [];
    const rows   = info.rowList     ?? [];
    if (!titles.length || !rows.length) { cache.set(cKey, null); return null; }

    const periods     = titles.map(t => t.key).sort();
    const isConsensus = periods.map(p => (titles.find(x => x.key === p)?.isConsensus === 'Y'));

    const extract = (rowTitle) => {
      const row = rows.find(r => r.title === rowTitle);
      if (!row) return periods.map(() => null);
      return periods.map(p => parseVal(row.columns?.[p]?.value));
    };

    const result = {
      periods, isConsensus,
      eps:       extract('EPS'),
      roe:       extract('ROE'),
      debtRatio: extract('부채비율'),
      per:       extract('PER'),
      pbr:       extract('PBR'),
    };

    const validEps = result.eps.filter(v => v != null);
    if (validEps.length < 2) { cache.set(cKey, null); return null; }

    cache.set(cKey, result);
    return result;
  } catch (e) {
    console.warn(`[Naver${type === 'annual' ? 'Annual' : 'Quarter'}] ${code}: ${e.message?.slice(0, 70)}`);
    cache.set(cKey, null);
    return null;
  }
}

/** 연간 재무 데이터 (YYYYMM 연도말 기준) */
async function getNaverAnnualFinance(code)  { return _fetchNaverFinance(code, 'annual');  }

/** 분기 재무 데이터 (YYYYMM 분기말 기준, 동기 대비 YoY 계산용) */
async function getNaverQuarterFinance(code) { return _fetchNaverFinance(code, 'quarter'); }

module.exports = { getNaverAnnualFinance, getNaverQuarterFinance };
