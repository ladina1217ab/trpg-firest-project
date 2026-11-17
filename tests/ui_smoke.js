const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 1440, height: 810 } }), errs = [];
  pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await pg.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await pg.waitForTimeout(800);
  const shot = n => pg.screenshot({ path: path.join(__dirname, '..', 'BUILD_G1_DELIVERY', 'evidence', n) });
  await shot('s00_start.png');
  await pg.click('[data-act="pick"][data-v="goryeo"]'); await pg.waitForTimeout(400); await shot('s01_map.png');
  await pg.click('[data-act="ltab"][data-v="city"]'); await pg.waitForTimeout(200);
  await pg.click('#rail [data-v="nation"]'); await pg.waitForTimeout(200); await shot('s02_city_nation.png');
  await pg.click('[data-act="opk"][data-slot="city:gaegyeong:deputy:0"]'); await pg.waitForTimeout(200);
  await pg.click('tr[data-id="baksulhui"]'); await pg.waitForTimeout(200); await shot('s03_picker.png');
  await pg.click('#opk-next'); await pg.click('#opk-go'); await pg.waitForTimeout(200);
  for (let i = 0; i < 4; i++) { await pg.click('[data-act="step"]'); await pg.waitForTimeout(150); }
  await shot('s04_review.png');
  console.log(JSON.stringify({ errs, week: await pg.evaluate(() => __G.s.week), phase: await pg.evaluate(() => __G.s.dom.gate.phase) }));
  await b.close();
})();
