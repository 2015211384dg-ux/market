import { useState, useEffect } from 'react';

const STORAGE_KEY = 'market_valuation_history';
const MAX_ITEMS   = 10;

export function useValuationHistory() {
  const [history, setHistory] = useState([]);

  // 마운트 시 localStorage에서 복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      // 파싱 오류 시 무시
    }
  }, []);

  const persist = (items) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  };

  /** 새 분석 결과 저장 (최대 MAX_ITEMS 유지) */
  const save = (data) => {
    const entry = {
      id:           Date.now(),
      savedAt:      new Date().toISOString(),
      companyName:  data.companyName  || '—',
      stockCode:    data.stockCode    || '',
      industry:     data.industry     || '',
      targetPrice:  data.summary?.targetPrice ?? 0,
      upside:       data.summary?.upside       ?? 0,
      wacc:         data.wacc,
      terminalGrowth: data.terminalGrowth,
      fullData:     data,   // 결과 화면 재현용
    };
    setHistory(prev => {
      // 같은 기업 덮어쓰기 — stockCode가 없는 수동 입력은 대상에서 제외
      const filtered = entry.stockCode
        ? prev.filter(h => h.stockCode !== entry.stockCode)
        : prev;
      const updated  = [entry, ...filtered].slice(0, MAX_ITEMS);
      persist(updated);
      return updated;
    });
  };

  /** 특정 항목 삭제 */
  const remove = (id) => {
    setHistory(prev => {
      const updated = prev.filter(h => h.id !== id);
      persist(updated);
      return updated;
    });
  };

  /** 전체 삭제 */
  const clear = () => {
    setHistory([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return { history, save, remove, clear };
}
