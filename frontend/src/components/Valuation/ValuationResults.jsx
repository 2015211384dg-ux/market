import { IconRefresh, IconSparkle, IconCalculator } from '../Icons';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/** 브라우저 Print → Save as PDF 트리거 */
function handlePrint() {
  window.print();
}

// ── Investment Sentiment 5단계 ────────────────────────────────────────────────
// upside 기준: >30% STRONG BUY / >10% BUY / >-5% HOLD / >-20% SELL / 이하 STRONG SELL
function getSentiment(upside) {
  if (upside > 30)  return { label: 'STRONG BUY',  level: 5, textColor: 'text-sky-400',    barOn: 'bg-sky-400    shadow-[0_0_10px_rgba(56,189,248,0.5)]' };
  if (upside > 10)  return { label: 'BUY',          level: 4, textColor: 'text-brand-green', barOn: 'bg-brand-green shadow-[0_0_10px_rgba(63,185,80,0.5)]' };
  if (upside > -5)  return { label: 'HOLD',          level: 3, textColor: 'text-yellow-400',  barOn: 'bg-yellow-400  shadow-[0_0_10px_rgba(250,204,21,0.5)]' };
  if (upside > -20) return { label: 'SELL',          level: 2, textColor: 'text-orange-400',  barOn: 'bg-orange-400  shadow-[0_0_10px_rgba(251,146,60,0.5)]' };
  return              { label: 'STRONG SELL',  level: 1, textColor: 'text-red-400',    barOn: 'bg-red-400    shadow-[0_0_10px_rgba(248,81,73,0.5)]' };
}

// ── 민감도 셀 배경 색상 (현재가 대비 upside) ──────────────────────────────────
function sensitivityCellClass(targetPrice, currentPrice, isBase) {
  if (!targetPrice || !currentPrice) return 'bg-[#0d1117] text-gray-600 border-transparent';
  const up = (targetPrice / currentPrice - 1) * 100;
  const base = isBase ? 'ring-1 ring-brand-blue' : '';
  if (up > 30)  return `bg-sky-500/20   text-sky-300    border-sky-500/20   ${base}`;
  if (up > 10)  return `bg-green-500/15 text-green-400  border-green-500/20 ${base}`;
  if (up > -5)  return `bg-yellow-500/10 text-yellow-400 border-yellow-500/20 ${base}`;
  if (up > -20) return `bg-orange-500/10 text-orange-400 border-orange-500/20 ${base}`;
  return               `bg-red-500/10   text-red-400    border-red-500/20   ${base}`;
}

// Football Field 행 데이터
const FOOTBALL_ROWS = [
  { label: 'Intrinsic (DCF)',    key: 'dcfEV',    labelCls: 'text-brand-blue',   barCls: 'from-brand-blue/40 to-brand-blue shadow-[0_0_15px_rgba(88,166,255,0.3)]' },
  { label: 'Market (EV/EBITDA)', key: 'evEbitda', labelCls: 'text-brand-green',  barCls: 'from-brand-green/40 to-brand-green shadow-[0_0_15px_rgba(63,185,80,0.3)]' },
  { label: 'Market (PER)',        key: 'per',      labelCls: 'text-brand-purple', barCls: 'from-brand-purple/40 to-brand-purple shadow-[0_0_15px_rgba(188,140,255,0.3)]' },
];

export default function ValuationResults({ data, onReset }) {
  const result      = data?.summary    || { finalEquityValue: 0, targetPrice: 0, upside: 0 };
  const dcf         = data?.dcf        || { enterpriseValue: 0, equityValue: 0, pvOfFCF: 0, pvOfTV: 0 };
  const relative    = data?.relative   || { evBasedValue: 0, perBasedValue: 0, averageValue: 0 };
  const trend       = Array.isArray(data?.trend) ? data.trend : [];
  const sensitivity = data?.sensitivity || null;
  const currentPrice = data?.market?.currentPrice || 0;

  const sentiment = getSentiment(result.upside || 0);

  const chartData = useMemo(() => {
    if (!Array.isArray(trend) || trend.length === 0) return [];
    return [...trend].reverse().map(item => ({
      year: item.year + '년',
      profit: Math.round(item.netIncome / 100000000),
    }));
  }, [trend]);

  const footballValues = {
    dcfEV:   dcf.equityValue        || 0,
    evEbitda: relative.evBasedValue  || 0,
    per:      relative.perBasedValue || 0,
  };
  const maxValue = Math.max(...Object.values(footballValues), 1);
  const getWidth = (val) => `${Math.min(100, Math.max(0, (val / maxValue) * 100))}%`;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 print:pb-0 print:space-y-6">

      {/* ── 상단 헤더 ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-[#161b22]/40 p-8 rounded-3xl border border-[#30363d] backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="px-2 py-0.5 bg-brand-blue/20 text-brand-blue text-[10px] font-black rounded border border-brand-blue/30 uppercase tracking-widest">IB Technical Report</div>
            <span className="text-gray-500 text-xs font-mono">{data?.companyName} ({data?.stockCode})</span>
          </div>
          <h2 className="text-3xl font-black text-gray-100 tracking-tight">가치평가 분석 결과</h2>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Industry</span>
              <span className="text-gray-300 font-semibold">{data?.industry}</span>
            </div>
            <div className="w-px h-3 bg-[#30363d]"></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">WACC</span>
              <span className="text-brand-blue font-bold">{data?.wacc}%</span>
            </div>
            <div className="w-px h-3 bg-[#30363d]"></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Growth (g)</span>
              <span className="text-brand-green font-bold">{data?.terminalGrowth}%</span>
            </div>
            {data?.growthRate && (
              <>
                <div className="w-px h-3 bg-[#30363d]"></div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Short-term g</span>
                  <span className="text-yellow-400 font-bold">{data.growthRate}%</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          {/* PDF 내보내기 */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-3 bg-[#0d1117] hover:bg-[#161b22] text-gray-400 hover:text-gray-100 rounded-2xl text-xs font-black transition-all border border-[#30363d] hover:border-gray-500"
            title="브라우저 인쇄 → PDF로 저장"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            PDF 저장
          </button>
          <button onClick={onReset} className="group flex items-center gap-2.5 px-6 py-3 bg-[#30363d] hover:bg-gray-700 text-gray-200 rounded-2xl text-xs font-black transition-all border border-[#444c56]">
            <IconRefresh className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" /> NEW ANALYSIS
          </button>
        </div>
      </div>

      {/* ── 메인 그리드 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:block print:space-y-8">

        {/* 좌측 col-4 */}
        <div className="lg:col-span-4 space-y-8 print:w-full">
          {/* 적정 주가 카드 */}
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-blue to-blue-700 text-white rounded-[2rem] p-8 shadow-2xl print:break-inside-avoid">
            <h3 className="text-blue-100 text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <IconCalculator className="w-4 h-4" /> 추정 적정 주가
            </h3>
            <div className="mb-8">
              <div className="text-5xl font-black tracking-tighter mb-2 italic">
                ₩{(result.targetPrice || 0).toLocaleString()}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-black tracking-widest ${result.upside >= 0 ? 'bg-green-400 text-green-900' : 'bg-red-400 text-red-900'}`}>
                  {result.upside >= 0 ? '▲' : '▼'} {Math.abs(result.upside || 0).toFixed(2)}%
                </span>
                <span className="text-blue-100/60 text-[10px] font-bold uppercase tracking-widest">Upside</span>
              </div>
            </div>
            <div className="space-y-4 pt-6 border-t border-white/20">
              <div className="flex justify-between items-center">
                <span className="text-blue-100/70 text-[10px] font-bold uppercase tracking-widest">Equity Value</span>
                <span className="text-lg font-black italic">{(result.finalEquityValue || 0).toLocaleString()} 억</span>
              </div>
              {currentPrice > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-blue-100/70 text-[10px] font-bold uppercase tracking-widest">현재가</span>
                  <span className="text-sm font-bold text-blue-100/80">₩{currentPrice.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Historical Net Income 차트 */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-[2rem] p-8 shadow-xl print:break-inside-avoid">
            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Historical Net Income (3Y)</h4>
            <div className="h-48 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#8b949e', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1c2128', border: '1px solid #30363d', borderRadius: '12px' }}
                      itemStyle={{ color: '#58a6ff', fontWeight: 'bold' }}
                      formatter={(v) => [`${v.toLocaleString()} 억원`, '당기순이익']}
                    />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#58a6ff' : '#30363d'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-[#30363d] rounded-2xl text-[10px] text-gray-600">
                  추이 데이터 없음
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-4 leading-relaxed font-medium">
              ※ IB 실무에서는 단기 실적보다 다년도 이익 추이(Trend)를 기반으로 영구성장률을 보정합니다.
            </p>
          </div>
        </div>

        {/* 우측 col-8 */}
        <div className="lg:col-span-8 space-y-8 print:w-full">
          {/* Football Field */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-[2rem] p-10 shadow-xl print:break-inside-avoid">
            <div className="flex justify-between items-center mb-12">
              <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Valuation Football Field</h4>
              <span className="text-[10px] font-bold text-gray-600">(단위: 억원)</span>
            </div>
            <div className="space-y-10">
              {FOOTBALL_ROWS.map(({ label, key, labelCls, barCls }) => (
                <div key={key} className="space-y-3">
                  <div className="flex justify-between text-xs font-black tracking-widest uppercase">
                    <span className={labelCls}>{label}</span>
                    <span className="text-gray-100 italic">{footballValues[key].toLocaleString()}</span>
                  </div>
                  <div className="relative h-3 bg-[#0d1117] rounded-full overflow-hidden border border-[#30363d]">
                    <div
                      className={`absolute top-0 left-0 h-full bg-gradient-to-r ${barCls} rounded-full transition-all duration-1000`}
                      style={{ width: getWidth(footballValues[key]) }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            {/* 실제 금액 스케일 tick */}
            <div className="mt-10 flex justify-between px-2 border-t border-[#30363d] pt-5 opacity-50">
              {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                <div key={pct} className="flex flex-col items-center gap-1.5">
                  <div className="w-px h-2 bg-[#30363d]"></div>
                  <span className="text-[9px] font-black text-gray-600 font-mono">
                    {pct === 0 ? '0' : maxValue * pct >= 10000
                      ? `${(maxValue * pct / 10000).toFixed(0)}조`
                      : `${(maxValue * pct / 1000).toFixed(0)}천억`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 하단 2분할 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:block print:space-y-8">
            {/* IB 핵심 요약 */}
            <div className="bg-[#0d1117] p-8 rounded-3xl border border-[#30363d]">
              <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <IconSparkle className="w-3 h-3 text-brand-blue" /> IB 핵심 요약
              </h5>
              <ul className="space-y-5 text-[11px]">
                <li className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">영구가치(TV) 비중</span>
                  <span className="text-brand-green font-black italic">
                    {dcf.enterpriseValue > 0 ? ((dcf.pvOfTV / dcf.enterpriseValue) * 100).toFixed(1) : 0}%
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">순차입금 (Net Debt)</span>
                  <span className="text-red-400 font-black italic">
                    {(data?.financials?.netDebt || 0).toLocaleString()} 억
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">EV 대비 차입금</span>
                  <span className="text-gray-100 font-black italic">
                    {dcf.enterpriseValue > 0
                      ? ((data?.financials?.netDebt / dcf.enterpriseValue) * 100).toFixed(1) : 0}%
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">FCF/EBITDA 전환율</span>
                  <span className="text-brand-blue font-black italic">
                    {dcf.usedFcfRatio != null ? (dcf.usedFcfRatio * 100).toFixed(0) : '—'}%
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">적용 단기 성장률</span>
                  <span className="text-yellow-400 font-black italic">
                    {dcf.usedGrowthRate != null ? `${dcf.usedGrowthRate}%` : '—'}
                  </span>
                </li>
              </ul>
            </div>

            {/* ── Investment Sentiment 5단계 ── */}
            <div className="bg-[#0d1117] p-8 rounded-3xl border border-[#30363d] flex flex-col justify-center items-center text-center">
              <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">
                Investment Sentiment
              </div>

              {/* 5-bar indicator */}
              <div className="flex gap-1.5 mb-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`w-8 h-2.5 rounded-full transition-all duration-500 ${
                      i <= sentiment.level ? sentiment.barOn : 'bg-[#30363d]'
                    }`}
                  />
                ))}
              </div>

              <div className={`text-2xl font-black italic ${sentiment.textColor}`}>
                {sentiment.label}
              </div>
              <div className="mt-1.5 text-[11px] text-gray-500 font-bold tabular-nums">
                {result.upside >= 0 ? '+' : ''}{(result.upside || 0).toFixed(1)}% vs 현재가
              </div>

              {/* 5단계 레이블 */}
              <div className="mt-5 w-full border-t border-[#30363d] pt-4">
                <div className="grid grid-cols-5 gap-1 text-[8px] font-black uppercase">
                  {[
                    { label: 'S.Sell', lv: 1, cls: 'text-red-500' },
                    { label: 'Sell',   lv: 2, cls: 'text-orange-500' },
                    { label: 'Hold',   lv: 3, cls: 'text-yellow-500' },
                    { label: 'Buy',    lv: 4, cls: 'text-green-500' },
                    { label: 'S.Buy',  lv: 5, cls: 'text-sky-400' },
                  ].map(({ label, lv, cls }) => (
                    <div
                      key={lv}
                      className={`text-center py-1.5 rounded ${
                        lv === sentiment.level
                          ? `${cls} bg-[#30363d]`
                          : 'text-gray-600'
                      }`}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[9px] text-gray-600 mt-3 font-bold uppercase tracking-widest leading-relaxed px-2">
                Risk-adjusted WACC model
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 민감도 분석 테이블 ── */}
      {sensitivity && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-[2rem] p-8 shadow-xl overflow-hidden print:break-inside-avoid print:break-before-page">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
            <div>
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">
                Sensitivity Analysis — Target Price
              </h4>
              <p className="text-[10px] text-gray-600 mt-1">
                WACC × 영구성장률(g) 변화에 따른 추정 주가 (원) · ★ = 기준값
              </p>
            </div>
            {/* 범례 */}
            <div className="flex flex-wrap items-center gap-3 text-[9px] font-black uppercase tracking-wider shrink-0">
              {[
                { cls: 'bg-sky-500/30',    label: '>+30%' },
                { cls: 'bg-green-500/20',  label: '>+10%' },
                { cls: 'bg-yellow-500/15', label: '±5%' },
                { cls: 'bg-orange-500/15', label: '<-5%' },
                { cls: 'bg-red-500/15',    label: '<-20%' },
              ].map(({ cls, label }) => (
                <span key={label} className="flex items-center gap-1 text-gray-500">
                  <span className={`w-2.5 h-2.5 rounded-sm inline-block ${cls}`}></span>{label}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr>
                  <th className="text-left text-[10px] text-gray-500 font-black uppercase pb-4 pr-6 w-20">
                    g ╲ WACC
                  </th>
                  {sensitivity.waccLabels.map((label, ci) => (
                    <th key={ci} className={`text-center pb-4 px-1 text-[10px] font-black ${ci === 2 ? 'text-brand-blue' : 'text-gray-500'}`}>
                      {label}{ci === 2 ? ' ★' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sensitivity.gLabels.map((gLabel, ri) => (
                  <tr key={ri} className="border-t border-[#30363d]/40">
                    <td className={`py-2 pr-6 text-[10px] font-black ${ri === 2 ? 'text-brand-green' : 'text-gray-500'}`}>
                      {gLabel}{ri === 2 ? ' ★' : ''}
                    </td>
                    {(sensitivity.matrix[ri] || []).map((price, ci) => {
                      const isBase = ri === 2 && ci === 2;
                      const cls = sensitivityCellClass(price, currentPrice, isBase);
                      return (
                        <td key={ci} className="px-1 py-2">
                          <div className={`px-2 py-2 rounded-xl border text-center text-[10px] font-black font-mono ${cls}`}>
                            {price ? `₩${price.toLocaleString()}` : '—'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 면책 고지 ── */}
      <div className="px-6 py-5 bg-[#0d1117]/60 border border-[#30363d]/50 rounded-2xl">
        <p className="text-[10px] text-gray-600 leading-relaxed text-center font-medium">
          <span className="text-gray-500 font-black">⚠ 투자 유의사항</span> &nbsp;|&nbsp;
          본 분석은 공개 재무데이터와 통계적 모델을 기반으로 한 <strong className="text-gray-500">참고자료</strong>이며,
          투자 권유 또는 재무 조언이 아닙니다. &nbsp;
          DART 공시 기준 재무 추정치로 실제 값과 차이가 있을 수 있고,
          실제 투자 판단은 반드시 공인 투자자문가와 상담하시기 바랍니다. &nbsp;
          과거 실적이 미래 수익을 보장하지 않습니다.
        </p>
      </div>

    </div>
  );
}
