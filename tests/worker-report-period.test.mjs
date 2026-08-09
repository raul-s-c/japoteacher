import assert from "node:assert/strict";
import test from "node:test";
import { reportPeriod } from "../worker/src/report-generation.js";

function localDateKey(value) {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

test("scheduled weekly reports close the preceding Monday-Sunday period", () => {
  const period = reportPeriod("weekly", new Date("2026-08-10T01:15:00Z"), true);
  assert.equal(localDateKey(period.start), "2026-08-03");
  assert.equal(localDateKey(period.end), "2026-08-09");
});
