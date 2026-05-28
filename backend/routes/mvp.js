const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../data/mvp-cache.json');
const BASE_URL = 'https://itooza.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ─── 캐시 파일 읽기/쓰기 ──────────────────────────────────────────────────────
function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {}
  return { status: 'empty', articles: [], fetchedAt: null, progress: { current: 0, total: 0 } };
}

function writeCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── 날짜 파싱 "26.04/08" → "2026-04-08" ────────────────────────────────────
function parseItoozaDate(str) {
  const m = str.trim().match(/(\d{2})\.(\d{2})\/(\d{2})/);
  if (!m) return null;
  return `20${m[1]}-${m[2]}-${m[3]}`;
}

// ─── 뉴스 목록 페이지에서 MVP 기사 링크 수집 ─────────────────────────────────
async function fetchMvpLinks() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoff = oneYearAgo.toISOString().slice(0, 10);

  const allLinks = [];
  let page = 1;

  while (page <= 200) {
    const url = `${BASE_URL}/newslist?s_type=1&news_search=MVP&page=${page}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const items = $('a[href*="newsview"]').toArray();
    if (items.length === 0) break;

    let hitCutoff = false;
    for (const el of items) {
      const title = $(el).find('.title').text().trim();
      const dateStr = $(el).find('.date').text().trim();
      const href = $(el).attr('href');
      if (!title || !href) continue;

      const date = parseItoozaDate(dateStr);
      if (!date) continue;
      if (date < cutoff) { hitCutoff = true; break; }

      if (title.includes('MVP') && title.includes('20')) {
        allLinks.push({ title: title.replace(/\s+/g, ' ').trim(), date, url: `${BASE_URL}${href}` });
      }
    }
    if (hitCutoff) break;
    page++;
    await new Promise(r => setTimeout(r, 150));
  }

  return allLinks;
}

// ─── 기사 페이지에서 MVP 표 파싱 ─────────────────────────────────────────────
async function fetchMvpTable(articleUrl) {
  const res = await axios.get(articleUrl, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(res.data);

  let headers = [], rows = [];

  $('table').each((_, table) => {
    const headerRows = $(table).find('thead tr, tr:has(th)').toArray();
    if (!headerRows.length) return;

    const firstRowText = $(headerRows[0]).text();
    if (!firstRowText.includes('종목') && !firstRowText.includes('MVP') && !firstRowText.includes('순위')) return;

    const topHeaders = [];
    $(headerRows[0]).find('th, td').each((_, th) => {
      const colspan = parseInt($(th).attr('colspan') || '1');
      const text = $(th).text().trim();
      for (let i = 0; i < colspan; i++) topHeaders.push(text);
    });

    if (headerRows.length >= 2) {
      const sub = [];
      $(headerRows[1]).find('th, td').each((_, th) => sub.push($(th).text().trim()));
      let si = 0;
      headers = topHeaders.map(h =>
        (h.includes('항목') && h.includes('점수')) || h.includes('투자지표')
          ? (si < sub.length ? sub[si++] : h)
          : h
      );
    } else {
      headers = topHeaders;
    }

    $(table).find('tbody tr').each((_, tr) => {
      const cells = [];
      $(tr).find('td').each((_, td) => cells.push($(td).text().trim()));
      if (cells.length) rows.push(cells);
    });
    return false;
  });

  return { headers, rows };
}

// ─── 백그라운드 전체 수집 ─────────────────────────────────────────────────────
let fetchingNow = false;

async function runFullFetch() {
  if (fetchingNow) return;
  fetchingNow = true;
  console.log('[MVP] 전체 수집 시작');

  try {
    // 1. 링크 목록 수집
    const links = await fetchMvpLinks();
    console.log(`[MVP] 링크 ${links.length}개 수집 완료`);

    // 기존 캐시에 이미 있는 URL 제외
    const existing = readCache();
    const existingUrls = new Set((existing.articles || []).map(a => a.url));
    const toFetch = links.filter(l => !existingUrls.has(l.url));

    const cache = {
      status: 'fetching',
      fetchedAt: existing.fetchedAt,
      progress: { current: 0, total: toFetch.length },
      articles: existing.articles || [],
    };
    writeCache(cache);

    // 2. 테이블 수집 (배치 10개씩 병렬)
    const BATCH = 10;
    for (let i = 0; i < toFetch.length; i += BATCH) {
      const batch = toFetch.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async link => {
          const { headers, rows } = await fetchMvpTable(link.url);
          return { ...link, headers, rows };
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.rows?.length) {
          cache.articles.push(r.value);
        }
      }

      // 날짜 내림차순 정렬 후 저장
      cache.articles.sort((a, b) => b.date.localeCompare(a.date));
      cache.progress.current = Math.min(i + BATCH, toFetch.length);
      writeCache(cache);
      console.log(`[MVP] ${cache.progress.current}/${toFetch.length} 완료`);

      await new Promise(r => setTimeout(r, 200));
    }

    cache.status = 'complete';
    cache.fetchedAt = new Date().toISOString();
    writeCache(cache);
    console.log('[MVP] 전체 수집 완료');
  } catch (err) {
    console.error('[MVP] 수집 오류:', err.message);
    const cache = readCache();
    cache.status = 'error';
    writeCache(cache);
  } finally {
    fetchingNow = false;
  }
}

// ─── 서버 시작 시 자동 수집 ───────────────────────────────────────────────────
(function autoFetchOnStart() {
  const cache = readCache();
  const isStale = !cache.fetchedAt ||
    (Date.now() - new Date(cache.fetchedAt).getTime()) > 12 * 60 * 60 * 1000; // 12시간

  if (cache.status !== 'complete' || isStale) {
    setTimeout(() => runFullFetch(), 3000); // 서버 안정화 후 시작
  }
})();

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/mvp/all — 전체 캐시 반환
router.get('/all', (req, res) => {
  const cache = readCache();
  res.json(cache);
});

// GET /api/mvp/status — 수집 진행 상태
router.get('/status', (req, res) => {
  const { status, progress, fetchedAt, articles } = readCache();
  res.json({ status, progress, fetchedAt, count: articles?.length || 0, fetching: fetchingNow });
});

// GET /api/mvp/refresh — 강제 재수집
router.get('/refresh', (req, res) => {
  const cache = readCache();
  cache.status = 'empty';
  cache.articles = [];
  cache.fetchedAt = null;
  writeCache(cache);
  runFullFetch();
  res.json({ ok: true, message: '재수집 시작됨' });
});

// ─── GET /api/mvp/quarterly ───────────────────────────────────────────────────
// 캐시 데이터에서 분기별 종목 언급 집계
router.get('/quarterly', (req, res) => {
  const cache = readCache();
  const articles = cache.articles || [];
  if (!articles.length) return res.json({ quarters: {}, fetchedAt: null });

  const quarterMap = {};  // { "2026-Q2": { "종목명": { count, totalRank, bestRank, days: Set } } }

  for (const article of articles) {
    const d = new Date(article.date + 'T00:00:00');
    const year = d.getFullYear();
    const q = Math.ceil((d.getMonth() + 1) / 3);
    const key = `${year}-Q${q}`;

    if (!quarterMap[key]) quarterMap[key] = {};

    const stockIdx = (article.headers || []).findIndex(h => h.includes('종목'));
    if (stockIdx === -1) continue;

    for (const row of (article.rows || [])) {
      const stock = row[stockIdx];
      const rank = parseInt(row[0]) || 99;
      if (!stock) continue;

      if (!quarterMap[key][stock]) {
        quarterMap[key][stock] = { name: stock, count: 0, totalRank: 0, bestRank: 99, days: new Set() };
      }
      const s = quarterMap[key][stock];
      s.count++;
      s.totalRank += rank;
      s.bestRank = Math.min(s.bestRank, rank);
      s.days.add(article.date);
    }
  }

  // 정렬 후 직렬화
  const result = {};
  // 분기 키를 최신순 정렬
  const sortedKeys = Object.keys(quarterMap).sort((a, b) => b.localeCompare(a));
  for (const key of sortedKeys) {
    const totalDays = new Set(
      articles.filter(a => {
        const d = new Date(a.date + 'T00:00:00');
        const y = d.getFullYear();
        const q = Math.ceil((d.getMonth() + 1) / 3);
        return `${y}-Q${q}` === key;
      }).map(a => a.date)
    ).size;

    result[key] = Object.values(quarterMap[key])
      .sort((a, b) => b.count - a.count || (a.totalRank / a.count) - (b.totalRank / b.count))
      .slice(0, 20)
      .map((s, i) => ({
        rank: i + 1,
        name: s.name,
        count: s.count,
        totalDays,
        pct: Math.round(s.count / totalDays * 100),
        avgRank: Math.round(s.totalRank / s.count * 10) / 10,
        bestRank: s.bestRank,
      }));
  }

  res.json({ quarters: result, fetchedAt: cache.fetchedAt });
});

// GET /api/mvp — 최신 기사 1건 (하위 호환)
router.get('/', (req, res) => {
  const cache = readCache();
  const latest = cache.articles?.[0];
  if (!latest) return res.status(404).json({ error: '데이터 없음. 수집 중입니다.' });
  res.json(latest);
});

module.exports = router;
