export function LoadingSpinner({ size = 'sm', text = '' }) {
  const sizeClass = size === 'lg' ? 'h-8 w-8 border-2' : 'h-4 w-4 border-2';
  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClass} rounded-full border-surface-border border-t-brand-blue animate-spin`} />
      {text && <span className="text-xs text-gray-500">{text}</span>}
    </div>
  );
}

export function SkeletonLine({ w = 'full' }) {
  return <div className={`h-3 bg-surface-raised rounded animate-pulse w-${w}`} />;
}

export function CardSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <SkeletonLine w="1/3" />
      <SkeletonLine />
      <SkeletonLine w="4/5" />
      <SkeletonLine w="2/3" />
    </div>
  );
}
