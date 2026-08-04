# Registro de trabajo

## MVP inicial

- App shell responsive, cuatro pantallas y referencia visual en `design-concept.png`.
- IndexedDB y backup sin secretos.
- CSV inicial de 20 ejercicios independientes e importador con informe.
- Plan diario persistente con dos colas.
- MockEvaluator, intentos inmutables, SRS y progreso por tags.
- Exportación de intentos y workflow de GitHub Pages.

## Integración OpenAI

- `OpenAiEvaluator` con timeout, reintento y validación.
- Worker seguro para Responses API con clave y token como secretos.
- `gpt-5.4-mini`, razonamiento bajo y JSON Schema estricto.
- Ajustes locales para URL del Worker y token del proxy, excluidos de backups.
