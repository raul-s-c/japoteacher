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
  assert.equal(srs.needsRebalance({ selection_reason_json: JSON.stringify({ strategy: "balanced_srs_coverage_v10" }) }), true);
  assert.equal(srs.needsRebalance({ selection_reason_json: JSON.stringify({ strategy: "balanced_srs_variety_v11" }) }), true);
  assert.equal(srs.needsRebalance({ selection_reason_json: JSON.stringify({ strategy: "guided_coverage_srs_v12" }) }), true);
  assert.equal(srs.needsRebalance({ selection_reason_json: JSON.stringify({ strategy: "guided_coverage_srs_v13_voluntary_repeats" }) }), false);
});

test("a zero-evidence family gets an intervention slot ahead of ordinary due reviews", () => {
  const srs = planner();
  const topics = ["familia", "trabajo", "dinero", "ocio", "consulta"];
  const exercises = topics.map(topic => ({ exercise_id: `e-${topic}`, active: true, direction: "ja_es", jlpt_level: "N5", difficulty: 30, topic_tags: [topic], grammar_tags: [`g-${topic}`], vocabulary_tags: [`v-${topic}`], register: "cortes" }));
  const attempts = topics.filter(topic => topic !== "dinero").flatMap((topic, group) => Array.from({ length: 4 }, (_, index) => ({ exercise_id: `e-${topic}`, direction: "ja_es", evaluation_status: "valid", overall_score: 90, is_acceptable: true, attempted_at: `2026-08-${String(group * 4 + index + 1).padStart(2, "0")}T12:00:00Z` })));
  const progress = exercises.filter(exercise => exercise.exercise_id !== "e-dinero").map(exercise => ({ exercise_id: exercise.exercise_id, cooldown_until: "2000-01-01T00:00:00Z", next_review_at: "2000-01-01T00:00:00Z", average_score: 90 }));
  assert.deepEqual(Array.from(srs.choose(exercises, progress, attempts, 1, { levels: ["N5"] }, "ja_es", "2026-08-15", [])), ["e-dinero"]);
});

test("recent lexical repetition is penalized so daily plans diversify words", () => {
  const srs = planner();
  const exercises = [
    { exercise_id: "repeat-1", active: true, direction: "ja_es", jlpt_level: "N5", difficulty: 30, topic_tags: ["ocio"], grammar_tags: ["g-a"], vocabulary_tags: ["病院"], kanji_tags: ["院"], register: "cortes" },
    { exercise_id: "repeat-2", active: true, direction: "ja_es", jlpt_level: "N5", difficulty: 30, topic_tags: ["ocio"], grammar_tags: ["g-b"], vocabulary_tags: ["病院"], kanji_tags: ["院"], register: "cortes" },
    { exercise_id: "fresh-1", active: true, direction: "ja_es", jlpt_level: "N5", difficulty: 30, topic_tags: ["dinero"], grammar_tags: ["g-c"], vocabulary_tags: ["お金"], kanji_tags: ["金"], register: "cortes" },
    { exercise_id: "fresh-2", active: true, direction: "ja_es", jlpt_level: "N5", difficulty: 30, topic_tags: ["trabajo"], grammar_tags: ["g-d"], vocabulary_tags: ["仕事"], kanji_tags: ["仕"], register: "cortes" },
  ];
  const attempts = Array.from({ length: 10 }, (_, index) => ({ exercise_id: index % 2 ? "repeat-1" : "repeat-2", direction: "ja_es", evaluation_status: "valid", overall_score: 60, is_acceptable: false, attempted_at: `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00Z` }));
  const progress = exercises.map(exercise => ({ exercise_id: exercise.exercise_id, cooldown_until: "2000-01-01T00:00:00Z", next_review_at: "2000-01-01T00:00:00Z", average_score: exercise.exercise_id.startsWith("repeat") ? 60 : 80 }));
  const ids = srs.choose(exercises, progress, attempts, 2, { levels: ["N5"] }, "ja_es", "2026-08-15", []);
  assert.ok(ids.includes("fresh-1"));
  assert.ok(ids.includes("fresh-2"));
});

test("changing daily targets resizes today's pending plan without losing completed work", async () => {
  const TopicProgression = {
    analyze: () => [],
    bonus: () => 0,
    familyFor: () => "Conocimiento y consultas",
  };
  const exercises = [
    ...Array.from({ length: 24 }, (_, index) => ({ exercise_id: `ja-${index}`, active: true, direction: "ja_es", jlpt_level: "N5", difficulty: 20, topic_tags: [`ja-topic-${index}`], grammar_tags: [`ja-g-${index}`], vocabulary_tags: [`ja-v-${index}`] })),
    ...Array.from({ length: 14 }, (_, index) => ({ exercise_id: `es-${index}`, active: true, direction: "es_ja", jlpt_level: "N5", difficulty: 20, topic_tags: [`es-topic-${index}`], grammar_tags: [`es-g-${index}`], vocabulary_tags: [`es-v-${index}`] })),
  ];
  const sessionId = "profile::2026-08-30";
  let session = {
    session_id: sessionId,
    profile_id: "profile",
    local_date: "2026-08-30",
    planned_ja_es: 5,
    planned_es_ja: 5,
    exercise_ids_ja_es_json: JSON.stringify(exercises.filter(item => item.direction === "ja_es").slice(0, 5).map(item => item.exercise_id)),
    exercise_ids_es_ja_json: JSON.stringify(exercises.filter(item => item.direction === "es_ja").slice(0, 5).map(item => item.exercise_id)),
    completed_exercise_ids_json: JSON.stringify(["ja-0", "es-0"]),
    selection_reason_json: JSON.stringify({ strategy: "balanced_srs_variety_v11" }),
    status: "completed",
    completed_at: "2026-08-30T08:00:00Z",
  };
  const JapoDB = {
    get: async (store, id) => store === "daily_sessions" && id === sessionId ? session : null,
    all: async store => ({ exercises, exercise_progress: [], attempts: [] })[store] || [],
    put: async (store, value) => { if (store === "daily_sessions") session = value; },
  };
  const context = {
    window: { TopicProgression, RankedProgress: { snapshot: () => ({}), accessForDirection: () => ({ allowedLevels: ["N5"] }) } },
    TopicProgression,
    Difficulty: { bands: [0], bandFor: () => 0, score: () => 20, levelIndex: () => 0 },
    JapoDB,
    Date, Math, Set, Map, JSON,
  };
  vm.runInNewContext(fs.readFileSync(new URL("../src/session-planner.js", import.meta.url), "utf8"), context);
  const expanded = await context.window.SessionPlanner.getOrCreate("profile", { levels: ["N5"], dailyJaEs: 20, dailyEsJa: 10 }, "2026-08-30");
  assert.equal(expanded.planned_ja_es, 20);
  assert.equal(expanded.planned_es_ja, 10);
  assert.equal(expanded.status, "in_progress");
  assert.equal(expanded.completed_at, null);
  assert.ok(JSON.parse(expanded.exercise_ids_ja_es_json).includes("ja-0"));
  assert.ok(JSON.parse(expanded.exercise_ids_es_ja_json).includes("es-0"));

  const reduced = await context.window.SessionPlanner.getOrCreate("profile", { levels: ["N5"], dailyJaEs: 3, dailyEsJa: 2 }, "2026-08-30");
  assert.equal(reduced.planned_ja_es, 3);
  assert.equal(reduced.planned_es_ja, 2);
  assert.ok(JSON.parse(reduced.exercise_ids_ja_es_json).includes("ja-0"));
  assert.ok(JSON.parse(reduced.exercise_ids_es_ja_json).includes("es-0"));
});

test("voluntary repeats are appended beyond the normal 20 and 10 quotas", async () => {
  const TopicProgression = { analyze: () => [], bonus: () => 0, familyFor: () => "Conocimiento y consultas" };
  const exercises = [
    ...Array.from({ length: 30 }, (_, index) => ({ exercise_id: `ja-${index}`, active: true, direction: "ja_es", jlpt_level: "N5", difficulty: 20, topic_tags: [`ja-${index}`], grammar_tags: [`jg-${index}`], vocabulary_tags: [`jv-${index}`] })),
    ...Array.from({ length: 20 }, (_, index) => ({ exercise_id: `es-${index}`, active: true, direction: "es_ja", jlpt_level: "N5", difficulty: 20, topic_tags: [`es-${index}`], grammar_tags: [`eg-${index}`], vocabulary_tags: [`ev-${index}`] })),
  ];
  const attempts = [
    ...[0, 1, 2, 3].map(index => ({ attempt_id: `rj-${index}`, profile_id: "profile", exercise_id: `ja-${index}`, direction: "ja_es", evaluation_status: "valid", overall_score: 80, attempted_at: "2026-08-30T12:00:00Z", repeat_tomorrow: true, repeat_requested_for: "2026-08-31", repeat_request_updated_at: `2026-08-30T12:0${index}:00Z` })),
    ...[0, 1].map(index => ({ attempt_id: `re-${index}`, profile_id: "profile", exercise_id: `es-${index}`, direction: "es_ja", evaluation_status: "valid", overall_score: 80, attempted_at: "2026-08-30T12:00:00Z", repeat_tomorrow: true, repeat_requested_for: "2026-08-31", repeat_request_updated_at: `2026-08-30T13:0${index}:00Z` })),
  ];
  let session = null;
  const JapoDB = {
    get: async () => session,
    all: async store => ({ exercises, exercise_progress: [], attempts })[store] || [],
    put: async (store, value) => { if (store === "daily_sessions") session = value; },
  };
  const context = {
    window: { TopicProgression, RankedProgress: { snapshot: () => ({}), accessForDirection: () => ({ allowedLevels: ["N5"] }) } },
    TopicProgression,
    Difficulty: { bands: [0], bandFor: () => 0, score: () => 20, levelIndex: () => 0 },
    JapoDB, Date, Math, Set, Map, JSON,
  };
  vm.runInNewContext(fs.readFileSync(new URL("../src/session-planner.js", import.meta.url), "utf8"), context);
  const planned = await context.window.SessionPlanner.getOrCreate("profile", { levels: ["N5"], dailyJaEs: 20, dailyEsJa: 10 }, "2026-08-31");
  const ja = JSON.parse(planned.exercise_ids_ja_es_json), es = JSON.parse(planned.exercise_ids_es_ja_json);
  assert.equal(planned.planned_ja_es, 20);
  assert.equal(planned.planned_es_ja, 10);
  assert.equal(ja.length, 24);
  assert.equal(es.length, 12);
  assert.deepEqual(JSON.parse(planned.voluntary_repeat_ids_ja_es_json), ["ja-0", "ja-1", "ja-2", "ja-3"]);
  assert.deepEqual(JSON.parse(planned.voluntary_repeat_ids_es_ja_json), ["es-0", "es-1"]);
  assert.equal(new Set(ja).size, 24);
  assert.equal(new Set(es).size, 12);
});
