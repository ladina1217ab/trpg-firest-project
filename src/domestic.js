/* 후삼국: 천하의 주인 — BUILD-G1 내정 수직 슬라이스 (SGK-BUILD-G1-DOMESTIC)
   기존 WorldState(s)에 s.dom을 덧붙이고, 엔진의 공용 명령(validate/issueOrder)·원장·주간 판정에 훅으로 연결한다.
   별도 시뮬레이터가 아니다: 세수는 엔진의 세수 줄 한 곳, 수확은 수확 사건 한 곳에서만 생기고 여기서는 배율만 준다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sim.js'), require('./balance.js'));
  else root.Domestic = factory(root.Sim, root.DraftBalance);
})(typeof self !== 'undefined' ? self : this, function (Sim, BAL) {
  'use strict';
  const I = Sim._int, EXT = Sim.EXT, D = Sim.DATA, FM = D.FMETA, K = D.K;
  const no = I.no, gold = I.gold, regs = I.regs, armyList = I.armyList, chron = I.chron, report = I.report, addOrder = I.addOrder, clamp = I.clamp, rnd = I.rnd, fname = I.fname, addTrust = I.addTrust, FIDS = I.FIDS;
  const A = BAL.administration, O = BAL.officers, CF = BAL.cityFacilities, N = BAL.national;

  const DOMAINS = ['commerce', 'agriculture', 'military', 'security', 'culture'];
  const DOMAIN = {
    commerce: { name: '상업', facility: 'market', measure: '세수' }, agriculture: { name: '농업', facility: 'irrigation', measure: '수확' },
    military: { name: '군사', facility: 'barracks', measure: '훈련도' }, security: { name: '치안', facility: 'guardpost', measure: '안정도' }, culture: { name: '문화', facility: 'temple_relief', measure: '민심' },
  };
  const FACILITY = {
    market: { name: '시장', domain: 'commerce', effect: '주간 세수 +6%/Lv' }, irrigation: { name: '수리시설', domain: 'agriculture', effect: '수확 +6%/Lv' },
    barracks: { name: '병영', domain: 'military', effect: '훈련도 월 +1/Lv' }, guardpost: { name: '경비소', domain: 'security', effect: '안정도 월 +1/Lv' }, temple_relief: { name: '사찰·구휼소', domain: 'culture', effect: '민심 월 +1/Lv' },
  };
  const CATS = ['MIL', 'SOC', 'PRJ'];
  const CATNAME = { MIL: '군사 연구', SOC: '사회 제도', PRJ: '국가사업' };
  const TIERNAME = { ECONOMY: '절약', STANDARD: '표준', CONCENTRATED_BUDGET: '집중' };
  const PROJECTS = {
    'MIL-01': { cat: 'MIL', name: '보병 편제 정비', req: [], effect: '모병에 걸리는 시간이 2주에서 1주로 줄어든다.' },
    'MIL-02': { cat: 'MIL', name: '신형 중장보병 편제', req: ['MIL-01'], effect: '병영 Lv1 이상인 직할 거점에서 중장보병을 모을 수 있다. 기존 중보병은 그대로다.' },
    'SOC-01': { cat: 'SOC', name: '호족 인사 장부', req: [], effect: '호족 불만이 달마다 1씩 더 가라앉는다.' },
    'SOC-03': { cat: 'SOC', name: '중앙 재정 정비', req: ['SOC-01'], policy: true, effect: '연구를 마친 뒤 시행하면 행정 역량 +2. 시행하기 전에는 효과가 없다.' },
    'PRJ-02': { cat: 'PRJ', name: '수리·곡창 정비', req: [], target: true, effect: '대상 거점의 수확 +10%. 수확 때만 적용되고 군량을 따로 주지 않는다.' },
  };
  const BANDS = ['안정', '경계', '저항', '공개 반발', '분열 위기'];
  const DOMESTIC = ['SET_CITY_FOCUS', 'ASSIGN_CITY_OFFICER', 'ASSIGN_NATIONAL_OFFICER', 'ASSIGN_ARMY_OFFICER', 'START_FACILITY_BUILD', 'REQUEST_GOVERNANCE_CHANGE', 'START_NATIONAL_PROJECT', 'CHANGE_NATIONAL_BUDGET', 'ENACT_POLICY'];
  const PRIORITY = { REQUEST_GOVERNANCE_CHANGE: 1, ASSIGN_CITY_OFFICER: 2, ASSIGN_NATIONAL_OFFICER: 2, ASSIGN_ARMY_OFFICER: 2, ENACT_POLICY: 3, START_NATIONAL_PROJECT: 4, CHANGE_NATIONAL_BUDGET: 5, SET_CITY_FOCUS: 6, START_FACILITY_BUILD: 7 };
  const ONE = { light: 1, heavy: 0, archer: 0, cav: 0, adv: 0 };

  // ───────────────────────── 상태 ─────────────────────────
  const newCity = () => ({ focusDomain: null, governor: null, deputies: [null, null], deputyDomains: [null, null], facilities: { market: 0, irrigation: 0, barracks: 0, guardpost: 0, temple_relief: 0 }, facilityConstruction: null, training: 50, moraleAcc: 0, granary: false, lastSettledMonthKey: null });
  const newSlot = cat => ({ category: cat, projectId: null, targetRegionId: null, officerId: null, budgetTier: 'STANDARD', progress: 0, paidInMonth: 0, creditWeeks: 0, vacantWeeks: 0, unpaidWeeks: 0, status: 'IDLE', lastMonthKey: null, startedWeek: null });
  const newNational = () => ({ slots: { MIL: newSlot('MIL'), SOC: newSlot('SOC'), PRJ: newSlot('PRJ') }, completed: {}, enacted: {}, saved: {} });
  const kingdomLike = f => !!(FM[f].kingdom || FM[f].sovereign);
  function deriveGov(s, R) { // 기존 Region 값에서 통치 상태를 유도한다 (controller·overlord·autonomy는 그대로 둔다)
    const c = R.controller, ov = s.factions[c].overlord;
    const self = kingdomLike(c) && R.autonomy >= A.selfRuleAutonomy && s.factions[c].capitalId !== R.id;
    return { regionId: R.id, admin: self ? null : c, grievance: ov ? clamp(Math.round((60 - Sim.trust(s, ov, c)) / 2), 0, 20) : 0, stability: clamp(Math.round(50 + (R.morale - 50) / 2), 0, 100), transition: null, lastBand: 0 };
  }
  function initDomestic(s, opts) {
    opts = opts || {};
    const dom = s.dom = { schemaVersion: 1, revision: 0, fixture: null, governanceByRegion: {}, cityDomesticByRegion: {}, assignments: {}, factionAdministration: {}, nationalProjectsByFaction: {}, pendingCommands: [], settlements: {}, monthOpen: {}, monthFlags: {}, lastSettledMonthKey: null, audit: [], ai: {},
      gate: { phase: 'RUNNING', activeSettlementId: null, nextUnprocessedTickId: null, resumeRequired: false, originSpeed: null, autoPauseMonthly: BAL.calendar.monthlyAutoPauseDefault } };
    for (const R of regs(s)) {
      dom.governanceByRegion[R.id] = deriveGov(s, R); dom.cityDomesticByRegion[R.id] = newCity();
      const c = R.controller, ov = s.factions[c].overlord;
      if (R.overlord !== c && !(ov && Sim.vassalAg(s, ov, c))) dom.audit.push({ week: s.week, code: 'UNRESOLVED_RIGHTS', regionId: R.id, note: '명목 종주와 실효 지배가 다르지만 약정이 없다. 자치 후보로 두고 직할화하지 않는다.' });
    }
    for (const f of FIDS) { dom.nationalProjectsByFaction[f] = newNational(); dom.monthFlags[f] = { adminShort: 0 }; dom.ai[f] = {}; }
    syncLords(s);
    for (const f of FIDS) { dom.factionAdministration[f] = adminOf(s, f); dom.monthOpen[f] = openSnap(s, f); }
    if (opts.autoPauseMonthly === false) dom.gate.autoPauseMonthly = false;
    if (opts.fixture) applyFixture(s, opts.fixture);
  }
  // QA 전용: 12~14주 안에 병종 해금·제도 시행을 검증하기 위한 사전 진척. 실플레이 기본값에는 쓰지 않는다.
  function applyFixture(s, name) {
    if (name !== 'devFastResearch') return false;
    const fx = BAL.testing.devOnlyFastResearchFixture, nat = s.dom.nationalProjectsByFaction[s.playerFactionId];
    if (fx.mil01Completed) nat.completed['MIL-01'] = -1; nat.saved['MIL-02'] = fx.mil02ProgressPct;
    if (fx.soc01Completed) nat.completed['SOC-01'] = -1; nat.saved['SOC-03'] = fx.soc03ProgressPct;
    s.dom.fixture = name; s.dom.audit.push({ week: s.week, code: 'DEV_FIXTURE', note: 'devFastResearch: MIL-01·SOC-01 사전 완료, MIL-02·SOC-03 진척 ' + fx.mil02ProgressPct + '%' });
    return true;
  }
  function troopsOf(s, f) { let t = 0; for (const r of regs(s)) if (r.controller === f) t += Sim.total(r.garrison); for (const a of armyList(s)) if (a.factionId === f) t += Sim.total(a.units); return t; }
  function avgOf(s, f) { let st = 0, mo = 0, n = 0; for (const r of regs(s)) if (r.controller === f) { st += s.dom.governanceByRegion[r.id].stability; mo += r.morale; n++; } return { stability: n ? st / n : 0, morale: n ? mo / n : 0 }; }
  function openSnap(s, f) { const ad = adminOf(s, f), av = avgOf(s, f); return { gold: s.factions[f].treasury, grain: Sim.holdings(s, f), troops: troopsOf(s, f), admin: { capacity: ad.capacity, burden: ad.burden, eff: ad.eff }, stability: av.stability, morale: av.morale }; }

  // ───────────────────────── 통치권 ─────────────────────────
  // f가 rid에 대해 가진 권한. can = 도시 내정 명령(임명·건설·중점)을 내릴 수 있는가
  function rights(s, f, rid) {
    const R = s.regions[rid], c = R.controller, g = s.dom.governanceByRegion[rid], ov = s.factions[c].overlord;
    if (c === f) {
      if (g.admin === f) return { mode: 'DIRECT', can: true, label: '직할', reason: '' };
      if (g.admin === null) return { mode: 'AUTONOMOUS', can: false, label: '지방 자치', reason: R.name + '은(는) 지방 세력의 자치에 맡긴 거점입니다. 임명·건설을 하려면 먼저 직할로 돌려야 합니다.' };
      return { mode: 'DIRECT', can: false, label: '종주 직할', reason: R.name + '의 임명·건설 권한은 종주 ' + fname(s, g.admin) + '에 넘어가 있습니다.' };
    }
    if (ov === f && Sim.vassalAg(s, f, c)) {
      if (g.admin === f) return { mode: 'DIRECT', can: true, label: '직할(편입)', reason: '' };
      return { mode: 'AUTONOMOUS', can: false, label: '호족 자치', reason: R.name + '은(는) 자치를 보장한 ' + fname(s, c) + '의 거점입니다. 임명·건설·모병은 직할 협상을 거쳐야 합니다.' };
    }
    return { mode: 'INDEPENDENT', can: false, label: '타 세력', reason: R.name + '은(는) ' + fname(s, c) + '의 거점입니다. 조회와 외교만 할 수 있습니다.' };
  }
  function adminOf(s, f) {
    const F = s.factions[f], dom = s.dom;
    if (!F.alive) return { capacity: 1, burden: 0, ratio: 0, eff: 1, expense: 0, direct: [], auto: [], parts: {} };
    const ru = s.characters[F.rulerId], nat = dom.nationalProjectsByFaction[f];
    const parts = { 기본: A.baseCapacity, '군주 정치': (ru ? ru.po : 50) * A.politicsCapacityFactor };
    if (A.scenarioCapacityBonus[f]) parts['929년 기존 관료 조직'] = A.scenarioCapacityBonus[f];
    if (nat.enacted['SOC-03'] !== undefined) parts['중앙 재정 정비 시행'] = N.socialPolicySOC03.administrationCapacityBonusWhenEnacted;
    let capacity = 0; for (const k in parts) capacity += parts[k]; capacity = Math.max(1, capacity);
    let burden = 0, expense = 0; const direct = [], auto = [];
    for (const R of regs(s)) {
      const c = R.controller, own = c === f; if (!own && s.factions[c].overlord !== f) continue;
      const isD = dom.governanceByRegion[R.id].admin === f;
      burden += isD ? A.burdenDirect : A.burdenAutonomous;
      expense += isD ? (A.capitalExempt && F.capitalId === R.id ? 0 : A.weeklyGoldCostDirect) : A.weeklyGoldCostAutonomous;
      (isD ? direct : auto).push(R.id);
    }
    const ratio = burden / capacity, eff = clamp(1 - A.collectionOverextensionFactor * Math.max(0, ratio - 1), A.collectionEfficiencyFloor, 1);
    return { capacity, burden, ratio, eff, expense, direct, auto, parts };
  }
  const bandOf = g => { const t = A.grievanceThresholds; return g >= t[3] ? 4 : g >= t[2] ? 3 : g >= t[1] ? 2 : g >= t[0] ? 1 : 0; };

  // ───────────────────────── 인물·주직 ─────────────────────────
  const isRuler = (s, c) => s.factions[c.faction].rulerId === c.id;
  function fit(c, role) { const w = O.roleFit[role]; if (!w || !c) return 0; let v = 0; for (const k in w) v += c[k] * w[k]; return Math.round(v); }
  function parseSlot(id) {
    const p = String(id).split(':');
    if (p[0] === 'city') return { kind: 'city', regionId: p[1], role: p[2], idx: p[2] === 'deputy' ? +p[3] : 0 };
    if (p[0] === 'national') return { kind: 'national', factionId: p[1], cat: p[2] };
    if (p[0] === 'army') return { kind: 'army', armyId: p[1], role: p[2], idx: p[2] === 'deputy' ? +p[3] : 0 };
    return { kind: 'unknown' };
  }
  function slotRole(sl, domain) { return sl.kind === 'city' ? (sl.role === 'governor' ? 'governor' : domain || 'commerce') : sl.kind === 'national' ? sl.cat : sl.role === 'commander' ? 'commander' : 'armyDeputy'; }
  function holderOf(s, slotId) {
    const sl = parseSlot(slotId);
    if (sl.kind === 'city') { const cd = s.dom.cityDomesticByRegion[sl.regionId]; return cd ? (sl.role === 'governor' ? cd.governor : cd.deputies[sl.idx]) : null; }
    if (sl.kind === 'national') { const n = s.dom.nationalProjectsByFaction[sl.factionId]; return n && n.slots[sl.cat] ? n.slots[sl.cat].officerId : null; }
    if (sl.kind === 'army') { const a = s.armies[sl.armyId]; return a ? (sl.role === 'commander' ? a.commanderId : (a.deputyIds || [])[sl.idx] || null) : null; }
    return null;
  }
  function slotLabel(s, slotId) {
    const sl = parseSlot(slotId);
    if (sl.kind === 'city') { const R = s.regions[sl.regionId], cd = s.dom.cityDomesticByRegion[sl.regionId]; return R.name + (sl.role === 'governor' ? ' 성주' : ' 부관 ' + (sl.idx + 1) + (cd.deputyDomains[sl.idx] ? '(' + DOMAIN[cd.deputyDomains[sl.idx]].name + ')' : '')); }
    if (sl.kind === 'national') return CATNAME[sl.cat] + ' 담당관';
    if (sl.kind === 'army') { const a = s.armies[sl.armyId]; return (a ? s.regions[a.loc].name + ' 부대 ' : '부대 ') + (sl.role === 'commander' ? '주장' : '부장 ' + (sl.idx + 1)); }
    return '';
  }
  function primaryOf(s, cid) {
    const c = s.characters[cid]; if (!c) return null;
    if (s.factions[c.faction] && isRuler(s, c)) return { type: 'RULER', slotId: null, label: FM[c.faction].title };
    if (c.armyId && c.armyId !== 'appoint') { const a = s.armies[c.armyId]; if (a) { const slot = a.commanderId === cid ? 'commander' : 'deputy:' + Math.max(0, (a.deputyIds || []).indexOf(cid)), id = 'army:' + a.id + ':' + slot; return { type: 'ARMY', slotId: id, label: slotLabel(s, id) }; } }
    const as = s.dom.assignments[cid];
    if (as) return { type: as.type, slotId: as.targetId, label: slotLabel(s, as.targetId), status: as.status, effectiveWeek: as.effectiveWeek };
    return null;
  }
  function slotRight(s, f, sl) {
    if (sl.kind === 'city') { if (!s.regions[sl.regionId]) return { ok: false, reason: '거점이 없습니다.' }; const r = rights(s, f, sl.regionId); return { ok: r.can, reason: r.reason, mode: r.mode }; }
    if (sl.kind === 'national') return sl.factionId === f && CATS.indexOf(sl.cat) >= 0 ? { ok: true } : { ok: false, reason: '다른 세력의 국정에는 관여할 수 없습니다.' };
    if (sl.kind === 'army') { const a = s.armies[sl.armyId]; return a && a.factionId === f ? { ok: true } : { ok: false, reason: '우리 부대가 아닙니다.' }; }
    return { ok: false, reason: '알 수 없는 직책입니다.' };
  }
  function destOf(s, f, sl) { return sl.kind === 'city' ? sl.regionId : sl.kind === 'national' ? s.factions[f].capitalId : s.armies[sl.armyId].loc; }
  const armyLocked = (s, a) => !!a.leg || a.path.length > 0 || !Sim.sameBloc(s, a.factionId, s.regions[a.loc].controller);
  // 후보의 임명 가능 상태. 코드: OK / TRANSFER_REQUIRED / KING_ROLE / UNAVAILABLE / DEAD / UNVERIFIED / NO_APPOINT_RIGHT / SAME_SLOT
  function candidateStatus(s, f, slotId, cid) {
    const sl = parseSlot(slotId), rt = slotRight(s, f, sl), bad = (code, reason) => ({ code, ok: false, reason: Sim.jo(reason) });
    if (!rt.ok) return bad('NO_APPOINT_RIGHT', rt.reason);
    const c = s.characters[cid];
    if (!c) return bad('UNVERIFIED', '929년 인물풀에 없는 인물입니다.');
    if (c.status === 'dead') return bad('DEAD', c.name + '은(는) 세상을 떠났습니다.');
    if (c.faction !== f) return bad('UNAVAILABLE', c.name + '은(는) ' + fname(s, c.faction) + ' 사람입니다.');
    if (c.status !== 'active') return bad('UNAVAILABLE', c.name + '은(는) ' + (c.status === 'captive' ? '사로잡혀 있습니다.' : '조정을 떠났습니다.'));
    if (isRuler(s, c)) return bad('KING_ROLE', c.name + '은(는) ' + FM[f].title + '입니다. 군주는 실무 보직에 앉힐 수 없습니다.');
    if (c.armyId === 'appoint') return bad('UNAVAILABLE', c.name + '은(는) 임지로 가는 중입니다.');
    if (holderOf(s, slotId) === cid) return bad('SAME_SLOT', c.name + '이(가) 이미 이 자리에 있습니다.');
    const dest = destOf(s, f, sl), here = s.regions[c.loc];
    if (sl.kind === 'army') { const a = s.armies[sl.armyId]; if (armyLocked(s, a)) return bad('UNAVAILABLE', '행군·교전 중인 부대의 지휘부는 바꿀 수 없습니다.'); if (c.loc !== a.loc) return bad('UNAVAILABLE', c.name + '은(는) ' + here.name + '에 있습니다. 부대와 같은 거점에 있어야 합니다.'); }
    if (c.loc !== dest && (here.siege || s.regions[dest].siege)) return bad('UNAVAILABLE', '포위된 성으로는 드나들 수 없습니다.');
    const pr = primaryOf(s, cid);
    if (pr && pr.type === 'ARMY') { const a = s.armies[c.armyId]; if (armyLocked(s, a)) return bad('UNAVAILABLE', c.name + '은(는) 행군·교전 중인 부대에 있어 빼낼 수 없습니다.'); }
    let weeks = 0;
    if (c.loc !== dest) { const p = Sim.findPath(s, f, c.loc, dest, ONE); if (!p) return bad('UNAVAILABLE', c.name + '이(가) ' + s.regions[dest].name + '까지 갈 길이 없습니다.'); weeks = Math.max(1, p.weeks); }
    return { code: pr ? 'TRANSFER_REQUIRED' : 'OK', ok: true, transfer: pr, weeks, reason: '' };
  }
  function candidates(s, f, slotId, domain) {
    const sl = parseSlot(slotId), role = slotRole(sl, domain), out = [];
    for (const id in s.characters) { const c = s.characters[id]; if (c.faction !== f) continue; const st = candidateStatus(s, f, slotId, id), pr = primaryOf(s, id); out.push({ id, c, fit: fit(c, role), status: st, primary: pr }); }
    return out;
  }
  function clearSlot(s, slotId, cid) {
    const sl = parseSlot(slotId);
    if (sl.kind === 'city') { const cd = s.dom.cityDomesticByRegion[sl.regionId]; if (sl.role === 'governor') { if (cd.governor === cid) cd.governor = null; } else if (cd.deputies[sl.idx] === cid) { cd.deputies[sl.idx] = null; cd.deputyDomains[sl.idx] = null; } }
    else if (sl.kind === 'national') { const sl2 = s.dom.nationalProjectsByFaction[sl.factionId].slots[sl.cat]; if (sl2.officerId === cid) sl2.officerId = null; }
    else if (sl.kind === 'army') { const a = s.armies[sl.armyId]; if (a) { if (a.commanderId === cid) a.commanderId = null; a.deputyIds = (a.deputyIds || []).filter(x => x !== cid); } const c = s.characters[cid]; if (c && c.armyId === sl.armyId) c.armyId = null; }
    const as = s.dom.assignments[cid];
    if (as && as.targetId === slotId) { delete s.dom.assignments[cid]; const c = s.characters[cid]; if (c && c.armyId === 'appoint' && as.status === 'TRANSIT') c.armyId = null; }
  }
  function vacate(s, cid, keepSeat) { // 인물의 현재 주직을 비운다. 새 보직 등록과 한 묶음으로만 부른다
    const pr = primaryOf(s, cid); if (!pr || pr.type === 'RULER') return null;
    const sl = parseSlot(pr.slotId);
    if (sl.kind === 'city' && sl.role === 'governor' && !keepSeat) { const R = s.regions[sl.regionId]; if (R.lord === cid) R.lord = null; }
    clearSlot(s, pr.slotId, cid);
    return pr;
  }
  function activate(s, cid) {
    const as = s.dom.assignments[cid], c = s.characters[cid]; if (!as || !c) return;
    const sl = parseSlot(as.targetId); as.status = 'ACTIVE'; if (c.armyId === 'appoint') c.armyId = null;
    c.loc = destOf(s, c.faction, sl);
    if (sl.kind === 'city' && sl.role === 'governor') { const R = s.regions[sl.regionId]; if (R.controller === c.faction && !Sim.lordOf(s, R)) { R.lord = cid; chron(s, 'appoint', [c.faction], R.id, c.name + '이(가) ' + R.name + ' 성주로 부임했다.', { cause: '인사', stateChanges: '민심 목표 ' + (50 + Math.round(c.po / 4)) }); } }
    report(s, c.faction, c.name + '이(가) ' + slotLabel(s, as.targetId) + ' 자리에서 일을 시작했습니다.', false, sl.kind === 'city' ? sl.regionId : null);
  }
  function doAssign(s, f, slotId, cid, domain, weeks) {
    const sl = parseSlot(slotId), prev = holderOf(s, slotId), out = { vacated: null, replaced: null };
    if (prev && prev !== cid) { clearSlot(s, slotId, prev); if (sl.kind === 'city' && sl.role === 'governor' && s.regions[sl.regionId].lord === prev) s.regions[sl.regionId].lord = null; out.replaced = prev; report(s, f, s.characters[prev].name + '이(가) ' + slotLabel(s, slotId) + ' 자리에서 물러났습니다.', false); }
    if (!cid) { s.dom.revision++; return out; }
    const c = s.characters[cid], old = vacate(s, cid, false);
    if (old) { out.vacated = old; report(s, f, c.name + '이(가) ' + old.label + ' 자리를 떠나 ' + slotLabel(s, slotId) + '(으)로 옮깁니다. 떠난 자리는 비었습니다.', true, old.slotId && parseSlot(old.slotId).regionId || null); }
    if (sl.kind === 'army') { const a = s.armies[sl.armyId]; if (sl.role === 'commander') a.commanderId = cid; else { a.deputyIds = (a.deputyIds || []).slice(); if (sl.idx < a.deputyIds.length) a.deputyIds[sl.idx] = cid; else a.deputyIds.push(cid); } c.armyId = a.id; }
    else {
      if (sl.kind === 'city') { const cd = s.dom.cityDomesticByRegion[sl.regionId]; if (sl.role === 'governor') cd.governor = cid; else { cd.deputies[sl.idx] = cid; cd.deputyDomains[sl.idx] = domain; } }
      else s.dom.nationalProjectsByFaction[f].slots[sl.cat].officerId = cid;
      s.dom.assignments[cid] = { characterId: cid, type: sl.kind === 'city' ? (sl.role === 'governor' ? 'CITY_GOVERNOR' : 'CITY_DEPUTY') : 'NATIONAL', targetId: slotId, effectiveWeek: s.week + weeks, status: weeks > 0 ? 'TRANSIT' : 'ACTIVE' };
      if (weeks > 0) c.armyId = 'appoint'; else activate(s, cid);
    }
    s.dom.revision++; return out;
  }
  const officerOn = (s, cid, rid) => { const as = cid && s.dom.assignments[cid], c = cid && s.characters[cid]; return as && as.status === 'ACTIVE' && c && c.status === 'active' && (!rid || c.loc === rid) ? c : null; };
  // 그 자리에 앉은 정치적 성주(Region.lord)가 일을 시작/재개하면 실무 성주로 본다
  function syncLords(s) {
    for (const R of regs(s)) {
      const cd = s.dom.cityDomesticByRegion[R.id], g = s.dom.governanceByRegion[R.id], L = Sim.lordOf(s, R);
      if (!L || isRuler(s, L) || cd.governor || g.admin !== R.controller || primaryOf(s, L.id)) continue;
      cd.governor = L.id; s.dom.assignments[L.id] = { characterId: L.id, type: 'CITY_GOVERNOR', targetId: 'city:' + R.id + ':governor', effectiveWeek: s.week, status: 'ACTIVE' };
    }
  }

  // ───────────────────────── 도시 효율 ─────────────────────────
  function governorFactor(s, rid) { const c = officerOn(s, s.dom.cityDomesticByRegion[rid].governor, rid); return c ? clamp(O.governorEfficiencyAtPolitics50 + (c.po - 50) * 0.002, O.governorEfficiencyFloor, O.governorEfficiencyCeil) : O.baselineOfficerEfficiencyWhenEmpty; }
  function deputyScale(c, d) { return O.deputyFitScaling ? clamp(fit(c, d) / O.deputyFitRef, O.deputyFitMin, O.deputyFitMax) : 1; }
  function deputyBonus(s, rid, d) {
    const cd = s.dom.cityDomesticByRegion[rid]; let n = 0, b = 0;
    for (let i = 0; i < 2; i++) { if (cd.deputyDomains[i] !== d) continue; const c = officerOn(s, cd.deputies[i], rid); if (!c) continue; b += (n === 0 ? O.firstDeputySpecialistBonus : O.secondSameDomainDeputyBonus) * deputyScale(c, d); n++; }
    return b;
  }
  function domainEff(s, rid, d) { const cd = s.dom.cityDomesticByRegion[rid]; return governorFactor(s, rid) * (1 + (cd.focusDomain === d ? O.focusBonus : 0)) * (1 + deputyBonus(s, rid, d)); }
  function incomeMultOf(s, r) { const cd = s.dom.cityDomesticByRegion[r.id]; return (1 + CF.commerceGoldEfficiencyBonusPerLevel * cd.facilities.market) * domainEff(s, r.id, 'commerce') * adminOf(s, r.controller).eff; }
  function harvestMultOf(s, r) { const cd = s.dom.cityDomesticByRegion[r.id]; return (1 + CF.agricultureExistingHarvestBonusPerLevel * cd.facilities.irrigation) * domainEff(s, r.id, 'agriculture') * (cd.granary ? 1 + N.projectPRJ02.existingHarvestBonusWhenCompleted : 1); }
  function facilityUpkeep(s, f) { let u = 0; for (const R of regs(s)) { const g = s.dom.governanceByRegion[R.id]; if ((g.admin || R.controller) !== f) continue; const fc = s.dom.cityDomesticByRegion[R.id].facilities; for (const k in fc) u += fc[k] * CF.weeklyUpkeepPerLevel; } return u; }
  function officerFactor(c, cat) { return O.projectOfficerBase + fit(c, cat) / O.projectOfficerDiv; }
  const projKey = sl => sl.projectId + (sl.targetRegionId ? '@' + sl.targetRegionId : '');
  function budgetWeekly(s, f) { let b = 0; const nat = s.dom.nationalProjectsByFaction[f], wn = Sim.weeksOfMonth(Sim.monthKey(s.week)).length || 4; for (const cat of CATS) { const sl = nat.slots[cat]; if (sl.projectId && officerOn(s, sl.officerId)) b += N.budgetTiers[sl.budgetTier].goldMonthly / wn; } return b; }
  function weeklyCost(s, f) { if (!s.dom || !s.factions[f].alive) return 0; return adminOf(s, f).expense + facilityUpkeep(s, f) + budgetWeekly(s, f); }

  // ───────────────────────── 명령: 검증 ─────────────────────────
  const V = I.VALID, AP = I.APPLY;
  const need = s => s.dom ? null : no('이 판에는 내정 상태가 없습니다.');
  V.SET_CITY_FOCUS = (s, f, p) => {
    const e = need(s); if (e) return e; if (!s.regions[p.regionId]) return no('거점을 고르세요.');
    const rt = rights(s, f, p.regionId); if (!rt.can) return Object.assign(no(rt.reason), { code: 'NO_RIGHT', mode: rt.mode });
    if (p.domain !== null && DOMAINS.indexOf(p.domain) < 0) return no('중점 분야를 고르세요.');
    if (s.dom.cityDomesticByRegion[p.regionId].focusDomain === p.domain) return no('이미 그 분야가 중점입니다.');
    return { ok: true, cost: 0 };
  };
  V.ASSIGN_CITY_OFFICER = (s, f, p) => {
    const e = need(s); if (e) return e; if (!s.regions[p.regionId]) return no('거점을 고르세요.');
    if (!/^(governor|deputy:[01])$/.test(p.slot || '')) return no('직책을 고르세요.');
    const slotId = 'city:' + p.regionId + ':' + p.slot, isDep = p.slot !== 'governor', rt = rights(s, f, p.regionId);
    if (!rt.can) return Object.assign(no(rt.reason), { code: 'NO_APPOINT_RIGHT', mode: rt.mode });
    if (!p.charId) return holderOf(s, slotId) ? { ok: true, cost: 0, slotId, dismiss: true, weeks: 0 } : no('이미 비어 있는 자리입니다.');
    if (isDep && DOMAINS.indexOf(p.domain) < 0) return no('부관이 맡을 분야를 고르세요.');
    const st = candidateStatus(s, f, slotId, p.charId);
    if (st.code === 'SAME_SLOT' && isDep && s.dom.cityDomesticByRegion[p.regionId].deputyDomains[+p.slot.slice(-1)] !== p.domain) return { ok: true, cost: 0, slotId, weeks: 0, domainOnly: true, code: 'OK' };
    if (!st.ok) return Object.assign(no(st.reason), { code: st.code });
    return { ok: true, cost: 0, slotId, weeks: st.weeks, transfer: st.transfer || null, code: st.code };
  };
  V.ASSIGN_NATIONAL_OFFICER = (s, f, p) => {
    const e = need(s); if (e) return e; if (CATS.indexOf(p.category) < 0) return no('국정 분야를 고르세요.');
    const slotId = 'national:' + f + ':' + p.category;
    if (!p.charId) return holderOf(s, slotId) ? { ok: true, cost: 0, slotId, dismiss: true, weeks: 0 } : no('이미 비어 있는 자리입니다.');
    const st = candidateStatus(s, f, slotId, p.charId); if (!st.ok) return Object.assign(no(st.reason), { code: st.code });
    return { ok: true, cost: 0, slotId, weeks: st.weeks, transfer: st.transfer || null, code: st.code };
  };
  V.ASSIGN_ARMY_OFFICER = (s, f, p) => {
    const e = need(s); if (e) return e; const a = s.armies[p.armyId]; if (!a || a.factionId !== f) return no('우리 부대가 아닙니다.');
    if (!/^(commander|deputy:[01])$/.test(p.slot || '')) return no('직책을 고르세요.');
    const slotId = 'army:' + a.id + ':' + p.slot;
    if (armyLocked(s, a)) return no('행군·교전 중인 부대의 지휘부는 바꿀 수 없습니다.');
    if (!p.charId) return holderOf(s, slotId) ? { ok: true, cost: 0, slotId, dismiss: true, weeks: 0 } : no('이미 비어 있는 자리입니다.');
    if (p.slot !== 'commander' && !a.commanderId) return no('부장을 두려면 주장을 먼저 정하세요.');
    const st = candidateStatus(s, f, slotId, p.charId); if (!st.ok) return Object.assign(no(st.reason), { code: st.code });
    return { ok: true, cost: 0, slotId, weeks: 0, transfer: st.transfer || null, code: st.code };
  };
  V.START_FACILITY_BUILD = (s, f, p) => {
    const e = need(s); if (e) return e; const R = s.regions[p.regionId]; if (!R) return no('거점을 고르세요.');
    if (!FACILITY[p.facility]) return no('지을 시설을 고르세요.');
    const rt = rights(s, f, R.id); if (!rt.can) return Object.assign(no(rt.reason), { code: 'NO_RIGHT', mode: rt.mode });
    if (R.siege) return no('포위된 거점에서는 공사를 할 수 없습니다.');
    const cd = s.dom.cityDomesticByRegion[R.id], lv = cd.facilities[p.facility];
    if (lv >= CF.maxLevel) return no(FACILITY[p.facility].name + '은(는) 이미 최고 단계(Lv' + CF.maxLevel + ')입니다.');
    if (cd.facilityConstruction) return no(R.name + '에서는 이미 ' + FACILITY[cd.facilityConstruction.facility].name + ' 공사가 진행 중입니다. 한 거점에서 한 번에 하나만 짓습니다.');
    const cost = CF.goldCostByNewLevel[lv + 1];
    if (Sim.avail(s, f) < cost) return no('쓸 수 있는 국고가 부족합니다. (' + cost + ' 필요, 예약분을 빼고 ' + Math.floor(Math.max(0, Sim.avail(s, f))) + ' 남음)');
    return { ok: true, cost, toLevel: lv + 1, weeks: CF.constructionWeeks };
  };
  function govCase(s, f, R) { const c = R.controller, g = s.dom.governanceByRegion[R.id]; if (c === f) return g.admin === f ? 'OWN_DIRECT' : g.admin === null ? 'OWN_AUTO' : 'CEDED'; if (s.factions[c].overlord === f && Sim.vassalAg(s, f, c)) return g.admin === f ? 'VASSAL_DIRECT' : 'VASSAL_AUTO'; return 'INDEPENDENT'; }
  V.REQUEST_GOVERNANCE_CHANGE = (s, f, p) => {
    const e = need(s); if (e) return e; const R = s.regions[p.regionId]; if (!R) return no('거점을 고르세요.');
    if (p.to !== 'DIRECT' && p.to !== 'AUTONOMOUS') return no('직할과 자치 가운데 하나를 고르세요.');
    const g = s.dom.governanceByRegion[R.id], cs = govCase(s, f, R), c = R.controller;
    if (cs === 'INDEPENDENT') return Object.assign(no(R.name + '은(는) ' + fname(s, c) + '의 거점입니다. 통치 방식을 바꾸려면 먼저 귀부 협상이 필요합니다.'), { code: 'NO_RIGHT', mode: 'INDEPENDENT' });
    if (cs === 'CEDED') return no('임명·건설 권한이 종주에게 있습니다. 자치를 돌려받으려면 종주와 협상해야 합니다.');
    if (g.transition) return no(R.name + '은(는) 이미 통치 방식을 바꾸는 중입니다. (' + Sim.dateStr(g.transition.doneWeek) + ' 완료)');
    if (R.siege) return no('포위된 거점의 통치 방식은 바꿀 수 없습니다.');
    if (p.to === 'DIRECT') {
      if (cs === 'OWN_DIRECT' || cs === 'VASSAL_DIRECT') return no('이미 직할입니다.');
      if (cs === 'OWN_AUTO') return { ok: true, cost: 0, kind: 'own', weeks: A.transitionWeeks };
      if (p.force) return { ok: true, cost: 0, kind: 'force', weeks: A.transitionWeeks };
      const v = V.ENVOY(s, f, { targetFactionId: c, kind: 'direct', terms: { regionId: R.id } }); if (!v.ok) return v;
      return { ok: true, cost: v.cost, kind: 'consent', weeks: K.envoyWeeks };
    }
    if (cs === 'OWN_AUTO' || cs === 'VASSAL_AUTO') return no('이미 자치입니다.');
    if (cs === 'OWN_DIRECT' && s.factions[f].capitalId === R.id) return no('본거지는 자치에 맡길 수 없습니다.');
    return { ok: true, cost: 0, kind: cs === 'OWN_DIRECT' ? 'delegate' : 'reassure', weeks: cs === 'OWN_DIRECT' ? A.transitionWeeks : 0 };
  };
  V.START_NATIONAL_PROJECT = (s, f, p) => {
    const e = need(s); if (e) return e; const def = PROJECTS[p.projectId]; if (!def || def.cat !== p.category) return no('과제를 고르세요.');
    const nat = s.dom.nationalProjectsByFaction[f], sl = nat.slots[def.cat], tier = p.budgetTier || sl.budgetTier;
    if (!N.budgetTiers[tier]) return no('예산 단계를 고르세요.');
    if (sl.projectId) return no(CATNAME[def.cat] + '에서는 이미 ' + PROJECTS[sl.projectId].name + '을(를) 진행 중입니다. 분야마다 한 과제만 진행합니다.');
    for (const r of def.req) if (nat.completed[r] === undefined) return no('먼저 ' + PROJECTS[r].name + '을(를) 마쳐야 합니다.');
    if (def.target) {
      const R = s.regions[p.targetRegionId]; if (!R) return no('사업을 벌일 거점을 고르세요.');
      const rt = rights(s, f, R.id); if (!rt.can) return Object.assign(no(rt.reason), { code: 'NO_RIGHT', mode: rt.mode });
      if (nat.completed[def.cat === 'PRJ' ? p.projectId + '@' + R.id : p.projectId] !== undefined) return no(R.name + '에서는 이미 마친 사업입니다.');
    } else if (nat.completed[p.projectId] !== undefined) return no('이미 마친 과제입니다.');
    if (!sl.officerId) return no(CATNAME[def.cat] + ' 담당관을 먼저 임명해야 합니다.');
    const g = N.budgetTiers[tier].goldMonthly;
    if (Sim.avail(s, f) < g) return no('한 달 치 예산(' + g + ')만큼의 국고가 없습니다.');
    return { ok: true, cost: 0, monthly: g, tier };
  };
  V.CHANGE_NATIONAL_BUDGET = (s, f, p) => {
    const e = need(s); if (e) return e; if (CATS.indexOf(p.category) < 0) return no('국정 분야를 고르세요.');
    if (!N.budgetTiers[p.budgetTier]) return no('예산 단계를 고르세요.');
    const sl = s.dom.nationalProjectsByFaction[f].slots[p.category];
    if (sl.budgetTier === p.budgetTier) return no('이미 그 예산 단계입니다.');
    return { ok: true, cost: 0, monthly: N.budgetTiers[p.budgetTier].goldMonthly };
  };
  V.ENACT_POLICY = (s, f, p) => {
    const e = need(s); if (e) return e; const def = PROJECTS[p.policyId]; if (!def || !def.policy) return no('시행할 제도를 고르세요.');
    const nat = s.dom.nationalProjectsByFaction[f];
    if (nat.completed[p.policyId] === undefined) return no(def.name + ' 연구를 아직 마치지 못했습니다.');
    if (nat.enacted[p.policyId] !== undefined) return no('이미 시행한 제도입니다.');
    return { ok: true, cost: 0 };
  };
  V.RESUME_FROM_MONTHLY_PAUSE = (s, f) => {
    const e = need(s); if (e) return e; if (f !== s.playerFactionId) return no('월간 정비는 플레이어만 끝낼 수 있습니다.');
    if (s.dom.gate.phase !== 'PAUSED_MONTHLY') return no('지금은 월간 정비 중이 아닙니다.');
    return { ok: true, cost: 0 };
  };

  // ───────────────────────── 명령: 실행 ─────────────────────────
  AP.SET_CITY_FOCUS = (s, f, p) => { s.dom.cityDomesticByRegion[p.regionId].focusDomain = p.domain; s.dom.revision++; };
  AP.ASSIGN_CITY_OFFICER = (s, f, p, v) => {
    if (v.domainOnly) { s.dom.cityDomesticByRegion[p.regionId].deputyDomains[+p.slot.slice(-1)] = p.domain; s.dom.revision++; return { weeks: 0 }; }
    const r = doAssign(s, f, v.slotId, p.charId || null, p.domain || null, v.weeks); return { weeks: v.weeks, vacated: r.vacated ? r.vacated.label : null };
  };
  AP.ASSIGN_NATIONAL_OFFICER = (s, f, p, v) => { const r = doAssign(s, f, v.slotId, p.charId || null, null, v.weeks); return { weeks: v.weeks, vacated: r.vacated ? r.vacated.label : null }; };
  AP.ASSIGN_ARMY_OFFICER = (s, f, p, v) => { const r = doAssign(s, f, v.slotId, p.charId || null, null, 0); return { weeks: 0, vacated: r.vacated ? r.vacated.label : null }; };
  AP.START_FACILITY_BUILD = (s, f, p, v) => {
    gold(s, f, -v.cost, 'facility'); // 착공금은 실행 시점에 한 번
    const o = addOrder(s, f, 'FACILITY_BUILD', { regionId: p.regionId, facility: p.facility, toLevel: v.toLevel }, v.cost, v.weeks);
    s.dom.cityDomesticByRegion[p.regionId].facilityConstruction = { facility: p.facility, toLevel: v.toLevel, orderId: o.id, startWeek: s.week, doneWeek: s.week + v.weeks, by: f };
    s.dom.revision++; return { weeks: v.weeks, cost: v.cost };
  };
  EXT.orderDone.FACILITY_BUILD = (s, o, R) => {
    const cd = s.dom && s.dom.cityDomesticByRegion[R.id], fc = cd && cd.facilityConstruction;
    if (!fc || fc.orderId !== o.id || s.dom.governanceByRegion[R.id].admin !== o.actorId) { o.status = 'failed'; if (fc && fc.orderId === o.id) cd.facilityConstruction = null; return; }
    cd.facilities[fc.facility] = fc.toLevel; cd.facilityConstruction = null; s.dom.revision++;
    report(s, o.actorId, R.name + '의 ' + FACILITY[fc.facility].name + '이(가) Lv' + fc.toLevel + '(으)로 완공됐습니다. ' + FACILITY[fc.facility].effect + ', 유지비 주당 ' + CF.weeklyUpkeepPerLevel + '.', true, R.id);
  };
  function startTransition(s, R, to, by, kind) { const g = s.dom.governanceByRegion[R.id]; g.transition = { to, by, kind, startWeek: s.week, doneWeek: s.week + A.transitionWeeks }; s.dom.revision++; }
  function releaseCityOfficers(s, rid, why) {
    const cd = s.dom.cityDomesticByRegion[rid];
    for (const cid of [cd.governor].concat(cd.deputies)) { if (!cid) continue; const c = s.characters[cid], as = s.dom.assignments[cid]; if (as) { clearSlot(s, as.targetId, cid); if (c) report(s, c.faction, c.name + '이(가) ' + s.regions[rid].name + '의 보직에서 물러났습니다: ' + why, true, rid); } }
    cd.governor = null; cd.deputies = [null, null]; cd.deputyDomains = [null, null]; cd.focusDomain = null;
    if (cd.facilityConstruction) { for (const o of s.orders) if (o.id === cd.facilityConstruction.orderId && o.status === 'active') o.status = 'failed'; cd.facilityConstruction = null; }
  }
  function finishTransition(s, R) {
    const g = s.dom.governanceByRegion[R.id], t = g.transition, c = R.controller, G = A.grievance; g.transition = null; if (!t) return;
    if (t.kind === 'own') { if (c !== t.by) return; g.admin = c; R.autonomy = A.directAutonomy; g.grievance = clamp(g.grievance + G.ownDirect, 0, 100); g.stability = clamp(g.stability - 5, 0, 100);
      chron(s, 'govern', [c], R.id, fname(s, c) + '이(가) ' + R.name + '을(를) 직할로 돌렸다.', { cause: '통치 방식 전환', stateChanges: '지방 자치 → 직할, 불만 +' + G.ownDirect }); report(s, c, R.name + '이(가) 직할이 됐습니다. 이제 임명과 건설을 할 수 있고, 행정 부담이 늘었습니다.', true, R.id); }
    else if (t.kind === 'delegate') { if (c !== t.by) return; releaseCityOfficers(s, R.id, '지방 자치로 전환'); g.admin = null; R.autonomy = A.delegatedAutonomy; g.grievance = clamp(g.grievance + G.reassure, 0, 100);
      chron(s, 'govern', [c], R.id, fname(s, c) + '이(가) ' + R.name + '을(를) 지방 자치에 맡겼다.', { cause: '통치 방식 전환', stateChanges: '직할 → 지방 자치, 세수 귀속 감소·행정 부담 감소' }); report(s, c, R.name + '을(를) 지방 자치에 맡겼습니다. 행정 부담은 줄고 중앙에 들어오는 세수도 줄어듭니다.', true, R.id); }
    else { // consent / force: 호족 거점을 종주가 직할
      const ag = Sim.vassalAg(s, t.by, c); if (!ag) return;
      releaseCityOfficers(s, R.id, '종주 직할로 전환'); g.admin = t.by;
      ag.terms = { autonomy: 'direct', mobilize: true, protect: ag.terms.protect }; ag.text = I.termsText(ag.terms); ag.revised = s.week; // 기존 귀부 약정을 고쳐 쓴다 (새 약정을 만들지 않는다)
      chron(s, 'govern', [t.by, c], R.id, fname(s, t.by) + '이(가) ' + fname(s, c) + '의 ' + R.name + '을(를) 직할로 편입했다.', { cause: t.kind === 'force' ? '강제 직할' : '합의 직할', stateChanges: '임명권 이양, 세수 5할 상납, 동원 의무' });
      report(s, t.by, R.name + ' 직할 편입이 끝났습니다. 이제 담당관을 보내고 시설을 지을 수 있습니다.', true, R.id); report(s, c, R.name + '의 임명·건설 권한이 ' + fname(s, t.by) + '에 넘어갔습니다.', true, R.id);
    }
    s.dom.revision++;
  }
  AP.REQUEST_GOVERNANCE_CHANGE = (s, f, p, v) => {
    const R = s.regions[p.regionId], g = s.dom.governanceByRegion[R.id], c = R.controller, G = A.grievance;
    if (v.kind === 'consent') { AP.ENVOY(s, f, { targetFactionId: c }, { cost: v.cost, kind: 'direct', terms: { regionId: R.id } }); return { weeks: v.weeks, kind: v.kind }; }
    if (v.kind === 'own' || v.kind === 'delegate') { startTransition(s, R, p.to, f, v.kind); return { weeks: v.weeks, kind: v.kind }; }
    if (v.kind === 'force') {
      startTransition(s, R, 'DIRECT', f, 'force'); g.grievance = clamp(g.grievance + G.forcedDirect, 0, 100); addTrust(s, f, c, G.forcedTrust);
      chron(s, 'govern', [f, c], R.id, fname(s, f) + '이(가) ' + fname(s, c) + '의 뜻을 묻지 않고 ' + R.name + ' 직할을 밀어붙였다.', { cause: '강제 직할', stateChanges: '불만 +' + G.forcedDirect + ', 신뢰 ' + G.forcedTrust });
      report(s, f, R.name + ' 직할을 밀어붙였습니다. ' + fname(s, c) + '의 불만이 ' + G.forcedDirect + ' 오르고 신뢰가 떨어졌습니다. 곧바로 반란이 일어나지는 않습니다.', true, R.id); report(s, c, fname(s, f) + '이(가) ' + R.name + '을(를) 직할하겠다고 통보했습니다.', true, R.id);
      return { weeks: v.weeks, kind: v.kind };
    }
    // reassure: 자치 재보장
    const ag = Sim.vassalAg(s, f, c); releaseCityOfficers(s, R.id, '자치 재보장'); g.admin = c; g.transition = null;
    if (ag) { ag.terms = { autonomy: 'full', mobilize: ag.terms.mobilize, protect: ag.terms.protect }; ag.text = I.termsText(ag.terms); ag.revised = s.week; }
    g.grievance = clamp(g.grievance + G.reassure, 0, 100); addTrust(s, f, c, G.reassureTrust); s.dom.revision++;
    chron(s, 'govern', [f, c], R.id, fname(s, f) + '이(가) ' + fname(s, c) + '에게 ' + R.name + '의 자치를 다시 보장했다.', { cause: '자치 재보장', stateChanges: '불만 ' + G.reassure + ', 신뢰 +' + G.reassureTrust });
    report(s, c, fname(s, f) + '이(가) ' + R.name + '의 자치를 다시 보장했습니다.', true, R.id);
    return { weeks: 0, kind: v.kind };
  };
  // 합의 직할: 기존 사신·협상 경로(ENVOY)를 그대로 쓴다
  I.KINDNAME.direct = '직할 편입 요청';
  EXT.envoyKind.direct = (s, f, t, tm) => {
    const R = s.regions[tm.regionId];
    if (!R || R.controller !== t) return no('직할로 편입할 거점을 고르세요.');
    if (s.factions[t].overlord !== f || !Sim.vassalAg(s, f, t)) return no('우리를 섬기는 세력의 거점이 아닙니다.');
    if (s.dom.governanceByRegion[R.id].admin === f) return no('이미 직할입니다.');
    return { ok: true, terms: { regionId: R.id } };
  };
  function directScore(s, Kf, Mf) {
    const ru = s.characters[s.factions[Mf].rulerId], parts = { 신뢰: (Sim.trust(s, Mf, Kf) - 60) / 2, '자치 상실': -20, '약속 이력': I.repPart(s, Kf), 성향: ((D.AIP[Mf].lean || {})[Kf] || 0) / 2 };
    if (ru && ru.office) parts['받은 관직'] = 4 * ru.office;
    const cap = s.factions[Mf].capitalId; if (s.regions[cap].siege || Sim.threatTo(s, Mf, cap) > 1.5 * Sim.defenseOf(s, cap)) parts['보호가 절실함'] = 10;
    if (s.ties[I.tk(Kf, Mf)]) parts['혼인 관계'] = 6;
    return { score: I.sumParts(parts), parts };
  }
  EXT.decide.direct = (s, f, t) => { const sc = directScore(s, f, t); return { res: sc.score + (rnd(s) - 0.5) * 12 >= 0 ? 'accept' : 'reject', sc }; };
  EXT.deal.direct = (s, f, t, terms) => {
    const R = s.regions[terms.regionId], g = s.dom.governanceByRegion[R.id]; if (R.controller !== t || g.transition) return;
    startTransition(s, R, 'DIRECT', f, 'consent'); const add = Sim.trust(s, t, f) >= 75 ? 0 : A.grievance.consentDirect; g.grievance = clamp(g.grievance + add, 0, 100);
    chron(s, 'pact', [f, t], R.id, fname(s, t) + '이(가) ' + R.name + '을(를) ' + fname(s, f) + '의 직할로 넘기기로 했다.', { cause: '직할 협상', decision: '수락', stateChanges: A.transitionWeeks + '주 뒤 임명권 이양, 불만 +' + add });
    report(s, f, fname(s, t) + '이(가) ' + R.name + ' 직할 편입을 받아들였습니다. ' + A.transitionWeeks + '주 뒤부터 담당관을 보낼 수 있습니다.', true, R.id); report(s, t, R.name + '을(를) ' + fname(s, f) + '의 직할로 넘기기로 했습니다.', true, R.id);
  };
  EXT.propText.direct = (s, pr) => '종주 ' + fname(s, pr.from) + '이(가) ' + s.regions[pr.terms.regionId].name + '을(를) 직할하겠다고 합니다. 받아들이면 임명·건설 권한을 넘기고 세수 5할을 바치며 동원 의무를 집니다.';
  EXT.moot.direct = (s, f, t, terms) => s.factions[t].overlord !== f || !Sim.vassalAg(s, f, t) || s.regions[terms.regionId].controller !== t || s.dom.governanceByRegion[terms.regionId].admin === f;

  AP.START_NATIONAL_PROJECT = (s, f, p, v) => {
    const nat = s.dom.nationalProjectsByFaction[f], sl = nat.slots[p.category];
    sl.projectId = p.projectId; sl.targetRegionId = PROJECTS[p.projectId].target ? p.targetRegionId : null; sl.budgetTier = v.tier; sl.progress = nat.saved[projKey(sl)] || nat.saved[p.projectId] || 0;
    sl.paidInMonth = 0; sl.creditWeeks = 0; sl.vacantWeeks = 0; sl.unpaidWeeks = 0; sl.status = 'ACTIVE'; sl.startedWeek = s.week; s.dom.revision++;
    return { monthly: v.monthly };
  };
  AP.CHANGE_NATIONAL_BUDGET = (s, f, p) => { s.dom.nationalProjectsByFaction[f].slots[p.category].budgetTier = p.budgetTier; s.dom.revision++; };
  AP.ENACT_POLICY = (s, f, p) => {
    s.dom.nationalProjectsByFaction[f].enacted[p.policyId] = s.week; s.dom.revision++; // 효과는 adminOf가 시행 여부를 읽어 한 번만 반영한다
    chron(s, 'policy', [f], null, fname(s, f) + '이(가) ' + PROJECTS[p.policyId].name + '을(를) 시행했다.', { cause: '사회 제도 시행', stateChanges: '행정 역량 +' + N.socialPolicySOC03.administrationCapacityBonusWhenEnacted });
  };
  function completeProject(s, f, sl) {
    const nat = s.dom.nationalProjectsByFaction[f], key = sl.targetRegionId ? projKey(sl) : sl.projectId, def = PROJECTS[sl.projectId];
    if (nat.completed[key] !== undefined) return false; // 완료 효과는 한 번
    nat.completed[key] = s.week; delete nat.saved[key]; delete nat.saved[sl.projectId];
    let rid = null; if (sl.projectId === 'PRJ-02') { rid = sl.targetRegionId; s.dom.cityDomesticByRegion[rid].granary = true; }
    chron(s, 'project', [f], rid, fname(s, f) + '이(가) ' + (rid ? s.regions[rid].name + '의 ' : '') + def.name + '을(를) 마쳤다.', { cause: CATNAME[def.cat], stateChanges: def.effect });
    report(s, f, def.name + ' 완료: ' + def.effect + (def.policy ? ' 국정 화면에서 시행해야 합니다.' : ''), true, rid);
    sl.projectId = null; sl.targetRegionId = null; sl.progress = 0; sl.status = 'IDLE'; s.dom.revision++;
    return true;
  }

  // ───────────────────────── 월간 정비: 명령 예약 ─────────────────────────
  function conflictKeys(f, type, p) {
    if (type === 'SET_CITY_FOCUS') return ['focus:' + p.regionId];
    if (type === 'ASSIGN_CITY_OFFICER') return ['slot:city:' + p.regionId + ':' + p.slot].concat(p.charId ? ['char:' + p.charId] : []);
    if (type === 'ASSIGN_NATIONAL_OFFICER') return ['slot:national:' + f + ':' + p.category].concat(p.charId ? ['char:' + p.charId] : []);
    if (type === 'ASSIGN_ARMY_OFFICER') return ['slot:army:' + p.armyId + ':' + p.slot].concat(p.charId ? ['char:' + p.charId] : []);
    if (type === 'START_FACILITY_BUILD') return ['build:' + p.regionId];
    if (type === 'REQUEST_GOVERNANCE_CHANGE') return ['gov:' + p.regionId];
    if (type === 'START_NATIONAL_PROJECT') return ['proj:' + p.category];
    if (type === 'CHANGE_NATIONAL_BUDGET') return ['budget:' + p.category];
    if (type === 'ENACT_POLICY') return ['policy:' + p.policyId];
    return [];
  }
  function reservedOf(s, f) { if (!s.dom) return 0; let r = 0; for (const c of s.dom.pendingCommands) if (c.status === 'QUEUED' && c.issuer === f) r += c.reservedGold; return r; }
  function describe(s, type, p) {
    const R = p.regionId ? s.regions[p.regionId] : null, nm = id => id ? s.characters[id].name : '해임';
    if (type === 'SET_CITY_FOCUS') return R.name + ' 중점: ' + (p.domain ? DOMAIN[p.domain].name : '없음');
    if (type === 'ASSIGN_CITY_OFFICER') return R.name + ' ' + (p.slot === 'governor' ? '성주' : '부관 ' + (+p.slot.slice(-1) + 1) + (p.domain ? '(' + DOMAIN[p.domain].name + ')' : '')) + ': ' + nm(p.charId);
    if (type === 'ASSIGN_NATIONAL_OFFICER') return CATNAME[p.category] + ' 담당관: ' + nm(p.charId);
    if (type === 'ASSIGN_ARMY_OFFICER') return '부대 ' + (p.slot === 'commander' ? '주장' : '부장') + ': ' + nm(p.charId);
    if (type === 'START_FACILITY_BUILD') return R.name + ' ' + FACILITY[p.facility].name + ' 착공';
    if (type === 'REQUEST_GOVERNANCE_CHANGE') return R.name + ' ' + (p.to === 'DIRECT' ? (p.force ? '강제 직할' : '직할 전환') : '자치 전환');
    if (type === 'START_NATIONAL_PROJECT') return PROJECTS[p.projectId].name + ' 착수' + (p.targetRegionId ? ' (' + s.regions[p.targetRegionId].name + ')' : '');
    if (type === 'CHANGE_NATIONAL_BUDGET') return CATNAME[p.category] + ' 예산: ' + TIERNAME[p.budgetTier];
    if (type === 'ENACT_POLICY') return PROJECTS[p.policyId].name + ' 시행';
    return type;
  }
  function queueCommand(s, f, type, p, origin) {
    const v = Sim.validate(s, f, type, p); if (!v.ok) return v;
    const key = type + ':' + JSON.stringify(p), keys = conflictKeys(f, type, p), Q = s.dom.pendingCommands;
    if (Q.some(c => c.status === 'QUEUED' && c.idempotencyKey === key)) return no('이미 예약한 명령입니다.');
    let replaced = 0; for (const c of Q) if (c.status === 'QUEUED' && c.issuer === f && c.keys.some(k => keys.indexOf(k) >= 0)) { c.status = 'CANCELLED'; c.note = '새 예약으로 바뀜'; replaced++; }
    const v2 = replaced ? Sim.validate(s, f, type, p) : v; if (!v2.ok) return v2; // 바꿔 끼운 뒤의 가용 국고로 다시 본다
    const cmd = { id: 'dom_cmd_' + (s.nextId++), issuer: f, type, payload: JSON.parse(JSON.stringify(p)), reservedGold: v2.cost || 0, expectedRevision: s.dom.revision, effectiveTick: s.dom.gate.nextUnprocessedTickId, effectivePolicy: 'NEXT_UNPROCESSED_TICK', status: 'QUEUED', idempotencyKey: key, keys, origin: origin || 'MONTHLY_REVIEW', text: Sim.jo(describe(s, type, p)), queuedWeek: s.week, note: '' };
    Q.push(cmd); if (Q.length > 60) Q.splice(0, Q.length - 60);
    return { ok: true, queued: true, id: cmd.id, replaced, reservedGold: cmd.reservedGold };
  }
  function cancelPending(s, id) { const c = s.dom.pendingCommands.find(x => x.id === id && x.status === 'QUEUED'); if (!c) return no('취소할 예약이 없습니다.'); c.status = 'CANCELLED'; c.note = '취소'; return { ok: true }; }
  const pendingOf = (s, f) => s.dom.pendingCommands.filter(c => c.status === 'QUEUED' && c.issuer === f);
  AP.RESUME_FROM_MONTHLY_PAUSE = (s, f) => {
    const Q = pendingOf(s, f).sort((a, b) => (PRIORITY[a.type] - PRIORITY[b.type]) || (a.id < b.id ? -1 : 1)), res = { committed: 0, failed: [] }; // 재검증 순서: 통치 → 인사 → 시행 → 과제 → 예산 → 중점 → 건설
    for (const c of Q) {
      c.status = 'COMMITTING'; c.stale = c.expectedRevision !== s.dom.revision;
      const r = Sim.issueOrder(s, f, c.type, c.payload);
      if (r.ok) { c.status = 'COMMITTED'; c.committedWeek = s.week; res.committed++; }
      else { c.status = 'FAILED'; c.note = r.reason; res.failed.push({ text: c.text, reason: r.reason }); report(s, f, '예약한 명령을 실행하지 못했습니다: ' + c.text + ' (' + r.reason + ')', true); }
    }
    const g = s.dom.gate; g.phase = 'RUNNING'; g.resumeRequired = false; g.nextUnprocessedTickId = null;
    return res;
  };
  // 플레이어·AI 공용 진입점. 월간 정비 중 플레이어의 내정 명령만 예약으로 돌린다
  function command(s, f, type, p, origin) {
    if (s.dom && s.dom.gate.phase === 'PAUSED_MONTHLY' && f === s.playerFactionId && DOMESTIC.indexOf(type) >= 0) return queueCommand(s, f, type, p, origin);
    return Sim.issueOrder(s, f, type, p);
  }
  function setAutoPause(s, on) { s.dom.gate.autoPauseMonthly = !!on; }

  // ───────────────────────── 주간 ─────────────────────────
  function sync(s) {
    const dom = s.dom;
    for (const cid of Object.keys(dom.assignments)) {
      const as = dom.assignments[cid], c = s.characters[cid], sl = parseSlot(as.targetId); let why = null;
      const owner = sl.kind === 'city' ? dom.governanceByRegion[sl.regionId].admin : sl.factionId;
      if (!c || c.status !== 'active') why = '자리를 지킬 수 없게 됨'; else if (c.faction !== owner) why = sl.kind === 'city' ? '거점의 임명권이 바뀜' : '세력을 떠남';
      else if (isRuler(s, c)) why = '군주가 됨'; else if (c.armyId && c.armyId !== 'appoint') why = '출정';
      else if (holderOf(s, as.targetId) !== cid) why = '자리가 없어짐';
      if (why) { clearSlot(s, as.targetId, cid); delete dom.assignments[cid]; report(s, owner || (c && c.faction), (c ? c.name : cid) + '의 보직(' + slotLabel(s, as.targetId) + ')이 비었습니다: ' + why + '.', true, sl.regionId || null); continue; }
      if (as.status === 'TRANSIT' && s.week >= as.effectiveWeek) activate(s, cid);
    }
    for (const R of regs(s)) { // 자리 기록과 주직 장부를 맞춘다
      const cd = dom.cityDomesticByRegion[R.id], g = dom.governanceByRegion[R.id], ok = (cid, id) => cid && dom.assignments[cid] && dom.assignments[cid].targetId === id;
      if (cd.governor && !ok(cd.governor, 'city:' + R.id + ':governor')) cd.governor = null;
      for (let i = 0; i < 2; i++) if (cd.deputies[i] && !ok(cd.deputies[i], 'city:' + R.id + ':deputy:' + i)) { cd.deputies[i] = null; cd.deputyDomains[i] = null; }
      const c = R.controller;
      if (g.admin && g.admin !== c && !(s.factions[c].overlord === g.admin && Sim.vassalAg(s, g.admin, c) && Sim.vassalAg(s, g.admin, c).terms.autonomy === 'direct')) { // 약정이 사라지거나 조건이 바뀌면 직할도 끝난다
        const was = g.admin; releaseCityOfficers(s, R.id, '직할 약정 소멸'); g.admin = c; report(s, was, R.name + ' 직할이 끝났습니다. 약정이 바뀌거나 사라졌습니다.', true, R.id);
      }
      if (g.transition && (g.transition.kind === 'consent' || g.transition.kind === 'force') && !(s.factions[c].overlord === g.transition.by && Sim.vassalAg(s, g.transition.by, c))) g.transition = null;
      if (g.transition && s.week >= g.transition.doneWeek) finishTransition(s, R);
    }
    for (const f of FIDS) for (const cat of CATS) { const sl = dom.nationalProjectsByFaction[f].slots[cat]; if (sl.officerId && !(dom.assignments[sl.officerId] && dom.assignments[sl.officerId].targetId === 'national:' + f + ':' + cat)) sl.officerId = null; }
    syncLords(s);
  }
  function weekly(s) {
    const dom = s.dom; if (!dom) return; sync(s);
    const wn = Sim.weeksOfMonth(Sim.monthKey(s.week - 1)).length || 4;
    for (const f of FIDS) {
      const F = s.factions[f]; if (!F.alive) continue;
      const ad = dom.factionAdministration[f] = adminOf(s, f);
      const pay = (amt, cat) => { const x = Math.min(amt, Math.max(0, F.treasury)); if (x > 0) gold(s, f, -x, cat); return x >= amt - 1e-9; };
      if (!pay(ad.expense, 'admin')) dom.monthFlags[f].adminShort++;
      pay(facilityUpkeep(s, f), 'facility_upkeep'); // 유지비는 완공된 단계만큼만
      const nat = dom.nationalProjectsByFaction[f];
      for (const cat of CATS) { // 월 예산을 그 달의 주 수로 나눠 실제 낸 주만 진척으로 인정한다
        const sl = nat.slots[cat]; if (!sl.projectId) continue;
        if (!officerOn(s, sl.officerId)) { sl.vacantWeeks++; continue; }
        const due = N.budgetTiers[sl.budgetTier].goldMonthly / wn;
        if (F.treasury >= due) { gold(s, f, -due, 'national'); sl.paidInMonth += due; sl.creditWeeks++; } else sl.unpaidWeeks++;
      }
    }
  }

  // ───────────────────────── 월말 결산 ─────────────────────────
  const sidOf = (s, f, mk) => s.scenarioId + ':' + f + ':' + mk;
  function monthName(mk) { const p = mk.split('-'); return (+p[0]) + '년 ' + (+p[1]) + '월'; }
  function monthly(s, mk) {
    const dom = s.dom; if (!dom || dom.lastSettledMonthKey === mk || dom.settlements[sidOf(s, s.playerFactionId, mk)]) return; // 같은 달은 한 번만
    const weeks = Sim.weeksOfMonth(mk).filter(w => w < s.week), wn = weeks.length || 1;
    const cityD = {}, vassalD = {}, alerts = {}, projD = {}; for (const f of FIDS) { cityD[f] = []; vassalD[f] = []; alerts[f] = []; projD[f] = []; }
    // 1) 국정 진척: 당월 실집행·유효 근무 주 기준으로 한 번
    for (const f of FIDS) {
      if (!s.factions[f].alive) continue; const nat = dom.nationalProjectsByFaction[f];
      for (const cat of CATS) {
        const sl = nat.slots[cat]; if (!sl.projectId) continue;
        const def = PROJECTS[sl.projectId], off = sl.officerId ? s.characters[sl.officerId] : null, of = off ? officerFactor(off, cat) : 0, tier = N.budgetTiers[sl.budgetTier];
        const before = sl.progress, delta = N.monthlyBaseProgressPoints[cat] * tier.speedMultiplier * of * (sl.creditWeeks / wn);
        sl.progress = Math.min(100, before + delta);
        const pd = { category: cat, projectId: sl.projectId, name: def.name, targetRegionId: sl.targetRegionId, from: before, to: sl.progress, delta: sl.progress - before, officerId: sl.officerId, officerFactor: of, budgetTier: sl.budgetTier, paid: sl.paidInMonth, committed: tier.goldMonthly, creditWeeks: sl.creditWeeks, vacantWeeks: sl.vacantWeeks, unpaidWeeks: sl.unpaidWeeks, weeks: wn, completed: false, awaitingEnact: false };
        sl.paidInMonth = 0; sl.creditWeeks = 0; sl.vacantWeeks = 0; sl.unpaidWeeks = 0; sl.lastMonthKey = mk;
        if (sl.progress >= 100 - 1e-9) { pd.completed = completeProject(s, f, sl); pd.awaitingEnact = !!def.policy; }
        projD[f].push(pd);
      }
    }
    // 2) 도시 상태: 훈련·안정·민심·불만을 한 번. 국고·군량은 여기서 만들지 않는다
    for (const R of regs(s)) {
      const f = R.controller, cd = dom.cityDomesticByRegion[R.id], g = dom.governanceByRegion[R.id], ov = s.factions[f].overlord, C = ov || f, notes = [];
      const b = { stability: g.stability, morale: R.morale, training: cd.training, grievance: g.grievance }, fc = cd.facilities;
      if (fc.barracks > 0) { const d = fc.barracks * CF.trainingMonthlyChangePerLevel * domainEff(s, R.id, 'military'); cd.training = clamp(cd.training + d, 0, 100); notes.push('병영 Lv' + fc.barracks + ': 훈련도 +' + d.toFixed(1)); }
      else if (cd.training > 50) cd.training = Math.max(50, cd.training - 1);
      let ds = 0; if (fc.guardpost > 0) { const d = fc.guardpost * CF.stabilityMonthlyChangePerLevel * domainEff(s, R.id, 'security'); ds += d; notes.push('경비소 Lv' + fc.guardpost + ': 안정도 +' + d.toFixed(1)); }
      if (R.siege) { ds -= 5; notes.push('포위: 안정도 −5'); } if (R.morale < 35) { ds -= 2; notes.push('민심 ' + R.morale + ': 안정도 −2'); } if (R.starve > 0) { ds -= 3; notes.push('군량 고갈: 안정도 −3'); }
      if (dom.monthFlags[g.admin || f] && dom.monthFlags[g.admin || f].adminShort > 0 && g.admin) { ds -= 1; notes.push('행정비 미지급: 안정도 −1'); }
      if (ds === 0 && fc.guardpost === 0) ds = g.stability < 50 ? 1 : g.stability > 50 ? -1 : 0;
      g.stability = clamp(g.stability + ds, 0, 100);
      if (fc.temple_relief > 0 && !R.siege) { const d = fc.temple_relief * CF.wellbeingMonthlyChangePerLevel * domainEff(s, R.id, 'culture'); cd.moraleAcc += d; const w = Math.floor(cd.moraleAcc); cd.moraleAcc -= w; R.morale = Math.min(95, R.morale + w); notes.push('사찰·구휼소 Lv' + fc.temple_relief + ': 민심 +' + w); }
      if (ov || (kingdomLike(f) && s.factions[f].capitalId !== R.id)) { // 호족·지방의 불만: 달마다 한 번 누적, 먼저 경고
        const ad = adminOf(s, C), G = A.grievance; let p = 0;
        if (ad.ratio > 1) { const x = Math.min(G.overloadMax, Math.ceil((ad.ratio - 1) * 8)); p += x; notes.push(fname(s, C) + ' 행정 과부하(' + ad.ratio.toFixed(2) + '): 불만 +' + x); }
        if (g.stability < 40) { const x = Math.min(G.lowStabilityMax, g.stability < 25 ? 3 : g.stability < 32 ? 2 : 1); p += x; notes.push('안정도 ' + Math.round(g.stability) + ': 불만 +' + x); }
        if (ov && g.admin === ov) { p += G.directOngoing; notes.push('종주 직할: 불만 +' + G.directOngoing); }
        if (p === 0 && g.grievance > 0) { const x = Math.min(G.recoveryMax, 1 + (dom.nationalProjectsByFaction[C].completed['SOC-01'] !== undefined ? N.soc01GrievanceRelief : 0) + (ov ? (Sim.trust(s, f, ov) >= 70 ? 1 : 0) : (g.stability >= 60 ? 1 : 0))); p = -x; notes.push('원인 해소: 불만 −' + x); }
        g.grievance = clamp(g.grievance + p, 0, 100);
        const band = bandOf(g.grievance);
        if (band > g.lastBand) { const txt = R.name + '의 불만이 ' + BANDS[band] + ' 단계(' + Math.round(g.grievance) + ')에 들어섰습니다.' + (band === 4 ? ' 분열 위기 후보입니다. 자치 재보장·포상·예물로 대응할 수 있습니다. 수치만으로 반란이 일어나지는 않습니다.' : ''); const al = { type: band === 4 ? 'CRISIS_CANDIDATE' : 'GRIEVANCE', band, regionId: R.id, text: Sim.jo(txt) }; alerts[C].push(al); if (C !== f) alerts[f].push(al); report(s, C, txt, true, R.id); }
        g.lastBand = band;
        if (ov && A.grievanceTrustDrain[band]) { addTrust(s, f, ov, -A.grievanceTrustDrain[band]); notes.push('불만 ' + BANDS[band] + ': ' + fname(s, ov) + '에 대한 신뢰 −' + A.grievanceTrustDrain[band]); }
      }
      cd.lastSettledMonthKey = mk;
      const row = { regionId: R.id, mode: rights(s, f, R.id).label, stability: [b.stability, g.stability], morale: [b.morale, R.morale], training: [b.training, cd.training], grievance: [b.grievance, g.grievance], vacant: !cd.governor, notes };
      cityD[f].push(row); if (ov) vassalD[ov].push(Object.assign({ factionId: f }, row));
    }
    // 3) 세력별 스냅샷 봉인
    for (const f of FIDS) {
      const F = s.factions[f]; if (!F.alive) continue;
      const lg = Sim.ledgerSum(s, f, weeks), open = dom.monthOpen[f], close = openSnap(s, f), id = sidOf(s, f, mk);
      const ev = s.chronicle.filter(c => weeks.indexOf(c.week - 1) >= 0 && (c.participants.indexOf(f) >= 0 || !c.participants.length || f === s.playerFactionId)).slice(-14).map(c => ({ week: c.week, text: c.text, cause: c.cause || null, regionId: c.regionId }));
      if (dom.monthFlags[f].adminShort > 0) alerts[f].push({ type: 'ADMIN_SHORT', text: '국고가 모자라 행정 유지비를 ' + dom.monthFlags[f].adminShort + '주 동안 다 내지 못했습니다. 직할 거점의 안정도가 내려갑니다.' });
      dom.settlements[id] = { settlementId: id, scenarioId: s.scenarioId, factionId: f, monthKey: mk, status: 'FINALIZED', finalized: true, finalizedAtWeek: s.week, weeks, ledgerEventIds: lg.ids, ledger: { gold: lg.gold, grain: lg.grain },
        resourceDelta: { gold: { open: open.gold, close: close.gold }, grain: { open: open.grain, close: close.grain }, troops: { open: open.troops, close: close.troops } },
        admin: { open: open.admin, close: close.admin }, stability: { open: open.stability, close: close.stability }, morale: { open: open.morale, close: close.morale },
        projectDeltas: projD[f], cityDeltas: cityD[f], vassalDeltas: vassalD[f], politicalAlerts: alerts[f], events: ev, fixture: dom.fixture, lastSettledMonthKey: mk };
      dom.monthOpen[f] = close; dom.monthFlags[f].adminShort = 0;
    }
    dom.lastSettledMonthKey = mk;
    const pf = s.playerFactionId, g = dom.gate;
    if (s.factions[pf].alive) {
      g.activeSettlementId = sidOf(s, pf, mk);
      report(s, pf, monthName(mk) + ' 결산이 끝났습니다.', false);
      if (g.autoPauseMonthly && !s.over) { g.phase = 'PAUSED_MONTHLY'; g.nextUnprocessedTickId = 'tick_' + (s.week + 1); g.resumeRequired = true; } // 다음 틱은 재개 명령이 있어야 돈다
    }
  }
  // 조회 전용: 봉인된 결산의 사본을 준다. 원장·상태를 바꾸지 않는다 (VIEW_MONTHLY_SETTLEMENT)
  function viewSettlement(s, f, mk) { const x = s.dom && s.dom.settlements[sidOf(s, f, mk)]; return x ? JSON.parse(JSON.stringify(x)) : null; }
  function settlementKeys(s, f) { const out = []; for (const id in s.dom.settlements) if (s.dom.settlements[id].factionId === f) out.push(s.dom.settlements[id].monthKey); return out.sort(); }

  // ───────────────────────── 세력 AI (같은 명령·같은 국고) ─────────────────────────
  function aiDomestic(s, f, ctx) {
    const dom = s.dom; if (!dom) return; const cands = [], push = (u, type, params, why, key) => cands.push({ u, type, params, why, key }); const F = s.factions[f], P = D.AIP[f], nat = dom.nationalProjectsByFaction[f], mem = dom.ai[f], sm = Sim.factionSummary(s, f), net = sm.income - sm.gold, reserve = ctx.reserve;
    const ok = (t, p) => Sim.validate(s, f, t, p).ok, wn = 4;
    for (const pid in PROJECTS) if (PROJECTS[pid].policy && ok('ENACT_POLICY', { policyId: pid })) push(0.5, 'ENACT_POLICY', { policyId: pid }, PROJECTS[pid].name + ' 연구를 마쳐 시행', 'POLICY');
    // 국정: 형편이 되는 분야부터 담당관을 두고 과제를 연다
    const cats = P.kingdom ? CATS : ['SOC'];
    for (const cat of cats) {
      const sl = nat.slots[cat], next = N.initialPrototypeContent[cat].find(id => nat.completed[id] === undefined && PROJECTS[id].req.every(r => nat.completed[r] !== undefined) && !PROJECTS[id].target) || (cat === 'PRJ' ? 'PRJ-02' : null);
      if (sl.projectId) { if (sl.budgetTier !== 'ECONOMY' && (F.treasury < reserve + 60 || net < 0) && ok('CHANGE_NATIONAL_BUDGET', { category: cat, budgetTier: 'ECONOMY' })) push(0.4, 'CHANGE_NATIONAL_BUDGET', { category: cat, budgetTier: 'ECONOMY' }, '국고 ' + Math.round(F.treasury) + ', 주간 수지 ' + Math.round(net) + ': ' + CATNAME[cat] + ' 예산을 절약으로', 'BUDGET:' + cat); continue; }
      if (!next) continue;
      const tier = F.treasury > reserve + 500 && net > 30 ? 'STANDARD' : 'ECONOMY', g = N.budgetTiers[tier].goldMonthly;
      if (net < g / wn + 2 || F.treasury < reserve + g * 2) continue;
      if (!sl.officerId) {
        const pool = Object.values(s.characters).filter(c => c.faction === f && c.status === 'active' && !isRuler(s, c) && !c.armyId && !primaryOf(s, c.id) && c.loc === F.capitalId).sort((a, b) => b.ld - a.ld || (a.id < b.id ? -1 : 1));
        const cand = pool.slice(P.kingdom ? 1 : 0).sort((a, b) => fit(b, cat) - fit(a, cat) || (a.id < b.id ? -1 : 1))[0]; // 으뜸 장수는 전선을 위해 남긴다
        if (cand && ok('ASSIGN_NATIONAL_OFFICER', { category: cat, charId: cand.id })) push(0.34, 'ASSIGN_NATIONAL_OFFICER', { category: cat, charId: cand.id }, CATNAME[cat] + ' 담당관에 ' + cand.name + '(적성 ' + fit(cand, cat) + ')', 'NATOFF');
        continue;
      }
      const p = { category: cat, projectId: next, budgetTier: tier };
      if (PROJECTS[next].target) { const T = regs(s).filter(r => r.controller === f && rights(s, f, r.id).can && !dom.cityDomesticByRegion[r.id].granary && !r.siege).sort((a, b) => b.tax - a.tax || (a.id < b.id ? -1 : 1))[0]; if (!T) continue; p.targetRegionId = T.id; }
      if (ok('START_NATIONAL_PROJECT', p)) push(0.36, 'START_NATIONAL_PROJECT', p, PROJECTS[next].name + ' 착수(' + TIERNAME[tier] + ' 예산, 주간 수지 ' + Math.round(net) + ')', 'PROJ:' + cat);
    }
    // 도시: 여유가 있을 때 한 곳에 한 시설
    if (ctx.gw >= 12 && net > 6) {
      let best = null;
      for (const R of ctx.mine) {
        if (R.siege || !rights(s, f, R.id).can) continue; const cd = dom.cityDomesticByRegion[R.id], g = dom.governanceByRegion[R.id]; if (cd.facilityConstruction) continue;
        const thr = Sim.threatTo(s, f, R.id) / Math.max(1, Sim.defenseOf(s, R.id));
        const want = g.stability < 40 ? 'guardpost' : R.morale < 45 ? 'temple_relief' : cd.facilities.market <= cd.facilities.irrigation ? 'market' : 'irrigation';
        const lv = cd.facilities[want]; if (lv >= CF.maxLevel) continue; const cost = CF.goldCostByNewLevel[lv + 1];
        if (F.treasury < reserve + cost + 250) continue;
        const sc = R.tax / 100 - lv * 0.3 - thr * 0.3 + (want === 'guardpost' || want === 'temple_relief' ? 0.4 : 0); if (!best || sc > best.sc) best = { R, want, cost, sc, lv };
      }
      if (best && ok('START_FACILITY_BUILD', { regionId: best.R.id, facility: best.want })) push(0.26 + Math.min(0.06, best.R.tax / 2000), 'START_FACILITY_BUILD', { regionId: best.R.id, facility: best.want }, best.R.name + ' ' + FACILITY[best.want].name + ' Lv' + (best.lv + 1) + ' 착공(국고 ' + best.cost + ')', 'BUILD');
      const cap = s.regions[F.capitalId]; if (cap.controller === f && dom.cityDomesticByRegion[cap.id].focusDomain === null && ok('SET_CITY_FOCUS', { regionId: cap.id, domain: 'commerce' })) push(0.25, 'SET_CITY_FOCUS', { regionId: cap.id, domain: 'commerce' }, cap.name + ' 중점을 상업으로', 'FOCUS');
    }
    // 통치: 불만이 높으면 자치를 되돌리고, 과부하면 먼 거점을 자치에 맡긴다. 직할 요청은 합의로만
    const ad = adminOf(s, f);
    for (const R of regs(s)) {
      const c = R.controller, g = dom.governanceByRegion[R.id];
      if (s.factions[c].overlord === f && g.admin === f && g.grievance >= A.grievanceThresholds[2] && ok('REQUEST_GOVERNANCE_CHANGE', { regionId: R.id, to: 'AUTONOMOUS' })) push(0.45, 'REQUEST_GOVERNANCE_CHANGE', { regionId: R.id, to: 'AUTONOMOUS' }, R.name + ' 불만 ' + Math.round(g.grievance) + ': 자치 재보장', 'GOV');
      else if (P.kingdom && s.factions[c].overlord === f && g.admin === c && s.week >= 8 && Sim.trust(s, f, c) >= 80 && (ad.burden + A.burdenDirect - A.burdenAutonomous) <= ad.capacity && s.week - (mem['direct:' + c] === undefined ? -99 : mem['direct:' + c]) >= 24 && ok('REQUEST_GOVERNANCE_CHANGE', { regionId: R.id, to: 'DIRECT' })) { mem['direct:' + c] = s.week; push(0.3, 'REQUEST_GOVERNANCE_CHANGE', { regionId: R.id, to: 'DIRECT' }, fname(s, c) + ' 신뢰 ' + Sim.trust(s, f, c) + ', 행정 여력 있음: ' + R.name + ' 합의 직할 요청', 'GOV'); }
    }
    if (ad.ratio > 1.2 + 1e-9) { const T = regs(s).filter(r => r.controller === f && dom.governanceByRegion[r.id].admin === f && r.id !== F.capitalId && !r.siege && !dom.governanceByRegion[r.id].transition).sort((a, b) => a.tax - b.tax || (a.id < b.id ? -1 : 1))[0]; if (T && ok('REQUEST_GOVERNANCE_CHANGE', { regionId: T.id, to: 'AUTONOMOUS' })) push(0.32, 'REQUEST_GOVERNANCE_CHANGE', { regionId: T.id, to: 'AUTONOMOUS' }, '행정 과부하 ' + ad.ratio.toFixed(2) + ': ' + T.name + '을(를) 지방 자치에', 'GOV'); }
    cands.sort((a, b) => b.u - a.u || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    for (const c of cands) { const r = Sim.issueOrder(s, f, c.type, c.params, { u: Math.round(c.u * 100) / 100, why: Sim.jo(c.why) }); if (r.ok) break; } // 한 주에 한 가지
  }

  // ───────────────────────── 엔진 훅 연결 ─────────────────────────
  EXT.init = initDomestic;
  EXT.migrate = s => { if (!s.dom) { initDomestic(s, {}); s.dom.audit.push({ week: s.week, code: 'MIGRATED', note: 'v3 세이브에서 내정 상태를 유도해 초기화' }); } };
  EXT.incomeMult = (s, r) => s.dom ? incomeMultOf(s, r) : 1;
  EXT.harvestMult = (s, r) => s.dom ? harvestMultOf(s, r) : 1;
  EXT.moraleGoalAdj = (s, r) => s.dom ? s.dom.cityDomesticByRegion[r.id].facilities.temple_relief * 2 + Math.round((s.dom.governanceByRegion[r.id].stability - 50) / 10) : 0;
  EXT.trainingOf = (s, R) => s.dom ? s.dom.cityDomesticByRegion[R.id].training : 50;
  EXT.recruitWeeks = (s, f) => s.dom && s.dom.nationalProjectsByFaction[f].completed['MIL-01'] !== undefined ? N.mil01RecruitWeeks : K.recruitWeeks;
  EXT.unitLocked = (s, f, r) => {
    if (!s.dom || s.dom.nationalProjectsByFaction[f].completed['MIL-02'] === undefined) return '신형 중장보병 편제는 군사 연구(MIL-02)를 마쳐야 모을 수 있습니다.';
    if (s.dom.cityDomesticByRegion[r.id].facilities.barracks < N.unitMil02.minBarracksLevel) return r.name + '에 병영 Lv' + N.unitMil02.minBarracksLevel + ' 이상이 있어야 중장보병을 모을 수 있습니다.';
    return null;
  };
  EXT.busy = (s, cid) => !!(s.dom && s.dom.assignments[cid]);
  EXT.reserved = reservedOf;
  EXT.gateBlocks = s => !!(s.dom && s.dom.gate.phase === 'PAUSED_MONTHLY');
  EXT.weekly = weekly; EXT.monthly = monthly; EXT.ai = aiDomestic; EXT.weeklyCost = weeklyCost;
  EXT.onLeave = (s, cid, why) => { // 출정·부임으로 내정 보직을 떠난다 (군직 등록과 한 묶음)
    if (!s.dom) return; const as = s.dom.assignments[cid], c = s.characters[cid]; if (!as) return;
    const label = slotLabel(s, as.targetId), rid = parseSlot(as.targetId).regionId || null; clearSlot(s, as.targetId, cid); s.dom.revision++;
    report(s, c.faction, c.name + '이(가) ' + label + ' 자리를 비우고 ' + (why === 'army' ? '출정합니다.' : '새 임지로 떠납니다.'), true, rid);
  };
  EXT.onAppoint = (s, R, c) => { // 기존 성주 임명(APPOINT)이 끝나면 실무 성주로도 등록
    if (!s.dom) return; const cd = s.dom.cityDomesticByRegion[R.id]; if (s.dom.governanceByRegion[R.id].admin !== c.faction) return;
    if (cd.governor && cd.governor !== c.id) clearSlot(s, 'city:' + R.id + ':governor', cd.governor);
    cd.governor = c.id; s.dom.assignments[c.id] = { characterId: c.id, type: 'CITY_GOVERNOR', targetId: 'city:' + R.id + ':governor', effectiveWeek: s.week, status: 'ACTIVE' };
  };
  EXT.onCapture = (s, R, old, nf) => { // 점령: 담당관·공사는 끊기고, 새 주인의 직할이 된다
    if (!s.dom) return; const g = s.dom.governanceByRegion[R.id];
    releaseCityOfficers(s, R.id, R.name + ' 함락'); g.admin = nf; g.transition = null; g.grievance = Math.max(g.grievance, 30); g.stability = clamp(g.stability - 15, 0, 100); g.lastBand = bandOf(g.grievance);
  };

  // ───────────────────────── 조회 (UI·QA 공용) ─────────────────────────
  function cityView(s, f, rid) {
    const R = s.regions[rid], cd = s.dom.cityDomesticByRegion[rid], g = s.dom.governanceByRegion[rid], rt = rights(s, f, rid), base = R.tax * R.morale / 100 * (1 - R.autonomy / 100 * 0.7), ad = adminOf(s, R.controller);
    const domains = DOMAINS.map(d => { const fid = DOMAIN[d].facility, lv = cd.facilities[fid], building = cd.facilityConstruction && cd.facilityConstruction.facility === fid ? cd.facilityConstruction : null;
      return { id: d, name: DOMAIN[d].name, measure: DOMAIN[d].measure, facilityId: fid, facility: FACILITY[fid].name, effect: FACILITY[fid].effect, level: lv, nextCost: lv < CF.maxLevel ? CF.goldCostByNewLevel[lv + 1] : null, building, eff: domainEff(s, rid, d), focus: cd.focusDomain === d, deputyBonus: deputyBonus(s, rid, d) }; });
    return { rights: rt, gov: g, cd, domains, governorFactor: governorFactor(s, rid), band: bandOf(g.grievance), bandName: BANDS[bandOf(g.grievance)],
      income: { base, mult: incomeMultOf(s, R), actual: Sim.regionIncome(s, R), collection: ad.eff }, harvestMult: harvestMultOf(s, R), upkeep: Object.values(cd.facilities).reduce((a, b) => a + b, 0) * CF.weeklyUpkeepPerLevel };
  }
  function nationalView(s, f) {
    const nat = s.dom.nationalProjectsByFaction[f], wn = Sim.weeksOfMonth(Sim.monthKey(s.week)).length || 4;
    return CATS.map(cat => {
      const sl = nat.slots[cat], off = sl.officerId ? s.characters[sl.officerId] : null, as = off && s.dom.assignments[off.id], tier = N.budgetTiers[sl.budgetTier], of = off ? officerFactor(off, cat) : 0;
      const perMonth = N.monthlyBaseProgressPoints[cat] * tier.speedMultiplier * of, eta = sl.projectId && perMonth > 0 ? Math.ceil((100 - sl.progress) / perMonth) : null;
      const list = N.initialPrototypeContent[cat].map(id => { const def = PROJECTS[id], done = !def.target && nat.completed[id] !== undefined; return { id, def, done, enacted: nat.enacted[id] !== undefined, saved: nat.saved[id] || 0, locked: def.req.filter(r => nat.completed[r] === undefined), active: sl.projectId === id, granaries: def.target ? Object.keys(nat.completed).filter(k => k.indexOf(id + '@') === 0).map(k => k.split('@')[1]) : [] }; });
      return { cat, name: CATNAME[cat], slot: sl, officer: off, officerStatus: as ? as.status : null, officerArrives: as ? as.effectiveWeek : null, officerFactor: of, tier: sl.budgetTier, monthly: tier.goldMonthly, weeklyDue: tier.goldMonthly / wn, perMonth, etaMonths: eta, list };
    });
  }
  // 임명 팝업 우측: 지금 담당자와 견준 예상 효과, 떠나는 자리의 공백
  function assignEffect(s, f, slotId, cid, domain) {
    const sl = parseSlot(slotId), c = s.characters[cid], cur = holderOf(s, slotId), cc = cur ? s.characters[cur] : null, out = { gain: [], loss: [] }, pc = v => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%';
    if (!c) return out;
    if (sl.kind === 'city' && sl.role === 'governor') { const g = p => clamp(1 + (p - 50) * 0.002, O.governorEfficiencyFloor, O.governorEfficiencyCeil) - 1; out.gain.push('도시 5분야 효율 ' + pc(cc ? g(cc.po) : 0) + ' → ' + pc(g(c.po)) + ' (정치 ' + c.po + ')'); out.gain.push('민심이 머무는 자리 ' + (50 + Math.round(c.po / 4)) + ' (성주 자리가 비어 있을 때)'); }
    else if (sl.kind === 'city') { const cd = s.dom.cityDomesticByRegion[sl.regionId], other = cd.deputies[1 - sl.idx], second = other && other !== cid && cd.deputyDomains[1 - sl.idx] === domain && sl.idx === 1; const b = (second ? O.secondSameDomainDeputyBonus : O.firstDeputySpecialistBonus) * deputyScale(c, domain); out.gain.push(DOMAIN[domain].name + ' 효율 +' + (b * 100).toFixed(1) + '%' + (second ? ' (같은 분야 둘째 부관이라 절반)' : '') + ' · 적성 ' + fit(c, domain)); }
    else if (sl.kind === 'national') { const a = cc ? officerFactor(cc, sl.cat) : 0, b = officerFactor(c, sl.cat), base = N.monthlyBaseProgressPoints[sl.cat]; out.gain.push(CATNAME[sl.cat] + ' 진척 월 ' + (base * a).toFixed(1) + '%p → ' + (base * b).toFixed(1) + '%p (표준 예산 기준, 적성 ' + fit(c, sl.cat) + ')'); if (!cc) out.gain.push('담당관이 없으면 과제를 시작할 수 없고, 진행 중인 과제도 멈춥니다.'); }
    else { const k = v => clamp(1 + 0.004 * (v - 50), 0.8, 1.2) - 1; if (sl.role === 'commander') out.gain.push('부대 지휘 보정 ' + pc(cc ? k(cc.ld) : 0) + ' → ' + pc(k(c.ld)) + ' (통솔 ' + c.ld + ')'); else out.gain.push('선봉 무력 ' + c.ma + ' · 참모 지략 ' + c.st + ' · 다병종 지휘 부담을 덜어 줌'); }
    const pr = primaryOf(s, cid);
    if (pr && pr.slotId && pr.slotId !== slotId) {
      const ps = parseSlot(pr.slotId);
      if (ps.kind === 'army') { const k = clamp(1 + 0.004 * (c.ld - 50), 0.8, 1.2) - 1, a = s.armies[ps.armyId]; out.loss.push(pr.label + ' 자리가 빕니다' + (ps.role === 'commander' ? ': 병력 ' + Sim.total(a.units).toLocaleString('ko-KR') + '명의 지휘 보정 ' + pc(k) + ' → 0% (통솔 50 취급)' : ': 선봉·참모 한 명이 빠집니다')); }
      else if (ps.kind === 'city' && ps.role === 'governor') out.loss.push(pr.label + ' 자리가 빕니다: 도시 효율 ' + pc(clamp(1 + (c.po - 50) * 0.002, 0.9, 1.1) - 1) + ' → 0%, 민심이 머무는 자리 45');
      else if (ps.kind === 'city') { const d = s.dom.cityDomesticByRegion[ps.regionId].deputyDomains[ps.idx]; out.loss.push(pr.label + ' 자리가 빕니다' + (d ? ': ' + DOMAIN[d].name + ' 효율 −' + (O.firstDeputySpecialistBonus * deputyScale(c, d) * 100).toFixed(1) + '%' : '')); }
      else out.loss.push(pr.label + ' 자리가 빕니다: ' + CATNAME[ps.cat] + ' 과제가 담당관을 다시 둘 때까지 멈춥니다');
    }
    if (c.loyalty < 40) out.loss.push('충성 ' + c.loyalty + ': 믿고 맡기기에는 위태롭습니다');
    return out;
  }
  function governancePreview(s, f, rid, to, force) {
    const v = Sim.validate(s, f, 'REQUEST_GOVERNANCE_CHANGE', { regionId: rid, to, force: !!force }); if (!v.ok) return v;
    const R = s.regions[rid], out = { ok: true, kind: v.kind, cost: v.cost || 0, weeks: v.weeks, lines: [] }, G = A.grievance, ad = adminOf(s, f), d = A.burdenDirect - A.burdenAutonomous;
    const after = b => { const r = b / ad.capacity; return r.toFixed(2) + ' (징수 효율 ' + Math.round(clamp(1 - A.collectionOverextensionFactor * Math.max(0, r - 1), A.collectionEfficiencyFloor, 1) * 100) + '%)'; };
    if (v.kind === 'consent') { const sc = directScore(s, f, R.controller); out.score = sc.score; out.parts = sc.parts; out.label = sc.score >= 6 ? '유리' : sc.score >= -6 ? '접전' : '불리'; out.lines.push('사신이 ' + K.envoyWeeks + '주 뒤 답을 가져옵니다. 받아들이면 ' + A.transitionWeeks + '주 뒤 임명권이 넘어옵니다.'); }
    if (v.kind === 'force') out.lines.push('뜻을 묻지 않고 밀어붙입니다: 불만 +' + G.forcedDirect + ', 신뢰 ' + G.forcedTrust + '. 곧바로 반란이 일어나지는 않지만 불만이 쌓이면 신뢰가 달마다 깎입니다.');
    if (to === 'DIRECT') out.lines.push('행정 부담 ' + (ad.burden / ad.capacity).toFixed(2) + ' → ' + after(ad.burden + d) + ', 행정 유지비 주당 +' + (A.weeklyGoldCostDirect - A.weeklyGoldCostAutonomous));
    else out.lines.push('행정 부담 ' + (ad.burden / ad.capacity).toFixed(2) + ' → ' + after(ad.burden - d) + ', 행정 유지비 주당 −' + (A.weeklyGoldCostDirect - A.weeklyGoldCostAutonomous) + (v.kind === 'delegate' ? '. 담당관과 공사는 철수하고, 중앙에 들어오는 세수가 줄어듭니다 (자치도 ' + R.autonomy + ' → ' + A.delegatedAutonomy + ').' : '. 보낸 담당관은 철수하고 상납이 사라집니다. 불만 ' + G.reassure + ', 신뢰 +' + G.reassureTrust + '.'));
    if (v.kind === 'own') out.lines.push('직할로 돌리면 임명·건설을 할 수 있고 세수 귀속이 늘어납니다 (자치도 ' + R.autonomy + ' → ' + A.directAutonomy + '). 지방의 불만 +' + G.ownDirect + '.');
    return out;
  }

  const api = { BAL, DOMAINS, DOMAIN, FACILITY, CATS, CATNAME, TIERNAME, PROJECTS, BANDS, DOMESTIC, initDomestic, applyFixture, rights, adminOf, bandOf, fit, parseSlot, slotLabel, holderOf, primaryOf, candidateStatus, candidates, domainEff, governorFactor, deputyBonus, officerFactor,
    cityView, nationalView, assignEffect, governancePreview, command, queueCommand, cancelPending, pendingOf, reservedOf, setAutoPause, viewSettlement, settlementKeys, sidOf, monthName, weeklyCost, facilityUpkeep, describe, troopsOf };
  Sim.dom = api;
  return api;
});
