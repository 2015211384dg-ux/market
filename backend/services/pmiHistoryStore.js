/**
 * PMI 히스토리 영구 저장소
 * - 스크래핑 결과를 월별로 누적 보관
 * - 백엔드 재시작해도 데이터 유지
 */
const fs   = require('fs');
const path = require('path');

const STORE_FILE = path.join(__dirname, '../data/pmi_history.json');

function load() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    }
  } catch { /* 오류 시 빈 스토어 */ }
  // 초기 구조
  return { ISM_MFG: [], ISM_SVC: [], CAIXIN_PMI: [] };
}

function save(store) {
  try {
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('[pmiHistory] 저장 실패:', e.message);
  }
}

/**
 * 새 PMI 값 추가 (이미 같은 월 데이터 있으면 스킵)
 * @param {string} seriesId  ISM_MFG | ISM_SVC | CAIXIN_PMI
 * @param {string} date      YYYY-MM-DD
 * @param {number} value
 */
function append(seriesId, date, value) {
  if (!date || value == null) return;
  const store = load();
  if (!store[seriesId]) store[seriesId] = [];

  // 같은 연-월이 이미 있으면 업데이트, 없으면 추가
  const month = date.slice(0, 7); // YYYY-MM
  const idx = store[seriesId].findIndex(e => e.date.startsWith(month));
  if (idx >= 0) {
    store[seriesId][idx] = { date, value };
  } else {
    store[seriesId].push({ date, value });
    // 날짜 오름차순 정렬
    store[seriesId].sort((a, b) => a.date.localeCompare(b.date));
  }

  // 최근 24개월만 보관
  if (store[seriesId].length > 24) {
    store[seriesId] = store[seriesId].slice(-24);
  }
  save(store);
}

/** 시리즈 히스토리 반환 (시간순) */
function getHistory(seriesId) {
  const store = load();
  return store[seriesId] || [];
}

module.exports = { append, getHistory };
