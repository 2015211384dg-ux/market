/**
 * ISM PMI 히스토리 제공
 * ISM 데이터는 유료 독점 → FRED/Alpha Vantage 미지원
 * 해결책: 로컬 누적 스토어 (부트스트랩 + 매월 스크래핑 자동 추가)
 */
const pmiHistory = require('./pmiHistoryStore');

async function getMfgPmiHistory() { return pmiHistory.getHistory('ISM_MFG'); }
async function getSvcPmiHistory() { return pmiHistory.getHistory('ISM_SVC'); }

module.exports = { getMfgPmiHistory, getSvcPmiHistory };
