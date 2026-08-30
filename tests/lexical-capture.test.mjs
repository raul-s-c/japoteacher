import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../worker/src/index.js", import.meta.url), "utf8");
const adjustments = fs.readFileSync(new URL("../src/manual-adjustments.js", import.meta.url), "utf8");

test("daily corrections still create and persist micro-SRS cards", () => {
  assert.match(app, /saveLexicalFailuresFromAttempt\(e,attempt,ev\)/);
  assert.match(app, /lexical_review_cards_json/);
  assert.match(app, /JapoDB\.put\('lexical_cards'/);
});

test("Japanese comprehension errors identify the exact lexical target", () => {
  assert.match(worker, /En ja_es, para cada error léxico/);
  assert.match(worker, /explanation_es debe mencionar literalmente ese mismo término japonés/);
  assert.match(worker, /términos léxicos completos escritos solo en kana/);
});

test("the before-next dialog reports the cards created for tomorrow", () => {
  assert.match(adjustments, /SRS creado para mañana/);
  assert.match(adjustments, /Palabras que vamos a atacar/);
});
