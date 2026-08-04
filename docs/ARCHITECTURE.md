# Arquitectura

Aplicación estática sin build. `app.js` coordina la UI y los módulos clásicos de `src/` exponen APIs pequeñas en `window`, de modo que la app conserva compatibilidad amplia y puede servirse directamente desde GitHub Pages.

IndexedDB (`japoteacher`, versión 1) contiene `exercises`, `attempts`, `exercise_progress`, `tag_progress`, `daily_sessions`, `settings` e `import_history`. El CSV solo alimenta `exercises`; nunca es la base operativa.

El plan diario se guarda con la clave `perfil::fecha-local`. El selector trabaja por dirección, filtra nivel y cooldown y prioriza repasos vencidos y puntuaciones bajas. Un router selecciona `OpenAiEvaluator` o `MockEvaluator`; solo una respuesta validada actualiza SRS.

La integración real sigue `PWA → Cloudflare Worker → Responses API`. El Worker usa `gpt-5.4-mini`, `reasoning.effort: low`, temperatura 0.2 cuando el modelo la admite y `text.format` con JSON Schema estricto. La clave de OpenAI nunca llega al navegador.
