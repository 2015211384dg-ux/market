import { useState, useEffect, useRef, useMemo } from 'react';
import { IconRefresh, IconSearch } from '../Icons';
import WaccCalculator from './WaccCalculator';

const INDUSTRIES = [
  '반도체·전자부품', '바이오·제약', '자동차·모빌리티', '2차전지·에너지',
  '소프트웨어·AI', '금융·은행·보험', '화학·철강·소재', '기계·건설·조선',
  '유통·리테일', '식음료·소비재', '미디어·엔터·게임', '기타'
];

export default function ValuationWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    companyName: '',
    stockCode: '',
    industry: '반도체·전자부품',
    revenue: '',
    operatingProfit: '',
    ebitda: '',
    netDebt: '',
    netIncome: '',
    currentPrice: null,
    sharesOutstanding: null,
    wacc: 8.5,
    terminalGrowth: 2.0,
    growthRate: 10.0,        // 단기 성장률 — terminalGrowth로 수렴
    riskMetrics: null,
    trend: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState(null);       // DART 동기화 에러
  const [validationError, setValidationError] = useState(null);  // 제출 유효성 에러
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [allStocks, setAllStocks] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await fetch('/api/valuation/all-stocks');
        const data = await response.json();
        if (data.success) setAllStocks(data.stocks);
      } catch (error) {
        console.error('Failed to cache stocks:', error);
      }
    };
    fetchStocks();
  }, []);

  useEffect(() => {
    if (formData.companyName.length >= 2 && !formData.stockCode && allStocks.length > 0) {
      const query = formData.companyName.toLowerCase();
      const filtered = allStocks
        .filter(s => s.name.toLowerCase().includes(query) || s.code.includes(query))
        .slice(0, 10);
      setSearchResults(filtered);
      setShowDropdown(filtered.length > 0);
      setActiveIndex(-1);
    } else if (formData.companyName.length < 2 || formData.stockCode) {
      setSearchResults([]);
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  }, [formData.companyName, formData.stockCode, allStocks]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCompany = (company) => {
    setFormData(prev => ({ ...prev, companyName: company.name, stockCode: company.code }));
    setShowDropdown(false);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'companyName' && formData.stockCode) {
      setFormData(prev => ({ ...prev, companyName: value, stockCode: '' }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || searchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) handleSelectCompany(searchResults[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleDartSync = async () => {
    if (!formData.stockCode) return;
    setIsLoading(true);
    setSyncError(null);
    try {
      // 산업군을 query param으로 전달 → 산업별 EBITDA 멀티플 적용
      const response = await fetch(
        `/api/valuation/company-data/${formData.stockCode}?industry=${encodeURIComponent(formData.industry)}`
      );
      const data = await response.json();
      if (data.success) {
        setFormData(prev => ({
          ...prev,
          revenue:          Math.round(data.financials.revenue),
          operatingProfit:  Math.round(data.financials.operatingProfit),
          ebitda:           Math.round(data.financials.ebitda),
          netDebt:          Math.round(data.financials.netDebt),
          netIncome:        Math.round(data.financials.netIncome),
          currentPrice:     data.market.currentPrice,
          sharesOutstanding:data.market.sharesOutstanding,
          riskMetrics:      data.riskMetrics,
          trend:            data.trend
        }));
        setStep(3);
      } else {
        setSyncError(data.error || 'DART 데이터를 불러오지 못했습니다.');
      }
    } catch (error) {
      console.error('DART Sync Error:', error);
      setSyncError('네트워크 오류가 발생했습니다. 직접 입력을 이용해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setValidationError(null);
    if (!formData.sharesOutstanding || parseFloat(formData.sharesOutstanding) <= 0) {
      setValidationError('상장주식수를 입력해주세요.');
      return;
    }
    if (!formData.currentPrice || parseFloat(formData.currentPrice) <= 0) {
      setValidationError('현재 주가를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        ebitda:           parseFloat(formData.ebitda)           || 0,
        netIncome:        parseFloat(formData.netIncome)        || 0,
        netDebt:          parseFloat(formData.netDebt)          || 0,
        sharesOutstanding:parseFloat(formData.sharesOutstanding)|| 0,
        currentPrice:     parseFloat(formData.currentPrice)     || 0,
        wacc:             parseFloat(formData.wacc),
        terminalGrowth:   parseFloat(formData.terminalGrowth),
        growthRate:       parseFloat(formData.growthRate)
      };

      const response = await fetch('/api/valuation/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        onComplete({
          ...data,
          stockCode:   formData.stockCode,     // ← 결과 화면 표시용
          industry:    formData.industry,
          companyName: formData.companyName,
          wacc:        formData.wacc,
          terminalGrowth: formData.terminalGrowth,
          growthRate:  formData.growthRate,
          financials:  { netDebt: parseFloat(formData.netDebt) || 0 },
          market:      { currentPrice: formData.currentPrice, sharesOutstanding: formData.sharesOutstanding },
          trend:       formData.trend
        });
      } else {
        setValidationError(data.error || '계산 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Calculate Error:', error);
      setValidationError('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculatedRiskMetrics = useMemo(() => {
    if (formData.riskMetrics) return formData.riskMetrics;
    const netDebt  = parseFloat(formData.netDebt)  || 0;
    const revenue  = parseFloat(formData.revenue)  || 1;
    const opProfit = parseFloat(formData.operatingProfit) || 0;
    return {
      debtRatio:    ((netDebt / (revenue * 0.5)) * 100).toFixed(1),
      netDebtRatio: ((netDebt / (revenue * 0.5)) * 100).toFixed(1),
      currentRatio: '—',
      opMargin:     (revenue > 0 ? (opProfit / revenue * 100) : 0).toFixed(1)
    };
  }, [formData.netDebt, formData.revenue, formData.operatingProfit, formData.riskMetrics]);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl w-full max-w-4xl mx-auto overflow-hidden backdrop-blur-sm bg-opacity-80">
      {/* 스텝 인디케이터 */}
      <div className="flex items-center justify-center gap-3 border-b border-[#30363d] bg-[#0d1117]/50 px-8 py-4">
        {[
          { num: 1, label: '대상 기업' },
          { num: 2, label: '재무 정보' },
          { num: 3, label: '가치 가정' },
        ].map(({ num, label }, idx) => (
          <div key={num} className="flex items-center gap-3">
            {/* 구분자 */}
            {idx > 0 && (
              <span className="text-gray-700 text-sm select-none">›</span>
            )}
            {/* 스텝 */}
            <div className={`flex items-center gap-2 transition-all duration-300 ${step === num ? 'opacity-100' : 'opacity-35'}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                step > num
                  ? 'bg-brand-blue/20 text-brand-blue'
                  : step === num
                    ? 'bg-brand-blue text-white shadow-[0_0_12px_rgba(88,166,255,0.35)]'
                    : 'bg-[#30363d] text-gray-500'
              }`}>
                {step > num ? '✓' : num}
              </div>
              <span className={`text-sm font-semibold ${step === num ? 'text-gray-100' : 'text-gray-500'}`}>
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-10 min-h-[400px] flex flex-col">
        {/* ── STEP 1: 대상 기업 ── */}
        {step === 1 && (
          <div className="flex-1 space-y-10 max-w-lg mx-auto w-full py-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1">기업 및 종목 검색</label>
              <div className="relative group">
                <input
                  type="text" name="companyName" value={formData.companyName}
                  onChange={handleChange} onKeyDown={handleKeyDown}
                  className="w-full pl-12 pr-4 py-4 bg-[#0d1117] border border-[#30363d] rounded-2xl focus:outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 text-gray-100 text-lg transition-all placeholder:text-gray-600"
                  placeholder="예: 삼성전자" autoComplete="off"
                />
                <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-brand-blue transition-colors" />
                {formData.stockCode && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-brand-blue/20 text-brand-blue text-xs font-black rounded-lg border border-brand-blue/30">
                    {formData.stockCode}
                  </span>
                )}
              </div>
              {showDropdown && (
                <div className="absolute z-50 w-full mt-3 bg-[#1c2128] border border-[#30363d] rounded-2xl shadow-2xl max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                  {searchResults.map((result, idx) => (
                    <button
                      key={result.code} onClick={() => handleSelectCompany(result)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full text-left px-5 py-4 flex items-center justify-between group transition-colors border-b border-[#30363d]/50 last:border-0 ${activeIndex === idx ? 'bg-brand-blue/20' : 'hover:bg-brand-blue/10'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-brand-blue opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="text-gray-100 font-bold">{result.name}</span>
                      </div>
                      <span className="text-xs font-mono text-gray-400 group-hover:text-brand-blue transition-colors">{result.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">산업군 세그먼트</label>
              <div className="grid grid-cols-2 gap-3">
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind} onClick={() => setFormData(prev => ({ ...prev, industry: ind }))}
                    className={`px-4 py-3 rounded-xl text-xs font-bold transition-all border ${formData.industry === ind ? 'bg-brand-blue/20 border-brand-blue text-brand-blue shadow-[0_0_15px_rgba(88,166,255,0.15)]' : 'bg-[#0d1117] border-[#30363d] text-gray-500 hover:border-gray-500'}`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: DART 동기화 ── */}
        {step === 2 && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in slide-in-from-right-4 duration-500">
            {/* 선택 기업 요약 카드 */}
            <div className="w-full max-w-md bg-[#0d1117] border border-brand-blue/20 rounded-2xl px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-1">선택된 기업</p>
                <p className="text-lg font-black text-gray-100">{formData.companyName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formData.industry}</p>
              </div>
              <span className="px-3 py-1.5 bg-brand-blue/20 text-brand-blue text-sm font-black rounded-xl border border-brand-blue/30 font-mono">
                {formData.stockCode}
              </span>
            </div>

            <div className="text-center max-w-md w-full">
              <div className="w-16 h-16 bg-brand-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-brand-blue/20">
                <IconRefresh className={`w-8 h-8 text-brand-blue ${isLoading ? 'animate-spin' : ''}`} />
              </div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">IB 실전 재무모델링 엔진</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                최근 3개년 재무 추이 분석 및 수익성·건전성 지표를 기반으로<br/>미래 현금흐름을 시뮬레이션합니다.
              </p>

              {/* DART 에러 메시지 */}
              {syncError && (
                <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 font-medium">
                  {syncError}
                </div>
              )}

              <button
                onClick={handleDartSync} disabled={isLoading || !formData.stockCode}
                className="w-full py-4 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-2xl text-base font-black transition-all hover:scale-[1.02] shadow-lg shadow-brand-blue/20 disabled:opacity-30"
              >
                {isLoading ? '데이터 추이 분석 중...' : '실시간 DART 추이 데이터 로드'}
              </button>
            </div>

            {/* 직접 입력 — 보조 버튼으로 격상 */}
            <button
              onClick={() => { setSyncError(null); setStep(3); }}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#0d1117] border border-[#30363d] hover:border-gray-500 text-gray-400 hover:text-gray-100 rounded-xl text-xs font-bold transition-all"
            >
              <span>직접 입력하여 모델링하기</span>
              <span className="text-[10px] text-gray-600">→</span>
            </button>
          </div>
        )}

        {/* ── STEP 3: 재무 데이터 & 가치 가정 ── */}
        {step === 3 && (
          <div className="flex-1 space-y-8 w-full animate-in zoom-in-95 duration-500">
            {/* 재무 건전성 진단 배너 */}
            <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-[2rem] p-8 relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                <div className="max-w-xs">
                  <h5 className="text-[10px] font-black text-brand-blue uppercase tracking-[0.2em] mb-3">IB 실무 재무 건전성 진단</h5>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                    수익성(OPM)과 부채비율을 분석하여 최적의 할인율(WACC) 산출 근거를 제공합니다.
                  </p>
                </div>
                <div className="flex-grow grid grid-cols-3 gap-12 border-l border-brand-blue/10 pl-12">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">부채비율</p>
                    <p className={`text-2xl font-black ${parseFloat(calculatedRiskMetrics.debtRatio) > 150 ? 'text-brand-red' : 'text-gray-100'}`}>
                      {calculatedRiskMetrics.debtRatio}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">영업이익률</p>
                    <p className="text-2xl font-black text-brand-green">{calculatedRiskMetrics.opMargin}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">순차입금</p>
                    <p className="text-2xl font-black text-gray-100">
                      {formData.netDebt ? Number(formData.netDebt).toLocaleString() : 0}억
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* 좌측: 재무 및 시장 데이터 입력 */}
              <div className="bg-[#0d1117] p-8 rounded-3xl border border-[#30363d]">
                <h4 className="text-xs font-black text-brand-blue uppercase mb-8">재무 및 시장 데이터</h4>
                <div className="space-y-5">
                  {[
                    { id: 'revenue',          label: '매출액',       unit: '억원' },
                    { id: 'operatingProfit',   label: '영업이익',     unit: '억원' },
                    { id: 'ebitda',            label: 'EBITDA',       unit: '억원' },
                    { id: 'netIncome',         label: '당기순이익',   unit: '억원' },   // ← 추가
                    { id: 'netDebt',           label: '순차입금',     unit: '억원' },   // ← 추가
                    { id: 'sharesOutstanding', label: '상장주식수',   unit: '주' },
                    { id: 'currentPrice',      label: '현재가',       unit: '원' }
                  ].map(item => (
                    <div key={item.id}>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <label className="text-xs font-bold text-gray-500">{item.label}</label>
                        <span className="text-[10px] text-gray-600">{item.unit}</span>
                      </div>
                      <input
                        type="number" name={item.id} value={formData[item.id] || ''}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-[#161b22] border border-[#30363d] rounded-xl text-right text-gray-100 font-mono text-sm focus:outline-none focus:border-brand-blue transition-colors"
                        placeholder="0"
                      />
                      {/* 숫자 가독성 — 입력값 콤마 포맷 힌트 */}
                      {formData[item.id] && Number(formData[item.id]) !== 0 && (
                        <p className="text-right text-[10px] text-gray-600 mt-1 font-mono">
                          {Number(formData[item.id]).toLocaleString()} {item.unit}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 우측: 모델 가정 슬라이더 */}
              <div className="space-y-6">
                <div className="p-6 bg-brand-blue/5 border border-brand-blue/20 rounded-3xl">
                  <h4 className="text-xs font-black text-brand-blue uppercase mb-6 italic">Model Assumptions (DCF Base)</h4>
                  <div className="space-y-8">
                    {/* WACC */}
                    <div>
                      <div className="flex justify-between mb-3">
                        <label className="text-sm font-bold text-gray-300">WACC (Risk-Adjusted)</label>
                        <span className="text-lg font-black text-brand-blue">{formData.wacc}%</span>
                      </div>
                      <input type="range" name="wacc" min="4.0" max="15.0" step="0.1"
                        value={formData.wacc} onChange={handleChange}
                        className="w-full h-1.5 bg-[#30363d] rounded-lg appearance-none accent-brand-blue"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600 mt-1 font-mono">
                        <span>4.0%</span><span>15.0%</span>
                      </div>
                      {/* CAPM 계산 도우미 */}
                      <WaccCalculator
                        onApply={(wacc) => setFormData(prev => ({ ...prev, wacc: Math.min(15, Math.max(4, parseFloat(wacc))) }))}
                        riskMetrics={formData.riskMetrics}
                        industry={formData.industry}
                      />
                    </div>

                    {/* 단기 성장률 */}
                    <div>
                      <div className="flex justify-between mb-3">
                        <div>
                          <label className="text-sm font-bold text-gray-300">Short-term Growth (r₀)</label>
                          <p className="text-[10px] text-gray-600 mt-0.5">초기 성장률 → Long-term g 수렴</p>
                        </div>
                        <span className="text-lg font-black text-yellow-400">{formData.growthRate}%</span>
                      </div>
                      <input type="range" name="growthRate" min="0.0" max="30.0" step="0.5"
                        value={formData.growthRate} onChange={handleChange}
                        className="w-full h-1.5 bg-[#30363d] rounded-lg appearance-none accent-yellow-400"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600 mt-1 font-mono">
                        <span>0.0%</span><span>30.0%</span>
                      </div>
                    </div>

                    {/* 영구 성장률 */}
                    <div>
                      <div className="flex justify-between mb-3">
                        <label className="text-sm font-bold text-gray-300">Long-term Growth (g)</label>
                        <span className="text-lg font-black text-brand-green">{formData.terminalGrowth}%</span>
                      </div>
                      <input type="range" name="terminalGrowth" min="0.0" max="5.0" step="0.1"
                        value={formData.terminalGrowth} onChange={handleChange}
                        className="w-full h-1.5 bg-[#30363d] rounded-lg appearance-none accent-brand-green"
                      />
                      <div className="flex justify-between text-[10px] text-gray-600 mt-1 font-mono">
                        <span>0.0%</span><span>5.0%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 산업별 FCF 비율 안내 */}
                <div className="px-5 py-4 bg-[#0d1117] border border-[#30363d] rounded-2xl">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                    산업 FCF/EBITDA 전환율 (자동 적용)
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    <span className="text-brand-blue font-bold">{formData.industry}</span> 업종 기준으로 CAPEX·세금 차감 후
                    잉여현금흐름 비율이 자동 설정됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 유효성 에러 메시지 */}
            {validationError && (
              <div className="px-5 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 font-medium text-center">
                {validationError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 네비게이션 */}
      <div className="border-t border-[#30363d] px-10 py-6 bg-[#0d1117]/80 flex justify-between items-center">
        <button
          onClick={() => { setValidationError(null); setSyncError(null); setStep(s => Math.max(1, s - 1)); }}
          disabled={step === 1 || isLoading}
          className="px-6 py-3 text-xs font-black text-gray-500 hover:text-gray-100 disabled:opacity-0 transition-all uppercase tracking-widest"
        >
          Back
        </button>
        {step < 3 ? (
          <button
            onClick={() => setStep(s => Math.min(3, s + 1))}
            disabled={!formData.stockCode && step === 1}
            className="px-8 py-3 bg-[#30363d] hover:bg-gray-700 text-gray-100 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-30 transition-all"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-10 py-4 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl text-sm font-black transition-all hover:scale-105 shadow-xl shadow-brand-blue/20 disabled:opacity-50"
          >
            {isLoading ? '계산 중...' : 'RUN VALUATION ENGINE'}
          </button>
        )}
      </div>
    </div>
  );
}
