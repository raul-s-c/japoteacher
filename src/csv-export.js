(function(){
  function cell(v){if(v==null)return'';const s=typeof v==='object'?JSON.stringify(v):String(v);return /[";\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
  function download(name,text,type='text/csv;charset=utf-8'){const blob=new Blob(['\uFEFF',text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function storeCsv(store,name){const rows=await JapoDB.all(store);if(!rows.length){download(name,'');return}const headers=[...new Set(rows.flatMap(Object.keys))];download(name,[headers.join(';'),...rows.map(r=>headers.map(h=>cell(r[h])).join(';'))].join('\r\n'))}
  async function backup(){const data=await JapoDB.backup();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`japoteacher_backup_${SessionPlanner.localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  window.CsvExport={storeCsv,backup};
})();
