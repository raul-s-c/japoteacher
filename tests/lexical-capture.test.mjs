import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../worker/src/index.js", import.meta.url), "utf8");
const adjustments = fs.readFileSync(new URL("../src/manual-adjustments.js", import.meta.url), "utf8");
const editor = fs.readFileSync(new URL("../src/lexical-review-editor.js", import.meta.url), "utf8");

test("daily corrections still create and persist micro-SRS cards", () => {
  assert.match(app, /saveLexicalFailuresFromAttempt\(e,attempt,ev\)/);
  assert.match(app, /lexical_review_cards_json/);
  assert.match(app, /JapoDB\.put\('lexical_cards'/);
});

test("Japanese comprehension errors identify the exact lexical target", () => {
  assert.match(worker, /En ja_es, para cada error léxico/);
  assert.match(worker, /palabra, cuantificador o expresión japonesa mínima/);
  assert.match(worker, /No propongas nombres o palabras de contexto/);
  assert.match(worker, /Si el fallo es de cantidad, pluralidad o intensidad/);
});

test("the before-next dialog reports the cards created for tomorrow", () => {
  assert.match(adjustments, /SRS creado para mañana/);
  assert.match(adjustments, /Palabras que vamos a atacar/);
});

test("the learner confirms, edits or rejects every proposed lexical card", () => {
  assert.match(editor, /data-lexical-include/);
  assert.match(editor, /data-lexical-term/);
  assert.match(editor, /data-lexical-meaning/);
  assert.match(editor, /user_rejected_ai_suggestion/);
  assert.match(editor, /lexical_review_confirmed_by_user/);
});

test("manual additions accept several pasted terms and offer kanji chips", () => {
  assert.match(editor, /split\(\/\[\\n,、;\]\+\//);
  assert.match(editor, /data-lexical-additions/);
  assert.match(editor, /data-lexical-chip/);
  assert.match(editor, /もっと = más/);
});
