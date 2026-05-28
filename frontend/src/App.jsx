import { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MarketIndices } from './components/MarketIndices';
import { MacroOverview } from './components/MacroOverview';
import { SectorHeatmap } from './components/SectorHeatmap';
import { NewsPanel } from './components/NewsPanel';
import { AIInsights } from './components/AIInsights';
import { EconomicCalendar } from './components/EconomicCalendar';
import { StockScreener } from './components/StockScreener';
import { MacroDashboard } from './components/MacroDashboard';
import { KoreanIndices, KoreanSectors, KoreanScreener, KoreanNewsDouble } from './components/KoreanMarket';
import { PEGScreener } from './components/PEGScreener';
import { MvpTable } from './components/MvpTable';
import { ValuationMain } from './components/Valuation/ValuationMain';
import { StockScorer } from './components/StockScorer';
import { useApi } from './hooks/useApi';
import { IconUS, IconKR, IconSparkle, IconCalculator, IconScore } from './components/Icons';
import { Toast } from './components/Toast';

export default function App() {
  const [refreshKey, setRefreshKey]       = useState(0);
  const [refreshing, setRefreshing]       = useState(false);
  const [screenerResults, setScreenerResults] = useState([]);
  const [market, setMarket]               = useState('us');   // 'us' | 'kr' | 'valuation' | 'score'
  const [showInsights, setShowInsights]   = useState(true);
  const [toast, setToast]                 = useState(null);
  const [lastRefresh, setLastRefresh]     = useState(null);
  const prevRefreshing                    = useRef(false);

  // refreshing이 true→false 전환될 때 토스트 표시
  useEffect(() => {
    if (prevRefreshing.current && !refreshing) {
      const now = new Date();
      setLastRefresh(now);
      setToast(`새로고침 완료 · ${now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
    }
    prevRefreshing.current = refreshing;
  }, [refreshing]);

  // AI 브리핑에 전달할 데이터 (미국 장 기준)
  const { data: indices }  = useApi('/api/market/indices',  { deps: [refreshKey] });
  const { data: sectors }  = useApi('/api/market/sectors',  { deps: [refreshKey] });
  const { data: macro }    = useApi('/api/market/macro',    { deps: [refreshKey] });
  const { data: usNews }   = useApi('/api/news?category=general&limit=15', { deps: [refreshKey] });
  const { data: krNews }   = useApi('/api/kr-market/news',  { deps: [refreshKey], skip: market !== 'kr' });
  const { data: fredData } = useApi('/api/macro-data',      { deps: [refreshKey] });

  const news = market === 'kr' ? krNews : usNews;

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  return (
    <div className="min-h-screen bg-surface flex flex-col relative">
      <Header onRefreshAll={handleRefreshAll} refreshing={refreshing} lastRefresh={lastRefresh} />
      <Toast message={toast} type="success" onDone={() => setToast(null)} />

      {/* 사이드 플로팅 — 브리핑 닫혔을 때만 표시 */}
      {!showInsights && market !== 'valuation' && market !== 'score' && (
        <button
          onClick={() => setShowInsights(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1.5 px-2 py-4 bg-brand-blue/20 hover:bg-brand-blue/40 text-brand-blue border border-brand-blue/30 border-r-0 rounded-l-lg transition-colors shadow-lg"
          title="AI 모닝 브리핑 열기"
        >
          <IconSparkle className="w-4 h-4" />
          <span className="text-xs font-medium [writing-mode:vertical-rl] rotate-180 tracking-wider">
            브리핑 열기
          </span>
        </button>
      )}

      {/* ─── 시장 탭 (미국 / 한국 / 기업가치평가) ─────────────────────────────────── */}
      <div className="flex items-center gap-0 border-b border-surface-border bg-surface-card px-4">
        <MarketTab
          active={market === 'us'}
          onClick={() => setMarket('us')}
          Icon={IconUS}
          label="미국 시장"
        />
        <MarketTab
          active={market === 'kr'}
          onClick={() => setMarket('kr')}
          Icon={IconKR}
          label="한국 시장"
        />
        <MarketTab
          active={market === 'valuation'}
          onClick={() => setMarket('valuation')}
          Icon={IconCalculator}
          label="기업가치평가 (Beta)"
        />
        <MarketTab
          active={market === 'score'}
          onClick={() => setMarket('score')}
          Icon={IconScore}
          label="종목 점수"
        />
      </div>

      {/* ─── 지수 바 ────────────────────────────────────────────────── */}
      {market === 'us' && <MarketIndices refreshKey={refreshKey} />}
      {market === 'kr' && <KoreanIndices refreshKey={refreshKey} skip={market !== 'kr'} />}

      <main className="flex-1 p-4 space-y-6 max-w-[1800px] mx-auto w-full">

        {market === 'score' ? (
          <StockScorer />
        ) : market === 'valuation' ? (
          <ValuationMain />
        ) : market === 'us' ? (
          <>
            {/* Row 1: 매크로 + 뉴스 + 캘린더 */}
            <section>
              <div className="section-label mb-3">시장 현황</div>
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_260px] gap-4 overflow-hidden" style={{ height: '420px' }}>
                <MacroOverview refreshKey={refreshKey} />
                <NewsPanel refreshKey={refreshKey} market="us" />
                <EconomicCalendar refreshKey={refreshKey} market="us" />
              </div>
            </section>

            {/* Row 2: 섹터 히트맵 + AI 브리핑 (브리핑 닫으면 히트맵 전체 너비) */}
            <section>
              <div className="section-label mb-3">섹터 분석 &amp; AI 브리핑</div>
              <div className={`grid grid-cols-1 gap-4 ${showInsights ? 'lg:grid-cols-[300px_1fr]' : ''}`}>
                <div style={{ minHeight: '340px' }}>
                  <SectorHeatmap refreshKey={refreshKey} />
                </div>
                {showInsights && (
                  <AIInsights
                    indices={indices}
                    sectors={sectors}
                    news={news}
                    screenerResults={screenerResults}
                    macro={macro}
                    fredData={fredData?.fred || null}
                    onClose={() => setShowInsights(false)}
                  />
                )}
              </div>
            </section>

            {/* Row 3: 매크로 경제지표 대시보드 */}
            <section>
              <div className="section-label mb-3">매크로 경제지표</div>
              <MacroDashboard refreshKey={refreshKey} />
            </section>

            {/* Row 4: 미국 종목 스크리너 */}
            <section>
              <div className="section-label mb-3">종목 스크리너</div>
              <StockScreener
                onResults={setScreenerResults}
                label="미국 종목 스크리너"
                desc="S&P 100 + 주요 종목 · 60일 등락폭 ≥50% · RSI 20–40 · 평균회귀 후보"
              />
            </section>
          </>
        ) : (
          <>
            {/* 한국 시장 레이아웃 */}
            {/* Row 1: 섹터 + 뉴스(한/영) + 캘린더 */}
            <section>
              <div className="section-label mb-3">시장 현황</div>
              <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_240px] gap-4 overflow-hidden" style={{ height: '420px' }}>
                <KoreanSectors refreshKey={refreshKey} skip={market !== 'kr'} />
                <KoreanNewsDouble refreshKey={refreshKey} />
                <EconomicCalendar refreshKey={refreshKey} market="kr" />
              </div>
            </section>

            {/* Row 2: 매크로 지표 */}
            <section>
              <div className="section-label mb-3">매크로 경제지표</div>
              <MacroDashboard refreshKey={refreshKey} />
            </section>

            {/* Row 3: MVP 상위 20선 */}
            <section>
              <div className="section-label mb-3">아이투자 MVP 상위 20선</div>
              <MvpTable />
            </section>

            {/* Row 4: PEG 퀀트 스크리너 */}
            <section>
              <div className="section-label mb-3">PEG 퀀트 스크리너</div>
              <PEGScreener />
            </section>

            {/* Row 5: 한국 종목 스크리너 */}
            <section>
              <div className="section-label mb-3">종목 스크리너</div>
              <KoreanScreener />
            </section>
          </>
        )}

      </main>

      <footer className="border-t border-surface-border px-6 py-3 flex items-center justify-between">
        <span className="text-xs text-gray-700">
          Market Overview · 데이터: Yahoo Finance · FRED · AI: Claude Sonnet
        </span>
        <span className="text-xs text-gray-700">
          본 서비스는 투자 조언이 아닙니다. 리서치 참고용으로만 활용하세요.
        </span>
      </footer>
    </div>
  );
}

// ─── 시장 탭 버튼 ─────────────────────────────────────────────────────────────
function MarketTab({ active, onClick, Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 text-sm border-b-2 transition-colors ${
        active
          ? 'border-brand-blue text-brand-blue font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-300'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );
}
