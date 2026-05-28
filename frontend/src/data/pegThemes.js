/**
 * PEG 퀀트 스크리너 — 섹터 그룹 계층 정의
 * 신한투자증권 "PER로 사고 PEG로 고른다" (2026-05-06) 기준
 *
 * 그룹별 팩터 가중치:
 *   it-hardware / machinery : PER 20% | PBR 10% | EPS 2Y CAGR 20% | EPS YoY 30% | ROE 10% | EPS변동성 5% | 부채비율 5%
 *   it-appliances            : PER 20% | PBR 10% | EPS YoY 50%     | ROE 10%     | EPS변동성 5% | 부채비율 5%
 */
export const PEG_THEME_GROUPS = [
  {
    id:        'it-hardware',
    label:     'IT하드웨어',
    color:     'sky',
    reportPeg: 0.6,
    position:  '비중확대',
    children: [
      { id: 'elec-equip',    label: '전자장비/기기',  naverNo: '282', desc: '전자장비와기기 업종 전종목' },
      { id: 'telecom-equip', label: '통신장비',        naverNo: '294', desc: '통신장비 업종 전종목' },
      { id: 'handset',       label: '핸드셋/부품',     naverNo: '292', desc: '핸드셋 업종 전종목' },
      { id: 'semi-all',      label: '반도체/장비',     naverNo: '278', desc: '반도체와반도체장비 업종 전종목' },
      { id: 'display-eq',    label: '디스플레이장비',  naverNo: '269', desc: '디스플레이장비및부품 업종 전종목' },
    ],
  },
  {
    id:        'it-appliances',
    label:     'IT가전 / 2차전지',
    color:     'emerald',
    reportPeg: 0.5,
    position:  '비중확대*',
    children: [
      { id: 'bat-equip',  label: '전기장비/배터리', naverNo: '306', desc: '전기장비 업종 전종목 (배터리·전력기기 포함)' },
      { id: 'elec-prod',  label: '전기제품/가전',   naverNo: '283', desc: '전기제품 업종 전종목' },
    ],
  },
  {
    id:        'machinery',
    label:     '기계 / 전력기기',
    color:     'amber',
    reportPeg: 1.4,
    position:  '비중유지',
    children: [
      { id: 'machinery',   label: '기계',     naverNo: '299', desc: '기계 업종 전종목' },
      { id: 'power-equip', label: '전력기기', naverNo: '306', desc: '전기장비 업종 전종목 (전력기기)' },
      { id: 'shipbuilding',label: '조선',     naverNo: '291', desc: '조선 업종 전종목' },
      { id: 'aerospace',   label: '우주항공/방산', naverNo: '284', desc: '우주항공과국방 업종 전종목' },
    ],
  },
];
