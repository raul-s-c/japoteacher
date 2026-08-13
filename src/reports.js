(function () {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const directionName = (direction) => direction === "ja_es" ? "Japonés a español" : "Español a japonés";
  const periodLabel = (value) => new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const metric = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const localId = (report) => report.remote_report_id || report.report_id || `${report.report_type}:${String(report.period_start).slice(0, 10)}:${String(report.period_end).slice(0, 10)}:${report.revision || 1}`;

  // Manual reports use an explicit rolling window; scheduled reports are closed calendar periods.
  function period(type, date = new Date()) {
    const end = new Date(date), start = new Date(date);
    if (type === "weekly") start.setDate(end.getDate() - 6);
    else { start.setDate(1); start.setMonth(start.getMonth() - 1); end.setDate(0); }
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  async function ensureDraft(type) {
    const range = period(type), id = `${type}:${range.start.slice(0, 10)}:${range.end.slice(0, 10)}`;
    if (await JapoDB.get("learning_reports", id)) return;
    const attempts = (await JapoDB.all("attempts")).filter((item) => item.evaluation_status === "valid" && item.attempted_at >= range.start && item.attempted_at <= range.end);
    if (!attempts.length) return;
    const direction_metrics = Object.fromEntries(["ja_es", "es_ja"].map((direction) => {
      const items = attempts.filter((item) => item.direction === direction);
      return [direction, { count: items.length, average: items.length ? Math.round(items.reduce((sum, item) => sum + (item.overall_score || 0), 0) / items.length) : 0 }];
    }));
    await JapoDB.put("learning_reports", { report_id: id, report_type: type, period_start: range.start, period_end: range.end, created_at: new Date().toISOString(), status: "awaiting_ai", attempt_count: attempts.length, direction_metrics, summary: "", strengths: [], priority_structures: [], priority_vocabulary: [], action_plan: [], cumulative_progress: {}, previous_report_ids: [] });
  }
  async function ensureDue() { const now = new Date(); if (now.getDay() === 0) await ensureDraft("weekly"); if (now.getDate() === 1) await ensureDraft("monthly"); }
  async function request(path, body = {}) {
    const token = await window.CloudSync?.getAccessToken();
    if (!token) throw new Error("Inicia sesión para generar y conservar informes.");
    const settings = (await JapoDB.get("settings", "app"))?.value || {};
    const endpoint = (settings.aiEndpoint || "").replace(/\/evaluate$/, path);
    if (!endpoint) throw new Error("Falta la URL del Worker.");
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Device-ID": window.CloudSync?.getDeviceId?.() || "" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo generar el informe.");
    return data;
  }
  function reportError(error) { return `No se pudo generar el informe: ${String(error?.message || "No se pudo generar el informe.").replace(/^Supabase reports:\s*/, "")}`; }
  function list(values, empty) { return values?.length ? `<ul>${values.map((value) => `<li>${esc(typeof value === "string" ? value : value.title || "")}</li>`).join("")}</ul>` : `<p class="empty">${empty}</p>`; }
  function profileValues(item) { return [["Comprensión", item?.comprehensibility], ["Precisión", item?.objective], ["Gramática", item?.grammar], ["Léxico", item?.vocabulary], ["Naturalidad", item?.naturalness]].filter(([, value]) => value != null && Number.isFinite(Number(value))).map(([label, value]) => [label, metric(value)]); }
  function levelEvidence(item) {
    const context = item?.level_context || {}, difficulty = context.by_level?.find((level) => level.level === context.working_level)?.average_difficulty, gaps = context.promotion_gaps || [];
    return `<div class="report-level-evidence"><strong>Nivel trabajado: ${esc(context.working_level || "Sin nivel")}</strong><span>${esc(context.working_status || "Sin evidencia")} · ${difficulty == null ? "dificultad sin registrar" : `dificultad media ${metric(difficulty)}/100 (${esc(context.difficulty_band || "")})`}</span>${gaps.length ? `<p>Para avanzar: ${esc(gaps.join(" · "))}</p>` : ""}</div>`;
  }
  function directionPanel(direction, item) {
    const score = metric(item?.average), values = profileValues(item || {}), rows = values.length ? `<div class="report-skill-rows">${values.map(([label, value]) => `<div><span>${label}</span><i><b style="width:${value}%"></b></i><em>${value}</em></div>`).join("")}</div>` : '<p class="report-metric-note">Sin desglose fiable por competencia en estas respuestas.</p>';
    return `<section class="report-direction-panel ${direction}"><div class="report-direction-top"><div><p>${direction === "ja_es" ? "Comprender japonés" : "Producir japonés"}</p><h5>${directionName(direction)}</h5></div><strong>${score}<small>/100</small></strong></div><span class="report-attempts">${item?.count || 0} respuestas evaluadas</span>${levelEvidence(item)}${rows}</section>`;
  }
  function readyBody(report) {
    const assessment = report.teacher_assessment || report.cumulative_progress?.teacher_assessment || {}, diagnosis = assessment.narrative || report.summary || "Aún no hay una valoración narrativa para este periodo.", headline = assessment.headline || "Lectura del periodo", vocabulary = report.vocabulary_focus || report.cumulative_progress?.vocabulary_focus || [];
    const vocabularyHtml = vocabulary.length ? `<section class="report-vocabulary-evidence"><p>Vocabulario observado</p><div>${vocabulary.map((item) => `<article><strong>${esc(item.term)}</strong><span>${esc(item.diagnosis)}</span><b>${esc(item.practice)}</b></article>`).join("")}</div></section>` : "";
    const actions = report.action_plan?.length ? `<div class="report-actions-list">${report.action_plan.map((action, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(action.title)}</strong><p>${esc(action.reason)}</p><small>${esc(action.evidence || "")}</small><b>${esc(action.target)}</b></div></article>`).join("")}</div>` : '<p class="empty">No hay acciones adicionales para este periodo.</p>';
    return `<section class="report-teacher-note"><p>Valoración docente</p><h5>${esc(headline)}</h5><p>${esc(diagnosis)}</p></section><section class="report-profile"><div><p class="report-section-label">Perfil de competencia</p><h5>Radiografía de las dos direcciones</h5><p>El gráfico sólo aparece cuando las respuestas aportan un desglose independiente por competencia.</p></div><canvas class="report-profile-canvas" width="320" height="210" data-profile='${esc(JSON.stringify(report.direction_metrics || {}))}' aria-label="Perfil de competencia"></canvas></section><div class="report-insights"><section><p>Fortalezas</p>${list(report.strengths, "Todavía no hay fortalezas consolidadas.")}</section><section><p>Intervención gramatical</p>${list(report.priority_structures, "Sin prioridad gramatical nueva.")}</section><section><p>Vocabulario y precisión</p>${list(report.priority_vocabulary, "Sin prioridad léxica nueva.")}</section></div>${vocabularyHtml}<section class="report-plan"><div><p class="report-section-label">Itinerario recomendado</p><h5>Próximas sesiones</h5><p>Un plan breve, observable y medible para el siguiente periodo.</p></div>${actions}</section><section class="report-trend"><span>Tendencia acumulada</span><p>${esc(report.cumulative_progress?.trend || "El próximo informe podrá comparar esta línea base con tu evolución.")}</p></section>`;
  }
  function drawProfiles(root) {
    root.querySelectorAll(".report-profile-canvas").forEach((canvas) => {
      let data = {}; try { data = JSON.parse(canvas.dataset.profile || "{}"); } catch {}
      const labels = ["Comprensión", "Precisión", "Gramática", "Léxico", "Naturalidad"], ja = profileValues(data.ja_es || {}), es = profileValues(data.es_ja || {}), values = labels.map((label) => { const available = [ja.find((item) => item[0] === label)?.[1], es.find((item) => item[0] === label)?.[1]].filter(Number.isFinite); return available.length ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : null; });
      if (values.some((value) => value == null)) { canvas.style.display = "none"; return; }
      canvas.style.display = "block";
      const ctx = canvas.getContext("2d"), width = canvas.width, height = canvas.height, centerX = width / 2, centerY = height / 2 + 8, radius = 72;
      ctx.clearRect(0, 0, width, height); ctx.font = "11px system-ui"; ctx.textAlign = "center";
      for (let ring = 1; ring <= 4; ring++) { ctx.beginPath(); labels.forEach((_, index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / labels.length, point = radius * ring / 4, x = centerX + Math.cos(angle) * point, y = centerY + Math.sin(angle) * point; index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.strokeStyle = "#d9dce0"; ctx.lineWidth = 1; ctx.stroke(); }
      labels.forEach((label, index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / labels.length, x = centerX + Math.cos(angle) * (radius + 25), y = centerY + Math.sin(angle) * (radius + 25); ctx.fillStyle = "#5d6269"; ctx.fillText(label, x, y + 4); });
      ctx.beginPath(); values.forEach((value, index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / labels.length, point = radius * value / 100, x = centerX + Math.cos(angle) * point, y = centerY + Math.sin(angle) * point; index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fillStyle = "rgba(181,43,33,.18)"; ctx.fill(); ctx.strokeStyle = "#b52b21"; ctx.lineWidth = 2; ctx.stroke();
    });
  }
  function reportCard(report, filter) {
    const directions = filter === "all" ? ["ja_es", "es_ja"] : [filter], label = report.report_type === "weekly" ? "Informe de los últimos 7 días" : "Informe mensual cerrado", average = directions.length ? Math.round(directions.reduce((sum, direction) => sum + (report.direction_metrics?.[direction]?.average || 0), 0) / directions.length) : 0, generated = report.generated_at ? new Date(report.generated_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "", remove = report.remote_report_id ? `<button class="icon-button report-delete" data-report-id="${esc(report.remote_report_id)}" type="button" title="Eliminar este informe" aria-label="Eliminar este informe">×</button>` : "";
    return `<article class="learning-report-card ${report.status}"><header class="report-document-head"><div><p>${label} · revisión ${report.revision || 1}</p><h4>${periodLabel(report.period_start)} - ${periodLabel(report.period_end)}</h4>${generated ? `<small class="report-generated">Generado ${esc(generated)}</small>` : ""}</div><div><strong>${average}<small>/100</small></strong><span class="report-status ${report.status}">${report.status === "ready" ? "Preparado" : report.status === "failed" ? "No disponible" : report.status === "generating" ? "Elaborando" : "En espera"}</span>${remove}</div></header><div class="report-direction-grid">${directions.map((direction) => directionPanel(direction, report.direction_metrics?.[direction])).join("")}</div>${report.status === "ready" ? readyBody(report) : `<p class="empty report-pending">${report.status === "failed" ? esc(report.error_message || "No se pudo generar el informe.") : "Estamos reuniendo la evidencia necesaria para elaborar una valoración útil."}</p>`}</article>`;
  }
  async function render(filter = "all") { const root = document.querySelector("#learningReports"); if (!root) return; const reports = (await JapoDB.all("learning_reports")).sort((a, b) => String(b.generated_at || b.period_end).localeCompare(String(a.generated_at || a.period_end)) || Number(b.revision || 0) - Number(a.revision || 0)); root.innerHTML = reports.length ? reports.map((report) => reportCard(report, filter)).join("") : '<p class="empty">Genera un informe cuando tengas práctica suficiente; se guardará en tu cuenta.</p>'; drawProfiles(root); }
  async function sync() { try { const { reports = [] } = await request("/reports/list"), remoteIds = new Set(reports.map(localId)), local = await JapoDB.all("learning_reports"); await JapoDB.bulkPut("learning_reports", reports.map((report) => ({ ...report, report_id: localId(report) }))); for (const report of local) if (report.remote_report_id && (!remoteIds.has(report.remote_report_id) || report.report_id !== report.remote_report_id)) await JapoDB.delete("learning_reports", report.report_id); } catch (error) { if (!/Inicia sesión/.test(error.message)) console.warn(error); } }
  async function generate(type) { const button = document.querySelector("#generateReportButton"); if (button) { button.disabled = true; button.textContent = "Elaborando informe..."; } try { const { report } = await request("/reports/generate", { report_type: type, ad_hoc: type === "weekly", force: true }); await JapoDB.put("learning_reports", { ...report, report_id: localId(report) }); await render(document.querySelector("#progressDirection")?.value || "all"); window.UI.toast(report.attempt_count < 3 ? "Informe guardado: falta más evidencia para conclusiones fiables." : "Informe pedagógico preparado"); } catch (error) { window.UI.toast(reportError(error)); } finally { if (button) { button.disabled = false; button.textContent = "Generar informe"; } } }
  async function remove(reportId) { if (!window.confirm("¿Eliminar este informe? Esta acción no se puede deshacer.")) return; try { const { deleted_report_id } = await request("/reports/delete", { report_id: reportId }); await JapoDB.delete("learning_reports", deleted_report_id); await render(document.querySelector("#progressDirection")?.value || "all"); window.UI.toast("Informe eliminado"); } catch (error) { window.UI.toast(reportError(error)); } }
  function print() { document.body.classList.add("print-learning-report"); window.print(); }
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("#generateReportButton")?.addEventListener("click", (event) => generate(event.currentTarget.dataset.reportType));
    document.querySelector("#reportType")?.addEventListener("change", (event) => { document.querySelector("#generateReportButton").dataset.reportType = event.target.value; });
    document.querySelector("#printReportButton")?.addEventListener("click", print);
    document.querySelector("#learningReports")?.addEventListener("click", (event) => { const button = event.target.closest(".report-delete"); if (button) remove(button.dataset.reportId); });
  });
  if (typeof window.addEventListener === "function") window.addEventListener("afterprint", () => document.body.classList.remove("print-learning-report"));
  window.LearningReports = { ensureDue, render, period, sync, generate };
})();
