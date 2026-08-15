const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DIRECTIONS = ["ja_es", "es_ja"], LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const list = { type: "array", items: { type: "string" }, maxItems: 4 };
const reportSchema = {
  type: "object", additionalProperties: false,
  required: ["summary", "teacher_assessment", "strengths", "priority_structures", "priority_vocabulary", "vocabulary_focus", "action_plan", "cumulative_progress"],
  properties: {
    summary: { type: "string" },
    teacher_assessment: { type: "object", additionalProperties: false, required: ["headline", "narrative"], properties: { headline: { type: "string" }, narrative: { type: "string" } } },
    strengths: list, priority_structures: list, priority_vocabulary: list,
    vocabulary_focus: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["term", "diagnosis", "practice"], properties: { term: { type: "string" }, diagnosis: { type: "string" }, practice: { type: "string" } } } },
    action_plan: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["title", "reason", "evidence", "target"], properties: { title: { type: "string" }, reason: { type: "string" }, evidence: { type: "string" }, target: { type: "string" } } } },
    cumulative_progress: { type: "object", additionalProperties: false, required: ["trend", "resolved", "persistent"], properties: { trend: { type: "string" }, resolved: list, persistent: list } },
  },
};
function dateKey(value) { return new Date(value).toISOString().slice(0, 10); }
export function reportPeriod(type, date = new Date(), closed = false) { const end = new Date(date), start = new Date(date); if (type === "monthly") { start.setDate(1); start.setMonth(start.getMonth() - 1); end.setDate(0); } else { const offset = (end.getDay() + 6) % 7; end.setDate(end.getDate() - offset - (closed ? 1 : 0)); start.setTime(end.getTime()); start.setDate(start.getDate() - 6); } start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999); return { start: start.toISOString(), end: end.toISOString() }; }
function json(value) { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function mean(values) { return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null; }
function metric(items, field) { const values = items.map(item => Number(item[field])).filter(Number.isFinite); return values.length >= 3 ? mean(values) : null; }
function levelContext(items, exercises) {
  const rows = LEVELS.map(level => {
    const values = items.filter(item => exercises.get(item.exercise_id)?.jlpt_level === level), scores = values.map(item => Number(item.overall_score)).filter(Number.isFinite), acceptable = values.filter(item => item.is_acceptable).length, difficulty = values.map(item => Number(exercises.get(item.exercise_id)?.difficulty)).filter(Number.isFinite);
    if (!values.length) return null;
    const average = mean(scores) || 0, rate = values.length ? Math.round(100 * acceptable / values.length) : 0, status = values.length < 3 ? "muestra insuficiente" : average >= 80 && rate >= 67 ? "consolidado" : average >= 65 ? "en consolidacion" : "requiere refuerzo";
    return { level, count: values.length, average, acceptable_rate: rate, average_difficulty: mean(difficulty), status };
  }).filter(Boolean);
  const working = rows.at(-1) || { level: "N5", count: 0, average: 0, acceptable_rate: 0, average_difficulty: null, status: "sin evidencia" }, index = LEVELS.indexOf(working.level), next = LEVELS[index + 1] || null;
  const gaps = []; if (working.count < 3) gaps.push(`completar ${3 - working.count} respuestas mas`); if (working.average < 80) gaps.push(`elevar la media ${80 - working.average} puntos`); if (working.acceptable_rate < 67) gaps.push(`subir las respuestas aceptables ${67 - working.acceptable_rate} puntos porcentuales`);
  return { by_level: rows, working_level: working.level, working_status: working.status, next_level: next, promotion_gaps: working.status === "consolidado" ? (next ? [`empezar evidencia en ${next} con al menos 3 respuestas`] : ["mantener resultados en el tramo alto del nivel"]) : gaps, difficulty_band: working.average_difficulty == null ? "sin dificultad registrada" : working.average_difficulty < 35 ? "tramo base" : working.average_difficulty < 70 ? "tramo intermedio" : "tramo alto" };
}
export function experienceMetrics(attempts) {
  const rows = attempts.filter(item => Number.isFinite(Number(item.ranked_xp_delta)));
  const direction = Object.fromEntries(DIRECTIONS.map(key => {
    const values = rows.filter(item => item.direction === key).map(item => Number(item.ranked_xp_delta));
    return [key, { net: Math.round(values.reduce((sum, value) => sum + value, 0) * 1000) / 1000, gained: Math.round(values.filter(value => value > 0).reduce((sum, value) => sum + value, 0) * 1000) / 1000, lost: Math.round(values.filter(value => value < 0).reduce((sum, value) => sum + value, 0) * 1000) / 1000, count: values.length }];
  }));
  const daily = new Map();
  for (const item of rows) { const date = dateKey(item.attempted_at), current = daily.get(date) || { date, net: 0, gained: 0, lost: 0, count: 0, ja_es: 0, es_ja: 0 }, delta = Number(item.ranked_xp_delta); current.net += delta; current[delta >= 0 ? "gained" : "lost"] += delta; current.count += 1; current[item.direction] += delta; daily.set(date, current); }
  const total = Object.values(direction).reduce((sum, item) => sum + item.net, 0);
  return { net: Math.round(total * 1000) / 1000, gained: Math.round(Object.values(direction).reduce((sum, item) => sum + item.gained, 0) * 1000) / 1000, lost: Math.round(Object.values(direction).reduce((sum, item) => sum + item.lost, 0) * 1000) / 1000, attempt_count: rows.length, direction, daily: [...daily.values()].sort((left, right) => left.date.localeCompare(right.date)).map(item => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, typeof value === "number" ? Math.round(value * 1000) / 1000 : value]))) };
}
function aggregate(payload, period) {
  const attempts = (payload?.stores?.attempts || []).filter(item => item.evaluation_status === "valid" && item.attempted_at >= period.start && item.attempted_at <= period.end), exercises = new Map((payload?.stores?.exercises || []).map(item => [item.exercise_id, item]));
  const directions = Object.fromEntries(DIRECTIONS.map(direction => { const items = attempts.filter(item => item.direction === direction); return [direction, { count: items.length, average: metric(items, "overall_score") || 0, acceptable: items.filter(item => item.is_acceptable).length, objective: metric(items, "objective_score"), comprehensibility: metric(items, "comprehensibility_score"), grammar: metric(items, "grammar_score"), vocabulary: metric(items, "vocabulary_score"), naturalness: metric(items, "naturalness_score"), level_context: levelContext(items, exercises) }]; }));
  const errors = new Map();
  for (const attempt of attempts) for (const error of json(attempt.errors_json)) { const key = `${attempt.direction}|${error.category}|${error.subtype}|${error.source_span}|${error.corrected_span}`, current = errors.get(key) || { direction: attempt.direction, level: exercises.get(attempt.exercise_id)?.jlpt_level || "sin nivel", difficulty: exercises.get(attempt.exercise_id)?.difficulty ?? null, category: error.category, subtype: error.subtype, source: error.source_span, correction: error.corrected_span, explanation: error.explanation_es, count: 0 }; current.count += 1; errors.set(key, current); }
  const vocabulary = [...errors.values()].filter(item => ["vocabulary_choice", "collocation", "literal_translation", "meaning_change"].includes(item.category)).sort((a, b) => b.count - a.count).slice(0, 8);
  return { attempts, direction_metrics: directions, experience_metrics: experienceMetrics(attempts), recurring_errors: [...errors.values()].sort((a, b) => b.count - a.count).slice(0, 12), vocabulary_evidence: vocabulary };
}
function instructions() { return "Eres responsable academico de una escuela de japones para hispanohablantes. Redacta un informe profesional basado exclusivamente en evidence. El porcentaje bruto no es una conclusion: interpreta siempre nivel JLPT, tramo de dificultad, numero de respuestas y direccion. experience_metrics mide EXP ranked neta del periodo; interpretala como carga y avance, nunca como sustituto de la calidad linguistica. Explica el nivel de trabajo actual y las condiciones concretas para pasar al siguiente nivel sin prometer certificaciones. No muestres tags ni nombres de campos. Prioriza errores reales con source/correction: en vocabulary_focus usa palabras o expresiones observadas, nunca etiquetas tecnicas. Si no existe evidencia de vocabulario, dilo de forma honesta sin inventar. Distingue japones a espanol y espanol a japones. narrative debe tener 120-170 palabras e incluir evidencia, contraste entre direcciones, nivel y siguiente paso. Cada accion debe citar evidence concreta y un objetivo medible. Responde solo JSON."; }
async function admin(env, path, options = {}, accessToken = null) { const key = accessToken ? env.SUPABASE_PUBLISHABLE_KEY : env.SUPABASE_SERVICE_ROLE_KEY, authorization = accessToken || `Bearer ${key}`, response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: authorization, "Content-Type": "application/json", ...(options.headers || {}) } }); if (!response.ok) throw new Error(`Supabase reports: ${await response.text()}`); return response.status === 204 ? null : response.json(); }
async function save(env, userId, type, period, patch, accessToken = null, revision = 1) { const base = { user_id: userId, report_type: type, period_start: period.start, period_end: period.end, revision, ...patch }, rows = await admin(env, "learning_reports?on_conflict=user_id,report_type,period_start,period_end,revision", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(base) }, accessToken); return rows[0]; }
async function createReportContent(env, evidence, type, period) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(OPENAI_RESPONSES_URL, { method: "POST", headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5.4-mini", reasoning: { effort: "medium" }, instructions: instructions(), input: JSON.stringify({ report_type: type, period, direction_metrics: evidence.direction_metrics, experience_metrics: evidence.experience_metrics, recurring_errors: evidence.recurring_errors, vocabulary_evidence: evidence.vocabulary_evidence, note: "No inventes evidencia ni etiquetas tecnicas." }), max_output_tokens: 8000, text: { format: { type: "json_schema", name: "japoteacher_learning_report", strict: true, schema: reportSchema } } }) });
    const raw = await response.json();
    if (!response.ok) throw new Error(raw?.error?.message || "OpenAI rechazo el informe.");
    const content = raw.output?.flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text || "").join("");
    const text = [raw.output_text || "", content].sort((left, right) => right.length - left.length)[0];
    try { if (!text) throw new Error("OpenAI no devolvio el informe."); return { report: JSON.parse(text), usage: raw.usage || {} }; }
    catch (error) { lastError = error; }
  }
  throw new Error("El modelo devolvio un informe incompleto tras dos intentos. Vuelve a generarlo.");
}
export function reportContentPatch(content) {
  const { teacher_assessment, cumulative_progress, vocabulary_focus, ...report } = content;
  return {
    ...report,
    cumulative_progress: { ...cumulative_progress, teacher_assessment, vocabulary_focus },
  };
}
export async function generateReport(env, userId, payload, type, period, accessToken = null, force = false) {
  if (!env.OPENAI_API_KEY || (!accessToken && !env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error("El Worker necesita una sesion valida o SUPABASE_SERVICE_ROLE_KEY.");
  const existing = await admin(env, `learning_reports?user_id=eq.${userId}&report_type=eq.${type}&period_start=eq.${encodeURIComponent(period.start)}&period_end=eq.${encodeURIComponent(period.end)}&order=revision.desc&select=*&limit=1`, {}, accessToken); if (existing[0]?.status === "ready" && !force) return existing[0];
  const revision = force ? (Number(existing[0]?.revision) || 0) + 1 : Number(existing[0]?.revision) || 1, evidence = aggregate(payload, period);
  if (evidence.attempts.length < 3) return save(env, userId, type, period, { status: "ready", attempt_count: evidence.attempts.length, direction_metrics: evidence.direction_metrics, experience_metrics: evidence.experience_metrics, summary: "Todavia no hay evidencia suficiente para un informe fiable. Completa al menos tres ejercicios en este periodo.", cumulative_progress: { trend: "Sin evidencia suficiente", resolved: [], persistent: [] }, generated_at: new Date().toISOString() }, accessToken, revision);
  await save(env, userId, type, period, { status: "generating", attempt_count: evidence.attempts.length, direction_metrics: evidence.direction_metrics, experience_metrics: evidence.experience_metrics, error_message: null }, accessToken, revision);
  try {
    const content = await createReportContent(env, evidence, type, period); return save(env, userId, type, period, { status: "ready", attempt_count: evidence.attempts.length, direction_metrics: evidence.direction_metrics, experience_metrics: evidence.experience_metrics, ...reportContentPatch(content.report), evidence_attempt_ids: evidence.attempts.slice(0, 30).map(item => item.attempt_id), token_usage: content.usage, generated_at: new Date().toISOString() }, accessToken, revision);
  } catch (error) { await save(env, userId, type, period, { status: "failed", attempt_count: evidence.attempts.length, direction_metrics: evidence.direction_metrics, experience_metrics: evidence.experience_metrics, error_message: error.message || "Error al generar el informe." }, accessToken, revision); throw error; }
}
export async function reportsForUser(env, userId, accessToken = null) { return admin(env, `learning_reports?user_id=eq.${userId}&order=period_end.desc,revision.desc&select=*`, {}, accessToken); }
export async function deleteReport(env, userId, reportId, accessToken = null) { const rows = await admin(env, `learning_reports?report_id=eq.${encodeURIComponent(reportId)}&user_id=eq.${userId}`, { method: "DELETE", headers: { Prefer: "return=representation" } }, accessToken); return rows[0] || null; }
export async function userPayload(env, userId, accessToken = null) { const rows = await admin(env, `user_state?user_id=eq.${userId}&select=payload&limit=1`, {}, accessToken); return rows[0]?.payload || { stores: {} }; }
export async function allUserStates(env) { return admin(env, "user_state?select=user_id,payload"); }
export function localReport(row) { return { ...row, remote_report_id: row.report_id }; }
