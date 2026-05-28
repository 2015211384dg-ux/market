const express = require('express');
const router = express.Router();
const { getAllIndicators, fetchHistory, INDICATORS } = require('../services/fred');
const { getInterpretation, generateAllInterpretations } = require('../services/indicatorInterpretations');
const pmiHistory = require('../services/pmiHistoryStore');
const { getMfgPmiHistory, getSvcPmiHistory } = require('../services/alphaPmi');
const { getQuotes } = require('../services/yahoo');
const { getAllPMI } = require('../services/pmi');
const { getAllSentiment } = require('../services/sentiment');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 3600 });

// ─── 실시간 시세 지표 (Yahoo Finance) ────────────────────────────────────────
// 원자재는 선물(Futures) 심볼로 실제 가격 사용
const MARKET_INDICATORS = [
  // 원자재
  { symbol: 'GC=F',  nameKo: '금 (현물)',       display: '$',  category: 'commodities', unit: '/oz' },
  { symbol: 'CL=F',  nameKo: '원유 WTI',         display: '$',  category: 'commodities', unit: '/bbl' },
  { symbol: 'BZ=F',  nameKo: '원유 Brent',       display: '$',  category: 'commodities', unit: '/bbl' },
  { symbol: 'HG=F',  nameKo: '구리',             display: '$',  category: 'commodities', unit: '/lb' },
  { symbol: 'SI=F',  nameKo: '은',               display: '$',  category: 'commodities', unit: '/oz' },
  // 시장심리
  { symbol: '^VIX',  nameKo: '공포지수(VIX)',     display: '',   category: 'sentiment' },
  { symbol: 'UUP',   nameKo: '달러 인덱스(UUP)',  display: '',   category: 'sentiment' },
];

// ─── GET /api/macro-data ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const cacheKey = 'macro_full';
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const [fredData, marketQuotes, pmiData, sentimentData] = await Promise.allSettled([
      getAllIndicators(),
      getQuotes(MARKET_INDICATORS.map(m => m.symbol)),
      getAllPMI(),
      getAllSentiment(),
    ]);

    const fred = fredData.status === 'fulfilled' ? fredData.value : {};
    const quotes = marketQuotes.status === 'fulfilled' ? marketQuotes.value : [];
    const pmi = pmiData.status === 'fulfilled' ? pmiData.value : {};
    const sentiment = sentimentData.status === 'fulfilled' ? sentimentData.value : {};

    const marketData = {};
    quotes.forEach(q => {
      const meta = MARKET_INDICATORS.find(m => m.symbol === q.symbol);
      if (!meta || !q.c) return;
      if (!marketData[meta.category]) marketData[meta.category] = [];
      marketData[meta.category].push({
        id:         meta.symbol,
        nameKo:     meta.nameKo,
        display:    meta.display,
        unit:       meta.unit || '',
        category:   meta.category,
        value:      q.c,
        prevValue:  q.pc,
        change:     q.d,
        changePct:  q.dp,
        date:       new Date().toISOString().split('T')[0],
      });
    });

    // PMI를 FRED growth 카테고리에 합산
    if (pmi.manufacturing?.value != null) {
      if (!fred.growth) fred.growth = [];
      fred.growth.unshift({
        id: 'ISM_MFG', nameKo: 'ISM 제조업 PMI', category: 'growth', display: 'pts',
        value: pmi.manufacturing.value, prevValue: null, change: null,
        date: pmi.manufacturing.date, source: pmi.manufacturing.source,
        bullAbove: 50, bearBelow: 45,
      });
    }
    if (pmi.services?.value != null) {
      if (!fred.growth) fred.growth = [];
      fred.growth.unshift({
        id: 'ISM_SVC', nameKo: 'ISM 서비스 PMI', category: 'growth', display: 'pts',
        value: pmi.services.value, prevValue: null, change: null,
        date: pmi.services.date, source: pmi.services.source,
        bullAbove: 50, bearBelow: 45,
      });
    }
    if (pmi.china?.value != null) {
      if (!fred.global) fred.global = [];
      fred.global.push({
        id: 'CAIXIN_PMI', nameKo: '중국 Caixin PMI', category: 'global', display: 'pts',
        value: pmi.china.value, prevValue: null, change: null,
        date: pmi.china.date, source: pmi.china.source,
        bullAbove: 50, bearBelow: 48,
      });
    }

    const result = {
      fred,
      market: marketData,
      pmi,
      sentiment,
      timestamp: new Date().toISOString(),
      hasFredKey: !!process.env.FRED_API_KEY,
    };

    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('Macro data error:', err.message);
    res.status(500).json({ error: '매크로 데이터 조회 실패', message: err.message });
  }
});

// ─── PMI 커스텀 ID → FRED 시리즈 매핑 ───────────────────────────────────────
// ISM 제조업(NAPM), 서비스(NMFCI)는 FRED 공개 시리즈로 히스토리 제공
// Caixin PMI는 FRED 미지원 → 로컬 누적 저장
const PMI_FRED_MAP = {
  ISM_MFG: {
    id: 'NAPM',  name: 'ISM Manufacturing PMI', nameKo: 'ISM 제조업 PMI',
    category: 'growth', units: 'lin', display: 'pts', freq: '월간',
    bullAbove: 50, bearBelow: 45,
  },
  ISM_SVC: {
    id: 'NMFCI', name: 'ISM Services PMI', nameKo: 'ISM 서비스 PMI',
    category: 'growth', units: 'lin', display: 'pts', freq: '월간',
    bullAbove: 50, bearBelow: 45,
  },
};
const CAIXIN_META = {
  id: 'CAIXIN_PMI', name: 'Caixin China PMI', nameKo: '중국 Caixin PMI',
  category: 'global', display: 'pts', freq: '월간',
  bullAbove: 50, bearBelow: 48,
};

// ─── GET /api/macro-data/history/:seriesId ──────────────────────────────────
router.get('/history/:seriesId', async (req, res) => {
  const sid = req.params.seriesId;

  // ISM PMI → Alpha Vantage 히스토리 (없으면 로컬 누적 fallback)
  if (PMI_FRED_MAP[sid]) {
    const indicator = { ...PMI_FRED_MAP[sid], id: sid };
    try {
      let history = sid === 'ISM_MFG'
        ? await getMfgPmiHistory()
        : await getSvcPmiHistory();

      // Alpha Vantage 키 없거나 실패 시 → 로컬 누적 저장 사용
      if (!history || history.length === 0) {
        history = pmiHistory.getHistory(sid);
      }

      const interpretation = history.length > 0
        ? await getInterpretation(indicator, history).catch(() => null)
        : null;
      return res.json({ indicator, history, interpretation });
    } catch (err) {
      return res.status(500).json({ error: 'PMI 히스토리 조회 실패', message: err.message });
    }
  }

  // Caixin PMI → 로컬 누적 저장 (FRED 미지원)
  if (sid === 'CAIXIN_PMI') {
    const history = pmiHistory.getHistory('CAIXIN_PMI');
    const interpretation = history.length > 0
      ? await getInterpretation(CAIXIN_META, history).catch(() => null)
      : null;
    return res.json({ indicator: CAIXIN_META, history, interpretation });
  }

  // FRED 지표 처리
  const indicator = INDICATORS.find(i => i.id === sid);
  if (!indicator) return res.status(404).json({ error: '지표를 찾을 수 없습니다' });
  if (!process.env.FRED_API_KEY) return res.status(400).json({ error: 'FRED_API_KEY 미설정' });

  try {
    const history = await fetchHistory(indicator);
    const interpretation = await getInterpretation(indicator, history);
    res.json({ indicator, history, interpretation });
  } catch (err) {
    res.status(500).json({ error: '히스토리 조회 실패', message: err.message });
  }
});

// ─── POST /api/macro-data/interpret-all (최초 일괄 생성) ────────────────────
router.post('/interpret-all', async (req, res) => {
  if (!process.env.FRED_API_KEY)     return res.status(400).json({ error: 'FRED_API_KEY 미설정' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'ANTHROPIC_API_KEY 미설정' });

  // 비동기 백그라운드 실행 (응답은 즉시)
  res.json({ message: '일괄 해석 생성 시작. 백그라운드에서 실행 중...' });

  try {
    // FRED 지표만 대상 (PMI/ISM 제외 - FRED seriesId 없음)
    const fredIndicators = INDICATORS.filter(i => i.id);
    const pairs = [];

    for (const ind of fredIndicators) {
      try {
        const history = await fetchHistory(ind);
        if (history.length > 0) pairs.push({ indicator: ind, history });
      } catch { /* 개별 실패 무시 */ }
    }

    const result = await generateAllInterpretations(pairs);
    console.log('[interpret-all] 완료:', result);
  } catch (e) {
    console.error('[interpret-all] 오류:', e.message);
  }
});

// ─── GET /api/macro-data/category/:cat ──────────────────────────────────────
router.get('/category/:cat', async (req, res) => {
  try {
    const data = await getAllIndicators();
    const cat = data[req.params.cat] || [];
    res.json(cat);
  } catch (err) {
    res.status(500).json({ error: 'fetch failed' });
  }
});

module.exports = router;
