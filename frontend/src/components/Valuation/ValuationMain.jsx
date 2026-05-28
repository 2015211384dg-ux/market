import { useState } from 'react';
import ValuationWizard from './ValuationWizard';
import ValuationResults from './ValuationResults';
import ValuationHistory from './ValuationHistory';
import { useValuationHistory } from '../../hooks/useValuationHistory';

export function ValuationMain() {
  const [step, setStep] = useState(1);          // 1=wizard, 2=results
  const [valuationData, setValuationData] = useState(null);

  const { history, save, remove, clear } = useValuationHistory();

  const handleComplete = (data) => {
    setValuationData(data);
    save(data);          // localStorage 저장
    setStep(2);
  };

  const handleReset = () => {
    setValuationData(null);
    setStep(1);
  };

  /** 히스토리 카드 클릭 → 저장된 결과 화면 복원 */
  const handleHistoryView = (fullData) => {
    setValuationData(fullData);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full min-h-[600px] flex flex-col p-6 animate-in fade-in duration-700">
      {/* 페이지 헤더 */}
      <div className="mb-8 relative">
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-12 bg-brand-blue rounded-r-full shadow-[0_0_15px_rgba(88,166,255,0.5)]"></div>
        <h1 className="text-3xl font-extrabold text-gray-100 tracking-tight">기업가치평가 엔진</h1>
        <p className="text-sm text-gray-500 mt-2 font-medium">
          DART 실시간 연동 기반 DCF &amp; 상대가치 복합 밸류에이션 시스템
        </p>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-grow">
        {step === 1 ? (
          <ValuationWizard onComplete={handleComplete} />
        ) : (
          <ValuationResults data={valuationData} onReset={handleReset} />
        )}
      </div>

      {/* 히스토리 패널 — 항상 표시 (있을 때만 렌더) */}
      <ValuationHistory
        history={history}
        onView={handleHistoryView}
        onDelete={remove}
        onClear={clear}
      />
    </div>
  );
}
