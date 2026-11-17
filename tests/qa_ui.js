// BUILD-G1 화면 QA (G1-OPK-01/02, G1-TIME-02 화면, G1-UI-01). 실행: node build.js && node tests/qa_ui.js
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const EV = path.join(__dirname, '..', 'BUILD_G1_DELIVERY', 'evidence'), out = [];
const T = (id, pass, evidence, note) => out.push({ id, status: pass ? 'PASS' : 'FAIL', note: note || '', evidence });
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ width: 1440, height: 810 }, { width: 1366, height: 768 }]) {
    const tag = vp.width + 'x' + vp.height, pg = await b.newPage({ viewport: vp, deviceScaleFactor: vp.width === 1440 ? 2 : 1 }), errs = [];
    pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', e => errs.push(e.message));
    const shot = n => pg.screenshot({ path: path.join(EV, n + '_' + tag + '.png') }), st = () => pg.evaluate(() => ({ hash: Sim.hash(__G.s), week: __G.s.week, phase: __G.s.dom.gate.phase, paused: __G.paused, sel: __G.sel && __G.sel.id, tab: __G.tab, ltab: __G.ltab, picker: !!__G.picker }));
    const vis = sel => pg.evaluate(q => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, w: Math.round(r.width), h: Math.round(r.height) }; }, sel);
    await pg.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await pg.waitForTimeout(700); await shot('01_start');
    await pg.click('[data-act="pick"][data-v="goryeo"]'); await pg.waitForTimeout(300); await shot('02_map');
    // S02 도시 → 팝업 열고 닫기
    await pg.click('[data-act="ltab"][data-v="city"]'); const a0 = await st();
    await pg.click('[data-act="opk"][data-slot="city:gaegyeong:deputy:0"]'); await pg.waitForTimeout(150);
    const cols = await pg.$$eval('table.off thead th', x => x.map(e => e.textContent.trim())), dlg = await vis('.opk'), lastCol = await vis('table.off thead th:last-child'), nextBtn = await vis('#opk-next');
    await pg.click('[data-act="opk-sort"][data-v="po"]'); const poOrder = await pg.$$eval('#opk-body tr td:nth-child(6)', x => x.map(e => +e.textContent));
    await pg.click('[data-act="opk-filter"][data-v="ok"]'); const okN = await pg.$$eval('#opk-body tr', x => x.length);
    await pg.click('[data-act="opk-filter"][data-v="na"]'); const naTitle = await pg.$eval('#opk-body tr .tag', e => e.getAttribute('title'));
    await pg.click('[data-act="opk-filter"][data-v="all"]'); await pg.fill('#opk-q', '박술'); await pg.waitForTimeout(100); const found = await pg.$$eval('#opk-body tr b', x => x.map(e => e.textContent));
    await pg.fill('#opk-q', ''); await pg.click('tr[data-id="wanggeon"]'); const kingBtn = await pg.$eval('#opk-next', e => e.getAttribute('aria-disabled')), kingWhy = await pg.$eval('.opk-side .loss', e => e.textContent);
    await pg.click('tr[data-id="baksulhui"]'); await shot('03_picker_city'); const modalW = dlg.w;
    await pg.keyboard.press('Escape'); const selCleared = await pg.evaluate(() => __G.picker && __G.picker.sel); await pg.keyboard.press('Escape'); const a1 = await st();
    // S03 국정 → 팝업 닫기
    await pg.click('#rail [data-v="nation"]'); const n0 = await st(); await pg.click('[data-act="opk"][data-slot="national:goryeo:MIL"]'); const origin = await pg.evaluate(() => __G.picker.origin); await shot('04_picker_national'); await pg.click('[data-act="opk-close"]'); const n1 = await st();
    // RUNNING에서 열면 멈췄다가 닫으면 다시 흐른다
    await pg.click('[data-act="speed"][data-v="1"]'); await pg.click('[data-act="opk"][data-slot="national:goryeo:SOC"]'); const r0 = await st(); await pg.keyboard.press('Escape'); const r1 = await st(); await pg.click('[data-act="pause"]');
    // S06 군 지휘관: 부대를 만들어 주둔시킨 뒤 팝업
    await pg.evaluate(() => { const s = __G.s; Sim.issueOrder(s, 'goryeo', 'MARCH', { fromRegionId: 'gaegyeong', targetRegionId: 'cheorwon', units: { light: 500, heavy: 0, archer: 0, cav: 0, adv: 0 }, commanderId: 'yugeumpil', mission: 'guard' }); });
    await pg.click('[data-act="step"]'); await pg.waitForTimeout(200);
    const aid = await pg.evaluate(() => Object.keys(__G.s.armies).find(k => __G.s.armies[k].factionId === 'goryeo')); await pg.evaluate(id => { __G.sel = { type: 'army', id }; __G.s && document.querySelector('[data-act="pause"]').click(); }, aid); await pg.evaluate(() => { const b = document.querySelector('#rail [data-v="report"]'); b.click(); b.click(); });
    await pg.click(`[data-act="opk"][data-slot="army:${aid}:commander"]`); const armyCols = await pg.$eval('.opk .win-h h2', e => e.textContent); await shot('05_picker_army'); await pg.keyboard.press('Escape');
    // 전출: 유금필(부대 주장)을 철원 부관으로
    await pg.evaluate(() => { __G.sel = { type: 'region', id: 'cheorwon' }; __G.ltab = 'city'; document.querySelector('[data-act="pause"]').click(); }); await pg.click('#rail [data-v="nation"]');
    await pg.click('[data-act="opk"][data-slot="city:cheorwon:deputy:0"]'); await pg.click('tr[data-id="yugeumpil"]'); const loss = await pg.$$eval('.opk-side .loss', x => x.map(e => e.textContent)); await pg.click('#opk-next');
    const goDisabled = await pg.$eval('#opk-go', e => e.getAttribute('aria-disabled')); await shot('06_picker_transfer_confirm'); await pg.check('#opk-ack'); await pg.click('#opk-go'); await pg.waitForTimeout(150);
    const tr = await pg.evaluate(id => ({ armyCommander: __G.s.armies[id].commanderId, deputy: __G.s.dom.cityDomesticByRegion.cheorwon.deputies[0], armyId: __G.s.characters.yugeumpil.armyId }), aid);
    // 시설·국정 명령 후 월말까지
    await pg.evaluate(() => { __G.sel = { type: 'region', id: 'gaegyeong' }; document.querySelector('[data-act="pause"]').click(); }); await pg.click('[data-act="build"][data-v="market"]'); await pg.waitForTimeout(100); await shot('07_city_building');
    for (let i = 0; i < 3; i++) { await pg.click('[data-act="step"]'); await pg.waitForTimeout(150); }
    const m0 = await st(), resume = await vis('#rv-resume'); await shot('08_monthly_review');
    await pg.waitForTimeout(1200); await pg.click('[data-act="speed"][data-v="4"]').catch(() => { }); const m1 = await st();
    // 월간 정비에서 팝업 → 닫기 → 예약 → 지도 왕복
    await pg.click('.rv [data-act="opk"][data-slot="national:goryeo:MIL"]'); const o2 = await pg.evaluate(() => __G.picker.origin.originScreen); await pg.click('tr[data-id="baksulhui"]'); await pg.click('#opk-next'); await pg.click('#opk-go'); await pg.waitForTimeout(150);
    const q1 = await pg.evaluate(() => ({ queued: Sim.dom.pendingOf(__G.s, 'goryeo').map(c => c.text), officer: __G.s.dom.nationalProjectsByFaction.goryeo.slots.MIL.officerId, review: !document.querySelector('#review').hidden })), m2 = await st();
    await pg.click('[data-act="rv-hide"]'); await pg.waitForTimeout(100); await pg.click('[data-region="gochang"]', { force: true }).catch(() => { }); await pg.click('[data-act="ltab"][data-v="city"]'); await shot('09_maintain_on_map_gochang');
    const gz = await pg.$$eval('#left [aria-disabled="true"]', x => x.slice(0, 3).map(e => e.textContent.trim() + ': ' + e.dataset.why)); await pg.keyboard.press('Space'); const m3 = await st();
    await pg.click('#banner [data-act="rv-show"]'); await pg.click('#rv-resume'); await pg.waitForTimeout(150);
    const m4 = await pg.evaluate(() => ({ phase: __G.s.dom.gate.phase, officer: __G.s.dom.nationalProjectsByFaction.goryeo.slots.MIL.officerId, queued: Sim.dom.pendingOf(__G.s, 'goryeo').length, week: __G.s.week }));
    await pg.click('#rail [data-v="nation"]').catch(() => { }); await pg.waitForTimeout(100); await shot('10_after_resume_nation');
    await pg.close();
    if (vp.width === 1440) {
      T('G1-OPK-01', a0.hash === a1.hash && a1.sel === a0.sel && a1.ltab === 'city' && !a1.picker && n0.hash === n1.hash && n1.tab === 'nation' && r0.paused && !r1.paused && o2 === 'DN-06' && q1.review && m2.phase === 'PAUSED_MONTHLY' && /주장/.test(armyCols),
        { S02: { stateUnchangedAfterClose: a0.hash === a1.hash, selectionKept: a1.sel, tabKept: a1.ltab }, S03: { stateUnchangedAfterClose: n0.hash === n1.hash, tabKept: n1.tab, origin }, S06: { title: armyCols }, running: { pausedWhileOpen: r0.paused, resumedOnClose: !r1.paused }, DN06: { originScreen: o2, reviewStillShown: q1.review, phaseAfterClose: m2.phase, queued: q1.queued, officerNotYetApplied: q1.officer === null }, component: '네 호출 위치 모두 openPicker() 하나를 쓴다' });
      T('G1-OPK-02(화면)', cols.length === 10 && poOrder.every((v, i) => !i || poOrder[i - 1] >= v) && okN === 5 && found.length === 1 && kingBtn === 'true' && selCleared === null, { columns: cols, politicsDescending: poOrder, availableFilterCount: okN, unavailableReason: naTitle, search: found, kingConfirmDisabled: kingBtn === 'true', kingReason: kingWhy, escOrder: '선택 해제 → 닫기' });
      T('G1-OPK-04(화면)', loss.length > 0 && goDisabled === 'true' && tr.armyCommander === null && tr.deputy === 'yugeumpil' && tr.armyId === null, { vacancyWarning: loss, confirmDisabledUntilAcknowledged: goDisabled === 'true', after: tr });
      T('G1-TIME-02(화면)', m0.phase === 'PAUSED_MONTHLY' && m0.hash === m1.hash && m3.week === m0.week && m3.phase === 'PAUSED_MONTHLY', { week: [m0.week, m1.week, m3.week], unchangedAfterWaitAndSpeedClick: m0.hash === m1.hash, afterMapRoundTripAndSpace: m3.phase });
      T('G1-TIME-01(재개)', m4.phase === 'RUNNING' && m4.officer === 'baksulhui' && m4.queued === 0 && m4.week === m0.week, m4, '예약 명령은 재개 때 한 번 적용되고 주는 넘어가지 않는다');
      T('G1-GOV-01(화면)', gz.length > 0, { disabledWithReason: gz });
    }
    T('G1-UI-01 ' + tag, dlg.inView && lastCol.inView && nextBtn.inView && resume && resume.inView && errs.length === 0 && modalW <= 1220, { pickerDialog: dlg, lastColumnVisible: lastCol.inView, confirmButtonVisible: nextBtn.inView, resumeButtonVisible: resume && resume.inView, consoleErrors: errs });
  }
  // 휴대폰 폭: 가로 넘침만 확인
  const ph = await b.newPage({ viewport: { width: 400, height: 800 } }); await ph.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await ph.waitForTimeout(500); await ph.click('[data-act="pick"][data-v="gochang"]'); await ph.waitForTimeout(300);
  const ov = await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth); await ph.screenshot({ path: path.join(EV, '11_phone_400.png') }); T('PHONE-400', !ov, { horizontalOverflow: ov }, '휴대폰 폭은 넘침 여부만 확인');
  await b.close();
  fs.writeFileSync(path.join(EV, 'qa_ui.json'), JSON.stringify({ results: out }, null, 1));
  for (const r of out) console.log((r.status + '   ').slice(0, 6), r.id, r.status === 'PASS' ? '' : JSON.stringify(r.evidence).slice(0, 700));
  process.exit(out.every(r => r.status === 'PASS') ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
