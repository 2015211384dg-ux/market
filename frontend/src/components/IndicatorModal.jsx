import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { IconX } from './Icons';
import { LoadingSpinner } from './LoadingSpinner';

// ─── 날짜 포매팅 ─────────────────────────────────────────────────────────────
function fmtXDate(date, freq) {
  if (!date) return '';
  const [y, m] = date.split('-');
  if (freq === '일간' || freq === '주간') return `${m}/${date.slice(8, 10)}`;
  if (freq === '분기') return `${y}.Q${Math.ceil(parseInt(m) / 3)}`;
  return `${y.slice(2)}.${m}`;
}

// ─── 값 포매팅 ───────────────────────────────────────────────────────────────
function fmtVal(v, display) {
  if (v == null) return '—';
  if (display === '%') return `${v.toFixed(2)}%`;
  if (display === '$T') return `$${v}T`;
  if (display === '$B') return `$${Number(v).toLocaleString()}B`;
  if (display === '$') return `$${v.toFixed(2)}`;
  if (display === 'K') return `${Number(v).toLocaleString()}K`;
  if (display === 'M') return `${v}M`;
  if (display === 'pts') return v.toFixed(1);
  return v.toFixed(2);
}

// ─── 신호 판정 ───────────────────────────────────────────────────────────────
function getSignal(ind) {
  const v = ind.value;
  if (v == null) return 'neutral';
  if (ind.bearAbove !== undefined && v > ind.bearAbove) return 'bear';
  if (ind.bearBelow !== undefined && v < ind.bearBelow) return 'bear';
  if (ind.bullAbove !== undefined && v > ind.bullAbove) return 'bull';
  if (ind.bullBelow !== undefined && v < ind.bullBelow) return 'bull';
  return 'neutral';
}

const SIGNAL_COLORS = {
  bull:    { stroke: '#3fb950', fill: '#3fb950', text: 'text-brand-green' },
  bear:    { stroke: '#f85149', fill: '#f85149', text: 'text-brand-red' },
  neutral: { stroke: '#58a6ff', fill: '#58a6ff', text: 'text-brand-blue' },
};

// ─── 커스텀 툴팁 ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, display, freq }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-surface-card border border-surface-border rounded px-3 py-2 text-xs shadow-lg">
      <div className="text-gray-500 mb-1">{label}</div>
      <div className="font-mono font-semibold text-gray-100">{fmtVal(val, display)}</div>
    </div>
  );
}

// ─── 마크다운 라인 렌더러 (경량) ─────────────────────────────────────────────
function ReportLine({ text }) {
  // **bold** → <b>, > blockquote
  const isQuote = text.startsWith('> ');
  const raw = isQuote ? text.slice(2) : text;

  const parts = raw.split(/(\*\*[^*]+\*\*)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} className="text-gray-100 font-semibold">{p.slice(2, -2)}</strong>;
    }
    return p;
  });

  if (isQuote) {
    return (
      <div className="border-l-2 border-brand-blue/40 pl-3 py-0.5 text-xs text-gray-400 bg-brand-blue/5 rounded-r">
        {parts}
      </div>
    );
  }
  return <p className="text-xs text-gray-300 leading-relaxed">{parts}</p>;
}

// ─── 메인 모달 ───────────────────────────────────────────────────────────────
export function IndicatorModal({ ind, onClose }) {
  const [histData, setHistData]           = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [interpLoading, setInterpLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    setInterpLoading(true);
    axios.get(`/api/macro-data/history/${ind.id}`)
      .then(res => {
        if (!cancelled) {
          setHistData(res.data);
          setLoading(false);
          setInterpLoading(!res.data.interpretation);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.response?.data?.error || '히스토리 조회 실패');
          setLoading(false);
          setInterpLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [ind.id]);

  // ESC 닫기
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const signal = getSignal(ind);
  const sc = SIGNAL_COLORS[signal];
  const history = histData?.history || [];
  const interpretation = histData?.interpretation || null;

  // BI 통계
  const values = history.map(h => h.value);
  const stats = values.length > 1 ? {
    avg:    values.reduce((a, b) => a + b, 0) / values.length,
    max:    Math.max(...values),
    min:    Math.min(...values),
    latest: values[values.length - 1],
    prev:   values[values.length - 2],
  } : null;

  // Y축 도메인: 약간 여유
  const yMin = stats ? stats.min - Math.abs(stats.max - stats.min) * 0.1 : 'auto';
  const yMax = stats ? stats.max + Math.abs(stats.max - stats.min) * 0.1 : 'auto';

  // X축 틱 간격 (너무 촘촘하지 않게)
  const tickInterval = history.length > 60 ? Math.floor(history.length / 10)
    : history.length > 24 ? Math.floor(history.length / 8)
    : history.length > 12 ? 2 : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-surface-card border border-surface-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── 헤더 ─────────────────────────────────────── */}
        <div className="card-header flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${
              signal === 'bull' ? 'bg-brand-green' : signal === 'bear' ? 'bg-brand-red' : 'bg-brand-blue'
            }`} />
            <div>
              <span className="card-title">{ind.nameKo}</span>
              <span className="ml-2 text-xs text-gray-600">{ind.name}</span>
            </div>
            <span className="badge-neutral">{ind.freq}</span>
            {ind.category && (
              <span className="badge-blue text-xs">{ind.id}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-surface-raised rounded transition-colors"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner text="FRED 데이터 불러오는 중..." />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-brand-red/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">{error}</p>
              {error.includes('FRED') && (
                <p className="text-xs text-gray-600">backend/.env에 FRED_API_KEY를 설정하세요</p>
              )}
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <>
              {/* ── BI 통계 카드 ────────────────────────── */}
              {stats && (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: '현재값', val: stats.latest, highlight: true },
                    { label: '기간 평균', val: stats.avg },
                    { label: '기간 최고', val: stats.max },
                    { label: '기간 최저', val: stats.min },
                  ].map(({ label, val, highlight }) => (
                    <div key={label} className={`rounded-lg border p-3 text-center ${
                      highlight
                        ? `border-${signal === 'bull' ? 'brand-green' : signal === 'bear' ? 'brand-red' : 'brand-blue'}/30 bg-${signal === 'bull' ? 'brand-green' : signal === 'bear' ? 'brand-red' : 'brand-blue'}/8`
                        : 'border-surface-border bg-surface-raised'
                    }`} style={highlight ? {
                      borderColor: sc.stroke + '40',
                      backgroundColor: sc.fill + '10',
                    } : {}}>
                      <div className="text-xs text-gray-500 mb-1">{label}</div>
                      <div className={`font-mono text-sm font-semibold ${highlight ? sc.text : 'text-gray-200'}`}>
                        {fmtVal(val, ind.display)}
                      </div>
                      {highlight && stats.prev != null && (
                        <div className={`text-xs font-mono mt-0.5 ${
                          stats.latest >= stats.prev ? 'text-brand-green' : 'text-brand-red'
                        }`}>
                          {stats.latest >= stats.prev ? '▲' : '▼'} {Math.abs(stats.latest - stats.prev).toFixed(2)}{ind.display === '%' ? '%p' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── 차트 ──────────────────────────────── */}
              <div>
                <div className="section-label mb-3">
                  추이 차트
                  <span className="text-gray-700 font-normal normal-case tracking-normal text-xs ml-1">
                    ({history.length}개 데이터 포인트)
                  </span>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${ind.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={sc.fill} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={sc.fill} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#6e7681' }}
                        tickLine={false}
                        axisLine={false}
                        interval={tickInterval}
                        tickFormatter={d => fmtXDate(d, ind.freq)}
                      />
                      <YAxis
                        domain={[yMin, yMax]}
                        tick={{ fontSize: 10, fill: '#6e7681' }}
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        tickFormatter={v => fmtVal(v, ind.display)}
                      />
                      <Tooltip content={<CustomTooltip display={ind.display} freq={ind.freq} />} />

                      {/* 기준선들 */}
                      {ind.target !== undefined && (
                        <ReferenceLine
                          y={ind.target} stroke="#58a6ff" strokeDasharray="4 4" strokeWidth={1.5}
                          label={{ value: `목표 ${ind.target}%`, position: 'insideTopRight', fontSize: 10, fill: '#58a6ff' }}
                        />
                      )}
                      {ind.bearAbove !== undefined && (
                        <ReferenceLine
                          y={ind.bearAbove} stroke="#f85149" strokeDasharray="3 3" strokeWidth={1}
                          label={{ value: `경고 ${ind.bearAbove}${ind.display === '%' ? '%' : ''}`, position: 'insideBottomRight', fontSize: 9, fill: '#f85149' }}
                        />
                      )}
                      {ind.bullBelow !== undefined && (
                        <ReferenceLine
                          y={ind.bullBelow} stroke="#3fb950" strokeDasharray="3 3" strokeWidth={1}
                          label={{ value: `우호 ${ind.bullBelow}${ind.display === '%' ? '%' : ''}`, position: 'insideTopRight', fontSize: 9, fill: '#3fb950' }}
                        />
                      )}
                      {ind.bullAbove !== undefined && (
                        <ReferenceLine
                          y={ind.bullAbove} stroke="#3fb950" strokeDasharray="3 3" strokeWidth={1}
                          label={{ value: `우호 ${ind.bullAbove}${ind.display === '%' ? '%' : ''}`, position: 'insideBottomRight', fontSize: 9, fill: '#3fb950' }}
                        />
                      )}

                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={sc.stroke}
                        strokeWidth={2}
                        fill={`url(#grad-${ind.id})`}
                        dot={false}
                        activeDot={{ r: 4, fill: sc.fill, stroke: '#0d1117', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── AI 해석 리포트 ────────────────────── */}
              <div>
                <div className="section-label mb-3">
                  AI 해석 & 리포트
                  <span className="badge-blue ml-2">Claude Haiku</span>
                  {interpretation && (
                    <span className="badge-neutral ml-1">캐시됨</span>
                  )}
                </div>
                <div className="bg-surface-raised rounded-lg border border-surface-border p-4">
                  {interpLoading && (
                    <div className="flex items-center gap-2 py-4 justify-center">
                      <span className="w-4 h-4 border border-brand-blue border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-gray-500">Claude가 해석 중...</span>
                    </div>
                  )}
                  {!interpLoading && interpretation && (
                    <div className="space-y-2">
                      {interpretation.split('\n').filter(l => l.trim()).map((line, i) => (
                        <ReportLine key={i} text={line} />
                      ))}
                    </div>
                  )}
                  {!interpLoading && !interpretation && (
                    <p className="text-xs text-gray-600 text-center py-3">
                      ANTHROPIC_API_KEY를 설정하면 AI 해석이 표시됩니다
                    </p>
                  )}
                  <div className="pt-3 mt-3 border-t border-surface-border text-xs text-gray-700">
                    데이터: FRED (St. Louis Fed) · 관측일: {history[history.length - 1]?.date}
                    · 해석은 데이터 업데이트 시에만 재생성됩니다
                  </div>
                </div>
              </div>
            </>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <p className="text-sm text-gray-500">데이터가 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
