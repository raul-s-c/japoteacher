import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("No pasa filtro uses an in-app confirmation flow", () => {
  assert.match(html, /id="filterExerciseDialog"/);
  assert.match(html, /id="confirmFilterExercise"/);
  assert.match(app, /confirmBlockCurrentExercise/);
  assert.doesNotMatch(app, /if\(!confirm\('Marcar esta frase/);
});

test("filtering preserves history and stores a user rejection override", () => {
  assert.match(app, /blocked_by_user:true/);
  assert.match(app, /user_rejected_quality/);
  assert.doesNotMatch(app, /JapoDB\.delete\('attempts'/);
});
