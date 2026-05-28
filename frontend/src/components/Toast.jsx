import { useEffect, useState } from 'react';

/**
 * 사용법: <Toast message="..." type="success|error" onDone={() => setToast(null)} />
 * message가 null이면 렌더링 안 함
 */
export function Toast({ message, type = 'success', onDone }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    // 마운트 직후 slide-in
    const t1 = setTimeout(() => setVisible(true), 10);
    // 2.8초 후 slide-out
    const t2 = setTimeout(() => setVisible(false), 2800);
    // 애니메이션 끝나고 제거
    const t3 = setTimeout(() => onDone?.(), 3300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [message]);

  if (!message) return null;

  const isSuccess = type === 'success';

  return (
    <div
      className="fixed bottom-6 right-6 z-50 transition-all duration-300"
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        opacity: visible ? 1 : 0,
      }}
    >
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm ${
        isSuccess
          ? 'bg-surface-card border-brand-green/30 text-gray-200'
          : 'bg-surface-card border-brand-red/30 text-gray-200'
      }`}>
        {isSuccess ? (
          <div className="w-5 h-5 rounded-full bg-brand-green/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-brand-red/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        <span className="text-xs">{message}</span>
      </div>
    </div>
  );
}
