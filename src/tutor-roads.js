(function () {
  const goals = (items) => items.map(([id, title, objective, focus]) => ({ id, title, objective, focus }));
  const roads = [
    { id: "jlpt-n4", title: "Preparar el JLPT N4", subtitle: "Vocabulario, kanji, gramática y lectura", icon: "試", goals: goals([
      ["n4-foundation", "Punto de partida", "Consolidar lo esencial de N5 y localizar tus huecos", "diagnóstico N5; partículas básicas; formas presente y pasado"],
      ["n4-routine", "Rutinas y experiencias", "Hablar de hábitos, cambios y cosas que ya has vivido", "〜ている; 〜たことがある; 〜ながら; expresiones de frecuencia"],
      ["n4-plans", "Planes y comparaciones", "Explicar planes, preferencias y diferencias", "〜つもり; 〜予定; より・ほうが; 〜と思う"],
      ["n4-reasons", "Razones y condiciones", "Conectar motivos, condiciones y consecuencias", "〜から・〜ので; 〜たら; 〜ても; 〜し"],
      ["n4-requests", "Pedir, permitir y aconsejar", "Entender y formular peticiones y reglas sencillas", "〜てください; 〜てもいい; 〜てはいけない; 〜なければならない"],
      ["n4-reading", "Leer textos cotidianos", "Encontrar intención, condiciones y detalles en textos breves", "anuncios; mensajes; conectores; lectura con preguntas"],
      ["n4-checkpoint", "Repaso adaptativo", "Reforzar primero lo que todavía te cuesta", "errores recurrentes; vocabulario frágil; recuperación sin pistas"],
      ["n4-ready", "Comprobación N4", "Resolver ejercicios variados con ritmo y confianza", "lectura; gramática; vocabulario; estrategia de examen"],
    ]) },
    { id: "japan-conversation", title: "Hablar con naturalidad en Japón", subtitle: "Situaciones reales, confianza y registro", icon: "会", goals: goals([
      ["jp-first-meet", "Conocer a alguien", "Presentarte, hacer preguntas y mantener el primer intercambio", "presentación; preguntas abiertas; respuestas de seguimiento; registro cortés"],
      ["jp-smalltalk", "Conversación cotidiana", "Hablar de tu día, aficiones y temas ligeros", "rutinas; gustos; reacciones naturales; devolver preguntas"],
      ["jp-restaurant", "Pedir en un restaurante", "Elegir, pedir recomendaciones, aclarar ingredientes y pagar", "pedido; recomendaciones; restricciones; cuenta; cortesía"],
      ["jp-transport", "Moverte por la ciudad", "Preguntar por rutas, billetes y cambios de trayecto", "direcciones; estaciones; horarios; retrasos; confirmación"],
      ["jp-shops", "Comprar y pedir ayuda", "Encontrar productos, preguntar precios y resolver una compra", "tallas; disponibilidad; pago; devolución; petición de ayuda"],
      ["jp-plans", "Hacer planes juntos", "Proponer una actividad, negociar hora y responder con tacto", "invitaciones; disponibilidad; alternativas; aceptar y declinar"],
      ["jp-experience", "Contar experiencias", "Relatar algo que hiciste y explicar cómo te sentiste", "pasado; secuencia; opinión; preguntas de seguimiento"],
      ["jp-repair", "Resolver malentendidos", "Pedir que repitan, confirmar y reparar una conversación", "聞き返す; decir que no entiendes; confirmar; reformular"],
      ["jp-register", "Sonar adecuado al contexto", "Elegir un tono cercano o cortés y cerrar conversaciones", "registro; fórmulas; turnos; despedidas; matices"],
    ]) },
  ];
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const readJson = (value, fallback = []) => { try { return JSON.parse(value || ""); } catch { return fallback; } };
  const studyDate = () => window.SessionPlanner?.localDate?.() || new Date().toISOString().slice(0, 10);
  const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const state = { roadId: roads[0].id, goalId: "", session: null, activeSessions: {}, evidence: [], settings: {}, busy: false };
  function road(id) { return roads.find((item) => item.id === id) || roads[0]; }
  function goal(roadId, goalId) { return road(roadId).goals.find((item) => item.id === goalId); }
  function goalEvidence(roadId, goalId) { return state.evidence.filter((item) => item.road_id === roadId && item.goal_id === goalId && item.kind === "goal" && item.outcome === "success" && item.confidence !== "low"); }
  function goalStatus(roadId, item) {
    const successes = goalEvidence(roadId, item.id), sessions = new Set(successes.map((entry) => entry.session_id)), days = new Set(successes.map((entry) => entry.study_date)), contexts = new Set(successes.map((entry) => entry.context).filter(Boolean));
    const done = successes.length >= 3 && sessions.size >= 2 && days.size >= 2 && contexts.size >= 2;
    return { done, count: Math.min(3, successes.length), successes: successes.length, days: days.size, contexts: contexts.size };
  }
  function roadState(item) {
    const statuses = item.goals.map((entry) => goalStatus(item.id, entry)), first = statuses.findIndex((entry) => !entry.done);
    return { statuses, current: first < 0 ? item.goals[item.goals.length - 1] : item.goals[first], complete: first < 0, doneCount: statuses.filter((entry) => entry.done).length };
  }
  async function loadData() {
    const [evidence, sessions, setting] = await Promise.all([JapoDB.all("tutor_evidence"), JapoDB.all("tutor_sessions"), JapoDB.get("settings", "app")]);
    state.evidence = evidence;
    state.settings = setting?.value || {};
    const active = sessions.filter((item) => item.status === "active").sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    state.activeSessions = Object.fromEntries(active.slice().reverse().map((item) => [item.road_id, item]));
    state.session = active[0] || null;
  }
  function renderRoads() {
    const container = $("#tutorRoads");
    if (!container) return;
    container.innerHTML = roads.map((item) => {
      const result = roadState(item), progress = Math.round(result.doneCount / item.goals.length * 100), active = state.activeSessions[item.id]?.goal_id === result.current.id;
      const nodes = item.goals.map((entry, index) => {
        const status = result.statuses[index], current = !status.done && entry.id === result.current.id, locked = !status.done && !current;
        return `<li class="tutor-road-node ${status.done ? "is-done" : current ? "is-current" : "is-locked"}"><span class="tutor-node-mark">${status.done ? "✓" : index + 1}</span><div class="tutor-node-card"><div class="tutor-node-title"><strong>${esc(entry.title)}</strong><span>${status.done ? "Completado" : current ? "En curso" : "Después"}</span></div><p>${esc(entry.objective)}</p><details><summary>Qué practicar</summary><p>${esc(entry.focus)}</p><small>${status.done ? "Objetivo consolidado" : `${status.successes}/3 aciertos · ${status.days}/2 días · ${status.contexts}/2 contextos`}</small></details>${current ? `<button class="secondary tutor-start" type="button" data-road="${esc(item.id)}" data-goal="${esc(entry.id)}">${active ? "Continuar objetivo" : "Practicar este objetivo · 5 min"}</button>` : ""}</div></li>`;
      }).join("");
      return `<article class="tutor-road-card ${state.roadId === item.id ? "selected" : ""}"><header class="tutor-road-card-head"><span class="tutor-road-icon">${esc(item.icon)}</span><div><p class="section-kicker">${progress}% del recorrido · ${result.doneCount}/${item.goals.length} bloques</p><h4>${esc(item.title)}</h4><p>${esc(item.subtitle)}</p></div></header><div class="tutor-road-progress"><span style="width:${progress}%"></span></div><ol class="tutor-road-path">${nodes}</ol><p class="tutor-next-chapter">${result.complete ? "Has llegado al final de este recorrido." : `Siguiente bloque: ${esc(result.current.title)}`}</p></article>`;
    }).join("");
    container.querySelectorAll(".tutor-start").forEach((button) => button.addEventListener("click", () => start(button.dataset.road, button.dataset.goal)));
  }
  function compactMemory(roadId, goalId) {
    const all = state.evidence.filter((item) => item.road_id === roadId), recentCutoff = Date.now() - 120 * 86400000, recent = all.filter((item) => Date.parse(item.created_at || "") >= recentCutoff), errors = new Map();
    for (const item of recent.filter((entry) => entry.outcome === "error")) {
      const key = item.concept || "error sin clasificar", previous = errors.get(key) || { count: 0, correction: item.correction || "" };
      previous.count++; if (!previous.correction && item.correction) previous.correction = item.correction; errors.set(key, previous);
    }
    const resolved = new Set();
    for (const [concept] of errors) {
      const lastError = Math.max(...recent.filter((item) => item.concept === concept && item.outcome === "error").map((item) => Date.parse(item.created_at || "") || 0));
      if (recent.filter((item) => item.concept === concept && item.outcome === "success" && Date.parse(item.created_at || "") > lastError).length >= 2) resolved.add(concept);
    }
    const weak = [...errors.entries()].filter(([concept]) => !resolved.has(concept)).sort((a, b) => b[1].count - a[1].count).slice(0, 4).map(([concept, item]) => `${concept} (${item.count}; ${item.correction})`);
    const vocab = [...new Set(all.filter((item) => item.kind === "vocabulary" && item.word).slice(-8).map((item) => `${item.word}(${item.reading || ""})=${item.meaning_es || ""}`))].slice(-4);
    const successes = all.filter((item) => item.outcome === "success").slice(-3).map((item) => item.concept).filter(Boolean);
    const localGoal = goal(roadId, goalId);
    return [weak.length ? `A reforzar: ${weak.join("; ")}` : "Aún no hay errores recurrentes confirmados.", vocab.length ? `Vocabulario reciente: ${vocab.join("; ")}` : "", successes.length ? `Ya usa bien: ${[...new Set(successes)].join(", ")}` : "", `Objetivo actual: ${localGoal?.title || ""}. Enfoque: ${localGoal?.focus || ""}.`].filter(Boolean).join("\n").slice(0, 1700);
  }
  function renderMessages() {
    const target = $("#tutorSessionThread"), messages = state.session ? readJson(state.session.turns_json) : [];
    if (!target) return;
    target.innerHTML = messages.length ? messages.map((item) => `<article class="tutor-turn ${item.role}"><span>${item.role === "user" ? "Tú" : "Tutor"}</span><p>${esc(item.content)}</p>${item.note ? `<small>${esc(item.note)}</small>` : ""}</article>`).join("") : `<p class="tutor-welcome">${esc(goal(state.roadId, state.goalId)?.objective || "Empecemos hablando")}. Responde en japonés a tu ritmo; puedes pedir ayuda en español.</p>`;
    target.scrollTop = target.scrollHeight;
  }
  async function start(roadId, goalId) {
    if (state.activeSessions[roadId]?.goal_id === goalId) { state.session = state.activeSessions[roadId]; state.roadId = roadId; state.goalId = goalId; showPractice(); return; }
    if (state.activeSessions[roadId]) { state.session = state.activeSessions[roadId]; await finishSession(true); }
    state.roadId = roadId; state.goalId = goalId;
    const now = new Date().toISOString(), item = goal(roadId, goalId);
    state.session = { session_id: uid(), road_id: roadId, goal_id: goalId, status: "active", created_at: now, updated_at: now, study_date: studyDate(), title: item.title, turns_json: "[]", turn_count: 0 };
    state.activeSessions[roadId] = state.session;
    await JapoDB.put("tutor_sessions", state.session);
    showPractice(); renderRoads();
  }
  function showPractice() {
    const item = goal(state.roadId, state.goalId), parent = road(state.roadId), panel = $("#tutorPractice");
    if (!item || !panel) return;
    panel.hidden = false; $("#tutorPracticeRoad").textContent = parent.title; $("#tutorPracticeGoal").textContent = item.title; $("#tutorPracticePrompt").textContent = `${item.objective}. El tutor elegirá cómo practicarlo según tu historial, sin un diálogo prefijado.`;
    $("#tutorSessionMemory").textContent = compactMemory(state.roadId, state.goalId);
    $("#tutorJapaneseRatio").value = state.settings.tutorJapaneseRatio || "balanced"; $("#tutorFurigana").checked = state.settings.tutorFurigana !== false;
    renderMessages(); panel.scrollIntoView({ behavior: "smooth", block: "start" }); $("#tutorReply")?.focus();
  }
  async function saveEvidence(data) {
    const now = new Date().toISOString(), stored = [];
    (data.evidence || []).slice(0, 5).forEach((item, index) => {
      if (!item?.concept || !["success", "error", "exposure"].includes(item.outcome)) return;
      stored.push({ evidence_id: `${state.session.session_id}:${state.session.turn_count}:${index}`, session_id: state.session.session_id, road_id: state.roadId, goal_id: state.goalId, study_date: studyDate(), created_at: now, outcome: item.outcome, kind: ["grammar", "vocabulary", "pragmatics", "goal"].includes(item.kind) ? item.kind : "grammar", concept: String(item.concept).slice(0, 100), correction: String(item.correction || "").slice(0, 180), context: String(item.context || "").slice(0, 80), confidence: item.confidence || "medium" });
    });
    (data.vocabulary || []).slice(0, 4).forEach((item, index) => {
      if (!item?.word) return;
      stored.push({ evidence_id: `${state.session.session_id}:${state.session.turn_count}:v${index}`, session_id: state.session.session_id, road_id: state.roadId, goal_id: state.goalId, study_date: studyDate(), created_at: now, outcome: "exposure", kind: "vocabulary", concept: String(item.word).slice(0, 80), word: String(item.word).slice(0, 80), reading: String(item.reading || "").slice(0, 80), meaning_es: String(item.meaning_es || "").slice(0, 100), confidence: "medium" });
    });
    if (stored.length) { await JapoDB.bulkPut("tutor_evidence", stored); state.evidence.push(...stored); }
  }
  async function reply(event) {
    event.preventDefault();
    const input = $("#tutorReply"), text = input?.value.trim();
    if (!text || state.busy || !state.session) return;
    state.busy = true; $("#tutorSendReply").disabled = true; $("#tutorSendReply").textContent = "Pensando…";
    const turns = readJson(state.session.turns_json);
    const recentTurns = turns.slice(-6);
    if (recentTurns.at(-1)?.role === "user" && recentTurns.at(-1)?.content === text) recentTurns.pop();
    const recent = recentTurns.map((item) => ({ role: item.role, content: item.content.slice(0, 500) }));
    turns.push({ role: "user", content: text.slice(0, 900) });
    state.session.turns_json = JSON.stringify(turns.slice(-18)); state.session.updated_at = new Date().toISOString();
    try {
      await JapoDB.put("tutor_sessions", state.session);
      const settings = (await JapoDB.get("settings", "app"))?.value || {}, token = await window.CloudSync?.getAccessToken();
      if (!token) throw new Error("Inicia sesión para usar el Tutor IA.");
      const url = (settings.aiEndpoint || "https://japoteacher-ai.raul-nihongo.workers.dev/evaluate").replace(/\/evaluate$/, "/tutor");
      const response = await (window.JapoAiTransport?.fetch || fetch)(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Device-ID": window.CloudSync?.getDeviceId?.() || "" }, body: JSON.stringify({ operation: "conversation", mode: "ja_to_es", user_message: text, conversation: { goal: `${road(state.roadId).title}: ${goal(state.roadId, state.goalId).title}. ${goal(state.roadId, state.goalId).objective}`, memory: compactMemory(state.roadId, state.goalId), japanese_ratio: $("#tutorJapaneseRatio").value, furigana: $("#tutorFurigana").checked, messages: recent } }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || `Error HTTP ${response.status}`);
      const answer = result.conversation || {};
      turns.push({ role: "assistant", content: [answer.reply_ja, answer.reply_es && $("#tutorJapaneseRatio").value !== "high" ? answer.reply_es : ""].filter(Boolean).join("\n"), note: answer.correction_es ? `${answer.correction_ja ? `${answer.correction_ja} · ` : ""}${answer.correction_es}` : answer.note_es || "" });
      state.session.turn_count = (state.session.turn_count || 0) + 1;
      state.session.turns_json = JSON.stringify(turns.slice(-18)); state.session.updated_at = new Date().toISOString();
      await saveEvidence(answer); await JapoDB.put("tutor_sessions", state.session);
      input.value = ""; $("#tutorSessionMemory").textContent = compactMemory(state.roadId, state.goalId); renderMessages(); renderRoads();
    } catch (error) { renderMessages(); window.UI?.toast?.(error.message || "No se pudo responder."); }
    finally { state.busy = false; $("#tutorSendReply").disabled = false; $("#tutorSendReply").textContent = "Responder"; input?.focus(); }
  }
  async function finishSession(close = true) {
    if (state.session && close) { state.session.status = "completed"; state.session.completed_at = new Date().toISOString(); state.session.updated_at = state.session.completed_at; await JapoDB.put("tutor_sessions", state.session); delete state.activeSessions[state.session.road_id]; }
    if (close) { state.session = null; $("#tutorPractice").hidden = true; renderRoads(); }
  }
  async function init() {
    if (!$("#tutorRoads")) return;
    await loadData();
    if (state.session) { state.roadId = state.session.road_id; state.goalId = state.session.goal_id; }
    renderRoads();
    $("#tutorReplyForm")?.addEventListener("submit", reply);
    $("#tutorEndSession")?.addEventListener("click", () => finishSession(true));
    $("#tutorJapaneseRatio")?.addEventListener("change", async (event) => { state.settings.tutorJapaneseRatio = event.target.value; const row = await JapoDB.get("settings", "app"); if (row) await JapoDB.put("settings", { ...row, value: { ...(row.value || {}), tutorJapaneseRatio: event.target.value } }); });
    $("#tutorFurigana")?.addEventListener("change", async (event) => { state.settings.tutorFurigana = event.target.checked; const row = await JapoDB.get("settings", "app"); if (row) await JapoDB.put("settings", { ...row, value: { ...(row.value || {}), tutorFurigana: event.target.checked } }); });
    document.addEventListener("japoteacher:navigate", (event) => { if (event.detail?.view === "tutor") { const selectedRoad = state.roadId; loadData().then(() => { renderRoads(); state.session = state.activeSessions[selectedRoad] || null; if (state.session) { state.roadId = state.session.road_id; state.goalId = state.session.goal_id; showPractice(); } else $("#tutorPractice").hidden = true; }); } });
  }
  document.addEventListener("DOMContentLoaded", () => init().catch((error) => { console.warn("Tutor:", error); window.UI?.toast?.("No se pudo cargar el recorrido del tutor."); }));
})();
