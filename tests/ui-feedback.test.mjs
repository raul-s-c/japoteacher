import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

function feedback(ev, answer, options) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../src/ui.js", import.meta.url), "utf8"), context);
  return context.window.UI.feedback(ev, answer, options);
}

const evaluation = {
  overall_score: 88,
  is_acceptable: true,
  natural_answer: "Ayer subi al metro con un amigo.",
  correct_japanese_sentence: "\u6628\u65e5\u3001\u53cb\u9054\u3068\u5730\u4e0b\u9244\u306b\u4e57\u308a\u307e\u3057\u305f\u3002",
  explanation_es: "La idea se entiende.",
  errors: [],
  strengths: [],
  kanji_readings: [],
  objective_score: 88,
  comprehensibility_score: 88,
  naturalness_score: 88,
  grammar_score: 88,
  vocabulary_score: 88,
  orthography_score: 88,
  register_score: 88,
};

test("JP to ES feedback shows the Spanish reference instead of repeating the prompt", () => {
  const html = feedback(evaluation, "Ayer subi al metro con un amigo.", { direction: "ja_es", exercise: { reference_translation: "Ayer tome el metro con un amigo." } });
  assert.match(html, /Traducci.n de referencia/);
  assert.match(html, /Ayer tome el metro con un amigo/);
  assert.doesNotMatch(html, /frase correcta en japon/);
});

test("ES to JP feedback retains the corrected Japanese sentence", () => {
  const html = feedback(evaluation, "Ayer fui en metro con un amigo.", { direction: "es_ja" });
  assert.match(html, /frase correcta en japon/);
  assert.match(html, /\u6628\u65e5/);
});

test("feedback hides fragment corrections that do not change the fragment", () => {
  const html = feedback({
    ...evaluation,
    errors: [
      {
        source_span: "バスが",
        corrected_span: "バスに",
        explanation_es: "Con 乗る se usa に para el medio de transporte.",
      },
      {
        source_span: "乗りましょうか",
        corrected_span: "乗りましょうか",
        explanation_es: "La forma es correcta por sí misma.",
      },
    ],
  }, "バスが乗りましょうか", { direction: "es_ja" });
  assert.match(html, /バスが/);
  assert.match(html, /バスに/);
  assert.doesNotMatch(html, /La forma es correcta por sí misma/);
  assert.equal((html.match(/Tu fragmento/g) || []).length, 1);
});
