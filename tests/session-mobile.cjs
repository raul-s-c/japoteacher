// Browser plugin is unavailable. Exercise the actual app with bundled Playwright,
// an isolated IndexedDB and synthetic history; never connect to a real account.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/fixture') {
      res.setHeader('Content-Type', 'text/html');
      return res.end('<script src="src/db.js"></script><script src="src/schema-validation.js"></script><script src="src/csv-import.js"></script>');
    }
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'text/plain');
    fs.readFile(file, (error, body) => { if (error) res.writeHead(404); res.end(error ? 'Not found' : body); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block', timezoneId: 'Europe/Madrid' });
    await context.route('**/*', route => {
      if (!route.request().url().startsWith(origin)) return route.fulfill({ status: 200, body: '' });
      if (new URL(route.request().url()).pathname === '/src/cloud-sync.js') return route.fulfill({ contentType: 'text/javascript', body: 'window.CloudSync={initialSync:Promise.resolve(),flush:async()=>{},getAccessToken:async()=>null,getUserId:()=>null,getClient:()=>null};' });
      return route.continue();
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(origin + '/fixture');
    const seed = await page.evaluate(async () => {
      await JapoDB.open();
      await CsvImport.importText(await (await fetch('/data/exercises.full.csv')).text());
      const bank = (await JapoDB.all('exercises')).filter(e => e.active !== false), ja = bank.filter(e => e.direction === 'ja_es'), es = bank.filter(e => e.direction === 'es_ja');
      const today = new Date().toLocaleDateString('en-CA'), sessionId = 'local-default::' + today, now = new Date().toISOString();
      const row = { session_id: sessionId, profile_id: 'local-default', local_date: today, created_at: now,
        exercise_ids_ja_es_json: JSON.stringify(ja.slice(0, 22).map(e => e.exercise_id)), exercise_ids_es_ja_json: JSON.stringify(es.slice(0, 11).map(e => e.exercise_id)),
        voluntary_repeat_ids_ja_es_json: JSON.stringify(ja.slice(20, 22).map(e => e.exercise_id)), voluntary_repeat_ids_es_ja_json: JSON.stringify([es[10].exercise_id]),
        completed_exercise_ids_json: JSON.stringify([ja[0].exercise_id]), drafts_json: JSON.stringify({ [ja[1].exercise_id]: 'Borrador de prueba' }) };
      const settings = { profileId: 'local-default', profileName: 'Prueba SRS', levels: ['N5','N4','N3','N2','N1'], dailyJaEs: 20, dailyEsJa: 10, newRatio: 90, cooldownDays: 14, settingsSchemaVersion: 3, aiProvider: 'mock' };
      await JapoDB.put('settings', { key: 'app', value: settings });
      await JapoDB.put('daily_sessions', row);
      await JapoDB.put('attempts', { attempt_id: 'fixture-done', profile_id: 'local-default', exercise_id: ja[0].exercise_id, direction: 'ja_es', attempted_at: now, overall_score: 90, is_acceptable: true, evaluation_status: 'valid' });
      localStorage.setItem('japoteacher_bank_version', '20260903-editorial-140');
      return { sessionId, done: ja[0].exercise_id, draft: ja[1].exercise_id, repeatJa: ja.slice(20, 22).map(e => e.exercise_id), repeatEs: [es[10].exercise_id] };
    });
    await page.goto(origin + '/');
    await page.waitForFunction(() => document.querySelector('#directionCards').children.length >= 2 && !document.querySelector('#routeLoader').classList.contains('active'));
    const session = () => page.evaluate(id => JapoDB.get('daily_sessions', id), seed.sessionId);
    const before = await session();
    await page.locator('#regenerateSelectionButton').click();
    await page.locator('#cancelRegenerateSelection').click();
    assert.equal((await session()).plan_updated_at, before.plan_updated_at);
    for (const width of [360, 420, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.locator('#regenerateSelectionButton').click();
      const bounds = await page.locator('#regenerateSelectionDialog').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= 800);
      await page.screenshot({ path: path.join(process.env.TEMP, `japoteacher-srs-dialog-${width}.png`) });
      const previous = await session();
      await page.locator('#confirmRegenerateSelection').click();
      await page.waitForFunction(() => !document.querySelector('#regenerateSelectionDialog').open);
      const updated = await session(), ja = JSON.parse(updated.exercise_ids_ja_es_json), es = JSON.parse(updated.exercise_ids_es_ja_json);
      assert.equal(ja.length, 22); assert.equal(es.length, 11);
      assert.notEqual(updated.exercise_ids_ja_es_json, previous.exercise_ids_ja_es_json);
      assert.ok(ja.includes(seed.done) && ja.includes(seed.draft));
      assert.deepEqual(JSON.parse(updated.voluntary_repeat_ids_ja_es_json), seed.repeatJa);
      assert.deepEqual(JSON.parse(updated.voluntary_repeat_ids_es_ja_json), seed.repeatEs);
      assert.equal(JSON.parse(updated.drafts_json)[seed.draft], 'Borrador de prueba');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(process.env.TEMP, `japoteacher-srs-hoy-${width}.png`) });
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.locator('#continueButton').click();
    await page.locator(`[data-exercise-id="${seed.draft}"]`).click();
    await page.waitForFunction(id => document.querySelector('#sourceText').dataset.exerciseId === id, seed.draft);
    assert.equal(await page.locator('#answerInput').inputValue(), 'Borrador de prueba');
    await page.locator('#answerInput').fill('Borrador nuevo sin guardar');
    await page.locator('.nav-item[data-view="hoy"]:visible').click();
    await page.locator('#regenerateSelectionButton').click();
    await page.locator('#confirmRegenerateSelection').click();
    await page.waitForFunction(() => !document.querySelector('#regenerateSelectionDialog').open);
    assert.equal(JSON.parse((await session()).drafts_json)[seed.draft], 'Borrador nuevo sin guardar');
    const latest = await session();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#directionCards').children.length >= 2 && !document.querySelector('#routeLoader').classList.contains('active'));
    assert.equal((await session()).exercise_ids_ja_es_json, latest.exercise_ids_ja_es_json);
    assert.equal(await page.evaluate(() => JapoDB.all('attempts').then(rows => rows.length)), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: actual app at 360/420/1280px; cancel, regenerate, completed, saved/unsaved drafts, voluntary extras, reload, no console errors.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
