import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/csv-import.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("usage classifier metadata accepts an object for the limiting component", () => {
  assert.match(source, /usage_hardest_component=jsonObject\(x\.usage_hardest_component_json\)/);
  assert.match(source, /Array\.isArray\(p\)\|\|typeof p!==['"]object['"]/);
});

test("usage component evidence remains an array", () => {
  assert.match(source, /usage_components=json\(x\.usage_components_json\)/);
});

test("startup never records a rejected or incomplete bank as loaded", () => {
  const guard = appSource.match(/if\(imported<(\d+)\)throw new Error/);
  assert.ok(guard);
  assert.ok(appSource.indexOf(guard[0]) < appSource.indexOf("localStorage.setItem('japoteacher_bank_version'"));
});

test("the complete published bank imports without rejections or duplicates", async () => {
  const context = {window:{}, crypto:{randomUUID:()=>"test"}, JapoDB:{all:async()=>[],bulkPut:async()=>{},put:async()=>{}}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../src/schema-validation.js',import.meta.url),'utf8'),context);
  context.SchemaValidation=context.window.SchemaValidation;
  vm.runInContext(source,context);
  const result=await context.window.CsvImport.importText(fs.readFileSync(new URL('../data/exercises.full.csv',import.meta.url),'utf8'));
  const expected=Number(appSource.match(/if\(imported<(\d+)\)throw new Error/)[1]);
  assert.equal(result.created,expected);
  assert.equal(result.rejected,0);
  assert.equal(result.duplicates,0);
});
