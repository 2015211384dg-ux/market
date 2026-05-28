/**
 * 재무 지표 메타데이터 + 업종별 벤치마크
 *
 * direction: 'lower' = 낮을수록 좋 / 'higher' = 높을수록 좋
 * good / warn: direction에 따른 임계값 (색상 표시용)
 *   lower → value <= good: green, value >= warn: red
 *   higher → value >= good: green, value <= warn: red
 */

export const METRIC_META = {
  pbr: {
    label: 'PBR',
    fullLabel: '주가순자산비율 (PBR)',
    unit: 'x',
    direction: 'lower',
    good: 1.0,
    warn: 3.0,
    desc: '현재가 ÷ 주당순자산(BPS). 자산 대비 주가 수준. 1.0 미만이면 장부가치보다 싸게 거래 중. DART 최신 분기 자본총계 기준.',
    gurus: [
      { name: '벤저민 그레이엄', note: '1.5x 이하를 저평가 기준으로 제시' },
      { name: '워런 버핏', note: '높은 ROE + 낮은 PBR 조합 선호' },
    ],
    naFor: ['Financial Services'],
  },
  per: {
    label: 'PER',
    fullLabel: '주가수익비율 (PER)',
    unit: 'x',
    direction: 'lower',
    good: 15,
    warn: 30,
    desc: '현재가 ÷ 주당순이익(TTM). 이익 대비 주가 수준을 나타냄. 낮을수록 이익에 비해 저렴.',
    gurus: [
      { name: '벤저민 그레이엄', note: '15x 이하를 저평가 기준' },
      { name: '워런 버핏', note: '업종 내 상대적 저PER 선호' },
    ],
    naFor: [],
  },
  evEbitda: {
    label: 'EV/EBITDA',
    fullLabel: '기업가치/EBITDA',
    unit: 'x',
    direction: 'lower',
    good: 10,
    warn: 20,
    desc: '기업가치(시총+순부채) ÷ EBITDA. 부채·세금·감가상각 무관하게 기업 수익성 비교 가능. PER보다 자본구조 왜곡이 적음.',
    gurus: [
      { name: '조엘 그린블랫', note: '매직포뮬러에서 EV/EBIT 사용 (EBITDA 유사)' },
    ],
    naFor: ['Financial Services'],
  },
  roe: {
    label: 'ROE',
    fullLabel: '자기자본이익률 (ROE)',
    unit: '%',
    direction: 'higher',
    good: 15,
    warn: 8,
    desc: '순이익 ÷ 자본총계. 주주 자본을 얼마나 효율적으로 활용하는지. 버핏이 가장 중시하는 지표.',
    gurus: [
      { name: '워런 버핏', note: '15% 이상을 지속하는 기업 선호' },
      { name: '피터 린치', note: '업종 평균 이상 지속 여부 확인' },
    ],
    naFor: [],
  },
  roa: {
    label: 'ROA',
    fullLabel: '총자산이익률 (ROA)',
    unit: '%',
    direction: 'higher',
    good: 8,
    warn: 3,
    desc: '순이익 ÷ 총자산. 자산을 얼마나 효율적으로 활용하는지. 부채 많은 금융주는 참고용.',
    gurus: [
      { name: '워런 버핏', note: '자산 집약 업종은 낮아도 정상' },
    ],
    naFor: [],
  },
  operatingMargin: {
    label: '영업이익률',
    fullLabel: '영업이익률',
    unit: '%',
    direction: 'higher',
    good: 15,
    warn: 5,
    desc: '영업이익 ÷ 매출액. 본업의 수익성. 높고 안정적일수록 경쟁우위(해자)가 있다는 신호.',
    gurus: [
      { name: '워런 버핏', note: '지속적으로 높은 영업이익률 = 경쟁우위' },
      { name: '필립 피셔', note: '장기적으로 마진이 개선되는 기업 선호' },
    ],
    naFor: ['Financial Services'],
  },
  netMargin: {
    label: '순이익률',
    fullLabel: '순이익률',
    unit: '%',
    direction: 'higher',
    good: 10,
    warn: 3,
    desc: '순이익 ÷ 매출액. 세금·이자 후 실제로 남는 이익 비율. 영업이익률과 함께 보면 재무비용 부담 파악 가능.',
    gurus: [
      { name: '필립 피셔', note: '높고 안정적인 순이익률 중시' },
    ],
    naFor: [],
  },
  debtToEquity: {
    label: '부채비율',
    fullLabel: '부채비율 (D/E)',
    unit: '',
    direction: 'lower',
    good: 30,
    warn: 100,
    desc: '총부채 ÷ 자본총계. 재무 건전성 지표. 자동차·항공 등 자본 집약 업종은 높아도 정상. 금융주는 N/A.',
    gurus: [
      { name: '벤저민 그레이엄', note: '부채비율 1(100) 이하 선호' },
      { name: '워런 버핏', note: '부채 없이도 수익 나는 기업 선호' },
    ],
    naFor: ['Financial Services'],
  },
  currentRatio: {
    label: '유동비율',
    fullLabel: '유동비율',
    unit: 'x',
    direction: 'higher',
    good: 2.0,
    warn: 1.0,
    desc: '유동자산 ÷ 유동부채. 단기 채무 상환 능력. 2.0 이상이면 안전, 1.0 미만이면 단기 유동성 위험.',
    gurus: [
      { name: '벤저민 그레이엄', note: '2.0 이상을 안전 기준으로 제시' },
    ],
    naFor: ['Financial Services'],
  },
  revenueGrowth: {
    label: '매출성장률',
    fullLabel: '매출성장률 (YoY)',
    unit: '%',
    direction: 'higher',
    good: 15,
    warn: 0,
    desc: '전년 동기 대비 매출 증가율. 성장성의 핵심 지표. 단, 수익성 없이 성장만 하는 경우는 주의.',
    gurus: [
      { name: '피터 린치', note: '업종 평균 이상의 성장률 지속 기업 선호' },
      { name: '필립 피셔', note: '장기 매출 성장 가시성 중시' },
    ],
    naFor: [],
  },
  earningsGrowth: {
    label: '이익성장률',
    fullLabel: '이익성장률 (YoY)',
    unit: '%',
    direction: 'higher',
    good: 15,
    warn: 0,
    desc: '전년 동기 대비 순이익 증가율. 매출성장과 함께 봐야 진짜 성장인지 판단 가능.',
    gurus: [
      { name: '피터 린치', note: 'PEG(PER/이익성장률) < 1이면 저평가' },
    ],
    naFor: [],
  },
  fcfYield: {
    label: 'FCF 수익률',
    fullLabel: '잉여현금흐름 수익률 (FCF Yield)',
    unit: '%',
    direction: 'higher',
    good: 5,
    warn: 2,
    desc: '잉여현금흐름(FCF) ÷ 시가총액. 실제로 기업이 벌어들이는 현금의 비율. 회계 이익보다 조작이 어려워 버핏이 중시.',
    gurus: [
      { name: '워런 버핏', note: '현금흐름 중심 기업가치 평가' },
      { name: '레이 달리오', note: '현금창출 능력 기반 투자' },
    ],
    naFor: [],
  },
  dividendYield: {
    label: '배당수익률',
    fullLabel: '배당수익률',
    unit: '%',
    direction: 'higher',
    good: 3,
    warn: 0,
    desc: '연간 배당금 ÷ 현재가. 높을수록 좋지만, 지속 가능성이 더 중요. 배당컷 리스크 항상 확인 필요.',
    gurus: [
      { name: '벤저민 그레이엄', note: '배당지급 기록의 지속성 중시' },
    ],
    naFor: [],
  },
};

/**
 * 업종별 벤치마크 (한국 시장 기준 중간값)
 * Yahoo Finance sector명 기준
 */
export const SECTOR_BENCHMARKS = {
  Technology: {
    label: '기술/IT',
    pbr:             { avg: 2.5,  range: [1.5, 5.0] },
    per:             { avg: 28,   range: [18, 45]  },
    evEbitda:        { avg: 18,   range: [12, 28]  },
    roe:             { avg: 17,   range: [12, 25]  },
    roa:             { avg: 9,    range: [5, 15]   },
    operatingMargin: { avg: 18,   range: [10, 30]  },
    netMargin:       { avg: 13,   range: [7, 22]   },
    debtToEquity:    { avg: 20,   range: [0, 50]   },
    currentRatio:    { avg: 2.2,  range: [1.5, 3.5]},
    revenueGrowth:   { avg: 12,   range: [5, 25]   },
    earningsGrowth:  { avg: 15,   range: [5, 30]   },
    fcfYield:        { avg: 4,    range: [2, 8]    },
    dividendYield:   { avg: 1.0,  range: [0, 2.5]  },
  },
  'Financial Services': {
    label: '금융',
    pbr:             { avg: 0.6,  range: [0.3, 1.0] },
    per:             { avg: 9,    range: [6, 13]   },
    evEbitda:        { avg: null, range: null       },
    roe:             { avg: 10,   range: [7, 14]   },
    roa:             { avg: 0.8,  range: [0.5, 1.2]},
    operatingMargin: { avg: null, range: null       },
    netMargin:       { avg: 22,   range: [15, 32]  },
    debtToEquity:    { avg: null, range: null       },
    currentRatio:    { avg: null, range: null       },
    revenueGrowth:   { avg: 8,    range: [3, 15]   },
    earningsGrowth:  { avg: 8,    range: [3, 15]   },
    fcfYield:        { avg: 5,    range: [2, 9]    },
    dividendYield:   { avg: 3.5,  range: [2, 6]    },
  },
  Healthcare: {
    label: '헬스케어/바이오',
    pbr:             { avg: 3.5,  range: [1.5, 8.0] },
    per:             { avg: 45,   range: [25, 80]  },
    evEbitda:        { avg: 28,   range: [15, 50]  },
    roe:             { avg: 10,   range: [5, 20]   },
    roa:             { avg: 5,    range: [2, 12]   },
    operatingMargin: { avg: 12,   range: [5, 25]   },
    netMargin:       { avg: 8,    range: [3, 20]   },
    debtToEquity:    { avg: 30,   range: [0, 80]   },
    currentRatio:    { avg: 2.5,  range: [1.5, 4.0]},
    revenueGrowth:   { avg: 15,   range: [8, 30]   },
    earningsGrowth:  { avg: 18,   range: [5, 40]   },
    fcfYield:        { avg: 3,    range: [1, 7]    },
    dividendYield:   { avg: 0.5,  range: [0, 1.5]  },
  },
  'Consumer Cyclical': {
    label: '경기소비재/자동차',
    pbr:             { avg: 1.2,  range: [0.7, 2.0] },
    per:             { avg: 12,   range: [7, 18]   },
    evEbitda:        { avg: 10,   range: [6, 16]   },
    roe:             { avg: 10,   range: [6, 16]   },
    roa:             { avg: 4,    range: [2, 8]    },
    operatingMargin: { avg: 7,    range: [3, 12]   },
    netMargin:       { avg: 5,    range: [2, 9]    },
    debtToEquity:    { avg: 120,  range: [60, 200] },
    currentRatio:    { avg: 1.3,  range: [1.0, 1.8]},
    revenueGrowth:   { avg: 7,    range: [2, 15]   },
    earningsGrowth:  { avg: 8,    range: [0, 20]   },
    fcfYield:        { avg: 4,    range: [2, 7]    },
    dividendYield:   { avg: 2.5,  range: [1, 5]    },
  },
  'Consumer Defensive': {
    label: '필수소비재',
    pbr:             { avg: 1.8,  range: [1.0, 3.0] },
    per:             { avg: 18,   range: [12, 25]  },
    evEbitda:        { avg: 13,   range: [9, 18]   },
    roe:             { avg: 14,   range: [9, 20]   },
    roa:             { avg: 7,    range: [4, 12]   },
    operatingMargin: { avg: 9,    range: [5, 15]   },
    netMargin:       { avg: 6,    range: [3, 11]   },
    debtToEquity:    { avg: 50,   range: [20, 100] },
    currentRatio:    { avg: 1.4,  range: [1.0, 2.0]},
    revenueGrowth:   { avg: 5,    range: [2, 10]   },
    earningsGrowth:  { avg: 6,    range: [2, 12]   },
    fcfYield:        { avg: 4.5,  range: [2.5, 7]  },
    dividendYield:   { avg: 2.8,  range: [1.5, 5]  },
  },
  Industrials: {
    label: '산업재',
    pbr:             { avg: 1.3,  range: [0.8, 2.2] },
    per:             { avg: 16,   range: [10, 24]  },
    evEbitda:        { avg: 12,   range: [8, 18]   },
    roe:             { avg: 11,   range: [7, 17]   },
    roa:             { avg: 5,    range: [3, 9]    },
    operatingMargin: { avg: 8,    range: [4, 14]   },
    netMargin:       { avg: 5,    range: [2, 10]   },
    debtToEquity:    { avg: 60,   range: [20, 130] },
    currentRatio:    { avg: 1.4,  range: [1.0, 2.0]},
    revenueGrowth:   { avg: 7,    range: [2, 14]   },
    earningsGrowth:  { avg: 8,    range: [2, 18]   },
    fcfYield:        { avg: 4,    range: [2, 7]    },
    dividendYield:   { avg: 2.0,  range: [0.5, 4]  },
  },
  Energy: {
    label: '에너지',
    pbr:             { avg: 1.0,  range: [0.5, 1.8] },
    per:             { avg: 14,   range: [8, 22]   },
    evEbitda:        { avg: 10,   range: [6, 16]   },
    roe:             { avg: 10,   range: [5, 18]   },
    roa:             { avg: 4,    range: [2, 8]    },
    operatingMargin: { avg: 10,   range: [4, 18]   },
    netMargin:       { avg: 7,    range: [2, 14]   },
    debtToEquity:    { avg: 70,   range: [30, 150] },
    currentRatio:    { avg: 1.2,  range: [0.8, 1.8]},
    revenueGrowth:   { avg: 5,    range: [-5, 20]  },
    earningsGrowth:  { avg: 5,    range: [-20, 30] },
    fcfYield:        { avg: 6,    range: [3, 12]   },
    dividendYield:   { avg: 3.0,  range: [1, 6]    },
  },
  'Basic Materials': {
    label: '소재/화학',
    pbr:             { avg: 1.1,  range: [0.6, 2.0] },
    per:             { avg: 14,   range: [8, 22]   },
    evEbitda:        { avg: 9,    range: [5, 15]   },
    roe:             { avg: 10,   range: [5, 17]   },
    roa:             { avg: 5,    range: [2, 9]    },
    operatingMargin: { avg: 9,    range: [4, 16]   },
    netMargin:       { avg: 6,    range: [2, 12]   },
    debtToEquity:    { avg: 55,   range: [20, 110] },
    currentRatio:    { avg: 1.5,  range: [1.0, 2.2]},
    revenueGrowth:   { avg: 6,    range: [-5, 18]  },
    earningsGrowth:  { avg: 6,    range: [-10, 25] },
    fcfYield:        { avg: 4.5,  range: [2, 8]    },
    dividendYield:   { avg: 2.5,  range: [1, 5]    },
  },
  'Communication Services': {
    label: '통신/미디어',
    pbr:             { avg: 1.8,  range: [1.0, 3.5] },
    per:             { avg: 20,   range: [12, 32]  },
    evEbitda:        { avg: 12,   range: [8, 20]   },
    roe:             { avg: 12,   range: [7, 20]   },
    roa:             { avg: 5,    range: [2, 10]   },
    operatingMargin: { avg: 14,   range: [8, 25]   },
    netMargin:       { avg: 9,    range: [4, 18]   },
    debtToEquity:    { avg: 45,   range: [15, 100] },
    currentRatio:    { avg: 1.3,  range: [0.8, 2.0]},
    revenueGrowth:   { avg: 8,    range: [3, 18]   },
    earningsGrowth:  { avg: 10,   range: [3, 22]   },
    fcfYield:        { avg: 4,    range: [2, 8]    },
    dividendYield:   { avg: 1.5,  range: [0, 3.5]  },
  },
};

/** Yahoo Finance sector → SECTOR_BENCHMARKS 키 매핑 */
export function getSectorBenchmark(sector) {
  return SECTOR_BENCHMARKS[sector] || null;
}

/** 지표값의 색상 클래스 반환 */
export function getMetricColorClass(metricKey, value) {
  const meta = METRIC_META[metricKey];
  if (!meta || value == null) return 'text-gray-400';

  if (meta.direction === 'lower') {
    if (value <= meta.good) return 'text-green-400';
    if (value >= meta.warn) return 'text-red-400';
    return 'text-yellow-400';
  } else {
    if (value >= meta.good) return 'text-green-400';
    if (value <= meta.warn) return 'text-red-400';
    return 'text-yellow-400';
  }
}
