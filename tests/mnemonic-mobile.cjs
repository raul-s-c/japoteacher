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
      if(new URL(route.request().url()).pathname==='/src/cloud-sync.js')return route.fulfill({contentType:'text/javascript',body:'window.CloudSync={initialSync:Promise.resolve(),flush:async()=>{},getAccessToken:async()=>"test-token",getUserId:()=>null,getClient:()=>null};'});
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
    await page.waitForFunction(()=>document.querySelector('#directionCards').children.length>=2&&!document.querySelector('#routeLoader').classList.contains('active'));
    let requests=[];let fail=false;
    await page.route('**/mnemonic',async route=>{
      requests.push(route.request().postDataJSON());
      await new Promise(r=>setTimeout(r,150));
      await route.fulfill({status:fail?502:200,contentType:'application/json',body:JSON.stringify(fail?{error:'Fallo simulado. Reinténtalo.'}:{mnemonic:{tips:[{target_es:'Recordar el significado correcto',trick_es:'Imagina una escena exagerada que conecte la palabra japonesa con lo que significa.',rule_es:'Comprueba la forma correcta y su lectura en la corrección.'}],note_es:''}})});
    });
    async function answer(direction,correct=false){
      await page.locator('.nav-item[data-view="hoy"]:visible').click();
      await page.locator(`.direction-start[data-direction="${direction}"]`).click();
      const choice=page.locator('#exerciseChoiceList [data-exercise-id]').first(),id=await choice.getAttribute('data-exercise-id');
      await choice.click();
      await page.waitForFunction(id=>document.querySelector('#sourceText').dataset.exerciseId===id&&!document.querySelector('#feedbackPanel').dataset.attemptId,id);
      const exercise=await page.evaluate(id=>JapoDB.get('exercises',id),id);
      await page.locator('#answerInput').fill(correct?exercise.reference_translation:'Respuesta incorrecta para probar el consejo.');
      await page.locator('#evaluateButton').click();
      await page.waitForFunction(()=>document.querySelector('#feedbackPanel').dataset.attemptId&&!document.querySelector('#evaluateButton').disabled);
      return page.locator('#feedbackPanel').getAttribute('data-attempt-id');
    }
    const id=await answer('ja_es');assert.equal(requests.length,0);
    const before=await page.evaluate(async()=>({p:await JapoDB.all('exercise_progress'),a:await JapoDB.all('attempts')}));
    await page.locator('#feedbackPanel [data-mnemonic-generate]').evaluate(b=>{b.click();b.click()});
    await page.waitForFunction(()=>document.querySelector('#feedbackPanel [data-mnemonic-generate]').hidden);
    assert.equal(requests.length,1);assert.equal(requests[0].exercise.direction,'ja_es');assert(requests[0].errors.length);
    for(const width of [390,1280]){
      await page.setViewportSize({width,height:844});await page.locator('#feedbackPanel .mnemonic-card').scrollIntoViewIfNeeded();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(process.env.TEMP,`japoteacher-mnemonic-${width}.png`)});
    }
    const after=await page.evaluate(async()=>({p:await JapoDB.all('exercise_progress'),a:await JapoDB.all('attempts')}));
    assert.deepEqual(after.p,before.p);assert.equal(after.a[0].overall_score,before.a[0].overall_score);assert(after.a[0].mnemonic_json);
    await page.reload();await page.waitForFunction(()=>document.querySelector('#directionCards').children.length>=2);
    await page.evaluate(async()=>{const exercises=await JapoDB.all('exercises');HistoryUI.render({attempts:await JapoDB.all('attempts'),eMap:new Map(exercises.map(e=>[e.exercise_id,e]))})});
    await page.locator(`#historyTable [data-attempt-id="${id}"]`).evaluate(b=>b.click());
    await page.waitForFunction(()=>!document.querySelector('#historyDetail').hidden);
    assert(await page.locator('#historyDetailBody .mnemonic-result').isVisible());assert(await page.locator('#historyDetailBody [data-mnemonic-generate]').isHidden());assert.equal(requests.length,1);
    await page.locator('#closeHistoryDetail').click();
    const second=await answer('es_ja');fail=true;
    await page.locator('#feedbackPanel [data-mnemonic-generate]').click();
    await page.waitForFunction(()=>document.querySelector('#feedbackPanel [data-mnemonic-generate]').textContent==='Reintentar consejo');
    assert.equal(requests.length,2);assert.equal(requests[1].exercise.direction,'es_ja');
    assert(!(await page.evaluate(id=>JapoDB.get('attempts',id),second)).mnemonic_json);
    fail=false;await page.locator('#feedbackPanel [data-mnemonic-generate]').click();
    // Moving on must not attach the delayed response to another correction.
    await page.locator('.nav-item[data-view="hoy"]:visible').click();
    await page.waitForFunction(async id=>(await JapoDB.get('attempts',id)).mnemonic_json,second);
    await answer('ja_es',true);assert.equal(await page.locator('#feedbackPanel .mnemonic-card').count(),1);
    assert((await page.locator('#feedbackPanel .mnemonic-card').textContent()).includes('vocabulario o la estructura'));
    await page.locator('#feedbackPanel [data-mnemonic-generate]').click();
    await page.waitForFunction(()=>document.querySelector('#feedbackPanel [data-mnemonic-generate]').hidden);
    assert.deepEqual(requests[3].errors,[]);
    assert.equal(requests.length,4);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({pass:true,directions:['ja_es','es_ja'],onDemand:true,savedAfterReload:true,retry:true,noScoreOrSrsChanges:true,widths:[390,1280]}));
  }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
