'use strict';
/**
 * 네이버 증권 모바일 API — 종목 통합 정보
 * URL: https://m.stock.naver.com/api/stock/{code}/integration
 *
 * 제공 데이터:
 *   - totalInfos[]: PER, PBR, EPS, BPS, 배당수익률, 외인소진율, 시총, 52주 고/저, 추정PER/EPS
 *   - dealTrendInfos[]: 일자별 외인/기관/개인 순매수 수량 + 외국인 보유율
 */
const axios     = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 600 }); // 10분 캐시

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept':     'application/json, */*',
  'Referer':    'https://m.stock.naver.com/',
};

/** "+1,891,734" 또는 "23,881" 형태 → 정수 */
function parseSignedInt(v) {
  if (v == null) return null;
  const s = String(v).replace(/[,+\s]/g, '').trim();
  if (s === '' || s === '-') return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/** "0.54%" → 0.54 / "25.10배" → 25.10 / "1,668원" → 1668 */
function parseNum(v) {
  if (v == null) return null;
  const s = String(v).replace(/[,%배원\s]/g, '').trim();
  if (s === '' || s === '-') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** "1,815조 2,695억" → 181526950000000 (원 단위) */
function parseMarketCap(v) {
  if (v == null) return null;
  const s = String(v).replace(/,/g, '');
  const jo = s.match(/(\d+)\s*조/)?.[1];
  const eok = s.match(/(\d+)\s*억/)?.[1];
  let total = 0;
  if (jo)  total += parseInt(jo,  10) * 1e12;
  if (eok) total += parseInt(eok, 10) * 1e8;
  return total > 0 ? total : null;
}

/**
 * 종목 통합 정보 조회
 * @param {string} code - 6자리 종목코드
 * @returns {Promise<object|null>}
 */
async function getIntegration(code) {
  const cKey = `naver_intg_${code}`;
  const hit = cache.get(cKey);
  if (hit !== undefined) return hit;

  try {
    const url = `https://m.stock.naver.com/api/stock/${code}/integration`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    const d   = res.data;
    if (!d || !d.totalInfos) { cache.set(cKey, null); return null; }

    // totalInfos를 code → value 맵으로
    const m = {};
    for (const t of d.totalInfos) m[t.code] = t.value;

    const result = {
      stockName:    d.stockName,
      per:          parseNum(m.per),
      pbr:          parseNum(m.pbr),
      eps:          parseNum(m.eps),
      bps:          parseNum(m.bps),
      cnsPer:       parseNum(m.cnsPer),      // 추정 PER (애널리스트 컨센서스)
      cnsEps:       parseNum(m.cnsEps),      // 추정 EPS
      dividendYield: parseNum(m.dividendYieldRatio),  // 배당수익률 %
      dividend:     parseNum(m.dividend),    // 주당 배당금
      foreignRate:  parseNum(m.foreignRate), // 외인소진율 %
      marketCap:    parseMarketCap(m.marketValue),
      high52w:      parseNum(m.highPriceOf52Weeks),
      low52w:       parseNum(m.lowPriceOf52Weeks),

      // 일자별 외인/기관/개인 순매수 (최근일 → 과거 순)
      dealTrend: (d.dealTrendInfos || []).map(t => ({
        date:       t.bizdate,                                  // YYYYMMDD
        foreigner:  parseSignedInt(t.foreignerPureBuyQuant),    // 외인 순매수
        organ:      parseSignedInt(t.organPureBuyQuant),        // 기관 순매수
        individual: parseSignedInt(t.individualPureBuyQuant),   // 개인 순매수
        foreignRate: parseNum(t.foreignerHoldRatio),            // 외인 보유율 %
        close:       parseSignedInt(t.closePrice),
        volume:      parseSignedInt(t.accumulatedTradingVolume),
      })),
    };

    cache.set(cKey, result);
    return result;
  } catch (e) {
    console.warn(`[NaverIntg] ${code}: ${e.message?.slice(0, 80)}`);
    cache.set(cKey, null);
    return null;
  }
}

module.exports = { getIntegration };
