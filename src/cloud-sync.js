(function () {
  const config = window.JAPOTEACHER_SUPABASE;
  const client = window.supabase.createClient(
    config.url,
    config.publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
  let user = null,
    revision = 0,
    ready = false,
    restoring = false,
    resolveInitialSync;
  let commitQueue = Promise.resolve();
  const deviceId =
    localStorage.getItem("japoteacher_device_id") || crypto.randomUUID();
  localStorage.setItem("japoteacher_device_id", deviceId);
  const platform =
    navigator.userAgentData?.platform || navigator.platform || "Dispositivo";
  const deviceName = `${/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "Móvil" : "Ordenador"} · ${platform}`;
  const initialSync = new Promise((resolve) => {
    resolveInitialSync = resolve;
  });
  const $ = (s) => document.querySelector(s);
  const keyFor = {
    exercises: "exercise_id",
    attempts: "attempt_id",
    exercise_progress: "progress_id",
    tag_progress: "tag_progress_id",
    daily_sessions: "session_id",
    settings: "key",
    import_history: "import_id",
    learning_reports: "report_id",
  };
  function status(message, tone = "") {
    const el = $("#cloudStatus");
    if (el) {
      el.textContent = message;
      el.dataset.tone = tone;
    }
  }
  function render() {
    const signed = Boolean(user);
    $("#authSignedOut").hidden = signed;
    $("#authSignedIn").hidden = !signed;
    if (signed) $("#authUserEmail").textContent = user.email || "Usuario";
    status(
      signed
        ? "Comprobando estado remoto…"
        : "Inicia sesión para guardar el progreso",
    );
  }
  function lock(owner) {
    ready = false;
    $("#sessionLockMessage").textContent =
      `Ahora está siendo utilizada en ${owner || "otro dispositivo"}. ¿Quieres cerrar esa sesión y traer el progreso aquí?`;
    $("#sessionLock").hidden = false;
  }
  function unlock() {
    $("#sessionLock").hidden = true;
  }
  function newer(a, b, field) {
    if (!a) return b;
    if (!b) return a;
    return String(a[field] || "") >= String(b[field] || "") ? a : b;
  }
  function unionRows(local = [], remote = [], key, chooser) {
    const rows = new Map(remote.map((row) => [row[key], row]));
    for (const row of local) {
      const previous = rows.get(row[key]);
      rows.set(
        row[key],
        previous ? (chooser ? chooser(row, previous) : row) : row,
      );
    }
    return [...rows.values()];
  }
  function mergeSession(local, remote) {
    const completed = [
        ...new Set([
          ...JSON.parse(remote.completed_exercise_ids_json || "[]"),
          ...JSON.parse(local.completed_exercise_ids_json || "[]"),
        ]),
      ],
      drafts = {
        ...JSON.parse(remote.drafts_json || "{}"),
        ...JSON.parse(local.drafts_json || "{}"),
      },
      total = Math.max(
        (local.planned_ja_es || 0) + (local.planned_es_ja || 0),
        (remote.planned_ja_es || 0) + (remote.planned_es_ja || 0),
      );
    return {
      ...remote,
      ...local,
      created_at: [local.created_at, remote.created_at]
        .filter(Boolean)
        .sort()[0],
      started_at:
        [local.started_at, remote.started_at].filter(Boolean).sort()[0] || null,
      completed_at:
        completed.length >= total
          ? local.completed_at ||
            remote.completed_at ||
            new Date().toISOString()
          : null,
      status:
        completed.length >= total
          ? "completed"
          : completed.length
            ? "in_progress"
            : "planned",
      completed_exercise_ids_json: JSON.stringify(completed),
      drafts_json: JSON.stringify(drafts),
    };
  }
  function merge(local, remote) {
    const out = {
      schema_version: 2,
      exported_at: new Date().toISOString(),
      stores: {},
    };
    for (const store of JapoDB.stores) {
      const l = local.stores[store] || [],
        r = remote.stores[store] || [],
        key = keyFor[store];
      if (
        store === "attempts" ||
        store === "exercises" ||
        store === "import_history" ||
        store === "learning_reports"
      )
        out.stores[store] = unionRows(l, r, key);
      else if (store === "daily_sessions")
        out.stores[store] = unionRows(l, r, key, mergeSession);
      else if (store === "exercise_progress")
        out.stores[store] = unionRows(l, r, key, (a, b) =>
          newer(a, b, "last_seen_at"),
        );
      else if (store === "tag_progress")
        out.stores[store] = unionRows(l, r, key, (a, b) =>
          (a.attempts_count || 0) >= (b.attempts_count || 0) ? a : b,
        );
      else if (store === "settings")
        out.stores[store] = unionRows(l, r, key, (a, b) =>
          newer(a, b, "updated_at"),
        );
    }
    return out;
  }
  async function remoteState() {
    const { data, error } = await client
      .from("user_state")
      .select("payload,revision,active_device_id,active_device_name,active_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  async function claim(force = false) {
    const { data, error } = await client.rpc("claim_user_session", {
      p_device_id: deviceId,
      p_device_name: deviceName,
      p_force: force,
    });
    if (error) throw error;
    const result = data?.[0];
    if (!result?.claimed) {
      lock(result?.owner_name);
      return false;
    }
    revision = Number(result.out_revision || 0);
    ready = true;
    unlock();
    status(`Activo en ${deviceName} · revisión ${revision}`, "ok");
    return true;
  }
  async function atomicCommit() {
    if (!user || !ready || restoring) return;
    status("Guardando en la nube…");
    let payload = await JapoDB.backup();
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data, error } = await client.rpc("commit_user_state", {
        p_expected_revision: revision,
        p_payload: payload,
        p_device_id: deviceId,
      });
      if (error) throw error;
      const result = data?.[0];
      if (!result) throw new Error("Supabase no confirmó la escritura.");
      revision = Number(result.out_revision);
      if (!result.lease_granted) {
        lock(result.owner_name);
        throw new Error(
          `La sesión está activa en ${result.owner_name || "otro dispositivo"}.`,
        );
      }
      if (result.committed) {
        status(`Todo guardado · revisión ${revision}`, "ok");
        return;
      }
      payload = merge(payload, result.out_payload);
      restoring = true;
      await JapoDB.restore(payload);
      restoring = false;
    }
    throw new Error("No se pudo consolidar el cambio tras varios reintentos.");
  }
  function commit() {
    if (!user || !ready || restoring) return Promise.resolve();
    commitQueue = commitQueue
      .then(atomicCommit, atomicCommit)
      .catch((error) => {
        status(error.message || "No se pudo guardar", "error");
        throw error;
      });
    return commitQueue;
  }
  async function initializeState() {
    if (!(await claim(false))) return;
    const local = await JapoDB.backup(),
      remote = await remoteState();
    revision = Number(remote?.revision || 0);
    const combined = merge(local, remote?.payload || { stores: {} });
    restoring = true;
    await JapoDB.restore(combined);
    restoring = false;
    ready = true;
    if (
      JSON.stringify(combined.stores) !==
      JSON.stringify(remote?.payload?.stores || {})
    )
      await commit();
    else status(`Todo guardado · revisión ${revision}`, "ok");
  }
  async function refresh() {
    if (!user || !ready || restoring) return;
    await commitQueue;
    const remote = await remoteState();
    if (remote?.active_device_id && remote.active_device_id !== deviceId) {
      lock(remote.active_device_name);
      return;
    }
    if (!remote || Number(remote.revision) <= revision) return;
    revision = Number(remote.revision);
    const combined = merge(await JapoDB.backup(), remote.payload);
    restoring = true;
    await JapoDB.restore(combined);
    restoring = false;
    status(`Actualizado · revisión ${revision}`, "ok");
    location.reload();
  }
  async function signUp() {
    const email = $("#authEmail").value.trim(),
      password = $("#authPassword").value;
    if (!email || password.length < 8) {
      status(
        "Introduce un email y una contraseña de al menos 8 caracteres",
        "error",
      );
      return;
    }
    status("Creando cuenta…");
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) {
      status(error.message, "error");
      return;
    }
    if (!data.session) status("Revisa tu email para confirmar la cuenta", "ok");
  }
  async function signIn() {
    const email = $("#authEmail").value.trim(),
      password = $("#authPassword").value;
    status("Iniciando sesión…");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) status(error.message, "error");
  }
  async function signOut() {
    ready = false;
    if (user)
      await client.rpc("release_user_session", { p_device_id: deviceId });
    unlock();
    await client.auth.signOut();
  }
  async function getAccessToken() {
    const { data } = await client.auth.getSession();
    return data.session?.access_token || "";
  }
  async function init() {
    try {
      const { data } = await client.auth.getSession();
      user = data.session?.user || null;
      render();
      $("#signUpButton").addEventListener("click", signUp);
      $("#signInButton").addEventListener("click", signIn);
      $("#signOutButton").addEventListener("click", signOut);
      $("#sessionLockSignOut").addEventListener("click", signOut);
      $("#takeSessionButton").addEventListener("click", async () => {
        if (await claim(true)) {
          await initializeState();
          location.reload();
        }
      });
      client.auth.onAuthStateChange((event, session) => {
        const previous = user?.id;
        user = session?.user || null;
        render();
        if (user && user.id !== previous)
          setTimeout(
            () =>
              initializeState()
                .then(() => {
                  if (ready) location.reload();
                })
                .catch((e) => status(e.message, "error")),
            0,
          );
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible")
          refresh().catch((e) => status(e.message, "error"));
      });
      window.addEventListener("online", () =>
        refresh().catch((e) => status(e.message, "error")),
      );
      setInterval(() => {
        if (user && ready)
          client
            .rpc("heartbeat_user_session", { p_device_id: deviceId })
            .then(({ data }) => {
              if (data !== true) refresh().catch(() => {});
            })
            .catch(() => {});
      }, 4000);
      if (user) await initializeState();
    } finally {
      resolveInitialSync();
    }
  }
  window.CloudSync = {
    commit,
    getAccessToken,
    getDeviceId: () => deviceId,
    refresh,
    initialSync,
  };
  document.addEventListener("DOMContentLoaded", () =>
    init().catch((e) => status(e.message, "error")),
  );
})();
