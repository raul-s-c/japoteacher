const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DIRECTIONS = ["ja_es", "es_ja"];
const reportSchema = {
  type: "object", additionalProperties: false,
  required: ["summary", "strengths", "priority_structures", "priority_vocabulary", "action_plan", "cumulative_progress"],
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, maxItems: 4 },
    priority_structures: { type: "array", items: { type: "string" }, maxItems: 4 },
    priority_vocabulary: { type: "array", items: { type: "string" }, maxItems: 4 },
    action_plan: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["title", "reason", "target"], properties: { title: { type: "string" }, reason: { type: "string" }, target: { type: "string" } } } },
    cumulative_progress: { type: "object", additionalProperties: false, required: ["trend", "resolved", "persistent"], properties: { trend: { type: "string" }, resolved: { type: "array", items: { type: "string" } }, persistent: { type: "array", items: { type: "string" } } } },
  },
};
function dateKey(value) { return new Date(value).toISOString().slice(0, 10); }
export function reportPeriod(type, date = new Date(), closed = false) {
  const end = new Date(date), start = new Date(date);
  if (type === "monthly") { start.setDate(1); start.setMonth(start.getMonth() - 1); end.setDate(0); }
  else { const offset = (end.getDay() + 6) % 7; end.setDate(end.getDate() - offset - (closed ? 1 : 0)); start.setTime(end.getTime()); start.setDate(start.getDate() - 6); }
  start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}
function aggregate(payload, period) {
  const attempts = (payload?.stores?.attempts || []).filter(a => a.evaluation_status === "valid" && a.attempted_at >= period.start && a.attempted_at <= period.end);
  const directions = Object.fromEntries(DIRECTIONS.map(direction => {
    const items = attempts.filter(a => a.direction === direction), average = items.length ? Math.round(items.reduce((sum, a) => sum + (a.overall_score || 0), 0) / items.length) : 0;
    return [direction, { count: items.length, average, acceptable: items.filter(a => a.is_acceptable).length }];
  }));
  const tags = new Map();
  for (const attempt of attempts) for (const field of ["detected_grammar_tags_json", "detected_vocabulary_tags_json", "detected_error_tags_json"]) {
    let values = []; try { values = JSON.parse(attempt[field] || "[]"); } catch {}
    for (const value of values) { const key = `${field}:${value}`, item = tags.get(key) || { value, count: 0 }; item.count++; tags.set(key, item); }
  }
  return { attempts, direction_metrics: directions, recurring_tags: [...tags.values()].sort((a, b) => b.count - a.count).slice(0, 12) };
}
function instructions() { return "Eres un profesor de japones para hispanohablantes. Redacta un informe pedagogico concreto y breve basado exclusivamente en las metricas y tags recibidos. Distingue siempre ja_es de es_ja; no inventes tendencias ni errores. Da acciones medibles y aplicables. Responde solo al JSON del esquema."; }
async function admin(env, path, options = {}) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  // PostgREST resolves the database role from Authorization; apikey identifies the project.
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Supabase reports: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
async function save(env, userId, type, period, patch) {
  const base = { user_id: userId, report_type: type, period_start: period.start, period_end: period.end, ...patch };
  const rows = await admin(env, "learning_reports?on_conflict=user_id,report_type,period_start,period_end", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(base) });
  return rows[0];
}
export async function generateReport(env, userId, payload, type, period) {
  if (!env.OPENAI_API_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("El Worker necesita OPENAI_API_KEY y SUPABASE_SERVICE_ROLE_KEY.");
  const existing = await admin(env, `learning_reports?user_id=eq.${userId}&report_type=eq.${type}&period_start=eq.${encodeURIComponent(period.start)}&period_end=eq.${encodeURIComponent(period.end)}&select=*&limit=1`);
  if (existing[0]?.status === "ready") return existing[0];
  const evidence = aggregate(payload, period);
  if (evidence.attempts.length < 3) return save(env, userId, type, period, { status: "ready", attempt_count: evidence.attempts.length, direction_metrics: evidence.direction_metrics, summary: "Todavia no hay evidencia suficiente para un informe fiable. Completa al menos tres ejercicios en este periodo.", cumulative_progress: { trend: "Sin evidencia suficiente", resolved: [], persistent: [] }, generated_at: new Date().toISOString() });
  await save(env, userId, type, period, { status: "generating", attempt_count: evidence.attempts.length, direction_metrics: evidence.direction_metrics, error_message: null });
  try {
    const response = await fetch(OPENAI_RESPONSES_URL, { method: "POST", headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5.4-mini", reasoning: { effort: "low" }, instructions: instructions(), input: JSON.stringify({ report_type: type, period, direction_metrics: evidence.direction_metrics, recurring_tags: evidence.recurring_tags, previous_reports: [], note: "No mezcles el dominio de ambas direcciones." }), max_output_tokens: 1600, text: { format: { type: "json_schema", name: "japoteacher_learning_report", strict: true, schema: reportSchema } } }) });
    const raw = await response.json(); if (!response.ok) throw new Error(raw?.error?.message || "OpenAI rechazo el informe.");
    const text = raw.output_text || raw.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text; if (!text) throw new Error("OpenAI no devolvio el informe.");
    const report = JSON.parse(text);
    return save(env, userId, type, period, { status: "ready", attempt_count: evidence.attempts.length, direction_metrics: evidence.direction_metrics, ...report, evidence_attempt_ids: evidence.attempts.slice(0, 30).map(a => a.attempt_id), token_usage: raw.usage || {}, generated_at: new Date().toISOString() });
  } catch (error) { await save(env, userId, type, period, { status: "failed", attempt_count: evidence.attempts.length, direction_metrics: evidence.direction_metrics, error_message: error.message || "Error al generar el informe." }); throw error; }
}
export async function reportsForUser(env, userId) { return admin(env, `learning_reports?user_id=eq.${userId}&order=period_end.desc&select=*`); }
export async function userPayload(env, userId) { const rows = await admin(env, `user_state?user_id=eq.${userId}&select=payload&limit=1`); return rows[0]?.payload || { stores: {} }; }
export async function allUserStates(env) { return admin(env, "user_state?select=user_id,payload"); }
export function localReport(row) { return { ...row, report_id: `${row.report_type}:${dateKey(row.period_start)}:${dateKey(row.period_end)}`, remote_report_id: row.report_id }; }
