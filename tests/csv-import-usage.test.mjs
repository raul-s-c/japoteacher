import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

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
  assert.match(appSource, /if\(imported<3790\)throw new Error/);
  assert.ok(appSource.indexOf("if(imported<3790)") < appSource.indexOf("localStorage.setItem('japoteacher_bank_version'"));
});
