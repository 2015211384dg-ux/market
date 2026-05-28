'use strict';
/**
 * 네이버 증권 차트 API — 한국 주식 일봉 OHLCV
 * URL: https://fchart.stock.naver.com/sise.nhn?symbol=005930&timeframe=day&count=90&requestType=0
 * 응답 형식 (XML): <item data="20250527|71800|73900|71800|73500|11429345"/>
 *                  날짜 | 시가 | 고가 | 저가 | 종가 | 거래량
 */
const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Referer':    'https://finance.naver.com/',
  'Accept':     'text/xml,application/xml,*/*',
};

/**
 * code: 6자리 종목코드 (005930) 또는 Yahoo 형식 (005930.KS / 005930.KQ)
 * count: 조회할 봉 수 (영업일 기준, 기본 90)
 * returns: [{ date, open, high, low, close, volume }, ...] 오래된 순
 */
async function getNaverOHLCV(code, count = 90) {
  const pureCode = code.replace(/\.(KS|KQ)$/i, '');
  const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${pureCode}&timeframe=day&count=${count}&requestType=0`;

  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    const xml  = res.data;

    // <item data="20250527|71800|73900|71800|73500|11429345"/> 파싱
    const matches = [...xml.matchAll(/data="(\d{8})\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)"/g)];
    if (!matches.length) return [];

    return matches.map(m => ({
      date:   m[1],
      open:   +m[2],
      high:   +m[3],
      low:    +m[4],
      close:  +m[5],
      volume: +m[6],
    }));
  } catch (e) {
    return [];
  }
}

module.exports = { getNaverOHLCV };
