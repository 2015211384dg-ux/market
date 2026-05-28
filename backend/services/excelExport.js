/**
 * 전체 종목 스크리너 결과를 주차별 엑셀 파일로 저장
 * - 주차별 파일 1개 (예: 스크리너_2026년_15주차.xlsx)
 * - 파일 내 시트 = 거래일 1개 (예: 시트명 "04월07일(화)")
 * - 한국 거래소 휴장일·주말 자동 제외
 */
const ExcelJS = require('exceljs');
const path    = require('path');
const fs      = require('fs');

// 저장 폴더 — 환경변수 또는 기본값
const EXPORT_DIR = process.env.SCREENER_EXPORT_DIR
  || path.join('C:', 'Market', 'screener-exports');

// ─── KRX 2026 공휴일 ──────────────────────────────────────────────────────────
const KRX_HOLIDAYS_2026 = new Set([
  '2026-01-01', // 신정
  '2026-01-26', // 설날 연휴
  '2026-01-27', // 설날
  '2026-01-28', // 설날 연휴
  '2026-01-29', // 대체공휴일
  '2026-03-01', // 삼일절 (일요일 → 03-02 대체)
  '2026-03-02', // 삼일절 대체공휴일
  '2026-05-05', // 어린이날
  '2026-05-25', // 부처님오신날 (음력 4/8)
  '2026-06-06', // 현충일 (토요일)
  '2026-08-17', // 광복절 대체공휴일 (08-15 토요일)
  '2026-09-24', // 추석 연휴
  '2026-09-25', // 추석
  '2026-09-28', // 추석 대체공휴일
  '2026-10-09', // 한글날
  '2026-12-25', // 크리스마스
  '2026-12-31', // 연말 휴장
]);

function isKRXHoliday(dateStr) {
  const d = new Date(dateStr);
  const dow = d.getDay(); // 0=일, 6=토
  if (dow === 0 || dow === 6) return true;
  return KRX_HOLIDAYS_2026.has(dateStr);
}

// ISO 주차 계산 (1년 = 52~53주)
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// 파일명: 스크리너_2026년_15주차.xlsx
function getWeeklyFilePath(dateStr) {
  const d    = new Date(dateStr);
  const year = d.getFullYear();
  const week = getISOWeek(d);
  const fileName = `스크리너_${year}년_${String(week).padStart(2,'0')}주차.xlsx`;
  return path.join(EXPORT_DIR, fileName);
}

// 시트명: "04월07일(화)"
function getSheetName(dateStr) {
  const d   = new Date(dateStr);
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const dd  = String(d.getDate()).padStart(2, '0');
  const DOW = ['일','월','화','수','목','금','토'];
  return `${mm}월${dd}일(${DOW[d.getDay()]})`;
}

/**
 * 스크리너 결과를 주차별 엑셀에 저장
 * @param {Array} results  - screenKRStock 반환값 배열
 * @param {Object} meta    - { runDate, runAt, criteria, universe, screened }
 */
async function saveScreenerToExcel(results, meta) {
  const dateStr = meta.runDate; // e.g. "2026-4-7" → normalize
  // normalize to YYYY-MM-DD
  const normalized = new Date(dateStr).toISOString().split('T')[0];

  if (isKRXHoliday(normalized)) {
    console.log(`[Excel] ${normalized} 은 휴장일 → 저장 건너뜀`);
    return null;
  }

  // 폴더 없으면 생성
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const filePath  = getWeeklyFilePath(normalized);
  const sheetName = getSheetName(normalized);

  // 기존 파일 로드 또는 신규 생성
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(filePath)) {
    await wb.xlsx.readFile(filePath);
    // 같은 날 시트 이미 있으면 덮어쓰기 위해 제거
    const existing = wb.getWorksheet(sheetName);
    if (existing) wb.removeWorksheet(existing.id);
  }

  const ws = wb.addWorksheet(sheetName);

  // ─── 헤더 ────────────────────────────────────────────────────────────────
  ws.columns = [
    { header: '종목명',       key: 'name',          width: 18 },
    { header: '종목코드',     key: 'code',          width: 10 },
    { header: '시장',         key: 'market',        width: 8  },
    { header: '현재가(₩)',    key: 'currentPrice',  width: 14 },
    { header: '당일등락%',    key: 'dayChange',     width: 10 },
    { header: 'RSI(14)',      key: 'rsi',           width: 9  },
    { header: '60일등락폭%',  key: 'rangePct',      width: 13 },
    { header: '범위내위치%',  key: 'pricePosition', width: 13 },
    { header: '상대거래량',   key: 'relVolume',     width: 12 },
    { header: '60일고가',     key: 'high60',        width: 13 },
    { header: '60일저가',     key: 'low60',         width: 13 },
  ];

  // 헤더 스타일
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.font    = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
    cell.border  = { bottom: { style: 'thin', color: { argb: 'FF4472C4' } } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 20;

  // ─── 데이터 행 ───────────────────────────────────────────────────────────
  results.forEach((s, i) => {
    const code   = s.symbol.replace(/\.(KS|KQ)$/, '');
    const market = s.symbol.endsWith('.KS') ? 'KOSPI' : 'KOSDAQ';
    const row = ws.addRow({
      name:          s.name,
      code,
      market,
      currentPrice:  Math.round(s.currentPrice),
      dayChange:     +s.dayChange.toFixed(2),
      rsi:           +s.rsi.toFixed(1),
      rangePct:      +s.rangePct.toFixed(1),
      pricePosition: s.pricePosition,
      relVolume:     +s.relVolume.toFixed(2),
      high60:        Math.round(s.high60),
      low60:         Math.round(s.low60),
    });

    // 행 배경색 (홀/짝 줄무늬)
    const bgColor = i % 2 === 0 ? 'FFFAFAFA' : 'FFF0F4FF';
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    });

    // 당일등락% — 양수 초록, 음수 빨강
    const changeCell = row.getCell('dayChange');
    changeCell.numFmt = '+0.00%;-0.00%';
    if (s.dayChange > 0) changeCell.font = { color: { argb: 'FF00B050' } };
    if (s.dayChange < 0) changeCell.font = { color: { argb: 'FFFF0000' } };

    // RSI — 과매도(≤30) 파랑, 과매수(≥70) 빨강
    const rsiCell = row.getCell('rsi');
    if (s.rsi <= 30) rsiCell.font = { color: { argb: 'FF1F78D1' }, bold: true };
    if (s.rsi >= 70) rsiCell.font = { color: { argb: 'FFCC0000' }, bold: true };

    // 현재가 / 고가 / 저가 — 원화 콤마 형식
    ['currentPrice', 'high60', 'low60'].forEach(k => {
      row.getCell(k).numFmt = '#,##0';
    });
  });

  // ─── 메타 정보 시트 ───────────────────────────────────────────────────────
  let metaWs = wb.getWorksheet('실행정보');
  if (!metaWs) metaWs = wb.addWorksheet('실행정보');

  // 이번 실행 정보 추가
  const existingRows = metaWs.rowCount;
  if (existingRows === 0) {
    metaWs.addRow(['날짜', '실행시각', '검색종목수', '전체분석', 'RSI최소', 'RSI최대', '등락폭최소%']);
    metaWs.getRow(1).font = { bold: true };
  }
  metaWs.addRow([
    normalized,
    meta.runAt,
    meta.total ?? results.length,
    meta.screened,
    meta.criteria?.rsiMin,
    meta.criteria?.rsiMax,
    meta.criteria?.rangeMin,
  ]);

  await wb.xlsx.writeFile(filePath);
  console.log(`[Excel] 저장 완료: ${filePath} (시트: ${sheetName}, ${results.length}개 종목)`);
  return filePath;
}

module.exports = { saveScreenerToExcel, EXPORT_DIR };
