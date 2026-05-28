import { useState, useEffect, useRef } from 'react';
import { METRIC_META, getSectorBenchmark, getMetricColorClass } from '../data/sectorBenchmarks';

/**
 * 재무 지표 셀 — 값 표시 + 클릭 시 설명·업종 평균 팝업
 */
export function FundamentalBadge({ metricKey, value, sector }) {
  const [open, setOpen] = useState(false);
  const [popupUp, setPopupUp] = useState(false);
  const ref = useRef(null);
  const meta = METRIC_META[metricKey];

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!meta) return <td className="px-2 py-2.5 text-gray-600 text-center">—</td>;

  const colorCls  = getMetricColorClass(metricKey, value);
  const benchmark = getSectorBenchmark(sector);
  const bm        = benchmark?.[metricKey];
  const isNA      = meta.naFor?.includes(sector) || value == null;

  const displayVal = isNA
    ? '—'
    : value == null
    ? '—'
    : `${value}${meta.unit}`;

  return (
    <td className="px-2 py-2.5 text-center relative" ref={ref}>
      <button
        onClick={() => {
          if (isNA) return;
          if (!open) {
            // 클릭한 요소 기준으로 아래 공간 체크
            const rect = ref.current?.getBoundingClientRect();
            const spaceBelow = window.innerHeight - (rect?.bottom ?? 0);
            setPopupUp(spaceBelow < 320);
          }
          setOpen(o => !o);
        }}
        className={`font-mono text-xs ${isNA ? 'text-gray-600 cursor-default' : `${colorCls} cursor-pointer hover:opacity-80`}`}
        title={isNA ? 'N/A' : `${meta.fullLabel} — 클릭하여 상세 보기`}
      >
        {displayVal}
      </button>

      {open && !isNA && (
        <div
          className="absolute z-50 left-1/2 -translate-x-1/2 w-72 bg-surface-card border border-surface-border rounded-lg shadow-xl text-left p-3"
          style={popupUp ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }}
        >
          {/* 헤더 */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-xs font-semibold text-gray-200">{meta.fullLabel}</div>
              <div className={`text-sm font-bold font-mono ${colorCls}`}>
                {displayVal}
                <DirectionBadge direction={meta.direction} />
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-600 hover:text-gray-300 text-sm leading-none">✕</button>
          </div>

          {/* 설명 */}
          <p className="text-xs text-gray-400 mb-2 leading-relaxed">{meta.desc}</p>

          {/* 방향 */}
          <div className={`text-xs mb-2 px-2 py-1 rounded ${meta.direction === 'lower' ? 'bg-blue-900/30 text-blue-300' : 'bg-green-900/30 text-green-300'}`}>
            {meta.direction === 'lower' ? '↓ 낮을수록 좋음' : '↑ 높을수록 좋음'}
          </div>

          {/* 거장 기준 */}
          {meta.gurus?.length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 font-medium mb-1">투자 거장 기준</div>
              {meta.gurus.map((g, i) => (
                <div key={i} className="text-xs text-gray-400 flex gap-1">
                  <span className="text-brand-blue shrink-0">• {g.name}:</span>
                  <span>{g.note}</span>
                </div>
              ))}
            </div>
          )}

          {/* 업종별 평균 */}
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">업종별 평균</div>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(SECTOR_BENCHMARKS_SUMMARY).map(([sKey, sLabel]) => {
                  const sb = getSectorBenchmark(sKey);
                  const sbm = sb?.[metricKey];
                  if (!sbm?.avg) return null;
                  const isCurrent = sector === sKey;
                  return (
                    <tr key={sKey} className={isCurrent ? 'bg-brand-blue/10' : ''}>
                      <td className={`py-0.5 pr-2 ${isCurrent ? 'text-brand-blue font-semibold' : 'text-gray-500'}`}>
                        {isCurrent ? '▶ ' : ''}{sLabel}
                      </td>
                      <td className="py-0.5 font-mono text-gray-300 text-right">
                        {sbm.avg}{meta.unit}
                        <span className="text-gray-600 ml-1 text-xs">({sbm.range?.[0]}–{sbm.range?.[1]})</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </td>
  );
}

function DirectionBadge({ direction }) {
  return (
    <span className={`ml-1.5 text-xs font-normal ${direction === 'lower' ? 'text-blue-400' : 'text-green-400'}`}>
      {direction === 'lower' ? '↓낮을수록' : '↑높을수록'}
    </span>
  );
}

// 팝업에서 업종 순서 정의
const SECTOR_BENCHMARKS_SUMMARY = {
  Technology:              '기술/IT',
  Healthcare:              '헬스케어/바이오',
  'Consumer Cyclical':     '경기소비재/자동차',
  'Consumer Defensive':    '필수소비재',
  Industrials:             '산업재',
  Energy:                  '에너지',
  'Basic Materials':       '소재/화학',
  'Communication Services':'통신/미디어',
  'Financial Services':    '금융',
};

// SECTOR_BENCHMARKS import (팝업용)
import { SECTOR_BENCHMARKS } from '../data/sectorBenchmarks';
