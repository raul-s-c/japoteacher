import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function policy() {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(new URL("../src/sync-policy.js", import.meta.url), "utf8"),
    context,
  );
  return context.window.SyncPolicy;
}

test("a new installation restores an existing account before merging local defaults", () => {
  const sync = policy();
  const remote = {
    stores: {
      settings: [{ key: "app", value: { dailyJaEs: 15, dailyEsJa: 7 } }],
      attempts: [{ attempt_id: "remote-attempt" }],
    },
  };
  assert.equal(sync.firstSyncMode(false, remote), "remote");
});

test("a known device keeps normal bidirectional merging", () => {
  const sync = policy();
  const remote = { stores: { attempts: [{ attempt_id: "remote-attempt" }] } };
  assert.equal(sync.firstSyncMode(true, remote), "merge");
});

test("a genuinely empty account may adopt local progress", () => {
  const sync = policy();
  assert.equal(sync.firstSyncMode(false, { stores: {} }), "merge");
});

test("a stale lease from the same mobile class can recover automatically", () => {
  const sync = policy();
  const now = Date.parse("2026-09-03T12:00:30Z");
  assert.equal(sync.canRecoverSameDeviceLease("Móvil · Android", "Móvil · Android", "2026-09-03T12:00:00Z", now), true);
  assert.equal(sync.canRecoverSameDeviceLease("Móvil · Android", "Móvil · Android", "2026-09-03T12:00:20Z", now), false);
  assert.equal(sync.canRecoverSameDeviceLease("Ordenador · Win32", "Móvil · Android", "2026-09-03T12:00:00Z", now), false);
});

test("factory settings are recovered from the latest customized daily session", () => {
  const sync = policy();
  const payload = {
    stores: {
      settings: [{ key: "app", value: { dailyJaEs: 5, dailyEsJa: 5, levels: ["N5", "N4"] } }],
      daily_sessions: [
        {
          session_id: "old",
          created_at: "2026-08-01T08:00:00Z",
          settings_snapshot_json: JSON.stringify({ dailyJaEs: 12, dailyEsJa: 4, levels: ["N5"] }),
        },
        {
          session_id: "latest",
          created_at: "2026-08-29T08:00:00Z",
          settings_snapshot_json: JSON.stringify({ dailyJaEs: 20, dailyEsJa: 7, levels: ["N5", "N4"], furigana: true, proxyToken: "secret" }),
        },
      ],
    },
  };
  const recovered = sync.recoverSettingsFromSessions(payload).stores.settings[0].value;
  assert.equal(recovered.dailyJaEs, 20);
  assert.equal(recovered.dailyEsJa, 7);
  assert.equal(recovered.furigana, true);
  assert.equal("proxyToken" in recovered, false);
});

test("explicit non-default settings are never replaced by session history", () => {
  const sync = policy();
  const payload = {
    stores: {
      settings: [{ key: "app", value: { dailyJaEs: 18, dailyEsJa: 6, levels: ["N5", "N4"] } }],
      daily_sessions: [{ settings_snapshot_json: JSON.stringify({ dailyJaEs: 20, dailyEsJa: 7 }) }],
    },
  };
  assert.equal(sync.recoverSettingsFromSessions(payload), payload);
});
