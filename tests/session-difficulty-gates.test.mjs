import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

function planner() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../src/difficulty.js", import.meta.url), "utf8"), context);
  context.Difficulty = context.window.Difficulty;
  context.TopicProgression = { bonus: () => 0 };
  vm.runInNewContext(fs.readFileSync(new URL("../src/session-planner.js", import.meta.url), "utf8"), context);
  return context.window.SessionPlanner;
}

const exercise = (id, difficulty) => ({ exercise_id: id, direction: "ja_es", jlpt_level: "N4", difficulty, dataset_version: 4, active: true, topic_tags: [id], grammar_tags: [], vocabulary_tags: [] });
const attempt = (id, score = 90) => ({ exercise_id: id, direction: "ja_es", evaluation_status: "valid", overall_score: score, is_acceptable: score >= 70, attempted_at: `2026-08-${id.slice(-2)}T12:00:00.000Z` });
const settings = { levels: ["N4"] };

test("new N4 material stays in the accessible band until it is mastered", () => {
  const plan = planner(), exercises = [1,2,3,4].map(n => exercise(`low-${String(n).padStart(2,"0")}`, 10)).concat([exercise("middle-01", 35), exercise("high-01", 85)]);
  const ids = plan.choose(exercises, [], [], 10, settings, "ja_es", "seed", []);
  assert.deepEqual(new Set(ids), new Set(exercises.slice(0, 4).map(item => item.exercise_id)));
  assert.equal(plan.difficultyRoadmap(exercises, [], "ja_es").N4.unlockedBand, 0);
});

test("mastering a band unlocks only the next N4 difficulty band", () => {
  const plan = planner(), exercises = [1,2,3,4].map(n => exercise(`low-${String(n).padStart(2,"0")}`, 10)).concat([1,2,3,4].map(n => exercise(`middle-${String(n).padStart(2,"0")}`, 35)), [exercise("high-01", 60), exercise("extreme-01", 85)]), attempts = exercises.slice(0, 4).map(item => attempt(item.exercise_id));
  assert.equal(plan.difficultyRoadmap(exercises, attempts, "ja_es").N4.unlockedBand, 1);
  assert.ok(plan.choose(exercises, [], attempts, 20, settings, "ja_es", "seed", []).every(id => id !== "high-01" && id !== "extreme-01"));
});

test("a higher N4 band opens only after the preceding band is mastered", () => {
  const plan = planner(), exercises = [1,2,3,4].map(n => exercise(`low-${String(n).padStart(2,"0")}`, 10)).concat([1,2,3,4].map(n => exercise(`middle-${String(n).padStart(2,"0")}`, 35)), [exercise("high-01", 60), exercise("extreme-01", 85)]), attempts = exercises.slice(0, 8).map(item => attempt(item.exercise_id));
  assert.equal(plan.difficultyRoadmap(exercises, attempts, "ja_es").N4.unlockedBand, 2);
  assert.ok(plan.choose(exercises, [], attempts, 20, settings, "ja_es", "seed", []).includes("high-01"));
});
