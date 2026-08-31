import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const adjustments = fs.readFileSync(new URL("../src/manual-adjustments.js", import.meta.url), "utf8");
const news = fs.readFileSync(new URL("../src/daily-news.js", import.meta.url), "utf8");

test("micro-SRS is removed from the active application flow", () => {
  assert.doesNotMatch(html, /Micro-SRS|lexicalReviewQueue|lexical-review-editor/);
  assert.doesNotMatch(app, /saveLexicalFailuresFromAttempt\(e,attempt,ev\)/);
  assert.doesNotMatch(news, /saveLexicalFailures\(/);
});

test("the before-next dialog can schedule an optional repeat", () => {
  assert.match(adjustments, /data-repeat-tomorrow/);
  assert.match(adjustments, /repeat_requested_for/);
  assert.match(adjustments, /extra voluntaria/);
});

test("daily and practice views identify voluntary repeats", () => {
  assert.match(app, /voluntary_repeat_ids_ja_es_json/);
  assert.match(app, /Extra voluntaria/);
  assert.match(app, /diarias \+ .*extra/);
});
