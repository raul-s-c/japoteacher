// Browser plugin not available: bundled Playwright, isolated profile and mock
// evaluation. The actual reviewed collection and app code are exercised.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end('<script src="src/db.js"></script><script src="src/schema-validation.js"></script><script src="src/csv-import.js"></script>')}
    const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');
    fs.readFile(file,(error,body)=>{if(error)res.writeHead(404);res.end(error?'Not found':body)});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',timezoneId:'Europe/Madrid'});
    await context.route('**/*',route=>{
      if(!route.request().url().startsWith(origin))return route.fulfill({status:200,body:''});
      if(new URL(route.request().url()).pathname==='/src/cloud-sync.js')return route.fulfill({contentType:'text/javascript',body:'window.CloudSync={initialSync:Promise.resolve(),flush:async()=>{},getAccessToken:async()=>null,getUserId:()=>null,getClient:()=>null};'});
      return route.continue();
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/fixture');
    await page.evaluate(async()=>{
      await JapoDB.open();await CsvImport.importText(await(await fetch('/data/exercises.full.csv')).text(),{syncScope:'editorial'});
      await JapoDB.put('settings',{key:'app',value:{profileId:'local-default',profileName:'QA Sakamoto',levels:['N5','N4'],dailyJaEs:15,dailyEsJa:15,newRatio:100,cooldownDays:14,settingsSchemaVersion:3,aiProvider:'mock',furigana:true,studyCollection:'',collectionRatio:70}});
      localStorage.setItem('japoteacher_bank_version','20260904-editorial-52');
    });
    const started=Date.now();await page.goto(origin+'/');
    await page.waitForFunction(()=>document.querySelector('#directionCards').children.length>=2&&!document.querySelector('#routeLoader').classList.contains('active'));
    const firstLoadMs=Date.now()-started;
    await page.locator('.nav-item[data-view="ajustes"]:visible').click();
    await page.locator('select[name="studyCollection"]').selectOption('sakamoto');
    await page.waitForFunction(async()=>JSON.parse((await JapoDB.all('daily_sessions'))[0].selection_reason_json).study_collection==='sakamoto');
    await page.locator('#recalculateDayFromSettings').click();await page.locator('#confirmRegenerateSelection').click();
    await page.waitForFunction(()=>!document.querySelector('#regenerateSelectionDialog').open);
    const selected=await page.evaluate(async()=>{
      const session=(await JapoDB.all('daily_sessions'))[0],bank=await JapoDB.all('exercises'),byId=new Map(bank.map(e=>[e.exercise_id,e]));
      return {session,bank,ja:JSON.parse(session.exercise_ids_ja_es_json).map(id=>byId.get(id)),es:JSON.parse(session.exercise_ids_es_ja_json).map(id=>byId.get(id))};
    });
    for(const rows of [selected.ja,selected.es]){assert.equal(rows.length,15);assert.equal(rows.filter(e=>e.source_collection==='sakamoto').length,11)}
    const target=selected.ja.find(e=>e.source_collection==='sakamoto'&&/[一-龯]/.test(e.source_text));assert(target);
    const terms=await page.evaluate(({session,bank})=>DailyLesson.buildPlan(session,bank).terms,selected);
    assert(target.vocabulary_tags.every(t=>terms.includes(t)));
    await page.locator('.nav-item[data-view="hoy"]:visible').click();await page.locator('.direction-start[data-direction="ja_es"]').click();
    await page.locator(`[data-exercise-id="${target.exercise_id}"]`).click();
    await page.waitForFunction(id=>document.querySelector('#sourceText').dataset.exerciseId===id,target.exercise_id);
    assert((await page.locator('#topicLabel').textContent()).includes('Sakamoto'));
    assert(await page.locator('#sourceText ruby').count()>0);
    await page.locator('#dictionaryToggle').click();assert(await page.locator('#dictionaryPanel').isVisible());assert(await page.locator('#questionHelpToggle').isVisible());
    for(const width of [390,1280]){
      await page.setViewportSize({width,height:844});await page.locator('#sourceText').scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:path.join(process.env.TEMP,`japoteacher-sakamoto-${width}.png`)});
    }
    await page.locator('#answerInput').fill(target.reference_translation);await page.locator('#evaluateButton').click();
    await page.waitForFunction(()=>document.querySelector('#feedbackPanel').dataset.attemptId&& !document.querySelector('#evaluateButton').disabled);
    const result=await page.evaluate(async()=>({attempts:await JapoDB.all('attempts'),progress:await JapoDB.all('exercise_progress'),payload:await JapoDB.exportProfilePayload?.()}));
    assert(result.attempts.some(a=>a.exercise_id===target.exercise_id&&a.overall_score===100));assert(result.progress.some(p=>p.exercise_id===target.exercise_id&&p.total_attempts===1));
    await page.reload();await page.waitForFunction(()=>document.querySelector('#directionCards').children.length>=2&&!document.querySelector('#routeLoader').classList.contains('active'));
    assert.equal(await page.evaluate(async()=>new Set((await JapoDB.all('exercises')).map(e=>e.exercise_id)).size),selected.bank.length);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({pass:true,firstLoadMs,sourcePairs:selected.bank.filter(e=>e.source_collection==='sakamoto'&&e.direction==='ja_es').length,quota:'11/15 in both directions',furigana:true,dictionary:true,dailyLessonTerms:true,mockEvaluationAndSrs:true,widths:[390,1280]}));
  }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
