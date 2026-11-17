// BUILD-G1 QA: 작업지시서 11항의 QA ID를 시드 고정으로 실행하고 증거를 남긴다.
// 실행: node tests/qa.js  →  BUILD_G1_DELIVERY/evidence/qa_engine.json
const fs = require('fs'), path = require('path');
const B = require('./baseline_sim_r3.js'), S = require('../src/sim.js'), Dm = require('../src/domestic.js'), REG = require('./regress_baseline.js');
const SEED = 929, EPS = 1e-6, out = [];
const ng = (pf, o) => S.newGame(pf, SEED, o);
const resume = s => S.issueOrder(s, s.playerFactionId, 'RESUME_FROM_MONTHLY_PAUSE', {});
const paused = s => s.dom.gate.phase === 'PAUSED_MONTHLY';
function run(s, n) { for (let i = 0; i < n && !s.over; i++) { if (paused(s)) resume(s); S.tick(s); } return s; }
function toPause(s) { let g = 0; while (!paused(s) && !s.over && g++ < 80) S.tick(s); return s; }
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const clone = s => JSON.parse(JSON.stringify(s));
const r2 = v => Math.round(v * 100) / 100;
function T(id, fn) { let r; try { r = fn(); } catch (e) { r = { pass: false, evidence: { error: String(e && e.stack || e).split('\n').slice(0, 4).join(' | ') } }; } out.push({ id, status: r.blocked ? 'BLOCKED' : r.pass ? 'PASS' : 'FAIL', note: r.note || '', evidence: r.evidence }); }
const cmd = (s, t, p) => Dm.command(s, s.playerFactionId, t, p);

T('G1-BASE-01', () => {
  const ev = [], ok = [];
  for (const pf of ['goryeo', 'hubaekje', 'gochang']) {
    const s = ng(pf), b = B.newGame(pf, SEED);
    const units4 = S.DATA.UNITS.slice(0, 4).join(',') === B.DATA.UNITS.join(',') && B.DATA.UNITS.every(k => JSON.stringify(S.DATA.UNIT[k]) === JSON.stringify(B.DATA.UNIT[k]));
    const same = ['goryeo', 'hubaekje', 'gochang'].every(f => s.factions[f].treasury === b.factions[f].treasury && s.factions[f].grain === b.factions[f].grain);
    const garr = Object.keys(b.regions).every(r => B.DATA.UNITS.every(k => s.regions[r].garrison[k] === b.regions[r].garrison[k]) && s.regions[r].garrison.adv === 0);
    run(s, 3); const ai = s.log.filter(l => l.ok && l.faction !== pf).length;
    const e = { player: pf, factions: Object.keys(s.factions).length, regions: Object.keys(s.regions).length, characters: Object.keys(s.characters).length, units4Unchanged: units4, treasury: [s.factions.goryeo && b.factions.goryeo.treasury, b.factions.hubaekje.treasury, b.factions.gochang.treasury], initialSameAsBaseline: same, garrisonSameAsBaseline: garr, aiOrdersIn3Weeks: ai };
    ev.push(e); ok.push(e.factions === 8 && e.regions === 20 && e.characters === 26 && units4 && same && garr && ai > 0);
  }
  return { pass: ok.every(Boolean), evidence: ev };
});

T('G1-ECON-01', () => {
  const s = ng('goryeo'); toPause(s); const rows = []; let pass = s.week === 4;
  for (const f of S.DATA.FIDS) {
    const lg = S.ledgerSum(s, f, [0, 1, 2, 3]), snap = Dm.viewSettlement(s, f, '0929-10'), F = s.factions[f];
    const dGold = F.treasury - snap.resourceDelta.gold.open, dGrain = S.holdings(s, f) - snap.resourceDelta.grain.open;
    const okG = Math.abs(sum(lg.gold) - dGold) < EPS, okR = Math.abs(sum(lg.grain) - dGrain) < EPS, etc = Math.abs(lg.gold.etc || 0) < EPS;
    const later = Object.keys(s.ledger[f] || {}).filter(w => +w > 3).length === 0; // 결산 뒤에 붙은 입금이 없다
    const snapOk = Math.abs(snap.resourceDelta.gold.close - F.treasury) < EPS && JSON.stringify(snap.ledger.gold) === JSON.stringify(lg.gold);
    pass = pass && okG && okR && etc && later && snapOk;
    rows.push({ faction: f, goldLedgerSum: r2(sum(lg.gold)), goldActualDelta: r2(dGold), grainLedgerSum: r2(sum(lg.grain)), grainActualDelta: r2(dGrain), goldUnclassified: r2(lg.gold.etc || 0), grainUnclassified: r2(lg.grain.etc || 0), entriesAfterSettlement: !later, gold: Object.fromEntries(Object.entries(lg.gold).map(([k, v]) => [k, r2(v)])), grain: Object.fromEntries(Object.entries(lg.grain).map(([k, v]) => [k, r2(v)])) });
  }
  return { pass, evidence: { month: '0929-10', weeks: [0, 1, 2, 3], rows } };
});

T('G1-ECON-02', () => {
  const s = ng('goryeo'); toPause(s); s.factions.goryeo.treasury = 60; s.ledgerBase.goryeo.gold = 60; // 국고 60 상황 fixture
  const a = cmd(s, 'START_FACILITY_BUILD', { regionId: 'gaegyeong', facility: 'market' }), b = cmd(s, 'START_FACILITY_BUILD', { regionId: 'cheorwon', facility: 'market' });
  const reserved = Dm.reservedOf(s, 'goryeo'), t0 = s.factions.goryeo.treasury, r = resume(s), t1 = s.factions.goryeo.treasury;
  const s2 = ng('goryeo'); s2.factions.goryeo.treasury = 60; s2.ledgerBase.goryeo.gold = 60;
  const c = cmd(s2, 'START_FACILITY_BUILD', { regionId: 'gaegyeong', facility: 'market' }), d = cmd(s2, 'START_FACILITY_BUILD', { regionId: 'cheorwon', facility: 'market' });
  run(s, 6); const minT = Math.min(...S.DATA.FIDS.map(f => s.factions[f].treasury));
  return { pass: a.ok && a.queued && !b.ok && reserved === 60 && t0 === 60 && t1 === 0 && r.committed === 1 && c.ok && !d.ok && s2.factions.goryeo.treasury === 0 && minT >= 0,
    evidence: { paused: { first: a, second: b, reservedGold: reserved, treasuryWhileQueued: t0, treasuryAfterResume: t1, resume: r }, running: { first: c.ok, second: d, treasury: s2.factions.goryeo.treasury }, minTreasuryAllFactionsAfter6Weeks: r2(minT) } };
});

T('G1-TIME-01', () => {
  const s = ng('goryeo'), dates = []; for (let i = 0; i < 4; i++) { S.tick(s); dates.push(S.dateStr(s.week) + ':' + s.dom.gate.phase); }
  const ids = Object.keys(s.dom.settlements).filter(k => k.indexOf(':goryeo:') > 0), h = S.hash(s);
  for (let i = 0; i < 5; i++) S.tick(s);
  return { pass: s.week === 4 && paused(s) && ids.length === 1 && ids[0] === 'S04_0929_10:goryeo:0929-10' && s.dom.settlements[ids[0]].finalized && h === S.hash(s) && s.dom.gate.nextUnprocessedTickId === 'tick_5',
    evidence: { timeline: dates, settlementIds: ids, gate: s.dom.gate, weekAfter5MoreTickCalls: s.week, hashUnchanged: h === S.hash(s), calendarNote: '달 경계는 dateOf()가 정한다. 기존 P0-R 달력은 한 달이 4주라 주간 틱이 달을 가로지르지 않는다.' } };
});

T('G1-TIME-02', () => {
  const s = ng('goryeo'); toPause(s); const h = S.hash(s), w = s.week, t = s.factions.goryeo.treasury, g = S.holdings(s, 'goryeo'), logN = s.log.length;
  for (let i = 0; i < 600; i++) { S.tick(s); Dm.cityView(s, 'goryeo', i % 2 ? 'gaegyeong' : 'gochang'); Dm.nationalView(s, 'goryeo'); Dm.viewSettlement(s, 'goryeo', '0929-10'); Dm.candidates(s, 'goryeo', 'city:gaegyeong:deputy:0', 'commerce'); }
  return { pass: h === S.hash(s) && s.week === w && s.log.length === logN, evidence: { tickCallsWhilePaused: 600, week: [w, s.week], treasury: [t, s.factions.goryeo.treasury], grain: [g, S.holdings(s, 'goryeo')], aiOrdersLogged: s.log.length - logN, hashUnchanged: h === S.hash(s) } };
});

T('G1-TIME-03', () => {
  const s = ng('goryeo'); toPause(s);
  cmd(s, 'SET_CITY_FOCUS', { regionId: 'gaegyeong', domain: 'commerce' }); cmd(s, 'START_FACILITY_BUILD', { regionId: 'gaegyeong', facility: 'market' });
  const h0 = S.hash(s), v = [1, 2, 3].map(() => JSON.stringify(Dm.viewSettlement(s, 'goryeo', '0929-10'))), h1 = S.hash(s);
  const loaded = S.migrate(clone(s)), same = JSON.stringify(loaded) === JSON.stringify(s), again = JSON.stringify(S.migrate(clone(loaded))) === JSON.stringify(loaded);
  const s2 = ng('goryeo'); toPause(s2); const replay = JSON.stringify(Dm.viewSettlement(s2, 'goryeo', '0929-10')) === v[0];
  resume(loaded); resume(s); run(loaded, 6); run(s, 6);
  return { pass: h0 === h1 && v[0] === v[1] && v[1] === v[2] && same && again && replay && S.hash(loaded) === S.hash(s),
    evidence: { settlementId: JSON.parse(v[0]).settlementId, viewedTimes: 3, stateHashBeforeAfterViews: [h0, h1], saveLoadIdentical: same, saveLoadSaveIdentical: again, queuedCommands: Dm.pendingOf(loaded, 'goryeo').length, sameSeedReplayIdentical: replay, continuedAfterLoadSameHash: S.hash(loaded) === S.hash(s) } };
});

T('G1-TIME-04', () => {
  const s = ng('goryeo', { autoPauseMonthly: false }); let everPaused = false; for (let i = 0; i < 9; i++) { S.tick(s); everPaused = everPaused || paused(s); }
  const keys = Dm.settlementKeys(s, 'goryeo');
  return { pass: s.week === 9 && !everPaused && keys.length === 2, evidence: { week: s.week, everPaused, settlements: keys } };
});

T('G1-OPK-02', () => { // 팝업이 쓰는 후보 목록의 내용(엔진 쪽). 정렬·필터 조작은 UI 테스트가 본다
  const s = ng('goryeo'), list = Dm.candidates(s, 'goryeo', 'city:gaegyeong:deputy:0', 'commerce'), by = list.slice().sort((a, b) => b.c.po - a.c.po);
  const cols = by.map(x => ({ name: x.c.name, 현직: x.primary ? x.primary.label : '없음', 통솔: x.c.ld, 무력: x.c.ma, 지략: x.c.st, 정치: x.c.po, 신망: x.c.pr, 충성: x.c.loyalty, 적성: x.fit, 상태: x.status.code, 사유: x.status.reason }));
  const sorted = by.every((x, i) => !i || by[i - 1].c.po >= x.c.po), reasons = list.filter(x => !x.status.ok).every(x => x.status.reason.length > 0);
  return { pass: list.length === 6 && sorted && reasons && cols[0].상태 === 'KING_ROLE', evidence: cols };
});

T('G1-OPK-03', () => {
  const s = ng('goryeo'), h = S.hash(s), v = S.validate(s, 'goryeo', 'ASSIGN_CITY_OFFICER', { regionId: 'gaegyeong', slot: 'deputy:0', charId: 'wanggeon', domain: 'commerce' });
  const r = cmd(s, 'ASSIGN_CITY_OFFICER', { regionId: 'gaegyeong', slot: 'deputy:0', charId: 'wanggeon', domain: 'commerce' });
  const cd = s.dom.cityDomesticByRegion.gaegyeong;
  return { pass: !v.ok && v.code === 'KING_ROLE' && !r.ok && cd.deputies[0] === null && cd.governor === null && s.regions.gaegyeong.lord === 'wanggeon',
    evidence: { validate: v, command: r.ok, note: '왕건(정치 90)은 개경의 정치적 성주(Region.lord)로 남고 실무 성주·부관 자리는 비어 있다.', localLord: s.regions.gaegyeong.lord, governorOfficer: cd.governor } };
});

T('G1-OPK-04', () => {
  const s = ng('goryeo');
  const m = S.issueOrder(s, 'goryeo', 'MARCH', { fromRegionId: 'gaegyeong', targetRegionId: 'cheorwon', units: { light: 500, heavy: 0, archer: 0, cav: 0, adv: 0 }, commanderId: 'yugeumpil', mission: 'guard' });
  run(s, 1); const a = s.armies[m.armyId], before = { army: a && a.commanderId, armyLoc: a && a.loc, primary: Dm.primaryOf(s, 'yugeumpil') };
  const eff = Dm.assignEffect(s, 'goryeo', 'city:cheorwon:deputy:0', 'yugeumpil', 'military'), e0 = Dm.domainEff(s, 'cheorwon', 'military');
  const st = Dm.candidateStatus(s, 'goryeo', 'city:cheorwon:deputy:0', 'yugeumpil');
  const r = cmd(s, 'ASSIGN_CITY_OFFICER', { regionId: 'cheorwon', slot: 'deputy:0', charId: 'yugeumpil', domain: 'military' });
  const c = s.characters.yugeumpil, cd = s.dom.cityDomesticByRegion.cheorwon, e1 = Dm.domainEff(s, 'cheorwon', 'military');
  let jobs = 0; if (c.armyId) jobs++; if (s.dom.assignments.yugeumpil) jobs++;
  for (const id in s.armies) if (s.armies[id].commanderId === 'yugeumpil' || (s.armies[id].deputyIds || []).indexOf('yugeumpil') >= 0) jobs++;
  const bad = cmd(s, 'ASSIGN_CITY_OFFICER', { regionId: 'gochang', slot: 'deputy:0', charId: 'yugeumpil', domain: 'military' }); // 실패하면 이전 보직 유지
  return { pass: st.code === 'TRANSFER_REQUIRED' && r.ok && a.commanderId === null && c.armyId === null && cd.deputies[0] === 'yugeumpil' && jobs === 1 && e1 > e0 && !bad.ok && cd.deputies[0] === 'yugeumpil',
    evidence: { before, status: st.code, effect: eff, after: { armyCommander: a.commanderId, armyStillExists: !!s.armies[m.armyId], characterArmyId: c.armyId, primary: Dm.primaryOf(s, 'yugeumpil'), cheorwonDeputies: cd.deputies, primaryJobCount: jobs }, cheorwonMilitaryEff: [r2(e0), r2(e1)], failedTransferKeepsOldPost: { ok: bad.ok, reason: bad.reason, stillDeputy: cd.deputies[0] } } };
});

T('G1-GOV-01', () => {
  const s = ng('goryeo'); S._int.leaveOverlord(s, 'gochang', 'goryeo', 'gochang'); const rt = Dm.rights(s, 'goryeo', 'gochang'), h = S.hash(s);
  const tries = { ASSIGN_CITY_OFFICER: { regionId: 'gochang', slot: 'governor', charId: 'baksulhui' }, START_FACILITY_BUILD: { regionId: 'gochang', facility: 'market' }, RECRUIT: { regionId: 'gochang', unit: 'light', count: 100 }, SET_CITY_FOCUS: { regionId: 'gochang', domain: 'commerce' }, REQUEST_GOVERNANCE_CHANGE: { regionId: 'gochang', to: 'DIRECT', force: true } };
  const res = {}; let allRejected = true; for (const t in tries) { const r = S.validate(s, 'goryeo', t, tries[t]); res[t] = { ok: r.ok, reason: r.reason }; allRejected = allRejected && !r.ok; }
  const view = Dm.cityView(s, 'goryeo', 'gochang'), gift = S.validate(s, 'goryeo', 'ENVOY', { targetFactionId: 'gochang', kind: 'gift' }), offer = S.validate(s, 'goryeo', 'ENVOY', { targetFactionId: 'gochang', kind: 'offer', terms: {} }), scout = S.validate(s, 'goryeo', 'SCOUT', { regionId: 'gochang' });
  return { pass: rt.mode === 'INDEPENDENT' && allRejected && !!view && gift.ok && offer.ok && scout.ok, evidence: { mode: rt.mode, rejected: res, allowed: { viewCity: !!view, envoyGift: gift.ok, envoySubmissionOffer: offer.ok, scout: scout.ok } } };
});

T('G1-GOV-02', () => {
  const s = ng('goryeo', { autoPauseMonthly: false }); const m = () => { const a = Dm.adminOf(s, 'goryeo'), rt = Dm.rights(s, 'goryeo', 'gochang'), ag = S.vassalAg(s, 'goryeo', 'gochang'); return { mode: rt.mode, canAppoint: rt.can, burden: r2(a.burden), weeklyAdminCost: a.expense, terms: ag && ag.terms, vassalAgreements: s.agreements.filter(g => g.active && g.type === 'vassal' && g.parties[0] === 'goryeo' && g.parties[1] === 'gochang').length }; };
  const auto = m(); auto.appoint = S.validate(s, 'goryeo', 'ASSIGN_CITY_OFFICER', { regionId: 'gochang', slot: 'governor', charId: 'baksulhui' }).ok; auto.recruit = S.validate(s, 'goryeo', 'RECRUIT', { regionId: 'gochang', unit: 'light', count: 100 }).ok;
  run(s, 2); const tribBefore = (S.ledgerSum(s, 'goryeo', [0, 1]).gold.tribute || 0);
  S._deal(s, 'direct', 'goryeo', 'gochang', { regionId: 'gochang' }); run(s, 5); // 합의 직할(협상 수락 경로) → 4주 전환
  const direct = m(); direct.appoint = S.validate(s, 'goryeo', 'ASSIGN_CITY_OFFICER', { regionId: 'gochang', slot: 'governor', charId: 'baksulhui' }).ok;
  direct.callArms = S.validate(s, 'goryeo', 'CALL_ARMS', { vassalId: 'gochang', regionId: 'gugwon' }).reason || 'ok';
  run(s, 2); const w = s.week - 1, tk = (s.ledger.goryeo[w]['gold:tribute'] || 0), tg = s.ledger.gochang[w]['gold:tribute'] || 0;
  direct.controllerStillGochang = s.regions.gochang.controller === 'gochang'; direct.garrisonStillGochang = S.total(s.regions.gochang.garrison) > 0;
  return { pass: auto.mode === 'AUTONOMOUS' && !auto.canAppoint && !auto.appoint && !auto.recruit && direct.mode === 'DIRECT' && direct.canAppoint && direct.appoint && direct.burden > auto.burden && direct.weeklyAdminCost > auto.weeklyAdminCost && direct.terms.autonomy === 'direct' && direct.terms.mobilize === true && direct.vassalAgreements === 1 && tribBefore === 0 && tk > 0 && Math.abs(tk + tg) < EPS && direct.controllerStillGochang,
    evidence: { autonomous: auto, direct, tributeWeekly: { beforeDirect: tribBefore, goryeoReceives: r2(tk), gochangPays: r2(tg), netCreated: r2(tk + tg) }, note: '직할 세수는 기존 상납 이벤트의 비율(5할)로만 흐른다. 새 수입을 만들지 않으므로 두 세력 합계는 0.' } };
});

T('G1-GOV-03', () => {
  const s = ng('goryeo', { autoPauseMonthly: false }), g = s.dom.governanceByRegion.gochang, snap = () => ({ controller: s.regions.gochang.controller, overlord: s.factions.gochang.overlord, garrison: S.total(s.regions.gochang.garrison), atWar: S.atWar(s, 'goryeo', 'gochang'), grievance: g.grievance, trust: S.trust(s, 'goryeo', 'gochang'), admin: g.admin, transition: g.transition && g.transition.kind });
  const before = snap(), pv = Dm.governancePreview(s, 'goryeo', 'gochang', 'DIRECT', true), r = cmd(s, 'REQUEST_GOVERNANCE_CHANGE', { regionId: 'gochang', to: 'DIRECT', force: true }), right = snap();
  run(s, 5); const done = snap(); g.grievance = 24; g.lastBand = 0; run(s, 3); // 임계 직전 상태(fixture)에서 월말 결산까지
  const noResp = clone(s); run(noResp, 6); const later = { week: noResp.week, overlord: noResp.factions.gochang.overlord, trust: S.trust(noResp, 'goryeo', 'gochang'), how: (noResp.chronicle.filter(c => c.type === 'submit' && c.participants[1] === 'gochang').slice(-1)[0] || {}).text || null };
  const key = Dm.settlementKeys(s, 'goryeo').slice(-1)[0], al = Dm.viewSettlement(s, 'goryeo', key).politicalAlerts, after = snap();
  const resp = cmd(s, 'REQUEST_GOVERNANCE_CHANGE', { regionId: 'gochang', to: 'AUTONOMOUS' }), relieved = snap();
  const rebelled = s.chronicle.some(c => (c.type === 'defect' || c.type === 'submit') && c.participants.indexOf('gochang') >= 0 && c.week <= 8);
  return { pass: r.ok && right.controller === 'gochang' && right.overlord === 'goryeo' && right.garrison === before.garrison && !right.atWar && right.admin === 'gochang' && right.grievance === before.grievance + 15 && done.admin === 'goryeo' && done.controller === 'gochang' && al.some(a => a.type === 'GRIEVANCE' && a.regionId === 'gochang') && resp.ok && relieved.grievance < after.grievance && relieved.admin === 'gochang' && !rebelled,
    evidence: { preview: pv.lines, before, rightAfterClick: right, afterTransition: done, warningAtThreshold: al, grievanceAfterMonth: after.grievance, response: { reassureAutonomy: resp.ok, grievance: [after.grievance, relieved.grievance], trust: [after.trust, relieved.trust], admin: relieved.admin }, rebelledWithin8Weeks: rebelled, ifNoResponse6WeeksLater: later, note: '강제 직할 직후에는 지배·군대·전쟁 상태가 그대로다. 대응하지 않으면 낮아진 신뢰 때문에 기존 외교 판정(귀부 권유)에서 다른 왕국으로 넘어갈 수 있다. 새 반란 스크립트는 없다.' } };
});

T('G1-CITY-01', () => {
  const s = ng('goryeo', { autoPauseMonthly: false }), c = ng('goryeo', { autoPauseMonthly: false }), plan = [['gaegyeong', 'market'], ['cheorwon', 'irrigation'], ['cheongju', 'barracks'], ['gugwon', 'guardpost']];
  // 대조군과 같은 조건이 되도록 AI만 다르지 않게: 플레이어 명령만 다르다
  const t0 = s.factions.goryeo.treasury; for (const p of plan) cmd(s, 'START_FACILITY_BUILD', { regionId: p[0], facility: p[1] });
  const paid = t0 - s.factions.goryeo.treasury, noEffectYet = Dm.cityView(s, 'goryeo', 'gaegyeong').income.mult;
  run(s, 3); run(c, 3); const upkeepBefore = [0, 1, 2].reduce((a, w) => a + ((s.ledger.goryeo[w] || {})['gold:facility_upkeep'] || 0), 0);
  run(s, 1); run(c, 1); // 4주째: 완공 → 같은 틱의 수확에 수리시설이 반영된다
  const lv = Object.fromEntries(plan.map(p => [p[1], s.dom.cityDomesticByRegion[p[0]].facilities[p[1]]]));
  const hv = (s.ledger.goryeo[3]['grain:harvest'] || 0) - (c.ledger.goryeo[3]['grain:harvest'] || 0), hvExp = s.regions.cheorwon.tax * S.DATA.K.harvestMult * 0.06;
  const mult = Dm.cityView(s, 'goryeo', 'gaegyeong').income.mult, tr = [c.dom.cityDomesticByRegion.cheongju.training, s.dom.cityDomesticByRegion.cheongju.training], stb = [c.dom.governanceByRegion.gugwon.stability, s.dom.governanceByRegion.gugwon.stability];
  cmd(s, 'START_FACILITY_BUILD', { regionId: 'gaegyeong', facility: 'temple_relief' }); run(s, 4); run(c, 4);
  const upkeepAfter = s.ledger.goryeo[4]['gold:facility_upkeep'], tr2 = [c.dom.cityDomesticByRegion.cheongju.training, s.dom.cityDomesticByRegion.cheongju.training], stb2 = [c.dom.governanceByRegion.gugwon.stability, s.dom.governanceByRegion.gugwon.stability];
  run(s, 4); run(c, 4); const mo = [c.regions.gaegyeong.morale, s.regions.gaegyeong.morale], templeNote = Dm.viewSettlement(s, 'goryeo', '0929-12').cityDeltas.find(x => x.regionId === 'gaegyeong').notes;
  // 최대 Lv3: 시장을 실제로 세 번 올린 뒤 네 번째를 시도
  cmd(s, 'START_FACILITY_BUILD', { regionId: 'gaegyeong', facility: 'market' }); run(s, 4); cmd(s, 'START_FACILITY_BUILD', { regionId: 'gaegyeong', facility: 'market' }); run(s, 4);
  const lv3 = s.dom.cityDomesticByRegion.gaegyeong.facilities.market, fourth = S.validate(s, 'goryeo', 'START_FACILITY_BUILD', { regionId: 'gaegyeong', facility: 'market' });
  const facSpend = Object.values(s.ledger.goryeo).reduce((a, W) => a + (W['gold:facility'] || 0), 0);
  return { pass: paid === 240 && noEffectYet === 1 && upkeepBefore === 0 && Object.values(lv).every(x => x === 1) && Math.abs(hv - hvExp) < EPS && Math.abs(mult - 1.06) < 1e-9 && upkeepAfter === -4 && tr[1] === 51 && tr2[1] === 52 && tr2[0] === 50 && stb2[1] > stb2[0] && mo[1] > mo[0] && lv3 === 3 && !fourth.ok && facSpend === -(240 + 60 + 120 + 180),
    evidence: { startCostPaidOnce: paid, effectBeforeCompletion: noEffectYet, upkeepLedgerDuringConstruction: upkeepBefore, levelsAfter4Weeks: lv, upkeepLedgerFirstWeekAfter: upkeepAfter, market: { incomeMultiplier: mult }, irrigation: { harvestExtraVsControl: r2(hv), expected: r2(hvExp) }, barracks: { trainingControlVsBuilt_month1: tr, month2: tr2 }, guardpost: { stabilityControlVsBuilt_month1: stb, month2: stb2 }, temple: { moraleControlVsBuilt: mo, settlementNote: templeNote }, maxLevel: { marketLevel: lv3, fourthAttempt: fourth.reason }, totalFacilityLedger: facSpend } };
});

T('G1-CITY-02', () => {
  const s = ng('goryeo', { autoPauseMonthly: false }), cd = s.dom.cityDomesticByRegion.cheongju, inc = [];
  for (let m = 0; m < 3; m++) { const v = Dm.cityView(s, 'goryeo', 'cheongju'); inc.push({ week: s.week, base: r2(v.income.base), actual: r2(v.income.actual), mult: v.income.mult }); run(s, 4); }
  const empty = cd.governor === null && cd.deputies.every(x => !x), before = Dm.cityView(s, 'goryeo', 'cheongju').income;
  const r = cmd(s, 'ASSIGN_CITY_OFFICER', { regionId: 'cheongju', slot: 'deputy:0', charId: 'baksulhui', domain: 'commerce' }); run(s, r.weeks + 1);
  const after = Dm.cityView(s, 'goryeo', 'cheongju').income, exp = 1 + 0.08 * Math.min(1.25, Math.max(0.5, Dm.fit(s.characters.baksulhui, 'commerce') / 60));
  return { pass: empty && inc.every(x => x.actual > 0 && x.mult === 1) && r.ok && Math.abs(after.mult - exp) < 1e-9, evidence: { threeMonthsNoOfficer: inc, officersWereEmpty: empty, deputyAssigned: { who: '박술희', domain: '상업', travelWeeks: r.weeks, fit: Dm.fit(s.characters.baksulhui, 'commerce') }, incomeMultiplier: [before.mult, r2(after.mult)], expected: r2(exp) } };
});

function fixtureGame() { const s = ng('goryeo', { fixture: 'devFastResearch' }); return s; }
T('G1-NAT-01', () => {
  const s = fixtureGame(), heavy0 = s.regions.gaegyeong.garrison.heavy, steps = [];
  steps.push(['병영 착공', cmd(s, 'START_FACILITY_BUILD', { regionId: 'gaegyeong', facility: 'barracks' }).ok]);
  steps.push(['MIL 담당관 박술희', cmd(s, 'ASSIGN_NATIONAL_OFFICER', { category: 'MIL', charId: 'baksulhui' }).ok]);
  const st = cmd(s, 'START_NATIONAL_PROJECT', { category: 'MIL', projectId: 'MIL-02', budgetTier: 'STANDARD' }); steps.push(['MIL-02 착수', st.ok]);
  const p0 = s.dom.nationalProjectsByFaction.goryeo.slots.MIL.progress, early = S.validate(s, 'goryeo', 'RECRUIT', { regionId: 'gaegyeong', unit: 'adv', count: 100 }), prog = [];
  let done = null; for (let i = 0; i < 16 && done === null; i++) { run(s, 1); if (s.dom.nationalProjectsByFaction.goryeo.completed['MIL-02'] !== undefined) done = s.week; if (s.week % 4 === 0) prog.push({ week: s.week, pct: r2(s.dom.nationalProjectsByFaction.goryeo.slots.MIL.progress) }); }
  const noBarracks = S.validate(s, 'goryeo', 'RECRUIT', { regionId: 'cheorwon', unit: 'adv', count: 100 }), heavyOk = S.validate(s, 'goryeo', 'RECRUIT', { regionId: 'gaegyeong', unit: 'heavy', count: 100 }).ok;
  if (paused(s)) resume(s);
  const rec = S.issueOrder(s, 'goryeo', 'RECRUIT', { regionId: 'gaegyeong', unit: 'adv', count: 100 }), heavy1 = s.regions.gaegyeong.garrison.heavy; run(s, 2);
  return { pass: steps.every(x => x[1]) && p0 === 64 && !early.ok && done !== null && done <= 14 && !noBarracks.ok && heavyOk && rec.ok && s.regions.gaegyeong.garrison.adv === 100 && heavy1 === heavy0 && s.dom.fixture === 'devFastResearch',
    evidence: { fixture: s.dom.fixture, steps, startProgress: p0, recruitBeforeUnlock: early.reason, progressByMonth: prog, completedAtWeek: done, recruitWithoutBarracks: noBarracks.reason, legacyHeavyStillRecruitable: heavyOk, advRecruited: s.regions.gaegyeong.garrison.adv, legacyHeavyGarrison: [heavy0, heavy1], unit: S.DATA.UNIT.adv, armamentPrerequisite: 'abstracted_for_G1' } };
});

T('G1-NAT-02', () => {
  const s = fixtureGame(); cmd(s, 'ASSIGN_NATIONAL_OFFICER', { category: 'SOC', charId: 'baksulhui' }); const st = cmd(s, 'START_NATIONAL_PROJECT', { category: 'SOC', projectId: 'SOC-03', budgetTier: 'STANDARD' });
  const cap0 = Dm.adminOf(s, 'goryeo').capacity, early = S.validate(s, 'goryeo', 'ENACT_POLICY', { policyId: 'SOC-03' });
  let done = null; for (let i = 0; i < 16 && done === null; i++) { run(s, 1); if (s.dom.nationalProjectsByFaction.goryeo.completed['SOC-03'] !== undefined) done = s.week; }
  const cap1 = Dm.adminOf(s, 'goryeo').capacity; run(s, 2); const cap2 = Dm.adminOf(s, 'goryeo').capacity; if (paused(s)) resume(s);
  const en = cmd(s, 'ENACT_POLICY', { policyId: 'SOC-03' }), cap3 = Dm.adminOf(s, 'goryeo').capacity, again = cmd(s, 'ENACT_POLICY', { policyId: 'SOC-03' }); run(s, 5); const cap4 = Dm.adminOf(s, 'goryeo').capacity;
  return { pass: st.ok && !early.ok && done !== null && cap1 === cap0 && cap2 === cap0 && en.ok && Math.abs(cap3 - cap0 - 2) < EPS && !again.ok && Math.abs(cap4 - cap3) < EPS,
    evidence: { completedAtWeek: done, enactBeforeComplete: early.reason, capacity: { start: r2(cap0), afterResearchOnly: r2(cap1), twoWeeksLaterStillNotEnacted: r2(cap2), afterEnact: r2(cap3), fiveWeeksLater: r2(cap4) }, secondEnact: again.reason } };
});

T('G1-NAT-03', () => {
  const s = ng('goryeo', { autoPauseMonthly: false }); cmd(s, 'ASSIGN_NATIONAL_OFFICER', { category: 'PRJ', charId: 'baksulhui' });
  const noRight = S.validate(s, 'goryeo', 'START_NATIONAL_PROJECT', { category: 'PRJ', projectId: 'PRJ-02', targetRegionId: 'gochang' }), foreign = S.validate(s, 'goryeo', 'START_NATIONAL_PROJECT', { category: 'PRJ', projectId: 'PRJ-02', targetRegionId: 'wansan' }), selfRule = S.validate(s, 'goryeo', 'START_NATIONAL_PROJECT', { category: 'PRJ', projectId: 'PRJ-02', targetRegionId: 'naju' });
  const st = cmd(s, 'START_NATIONAL_PROJECT', { category: 'PRJ', projectId: 'PRJ-02', targetRegionId: 'cheorwon', budgetTier: 'STANDARD' });
  const c = ng('goryeo', { autoPauseMonthly: false }); c.log.length = 0;
  run(s, 4); run(c, 4); const natural = r2(s.dom.nationalProjectsByFaction.goryeo.slots.PRJ.progress);
  s.dom.nationalProjectsByFaction.goryeo.slots.PRJ.progress = 95; // QA 지름길: 9개월 과제를 완료 직전으로 (기록에 남김)
  const g0 = S.holdings(s, 'goryeo'); run(s, 4); run(c, 4);
  const done = s.dom.nationalProjectsByFaction.goryeo.completed['PRJ-02@cheorwon'] !== undefined, hm = id => r2(Dm.cityView(s, 'goryeo', id).harvestMult);
  const cats = new Set(); for (const w in s.ledger.goryeo) for (const k in s.ledger.goryeo[w]) if (k.indexOf('grain:') === 0) cats.add(k.slice(6));
  run(s, 44); run(c, 44); // 52주 수확까지
  const hv = (s.ledger.goryeo[51]['grain:harvest'] || 0) - (c.ledger.goryeo[51]['grain:harvest'] || 0), exp = s.regions.cheorwon.controller === 'goryeo' && c.regions.cheorwon.controller === 'goryeo' ? s.regions.cheorwon.tax * S.DATA.K.harvestMult * 0.10 : null;
  return { pass: !noRight.ok && !foreign.ok && !selfRule.ok && st.ok && done && hm('cheorwon') === 1.1 && hm('gaegyeong') === 1 && hm('cheongju') === 1 && !cats.has('project') && (exp === null || Math.abs(hv - exp) < 1),
    evidence: { rejected: { vassalAutonomous: noRight.reason, foreign: foreign.reason, ownSelfRule: selfRule.reason }, naturalProgressAfter1Month: natural, qaShortcut: '진척을 95%로 올려 다음 결산에서 완료', completed: done, harvestMultiplier: { cheorwon: hm('cheorwon'), gaegyeong: hm('gaegyeong'), cheongju: hm('cheongju') }, grainLedgerCategories: [...cats], harvestWeek52ExtraVsControl: r2(hv), expected: exp, note: exp === null ? '52주 시점 철원 지배가 바뀌어 수확 비교는 생략' : '대조군과의 수확 차이 = 철원 세수×40×10% (다른 AI 전개 차이로 1 미만 오차 허용)' } };
});

T('G1-NAT-04', () => {
  const s = ng('goryeo', { autoPauseMonthly: false });
  for (const [cat, who] of [['MIL', 'yugeumpil'], ['SOC', 'baehyeongyeong'], ['PRJ', 'baksulhui']]) cmd(s, 'ASSIGN_NATIONAL_OFFICER', { category: cat, charId: who });
  const a = cmd(s, 'START_NATIONAL_PROJECT', { category: 'MIL', projectId: 'MIL-01', budgetTier: 'STANDARD' }), b = cmd(s, 'START_NATIONAL_PROJECT', { category: 'SOC', projectId: 'SOC-01', budgetTier: 'STANDARD' }), c = cmd(s, 'START_NATIONAL_PROJECT', { category: 'PRJ', projectId: 'PRJ-02', targetRegionId: 'cheorwon', budgetTier: 'STANDARD' });
  const second = S.validate(s, 'goryeo', 'START_NATIONAL_PROJECT', { category: 'MIL', projectId: 'MIL-02' }), dupChar = Dm.candidateStatus(s, 'goryeo', 'national:goryeo:SOC', 'yugeumpil').code;
  run(s, 2); const wk = [0, 1].map(w => s.ledger.goryeo[w]['gold:national']);
  const keep = s.factions.goryeo.treasury; s.factions.goryeo.treasury = 0; s.ledgerBase.goryeo.gold = 0; run(s, 2); // 국고 고갈 2주 fixture
  const wk2 = [2, 3].map(w => (s.ledger.goryeo[w] || {})['gold:national'] || 0), snap = Dm.viewSettlement(s, 'goryeo', '0929-10'), pd = snap.projectDeltas;
  const full = cat => S.DATA && Dm.BAL.national.monthlyBaseProgressPoints[cat] * Dm.officerFactor(s.characters[{ MIL: 'yugeumpil', SOC: 'baehyeongyeong', PRJ: 'baksulhui' }[cat]], cat);
  const okShare = pd.every(p => Math.abs(p.delta - full(p.category) * p.creditWeeks / 4) < EPS), paidSum = pd.reduce((x, p) => x + p.paid, 0), ledgerSum = -[0, 1, 2, 3].reduce((x, w) => x + ((s.ledger.goryeo[w] || {})['gold:national'] || 0), 0);
  return { pass: a.ok && b.ok && c.ok && !second.ok && dupChar === 'TRANSFER_REQUIRED' && wk[0] === -30 && wk[1] === -30 && pd.length === 3 && okShare && Math.abs(paidSum - ledgerSum) < EPS && pd.every(p => p.paid <= p.committed + EPS),
    evidence: { started: [a.ok, b.ok, c.ok], secondInSameCategory: second.reason, sameOfficerSecondSlot: dupChar, weeklyBudgetLedger: wk.concat(wk2), brokeWeeksFixture: '3~4주째 국고 0', projectDeltas: pd.map(p => ({ cat: p.category, project: p.projectId, paid: r2(p.paid), committed: p.committed, creditWeeks: p.creditWeeks, unpaidWeeks: p.unpaidWeeks, delta: r2(p.delta), fullMonthWouldBe: r2(full(p.category)) })), paidEqualsLedger: [r2(paidSum), r2(ledgerSum)] } };
});

T('G1-AI-01', () => {
  const s = ng('gochang'); run(s, 10); const by = {};
  for (const l of s.log) if (l.ok && l.faction !== 'gochang' && l.type !== 'GARRISON' && l.type !== 'RESUME_FROM_MONTHLY_PAUSE') { (by[l.faction] = by[l.faction] || {})[l.type] = ((by[l.faction] || {})[l.type] || 0) + 1; }
  const rejected = s.log.filter(l => !l.ok && l.faction !== 'gochang').length, minT = Math.min(...S.DATA.FIDS.map(f => s.factions[f].treasury)), dom = s.log.filter(l => l.ok && l.faction !== 'gochang' && Dm.DOMESTIC.indexOf(l.type) >= 0).map(l => S.dateStr(l.week) + ' ' + s.factions[l.faction].name + ' ' + l.type + ': ' + l.why);
  return { pass: Object.keys(by).length >= 4 && minT >= 0, evidence: { npcFactionsActing: Object.keys(by).length, ordersByFaction: by, aiOrdersRejectedBySameValidator: rejected, minTreasury: r2(minT), domesticDecisionsWithReasons: dom.slice(0, 12), note: 'AI는 플레이어와 같은 validate/issueOrder를 거친다. 전용 비용·권한·연구 경로는 없다.' } };
});

function scripted(pf, weeks, o) { // 사람 대신 내정 명령을 내는 고정 각본
  const s = ng(pf, o), f = pf, cap = s.factions[f].capitalId, notes = [];
  const free = () => Object.values(s.characters).filter(c => c.faction === f && c.status === 'active' && c.id !== s.factions[f].rulerId && !Dm.primaryOf(s, c.id) && !c.armyId).sort((a, b) => b.po - a.po || (a.id < b.id ? -1 : 1));
  const act = (t, p) => { const r = Dm.command(s, f, t, p); notes.push({ week: s.week, cmd: t, ok: r.ok, queued: !!r.queued, reason: r.ok ? '' : r.reason }); return r; };
  act('SET_CITY_FOCUS', { regionId: cap, domain: 'commerce' }); act('START_FACILITY_BUILD', { regionId: cap, facility: 'market' });
  const a = free()[0]; if (a) act('ASSIGN_CITY_OFFICER', { regionId: cap, slot: 'deputy:0', charId: a.id, domain: 'commerce' });
  const b = free()[0]; if (b) { act('ASSIGN_NATIONAL_OFFICER', { category: 'SOC', charId: b.id }); act('START_NATIONAL_PROJECT', { category: 'SOC', projectId: 'SOC-01', budgetTier: 'ECONOMY' }); }
  while (s.week < weeks && !s.over) {
    S.tick(s);
    if (paused(s)) { const mk = Dm.settlementKeys(s, f).slice(-1)[0]; if (mk === '0929-10') act('START_FACILITY_BUILD', { regionId: cap, facility: 'guardpost' }); if (mk === '0929-11') act('CHANGE_NATIONAL_BUDGET', { category: 'SOC', budgetTier: 'STANDARD' }); resume(s); }
  }
  return { s, notes };
}
T('G1-DETER-01', () => {
  const a = scripted('goryeo', 14).s, b = scripted('goryeo', 14).s, mid = scripted('goryeo', 6).s, c = S.migrate(clone(mid));
  while (c.week < 14 && !c.over) { S.tick(c); if (paused(c)) { const mk = Dm.settlementKeys(c, 'goryeo').slice(-1)[0]; if (mk === '0929-11') Dm.command(c, 'goryeo', 'CHANGE_NATIONAL_BUDGET', { category: 'SOC', budgetTier: 'STANDARD' }); resume(c); } }
  const sj = s => JSON.stringify(Object.values(s.dom.settlements));
  return { pass: S.hash(a) === S.hash(b) && sj(a) === sj(b) && S.hash(a) === S.hash(c), evidence: { weeks: a.week, hashA: S.hash(a), hashB: S.hash(b), settlementsIdentical: sj(a) === sj(b), aiLogIdentical: JSON.stringify(a.log) === JSON.stringify(b.log), battlesIdentical: JSON.stringify(a.battles) === JSON.stringify(b.battles), resumedFromSaveAtWeek6Hash: S.hash(c) } };
});

T('G1-PLAY-01', () => {
  const ev = [], ok = [];
  for (const pf of ['goryeo', 'hubaekje', 'gochang']) {
    const { s, notes } = scripted(pf, 14), cap = s.factions[pf].capitalId, v = Dm.cityView(s, pf, cap), keys = Dm.settlementKeys(s, pf), nat = s.dom.nationalProjectsByFaction[pf];
    const snap = keys.map(k => { const x = Dm.viewSettlement(s, pf, k); return { month: k, gold: [Math.round(x.resourceDelta.gold.open), Math.round(x.resourceDelta.gold.close)], grain: [Math.round(x.resourceDelta.grain.open), Math.round(x.resourceDelta.grain.close)], projects: x.projectDeltas.map(p => p.projectId + ' ' + r2(p.from) + '→' + r2(p.to) + '%'), alerts: x.politicalAlerts.length, events: x.events.length }; });
    const world = {}; for (const c of s.chronicle) world[c.type] = (world[c.type] || 0) + 1;
    const e = { player: pf, weeks: s.week, over: s.over, commands: notes, capitalIncomeMultiplier: r2(v.income.mult), facilities: v.cd.facilities, socProgress: r2(nat.slots.SOC.progress), socCompleted: Object.keys(nat.completed), monthlySettlements: snap, chronicleTypes: world };
    ev.push(e); ok.push(keys.length >= 3 && v.income.mult > 1 && v.cd.facilities.market === 1 && (nat.slots.SOC.progress > 0 || nat.completed['SOC-01'] !== undefined) && notes.filter(n => n.queued).length >= 1);
  }
  return { pass: ok.every(Boolean), note: '고정 각본 자동 플레이 결과다. 사람이 느끼는 재미·이해도(11.1의 질문)와 GQS는 측정하지 않았다.', evidence: ev };
});

T('G1-REG-01', () => {
  const eq = REG.run([929, 7, 31337]), on = [];
  for (const pf of ['goryeo', 'hubaekje', 'gochang']) { const s = ng(pf); run(s, 60); const j = JSON.stringify(s); on.push({ player: pf, week: s.week, over: s.over && s.over.type, nanInState: /NaN|null,"treasury"/.test(j) || Object.values(s.factions).some(F => !isFinite(F.treasury) || !isFinite(F.grain)), settlements: Dm.settlementKeys(s, pf).length, chronicle: s.chronicle.length, battles: s.battles.length, saveBytes: j.length }); }
  return { pass: eq.every(x => x.same) && on.every(x => (x.week === 60 || x.over === 'defeat') && !x.nanInState),
    note: '원 P0-R QA-01~12 목록은 이 저장소에 없다. 대신 내정을 끈 새 엔진이 R3 기준선 엔진과 60주 동안 같은 상태(연대기·세력·거점·신뢰)를 내는지 9판 비교했다.', evidence: { baselineEquivalenceDomesticOff: eq, sixtyWeeksDomesticOn: on } };
});

T('SAVE-MIGRATION', () => {
  const old = B.newGame('hubaekje', SEED); for (let i = 0; i < 10; i++) B.tick(old); const v3 = clone(old);
  const m = S.migrate(clone(v3)), keep = ['goryeo', 'hubaekje', 'gochang'].every(f => m.factions[f].treasury === v3.factions[f].treasury) && Object.keys(v3.regions).every(r => m.regions[r].controller === v3.regions[r].controller && m.regions[r].overlord === v3.regions[r].overlord && m.regions[r].lord === v3.regions[r].lord && m.regions[r].autonomy === v3.regions[r].autonomy);
  const once = JSON.stringify(m), twice = JSON.stringify(S.migrate(clone(m))); run(m, 20);
  return { pass: m.v === 4 && m.migratedFrom === 3 && !!m.dom && keep && once === twice && Object.keys(m.factions).length === 8 && Object.keys(m.regions).length === 20 && Object.keys(m.characters).length === 26 && m.week === 30 && S.migrate({ v: 2 }) === null,
    evidence: { from: 'v3 (R3 기준선 엔진으로 10주 진행한 세이브)', toVersion: m.v, migratedFrom: m.migratedFrom, domesticDerived: !!m.dom, audit: m.dom.audit, originalFieldsKept: keep, migrateTwiceIdentical: once === twice, continued20Weeks: m.week, olderThanV3: 'null을 돌려 주고 UI가 안내한다' } };
});

const dir = path.join(__dirname, '..', 'BUILD_G1_DELIVERY', 'evidence'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'qa_engine.json'), JSON.stringify({ seed: SEED, scenario: 'S04_0929_10', results: out }, null, 1));
for (const r of out) console.log((r.status + '    ').slice(0, 7), r.id, r.status === 'PASS' ? '' : JSON.stringify(r.evidence).slice(0, 900));
console.log(out.filter(r => r.status === 'PASS').length + '/' + out.length + ' PASS');
process.exit(out.every(r => r.status === 'PASS') ? 0 : 1);
