(function(){
  let indexedSource, forms, readings, starts;
  const key = value => String(value || '').normalize('NFKC');
  function add(map, form, item){
    if(!form)return;
    const list=map.get(form)||[];
    if(!list.some(x=>x.c===item.c&&x.r===item.r))list.push(item);
    map.set(form,list);
  }
  function indexes(){
    const source=window.JAPOTEACHER_FEEDBACK_USAGE||[];
    if(source===indexedSource)return;
    indexedSource=source;forms=new Map();readings=new Map();
    const iRow={'う':'い','く':'き','ぐ':'ぎ','す':'し','つ':'ち','ぬ':'に','ぶ':'び','む':'み','る':'り'};
    for(const [t,r,p,l,c,aliases] of source){
      const item={k:'v',t,r,p,l,c};
      for(const form of new Set([t,...String(aliases||'').split('|')]))add(forms,key(form),item);
      add(readings,key(r),item);
      // Only recognize polite forms with a visible kanji stem; never guess kana homophones.
      if(/[\u3400-\u9fff]/.test(t)&&iRow[t.slice(-1)]){
        const stems=[[t.slice(0,-1)+iRow[t.slice(-1)],r.slice(0,-1)+iRow[r.slice(-1)]]];
        if(t.endsWith('る'))stems.push([t.slice(0,-1),r.slice(0,-1)]);
        for(const [stem,pronunciation] of stems)for(const ending of ['ます','ました','ません','ませんでした'])add(forms,stem+ending,{...item,r:pronunciation+ending});
      }
    }
    starts=new Map();
    for(const form of forms.keys())if(/^[\u3400-\u9fff]/.test(form)){
      const words=starts.get(form[0])||[];words.push(form);starts.set(form[0],words);
    }
    for(const words of starts.values())words.sort((a,b)=>b.length-a.length);
  }
  function resolve(reading,exercise){
    indexes();
    const value=key(reading.characters), components=(exercise?.usage_components||[]).filter(x=>x.k==='v');
    const exact=components.filter(x=>key(x.t)===value);
    if(exact.length)return exact;
    const matches=[...new Map((forms.get(value)||[]).map(item=>[item.c,item])).values()];
    if(matches.length===1)return matches;
    const contextual=matches.filter(x=>components.some(c=>c.c===x.c||c.t===x.t));
    if(contextual.length===1)return contextual;
    if(matches.length>1)return [];
    // A kana spelling may map by reading only when the reference is unambiguous.
    if(/^[\u3040-\u30ff]+$/.test(value)){
      const byReading=readings.get(value)||[];
      if(byReading.length===1)return byReading;
    }
    return components.filter(x=>x.t&&value.includes(x.t)).sort((a,b)=>value.indexOf(a.t)-value.indexOf(b.t));
  }
  function canonical(sentence){
    // Standard date spelling at an explicit word boundary, not a general kana-to-kanji conversion.
    return String(sentence||'').replace(/(^|[\s、。])きょう(?=[はものに、。]|$)/g,'$1今日');
  }
  function prepare(sentence,sourceReadings,exercise){
    indexes();
    const text=canonical(sentence), items=[],seen=new Set();
    for(const reading of sourceReadings||[]){
      const characters=String(reading.characters||'').replace(/ごはん|御飯/g,'ご飯');
      if(!characters||!text.includes(characters)||seen.has(characters))continue;
      items.push({...reading,characters});seen.add(characters);
    }
    if(text.includes('今日')&&!seen.has('今日'))items.push({characters:'今日',reading_hiragana:'きょう',meaning_es:'hoy',explanation_es:'Lectura contextual de 今日.'});
    if(text.includes('晩ご飯')&&!seen.has('晩ご飯'))items.push({characters:'晩ご飯',reading_hiragana:'ばんごはん',meaning_es:'cena',explanation_es:''});
    for(let i=0;i<text.length;i++){
      const supplied=items.filter(x=>text.startsWith(x.characters,i)).sort((a,b)=>b.characters.length-a.characters.length)[0];
      if(supplied){i+=supplied.characters.length-1;continue;}
      const form=(starts.get(text[i])||[]).find(word=>text.startsWith(word,i)&&forms.get(word).length===1);
      if(!form)continue;
      const entry=forms.get(form)[0];
      if(!items.some(x=>x.characters===form))items.push({characters:form,reading_hiragana:entry.r,meaning_es:'',explanation_es:''});
      i+=form.length-1;
    }
    items.sort((a,b)=>text.indexOf(a.characters)-text.indexOf(b.characters));
    return {text,readings:items};
  }
  window.FeedbackVocabulary={resolve,prepare,canonical};
})();
