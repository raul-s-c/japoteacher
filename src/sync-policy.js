(function () {
  const USER_STORES = [
    "attempts",
    "exercise_progress",
    "tag_progress",
    "daily_sessions",
    "settings",
    "exercise_overrides",
    "news_articles",
    "news_answers",
    "lexical_cards",
    "lexical_progress",
    "lens_captures",
    "lens_messages",
  ];

  function hasRemoteUserData(payload) {
    const stores = payload?.stores || {};
    return USER_STORES.some((store) => Array.isArray(stores[store]) && stores[store].length > 0);
  }

  function firstSyncMode(accountKnown, remotePayload) {
    return !accountKnown && hasRemoteUserData(remotePayload) ? "remote" : "merge";
  }

  function defaultSettings(value = {}) {
    return (
      (value.profileName || "Estudiante") === "Estudiante" &&
      Number(value.dailyJaEs || 5) === 5 &&
      Number(value.dailyEsJa || 5) === 5 &&
      Number(value.cooldownDays || 14) === 14 &&
      Number(value.newRatio || 60) === 60 &&
      value.furigana !== true &&
      JSON.stringify(value.levels || ["N5", "N4"]) === JSON.stringify(["N5", "N4"])
    );
  }

  function publicSettings(value = {}) {
    const clean = { ...value };
    delete clean.apiKey;
    delete clean.proxyToken;
    return clean;
  }

  function recoverSettingsFromSessions(payload) {
    const stores = payload?.stores || {};
    const settings = Array.isArray(stores.settings) ? stores.settings : [];
    const current = settings.find((row) => row.key === "app");
    if (current && !defaultSettings(current.value)) return payload;

    const snapshots = (stores.daily_sessions || [])
      .map((session) => {
        try {
          return {
            value: JSON.parse(session.settings_snapshot_json || "{}"),
            at: session.created_at || session.started_at || `${session.local_date || ""}T00:00:00.000Z`,
          };
        } catch {
          return null;
        }
      })
      .filter((item) => item?.value && !defaultSettings(item.value))
      .sort((left, right) => String(right.at).localeCompare(String(left.at)));
    if (!snapshots.length) return payload;

    const recoveredAt = snapshots[0].at || new Date().toISOString();
    const recovered = {
      ...(current?.value || {}),
      ...publicSettings(snapshots[0].value),
      settingsTouchedAt: recoveredAt,
      settingsRecoveredAt: new Date().toISOString(),
    };
    return {
      ...payload,
      stores: {
        ...stores,
        settings: [
          ...settings.filter((row) => row.key !== "app"),
          { key: "app", value: recovered, updated_at: recoveredAt },
        ],
      },
    };
  }

  window.SyncPolicy = {
    hasRemoteUserData,
    firstSyncMode,
    recoverSettingsFromSessions,
  };
})();
