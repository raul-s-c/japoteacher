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

## 2026-09-05 — Preparación diaria y arranque

- Añadida «Lección explicativa» antes de las tarjetas de práctica: usa el vocabulario del plan real en ambos sentidos, incluidas frases nuevas y de refuerzo. Generación bajo demanda, traducción por párrafo, furigana, diccionario/explicación contextual, audio y preguntas al tutor. Lecturas divididas en bloques de hasta 20 términos para cubrir planes extensos sin truncarlos.
- Nuevo endpoint autenticado `/daily-lesson`; valida la presencia de cada término (incluida su forma flexionada literal) y cobertura de kanji antes de devolver la lectura. Guarda bloques terminados por cuenta, sesión y contenido del plan en el dispositivo; permite reintentar sin repetir los ya generados. Leer no modifica intentos, SRS ni ejercicios completados.
- Arranque: scripts diferidos, una sola instantánea de ejercicios para Hoy, estadísticas del banco solo al abrir Ajustes, informes después del primer render y eliminación de la espera artificial de navegación. La PWA abre el shell instalado y reutiliza los assets precacheados aunque lleven parámetro de versión; las actualizaciones siguen llegando por el service worker. Se conserva la sincronización previa al plan diario.
- QA: 101 pruebas Node iniciales y 2 pruebas adicionales de caché correctas. Playwright local, banco completo, IA y autenticación simuladas: 1280×900 y 390×844, sin errores de consola ni desbordamiento horizontal; verificados diccionario, preguntas, furigana, lectura guardada, error recuperable y ausencia de cambios en progreso. Comparación de tres aperturas: antes 971/930/947 ms; después 423/408/423 ms. Mediana 947 → 423 ms (55 % menos); no mide la latencia real de sincronización ni de generación IA.
- Publicación autorizada por el usuario: Worker desplegado con versión 5348eaab-0d9b-4096-bbd8-fed39b1a10d7; frontend enviado a main para GitHub Pages. No se ha realizado generación con la cuenta real.
