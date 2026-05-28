const fs   = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CACHE_FILE = path.join(__dirname, '../data/interpretations.json');

// ─── 파일 캐시 로드/저장 ──────────────────────────────────────────────────────
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch { /* 파싱 오류 시 빈 캐시 */ }
  return {};
}

function saveCache(cache) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.error('[interpretations] 캐시 저장 실패:', e.message);
  }
}

// ─── 캐시 키: 지표ID + 최신 관측일 ──────────────────────────────────────────
function cacheKey(seriesId, latestDate) {
  return `${seriesId}__${latestDate}`;
}

// ─── Claude API 호출 ─────────────────────────────────────────────────────────
async function callClaude(indicator, history) {
  const values = history.map(h => `${h.date}: ${h.value}`).join('\n');
  const suffix = indicator.display === '%' ? '%' : indicator.display === 'pts' ? 'pt' : '';

  const thresholds = [];
  if (indicator.target    !== undefined) thresholds.push(`목표치: ${indicator.target}${suffix}`);
  if (indicator.bearAbove !== undefined) thresholds.push(`경고(↑): ${indicator.bearAbove}${suffix}`);
  if (indicator.bearBelow !== undefined) thresholds.push(`경고(↓): ${indicator.bearBelow}${suffix}`);
  if (indicator.bullAbove !== undefined) thresholds.push(`우호(↑): ${indicator.bullAbove}${suffix}`);
  if (indicator.bullBelow !== undefined) thresholds.push(`우호(↓): ${indicator.bullBelow}${suffix}`);

  const current = history[history.length - 1];
  const prev    = history[history.length - 2];

  const prompt = `다음은 미국 경제지표 "${indicator.nameKo}" (${indicator.name})의 최근 데이터입니다.

지표 정보:
- 카테고리: ${indicator.category}
- 주기: ${indicator.freq}
- 단위: ${indicator.display}
- 기준선: ${thresholds.join(', ') || '없음'}

최근 데이터 (오래된 순):
${values}

현재값: ${current?.value}${suffix} (직전: ${prev?.value ?? 'N/A'}${suffix}, 최신 관측일: ${current?.date})

위 데이터를 바탕으로 다음을 한국어로 작성하세요 (총 4~6문장):
1. 현재 수준의 의미 (기준선/목표치 대비 어디에 위치하는지)
2. 최근 추세 (상승/하락/횡보, 속도)
3. 투자 시사점 (주식·채권·섹터에 미치는 영향)
4. 향후 주목할 변화 포인트

간결하고 구체적으로, 수치를 직접 인용하여 작성하세요.`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001', // 짧은 분석 → Haiku(저렴)
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  return msg.content[0].text;
}

// ─── 메인 함수: 캐시 확인 → 필요시 Claude 호출 ───────────────────────────────
async function getInterpretation(indicator, history) {
  if (!history || history.length === 0) return null;

  const latestDate = history[history.length - 1].date;
  const key        = cacheKey(indicator.id, latestDate);
  const cache      = loadCache();

  // 캐시 히트 → 즉시 반환
  if (cache[key]) {
    console.log(`[interpretations] 캐시 히트: ${indicator.id} (${latestDate})`);
    return cache[key];
  }

  if (!process.env.ANTHROPIC_API_KEY) return null;

  console.log(`[interpretations] Claude 호출: ${indicator.id} (${latestDate})`);
  try {
    const text = await callClaude(indicator, history);
    cache[key]  = text;
    saveCache(cache);
    return text;
  } catch (e) {
    console.error(`[interpretations] Claude 오류 (${indicator.id}):`, e.message);
    return null;
  }
}

// ─── 일괄 생성 (최초 세팅용) ─────────────────────────────────────────────────
async function generateAllInterpretations(indicatorHistoryPairs) {
  const results = { success: 0, cached: 0, failed: 0 };
  const cache   = loadCache();

  for (const { indicator, history } of indicatorHistoryPairs) {
    if (!history || history.length === 0) continue;
    const latestDate = history[history.length - 1].date;
    const key        = cacheKey(indicator.id, latestDate);

    if (cache[key]) {
      results.cached++;
      continue;
    }

    if (!process.env.ANTHROPIC_API_KEY) break;

    try {
      console.log(`[interpretations] 일괄 생성: ${indicator.id}`);
      const text = await callClaude(indicator, history);
      cache[key] = text;
      results.success++;
      // Rate limit 방지 (Haiku는 빠르지만 과부하 방지)
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`[interpretations] 실패 (${indicator.id}):`, e.message);
      results.failed++;
    }
  }

  saveCache(cache);
  return results;
}

module.exports = { getInterpretation, generateAllInterpretations };
