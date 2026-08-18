import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

function ranked() {
  const context = { window: {} };
  context.window.TopicProgression = { familyFor(topic) { return String(topic).includes("trabajo") ? "Trabajo y carrera" : String(topic).includes("familia") ? "Familia y amigos" : String(topic).includes("dinero") ? "Dinero y proyectos" : String(topic).includes("consulta") ? "Conocimiento y consultas" : "Ocio y vida diaria"; } };
  vm.runInNewContext(fs.readFileSync(new URL("../src/ranked-progress.js", import.meta.url), "utf8"), context);
  return context.window.RankedProgress;
}

test("JLPT goals create one continuous route with exponential segments", () => {
  const xp = ranked();
  assert.deepEqual(JSON.parse(JSON.stringify(xp.goals)), { N5: 100, N4: 200, N3: 400, N2: 800, N1: 1600 });
  assert.deepEqual(JSON.parse(JSON.stringify(xp.starts)), { N5: 0, N4: 100, N3: 300, N2: 700, N1: 1500 });
  assert.deepEqual(JSON.parse(JSON.stringify(xp.routeForPosition(100))), { level: "N4", points: 0, goal: 200, percent: 0, position: 100, next: "N3" });
});

test("EXP pace follows the intended longer calendar path at higher JLPT levels", () => {
  const xp = ranked();
  const duration = level => xp.goals[level] / xp.baseExperience({ direction: "ja_es", jlpt_level: level, difficulty: 50 });
  const n5 = duration("N5");
  assert.ok(Math.abs(duration("N4") / n5 - 1.5) < .02);
  assert.ok(Math.abs(duration("N3") / n5 - 2) < .02);
  assert.ok(Math.abs(duration("N2") / n5 - 4) < .02);
  assert.ok(Math.abs(duration("N1") / n5 - 8) < .02);
});

test("a difficult new sentence gives more EXP than an easy repeated one", () => {
  const xp = ranked();
  const hardNew = xp.deltaFor(0, { direction: "ja_es", jlpt_level: "N4", difficulty: 90 }, { overall_score: 95 }, { currentLevel: "N4", timesSeen: 0 });
  const easyRepeat = xp.deltaFor(0, { direction: "ja_es", jlpt_level: "N4", difficulty: 15 }, { overall_score: 95 }, { currentLevel: "N4", timesSeen: 2, previousScore: 95 });
  assert.ok(hardNew > easyRepeat * 4);
});

test("failing an above-level sentence is penalized softly", () => {
  const xp = ranked();
  const hardMiss = xp.deltaFor(0, { direction: "ja_es", jlpt_level: "N4", difficulty: 90 }, { overall_score: 45 }, { currentLevel: "N5" });
  const easyMiss = xp.deltaFor(0, { direction: "ja_es", jlpt_level: "N5", difficulty: 35 }, { overall_score: 45 }, { currentLevel: "N5" });
  assert.ok(Math.abs(hardMiss) < Math.abs(easyMiss));
});

test("fifty is the minimum passing score for EXP", () => {
  const xp = ranked();
  const exercise = { direction: "ja_es", jlpt_level: "N5", difficulty: 50 };
  const atFifty = xp.deltaFor(0, exercise, { overall_score: 50 }, { currentLevel: "N5" });
  const belowFifty = xp.deltaFor(0, exercise, { overall_score: 49 }, { currentLevel: "N5" });
  const solid = xp.deltaFor(0, exercise, { overall_score: 70 }, { currentLevel: "N5" });
  assert.ok(atFifty > 0);
  assert.ok(atFifty < solid / 5);
  assert.ok(belowFifty < 0);
});

test("a high-difficulty N4 answer pulls a late N5 learner farther right", () => {
  const xp = ranked();
  const context = { position: 95, currentLevel: "N5", timesSeen: 0 };
  const highN4 = xp.deltaFor(95, { direction: "ja_es", jlpt_level: "N4", difficulty: 95 }, { overall_score: 69 }, context);
  const lowN4 = xp.deltaFor(95, { direction: "ja_es", jlpt_level: "N4", difficulty: 5 }, { overall_score: 69 }, context);
  assert.ok(highN4 > lowN4);
  assert.ok(lowN4 > 0);
});

test("correct answers scale up when the question is farther to the right", () => {
  const xp = ranked();
  const context = { position: 70, currentLevel: "N5", timesSeen: 0 };
  const nearRight = xp.deltaFor(70, { direction: "ja_es", jlpt_level: "N5", difficulty: 90 }, { overall_score: 90 }, context);
  const farRight = xp.deltaFor(70, { direction: "ja_es", jlpt_level: "N4", difficulty: 75 }, { overall_score: 90 }, context);
  assert.ok(farRight > nearRight * 2);
});

test("direction tracks are independent and family evidence stays separate", () => {
  const xp = ranked();
  const exercises = [{ exercise_id: "a", direction: "ja_es", jlpt_level: "N5", difficulty: 70, topic_tags: ["trabajo"] }, { exercise_id: "b", direction: "es_ja", jlpt_level: "N5", difficulty: 70, topic_tags: ["ocio"] }];
  const attempts = exercises.map((exercise, index) => ({ exercise_id: exercise.exercise_id, direction: exercise.direction, attempted_at: `2026-08-13T08:0${index}:00Z`, evaluation_status: "valid", overall_score: 90, is_acceptable: true }));
  const snapshot = xp.snapshot(exercises, attempts);
  assert.ok(xp.primaryForDirection(snapshot, "ja_es").points > 0);
  assert.equal(xp.primaryForDirection(snapshot, "es_ja").points > xp.primaryForDirection(snapshot, "ja_es").points, true);
  assert.equal(xp.get(snapshot, "ja_es", "Trabajo y carrera").attempts, 1);
  assert.equal(xp.get(snapshot, "ja_es", "Ocio y vida diaria").attempts, 0);
});

test("scored legacy attempts contribute to EXP and family evidence", () => {
  const xp = ranked();
  const exercises = [{ exercise_id: "legacy-money", direction: "ja_es", jlpt_level: "N5", difficulty: 30, topic_tags: ["dinero"] }];
  const attempts = [{ exercise_id: "legacy-money", direction: "ja_es", attempted_at: "2026-08-14T12:00:00Z", evaluation_status: "legacy_import", overall_score: 94, is_acceptable: true }];
  const snapshot = xp.snapshot(exercises, attempts);
  assert.equal(xp.get(snapshot, "ja_es", "Dinero y proyectos").attempts, 1);
  assert.ok(xp.primaryForDirection(snapshot, "ja_es").points > 0);
});

test("a cross-family sentence supplies evidence to every tagged family", () => {
  const xp = ranked();
  const exercises = [{ exercise_id: "travel-money", direction: "ja_es", jlpt_level: "N5", difficulty: 78, topic_tags: ["viajes", "dinero"] }];
  const attempts = [{ exercise_id: "travel-money", direction: "ja_es", attempted_at: "2026-08-12T11:28:18.877Z", evaluation_status: "valid", overall_score: 100, is_acceptable: true }];
  const snapshot = xp.snapshot(exercises, attempts);
  assert.equal(xp.get(snapshot, "ja_es", "Ocio y vida diaria").attempts, 1);
  assert.equal(xp.get(snapshot, "ja_es", "Dinero y proyectos").attempts, 1);
});

test("the next JLPT appears only at 80 EXP and adequate evidence in every family", () => {
  const xp = ranked();
  const topics = ["familia", "trabajo", "dinero", "ocio", "consulta"];
  const exercises = Array.from({ length: 2600 }, (_, index) => ({
    exercise_id: `n5-${index}`, direction: "ja_es", jlpt_level: "N5", difficulty: 100, topic_tags: [topics[index % topics.length]],
  })).concat({ exercise_id: "n4", direction: "ja_es", jlpt_level: "N4", difficulty: 20, topic_tags: ["trabajo"] });
  const attempts = exercises.slice(0, -1).map((exercise, index) => ({ exercise_id: exercise.exercise_id, direction: exercise.direction, attempted_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(), evaluation_status: "valid", overall_score: 100, is_acceptable: true }));
  const access = xp.accessForDirection(xp.snapshot(exercises, attempts), "ja_es");
  assert.equal(access.level, "N4");
  assert.ok(access.allowedLevels.includes("N4"));
});

test("rank badges show the concrete EXP goal", () => {
  const xp = ranked();
  assert.match(xp.badgeHtml({ level: "N4", points: 95, goal: 200 }), /95\/200 EXP/);
  assert.match(xp.badgeHtml({ level: "N5", points: 4.749, goal: 100 }), /4,75\/100 EXP/);
});

test("the EXP ledger preserves a question-by-question daily history", () => {
  const xp = ranked();
  const exercises = [{ exercise_id: "ledger", direction: "ja_es", jlpt_level: "N5", difficulty: 50, topic_tags: ["dinero"] }];
  const attempts = [
    { attempt_id: "first", exercise_id: "ledger", direction: "ja_es", attempted_at: "2026-08-14T08:00:00Z", evaluation_status: "valid", overall_score: 90, is_acceptable: true },
    { attempt_id: "second", exercise_id: "ledger", direction: "ja_es", attempted_at: "2026-08-15T08:00:00Z", evaluation_status: "valid", overall_score: 35, is_acceptable: false },
  ];
  const ledger = xp.history(exercises, attempts);
  assert.equal(ledger.length, 2);
  assert.ok(ledger[0].delta > 0);
  assert.ok(ledger[1].delta < 0);
  assert.equal(ledger[0].families[0], "Dinero y proyectos");
});
