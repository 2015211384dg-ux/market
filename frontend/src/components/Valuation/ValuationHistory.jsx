/**
 * ValuationHistory — 최근 분석 히스토리 패널
 * localStorage에 저장된 최대 10개 항목을 카드로 표시.
 * 카드 클릭 → 이전 결과 화면 복원 / ✕ 클릭 → 해당 항목 삭제
 */
export default function ValuationHistory({ history, onView, onDelete, onClear }) {
  if (history.length === 0) return null;

  const fmt = (iso) => new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="mt-10 animate-in fade-in duration-500">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-brand-blue/40 rounded-full"></div>
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">
            최근 분석 히스토리
          </h3>
          <span className="px-2 py-0.5 bg-[#30363d] text-gray-400 text-[10px] font-black rounded-full">
            {history.length}
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-[10px] text-gray-600 hover:text-red-400 font-bold uppercase tracking-wider transition-colors"
        >
          전체 삭제
        </button>
      </div>

      {/* 카드 그리드 — 외부는 div(role=button)로 변경: button>button은 HTML 명세 위반 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {history.map(item => (
          <div
            key={item.id}
            onClick={() => onView(item.fullData)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onView(item.fullData)}
            role="button"
            tabIndex={0}
            className="group relative text-left bg-[#0d1117] hover:bg-[#161b22] border border-[#30363d] hover:border-brand-blue/30 rounded-2xl p-4 transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50"
          >
            {/* 삭제 버튼 (이제 div 안의 button으로 유효한 HTML) */}
            <button
              onClick={e => { e.stopPropagation(); onDelete(item.id); }}
              className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs font-bold"
              title="삭제"
            >
              ✕
            </button>

            {/* 기업 정보 */}
            <div className="mb-3 pr-5">
              <p className="text-xs font-black text-gray-100 truncate">{item.companyName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-mono text-gray-600">{item.stockCode}</span>
                {item.industry && (
                  <span className="text-[9px] text-gray-600 truncate">· {item.industry}</span>
                )}
              </div>
            </div>

            {/* 가치 결과 */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-base font-black text-brand-blue">
                ₩{(item.targetPrice || 0).toLocaleString()}
              </span>
              <span className={`text-[10px] font-black tabular-nums ${item.upside >= 0 ? 'text-brand-green' : 'text-red-400'}`}>
                {item.upside >= 0 ? '▲' : '▼'}{Math.abs(item.upside || 0).toFixed(1)}%
              </span>
            </div>

            {/* 가정값 칩 */}
            <div className="flex gap-1.5 flex-wrap mb-3">
              <span className="px-1.5 py-0.5 bg-[#30363d] text-gray-500 text-[9px] font-bold rounded">
                WACC {item.wacc}%
              </span>
              <span className="px-1.5 py-0.5 bg-[#30363d] text-gray-500 text-[9px] font-bold rounded">
                g {item.terminalGrowth}%
              </span>
            </div>

            {/* 저장 시각 */}
            <p className="text-[9px] text-gray-700 font-mono">{fmt(item.savedAt)}</p>

            {/* 호버 결과 복원 CTA */}
            <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-[9px] text-brand-blue font-black uppercase tracking-wider">결과 보기 →</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
