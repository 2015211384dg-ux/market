/**
 * PMI 자동 수집 서비스
 * ISM Manufacturing / Services PMI를 Google News RSS 헤드라인에서 파싱
 * PMI는 월 1회 발표 → 7일 캐시
 */
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const NodeCache = require('node-cache');
const pmiHistory = require('./pmiHistoryStore');

const parser = new XMLParser({ ignoreAttributes: false, ignoreDeclaration: true });
const cache = new NodeCache({ stdTTL: 7 * 86400 }); // 7일

// PMI 값 추출 정규식 (30~70 범위)
const PMI_REGEX = /pmi[®™]?\s*(?:at|:)\s*(\d{2}(?:\.\d{1,2})?)|comes?\s+in\s+at\s+(\d{2}(?:\.\d{1,2})?)\s*(?:vs|%|,)/i;

function extractPMI(text) {
  const m = text.match(PMI_REGEX);
  const raw = m?.[1] ?? m?.[2];
  if (!raw) return null;
  const val = parseFloat(raw);
  return val >= 30 && val <= 75 ? val : null;
}

async function fetchPMI(query, cacheKey, mustInclude = []) {
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
    const parsed = parser.parse(res.data);
    let items = parsed?.rss?.channel?.item || [];
    if (!Array.isArray(items)) items = [items];

    for (const item of items.slice(0, 10)) {
      const title = item.title || '';
      const lower = title.toLowerCase();
      // 관련 없는 기사 필터링
      if (mustInclude.length && !mustInclude.some(kw => lower.includes(kw))) continue;
      const val = extractPMI(title);
      if (val !== null) {
        const result = {
          value:  val,
          source: title.split(' - ').pop()?.trim() || '',
          date:   item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : null,
          headline: title,
        };
        cache.set(cacheKey, result);
        return result;
      }
    }
  } catch (e) {
    console.warn(`[pmi] fetch failed for "${query}":`, e.message);
  }
  return null;
}

async function getAllPMI() {
  const [mfg, svc, china] = await Promise.allSettled([
    fetchPMI('ISM Manufacturing PMI index report', 'pmi_mfg', ['manufactur']),
    fetchPMI('ISM Services PMI index report',      'pmi_svc', ['service', 'non-manufactur', 'nonmanufactur']),
    fetchPMI('Caixin China Manufacturing PMI',      'pmi_china', ['china', 'caixin']),
  ]);

  const result = {
    manufacturing: mfg.status === 'fulfilled' ? mfg.value : null,
    services:      svc.status === 'fulfilled' ? svc.value : null,
    china:         china.status === 'fulfilled' ? china.value : null,
  };

  // PMI는 항상 다음달 초(1~10일)에 발표 → 릴리즈 날짜를 데이터월(전월)로 정규화
  function toDataMonth(releaseDate) {
    if (!releaseDate) return releaseDate;
    const d = new Date(releaseDate);
    if (d.getDate() <= 10) d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  // 히스토리 파일에 누적 저장 (새 달 데이터만)
  if (result.manufacturing?.date && result.manufacturing?.value != null)
    pmiHistory.append('ISM_MFG',    toDataMonth(result.manufacturing.date), result.manufacturing.value);
  if (result.services?.date && result.services?.value != null)
    pmiHistory.append('ISM_SVC',    toDataMonth(result.services.date),      result.services.value);
  if (result.china?.date && result.china?.value != null)
    pmiHistory.append('CAIXIN_PMI', toDataMonth(result.china.date),         result.china.value);

  return result;
}

module.exports = { getAllPMI };
