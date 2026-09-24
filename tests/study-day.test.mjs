import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const source=fs.readFileSync(new URL('../src/session-planner.js',import.meta.url),'utf8');
function load(){const c={window:null,Date,Map,Set};c.window=c;vm.runInNewContext(source,c);return c.SessionPlanner}
test('study day remains yesterday until 03:00 local, including month/year boundaries',()=>{
 const p=load();
 for(const [input,expected] of [['2026-09-25T00:00:00','2026-09-24'],['2026-09-25T02:59:59.999','2026-09-24'],['2026-09-25T03:00:00','2026-09-25'],['2026-01-01T01:00:00','2025-12-31'],['2028-03-01T02:00:00','2028-02-29']])assert.equal(p.localDate(new Date(input)),expected);
 assert.equal(p.localDate('invalid'),'');assert.equal(p.dayStart('2026-09-24').getHours(),3);
});
test('03:00 cutoff follows wall clock on both Madrid daylight-saving transitions',()=>{
 const code=`const vm=require('node:vm');const c={window:null,Date,Map,Set};c.window=c;vm.runInNewContext(${JSON.stringify(source)},c);console.log(JSON.stringify(['2026-03-29T00:59:59Z','2026-03-29T01:00:00Z','2026-10-25T00:30:00Z','2026-10-25T01:30:00Z','2026-10-25T02:00:00Z'].map(s=>c.SessionPlanner.localDate(s))))`;
 assert.deepEqual(JSON.parse(execFileSync(process.execPath,['-e',code],{env:{...process.env,TZ:'Europe/Madrid'},encoding:'utf8'})),['2026-03-28','2026-03-29','2026-10-24','2026-10-24','2026-10-25']);
});
