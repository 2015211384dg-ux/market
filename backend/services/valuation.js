/**
 * 가치평가 계산 서비스
 * - DCF (현금흐름할인법)
 * - 상대가치평가 (EV/EBITDA, PER)
 */

/**
 * DCF 가치 산정
 * @param {Object} params
 * @param {number} params.ebitda          - 기준 EBITDA (억원)
 * @param {number} params.netDebt         - 순차입금 (억원)
 * @param {number} params.wacc            - 가중평균자본비용 (%)
 * @param {number} params.terminalGrowth  - 영구성장률 (%)
 * @param {number} [params.growthRate]    - 단기 성장률 (%) — 1년차 성장률, terminalGrowth로 수렴
 *                                          미입력 시 terminalGrowth × 3 또는 최소 3% 사용
 * @param {number} [params.fcfRatio=0.60] - EBITDA 대비 FCF 비율 (산업별 상이)
 * @param {number} [params.forecastYears=5] - 추정 기간 (년)
 */
function calculateDCF({ ebitda, netDebt, wacc, terminalGrowth, growthRate, fcfRatio = 0.60, forecastYears = 5 }) {
  const r = wacc / 100;
  const g = terminalGrowth / 100;

  if (r <= g) return { error: 'WACC는 영구성장률보다 커야 합니다.' };

  // 단기 성장률: 미입력 시 영구성장률 × 3 (최소 3%) 적용
  const gShort = growthRate !== undefined ? growthRate / 100 : Math.max(g * 3, 0.03);

  // 산업별 FCF 전환율 적용 (기존 고정 70% → 파라미터화)
  let currentFCF = ebitda * fcfRatio;
  let pvOfFCF = 0;
  const projections = [];

  for (let i = 1; i <= forecastYears; i++) {
    // 단기 성장률 → 영구성장률 선형 수렴
    // i=1 → gShort 시작, i=forecastYears → g 도달
    const t = forecastYears > 1 ? (i - 1) / (forecastYears - 1) : 1;
    const yearGrowth = gShort + (g - gShort) * t;
    currentFCF *= (1 + yearGrowth);

    const discountFactor = Math.pow(1 + r, i);
    const pv = currentFCF / discountFactor;

    pvOfFCF += pv;
    projections.push({
      year: i,
      fcf: Math.round(currentFCF),
      pv: Math.round(pv),
      growth: (yearGrowth * 100).toFixed(1)
    });
  }

  // 터미널 밸류 (Gordon Growth Model)
  const terminalValue = (currentFCF * (1 + g)) / (r - g);
  const pvOfTV = terminalValue / Math.pow(1 + r, forecastYears);

  const enterpriseValue = pvOfFCF + pvOfTV;
  const equityValue = enterpriseValue - netDebt;

  return {
    enterpriseValue: Math.round(enterpriseValue),
    equityValue: Math.round(equityValue),
    pvOfFCF: Math.round(pvOfFCF),
    pvOfTV: Math.round(pvOfTV),
    terminalValue: Math.round(terminalValue),
    projections,
    usedGrowthRate: (gShort * 100).toFixed(1),
    usedFcfRatio: fcfRatio
  };
}

/**
 * 상대가치평가 (Multiples)
 * @param {Object} params
 * @param {number} params.ebitda
 * @param {number} params.netIncome
 * @param {number} params.netDebt
 * @param {string} params.industry
 */
function calculateMultiples({ ebitda, netIncome, netDebt, industry }) {
  // 산업별 평균 멀티플, DCF 가중치, FCF/EBITDA 전환율
  // fcfRatio: CAPEX·세금 차감 후 잉여현금흐름 / EBITDA
  //   소프트웨어 0.75 (낮은 CAPEX) ↔ 자동차·2차전지 0.48 (높은 CAPEX)
  const industryConfigs = {
    '반도체·전자부품': { evEbitda: 10.0, per: 15.0, dcfWeight: 0.6, fcfRatio: 0.55 },
    '바이오·제약':     { evEbitda: 25.0, per: 40.0, dcfWeight: 0.8, fcfRatio: 0.60 },
    '자동차·모빌리티': { evEbitda:  6.0, per:  9.0, dcfWeight: 0.5, fcfRatio: 0.48 },
    '2차전지·에너지':  { evEbitda: 20.0, per: 35.0, dcfWeight: 0.7, fcfRatio: 0.52 },
    '소프트웨어·AI':   { evEbitda: 18.0, per: 30.0, dcfWeight: 0.7, fcfRatio: 0.75 },
    '금융·은행·보험':  { evEbitda:  4.0, per:  6.0, dcfWeight: 0.3, fcfRatio: 0.65 },
    '화학·철강·소재':  { evEbitda:  7.0, per: 10.0, dcfWeight: 0.5, fcfRatio: 0.50 },
    '기계·건설·조선':  { evEbitda:  8.0, per: 12.0, dcfWeight: 0.5, fcfRatio: 0.48 },
    '유통·리테일':     { evEbitda:  7.0, per: 11.0, dcfWeight: 0.4, fcfRatio: 0.60 },
    '식음료·소비재':   { evEbitda:  9.0, per: 14.0, dcfWeight: 0.4, fcfRatio: 0.62 },
    '미디어·엔터·게임':{ evEbitda: 15.0, per: 25.0, dcfWeight: 0.6, fcfRatio: 0.65 },
    '기타':            { evEbitda: 10.0, per: 15.0, dcfWeight: 0.5, fcfRatio: 0.60 }
  };

  const config = industryConfigs[industry] || industryConfigs['기타'];

  const evBasedValue = (ebitda * config.evEbitda) - netDebt;
  const perBasedValue = netIncome * config.per;

  return {
    evEbitdaMultiple: config.evEbitda,
    perMultiple: config.per,
    dcfWeight: config.dcfWeight,
    fcfRatio: config.fcfRatio,       // DCF 계산 시 전달
    evBasedValue: Math.round(evBasedValue),
    perBasedValue: Math.round(perBasedValue),
    averageValue: Math.round((evBasedValue + perBasedValue) / 2)
  };
}

module.exports = {
  calculateDCF,
  calculateMultiples
};
