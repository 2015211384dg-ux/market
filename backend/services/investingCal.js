/**
 * Investing.com 경제 캘린더
 * 미국(country=5) + 한국(country=11) 중간~높은 중요도만 수집
 */
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 3600 }); // 1시간

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': 'https://www.investing.com/economic-calendar/',
  'Origin': 'https://www.investing.com',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
  'Content-Type': 'application/x-www-form-urlencoded',
};

// impact: bull1=low, bull2=medium, bull3=high (HTML 내 grayFullBullishIcon 개수)
function parseImpact(html) {
  const count = (html.match(/grayFullBullishIcon/g) || []).length;
  if (count >= 3) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

function cleanText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function parseCalendarHtml(html) {
  const events = [];
  // 각 이벤트 row 파싱
  const rowRegex = /<tr[^>]+class="[^"]*js-event-item[^"]*"[^>]+data-event-datetime="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const dt = rowMatch[1];           // "2026/04/07 12:15:00"
    const rowHtml = rowMatch[2];

    // 국가 플래그
    const countryMatch = rowHtml.match(/title="([^"]+)"\s+class="ceFlags/);
    const country = countryMatch?.[1] || '';
    const isUS = country.toLowerCase().includes('united states');
    const isKR = country.toLowerCase().includes('south korea') || country.toLowerCase().includes('korea');
    if (!isUS && !isKR) continue;

    // 중요도 (bull 아이콘 수)
    const impact = parseImpact(rowHtml);

    // 이벤트명
    const eventMatch = rowHtml.match(/<td[^>]+class="[^"]*\bevent\b[^"]*"[^>]*>([\s\S]*?)<\/td>/);
    const eventName = eventMatch ? cleanText(eventMatch[1]) : '';
    if (!eventName) continue;

    // 실제/예상/이전 값
    const actualMatch  = rowHtml.match(/class="[^"]*\bact\b[^"]*"[^>]*>([\s\S]*?)<\/td>/);
    const forecastMatch = rowHtml.match(/class="[^"]*\bfore\b[^"]*"[^>]*>([\s\S]*?)<\/td>/);
    const prevMatch    = rowHtml.match(/class="[^"]*\bprev\b[^"]*"[^>]*>([\s\S]*?)<\/td>/);

    const actual   = actualMatch   ? cleanText(actualMatch[1])   : null;
    const forecast = forecastMatch ? cleanText(forecastMatch[1]) : null;
    const previous = prevMatch     ? cleanText(prevMatch[1])     : null;

    // 날짜/시간 파싱 "2026/04/07 12:15:00"
    const [datePart, timePart] = dt.split(' ');
    const date = datePart?.replace(/\//g, '-');
    const time = timePart?.slice(0, 5);

    events.push({
      date,
      time,
      country: isUS ? 'US' : 'KR',
      currency: isUS ? 'USD' : 'KRW',
      event:    eventName,
      impact,
      actual:   actual && actual !== '&nbsp;' && actual !== '' ? actual : null,
      forecast: forecast && forecast !== '&nbsp;' && forecast !== '' ? forecast : null,
      previous: previous && previous !== '&nbsp;' && previous !== '' ? previous : null,
    });
  }

  return events;
}

async function getInvestingCalendar(country = 'both', days = 7) {
  const cacheKey = `inv_cal_${country}_${days}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const today = new Date();
    const from  = today.toISOString().split('T')[0];
    const to    = new Date(today.getTime() + days * 86400000).toISOString().split('T')[0];

    const body = new URLSearchParams({
      'country[]': ['5', '11'],       // US=5, Korea=11
      'importance[]': ['2', '3'],     // medium + high
      timeZone: '55',                 // Seoul KST
      currentTab: 'custom',
      limit_from: '0',
      dateFrom: from,
      dateTo: to,
    });
    // URLSearchParams 배열 처리
    const bodyStr = `country[]=5&country[]=11&importance[]=2&importance[]=3&timeZone=55&currentTab=custom&limit_from=0&dateFrom=${from}&dateTo=${to}`;

    const res = await axios.post(
      'https://www.investing.com/economic-calendar/Service/getCalendarFilteredData',
      bodyStr,
      { headers: HEADERS, timeout: 10000 }
    );

    const html = res.data?.data || '';
    const events = parseCalendarHtml(html);
    events.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

    cache.set(cacheKey, events);
    return events;
  } catch (e) {
    console.warn('[investingCal] failed:', e.message);
    return [];
  }
}

module.exports = { getInvestingCalendar };
