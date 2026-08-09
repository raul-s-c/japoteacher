import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

function reports() {
  const context = { window: {}, document: { querySelector: () => null } };
  vm.runInNewContext(
    fs.readFileSync(new URL("../src/reports.js", import.meta.url), "utf8"),
    context,
  );
  return context.window.LearningReports;
}

function localDateKey(value) {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

test("weekly report covers the seven calendar days ending on Sunday", () => {
  const period = reports().period("weekly", new Date("2026-08-09T12:00:00Z"));
  assert.equal(localDateKey(period.start), "2026-08-03");
  assert.equal(localDateKey(period.end), "2026-08-09");
});

test("monthly report closes the previous natural month", () => {
  const period = reports().period("monthly", new Date("2026-08-01T12:00:00Z"));
  assert.equal(localDateKey(period.start), "2026-07-01");
  assert.equal(localDateKey(period.end), "2026-07-31");
});
