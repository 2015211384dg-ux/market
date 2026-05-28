const BEARISH_WORDS = [
  'crash', 'plunge', 'fall', 'drop', 'decline', 'loss', 'bear', 'fear',
  'recession', 'inflation', 'cut', 'layoff', 'default', 'crisis', 'warning',
  'concern', 'risk', 'weak', 'miss', 'disappoint', 'selloff', 'below',
];

const BULLISH_WORDS = [
  'surge', 'rally', 'rise', 'gain', 'beat', 'record', 'high', 'bull',
  'growth', 'strong', 'upgrade', 'buy', 'boost', 'exceed', 'profit',
  'recovery', 'rebound', 'optimism', 'positive', 'breakout', 'above',
];

function estimateSentiment(text) {
  const lower = text.toLowerCase();
  let score = 0;
  BULLISH_WORDS.forEach(w => { if (lower.includes(w)) score++; });
  BEARISH_WORDS.forEach(w => { if (lower.includes(w)) score--; });
  if (score > 0) return 'bullish';
  if (score < 0) return 'bearish';
  return 'neutral';
}

module.exports = { estimateSentiment };
