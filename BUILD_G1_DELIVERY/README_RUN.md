# 실행

```bash
node build.js              # src/ → dist/index.html (의존성 없음)
# dist/index.html을 브라우저로 연다. 서버가 필요 없다.

node tests/regress_baseline.js   # 내정을 끈 엔진 = R3 엔진 (9판 × 60주)
node tests/qa.js                 # 엔진 QA 24건
node tests/qa_ui.js              # 화면 QA (Playwright + Chromium 필요)
node tests/report.js             # QA_REPORT.md 등 다시 만들기
```

- 시작 화면에서 세력·시드를 고른다. "QA fixture"를 켜면 MIL-02·SOC-03이 64%에서 시작한다(검증용).
- 달이 바뀌면 결산 화면이 뜨고 시간이 멈춘다. "정비 완료 · 진행 재개"를 눌러야 다음 주로 간다.
- 운영 배포는 하지 않았다. `preview.html`은 `dist/index.html`의 사본이다.
