// G1-REG-01: 내정을 끈 새 엔진이 R3 기준선 엔진과 60주 동안 같은 전개를 내는지 비교한다.
const B = require('./baseline_sim_r3.js'), N = require('../src/sim.js');
const pick = s => JSON.stringify({ w: s.week, over: s.over, ch: s.chronicle, fac: Object.values(s.factions).map(f => [f.id, f.treasury, f.grain, f.overlord, f.alive, f.legitimacy]), reg: Object.values(s.regions).map(r => [r.id, r.controller, r.overlord, r.lord, r.morale, r.grain, r.fort, r.garrison.light, r.garrison.heavy, r.garrison.archer, r.garrison.cav]), trust: s.trust, log: s.log.length });
function run(seedList) {
  const out = [];
  for (const pf of ['goryeo', 'hubaekje', 'gochang']) for (const seed of seedList) {
    const a = B.newGame(pf, seed), b = N.newGame(pf, seed, { domestic: false });
    let same = true, at = null;
    for (let i = 0; i < 60 && same; i++) { B.tick(a); N.tick(b); if (pick(a) !== pick(b)) { same = false; at = i + 1; } }
    out.push({ player: pf, seed, same, divergedAtWeek: at, weeks: a.week, chronicle: a.chronicle.length });
  }
  return out;
}
module.exports = { run };
if (require.main === module) { const r = run([929, 7, 31337]); console.log(JSON.stringify(r)); process.exit(r.every(x => x.same) ? 0 : 1); }
