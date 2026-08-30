import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const practiceTools = fs.readFileSync(new URL("../src/practice-tools.js", import.meta.url), "utf8");
const launcher = fs.readFileSync(
  new URL("../android/app/src/main/java/io/github/raul_s_c/japoteacher/LauncherActivity.java", import.meta.url),
  "utf8",
);

test("a normal launch starts on Today instead of restoring the Lens hash", () => {
  assert.match(launcher, /pendingLensPayload == null \? "#hoy" : "#lupa"/);
  assert.match(app, /initial=.*:'hoy'/);
  assert.doesNotMatch(launcher, /loadUrl\(APP_URL \+ "#lupa"\)/);
});

test("practice audio uses Android TTS and retains a checked web fallback", () => {
  assert.match(launcher, /TextToSpeech/);
  assert.match(launcher, /public boolean speakJapanese\(String text\)/);
  assert.match(launcher, /Locale\.JAPAN/);
  assert.match(practiceTools, /bridge\.speakJapanese\(text\)/);
  assert.match(practiceTools, /utterance\.onerror/);
  assert.match(practiceTools, /voiceschanged/);
});

test("the listen button sends the current Japanese sentence to Android", async () => {
  let clickHandler;
  let spoken = "";
  const source = { dataset: { exerciseId: "exercise-1" } };
  const button = {
    addEventListener(event, handler) { if (event === "click") clickHandler = handler; },
    setAttribute() {},
    removeAttribute() {},
  };
  const document = {
    addEventListener(event, handler) { if (event === "DOMContentLoaded") handler(); },
    querySelector(selector) {
      if (selector === "#sourceText") return source;
      if (selector === "#speakSourceButton") return button;
      return null;
    },
  };
  const context = {
    document,
    MutationObserver: class { observe() {} },
    JapoDB: { get: async () => ({ source_language: "es", reference_translation: "毎日本を読みます。" }) },
    JapoNativeAndroid: { speakJapanese(text) { spoken = text; return true; } },
    UI: { toast() {} },
    setTimeout,
    clearTimeout,
  };
  context.window = context;
  vm.runInNewContext(practiceTools, context);
  await clickHandler();
  assert.equal(spoken, "毎日本を読みます。");
});
