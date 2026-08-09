import assert from "node:assert/strict";
import test from "node:test";
import { localReport, reportPeriod } from "../worker/src/report-generation.js";

function localDateKey(value) {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

test("scheduled weekly reports close the preceding Monday-Sunday period", () => {
  const period = reportPeriod("weekly", new Date("2026-08-10T01:15:00Z"), true);
  assert.equal(localDateKey(period.start), "2026-08-03");
  assert.equal(localDateKey(period.end), "2026-08-09");
});

test("report versions preserve their remote identity", () => {
  const first = localReport({ report_id: "11111111-1111-1111-1111-111111111111", report_type: "weekly", period_start: "2026-08-03T00:00:00.000Z", period_end: "2026-08-09T23:59:59.999Z", revision: 1 });
  const second = localReport({ report_id: "22222222-2222-2222-2222-222222222222", report_type: "weekly", period_start: "2026-08-03T00:00:00.000Z", period_end: "2026-08-09T23:59:59.999Z", revision: 2 });
  assert.notEqual(first.report_id, second.report_id);
  assert.equal(second.remote_report_id, second.report_id);
});
