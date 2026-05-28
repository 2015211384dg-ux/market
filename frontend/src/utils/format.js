export function fmtPrice(val, decimals = 2) {
  if (val == null || isNaN(val)) return '—';
  return Number(val).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtPct(val, decimals = 2) {
  if (val == null || isNaN(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${Number(val).toFixed(decimals)}%`;
}

export function fmtVolume(val) {
  if (val == null || isNaN(val)) return '—';
  if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toString();
}

export function fmtTimestamp(unix) {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDate(unix) {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function fmtDateStr(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function changeClass(val) {
  if (val == null) return 'neutral';
  if (val > 0) return 'up';
  if (val < 0) return 'down';
  return 'neutral';
}

export function changeBadge(val) {
  if (val == null) return 'badge-neutral';
  if (val > 0) return 'badge-green';
  if (val < 0) return 'badge-red';
  return 'badge-neutral';
}

export function rsiColor(rsi) {
  if (rsi == null) return 'text-gray-400';
  if (rsi <= 20) return 'text-red-400';
  if (rsi <= 40) return 'text-brand-yellow';
  if (rsi <= 60) return 'text-gray-300';
  if (rsi <= 80) return 'text-brand-green';
  return 'text-green-300';
}

export function rsiBarColor(rsi) {
  if (rsi == null) return 'bg-gray-600';
  if (rsi <= 20) return 'bg-red-500';
  if (rsi <= 40) return 'bg-yellow-500';
  if (rsi <= 60) return 'bg-gray-400';
  if (rsi <= 80) return 'bg-green-500';
  return 'bg-green-300';
}

export function intensityColor(pct) {
  if (pct === null || pct === undefined) return '#1c2128';
  const abs = Math.abs(pct);
  if (pct > 0) {
    if (abs >= 3) return '#166534';
    if (abs >= 2) return '#15803d';
    if (abs >= 1) return '#16a34a';
    if (abs >= 0.5) return '#22c55e33';
    return '#22c55e1a';
  } else {
    if (abs >= 3) return '#7f1d1d';
    if (abs >= 2) return '#991b1b';
    if (abs >= 1) return '#b91c1c';
    if (abs >= 0.5) return '#ef444433';
    return '#ef44441a';
  }
}
