(function () {
  const MAX_FILES = 5, MAX_EDGE = 1600, MAX_BYTES = 3 * 1024 * 1024;
  const $ = (selector) => document.querySelector(selector);
  const state = { files: [] };
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  function setStatus(message = "", error = false) { const node = $("#issueReportStatus"); node.textContent = message; node.classList.toggle("error", error); }
  function open() { $("#issueReportModal").hidden = false; $("#issueReportComment").focus(); }
  function close() { $("#issueReportModal").hidden = true; }
  function render() { $("#issuePreviewList").innerHTML = state.files.map((item, index) => `<div class="issue-preview"><img src="${item.dataUrl}" alt="Pantallazo ${index + 1}"><button type="button" data-remove-issue-file="${index}" aria-label="Quitar pantallazo ${index + 1}">×</button></div>`).join(""); }
  function read(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
  async function compress(file) {
    if (!file.type.startsWith("image/")) throw new Error("Sólo se pueden adjuntar imágenes.");
    const source = await read(file), image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("No se pudo leer uno de los pantallazos.")); image.src = source; });
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)), canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale)); canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale)); canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", .82); if (Math.ceil(dataUrl.length * .75) > MAX_BYTES) throw new Error("Un pantallazo sigue siendo demasiado grande tras reducirlo.");
    return { name: `${file.name.replace(/\.[^.]+$/, "") || "pantallazo"}.jpg`, dataUrl, contentType: "image/jpeg" };
  }
  function blob(dataUrl) { const [header, encoded] = dataUrl.split(","), mime = header.match(/data:([^;]+)/)?.[1] || "image/jpeg", binary = atob(encoded), bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return new Blob([bytes], { type: mime }); }
  async function request(body) {
    const token = await window.CloudSync?.getAccessToken(); if (!token) throw new Error("Inicia sesión para enviar una incidencia.");
    const settings = (await JapoDB.get("settings", "app"))?.value || {}, endpoint = (settings.aiEndpoint || "").replace(/\/evaluate$/, "/issue-reports"); if (!endpoint) throw new Error("Falta la URL del Worker.");
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Device-ID": window.CloudSync?.getDeviceId?.() || "" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se pudo guardar la incidencia."); return data;
  }
  async function send(report) {
    const client = window.CloudSync?.getClient?.(), userId = window.CloudSync?.getUserId?.(); if (!client || !userId) throw new Error("Inicia sesión para enviar una incidencia.");
    const attachments = [];
    for (let index = 0; index < report.files.length; index += 1) { const file = report.files[index], path = `${userId}/${report.report_id}/${String(index + 1).padStart(2, "0")}-${file.name}`, { error } = await client.storage.from("issue-reports").upload(path, blob(file.dataUrl), { contentType: file.contentType, upsert: true }); if (error) throw new Error(`No se pudo subir un pantallazo: ${error.message}`); attachments.push({ path, name: file.name, content_type: file.contentType }); }
    await request({ report_id: report.report_id, comment: report.comment, page: location.hash.slice(1) || "hoy", attachments, app_version: "2026.08.13" }); await JapoDB.delete("issue_reports", report.report_id);
  }
  async function flushPending() { if (!navigator.onLine || !window.CloudSync?.getUserId?.()) return; const pending = (await JapoDB.all("issue_reports")).filter((item) => item.status === "pending"); for (const report of pending) { try { await send(report); } catch { break; } } }
  async function submit(event) { event.preventDefault(); const comment = $("#issueReportComment").value.trim(); if (!comment) return setStatus("Escribe un comentario para poder investigar la incidencia.", true); const report = { report_id: uuid(), comment, files: state.files, status: "pending", created_at: new Date().toISOString() }, button = $("#submitIssueReport"); button.disabled = true; setStatus("Guardando incidencia y adjuntos…"); try { await JapoDB.put("issue_reports", report); await send(report); $("#issueReportForm").reset(); state.files = []; render(); close(); window.UI?.toast("Incidencia enviada. Gracias: la revisaré en el buzón del proyecto."); } catch (error) { setStatus(`${error.message} La incidencia queda guardada en este dispositivo y se reintentará al recuperar la conexión.`, true); } finally { button.disabled = false; } }
  document.addEventListener("DOMContentLoaded", () => { $("#reportIssueButton")?.addEventListener("click", open); $("#closeIssueReport")?.addEventListener("click", close); $("#cancelIssueReport")?.addEventListener("click", close); $("#issueReportModal")?.addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); }); $("#issueReportFiles")?.addEventListener("change", async (event) => { const incoming = [...event.target.files].slice(0, MAX_FILES - state.files.length); try { for (const file of incoming) state.files.push(await compress(file)); render(); setStatus(""); } catch (error) { setStatus(error.message, true); } event.target.value = ""; }); $("#issuePreviewList")?.addEventListener("click", (event) => { const button = event.target.closest("[data-remove-issue-file]"); if (button) { state.files.splice(Number(button.dataset.removeIssueFile), 1); render(); } }); $("#issueReportForm")?.addEventListener("submit", submit); window.addEventListener("online", () => flushPending().catch(() => {})); setTimeout(() => flushPending().catch(() => {}), 1800); });
})();
