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

    await page.goto(origin+'/');
    await page.waitForFunction(()=>document.querySelectorAll('.study-plan-row').length===2&&!document.querySelector('#routeLoader').classList.contains('active'));
    assert.equal(await page.title(),'Japoteacher');
    const initial=await page.evaluate(()=>StudyPlans.all('local-default'));assert.equal(initial.length,4);
    await page.locator('[data-plan-direction="es_ja"]').click();assert.equal(await page.locator('.study-plan-row').count(),2);
    await page.locator('[data-plan-direction="ja_es"]').click();
    await page.locator('#addStudyPlan').click();await page.locator('#studyPlanForm select[name=source]').selectOption('sakamoto');
    await page.locator('#studyPlanForm input[name=dailyLimit]').fill('3');await page.locator('#studyPlanForm input[name=newLimit]').fill('2');
    await page.locator('#studyPlanForm details summary').click();await page.locator('#studyPlanForm input[name=adaptive]').uncheck();await page.locator('#studyPlanForm input[name=quizSize]').fill('1');
    await page.locator('#saveStudyPlan').click();await page.waitForFunction(()=>!document.querySelector('#studyPlanDialog').open);
    const card=page.locator('.study-plan-row').filter({has:page.locator('[data-plan-study="sakamoto::ja_es"]')});
    assert((await card.textContent()).includes('2 nuevas'));
    await card.locator('[data-plan-terms]').click();await page.locator('#planTermFilter').selectOption('today');assert((await page.locator('#planTermsCount').textContent()).startsWith('2 frases'));await page.locator('#closePlanTerms').click();
    for(const width of [390,1280]){await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(process.env.TEMP,`japoteacher-plans-${width}.png`)});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
    await page.setViewportSize({width:390,height:844});await card.locator('[data-plan-edit]').click();await page.screenshot({path:path.join(process.env.TEMP,'japoteacher-plan-settings.png')});await page.locator('#closeStudyPlan').click();
    await card.locator('[data-plan-study]').click();assert.equal(await page.locator('#exerciseChoiceList [data-exercise-id]').count(),1);
    await page.locator('#exerciseChoiceList [data-exercise-id]').first().click();await page.waitForFunction(()=>document.querySelector('#sourceText').dataset.exerciseId);
    const oldId=await page.locator('#sourceText').getAttribute('data-exercise-id');assert(oldId.startsWith('SAKAMOTO'));
    await page.locator('#replaceExerciseButton').click();assert(await page.locator('#replaceReasons').evaluate(d=>d.open));
    for(const reason of ['too_easy','recent','too_hard'])assert(await page.locator(`[data-replace-reason="${reason}"]`).isVisible());
    await page.screenshot({path:path.join(process.env.TEMP,'japoteacher-replace-dialog.png')});
    await page.locator('[data-replace-reason="too_hard"]').click();await page.waitForFunction(old=>!document.querySelector('#replaceReasons').open&&document.querySelector('#sourceText').dataset.exerciseId!==old,oldId);
    const newId=await page.locator('#sourceText').getAttribute('data-exercise-id');assert(newId!==oldId&&newId.startsWith('SAKAMOTO'));
    const reference=await page.evaluate(async id=>(await JapoDB.get('exercises',id)).reference_translation,newId);
    await page.locator('#answerInput').fill(reference);await page.locator('#evaluateButton').click();await page.waitForFunction(()=>document.querySelector('#feedbackPanel').dataset.attemptId&&!document.querySelector('#evaluateButton').disabled);
    assert(await page.locator('.mnemonic-card').isVisible());
    await page.locator('.nav-item[data-view="hoy"]:visible').click();
    await card.locator('[data-plan-edit]').click();await page.locator('#studyPlanForm input[name=newLimit]').fill('1');await page.locator('#studyPlanForm input[name=dailyLimit]').fill('1');await page.locator('#saveStudyPlan').click();await page.waitForFunction(()=>!document.querySelector('#studyPlanDialog').open);
    assert((await card.textContent()).includes('Objetivo de hoy completado'));
    await page.locator('[data-plan-direction="es_ja"]').click();assert.equal(await page.locator('[data-plan-study="sakamoto::es_ja"]').count(),0);
    await page.locator('.nav-item[data-view="ajustes"]:visible').click();assert.equal(await page.locator('#settingsForm [name=newRatio]').count(),0);assert.equal(await page.locator('#settingsForm [name=dailyJaEs]').count(),0);
    await page.locator('#settingsForm [name=profileName]').fill('Planes QA');await page.locator('#settingsForm [name=profileName]').press('Tab');await page.waitForFunction(()=>document.querySelector('#saveState').textContent==='Guardado');
    await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.study-plan-row').length>=2&&!document.querySelector('#routeLoader').classList.contains('active'));
    const state=await page.evaluate(async()=>({plans:await StudyPlans.all('local-default'),attempts:await JapoDB.all('attempts'),session:(await JapoDB.all('daily_sessions')).find(s=>s.local_date===SessionPlanner.localDate())}));
    assert.equal(state.plans.find(p=>p.id==='sakamoto::ja_es').dailyLimit,1);assert.equal(state.attempts.length,1);assert.equal(state.attempts[0].study_plan_id,'sakamoto::ja_es');assert.equal(state.attempts[0].overall_score,100);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,migration:true,independentDirections:true,perPlanCaps:true,planQuiz:true,replacementDialog:true,persistence:true,widths:[390,1280]}));
  }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
