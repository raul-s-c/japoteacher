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
  const openings = {
    "n4-foundation": ["週末は何をしましたか。少し詳しく教えてください。", "週末(しゅうまつ)は何(なに)をしましたか。少(すこ)し詳(くわ)しく教(おし)えてください。", "¿Qué hiciste el fin de semana? Cuéntame un poco más."],
    "n4-routine": ["毎朝、何時に起きていますか。", "毎朝(まいあさ)、何時(なんじ)に起(お)きていますか。", "¿A qué hora te levantas cada mañana?"],
    "n4-plans": ["今年、何をする予定ですか。", "今年(ことし)、何(なに)をする予定(よてい)ですか。", "¿Qué planes tienes para este año?"],
    "n4-reasons": ["どうして日本語を勉強しているんですか。", "どうして日本語(にほんご)を勉強(べんきょう)しているんですか。", "¿Por qué estudias japonés?"],
    "n4-requests": ["友達に週末の予定を聞いて、おすすめの場所を一つ教えてください。", "友達(ともだち)に週末(しゅうまつ)の予定(よてい)を聞(き)いて、おすすめの場所(ばしょ)を一(ひと)つ教(おし)えてください。", "Pregunta a un amigo qué planes tiene para el fin de semana y recomiéndale un lugar."],
    "n4-reading": ["このお知らせを読んで、いつ、どこで何があるか説明してください。", "このお知(し)らせを読(よ)んで、いつ、どこで何(なに)があるか説明(せつめい)してください。", "Lee este aviso y explica cuándo, dónde y qué va a ocurrir."],
    "n4-checkpoint": ["最近、前よりできるようになったことは何ですか。", "最近(さいきん)、前(まえ)よりできるようになったことは何(なん)ですか。", "¿Qué cosas puedes hacer ahora mejor que antes?"],
    "n4-ready": ["最近の出来事について、理由や自分の考えも入れて話してください。", "最近(さいきん)の出来事(できごと)について、理由(りゆう)や自分(じぶん)の考(かんが)えも入(い)れて話(はな)してください。", "Háblame de algo reciente e incluye tus razones y lo que piensas."],
    "jp-first-meet": ["こんにちは。日本にはどのくらい滞在する予定ですか。", "こんにちは。日本(にほん)にはどのくらい滞在(たいざい)する予定(よてい)ですか。", "Hola. ¿Cuánto tiempo tienes pensado quedarte en Japón?"],
    "jp-smalltalk": ["最近、休みの日は何をしていますか。", "最近(さいきん)、休(やす)みの日(ひ)は何(なに)をしていますか。", "¿Qué sueles hacer últimamente en tus días libres?"],
    "jp-restaurant": ["いらっしゃいませ。ご注文はお決まりですか。", "いらっしゃいませ。ご注文(ちゅうもん)はお決(き)まりですか。", "Bienvenido. ¿Ya sabe qué va a pedir?"],
    "jp-transport": ["すみません、浅草へ行きたいんですが、どの電車に乗ればいいですか。", "すみません、浅草(あさくさ)へ行(い)きたいんですが、どの電車(でんしゃ)に乗(の)ればいいですか。", "Perdona, quiero ir a Asakusa. ¿Qué tren debería tomar?"],
    "jp-shops": ["すみません、この靴のもう少し大きいサイズはありますか。", "すみません、この靴(くつ)のもう少(すこ)し大(おお)きいサイズはありますか。", "Perdone, ¿tienen estos zapatos en una talla un poco más grande?"],
    "jp-plans": ["今週末、一緒に映画を見に行きませんか。", "今週末(こんしゅうまつ)、一緒(いっしょ)に映画(えいが)を見(み)に行(い)きませんか。", "¿Te apetece ir al cine conmigo este fin de semana?"],
    "jp-experience": ["今まで行った場所で、一番よかったところはどこですか。", "今(いま)まで行(い)った場所(ばしょ)で、一番(いちばん)よかったところはどこですか。", "De los lugares que has visitado, ¿cuál te gustó más?"],
    "jp-repair": ["すみません、もう少しゆっくり話していただけますか。", "すみません、もう少(すこ)しゆっくり話(はな)していただけますか。", "Perdona, ¿podrías hablar un poco más despacio?"],
    "jp-register": ["ご説明ありがとうございます。少し考えてから、またお返事してもよろしいですか。", "ご説明(せつめい)ありがとうございます。少(すこ)し考(かんが)えてから、またお返事(へんじ)してもよろしいですか。", "Gracias por explicármelo. ¿Le parece bien si lo pienso un poco y le respondo después?"],
  };
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const readJson = (value, fallback = []) => { try { return JSON.parse(value || ""); } catch { return fallback; } };
  const renderFurigana = (value) => esc(value).replace(/([\u3400-\u9fff々〆ヶ]+)\(([ぁ-ゖー]+)\)/g, "<ruby>$1<rt>$2</rt></ruby>");
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
    target.innerHTML = messages.length ? messages.map((item, index) => {
      if (item.role !== "assistant") return `<article class="tutor-turn user"><span>Tú</span><p>${esc(item.content || "")}</p></article>`;
      if (!item.japanese) return `<article class="tutor-turn assistant"><span>Tutor</span><p>${esc(item.content || "")}</p>${item.note ? `<small>${esc(item.note)}</small>` : ""}</article>`;
      const jp = item.furigana_visible ? renderFurigana(item.furigana || item.japanese) : esc(item.japanese);
      return `<article class="tutor-turn assistant"><span>Tutor · japonés</span><p class="tutor-japanese" lang="ja">${jp}</p><div class="tutor-turn-controls"><label><input type="checkbox" data-tutor-translation="${index}" ${item.translation_visible ? "checked" : ""}> Mostrar traducción</label><button type="button" class="tutor-inline-button" data-tutor-furigana="${index}" aria-pressed="${Boolean(item.furigana_visible)}">あ ${item.furigana_visible ? "Ocultar furigana" : "Mostrar furigana"}</button><button type="button" class="tutor-inline-button" data-tutor-speak="${index}">🔊 Escuchar</button></div><p class="tutor-translation" ${item.translation_visible ? "" : "hidden"}>${esc(item.translation || "")}</p>${item.note ? `<small>${esc(item.note)}</small>` : ""}</article>`;
    }).join("") : `<p class="tutor-welcome">${esc(goal(state.roadId, state.goalId)?.objective || "Empecemos hablando")}. Responde en japonés a tu ritmo; puedes pedir ayuda en español.</p>`;
    target.querySelectorAll("[data-tutor-translation]").forEach((control) => control.addEventListener("change", () => setTurnOption(Number(control.dataset.tutorTranslation), "translation_visible", control.checked)));
    target.querySelectorAll("[data-tutor-furigana]").forEach((control) => control.addEventListener("click", () => setTurnOption(Number(control.dataset.tutorFurigana), "furigana_visible", control.getAttribute("aria-pressed") !== "true")));
    target.querySelectorAll("[data-tutor-speak]").forEach((control) => control.addEventListener("click", () => speakTurn(Number(control.dataset.tutorSpeak), control)));
    target.scrollTop = target.scrollHeight;
  }
  async function setTurnOption(index, key, value) {
    const turns = readJson(state.session?.turns_json), turn = turns[index];
    if (!turn) return;
    turn[key] = value; state.session.turns_json = JSON.stringify(turns); state.session.updated_at = new Date().toISOString();
    await JapoDB.put("tutor_sessions", state.session); renderMessages();
  }
  async function speakTurn(index, button) {
    const turn = readJson(state.session?.turns_json)[index];
    if (!turn?.japanese) return;
    try { button.disabled = true; await window.PracticeTools.speakText(turn.japanese); }
    catch (error) { window.UI?.toast?.(error.message || "No se pudo reproducir el japonés."); }
    finally { button.disabled = false; }
  }
  async function start(roadId, goalId) {
    if (state.activeSessions[roadId]?.goal_id === goalId) { state.session = state.activeSessions[roadId]; state.roadId = roadId; state.goalId = goalId; showPractice(); return; }
    if (state.activeSessions[roadId]) { state.session = state.activeSessions[roadId]; await finishSession(true); }
    state.roadId = roadId; state.goalId = goalId;
    const now = new Date().toISOString(), item = goal(roadId, goalId);
    state.session = { session_id: uid(), road_id: roadId, goal_id: goalId, status: "active", created_at: now, updated_at: now, study_date: studyDate(), title: item.title, turns_json: JSON.stringify([openingTurn(goalId)]), turn_count: 0 };
    state.activeSessions[roadId] = state.session;
    await JapoDB.put("tutor_sessions", state.session);
    showPractice(); renderRoads();
  }
  function openingTurn(goalId) {
    const opening = openings[goalId] || ["こんにちは。今日は何について話しましょうか。", "こんにちは。今日(きょう)は何(なに)について話(はな)しましょうか。", "Hola. ¿De qué te gustaría hablar hoy?"];
    return { role: "assistant", japanese: opening[0], furigana: opening[1], translation: opening[2], translation_visible: false, furigana_visible: false, note: "" };
  }
  function showPractice() {
    const item = goal(state.roadId, state.goalId), parent = road(state.roadId), panel = $("#tutorPractice");
    if (!item || !panel) return;
    if (!readJson(state.session.turns_json).length) { state.session.turns_json = JSON.stringify([openingTurn(state.goalId)]); JapoDB.put("tutor_sessions", state.session).catch((error) => console.warn("No se pudo guardar la apertura del tutor:", error)); }
    panel.hidden = false; $("#tutorPracticeRoad").textContent = parent.title; $("#tutorPracticeGoal").textContent = item.title; $("#tutorPracticePrompt").textContent = `${item.objective}. El tutor elegirá cómo practicarlo según tu historial, sin un diálogo prefijado.`;
    $("#tutorSessionMemory").textContent = compactMemory(state.roadId, state.goalId);
    $("#tutorJapaneseRatio").value = state.settings.tutorJapaneseRatio || "balanced";
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
    const recent = recentTurns.map((item) => ({ role: item.role, content: String(item.content || item.japanese || "").slice(0, 500) }));
    turns.push({ role: "user", content: text.slice(0, 900) });
    state.session.turns_json = JSON.stringify(turns.slice(-18)); state.session.updated_at = new Date().toISOString();
    try {
      await JapoDB.put("tutor_sessions", state.session);
      const settings = (await JapoDB.get("settings", "app"))?.value || {}, token = await window.CloudSync?.getAccessToken();
      if (!token) throw new Error("Inicia sesión para usar el Tutor IA.");
      const url = (settings.aiEndpoint || "https://japoteacher-ai.raul-nihongo.workers.dev/evaluate").replace(/\/evaluate$/, "/tutor");
      const response = await (window.JapoAiTransport?.fetch || fetch)(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Device-ID": window.CloudSync?.getDeviceId?.() || "" }, body: JSON.stringify({ operation: "conversation", mode: "ja_to_es", user_message: text, conversation: { goal: `${road(state.roadId).title}: ${goal(state.roadId, state.goalId).title}. ${goal(state.roadId, state.goalId).objective}`, memory: compactMemory(state.roadId, state.goalId), japanese_ratio: $("#tutorJapaneseRatio").value, messages: recent } }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || `Error HTTP ${response.status}`);
      const answer = result.conversation || {};
      turns.push({ role: "assistant", japanese: answer.reply_ja || "続けてください。", furigana: answer.reply_furigana || answer.reply_ja || "", translation: answer.reply_es || "", translation_visible: false, furigana_visible: false, note: answer.correction_es ? `${answer.correction_ja ? `${answer.correction_ja} · ` : ""}${answer.correction_es}` : answer.note_es || "" });
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
    document.addEventListener("japoteacher:navigate", (event) => { if (event.detail?.view === "tutor") { const selectedRoad = state.roadId; loadData().then(() => { renderRoads(); state.session = state.activeSessions[selectedRoad] || null; if (state.session) { state.roadId = state.session.road_id; state.goalId = state.session.goal_id; showPractice(); } else $("#tutorPractice").hidden = true; }); } });
  }
  document.addEventListener("DOMContentLoaded", () => init().catch((error) => { console.warn("Tutor:", error); window.UI?.toast?.("No se pudo cargar el recorrido del tutor."); }));
})();
