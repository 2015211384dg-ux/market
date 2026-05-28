import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { fmtDate } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorState } from './ErrorState';

const US_CATEGORIES = [
  { value: 'general', label: '일반' },
  { value: 'forex',   label: '외환' },
  { value: 'crypto',  label: '가상화폐' },
  { value: 'merger',  label: 'M&A' },
];

const SENTIMENT_CONFIG = {
  bullish:  { cls: 'badge-green',   label: '강세' },
  bearish:  { cls: 'badge-red',     label: '약세' },
  neutral:  { cls: 'badge-neutral', label: '중립' },
};

export function NewsPanel({ refreshKey, market = 'us' }) {
  const [category, setCategory] = useState('general');
  const [expanded, setExpanded] = useState(null);

  const isKr = market === 'kr';

  // 미국 뉴스: 카테고리 선택 가능 / 한국 뉴스: 단일 엔드포인트
  const apiUrl = isKr
    ? '/api/kr-market/news'
    : `/api/news?category=${category}&limit=25`;

  const { data: news, loading, error, refetch } = useApi(apiUrl, { deps: [refreshKey, category, market] });

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="card-header flex-wrap gap-2">
        <span className="card-title">{isKr ? '한국 시장 뉴스' : '시장 뉴스'}</span>
        {!isKr && (
          <div className="flex gap-1">
            {US_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-2.5 py-0.5 text-xs rounded border transition-colors ${
                  category === cat.value
                    ? 'bg-brand-blue/15 text-brand-blue border-brand-blue/30'
                    : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-surface-border'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
        {isKr && <span className="text-xs text-gray-600">한국 관련 글로벌 뉴스</span>}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-surface-border">
        {loading && (
          <div className="p-4">
            <LoadingSpinner text="뉴스 불러오는 중..." />
          </div>
        )}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {news && news.length === 0 && (
          <div className="p-4 text-xs text-gray-500">뉴스를 찾을 수 없습니다.</div>
        )}
        {news && news.map(item => {
          const isOpen = expanded === item.id;
          const sentiment = SENTIMENT_CONFIG[item.sentiment] || SENTIMENT_CONFIG.neutral;

          return (
            <div
              key={item.id}
              className="px-4 py-3 hover:bg-surface-raised cursor-pointer transition-colors"
              onClick={() => toggle(item.id)}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={sentiment.cls}>{sentiment.label}</span>
                    <span className="text-xs text-gray-600">{item.source}</span>
                    <span className="text-xs text-gray-700">·</span>
                    <span className="text-xs text-gray-600">{fmtDate(item.datetime)}</span>
                  </div>
                  <p className="text-xs text-gray-200 leading-snug line-clamp-2">{item.headline}</p>
                  {isOpen && item.summary && (
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">{item.summary}</p>
                  )}
                  {isOpen && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-brand-blue hover:underline mt-1 inline-block"
                    >
                      전체 기사 보기 →
                    </a>
                  )}
                </div>
                <ChevronIcon open={isOpen} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
