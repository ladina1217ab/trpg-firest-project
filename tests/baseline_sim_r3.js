/* 후삼국: 천하의 주인 — SGK-P0R R1 시뮬레이션 엔진
   UI·렌더링과 무관한 순수 모듈. 같은 상태 + 같은 명령 + 같은 시드 = 같은 결과. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ───────────────────────── 상수 (시나리오 데이터 시트 '상수' 탭 기준) ─────────────────────────
  const UNITS = ['light', 'heavy', 'archer', 'cav'];
  const UNIT = {
    light: { name: '경보병', power: 1.0, cost: 10, grain: 10, gold: 0.3, def: 1.0, note: '험지(산악 +15%, 구릉 +5%), 싸고 가볍다' },
    heavy: { name: '중보병', power: 1.3, cost: 30, grain: 14, gold: 0.75, def: 0.7, note: '수비 +10%, 손실이 적다, 느리다' },
    archer: { name: '궁병', power: 1.2, cost: 20, grain: 12, gold: 0.5, def: 1.15, note: '수비 +15%, 성 안에서는 덜 다친다' },
    cav: { name: '기병', power: 1.6, cost: 60, grain: 25, gold: 1.5, def: 0.9, note: '평지 +15%, 산악 −35%, 공성 약함, 추격' },
  };
  const K = {
    weeks: 60, garrisonGrain: 0.4, recruitWeeks: 2, cavSpeed: 0.8, heavySpeed: 1.25,
    terrMove: { 평지: 1, 구릉: 1.15, 산악: 1.4, 해안: 1.05, 해상: 1 },
    terrDef: { 평지: 0, 구릉: 0.10, 산악: 0.25, 해안: 0, 해상: 0 },
    fortDef: 0.08, loserBase: 0.18, winnerBase: 0.08, ratioExp: 0.6, siegeScale: 0.5,
    retreatMorale: 35, starveMorale: 10, starveAttr: 0.05, forage: 0.3,
    harvestWeeks: [4, 52], harvestMult: 40, harvestPool: 0.3,
    reqGrain: 300, reqMorale: 8, reqCooldown: 4, repairCost: 60, repairWeeks: 4,
    envoyWeeks: 2, envoyCost: 30, giftCost: 40, giftTrust: 8, scoutCost: 10,
    breachTrust: 25, protectWeeks: 8, intelFresh: 3, intelStale: 10, proposalWeeks: 4, cutWeeks: 2, cutMorale: 3, transportLoss: 0.2, unpaidMorale: 4, grainPerGold: 3, buyWeeks: 2, buyMax: 400,
    marryCost: 80, probeCost: 25, probeWeeks: 2, probeFresh: 4, pacifyCost: 40, pacifyWeeks: 2, pacifyMorale: 10, pacifyCooldown: 8, rewardGold: 60, officeCost: 40, officeSalary: 3, officeWeeks: 12,
    passWeeks: 16, truceWeeks: 12, callWeeks: 1, callCooldown: 8, aidNeed: 300, heirCooldown: 12, defectChance: 0.12,
  };

  // ───────────────────────── 시나리오 데이터 (929년 10월 1주) ─────────────────────────
  // id, 이름, 현재지명, 위도, 경도, 지형, 성방어, 항구, 지배, 명목종주, 성주, 자치도, 징병가능, [경,중,궁,기], 군량, 민심, 세수, 신뢰도, 근거
  const REG = [
    ['gaegyeong', '개경', '개성', 37.97, 126.55, '평지', 5, 1, 'goryeo', 'goryeo', 'wanggeon', 0, 6000, [2000, 1000, 800, 600], 9000, 75, 120, 'confirmed', '고려 수도(919 천도)'],
    ['cheorwon', '철원', '철원', 38.15, 127.31, '구릉', 4, 0, 'goryeo', 'goryeo', '', 10, 3000, [900, 400, 300, 200], 3500, 60, 50, 'confirmed', '옛 태봉 도읍'],
    ['myeongju', '명주', '강릉', 37.75, 128.90, '산악', 3, 1, 'myeongju', 'goryeo', 'wangsunsik', 80, 3500, [1200, 500, 500, 100], 4000, 70, 55, 'disputed', '김순식 922 귀부 의사·928 입조, 실질 자치'],
    ['cheongju', '청주', '청주', 36.64, 127.49, '평지', 4, 0, 'goryeo', 'goryeo', '', 15, 3000, [900, 600, 400, 200], 3500, 60, 55, 'disputed', '928 견훤 공략 기록, 고려 방어 유지로 가정'],
    ['ungju', '웅주', '공주', 36.46, 127.12, '구릉', 4, 0, 'hubaekje', 'hubaekje', '', 20, 3000, [1000, 500, 400, 150], 3500, 55, 50, 'disputed', '934 이전 후백제권으로 가정'],
    ['unju', '운주', '홍성', 36.60, 126.66, '구릉', 3, 1, 'hubaekje', 'hubaekje', '', 40, 2500, [800, 300, 300, 100], 3000, 50, 45, 'disputed', '934 운주전투 이전 후백제권으로 가정'],
    ['gugwon', '국원', '충주', 36.99, 127.93, '구릉', 4, 0, 'goryeo', 'goryeo', '', 15, 3000, [900, 500, 400, 200], 3500, 60, 55, 'designed', '중원 교통 요지, 고려 지배 가정'],
    ['sangju', '상주', '상주', 36.41, 128.16, '평지', 3, 0, 'sangju', 'goryeo', 'ajagae', 70, 3000, [1000, 300, 400, 100], 3500, 55, 50, 'designed', '아자개 918 귀부 기록, 929년 상태는 재구성'],
    ['ilseon', '일선', '구미 선산', 36.24, 128.29, '평지', 3, 0, 'hubaekje', 'hubaekje', '', 30, 2000, [800, 400, 300, 200], 2500, 45, 40, 'designed', '낙동강 중류 후백제 전진기지 가정'],
    ['byeokjin', '벽진', '성주', 35.92, 128.28, '구릉', 3, 0, 'byeokjin', 'goryeo', 'icheongeon', 75, 2000, [800, 300, 300, 50], 2500, 65, 40, 'confirmed', '이총언 고려 우호(고려사 열전)'],
    ['gochang', '고창', '안동', 36.57, 128.73, '구릉', 3, 0, 'gochang', 'goryeo', 'kimseonpyeong', 70, 2500, [900, 300, 400, 50], 3000, 65, 45, 'confirmed', '929.12 견훤 포위, 성주 김선평'],
    ['uiseong', '의성', '의성', 36.35, 128.70, '구릉', 3, 0, 'hubaekje', 'hubaekje', '', 30, 1500, [900, 500, 400, 300], 2000, 30, 30, 'confirmed', '929.7 견훤 공격, 홍술 전사 뒤 후백제 점령'],
    ['goul', '고울', '영천', 35.97, 128.94, '구릉', 3, 0, 'goul', 'silla', 'neungmun', 80, 2000, [800, 300, 300, 50], 2500, 55, 40, 'disputed', '능문 927 귀부 시도 기록, 이후 상태 재구성'],
    ['gyeongju', '경주', '경주', 35.86, 129.21, '평지', 4, 0, 'silla', 'silla', 'gyeongsun', 30, 3000, [1000, 600, 600, 100], 5000, 40, 70, 'confirmed', '신라 왕도, 927 견훤 침공 피해'],
    ['daeya', '대야', '합천', 35.57, 128.17, '산악', 5, 0, 'hubaekje', 'hubaekje', '', 25, 2000, [900, 500, 400, 100], 3000, 45, 40, 'confirmed', '920·928 후백제 공략'],
    ['gangju', '강주', '진주', 35.18, 128.11, '구릉', 4, 1, 'hubaekje', 'hubaekje', 'yanggeom', 30, 3000, [1000, 500, 400, 150], 3500, 45, 50, 'disputed', '928 후백제 차지, 양검 강주도독(시점 검증 필요)'],
    ['wansan', '완산', '전주', 35.82, 127.15, '평지', 5, 0, 'hubaekje', 'hubaekje', 'gyeonhwon', 0, 6000, [2000, 1200, 900, 700], 9000, 75, 120, 'confirmed', '후백제 수도'],
    ['mujin', '무진', '광주', 35.16, 126.85, '평지', 4, 0, 'hubaekje', 'hubaekje', 'yonggeom', 15, 4000, [1200, 600, 500, 250], 5000, 65, 70, 'disputed', '견훤 기반지, 용검 무주도독(시점 검증 필요)'],
    ['naju', '나주', '나주', 35.02, 126.71, '평지', 3, 1, 'goryeo', 'goryeo', '', 50, 2000, [800, 300, 400, 0], 3000, 55, 50, 'confirmed', '903 이후 고려(태봉) 교두보, 본국과는 해로로만 연결'],
    ['nammijilbu', '남미질부', '포항 흥해', 36.11, 129.34, '해안', 2, 1, 'silla', 'silla', '', 60, 1500, [500, 200, 200, 0], 2000, 50, 35, 'designed', '930.2 동해안 귀부 연쇄 대상, 929 상태 재구성'],
  ];
  // a, b, 유형, 기본주수, 지형, 비고
  const EDGES = [
    ['gaegyeong', 'cheorwon', '도로', 1, '평지', ''], ['gaegyeong', 'gugwon', '도로', 3, '구릉', '한주 경유'],
    ['gaegyeong', 'unju', '도로', 3, '구릉', '서해안 내륙로'], ['gaegyeong', 'naju', '해로', 4, '해상', '서남해 항로, 겨울 지연'],
    ['cheorwon', 'myeongju', '도로', 3, '산악', '대관령 방면'], ['cheorwon', 'gugwon', '도로', 3, '구릉', ''],
    ['myeongju', 'nammijilbu', '해안로', 4, '해안', '동해안 길'], ['myeongju', 'gochang', '도로', 4, '산악', '태백산맥 횡단'],
    ['gugwon', 'cheongju', '도로', 1, '평지', ''], ['gugwon', 'sangju', '고개', 2, '산악', '계립령·조령'],
    ['gugwon', 'gochang', '고개', 3, '산악', '죽령'], ['cheongju', 'ungju', '도로', 1, '평지', ''],
    ['cheongju', 'sangju', '고개', 2, '산악', '화령'], ['ungju', 'unju', '도로', 2, '구릉', ''],
    ['ungju', 'wansan', '도로', 2, '평지', ''], ['sangju', 'ilseon', '도로', 1, '평지', '낙동강'],
    ['sangju', 'gochang', '도로', 2, '구릉', '예천 경유'], ['sangju', 'uiseong', '도로', 2, '구릉', ''],
    ['ilseon', 'byeokjin', '도로', 1, '평지', ''], ['ilseon', 'uiseong', '도로', 2, '구릉', ''],
    ['byeokjin', 'daeya', '도로', 2, '산악', ''], ['byeokjin', 'goul', '도로', 2, '구릉', '공산(대구) 경유'],
    ['gochang', 'uiseong', '도로', 1, '구릉', ''], ['uiseong', 'goul', '도로', 2, '구릉', ''],
    ['goul', 'gyeongju', '도로', 1, '평지', ''], ['gyeongju', 'nammijilbu', '도로', 1, '해안', ''],
    ['gyeongju', 'daeya', '도로', 3, '구릉', '청도·창녕 경유'], ['daeya', 'gangju', '도로', 2, '구릉', ''],
    ['daeya', 'wansan', '고개', 3, '산악', '육십령 방면'], ['gangju', 'mujin', '도로', 3, '산악', '섬진강 방면'],
    ['wansan', 'mujin', '도로', 2, '평지', ''], ['mujin', 'naju', '도로', 1, '평지', ''],
    // R1 추가: 후백제 본국과 일선·의성 전진기지를 잇는 길 (없으면 두 거점이 본국과 끊김)
    ['wansan', 'ilseon', '고개', 3, '산악', '추풍령(황간·김천 경유)'],
  ];
  // id, 이름, 군주, 수도, 국고, 군량, 정통성, 권위, 전략목표
  const FAC = [
    ['goryeo', '고려', 'wanggeon', 'gaegyeong', 1200, 6000, 70, 65, '고창·동남부 호족망 유지, 신라 연결로 확보'],
    ['hubaekje', '후백제', 'gyeonhwon', 'wansan', 1400, 7000, 65, 75, '고창 장악으로 고려-신라 연결 차단'],
    ['silla', '신라', 'gyeongsun', 'gyeongju', 500, 2000, 80, 25, '왕실 보전, 강국과의 외교적 생존'],
    ['gochang', '고창 호족', 'kimseonpyeong', 'gochang', 250, 1000, 40, 55, '고창 존속·자치권 확보'],
    ['byeokjin', '벽진 호족', 'icheongeon', 'byeokjin', 200, 800, 35, 60, '벽진 수호, 고려와 협력 유지'],
    ['sangju', '상주 세력', 'ajagae', 'sangju', 250, 1000, 35, 45, '내륙 자치 유지, 강자에 편승'],
    ['myeongju', '명주 세력', 'wangsunsik', 'myeongju', 350, 1500, 45, 70, '동해안 자치, 고려와 조건부 관계'],
    ['goul', '고울부', 'neungmun', 'goul', 200, 800, 30, 50, '신라 인근 생존, 고려 귀부 저울질'],
  ];
  const FMETA = {
    goryeo: { kingdom: true, color: '#1f4e79', hanja: '高', title: '고려 국왕', playable: true, blurb: '호족 연합의 맹주. 혼자서는 후백제보다 병력이 적다. 고창·벽진·명주·상주를 붙잡아야 대등해진다.' },
    hubaekje: { kingdom: true, color: '#b3261e', hanja: '百', title: '후백제 국왕', playable: true, blurb: '가장 강한 군대. 군량이 빠듯해 오래 버티기보다 먼저 움직여야 한다. 고창을 얻으면 고려와 신라가 끊긴다.' },
    silla: { sovereign: true, color: '#b8891a', hanja: '新', title: '신라 국왕' },
    gochang: { color: '#2f6b4f', hanja: '昌', title: '고창 성주', playable: true, blurb: '두 왕국 사이에 낀 성 하나. 버티거나, 고려에 기대거나, 후백제에 귀부하거나. 목표는 살아남아 자치를 지키는 것.' },
    byeokjin: { color: '#6b4a8a', hanja: '碧', title: '벽진 장군' },
    sangju: { color: '#7a5a3a', hanja: '尙', title: '상주 성주' },
    myeongju: { color: '#1f7a80', hanja: '溟', title: '명주 장군' },
    goul: { color: '#5b6470', hanja: '鬱', title: '고울부 장군' },
  };
  // id, 이름, 세력, 역할, 거점, 통솔, 무력, 지략, 정치, 신망, 충성, 야심, 특성, 신뢰도, 근거
  const CHR = [
    ['wanggeon', '왕건', 'goryeo', '군주', 'gaegyeong', 82, 70, 80, 90, 88, 100, 70, '포용·혼인외교', 'confirmed', '고려 태조'],
    ['yugeumpil', '유금필', 'goryeo', '장군', 'gaegyeong', 88, 90, 75, 45, 80, 90, 30, '맹장·결단', 'confirmed', '고창전투 출정 건의(고려사 열전)'],
    ['hongyu', '홍유', 'goryeo', '장군', 'cheorwon', 72, 74, 60, 55, 65, 85, 35, '개국공신', 'confirmed', '개국공신'],
    ['baehyeongyeong', '배현경', 'goryeo', '장군', 'gaegyeong', 70, 78, 55, 50, 62, 85, 35, '개국공신', 'confirmed', '개국공신'],
    ['bokjigyeom', '복지겸', 'goryeo', '장군', 'cheorwon', 66, 68, 64, 58, 60, 82, 40, '개국공신', 'confirmed', '개국공신'],
    ['baksulhui', '박술희', 'goryeo', '장군', 'gaegyeong', 70, 72, 62, 60, 58, 88, 35, '근위', 'confirmed', '태조 측근 장군'],
    ['gyeonhwon', '견훤', 'hubaekje', '군주', 'wansan', 90, 85, 78, 72, 85, 100, 95, '정복자', 'confirmed', '후백제 국왕'],
    ['singeom', '신검', 'hubaekje', '왕자', 'wansan', 72, 74, 60, 58, 55, 60, 85, '장자·야심', 'confirmed', '견훤 장남'],
    ['yanggeom', '양검', 'hubaekje', '왕자·도독', 'gangju', 64, 66, 55, 55, 45, 65, 70, '', 'disputed', '강주도독(시점 검증 필요)'],
    ['yonggeom', '용검', 'hubaekje', '왕자·도독', 'mujin', 62, 64, 56, 58, 45, 65, 70, '', 'disputed', '무주도독(시점 검증 필요)'],
    ['geumgang', '금강', 'hubaekje', '왕자', 'wansan', 55, 58, 62, 64, 60, 90, 40, '총애', 'confirmed', '견훤 넷째 아들'],
    ['neunghwan', '능환', 'hubaekje', '신하', 'wansan', 40, 35, 78, 70, 50, 55, 75, '모사', 'confirmed', '935 정변 주도자'],
    ['choiseungu', '최승우', 'hubaekje', '문신', 'wansan', 20, 15, 80, 82, 65, 85, 30, '문장가', 'confirmed', '견훤 측 문사'],
    ['kimak', '김악', 'hubaekje', '시랑', 'wansan', 58, 55, 62, 60, 45, 80, 40, '', 'confirmed', '고창전투 포로(고려사)'],
    ['gyeongsun', '경순왕 김부', 'silla', '군주', 'gyeongju', 30, 20, 60, 72, 70, 100, 30, '왕실 보전', 'confirmed', '927 즉위'],
    ['kimbonghyu', '김봉휴', 'silla', '시랑', 'gyeongju', 30, 25, 60, 70, 45, 80, 30, '', 'disputed', '935 사신 기록, 929 활동은 재구성'],
    ['maui', '김일(마의태자)', 'silla', '태자', 'gyeongju', 35, 40, 55, 55, 65, 90, 40, '항전파', 'traditional', '전승 비중 큼'],
    ['kimseonpyeong', '김선평', 'gochang', '성주', 'gochang', 70, 62, 66, 72, 78, 100, 45, '현실주의', 'confirmed', '고창 성주'],
    ['gwonhaeng', '권행', 'gochang', '호족', 'gochang', 64, 72, 68, 58, 70, 85, 40, '결단', 'confirmed', '고창전투 공신'],
    ['janggil', '장길', 'gochang', '호족', 'gochang', 62, 66, 74, 56, 62, 85, 40, '지략', 'confirmed', '고려사 장길, 전승 장정필'],
    ['icheongeon', '이총언', 'byeokjin', '성주', 'byeokjin', 72, 70, 64, 62, 72, 100, 45, '수성', 'confirmed', '벽진 장군(고려사 열전)'],
    ['iyeong', '이영', 'byeokjin', '장군', 'byeokjin', 58, 64, 52, 50, 48, 85, 50, '', 'confirmed', '이총언 아들'],
    ['wangsunsik', '왕순식', 'myeongju', '성주', 'myeongju', 76, 68, 66, 70, 80, 100, 60, '자치 고수', 'confirmed', '명주 장군(김순식)'],
    ['wangryeom', '왕렴', 'myeongju', '장군', 'myeongju', 55, 58, 52, 56, 45, 80, 45, '', 'confirmed', '순식 아들'],
    ['ajagae', '아자개', 'sangju', '성주', 'sangju', 50, 45, 55, 60, 58, 100, 40, '노장', 'disputed', '918 귀부 기록, 929 생존 여부 미상'],
    ['neungmun', '능문', 'goul', '장군', 'goul', 58, 60, 56, 58, 52, 100, 55, '관망', 'disputed', '927 고울부 장군 귀부 시도'],
  ];
  // 초기 신뢰 (−100~100, 기본 40)
  const TRUST0 = [
    ['goryeo', 'hubaekje', -80], ['goryeo', 'silla', 70], ['hubaekje', 'silla', -60],
    ['goryeo', 'gochang', 55], ['goryeo', 'byeokjin', 75], ['goryeo', 'sangju', 45], ['goryeo', 'myeongju', 60], ['goryeo', 'goul', 60],
    ['hubaekje', 'gochang', 25], ['hubaekje', 'byeokjin', 10], ['hubaekje', 'sangju', 30], ['hubaekje', 'myeongju', 20], ['hubaekje', 'goul', 15],
    ['silla', 'goul', 60],
  ];
  // 세력 AI 성향 (플레이어와 같은 명령·자원 제약을 쓴다)
  const AIP = {
    goryeo: { kingdom: true, aggr: 0.35, maxOff: 1, cap: 4, marries: true, targets: [], value: { uiseong: 0.8, ilseon: 0.5, ungju: 0.4, unju: 0.4 }, guard: { gochang: 1.3, sangju: 0.9 }, lean: {} },
    hubaekje: { kingdom: true, aggr: 0.8, maxOff: 2, cap: 4, rulerLeads: true, targets: ['gochang', 'byeokjin', 'goul'], value: { gochang: 1, sangju: 0.7, byeokjin: 0.6, goul: 0.55, naju: 0.55, cheongju: 0.5, gugwon: 0.4 }, guard: {}, lean: {} },
    silla: { aggr: 0.05, cap: 1, targets: [], value: {}, guard: {}, lean: { goryeo: 20, hubaekje: -40 } },
    gochang: { aggr: 0.1, cap: 1, targets: [], value: {}, guard: {}, lean: { goryeo: 5, hubaekje: -5 } },
    byeokjin: { aggr: 0.1, cap: 1, targets: [], value: {}, guard: {}, lean: { goryeo: 15, hubaekje: -30 } },
    sangju: { aggr: 0.1, cap: 1, targets: [], value: {}, guard: {}, lean: { goryeo: 0, hubaekje: 0 } },
    myeongju: { aggr: 0.1, cap: 1, targets: [], value: {}, guard: {}, lean: { goryeo: 10, hubaekje: -15 } },
    goul: { aggr: 0.1, cap: 1, targets: [], value: {}, guard: {}, lean: { goryeo: 10, hubaekje: -20 } },
  };

  // 가문·관계 (07 문서: 혈연·혼인과 군사 명령은 별개다)
  const KIN = [
    ['gyeonhwon', 'singeom', '부자'], ['gyeonhwon', 'yanggeom', '부자'], ['gyeonhwon', 'yonggeom', '부자'], ['gyeonhwon', 'geumgang', '부자(총애)'],
    ['singeom', 'yanggeom', '형제 동맹'], ['singeom', 'yonggeom', '형제 동맹'], ['neunghwan', 'singeom', '지지'], ['ajagae', 'gyeonhwon', '부자(소원)'],
    ['icheongeon', 'iyeong', '부자'], ['wangsunsik', 'wangryeom', '부자'], ['kimseonpyeong', 'gwonhaeng', '협력'], ['kimseonpyeong', 'janggil', '협력'], ['gyeongsun', 'maui', '부자'], ['wanggeon', 'yugeumpil', '신임'],
  ];
  const HEIRS = { hubaekje: ['singeom', 'yanggeom', 'yonggeom', 'geumgang'] }; // 맨 앞이 장자
  const FIDS = FAC.map(f => f[0]);
  const RIDS = REG.map(r => r[0]);
  const FIDX = {}, RIDX = {};
  FIDS.forEach((f, i) => FIDX[f] = i); RIDS.forEach((r, i) => RIDX[r] = i);
  const ADJ = {}; RIDS.forEach(r => ADJ[r] = []);
  EDGES.forEach(e => {
    const o = { type: e[2], weeks: e[3], terrain: e[4], note: e[5] };
    ADJ[e[0]].push({ to: e[1], e: o }); ADJ[e[1]].push({ to: e[0], e: o });
  });

  // ───────────────────────── 기본 도구 ─────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const zero = () => ({ light: 0, heavy: 0, archer: 0, cav: 0 });
  function total(u) { return u.light + u.heavy + u.archer + u.cav; }
  function upkeep(u) { let x = 0; for (const k of UNITS) x += u[k] / 100 * UNIT[k].grain; return x; }
  function addU(a, b) { for (const k of UNITS) a[k] += b[k]; }
  function scaleU(u, f) { for (const k of UNITS) u[k] = Math.max(0, Math.floor(u[k] * f)); }
  function avgCoef(u) { const t = total(u); if (!t) return 1; let p = 0; for (const k of UNITS) p += u[k] * UNIT[k].power; return p / t; }
  function split(u, n) { const t = total(u), o = zero(); if (!t) return o; for (const k of UNITS) o[k] = Math.min(u[k], Math.floor(u[k] * n / t / 10) * 10); return o; }
  function rnd(s) { s.rng = (s.rng + 0x6D2B79F5) >>> 0; let t = s.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function h32(a, b, c, d) { let x = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177) ^ Math.imul(d | 0, 2246822519); x = Math.imul(x ^ (x >>> 15), 2246822519); x = Math.imul(x ^ (x >>> 13), 3266489917); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
  function noisy(v, seed, a, b, c) { if (v <= 0) return 0; return Math.max(100, Math.round(v * (0.75 + 0.5 * h32(seed, a, b, c)) / 100) * 100); }
  function dateOf(week) { const mi = 9 + Math.floor(week / 4); return { year: 929 + Math.floor(mi / 12), month: mi % 12 + 1, wk: week % 4 + 1 }; }
  function dateStr(week) { const d = dateOf(week); return d.year + '년 ' + d.month + '월 ' + d.wk + '주'; }
  function isWinter(week) { const m = dateOf(week).month; return m >= 11 || m <= 2; }
  const tk = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  function trust(s, a, b) { if (a === b) return 100; const v = s.trust[tk(a, b)]; return v === undefined ? 40 : v; }
  function addTrust(s, a, b, d) { if (a === b) return; s.trust[tk(a, b)] = clamp(trust(s, a, b) + d, -100, 100); }
  function head(s, f) { return s.factions[f].overlord || f; }
  function sameBloc(s, a, b) { return a === b || head(s, a) === head(s, b); }
  function atWar(s, a, b) { return a !== b && s.wars[tk(a, b)] !== undefined; }
  function hostileTo(s, f, c) {
    if (c === f || sameBloc(s, f, c)) return false;
    const hf = head(s, f), hc = head(s, c);
    return atWar(s, f, c) || atWar(s, f, hc) || atWar(s, hf, c) || atWar(s, hf, hc) || trust(s, f, c) < 30;
  }
  function shares(s, f, c) { if (c === f) return true; return (s.factions[f].overlord === c || s.factions[c].overlord === f) && trust(s, f, c) >= 40; }
  function canPass(s, f, rid) { const c = s.regions[rid].controller; return c === f || sameBloc(s, f, c) || (!atWar(s, f, c) && (trust(s, f, c) >= 60 || s.passes[c + '>' + f] >= s.week)); }
  const regs = s => RIDS.map(r => s.regions[r]);
  const armyList = s => Object.keys(s.armies).sort((a, b) => s.armies[a].n - s.armies[b].n).map(k => s.armies[k]);
  function fname(s, f) { return s.factions[f].name; }
  function rname(s, r) { return s.regions[r].name; }

  function edgeWeeks(e, units, week) {
    let um = 1; const t = total(units);
    if (units.heavy > 0) um = K.heavySpeed; else if (t > 0 && units.cav === t) um = K.cavSpeed;
    let w = Math.max(1, Math.round(e.weeks * (K.terrMove[e.terrain] || 1) * um));
    if (e.type === '해로' && isWinter(week)) w += 1;
    return w;
  }
  function findPath(s, f, from, to, units) {
    if (from === to) return { path: [], weeks: 0 };
    const dist = {}, prev = {}, done = {}; dist[from] = 0;
    for (;;) {
      let cur = null;
      for (const id of RIDS) if (dist[id] !== undefined && !done[id] && (cur === null || dist[id] < dist[cur])) cur = id;
      if (cur === null) return null;
      if (cur === to) break;
      done[cur] = 1;
      if (cur !== from && !canPass(s, f, cur)) continue;
      for (const n of ADJ[cur]) {
        if (done[n.to]) continue;
        if (n.to !== to && !canPass(s, f, n.to)) continue;
        const d = dist[cur] + edgeWeeks(n.e, units, s.week);
        if (dist[n.to] === undefined || d < dist[n.to]) { dist[n.to] = d; prev[n.to] = cur; }
      }
    }
    const path = []; let c = to; while (c !== from) { path.unshift(c); c = prev[c]; }
    return { path, weeks: dist[to] };
  }
  function edgeBetween(a, b) { const n = ADJ[a].find(x => x.to === b); return n ? n.e : null; }

  // ───────────────────────── 새 게임 ─────────────────────────
  function newGame(player, seed) {
    seed = (seed >>> 0) || 1;
    const s = {
      v: 3, seed, rng: seed, week: 0, playerFactionId: player, factions: {}, characters: {}, regions: {}, armies: {},
      orders: [], battles: [], agreements: [], proposals: [], wars: {}, trust: {}, intel: {}, ai: {},
      chronicle: [], reports: [], log: [], nextId: 1, over: null, engagements: [], pendingResults: [], passes: {}, ties: {}, left: {},
    };
    for (const f of FAC) {
      s.factions[f[0]] = { id: f[0], name: f[1], rulerId: f[2], capitalId: f[3], treasury: f[4], grain: f[5], legitimacy: f[6], authority: f[7], strategicGoal: f[8], overlord: null, alive: true, breaches: 0, heir: null, heirWeek: -99 };
      s.intel[f[0]] = { regions: {}, armies: {}, factions: {} };
      s.ai[f[0]] = { lastEnvoy: {}, lastReinf: {}, lastScout: {} };
    }
    for (const r of REG) {
      s.regions[r[0]] = {
        id: r[0], name: r[1], modern: r[2], lat: r[3], lon: r[4], terrain: r[5], fort: r[6], port: !!r[7], controller: r[8], overlord: r[9],
        lord: r[10] || null, autonomy: r[11], manpower: r[12], manpowerMax: r[12],
        garrison: { light: r[13][0], heavy: r[13][1], archer: r[13][2], cav: r[13][3] }, grain: r[14], morale: r[15], tax: r[16],
        gMorale: 70, siege: null, starve: 0, lastReq: -99, lastPacify: -99, g0: r[13][0] + r[13][1] + r[13][2] + r[13][3], conf: r[17], note: r[18],
      };
    }
    for (const r of regs(s)) if (r.overlord !== r.controller) s.factions[r.controller].overlord = r.overlord;
    for (const c of CHR) s.characters[c[0]] = { id: c[0], name: c[1], faction: c[2], role: c[3], loc: c[4], ld: c[5], ma: c[6], st: c[7], po: c[8], pr: c[9], loyalty: c[10], ambition: c[11], traits: c[12], conf: c[13], note: c[14], armyId: null, status: 'active', merit: 0, captor: null, office: 0, officeBy: null, wait: 0 };
    for (const t of TRUST0) s.trust[tk(t[0], t[1])] = t[2];
    s.wars[tk('goryeo', 'hubaekje')] = -1;
    for (const f of FIDS) {
      const o = s.factions[f].overlord;
      if (o) { const st = standingOf(TERMS0); addAgreement(s, 'vassal', [o, f], st, null, ['명목상 종주 관계'].concat(termsText(st))); }
    }
    chron(s, 'start', [], null, '929년 가을. 의성을 잃은 고려와 기세를 올린 후백제가 고창을 사이에 두고 맞서 있다.');
    updateIntel(s);
    return s;
  }
  // 조사 고르기: '이(가)·을(를)·은(는)·와(과)·(으)로'를 앞 글자의 받침에 맞춘다. 표시용 문자열만 바꾸고 판정에는 쓰이지 않는다.
  const JO = /([가-힣])((?:<\/[a-z0-9]+>)*)(이\(가\)|을\(를\)|은\(는\)|와\(과\)|\(으\)로)/g;
  function jo(t) {
    return String(t).replace(JO, (m, c, tags, p) => {
      const j = (c.charCodeAt(0) - 0xAC00) % 28, has = j !== 0;
      return c + tags + (p === '이(가)' ? (has ? '이' : '가') : p === '을(를)' ? (has ? '을' : '를') : p === '은(는)' ? (has ? '은' : '는') : p === '와(과)' ? (has ? '과' : '와') : (has && j !== 8 ? '으로' : '로'));
    });
  }
  function chron(s, type, parts, regionId, text, extra) { s.chronicle.push(Object.assign({ week: s.week, type, participants: parts, regionId: regionId || null, text: jo(text) }, extra || {})); }
  function report(s, f, text, urgent, regionId) { if (f === s.playerFactionId) s.reports.push({ week: s.week, text: jo(text), urgent: !!urgent, regionId: regionId || null }); }

  // ───────────────────────── 정보(정찰) ─────────────────────────
  function visionSources(s, f) {
    const src = {};
    for (const r of regs(s)) if (shares(s, f, r.controller)) src[r.id] = 1;
    for (const a of armyList(s)) if (a.factionId === f) src[a.loc] = 1;
    return src;
  }
  function updateIntel(s) {
    const arm = armyList(s), bucket = s.week >> 1;
    for (const f of FIDS) {
      if (!s.factions[f].alive) continue;
      const I = s.intel[f], src = visionSources(s, f), lvl = {};
      for (const id in src) lvl[id] = 2;
      for (const id in src) for (const n of ADJ[id]) if (!lvl[n.to]) lvl[n.to] = 1;
      for (const r of regs(s)) {
        const L = lvl[r.id] || 0, old = I.regions[r.id];
        if (L === 2) I.regions[r.id] = { week: s.week, conf: 'confirmed', garr: total(r.garrison) };
        else if (L === 1) {
          if (old && old.scout && s.week - old.week <= K.intelFresh) continue;
          I.regions[r.id] = { week: s.week, conf: 'estimated', garr: noisy(total(r.garrison), s.seed, FIDX[f], RIDX[r.id], bucket) };
        }
      }
      for (const a of arm) {
        if (a.factionId === f) continue;
        const L = Math.max(lvl[a.loc] || 0, a.leg ? (lvl[a.leg.to] || 0) : 0);
        if (L === 2) I.armies[a.id] = { week: s.week, conf: 'confirmed', est: total(a.units), loc: a.loc, to: a.leg ? a.leg.to : null, f: a.factionId };
        else if (L === 1) I.armies[a.id] = { week: s.week, conf: 'estimated', est: noisy(total(a.units), s.seed, FIDX[f], 100 + a.n, bucket), loc: a.loc, to: a.leg ? a.leg.to : null, f: a.factionId };
      }
      for (const id in I.armies) if (!s.armies[id]) delete I.armies[id];
    }
  }
  // 세력 f가 거점 rid에 대해 아는 것. unknown이면 병력 수는 null (UI·AI 공용)
  function regionIntel(s, f, rid) {
    const e = s.intel[f].regions[rid];
    if (!e) return { conf: 'unknown', garr: null, week: null };
    const age = s.week - e.week;
    if (age > K.intelStale) return { conf: 'unknown', garr: null, week: e.week };
    let conf = e.conf; if (conf === 'confirmed' && age > K.intelFresh) conf = 'estimated';
    return { conf, garr: e.garr, week: e.week, age };
  }
  function obsGarr(s, obs, rid) {
    const c = s.regions[rid].controller;
    if (shares(s, obs, c)) return total(s.regions[rid].garrison);
    const it = regionIntel(s, obs, rid); return it.garr === null ? 1500 : it.garr;
  }
  // obs가 볼 수 있는 부대의 병력 합 (자기·우군은 정확, 그 외는 최근 2주 관측치)
  function obsArmies(s, obs, rid, pred, near) {
    let t = 0; const adj = near ? ADJ[rid].map(n => n.to) : [];
    const at = (loc, to) => loc === rid || to === rid || adj.indexOf(loc) >= 0 || (to && adj.indexOf(to) >= 0);
    for (const a of armyList(s)) {
      const own = shares(s, obs, a.factionId);
      if (own) { if (pred(a.factionId) && at(a.loc, a.leg ? a.leg.to : null)) t += total(a.units); continue; }
      const e = s.intel[obs].armies[a.id];
      if (e && s.week - e.week <= 1 && pred(e.f) && at(e.loc, e.to)) t += e.est;
    }
    return t;
  }
  function visibleArmies(s, f) {
    const out = [];
    for (const a of armyList(s)) {
      if (shares(s, f, a.factionId)) { out.push({ army: a, conf: 'confirmed', est: total(a.units), own: a.factionId === f }); continue; }
      const e = s.intel[f].armies[a.id];
      if (e && e.week === s.week) out.push({ army: a, conf: e.conf, est: e.est, own: false });
      else if (e && s.week - e.week <= 2) out.push({ army: null, id: a.id, ghost: true, factionId: e.f, loc: e.to || e.loc, conf: 'estimated', est: e.est, week: e.week, own: false });
    }
    return out;
  }

  // ───────────────────────── 명령: 검증(플레이어·AI 공용)과 예약 ─────────────────────────
  const no = reason => ({ ok: false, reason: jo(reason) });
  function activeOrder(s, pred) { return s.orders.some(o => o.status === 'active' && pred(o)); }
  function scoutRange(s, f, rid) {
    const src = visionSources(s, f); if (src[rid]) return 1;
    for (const n of ADJ[rid]) if (src[n.to]) return 1;
    for (const n of ADJ[rid]) for (const m of ADJ[n.to]) if (src[m.to]) return 2;
    return 0;
  }
  function inferMission(s, f, T) { return T.controller === f ? 'station' : sameBloc(s, f, T.controller) ? 'guard' : 'attack'; }
  function marchPlan(s, f, fromId, toId, units) {
    const p = findPath(s, f, fromId, toId, units); if (!p) return null;
    const perWeek = upkeep(units), want = perWeek * (p.weeks + 8);
    const R = s.regions[fromId], avail = (R.controller === f ? R.grain : 0) + s.factions[f].grain;
    const carry = Math.min(want, avail);
    return { path: p.path, eta: p.weeks, perWeek, carry, short: carry < perWeek * (p.weeks + 2) - 0.5 };
  }
  const VALID = {
    RECRUIT(s, f, p) {
      const r = s.regions[p.regionId]; if (!r || r.controller !== f) return no('우리 거점이 아닙니다.');
      if (r.siege) return no('포위된 거점에서는 모병할 수 없습니다.');
      if (defiant(s, r)) return no('성주 ' + s.characters[r.lord].name + '이(가) 군령을 따르지 않습니다. 충성을 되돌려야 합니다.');
      if (!UNIT[p.unit]) return no('병종을 고르세요.');
      const n = Math.floor(p.count); if (!(n >= 100)) return no('한 번에 100명 이상 모아야 합니다.');
      if (n > r.manpower) return no('징병 가능 인원이 ' + r.manpower + '명뿐입니다.');
      const cost = Math.ceil(n / 100 * UNIT[p.unit].cost);
      if (cost > s.factions[f].treasury) return no('국고가 부족합니다. (' + cost + ' 필요)');
      return { ok: true, cost, n };
    },
    REQUISITION(s, f, p) {
      const r = s.regions[p.regionId]; if (!r || r.controller !== f) return no('우리 거점이 아닙니다.');
      if (r.siege) return no('포위 중에는 징발할 수 없습니다.');
      if (s.week - r.lastReq < K.reqCooldown || activeOrder(s, o => o.type === 'REQUISITION' && o.params.regionId === r.id)) return no('최근에 징발한 거점입니다. (' + K.reqCooldown + '주 간격)');
      if (r.morale <= 20) return no('민심이 너무 낮아 징발할 수 없습니다.');
      return { ok: true };
    },
    BUY_GRAIN(s, f, p) {
      const r = s.regions[p.regionId]; if (!r || r.controller !== f) return no('우리 거점이 아닙니다.');
      if (r.siege) return no('포위된 거점에는 곡식을 들일 수 없습니다.');
      const g = Math.floor((p.gold || 0) / 50) * 50; if (g < 50) return no('국고 50 단위로 사들입니다.'); if (g > K.buyMax) return no('한 번에 국고 ' + K.buyMax + '까지만 씁니다.');
      if (g > s.factions[f].treasury) return no('국고가 부족합니다.');
      if (activeOrder(s, o => o.type === 'BUY_GRAIN' && o.params.regionId === r.id)) return no('이미 곡식을 들이는 중입니다.');
      return { ok: true, gold: g };
    },
    FORTIFY(s, f, p) {
      const r = s.regions[p.regionId]; if (!r || r.controller !== f) return no('우리 거점이 아닙니다.');
      if (r.fort >= 5) return no('성 방어가 이미 최고 단계입니다.');
      if (activeOrder(s, o => o.type === 'FORTIFY' && o.params.regionId === r.id)) return no('이미 보강 공사 중입니다.');
      if (s.factions[f].treasury < K.repairCost) return no('국고가 부족합니다. (' + K.repairCost + ' 필요)');
      return { ok: true, cost: K.repairCost };
    },
    SCOUT(s, f, p) {
      const r = s.regions[p.regionId]; if (!r) return no('대상이 없습니다.');
      if (r.controller === f) return no('우리 거점은 정찰할 필요가 없습니다.');
      const d = scoutRange(s, f, r.id); if (!d) return no('너무 멉니다. 우리 거점·부대에서 두 구간 안쪽만 정찰할 수 있습니다.');
      if (activeOrder(s, o => o.type === 'SCOUT' && o.actorId === f && o.params.regionId === r.id)) return no('이미 정찰병을 보냈습니다.');
      if (s.factions[f].treasury < K.scoutCost) return no('국고가 부족합니다.');
      return { ok: true, cost: K.scoutCost, duration: d };
    },
    MARCH(s, f, p) {
      const R = s.regions[p.fromRegionId], T = s.regions[p.targetRegionId];
      if (!R || R.controller !== f) return no('우리 거점에서만 출정할 수 있습니다.');
      if (!T || T.id === R.id) return no('목표 거점을 고르세요.');
      if (R.siege) return no('포위된 거점에서는 출정할 수 없습니다.');
      if (defiant(s, R)) return no('성주 ' + s.characters[R.lord].name + '이(가) 군령을 따르지 않습니다. 충성을 되돌려야 합니다.');
      const u = zero(); for (const k of UNITS) { u[k] = Math.max(0, Math.floor((p.units || {})[k] || 0)); if (u[k] > R.garrison[k]) return no(UNIT[k].name + ' 수가 주둔 병력보다 많습니다.'); }
      if (total(u) < 100) return no('최소 100명을 편성해야 합니다.');
      const offs = [p.commanderId].concat(p.deputyIds || []).filter(Boolean);
      if ((p.deputyIds || []).filter(Boolean).length > 2) return no('부장은 두 명까지입니다.');
      if ((p.deputyIds || []).filter(Boolean).length && !p.commanderId) return no('부장을 두려면 주장을 먼저 정하세요.');
      if (uniq(offs).length !== offs.length) return no('같은 인물을 두 번 넣을 수 없습니다.');
      for (const id of offs) { const c = s.characters[id]; if (!c || c.faction !== f || c.status !== 'active' || c.loc !== R.id || c.armyId) return no((c ? c.name : '그 인물') + '은(는) 이 거점에서 출정할 수 없습니다.'); }
      if (p.stance && !STANCE[p.stance]) return no('작전 방침을 고르세요.');
      const mission = p.mission || inferMission(s, f, T);
      if (mission === 'attack' && sameBloc(s, f, T.controller)) return no('우군 거점은 공격할 수 없습니다.');
      if (mission !== 'attack' && !sameBloc(s, f, T.controller)) return no('우군 거점이 아닙니다.');
      if (mission === 'attack') { const tr = truceBetween(s, f, T.controller); if (tr && !p.breakTruce) return { ok: false, code: 'truce', reason: fname(s, T.controller) + '와(과)는 ' + dateStr(tr.until) + '까지 휴전 중입니다. 공격하면 약속을 어기게 됩니다.' }; }
      const plan = marchPlan(s, f, R.id, T.id, u); if (!plan) return no('갈 수 있는 길이 없습니다. (통행할 수 없는 땅에 막힘)');
      return Object.assign({ ok: true, units: u, mission }, plan);
    },
    ARMY_ORDER(s, f, p) {
      const a = s.armies[p.armyId], T = s.regions[p.targetRegionId];
      if (!a || a.factionId !== f) return no('우리 부대가 아닙니다.');
      if (a.leg) return no('행군 중인 부대에는 새 이동 명령을 내릴 수 없습니다. 회군만 가능합니다.');
      if (!T || T.id === a.loc) return no('목표 거점을 고르세요.');
      const mission = p.mission || inferMission(s, f, T);
      if (mission === 'attack' && sameBloc(s, f, T.controller)) return no('우군 거점은 공격할 수 없습니다.');
      if (mission === 'attack') { const tr = truceBetween(s, f, T.controller); if (tr && !p.breakTruce) return { ok: false, code: 'truce', reason: fname(s, T.controller) + '와(과)는 ' + dateStr(tr.until) + '까지 휴전 중입니다. 공격하면 약속을 어기게 됩니다.' }; }
      const pth = findPath(s, f, a.loc, T.id, a.units); if (!pth) return no('갈 수 있는 길이 없습니다.');
      return { ok: true, path: pth.path, eta: pth.weeks, mission };
    },
    RETREAT(s, f, p) {
      const a = s.armies[p.armyId]; if (!a || a.factionId !== f) return no('우리 부대가 아닙니다.');
      if (!a.leg && s.regions[a.loc].controller === f) return no('이미 우리 거점에 있습니다.');
      return { ok: true };
    },
    SET_STANCE(s, f, p) {
      const a = s.armies[p.armyId]; if (!a || a.factionId !== f) return no('우리 부대가 아닙니다.');
      if (!STANCE[p.stance]) return no('작전 방침을 고르세요.'); if (a.stance === p.stance) return no('이미 그 방침입니다.');
      return { ok: true };
    },
    GARRISON(s, f, p) {
      const a = s.armies[p.armyId]; if (!a || a.factionId !== f) return no('우리 부대가 아닙니다.');
      if (a.leg || a.path.length) return no('행군 중에는 주둔시킬 수 없습니다.');
      if (s.regions[a.loc].controller !== f) return no('우리 거점에서만 주둔군으로 편입할 수 있습니다.');
      return { ok: true };
    },
    ENVOY(s, f, p) {
      const F = s.factions[f], T = s.factions[p.targetFactionId];
      if (!T || !T.alive || T.id === f) return no('대상 세력이 없습니다.');
      if (activeOrder(s, o => (o.type === 'ENVOY' || o.type === 'CALL_ARMS') && o.actorId === f && o.params.targetFactionId === T.id)) return no('이미 사신이 가고 있습니다.');
      if (s.proposals.some(x => x.status === 'pending' && x.kind === 'counter' && x.to === f && x.from === T.id)) return no('그쪽의 역제안에 먼저 답해야 합니다.');
      const t = T.id, tm = p.terms || {}; let kind = p.kind, terms = {}, cost = K.envoyCost;
      if (kind === 'offer' && T.overlord === f) kind = 'revise';
      if (kind === 'offer' || kind === 'revise') {
        if (!FMETA[f].kingdom || F.overlord) return no('귀부를 권할 수 있는 것은 왕국뿐입니다.');
        if (FMETA[t].kingdom || FMETA[t].sovereign) return no('이 세력에는 귀부를 권할 수 없습니다.');
        terms = normTerms(tm, f);
        if (kind === 'revise') {
          const ag = vassalAg(s, f, t); if (!ag) return no('섬기는 약정이 없습니다.');
          if (s.week - (ag.revised === undefined ? -99 : ag.revised) < 8) return no('조건을 고친 지 얼마 안 됐습니다. (8주 간격)');
          if (terms.autonomy === ag.terms.autonomy && terms.mobilize === ag.terms.mobilize && terms.protect === ag.terms.protect) return no('지금 조건과 같습니다. 바꿀 조건을 고르세요.');
        }
      } else if (kind === 'pledge') {
        if (FMETA[f].kingdom || FMETA[f].sovereign) return no('왕국은 귀부를 청하지 않습니다.');
        if (!FMETA[t].kingdom) return no('귀부는 고려나 후백제에만 청할 수 있습니다.');
        if (F.overlord === t) return no('이미 그 나라를 섬기고 있습니다.');
        terms = normTerms(Object.assign({}, standingOf(normTerms(tm, t))), t);
      } else if (kind === 'gift') {
        if (atWar(s, f, t)) return no('교전 중인 세력에는 예물을 보낼 수 없습니다.'); cost = K.giftCost;
      } else if (kind === 'marriage') {
        if (!FMETA[f].kingdom) return no('혼인을 청할 수 있는 것은 왕실뿐입니다.');
        if (FMETA[t].kingdom) return no('맞서는 왕국과는 혼인할 수 없습니다.');
        if (atWar(s, f, t)) return no('교전 중인 세력과는 혼인할 수 없습니다.');
        if (s.ties[tk(f, t)]) return no('이미 혼인으로 맺어져 있습니다.'); cost = K.marryCost;
      } else if (kind === 'passage') {
        if (atWar(s, f, t)) return no('교전 중인 세력에는 통행을 청할 수 없습니다.');
        if (sameBloc(s, f, t) || trust(s, f, t) >= 60) return no('이미 그 땅을 지나갈 수 있습니다.');
        if (s.passes[t + '>' + f] >= s.week) return no('이미 통행을 허락받았습니다. (' + dateStr(s.passes[t + '>' + f]) + '까지)');
        terms = { gold: clamp(Math.floor((tm.gold || 0) / 50) * 50, 0, 300) };
      } else if (kind === 'truce') {
        if (!atWar(s, f, t)) return no('싸우고 있는 상대가 아닙니다.');
        if (F.overlord || T.overlord) return no('휴전은 종주끼리 맺습니다. 섬기는 세력은 종주의 휴전을 따릅니다.');
        terms = { weeks: [8, 12, 16].indexOf(tm.weeks) >= 0 ? tm.weeks : K.truceWeeks, gold: clamp(Math.floor((tm.gold || 0) / 50) * 50, 0, 300) };
      } else if (kind === 'aid') {
        const R = s.regions[tm.regionId];
        if (atWar(s, f, t)) return no('교전 중인 세력에는 원군을 청할 수 없습니다.');
        if (!R || !sameBloc(s, f, R.controller)) return no('원군을 받을 우리 편 거점을 고르세요.');
        if (R.controller === t) return no('그 세력 자신의 거점입니다.');
        if (s.agreements.some(g => g.type === 'aid' && g.parties[0] === f && g.parties[1] === t && g.obs.some(o => o.status === 'pending'))) return no('이미 원군을 약속받았습니다.');
        terms = { regionId: R.id, gold: clamp(Math.floor((tm.gold || 0) / 50) * 50, 0, 300) };
      } else return no('사신의 용건을 고르세요.');
      if (F.treasury < cost + (terms.gold || 0)) return no('국고가 부족합니다. (' + (cost + (terms.gold || 0)) + ' 필요)');
      return { ok: true, cost, kind, terms };
    },
    CALL_ARMS(s, f, p) {
      const ag = vassalAg(s, f, p.vassalId), R = s.regions[p.regionId];
      if (!ag) return no('우리를 섬기는 세력이 아닙니다.');
      if (!ag.terms.mobilize) return no('동원 의무를 약속받지 않았습니다. 조건 변경으로 먼저 얻어야 합니다.');
      if (ag.obs.some(o => o.kind === 'mobilize' && o.status === 'pending') || activeOrder(s, o => o.type === 'CALL_ARMS' && o.actorId === f && o.params.targetFactionId === p.vassalId)) return no('이미 동원령을 내렸습니다.');
      if (s.week - (ag.lastCall === undefined ? -99 : ag.lastCall) < K.callCooldown) return no('동원령은 ' + K.callCooldown + '주에 한 번만 내릴 수 있습니다.');
      if (!R) return no('군사를 모을 거점을 고르세요.');
      const defend = sameBloc(s, f, R.controller) && R.controller !== p.vassalId, siege = atWar(s, f, R.controller) && armyList(s).some(a => a.factionId === f && !a.leg && a.loc === R.id);
      if (!defend && !siege) return no('동원령은 우리 편 거점을 지키거나, 우리가 포위 중인 성을 칠 때만 내릴 수 있습니다.');
      return { ok: true, ag };
    },
    PROBE(s, f, p) {
      const T = s.factions[p.targetFactionId]; if (!T || !T.alive || T.id === f) return no('대상 세력이 없습니다.');
      if (activeOrder(s, o => o.type === 'PROBE' && o.actorId === f && o.params.targetFactionId === T.id)) return no('이미 사람을 보냈습니다.');
      if (s.factions[f].treasury < K.probeCost) return no('국고가 부족합니다. (' + K.probeCost + ' 필요)');
      return { ok: true, cost: K.probeCost };
    },
    PACIFY(s, f, p) {
      const r = s.regions[p.regionId]; if (!r || r.controller !== f) return no('우리 거점이 아닙니다.');
      if (r.siege) return no('포위 중에는 할 수 없습니다.');
      if (r.morale >= 90) return no('민심이 이미 높습니다.');
      if (s.week - r.lastPacify < K.pacifyCooldown || activeOrder(s, o => o.type === 'PACIFY' && o.params.regionId === r.id)) return no('최근에 민심을 수습한 거점입니다. (' + K.pacifyCooldown + '주 간격)');
      if (s.factions[f].treasury < K.pacifyCost) return no('국고가 부족합니다. (' + K.pacifyCost + ' 필요)');
      return { ok: true, cost: K.pacifyCost };
    },
    APPOINT(s, f, p) {
      const R = s.regions[p.regionId], c = s.characters[p.charId];
      if (!R || R.controller !== f) return no('우리 거점이 아닙니다.'); if (R.siege) return no('포위된 거점에는 보낼 수 없습니다.');
      if (!c || c.faction !== f || c.status !== 'active') return no('보낼 인물을 고르세요.');
      if (c.id === s.factions[f].rulerId) return no('군주는 성주로 보낼 수 없습니다.'); if (c.armyId) return no(c.name + '은(는) 지금 자리를 비울 수 없습니다.');
      if (R.lord === c.id && c.loc === R.id) return no('이미 이곳 성주입니다.');
      if (activeOrder(s, o => o.type === 'APPOINT' && o.actorId === f && o.params.regionId === R.id)) return no('이미 새 성주가 부임하는 중입니다.');
      let weeks = 1; if (c.loc !== R.id) { const pth = findPath(s, f, c.loc, R.id, { light: 1, heavy: 0, archer: 0, cav: 0 }); if (!pth) return no('갈 수 있는 길이 없습니다.'); weeks = Math.max(1, pth.weeks); }
      return { ok: true, weeks };
    },
    REWARD(s, f, p) {
      const c = s.characters[p.charId]; if (!c || c.status !== 'active') return no('포상할 인물을 고르세요.');
      const own = c.faction === f && c.id !== s.factions[f].rulerId, vas = s.factions[c.faction].overlord === f && s.factions[c.faction].rulerId === c.id;
      if (!own && !vas) return no('우리 신하나, 우리를 섬기는 세력의 우두머리만 포상할 수 있습니다.');
      if (p.kind === 'gold') { if (s.factions[f].treasury < K.rewardGold) return no('국고가 부족합니다. (' + K.rewardGold + ' 필요)'); return { ok: true, cost: K.rewardGold, own }; }
      if (p.kind === 'office') {
        if (!FMETA[f].kingdom) return no('관직은 왕만 내릴 수 있습니다.');
        if ((c.office || 0) >= 3) return no('이미 가장 높은 관등입니다.');
        if (s.factions[f].treasury < K.officeCost) return no('국고가 부족합니다. (' + K.officeCost + ' 필요)');
        return { ok: true, cost: K.officeCost, own };
      }
      return no('포상 방법을 고르세요.');
    },
    HEIR(s, f, p) {
      const F = s.factions[f], c = s.characters[p.charId];
      if (!HEIRS[f]) return no('후계를 다툴 왕자가 없습니다.');
      if (!c || HEIRS[f].indexOf(c.id) < 0 || c.faction !== f || c.status !== 'active') return no('후계로 세울 수 없는 인물입니다.');
      if (F.heir === c.id) return no('이미 후계로 세웠습니다.');
      if (s.week - F.heirWeek < K.heirCooldown) return no('후계를 정한 지 얼마 안 됐습니다. (' + K.heirCooldown + '주 간격)');
      return { ok: true };
    },
    RESPOND(s, f, p) {
      const pr = s.proposals.find(x => x.id === p.proposalId && x.status === 'pending');
      if (!pr || pr.to !== f) return no('답할 제안이 없습니다.');
      return { ok: true, pr };
    },
  };
  function addOrder(s, f, type, params, cost, duration) { const o = { id: s.nextId++, actorId: f, type, params, cost: cost || 0, duration, startedAt: s.week, status: 'active', result: null }; s.orders.push(o); return o; }
  const APPLY = {
    RECRUIT(s, f, p, v) { s.factions[f].treasury -= v.cost; s.regions[p.regionId].manpower -= v.n; addOrder(s, f, 'RECRUIT', { regionId: p.regionId, unit: p.unit, count: v.n }, v.cost, K.recruitWeeks); },
    REQUISITION(s, f, p) { addOrder(s, f, 'REQUISITION', { regionId: p.regionId }, 0, 1); },
    BUY_GRAIN(s, f, p, v) { s.factions[f].treasury -= v.gold; addOrder(s, f, 'BUY_GRAIN', { regionId: p.regionId, gold: v.gold, grain: v.gold * K.grainPerGold }, v.gold, K.buyWeeks); },
    FORTIFY(s, f, p, v) { s.factions[f].treasury -= v.cost; addOrder(s, f, 'FORTIFY', { regionId: p.regionId }, v.cost, K.repairWeeks); },
    SCOUT(s, f, p, v) { s.factions[f].treasury -= v.cost; addOrder(s, f, 'SCOUT', { regionId: p.regionId }, v.cost, v.duration); },
    MARCH(s, f, p, v) {
      const R = s.regions[p.fromRegionId], F = s.factions[f];
      for (const k of UNITS) R.garrison[k] -= v.units[k];
      let c = v.carry; const keepG = upkeep(R.garrison) * K.garrisonGrain * 8;
      let t1 = Math.min(c, Math.max(0, R.grain - keepG)); R.grain -= t1; c -= t1; t1 = Math.min(c, F.grain); F.grain -= t1; c -= t1; R.grain -= Math.min(c, R.grain);
      const n = s.nextId++, id = 'a' + n;
      const deps = (p.deputyIds || []).filter(Boolean);
      s.armies[id] = { id, n, factionId: f, commanderId: p.commanderId || null, deputyIds: deps, units: v.units, loc: R.id, path: v.path.slice(), leg: null, morale: Math.max(60, R.gMorale), supply: v.carry, stance: STANCE[p.stance] ? p.stance : '신중', mission: v.mission, target: p.targetRegionId, origin: R.id, startSize: total(v.units), starve: 0, cut: 0, idle: 0, created: s.week, ambushChecked: false };
      for (const cid of [p.commanderId].concat(deps).filter(Boolean)) s.characters[cid].armyId = id;
      return { armyId: id, eta: v.eta };
    },
    ARMY_ORDER(s, f, p, v) { const a = s.armies[p.armyId]; a.path = v.path.slice(); a.mission = v.mission; a.target = p.targetRegionId; a.idle = 0; return { eta: v.eta }; },
    RETREAT(s, f, p) { sendHome(s, s.armies[p.armyId]); },
    GARRISON(s, f, p) { garrisonArmy(s, s.armies[p.armyId]); },
    SET_STANCE(s, f, p) { s.armies[p.armyId].stance = p.stance; },
    ENVOY(s, f, p, v) { s.factions[f].treasury -= v.cost; addOrder(s, f, 'ENVOY', { targetFactionId: p.targetFactionId, kind: v.kind, terms: v.terms }, v.cost, K.envoyWeeks); },
    CALL_ARMS(s, f, p, v) { v.ag.lastCall = s.week; addOrder(s, f, 'CALL_ARMS', { targetFactionId: p.vassalId, kind: 'callarms', terms: { regionId: p.regionId } }, 0, K.callWeeks); },
    PROBE(s, f, p, v) { s.factions[f].treasury -= v.cost; addOrder(s, f, 'PROBE', { targetFactionId: p.targetFactionId }, v.cost, K.probeWeeks); },
    PACIFY(s, f, p, v) { s.factions[f].treasury -= v.cost; s.regions[p.regionId].lastPacify = s.week; addOrder(s, f, 'PACIFY', { regionId: p.regionId }, v.cost, K.pacifyWeeks); },
    APPOINT(s, f, p, v) { s.characters[p.charId].armyId = 'appoint'; addOrder(s, f, 'APPOINT', { regionId: p.regionId, charId: p.charId }, 0, v.weeks); return { weeks: v.weeks }; },
    REWARD(s, f, p, v) {
      const c = s.characters[p.charId];
      if (p.kind === 'office') { grantOffice(s, f, c, false); return; }
      s.factions[f].treasury -= v.cost;
      if (v.own) { c.loyalty = Math.min(100, c.loyalty + 10); c.merit = Math.max(0, (c.merit || 0) - 15); if (c.merit < 15) c.wait = 0; c.pr = Math.min(100, c.pr + 1); } else addTrust(s, f, c.faction, 6);
    },
    HEIR(s, f, p) {
      const F = s.factions[f], e = heirEffects(s, f, p.charId), c = s.characters[p.charId];
      for (const id in e.changes) s.characters[id].loyalty = clamp(s.characters[id].loyalty + e.changes[id], 0, 100);
      F.heir = p.charId; F.heirWeek = s.week; F.legitimacy = clamp(F.legitimacy + e.legitimacy, 0, 100);
      chron(s, 'heir', [f], F.capitalId, s.characters[F.rulerId].name + '이(가) ' + c.name + '을(를) 후계로 세웠다.', { cause: '후계 지명', stateChanges: Object.keys(e.changes).map(id => s.characters[id].name + ' 충성 ' + (e.changes[id] > 0 ? '+' : '') + e.changes[id]).join(', ') });
    },
    RESPOND(s, f, p, v) { resolveProposal(s, v.pr, !!p.accept); },
  };
  function validate(s, f, type, p) {
    if (s.over) return no('캠페인이 끝났습니다.');
    if (!s.factions[f] || !s.factions[f].alive) return no('세력이 없습니다.');
    if (!VALID[type]) return no('알 수 없는 명령입니다.');
    return VALID[type](s, f, p || {});
  }
  function issueOrder(s, f, type, p, meta) {
    const v = validate(s, f, type, p);
    const rec = { week: s.week, faction: f, type, params: p, ok: v.ok, reason: v.ok ? null : v.reason };
    if (meta) { rec.u = meta.u; rec.why = meta.why; }
    s.log.push(rec);
    if (!v.ok) return v;
    const r = APPLY[type](s, f, p, v) || {};
    return Object.assign({ ok: true }, r);
  }
  // 출정 미리보기: 편성 화면이 그대로 쓰는 계산 (전투와 같은 식, 우리가 아는 정보만)
  const MIX = { light: 0.5, heavy: 0.25, archer: 0.2, cav: 0.05 };
  function simulateAssault(s, f, T, units, cmd, deps, stance, morale0, weeks, est, conf) {
    const A = staff(cmd, deps), S = STANCE[stance] || STANCE.신중, lordC = T.lord && s.characters[T.lord];
    const ie = s.intel[f].regions[T.id], scoutInfo = ie && ie.units && s.week - ie.week <= K.intelFresh ? ie : null;
    let dCmd = lordC && lordC.status === 'active' && lordC.loc === T.id ? lordC : null, Ds = staff(dCmd, []);
    if (scoutInfo) { const offs = scoutInfo.officers.map(id => s.characters[id]).sort((a, b) => b.ld - a.ld); dCmd = offs[0] || null; Ds = staff(dCmd, offs.slice(1, 3)); }
    const mixOf = scoutInfo && total(scoutInfo.units) ? scoutInfo.units : null;
    const ctx = { terrain: T.terrain, fort: T.fort }, scouted = scoutedRecently(s, f, T.id), t0 = total(units);
    const amb = ambushChance(A.st, Ds.st, T.terrain, stance, scouted, t0 ? units.cav / t0 : 0);
    const N = 240, res = { win: 0, fail: 0, rout: 0, stall: 0, weeks: 0, loss: 0, ambush: Math.round(amb * 100), scouted, defCmd: dCmd ? dCmd.name : null, defStaff: Ds.deps.map(c => c.name), knownMix: !!mixOf };
    for (let i = 0; i < N; i++) {
      const r = j => h32(s.seed ^ 0x5a17, s.week * 1000 + i, j, RIDX[T.id]);
      const spread = conf === 'confirmed' ? 0.95 + 0.1 * r(0) : 0.75 + 0.5 * r(0);
      const aU = Object.assign({}, units), dU = zero(), mt = mixOf ? total(mixOf) : 1; for (const k of UNITS) dU[k] = est * spread * (mixOf ? mixOf[k] / mt : MIX[k]);
      let aM = morale0, dM = 70, out = 'stall', w = 0; const init = total(dU);
      if (r(1) < amb) { for (const k of UNITS) aU[k] -= aU[k] * lossRates(aU, 0.08, false, 0)[k]; aM -= 12; }
      for (w = 1; w <= weeks; w++) {
        const m = roundMath({ units: aU, morale: aM, starving: false, staff: A, sP: S.atk, sL: S.loss }, { units: dU, morale: dM, starving: false, staff: Ds, sP: 1, sL: 1 }, ctx, r(2 * w + 2), r(2 * w + 3));
        const ra = lossRates(aU, m.lossA, false, T.fort), rd = lossRates(dU, m.lossD, true, T.fort);
        for (const k of UNITS) { aU[k] -= aU[k] * ra[k]; dU[k] -= dU[k] * rd[k]; }
        aM = clamp(aM + (m.winner === 'atk' ? 3 : -8), 0, 100); dM = clamp(dM + (m.winner === 'def' ? 3 : -8), 0, 100);
        if (total(dU) < Math.max(100, 0.12 * init) || (w >= T.fort && dM <= 20 && m.winner === 'atk')) { out = 'win'; break; }
        if (total(aU) < 50) { out = 'rout'; break; }
        if (aM <= S.retreat || total(aU) < 0.35 * t0) { out = 'fail'; break; }
      }
      res[out]++; if (out === 'win') res.weeks += Math.min(w, weeks); res.loss += t0 - total(aU);
    }
    res.weeks = res.win ? Math.round(res.weeks / res.win * 10) / 10 : null; res.loss = Math.round(res.loss / N / 10) * 10;
    for (const k of ['win', 'fail', 'rout', 'stall']) res[k] = Math.round(res[k] / N * 100);
    return res;
  }
  function previewMarch(s, f, p) {
    const v = validate(s, f, 'MARCH', p); if (!v.ok) return v;
    const R = s.regions[p.fromRegionId], T = s.regions[p.targetRegionId], c = p.commanderId ? s.characters[p.commanderId] : null;
    const deps = (p.deputyIds || []).filter(Boolean).map(id => s.characters[id]), st = staff(c, deps), stance = STANCE[p.stance] ? p.stance : '신중';
    const remain = zero(); for (const k of UNITS) remain[k] = R.garrison[k] - v.units[k];
    const eff = {}; for (const k of UNITS) eff[k] = unitEff(k, T.terrain, false, v.mission === 'attack' ? T.fort : 0);
    const via = linkedAt(s, f, T.id);
    const out = { ok: true, mission: v.mission, path: v.path, eta: v.eta, total: total(v.units), basePower: Math.round(basePower(v.units, T.terrain, false, v.mission === 'attack' ? T.fort : 0)), eff,
      perWeek: Math.round(v.perWeek), gold: Math.round(goldUpkeep(v.units) * 10) / 10, carry: Math.round(v.carry), carryWeeks: v.perWeek ? Math.floor(v.carry / v.perWeek) : 0, short: v.short, remain: total(remain),
      declaresWar: v.mission === 'attack' && !atWar(s, f, T.controller), odds: null, supply: { linked: !!via, via: via ? s.regions[via].name : null },
      staff: { ld: st.ld, ma: st.ma, st: st.st, cmdF: cmdF(st), mix: mixPenalty(v.units, st.ld, deps.length) } };
    if (v.mission === 'attack') {
      const it = regionIntel(s, f, T.id);
      if (it.conf === 'unknown') out.odds = { label: '정보 없음', conf: 'unknown' };
      else {
        const est = it.garr + obsArmies(s, f, T.id, x => sameBloc(s, x, T.controller), false);
        const left = out.carryWeeks - v.eta, weeks = clamp(via ? 12 : left, 1, 12);
        const sim = simulateAssault(s, f, T, v.units, c, deps, stance, Math.max(60, R.gMorale), weeks, est, it.conf);
        out.odds = Object.assign({ label: sim.win >= 65 ? '유리' : sim.win >= 35 ? '접전' : '불리', conf: it.conf, est: Math.round(est), simWeeks: weeks }, sim);
      }
    }
    return out;
  }

  // ───────────────────────── 부대 처리 ─────────────────────────
  function garrisonArmy(s, a) {
    const R = s.regions[a.loc]; addU(R.garrison, a.units); R.grain += a.supply;
    for (const c of chars(s, [a.commanderId].concat(a.deputyIds || []))) { c.armyId = null; c.loc = R.id; }
    delete s.armies[a.id];
  }
  function removeArmy(s, a) {
    for (const c of chars(s, [a.commanderId].concat(a.deputyIds || []))) { c.armyId = null; const F = s.factions[c.faction]; if (F.alive) c.loc = F.capitalId; }
    delete s.armies[a.id];
  }
  function nearestHome(s, a) {
    let best = null;
    for (const r of regs(s)) {
      if (r.id === a.loc || r.siege) continue;
      const own = r.controller === a.factionId; if (!own && !sameBloc(s, a.factionId, r.controller)) continue;
      const p = findPath(s, a.factionId, a.loc, r.id, a.units); if (!p) continue;
      const sc = p.weeks + (own ? 0 : 3); if (!best || sc < best.sc) best = { sc, p, r };
    }
    return best;
  }
  function sendHome(s, a) {
    a.mission = 'return'; a.idle = 0;
    if (a.leg) { // 가던 길을 되돌아간다 (순간이동 없음: 온 만큼 다시 걸린다)
      const L = a.leg, f = L.f0 + (L.f1 - L.f0) * L.done / L.cost;
      if (L.done === 0) a.leg = null; else a.leg = { a: L.a, b: L.b, f0: f, f1: L.f0, to: a.loc, cost: L.done, done: 0 };
      a.path = []; a.target = a.loc; return true;
    }
    const h = nearestHome(s, a); if (!h) { a.path = []; return false; }
    a.path = h.p.path.slice(); a.target = h.r.id; return true;
  }

  // ───────────────────────── 외교·약속 (R3) ─────────────────────────
  function joinWar(s, a, b) { if (!atWar(s, a, b)) { s.wars[tk(a, b)] = s.week; s.trust[tk(a, b)] = Math.min(trust(s, a, b), -60); } }
  function truceBetween(s, a, b) { const ha = head(s, a), hb = head(s, b); return s.agreements.find(g => g.active && g.type === 'truce' && ((g.parties[0] === ha && g.parties[1] === hb) || (g.parties[0] === hb && g.parties[1] === ha))) || null; }
  function vassalAg(s, Kf, Mf) { return s.agreements.find(g => g.active && g.type === 'vassal' && g.parties[0] === Kf && g.parties[1] === Mf) || null; }
  function disrepute(s, f, n) { s.factions[f].breaches = (s.factions[f].breaches || 0) + n; }
  function breakTruce(s, a, ag, regionId) {
    const victim = ag.parties[0] === head(s, a) ? ag.parties[1] : ag.parties[0];
    ag.active = false; ag.breaches++; ag.brokenBy = a;
    for (const k of ag.pairs) { const p = k.split('|'); if (s.factions[p[0]].alive && s.factions[p[1]].alive) s.wars[k] = s.week; }
    addTrust(s, a, victim, -30); disrepute(s, a, 2); s.factions[a].legitimacy = Math.max(0, s.factions[a].legitimacy - 8);
    for (const x of FIDS) if (x !== a && x !== victim && s.factions[x].alive) addTrust(s, x, a, -10);
    chron(s, 'breach', [a, victim], regionId, fname(s, a) + '이(가) 휴전을 깨고 ' + fname(s, victim) + '을(를) 쳤다. 뭇 세력의 믿음을 잃었다.', { cause: '휴전 파기', stateChanges: '신뢰 −30, 다른 세력 신뢰 −10, 정통성 −8' });
    report(s, victim, fname(s, a) + '이(가) 휴전을 깼습니다.', true, regionId); report(s, a, '휴전을 깼습니다. 다른 세력들의 믿음이 떨어졌습니다.', true, regionId);
  }
  function declareWar(s, a, b, regionId) {
    if (atWar(s, a, b)) return;
    const tr = truceBetween(s, a, b); if (tr) breakTruce(s, a, tr, regionId);
    for (const g of s.agreements) if (g.active && g.type === 'passage' && g.parties.indexOf(a) >= 0 && g.parties.indexOf(b) >= 0) { g.active = false; delete s.passes[g.parties[0] + '>' + g.parties[1]]; }
    if (s.ties[tk(a, b)]) { delete s.ties[tk(a, b)]; disrepute(s, a, 2); chron(s, 'breach', [a, b], regionId, fname(s, a) + '이(가) 혼인으로 맺은 ' + fname(s, b) + '을(를) 쳤다.', { cause: '혼인 관계 파기' }); }
    joinWar(s, a, b);
    for (const x of FIDS) if (x !== a && x !== b && s.factions[x].alive) addTrust(s, x, a, FMETA[x].kingdom ? -3 : -8);
    chron(s, 'war', [a, b], regionId, fname(s, a) + '이(가) ' + fname(s, b) + '에 군사를 일으켰다.', { cause: '출정', decision: '공격' });
    report(s, b, fname(s, a) + '이(가) 우리를 공격합니다.', true, regionId);
    const o = s.factions[b].overlord;
    if (o && o !== a && !atWar(s, a, o)) { joinWar(s, a, o); chron(s, 'war', [a, o], regionId, fname(s, b) + '의 종주 ' + fname(s, o) + '도 ' + fname(s, a) + '와(과) 싸우게 되었다.'); }
  }

  // 귀부 조건: 자치·관직·예물·동원 의무·보호 기한
  const TERMS0 = { autonomy: 'full', office: 'none', gold: 0, mobilize: false, protect: 8 };
  function normTerms(t, Kf) {
    t = t || {};
    return { autonomy: ['full', 'tribute10', 'tribute20'].indexOf(t.autonomy) >= 0 ? t.autonomy : 'full', office: FMETA[Kf].kingdom && ['now', 'later'].indexOf(t.office) >= 0 ? t.office : 'none',
      gold: clamp(Math.floor((t.gold || 0) / 50) * 50, 0, 300), mobilize: !!t.mobilize, protect: [0, 4, 8].indexOf(t.protect) >= 0 ? t.protect : 8 };
  }
  const standingOf = t => ({ autonomy: t.autonomy, mobilize: t.mobilize, protect: t.protect });
  function termParts(t) {
    const p = {}; p['자치 조건'] = { full: 10, tribute10: 0, tribute20: -10 }[t.autonomy];
    if (t.office === 'now') p['관직 수여'] = 8; else if (t.office === 'later') p['관직 약속'] = 5;
    if (t.gold) p['예물'] = Math.round(t.gold / 100 * 6);
    if (t.mobilize) p['동원 의무'] = -8;
    if (t.protect === 4) p['빠른 구원 약속'] = 5; else if (t.protect === 0) p['구원 약속 없음'] = -8;
    return p;
  }
  function termsText(t) {
    const a = [{ full: '자치 보장', tribute10: '세수 1할 상납', tribute20: '세수 2할 상납' }[t.autonomy]];
    a.push(t.mobilize ? '동원 의무 있음' : '동원 의무 없음'); a.push(t.protect ? '피침 시 ' + t.protect + '주 안 구원' : '구원 의무 없음');
    if (t.office === 'now') a.push('관직 수여'); else if (t.office === 'later') a.push(K.officeWeeks + '주 안에 관직 수여 약속');
    if (t.gold) a.push('예물 ' + t.gold);
    return a;
  }
  function sumParts(parts) { let score = 0; for (const k in parts) { parts[k] = Math.round(parts[k]); if (!parts[k]) delete parts[k]; else score += parts[k]; } return score; }
  function repPart(s, f) { return -Math.min(20, 6 * (s.factions[f].breaches || 0)); }
  // M이 K 밑으로 들어갈지의 점수. obs의 정보로만 계산한다 (예상할 때는 K, 실제 판정은 M)
  function acceptScore(s, Kf, Mf, obs, terms) {
    const M = s.factions[Mf], O = M.overlord, parts = {}; terms = normTerms(terms, Kf);
    let mStr = 0, kAdj = 0, xAdj = 0, sieged = false, guarded = false;
    for (const R of regs(s)) {
      if (R.controller !== Mf) continue;
      mStr += obsGarr(s, obs, R.id);
      if (R.siege && sameBloc(s, R.siege.by, Kf)) sieged = true;
      for (const n of ADJ[R.id]) { const c = s.regions[n.to].controller; if (c === Kf) kAdj += obsGarr(s, obs, n.to); else if (c !== Mf && atWar(s, Kf, c)) xAdj += obsGarr(s, obs, n.to); }
      kAdj += obsArmies(s, obs, R.id, x => x === Kf, true);
      if (O && O !== Kf && armyList(s).some(a => a.factionId === O && !a.leg && a.loc === R.id)) guarded = true;
      xAdj += obsArmies(s, obs, R.id, x => x !== Mf && atWar(s, Kf, x), true);
    }
    mStr = Math.max(mStr, 300);
    parts['신뢰'] = trust(s, Mf, Kf) - 50;
    parts['병력 압력'] = clamp((kAdj / mStr - 1) * 15, -10, 25) + (sieged ? 15 : 0);
    if (guarded) parts['종주군 주둔'] = -20;
    const kEnemyIsMine = FIDS.some(x => x !== Mf && atWar(s, Kf, x) && hostileTo(s, Mf, x));
    parts['안전 위협'] = clamp(xAdj / mStr * 8, 0, 25) * (kEnemyIsMine ? 1 : 0.3);
    parts['기존 관계'] = O && O !== Kf ? -Math.max(0, trust(s, Mf, O) - 30) * 0.8 : 0;
    Object.assign(parts, termParts(terms));
    if (s.ties[tk(Kf, Mf)]) parts['혼인 관계'] = 12;
    if (FIDS.some(x => x !== Kf && s.ties[tk(x, Mf)] && atWar(s, Kf, x))) parts['적국과의 혼인'] = -8;
    parts['약속 이력'] = repPart(s, Kf);
    if (M.pledgedWeek !== undefined && s.week - M.pledgedWeek < 24) parts['막 맺은 약속'] = -25;
    if (s.left[Kf + '<' + Mf]) parts['돌아선 이력'] = -10 * s.left[Kf + '<' + Mf];
    parts['성향'] = (AIP[Mf].lean || {})[Kf] || 0;
    if (atWar(s, Kf, Mf) && !sieged) parts['교전 중'] = -15;
    return { score: sumParts(parts), parts };
  }
  function reviseScore(s, Kf, Mf, terms) {
    const ag = vassalAg(s, Kf, Mf), parts = {}, np = termParts(normTerms(terms, Kf)), op = ag ? termParts(Object.assign({ office: 'none', gold: 0 }, ag.terms)) : {};
    for (const k in np) parts[k] = np[k]; for (const k in op) parts[k] = (parts[k] || 0) - op[k];
    parts['신뢰'] = (trust(s, Mf, Kf) - 50) / 4; parts['약속 이력'] = repPart(s, Kf);
    return { score: sumParts(parts), parts };
  }
  function marriageScore(s, Kf, Tf) {
    const parts = { 신뢰: trust(s, Tf, Kf) - 45, 성향: (AIP[Tf].lean || {})[Kf] || 0, 정통성: (s.factions[Kf].legitimacy - 60) / 4, '약속 이력': repPart(s, Kf) };
    if (FIDS.some(x => x !== Kf && s.ties[tk(x, Tf)] && atWar(s, Kf, x))) parts['적국과의 혼인'] = -15;
    return { score: sumParts(parts), parts };
  }
  function passageScore(s, Gf, Rf, terms, know) {
    const G = s.factions[Gf], obs = know ? Gf : Rf, parts = { 신뢰: trust(s, Gf, Rf) - 40, 대가: (terms.gold || 0) / 100 * 10, '약속 이력': repPart(s, Rf) };
    if (G.overlord && atWar(s, G.overlord, Rf)) parts['종주의 적'] = -40;
    let g = 0, r = 0; for (const R of regs(s)) { if (R.controller !== Gf) continue; g += obsGarr(s, obs, R.id); for (const n of ADJ[R.id]) if (s.regions[n.to].controller === Rf) r += obsGarr(s, obs, n.to); }
    parts['병력 압력'] = clamp((r / Math.max(300, g) - 1) * 8, 0, 15);
    return { score: sumParts(parts), parts };
  }
  function truceScore(s, Tf, Pf, terms, know) {
    const parts = { 신뢰: (trust(s, Tf, Pf) + 80) / 8, 대가: (terms.gold || 0) / 100 * 5, '공세 성향': -AIP[Tf].aggr * 25 }, unknown = [];
    let pressed = 0, pressing = 0;
    for (const R of regs(s)) { if (!R.siege) continue; if (sameBloc(s, R.controller, Tf) && sameBloc(s, R.siege.by, Pf)) pressed++; if (sameBloc(s, R.controller, Pf) && sameBloc(s, R.siege.by, Tf)) pressing++; }
    parts['전세'] = (pressed ? 15 : 0) - (pressing ? 15 : 0);
    parts['최근 패전'] = Math.min(16, 8 * s.chronicle.filter(c => (c.type === 'retreat' || c.type === 'rout') && c.participants[0] === Tf && s.week - c.week <= 12).length);
    if (know) { const gw = grainWeeks(s, Tf); parts['군량 사정'] = gw < 8 ? 15 : gw < 14 ? 6 : 0; } else unknown.push('군량 사정');
    return { score: sumParts(parts), parts, unknown };
  }
  function aidSource(s, Tf, rid, duty) { // duty: 약속한 동원은 위협이 있어도 주둔군의 4분의 1까지는 낸다
    let best = null;
    for (const S of regs(s)) { if (S.controller !== Tf || S.siege || S.id === rid || defiant(s, S)) continue; let sp = spare(s, Tf, S); if (duty) sp = Math.max(sp, Math.floor(total(S.garrison) * 0.25 / 100) * 100); if (sp < 300) continue; const p = findPath(s, Tf, S.id, rid, S.garrison); if (!p || p.weeks > 8) continue; if (!best || sp / (p.weeks + 1) > best.sc) best = { S, sp, p, sc: sp / (p.weeks + 1) }; }
    return best;
  }
  function aidScore(s, Tf, Pf, terms, know) {
    const R = s.regions[terms.regionId], T = s.factions[Tf], parts = { 신뢰: trust(s, Tf, Pf) - 50, 대가: (terms.gold || 0) / 100 * 8 }, unknown = [];
    if (R.siege) parts['위급'] = 10;
    if (R.siege && hostileTo(s, Tf, R.siege.by)) parts['공동의 적'] = 10;
    if (T.overlord === Pf) parts['주종 관계'] = 10; else if (s.factions[Pf].overlord === Tf) parts['보호 의무'] = 15;
    if (know) { const cap = T.capitalId; if (threatTo(s, Tf, cap) > defenseOf(s, cap)) parts['자기 방어'] = -20; } else unknown.push('자기 방어');
    return { score: sumParts(parts), parts, unknown, feasible: !!aidSource(s, Tf, R.id) };
  }

  // ── 약정과 약속 장부 ──
  function addAgreement(s, type, parties, terms, until, text) { const ag = { id: s.nextId++, type, week: s.week, parties, terms: terms || null, text: text || [], until: until || null, active: true, breaches: 0, obs: [] }; s.agreements.push(ag); return ag; }
  function addOb(s, ag, by, to, kind, due, extra) { const o = Object.assign({ id: s.nextId++, by, to, kind, due: due === undefined ? null : due, status: 'pending', made: s.week, evidence: null }, extra || {}); ag.obs.push(o); return o; }
  const BREACH = { protect: 25, office: 20, mobilize: 12, aid: 15 };
  const OBNAME = { protect: '구원', office: '관직 수여', mobilize: '동원', aid: '원군' };
  function obText(s, ob) {
    const R = ob.regionId ? s.regions[ob.regionId].name : '', c = ob.charId ? s.characters[ob.charId].name : '';
    return ob.kind === 'protect' ? R + ' 구원' : ob.kind === 'office' ? c + '에게 관직 수여' : ob.kind === 'mobilize' ? R + '(으)로 ' + ob.need + '명 이상 동원' : R + '(으)로 원군 ' + ob.need + '명 이상';
  }
  function leaveOverlord(s, Mf, Of, regionId) {
    s.factions[Mf].overlord = null; for (const r of regs(s)) if (r.controller === Mf) r.overlord = Mf;
    const ag = vassalAg(s, Of, Mf); if (ag) { ag.active = false; for (const o of ag.obs) if (o.status === 'pending') o.status = 'void'; }
    chron(s, 'defect', [Mf, Of], regionId, fname(s, Mf) + '이(가) ' + fname(s, Of) + '와(과)의 관계를 끊었다.', { cause: '신뢰 붕괴', stateChanges: '종주 관계 해소' });
    report(s, Of, fname(s, Mf) + '이(가) 우리를 떠났습니다.', true, regionId);
  }
  function breach(s, ag, ob, why) {
    ob.status = 'breached'; ob.evidence = why; ob.closed = s.week; ag.breaches++;
    const by = ob.by, to = ob.to, pen = BREACH[ob.kind];
    addTrust(s, to, by, -pen); disrepute(s, by, 1);
    for (const x of FIDS) if (x !== by && x !== to && s.factions[x].alive && !FMETA[x].kingdom) addTrust(s, x, by, -3);
    chron(s, 'breach', [by, to], ob.regionId || null, fname(s, by) + '이(가) ' + fname(s, to) + '에게 한 약속(' + obText(s, ob) + ')을 지키지 않았다.', { cause: '약속 미이행: ' + why, stateChanges: '신뢰 −' + pen + ', 다른 호족 신뢰 −3, 평판 하락' });
    report(s, by, '약속을 지키지 못했습니다: ' + obText(s, ob) + '. ' + fname(s, to) + '의 신뢰가 ' + pen + ' 떨어지고 평판이 나빠졌습니다.', true, ob.regionId);
    report(s, to, fname(s, by) + '이(가) 약속을 어겼습니다: ' + obText(s, ob) + '.', true, ob.regionId);
    if (ag.type === 'vassal' && ag.active && by === ag.parties[0] && trust(s, to, by) < 20) leaveOverlord(s, to, by, ob.regionId);
  }
  function fulfil(s, ob, evidence) { ob.status = 'fulfilled'; ob.evidence = evidence; ob.closed = s.week; report(s, ob.by, '약속을 지켰습니다: ' + obText(s, ob) + '.', false, ob.regionId); report(s, ob.to, fname(s, ob.by) + '이(가) 약속을 지켰습니다: ' + obText(s, ob) + '.', false, ob.regionId); }
  function obligations(s, f) {
    const out = { mine: [], theirs: [], done: [] };
    for (const ag of s.agreements) for (const ob of ag.obs || []) { if (ob.by !== f && ob.to !== f) continue; const e = { ag, ob, text: obText(s, ob) }; if (ob.status === 'pending') (ob.by === f ? out.mine : out.theirs).push(e); else if (ob.status !== 'void') out.done.push(e); }
    const d = e => e.ob.due === null ? 999 : e.ob.due; out.mine.sort((a, b) => d(a) - d(b)); out.theirs.sort((a, b) => d(a) - d(b)); out.done.sort((a, b) => (b.ob.closed || 0) - (a.ob.closed || 0));
    return out;
  }

  // ── 약정 체결 ──
  const OFFICE = { goryeo: ['', '원윤', '대상', '대광'], _: ['', '하위 관등', '중위 관등', '상위 관등'] };
  const officeName = (by, lv) => (OFFICE[by] || OFFICE._)[lv] || '';
  function grantOffice(s, by, c, free) {
    if (!free) s.factions[by].treasury -= K.officeCost;
    c.office = (c.office || 0) + 1; c.officeBy = by;
    if (c.faction === by) { c.loyalty = Math.min(100, c.loyalty + 15); c.merit = Math.max(0, (c.merit || 0) - 30); c.wait = 0; } else addTrust(s, by, c.faction, 8);
    c.pr = Math.min(100, c.pr + 2);
    for (const ag of s.agreements) for (const ob of ag.obs || []) if (ob.status === 'pending' && ob.kind === 'office' && ob.by === by && ob.charId === c.id) fulfil(s, ob, dateStr(s.week) + ' ' + officeName(by, c.office) + ' 수여');
    chron(s, 'office', [by, c.faction], null, fname(s, by) + '이(가) ' + (c.faction !== by ? fname(s, c.faction) + '의 ' : '') + c.name + '에게 ' + officeName(by, c.office) + ' 벼슬을 내렸다.', { cause: '논공행상', stateChanges: c.faction === by ? '충성 +15' : '신뢰 +8' });
  }
  function applySubmission(s, Kf, Mf, terms, revise) {
    terms = normTerms(terms, Kf);
    const M = s.factions[Mf], KF = s.factions[Kf], old = M.overlord, ru = s.characters[M.rulerId];
    terms.gold = Math.min(terms.gold, Math.floor(Math.max(0, KF.treasury) / 50) * 50); KF.treasury -= terms.gold; M.treasury += terms.gold;
    let ag;
    if (revise) {
      ag = vassalAg(s, Kf, Mf); if (!ag) return;
      ag.terms = standingOf(terms); ag.text = termsText(ag.terms); ag.revised = s.week; addTrust(s, Kf, Mf, 3);
      chron(s, 'pact', [Kf, Mf], M.capitalId, fname(s, Kf) + '와(과) ' + fname(s, Mf) + '이(가) 섬기는 조건을 고쳤다: ' + termsText(terms).join(', ') + '.', { cause: '조건 재협상', decision: '수락', stateChanges: terms.mobilize ? '동원권 확보' : '조건 변경' });
      report(s, Kf, fname(s, Mf) + '이(가) 새 조건을 받아들였습니다.', true, M.capitalId); report(s, Mf, fname(s, Kf) + '와(과) 조건을 고쳤습니다.', true, M.capitalId);
    } else {
      M.overlord = Kf; M.pledgedWeek = s.week;
      for (const R of regs(s)) if (R.controller === Mf) R.overlord = Kf;
      for (const x of FIDS) if (sameBloc(s, x, Kf) && atWar(s, x, Mf)) delete s.wars[tk(x, Mf)];
      s.trust[tk(Kf, Mf)] = Math.max(trust(s, Kf, Mf) + 15, 50);
      if (old && old !== Kf) { addTrust(s, Mf, old, -30); if (!atWar(s, Kf, old)) addTrust(s, Kf, old, -15); s.left[old + '<' + Mf] = (s.left[old + '<' + Mf] || 0) + 1; }
      for (const g of s.agreements) if (g.active && g.type === 'vassal' && g.parties[1] === Mf) { g.active = false; for (const o of g.obs) if (o.status === 'pending') o.status = 'void'; }
      ag = addAgreement(s, 'vassal', [Kf, Mf], standingOf(terms), null, termsText(standingOf(terms)));
      for (const x of FIDS) if (x !== Kf && x !== Mf && !FMETA[x].kingdom && s.factions[x].alive) addTrust(s, x, Kf, 3);
      chron(s, 'submit', [Kf, Mf], M.capitalId, fname(s, Mf) + '이(가) ' + fname(s, Kf) + '에 귀부했다.' + (old && old !== Kf ? ' (' + fname(s, old) + '와(과)의 관계는 끊어졌다)' : ''), { cause: '귀부 협상', decision: '수락', stateChanges: '종주·통행권 변경. 조건: ' + termsText(terms).join(', ') });
      report(s, Kf, fname(s, Mf) + '이(가) 우리에게 귀부했습니다.', true, M.capitalId);
      report(s, Mf, fname(s, Kf) + '에 귀부했습니다. 조건: ' + termsText(terms).join(', ') + '.', true, M.capitalId);
      if (old && old !== Kf) report(s, old, fname(s, Mf) + '이(가) ' + fname(s, Kf) + ' 쪽으로 돌아섰습니다.', true, M.capitalId);
    }
    if (terms.office === 'now' && ru && (ru.office || 0) < 3) grantOffice(s, Kf, ru, true);
    else if (terms.office === 'later' && ru) addOb(s, ag, Kf, Mf, 'office', s.week + K.officeWeeks, { charId: ru.id });
  }
  function applyMarriage(s, Kf, Tf) {
    s.ties[tk(Kf, Tf)] = { type: 'marriage', week: s.week }; addTrust(s, Kf, Tf, 15);
    addAgreement(s, 'marriage', [Kf, Tf], null, null, ['혼인 관계']);
    chron(s, 'marriage', [Kf, Tf], s.factions[Tf].capitalId, fname(s, Kf) + ' 왕실과 ' + fname(s, Tf) + ' 가문이 혼인을 맺었다.', { cause: '혼인 외교', stateChanges: '신뢰 +15, 인척 관계' });
    report(s, Kf, fname(s, Tf) + '와(과) 혼인을 맺었습니다. 인척이라도 군대가 저절로 따라오지는 않습니다.', true); report(s, Tf, fname(s, Kf) + ' 왕실과 혼인을 맺었습니다.', true);
  }
  function applyPassage(s, Gf, Rf, terms) {
    const g = Math.min(terms.gold || 0, Math.floor(Math.max(0, s.factions[Rf].treasury))); s.factions[Rf].treasury -= g; s.factions[Gf].treasury += g;
    s.passes[Gf + '>' + Rf] = s.week + K.passWeeks; addTrust(s, Gf, Rf, 2);
    addAgreement(s, 'passage', [Gf, Rf], { gold: g }, s.week + K.passWeeks, [K.passWeeks + '주 동안 ' + fname(s, Rf) + '군의 통행 허락']);
    chron(s, 'pact', [Rf, Gf], s.factions[Gf].capitalId, fname(s, Gf) + '이(가) ' + fname(s, Rf) + '군이 제 땅을 지나가도록 허락했다.', { cause: '통행 협상', stateChanges: K.passWeeks + '주 동안 통행 가능' });
    report(s, Rf, fname(s, Gf) + '이(가) 통행을 허락했습니다. ' + K.passWeeks + '주 동안 그 땅을 지나 행군할 수 있습니다.', true); report(s, Gf, fname(s, Rf) + '에 통행을 허락했습니다.', false);
  }
  function applyTruce(s, Pf, Tf, terms) {
    const weeks = [8, 12, 16].indexOf(terms.weeks) >= 0 ? terms.weeks : K.truceWeeks, pairs = [];
    const g = Math.min(terms.gold || 0, Math.floor(Math.max(0, s.factions[Pf].treasury))); s.factions[Pf].treasury -= g; s.factions[Tf].treasury += g;
    for (const x of FIDS) for (const y of FIDS) if (x < y && atWar(s, x, y) && ((sameBloc(s, x, Pf) && sameBloc(s, y, Tf)) || (sameBloc(s, x, Tf) && sameBloc(s, y, Pf)))) { pairs.push(tk(x, y)); delete s.wars[tk(x, y)]; }
    const ag = addAgreement(s, 'truce', [Pf, Tf], { weeks, gold: g }, s.week + weeks, [weeks + '주 휴전']); ag.pairs = pairs;
    for (const a of armyList(s)) { const c = s.regions[a.loc].controller; if (!sameBloc(s, a.factionId, c) && pairs.indexOf(tk(a.factionId, c)) >= 0) sendHome(s, a); else if (a.mission === 'attack' && (a.leg || a.path.length) && pairs.indexOf(tk(a.factionId, s.regions[a.target].controller)) >= 0) sendHome(s, a); }
    addTrust(s, Pf, Tf, 10);
    chron(s, 'truce', [Pf, Tf], null, fname(s, Pf) + '와(과) ' + fname(s, Tf) + '이(가) ' + weeks + '주 동안 싸움을 멈추기로 했다.', { cause: '휴전 협상', stateChanges: '교전 중지, 군대 철수, ' + dateStr(s.week + weeks) + '까지' });
    report(s, Pf, fname(s, Tf) + '와(과) ' + weeks + '주 휴전했습니다. 남의 땅에 있던 군대는 돌아옵니다.', true); report(s, Tf, fname(s, Pf) + '와(과) ' + weeks + '주 휴전했습니다.', true);
  }
  function sendAid(s, Tf, rid, ob) { // AI가 약속한 병력을 실제로 보낸다 (플레이어와 같은 출정 명령)
    const b = aidSource(s, Tf, rid, ob.kind === 'mobilize'); if (!b) return false;
    const T = s.regions[rid], n = Math.min(b.sp, Math.max(400, Math.ceil(ob.need * 1.3 / 100) * 100)), sf = pickStaff(s, Tf, b.S, false, 1), hostile = !sameBloc(s, Tf, T.controller);
    const r = issueOrder(s, Tf, 'MARCH', { fromRegionId: b.S.id, targetRegionId: rid, units: split(b.S.garrison, n), commanderId: sf.cmd ? sf.cmd.id : null, deputyIds: sf.cmd ? sf.deps.map(c => c.id) : [], stance: hostile ? '신중' : '방어', mission: hostile ? 'attack' : undefined }, { u: 1, why: '약속한 병력을 ' + T.name + '(으)로 보냄' });
    if (r.ok) ob.due = Math.max(ob.due, s.week + r.eta + 2);
    return r.ok;
  }
  function applyAid(s, Pf, Tf, terms) {
    const g = Math.min(terms.gold || 0, Math.floor(Math.max(0, s.factions[Pf].treasury))); s.factions[Pf].treasury -= g; s.factions[Tf].treasury += g;
    const R = s.regions[terms.regionId], ag = addAgreement(s, 'aid', [Pf, Tf], { regionId: R.id, gold: g }, null, [R.name + ' 원군']);
    const ob = addOb(s, ag, Tf, Pf, 'aid', s.week + 8, { regionId: R.id, need: K.aidNeed });
    chron(s, 'pact', [Pf, Tf], R.id, fname(s, Tf) + '이(가) ' + fname(s, Pf) + '의 청을 받아 ' + R.name + '(으)로 원군을 보내기로 했다.', { cause: '원군 요청', stateChanges: '원군 약속' });
    report(s, Pf, fname(s, Tf) + '이(가) ' + R.name + '(으)로 원군을 보내기로 했습니다.', true, R.id);
    if (Tf !== s.playerFactionId) sendAid(s, Tf, R.id, ob); else report(s, Tf, R.name + '(으)로 ' + ob.need + '명 이상을 ' + (ob.due - s.week) + '주 안에 보내야 합니다.', true, R.id);
  }
  function applyCall(s, Kf, Mf, terms) {
    const ag = vassalAg(s, Kf, Mf); if (!ag) return; const R = s.regions[terms.regionId];
    const ob = addOb(s, ag, Mf, Kf, 'mobilize', s.week + 8, { regionId: R.id, need: K.aidNeed });
    chron(s, 'pact', [Kf, Mf], R.id, fname(s, Mf) + '이(가) ' + fname(s, Kf) + '의 동원령을 받들어 ' + R.name + '(으)로 군사를 내기로 했다.', { cause: '동원 의무', stateChanges: '동원 약속' });
    report(s, Kf, fname(s, Mf) + '이(가) 동원령에 따릅니다.', true, R.id);
    if (Mf !== s.playerFactionId) sendAid(s, Mf, R.id, ob); else report(s, Mf, R.name + '(으)로 ' + ob.need + '명 이상을 ' + (ob.due - s.week) + '주 안에 보내야 합니다.', true, R.id);
  }
  const KINDNAME = { offer: '귀부 권유', revise: '조건 변경', pledge: '귀부 요청', marriage: '혼인 제안', passage: '통행 요청', truce: '휴전 제안', aid: '원군 요청', callarms: '동원령', gift: '예물' };
  function finalizeDeal(s, kind, f, t, terms) {
    if (kind === 'offer') applySubmission(s, f, t, terms, false); else if (kind === 'revise') applySubmission(s, f, t, terms, true);
    else if (kind === 'pledge') applySubmission(s, t, f, terms, false); else if (kind === 'marriage') applyMarriage(s, f, t);
    else if (kind === 'passage') applyPassage(s, t, f, terms); else if (kind === 'truce') applyTruce(s, f, t, terms);
    else if (kind === 'aid') applyAid(s, f, t, terms); else if (kind === 'callarms') applyCall(s, f, t, terms);
  }
  function rejectDeal(s, kind, f, t, sc) {
    if (kind === 'callarms') { // 동원 의무를 거부하면 약속 위반
      const ag = vassalAg(s, f, t); if (ag) { const ob = addOb(s, ag, t, f, 'mobilize', s.week, { regionId: (sc && sc.regionId) || s.factions[f].capitalId, need: K.aidNeed }); breach(s, ag, ob, '동원령 거부'); }
      return;
    }
    addTrust(s, f, t, -3);
    const neg = sc && sc.parts ? Object.keys(sc.parts).filter(k => sc.parts[k] < 0).map(k => k + ' ' + sc.parts[k]) : [];
    if (kind !== 'aid' && kind !== 'passage') chron(s, 'envoy', [f, t], null, fname(s, t) + '이(가) ' + fname(s, f) + '의 ' + KINDNAME[kind] + '을(를) 물리쳤다.', { cause: '협상', decision: '거절' });
    report(s, f, fname(s, t) + '이(가) ' + KINDNAME[kind] + '을(를) 거절했습니다.' + (neg.length ? ' (' + neg.join(', ') + ')' : ''), true);
  }
  // 조건을 얹어 need만큼 점수를 올린 역제안. 못 맞추면 null
  function sweeten(Kf, terms, need) {
    const t = Object.assign({}, terms), kd = FMETA[Kf].kingdom; let got = 0;
    const gold = to => () => { if (t.gold < to) { const d = to - t.gold; t.gold = to; return d / 100 * 6; } };
    const steps = [gold(100), () => { if (kd && t.office === 'none') { t.office = 'later'; return 5; } }, () => { if (t.protect === 8) { t.protect = 4; return 5; } }, () => { if (kd && t.office === 'later') { t.office = 'now'; return 3; } }, gold(200),
      () => { if (t.mobilize) { t.mobilize = false; return 8; } }, () => { if (t.autonomy !== 'full') { const g = t.autonomy === 'tribute20' ? 20 : 10; t.autonomy = 'full'; return g; } }, gold(300)];
    for (const st of steps) { if (got >= need) break; const g = st(); if (g) got += g; }
    return got >= need ? t : null;
  }
  // AI의 답. 플레이어가 받는 제안은 여기로 오지 않는다
  function decide(s, kind, f, t, terms) {
    if (kind === 'offer' || kind === 'revise') {
      const sc = kind === 'offer' ? acceptScore(s, f, t, t, terms) : reviseScore(s, f, t, terms), roll = sc.score + (rnd(s) - 0.5) * (kind === 'offer' ? 20 : 10);
      if (roll >= 0) return { res: 'accept', sc };
      if (roll >= -12) { const sw = sweeten(f, normTerms(terms, f), 2 - roll); if (sw) return { res: 'counter', sc, terms: sw }; }
      return { res: 'reject', sc };
    }
    if (kind === 'pledge') return { res: atWar(s, t, f) || trust(s, t, f) >= 10 ? 'accept' : 'reject' };
    if (kind === 'marriage') { const sc = marriageScore(s, f, t); return { res: sc.score + (rnd(s) - 0.5) * 16 >= 0 ? 'accept' : 'reject', sc }; }
    if (kind === 'passage') {
      const sc = passageScore(s, t, f, terms, true), roll = sc.score + (rnd(s) - 0.5) * 12;
      if (roll >= 0) return { res: 'accept', sc };
      if (roll >= -20) { const g = Math.min(300, (terms.gold || 0) + Math.ceil((2 - roll) / 10 * 100 / 50) * 50); if (g > (terms.gold || 0) && (g - (terms.gold || 0)) / 100 * 10 >= -roll) return { res: 'counter', sc, terms: Object.assign({}, terms, { gold: g }) }; }
      return { res: 'reject', sc };
    }
    if (kind === 'truce') { const sc = truceScore(s, t, f, terms, true); return { res: sc.score + (rnd(s) - 0.5) * 16 >= 0 ? 'accept' : 'reject', sc }; }
    if (kind === 'aid') { const sc = aidScore(s, t, f, terms, true); if (!sc.feasible) return { res: 'excuse', sc }; return { res: sc.score + (rnd(s) - 0.5) * 12 >= 0 ? 'accept' : 'reject', sc }; }
    if (kind === 'callarms') { if (trust(s, t, f) < 30) return { res: 'reject', sc: { regionId: terms.regionId } }; return { res: aidSource(s, t, terms.regionId, true) ? 'accept' : 'excuse' }; }
    return { res: 'reject' };
  }
  function propText(s, pr) {
    const F = fname(s, pr.from), k = pr.kind === 'counter' ? pr.base : pr.kind, R = pr.terms && pr.terms.regionId ? s.regions[pr.terms.regionId].name : '';
    if (pr.kind === 'counter') return jo(F + '이(가) ' + KINDNAME[k] + '에 조건을 바꿔 되물어 왔습니다.');
    return jo({ offer: F + '의 사신이 귀부를 권합니다.', revise: F + '이(가) 섬기는 조건을 고치자고 합니다.', pledge: F + '이(가) 우리에게 귀부를 청합니다.', marriage: F + ' 왕실이 혼인을 청합니다.', passage: F + '이(가) 우리 땅을 지나가게 해 달라고 합니다.', truce: F + '이(가) 휴전을 청합니다.', aid: F + '이(가) ' + R + '(으)로 원군을 청합니다.', callarms: '종주 ' + F + '이(가) 동원령을 내렸습니다: ' + R + '(으)로 군사를 내라고 합니다.' }[k]);
  }
  function resolveEnvoy(s, o) {
    const f = o.actorId, t = o.params.targetFactionId, kind = o.params.kind, terms = o.params.terms || {};
    if (!s.factions[f].alive || !s.factions[t].alive) { o.status = 'failed'; return; }
    if (kind === 'gift') {
      addTrust(s, f, t, K.giftTrust); o.result = 'done';
      report(s, f, fname(s, t) + '에 예물이 닿았습니다. 신뢰가 올랐습니다.', false); report(s, t, fname(s, f) + '이(가) 예물을 보냈습니다.', false);
      return;
    }
    // 사신이 가는 동안 상황이 바뀌었으면 무효
    if ((kind === 'offer' && s.factions[t].overlord === f) || (kind === 'pledge' && s.factions[f].overlord === t) || (kind === 'revise' && !vassalAg(s, f, t)) || (kind === 'callarms' && !vassalAg(s, f, t)) || (kind === 'truce' && !atWar(s, f, t)) || (kind === 'marriage' && s.ties[tk(f, t)]) || ((kind === 'passage' || kind === 'aid' || kind === 'marriage') && atWar(s, f, t))) { o.result = 'moot'; report(s, f, fname(s, t) + '(으)로 간 사신이 헛걸음했습니다. 그 사이 사정이 바뀌었습니다.', false); return; }
    if (t === s.playerFactionId) { // 플레이어가 답해야 한다
      const pr = { id: s.nextId++, from: f, to: t, kind, terms, week: s.week, expires: s.week + K.proposalWeeks, status: 'pending' };
      s.proposals.push(pr); o.result = 'pending'; report(s, t, propText(s, pr), true); return;
    }
    const d = decide(s, kind, f, t, terms); o.result = d.res; o.score = d.sc && d.sc.score;
    if (d.res === 'accept') finalizeDeal(s, kind, f, t, terms);
    else if (d.res === 'excuse') report(s, f, fname(s, t) + '이(가) 뜻은 있으나 보낼 병력이나 길이 없다고 답했습니다.', true);
    else if (d.res === 'counter') {
      if (f === s.playerFactionId) { const pr = { id: s.nextId++, from: t, to: f, kind: 'counter', base: kind, terms: d.terms, asked: terms, week: s.week, expires: s.week + K.proposalWeeks, status: 'pending' }; s.proposals.push(pr); report(s, f, propText(s, pr), true); }
      else if ((d.terms.gold || 0) + (AIP[f].kingdom ? 150 : 40) <= s.factions[f].treasury) { s.log.push({ week: s.week, faction: f, type: 'COUNTER', params: { targetFactionId: t, kind, terms: d.terms }, ok: true, reason: null, u: 1, why: fname(s, t) + '의 역제안 수락' }); finalizeDeal(s, kind, f, t, d.terms); o.result = 'accepted'; }
      else rejectDeal(s, kind, f, t, d.sc);
    } else rejectDeal(s, kind, f, t, d.sc);
  }
  function resolveProposal(s, pr, accept) {
    pr.status = accept ? 'accepted' : 'rejected';
    const kind = pr.kind === 'counter' ? pr.base : pr.kind, f = pr.kind === 'counter' ? pr.to : pr.from, t = pr.kind === 'counter' ? pr.from : pr.to;
    if (accept) finalizeDeal(s, kind, f, t, pr.terms);
    else if (pr.kind === 'counter') { addTrust(s, f, t, -2); report(s, f, fname(s, t) + '의 역제안을 물리쳤습니다. 협상은 깨졌습니다.', false); }
    else rejectDeal(s, kind, f, t, kind === 'callarms' ? { regionId: pr.terms.regionId } : null);
  }
  function probeFresh(s, f, t) { const e = s.intel[f].factions[t]; return !!(e && s.week - e.week <= K.probeFresh); }
  // 협상 화면이 쓰는 전망. 우리가 아는 것만으로 계산하고, 모르는 항목은 unknown에 담는다
  function negoPreview(s, f, t, kind, terms) {
    const v = validate(s, f, 'ENVOY', { targetFactionId: t, kind, terms }); if (!v.ok) return v;
    const know = probeFresh(s, f, t); let sc = null, note = '';
    if (v.kind === 'offer') sc = acceptScore(s, f, t, know ? t : f, v.terms); else if (v.kind === 'revise') sc = reviseScore(s, f, t, v.terms);
    else if (v.kind === 'marriage') sc = marriageScore(s, f, t); else if (v.kind === 'passage') sc = passageScore(s, t, f, v.terms, know);
    else if (v.kind === 'truce') sc = truceScore(s, t, f, v.terms, know); else if (v.kind === 'aid') { sc = aidScore(s, t, f, v.terms, know); if (!sc.feasible) note = '보낼 병력이나 길이 없어 보입니다.'; }
    else if (v.kind === 'pledge') note = atWar(s, t, f) || trust(s, t, f) >= 10 ? '받아들일 것으로 보입니다.' : '믿음이 너무 낮아 물리칠 것으로 보입니다.';
    else if (v.kind === 'gift') note = '신뢰가 ' + K.giftTrust + ' 오릅니다.';
    return { ok: true, kind: v.kind, cost: v.cost, terms: v.terms, score: sc ? sc.score : null, parts: sc ? sc.parts : null, unknown: (sc && sc.unknown) || [], label: sc ? (sc.score >= 10 ? '유리' : sc.score >= -10 ? '접전' : '불리') : null, probed: know, note };
  }

  // ── 인사·조정 ──
  function lordOf(s, R) { const L = R.lord && s.characters[R.lord]; return L && L.status === 'active' && L.loc === R.id && !L.armyId && L.faction === R.controller ? L : null; }
  function defiant(s, R) { const L = lordOf(s, R); return !!(L && L.id !== s.factions[R.controller].rulerId && L.loyalty < 30); }
  function defect(s, c) {
    const from = c.faction, dest = FIDS.find(k => FMETA[k].kingdom && k !== from && s.factions[k].alive && atWar(s, from, k));
    for (const a of armyList(s)) { if (a.commanderId === c.id) a.commanderId = null; if (a.deputyIds) a.deputyIds = a.deputyIds.filter(x => x !== c.id); }
    for (const R of regs(s)) if (R.lord === c.id) { R.lord = null; R.morale = Math.max(0, R.morale - 8); }
    if (s.factions[from].heir === c.id) s.factions[from].heir = null;
    c.armyId = null; c.merit = 0; c.wait = 0; c.office = 0;
    if (dest) { c.faction = dest; c.loc = s.factions[dest].capitalId; c.loyalty = 60; chron(s, 'defect', [from, dest], null, c.name + '이(가) ' + fname(s, from) + '을(를) 버리고 ' + fname(s, dest) + '(으)로 넘어갔다.', { cause: '충성 붕괴', stateChanges: '인물 이탈' }); report(s, dest, fname(s, from) + '의 ' + c.name + '이(가) 우리에게 넘어왔습니다.', true); }
    else { c.status = 'retired'; chron(s, 'defect', [from], null, c.name + '이(가) ' + fname(s, from) + '을(를) 떠나 자취를 감췄다.', { cause: '충성 붕괴', stateChanges: '인물 이탈' }); }
    report(s, from, c.name + '이(가) 우리를 떠났습니다.', true);
  }
  function stepPeople(s) {
    for (const id in s.characters) {
      const c = s.characters[id], F = s.factions[c.faction];
      if (c.status !== 'active' || !F.alive || F.rulerId === id) continue;
      if ((c.merit || 0) >= 15) { c.wait = (c.wait || 0) + 1; if (c.wait === 7) report(s, c.faction, '공을 세운 ' + c.name + '이(가) 포상을 기다리다 불만을 품기 시작했습니다.', true); if (c.wait > 6) c.loyalty = Math.max(0, c.loyalty - 1); } else c.wait = 0;
      if (F.unpaid > 0) c.loyalty = Math.max(0, c.loyalty - 1);
      if (c.loyalty < 30 && !c.warned) { c.warned = true; report(s, c.faction, c.name + '의 충성이 위태롭습니다(' + c.loyalty + '). 성주라면 군령을 따르지 않습니다.', true); } else if (c.loyalty >= 35) c.warned = false;
      if (c.loyalty < 25 && c.ambition >= 60 && rnd(s) < K.defectChance) defect(s, c);
    }
  }
  function heirEffects(s, f, id) { // 후계 지명이 다른 인물의 충성에 주는 영향 (미리보기와 실행이 같은 계산)
    const cands = HEIRS[f] || [], out = {}, ally = x => KIN.some(k => (k[2] === '형제 동맹' || k[2] === '지지') && ((k[0] === x && k[1] === id) || (k[1] === x && k[0] === id)));
    for (const x in s.characters) { const c = s.characters[x]; if (c.faction !== f || c.status !== 'active' || x === s.factions[f].rulerId) continue;
      if (x === id) out[x] = 20; else if (ally(x)) out[x] = 8; else if (cands.indexOf(x) >= 0) out[x] = -Math.round(c.ambition / 4);
      else if (KIN.some(k => k[2] === '지지' && k[0] === x && cands.indexOf(k[1]) >= 0 && k[1] !== id)) out[x] = -10; }
    return { changes: out, legitimacy: cands[0] === id ? 3 : -3 };
  }

  // ───────────────────────── 전투 (R2) ─────────────────────────
  // 병종 효율: 지형·공수에 따라 달라진다. 편성 화면과 전투 계산이 같은 함수를 쓴다.
  function unitEff(k, terrain, isDef, fort) {
    let m = 1;
    if (k === 'light') m = terrain === '산악' ? 1.15 : terrain === '구릉' ? 1.05 : 1;
    else if (k === 'heavy') m = isDef ? 1.10 : 1;
    else if (k === 'archer') m = isDef ? 1.15 : 1;
    else if (k === 'cav') { m = terrain === '산악' ? 0.65 : terrain === '구릉' ? 0.9 : terrain === '평지' ? 1.15 : 1; if (!isDef && fort > 0) m *= 1 - 0.06 * fort; }
    return m;
  }
  function basePower(u, terrain, isDef, fort) { let p = 0; for (const k of UNITS) p += u[k] * UNIT[k].power * unitEff(k, terrain, isDef, fort || 0); return p; }
  function lossWeight(k, isDef, fort) { return k === 'archer' && isDef && fort > 0 ? 0.85 : UNIT[k].def; }
  const STANCE = {
    공세: { atk: 1.10, def: 1.10, loss: 1.15, retreat: 25, ambush: 0.10 },
    신중: { atk: 1.00, def: 1.00, loss: 1.00, retreat: 35, ambush: -0.10 },
    방어: { atk: 0.90, def: 1.12, loss: 0.90, retreat: 30, ambush: 0 },
    지연: { atk: 0.85, def: 0.85, loss: 0.70, retreat: 45, ambush: -0.05 },
  };
  const stanceOf = a => STANCE[a.stance] ? a.stance : '신중';
  const cmdF = c => clamp(1 + 0.004 * ((c ? c.ld : 50) - 50), 0.8, 1.2);
  const marF = c => 1 + 0.001 * ((c ? c.ma : 50) - 50);
  // 지휘부: 주장 통솔, 부장까지 포함한 최고 무력(선봉)·최고 지략(참모)
  function staff(cmd, deps) {
    const all = (cmd ? [cmd] : []).concat(deps || []);
    const ma = all.length ? Math.max.apply(null, all.map(c => c.ma)) : 50, st = all.length ? Math.max.apply(null, all.map(c => c.st)) : 50;
    return { cmd: cmd || null, deps: deps || [], ld: cmd ? cmd.ld : 50, ma, st, maBy: all.find(c => c.ma === ma) || null, stBy: all.find(c => c.st === st) || null };
  }
  function mixPenalty(u, ld, nDep) {
    const t = total(u); if (!t) return 0;
    let types = 0; for (const k of UNITS) if (u[k] >= 0.1 * t) types++;
    return 0.025 * Math.max(0, types - 1) * clamp((80 - ld) / 30, 0, 1) * (1 - 0.4 * Math.min(2, nDep));
  }
  // 한 주 교전의 순수 계산. 실제 전투와 편성 화면의 예상이 같은 식을 쓴다.
  // side = { units, morale, starving, staff, sP(방침 전력), sL(방침 손실) }
  function roundMath(A, D, ctx, rA, rD) {
    const pa = mixPenalty(A.units, A.staff.ld, A.staff.deps.length), pd = mixPenalty(D.units, D.staff.ld, D.staff.deps.length);
    const fa = { 지휘: cmdF(A.staff) * (1 - pa), 무력: marF(A.staff), 사기: 0.7 + 0.3 * A.morale / 100, 보급: A.starving ? 0.8 : 1, 작전: A.sP, 지형: 1 };
    const fd = { 지휘: cmdF(D.staff) * (1 - pd), 무력: marF(D.staff), 사기: 0.7 + 0.3 * D.morale / 100, 보급: D.starving ? 0.8 : 1, 작전: D.sP, 지형: 1 + ctx.fort * K.fortDef + K.terrDef[ctx.terrain] };
    const sd = clamp(A.staff.st - D.staff.st, -30, 30) * 0.002;
    fa.지략 = 1 + Math.max(0, sd); fd.지략 = 1 + Math.max(0, -sd);
    fa.운 = 0.92 + rA * 0.16; fd.운 = 0.92 + rD * 0.16;
    const mul = o => Object.keys(o).reduce((p, k) => p * o[k], 1);
    const ba = basePower(A.units, ctx.terrain, false, ctx.fort), bd = basePower(D.units, ctx.terrain, true, ctx.fort);
    const PA = Math.max(1, ba * mul(fa)), PD = Math.max(1, bd * mul(fd));
    const sc = ctx.fort > 0 ? K.siegeScale : 1;
    const lossA = Math.min(0.5, (PA >= PD ? K.winnerBase : K.loserBase) * Math.pow(PD / PA, K.ratioExp) * sc * A.sL);
    const lossD = Math.min(0.5, (PD > PA ? K.winnerBase : K.loserBase) * Math.pow(PA / PD, K.ratioExp) * sc * D.sL);
    return { fa, fd, pa, pd, sd, ba, bd, PA, PD, lossA, lossD, winner: PA >= PD ? 'atk' : 'def' };
  }
  // 손실을 병종 방어력에 따라 나눈다: rate_k = L × T × w_k / Σ n_j w_j
  function lossRates(u, L, isDef, fort) {
    const t = total(u); let w = 0; for (const k of UNITS) w += u[k] * lossWeight(k, isDef, fort);
    const r = zero(); if (!t || !w) return r;
    for (const k of UNITS) r[k] = Math.min(1, L * t * lossWeight(k, isDef, fort) / w);
    return r;
  }
  function applyRates(u, r) { const lost = zero(); for (const k of UNITS) { const n = Math.min(u[k], Math.round(u[k] * r[k])); u[k] -= n; lost[k] = n; } return lost; }
  function chars(s, ids) { return (ids || []).map(id => s.characters[id]).filter(c => c && c.status === 'active'); }
  function sideOf(s, R, armies, isDef) {
    const units = zero(); let mw = 0, w = 0, starving = false, sp = 0, sl = 0;
    const off = [];
    if (isDef) {
      addU(units, R.garrison); const g = total(R.garrison); mw += R.gMorale * g; w += g; sp += g * 1; sl += g * 1; if (R.starve > 0 && g > 0) starving = true;
      for (const id in s.characters) { const c = s.characters[id]; if (c.loc === R.id && !c.armyId && c.status === 'active' && sameBloc(s, c.faction, R.controller)) off.push(c); }
    }
    for (const a of armies) {
      addU(units, a.units); const t = total(a.units), S = STANCE[stanceOf(a)];
      mw += a.morale * t; w += t; sp += t * (isDef ? S.def : S.atk); sl += t * S.loss; if (a.starve > 0) starving = true;
      for (const c of chars(s, [a.commanderId].concat(a.deputyIds || []))) off.push(c);
    }
    off.sort((x, y) => y.ld - x.ld || (x.id < y.id ? -1 : 1));
    return { units, total: w, morale: w ? mw / w : 0, starving, staff: staff(off[0] || null, off.slice(1, 3)), officers: off, sP: w ? sp / w : 1, sL: w ? sl / w : 1 };
  }
  const pct = v => (v >= 1 ? '+' : '−') + Math.abs(Math.round((v - 1) * 100)) + '%';
  function explain(m, A, D, R) {
    const why = [];
    why.push('수비 이점: 성 방어 ' + R.fort + '단계·' + R.terrain + ' ' + pct(m.fd.지형));
    why.push(A.staff.cmd ? '공격 주장 ' + A.staff.cmd.name + '(통솔 ' + A.staff.ld + ') ' + pct(cmdF(A.staff)) : '공격측 주장 없음(통솔 50)');
    why.push(D.staff.cmd ? '수비 주장 ' + D.staff.cmd.name + '(통솔 ' + D.staff.ld + ') ' + pct(cmdF(D.staff)) : '수비측 주장 없음(통솔 50)');
    if (m.pa > 0.001) why.push('공격측 다병종 지휘 부담 −' + Math.round(m.pa * 100) + '%' + (A.staff.deps.length ? ' (부장 ' + A.staff.deps.length + '명이 덜어 줌)' : ''));
    if (m.pd > 0.001) why.push('수비측 다병종 지휘 부담 −' + Math.round(m.pd * 100) + '%');
    if (A.staff.maBy && A.staff.ma !== 50) why.push('공격 선봉 ' + A.staff.maBy.name + '(무력 ' + A.staff.ma + ') ' + pct(m.fa.무력));
    if (D.staff.maBy && D.staff.ma !== 50) why.push('수비 선봉 ' + D.staff.maBy.name + '(무력 ' + D.staff.ma + ') ' + pct(m.fd.무력));
    if (m.sd !== 0) why.push('지략 우위: ' + (m.sd > 0 ? '공격측 ' + (A.staff.stBy ? A.staff.stBy.name : '') + ' ' + pct(m.fa.지략) : '수비측 ' + (D.staff.stBy ? D.staff.stBy.name : '') + ' ' + pct(m.fd.지략)));
    if (A.starving) why.push('공격측 군량 부족 −20%'); if (D.starving) why.push('수비측 군량 부족 −20%');
    if (Math.abs(A.sP - 1) > 0.001) why.push('공격측 작전 방침 ' + pct(A.sP) + ', 손실 ' + pct(A.sL));
    if (Math.abs(D.sP - 1) > 0.001) why.push('수비측 작전 방침 ' + pct(D.sP));
    if (A.units.cav && R.fort > 0) why.push('기병은 성벽 앞에서 힘을 못 씀: 기병 효율 ' + pct(unitEff('cav', R.terrain, false, R.fort)));
    why.push('운: 공격 ' + pct(m.fa.운) + ' · 수비 ' + pct(m.fd.운));
    return why;
  }
  function resolveRound(s, R, atk, def) {
    const seed = s.rng, A = sideOf(s, R, atk, false), D = sideOf(s, R, def, true);
    const m = roundMath(A, D, { terrain: R.terrain, fort: R.fort }, rnd(s), rnd(s));
    const ra = lossRates(A.units, m.lossA, false, R.fort), rd = lossRates(D.units, m.lossD, true, R.fort);
    const lostA = zero(), lostD = zero();
    for (const a of atk) { addU(lostA, applyRates(a.units, ra)); a.morale = clamp(a.morale + (m.winner === 'atk' ? 3 : -8), 0, 100); }
    addU(lostD, applyRates(R.garrison, rd)); R.gMorale = clamp(R.gMorale + (m.winner === 'def' ? 3 : -8), 0, 100);
    for (const a of def) { addU(lostD, applyRates(a.units, rd)); a.morale = clamp(a.morale + (m.winner === 'def' ? 3 : -6), 0, 100); }
    const afterA = atk.reduce((t, a) => t + total(a.units), 0), afterD = total(R.garrison) + def.reduce((t, a) => t + total(a.units), 0);
    const side = (X, mm, f, base, P, lost, after, facs) => ({ factions: facs, before: X.total, after, units: Object.assign({}, X.units), lost, base: Math.round(base), power: Math.round(P), cmd: X.staff.cmd ? X.staff.cmd.name : null, deps: X.staff.deps.map(c => c.name), ld: X.staff.ld, ma: X.staff.ma, st: X.staff.st, f, morale: Math.round(X.morale) });
    const rep = {
      id: s.nextId++, week: s.week, regionId: R.id, seed, terrain: R.terrain, fort: R.fort,
      atk: side(A, m, m.fa, m.ba, m.PA, lostA, afterA, uniq(atk.map(a => a.factionId))),
      def: side(D, m, m.fd, m.bd, m.PD, lostD, afterD, uniq([R.controller].concat(def.map(a => a.factionId)))),
      winner: m.winner, captured: false, rationale: explain(m, A, D, R), events: [],
    };
    s.battles.push(rep); if (s.battles.length > 240) s.battles.shift();
    return { rep, A, D, afterA, afterD };
  }
  const uniq = a => a.filter((x, i) => a.indexOf(x) === i);

  // 매복: 새로 도착한 공격군에 대해 수비측 참모와 지략을 겨룬다. 정찰·신중 방침이 막는다.
  function ambushChance(aSt, dSt, terrain, stance, scouted, cavShare) {
    return clamp(0.08 + (dSt - aSt) * 0.008 + (terrain === '산악' ? 0.15 : terrain === '구릉' ? 0.06 : 0) + STANCE[stance].ambush - (scouted ? 0.15 : 0) - (cavShare > 0.2 ? 0.03 : 0), 0.02, 0.55);
  }
  function scoutedRecently(s, f, rid) { const e = s.intel[f].regions[rid]; return !!(e && e.conf === 'confirmed' && s.week - e.week <= 2 && (e.scout || shares(s, f, s.regions[rid].controller) || ADJ[rid].some(n => shares(s, f, s.regions[n.to].controller)))); }
  function tryAmbush(s, R, a, D, eng) {
    a.ambushChecked = true;
    if (D.total < 200) return null;
    const A = staff(chars(s, [a.commanderId])[0] || null, chars(s, a.deputyIds));
    const scouted = scoutedRecently(s, a.factionId, R.id), t = total(a.units);
    const p = ambushChance(A.st, D.staff.st, R.terrain, stanceOf(a), scouted, t ? a.units.cav / t : 0);
    const ok = rnd(s) < p;
    const ev = { type: 'ambush', week: s.week, faction: a.factionId, chance: Math.round(p * 100), ok, by: D.staff.stBy ? D.staff.stBy.name + '(지략 ' + D.staff.st + ')' : '수비군', vs: A.stBy ? A.stBy.name + '(지략 ' + A.st + ')' : '지략 50', scouted, lost: null };
    if (ok) { ev.lost = applyRates(a.units, lossRates(a.units, 0.08, false, 0)); a.morale = clamp(a.morale - 12, 0, 100); }
    if (eng) eng.events.push(ev);
    if (ok) { report(s, a.factionId, R.name + ' 앞에서 매복에 걸렸습니다. ' + total(ev.lost) + '명을 잃었습니다.', true, R.id); report(s, R.controller, R.name + ' 매복 성공: 적 ' + total(ev.lost) + '명을 쳤습니다.', false, R.id); }
    return ev;
  }
  // 퇴각: 쫓는 쪽 기병과 물러나는 쪽 지략·기병·방침이 손실을 정한다
  function pursuitRate(pursuerCav, retTotal, retSt, retCavShare, stance) {
    return clamp(0.02 + 0.5 * pursuerCav / Math.max(1, retTotal), 0, 0.25) * (1 - clamp((retSt - 50) / 100, -0.3, 0.4)) * (retCavShare > 0.25 ? 0.8 : 1) * (stance === '지연' ? 0.7 : 1);
  }
  function officerFate(s, c, captor, risk, eng, regionId) {
    const F = s.factions[c.faction];
    if (F.rulerId === c.id) { // 군주는 호위를 받아 빠져나가지만 위신이 깎인다
      F.legitimacy = Math.max(0, F.legitimacy - 8);
      if (eng) eng.events.push({ type: 'escape', name: c.name, note: '군주가 간신히 빠져나감 (정통성 −8)' }); return 'escape';
    }
    const esc = clamp(1 - risk + (c.ma + c.st - 120) / 300, 0.05, 0.98);
    if (rnd(s) < esc) return 'escape';
    c.status = 'captive'; c.captor = captor; c.armyId = null; c.loc = s.factions[captor].capitalId;
    if (eng) eng.events.push({ type: 'captured', name: c.name, faction: c.faction, captor });
    chron(s, 'captured', [captor, c.faction], regionId, c.name + '이(가) ' + fname(s, captor) + '군에 사로잡혔다.');
    report(s, c.faction, c.name + '이(가) 사로잡혔습니다.', true, regionId); report(s, captor, fname(s, c.faction) + '의 ' + c.name + '을(를) 사로잡았습니다.', true, regionId);
    return 'captured';
  }
  function armyOfficers(s, a) { return chars(s, [a.commanderId].concat(a.deputyIds || [])); }
  function retreatArmy(s, R, a, pursuers, eng, why) {
    const t = total(a.units), st = staff(chars(s, [a.commanderId])[0] || null, chars(s, a.deputyIds)).st;
    const pcav = pursuers.reduce((x, u) => x + u.cav, 0);
    const rate = pursuitRate(pcav, t, st, t ? a.units.cav / t : 0, stanceOf(a));
    const lost = applyRates(a.units, lossRates(a.units, rate, false, 0));
    const ev = { type: 'pursuit', week: s.week, faction: a.factionId, rate: Math.round(rate * 100), lost, pursuerCav: pcav, st };
    if (eng) { eng.events.push(ev); eng.retreats++; addU(eng.lost[eng.attackers.indexOf(a.factionId) >= 0 ? 'atk' : 'def'], lost); }
    for (const c of armyOfficers(s, a)) if (officerFate(s, c, R.controller, 0.03 + rate / 2, eng, R.id) === 'captured') { if (a.commanderId === c.id) a.commanderId = null; a.deputyIds = (a.deputyIds || []).filter(x => x !== c.id); }
    chron(s, 'retreat', [a.factionId, R.controller], R.id, fname(s, a.factionId) + '군이 ' + R.name + ' 공략에 실패해 물러났다. 추격으로 ' + total(lost) + '명을 더 잃었다.', { cause: why, decision: '퇴각' });
    report(s, a.factionId, R.name + ' 공격군이 퇴각합니다. 추격으로 ' + total(lost) + '명을 잃었습니다.', true, R.id);
    if (total(a.units) < 50) { removeArmy(s, a); return; }
    sendHome(s, a);
  }
  function routArmy(s, R, a, captor, eng) {
    for (const c of armyOfficers(s, a)) officerFate(s, c, captor, 0.5, eng, R.id);
    if (eng) { eng.events.push({ type: 'rout', faction: a.factionId }); eng.routs++; }
    chron(s, 'rout', [a.factionId], R.id, R.name + '에서 ' + fname(s, a.factionId) + '군이 무너져 흩어졌다.');
    report(s, a.factionId, R.name + '의 우리 부대가 궤멸했습니다.', true, R.id);
    removeArmy(s, a);
  }

  // 교전 기록: 포위가 시작될 때 열고, 끝날 때 결과를 적는다 (S07 전투 결과 화면의 원본)
  function openEngagement(s, R, atk, def) {
    const e = { id: s.nextId++, regionId: R.id, start: s.week, end: null, attackers: uniq(atk.map(a => a.factionId)), defenders: uniq([R.controller].concat(def.map(a => a.factionId))),
      controllerBefore: R.controller, rounds: 0, battleIds: [], events: [], lost: { atk: zero(), def: zero() }, peak: { atk: 0, def: 0 }, officers: { atk: [], def: [] }, retreats: 0, routs: 0, outcome: null, merit: [], changes: [] };
    s.engagements.push(e); if (s.engagements.length > 80) s.engagements.shift();
    R.siege.engId = e.id; return e;
  }
  const engById = (s, id) => s.engagements.find(e => e.id === id);
  function noteOfficers(e, key, X) { for (const c of X.officers) if (e.officers[key].indexOf(c.id) < 0) e.officers[key].push(c.id); }
  function closeEngagement(s, e, outcome) {
    if (!e || e.end !== null) return;
    e.end = s.week; e.outcome = outcome;
    const award = (ids, d, why) => { ids.forEach((id, i) => { const c = s.characters[id]; if (!c || c.status === 'captive' && d > 0) return; const v = i === 0 ? d : Math.round(d / 2); c.merit = (c.merit || 0) + v; e.merit.push({ id, name: c.name, faction: c.faction, d: v, why }); }); };
    const R = s.regions[e.regionId];
    if (outcome === 'capture') { award(e.officers.atk, 20, R.name + ' 함락'); award(e.officers.def, -5, R.name + ' 상실'); e.changes.push(R.name + ' 지배: ' + fname(s, e.controllerBefore) + ' → ' + fname(s, R.controller)); }
    else if (outcome === 'repulsed' || outcome === 'rout') { award(e.officers.def, 15, R.name + ' 방어'); award(e.officers.atk, outcome === 'rout' ? -10 : -3, R.name + ' 공략 실패'); e.changes.push(R.name + '은(는) ' + fname(s, R.controller) + '의 손에 남았다'); }
    for (const ev of e.events) if (ev.type === 'captured') e.changes.push(ev.name + ' 포로 (' + fname(s, ev.captor) + ')');
    s.pendingResults.push(e.id);
  }

  function stepBattles(s) {
    const captures = [];
    for (const R of regs(s)) {
      const here = armyList(s).filter(a => !a.leg && a.loc === R.id);
      const atk = here.filter(a => atWar(s, a.factionId, R.controller));
      if (!atk.length) {
        if (R.siege) { const e = engById(s, R.siege.engId); closeEngagement(s, e, e && e.routs && !e.retreats ? 'rout' : e && (e.retreats || e.routs) ? 'repulsed' : 'lifted'); R.siege = null; }
        continue;
      }
      for (const a of atk) { a.path = []; a.mission = 'attack'; a.target = R.id; }
      const def = here.filter(a => !atWar(s, a.factionId, R.controller) && sameBloc(s, a.factionId, R.controller));
      for (const d of def) for (const a of atk) joinWar(s, d.factionId, a.factionId);
      const lead = atk.slice().sort((x, y) => total(y.units) - total(x.units))[0];
      const defTotal = total(R.garrison) + def.reduce((t, a) => t + total(a.units), 0);
      if (!R.siege) {
        R.siege = { start: s.week, by: lead.factionId, rounds: 0, init: defTotal, relief: false, breached: false, engId: null };
        openEngagement(s, R, atk, def);
        chron(s, 'siege', [lead.factionId, R.controller], R.id, fname(s, lead.factionId) + '군이 ' + R.name + '을(를) 에워쌌다.', { cause: '출정 도착', decision: '포위' });
        report(s, R.controller, R.name + '이(가) 포위되었습니다.', true, R.id);
        const o = s.factions[R.controller].overlord; if (o) report(s, o, '우리를 섬기는 ' + fname(s, R.controller) + '의 ' + R.name + '이(가) 포위되었습니다. ' + K.protectWeeks + '주 안에 구원해야 합니다.', true, R.id);
      }
      const e = engById(s, R.siege.engId);
      if (e) { for (const a of atk) if (e.attackers.indexOf(a.factionId) < 0) e.attackers.push(a.factionId); for (const a of def) if (e.defenders.indexOf(a.factionId) < 0) e.defenders.push(a.factionId); }
      R.siege.init = Math.max(R.siege.init, defTotal);
      if (def.some(d => d.factionId !== R.controller)) R.siege.relief = true;
      if (defTotal < 50) { captures.push({ R, lead, def, rep: null }); continue; }
      // 새로 도착한 공격군은 매복 판정을 먼저 받는다
      const D0 = sideOf(s, R, def, true);
      for (const a of atk) if (!a.ambushChecked) { tryAmbush(s, R, a, D0, e); if (e && e.events.length) { const ev = e.events[e.events.length - 1]; if (ev.type === 'ambush' && ev.ok) addU(e.lost.atk, ev.lost); } }
      const out = resolveRound(s, R, atk, def); R.siege.rounds++;
      if (e) {
        e.rounds++; e.battleIds.push(out.rep.id); addU(e.lost.atk, out.rep.atk.lost); addU(e.lost.def, out.rep.def.lost);
        e.peak.atk = Math.max(e.peak.atk, out.rep.atk.before); e.peak.def = Math.max(e.peak.def, out.rep.def.before);
        noteOfficers(e, 'atk', out.A); noteOfficers(e, 'def', out.D);
        const amb = e.events.filter(v => v.type === 'ambush' && v.week === s.week); if (amb.length) out.rep.events = amb;
      }
      for (const f of uniq(out.rep.atk.factions.concat(out.rep.def.factions))) report(s, f, R.name + ' 전투: ' + (out.rep.winner === 'atk' ? '공격측' : '수비측') + ' 우세. 공격 ' + out.rep.atk.before + '→' + out.rep.atk.after + ', 수비 ' + out.rep.def.before + '→' + out.rep.def.after, false, R.id);
      const fall = out.afterD < Math.max(100, 0.12 * R.siege.init) || (R.siege.rounds >= R.fort && out.D.morale <= 20 && out.rep.winner === 'atk');
      if (fall) { out.rep.captured = true; captures.push({ R, lead, def, rep: out.rep }); continue; }
      const pursuers = [R.garrison].concat(def.map(d => d.units));
      for (const a of atk) {
        const t = total(a.units);
        if (t < 50) { routArmy(s, R, a, R.controller, e); continue; }
        if (a.morale <= STANCE[stanceOf(a)].retreat || t < 0.35 * a.startSize) retreatArmy(s, R, a, pursuers, e, a.morale <= STANCE[stanceOf(a)].retreat ? '사기 저하(' + Math.round(a.morale) + ')' : '병력 손실');
      }
    }
    return captures;
  }

  function stepControl(s, captures) {
    for (const c of captures) {
      const R = c.R, lead = c.lead, old = R.controller, nf = lead.factionId;
      if (!s.armies[lead.id]) continue;
      const e = R.siege ? engById(s, R.siege.engId) : null;
      const winners = armyList(s).filter(a => !a.leg && a.loc === R.id && atWar(s, a.factionId, old));
      const pcav = winners.reduce((x, a) => x + a.units.cav, 0);
      if (e) { addU(e.lost.def, R.garrison); for (const a of winners) noteOfficers(e, 'atk', { officers: armyOfficers(s, a) }); }
      for (const d of c.def) { // 남은 수비 부대는 추격을 받으며 물러난다
        if (!s.armies[d.id]) continue;
        const dt = total(d.units), st = staff(chars(s, [d.commanderId])[0] || null, chars(s, d.deputyIds)).st;
        const rate = Math.min(0.5, 0.1 + pursuitRate(pcav, dt, st, dt ? d.units.cav / dt : 0, stanceOf(d)));
        const lost = applyRates(d.units, lossRates(d.units, rate, false, 0)); if (e) { addU(e.lost.def, lost); e.events.push({ type: 'pursuit', week: s.week, faction: d.factionId, rate: Math.round(rate * 100), lost, pursuerCav: pcav, st }); }
        for (const o of armyOfficers(s, d)) if (officerFate(s, o, nf, 0.1 + rate / 2, e, R.id) === 'captured') { if (d.commanderId === o.id) d.commanderId = null; d.deputyIds = (d.deputyIds || []).filter(x => x !== o.id); }
        if (total(d.units) < 50 || !sendHome(s, d)) removeArmy(s, d);
      }
      for (const id in s.characters) {
        const ch = s.characters[id];
        if (ch.loc !== R.id || ch.armyId || ch.status !== 'active' || !sameBloc(s, ch.faction, old) || sameBloc(s, ch.faction, nf)) continue;
        if (officerFate(s, ch, nf, 0.4, e, R.id) !== 'escape') continue;
        const F = s.factions[ch.faction], dest = F.capitalId !== R.id && s.regions[F.capitalId].controller === ch.faction ? F.capitalId : (regs(s).find(r => r.id !== R.id && r.controller === ch.faction) || {}).id;
        if (dest) ch.loc = dest; else { ch.status = 'captive'; ch.captor = nf; ch.loc = s.factions[nf].capitalId; }
      }
      for (const o of s.orders) if (o.status === 'active' && o.actorId === old && o.params.regionId === R.id && (o.type === 'RECRUIT' || o.type === 'FORTIFY' || o.type === 'REQUISITION')) o.status = 'failed';
      const loot = R.grain * 0.3; lead.supply += loot; R.grain -= loot;
      R.controller = nf; R.overlord = head(s, nf); R.lord = null; R.autonomy = 20; R.morale = Math.max(10, R.morale - 20);
      R.garrison = zero(); R.gMorale = 60; R.siege = null; R.starve = 0;
      chron(s, 'capture', [nf, old], R.id, fname(s, nf) + '군이 ' + R.name + '을(를) 함락했다.', { cause: '포위·전투', decision: '점령', stateChanges: R.name + ' 지배: ' + fname(s, old) + ' → ' + fname(s, nf) });
      report(s, nf, R.name + '을(를) 점령했습니다. 부대를 주둔시키지 않으면 성이 비어 있습니다.', true, R.id);
      report(s, old, R.name + '을(를) 잃었습니다.', true, R.id);
      if (e) closeEngagement(s, e, 'capture');
      const OF = s.factions[old], left = regs(s).filter(r => r.controller === old);
      if (!left.length) eliminate(s, old, nf);
      else if (OF.capitalId === R.id) OF.capitalId = left.sort((a, b) => b.tax - a.tax)[0].id;
    }
  }
  function eliminate(s, fid, by) {
    const F = s.factions[fid]; F.alive = false; F.overlord = null;
    for (const a of armyList(s)) if (a.factionId === fid) delete s.armies[a.id];
    for (const x of FIDS) { if (s.factions[x].overlord === fid) { s.factions[x].overlord = null; for (const r of regs(s)) if (r.controller === x) r.overlord = x; } delete s.wars[tk(x, fid)]; }
    for (const id in s.characters) { const c = s.characters[id]; if (c.faction === fid) { c.armyId = null; if (c.status === 'active') { c.status = 'captive'; c.captor = by; c.loc = s.factions[by].capitalId; } } }
    for (const ag of s.agreements) if (ag.parties.indexOf(fid) >= 0) ag.active = false;
    chron(s, 'fall', [by, fid], null, fname(s, fid) + '이(가) ' + fname(s, by) + '에 무너졌다.', { cause: '마지막 거점 상실', decision: '멸망' });
    if (fid === s.playerFactionId) s.over = { type: 'defeat', week: s.week };
  }

  // ───────────────────────── 주간 판정 단계 ─────────────────────────
  function stepOrders(s) { // 3. 외교·내정·첩보 명령 진행, 모병 완료
    for (const o of s.orders) {
      if (o.status !== 'active' || s.week - o.startedAt < o.duration) continue;
      o.status = 'done';
      const f = o.actorId, R = o.params.regionId ? s.regions[o.params.regionId] : null;
      if (o.type === 'RECRUIT') { if (R.controller !== f) { o.status = 'failed'; continue; } R.garrison[o.params.unit] += o.params.count; report(s, f, R.name + '에서 ' + UNIT[o.params.unit].name + ' ' + o.params.count + '명 모병을 마쳤습니다.', false, R.id); }
      else if (o.type === 'FORTIFY') { if (R.controller !== f) { o.status = 'failed'; continue; } R.fort = Math.min(5, R.fort + 1); report(s, f, R.name + ' 성 방어가 ' + R.fort + '단계가 되었습니다.', false, R.id); }
      else if (o.type === 'BUY_GRAIN') { if (R.controller !== f || R.siege) { o.status = 'failed'; report(s, f, R.name + '(으)로 오던 곡식이 길이 막혀 흩어졌습니다.', true, R.id); continue; } R.grain += o.params.grain; report(s, f, R.name + '에 사들인 군량 ' + o.params.grain + '이 들어왔습니다.', false, R.id); }
      else if (o.type === 'REQUISITION') { if (R.controller !== f) { o.status = 'failed'; continue; } R.grain += K.reqGrain; R.morale = Math.max(0, R.morale - K.reqMorale); R.lastReq = s.week; report(s, f, R.name + '에서 군량 ' + K.reqGrain + '을 거뒀습니다. 민심이 내려갔습니다.', false, R.id); }
      else if (o.type === 'SCOUT') {
        const offs = []; for (const id in s.characters) { const c = s.characters[id]; if (c.loc === R.id && !c.armyId && c.status === 'active' && sameBloc(s, c.faction, R.controller)) offs.push(id); }
        s.intel[f].regions[R.id] = { week: s.week, conf: 'confirmed', garr: total(R.garrison), scout: true, units: Object.assign({}, R.garrison), officers: offs };
        for (const a of armyList(s)) if (a.factionId !== f && !a.leg && a.loc === R.id) s.intel[f].armies[a.id] = { week: s.week, conf: 'confirmed', est: total(a.units), loc: a.loc, to: null, f: a.factionId };
        report(s, f, R.name + ' 정찰 보고: 주둔 ' + total(R.garrison) + '명(경 ' + R.garrison.light + '·중 ' + R.garrison.heavy + '·궁 ' + R.garrison.archer + '·기 ' + R.garrison.cav + '), 성 방어 ' + R.fort + '단계' + (offs.length ? ', 장수 ' + offs.map(id => s.characters[id].name).join('·') : '') + '.', false, R.id);
      }
      else if (o.type === 'ENVOY' || o.type === 'CALL_ARMS') resolveEnvoy(s, o);
      else if (o.type === 'PACIFY') { if (R.controller !== f) { o.status = 'failed'; continue; } R.morale = Math.min(90, R.morale + K.pacifyMorale); report(s, f, R.name + '의 민심을 수습했습니다. (민심 ' + R.morale + ')', false, R.id); }
      else if (o.type === 'APPOINT') {
        const c = s.characters[o.params.charId]; if (c.armyId === 'appoint') c.armyId = null;
        if (R.controller !== f || c.status !== 'active' || c.faction !== f) { o.status = 'failed'; continue; }
        c.loc = R.id; R.lord = c.id; c.loyalty = Math.min(100, c.loyalty + 3);
        chron(s, 'appoint', [f], R.id, c.name + '이(가) ' + R.name + ' 성주로 부임했다.', { cause: '인사', stateChanges: '민심 목표 ' + (50 + Math.round(c.po / 4)) });
        report(s, f, c.name + '이(가) ' + R.name + ' 성주로 부임했습니다.', false, R.id);
      }
      else if (o.type === 'PROBE') {
        const t = o.params.targetFactionId, T = s.factions[t]; if (!T.alive) { o.status = 'failed'; continue; }
        const snap = { week: s.week, overlord: T.overlord, trust: {}, lean: {}, envoys: [], terms: null, treasury: Math.round(T.treasury), grainWeeks: Math.floor(grainWeeks(s, t)), unhappy: [] };
        for (const k of FIDS) if (k !== t && s.factions[k].alive && (FMETA[k].kingdom || k === f)) snap.trust[k] = trust(s, t, k);
        if (!FMETA[t].kingdom && !FMETA[t].sovereign) for (const k of FIDS) if (FMETA[k].kingdom && s.factions[k].alive && T.overlord !== k) snap.lean[k] = acceptScore(s, k, t, t, TERMS0).score;
        for (const x of s.orders) if (x.status === 'active' && x.type === 'ENVOY' && x.params.targetFactionId === t && x.actorId !== f) snap.envoys.push({ from: x.actorId, kind: x.params.kind });
        const ag = T.overlord && vassalAg(s, T.overlord, t); if (ag) snap.terms = ag.text;
        for (const id in s.characters) { const c = s.characters[id]; if (c.faction === t && c.status === 'active' && id !== T.rulerId && c.loyalty < 40) snap.unhappy.push(c.name); }
        s.intel[f].factions[t] = snap;
        report(s, f, T.name + ' 동향 보고가 들어왔습니다.' + (snap.envoys.length ? ' ' + snap.envoys.map(e => fname(s, e.from)).join('·') + '의 사신이 드나들고 있습니다.' : ''), true, T.capitalId);
      }
    }
    for (const pr of s.proposals) if (pr.status === 'pending' && s.week > pr.expires) { resolveProposal(s, pr, false); pr.status = 'expired'; }
    if (s.orders.length > 400) s.orders = s.orders.filter(o => o.status === 'active' || s.week - o.startedAt < 12);
  }
  function stepEconomy(s) { // 4. 수입·군량·보급·사기
    for (const r of regs(s)) { // 세력 안의 군량 수송: 남는 곳간에서 비축으로, 비축에서 모자란 곳간으로 (포위된 곳은 제외)
      if (r.siege) continue; const F = s.factions[r.controller], use = upkeep(r.garrison) * K.garrisonGrain;
      if (r.grain > use * 16) { const t = (r.grain - use * 16) * 0.25; r.grain -= t; F.grain += t; }
    }
    for (const r of regs(s)) {
      if (r.siege) continue; const F = s.factions[r.controller], use = upkeep(r.garrison) * K.garrisonGrain;
      if (r.grain < use * 6) { const t = Math.min(use * 6 - r.grain, F.grain); r.grain += t; F.grain -= t; }
    }
    for (const r of regs(s)) {
      const F = s.factions[r.controller];
      F.treasury += r.tax * r.morale / 100 * (1 - r.autonomy / 100 * 0.7) * (defiant(s, r) ? 0.5 : 1);
      if (!r.siege) {
        const L = lordOf(s, r), goal = L ? 50 + Math.round(L.po / 4) : 45; // 성주의 정치력이 민심이 머무는 자리를 정한다
        if (s.week % 2 === 0) { if (r.morale < goal) r.morale++; else if (r.morale > goal + 10) r.morale--; }
        if (r.manpower < r.manpowerMax) r.manpower = Math.min(r.manpowerMax, r.manpower + Math.ceil(r.manpowerMax * 0.01));
        if (r.gMorale < 70) r.gMorale = Math.min(70, r.gMorale + 2);
      }
      let need = upkeep(r.garrison) * K.garrisonGrain, t = Math.min(need, r.grain); r.grain -= t; need -= t;
      if (need > 0 && !r.siege) { t = Math.min(need, F.grain); F.grain -= t; need -= t; }
      if (need > 0.5) { r.starve++; r.gMorale = Math.max(0, r.gMorale - K.starveMorale); scaleU(r.garrison, 1 - K.starveAttr); if (r.starve === 1) report(s, r.controller, r.name + '의 군량이 떨어졌습니다. 주둔군이 굶고 있습니다.', true, r.id); }
      else r.starve = 0;
    }
    for (const id in s.characters) { const c = s.characters[id]; if (c.status === 'active' && c.office && c.officeBy && s.factions[c.officeBy].alive) s.factions[c.officeBy].treasury -= K.officeSalary * c.office; } // 관직 봉록
    for (const g of s.agreements) { // 상납
      if (!g.active || g.type !== 'vassal' || g.terms.autonomy === 'full') continue;
      let inc = 0; for (const r of regs(s)) if (r.controller === g.parties[1]) inc += r.tax * r.morale / 100 * (1 - r.autonomy / 100 * 0.7);
      const amt = Math.min(inc * (g.terms.autonomy === 'tribute20' ? 0.2 : 0.1), Math.max(0, s.factions[g.parties[1]].treasury)); s.factions[g.parties[1]].treasury -= amt; s.factions[g.parties[0]].treasury += amt;
    }
    // 병종별 국고 유지비. 국고가 바닥나면 급료가 밀려 사기가 떨어진다
    const pay = {}; for (const f of FIDS) pay[f] = 0;
    for (const r of regs(s)) pay[r.controller] += goldUpkeep(r.garrison);
    for (const a of armyList(s)) pay[a.factionId] += goldUpkeep(a.units);
    for (const f of FIDS) {
      const F = s.factions[f]; if (!F.alive) continue;
      F.treasury -= pay[f];
      if (F.treasury < 0) {
        F.treasury = 0; F.unpaid = (F.unpaid || 0) + 1;
        for (const r of regs(s)) if (r.controller === f) r.gMorale = Math.max(0, r.gMorale - K.unpaidMorale);
        for (const a of armyList(s)) if (a.factionId === f) a.morale = Math.max(0, a.morale - K.unpaidMorale);
        if (F.unpaid === 1) report(s, f, '국고가 바닥나 병사 급료가 밀렸습니다. 사기가 떨어집니다.', true);
      } else F.unpaid = 0;
    }
    for (const a of armyList(s)) {
      const R = s.regions[a.loc], F = s.factions[a.factionId], base = upkeep(a.units);
      const rest = !a.leg && sameBloc(s, a.factionId, R.controller) && !R.siege;
      const link = supplyLink(s, a);
      if (!rest && link.linked) { // 보급선이 이어져 있으면 비축 군량을 실어 보낸다 (운송 손실)
        const d = Math.min(base * 2, base * 4 - a.supply);
        if (d > 0) { const t = Math.min(d * (1 + K.transportLoss), F.grain); F.grain -= t; a.supply += t / (1 + K.transportLoss); }
      }
      if (link.linked) a.cut = 0;
      else {
        a.cut = (a.cut || 0) + 1;
        if (a.cut === 1) report(s, a.factionId, '부대의 보급선이 끊겼습니다. 가져간 군량으로 버팁니다.', true, a.loc);
        if (a.cut > K.cutWeeks) a.morale = Math.max(0, a.morale - K.cutMorale);
      }
      let need = base;
      if (rest) {
        need *= (1 - K.forage);
        let d = base * 6 - a.supply;
        if (d > 0) {
          if (R.controller === a.factionId) { const t = Math.min(d, Math.max(0, R.grain - upkeep(R.garrison) * K.garrisonGrain * 4)); R.grain -= t; a.supply += t; d -= t; }
          const t2 = Math.min(d, F.grain); F.grain -= t2; a.supply += t2;
        }
      }
      const t = Math.min(need, a.supply); a.supply -= t; need -= t;
      if (need > 0.5) { a.starve++; a.morale = Math.max(0, a.morale - K.starveMorale); scaleU(a.units, 1 - K.starveAttr); if (a.starve === 1) report(s, a.factionId, '출정군의 군량이 떨어졌습니다. 사기와 병력이 줄어듭니다.', true, a.loc); if (total(a.units) < 50) { report(s, a.factionId, '굶주린 부대가 흩어졌습니다.', true, a.loc); removeArmy(s, a); } }
      else { a.starve = 0; if (rest && a.morale < 80) a.morale = Math.min(80, a.morale + 2); }
    }
  }
  function goldUpkeep(u) { let g = 0; for (const k of UNITS) g += u[k] / 100 * UNIT[k].gold; return g; }
  // 보급선: 우리(또는 정보를 나누는 우군) 거점이거나 그 바로 옆이면 이어져 있다
  function depot(s, f, rid) { const R = s.regions[rid]; return !R.siege && shares(s, f, R.controller); }
  function linkedAt(s, f, rid) { if (depot(s, f, rid)) return rid; const n = ADJ[rid].find(x => depot(s, f, x.to)); return n ? n.to : null; }
  function supplyLink(s, a) {
    const pts = a.leg ? [a.leg.a, a.leg.b] : [a.loc];
    for (const p of pts) { const via = linkedAt(s, a.factionId, p); if (via) return { linked: true, via }; }
    return { linked: false, via: null };
  }
  function startLeg(s, a) {
    const next = a.path[0], fin = a.path.length === 1, e = edgeBetween(a.loc, next);
    if (!e || (!fin && !canPass(s, a.factionId, next))) { a.path = []; report(s, a.factionId, rname(s, a.loc) + '에서 길이 막혀 부대가 멈췄습니다.', true, a.loc); return false; }
    a.leg = { a: a.loc, b: next, f0: 0, f1: 1, to: next, cost: edgeWeeks(e, a.units, s.week), done: 0 };
    return true;
  }
  function onArrive(s, a) {
    if (a.path.length) return;
    const R = s.regions[a.loc], c = R.controller, f = a.factionId;
    if (sameBloc(s, f, c)) { if (c === f && a.mission === 'station') { report(s, f, R.name + '에 부대가 도착해 주둔군에 합류했습니다.', false, R.id); garrisonArmy(s, a); } else report(s, f, '부대가 ' + R.name + '에 도착했습니다.', false, R.id); return; }
    if (a.mission === 'attack') { if (!atWar(s, f, c)) declareWar(s, f, c, R.id); }
    else if (!atWar(s, f, c)) sendHome(s, a);
  }
  function stepMove(s) { // 5. 경로 기반 이동. 인접 거점으로만, 걸리는 주수만큼
    for (const a of armyList(s)) {
      if (!s.armies[a.id]) continue;
      if (!a.leg && a.path.length && !startLeg(s, a)) continue;
      if (!a.leg) continue;
      a.leg.done++;
      if (a.leg.done >= a.leg.cost) {
        a.loc = a.leg.to; a.leg = null; if (a.path[0] === a.loc) a.path.shift();
        for (const c of chars(s, [a.commanderId].concat(a.deputyIds || []))) c.loc = a.loc;
        onArrive(s, a);
      }
    }
  }
  function stepPromises(s) { // 9. 약속 이행·위반
    for (const R of regs(s)) { // 섬기는 세력의 성이 포위되면 종주의 구원 약속이 걸린다
      if (!R.siege) continue; const M = R.controller, O = s.factions[M].overlord; if (!O) continue;
      const ag = vassalAg(s, O, M); if (!ag || !ag.terms.protect) continue;
      let ob = ag.obs.find(o => o.kind === 'protect' && o.siegeStart === R.siege.start && o.regionId === R.id);
      if (!ob) ob = addOb(s, ag, O, M, 'protect', R.siege.start + ag.terms.protect, { regionId: R.id, siegeStart: R.siege.start });
      if (ob.status !== 'pending') continue;
      if (R.siege.relief) fulfil(s, ob, dateStr(s.week) + ' 원군 도착');
      else if (s.week >= ob.due) { R.siege.breached = true; breach(s, ag, ob, ag.terms.protect + '주가 지나도록 원군이 오지 않음'); }
    }
    for (const ag of s.agreements) {
      for (const ob of ag.obs || []) {
        if (ob.status !== 'pending') continue;
        if (!s.factions[ob.by].alive || !s.factions[ob.to].alive) { ob.status = 'void'; continue; }
        const R = ob.regionId ? s.regions[ob.regionId] : null;
        if (ob.kind === 'protect') { if (!R.siege || R.siege.start !== ob.siegeStart) ob.status = 'void'; }
        else if (ob.kind === 'aid' || ob.kind === 'mobilize') {
          if (ob.defend === undefined) ob.defend = sameBloc(s, R.controller, ob.to);
          const n = armyList(s).filter(a => a.factionId === ob.by && !a.leg && a.loc === R.id).reduce((x, a) => x + total(a.units), 0);
          if (n >= ob.need * 0.7) fulfil(s, ob, dateStr(s.week) + ' ' + n + '명 도착');
          else if (ob.defend && !sameBloc(s, R.controller, ob.to)) ob.status = 'void'; // 지킬 성이 이미 넘어감
          else if (s.week > ob.due) breach(s, ag, ob, '기한까지 병력이 오지 않음');
        } else if (ob.kind === 'office' && s.week > ob.due) breach(s, ag, ob, '기한까지 관직을 내리지 않음');
      }
      if (ag.active && ag.until !== null && s.week > ag.until) {
        ag.active = false;
        if (ag.type === 'truce') {
          for (const k of ag.pairs) { const q = k.split('|'); if (s.factions[q[0]].alive && s.factions[q[1]].alive && !sameBloc(s, q[0], q[1])) s.wars[k] = s.week; }
          chron(s, 'truce', ag.parties, null, fname(s, ag.parties[0]) + '와(과) ' + fname(s, ag.parties[1]) + '의 휴전이 끝났다.', { cause: '기한 만료', stateChanges: '교전 재개' });
          for (const f of ag.parties) report(s, f, '휴전이 끝났습니다. 다시 싸울 수 있습니다.', true);
        } else if (ag.type === 'passage') { delete s.passes[ag.parties[0] + '>' + ag.parties[1]]; report(s, ag.parties[1], fname(s, ag.parties[0]) + '의 통행 허락 기한이 끝났습니다.', false); }
      }
    }
  }
  function stepEvents(s) { // 10. 조건부 사건·기록
    if (K.harvestWeeks.indexOf(s.week) >= 0) {
      for (const r of regs(s)) { const h = r.tax * K.harvestMult * (r.siege ? 0.3 : 1); r.grain += h * (1 - K.harvestPool); s.factions[r.controller].grain += h * K.harvestPool; }
      chron(s, 'harvest', [], null, '가을걷이가 끝나 각지의 곳간에 군량이 들어왔다.');
      report(s, s.playerFactionId, '수확으로 군량이 들어왔습니다.', false);
    }
    if (!s.over && s.week >= K.weeks) { s.over = { type: 'end', week: s.week }; chron(s, 'end', [], null, '930년이 저물었다. 60주의 기록이 여기서 끝난다.'); }
  }

  // ───────────────────────── 세력 AI ─────────────────────────
  function threatTo(s, f, rid) {
    let t = 0;
    for (const n of ADJ[rid]) if (hostileTo(s, f, s.regions[n.to].controller)) t += 0.5 * obsGarr(s, f, n.to);
    t += obsArmies(s, f, rid, x => hostileTo(s, f, x), true);
    return t;
  }
  function defenseOf(s, rid) { const R = s.regions[rid]; let d = total(R.garrison); for (const a of armyList(s)) if (!a.leg && a.loc === rid && sameBloc(s, a.factionId, R.controller) && !atWar(s, a.factionId, R.controller)) d += total(a.units); return d; }
  function spare(s, f, S) {
    const P = AIP[f], g = total(S.garrison);
    let keep = Math.max(P.kingdom ? 500 : 300, (P.kingdom ? 0.3 : 0.6) * g, threatTo(s, f, S.id));
    keep = Math.max(keep, (S.id === s.factions[f].capitalId ? 0.45 : 0.35) * S.g0);
    return Math.max(0, Math.floor((g - keep) / 100) * 100);
  }
  function pickStaff(s, f, S, allowRuler, nDep) {
    const ruler = s.factions[f].rulerId, list = [];
    for (const id in s.characters) { const c = s.characters[id]; if (c.faction !== f || c.loc !== S.id || c.armyId || c.status !== 'active') continue; if (id === ruler && !allowRuler) continue; list.push(c); }
    list.sort((a, b) => b.ld - a.ld || (a.id < b.id ? -1 : 1));
    const cmd = list[0] || null, rest = list.slice(1).sort((a, b) => (b.ma + b.st) - (a.ma + a.st) || (a.id < b.id ? -1 : 1));
    return { cmd, deps: rest.slice(0, nDep || 0) };
  }
  function pickCommander(s, f, S, allowRuler) { return pickStaff(s, f, S, allowRuler, 0).cmd; }
  function grainWeeks(s, f) {
    let have = s.factions[f].grain, use = 0;
    for (const r of regs(s)) if (r.controller === f) { have += r.grain; use += upkeep(r.garrison) * K.garrisonGrain; }
    for (const a of armyList(s)) if (a.factionId === f) { have += a.supply; use += upkeep(a.units); }
    return use > 0 ? have / use : 99;
  }
  function manageArmies(s, f) {
    for (const a of armyList(s)) {
      if (a.factionId !== f || !s.armies[a.id]) continue;
      if (a.leg) { if (a.starve >= 2 && a.mission !== 'return') issueOrder(s, f, 'RETREAT', { armyId: a.id }, { u: 1, why: '군량이 떨어져 회군' }); continue; }
      if (a.path.length) continue;
      const R = s.regions[a.loc], c = R.controller;
      if (atWar(s, f, c)) { if (a.starve >= 1) issueOrder(s, f, 'RETREAT', { armyId: a.id }, { u: 1, why: '포위 중 군량 고갈' }); continue; }
      if (c === f) {
        if (a.mission === 'guard' && (R.siege || threatTo(s, f, R.id) > 0.8 * total(R.garrison))) { a.idle = 0; continue; }
        if (a.mission === 'guard' && ++a.idle < 3) continue;
        issueOrder(s, f, 'GARRISON', { armyId: a.id }, { u: 1, why: R.name + '에 주둔' });
      } else if (sameBloc(s, f, c)) {
        const D = defenseOf(s, R.id) - total(a.units);
        if (R.siege || threatTo(s, f, R.id) > 0.6 * D) { a.idle = 0; if (a.supply >= upkeep(a.units)) continue; }
        if (++a.idle >= 6 || a.supply < upkeep(a.units) || (!R.siege && grainWeeks(s, f) < 8)) { if (!s.armies[a.id]) continue; const r = issueOrder(s, f, 'RETREAT', { armyId: a.id }, { u: 1, why: '위협이 사라져 본대 복귀' }); if (r.ok) a.idle = 0; }
      } else issueOrder(s, f, 'RETREAT', { armyId: a.id }, { u: 1, why: '더는 우군 땅이 아니어서 철수' });
    }
  }
  function aiTurn(s, f) {
    const F = s.factions[f], P = AIP[f], mem = s.ai[f];
    if (!F.alive) return;
    manageArmies(s, f);
    const cands = [], mine = regs(s).filter(r => r.controller === f), reserve = P.kingdom ? 150 : 40;
    const gw = grainWeeks(s, f);
    const push = (u, type, params, why, key) => cands.push({ u, type, params, why, key: key || type });
    const scoutCand = (T, u) => {
      if (s.week - (mem.lastScout[T.id] === undefined ? -99 : mem.lastScout[T.id]) < 6) return;
      if (validate(s, f, 'SCOUT', { regionId: T.id }).ok) push(u, 'SCOUT', { regionId: T.id }, T.name + ' 정보가 부족해 정찰', 'SCOUT');
    };
    let wantRecruit = null;

    // (1) 구원·전진 배치
    for (const R of regs(s)) {
      const c = R.controller;
      if (!(c === f || (sameBloc(s, f, c) && trust(s, f, c) >= 40))) continue;
      if (!P.kingdom) {
        if (c === f || !R.siege) continue;
        if (!ADJ[F.capitalId].some(n => n.to === R.id)) continue;
        if (trust(s, f, c === head(s, f) ? c : head(s, f)) < 50) continue;
      }
      const T = threatTo(s, f, R.id), D = defenseOf(s, R.id), Ta = obsArmies(s, f, R.id, x => hostileTo(s, f, x), true);
      if (!R.siege && (Ta < 500 || T <= D * 1.1)) continue;
      if (s.week - (mem.lastReinf[R.id] === undefined ? -99 : mem.lastReinf[R.id]) < 2) continue;
      let inbound = 0; for (const a of armyList(s)) if (a.factionId === f && a.target === R.id && (a.leg || a.path.length)) inbound += total(a.units);
      const need = Math.min(5000, T * 1.1 - D - inbound + 300);
      if (need < 400) continue;
      let best = null;
      for (const S of mine) {
        if (S.id === R.id || S.siege) continue;
        const sp = spare(s, f, S); if (sp < (P.kingdom ? 500 : 300)) continue;
        const p = findPath(s, f, S.id, R.id, S.garrison); if (!p || p.weeks > 9) continue;
        const sc = Math.min(sp, need) / Math.pow(p.weeks + 1, 1.6); if (!best || sc > best.sc) best = { S, sp, p, sc };
      }
      if (!best) continue;
      const n = Math.min(best.sp, Math.max(P.kingdom ? 800 : 400, Math.ceil(need / 100) * 100)), sf = pickStaff(s, f, best.S, false, 1);
      const u = (R.siege ? 0.85 : 0.5 + 0.25 * Math.min(1, T / Math.max(D, 1) - 1)) * ((P.guard || {})[R.id] || 1);
      push(u, 'MARCH', { fromRegionId: best.S.id, targetRegionId: R.id, units: split(best.S.garrison, n), commanderId: sf.cmd ? sf.cmd.id : null, deputyIds: sf.cmd ? sf.deps.map(c => c.id) : [], stance: '방어' },
        R.name + (R.siege ? ' 구원' : ' 방어 증원') + ': 위협 ' + Math.round(T) + ' > 수비 ' + Math.round(D) + ', ' + best.p.weeks + '주 거리', 'MARCH:' + best.S.id);
    }

    // (2) 공격
    if (P.aggr >= 0.3) {
      const off = armyList(s).filter(a => a.factionId === f && a.mission === 'attack');
      for (const T of regs(s)) {
        const c = T.controller; if (c === f || sameBloc(s, f, c)) continue;
        const war = atWar(s, f, c);
        if (!war && !(P.targets.indexOf(T.id) >= 0 && trust(s, f, c) < 30)) continue;
        if (truceBetween(s, f, c)) continue;
        if (off.some(a => a.target === T.id)) continue;
        const val = P.value[T.id] === undefined ? 0.4 : P.value[T.id];
        let best = null;
        for (const S of mine) {
          if (S.siege) continue; const sp = spare(s, f, S); if (sp < 600) continue;
          const p = findPath(s, f, S.id, T.id, S.garrison); if (!p || p.weeks > 10) continue;
          const sc = sp / (p.weeks + 3); if (!best || sc > best.sc) best = { S, sp, p, sc };
        }
        if (!best) continue;
        const it = regionIntel(s, f, T.id);
        if (it.conf === 'unknown') { scoutCand(T, 0.3 + 0.3 * val); continue; }
        if (off.length >= P.maxOff) continue;
        const est = it.garr + obsArmies(s, f, T.id, x => sameBloc(s, x, c), false);
        const req = est * 1.2 * (1 + T.fort * K.fortDef + K.terrDef[T.terrain]) * (1.9 - P.aggr);
        const sf = pickStaff(s, f, best.S, !!P.rulerLeads, 2), cm = sf.cmd, coef = avgCoef(best.S.garrison) * cmdF(cm), pow = best.sp * coef;
        if (pow >= req) {
          const n = Math.min(best.sp, Math.max(Math.ceil(req / coef * 1.3 / 100) * 100, 1500)), units = split(best.S.garrison, n);
          if (best.S.grain + F.grain < upkeep(units) * (best.p.weeks + 6)) { wantRecruit = null; continue; }
          push(P.aggr * (0.55 + 0.45 * val) + (war ? 0.05 : 0), 'MARCH', { fromRegionId: best.S.id, targetRegionId: T.id, units, commanderId: cm ? cm.id : null, deputyIds: cm ? sf.deps.map(c => c.id) : [], stance: pow > req * 1.5 ? '공세' : '신중', mission: 'attack' },
            T.name + ' 공격: 적 추정 ' + Math.round(est) + '(' + (it.conf === 'confirmed' ? '확인' : '추정') + '), 필요 전력 ' + Math.round(req) + ' ≤ 가용 ' + Math.round(pow), 'MARCH:' + best.S.id);
        } else { if (it.conf !== 'confirmed') scoutCand(T, 0.3); if (!wantRecruit && val >= 0.5) wantRecruit = best.S; }
      }
    }

    // (3) 모병
    {
      let S = null, tr = 0;
      for (const r of mine) { if (r.siege) continue; const x = threatTo(s, f, r.id) / Math.max(1, defenseOf(s, r.id)); if (x > tr) { tr = x; S = r; } }
      let u = 0, why = '';
      if (S && tr > 0.9) { u = 0.45 + Math.min(0.3, (tr - 0.9) * 0.3); why = S.name + ' 위협 대비(위협/수비 ' + tr.toFixed(2) + ')'; }
      else if (wantRecruit) { S = wantRecruit; u = 0.4; why = S.name + '에서 공격 전력 확충'; }
      else if (P.kingdom && F.treasury > 1500) { // 쌓인 국고로 접경 거점의 상비군을 늘린다
        let best = null; for (const r of mine) { if (r.siege || r.manpower < 500) continue; const x = threatTo(s, f, r.id) / Math.max(1, defenseOf(s, r.id)) + (r.id === F.capitalId ? 0.2 : 0); if (!best || x > best.x) best = { r, x }; }
        if (best) { S = best.r; u = 0.3 + Math.min(0.15, (F.treasury - 1500) / 10000); why = '국고 ' + Math.round(F.treasury) + '에 여유가 있어 ' + S.name + ' 상비군 확충'; }
      }
      if (u > 0 && S && S.manpower >= 300 && gw >= 20 && !activeOrder(s, o => o.type === 'RECRUIT' && o.actorId === f && o.params.regionId === S.id)) {
        const cyc = tr > 0.9 ? ['archer', 'heavy', 'light'] : ['light', 'cav', 'heavy', 'archer'], unit = cyc[(s.week + RIDX[S.id]) % cyc.length];
        const net = factionSummary(s, f), budget = F.treasury - reserve + Math.min(0, net.income - net.gold) * 10;
        const afford = Math.floor(budget / (UNIT[unit].cost + 12 * UNIT[unit].gold)) * 100, n = net.income - net.gold < UNIT[unit].gold * 2 ? 0 : Math.min(S.manpower, afford, P.kingdom ? 1000 : 500);
        if (n >= 100) push(u, 'RECRUIT', { regionId: S.id, unit, count: Math.floor(n / 100) * 100 }, why, 'RECRUIT:' + S.id);
      }
    }
    // (4) 매입·징발·보강
    if (gw < 14 && F.treasury > reserve + 150) {
      let best = null; for (const r of mine) { if (r.siege) continue; const use = upkeep(r.garrison) * K.garrisonGrain; if (!best || use > best.use) best = { r, use }; }
      const g = Math.min(K.buyMax, Math.floor((F.treasury - reserve) / 50) * 50);
      if (best && g >= 50 && validate(s, f, 'BUY_GRAIN', { regionId: best.r.id, gold: g }).ok) push(0.55 + (14 - gw) / 40, 'BUY_GRAIN', { regionId: best.r.id, gold: g }, '군량이 ' + Math.floor(gw) + '주치뿐이라 국고 ' + g + '으로 곡식 매입', 'BUY');
    }
    for (const r of mine) {
      if (r.siege) continue;
      const use = upkeep(r.garrison) * K.garrisonGrain, T = threatTo(s, f, r.id), D = Math.max(1, defenseOf(s, r.id));
      if (use > 0 && r.grain / use < 8 && F.grain < use * 8 && r.morale > 45 && validate(s, f, 'REQUISITION', { regionId: r.id }).ok) push(0.5, 'REQUISITION', { regionId: r.id }, r.name + ' 군량이 8주치 미만', 'REQ:' + r.id);
      if (T > 0 && r.fort < 4 && F.treasury >= K.repairCost + reserve && validate(s, f, 'FORTIFY', { regionId: r.id }).ok) push(0.3 + (T / D > 0.8 ? 0.2 : 0) + 0.01 * r.tax / 10, 'FORTIFY', { regionId: r.id }, r.name + ' 성 보강(인접 위협 ' + Math.round(T) + ')', 'FORT:' + r.id);
    }
    // (5) 사신·약정
    if (F.treasury >= K.envoyCost + 20) {
      const last = m => mem.lastEnvoy[m] === undefined ? -99 : mem.lastEnvoy[m];
      const free = m => s.week - last(m) >= 8 && !activeOrder(s, o => (o.type === 'ENVOY' || o.type === 'CALL_ARMS') && o.actorId === f && o.params.targetFactionId === m);
      if (P.kingdom && !F.overlord) {
        for (const m of FIDS) {
          const M = s.factions[m]; if (!M.alive || m === f || FMETA[m].kingdom || FMETA[m].sovereign || !free(m)) continue;
          if (M.overlord === f) { // 우리를 섬기는 호족: 흔들리면 달래고, 믿을 만하면 동원 의무를 얻는다
            const tr = trust(s, f, m), ag = vassalAg(s, f, m);
            if (tr < 55) {
              if (P.marries && !s.ties[tk(f, m)] && F.treasury >= K.marryCost + reserve + 50) push(0.42 + (55 - tr) / 100, 'ENVOY', { targetFactionId: m, kind: 'marriage' }, fname(s, m) + ' 신뢰 ' + tr + ': 혼인으로 묶음', 'ENVOY:' + m);
              else if (F.treasury >= K.giftCost + reserve) push(0.36 + (55 - tr) / 100, 'ENVOY', { targetFactionId: m, kind: 'gift' }, fname(s, m) + ' 신뢰 ' + tr + ': 예물로 달램', 'ENVOY:' + m);
            } else if (tr >= 60 && ag && !ag.terms.mobilize && F.treasury >= reserve + 150 && s.week - (ag.revised === undefined ? -99 : ag.revised) >= 12) {
              const tm = Object.assign({}, ag.terms, { mobilize: true, office: 'now', gold: 0 });
              if (validate(s, f, 'ENVOY', { targetFactionId: m, kind: 'offer', terms: tm }).ok) push(0.34, 'ENVOY', { targetFactionId: m, kind: 'offer', terms: tm }, fname(s, m) + '에 동원 의무를 청하고 관직으로 보답', 'ENVOY:' + m);
            }
            continue;
          }
          if (M.overlord && !atWar(s, f, M.overlord) && trust(s, f, M.overlord) >= 60) continue;
          let tm = Object.assign({}, TERMS0), sc = acceptScore(s, f, m, f, tm).score;
          if (sc <= 3 && sc >= -8) { const sw = sweeten(f, tm, 4 - sc); if (sw && sw.gold <= 100 && sw.gold + K.envoyCost + reserve <= F.treasury) { tm = sw; sc = acceptScore(s, f, m, f, tm).score; } }
          if (sc > -8) push(Math.min(0.7, 0.38 + sc / 100), 'ENVOY', { targetFactionId: m, kind: 'offer', terms: tm }, fname(s, m) + '에 귀부 권유(예상 ' + sc + ', 조건: ' + termsText(tm).join('·') + ')', 'ENVOY:' + m);
        }
        for (const k of FIDS) { // 지쳤으면 휴전을 청한다
          if (!FMETA[k].kingdom || k === f || !s.factions[k].alive || !atWar(s, f, k) || s.factions[k].overlord || !free(k)) continue;
          const lost = s.chronicle.filter(c => (c.type === 'retreat' || c.type === 'rout') && c.participants[0] === f && s.week - c.week <= 10).length;
          if ((gw < 6 || lost >= 2) && !armyList(s).some(a => a.factionId === f && a.mission === 'attack')) push(0.5, 'ENVOY', { targetFactionId: k, kind: 'truce', terms: { weeks: 12 } }, (gw < 6 ? '군량이 ' + Math.floor(gw) + '주치뿐' : '최근 패전 ' + lost + '번') + '이라 휴전을 청함', 'ENVOY:' + k);
        }
        for (const g of s.agreements) { // 동원령
          if (!g.active || g.type !== 'vassal' || g.parties[0] !== f || !g.terms.mobilize) continue;
          const R = regs(s).find(r => r.siege && shares(s, f, r.controller) && r.controller !== g.parties[1] && validate(s, f, 'CALL_ARMS', { vassalId: g.parties[1], regionId: r.id }).ok);
          if (R) push(0.7, 'CALL_ARMS', { vassalId: g.parties[1], regionId: R.id }, R.name + ' 포위: ' + fname(s, g.parties[1]) + '에 동원령', 'CALL:' + g.parties[1]);
        }
      } else if (!FMETA[f].kingdom && !FMETA[f].sovereign) {
        const cap = s.regions[F.capitalId], O = F.overlord;
        if (cap.siege && cap.siege.rounds >= 2) {
          const Kb = head(s, cap.siege.by);
          const relief = armyList(s).some(a => a.factionId !== f && sameBloc(s, a.factionId, f) && (a.target === cap.id || a.loc === cap.id));
          if (FMETA[Kb].kingdom && !relief && (cap.gMorale < 50 || total(cap.garrison) < 0.6 * cap.siege.init) && free(Kb) && validate(s, f, 'ENVOY', { targetFactionId: Kb, kind: 'pledge' }).ok)
            push(0.8, 'ENVOY', { targetFactionId: Kb, kind: 'pledge' }, '구원군이 없고 성이 위태로워 ' + fname(s, Kb) + '에 귀부를 청함', 'ENVOY:' + Kb);
        } else if (!cap.siege && threatTo(s, f, cap.id) > 1.5 * defenseOf(s, cap.id) && (!O || trust(s, f, O) < 35)) {
          for (const k of FIDS) {
            if (!FMETA[k].kingdom || !s.factions[k].alive || k === O || atWar(s, f, k) || !free(k)) continue;
            if (!validate(s, f, 'ENVOY', { targetFactionId: k, kind: 'pledge' }).ok) continue;
            const sc = acceptScore(s, k, f, f, TERMS0).score; if (sc > 5) push(0.5 + sc / 200, 'ENVOY', { targetFactionId: k, kind: 'pledge' }, '위협이 커서 ' + fname(s, k) + '의 보호를 구함(점수 ' + sc + ')', 'ENVOY:' + k);
          }
        }
      }
    }
    // (6) 인사·내정: 약속한 관직, 공을 세운 장수, 빈 성주 자리, 흉흉한 민심
    for (const g of s.agreements) for (const ob of g.obs || []) if (ob.status === 'pending' && ob.kind === 'office' && ob.by === f && validate(s, f, 'REWARD', { charId: ob.charId, kind: 'office' }).ok) push(0.6, 'REWARD', { charId: ob.charId, kind: 'office' }, s.characters[ob.charId].name + '에게 약속한 관직을 내림', 'REWARD:' + ob.charId);
    for (const id in s.characters) { const c = s.characters[id]; if (c.faction === f && c.status === 'active' && id !== F.rulerId && (c.merit || 0) >= 15 && F.treasury >= K.rewardGold + reserve) push(0.45, 'REWARD', { charId: id, kind: 'gold' }, c.name + ' 공적 ' + c.merit + ': 포상', 'REWARD:' + id); }
    for (const r of mine) {
      if (r.siege || r.id === F.capitalId) continue;
      if (!lordOf(s, r) && !activeOrder(s, o => o.type === 'APPOINT' && o.params.regionId === r.id)) {
        const ok = c => c.faction === f && c.status === 'active' && !c.armyId && c.id !== F.rulerId;
        let pick = Object.values(s.characters).filter(c => ok(c) && c.loc === r.id).sort((a, b) => b.po - a.po || (a.id < b.id ? -1 : 1))[0];
        if (!pick) { const pool = Object.values(s.characters).filter(c => ok(c) && c.loc === F.capitalId).sort((a, b) => b.ld - a.ld || (a.id < b.id ? -1 : 1)); if (pool.length >= 3) pick = pool.slice(2).sort((a, b) => b.po - a.po || (a.id < b.id ? -1 : 1))[0]; }
        if (pick && validate(s, f, 'APPOINT', { regionId: r.id, charId: pick.id }).ok) push(0.3 + r.tax / 1000, 'APPOINT', { regionId: r.id, charId: pick.id }, r.name + '에 성주가 없어 ' + pick.name + '을(를) 보냄', 'APPOINT');
      }
      if (r.morale < 40 && F.treasury >= K.pacifyCost + reserve + 200 && validate(s, f, 'PACIFY', { regionId: r.id }).ok) push(0.3, 'PACIFY', { regionId: r.id }, r.name + ' 민심 ' + r.morale + ': 수습', 'PACIFY');
    }

    cands.sort((a, b) => b.u - a.u || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    let n = 0; const used = {};
    for (const c of cands) {
      if (n >= P.cap || c.u < 0.25) break;
      if (used[c.key]) continue;
      const r = issueOrder(s, f, c.type, c.params, { u: Math.round(c.u * 100) / 100, why: c.why });
      if (!r.ok) continue;
      used[c.key] = 1; n++;
      if (c.type === 'MARCH' && c.params.mission !== 'attack') mem.lastReinf[c.params.targetRegionId] = s.week;
      if (c.type === 'SCOUT') mem.lastScout[c.params.regionId] = s.week;
      if (c.type === 'ENVOY') mem.lastEnvoy[c.params.targetFactionId] = s.week;
    }
  }

  // ───────────────────────── 주간 판정 (03 문서의 10단계) ─────────────────────────
  function tick(s) {
    if (s.over) return s;
    s.week++; s.pendingResults = [];                      // 1. 예약된 명령은 발령 때 이미 검증·차감됨
    for (const f of FIDS) if (f !== s.playerFactionId) aiTurn(s, f);   // 2. AI 상황평가·명령
    stepOrders(s);                                        // 3. 외교·내정·첩보 진행
    stepEconomy(s);                                       // 4. 모집·군량·보급·사기
    stepMove(s);                                          // 5. 이동과 도착
    updateIntel(s);                                       // 6. 정찰 정보 갱신
    const cap = stepBattles(s);                           // 7. 교전·전투 판정
    stepControl(s, cap);                                  // 8. 점령·통제권 갱신
    stepPromises(s); stepPeople(s);                       // 9. 약속 이행·위반, 인물의 충성
    stepEvents(s);                                        // 10. 사건·연대기
    updateIntel(s);
    if (s.reports.length > 300) s.reports.splice(0, s.reports.length - 300);
    if (s.log.length > 3000) s.log.splice(0, s.log.length - 3000);
    return s;
  }

  // ───────────────────────── 조회 ─────────────────────────
  function factionSummary(s, f) {
    let regions = 0, troops = 0, field = 0, grain = s.factions[f].grain, income = 0, use = 0;
    for (const r of regs(s)) if (r.controller === f) { regions++; troops += total(r.garrison); grain += r.grain; income += r.tax * r.morale / 100 * (1 - r.autonomy / 100 * 0.7); use += upkeep(r.garrison) * K.garrisonGrain; }
    for (const a of armyList(s)) if (a.factionId === f) { field += total(a.units); grain += a.supply; use += upkeep(a.units); }
    let gold = 0; for (const r of regs(s)) if (r.controller === f) gold += goldUpkeep(r.garrison); for (const a of armyList(s)) if (a.factionId === f) gold += goldUpkeep(a.units);
    for (const id in s.characters) { const c = s.characters[id]; if (c.status === 'active' && c.office && c.officeBy === f) gold += K.officeSalary * c.office; }
    return { regions, troops, field, grain, income, use, gold, vassals: FIDS.filter(x => s.factions[x].alive && s.factions[x].overlord === f) };
  }
  function hash(s) { const j = JSON.stringify(s); let h = 2166136261; for (let i = 0; i < j.length; i++) { h ^= j.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }

  return {
    DATA: { REG, EDGES, FAC, FMETA, CHR, UNIT, UNITS, K, ADJ, AIP, FIDS, RIDS, KIN, HEIRS, TERMS0, OFFICE, KINDNAME, OBNAME },
    newGame, tick, issueOrder, validate, previewMarch, regionIntel, visibleArmies, acceptScore, factionSummary,
    dateOf, dateStr, jo, total, upkeep, basePower, findPath, edgeWeeks, edgeBetween, trust, atWar, sameBloc, head, hostileTo, canPass, shares, threatTo, defenseOf, hash,
    STANCE, unitEff, staff, mixPenalty, roundMath, lossRates, ambushChance, pursuitRate, supplyLink, linkedAt, goldUpkeep, simulateAssault, engById,
    negoPreview, termsText, termParts, normTerms, obligations, obText, vassalAg, truceBetween, lordOf, defiant, heirEffects, officeName, propText, probeFresh, reviseScore, marriageScore, passageScore, truceScore, aidScore,
    _deal: finalizeDeal, _decide: decide, _stepPromises: stepPromises, _stepPeople: stepPeople, _breach: breach, _addOb: addOb,
    _resolveRound: resolveRound, _zero: zero, _stepBattles: stepBattles, _stepControl: stepControl, _stepEconomy: stepEconomy,
  };
});

