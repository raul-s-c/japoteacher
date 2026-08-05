(function () {
  const URL = "data/jlpt-items.full.json";
  const REQUIRED = ["item_id", "jlpt_level", "layer", "item_type", "question_es", "options", "correct_option", "dataset_version"];
  function assertItem(item, datasetVersion) {
    const missing = REQUIRED.filter((field) => !(field in item));
    if (missing.length) throw new Error(`${item.item_id || "Ítem sin ID"}: faltan ${missing.join(", ")}`);
    if (!/^JLPT-(N5|N4)-[A-Z_]+-\d{4}$/.test(item.item_id)) throw new Error(`Identificador JLPT inválido: ${item.item_id}`);
    if (item.dataset_version !== datasetVersion) throw new Error(`${item.item_id}: versión de contenido incoherente`);
    if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 4) throw new Error(`${item.item_id}: opciones inválidas`);
    if (item.correct_option < 0 || item.correct_option >= item.options.length) throw new Error(`${item.item_id}: respuesta correcta fuera de rango`);
  }
  async function seed() {
    const response = await fetch(URL, { cache: "no-cache" });
    if (!response.ok) throw new Error("No se pudo cargar el banco JLPT completo");
    const payload = await response.json();
    if (!payload?.dataset_version || !Array.isArray(payload.items)) throw new Error("Manifiesto JLPT inválido");
    payload.items.forEach((item) => assertItem(item, payload.dataset_version));
    const identifiers = new Set(payload.items.map((item) => item.item_id));
    if (identifiers.size !== payload.items.length) throw new Error("El banco JLPT contiene IDs duplicados");
    const current = await JapoDB.all("jlpt_items");
    const unchanged = current.length === payload.items.length && current.every((item) => item.dataset_version === payload.dataset_version && identifiers.has(item.item_id));
    if (!unchanged) {
      const archived = current.filter((item) => item.item_id.startsWith("JLPT-") && !identifiers.has(item.item_id)).map((item) => ({ ...item, active: false }));
      await JapoDB.bulkPut("jlpt_items", [...archived, ...payload.items]);
    }
    document.documentElement.dataset.jlptDatasetVersion = payload.dataset_version;
    document.documentElement.dataset.jlptItemCount = String(payload.items.length);
    return { datasetVersion: payload.dataset_version, active: payload.items.filter((item) => item.active).length };
  }
  window.JLPTContent = { seed };
  document.addEventListener("DOMContentLoaded", () => {
    JapoDB.open().then(seed).catch((error) => {
      console.error("No se pudo preparar el banco JLPT", error);
      document.documentElement.dataset.jlptContentError = error.message;
    });
  });
})();
