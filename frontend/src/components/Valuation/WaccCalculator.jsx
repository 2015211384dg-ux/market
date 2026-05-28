import { useState, useEffect } from 'react';

// 산업군별 Unlevered Beta (KOSPI/KOSDAQ 실증치 기반 근사값)
const INDUSTRY_BETA = {
  '반도체·전자부품': 1.30,
  '바이오·제약':     1.40,
  '자동차·모빌리티': 1.00,
  '2차전지·에너지':  1.30,
  '소프트웨어·AI':   1.20,
  '금융·은행·보험':  0.85,
  '화학·철강·소재':  1.05,
  '기계·건설·조선':  1.00,
  '유통·리테일':     0.90,
  '식음료·소비재':   0.70,
  '미디어·엔터·게임':1.10,
  '기타':            1.00,
};

const BASE = {
  rf:      3.5,
  erp:     5.5,
  kd:      4.5,
  taxRate: 24,
};

/** riskMetrics, industry로 종목별 초기값 계산 */
function deriveDefaults(riskMetrics, industry) {
  // 베타: 실제 계산값 우선, 없으면 업종 평균
  const beta = (riskMetrics?.beta != null && !isNaN(riskMetrics.beta))
    ? riskMetrics.beta
    : (INDUSTRY_BETA[industry] ?? 1.0);

  // 부채비중(Wd): debtRatio = D/E × 100 → Wd% = DR/(100+DR)
  let wd = 30;
  const dr = parseFloat(riskMetrics?.debtRatio);
  if (!isNaN(dr) && dr > 0) {
    wd = Math.round(dr / (100 + dr) * 100);
    wd = Math.min(70, Math.max(10, wd));
  }

  // Kd: DART 이자비용/금융부채로 계산된 실제값, 없으면 기본 4.5%
  const kd = (riskMetrics?.kd != null && !isNaN(riskMetrics.kd))
    ? riskMetrics.kd
    : BASE.kd;

  // 실효세율: DART 법인세비용/세전이익, 없으면 기본 24%
  const taxRate = (riskMetrics?.effectiveTaxRate != null && !isNaN(riskMetrics.effectiveTaxRate))
    ? riskMetrics.effectiveTaxRate
    : BASE.taxRate;

  return { ...BASE, beta, wd, kd, taxRate };
}

export default function WaccCalculator({ onApply, riskMetrics, industry }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(() => deriveDefaults(riskMetrics, industry));
  // 종목/산업 바뀔 때마다 초기값 재계산
  useEffect(() => {
    setV(deriveDefaults(riskMetrics, industry));
  }, [riskMetrics, industry]);

  const set = (key, raw) => setV(p => ({ ...p, [key]: parseFloat(raw) || 0 }));

  const ke         = +(v.rf + v.beta * v.erp).toFixed(2);
  const we         = 100 - v.wd;
  const kdAfterTax = +(v.kd * (1 - v.taxRate / 100)).toFixed(2);
  const wacc       = +((ke * we / 100) + (kdAfterTax * v.wd / 100)).toFixed(2);
  const outOfRange = wacc > 15 || wacc < 4;

  // 자동 설정된 항목들
  const hasBeta    = riskMetrics?.beta             != null;
  const hasWd      = riskMetrics?.debtRatio        != null;
  const hasKd      = riskMetrics?.kd               != null;
  const hasTaxRate = riskMetrics?.effectiveTaxRate  != null;
  const hasCompanyData = hasBeta || hasWd || hasKd || hasTaxRate;

  if (!open) return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-xs text-gray-500 hover:text-brand-blue transition-colors flex items-center gap-1"
    >
      <span className="text-base leading-none">+</span> CAPM으로 WACC 계산하기
    </button>
  );

  return (
    <div className="mt-3 bg-[#0d1117] border border-[#30363d] rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#30363d]">
        <span className="text-sm font-semibold text-gray-200">CAPM · WACC 계산기</span>
        <button
          onClick={() => setOpen(false)}
          className="text-gray-500 hover:text-gray-200 transition-colors text-sm px-2 py-0.5 rounded"
        >
          닫기
        </button>
      </div>

      {/* 자동 설정 안내 배너 */}
      {hasCompanyData ? (
        <div className="mx-5 mt-4 px-4 py-2.5 bg-brand-blue/5 border border-brand-blue/20 rounded-xl flex items-start gap-2">
          <span className="text-brand-blue text-sm mt-0.5">✦</span>
          <p className="text-xs text-gray-400 leading-relaxed">
            <span className="text-brand-blue font-semibold">{industry}</span> 업종 β·부채비율을 자동 적용했습니다.
            값을 직접 수정할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="mx-5 mt-4 px-4 py-2.5 bg-[#161b22] border border-[#30363d] rounded-xl">
          <p className="text-xs text-gray-500">
            DART 동기화 후 종목별 β·부채비율이 자동 반영됩니다.
          </p>
        </div>
      )}

      <div className="px-5 py-4 space-y-5">
        {/* 입력 필드 */}
        <div className="space-y-3">
          <p className="text-xs text-gray-500 font-medium">자기자본비용 (Ke)</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="무위험이자율 Rf" value={v.rf}   onChange={e => set('rf',   e.target.value)} />
            <Field label="베타 β"          value={v.beta} onChange={e => set('beta', e.target.value)} step="0.05" highlight={hasBeta} hint={hasBeta ? '실측(1Y)' : '업종 평균'} />
            <Field label="위험프리미엄 ERP" value={v.erp}  onChange={e => set('erp',  e.target.value)} />
          </div>

          <p className="text-xs text-gray-500 font-medium mt-1">타인자본비용 (Kd)</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="부채비중 Wd"   value={v.wd}      onChange={e => set('wd',      e.target.value)} highlight={hasWd} hint={hasWd      ? '재무제표' : null} />
            <Field label="세전 부채비용"  value={v.kd}      onChange={e => set('kd',      e.target.value)} highlight={hasKd} hint={hasKd      ? '재무제표' : null} />
            <Field label="법인세율"       value={v.taxRate} onChange={e => set('taxRate', e.target.value)} highlight={hasTaxRate} hint={hasTaxRate ? '재무제표' : null} />
          </div>
        </div>

        {/* 계산 결과 */}
        <div className="space-y-2">
          <div className="bg-brand-blue/10 border border-brand-blue/20 rounded-xl py-3 text-center">
            <p className="text-xs text-gray-500 mb-1">WACC</p>
            <p className="text-xl font-bold text-brand-blue">{wacc}%</p>
          </div>
          <div className="flex items-center justify-center gap-5 bg-[#161b22] rounded-xl px-4 py-2.5">
            <span className="text-xs text-gray-500">
              자기자본비용 Ke <span className="text-brand-green font-semibold ml-1">{ke}%</span>
            </span>
            <span className="text-gray-700 text-xs">·</span>
            <span className="text-xs text-gray-500">
              세후 부채비용 Kd <span className="text-orange-400 font-semibold ml-1">{kdAfterTax}%</span>
            </span>
          </div>
        </div>

        {/* 범위 경고 */}
        {wacc > 15 && (
          <p className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 leading-relaxed">
            계산된 WACC {wacc}%는 슬라이더 최대값(15%)을 초과합니다.
            적용 시 <strong>15%</strong>로 처리됩니다.
          </p>
        )}
        {wacc < 4 && (
          <p className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 leading-relaxed">
            계산된 WACC {wacc}%는 슬라이더 최솟값(4%)보다 낮습니다.
            입력값을 다시 확인해주세요. 적용 시 <strong>4%</strong>로 처리됩니다.
          </p>
        )}

        {/* 적용 버튼 */}
        <button
          onClick={() => { onApply(wacc); setOpen(false); }}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
            outOfRange
              ? 'bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30'
              : 'bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue border border-brand-blue/30'
          }`}
        >
          WACC {Math.min(15, Math.max(4, wacc))}% 적용
          {outOfRange && <span className="ml-1.5 text-xs opacity-60">(클램핑됨)</span>}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, step = '0.1', highlight = false, hint = null }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={`text-xs ${highlight ? 'text-brand-blue/70' : 'text-gray-500'}`}>
          {label}
        </label>
        {hint && (
          <span className={`text-[10px] ${highlight ? 'text-brand-blue/50' : 'text-gray-600'}`}>
            {hint}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type="number"
          step={step}
          value={value}
          onChange={onChange}
          className={`w-full px-3 pr-6 py-2 bg-[#161b22] border rounded-lg text-right text-gray-100 text-sm font-mono focus:outline-none transition-colors ${
            highlight
              ? 'border-brand-blue/30 focus:border-brand-blue/60'
              : 'border-[#30363d] focus:border-brand-blue/60'
          }`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-600 pointer-events-none">%</span>
      </div>
    </div>
  );
}
