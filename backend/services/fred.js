const axios = require('axios');
const NodeCache = require('node-cache');

const BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';
const API_KEY = process.env.FRED_API_KEY;
const cache = new NodeCache({ stdTTL: 3600 }); // 1시간 캐시

// ─── FRED 지표 정의 ───────────────────────────────────────────────────────────
// units: lin=수준, pch=전월비%, pc1=전년비%, pca=연율환산%, chg=변화량
const INDICATORS = [
  // 인플레이션
  { id: 'CPIAUCSL',         name: 'CPI',             nameKo: '소비자물가(CPI)',       category: 'inflation', units: 'pc1',  display: '%',  freq: '월간', target: 2,    bearAbove: 4,    bullBelow: 2 },
  { id: 'CPILFESL',         name: 'Core CPI',        nameKo: '근원 CPI',             category: 'inflation', units: 'pc1',  display: '%',  freq: '월간', target: 2,    bearAbove: 3.5,  bullBelow: 2 },
  { id: 'PPIACO',           name: 'PPI',             nameKo: '생산자물가(PPI)',       category: 'inflation', units: 'pc1',  display: '%',  freq: '월간', bearAbove: 4,  bullBelow: 1 },
  { id: 'PCEPI',            name: 'PCE',             nameKo: 'PCE 물가',             category: 'inflation', units: 'pc1',  display: '%',  freq: '월간', target: 2,    bearAbove: 3.5,  bullBelow: 2 },
  { id: 'PCEPILFE',         name: 'Core PCE',        nameKo: '근원 PCE',             category: 'inflation', units: 'pc1',  display: '%',  freq: '월간', target: 2,    bearAbove: 3,    bullBelow: 2 },

  // 통화정책
  { id: 'DFF',              name: 'Fed Funds Rate',  nameKo: '연준 기준금리',         category: 'monetary',  units: 'lin',  display: '%',  freq: '일간' },
  { id: 'WALCL',            name: 'Fed Balance',     nameKo: '연준 자산규모',         category: 'monetary',  units: 'lin',  display: '$T', freq: '주간', scaleFn: v => (v / 1e6).toFixed(2) },
  { id: 'M2SL',             name: 'M2',              nameKo: 'M2 통화량',            category: 'monetary',  units: 'pch',  display: '%',  freq: '월간' },
  { id: 'RRPONTSYD',        name: 'Reverse Repo',    nameKo: '역레포(RRP)',           category: 'monetary',  units: 'lin',  display: '$B', freq: '일간', scaleFn: v => (v).toFixed(0) },

  // 금리/채권
  { id: 'DGS2',             name: '2Y Yield',        nameKo: '미국채 2년물',         category: 'bonds',     units: 'lin',  display: '%',  freq: '일간' },
  { id: 'DGS10',            name: '10Y Yield',       nameKo: '미국채 10년물',        category: 'bonds',     units: 'lin',  display: '%',  freq: '일간' },
  { id: 'T10Y2Y',           name: 'Yield Spread',    nameKo: '장단기 스프레드(10-2)', category: 'bonds',     units: 'lin',  display: '%',  freq: '일간', bearBelow: 0 },

  // 고용
  { id: 'PAYEMS',           name: 'NFP',             nameKo: '비농업 고용(NFP)',      category: 'labor',     units: 'chg',  display: 'K',  freq: '월간', bullAbove: 150, bearBelow: 50 },
  { id: 'UNRATE',           name: 'Unemployment',    nameKo: '실업률',               category: 'labor',     units: 'lin',  display: '%',  freq: '월간', bullBelow: 4,   bearAbove: 5 },
  { id: 'AHETPI',           name: 'Wage Growth',     nameKo: '임금 상승률',           category: 'labor',     units: 'pc1',  display: '%',  freq: '월간' },
  { id: 'ICSA',             name: 'Jobless Claims',  nameKo: '신규 실업급여 청구',    category: 'labor',     units: 'lin',  display: 'K',  freq: '주간', scaleFn: v => (v / 1000).toFixed(0), bearAbove: 300, bullBelow: 220 },

  // 성장
  { id: 'GDPC1',            name: 'Real GDP',        nameKo: '실질 GDP 성장률',       category: 'growth',    units: 'pca',  display: '%',  freq: '분기', bullAbove: 2,   bearBelow: 0 },
  { id: 'INDPRO',           name: 'Indust. Prod.',   nameKo: '산업생산지수',          category: 'growth',    units: 'pc1',  display: '%',  freq: '월간' },
  { id: 'DGORDER',          name: 'Durable Goods',   nameKo: '내구재 수주',           category: 'growth',    units: 'pch',  display: '%',  freq: '월간' },

  // 소비
  { id: 'RSXFS',            name: 'Retail Sales',    nameKo: '소매판매',             category: 'consumer',  units: 'pch',  display: '%',  freq: '월간' },
  { id: 'UMCSENT',          name: 'Consumer Sent.',  nameKo: '미시간 소비자심리',     category: 'consumer',  units: 'lin',  display: 'pts', freq: '월간', bullAbove: 80, bearBelow: 60 },
  { id: 'CSCICP03USM665S',  name: 'Consumer Conf.', nameKo: '컨퍼런스보드 소비자신뢰', category: 'consumer',  units: 'lin',  display: 'pts', freq: '월간' },
  { id: 'MICH',             name: 'Infl. Expect.',   nameKo: '기대인플레이션(1Y)',     category: 'consumer',  units: 'lin',  display: '%',  freq: '월간' },

  // 주택
  { id: 'HOUST',            name: 'Housing Starts',  nameKo: '주택착공',             category: 'housing',   units: 'lin',  display: 'K',  freq: '월간', scaleFn: v => v.toFixed(0) },
  { id: 'PERMIT',           name: 'Building Permits', nameKo: '건축허가',            category: 'housing',   units: 'lin',  display: 'K',  freq: '월간', scaleFn: v => v.toFixed(0) },
  { id: 'EXHOSLUSM495S',    name: 'Existing Home Sales', nameKo: '기존주택 판매',     category: 'housing',   units: 'lin',  display: 'M',  freq: '월간', scaleFn: v => (v / 1e6).toFixed(2) },
  { id: 'CSUSHPISA',        name: 'Case-Shiller HPI', nameKo: '케이스-실러 주택가격', category: 'housing',   units: 'pc1',  display: '%',  freq: '월간' },

  // 글로벌
  { id: 'CP0000EZ19M086NEST', name: 'EU CPI',        nameKo: 'EU CPI (전년비)',       category: 'global',    units: 'lin',  display: '%',  freq: '월간' },
  { id: 'ECBMRRT',           name: 'ECB Rate',       nameKo: 'ECB 기준금리',          category: 'global',    units: 'lin',  display: '%',  freq: '수시' },
];

// ─── 단일 시리즈 조회 ─────────────────────────────────────────────────────────
async function getObservation(indicator) {
  const cacheKey = `fred_${indicator.id}_${indicator.units}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  if (!API_KEY) {
    return { ...indicator, value: null, prevValue: null, date: null, error: 'FRED_API_KEY 미설정' };
  }

  try {
    const res = await axios.get(BASE_URL, {
      params: {
        series_id: indicator.id,
        api_key: API_KEY,
        sort_order: 'desc',
        limit: 3,
        units: indicator.units,
        file_type: 'json',
        observation_start: '2020-01-01',
      },
      timeout: 10000,
    });

    const obs = (res.data.observations || []).filter(o => o.value !== '.' && o.value !== '');
    if (obs.length === 0) return { ...indicator, value: null, prevValue: null, date: null };

    const rawVal = parseFloat(obs[0].value);
    const rawPrev = obs[1] ? parseFloat(obs[1].value) : null;

    // scaleFn 적용 (있으면)
    const value = indicator.scaleFn ? parseFloat(indicator.scaleFn(rawVal)) : parseFloat(rawVal.toFixed(2));
    const prevValue = rawPrev !== null
      ? (indicator.scaleFn ? parseFloat(indicator.scaleFn(rawPrev)) : parseFloat(rawPrev.toFixed(2)))
      : null;

    const change = prevValue !== null ? parseFloat((value - prevValue).toFixed(3)) : null;

    const result = {
      ...indicator,
      value,
      prevValue,
      change,
      date: obs[0].date,
      prevDate: obs[1]?.date || null,
    };

    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    return { ...indicator, value: null, prevValue: null, date: null, error: err.message };
  }
}

// ─── 히스토리 조회 (차트용) ───────────────────────────────────────────────────
const histCache = new NodeCache({ stdTTL: 3600 });

async function fetchHistory(indicator) {
  // 최근 N개: desc로 최신부터 가져온 뒤 역순 정렬해 차트에 시간순 표시
  const limitMap = { '일간': 252, '주간': 52, '월간': 12, '분기': 8, '수시': 10 };
  const limit = limitMap[indicator.freq] || 12;

  const cacheKey = `fred_hist_${indicator.id}_${limit}`;
  const cached = histCache.get(cacheKey);
  if (cached) return cached;

  if (!API_KEY) return [];

  try {
    const res = await axios.get(BASE_URL, {
      params: {
        series_id: indicator.id,
        api_key: API_KEY,
        sort_order: 'desc',   // 최신 데이터부터
        limit,
        units: indicator.units,
        file_type: 'json',
      },
      timeout: 15000,
    });

    const obs = (res.data.observations || [])
      .filter(o => o.value !== '.' && o.value !== '')
      .map(o => {
        const rawVal = parseFloat(o.value);
        const value = indicator.scaleFn
          ? parseFloat(indicator.scaleFn(rawVal))
          : parseFloat(rawVal.toFixed(3));
        return { date: o.date, value };
      })
      .reverse(); // 차트용 시간순(오래된→최신)

    histCache.set(cacheKey, obs);
    return obs;
  } catch {
    return [];
  }
}

// ─── 전체 지표 일괄 조회 ─────────────────────────────────────────────────────
async function getAllIndicators() {
  const results = await Promise.allSettled(
    INDICATORS.map(ind => getObservation(ind))
  );

  const data = {};
  results.forEach((r, i) => {
    const ind = INDICATORS[i];
    const value = r.status === 'fulfilled' ? r.value : { ...ind, value: null, error: 'fetch failed' };
    if (!data[ind.category]) data[ind.category] = [];
    data[ind.category].push(value);
  });

  return data;
}

module.exports = { getAllIndicators, getObservation, fetchHistory, INDICATORS };
