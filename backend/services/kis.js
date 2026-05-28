'use strict';
/**
 * KIS (한국투자증권) REST API 서비스
 * 환경변수: KIS_APP_KEY, KIS_APP_SECRET
 *
 * getStockList()       → KRX 전종목 (코스피+코스닥 보통주)
 * getOHLCV(code, n)   → 일봉 OHLCV (n일)
 * getPrice(code)       → 현재가 / 시총
 */
const axios = require('axios');

const BASE_URL = 'https://openapi.koreainvestment.com:9443';

if (!process.env.KIS_APP_KEY || !process.env.KIS_APP_SECRET) {
  console.warn('[KIS] ⚠ KIS_APP_KEY / KIS_APP_SECRET 미설정 — API 호출 실패 가능');
}

// ── 인증 토큰 캐시 ─────────────────────────────────────────────────────────────
let _token       = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await axios.post(`${BASE_URL}/oauth2/tokenP`, {
    grant_type: 'client_credentials',
    appkey:     process.env.KIS_APP_KEY,
    appsecret:  process.env.KIS_APP_SECRET,
  }, { timeout: 10000 });
  _token       = res.data.access_token;
  _tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
  return _token;
}

function kisHeaders(trId, token) {
  return {
    'content-type': 'application/json; charset=utf-8',
    authorization:  `Bearer ${token}`,
    appkey:         process.env.KIS_APP_KEY,
    appsecret:      process.env.KIS_APP_SECRET,
    tr_id:          trId,
    custtype:       'P',
  };
}

// ── 전종목 리스트 (KRX 데이터 포털) ──────────────────────────────────────────
let _stockList       = null;
let _stockListExpiry = 0;

async function fetchKRXList(marketId) {
  const bldMap = {
    STK: 'dbms/MDC/STAT/standard/MDCSTAT01501', // 코스피
    KSQ: 'dbms/MDC/STAT/standard/MDCSTAT01901', // 코스닥
  };
  const res = await axios.post(
    'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd',
    new URLSearchParams({ bld: bldMap[marketId], locale: 'ko_KR' }).toString(),
    {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Referer:        'https://data.krx.co.kr/',
        'User-Agent':   'Mozilla/5.0 (compatible; MarketBot/1.0)',
      },
      timeout: 30000,
    }
  );

  return (res.data.OutBlock_1 || [])
    .filter(s => s.KIND_STKCLS_NM === '보통주')
    .map(s => ({
      code:         s.ISU_SRT_CD,
      name:         s.ISU_ABBRV || s.ISU_NM,
      market:       marketId === 'STK' ? 'KOSPI' : 'KOSDAQ',
      sector:       s.SECT_TP_NM || '',
      marketCapEok: Math.round(+(s.MKTCAP || 0) / 100), // 백만원 → 억원
    }));
}

async function getStockList() {
  if (_stockList && Date.now() < _stockListExpiry) return _stockList;

  console.log('[KIS] KRX 전종목 리스트 조회 시작...');
  try {
    const [kospi, kosdaq] = await Promise.all([
      fetchKRXList('STK'),
      fetchKRXList('KSQ'),
    ]);
    _stockList       = [...kospi, ...kosdaq];
    _stockListExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24h

    console.log(
      `[KIS] 전종목 로드 완료: KOSPI ${kospi.length}개, KOSDAQ ${kosdaq.length}개`,
      `합계 ${_stockList.length}개`
    );
  } catch (err) {
    console.error('[KIS] KRX 리스트 조회 실패:', err.message);
    // 실패 시 최소한의 빈 배열이라도 반환하여 API가 죽지 않게 함
    return [];
  }
  return _stockList;
}

// ── 일봉 OHLCV ────────────────────────────────────────────────────────────────
async function getOHLCV(code, nDays = 600) {
  const token = await getToken();
  const fmtDate = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const today   = new Date();
  const end     = fmtDate(today);
  const start   = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - Math.ceil(nDays * 1.5));
    return fmtDate(d);
  })();

  const res = await axios.get(
    `${BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
    {
      headers: kisHeaders('FHKST03010100', token),
      params: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD:         code,
        FID_INPUT_DATE_1:       start,
        FID_INPUT_DATE_2:       end,
        FID_PERIOD_DIV_CODE:    'D',
        FID_ORG_ADJ_PRC:        '0',
      },
      timeout: 15000,
    }
  );

  return (res.data?.output2 || [])
    .map(d => ({
      date:     d.stck_bsop_date,
      open:     +d.stck_oprc,
      high:     +d.stck_hgpr,
      low:      +d.stck_lwpr,
      close:    +d.stck_clpr,
      volume:   +d.acml_vol,
      turnover: +d.acml_tr_pbmn, // 원 단위
    }))
    .filter(d => d.close > 0)
    .reverse(); // 오래된 날 → 최근 날 순
}

// ── 현재가 / 시총 / 재무지표 ───────────────────────────────────────────────────
async function getPrice(code) {
  const token = await getToken();
  const res = await axios.get(
    `${BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`,
    {
      headers: kisHeaders('FHKST01010100', token),
      params: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD:         code,
      },
      timeout: 10000,
    }
  );
  const d = res.data?.output || {};

  // KIS 재무지표 파싱 (0이면 null 처리)
  const parseFin = v => {
    const n = parseFloat(v);
    return (!isNaN(n) && n > 0) ? n : null;
  };

  const per = parseFin(d.per);
  const pbr = parseFin(d.pbr);
  const eps = parseFin(d.eps);
  const bps = parseFin(d.bps);
  // ROE ≈ EPS / BPS × 100 (KIS에서 직접 제공하지 않을 때 근사값)
  const roe = (eps != null && bps != null && bps > 0) ? +(eps / bps * 100).toFixed(2) : null;

  return {
    code,
    close:        +d.stck_prpr,
    prevClose:    +d.stck_sdpr,
    high:         +d.stck_hgpr,
    low:          +d.stck_lwpr,
    volume:       +d.acml_vol,
    turnover:     +d.acml_tr_pbmn,
    marketCapEok: +d.hts_avls,
    isManaged:    d.mrkt_warn_cls_code === '01',
    isSuspended:  d.halt_yn === 'Y',
    isInsolvent:  false,
    // 재무지표 (inquire-price 에 포함된 기본값)
    per, pbr, eps, bps, roe,
  };
}

// ── KOSPI 지수 일봉 ────────────────────────────────────────────────────────────
async function getKOSPIOHLCV(nDays = 300) {
  const token = await getToken();
  const fmtDate = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const today   = new Date();
  const end     = fmtDate(today);
  const start   = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - Math.ceil(nDays * 1.5));
    return fmtDate(d);
  })();

  const res = await axios.get(
    `${BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`,
    {
      headers: kisHeaders('FHKST03010100', token),
      params: {
        FID_COND_MRKT_DIV_CODE: 'U',   // U = 지수
        FID_INPUT_ISCD:         '0001', // KOSPI
        FID_INPUT_DATE_1:       start,
        FID_INPUT_DATE_2:       end,
        FID_PERIOD_DIV_CODE:    'D',
        FID_ORG_ADJ_PRC:        '0',
      },
      timeout: 15000,
    }
  );

  return (res.data?.output2 || [])
    .map(d => ({
      date:  d.stck_bsop_date,
      // 지수는 bstp_nmix_prpr 필드, 없으면 stck_clpr fallback
      close: +(d.bstp_nmix_prpr || d.stck_clpr || 0),
    }))
    .filter(d => d.close > 0)
    .reverse();
}

// ── 베타 계산 ──────────────────────────────────────────────────────────────────
// β = Cov(종목 수익률, KOSPI 수익률) / Var(KOSPI 수익률)
// 1년(252 거래일) 일별 수익률 기준
const _betaCache    = new Map();
const _betaCacheTTL = 24 * 60 * 60 * 1000; // 24h

async function calculateBeta(stockCode, nDays = 252) {
  const cKey = `beta_${stockCode}`;
  const cached = _betaCache.get(cKey);
  if (cached && Date.now() < cached.expiry) return cached.value;

  try {
    const [stockData, kospiData] = await Promise.all([
      getOHLCV(stockCode, nDays + 30),
      getKOSPIOHLCV(nDays + 30),
    ]);

    if (stockData.length < 60 || kospiData.length < 60) {
      _betaCache.set(cKey, { value: null, expiry: Date.now() + _betaCacheTTL });
      return null;
    }

    // 날짜 기준으로 매핑 후 공통 거래일만 사용
    const stockMap = Object.fromEntries(stockData.map(d => [d.date, d.close]));
    const kospiMap = Object.fromEntries(kospiData.map(d => [d.date, d.close]));
    const commonDates = Object.keys(stockMap)
      .filter(d => kospiMap[d])
      .sort()
      .slice(-nDays);

    if (commonDates.length < 60) {
      _betaCache.set(cKey, { value: null, expiry: Date.now() + _betaCacheTTL });
      return null;
    }

    // 일별 수익률 계산
    const sr = []; // stock returns
    const kr = []; // kospi returns
    for (let i = 1; i < commonDates.length; i++) {
      const p = commonDates[i - 1];
      const c = commonDates[i];
      sr.push((stockMap[c] / stockMap[p]) - 1);
      kr.push((kospiMap[c] / kospiMap[p]) - 1);
    }

    // Cov / Var
    const n     = sr.length;
    const meanS = sr.reduce((a, b) => a + b, 0) / n;
    const meanK = kr.reduce((a, b) => a + b, 0) / n;

    let cov = 0, varK = 0;
    for (let i = 0; i < n; i++) {
      cov  += (sr[i] - meanS) * (kr[i] - meanK);
      varK += (kr[i] - meanK) ** 2;
    }
    cov  /= (n - 1);
    varK /= (n - 1);

    if (varK === 0) {
      _betaCache.set(cKey, { value: null, expiry: Date.now() + _betaCacheTTL });
      return null;
    }

    const beta = +(cov / varK).toFixed(2);
    // 비정상 범위 방어 (-2 ~ 5)
    const result = (beta >= -2 && beta <= 5) ? beta : null;
    _betaCache.set(cKey, { value: result, expiry: Date.now() + _betaCacheTTL });
    console.log(`[KIS] Beta(${stockCode}): ${result ?? 'null (out of range)'} (n=${n}일)`);
    return result;
  } catch (e) {
    console.warn(`[KIS] Beta 계산 실패 ${stockCode}:`, e.message?.slice(0, 80));
    _betaCache.set(cKey, { value: null, expiry: Date.now() + 60 * 60 * 1000 }); // 실패 시 1h 캐시
    return null;
  }
}

// ── 분봉 OHLCV (VWAP/ORB용) ───────────────────────────────────────────────────
/**
 * 당일 분봉 데이터 조회
 * @param {string} code
 * @param {string} hhmmss - 조회 기준 시각 (예: '153000'), 빈값=현재
 * @returns {Promise<Array<{time, open, high, low, close, volume}>>}
 */
async function getMinuteOHLCV(code, hhmmss = '') {
  const token = await getToken();
  try {
    const res = await axios.get(
      `${BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`,
      {
        headers: kisHeaders('FHKST03010200', token),
        params: {
          FID_ETC_CLS_CODE:       '',
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD:         code,
          FID_INPUT_HOUR_1:       hhmmss || '153000',
          FID_PW_DATA_INCU_YN:    'Y', // 과거 데이터 포함
        },
        timeout: 10000,
      }
    );

    return (res.data?.output2 || [])
      .map(d => ({
        date:   d.stck_bsop_date,  // YYYYMMDD
        time:   d.stck_cntg_hour,  // HHMMSS
        open:   +d.stck_oprc,
        high:   +d.stck_hgpr,
        low:    +d.stck_lwpr,
        close:  +d.stck_prpr,
        volume: +d.cntg_vol,
      }))
      .filter(d => d.close > 0)
      .reverse();  // 오래된 → 최근
  } catch (e) {
    console.warn(`[KIS] getMinuteOHLCV ${code}: ${e.message?.slice(0, 80)}`);
    return [];
  }
}

// ── 종목별 일자별 공매도 ──────────────────────────────────────────────────────
/**
 * 일자별 공매도 추이
 * @param {string} code
 * @returns {Promise<Array<{date, ssVolume, ssAmount, totalVolume, ssRatio}>>}
 */
async function getShortSale(code) {
  const token = await getToken();
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const end   = fmt(new Date());
  const start = (() => { const d = new Date(); d.setDate(d.getDate() - 60); return fmt(d); })();

  try {
    const res = await axios.get(
      `${BASE_URL}/uapi/domestic-stock/v1/quotations/daily-short-sale`,
      {
        headers: kisHeaders('FHPST04830000', token),
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD:         code,
          FID_INPUT_DATE_1:       start,
          FID_INPUT_DATE_2:       end,
        },
        timeout: 12000,
      }
    );

    if (res.data?.rt_cd !== '0') {
      console.warn(`[KIS] getShortSale ${code} 응답 비정상: rt_cd=${res.data?.rt_cd} msg=${res.data?.msg1} keys=${Object.keys(res.data || {}).join(',')}`);
      return [];
    }
    const outputArr = res.data?.output || res.data?.output1 || res.data?.output2 || [];
    if (outputArr.length === 0) console.warn(`[KIS] getShortSale ${code}: output 비어있음 (keys: ${Object.keys(res.data).join(',')})`);
    return outputArr.map(d => ({
      date:         d.stck_bsop_date,
      ssVolume:     +(d.ssts_cntg_qty || 0),    // 공매도 체결 수량
      ssAmount:     +(d.ssts_tr_pbmn || 0),     // 공매도 거래대금
      totalVolume:  +(d.acml_vol || 0),         // 총 거래량
      ssRatio:      +(d.stnd_ssts_rate || 0),   // 공매도 비중 %
      avgPrice:     +(d.avrg_prc || 0),         // 평균 공매도 단가
    })).reverse();
  } catch (e) {
    const msg = e.response?.data ? JSON.stringify(e.response.data).slice(0, 150) : e.message?.slice(0, 80);
    console.warn(`[KIS] getShortSale ${code}: ${msg}`);
    return [];
  }
}

// ── 종목별 증권사 투자의견 (목표주가) ─────────────────────────────────────────
/**
 * 종목 투자의견 조회
 * @returns {Promise<Array<{date, broker, opinion, targetPrice}>>}
 */
async function getInvestOpinion(code) {
  const token = await getToken();
  const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  const end   = fmt(new Date());
  const start = (() => { const d = new Date(); d.setDate(d.getDate() - 180); return fmt(d); })();

  try {
    const res = await axios.get(
      `${BASE_URL}/uapi/domestic-stock/v1/quotations/invest-opinion`,
      {
        headers: kisHeaders('FHKST663300C0', token),
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_COND_SCR_DIV_CODE:  '16633',
          FID_INPUT_ISCD:         code,
          FID_INPUT_DATE_1:       start,
          FID_INPUT_DATE_2:       end,
        },
        timeout: 12000,
      }
    );

    if (res.data?.rt_cd !== '0') {
      console.warn(`[KIS] getInvestOpinion ${code} 응답 비정상: rt_cd=${res.data?.rt_cd} msg=${res.data?.msg1}`);
      return [];
    }
    return (res.data?.output || []).map(d => ({
      date:        d.stck_bsop_date,
      broker:      d.mbcr_name,         // 증권사명
      opinion:     d.invt_opnn,         // 투자의견 (매수/중립/매도)
      targetPrice: +(d.hts_goal_prc || 0),  // 목표가
      currentPrice: +(d.stck_prpr || 0),
    })).filter(d => d.targetPrice > 0);
  } catch (e) {
    const msg = e.response?.data ? JSON.stringify(e.response.data).slice(0, 150) : e.message?.slice(0, 80);
    console.warn(`[KIS] getInvestOpinion ${code}: ${msg}`);
    return [];
  }
}

// ── 종목별 외국인/기관 매매 동향 ──────────────────────────────────────────────
/**
 * 종목 외인/기관 매매동향 (당일 + 추세)
 */
async function getForeignInstTotal(code) {
  const token = await getToken();
  try {
    const res = await axios.get(
      `${BASE_URL}/uapi/domestic-stock/v1/quotations/foreign-institution-total`,
      {
        headers: kisHeaders('FHPTJ04400000', token),
        params: {
          FID_COND_MRKT_DIV_CODE: 'V',
          FID_COND_SCR_DIV_CODE:  '16449',
          FID_INPUT_ISCD:         code,
          FID_DIV_CLS_CODE:       '0',
          FID_RANK_SORT_CLS_CODE: '0',
          FID_ETC_CLS_CODE:       '0',
        },
        timeout: 10000,
      }
    );
    return res.data?.output || [];
  } catch (e) {
    console.warn(`[KIS] getForeignInstTotal ${code}: ${e.message?.slice(0, 80)}`);
    return null;
  }
}

module.exports = {
  getStockList, getOHLCV, getPrice, getKOSPIOHLCV, calculateBeta,
  getMinuteOHLCV, getShortSale, getInvestOpinion, getForeignInstTotal,
};
