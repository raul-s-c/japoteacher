import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function planner() {
  const TopicProgression = {
    bonus: () => 0,
    familyFor(topic) {
      return ({ familia: "Familia y amigos", trabajo: "Trabajo y carrera", dinero: "Dinero y proyectos", ocio: "Ocio y vida diaria", consulta: "Conocimiento y consultas" })[topic] || "Conocimiento y consultas";
    },
  };
  const context = {
    window: { TopicProgression, RankedProgress: { snapshot: () => ({}), accessForDirection: () => ({ allowedLevels: ["N5"] }) } },
    TopicProgression,
    Difficulty: { bands: [0], bandFor: () => 0, score: () => 50, levelIndex: () => 0 },
    Date, Math, Set, Map, JSON,
  };
  vm.runInNewContext(fs.readFileSync(new URL("../src/session-planner.js", import.meta.url), "utf8"), context);
  return context.window.SessionPlanner;
}

test("balanced SRS exposes weak conversation families and registers", () => {
  const srs = planner();
  const topics = ["familia", "trabajo", "dinero", "ocio", "consulta"];
  const exercises = topics.map((topic, index) => ({
    exercise_id: `e-${topic}`,
    active: true,
    direction: "ja_es",
    jlpt_level: "N5",
    difficulty: 40,
    topic_tags: [topic],
    grammar_tags: [`g-${topic}`],
    vocabulary_tags: [`v-${topic}`],
    register: index % 2 ? "informal" : "cortes",
  }));
  const attempts = Array.from({ length: 6 }, (_, index) => ({ exercise_id: "e-familia", direction: "ja_es", evaluation_status: "valid", overall_score: 95, is_acceptable: true, attempted_at: `2026-08-0${index + 1}T12:00:00Z` }));
  const profile = srs.coverageProfile(exercises, attempts, "ja_es");
  assert.ok(profile.get("family", "Trabajo y carrera").deficit > profile.get("family", "Familia y amigos").deficit);
  const ids = srs.choose(exercises, [], attempts, 5, { levels: ["N5"] }, "ja_es", "2026-08-15", []);
  assert.equal(new Set(ids).size, 5);
  assert.ok(ids.some(id => id === "e-trabajo"));
  assert.ok(ids.some(id => id === "e-dinero"));
});

test("a daily plan from an older selector is marked for rebalancing", () => {
  const srs = planner();
  assert.equal(srs.needsRebalance({ selection_reason_json: JSON.stringify({ strategy: "topic_adaptive_srs_difficulty_ranked_v6" }) }), true);
  assert.equal(srs.needsRebalance({ selection_reason_json: JSON.stringify({ strategy: "balanced_srs_families_registers_v9" }) }), false);
});

test("a zero-evidence family gets an intervention slot ahead of ordinary due reviews", () => {
  const srs = planner();
  const topics = ["familia", "trabajo", "dinero", "ocio", "consulta"];
  const exercises = topics.map(topic => ({ exercise_id: `e-${topic}`, active: true, direction: "ja_es", jlpt_level: "N5", difficulty: 30, topic_tags: [topic], grammar_tags: [`g-${topic}`], vocabulary_tags: [`v-${topic}`], register: "cortes" }));
  const attempts = topics.filter(topic => topic !== "dinero").flatMap((topic, group) => Array.from({ length: 4 }, (_, index) => ({ exercise_id: `e-${topic}`, direction: "ja_es", evaluation_status: "valid", overall_score: 90, is_acceptable: true, attempted_at: `2026-08-${String(group * 4 + index + 1).padStart(2, "0")}T12:00:00Z` })));
  const progress = exercises.filter(exercise => exercise.exercise_id !== "e-dinero").map(exercise => ({ exercise_id: exercise.exercise_id, cooldown_until: "2000-01-01T00:00:00Z", next_review_at: "2000-01-01T00:00:00Z", average_score: 90 }));
  assert.deepEqual(Array.from(srs.choose(exercises, progress, attempts, 1, { levels: ["N5"] }, "ja_es", "2026-08-15", [])), ["e-dinero"]);
});
