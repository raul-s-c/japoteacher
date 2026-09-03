// Browser plugin not available: use the bundled Playwright runtime for this fixture.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent('<html><body><main id="fixture" style="margin:12px;max-width:720px"></main></body></html>');
    await page.addStyleTag({content:fs.readFileSync('styles.css','utf8')});
    for(const file of ['feedback-usage-data.js','feedback-vocabulary.js','ui.js'])await page.addScriptTag({path:path.resolve('src',file)});
    await page.evaluate(()=>{
      const ev={correct_japanese_sentence:'きょうはうちで母が晩ご飯を作ります。',natural_answer:'きょうはうちで母が晩ご飯を作ります。',overall_score:65,is_acceptable:false,errors:[],strengths:[],kanji_readings:[{characters:'家',reading_hiragana:'いえ',meaning_es:'casa'},{characters:'母',reading_hiragana:'はは',meaning_es:'madre'},{characters:'晩ごはん',reading_hiragana:'ばんごはん',meaning_es:'cena'},{characters:'料理ます',reading_hiragana:'りょうります',meaning_es:'incorrecto'}]};
      for(const field of ['objective','comprehensibility','naturalness','grammar','vocabulary','orthography','register'])ev[field+'_score']=65;
      document.querySelector('#fixture').innerHTML=UI.feedback(ev,'家に今日は、晩ごはんが母料理ます',{direction:'es_ja'});
    });
    for(const width of [360,420,1280]){
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const overflow=await page.locator('.kanji-reading div').evaluateAll(rows=>rows.some(row=>row.scrollWidth>row.clientWidth+1));
      assert.equal(overflow,false);
      assert.equal(await page.locator('.correct-japanese ruby').filter({hasText:'今日'}).count(),1);
      assert.equal(await page.locator('.correct-japanese').getByText('料理ます',{exact:true}).count(),0);
      await page.screenshot({path:path.join(process.env.TEMP||'/tmp',`japoteacher-feedback-${width}.png`),fullPage:true});
    }
    console.log('PASS: feedback at 360, 420 and 1280px; no overflow; correct readings and vocabulary.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
