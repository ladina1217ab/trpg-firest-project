# BUILD-G1 QA 보고

시드 929 고정. 엔진 테스트는 `node tests/qa.js`, 화면 테스트는 `node tests/qa_ui.js`(Chromium)로 다시 돌릴 수 있다. 증거 원본은 `evidence/qa_engine.json`, `evidence/qa_ui.json`, 스크린샷은 `evidence/*.png`.

**25/25 PASS.** 이 표는 자동 테스트 판정이다. 사람이 해 본 플레이테스트와 GQS 점수는 없다(미측정).

| QA ID | 판정 | 실행한 테스트 | 비고 |
|---|---|---|---|
| G1-BASE-01 | PASS | G1-BASE-01 [엔진] |  |
| G1-ECON-01 | PASS | G1-ECON-01 [엔진] |  |
| G1-ECON-02 | PASS | G1-ECON-02 [엔진] |  |
| G1-TIME-01 | PASS | G1-TIME-01 [엔진], G1-TIME-01(재개) [화면] | 예약 명령은 재개 때 한 번 적용되고 주는 넘어가지 않는다 |
| G1-TIME-02 | PASS | G1-TIME-02 [엔진], G1-TIME-02(화면) [화면] |  |
| G1-TIME-03 | PASS | G1-TIME-03 [엔진] |  |
| G1-TIME-04 | PASS | G1-TIME-04 [엔진] |  |
| G1-OPK-01 | PASS | G1-OPK-01 [화면] |  |
| G1-OPK-02 | PASS | G1-OPK-02 [엔진], G1-OPK-02(화면) [화면] |  |
| G1-OPK-03 | PASS | G1-OPK-03 [엔진] |  |
| G1-OPK-04 | PASS | G1-OPK-04 [엔진], G1-OPK-04(화면) [화면] |  |
| G1-GOV-01 | PASS | G1-GOV-01 [엔진], G1-GOV-01(화면) [화면] |  |
| G1-GOV-02 | PASS | G1-GOV-02 [엔진] |  |
| G1-GOV-03 | PASS | G1-GOV-03 [엔진] |  |
| G1-CITY-01 | PASS | G1-CITY-01 [엔진] |  |
| G1-CITY-02 | PASS | G1-CITY-02 [엔진] |  |
| G1-NAT-01 | PASS | G1-NAT-01 [엔진] |  |
| G1-NAT-02 | PASS | G1-NAT-02 [엔진] |  |
| G1-NAT-03 | PASS | G1-NAT-03 [엔진] |  |
| G1-NAT-04 | PASS | G1-NAT-04 [엔진] |  |
| G1-AI-01 | PASS | G1-AI-01 [엔진] |  |
| G1-DETER-01 | PASS | G1-DETER-01 [엔진] |  |
| G1-PLAY-01 | PASS | G1-PLAY-01 [엔진] | 고정 각본 자동 플레이 결과다. 사람이 느끼는 재미·이해도(11.1의 질문)와 GQS는 측정하지 않았다. |
| G1-REG-01 | PASS | G1-REG-01 [엔진] | 원 P0-R QA-01~12 목록은 이 저장소에 없다. 대신 내정을 끈 새 엔진이 R3 기준선 엔진과 60주 동안 같은 상태(연대기·세력·거점·신뢰)를 내는지 9판 비교했다. |
| G1-UI-01 | PASS | G1-UI-01 1440x810 [화면], G1-UI-01 1366x768 [화면] |  |

추가로 돌린 것: SAVE-MIGRATION PASS, PHONE-400 PASS
