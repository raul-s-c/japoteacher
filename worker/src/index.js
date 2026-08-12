import { normalizeEvaluation } from "./evaluation-policy.js";
import { allUserStates, deleteReport, generateReport, localReport, reportPeriod, reportsForUser, userPayload } from "./report-generation.js";

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
  return `Eres profesor de japonés para hispanohablantes. Evalúa la traducción admitiendo alternativas válidas y distingue significado, comprensión, naturalidad, gramática, vocabulario, ortografía y registro. Cada campo *_score es una nota independiente de 0 a 100, nunca la contribución ponderada: una respuesta perfecta tiene 100 en todos los campos, no 30/15/15. Si overall_score es 100, todos los campos *_score deben ser 100 y errors debe estar vacío. Explica en español de forma breve y precisa; no inventes errores. En es_ja, si la frase española no marca inequívocamente el trato con palabras como tú, usted, vosotros o un tratamiento explícito, acepta por igual japonés llano y cortés: register_score debe ser 100 y no puede haber errores de register o politeness. No deduzcas formalidad solo por la traducción de referencia. correct_japanese_sentence será la fuente japonesa en ja_es y una propuesta japonesa natural en es_ja. Para cada error de es_ja cuya corrected_span contenga kanji, kanji_readings debe incluir sin omisiones los bloques de kanji de esa corrección, aunque no aparezcan literalmente en correct_japanese_sentence. kanji_readings incluirá texto exacto, lectura contextual completa en hiragana, significado contextual y motivo breve de la lectura (on/kun, compuesto, okurigana, nombre o excepción). Excluye kana aislada y puntuación. Calcula overall_score después de puntuar cada dimensión: objetivo 30%, comprensión 15%, naturalidad 15%, gramática 15%, vocabulario 10%, ortografía 10% y registro 5%. Usa solo categorías del esquema.`;
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
  const common = `Actúas como comité editorial bilingüe de japonés para hispanohablantes. El contenido debe ser natural, autosuficiente, realista y adecuado al nivel JLPT indicado. El JLPT no tiene listas oficiales cerradas: juzga por competencia, muestras oficiales y uso básico real. Prohibido generar por sustitución mecánica de lugares, personas u objetos. Cada escena debe ser plausible sin contexto oculto; japonés y español deben coincidir en sujeto recuperable, acción, tiempo, lugar, polaridad, modalidad, registro e intención. Toda causa, condición, contraste, finalidad y secuencia debe ser lógicamente válida por sí misma: comprueba explícitamente que la causa apoya la consecuencia y rechaza inversiones como «porque no llueve, no voy de excursión» sin una razón adicional visible. La referencia española usa el equivalente directo, estándar y no marcado; no sustituye sopa por caldo, escuela por universidad ni añade información inferida. Las alternativas tampoco pueden añadir tiempo, lugar, sujeto ni matices ausentes. Los tags solo incluyen elementos realmente presentes y practicados; nunca escribas nombres de campos o marcadores internos como grammar_focus. topic_primary debe estar evidenciado explícitamente por el contenido japonés y español, no solo por scenario_es. kanji_readings cubre sin omisiones cada carácter kanji visible, incluido el de verbos flexionados, numerales y palabras muy básicas; characters reproduce el bloque exacto que aparece en la frase. N5 usa solo construcciones de su inventario básico: no introduzcas ので, のに, たら, なら, condicional ば, ように, そうだ, と思う, かもしれない, つもり, potencial, pasiva ni causativa. Si una revisión N5 recibe alguna, reescribe la frase con gramática N5 conservando tema, intención y foco del slot. N4 usa japonés básico sobre estudio, vida diaria y trabajo, con razones, secuencias y relaciones sencillas. Sigue exactamente los slots de cobertura recibidos. Copia sin alterar el número slot de cada entrada y conserva la correspondencia uno a uno aunque reordenes la salida. topic_primary debe ser exactamente el del slot y grammar_tags debe incluir la construcción real indicada por grammar_focus, sin copiar el nombre del campo. No insertes espacios entre palabras japonesas y termina con puntuación japonesa. Una frase con です o ます tiene registro cortés, no neutro.`;
  return operation === "review"
    ? `${common} Revisa adversarialmente todos los pares recibidos y devuelve exactamente uno por cada entrada, conservando su index y slot. Compara japanese con spanish y con cada accepted_alternatives_es, y spanish con cada accepted_alternatives_ja. Comprueba hablante o sujeto recuperable, singular/plural, persona, acción, objeto, tiempo, aspecto, momento, lugar, dirección, cantidad, polaridad, capacidad, obligación, permiso, deseo, condición, causa, consecuencia, registro e intención. Elimina cualquier alternativa que omita o añada una unidad crítica. Busca además situaciones absurdas, colocaciones impropias, traducciones literales, ambigüedad, dificultad mal nivelada, tags inflados, lecturas incorrectas y duplicación estructural. Si el payload contiene mandatory_local_fixes, corrected debe resolver literalmente todos esos diagnósticos sin excepción. issues describe los defectos encontrados en la entrada recibida, pero approved evalúa exclusivamente corrected: debe ser true cuando tu versión corrected ya ha resuelto todos los defectos y está lista para publicar. Usa false solo si ni siquiera corrected queda publicable y necesitaría otra revisión.`
    : `${common} Redacta exactamente tantos pares independientes como slots hayas recibido: uno y solo uno por slot. Primero imagina la microescena y después escribe la frase; no reutilices el mismo esqueleto sintáctico dentro del lote. Respeta los límites y objetivos de cada slot.`;
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
    reasoning: { effort: "low" },
    instructions: operation === "difficulty_review" ? difficultyReviewInstructions() : operation === "repair_kanji" ? kanjiRepairInstructions() : operation === "equivalence_check" ? equivalenceCheckInstructions() : editorialInstructions(operation),
    input: JSON.stringify(payload),
    max_output_tokens: operation === "difficulty_review" ? 3200 : operation === "equivalence_check" ? 2500 : operation === "repair_kanji" ? 3500 : 5000,
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

async function authenticatedUser(request, env) {
  if (!(await authenticated(request, env))) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: request.headers.get("Authorization") || "", apikey: env.SUPABASE_PUBLISHABLE_KEY } });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id || null;
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
