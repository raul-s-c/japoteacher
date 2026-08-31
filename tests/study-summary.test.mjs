import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("the weekly summary separates translations, news and micro-SRS", () => {
  const now = new Date(), attemptedAt = now.toISOString(), attempts = [
    { attempt_id: "a", exercise_id: "a", direction: "ja_es", attempted_at: attemptedAt, overall_score: 80 },
    { attempt_id: "b", exercise_id: "news:b", direction: "ja_es", attempted_at: attemptedAt, overall_score: 90, study_event_type: "daily_news_answer", topic_tags: ["dinero"] },
    { attempt_id: "c", exercise_id: "lexical:c", direction: "es_ja", attempted_at: attemptedAt, overall_score: 100, study_event_type: "lexical_review", vocabulary_tags: ["本"] },
  ];
  const ranked = { history: () => attempts.map((item, index) => ({ attempt_id: item.attempt_id, delta: index + 1, direction: item.direction, attempted_at: item.attempted_at })), primaryForDirection: () => ({ level: "N5", points: 5, goal: 100 }) };
  const context = { window: { RankedProgress: ranked, TopicProgression: { familyFor: topic => topic === "dinero" ? "Dinero y proyectos" : "Conocimiento y consultas" } }, RankedProgress: ranked, Intl, Date, Map, Set };
  vm.runInNewContext(fs.readFileSync(new URL("../src/study-summary.js", import.meta.url), "utf8"), context);
  const model = context.window.StudySummary.model({ attempts, exercises: [{ exercise_id: "a", topic_tags: ["consulta"] }], eMap: new Map([["a", { exercise_id: "a", topic_tags: ["consulta"] }]]) }, {}, "all");
  assert.equal(model.attempts, 3);
  assert.equal(model.activities.length, 3);
  assert.equal(model.totalXp, 6);
  assert.equal(model.uniqueTerms, 1);
});
