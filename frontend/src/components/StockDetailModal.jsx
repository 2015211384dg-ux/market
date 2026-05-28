import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

function fmtMarketCap(val, currency) {
  if (!val) return '—';
  if (currency === 'KRW') {
    if (val >= 1e12) return `₩${(val / 1e12).toFixed(1)}조`;
    if (val >= 1e8)  return `₩${(val / 1e8).toFixed(0)}억`;
    return `₩${val.toLocaleString('ko-KR')}`;
  }
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9)  return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6)  return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function CustomTooltip({ active, payload, label, isKorean }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const fmt = isKorean
    ? `₩${Math.round(v).toLocaleString('ko-KR')}`
    : `$${v?.toFixed(2)}`;
  return (
    <div className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-xs shadow-lg">
      <div className="text-gray-500 mb-0.5">{label}</div>
      <div className="text-gray-200 font-mono font-semibold">{fmt}</div>
    </div>
  );
}

const SECTOR_KO = {
  'Technology': '기술/IT', 'Financial Services': '금융', 'Healthcare': '헬스케어',
  'Consumer Cyclical': '경기소비재', 'Consumer Defensive': '필수소비재',
  'Industrials': '산업재', 'Energy': '에너지', 'Basic Materials': '소재/화학',
  'Communication Services': '통신/미디어', 'Real Estate': '부동산', 'Utilities': '유틸리티',
};
const INDUSTRY_KO = {
  'Semiconductors': '반도체', 'Software—Application': '응용 소프트웨어',
  'Software—Infrastructure': '인프라 소프트웨어', 'Consumer Electronics': '가전',
  'Internet Retail': '인터넷 커머스', 'Internet Content & Information': '인터넷/정보',
  'Banks—Diversified': '종합은행', 'Asset Management': '자산운용',
  'Insurance—Diversified': '종합보험', 'Capital Markets': '자본시장',
  'Drug Manufacturers—General': '제약', 'Biotechnology': '바이오',
  'Medical Devices': '의료기기', 'Health Care Plans': '의료서비스',
  'Auto Manufacturers': '자동차', 'Specialty Retail': '전문 유통',
  'Discount Stores': '대형마트', 'Restaurants': '외식', 'Beverages—Non-Alcoholic': '음료',
  'Oil & Gas Integrated': '정유/가스', 'Oil & Gas E&P': '석유 탐사',
  'Aerospace & Defense': '항공/방산', 'Railroads': '철도', 'Airlines': '항공',
  'Telecom Services': '통신', 'Entertainment': '엔터테인먼트',
  'Electronic Gaming & Multimedia': '게임/멀티미디어',
  'Credit Services': '신용/카드', 'Insurance—Life': '생명보험',
  'Technology': '기술', 'Financial': '금융',
};
const COUNTRY_KO = {
  'US': '미국', 'United States': '미국',
  'KR': '한국', 'South Korea': '한국',
  'JP': '일본', 'Japan': '일본',
  'CN': '중국', 'China': '중국',
  'TW': '대만', 'Taiwan': '대만',
  'DE': '독일', 'Germany': '독일',
  'GB': '영국', 'United Kingdom': '영국',
  'FR': '프랑스', 'France': '프랑스',
  'NL': '네덜란드', 'Netherlands': '네덜란드',
  'SE': '스웨덴', 'Sweden': '스웨덴',
  'IN': '인도', 'India': '인도',
  'SG': '싱가포르', 'Singapore': '싱가포르',
};

function koLabel(map, val) { return val ? (map[val] || val) : null; }

export function StockDetailModal({ symbol, isKorean = false, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    setData(null);

    axios.get(`/api/stock-detail/${symbol}`)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.error || '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [symbol]);

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 차트 min/max 계산
  const chartMin = data?.candles?.length
    ? Math.min(...data.candles.map(c => c.close)) * 0.985
    : undefined;
  const chartMax = data?.candles?.length
    ? Math.max(...data.candles.map(c => c.close)) * 1.015
    : undefined;

  const firstClose = data?.candles?.[0]?.close;
  const lastClose  = data?.candles?.[data.candles.length - 1]?.close;
  const trend      = lastClose && firstClose ? lastClose - firstClose : 0;
  const chartColor = trend >= 0 ? '#22c55e' : '#ef4444';

  const desc = data?.description || '';

  return createPortal(
    /* Backdrop */
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm p-4">
      <div className="relative bg-surface-card border border-surface-border rounded-xl shadow-2xl w-full max-w-2xl mx-auto my-8">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-surface-raised text-gray-500 hover:text-gray-200 transition-colors"
          title="닫기 (ESC)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {loading && (
          <div className="flex items-center justify-center h-64 text-gray-500 text-sm gap-2">
            <span className="w-4 h-4 border border-brand-blue border-t-transparent rounded-full animate-spin" />
            불러오는 중...
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-40 text-brand-red text-sm">
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-4 flex items-start gap-4 border-b border-surface-border">
              {data.logo && (
                <img
                  src={data.logo}
                  alt={data.name}
                  className="w-12 h-12 rounded-lg bg-white object-contain p-0.5 flex-shrink-0"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="min-w-0 flex-1 pr-6">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-gray-100 truncate">
                    {data.name && data.name !== symbol ? data.name : symbol}
                  </h2>
                  <span className="font-mono text-xs text-gray-500 flex-shrink-0">
                    {symbol.replace(/\.(KS|KQ)$/, '')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                  {data.exchange    && <span>{data.exchange}</span>}
                  {data.sector      && <span>· {koLabel(SECTOR_KO, data.sector)}</span>}
                  {data.industry    && <span>· {koLabel(INDUSTRY_KO, data.industry)}</span>}
                  {data.country     && <span>· {koLabel(COUNTRY_KO, data.country)}</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs">
                  {data.marketCap && (
                    <span>
                      <span className="text-gray-600">시가총액 </span>
                      <span className="text-gray-300 font-mono">{fmtMarketCap(data.marketCap, data.currency)}</span>
                    </span>
                  )}
                  {data.employees && (
                    <span>
                      <span className="text-gray-600">임직원 </span>
                      <span className="text-gray-300">{data.employees.toLocaleString()}명</span>
                    </span>
                  )}
                  {data.dividendYield > 0 && (
                    <span>
                      <span className="text-gray-600">배당수익률 </span>
                      <span className="text-gray-300">{(data.dividendYield * 100).toFixed(2)}%</span>
                    </span>
                  )}
                  {data.website && (
                    <a
                      href={data.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-blue hover:underline"
                    >
                      웹사이트 ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Chart */}
            {data.candles?.length > 5 && (
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">최근 {data.candles.length}거래일 주가</span>
                  <span className={`text-xs font-mono font-semibold ${trend >= 0 ? 'text-green-400' : 'text-brand-red'}`}>
                    {trend >= 0 ? '+' : ''}{trend.toFixed(2)} ({firstClose ? ((trend / firstClose) * 100).toFixed(1) : '—'}%)
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.candles} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={chartColor} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2d35" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDate}
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={Math.floor(data.candles.length / 6)}
                    />
                    <YAxis
                      domain={[chartMin, chartMax]}
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                      tickFormatter={v => isKorean ? `₩${Math.round(v).toLocaleString('ko-KR')}` : `$${v.toFixed(0)}`}
                    />
                    <Tooltip content={<CustomTooltip isKorean={isKorean} />} />
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke={chartColor}
                      strokeWidth={1.5}
                      fill="url(#chartGradient)"
                      dot={false}
                      activeDot={{ r: 3, fill: chartColor, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Description */}
            {desc && (
              <div className="px-5 pt-3 pb-5 border-t border-surface-border mt-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  기업 인사이트
                  <span className="ml-1.5 text-gray-700 normal-case font-normal">· AI 요약</span>
                </h3>
                <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="text-xs text-gray-400 leading-relaxed">
                  {desc}
                </p>
              </div>
            )}

            {!desc && (
              <div className="px-5 py-4 border-t border-surface-border mt-1 text-xs text-gray-600">
                기업 설명 정보가 없습니다.
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
