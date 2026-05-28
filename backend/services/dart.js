/**
 * DART(금융감독원 전자공시) API 서비스
 * - 기업 고유번호(corp_code) ↔ 종목코드 매핑
 * - 최신 분기 자본총계 조회 → PBR 계산
 * - 캐시 TTL: corpCode 7일, 재무데이터 7일
 */
require('dotenv').config();
const https      = require('https');
const NodeCache  = require('node-cache');
const unzipper   = require('unzipper');
const { XMLParser } = require('fast-xml-parser');

const API_KEY  = process.env.DART_API_KEY?.trim();
const cache    = new NodeCache({ stdTTL: 7 * 24 * 3600 }); // 7일

// ─── corp_code 매핑 테이블 (종목코드 → corp_code) ────────────────────────────
let corpCodeMap = null; // { '005930': '00126380', ... }

async function loadCorpCodes() {
  const cached = cache.get('corp_code_map');
  if (cached) { corpCodeMap = cached; return; }
  if (corpCodeMap) return;

  console.log('[DART] corp_code 매핑 테이블 다운로드 중...');
  const zipBuf = await fetchBinary(
    `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${API_KEY}`
  );

  const map = {};
  await new Promise((resolve, reject) => {
    const { Readable } = require('stream');
    Readable.from(zipBuf)
      .pipe(unzipper.Parse())
      .on('entry', entry => {
        if (!entry.path.includes('CORPCODE')) { entry.autodrain(); return; }
        const chunks = [];
        entry.on('data', d => chunks.push(d));
        entry.on('end', () => {
          const xml  = Buffer.concat(chunks).toString('utf8');
          const parser = new XMLParser({ ignoreAttributes: false });
          const parsed = parser.parse(xml);
          const list   = parsed?.result?.list || [];
          const items  = Array.isArray(list) ? list : [list];
          for (const item of items) {
            // fast-xml-parser가 '011070' 같은 값을 숫자 11070으로 파싱할 수 있으므로
            // padStart(6,'0')으로 선행 0 복원
            const stockRaw = item.stock_code?.toString().trim();
            const stock = stockRaw ? stockRaw.padStart(6, '0') : null;
            const corpRaw = item.corp_code?.toString().trim();
            const corp  = corpRaw ? corpRaw.padStart(8, '0') : null;
            if (stock && corp && stock !== '000000' && stock.length === 6) {
              map[stock] = corp;
            }
          }
          resolve();
        });
      })
      .on('error', reject);
  });

  corpCodeMap = map;
  cache.set('corp_code_map', map);
  console.log(`[DART] corp_code 매핑 완료: ${Object.keys(map).length}개`);
}

function getCorpCode(stockCode) {
  return corpCodeMap?.[stockCode] || null;
}

// ─── 최신 공시 분기 자동 판단 ────────────────────────────────────────────────
/**
 * 현재 날짜 기준 조회 시도 순서 반환
 * DART 공시 일정 (대략):
 *   사업보고서(11011): 3월 말
 *   1분기(11013):      5월 중순
 *   반기(11012):       8월 중순
 *   3분기(11014):      11월 중순
 */
function getReportCandidates() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  // (연도, 보고서코드) 순서로 최신부터 시도
  const candidates = [];

  if (month >= 11) {
    candidates.push([year, '11014']);   // 3분기
    candidates.push([year, '11012']);   // 반기
    candidates.push([year, '11013']);   // 1분기
    candidates.push([year, '11011']);   // 사업보고서(전기)
    candidates.push([year - 1, '11014']);
  } else if (month >= 8) {
    candidates.push([year, '11012']);
    candidates.push([year, '11013']);
    candidates.push([year - 1, '11011']);
    candidates.push([year - 1, '11014']);
  } else if (month >= 5) {
    candidates.push([year, '11013']);
    candidates.push([year - 1, '11011']);
    candidates.push([year - 1, '11014']);
    candidates.push([year - 1, '11012']);
  } else {
    // 1~4월: 전년도 사업보고서 or 3분기
    candidates.push([year - 1, '11011']);
    candidates.push([year - 1, '11014']);
    candidates.push([year - 1, '11012']);
    candidates.push([year - 1, '11013']);
  }

  return candidates;
}

// ─── 자본총계 조회 ────────────────────────────────────────────────────────────
async function getEquity(stockCode) {
  const cKey = `equity_${stockCode}`;
  const cached = cache.get(cKey);
  if (cached !== undefined) return cached;

  const corpCode = getCorpCode(stockCode);
  if (!corpCode) { cache.set(cKey, null); return null; }

  const candidates = getReportCandidates();

  for (const [year, reprtCode] of candidates) {
    try {
      const data = await fetchJson(
        `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json` +
        `?crtfc_key=${API_KEY}` +
        `&corp_code=${corpCode}` +
        `&bsns_year=${year}` +
        `&reprt_code=${reprtCode}` +
        `&fs_div=CFS`
      );

      if (data.status !== '000' || !Array.isArray(data.list)) continue;

      // 자본총계 항목 탐색
      const item = data.list.find(r =>
        r.account_nm === '자본총계' &&
        r.fs_nm?.includes('연결')
      ) || data.list.find(r => r.account_nm === '자본총계');

      if (!item) continue;

      const raw = item.thstrm_amount?.replace(/,/g, '');
      const equity = raw ? Number(raw) : null;
      if (!equity || equity <= 0) continue;

      console.log(`[DART] ${stockCode} 자본총계: ${equity.toLocaleString()} (${year} ${reprtCode})`);
      cache.set(cKey, equity);
      return equity;
    } catch (e) {
      console.warn(`[DART] ${stockCode} ${year}/${reprtCode}:`, e.message);
    }
  }

  cache.set(cKey, null);
  return null;
}

// ─── 재무비율 조회 (ROA·ROE·영업이익률·순이익률·부채비율) ────────────────────────
async function getFinancialRatios(stockCode) {
  const cKey = `finratios_${stockCode}`;
  const cached = cache.get(cKey);
  if (cached !== undefined) return cached;

  const corpCode = getCorpCode(stockCode);
  if (!corpCode) { cache.set(cKey, null); return null; }

  const candidates = getReportCandidates();

  // CFS(연결) 우선, 없으면 OFS(별도) 시도
  for (const fsDiv of ['CFS', 'OFS']) {
    for (const [year, reprtCode] of candidates) {
      try {
        const data = await fetchJson(
          `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json` +
          `?crtfc_key=${API_KEY}` +
          `&corp_code=${corpCode}` +
          `&bsns_year=${year}` +
          `&reprt_code=${reprtCode}` +
          `&fs_div=${fsDiv}`
        );

        if (data.status !== '000' || !Array.isArray(data.list) || data.list.length === 0) continue;

        const findAmt = (...names) => {
          for (const nm of names) {
            const item = data.list.find(r => r.account_nm === nm);
            if (!item) continue;
            const v = parseFloat((item.thstrm_amount || '').replace(/,/g, ''));
            if (!isNaN(v)) return v;
          }
          return null;
        };

        const revenue         = findAmt('매출액', '수익(매출액)', '영업수익', '매출');
        const operatingIncome = findAmt('영업이익', '영업이익(손실)');
        const netIncome       = findAmt('당기순이익', '당기순이익(손실)', '분기순이익', '반기순이익');
        const totalAssets     = findAmt('자산총계');
        const totalLiab       = findAmt('부채총계');
        const equity          = findAmt('자본총계');

        // 최소한 총자산이나 매출 중 하나는 있어야 유효
        if (!totalAssets && !revenue) continue;

        const result = {
          operatingMargin: (operatingIncome != null && revenue  && revenue  !== 0) ? +(operatingIncome / revenue  * 100).toFixed(1) : null,
          netMargin:       (netIncome       != null && revenue  && revenue  !== 0) ? +(netIncome       / revenue  * 100).toFixed(1) : null,
          roa:             (netIncome       != null && totalAssets > 0)            ? +(netIncome       / totalAssets * 100).toFixed(1) : null,
          roe:             (netIncome       != null && equity   > 0)               ? +(netIncome       / equity    * 100).toFixed(1) : null,
          debtToEquity:    (totalLiab       != null && equity   > 0)               ? +(totalLiab       / equity   * 100).toFixed(1) : null,
        };

        // 의미있는 값이 하나라도 있을 때만 캐시
        if (Object.values(result).some(v => v != null)) {
          cache.set(cKey, result);
          return result;
        }
      } catch (e) {
        console.warn(`[DART] getFinancialRatios ${stockCode} ${fsDiv} ${year}:`, e.message?.slice(0, 60));
      }
    }
  }

  cache.set(cKey, null);
  return null;
}

// ─── PBR 계산 ─────────────────────────────────────────────────────────────────
async function calcPBR(stockCode, currentPrice, sharesOutstanding) {
  if (!currentPrice || !sharesOutstanding) return null;
  const equity = await getEquity(stockCode);
  if (!equity) return null;

  // DART 자본총계 단위: 원 (삼성전자 기준 수백조)
  // Yahoo Finance sharesOutstanding: 주 단위
  const bps = equity / sharesOutstanding;
  if (bps <= 0) return null;

  return +(currentPrice / bps).toFixed(2);
}

// ─── 서버 시작 시 초기화 ─────────────────────────────────────────────────────
async function initDart() {
  if (!API_KEY) {
    console.warn('[DART] DART_API_KEY 없음 — PBR 계산 비활성화');
    return;
  }
  try {
    await loadCorpCodes();
  } catch (e) {
    console.error('[DART] 초기화 실패:', e.message);
  }
}

// ─── HTTP 헬퍼 ────────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

function fetchBinary(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// ─── 3개년 당기순이익 조회 (사업보고서 기준) ─────────────────────────────────
/**
 * 사업보고서 1건 조회로 3개년 당기순이익을 반환
 * Returns: { year: number, t: number, t1: number, t2: number } | null
 *   t  = 당기 (보고서 기준년도)
 *   t1 = 전기 (t-1)
 *   t2 = 전전기 (t-2)
 */
async function getMultiYearNetIncome(stockCode) {
  const cKey = `multi_ni_${stockCode}`;
  const cached = cache.get(cKey);
  if (cached !== undefined) return cached;

  const corpCode = getCorpCode(stockCode);
  if (!corpCode) { cache.set(cKey, null); return null; }

  // 현재(2026-05)에서 최신 사업보고서는 2025년(3월 말 제출)
  const now   = new Date();
  const month = now.getMonth() + 1;
  const saeupYear = month >= 4 ? now.getFullYear() - 1 : now.getFullYear() - 2;

  for (const fsDiv of ['CFS', 'OFS']) {
    for (const tryYear of [saeupYear, saeupYear - 1]) {
      try {
        const data = await fetchJson(
          `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json` +
          `?crtfc_key=${API_KEY}&corp_code=${corpCode}` +
          `&bsns_year=${tryYear}&reprt_code=11011&fs_div=${fsDiv}`
        );

        if (data.status !== '000' || !Array.isArray(data.list) || data.list.length === 0) continue;

        const item = data.list.find(r =>
          ['당기순이익', '당기순이익(손실)'].includes(r.account_nm)
        );
        if (!item) continue;

        const parseAmt = v => {
          const n = parseFloat((v || '').replace(/,/g, ''));
          return isNaN(n) ? null : n;
        };

        const t  = parseAmt(item.thstrm_amount);
        const t1 = parseAmt(item.frmtrm_amount);
        const t2 = parseAmt(item.bfefrmtrm_amount);

        if (t == null && t1 == null) continue;

        const result = { year: tryYear, t, t1, t2 };
        cache.set(cKey, result);
        return result;
      } catch (e) {
        console.warn(`[DART] getMultiYearNetIncome ${stockCode} ${tryYear}:`, e.message?.slice(0, 60));
      }
    }
  }

  cache.set(cKey, null);
  return null;
}

// ─── 사업보고서 1회 호출로 전체 재무지표 계산 ────────────────────────────────
/**
 * DART 사업보고서에서 한 번의 API 호출로 모든 재무지표를 반환
 * Returns: { roe, debtRatio, roa, opMargin, netMargin, niYoY, niCagr2Y, niVol,
 *            ni_t, ni_t1, ni_t2, equity, totalLiab, totalAssets, revenue, opIncome,
 *            year, fsDiv }
 */
async function getDartFullFinancials(stockCode) {
  const cKey = `dart_full_${stockCode}`;
  const cached = cache.get(cKey);
  if (cached !== undefined) return cached;

  const corpCode = getCorpCode(stockCode);
  if (!corpCode) { cache.set(cKey, null); return null; }

  const now      = new Date();
  const month    = now.getMonth() + 1;
  const baseYear = month >= 4 ? now.getFullYear() - 1 : now.getFullYear() - 2;

  for (const fsDiv of ['CFS', 'OFS']) {
    for (const tryYear of [baseYear, baseYear - 1]) {
      try {
        const data = await fetchJson(
          `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json` +
          `?crtfc_key=${API_KEY}&corp_code=${corpCode}` +
          `&bsns_year=${tryYear}&reprt_code=11011&fs_div=${fsDiv}`
        );
        if (data.status !== '000' || !Array.isArray(data.list) || !data.list.length) continue;

        const findItem = (...names) => {
          for (const nm of names) {
            const it = data.list.find(r => r.account_nm === nm);
            if (it) return it;
          }
          return null;
        };
        const pa = (item, field) => {
          if (!item) return null;
          const v = parseFloat((item[field] || '').replace(/,/g, ''));
          return isNaN(v) ? null : v;
        };

        const niItem      = findItem('당기순이익', '당기순이익(손실)', '분기순이익', '반기순이익');
        const ni_t        = pa(niItem, 'thstrm_amount');
        const ni_t1       = pa(niItem, 'frmtrm_amount');
        const ni_t2       = pa(niItem, 'bfefrmtrm_amount');

        const equity      = pa(findItem('자본총계'),                                   'thstrm_amount');
        const totalAssets = pa(findItem('자산총계'),                                   'thstrm_amount');
        // 부채총계: 직접 찾거나 (자산총계 - 자본총계) 계산
        const totalLiabRaw = pa(findItem('부채총계'),                                  'thstrm_amount');
        const totalLiab    = totalLiabRaw ?? (totalAssets != null && equity != null ? totalAssets - equity : null);
        const revenue     = pa(findItem('매출액', '수익(매출액)', '영업수익', '매출'), 'thstrm_amount');
        const opIncome    = pa(findItem('영업이익', '영업이익(손실)'),                 'thstrm_amount');

        // 거장 지표 계산용 추가 필드
        const currentAssets  = pa(findItem('유동자산'),                                              'thstrm_amount');
        const currentLiab    = pa(findItem('유동부채'),                                              'thstrm_amount');
        const cash           = pa(findItem('현금및현금성자산', '현금 및 현금성자산'),               'thstrm_amount');
        // WACC 계산용: 이자비용, 법인세비용, 세전이익
        const interestExpense = pa(findItem('이자비용'),                                             'thstrm_amount');
        const taxExpense      = pa(findItem('법인세비용'),                                           'thstrm_amount');
        const preTaxIncome    = pa(findItem(
          '법인세비용차감전순이익', '법인세비용차감전이익', '법인세차감전이익',
          '법인세비용차감전순이익(손실)'
        ),                                                                                            'thstrm_amount');
        // 전기(t-1) 값: 레버리지 추세, Piotroski, 자산회전율 비교용
        const revenue_t1     = pa(findItem('매출액', '수익(매출액)', '영업수익', '매출'),           'frmtrm_amount');
        const opIncome_t1    = pa(findItem('영업이익', '영업이익(손실)'),                           'frmtrm_amount');
        const totalAssets_t1 = pa(findItem('자산총계'),                                             'frmtrm_amount');
        const equity_t1      = pa(findItem('자본총계'),                                             'frmtrm_amount');
        const totalLiabRaw_t1 = pa(findItem('부채총계'),                                            'frmtrm_amount');
        const totalLiab_t1    = totalLiabRaw_t1 ?? (totalAssets_t1 != null && equity_t1 != null ? totalAssets_t1 - equity_t1 : null);

        if (ni_t == null && equity == null && totalAssets == null) continue;

        const roe       = (ni_t != null && equity      > 0) ? +(ni_t / equity      * 100).toFixed(1) : null;
        const debtRatio = (totalLiab != null && equity > 0) ? +(totalLiab / equity * 100).toFixed(1) : null;
        const roa       = (ni_t != null && totalAssets > 0) ? +(ni_t / totalAssets * 100).toFixed(1) : null;
        const opMargin  = (opIncome != null && revenue > 0) ? +(opIncome / revenue * 100).toFixed(1) : null;
        const netMargin = (ni_t   != null && revenue   > 0) ? +(ni_t   / revenue   * 100).toFixed(1) : null;

        let niYoY    = null;
        let niCagr2Y = null;
        let niVol    = null;

        if (ni_t != null && ni_t1 != null && ni_t1 !== 0)
          niYoY = (ni_t / ni_t1) - 1;

        if (ni_t != null && ni_t2 != null && ni_t > 0 && ni_t2 > 0)
          niCagr2Y = Math.pow(ni_t / ni_t2, 0.5) - 1;

        if (niYoY != null && ni_t1 != null && ni_t2 != null && ni_t2 !== 0) {
          const yoy2 = (ni_t1 / ni_t2) - 1;
          const m2   = (niYoY + yoy2) / 2;
          niVol = Math.sqrt(((niYoY - m2) ** 2 + (yoy2 - m2) ** 2) / 2);
        }

        // 순이익 상태 판정 (전전기 우선, 없으면 전기와 비교)
        let niStatus = null;
        const refNi = ni_t2 ?? ni_t1;
        if (ni_t != null && refNi != null) {
          if      (ni_t > 0 && refNi < 0) niStatus = '흑자전환';
          else if (ni_t < 0 && refNi > 0) niStatus = '적자전환';
          else if (ni_t < 0 && refNi < 0) niStatus = Math.abs(ni_t) < Math.abs(refNi) ? '손실축소' : '적자지속';
        }

        const result = {
          year: tryYear, fsDiv,
          ni_t, ni_t1, ni_t2, niStatus,
          equity, totalLiab, totalAssets, revenue, opIncome,
          currentAssets, currentLiab, cash,
          interestExpense, taxExpense, preTaxIncome,
          revenue_t1, opIncome_t1, totalLiab_t1, totalAssets_t1, equity_t1,
          roe, debtRatio, roa, opMargin, netMargin,
          niYoY, niCagr2Y, niVol,
        };

        cache.set(cKey, result);
        console.log(`[DART] ${stockCode} 재무 조회 완료 (${tryYear} ${fsDiv})`);
        return result;
      } catch (e) {
        console.warn(`[DART] getDartFullFinancials ${stockCode} ${tryYear}:`, e.message?.slice(0, 60));
      }
    }
  }

  cache.set(cKey, null);
  return null;
}

// ─── 최근 공시 목록 ───────────────────────────────────────────────────────────
/**
 * 종목 최근 공시 목록 (최근 90일)
 * @returns {Promise<Array<{date, title, rceptNo, type, url}>>}
 */
async function getDartDisclosures(stockCode, limit = 15) {
  const cKey = `dart_disc_${stockCode}`;
  const cached = cache.get(cKey);
  if (cached !== undefined) return cached;

  const corpCode = getCorpCode(stockCode);
  if (!corpCode || !API_KEY) { cache.set(cKey, []); return []; }

  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const end   = fmt(new Date());
  const start = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return fmt(d); })();

  try {
    const data = await fetchJson(
      `https://opendart.fss.or.kr/api/list.json` +
      `?crtfc_key=${API_KEY}` +
      `&corp_code=${corpCode}` +
      `&bgn_de=${start}&end_de=${end}` +
      `&page_count=${limit}&page_no=1`
    );

    if (data.status !== '000' || !Array.isArray(data.list)) {
      cache.set(cKey, [], 3600); return [];
    }

    const result = data.list.slice(0, limit).map(d => ({
      date:    d.rcept_dt,           // YYYYMMDD
      title:   d.report_nm,
      rceptNo: d.rcept_no,
      type:    d.report_nm.split('(')[0].trim().slice(0, 20),
      url:     `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`,
    }));

    cache.set(cKey, result, 1800); // 30분 캐시
    return result;
  } catch (e) {
    console.warn(`[DART] getDartDisclosures ${stockCode}: ${e.message?.slice(0, 60)}`);
    cache.set(cKey, [], 600);
    return [];
  }
}

module.exports = {
  initDart, calcPBR, getCorpCode, loadCorpCodes,
  getFinancialRatios, getMultiYearNetIncome, getDartFullFinancials,
  getDartDisclosures,
};
