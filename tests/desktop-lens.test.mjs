import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{cropRect,settings}=require('../desktop/core.cjs');
test('desktop crop uses physical pixel bounds and rejects empty/non-finite regions',()=>{
  assert.deepEqual(cropRect({x:-10,y:90,width:200,height:40},{width:100,height:100}),{x:0,y:90,width:100,height:10});
  assert.deepEqual(cropRect({x:200,y:100,width:500,height:250},{width:3840,height:2160}),{x:200,y:100,width:500,height:250});
  assert.throws(()=>cropRect({x:NaN,y:0,width:30,height:30},{width:100,height:100}));
  assert.throws(()=>cropRect({x:0,y:0,width:0,height:30},{width:100,height:100}));
});
test('clipboard monitoring requires explicit opt-in and OCR mode is not silently escalated',()=>{
  assert.equal(settings().watch,false);
  assert.equal(settings({watch:'true'}).watch,false);
  assert.equal(settings({watch:true,mode:'text',auto:false}).watch,true);
  assert.equal(settings({mode:'text'}).mode,'text');
  assert.equal(settings({auto:false}).auto,false);
});
