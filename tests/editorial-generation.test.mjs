import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=readFileSync(new URL('../worker/src/index.js',import.meta.url),'utf8');
const start=source.indexOf('async function callEditorialOpenAI(');
const end=source.indexOf('\nasync function editorial(',start);

test('editorial review uses reasoning and output space proportional to batch size',async()=>{
  let request;
  const context={
    editorialGenerationSchema:{},editorialReviewSchema:{},equivalenceCheckSchema:{},kanjiRepairSchema:{},difficultyReviewSchema:{},
    editorialInstructions:()=>'',equivalenceCheckInstructions:()=>'',kanjiRepairInstructions:()=>'',difficultyReviewInstructions:()=>'',
    OPENAI_RESPONSES_URL:'https://example.invalid',fetch:async(url,options)=>{request=JSON.parse(options.body);return {};},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start,end),context);
  await context.callEditorialOpenAI('review',{items:[{},{}]},{OPENAI_API_KEY:'test'});
  assert.equal(request.reasoning.effort,'low');
  assert.equal(request.max_output_tokens,8000);
  await context.callEditorialOpenAI('generate',{slots:[{},{},{},{}]},{OPENAI_API_KEY:'test'});
  assert.equal(request.max_output_tokens,12000);
});
