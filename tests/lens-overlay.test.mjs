import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const overlay = fs.readFileSync(new URL("../src/lens-overlay.js", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../worker/src/index.js", import.meta.url), "utf8");
const android = fs.readFileSync(new URL("../android/app/src/main/java/io/github/raul_s_c/japoteacher/LensCaptureActivity.java", import.meta.url), "utf8");
const serviceWorker = fs.readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");

test("the native lens explains inside its overlay instead of opening the main app", () => {
  assert.match(android, /lens-overlay\.html/);
  assert.match(android, /class OverlayBridge/);
  assert.doesNotMatch(android, /LauncherActivity\.openWithLensResult\(/);
});

test("lens analyses preserve explicit editorial candidates in synchronized history", () => {
  assert.match(overlay, /reusable_phrase_candidates_json/);
  assert.match(overlay, /pending_editorial_review/);
  assert.match(overlay, /candidate_source:'lens_overlay'/);
});

test("the worker returns a concise overlay summary alongside full teaching detail", () => {
  assert.match(worker, /overlay_summary_es/);
  assert.match(worker, /una o dos frases breves/);
});

test("the overlay navigation never replaces the cached main application shell", () => {
  assert.match(serviceWorker, /endsWith\('\/lens-overlay\.html'\)\?'lens-overlay\.html':'index\.html'/);
});
