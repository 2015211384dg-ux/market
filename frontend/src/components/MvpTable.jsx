import { useState, useEffect, useRef } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

const API = '/api/mvp';

function fmtDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getDate()}일 (${days[d.getDay()]})`;
}

function fmtMonth(ym) {
  const [y, m] = ym.split('-');
  return `${y}년 ${parseInt(m)}월`;
}

function fmtQuarter(key) {
  const [y, q] = key.split('-');
  return `${y}년 ${q}`;
}

function groupByMonth(articles) {
  const map = {};
  for (const a of articles) {
    const ym = a.date.slice(0, 7);
    if (!map[ym]) map[ym] = [];
    map[ym].push(a);
  }
  return map;
}

// ─── 일별 탭 ────────────────────────────────────────────────────────────────
function DailyView({ articles, isFetching, progress, onRefresh }) {
  const [selectedYm, setSelectedYm]     = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const grouped = groupByMonth(articles);
  const months  = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  useEffect(() => {
    if (articles.length && !selectedDate) {
      const latest = articles[0];
      setSelectedYm(latest.date.slice(0, 7));
      setSelectedDate(latest.date);
    }
  }, [articles.length]);

  const daysInMonth     = selectedYm ? (grouped[selectedYm] || []) : [];
  const selectedArticle = selectedDate ? articles.find(a => a.date === selectedDate) : null;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 월 목록 */}
      <div className="w-32 flex-shrink-0 border-r border-surface-border overflow-y-auto">
        {isFetching && months.length === 0 && <div className="p-3"><LoadingSpinner text="" /></div>}
        {months.map(ym => (
          <button key={ym}
            onClick={() => { setSelectedYm(ym); const f = grouped[ym]?.[0]; if (f) setSelectedDate(f.date); }}
            className={`w-full text-left px-3 py-2.5 text-xs border-b border-surface-border/50 transition-colors ${
              selectedYm === ym ? 'bg-brand-blue/15 text-brand-blue font-medium' : 'text-gray-400 hover:bg-surface-raised hover:text-gray-200'
            }`}
          >
            {fmtMonth(ym)}
            <span className="ml-1 text-gray-600">({grouped[ym].length})</span>
          </button>
        ))}
      </div>

      {/* 일 목록 */}
      <div className="w-28 flex-shrink-0 border-r border-surface-border overflow-y-auto">
        {daysInMonth.map((a, i) => (
          <button key={i}
            onClick={() => setSelectedDate(a.date)}
            className={`w-full text-left px-3 py-2 text-xs border-b border-surface-border/50 transition-colors ${
              selectedDate === a.date ? 'bg-brand-blue/15 text-brand-blue font-medium' : 'text-gray-400 hover:bg-surface-raised hover:text-gray-200'
            }`}
          >
            {fmtDay(a.date)}
          </button>
        ))}
      </div>

      {/* 표 */}
      <div className="flex-1 overflow-auto p-4">
        {!selectedArticle && articles.length === 0 && !isFetching && (
          <div className="text-xs text-gray-600 py-8 text-center">서버 시작 후 자동으로 수집합니다.<br />잠시 후 새로고침해주세요.</div>
        )}
        {!selectedArticle && articles.length > 0 && (
          <div className="text-xs text-gray-600 py-8 text-center">왼쪽에서 월과 날짜를 선택하세요</div>
        )}
        {selectedArticle && (
          <>
            <div className="mb-3 text-xs text-gray-500">{selectedArticle.title}</div>
            {selectedArticle.rows?.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-surface-border">
                        {selectedArticle.headers.map((h, i) => (
                          <th key={i} className="px-2 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedArticle.rows.map((row, ri) => (
                        <tr key={ri} className="border-b border-surface-border/50 hover:bg-surface-raised transition-colors">
                          {row.map((cell, ci) => {
                            const isChange = selectedArticle.headers[ci]?.includes('등락');
                            const rankCls = ri === 0 ? 'text-yellow-400' : ri === 1 ? 'text-gray-200' : ri === 2 ? 'text-orange-400' : 'text-gray-400';
                            return (
                              <td key={ci} className={`px-2 py-1.5 whitespace-nowrap ${rankCls}`}>
                                {isChange
                                  ? <span className={cell.includes('▲') || cell.startsWith('+') ? 'text-red-400' : cell.includes('▼') || cell.startsWith('-') ? 'text-blue-400' : ''}>{cell}</span>
                                  : ci === 0 ? <span className="font-bold">{cell}</span> : cell}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-xs text-gray-700 text-right">출처: 대한민국 NO1 가치투자포털 아이투자</div>
              </>
            ) : (
              <div className="text-xs text-gray-600 py-4">표 데이터를 파싱하지 못했습니다.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── 분기별 탭 ────────────────────────────────────────────────────────────────
function QuarterlyView() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [selectedQ, setSelectedQ] = useState(null);

  useEffect(() => {
    fetch(`${API}/quarterly`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        const keys = Object.keys(d.quarters || {});
        if (keys.length) setSelectedQ(keys[0]); // 최신 분기 기본 선택
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6"><LoadingSpinner text="집계 중..." /></div>;
  if (!data?.quarters || !Object.keys(data.quarters).length)
    return <div className="p-6 text-xs text-gray-600">데이터가 없습니다. 일별 수집 후 다시 시도해주세요.</div>;

  const quarters = Object.keys(data.quarters); // 이미 최신순 정렬
  const rows = selectedQ ? data.quarters[selectedQ] : [];

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 분기 목록 */}
      <div className="w-32 flex-shrink-0 border-r border-surface-border overflow-y-auto">
        {quarters.map(q => (
          <button key={q}
            onClick={() => setSelectedQ(q)}
            className={`w-full text-left px-3 py-3 text-xs border-b border-surface-border/50 transition-colors ${
              selectedQ === q ? 'bg-brand-blue/15 text-brand-blue font-medium' : 'text-gray-400 hover:bg-surface-raised hover:text-gray-200'
            }`}
          >
            {fmtQuarter(q)}
            <div className="text-gray-600 mt-0.5">{data.quarters[q]?.[0]?.totalDays ?? '-'}거래일</div>
          </button>
        ))}
      </div>

      {/* 집계 표 */}
      <div className="flex-1 overflow-auto p-4">
        {selectedQ && (
          <>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-sm font-medium text-gray-200">{fmtQuarter(selectedQ)} MVP 언급 상위 20선</span>
              <span className="text-xs text-gray-600">총 {rows[0]?.totalDays ?? '-'}거래일 기준</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="px-2 py-2 text-left text-gray-500 font-medium w-10">순위</th>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium">종목명</th>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium">언급 횟수</th>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium">출현율</th>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium">평균 순위</th>
                    <th className="px-2 py-2 text-left text-gray-500 font-medium">최고 순위</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-surface-border/50 hover:bg-surface-raised transition-colors">
                      <td className={`px-2 py-1.5 font-bold ${ri === 0 ? 'text-yellow-400' : ri === 1 ? 'text-gray-200' : ri === 2 ? 'text-orange-400' : 'text-gray-400'}`}>
                        {row.rank}
                      </td>
                      <td className={`px-2 py-1.5 font-medium ${ri === 0 ? 'text-yellow-400' : ri === 1 ? 'text-gray-200' : ri === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                        {row.name}
                      </td>
                      <td className="px-2 py-1.5 text-gray-300">{row.count}회</td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-surface-raised rounded-full overflow-hidden">
                            <div className="h-full bg-brand-blue/70 rounded-full" style={{ width: `${Math.min(row.pct, 100)}%` }} />
                          </div>
                          <span className="text-gray-400">{row.pct}%</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-gray-400">{row.avgRank}위</td>
                      <td className="px-2 py-1.5 text-gray-400">{row.bestRank}위</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-gray-700 text-right">출처: 대한민국 NO1 가치투자포털 아이투자</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function MvpTable() {
  const [tab, setTab]       = useState('daily'); // 'daily' | 'quarterly'
  const [allData, setAllData]   = useState(null);
  const [status, setStatus]     = useState(null);
  const pollRef = useRef(null);

  const loadAll = () => {
    fetch(`${API}/all`).then(r => r.json()).then(d => {
      setAllData(d);
      setStatus(d.status);
    }).catch(() => {});
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (status === 'fetching') {
      pollRef.current = setInterval(() => {
        fetch(`${API}/status`).then(r => r.json()).then(s => {
          setStatus(s.status);
          if (s.status !== 'fetching') { clearInterval(pollRef.current); loadAll(); }
          else loadAll();
        });
      }, 3000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [status]);

  const handleRefresh = () => {
    if (window.confirm('1년치 데이터를 다시 수집합니다. 계속하시겠습니까?')) {
      fetch(`${API}/refresh`).then(() => {
        setAllData(d => d ? { ...d, articles: [], status: 'fetching' } : null);
        setStatus('fetching');
      });
    }
  };

  const articles   = allData?.articles || [];
  const isFetching = status === 'fetching';
  const progress   = allData?.progress;

  return (
    <div className="card flex flex-col overflow-hidden" style={{ minHeight: '540px' }}>
      {/* 헤더 */}
      <div className="card-header flex-wrap gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="card-title">아이투자 MVP 상위 20선</span>
          <span className="text-xs text-gray-600">
            {isFetching
              ? `수집 중... ${progress?.current ?? 0} / ${progress?.total ?? '?'} 기사`
              : `최근 1년 · ${articles.length}개 기사`}
          </span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          {isFetching && <span className="text-xs text-yellow-500 animate-pulse">● 백그라운드 수집 중</span>}

          {/* 내부 탭 */}
          <div className="flex rounded border border-surface-border overflow-hidden text-xs">
            <button
              onClick={() => setTab('daily')}
              className={`px-3 py-1 transition-colors ${tab === 'daily' ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-500 hover:text-gray-300'}`}
            >
              일별
            </button>
            <button
              onClick={() => setTab('quarterly')}
              className={`px-3 py-1 border-l border-surface-border transition-colors ${tab === 'quarterly' ? 'bg-brand-blue/20 text-brand-blue' : 'text-gray-500 hover:text-gray-300'}`}
            >
              분기별 언급
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className="text-xs px-2.5 py-1 rounded border border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors disabled:opacity-40"
          >
            재수집
          </button>
        </div>
      </div>

      {tab === 'daily'
        ? <DailyView articles={articles} isFetching={isFetching} progress={progress} onRefresh={handleRefresh} />
        : <QuarterlyView />
      }
    </div>
  );
}
