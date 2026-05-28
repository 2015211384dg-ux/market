import { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { postApi, getApi } from '../hooks/useApi';
import { IconX, IconSparkle, IconRefresh } from './Icons';

export function AIInsights({ indices, sectors, news, screenerResults, macro, fredData, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cached, setCached] = useState(false);

  const hasFredData = fredData && Object.values(fredData).some(arr => arr?.some(i => i.value !== null));

  const generate = useCallback(async (force = false) => {
    if (!indices || !news) return;
    setLoading(true);
    setError(null);
    try {
      const res = await postApi('/api/insights/generate', {
        indices,
        sectors,
        news,
        screenerResults,
        macro,
        fredData,
        forceRefresh: force,
      });
      setContent(res.content);
      setCached(res.cached);
    } catch (err) {
      setError(err?.response?.data?.error || '브리핑 생성 실패');
    } finally {
      setLoading(false);
    }
  }, [indices, sectors, news, screenerResults, macro, fredData]);

  const hasData = indices && news;

  // 열릴 때 캐시만 조회 (Claude API 호출 없음 — 버튼 클릭 시에만 호출)
  useEffect(() => {
    if (!content && !loading) {
      getApi('/api/insights/cached')
        .then(res => {
          if (res.content) {
            setContent(res.content);
            setCached(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  return (
    <div className="card flex flex-col">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <IconSparkle className="w-3.5 h-3.5 text-brand-blue" />
          <span className="card-title">AI 모닝 브리핑</span>
          <span className="badge-blue">Claude</span>
          {hasFredData && <span className="badge-green">경제지표 포함</span>}
          {cached && <span className="badge-neutral">캐시됨</span>}
        </div>
        <div className="flex items-center gap-2">
          {content && (
            <button
              onClick={() => generate(true)}
              disabled={loading || !hasData}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
            >
              <IconRefresh className="w-3 h-3" />
              재생성
            </button>
          )}
          <button
            onClick={() => generate(false)}
            disabled={loading || !hasData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue rounded border border-brand-blue/20 transition-colors disabled:opacity-40"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border border-brand-blue border-t-transparent rounded-full animate-spin" />
                생성 중...
              </>
            ) : content ? (
              '새로고침'
            ) : (
              '브리핑 생성'
            )}
          </button>
          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="p-1 text-gray-600 hover:text-gray-300 hover:bg-surface-raised rounded transition-colors"
            title="브리핑 닫기"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {!hasData && !loading && (
          <div className="text-center py-6 text-gray-600 text-sm">
            먼저 시장 데이터를 불러온 후 브리핑을 생성하세요.
          </div>
        )}

        {hasData && !content && !loading && !error && (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 mb-3">
              실시간 시장 지수 · 섹터 로테이션 · 뉴스 촉매제 · 과매도 종목을 종합 분석합니다.
              {hasFredData && (
                <span className="text-green-500"> FRED 경제지표(CPI, PCE, 금리, 고용, GDP 등)도 반영됩니다.</span>
              )}
              {!hasFredData && (
                <span className="text-gray-600"> FRED API 키를 설정하면 경제지표도 분석에 포함됩니다.</span>
              )}
            </p>
            <button
              onClick={() => generate(false)}
              className="px-4 py-2 text-sm bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue rounded border border-brand-blue/20 transition-colors"
            >
              모닝 브리핑 생성하기
            </button>
          </div>
        )}

        {error && (
          <div className="text-xs text-brand-red bg-brand-red/10 rounded px-3 py-2">{error}</div>
        )}

        {loading && !content && (
          <div className="space-y-3 py-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-surface-raised rounded animate-pulse w-1/4" />
                <div className="h-2.5 bg-surface-raised rounded animate-pulse" />
                <div className="h-2.5 bg-surface-raised rounded animate-pulse w-5/6" />
              </div>
            ))}
          </div>
        )}

        {content && (
          <div className="ai-content">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
