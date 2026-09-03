import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

function feedback(ev, answer, options) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../src/feedback-usage-data.js", import.meta.url), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(new URL("../src/feedback-vocabulary.js", import.meta.url), "utf8"), context);
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
  assert.match(html, /respuesta modelo/);
});

test("key words show their real-usage percentile and derived level", () => {
  const html = feedback({
    ...evaluation,
    kanji_readings: [{ characters: "友達", reading_hiragana: "ともだち", meaning_es: "amigo", explanation_es: "Persona cercana." }],
  }, "Ayer fui con un amigo.", {
    direction: "ja_es",
    exercise: {
      reference_translation: "Ayer fui con un amigo.",
      usage_components: [{ k: "v", t: "友達", p: 7.42, l: "N5" }],
    },
  });
  assert.match(html, /Palabras clave del enunciado/);
  assert.match(html, /友達 · uso combinado top 7\.4% · N5/);
});

test("a grouped reading shows the rank of each matched Japanese term", () => {
  const html = feedback({
    ...evaluation,
    correct_japanese_sentence: "仕事の資料です。",
    kanji_readings: [{ characters: "仕事の資料", reading_hiragana: "しごとのしりょう", meaning_es: "documentos de trabajo", explanation_es: "Material de trabajo." }],
  }, "Documentos de trabajo.", {
    direction: "ja_es",
    exercise: {
      reference_translation: "Documentos de trabajo.",
      usage_components: [
        { k: "v", t: "仕事", p: 0.3, l: "N5", w: 0.91, d: 81, x: 57 },
        { k: "v", t: "資料", p: 1.76, l: "N5", w: 5.78, d: 63, x: 67 },
      ],
    },
  });
  assert.match(html, /仕事 · uso combinado top 0\.30%/);
  assert.match(html, /資料 · uso combinado top 1\.8%/);
});

test("feedback repairs screenshot spelling and separates wrong-answer vocabulary", () => {
  const html=feedback({...evaluation,correct_japanese_sentence:'きょうはうちで母が晩ご飯を作ります。',natural_answer:'きょうはうちで母が晩ご飯を作ります。',kanji_readings:[
    {characters:'家',reading_hiragana:'いえ',meaning_es:'casa'},
    {characters:'母',reading_hiragana:'はは',meaning_es:'madre'},
    {characters:'晩ごはん',reading_hiragana:'ばんごはん',meaning_es:'cena'},
    {characters:'料理ます',reading_hiragana:'りょうります',meaning_es:'incorrecta'},
  ]},'家に今日は、晩ごはんが母料理ます',{direction:'es_ja'});
  const support=html.split('<section class="correct-japanese">')[1].split('<section class="answer-comparison">')[0];
  assert.match(support,/<ruby>今日<rt>きょう<\/rt>/);
  assert.match(support,/<ruby>作ります<rt>つくります<\/rt>/);
  assert.match(support,/今日 · uso combinado top 0\.31%/);
  assert.match(support,/作る · uso combinado top 7\.8%/);
  assert.match(support,/Sin ranking disponible/);
  assert.doesNotMatch(support,/料理ます|<strong>家<\/strong>/);
  assert.match(html,/家に今日は、晩ごはんが母料理ます/);
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
