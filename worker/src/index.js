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
      minItems: 5,
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
      minItems: 5,
      maxItems: 5,
      items: editorialReviewItemSchema,
    },
  },
};

const jlptItemProperties = {
  item_id: { type: "string" },
  jlpt_level: { type: "string", enum: ["N5", "N4"] },
  layer: {
    type: "string",
    enum: ["language_knowledge", "grammar", "reading", "listening"],
  },
  item_type: {
    type: "string",
    enum: [
      "kanji_reading", "orthography", "context_expression", "paraphrase",
      "vocabulary_usage", "grammar_form", "sentence_composition", "text_grammar",
      "reading_short", "reading_medium", "information_retrieval", "listening_task",
      "listening_key_points", "listening_verbal_expression", "listening_quick_response",
    ],
  },
  stimulus_text_ja: { type: "string" },
  audio_script_ja: { type: "string" },
  audio_asset: { type: "string" },
  visual_context: { type: "string" },
  question_es: { type: "string" },
  options: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
  correct_option: { type: "integer", minimum: 0, maximum: 3 },
  explanation_es: { type: "string" },
  topic_tags: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
  grammar_tags: stringList,
  vocabulary_tags: stringList,
  kanji_readings: { type: "array", items: editorialKanjiSchema },
  active: { type: "boolean" },
  dataset_version: { type: "string" },
  editorial_rationale: { type: "string" },
  distractor_rationales: stringList,
};
const jlptItemSchema = {
  type: "object",
  additionalProperties: false,
  required: Object.keys(jlptItemProperties),
  properties: jlptItemProperties,
};
const jlptItemGenerationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: { type: "array", minItems: 5, maxItems: 5, items: jlptItemSchema },
  },
};
const jlptItemReviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "approved", "issues", "corrected"],
        properties: {
          index: { type: "integer", minimum: 0, maximum: 4 },
          approved: { type: "boolean" },
          issues: stringList,
          corrected: jlptItemSchema,
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
  return `Eres profesor de japonés para hispanohablantes. Evalúa la traducción admitiendo alternativas válidas y distingue significado, comprensión, naturalidad, gramática, vocabulario, ortografía y registro. Explica en español de forma breve y precisa; no inventes errores. correct_japanese_sentence será la fuente japonesa en ja_es y una propuesta japonesa natural en es_ja. kanji_readings incluirá, sin omisiones, cada palabra o bloque con kanji de esa frase: texto exacto, lectura contextual completa en hiragana, significado contextual y motivo breve de la lectura (on/kun, compuesto, okurigana, nombre o excepción). Excluye kana aislada y puntuación. overall_score pondera: objetivo 30%, comprensión 15%, naturalidad 15%, gramática 15%, vocabulario 10%, ortografía 10% y registro 5%. Usa solo categorías del esquema.`;
}

async function callOpenAI(payload, env) {
  const body = {
    model: "gpt-5.4-mini",
    reasoning: { effort: "none" },
    instructions: systemPrompt(),
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
  const common = `Actúas como comité editorial bilingüe de japonés para hispanohablantes. El contenido debe ser natural, autosuficiente, realista y adecuado al nivel JLPT indicado. El JLPT no tiene listas oficiales cerradas: juzga por competencia, muestras oficiales y uso básico real. Prohibido generar por sustitución mecánica de lugares, personas u objetos. Cada escena debe ser plausible sin contexto oculto; japonés y español deben coincidir en sujeto recuperable, acción, tiempo, lugar, polaridad, modalidad, registro e intención. Los tags solo incluyen elementos realmente practicados. Cada bloque con kanji requiere lectura contextual completa y explicación. N5 usa expresiones típicas, kana y kanji básicos en vida diaria o aula; N4 usa japonés básico sobre estudio, vida diaria y trabajo, con razones, secuencias y relaciones sencillas. Sigue exactamente los slots de cobertura recibidos.`;
  return operation === "review"
    ? `${common} Revisa adversarialmente cinco pares ya creados. Busca situaciones absurdas, colocaciones impropias, traducciones literales, ambigüedad, dificultad mal nivelada, tags inflados, lecturas incorrectas y duplicación estructural. approved solo puede ser true si no queda ningún defecto. corrected siempre contiene la mejor versión final, aun cuando approved sea true.`
    : `${common} Redacta exactamente cinco pares independientes. Primero imagina la microescena y después escribe la frase; no reutilices el mismo esqueleto sintáctico dentro del lote. Respeta los límites y objetivos de cada slot.`;
}

function jlptItemInstructions(operation) {
  const common = `Eres un comité examinador y editorial de japonés para hispanohablantes. Crea ítems pedagógicos alineados con los tipos oficiales del JLPT, sin afirmar que existe una lista oficial cerrada de vocabulario o gramática. Cada ítem debe medir una sola habilidad principal, tener una única mejor respuesta y ser resoluble sin contexto oculto. Los distractores deben ser plausibles para el nivel y representar errores reales, nunca opciones absurdas. Las situaciones, avisos, diálogos y textos deben ser naturales en Japón. Respeta exactamente nivel, tipo, capa, tema y longitud del slot. En lectura cuenta caracteres japoneses visibles. En escucha, audio_script_ja contiene el guion y stimulus_text_ja queda vacío para no revelar la respuesta. En information_retrieval, visual_context describe completamente el aviso, tabla u horario que se renderizará. Incluye las lecturas contextuales de todos los bloques con kanji. distractor_rationales explica una por una por qué cada opción incorrecta es tentadora pero falsa. active siempre es false hasta superar validación local.`;
  return operation === "review_items"
    ? `${common} Revisa adversarialmente cinco ítems. Comprueba dificultad, naturalidad, unicidad de respuesta, fidelidad del tipo JLPT, longitud, tags, kanji, calidad de distractores y ausencia de pistas involuntarias. approved solo es true cuando no queda ningún defecto; corrected siempre devuelve la versión final completa.`
    : `${common} Genera exactamente cinco ítems independientes siguiendo los cinco slots recibidos. No reutilices escena, respuesta, texto ni patrón de distractores dentro del lote.`;
}

async function callEditorialOpenAI(operation, payload, env) {
  const itemOperation = operation === "generate_items" || operation === "review_items";
  const schema = operation === "review"
    ? editorialReviewSchema
    : operation === "generate_items"
      ? jlptItemGenerationSchema
      : operation === "review_items"
        ? jlptItemReviewSchema
        : editorialGenerationSchema;
  const body = {
    model: "gpt-5.4-mini",
    reasoning: { effort: "low" },
    instructions: itemOperation ? jlptItemInstructions(operation) : editorialInstructions(operation),
    input: JSON.stringify(payload),
    max_output_tokens: 12000,
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
  if (
    !env.EDITORIAL_API_KEY ||
    !(await secretMatches(
      request.headers.get("X-Editorial-Key") || "",
      env.EDITORIAL_API_KEY,
    ))
  )
    return json({ error: "Unauthorized" }, 401);
  if (Number(request.headers.get("Content-Length") || 0) > 250000)
    return json({ error: "Payload demasiado grande." }, 413);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  const operation = payload?.operation;
  if (!["generate", "review", "generate_items", "review_items"].includes(operation))
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
    return json({
      result: JSON.parse(outputText),
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
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/rpc/heartbeat_user_session`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          apikey: env.SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_device_id: deviceId }),
        signal: AbortSignal.timeout(5000),
      },
    );
    return response.ok && (await response.json()) === true;
  } catch {
    return false;
  }
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
      const evaluation = JSON.parse(outputText);
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
};
