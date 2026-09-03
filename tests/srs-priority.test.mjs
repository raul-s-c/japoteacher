import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function srs() {
  const context = { window: {}, Date, Math, JSON };
  vm.runInNewContext(fs.readFileSync(new URL("../src/srs.js", import.meta.url), "utf8"), context);
  return context.window.SRS;
}

test("90-plus and very easy moves an exercise to minimum priority", () => {
  const attempt = { attempt_id: "a-1", exercise_id: "e-1", profile_id: "p-1", attempted_at: "2026-09-03T12:00:00Z", user_answer: "respuesta", user_difficulty_feedback: "too_easy" };
  const evaluation = { overall_score: 96, comprehensibility_score: 96, errors: [], detected_error_tags: [], strengths: [] };
  const progress = srs().update(null, attempt, evaluation, { cooldownDays: 14 });
  assert.equal(progress.priority_tier, "minimum");
  assert.equal(progress.deferred_until_new_exhausted, true);
  assert.ok(progress.interval_days >= 180);
  assert.ok((Date.parse(progress.cooldown_until) - Date.parse(attempt.attempted_at)) / 86400000 >= 180);
});

test("a later non-easy result removes the absolute deferral", () => {
  const api = srs();
  const evaluation = { overall_score: 96, comprehensibility_score: 96, errors: [], detected_error_tags: [], strengths: [] };
  const first = api.update(null, { attempt_id: "a-1", exercise_id: "e-1", profile_id: "p-1", attempted_at: "2026-01-01T12:00:00Z", user_answer: "respuesta", user_difficulty_feedback: "too_easy" }, evaluation, { cooldownDays: 14 });
  const second = api.update(first, { attempt_id: "a-2", exercise_id: "e-1", profile_id: "p-1", attempted_at: "2026-09-03T12:00:00Z", user_answer: "respuesta", user_difficulty_feedback: "normal" }, evaluation, { cooldownDays: 14 });
  assert.equal(second.priority_tier, "normal");
  assert.equal(second.deferred_until_new_exhausted, false);
});
