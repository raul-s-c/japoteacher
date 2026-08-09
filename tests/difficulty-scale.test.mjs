import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

function difficulty() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../src/difficulty.js", import.meta.url), "utf8"), context);
  return context.window.Difficulty;
}

test("difficulty is scaled inside each JLPT level", () => {
  const scale = difficulty();
  assert.equal(scale.score({ jlpt_level: "N5", difficulty: 1 }), 0);
  assert.equal(scale.score({ jlpt_level: "N5", difficulty: 4 }), 100);
  assert.equal(scale.score({ jlpt_level: "N4", difficulty: 4 }), 0);
  assert.equal(scale.score({ jlpt_level: "N4", difficulty: 7 }), 100);
});

test("a JLPT level takes priority over its local difficulty", () => {
  const scale = difficulty();
  assert.ok(scale.levelIndex({ jlpt_level: "N5" }) < scale.levelIndex({ jlpt_level: "N4" }));
});
