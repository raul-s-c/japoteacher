import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

function topicProgression() {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(new URL("../src/topic-progression.js", import.meta.url), "utf8"),
    context,
  );
  return context.window.TopicProgression;
}

test("a direction only unlocks its own topic route", () => {
  const progression = topicProgression();
  const exercises = [
    { exercise_id: "ja-n5", direction: "ja_es", jlpt_level: "N5", active: true, topic_tags: ["travel"] },
    { exercise_id: "ja-n4", direction: "ja_es", jlpt_level: "N4", active: true, topic_tags: ["travel"] },
    { exercise_id: "es-n5", direction: "es_ja", jlpt_level: "N5", active: true, topic_tags: ["travel"] },
    { exercise_id: "es-n4", direction: "es_ja", jlpt_level: "N4", active: true, topic_tags: ["travel"] },
  ];
  const attempts = [1, 2, 3].map((index) => ({
    attempt_id: `ja-${index}`,
    exercise_id: "ja-n5",
    direction: "ja_es",
    attempted_at: `2026-08-0${index}T12:00:00.000Z`,
    overall_score: 90,
    is_acceptable: true,
  }));

  assert.equal(progression.analyze(exercises, attempts, "ja_es")[0].target, "N4");
  assert.equal(progression.analyze(exercises, attempts, "es_ja")[0].target, "N5");
});

test("topic routes are grouped into learning families", () => {
  const progression = topicProgression();
  const groups = progression.groupByFamily([
    { topic: "viajes", totalAttempts: 4 },
    { topic: "tren", totalAttempts: 2 },
    { topic: "familia", totalAttempts: 1 },
  ]);

  assert.equal(groups.find((group) => group.family === "Viajes y desplazamientos").items.length, 2);
  assert.equal(groups.find((group) => group.family === "Personas y relaciones").items.length, 1);
});
