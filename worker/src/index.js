import { normalizeEvaluation } from "./evaluation-policy.js";
import { allUserStates, deleteReport, generateReport, localReport, reportPeriod, reportsForUser, userPayload } from "./report-generation.js";

import { generateLesson, validLessonInput } from "./daily-lesson.js";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const errorCategories = [
  "meaning_change",
  "omission",
  "addition",
  "particle",
  "verb_conjugation",
  "tense_aspect",
  "word_order",
  "vocabulary_choice",
  "collocation",
  "register",
  "politeness",
  "kanji",
  "kana",
  "punctuation",
  "counter",
  "adjective",
  "relative_clause",
  "condition",
  "literal_translation",
  "unnatural_expression",
  "source_misunderstanding",
];
const score = { type: "integer", minimum: 0, maximum: 100 };
const stringList = { type: "array", items: { type: "string" } };
const errorSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "error_id",
    "category",
    "subtype",
    "severity",
    "source_span",
    "corrected_span",
    "explanation_es",
    "grammar_tags",
    "vocabulary_tags",
    "affects_meaning",
    "affects_comprehensibility",
    "affects_naturalness",
  ],
  properties: {
    error_id: { type: "string" },
    category: { type: "string", enum: errorCategories },
    subtype: { type: "string" },
    severity: { type: "string", enum: ["minor", "major", "critical"] },
    source_span: { type: "string" },
    corrected_span: { type: "string" },
    explanation_es: { type: "string" },
    grammar_tags: stringList,
    vocabulary_tags: stringList,
    affects_meaning: { type: "boolean" },
    affects_comprehensibility: { type: "boolean" },
    affects_naturalness: { type: "boolean" },
  },
};
const kanjiReadingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["characters", "reading_hiragana", "meaning_es", "explanation_es"],
  properties: {
    characters: { type: "string" },
    reading_hiragana: { type: "string" },
    meaning_es: { type: "string" },
    explanation_es: { type: "string" },
  },
};
const evaluationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "evaluation_status",
    "corrected_answer",
    "natural_answer",
    "correct_japanese_sentence",
    "kanji_readings",
    "objective_score",
    "comprehensibility_score",
    "naturalness_score",
    "grammar_score",
    "vocabulary_score",
    "orthography_score",
    "register_score",
    "overall_score",
    "is_acceptable",
    "meaning_changed",
    "confidence_score",
    "explanation_es",
    "native_interpretation_es",
    "strengths",
    "errors",
    "detected_grammar_tags",
    "detected_vocabulary_tags",
    "detected_error_tags",
    "next_practice_tags",
  ],
  properties: {
    evaluation_status: { type: "string", enum: ["valid"] },
    corrected_answer: { type: "string" },
    natural_answer: { type: "string" },
    correct_japanese_sentence: { type: "string" },
    kanji_readings: { type: "array", items: kanjiReadingSchema },
    objective_score: score,
    comprehensibility_score: score,
    naturalness_score: score,
    grammar_score: score,
    vocabulary_score: score,
    orthography_score: score,
    register_score: score,
    overall_score: score,
    is_acceptable: { type: "boolean" },
    meaning_changed: { type: "boolean" },
    confidence_score: score,
    explanation_es: { type: "string" },
    native_interpretation_es: { type: "string" },
    strengths: stringList,
    errors: { type: "array", items: errorSchema },
    detected_grammar_tags: stringList,
    detected_vocabulary_tags: stringList,
    detected_error_tags: stringList,
    next_practice_tags: stringList,
  },
};
const contextExplanationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reading_hiragana", "meaning_es", "context_es", "usage_note_es"],
  properties: {
    reading_hiragana: { type: "string" },
    meaning_es: { type: "string" },
    context_es: { type: "string" },
    usage_note_es: { type: "string" },
  },
};
const questionHelpSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer_es", "example_ja", "example_es", "caution_es"],
  properties: {
    answer_es: { type: "string" },
    example_ja: { type: "string" },
    example_es: { type: "string" },
    caution_es: { type: "string" },
  },
};
const tutorAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["mode_label", "title_es", "natural_translation", "translation_readings", "teacher_explanation", "grammar_breakdown", "kanji_vocabulary", "natural_options", "common_pitfalls"],
  properties: {
    mode_label: { type: "string" },
    title_es: { type: "string" },
    natural_translation: { type: "string" },
    translation_readings: { type: "array", items: kanjiReadingSchema },
    teacher_explanation: stringList,
    grammar_breakdown: stringList,
    kanji_vocabulary: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "reading", "meaning_es", "role_es"],
        properties: {
          item: { type: "string" },
          reading: { type: "string" },
          meaning_es: { type: "string" },
          role_es: { type: "string" },
        },
      },
    },
    natural_options: stringList,
    common_pitfalls: stringList,
  },
};
const tutorChatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer_es"],
  properties: { answer_es: { type: "string" } },
};
const lensAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["context_label", "title_es", "ocr_text", "translation_es", "overlay_summary_es", "teacher_explanation", "grammar_points", "kanji_vocabulary", "study_notes", "reusable_phrase_candidates", "jlpt_estimate"],
  properties: {
    context_label: { type: "string" },
    title_es: { type: "string" },
    ocr_text: { type: "string" },
    translation_es: { type: "string" },
    overlay_summary_es: { type: "string" },
    teacher_explanation: stringList,
    grammar_points: stringList,
    kanji_vocabulary: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "reading_hiragana", "meaning_es", "note_es"],
        properties: {
          term: { type: "string" },
          reading_hiragana: { type: "string" },
          meaning_es: { type: "string" },
          note_es: { type: "string" },
        },
      },
    },
    study_notes: stringList,
    reusable_phrase_candidates: stringList,
    jlpt_estimate: { type: "string" },
  },
};
const dailyNewsQuestionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["question_ja", "question_es", "answer_ja", "answer_es"],
  properties: {
    question_ja: { type: "string" },
    question_es: { type: "string" },
    answer_ja: { type: "string" },
    answer_es: { type: "string" },
  },
};
const dailyNewsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["selected_source", "japanese_title", "japanese_article", "furigana_readings", "spanish_summary", "level_notes", "vocabulary", "grammar_points", "discussion_questions", "source_note"],
  properties: {
    selected_source: {
      type: "object",
      additionalProperties: false,
      required: ["title", "url", "source", "published", "description"],
      properties: {
        title: { type: "string" },
        url: { type: "string" },
        source: { type: "string" },
        published: { type: "string" },
        description: { type: "string" },
      },
    },
    japanese_title: { type: "string" },
    japanese_article: { type: "string" },
    furigana_readings: { type: "array", items: kanjiReadingSchema },
    spanish_summary: stringList,
    level_notes: stringList,
    vocabulary: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "reading", "meaning_es", "note_es"],
        properties: {
          term: { type: "string" },
          reading: { type: "string" },
          meaning_es: { type: "string" },
          note_es: { type: "string" },
        },
      },
    },
    grammar_points: stringList,
    discussion_questions: { type: "array", items: dailyNewsQuestionSchema },
    source_note: { type: "string" },
  },
};
const dailyNewsAnswerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "is_correct", "feedback_es", "model_answer_ja", "model_answer_es", "improvement_tip_es", "direction", "jlpt_level", "difficulty", "topic_tags", "grammar_tags", "vocabulary_tags", "lexical_failures"],
  properties: {
    score,
    is_correct: { type: "boolean" },
    feedback_es: { type: "string" },
    model_answer_ja: { type: "string" },
    model_answer_es: { type: "string" },
    improvement_tip_es: { type: "string" },
    direction: { type: "string", enum: ["ja_es", "es_ja"] },
    jlpt_level: { type: "string", enum: ["N5", "N4", "N3", "N2", "N1"] },
    difficulty: score,
    topic_tags: stringList,
    grammar_tags: stringList,
    vocabulary_tags: stringList,
    lexical_failures: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term_ja", "reading_hiragana", "prompt_es", "direction", "reason_es"],
        properties: {
          term_ja: { type: "string" },
          reading_hiragana: { type: "string" },
          prompt_es: { type: "string" },
          direction: { type: "string", enum: ["ja_es", "es_ja"] },
          reason_es: { type: "string" },
        },
      },
    },
  },
};

const editorialKanjiSchema = {
  type: "object",
  additionalProperties: false,
  required: ["characters", "reading_hiragana", "meaning_es", "explanation_es"],
  properties: {
    characters: { type: "string" },
    reading_hiragana: { type: "string" },
    meaning_es: { type: "string" },
    explanation_es: { type: "string" },
  },
};
const editorialPairProperties = {
  slot: { type: "integer", minimum: 1 },
  japanese: { type: "string" },
  spanish: { type: "string" },
  scenario_es: { type: "string" },
  topic_primary: { type: "string" },
  topic_secondary: stringList,
  situation_tag: { type: "string" },
  grammar_tags: stringList,
  particle_tags: stringList,
  vocabulary_tags: stringList,
  kanji_readings: { type: "array", items: editorialKanjiSchema },
  register: {
    type: "string",
    enum: ["familiar", "neutro", "cortés", "formal"],
  },
  communicative_function: { type: "string" },
  tense_aspect: { type: "string" },
  polarity: { type: "string", enum: ["afirmativa", "negativa", "mixta"] },
  sentence_type: { type: "string" },
  accepted_alternatives_es: stringList,
  accepted_alternatives_ja: stringList,
  ambiguity_notes: { type: "string" },
  critical_meaning_units: stringList,
  difficulty_rationale: { type: "string" },
  naturalness_rationale: { type: "string" },
};
const editorialPairRequired = Object.keys(editorialPairProperties),
  editorialPairSchema = {
    type: "object",
    additionalProperties: false,
    required: editorialPairRequired,
    properties: editorialPairProperties,
  };
const editorialGenerationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: editorialPairSchema,
    },
  },
};
const editorialReviewItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["index", "approved", "issues", "corrected"],
  properties: {
    index: { type: "integer", minimum: 0, maximum: 4 },
    approved: { type: "boolean" },
    issues: stringList,
    corrected: editorialPairSchema,
  },
};
const editorialReviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: editorialReviewItemSchema,
    },
  },
};
const kanjiRepairSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slot", "kanji_readings"],
        properties: {
          slot: { type: "integer", minimum: 1 },
          kanji_readings: { type: "array", items: editorialKanjiSchema },
        },
      },
    },
  },
};
const equivalenceCheckSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slot", "approved", "issues", "japanese", "spanish", "accepted_alternatives_es", "accepted_alternatives_ja"],
        properties: {
          slot: { type: "integer", minimum: 1 },
          approved: { type: "boolean" },
          issues: stringList,
          japanese: { type: "string" },
          spanish: { type: "string" },
          accepted_alternatives_es: stringList,
          accepted_alternatives_ja: stringList,
        },
      },
    },
  },
};
const difficultyReviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["exercise_id", "difficulty", "confidence", "rationale"],
        properties: {
          exercise_id: { type: "string" },
          difficulty: { type: "integer", minimum: 0, maximum: 100 },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          rationale: { type: "string" },
        },
      },
    },
  },
};

function cors(origin, env) {
  const allowed = (env.APP_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return allowed.includes(origin) || local ? origin : "";
}
function json(body, status = 200, origin = "", env = {}) {
  const allow = cors(origin, env);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(allow
        ? { "Access-Control-Allow-Origin": allow, Vary: "Origin" }
        : {}),
    },
  });
}
function systemPrompt() {
  return `Eres profesor de japonés para hispanohablantes. Evalúa la traducción admitiendo alternativas válidas y distingue significado, comprensión, naturalidad, gramática, vocabulario, ortografía y registro. Cada campo *_score es una nota independiente de 0 a 100, nunca la contribución ponderada: una respuesta perfecta tiene 100 en todos los campos, no 30/15/15. Si overall_score es 100, todos los campos *_score deben ser 100 y errors debe estar vacío. Explica en español de forma breve y precisa; no inventes errores. No añadas errores cuyo source_span y corrected_span sean iguales tras ignorar espacios, puntuación o furigana; si el problema es una combinación de partícula con verbo, corrige solo el fragmento que cambia realmente. En es_ja, si la frase española no marca inequívocamente el trato con palabras como tú, usted, vosotros o un tratamiento explícito, acepta por igual japonés llano y cortés: register_score debe ser 100 y no puede haber errores de register o politeness. No deduzcas formalidad solo por la traducción de referencia. correct_japanese_sentence será la fuente japonesa en ja_es y una propuesta japonesa natural en es_ja. Para cada error de es_ja cuya corrected_span contenga kanji, kanji_readings debe incluir sin omisiones los bloques de kanji de esa corrección, aunque no aparezcan literalmente en correct_japanese_sentence. En ja_es, para cada error léxico, de significado, omisión o source_misunderstanding, kanji_readings debe incluir únicamente la palabra, cuantificador o expresión japonesa mínima que causó el error, con su lectura y significado contextual; explanation_es debe mencionar literalmente ese término para vincularlo con el micro-SRS. No propongas nombres o palabras de contexto que el alumno sí entendió. Si el fallo es de cantidad, pluralidad o intensidad, selecciona el marcador responsable, por ejemplo もっと, たくさん o el contador, no el sustantivo general. Incluye términos completos escritos solo en kana cuando sean el elemento malinterpretado, pero no partículas aisladas ni puntuación. kanji_readings incluirá texto exacto, lectura contextual completa en hiragana, significado contextual y motivo breve de la lectura (on/kun, compuesto, okurigana, nombre, kana o excepción). Calcula overall_score después de puntuar cada dimensión: objetivo 30%, comprensión 15%, naturalidad 15%, gramática 15%, vocabulario 10%, ortografía 10% y registro 5%. Usa solo categorías del esquema.`;
}

function scoringGuide() {
  return "Regla de proporcionalidad obligatoria: 0-20 se reserva para respuesta vacía, irrelevante o incomprensible. Un único error localizado de conjugación, partícula, condición o naturalidad no puede poner a cero significado, comprensión, vocabulario u ortografía si la idea se entiende. Ejemplo: 家に帰りて、宿題をします frente a 家に帰ったら、宿題をします conserva idea, orden y vocabulario; puntúa significado 75-90, comprensión al menos 85, gramática 15-35, naturalidad 30-50 y un total aproximado 60-75. Si esa estructura era el objetivo del ejercicio, is_acceptable puede ser false, pero nunca conviertas la respuesta en una puntuación de vacío. Las fortalezas textuales y las notas deben ser coherentes entre sí.";
}
async function callOpenAI(payload, env) {
  const body = {
    model: "gpt-5.4-mini",
    reasoning: { effort: "none" },
    instructions: `${systemPrompt()} ${scoringGuide()} En la respuesta modelo es_ja usa la escritura japonesa habitual con kanji comunes (por ejemplo 今日, 晩ご飯, 作ります), sin convertir artificialmente palabras que se escriben normalmente en kana como うち. No penalices al alumno solo por usar kana correctamente. kanji_readings debe cubrir primero TODAS las palabras con kanji de correct_japanese_sentence, con su lectura contextual completa. Incluye las formas correctas, nunca conjugaciones inventadas por el alumno como 料理ます. Conserva las explicaciones de sus formas erroneas en errors; puedes incluir lecturas adicionales de corrected_span si son correctas. Prefiere palabras completas (晩ご飯: ばんごはん; 作ります: つくります), no fragmentos con una lectura que corresponde al compuesto entero.`,
    input: JSON.stringify(payload),
    max_output_tokens: 2500,
    text: {
      format: {
        type: "json_schema",
        name: "japoteacher_evaluation",
        strict: true,
        schema: evaluationSchema,
      },
    },
  };
  return fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
function contextExplanationPrompt() {
  return "Eres un profesor de japonés para hispanohablantes. Explica un único término dentro de la frase proporcionada. Responde en español, sin listas, de forma breve y pedagógica. meaning_es da el significado preciso en este contexto; reading_hiragana da la lectura contextual si el término es japonés con kanji y usa — si no procede; context_es explica en una frase su papel o matiz aquí; usage_note_es añade una observación de uso de una frase como máximo. Si se trata de una etiqueta de gramática, partícula o contador, explica su función en esa frase en vez de inventar una traducción literal. No evalúes al alumno ni reescribas toda la frase.";
}
async function callContextExplainer(payload, env) {
  return fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      reasoning: { effort: "none" },
      instructions: contextExplanationPrompt(),
      input: JSON.stringify(payload),
      max_output_tokens: 500,
      text: { format: { type: "json_schema", name: "japoteacher_context_explanation", strict: true, schema: contextExplanationSchema } },
    }),
  });
}
function questionHelpPrompt() {
  return "Eres un profesor particular de japonés para hispanohablantes dentro de una práctica. Responde solo a la duda del alumno sobre la frase actual. Usa español claro, concreto y pedagógico. Si hay japonés con kanji, añade lectura en hiragana entre paréntesis cuando ayude. No vuelvas a corregir toda la respuesta ni contradigas la referencia. answer_es debe ser la explicación principal en 2-5 frases; example_ja y example_es dan un ejemplo mínimo si aporta valor, o — si no procede; caution_es añade una advertencia breve sobre una confusión habitual o —.";
}
async function callQuestionHelp(payload, env) {
  return fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      reasoning: { effort: "none" },
      instructions: questionHelpPrompt(),
      input: JSON.stringify(payload),
      max_output_tokens: 750,
      text: { format: { type: "json_schema", name: "japoteacher_question_help", strict: true, schema: questionHelpSchema } },
    }),
  });
}
function tutorPrompt(operation, mode) {
  if (operation === "chat")
    return "Eres un profesor particular de japonés para hispanohablantes. Responde a la pregunta del alumno usando el análisis previo como contexto. Sé didáctico, concreto y suficientemente extenso cuando haya materia lingüística. Si mencionas kanji, añade lectura en hiragana cuando sea útil. No inventes datos que no estén en el texto o análisis; si falta contexto, dilo y ofrece la interpretación más probable.";
  if (mode === "ja_to_es")
    return "Eres un profesor de japonés para hispanohablantes. El alumno te da texto japonés corto o largo. Traduce de forma natural al español y explica por qué está escrito así. Desgrana estructura gramatical, partículas, forma verbal, matices, registro y conectores. Para kanji y vocabulario relevante, da lectura en hiragana, significado contextual y función dentro de la frase. La explicación debe servir para entender el contenido y también la construcción japonesa. Evita respuestas telegráficas.";
  return "Eres un profesor de japonés para hispanohablantes. El alumno escribe en español y quiere saber cómo se diría naturalmente en japonés. Propón una traducción japonesa natural, no literal, y explica de forma extensa las decisiones: orden, tema, partículas, registro, omisiones naturales, vocabulario, posibles alternativas y errores habituales de hispanohablantes. No escribas lecturas entre paréntesis dentro de natural_translation: nada de 日本(にほん). translation_readings debe cubrir los bloques con kanji que aparezcan en natural_translation, con characters exacto, lectura en hiragana, significado contextual y explicación breve. Mantén tono docente y práctico.";
}
async function callTutor(payload, env) {
  const operation = payload.operation === "chat" ? "chat" : "analyze",
    schema = operation === "chat" ? tutorChatSchema : tutorAnalysisSchema,
    maxOutput = operation === "chat" ? 1200 : 3000;
  return fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      reasoning: { effort: "none" },
      instructions: tutorPrompt(operation, payload.mode),
      input: JSON.stringify(payload),
      max_output_tokens: maxOutput,
      text: { format: { type: "json_schema", name: `japoteacher_tutor_${operation}`, strict: true, schema } },
    }),
  });
}
function lensPrompt(operation, mode) {
  if (operation === "chat")
    return "Eres un profesor particular de japonés para hispanohablantes. Responde a la pregunta del alumno usando el análisis de lupa previo como contexto. Sé didáctico y concreto. Si mencionas kanji, añade lectura en hiragana cuando ayude. No inventes texto que no esté en la captura o transcripción; si falta contexto, explica la interpretación más probable.";
  const source = mode === "vision" ? "una captura o imagen, y quizá una transcripción parcial" : "texto pegado por el alumno";
  return `Eres una lupa lingüística de japonés para hispanohablantes. Recibes ${source}. Extrae el texto japonés visible cuando proceda, corrige con prudencia errores menores de OCR y traduce de forma natural al español. overlay_summary_es debe resumir en una o dos frases breves qué comunica el fragmento y cuál es su matiz principal, pensado para leerse en una superposición sin abandonar un manga o una web. Después explica por qué se escribe así: kanji, lecturas, vocabulario, partículas, forma verbal, registro, omisiones y matices pragmáticos. Adapta el análisis al contexto declarado por el alumno. No guardes ni menciones datos sensibles innecesarios. No escribas furigana entre paréntesis dentro de ocr_text: ocr_text debe ser texto japonés limpio; las lecturas van en kanji_vocabulary. reusable_phrase_candidates contiene frases autocontenidas que podrían convertirse en ejercicios tras revisión editorial, o una lista vacía si no hay material claro. jlpt_estimate debe ser N5, N4, N3, N2, N1 o mixto.`;
}
async function callLens(payload, env) {
  const operation = payload.operation === "chat" ? "chat" : "analyze",
    schema = operation === "chat" ? tutorChatSchema : lensAnalysisSchema,
    maxOutput = operation === "chat" ? 1200 : 3200,
    mode = payload.mode === "vision" ? "vision" : "text";
  const content = [{ type: "input_text", text: JSON.stringify({ ...payload, image_data_url: undefined }) }];
  if (operation === "analyze" && mode === "vision" && payload.image_data_url) content.push({ type: "input_image", image_url: payload.image_data_url });
  return fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      reasoning: { effort: "none" },
      instructions: lensPrompt(operation, mode),
      input: [{ role: "user", content }],
      max_output_tokens: maxOutput,
      text: { format: { type: "json_schema", name: `japoteacher_lens_${operation}`, strict: true, schema } },
    }),
  });
}
async function searchBraveNews(payload, env) {
  const query = `${payload.topic} actualidad noticias hoy`,
    params = new URLSearchParams({
      q: query.slice(0, 400),
      country: payload.country || "ES",
      search_lang: payload.search_lang || "es",
      ui_lang: "es-ES",
      freshness: "pd",
      count: "8",
      safesearch: "moderate",
      extra_snippets: "true",
    }),
    response = await fetch(`https://api.search.brave.com/res/v1/news/search?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY,
      },
    });
  const raw = await response.json();
  if (!response.ok) throw new Error(raw?.error?.detail || raw?.error?.message || "Brave Search rechazó la búsqueda.");
  const results = (raw.results || []).slice(0, 8).map(item => ({
    title: String(item.title || "").slice(0, 240),
    url: String(item.url || ""),
    source: String(item.source || item.meta_url?.hostname || "").slice(0, 120),
    age: String(item.age || item.page_age || "").slice(0, 80),
    description: String(item.description || "").slice(0, 600),
    extra_snippets: Array.isArray(item.extra_snippets) ? item.extra_snippets.slice(0, 3).map(text => String(text).slice(0, 500)) : [],
  })).filter(item => item.title && item.url);
  if (!results.length) throw new Error("Brave no devolvió noticias recientes para esa temática.");
  return { query, results };
}
function dailyNewsPrompt() {
  return "Eres profesor de japonés para hispanohablantes. Recibes resultados recientes de Brave News, no el artículo completo. Elige una noticia concreta, fiable y fechada de hoy o de las últimas 24 horas si es posible. No copies texto largo de la fuente: reescribe una noticia breve propia en japonés natural, calibrada al JLPT solicitado y al tramo alto/medio/bajo. N5 usa frases muy cortas y gramática básica; N4 permite conectores sencillos; N3-N1 pueden aumentar subordinación, matiz y vocabulario. No escribas lecturas entre paréntesis dentro de japanese_title, japanese_article, question_ja ni answer_ja: nada de 日本(にほん). Incluye furigana_readings para todos los bloques con kanji visibles en japanese_title, japanese_article, question_ja y answer_ja. discussion_questions debe incluir preguntas en japonés, su traducción española y una respuesta modelo en ambos idiomas. Explica en español el contenido, vocabulario y gramática. Si la fuente parece insuficiente o antigua, indícalo en source_note.";
}
async function callDailyNews(payload, search, env) {
  return fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      reasoning: { effort: "none" },
      instructions: dailyNewsPrompt(),
      input: JSON.stringify({ ...payload, search }),
      max_output_tokens: 2800,
      text: { format: { type: "json_schema", name: "japoteacher_daily_news", strict: true, schema: dailyNewsSchema } },
    }),
  });
}
function dailyNewsAnswerPrompt() {
  return "Eres profesor de japonés para hispanohablantes. Corrige la respuesta del alumno a una pregunta de comprensión sobre una lectura japonesa graduada. Acepta respuestas en español o japonés si demuestran comprensión. Puntúa de 0 a 100, indica si es correcta, explica brevemente qué entendió bien o mal y ofrece una respuesta modelo. No evalúes gramática japonesa salvo que impida entender la respuesta. Devuelve además jlpt_level, difficulty 0-100, topic_tags, grammar_tags y vocabulary_tags que indiquen qué competencias impacta esta pregunta. Usa direction ja_es si la respuesta demuestra comprensión de japonés hacia español; usa es_ja solo si la pregunta exige producir japonés. lexical_failures debe contener palabras o kanji concretos que el alumno haya entendido mal u omitido; déjalo vacío si no hay fallo léxico claro.";
}
async function callDailyNewsAnswer(payload, env) {
  return fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      reasoning: { effort: "none" },
      instructions: dailyNewsAnswerPrompt(),
      input: JSON.stringify(payload),
      max_output_tokens: 900,
      text: { format: { type: "json_schema", name: "japoteacher_daily_news_answer", strict: true, schema: dailyNewsAnswerSchema } },
    }),
  });
}
function outputText(raw) {
  return [raw.output_text || "", ...(raw.output || []).flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text || "")].sort((left, right) => right.length - left.length)[0];
}

async function secretMatches(provided, expected) {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder(),
    [left, right] = await Promise.all([
      crypto.subtle.digest("SHA-256", encoder.encode(provided)),
      crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    ]);
  const a = new Uint8Array(left),
    b = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

function editorialInstructions(operation) {
  const common = `Actúas como comité editorial bilingüe de japonés para hispanohablantes. El contenido debe ser natural, autosuficiente y realista. El nivel recibido identifica la banda de frecuencia de los componentes objetivo, no un techo artificial para toda la frase: el japonés real puede mezclar vocabulario, kanji y estructuras de bandas distintas. No rechaces ni simplifiques una frase correcta solo porque incorpora un componente menos frecuente; el publicador la clasificará después según el ranking real de todos sus componentes. Prohibido generar por sustitución mecánica de lugares, personas u objetos. Cada escena debe ser plausible sin contexto oculto; japonés y español deben coincidir en sujeto recuperable, acción, tiempo, lugar, polaridad, modalidad, registro e intención. Toda causa, condición, contraste, finalidad y secuencia debe ser lógicamente válida por sí misma. La referencia española usa el equivalente directo, estándar y no marcado y no añade información inferida. Las alternativas tampoco pueden añadir tiempo, lugar, sujeto ni matices ausentes. Los tags solo incluyen elementos realmente presentes y practicados. topic_primary debe estar evidenciado por el contenido. kanji_readings cubre cada carácter kanji visible, incluidos verbos flexionados, numerales y palabras básicas; characters reproduce el bloque exacto de la frase. Sigue exactamente los slots de cobertura y conserva el número slot. Si el slot incluye target_vocabulary, target_kanji o target_grammar, esos objetivos son obligatorios y deben aparecer de forma natural con el sentido descrito. Para ES→JP, el español debe obligar a producir esos elementos japoneses. No insertes espacios entre palabras japonesas y termina con puntuación japonesa. Una frase con です o ます tiene registro cortés, no neutro.`;
  return operation === "review"
    ? `${common} Revisa adversarialmente todos los pares recibidos y devuelve exactamente uno por cada entrada, conservando su index y slot. Compara japanese con spanish y con cada accepted_alternatives_es, y spanish con cada accepted_alternatives_ja. Comprueba hablante o sujeto recuperable, singular/plural, persona, acción, objeto, tiempo, aspecto, momento, lugar, dirección, cantidad, polaridad, capacidad, obligación, permiso, deseo, condición, causa, consecuencia, registro e intención. Elimina cualquier alternativa que omita o añada una unidad crítica. Busca además situaciones absurdas, colocaciones impropias, traducciones literales, ambigüedad, dificultad mal nivelada, tags inflados, lecturas incorrectas y duplicación estructural. Si el payload contiene mandatory_local_fixes, corrected debe resolver literalmente todos esos diagnósticos sin excepción. issues describe los defectos encontrados en la entrada recibida, pero approved evalúa exclusivamente corrected: debe ser true cuando tu versión corrected ya ha resuelto todos los defectos y está lista para publicar. Usa false solo si ni siquiera corrected queda publicable y necesitaría otra revisión.`
    : `${common} Redacta exactamente tantos pares independientes como slots hayas recibido: uno y solo uno por slot. Primero imagina la microescena y después escribe la frase; no reutilices el mismo esqueleto sintáctico dentro del lote. Respeta los límites y objetivos de cada slot. Si previous_rejection contiene una frase japonesa previa, está prohibido repetirla, variar solo su puntuación o reciclar la misma escena: cambia sujeto, acción u objeto manteniendo el foco curricular del slot.`;
}

function kanjiRepairInstructions() {
  return `Eres lexicógrafo japonés. Para cada frase recibida, devuelve exactamente una entrada con el mismo slot y una cobertura exhaustiva de kanji_readings. Cada carácter kanji visible debe aparecer dentro de characters al menos una vez, incluidos verbos flexionados, números, nombres y kanji elementales. characters reproduce el bloque exacto tal como aparece en japanese, con su okurigana cuando corresponda. reading_hiragana contiene la lectura contextual completa del bloque; meaning_es su significado en esa frase; explanation_es explica brevemente por qué se lee así en contexto. No cambies la frase ni omitas kanji por considerarlos fáciles.`;
}

function equivalenceCheckInstructions() {
  return `Eres un revisor bilingüe final. Compara japanese con spanish y con cada alternativa española, y spanish con cada alternativa japonesa. Comprueba sujeto recuperable, persona, número, acción, objeto, tiempo, aspecto, momento, lugar, dirección, cantidad, polaridad, modalidad, registro, intención, condición, causa y consecuencia. Elimina alternativas que añadan u omitan cualquier unidad crítica. Corrige equivalentes imprecisos y relaciones ilógicas. Devuelve el mismo slot. japanese y spanish contienen la mejor pareja final; las listas solo conservan alternativas plenamente equivalentes. issues describe la entrada recibida. approved evalúa la salida corregida y debe ser true si ya es publicable.`;
}

function difficultyReviewInstructions() {
  return "Actuas como responsable de nivelacion curricular de una academia de japones para hispanohablantes. Puntua la dificultad real de cada ejercicio entre 0 y 100 exclusivamente DENTRO de su mismo nivel JLPT y direccion de traduccion: 0 es la entrada mas accesible del nivel, 50 es practica tipica de consolidacion y 100 es el limite superior aun apropiado para ese nivel. Nunca compares N5 con N4. En ja_es mide sobre todo la carga de comprension; en es_ja, la carga de recuperacion y produccion. Usa longitud, vocabulario, kanji, combinacion de gramatica, ambiguedad y exigencia de la traduccion; no penalices una frase por ser natural. baseline es una ordenacion automatica previa del mismo grupo: corrigela solo cuando la evidencia linguistica lo justifique. Usa el rango con precision, evita acumular notas en 50 o multiples de diez y devuelve exactamente una salida por exercise_id. rationale debe ser una frase breve y concreta en espanol.";
}

async function callEditorialOpenAI(operation, payload, env) {
  const schema = operation === "difficulty_review"
    ? difficultyReviewSchema
    : operation === "review"
    ? editorialReviewSchema
    : operation === "repair_kanji"
      ? kanjiRepairSchema
      : operation === "equivalence_check"
        ? equivalenceCheckSchema
      : editorialGenerationSchema;
  const body = {
    model: "gpt-5.4-mini",
    // Editorial translation needs reasoning; interactive grading is separate.
    reasoning: { effort: "low" },
    instructions: operation === "difficulty_review" ? difficultyReviewInstructions() : operation === "repair_kanji" ? kanjiRepairInstructions() : operation === "equivalence_check" ? equivalenceCheckInstructions() : editorialInstructions(operation),
    input: JSON.stringify(payload),
    max_output_tokens: Math.min(12000, 4000 * Math.max(1, (payload.items || payload.slots || []).length)),
    text: {
      format: {
        type: "json_schema",
        name: `japoteacher_editorial_${operation}`,
        strict: true,
        schema,
      },
    },
  };
  return fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function editorial(request, env) {
  if (Number(request.headers.get("Content-Length") || 0) > 250000)
    return json({ error: "Payload demasiado grande." }, 413);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  const operation = payload?.operation;
  const providedKey = request.headers.get("X-Editorial-Key") || "";
  const acceptedKeys = [
    operation === "difficulty_review" ? env.DIFFICULTY_REVIEW_KEY : "",
    env.EDITORIAL_API_KEY,
    env.PROXY_TOKEN,
  ].filter(Boolean);
  const authorized = (await Promise.all(acceptedKeys.map(key => secretMatches(providedKey, String(key).trim())))).some(Boolean);
  if (!authorized)
    return json({ error: "Unauthorized" }, 401);
  if (!["generate", "review", "equivalence_check", "repair_kanji", "difficulty_review"].includes(operation))
    return json({ error: "Operación editorial inválida." }, 400);
  try {
    const response = await callEditorialOpenAI(operation, payload, env),
      raw = await response.json();
    if (!response.ok)
      return json(
        { error: raw?.error?.message || "OpenAI rechazó la solicitud." },
        response.status,
      );
    let outputText = raw.output_text;
    if (!outputText)
      outputText = (raw.output || [])
        .flatMap((item) => item.content || [])
        .find((item) => item.type === "output_text")?.text;
    if (!outputText)
      return json({ error: "OpenAI no devolvió contenido editorial." }, 502);
    let result;
    try { result = JSON.parse(outputText); }
    catch { return json({ error: "Respuesta editorial incompleta o JSON truncado.", usage: raw.usage, model: raw.model, response_id: raw.id }, 502); }
    return json({
      result,
      usage: raw.usage,
      model: raw.model,
      response_id: raw.id,
    });
  } catch (error) {
    return json({ error: error.message || "Error editorial interno." }, 500);
  }
}

async function authenticated(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  const deviceId = request.headers.get("X-Device-ID") || "";
  if (
    !authorization.startsWith("Bearer ") ||
    authorization.length > 4096 ||
    !deviceId ||
    deviceId.length > 100
  )
    return false;
  const headers = {
    Authorization: authorization,
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
  };
  for (const delay of [0, 250, 700]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    try {
      const response = await fetch(
        `${env.SUPABASE_URL}/rest/v1/rpc/heartbeat_user_session`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ p_device_id: deviceId }),
          signal: AbortSignal.timeout(8000),
        },
      );
      if (response.ok) {
        if ((await response.json()) === true) return true;
        const claimResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/claim_user_session`, {
          method: "POST",
          headers,
          body: JSON.stringify({ p_device_id: deviceId, p_device_name: "Dispositivo actual", p_force: false }),
          signal: AbortSignal.timeout(8000),
        });
        if (!claimResponse.ok) continue;
        return Boolean((await claimResponse.json())?.[0]?.claimed);
      }
      if (response.status === 401 || response.status === 403) return false;
    } catch {
      // A short mobile network interruption is retried before deciding anything.
    }
  }
  // The device lease is a consistency guard, not an authentication boundary.
  // If its endpoint is temporarily unavailable, accept only a JWT Supabase can validate.
  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function authenticatedUser(request, env) {
  if (!(await authenticated(request, env))) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: request.headers.get("Authorization") || "", apikey: env.SUPABASE_PUBLISHABLE_KEY } });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id || null;
}

async function saveIssueReport(env, userId, accessToken, report) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/user_issue_reports?on_conflict=report_id`, {
    method: "POST",
    headers: { Authorization: accessToken, apikey: env.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ ...report, user_id: userId }),
  });
  if (!response.ok) throw new Error(`Supabase issues: ${await response.text()}`);
  return (await response.json())[0];
}

async function editorialKeyAuthorized(request, env) {
  const providedKey = request.headers.get("X-Editorial-Key") || "";
  const acceptedKeys = [env.EDITORIAL_API_KEY, env.PROXY_TOKEN].filter(Boolean);
  return (await Promise.all(acceptedKeys.map((key) => secretMatches(providedKey, String(key).trim())))).some(Boolean);
}

async function issueInbox(request, env) {
  if (!(await editorialKeyAuthorized(request, env))) return json({ error: "Unauthorized" }, 401);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, 503);
  const limit = Math.max(1, Math.min(100, Number(new URL(request.url).searchParams.get("limit")) || 50));
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/user_issue_reports?select=*&order=created_at.desc&limit=${limit}`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY },
  });
  if (!response.ok) return json({ error: `Supabase issues: ${await response.text()}` }, 502);
  return json({ reports: await response.json() });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url),
      origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      const allow = cors(origin, env);
      return new Response(null, {
        status: 204,
        headers: {
          ...(allow ? { "Access-Control-Allow-Origin": allow } : {}),
          "Access-Control-Allow-Headers":
            "Authorization, Content-Type, X-Device-ID",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        },
      });
    }
    if (url.pathname === "/health")
      return json({ ok: true, model: "gpt-5.4-mini" }, 200, origin, env);
    if (url.pathname === "/editorial/generate" && request.method === "POST")
      return editorial(request, env);
    if (url.pathname === "/editorial/issues" && request.method === "GET")
      return issueInbox(request, env);
    if (url.pathname === "/explain" && request.method === "POST") {
      if (!env.OPENAI_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ error: "El Worker no está configurado." }, 503, origin, env);
      if (!cors(origin, env)) return json({ error: "Origen no permitido." }, 403, origin, env);
      if (!(await authenticated(request, env))) return json({ error: "Inicia sesión en el dispositivo activo para usar la explicación con IA." }, 409, origin, env);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Solicitud de explicación inválida." }, 400, origin, env); }
      const term = String(body?.term || "").trim(), type = String(body?.type || "").trim(), japanese = String(body?.japanese_sentence || "").trim(), spanish = String(body?.spanish_sentence || "").trim(), level = String(body?.jlpt_level || "").trim();
      if (!term || term.length > 120 || type.length > 40 || japanese.length > 800 || spanish.length > 800 || level.length > 8) return json({ error: "La consulta de explicación no es válida." }, 400, origin, env);
      try {
        const response = await callContextExplainer({ term, type, japanese_sentence: japanese, spanish_sentence: spanish, jlpt_level: level }, env), raw = await response.json();
        if (!response.ok) return json({ error: raw?.error?.message || "OpenAI rechazó la explicación." }, response.status, origin, env);
        const text = outputText(raw);
        if (!text) return json({ error: "OpenAI no devolvió una explicación." }, 502, origin, env);
        return json({ explanation: JSON.parse(text), usage: raw.usage || {} }, 200, origin, env);
      } catch (error) { return json({ error: error.message || "No se pudo explicar el término." }, 500, origin, env); }
    }
    if (url.pathname === "/daily-lesson" && request.method === "POST") {
      if (!env.OPENAI_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ error: "El Worker no está configurado." }, 503, origin, env);
      if (!cors(origin, env)) return json({ error: "Origen no permitido." }, 403, origin, env);
      if (!(await authenticated(request, env))) return json({ error: "Inicia sesión en el dispositivo activo para generar la lección." }, 409, origin, env);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Solicitud inválida." }, 400, origin, env); }
      if (!validLessonInput(body)) return json({ error: "El vocabulario de la lección no es válido." }, 400, origin, env);
      try { return json({ lesson: await generateLesson({terms:body.terms,contexts:body.contexts,previous_lesson:body.previous_lesson},env) }, 200, origin, env); }
      catch (error) { return json({ error: error.message || "No se pudo generar la lección." }, 502, origin, env); }
    }
    if (url.pathname === "/question-help" && request.method === "POST") {
      if (!env.OPENAI_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ error: "El Worker no está configurado." }, 503, origin, env);
      if (!cors(origin, env)) return json({ error: "Origen no permitido." }, 403, origin, env);
      if (!(await authenticated(request, env))) return json({ error: "Inicia sesión en el dispositivo activo para preguntar con IA." }, 409, origin, env);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Solicitud de pregunta inválida." }, 400, origin, env); }
      const question = String(body?.question || "").trim(), userAnswer = String(body?.user_answer || "").trim(), exercise = body?.exercise || {};
      const japanese = String(exercise?.japanese_sentence || "").trim(), spanish = String(exercise?.spanish_sentence || "").trim(), level = String(exercise?.jlpt_level || "").trim(), direction = String(exercise?.direction || "").trim();
      if (!question || question.length > 500 || userAnswer.length > 700 || japanese.length > 900 || spanish.length > 900 || level.length > 8 || direction.length > 12) return json({ error: "La pregunta no es válida." }, 400, origin, env);
      try {
        const response = await callQuestionHelp({ question, user_answer: userAnswer, exercise: { japanese_sentence: japanese, spanish_sentence: spanish, jlpt_level: level, direction, difficulty: exercise?.difficulty, topic_tags: exercise?.topic_tags || [], grammar_tags: exercise?.grammar_tags || [], vocabulary_tags: exercise?.vocabulary_tags || [] } }, env), raw = await response.json();
        if (!response.ok) return json({ error: raw?.error?.message || "OpenAI rechazó la pregunta." }, response.status, origin, env);
        const text = outputText(raw);
        if (!text) return json({ error: "OpenAI no devolvió respuesta." }, 502, origin, env);
        return json({ help: JSON.parse(text), usage: raw.usage || {} }, 200, origin, env);
      } catch (error) { return json({ error: error.message || "No se pudo responder la pregunta." }, 500, origin, env); }
    }
    if (url.pathname === "/tutor" && request.method === "POST") {
      if (!env.OPENAI_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ error: "El Worker no está configurado." }, 503, origin, env);
      if (!cors(origin, env)) return json({ error: "Origen no permitido." }, 403, origin, env);
      if (!(await authenticated(request, env))) return json({ error: "Inicia sesión en el dispositivo activo para usar el Tutor IA." }, 409, origin, env);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Solicitud de tutor inválida." }, 400, origin, env); }
      const operation = body?.operation === "chat" ? "chat" : "analyze",
        mode = body?.mode === "ja_to_es" ? "ja_to_es" : "es_to_ja",
        text = String(body?.text || "").trim(),
        question = String(body?.question || "").trim(),
        messages = Array.isArray(body?.messages) ? body.messages.slice(-8).map(item => ({ role: String(item?.role || "").slice(0, 20), content: String(item?.content || "").slice(0, 1200) })) : [],
        analysis = body?.analysis && typeof body.analysis === "object" ? body.analysis : null;
      if (!text || text.length > 4000 || (operation === "chat" && (!question || question.length > 900))) return json({ error: "La consulta del tutor no es válida." }, 400, origin, env);
      try {
        const payload = operation === "chat" ? { operation, mode, text, question, analysis, messages } : { operation, mode, text },
          response = await callTutor(payload, env),
          raw = await response.json();
        if (!response.ok) return json({ error: raw?.error?.message || "OpenAI rechazó la consulta del tutor." }, response.status, origin, env);
        const output = outputText(raw);
        if (!output) return json({ error: "OpenAI no devolvió respuesta del tutor." }, 502, origin, env);
        return json({ [operation === "chat" ? "answer" : "analysis"]: JSON.parse(output), usage: raw.usage || {}, model: raw.model, response_id: raw.id }, 200, origin, env);
      } catch (error) { return json({ error: error.message || "No se pudo usar el Tutor IA." }, 500, origin, env); }
    }
    if (url.pathname === "/lens" && request.method === "POST") {
      if (!env.OPENAI_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ error: "El Worker no está configurado." }, 503, origin, env);
      if (!cors(origin, env)) return json({ error: "Origen no permitido." }, 403, origin, env);
      if (!(await authenticated(request, env))) return json({ error: "Inicia sesión en el dispositivo activo para usar la Lupa IA." }, 409, origin, env);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Solicitud de lupa inválida." }, 400, origin, env); }
      const operation = body?.operation === "chat" ? "chat" : "analyze",
        mode = body?.mode === "vision" ? "vision" : "text",
        text = String(body?.text || "").trim(),
        question = String(body?.question || "").trim(),
        context = String(body?.context || "").trim().slice(0, 80),
        contextDetail = String(body?.context_detail || "").trim().slice(0, 180),
        imageDataUrl = String(body?.image_data_url || "");
      if (operation === "analyze") {
        if (text.length > 5000 || context.length > 80 || contextDetail.length > 180) return json({ error: "La entrada de la lupa es demasiado larga." }, 400, origin, env);
        if (mode === "text" && !text) return json({ error: "Pega texto para usar el modo solo texto." }, 400, origin, env);
        if (mode === "vision" && !text && !/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(imageDataUrl)) return json({ error: "Añade una imagen válida o una transcripción." }, 400, origin, env);
        if (imageDataUrl.length > 2800000) return json({ error: "La imagen es demasiado grande; prueba con una captura más recortada." }, 413, origin, env);
      }
      if (operation === "chat" && (!question || question.length > 900)) return json({ error: "La pregunta de seguimiento no es válida." }, 400, origin, env);
      try {
        const payload = operation === "chat" ? { operation, mode, question, analysis: body?.analysis || null, messages: Array.isArray(body?.messages) ? body.messages.slice(-8) : [] } : { operation, mode, context, context_detail: contextDetail, text, image_data_url: imageDataUrl },
          response = await callLens(payload, env),
          raw = await response.json();
        if (!response.ok) return json({ error: raw?.error?.message || "OpenAI rechazó la consulta de lupa." }, response.status, origin, env);
        const output = outputText(raw);
        if (!output) return json({ error: "OpenAI no devolvió respuesta de lupa." }, 502, origin, env);
        return json({ [operation === "chat" ? "answer" : "analysis"]: JSON.parse(output), usage: raw.usage || {}, model: raw.model, response_id: raw.id }, 200, origin, env);
      } catch (error) { return json({ error: error.message || "No se pudo usar la Lupa IA." }, 500, origin, env); }
    }
    if (url.pathname === "/daily-news" && request.method === "POST") {
      if (!env.OPENAI_API_KEY || !env.BRAVE_SEARCH_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ error: "Falta configurar BRAVE_SEARCH_API_KEY u otro secreto del Worker." }, 503, origin, env);
      if (!cors(origin, env)) return json({ error: "Origen no permitido." }, 403, origin, env);
      if (!(await authenticated(request, env))) return json({ error: "Inicia sesión para generar la noticia del día." }, 409, origin, env);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Solicitud de noticia inválida." }, 400, origin, env); }
      const topic = String(body?.topic || "").trim().slice(0, 120),
        jlpt = ["N5", "N4", "N3", "N2", "N1"].includes(body?.jlpt) ? body.jlpt : "N5",
        band = ["bajo", "medio", "alto"].includes(body?.band) ? body.band : "medio";
      if (!topic) return json({ error: "Selecciona una temática." }, 400, origin, env);
      try {
        const payload = { topic, jlpt, band, country: "ES", search_lang: "es" },
          search = await searchBraveNews(payload, env),
          response = await callDailyNews(payload, search, env),
          raw = await response.json();
        if (!response.ok) return json({ error: raw?.error?.message || "OpenAI rechazó la adaptación de la noticia." }, response.status, origin, env);
        const output = outputText(raw);
        if (!output) return json({ error: "OpenAI no devolvió noticia adaptada." }, 502, origin, env);
        return json({ news: JSON.parse(output), search_query: search.query, usage: raw.usage || {}, model: raw.model, response_id: raw.id }, 200, origin, env);
      } catch (error) { return json({ error: error.message || "No se pudo generar la noticia del día." }, 500, origin, env); }
    }
    if (url.pathname === "/daily-news-answer" && request.method === "POST") {
      if (!env.OPENAI_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ error: "El Worker no está configurado." }, 503, origin, env);
      if (!cors(origin, env)) return json({ error: "Origen no permitido." }, 403, origin, env);
      if (!(await authenticated(request, env))) return json({ error: "Inicia sesión para corregir la respuesta." }, 409, origin, env);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Solicitud de corrección inválida." }, 400, origin, env); }
      const studentAnswer = String(body?.student_answer || "").trim(),
        question = body?.question && typeof body.question === "object" ? body.question : null,
        article = String(body?.article || "").slice(0, 3000),
        title = String(body?.title || "").slice(0, 300);
      if (!studentAnswer || studentAnswer.length > 1000 || !question) return json({ error: "La respuesta o pregunta no es válida." }, 400, origin, env);
      try {
        const response = await callDailyNewsAnswer({ title, article, question, student_answer: studentAnswer }, env),
          raw = await response.json();
        if (!response.ok) return json({ error: raw?.error?.message || "OpenAI rechazó la corrección." }, response.status, origin, env);
        const output = outputText(raw);
        if (!output) return json({ error: "OpenAI no devolvió corrección." }, 502, origin, env);
        return json({ correction: JSON.parse(output), usage: raw.usage || {}, model: raw.model, response_id: raw.id }, 200, origin, env);
      } catch (error) { return json({ error: error.message || "No se pudo corregir la respuesta." }, 500, origin, env); }
    }
    if (url.pathname.startsWith("/reports/")) {
      if (!cors(origin, env)) return json({ error: "Origen no permitido." }, 403, origin, env);
      const userId = await authenticatedUser(request, env);
      if (!userId) return json({ error: "Sesion no valida o activa en otro dispositivo." }, 409, origin, env);
      const accessToken = request.headers.get("Authorization");
      try {
        if (url.pathname === "/reports/list" && request.method === "POST") {
          const reports = await reportsForUser(env, userId, accessToken);
          return json({ reports: reports.map(localReport) }, 200, origin, env);
        }
        if (url.pathname === "/reports/generate" && request.method === "POST") {
          const body = await request.json(), type = body?.report_type === "monthly" ? "monthly" : "weekly", now = new Date(), period = body?.ad_hoc ? (() => { const start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); now.setHours(23, 59, 59, 999); return { start: start.toISOString(), end: now.toISOString() }; })() : reportPeriod(type);
          const report = await generateReport(env, userId, await userPayload(env, userId, accessToken), type, period, accessToken, Boolean(body?.force));
          return json({ report: localReport(report) }, 200, origin, env);
        }
        if (url.pathname === "/reports/delete" && request.method === "POST") {
          const body = await request.json(), reportId = String(body?.report_id || "");
          if (!/^[0-9a-f-]{36}$/i.test(reportId)) return json({ error: "Informe no valido." }, 400, origin, env);
          const deleted = await deleteReport(env, userId, reportId, accessToken);
          if (!deleted) return json({ error: "Informe no encontrado." }, 404, origin, env);
          return json({ deleted_report_id: deleted.report_id }, 200, origin, env);
        }
      } catch (error) { return json({ error: error.message || "No se pudo generar el informe." }, 500, origin, env); }
      return json({ error: "Not found" }, 404, origin, env);
    }
    if (url.pathname === "/issue-reports" && request.method === "POST") {
      if (!cors(origin, env)) return json({ error: "Origen no permitido." }, 403, origin, env);
      const userId = await authenticatedUser(request, env);
      if (!userId) return json({ error: "Inicia sesión en el dispositivo activo para enviar incidencias." }, 409, origin, env);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Solicitud de incidencia inválida." }, 400, origin, env); }
      const reportId = String(body?.report_id || ""), comment = String(body?.comment || "").trim(), page = String(body?.page || "hoy").trim(), appVersion = String(body?.app_version || "").trim(), attachments = Array.isArray(body?.attachments) ? body.attachments : [];
      if (!/^[0-9a-f-]{36}$/i.test(reportId) || !comment || comment.length > 2000 || page.length > 40 || appVersion.length > 40 || attachments.length > 5) return json({ error: "Los datos de la incidencia no son válidos." }, 400, origin, env);
      const safeAttachments = [];
      for (const item of attachments) {
        const path = String(item?.path || ""), name = String(item?.name || ""), contentType = String(item?.content_type || "");
        if (!path.startsWith(`${userId}/${reportId}/`) || path.length > 500 || name.length > 160 || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) return json({ error: "Uno de los pantallazos no es válido." }, 400, origin, env);
        safeAttachments.push({ path, name, content_type: contentType });
      }
      try {
        const report = await saveIssueReport(env, userId, request.headers.get("Authorization") || "", { report_id: reportId, comment, page, app_version: appVersion || null, attachments: safeAttachments });
        return json({ report_id: report.report_id, created_at: report.created_at }, 201, origin, env);
      } catch (error) { return json({ error: error.message || "No se pudo guardar la incidencia." }, 500, origin, env); }
    }
    if (url.pathname !== "/evaluate" || request.method !== "POST")
      return json({ error: "Not found" }, 404, origin, env);
    if (
      !env.OPENAI_API_KEY ||
      !env.SUPABASE_URL ||
      !env.SUPABASE_PUBLISHABLE_KEY
    )
      return json(
        { error: "El Worker no está configurado." },
        503,
        origin,
        env,
      );
    if (!cors(origin, env))
      return json({ error: "Origen no permitido." }, 403, origin, env);
    if (!(await authenticated(request, env)))
      return json(
        { error: "Esta cuenta está activa en otro dispositivo." },
        409,
        origin,
        env,
      );
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "JSON de entrada inválido." }, 400, origin, env);
    }
    if (
      !payload?.exercise?.exercise_id ||
      !payload?.attempt ||
      typeof payload.attempt.user_answer !== "string"
    )
      return json({ error: "Payload incompleto." }, 400, origin, env);
    try {
      let response = await callOpenAI(payload, env, true);
      let raw = await response.json();
      if (
        !response.ok &&
        (raw?.error?.param === "temperature" ||
          /temperature/i.test(raw?.error?.message || ""))
      ) {
        response = await callOpenAI(payload, env, false);
        raw = await response.json();
      }
      if (!response.ok)
        return json(
          {
            error: {
              message: raw?.error?.message || "OpenAI rechazó la solicitud.",
              type: raw?.error?.type,
            },
          },
          response.status,
          origin,
          env,
        );
      let outputText = raw.output_text;
      if (!outputText)
        outputText = (raw.output || [])
          .flatMap((item) => item.content || [])
          .find((item) => item.type === "output_text")?.text;
      if (!outputText)
        return json(
          { error: "OpenAI no devolvió contenido evaluable." },
          502,
          origin,
          env,
        );
      const evaluation = normalizeEvaluation(JSON.parse(outputText), payload);
      return json(
        { evaluation, usage: raw.usage, model: raw.model, response_id: raw.id },
        200,
        origin,
        env,
      );
    } catch (error) {
      return json(
        { error: error.message || "Error interno del Worker." },
        500,
        origin,
        env,
      );
    }
  },
  async scheduled(event, env, ctx) {
    const run = async () => {
      if (!env.OPENAI_API_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return;
      const now = new Date(event.scheduledTime || Date.now()), types = [];
      if (now.getUTCDay() === 1) types.push(["weekly", true]);
      if (now.getUTCDate() === 1) types.push(["monthly", true]);
      if (!types.length) return;
      const users = await allUserStates(env);
      await Promise.allSettled(users.flatMap(user => types.map(([type, closed]) => generateReport(env, user.user_id, user.payload, type, reportPeriod(type, now, closed)))));
    };
    ctx.waitUntil(run());
  },
};
