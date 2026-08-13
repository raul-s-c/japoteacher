import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

function ranked() {
  const context = { window: {} };
  context.window.TopicProgression = {
    familyFor(topic) {
      return String(topic).includes("trabajo")
        ? "Trabajo y carrera"
        : "Ocio y vida diaria";
    },
  };
  vm.runInNewContext(
    fs.readFileSync(new URL("../src/ranked-progress.js", import.meta.url), "utf8"),
    context,
  );
  return context.window.RankedProgress;
}

test("harder JLPT material rewards more than an easier sentence at the same score", () => {
  const xp = ranked();
  const n5 = xp.deltaFor(0, { jlpt_level: "N5", difficulty: 50 }, { overall_score: 82 });
  const n4 = xp.deltaFor(0, { jlpt_level: "N4", difficulty: 40 }, { overall_score: 82 });
  assert.ok(n4 > n5);
});

test("failing far above the current rating is penalized softly", () => {
  const xp = ranked();
  const hardMiss = xp.deltaFor(20, { jlpt_level: "N4", difficulty: 90 }, { overall_score: 45 });
  const easyMiss = xp.deltaFor(120, { jlpt_level: "N5", difficulty: 35 }, { overall_score: 45 });
  assert.ok(Math.abs(hardMiss) < Math.abs(easyMiss));
});

test("ratings are independent by direction and conversation family", () => {
  const xp = ranked();
  const exercises = [
    { exercise_id: "a", direction: "ja_es", jlpt_level: "N4", difficulty: 40, topic_tags: ["trabajo"] },
    { exercise_id: "b", direction: "es_ja", jlpt_level: "N5", difficulty: 55, topic_tags: ["gaming"] },
  ];
  const attempts = [
    { exercise_id: "a", direction: "ja_es", attempted_at: "2026-08-13T08:00:00Z", evaluation_status: "valid", overall_score: 85 },
    { exercise_id: "b", direction: "es_ja", attempted_at: "2026-08-13T08:01:00Z", evaluation_status: "valid", overall_score: 85 },
  ];
  const snapshot = xp.snapshot(exercises, attempts);
  assert.ok(xp.get(snapshot, "ja_es", "Trabajo y carrera").points > 0);
  assert.equal(xp.get(snapshot, "ja_es", "Ocio y vida diaria").points, 0);
  assert.ok(xp.get(snapshot, "es_ja", "Ocio y vida diaria").points > 0);
});

test("N5 experience cannot promote a family to N1", () => {
  const xp = ranked();
  const exercises = Array.from({ length: 30 }, (_, index) => ({
    exercise_id: `n5-${index}`, direction: "es_ja", jlpt_level: "N5", difficulty: 20, topic_tags: ["gaming"],
  }));
  const attempts = exercises.map((exercise, index) => ({
    exercise_id: exercise.exercise_id, direction: "es_ja", attempted_at: `2026-08-13T08:${String(index).padStart(2, "0")}:00Z`, evaluation_status: "valid", overall_score: 100, is_acceptable: true,
  }));
  const rating = xp.get(xp.snapshot(exercises, attempts), "es_ja", "Ocio y vida diaria");
  assert.equal(rating.level, "N5");
  assert.equal(rating.percent, 99);
});

test("the next JLPT only gains its own experience after the previous level is mastered", () => {
  const xp = ranked();
  const n5 = Array.from({ length: 12 }, (_, index) => ({ exercise_id: `n5-${index}`, direction: "es_ja", jlpt_level: "N5", difficulty: 20, topic_tags: ["gaming"] }));
  const n4 = { exercise_id: "n4-1", direction: "es_ja", jlpt_level: "N4", difficulty: 20, topic_tags: ["gaming"] };
  const attempts = [...n5.map((exercise, index) => ({ exercise_id: exercise.exercise_id, direction: "es_ja", attempted_at: `2026-08-13T08:${String(index).padStart(2, "0")}:00Z`, evaluation_status: "valid", overall_score: 100, is_acceptable: true })), { exercise_id: n4.exercise_id, direction: "es_ja", attempted_at: "2026-08-13T09:00:00Z", evaluation_status: "valid", overall_score: 100, is_acceptable: true }];
  const rating = xp.get(xp.snapshot([...n5, n4], attempts), "es_ja", "Ocio y vida diaria");
  assert.equal(rating.level, "N4");
  assert.ok(rating.percent > 0);
});

test("a family cannot display a JLPT level that has no exercises", () => {
  const xp = ranked();
  const exercises = Array.from({ length: 20 }, (_, index) => ({ exercise_id: `n5-${index}`, direction: "es_ja", jlpt_level: "N5", difficulty: 20, topic_tags: ["gaming"] }));
  const attempts = exercises.map((exercise, index) => ({ exercise_id: exercise.exercise_id, direction: "es_ja", attempted_at: `2026-08-13T08:${String(index).padStart(2, "0")}:00Z`, evaluation_status: "valid", overall_score: 100, is_acceptable: true }));
  assert.equal(xp.get(xp.snapshot(exercises, attempts), "es_ja", "Ocio y vida diaria").level, "N5");
});

test("rank badges label points as EXP instead of an accuracy percentage", () => {
  const xp = ranked();
  assert.match(xp.badgeHtml({ level: "N4", percent: 95 }), /95 EXP/);
  assert.doesNotMatch(xp.badgeHtml({ level: "N4", percent: 95 }), /95%/);
});
