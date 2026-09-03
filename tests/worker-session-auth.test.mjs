import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const worker = fs.readFileSync(new URL("../worker/src/index.js", import.meta.url), "utf8");

test("worker retries transient mobile heartbeat failures", () => {
  assert.match(worker, /for \(const delay of \[0, 250, 700\]\)/);
  assert.match(worker, /AbortSignal\.timeout\(8000\)/);
});

test("worker distinguishes a missing lease from a temporary lease-service failure", () => {
  assert.match(worker, /rpc\/claim_user_session/);
  assert.match(worker, /\/auth\/v1\/user/);
  assert.match(worker, /p_force: false/);
});
