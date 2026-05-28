const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function fmt(val, decimals = 2) {
  if (val == null || isNaN(val)) return 'N/A';
  return Number(val).toFixed(decimals);
}

function formatIndices(indices) {
  return indices
    .map(i => `  ${i.symbol}: ${fmt(i.c)} (${i.dp >= 0 ? '+' : ''}${fmt(i.dp)}%)`)
    .join('\n');
}

function formatSectors(sectors) {
  return sectors
    .map(s => `  ${s.name} (${s.symbol}): ${s.dp >= 0 ? '+' : ''}${fmt(s.dp)}%`)
    .join('\n');
}

function formatNews(news) {
  return news
    .slice(0, 10)
    .map((n, i) => `  ${i + 1}. ${n.headline}`)
    .join('\n');
}

function formatScreener(stocks) {
  if (!stocks || stocks.length === 0) return '  No stocks matched screening criteria today.';
  return stocks
    .slice(0, 8)
    .map(s => `  ${s.symbol}: RSI=${fmt(s.rsi, 1)}, 60d Range=${fmt(s.rangePct, 1)}%, Price=$${fmt(s.currentPrice)}`)
    .join('\n');
}

function formatMarketMacro(macro) {
  const lines = [];
  if (macro.vix)     lines.push(`  VIX: ${fmt(macro.vix.c)}`);
  if (macro.dxy)     lines.push(`  달러(UUP): ${fmt(macro.dxy.c)} (${macro.dxy.dp >= 0 ? '+' : ''}${fmt(macro.dxy.dp)}%)`);
  if (macro.gold)    lines.push(`  금(GLD): $${fmt(macro.gold.c)} (${macro.gold.dp >= 0 ? '+' : ''}${fmt(macro.gold.dp)}%)`);
  if (macro.oil)     lines.push(`  원유(USO): $${fmt(macro.oil.c)} (${macro.oil.dp >= 0 ? '+' : ''}${fmt(macro.oil.dp)}%)`);
  if (macro.tlt)     lines.push(`  20Y 국채(TLT): ${fmt(macro.tlt.c)} (${macro.tlt.dp >= 0 ? '+' : ''}${fmt(macro.tlt.dp)}%)`);
  if (macro.twoYear) lines.push(`  2Y 국채(SHY): ${fmt(macro.twoYear.c)} (${macro.twoYear.dp >= 0 ? '+' : ''}${fmt(macro.twoYear.dp)}%)`);
  return lines.join('\n') || '  시장 매크로 데이터 없음';
}

// ─── FRED 경제지표 포맷 ───────────────────────────────────────────────────────
function formatFredData(fredData) {
  if (!fredData) return '  FRED 데이터 없음';

  const CATEGORY_NAMES = {
    inflation: '📈 인플레이션',
    monetary:  '🏦 통화정책',
    bonds:     '📊 금리/채권',
    labor:     '👷 고용',
    growth:    '🏭 성장',
    consumer:  '🛒 소비',
    housing:   '🏠 주택',
  };

  const lines = [];

  for (const [cat, name] of Object.entries(CATEGORY_NAMES)) {
    const indicators = fredData[cat];
    if (!indicators || indicators.length === 0) continue;

    const validInds = indicators.filter(i => i.value !== null && i.value !== undefined);
    if (validInds.length === 0) continue;

    lines.push(`\n  [${name}]`);
    validInds.forEach(ind => {
      const val = `${fmt(ind.value)}${ind.display === '%' ? '%' : ind.display === 'pts' ? 'pts' : ''}`;
      const chg = ind.change !== null && ind.change !== undefined
        ? ` (전기비 ${ind.change >= 0 ? '+' : ''}${fmt(ind.change, 3)})`
        : '';
      const date = ind.date ? ` [${ind.date.slice(0, 7)}]` : '';
      // 목표 대비 상태
      let signal = '';
      if (ind.target !== undefined && ind.value !== null) {
        const diff = (ind.value - ind.target).toFixed(2);
        signal = ` ← 목표(${ind.target}%) 대비 ${diff >= 0 ? '+' : ''}${diff}%p`;
      }
      lines.push(`    ${ind.nameKo}: ${val}${chg}${date}${signal}`);
    });
  }

  return lines.join('\n') || '  FRED 지표 없음 (API 키 확인 필요)';
}

// ─── 메인 생성 함수 ───────────────────────────────────────────────────────────
async function generateMarketInsights({ indices, sectors, news, screenerResults, macro, fredData, pmi }) {
  const today = new Date().toLocaleDateString('ko-KR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // 장단기 스프레드 계산
  let yieldSpreadLine = '';
  const bondInds = fredData?.bonds || [];
  const spread10y2y = bondInds.find(i => i.id === 'T10Y2Y');
  if (spread10y2y?.value != null) {
    const s = spread10y2y.value;
    yieldSpreadLine = `  10Y-2Y 스프레드: ${s >= 0 ? '+' : ''}${fmt(s)}% (${s < 0 ? '⚠ 역전 — 경기침체 신호' : '정상'})`;
  }

  // Fed 기준금리
  const monetaryInds = fredData?.monetary || [];
  const fedRate = monetaryInds.find(i => i.id === 'DFF');

  // CPI/PCE 핵심 요약
  const inflationInds = fredData?.inflation || [];
  const cpi = inflationInds.find(i => i.id === 'CPIAUCSL');
  const corePce = inflationInds.find(i => i.id === 'PCEPILFE');

  // 노동 핵심
  const laborInds = fredData?.labor || [];
  const unemployment = laborInds.find(i => i.id === 'UNRATE');
  const nfp = laborInds.find(i => i.id === 'PAYEMS');

  const hasFredData = fredData && Object.keys(fredData).some(k => (fredData[k] || []).some(i => i.value !== null));

  // PMI 요약 라인
  const pmiLines = [];
  if (pmi?.manufacturing?.value != null)
    pmiLines.push(`  ISM 제조업 PMI: ${pmi.manufacturing.value} (${pmi.manufacturing.value >= 50 ? '확장' : '수축'}) [${pmi.manufacturing.date || '최근'}]`);
  if (pmi?.services?.value != null)
    pmiLines.push(`  ISM 서비스 PMI: ${pmi.services.value} (${pmi.services.value >= 50 ? '확장' : '수축'}) [${pmi.services.date || '최근'}]`);
  if (pmi?.china?.value != null)
    pmiLines.push(`  중국 Caixin PMI: ${pmi.china.value} (${pmi.china.value >= 50 ? '확장' : '수축'}) [${pmi.china.date || '최근'}]`);
  const pmiSection = pmiLines.length > 0
    ? `\n═══ PMI 경기 선행지표 ═══\n${pmiLines.join('\n')}\n` : '';

  const prompt = `당신은 기관 투자자를 위한 시니어 매크로 이코노미스트 겸 주식 시장 애널리스트입니다. 오늘은 ${today}입니다.

아래의 실시간 시장 데이터와 경제지표를 바탕으로 종합적인 모닝 브리핑을 한국어로 작성하세요.

═══ 주요 지수 ═══
${formatIndices(indices)}

═══ 섹터 성과 ═══
${formatSectors(sectors)}

═══ 시장 매크로 (실시간 시세) ═══
${formatMarketMacro(macro)}
${yieldSpreadLine}
${pmiSection}

${hasFredData ? `═══ FRED 경제지표 (최신 발표 기준) ═══
${formatFredData(fredData)}
` : ''}
═══ 주요 뉴스 ═══
${formatNews(news)}

═══ 과매도 스크리닝 결과 (RSI 20–40, 60일 등락폭 ≥50%) ═══
${formatScreener(screenerResults)}

다음 형식으로 브리핑을 작성하세요. 데이터에 근거한 구체적이고 실행 가능한 인사이트를 제공하세요:

## 시장 현황
[현재 리스크온/오프 분위기, 지배적 내러티브, SPY/QQQ 핵심 레벨 — 2~3문장]

## 매크로 환경
${hasFredData ? `[인플레이션(CPI ${cpi?.value != null ? fmt(cpi.value) + '%, 목표 2% 대비' : 'N/A'}, Core PCE ${corePce?.value != null ? fmt(corePce.value) + '%' : 'N/A'}), 연준 기준금리(${fedRate?.value != null ? fmt(fedRate.value) + '%' : 'N/A'}), 고용(실업률 ${unemployment?.value != null ? fmt(unemployment.value) + '%' : 'N/A'}, NFP ${nfp?.value != null ? fmt(nfp.value) + 'K' : 'N/A'}), 수익률 곡선 등 주요 경제지표를 종합 해석 — 3~4문장]` : '[VIX 레짐, 수익률 곡선, 달러, 원자재를 바탕으로 매크로 환경 해석 — 2~3문장]'}

## 경제지표 해석
${hasFredData ? `[현재 인플레이션 추이가 연준 목표 대비 어디에 있는지, 노동시장 긴축/완화 여부, GDP/PMI 등 성장 신호, 소비자 심리, 주택 시장 상태를 종합하여 연준의 다음 행동(금리 인상/동결/인하) 가능성을 분석 — 3~4문장]` : '[경제지표 데이터 없음 (FRED API 키 설정 필요)]'}

## 섹터 로테이션
[선도/부진 섹터와 그 시사점 — 1~2문장]

## 뉴스 촉매제
[상위 2~3개 뉴스와 시장 영향 — 구체적으로]

## 과매도 관심 종목
[스크리너 상위 3~4개 종목의 평균회귀 관점 분석 및 진입 확인 신호]

## 오늘의 핵심 리스크
[현재 시나리오를 뒤흔들 수 있는 3가지 구체적 리스크 — 불릿 리스트]

총 700단어 이내로 작성하세요.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1800,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text;
}

module.exports = { generateMarketInsights };
