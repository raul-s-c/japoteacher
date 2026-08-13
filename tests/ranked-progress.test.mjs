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
