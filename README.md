# 마켓 대시보드

매크로 브리핑, 뉴스, AI 인사이트, 섹터 히트맵, 경제 캘린더, 주식 스크리너를 한 화면에서 제공하는 금융 대시보드입니다.

## 설치 방법

### 1. API 키 발급

| 서비스 | 발급 경로 | 무료 플랜 |
|--------|-----------|-----------|
| **Finnhub** | https://finnhub.io | 분당 60회 |
| **Anthropic** | https://console.anthropic.com | 종량제 |
| **DART** | https://opendart.fss.or.kr | 무료 |
| **KIS (한국투자증권)** | https://apiportal.koreainvestment.com | 무료 |

### 2. 환경 변수 설정

```bash
cp backend/.env.example backend/.env
# backend/.env 파일에 키 입력
```

```env
FINNHUB_API_KEY=여기에_입력
ANTHROPIC_API_KEY=여기에_입력
DART_API_KEY=여기에_입력
KIS_APP_KEY=여기에_입력
KIS_APP_SECRET=여기에_입력
KIS_ACCOUNT_NO=계좌번호
PORT=3001
```

### 3. 패키지 설치

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. 실행

터미널 두 개를 열어 각각 실행합니다.

```bash
# 터미널 1 - 백엔드
cd backend
npm run dev

# 터미널 2 - 프론트엔드
cd frontend
npm run dev
```

브라우저에서 http://localhost:5173 접속

## 주요 기능

| 기능 | 설명 |
|------|------|
| **시장 지수** | SPY, QQQ, DIA, IWM, VIX 실시간 시세 |
| **매크로 및 리스크** | 금, 원유, 달러, 구리, 국채 ETF, VIX 게이지 |
| **섹터 히트맵** | GICS 11개 섹터 일간 수익률 색상 표시 |
| **뉴스 피드** | 실시간 헤드라인 및 감성 분석 |
| **AI 모닝 브리핑** | Claude 기반 시장 동향, 매크로, 섹터 로테이션, 촉매, 과매도 종목 분석 |
| **경제 캘린더** | 향후 7일간 주요 매크로 이벤트 및 실적 발표 |
| **주식 스크리너** | 60일 변동폭 50% 이상, RSI 20-40 (조정 가능), 상대거래량, 가격 위치 |
| **한국 시장** | KIS API 연동, 테마별 스크리너, PEG 스크리너 |
| **기업 가치평가** | DART 재무 데이터, WACC 자동 계산, DCF 모델 |

## 스크리너 로직

```
전체 종목 (~80개) 순회:
  Finnhub에서 60거래일 OHLC 데이터 조회
  변동폭 = (최고가 - 최저가) / 최저가 * 100
  RSI = Wilder RSI(14), 종가 기준

  포함 조건: 변동폭 >= 설정값 AND RSI 하한 <= RSI <= RSI 상한
```

종목을 8개 배치로 처리하며 속도 제한 적용 (총 45-60초 소요), 결과는 15분간 캐시됩니다.

## 아키텍처

```
frontend/ (React + Vite + Tailwind)   -> http://localhost:5173
  └── /api/* 요청을 백엔드로 프록시

backend/ (Express.js)                 -> http://localhost:3001
  ├── /api/market/indices             Finnhub 시세
  ├── /api/market/sectors             섹터 ETF 시세
  ├── /api/market/macro               원자재, 채권, 환율
  ├── /api/news                       Finnhub 뉴스
  ├── /api/screener                   RSI/변동폭 스크리너
  ├── /api/kr-market                  한국 시장 (KIS)
  ├── /api/valuation                  기업 가치평가 (DART)
  ├── /api/insights/generate          Claude AI 브리핑
  └── /api/insights/calendar          경제 및 실적 캘린더
```
