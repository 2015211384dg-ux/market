/**
 * 한국 테마/섹터 계층 구조
 *
 * 그룹 → 서브테마 두 단계
 * 서브테마 유형:
 *   naverNo  : 네이버 업종 번호 → 백엔드에서 전종목 동적 로드
 *   stocks   : 큐레이션 종목 리스트 (code = Yahoo Finance 형식)
 */
export const KR_THEME_GROUPS = [
  // ─── 반도체/IT ────────────────────────────────────────────────────────────
  {
    id: 'semiconductor',
    label: '반도체/IT',
    children: [
      // ── 반도체 8대 공정 ──────────────────────────────────────────────────
      { id: 'semi_all',    label: '반도체 전체',          naverNo: '278', desc: '반도체와반도체장비 업종 전종목' },

      // ① 웨이퍼·소재: 실리콘 웨이퍼 제조·세정·특수가스·공정소재
      { id: 'semi_wafer',  label: '① 웨이퍼·소재',       desc: '웨이퍼 제조·세정·특수가스·SiC 부품', stocks: [
        { code: '036930.KQ', name: '주성엔지니어링' },
        { code: '084370.KQ', name: '유진테크' },
        { code: '183300.KQ', name: '코미코' },
        { code: '101160.KQ', name: '월덱스' },
        { code: '031860.KQ', name: '이엔에프테크놀로지' },
        { code: '014680.KQ', name: '한솔케미칼' },
        { code: '104830.KQ', name: '원익머트리얼즈' },
        { code: '357780.KS', name: '솔브레인' },
        { code: '083450.KQ', name: 'GST' },
        { code: '240810.KQ', name: '원익IPS' },
        { code: '166090.KQ', name: '하나머티리얼즈' },
        { code: '272450.KQ', name: '케이피에스' },
      ]},

      // ② 포토(노광) 공정: PR·펠리클·포토마스크·세정·애싱
      { id: 'semi_photo',  label: '② 포토(노광) 공정',   desc: '포토레지스트·펠리클·마스크·세정·애싱 장비', stocks: [
        { code: '005290.KQ', name: '동진쎄미켐' },
        { code: '036810.KQ', name: '에프에스티' },
        { code: '039030.KQ', name: '이오테크닉스' },
        { code: '319660.KQ', name: '피에스케이' },
        { code: '357780.KS', name: '솔브레인' },
        { code: '014680.KQ', name: '한솔케미칼' },
        { code: '183300.KQ', name: '코미코' },
        { code: '036930.KQ', name: '주성엔지니어링' },
        { code: '114110.KQ', name: '한양이엔지' },
        { code: '120110.KS', name: '코오롱인더' },
        { code: '031860.KQ', name: '이엔에프테크놀로지' },
        { code: '278990.KQ', name: '에이피티씨' },
        { code: '317330.KQ', name: '덕산테코피아' },
      ]},

      // ③ 식각(Etch) 공정: 건식·습식 식각 장비·가스·소재·SiC 부품
      { id: 'semi_etch',   label: '③ 식각(Etch) 공정',  desc: '건식·습식 식각 장비·가스·소재·SiC 부품', stocks: [
        { code: '240810.KQ', name: '원익IPS' },
        { code: '278990.KQ', name: '에이피티씨' },
        { code: '187900.KQ', name: '디바이스이엔지' },
        { code: '166090.KQ', name: '하나머티리얼즈' },
        { code: '104830.KQ', name: '원익머트리얼즈' },
        { code: '083450.KQ', name: 'GST' },
        { code: '357780.KS', name: '솔브레인' },
        { code: '005290.KQ', name: '동진쎄미켐' },
        { code: '036810.KQ', name: '에프에스티' },
        { code: '319660.KQ', name: '피에스케이' },
        { code: '036930.KQ', name: '주성엔지니어링' },
        { code: '031860.KQ', name: '이엔에프테크놀로지' },
        { code: '322310.KQ', name: '오트로닉스' },
      ]},

      // ④ 이온주입·확산: 이온주입 후 열처리·어닐링·확산 장비·소재
      { id: 'semi_ion',    label: '④ 이온주입·확산',     desc: '열처리·레이저 어닐링·확산·이온주입 관련 장비·소재', stocks: [
        { code: '084370.KQ', name: '유진테크' },
        { code: '036930.KQ', name: '주성엔지니어링' },
        { code: '039030.KQ', name: '이오테크닉스' },
        { code: '240810.KQ', name: '원익IPS' },
        { code: '319660.KQ', name: '피에스케이' },
        { code: '014680.KQ', name: '한솔케미칼' },
        { code: '104830.KQ', name: '원익머트리얼즈' },
        { code: '357780.KS', name: '솔브레인' },
        { code: '083450.KQ', name: 'GST' },
        { code: '031860.KQ', name: '이엔에프테크놀로지' },
        { code: '183300.KQ', name: '코미코' },
      ]},

      // ⑤ 증착(CVD·ALD·PVD) 공정: 박막 증착 장비·전구체·소재
      { id: 'semi_depo',   label: '⑤ 증착(CVD·ALD) 공정', desc: 'CVD·ALD·PVD 장비·전구체·소재', stocks: [
        { code: '240810.KQ', name: '원익IPS' },
        { code: '036930.KQ', name: '주성엔지니어링' },
        { code: '084370.KQ', name: '유진테크' },
        { code: '014680.KQ', name: '한솔케미칼' },
        { code: '357780.KS', name: '솔브레인' },
        { code: '104830.KQ', name: '원익머트리얼즈' },
        { code: '064760.KQ', name: '티씨케이' },
        { code: '083450.KQ', name: 'GST' },
        { code: '114110.KQ', name: '한양이엔지' },
        { code: '031860.KQ', name: '이엔에프테크놀로지' },
        { code: '183300.KQ', name: '코미코' },
        { code: '272450.KQ', name: '케이피에스' },
        { code: '029480.KQ', name: '광전자' },
      ]},

      // ⑥ CMP·금속배선: 슬러리·CMP 장비·세정·Cu 배선 소재
      { id: 'semi_cmp',    label: '⑥ CMP·금속배선',      desc: 'CMP 슬러리·장비·Cu 배선·세정 소재', stocks: [
        { code: '281820.KQ', name: '케이씨텍' },
        { code: '357780.KS', name: '솔브레인' },
        { code: '014680.KQ', name: '한솔케미칼' },
        { code: '005290.KQ', name: '동진쎄미켐' },
        { code: '183300.KQ', name: '코미코' },
        { code: '036810.KQ', name: '에프에스티' },
        { code: '031860.KQ', name: '이엔에프테크놀로지' },
        { code: '007660.KS', name: '이수페타시스' },
        { code: '240810.KQ', name: '원익IPS' },
        { code: '084370.KQ', name: '유진테크' },
        { code: '166090.KQ', name: '하나머티리얼즈' },
      ]},

      // ⑦ EDS·계측·검사: 웨이퍼 전기 검사·번인·AFM·소켓
      { id: 'semi_eds',    label: '⑦ EDS·계측·검사',     desc: '전기검사·번인테스트·소켓·AFM·계측 장비', stocks: [
        { code: '019570.KQ', name: '리노공업' },
        { code: '131290.KQ', name: '티에스이' },
        { code: '080580.KQ', name: '오킨스전자' },
        { code: '086390.KQ', name: '유니테스트' },
        { code: '140860.KQ', name: '파크시스템스' },
        { code: '950130.KQ', name: '엑시콘' },
        { code: '131970.KQ', name: '두산테스나' },
        { code: '098120.KQ', name: '마이크로컨텍솔' },
        { code: '039030.KQ', name: '이오테크닉스' },
        { code: '036540.KQ', name: 'SFA반도체' },
        { code: '025560.KQ', name: '미래산업' },
        { code: '089010.KQ', name: '켐트로닉스' },
        { code: '281820.KQ', name: '케이씨텍' },
      ]},

      // ⑧ 패키징·기판: OSAT·FC-BGA·HBM 기판·어드밴스드 패키징
      { id: 'semi_pkg',    label: '⑧ 패키징·기판',       desc: 'OSAT·FC-BGA 기판·TC본더·어드밴스드 패키징', stocks: [
        { code: '042700.KQ', name: '한미반도체' },
        { code: '036540.KQ', name: 'SFA반도체' },
        { code: '131970.KQ', name: '두산테스나' },
        { code: '361610.KS', name: 'SK아이이테크놀로지' },
        { code: '007660.KS', name: '이수페타시스' },
        { code: '222800.KQ', name: '심텍' },
        { code: '008060.KS', name: '대덕전자' },
        { code: '090460.KQ', name: '비에이치' },
        { code: '051290.KQ', name: '인터플렉스' },
        { code: '019570.KQ', name: '리노공업' },
        { code: '950130.KQ', name: '엑시콘' },
        { code: '025560.KQ', name: '미래산업' },
        { code: '140860.KQ', name: '파크시스템스' },
        { code: '078020.KQ', name: '이베스트투자증권' },
      ]},

      // ── AI·HBM / 광통신 ────────────────────────────────────────────────
      { id: 'ai_hbm',      label: 'AI·HBM',              desc: 'HBM·AI 가속기·온디바이스 AI 핵심주', stocks: [
        { code: '000660.KS', name: 'SK하이닉스' },
        { code: '005930.KS', name: '삼성전자' },
        { code: '042700.KQ', name: '한미반도체' },
        { code: '240810.KQ', name: '원익IPS' },
        { code: '019570.KQ', name: '리노공업' },
        { code: '357780.KS', name: '솔브레인' },
        { code: '039030.KQ', name: '이오테크닉스' },
        { code: '086390.KQ', name: '유니테스트' },
        { code: '222800.KQ', name: '심텍' },
        { code: '007660.KS', name: '이수페타시스' },
        { code: '281820.KQ', name: '케이씨텍' },
        { code: '361610.KS', name: 'SK아이이테크놀로지' },
      ]},
      { id: 'fiber_optic',  label: '광통신',               desc: 'AI 데이터센터 광케이블·트랜시버', stocks: [
        { code: '138080.KQ', name: '오이솔루션' },
        { code: '056360.KQ', name: '코위버' },
        { code: '230240.KQ', name: 'HFR' },
        { code: '095270.KQ', name: '웨이브일렉트로' },
        { code: '073490.KQ', name: '이노와이어리스' },
        { code: '184230.KQ', name: '엑스게이트' },
        { code: '064290.KQ', name: '인텍플러스' },
        { code: '040610.KQ', name: 'SCI이버텍' },
        { code: '010580.KQ', name: '파이버프로' },
        { code: '214430.KQ', name: '아이씨티케이' },
        { code: '048870.KQ', name: '에이치씨테크' },
        { code: '089470.KQ', name: 'HDC현대EP' },
      ]},

      // ── 네이버 업종 전종목 (나머지 IT) ─────────────────────────────────
      { id: 'display_panel', label: '디스플레이 패널',     naverNo: '327', desc: '디스플레이패널 업종 전종목' },
      { id: 'display_eq',    label: '디스플레이 장비',     naverNo: '269', desc: '디스플레이장비및부품 업종 전종목' },
      { id: 'it_svc',        label: 'IT서비스',            naverNo: '267', desc: 'IT서비스 업종 전종목' },
      { id: 'software',      label: '소프트웨어',          naverNo: '287', desc: '소프트웨어 업종 전종목' },
      { id: 'network_equip', label: '통신장비',            naverNo: '294', desc: '통신장비 업종 전종목' },
      { id: 'handset',       label: '스마트폰/핸드셋',     naverNo: '292', desc: '핸드셋 업종 전종목' },
      { id: 'elec_equip',    label: '전자장비/기기',       naverNo: '282', desc: '전자장비와기기 업종 전종목' },
    ],
  },

  // ─── 에너지/친환경 ────────────────────────────────────────────────────────
  {
    id: 'energy',
    label: '에너지/친환경',
    children: [
      { id: 'hydrogen',    label: '수소',           desc: '수소 생산·저장·연료전지·수소차', stocks: [
        { code: '271940.KQ', name: '일진하이솔루스' },
        { code: '336260.KS', name: '두산퓨얼셀' },
        { code: '298040.KS', name: '효성중공업' },
        { code: '288620.KQ', name: '에스퓨얼셀' },
        { code: '383310.KQ', name: '범한퓨얼셀' },
        { code: '126340.KQ', name: '비나텍' },
        { code: '126880.KQ', name: '제이엔케이히터' },
        { code: '120110.KS', name: '코오롱인더' },
        { code: '036460.KS', name: '한국가스공사' },
        { code: '005490.KS', name: 'POSCO홀딩스' },
        { code: '001440.KS', name: '대한전선' },
      ]},
      { id: 'ess_battery', label: 'ESS/2차전지',    desc: '에너지저장장치·배터리 셀·소재', stocks: [
        { code: '373220.KS', name: 'LG에너지솔루션' },
        { code: '006400.KS', name: '삼성SDI' },
        { code: '247540.KQ', name: '에코프로비엠' },
        { code: '086520.KQ', name: '에코프로' },
        { code: '278280.KQ', name: '천보' },
        { code: '121600.KQ', name: '나노신소재' },
        { code: '005070.KQ', name: '코스모신소재' },
        { code: '096770.KS', name: 'SK이노베이션' },
        { code: '003670.KS', name: '포스코퓨처엠' },
        { code: '361610.KS', name: 'SK아이이테크놀로지' },
        { code: '006840.KS', name: '일진머티리얼즈' },
        { code: '004000.KS', name: '롯데정밀화학' },
      ]},
      { id: 'nuclear',     label: '원전/SMR',       desc: '원전 기자재·SMR·원전 수출', stocks: [
        { code: '034020.KS', name: '두산에너빌리티' },
        { code: '298040.KS', name: '효성중공업' },
        { code: '103590.KS', name: '일진전기' },
        { code: '015760.KS', name: '한국전력' },
        { code: '071320.KQ', name: '지투파워' },
        { code: '005440.KS', name: '현대건설' },
        { code: '099440.KQ', name: '쎄트렉아이' },
        { code: '001440.KS', name: '대한전선' },
        { code: '009470.KS', name: '삼화전기' },
        { code: '000490.KS', name: '대동공업' },
        { code: '024090.KS', name: '디씨엠' },
      ]},
      { id: 'energy_svc',  label: '에너지 서비스',  naverNo: '295', desc: '에너지장비및서비스 업종 전종목' },
      { id: 'elec_util',   label: '전기유틸리티',   naverNo: '325', desc: '전기유틸리티 업종 전종목' },
      { id: 'gas_util',    label: '가스유틸리티',   naverNo: '312', desc: '가스유틸리티 업종 전종목' },
      { id: 'oil_gas',     label: '석유·가스',      naverNo: '313', desc: '석유와가스 업종 전종목' },
      { id: 'solar_wind',  label: '태양광·풍력',    desc: '신재생에너지 발전·설비', stocks: [
        { code: '001530.KS', name: 'OCI' },
        { code: '010120.KS', name: 'LS ELECTRIC' },
        { code: '298040.KS', name: '효성중공업' },
        { code: '025560.KQ', name: '미래산업' },
        { code: '140410.KQ', name: '메지온' },
        { code: '011090.KS', name: '한화솔루션' },
        { code: '015590.KS', name: '쌍용머티리얼' },
      ]},
    ],
  },

  // ─── 제조/중공업 ──────────────────────────────────────────────────────────
  {
    id: 'industrial',
    label: '제조/중공업',
    children: [
      { id: 'shipbuilding', label: '조선',         naverNo: '291', desc: '조선 업종 전종목' },
      { id: 'shipping',     label: '해운',         naverNo: '323', desc: '해운사 업종 전종목' },
      { id: 'aerospace',    label: '우주항공/방산', naverNo: '284', desc: '우주항공과국방 업종 전종목' },
      { id: 'defense_cur',  label: '├ 방산 핵심',  desc: 'K방산 수출 핵심 종목', stocks: [
        { code: '012450.KS', name: '한화에어로스페이스' },
        { code: '047810.KS', name: '한국항공우주' },
        { code: '064350.KS', name: '현대로템' },
        { code: '000880.KS', name: '한화' },
        { code: '042660.KQ', name: '한화오션' },
        { code: '065440.KQ', name: '빅텍' },
        { code: '071260.KQ', name: '스페코' },
      ]},
      { id: 'spacex_rel',   label: '├ 우주/스페이스X', desc: '위성·발사체·우주 인프라 관련주', stocks: [
        { code: '047810.KS', name: '한국항공우주' },
        { code: '099440.KQ', name: '쎄트렉아이' },
        { code: '211270.KQ', name: 'AP위성' },
        { code: '462040.KQ', name: '이노스페이스' },
        { code: '012450.KS', name: '한화에어로스페이스' },
        { code: '064350.KS', name: '현대로템' },
        { code: '034020.KS', name: '두산에너빌리티' },
        { code: '004490.KS', name: '세방전지' },
      ]},
      { id: 'machinery',    label: '기계',         naverNo: '299', desc: '기계 업종 전종목' },
      { id: 'robot_cur',    label: '로봇',         desc: '산업용·서비스 로봇·액추에이터', stocks: [
        { code: '090360.KQ', name: '로보스타' },
        { code: '108860.KQ', name: '셀바스AI' },
        { code: '160980.KQ', name: '싸이맥스' },
        { code: '321370.KQ', name: '클로봇' },
        { code: '375500.KS', name: '두산로보틱스' },
        { code: '052710.KQ', name: '아모텍' },
        { code: '039030.KQ', name: '이오테크닉스' },
        { code: '263020.KQ', name: '디케이티' },
        { code: '356830.KQ', name: '티로보틱스' },
        { code: '189490.KQ', name: '레인보우로보틱스' },
      ]},
      { id: 'auto',         label: '자동차',       naverNo: '273', desc: '자동차 업종 전종목' },
      { id: 'auto_parts',   label: '자동차부품',   naverNo: '270', desc: '자동차부품 업종 전종목' },
      { id: 'ev_cur',       label: '├ 전기차/자율주행', desc: 'EV 부품·자율주행 핵심', stocks: [
        { code: '005380.KS', name: '현대차' },
        { code: '000270.KS', name: '기아' },
        { code: '012330.KS', name: '현대모비스' },
        { code: '011210.KS', name: '현대위아' },
        { code: '018880.KS', name: '한온시스템' },
        { code: '060980.KQ', name: '한라IMS' },
        { code: '336570.KQ', name: '원준' },
        { code: '204020.KQ', name: '그린플러스' },
        { code: '073240.KS', name: '금호타이어' },
        { code: '161390.KS', name: '한국타이어앤테크놀로지' },
      ]},
      { id: 'steel',        label: '철강',         naverNo: '304', desc: '철강 업종 전종목' },
      { id: 'chem',         label: '화학',         naverNo: '272', desc: '화학 업종 전종목' },
      { id: 'elec_prod',    label: '전기제품',     naverNo: '283', desc: '전기제품 업종 전종목' },
      { id: 'elec_eq2',     label: '전기장비',     naverNo: '306', desc: '전기장비 업종 전종목' },
      { id: 'non_ferrous',  label: '비철금속',     naverNo: '322', desc: '비철금속 업종 전종목' },
      { id: 'transport',    label: '도로·철도운송', naverNo: '329', desc: '도로와철도운송 업종 전종목' },
      { id: 'air',          label: '항공',         naverNo: '305', desc: '항공사 업종 전종목' },
    ],
  },

  // ─── 바이오/헬스케어 ──────────────────────────────────────────────────────
  {
    id: 'bio_health',
    label: '바이오/헬스케어',
    children: [
      { id: 'pharma',      label: '제약',           naverNo: '261', desc: '제약 업종 전종목' },
      { id: 'biotech',     label: '바이오',         naverNo: '286', desc: '생물공학 업종 전종목' },
      { id: 'lifesci',     label: '생명과학',       naverNo: '262', desc: '생명과학도구및서비스 업종 전종목' },
      { id: 'health_tech', label: '의료기기·기술',  naverNo: '288', desc: '건강관리기술 업종 전종목' },
      { id: 'med_device',  label: '의료기기·용품',  naverNo: '281', desc: '건강관리장비와용품 업종 전종목' },
      { id: 'bio_key',     label: '바이오 핵심',    desc: 'CDMO·신약·글로벌 임상', stocks: [
        { code: '207940.KS', name: '삼성바이오로직스' },
        { code: '068270.KS', name: '셀트리온' },
        { code: '000100.KS', name: '유한양행' },
        { code: '128940.KS', name: '한미약품' },
        { code: '006280.KS', name: '녹십자' },
        { code: '145020.KQ', name: '휴젤' },
        { code: '214450.KQ', name: '파마리서치' },
        { code: '326030.KS', name: 'SK바이오팜' },
      ]},
      { id: 'cosmetic',    label: '화장품·뷰티',   naverNo: '266', desc: '화장품 업종 전종목' },
      { id: 'ai_health',   label: 'AI 헬스케어',   desc: '의료AI·디지털치료제·원격진료', stocks: [
        { code: '108860.KQ', name: '셀바스AI' },
        { code: '357230.KQ', name: '씨젠' },
        { code: '031440.KQ', name: '에이치에이코리아' },
        { code: '060960.KQ', name: '메디젠휴먼케어' },
        { code: '236340.KQ', name: '몸앤마음' },
        { code: '263700.KQ', name: '케어랩스' },
        { code: '317850.KQ', name: '에이조스바이오' },
        { code: '289170.KQ', name: '네오이뮨텍' },
      ]},
    ],
  },

  // ─── 금융 ─────────────────────────────────────────────────────────────────
  {
    id: 'finance',
    label: '금융',
    children: [
      { id: 'bank',       label: '은행',         naverNo: '301', desc: '은행 업종 전종목' },
      { id: 'securities', label: '증권',         naverNo: '321', desc: '증권 업종 전종목' },
      { id: 'insurance_g',label: '손해보험',     naverNo: '315', desc: '손해보험 업종 전종목' },
      { id: 'insurance_l',label: '생명보험',     naverNo: '330', desc: '생명보험 업종 전종목' },
      { id: 'card',       label: '카드',         naverNo: '337', desc: '카드 업종 전종목' },
      { id: 'fin_other',  label: '기타금융',     naverNo: '319', desc: '기타금융 업종 전종목' },
      { id: 'fin_invest', label: '창업투자',     naverNo: '277', desc: '창업투자 업종 전종목' },
      { id: 'fin_key',    label: '금융지주 핵심', desc: '4대 금융지주·카카오뱅크', stocks: [
        { code: '105560.KS', name: 'KB금융' },
        { code: '055550.KS', name: '신한지주' },
        { code: '086790.KS', name: '하나금융지주' },
        { code: '316140.KS', name: '우리금융지주' },
        { code: '003550.KS', name: 'LG' },
        { code: '323410.KS', name: '카카오뱅크' },
        { code: '377300.KS', name: '카카오페이' },
        { code: '030200.KS', name: 'KT' },
        { code: '032830.KS', name: '삼성생명' },
        { code: '000810.KS', name: '삼성화재' },
      ]},
    ],
  },

  // ─── 소비재/서비스 ────────────────────────────────────────────────────────
  {
    id: 'consumer',
    label: '소비재/서비스',
    children: [
      { id: 'food',        label: '식품',          naverNo: '268', desc: '식품 업종 전종목' },
      { id: 'beverage',    label: '음료',          naverNo: '309', desc: '음료 업종 전종목' },
      { id: 'game',        label: '게임',          naverNo: '263', desc: '게임엔터테인먼트 업종 전종목' },
      { id: 'media',       label: '방송·엔터',     naverNo: '285', desc: '방송과엔터테인먼트 업종 전종목' },
      { id: 'k_content',   label: 'K-콘텐츠/한류', desc: 'K팝·드라마·웹툰·OTT 핵심주', stocks: [
        { code: '041510.KS', name: 'SM엔터테인먼트' },
        { code: '035900.KQ', name: 'JYP엔터테인먼트' },
        { code: '122870.KQ', name: 'YG엔터테인먼트' },
        { code: '253450.KQ', name: '스튜디오드래곤' },
        { code: '259960.KS', name: '크래프톤' },
        { code: '035420.KS', name: 'NAVER' },
        { code: '035720.KS', name: '카카오' },
        { code: '036570.KS', name: 'NC소프트' },
        { code: '225570.KQ', name: '넥슨게임즈' },
        { code: '377030.KQ', name: '카카오엔터테인먼트' },
      ]},
      { id: 'internet',    label: '인터넷·커머스', naverNo: '300', desc: '양방향미디어와서비스 업종 전종목' },
      { id: 'fashion',     label: '섬유·패션',     naverNo: '274', desc: '섬유,의류,신발,호화품 업종 전종목' },
      { id: 'leisure',     label: '호텔·레저',     naverNo: '317', desc: '호텔,레스토랑,레저 업종 전종목' },
      { id: 'retail',      label: '백화점·유통',   naverNo: '264', desc: '백화점과일반상점 업종 전종목' },
      { id: 'ad',          label: '광고',          naverNo: '310', desc: '광고 업종 전종목' },
      { id: 'education',   label: '교육',          naverNo: '290', desc: '교육서비스 업종 전종목' },
    ],
  },

  // ─── 건설/부동산 ──────────────────────────────────────────────────────────
  {
    id: 'construction',
    label: '건설/부동산',
    children: [
      { id: 'const',       label: '건설',         naverNo: '279', desc: '건설 업종 전종목' },
      { id: 'const_mat',   label: '건축자재',     naverNo: '289', desc: '건축자재 업종 전종목' },
      { id: 'realty',      label: '부동산',       naverNo: '280', desc: '부동산 업종 전종목' },
      { id: 'cement',      label: '시멘트·목재',  naverNo: '318', desc: '종이와목재 업종 전종목' },
      { id: 'infra',       label: '인프라 핵심',  desc: '대형 건설·플랜트·해외수주', stocks: [
        { code: '005440.KS', name: '현대건설' },
        { code: '000720.KS', name: '현대건설' },
        { code: '047040.KS', name: 'GS건설' },
        { code: '006360.KS', name: 'GS건설' },
        { code: '000210.KS', name: '대림산업' },
        { code: '028050.KS', name: '삼성엔지니어링' },
        { code: '010140.KS', name: '삼성중공업' },
        { code: '034020.KS', name: '두산에너빌리티' },
        { code: '011600.KS', name: '현대코퍼레이션' },
        { code: '014790.KS', name: '종근당홀딩스' },
      ]},
    ],
  },

  // ─── 통신/플랫폼 ──────────────────────────────────────────────────────────
  {
    id: 'telecom_platform',
    label: '통신/플랫폼',
    children: [
      { id: 'telecom_svc',  label: '이동통신',        naverNo: '316', desc: '통신서비스 업종 전종목' },
      { id: 'telecom_key',  label: '통신 핵심',       desc: '이동통신 3사·알뜰폰·위성통신', stocks: [
        { code: '017670.KS', name: 'SK텔레콤' },
        { code: '030200.KS', name: 'KT' },
        { code: '032640.KS', name: 'LG유플러스' },
        { code: '034730.KS', name: 'SK스퀘어' },
        { code: '272210.KS', name: '한화시스템' },
        { code: '211270.KQ', name: 'AP위성' },
        { code: '073490.KQ', name: '이노와이어리스' },
        { code: '056360.KQ', name: '코위버' },
        { code: '230240.KQ', name: 'HFR' },
      ]},
      { id: 'platform_key', label: '인터넷 플랫폼',  desc: 'NAVER·카카오·이커머스', stocks: [
        { code: '035420.KS', name: 'NAVER' },
        { code: '035720.KS', name: '카카오' },
        { code: '323410.KS', name: '카카오뱅크' },
        { code: '377300.KS', name: '카카오페이' },
        { code: '035900.KQ', name: 'JYP엔터테인먼트' },
        { code: '263750.KQ', name: '펄어비스' },
        { code: '259960.KS', name: '크래프톤' },
        { code: '042700.KQ', name: '한미반도체' },
        { code: '016360.KS', name: '삼성증권' },
      ]},
      { id: 'ai_platform',  label: 'AI·클라우드',    desc: '국내 AI 서비스·클라우드·데이터', stocks: [
        { code: '035420.KS', name: 'NAVER' },
        { code: '035720.KS', name: '카카오' },
        { code: '108860.KQ', name: '셀바스AI' },
        { code: '322310.KQ', name: '오트로닉스' },
        { code: '417090.KQ', name: '폴라리스AI파마' },
        { code: '095660.KQ', name: '네오위즈' },
        { code: '036570.KS', name: 'NC소프트' },
        { code: '251270.KQ', name: '넷마블' },
        { code: '348210.KQ', name: '넥슨코리아' },
      ]},
      { id: 'internet2',    label: '인터넷·커머스',  naverNo: '300', desc: '양방향미디어와서비스 업종 전종목' },
      { id: 'software2',    label: '소프트웨어',     naverNo: '287', desc: '소프트웨어 업종 전종목' },
      { id: 'it_svc2',      label: 'IT서비스',       naverNo: '267', desc: 'IT서비스 업종 전종목' },
    ],
  },

  // ─── 신성장/이슈 테마 ─────────────────────────────────────────────────────
  {
    id: 'hot_themes',
    label: '🔥 핫 테마',
    children: [
      // AI 데이터센터 전력 인프라 (변압기·케이블·HVDC·냉각)
      { id: 'ai_power', label: 'AI 전력·변압기', desc: 'AI 데이터센터 전력 인프라·변압기·HVDC', stocks: [
        { code: '010120.KS', name: 'LS ELECTRIC' },
        { code: '267260.KS', name: 'HD현대일렉트릭' },
        { code: '298040.KS', name: '효성중공업' },
        { code: '103590.KS', name: '일진전기' },
        { code: '001440.KS', name: '대한전선' },
        { code: '006260.KS', name: 'LS' },
        { code: '000500.KS', name: '가온전선' },
        { code: '033100.KQ', name: '제룡전기' },
        { code: '015760.KS', name: '한국전력' },
        { code: '064760.KQ', name: '티씨케이' },
      ]},

      // AI 서버·쿨링 (서버랙·액침냉각·열관리)
      { id: 'ai_cooling', label: 'AI 서버·쿨링', desc: '서버랙·액침냉각·열관리·데이터센터 인프라', stocks: [
        { code: '042700.KQ', name: '한미반도체' },
        { code: '000660.KS', name: 'SK하이닉스' },
        { code: '005930.KS', name: '삼성전자' },
        { code: '009150.KS', name: '삼성전기' },
        { code: '079550.KS', name: 'LIG넥스원' },
        { code: '272210.KS', name: '한화시스템' },
        { code: '286940.KQ', name: '웰크론한텍' },
      ]},

      // 드론·UAM (무인기·도심항공모빌리티)
      { id: 'drone_uam', label: '드론·UAM', desc: '드론 제조·부품·도심항공모빌리티(UAM)', stocks: [
        { code: '012450.KS', name: '한화에어로스페이스' },
        { code: '047810.KS', name: '한국항공우주' },
        { code: '079550.KS', name: 'LIG넥스원' },
        { code: '272210.KS', name: '한화시스템' },
        { code: '099440.KQ', name: '쎄트렉아이' },
        { code: '462040.KQ', name: '이노스페이스' },
        { code: '211270.KQ', name: 'AP위성' },
        { code: '005380.KS', name: '현대차' },
        { code: '003490.KS', name: '대한항공' },
        { code: '096630.KQ', name: '에스코넥' },
      ]},

      // 구리·핵심광물 (탈탄소·AI 인프라 수요 급증)
      { id: 'copper_metal', label: '구리·핵심광물', desc: '구리·리튬·희토류·핵심광물 수혜주', stocks: [
        { code: '006260.KS', name: 'LS' },
        { code: '103140.KS', name: '풍산' },
        { code: '010130.KS', name: '고려아연' },
        { code: '000670.KS', name: '영풍' },
        { code: '005490.KS', name: 'POSCO홀딩스' },
        { code: '003670.KS', name: '포스코퓨처엠' },
        { code: '247540.KQ', name: '에코프로비엠' },
        { code: '365340.KQ', name: '성일하이텍' },
        { code: '066970.KQ', name: '엘앤에프' },
      ]},

      // K-방산 수출 2.0 (폴란드·루마니아·중동 계약 확대)
      { id: 'defense2', label: 'K방산 수출', desc: 'K방산 수출 확대·폴란드·중동·NATO 수주', stocks: [
        { code: '012450.KS', name: '한화에어로스페이스' },
        { code: '047810.KS', name: '한국항공우주' },
        { code: '079550.KS', name: 'LIG넥스원' },
        { code: '064350.KS', name: '현대로템' },
        { code: '042660.KQ', name: '한화오션' },
        { code: '272210.KS', name: '한화시스템' },
        { code: '000880.KS', name: '한화' },
        { code: '065440.KQ', name: '빅텍' },
        { code: '071260.KQ', name: '스페코' },
        { code: '010780.KQ', name: '아이에스동서' },
        { code: '298040.KS', name: '효성중공업' },
        { code: '034020.KS', name: '두산에너빌리티' },
      ]},

      // K-푸드 수출 (라면·소스·냉동식품 글로벌 확장)
      { id: 'kfood', label: 'K-푸드 수출', desc: '라면·소스·냉동식품 해외 수출 수혜주', stocks: [
        { code: '003230.KS', name: '삼양식품' },
        { code: '004370.KS', name: '농심' },
        { code: '097950.KS', name: 'CJ제일제당' },
        { code: '007310.KS', name: '오뚜기' },
        { code: '271560.KS', name: '오리온' },
        { code: '280360.KS', name: '롯데웰푸드' },
        { code: '005180.KS', name: '빙그레' },
        { code: '001680.KS', name: '대상' },
        { code: '049770.KS', name: '동원F&B' },
        { code: '145990.KS', name: '삼양사' },
        { code: '136480.KS', name: '하림' },
        { code: '004410.KS', name: '서울식품' },
      ]},

      // 인도 진출 수혜 (삼성·LG·현대 인도 생산·판매)
      { id: 'india_play', label: '인도 수혜주', desc: '인도 생산·판매 비중 높은 수혜 종목', stocks: [
        { code: '005930.KS', name: '삼성전자' },
        { code: '066570.KS', name: 'LG전자' },
        { code: '005380.KS', name: '현대차' },
        { code: '000270.KS', name: '기아' },
        { code: '012330.KS', name: '현대모비스' },
        { code: '047050.KQ', name: '포스코인터내셔널' },
        { code: '005490.KS', name: 'POSCO홀딩스' },
        { code: '011170.KS', name: '롯데케미칼' },
        { code: '010120.KS', name: 'LS ELECTRIC' },
        { code: '006400.KS', name: '삼성SDI' },
        { code: '034220.KS', name: 'LG디스플레이' },
        { code: '161390.KS', name: '한국타이어앤테크놀로지' },
      ]},

      // 중동 건설·플랜트 (사우디 네옴·UAE 대형 수주)
      { id: 'mideast_plant', label: '중동 플랜트', desc: '사우디 네옴·UAE·이라크 건설·플랜트 수주', stocks: [
        { code: '005440.KS', name: '현대건설' },
        { code: '028050.KS', name: '삼성엔지니어링' },
        { code: '006360.KS', name: 'GS건설' },
        { code: '034020.KS', name: '두산에너빌리티' },
        { code: '047040.KS', name: 'GS건설' },
        { code: '011600.KS', name: '현대코퍼레이션' },
        { code: '047050.KQ', name: '포스코인터내셔널' },
        { code: '010140.KS', name: '삼성중공업' },
        { code: '298040.KS', name: '효성중공업' },
        { code: '103590.KS', name: '일진전기' },
        { code: '001440.KS', name: '대한전선' },
      ]},

      // 스마트팩토리·산업자동화 (AI+로봇 융합 생산)
      { id: 'smart_factory', label: '스마트팩토리', desc: '산업자동화·MES·협동로봇·머신비전', stocks: [
        { code: '375500.KS', name: '두산로보틱스' },
        { code: '189490.KQ', name: '레인보우로보틱스' },
        { code: '090360.KQ', name: '로보스타' },
        { code: '160980.KQ', name: '싸이맥스' },
        { code: '056190.KQ', name: 'SFA엔지니어링' },
        { code: '321370.KQ', name: '클로봇' },
        { code: '263020.KQ', name: '디케이티' },
        { code: '356830.KQ', name: '티로보틱스' },
        { code: '108860.KQ', name: '셀바스AI' },
        { code: '064440.KQ', name: '이노메트리' },
        { code: '140860.KQ', name: '파크시스템스' },
        { code: '052710.KQ', name: '아모텍' },
      ]},

      // 펫 산업 (반려동물 식품·의료·용품 성장)
      { id: 'pet', label: '펫 산업', desc: '반려동물 식품·의료·용품·플랫폼 성장주', stocks: [
        { code: '049770.KS', name: '동원F&B' },
        { code: '136480.KS', name: '하림' },
        { code: '097950.KS', name: 'CJ제일제당' },
        { code: '214370.KQ', name: '케어젠' },
        { code: '018620.KQ', name: '우진비앤지' },
        { code: '041920.KQ', name: '메디아나' },
        { code: '263700.KQ', name: '케어랩스' },
        { code: '003230.KS', name: '삼양식품' },
      ]},

      // 트럼프 관세 반사이익 (미국 대체 공급망 수혜)
      { id: 'tariff_benefit', label: '관세 반사이익', desc: '미중 관세전쟁·미국 공급망 재편 수혜주', stocks: [
        { code: '005930.KS', name: '삼성전자' },
        { code: '000660.KS', name: 'SK하이닉스' },
        { code: '042700.KQ', name: '한미반도체' },
        { code: '005380.KS', name: '현대차' },
        { code: '000270.KS', name: '기아' },
        { code: '047810.KS', name: '한국항공우주' },
        { code: '012450.KS', name: '한화에어로스페이스' },
        { code: '207940.KS', name: '삼성바이오로직스' },
        { code: '068270.KS', name: '셀트리온' },
        { code: '097950.KS', name: 'CJ제일제당' },
        { code: '003230.KS', name: '삼양식품' },
        { code: '005490.KS', name: 'POSCO홀딩스' },
        { code: '010130.KS', name: '고려아연' },
      ]},

      // 바이오시밀러·CDMO (글로벌 위탁생산·복제약)
      { id: 'biosimilar', label: '바이오시밀러·CDMO', desc: '바이오시밀러·위탁생산(CDMO) 글로벌 수혜', stocks: [
        { code: '207940.KS', name: '삼성바이오로직스' },
        { code: '068270.KS', name: '셀트리온' },
        { code: '302440.KS', name: 'SK바이오사이언스' },
        { code: '326030.KS', name: 'SK바이오팜' },
        { code: '000100.KS', name: '유한양행' },
        { code: '128940.KS', name: '한미약품' },
        { code: '196170.KQ', name: '알테오젠' },
        { code: '214450.KQ', name: '파마리서치' },
        { code: '145020.KQ', name: '휴젤' },
        { code: '006280.KS', name: '녹십자' },
      ]},

      // 의료기기 수출 (미국·유럽 FDA 인증 수출 확대)
      { id: 'meddevice_export', label: '의료기기 수출', desc: '내시경·치과·진단기기 FDA 인증 수출주', stocks: [
        { code: '041620.KQ', name: '쓰리빌리언' },
        { code: '236340.KQ', name: '몸앤마음' },
        { code: '039570.KQ', name: '이루다' },
        { code: '214450.KQ', name: '파마리서치' },
        { code: '285130.KS', name: 'SK케미칼' },
        { code: '066970.KQ', name: '엘앤에프' },
        { code: '099440.KQ', name: '쎄트렉아이' },
      ]},

      // 국내 시니어·실버 이코노미 (초고령화 수혜)
      { id: 'silver_eco', label: '시니어·실버 이코노미', desc: '초고령화 수혜 의료·요양·금융·레저', stocks: [
        { code: '000100.KS', name: '유한양행' },
        { code: '128940.KS', name: '한미약품' },
        { code: '006280.KS', name: '녹십자' },
        { code: '105560.KS', name: 'KB금융' },
        { code: '055550.KS', name: '신한지주' },
        { code: '032830.KS', name: '삼성생명' },
        { code: '000810.KS', name: '삼성화재' },
        { code: '035250.KS', name: '강원랜드' },
        { code: '069960.KS', name: '현대백화점' },
        { code: '145020.KQ', name: '휴젤' },
        { code: '214450.KQ', name: '파마리서치' },
      ]},
    ],
  },

  // ─── 유통/물류 ────────────────────────────────────────────────────────────
  {
    id: 'logistics',
    label: '유통/물류',
    children: [
      { id: 'retail2',      label: '유통·백화점',   naverNo: '264', desc: '백화점과일반상점 업종 전종목' },
      { id: 'logistics_key',label: '물류·택배',     desc: '택배·물류·SCM', stocks: [
        { code: '000120.KS', name: 'CJ대한통운' },
        { code: '028150.KS', name: 'GS리테일' },
        { code: '023530.KS', name: '롯데쇼핑' },
        { code: '004170.KS', name: '신세계' },
        { code: '069960.KS', name: '현대백화점' },
        { code: '035250.KS', name: '강원랜드' },
        { code: '001040.KS', name: 'CJ' },
        { code: '097950.KS', name: 'CJ제일제당' },
      ]},
      { id: 'ecommerce',    label: '이커머스',      desc: '온라인쇼핑·플랫폼', stocks: [
        { code: '035420.KS', name: 'NAVER' },
        { code: '035720.KS', name: '카카오' },
        { code: '377300.KS', name: '카카오페이' },
        { code: '293490.KQ', name: '카카오게임즈' },
        { code: '023530.KS', name: '롯데쇼핑' },
        { code: '004170.KS', name: '신세계' },
        { code: '130960.KS', name: 'CJ ENM' },
        { code: '031430.KS', name: '신세계인터내셔날' },
        { code: '004370.KS', name: '농심' },
        { code: '271560.KS', name: '오리온' },
      ]},
      { id: 'food_bev',     label: '식품·음료',     desc: '음식료·외식·프랜차이즈', stocks: [
        { code: '097950.KS', name: 'CJ제일제당' },
        { code: '004370.KS', name: '농심' },
        { code: '271560.KS', name: '오리온' },
        { code: '007310.KS', name: '오뚜기' },
        { code: '280360.KS', name: '롯데웰푸드' },
        { code: '002380.KS', name: 'KCC' },
        { code: '005300.KS', name: '롯데칠성' },
        { code: '139480.KS', name: '이마트' },
        { code: '016880.KS', name: '웅진코웨이' },
        { code: '145990.KS', name: '삼양사' },
      ]},
      { id: 'transport2',   label: '도로·철도',     naverNo: '329', desc: '도로와철도운송 업종 전종목' },
      { id: 'air2',         label: '항공',          naverNo: '305', desc: '항공사 업종 전종목' },
      { id: 'shipping2',    label: '해운',          naverNo: '323', desc: '해운사 업종 전종목' },
    ],
  },
];

// 6자리 KIS 코드 추출
export function toKisCode(yahooSymbol) {
  return yahooSymbol.replace('.KS', '').replace('.KQ', '');
}

// 저평가 점수 계산 (0~9)
export function calcUndervalScore(f) {
  if (!f) return 0;
  let score = 0;
  if (f.pbr != null && f.pbr > 0) {
    if (f.pbr < 1.0) score += 2;
    else if (f.pbr < 1.5) score += 1;
  }
  if (f.per != null && f.per > 0) {
    if (f.per < 10) score += 2;
    else if (f.per < 15) score += 1;
  }
  if (f.evEbitda != null && f.evEbitda > 0) {
    if (f.evEbitda < 8) score += 2;
    else if (f.evEbitda < 12) score += 1;
  }
  if (f.roe != null) {
    if (f.roe > 20) score += 2;
    else if (f.roe > 10) score += 1;
  }
  if (f.roa != null && f.roa > 5) score += 1;
  return score;
}

export function scoreColorCls(score) {
  if (score >= 7) return 'text-green-300 bg-green-900/40 border-green-700/50';
  if (score >= 5) return 'text-green-400 bg-green-900/20 border-green-800/40';
  if (score >= 3) return 'text-yellow-400 bg-yellow-900/20 border-yellow-800/40';
  return 'text-gray-500 bg-surface-raised border-surface-border';
}
