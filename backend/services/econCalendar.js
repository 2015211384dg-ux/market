/**
 * 경제 캘린더 서비스
 * 미국: CPI/NFP/FOMC/PCE/PPI/GDP 등 2026년 주요 발표일 하드코딩 (BLS/Fed/BEA 공식 일정)
 * 한국: BOK 금통위 2026 하드코딩
 */
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 });

// ─── 미국 주요 경제 지표 2026 발표일 ─────────────────────────────────────────
// 출처: BLS / Federal Reserve / BEA 공식 일정
const US_CALENDAR_2026 = [
  // FOMC (기준금리) — 8회
  { date: '2026-01-29', event: 'FOMC — 기준금리 결정',          impact: 'high',   time: '19:00' },
  { date: '2026-03-19', event: 'FOMC — 기준금리 결정',          impact: 'high',   time: '19:00' },
  { date: '2026-05-07', event: 'FOMC — 기준금리 결정',          impact: 'high',   time: '19:00' },
  { date: '2026-06-18', event: 'FOMC — 기준금리 결정',          impact: 'high',   time: '19:00' },
  { date: '2026-07-30', event: 'FOMC — 기준금리 결정',          impact: 'high',   time: '19:00' },
  { date: '2026-09-17', event: 'FOMC — 기준금리 결정',          impact: 'high',   time: '19:00' },
  { date: '2026-11-05', event: 'FOMC — 기준금리 결정',          impact: 'high',   time: '19:00' },
  { date: '2026-12-17', event: 'FOMC — 기준금리 결정',          impact: 'high',   time: '19:00' },

  // CPI (소비자물가) — 매월
  { date: '2026-01-15', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },
  { date: '2026-02-11', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },
  { date: '2026-03-11', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },
  { date: '2026-04-10', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },
  { date: '2026-05-13', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },
  { date: '2026-06-10', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },
  { date: '2026-07-15', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },
  { date: '2026-08-12', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },
  { date: '2026-09-11', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },
  { date: '2026-10-14', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },
  { date: '2026-11-12', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },
  { date: '2026-12-10', event: 'CPI — 소비자물가지수',          impact: 'high',   time: '13:30' },

  // NFP 비농업 고용 — 매월 첫째 금요일
  { date: '2026-01-09', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },
  { date: '2026-02-06', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },
  { date: '2026-03-06', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },
  { date: '2026-04-03', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },
  { date: '2026-05-08', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },
  { date: '2026-06-05', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },
  { date: '2026-07-10', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },
  { date: '2026-08-07', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },
  { date: '2026-09-04', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },
  { date: '2026-10-02', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },
  { date: '2026-11-06', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },
  { date: '2026-12-04', event: 'NFP — 비농업 고용',             impact: 'high',   time: '13:30' },

  // PCE (개인소비지출 물가) — 매월 말
  { date: '2026-01-30', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },
  { date: '2026-02-27', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },
  { date: '2026-03-27', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },
  { date: '2026-04-30', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },
  { date: '2026-05-29', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },
  { date: '2026-06-26', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },
  { date: '2026-07-31', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },
  { date: '2026-08-28', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },
  { date: '2026-09-25', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },
  { date: '2026-10-30', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },
  { date: '2026-11-25', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },
  { date: '2026-12-23', event: 'PCE — 개인소비지출 물가',       impact: 'high',   time: '13:30' },

  // GDP (분기별)
  { date: '2026-01-29', event: 'GDP 잠정치 (Q4 2025)',          impact: 'high',   time: '13:30' },
  { date: '2026-04-29', event: 'GDP 잠정치 (Q1 2026)',          impact: 'high',   time: '13:30' },
  { date: '2026-07-30', event: 'GDP 잠정치 (Q2 2026)',          impact: 'high',   time: '13:30' },
  { date: '2026-10-29', event: 'GDP 잠정치 (Q3 2026)',          impact: 'high',   time: '13:30' },

  // PPI (생산자물가) — 매월
  { date: '2026-04-11', event: 'PPI — 생산자물가지수',          impact: 'medium', time: '13:30' },
  { date: '2026-05-14', event: 'PPI — 생산자물가지수',          impact: 'medium', time: '13:30' },
  { date: '2026-06-11', event: 'PPI — 생산자물가지수',          impact: 'medium', time: '13:30' },
  { date: '2026-07-14', event: 'PPI — 생산자물가지수',          impact: 'medium', time: '13:30' },
  { date: '2026-08-13', event: 'PPI — 생산자물가지수',          impact: 'medium', time: '13:30' },
  { date: '2026-09-10', event: 'PPI — 생산자물가지수',          impact: 'medium', time: '13:30' },

  // 소매판매 — 매월 중순
  { date: '2026-04-15', event: '소매판매 (Retail Sales)',       impact: 'medium', time: '13:30' },
  { date: '2026-05-15', event: '소매판매 (Retail Sales)',       impact: 'medium', time: '13:30' },
  { date: '2026-06-16', event: '소매판매 (Retail Sales)',       impact: 'medium', time: '13:30' },
  { date: '2026-07-16', event: '소매판매 (Retail Sales)',       impact: 'medium', time: '13:30' },
  { date: '2026-08-14', event: '소매판매 (Retail Sales)',       impact: 'medium', time: '13:30' },
  { date: '2026-09-15', event: '소매판매 (Retail Sales)',       impact: 'medium', time: '13:30' },
];

// ─── 한국 BOK 금통위 2026 ─────────────────────────────────────────────────────
const KR_CALENDAR_2026 = [
  { date: '2026-04-17', event: '한국은행 금통위 — 기준금리 결정', impact: 'high', time: '09:00' },
  { date: '2026-05-28', event: '한국은행 금통위 — 기준금리 결정', impact: 'high', time: '09:00' },
  { date: '2026-07-17', event: '한국은행 금통위 — 기준금리 결정', impact: 'high', time: '09:00' },
  { date: '2026-08-27', event: '한국은행 금통위 — 기준금리 결정', impact: 'high', time: '09:00' },
  { date: '2026-10-16', event: '한국은행 금통위 — 기준금리 결정', impact: 'high', time: '09:00' },
  { date: '2026-11-26', event: '한국은행 금통위 — 기준금리 결정', impact: 'high', time: '09:00' },
];

function getCalendar(market = 'us', days = 14) {
  const cacheKey = `econ_cal_${market}_${days}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const today = new Date().toISOString().split('T')[0];
  const to    = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

  let events = [];

  if (market === 'us' || market === 'both') {
    events.push(...US_CALENDAR_2026
      .filter(e => e.date >= today && e.date <= to)
      .map(e => ({ ...e, country: 'US', currency: 'USD' }))
    );
  }
  if (market === 'kr' || market === 'both') {
    events.push(...KR_CALENDAR_2026
      .filter(e => e.date >= today && e.date <= to)
      .map(e => ({ ...e, country: 'KR', currency: 'KRW' }))
    );
  }

  events.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  cache.set(cacheKey, events, 3600);
  return events;
}

module.exports = { getCalendar, US_CALENDAR_2026, KR_CALENDAR_2026 };
