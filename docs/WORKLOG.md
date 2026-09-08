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

## 2026-09-05 — Corrección de sincronización lenta y lectura incompleta

- La apertura comprueba la revisión devuelta por la reserva de sesión y reutiliza el progreso local solo cuando coincide con una restauración/subida confirmada. Conserva un marcador persistente de cambios pendientes y no espera a subir el historial fusionado para mostrar Hoy. Las peticiones Supabase tienen un presupuesto de red inicial de 12 s, incluido el cuerpo de la respuesta; los heartbeats no se solapan. Las revisiones nuevas siguen descargándose antes del plan.
- La validación de lecciones separa términos pendientes y lecturas de kanji pendientes. Aprovecha las lecturas ya presentes en el diccionario, repara automáticamente lo que falta y conserva una lectura utilizable si la reparación falla. La UI señala exactamente los elementos pendientes y permite completar el bloque guardado sin regenerarlo entero ni afirmar una cobertura completa inexistente.
- QA: suite de 111 pruebas más dos escenarios adicionales de timeout/cambios durante una subida. Playwright con IA simulada verificó lectura parcial → Completar lección → bloque completo, sin duplicados ni cambios en SRS, además de diccionario, preguntas, caché y diseño móvil/escritorio. No se ha medido la conexión real del dispositivo del usuario.


## 2026-09-07 — Ajustes, porcentajes de referencia y selección por bloque

- La barra de nuevas actualiza su porcentaje durante `input`; el guardado local y la reselección no esperan la subida remota. Los cambios consecutivos no restauran porcentajes anteriores.
- «Recalcular el día» está en Hoy y Ajustes. Renueva las pendientes con los criterios actuales y conserva intentos, respuestas, borradores y extras voluntarias.
- Selector preparado para bloques revisados: cuota por dirección (70% de 15 = 11), combinada con nuevas/repasos, niveles, dificultad y enfriamiento. Si faltan frases aptas del bloque se usa banco general y se indica el déficit. La procedencia se muestra en práctica. Las frases del bloque usan los mismos intentos, SRS y EXP.
- Sakamoto figura como pendiente, deshabilitado. NO se han importado ni revisado sus frases: los 11 `.lrpack` siguen siendo archivos de OneDrive no legibles; tres lecturas terminaron con timeout incluso tras marcar la carpeta para disponibilidad local. No hay contenido inventado ni descargas de vídeo. Falta leer los archivos, revisar las traducciones/contexto, deduplicar, clasificar y publicar el JSON del bloque.
- Feedback consulta primero la referencia actual, evitando que un porcentaje incrustado en una frase antigua la sustituya. Resuelve alias por concepto conservando la forma escrita; incluye vocabulario en kana etiquetado y reconocido sin ambigüedad. Etiqueta explícita de frecuencia global y franja derivada, distinta del nivel global de la frase.
- Auditoría: los 10.000 registros de referencia son coherentes con sus franjas y los componentes del CSV de 5.060 ejercicios también. En los 126 ejercicios JA→ES iniciales N5/N4 con dificultad <25, 172/283 entradas de vocabulario están por debajo del top 5%; no el 100%. De los 116 N4, 67 deben su componente más difícil a kanji, 46 a vocabulario y 3 a gramática. No se ha reproducido una palabra concreta del usuario etiquetada N4/top1,3%; ese porcentaje sería N5 según esta referencia. Se mantiene pendiente recibir un ejemplo del dispositivo si persiste.
- Validación: pruebas de cuotas, escasez, conservación de respuestas en ambos sentidos y referencia completa. Prueba de la app en navegador a 360/420/1280 px, recálculo, borradores guardados y sin guardar, extras, recarga y barra con subida remota suspendida. Sin conexión a la cuenta real ni evaluación IA real en estas pruebas.

## 2026-09-07 — Sakamoto importado desde el ZIP y presupuesto cerrado

- El ZIP facilitado posteriormente sí permitió leer los 11 episodios: 3.375 segmentos. Tras filtrado, revisión de autonomía, traducción/anotación, segunda comprobación editorial y cotejo final, se publican 304 frases únicas (608 ejercicios en ambos sentidos). Reparto: N5 34, N4 53, N3 127, N2 75, N1 15. Se excluyen duplicados, fragmentos, referencias insuficientes y transcripciones dudosas; no se ha procesado vídeo.
- Bloque Sakamoto habilitado en Ajustes, con cuota configurable y recálculo de pendientes. Usa el mismo progreso, EXP, diccionario, furigana y vocabulario de la lección diaria. Importarlo no aumenta los requisitos que desbloquean tramos de dificultad; sus respuestas sí aportan evidencia. El nivel sigue el clasificador de frecuencia de la app, no una certificación JLPT oficial.
- La clasificación utiliza el inventario léxico revisado, evitando coincidencias espurias entre palabras (por ejemplo, 時に dentro de 七時に). La carga valida parejas completas, impide duplicados y conserva sus identificadores en recargas. El banco editorial queda fuera del contenido personal sincronizado.
- Límite autorizado: 2.000.000 tokens API de OpenAI. Uso confirmado: 1.441.694; reserva previa: 200.000; ocho peticiones sin respuesta: hasta 272.965. Total conservador: 1.914.659. Registro cerrado, sin más llamadas. La comprobación externa adicional de correcciones finales falló por cortes de conexión; esas correcciones se cotejaron directamente con el japonés en Codex, como documenta `sakamoto-final-validation.json`.
- QA: 125 pruebas Node y 4 de presupuesto correctas. Navegador con datos reales del bloque y cuenta/evaluador simulados: 11 de 15 frases por dirección, vocabulario incluido en la lección, furigana, diccionario, intento puntuado y SRS guardados, recarga sin duplicación, 390/1280 px sin desbordamientos ni errores JS. Apertura local medida: 1.188 ms; no representa la latencia de la cuenta real.

## 2026-09-07 — Consejos mnemotécnicos a petición

- La corrección ofrece «¿Quieres un consejo mnemotécnico?» antes de Siguiente ejercicio cuando hay fallos reales. «Dame un consejo» pide uno o dos trucos centrados en esos errores, con asociación inventada y regla lingüística diferenciadas. No genera imágenes.
- Nueva ruta autenticada `/mnemonic`: contexto acotado a frase, respuesta y hasta seis errores; modelo gpt-5.4-mini sin razonamiento y máximo 850 tokens de salida, con instrucción de no superar 100 palabras. Valida la respuesta, limita tiempos de espera y no reintenta automáticamente.
- Guarda el consejo con el intento y lo muestra en el historial tras recargar. La fusión de sincronización conserva el consejo independientemente de posteriores cambios de nota o dificultad. No modifica SRS, EXP ni notas. Evita peticiones duplicadas en curso y escapa el texto generado al mostrarlo.
- QA: 128 pruebas generales más la prueba de integración del nuevo endpoint correctas (129 en total). Prueba de navegador con API simulada en 390/1280 px: ambos sentidos, ausencia de generación automática, doble clic, persistencia tras recarga, historial, error recuperable, cambio de vista durante petición y ausencia del botón en respuestas sin fallos. Sin errores JS ni desbordamientos. Cero llamadas reales a OpenAI durante desarrollo/pruebas; presupuesto cerrado de Sakamoto intacto.

## 2026-09-07 — Consejo también tras acertar

- La opción mnemotécnica aparece en todas las correcciones válidas, incluidas las respuestas sin errores. En ese caso propone recordar vocabulario o estructura sin inventar fallos. El endpoint acepta errores vacíos; conserva generación a petición, caché e historial.
- Validados los cuatro tests del módulo y el flujo de navegador en móvil/escritorio, incluyendo generar y guardar un consejo tras una respuesta correcta. Sin llamadas reales a OpenAI.

## 2026-09-08 — Planes por contenido y dirección

- Hoy se organiza en planes N5–N1 y Sakamoto independientes por dirección, con pendientes de hoy, por aprender, estudiadas, dominadas y biblioteca filtrable. Cada plan configura máximo total y nuevas; opciones avanzadas de tandas, semana, repasos, dificultad y pausa. Migración idempotente de límites anteriores sin borrar historial.
- Retirados porcentajes globales y niveles del formulario general. Las prácticas y sustituciones permanecen dentro del plan elegido; Cambiar frase abre directamente fácil/repetida/difícil. Recalcular conserva respuestas, borradores y cupos consumidos, incluso al cambiar niveles.
- Mnemotecnias con asociaciones concretas de sonido, significado y componentes conocidos, diferenciadas de etimología. Alternativa guardada mediante Probar otra asociación, solo a petición.
- QA: 136 pruebas Node correctas y flujos de planes y mnemotecnias en navegador a 390/1280 px, con persistencia, migración, límites, sustitución y respuestas correctas. Sin errores JS ni desbordamiento. API simulada: cero llamadas reales a OpenAI, presupuesto de importación intacto.
- Worker publicado: 5dd0796c-0987-47da-9439-5ce596e35bc9. Frontend preparado para GitHub Pages, caché v156. Detalles en STUDY_PLANS.md.

## 2026-09-08 — Marcar una respuesta como dominada

- Botón Dominada en la corrección y en la valoración final. Aplaza 62 días la frase en esa dirección, sin cambiar nota ni EXP ni adelantar un repaso ya más lejano. Cancela Repetir mañana y permite continuar directamente.
- La marca se guarda en intento y progreso, sobrevive a reconstrucciones por ajustes de nota y se fusiona independientemente durante sincronización.
- QA: 139 pruebas Node; prueba de navegador móvil/escritorio de marcado, reconstrucción y recarga con API simulada. Sin llamadas reales a OpenAI. Caché PWA v157.
