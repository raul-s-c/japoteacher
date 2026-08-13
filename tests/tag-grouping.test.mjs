import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

function analytics() {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(new URL("../src/analytics.js", import.meta.url), "utf8"),
    context,
  );
  return context.window.Analytics;
}

function analyticsWith(rows) {
  const context = {
    window: {},
    document: { addEventListener: () => {} },
    JapoDB: { all: async (store) => rows[store] || [] },
  };
  vm.runInNewContext(
    fs.readFileSync(new URL("../src/analytics.js", import.meta.url), "utf8"),
    context,
  );
  return context.window.Analytics;
}

test("tag grouping keeps the most actionable tags in each category", () => {
  const tags = [
    { type: "grammar", value: "A", count: 1, average: 20, priority: 27 },
    { type: "grammar", value: "B", count: 4, average: 30, priority: 70 },
    { type: "grammar", value: "C", count: 4, average: 40, priority: 60 },
    { type: "grammar", value: "D", count: 4, average: 50, priority: 50 },
    { type: "vocabulary", value: "E", count: 3, average: 35, priority: 65 },
  ];
  const groups = analytics().groupTags(tags);
  const grammar = groups.find((group) => group.type === "grammar");

  assert.equal(grammar.total, 4);
  assert.deepEqual(Array.from(grammar.items, (tag) => tag.value), ["B", "C", "D"]);
});

test("analytics excludes invalid evaluations from mastery metrics", async () => {
  const snapshot = await analyticsWith({
    attempts: [
      { attempt_id: "valid", direction: "ja_es", evaluation_status: "valid", overall_score: 80, is_acceptable: true, attempted_at: "2026-08-13T10:00:00Z" },
      { attempt_id: "invalid", direction: "ja_es", evaluation_status: "invalid", overall_score: 0, is_acceptable: false, attempted_at: "2026-08-13T11:00:00Z" },
    ],
  }).snapshot();

  assert.deepEqual(Array.from(snapshot.attempts, (attempt) => attempt.attempt_id), ["valid"]);
  assert.equal(snapshot.dirs.ja_es.count, 1);
  assert.equal(snapshot.dirs.ja_es.average, 80);
});
