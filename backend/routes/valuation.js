const express = require('express');
const router = express.Router();
const { getDartFullFinancials, getMultiYearNetIncome } = require('../services/dart');
const { calculateDCF, calculateMultiples } = require('../services/valuation');
const { getKRStockListFull } = require('../services/krStockList');
const { getPrice, calculateBeta } = require('../services/kis');

// 종목 리스트 미리 로드 (캐싱)
getKRStockListFull().catch(err => console.error('[Valuation] Initial stock list fetch failed:', err));

// EBITDA 추정 멀티플: 영업이익 × 멀티플 ≈ EBITDA
// D&A 규모가 산업별로 크게 다르므로 고정 1.2 대신 산업별 적용
// (설비·장치산업: 1.30~1.40 / 서비스·소프트웨어: 1.08~1.15)
const EBITDA_MULTIPLIERS = {
  '반도체·전자부품': 1.35,
  '바이오·제약':     1.20,
  '자동차·모빌리티': 1.40,
  '2차전지·에너지':  1.35,
  '소프트웨어·AI':   1.10,
  '금융·은행·보험':  1.05,
  '화학·철강·소재':  1.30,
  '기계·건설·조선':  1.25,
  '유통·리테일':     1.15,
  '식음료·소비재':   1.20,
  '미디어·엔터·게임':1.15,
  '기타':            1.20
};

// NOTE: /search 라우트는 프론트엔드가 /all-stocks + 클라이언트 필터링으로 전환 후 미사용.
// 삭제 처리. (KOSPI/KOSDAQ 판별 로직도 코드 기반 분류 불가로 제거)

/**
 * GET /all-stocks — 전체 종목 리스트 반환 (프론트엔드 캐싱용)
 */
router.get('/all-stocks', async (req, res) => {
  try {
    const stocks = await getKRStockListFull();
    res.json({ success: true, stocks });
  } catch (error) {
    res.status(500).json({ error: '종목 리스트를 가져오지 못했습니다.' });
  }
});

/**
 * GET /company-data/:stockCode — 기업 재무 데이터 조회 (DART + 시장 데이터)
 * Query param: industry — 산업군 (EBITDA 추정 멀티플 결정)
 */
router.get('/company-data/:stockCode', async (req, res) => {
  try {
    const { stockCode } = req.params;
    const { industry } = req.query;  // 산업별 EBITDA 멀티플 적용을 위해 수신

    const [financials, trendData, calculatedBeta] = await Promise.all([
      getDartFullFinancials(stockCode),
      getMultiYearNetIncome(stockCode),
      calculateBeta(stockCode),          // 1년 일별 수익률 기반 β 계산
    ]);

    if (!financials) {
      return res.status(404).json({ error: '재무 데이터를 찾을 수 없습니다.' });
    }

    // ── EBITDA 추정 ──────────────────────────────────────────────────────────
    // DART에서 D&A를 직접 제공하지 않으므로 산업별 멀티플 적용
    // (더 정밀한 계산은 주석처리된 IFRS 주석 파싱 방식 권장)
    const opIncome = financials.operatingProfit || financials.opIncome || 0;
    const ebitdaMult = EBITDA_MULTIPLIERS[industry] || EBITDA_MULTIPLIERS['기타'];
    const estimatedEbitda = opIncome * ebitdaMult;

    // ── 순차입금 (Net Debt) ───────────────────────────────────────────────────
    // DART는 금융부채(차입금+사채)를 총부채와 분리 제공하지 않으므로 근사치 사용:
    //   비유동부채(장기 금융성 성격 강함) + 유동부채의 50%(단기차입금 추정) - 현금
    //   = (totalLiab - currentLiab) + (currentLiab × 0.5) - cash
    //   = totalLiab - currentLiab × 0.5 - cash
    const currentLiab  = financials.currentLiab || 0;
    const estimatedFinancialDebt = financials.totalLiab - (currentLiab * 0.5);
    const netDebtRaw   = estimatedFinancialDebt - (financials.cash || 0);

    // ── 유동비율 (Current Ratio) ──────────────────────────────────────────────
    const currentAssets = financials.currentAssets || 0;
    const currentRatio  = (currentAssets > 0 && currentLiab > 0)
      ? (currentAssets / currentLiab).toFixed(2)
      : null;

    // ── WACC 계산용: Kd (세전 부채비용) ─────────────────────────────────────
    // Kd = 이자비용 / 추정금융부채 (= totalLiab - currentLiab×0.5)
    // 금융부채에는 매입채무 등 비이자성 부채가 포함되어 있어 실제보다 낮게 나올 수 있으나
    // DART에서 차입금을 별도 제공하지 않으므로 현재 가능한 최선의 근사치
    let kdFromDart = null;
    const intExp = financials.interestExpense;
    if (intExp != null && intExp > 0 && estimatedFinancialDebt > 0) {
      const kdRaw = (intExp / estimatedFinancialDebt) * 100;
      // 이상값 방어: 0.5% ~ 15% 범위
      if (kdRaw >= 0.5 && kdRaw <= 15) kdFromDart = +kdRaw.toFixed(2);
    }

    // ── WACC 계산용: 실효세율 ────────────────────────────────────────────────
    // 실효세율 = 법인세비용 / 세전이익
    let effectiveTaxRate = null;
    const taxExp    = financials.taxExpense;
    const preTaxInc = financials.preTaxIncome;
    if (taxExp != null && preTaxInc != null && preTaxInc > 0 && taxExp >= 0) {
      const trRaw = (taxExp / preTaxInc) * 100;
      // 0% ~ 40% 범위 (음수 세율·비정상값 방어)
      if (trRaw >= 0 && trRaw <= 40) effectiveTaxRate = +trRaw.toFixed(1);
    }

    // KIS API: 현재 시장 데이터
    let marketData = {};
    try {
      const priceInfo = await getPrice(stockCode);
      if (priceInfo && priceInfo.close > 0) {
        const sharesOutstanding = Math.round((priceInfo.marketCapEok * 100000000) / priceInfo.close);
        marketData = {
          currentPrice: priceInfo.close,
          marketCap: priceInfo.marketCapEok * 100000000,
          sharesOutstanding
        };
      }
    } catch (e) {
      console.warn('[Valuation] Market data fetch failed:', e.message);
    }

    res.json({
      success: true,
      financials: {
        revenue:         financials.revenue          / 100000000,
        operatingProfit: opIncome                    / 100000000,
        netIncome:       financials.ni_t             / 100000000,
        equity:          financials.equity           / 100000000,
        totalAssets:     financials.totalAssets      / 100000000,
        totalLiab:       financials.totalLiab        / 100000000,
        cash:            (financials.cash || 0)      / 100000000,
        ebitda:          estimatedEbitda             / 100000000,
        netDebt:         netDebtRaw                  / 100000000,
        year:            financials.year
      },
      // trendData는 { year, t, t1, t2 } 객체 → 차트용 배열로 변환
      trend: trendData ? [
        trendData.t2 != null ? { year: trendData.year - 2, netIncome: trendData.t2 } : null,
        trendData.t1 != null ? { year: trendData.year - 1, netIncome: trendData.t1 } : null,
        trendData.t  != null ? { year: trendData.year,     netIncome: trendData.t  } : null,
      ].filter(Boolean) : null,
      riskMetrics: {
        debtRatio:    financials.equity > 0
          ? (financials.totalLiab / financials.equity * 100).toFixed(1) : null,
        opMargin:     financials.revenue > 0
          ? (opIncome / financials.revenue * 100).toFixed(1) : null,
        currentRatio,
        netDebtRatio: financials.equity > 0
          ? (netDebtRaw / financials.equity * 100).toFixed(1) : null,
        // WACC 계산기용
        kd:              kdFromDart,       // 세전 부채비용 (%)
        effectiveTaxRate,                  // 실효세율 (%)
        beta:            calculatedBeta,   // 1년 일별 수익률 기반 β (null이면 업종 평균 사용)
      },
      market: marketData
    });
  } catch (error) {
    console.error('[Valuation API Error]:', error);
    res.status(500).json({ error: '데이터 조회 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /calculate — 가치평가 계산 실행
 */
router.post('/calculate', (req, res) => {
  try {
    const {
      ebitda, netIncome, netDebt, wacc, terminalGrowth, growthRate,
      industry, sharesOutstanding, currentPrice
    } = req.body;

    const nEbitda         = parseFloat(ebitda)          || 0;
    const nNetIncome      = parseFloat(netIncome)       || 0;
    const nNetDebt        = parseFloat(netDebt)         || 0;
    const nWacc           = parseFloat(wacc)            || 8.5;
    const nTerminalGrowth = parseFloat(terminalGrowth)  || 2.0;
    const nShares         = parseFloat(sharesOutstanding) || 0;
    const nPrice          = parseFloat(currentPrice)    || 0;
    // growthRate: 미입력(undefined)이면 서비스 내부 기본값 사용
    const nGrowthRate     = growthRate !== undefined && growthRate !== '' ? parseFloat(growthRate) : undefined;

    // 상대가치 먼저 계산 → fcfRatio 획득 → DCF에 전달
    const relativeResults = calculateMultiples({
      ebitda: nEbitda, netIncome: nNetIncome, netDebt: nNetDebt, industry
    });

    const dcfResults = calculateDCF({
      ebitda:         nEbitda,
      netDebt:        nNetDebt,
      wacc:           nWacc,
      terminalGrowth: nTerminalGrowth,
      growthRate:     nGrowthRate,
      fcfRatio:       relativeResults.fcfRatio   // 산업별 FCF 전환율 적용
    });

    if (dcfResults.error) return res.status(400).json({ error: dcfResults.error });

    const dcfWeight     = relativeResults.dcfWeight || 0.5;
    const finalEquityValue = Math.round(
      (dcfResults.equityValue * dcfWeight) + (relativeResults.averageValue * (1 - dcfWeight))
    );
    const targetPrice = nShares > 0 ? Math.round((finalEquityValue * 100000000) / nShares) : 0;

    // ── 민감도 분석: WACC ±2% (1% step) × g ±1% (0.5% step) ─────────────
    // 행: g 내림차순 (위=낙관), 열: WACC 오름차순 (좌=낙관)
    const waccOffsets = [-2, -1, 0, 1, 2];
    const gOffsets    = [1, 0.5, 0, -0.5, -1];

    const sensitivityMatrix = gOffsets.map(gOff =>
      waccOffsets.map(wOff => {
        const sw = nWacc + wOff;
        const sg = nTerminalGrowth + gOff;
        if (sg >= sw || sg < 0 || sw <= 0) return null;
        const sDcf = calculateDCF({
          ebitda: nEbitda, netDebt: nNetDebt, wacc: sw, terminalGrowth: sg,
          growthRate: nGrowthRate, fcfRatio: relativeResults.fcfRatio
        });
        if (sDcf.error) return null;
        const sFinalEV = Math.round(
          (sDcf.equityValue * relativeResults.dcfWeight) +
          (relativeResults.averageValue * (1 - relativeResults.dcfWeight))
        );
        return nShares > 0 ? Math.round((sFinalEV * 100000000) / nShares) : null;
      })
    );

    res.json({
      success: true,
      dcf: dcfResults,
      relative: relativeResults,
      summary: {
        finalEquityValue,
        targetPrice,
        upside: (nPrice > 0 && targetPrice > 0) ? ((targetPrice / nPrice) - 1) * 100 : 0
      },
      sensitivity: {
        waccLabels: waccOffsets.map(o => `${(nWacc + o).toFixed(1)}%`),
        gLabels:    gOffsets.map(o => `${(nTerminalGrowth + o).toFixed(1)}%`),
        matrix:     sensitivityMatrix
      }
    });
  } catch (error) {
    console.error('[Valuation Calculate Error]:', error);
    res.status(500).json({ error: '계산 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
