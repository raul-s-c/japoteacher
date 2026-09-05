const CACHE='japoteacher-v150';
const ASSETS=['./','index.html','lens-overlay.html','styles.css','app.js','src/daily-lesson.js','manifest.webmanifest','android-version.json','assets/app-icon.svg','data/exercises.full.csv','src/supabase-config.js','src/db.js','src/sync-policy.js','src/cloud-sync.js','src/pwa-update.js','src/schema-validation.js','src/srs.js','src/topic-progression.js','src/ranked-progress.js','src/ranked-history.js','src/session-planner.js','src/furigana-generated.js','src/furigana.js','src/difficulty.js','src/reports.js','src/evaluators/ai-evaluator.js','src/evaluators/mock-evaluator.js','src/evaluators/openai-evaluator.js','src/evaluators/evaluator-router.js','src/ai-connection-test.js','src/navigation-fix.js','src/mobile-insets.js','src/csv-import.js','src/csv-export.js','src/analytics.js','src/study-summary.js','src/teacher-diagnosis.js','src/ui.js','src/history-ui.js','src/bank-status.js','src/extra-study.js','src/topic-drill.js','src/practice-history.js','src/practice-history.css','src/context-explainer.js','src/practice-tools.js','src/ai-tutor.js','src/lens.js','src/lens-overlay.js','src/lens-overlay.css','src/daily-news.js','src/manual-adjustments.js','src/issue-reporter.js','src/native-update.js'];
ASSETS.push('src/feedback-usage-data.js?v=1','src/feedback-vocabulary.js?v=1','src/ui.js?v=46');
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.pathname.endsWith('secrets.local.js'))return;
  if(e.request.mode==='navigate'){
    const target=url.pathname.endsWith('/lens-overlay.html')?'lens-overlay.html':'index.html';
    // The installed shell and its assets are a single release. Updates arrive
    // through a new service worker, without delaying startup on the network.
    e.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(target))||fetch(e.request)));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async cache=>{
    const localAsset=url.origin===self.location.origin&&ASSETS.some(asset=>new URL(asset,self.registration.scope).pathname===url.pathname);
    const runtimeAsset=url.origin==='https://cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2';
    const hit=await cache.match(e.request,{ignoreSearch:localAsset});
    if(hit)return hit;
    const response=await fetch(e.request);
    if(response.ok&&(localAsset||runtimeAsset))await cache.put(e.request,response.clone());
    return response;
  }));
});
