import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const evaluator = fs.readFileSync(new URL("../src/evaluators/openai-evaluator.js", import.meta.url), "utf8");
const router = fs.readFileSync(new URL("../src/evaluators/evaluator-router.js", import.meta.url), "utf8");

test("mobile evaluation retries interrupted requests with backoff", () => {
  assert.match(evaluator, /retries=2/);
  assert.match(evaluator, /\[1200,3000\]/);
  assert.match(evaluator, /Reconectando/);
});

test("evaluation diagnoses worker reachability instead of exposing Failed to fetch", () => {
  assert.match(evaluator, /workerAvailable/);
  assert.match(evaluator, /tu respuesta sigue guardada/i);
  assert.match(evaluator, /failed to fetch\|networkerror\|load failed/i);
});

test("the evaluator honors the synchronized endpoint", () => {
  assert.match(router, /endpoint:settings\.aiEndpoint/);
});
