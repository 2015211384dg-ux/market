import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { KR_THEME_GROUPS, toKisCode } from '../data/krThemes';
import { LoadingSpinner } from './LoadingSpinner';

const API = '/api/peg-screener';

const WEIGHT_PRESETS = [
  { id: 'it-hardware',   label: '기본형',    desc: 'CAGR 20% + YoY 30%',     color: 'sky' },
  { id: 'it-appliances', label: 'YoY 중심',  desc: 'YoY 50% (가전·배터리형)', color: 'emerald' },
];

const PERIOD_OPTS = [
  { id: 'annual',  label: '연간',  desc: '연간 재무제표 기준 — EPS CAGR/YoY는 연도 단위' },
  { id: 'quarter', label: '분기',  desc: '분기 재무제표 기준 — YoY는 전년 동기 대비' },
];

const BASIC_COLS = [
  { key: 'per',       label: 'PER',    infoKey: 'per',       fmt: v => v == null ? '—' : v.toFixed(1) + 'x',  color: () => '' },
  { key: 'pbr',       label: 'PBR',    infoKey: 'pbr',       fmt: v => v == null ? '—' : v.toFixed(1) + 'x',  color: () => '' },
  { key: 'epsCagr2Y', label: 'CAGR',   infoKey: 'epsCagr2Y', fmt: v => v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`, color: v => v == null ? '' : v >= 0.15 ? 'text-emerald-400' : v >= 0 ? '' : 'text-red-400' },
  { key: 'epsYoY',    label: 'YoY',    infoKey: 'epsYoY',    fmt: v => v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`, color: v => v == null ? '' : v >= 0.25 ? 'text-emerald-400' : v >= 0 ? '' : 'text-red-400' },
  { key: 'roe',       label: 'ROE',    infoKey: 'roe',       fmt: v => v == null ? '—' : v.toFixed(1) + '%',  color: v => v == null ? '' : v >= 15 ? 'text-emerald-400' : v >= 0 ? '' : 'text-red-400' },
  { key: 'epsVol',    label: 'Vol',    infoKey: 'epsVol',    fmt: v => v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`, color: () => '' },
  { key: 'debtRatio', label: '부채율', infoKey: 'debtRatio', fmt: v => v == null ? '—' : v.toFixed(0) + '%',  color: v => v == null ? '' : v > 200 ? 'text-red-400' : v > 100 ? 'text-amber-400' : 'text-emerald-400' },
];

const LEGEND_COLS = [
  {
    key: 'grahamDiscount', label: 'Graham할인', infoKey: 'grahamNum',
    getValue: s => s.extra?.grahamDiscount,
    fmt: s => {
      const gn = s.extra?.grahamNum;
      const d  = s.extra?.grahamDiscount;
      if (gn == null) return { main: '—', sub: null };
      return { main: `${d >= 0 ? '+' : ''}${d?.toFixed(1)}%`, sub: gn.toLocaleString() + '원' };
    },
    color: s => {
      const d = s.extra?.grahamDiscount;
      if (d == null) return '';
      return d > 0 ? 'text-emerald-400' : 'text-red-400';
    },
  },
  {
    key: 'roic', label: 'ROIC', infoKey: 'roic',
    getValue: s => s.extra?.roic,
    fmt: s => ({ main: s.extra?.roic == null ? '—' : s.extra.roic.toFixed(1) + '%', sub: null }),
    color: s => {
      const v = s.extra?.roic;
      if (v == null) return '';
      return v >= 15 ? 'text-emerald-400' : v >= 8 ? 'text-amber-400' : 'text-red-400';
    },
  },
  {
    key: 'earningsYield', label: 'EBIT/EV', infoKey: 'earningsYield',
    getValue: s => s.extra?.earningsYield,
    fmt: s => ({ main: s.extra?.earningsYield == null ? '—' : s.extra.earningsYield.toFixed(1) + '%', sub: null }),
    color: s => {
      const v = s.extra?.earningsYield;
      if (v == null) return '';
      return v >= 10 ? 'text-emerald-400' : v >= 5 ? 'text-amber-400' : 'text-red-400';
    },
  },
  {
    key: 'psr', label: 'PSR', infoKey: 'psr',
    getValue: s => s.extra?.psr,
    fmt: s => ({ main: s.extra?.psr == null ? '—' : s.extra.psr.toFixed(2) + 'x', sub: null }),
    color: s => {
      const v = s.extra?.psr;
      if (v == null) return '';
      return v <= 0.75 ? 'text-emerald-400' : v >= 3 ? 'text-red-400' : '';
    },
  },
  {
    key: 'piotroski', label: 'Piotroski', infoKey: 'piotroski',
    getValue: s => s.extra?.piotroski,
    fmt: s => {
      const v = s.extra?.piotroski, m = s.extra?.piotroskiMax;
      return { main: v == null ? '—' : `${v}/${m}점`, sub: null };
    },
    color: s => {
      const v = s.extra?.piotroski, m = s.extra?.piotroskiMax;
      if (v == null || !m) return '';
      const r = v / m;
      return r >= 0.7 ? 'text-emerald-400' : r <= 0.3 ? 'text-red-400' : 'text-amber-400';
    },
  },
  {
    key: 'pegy', label: 'PEGY', infoKey: 'pegy',
    getValue: s => s.extra?.pegy,
    fmt: s => ({ main: s.extra?.pegy == null ? '—' : s.extra.pegy.toFixed(2), sub: null }),
    color: s => {
      const v = s.extra?.pegy;
      if (v == null) return '';
      return v < 1 ? 'text-emerald-400' : v > 2 ? 'text-red-400' : 'text-amber-400';
    },
  },
  {
    key: 'epsAccel', label: 'EPS가속', infoKey: 'epsAccel',
    getValue: s => s.extra?.epsAccel,
    fmt: s => {
      const v = s.extra?.epsAccel;
      return { main: v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%p`, sub: null };
    },
    color: s => {
      const v = s.extra?.epsAccel;
      if (v == null) return '';
      return v > 0 ? 'text-emerald-400' : 'text-red-400';
    },
  },
];

// ── 거장 지표 + 기본 컬럼 설명 ────────────────────────────────────────────────
const METRIC_INFO = {
  compositeScore: {
    label: '종합점수', investor: null,
    desc: 'PER·PBR·CAGR·YoY·ROE·변동성·부채비율을 업종 내 Z-Score로 정규화 후 가중 합산한 상대 점수입니다.',
    low: '업종 내 상대적으로 불리한 팩터 조합. 저평가이거나 성장성이 낮음.',
    high: '업종 내 상대적으로 유리한 팩터 조합. 낮은 밸류에이션 + 높은 성장성.',
  },
  peg: {
    label: 'PEG', investor: 'Peter Lynch',
    desc: 'PER ÷ EPS 성장률(%). Lynch가 "One Up on Wall Street"에서 대중화한 지표입니다. 성장 속도 대비 밸류에이션을 측정합니다.',
    low: '1 미만이면 성장에 비해 저평가 — Lynch의 매수 기준. 특히 0.5 이하면 매력적.',
    high: '2 초과면 성장 대비 과도한 프리미엄. 고성장이 이미 주가에 반영됐을 가능성.',
  },
  per: {
    label: 'PER', investor: 'Benjamin Graham, Warren Buffett',
    desc: '주가 ÷ 주당순이익(EPS). 현재 주가가 연간 순이익의 몇 배인지 나타냅니다. Graham은 15배 이하, Buffett은 업종 대비 상대 수준을 중시합니다.',
    low: '저평가 가능성. 단, 이익 부진이나 경기민감 업종에서는 착시 가능.',
    high: '시장이 고성장을 기대하거나 과열 신호. 성장주는 높은 PER이 정당화되기도 함.',
  },
  pbr: {
    label: 'PBR', investor: 'Benjamin Graham',
    desc: '주가 ÷ 주당순자산(BPS). Graham은 PBR 1.5배 이하, PER 15배 이하를 동시 충족하는 종목을 선호했습니다 (Graham Number 공식의 근거).',
    low: '1 미만이면 장부가 이하 거래 — Graham의 안전마진. 청산 시 자산 초과 회수 가능.',
    high: '높은 브랜드 가치·무형자산·ROE 반영 혹은 고평가. Buffett처럼 높은 ROE 기업은 높은 PBR을 감수.',
  },
  epsCagr2Y: {
    label: 'EPS CAGR', investor: 'Philip Fisher, Peter Lynch',
    desc: '2개년 EPS 연평균 성장률(기하평균). 음수 이익 구간은 수학적으로 계산 불가능합니다. Fisher는 지속 성장 기업을, Lynch는 CAGR 대비 PEG를 중시했습니다.',
    low: '0% 미만이면 이익 하강 추세. 구조적 원인(시장 축소, 경쟁 심화)인지 확인 필요.',
    high: '15% 이상이면 성장주 기준. Lynch의 10배 주식은 장기간 높은 CAGR을 유지.',
  },
  epsYoY: {
    label: 'EPS YoY', investor: "William O'Neil",
    desc: "전년 대비 EPS 증가율. O'Neil의 CANSLIM에서 C(Current Earnings)에 해당합니다. 분기 기준은 전년 동기 대비.",
    low: '음수면 실적 악화 진행 중. 일시적 요인(환율, 원자재)인지 구조적 문제인지 구분 중요.',
    high: "25% 이상이면 O'Neil의 성장주 기준 충족. 3개 분기 이상 지속 시 강력한 모멘텀 신호.",
  },
  roe: {
    label: 'ROE', investor: 'Warren Buffett',
    desc: '자기자본이익률 = 당기순이익 ÷ 자기자본 × 100%. Buffett이 "주주를 위한 이익 창출 능력"을 판단할 때 가장 중시하는 지표입니다.',
    low: '낮으면 자본 효율성 저조. 업종 평균 이하면 경쟁력 약화 신호.',
    high: '15% 이상 지속이면 Buffett 기준 우량주. 높은 ROE + 낮은 부채 = 경제적 해자 존재 가능성.',
  },
  epsVol: {
    label: 'EPS 변동성', investor: null,
    desc: 'EPS 성장률의 표준편차. 낮을수록 이익이 안정적으로 성장함을 의미합니다. 퀄리티 팩터의 핵심 구성요소.',
    low: '낮으면 이익의 예측 가능성이 높음. 방어주·독점적 사업구조 기업 특징.',
    high: '높으면 실적 변동성 큼. 경기민감주, 원자재 가격 영향 업종에서 흔함.',
  },
  debtRatio: {
    label: '부채비율', investor: 'Benjamin Graham',
    desc: '총부채 ÷ 자기자본 × 100%. Graham이 재무 안전성의 핵심 지표로 사용했습니다. 낮을수록 Z-Score에 유리하게 반영됩니다.',
    low: '재무 안전성 우수. 경기 침체·금리 상승 시 생존 가능성 높음.',
    high: '200% 초과면 고레버리지 위험. 금리 상승 시 이자비용이 이익을 잠식할 수 있음.',
  },
  grahamNum: {
    label: 'Graham 할인율', investor: 'Benjamin Graham',
    desc: 'Graham Number = √(22.5 × EPS × BPS). Graham이 제시한 주식 내재가치 상한선. 할인율 = (Graham Number - 현재가) / Graham Number × 100%.',
    low: '음수(현재가 > Graham Number)이면 Graham 기준 고평가.',
    high: '양수(현재가 < Graham Number)이면 Graham 기준 저평가. 수치가 클수록 안전마진 확보.',
  },
  roic: {
    label: 'ROIC', investor: 'Joel Greenblatt, Warren Buffett',
    desc: '투하자본이익률 = 세후영업이익 ÷ 투하자본. Greenblatt Magic Formula의 핵심. 투하자본 = 자기자본 + 장기부채 - 현금. 세율 22% 가정.',
    low: '낮으면 투자 대비 이익 창출 부진. WACC(가중평균자본비용) 이하면 가치 파괴 중.',
    high: '15% 이상 지속이면 경쟁사가 모방하기 어려운 경제적 해자 신호. Greenblatt의 매수 기준.',
  },
  earningsYield: {
    label: 'EBIT/EV', investor: 'Joel Greenblatt',
    desc: '기업가치(EV) 대비 영업이익률. Greenblatt Magic Formula의 밸류에이션 지표. EV = 시가총액 + 부채총계 - 현금.',
    low: '낮으면 EV 대비 이익 창출이 적음 → 상대적 고평가 또는 저수익성.',
    high: '높을수록 EV 대비 영업이익 크고 저평가 가능성. Greenblatt는 이 지표 상위 + ROIC 상위 조합을 선호.',
  },
  psr: {
    label: 'PSR', investor: 'Philip Fisher / Ken Fisher',
    desc: '주가매출액비율 = 시가총액 ÷ 연간매출액. Ken Fisher가 "Super Stocks"에서 대중화. 적자 기업 평가에도 사용 가능.',
    low: '0.75 이하이면 Fisher 기준 매수 기회. 제조업 등 저마진 업종에서는 1 이하도 저평가.',
    high: '3 초과이면 Fisher 기준 매도 고려. 고마진 SaaS·플랫폼 기업은 높은 PSR이 정당화되기도 함.',
  },
  piotroski: {
    label: 'Piotroski F-Score', investor: 'Joseph Piotroski',
    desc: '재무 건전성 점수(부분 계산). 이용 가능한 지표로 계산: ① 순이익>0 ② ROA 개선 ③ 레버리지 감소 ④ 자산회전율 개선 ⑤ 매출 성장.',
    low: '점수 낮으면(최대의 40% 이하) 재무 취약. 부실·공매도 위험 신호.',
    high: '점수 높으면(최대의 70% 이상) 재무 우량. Piotroski 연구에서 고점수 주식이 저점수 대비 연 23% 초과수익 확인.',
  },
  pegy: {
    label: 'PEGY', investor: 'Peter Lynch',
    desc: 'PER ÷ (EPS 성장률% + 배당수익률%). Lynch가 PEG에 배당을 추가해 확장한 지표. ※ 이 화면에서는 배당 데이터 없어 EPS 성장률만으로 근사 계산.',
    low: '1 미만이면 성장+배당 대비 저평가. Lynch가 "Ten Bagger" 후보로 주목하는 영역.',
    high: '2 초과면 Lynch 기준 과도한 가격. 배당이 높은 기업에서는 PEGY가 PEG보다 낮게 나옴.',
  },
  epsAccel: {
    label: 'EPS 가속도', investor: "William O'Neil",
    desc: "O'Neil CANSLIM의 A(Accelerating Growth). 이전 기간 YoY% 대비 최근 YoY%의 변화량(퍼센트포인트). 성장이 가속화되고 있는지 측정.",
    low: '음수(%p)면 성장 속도가 둔화 중. 모멘텀 약화 신호.',
    high: "양수(%p)면 성장이 가속화 — O'Neil이 선호하는 패턴. 연속 2~3분기 가속화는 강력한 매수 신호.",
  },
};

const fmt = {
  pct: v => v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`,
  num: (v, d = 1) => v == null ? '—' : v.toFixed(d),
  z:   v => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`,
  peg: v => v == null ? '—' : v.toFixed(2) + '배',
  cap: v => v == null ? '—' : v >= 10000 ? `${(v / 10000).toFixed(1)}조` : `${Math.round(v)}억`,
};

function ZBar({ value }) {
  if (value == null) return <span className="text-surface-muted text-xs">—</span>;
  const abs = Math.min(Math.abs(value), 2.5);
  const pct = (abs / 2.5) * 50;
  const pos = value >= 0;
  return (
    <div className="flex items-center gap-1 justify-end">
      <span className={`text-xs font-mono tabular-nums w-12 text-right ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
        {fmt.z(value)}
      </span>
      <div className="w-9 h-1.5 bg-surface rounded-full overflow-hidden flex">
        {!pos && <div style={{ width: `${pct}%` }} className="h-full ml-auto rounded-full bg-red-400 opacity-70" />}
        {pos  && <div style={{ width: `${pct}%` }} className="h-full rounded-full bg-sky-400 opacity-80" />}
      </div>
    </div>
  );
}

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-surface-muted">—</span>;
  const cls = score >= 0.5  ? 'text-emerald-300 bg-emerald-400/15 border-emerald-400/30'
            : score >= 0    ? 'text-sky-300 bg-sky-400/10 border-sky-400/20'
            : score >= -0.5 ? 'text-amber-300 bg-amber-400/10 border-amber-400/20'
            : 'text-red-300 bg-red-400/10 border-red-400/20';
  return (
    <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold tabular-nums ${cls}`}>
      {score >= 0 ? '+' : ''}{score.toFixed(2)}
    </span>
  );
}

// ── 지표 설명 모달 ─────────────────────────────────────────────────────────────
function MetricInfoModal({ metricKey, onClose }) {
  const info = metricKey ? METRIC_INFO[metricKey] : null;

  useEffect(() => {
    if (!info) return;
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [info, onClose]);

  if (!info) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-surface-card border border-surface-border rounded-xl p-5 max-w-sm w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-surface-text">{info.label}</h3>
            {info.investor && (
              <p className="text-[10px] text-violet-400 mt-0.5">📊 {info.investor}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-surface-muted hover:text-surface-text text-lg leading-none ml-4 flex-shrink-0"
          >
            ×
          </button>
        </div>
        <p className="text-xs text-surface-muted mb-4 leading-relaxed">{info.desc}</p>
        <div className="space-y-2.5">
          <div className="flex gap-2 items-start">
            <span className="text-[10px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 rounded px-1.5 py-0.5 font-semibold whitespace-nowrap mt-0.5">낮으면</span>
            <p className="text-xs text-surface-muted leading-relaxed">{info.low}</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-[10px] bg-red-400/10 text-red-400 border border-red-400/30 rounded px-1.5 py-0.5 font-semibold whitespace-nowrap mt-0.5">높으면</span>
            <p className="text-xs text-surface-muted leading-relaxed">{info.high}</p>
          </div>
        </div>
        <p className="text-[10px] text-surface-muted mt-4 text-right">ESC 또는 × 버튼으로 닫기</p>
      </div>
    </div>
  );
}

// ── 클릭 가능한 헤더 셀 ────────────────────────────────────────────────────────
function Th({ metricKey, children, className = '', onClick }) {
  return (
    <th
      className={`cursor-pointer select-none group ${className}`}
      onClick={() => onClick(metricKey)}
      title="클릭 → 지표 설명"
    >
      <span className="group-hover:text-violet-400 transition-colors">{children}</span>
      <span className="text-[8px] text-surface-muted/40 group-hover:text-violet-400/60 ml-0.5 transition-colors">?</span>
    </th>
  );
}

// ── 결과 테이블 ───────────────────────────────────────────────────────────────
function ResultTable({ current, expandedRow, setExpanded, colSet }) {
  const [infoMetric, setInfoMetric] = useState(null);

  const wk = m => m === 'epsCagr2Y' ? 'cagr' : m === 'epsYoY' ? 'yoy' : m === 'epsVol' ? 'vol' : m === 'debtRatio' ? 'debt' : m;
  const isLegend = colSet === 'legend';

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface border-b border-surface-border">
              {/* 고정 컬럼 */}
              <th className="px-3 py-2 text-left text-surface-muted font-medium sticky left-0 bg-surface z-10 w-6">#</th>
              <th className="px-3 py-2 text-left text-surface-muted font-medium sticky left-9 bg-surface z-10 min-w-[100px]">종목</th>
              <Th metricKey="compositeScore" className="px-3 py-2 text-right text-surface-muted font-medium whitespace-nowrap" onClick={setInfoMetric}>종합점수</Th>
              <Th metricKey="peg" className="px-3 py-2 text-right text-surface-muted font-medium" onClick={setInfoMetric}>PEG</Th>

              {/* 기본 지표 헤더 */}
              {!isLegend && BASIC_COLS.map(col => (
                <Th key={col.key} metricKey={col.infoKey} className="px-2 py-2 text-right text-surface-muted font-medium whitespace-nowrap" onClick={setInfoMetric}>
                  {col.label}
                </Th>
              ))}

              {/* 거장 지표 헤더 */}
              {isLegend && LEGEND_COLS.map(col => (
                <Th key={col.key} metricKey={col.infoKey} className="px-2 py-2 text-right text-surface-muted font-medium whitespace-nowrap" onClick={setInfoMetric}>
                  {col.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.results.map((s, i) => {
              const isExpanded = expandedRow === s.code;
              return (
                <>
                  <tr
                    key={s.code}
                    onClick={() => setExpanded(isExpanded ? null : s.code)}
                    className="border-b border-surface-border/50 cursor-pointer hover:bg-surface-hover transition-colors"
                  >
                    {/* 고정 셀 */}
                    <td className="px-3 py-2 sticky left-0 bg-inherit z-10">
                      {i < 3
                        ? <span className={`font-bold text-xs ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : 'text-amber-600'}`}>{i + 1}</span>
                        : <span className="text-surface-muted text-xs">{i + 1}</span>}
                    </td>
                    <td className="px-3 py-2 sticky left-9 bg-inherit z-10">
                      <div className="font-medium text-surface-text text-xs">{s.name}</div>
                      <div className="text-[10px] text-surface-muted font-mono">{s.code}</div>
                    </td>
                    <td className="px-3 py-2 text-right"><ScoreBadge score={s.compositeScore} /></td>
                    <td className="px-3 py-2 text-right">
                      {s.peg != null
                        ? <span className={`font-mono text-xs ${s.peg < 1 ? 'text-emerald-400' : s.peg < 2 ? 'text-amber-400' : 'text-red-400'}`}>{fmt.peg(s.peg)}</span>
                        : <span className="text-surface-muted text-xs">—</span>}
                    </td>

                    {/* 기본 지표 셀 */}
                    {!isLegend && BASIC_COLS.map(col => {
                      const rawVal = s.raw[col.key];
                      const zVal   = s.zScores?.[col.key];
                      let display = '—';
                      let badge = null;

                      if (rawVal != null) {
                        display = col.fmt(rawVal);
                      } else if (col.key === 'epsCagr2Y' && s.cagrStatus) {
                        const STATUS_CLS = {
                          '흑자전환': 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
                          '적자전환': 'text-red-400 border-red-400/40 bg-red-400/10',
                          '적자지속': 'text-red-300/60 border-red-400/20 bg-red-400/5',
                          '손실축소': 'text-amber-400 border-amber-400/40 bg-amber-400/10',
                        };
                        const cls = STATUS_CLS[s.cagrStatus] ?? 'text-surface-muted border-surface-border';
                        badge = <span className={`inline-block px-1 py-0.5 rounded border text-[9px] font-semibold leading-tight ${cls}`}>{s.cagrStatus}</span>;
                      }

                      return (
                        <td key={col.key} className="px-2 py-2 text-right">
                          <div className={`tabular-nums text-xs font-mono ${rawVal != null ? col.color(rawVal) : 'text-surface-muted'}`}>
                            {badge ?? display}
                          </div>
                          <ZBar value={zVal} />
                        </td>
                      );
                    })}

                    {/* 거장 지표 셀 */}
                    {isLegend && LEGEND_COLS.map(col => {
                      const { main, sub } = col.fmt(s);
                      const colorCls = col.color(s);
                      const hasData = col.getValue(s) != null;
                      return (
                        <td key={col.key} className="px-2 py-2 text-right">
                          <div className={`tabular-nums text-xs font-mono ${hasData ? colorCls || 'text-surface-text' : 'text-surface-muted'}`}>
                            {main}
                          </div>
                          {sub && <div className="text-[10px] text-surface-muted font-mono">{sub}</div>}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 확장 행 */}
                  {isExpanded && (
                    <tr key={`${s.code}-x`} className="bg-surface/50">
                      <td /><td colSpan={99} className="px-5 py-3 space-y-2">
                        {/* 가중 기여 */}
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span className="text-surface-muted font-medium mr-1">가중 기여:</span>
                          {BASIC_COLS.map(({ key, label }) => {
                            const w  = current.weights?.[wk(key)] ?? 0;
                            const zv = s.zScores?.[key];
                            if (!w) return null;
                            const contrib = zv != null ? w * zv : null;
                            return (
                              <span key={key} className="flex items-center gap-1">
                                <span className="text-surface-muted">{label}</span>
                                <span className="text-surface-muted">×{(w * 100).toFixed(0)}%=</span>
                                <span className={contrib == null ? 'text-surface-muted' : contrib >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {contrib == null ? '—' : (contrib >= 0 ? '+' : '') + contrib.toFixed(3)}
                                </span>
                              </span>
                            );
                          })}
                          <span className="ml-2 border-l border-surface-border pl-2 text-surface-muted">
                            시총 <span className="text-surface-text">{fmt.cap(s.marketCapEok)}</span>
                          </span>
                          <span className="text-surface-muted">
                            현재가 <span className="text-surface-text font-mono">{s.price?.toLocaleString()}원</span>
                          </span>
                        </div>

                        {/* DART 추가 지표 */}
                        {s.dart && (
                          <div className="flex flex-wrap gap-3 text-xs items-center border-t border-surface-border/40 pt-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-400/10 border border-orange-400/30 text-orange-300">
                              DART {s.dart.year} {s.dart.fsDiv}
                            </span>
                            {s.dart.roa != null && (
                              <span className="text-surface-muted">ROA <span className="text-surface-text">{fmt.num(s.dart.roa, 1)}%</span></span>
                            )}
                            {s.dart.opMargin != null && (
                              <span className="text-surface-muted">영업이익률 <span className="text-surface-text">{fmt.num(s.dart.opMargin, 1)}%</span></span>
                            )}
                            {s.dart.netMargin != null && (
                              <span className="text-surface-muted">순이익률 <span className="text-surface-text">{fmt.num(s.dart.netMargin, 1)}%</span></span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <MetricInfoModal metricKey={infoMetric} onClose={() => setInfoMetric(null)} />
    </>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export function PEGScreener() {
  const [expanded,     setExpanded]     = useState({ [KR_THEME_GROUPS[0].id]: true });
  const [activeTheme,  setActiveTheme]  = useState(null);
  const [preset,       setPreset]       = useState('it-hardware');
  const [period,       setPeriod]       = useState('annual');
  const [sideOpen,     setSideOpen]     = useState(true);
  const [data,         setData]         = useState({});
  const [loading,      setLoading]      = useState({});
  const [error,        setError]        = useState({});
  const [expandedRow,  setExpandedRow]  = useState(null);
  const [colSet,       setColSet]       = useState('basic');

  const themeKey  = t => t?.naverNo ?? t?.id;
  const cKey      = activeTheme ? `${themeKey(activeTheme.theme)}_${preset}_${period}` : null;
  const current   = cKey ? data[cKey] : null;
  const isLoading = cKey ? !!loading[cKey] : false;
  const err       = cKey ? error[cKey] : null;

  const loadTheme = useCallback(async (theme, p, per, force = false) => {
    const key = `${themeKey(theme)}_${p}_${per}`;
    if (!force && data[key]) return;

    setLoading(prev => ({ ...prev, [key]: true }));
    setError(prev => ({ ...prev, [key]: null }));
    try {
      let res;
      if (theme.naverNo) {
        const url    = force
          ? `${API}/refresh-naver/${theme.naverNo}?group=${p}&period=${per}`
          : `${API}/run-naver/${theme.naverNo}?group=${p}&period=${per}`;
        const method = force ? 'post' : 'get';
        res = await axios({ method, url, timeout: 180000 });
      } else if (theme.stocks) {
        const kisStocks = theme.stocks.map(s => ({ code: toKisCode(s.code), name: s.name }));
        const url    = force
          ? `${API}/refresh-stocks?group=${p}&period=${per}`
          : `${API}/run-stocks?group=${p}&period=${per}`;
        res = await axios.post(url, { themeId: theme.id, stocks: kisStocks }, { timeout: 180000 });
      }
      if (res) setData(prev => ({ ...prev, [key]: res.data }));
    } catch (e) {
      setError(prev => ({ ...prev, [key]: e.response?.data?.error || '데이터 로드 실패' }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [data]);

  useEffect(() => {
    if (activeTheme) loadTheme(activeTheme.theme, preset, period);
  }, [activeTheme, preset, period]); // eslint-disable-line

  const selectTheme = (theme, groupId) => {
    setActiveTheme({ theme, groupId });
    setExpandedRow(null);
  };

  const activeGroup = KR_THEME_GROUPS.find(g => g.id === activeTheme?.groupId);

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="px-5 pt-4 pb-3 border-b border-surface-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-surface-text">PEG 퀀트 스크리너</h2>
          <p className="text-xs text-surface-muted mt-0.5">신한투자증권 방법론 근사 구현 — 업종 전종목 Z-Score 스크리닝 · 24h 캐시</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {WEIGHT_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              title={p.desc}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors
                ${preset === p.id
                  ? p.color === 'sky'
                    ? 'border-sky-400 bg-sky-400/15 text-sky-300'
                    : 'border-emerald-400 bg-emerald-400/15 text-emerald-300'
                  : 'border-surface-border bg-surface text-surface-muted hover:text-surface-text'}`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setColSet(v => v === 'basic' ? 'legend' : 'basic')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors
              ${colSet === 'legend'
                ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                : 'border-surface-border bg-surface text-surface-muted hover:text-surface-text'}`}
          >
            {colSet === 'legend' ? '◁ 기본' : '거장 ▷'}
          </button>
          <div className="flex rounded-lg border border-surface-border overflow-hidden">
            {PERIOD_OPTS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                title={opt.desc}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${period === opt.id
                    ? 'bg-violet-500/20 text-violet-300 border-r border-violet-500/30 last:border-r-0'
                    : 'bg-surface text-surface-muted hover:text-surface-text border-r border-surface-border last:border-r-0'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {activeTheme && (
            <button
              onClick={() => loadTheme(activeTheme.theme, preset, period, true)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-hover border border-surface-border text-surface-muted hover:text-surface-text transition-colors disabled:opacity-50"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : '↻ 재계산'}
            </button>
          )}
        </div>
      </div>

      {/* ── 바디: 사이드바 + 결과 ── */}
      <div className="flex" style={{ minHeight: '420px' }}>

        {/* 사이드바 토글 핸들 */}
        <button
          onClick={() => setSideOpen(v => !v)}
          className="flex-shrink-0 w-5 flex items-center justify-center border-r border-surface-border bg-surface hover:bg-surface-hover text-surface-muted hover:text-surface-text transition-colors"
          title={sideOpen ? '패널 닫기' : '테마 선택 패널 열기'}
        >
          <span className="text-[10px]">{sideOpen ? '◂' : '▸'}</span>
        </button>

        {/* 사이드바 아코디언 */}
        <div
          className="flex-shrink-0 border-r border-surface-border overflow-hidden"
          style={{ width: sideOpen ? '188px' : '0px', transition: 'width 0.25s ease' }}
        >
          <div className="w-[188px] overflow-y-auto bg-surface" style={{ maxHeight: '600px' }}>
            {KR_THEME_GROUPS.map(group => (
              <div key={group.id} className="border-b border-surface-border/30 last:border-b-0">
                <button
                  onClick={() => setExpanded(p => ({ ...p, [group.id]: !p[group.id] }))}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-surface-muted hover:text-surface-text hover:bg-surface-hover transition-colors"
                >
                  <span className="truncate">{group.label}</span>
                  <span className="ml-1 flex-shrink-0 opacity-60">{expanded[group.id] ? '▴' : '▾'}</span>
                </button>
                <div
                  className="overflow-hidden"
                  style={{
                    maxHeight: expanded[group.id] ? `${group.children.length * 52}px` : '0px',
                    transition: 'max-height 0.2s ease',
                  }}
                >
                  {group.children.map(child => {
                    const isActive = activeTheme?.theme.id === child.id;
                    const ck       = `${themeKey(child)}_${preset}_${period}`;
                    const loaded   = !!data[ck];
                    const busy     = !!loading[ck];
                    return (
                      <button
                        key={child.id}
                        onClick={() => selectTheme(child, group.id)}
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors border-l-2
                          ${isActive
                            ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                            : 'border-transparent text-surface-muted hover:text-surface-text hover:bg-surface-hover'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          {busy && <LoadingSpinner size="sm" />}
                          <span className="truncate leading-snug">{child.label}</span>
                        </div>
                        {loaded && !busy && (
                          <div className="text-[10px] text-surface-muted pl-0.5">
                            {data[ck].count ?? data[ck].results?.length}종목 완료
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 결과 영역 */}
        <div className="flex-1 min-w-0 overflow-hidden">

          {/* 브레드크럼 */}
          {activeTheme && (
            <div className="px-4 py-2 border-b border-surface-border flex items-center gap-2 text-xs text-surface-muted flex-wrap">
              <span>{activeGroup?.label}</span>
              <span>›</span>
              <span className="text-surface-text font-medium">{activeTheme.theme.label}</span>
              {activeTheme.theme.desc && (
                <span className="hidden sm:inline opacity-70 truncate">{activeTheme.theme.desc}</span>
              )}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border
                ${period === 'quarter'
                  ? 'text-violet-300 bg-violet-500/15 border-violet-500/30'
                  : 'text-slate-400 bg-slate-400/10 border-slate-400/20'}`}>
                {period === 'quarter' ? '분기' : '연간'}
              </span>
              {current?.timestamp && (
                <span className="ml-auto flex-shrink-0">
                  {new Date(current.timestamp).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <LoadingSpinner />
              <p className="text-sm text-surface-muted">KIS + 네이버 + DART 재무제표 수집 중…</p>
              <p className="text-xs text-surface-muted">전종목 조회는 최초 1~2분 소요 · 이후 24h 캐시</p>
            </div>
          )}

          {!isLoading && err && (
            <div className="py-12 text-center">
              <p className="text-sm text-red-400 mb-3">{err}</p>
              <button
                onClick={() => loadTheme(activeTheme.theme, preset, true)}
                className="px-4 py-2 rounded-lg bg-red-400/10 text-red-400 border border-red-400/30 text-xs hover:bg-red-400/20 transition-colors"
              >
                다시 시도
              </button>
            </div>
          )}

          {!isLoading && !err && current?.results && (
            <ResultTable current={current} expandedRow={expandedRow} setExpanded={setExpandedRow} colSet={colSet} />
          )}

          {!activeTheme && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-center px-6">
              <span className="text-2xl opacity-30">◂</span>
              <p className="text-sm text-surface-muted">왼쪽 패널에서 업종/테마를 선택하세요</p>
              <p className="text-xs text-surface-muted">클릭하면 해당 업종 전종목 PEG Z-Score 스크리닝이 실행됩니다</p>
            </div>
          )}

          {!isLoading && !err && activeTheme && !current && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-surface-muted">{activeTheme.theme.label} 스크리닝 준비</p>
              <button
                onClick={() => loadTheme(activeTheme.theme, preset)}
                className="px-4 py-2 rounded-lg bg-brand-blue/15 text-brand-blue border border-brand-blue/30 text-xs hover:bg-brand-blue/25 transition-colors"
              >
                스크리너 실행
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 하단 주석 */}
      <div className="px-5 py-3 border-t border-surface-border text-[10px] text-surface-muted flex flex-wrap gap-x-4 gap-y-0.5">
        <span>• Z-Score: 업종 내 상대 순위. 역수 적용: PER·PBR·EPS변동성·부채비율</span>
        <span>• 기본형: CAGR 20%+YoY 30% | YoY중심: YoY 50% (배터리·가전 저기저 보정)</span>
        <span>• 거장 지표: 테이블 상단 [거장 ▷] 버튼으로 전환 — 컬럼 헤더 클릭 시 지표 설명</span>
        <span>• DART: Naver 누락 지표 폴백 + Graham·ROIC·PSR·Piotroski·PEGY·EPS가속 계산</span>
      </div>
    </div>
  );
}
