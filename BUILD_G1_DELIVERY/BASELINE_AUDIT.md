# BASELINE_AUDIT — 착수 전 기준선 조사

- 저장소: `ladina1217ab/trpg-firest-project`, 브랜치 `claude/confluence-baekje-strategy-space-hcqyme`. 착수 시점에 **커밋이 하나도 없는 빈 저장소**였다. 미커밋 파일·세이브 없음.
- 따라서 기존 P0-R 소스는 저장소가 아니라 사용자가 지정한 아티팩트(`후삼국: 천하의 주인 R3`, 단일 HTML 261KB)다. 이 파일을 `baseline/hsg_p0r_r3.html`에 그대로 보존하고 첫 커밋으로 남겼다. 새 프로젝트를 만들지 않고 이 코드를 `src/`로 나눠 증분 수정했다.
- 작업지시서가 제안한 브랜치명 `feature/sgk-build-g1-domestic-vslice` 대신, 이 세션에 지정된 위 브랜치에서 작업했다.
- 구동: 빌드 도구 없음. HTML 한 장에 CSS·엔진(`Sim`, UMD)·UI가 들어 있다. 환경 변수 없음. 기존 자동 테스트 없음.

## 코드로 확인한 P0-R 기능

| 항목 | 확인 결과 |
|---|---|
| 초기 상태 | 8세력·20거점·인물 26명·연결 33개. 고려/후백제/고창 선택. 국고 1200/1400/250 |
| 시간 | 주 단위 `tick()` 10단계, 60주. **달력은 `dateOf(week)`가 4주를 한 달로 센다** |
| 명령 | `validate()`→`issueOrder()` 공용 경로 18종. AI도 같은 경로 |
| 군사 | 병종 4개(`light/heavy/archer/cav`), 편성·행군·포위·매복·추격, 240회 모의 예상 |
| 외교 | 귀부 약정(Agreement)·조건 협상·혼인·통행·휴전·원군·동원·약속 장부 |
| 인사 | 성주 임명(`APPOINT`→`Region.lord`), 포상·관직·후계 |
| 경제 | 주간 세수 `tax×morale/100×(1−autonomy/100×0.7)`, 수확 4·52주, 급료·봉록·상납. **원장 없음** |
| 저장 | localStorage, 스키마 `v:3` |

## 명세와 실제 코드의 충돌·호환성 메모

1. **달력**: 명세는 "4주 고정 월 금지"를 요구하지만 기존 엔진의 달력 자체가 4주=1달이다. 달력을 고치면 기존 60주 캠페인이 달라지므로 그대로 두었다. 대신 결산은 `week % 4`가 아니라 달력 함수(`monthKey`)가 바뀌는 순간에만 일어나게 했다. 달력을 바꾸면 결산이 따라간다. 기존 달력에서는 주간 틱이 달을 가로지르지 않는다.
2. **병종 ID**: 문서의 `light_inf/heavy_inf/cavalry`는 코드에서 `light/heavy/cav`다. 코드 ID를 유지하고 대응표를 `BALANCE_DRAFT.json`의 `mapping`에 두었다. 신형 중장보병은 `adv`(문서 ID `advanced_heavy_inf`).
3. **필드명**: 문서의 `controllerId/nominalOverlordId/localLordId`는 코드의 `controller/overlord/lord`다. 이름을 바꾸지 않았다.
4. **민생행복도**: G01의 정의대로 기존 `Region.morale`(민심)과 같은 값으로 쓴다. 안정도·훈련도·불만은 새 값이다.
5. **원 P0-R QA-01~12 목록과 10개 화면 정의**는 저장소·아티팩트에 없다. 회귀는 "내정을 끈 새 엔진 = R3 엔진" 동등성 비교로 대신했다.
6. 05-1 상수 중 엔진과 다르다고 표시된 키(`breach.trust` 등)는 손대지 않았다.

## 기준선 캡처

`tests/baseline_sim_r3.js`(아티팩트에서 뽑은 엔진 원본)로 3세력×시드 3개×60주를 돌린 결과를 새 엔진과 주마다 비교한다(`tests/regress_baseline.js`).
