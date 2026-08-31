(function () {
  const DB_NAME = "japoteacher";
  const VERSION = 8;
  const stores = {
    exercises: "exercise_id",
    attempts: "attempt_id",
    exercise_progress: "progress_id",
    tag_progress: "tag_progress_id",
    daily_sessions: "session_id",
    settings: "key",
    import_history: "import_id",
    learning_reports: "report_id",
    issue_reports: "report_id",
    exercise_overrides: "exercise_id",
    news_articles: "article_id",
    news_answers: "answer_id",
    lexical_cards: "card_id",
    lexical_progress: "progress_id",
    lens_captures: "capture_id",
    lens_messages: "message_id",
  };
  let dbPromise;
  let syncBatchDepth = 0;
  let syncPending = false;
  const syncStores = ["exercises", "attempts", "exercise_progress", "tag_progress", "daily_sessions", "settings", "exercise_overrides", "news_articles", "news_answers", "lexical_cards", "lexical_progress", "lens_captures", "lens_messages"];
  const isEditorialExercise = (row) => row.sync_scope === "editorial" || /^(?:JAES|ESJA)-N[1-5]-(?:\d{4}|(?:EXP|MORE|CURATED|ORGANIC|EDITORIAL)-)/.test(String(row.exercise_id || ""));
  const validLevel = (level) => ["N5", "N4", "N3", "N2", "N1"].includes(level);
  function applyExerciseOverride(row, override) {
    if (!row || !override) return row;
    const difficulty = Number(override.difficulty);
    const hasCalibration = validLevel(override.jlpt_level) || Number.isFinite(difficulty);
    return {
      ...row,
      original_jlpt_level: hasCalibration ? row.original_jlpt_level || row.jlpt_level : row.original_jlpt_level,
      original_difficulty: hasCalibration ? row.original_difficulty ?? row.difficulty : row.original_difficulty,
      jlpt_level: validLevel(override.jlpt_level) ? override.jlpt_level : row.jlpt_level,
      difficulty: Number.isFinite(difficulty) ? Math.max(0, Math.min(100, Math.round(difficulty))) : row.difficulty,
      active: override.blocked_by_user ? false : row.active,
      manual_calibration: hasCalibration,
      manual_calibration_reason: override.reason || "",
      manual_calibrated_at: override.updated_at || "",
      blocked_by_user: Boolean(override.blocked_by_user),
      blocked_reason: override.blocked_reason || "",
      blocked_at: override.blocked_at || "",
      user_filter_tag: override.user_filter_tag || "",
    };
  }
  const changed = () => document.dispatchEvent(new CustomEvent("japoteacher:db-write"));
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        Object.entries(stores).forEach(([name, keyPath]) => {
          if (!db.objectStoreNames.contains(name))
            db.createObjectStore(name, { keyPath });
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  async function tx(store, mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      let result;
      try {
        result = action(os);
      } catch (e) {
        reject(e);
        return;
      }
      t.oncomplete = () =>
        resolve(
          typeof IDBRequest !== "undefined" && result instanceof IDBRequest
            ? result.result
            : result,
        );
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  async function syncAfterWrite() {
    if (!window.CloudSync?.commit) return;
    if (syncBatchDepth) {
      syncPending = true;
      return;
    }
    await window.CloudSync.commit();
  }
  const write = async (store, action) => {
    const result = await tx(store, "readwrite", action);
    changed();
    if (store !== "import_history" && store !== "learning_reports" && store !== "issue_reports") await syncAfterWrite();
    return result;
  };
  const allRaw = (s) => tx(s, "readonly", (o) => o.getAll());
  async function exerciseWithOverride(id) {
    const [row, override] = await Promise.all([tx("exercises", "readonly", (o) => o.get(id)), tx("exercise_overrides", "readonly", (o) => o.get(id))]);
    return applyExerciseOverride(row, override);
  }
  async function exercisesWithOverrides() {
    const [rows, overrides] = await Promise.all([allRaw("exercises"), allRaw("exercise_overrides")]);
    const byId = new Map(overrides.map((row) => [row.exercise_id, row]));
    return rows.map((row) => applyExerciseOverride(row, byId.get(row.exercise_id)));
  }
  function normalizeWrite(store, value) {
    if (store !== "attempts" || !value || value.ranked_xp_version || value.ranked_xp_policy) return value;
    return { ...value, ranked_xp_policy: "guided_usability_v2" };
  }
  const api = {
    open,
    get: (s, k) => s === "exercises" ? exerciseWithOverride(k) : tx(s, "readonly", (o) => o.get(k)),
    all: (s) => s === "exercises" ? exercisesWithOverrides() : allRaw(s),
    put: (s, v) => write(s, (o) => o.put(normalizeWrite(s, v))),
    bulkPut: (s, vs) =>
      write(s, (o) => {
        vs.forEach((v) => o.put(v));
        return vs.length;
      }),
    delete: (s, k) => write(s, (o) => o.delete(k)),
    clear: (s) => write(s, (o) => o.clear()),
    async batch(action) {
      syncBatchDepth++;
      try {
        return await action();
      } finally {
        syncBatchDepth--;
        if (!syncBatchDepth && syncPending) {
          syncPending = false;
          await syncAfterWrite();
        }
      }
    },
    stores: Object.keys(stores),
    syncStores,
    async clearProfileData() {
      for (const s of [
        "attempts",
        "exercise_progress",
        "tag_progress",
        "daily_sessions",
        "learning_reports",
        "exercise_overrides",
        "news_articles",
        "news_answers",
        "lexical_cards",
        "lexical_progress",
        "lens_captures",
        "lens_messages",
      ])
        await api.clear(s);
    },
    async clearUserData() {
      for (const store of ["attempts", "exercise_progress", "tag_progress", "daily_sessions", "learning_reports", "settings", "exercise_overrides", "news_articles", "news_answers", "lexical_cards", "lexical_progress", "lens_captures", "lens_messages"])
        await api.clear(store);
    },
    async backup() {
      const out = {
        schema_version: 2,
        exported_at: new Date().toISOString(),
        stores: {},
      };
      for (const s of api.stores) {
        if (s === "issue_reports") continue;
        const rows = await allRaw(s);
        out.stores[s] =
          s === "settings"
            ? rows.map((row) => {
                const value = { ...(row.value || {}) };
                delete value.apiKey;
                delete value.proxyToken;
                return { ...row, value };
              })
            : rows;
      }
      return out;
    },
    async syncBackup() {
      const out = { schema_version: 3, exported_at: new Date().toISOString(), stores: {} };
      for (const store of syncStores) {
        const rows = await allRaw(store);
        out.stores[store] = store === "exercises" ? rows.filter((row) => !isEditorialExercise(row)) : store === "settings" ? rows.map((row) => { const value = { ...(row.value || {}) }; delete value.apiKey; delete value.proxyToken; return { ...row, value }; }) : rows;
      }
      return out;
    },
    async restore(data) {
      if (!data?.stores) throw new Error("Copia remota no válida");
      for (const store of api.stores) {
        if (store === "issue_reports") continue;
        await tx(store, "readwrite", (o) => {
          o.clear();
          for (const row of data.stores[store] || []) o.put(row);
        });
      }
      changed();
    },
    async restoreSync(data) {
      if (!data?.stores) throw new Error("Copia remota no válida");
      for (const store of syncStores) {
        const rows = data.stores[store] || [];
        if (store === "exercises") {
          await tx(store, "readwrite", (objectStore) => rows.forEach((row) => objectStore.put(row)));
          continue;
        }
        await tx(store, "readwrite", (objectStore) => {
          objectStore.clear();
          rows.forEach((row) => objectStore.put(row));
        });
      }
      changed();
    },
  };
  document.documentElement.dataset.dbVersion = String(VERSION);
  document.documentElement.dataset.dbStores = api.stores.join(",");
  window.JapoDB = api;
})();
