import assert from "node:assert/strict";
import { normalizeEvaluation, spanishSourceMarksRegister } from "../worker/src/evaluation-policy.js";

function evaluation(overrides = {}) {
  return {
    objective_score: 100, comprehensibility_score: 100, naturalness_score: 100,
    grammar_score: 100, vocabulary_score: 100, orthography_score: 100,
    register_score: 100, overall_score: 100, is_acceptable: true,
    meaning_changed: false, errors: [], detected_error_tags: [], ...overrides,
  };
}

{
  const result = normalizeEvaluation(evaluation({
    objective_score: 30, comprehensibility_score: 15, naturalness_score: 15,
    grammar_score: 15, vocabulary_score: 10, orthography_score: 10,
    register_score: 5, errors: [{ category: "grammar" }],
    detected_error_tags: ["grammar"],
  }), { exercise: { direction: "ja_es", source_text: "猫がいます。" } });
  for (const key of ["objective_score", "comprehensibility_score", "naturalness_score",
    "grammar_score", "vocabulary_score", "orthography_score", "register_score"])
    assert.equal(result[key], 100);
  assert.deepEqual(result.errors, []);
}

{
  const result = normalizeEvaluation(evaluation({
    objective_score: 90, comprehensibility_score: 90, naturalness_score: 90,
    grammar_score: 90, vocabulary_score: 90, orthography_score: 90,
    register_score: 40, overall_score: 88,
    errors: [{ category: "politeness" }, { category: "vocabulary_choice" }],
    detected_error_tags: ["politeness", "vocabulary_choice"],
  }), { exercise: { direction: "es_ja", source_text: "Mañana voy a la biblioteca." } });
  assert.equal(result.register_score, 100);
  assert.equal(result.overall_score, 91);
  assert.deepEqual(result.errors, [{ category: "vocabulary_choice" }]);
  assert.deepEqual(result.detected_error_tags, ["vocabulary_choice"]);
}

{
  const result = normalizeEvaluation(evaluation({ register_score: 45, overall_score: 97 }),
    { exercise: { direction: "es_ja", source_text: "¿Puede usted ayudarme?" } });
  assert.equal(result.register_score, 45);
  assert.equal(result.overall_score, 97);
  assert.equal(spanishSourceMarksRegister("¿Vienes tú?"), true);
  assert.equal(spanishSourceMarksRegister("Ven mañana."), false);
}

console.log("evaluation-policy: ok");
