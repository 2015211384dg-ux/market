/**
 * Calculate RSI using Wilder's smoothing method (standard).
 * @param {number[]} closes - Array of closing prices, oldest first
 * @param {number} period - RSI period (default 14)
 * @returns {number} RSI value 0–100
 */
function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  // First average: simple mean over first `period` changes
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Wilder smoothing for remaining data
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Calculate 60-trading-day price range as percentage.
 * Returns (maxHigh - minLow) / minLow * 100
 * @param {number[]} highs
 * @param {number[]} lows
 * @returns {number} Range percentage
 */
function calculate60DayRange(highs, lows) {
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  if (minLow <= 0) return 0;
  return ((maxHigh - minLow) / minLow) * 100;
}

/**
 * Calculate Average True Range (ATR) — useful for volatility context.
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number} period
 * @returns {number}
 */
function calculateATR(highs, lows, closes, period = 14) {
  if (highs.length < period + 1) return null;
  const trueRanges = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }
  const initialATR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let atr = initialATR;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return atr;
}

/**
 * Determine RSI zone label.
 */
function getRSIZone(rsi) {
  if (rsi === null) return 'unknown';
  if (rsi <= 20) return 'oversold_extreme';
  if (rsi <= 40) return 'oversold';
  if (rsi <= 60) return 'neutral';
  if (rsi <= 80) return 'overbought';
  return 'overbought_extreme';
}

module.exports = {
  calculateRSI,
  calculate60DayRange,
  calculateATR,
  getRSIZone,
};
